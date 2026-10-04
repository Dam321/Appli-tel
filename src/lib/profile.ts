// Valeurs par défaut du profil : sert à l'accueil, aux tests et à la mise à niveau
// des profils créés avec une version précédente du questionnaire.
import type { Profile } from './types';

export const PROFILE_VERSION = 2;

export function newProfile(): Profile {
  return {
    name: '',
    sex: 'male',
    birthYear: new Date().getFullYear() - 35,
    heightCm: 178,
    weightKg: 80,
    goal: 'auto',
    experience: 'intermediate',
    activityLevel: 'light',
    trainingDays: 4,
    sessionMinutes: 60,
    equipment: ['machines', 'barbell', 'dumbbells', 'bench', 'pullup_bar', 'bands'],
    injuries: [],
    diet: 'omnivore',
    allergens: [],
    dislikedFoods: [],
    mealsPerDay: 4,
    batchCooking: true,
    sleepQuality: 2,
    stressLevel: 3,
    fattyFishPerWeek: 1,
    alcoholPerWeek: 0,
    sunExposure: 'low',
    conditions: [],
    medications: [],
    smoking: 'never',
    familyHistory: [],
    trainingWeekdays: [],
    trainingTime: 'evening',
    priorities: [],
    cardioModes: ['bike', 'walk'],
    wakeTime: '07:00',
    bedTime: '23:00',
    budget: 'standard',
    maxCookMinutes: 30,
    profileVersion: PROFILE_VERSION,
    createdAt: new Date().toISOString(),
  };
}

/** Complète un profil ancien avec les nouveaux champs (sans toucher aux réponses existantes). */
export function upgradeProfile(p: Partial<Profile>): Profile {
  const base = newProfile();
  return { ...base, ...p, profileVersion: p.profileVersion ?? 1 } as Profile;
}

/** Heure "HH:MM" → minutes depuis minuit */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Durée de sommeil prévue (h) entre le coucher et le lever */
export function plannedSleepHours(p: Pick<Profile, 'bedTime' | 'wakeTime'>): number {
  let d = toMinutes(p.wakeTime) - toMinutes(p.bedTime);
  if (d <= 0) d += 1440;
  return d / 60;
}
