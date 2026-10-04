import { useState, type ReactNode } from 'react';
import { Icon } from '../components/icons';
import { Badge, Callout, Card, ConfirmButton, Field, Segmented } from '../components/ui';
import { defaultState, exportState, importState } from '../lib/storage';
import type { Profile } from '../lib/types';
import { todayISO } from '../lib/util';
import { authorizeUrl, redirectUri } from '../lib/withings';
import { useApp } from '../store';
import { useWithingsSync } from '../withingsSync';
import { INSTALLED_APP_URL, IS_ARTIFACT } from '../env';
import { FoodStep, GoalStep, HealthStep, IdentityStep, RecoveryStep, RhythmStep, TrainingStep } from './ProfileForm';

function Section({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <Card className="tight">
      <details open={open}>
        <summary className="disclosure" style={{ fontWeight: 650, padding: '4px 0' }}>
          {title}
        </summary>
        <div style={{ marginTop: 12 }}>{children}</div>
      </details>
    </Card>
  );
}

export function Settings({ oauthError }: { oauthError: string | null }) {
  const { state, update, toast, derived } = useApp();
  const p = derived.profile;
  const set = (patch: Partial<Profile>) => update((s) => ({ ...s, profile: { ...s.profile!, ...patch } }));
  const w = state.settings.withings;
  const [clientId, setClientId] = useState(w?.clientId ?? '');
  const [clientSecret, setClientSecret] = useState(w?.clientSecret ?? '');
  const [apiKey, setApiKey] = useState(state.settings.anthropicKey ?? '');
  const { sync, busy } = useWithingsSync();

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copié');
    } catch {
      toast('Copie impossible : sélectionne le texte');
    }
  };

  const connect = () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast('Renseigne le Client ID et le Secret');
      return;
    }
    const st = Math.random().toString(36).slice(2);
    const auth = { ...(w ?? {}), clientId: clientId.trim(), clientSecret: clientSecret.trim(), pendingState: st };
    update((s) => ({ ...s, settings: { ...s.settings, withings: auth } }));
    // Laisse le temps à l'enregistrement local avant de quitter la page.
    setTimeout(() => {
      window.location.href = authorizeUrl(auth, st);
    }, 400);
  };

  const doExport = async () => {
    const json = exportState(state);
    const name = `vitalis-sauvegarde-${todayISO()}.json`;
    const file = new File([json], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Sauvegarde Vitalis' });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const doImport = async (f: File) => {
    try {
      const imported = importState(await f.text());
      update((s) => ({
        ...imported,
        // On garde les identifiants déjà présents sur cet appareil si la sauvegarde n'en contient pas.
        settings: {
          ...imported.settings,
          anthropicKey: imported.settings.anthropicKey || s.settings.anthropicKey,
          withings: imported.settings.withings?.clientSecret ? imported.settings.withings : s.settings.withings,
        },
      }));
      toast('Sauvegarde restaurée ✔');
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <>
      {oauthError && <Callout tone="critical" title="Connexion Withings impossible">{oauthError}</Callout>}

      <Card
        title="Balance Withings"
        sub={w?.refreshToken ? 'Connectée' : 'Synchronise automatiquement poids, % de gras, masse musculaire, pas…'}
        action={w?.refreshToken ? <Badge tone="good">Connectée</Badge> : <Badge>Non connectée</Badge>}
      >
        {IS_ARTIFACT ? (
          <p className="small text-2" style={{ margin: 0 }}>
            La synchronisation Withings fonctionne dans l’app installée sur ton téléphone ({INSTALLED_APP_URL}). Ici, importe ton fichier <span className="kbd">weight.csv</span> depuis l’onglet Corps.
          </p>
        ) : w?.refreshToken ? (
          <div className="row wrap">
            <button className="btn sm primary" disabled={busy} onClick={() => sync(false)}>
              <Icon.refresh /> {busy ? 'Synchro…' : 'Synchroniser maintenant'}
            </button>
            <button
              className="btn sm danger"
              onClick={() => {
                update((s) => ({ ...s, settings: { ...s.settings, withings: s.settings.withings && { clientId: s.settings.withings.clientId, clientSecret: s.settings.withings.clientSecret } } }));
                toast('Withings déconnecté');
              }}
            >
              Déconnecter
            </button>
          </div>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            <ol className="steps" style={{ color: 'var(--text)', marginTop: 0 }}>
              <li>
                Va sur{' '}
                <a href="https://developer.withings.com/dashboard/" target="_blank" rel="noreferrer">
                  developer.withings.com
                </a>
                , connecte-toi avec ton compte Withings et crée une application <b>« Public API integration »</b> (gratuit, 2 min).
              </li>
              <li>
                Dans <b>Callback URL</b>, colle exactement cette adresse :
                <div className="row" style={{ marginTop: 6 }}>
                  <span className="kbd" style={{ flex: 1 }}>
                    {redirectUri()}
                  </span>
                  <button className="icon-btn" aria-label="Copier l’URL" onClick={() => copy(redirectUri())}>
                    <Icon.copy />
                  </button>
                </div>
              </li>
              <li>Copie le <b>Client ID</b> et le <b>Client Secret</b> ci-dessous, puis « Connecter ».</li>
            </ol>
            <Field label="Client ID">
              <input className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
            </Field>
            <Field label="Client Secret" hint="Stocké uniquement sur ce téléphone.">
              <input className="input" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="off" />
            </Field>
            <button className="btn primary block" onClick={connect}>
              <Icon.link /> Connecter ma balance
            </button>
            <p className="small muted" style={{ margin: 0 }}>
              Sur iPhone, fais la connexion depuis l’app installée sur l’écran d’accueil. Alternative sans compte développeur : import du fichier CSV dans l’onglet Corps.
            </p>
          </div>
        )}
      </Card>

      {!IS_ARTIFACT && (
      <Card title="Coach IA (Claude)" sub="Pose toutes tes questions, il connaît toutes tes données" action={state.settings.anthropicKey ? <Badge tone="good">Activé</Badge> : <Badge>Optionnel</Badge>}>
        <Field label="Clé API Anthropic" hint={<>Crée-la sur <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a> (facturé à l’usage, quelques centimes par question). Stockée uniquement sur ce téléphone.</>}>
          <input className="input" type="password" placeholder="sk-ant-…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
        </Field>
        <button
          className="btn block"
          style={{ marginTop: 10 }}
          onClick={() => {
            update((s) => ({ ...s, settings: { ...s.settings, anthropicKey: apiKey.trim() || undefined } }));
            toast(apiKey.trim() ? 'Clé enregistrée' : 'Clé supprimée');
          }}
        >
          Enregistrer
        </button>
      </Card>
      )}

      <div className="section-title">Mon profil</div>
      <Section title="Identité & mensurations">
        <IdentityStep p={p} set={set} />
      </Section>
      <Section title="Objectif & niveau">
        <GoalStep p={p} set={set} />
      </Section>
      <Section title="Entraînement & matériel">
        <TrainingStep p={p} set={set} />
      </Section>
      <Section title="Rythme, jours & muscles prioritaires">
        <RhythmStep p={p} set={set} />
      </Section>
      <Section title="Santé, traitements & antécédents">
        <HealthStep p={p} set={set} />
      </Section>
      <Section title="Alimentation">
        <FoodStep p={p} set={set} />
      </Section>
      <Section title="Sommeil & stress">
        <RecoveryStep p={p} set={set} />
      </Section>

      <div className="section-title">Application</div>
      <Card title="Apparence">
        <Segmented
          value={state.settings.theme}
          onChange={(theme) => update((s) => ({ ...s, settings: { ...s.settings, theme } }))}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Clair' },
            { value: 'dark', label: 'Sombre' },
          ]}
        />
      </Card>

      <Card
        title="Mes données"
        sub={IS_ARTIFACT ? 'Version aperçu : les données restent dans ce navigateur. L’export de fichier fonctionne dans l’app installée.' : 'Tout est stocké sur ce téléphone. Fais une sauvegarde de temps en temps.'}
      >
        <div className="row wrap">
          <button className="btn sm" onClick={doExport}>
            <Icon.download /> Exporter
          </button>
          <label className="btn sm">
            <Icon.upload /> Importer
            <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          </label>
          <ConfirmButton className="btn sm danger" label="Tout effacer" confirmLabel="Effacer définitivement ?" onConfirm={() => update(() => defaultState())}>
            <Icon.trash /> Tout effacer
          </ConfirmButton>
        </div>
        <details style={{ marginTop: 12 }}>
          <summary className="disclosure small" style={{ fontWeight: 600 }}>
            Import automatique depuis l’app Santé (iPhone)
          </summary>
          <p className="small text-2">
            Crée un Raccourci iOS : « Rechercher des échantillons de santé » (Poids, Masse grasse) → « Ouvrir l’URL » :
          </p>
          <div className="kbd">{`${redirectUri()}#import?date=AAAA-MM-JJ&weight=82.4&fat=17.9&muscle=64.1`}</div>
          <p className="small muted">Paramètres acceptés : weight, fat (%), muscle, lean, bone, water (kg), waist (cm), date.</p>
        </details>
      </Card>

      <Card title="À propos">
        <p className="small text-2" style={{ marginTop: 0 }}>
          Vitalis s’appuie sur la littérature scientifique récente (ISSN, ACSM, méta-analyses sur l’hypertrophie, la nutrition et la longévité). Les recommandations sont générales et ne
          remplacent pas un avis médical : en cas de maladie, de traitement, de grossesse ou de résultat sanguin anormal, consulte ton médecin.
        </p>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Données : stockage local du navigateur. Échanges réseau uniquement avec Withings (si connecté) et Anthropic (si le coach IA est activé).
        </p>
      </Card>
    </>
  );
}
