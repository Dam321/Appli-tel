import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { computeDerived, type Derived } from './lib/derived';
import { loadState, saveState } from './lib/storage';
import type { AppState } from './lib/types';

interface Store {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  derived: Derived | null;
  toast: (msg: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!saveState(state)) setToastMsg('⚠️ Impossible d’enregistrer (stockage plein ?)');
    }, 250);
    return () => window.clearTimeout(id);
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state.settings.theme);
  }, [state.settings.theme]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);
  const derived = useMemo(() => computeDerived(state), [state]);

  return (
    <Ctx.Provider value={{ state, update, derived, toast }}>
      {children}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider manquant');
  return s;
}

/** À utiliser dans les pages où le profil existe forcément */
export function useApp(): Store & { derived: Derived } {
  const s = useStore();
  if (!s.derived) throw new Error('Profil manquant');
  return s as Store & { derived: Derived };
}
