import { describe, expect, it } from 'vitest';
import { bioAge, nextBloodTest, phenoAge } from '../src/lib/bioage';
import { makeProfile } from './fixtures';

const healthy = { albumin: 46, creatinine: 85, glucose: 88, crp: 0.5, lymph_pct: 32, mcv: 89, rdw: 12.5, alp: 60, wbc: 5.2 };
const unhealthy = { albumin: 40, creatinine: 95, glucose: 115, crp: 6, lymph_pct: 20, mcv: 96, rdw: 15, alp: 110, wbc: 9.5 };

describe('âge biologique (PhenoAge)', () => {
  it('profil sain : plus jeune que l’âge réel', () => {
    const pa = phenoAge(healthy, 40)!;
    console.log('healthy 40 →', pa.toFixed(1), '| unhealthy 40 →', phenoAge(unhealthy, 40)!.toFixed(1));
    expect(pa).toBeLessThan(40);
    expect(pa).toBeGreaterThan(25);
  });
  it('profil inflammatoire : plus vieux que l’âge réel', () => {
    expect(phenoAge(unhealthy, 40)!).toBeGreaterThan(45);
  });
  it('liste les marqueurs manquants', () => {
    const r = bioAge([{ id: 'x', date: '2026-09-01', values: { glucose: 90, crp: 1 } }], makeProfile());
    expect(r.phenoAge).toBeUndefined();
    expect(r.missing).toContain('Albumine');
  });
  it('planifie le prochain bilan', () => {
    const p = makeProfile();
    expect(nextBloodTest([{ id: 'x', date: '2026-09-01', values: { vitd: 18 } }], p).date).toBe('2026-11-30');
    expect(nextBloodTest([{ id: 'x', date: '2026-09-01', values: { vitd: 50 } }], p).date).toBe('2027-09-01');
  });
});
