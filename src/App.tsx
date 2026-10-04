import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './components/icons';
import { measurementFromUrl } from './lib/csvImport';
import { mergeMeasurements, exchangeCode, redirectUri } from './lib/withings';
import { daysBetween, mondayOf, nextSeed, todayISO } from './lib/util';
import { requestPersistence } from './lib/storage';
import { useStore } from './store';
import { useWithingsSync } from './withingsSync';
import { IS_ARTIFACT } from './env';
import { Onboarding } from './pages/Onboarding';
import { Today } from './pages/Today';
import { Body } from './pages/Body';
import { Training } from './pages/Training';
import { Nutrition } from './pages/Nutrition';
import { Health } from './pages/Health';
import { Settings } from './pages/Settings';
import { Coach } from './pages/Coach';
import { Score } from './pages/Score';

export type Route = 'home' | 'body' | 'training' | 'nutrition' | 'health' | 'settings' | 'coach' | 'score';

const TITLES: Record<Route, string> = {
  home: 'Aujourd’hui',
  body: 'Corps',
  training: 'Entraînement',
  nutrition: 'Nutrition',
  health: 'Santé & longévité',
  settings: 'Réglages',
  coach: 'Coach IA',
  score: 'Bilan 360°',
};

function parseHash(): { route: Route; tab?: string } {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const route = (Object.keys(TITLES) as Route[]).includes(path as Route) ? (path as Route) : 'home';
  const tab = new URLSearchParams(query ?? '').get('tab') ?? undefined;
  return { route, tab };
}

export function navigate(route: Route, tab?: string) {
  window.location.hash = `#/${route}${tab ? `?tab=${tab}` : ''}`;
}

export function App() {
  const { state, update, toast, derived } = useStore();
  const [loc, setLoc] = useState(parseHash);
  const { sync } = useWithingsSync();
  const [oauthError, setOauthError] = useState<string | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    const on = () => {
      setLoc(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // Démarrage : retour OAuth Withings, import par URL, nouvelle semaine.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void requestPersistence();

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const st = params.get('state');
    if (code && st) {
      window.history.replaceState(null, '', redirectUri() + '#/settings');
      setLoc({ route: 'settings' });
      const auth = state.settings.withings;
      if (!auth?.clientId || auth.pendingState !== st) {
        setOauthError(
          'Le retour de Withings s’est ouvert dans un autre contexte que l’application (fréquent sur iPhone). Ouvre l’app depuis l’écran d’accueil et relance « Connecter » ; si le problème persiste, fais la connexion depuis Safari puis utilise « Exporter → Importer » pour transférer.',
        );
      } else {
        exchangeCode(auth, code)
          .then((a) => {
            update((s) => ({ ...s, settings: { ...s.settings, withings: a } }));
            toast('Balance Withings connectée ✔');
            setTimeout(() => void sync(false), 300);
          })
          .catch((e: Error) => setOauthError(e.message));
      }
    }

    const m = measurementFromUrl(window.location.hash);
    if (m) {
      update((s) => ({ ...s, measurements: mergeMeasurements(s.measurements, [m]).list }));
      toast('Mesure importée ✔');
      navigate('body');
    }

    const monday = mondayOf(todayISO());
    if (state.plan.mealWeekStart !== monday) {
      update((s) => ({
        ...s,
        plan: {
          ...s.plan,
          mealWeekStart: monday,
          // Semaine suivante directe : même graine que l'aperçu « semaine prochaine » des courses.
          mealSeed: daysBetween(s.plan.mealWeekStart, monday) === 7 ? nextSeed(s.plan.mealSeed) : Math.floor(Math.random() * 1e9),
          mealOverrides: {},
          shoppingChecked: Object.fromEntries(Object.entries(s.plan.shoppingChecked).filter(([k]) => k.slice(0, 10) >= monday)),
          mealTargets: undefined,
        },
      }));
    }
  }, []);

  // Synchro Withings automatique à l'ouverture (si > 1 h)
  useEffect(() => {
    const w = state.settings.withings;
    if (IS_ARTIFACT || !w?.refreshToken) return;
    if (w.lastSync && Date.now() - new Date(w.lastSync).getTime() < 3600_000) return;
    void sync(true);
  }, [state.settings.withings?.refreshToken]);

  // Fige les cibles du menu de la semaine (la liste de courses ne bouge plus ensuite).
  useEffect(() => {
    if (!derived || state.plan.mealTargets) return;
    const t = derived.targets;
    update((s) => ({ ...s, plan: { ...s.plan, mealTargets: { kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat } } }));
  }, [derived, state.plan.mealTargets, update]);

  if (!state.profile) return <Onboarding />;

  const page: Record<Route, ReactNode> = {
    home: <Today />,
    body: <Body />,
    training: <Training tab={loc.tab} />,
    nutrition: <Nutrition tab={loc.tab} />,
    health: <Health tab={loc.tab} />,
    settings: <Settings oauthError={oauthError} />,
    coach: <Coach />,
    score: <Score />,
  };

  const nav: { route: Route; label: string; icon: ReactNode }[] = [
    { route: 'home', label: 'Accueil', icon: <Icon.home /> },
    { route: 'body', label: 'Corps', icon: <Icon.body /> },
    { route: 'training', label: 'Sport', icon: <Icon.dumbbell /> },
    { route: 'nutrition', label: 'Nutrition', icon: <Icon.food /> },
    { route: 'health', label: 'Santé', icon: <Icon.heart /> },
  ];
  const sub = loc.route === 'settings' || loc.route === 'coach' || loc.route === 'score';

  return (
    <div className="app">
      <header className="topbar">
        {sub && (
          <button className="icon-btn" aria-label="Retour" onClick={() => (window.history.length > 1 ? window.history.back() : navigate('home'))}>
            <Icon.back />
          </button>
        )}
        <h1>{TITLES[loc.route]}</h1>
        {loc.route !== 'coach' && (
          <button className="icon-btn" aria-label="Coach IA" onClick={() => navigate('coach')}>
            <Icon.sparkles />
          </button>
        )}
        {loc.route !== 'settings' && (
          <button className="icon-btn" aria-label="Réglages" onClick={() => navigate('settings')}>
            <Icon.settings />
          </button>
        )}
      </header>
      <main className="page">{page[loc.route]}</main>
      <nav className="bottomnav" aria-label="Navigation principale">
        {nav.map((n) => (
          <button key={n.route} className={loc.route === n.route ? 'active' : ''} aria-current={loc.route === n.route ? 'page' : undefined} onClick={() => navigate(n.route)}>
            {n.icon}
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
