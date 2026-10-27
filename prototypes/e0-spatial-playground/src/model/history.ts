// Snapshot history: every accepted edit is one step. Experiment convenience, not a production design.
import type { E0Document } from './types';

export interface History {
  past: E0Document[];
  present: E0Document;
  future: E0Document[];
}

export const startHistory = (doc: E0Document): History => ({ past: [], present: doc, future: [] });

export const commit = (h: History, doc: E0Document): History => ({ past: [...h.past, h.present], present: doc, future: [] });

export const undo = (h: History): History =>
  h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h;

export const redo = (h: History): History =>
  h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h;
