// What the system says back: the reading of your stroke, the ripple of an edit, the hint line and toasts.
import { useState } from 'preact/hooks';
import { store, Txn } from '../store';
import { derive, elementName } from '../model/derive';
import { app } from './ctx';

// ------------------------------------------------------------------ reading chip
export function ReadingChip() {
  const chip = store.ui.readingChip;
  const t = store.top;
  if (!chip || !t?.readings || store.ui.mode !== 'make') return null;
  const cur = t.readingIndex ?? 0;
  const W = app.stage.el.clientWidth, H = app.stage.el.clientHeight;
  const est = 34 + t.readings.length * 42;
  const left = Math.min(chip.at[0] + 16, W - 260);
  // stay clear of the ripple card and dock at the bottom
  const top = Math.max(70, Math.min(chip.at[1] - 20, H - 250 - est));
  return (
    <div class="card reading" style={{ left: left + 'px', top: top + 'px' }}>
      <div class="lab">
        <span>Read as</span>
        {t.readings.length > 1 && <span>Tab to switch</span>}
      </div>
      {t.readings.map((r, i) => (
        <button class={i === cur ? 'on' : ''} onClick={() => store.amendReading(i)}>
          <b>{r.label}</b>
          {r.detail && <span>{r.detail}</span>}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ ripple card
type IssueSnap = { key: string; text: string; fixes: string[] };
const firstIssues = new Map<number, IssueSnap[]>();

function issuesOf(t: Txn): IssueSnap[] {
  if (!firstIssues.has(t.id) && t.fixes.length === 0) {
    const all = derive(t.result.after).issues;
    firstIssues.set(
      t.id,
      t.newIssues.map((k) => all.find((i) => i.key === k)).filter(Boolean).map((i) => ({ key: i!.key, text: i!.text, fixes: i!.fixes.map((f) => f.label) })),
    );
  }
  return firstIssues.get(t.id) ?? [];
}

export function Ripple() {
  const [all, setAll] = useState(0);
  const t = store.top;
  const ui = store.ui;
  if (!t || ui.rippleHidden === t.id || ui.mode !== 'make' || ui.dragging) return null;
  if (Date.now() - t.time > 1000 * 60 * 10) return null;
  const notes = t.result.notes;
  const decisions = t.result.decisions;
  const iss = issuesOf(t);
  if (!notes.length && !decisions.length && !iss.length) return null;
  const openNow = new Set(derive(store.project).issues.map((i) => i.key));
  const seen = new Set<string>();
  const rank = { warn: 0, good: 1, info: 2 } as const;
  const uniq = notes.filter((n) => (seen.has(n.text) ? false : (seen.add(n.text), true))).sort((a, b) => rank[a.kind] - rank[b.kind]);
  const FOLD = 4;
  const open = all === t.id;
  const shown = open ? uniq : uniq.slice(0, FOLD);
  return (
    <div class="card ripple" onPointerDown={(e) => e.stopPropagation()}>
      <div class="head">
        <div class="t">
          {t.label}
          <small>what happened</small>
        </div>
        <button class="btn small outline" title="Refuse the whole edit — one step back" onClick={() => store.undo()}>
          Put it back
        </button>
        <button class="btn small" onClick={() => store.set({ rippleHidden: t.id })}>
          OK
        </button>
      </div>
      <ul>
        {decisions.map((d) => (
          <li class="good">
            <i class="dot" />
            <div>
              {d.text}
              <div class="opts">
                {d.options.map((o) => (
                  <button class={'chip' + (d.chosen === o.id ? ' on' : '')} onClick={() => store.amendChoice(d.key, o.id)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </li>
        ))}
        {iss.map((i) => {
          const chosen = t.fixes.find((f) => f.key === i.key);
          const open = openNow.has(i.key);
          return (
            <li class={open ? 'issue' : 'good'}>
              <i class="dot" />
              <div>
                {i.text}
                {!open && chosen && <span class="note"> — repaired: {i.fixes[chosen.fix]?.toLowerCase()}.</span>}
                {!open && !chosen && <span class="note"> — resolved by your choice above.</span>}
                <div class="opts" style={!open && !chosen ? { display: 'none' } : undefined}>
                  {i.fixes.map((f, k) => (
                    <button class={'chip' + (chosen?.fix === k ? ' on' : ' red')} onClick={() => store.amendFix(i.key, chosen?.fix === k ? null : k)}>
                      {f}
                    </button>
                  ))}
                  <button class={'chip pencil' + (!chosen ? ' on' : '')} title="It stays on the loose-ends list" onClick={() => store.amendFix(i.key, null)}>
                    Leave it for now
                  </button>
                </div>
              </div>
            </li>
          );
        })}
        {shown.map((n) => (
          <li class={n.kind}>
            <i class="dot" />
            <div>{n.text}</div>
          </li>
        ))}
        {uniq.length > FOLD && (
          <li>
            <button class="btn small" onClick={() => setAll(open ? 0 : t.id)}>
              {open ? 'Fewer' : `${uniq.length - FOLD} more things moved with it…`}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ hint line
export function Hint() {
  const ui = store.ui;
  const p = store.project;
  if (ui.mode === 'visit' || ui.start) return null;
  let h: any = null;
  const v = store.view;
  if (ui.mode === 'tell') {
    if (p.story.route.length < 2) h = <><b>Draw the walk.</b> Drag a path through the building the way a visitor would move. It climbs stairs by itself.</>;
    else if (ui.tool === 'moment') h = <><b>Click on the walk</b> where something should be said or shown.</>;
    else if (ui.tool === 'aim') h = <><b>Click what the visitor should look at.</b></>;
    else h = <>Beads on the walk are <b>moments</b>. Give each a line, a target and a reveal — then <b>Play as visitor</b>.</>;
  } else if (ui.tool === 'slice') h = <><b>Draw a line</b> across the building. The side nearest you is cut away. Esc returns.</>;
  else if (ui.tool === 'place') h = <><b>Click a floor</b> to place. Things always belong to a surface — drag them later, even between levels.</>;
  else if (!p.runs.length && !p.overheads.length) h = <><b>Drag on the table to draw a wall.</b> Close a loop and a room appears. A circle makes one round wall. The chip by your pen says what it read — press Tab to change it.</>;
  else if (v.sheetOut && ui.tool === 'pen') h = <>Drawing on the sheet at <b>{v.sheetY.toFixed(2)} m</b>. A closed shape over rooms is a roof; inside a room it's a mezzanine; a line between floors is a bridge.{store.ui.sheetPen ? <> Esc puts the sheet away · V to select.</> : null}</>;
  else if (ui.tool === 'select' && !ui.selection) h = <><b>Select</b> — click to pick, drag to turn the table. Nothing is drawn. Press <b>D</b> (or Draw) to draw.</>;
  else if (ui.selection && ui.tool === 'pen') h = <>Drawing. To shape {ui.selection === 'building' ? 'the whole building' : elementName(p, ui.selection)} with its <b style={{ color: 'var(--blue)' }}>blue handles</b>, press <b>V</b> (Select).</>;
  else if (ui.selection) h = <>Drag the <b style={{ color: 'var(--blue)' }}>blue handles</b> to shape {ui.selection === 'building' ? 'the whole building' : elementName(p, ui.selection)}. Hover <b>Remove</b> to see what leans on it first.</>;
  else if (store.past.length < 6) h = <>Draw on a wall's face for a door or arch · between two floors for a stair · pull <b>the sheet</b> up (right) to draw in the air. Right-drag or two-finger scroll turns the table.</>;
  if (!h) return null;
  return <div class="hint">{h}</div>;
}

export function Toast() {
  const t = store.ui.toast;
  if (!t) return null;
  return <div class="toast">{t}</div>;
}
