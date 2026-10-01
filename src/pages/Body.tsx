import { useMemo, useState } from 'react';
import { navigate } from '../App';
import { Icon } from '../components/icons';
import { LineChart } from '../components/LineChart';
import { Badge, Card, Field, NumberInput, Segmented, Sheet, Stat } from '../components/ui';
import { fatCategory, ffmiCategory, latestValues, normalizeMeasurement, targetFatRange, trendSeries, type NumericField } from '../lib/bodyComp';
import { parseWeightCsv } from '../lib/csvImport';
import type { Measurement } from '../lib/types';
import { addDays, dayKey, fmt, formatDay, todayISO, uid } from '../lib/util';
import { mergeMeasurements } from '../lib/withings';
import { useApp } from '../store';
import { useWithingsSync } from '../withingsSync';

type Range = 30 | 90 | 365 | 0;

export function Body() {
  const { state, update, derived, toast } = useApp();
  const { snap, profile } = derived;
  const [range, setRange] = useState<Range>(90);
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { sync, busy, connected } = useWithingsSync();

  const ms = useMemo(() => state.measurements.map(normalizeMeasurement), [state.measurements]);
  const since = range ? addDays(todayISO(), -range) : '0000';
  const series = (field: NumericField, alpha?: number) => trendSeries(ms, field, alpha).filter((p) => p.day >= since);
  const weight = series('weightKg');
  const fat = series('fatPct', 0.15);
  const lean = series('leanMassKg', 0.15);
  const muscle = series('muscleMassKg', 0.15);
  const latest = latestValues(ms);
  const [lo, hi] = targetFatRange(profile.sex);
  const cat = fatCategory(profile.sex, snap.fatPct);
  const fatToLose = snap.fatPct > hi ? snap.weightKg * (snap.fatPct / 100) - (snap.leanMassKg * hi) / (100 - hi) : 0;

  const onCsv = async (file: File) => {
    try {
      const res = parseWeightCsv(await file.text());
      const merged = mergeMeasurements(state.measurements, res.measurements);
      update((s) => ({ ...s, measurements: merged.list }));
      toast(`${merged.added} mesure(s) importée(s)${res.skipped ? `, ${res.skipped} ligne(s) ignorée(s)` : ''}`);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <>
      <div className="grid2 grid-stats">
        <Stat label="Poids (tendance)" value={fmt(snap.weightKg)} unit="kg" delta={snap.weeklyRateKg !== undefined ? `${snap.weeklyRateKg > 0 ? '+' : ''}${fmt(snap.weeklyRateKg, 2)} kg/sem.` : undefined} />
        <Stat label="Masse grasse" value={fmt(snap.fatPct)} unit="%" delta={`${fmt(snap.fatMassKg)} kg · ${snap.fatPctSource}`} />
        <Stat label="Masse maigre" value={fmt(snap.leanMassKg)} unit="kg" delta={latest.muscleMassKg ? `Muscle ${fmt(latest.muscleMassKg.value)} kg` : undefined} />
        <Stat label="FFMI" value={fmt(snap.ffmi)} delta={ffmiCategory(profile.sex, snap.ffmi)} />
      </div>

      <Card title="Où tu en es" sub={`Zone cible : ${lo}-${hi} % de masse grasse`}>
        <div className="row wrap" style={{ gap: 8 }}>
          <Badge tone={cat.tone === 'neutral' ? 'neutral' : cat.tone}>{cat.label}</Badge>
          <Badge>IMC {fmt(snap.bmi)}</Badge>
          {snap.waistToHeight && <Badge tone={snap.waistToHeight < 0.5 ? 'good' : 'warning'}>Taille/hauteur {fmt(snap.waistToHeight, 2)}</Badge>}
          {latest.visceralFat && <Badge tone={latest.visceralFat.value <= 9 ? 'good' : 'warning'}>Gras viscéral {latest.visceralFat.value}</Badge>}
          {latest.vascularAge && <Badge>Âge vasculaire {latest.vascularAge.value} ans</Badge>}
        </div>
        <p className="small text-2" style={{ marginBottom: 0 }}>
          {fatToLose > 0.5
            ? `Il te reste environ ${fmt(fatToLose)} kg de gras à perdre pour atteindre ${hi} % en gardant tout ton muscle (≈ ${Math.ceil(fatToLose / Math.max(0.3, Math.abs(derived.targets.targetRateKg)))} semaines au rythme visé).`
            : 'Tu es dans la zone cible : l’objectif est maintenant de construire du muscle en restant sec.'}
        </p>
      </Card>

      <Card
        title="Balance Withings"
        sub={connected ? `Dernière synchro : ${state.settings.withings?.lastSync ? new Date(state.settings.withings.lastSync).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais'}` : 'Non connectée'}
        action={
          connected ? (
            <button className="btn sm primary" disabled={busy} onClick={() => sync(false)}>
              <Icon.refresh /> {busy ? 'Synchro…' : 'Synchroniser'}
            </button>
          ) : (
            <button className="btn sm primary" onClick={() => navigate('settings')}>
              Connecter
            </button>
          )
        }
      >
        <div className="row wrap">
          <button className="btn sm" onClick={() => setAdding(true)}>
            <Icon.plus /> Saisie manuelle
          </button>
          <label className="btn sm">
            <Icon.upload /> Importer un CSV
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onCsv(e.target.files[0])} />
          </label>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Sans connexion : app Withings → Profil → Paramètres → Télécharger mes données, puis importe <span className="kbd">weight.csv</span>.
        </p>
      </Card>

      <Segmented<Range>
        value={range}
        onChange={setRange}
        options={[
          { value: 30, label: '30 j' },
          { value: 90, label: '90 j' },
          { value: 365, label: '1 an' },
          { value: 0, label: 'Tout' },
        ]}
      />

      <Card title="Poids" sub="La tendance lissée gomme les variations d’eau quotidiennes">
        <LineChart data={weight} unit="kg" trendLabel="Tendance" rawLabel="Pesées" />
      </Card>
      {fat.length > 1 && (
        <Card title="Masse grasse" sub="% (tendance)">
          <LineChart data={fat} unit="%" trendLabel="Tendance" rawLabel="Mesures" />
        </Card>
      )}
      {(lean.length > 1 || muscle.length > 1) && (
        <Card title={muscle.length > 1 ? 'Masse musculaire' : 'Masse maigre'} sub="kg (tendance) : l’indicateur clé, elle doit rester stable ou monter">
          <LineChart data={muscle.length > 1 ? muscle : lean} unit="kg" trendLabel="Tendance" rawLabel="Mesures" />
        </Card>
      )}

      <Card title="Historique des mesures">
        <div className="list">
          {state.measurements
            .slice()
            .reverse()
            .slice(0, showAll ? 200 : 8)
            .map((m) => (
              <div key={m.id} className="list-item">
                <div className="main">
                  <div className="title">
                    {m.weightKg !== undefined ? `${fmt(m.weightKg)} kg` : '—'}
                    {m.fatPct !== undefined ? ` · ${fmt(m.fatPct)} %` : ''}
                    {m.muscleMassKg !== undefined ? ` · muscle ${fmt(m.muscleMassKg)} kg` : ''}
                  </div>
                  <div className="sub">
                    {formatDay(dayKey(m.date), { day: 'numeric', month: 'short', year: 'numeric' })} · {m.source === 'withings' ? 'Withings' : m.source === 'csv' ? 'Import CSV' : 'Manuel'}
                  </div>
                </div>
                <button className="icon-btn" aria-label="Supprimer" onClick={() => update((s) => ({ ...s, measurements: s.measurements.filter((x) => x.id !== m.id) }))}>
                  <Icon.trash />
                </button>
              </div>
            ))}
          {state.measurements.length === 0 && <div className="empty">Aucune mesure pour l’instant.</div>}
        </div>
        {state.measurements.length > 8 && (
          <button className="btn ghost block" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Réduire' : `Tout afficher (${state.measurements.length})`}
          </button>
        )}
      </Card>

      {adding && <AddMeasurement onClose={() => setAdding(false)} />}
    </>
  );
}

function AddMeasurement({ onClose }: { onClose: () => void }) {
  const { update, toast } = useApp();
  const [m, setM] = useState<Partial<Measurement>>({});
  const [date, setDate] = useState(todayISO());
  const save = () => {
    if (!m.weightKg && !m.fatPct && !m.waistCm) return;
    const entry: Measurement = { ...m, id: uid(), date: new Date(`${date}T08:00`).toISOString(), source: 'manual' };
    update((s) => ({ ...s, measurements: mergeMeasurements(s.measurements, [entry]).list }));
    toast('Mesure ajoutée');
    onClose();
  };
  const set = (k: keyof Measurement) => (v: number | undefined) => setM((x) => ({ ...x, [k]: v }));
  return (
    <Sheet title="Nouvelle mesure" onClose={onClose}>
      <div className="stack" style={{ gap: 12 }}>
        <Field label="Date">
          <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid2">
          <Field label="Poids">
            <NumberInput value={m.weightKg} onChange={set('weightKg')} unit="kg" />
          </Field>
          <Field label="Masse grasse">
            <NumberInput value={m.fatPct} onChange={set('fatPct')} unit="%" />
          </Field>
          <Field label="Masse musculaire">
            <NumberInput value={m.muscleMassKg} onChange={set('muscleMassKg')} unit="kg" />
          </Field>
          <Field label="Tour de taille">
            <NumberInput value={m.waistCm} onChange={set('waistCm')} unit="cm" />
          </Field>
        </div>
        <button className="btn primary block" onClick={save}>
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}
