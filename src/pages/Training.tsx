import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../App';
import { Icon } from '../components/icons';
import { Badge, Card, ConfirmButton, Field, NumberInput, Segmented, Sheet } from '../components/ui';
import { EXERCISE_BY_ID } from '../data/exercises';
import { adjustForReadiness, exerciseHistory, isStalled, lastPerformance, PRIORITY_INFO, readinessAdvice, readinessScore, setsText, suggestNext, type ProgramExercise, type ProgramSession } from '../lib/training';
import type { WorkoutLog } from '../lib/types';
import { formatDay, mondayOf, todayISO, uid, WEEKDAYS_SHORT, weekdayIndex } from '../lib/util';
import { useApp } from '../store';
import { setDaily } from './Today';

export function Training({ tab }: { tab?: string }) {
  const { derived } = useApp();
  const { state } = useApp();
  if (tab?.startsWith('log-')) {
    const session = derived.program.sessions.find((s) => s.id === tab.slice(4));
    const r = state.daily[todayISO()]?.readiness;
    const advice = r ? readinessAdvice(readinessScore(r)) : undefined;
    if (session) return <WorkoutLogger session={advice ? adjustForReadiness(session, advice.level) : session} lighter={advice?.level === 'easy'} />;
  }
  return tab === 'history' ? <History /> : <ProgramView />;
}

function Tabs({ value }: { value: 'program' | 'history' }) {
  return (
    <Segmented
      value={value}
      onChange={(v) => navigate('training', v === 'program' ? undefined : v)}
      options={[
        { value: 'program', label: 'Programme' },
        { value: 'history', label: 'Historique & records' },
      ]}
    />
  );
}

function ProgramView() {
  const { state, update, derived, toast } = useApp();
  const { program, profile } = derived;
  const todayIdx = weekdayIndex(todayISO());
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <Tabs value="program" />
      <Card title={program.splitName} sub={`Cycle ${program.cycle} · semaine ${program.week}/5`} action={program.deload ? <Badge tone="warning">Décharge</Badge> : <Badge tone="accent">RIR {program.sessions[0]?.exercises[0]?.rir}</Badge>}>
        <div className="week-strip">
          {program.schedule.map((d) => (
            <div key={d.weekday} className={`${d.sessionId ? 'lift' : ''} ${d.weekday === todayIdx ? 'today' : ''}`}>
              <b>{WEEKDAYS_SHORT[d.weekday]}</b>
              <span>{d.sessionId ? program.sessions.find((s) => s.id === d.sessionId)!.name.replace('Haut du corps', 'Haut').replace('Bas du corps', 'Bas').replace('Full body', 'Full') : d.cardio === 'zone2' ? 'Zone 2' : d.cardio === 'vo2max' ? 'VO2max' : 'Repos'}</span>
              {d.label.includes('+') && <span className="muted">+ cardio</span>}
            </div>
          ))}
        </div>
        <div className="tip">{program.weekNote}</div>
        {profile.priorities.length > 0 && (
          <div className="small text-2" style={{ marginTop: 8 }}>
            Muscles prioritaires (volume renforcé) : {profile.priorities.map((p) => PRIORITY_INFO[p].label).join(', ')}.
            {profile.sessionMinutes <= 60 && ' Avec des séances de 75 min, ils recevraient encore plus de volume.'}
          </div>
        )}
        {derived.autoVolume.notes.map((n) => (
          <div key={n} className="tip">
            🧠 {n}
          </div>
        ))}
        {program.healthNotes.map((n) => (
          <div key={n} className="tip" style={{ background: 'var(--warning-soft)' }}>
            {n}
          </div>
        ))}
      </Card>

      {program.sessions.map((s) => (
        <Card
          key={s.id}
          title={s.name}
          sub={`${s.focus} · ~${s.estMinutes} min`}
          action={
            <button className="btn sm primary" onClick={() => navigate('training', `log-${s.id}`)}>
              Démarrer
            </button>
          }
        >
          <div className="list">
            {s.exercises.map((e) => {
              const ex = EXERCISE_BY_ID[e.exerciseId];
              const key = `${s.id}-${e.exerciseId}`;
              return (
                <div key={e.exerciseId} className="list-item" style={{ alignItems: 'flex-start' }} onClick={() => setOpen(open === key ? null : key)}>
                  <div className="main">
                    <div className="title">
                      {e.name} {e.priority && <Badge tone="good">priorité</Badge>} {ex.lengthened && <Badge tone="accent">étirement</Badge>} {e.superset && <Badge>superset</Badge>}
                    </div>
                    <div className="sub">
                      {setsText(e)} · RIR {e.rir} · repos {Math.round((e.rest / 60) * 10) / 10} min
                    </div>
                    {open === key && <div className="tip">{e.cue}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <Card title="Cardio longévité" sub={`FC max estimée : ${program.cardio.hrMax} bpm · ${program.cardio.modes}`}>
        <div className="list">
          <div className="list-item">
            <div className="main">
              <div className="title">
                Zone 2 · {program.cardio.zone2.sessions} × {program.cardio.zone2.minutes} min
              </div>
              <div className="sub">
                {program.cardio.zone2.hrLow}-{program.cardio.zone2.hrHigh} bpm
              </div>
            </div>
          </div>
          {program.cardio.vo2 && (
            <div className="list-item">
              <div className="main">
                <div className="title">VO2max · 1 × 4×4</div>
                <div className="sub">
                  {program.cardio.vo2.hrLow}-{program.cardio.vo2.hrHigh} bpm · {program.cardio.vo2.protocol}
                </div>
              </div>
            </div>
          )}
          <div className="list-item">
            <div className="main">
              <div className="title">{program.cardio.steps.toLocaleString('fr-FR')} pas / jour</div>
              <div className="sub">Marcher 10 min après les repas améliore la glycémie.</div>
            </div>
          </div>
        </div>
        <ul className="steps">
          {program.cardio.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </Card>

      <Card title="Volume hebdomadaire par muscle" sub="Séries effectives (indirectes comptées ½). Zone efficace : 10-20.">
        {program.weeklyVolume
          .filter((v) => v.muscle !== 'forearms')
          .map((v) => (
            <div key={v.muscle} className="vol-row">
              <span>{v.label}</span>
              <div className="track">
                <div className="zone" style={{ left: `${(10 / 24) * 100}%`, width: `${(10 / 24) * 100}%` }} />
                <div className="bar" style={{ width: `${Math.min(100, (v.sets / 24) * 100)}%` }} />
              </div>
              <span className="small" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {v.sets}
              </span>
            </div>
          ))}
      </Card>

      <Card title="Ajuster le programme">
        <div className="row wrap">
          <button
            className="btn sm"
            onClick={() => {
              update((s) => ({ ...s, plan: { ...s.plan, programVariant: s.plan.programVariant + 1 } }));
              toast('Nouvelles variantes d’exercices');
            }}
          >
            <Icon.swap /> Varier les exercices
          </button>
          <button
            className="btn sm"
            onClick={() => {
              update((s) => ({ ...s, plan: { ...s.plan, programStart: mondayOf(todayISO()) } }));
              toast('Cycle redémarré en semaine 1');
            }}
          >
            <Icon.refresh /> Redémarrer le cycle
          </button>
          <button className="btn sm" onClick={() => navigate('settings')}>
            Jours / matériel
          </button>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          {profile.trainingDays} séances/sem · {profile.sessionMinutes} min · niveau {profile.experience === 'beginner' ? 'débutant' : profile.experience === 'intermediate' ? 'intermédiaire' : 'avancé'}. {state.workouts.length} séance(s) enregistrée(s).
        </p>
      </Card>
    </>
  );
}

interface DraftSet {
  weight?: number;
  reps?: number;
  rir?: number;
  done: boolean;
}

const DRAFT_KEY = 'vitalis-workout-draft';

function loadDraft(sessionId: string): Record<string, DraftSet[]> | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
    return d && d.sessionId === sessionId && d.date === todayISO() ? d.sets : null;
  } catch {
    return null;
  }
}

function WorkoutLogger({ session, lighter }: { session: ProgramSession; lighter?: boolean }) {
  const { state, update, derived, toast } = useApp();
  const [exercises, setExercises] = useState<ProgramExercise[]>(session.exercises);
  const [sets, setSets] = useState<Record<string, DraftSet[]>>(() => {
    const saved = loadDraft(session.id);
    if (saved) return saved;
    const init: Record<string, DraftSet[]> = {};
    for (const pe of session.exercises) {
      const sug = suggestNext(pe, lastPerformance(state.workouts, pe.exerciseId)?.log, derived.program.deload);
      init[pe.exerciseId] = Array.from({ length: pe.sets }, () => ({ weight: sug.weight, reps: undefined, done: false }));
    }
    return init;
  });
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [swap, setSwap] = useState<ProgramExercise | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ sessionId: session.id, date: todayISO(), sets }));
    } catch {
      /* ignoré */
    }
  }, [sets, session.id]);

  useEffect(() => {
    if (!rest) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= rest.until) {
        navigator.vibrate?.([200, 100, 200]);
        setRest(null);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [rest]);

  const setField = (exId: string, i: number, patch: Partial<DraftSet>) =>
    setSets((s) => ({ ...s, [exId]: s[exId].map((x, k) => (k === i ? { ...x, ...patch } : x)) }));

  const doneCount = Object.values(sets).flat().filter((x) => x.done).length;
  const total = Object.values(sets).flat().length;

  const finish = () => {
    const entries = exercises
      .map((pe) => ({
        exerciseId: pe.exerciseId,
        sets: (sets[pe.exerciseId] ?? []).filter((x) => x.done && x.reps).map((x) => ({ weight: x.weight ?? 0, reps: x.reps!, ...(x.rir !== undefined ? { rir: x.rir } : {}) })),
      }))
      .filter((e) => e.sets.length);
    if (!entries.length) {
      toast('Valide au moins une série (reps + ✓)');
      return;
    }
    const log: WorkoutLog = { id: uid(), date: todayISO(), sessionId: session.id, week: derived.program.week, entries };
    update((s) => ({ ...s, workouts: [...s.workouts, log] }));
    setDaily(update, todayISO(), (d) => ({ ...d, habits: { ...d.habits, training: true } }));
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignoré */
    }
    toast('Séance enregistrée 💪');
    navigate('training', 'history');
  };

  const doSwap = (from: ProgramExercise, toId: string) => {
    const ex = EXERCISE_BY_ID[toId];
    const replaced: ProgramExercise = { ...from, exerciseId: toId, name: ex.name, reps: ex.reps, rest: ex.rest, cue: ex.cue };
    setExercises((list) => list.map((x) => (x.exerciseId === from.exerciseId ? replaced : x)));
    const sug = suggestNext(replaced, lastPerformance(state.workouts, toId)?.log, derived.program.deload);
    setSets((s) => ({ ...s, [toId]: Array.from({ length: from.sets }, () => ({ weight: sug.weight, done: false })) }));
    setSwap(null);
  };

  return (
    <>
      <div className="row between">
        <button className="btn sm" onClick={() => navigate('training')}>
          <Icon.back /> Programme
        </button>
        <Badge tone="accent">
          {doneCount}/{total} séries
        </Badge>
      </div>
      <div>
        <h2 style={{ fontSize: 22 }}>{session.name}</h2>
        <div className="small text-2">
          Échauffement : 5 min de cardio léger, puis 2-3 séries de montée en charge sur le 1er exercice. Note les reps en réserve (RIR) : la progression s’ajuste dessus.
        </div>
        {lighter && <div className="tip">Version allégée selon ta forme du jour : 1 série de moins et 1 rep de plus en réserve.</div>}
      </div>
      {exercises.map((pe) => {
        const last = lastPerformance(state.workouts, pe.exerciseId);
        const sug = suggestNext(pe, last?.log, derived.program.deload);
        return (
          <Card
            key={pe.exerciseId}
            title={pe.name}
            sub={`${setsText(pe)} · RIR ${pe.rir} · repos ${Math.round((pe.rest / 60) * 10) / 10} min`}
            action={
              pe.alternatives.length ? (
                <button className="icon-btn" aria-label="Changer d’exercice" onClick={() => setSwap(pe)}>
                  <Icon.swap />
                </button>
              ) : undefined
            }
          >
            <div className="small" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              {sug.text}
            </div>
            {last && (
              <div className="small muted">
                Dernière fois ({formatDay(last.date)}) : {last.log.sets.map((x) => `${x.weight || 'PDC'}×${x.reps}`).join(', ')}
              </div>
            )}
            <div className="set-row small muted" style={{ marginTop: 10 }}>
              <span className="n">#</span>
              <span style={{ textAlign: 'center' }}>Charge (kg)</span>
              <span style={{ textAlign: 'center' }}>Reps</span>
              <span />
            </div>
            {(sets[pe.exerciseId] ?? []).map((st, i) => (
              <div className="set-row" key={i}>
                <span className="n">{i + 1}</span>
                <NumberInput placeholder={sug.weight !== undefined ? String(sug.weight).replace('.', ',') : 'kg'} value={st.weight} onChange={(weight) => setField(pe.exerciseId, i, { weight })} />
                <NumberInput step={1} placeholder={`${sug.reps}`} value={st.reps} onChange={(reps) => setField(pe.exerciseId, i, { reps })} />
                <button
                  className={`done-btn ${st.done ? 'on' : ''}`}
                  aria-label="Série faite"
                  onClick={() => {
                    const done = !st.done;
                    setField(pe.exerciseId, i, { done, reps: st.reps ?? (done ? sug.reps : st.reps) });
                    // Reporte la charge sur les séries suivantes encore vides
                    if (done && st.weight !== undefined)
                      setSets((s) => ({ ...s, [pe.exerciseId]: s[pe.exerciseId].map((x, k) => (k > i && !x.done && x.weight === undefined ? { ...x, weight: st.weight } : x)) }));
                    if (done) setRest({ until: Date.now() + pe.rest * 1000, total: pe.rest });
                  }}
                >
                  <Icon.check />
                </button>
                {st.done && (
                  <div className="rir-row">
                    <span className="small muted">En réserve :</span>
                    {[0, 1, 2, 3, 4].map((n) => (
                      <button key={n} type="button" className={`chip ${st.rir === n ? 'on' : ''}`} onClick={() => setField(pe.exerciseId, i, { rir: n })}>
                        {n === 4 ? '4+' : n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isStalled(state.workouts, pe.exerciseId) && (
              <div className="tip" style={{ background: 'var(--warning-soft)' }}>
                Stagnation sur cet exercice depuis 3 séances : change de variante (bouton ⇄), dors plus, ou avance ta semaine de décharge.
              </div>
            )}
            <details style={{ marginTop: 10 }}>
              <summary className="small muted">Technique</summary>
              <div className="tip">{pe.cue}</div>
            </details>
          </Card>
        );
      })}
      <button className="btn primary block" onClick={finish}>
        Terminer la séance
      </button>
      {rest && <div style={{ height: 90 }} aria-hidden="true" />}

      {rest && (
        <div className="timer" role="timer">
          <Icon.clock />
          <div>
            <div className="small" style={{ opacity: 0.7 }}>
              Repos
            </div>
            <div className="t">
              {Math.floor(Math.max(0, rest.until - now) / 60000)}:{String(Math.floor((Math.max(0, rest.until - now) % 60000) / 1000)).padStart(2, '0')}
            </div>
          </div>
          <div className="spacer" />
          <button onClick={() => setRest({ ...rest, until: rest.until + 30_000 })}>+30 s</button>
          <button onClick={() => setRest(null)}>Passer</button>
        </div>
      )}

      {swap && (
        <Sheet title="Remplacer l’exercice" onClose={() => setSwap(null)}>
          <div className="list">
            {swap.alternatives.map((id) => (
              <button key={id} className="option-card" style={{ marginBottom: 8 }} onClick={() => doSwap(swap, id)}>
                <div>
                  <strong>{EXERCISE_BY_ID[id].name}</strong>
                  <span>{EXERCISE_BY_ID[id].cue}</span>
                </div>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

function History() {
  const { state, update, derived } = useApp();
  const [ex, setEx] = useState<string | null>(null);
  const names = useMemo(() => Object.fromEntries(derived.program.sessions.map((s) => [s.id, s.name])), [derived.program.sessions]);
  const exercisesDone = useMemo(() => {
    const ids = new Set(state.workouts.flatMap((w) => w.entries.map((e) => e.exerciseId)));
    return [...ids]
      .map((id) => {
        const h = exerciseHistory(state.workouts, id);
        const best = h.reduce((a, b) => (b.e1rm > a.e1rm ? b : a), h[0]);
        return { id, name: EXERCISE_BY_ID[id]?.name ?? id, best, first: h[0], last: h[h.length - 1], count: h.length };
      })
      .sort((a, b) => b.count - a.count);
  }, [state.workouts]);

  return (
    <>
      <Tabs value="history" />
      <Card title="Records & progression" sub="1RM estimé (Epley) – clique pour le détail">
        {exercisesDone.length === 0 && <div className="empty">Enregistre ta première séance pour voir ta progression.</div>}
        <div className="list">
          {exercisesDone.map((e) => (
            <div key={e.id} className="list-item" onClick={() => setEx(e.id)} style={{ cursor: 'pointer' }}>
              <div className="main">
                <div className="title">{e.name}</div>
                <div className="sub">
                  Meilleure série : {e.best.best} · 1RM ≈ {e.best.e1rm} kg
                </div>
              </div>
              {e.count > 1 && (
                <Badge tone={e.last.e1rm >= e.first.e1rm ? 'good' : 'warning'}>
                  {e.last.e1rm >= e.first.e1rm ? '+' : ''}
                  {Math.round(((e.last.e1rm - e.first.e1rm) / Math.max(e.first.e1rm, 1)) * 100)} %
                </Badge>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card title="Séances">
        <div className="list">
          {state.workouts
            .slice()
            .reverse()
            .map((w) => {
              const nSets = w.entries.reduce((a, e) => a + e.sets.length, 0);
              const tonnage = w.entries.reduce((a, e) => a + e.sets.reduce((b, x) => b + x.weight * x.reps, 0), 0);
              return (
                <div key={w.id} className="list-item">
                  <div className="main">
                    <div className="title">{names[w.sessionId] ?? 'Séance'}</div>
                    <div className="sub">
                      {formatDay(w.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {nSets} séries · {Math.round(tonnage).toLocaleString('fr-FR')} kg soulevés · sem. {w.week}
                    </div>
                  </div>
                  <ConfirmButton label="Supprimer la séance" confirmLabel="Supprimer ?" onConfirm={() => update((s) => ({ ...s, workouts: s.workouts.filter((x) => x.id !== w.id) }))}>
                    <Icon.trash />
                  </ConfirmButton>
                </div>
              );
            })}
          {state.workouts.length === 0 && <div className="empty">Aucune séance enregistrée.</div>}
        </div>
      </Card>
      <CardioLogCard />
      {ex && (
        <Sheet title={EXERCISE_BY_ID[ex]?.name ?? ex} onClose={() => setEx(null)}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Meilleure série</th>
                <th style={{ textAlign: 'right' }}>1RM est.</th>
              </tr>
            </thead>
            <tbody>
              {exerciseHistory(state.workouts, ex)
                .reverse()
                .map((h) => (
                  <tr key={h.date}>
                    <td>{formatDay(h.date)}</td>
                    <td>{h.best}</td>
                    <td className="num">{h.e1rm} kg</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="small muted">1RM estimé = charge × (1 + reps/30). Sert à suivre la tendance, pas à tester ton max.</p>
        </Sheet>
      )}
    </>
  );
}

function CardioLogCard() {
  const { state, update, toast } = useApp();
  const [kind, setKind] = useState<'zone2' | 'vo2max'>('zone2');
  const [minutes, setMinutes] = useState<number | undefined>(40);
  const weekStart = mondayOf(todayISO());
  const thisWeek = state.cardio.filter((c) => c.date >= weekStart);
  const z2 = thisWeek.filter((c) => c.kind === 'zone2').reduce((a, c) => a + c.minutes, 0);
  const vo2 = thisWeek.filter((c) => c.kind === 'vo2max').length;
  return (
    <Card title="Cardio de la semaine" sub={`Zone 2 : ${z2} min · VO2max : ${vo2} séance(s) · objectif 150 min d’endurance`}>
      <div className="row">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'zone2', label: 'Zone 2' },
            { value: 'vo2max', label: 'VO2max' },
          ]}
        />
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Durée">
            <NumberInput value={minutes} onChange={setMinutes} unit="min" step={1} />
          </Field>
        </div>
        <button
          className="btn primary"
          style={{ alignSelf: 'flex-end' }}
          onClick={() => {
            if (!minutes) return;
            update((s) => ({ ...s, cardio: [...s.cardio, { id: uid(), date: todayISO(), kind, minutes }] }));
            setDaily(update, todayISO(), (d) => ({ ...d, habits: { ...d.habits, training: true } }));
            toast('Cardio enregistré');
          }}
        >
          Ajouter
        </button>
      </div>
    </Card>
  );
}
