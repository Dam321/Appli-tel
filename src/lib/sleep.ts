// Sommeil mesuré (montre ou capteur Withings) : moyenne des nuits et fréquence
// cardiaque nocturne comparée à ta moyenne. Une FC nocturne qui monte de 5 bpm
// ou plus signale une récupération incomplète (fatigue, alcool, infection qui
// couve, repas tardif) avant même que tu la ressentes.
import type { DailyLog, SleepRecord } from './types';
import { addDays } from './util';

export interface NightReport {
  date: string;
  sleep: SleepRecord;
  /** FC nocturne de référence (médiane des 28 nuits précédentes) */
  baselineHr?: number;
  /** Écart avec la référence, en bpm */
  hrDelta?: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const nightHr = (s: SleepRecord, field: 'hrMin' | 'hrAvg') => s[field];

/** Nuit de cette date (jour du réveil) comparée à ta référence. */
export function nightReport(daily: Record<string, DailyLog>, day: string): NightReport | undefined {
  const sleep = daily[day]?.sleep;
  if (!sleep) return undefined;
  const field = sleep.hrMin !== undefined ? 'hrMin' : sleep.hrAvg !== undefined ? 'hrAvg' : undefined;
  if (!field) return { date: day, sleep };
  const past: number[] = [];
  for (let i = 1; i <= 28; i++) {
    const s = daily[addDays(day, -i)]?.sleep;
    const v = s && nightHr(s, field);
    if (v !== undefined) past.push(v);
  }
  if (past.length < 7) return { date: day, sleep };
  const baselineHr = Math.round(median(past));
  return { date: day, sleep, baselineHr, hrDelta: Math.round(nightHr(sleep, field)! - baselineHr) };
}

/** Moyennes des nuits mesurées sur la période (au moins 4 nuits). */
export function sleepStats(daily: Record<string, DailyLog>, today: string, days = 14): { nights: number; avgHours: number; avgEfficiency?: number } | undefined {
  const nights: SleepRecord[] = [];
  for (let i = 0; i < days; i++) {
    const s = daily[addDays(today, -i)]?.sleep;
    if (s) nights.push(s);
  }
  if (nights.length < 4) return undefined;
  const eff = nights.map((n) => n.efficiency).filter((x): x is number => x !== undefined);
  return {
    nights: nights.length,
    avgHours: Math.round((nights.reduce((a, n) => a + n.hours, 0) / nights.length) * 10) / 10,
    avgEfficiency: eff.length ? Math.round(eff.reduce((a, b) => a + b, 0) / eff.length) : undefined,
  };
}

export function hoursText(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh} h ${String(mm).padStart(2, '0')}` : `${hh} h`;
}

/** Phrase courte sur la nuit : durée, FC nocturne et ce que ça implique. */
export function nightSummary(n: NightReport): { text: string; tone: 'good' | 'warning' | 'neutral' } {
  const parts = [`${hoursText(n.sleep.hours)} de sommeil`];
  if (n.sleep.efficiency !== undefined) parts.push(`efficacité ${n.sleep.efficiency} %`);
  const hr = n.sleep.hrMin ?? n.sleep.hrAvg;
  if (hr !== undefined) parts.push(`FC nocturne ${hr} bpm${n.hrDelta !== undefined ? ` (${n.hrDelta >= 0 ? '+' : ''}${n.hrDelta} vs ta moyenne)` : ''}`);
  let tone: 'good' | 'warning' | 'neutral' = 'neutral';
  let advice = '';
  if ((n.hrDelta ?? 0) >= 5) {
    tone = 'warning';
    advice = ' Cœur plus rapide que d’habitude cette nuit : récupération incomplète (fatigue, alcool, repas tardif ou infection qui couve).';
  } else if (n.sleep.hours < 6) {
    tone = 'warning';
    advice = ' Nuit courte : séance allégée conseillée, et couche-toi plus tôt ce soir.';
  } else if (n.sleep.hours >= 7 && (n.hrDelta ?? 0) <= 2) {
    tone = 'good';
    advice = ' Bonne récupération.';
  }
  return { text: parts.join(' · ') + '.' + advice, tone };
}
