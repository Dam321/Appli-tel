// Marqueurs sanguins : plages de référence (laboratoire) et plages « optimales »
// (longévité / performance, plus strictes, issues de la littérature récente).
// ⚠️ Outil d'aide à la discussion avec ton médecin, pas un diagnostic.
import type { BloodPanel, Sex } from './types';

export type Range = [number, number];

export interface UnitOption {
  unit: string;
  /** valeur canonique = toCanonical(valeur saisie) */
  toCanonical: (v: number) => number;
}

export interface Marker {
  id: string;
  name: string;
  short: string;
  category: string;
  unit: string;
  altUnits?: UnitOption[];
  ref: Record<Sex, Range>;
  optimal: Record<Sex, Range>;
  essential: boolean;
  what: string;
  low?: string;
  high?: string;
  note?: string;
}

const mul = (unit: string, k: number): UnitOption => ({ unit, toCanonical: (v) => v * k });
const both = (r: Range): Record<Sex, Range> => ({ male: r, female: r });
const INF = 1e9;

export const CATEGORIES = [
  'Fer & globules rouges',
  'Vitamines & minéraux',
  'Glycémie & insuline',
  'Lipides & risque cardiovasculaire',
  'Inflammation',
  'Foie',
  'Reins',
  'Thyroïde',
  'Hormones',
];

export const MARKERS: Marker[] = [
  // ——— Fer & globules rouges ———
  { id: 'ferritin', name: 'Ferritine', short: 'Ferritine', category: 'Fer & globules rouges', unit: 'µg/L', altUnits: [mul('ng/mL', 1)], ref: { male: [30, 300], female: [15, 150] }, optimal: { male: [50, 150], female: [50, 150] }, essential: true, what: 'Réserves de fer. Clé pour l’énergie, l’endurance, les cheveux.', low: 'Réserves basses : fatigue, baisse de performance, chute de cheveux même sans anémie. Fer en bisglycinate un jour sur deux (voir compléments) + recontrôle à 3 mois.', high: 'Peut refléter une inflammation, une surcharge (hémochromatose), l’alcool ou une stéatose. Ne JAMAIS supplémenter en fer ; vérifier le coefficient de saturation et en parler au médecin.' },
  { id: 'tsat', name: 'Coefficient de saturation de la transferrine', short: 'CST', category: 'Fer & globules rouges', unit: '%', ref: { male: [20, 45], female: [15, 45] }, optimal: both([25, 40]), essential: false, what: 'Part du transporteur de fer occupée.', low: 'Fer disponible insuffisant.', high: '> 45 % : dépistage d’hémochromatose (génétique HFE) à discuter.' },
  { id: 'hemoglobin', name: 'Hémoglobine', short: 'Hb', category: 'Fer & globules rouges', unit: 'g/dL', altUnits: [mul('g/L', 0.1), mul('mmol/L', 1.611)], ref: { male: [13, 17.5], female: [12, 16] }, optimal: { male: [14, 16.5], female: [12.5, 15] }, essential: true, what: 'Transport de l’oxygène.', low: 'Anémie : rechercher la cause (fer, B12, folates…) avec le médecin.', high: 'Déshydratation, tabac, apnée du sommeil, testostérone exogène… à explorer.' },
  { id: 'mcv', name: 'Volume globulaire moyen', short: 'VGM', category: 'Fer & globules rouges', unit: 'fL', ref: both([80, 100]), optimal: both([82, 95]), essential: true, what: 'Taille des globules rouges.', low: 'Petits globules : souvent manque de fer.', high: 'Gros globules : manque de B12/folates, alcool.' },

  // ——— Vitamines & minéraux ———
  { id: 'vitd', name: 'Vitamine D (25-OH)', short: 'Vit. D', category: 'Vitamines & minéraux', unit: 'ng/mL', altUnits: [mul('nmol/L', 0.4006)], ref: both([30, 100]), optimal: both([40, 60]), essential: true, what: 'Immunité, os, muscles, humeur. Très souvent basse en France d’octobre à avril.', low: '< 20 : carence (le médecin peut prescrire des ampoules). 20-40 : supplémenter D3 au quotidien (dose dans l’onglet compléments).', high: '> 100 : risque de toxicité, arrêter la supplémentation.' },
  { id: 'b12', name: 'Vitamine B12', short: 'B12', category: 'Vitamines & minéraux', unit: 'pg/mL', altUnits: [mul('pmol/L', 1.355)], ref: both([200, 900]), optimal: both([400, 900]), essential: true, what: 'Nerfs, globules rouges, énergie. Indispensable à supplémenter si alimentation végétale.', low: '< 300 : zone grise, vérifier homocystéine ; supplémenter.', high: 'Souvent due à une supplémentation ; sinon à signaler au médecin.' },
  { id: 'folate', name: 'Folates (vitamine B9) sériques', short: 'B9', category: 'Vitamines & minéraux', unit: 'ng/mL', altUnits: [mul('nmol/L', 0.4413)], ref: both([4, 20]), optimal: both([8, 20]), essential: false, what: 'Synthèse de l’ADN, homocystéine.', low: 'Plus de légumes verts à feuilles, légumineuses ; complément si homocystéine élevée.' },
  { id: 'omega3_index', name: 'Index oméga-3 (EPA+DHA érythrocytaire)', short: 'Index ω-3', category: 'Vitamines & minéraux', unit: '%', ref: both([4, 15]), optimal: both([8, 12]), essential: false, what: 'Part d’EPA+DHA dans les membranes. ≥ 8 % associé au plus faible risque cardiovasculaire (test en labo spécialisé ou kit à domicile).', low: '< 8 % : 2-3 poissons gras/semaine + 1-2 g d’EPA+DHA/jour, recontrôle à 4 mois.' },
  { id: 'magnesium', name: 'Magnésium sérique', short: 'Mg', category: 'Vitamines & minéraux', unit: 'mmol/L', altUnits: [mul('mg/L', 0.04114), mul('mg/dL', 0.4114)], ref: both([0.75, 1.0]), optimal: both([0.85, 1.0]), essential: false, what: 'Muscles, sommeil, glycémie. Le sérique reflète mal les réserves (le Mg érythrocytaire est plus fiable).', low: 'Bisglycinate de magnésium le soir.' },
  { id: 'zinc', name: 'Zinc', short: 'Zn', category: 'Vitamines & minéraux', unit: 'µg/dL', altUnits: [mul('µmol/L', 6.54)], ref: both([70, 120]), optimal: both([80, 120]), essential: false, what: 'Immunité, testostérone, peau, cicatrisation.', low: 'Graines de courge, viande, fruits de mer ; complément 15-25 mg sur 2-3 mois.' },

  // ——— Glycémie ———
  { id: 'glucose', name: 'Glycémie à jeun', short: 'Glycémie', category: 'Glycémie & insuline', unit: 'mg/dL', altUnits: [mul('g/L', 100), mul('mmol/L', 18.016)], ref: both([70, 109]), optimal: both([72, 92]), essential: true, what: 'Sucre sanguin à jeun.', low: 'Hypoglycémie : à signaler si symptômes.', high: '≥ 1,00 g/L : glycémie limite (prédiabète selon l’ADA dès 1,00, OMS dès 1,10). Musculation, zone 2, perte de gras viscéral, fibres.' },
  { id: 'hba1c', name: 'Hémoglobine glyquée', short: 'HbA1c', category: 'Glycémie & insuline', unit: '%', altUnits: [{ unit: 'mmol/mol', toCanonical: (v) => v * 0.09148 + 2.152 }], ref: both([4, 5.6]), optimal: both([4.5, 5.3]), essential: true, what: 'Moyenne de la glycémie sur ~3 mois.', high: '5,7-6,4 % : prédiabète. Priorité : perdre le gras viscéral, musculation, marche après les repas, fibres.' },
  { id: 'insulin', name: 'Insuline à jeun', short: 'Insuline', category: 'Glycémie & insuline', unit: 'µUI/mL', altUnits: [mul('mUI/L', 1), mul('pmol/L', 0.144)], ref: both([2, 25]), optimal: both([2, 8]), essential: false, what: 'Détecte la résistance à l’insuline des années avant la glycémie.', high: 'Résistance à l’insuline probable (voir HOMA-IR).' },

  // ——— Lipides ———
  { id: 'apob', name: 'Apolipoprotéine B', short: 'ApoB', category: 'Lipides & risque cardiovasculaire', unit: 'g/L', altUnits: [mul('mg/dL', 0.01)], ref: both([0, 1.0]), optimal: both([0, 0.8]), essential: true, what: 'Nombre de particules athérogènes : meilleur marqueur du risque cardiovasculaire que le LDL.', high: 'Fibres solubles (psyllium, avoine), moins de graisses saturées, perte de gras. Si persistant, discuter d’un traitement avec le médecin (le risque est cumulatif sur la vie).' },
  { id: 'ldl', name: 'LDL-cholestérol', short: 'LDL', category: 'Lipides & risque cardiovasculaire', unit: 'mg/dL', altUnits: [mul('g/L', 100), mul('mmol/L', 38.67)], ref: both([0, 130]), optimal: both([0, 100]), essential: true, what: '« Mauvais » cholestérol.', high: 'Même stratégie que l’ApoB.' },
  { id: 'hdl', name: 'HDL-cholestérol', short: 'HDL', category: 'Lipides & risque cardiovasculaire', unit: 'mg/dL', altUnits: [mul('g/L', 100), mul('mmol/L', 38.67)], ref: { male: [40, INF], female: [50, INF] }, optimal: { male: [50, 90], female: [60, 100] }, essential: true, what: '« Bon » cholestérol.', low: 'Activité physique, perte de gras, arrêt du tabac.' },
  { id: 'triglycerides', name: 'Triglycérides', short: 'TG', category: 'Lipides & risque cardiovasculaire', unit: 'mg/dL', altUnits: [mul('g/L', 100), mul('mmol/L', 88.57)], ref: both([0, 150]), optimal: both([0, 100]), essential: true, what: 'Graisses sanguines, très sensibles au sucre, à l’alcool et au gras viscéral.', high: 'Moins de sucres rapides et d’alcool, oméga-3, perte de gras.' },
  { id: 'cholesterol', name: 'Cholestérol total', short: 'CT', category: 'Lipides & risque cardiovasculaire', unit: 'mg/dL', altUnits: [mul('g/L', 100), mul('mmol/L', 38.67)], ref: both([0, 200]), optimal: both([130, 190]), essential: true, what: 'Somme des fractions.' },
  { id: 'lpa', name: 'Lipoprotéine (a)', short: 'Lp(a)', category: 'Lipides & risque cardiovasculaire', unit: 'nmol/L', altUnits: [mul('mg/dL (≈)', 2.15)], ref: both([0, 75]), optimal: both([0, 75]), essential: false, what: 'Facteur de risque génétique, à mesurer UNE fois dans sa vie.', high: '> 125 nmol/L : risque élevé, non modifiable par le mode de vie → objectif ApoB/LDL encore plus bas, suivi médical.' },

  // ——— Inflammation ———
  { id: 'crp', name: 'CRP ultrasensible', short: 'CRPus', category: 'Inflammation', unit: 'mg/L', ref: both([0, 3]), optimal: both([0, 1]), essential: true, what: 'Inflammation de bas grade (risque cardiovasculaire).', high: 'Vérifie qu’il n’y avait pas d’infection ou de séance très intense dans les 72 h. Sinon : sommeil, perte de gras viscéral, oméga-3, aliments ultra-transformés à éviter.' },
  { id: 'homocysteine', name: 'Homocystéine', short: 'Hcy', category: 'Inflammation', unit: 'µmol/L', ref: both([5, 15]), optimal: both([5, 9]), essential: false, what: 'Reflet du statut B9/B12/B6, marqueur de risque cardiovasculaire et cognitif.', high: 'Complexe B avec méthylfolate + B12 ; recontrôle à 3 mois.' },

  // ——— Foie ———
  { id: 'alt', name: 'ALAT (transaminases)', short: 'ALAT', category: 'Foie', unit: 'UI/L', ref: { male: [0, 45], female: [0, 35] }, optimal: { male: [0, 30], female: [0, 22] }, essential: true, what: 'Santé du foie (stéatose, alcool).', high: 'Attention : la musculation intense dans les 48-72 h élève ALAT/ASAT. Sinon : alcool, stéatose (gras abdominal), médicaments.' },
  { id: 'ast', name: 'ASAT', short: 'ASAT', category: 'Foie', unit: 'UI/L', ref: both([0, 40]), optimal: both([0, 30]), essential: false, what: 'Foie et muscles.' },
  { id: 'ggt', name: 'Gamma-GT', short: 'GGT', category: 'Foie', unit: 'UI/L', ref: { male: [0, 55], female: [0, 38] }, optimal: { male: [0, 25], female: [0, 20] }, essential: true, what: 'Sensible à l’alcool et au stress oxydatif.', high: 'Réduire l’alcool en priorité.' },

  // ——— Reins ———
  { id: 'creatinine', name: 'Créatinine', short: 'Créat.', category: 'Reins', unit: 'µmol/L', altUnits: [mul('mg/L', 8.84), mul('mg/dL', 88.4)], ref: { male: [60, 110], female: [45, 90] }, optimal: { male: [60, 110], female: [45, 90] }, essential: true, what: 'Fonction rénale.', high: 'Normal d’être un peu haut si tu es musclé ou prends de la créatine : demande la cystatine C pour trancher.' },
  { id: 'egfr', name: 'DFG estimé', short: 'DFG', category: 'Reins', unit: 'mL/min/1,73 m²', ref: both([60, INF]), optimal: both([90, INF]), essential: true, what: 'Filtration rénale estimée.', low: '60-89 : légère baisse, souvent sous-estimée chez les personnes musclées ou sous créatine : contrôler avec la cystatine C. < 60 : avis médical.' },
  { id: 'cystatin_c', name: 'Cystatine C', short: 'Cyst. C', category: 'Reins', unit: 'mg/L', ref: both([0.6, 1.0]), optimal: both([0.6, 0.9]), essential: false, what: 'Fonction rénale indépendante de la masse musculaire.' },
  { id: 'uric_acid', name: 'Acide urique', short: 'Ac. urique', category: 'Reins', unit: 'µmol/L', altUnits: [mul('mg/L', 5.948), mul('mg/dL', 59.48)], ref: { male: [200, 420], female: [140, 360] }, optimal: { male: [200, 350], female: [140, 300] }, essential: false, what: 'Goutte, risque métabolique.', high: 'Réduire alcool (bière), sodas/fructose ; hydratation.' },

  // ——— Thyroïde ———
  { id: 'tsh', name: 'TSH', short: 'TSH', category: 'Thyroïde', unit: 'mUI/L', ref: both([0.4, 4.0]), optimal: both([0.5, 2.5]), essential: true, what: 'Pilotage de la thyroïde (métabolisme, énergie, poids).', high: 'Hypothyroïdie possible : demander T4L et anticorps anti-TPO. Arrêter la biotine 48 h avant la prise de sang.', low: 'Hyperthyroïdie possible : consulter.' },
  { id: 'ft4', name: 'T4 libre', short: 'T4L', category: 'Thyroïde', unit: 'pmol/L', altUnits: [mul('ng/dL', 12.87)], ref: both([10, 22]), optimal: both([12, 20]), essential: false, what: 'Hormone thyroïdienne.' },

  // ——— Hormones ———
  { id: 'testosterone', name: 'Testostérone totale', short: 'Testo', category: 'Hormones', unit: 'ng/mL', altUnits: [mul('nmol/L', 0.2884), mul('ng/dL', 0.01)], ref: { male: [3.0, 10], female: [0.1, 0.6] }, optimal: { male: [5, 9], female: [0.2, 0.5] }, essential: true, what: 'Muscle, libido, énergie, humeur. Prélèvement entre 7 h et 10 h.', low: 'Sommeil (≥ 7 h), perte de gras, déficit calorique pas trop agressif, zinc/vit. D si bas. Si < 3 ng/mL avec symptômes : bilan médical.' },
  { id: 'shbg', name: 'SHBG', short: 'SHBG', category: 'Hormones', unit: 'nmol/L', ref: { male: [18, 54], female: [18, 144] }, optimal: { male: [20, 50], female: [30, 100] }, essential: false, what: 'Transporteur des hormones sexuelles (détermine la testostérone libre).', low: 'Souvent associée à la résistance à l’insuline.' },
  { id: 'estradiol', name: 'Estradiol', short: 'E2', category: 'Hormones', unit: 'pg/mL', altUnits: [mul('pmol/L', 0.2724)], ref: { male: [10, 40], female: [20, 400] }, optimal: { male: [20, 35], female: [20, 400] }, essential: false, what: 'Chez l’homme : os, libido, santé cardiovasculaire. Chez la femme : varie selon le cycle.' },
];

export const MARKER_BY_ID: Record<string, Marker> = Object.fromEntries(MARKERS.map((m) => [m.id, m]));

export type MarkerStatus = 'optimal' | 'borderline_low' | 'borderline_high' | 'low' | 'high';

export const STATUS_LABEL: Record<MarkerStatus, string> = {
  optimal: 'Optimal',
  borderline_low: 'Normal mais bas',
  borderline_high: 'Normal mais haut',
  low: 'Bas (hors norme)',
  high: 'Élevé (hors norme)',
};

export function markerStatus(m: Marker, sex: Sex, v: number): MarkerStatus {
  const [rlo, rhi] = m.ref[sex];
  const [olo, ohi] = m.optimal[sex];
  if (v < rlo) return 'low';
  if (v > rhi) return 'high';
  if (v < olo) return 'borderline_low';
  if (v > ohi) return 'borderline_high';
  return 'optimal';
}

export function formatRange(r: Range): string {
  const f = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  if (r[1] >= INF) return `≥ ${f(r[0])}`;
  if (r[0] <= 0) return `< ${f(r[1])}`;
  return `${f(r[0])} – ${f(r[1])}`;
}

/** Dernière valeur connue de chaque marqueur, toutes prises de sang confondues */
export function latestBlood(panels: BloodPanel[]): Record<string, { value: number; date: string }> {
  const out: Record<string, { value: number; date: string }> = {};
  for (const p of panels.slice().sort((a, b) => a.date.localeCompare(b.date)))
    for (const [k, v] of Object.entries(p.values)) if (typeof v === 'number' && !Number.isNaN(v)) out[k] = { value: v, date: p.date };
  return out;
}

export interface DerivedMetric {
  name: string;
  value: number;
  unit: string;
  verdict: string;
  tone: 'good' | 'warning' | 'serious';
}

export function derivedMetrics(values: Record<string, number>): DerivedMetric[] {
  const out: DerivedMetric[] = [];
  if (values.glucose && values.insulin) {
    const homa = (values.glucose * values.insulin) / 405;
    out.push({
      name: 'HOMA-IR (résistance à l’insuline)',
      value: Math.round(homa * 100) / 100,
      unit: '',
      verdict: homa < 1.5 ? 'Excellente sensibilité à l’insuline' : homa < 2.5 ? 'Début de résistance à l’insuline' : 'Résistance à l’insuline : priorité perte de gras viscéral + musculation',
      tone: homa < 1.5 ? 'good' : homa < 2.5 ? 'warning' : 'serious',
    });
  }
  if (values.triglycerides && values.hdl) {
    const r = values.triglycerides / values.hdl;
    out.push({
      name: 'Ratio TG / HDL',
      value: Math.round(r * 100) / 100,
      unit: '',
      verdict: r < 1.5 ? 'Profil métabolique favorable' : r < 2.5 ? 'Intermédiaire' : 'Évocateur de résistance à l’insuline',
      tone: r < 1.5 ? 'good' : r < 2.5 ? 'warning' : 'serious',
    });
  }
  if (values.cholesterol && values.hdl) {
    const nonHdl = values.cholesterol - values.hdl;
    out.push({
      name: 'Cholestérol non-HDL',
      value: Math.round(nonHdl),
      unit: 'mg/dL',
      verdict: nonHdl < 130 ? 'Bon' : nonHdl < 160 ? 'À surveiller' : 'Élevé',
      tone: nonHdl < 130 ? 'good' : nonHdl < 160 ? 'warning' : 'serious',
    });
  }
  return out;
}

/** Texte prêt à montrer au médecin / au labo */
export function prescriptionText(sex: Sex, age: number): string {
  const essential = MARKERS.filter((m) => m.essential && !(m.id === 'testosterone' && sex === 'female' && age < 45));
  const extra = MARKERS.filter((m) => !m.essential && !(m.id === 'estradiol' && sex === 'female'));
  return [
    'Bilan sanguin de prévention – demande au médecin traitant',
    '',
    'Essentiel :',
    ...essential.map((m) => `• ${m.name}`),
    '',
    'Complémentaire (si possible) :',
    ...extra.map((m) => `• ${m.name}${m.id === 'lpa' ? ' (une fois dans la vie)' : ''}${m.id === 'omega3_index' ? ' (labo spécialisé / kit, non remboursé)' : ''}`),
    '',
    'Conditions de prélèvement :',
    '• À jeun depuis 10-12 h (eau autorisée), le matin entre 7 h et 10 h',
    '• Pas de musculation ni de sport intense 48-72 h avant (sinon ALAT/ASAT, CK, CRP faussés)',
    '• Pas d’alcool 48 h avant',
    '• Arrêter la biotine (vitamine B8) 48 h avant (fausse la TSH)',
    '• Bien hydraté, ne pas être malade',
    '• Créatine : la signaler (élève la créatinine)',
  ].join('\n');
}
