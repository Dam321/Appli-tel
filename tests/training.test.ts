import { describe, expect, it } from 'vitest';
import { buildProgram, suggestNext, programWeek, e1rm } from '../src/lib/training';
import { EXERCISE_BY_ID } from '../src/data/exercises';
import { makeProfile } from './fixtures';

describe('programme', () => {
  for (const days of [2, 3, 4, 5, 6]) {
    it(`génère un split cohérent pour ${days} jours`, () => {
      const p = makeProfile({ trainingDays: days });
      const prog = buildProgram(p, '2026-09-28', 0, '2026-09-29');
      expect(prog.sessions).toHaveLength(days);
      expect(prog.schedule).toHaveLength(7);
      expect(prog.schedule.filter((d) => d.sessionId)).toHaveLength(days);
      for (const s of prog.sessions) {
        expect(s.exercises.length).toBeGreaterThanOrEqual(4);
        expect(s.estMinutes).toBeLessThanOrEqual(p.sessionMinutes + 5);
        expect(new Set(s.exercises.map((e) => e.exerciseId)).size).toBe(s.exercises.length);
      }
      const vol = Object.fromEntries(prog.weeklyVolume.map((v) => [v.muscle, v.sets]));
      for (const m of ['chest', 'quads', 'lats']) expect(vol[m]).toBeGreaterThanOrEqual(5);
    });
  }
  it('respecte matériel et blessures', () => {
    const p = makeProfile({ equipment: [], injuries: ['shoulder', 'knee'], trainingDays: 3 });
    const prog = buildProgram(p, '2026-09-28', 0, '2026-09-29');
    for (const s of prog.sessions)
      for (const e of s.exercises) {
        const ex = EXERCISE_BY_ID[e.exerciseId];
        expect(ex.equipment).toEqual([]);
        expect(ex.avoid).not.toContain('shoulder');
        expect(ex.avoid).not.toContain('knee');
      }
  });
  it('semaine 5 = décharge', () => {
    expect(programWeek('2026-09-01', '2026-09-30')).toEqual({ week: 5, cycle: 1 });
    const prog = buildProgram(makeProfile(), '2026-09-01', 0, '2026-09-30');
    expect(prog.deload).toBe(true);
  });
  it('double progression', () => {
    const pe = { exerciseId: 'db_bench', name: '', sets: 3, reps: [6, 10] as [number, number], rir: '2', rest: 120, cue: '', alternatives: [] };
    const up = suggestNext(pe, { exerciseId: 'db_bench', sets: [{ weight: 30, reps: 10 }, { weight: 30, reps: 10 }] }, false);
    expect(up.weight).toBe(32);
    const same = suggestNext(pe, { exerciseId: 'db_bench', sets: [{ weight: 30, reps: 8 }, { weight: 30, reps: 7 }] }, false);
    expect(same.weight).toBe(30);
    expect(same.reps).toBe(8);
    expect(Math.round(e1rm(100, 5))).toBe(117);
  });
});
