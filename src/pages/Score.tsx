import { useMemo } from 'react';
import { navigate, type Route } from '../App';
import { GearTeaser } from '../components/GearTeaser';
import { Badge, Callout, Card, Meter } from '../components/ui';
import { assess, type Action } from '../lib/assessment';
import { insights } from '../lib/insights';
import { formatDay, todayISO } from '../lib/util';
import { useApp } from '../store';

export function goTo(route?: string) {
  if (!route) return;
  const [r, tab] = route.split('#');
  navigate(r as Route, tab === 'supplements' ? undefined : tab);
}

export function scoreTone(score: number): 'good' | 'warning' | 'serious' {
  return score >= 75 ? 'good' : score >= 50 ? 'warning' : 'serious';
}

export function ActionItem({ a, rank }: { a: Action; rank?: number }) {
  return (
    <div className="list-item" style={{ alignItems: 'flex-start' }}>
      {rank !== undefined && <span className="rank">{rank}</span>}
      <div className="main">
        <div className="title">{a.title}</div>
        <div className="sub">{a.why}</div>
        <div className="small" style={{ marginTop: 4 }}>
          <b>Comment :</b> {a.how}
        </div>
      </div>
      {a.route && (
        <button className="btn sm" onClick={() => goTo(a.route)}>
          Agir
        </button>
      )}
    </div>
  );
}

export function Score() {
  const { state, derived } = useApp();
  const a = useMemo(() => assess(state, derived), [state, derived]);
  const ins = useMemo(() => insights(state, derived), [state, derived]);
  const { bio, retest } = a;

  return (
    <>
      <Card title="Ton score Vitalis" sub="Moyenne pondérée de 8 piliers, calculée sur tes données réelles">
        {a.global !== undefined ? (
          <div className="row wrap" style={{ alignItems: 'baseline', gap: 10 }}>
            <span className="hero-number">{a.global}</span>
            <span className="text-2">/ 100</span>
            <Badge tone={scoreTone(a.global)}>{a.global >= 75 ? 'Très bon niveau' : a.global >= 50 ? 'En progression' : 'Gros potentiel de progrès'}</Badge>
          </div>
        ) : (
          <p className="small text-2">Encore quelques données (pesées, séances, prise de sang) et ton score apparaît.</p>
        )}
      </Card>

      <Card title="Âge biologique" sub="PhenoAge (Levine 2018) : 9 analyses sanguines courantes, validé sur la mortalité">
        {bio.phenoAge !== undefined ? (
          <>
            <div className="row wrap" style={{ alignItems: 'baseline', gap: 10 }}>
              <span className="hero-number">{bio.phenoAge.toFixed(1).replace('.', ',')}</span>
              <span className="text-2">ans</span>
              <Badge tone={bio.delta! <= -2 ? 'good' : bio.delta! <= 2 ? 'neutral' : 'warning'}>
                {bio.delta! < 0 ? `${(-bio.delta!).toFixed(1).replace('.', ',')} ans plus jeune` : `${bio.delta!.toFixed(1).replace('.', ',')} ans de plus`} que ton âge
              </Badge>
            </div>
            <p className="small muted" style={{ marginBottom: 0 }}>
              Prise de sang du {formatDay(bio.date!, { day: 'numeric', month: 'long', year: 'numeric' })}. Estimation statistique : elle bouge avec l’inflammation (CRP), la glycémie et la qualité du sang.
            </p>
          </>
        ) : (
          <p className="small text-2" style={{ margin: 0 }}>
            Il manque : {bio.missing.join(', ')}. Ce sont des analyses courantes et peu chères : ajoute-les à ta prochaine prise de sang (elles sont dans la liste « Bilan à demander »).
          </p>
        )}
      </Card>

      <Card title="Tes 8 piliers">
        <div className="stack" style={{ gap: 12 }}>
          {a.pillars.map((p) => (
            <div key={p.id}>
              <div className="row between">
                <b>{p.label}</b>
                {p.score !== undefined ? <Badge tone={scoreTone(p.score)}>{p.score}</Badge> : <Badge>à mesurer</Badge>}
              </div>
              {p.score !== undefined && <Meter value={p.score} max={100} color={p.score < 50 ? 'var(--serious)' : p.score < 75 ? 'var(--warning)' : undefined} />}
              <div className="small muted" style={{ marginTop: 4 }}>
                {p.detail}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Ton plan d’action" sub="Classé par impact attendu sur ta santé et ta longévité">
        {a.actions.length ? (
          <div className="list">
            {a.actions.map((x, i) => (
              <ActionItem key={x.id} a={x} rank={i + 1} />
            ))}
          </div>
        ) : (
          <p className="small text-2">Rien d’urgent : continue exactement comme ça.</p>
        )}
      </Card>

      {ins.length > 0 && (
        <Card title="Ce que tes données révèlent">
          <div className="list">
            {ins.map((i) => (
              <div key={i.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                <span className="dot" style={{ marginTop: 7, background: i.tone === 'good' ? 'var(--good)' : i.tone === 'warning' ? 'var(--warning)' : 'var(--chart-1)' }} />
                <div className="main">
                  <div className="title">{i.title}</div>
                  <div className="sub">{i.text}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {derived.autoVolume.notes.length > 0 && (
        <Callout title="Ton programme s’est adapté">{derived.autoVolume.notes.join(' ')}</Callout>
      )}

      <GearTeaser />

      <Card title="Prochaine prise de sang" sub={retest.date <= todayISO() ? 'Dès que possible' : `Vers le ${formatDay(retest.date, { day: 'numeric', month: 'long', year: 'numeric' })}`}>
        <p className="small" style={{ margin: 0 }}>
          {retest.reason}
          {retest.markers.length > 0 && <> À recontrôler en priorité : {retest.markers.join(', ')}.</>}
        </p>
      </Card>
    </>
  );
}
