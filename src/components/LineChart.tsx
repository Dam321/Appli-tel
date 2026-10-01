// Graphique de tendance : pesées brutes (points discrets) + tendance lissée (ligne),
// réticule tactile avec infobulle, étiquette directe en fin de courbe, tableau accessible.
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDay, parseDay } from '../lib/util';

export interface ChartPoint {
  day: string;
  raw?: number;
  trend: number;
}

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

export function LineChart({
  data,
  unit,
  decimals = 1,
  height = 190,
  trendLabel = 'Tendance',
  rawLabel = 'Mesures',
  showRaw = true,
}: {
  data: ChartPoint[];
  unit: string;
  decimals?: number;
  height?: number;
  trendLabel?: string;
  rawLabel?: string;
  showRaw?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.max(240, entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { l: 38, r: 50, t: 10, b: 24 };
  const geo = useMemo(() => {
    if (!data.length) return null;
    const xs = data.map((d) => parseDay(d.day).getTime());
    const vals = data.flatMap((d) => (showRaw && d.raw !== undefined ? [d.raw, d.trend] : [d.trend]));
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const padY = Math.max((hi - lo) * 0.12, 0.3);
    lo -= padY;
    hi += padY;
    const x0 = xs[0];
    const x1 = xs[xs.length - 1] === x0 ? x0 + 86_400_000 : xs[xs.length - 1];
    const sx = (t: number) => pad.l + ((t - x0) / (x1 - x0)) * (width - pad.l - pad.r);
    const sy = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (height - pad.t - pad.b);
    return { xs, sx, sy, ticks: niceTicks(lo, hi), x0, x1 };
  }, [data, width, height, showRaw, pad.l, pad.r, pad.t, pad.b]);

  if (!data.length || !geo) return <div className="empty small">Pas encore de données.</div>;

  const { xs, sx, sy, ticks } = geo;
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${sx(xs[i]).toFixed(1)},${sy(d.trend).toFixed(1)}`).join(' ');
  const last = data[data.length - 1];
  const f = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const xLabels = data.length > 2 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0, data.length - 1];

  const onMove = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    xs.forEach((t, i) => {
      const d = Math.abs(sx(t) - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover !== null ? data[hover] : null;
  const hx = hover !== null ? sx(xs[hover]) : 0;

  return (
    <div>
      {showRaw && (
        <div className="legend">
          <span>
            <i style={{ background: 'var(--chart-1)' }} />
            {trendLabel}
          </span>
          <span>
            <i className="dotkey" style={{ background: 'var(--chart-raw)' }} />
            {rawLabel}
          </span>
        </div>
      )}
      <div className="chart" ref={ref}>
        <svg height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${trendLabel} : dernière valeur ${f(last.trend)} ${unit}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={sy(t)} y2={sy(t)} stroke="var(--grid)" strokeWidth="1" />
              <text x={pad.l - 6} y={sy(t) + 4} textAnchor="end" className="tick">
                {t.toLocaleString('fr-FR')}
              </text>
            </g>
          ))}
          {xLabels.map((i, k) => (
            <text key={i} x={sx(xs[i])} y={height - 6} textAnchor={k === 0 ? 'start' : k === xLabels.length - 1 ? 'end' : 'middle'} className="tick">
              {formatDay(data[i].day)}
            </text>
          ))}
          {showRaw &&
            data.map((d, i) => (d.raw !== undefined ? <circle key={i} cx={sx(xs[i])} cy={sy(d.raw)} r={2.6} fill="var(--chart-raw)" /> : null))}
          <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={sx(xs[xs.length - 1])} cy={sy(last.trend)} r={4} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth="2" />
          <text x={sx(xs[xs.length - 1]) + 8} y={sy(last.trend) + 4} fontSize="12.5" fontWeight="600" fill="var(--text)">
            {f(last.trend)}
          </text>
          {hp && (
            <g>
              <line x1={hx} x2={hx} y1={pad.t} y2={height - pad.b} stroke="var(--axis)" strokeWidth="1" />
              <circle cx={hx} cy={sy(hp.trend)} r={4} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth="2" />
            </g>
          )}
          <rect
            x={pad.l}
            y={0}
            width={width - pad.l - pad.r + 8}
            height={height}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hp && (
          <div className="chart-tip" style={{ left: Math.min(Math.max(hx - 70, 0), width - 150) }}>
            <div className="muted">{formatDay(hp.day, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
            <div>
              <span className="key" style={{ background: 'var(--chart-1)' }} />
              <strong>
                {f(hp.trend)} {unit}
              </strong>{' '}
              <span className="muted">{trendLabel.toLowerCase()}</span>
            </div>
            {showRaw && hp.raw !== undefined && (
              <div>
                <span className="key" style={{ background: 'var(--chart-raw)' }} />
                {f(hp.raw)} {unit} <span className="muted">{rawLabel.toLowerCase()}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <details style={{ marginTop: 6 }}>
        <summary className="small muted">Voir les valeurs</summary>
        <table className="table" style={{ marginTop: 6 }}>
          <thead>
            <tr>
              <th>Date</th>
              {showRaw && <th style={{ textAlign: 'right' }}>{rawLabel}</th>}
              <th style={{ textAlign: 'right' }}>{trendLabel}</th>
            </tr>
          </thead>
          <tbody>
            {data
              .slice(-30)
              .reverse()
              .map((d) => (
                <tr key={d.day}>
                  <td>{formatDay(d.day, { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                  {showRaw && <td className="num">{d.raw !== undefined ? f(d.raw) : '–'}</td>}
                  <td className="num">{f(d.trend)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
