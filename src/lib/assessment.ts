// Bilan 360° : note chaque pilier de la santé à partir de TES données, puis classe
// les actions par impact attendu sur ta santé et ta longévité. Les poids d'impact
// reflètent l'ordre de grandeur des risques relatifs de la littérature (tabac, VO2max,
// tension, ApoB, glycémie, sommeil, pas…) ; ce n'est pas un calcul de risque individuel.
import { bioAge, nextBloodTest, type BioAgeResult, type RetestPlan } from './bioage';
import { MARKER_BY_ID, markerStatus } from './blood';
import { bpCategory, latestValues, restingHrCategory } from './bodyComp';
import type { Derived } from './derived';
import { dayScore, vo2Category } from './longevity';
import { plannedSleepHours } from './profile';
import { exerciseHistory, readinessScore } from './training';
import type { AppState } from './types';
import { addDays, daysBetween, todayISO } from './util';

export type PillarId = 'cardio' | 'force' | 'composition' | 'metabolic' | 'sleep' | 'nutrition' | 'mind' | 'appearance';

export interface Pillar {
  id: PillarId;
  label: string;
  score?: number;
  detail: string;
}

export interface Action {
  id: string;
  pillar: PillarId;
  title: string;
  why: string;
  how: string;
  impact: number;
  /** Écran où agir (route#onglet) */
  route?: string;
}

export interface Assessment {
  pillars: Pillar[];
  global?: number;
  actions: Action[];
  bio: BioAgeResult;
  retest: RetestPlan;
}

const WEIGHTS: Record<PillarId, number> = { cardio: 1.3, force: 1.1, composition: 1.1, metabolic: 1.3, sleep: 1.1, nutrition: 1, mind: 1, appearance: 0.5 };
const LABELS: Record<PillarId, string> = {
  cardio: 'Cardio (VO2max)',
  force: 'Force & muscle',
  composition: 'Composition corporelle',
  metabolic: 'Métabolisme & cœur',
  sleep: 'Sommeil & récupération',
  nutrition: 'Nutrition',
  mind: 'Habitudes & mental',
  appearance: 'Peau & apparence',
};

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

export function assess(state: AppState, d: Derived, today = todayISO()): Assessment {
  const p = d.profile;
  const ms = state.measurements;
  const latest = latestValues(ms);
  const days7 = Array.from({ length: 7 }, (_, i) => state.daily[addDays(today, -i)]).filter(Boolean);
  const habitRatio = (id: string) => (days7.length ? days7.filter((x) => x!.habits[id]).length / 7 : undefined);
  const actions: Action[] = [];
  const pillars: Pillar[] = [];

  // ——— Cardio ———
  {
    const vo2 = latest.vo2max?.value;
    const rhr = (latest.restingHr ?? latest.heartRate)?.value;
    const z2 = state.cardio.filter((c) => daysBetween(c.date, today) <= 7).reduce((a, c) => a + c.minutes, 0);
    let score: number | undefined;
    let detail: string;
    if (vo2) {
      const cat = vo2Category(p.sex, d.snap.age, vo2);
      const map: Record<string, number> = { Faible: 15, 'Sous la moyenne': 35, Moyen: 55, Bon: 75, Excellent: 90 };
      score = Object.entries(map).find(([k]) => cat.label.startsWith(k))?.[1] ?? 100;
      detail = `VO2max ${vo2} : ${cat.label.toLowerCase()}`;
      if (score < 75)
        actions.push({
          id: 'vo2',
          pillar: 'cardio',
          title: 'Remonter ta VO2max',
          why: `Ta VO2max (${vo2}) est « ${cat.label.toLowerCase()} ». C’est le facteur le plus fortement lié à la longévité : passer d’une catégorie à la suivante réduit nettement le risque de décès.`,
          how: '3 × 40 min de zone 2 + 1 séance 4×4 min par semaine, pendant 12 semaines, puis refais le test.',
          impact: score < 40 ? 9.5 : 8,
          route: 'training',
        });
    } else if (rhr) {
      const cat = restingHrCategory(rhr);
      score = { good: 75, neutral: 55, warning: 35, serious: 20, critical: 15 }[cat.tone];
      detail = `Estimation via ta fréquence cardiaque (${Math.round(rhr)} bpm) : mesure ta VO2max pour être précis`;
      actions.push({ id: 'vo2_measure', pillar: 'cardio', title: 'Mesurer ta VO2max', why: 'C’est le meilleur prédicteur de longévité connu, et tu ne l’as pas encore mesurée.', how: 'Test de Cooper (12 min de course, distance max) ou valeur de ta montre, à saisir dans Santé → Longévité.', impact: 6, route: 'health#longevity' });
    } else {
      detail = 'Pas encore de mesure';
      actions.push({ id: 'vo2_measure', pillar: 'cardio', title: 'Mesurer ta VO2max', why: 'C’est le meilleur prédicteur de longévité connu, et tu ne l’as pas encore mesurée.', how: 'Test de Cooper (12 min de course, distance max) ou valeur de ta montre, à saisir dans Santé → Longévité.', impact: 6, route: 'health#longevity' });
    }
    if (score !== undefined && z2 >= 120) score = clamp100(score + 8);
    pillars.push({ id: 'cardio', label: LABELS.cardio, score, detail: z2 ? `${detail} · ${z2} min de cardio cette semaine` : detail });
  }

  // ——— Force & muscle ———
  {
    const recent = state.workouts.filter((w) => daysBetween(w.date, today) <= 28);
    const planned = p.trainingDays * 4;
    const adherence = Math.min(1, recent.length / planned);
    const ids = [...new Set(state.workouts.filter((w) => daysBetween(w.date, today) <= 42).flatMap((w) => w.entries.map((e) => e.exerciseId)))];
    const progress = ids
      .map((id) => exerciseHistory(state.workouts, id).filter((h) => daysBetween(h.date, today) <= 42))
      .filter((h) => h.length >= 2)
      .map((h) => (h[h.length - 1].e1rm - h[0].e1rm) / Math.max(h[0].e1rm, 1));
    const prog = avg(progress);
    const progScore = prog === undefined ? 0.5 : prog >= 0.05 ? 1 : prog >= 0.01 ? 0.75 : prog >= 0 ? 0.5 : 0.2;
    const score = state.workouts.length ? clamp100(100 * (0.6 * adherence + 0.4 * progScore)) : 10;
    pillars.push({
      id: 'force',
      label: LABELS.force,
      score,
      detail: state.workouts.length
        ? `${recent.length}/${planned} séances sur 4 semaines${prog !== undefined ? ` · force ${prog >= 0 ? '+' : ''}${Math.round(prog * 100)} % sur 6 semaines` : ''}`
        : 'Aucune séance enregistrée',
    });
    if (adherence < 0.7)
      actions.push({
        id: 'train',
        pillar: 'force',
        title: 'Faire toutes tes séances de musculation',
        why: state.workouts.length ? `${recent.length} séances sur les ${planned} prévues ce mois-ci.` : 'Aucune séance enregistrée pour l’instant.',
        how: 'Bloque tes créneaux dans ton agenda comme des rendez-vous ; une séance courte vaut mieux qu’une séance sautée.',
        impact: state.workouts.length ? 7 : 8,
        route: 'training',
      });
    else if (prog !== undefined && prog < 0.01)
      actions.push({ id: 'stall', pillar: 'force', title: 'Relancer ta progression', why: 'Ta force stagne depuis 6 semaines.', how: 'Note tes RIR à chaque série, dors 7 h 30 minimum, et fais ta semaine de décharge si tu es fatigué.', impact: 4, route: 'training' });
  }

  // ——— Composition ———
  {
    const [lo, hi] = p.sex === 'male' ? [10, 15] : [18, 24];
    const bf = d.snap.fatPct;
    const fatScore = bf > hi ? 100 - (bf - hi) * 6 : bf < lo - 3 ? 80 : 100;
    const whtr = d.snap.waistToHeight;
    const parts = [fatScore];
    if (whtr) parts.push(whtr < 0.5 ? 100 : whtr < 0.55 ? 65 : 35);
    const score = clamp100(avg(parts)!);
    pillars.push({ id: 'composition', label: LABELS.composition, score, detail: `${bf.toFixed(1).replace('.', ',')} % de gras (cible ${lo}-${hi} %)${whtr ? ` · tour de taille/taille ${whtr.toFixed(2).replace('.', ',')}` : ''}` });
    if (bf > hi + 2 || (whtr ?? 0) >= 0.5)
      actions.push({
        id: 'fat',
        pillar: 'composition',
        title: 'Réduire ta masse grasse (surtout abdominale)',
        why: `${bf.toFixed(1).replace('.', ',')} % de gras${whtr ? ` et un tour de taille à ${Math.round(whtr * 100)} % de ta taille` : ''} : la graisse viscérale est la plus nocive (cœur, diabète, inflammation).`,
        how: 'Suis le menu à 90 %, 8 000+ pas par jour, protéines à chaque repas. Le bilan hebdo ajuste tes calories tout seul.',
        impact: bf > hi + 8 || (whtr ?? 0) >= 0.55 ? 8 : 6,
        route: 'nutrition',
      });
  }

  // ——— Métabolisme & cœur ———
  {
    const keys = ['apob', 'ldl', 'hba1c', 'glucose', 'triglycerides', 'hdl', 'crp', 'insulin', 'alt', 'ggt'];
    const scores: number[] = [];
    for (const k of keys) {
      const v = d.blood[k];
      const m = MARKER_BY_ID[k];
      if (v === undefined || !m) continue;
      const st = markerStatus(m, p.sex, v);
      scores.push(st === 'optimal' ? 100 : st === 'low' || st === 'high' ? 25 : 65);
    }
    const sys = latest.systolic?.value;
    const dia = latest.diastolic?.value;
    let bpTone: string | undefined;
    if (sys && dia) {
      bpTone = bpCategory(sys, dia).tone;
      scores.push({ good: 100, neutral: 80, warning: 55, serious: 35, critical: 20 }[bpTone]!);
    }
    const score = scores.length ? clamp100(avg(scores)!) : undefined;
    pillars.push({ id: 'metabolic', label: LABELS.metabolic, score, detail: scores.length ? `${scores.filter((x) => x === 100).length}/${scores.length} marqueurs dans la zone optimale` : 'Prise de sang et tension à renseigner' });
    if (!state.bloodPanels.length)
      actions.push({ id: 'blood', pillar: 'metabolic', title: 'Faire ton bilan sanguin', why: 'Sans prise de sang, impossible de voir l’intérieur : ApoB, glycémie, vitamine D, fer, âge biologique…', how: 'Montre la liste « Bilan à demander » à ton médecin, puis saisis les résultats.', impact: 7, route: 'health#blood' });
    const apob = d.blood.apob;
    const ldl = d.blood.ldl;
    if ((apob ?? 0) > 1.0 || (ldl ?? 0) > 130)
      actions.push({ id: 'apob', pillar: 'metabolic', title: 'Baisser ton ApoB / LDL', why: `ApoB ${apob ?? '?'} g/L, LDL ${ldl ?? '?'} mg/dL : l’exposition au cholestérol s’accumule sur toute la vie.`, how: 'Psyllium 10 g/j, moins de graisses saturées (le menu est déjà adapté), perte de gras ; si ça reste haut à 3 mois, parles-en à ton médecin.', impact: 8, route: 'health#supplements' });
    else if ((apob ?? 0) > 0.8)
      actions.push({ id: 'apob', pillar: 'metabolic', title: 'Optimiser ton ApoB', why: `ApoB ${apob} g/L : normal, mais au-dessus de la cible longévité (< 0,8).`, how: 'Fibres solubles, oméga-3, moins de fromage et charcuterie ; recontrôle dans 3-6 mois.', impact: 5, route: 'nutrition' });
    if ((d.blood.hba1c ?? 0) >= 5.7 || (d.blood.glucose ?? 0) >= 100)
      actions.push({ id: 'glucose', pillar: 'metabolic', title: 'Améliorer ta glycémie', why: 'Glycémie ou HbA1c au-dessus de l’optimal : signe précoce de résistance à l’insuline.', how: 'Marche 10 min après chaque repas, musculation, perte de gras abdominal, glucides complets autour de l’entraînement.', impact: 8, route: 'nutrition' });
    if (bpTone === 'critical' || bpTone === 'warning')
      actions.push({
        id: 'bp',
        pillar: 'metabolic',
        title: bpTone === 'critical' ? 'Faire contrôler ta tension' : 'Faire baisser ta tension',
        why: `Tension ${sys}/${dia} : chaque baisse de 10 mmHg réduit d’environ 20 % le risque cardiovasculaire.`,
        how: bpTone === 'critical' ? 'Mesure-la 3 jours de suite matin et soir, puis montre les chiffres à ton médecin.' : 'Moins de sel, plus de potassium (légumes), zone 2, sommeil, moins d’alcool.',
        impact: bpTone === 'critical' ? 9 : 7,
        route: 'body',
      });
    if ((d.blood.crp ?? 0) > 3) actions.push({ id: 'crp', pillar: 'metabolic', title: 'Faire baisser ton inflammation', why: `CRP à ${d.blood.crp} mg/L.`, how: 'Vérifie l’absence d’infection récente, puis : sommeil, perte de gras viscéral, oméga-3, zéro ultra-transformé. Recontrôle à 3 mois.', impact: 5, route: 'health#blood' });
    if ((d.blood.vitd ?? 99) < 20) actions.push({ id: 'vitd', pillar: 'metabolic', title: 'Corriger ta carence en vitamine D', why: `Vitamine D à ${d.blood.vitd} ng/mL.`, how: 'Dose indiquée dans tes compléments, recontrôle à 3 mois.', impact: 5, route: 'health#supplements' });
    if ((d.blood.ferritin ?? 99) < 30) actions.push({ id: 'iron', pillar: 'metabolic', title: 'Remonter tes réserves de fer', why: `Ferritine à ${d.blood.ferritin} µg/L : fatigue et performances en baisse.`, how: 'Fer un jour sur deux (voir compléments) et recontrôle à 3 mois.', impact: 5, route: 'health#supplements' });
    if (p.familyHistory.includes('heart') && d.blood.lpa === undefined)
      actions.push({ id: 'lpa', pillar: 'metabolic', title: 'Doser ta Lp(a) une fois', why: 'Antécédents cardiaques dans ta famille : la Lp(a) est génétique et invisible sur un bilan classique.', how: 'Ajoute-la à ta prochaine prise de sang.', impact: 4, route: 'health#blood' });
  }

  // ——— Sommeil ———
  {
    const planned = plannedSleepHours(p);
    const readiness = days7.map((x) => x!.readiness).filter(Boolean).map((r) => readinessScore(r!));
    const parts = [planned >= 7.5 ? 100 : planned >= 7 ? 80 : planned >= 6.5 ? 60 : planned >= 6 ? 40 : 20, ((6 - p.sleepQuality) / 5) * 100];
    const ra = avg(readiness);
    if (ra !== undefined) parts.push(ra);
    const score = clamp100(avg(parts)!);
    pillars.push({ id: 'sleep', label: LABELS.sleep, score, detail: `${planned.toFixed(1).replace('.', ',')} h prévues par nuit${ra !== undefined ? ` · forme moyenne ${Math.round(ra)}/100` : ''}` });
    if (planned < 7)
      actions.push({ id: 'sleep', pillar: 'sleep', title: 'Dormir au moins 7 h 30', why: `Tu prévois ${planned.toFixed(1).replace('.', ',')} h : le manque de sommeil réduit la perte de gras, la testostérone, la récupération et la longévité.`, how: 'Avance ton coucher de 30 min cette semaine, puis encore 30 min la suivante. Écrans coupés 1 h avant.', impact: 8, route: 'settings' });
    else if (p.sleepQuality >= 4 || (ra !== undefined && ra < 50))
      actions.push({ id: 'sleep_q', pillar: 'sleep', title: 'Améliorer la qualité de ton sommeil', why: 'Sommeil ressenti comme mauvais ou forme du matin basse.', how: 'Horaires fixes 7 j/7, chambre 18 °C et noire, zéro alcool et caféine après 14 h. Si tu ronfles : dépistage d’apnée du sommeil.', impact: 6, route: 'home' });
  }

  // ——— Nutrition ———
  {
    const meals = days7.reduce((a, x) => a + Object.values(x!.meals ?? {}).filter(Boolean).length, 0);
    const adherence = meals > 0 ? Math.min(1, meals / (7 * p.mealsPerDay)) : undefined;
    const protein = habitRatio('protein');
    const alcohol = p.alcoholPerWeek === 0 ? 100 : p.alcoholPerWeek <= 3 ? 80 : p.alcoholPerWeek <= 7 ? 60 : p.alcoholPerWeek <= 14 ? 35 : 15;
    const parts: number[] = [alcohol];
    if (adherence !== undefined) parts.push(adherence * 100);
    if (protein !== undefined) parts.push(protein * 100);
    const lowMicros = d.micros.filter((m) => m.pct < 70 && m.key !== 'vitD');
    parts.push(lowMicros.length ? 70 : 100);
    const score = clamp100(avg(parts)!);
    pillars.push({ id: 'nutrition', label: LABELS.nutrition, score, detail: `${adherence !== undefined ? `${Math.round(adherence * 100)} % des repas suivis · ` : ''}${p.alcoholPerWeek} verre(s) d’alcool/sem.` });
    if (p.alcoholPerWeek > 7)
      actions.push({ id: 'alcohol', pillar: 'nutrition', title: 'Réduire l’alcool', why: `${p.alcoholPerWeek} verres par semaine : sommeil, récupération, testostérone, foie et risque de cancer en pâtissent.`, how: 'Objectif : moins de 3 verres/semaine, jamais les jours d’entraînement, jamais dans les 3 h avant le coucher.', impact: 6, route: 'home' });
    if (adherence !== undefined && adherence < 0.7)
      actions.push({ id: 'menu', pillar: 'nutrition', title: 'Suivre le menu à 80 %', why: `${Math.round(adherence * 100)} % des repas suivis cette semaine.`, how: 'Fais les courses avec la liste et cuisine en double le soir : le déjeuner du lendemain est prêt.', impact: 6, route: 'nutrition' });
  }

  // ——— Habitudes & mental ———
  {
    const habitAvg = avg(days7.map((x) => dayScore(x, d.habits)));
    const stress = ((6 - p.stressLevel) / 5) * 100;
    let score = clamp100(avg([habitAvg ?? 50, stress])!);
    if (p.smoking === 'current') score = Math.min(score, 20);
    pillars.push({ id: 'mind', label: LABELS.mind, score, detail: `${habitAvg !== undefined ? `Habitudes ${Math.round(habitAvg)} % · ` : ''}stress ${p.stressLevel}/5${p.smoking === 'current' ? ' · fumeur' : ''}` });
    if (p.smoking === 'current')
      actions.push({ id: 'smoke', pillar: 'mind', title: 'Arrêter de fumer', why: 'Le tabac retire en moyenne 10 ans d’espérance de vie : aucun autre levier ne compense.', how: 'Substituts nicotiniques (remboursés) + accompagnement gratuit au 39 89 (Tabac Info Service).', impact: 10 });
    if (p.stressLevel >= 4)
      actions.push({ id: 'stress', pillar: 'mind', title: 'Faire baisser ton stress', why: `Stress ${p.stressLevel}/5 : il dégrade sommeil, appétit, récupération et tension.`, how: '5 min de cohérence cardiaque 2×/jour, marche dehors, et parle à un professionnel si ça dure.', impact: 5, route: 'home' });
    const steps = days7.map((x) => x!.steps).filter((x): x is number => x !== undefined);
    const stepsAvg = avg(steps);
    if (stepsAvg !== undefined && stepsAvg < 7000)
      actions.push({ id: 'steps', pillar: 'mind', title: 'Marcher 8 000 pas par jour', why: `Moyenne de ${Math.round(stepsAvg).toLocaleString('fr-FR')} pas : la mortalité baisse fortement jusqu’à 8-10 000 pas.`, how: 'Appels en marchant, 10 min après chaque repas, escaliers.', impact: 7, route: 'home' });
  }

  // ——— Peau & apparence ———
  {
    const parts = ['spf', 'skincare_pm', 'floss'].map(habitRatio).filter((x): x is number => x !== undefined);
    const score = parts.length ? clamp100(avg(parts)! * 100) : undefined;
    pillars.push({ id: 'appearance', label: LABELS.appearance, score, detail: parts.length ? 'Crème solaire, routine du soir, dents (7 derniers jours)' : 'Coche tes routines peau dans les habitudes' });
    if ((habitRatio('spf') ?? 0) < 0.5)
      actions.push({ id: 'spf', pillar: 'appearance', title: 'Crème solaire SPF 50 tous les matins', why: 'Le soleil cause l’essentiel du vieillissement visible de la peau ; c’est le soin anti-âge le plus prouvé.', how: 'Un tube près de ta brosse à dents, appliqué chaque matin, même en hiver.', impact: 3, route: 'health#skin' });
  }

  const scored = pillars.filter((x) => x.score !== undefined);
  const wsum = scored.reduce((a, x) => a + WEIGHTS[x.id], 0);
  const global = scored.length >= 3 ? Math.round(scored.reduce((a, x) => a + x.score! * WEIGHTS[x.id], 0) / wsum) : undefined;
  const bio = bioAge(state.bloodPanels, p);
  const retest = nextBloodTest(state.bloodPanels, p, ms);
  return { pillars, global, actions: actions.sort((a, b) => b.impact - a.impact), bio, retest };
}
