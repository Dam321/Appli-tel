// Liste de courses : agrégation du menu de la semaine par rayon, avec conversion
// en unités d'achat (pièces, boîtes, sachets).
import { AISLES, AISLE_ORDER, food, type Aisle } from '../data/foods';
import type { WeekPlan } from './mealPlanner';

export interface ShoppingItem {
  key: string;
  foodId?: string;
  label: string;
  amount: string;
  detail?: string;
  aisle: Aisle | 'supplements' | 'extra';
  pantry: boolean;
  grams?: number;
}

export interface ShoppingSection {
  aisle: Aisle | 'supplements' | 'extra';
  title: string;
  items: ShoppingItem[];
}

function formatGrams(g: number): string {
  if (g >= 1000) return `${(Math.ceil(g / 50) * 50 / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`;
  return `${Math.ceil(g / 10) * 10} g`;
}

export function buildShoppingList(plan: WeekPlan): ShoppingItem[] {
  const totals = new Map<string, number>();
  for (const d of plan.days) for (const m of d.meals) for (const ing of m.ingredients) totals.set(ing.food, (totals.get(ing.food) ?? 0) + ing.g);

  const items: ShoppingItem[] = [];
  for (const [id, g] of totals) {
    const f = food(id);
    let amount: string;
    let detail: string | undefined;
    if (f.unit) {
      const units = Math.ceil(g / f.unit.grams - 0.05);
      if (id === 'garlic') amount = `${Math.max(1, Math.ceil(units / 10))} tête${units > 10 ? 's' : ''}`;
      else if (id === 'parsley') amount = `${Math.max(1, Math.ceil(units / 2))} botte${units > 2 ? 's' : ''}`;
      else amount = `${units} ${units > 1 ? f.unit.plural : f.unit.name}`;
      if (id === 'eggs') detail = `≈ ${Math.ceil(units / 6)} boîte${units > 6 ? 's' : ''} de 6`;
    } else if (f.aisle === 'epices') {
      amount = 'à avoir';
    } else {
      amount = ['milk', 'soy_milk', 'kefir'].includes(id) ? `${(Math.ceil(g / 100) / 10).toLocaleString('fr-FR')} L` : formatGrams(g);
      if (f.pack) {
        const n = Math.max(1, Math.ceil(g / f.pack.grams - 0.1));
        detail = `≈ ${n} × ${f.pack.label}`;
      }
    }
    items.push({ key: id, foodId: id, label: f.name, amount, detail, aisle: f.aisle, pantry: !!f.pantry, grams: g });
  }
  items.sort((a, b) => AISLE_ORDER.indexOf(a.aisle as Aisle) - AISLE_ORDER.indexOf(b.aisle as Aisle) || a.label.localeCompare(b.label, 'fr'));
  return items;
}

export function groupByAisle(items: ShoppingItem[]): ShoppingSection[] {
  const order: (Aisle | 'supplements' | 'extra')[] = [...AISLE_ORDER, 'supplements', 'extra'];
  const titles: Record<string, string> = { ...AISLES, supplements: 'Compléments alimentaires', extra: 'Ajouts perso' };
  return order
    .map((aisle) => ({ aisle, title: titles[aisle], items: items.filter((i) => i.aisle === aisle) }))
    .filter((s) => s.items.length > 0);
}

export function shoppingListText(sections: ShoppingSection[], checked: Record<string, boolean>): string {
  const lines: string[] = ['🛒 Liste de courses de la semaine', ''];
  for (const s of sections) {
    const remaining = s.items.filter((i) => !checked[i.key]);
    if (!remaining.length) continue;
    lines.push(`— ${s.title} —`);
    for (const i of remaining) lines.push(`☐ ${i.label} : ${i.amount}${i.detail ? ` (${i.detail})` : ''}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}
