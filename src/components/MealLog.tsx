import { useRef, useState } from 'react';
import { IS_ARTIFACT } from '../env';
import { analyzeMeal, CoachError, type MealEstimate } from '../lib/coach';
import { dayBalance } from '../lib/dayBalance';
import { SLOT_LABEL, type PlannedMeal } from '../lib/mealPlanner';
import { compressImage } from '../lib/photos';
import type { DailyLog, LoggedMeal } from '../lib/types';
import { todayISO, uid } from '../lib/util';
import { setDaily } from '../pages/Today';
import { useApp } from '../store';
import { Icon } from './icons';
import { Badge, Callout, Chips, Field, NumberInput, Sheet } from './ui';

/** Repas hors menu du jour + conseil pour rééquilibrer le reste de la journée. */
export function MealLog({ meals, log }: { meals: PlannedMeal[]; log: DailyLog }) {
  const { update, derived } = useApp();
  const [open, setOpen] = useState(false);
  const extras = log.extraMeals ?? [];
  const balance = dayBalance(meals, log.meals, extras, { kcal: derived.mealTargets.kcal, protein: derived.mealTargets.protein }, derived.profile.diet);
  const remove = (id: string) => setDaily(update, todayISO(), (d) => ({ ...d, extraMeals: (d.extraMeals ?? []).filter((x) => x.id !== id) }));

  return (
    <>
      {extras.map((e) => (
        <div key={e.id} className="list-item">
          <div className="main">
            <div className="title">{e.name}</div>
            <div className="sub">
              {e.replaces ? `Remplace : ${SLOT_LABEL[e.replaces as keyof typeof SLOT_LABEL] ?? e.replaces}` : 'En plus du menu'} · {e.kcal} kcal · {e.protein} g P{e.source === 'photo' ? ' · estimé par IA' : ''}
            </div>
          </div>
          <button className="btn ghost sm" aria-label="Supprimer ce repas" onClick={() => remove(e.id)}>
            <Icon.trash />
          </button>
        </div>
      ))}
      {balance.advice.length > 0 && (
        <div className={`tip ${balance.tone === 'warning' ? 'warn' : ''}`}>
          {balance.advice.map((a) => (
            <div key={a}>{a}</div>
          ))}
        </div>
      )}
      <button className="btn block" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>
        <Icon.camera /> Repas hors menu
      </button>
      {open && <MealSheet meals={meals} log={log} onClose={() => setOpen(false)} />}
    </>
  );
}

function defaultSlot(meals: PlannedMeal[], log: DailyLog): string {
  const free = meals.filter((m) => !log.meals[m.slot] && !(log.extraMeals ?? []).some((e) => e.replaces === m.slot));
  const h = new Date().getHours();
  const wanted = h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner';
  return free.find((m) => m.slot === wanted)?.slot ?? 'extra';
}

function MealSheet({ meals, log, onClose }: { meals: PlannedMeal[]; log: DailyLog; onClose: () => void }) {
  const { state, update, toast } = useApp();
  const apiKey = !IS_ARTIFACT ? state.settings.anthropicKey : undefined;
  const fileRef = useRef<HTMLInputElement>(null);
  const [slot, setSlot] = useState(() => defaultSlot(meals, log));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [est, setEst] = useState<MealEstimate | null>(null);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState<number | undefined>();
  const [protein, setProtein] = useState<number | undefined>();
  const [carbs, setCarbs] = useState<number | undefined>();
  const [fat, setFat] = useState<number | undefined>();

  const options = [
    ...meals.filter((m) => !log.meals[m.slot] && !(log.extraMeals ?? []).some((e) => e.replaces === m.slot)).map((m) => ({ value: m.slot as string, label: SLOT_LABEL[m.slot] })),
    { value: 'extra', label: 'En plus' },
  ];

  const onPhoto = async (file: File) => {
    if (!apiKey) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await compressImage(file, 1280);
      const r = await analyzeMeal({ apiKey, photo, note: note.trim() || undefined });
      setEst(r);
      setName(r.name);
      setKcal(r.kcal);
      setProtein(r.protein);
      setCarbs(r.carbs);
      setFat(r.fat);
    } catch (e) {
      setError(e instanceof CoachError ? e.message : 'Analyse impossible pour le moment.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!name.trim() || kcal === undefined || protein === undefined) {
      toast('Indique au moins le nom, les calories et les protéines');
      return;
    }
    const meal: LoggedMeal = {
      id: uid(),
      at: new Date().toISOString(),
      name: name.trim(),
      kcal: Math.round(kcal),
      protein: Math.round(protein),
      carbs: carbs !== undefined ? Math.round(carbs) : undefined,
      fat: fat !== undefined ? Math.round(fat) : undefined,
      fiber: est?.fiber,
      replaces: slot === 'extra' ? undefined : slot,
      source: est ? 'photo' : 'manual',
      comment: est?.comment,
    };
    setDaily(update, todayISO(), (d) => ({ ...d, extraMeals: [...(d.extraMeals ?? []), meal] }));
    toast('Repas enregistré : la suite de ta journée est recalculée');
    onClose();
  };

  return (
    <Sheet title="Repas hors menu" onClose={onClose}>
      <div className="stack" style={{ gap: 12 }}>
        <Field label="Ce repas remplace">
          <Chips options={options} selected={[slot]} onToggle={setSlot} />
        </Field>
        {apiKey ? (
          <>
            <Field label="Précision (optionnel)" hint="Ex. : « menu du midi au resto », « avec une bière », « moitié de l’assiette »">
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ce que la photo ne montre pas" />
            </Field>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void onPhoto(f);
              }}
            />
            <button className="btn primary block" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Icon.camera /> {busy ? 'Analyse en cours…' : est ? 'Reprendre une photo' : 'Prendre le repas en photo'}
            </button>
            <p className="small muted" style={{ margin: 0 }}>
              Photo du dessus, assiette entière visible. L’IA estime les portions, les calories et les macros : tu peux corriger avant d’enregistrer.
            </p>
          </>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            {IS_ARTIFACT ? 'L’analyse photo fonctionne dans l’app installée.' : 'Ajoute ta clé API dans Réglages → Coach IA pour estimer le repas à partir d’une photo.'} En attendant, saisis une estimation rapide.
          </p>
        )}
        {error && (
          <Callout tone="critical" title="Oups">
            {error}
          </Callout>
        )}
        {est && (
          <div className="ai-box">
            <div className="row between">
              <b>{est.name}</b>
              <Badge tone={est.confidence === 'bonne' ? 'good' : est.confidence === 'moyenne' ? 'neutral' : 'warning'}>{`Confiance ${est.confidence}`}</Badge>
            </div>
            <div className="small" style={{ marginTop: 6 }}>
              {est.items.map((i) => `${i.food} ~${Math.round(i.grams)} g`).join(' · ')}
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>
              {est.comment}
            </div>
          </div>
        )}
        <Field label="Nom du repas">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : pizza 4 fromages" />
        </Field>
        <div className="grid2">
          <Field label="Calories">
            <NumberInput value={kcal} onChange={setKcal} unit="kcal" />
          </Field>
          <Field label="Protéines">
            <NumberInput value={protein} onChange={setProtein} unit="g" />
          </Field>
          <Field label="Glucides">
            <NumberInput value={carbs} onChange={setCarbs} unit="g" />
          </Field>
          <Field label="Lipides">
            <NumberInput value={fat} onChange={setFat} unit="g" />
          </Field>
        </div>
        <button className="btn primary block" onClick={save}>
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}
