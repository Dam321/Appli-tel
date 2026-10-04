import { useMemo, useState } from 'react';
import { navigate } from '../App';
import { Icon } from '../components/icons';
import { Badge, Callout, Card, ConfirmButton, Evidence, Field, NumberInput, Segmented, Sheet, shareOrCopy, type Tone } from '../components/ui';
import { CATEGORIES, derivedMetrics, formatRange, markerStatus, MARKERS, prescriptionText, STATUS_LABEL, type Marker, type MarkerStatus } from '../lib/blood';
import { latestValues } from '../lib/bodyComp';
import { cooperVo2, longevityProtocol, vo2Category } from '../lib/longevity';
import { dailySchedule, medicationWarnings, STATUS_INFO, TIMING_LABEL, type SupplementRec } from '../lib/supplements';
import { fmt, formatDay, todayISO, uid } from '../lib/util';
import { useApp } from '../store';
import { bioAge } from '../lib/bioage';
import { skinPlan, type RoutineStep } from '../lib/skin';
import type { Profile, SkinConcern, SkinType } from '../lib/types';
import { Chips, Toggle } from '../components/ui';

export function Health({ tab }: { tab?: string }) {
  const t = tab === 'blood' || tab === 'longevity' || tab === 'skin' ? tab : 'supplements';
  return (
    <>
      <Segmented
        value={t}
        onChange={(v) => navigate('health', v === 'supplements' ? undefined : v)}
        options={[
          { value: 'supplements', label: 'Compléments' },
          { value: 'blood', label: 'Sang' },
          { value: 'longevity', label: 'Longévité' },
          { value: 'skin', label: 'Peau' },
        ]}
      />
      {t === 'supplements' && <Supplements />}
      {t === 'blood' && <Blood />}
      {t === 'longevity' && <Longevity />}
      {t === 'skin' && <Skin />}
    </>
  );
}

const STATUS_TONE: Record<MarkerStatus, Tone> = {
  optimal: 'good',
  borderline_low: 'warning',
  borderline_high: 'warning',
  low: 'critical',
  high: 'critical',
};

function Supplements() {
  const { derived, state } = useApp();
  const { stack, supplements } = derived;
  const cost = stack.reduce((a, s) => a + (s.costPerMonth ?? 0), 0);
  const others = supplements.filter((s) => !stack.includes(s));
  const warnings = medicationWarnings(derived.profile);
  return (
    <>
      {warnings.length > 0 && (
        <Callout tone="critical" title="Tes traitements : points d’attention">
          {warnings.join(' ')}
        </Callout>
      )}
      {state.bloodPanels.length === 0 && (
        <Callout tone="warning" title="Protocole provisoire" action={<button className="btn sm" onClick={() => navigate('health', 'blood')}>Prise de sang</button>}>
          Sans prise de sang, les doses sont prudentes. Saisis tes résultats pour un protocole vraiment personnalisé (vitamine D, fer, B12, oméga-3…).
        </Callout>
      )}
      <Card title="Ton protocole quotidien" sub={`${stack.length} compléments · ≈ ${cost} €/mois`}>
        {dailySchedule(stack).map((g) => (
          <div key={g.timing} className="list-item" style={{ alignItems: 'flex-start' }}>
            <div className="main">
              <div className="sub">{TIMING_LABEL[g.timing]}</div>
              {g.items.map((s) => (
                <div key={s.id} className="title">
                  {s.name} <span className="small muted">— {s.dose}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>
      <div className="section-title">Détails & preuves</div>
      {stack.map((s) => (
        <SuppCard key={s.id} s={s} />
      ))}
      <div className="section-title">Optionnels, conditionnels & à éviter</div>
      {others.map((s) => (
        <SuppCard key={s.id} s={s} />
      ))}
      <p className="small muted">
        Choisis des marques testées par des laboratoires indépendants. Grossesse, allaitement, traitement en cours ou maladie chronique : valide chaque complément avec ton médecin ou ton pharmacien.
      </p>
    </>
  );
}

function SuppCard({ s }: { s: SupplementRec }) {
  const info = STATUS_INFO[s.status];
  return (
    <Card className="tight">
      <details>
        <summary>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>{s.name}</div>
              <div className="small text-2">{s.dose}</div>
            </div>
            <Badge tone={info.tone === 'neutral' ? 'neutral' : info.tone}>{info.label}</Badge>
          </div>
        </summary>
        <div className="stack" style={{ gap: 8, marginTop: 10 }}>
          <div className="row wrap" style={{ gap: 6 }}>
            <Evidence level={s.evidence} />
            <Badge>{s.category}</Badge>
            {s.costPerMonth !== undefined && <Badge>≈ {s.costPerMonth} €/mois</Badge>}
          </div>
          <div className="small">{s.why}</div>
          <div className="small text-2">
            <b>Forme :</b> {s.form} · <b>Quand :</b> {TIMING_LABEL[s.timing[0]]}
          </div>
          {s.cautions && <div className="small" style={{ color: 'var(--warning-text)' }}>⚠️ {s.cautions}</div>}
        </div>
      </details>
    </Card>
  );
}

function Blood() {
  const { state, update, derived, toast } = useApp();
  const { profile, blood, bloodDates, snap } = derived;
  const [entering, setEntering] = useState(false);
  const derivedM = derivedMetrics(blood);
  const hasData = Object.keys(blood).length > 0;
  const outOfRange = MARKERS.filter((m) => blood[m.id] !== undefined && ['low', 'high'].includes(markerStatus(m, profile.sex, blood[m.id])));

  return (
    <>
      <Card
        title="Bilan à demander"
        sub="Prescription par ton médecin traitant (remboursée pour l’essentiel)"
        action={
          <button className="btn sm" onClick={() => shareOrCopy(prescriptionText(profile.sex, snap.age), 'Bilan sanguin', toast)}>
            <Icon.share /> Partager
          </button>
        }
      >
        <details>
          <summary className="disclosure small" style={{ fontWeight: 600, color: 'var(--accent)' }}>
            Voir la liste et les conditions de prélèvement
          </summary>
          <pre className="small" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '8px 0 0' }}>
            {prescriptionText(profile.sex, snap.age)}
          </pre>
        </details>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Fréquence : bilan de départ, contrôle à 3 mois si tu corriges une carence, puis 1-2 fois par an.
        </p>
      </Card>

      <BioAgeCard />

      <button className="btn primary block" onClick={() => setEntering(true)}>
        <Icon.plus /> Saisir mes résultats
      </button>

      {outOfRange.length > 0 && (
        <Callout tone="critical" title={`${outOfRange.length} valeur(s) hors des normes du laboratoire`}>
          {outOfRange.map((m) => m.short).join(', ')} : montre ces résultats à ton médecin. L’app ne pose pas de diagnostic.
        </Callout>
      )}

      {derivedM.length > 0 && (
        <Card title="Indicateurs calculés">
          {derivedM.map((d) => (
            <div key={d.name} className="list-item">
              <div className="main">
                <div className="title">{d.name}</div>
                <div className="sub">{d.verdict}</div>
              </div>
              <Badge tone={d.tone}>
                {d.value} {d.unit}
              </Badge>
            </div>
          ))}
        </Card>
      )}

      {hasData ? (
        CATEGORIES.map((cat) => {
          const ms = MARKERS.filter((m) => m.category === cat && blood[m.id] !== undefined);
          if (!ms.length) return null;
          return (
            <Card key={cat} title={cat} className="tight">
              {ms.map((m) => (
                <MarkerRow key={m.id} m={m} value={blood[m.id]} date={bloodDates[m.id]} />
              ))}
            </Card>
          );
        })
      ) : (
        <div className="empty">Aucun résultat saisi pour l’instant.</div>
      )}

      {state.bloodPanels.length > 0 && (
        <Card title="Historique des prises de sang">
          {state.bloodPanels
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((p) => (
              <div key={p.id} className="list-item">
                <div className="main">
                  <div className="title">{formatDay(p.date, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  <div className="sub">{Object.keys(p.values).length} marqueurs</div>
                </div>
                <ConfirmButton label="Supprimer la prise de sang" confirmLabel="Supprimer ?" onConfirm={() => update((s) => ({ ...s, bloodPanels: s.bloodPanels.filter((x) => x.id !== p.id) }))}>
                  <Icon.trash />
                </ConfirmButton>
              </div>
            ))}
        </Card>
      )}
      {entering && <BloodEntry onClose={() => setEntering(false)} />}
    </>
  );
}

function MarkerRow({ m, value, date }: { m: Marker; value: number; date: string }) {
  const { derived } = useApp();
  const sex = derived.profile.sex;
  const st = markerStatus(m, sex, value);
  const advice = st === 'low' || st === 'borderline_low' ? m.low : st === 'high' || st === 'borderline_high' ? m.high : undefined;
  return (
    <details className="check" style={{ display: 'block' }}>
      <summary>
        <div className="row between">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{m.name}</div>
            <div className="small muted">
              Optimal {formatRange(m.optimal[sex])} · norme {formatRange(m.ref[sex])} {m.unit}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
              {value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} <span className="small muted">{m.unit}</span>
            </div>
            <Badge tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Badge>
          </div>
        </div>
      </summary>
      <div className="small" style={{ marginTop: 8 }}>
        {m.what}
      </div>
      {advice && <div className="tip">{advice}</div>}
      <div className="small muted" style={{ marginTop: 6 }}>
        Mesuré le {formatDay(date, { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </details>
  );
}

function BloodEntry({ onClose }: { onClose: () => void }) {
  const { update, derived, toast } = useApp();
  const sex = derived.profile.sex;
  const [date, setDate] = useState(todayISO());
  const [vals, setVals] = useState<Record<string, number | undefined>>({});
  const [units, setUnits] = useState<Record<string, string>>(() => {
    // Unités usuelles des laboratoires français par défaut
    const fr: Record<string, string> = { glucose: 'g/L', ldl: 'g/L', hdl: 'g/L', triglycerides: 'g/L', cholesterol: 'g/L', creatinine: 'mg/L', uric_acid: 'mg/L', testosterone: 'ng/mL' };
    return fr;
  });

  const save = () => {
    const values: Record<string, number> = {};
    for (const m of MARKERS) {
      const v = vals[m.id];
      if (v === undefined || Number.isNaN(v)) continue;
      const u = units[m.id] ?? m.unit;
      const conv = u === m.unit ? (x: number) => x : m.altUnits?.find((a) => a.unit === u)?.toCanonical ?? ((x: number) => x);
      values[m.id] = Math.round(conv(v) * 1000) / 1000;
    }
    if (!Object.keys(values).length) {
      toast('Saisis au moins une valeur');
      return;
    }
    update((s) => ({ ...s, bloodPanels: [...s.bloodPanels, { id: uid(), date, values }] }));
    toast(`${Object.keys(values).length} résultat(s) enregistré(s)`);
    onClose();
  };

  return (
    <Sheet title="Résultats de prise de sang" onClose={onClose}>
      <div className="stack" style={{ gap: 12 }}>
        <Field label="Date du prélèvement">
          <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <p className="small muted" style={{ margin: 0 }}>
          Remplis seulement ce que tu as. Choisis l’unité indiquée sur ton compte-rendu.
        </p>
        {CATEGORIES.map((cat) => (
          <details key={cat} open={cat === CATEGORIES[0]}>
            <summary className="disclosure" style={{ fontWeight: 650, padding: '8px 0' }}>
              {cat}
            </summary>
            <div className="stack" style={{ gap: 10 }}>
              {MARKERS.filter((m) => m.category === cat).map((m) => {
                const opts = [m.unit, ...(m.altUnits?.map((a) => a.unit) ?? [])];
                return (
                  <div key={m.id}>
                    <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>
                      {m.name} <span className="muted">(norme {formatRange(m.ref[sex])} {m.unit})</span>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <NumberInput value={vals[m.id]} onChange={(v) => setVals((x) => ({ ...x, [m.id]: v }))} />
                      </div>
                      {opts.length > 1 ? (
                        <select className="input" style={{ width: 120 }} value={units[m.id] ?? m.unit} onChange={(e) => setUnits((u) => ({ ...u, [m.id]: e.target.value }))}>
                          {opts.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="small muted" style={{ width: 120, textAlign: 'center' }}>
                          {m.unit}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        ))}
        <button className="btn primary block" onClick={save}>
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}

function Longevity() {
  const { state, update, derived, toast } = useApp();
  const { profile, snap } = derived;
  const [cooper, setCooper] = useState<number | undefined>();
  const [manual, setManual] = useState<number | undefined>();
  const vo2 = latestValues(state.measurements).vo2max;
  const cat = vo2 ? vo2Category(profile.sex, snap.age, vo2.value) : undefined;

  const saveVo2 = (v: number) => {
    update((s) => ({ ...s, measurements: [...s.measurements, { id: uid(), date: new Date().toISOString(), source: 'manual', vo2max: v }] }));
    toast(`VO2max ${v} enregistrée`);
  };

  return (
    <>
      <Card title="VO2max" sub="Ta capacité cardio-respiratoire, prédicteur n°1 de longévité">
        {vo2 && cat ? (
          <div className="row between">
            <div>
              <span className="hero-number">{fmt(vo2.value)}</span> <span className="text-2">mL/kg/min</span>
            </div>
            <Badge tone={cat.tone === 'neutral' ? 'neutral' : cat.tone}>{cat.label}</Badge>
          </div>
        ) : (
          <p className="small text-2" style={{ marginTop: 0 }}>
            Mesure-la avec ta montre (Withings ScanWatch, Apple Watch, Garmin…) ou par le test de Cooper.
          </p>
        )}
        <hr className="sep" />
        <div className="grid2">
          <Field label="Test de Cooper" hint="Distance max courue en 12 min">
            <NumberInput value={cooper} onChange={setCooper} unit="m" step={10} />
          </Field>
          <Field label="Valeur connue" hint="Montre / test en labo">
            <NumberInput value={manual} onChange={setManual} unit="mL/kg" />
          </Field>
        </div>
        <button
          className="btn block"
          style={{ marginTop: 10 }}
          disabled={!cooper && !manual}
          onClick={() => {
            const v = manual ?? (cooper ? cooperVo2(cooper) : undefined);
            if (v) saveVo2(v);
            setCooper(undefined);
            setManual(undefined);
          }}
        >
          Enregistrer ma VO2max
        </button>
      </Card>

      {longevityProtocol(profile, snap.age).map((sec) => (
        <Card key={sec.title} title={sec.title} className="tight">
          {sec.items.map((it) => (
            <details key={it.title} className="check" style={{ display: 'block' }}>
              <summary className="disclosure">
                <span style={{ fontWeight: 600 }}>{it.title}</span>
              </summary>
              <div className="small" style={{ marginTop: 6 }}>
                {it.text}
              </div>
              {it.evidence && (
                <div style={{ marginTop: 6 }}>
                  <Evidence level={it.evidence} />
                </div>
              )}
            </details>
          ))}
        </Card>
      ))}
    </>
  );
}

function BioAgeCard() {
  const { state, derived } = useApp();
  const bio = useMemo(() => bioAge(state.bloodPanels, derived.profile), [state.bloodPanels, derived.profile]);
  if (bio.phenoAge === undefined)
    return state.bloodPanels.length ? (
      <Callout title="Âge biologique : presque prêt" action={<button className="btn sm" onClick={() => navigate('score')}>En savoir plus</button>}>
        Il manque {bio.missing.join(', ')} pour calculer ton âge biologique (PhenoAge).
      </Callout>
    ) : null;
  return (
    <Card title="Ton âge biologique" action={<button className="btn sm" onClick={() => navigate('score')}>Bilan 360°</button>}>
      <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
        <span className="hero-number">{bio.phenoAge.toFixed(1).replace('.', ',')}</span>
        <span className="text-2">ans pour {bio.chronoAge} ans réels</span>
      </div>
    </Card>
  );
}

const SKIN_TYPES: { value: SkinType; label: string }[] = [
  { value: 'normal', label: 'Normale' },
  { value: 'oily', label: 'Grasse' },
  { value: 'combination', label: 'Mixte' },
  { value: 'dry', label: 'Sèche' },
  { value: 'sensitive', label: 'Sensible' },
];

const CONCERNS: { value: SkinConcern; label: string }[] = [
  { value: 'aging', label: 'Rides / fermeté' },
  { value: 'pigmentation', label: 'Taches' },
  { value: 'acne', label: 'Acné / boutons' },
  { value: 'redness', label: 'Rougeurs' },
  { value: 'pores', label: 'Pores / brillance' },
  { value: 'dark_circles', label: 'Cernes' },
];

function Steps({ steps }: { steps: RoutineStep[] }) {
  return (
    <div className="list">
      {steps.map((st, i) => (
        <div key={st.product} className="list-item" style={{ alignItems: 'flex-start' }}>
          <span className="rank">{i + 1}</span>
          <div className="main">
            <div className="title">
              {st.product} {st.rx && <Badge tone="warning">ordonnance</Badge>}
            </div>
            <div className="sub">{st.detail}</div>
            <div style={{ marginTop: 6 }}>
              <Evidence level={st.evidence} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Skin() {
  const { derived, update } = useApp();
  const p = derived.profile;
  const plan = useMemo(() => skinPlan(p), [p]);
  const set = (patch: Partial<Profile>) => update((s) => ({ ...s, profile: { ...s.profile!, ...patch } }));
  return (
    <>
      <Card title="Ta peau" sub="La routine se recalcule à chaque changement">
        <div className="stack" style={{ gap: 12 }}>
          <Field label="Type de peau">
            <Segmented value={p.skinType} onChange={(skinType) => set({ skinType })} options={SKIN_TYPES} />
          </Field>
          <Field label="Ce que tu veux améliorer">
            <Chips options={CONCERNS} selected={p.skinConcerns} onToggle={(v) => set({ skinConcerns: p.skinConcerns.includes(v) ? p.skinConcerns.filter((x) => x !== v) : [...p.skinConcerns, v] })} />
          </Field>
          <Toggle label="Chute de cheveux / cheveux qui s’affinent" checked={p.hairLoss} onChange={(hairLoss) => set({ hairLoss })} />
        </div>
      </Card>
      {plan.notes.map((n) => (
        <Callout key={n} title="À savoir">
          {n}
        </Callout>
      ))}
      <Card title="Routine du matin">
        <Steps steps={plan.am} />
      </Card>
      <Card title="Routine du soir">
        <Steps steps={plan.pm} />
      </Card>
      {plan.weekly.length > 0 && (
        <Card title="Chaque semaine">
          <Steps steps={plan.weekly} />
        </Card>
      )}
      {plan.hair.length > 0 && (
        <Card title="Cheveux">
          <Steps steps={plan.hair} />
        </Card>
      )}
      <Card title="Sourire">
        <Steps steps={plan.teeth} />
      </Card>
      <Card title="Ce qui se voit de l’extérieur commence à l’intérieur">
        <ul className="steps" style={{ color: 'var(--text)' }}>
          {plan.lifestyle.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Card>
      <p className="small muted">Types de produits, pas de marques. Peau très réactive, acné sévère ou grain de beauté qui change : consulte un dermatologue.</p>
    </>
  );
}
