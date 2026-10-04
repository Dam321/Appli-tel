import { useState } from 'react';
import { Icon } from '../components/icons';
import { InstallCard } from '../components/InstallCard';
import { importState } from '../lib/storage';
import type { Profile } from '../lib/types';
import { uid } from '../lib/util';
import { useStore } from '../store';
import { FoodStep, GoalStep, IdentityStep, newProfile, RecoveryStep, TrainingStep } from './ProfileForm';

const STEPS = [
  { title: 'Faisons connaissance', sub: 'Ces données restent sur ton téléphone.', C: IdentityStep },
  { title: 'Ton objectif', sub: 'Gagner du muscle, perdre du gras… ou les deux.', C: GoalStep },
  { title: 'Ton entraînement', sub: 'Le programme s’adapte à ton temps et ton matériel.', C: TrainingStep },
  { title: 'Ton alimentation', sub: 'Pour générer ton menu et ta liste de courses.', C: FoodStep },
  { title: 'Récupération', sub: 'Sommeil et stress orientent aussi tes compléments.', C: RecoveryStep },
];

export function Onboarding() {
  const { update, toast } = useStore();
  const [step, setStep] = useState(-1);
  const [p, setP] = useState<Profile>(newProfile);
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));

  const finish = () => {
    update((s) => ({
      ...s,
      profile: p,
      measurements: s.measurements.length
        ? s.measurements
        : [{ id: uid(), date: new Date().toISOString(), source: 'manual', weightKg: p.weightKg, fatPct: p.bodyFatPct, waistCm: p.waistCm }],
    }));
    window.location.hash = '#/home';
  };

  const restore = async (file: File) => {
    try {
      const st = importState(await file.text());
      update(() => st);
      toast('Sauvegarde restaurée ✔');
    } catch (e) {
      toast((e as Error).message);
    }
  };

  if (step < 0)
    return (
      <div className="onboarding">
        <div className="brand">
          <div className="logo">
            <Icon.heart />
          </div>
          Vitalis
        </div>
        <InstallCard />
        <h1 style={{ fontSize: 30, letterSpacing: '-0.02em' }}>Ton coach santé, muscle & longévité.</h1>
        <p className="text-2" style={{ margin: 0 }}>
          Programme de musculation, nutrition sur-mesure avec menu et liste de courses, synchro de ta balance Withings, analyse de ta prise de sang et protocole de compléments fondé sur
          les preuves.
        </p>
        <div className="card stack">
          {[
            ['Corps', 'Tendance de poids lissée, masse grasse, masse maigre (Withings)'],
            ['Sport', 'Programme hypertrophie + cardio longévité, progression automatique'],
            ['Nutrition', 'Macros adaptatives, menu de la semaine, liste de courses'],
            ['Santé', 'Bilan sanguin, compléments personnalisés, habitudes'],
          ].map(([t, d]) => (
            <div className="row" key={t} style={{ alignItems: 'flex-start' }}>
              <span className="badge accent">{t}</span>
              <span className="small text-2">{d}</span>
            </div>
          ))}
        </div>
        <div className="spacer" />
        <button className="btn primary block" onClick={() => setStep(0)}>
          Commencer (2 min)
        </button>
        <label className="btn ghost block">
          <Icon.upload /> Restaurer une sauvegarde
          <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        </label>
        <p className="small muted" style={{ margin: 0 }}>
          Vitalis ne remplace pas un avis médical. En cas de pathologie, de traitement ou de grossesse, parle de ton programme et de tes compléments à ton médecin.
        </p>
      </div>
    );

  const S = STEPS[step];
  const valid = step !== 0 || (p.heightCm > 120 && p.heightCm < 230 && p.weightKg > 30 && p.weightKg < 300 && p.birthYear > 1920 && p.birthYear < new Date().getFullYear() - 12);
  return (
    <div className="onboarding">
      <div className="progress-dots">
        {STEPS.map((_, i) => (
          <i key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>
      <div>
        <h1 style={{ fontSize: 26 }}>{S.title}</h1>
        <p className="text-2" style={{ margin: '4px 0 0' }}>
          {S.sub}
        </p>
      </div>
      <S.C p={p} set={set} />
      <div className="spacer" />
      <div className="row">
        <button className="btn" onClick={() => setStep(step - 1)}>
          Retour
        </button>
        <button className="btn primary" style={{ flex: 1 }} disabled={!valid} onClick={() => (step === STEPS.length - 1 ? finish() : setStep(step + 1))}>
          {step === STEPS.length - 1 ? 'Créer mon plan' : 'Continuer'}
        </button>
      </div>
    </div>
  );
}
