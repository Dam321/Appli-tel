// Coach IA (optionnel) : discute avec Claude en lui donnant le résumé de tes données.
// Fonctionne avec ta propre clé API Anthropic, stockée uniquement sur ton téléphone.
// L'historique est « append-only » : chaque réponse est conservée telle quelle (blocs
// de réflexion compris) et renvoyée à l'identique, et les mises à jour de tes données
// sont ajoutées comme un nouveau bloc dans ton message plutôt qu'en modifiant le prompt.
import type Anthropic from '@anthropic-ai/sdk';
import type { CoachMessage, PhysiqueAnalysis } from './types';

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

// ——— Analyse IA de la silhouette (photos de progression) ———

const PRIORITY_VALUES = ['chest', 'back', 'shoulders', 'arms', 'glutes', 'legs', 'abs', 'calves'] as const;

const PHYSIQUE_SCHEMA = {
  type: 'object',
  properties: {
    estimatedBodyFat: { type: 'string', description: 'Fourchette estimée de masse grasse, ex. « 15-18 % »' },
    overall: { type: 'string', description: 'Synthèse en 2-3 phrases, bienveillante et directe' },
    strengths: { type: 'array', items: { type: 'string' } },
    weakPoints: { type: 'array', items: { type: 'string' }, description: 'Groupes musculaires ou proportions à développer' },
    posture: { type: 'array', items: { type: 'string' }, description: 'Observations posturales (épaules enroulées, antéversion du bassin…) et correctif' },
    suggestedPriorities: { type: 'array', items: { type: 'string', enum: [...PRIORITY_VALUES] }, description: '1 à 3 priorités musculaires' },
    actions: { type: 'array', items: { type: 'string' }, description: '3 à 5 actions concrètes' },
  },
  required: ['estimatedBodyFat', 'overall', 'strengths', 'weakPoints', 'posture', 'suggestedPriorities', 'actions'],
  additionalProperties: false,
} as const;

const PHYSIQUE_SYSTEM = `Tu es un expert en analyse morphologique pour la musculation esthétique et la posture.
On te montre des photos de progression (face, profil, dos) et les données de l'utilisateur.
- Analyse uniquement ce qui est visible, avec bienveillance et précision, en français.
- Estime une fourchette de masse grasse en la recoupant avec les mesures fournies.
- Identifie les déséquilibres de proportions (ex. épaules étroites par rapport à la taille, haut des pectoraux, dos en largeur, fessiers, mollets) et la posture.
- Les priorités suggérées doivent être choisies parmi la liste autorisée.
- Pas de diagnostic médical. Si les photos ne permettent pas de juger (cadrage, lumière, vêtements amples), dis-le dans la synthèse.`;

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

function isAnalysis(x: unknown): x is PhysiqueAnalysis {
  const o = x as Record<string, unknown>;
  return (
    !!o &&
    typeof o.estimatedBodyFat === 'string' &&
    typeof o.overall === 'string' &&
    ['strengths', 'weakPoints', 'posture', 'actions', 'suggestedPriorities'].every((k) => Array.isArray(o[k]))
  );
}

/** Appel « sortie structurée » : la réponse respecte le schéma JSON fourni. */
async function structuredCall<T>(opts: {
  apiKey: string;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: Record<string, unknown>;
  validate: (x: unknown) => x is T;
  refusal: string;
  maxTokens?: number;
}): Promise<T> {
  const { default: AnthropicClient } = await import('@anthropic-ai/sdk');
  const client = new AnthropicClient({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });
  try {
    const res = await client.beta.messages.create({
      model: COACH_MODEL,
      max_tokens: opts.maxTokens ?? 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: opts.schema } },
      system: opts.system,
      messages: [{ role: 'user', content: opts.content }],
    });
    if (res.stop_reason === 'refusal') throw new CoachError(opts.refusal);
    if (res.stop_reason === 'max_tokens') throw new CoachError('Réponse trop longue, interrompue. Réessaie avec moins de pages.');
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new CoachError('Réponse incomplète du service. Réessaie.');
    }
    if (!opts.validate(parsed)) throw new CoachError('Réponse inattendue du service. Réessaie.');
    return parsed;
  } catch (e) {
    if (e instanceof CoachError) throw e;
    if (e instanceof AnthropicClient.AuthenticationError) throw new CoachError('Clé API invalide. Vérifie-la dans Réglages.');
    if (e instanceof AnthropicClient.PermissionDeniedError) throw new CoachError('Cette clé API n’a pas accès au modèle. Vérifie ton compte sur console.anthropic.com.');
    if (e instanceof AnthropicClient.RateLimitError) throw new CoachError('Trop de requêtes ou crédit épuisé : réessaie dans un instant.');
    if (e instanceof AnthropicClient.BadRequestError) throw new CoachError(`Requête refusée : ${e.message}`);
    if (e instanceof AnthropicClient.APIConnectionError) throw new CoachError('Pas de connexion internet.');
    if (e instanceof AnthropicClient.APIError) throw new CoachError(`Erreur du service (${e.status ?? '?'}). Réessaie plus tard.`);
    throw e;
  }
}

export async function analyzePhysique(opts: { apiKey: string; photos: { angle: string; date: string; blob: Blob }[]; summary: string }): Promise<PhysiqueAnalysis> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const ph of opts.photos) {
    content.push({ type: 'text', text: `Photo ${ph.angle} du ${ph.date} :` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await blobToBase64(ph.blob) } });
  }
  content.push({ type: 'text', text: `${contextBlock(opts.summary)}\n\nAnalyse ma silhouette et dis-moi quoi prioriser.` });
  const parsed = await structuredCall({
    apiKey: opts.apiKey,
    system: PHYSIQUE_SYSTEM,
    content,
    schema: PHYSIQUE_SCHEMA as unknown as Record<string, unknown>,
    validate: isAnalysis,
    refusal: 'L’analyse n’a pas pu être faite sur ces photos. Essaie avec d’autres photos (bonne lumière, tenue de sport).',
  });
  parsed.suggestedPriorities = parsed.suggestedPriorities.filter((x) => (PRIORITY_VALUES as readonly string[]).includes(x)).slice(0, 3);
  return parsed;
}

// ——— Repas en photo ———

export interface MealEstimate {
  name: string;
  items: { food: string; grams: number }[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: 'faible' | 'moyenne' | 'bonne';
  comment: string;
}

const MEAL_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Nom court du repas, ex. « Burger frites et soda »' },
    items: {
      type: 'array',
      items: { type: 'object', properties: { food: { type: 'string' }, grams: { type: 'number' } }, required: ['food', 'grams'], additionalProperties: false },
    },
    kcal: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
    fiber: { type: 'number' },
    confidence: { type: 'string', enum: ['faible', 'moyenne', 'bonne'] },
    comment: { type: 'string', description: 'Une phrase sur la qualité nutritionnelle (légumes, protéines, ultra-transformé…)' },
  },
  required: ['name', 'items', 'kcal', 'protein', 'carbs', 'fat', 'fiber', 'confidence', 'comment'],
  additionalProperties: false,
} as const;

const MEAL_SYSTEM = `Tu es diététicien du sport. On te montre la photo d'un repas (et parfois une précision écrite).
- Identifie chaque aliment et estime son poids en grammes à partir des repères visuels (taille de l'assiette, des couverts, de la main).
- Calcule calories, protéines, glucides, lipides et fibres avec les tables de composition usuelles (Ciqual). Compte les matières grasses de cuisson et les sauces, souvent oubliées.
- Si un doute existe (huile cachée, portion masquée), choisis l'estimation la plus probable et baisse la confiance.
- Réponds en français. Le commentaire est bref, factuel et sans culpabiliser.`;

function isMeal(x: unknown): x is MealEstimate {
  const o = x as Record<string, unknown>;
  return !!o && typeof o.name === 'string' && ['kcal', 'protein', 'carbs', 'fat', 'fiber'].every((k) => typeof o[k] === 'number') && Array.isArray(o.items);
}

export async function analyzeMeal(opts: { apiKey: string; photo: Blob; note?: string }): Promise<MealEstimate> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await blobToBase64(opts.photo) } },
    { type: 'text', text: opts.note ? `Précision : ${opts.note}\n\nEstime ce repas.` : 'Estime ce repas.' },
  ];
  const r = await structuredCall({ apiKey: opts.apiKey, system: MEAL_SYSTEM, content, schema: MEAL_SCHEMA as unknown as Record<string, unknown>, validate: isMeal, refusal: 'Impossible d’analyser cette photo. Essaie une photo du dessus, assiette entière visible.', maxTokens: 4000 });
  return { ...r, kcal: Math.round(r.kcal), protein: Math.round(r.protein), carbs: Math.round(r.carbs), fat: Math.round(r.fat), fiber: Math.round(r.fiber) };
}

// ——— Compte-rendu de prise de sang ———

export interface LabMarkerSpec {
  id: string;
  name: string;
  unit: string;
  altUnits: string[];
}

export interface LabReading {
  date: string;
  lab: string;
  results: { id: string; value: number; unit: string; canonicalValue: number }[];
  others: { name: string; value: string }[];
}

const LAB_SYSTEM = `Tu lis des comptes-rendus d'analyses de biologie médicale (laboratoires français le plus souvent) pour les transcrire.
- Transcris uniquement les résultats du patient (pas les valeurs de référence ni les antériorités), en nombre décimal (virgule française → point).
- Pour chaque analyse de la liste fournie présente dans le document : renvoie son identifiant, la valeur et l'unité telles qu'imprimées, et la valeur convertie dans l'unité attendue (canonicalValue). Si plusieurs unités sont imprimées pour la même analyse, prends la première.
- Les lymphocytes : seulement le pourcentage (pas le nombre absolu). Le DFG : la valeur CKD-EPI si plusieurs formules.
- Les résultats absents de la liste vont dans « others » (nom + valeur avec unité), en restant bref.
- date = date du prélèvement au format AAAA-MM-JJ (chaîne vide si introuvable). lab = nom du laboratoire (chaîne vide si absent).
- N'invente jamais une valeur illisible : omets-la.`;

function isLabReading(x: unknown): x is LabReading {
  const o = x as Record<string, unknown>;
  return !!o && typeof o.date === 'string' && Array.isArray(o.results) && Array.isArray(o.others);
}

export async function readLabReport(opts: { apiKey: string; files: { mediaType: 'image/jpeg' | 'application/pdf'; data: string }[]; markers: LabMarkerSpec[] }): Promise<LabReading> {
  const ids = opts.markers.map((m) => m.id);
  const schema = {
    type: 'object',
    properties: {
      date: { type: 'string' },
      lab: { type: 'string' },
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string', enum: ids }, value: { type: 'number' }, unit: { type: 'string' }, canonicalValue: { type: 'number' } },
          required: ['id', 'value', 'unit', 'canonicalValue'],
          additionalProperties: false,
        },
      },
      others: {
        type: 'array',
        items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name', 'value'], additionalProperties: false },
      },
    },
    required: ['date', 'lab', 'results', 'others'],
    additionalProperties: false,
  };
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const f of opts.files) {
    if (f.mediaType === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } });
    else content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.data } });
  }
  const list = opts.markers.map((m) => `- ${m.id} : ${m.name} — unité attendue ${m.unit}${m.altUnits.length ? ` (autres unités possibles : ${m.altUnits.join(', ')})` : ''}`).join('\n');
  content.push({ type: 'text', text: `Analyses suivies par l'application :\n${list}\n\nTranscris les résultats de ce compte-rendu.` });
  const r = await structuredCall({ apiKey: opts.apiKey, system: LAB_SYSTEM, content, schema, validate: isLabReading, refusal: 'Ce document n’a pas pu être lu. Essaie avec le PDF du laboratoire ou des photos nettes de chaque page.', maxTokens: 12000 });
  return { ...r, results: r.results.filter((x) => ids.includes(x.id) && Number.isFinite(x.value)) };
}

export { blobToBase64 };
