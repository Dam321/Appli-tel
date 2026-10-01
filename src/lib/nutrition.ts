// Calcul des besoins : métabolisme de base, dépense, phase (sèche / recompo / prise
// de muscle), macros. Approche fondée sur les recommandations ISSN, Helms et al.,
// et un ajustement adaptatif hebdomadaire basé sur la tendance de poids réelle.
import type { BodySnapshot } from './bodyComp';
import type { Phase, Profile } from './types';
import { clamp, round } from './util';

export interface NutritionTargets {
  phase: Phase;
  phaseLabel: string;
  phaseReason: string;
  bmr: number;
  tdee: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  waterL: number;
  /** Variation de poids visée (kg/semaine, négatif = perte) */
  targetRateKg: number;
  targetRatePct: number;
  proteinPerMeal: number;
  adjustment: number;
}

export const PHASE_LABEL: Record<Phase, string> = {
  cut: 'Sèche (perte de gras)',
  recomp: 'Recomposition',
  lean_gain: 'Prise de muscle propre',
};

const ACTIVITY_PAL: Record<Profile['activityLevel'], number> = {
  sedentary: 1.2,
  light: 1.3,
  moderate: 1.4,
  active: 1.55,
  very_active: 1.7,
};

export function bmr(profile: Profile, snap: BodySnapshot): number {
  // Katch-McArdle si on connaît la masse maigre (balance), sinon Mifflin-St Jeor.
  if (snap.fatPctSource !== 'estimation') return 370 + 21.6 * snap.leanMassKg;
  const s = profile.sex === 'male' ? 5 : -161;
  return 10 * snap.weightKg + 6.25 * profile.heightCm - 5 * snap.age + s;
}

export function tdee(profile: Profile, snap: BodySnapshot): number {
  const pal = ACTIVITY_PAL[profile.activityLevel] + 0.03 * profile.trainingDays + 0.04;
  return bmr(profile, snap) * pal;
}

export function determinePhase(profile: Profile, snap: BodySnapshot): { phase: Phase; reason: string } {
  const bf = snap.fatPct;
  const male = profile.sex === 'male';
  const high = male ? 20 : 30;
  const low = male ? 13 : 22;
  if (profile.goal === 'fat_loss') return { phase: 'cut', reason: 'Objectif choisi : perte de gras.' };
  if (profile.goal === 'recomp') return { phase: 'recomp', reason: 'Objectif choisi : recomposition.' };
  if (profile.goal === 'muscle_gain') {
    if (bf > high + 3)
      return {
        phase: 'recomp',
        reason: `Tu vises le muscle, mais à ${round(bf, 0.1)} % de gras une prise de masse ajouterait surtout du gras : on fait d’abord une recomposition.`,
      };
    return { phase: 'lean_gain', reason: 'Objectif choisi : prise de muscle propre (surplus léger).' };
  }
  if (bf >= high)
    return { phase: 'cut', reason: `À ${round(bf, 0.1)} % de gras, la priorité santé & esthétique est de descendre sous ${high} % en gardant tout le muscle.` };
  if (bf <= low)
    return { phase: 'lean_gain', reason: `À ${round(bf, 0.1)} % de gras tu es assez sec : un léger surplus maximise la prise de muscle.` };
  if (profile.experience === 'beginner')
    return { phase: 'recomp', reason: 'Débutant avec un taux de gras intermédiaire : tu peux perdre du gras ET prendre du muscle en même temps.' };
  const mid = (high + low) / 2;
  return bf > mid
    ? { phase: 'cut', reason: `Taux de gras intermédiaire-haut (${round(bf, 0.1)} %) : une sèche courte te mettra dans la zone idéale avant de construire.` }
    : { phase: 'recomp', reason: `Taux de gras intermédiaire (${round(bf, 0.1)} %) : recomposition lente, haute en protéines.` };
}

function targetRatePct(profile: Profile, phase: Phase, bf: number): number {
  const male = profile.sex === 'male';
  if (phase === 'cut') {
    const veryHigh = male ? 25 : 35;
    const high = male ? 20 : 28;
    return bf >= veryHigh ? -1.0 : bf >= high ? -0.75 : -0.5;
  }
  if (phase === 'recomp') return -0.15;
  return profile.experience === 'beginner' ? 0.25 : profile.experience === 'intermediate' ? 0.15 : 0.1;
}

export function computeTargets(profile: Profile, snap: BodySnapshot, adjustment = 0): NutritionTargets {
  const { phase, reason } = determinePhase(profile, snap);
  const b = bmr(profile, snap);
  const t = tdee(profile, snap);
  const ratePct = targetRatePct(profile, phase, snap.fatPct);
  const rateKg = (ratePct / 100) * snap.weightKg;
  const energyPerKg = rateKg < 0 ? 7700 : 5500;
  let delta = (rateKg * energyPerKg) / 7;
  delta = clamp(delta, -0.25 * t, 0.15 * t);
  const floor = profile.sex === 'male' ? 1500 : 1250;
  const kcal = Math.max(floor, t + delta + adjustment);

  // Protéines : poids de référence plafonné pour les personnes en surpoids.
  const targetBf = profile.sex === 'male' ? 0.15 : 0.25;
  const refWeight = Math.min(snap.weightKg, snap.leanMassKg / (1 - targetBf));
  const perKg = phase === 'cut' ? 2.2 : phase === 'recomp' ? 2.0 : 1.8;
  let protein = refWeight * perKg * (profile.diet === 'vegan' ? 1.05 : 1);
  protein = Math.max(protein, snap.weightKg * 1.4);

  // Lipides type méditerranéen (huile d'olive, noix, poissons gras) : ~30 % des calories.
  let fat = Math.max(0.8 * snap.weightKg, (kcal * 0.3) / 9);
  let carbs = (kcal - protein * 4 - fat * 9) / 4;
  if (carbs < 80) {
    fat = Math.max(0.6 * snap.weightKg, fat - ((80 - carbs) * 4) / 9);
    carbs = (kcal - protein * 4 - fat * 9) / 4;
  }
  const fiber = Math.max(30, (kcal / 1000) * 14);
  const waterL = 0.035 * snap.weightKg + (profile.trainingDays / 7) * 0.6;
  return {
    phase,
    phaseLabel: PHASE_LABEL[phase],
    phaseReason: reason,
    bmr: round(b, 10),
    tdee: round(t, 10),
    kcal: round(kcal, 10),
    protein: round(protein, 5),
    fat: round(fat, 5),
    carbs: round(Math.max(0, carbs), 5),
    fiber: round(fiber, 1),
    waterL: round(waterL, 0.1),
    targetRateKg: round(rateKg, 0.01),
    targetRatePct: ratePct,
    proteinPerMeal: round(Math.max(0.4 * snap.weightKg, protein / profile.mealsPerDay), 5),
    adjustment,
  };
}

export interface CheckInResult {
  observedRateKg?: number;
  suggestion: number;
  message: string;
}

/**
 * Bilan hebdomadaire adaptatif : compare la vitesse réelle (tendance lissée) à la
 * vitesse visée et propose un ajustement calorique amorti (±200 kcal max).
 */
export function weeklyCheckIn(targets: NutritionTargets, observedRateKg: number | undefined, daysOfData: number): CheckInResult {
  if (observedRateKg === undefined || daysOfData < 10)
    return { suggestion: 0, message: 'Pas encore assez de pesées (il faut ~2 semaines de données régulières). Pèse-toi chaque matin à jeun après passage aux toilettes.' };
  const error = targets.targetRateKg - observedRateKg;
  if (Math.abs(error) < 0.1)
    return { observedRateKg, suggestion: 0, message: 'Parfait, tu es exactement sur la trajectoire visée. On ne change rien.' };
  const energy = targets.targetRateKg < 0 ? 7700 : 5500;
  const raw = ((error * energy) / 7) * 0.5;
  const suggestion = round(clamp(raw, -200, 200), 10);
  const dir = suggestion > 0 ? 'augmenter' : 'baisser';
  return {
    observedRateKg,
    suggestion,
    message: `Tu évolues de ${observedRateKg > 0 ? '+' : ''}${round(observedRateKg, 0.01)} kg/sem. pour une cible de ${targets.targetRateKg > 0 ? '+' : ''}${targets.targetRateKg} kg/sem. Je te propose de ${dir} de ${Math.abs(suggestion)} kcal/jour.`,
  };
}
