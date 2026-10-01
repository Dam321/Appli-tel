// Synchronisation avec la balance Withings via l'API publique (OAuth 2).
// Les requêtes sont envoyées en `application/x-www-form-urlencoded` avec le jeton
// dans le corps : ce sont des requêtes CORS « simples », appelables directement
// depuis le navigateur sans serveur intermédiaire.
import type { Measurement, WithingsAuth } from './types';

const AUTH_URL = 'https://account.withings.com/oauth2_user/authorize2';
const TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2';
const MEASURE_URL = 'https://wbsapi.withings.net/measure';
const MEASURE_V2_URL = 'https://wbsapi.withings.net/v2/measure';

/** Types de mesures Withings → champs de l'app */
const MEAS_TYPES: Record<number, keyof Measurement> = {
  1: 'weightKg',
  5: 'leanMassKg',
  6: 'fatPct',
  8: 'fatMassKg',
  9: 'diastolic',
  10: 'systolic',
  11: 'heartRate',
  76: 'muscleMassKg',
  77: 'hydrationKg',
  88: 'boneMassKg',
  91: 'pwv',
  123: 'vo2max',
  155: 'vascularAge',
  170: 'visceralFat',
  226: 'bmrKcal',
};

export class WithingsError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export function redirectUri(): string {
  const { origin, pathname } = window.location;
  return origin + pathname.replace(/index\.html$/, '');
}

export function authorizeUrl(auth: WithingsAuth, state: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: auth.clientId,
    scope: 'user.metrics,user.activity',
    redirect_uri: redirectUri(),
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

async function post(url: string, params: Record<string, string>): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(params).toString(),
    });
  } catch {
    throw new WithingsError('Impossible de joindre Withings (réseau).');
  }
  const json = await res.json().catch(() => null);
  if (!json) throw new WithingsError(`Réponse invalide de Withings (HTTP ${res.status}).`);
  if (json.status !== 0) throw new WithingsError(json.error ? `Withings : ${json.error}` : `Erreur Withings ${json.status}`, json.status);
  return json.body;
}

function withTokens(auth: WithingsAuth, body: any): WithingsAuth {
  return {
    ...auth,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + (Number(body.expires_in) || 10800) * 1000 - 60_000,
    userId: String(body.userid ?? auth.userId ?? ''),
    pendingState: undefined,
  };
}

export async function exchangeCode(auth: WithingsAuth, code: string): Promise<WithingsAuth> {
  const body = await post(TOKEN_URL, {
    action: 'requesttoken',
    grant_type: 'authorization_code',
    client_id: auth.clientId,
    client_secret: auth.clientSecret,
    code,
    redirect_uri: redirectUri(),
  });
  return withTokens(auth, body);
}

export async function refreshToken(auth: WithingsAuth): Promise<WithingsAuth> {
  if (!auth.refreshToken) throw new WithingsError('Non connecté à Withings.');
  const body = await post(TOKEN_URL, {
    action: 'requesttoken',
    grant_type: 'refresh_token',
    client_id: auth.clientId,
    client_secret: auth.clientSecret,
    refresh_token: auth.refreshToken,
  });
  return withTokens(auth, body);
}

export async function ensureToken(auth: WithingsAuth): Promise<WithingsAuth> {
  if (auth.accessToken && auth.expiresAt && auth.expiresAt > Date.now()) return auth;
  return refreshToken(auth);
}

export function parseMeasureGroups(groups: any[]): Measurement[] {
  const out: Measurement[] = [];
  for (const g of groups ?? []) {
    if (g.category !== undefined && g.category !== 1) continue; // 2 = objectifs
    const m: Measurement = { id: `withings-${g.grpid}`, date: new Date(g.date * 1000).toISOString(), source: 'withings' };
    let any = false;
    for (const meas of g.measures ?? []) {
      const field = MEAS_TYPES[meas.type];
      if (!field) continue;
      const v = meas.value * Math.pow(10, meas.unit);
      (m as unknown as Record<string, number>)[field] = Math.round(v * 100) / 100;
      any = true;
    }
    if (any) out.push(m);
  }
  return out;
}

export async function fetchMeasures(auth: WithingsAuth, sinceEpoch = 0): Promise<Measurement[]> {
  const all: Measurement[] = [];
  let offset: number | undefined;
  for (let page = 0; page < 30; page++) {
    const params: Record<string, string> = {
      action: 'getmeas',
      access_token: auth.accessToken!,
      meastypes: Object.keys(MEAS_TYPES).join(','),
      category: '1',
    };
    if (sinceEpoch) params.lastupdate = String(sinceEpoch);
    if (offset) params.offset = String(offset);
    const body = await post(MEASURE_URL, params);
    all.push(...parseMeasureGroups(body.measuregrps));
    if (!body.more) break;
    offset = body.offset;
  }
  return all;
}

export async function fetchSteps(auth: WithingsAuth, startYmd: string, endYmd: string): Promise<{ date: string; steps: number }[]> {
  const out: { date: string; steps: number }[] = [];
  let offset: number | undefined;
  for (let page = 0; page < 10; page++) {
    const params: Record<string, string> = {
      action: 'getactivity',
      access_token: auth.accessToken!,
      startdateymd: startYmd,
      enddateymd: endYmd,
      data_fields: 'steps',
    };
    if (offset) params.offset = String(offset);
    const body = await post(MEASURE_V2_URL, params);
    for (const a of body.activities ?? []) if (typeof a.steps === 'number') out.push({ date: a.date, steps: a.steps });
    if (!body.more) break;
    offset = body.offset;
  }
  return out;
}

/** Fusionne de nouvelles mesures dans la liste existante (dédoublonnage par id). */
export function mergeMeasurements(existing: Measurement[], incoming: Measurement[]): { list: Measurement[]; added: number } {
  const byId = new Map(existing.map((m) => [m.id, m]));
  let added = 0;
  for (const m of incoming) {
    if (!byId.has(m.id)) added++;
    byId.set(m.id, { ...byId.get(m.id), ...m });
  }
  return { list: [...byId.values()].sort((a, b) => a.date.localeCompare(b.date)), added };
}
