// Calculs dérivés de l'état (recalculés à chaque changement, mémorisés par le store).
import { latestBlood, markerStatus, MARKER_BY_ID, STATUS_LABEL, type MarkerStatus } from './blood';
import { bodySnapshot, latestValues, trendSeries, type BodySnapshot } from './bodyComp';
import { habitsFor, type Habit } from './longevity';
import { generateWeekPlan, type WeekPlan } from './mealPlanner';
import { computeTargets, type NutritionTargets } from './nutrition';
import { activeStack, supplementPlan, type SupplementRec } from './supplements';
import { buildProgram, type Program } from './training';
import type { AppState, Profile } from './types';
import { fmt, todayISO } from './util';

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
}

export function computeDerived(state: AppState): Derived | null {
  const profile = state.profile;
  if (!profile) return null;
  const snap = bodySnapshot(profile, state.measurements);
  const targets = computeTargets(profile, snap, state.plan.kcalAdjustment);
  const mealTargets: NutritionTargets = state.plan.mealTargets ? { ...targets, ...state.plan.mealTargets } : targets;
  const week = generateWeekPlan(profile, mealTargets, state.plan);
  const latest = latestValues(state.measurements);
  const program = buildProgram(profile, state.plan.programStart, state.plan.programVariant, todayISO(), latest.heartRate?.value);
  const bl = latestBlood(state.bloodPanels);
  const blood = Object.fromEntries(Object.entries(bl).map(([k, v]) => [k, v.value]));
  const bloodDates = Object.fromEntries(Object.entries(bl).map(([k, v]) => [k, v.date]));
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
  const latest = trendSeries(state.measurements, 'weightKg');
  if (latest.length > 1) lines.push(`Nombre de jours de pesées : ${latest.length}.`);
  return lines.join('\n');
}
