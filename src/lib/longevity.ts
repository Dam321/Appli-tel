// Habitudes quotidiennes et protocole longévité (intérieur & extérieur).
import { fromMinutes, toMinutes } from './profile';
import type { DailyLog, Profile, Sex } from './types';
import { addDays, todayISO } from './util';

export interface Habit {
  id: string;
  label: string;
  detail: string;
  group: 'corps' | 'nutrition' | 'récupération' | 'peau & apparence' | 'mental';
}

export function habitsFor(profile: Profile, waterL: number, proteinG: number): Habit[] {
  const list: Habit[] = [
    { id: 'light', label: 'Lumière du jour le matin', detail: '10 min dehors dans l’heure qui suit le réveil : cale l’horloge biologique, meilleur sommeil le soir.', group: 'récupération' },
    { id: 'training', label: 'Séance du jour faite', detail: 'Musculation ou cardio prévu dans ton programme.', group: 'corps' },
    { id: 'steps', label: '8 000 pas ou plus', detail: 'La mortalité baisse fortement jusqu’à 8-10 000 pas/jour. Marcher 10 min après les repas aide la glycémie.', group: 'corps' },
    { id: 'protein', label: `${proteinG} g de protéines`, detail: 'Réparties sur 3-5 repas, 30-50 g par repas.', group: 'nutrition' },
    { id: 'plants', label: '5+ portions de fruits & légumes', detail: 'Vise 30 plantes différentes par semaine (diversité du microbiote).', group: 'nutrition' },
    { id: 'water', label: `${waterL.toLocaleString('fr-FR')} L d’eau`, detail: 'Urine jaune pâle = bien hydraté.', group: 'nutrition' },
    { id: 'no_alcohol', label: 'Zéro alcool', detail: 'Aucune dose n’est bénéfique pour la santé ; l’alcool dégrade le sommeil, la testostérone et la récupération.', group: 'nutrition' },
    { id: 'caffeine_cutoff', label: 'Pas de caféine après 14 h', detail: 'La demi-vie de la caféine est de 5-6 h.', group: 'récupération' },
    { id: 'screens', label: 'Écrans coupés 1 h avant le coucher', detail: 'Lumière tamisée, chambre fraîche (18-19 °C), noire et silencieuse.', group: 'récupération' },
    { id: 'sleep', label: '7 h 30 à 9 h de sommeil', detail: 'Horaires réguliers (±30 min) même le week-end : c’est la régularité qui compte le plus.', group: 'récupération' },
    { id: 'mobility', label: '10 min de mobilité / étirements', detail: 'Hanches, épaules, chevilles, colonne thoracique.', group: 'corps' },
    { id: 'breath', label: '5 min de respiration / méditation', detail: 'Cohérence cardiaque : 6 respirations/minute pendant 5 min (inspire 5 s, expire 5 s).', group: 'mental' },
    { id: 'spf', label: 'Crème solaire SPF 30-50 le matin', detail: 'Le soleil cause ~80 % du vieillissement visible du visage. Tous les jours, même en hiver.', group: 'peau & apparence' },
    { id: 'skincare_pm', label: 'Routine peau du soir', detail: 'Nettoyant doux + rétinoïde (rétinal en vente libre, trétinoïne sur prescription) + hydratant.', group: 'peau & apparence' },
    { id: 'floss', label: 'Fil dentaire / brossettes', detail: 'La santé des gencives est liée au risque cardiovasculaire.', group: 'peau & apparence' },
    { id: 'supps', label: 'Compléments pris', detail: 'Voir ton protocole dans l’onglet Santé.', group: 'nutrition' },
  ];
  if (profile.smoking === 'current')
    list.unshift({ id: 'no_smoke', label: 'Zéro cigarette aujourd’hui', detail: 'Arrêter de fumer est LE geste longévité n°1 (≈ 10 ans d’espérance de vie). Aide gratuite : Tabac Info Service, 39 89.', group: 'corps' });
  if (profile.alcoholPerWeek === 0) return list.filter((h) => h.id !== 'no_alcohol').concat({ id: 'social', label: 'Lien social', detail: 'Un échange réel (pas un écran) avec un proche : la qualité des relations est un des plus forts prédicteurs de longévité.', group: 'mental' });
  return list;
}

export function dayScore(log: DailyLog | undefined, habits: Habit[]): number {
  if (!log) return 0;
  const done = habits.filter((h) => log.habits[h.id]).length;
  return Math.round((done / habits.length) * 100);
}

export function streak(daily: Record<string, DailyLog>, habits: Habit[], threshold = 60): number {
  let n = 0;
  let d = todayISO();
  if (dayScore(daily[d], habits) < threshold) d = addDays(d, -1);
  while (dayScore(daily[d], habits) >= threshold) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// ——— VO2max ———

/** Test de Cooper : distance parcourue en 12 min (m) */
export function cooperVo2(distanceM: number): number {
  return Math.round(((distanceM - 504.9) / 44.73) * 10) / 10;
}

/** Catégorie approximative (données type ACSM/Mandsager) */
export function vo2Category(sex: Sex, age: number, vo2: number): { label: string; tone: 'good' | 'warning' | 'serious' | 'neutral' } {
  // seuils (faible, moyen, bon, excellent, élite) pour 40 ans, ajustés de ~-0,35/an
  const base = sex === 'male' ? [33, 39, 45, 51, 56] : [26, 31, 36, 42, 47];
  const t = base.map((x) => x - (age - 40) * 0.35);
  if (vo2 < t[0]) return { label: 'Faible – priorité n°1 pour ta longévité', tone: 'serious' };
  if (vo2 < t[1]) return { label: 'Sous la moyenne', tone: 'warning' };
  if (vo2 < t[2]) return { label: 'Moyen', tone: 'neutral' };
  if (vo2 < t[3]) return { label: 'Bon', tone: 'good' };
  if (vo2 < t[4]) return { label: 'Excellent', tone: 'good' };
  return { label: 'Élite (top 2-3 %) – risque de mortalité le plus bas', tone: 'good' };
}

export interface ProtocolSection {
  title: string;
  items: { title: string; text: string; evidence?: 'A' | 'B' | 'C' }[];
}

export function longevityProtocol(profile: Profile, age: number): ProtocolSection[] {
  const screenings = [
    { title: 'Dermatologue', text: 'Contrôle des grains de beauté tous les 1-2 ans (plus souvent si peau claire / nombreux grains).' },
    { title: 'Dentiste', text: 'Détartrage 1-2×/an.' },
    { title: 'Tension artérielle', text: 'Objectif < 120/80 mmHg. Un tensiomètre (ex. Withings BPM) à la maison est plus fiable qu’une mesure au cabinet.' },
  ];
  const fh = profile.familyHistory ?? [];
  if (fh.includes('heart'))
    screenings.push({ title: 'Cardiaque (antécédents familiaux)', text: 'Lp(a) à doser une fois, ApoB/LDL à viser bas (< 0,8 g/L d’ApoB), et score calcique coronaire à discuter dès 40 ans.' });
  else if (age >= 45) screenings.push({ title: 'Cardiaque', text: 'Discuter d’un score calcique coronaire (scanner) si facteurs de risque : il révèle l’athérosclérose réelle.' });
  if (fh.includes('diabetes')) screenings.push({ title: 'Diabète (antécédents familiaux)', text: 'HbA1c et glycémie à jeun chaque année ; la musculation et le tour de taille sont tes meilleures protections.' });
  if (fh.includes('cancer')) screenings.push({ title: 'Cancer (antécédents familiaux)', text: 'Selon le cancer et l’âge du parent au diagnostic, un dépistage plus précoce ou une consultation d’oncogénétique peut être indiqué : parles-en à ton médecin.' });
  if (fh.includes('dementia')) screenings.push({ title: 'Cerveau (antécédents familiaux)', text: 'Les leviers les mieux prouvés : tension maîtrisée, activité physique, sommeil, audition (appareiller si besoin), lien social, pas de tabac.' });
  if (age >= 50) screenings.push({ title: 'Côlon', text: 'Test immunologique de dépistage tous les 2 ans (50-74 ans), coloscopie selon le risque.' });
  if (profile.sex === 'female' && age >= 25) screenings.push({ title: 'Gynécologie', text: 'Frottis/test HPV selon le calendrier ; mammographie dès 50 ans.' });
  if (profile.sex === 'male' && age >= 50) screenings.push({ title: 'Prostate', text: 'PSA à discuter avec le médecin (bénéfice/risque).' });

  const sections: ProtocolSection[] = [
    {
      title: 'Les 4 piliers mesurables',
      items: [
        { title: 'VO2max (cardio)', text: 'Le prédicteur de mortalité le plus puissant connu : passer de « faible » à « au-dessus de la moyenne » divise le risque par ~2. Zone 2 + 4×4 chaque semaine.', evidence: 'A' },
        { title: 'Force & muscle', text: 'La force de préhension et la masse musculaire protègent contre la mortalité, les chutes, le diabète. Tests : suspension à la barre (objectif 2 min homme / 90 s femme), marche du fermier.', evidence: 'A' },
        { title: 'Stabilité & équilibre', text: 'Tenir 30 s sur une jambe les yeux fermés ; travail unilatéral (fentes, RDL unijambe). Les chutes sont une cause majeure de déclin après 65 ans.', evidence: 'B' },
        { title: 'Composition corporelle', text: 'Tour de taille < ½ de ta taille ; gras viscéral bas (surveillé par ta balance Withings si elle le mesure).', evidence: 'A' },
      ],
    },
    {
      title: 'Sommeil',
      items: [
        { title: 'Régularité', text: 'Même heure de coucher et de lever, 7 j/7 : la régularité du sommeil prédit la mortalité mieux que la durée seule (UK Biobank 2023).', evidence: 'B' },
        { title: 'Environnement', text: 'Chambre à 18-19 °C, noir complet (masque), pas de téléphone dans la chambre.', evidence: 'B' },
        { title: 'Ce qui détruit le sommeil', text: 'Alcool (même 1-2 verres), caféine après 14 h, repas copieux < 2 h avant le coucher, lumière vive le soir.', evidence: 'A' },
        { title: 'Ronflements', text: 'Si tu ronfles fort ou te réveilles fatigué : dépistage d’apnée du sommeil (très fréquent, sous-diagnostiqué).', evidence: 'A' },
      ],
    },
    {
      title: 'Peau & apparence (l’extérieur)',
      items: [
        { title: 'Protection solaire quotidienne', text: 'SPF 30-50 large spectre chaque matin : essai randomisé (Hughes 2013) = pas de vieillissement cutané détectable en 4,5 ans dans le groupe quotidien.', evidence: 'A' },
        { title: 'Rétinoïdes le soir', text: 'Trétinoïne (prescription dermato) = référence anti-âge prouvée ; rétinal/rétinol en vente libre. Commencer 2-3×/semaine.', evidence: 'A' },
        { title: 'Vitamine C topique le matin', text: 'Sérum à 10-20 % d’acide ascorbique sous la crème solaire (antioxydant, éclat).', evidence: 'B' },
        { title: 'Posture & silhouette', text: 'Un dos large (tirages), des épaules latérales et arrière développées et un tour de taille fin = la silhouette en V. Ton programme les priorise.', evidence: 'B' },
        { title: 'Ne pas fumer / vapoter', text: 'Le tabac accélère le vieillissement de la peau, des vaisseaux et de tout l’organisme.', evidence: 'A' },
        { title: 'Dents', text: 'Fil dentaire quotidien, brosse électrique ; blanchiment chez le dentiste si besoin.', evidence: 'B' },
      ],
    },
    {
      title: 'Nutrition longévité',
      items: [
        { title: 'Aliments bruts', text: 'Les aliments ultra-transformés sont associés à plus de mortalité, de dépression et de prise de gras (essai Hall 2019 : +500 kcal/jour spontanément).', evidence: 'A' },
        { title: '30 plantes par semaine', text: 'La diversité végétale est le meilleur prédicteur d’un microbiote riche (American Gut Project).', evidence: 'B' },
        { title: 'Aliments fermentés', text: 'Kéfir, yaourt, kimchi, choucroute crue : un essai de Stanford (2021) montre plus de diversité microbienne et moins d’inflammation.', evidence: 'B' },
        { title: 'Poissons gras 2-3×/semaine', text: 'Sardines, maquereau, saumon : oméga-3, vitamine D, sélénium.', evidence: 'A' },
        { title: 'Jeûne intermittent ?', text: 'Pas d’avantage prouvé à calories égales (essai NEJM 2022). Utile seulement si ça t’aide à manger moins ; garde une fenêtre de 10-12 h et ne mange pas tard.', evidence: 'A' },
      ],
    },
    {
      title: 'Récupération & stress',
      items: [
        { title: 'Sauna', text: '3-4 séances/semaine de 15-20 min à ~80 °C associées à moins de mortalité cardiovasculaire (études finlandaises, observationnelles).', evidence: 'B' },
        { title: 'Froid', text: 'Bain froid : bon pour l’humeur, mais à éviter dans les 4-6 h après la musculation (freine l’hypertrophie, Roberts 2015).', evidence: 'B' },
        { title: 'Relations', text: 'La qualité des relations sociales est l’un des plus forts prédicteurs de santé et de longévité (Harvard Study of Adult Development).', evidence: 'A' },
      ],
    },
    { title: 'Dépistages', items: screenings },
    {
      title: 'La frontière de la recherche (honnêtement)',
      items: [
        { title: 'Agonistes GLP-1 (sémaglutide, tirzépatide)', text: 'Très efficaces contre l’obésité et réduisent les événements cardiovasculaires (essai SELECT). Sur prescription uniquement ; sans musculation ni protéines, une part importante du poids perdu est du muscle.', evidence: 'A' },
        { title: 'Rapamycine', text: 'Allonge la vie de nombreux animaux, mais aucune preuve chez l’humain sain ; immunosuppresseur. Uniquement dans un cadre médical/recherche.', evidence: 'C' },
        { title: 'Metformine', text: 'Pas de preuve de longévité chez le non-diabétique, et elle diminue les gains de muscle liés à la musculation (essai MASTERS 2019).', evidence: 'B' },
        { title: 'Horloges épigénétiques', text: 'Tests d’« âge biologique » (DunedinPACE…) : fascinants mais pas encore assez fiables individuellement pour guider des décisions.', evidence: 'C' },
        { title: 'Capteur de glucose (CGM)', text: 'Intéressant 2 semaines par curiosité pour voir l’effet de tes repas ; peu d’utilité prouvée chez le non-diabétique.', evidence: 'C' },
      ],
    },
  ];
  if (profile.smoking === 'current')
    sections.unshift({
      title: 'Priorité absolue',
      items: [{ title: 'Arrêter le tabac', text: 'Aucun complément, régime ou programme ne compense la cigarette. Substituts nicotiniques remboursés, accompagnement gratuit au 39 89 (Tabac Info Service). Le vapotage est moins nocif que le tabac mais pas anodin.', evidence: 'A' }],
    });
  return sections;
}

export interface TimelineItem {
  time: string;
  label: string;
  detail?: string;
}

/**
 * Journée type idéale, calculée à partir de tes horaires de lever/coucher, de ton
 * créneau d'entraînement et de tes compléments.
 */
export function dayTimeline(
  p: Pick<Profile, 'wakeTime' | 'bedTime' | 'trainingTime' | 'mealsPerDay'>,
  opts: { training?: string; morningSupps?: string[]; eveningSupps?: string[] },
): TimelineItem[] {
  const wake = toMinutes(p.wakeTime);
  let bed = toMinutes(p.bedTime);
  if (bed <= wake) bed += 1440;
  const items: { t: number; label: string; detail?: string }[] = [];
  items.push({ t: wake, label: 'Réveil', detail: 'Même heure chaque jour, week-end compris.' });
  items.push({ t: wake + 5, label: 'Pesée', detail: 'À jeun, après les toilettes, avant de boire.' });
  items.push({ t: wake + 15, label: 'Lumière du jour', detail: '10 min dehors (même nuageux) : cale ton horloge interne.' });

  const trainStart = p.trainingTime === 'morning' ? wake + 60 : p.trainingTime === 'noon' ? 12 * 60 + 15 : Math.min(18 * 60 + 30, bed - 4 * 60);
  const breakfast = p.trainingTime === 'morning' ? trainStart + 80 : wake + 30;
  items.push({ t: breakfast, label: 'Petit-déjeuner', detail: opts.morningSupps?.length ? `Avec : ${opts.morningSupps.join(', ')}` : 'Riche en protéines.' });
  if (opts.training) {
    items.push({ t: trainStart, label: `Entraînement : ${opts.training}`, detail: p.trainingTime === 'morning' ? 'Un café et un verre d’eau avant, le petit-déjeuner juste après.' : undefined });
  }
  const lunch = p.trainingTime === 'noon' ? 13 * 60 + 30 : 12 * 60 + 30;
  items.push({ t: lunch, label: 'Déjeuner', detail: opts.training && p.trainingTime === 'noon' ? 'Repas post-entraînement : protéines + féculents.' : 'Marche de 10 min après.' });
  const caffeineCut = Math.min(14 * 60, bed - 9 * 60);
  items.push({ t: caffeineCut, label: 'Dernière caféine', detail: 'Café, thé, cola, pré-workout : plus rien après.' });
  if (p.mealsPerDay >= 4) {
    const snack = opts.training && p.trainingTime === 'evening' ? trainStart - 75 : 16 * 60 + 30;
    items.push({ t: snack, label: opts.training && p.trainingTime === 'evening' ? 'Collation pré-entraînement' : 'Collation', detail: 'Protéines + un fruit.' });
  }
  const dinner = Math.min(Math.max(19 * 60 + 30, opts.training && p.trainingTime === 'evening' ? trainStart + 105 : 0), bed - 150);
  items.push({ t: dinner, label: 'Dîner', detail: 'Au moins 2 h 30 avant le coucher pour mieux dormir.' });
  items.push({ t: bed - 60, label: 'Écrans coupés, lumière tamisée', detail: 'Chambre fraîche (18-19 °C) et noire.' });
  if (opts.eveningSupps?.length) items.push({ t: bed - 45, label: 'Compléments du soir', detail: opts.eveningSupps.join(', ') });
  const inBed = wake + 1440 - bed;
  items.push({ t: bed, label: 'Coucher', detail: `${Math.floor(inBed / 60)} h ${String(inBed % 60).padStart(2, '0')} de nuit${inBed < 450 ? ' : un peu court, vise 7 h 30 minimum.' : '.'}` });
  return items.sort((a, b) => a.t - b.t).map((i) => ({ time: fromMinutes(i.t), label: i.label, detail: i.detail }));
}
