// Import de pesées depuis un fichier CSV : export Withings (Health Mate → Paramètres →
// Télécharger mes données → weight.csv), ou tout CSV « date, poids, % gras… ».
import type { Measurement } from './types';

export function parseCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

type Field = 'date' | 'weightKg' | 'fatMassKg' | 'fatPct' | 'muscleMassKg' | 'boneMassKg' | 'hydrationKg' | 'leanMassKg' | 'visceralFat' | 'waistCm';

function detectField(header: string): Field | undefined {
  const h = norm(header);
  if (/^date|horodatage|time/.test(h)) return 'date';
  if (/visceral/.test(h)) return 'visceralFat';
  if (/(tour de taille|waist)/.test(h)) return 'waistCm';
  if (/(fat free|maigre|lean|ffm|sans graisse)/.test(h)) return 'leanMassKg';
  if (/(%|ratio|taux|pourcentage|percent)/.test(h) && /(fat|gras|graisse)/.test(h)) return 'fatPct';
  if (/(fat|gras|graisse)/.test(h)) return 'fatMassKg';
  if (/muscl/.test(h)) return 'muscleMassKg';
  if (/(bone|osseu)/.test(h)) return 'boneMassKg';
  if (/(hydrat|hydri|water|eau)/.test(h)) return 'hydrationKg';
  if (/(weight|poids)/.test(h)) return 'weightKg';
  return undefined;
}

export function parseDate(s: string): Date | undefined {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 8), +(m[5] ?? 0), +(m[6] ?? 0));
  m = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] ?? 8), +(m[5] ?? 0));
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export interface CsvResult {
  measurements: Measurement[];
  columns: string[];
  skipped: number;
}

export function parseWeightCsv(text: string): CsvResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('Fichier vide ou sans données.');
  const header = lines[0];
  const delim = (header.match(/;/g)?.length ?? 0) > (header.match(/,/g)?.length ?? 0) ? ';' : header.includes('\t') ? '\t' : ',';
  const cols = parseCsvLine(header, delim);
  const fields = cols.map(detectField);
  const lbs = cols.map((c) => /\(lb|lbs|livre/.test(norm(c)));
  if (!fields.includes('date')) throw new Error('Colonne de date introuvable.');
  if (!fields.some((f) => f && f !== 'date')) throw new Error('Aucune colonne de poids / composition reconnue.');

  const out: Measurement[] = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], delim);
    const m: Partial<Measurement> & Record<string, unknown> = {};
    let date: Date | undefined;
    cells.forEach((cell, k) => {
      const f = fields[k];
      if (!f || cell === '') return;
      if (f === 'date') {
        date = parseDate(cell);
        return;
      }
      let v = parseFloat(cell.replace(/\s/g, '').replace(',', '.'));
      if (Number.isNaN(v)) return;
      if (lbs[k]) v *= 0.45359237;
      m[f] = Math.round(v * 100) / 100;
    });
    if (!date || Object.keys(m).length === 0) {
      skipped++;
      continue;
    }
    if (m.fatPct === undefined && m.fatMassKg !== undefined && m.weightKg) m.fatPct = Math.round((m.fatMassKg / m.weightKg) * 1000) / 10;
    out.push({ ...(m as Partial<Measurement>), id: `csv-${date.getTime()}`, date: date.toISOString(), source: 'csv' } as Measurement);
  }
  return { measurements: out, columns: cols, skipped };
}

/**
 * Import par URL (ex. raccourci iOS qui lit l'app Santé) :
 *   …/#import?date=2026-10-01&weight=82.4&fat=17.9&muscle=64.1
 */
export function measurementFromUrl(hash: string): Measurement | undefined {
  const q = hash.split('?')[1];
  if (!hash.startsWith('#import') || !q) return undefined;
  const p = new URLSearchParams(q);
  const num = (k: string) => {
    const v = p.get(k);
    if (v === null) return undefined;
    const n = parseFloat(v.replace(',', '.'));
    return Number.isNaN(n) ? undefined : n;
  };
  const date = parseDate(p.get('date') ?? '') ?? new Date();
  const m: Measurement = {
    id: `url-${date.getTime()}`,
    date: date.toISOString(),
    source: 'url',
    weightKg: num('weight'),
    fatPct: num('fat'),
    muscleMassKg: num('muscle'),
    leanMassKg: num('lean'),
    boneMassKg: num('bone'),
    hydrationKg: num('water'),
    waistCm: num('waist'),
  };
  return m.weightKg || m.fatPct ? m : undefined;
}
