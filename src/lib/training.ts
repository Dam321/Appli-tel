// Générateur de programme : split selon les jours dispo, sélection d'exercices selon
// matériel/blessures, volume 10-20 séries/muscle/semaine, cycles de 5 semaines
// (4 de progression en RIR décroissant + 1 de décharge), double progression,
// et cardio « longévité » (zone 2 + VO2max 4×4).
import { EXERCISES, EXERCISE_BY_ID, MUSCLE_LABEL, type Exercise, type Muscle, type Pattern } from '../data/exercises';
import type { CardioMode, ExerciseLog, MusclePriority, Profile, Readiness, WorkoutLog } from './types';
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
  /** Exercice ajouté / renforcé pour un muscle prioritaire */
  priority?: boolean;
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
  /** Activités conseillées selon tes préférences */
  modes: string;
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
  /** Adaptations liées à la santé */
  healthNotes: string[];
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

/** Muscles et mouvements supplémentaires pour chaque priorité esthétique */
export const PRIORITY_INFO: Record<MusclePriority, { label: string; muscles: Muscle[]; patterns: Pattern[] }> = {
  chest: { label: 'Pectoraux', muscles: ['chest'], patterns: ['fly'] },
  back: { label: 'Dos (largeur & épaisseur)', muscles: ['lats', 'upper_back'], patterns: ['lat_iso', 'h_pull'] },
  shoulders: { label: 'Épaules', muscles: ['side_delts', 'rear_delts', 'front_delts'], patterns: ['lateral_raise', 'rear_delt'] },
  arms: { label: 'Bras', muscles: ['biceps', 'triceps'], patterns: ['biceps', 'triceps'] },
  glutes: { label: 'Fessiers', muscles: ['glutes'], patterns: ['hip_thrust'] },
  legs: { label: 'Cuisses', muscles: ['quads', 'hamstrings'], patterns: ['knee_extension', 'knee_flexion'] },
  abs: { label: 'Abdos / taille', muscles: ['abs'], patterns: ['core'] },
  calves: { label: 'Mollets', muscles: ['calves'], patterns: ['calves'] },
};

const MODE_LABEL: Record<CardioMode, string> = {
  bike: 'vélo',
  run: 'course à pied',
  row: 'rameur',
  swim: 'natation',
  walk: 'marche rapide en côte',
  elliptical: 'vélo elliptique',
};

/** Plafonne l'intensité (RIR minimum) pour raisons de santé */
function capRir(rir: string, min: number): string {
  const n = parseInt(rir, 10);
  if (Number.isNaN(n) || n >= min) return rir;
  return `${min}${rir.includes('décharge') ? ' (décharge)' : ''}`;
}

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

export interface ProgramOptions {
  /** Ajustement de séries par muscle, appris des performances (voir autoVolume) */
  volumeAdjust?: Partial<Record<Muscle, number>>;
}

export function buildProgram(profile: Profile, programStart: string, variant = 0, today = todayISO(), restingHr?: number, opts: ProgramOptions = {}): Program {
  const days = Math.min(6, Math.max(2, profile.trainingDays));
  const split = SPLITS[days];
  const preferred = [...new Set(profile.trainingWeekdays ?? [])].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  const liftDays = preferred.length === days ? preferred : split.days;
  const { week, cycle } = programWeek(programStart, today);
  const deload = week === 5;
  const usage = new Map<Pattern, number>();
  const healthNotes: string[] = [];
  const cardiac = profile.conditions.includes('heart') || profile.conditions.includes('hypertension');
  const pregnant = profile.femaleStatus === 'pregnant';
  const minRir = pregnant ? 3 : cardiac ? 2 : 0;
  if (cardiac)
    healthNotes.push(
      'Cœur / tension : expire pendant l’effort (pas d’apnée bloquée), garde 2 reps en réserve sur les gros mouvements, et fais valider le fractionné intense par ton médecin (idéalement après un test d’effort).',
    );
  if (pregnant)
    healthNotes.push('Grossesse : entraînement avec l’accord de ton suivi, 3 reps en réserve, pas d’exercice allongé sur le dos après 20 semaines, rien avec risque de chute ou de choc au ventre.');
  if (profile.conditions.includes('osteoporosis'))
    healthNotes.push('Os fragiles : la musculation lourde est bénéfique, mais évite les flexions du dos chargées (crunchs lestés) et privilégie la technique.');
  const priorityMuscles = new Set(profile.priorities.flatMap((p) => PRIORITY_INFO[p].muscles));

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
        rir: capRir(RIR_BY_WEEK[profile.experience][week - 1], minRir),
        rest: ex.rest,
        cue: ex.cue,
        alternatives: options.filter((o) => o.id !== ex.id).map((o) => o.id),
      });
    }
    // Spécialisation : volume supplémentaire pour les muscles prioritaires
    for (const pr of profile.priorities) {
      const info = PRIORITY_INFO[pr];
      const trainsIt = exercises.some((e) => EXERCISE_BY_ID[e.exerciseId].primary.some((m) => info.muscles.includes(m)));
      if (!trainsIt) continue;
      for (const pattern of info.patterns) {
        const existing = exercises.find((e) => EXERCISE_BY_ID[e.exerciseId].pattern === pattern);
        if (existing) {
          if (!existing.priority) {
            existing.priority = true;
            if (!deload) existing.sets = Math.min(5, existing.sets + 1);
          }
          continue;
        }
        const options = availableExercises(profile, pattern).filter((e) => !used.has(e.id));
        if (!options.length) continue;
        const ex = options[(variant + cycle - 1) % Math.min(options.length, 2)];
        used.add(ex.id);
        exercises.push({
          exerciseId: ex.id,
          name: ex.name,
          sets: deload ? 1 : profile.experience === 'beginner' ? 2 : 3,
          reps: ex.reps,
          rir: capRir(RIR_BY_WEEK[profile.experience][week - 1], minRir),
          rest: ex.rest,
          cue: ex.cue,
          priority: true,
          alternatives: options.filter((o) => o.id !== ex.id).map((o) => o.id),
        });
      }
    }
    for (const e of exercises) if (EXERCISE_BY_ID[e.exerciseId].primary.some((m) => priorityMuscles.has(m))) e.priority = true;
    // Auto-régulation : +1 série sur le 1er exercice de chaque muscle qui stagne
    if (opts.volumeAdjust && !deload) {
      const done = new Set<Muscle>();
      for (const e of exercises) {
        const m = EXERCISE_BY_ID[e.exerciseId].primary.find((x) => opts.volumeAdjust![x] && !done.has(x));
        if (!m) continue;
        done.add(m);
        e.sets = Math.max(2, Math.min(5, e.sets + opts.volumeAdjust[m]!));
      }
    }
    fitToDuration(exercises, profile.sessionMinutes);
    return { id: `${key}-${sIdx}`, name: tpl.name, focus: tpl.focus, exercises, estMinutes: estimateMinutes(exercises) };
  });

  // Fréquence des muscles prioritaires : on les ajoute aussi aux séances qui ont du temps libre
  // (ex. élévations latérales le jour des jambes), jusqu'à 3 séances par semaine.
  for (const pr of profile.priorities) {
    const info = PRIORITY_INFO[pr];
    const hasIt = (sess: ProgramSession) => sess.exercises.some((e) => info.patterns.includes(EXERCISE_BY_ID[e.exerciseId].pattern));
    const wanted = Math.min(3, sessions.length);
    const candidates = sessions.filter((x) => !hasIt(x)).sort((a, b) => a.estMinutes - b.estMinutes);
    for (const sess of candidates) {
      if (sessions.filter(hasIt).length >= wanted) break;
      const pattern = info.patterns[0];
      const ex = availableExercises(profile, pattern).find((e) => !sess.exercises.some((x) => x.exerciseId === e.id));
      if (!ex) continue;
      const add: ProgramExercise = {
        exerciseId: ex.id,
        name: ex.name,
        sets: deload ? 1 : 3,
        reps: ex.reps,
        rir: capRir(RIR_BY_WEEK[profile.experience][week - 1], minRir),
        rest: ex.rest,
        cue: ex.cue,
        priority: true,
        alternatives: availableExercises(profile, pattern).filter((o) => o.id !== ex.id).map((o) => o.id),
      };
      if (estimateMinutes([...sess.exercises, add]) > profile.sessionMinutes) continue;
      sess.exercises.push(add);
      sess.estMinutes = estimateMinutes(sess.exercises);
    }
  }

  const cardio = cardioPlan(profile, restingHr);
  if (cardiac && cardio.vo2) {
    cardio.vo2 = null;
    cardio.notes.push('Fractionné VO2max mis en pause : à réintroduire après feu vert médical.');
  }
  if (pregnant) cardio.vo2 = null;
  const schedule: DayPlan[] = [];
  const restDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !liftDays.includes(d));
  let z2Left = cardio.zone2.sessions;
  let vo2Left = cardio.vo2 ? 1 : 0;
  for (let wd = 0; wd < 7; wd++) {
    const sIdx = liftDays.indexOf(wd);
    if (sIdx >= 0) {
      const s = sessions[sIdx];
      schedule.push({ weekday: wd, sessionId: s.id, label: s.name });
    } else if (wd === restDays[restDays.length - 1]) {
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
    healthNotes,
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
  const isCompound = (e: ProgramExercise) => EXERCISE_BY_ID[e.exerciseId].compound;
  // 1. Biceps/triceps en superset
  const bi = exs.find((e) => EXERCISE_BY_ID[e.exerciseId].pattern === 'biceps');
  const tri = exs.find((e) => EXERCISE_BY_ID[e.exerciseId].pattern === 'triceps');
  if (bi && tri) bi.superset = tri.superset = true;
  // 1 bis. Autres isolations en superset deux à deux (muscles différents = pas de perte de performance)
  const iso = exs.filter((e) => !isCompound(e) && !e.superset);
  for (let i = 0; i + 1 < iso.length && estimateMinutes(exs) > minutes; i += 2) {
    const a = EXERCISE_BY_ID[iso[i].exerciseId].primary;
    const b = EXERCISE_BY_ID[iso[i + 1].exerciseId].primary;
    if (a.some((m) => b.includes(m))) continue;
    iso[i].superset = iso[i + 1].superset = true;
  }
  // 2. Retirer les derniers exercices d'isolation non prioritaires
  while (estimateMinutes(exs) > minutes && exs.length > 5) {
    const idx = [...exs].reverse().findIndex((e) => !isCompound(e) && !e.priority);
    if (idx < 0) break;
    exs.splice(exs.length - 1 - idx, 1);
  }
  // 3. Réduire les séries : isolation d'abord, les gros mouvements gardent au moins 3 séries
  const passes: [(e: ProgramExercise) => boolean, number][] = [
    [(e) => !isCompound(e) && !e.priority, 2],
    [(e) => !isCompound(e) && !!e.priority, 2],
    [(e) => isCompound(e), 3],
  ];
  for (const [match, floor] of passes) {
    let changed = true;
    while (changed && estimateMinutes(exs) > minutes) {
      changed = false;
      for (const e of [...exs].reverse()) {
        if (estimateMinutes(exs) <= minutes) break;
        if (match(e) && e.sets > floor) {
          e.sets--;
          changed = true;
        }
      }
    }
  }
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
  const modes = (profile.cardioModes?.length ? profile.cardioModes : (['bike', 'walk'] as CardioMode[])).map((m) => MODE_LABEL[m]).join(', ');
  return {
    modes,
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

/** Premier nombre d'un RIR cible (« 1-2 » → 1) */
export function targetRir(rir: string): number {
  const n = parseInt(rir, 10);
  return Number.isNaN(n) ? 2 : n;
}

/**
 * Double progression, affinée par l'effort ressenti (RIR) quand il est noté :
 * trop facile → on monte la charge même sans être en haut de la fourchette ;
 * échec sous la fourchette → on baisse la charge.
 */
export function suggestNext(pe: ProgramExercise, last: ExerciseLog | undefined, deload: boolean): Suggestion {
  const ex = EXERCISE_BY_ID[pe.exerciseId];
  const [lo, hi] = pe.reps;
  if (!last || !last.sets.length)
    return { reps: lo, text: `Trouve une charge qui te permet ${lo}-${hi} reps en gardant ${pe.rir.split(' ')[0]} rep(s) en réserve.` };
  const top = Math.max(...last.sets.map((s) => s.weight));
  const topSets = last.sets.filter((s) => s.weight === top);
  const roundW = (w: number) => (ex.step ? Math.round(w / ex.step) * ex.step : w);
  if (deload) {
    const w = roundW(top * 0.9);
    return { weight: w, reps: lo, text: `Décharge : ${w || 'poids du corps'}${w ? ' kg' : ''} × ${lo} reps, sans forcer.` };
  }
  const goal = targetRir(pe.rir);
  const rirs = topSets.map((s) => s.rir).filter((r): r is number => r !== undefined);
  const minReps = Math.min(...topSets.map((s) => s.reps));
  if (ex.step && rirs.length === topSets.length) {
    const minRir = Math.min(...rirs);
    if (minRir >= goal + 2 && minReps >= lo) {
      const w = top + ex.step;
      return { weight: w, reps: lo, text: `C’était trop facile (encore ${minRir} reps en réserve) → passe à ${w} kg.` };
    }
    if (minReps < lo && Math.max(...rirs) === 0) {
      const w = Math.max(ex.step, roundW(top * 0.93));
      return { weight: w, reps: lo, text: `Échec sous ${lo} reps la dernière fois → redescends à ${w} kg et reconstruis.` };
    }
  }
  if (topSets.every((s) => s.reps >= hi)) {
    if (ex.step) {
      const w = top + ex.step;
      return { weight: w, reps: lo, text: `Bravo : toutes les séries au max → monte à ${w} kg et vise ${lo}+ reps.` };
    }
    return { weight: top, reps: hi, text: 'Toutes les séries au max : ajoute du lest (sac à dos), ralentis la descente ou passe à une variante plus dure.' };
  }
  return { weight: top, reps: Math.min(hi, minReps + 1), text: `Garde ${top || 'le poids du corps'}${top ? ' kg' : ''} et vise ${Math.min(hi, minReps + 1)}+ reps sur chaque série.` };
}

/** Stagnation : aucune amélioration du 1RM estimé sur les 3 dernières séances. */
export function isStalled(workouts: WorkoutLog[], exerciseId: string): boolean {
  const h = exerciseHistory(workouts, exerciseId);
  if (h.length < 4) return false;
  const before = Math.max(...h.slice(0, -3).map((x) => x.e1rm));
  const recent = Math.max(...h.slice(-3).map((x) => x.e1rm));
  return recent <= before * 1.005;
}

// ——— Forme du jour (auto-régulation) ———

export function readinessScore(r: Readiness): number {
  const avg = (r.sleep + r.energy + r.soreness + r.motivation) / 4; // 1-5
  let score = ((avg - 1) / 4) * 100;
  if (r.sleepHours !== undefined && r.sleepHours < 6) score -= 10;
  // FC nocturne au-dessus de ta moyenne : récupération incomplète
  if (r.hrDelta !== undefined && r.hrDelta >= 8) score -= 15;
  else if (r.hrDelta !== undefined && r.hrDelta >= 5) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export type ReadinessLevel = 'go' | 'easy' | 'rest';

export function readinessAdvice(score: number): { level: ReadinessLevel; title: string; text: string } {
  if (score >= 65) return { level: 'go', title: 'Feu vert', text: 'Séance normale : va chercher ta progression.' };
  if (score >= 40)
    return { level: 'easy', title: 'Séance allégée', text: '1 série de moins par exercice et 1 rep de plus en réserve. Tu gardes le stimulus sans creuser la fatigue.' };
  return { level: 'rest', title: 'Récupération', text: 'Remplace la musculation par 30-40 min de zone 2 très facile + 10 min de mobilité. Décale la séance à demain.' };
}

/** Applique la forme du jour à une séance */
export function adjustForReadiness(session: ProgramSession, level: ReadinessLevel): ProgramSession {
  if (level !== 'easy') return session;
  const exercises = session.exercises.map((e) => ({ ...e, sets: Math.max(1, e.sets - 1), rir: `${targetRir(e.rir) + 1}` }));
  return { ...session, exercises, estMinutes: estimateMinutes(exercises) };
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

export interface AutoVolume {
  adjust: Partial<Record<Muscle, number>>;
  notes: string[];
}

/**
 * Programme qui apprend : sur les 5 dernières semaines, un muscle dont les exercices
 * ne progressent plus (malgré une bonne récupération) reçoit une série de plus par
 * séance. Si la forme moyenne est basse, on n'ajoute rien (la fatigue est le frein).
 */
export function autoVolume(workouts: WorkoutLog[], today: string, readinessAvg?: number): AutoVolume {
  const recent = workouts.filter((w) => daysBetween(w.date, today) <= 35);
  const ids = [...new Set(recent.flatMap((w) => w.entries.map((e) => e.exerciseId)))];
  const byMuscle = new Map<Muscle, number[]>();
  for (const id of ids) {
    const h = exerciseHistory(recent, id);
    if (h.length < 3) continue;
    const change = (h[h.length - 1].e1rm - h[0].e1rm) / Math.max(h[0].e1rm, 1);
    for (const m of EXERCISE_BY_ID[id]?.primary ?? []) byMuscle.set(m, [...(byMuscle.get(m) ?? []), change]);
  }
  const adjust: Partial<Record<Muscle, number>> = {};
  const notes: string[] = [];
  if (readinessAvg !== undefined && readinessAvg < 45) {
    if (byMuscle.size) notes.push('Ta forme moyenne est basse : pas de volume en plus tant que la récupération ne remonte pas (sommeil, stress, calories).');
    return { adjust, notes };
  }
  for (const [m, changes] of byMuscle) {
    const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
    if (mean < 0.005) {
      adjust[m] = 1;
      notes.push(`${MUSCLE_LABEL[m]} : stagnation sur 5 semaines → +1 série par séance.`);
    }
  }
  return { adjust, notes };
}
