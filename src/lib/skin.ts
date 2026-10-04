// Peau, cheveux, dents : routine personnalisée selon ton type de peau et tes
// objectifs, avec le niveau de preuve de chaque actif. Types de produits, pas de marques.
import type { Profile } from './types';

export interface RoutineStep {
  product: string;
  detail: string;
  evidence: 'A' | 'B' | 'C';
  /** Sur prescription médicale */
  rx?: boolean;
}

export interface SkinPlan {
  am: RoutineStep[];
  pm: RoutineStep[];
  weekly: RoutineStep[];
  hair: RoutineStep[];
  teeth: RoutineStep[];
  lifestyle: string[];
  notes: string[];
}

export function skinPlan(p: Profile): SkinPlan {
  const pregnant = p.femaleStatus === 'pregnant' || p.femaleStatus === 'breastfeeding';
  const c = new Set(p.skinConcerns);
  const oily = p.skinType === 'oily' || p.skinType === 'combination';
  const dry = p.skinType === 'dry';
  const sensitive = p.skinType === 'sensitive';
  const notes: string[] = [];
  const am: RoutineStep[] = [];
  const pm: RoutineStep[] = [];
  const weekly: RoutineStep[] = [];

  am.push({
    product: oily ? 'Gel nettoyant doux' : 'Eau ou crème lavante douce',
    detail: oily ? 'Sans savon, pH proche de la peau.' : 'Le matin, un rinçage à l’eau suffit souvent.',
    evidence: 'B',
  });
  if ((c.has('aging') || c.has('pigmentation') || c.has('dark_circles')) && !sensitive)
    am.push({ product: 'Sérum vitamine C 10-15 % (acide L-ascorbique)', detail: 'Antioxydant, éclat, renforce l’effet de la crème solaire. À conserver au frais, à l’abri de la lumière.', evidence: 'B' });
  else if (c.has('aging') || c.has('pigmentation'))
    am.push({ product: 'Vitamine C douce (ascorbyl glucoside)', detail: 'Version mieux tolérée par les peaux sensibles.', evidence: 'C' });
  if (c.has('pores') || c.has('redness') || c.has('acne') || oily)
    am.push({ product: 'Niacinamide 4-5 %', detail: 'Pores, sébum, rougeurs, barrière cutanée. Très bien toléré.', evidence: 'B' });
  if (c.has('acne') && !pregnant) am.push({ product: 'Peroxyde de benzoyle 2,5-5 % (en zones)', detail: 'Antibactérien de référence contre l’acné, à appliquer fin. Décolore le linge.', evidence: 'A' });
  am.push({
    product: oily ? 'Fluide hydratant léger non comédogène' : dry ? 'Crème riche aux céramides' : 'Crème hydratante simple, sans parfum',
    detail: 'Garde la barrière cutanée intacte, surtout avec un rétinoïde.',
    evidence: 'B',
  });
  am.push({
    product: c.has('pigmentation') ? 'Crème solaire SPF 50+ teintée' : 'Crème solaire SPF 50+',
    detail: `${c.has('pigmentation') ? 'La teinte (oxydes de fer) protège aussi de la lumière visible qui aggrave les taches. ' : ''}Tous les matins, même en hiver ; à renouveler toutes les 2 h dehors. Le soin anti-âge le plus prouvé.`,
    evidence: 'A',
  });

  pm.push({ product: 'Démaquillant huile ou baume, puis nettoyant doux', detail: 'Double nettoyage les jours de crème solaire ou de maquillage.', evidence: 'C' });
  const wantsRetinoid = c.has('aging') || c.has('pigmentation') || c.has('acne') || c.has('pores');
  if (wantsRetinoid && !pregnant) {
    if (c.has('acne'))
      pm.push({ product: 'Adapalène 0,1 % ou trétinoïne', detail: 'Rétinoïdes de référence contre l’acné et le vieillissement, sur ordonnance du médecin ou du dermatologue.', evidence: 'A', rx: true });
    else
      pm.push({ product: 'Rétinal 0,05-0,1 % (vente libre) ou trétinoïne 0,025 % (prescription)', detail: 'Le seul actif anti-rides prouvé par de nombreux essais : collagène, texture, taches.', evidence: 'A' });
    notes.push(
      `Rétinoïde : semaines 1-2 deux soirs par semaine, semaines 3-4 un soir sur deux, puis tous les soirs si ta peau tolère.${sensitive || dry ? ' Peau sensible/sèche : applique-le entre deux couches de crème (méthode sandwich).' : ''} Rougeurs et légère desquamation au début = normal.`,
    );
  } else if (wantsRetinoid && pregnant) notes.push('Grossesse / allaitement : pas de rétinoïdes. L’acide azélaïque et la niacinamide sont les alternatives sûres.');
  if (c.has('redness') || c.has('pigmentation') || (c.has('acne') && pregnant))
    pm.push({ product: 'Acide azélaïque 10-15 %', detail: 'Rougeurs, taches, acné ; compatible grossesse. Les soirs sans rétinoïde au début.', evidence: 'B' });
  if (c.has('dark_circles'))
    pm.push({ product: 'Contour des yeux hydratant', detail: 'Les cernes dépendent surtout du sommeil, des allergies (à traiter) et de la génétique ; aucun soin ne fait de miracle.', evidence: 'C' });
  pm.push({ product: dry || sensitive ? 'Crème réparatrice riche' : 'Crème hydratante', detail: 'En dernier, pour sceller l’hydratation.', evidence: 'B' });

  if (!sensitive)
    weekly.push({ product: 'Exfoliant acide lactique 5-10 % (1 à 2 fois par semaine)', detail: 'Les soirs SANS rétinoïde. Inutile si le rétinoïde est bien toléré tous les soirs.', evidence: 'B' });
  if (oily) weekly.push({ product: 'Masque à l’argile', detail: 'Ponctuellement sur la zone T.', evidence: 'C' });

  const hair: RoutineStep[] = [];
  if (p.hairLoss) {
    if (pregnant) notes.push('Chute de cheveux pendant / après une grossesse : souvent temporaire (effluvium) ; pas de traitement sans avis médical.');
    else if (p.sex === 'male') {
      hair.push({ product: 'Minoxidil 5 % (mousse 1×/jour ou lotion 2×/jour)', detail: 'En pharmacie sans ordonnance. Résultats en 4-6 mois, à poursuivre pour les garder.', evidence: 'A' });
      hair.push({ product: 'Finastéride 1 mg', detail: 'Traitement le plus efficace de la calvitie masculine ; sur ordonnance, à discuter avec un dermatologue (effets secondaires rares à évaluer).', evidence: 'A', rx: true });
      hair.push({ product: 'Shampooing kétoconazole 2 % (2-3×/semaine)', detail: 'Complément utile, réduit l’inflammation du cuir chevelu.', evidence: 'B' });
      hair.push({ product: 'Microneedling 1-1,5 mm (1×/semaine)', detail: 'Associé au minoxidil, améliore la repousse dans plusieurs essais.', evidence: 'B' });
    } else {
      hair.push({ product: 'Minoxidil 2-5 %', detail: 'Traitement de référence de la chute de cheveux féminine.', evidence: 'A' });
      hair.push({ product: 'Bilan médical', detail: 'Ferritine (> 50), thyroïde, vitamine D et hormones : une cause est souvent trouvée.', evidence: 'A' });
    }
    hair.push({ product: 'Vérifier ferritine, vitamine D, zinc, thyroïde', detail: 'Les carences entretiennent la chute : regarde ta prise de sang.', evidence: 'B' });
  }

  const teeth: RoutineStep[] = [
    { product: 'Brosse électrique 2 × 2 min/jour, dentifrice fluoré 1 450 ppm', detail: 'Crache sans rincer pour laisser agir le fluor.', evidence: 'A' },
    { product: 'Fil dentaire ou brossettes chaque soir', detail: 'La santé des gencives est liée au risque cardiovasculaire.', evidence: 'B' },
    { product: 'Détartrage 1 à 2 fois par an', detail: 'Blanchiment : uniquement chez le dentiste (les produits « miracles » abîment l’émail).', evidence: 'B' },
  ];

  const lifestyle = [
    'Sommeil 7 h 30+ : la peau se répare la nuit (cernes, teint, cicatrisation).',
    'Protéines suffisantes et vitamine C (ton menu) : matières premières du collagène.',
    'Zéro tabac, peu d’alcool : les deux accélèrent visiblement le vieillissement de la peau.',
    'Lunettes de soleil et casquette en plein soleil : le contour des yeux vieillit vite.',
  ];
  if (c.has('acne')) lifestyle.push('Acné : limite les laitages écrémés et les sucres rapides chez certaines personnes, change de taie d’oreiller 2 fois par semaine, ne touche pas les boutons.');
  return { am, pm, weekly, hair, teeth, lifestyle, notes };
}
