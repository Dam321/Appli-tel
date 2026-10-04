import { describe, expect, it } from 'vitest';
import { bodySnapshot, bpCategory, navyBodyFat } from '../src/lib/bodyComp';
import { dayTimeline } from '../src/lib/longevity';
import { computeTargets, weeklyCheckIn } from '../src/lib/nutrition';
import { generateWeekPlan } from '../src/lib/mealPlanner';
import { upgradeProfile } from '../src/lib/profile';
import { migrate } from '../src/lib/storage';
import { supplementPlan } from '../src/lib/supplements';
import { adjustForReadiness, buildProgram, readinessAdvice, readinessScore, suggestNext } from '../src/lib/training';
import { EXERCISE_BY_ID } from '../src/data/exercises';
import { food } from '../src/data/foods';
import { makeProfile } from './fixtures';

const supps = (over: Parameters<typeof makeProfile>[0], blood: Record<string, number> = {}) => {
  const p = makeProfile(over);
  return Object.fromEntries(supplementPlan({ profile: p, age: 36, weightKg: 85, blood, month: 10 }).map((r) => [r.id, r]));
};

describe('nutrition selon la santé', () => {
  it('grossesse : jamais de déficit', () => {
    const p = makeProfile({ sex: 'female', femaleStatus: 'pregnant', bodyFatPct: 32, weightKg: 70, heightCm: 165 });
    const t = computeTargets(p, bodySnapshot(p, []));
    expect(t.phase).toBe('maintain');
    expect(t.kcal).toBeGreaterThan(t.tdee);
  });
  it('maladie rénale : protéines plafonnées', () => {
    const p = makeProfile({ conditions: ['kidney'] });
    const t = computeTargets(p, bodySnapshot(p, []));
    expect(t.protein).toBeLessThanOrEqual(85 * 0.9 + 5);
    expect(t.notes.length).toBeGreaterThan(0);
  });
  it('diabète : glucides ≤ ~35 % des calories', () => {
    const p = makeProfile({ conditions: ['diabetes'] });
    const t = computeTargets(p, bodySnapshot(p, []));
    expect((t.carbs * 4) / t.kcal).toBeLessThanOrEqual(0.37);
  });
});

describe('bilan hebdomadaire', () => {
  const p = makeProfile();
  const t = computeTargets(p, bodySnapshot(p, []));
  it('ne touche pas aux calories si le plan n’est pas suivi', () => {
    expect(weeklyCheckIn(t, 0, 21, { mealAdherence: 0.5 }).suggestion).toBe(0);
  });
  it('protège la masse maigre en sèche', () => {
    const r = weeklyCheckIn(t, t.targetRateKg, 21, { leanRateKg: -0.4 });
    expect(r.suggestion).toBeGreaterThanOrEqual(100);
    expect(r.message).not.toContain('on ne change rien');
    // perte de masse maigre minoritaire (bruit de la balance) : pas d'alerte
    expect(weeklyCheckIn(t, -1.0, 21, { leanRateKg: -0.25 }).message).not.toContain('masse maigre');
  });
});

describe('compléments : sécurité', () => {
  it('anticoagulant : pas de K2, oméga-3 sous contrôle', () => {
    const r = supps({ medications: ['anticoagulant'] });
    expect(r.vitd.name).toContain('sans K2');
    expect(['conditional', 'avoid']).toContain(r.omega3.status);
  });
  it('metformine : B12 recommandée, berbérine évitée', () => {
    const r = supps({ medications: ['metformin'], conditions: ['diabetes'] }, { hba1c: 6.5 });
    expect(r.b12.status).toBe('recommended');
    expect(r.berberine.status).toBe('avoid');
  });
  it('grossesse : créatine évitée, folates indispensables', () => {
    const r = supps({ sex: 'female', femaleStatus: 'pregnant' });
    expect(r.creatine.status).toBe('avoid');
    expect(r.folate.status).toBe('essential');
  });
  it('maladie rénale : pas de créatine ni de magnésium', () => {
    const r = supps({ conditions: ['kidney'] });
    expect(r.creatine.status).toBe('avoid');
    expect(r.magnesium.status).toBe('avoid');
  });
  it('fumeur : bêta-carotène à éviter', () => {
    expect(supps({ smoking: 'current' }).beta_carotene.status).toBe('avoid');
  });
});

describe('programme personnalisé', () => {
  it('respecte les jours choisis', () => {
    const p = makeProfile({ trainingDays: 3, trainingWeekdays: [1, 3, 5] });
    const prog = buildProgram(p, '2026-09-28', 0, '2026-09-29');
    expect(prog.schedule.filter((d) => d.sessionId).map((d) => d.weekday)).toEqual([1, 3, 5]);
  });
  it('donne plus de volume aux muscles prioritaires', () => {
    const base = buildProgram(makeProfile(), '2026-09-28', 0, '2026-09-29');
    const prio = buildProgram(makeProfile({ priorities: ['shoulders', 'arms'] }), '2026-09-28', 0, '2026-09-29');
    const vol = (prog: typeof base, m: string) => prog.weeklyVolume.find((v) => v.muscle === m)?.sets ?? 0;
    expect(vol(prio, 'side_delts')).toBeGreaterThan(vol(base, 'side_delts'));
    expect(vol(prio, 'biceps')).toBeGreaterThan(vol(base, 'biceps'));
  });
  it('cœur : pas de fractionné intense, RIR ≥ 2', () => {
    const prog = buildProgram(makeProfile({ conditions: ['heart'], experience: 'advanced' }), '2026-09-01', 0, '2026-09-24');
    expect(prog.cardio.vo2).toBeNull();
    for (const s of prog.sessions) for (const e of s.exercises) expect(parseInt(e.rir, 10)).toBeGreaterThanOrEqual(2);
  });
  it('forme du jour', () => {
    expect(readinessAdvice(readinessScore({ sleep: 5, energy: 5, soreness: 4, motivation: 5 })).level).toBe('go');
    expect(readinessAdvice(readinessScore({ sleep: 1, energy: 1, soreness: 2, motivation: 1 })).level).toBe('rest');
    const s = buildProgram(makeProfile(), '2026-09-28', 0, '2026-09-29').sessions[0];
    const light = adjustForReadiness(s, 'easy');
    expect(light.exercises[0].sets).toBe(Math.max(1, s.exercises[0].sets - 1));
  });
  it('progression selon le RIR', () => {
    const pe = { exerciseId: 'db_bench', name: '', sets: 3, reps: [6, 10] as [number, number], rir: '1-2', rest: 120, cue: '', alternatives: [] };
    expect(suggestNext(pe, { exerciseId: 'db_bench', sets: [{ weight: 30, reps: 8, rir: 4 }, { weight: 30, reps: 8, rir: 3 }] }, false).weight).toBe(32);
    expect(suggestNext(pe, { exerciseId: 'db_bench', sets: [{ weight: 30, reps: 4, rir: 0 }] }, false).weight).toBeLessThan(30);
    expect(EXERCISE_BY_ID.db_bench.step).toBe(2);
  });
});

describe('menu personnalisé', () => {
  it('profil lipidique : pas de viande rouge', () => {
    const p = makeProfile();
    const t = computeTargets(p, bodySnapshot(p, []));
    for (let seed = 1; seed < 6; seed++) {
      const w = generateWeekPlan(p, t, { mealSeed: seed, mealWeekStart: '2026-09-28', mealOverrides: {} }, { lipidFocus: true });
      for (const d of w.days) for (const m of d.meals) for (const i of m.ingredients) expect(food(i.food).animal).not.toBe('red_meat');
    }
  });
  it('temps de cuisine respecté', () => {
    const p = makeProfile({ maxCookMinutes: 15 });
    const t = computeTargets(p, bodySnapshot(p, []));
    const w = generateWeekPlan(p, t, { mealSeed: 3, mealWeekStart: '2026-09-28', mealOverrides: {} });
    const mains = w.days.flatMap((d) => d.meals.filter((m) => m.slot === 'lunch' || m.slot === 'dinner'));
    expect(mains.every((m) => m.minutes <= 20)).toBe(true);
  });
});

describe('mesures & rythme', () => {
  it('méthode Navy plausible', () => {
    const bf = navyBodyFat('male', 180, 38, 86)!;
    expect(bf).toBeGreaterThan(12);
    expect(bf).toBeLessThan(20);
    expect(bpCategory(145, 92).tone).toBe('critical');
  });
  it('journée type ordonnée', () => {
    const tl = dayTimeline({ wakeTime: '06:30', bedTime: '22:30', trainingTime: 'evening', mealsPerDay: 4 }, { training: 'Haut du corps A', eveningSupps: ['Magnésium'] });
    expect(tl[0].time).toBe('06:30');
    expect(tl[tl.length - 1].label).toBe('Coucher');
    expect(tl[tl.length - 1].detail).toContain('8 h 00');
    const dinner = tl.find((x) => x.label === 'Dîner')!;
    expect(dinner.time <= '20:00').toBe(true);
    expect(tl.find((x) => x.label === 'Dernière caféine')!.time).toBe('13:30');
  });
  it('mise à niveau d’un ancien profil', () => {
    const old = { ...makeProfile() } as Record<string, unknown>;
    delete old.conditions;
    delete old.profileVersion;
    const up = upgradeProfile(old);
    expect(up.conditions).toEqual([]);
    expect(up.profileVersion).toBe(1);
    expect(migrate({ measurements: [], profile: old }).profile!.wakeTime).toBe('07:00');
  });
});

describe('durée des séances', () => {
  it('les gros mouvements gardent au moins 3 séries même avec des priorités', () => {
    const prog = buildProgram(makeProfile({ priorities: ['shoulders', 'arms', 'back'], sessionMinutes: 60 }), '2026-09-28', 0, '2026-09-29');
    for (const s of prog.sessions)
      for (const e of s.exercises) if (EXERCISE_BY_ID[e.exerciseId].compound) expect(e.sets).toBeGreaterThanOrEqual(3);
  });
});
