// Base d'exercices. `priority` reflète l'efficacité pour l'hypertrophie
// (stabilité, tension en position étirée, facilité à aller proche de l'échec en
// sécurité) d'après la littérature récente (Maeo 2021-2023, Pedrosa 2022, Kassiano 2023…).
import type { Equipment, Injury } from '../lib/types';

export type Muscle =
  | 'chest'
  | 'lats'
  | 'upper_back'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'forearms';

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Pectoraux',
  lats: 'Grand dorsal',
  upper_back: 'Haut du dos / trapèzes',
  front_delts: 'Épaules (avant)',
  side_delts: 'Épaules (latéral)',
  rear_delts: 'Épaules (arrière)',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quadriceps',
  hamstrings: 'Ischio-jambiers',
  glutes: 'Fessiers',
  calves: 'Mollets',
  abs: 'Abdominaux / gainage',
  forearms: 'Avant-bras / grip',
};

export type Pattern =
  | 'squat'
  | 'lunge'
  | 'hinge'
  | 'hip_thrust'
  | 'knee_flexion'
  | 'knee_extension'
  | 'h_push'
  | 'incline_push'
  | 'fly'
  | 'v_push'
  | 'v_pull'
  | 'h_pull'
  | 'lat_iso'
  | 'lateral_raise'
  | 'rear_delt'
  | 'biceps'
  | 'triceps'
  | 'calves'
  | 'core'
  | 'carry';

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  primary: Muscle[];
  secondary: Muscle[];
  /** Matériel requis (tous). Vide = poids du corps. */
  equipment: Equipment[];
  avoid: Injury[];
  compound: boolean;
  priority: number;
  reps: [number, number];
  /** Repos conseillé en secondes */
  rest: number;
  /** Incrément de charge (kg) */
  step: number;
  lengthened?: boolean;
  /** Libellé à afficher à la place d'une fourchette de reps (distance, durée) */
  repsLabel?: string;
  cue: string;
}

const E = (e: Exercise) => e;

export const EXERCISES: Exercise[] = [
  // ——— Squat / quadriceps ———
  E({ id: 'hack_squat', name: 'Hack squat', pattern: 'squat', primary: ['quads'], secondary: ['glutes'], equipment: ['machines'], avoid: ['knee'], compound: true, priority: 9, reps: [6, 10], rest: 180, step: 5, lengthened: true, cue: 'Descends le plus bas possible en gardant le bassin collé au dossier, contrôle 2-3 s à la descente.' }),
  E({ id: 'leg_press', name: 'Presse à cuisses', pattern: 'squat', primary: ['quads', 'glutes'], secondary: [], equipment: ['machines'], avoid: [], compound: true, priority: 8, reps: [8, 12], rest: 150, step: 10, cue: 'Pieds au milieu de la plateforme, amplitude maximale sans décoller le bas du dos.' }),
  E({ id: 'back_squat', name: 'Squat barre', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['upper_back', 'abs'], equipment: ['barbell'], avoid: ['lower_back', 'knee'], compound: true, priority: 7, reps: [5, 8], rest: 180, step: 2.5, cue: 'Gaine fort (respiration bloquée), genoux dans l’axe des pieds, descends sous la parallèle si ta mobilité le permet.' }),
  E({ id: 'goblet_squat', name: 'Goblet squat (haltère)', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['abs'], equipment: ['dumbbells'], avoid: [], compound: true, priority: 6, reps: [8, 15], rest: 120, step: 2, cue: 'Haltère contre la poitrine, talons surélevés (cales) pour plus de quadriceps.' }),
  E({ id: 'bw_squat', name: 'Squat tempo poids du corps (3 s descente)', pattern: 'squat', primary: ['quads', 'glutes'], secondary: [], equipment: [], avoid: [], compound: true, priority: 2, reps: [15, 30], rest: 90, step: 0, cue: '3 s à la descente, 1 s de pause en bas. Passe aux fentes bulgares dès que c’est trop facile.' }),

  // ——— Fentes ———
  E({ id: 'bss_db', name: 'Fente bulgare (haltères)', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: [], equipment: ['dumbbells'], avoid: ['knee'], compound: true, priority: 8, reps: [8, 12], rest: 120, step: 2, lengthened: true, cue: 'Pied arrière sur un banc/chaise, buste légèrement penché pour plus de fessiers, descends jusqu’à frôler le sol.' }),
  E({ id: 'bss_bw', name: 'Fente bulgare (poids du corps)', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: [], equipment: [], avoid: ['knee'], compound: true, priority: 6, reps: [10, 20], rest: 90, step: 0, lengthened: true, cue: 'Pied arrière sur une chaise. Ajoute un sac à dos lesté quand tu dépasses 20 reps.' }),
  E({ id: 'walking_lunge', name: 'Fentes marchées (haltères)', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: ['dumbbells'], avoid: ['knee'], compound: true, priority: 6, reps: [8, 12], rest: 120, step: 2, cue: 'Grands pas, genou arrière qui frôle le sol.' }),

  // ——— Charnière hanche ———
  E({ id: 'rdl_barbell', name: 'Soulevé de terre roumain (barre)', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['upper_back', 'forearms'], equipment: ['barbell'], avoid: ['lower_back'], compound: true, priority: 8, reps: [6, 10], rest: 180, step: 2.5, lengthened: true, cue: 'Hanches vers l’arrière, dos neutre, barre qui frôle les cuisses ; arrête quand les ischios sont étirés au max.' }),
  E({ id: 'rdl_db', name: 'Soulevé de terre roumain (haltères)', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['forearms'], equipment: ['dumbbells'], avoid: ['lower_back'], compound: true, priority: 7, reps: [8, 12], rest: 150, step: 2, lengthened: true, cue: 'Genoux légèrement fléchis et fixes, pousse les fesses vers l’arrière.' }),
  E({ id: 'back_extension', name: 'Extension lombaire 45° (fessiers/ischios)', pattern: 'hinge', primary: ['glutes', 'hamstrings'], secondary: [], equipment: ['machines'], avoid: [], compound: true, priority: 6, reps: [10, 15], rest: 120, step: 5, cue: 'Dos rond volontaire léger pour cibler fessiers/ischios, serre les fesses en haut.' }),
  E({ id: 'single_leg_rdl', name: 'Soulevé de terre roumain unijambe', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: [], equipment: [], avoid: [], compound: true, priority: 3, reps: [10, 15], rest: 90, step: 0, cue: 'Équilibre + ischios : excellent aussi pour la proprioception (longévité).' }),
  E({ id: 'hip_thrust', name: 'Hip thrust (barre)', pattern: 'hip_thrust', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['barbell', 'bench'], avoid: [], compound: true, priority: 7, reps: [8, 12], rest: 150, step: 5, cue: 'Haut du dos sur le banc, menton rentré, verrouille 1 s en haut.' }),
  E({ id: 'hip_thrust_db', name: 'Hip thrust (haltère)', pattern: 'hip_thrust', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['dumbbells'], avoid: [], compound: true, priority: 5, reps: [10, 20], rest: 120, step: 2, cue: 'Dos sur un canapé ou un banc, haltère sur les hanches.' }),
  E({ id: 'glute_bridge', name: 'Pont fessier unijambe', pattern: 'hip_thrust', primary: ['glutes'], secondary: ['hamstrings'], equipment: [], avoid: [], compound: true, priority: 3, reps: [12, 25], rest: 60, step: 0, cue: 'Pousse dans le talon, pause 2 s en haut.' }),

  // ——— Ischios (flexion de genou) ———
  E({ id: 'seated_leg_curl', name: 'Leg curl assis', pattern: 'knee_flexion', primary: ['hamstrings'], secondary: [], equipment: ['machines'], avoid: [], compound: false, priority: 9, reps: [8, 12], rest: 90, step: 5, lengthened: true, cue: 'Assis = ischios étirés : ~2x plus d’hypertrophie que couché (Maeo 2021). Penche le buste en avant.' }),
  E({ id: 'lying_leg_curl', name: 'Leg curl couché', pattern: 'knee_flexion', primary: ['hamstrings'], secondary: ['calves'], equipment: ['machines'], avoid: [], compound: false, priority: 7, reps: [8, 12], rest: 90, step: 5, cue: 'Hanches plaquées sur le banc, descente lente.' }),
  E({ id: 'nordic_curl', name: 'Nordic curl', pattern: 'knee_flexion', primary: ['hamstrings'], secondary: [], equipment: [], avoid: ['knee'], compound: false, priority: 6, reps: [3, 8], rest: 120, step: 0, lengthened: true, cue: 'Pieds bloqués (sous un canapé), descends le plus lentement possible. Réduit fortement le risque de blessure aux ischios.' }),
  E({ id: 'slider_curl', name: 'Leg curl glissé (serviette au sol)', pattern: 'knee_flexion', primary: ['hamstrings'], secondary: ['glutes'], equipment: [], avoid: [], compound: false, priority: 4, reps: [8, 15], rest: 90, step: 0, cue: 'En pont, talons sur une serviette, ramène et repousse lentement.' }),

  // ——— Quadriceps isolation ———
  E({ id: 'leg_extension', name: 'Leg extension (dossier incliné)', pattern: 'knee_extension', primary: ['quads'], secondary: [], equipment: ['machines'], avoid: ['knee'], compound: false, priority: 7, reps: [10, 15], rest: 90, step: 5, lengthened: true, cue: 'Dossier incliné vers l’arrière = droit fémoral étiré (Maeo 2023). Pause 1 s en haut.' }),
  E({ id: 'sissy_squat', name: 'Sissy squat assisté', pattern: 'knee_extension', primary: ['quads'], secondary: [], equipment: [], avoid: ['knee'], compound: false, priority: 3, reps: [10, 20], rest: 90, step: 0, cue: 'Tiens-toi à un support, genoux vers l’avant, buste aligné avec les cuisses.' }),

  // ——— Poussée horizontale ———
  E({ id: 'machine_chest_press', name: 'Développé couché machine', pattern: 'h_push', primary: ['chest'], secondary: ['triceps', 'front_delts'], equipment: ['machines'], avoid: [], compound: true, priority: 8, reps: [6, 10], rest: 150, step: 5, cue: 'Omoplates serrées, amplitude complète, poignées au niveau du bas des pecs.' }),
  E({ id: 'db_bench', name: 'Développé couché haltères', pattern: 'h_push', primary: ['chest'], secondary: ['triceps', 'front_delts'], equipment: ['dumbbells', 'bench'], avoid: [], compound: true, priority: 8, reps: [6, 10], rest: 150, step: 2, lengthened: true, cue: 'Descends les haltères bas pour étirer les pecs, coudes à ~45°.' }),
  E({ id: 'barbell_bench', name: 'Développé couché barre', pattern: 'h_push', primary: ['chest'], secondary: ['triceps', 'front_delts'], equipment: ['barbell', 'bench'], avoid: ['shoulder'], compound: true, priority: 7, reps: [5, 8], rest: 180, step: 2.5, cue: 'Pieds ancrés, omoplates rétractées, barre touche le bas des pecs. Toujours avec pareurs/sécurités.' }),
  E({ id: 'deficit_pushup', name: 'Pompes en déficit (mains sur livres)', pattern: 'h_push', primary: ['chest'], secondary: ['triceps', 'front_delts'], equipment: [], avoid: [], compound: true, priority: 5, reps: [8, 25], rest: 90, step: 0, lengthened: true, cue: 'Mains surélevées pour descendre plus bas que les mains. Leste avec un sac à dos.' }),
  E({ id: 'dips', name: 'Dips (barres parallèles)', pattern: 'h_push', primary: ['chest', 'triceps'], secondary: ['front_delts'], equipment: ['machines'], avoid: ['shoulder'], compound: true, priority: 6, reps: [6, 12], rest: 150, step: 2.5, lengthened: true, cue: 'Buste penché vers l’avant, descends jusqu’à étirement confortable des pecs.' }),

  // ——— Poussée inclinée ———
  E({ id: 'incline_db_press', name: 'Développé incliné haltères (30°)', pattern: 'incline_push', primary: ['chest', 'front_delts'], secondary: ['triceps'], equipment: ['dumbbells', 'bench'], avoid: [], compound: true, priority: 8, reps: [6, 10], rest: 150, step: 2, lengthened: true, cue: 'Banc à 30° max, grande amplitude.' }),
  E({ id: 'incline_machine', name: 'Développé incliné machine / Smith', pattern: 'incline_push', primary: ['chest', 'front_delts'], secondary: ['triceps'], equipment: ['machines'], avoid: [], compound: true, priority: 7, reps: [6, 10], rest: 150, step: 5, cue: 'Trajectoire stable : idéal pour aller proche de l’échec en sécurité.' }),
  E({ id: 'feet_elevated_pushup', name: 'Pompes pieds surélevés', pattern: 'incline_push', primary: ['chest', 'front_delts'], secondary: ['triceps'], equipment: [], avoid: [], compound: true, priority: 4, reps: [8, 25], rest: 90, step: 0, cue: 'Pieds sur une chaise, corps gainé.' }),

  // ——— Écartés ———
  E({ id: 'cable_fly', name: 'Écartés poulie (vis-à-vis)', pattern: 'fly', primary: ['chest'], secondary: [], equipment: ['machines'], avoid: [], compound: false, priority: 8, reps: [10, 15], rest: 90, step: 2.5, lengthened: true, cue: 'Pense « serrer quelqu’un dans tes bras », étirement profond en arrière.' }),
  E({ id: 'pec_deck', name: 'Pec deck', pattern: 'fly', primary: ['chest'], secondary: [], equipment: ['machines'], avoid: [], compound: false, priority: 7, reps: [10, 15], rest: 90, step: 5, cue: 'Coudes légèrement fléchis, amplitude complète.' }),
  E({ id: 'db_fly', name: 'Écartés haltères', pattern: 'fly', primary: ['chest'], secondary: [], equipment: ['dumbbells', 'bench'], avoid: ['shoulder'], compound: false, priority: 5, reps: [10, 15], rest: 90, step: 2, lengthened: true, cue: 'Charge légère, contrôle l’étirement.' }),

  // ——— Poussée verticale ———
  E({ id: 'machine_shoulder_press', name: 'Développé épaules machine', pattern: 'v_push', primary: ['front_delts'], secondary: ['triceps', 'side_delts'], equipment: ['machines'], avoid: ['shoulder'], compound: true, priority: 7, reps: [6, 10], rest: 150, step: 5, cue: 'Dos plaqué, descends les poignées sous le menton.' }),
  E({ id: 'db_shoulder_press', name: 'Développé épaules haltères assis', pattern: 'v_push', primary: ['front_delts'], secondary: ['triceps', 'side_delts'], equipment: ['dumbbells'], avoid: ['shoulder'], compound: true, priority: 7, reps: [6, 10], rest: 150, step: 2, cue: 'Coudes légèrement vers l’avant, ne cambre pas.' }),
  E({ id: 'ohp', name: 'Développé militaire barre', pattern: 'v_push', primary: ['front_delts'], secondary: ['triceps', 'abs'], equipment: ['barbell'], avoid: ['shoulder', 'lower_back'], compound: true, priority: 6, reps: [5, 8], rest: 180, step: 2.5, cue: 'Fessiers serrés, tête qui passe « à travers la fenêtre » en haut.' }),
  E({ id: 'pike_pushup', name: 'Pompes piquées (pike push-up)', pattern: 'v_push', primary: ['front_delts'], secondary: ['triceps'], equipment: [], avoid: ['shoulder'], compound: true, priority: 4, reps: [6, 15], rest: 90, step: 0, cue: 'Hanches hautes, tête vers le sol entre les mains.' }),

  // ——— Tirage vertical ———
  E({ id: 'pull_up', name: 'Tractions', pattern: 'v_pull', primary: ['lats'], secondary: ['biceps', 'upper_back'], equipment: ['pullup_bar'], avoid: [], compound: true, priority: 9, reps: [5, 10], rest: 150, step: 2.5, lengthened: true, cue: 'Pars bras tendus (étirement), tire les coudes vers les hanches. Pas encore 5 reps ? Négatives 5 s ou élastique.' }),
  E({ id: 'lat_pulldown', name: 'Tirage vertical (poulie haute)', pattern: 'v_pull', primary: ['lats'], secondary: ['biceps', 'upper_back'], equipment: ['machines'], avoid: [], compound: true, priority: 8, reps: [8, 12], rest: 120, step: 5, lengthened: true, cue: 'Laisse les épaules monter en haut pour étirer le dos, tire vers le haut de la poitrine.' }),
  E({ id: 'band_pulldown', name: 'Tirage vertical à l’élastique', pattern: 'v_pull', primary: ['lats'], secondary: ['biceps'], equipment: ['bands'], avoid: [], compound: true, priority: 4, reps: [12, 20], rest: 90, step: 0, cue: 'Élastique accroché en hauteur, à genoux, coudes vers les hanches.' }),

  // ——— Tirage horizontal ———
  E({ id: 'chest_supported_row', name: 'Rowing poitrine appuyée (machine)', pattern: 'h_pull', primary: ['upper_back', 'lats'], secondary: ['rear_delts', 'biceps'], equipment: ['machines'], avoid: [], compound: true, priority: 8, reps: [8, 12], rest: 120, step: 5, cue: 'Le support du buste supprime la triche et protège le bas du dos.' }),
  E({ id: 'cable_row', name: 'Rowing poulie basse assis', pattern: 'h_pull', primary: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts'], equipment: ['machines'], avoid: [], compound: true, priority: 8, reps: [8, 12], rest: 120, step: 5, lengthened: true, cue: 'Laisse les omoplates s’écarter vers l’avant (étirement), puis tire les coudes en arrière.' }),
  E({ id: 'db_row', name: 'Rowing haltère unilatéral', pattern: 'h_pull', primary: ['lats', 'upper_back'], secondary: ['biceps', 'rear_delts'], equipment: ['dumbbells', 'bench'], avoid: [], compound: true, priority: 7, reps: [8, 12], rest: 90, step: 2, lengthened: true, cue: 'Main et genou sur le banc, tire l’haltère vers la hanche.' }),
  E({ id: 'incline_db_row', name: 'Rowing haltères buste appuyé sur banc incliné', pattern: 'h_pull', primary: ['upper_back', 'lats'], secondary: ['rear_delts', 'biceps'], equipment: ['dumbbells', 'bench'], avoid: [], compound: true, priority: 7, reps: [8, 12], rest: 120, step: 2, cue: 'Poitrine sur le banc à 30-45°, tire les coudes vers l’arrière.' }),
  E({ id: 'barbell_row', name: 'Rowing barre penché', pattern: 'h_pull', primary: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts', 'hamstrings'], equipment: ['barbell'], avoid: ['lower_back'], compound: true, priority: 6, reps: [6, 10], rest: 150, step: 2.5, cue: 'Buste à ~45°, dos neutre, barre vers le nombril.' }),
  E({ id: 'inverted_row', name: 'Rowing inversé (sous une table / barre basse)', pattern: 'h_pull', primary: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts'], equipment: [], avoid: [], compound: true, priority: 5, reps: [8, 20], rest: 90, step: 0, cue: 'Corps gainé, poitrine vers le bord de la table. Plus les pieds sont loin, plus c’est dur.' }),

  // ——— Isolation dos ———
  E({ id: 'cable_pullover', name: 'Pullover poulie haute (bras tendus)', pattern: 'lat_iso', primary: ['lats'], secondary: [], equipment: ['machines'], avoid: [], compound: false, priority: 7, reps: [10, 15], rest: 90, step: 2.5, lengthened: true, cue: 'Penche-toi en avant, bras quasi tendus, ramène la barre vers les cuisses.' }),
  E({ id: 'db_pullover', name: 'Pullover haltère', pattern: 'lat_iso', primary: ['lats'], secondary: ['chest'], equipment: ['dumbbells', 'bench'], avoid: ['shoulder'], compound: false, priority: 5, reps: [10, 15], rest: 90, step: 2, lengthened: true, cue: 'Allongé en travers du banc, haltère derrière la tête, côtes basses.' }),

  // ——— Élévations latérales ———
  E({ id: 'cable_lateral', name: 'Élévations latérales poulie (derrière le corps)', pattern: 'lateral_raise', primary: ['side_delts'], secondary: [], equipment: ['machines'], avoid: [], compound: false, priority: 9, reps: [10, 20], rest: 60, step: 1.25, lengthened: true, cue: 'Câble derrière le corps = tension en position étirée. Monte jusqu’à l’horizontale.' }),
  E({ id: 'db_lateral', name: 'Élévations latérales haltères', pattern: 'lateral_raise', primary: ['side_delts'], secondary: [], equipment: ['dumbbells'], avoid: [], compound: false, priority: 7, reps: [12, 20], rest: 60, step: 1, cue: 'Légèrement penché en avant, mène avec les coudes, pas d’élan.' }),
  E({ id: 'band_lateral', name: 'Élévations latérales élastique', pattern: 'lateral_raise', primary: ['side_delts'], secondary: [], equipment: ['bands'], avoid: [], compound: false, priority: 5, reps: [15, 25], rest: 60, step: 0, cue: 'Élastique sous le pied opposé.' }),
  E({ id: 'lateral_bw', name: 'Élévations latérales avec bouteilles d’eau / sac', pattern: 'lateral_raise', primary: ['side_delts'], secondary: [], equipment: [], avoid: [], compound: false, priority: 2, reps: [15, 30], rest: 60, step: 0, cue: 'Charge improvisée, séries longues jusqu’à la brûlure.' }),

  // ——— Arrière d'épaule ———
  E({ id: 'reverse_pec_deck', name: 'Oiseau à la machine (reverse pec deck)', pattern: 'rear_delt', primary: ['rear_delts'], secondary: ['upper_back'], equipment: ['machines'], avoid: [], compound: false, priority: 8, reps: [12, 20], rest: 60, step: 2.5, cue: 'Bras tendus, écarte en arc de cercle, pense « pousser les mains vers les murs ».' }),
  E({ id: 'face_pull', name: 'Face pull (poulie ou élastique)', pattern: 'rear_delt', primary: ['rear_delts'], secondary: ['upper_back'], equipment: ['bands'], avoid: [], compound: false, priority: 7, reps: [12, 20], rest: 60, step: 0, cue: 'Tire vers le front en écartant la corde, rotation externe en fin de mouvement : top pour la santé des épaules.' }),
  E({ id: 'cable_face_pull', name: 'Face pull poulie', pattern: 'rear_delt', primary: ['rear_delts'], secondary: ['upper_back'], equipment: ['machines'], avoid: [], compound: false, priority: 7, reps: [12, 20], rest: 60, step: 2.5, cue: 'Corde à hauteur du visage, coudes hauts, rotation externe.' }),
  E({ id: 'db_rear_fly', name: 'Oiseau haltères buste penché', pattern: 'rear_delt', primary: ['rear_delts'], secondary: ['upper_back'], equipment: ['dumbbells'], avoid: [], compound: false, priority: 6, reps: [12, 20], rest: 60, step: 1, cue: 'Charge légère, pas d’élan.' }),
  E({ id: 'ytw', name: 'Y-T-W allongé au sol', pattern: 'rear_delt', primary: ['rear_delts'], secondary: ['upper_back'], equipment: [], avoid: [], compound: false, priority: 3, reps: [8, 15], rest: 60, step: 0, cue: 'Allongé sur le ventre, forme un Y, un T puis un W avec les bras, pouces vers le haut.' }),

  // ——— Biceps ———
  E({ id: 'incline_curl', name: 'Curl incliné haltères', pattern: 'biceps', primary: ['biceps'], secondary: [], equipment: ['dumbbells', 'bench'], avoid: [], compound: false, priority: 8, reps: [8, 15], rest: 75, step: 1, lengthened: true, cue: 'Banc à 45-60°, bras pendants derrière le corps : biceps étirés.' }),
  E({ id: 'bayesian_curl', name: 'Curl bayésien (poulie derrière)', pattern: 'biceps', primary: ['biceps'], secondary: [], equipment: ['machines'], avoid: [], compound: false, priority: 8, reps: [10, 15], rest: 75, step: 1.25, lengthened: true, cue: 'Dos à la poulie, bras tiré vers l’arrière, curl sans avancer le coude.' }),
  E({ id: 'preacher_curl', name: 'Curl pupitre (machine ou EZ)', pattern: 'biceps', primary: ['biceps'], secondary: [], equipment: ['machines'], avoid: ['elbow'], compound: false, priority: 7, reps: [8, 12], rest: 75, step: 2.5, lengthened: true, cue: 'Descends complètement, ne rebondis pas en bas.' }),
  E({ id: 'hammer_curl', name: 'Curl marteau', pattern: 'biceps', primary: ['biceps', 'forearms'], secondary: [], equipment: ['dumbbells'], avoid: [], compound: false, priority: 6, reps: [8, 15], rest: 75, step: 1, cue: 'Prise neutre : brachial + avant-bras (grip).' }),
  E({ id: 'ez_curl', name: 'Curl barre EZ', pattern: 'biceps', primary: ['biceps'], secondary: ['forearms'], equipment: ['barbell'], avoid: ['elbow'], compound: false, priority: 6, reps: [8, 12], rest: 75, step: 2.5, cue: 'Coudes fixes le long du corps.' }),
  E({ id: 'band_curl', name: 'Curl élastique', pattern: 'biceps', primary: ['biceps'], secondary: [], equipment: ['bands'], avoid: [], compound: false, priority: 4, reps: [12, 25], rest: 60, step: 0, cue: 'Pied sur l’élastique, contrôle la descente.' }),
  E({ id: 'chin_up_iso', name: 'Tractions supination (paumes vers toi)', pattern: 'biceps', primary: ['biceps', 'lats'], secondary: [], equipment: ['pullup_bar'], avoid: ['elbow'], compound: true, priority: 5, reps: [5, 12], rest: 120, step: 2.5, cue: 'Prise serrée en supination, amplitude complète.' }),
  E({ id: 'towel_curl', name: 'Curl isométrique serviette / sac', pattern: 'biceps', primary: ['biceps'], secondary: ['forearms'], equipment: [], avoid: [], compound: false, priority: 2, reps: [10, 20], rest: 60, step: 0, cue: 'Sac à dos chargé, curl lent avec pause en haut.' }),

  // ——— Triceps ———
  E({ id: 'overhead_cable_ext', name: 'Extension triceps poulie au-dessus de la tête', pattern: 'triceps', primary: ['triceps'], secondary: [], equipment: ['machines'], avoid: ['elbow'], compound: false, priority: 9, reps: [8, 15], rest: 75, step: 2.5, lengthened: true, cue: 'Bras au-dessus de la tête = longue portion étirée : ~+40 % d’hypertrophie vs pushdown (Maeo 2022).' }),
  E({ id: 'db_overhead_ext', name: 'Extension triceps haltère au-dessus de la tête', pattern: 'triceps', primary: ['triceps'], secondary: [], equipment: ['dumbbells'], avoid: ['elbow', 'shoulder'], compound: false, priority: 7, reps: [10, 15], rest: 75, step: 1, lengthened: true, cue: 'Assis, haltère à deux mains derrière la tête, coudes serrés.' }),
  E({ id: 'rope_pushdown', name: 'Pushdown corde', pattern: 'triceps', primary: ['triceps'], secondary: [], equipment: ['machines'], avoid: [], compound: false, priority: 7, reps: [10, 15], rest: 60, step: 2.5, cue: 'Coudes collés, écarte la corde en bas.' }),
  E({ id: 'skull_crusher', name: 'Barre au front (EZ)', pattern: 'triceps', primary: ['triceps'], secondary: [], equipment: ['barbell', 'bench'], avoid: ['elbow'], compound: false, priority: 6, reps: [8, 12], rest: 75, step: 2.5, lengthened: true, cue: 'Descends la barre derrière la tête pour plus d’étirement.' }),
  E({ id: 'band_pushdown', name: 'Extension triceps élastique', pattern: 'triceps', primary: ['triceps'], secondary: [], equipment: ['bands'], avoid: [], compound: false, priority: 4, reps: [15, 25], rest: 60, step: 0, cue: 'Élastique en hauteur, coudes fixes.' }),
  E({ id: 'diamond_pushup', name: 'Pompes serrées (diamant)', pattern: 'triceps', primary: ['triceps'], secondary: ['chest'], equipment: [], avoid: ['wrist'], compound: true, priority: 4, reps: [8, 20], rest: 75, step: 0, cue: 'Mains rapprochées sous la poitrine, coudes le long du corps.' }),

  // ——— Mollets ———
  E({ id: 'standing_calf', name: 'Mollets debout (machine/presse)', pattern: 'calves', primary: ['calves'], secondary: [], equipment: ['machines'], avoid: [], compound: false, priority: 8, reps: [8, 15], rest: 60, step: 5, lengthened: true, cue: 'Pause 2 s en bas en étirement maximal, pas de rebond.' }),
  E({ id: 'single_calf', name: 'Mollets unijambe sur une marche', pattern: 'calves', primary: ['calves'], secondary: [], equipment: [], avoid: [], compound: false, priority: 6, reps: [10, 20], rest: 60, step: 0, lengthened: true, cue: 'Talon le plus bas possible, pause 2 s. Haltère en main si trop facile.' }),

  // ——— Gainage ———
  E({ id: 'cable_crunch', name: 'Crunch à la poulie', pattern: 'core', primary: ['abs'], secondary: [], equipment: ['machines'], avoid: ['lower_back'], compound: false, priority: 7, reps: [10, 15], rest: 60, step: 2.5, cue: 'À genoux, enroule la colonne (côtes vers le bassin).' }),
  E({ id: 'hanging_leg_raise', name: 'Relevés de jambes suspendu', pattern: 'core', primary: ['abs'], secondary: ['forearms'], equipment: ['pullup_bar'], avoid: [], compound: false, priority: 7, reps: [8, 15], rest: 75, step: 0, cue: 'Enroule le bassin, pas de balancier. Bonus grip.' }),
  E({ id: 'dead_bug', name: 'Dead bug', pattern: 'core', primary: ['abs'], secondary: [], equipment: [], avoid: [], compound: false, priority: 5, reps: [8, 15], rest: 45, step: 0, cue: 'Bas du dos plaqué au sol, mouvements lents bras/jambe opposés.' }),
  E({ id: 'pallof', name: 'Pallof press (anti-rotation)', pattern: 'core', primary: ['abs'], secondary: [], equipment: ['bands'], avoid: [], compound: false, priority: 6, reps: [10, 15], rest: 45, step: 0, cue: 'Résiste à la rotation, bras tendus 2 s.' }),
  E({ id: 'plank', name: 'Planche RKC', pattern: 'core', primary: ['abs'], secondary: [], equipment: [], avoid: [], compound: false, priority: 4, reps: [1, 3], repsLabel: '30-45 s', rest: 45, step: 0, cue: 'Serre fessiers, cuisses et abdos au maximum : 30 s intenses valent mieux que 3 min molles.' }),

  // ——— Port de charge / grip (longévité) ———
  E({ id: 'farmer_walk', name: 'Marche du fermier', pattern: 'carry', primary: ['forearms', 'upper_back'], secondary: ['abs'], equipment: ['dumbbells'], avoid: ['lower_back'], compound: true, priority: 7, reps: [1, 1], repsLabel: '40 m', rest: 90, step: 2, cue: '40 m lourds, épaules basses. La force de préhension est un des meilleurs prédicteurs de longévité.' }),
  E({ id: 'dead_hang', name: 'Suspension passive à la barre', pattern: 'carry', primary: ['forearms'], secondary: ['lats'], equipment: ['pullup_bar'], avoid: [], compound: false, priority: 6, reps: [1, 1], repsLabel: 'max (objectif 60-120 s)', rest: 60, step: 0, cue: 'Tiens le plus longtemps possible (objectif : 2 min). Décompresse aussi la colonne.' }),
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
