// Coach IA (optionnel) : discute avec Claude en lui donnant le résumé de tes données.
// Fonctionne avec ta propre clé API Anthropic, stockée uniquement sur ton téléphone.
// L'historique est « append-only » : chaque réponse est conservée telle quelle (blocs
// de réflexion compris) et renvoyée à l'identique, et les mises à jour de tes données
// sont ajoutées comme un nouveau bloc dans ton message plutôt qu'en modifiant le prompt.
import type Anthropic from '@anthropic-ai/sdk';
import type { CoachMessage } from './types';

export const COACH_MODEL = 'claude-opus-5-5';
const CONTEXT_TAG = 'donnees_utilisateur';

export const COACH_SYSTEM = `Tu es le coach personnel de l'utilisateur dans l'application Vitalis : expert en nutrition sportive, hypertrophie, perte de gras, biologie de la longévité et compléments alimentaires.

Principes :
- Réponds en français, de façon concrète, structurée et concise (listes courtes, chiffres précis adaptés à SES données).
- Appuie-toi sur les preuves scientifiques actuelles ; indique le niveau de preuve quand c'est utile (solide / modéré / préliminaire) et dis clairement quand quelque chose n'est pas prouvé.
- Les données de l'utilisateur te sont fournies dans des balises <${CONTEXT_TAG}>. La version la plus récente fait foi.
- Pour tout résultat sanguin hors norme, symptôme, traitement médicamenteux ou pathologie : rappelle de consulter son médecin, sans dramatiser. Tu ne poses pas de diagnostic et ne prescris pas de médicaments.
- Pas de dopage, pas de produits interdits, pas de restrictions caloriques extrêmes.
- Si une question sort du sport, de la nutrition, du sommeil, de la santé et de la longévité, réponds brièvement puis recentre.`;

export function contextBlock(summary: string): string {
  return `<${CONTEXT_TAG}>\n${summary}\n</${CONTEXT_TAG}>`;
}

/** Dernier résumé de données déjà envoyé dans la conversation */
export function lastSentContext(history: CoachMessage[]): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role !== 'user' || !Array.isArray(m.content)) continue;
    const block = (m.content as { type: string; text?: string }[]).find((b) => b.type === 'text' && b.text?.startsWith(`<${CONTEXT_TAG}>`));
    if (block?.text) return block.text;
  }
  return undefined;
}

export interface CoachResult {
  user: CoachMessage;
  assistant: CoachMessage;
}

export class CoachError extends Error {}

export async function askCoach(opts: {
  apiKey: string;
  history: CoachMessage[];
  question: string;
  summary: string;
  onText: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<CoachResult> {
  const { default: AnthropicClient } = await import('@anthropic-ai/sdk');
  const client = new AnthropicClient({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });

  const ctx = contextBlock(opts.summary);
  const userContent: Anthropic.Beta.BetaTextBlockParam[] = [];
  if (lastSentContext(opts.history) !== ctx) userContent.push({ type: 'text', text: ctx });
  userContent.push({ type: 'text', text: opts.question });
  const now = new Date().toISOString();
  const user: CoachMessage = { role: 'user', content: userContent, display: opts.question, at: now };

  const messages = [...opts.history, user].map((m) => ({ role: m.role, content: m.content })) as Anthropic.Beta.BetaMessageParam[];

  try {
    const stream = client.beta.messages.stream(
      {
        model: COACH_MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        cache_control: { type: 'ephemeral' },
        system: COACH_SYSTEM,
        messages,
      },
      { signal: opts.signal },
    );
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') opts.onText(event.delta.text);
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new CoachError('Le coach n’a pas pu répondre à cette question. Reformule-la autrement.');
    const text = final.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const assistant: CoachMessage = { role: 'assistant', content: final.content, display: text, at: new Date().toISOString() };
    return { user, assistant };
  } catch (e) {
    if (e instanceof CoachError) throw e;
    if (e instanceof AnthropicClient.AuthenticationError) throw new CoachError('Clé API invalide. Vérifie-la dans Réglages.');
    if (e instanceof AnthropicClient.PermissionDeniedError) throw new CoachError('Cette clé API n’a pas accès au modèle. Vérifie ton compte sur console.anthropic.com.');
    if (e instanceof AnthropicClient.RateLimitError) throw new CoachError('Trop de requêtes ou crédit épuisé : réessaie dans un instant.');
    if (e instanceof AnthropicClient.BadRequestError) throw new CoachError(`Requête refusée : ${e.message}. Si ça persiste, démarre une nouvelle conversation.`);
    if (e instanceof AnthropicClient.APIUserAbortError) throw new CoachError('Réponse interrompue.');
    if (e instanceof AnthropicClient.APIConnectionError) throw new CoachError('Pas de connexion internet.');
    if (e instanceof AnthropicClient.APIError) throw new CoachError(`Erreur du service (${e.status ?? '?'}). Réessaie plus tard.`);
    throw e;
  }
}
