import { describe, expect, it } from 'vitest';
import { FOODS } from '../src/data/foods';
import { hasMicros } from '../src/data/micros';
import { bodySnapshot } from '../src/lib/bodyComp';
import { generateWeekPlan } from '../src/lib/mealPlanner';
import { microCoverage } from '../src/lib/micronutrients';
import { computeTargets } from '../src/lib/nutrition';
import { makeProfile } from './fixtures';

describe('micronutriments', () => {
  it('chaque aliment (hors épices/vinaigre) a des données', () => {
    const missing = FOODS.filter((f) => f.aisle !== 'epices' && f.id !== 'cider_vinegar' && !hasMicros(f.id)).map((f) => f.id);
    expect(missing).toEqual([]);
  });
  it('un menu omnivore couvre l’essentiel', () => {
    const p = makeProfile();
    const t = computeTargets(p, bodySnapshot(p, []));
    const cov = microCoverage(generateWeekPlan(p, t, { mealSeed: 42, mealWeekStart: '2026-09-28', mealOverrides: {} }), p);
    const by = Object.fromEntries(cov.map((c) => [c.key, c.pct]));
    console.log(JSON.stringify(cov.map((c) => `${c.key}:${c.pct}%`)));
    expect(by.vitC).toBeGreaterThan(100);
    expect(by.mg).toBeGreaterThan(80);
    expect(by.b12).toBeGreaterThan(80);
  });
  it('un menu vegan ne contient pas d’EPA/DHA', () => {
    const p = makeProfile({ diet: 'vegan' });
    const t = computeTargets(p, bodySnapshot(p, []));
    const cov = microCoverage(generateWeekPlan(p, t, { mealSeed: 42, mealWeekStart: '2026-09-28', mealOverrides: {} }), p);
    console.log('vegan', JSON.stringify(cov.map((c) => `${c.key}:${c.pct}%`)));
    expect(cov.find((c) => c.key === 'vitD')!.pct).toBeLessThan(60);
    expect(cov.find((c) => c.key === 'omega3')!.pct).toBe(0);
  });
});
