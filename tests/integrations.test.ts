import { describe, expect, it } from 'vitest';
import { measurementFromUrl, parseWeightCsv } from '../src/lib/csvImport';
import { mergeMeasurements, parseMeasureGroups } from '../src/lib/withings';
import { migrate } from '../src/lib/storage';

describe('import CSV', () => {
  it('lit l’export Withings anglais', () => {
    const csv = `Date,"Weight (kg)","Fat mass (kg)","Bone mass (kg)","Muscle mass (kg)","Hydration (kg)",Comments
"2026-09-30 07:12:45",84.2,16.4,3.4,63.6,47.1,
"2026-09-29 07:05:01",84.6,,,,,`;
    const r = parseWeightCsv(csv);
    expect(r.measurements).toHaveLength(2);
    expect(r.measurements[0].weightKg).toBe(84.2);
    expect(r.measurements[0].fatMassKg).toBe(16.4);
    expect(r.measurements[0].fatPct).toBeCloseTo(19.5, 1);
    expect(r.measurements[0].muscleMassKg).toBe(63.6);
  });
  it('lit un export français séparé par des points-virgules', () => {
    const csv = `Date;Poids (kg);Taux de graisse (%);Masse musculaire (kg)
01/10/2026 07:30;83,9;19,4;63,8`;
    const r = parseWeightCsv(csv);
    expect(r.measurements[0].weightKg).toBe(83.9);
    expect(r.measurements[0].fatPct).toBe(19.4);
    expect(r.measurements[0].date.slice(0, 7)).toBe('2026-10');
  });
  it('import par URL', () => {
    const m = measurementFromUrl('#import?date=2026-10-01&weight=82.4&fat=17.9');
    expect(m?.weightKg).toBe(82.4);
    expect(m?.fatPct).toBe(17.9);
    expect(measurementFromUrl('#/home')).toBeUndefined();
  });
});

describe('Withings', () => {
  it('convertit les groupes de mesures', () => {
    const ms = parseMeasureGroups([
      { grpid: 1, date: 1759300000, category: 1, measures: [ { type: 1, value: 84250, unit: -3 }, { type: 6, value: 1945, unit: -2 }, { type: 76, value: 6360, unit: -2 } ] },
      { grpid: 2, date: 1759300000, category: 2, measures: [{ type: 1, value: 80000, unit: -3 }] },
    ]);
    expect(ms).toHaveLength(1);
    expect(ms[0].weightKg).toBe(84.25);
    expect(ms[0].fatPct).toBe(19.45);
    expect(ms[0].muscleMassKg).toBe(63.6);
  });
  it('dédoublonne à la fusion', () => {
    const a = [{ id: 'withings-1', date: '2026-09-30T07:00:00Z', source: 'withings' as const, weightKg: 84 }];
    const r = mergeMeasurements(a, [{ id: 'withings-1', date: '2026-09-30T07:00:00Z', source: 'withings', weightKg: 84 }, { id: 'withings-2', date: '2026-10-01T07:00:00Z', source: 'withings', weightKg: 83.8 }]);
    expect(r.list).toHaveLength(2);
    expect(r.added).toBe(1);
  });
});

describe('stockage', () => {
  it('migre un état incomplet', () => {
    const s = migrate({ measurements: [], plan: { mealSeed: 3 } });
    expect(s.plan.mealSeed).toBe(3);
    expect(s.plan.shoppingExtra).toEqual([]);
    expect(s.settings.theme).toBe('auto');
  });
});
