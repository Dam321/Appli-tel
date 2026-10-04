// Calculs dérivés de l'état (recalculés à chaque changement, mémorisés par le store).
import { latestBlood, markerStatus, MARKER_BY_ID, STATUS_LABEL, type MarkerStatus } from './blood';
import { bodySnapshot, latestValues, trendSeries, type BodySnapshot } from './bodyComp';
import { habitsFor, type Habit } from './longevity';
import { generateWeekPlan, type PlannerOptions, type WeekPlan } from './mealPlanner';
import { microCoverage, microReferences, weeklyMicros, type MicroCoverage } from './micronutrients';
import { computeTargets, type NutritionTargets } from './nutrition';
import { activeStack, supplementPlan, type SupplementRec } from './supplements';
import { autoVolume, buildProgram, readinessScore, type AutoVolume, type Program } from './training';
import type { AppState, Profile } from './types';
import { addDays, fmt, todayISO } from './util';
import { assess } from './assessment';
import { insights } from './insights';
import { nightReport, nightSummary, sleepStats } from './sleep';

export interface Derived {
  profile: Profile;
  snap: BodySnapshot;
  targets: NutritionTargets;
  /** Cibles réellement utilisées par le menu de la semaine (figées) */
  mealTargets: NutritionTargets;
  week: WeekPlan;
  program: Program;
  supplements: SupplementRec[];
  stack: SupplementRec[];
  blood: Record<string, number>;
  bloodDates: Record<string, string>;
  habits: Habit[];
  micros: MicroCoverage[];
  plannerOptions: PlannerOptions;
  autoVolume: AutoVolume;
}

/** Profil cardiovasculaire à protéger : oriente le menu (moins de viande rouge/fromage) */
export function lipidFocus(profile: Profile, blood: Record<string, number>): boolean {
  return (
    profile.conditions.includes('high_cholesterol') ||
    profile.conditions.includes('heart') ||
    profile.familyHistory.includes('heart') ||
    (blood.apob ?? 0) > 0.8 ||
    (blood.ldl ?? 0) > 100 ||
    (blood.lpa ?? 0) > 75
  );
}

export function computeDerived(state: AppState): Derived | null {
  const profile = state.profile;
  if (!profile) return null;
  const snap = bodySnapshot(profile, state.measurements);
  const targets = computeTargets(profile, snap, state.plan.kcalAdjustment);
  const mealTargets: NutritionTargets = state.plan.mealTargets ? { ...targets, ...state.plan.mealTargets } : targets;
  const bl = latestBlood(state.bloodPanels);
  const blood = Object.fromEntries(Object.entries(bl).map(([k, v]) => [k, v.value]));
  const bloodDates = Object.fromEntries(Object.entries(bl).map(([k, v]) => [k, v.date]));
  const plannerOptions: PlannerOptions = { lipidFocus: lipidFocus(profile, blood) };
  const week = generateWeekPlan(profile, mealTargets, state.plan, plannerOptions);
  const latest = latestValues(state.measurements);
  // FC de repos saisie (montre, matin au calme) en priorité ; sinon celle de la balance (debout, un peu plus haute)
  const restingHr = latest.restingHr?.value ?? latest.heartRate?.value;
  const today = todayISO();
  const readinessValues = Array.from({ length: 14 }, (_, i) => state.daily[addDays(today, -i)]?.readiness)
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map(readinessScore);
  const readinessAvg = readinessValues.length >= 3 ? readinessValues.reduce((a, b) => a + b, 0) / readinessValues.length : undefined;
  const auto = autoVolume(state.workouts, today, readinessAvg);
  const program = buildProgram(profile, state.plan.programStart, state.plan.programVariant, today, restingHr, { volumeAdjust: auto.adjust });
  const usesProteinPowder = week.days.some((d) => d.meals.some((m) => m.ingredients.some((i) => i.food === 'whey' || i.food === 'pea_protein')));
  const supplements = supplementPlan({
    profile,
    age: snap.age,
    weightKg: snap.weightKg,
    blood,
    fattyFishMeals: week.fattyFishMeals,
    avgFiber: week.avgFiber,
    usesProteinPowder,
    month: new Date().getMonth(),
    micros: weeklyMicros(week),
    microRefs: microReferences(profile),
  });
  return {
    profile,
    snap,
    targets,
    mealTargets,
    week,
    program,
    supplements,
    stack: activeStack(supplements),
    blood,
    bloodDates,
    habits: habitsFor(profile, targets.waterL, targets.protein),
    micros: microCoverage(week, profile),
    plannerOptions,
    autoVolume: auto,
  };
}

const LABELS: Record<string, string> = {
  omnivore: 'omnivore',
  pescatarian: 'pescétarien',
  vegetarian: 'végétarien',
  vegan: 'vegan',
  beginner: 'débutant',
  intermediate: 'intermédiaire',
  advanced: 'avancé',
};

/** Résumé texte de toutes les données, envoyé au coach IA. */
export function coachSummary(state: AppState, d: Derived): string {
  const p = d.profile;
  const s = d.snap;
  const t = d.targets;
  const lines: string[] = [];
  lines.push(`Date : ${todayISO()}`);
  lines.push(
    `Profil : ${p.sex === 'male' ? 'homme' : 'femme'}, ${s.age} ans, ${p.heightCm} cm, niveau ${LABELS[p.experience]}, ${p.trainingDays} séances/sem de ${p.sessionMinutes} min, matériel : ${p.equipment.join(', ') || 'aucun'}, blessures : ${p.injuries.join(', ') || 'aucune'}, régime ${LABELS[p.diet]}, allergies : ${p.allergens.join(', ') || 'aucune'}, sommeil ${p.sleepQuality}/5 (1 = très bon), stress ${p.stressLevel}/5, alcool ${p.alcoholPerWeek} verres/sem.`,
  );
  lines.push(
    `Santé : pathologies ${p.conditions.join(', ') || 'aucune'} ; traitements ${p.medications.join(', ') || 'aucun'} ; tabac ${p.smoking} ; antécédents familiaux ${p.familyHistory.join(', ') || 'aucun'}${p.femaleStatus ? ` ; statut ${p.femaleStatus}` : ''}. Rythme : lever ${p.wakeTime}, coucher ${p.bedTime}, entraînement ${p.trainingTime}. Priorités musculaires : ${p.priorities.join(', ') || 'aucune'}. Cardio préféré : ${p.cardioModes.join(', ')}. Budget ${p.budget}, cuisine max ${p.maxCookMinutes} min.`,
  );
  if (t.notes.length) lines.push(`Adaptations santé de la nutrition : ${t.notes.join(' ')}`);
  lines.push(`Micronutriments du menu (% des références) : ${d.micros.map((m) => `${m.label} ${m.pct} %`).join(', ')}.`);
  lines.push(
    `Composition (tendance lissée) : ${fmt(s.weightKg)} kg, ${fmt(s.fatPct)} % de gras (${s.fatPctSource}), masse maigre ${fmt(s.leanMassKg)} kg, FFMI ${fmt(s.ffmi)}, IMC ${fmt(s.bmi)}${s.waistToHeight ? `, tour de taille/taille ${fmt(s.waistToHeight, 2)}` : ''}${s.weeklyRateKg !== undefined ? `, évolution ${fmt(s.weeklyRateKg, 2)} kg/sem` : ''}.`,
  );
  const recent = state.measurements.slice(-10).map((m) => `${m.date.slice(0, 10)} : ${m.weightKg ?? '–'} kg${m.fatPct ? `, ${m.fatPct} %` : ''}`);
  if (recent.length) lines.push(`Dernières pesées : ${recent.join(' ; ')}.`);
  lines.push(
    `Nutrition : phase « ${t.phaseLabel} » (${t.phaseReason}) ; ${t.kcal} kcal/j (dépense estimée ${t.tdee}, ajustement ${t.adjustment}), protéines ${t.protein} g, glucides ${t.carbs} g, lipides ${t.fat} g, fibres ${t.fiber} g ; vitesse visée ${t.targetRateKg} kg/sem.`,
  );
  lines.push(
    `Menu de la semaine : ${d.week.plantCount} plantes différentes, ${d.week.fattyFishMeals} repas de poisson gras, ${d.week.legumeMeals} repas à base de légumineuses. Ex. aujourd'hui : ${d.week.days[(new Date().getDay() + 6) % 7].meals.map((m) => m.name).join(' / ')}.`,
  );
  const prog = d.program;
  lines.push(`Programme : ${prog.splitName}, cycle ${prog.cycle}, semaine ${prog.week}/5${prog.deload ? ' (décharge)' : ''}. Séances : ${prog.sessions.map((x) => `${x.name} [${x.exercises.map((e) => `${e.name} ${e.sets}×${e.reps[0]}-${e.reps[1]}`).join(', ')}]`).join(' | ')}.`);
  lines.push(`Cardio : zone 2 ${prog.cardio.zone2.sessions}×${prog.cardio.zone2.minutes} min (${prog.cardio.zone2.hrLow}-${prog.cardio.zone2.hrHigh} bpm)${prog.cardio.vo2 ? ', 1× VO2max 4×4' : ''}.`);
  const workouts = state.workouts.slice(-6).map((w) => `${w.date} ${w.sessionId} : ${w.entries.map((e) => `${e.exerciseId} ${e.sets.map((x) => `${x.weight}×${x.reps}`).join('/')}`).join(', ')}`);
  if (workouts.length) lines.push(`Dernières séances : ${workouts.join(' || ')}.`);
  const bloodLines = Object.entries(d.blood).map(([id, v]) => {
    const m = MARKER_BY_ID[id];
    if (!m) return `${id} ${v}`;
    const st: MarkerStatus = markerStatus(m, p.sex, v);
    return `${m.short} ${v} ${m.unit} (${STATUS_LABEL[st]}, ${d.bloodDates[id]})`;
  });
  lines.push(bloodLines.length ? `Prise de sang : ${bloodLines.join(' ; ')}.` : 'Prise de sang : pas encore faite.');
  lines.push(`Compléments conseillés actuellement : ${d.stack.map((x) => `${x.name} (${x.dose})`).join(' ; ')}.`);
  const last7 = Object.entries(state.daily)
    .filter(([day]) => day >= new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10))
    .map(([day, log]) => `${day} : ${Object.entries(log.habits).filter(([, v]) => v).map(([k]) => k).join(', ')}`);
  if (last7.length) lines.push(`Habitudes cochées (7 j) : ${last7.join(' | ')}.`);
  const sleep = sleepStats(state.daily, todayISO());
  if (sleep) lines.push(`Sommeil mesuré (Withings, 14 j) : ${sleep.avgHours} h en moyenne sur ${sleep.nights} nuits${sleep.avgEfficiency !== undefined ? `, efficacité ${sleep.avgEfficiency} %` : ''}.`);
  const night = nightReport(state.daily, todayISO());
  if (night) lines.push(`Nuit dernière : ${nightSummary(night).text}`);
  const meals = Object.entries(state.daily)
    .filter(([day, log]) => day >= addDays(todayISO(), -7) && log.extraMeals?.length)
    .flatMap(([day, log]) => log.extraMeals!.map((m) => `${day} ${m.name} (${m.kcal} kcal, ${m.protein} g P${m.replaces ? `, remplace le ${m.replaces}` : ', en plus'})`));
  if (meals.length) lines.push(`Repas hors menu (7 j) : ${meals.join(' ; ')}.`);
  const latest = trendSeries(state.measurements, 'weightKg');
  if (latest.length > 1) lines.push(`Nombre de jours de pesées : ${latest.length}.`);
  const a = assess(state, d);
  lines.push(`Bilan 360° : score global ${a.global ?? 'n/a'} ; ${a.pillars.map((x) => `${x.label} ${x.score ?? 'n/a'}`).join(', ')}.`);
  if (a.bio.phenoAge !== undefined) lines.push(`Âge biologique (PhenoAge) : ${a.bio.phenoAge.toFixed(1)} ans pour ${a.bio.chronoAge} ans.`);
  lines.push(`Actions prioritaires calculées : ${a.actions.slice(0, 5).map((x) => x.title).join(' ; ') || 'aucune'}.`);
  const ins = insights(state, d);
  if (ins.length) lines.push(`Observations sur ses données : ${ins.map((x) => `${x.title} (${x.text})`).join(' ; ')}.`);
  if (d.autoVolume.notes.length) lines.push(`Ajustements automatiques du programme : ${d.autoVolume.notes.join(' ')}`);
  return lines.join('\n');
}
