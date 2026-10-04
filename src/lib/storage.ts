// Persistance locale (le téléphone). Aucune donnée de santé ne quitte l'appareil,
// sauf vers Withings (synchro) et l'API Claude (coach) si tu les actives.
import { upgradeProfile } from './profile';
import type { AppState } from './types';
import { mondayOf, todayISO } from './util';

const KEY = 'vitalis-state-v1';
export const STATE_VERSION = 1;

export function defaultState(): AppState {
  const today = todayISO();
  return {
    version: STATE_VERSION,
    measurements: [],
    bloodPanels: [],
    workouts: [],
    cardio: [],
    daily: {},
    plan: {
      mealSeed: Math.floor(Math.random() * 1e9),
      mealWeekStart: mondayOf(today),
      mealOverrides: {},
      kcalAdjustment: 0,
      programStart: mondayOf(today),
      programVariant: 0,
      shoppingChecked: {},
      shoppingExtra: [],
      pantryHidden: false,
      includeSupplementsInShopping: true,
      checkIns: [],
    },
    settings: { theme: 'auto' },
    coach: [],
    photos: [],
  };
}

/** Fusionne un état chargé avec les valeurs par défaut (champs ajoutés au fil des versions). */
export function migrate(raw: unknown): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<AppState>;
  return {
    ...base,
    ...s,
    plan: { ...base.plan, ...(s.plan ?? {}) },
    settings: { ...base.settings, ...(s.settings ?? {}) },
    measurements: s.measurements ?? [],
    bloodPanels: s.bloodPanels ?? [],
    workouts: s.workouts ?? [],
    cardio: s.cardio ?? [],
    daily: s.daily ?? {},
    coach: s.coach ?? [],
    photos: s.photos ?? [],
    profile: s.profile ? upgradeProfile(s.profile) : undefined,
    version: STATE_VERSION,
  };
}

export function loadState(): AppState {
  try {
    const txt = localStorage.getItem(KEY);
    return txt ? migrate(JSON.parse(txt)) : defaultState();
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Demande au navigateur de ne pas effacer les données (iOS/Android). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignoré */
  }
  return false;
}

export function exportState(state: AppState, includeSecrets = false): string {
  const copy: AppState = JSON.parse(JSON.stringify(state));
  if (!includeSecrets) {
    delete copy.settings.anthropicKey;
    if (copy.settings.withings) copy.settings.withings = { clientId: copy.settings.withings.clientId, clientSecret: '' };
  }
  return JSON.stringify(copy, null, 2);
}

export function importState(json: string): AppState {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || !('measurements' in parsed)) throw new Error('Fichier de sauvegarde invalide');
  return migrate(parsed);
}
