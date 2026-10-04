import { useState } from 'react';
import { PROFILE_VERSION } from '../lib/profile';
import type { Profile } from '../lib/types';
import { HealthStep, RhythmStep } from '../pages/ProfileForm';
import { useApp } from '../store';
import { Callout, Sheet } from './ui';
import { Icon } from './icons';

const STEPS = [
  { title: 'Ton rythme & tes priorités', C: RhythmStep },
  { title: 'Ta santé', C: HealthStep },
];

/** Invite les profils créés avant le bilan complet à le compléter. */
export function ProfileUpgrade() {
  const { state, update, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const p = state.profile!;
  if (p.profileVersion >= PROFILE_VERSION) return null;
  const set = (patch: Partial<Profile>) => update((s) => ({ ...s, profile: { ...s.profile!, ...patch } }));
  const S = STEPS[step];
  return (
    <>
      <Callout
        title="Complète ton bilan (2 min)"
        icon={<Icon.sparkles />}
        action={
          <button className="btn sm primary" onClick={() => setOpen(true)}>
            Compléter
          </button>
        }
      >
        Horaires, jours d’entraînement, muscles prioritaires, santé et traitements : ton programme, ton menu et tes compléments deviennent encore plus précis.
      </Callout>
      {open && (
        <Sheet title={S.title} onClose={() => setOpen(false)}>
          <div className="stack" style={{ gap: 16 }}>
            <S.C p={p} set={set} />
            <div className="row">
              {step > 0 && (
                <button className="btn" onClick={() => setStep(step - 1)}>
                  Retour
                </button>
              )}
              <button
                className="btn primary"
                style={{ flex: 1 }}
                onClick={() => {
                  if (step < STEPS.length - 1) setStep(step + 1);
                  else {
                    set({ profileVersion: PROFILE_VERSION });
                    setOpen(false);
                    toast('Bilan complété : programme mis à jour ✔');
                  }
                }}
              >
                {step < STEPS.length - 1 ? 'Continuer' : 'Terminer'}
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
