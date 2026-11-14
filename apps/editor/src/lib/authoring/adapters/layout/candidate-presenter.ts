/**
 * E4 / G1 step 1 — Layout candidate presentation, once per distinct candidate.
 *
 * One presenter per live Layout binding: created in `bind`, reset by the
 * binding's terminators and dropped with it on every accepted install (rebase).
 * The Stage reads `candidatePreviews()` every frame; with a still pointer the
 * candidate is the same object every frame, so its Paper is built once and read
 * back thereafter.
 *
 * Two one-entry slots, keyed only by identities and values of current state, so
 * a hit can never be stale:
 *
 * - **presentation** — the built drawing for (reading, candidate document
 *   identity, live Plan evaluation identity, datum, subject/affected id-set
 *   contents) or, for a refused Opening attempt, (accepted document identity,
 *   Wall, raw typed values);
 * - **proposal** — a planner result the binding would otherwise recompute every
 *   frame (Opening Repeat, Circle), keyed by its inputs. The memo pins a
 *   proposal's minted preview ids for its lifetime; a commit plans for itself.
 *
 * Each frame drops a slot it did not consult, so a gesture's end or cancel
 * releases its entry on the next frame. Conversion stays in
 * `candidate-preview.ts`; compiled geometry comes from the adapter's
 * project-epoch compile context. Not a cache authority: a cold rebuild is equal,
 * which the memo-bypass seam below lets a test prove.
 */
import { countWork, type CompiledLayoutGeometry, type LayoutDocumentWallFirst, type PlanEvaluation } from '@portfolio/layout-core';

import type { LayoutCompileContext } from './compile-context';
import {
	buildCompiledLayoutCandidatePaper,
	openingAttemptFacePaper,
	openingAttemptPlanPaper,
	openingFacePaper,
	type CandidatePaperGeometry,
	type LayoutCandidatePaper,
	type OpeningGhostValues
} from './candidate-preview';

type Key = readonly unknown[];
type Slot = { readonly key: Key; readonly value: unknown; consulted: boolean };

let bypassForTest = false;

/** Test seam: build every read cold, so a memoised result can be compared with an un-memoised one. */
export function setCandidateMemoBypassForTest(bypass: boolean): void {
	bypassForTest = bypass;
}

function sameKey(a: Key, b: Key): boolean {
	return a.length === b.length && a.every((part, index) => Object.is(part, b[index]));
}

function idsKey(ids: ReadonlySet<string>): string {
	return [...ids].sort().join('\u0000');
}

export type LayoutCandidatePresenter = {
	/** Begin one `candidatePreviews` frame. */
	beginFrame(): void;
	/** End the frame: release every slot this frame did not consult. */
	endFrame(): void;
	/** The filtered Paper for one candidate document under the live Plan evaluation. */
	paper(
		document: LayoutDocumentWallFirst,
		plan: PlanEvaluation,
		datumMeters: number,
		subjectIds: ReadonlySet<string>,
		affectedIds: ReadonlySet<string>
	): LayoutCandidatePaper;
	/** The candidate Openings' compiled profile outlines on both Wall faces. */
	face(document: LayoutDocumentWallFirst, openingIds: ReadonlySet<string>, datumMeters: number): CandidatePaperGeometry;
	/** A refused Opening attempt at its raw values, in the Plan or the 3D reading. */
	attempt(
		reading: 'plan' | 'face',
		accepted: LayoutDocumentWallFirst,
		wallId: string,
		values: OpeningGhostValues,
		datumMeters: number
	): CandidatePaperGeometry;
	/** A planner proposal keyed by its inputs; `compute` runs on a miss only. */
	proposal<T>(key: Key, compute: () => T): T;
	/** Release both slots (gesture end, task close, binding dispose). */
	reset(): void;
	/** Entries currently held (0–2), for release proofs. */
	held(): number;
};

export function createLayoutCandidatePresenter(context: LayoutCompileContext): LayoutCandidatePresenter {
	let presentation: Slot | null = null;
	let proposal: Slot | null = null;

	const compiled = (document: LayoutDocumentWallFirst): CompiledLayoutGeometry => context.compiled(document).geometry;

	function present<T>(key: Key, build: () => T): T {
		if (bypassForTest) return build();
		if (presentation !== null && sameKey(presentation.key, key)) {
			presentation.consulted = true;
			return presentation.value as T;
		}
		const value = build();
		presentation = { key, value, consulted: true };
		return value;
	}

	return {
		beginFrame() {
			if (presentation !== null) presentation.consulted = false;
			if (proposal !== null) proposal.consulted = false;
		},
		endFrame() {
			if (presentation !== null && !presentation.consulted) presentation = null;
			if (proposal !== null && !proposal.consulted) proposal = null;
		},
		paper(document, plan, datumMeters, subjectIds, affectedIds) {
			return present(['plan', document, plan, datumMeters, idsKey(subjectIds), idsKey(affectedIds)], () =>
				buildCompiledLayoutCandidatePaper(compiled(document), plan, datumMeters, subjectIds, affectedIds)
			);
		},
		face(document, openingIds, datumMeters) {
			return present(['face', document, datumMeters, idsKey(openingIds)], () =>
				openingFacePaper(compiled(document), openingIds, datumMeters)
			);
		},
		attempt(reading, accepted, wallId, values, datumMeters) {
			return present(
				[
					`attempt-${reading}`, accepted, wallId, datumMeters,
					values.kind, values.profile, values.offset, values.width, values.height, values.sillHeight
				],
				() =>
					reading === 'plan'
						? openingAttemptPlanPaper(compiled(accepted), wallId, values, datumMeters)
						: openingAttemptFacePaper(compiled(accepted), wallId, values, datumMeters)
			);
		},
		proposal<T>(key: Key, compute: () => T): T {
			const plan = (): T => {
				countWork('candidate:proposal-plan');
				return compute();
			};
			if (bypassForTest) return plan();
			if (proposal !== null && sameKey(proposal.key, key)) {
				proposal.consulted = true;
				return proposal.value as T;
			}
			const value = plan();
			proposal = { key, value, consulted: true };
			return value;
		},
		reset() {
			presentation = null;
			proposal = null;
		},
		held: () => (presentation === null ? 0 : 1) + (proposal === null ? 0 : 1)
	};
}
