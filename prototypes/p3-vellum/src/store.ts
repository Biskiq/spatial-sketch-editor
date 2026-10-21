// App state: the project with its undo history, the view (which has its own "back" history), and UI state.
import type { Project, ObjType } from './model/types';
import type { V2 as V2Tuple } from './model/geom2d';
import { emptyProject, clone } from './model/types';
import { runTxn, Op, Choices, TxnResult, Decision } from './model/ops';
import { derive, Issue } from './model/derive';
import type { Reading } from './model/readings';
import type { Note } from './model/settle';
import { settle } from './model/settle';

export interface Txn {
  id: number;
  label: string;
  before: Project;
  op: Op;
  choices: Choices;
  fixes: { key: string; fix: number }[];
  result: TxnResult;
  newIssues: string[];
  readings?: Reading[];
  readingIndex?: number;
  time: number;
}

export interface CamSnap {
  target: [number, number, number];
  az: number;
  pol: number;
  dist: number;
  mode: 'orbit' | 'eye';
}

export interface ViewState {
  sheetOut: boolean;
  sheetY: number;
  cutMode: 'ghost' | 'cut';
  liftPinned: boolean;
  liftHeld: boolean;
  slice: { a: V2Tuple; b: V2Tuple } | null;
  isolate: string | null;
  /** Focus Height (an experiment): only the band from this height to the next floor above is solid; the rest ghosts */
  focusY: number | null;
}

export type Mode = 'make' | 'tell' | 'visit';
/** 'select' picks, shapes and turns the table and never draws; 'pen' draws (in Tell: the visitor's walk). */
export type Tool = 'select' | 'pen' | 'slice' | 'place' | 'aim' | 'moment';
export type BaseTool = 'select' | 'pen';

export interface UIState {
  mode: Mode;
  tool: Tool;
  /** the Make tool that Slice, Place and Esc return to */
  baseTool: BaseTool;
  placeType: ObjType | null;
  selection: string | null; // element id, or 'building'
  hover: string | null;
  panel: 'none' | 'truth' | 'help' | 'history' | 'tray' | 'issues' | 'story';
  start: boolean;
  people: boolean;
  removePreview: string[] | null;
  fixPreview: { key: string; fix: number } | null;
  issueFocus: string | null;
  readingChip: { at: [number, number] } | null;
  rippleHidden: number; // txn id the creator dismissed
  hint: string | null;
  momentFocus: string | null;
  toast: string | null;
  dragging: boolean;
  /** show every handle, not just the few that matter (session only) */
  allHandles: boolean;
  /** the sheet came out while selecting, so the pen was picked up for it; putting the sheet away puts it down */
  sheetPen: boolean;
}

type Listener = () => void;

const LS_KEY = 'vellum:project';
const LS_RECENT = 'vellum:recent';

class Store {
  base: Project = emptyProject();
  past: Txn[] = [];
  future: Txn[] = [];
  preview: Project | null = null;
  previewNotes: Note[] = [];
  view: ViewState = { sheetOut: false, sheetY: 0, cutMode: 'ghost', liftPinned: false, liftHeld: false, slice: null, isolate: null, focusY: null };
  viewStack: { view: ViewState; cam: CamSnap | null; label: string }[] = [];
  ui: UIState = {
    mode: 'make', tool: 'pen', baseTool: 'pen', placeType: null, selection: null, hover: null, panel: 'none', start: true, people: true,
    removePreview: null, fixPreview: null, issueFocus: null, readingChip: null, rippleHidden: -1, hint: null, momentFocus: null, toast: null, dragging: false, allHandles: false, sheetPen: false,
  };
  cam: { snap: () => CamSnap; restore: (s: CamSnap) => void } | null = null;
  private listeners = new Set<Listener>();
  private nextTxn = 1;
  private saveTimer: any = null;
  version = 0;
  /** Whole-building scale handle: scale heights too, or plan only. */
  scaleHeights = false;

  get project(): Project {
    return this.past.length ? this.past[this.past.length - 1].result.after : this.base;
  }
  /** What the scene shows: a live preview while dragging, otherwise the project. */
  get shown(): Project {
    return this.preview ?? this.project;
  }
  get top(): Txn | null {
    return this.past.length ? this.past[this.past.length - 1] : null;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    this.syncSheetPen();
    this.version++;
    for (const l of this.listeners) l();
  }

  /** The sheet is paper: raising it while selecting picks up the pen (the dock shows it); putting it away puts it down. */
  private sheetWas = false;
  private syncSheetPen() {
    const out = this.view.sheetOut;
    if (out === this.sheetWas) return;
    this.sheetWas = out;
    if (out && this.ui.mode === 'make' && this.ui.tool === 'select') this.ui = { ...this.ui, tool: 'pen', sheetPen: true };
    else if (!out && this.ui.sheetPen) this.ui = { ...this.ui, tool: this.ui.mode === 'make' && this.ui.tool === 'pen' ? 'select' : this.ui.tool, sheetPen: false };
  }

  // ---------------------------------------------------------------- history
  private issueKeys(p: Project) {
    return new Set(derive(p).issues.filter((i) => !i.acknowledged).map((i) => i.key));
  }

  commit(label: string, op: Op, opts: { readings?: Reading[]; readingIndex?: number; choices?: Choices } = {}): Txn {
    const before = this.project;
    const choices = opts.choices ?? {};
    const result = runTxn(before, op, choices);
    const pre = this.issueKeys(before);
    const newIssues = [...this.issueKeys(result.after)].filter((k) => !pre.has(k));
    const txn: Txn = { id: this.nextTxn++, label, before, op, choices, fixes: [], result, newIssues, readings: opts.readings, readingIndex: opts.readingIndex, time: Date.now() };
    this.past.push(txn);
    this.future = [];
    this.ui.readingChip = null;
    this.preview = null;
    this.previewNotes = [];
    if (result.select !== undefined) this.ui.selection = result.select;
    this.validateSelection();
    this.save();
    this.emit();
    return txn;
  }

  private rerun(t: Txn) {
    t.result = runTxn(t.before, t.op, t.choices, t.fixes);
    const pre = this.issueKeys(t.before);
    t.newIssues = [...this.issueKeys(t.result.after)].filter((k) => !pre.has(k));
    this.validateSelection();
    this.save();
    this.emit();
  }

  amendChoice(key: string, value: string) {
    const t = this.top;
    if (!t) return;
    t.choices = { ...t.choices, [key]: value };
    this.rerun(t);
  }

  /** Choose (or un-choose) a repair for a loose end this edit created — it becomes part of the same step. */
  amendFix(key: string, fix: number | null) {
    const t = this.top;
    if (!t) return;
    t.fixes = t.fixes.filter((f) => f.key !== key);
    if (fix !== null) t.fixes.push({ key, fix });
    this.rerun(t);
  }

  amendReading(index: number) {
    const t = this.top;
    if (!t || !t.readings || !t.readings[index]) return;
    t.readingIndex = index;
    t.op = t.readings[index].op;
    t.label = t.readings[index].label;
    t.choices = {};
    t.fixes = [];
    this.rerun(t);
    if (t.result.select !== undefined) this.ui.selection = t.result.select;
    this.emit();
  }

  undo() {
    const t = this.past.pop();
    if (!t) return;
    this.future.push(t);
    this.preview = null;
    this.ui.readingChip = null;
    this.validateSelection();
    this.toast(`Undid: ${t.label}`);
    this.save();
    this.emit();
  }

  redo() {
    const t = this.future.pop();
    if (!t) return;
    // re-run against the current project in case of drift
    this.past.push(t);
    this.validateSelection();
    this.toast(`Redid: ${t.label}`);
    this.save();
    this.emit();
  }

  jumpTo(txnId: number) {
    while (this.top && this.top.id !== txnId) {
      const t = this.past.pop()!;
      this.future.push(t);
    }
    this.validateSelection();
    this.save();
    this.emit();
  }

  setPreview(op: Op | null) {
    if (!op) {
      this.preview = null;
      this.previewNotes = [];
    } else {
      const r = runTxn(this.project, op);
      this.preview = r.after;
      this.previewNotes = r.notes;
    }
    this.emit();
  }

  load(p: Project, opts: { keepHistory?: boolean } = {}) {
    const q = clone(p);
    settle(q);
    this.base = q;
    this.past = [];
    this.future = [];
    this.preview = null;
    this.ui.selection = null;
    this.ui.readingChip = null;
    this.ui.start = false;
    // a fresh table invites drawing; a building you open is first looked at, so nothing is drawn by accident
    const base: BaseTool = q.runs.length || q.imported || q.overheads.length ? 'select' : 'pen';
    this.ui.baseTool = base;
    if (this.ui.mode === 'make') this.ui.tool = base;
    this.view = { sheetOut: false, sheetY: 0, cutMode: 'ghost', liftPinned: false, liftHeld: false, slice: null, isolate: null, focusY: null };
    this.viewStack = [];
    this.save();
    this.emit();
  }

  private validateSelection() {
    const s = this.ui.selection;
    if (!s || s === 'building') return;
    const p = this.project;
    const all = [p.runs, p.openings, p.rooms.filter((r) => !r.dormant), p.overheads, p.decks, p.voids, p.stairs, p.posts, p.objs] as { id: string }[][];
    if (!all.some((c) => c.some((e) => e.id === s))) this.ui.selection = null;
  }

  // ---------------------------------------------------------------- view (temporary; never touches the building)
  get peeking() {
    const v = this.view;
    return v.sheetOut || v.liftPinned || v.liftHeld || !!v.slice || !!v.isolate || v.focusY !== null;
  }

  peekLabel(): string {
    const v = this.view;
    const parts: string[] = [];
    if (v.liftHeld || v.liftPinned) parts.push('lifted apart');
    if (v.focusY !== null) parts.push(`focus height ${v.focusY.toFixed(2)} m`);
    else if (v.sheetOut) parts.push(v.cutMode === 'cut' ? `cut at ${(v.sheetY + 1.3).toFixed(1)} m` : `x-ray above ${v.sheetY.toFixed(1)} m`);
    if (v.slice) parts.push('sliced');
    if (v.isolate) parts.push('one thing isolated');
    return parts.join(' · ');
  }

  pushView(label: string) {
    this.viewStack.push({ view: { ...this.view }, cam: this.cam?.snap() ?? null, label });
    if (this.viewStack.length > 30) this.viewStack.shift();
  }

  // A peek gesture (a slice being drawn) previews live without touching history: it remembers where you were
  // when it began, adds exactly one "back" step if you let go on it, and puts everything back if you cancel.
  private peekSnap: { view: ViewState; cam: CamSnap | null; label: string } | null = null;
  beginPeek(label: string) {
    this.peekSnap = { view: { ...this.view }, cam: this.cam?.snap() ?? null, label };
  }
  updatePeek(patch: Partial<ViewState>) {
    this.view = { ...this.view, ...patch };
    this.emit();
  }
  commitPeek() {
    if (!this.peekSnap) return;
    this.viewStack.push(this.peekSnap);
    if (this.viewStack.length > 30) this.viewStack.shift();
    this.peekSnap = null;
    this.emit();
  }
  cancelPeek() {
    const s = this.peekSnap;
    if (!s) return;
    this.peekSnap = null;
    this.view = { ...s.view, liftHeld: false };
    if (s.cam && this.cam) this.cam.restore(s.cam);
    this.emit();
  }
  /** Keep the other side of the slice. A view change only: the building and both histories are untouched. */
  flipSlice() {
    const sl = this.view.slice;
    if (sl) this.updatePeek({ slice: { a: sl.b, b: sl.a } });
  }

  setView(patch: Partial<ViewState>, remember?: string) {
    if (remember) this.pushView(remember);
    this.view = { ...this.view, ...patch };
    this.emit();
  }

  /** Esc: return to exactly where you were. */
  back(): boolean {
    const s = this.viewStack.pop();
    if (s) {
      this.view = { ...s.view, liftHeld: false };
      if (s.cam && this.cam) this.cam.restore(s.cam);
      this.emit();
      return true;
    }
    if (this.peeking) {
      this.view = { ...this.view, sheetOut: false, liftPinned: false, liftHeld: false, slice: null, isolate: null, focusY: null };
      this.emit();
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- ui
  set(patch: Partial<UIState>) {
    // choosing a tool by hand ends the sheet's borrowed pen
    this.ui = { ...this.ui, ...('tool' in patch ? { sheetPen: false } : {}), ...patch };
    this.emit();
  }

  select(id: string | null) {
    this.ui = { ...this.ui, selection: id, removePreview: null, fixPreview: null };
    this.emit();
  }

  private toastTimer: any = null;
  toast(msg: string) {
    this.ui.toast = msg;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.ui.toast = null;
      this.emit();
    }, 1800);
  }

  issues(): Issue[] {
    return derive(this.project).issues;
  }

  // ---------------------------------------------------------------- persistence (real: this browser only)
  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        const p = this.project;
        localStorage.setItem(LS_KEY, JSON.stringify(p));
        const rec = JSON.parse(localStorage.getItem(LS_RECENT) || '[]') as { id: string; name: string; at: number }[];
        const next = [{ id: p.id, name: p.name, at: Date.now() }, ...rec.filter((r) => r.id !== p.id)].slice(0, 8);
        localStorage.setItem(LS_RECENT, JSON.stringify(next));
        localStorage.setItem(`vellum:p:${p.id}`, JSON.stringify(p));
      } catch {}
    }, 300);
  }

  restore(): boolean {
    try {
      const s = localStorage.getItem(LS_KEY);
      if (!s) return false;
      const p = JSON.parse(s) as Project;
      if (p.v !== 1) return false;
      this.load(p);
      return true;
    } catch {
      return false;
    }
  }

  recent(): { id: string; name: string; at: number }[] {
    try {
      return JSON.parse(localStorage.getItem(LS_RECENT) || '[]');
    } catch {
      return [];
    }
  }

  openRecent(id: string) {
    try {
      const s = localStorage.getItem(`vellum:p:${id}`);
      if (s) this.load(JSON.parse(s));
    } catch {}
  }
}

export const store = new Store();
(globalThis as any).__vellum = store;
