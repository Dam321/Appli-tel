import { useMemo, useState } from 'react';
import { navigate } from '../App';
import { Icon } from '../components/icons';
import { LineChart } from '../components/LineChart';
import { Badge, Card, Field, NumberInput, Segmented, Sheet, Stat } from '../components/ui';
import { bpCategory, fatCategory, ffmiCategory, latestValues, normalizeMeasurement, proportions, restingHrCategory, targetFatRange, trendSeries, type NumericField } from '../lib/bodyComp';
import { ProgressPhotos } from '../components/ProgressPhotos';
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
  const [taping, setTaping] = useState(false);
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

      <MeasuresCard onAdd={() => setTaping(true)} />
      <ProgressPhotos />

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
      {taping && <AddTape onClose={() => setTaping(false)} />}
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

function MeasuresCard({ onAdd }: { onAdd: () => void }) {
  const { state, derived } = useApp();
  const { profile, snap } = derived;
  const ms = state.measurements;
  const l = latestValues(ms);
  const prop = proportions(profile.sex, profile.heightCm, ms);
  const bp = l.systolic && l.diastolic ? bpCategory(l.systolic.value, l.diastolic.value) : undefined;
  const rhr = l.restingHr ?? l.heartRate;
  const rhrCat = rhr ? restingHrCategory(rhr.value) : undefined;
  const tape: [string, number | undefined][] = [
    ['Cou', l.neckCm?.value],
    ['Épaules', l.shouldersCm?.value],
    ['Poitrine', l.chestCm?.value],
    ['Taille', l.waistCm?.value],
    ['Hanches', l.hipCm?.value],
    ['Bras (contracté)', l.armCm?.value],
    ['Cuisse', l.thighCm?.value],
  ];
  const hasTape = tape.some(([, v]) => v !== undefined);
  return (
    <Card
      title="Mensurations & santé cardio"
      sub="Le mètre ruban et la tension complètent la balance"
      action={
        <button className="btn sm" onClick={onAdd}>
          <Icon.plus /> Saisir
        </button>
      }
    >
      {hasTape ? (
        <div className="row wrap" style={{ gap: 6 }}>
          {tape
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => (
              <Badge key={k}>
                {k} {fmt(v, 1)} cm
              </Badge>
            ))}
        </div>
      ) : (
        <p className="small text-2" style={{ marginTop: 0 }}>
          Mesure cou, épaules, taille et hanches une fois par mois : l’app en déduit tes proportions et recoupe ton % de gras.
        </p>
      )}
      <div className="list" style={{ marginTop: 8 }}>
        {prop.shoulderToWaist && (
          <div className="list-item">
            <div className="main">
              <div className="title">Ratio épaules / taille (silhouette en V)</div>
              <div className="sub">Idéal esthétique {prop.shoulderToWaist.target} : épaules larges, taille fine</div>
            </div>
            <Badge tone={prop.shoulderToWaist.ok ? 'good' : 'warning'}>{fmt(prop.shoulderToWaist.value, 2)}</Badge>
          </div>
        )}
        {prop.waistToHip && (
          <div className="list-item">
            <div className="main">
              <div className="title">Ratio taille / hanches</div>
              <div className="sub">Marqueur de graisse abdominale, cible {prop.waistToHip.target}</div>
            </div>
            <Badge tone={prop.waistToHip.ok ? 'good' : 'warning'}>{fmt(prop.waistToHip.value, 2)}</Badge>
          </div>
        )}
        {prop.navyFatPct !== undefined && (
          <div className="list-item">
            <div className="main">
              <div className="title">% de gras au mètre ruban (méthode Navy)</div>
              <div className="sub">À comparer à la balance ({fmt(snap.fatPct)} %) : la vérité est souvent entre les deux</div>
            </div>
            <Badge>{fmt(prop.navyFatPct)} %</Badge>
          </div>
        )}
        {bp && (
          <div className="list-item">
            <div className="main">
              <div className="title">
                Tension {l.systolic!.value}/{l.diastolic!.value} mmHg
              </div>
              <div className="sub">Objectif longévité : moins de 120/80</div>
            </div>
            <Badge tone={bp.tone === 'neutral' ? 'neutral' : bp.tone}>{bp.label}</Badge>
          </div>
        )}
        {rhr && rhrCat && (
          <div className="list-item">
            <div className="main">
              <div className="title">Fréquence cardiaque {l.restingHr ? 'de repos' : '(balance, debout)'} : {Math.round(rhr.value)} bpm</div>
              <div className="sub">Elle baisse quand ton cardio progresse</div>
            </div>
            <Badge tone={rhrCat.tone === 'neutral' ? 'neutral' : rhrCat.tone}>{rhrCat.label}</Badge>
          </div>
        )}
      </div>
    </Card>
  );
}

function AddTape({ onClose }: { onClose: () => void }) {
  const { update, toast } = useApp();
  const [m, setM] = useState<Partial<Measurement>>({});
  const [date, setDate] = useState(todayISO());
  const set = (k: keyof Measurement) => (v: number | undefined) => setM((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!Object.values(m).some((v) => v !== undefined)) return;
    const entry: Measurement = { ...m, id: uid(), date: new Date(`${date}T08:00`).toISOString(), source: 'manual' };
    update((s) => ({ ...s, measurements: mergeMeasurements(s.measurements, [entry]).list }));
    toast('Mensurations enregistrées');
    onClose();
  };
  const fields: [keyof Measurement, string, string][] = [
    ['neckCm', 'Cou', 'Sous la pomme d’Adam'],
    ['shouldersCm', 'Épaules', 'Tour complet, au plus large'],
    ['chestCm', 'Poitrine', 'Au niveau des mamelons, expiré'],
    ['waistCm', 'Taille', 'Au nombril, relâché'],
    ['hipCm', 'Hanches', 'Au plus large des fessiers'],
    ['armCm', 'Bras', 'Biceps contracté, au plus large'],
    ['thighCm', 'Cuisse', 'Sous le pli fessier'],
  ];
  return (
    <Sheet title="Mensurations & cardio" onClose={onClose}>
      <div className="stack" style={{ gap: 12 }}>
        <Field label="Date">
          <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid2">
          {fields.map(([k, label, hint]) => (
              <Field key={k} label={label} hint={hint}>
                <NumberInput value={m[k] as number | undefined} onChange={set(k)} unit="cm" />
              </Field>
            ))}
        </div>
        <div className="section-title">Cardio (optionnel)</div>
        <div className="grid3">
          <Field label="FC repos" hint="Au réveil, couché">
            <NumberInput value={m.restingHr} onChange={set('restingHr')} unit="bpm" step={1} />
          </Field>
          <Field label="Tension sys.">
            <NumberInput value={m.systolic} onChange={set('systolic')} step={1} />
          </Field>
          <Field label="Tension dia.">
            <NumberInput value={m.diastolic} onChange={set('diastolic')} step={1} />
          </Field>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Tension : assis, au calme depuis 5 min, 3 mesures le matin, garde la moyenne.
        </p>
        <button className="btn primary block" onClick={save}>
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}
