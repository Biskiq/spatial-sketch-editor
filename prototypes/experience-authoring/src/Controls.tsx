import type { Capability, Document, SignalRef, Value } from './model';
import { allSignals, signalLabel } from './model';
export function CapabilityInput({ cap, value, onChange, prefix = '' }: { cap: Capability; value: Value; onChange: (v: Value) => void; prefix?: string }) {
  if (cap.control === 'toggle') return <label className="check"><input type="checkbox" aria-label={`${prefix}${cap.label}`} checked={!!value} onChange={e => onChange(e.target.checked)} />{cap.label} <span className="subtle">{value ? 'on' : 'off'}</span></label>;
  if (cap.control === 'range') return <label>{cap.label} <output>{Number(value || 0).toFixed(2)}</output><input aria-label={`${prefix}${cap.label}`} type="range" min={cap.min} max={cap.max} step={cap.step} value={Number(value || 0)} onChange={e => onChange(Number(e.target.value))} /></label>;
  return <div className="row wrap">{cap.actions?.map(a => <button key={a.label} aria-label={`${prefix}${a.label}`} className={value === a.value ? 'selected' : ''} onClick={() => onChange(a.value)}>{a.label}</button>)}</div>;
}
export function SignalSelect({ document, value, onChange, exclude, label = 'Signal' }: { document: Document; value: SignalRef | null; onChange: (r: SignalRef) => void; exclude?: string; label?: string }) {
  const options = allSignals(document).filter(r => r.useId !== exclude); const selected = value ? `${value.useId}|${value.signal}` : '';
  return <label>{label}<select aria-label={label} value={selected} onChange={e => { const split = e.target.value.indexOf('|'); if (split > 0) onChange({ useId: e.target.value.slice(0, split), signal: e.target.value.slice(split + 1) }); }}><option value="">Choose a supported signal…</option>{value && !options.some(r => `${r.useId}|${r.signal}` === selected) && <option value={selected}>Unavailable signal — repair</option>}{options.map(r => <option key={`${r.useId}|${r.signal}`} value={`${r.useId}|${r.signal}`}>{signalLabel(document, r)}</option>)}</select></label>;
}
