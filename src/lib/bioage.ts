// Âge biologique « PhenoAge » (Levine et al., Aging 2018) : estimé à partir de 9
// analyses sanguines courantes + l'âge. Validé sur la mortalité dans les cohortes
// NHANES. C'est une estimation statistique, pas un diagnostic.
import type { BloodPanel, Measurement, Profile } from './types';
import { MARKER_BY_ID, markerStatus } from './blood';
import { addDays, ageFromBirthYear, todayISO } from './util';

export const PHENO_MARKERS = ['albumin', 'creatinine', 'glucose', 'crp', 'lymph_pct', 'mcv', 'rdw', 'alp', 'wbc'] as const;

/**
 * Valeurs en unités canoniques de l'app : albumine g/L, créatinine µmol/L,
 * glycémie mg/dL, CRP mg/L, lymphocytes %, VGM fL, IDR %, PAL UI/L, leucocytes G/L.
 */
export function phenoAge(v: Record<string, number>, age: number): number | undefined {
  if (PHENO_MARKERS.some((k) => v[k] === undefined)) return undefined;
  const glucoseMmol = v.glucose / 18.016;
  const crpMgDl = Math.max(v.crp, 0.1) / 10;
  const xb =
    -19.907 -
    0.0336 * v.albumin +
    0.0095 * v.creatinine +
    0.1953 * glucoseMmol +
    0.0954 * Math.log(crpMgDl) -
    0.012 * v.lymph_pct +
    0.0268 * v.mcv +
    0.3306 * v.rdw +
    0.00188 * v.alp +
    0.0554 * v.wbc +
    0.0804 * age;
  const gamma = 0.0076927;
  const mortality = 1 - Math.exp((-Math.exp(xb) * (Math.exp(120 * gamma) - 1)) / gamma);
  if (mortality <= 0 || mortality >= 1) return undefined;
  return 141.50225 + Math.log(-0.00553 * Math.log(1 - mortality)) / 0.090165;
}

export interface BioAgeResult {
  phenoAge?: number;
  chronoAge: number;
  delta?: number;
  missing: string[];
  date?: string;
}

/** Âge biologique à partir des valeurs les plus récentes (même prise de sang de préférence). */
export function bioAge(panels: BloodPanel[], profile: Profile): BioAgeResult {
  const chronoAge = ageFromBirthYear(profile.birthYear);
  const sorted = panels.slice().sort((a, b) => b.date.localeCompare(a.date));
  const complete = sorted.find((p) => PHENO_MARKERS.every((k) => p.values[k] !== undefined));
  if (!complete) {
    const latest: Record<string, number> = {};
    for (const p of sorted.slice().reverse()) Object.assign(latest, p.values);
    return { chronoAge, missing: PHENO_MARKERS.filter((k) => latest[k] === undefined).map((k) => MARKER_BY_ID[k]?.name ?? k) };
  }
  const ageAt = chronoAge - (new Date().getFullYear() - Number(complete.date.slice(0, 4)));
  const pa = phenoAge(complete.values, ageAt);
  return { chronoAge: ageAt, phenoAge: pa, delta: pa !== undefined ? pa - ageAt : undefined, missing: [], date: complete.date };
}

/** Marqueurs à recontrôler tôt (3 mois) quand ils sont hors zone optimale : ils se corrigent vite. */
const FAST_MARKERS = ['vitd', 'ferritin', 'b12', 'folate', 'omega3_index', 'magnesium', 'zinc', 'homocysteine', 'crp', 'triglycerides'];
const SLOW_MARKERS = ['hba1c', 'apob', 'ldl', 'alt', 'ggt', 'testosterone', 'insulin', 'glucose'];

export interface RetestPlan {
  date: string;
  reason: string;
  markers: string[];
}

export function nextBloodTest(panels: BloodPanel[], profile: Profile, _ms: Measurement[] = []): RetestPlan {
  if (!panels.length) return { date: todayISO(), reason: 'Bilan de départ : indispensable pour personnaliser compléments et objectifs.', markers: [] };
  const last = panels.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  const off = (ids: string[]) =>
    ids.filter((id) => {
      const m = MARKER_BY_ID[id];
      const v = last.values[id];
      return m && v !== undefined && markerStatus(m, profile.sex, v) !== 'optimal';
    });
  const fast = off(FAST_MARKERS);
  const slow = off(SLOW_MARKERS);
  const name = (id: string) => MARKER_BY_ID[id]?.short ?? id;
  if (fast.length)
    return { date: addDays(last.date, 90), reason: 'Contrôle à 3 mois des valeurs que tu es en train de corriger.', markers: [...fast, ...slow].map(name) };
  if (slow.length) return { date: addDays(last.date, 180), reason: 'Contrôle à 6 mois des marqueurs métaboliques à optimiser.', markers: slow.map(name) };
  const age = ageFromBirthYear(profile.birthYear);
  return { date: addDays(last.date, age >= 50 ? 180 : 365), reason: 'Tout est dans la zone optimale : bilan de suivi complet.', markers: [] };
}
