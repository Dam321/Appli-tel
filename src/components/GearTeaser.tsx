import { useMemo } from 'react';
import { navigate } from '../App';
import { gearList } from '../lib/gear';
import { useApp } from '../store';
import { Icon } from './icons';
import { Callout } from './ui';

/** Rappel vers la page Équipement : essentiels encore manquants. */
export function GearTeaser() {
  const { state, derived } = useApp();
  const missing = useMemo(
    () => gearList(state, derived).filter((g) => g.tier === 'essential' && state.gear[g.id] !== 'owned' && state.gear[g.id] !== 'skip' && !(g.detected && !state.gear[g.id])),
    [state, derived],
  );
  return (
    <Callout
      icon={<Icon.bag />}
      title={missing.length ? `${missing.length} équipement(s) essentiel(s) à te procurer` : 'Ton équipement'}
      action={
        <button className="btn sm" onClick={() => navigate('gear')}>
          Voir
        </button>
      }
    >
      {missing.length ? missing.map((g) => g.name).join(' · ') : 'Ce qui vaut l’achat pour ton cas, et ce qu’il ne faut surtout pas acheter.'}
    </Callout>
  );
}
