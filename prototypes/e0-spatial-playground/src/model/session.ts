// Accepted document + snapshot history + one editable draft. Framework-free so it can be tested directly.
import { evaluate } from './evaluate';
import { commit, redo, startHistory, undo, type History } from './history';
import type { E0Document } from './types';

export interface Draft {
  doc: E0Document;
  label: string;
  /** Why the draft cannot be accepted yet; null when it can. */
  error: string | null;
}

export class Session {
  history: History;
  draft: Draft | null = null;
  /** Bumped whenever in-flight gestures must be abandoned (Undo, Redo, Open, Reset, path switch). */
  epoch = 0;
  private listeners = new Set<() => void>();

  constructor(doc: E0Document) {
    this.history = startHistory(doc);
  }

  get doc() {
    return this.history.present;
  }
  get shown() {
    return this.draft?.doc ?? this.history.present;
  }
  get canUndo() {
    return this.history.past.length > 0;
  }
  get canRedo() {
    return this.history.future.length > 0;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private changed() {
    this.listeners.forEach((fn) => fn());
  }

  /** Show a candidate with the same evaluator that acceptance uses. */
  preview(doc: E0Document, label: string, epoch = this.epoch): Draft | null {
    if (epoch !== this.epoch) return null;
    const errors = evaluate(doc).errors;
    this.draft = { doc, label, error: errors[0]?.message ?? null };
    this.changed();
    return this.draft;
  }

  /** Accept the current draft as one history step. A rejected draft stays editable; history is untouched. */
  commitDraft(epoch = this.epoch): boolean {
    if (epoch !== this.epoch || !this.draft || this.draft.error) {
      this.changed();
      return false;
    }
    this.history = commit(this.history, this.draft.doc);
    this.draft = null;
    this.changed();
    return true;
  }

  apply(doc: E0Document, label: string): boolean {
    this.preview(doc, label);
    return this.commitDraft();
  }

  cancel() {
    this.draft = null;
    this.changed();
  }

  /** Abandon gestures in flight so a late pointer-up cannot commit an obsolete draft. */
  interrupt() {
    this.epoch++;
    this.draft = null;
  }

  /** With an open draft, Undo discards only the draft; otherwise it steps back one accepted edit. */
  undo() {
    const hadDraft = !!this.draft;
    this.interrupt();
    if (!hadDraft) this.history = undo(this.history);
    this.changed();
  }

  redo() {
    this.interrupt();
    this.history = redo(this.history);
    this.changed();
  }

  /** Open/Reset: explicit document replacement with fresh history, not an Undo step. */
  replace(doc: E0Document) {
    this.interrupt();
    this.history = startHistory(doc);
    this.changed();
  }
}
