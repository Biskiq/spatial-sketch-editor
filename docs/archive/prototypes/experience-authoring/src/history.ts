import type { Document } from './model';
export type HistoryState = { doc: Document; past: Document[]; future: Document[]; key: string | null; at: number };
const WINDOW_MS = 800;
export function emptyHistory(doc: Document): HistoryState { return { doc, past: [], future: [], key: null, at: 0 }; }
/** A continuous gesture (drag, typing burst) sharing one coalesce key becomes a single undo step. */
export function pushEdit(state: HistoryState, next: Document, key: string | null, now: number): HistoryState {
  const merge = !!key && state.key === key && now - state.at < WINDOW_MS;
  return { doc: next, past: merge ? state.past : [...state.past.slice(-39), state.doc], future: [], key: key ?? null, at: now };
}
export function undo(state: HistoryState): HistoryState {
  const previous = state.past.at(-1); if (!previous) return state;
  return { doc: previous, past: state.past.slice(0, -1), future: [state.doc, ...state.future], key: null, at: 0 };
}
export function redo(state: HistoryState): HistoryState {
  const next = state.future[0]; if (!next) return state;
  return { doc: next, past: [...state.past, state.doc], future: state.future.slice(1), key: null, at: 0 };
}
