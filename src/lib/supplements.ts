// Compléments personnalisés : règles fondées sur ton profil, ton menu et ta prise
// de sang. Chaque complément affiche un niveau de preuve honnête :
//   A = preuves solides (méta-analyses d'essais randomisés)
//   B = preuves modérées / bénéfice probable
//   C = préliminaire, expérimental
import type { Profile } from './types';

export type SuppStatus = 'essential' | 'recommended' | 'conditional' | 'optional' | 'not_needed' | 'avoid';
export type Timing = 'matin' | 'repas' | 'pre' | 'soir' | 'jeun';

export const TIMING_LABEL: Record<Timing, string> = {
  matin: 'Matin (avec le petit-déj)',
  repas: 'Avec un repas (n’importe lequel)',
  pre: 'Avant l’entraînement',
  soir: 'Le soir',
  jeun: 'À jeun',
};

export const STATUS_INFO: Record<SuppStatus, { label: string; tone: 'good' | 'accent' | 'warning' | 'neutral' | 'critical' }> = {
  essential: { label: 'Indispensable', tone: 'good' },
  recommended: { label: 'Recommandé', tone: 'accent' },
  conditional: { label: 'Selon ta prise de sang', tone: 'warning' },
  optional: { label: 'Optionnel', tone: 'neutral' },
  not_needed: { label: 'Inutile pour toi', tone: 'neutral' },
  avoid: { label: 'À éviter', tone: 'critical' },
};

export interface SupplementRec {
  id: string;
  name: string;
  status: SuppStatus;
  evidence: 'A' | 'B' | 'C';
  dose: string;
  timing: Timing[];
  form: string;
  why: string;
  cautions?: string;
  costPerMonth?: number;
  category: 'base' | 'santé' | 'performance' | 'peau & articulations' | 'longévité (expérimental)';
}

export interface SuppContext {
  profile: Profile;
  age: number;
  weightKg: number;
  blood: Record<string, number>;
  fattyFishMeals?: number;
  avgFiber?: number;
  usesProteinPowder?: boolean;
  month: number;
}

const isWinter = (m: number) => m >= 9 || m <= 3; // octobre → avril (0 = janvier)

export function supplementPlan(ctx: SuppContext): SupplementRec[] {
  const { profile, blood: b, age, weightKg } = ctx;
  const out: SupplementRec[] = [];
  const plantBased = profile.diet === 'vegan' || profile.diet === 'vegetarian';

  // ——— Créatine ———
  out.push({
    id: 'creatine',
    name: 'Créatine monohydrate',
    status: b.egfr !== undefined && b.egfr < 60 ? 'avoid' : 'essential',
    evidence: 'A',
    dose: `${weightKg > 90 ? 5 : weightKg > 70 ? 4 : 3} g/jour, tous les jours (pas de phase de charge nécessaire)`,
    timing: ['repas'],
    form: 'Monohydrate en poudre, idéalement label Creapure®',
    why: 'Le complément le plus prouvé : +force, +masse maigre, meilleure récupération. Données prometteuses aussi sur la cognition et le maintien musculaire avec l’âge.',
    cautions:
      b.egfr !== undefined && b.egfr < 60
        ? 'DFG < 60 : ne pas prendre sans avis médical.'
        : '+1-2 kg d’eau DANS le muscle les premières semaines (pas du gras). Élève la créatinine sanguine sans abîmer les reins : préviens ton médecin.',
    costPerMonth: 4,
    category: 'base',
  });

  // ——— Vitamine D3 ———
  {
    const v = b.vitd;
    let status: SuppStatus;
    let dose: string;
    let why: string;
    if (v !== undefined) {
      if (v < 20) [status, dose, why] = ['essential', '4 000 UI/jour (ton médecin peut prescrire une dose de charge)', `Taux à ${v} ng/mL : carence. Objectif 40-60 ng/mL.`];
      else if (v < 30) [status, dose, why] = ['essential', '3 000 UI/jour', `Taux à ${v} ng/mL : insuffisance. Objectif 40-60 ng/mL, recontrôle dans 3 mois.`];
      else if (v < 40) [status, dose, why] = ['recommended', '2 000 UI/jour', `Taux à ${v} ng/mL : correct mais sous l’optimal (40-60).`];
      else if (v <= 60) [status, dose, why] = [isWinter(ctx.month) ? 'recommended' : 'optional', '1 000 UI/jour d’octobre à avril', `Taux optimal (${v} ng/mL) : simple entretien l’hiver.`];
      else if (v <= 100) [status, dose, why] = ['not_needed', '—', `Taux déjà élevé (${v} ng/mL) : pas besoin de supplémenter.`];
      else [status, dose, why] = ['avoid', 'Stop', `Taux trop haut (${v} ng/mL) : arrête toute supplémentation et parles-en au médecin.`];
    } else if (isWinter(ctx.month) || profile.sunExposure === 'low') {
      [status, dose, why] = ['recommended', '1 000 à 2 000 UI/jour (à ajuster après la prise de sang)', 'En France, la majorité des gens sont insuffisants d’octobre à avril (soleil trop bas pour synthétiser la vitamine D).'];
    } else [status, dose, why] = ['optional', '1 000 UI/jour si peu d’exposition au soleil', 'Été + exposition au soleil : souvent pas nécessaire. À confirmer par la prise de sang.'];
    out.push({
      id: 'vitd',
      name: 'Vitamine D3 (+ K2)',
      status,
      evidence: 'A',
      dose,
      timing: ['matin'],
      form: 'D3 (cholécalciférol) en gouttes huileuses, idéalement associée à de la K2 MK-7 (75-100 µg) ; D3 issue de lichen si vegan',
      why: `${why} Rôle : immunité, os, force musculaire, humeur.`,
      cautions: 'À prendre avec un repas contenant du gras. Ne pas dépasser 4 000 UI/jour sans suivi médical.',
      costPerMonth: 2,
      category: 'base',
    });
  }

  // ——— Oméga-3 ———
  {
    const idx = b.omega3_index;
    const tg = b.triglycerides;
    const fish = Math.max(ctx.fattyFishMeals ?? 0, profile.fattyFishPerWeek);
    let status: SuppStatus = 'recommended';
    let dose = '1 à 2 g d’EPA+DHA/jour';
    let why = 'Cœur, cerveau, inflammation, et légère amélioration de la synthèse musculaire.';
    if (idx !== undefined && idx >= 8) [status, why] = ['optional', `Ton index oméga-3 est déjà optimal (${idx} %).`];
    else if (idx !== undefined) [status, dose, why] = ['essential', '2 g d’EPA+DHA/jour', `Index oméga-3 à ${idx} % (< 8 %) : objectif ≥ 8 %, recontrôle à 4 mois.`];
    else if (tg !== undefined && tg > 150) [status, dose, why] = ['recommended', '2 à 4 g d’EPA+DHA/jour (à valider avec ton médecin)', `Triglycérides élevés (${tg} mg/dL) : les oméga-3 à haute dose les font baisser de 20-30 %.`];
    else if (fish >= 2 && !plantBased) [status, why] = ['optional', `Tu manges ${fish} poissons gras/semaine : c’est l’idéal, le complément devient facultatif.`];
    out.push({
      id: 'omega3',
      name: plantBased ? 'Oméga-3 EPA/DHA (huile d’algues)' : 'Oméga-3 EPA/DHA',
      status,
      evidence: 'B',
      dose,
      timing: ['repas'],
      form: plantBased ? 'Huile d’algues (Schizochytrium)' : 'Huile de poisson forme triglycéride, certifiée IFOS/Friend of the Sea, conservée au frais',
      why,
      cautions: 'Avec anticoagulants : avis médical. Au-delà de 1 g/jour, légère hausse du risque de fibrillation atriale chez les personnes à risque cardiaque.',
      costPerMonth: 15,
      category: 'base',
    });
  }

  // ——— Protéine en poudre ———
  if (ctx.usesProteinPowder)
    out.push({
      id: 'protein',
      name: plantBased && profile.diet === 'vegan' ? 'Protéine végétale (pois/riz)' : 'Whey isolate',
      status: 'recommended',
      evidence: 'A',
      dose: 'Selon ton menu (déjà dans ta liste de courses)',
      timing: ['repas'],
      form: 'Isolat sans édulcorants douteux ; labels anti-dopage (Informed Sport) si compétition',
      why: 'Simple aliment pratique pour atteindre ta cible de protéines, levier n°1 pour garder/gagner du muscle.',
      category: 'base',
    });

  // ——— Magnésium ———
  {
    const low = b.magnesium !== undefined && b.magnesium < 0.85;
    const sleepy = profile.sleepQuality >= 3 || profile.stressLevel >= 4;
    out.push({
      id: 'magnesium',
      name: 'Magnésium bisglycinate',
      status: low ? 'recommended' : sleepy ? 'recommended' : 'optional',
      evidence: 'B',
      dose: '300 mg de magnésium élément/jour',
      timing: ['soir'],
      form: 'Bisglycinate ou citrate (évite l’oxyde, mal absorbé)',
      why: low ? `Magnésium à ${b.magnesium} mmol/L : sous l’optimal.` : 'Apports souvent insuffisants chez les sportifs (pertes par la sueur) ; peut aider l’endormissement et la récupération.',
      cautions: 'Insuffisance rénale : avis médical. Effet laxatif possible à forte dose.',
      costPerMonth: 8,
      category: 'santé',
    });
  }

  // ——— B12 ———
  {
    const v = b.b12;
    const hcy = b.homocysteine;
    let status: SuppStatus = 'not_needed';
    let dose = '—';
    let why = 'Apports suffisants via l’alimentation animale.';
    if (profile.diet === 'vegan') [status, dose, why] = ['essential', '50-100 µg/jour ou 2 000 µg une fois/semaine', 'Alimentation végétale : la B12 est indispensable (aucune source végétale fiable).'];
    else if (v !== undefined && v < 400) [status, dose, why] = ['recommended', '1 000 µg/jour pendant 3 mois puis recontrôle', `B12 à ${v} pg/mL : sous l’optimal (> 400).`];
    else if (hcy !== undefined && hcy > 12) [status, dose, why] = ['recommended', '1 000 µg/jour (dans un complexe B)', `Homocystéine à ${hcy} µmol/L.`];
    else if (profile.diet === 'vegetarian') [status, dose, why] = ['recommended', '50-100 µg/jour', 'Végétarien : apports souvent limites.'];
    else if (age >= 60) [status, dose, why] = ['recommended', '100 µg/jour', 'Après 60 ans, l’absorption de la B12 diminue.'];
    out.push({ id: 'b12', name: 'Vitamine B12', status, evidence: 'A', dose, timing: ['matin'], form: 'Cyanocobalamine ou méthylcobalamine', why, costPerMonth: 3, category: 'santé' });
  }

  // ——— Fer ———
  {
    const f = b.ferritin;
    const tsat = b.tsat;
    let status: SuppStatus = 'conditional';
    let dose = 'Uniquement si ferritine basse';
    let why = 'Ne jamais prendre de fer « au hasard » : l’excès est toxique (oxydation, foie). Fais d’abord doser la ferritine.';
    if ((f !== undefined && f > 150) || (tsat !== undefined && tsat > 45)) [status, dose, why] = ['avoid', 'Aucun', 'Réserves de fer pleines ou élevées : surtout pas de fer.'];
    else if (f !== undefined && f < 30) [status, dose, why] = ['essential', '25-50 mg de fer élément un jour sur deux', `Ferritine à ${f} µg/L : réserves basses. Recontrôle à 3 mois.`];
    else if (f !== undefined && f < 50) [status, dose, why] = ['recommended', '25 mg un jour sur deux pendant 3 mois', `Ferritine à ${f} µg/L : sous l’optimal pour un sportif (> 50).`];
    else if (f !== undefined) [status, dose, why] = ['not_needed', '—', `Ferritine à ${f} µg/L : réserves correctes.`];
    out.push({
      id: 'iron',
      name: 'Fer (bisglycinate)',
      status,
      evidence: 'A',
      dose,
      timing: ['jeun'],
      form: 'Bisglycinate de fer, avec un peu de vitamine C (kiwi, orange) ; à 2 h du café, thé, calcium et zinc',
      why: `${why} La prise un jour sur deux est mieux absorbée (hepcidine).`,
      costPerMonth: 5,
      category: 'santé',
    });
  }

  // ——— Complexe B / méthylfolate ———
  if ((b.homocysteine ?? 0) > 10 || (b.folate !== undefined && b.folate < 8))
    out.push({
      id: 'bcomplex',
      name: 'Complexe B avec méthylfolate',
      status: 'recommended',
      evidence: 'B',
      dose: '1 gélule/jour (≈ 400 µg méthylfolate, B6, B12)',
      timing: ['matin'],
      form: 'Formes actives (5-MTHF, P5P, méthylcobalamine)',
      why: `Homocystéine/folates hors zone optimale : un complexe B les normalise en 2-3 mois.`,
      costPerMonth: 8,
      category: 'santé',
    });

  // ——— Zinc ———
  if ((b.zinc !== undefined && b.zinc < 80) || profile.diet === 'vegan' || (b.testosterone !== undefined && profile.sex === 'male' && b.testosterone < 4))
    out.push({
      id: 'zinc',
      name: 'Zinc (bisglycinate/picolinate)',
      status: b.zinc !== undefined && b.zinc < 80 ? 'recommended' : 'conditional',
      evidence: 'B',
      dose: '15-25 mg/jour pendant 2-3 mois, puis recontrôle',
      timing: ['repas'],
      form: 'Bisglycinate ou picolinate, loin du fer',
      why: b.zinc !== undefined && b.zinc < 80 ? `Zinc à ${b.zinc} µg/dL.` : 'Alimentation végétale ou testostérone basse : le zinc vaut d’être dosé.',
      cautions: 'Pas plus de 40 mg/jour au long cours (fait baisser le cuivre).',
      costPerMonth: 5,
      category: 'santé',
    });

  // ——— Iode ———
  if (profile.diet === 'vegan' || (profile.allergens.includes('lactose') && profile.allergens.includes('fish')))
    out.push({
      id: 'iodine',
      name: 'Iode',
      status: 'recommended',
      evidence: 'B',
      dose: '150 µg/jour (ou sel iodé au quotidien)',
      timing: ['matin'],
      form: 'Iodure de potassium (évite les algues dont la teneur est imprévisible)',
      why: 'Sans poisson ni laitages, les apports en iode (thyroïde) sont souvent trop faibles.',
      cautions: 'Maladie thyroïdienne : avis médical.',
      costPerMonth: 3,
      category: 'santé',
    });

  // ——— Psyllium ———
  {
    const lipids = (b.apob ?? 0) > 0.8 || (b.ldl ?? 0) > 100;
    out.push({
      id: 'psyllium',
      name: 'Psyllium blond (fibres solubles)',
      status: lipids ? 'recommended' : 'optional',
      evidence: 'A',
      dose: lipids ? '10 g/jour (5 g avant 2 repas, dans un grand verre d’eau)' : '5 g/jour si tu manques de fibres',
      timing: ['repas'],
      form: 'Téguments de psyllium blond en poudre',
      why: lipids ? 'ApoB/LDL au-dessus de l’optimal : le psyllium les baisse de ~7-10 % et améliore la glycémie.' : 'Aide à atteindre 30-40 g de fibres/jour (microbiote, transit, cholestérol).',
      cautions: 'Augmenter progressivement, boire beaucoup. À 2 h des médicaments.',
      costPerMonth: 6,
      category: 'santé',
    });
  }

  // ——— Caféine ———
  out.push({
    id: 'caffeine',
    name: 'Caféine (café ou comprimé)',
    status: profile.sleepQuality >= 4 ? 'not_needed' : 'optional',
    evidence: 'A',
    dose: `${Math.round((3 * weightKg) / 10) * 10} mg (≈ 3 mg/kg) 45-60 min avant la séance`,
    timing: ['pre'],
    form: 'Un double espresso ≈ 120-150 mg',
    why: 'Améliore la force, l’endurance et la concentration de 2-5 %.',
    cautions: 'Jamais après 14 h : la caféine dégrade le sommeil profond même si tu t’endors.',
    category: 'performance',
  });

  // ——— Bêta-alanine ———
  out.push({
    id: 'beta_alanine',
    name: 'Bêta-alanine',
    status: 'optional',
    evidence: 'A',
    dose: '3,2-6,4 g/jour fractionnés',
    timing: ['repas'],
    form: 'Poudre ou forme à libération prolongée (moins de picotements)',
    why: 'Utile pour les efforts de 1 à 4 min (séries longues, crossfit, sports de combat). Peu d’intérêt pour l’hypertrophie pure.',
    cautions: 'Picotements inoffensifs (paresthésies).',
    costPerMonth: 10,
    category: 'performance',
  });

  // ——— Glycine ———
  out.push({
    id: 'glycine',
    name: 'Glycine',
    status: profile.sleepQuality >= 3 ? 'optional' : 'not_needed',
    evidence: 'C',
    dose: '3 g, 30-60 min avant le coucher',
    timing: ['soir'],
    form: 'Poudre (goût sucré)',
    why: 'Petites études : endormissement plus rapide et meilleure qualité de sommeil subjective.',
    costPerMonth: 5,
    category: 'santé',
  });

  // ——— Ashwagandha ———
  if (profile.stressLevel >= 4)
    out.push({
      id: 'ashwagandha',
      name: 'Ashwagandha (KSM-66)',
      status: 'conditional',
      evidence: 'B',
      dose: '600 mg/jour pendant 8 semaines, puis pause',
      timing: ['soir'],
      form: 'Extrait de racine standardisé KSM-66 ou Sensoril',
      why: 'Baisse du stress perçu et du cortisol dans plusieurs essais ; petit effet sur la force.',
      cautions: 'Déconseillé : grossesse, hyperthyroïdie, maladie auto-immune, maladie du foie (rares atteintes hépatiques rapportées). Interagit avec sédatifs et traitements thyroïdiens.',
      costPerMonth: 12,
      category: 'santé',
    });

  // ——— Berbérine ———
  {
    const homa = b.glucose && b.insulin ? (b.glucose * b.insulin) / 405 : undefined;
    if ((b.hba1c ?? 0) >= 5.7 || (homa ?? 0) > 2.5 || (b.glucose ?? 0) >= 100)
      out.push({
        id: 'berberine',
        name: 'Berbérine',
        status: 'conditional',
        evidence: 'B',
        dose: '500 mg 2 à 3×/jour au début des repas',
        timing: ['repas'],
        form: 'Berbérine HCl',
        why: 'Ta glycémie/insuline sont au-dessus de l’optimal : la berbérine améliore la sensibilité à l’insuline (effet proche de la metformine, plus modeste).',
        cautions: 'À valider avec ton médecin : nombreuses interactions médicamenteuses, troubles digestifs. La priorité reste la perte de gras viscéral et la musculation.',
        costPerMonth: 15,
        category: 'santé',
      });
  }

  // ——— Collagène ———
  out.push({
    id: 'collagen',
    name: 'Peptides de collagène + vitamine C',
    status: 'optional',
    evidence: 'C',
    dose: '10-15 g/jour (+ 50 mg de vitamine C), 30-60 min avant une séance pour les tendons',
    timing: ['pre'],
    form: 'Peptides hydrolysés (types I/III), sans sucre ajouté',
    why: 'Méta-analyses : amélioration modeste de l’élasticité et de l’hydratation de la peau ; intérêt pour les tendons combiné au travail de force. Ne compte pas dans tes protéines « muscle » (pauvre en leucine).',
    costPerMonth: 20,
    category: 'peau & articulations',
  });

  // ——— Multivitamines ———
  if (age >= 60)
    out.push({
      id: 'multivitamin',
      name: 'Multivitamines à doses nutritionnelles',
      status: 'optional',
      evidence: 'B',
      dose: '1/jour',
      timing: ['matin'],
      form: 'Doses ≈ 100 % des apports recommandés (pas de méga-doses)',
      why: 'Essais COSMOS : léger bénéfice sur la mémoire après 60 ans.',
      costPerMonth: 6,
      category: 'santé',
    });

  // ——— Longévité : expérimental ———
  out.push({
    id: 'urolithin_a',
    name: 'Urolithine A',
    status: age >= 40 ? 'optional' : 'not_needed',
    evidence: 'C',
    dose: '500-1 000 mg/jour',
    timing: ['matin'],
    form: 'Urolithine A purifiée (Mitopure®)',
    why: 'Stimule le renouvellement des mitochondries (mitophagie) ; essais humains : meilleure endurance musculaire chez les 40-65 ans. Prometteur mais cher et encore peu de recul.',
    cautions: 'Expérimental : à considérer seulement si tout le reste est en place.',
    costPerMonth: 60,
    category: 'longévité (expérimental)',
  });
  out.push({
    id: 'taurine',
    name: 'Taurine',
    status: 'optional',
    evidence: 'C',
    dose: '1-3 g/jour',
    timing: ['repas'],
    form: 'Poudre',
    why: 'Étude Science 2023 : la supplémentation allonge la vie chez l’animal et le taux baisse avec l’âge chez l’humain. Données humaines encore limitées, mais très sûre et peu chère.',
    costPerMonth: 4,
    category: 'longévité (expérimental)',
  });
  out.push({
    id: 'nmn',
    name: 'NMN / NR (précurseurs de NAD+)',
    status: 'not_needed',
    evidence: 'C',
    dose: '—',
    timing: ['matin'],
    form: '—',
    why: 'Font bien monter le NAD+ sanguin, mais les essais humains ne montrent pas de bénéfice clair sur la santé ou les performances à ce jour. Ton argent est mieux investi ailleurs.',
    category: 'longévité (expérimental)',
  });
  out.push({
    id: 'antioxidants',
    name: 'Vitamine C (1 g) + E (400 UI) à haute dose',
    status: 'avoid',
    evidence: 'B',
    dose: '—',
    timing: ['repas'],
    form: '—',
    why: 'Pris autour de l’entraînement, les antioxydants à haute dose freinent les adaptations (mitochondries, sensibilité à l’insuline). Mieux vaut les fruits et légumes.',
    category: 'performance',
  });
  out.push({
    id: 'useless',
    name: 'BCAA, « boosters de testostérone », brûleurs de graisse',
    status: 'avoid',
    evidence: 'A',
    dose: '—',
    timing: ['repas'],
    form: '—',
    why: 'BCAA inutiles si tu atteins tes protéines ; tribulus & co n’augmentent pas la testostérone ; les brûleurs de graisse sont au mieux de la caféine chère, au pire dangereux.',
    category: 'performance',
  });

  const order: SuppStatus[] = ['essential', 'recommended', 'conditional', 'optional', 'not_needed', 'avoid'];
  return out.sort((a, c) => order.indexOf(a.status) - order.indexOf(c.status));
}

export function activeStack(recs: SupplementRec[]): SupplementRec[] {
  return recs.filter((r) => r.status === 'essential' || r.status === 'recommended');
}

export function dailySchedule(recs: SupplementRec[]): { timing: Timing; items: SupplementRec[] }[] {
  const order: Timing[] = ['jeun', 'matin', 'repas', 'pre', 'soir'];
  return order
    .map((t) => ({ timing: t, items: recs.filter((r) => r.timing[0] === t) }))
    .filter((g) => g.items.length > 0);
}
