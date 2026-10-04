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
  /** Adaptations liées à la santé (affichées à l'utilisateur) */
  notes: string[];
}

export const PHASE_LABEL: Record<Phase, string> = {
  cut: 'Sèche (perte de gras)',
  recomp: 'Recomposition',
  lean_gain: 'Prise de muscle propre',
  maintain: 'Maintien santé',
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
  if (profile.femaleStatus === 'pregnant') return { phase: 'maintain', reason: 'Grossesse : jamais de déficit calorique, priorité à la qualité nutritionnelle et au suivi médical.' };
  if (profile.femaleStatus === 'breastfeeding') return { phase: 'maintain', reason: 'Allaitement : apport suffisant pour la production de lait ; une perte de poids lente viendra naturellement.' };
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
  if (phase === 'maintain') return 0;
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
  const notes: string[] = [];
  const floor = profile.sex === 'male' ? 1500 : 1250;
  let extra = 0;
  if (profile.femaleStatus === 'pregnant') {
    extra = 250;
    notes.push('Grossesse : +250 kcal en moyenne (≈ 0 au 1er trimestre, +350 à +450 ensuite), à valider avec ta sage-femme ou ton médecin.');
  } else if (profile.femaleStatus === 'breastfeeding') {
    extra = 400;
    notes.push('Allaitement : +400 kcal/jour environ.');
  }
  const kcal = Math.max(floor, t + delta + adjustment + extra);

  // Protéines : poids de référence plafonné pour les personnes en surpoids.
  const targetBf = profile.sex === 'male' ? 0.15 : 0.25;
  const refWeight = Math.min(snap.weightKg, snap.leanMassKg / (1 - targetBf));
  const perKg = phase === 'cut' ? 2.2 : phase === 'recomp' ? 2.0 : 1.8;
  let protein = refWeight * perKg * (profile.diet === 'vegan' ? 1.05 : 1);
  protein = Math.max(protein, snap.weightKg * 1.4);
  if (profile.conditions.includes('kidney')) {
    protein = Math.min(protein, snap.weightKg * 0.9);
    notes.push('Maladie rénale : protéines limitées à ~0,8-0,9 g/kg et créatine déconseillée. Ton néphrologue a le dernier mot.');
  }

  // Lipides type méditerranéen (huile d'olive, noix, poissons gras) : ~30 % des calories.
  let fat = Math.max(0.8 * snap.weightKg, (kcal * 0.3) / 9);
  const glycemic = profile.conditions.includes('diabetes') || profile.conditions.includes('prediabetes');
  if (glycemic) {
    // Glucides plafonnés à ~35 % des calories, le reste en bons lipides.
    const maxCarbs = (kcal * 0.35) / 4;
    const carbs0 = (kcal - protein * 4 - fat * 9) / 4;
    if (carbs0 > maxCarbs) fat += ((carbs0 - maxCarbs) * 4) / 9;
    notes.push('Glycémie : glucides limités à ~35 % des calories, surtout complets et riches en fibres, autour de l’entraînement. Marche de 10 min après les repas.');
  }
  let carbs = (kcal - protein * 4 - fat * 9) / 4;
  if (carbs < 80) {
    fat = Math.max(0.6 * snap.weightKg, fat - ((80 - carbs) * 4) / 9);
    carbs = (kcal - protein * 4 - fat * 9) / 4;
  }
  const fiber = Math.max(glycemic || profile.conditions.includes('high_cholesterol') ? 35 : 30, (kcal / 1000) * 14);
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
    proteinPerMeal: round(Math.min(protein / 2.5, Math.max(0.4 * snap.weightKg, protein / profile.mealsPerDay)), 5),
    adjustment,
    notes,
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
export interface CheckInContext {
  /** Part des repas cochés comme mangés sur 7 jours (0-1), si l'utilisateur les coche */
  mealAdherence?: number;
  /** Évolution de la masse maigre (kg/semaine, tendance balance) */
  leanRateKg?: number;
  /** Évolution du % de gras (points/semaine) */
  fatRatePts?: number;
}

export function weeklyCheckIn(targets: NutritionTargets, observedRateKg: number | undefined, daysOfData: number, ctx: CheckInContext = {}): CheckInResult {
  if (observedRateKg === undefined || daysOfData < 10)
    return { suggestion: 0, message: 'Pas encore assez de pesées (il faut ~2 semaines de données régulières). Pèse-toi chaque matin à jeun après passage aux toilettes.' };
  const rate = `${observedRateKg > 0 ? '+' : ''}${round(observedRateKg, 0.01)} kg/sem. (cible ${targets.targetRateKg > 0 ? '+' : ''}${targets.targetRateKg})`;
  // On ne touche pas aux calories si le plan n'a pas vraiment été suivi.
  if (ctx.mealAdherence !== undefined && ctx.mealAdherence < 0.7)
    return {
      observedRateKg,
      suggestion: 0,
      message: `Tu évolues de ${rate}, mais tu as coché ${Math.round(ctx.mealAdherence * 100)} % des repas du plan cette semaine. Avant de changer les calories, vise 80 % de repas suivis : c’est le levier n°1.`,
    };
  const error = targets.targetRateKg - observedRateKg;
  const energy = targets.targetRateKg < 0 ? 7700 : 5500;
  let suggestion = Math.abs(error) < 0.1 ? 0 : round(clamp(((error * energy) / 7) * 0.5, -200, 200), 10);
  const reasons: string[] = [];
  if (suggestion !== 0) reasons.push(`ton poids ${error > 0 ? 'baisse trop vite ou monte trop lentement' : 'ne baisse pas assez vite ou monte trop vite'}`);
  // Protection du muscle : plus de la moitié de la perte vient de la masse maigre (selon la balance)
  const leanShare = ctx.leanRateKg !== undefined && observedRateKg < 0 ? ctx.leanRateKg / observedRateKg : 0;
  if ((targets.phase === 'cut' || targets.phase === 'recomp') && ctx.leanRateKg !== undefined && ctx.leanRateKg < -0.2 && leanShare > 0.5) {
    suggestion = Math.max(suggestion, 100);
    reasons.push(`ta masse maigre baisse (${round(ctx.leanRateKg, 0.01)} kg/sem. selon la balance) : protéines à chaque repas et charges lourdes maintenues`);
  }
  // Prise de muscle trop « grasse »
  if (targets.phase === 'lean_gain' && ctx.fatRatePts !== undefined && ctx.fatRatePts > 0.15) {
    suggestion = Math.min(suggestion, -100);
    reasons.push(`ton % de gras monte trop vite (+${round(ctx.fatRatePts, 0.01)} pt/sem.)`);
  }
  const message =
    suggestion === 0
      ? `Tu évolues de ${rate} : c’est la trajectoire visée, on ne change rien.`
      : `Tu évolues de ${rate}. Je te propose de ${suggestion > 0 ? 'manger' : 'réduire de'} ${suggestion > 0 ? `${suggestion} kcal de plus` : `${Math.abs(suggestion)} kcal`} par jour, car ${reasons.join(', et ')}.`;
  return { observedRateKg, suggestion, message };
}
