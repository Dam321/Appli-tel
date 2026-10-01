import { describe, expect, it } from 'vitest';
import { MARKER_BY_ID, markerStatus, derivedMetrics, prescriptionText } from '../src/lib/blood';
import { supplementPlan } from '../src/lib/supplements';
import { makeProfile } from './fixtures';

describe('bilan sanguin', () => {
  it('classe les valeurs', () => {
    expect(markerStatus(MARKER_BY_ID.vitd, 'male', 18)).toBe('low');
    expect(markerStatus(MARKER_BY_ID.vitd, 'male', 35)).toBe('borderline_low');
    expect(markerStatus(MARKER_BY_ID.vitd, 'male', 50)).toBe('optimal');
    expect(markerStatus(MARKER_BY_ID.ferritin, 'female', 20)).toBe('borderline_low');
    expect(markerStatus(MARKER_BY_ID.hdl, 'male', 120)).toBe('borderline_high');
  });
  it('convertit les unités françaises', () => {
    const g = MARKER_BY_ID.glucose.altUnits!.find((u) => u.unit === 'g/L')!;
    expect(g.toCanonical(0.92)).toBeCloseTo(92);
    const a1c = MARKER_BY_ID.hba1c.altUnits![0];
    expect(a1c.toCanonical(37)).toBeCloseTo(5.5, 1);
  });
  it('calcule HOMA-IR', () => {
    const d = derivedMetrics({ glucose: 90, insulin: 5 });
    expect(d[0].value).toBeCloseTo(1.11, 1);
  });
  it('produit une ordonnance', () => {
    expect(prescriptionText('male', 35)).toContain('Ferritine');
  });
});

describe('compléments', () => {
  it('adapte vitamine D, fer et B12', () => {
    const p = makeProfile({ diet: 'vegan' });
    const recs = supplementPlan({ profile: p, age: 36, weightKg: 85, blood: { vitd: 18, ferritin: 20 }, month: 10 });
    const by = Object.fromEntries(recs.map((r) => [r.id, r]));
    expect(by.vitd.status).toBe('essential');
    expect(by.iron.status).toBe('essential');
    expect(by.b12.status).toBe('essential');
    expect(by.creatine.status).toBe('essential');
    expect(by.omega3.name).toContain('algues');
  });
  it('déconseille le fer si ferritine haute', () => {
    const recs = supplementPlan({ profile: makeProfile(), age: 36, weightKg: 85, blood: { ferritin: 400 }, month: 5 });
    expect(recs.find((r) => r.id === 'iron')!.status).toBe('avoid');
  });
});
