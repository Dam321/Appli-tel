import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './icons';

export type Tone = 'good' | 'warning' | 'serious' | 'critical' | 'accent' | 'neutral';

export function Card({ title, sub, action, children, className = '' }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <div className="card-sub">{sub}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${tone === 'neutral' ? '' : tone}`}>{children}</span>;
}

export function Stat({ label, value, unit, delta, deltaClass }: { label: string; value: ReactNode; unit?: string; delta?: ReactNode; deltaClass?: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {delta && <div className={`delta ${deltaClass ?? 'text-2'}`}>{delta}</div>}
    </div>
  );
}

export function Meter({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  return (
    <div className="meter" role="meter" aria-valuenow={Math.round(value)} aria-valuemax={Math.round(max)}>
      <i style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Ring({ pct }: { pct: number }) {
  const r = 27;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" aria-label={`${pct} %`}>
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--accent-soft)" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} />
      </svg>
      <span>{pct}</span>
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={String(o.value)} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </label>
  );
}

export function NumberInput({
  value,
  onChange,
  unit,
  step = 'any',
  placeholder,
  min,
  max,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit?: string;
  step?: number | 'any';
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  const input = (
    <input
      className="input"
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value.replace(',', '.');
        onChange(v === '' ? undefined : Number(v));
      }}
    />
  );
  if (!unit) return input;
  return (
    <div className="input-unit">
      {input}
      <em>{unit}</em>
    </div>
  );
}

export function Toggle({ label, sub, checked, onChange }: { label: ReactNode; sub?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <div>
        <div style={{ fontWeight: 550 }}>{label}</div>
        {sub && <div className="small muted">{sub}</div>}
      </div>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Check({ checked, onChange, title, sub, right }: { checked: boolean; onChange: (v: boolean) => void; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <label className={`check ${checked ? 'done' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="body">
        <div className="title">{title}</div>
        {sub && <div className="small muted">{sub}</div>}
      </div>
      {right}
    </label>
  );
}

export function Chips<T extends string>({ options, selected, onToggle }: { options: { value: T; label: string }[]; selected: T[]; onToggle: (v: T) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={o.value} className={`chip ${selected.includes(o.value) ? 'on' : ''}`} aria-pressed={selected.includes(o.value)} onClick={() => onToggle(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Callout({ tone = 'accent', title, children, action, icon }: { tone?: 'accent' | 'warning' | 'critical'; title: ReactNode; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className={`callout ${tone === 'accent' ? '' : tone}`}>
      {icon ?? (tone === 'accent' ? <Icon.info /> : <Icon.alert />)}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="title">{title}</div>
        {children && <p>{children}</p>}
        {action && <div style={{ marginTop: 10 }}>{action}</div>}
      </div>
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon.x />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Evidence({ level }: { level: 'A' | 'B' | 'C' }) {
  const map = { A: ['good', 'Preuves solides'], B: ['accent', 'Preuves modérées'], C: ['warning', 'Préliminaire'] } as const;
  return <Badge tone={map[level][0]}>{`${level} · ${map[level][1]}`}</Badge>;
}

export async function shareOrCopy(text: string, title: string, toast: (m: string) => void) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Copié dans le presse-papiers');
  } catch {
    toast('Impossible de copier');
  }
}

/** Bouton à double appui : le 1er arme la confirmation (3 s), le 2e exécute. */
export function ConfirmButton({ onConfirm, label, confirmLabel = 'Confirmer ?', className = 'icon-btn', children }: { onConfirm: () => void; label: string; confirmLabel?: string; className?: string; children: ReactNode }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(id);
  }, [armed]);
  return (
    <button
      type="button"
      className={armed ? 'btn sm danger' : className}
      aria-label={armed ? confirmLabel : label}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
