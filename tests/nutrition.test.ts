import { describe, expect, it } from 'vitest';
import { bodySnapshot, trendSeries, weeklyRate } from '../src/lib/bodyComp';
import { computeTargets, weeklyCheckIn } from '../src/lib/nutrition';
import { generateWeekPlan, resolveRecipe } from '../src/lib/mealPlanner';
import { buildShoppingList, groupByAisle } from '../src/lib/shopping';
import { RECIPES } from '../src/data/recipes';
import { food } from '../src/data/foods';
import type { Measurement } from '../src/lib/types';
import { makeProfile } from './fixtures';

const plan = { mealSeed: 42, mealWeekStart: '2026-09-28', mealOverrides: {} };

describe('composition corporelle', () => {
  it('lisse la tendance de poids et calcule une vitesse', () => {
    const ms: Measurement[] = Array.from({ length: 28 }, (_, i) => ({
      id: String(i),
      date: `2026-09-${String(i + 1).padStart(2, '0')}T07:00`,
      source: 'manual',
      weightKg: 85 - i * 0.07 + (i % 3 === 0 ? 0.6 : -0.2),
    }));
    const s = trendSeries(ms, 'weightKg');
    expect(s).toHaveLength(28);
    const rate = weeklyRate(s)!;
    expect(rate).toBeLessThan(-0.2);
    expect(rate).toBeGreaterThan(-0.8);
  });
});

describe('cibles nutritionnelles', () => {
  it('met un homme à 20 % en sèche avec protéines élevées', () => {
    const p = makeProfile();
    const snap = bodySnapshot(p, []);
    const t = computeTargets(p, snap);
    expect(t.phase).toBe('cut');
    expect(t.kcal).toBeLessThan(t.tdee);
    expect(t.protein).toBeGreaterThanOrEqual(160);
    expect(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal)).toBeLessThan(40);
  });
  it('met un homme sec en prise de muscle', () => {
    const p = makeProfile({ bodyFatPct: 11, weightKg: 75 });
    const t = computeTargets(p, bodySnapshot(p, []));
    expect(t.phase).toBe('lean_gain');
    expect(t.kcal).toBeGreaterThan(t.tdee);
  });
  it('propose un ajustement amorti au bilan hebdo', () => {
    const p = makeProfile();
    const t = computeTargets(p, bodySnapshot(p, []));
    const r = weeklyCheckIn(t, 0, 21);
    expect(r.suggestion).toBeLessThan(0);
    expect(r.suggestion).toBeGreaterThanOrEqual(-200);
  });
});

describe('menu de la semaine', () => {
  for (const diet of ['omnivore', 'pescatarian', 'vegetarian', 'vegan'] as const) {
    it(`génère 7 jours proches des cibles (${diet})`, () => {
      const p = makeProfile({ diet });
      const t = computeTargets(p, bodySnapshot(p, []));
      const w = generateWeekPlan(p, t, plan);
      expect(w.days).toHaveLength(7);
      for (const d of w.days) {
        expect(d.meals).toHaveLength(4);
        expect(Math.abs(d.totals.kcal - t.kcal) / t.kcal).toBeLessThan(0.15);
        expect(d.totals.p).toBeGreaterThan(t.protein * 0.85);
        for (const m of d.meals)
          for (const ing of m.ingredients) {
            const f = food(ing.food);
            if (diet === 'vegan') expect(f.animal).toBeUndefined();
            if (diet === 'vegetarian') expect(['meat', 'red_meat', 'fish', 'fatty_fish', 'shellfish']).not.toContain(f.animal);
          }
      }
      if (diet === 'omnivore' || diet === 'pescatarian') expect(w.fattyFishMeals).toBeGreaterThanOrEqual(2);
      expect(w.plantCount).toBeGreaterThanOrEqual(15);
    });
  }
  it('respecte les allergies', () => {
    const p = makeProfile({ allergens: ['lactose', 'gluten', 'nuts'] });
    const t = computeTargets(p, bodySnapshot(p, []));
    const w = generateWeekPlan(p, t, plan);
    for (const d of w.days) for (const m of d.meals) for (const ing of m.ingredients) {
      const a = food(ing.food).allergens ?? [];
      expect(a.filter((x) => ['lactose', 'gluten', 'nuts'].includes(x))).toEqual([]);
    }
  });
  it('toutes les recettes sont résolubles en omnivore', () => {
    const p = makeProfile();
    for (const r of RECIPES) expect(resolveRecipe(r, p)).not.toBeNull();
  });
  it('construit une liste de courses groupée par rayon', () => {
    const p = makeProfile();
    const t = computeTargets(p, bodySnapshot(p, []));
    const items = buildShoppingList(generateWeekPlan(p, t, plan));
    expect(items.length).toBeGreaterThan(20);
    const sections = groupByAisle(items);
    expect(sections[0].title).toBe('Fruits & légumes');
  });
});
