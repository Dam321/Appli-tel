// Rééquilibrage de la journée après un repas hors menu : ce qui a été mangé
// (repas du menu cochés + repas hors menu) est comparé à la cible du jour, et le
// reste de la journée est ajusté en gardant les protéines et en jouant sur les
// féculents et les matières grasses. Un écart ponctuel ne se « compense » pas en
// sautant un repas : c'est la moyenne de la semaine qui compte.
import { SLOT_LABEL, type PlannedMeal } from './mealPlanner';
import type { Diet, LoggedMeal } from './types';

export interface DayBalance {
  eaten: { kcal: number; protein: number };
  target: { kcal: number; protein: number };
  remainingMeals: PlannedMeal[];
  advice: string[];
  tone: 'good' | 'warning' | 'neutral';
}

const proteinFix = (diet: Diet, grams: number) =>
  diet === 'vegan'
    ? `ajoute environ ${grams} g de protéines (tofu, tempeh ou une dose de protéine de pois ≈ 24 g)`
    : `ajoute environ ${grams} g de protéines (skyr 250 g ≈ 25 g, ou une dose de whey ≈ 24 g)`;

export function dayBalance(meals: PlannedMeal[], checked: Record<string, boolean>, extras: LoggedMeal[], target: { kcal: number; protein: number }, diet: Diet): DayBalance {
  const replaced = new Set(extras.map((e) => e.replaces).filter(Boolean));
  const eatenPlanned = meals.filter((m) => checked[m.slot] && !replaced.has(m.slot));
  const eaten = {
    kcal: Math.round(eatenPlanned.reduce((a, m) => a + m.macros.kcal, 0) + extras.reduce((a, e) => a + e.kcal, 0)),
    protein: Math.round(eatenPlanned.reduce((a, m) => a + m.macros.p, 0) + extras.reduce((a, e) => a + e.protein, 0)),
  };
  const remainingMeals = meals.filter((m) => !checked[m.slot] && !replaced.has(m.slot));
  const advice: string[] = [];
  let tone: DayBalance['tone'] = 'neutral';
  if (!extras.length) return { eaten, target, remainingMeals, advice, tone };

  const restKcal = remainingMeals.reduce((a, m) => a + m.macros.kcal, 0);
  const restP = remainingMeals.reduce((a, m) => a + m.macros.p, 0);
  const projected = eaten.kcal + restKcal;
  const over = Math.round(projected - target.kcal);
  const proteinGap = Math.round(target.protein - (eaten.protein + restP));

  if (!remainingMeals.length) {
    if (over > 250) {
      tone = 'warning';
      advice.push(`Journée terminée à environ +${over} kcal. Ne compense pas en jeûnant : demain, menu normal et 20-30 min de marche en plus. Un écart isolé pèse peu sur la semaine.`);
    } else if (over < -300) advice.push(`Journée terminée à environ ${over} kcal sous ta cible : une collation protéinée ce soir (skyr, fromage blanc, œufs…) t’aiderait à récupérer.`);
    else {
      tone = 'good';
      advice.push('Journée dans ta cible malgré le repas hors menu. Parfait.');
    }
  } else {
    const names = remainingMeals.map((m) => SLOT_LABEL[m.slot].toLowerCase()).join(' et ');
    if (over > 80) {
      const flexible = Math.max(1, restKcal - restP * 4);
      const keep = Math.max(0.3, 1 - over / flexible);
      if (over > flexible * 0.7) {
        tone = 'warning';
        advice.push(`Avec ${extras.length > 1 ? 'ces repas' : 'ce repas'}, ta journée dépasserait ta cible d’environ ${over} kcal. Pour ${names} : garde la portion de protéines et les légumes, retire presque tous les féculents et les matières grasses ajoutées. Ne saute pas de repas : un écart ponctuel se lisse sur la semaine.`);
      } else {
        tone = 'neutral';
        advice.push(`Pour rester dans ta cible : ${names}, garde la portion de protéines et les légumes, et prends environ ${Math.round(keep * 10) * 10} % des féculents et des matières grasses (≈ −${over} kcal).`);
      }
    } else if (over < -150) {
      advice.push(`Il te reste de la marge (${-over} kcal) : augmente un peu les féculents de ${names} ou ajoute un fruit et une poignée d’oléagineux.`);
    } else {
      tone = 'good';
      advice.push('Le repas hors menu rentre dans ta journée : garde le reste du menu tel quel.');
    }
  }
  if (proteinGap >= 15) advice.push(`Protéines : il t’en manquera ~${proteinGap} g sur la journée, ${proteinFix(diet, proteinGap)}.`);
  return { eaten, target, remainingMeals, advice, tone };
}
