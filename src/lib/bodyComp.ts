// Analyse de la composition corporelle à partir des pesées (Withings ou saisie).
import type { Measurement, Profile, Sex } from './types';
import { ageFromBirthYear, dayKey, daysBetween, parseDay, slope } from './util';

export type NumericField =
  | 'weightKg'
  | 'fatPct'
  | 'fatMassKg'
  | 'leanMassKg'
  | 'muscleMassKg'
  | 'boneMassKg'
  | 'hydrationKg'
  | 'visceralFat'
  | 'waistCm'
  | 'heartRate'
  | 'pwv'
  | 'vascularAge'
  | 'systolic'
  | 'diastolic'
  | 'vo2max'
  | 'restingHr'
  | 'neckCm'
  | 'hipCm'
  | 'chestCm'
  | 'shouldersCm'
  | 'armCm'
  | 'thighCm';

/** Complète les champs dérivables d'une mesure (masse grasse ↔ %). */
export function normalizeMeasurement(m: Measurement): Measurement {
  const out = { ...m };
  if (out.weightKg !== undefined) {
    if (out.fatPct === undefined && out.fatMassKg !== undefined) out.fatPct = (out.fatMassKg / out.weightKg) * 100;
    if (out.fatMassKg === undefined && out.fatPct !== undefined) out.fatMassKg = (out.fatPct / 100) * out.weightKg;
    if (out.leanMassKg === undefined && out.fatMassKg !== undefined) out.leanMassKg = out.weightKg - out.fatMassKg;
  }
  return out;
}

export function sortedMeasurements(ms: Measurement[]): Measurement[] {
  return ms.slice().sort((a, b) => a.date.localeCompare(b.date));
}

/** Dernière valeur connue de chaque champ */
export function latestValues(ms: Measurement[]): Partial<Record<NumericField, { value: number; date: string }>> {
  const out: Partial<Record<NumericField, { value: number; date: string }>> = {};
  for (const m of sortedMeasurements(ms)) {
    for (const [k, v] of Object.entries(m)) {
      if (typeof v === 'number' && k !== 'id') out[k as NumericField] = { value: v, date: m.date };
    }
  }
  return out;
}

export interface TrendPoint {
  day: string;
  raw?: number;
  trend: number;
}

/**
 * Tendance lissée façon « moyenne mobile exponentielle » (méthode Hacker's Diet /
 * MacroFactor) : neutralise les variations d'eau quotidiennes.
 * Une valeur par jour (moyenne si plusieurs pesées), jours manquants interpolés.
 */
export function trendSeries(ms: Measurement[], field: NumericField, alpha = 0.1): TrendPoint[] {
  const byDay = new Map<string, number[]>();
  for (const m of ms) {
    const v = m[field];
    if (typeof v !== 'number' || Number.isNaN(v)) continue;
    const d = dayKey(m.date);
    byDay.set(d, [...(byDay.get(d) ?? []), v]);
  }
  const days = [...byDay.keys()].sort();
  if (!days.length) return [];
  const out: TrendPoint[] = [];
  let trend = avg(byDay.get(days[0])!);
  let prevDay = days[0];
  let prevRaw = trend;
  out.push({ day: days[0], raw: trend, trend });
  for (let i = 1; i < days.length; i++) {
    const d = days[i];
    const raw = avg(byDay.get(d)!);
    const gap = daysBetween(prevDay, d);
    // Jours sans pesée : on avance la tendance vers une interpolation linéaire.
    for (let g = 1; g < gap; g++) {
      const interp = prevRaw + ((raw - prevRaw) * g) / gap;
      trend = trend + alpha * (interp - trend);
    }
    trend = trend + alpha * (raw - trend);
    out.push({ day: d, raw, trend });
    prevDay = d;
    prevRaw = raw;
  }
  return out;
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Vitesse d'évolution (unité/semaine) sur les `windowDays` derniers jours de la tendance */
export function weeklyRate(series: TrendPoint[], windowDays = 21): number | undefined {
  if (series.length < 4) return undefined;
  const last = series[series.length - 1].day;
  const pts = series.filter((p) => daysBetween(p.day, last) <= windowDays);
  if (pts.length < 4) return undefined;
  const span = daysBetween(pts[0].day, last);
  if (span < 7) return undefined;
  const xs = pts.map((p) => daysBetween(pts[0].day, p.day));
  const ys = pts.map((p) => p.trend);
  return slope(xs, ys) * 7;
}

export function currentWeight(profile: Profile, ms: Measurement[]): number {
  const s = trendSeries(ms, 'weightKg');
  return s.length ? s[s.length - 1].trend : profile.weightKg;
}

/** Estimation du % de masse grasse (Deurenberg) quand aucune mesure n'est disponible */
export function estimateBodyFat(sex: Sex, age: number, weightKg: number, heightCm: number): number {
  const bmi = weightKg / (heightCm / 100) ** 2;
  return 1.2 * bmi + 0.23 * age - 10.8 * (sex === 'male' ? 1 : 0) - 5.4;
}

export interface BodySnapshot {
  weightKg: number;
  fatPct: number;
  fatPctSource: 'mesure' | 'profil' | 'estimation';
  leanMassKg: number;
  fatMassKg: number;
  bmi: number;
  ffmi: number;
  waistToHeight?: number;
  weeklyRateKg?: number;
  weeklyRatePct?: number;
  age: number;
}

export function bodySnapshot(profile: Profile, ms: Measurement[]): BodySnapshot {
  const age = ageFromBirthYear(profile.birthYear);
  const weightKg = currentWeight(profile, ms);
  const fatSeries = trendSeries(ms, 'fatPct', 0.15);
  let fatPct: number;
  let fatPctSource: BodySnapshot['fatPctSource'];
  if (fatSeries.length) {
    fatPct = fatSeries[fatSeries.length - 1].trend;
    fatPctSource = 'mesure';
  } else if (profile.bodyFatPct) {
    fatPct = profile.bodyFatPct;
    fatPctSource = 'profil';
  } else {
    fatPct = estimateBodyFat(profile.sex, age, weightKg, profile.heightCm);
    fatPctSource = 'estimation';
  }
  const fatMassKg = (weightKg * fatPct) / 100;
  const leanMassKg = weightKg - fatMassKg;
  const h = profile.heightCm / 100;
  const bmi = weightKg / h ** 2;
  // FFMI normalisé (Kouri 1995)
  const ffmi = leanMassKg / h ** 2 + 6.1 * (1.8 - h);
  const waist = latestValues(ms).waistCm?.value ?? profile.waistCm;
  const rate = weeklyRate(trendSeries(ms, 'weightKg'));
  return {
    weightKg,
    fatPct,
    fatPctSource,
    leanMassKg,
    fatMassKg,
    bmi,
    ffmi,
    waistToHeight: waist ? waist / profile.heightCm : undefined,
    weeklyRateKg: rate,
    weeklyRatePct: rate !== undefined ? (rate / weightKg) * 100 : undefined,
    age,
  };
}

export interface FatCategory {
  label: string;
  tone: 'good' | 'warning' | 'serious' | 'critical' | 'neutral';
}

export function fatCategory(sex: Sex, pct: number): FatCategory {
  const t = sex === 'male' ? [6, 10, 15, 20, 25] : [14, 18, 23, 28, 33];
  if (pct < t[0]) return { label: 'Très sec (attention santé)', tone: 'warning' };
  if (pct < t[1]) return { label: 'Athlétique', tone: 'good' };
  if (pct < t[2]) return { label: 'Fit', tone: 'good' };
  if (pct < t[3]) return { label: 'Correct', tone: 'neutral' };
  if (pct < t[4]) return { label: 'Au-dessus de la cible', tone: 'warning' };
  return { label: 'Élevé', tone: 'serious' };
}

export function ffmiCategory(sex: Sex, ffmi: number): string {
  const t = sex === 'male' ? [18, 20, 22, 23.5, 25] : [14.5, 16, 17.5, 19, 20.5];
  if (ffmi < t[0]) return 'Peu musclé';
  if (ffmi < t[1]) return 'Moyen';
  if (ffmi < t[2]) return 'Musclé';
  if (ffmi < t[3]) return 'Très musclé';
  if (ffmi < t[4]) return 'Excellent (proche du plafond naturel)';
  return 'Exceptionnel';
}

/** Cible esthétique & santé de % de gras selon le sexe */
export function targetFatRange(sex: Sex): [number, number] {
  return sex === 'male' ? [10, 15] : [18, 24];
}

export function daysSinceLastWeighIn(ms: Measurement[]): number | undefined {
  const withWeight = ms.filter((m) => m.weightKg !== undefined);
  if (!withWeight.length) return undefined;
  const last = sortedMeasurements(withWeight).at(-1)!;
  return Math.floor((Date.now() - parseDay(dayKey(last.date)).getTime()) / 86_400_000);
}

/** % de gras par la méthode US Navy (mètre ruban) : recoupe la bio-impédance de la balance */
export function navyBodyFat(sex: Sex, heightCm: number, neckCm?: number, waistCm?: number, hipCm?: number): number | undefined {
  if (!neckCm || !waistCm) return undefined;
  if (sex === 'male') {
    if (waistCm <= neckCm) return undefined;
    return 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
  }
  if (!hipCm || waistCm + hipCm <= neckCm) return undefined;
  return 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450;
}

export type Tone = 'good' | 'warning' | 'serious' | 'critical' | 'neutral';

/** Catégories de tension (ESH/ESC) */
export function bpCategory(sys: number, dia: number): { label: string; tone: Tone } {
  if (sys >= 140 || dia >= 90) return { label: 'Hypertension : à montrer à ton médecin', tone: 'critical' };
  if (sys >= 130 || dia >= 85) return { label: 'Normale haute', tone: 'warning' };
  if (sys >= 120 || dia >= 80) return { label: 'Normale', tone: 'neutral' };
  return { label: 'Optimale', tone: 'good' };
}

export function restingHrCategory(hr: number): { label: string; tone: Tone } {
  if (hr < 55) return { label: 'Excellente (cœur entraîné)', tone: 'good' };
  if (hr < 65) return { label: 'Bonne', tone: 'good' };
  if (hr < 75) return { label: 'Moyenne', tone: 'neutral' };
  if (hr < 85) return { label: 'Élevée : plus de zone 2', tone: 'warning' };
  return { label: 'Très élevée : à surveiller', tone: 'serious' };
}

export interface Proportions {
  waistToHip?: { value: number; ok: boolean; target: string };
  shoulderToWaist?: { value: number; ok: boolean; target: string };
  navyFatPct?: number;
}

export function proportions(sex: Sex, heightCm: number, ms: Measurement[]): Proportions {
  const l = latestValues(ms);
  const waist = l.waistCm?.value;
  const hip = l.hipCm?.value;
  const shoulders = l.shouldersCm?.value;
  const out: Proportions = {};
  if (waist && hip) {
    const v = waist / hip;
    const lim = sex === 'male' ? 0.9 : 0.85;
    out.waistToHip = { value: v, ok: v < lim, target: `< ${lim.toLocaleString('fr-FR')}` };
  }
  if (waist && shoulders) {
    // Indice « Adonis » : idéal esthétique ~1,6 chez l'homme, ~1,4 chez la femme
    const v = shoulders / waist;
    const ideal = sex === 'male' ? 1.6 : 1.4;
    out.shoulderToWaist = { value: v, ok: v >= ideal - 0.05, target: `≈ ${ideal.toLocaleString('fr-FR')}` };
  }
  out.navyFatPct = navyBodyFat(sex, heightCm, l.neckCm?.value, waist, hip);
  return out;
}
