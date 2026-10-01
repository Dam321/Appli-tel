// Base d'aliments bruts (valeurs pour 100 g, approximations Ciqual / USDA).
// Les céréales et légumineuses sèches sont exprimées en poids SEC (ce qu'on achète).
import type { Allergen, Diet } from '../lib/types';

export type Aisle =
  | 'fruits_legumes'
  | 'viande'
  | 'poisson'
  | 'cremerie'
  | 'epicerie'
  | 'conserves'
  | 'graines'
  | 'huiles'
  | 'epices'
  | 'surgeles'
  | 'boulangerie'
  | 'proteines';

export const AISLES: Record<Aisle, string> = {
  fruits_legumes: 'Fruits & légumes',
  viande: 'Boucherie & volaille',
  poisson: 'Poissonnerie',
  cremerie: 'Crèmerie & œufs',
  boulangerie: 'Boulangerie',
  epicerie: 'Épicerie (féculents, légumineuses)',
  conserves: 'Conserves',
  surgeles: 'Surgelés',
  graines: 'Fruits secs & graines',
  huiles: 'Huiles & condiments',
  epices: 'Épices & aromates',
  proteines: 'Nutrition sportive',
};

export const AISLE_ORDER: Aisle[] = [
  'fruits_legumes',
  'viande',
  'poisson',
  'cremerie',
  'boulangerie',
  'epicerie',
  'conserves',
  'surgeles',
  'graines',
  'huiles',
  'epices',
  'proteines',
];

export type Animal = 'meat' | 'red_meat' | 'fish' | 'fatty_fish' | 'shellfish' | 'dairy' | 'egg';
export type FoodTag =
  | 'omega3'
  | 'polyphenols'
  | 'crucifere'
  | 'fermente'
  | 'legumineuse'
  | 'baies'
  | 'feuilles_vertes'
  | 'noix_graines'
  | 'cereale_complete'
  | 'nitrates'
  | 'mercure';

export interface Food {
  id: string;
  name: string;
  aisle: Aisle;
  kcal: number;
  p: number;
  c: number;
  f: number;
  fib: number;
  /** Aliment compté à la pièce */
  unit?: { name: string; plural: string; grams: number };
  /** Conditionnement typique pour la liste de courses */
  pack?: { grams: number; label: string };
  animal?: Animal;
  allergens?: Allergen[];
  tags?: FoodTag[];
  /** Compte pour la diversité végétale (épices = ¼) */
  plant?: 'full' | 'spice';
  /** Produit de placard qu'on a souvent déjà */
  pantry?: boolean;
  alternatives?: string[];
}

const F = (f: Food) => f;

export const FOODS: Food[] = [
  // ——— Protéines animales ———
  F({ id: 'chicken', name: 'Blanc de poulet', aisle: 'viande', kcal: 110, p: 23, c: 0, f: 1.6, fib: 0, animal: 'meat', alternatives: ['turkey', 'shrimp', 'tofu', 'tempeh', 'chickpeas'] }),
  F({ id: 'turkey', name: 'Escalope de dinde', aisle: 'viande', kcal: 105, p: 23.5, c: 0, f: 1.2, fib: 0, animal: 'meat', alternatives: ['chicken', 'tofu', 'tempeh', 'lentils'] }),
  F({ id: 'beef5', name: 'Bœuf haché 5 % MG', aisle: 'viande', kcal: 125, p: 21, c: 0, f: 4.5, fib: 0, animal: 'red_meat', alternatives: ['turkey', 'tempeh', 'lentils'] }),
  F({ id: 'salmon', name: 'Pavé de saumon', aisle: 'poisson', kcal: 190, p: 20, c: 0, f: 12, fib: 0, animal: 'fatty_fish', allergens: ['fish'], tags: ['omega3'], alternatives: ['mackerel', 'chicken', 'tofu'] }),
  F({ id: 'mackerel', name: 'Filet de maquereau', aisle: 'poisson', kcal: 205, p: 19, c: 0, f: 14, fib: 0, animal: 'fatty_fish', allergens: ['fish'], tags: ['omega3'], alternatives: ['salmon', 'chicken', 'tofu'] }),
  F({ id: 'sardines', name: 'Sardines à l’huile d’olive (égouttées)', aisle: 'conserves', kcal: 210, p: 24, c: 0, f: 12.5, fib: 0, animal: 'fatty_fish', allergens: ['fish'], tags: ['omega3'], pack: { grams: 100, label: 'boîte de 115 g' }, alternatives: ['mackerel', 'eggs', 'tofu'] }),
  F({ id: 'cod', name: 'Dos de cabillaud', aisle: 'poisson', kcal: 80, p: 18, c: 0, f: 0.7, fib: 0, animal: 'fish', allergens: ['fish'], alternatives: ['chicken', 'tofu'] }),
  F({ id: 'tuna', name: 'Thon au naturel (égoutté)', aisle: 'conserves', kcal: 110, p: 25, c: 0, f: 1, fib: 0, animal: 'fish', allergens: ['fish'], tags: ['mercure'], pack: { grams: 140, label: 'boîte de 140 g égouttés' }, alternatives: ['chicken', 'chickpeas'] }),
  F({ id: 'shrimp', name: 'Crevettes décortiquées cuites', aisle: 'surgeles', kcal: 95, p: 21, c: 0, f: 1, fib: 0, animal: 'shellfish', allergens: ['shellfish'], pack: { grams: 300, label: 'sachet de 300 g' }, alternatives: ['cod', 'chicken', 'tofu'] }),
  F({ id: 'eggs', name: 'Œufs (bio, plein air)', aisle: 'cremerie', kcal: 140, p: 12.5, c: 0.7, f: 9.5, fib: 0, animal: 'egg', allergens: ['egg'], unit: { name: 'œuf', plural: 'œufs', grams: 55 }, pack: { grams: 330, label: 'boîte de 6' }, alternatives: ['tofu'] }),
  F({ id: 'egg_whites', name: 'Blancs d’œufs liquides', aisle: 'cremerie', kcal: 48, p: 10.5, c: 0.7, f: 0.2, fib: 0, animal: 'egg', allergens: ['egg'], pack: { grams: 500, label: 'brique de 500 g' }, alternatives: ['skyr', 'soy_yogurt'] }),
  F({ id: 'skyr', name: 'Skyr nature', aisle: 'cremerie', kcal: 63, p: 11, c: 4, f: 0.2, fib: 0, animal: 'dairy', allergens: ['lactose'], pack: { grams: 450, label: 'pot de 450 g' }, alternatives: ['soy_yogurt'] }),
  F({ id: 'greek_yogurt', name: 'Yaourt grec 2 %', aisle: 'cremerie', kcal: 73, p: 10, c: 4, f: 2, fib: 0, animal: 'dairy', allergens: ['lactose'], tags: ['fermente'], pack: { grams: 500, label: 'pot de 500 g' }, alternatives: ['soy_yogurt'] }),
  F({ id: 'fromage_blanc', name: 'Fromage blanc 0 %', aisle: 'cremerie', kcal: 48, p: 8, c: 4, f: 0.2, fib: 0, animal: 'dairy', allergens: ['lactose'], pack: { grams: 500, label: 'pot de 500 g' }, alternatives: ['soy_yogurt'] }),
  F({ id: 'cottage', name: 'Cottage cheese', aisle: 'cremerie', kcal: 98, p: 11, c: 3.4, f: 4.3, fib: 0, animal: 'dairy', allergens: ['lactose'], pack: { grams: 200, label: 'pot de 200 g' }, alternatives: ['soy_yogurt'] }),
  F({ id: 'kefir', name: 'Kéfir de lait nature', aisle: 'cremerie', kcal: 55, p: 3.5, c: 4, f: 3, fib: 0, animal: 'dairy', allergens: ['lactose'], tags: ['fermente'], pack: { grams: 1000, label: 'bouteille de 1 L' }, alternatives: ['soy_milk'] }),
  F({ id: 'milk', name: 'Lait demi-écrémé', aisle: 'cremerie', kcal: 46, p: 3.3, c: 4.8, f: 1.6, fib: 0, animal: 'dairy', allergens: ['lactose'], pack: { grams: 1000, label: 'brique de 1 L' }, alternatives: ['soy_milk'] }),
  F({ id: 'feta', name: 'Feta AOP', aisle: 'cremerie', kcal: 265, p: 14, c: 1.5, f: 22, fib: 0, animal: 'dairy', tags: ['fermente'], pack: { grams: 200, label: 'bloc de 200 g' } }),
  F({ id: 'parmesan', name: 'Parmesan', aisle: 'cremerie', kcal: 400, p: 33, c: 0, f: 29, fib: 0, animal: 'dairy', pack: { grams: 150, label: 'morceau de 150 g' } }),
  F({ id: 'whey', name: 'Whey isolate (nature/vanille)', aisle: 'proteines', kcal: 370, p: 88, c: 2, f: 1, fib: 0, animal: 'dairy', pantry: true, pack: { grams: 1000, label: 'pot de 1 kg' }, alternatives: ['pea_protein'] }),

  // ——— Protéines végétales ———
  F({ id: 'pea_protein', name: 'Protéine végétale (pois/riz)', aisle: 'proteines', kcal: 380, p: 80, c: 4, f: 6, fib: 1, pantry: true, plant: 'full', pack: { grams: 1000, label: 'pot de 1 kg' } }),
  F({ id: 'tofu', name: 'Tofu ferme', aisle: 'cremerie', kcal: 145, p: 15, c: 2, f: 8.5, fib: 1, allergens: ['soy'], plant: 'full', pack: { grams: 400, label: 'bloc de 400 g' }, alternatives: ['tempeh', 'chickpeas', 'eggs'] }),
  F({ id: 'tempeh', name: 'Tempeh', aisle: 'cremerie', kcal: 195, p: 20, c: 8, f: 11, fib: 5, allergens: ['soy'], tags: ['fermente', 'legumineuse'], plant: 'full', pack: { grams: 200, label: 'bloc de 200 g' }, alternatives: ['tofu', 'chickpeas', 'chicken'] }),
  F({ id: 'soy_yogurt', name: 'Yaourt soja nature (enrichi calcium)', aisle: 'cremerie', kcal: 45, p: 4, c: 1, f: 2.3, fib: 0.6, allergens: ['soy'], tags: ['fermente'], plant: 'full', pack: { grams: 500, label: 'pot de 500 g' }, alternatives: ['skyr'] }),
  F({ id: 'soy_milk', name: 'Boisson soja nature enrichie calcium', aisle: 'epicerie', kcal: 35, p: 3.3, c: 0.5, f: 1.9, fib: 0.5, allergens: ['soy'], plant: 'full', pack: { grams: 1000, label: 'brique de 1 L' }, alternatives: ['milk'] }),
  F({ id: 'lentils', name: 'Lentilles vertes/corail (sèches)', aisle: 'epicerie', kcal: 340, p: 25, c: 50, f: 1.2, fib: 11, tags: ['legumineuse'], plant: 'full', pantry: true, pack: { grams: 500, label: 'sachet de 500 g' }, alternatives: ['chickpeas'] }),
  F({ id: 'chickpeas', name: 'Pois chiches (conserve, égouttés)', aisle: 'conserves', kcal: 120, p: 7, c: 14, f: 2.5, fib: 6.5, tags: ['legumineuse'], plant: 'full', pack: { grams: 265, label: 'boîte de 400 g' }, alternatives: ['red_beans', 'lentils'] }),
  F({ id: 'red_beans', name: 'Haricots rouges (conserve, égouttés)', aisle: 'conserves', kcal: 100, p: 7, c: 13, f: 0.5, fib: 6.5, tags: ['legumineuse'], plant: 'full', pack: { grams: 250, label: 'boîte de 400 g' }, alternatives: ['chickpeas', 'lentils'] }),
  F({ id: 'edamame', name: 'Edamame écossés', aisle: 'surgeles', kcal: 120, p: 11, c: 7, f: 5, fib: 5, allergens: ['soy'], tags: ['legumineuse'], plant: 'full', pack: { grams: 400, label: 'sachet de 400 g' }, alternatives: ['chickpeas'] }),

  // ——— Féculents ———
  F({ id: 'oats', name: 'Flocons d’avoine', aisle: 'epicerie', kcal: 370, p: 13, c: 59, f: 7, fib: 10, allergens: ['gluten'], tags: ['cereale_complete'], plant: 'full', pantry: true, pack: { grams: 500, label: 'sachet de 500 g' }, alternatives: ['quinoa'] }),
  F({ id: 'quinoa', name: 'Quinoa (sec)', aisle: 'epicerie', kcal: 368, p: 14, c: 57, f: 6, fib: 7, tags: ['cereale_complete'], plant: 'full', pantry: true, pack: { grams: 500, label: 'sachet de 500 g' } }),
  F({ id: 'brown_rice', name: 'Riz complet (sec)', aisle: 'epicerie', kcal: 355, p: 7.5, c: 74, f: 2.5, fib: 3.5, tags: ['cereale_complete'], plant: 'full', pantry: true, pack: { grams: 1000, label: 'paquet de 1 kg' } }),
  F({ id: 'basmati', name: 'Riz basmati (sec)', aisle: 'epicerie', kcal: 355, p: 8, c: 78, f: 0.8, fib: 1.3, plant: 'full', pantry: true, pack: { grams: 1000, label: 'paquet de 1 kg' } }),
  F({ id: 'ww_pasta', name: 'Pâtes complètes (sèches)', aisle: 'epicerie', kcal: 350, p: 13, c: 64, f: 2.5, fib: 8, allergens: ['gluten'], tags: ['cereale_complete'], plant: 'full', pantry: true, pack: { grams: 500, label: 'paquet de 500 g' }, alternatives: ['buckwheat', 'brown_rice'] }),
  F({ id: 'buckwheat', name: 'Sarrasin décortiqué (sec)', aisle: 'epicerie', kcal: 345, p: 13, c: 67, f: 3.4, fib: 6, tags: ['cereale_complete', 'polyphenols'], plant: 'full', pantry: true, pack: { grams: 500, label: 'sachet de 500 g' } }),
  F({ id: 'sweet_potato', name: 'Patate douce', aisle: 'fruits_legumes', kcal: 86, p: 1.6, c: 17, f: 0.1, fib: 3, plant: 'full' }),
  F({ id: 'potato', name: 'Pommes de terre', aisle: 'fruits_legumes', kcal: 77, p: 2, c: 16, f: 0.1, fib: 2, plant: 'full' }),
  F({ id: 'sourdough', name: 'Pain complet au levain', aisle: 'boulangerie', kcal: 240, p: 9, c: 43, f: 2, fib: 7, allergens: ['gluten'], tags: ['cereale_complete', 'fermente'], plant: 'full', pack: { grams: 500, label: 'pain de 500 g' }, alternatives: ['rice_cakes'] }),
  F({ id: 'rice_cakes', name: 'Galettes de riz complet', aisle: 'epicerie', kcal: 380, p: 8, c: 80, f: 3, fib: 4, plant: 'full', pantry: true, pack: { grams: 130, label: 'paquet de 130 g' } }),

  // ——— Légumes ———
  F({ id: 'broccoli', name: 'Brocoli', aisle: 'fruits_legumes', kcal: 34, p: 2.8, c: 4, f: 0.4, fib: 2.6, tags: ['crucifere'], plant: 'full', alternatives: ['cauliflower', 'green_beans'] }),
  F({ id: 'cauliflower', name: 'Chou-fleur', aisle: 'fruits_legumes', kcal: 25, p: 2, c: 3, f: 0.3, fib: 2, tags: ['crucifere'], plant: 'full', alternatives: ['broccoli'] }),
  F({ id: 'kale', name: 'Chou kale', aisle: 'fruits_legumes', kcal: 49, p: 4.3, c: 4.4, f: 0.9, fib: 4.1, tags: ['crucifere', 'feuilles_vertes'], plant: 'full', alternatives: ['spinach'] }),
  F({ id: 'spinach', name: 'Épinards (frais ou surgelés)', aisle: 'surgeles', kcal: 23, p: 2.9, c: 1.4, f: 0.4, fib: 2.2, tags: ['feuilles_vertes', 'nitrates'], plant: 'full', alternatives: ['kale'] }),
  F({ id: 'rocket', name: 'Roquette', aisle: 'fruits_legumes', kcal: 25, p: 2.6, c: 2, f: 0.7, fib: 1.6, tags: ['crucifere', 'feuilles_vertes', 'nitrates'], plant: 'full', pack: { grams: 125, label: 'sachet de 125 g' }, alternatives: ['mesclun'] }),
  F({ id: 'mesclun', name: 'Mesclun / jeunes pousses', aisle: 'fruits_legumes', kcal: 15, p: 1.4, c: 1.5, f: 0.2, fib: 1.3, tags: ['feuilles_vertes'], plant: 'full', pack: { grams: 150, label: 'sachet de 150 g' } }),
  F({ id: 'red_cabbage', name: 'Chou rouge', aisle: 'fruits_legumes', kcal: 30, p: 1.4, c: 5, f: 0.2, fib: 2.1, tags: ['crucifere', 'polyphenols'], plant: 'full' }),
  F({ id: 'brussels', name: 'Choux de Bruxelles', aisle: 'surgeles', kcal: 43, p: 3.4, c: 5, f: 0.3, fib: 3.8, tags: ['crucifere'], plant: 'full', alternatives: ['broccoli'] }),
  F({ id: 'tomato', name: 'Tomates (ou tomates cerises)', aisle: 'fruits_legumes', kcal: 18, p: 0.9, c: 3, f: 0.2, fib: 1.2, tags: ['polyphenols'], plant: 'full' }),
  F({ id: 'canned_tomato', name: 'Tomates concassées', aisle: 'conserves', kcal: 25, p: 1.2, c: 4, f: 0.2, fib: 1.2, tags: ['polyphenols'], plant: 'full', pantry: true, pack: { grams: 400, label: 'boîte de 400 g' } }),
  F({ id: 'cucumber', name: 'Concombre', aisle: 'fruits_legumes', kcal: 13, p: 0.6, c: 2, f: 0.1, fib: 0.6, plant: 'full', unit: { name: 'concombre', plural: 'concombres', grams: 300 } }),
  F({ id: 'bell_pepper', name: 'Poivron rouge', aisle: 'fruits_legumes', kcal: 30, p: 1, c: 5, f: 0.3, fib: 1.8, tags: ['polyphenols'], plant: 'full', unit: { name: 'poivron', plural: 'poivrons', grams: 150 } }),
  F({ id: 'zucchini', name: 'Courgette', aisle: 'fruits_legumes', kcal: 17, p: 1.2, c: 2.2, f: 0.3, fib: 1, plant: 'full', unit: { name: 'courgette', plural: 'courgettes', grams: 200 } }),
  F({ id: 'carrot', name: 'Carottes', aisle: 'fruits_legumes', kcal: 36, p: 0.8, c: 7, f: 0.2, fib: 2.7, plant: 'full' }),
  F({ id: 'onion', name: 'Oignon', aisle: 'fruits_legumes', kcal: 40, p: 1.1, c: 7.5, f: 0.1, fib: 1.7, tags: ['polyphenols'], plant: 'full', unit: { name: 'oignon', plural: 'oignons', grams: 100 } }),
  F({ id: 'garlic', name: 'Ail', aisle: 'fruits_legumes', kcal: 135, p: 6, c: 25, f: 0.5, fib: 2, plant: 'spice', unit: { name: 'gousse', plural: 'gousses', grams: 5 } }),
  F({ id: 'mushrooms', name: 'Champignons de Paris', aisle: 'fruits_legumes', kcal: 22, p: 3, c: 0.5, f: 0.3, fib: 1, plant: 'full', pack: { grams: 250, label: 'barquette de 250 g' } }),
  F({ id: 'green_beans', name: 'Haricots verts', aisle: 'surgeles', kcal: 31, p: 1.8, c: 4.5, f: 0.2, fib: 3, plant: 'full', alternatives: ['broccoli'] }),
  F({ id: 'beetroot', name: 'Betterave cuite', aisle: 'fruits_legumes', kcal: 44, p: 1.7, c: 8, f: 0.2, fib: 2.8, tags: ['nitrates'], plant: 'full', pack: { grams: 250, label: 'barquette de 250 g' } }),
  F({ id: 'avocado', name: 'Avocat', aisle: 'fruits_legumes', kcal: 160, p: 2, c: 2, f: 15, fib: 6.7, plant: 'full', unit: { name: 'avocat', plural: 'avocats', grams: 150 } }),
  F({ id: 'sauerkraut', name: 'Choucroute crue (non pasteurisée)', aisle: 'cremerie', kcal: 20, p: 1, c: 2, f: 0.1, fib: 3, tags: ['fermente', 'crucifere'], plant: 'full', pack: { grams: 500, label: 'bocal de 500 g' }, alternatives: ['kimchi'] }),
  F({ id: 'kimchi', name: 'Kimchi', aisle: 'cremerie', kcal: 25, p: 1.5, c: 2.5, f: 0.5, fib: 2, tags: ['fermente', 'crucifere'], plant: 'full', pack: { grams: 300, label: 'bocal de 300 g' }, alternatives: ['sauerkraut'] }),
  F({ id: 'parsley', name: 'Persil / coriandre frais', aisle: 'fruits_legumes', kcal: 36, p: 3, c: 3, f: 0.8, fib: 3.3, tags: ['polyphenols'], plant: 'spice', unit: { name: 'botte', plural: 'bottes', grams: 30 } }),
  F({ id: 'ginger', name: 'Gingembre frais', aisle: 'fruits_legumes', kcal: 80, p: 1.8, c: 15, f: 0.8, fib: 2, tags: ['polyphenols'], plant: 'spice' }),
  F({ id: 'broccoli_sprouts', name: 'Pousses de brocoli', aisle: 'fruits_legumes', kcal: 30, p: 2.5, c: 3, f: 0.5, fib: 2, tags: ['crucifere'], plant: 'full', pack: { grams: 50, label: 'barquette de 50 g' }, alternatives: ['rocket'] }),

  // ——— Fruits ———
  F({ id: 'blueberries', name: 'Myrtilles (surgelées ok)', aisle: 'surgeles', kcal: 57, p: 0.7, c: 12, f: 0.3, fib: 2.4, tags: ['baies', 'polyphenols'], plant: 'full', pack: { grams: 500, label: 'sachet de 500 g' } }),
  F({ id: 'raspberries', name: 'Framboises (surgelées ok)', aisle: 'surgeles', kcal: 52, p: 1.2, c: 5.5, f: 0.7, fib: 6.5, tags: ['baies', 'polyphenols'], plant: 'full', pack: { grams: 500, label: 'sachet de 500 g' } }),
  F({ id: 'red_berries', name: 'Mélange de fruits rouges surgelés', aisle: 'surgeles', kcal: 45, p: 1, c: 8, f: 0.3, fib: 4, tags: ['baies', 'polyphenols'], plant: 'full', pack: { grams: 750, label: 'sachet de 750 g' } }),
  F({ id: 'banana', name: 'Banane', aisle: 'fruits_legumes', kcal: 90, p: 1.1, c: 20, f: 0.3, fib: 2.6, plant: 'full', unit: { name: 'banane', plural: 'bananes', grams: 120 } }),
  F({ id: 'apple', name: 'Pomme', aisle: 'fruits_legumes', kcal: 52, p: 0.3, c: 12, f: 0.2, fib: 2.4, tags: ['polyphenols'], plant: 'full', unit: { name: 'pomme', plural: 'pommes', grams: 150 } }),
  F({ id: 'orange', name: 'Orange', aisle: 'fruits_legumes', kcal: 47, p: 0.9, c: 9.5, f: 0.1, fib: 2.2, plant: 'full', unit: { name: 'orange', plural: 'oranges', grams: 150 } }),
  F({ id: 'kiwi', name: 'Kiwi', aisle: 'fruits_legumes', kcal: 61, p: 1.1, c: 12, f: 0.5, fib: 3, plant: 'full', unit: { name: 'kiwi', plural: 'kiwis', grams: 75 } }),
  F({ id: 'lemon', name: 'Citron', aisle: 'fruits_legumes', kcal: 29, p: 1, c: 6, f: 0.3, fib: 2.8, plant: 'spice', unit: { name: 'citron', plural: 'citrons', grams: 100 } }),
  F({ id: 'pomegranate', name: 'Grenade (graines)', aisle: 'fruits_legumes', kcal: 83, p: 1.7, c: 14, f: 1.2, fib: 4, tags: ['polyphenols'], plant: 'full', pack: { grams: 150, label: 'barquette de 150 g' } }),

  // ——— Noix, graines, gras ———
  F({ id: 'olive_oil', name: 'Huile d’olive vierge extra', aisle: 'huiles', kcal: 900, p: 0, c: 0, f: 100, fib: 0, tags: ['polyphenols'], pantry: true, pack: { grams: 690, label: 'bouteille de 75 cl' } }),
  F({ id: 'walnuts', name: 'Cerneaux de noix', aisle: 'graines', kcal: 690, p: 15, c: 7, f: 65, fib: 6.7, allergens: ['nuts'], tags: ['omega3', 'noix_graines', 'polyphenols'], plant: 'full', pantry: true, pack: { grams: 200, label: 'sachet de 200 g' }, alternatives: ['pumpkin_seeds'] }),
  F({ id: 'almonds', name: 'Amandes', aisle: 'graines', kcal: 600, p: 21, c: 9, f: 52, fib: 12, allergens: ['nuts'], tags: ['noix_graines'], plant: 'full', pantry: true, pack: { grams: 200, label: 'sachet de 200 g' }, alternatives: ['pumpkin_seeds'] }),
  F({ id: 'brazil_nuts', name: 'Noix du Brésil (sélénium)', aisle: 'graines', kcal: 660, p: 14, c: 4, f: 67, fib: 7.5, allergens: ['nuts'], tags: ['noix_graines'], plant: 'full', pantry: true, unit: { name: 'noix du Brésil', plural: 'noix du Brésil', grams: 5 }, pack: { grams: 125, label: 'sachet de 125 g' }, alternatives: ['pumpkin_seeds'] }),
  F({ id: 'chia', name: 'Graines de chia', aisle: 'graines', kcal: 490, p: 17, c: 8, f: 31, fib: 34, tags: ['omega3', 'noix_graines'], plant: 'full', pantry: true, pack: { grams: 250, label: 'sachet de 250 g' } }),
  F({ id: 'flax', name: 'Graines de lin moulues', aisle: 'graines', kcal: 530, p: 18, c: 2, f: 42, fib: 27, tags: ['omega3', 'noix_graines'], plant: 'full', pantry: true, pack: { grams: 250, label: 'sachet de 250 g' } }),
  F({ id: 'pumpkin_seeds', name: 'Graines de courge', aisle: 'graines', kcal: 560, p: 30, c: 5, f: 49, fib: 6, tags: ['noix_graines'], plant: 'full', pantry: true, pack: { grams: 200, label: 'sachet de 200 g' } }),
  F({ id: 'peanut_butter', name: 'Purée de cacahuète 100 %', aisle: 'graines', kcal: 600, p: 25, c: 12, f: 50, fib: 6, allergens: ['peanut'], tags: ['noix_graines'], plant: 'full', pantry: true, pack: { grams: 350, label: 'pot de 350 g' }, alternatives: ['tahini', 'pumpkin_seeds'] }),
  F({ id: 'tahini', name: 'Tahini (purée de sésame)', aisle: 'graines', kcal: 600, p: 18, c: 10, f: 54, fib: 9, allergens: ['sesame'], tags: ['noix_graines'], plant: 'full', pantry: true, pack: { grams: 250, label: 'pot de 250 g' }, alternatives: ['olive_oil'] }),
  F({ id: 'dark_choc', name: 'Chocolat noir 85 %', aisle: 'epicerie', kcal: 600, p: 10, c: 20, f: 50, fib: 12, tags: ['polyphenols'], plant: 'full', pantry: true, pack: { grams: 100, label: 'tablette de 100 g' } }),

  // ——— Condiments & épices ———
  F({ id: 'mustard', name: 'Moutarde de Dijon', aisle: 'huiles', kcal: 150, p: 7, c: 4, f: 11, fib: 3, pantry: true, pack: { grams: 200, label: 'pot de 200 g' } }),
  F({ id: 'tamari', name: 'Tamari / sauce soja réduite en sel', aisle: 'huiles', kcal: 60, p: 10, c: 5, f: 0, fib: 0, allergens: ['soy'], tags: ['fermente'], pantry: true, pack: { grams: 250, label: 'bouteille de 250 ml' } }),
  F({ id: 'miso', name: 'Pâte miso', aisle: 'epicerie', kcal: 200, p: 12, c: 26, f: 6, fib: 5, allergens: ['soy'], tags: ['fermente'], pantry: true, pack: { grams: 300, label: 'pot de 300 g' } }),
  F({ id: 'cider_vinegar', name: 'Vinaigre de cidre', aisle: 'huiles', kcal: 20, p: 0, c: 1, f: 0, fib: 0, tags: ['fermente'], pantry: true, pack: { grams: 500, label: 'bouteille de 50 cl' } }),
  F({ id: 'turmeric', name: 'Curcuma', aisle: 'epices', kcal: 0, p: 0, c: 0, f: 0, fib: 0, tags: ['polyphenols'], plant: 'spice', pantry: true }),
  F({ id: 'black_pepper', name: 'Poivre noir', aisle: 'epices', kcal: 0, p: 0, c: 0, f: 0, fib: 0, plant: 'spice', pantry: true }),
  F({ id: 'cinnamon', name: 'Cannelle de Ceylan', aisle: 'epices', kcal: 0, p: 0, c: 0, f: 0, fib: 0, tags: ['polyphenols'], plant: 'spice', pantry: true }),
  F({ id: 'cumin', name: 'Cumin', aisle: 'epices', kcal: 0, p: 0, c: 0, f: 0, fib: 0, plant: 'spice', pantry: true }),
  F({ id: 'paprika', name: 'Paprika fumé', aisle: 'epices', kcal: 0, p: 0, c: 0, f: 0, fib: 0, plant: 'spice', pantry: true }),
  F({ id: 'curry', name: 'Curry en poudre', aisle: 'epices', kcal: 0, p: 0, c: 0, f: 0, fib: 0, tags: ['polyphenols'], plant: 'spice', pantry: true }),
  F({ id: 'herbes', name: 'Herbes de Provence', aisle: 'epices', kcal: 0, p: 0, c: 0, f: 0, fib: 0, plant: 'spice', pantry: true }),
];

export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.id, f]));

/** Noms courts utilisés dans les titres de recettes */
const SHORT: Record<string, string> = {
  chicken: 'poulet',
  turkey: 'dinde',
  beef5: 'bœuf',
  salmon: 'saumon',
  mackerel: 'maquereau',
  sardines: 'sardines',
  cod: 'cabillaud',
  tuna: 'thon',
  shrimp: 'crevettes',
  eggs: 'œufs',
  skyr: 'skyr',
  greek_yogurt: 'yaourt grec',
  fromage_blanc: 'fromage blanc',
  cottage: 'cottage cheese',
  kefir: 'kéfir',
  milk: 'lait',
  whey: 'whey',
  pea_protein: 'protéine végétale',
  tofu: 'tofu',
  tempeh: 'tempeh',
  soy_yogurt: 'yaourt soja',
  soy_milk: 'lait de soja',
  lentils: 'lentilles',
  chickpeas: 'pois chiches',
  red_beans: 'haricots rouges',
  edamame: 'edamame',
  oats: 'avoine',
  quinoa: 'quinoa',
  brown_rice: 'riz complet',
  basmati: 'riz basmati',
  ww_pasta: 'pâtes complètes',
  buckwheat: 'sarrasin',
  sourdough: 'pain au levain',
  rice_cakes: 'galettes de riz',
  walnuts: 'noix',
  almonds: 'amandes',
  pumpkin_seeds: 'graines de courge',
  peanut_butter: 'beurre de cacahuète',
  tahini: 'tahini',
  blueberries: 'myrtilles',
  raspberries: 'framboises',
  olive_oil: 'huile d’olive',
};

export function shortName(id: string): string {
  return SHORT[id] ?? FOOD_BY_ID[id]?.name.toLowerCase() ?? id;
}

export function food(id: string): Food {
  const f = FOOD_BY_ID[id];
  if (!f) throw new Error(`Aliment inconnu : ${id}`);
  return f;
}

/** L'aliment est-il compatible avec le régime et les allergies ? */
export function isFoodAllowed(f: Food, diet: Diet, allergens: string[], disliked: string[] = []): boolean {
  if (disliked.includes(f.id)) return false;
  if (f.allergens?.some((a) => allergens.includes(a))) return false;
  // Les fromages affinés (feta, parmesan) sont quasi sans lactose.
  if (f.animal) {
    if (diet === 'vegan') return false;
    if (diet === 'vegetarian' && ['meat', 'red_meat', 'fish', 'fatty_fish', 'shellfish'].includes(f.animal)) return false;
    if (diet === 'pescatarian' && ['meat', 'red_meat'].includes(f.animal)) return false;
  }
  return true;
}
