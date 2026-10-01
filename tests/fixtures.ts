import type { Profile } from '../src/lib/types';

export function makeProfile(over: Partial<Profile> = {}): Profile {
  return {
    name: 'Test',
    sex: 'male',
    birthYear: 1990,
    heightCm: 180,
    weightKg: 85,
    bodyFatPct: 20,
    goal: 'auto',
    experience: 'intermediate',
    activityLevel: 'light',
    trainingDays: 4,
    sessionMinutes: 60,
    equipment: ['barbell', 'dumbbells', 'bench', 'pullup_bar', 'machines'],
    injuries: [],
    diet: 'omnivore',
    allergens: [],
    dislikedFoods: [],
    mealsPerDay: 4,
    batchCooking: true,
    sleepQuality: 2,
    stressLevel: 3,
    fattyFishPerWeek: 1,
    alcoholPerWeek: 2,
    sunExposure: 'low',
    createdAt: '2026-01-01',
    ...over,
  };
}
