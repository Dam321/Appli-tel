import { useEffect, useRef, useState } from 'react';
import { navigate } from '../App';
import { Icon } from '../components/icons';
import { Callout } from '../components/ui';
import { askCoach, CoachError } from '../lib/coach';
import { coachSummary } from '../lib/derived';
import { useApp } from '../store';

const SUGGESTIONS = [
  'Analyse ma semaine et dis-moi les 3 priorités',
  'Que manger avant et après ma séance ?',
  'Mes résultats sanguins sont-ils bons ?',
  'Je stagne au développé couché, que faire ?',
  'Comment améliorer mon sommeil ?',
];

export function Coach() {
  const { state, update, derived } = useApp();
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [streaming, setStreaming] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [state.coach.length, streaming, pending]);

  if (!state.settings.anthropicKey)
    return (
      <Callout title="Active le coach IA" action={<button className="btn sm primary" onClick={() => navigate('settings')}>Ajouter ma clé API</button>}>
        Le coach utilise Claude avec ta propre clé API Anthropic. Il voit ton profil, tes pesées, ton programme, ton menu et ta prise de sang pour répondre de façon 100 % personnalisée.
      </Callout>
    );

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || pending) return;
    setInput('');
    setError(null);
    setPending(question);
    setStreaming('');
    abort.current = new AbortController();
    try {
      const res = await askCoach({
        apiKey: state.settings.anthropicKey!,
        history: state.coach,
        question,
        summary: coachSummary(state, derived),
        onText: (t) => setStreaming((s) => s + t),
        signal: abort.current.signal,
      });
      update((s) => ({ ...s, coach: [...s.coach, res.user, res.assistant] }));
    } catch (e) {
      setError(e instanceof CoachError ? e.message : 'Erreur inattendue. Réessaie.');
    } finally {
      setPending(null);
      setStreaming('');
    }
  };

  return (
    <>
      <div className="row between">
        <span className="small muted">Claude · réponses générales, pas un avis médical</span>
        {state.coach.length > 0 && !pending && (
          <button className="btn ghost sm" onClick={() => update((s) => ({ ...s, coach: [] }))}>
            Nouvelle conversation
          </button>
        )}
      </div>
      <div className="chat">
        {state.coach.length === 0 && !pending && (
          <div className="stack">
            <div className="bubble assistant">Salut ! Je connais ton profil, tes mesures, ton programme et ton menu. Pose-moi n’importe quelle question.</div>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {state.coach.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.display}
          </div>
        ))}
        {pending && (
          <>
            <div className="bubble user">{pending}</div>
            <div className="bubble assistant">{streaming || '…réflexion en cours'}</div>
          </>
        )}
        {error && <Callout tone="critical" title="Oups">{error}</Callout>}
        <div ref={bottom} />
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          className="input"
          rows={1}
          placeholder="Ta question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        {pending ? (
          <button type="button" className="btn" onClick={() => abort.current?.abort()} aria-label="Arrêter">
            <Icon.x />
          </button>
        ) : (
          <button type="submit" className="btn primary" aria-label="Envoyer" disabled={!input.trim()}>
            <Icon.send />
          </button>
        )}
      </form>
    </>
  );
}
