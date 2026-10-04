// Ce que tes propres données révèlent : prévisions, corrélations personnelles,
// points forts / faibles, évolution de la prise de sang. Chaque insight n'apparaît
// que s'il y a assez de données pour être fiable.
import { PHENO_MARKERS, phenoAge } from './bioage';
import { MARKER_BY_ID, markerStatus } from './blood';
import { normalizeMeasurement, targetFatRange, trendSeries, weeklyRate } from './bodyComp';
import { MUSCLE_LABEL, EXERCISE_BY_ID, type Muscle } from '../data/exercises';
import type { Derived } from './derived';
import { exerciseHistory, readinessScore } from './training';
import type { AppState } from './types';
import { addDays, ageFromBirthYear, daysBetween, formatDay, todayISO } from './util';

export interface Insight {
  id: string;
  title: string;
  text: string;
  tone: 'good' | 'warning' | 'neutral';
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

const fr = (n: number, d = 1) => n.toLocaleString('fr-FR', { maximumFractionDigits: d });

export function insights(state: AppState, d: Derived, today = todayISO()): Insight[] {
  const out: Insight[] = [];
  const p = d.profile;
  const ms = state.measurements.map(normalizeMeasurement);

  // ——— Prévision : date d'arrivée à l'objectif ———
  const [, hi] = targetFatRange(p.sex);
  const fat = trendSeries(ms, 'fatPct', 0.15);
  const fatRate = weeklyRate(fat, 28);
  if (fat.length >= 14 && fatRate !== undefined) {
    const cur = fat[fat.length - 1].trend;
    if (cur > hi && fatRate < -0.03) {
      const weeks = (cur - hi) / -fatRate;
      if (weeks < 104)
        out.push({
          id: 'eta',
          title: `${hi} % de gras vers le ${formatDay(addDays(today, Math.round(weeks * 7)), { day: 'numeric', month: 'long', year: 'numeric' })}`,
          text: `Tu perds ${fr(-fatRate, 2)} point de gras par semaine (tendance sur 4 semaines). À ce rythme, il te reste environ ${Math.ceil(weeks)} semaines.`,
          tone: 'good',
        });
    } else if (cur > hi && fatRate >= 0 && d.targets.phase === 'cut')
      out.push({ id: 'eta', title: 'Ton % de gras ne baisse pas encore', text: 'Sur 4 semaines la tendance est plate : le bilan hebdo va ajuster tes calories. Vérifie que tu suis bien le menu.', tone: 'warning' });
  }
  const leanField = ms.some((m) => m.muscleMassKg !== undefined) ? 'muscleMassKg' : 'leanMassKg';
  const lean = trendSeries(ms, leanField, 0.15);
  const leanRate = weeklyRate(lean, 28);
  if (lean.length >= 14 && leanRate !== undefined && leanRate > 0.05)
    out.push({ id: 'lean', title: `+${fr(leanRate * 4.3)} kg de ${leanField === 'muscleMassKg' ? 'muscle' : 'masse maigre'} par mois`, text: 'D’après la tendance de ta balance sur 4 semaines : la construction est en cours.', tone: 'good' });

  // ——— Sommeil → forme ———
  const pairs = Object.entries(state.daily)
    .filter(([day, log]) => daysBetween(day, today) <= 60 && log.readiness && (log.readiness.sleepHours ?? log.sleepHours) !== undefined)
    .map(([, log]) => ({ h: (log.readiness!.sleepHours ?? log.sleepHours)!, r: readinessScore(log.readiness!) }));
  if (pairs.length >= 8) {
    const r = pearson(
      pairs.map((x) => x.h),
      pairs.map((x) => x.r),
    );
    const good = pairs.filter((x) => x.h >= 7.5).map((x) => x.r);
    const bad = pairs.filter((x) => x.h < 7).map((x) => x.r);
    if (r >= 0.3 && good.length >= 3 && bad.length >= 3) {
      const diff = good.reduce((a, b) => a + b, 0) / good.length - bad.reduce((a, b) => a + b, 0) / bad.length;
      out.push({ id: 'sleep', title: 'Tes nuits font ta forme', text: `Après 7 h 30 de sommeil ou plus, ta forme du matin est en moyenne ${Math.round(diff)} points plus haute qu’après moins de 7 h (${pairs.length} jours analysés).`, tone: 'neutral' });
    }
  }

  // ——— Points forts / faibles musculaires ———
  const recent = state.workouts.filter((w) => daysBetween(w.date, today) <= 42);
  const byMuscle = new Map<Muscle, number[]>();
  for (const id of new Set(recent.flatMap((w) => w.entries.map((e) => e.exerciseId)))) {
    const h = exerciseHistory(recent, id);
    if (h.length < 2) continue;
    const change = (h[h.length - 1].e1rm - h[0].e1rm) / Math.max(h[0].e1rm, 1);
    for (const m of EXERCISE_BY_ID[id]?.primary ?? []) byMuscle.set(m, [...(byMuscle.get(m) ?? []), change]);
  }
  if (byMuscle.size >= 3) {
    const ranked = [...byMuscle.entries()].map(([m, c]) => ({ m, v: c.reduce((a, b) => a + b, 0) / c.length })).sort((a, b) => b.v - a.v);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    out.push({
      id: 'muscles',
      title: `Point fort : ${MUSCLE_LABEL[best.m]} (${best.v >= 0 ? '+' : ''}${Math.round(best.v * 100)} %)`,
      text: `Sur 6 semaines (force estimée). À travailler : ${MUSCLE_LABEL[worst.m].toLowerCase()} (${worst.v >= 0 ? '+' : ''}${Math.round(worst.v * 100)} %)${worst.v < 0.005 ? ' : le programme lui ajoute automatiquement du volume' : ''}.`,
      tone: worst.v < 0 ? 'warning' : 'good',
    });
  }

  // ——— Régularité ———
  let streak = 0;
  for (let w = 0; w < 26; w++) {
    const start = addDays(today, -7 * (w + 1));
    const end = addDays(today, -7 * w);
    const n = state.workouts.filter((x) => x.date > start && x.date <= end).length;
    if (n >= Math.max(1, p.trainingDays - 1)) streak++;
    else break;
  }
  if (streak >= 3) out.push({ id: 'streak', title: `${streak} semaines d’affilée sans lâcher`, text: 'La régularité est le meilleur prédicteur de résultats. Continue.', tone: 'good' });

  // ——— Évolution de la prise de sang ———
  const panels = state.bloodPanels.slice().sort((a, b) => a.date.localeCompare(b.date));
  if (panels.length >= 2) {
    const [prev, last] = panels.slice(-2);
    const improved: string[] = [];
    const worse: string[] = [];
    const rank = { optimal: 2, borderline_low: 1, borderline_high: 1, low: 0, high: 0 } as const;
    for (const [k, v] of Object.entries(last.values)) {
      const before = prev.values[k];
      const m = MARKER_BY_ID[k];
      if (before === undefined || !m) continue;
      const a = rank[markerStatus(m, p.sex, before)];
      const b = rank[markerStatus(m, p.sex, v)];
      const txt = `${m.short} ${fr(before, 2)} → ${fr(v, 2)}`;
      if (b > a) improved.push(txt);
      else if (b < a) worse.push(txt);
    }
    if (improved.length) out.push({ id: 'blood_up', title: 'Prise de sang : en progrès', text: improved.join(' · '), tone: 'good' });
    if (worse.length) out.push({ id: 'blood_down', title: 'Prise de sang : à surveiller', text: worse.join(' · '), tone: 'warning' });
    const complete = panels.filter((x) => PHENO_MARKERS.every((k) => x.values[k] !== undefined));
    if (complete.length >= 2) {
      const [a, b] = complete.slice(-2);
      const age = ageFromBirthYear(p.birthYear);
      const pa = phenoAge(a.values, age - (new Date().getFullYear() - Number(a.date.slice(0, 4))));
      const pb = phenoAge(b.values, age - (new Date().getFullYear() - Number(b.date.slice(0, 4))));
      if (pa !== undefined && pb !== undefined) {
        const years = daysBetween(a.date, b.date) / 365;
        const delta = pb - pa - years;
        out.push({ id: 'bioage_trend', title: delta < 0 ? `Tu as rajeuni de ${fr(-delta)} an(s) biologiquement` : `Âge biologique : +${fr(delta)} an(s) de plus que le temps écoulé`, text: `Entre tes prises de sang du ${formatDay(a.date)} et du ${formatDay(b.date)}.`, tone: delta < 0 ? 'good' : 'warning' });
      }
    }
  }
  return out;
}
