// Formulaires du profil, partagés entre l'accueil (onboarding) et les réglages.
import { FOODS } from '../data/foods';
import { Chips, Field, NumberInput, Segmented, Toggle } from '../components/ui';
import type { ActivityLevel, Allergen, Diet, Equipment, Experience, Goal, Injury, Profile } from '../lib/types';

type Props = { p: Profile; set: (patch: Partial<Profile>) => void };

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function IdentityStep({ p, set }: Props) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Field label="Prénom">
        <input className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ton prénom" autoComplete="given-name" />
      </Field>
      <Field label="Sexe (pour les calculs physiologiques)">
        <Segmented
          value={p.sex}
          onChange={(sex) => set({ sex })}
          options={[
            { value: 'male', label: 'Homme' },
            { value: 'female', label: 'Femme' },
          ]}
        />
      </Field>
      <div className="grid2">
        <Field label="Année de naissance">
          <NumberInput value={p.birthYear} onChange={(v) => set({ birthYear: v ?? p.birthYear })} step={1} />
        </Field>
        <Field label="Taille">
          <NumberInput value={p.heightCm} onChange={(v) => set({ heightCm: v ?? p.heightCm })} unit="cm" step={1} />
        </Field>
      </div>
      <div className="grid2">
        <Field label="Poids actuel">
          <NumberInput value={p.weightKg} onChange={(v) => set({ weightKg: v ?? p.weightKg })} unit="kg" />
        </Field>
        <Field label="% de masse grasse" hint="Ta balance Withings l’indique (optionnel)">
          <NumberInput value={p.bodyFatPct} onChange={(v) => set({ bodyFatPct: v })} unit="%" />
        </Field>
      </div>
      <Field label="Tour de taille (au nombril)" hint="Optionnel, excellent indicateur de graisse viscérale">
        <NumberInput value={p.waistCm} onChange={(v) => set({ waistCm: v })} unit="cm" />
      </Field>
    </div>
  );
}

const GOALS: { value: Goal; title: string; text: string }[] = [
  { value: 'auto', title: 'Laisse l’app décider (recommandé)', text: 'Sèche, recomposition ou prise de muscle selon ton taux de gras actuel, réévalué en continu.' },
  { value: 'fat_loss', title: 'Perdre du gras', text: 'Déficit modéré, protéines élevées pour garder tout le muscle.' },
  { value: 'recomp', title: 'Recomposition', text: 'Perdre du gras et gagner du muscle en même temps, lentement.' },
  { value: 'muscle_gain', title: 'Prendre du muscle', text: 'Léger surplus pour construire sans prendre de gras inutile.' },
];

export function GoalStep({ p, set }: Props) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="stack" style={{ gap: 8 }}>
        {GOALS.map((g) => (
          <button type="button" key={g.value} className={`option-card ${p.goal === g.value ? 'on' : ''}`} onClick={() => set({ goal: g.value })}>
            <div>
              <strong>{g.title}</strong>
              <span>{g.text}</span>
            </div>
          </button>
        ))}
      </div>
      <Field label="Ton niveau en musculation">
        <Segmented<Experience>
          value={p.experience}
          onChange={(experience) => set({ experience })}
          options={[
            { value: 'beginner', label: '< 1 an' },
            { value: 'intermediate', label: '1-3 ans' },
            { value: 'advanced', label: '3 ans +' },
          ]}
        />
      </Field>
      <Field label="Activité hors sport (travail, déplacements)">
        <select className="input" value={p.activityLevel} onChange={(e) => set({ activityLevel: e.target.value as ActivityLevel })}>
          <option value="sedentary">Sédentaire (bureau, voiture)</option>
          <option value="light">Légère (bureau + un peu de marche)</option>
          <option value="moderate">Modérée (debout souvent, 7-10 000 pas)</option>
          <option value="active">Active (métier physique)</option>
          <option value="very_active">Très active (métier très physique)</option>
        </select>
      </Field>
    </div>
  );
}

const EQUIP: { value: Equipment; label: string }[] = [
  { value: 'machines', label: 'Machines & poulies' },
  { value: 'barbell', label: 'Barre olympique' },
  { value: 'dumbbells', label: 'Haltères' },
  { value: 'bench', label: 'Banc' },
  { value: 'pullup_bar', label: 'Barre de traction' },
  { value: 'bands', label: 'Élastiques' },
];

const INJ: { value: Injury; label: string }[] = [
  { value: 'shoulder', label: 'Épaule' },
  { value: 'lower_back', label: 'Bas du dos' },
  { value: 'knee', label: 'Genou' },
  { value: 'elbow', label: 'Coude' },
  { value: 'wrist', label: 'Poignet' },
];

export function TrainingStep({ p, set }: Props) {
  const presets: { label: string; eq: Equipment[] }[] = [
    { label: 'Salle de sport', eq: ['machines', 'barbell', 'dumbbells', 'bench', 'pullup_bar', 'bands'] },
    { label: 'Maison équipée', eq: ['dumbbells', 'bench', 'pullup_bar', 'bands'] },
    { label: 'Poids du corps', eq: [] },
  ];
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Field label={`Séances de musculation par semaine : ${p.trainingDays}`}>
        <Segmented value={p.trainingDays} onChange={(trainingDays) => set({ trainingDays })} options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} />
      </Field>
      <Field label="Durée d’une séance">
        <Segmented value={p.sessionMinutes} onChange={(sessionMinutes) => set({ sessionMinutes })} options={[45, 60, 75, 90].map((n) => ({ value: n, label: `${n} min` }))} />
      </Field>
      <Field label="Où t’entraînes-tu ?">
        <div className="chips">
          {presets.map((pr) => (
            <button type="button" key={pr.label} className={`chip ${JSON.stringify([...p.equipment].sort()) === JSON.stringify([...pr.eq].sort()) ? 'on' : ''}`} onClick={() => set({ equipment: pr.eq })}>
              {pr.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Matériel disponible">
        <Chips options={EQUIP} selected={p.equipment} onToggle={(v) => set({ equipment: toggle(p.equipment, v) })} />
      </Field>
      <Field label="Zones fragiles / blessures" hint="Les exercices à risque seront évités">
        <Chips options={INJ} selected={p.injuries} onToggle={(v) => set({ injuries: toggle(p.injuries, v) })} />
      </Field>
    </div>
  );
}

const ALLERGENS: { value: Allergen; label: string }[] = [
  { value: 'lactose', label: 'Lactose' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'nuts', label: 'Fruits à coque' },
  { value: 'peanut', label: 'Arachide' },
  { value: 'egg', label: 'Œufs' },
  { value: 'fish', label: 'Poisson' },
  { value: 'shellfish', label: 'Crustacés' },
  { value: 'soy', label: 'Soja' },
  { value: 'sesame', label: 'Sésame' },
];

const DISLIKE_CANDIDATES = [
  'salmon', 'mackerel', 'sardines', 'tuna', 'cod', 'shrimp', 'beef5', 'turkey', 'chicken', 'tofu', 'tempeh', 'lentils', 'chickpeas', 'red_beans',
  'broccoli', 'brussels', 'kale', 'cauliflower', 'mushrooms', 'beetroot', 'avocado', 'kimchi', 'sauerkraut', 'kefir', 'cottage', 'feta', 'buckwheat', 'quinoa', 'sweet_potato',
];

export function FoodStep({ p, set }: Props) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Field label="Régime">
        <Segmented<Diet>
          value={p.diet}
          onChange={(diet) => set({ diet })}
          options={[
            { value: 'omnivore', label: 'Omnivore' },
            { value: 'pescatarian', label: 'Pesco' },
            { value: 'vegetarian', label: 'Végé' },
            { value: 'vegan', label: 'Vegan' },
          ]}
        />
      </Field>
      <Field label="Allergies / intolérances">
        <Chips options={ALLERGENS} selected={p.allergens} onToggle={(v) => set({ allergens: toggle(p.allergens, v) })} />
      </Field>
      <Field label="Aliments que tu n’aimes pas" hint="Ils seront remplacés automatiquement">
        <Chips
          options={DISLIKE_CANDIDATES.map((id) => ({ value: id, label: FOODS.find((f) => f.id === id)!.name.replace(/\s*\(.*\)/, '') }))}
          selected={p.dislikedFoods}
          onToggle={(v) => set({ dislikedFoods: toggle(p.dislikedFoods, v) })}
        />
      </Field>
      <Field label="Repas par jour">
        <Segmented value={p.mealsPerDay} onChange={(mealsPerDay) => set({ mealsPerDay })} options={[3, 4, 5].map((n) => ({ value: n as 3 | 4 | 5, label: n === 3 ? '3 repas' : n === 4 ? '3 + collation' : '3 + 2 collations' }))} />
      </Field>
      <Toggle label="Cuisiner en double le soir" sub="Le dîner sert aussi de déjeuner le lendemain : moins de cuisine, liste de courses plus simple." checked={p.batchCooking} onChange={(batchCooking) => set({ batchCooking })} />
      <div className="grid2">
        <Field label="Poissons gras / semaine">
          <NumberInput value={p.fattyFishPerWeek} onChange={(v) => set({ fattyFishPerWeek: v ?? 0 })} step={1} min={0} />
        </Field>
        <Field label="Verres d’alcool / semaine">
          <NumberInput value={p.alcoholPerWeek} onChange={(v) => set({ alcoholPerWeek: v ?? 0 })} step={1} min={0} />
        </Field>
      </div>
    </div>
  );
}

export function RecoveryStep({ p, set }: Props) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Field label="Qualité de ton sommeil">
        <Segmented
          value={p.sleepQuality}
          onChange={(sleepQuality) => set({ sleepQuality })}
          options={[
            { value: 1, label: 'Top' },
            { value: 2, label: 'Bien' },
            { value: 3, label: 'Moyen' },
            { value: 4, label: 'Mauvais' },
            { value: 5, label: 'Très mauvais' },
          ]}
        />
      </Field>
      <Field label="Niveau de stress">
        <Segmented
          value={p.stressLevel}
          onChange={(stressLevel) => set({ stressLevel })}
          options={[
            { value: 1, label: 'Zen' },
            { value: 2, label: 'Faible' },
            { value: 3, label: 'Moyen' },
            { value: 4, label: 'Élevé' },
            { value: 5, label: 'Très élevé' },
          ]}
        />
      </Field>
      <Field label="Exposition au soleil (bras/jambes découverts)">
        <Segmented
          value={p.sunExposure}
          onChange={(sunExposure) => set({ sunExposure })}
          options={[
            { value: 'low', label: 'Rare' },
            { value: 'medium', label: 'Parfois' },
            { value: 'high', label: 'Souvent' },
          ]}
        />
      </Field>
    </div>
  );
}

export function newProfile(): Profile {
  return {
    name: '',
    sex: 'male',
    birthYear: new Date().getFullYear() - 35,
    heightCm: 178,
    weightKg: 80,
    goal: 'auto',
    experience: 'intermediate',
    activityLevel: 'light',
    trainingDays: 4,
    sessionMinutes: 60,
    equipment: ['machines', 'barbell', 'dumbbells', 'bench', 'pullup_bar', 'bands'],
    injuries: [],
    diet: 'omnivore',
    allergens: [],
    dislikedFoods: [],
    mealsPerDay: 4,
    batchCooking: true,
    sleepQuality: 2,
    stressLevel: 3,
    fattyFishPerWeek: 1,
    alcoholPerWeek: 0,
    sunExposure: 'low',
    createdAt: new Date().toISOString(),
  };
}
