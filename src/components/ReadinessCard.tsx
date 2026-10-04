import { useState } from 'react';
import { readinessAdvice, readinessScore } from '../lib/training';
import type { Readiness } from '../lib/types';
import { todayISO } from '../lib/util';
import { setDaily } from '../pages/Today';
import { useApp } from '../store';
import { Badge, Card, Field, NumberInput, Segmented } from './ui';

const QUESTIONS: { key: keyof Omit<Readiness, 'sleepHours'>; label: string; low: string; high: string }[] = [
  { key: 'sleep', label: 'Qualité du sommeil', low: 'Nuit horrible', high: 'Nuit parfaite' },
  { key: 'energy', label: 'Énergie', low: 'Vidé', high: 'En pleine forme' },
  { key: 'soreness', label: 'Courbatures', low: 'Très courbaturé', high: 'Aucune' },
  { key: 'motivation', label: 'Motivation', low: 'Aucune envie', high: 'À fond' },
];

/** Check-in de forme du matin : ajuste la séance du jour (auto-régulation). */
export function ReadinessCard({ trainingToday }: { trainingToday: boolean }) {
  const { state, update } = useApp();
  const today = todayISO();
  const saved = state.daily[today]?.readiness;
  const [draft, setDraft] = useState<Readiness>(saved ?? { sleep: 3, energy: 3, soreness: 3, motivation: 3 });
  const [editing, setEditing] = useState(!saved);

  if (saved && !editing) {
    const score = readinessScore(saved);
    const adv = readinessAdvice(score);
    return (
      <Card
        title="Forme du jour"
        sub={trainingToday ? adv.text : 'Pas de musculation aujourd’hui : marche, mobilité et sommeil.'}
        action={<Badge tone={adv.level === 'go' ? 'good' : adv.level === 'easy' ? 'warning' : 'serious'}>{`${score}/100 · ${adv.title}`}</Badge>}
      >
        <button className="btn ghost sm" onClick={() => setEditing(true)}>
          Modifier
        </button>
      </Card>
    );
  }

  return (
    <Card title="Comment tu te sens ce matin ?" sub="10 secondes : ta séance s’adapte à ta récupération.">
      <div className="stack" style={{ gap: 12 }}>
        {QUESTIONS.map((q) => (
          <div key={q.key}>
            <div className="row between small" style={{ marginBottom: 4 }}>
              <b>{q.label}</b>
              <span className="muted">
                1 = {q.low} · 5 = {q.high}
              </span>
            </div>
            <Segmented value={draft[q.key]} onChange={(v) => setDraft((d) => ({ ...d, [q.key]: v }))} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
          </div>
        ))}
        <Field label="Heures dormies (optionnel)">
          <NumberInput value={draft.sleepHours} onChange={(sleepHours) => setDraft((d) => ({ ...d, sleepHours }))} unit="h" step={0.5} />
        </Field>
        <button
          className="btn primary block"
          onClick={() => {
            setDaily(update, today, (d) => ({ ...d, readiness: draft, sleepHours: draft.sleepHours ?? d.sleepHours, habits: { ...d.habits, sleep: d.habits.sleep || (draft.sleepHours ?? 0) >= 7.5 } }));
            setEditing(false);
          }}
        >
          Valider
        </button>
      </div>
    </Card>
  );
}
