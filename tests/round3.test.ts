import { describe, expect, it } from 'vitest';
import { assess } from '../src/lib/assessment';
import { mapLabResults, MARKER_BY_ID, matchUnit, normalizeUnit } from '../src/lib/blood';
import { dayBalance } from '../src/lib/dayBalance';
import { computeDerived } from '../src/lib/derived';
import { gearList, notWorthIt } from '../src/lib/gear';
import type { PlannedMeal } from '../src/lib/mealPlanner';
import { nightReport, sleepStats } from '../src/lib/sleep';
import { defaultState, migrate } from '../src/lib/storage';
import { readinessScore } from '../src/lib/training';
import type { AppState, DailyLog, LoggedMeal } from '../src/lib/types';
import { addDays } from '../src/lib/util';
import { parseSleepSeries } from '../src/lib/withings';
import { makeProfile } from './fixtures';

const TODAY = '2026-10-04';

function stateWith(over: Partial<AppState> = {}, profile = makeProfile()): AppState {
  return { ...defaultState(), profile, ...over };
}

const meal = (slot: PlannedMeal['slot'], kcal: number, p: number): PlannedMeal => ({
  slot,
  recipeId: slot,
  name: slot,
  minutes: 10,
  ingredients: [],
  macros: { kcal, p, c: 0, f: 0, fib: 0 } as PlannedMeal['macros'],
  steps: [],
  substitutions: [],
});

const extra = (kcal: number, protein: number, replaces?: string): LoggedMeal => ({ id: 'x', at: '', name: 'Resto', kcal, protein, replaces, source: 'manual' });

describe('Withings sommeil', () => {
  it('résumé de nuit → jour du réveil, heures, FC', () => {
    const end = Math.floor(new Date('2026-10-04T07:00:00').getTime() / 1000);
    const nights = parseSleepSeries([
      { enddate: end, data: { total_sleep_time: 7.5 * 3600, sleep_efficiency: 0.91, hr_min: 48, hr_average: 55, deepsleepduration: 5400 } },
      { enddate: end - 3600 * 10, data: { total_sleep_time: 1800 } }, // sieste ignorée
    ]);
    expect(nights).toHaveLength(1);
    expect(nights[0].date).toBe('2026-10-04');
    expect(nights[0].sleep).toMatchObject({ hours: 7.5, efficiency: 91, hrMin: 48, deepMin: 90 });
  });

  it('FC nocturne au-dessus de la moyenne → écart calculé et forme pénalisée', () => {
    const daily: Record<string, DailyLog> = {};
    for (let i = 1; i <= 10; i++) daily[addDays(TODAY, -i)] = { habits: {}, meals: {}, sleep: { hours: 7.5, hrMin: 50 } };
    daily[TODAY] = { habits: {}, meals: {}, sleep: { hours: 7, hrMin: 58 } };
    const n = nightReport(daily, TODAY)!;
    expect(n.baselineHr).toBe(50);
    expect(n.hrDelta).toBe(8);
    const base = { sleep: 4, energy: 4, soreness: 4, motivation: 4 };
    expect(readinessScore({ ...base, hrDelta: n.hrDelta })).toBe(readinessScore(base) - 15);
    expect(sleepStats(daily, TODAY)!.nights).toBe(11);
  });

  it('pas de référence sans 7 nuits', () => {
    const daily: Record<string, DailyLog> = { [TODAY]: { habits: {}, meals: {}, sleep: { hours: 7, hrMin: 58 } } };
    expect(nightReport(daily, TODAY)!.hrDelta).toBeUndefined();
  });

  it('le bilan 360° utilise le sommeil mesuré', () => {
    const daily: Record<string, DailyLog> = {};
    for (let i = 0; i < 10; i++) daily[addDays(TODAY, -i)] = { habits: {}, meals: {}, sleep: { hours: 6.2 } };
    const s = stateWith({ daily });
    const a = assess(s, computeDerived(s)!, TODAY);
    expect(a.pillars.find((p) => p.id === 'sleep')!.detail).toMatch(/mesurées/);
    expect(a.actions.some((x) => x.id === 'sleep')).toBe(true);
  });
});

describe('repas hors menu', () => {
  const meals = [meal('breakfast', 600, 40), meal('lunch', 800, 50), meal('snack', 300, 25), meal('dinner', 800, 50)];
  const target = { kcal: 2500, protein: 165 };

  it('sans repas hors menu : pas de conseil', () => {
    expect(dayBalance(meals, { breakfast: true }, [], target, 'omnivore').advice).toHaveLength(0);
  });

  it('gros resto le midi → réduire les féculents du soir, garder les protéines', () => {
    const b = dayBalance(meals, { breakfast: true }, [extra(1400, 25, 'lunch')], target, 'omnivore');
    expect(b.eaten.kcal).toBe(2000);
    expect(b.remainingMeals.map((m) => m.slot)).toEqual(['snack', 'dinner']);
    expect(b.advice[0]).toMatch(/protéines/);
    expect(b.advice[0]).toMatch(/féculents/);
    expect(b.advice.some((a) => /manquera/.test(a))).toBe(true);
  });

  it('repas léger → marge disponible', () => {
    const b = dayBalance(meals, { breakfast: true }, [extra(400, 45, 'lunch')], target, 'omnivore');
    expect(b.advice[0]).toMatch(/marge/);
  });

  it('végan : complément de protéines végétal', () => {
    const b = dayBalance(meals, { breakfast: true }, [extra(800, 10, 'lunch')], target, 'vegan');
    expect(b.advice.join(' ')).toMatch(/tofu|pois/);
  });

  it('journée finie largement au-dessus : pas de compensation extrême', () => {
    const b = dayBalance(meals, { breakfast: true, lunch: true, snack: true, dinner: true }, [extra(900, 20)], target, 'omnivore');
    expect(b.tone).toBe('warning');
    expect(b.advice[0]).toMatch(/Ne compense pas/);
  });
});

describe('lecture du compte-rendu sanguin', () => {
  it('normalise les unités imprimées', () => {
    expect(normalizeUnit('µmol/L')).toBe(normalizeUnit('umol/l'));
    expect(normalizeUnit('mUI/L')).toBe(normalizeUnit('mU/L'));
    expect(normalizeUnit('10^9/L')).toBe('g/l');
    expect(matchUnit(MARKER_BY_ID.glucose, 'g/l')).toBe('g/L');
    expect(matchUnit(MARKER_BY_ID.creatinine, 'umol/L')).toBe('µmol/L');
    expect(matchUnit(MARKER_BY_ID.wbc, 'Giga/L')).toBe('G/L');
    expect(matchUnit(MARKER_BY_ID.wbc, '/mm3')).toBe('/mm³');
    expect(matchUnit(MARKER_BY_ID.lpa, 'mg/dL')).toBe('mg/dL (≈)');
  });

  it('unité connue → valeur imprimée ; unité inconnue → valeur convertie par l’IA', () => {
    const r = mapLabResults([
      { id: 'glucose', value: 0.92, unit: 'g/L', canonicalValue: 92 },
      { id: 'b12', value: 450, unit: 'ng/L', canonicalValue: 450 },
      { id: 'nope', value: 1, unit: 'x', canonicalValue: 1 },
    ]);
    expect(r.vals).toEqual({ glucose: 0.92, b12: 450 });
    expect(r.units).toEqual({ glucose: 'g/L', b12: 'pg/mL' });
  });
});

describe('équipement', () => {
  it('salle de sport : pas d’haltères ; maison : haltères essentiels', () => {
    const gym = stateWith();
    expect(gearList(gym, computeDerived(gym)!, TODAY).some((g) => g.id === 'dumbbells')).toBe(false);
    const home = stateWith({}, makeProfile({ equipment: ['bands'] }));
    const g = gearList(home, computeDerived(home)!, TODAY).find((x) => x.id === 'dumbbells')!;
    expect(g.tier).toBe('essential');
  });

  it('détection : mètre ruban et tensiomètre déjà utilisés', () => {
    const s = stateWith({ measurements: [{ id: 'm', date: `${TODAY}T08:00:00Z`, source: 'manual', waistCm: 85, systolic: 120, diastolic: 80 }] });
    const list = gearList(s, computeDerived(s)!, TODAY);
    expect(list.find((g) => g.id === 'tape')!.detected).toBe(true);
    expect(list.find((g) => g.id === 'bp')!.detected).toBe(true);
  });

  it('tensiomètre essentiel avec antécédents cardiaques ; capteur de glucose déconseillé sauf diabète', () => {
    const s = stateWith({}, makeProfile({ familyHistory: ['heart'] }));
    const d = computeDerived(s)!;
    expect(gearList(s, d, TODAY).find((g) => g.id === 'bp')!.tier).toBe('essential');
    expect(notWorthIt(s, d).some((x) => /glucose/.test(x.name))).toBe(true);
    const diab = stateWith({}, makeProfile({ conditions: ['diabetes'] }));
    expect(notWorthIt(diab, computeDerived(diab)!).some((x) => /glucose/.test(x.name))).toBe(false);
  });

  it('pas de tension mesurée → action « Mesurer ta tension »', () => {
    const s = stateWith();
    expect(assess(s, computeDerived(s)!, TODAY).actions.some((x) => x.id === 'bp_measure')).toBe(true);
  });

  it('anciennes sauvegardes : champ équipement ajouté', () => {
    const old = JSON.parse(JSON.stringify(defaultState()));
    delete old.gear;
    expect(migrate(old).gear).toEqual({});
  });
});
