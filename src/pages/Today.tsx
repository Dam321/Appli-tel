import { navigate } from '../App';
import { Icon } from '../components/icons';
import { Badge, Callout, Card, Check, Meter, Ring, Stat } from '../components/ui';
import { daysSinceLastWeighIn, fatCategory, trendSeries } from '../lib/bodyComp';
import { dayScore, streak } from '../lib/longevity';
import { SLOT_LABEL } from '../lib/mealPlanner';
import { weeklyCheckIn } from '../lib/nutrition';
import { dailySchedule, TIMING_LABEL } from '../lib/supplements';
import { sessionForDate } from '../lib/training';
import type { AppState, DailyLog } from '../lib/types';
import { daysBetween, fmt, formatDay, todayISO, weekdayIndex } from '../lib/util';
import { useApp } from '../store';

export function setDaily(update: (fn: (s: AppState) => AppState) => void, day: string, fn: (d: DailyLog) => DailyLog) {
  update((s) => ({ ...s, daily: { ...s.daily, [day]: fn(s.daily[day] ?? { habits: {}, meals: {} }) } }));
}

export function Today() {
  const { state, update, derived, toast } = useApp();
  const { snap, targets, week, program, profile, habits, stack } = derived;
  const today = todayISO();
  const log = state.daily[today] ?? { habits: {}, meals: {} };
  const dayPlan = week.days[weekdayIndex(today)];
  const session = sessionForDate(program, today);
  const schedule = program.schedule[weekdayIndex(today)];
  const score = dayScore(log, habits);
  const st = streak(state.daily, habits);
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Bonne nuit' : hour < 18 ? 'Bonjour' : 'Bonsoir';

  const eaten = dayPlan.meals.filter((m) => log.meals[m.slot]);
  const eatenKcal = eaten.reduce((a, m) => a + m.macros.kcal, 0);
  const eatenP = eaten.reduce((a, m) => a + m.macros.p, 0);

  // Bilan hebdomadaire
  const series = trendSeries(state.measurements, 'weightKg');
  const dataDays = series.length ? daysBetween(series[0].day, series[series.length - 1].day) : 0;
  const lastCheck = state.plan.lastCheckIn;
  const checkDue = (!lastCheck || daysBetween(lastCheck, today) >= 7) && dataDays >= 10;
  const check = weeklyCheckIn(targets, snap.weeklyRateKg, dataDays);
  const noWeighIn = daysSinceLastWeighIn(state.measurements);
  const cat = fatCategory(profile.sex, snap.fatPct);

  const applyCheck = (adj: number) => {
    update((s) => ({
      ...s,
      plan: {
        ...s.plan,
        kcalAdjustment: s.plan.kcalAdjustment + adj,
        lastCheckIn: today,
        checkIns: [...s.plan.checkIns, { date: today, trendKg: snap.weightKg, ratePerWeek: snap.weeklyRateKg ?? 0, adjustment: adj }],
      },
    }));
    toast(adj ? `Objectif ajusté de ${adj > 0 ? '+' : ''}${adj} kcal/jour` : 'Bilan enregistré');
  };

  return (
    <>
      <div>
        <div className="text-2 small">{formatDay(today, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div className="row between" style={{ marginTop: 2 }}>
          <h2 style={{ fontSize: 24 }}>
            {hello}
            {profile.name ? ` ${profile.name}` : ''} 👋
          </h2>
          <Badge tone="accent">{targets.phaseLabel}</Badge>
        </div>
      </div>

      {!state.settings.withings?.refreshToken && (
        <Callout title="Connecte ta balance Withings" action={<button className="btn sm primary" onClick={() => navigate('settings')}>Connecter</button>}>
          Tes pesées et ta composition corporelle arriveront automatiquement, et ton plan s’ajustera tout seul.
        </Callout>
      )}
      {noWeighIn !== undefined && noWeighIn >= 3 && (
        <Callout tone="warning" title={`Pas de pesée depuis ${noWeighIn} jours`}>
          Pèse-toi le matin, à jeun, après les toilettes : la tendance lissée a besoin de pesées régulières.
        </Callout>
      )}
      {state.bloodPanels.length === 0 && (
        <Callout
          title="Fais ta prise de sang de départ"
          icon={<Icon.drop />}
          action={
            <button className="btn sm" onClick={() => navigate('health', 'blood')}>
              Voir le bilan à demander
            </button>
          }
        >
          Vitamine D, ferritine, ApoB, HbA1c… pour personnaliser tes compléments et suivre ta santé interne.
        </Callout>
      )}
      {checkDue && (
        <Card title="Bilan de la semaine" sub="Ajustement automatique de tes calories">
          <p style={{ margin: '0 0 12px' }}>{check.message}</p>
          <div className="row">
            {check.suggestion !== 0 && (
              <button className="btn primary sm" onClick={() => applyCheck(check.suggestion)}>
                Appliquer {check.suggestion > 0 ? '+' : ''}
                {check.suggestion} kcal
              </button>
            )}
            <button className="btn sm" onClick={() => applyCheck(0)}>
              {check.suggestion ? 'Ne rien changer' : 'OK'}
            </button>
          </div>
        </Card>
      )}

      <div className="grid2 grid-stats">
        <Stat label="Poids (tendance)" value={fmt(snap.weightKg)} unit="kg" delta={snap.weeklyRateKg !== undefined ? `${snap.weeklyRateKg > 0 ? '+' : ''}${fmt(snap.weeklyRateKg, 2)} kg/sem.` : 'En attente de données'} />
        <Stat label="Masse grasse" value={fmt(snap.fatPct)} unit="%" delta={cat.label} deltaClass={cat.tone === 'good' ? 'up-good' : 'text-2'} />
        <Stat label="Masse maigre" value={fmt(snap.leanMassKg)} unit="kg" delta={`FFMI ${fmt(snap.ffmi)}`} />
        <Stat label="Objectif du jour" value={targets.kcal} unit="kcal" delta={`${targets.protein} g de protéines`} />
      </div>

      <Card
        title={session ? session.name : schedule.label}
        sub={session ? `${session.exercises.length} exercices · ~${session.estMinutes} min · semaine ${program.week}/5` : 'Pas de musculation aujourd’hui'}
        action={
          session ? (
            <button className="btn primary sm" onClick={() => navigate('training', `log-${session.id}`)}>
              Démarrer
            </button>
          ) : undefined
        }
      >
        {session ? (
          <div className="small text-2">
            {session.exercises.map((e) => e.name).join(' · ')}
            {schedule.label.includes('+') && <div style={{ marginTop: 6 }}>Cardio : {schedule.label.split('+').slice(1).join('+').trim()}</div>}
          </div>
        ) : schedule.cardio === 'zone2' ? (
          <div className="small text-2">
            Zone 2 : {program.cardio.zone2.minutes} min entre {program.cardio.zone2.hrLow} et {program.cardio.zone2.hrHigh} bpm (tu peux parler en phrases complètes).
          </div>
        ) : schedule.cardio === 'vo2max' ? (
          <div className="small text-2">{program.cardio.vo2?.protocol}</div>
        ) : (
          <div className="small text-2">Récupération active : marche, mobilité, sommeil. C’est là que le muscle se construit.</div>
        )}
        {program.deload && <div className="tip">{program.weekNote}</div>}
      </Card>

      <Card
        title="Repas du jour"
        sub={`${Math.round(eatenKcal)} / ${Math.round(dayPlan.totals.kcal)} kcal · ${Math.round(eatenP)} / ${Math.round(dayPlan.totals.p)} g protéines`}
        action={
          <button className="btn ghost sm" onClick={() => navigate('nutrition')}>
            Recettes
          </button>
        }
      >
        <Meter value={eatenKcal} max={dayPlan.totals.kcal} />
        <div style={{ marginTop: 6 }}>
          {dayPlan.meals.map((m) => (
            <Check
              key={m.slot}
              checked={!!log.meals[m.slot]}
              onChange={(v) => setDaily(update, today, (d) => ({ ...d, meals: { ...d.meals, [m.slot]: v } }))}
              title={m.name}
              sub={`${SLOT_LABEL[m.slot]} · ${Math.round(m.macros.kcal)} kcal · ${Math.round(m.macros.p)} g P${m.leftover ? ' · restes d’hier' : ''}`}
            />
          ))}
        </div>
      </Card>

      {stack.length > 0 && (
        <Card
          title="Compléments du jour"
          action={
            <button className="btn ghost sm" onClick={() => navigate('health')}>
              Détails
            </button>
          }
        >
          {dailySchedule(stack).map((g) => (
            <div key={g.timing} className="list-item">
              <div className="main">
                <div className="sub">{TIMING_LABEL[g.timing]}</div>
                <div className="title">{g.items.map((i) => i.name).join(' · ')}</div>
              </div>
            </div>
          ))}
          <Check
            checked={!!log.habits.supps}
            onChange={(v) => setDaily(update, today, (d) => ({ ...d, habits: { ...d.habits, supps: v } }))}
            title="Tout pris aujourd’hui"
          />
        </Card>
      )}

      <Card
        title="Habitudes longévité"
        sub={st > 1 ? `🔥 ${st} jours d’affilée au-dessus de 60 %` : 'Coche au fil de la journée'}
        action={<Ring pct={score} />}
      >
        {habits
          .filter((h) => h.id !== 'supps')
          .map((h) => (
            <Check
              key={h.id}
              checked={!!log.habits[h.id]}
              onChange={(v) => setDaily(update, today, (d) => ({ ...d, habits: { ...d.habits, [h.id]: v } }))}
              title={h.label}
              sub={h.id === 'steps' && log.steps !== undefined ? `${log.steps.toLocaleString('fr-FR')} pas (Withings)` : h.detail}
            />
          ))}
      </Card>
    </>
  );
}
