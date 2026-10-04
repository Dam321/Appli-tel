import { useMemo, useState } from 'react';
import { navigate } from '../App';
import { Icon } from '../components/icons';
import { Badge, Card } from '../components/ui';
import { gearList, notWorthIt, TIER_LABEL, type GearItem } from '../lib/gear';
import { uid } from '../lib/util';
import { useApp } from '../store';

const TIER_TONE = { essential: 'accent', useful: 'good', optional: 'neutral' } as const;

export function Gear() {
  const { state, update, derived, toast } = useApp();
  const items = useMemo(() => gearList(state, derived), [state, derived]);
  const avoid = useMemo(() => notWorthIt(state, derived), [state, derived]);
  const [showDone, setShowDone] = useState(false);
  const owned = (g: GearItem) => state.gear[g.id] === 'owned' || (g.detected && !state.gear[g.id]);
  const todo = items.filter((g) => !owned(g) && state.gear[g.id] !== 'skip');
  const done = items.filter((g) => owned(g) || state.gear[g.id] === 'skip');
  const inList = new Set(state.plan.shoppingExtra.map((x) => x.label));

  const mark = (id: string, v: 'owned' | 'skip' | 'missing' | undefined) =>
    update((s) => {
      const gear = { ...s.gear };
      if (v) gear[id] = v;
      else delete gear[id];
      return { ...s, gear };
    });
  const toShopping = (g: GearItem) => {
    if (inList.has(g.name)) return;
    update((s) => ({ ...s, plan: { ...s.plan, shoppingExtra: [...s.plan.shoppingExtra, { id: uid(), label: g.name, checked: false }] } }));
    toast('Ajouté à ta liste de courses');
  };
  const essentials = todo.filter((g) => g.tier === 'essential');
  const budget = (list: GearItem[]) => {
    const lo = list.reduce((a, g) => a + Number(g.price.match(/\d+/)?.[0] ?? 0), 0);
    const hi = list.reduce((a, g) => a + Number(g.price.match(/-(\d+)/)?.[1] ?? g.price.match(/\d+/)?.[0] ?? 0), 0);
    return `${lo}-${hi} €`;
  };

  return (
    <>
      <Card title="Ce qui vaut vraiment l’achat" sub="Sélectionné d’après tes données : seulement ce qui améliore une mesure ou une habitude qui compte. Prix indicatifs.">
        <p className="small" style={{ margin: 0 }}>
          {essentials.length
            ? `${essentials.length} essentiel(s) à te procurer, environ ${budget(essentials)} au total.`
            : 'Tu as déjà tous les essentiels. Le reste est un plus, pas une obligation.'}
        </p>
      </Card>

      {todo.map((g) => (
        <Card key={g.id} title={g.name}>
          <div className="row" style={{ gap: 8 }}>
            <Badge tone={TIER_TONE[g.tier]}>{TIER_LABEL[g.tier]}</Badge>
            <span className="small" style={{ fontWeight: 650 }}>
              {g.price}
            </span>
          </div>
          <p className="small" style={{ margin: '6px 0' }}>
            {g.why}
          </p>
          <div className="tip" style={{ marginTop: 0 }}>
            <b>Bien choisir :</b> {g.criteria}
          </div>
          <div className="row wrap" style={{ marginTop: 10, gap: 8 }}>
            <button className="btn sm" onClick={() => mark(g.id, 'owned')}>
              <Icon.check /> Je l’ai déjà
            </button>
            <button className="btn sm" disabled={inList.has(g.name)} onClick={() => toShopping(g)}>
              <Icon.cart /> {inList.has(g.name) ? 'Dans tes courses' : 'Ajouter aux courses'}
            </button>
            {g.tier !== 'essential' && (
              <button className="btn ghost sm" onClick={() => mark(g.id, 'skip')}>
                Pas pour moi
              </button>
            )}
          </div>
        </Card>
      ))}

      {done.length > 0 && (
        <Card title={`Déjà équipé ou écarté (${done.length})`} action={<button className="btn ghost sm" onClick={() => setShowDone((x) => !x)}>{showDone ? 'Masquer' : 'Voir'}</button>}>
          {showDone && (
            <div className="list">
              {done.map((g) => (
                <div key={g.id} className="list-item">
                  <div className="main">
                    <div className="title">{g.name}</div>
                    <div className="sub">{state.gear[g.id] === 'skip' ? 'Écarté' : g.detected && !state.gear[g.id] ? 'Détecté d’après tes données' : 'Déjà équipé'}</div>
                  </div>
                  {state.gear[g.id] ? (
                    <button className="btn ghost sm" onClick={() => mark(g.id, undefined)}>
                      Annuler
                    </button>
                  ) : (
                    <button className="btn ghost sm" onClick={() => mark(g.id, 'missing')}>
                      Je ne l’ai pas
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card title="À ne pas acheter" sub="Marketing bien rodé, bénéfice nul ou contre-productif pour ton objectif">
        <div className="list">
          {avoid.map((x) => (
            <div key={x.name} className="list-item" style={{ alignItems: 'flex-start' }}>
              <span className="dot" style={{ marginTop: 7, background: 'var(--serious)' }} />
              <div className="main">
                <div className="title">{x.name}</div>
                <div className="sub">{x.why}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <p className="small muted" style={{ textAlign: 'center' }}>
        Compléments et produits de soin : voir{' '}
        <button className="linklike" onClick={() => navigate('health')}>
          l’onglet Santé
        </button>
        .
      </p>
    </>
  );
}
