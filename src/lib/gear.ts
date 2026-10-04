// Ce qu'il vaut la peine d'acheter, selon ta situation, classé par utilité réelle.
// Règle : un achat n'entre dans la liste que s'il améliore une mesure ou un
// comportement qui compte (preuves à l'appui). Le reste va dans « À ne pas acheter ».
// Prix indicatifs en France ; critères de choix plutôt que marques.
import type { Derived } from './derived';
import type { AppState } from './types';
import { ageFromBirthYear, todayISO } from './util';
import { sleepStats } from './sleep';

export type GearTier = 'essential' | 'useful' | 'optional';

export interface GearItem {
  id: string;
  name: string;
  tier: GearTier;
  price: string;
  why: string;
  criteria: string;
  /** Détecté automatiquement d'après tes données */
  detected?: boolean;
  category: 'mesure' | 'entraînement' | 'sommeil' | 'cuisine' | 'santé';
}

export interface NotWorthIt {
  name: string;
  why: string;
}

export const TIER_LABEL: Record<GearTier, string> = { essential: 'Essentiel', useful: 'Très utile', optional: 'Optionnel' };

export function gearList(state: AppState, d: Derived, today = todayISO()): GearItem[] {
  const p = d.profile;
  const age = ageFromBirthYear(p.birthYear);
  const ms = state.measurements;
  const out: GearItem[] = [];
  const add = (x: GearItem, when = true) => when && out.push(x);

  // ——— Mesures ———
  add({
    id: 'scale',
    name: 'Balance impédancemètre connectée',
    tier: 'essential',
    price: '50-150 €',
    category: 'mesure',
    why: 'Pesée quotidienne → tendance lissée → calories ajustées chaque semaine. C’est le moteur du programme.',
    criteria: 'Wi-Fi ou Bluetooth avec synchro automatique (Withings est déjà relié à l’app). Le % de gras est approximatif : seule la tendance compte.',
    detected: ms.some((m) => m.source === 'withings') || !!state.settings.withings?.refreshToken,
  });
  add({
    id: 'tape',
    name: 'Mètre ruban',
    tier: 'essential',
    price: '3-10 €',
    category: 'mesure',
    why: 'Le tour de taille est le meilleur indicateur simple du gras viscéral (le plus dangereux), et il suit la recomposition mieux que la balance.',
    criteria: 'Ruban souple de couturière, ou ruban à enrouleur qui se bloque autour de la taille pour mesurer seul. Mesure au nombril, le matin, en fin d’expiration.',
    detected: ms.some((m) => m.waistCm !== undefined),
  });
  const bpPriority = age >= 40 || p.conditions.includes('hypertension') || p.conditions.includes('heart') || p.familyHistory.includes('heart') || p.medications.includes('antihypertensive');
  add({
    id: 'bp',
    name: 'Tensiomètre automatique au bras',
    tier: bpPriority ? 'essential' : 'useful',
    price: '35-70 €',
    category: 'mesure',
    why: 'L’hypertension ne donne aucun symptôme et c’est le 1er facteur de risque cardiovasculaire évitable. La mesure à domicile est plus fiable que chez le médecin (effet blouse blanche).',
    criteria: 'Au bras (pas au poignet), modèle validé cliniquement (listes STRIDE BP ou validatebp.org), brassard à ta taille. Protocole : 3 jours, matin et soir, 2 mesures à 1 min d’écart.',
    detected: ms.some((m) => m.systolic !== undefined),
  });

  // ——— Cuisine ———
  add({
    id: 'kitchen_scale',
    name: 'Balance de cuisine (précision 1 g)',
    tier: 'essential',
    price: '10-20 €',
    category: 'cuisine',
    why: 'Les portions du menu sont calculées au gramme pour tes macros. 2-3 semaines de pesée suffisent pour éduquer l’œil, ensuite tu peux t’en passer.',
    criteria: 'Plateau plat, fonction tare, portée 5 kg.',
  });
  add(
    {
      id: 'containers',
      name: 'Boîtes de conservation en verre',
      tier: 'useful',
      price: '20-40 €',
      category: 'cuisine',
      why: 'Tu cuisines en double portion : des boîtes qui passent au micro-ondes et au four rendent le batch cooking tenable. Le verre évite de chauffer du plastique.',
      criteria: 'Verre borosilicate, couvercle hermétique, 6-10 boîtes de 600-900 mL.',
    },
    p.batchCooking,
  );

  // ——— Entraînement ———
  const home = !p.equipment.includes('machines') && !p.equipment.includes('barbell');
  if (home) {
    add({
      id: 'dumbbells',
      name: 'Haltères réglables',
      tier: 'essential',
      price: '150-400 € la paire',
      category: 'entraînement',
      why: 'À la maison, c’est ce qui permet la surcharge progressive sur tout le corps (le vrai moteur de la prise de muscle). Les élastiques seuls plafonnent vite.',
      criteria: 'Réglage rapide par sélecteur, jusqu’à 24 kg par haltère (32 kg si tu es déjà avancé). Une salle à 25-35 €/mois est une alternative souvent plus complète.',
      detected: p.equipment.includes('dumbbells'),
    });
    add({
      id: 'bench',
      name: 'Banc réglable (incliné / plat)',
      tier: 'useful',
      price: '80-200 €',
      category: 'entraînement',
      why: 'Débloque développés, rowing sur banc, hip thrust et les exercices en position étirée du programme.',
      criteria: 'Stable, charge max ≥ 250 kg, dossier réglable de 0 à 85°.',
      detected: p.equipment.includes('bench'),
    });
    add({
      id: 'pullup',
      name: 'Barre de traction',
      tier: 'useful',
      price: '20-50 €',
      category: 'entraînement',
      why: 'Les tractions sont le meilleur exercice du dos sans machine.',
      criteria: 'Fixée au mur ou au plafond plutôt que « de porte » si possible ; prises neutres en bonus.',
      detected: p.equipment.includes('pullup_bar'),
    });
    add({
      id: 'bands',
      name: 'Élastiques de résistance',
      tier: 'optional',
      price: '15-30 €',
      category: 'entraînement',
      why: 'Échauffement des épaules, assistance aux tractions, exercices à la poulie improvisés.',
      criteria: 'Jeu de 4-5 bandes en boucle (latex), du plus léger au plus fort.',
      detected: p.equipment.includes('bands'),
    });
  }
  add({
    id: 'hr_strap',
    name: 'Ceinture cardio thoracique',
    tier: 'useful',
    price: '40-90 €',
    category: 'entraînement',
    why: `Ta zone 2 est étroite (${d.program.cardio.zone2.hrLow}-${d.program.cardio.zone2.hrHigh} bpm) : les capteurs optiques de montre décrochent souvent à l’effort, surtout en fractionné. La ceinture mesure comme un ECG.`,
    criteria: 'Capteur électrique (pas optique), Bluetooth + ANT+, compatible avec ton téléphone ou ta montre.',
  });

  // ——— Sommeil ———
  const measured = sleepStats(state.daily, today, 30);
  const poorSleep = p.sleepQuality >= 3 || (measured !== undefined && measured.avgHours < 7);
  add({
    id: 'mask',
    name: 'Masque de nuit occultant + bouchons d’oreilles',
    tier: poorSleep ? 'essential' : 'useful',
    price: '10-25 €',
    category: 'sommeil',
    why: 'Le noir complet et le silence améliorent le sommeil profond ; dormir avec un masque améliore l’attention et la mémoire le lendemain (essais contrôlés).',
    criteria: 'Masque à coques (sans pression sur les yeux), bouchons en mousse ou silicone moulable.',
  });
  add(
    {
      id: 'blackout',
      name: 'Rideaux ou store occultants',
      tier: 'useful',
      price: '25-80 €',
      category: 'sommeil',
      why: 'La lumière de la rue et du petit matin fragmente le sommeil et avance le réveil.',
      criteria: 'Occultation totale (« blackout »), bien recouvrir les bords de la fenêtre.',
    },
    poorSleep,
  );
  const earlyWake = Number(p.wakeTime.slice(0, 2)) < 7;
  add(
    {
      id: 'light',
      name: 'Lampe de luminothérapie 10 000 lux',
      tier: 'useful',
      price: '50-150 €',
      category: 'sommeil',
      why: 'D’octobre à mars, 20-30 min de lumière forte au réveil recalent l’horloge interne, améliorent l’énergie et l’humeur (traitement validé de la déprime saisonnière). Inutile si tu peux sortir 15 min au jour le matin.',
      criteria: 'Dispositif médical certifié, 10 000 lux à la distance indiquée, filtre UV. Avis médical si maladie des yeux ou trouble bipolaire.',
    },
    p.sunExposure === 'low' || earlyWake,
  );
  add({
    id: 'sleep_tracker',
    name: 'Montre ou capteur de sommeil Withings',
    tier: 'optional',
    price: '100-300 €',
    category: 'sommeil',
    why: 'Automatise : durée du sommeil et fréquence cardiaque nocturne remplissent ta forme du jour, et l’app détecte une récupération incomplète avant que tu la sentes. Ne fait pas progresser à lui seul.',
    criteria: 'Capteur sous le matelas (rien à porter) ou montre Withings : les données arrivent toutes seules dans l’app.',
    detected: Object.values(state.daily).some((x) => x.sleep),
  });

  // ——— Santé ———
  add({
    id: 'toothbrush',
    name: 'Brosse à dents électrique',
    tier: 'essential',
    price: '30-80 €',
    category: 'santé',
    why: 'Retire plus de plaque et réduit davantage l’inflammation des gencives qu’une brosse manuelle (revue Cochrane) ; les maladies des gencives sont associées au risque cardiovasculaire.',
    criteria: 'Oscillo-rotative ou sonique, minuteur 2 min, capteur de pression. Les modèles d’entrée de gamme suffisent.',
  });
  add({
    id: 'sunglasses',
    name: 'Lunettes de soleil filtrant 100 % des UV',
    tier: 'useful',
    price: '15-80 €',
    category: 'santé',
    why: 'Les UV accélèrent la cataracte et le vieillissement de la peau autour des yeux (rides, taches).',
    criteria: 'Marquage CE, UV400 ou « 100 % UV », catégorie 3 pour le plein soleil. Le prix ne change pas la protection.',
  });
  add(
    {
      id: 'pillbox',
      name: 'Pilulier semainier matin / soir',
      tier: 'useful',
      price: '5-10 €',
      category: 'santé',
      why: `Tu as ${d.stack.length} compléments à prendre : un pilulier préparé le dimanche supprime les oublis.`,
      criteria: '7 jours × 2 cases, couvercles qui ferment bien.',
    },
    d.stack.length >= 3,
  );
  add(
    {
      id: 'omega3_test',
      name: 'Test de l’index oméga-3 (goutte de sang à domicile)',
      tier: 'optional',
      price: '50-80 €',
      category: 'santé',
      why: 'Le seul moyen de savoir si ta dose d’oméga-3 atteint la cible ≥ 8 % ; pas dosé dans une prise de sang classique.',
      criteria: 'Laboratoire qui mesure l’« Omega-3 Index » (méthode HS-Omega-3 Index). À faire après 4 mois au même apport.',
    },
    d.blood.omega3_index === undefined,
  );

  const rank = { essential: 0, useful: 1, optional: 2 };
  return out.sort((a, b) => rank[a.tier] - rank[b.tier]);
}

export function notWorthIt(state: AppState, d: Derived): NotWorthIt[] {
  const p = d.profile;
  const out: NotWorthIt[] = [];
  if (!p.conditions.includes('diabetes') && !p.conditions.includes('prediabetes'))
    out.push({ name: 'Capteur de glucose en continu', why: 'Sans diabète, les pics après les repas sont normaux et suivre sa courbe n’a pas montré de bénéfice. HbA1c + glycémie à jeun suffisent.' });
  out.push(
    { name: 'Ceinture d’électrostimulation abdominale', why: 'Ne fait pas perdre de gras ; on ne peut pas « cibler » le gras du ventre.' },
    { name: 'Brûleurs de graisse, « détox », thés minceur', why: 'Inefficaces, parfois dangereux (alertes de l’ANSES sur plusieurs produits).' },
    { name: 'Tests ADN « nutrition / sport »', why: 'Ne permettent pas de personnaliser un régime (essai DIETFITS) ; en France, les tests génétiques sans prescription médicale sont d’ailleurs interdits.' },
    { name: 'Tests d’« intolérances alimentaires » IgG', why: 'Non validés : les IgG reflètent simplement ce que tu manges souvent (position des sociétés d’allergologie).' },
    { name: 'Lunettes anti-lumière bleue', why: 'Preuves faibles (revue Cochrane 2023). Baisser la lumière et couper les écrans 1 h avant le coucher fait mieux, gratuitement.' },
    { name: 'Bain de glace juste après la musculation', why: 'Réduit la prise de muscle et de force si pris dans les heures qui suivent la séance.' },
    { name: 'Pistolet de massage, rouleaux', why: 'Confort : un peu moins de courbatures ressenties, mais aucun effet sur la prise de muscle ou la performance.' },
    { name: 'Eau alcaline ou hydrogénée', why: 'Aucun bénéfice démontré ; l’eau du robinet convient.' },
  );
  if (state.profile && p.skinConcerns.includes('aging'))
    out.push({ name: 'Masque LED anti-âge à domicile', why: 'Preuves faibles comparées à un rétinoïde + crème solaire tous les jours, pour bien plus cher.' });
  return out;
}
