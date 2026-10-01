// Génération du menu de la semaine : choix des recettes (variété, poissons gras,
// légumineuses, limites viande rouge), adaptation au régime/allergies, puis
// ajustement automatique des portions pour coller aux macros du jour.
import { FOOD_BY_ID, food, isFoodAllowed, shortName, type Food } from '../data/foods';
import { RECIPES, RECIPE_BY_ID, type Ingredient, type Recipe, type Role, type Slot } from '../data/recipes';
import type { NutritionTargets } from './nutrition';
import type { PlanState, Profile } from './types';
import { addDays, clamp, rng, shuffle } from './util';

export interface Macros {
  kcal: number;
  p: number;
  c: number;
  f: number;
  fib: number;
}

export type MealSlotKey = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'snack2';

export const SLOT_LABEL: Record<MealSlotKey, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
  snack2: 'Collation du matin',
};

export interface PlannedIngredient {
  food: string;
  g: number;
  label: string;
  qty: string;
}

export interface PlannedMeal {
  slot: MealSlotKey;
  recipeId: string;
  name: string;
  minutes: number;
  ingredients: PlannedIngredient[];
  macros: Macros;
  steps: string[];
  tip?: string;
  substitutions: string[];
  leftover?: boolean;
  cookDouble?: boolean;
}

export interface PlannedDay {
  index: number;
  date: string;
  meals: PlannedMeal[];
  totals: Macros;
}

export interface WeekPlan {
  weekStart: string;
  days: PlannedDay[];
  plantCount: number;
  plants: string[];
  fattyFishMeals: number;
  legumeMeals: number;
  fermentedDays: number;
  avgFiber: number;
}

interface ResolvedRecipe {
  recipe: Recipe;
  name: string;
  ingredients: Ingredient[];
  substitutions: string[];
}

const ZERO: Macros = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };

export function macrosOf(foodId: string, g: number): Macros {
  const f = food(foodId);
  const k = g / 100;
  return { kcal: f.kcal * k, p: f.p * k, c: f.c * k, f: f.f * k, fib: f.fib * k };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return { kcal: a.kcal + b.kcal, p: a.p + b.p, c: a.c + b.c, f: a.f + b.f, fib: a.fib + b.fib };
}

function ingredientsMacros(ings: { food: string; g: number }[]): Macros {
  return ings.reduce((acc, x) => addMacros(acc, macrosOf(x.food, x.g)), ZERO);
}

function allowed(f: Food, profile: Profile): boolean {
  return isFoodAllowed(f, profile.diet, profile.allergens, profile.dislikedFoods);
}

/** Remplace les `{foodId}` du titre par le nom court de l'aliment retenu. */
export function recipeTitle(template: string, mapping: Record<string, string | null> = {}): string {
  let s = template.replace(/\{(\w+)\}/g, (_, id: string) => {
    const target = id in mapping ? mapping[id] : id;
    return target ? shortName(target) : '';
  });
  s = s
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/(,|&)\s*$/g, '')
    .replace(/,\s*&/g, ' &')
    .replace(/\b(de|aux|&)\s*(,|&|$)/g, '$2')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Adapte une recette au profil (substitutions) ; null si impossible. */
export function resolveRecipe(recipe: Recipe, profile: Profile): ResolvedRecipe | null {
  const out: Ingredient[] = [];
  const substitutions: string[] = [];
  const mapping: Record<string, string | null> = {};
  for (const ing of recipe.ingredients) {
    const f = food(ing.food);
    if (allowed(f, profile)) {
      out.push(ing);
      continue;
    }
    if (ing.strict) return null;
    const alt = (f.alternatives ?? []).map((id) => FOOD_BY_ID[id]).find((a) => a && allowed(a, profile));
    if (alt) {
      // Équivalence protéique pour les sources de protéines, sinon même poids.
      let g = ing.g;
      if (ing.role === 'protein' && alt.p > 0) g = (ing.g * f.p) / alt.p;
      out.push({ food: alt.id, g: Math.round(g), role: ing.role });
      mapping[ing.food] = alt.id;
      substitutions.push(`${alt.name} au lieu de ${f.name.toLowerCase()}`);
    } else if (ing.role === 'protein' && !recipe.ingredients.some((o) => o !== ing && o.role === 'protein' && allowed(food(o.food), profile))) {
      return null;
    } else {
      mapping[ing.food] = null;
    }
  }
  // Fusionner les doublons éventuels
  const merged = new Map<string, Ingredient>();
  for (const ing of out) {
    const prev = merged.get(ing.food);
    merged.set(ing.food, prev ? { ...prev, g: prev.g + ing.g } : { ...ing });
  }
  return { recipe, name: recipeTitle(recipe.name, mapping), ingredients: [...merged.values()], substitutions };
}

function isFattyFish(r: ResolvedRecipe) {
  return r.ingredients.some((i) => food(i.food).animal === 'fatty_fish');
}
function isLegume(r: ResolvedRecipe) {
  return r.ingredients.some((i) => food(i.food).tags?.includes('legumineuse') && i.g >= 60);
}
function hasRedMeat(r: ResolvedRecipe) {
  return r.ingredients.some((i) => food(i.food).animal === 'red_meat');
}

export function slotsFor(mealsPerDay: number): { key: MealSlotKey; share: number; type: Slot }[] {
  if (mealsPerDay === 3)
    return [
      { key: 'breakfast', share: 0.3, type: 'breakfast' },
      { key: 'lunch', share: 0.35, type: 'main' },
      { key: 'dinner', share: 0.35, type: 'main' },
    ];
  if (mealsPerDay === 5)
    return [
      { key: 'breakfast', share: 0.22, type: 'breakfast' },
      { key: 'snack2', share: 0.11, type: 'snack' },
      { key: 'lunch', share: 0.28, type: 'main' },
      { key: 'snack', share: 0.11, type: 'snack' },
      { key: 'dinner', share: 0.28, type: 'main' },
    ];
  return [
    { key: 'breakfast', share: 0.25, type: 'breakfast' },
    { key: 'lunch', share: 0.3, type: 'main' },
    { key: 'snack', share: 0.15, type: 'snack' },
    { key: 'dinner', share: 0.3, type: 'main' },
  ];
}

export function eligibleRecipes(profile: Profile, slot: Slot): ResolvedRecipe[] {
  return RECIPES.filter((r) => r.slots.includes(slot))
    .map((r) => resolveRecipe(r, profile))
    .filter((r): r is ResolvedRecipe => r !== null);
}

/** Choisit les plats principaux de la semaine en respectant les règles « longévité ». */
function pickMains(candidates: ResolvedRecipe[], count: number, rand: () => number, canFish: boolean): ResolvedRecipe[] {
  const chosen: ResolvedRecipe[] = [];
  const uses = new Map<string, number>();
  let fish = 0;
  let legumes = 0;
  let red = 0;
  for (let k = 0; k < count; k++) {
    const remaining = count - k;
    let best: ResolvedRecipe | undefined;
    let bestScore = -Infinity;
    for (const c of candidates) {
      const used = uses.get(c.recipe.id) ?? 0;
      if (c.recipe.maxPerWeek !== undefined && used >= c.recipe.maxPerWeek) continue;
      if (used >= 2) continue;
      if (chosen.length && chosen[chosen.length - 1].recipe.id === c.recipe.id) continue;
      if (hasRedMeat(c) && red >= 2) continue;
      let score = rand() - used * 1.5;
      if (canFish && isFattyFish(c) && fish < 2) score += 2 - fish < remaining ? 0.8 : 3;
      if (isLegume(c) && legumes < 3) score += 0.6;
      if (hasRedMeat(c)) score -= 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best) best = candidates[Math.floor(rand() * candidates.length)];
    chosen.push(best);
    uses.set(best.recipe.id, (uses.get(best.recipe.id) ?? 0) + 1);
    if (isFattyFish(best)) fish++;
    if (isLegume(best)) legumes++;
    if (hasRedMeat(best)) red++;
  }
  return chosen;
}

interface DraftMeal {
  slot: MealSlotKey;
  resolved: ResolvedRecipe;
  scale: number;
  leftover?: boolean;
  cookDouble?: boolean;
}

/** Résout un système 3×3 (élimination de Gauss avec pivot partiel). */
function solve3(A: number[][], b: number[]): number[] | null {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-9) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const fct = M[r][col] / M[col][col];
      for (let c = col; c < 4; c++) M[r][c] -= fct * M[col][c];
    }
  }
  return [0, 1, 2].map((i) => M[i][3] / M[i][i]);
}

const ROLE_INDEX: Partial<Record<Role, number>> = { protein: 0, carb: 1, fat: 2 };

const BOUNDS: [number, number][] = [
  [0.35, 3],
  [0.25, 3],
  [0.1, 3],
];

/**
 * Trouve les multiplicateurs (sources de protéines, de glucides, de lipides) qui
 * rapprochent la journée des cibles. Moindres carrés pondérés en écart relatif
 * (protéines, glucides, lipides et calories totales) + légère régularisation vers 1.
 * Les bornes sont gérées par un ensemble actif : un multiplicateur borné est figé
 * et les autres sont recalculés.
 */
export function solveMultipliers(groups: Macros[], other: Macros, t: { p: number; c: number; f: number }): number[] {
  const kcalT = t.p * 4 + t.c * 4 + t.f * 9;
  const rows = [
    { coef: groups.map((g) => g.p), target: t.p - other.p, w: 1.6 / t.p },
    { coef: groups.map((g) => g.c), target: t.c - other.c, w: 0.8 / Math.max(t.c, 1) },
    { coef: groups.map((g) => g.f), target: t.f - other.f, w: 1.2 / t.f },
    { coef: groups.map((g) => g.kcal), target: kcalT - other.kcal, w: 2.2 / kcalT },
  ];
  const lambda = 0.01;
  const fixed: (number | null)[] = [null, null, null];
  let m = [1, 1, 1];
  for (let iter = 0; iter < 4; iter++) {
    const free = [0, 1, 2].filter((k) => fixed[k] === null);
    const AtA: number[][] = [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0)));
    const Atb: number[] = [0, 1, 2].map((i) => fixed[i] ?? 0);
    for (const i of free) {
      AtA[i][i] = lambda;
      Atb[i] = lambda;
      for (const j of free) AtA[i][j] = (i === j ? lambda : 0);
    }
    for (const r of rows) {
      const fixedPart = [0, 1, 2].reduce((s, k) => s + (fixed[k] !== null ? r.coef[k] * fixed[k]! : 0), 0);
      const target = r.target - fixedPart;
      for (const i of free) {
        for (const j of free) AtA[i][j] += r.w ** 2 * r.coef[i] * r.coef[j];
        Atb[i] += r.w ** 2 * r.coef[i] * target;
      }
    }
    m = solve3(AtA, Atb) ?? [1, 1, 1];
    let changed = false;
    for (const k of free) {
      const [lo, hi] = BOUNDS[k];
      if (!Number.isFinite(m[k])) m[k] = 1;
      if (m[k] < lo || m[k] > hi) {
        fixed[k] = clamp(m[k], lo, hi);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return m.map((x, k) => fixed[k] ?? clamp(x, BOUNDS[k][0], BOUNDS[k][1]));
}

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾', '0.33': '⅓' };

function fractionLabel(n: number): string {
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 100) / 100;
  const fs = FRACTIONS[String(frac)] ?? (frac ? String(frac) : '');
  if (!whole) return fs || '0';
  return `${whole}${fs ? ' ' + fs : ''}`;
}

/** Arrondit une quantité de manière « cuisinable » et produit le libellé. */
export function roundQuantity(foodId: string, g: number): { g: number; qty: string } {
  const f = food(foodId);
  if (f.unit) {
    const step = foodId === 'eggs' ? 1 : foodId === 'brazil_nuts' ? 1 : 0.25;
    let units = Math.round(g / f.unit.grams / step) * step;
    units = Math.max(step, units);
    const name = units > 1 ? f.unit.plural : f.unit.name;
    return { g: units * f.unit.grams, qty: `${fractionLabel(units)} ${name}` };
  }
  if (f.aisle === 'epices') return { g, qty: g >= 3 ? '1 c. à café' : '½ c. à café' };
  if (['milk', 'soy_milk', 'kefir'].includes(foodId)) {
    const ml = Math.max(50, Math.round(g / 25) * 25);
    return { g: ml, qty: `${ml} ml` };
  }
  if (foodId === 'olive_oil') {
    const gg = Math.max(5, Math.round(g / 5) * 5);
    const cs = gg / 10;
    return { g: gg, qty: `${gg} g (${cs >= 1 ? fractionLabel(Math.round(cs * 2) / 2) + ' c. à soupe' : '1 c. à café'})` };
  }
  const step = g >= 40 ? 5 : g >= 10 ? 5 : 1;
  const gg = Math.max(step, Math.round(g / step) * step);
  return { g: gg, qty: `${gg} g` };
}

export function generateWeekPlan(profile: Profile, targets: NutritionTargets, plan: Pick<PlanState, 'mealSeed' | 'mealWeekStart' | 'mealOverrides'>): WeekPlan {
  const rand = rng(plan.mealSeed);
  const slots = slotsFor(profile.mealsPerDay);
  const canFish = !['vegetarian', 'vegan'].includes(profile.diet) && !profile.allergens.includes('fish');

  // Priorité aux options denses en protéines, avec une part d'aléatoire pour varier.
  const byProteinDensity = (list: ResolvedRecipe[]) =>
    shuffle(list, rand)
      .map((r) => {
        const m = ingredientsMacros(r.ingredients);
        return { r, score: (m.p * 4) / Math.max(m.kcal, 1) + rand() * 0.2 };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.r);
  const breakfasts = byProteinDensity(eligibleRecipes(profile, 'breakfast'));
  const snacks = byProteinDensity(eligibleRecipes(profile, 'snack'));
  const mains = eligibleRecipes(profile, 'main');
  const batch = profile.batchCooking;
  const mainCount = batch ? 8 : 14;
  const mainPicks = pickMains(mains, mainCount, rand, canFish);
  const resolvedById = new Map<string, ResolvedRecipe | null>();
  const resolveOverride = (id: string | undefined) => {
    if (!id || !RECIPE_BY_ID[id]) return null;
    if (!resolvedById.has(id)) resolvedById.set(id, resolveRecipe(RECIPE_BY_ID[id], profile));
    return resolvedById.get(id) ?? null;
  };

  const breakfastRotation = breakfasts.slice(0, Math.min(4, breakfasts.length));
  const snackRotation = snacks.slice(0, Math.min(5, snacks.length));

  const days: PlannedDay[] = [];
  for (let d = 0; d < 7; d++) {
    const drafts: DraftMeal[] = [];
    for (const s of slots) {
      let resolved: ResolvedRecipe | undefined;
      let leftover = false;
      let cookDouble = false;
      if (s.key === 'breakfast') resolved = breakfastRotation[d % breakfastRotation.length];
      else if (s.key === 'snack' || s.key === 'snack2') resolved = snackRotation[(d * 2 + (s.key === 'snack2' ? 1 : 0)) % snackRotation.length];
      else if (batch) {
        // Dîner du jour d = mainPicks[d+1] ; déjeuner du jour d = dîner de la veille.
        if (s.key === 'dinner') {
          resolved = mainPicks[d + 1];
          cookDouble = d < 6;
        } else {
          resolved = mainPicks[d];
          leftover = d > 0;
        }
      } else {
        resolved = mainPicks[d * 2 + (s.key === 'dinner' ? 1 : 0)];
      }
      const override = resolveOverride(plan.mealOverrides[`${d}-${s.key}`]);
      if (override) {
        resolved = override;
        leftover = false;
        cookDouble = false;
      }
      if (!resolved) continue;
      const base = ingredientsMacros(resolved.ingredients);
      const scale = clamp((targets.kcal * s.share) / Math.max(base.kcal, 1), 0.6, 2.2);
      drafts.push({ slot: s.key, resolved, scale, leftover, cookDouble });
    }

    // Grammages après mise à l'échelle par repas
    const scaled = drafts.map((dm) =>
      dm.resolved.ingredients.map((ing) => {
        const s = ing.role === 'veg' ? Math.max(1, dm.scale) : ing.role === 'fixed' ? clamp(dm.scale, 0.75, 1.5) : dm.scale;
        return { ...ing, g: ing.g * s };
      }),
    );
    const build = (lists: Ingredient[][]) => {
      const groups: Macros[] = [ZERO, ZERO, ZERO];
      let other = ZERO;
      for (const meal of lists)
        for (const ing of meal) {
          const idx = ROLE_INDEX[ing.role];
          const m = macrosOf(ing.food, ing.g);
          if (idx === undefined) other = addMacros(other, m);
          else groups[idx] = addMacros(groups[idx], m);
        }
      const mult = solveMultipliers(groups, other, { p: targets.protein, c: targets.carbs, f: targets.fat });
      const meals: PlannedMeal[] = drafts.map((dm, k) => {
        const ings: PlannedIngredient[] = lists[k].map((ing) => {
          const idx = ROLE_INDEX[ing.role];
          const g = idx === undefined ? ing.g : ing.g * mult[idx];
          const r = roundQuantity(ing.food, g);
          return { food: ing.food, g: r.g, qty: r.qty, label: food(ing.food).name };
        });
        return {
          slot: dm.slot,
          recipeId: dm.resolved.recipe.id,
          name: dm.resolved.name,
          minutes: dm.resolved.recipe.minutes,
          ingredients: ings,
          macros: ingredientsMacros(ings),
          steps: dm.resolved.recipe.steps,
          tip: dm.resolved.recipe.tip,
          substitutions: dm.resolved.substitutions,
          leftover: dm.leftover,
          cookDouble: dm.cookDouble,
        };
      });
      return { meals, totals: meals.reduce((a, m) => addMacros(a, m.macros), ZERO) };
    };

    let { meals, totals } = build(scaled);
    // Filet de sécurité protéines : si la journée reste trop basse, on ajoute une
    // dose de protéine en poudre à la collation (ou au petit-déjeuner) puis on
    // recalcule les portions pour rester dans les calories.
    const powder = ['whey', 'pea_protein'].map((id) => FOOD_BY_ID[id]).find((f) => allowed(f, profile));
    const deficit = targets.protein - totals.p;
    const snackIdx = drafts.findIndex((dm) => dm.slot === 'snack');
    const hostIdx = snackIdx >= 0 ? snackIdx : drafts.findIndex((dm) => dm.slot === 'breakfast');
    if (powder && deficit > targets.protein * 0.05 && hostIdx >= 0) {
      const g = clamp(Math.round(deficit / (powder.p / 100) / 5) * 5, 15, 40);
      const host = scaled[hostIdx];
      const existing = host.findIndex((x) => x.food === powder.id);
      scaled[hostIdx] =
        existing >= 0 ? host.map((x, k) => (k === existing ? { ...x, g: x.g + g, role: 'fixed' as Role } : x)) : [...host, { food: powder.id, g, role: 'fixed' }];
      ({ meals, totals } = build(scaled));
      meals[hostIdx].substitutions = [...meals[hostIdx].substitutions, `+ ${g} g de ${shortName(powder.id)} pour atteindre ta cible de protéines`];
    }
    days.push({ index: d, date: addDays(plan.mealWeekStart, d), meals, totals });
  }

  // Statistiques « longévité » de la semaine
  const plantSet = new Map<string, number>();
  let fattyFishMeals = 0;
  let legumeMeals = 0;
  let fermentedDays = 0;
  const seenMeals = new Set<string>();
  for (const day of days) {
    let fermented = false;
    for (const m of day.meals) {
      for (const ing of m.ingredients) {
        const f = food(ing.food);
        if (f.plant) plantSet.set(f.id, f.plant === 'full' ? 1 : 0.25);
        if (f.tags?.includes('fermente')) fermented = true;
      }
      if (m.leftover) continue;
      const key = `${day.index}-${m.slot}`;
      if (seenMeals.has(key)) continue;
      seenMeals.add(key);
      if (m.ingredients.some((i) => food(i.food).animal === 'fatty_fish')) fattyFishMeals += m.cookDouble ? 2 : 1;
      if (m.ingredients.some((i) => food(i.food).tags?.includes('legumineuse') && i.g >= 60)) legumeMeals += m.cookDouble ? 2 : 1;
    }
    if (fermented) fermentedDays++;
  }
  return {
    weekStart: plan.mealWeekStart,
    days,
    plantCount: Math.round([...plantSet.values()].reduce((a, b) => a + b, 0)),
    plants: [...plantSet.keys()].map((id) => food(id).name),
    fattyFishMeals,
    legumeMeals,
    fermentedDays,
    avgFiber: days.reduce((a, d) => a + d.totals.fib, 0) / days.length,
  };
}

/** Recettes possibles pour remplacer un repas */
export function alternativesFor(profile: Profile, slot: MealSlotKey): { id: string; name: string }[] {
  const type: Slot = slot === 'breakfast' ? 'breakfast' : slot === 'lunch' || slot === 'dinner' ? 'main' : 'snack';
  return eligibleRecipes(profile, type).map((r) => ({ id: r.recipe.id, name: r.name }));
}
