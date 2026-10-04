// Formulaires du profil, partagés entre l'accueil (onboarding) et les réglages.
import { FOODS } from '../data/foods';
import { Chips, Field, NumberInput, Segmented, Toggle } from '../components/ui';
import { plannedSleepHours } from '../lib/profile';
import type { ActivityLevel, Allergen, Budget, CardioMode, Condition, Diet, Equipment, Experience, FamilyHistory, Goal, Injury, Medication, MusclePriority, Profile, TrainingTime } from '../lib/types';
import { WEEKDAYS_SHORT } from '../lib/util';

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
      <Field label="Temps de cuisine max par repas">
        <Segmented value={p.maxCookMinutes} onChange={(maxCookMinutes) => set({ maxCookMinutes })} options={[15, 20, 30, 45].map((n) => ({ value: n, label: `${n} min` }))} />
      </Field>
      <Field label="Budget courses & compléments">
        <Segmented<Budget>
          value={p.budget}
          onChange={(budget) => set({ budget })}
          options={[
            { value: 'eco', label: 'Serré' },
            { value: 'standard', label: 'Normal' },
            { value: 'premium', label: 'Sans limite' },
          ]}
        />
      </Field>
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

export { newProfile } from '../lib/profile';

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'hypertension', label: 'Tension élevée' },
  { value: 'prediabetes', label: 'Prédiabète' },
  { value: 'diabetes', label: 'Diabète' },
  { value: 'high_cholesterol', label: 'Cholestérol élevé' },
  { value: 'heart', label: 'Maladie cardiaque' },
  { value: 'thyroid', label: 'Thyroïde' },
  { value: 'kidney', label: 'Reins' },
  { value: 'liver', label: 'Foie' },
  { value: 'digestive', label: 'Troubles digestifs' },
  { value: 'osteoporosis', label: 'Os fragiles' },
];

const MEDICATIONS: { value: Medication; label: string }[] = [
  { value: 'anticoagulant', label: 'Anticoagulant / antiagrégant' },
  { value: 'statin', label: 'Statine (cholestérol)' },
  { value: 'metformin', label: 'Metformine / antidiabétique' },
  { value: 'thyroid_med', label: 'Lévothyroxine' },
  { value: 'antidepressant', label: 'Antidépresseur' },
  { value: 'antihypertensive', label: 'Traitement de la tension' },
  { value: 'ppi', label: 'Anti-acide (IPP)' },
  { value: 'hormonal_contraception', label: 'Contraception hormonale' },
];

const FAMILY: { value: FamilyHistory; label: string }[] = [
  { value: 'heart', label: 'Infarctus / AVC avant 60 ans' },
  { value: 'diabetes', label: 'Diabète' },
  { value: 'cancer', label: 'Cancer' },
  { value: 'dementia', label: 'Alzheimer / démence' },
];

export function HealthStep({ p, set }: Props) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Field label="Problèmes de santé connus" hint="Ils adaptent les calories, l’entraînement et surtout les compléments (sécurité).">
        <Chips options={CONDITIONS} selected={p.conditions} onToggle={(v) => set({ conditions: toggle(p.conditions, v) })} />
      </Field>
      <Field label="Traitements en cours" hint="Pour éviter les interactions avec les compléments.">
        <Chips options={MEDICATIONS} selected={p.medications} onToggle={(v) => set({ medications: toggle(p.medications, v) })} />
      </Field>
      <Field label="Tabac">
        <Segmented
          value={p.smoking}
          onChange={(smoking) => set({ smoking })}
          options={[
            { value: 'never', label: 'Jamais' },
            { value: 'former', label: 'Ancien fumeur' },
            { value: 'current', label: 'Fumeur' },
          ]}
        />
      </Field>
      <Field label="Antécédents dans la famille proche" hint="Parents, frères et sœurs : adapte tes dépistages et tes cibles.">
        <Chips options={FAMILY} selected={p.familyHistory} onToggle={(v) => set({ familyHistory: toggle(p.familyHistory, v) })} />
      </Field>
      {p.sex === 'female' && (
        <Field label="Situation">
          <Segmented
            value={p.femaleStatus ?? 'cycle'}
            onChange={(femaleStatus) => set({ femaleStatus })}
            options={[
              { value: 'cycle', label: 'Cycles' },
              { value: 'pregnant', label: 'Enceinte' },
              { value: 'breastfeeding', label: 'Allaitement' },
              { value: 'menopause', label: 'Ménopause' },
            ]}
          />
        </Field>
      )}
    </div>
  );
}

const PRIORITIES: { value: MusclePriority; label: string }[] = [
  { value: 'shoulders', label: 'Épaules' },
  { value: 'back', label: 'Dos' },
  { value: 'chest', label: 'Pectoraux' },
  { value: 'arms', label: 'Bras' },
  { value: 'abs', label: 'Abdos / taille' },
  { value: 'glutes', label: 'Fessiers' },
  { value: 'legs', label: 'Cuisses' },
  { value: 'calves', label: 'Mollets' },
];

const CARDIO: { value: CardioMode; label: string }[] = [
  { value: 'bike', label: 'Vélo' },
  { value: 'walk', label: 'Marche rapide' },
  { value: 'run', label: 'Course' },
  { value: 'row', label: 'Rameur' },
  { value: 'swim', label: 'Natation' },
  { value: 'elliptical', label: 'Elliptique' },
];

export function RhythmStep({ p, set }: Props) {
  const sleep = plannedSleepHours(p);
  const dayOptions = WEEKDAYS_SHORT.map((label, i) => ({ value: String(i), label }));
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="grid2">
        <Field label="Heure de lever">
          <input className="input" type="time" value={p.wakeTime} onChange={(e) => e.target.value && set({ wakeTime: e.target.value })} />
        </Field>
        <Field label="Heure de coucher">
          <input className="input" type="time" value={p.bedTime} onChange={(e) => e.target.value && set({ bedTime: e.target.value })} />
        </Field>
      </div>
      <div className={`small ${sleep < 7 ? 'down-bad' : 'text-2'}`} style={{ marginTop: -6 }}>
        {sleep.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h au lit{sleep < 7 ? ' : vise au moins 7 h 30 pour récupérer et garder ton muscle.' : '.'}
      </div>
      <Field label="Quand t’entraînes-tu ?">
        <Segmented<TrainingTime>
          value={p.trainingTime}
          onChange={(trainingTime) => set({ trainingTime })}
          options={[
            { value: 'morning', label: 'Matin' },
            { value: 'noon', label: 'Midi' },
            { value: 'evening', label: 'Soir' },
          ]}
        />
      </Field>
      <Field label={`Tes jours de musculation (${p.trainingWeekdays.length}/${p.trainingDays})`} hint="Choisis exactement autant de jours que de séances, sinon l’app les place pour toi.">
        <Chips options={dayOptions} selected={p.trainingWeekdays.map(String)} onToggle={(v) => set({ trainingWeekdays: toggle(p.trainingWeekdays, Number(v)).sort((a, b) => a - b) })} />
      </Field>
      <Field label="Muscles prioritaires (3 max)" hint="Ils reçoivent plus de volume pour corriger tes points faibles.">
        <Chips
          options={PRIORITIES}
          selected={p.priorities}
          onToggle={(v) => {
            const next = toggle(p.priorities, v);
            if (next.length <= 3) set({ priorities: next });
          }}
        />
      </Field>
      <Field label="Cardio que tu aimes">
        <Chips options={CARDIO} selected={p.cardioModes} onToggle={(v) => set({ cardioModes: toggle(p.cardioModes, v) })} />
      </Field>
    </div>
  );
}
