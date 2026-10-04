import { describe, expect, it } from 'vitest';
import { assess } from '../src/lib/assessment';
import { computeDerived } from '../src/lib/derived';
import { insights } from '../src/lib/insights';
import { skinPlan } from '../src/lib/skin';
import { defaultState } from '../src/lib/storage';
import { autoVolume, buildProgram } from '../src/lib/training';
import type { AppState, WorkoutLog } from '../src/lib/types';
import { addDays } from '../src/lib/util';
import { makeProfile } from './fixtures';

const TODAY = '2026-10-04';

function stateWith(over: Partial<AppState> = {}, profile = makeProfile()): AppState {
  return { ...defaultState(), profile, ...over };
}

function workouts(exerciseId: string, weights: number[]): WorkoutLog[] {
  return weights.map((w, i) => ({ id: `w${i}`, date: addDays(TODAY, -30 + i * 7), sessionId: 's', week: 1, entries: [{ exerciseId, sets: [{ weight: w, reps: 8 }] }] }));
}

describe('bilan 360°', () => {
  it('fumeur : arrêter de fumer passe en n°1', () => {
    const s = stateWith({}, makeProfile({ smoking: 'current' }));
    const a = assess(s, computeDerived(s)!, TODAY);
    expect(a.actions[0].id).toBe('smoke');
  });
  it('sans prise de sang : bilan sanguin demandé, score métabolique à mesurer', () => {
    const s = stateWith();
    const a = assess(s, computeDerived(s)!, TODAY);
    expect(a.actions.some((x) => x.id === 'blood')).toBe(true);
    expect(a.pillars.find((p) => p.id === 'metabolic')!.score).toBeUndefined();
  });
  it('tension élevée = action prioritaire', () => {
    const s = stateWith({ measurements: [{ id: 'bp', date: `${TODAY}T08:00:00Z`, source: 'manual', systolic: 150, diastolic: 95 }], bloodPanels: [{ id: 'b', date: '2026-09-01', values: { apob: 0.7 } }] });
    const a = assess(s, computeDerived(s)!, TODAY);
    expect(a.actions.find((x) => x.id === 'bp')!.impact).toBeGreaterThanOrEqual(9);
  });
  it('score global entre 0 et 100', () => {
    const s = stateWith({ workouts: workouts('db_bench', [30, 32, 32, 34]) });
    const a = assess(s, computeDerived(s)!, TODAY);
    expect(a.global).toBeGreaterThan(0);
    expect(a.global).toBeLessThanOrEqual(100);
  });
});

describe('programme qui apprend', () => {
  it('ajoute une série aux muscles qui stagnent', () => {
    const w = workouts('db_bench', [30, 30, 30, 30]);
    const av = autoVolume(w, TODAY, 70);
    expect(av.adjust.chest).toBe(1);
    const base = buildProgram(makeProfile(), '2026-09-28', 0, TODAY);
    const adj = buildProgram(makeProfile(), '2026-09-28', 0, TODAY, undefined, { volumeAdjust: av.adjust });
    const chest = (p: typeof base) => p.weeklyVolume.find((v) => v.muscle === 'chest')!.sets;
    expect(chest(adj)).toBeGreaterThan(chest(base));
  });
  it('n’ajoute rien quand la forme est basse', () => {
    expect(autoVolume(workouts('db_bench', [30, 30, 30, 30]), TODAY, 30).adjust).toEqual({});
  });
  it('laisse tranquille un muscle qui progresse', () => {
    expect(autoVolume(workouts('db_bench', [30, 32, 34, 36]), TODAY, 70).adjust.chest).toBeUndefined();
  });
});

describe('ce que tes données révèlent', () => {
  it('prévoit la date d’arrivée à l’objectif', () => {
    const ms = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, date: `${addDays(TODAY, -29 + i)}T07:00:00Z`, source: 'withings' as const, weightKg: 86 - i * 0.05, fatPct: 20 - i * 0.04 }));
    const s = stateWith({ measurements: ms });
    const ins = insights(s, computeDerived(s)!, TODAY);
    expect(ins.find((x) => x.id === 'eta')?.title).toMatch(/15 % de gras vers le/);
  });
  it('compare deux prises de sang', () => {
    const s = stateWith({ bloodPanels: [{ id: 'a', date: '2026-06-01', values: { vitd: 18 } }, { id: 'b', date: '2026-09-01', values: { vitd: 45 } }] });
    const ins = insights(s, computeDerived(s)!, TODAY);
    expect(ins.find((x) => x.id === 'blood_up')!.text).toContain('Vit. D');
  });
});

describe('peau', () => {
  it('rétinoïde pour l’anti-âge, jamais pendant la grossesse', () => {
    const p = skinPlan(makeProfile({ skinConcerns: ['aging'] }));
    expect(p.pm.some((x) => x.product.includes('Rétinal'))).toBe(true);
    const preg = skinPlan(makeProfile({ sex: 'female', femaleStatus: 'pregnant', skinConcerns: ['aging', 'acne'] }));
    expect(preg.pm.some((x) => /rétin|adapal|trétin/i.test(x.product))).toBe(false);
    expect(preg.pm.some((x) => x.product.includes('azélaïque'))).toBe(true);
  });
  it('SPF 50 tous les matins pour tout le monde', () => {
    expect(skinPlan(makeProfile()).am.some((x) => x.product.includes('SPF 50'))).toBe(true);
  });
  it('chute de cheveux masculine : minoxidil + finastéride sur ordonnance', () => {
    const p = skinPlan(makeProfile({ hairLoss: true }));
    expect(p.hair.find((x) => x.product.startsWith('Finastéride'))!.rx).toBe(true);
  });
});
