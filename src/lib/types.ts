// Modèle de données de l'application. Tout est stocké localement sur le téléphone.

export type Sex = 'male' | 'female';
export type Goal = 'auto' | 'fat_loss' | 'recomp' | 'muscle_gain';
export type Phase = 'cut' | 'recomp' | 'lean_gain';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Diet = 'omnivore' | 'pescatarian' | 'vegetarian' | 'vegan';
export type Allergen = 'lactose' | 'gluten' | 'nuts' | 'peanut' | 'egg' | 'fish' | 'shellfish' | 'soy' | 'sesame';
export type Equipment = 'barbell' | 'dumbbells' | 'bench' | 'pullup_bar' | 'machines' | 'bands';
export type Injury = 'shoulder' | 'knee' | 'lower_back' | 'elbow' | 'wrist';

export interface Profile {
  name: string;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  /** Poids de départ, utilisé tant qu'aucune pesée n'existe. */
  weightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
  goal: Goal;
  experience: Experience;
  activityLevel: ActivityLevel;
  trainingDays: number;
  sessionMinutes: number;
  equipment: Equipment[];
  injuries: Injury[];
  diet: Diet;
  allergens: Allergen[];
  dislikedFoods: string[];
  mealsPerDay: 3 | 4 | 5;
  batchCooking: boolean;
  /** 1 (très bon) → 5 (très mauvais) */
  sleepQuality: number;
  /** 1 (zen) → 5 (très stressé) */
  stressLevel: number;
  fattyFishPerWeek: number;
  alcoholPerWeek: number;
  sunExposure: 'low' | 'medium' | 'high';
  createdAt: string;
}

export type MeasurementSource = 'withings' | 'manual' | 'csv' | 'url';

export interface Measurement {
  id: string;
  /** ISO datetime */
  date: string;
  source: MeasurementSource;
  weightKg?: number;
  fatPct?: number;
  fatMassKg?: number;
  leanMassKg?: number;
  muscleMassKg?: number;
  boneMassKg?: number;
  hydrationKg?: number;
  visceralFat?: number;
  waistCm?: number;
  heartRate?: number;
  pwv?: number;
  vascularAge?: number;
  bmrKcal?: number;
  systolic?: number;
  diastolic?: number;
  vo2max?: number;
}

export interface BloodPanel {
  id: string;
  date: string;
  /** Valeurs en unité canonique (voir blood.ts) */
  values: Record<string, number>;
  lab?: string;
}

export interface SetLog {
  reps: number;
  weight: number;
  rir?: number;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
}

export interface WorkoutLog {
  id: string;
  date: string;
  sessionId: string;
  week: number;
  entries: ExerciseLog[];
  notes?: string;
}

export interface CardioLog {
  id: string;
  date: string;
  kind: 'zone2' | 'vo2max' | 'steps' | 'other';
  minutes: number;
}

export interface DailyLog {
  habits: Record<string, boolean>;
  /** index des repas cochés comme mangés */
  meals: Record<string, boolean>;
  steps?: number;
  sleepHours?: number;
}

export interface WithingsAuth {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  userId?: string;
  lastSync?: string;
  pendingState?: string;
}

export interface CoachMessage {
  role: 'user' | 'assistant';
  /** Contenu brut renvoyé à l'API à l'identique (append-only). */
  content: unknown;
  /** Texte affiché */
  display: string;
  at: string;
}

export interface PlanState {
  /** Graine du plan repas (changer = nouveau menu) */
  mealSeed: number;
  /** Date (lundi) de la semaine du menu */
  mealWeekStart: string;
  /** Recettes remplacées manuellement : clé `${day}-${slot}` → recipeId */
  mealOverrides: Record<string, string>;
  /** Ajustement calorique issu des bilans hebdo */
  kcalAdjustment: number;
  /** Cibles figées au moment de générer le menu (la liste de courses ne bouge pas en cours de semaine) */
  mealTargets?: { kcal: number; protein: number; carbs: number; fat: number };
  /** Date de début du cycle d'entraînement */
  programStart: string;
  programVariant: number;
  shoppingChecked: Record<string, boolean>;
  shoppingExtra: { id: string; label: string; checked: boolean }[];
  pantryHidden: boolean;
  includeSupplementsInShopping: boolean;
  lastCheckIn?: string;
  checkIns: { date: string; trendKg: number; ratePerWeek: number; adjustment: number }[];
}

export interface Settings {
  theme: 'auto' | 'light' | 'dark';
  withings?: WithingsAuth;
  anthropicKey?: string;
}

export interface AppState {
  version: number;
  profile?: Profile;
  measurements: Measurement[];
  bloodPanels: BloodPanel[];
  workouts: WorkoutLog[];
  cardio: CardioLog[];
  daily: Record<string, DailyLog>;
  plan: PlanState;
  settings: Settings;
  coach: CoachMessage[];
}
