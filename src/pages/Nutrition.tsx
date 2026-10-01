import { useMemo, useState } from 'react';
import { navigate } from '../App';
import { Icon } from '../components/icons';
import { Badge, Callout, Card, Check, Meter, Segmented, Sheet, shareOrCopy, Stat, Toggle } from '../components/ui';
import { alternativesFor, generateWeekPlan, SLOT_LABEL, type PlannedMeal } from '../lib/mealPlanner';
import { buildShoppingList, groupByAisle, shoppingListText, type ShoppingItem } from '../lib/shopping';
import { activeStack } from '../lib/supplements';
import { addDays, fmt, formatDay, nextSeed, todayISO, uid, WEEKDAYS_SHORT, weekdayIndex } from '../lib/util';
import { useApp } from '../store';

export function Nutrition({ tab }: { tab?: string }) {
  const t = tab === 'courses' || tab === 'targets' ? tab : 'menu';
  return (
    <>
      <Segmented
        value={t}
        onChange={(v) => navigate('nutrition', v === 'menu' ? undefined : v)}
        options={[
          { value: 'menu', label: 'Menu' },
          { value: 'courses', label: 'Courses' },
          { value: 'targets', label: 'Objectifs' },
        ]}
      />
      {t === 'menu' && <Menu />}
      {t === 'courses' && <Shopping />}
      {t === 'targets' && <Targets />}
    </>
  );
}

function Menu() {
  const { state, update, derived, toast } = useApp();
  const { week, mealTargets, targets } = derived;
  const [day, setDay] = useState(weekdayIndex(todayISO()));
  const [swap, setSwap] = useState<PlannedMeal | null>(null);
  const d = week.days[day];
  const today = weekdayIndex(todayISO());
  const stale = Math.abs(mealTargets.kcal - targets.kcal) >= 60 || Math.abs(mealTargets.protein - targets.protein) >= 10;

  const regenerate = () => {
    update((s) => ({
      ...s,
      plan: {
        ...s.plan,
        mealSeed: Math.floor(Math.random() * 1e9),
        mealOverrides: {},
        shoppingChecked: Object.fromEntries(Object.entries(s.plan.shoppingChecked).filter(([k]) => !k.startsWith(`${s.plan.mealWeekStart}|`))),
        mealTargets: { kcal: targets.kcal, protein: targets.protein, carbs: targets.carbs, fat: targets.fat },
      },
    }));
    toast('Nouveau menu généré');
  };

  return (
    <>
      {stale && (
        <Callout
          title="Tes besoins ont changé"
          action={
            <button
              className="btn sm primary"
              onClick={() => {
                update((s) => ({ ...s, plan: { ...s.plan, mealTargets: { kcal: targets.kcal, protein: targets.protein, carbs: targets.carbs, fat: targets.fat } } }));
                toast('Portions recalculées');
              }}
            >
              Recalculer les portions
            </button>
          }
        >
          Menu calculé pour {mealTargets.kcal} kcal / {mealTargets.protein} g de protéines ; ta cible actuelle est {targets.kcal} kcal / {targets.protein} g.
        </Callout>
      )}
      <div className="days">
        {week.days.map((x, i) => (
          <button key={i} className={`${i === day ? 'on' : ''} ${i === today ? 'today' : ''}`} onClick={() => setDay(i)}>
            {WEEKDAYS_SHORT[i]}
            <b>{formatDay(x.date, { day: 'numeric' })}</b>
          </button>
        ))}
      </div>

      <Card title={`${Math.round(d.totals.kcal)} kcal`} sub={`Objectif ${mealTargets.kcal} kcal`}>
        <div className="stack" style={{ gap: 8 }}>
          <MacroRow label="Protéines" value={d.totals.p} target={mealTargets.protein} />
          <MacroRow label="Glucides" value={d.totals.c} target={mealTargets.carbs} />
          <MacroRow label="Lipides" value={d.totals.f} target={mealTargets.fat} />
          <MacroRow label="Fibres" value={d.totals.fib} target={targets.fiber} />
        </div>
      </Card>

      <Card>
        {d.meals.map((m) => (
          <MealBlock key={m.slot} meal={m} onSwap={() => setSwap(m)} />
        ))}
      </Card>

      <Card title="Qualité de la semaine" sub="Les marqueurs d’une alimentation « longévité »">
        <div className="grid2">
          <Stat label="Plantes différentes" value={week.plantCount} unit="/ 30" />
          <Stat label="Repas poisson gras" value={week.fattyFishMeals} unit="/ 2+" />
          <Stat label="Repas légumineuses" value={week.legumeMeals} unit="/ 3+" />
          <Stat label="Jours avec fermentés" value={week.fermentedDays} unit="/ 7" />
        </div>
        <p className="small text-2" style={{ marginBottom: 0 }}>
          Fibres en moyenne : {fmt(week.avgFiber, 0)} g/jour. Astuce diversité : ajoute herbes fraîches, épices, graines variées – chaque espèce compte.
        </p>
      </Card>

      <div className="row">
        <button className="btn block" onClick={() => regenerate()}>
          <Icon.refresh /> Nouveau menu
        </button>
        <button className="btn primary block" onClick={() => navigate('nutrition', 'courses')}>
          <Icon.cart /> Liste de courses
        </button>
      </div>

      {swap && (
        <Sheet title={`Remplacer : ${SLOT_LABEL[swap.slot]}`} onClose={() => setSwap(null)}>
          <div className="stack" style={{ gap: 8 }}>
            {alternativesFor(derived.profile, swap.slot).map((r) => (
              <button
                key={r.id}
                className={`option-card ${r.id === swap.recipeId ? 'on' : ''}`}
                onClick={() => {
                  update((s) => ({ ...s, plan: { ...s.plan, mealOverrides: { ...s.plan.mealOverrides, [`${day}-${swap.slot}`]: r.id } } }));
                  setSwap(null);
                }}
              >
                <div>
                  <strong>{r.name}</strong>
                </div>
              </button>
            ))}
            {state.plan.mealOverrides[`${day}-${swap.slot}`] && (
              <button
                className="btn ghost"
                onClick={() => {
                  update((s) => {
                    const o = { ...s.plan.mealOverrides };
                    delete o[`${day}-${swap.slot}`];
                    return { ...s, plan: { ...s.plan, mealOverrides: o } };
                  });
                  setSwap(null);
                }}
              >
                Revenir à la recette proposée
              </button>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}

function MacroRow({ label, value, target }: { label: string; value: number; target: number }) {
  return (
    <div className="macro-row">
      <span>{label}</span>
      <Meter value={value} max={target} />
      <span className="small" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {Math.round(value)} / {Math.round(target)} g
      </span>
    </div>
  );
}

function MealBlock({ meal, onSwap }: { meal: PlannedMeal; onSwap: () => void }) {
  return (
    <div className="meal">
      <div className="row between">
        <span className="meal-slot">{SLOT_LABEL[meal.slot]}</span>
        <button className="btn ghost sm" onClick={onSwap}>
          <Icon.swap /> Changer
        </button>
      </div>
      <div className="meal-name">{meal.name}</div>
      <div className="row wrap" style={{ gap: 6 }}>
        <Badge>{Math.round(meal.macros.kcal)} kcal</Badge>
        <Badge tone="accent">{Math.round(meal.macros.p)} g prot.</Badge>
        <Badge>{meal.minutes} min</Badge>
        {meal.cookDouble && <Badge tone="good">Cuisine double portion</Badge>}
        {meal.leftover && <Badge tone="good">Restes d’hier soir</Badge>}
      </div>
      <ul className="ing-list">
        {meal.ingredients.map((i) => (
          <li key={i.food}>
            <span>{i.label}</span>
            <b>{i.qty}</b>
          </li>
        ))}
      </ul>
      {meal.substitutions.length > 0 && <div className="small muted" style={{ marginTop: 6 }}>↺ {meal.substitutions.join(' · ')}</div>}
      <details style={{ marginTop: 8 }}>
        <summary className="disclosure small" style={{ fontWeight: 600, color: 'var(--accent)' }}>
          Préparation
        </summary>
        <ol className="steps">
          {meal.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {meal.cookDouble && <div className="small text-2">Prépare le double et garde la moitié au frigo pour le déjeuner de demain.</div>}
      </details>
      {meal.tip && <div className="tip">💡 {meal.tip}</div>}
    </div>
  );
}

type Scope = 'week' | 'rest' | 'next';

function Shopping() {
  const { state, update, derived, toast } = useApp();
  const [newItem, setNewItem] = useState('');
  const todayIdx = weekdayIndex(todayISO());
  const [scope, setScope] = useState<Scope>(todayIdx === 0 ? 'week' : todayIdx >= 5 ? 'next' : 'rest');

  const plan = useMemo(() => {
    if (scope === 'week') return derived.week;
    if (scope === 'rest') return { ...derived.week, days: derived.week.days.filter((d) => d.index >= todayIdx) };
    const t = derived.targets;
    return generateWeekPlan(derived.profile, t, { mealSeed: nextSeed(state.plan.mealSeed), mealWeekStart: addDays(derived.week.weekStart, 7), mealOverrides: {} });
  }, [scope, derived.week, derived.targets, derived.profile, state.plan.mealSeed, todayIdx]);

  // Les cases cochées sont mémorisées par semaine (préfixe = lundi de la semaine).
  const prefix = `${plan.weekStart}|`;
  const checked = useMemo(
    () => Object.fromEntries(Object.entries(state.plan.shoppingChecked).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v])),
    [state.plan.shoppingChecked, prefix],
  );

  const items: ShoppingItem[] = useMemo(() => {
    const list = buildShoppingList(plan).filter((i) => !(state.plan.pantryHidden && i.pantry));
    if (state.plan.includeSupplementsInShopping)
      for (const s of activeStack(derived.supplements).filter((x) => x.id !== 'protein'))
        list.push({ key: `supp-${s.id}`, label: s.name, amount: '1 mois', detail: s.form, aisle: 'supplements', pantry: false });
    for (const x of state.plan.shoppingExtra) list.push({ key: x.id, label: x.label, amount: '', aisle: 'extra', pantry: false });
    return list;
  }, [plan, derived.supplements, state.plan.pantryHidden, state.plan.includeSupplementsInShopping, state.plan.shoppingExtra]);

  const sections = groupByAisle(items);
  const remaining = items.filter((i) => !checked[i.key]).length;
  const toggle = (key: string, v: boolean) => update((s) => ({ ...s, plan: { ...s.plan, shoppingChecked: { ...s.plan.shoppingChecked, [prefix + key]: v } } }));
  const firstDay = plan.days[0]?.date ?? plan.weekStart;

  return (
    <>
      <Segmented<Scope>
        value={scope}
        onChange={setScope}
        options={[
          { value: 'week', label: 'Semaine' },
          { value: 'rest', label: 'Jours restants' },
          { value: 'next', label: 'Suivante' },
        ]}
      />
      <Card
        title={`${remaining} article${remaining > 1 ? 's' : ''} à acheter`}
        sub={`Du ${formatDay(firstDay, { weekday: 'short', day: 'numeric', month: 'short' })} au ${formatDay(addDays(plan.weekStart, 6), { weekday: 'short', day: 'numeric', month: 'short' })} · ${items.length} produits`}
      >
        <div className="row wrap">
          <button className="btn sm primary" onClick={() => shareOrCopy(shoppingListText(sections, checked), 'Liste de courses', toast)}>
            <Icon.share /> Partager / copier
          </button>
          <button
            className="btn sm"
            onClick={() =>
              update((s) => ({ ...s, plan: { ...s.plan, shoppingChecked: Object.fromEntries(Object.entries(s.plan.shoppingChecked).filter(([k]) => !k.startsWith(prefix))) } }))
            }
          >
            Tout décocher
          </button>
        </div>
        {scope === 'next' && <p className="small muted">Aperçu du menu de la semaine prochaine (portions recalculées lundi selon tes dernières mesures).</p>}
        <Toggle label="Masquer les produits de placard" sub="Huile, épices, céréales, graines… que tu as souvent déjà" checked={state.plan.pantryHidden} onChange={(v) => update((s) => ({ ...s, plan: { ...s.plan, pantryHidden: v } }))} />
        <Toggle label="Inclure mes compléments" checked={state.plan.includeSupplementsInShopping} onChange={(v) => update((s) => ({ ...s, plan: { ...s.plan, includeSupplementsInShopping: v } }))} />
      </Card>

      {sections.map((sec) => (
        <Card key={sec.aisle} title={sec.title} className="tight">
          {sec.items.map((i) => (
            <Check
              key={i.key}
              checked={!!checked[i.key]}
              onChange={(v) => toggle(i.key, v)}
              title={i.label}
              sub={[i.amount, i.detail].filter(Boolean).join(' · ')}
              right={
                sec.aisle === 'extra' ? (
                  <button
                    className="icon-btn"
                    aria-label="Retirer"
                    onClick={(e) => {
                      e.preventDefault();
                      update((s) => ({ ...s, plan: { ...s.plan, shoppingExtra: s.plan.shoppingExtra.filter((x) => x.id !== i.key) } }));
                    }}
                  >
                    <Icon.x />
                  </button>
                ) : undefined
              }
            />
          ))}
        </Card>
      ))}

      <Card title="Ajouter un article">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newItem.trim()) return;
            update((s) => ({ ...s, plan: { ...s.plan, shoppingExtra: [...s.plan.shoppingExtra, { id: uid(), label: newItem.trim(), checked: false }] } }));
            setNewItem('');
          }}
        >
          <input className="input" placeholder="Ex. café en grains, thé vert…" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
          <button className="btn primary" type="submit" aria-label="Ajouter">
            <Icon.plus />
          </button>
        </form>
      </Card>
      <p className="small muted">Conseils : privilégie le bio pour les fruits rouges, épinards et pommes (les plus traités) ; poissons pêchés MSC ; œufs code 0 ou 1.</p>
    </>
  );
}

function Targets() {
  const { derived } = useApp();
  const { targets: t, snap } = derived;
  const pct = (g: number, k: number) => Math.round(((g * k) / t.kcal) * 100);
  return (
    <>
      <Card title={t.phaseLabel} sub={t.phaseReason}>
        <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
          <span className="hero-number">{t.kcal}</span>
          <span className="text-2">kcal / jour</span>
        </div>
        <p className="small text-2">
          Dépense estimée {t.tdee} kcal (métabolisme de base {t.bmr} kcal). Vitesse visée : {t.targetRateKg > 0 ? '+' : ''}
          {t.targetRateKg} kg/semaine ({t.targetRatePct > 0 ? '+' : ''}
          {t.targetRatePct} % du poids).
          {t.adjustment !== 0 && ` Ajustement issu de tes bilans : ${t.adjustment > 0 ? '+' : ''}${t.adjustment} kcal.`}
        </p>
      </Card>
      <div className="grid3">
        <Stat label="Protéines" value={t.protein} unit="g" delta={`${pct(t.protein, 4)} % · ${fmt(t.protein / snap.weightKg)} g/kg`} />
        <Stat label="Glucides" value={t.carbs} unit="g" delta={`${pct(t.carbs, 4)} %`} />
        <Stat label="Lipides" value={t.fat} unit="g" delta={`${pct(t.fat, 9)} %`} />
      </div>
      <div className="grid3">
        <Stat label="Fibres" value={t.fiber} unit="g" />
        <Stat label="Eau" value={fmt(t.waterL)} unit="L" />
        <Stat label="Prot./repas" value={`≥ ${t.proteinPerMeal}`} unit="g" />
      </div>
      <Card title="Les règles qui font la différence">
        <ul className="steps" style={{ color: 'var(--text)' }}>
          <li>
            <b>Protéines à chaque repas</b> (≥ {t.proteinPerMeal} g) : c’est le seuil qui maximise la synthèse musculaire.
          </li>
          <li>
            <b>Aliments bruts, peu transformés</b> : l’ultra-transformé fait manger ~500 kcal de plus par jour sans s’en rendre compte.
          </li>
          <li>
            <b>Glucides autour de l’entraînement</b> (repas avant/après) pour la performance et la récupération.
          </li>
          <li>
            <b>Gras de qualité</b> : huile d’olive vierge extra, noix, poissons gras ; limite le beurre, la charcuterie, la friture.
          </li>
          <li>
            <b>Dîner 2-3 h avant le coucher</b> pour un meilleur sommeil.
          </li>
          <li>
            <b>Régularité &gt; perfection</b> : 90 % du plan suivi = 100 % des résultats sur le long terme.
          </li>
        </ul>
      </Card>
      <p className="small muted">
        Calcul : Katch-McArdle (si % de gras mesuré) ou Mifflin-St Jeor, facteur d’activité, protéines 1,8-2,2 g/kg (poids de référence), lipides ≥ 30 % / 0,8 g/kg, glucides en complément. Le bilan
        hebdomadaire corrige automatiquement à partir de ta tendance de poids réelle.
      </p>
    </>
  );
}
