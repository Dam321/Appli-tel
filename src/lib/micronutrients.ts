// Couverture en vitamines & minéraux du menu de la semaine, comparée aux références
// nutritionnelles françaises (ANSES 2021 / EFSA) adaptées au sexe et à la situation.
import { MICRO_KEYS, microsOf, type MicroKey } from '../data/micros';
import type { WeekPlan } from './mealPlanner';
import type { Profile } from './types';

export const MICRO_INFO: Record<MicroKey, { label: string; unit: string; why: string }> = {
  ca: { label: 'Calcium', unit: 'mg', why: 'Os, contraction musculaire.' },
  fe: { label: 'Fer', unit: 'mg', why: 'Transport de l’oxygène, énergie.' },
  mg: { label: 'Magnésium', unit: 'mg', why: 'Muscles, sommeil, glycémie.' },
  k: { label: 'Potassium', unit: 'mg', why: 'Tension artérielle, contraction musculaire.' },
  zn: { label: 'Zinc', unit: 'mg', why: 'Immunité, testostérone, peau.' },
  vitC: { label: 'Vitamine C', unit: 'mg', why: 'Collagène (peau, tendons), absorption du fer.' },
  b9: { label: 'Folates (B9)', unit: 'µg', why: 'Renouvellement cellulaire, homocystéine.' },
  b12: { label: 'Vitamine B12', unit: 'µg', why: 'Nerfs, globules rouges.' },
  vitD: { label: 'Vitamine D', unit: 'µg', why: 'Os, immunité, muscles (surtout apportée par le soleil).' },
  omega3: { label: 'Oméga-3 EPA+DHA', unit: 'mg', why: 'Cœur, cerveau, inflammation.' },
  se: { label: 'Sélénium', unit: 'µg', why: 'Thyroïde, antioxydant.' },
};

export function microReferences(p: Pick<Profile, 'sex' | 'femaleStatus' | 'diet' | 'birthYear'>): Record<MicroKey, number> {
  const female = p.sex === 'female';
  const pregnant = p.femaleStatus === 'pregnant';
  const lactating = p.femaleStatus === 'breastfeeding';
  const menstruating = female && p.femaleStatus !== 'menopause' && !pregnant;
  const plant = p.diet === 'vegan' || p.diet === 'vegetarian';
  // Le fer et le zinc des végétaux sont moins bien absorbés.
  const fe = (menstruating ? 16 : 11) * (plant ? 1.5 : 1);
  return {
    ca: 950,
    fe: pregnant ? 16 * (plant ? 1.5 : 1) : fe,
    mg: female ? 360 : 420,
    k: 3500,
    zn: (female ? 9 : 11) * (plant ? 1.3 : 1),
    vitC: 110,
    b9: pregnant ? 600 : lactating ? 500 : 330,
    b12: pregnant ? 4.5 : lactating ? 5 : 4,
    vitD: 15,
    omega3: 500,
    se: 70,
  };
}

export interface MicroCoverage {
  key: MicroKey;
  label: string;
  unit: string;
  why: string;
  intake: number;
  reference: number;
  pct: number;
}

/** Apport quotidien moyen sur la semaine du menu */
export function weeklyMicros(week: WeekPlan): Record<MicroKey, number> {
  const tot = Object.fromEntries(MICRO_KEYS.map((k) => [k, 0])) as Record<MicroKey, number>;
  for (const d of week.days)
    for (const m of d.meals)
      for (const i of m.ingredients) {
        const v = microsOf(i.food, i.g);
        for (const k of MICRO_KEYS) tot[k] += v[k];
      }
  const n = Math.max(1, week.days.length);
  for (const k of MICRO_KEYS) tot[k] /= n;
  return tot;
}

export function microCoverage(week: WeekPlan, p: Pick<Profile, 'sex' | 'femaleStatus' | 'diet' | 'birthYear'>): MicroCoverage[] {
  const intake = weeklyMicros(week);
  const ref = microReferences(p);
  return MICRO_KEYS.map((k) => ({ key: k, ...MICRO_INFO[k], intake: intake[k], reference: ref[k], pct: Math.round((intake[k] / ref[k]) * 100) }));
}
