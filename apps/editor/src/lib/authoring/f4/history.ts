/**
 * The editor-only authoring history: **one** bounded chronological stack of
 * accepted source states (AM-4; T1.P01.S03 plan §Scope).
 *
 * Three things this is deliberately not:
 *
 * - it is not a second source of truth. A state is captured *after* acceptance
 *   and is immutable; the current state is whatever the coordinator installed,
 *   and the stack is only the ordering that makes Undo/Redo possible.
 * - it is not an operation log. Undo restores the previous **state**, which is
 *   exactly why `AM-4`'s "undo back to earlier contents is a new acceptance of
 *   the same content" holds without replaying a domain inverse.
 * - it is not reachable from the visitor. This module is `lib/authoring/**`,
 *   editor-only, and never enters a package barrel (see
 *   `../README.md` and the F4 public-isolation proof).
 *
 * Bounds and lifetime (all tested): 100 entries; a new accepted state truncates
 * the redo branch; a no-op, refusal or cancel adds **no** entry because it never
 * reaches this class; and project replacement starts a new baseline rather than
 * leaving old states reachable.
 */

import type { AdmissionIssue, CorrespondenceEntry } from '@portfolio/project-model';

/** AM-4's bounded depth. Not a tuning knob: the acceptance record names it. */
export const AUTHORING_HISTORY_LIMIT = 100;

/**
 * One captured accepted state. No revision here on purpose: a revision names an
 * *acceptance* and is minted fresh on every install — including the install an
 * Undo performs — while this state is the **content** that was accepted, so the
 * same state can legitimately be published under more than one revision.
 */
export type HistoryState<Source> = {
	readonly source: Source;
	readonly canonicalJson: string;
	readonly sourceContentId: string;
	/** The operation that first produced this state (`session-boot` for the baseline). */
	readonly operationId: string;
	/** Blocking issues this state carries; restoration is validated against the live baseline. */
	readonly blockingIssues: readonly AdmissionIssue[];
	readonly correspondence: readonly CorrespondenceEntry[];
};

export class AuthoringHistory<Source> {
	readonly #limit: number;
	#states: HistoryState<Source>[];
	#cursor = 0;

	constructor(initial: HistoryState<Source>, limit: number = AUTHORING_HISTORY_LIMIT) {
		if (!Number.isInteger(limit) || limit < 2 || limit > AUTHORING_HISTORY_LIMIT) {
			throw new RangeError(`History limit must be an integer from 2 to 100, received ${String(limit)}`);
		}
		this.#limit = limit;
		this.#states = [initial];
	}

	get limit(): number {
		return this.#limit;
	}

	/** Entries currently held (≤ `limit`), counting the redo branch. */
	get depth(): number {
		return this.#states.length;
	}

	/** Position of the current state: `depth - 1` after a push, lower after Undo. */
	get position(): number {
		return this.#cursor;
	}

	get current(): HistoryState<Source> {
		return this.#states[this.#cursor]!;
	}

	/** A read-only copy used by the coordinator's non-history metadata adoption seam. */
	states(): readonly HistoryState<Source>[] {
		return this.#states.slice();
	}

	/** Replace equivalent metadata on every retained state without moving the cursor. */
	rebaseStates(states: readonly HistoryState<Source>[]): void {
		if (states.length < 1 || states.length > this.#limit) {
			throw new RangeError(`History must retain between 1 and ${this.#limit} states`);
		}
		if (this.#cursor >= states.length) throw new RangeError('History cursor is outside the retained states');
		this.#states = [...states];
	}

	canUndo(): boolean {
		return this.#cursor > 0;
	}

	canRedo(): boolean {
		return this.#cursor < this.#states.length - 1;
	}

	/**
	 * Record one newly accepted state.
	 *
	 * A new edit is a new future: everything above the cursor was a redo branch
	 * that can no longer be reached, so it is truncated. Beyond the bound the
	 * **oldest** entries fall away — the stack stays chronological and bounded,
	 * and the newest state is always the current one.
	 */
	push(state: HistoryState<Source>): void {
		this.#states = this.#states.slice(0, this.#cursor + 1);
		this.#states.push(state);
		this.#cursor = this.#states.length - 1;
		if (this.#states.length > this.#limit) {
			this.#states = this.#states.slice(this.#states.length - this.#limit);
			this.#cursor = this.#states.length - 1;
		}
	}

	/** Inspect without moving: validation and freshness checks precede cursor changes. */
	peek(direction: 'undo' | 'redo'): HistoryState<Source> | null {
		const index = this.#cursor + (direction === 'undo' ? -1 : 1);
		return this.#states[index] ?? null;
	}

	/** Move one state back, or `null` when there is nothing to undo. No entry is added. */
	undo(): HistoryState<Source> | null {
		if (!this.canUndo()) return null;
		this.#cursor -= 1;
		return this.current;
	}

	/** Move one state forward, or `null` when there is nothing to redo. */
	redo(): HistoryState<Source> | null {
		if (!this.canRedo()) return null;
		this.#cursor += 1;
		return this.current;
	}

	/**
	 * Start a new baseline: project replacement makes every earlier state
	 * unreachable (no ordinary Undo crosses a source replacement, AM-4 §Source
	 * replacement) and leaves exactly one entry.
	 */
	replaceBaseline(state: HistoryState<Source>): void {
		this.#states = [state];
		this.#cursor = 0;
	}
}
