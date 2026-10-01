// Générateur de programme : split selon les jours dispo, sélection d'exercices selon
// matériel/blessures, volume 10-20 séries/muscle/semaine, cycles de 5 semaines
// (4 de progression en RIR décroissant + 1 de décharge), double progression,
// et cardio « longévité » (zone 2 + VO2max 4×4).
import { EXERCISES, EXERCISE_BY_ID, MUSCLE_LABEL, type Exercise, type Muscle, type Pattern } from '../data/exercises';
import type { ExerciseLog, Profile, WorkoutLog } from './types';
import { ageFromBirthYear, daysBetween, todayISO, weekdayIndex } from './util';

export interface ProgramExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: [number, number];
  rir: string;
  rest: number;
  cue: string;
  superset?: boolean;
  alternatives: string[];
}

export interface ProgramSession {
  id: string;
  name: string;
  focus: string;
  exercises: ProgramExercise[];
  estMinutes: number;
}

export interface CardioPlan {
  zone2: { sessions: number; minutes: number; hrLow: number; hrHigh: number };
  vo2: { sessions: number; protocol: string; hrLow: number; hrHigh: number } | null;
  steps: number;
  hrMax: number;
  notes: string[];
}

export interface DayPlan {
  weekday: number;
  sessionId?: string;
  cardio?: 'zone2' | 'vo2max' | 'mobility';
  label: string;
}

export interface Program {
  splitName: string;
  sessions: ProgramSession[];
  schedule: DayPlan[];
  cardio: CardioPlan;
  weeklyVolume: { muscle: Muscle; label: string; sets: number }[];
  week: number;
  cycle: number;
  deload: boolean;
  weekNote: string;
}

const T = {
  FB_A: { name: 'Full body A', focus: 'Quadriceps · poussée · tirage vertical', slots: ['squat', 'h_push', 'v_pull', 'knee_flexion', 'lateral_raise', 'triceps', 'core'] },
  FB_B: { name: 'Full body B', focus: 'Ischios/fessiers · poussée inclinée · tirage horizontal', slots: ['hinge', 'incline_push', 'h_pull', 'lunge', 'rear_delt', 'biceps', 'calves'] },
  FB_C: { name: 'Full body C', focus: 'Jambes unilatéral · épaules · dos', slots: ['lunge', 'v_push', 'v_pull', 'hip_thrust', 'fly', 'lat_iso', 'carry'] },
  UP_A: { name: 'Haut du corps A', focus: 'Pecs · dos · bras', slots: ['h_push', 'v_pull', 'incline_push', 'h_pull', 'lateral_raise', 'biceps', 'triceps'] },
  LO_A: { name: 'Bas du corps A', focus: 'Quadriceps dominant', slots: ['squat', 'knee_flexion', 'hinge', 'knee_extension', 'calves', 'core'] },
  UP_B: { name: 'Haut du corps B', focus: 'Épaules · dos en largeur · bras', slots: ['v_push', 'h_pull', 'fly', 'lat_iso', 'lateral_raise', 'rear_delt', 'triceps', 'biceps'] },
  LO_B: { name: 'Bas du corps B', focus: 'Ischios/fessiers dominant', slots: ['hip_thrust', 'lunge', 'knee_flexion', 'squat', 'calves', 'carry'] },
  PUSH: { name: 'Push', focus: 'Pecs · épaules · triceps', slots: ['h_push', 'incline_push', 'v_push', 'fly', 'lateral_raise', 'triceps'] },
  PULL: { name: 'Pull', focus: 'Dos · arrière d’épaules · biceps', slots: ['v_pull', 'h_pull', 'lat_iso', 'rear_delt', 'biceps', 'biceps', 'carry'] },
  LEGS: { name: 'Jambes', focus: 'Quadriceps · ischios · fessiers · mollets', slots: ['squat', 'hinge', 'lunge', 'knee_flexion', 'knee_extension', 'calves', 'core'] },
} satisfies Record<string, { name: string; focus: string; slots: Pattern[] }>;

type TemplateKey = keyof typeof T;

const SPLITS: Record<number, { name: string; sessions: TemplateKey[]; days: number[] }> = {
  2: { name: 'Full body 2×/semaine', sessions: ['FB_A', 'FB_B'], days: [0, 3] },
  3: { name: 'Full body 3×/semaine', sessions: ['FB_A', 'FB_B', 'FB_C'], days: [0, 2, 4] },
  4: { name: 'Haut / Bas 4×/semaine', sessions: ['UP_A', 'LO_A', 'UP_B', 'LO_B'], days: [0, 1, 3, 4] },
  5: { name: 'Haut / Bas + Push / Pull / Jambes', sessions: ['UP_A', 'LO_A', 'PUSH', 'PULL', 'LEGS'], days: [0, 1, 3, 4, 5] },
  6: { name: 'Push / Pull / Jambes ×2', sessions: ['PUSH', 'PULL', 'LEGS', 'PUSH', 'PULL', 'LEGS'], days: [0, 1, 2, 3, 4, 5] },
};

export function availableExercises(profile: Profile, pattern: Pattern): Exercise[] {
  return EXERCISES.filter(
    (e) => e.pattern === pattern && e.equipment.every((eq) => profile.equipment.includes(eq)) && !e.avoid.some((inj) => profile.injuries.includes(inj)),
  ).sort((a, b) => b.priority - a.priority);
}

const RIR_BY_WEEK: Record<Profile['experience'], string[]> = {
  beginner: ['3', '2-3', '2', '1-2', '4 (décharge)'],
  intermediate: ['3', '2', '1-2', '0-1', '4 (décharge)'],
  advanced: ['2', '1-2', '1', '0 (échec sur la dernière série)', '4 (décharge)'],
};

export function programWeek(programStart: string, today = todayISO()): { week: number; cycle: number } {
  const d = Math.max(0, daysBetween(programStart, today));
  return { week: (Math.floor(d / 7) % 5) + 1, cycle: Math.floor(d / 35) + 1 };
}

export function buildProgram(profile: Profile, programStart: string, variant = 0, today = todayISO(), restingHr?: number): Program {
  const days = Math.min(6, Math.max(2, profile.trainingDays));
  const split = SPLITS[days];
  const { week, cycle } = programWeek(programStart, today);
  const deload = week === 5;
  const usage = new Map<Pattern, number>();

  const sessions: ProgramSession[] = split.sessions.map((key, sIdx) => {
    const tpl = T[key];
    const used = new Set<string>();
    const exercises: ProgramExercise[] = [];
    for (const pattern of tpl.slots as Pattern[]) {
      const options = availableExercises(profile, pattern).filter((e) => !used.has(e.id));
      if (!options.length) continue;
      const n = usage.get(pattern) ?? 0;
      usage.set(pattern, n + 1);
      // Variation entre séances et entre cycles (variant)
      const ex = options[(n + variant + (cycle - 1)) % Math.min(options.length, 3)];
      used.add(ex.id);
      let sets = ex.compound ? (profile.experience === 'advanced' ? 4 : 3) : profile.experience === 'beginner' ? 2 : 3;
      if (days === 2 && ex.compound) sets += 1;
      if (deload) sets = Math.max(1, Math.ceil(sets / 2));
      exercises.push({
        exerciseId: ex.id,
        name: ex.name,
        sets,
        reps: ex.reps,
        rir: RIR_BY_WEEK[profile.experience][week - 1],
        rest: ex.rest,
        cue: ex.cue,
        alternatives: options.filter((o) => o.id !== ex.id).map((o) => o.id),
      });
    }
    fitToDuration(exercises, profile.sessionMinutes);
    return { id: `${key}-${sIdx}`, name: tpl.name, focus: tpl.focus, exercises, estMinutes: estimateMinutes(exercises) };
  });

  const cardio = cardioPlan(profile, restingHr);
  const schedule: DayPlan[] = [];
  const restDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !split.days.includes(d));
  let z2Left = cardio.zone2.sessions;
  let vo2Left = cardio.vo2 ? 1 : 0;
  for (let wd = 0; wd < 7; wd++) {
    const sIdx = split.days.indexOf(wd);
    if (sIdx >= 0) {
      const s = sessions[sIdx];
      schedule.push({ weekday: wd, sessionId: s.id, label: s.name });
    } else if (wd === 6) {
      schedule.push({ weekday: wd, cardio: 'mobility', label: 'Repos actif : marche longue + mobilité' });
    } else if (vo2Left && restDays.length > 1 && wd !== restDays[0]) {
      vo2Left--;
      schedule.push({ weekday: wd, cardio: 'vo2max', label: 'VO2max 4×4' });
    } else if (z2Left) {
      z2Left--;
      schedule.push({ weekday: wd, cardio: 'zone2', label: `Zone 2 · ${cardio.zone2.minutes} min` });
    } else schedule.push({ weekday: wd, cardio: 'mobility', label: 'Repos : marche + mobilité' });
  }
  // Cardio restant : après les séances du haut du corps.
  for (const d of schedule) {
    if (!z2Left && !vo2Left) break;
    const s = sessions.find((x) => x.id === d.sessionId);
    if (!s || /Jambes|Bas|Full/.test(s.name)) continue;
    if (vo2Left) {
      vo2Left--;
      d.label += ' + VO2max 4×4';
    } else {
      z2Left--;
      d.label += ` + Zone 2 ${cardio.zone2.minutes} min`;
    }
  }
  if (z2Left) cardio.notes.push(`Ajoute ${z2Left} séance(s) de zone 2 où tu peux (vélo pour aller au travail, marche rapide en côte…).`);

  return {
    splitName: split.name,
    sessions,
    schedule,
    cardio,
    weeklyVolume: weeklyVolume(sessions),
    week,
    cycle,
    deload,
    weekNote: weekNote(week, profile),
  };
}

function weekNote(week: number, profile: Profile): string {
  if (week === 5) return 'Semaine de décharge : moitié des séries, charges −10 %, RIR 4. Tu récupères et tu consolides les gains.';
  if (week === 1) return profile.experience === 'beginner' ? 'Semaine 1 : apprends la technique, charges confortables, note tout.' : 'Début de cycle : reprends des charges que tu maîtrises, RIR 3.';
  if (week === 4) return 'Semaine la plus dure du cycle : va chercher tes records, au plus proche de l’échec en restant propre.';
  return 'Progression : vise +1 rep ou +1 palier de charge par rapport à la semaine précédente.';
}

export function estimateMinutes(exs: ProgramExercise[]): number {
  let sec = 8 * 60; // échauffement
  for (const e of exs) {
    const work = 45;
    const rest = e.superset ? e.rest / 2 : e.rest;
    sec += e.sets * (work + rest);
  }
  return Math.round(sec / 60);
}

function fitToDuration(exs: ProgramExercise[], minutes: number) {
  if (estimateMinutes(exs) <= minutes) return;
  // 1. Biceps/triceps en superset
  const bi = exs.find((e) => EXERCISE_BY_ID[e.exerciseId].pattern === 'biceps');
  const tri = exs.find((e) => EXERCISE_BY_ID[e.exerciseId].pattern === 'triceps');
  if (bi && tri) bi.superset = tri.superset = true;
  // 2. Retirer les derniers exercices accessoires
  while (estimateMinutes(exs) > minutes && exs.length > 4) {
    const idx = [...exs].reverse().findIndex((e) => !EXERCISE_BY_ID[e.exerciseId].compound);
    if (idx < 0) break;
    exs.splice(exs.length - 1 - idx, 1);
  }
  // 3. Réduire d'une série les exercices à 4 séries puis 3
  for (const target of [4, 3])
    for (const e of exs) if (estimateMinutes(exs) > minutes && e.sets >= target) e.sets--;
}

export function weeklyVolume(sessions: ProgramSession[]): Program['weeklyVolume'] {
  const vol = new Map<Muscle, number>();
  for (const s of sessions)
    for (const pe of s.exercises) {
      const ex = EXERCISE_BY_ID[pe.exerciseId];
      for (const m of ex.primary) vol.set(m, (vol.get(m) ?? 0) + pe.sets);
      for (const m of ex.secondary) vol.set(m, (vol.get(m) ?? 0) + pe.sets * 0.5);
    }
  return [...vol.entries()]
    .map(([muscle, sets]) => ({ muscle, label: MUSCLE_LABEL[muscle], sets: Math.round(sets * 2) / 2 }))
    .sort((a, b) => b.sets - a.sets);
}

export function hrMax(age: number): number {
  return Math.round(208 - 0.7 * age); // Tanaka 2001
}

export function cardioPlan(profile: Profile, restingHr?: number): CardioPlan {
  const age = ageFromBirthYear(profile.birthYear);
  const max = hrMax(age);
  const z2 = restingHr
    ? [Math.round(restingHr + (max - restingHr) * 0.6), Math.round(restingHr + (max - restingHr) * 0.7)]
    : [Math.round(max * 0.62), Math.round(max * 0.72)];
  const beginner = profile.experience === 'beginner';
  const sessions = profile.trainingDays >= 5 ? 2 : 3;
  const minutes = beginner ? 30 : 40;
  const notes = [
    'Zone 2 = tu peux encore parler en phrases complètes, respiration nasale possible. Vélo, rameur, marche rapide en côte ou footing très lent.',
    'Objectif longévité : 150-180 min/semaine d’endurance au total (zone 2 + VO2max), le VO2max étant l’un des plus puissants prédicteurs de mortalité.',
    'Place la zone 2 loin de tes séances jambes, ou après le haut du corps. Le vélo interfère moins avec la prise de muscle que la course.',
  ];
  return {
    zone2: { sessions, minutes, hrLow: z2[0], hrHigh: z2[1] },
    vo2: beginner
      ? null
      : { sessions: 1, protocol: '10 min d’échauffement, puis 4 × 4 min à 85-95 % FCmax, récupération active 3 min entre chaque. Retour au calme 5 min.', hrLow: Math.round(max * 0.85), hrHigh: Math.round(max * 0.95) },
    steps: 9000,
    hrMax: max,
    notes: beginner ? [...notes, 'Le travail VO2max (4×4) sera ajouté après ton premier cycle.'] : notes,
  };
}

// ——— Suivi & progression ———

export function lastPerformance(workouts: WorkoutLog[], exerciseId: string, before?: string): { date: string; log: ExerciseLog } | undefined {
  const sorted = workouts.filter((w) => !before || w.date < before).sort((a, b) => b.date.localeCompare(a.date));
  for (const w of sorted) {
    const log = w.entries.find((e) => e.exerciseId === exerciseId && e.sets.length);
    if (log) return { date: w.date, log };
  }
  return undefined;
}

export function e1rm(weight: number, reps: number, rir = 0): number {
  return weight * (1 + (reps + rir) / 30); // Epley
}

export interface Suggestion {
  weight?: number;
  reps: number;
  text: string;
}

/** Double progression : on monte les reps jusqu'au haut de la fourchette, puis la charge. */
export function suggestNext(pe: ProgramExercise, last: ExerciseLog | undefined, deload: boolean): Suggestion {
  const ex = EXERCISE_BY_ID[pe.exerciseId];
  const [lo, hi] = pe.reps;
  if (!last || !last.sets.length)
    return { reps: lo, text: `Trouve une charge qui te permet ${lo}-${hi} reps en gardant ${pe.rir.split(' ')[0]} rep(s) en réserve.` };
  const top = Math.max(...last.sets.map((s) => s.weight));
  const topSets = last.sets.filter((s) => s.weight === top);
  if (deload) {
    const w = ex.step ? Math.round((top * 0.9) / ex.step) * ex.step : top;
    return { weight: w, reps: lo, text: `Décharge : ${w || 'poids du corps'}${w ? ' kg' : ''} × ${lo} reps, sans forcer.` };
  }
  if (topSets.every((s) => s.reps >= hi)) {
    if (ex.step) {
      const w = top + ex.step;
      return { weight: w, reps: lo, text: `Bravo : toutes les séries au max → monte à ${w} kg et vise ${lo}+ reps.` };
    }
    return { weight: top, reps: hi, text: 'Toutes les séries au max : ajoute du lest (sac à dos), ralentis la descente ou passe à une variante plus dure.' };
  }
  const minReps = Math.min(...topSets.map((s) => s.reps));
  return { weight: top, reps: Math.min(hi, minReps + 1), text: `Garde ${top || 'le poids du corps'}${top ? ' kg' : ''} et vise ${Math.min(hi, minReps + 1)}+ reps sur chaque série.` };
}

/** « 3 × 8-12 » ou « 3 × 40 m » */
export function setsText(pe: ProgramExercise): string {
  const label = EXERCISE_BY_ID[pe.exerciseId]?.repsLabel;
  return `${pe.sets} × ${label ?? `${pe.reps[0]}-${pe.reps[1]} reps`}`;
}

export function sessionForDate(program: Program, day: string): ProgramSession | undefined {
  const plan = program.schedule[weekdayIndex(day)];
  return program.sessions.find((s) => s.id === plan?.sessionId);
}

export function exerciseHistory(workouts: WorkoutLog[], exerciseId: string): { date: string; e1rm: number; best: string }[] {
  return workouts
    .filter((w) => w.entries.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => {
      const sets = w.entries.find((e) => e.exerciseId === exerciseId)!.sets;
      const best = sets.reduce((acc, s) => (e1rm(s.weight, s.reps, s.rir) > e1rm(acc.weight, acc.reps, acc.rir) ? s : acc), sets[0]);
      return { date: w.date, e1rm: Math.round(e1rm(best.weight, best.reps, best.rir) * 10) / 10, best: `${best.weight} kg × ${best.reps}` };
    });
}
