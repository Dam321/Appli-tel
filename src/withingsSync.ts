import { useCallback, useState } from 'react';
import { ensureToken, fetchMeasures, fetchSteps, mergeMeasurements, WithingsError } from './lib/withings';
import { addDays, todayISO } from './lib/util';
import type { AppState } from './lib/types';
import { useStore } from './store';

export function isWithingsConnected(s: AppState): boolean {
  return !!s.settings.withings?.refreshToken;
}

/** Synchronise pesées + pas depuis Withings. */
export function useWithingsSync() {
  const { state, update, toast } = useStore();
  const [busy, setBusy] = useState(false);

  const sync = useCallback(
    async (silent = false) => {
      const auth0 = state.settings.withings;
      if (!auth0?.refreshToken) {
        if (!silent) toast('Connecte d’abord ta balance dans Réglages');
        return;
      }
      setBusy(true);
      try {
        const auth = await ensureToken(auth0);
        const since = auth0.lastSync ? Math.floor(new Date(auth0.lastSync).getTime() / 1000) - 7 * 86400 : 0;
        const measures = await fetchMeasures(auth, since);
        let steps: { date: string; steps: number }[] = [];
        try {
          steps = await fetchSteps(auth, addDays(todayISO(), -14), todayISO());
        } catch {
          /* activité indisponible (pas de montre/tracker) : on ignore */
        }
        const known = new Set(state.measurements.map((m) => m.id));
        const added = measures.filter((m) => !known.has(m.id)).length;
        update((s) => {
          const merged = mergeMeasurements(s.measurements, measures);
          const daily = { ...s.daily };
          for (const st of steps) {
            const prev = daily[st.date] ?? { habits: {}, meals: {} };
            daily[st.date] = { ...prev, steps: st.steps, habits: { ...prev.habits, steps: prev.habits.steps || st.steps >= 8000 } };
          }
          return { ...s, measurements: merged.list, daily, settings: { ...s.settings, withings: { ...auth, lastSync: new Date().toISOString() } } };
        });
        if (!silent || added) toast(added ? `Withings : ${added} nouvelle(s) mesure(s)` : 'Withings : tout est à jour');
      } catch (e) {
        const msg = e instanceof WithingsError ? e.message : 'Erreur de synchronisation';
        if (e instanceof WithingsError && e.status === 401) {
          update((s) => ({ ...s, settings: { ...s.settings, withings: s.settings.withings && { ...s.settings.withings, accessToken: undefined } } }));
        }
        if (!silent) toast(`${msg}`);
      } finally {
        setBusy(false);
      }
    },
    [state.settings.withings, state.measurements, update, toast],
  );

  return { sync, busy, connected: isWithingsConnected(state) };
}
