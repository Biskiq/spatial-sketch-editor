/**
 * P23.11 transient direct-manipulation pass — the lifecycle of a direct
 * architecture gesture (Junction move, rigid Wall move, curve-control move,
 * Bend), split out of the viewport so the contract is testable on its own and
 * no Svelte surface can quietly re-enter canonical acceptance per pointermove.
 *
 * The contract:
 *
 * ```
 * pointerdown   → capture the immutable canonical baseline + one transaction
 * pointermove   → derive a PROPOSAL from baseline + current intent, run the
 *                 cheap canonical preflight, render it transiently, install
 *                 nothing, write no history
 * pointerup     → one canonical planner call, full topology / Room / Opening /
 *                 portal / render-safe validation, compile, then either one
 *                 Layout history entry or an exact baseline
 * Escape/cancel → discard the proposal, the canonical baseline stays exact
 * ```
 *
 * Nothing here is an acceptance authority. The proposal runs the same core
 * chain algebra the planners run, without acceptance, and returns overlay
 * geometry only; the preflight is the single cheap canonical gate the planner
 * itself runs first (crossing / self-intersection / duplicate Junction /
 * zero-length / Room boundary structure), used for live feedback only. Every
 * acceptance decision still belongs to the release planner (see
 * `releaseArchitectureEdit`, which calls it at most once) — the preflight can
 * refute an attempt early but never accept one.
 */
import {
	preflightWallFirstArchitectureCandidate,
	proposeWallFirstArchitectureGeometry,
	type LayoutDocumentWallFirst,
	type WallFirstArchitecturePreflightFailure,
	type WallFirstArchitectureProposalIntent,
	type WallFirstArchitectureProposalWall
} from '@portfolio/layout-core';

import { p2311Measure } from '$lib/layout/layout-wall-first-precision';
import type { LayoutArchitectureEditGesture } from './layout-interaction';
import {
	layoutPreviewSnapshotMatchesLive,
	restoreLayoutPreviewSnapshot,
	type LayoutPreviewSnapshot,
	type LayoutPreviewState
} from './layout-preview-state.svelte';
import {
	architectureEditIntentFor,
	type LayoutArchitectureEditIntent,
	type TransientAttemptStatus
} from './plan-overlays';

export type { TransientAttemptStatus };

/**
 * The render-only attempt one pointermove is asking for.
 *
 * Gesture-local and transient by construction: it is created from the frozen
 * baseline plus the gesture's current candidate, handed to the Plan/3D render
 * surfaces, and dropped when the gesture ends. It is never installed into
 * `LayoutPreviewState.project.layout`, never persisted, and never inspected by
 * validation.
 */
export type LayoutTransientArchitectureEdit = {
	/**
	 * The attempted centerlines, sampled through the one core proposal adapter.
	 * `undefined` when the intent cannot be proposed at all (unknown Wall or
	 * knot, a non-finite point, an out-of-range bend distance) — the attempt
	 * still renders as its point marker.
	 */
	walls: readonly WallFirstArchitectureProposalWall[] | undefined;
	/**
	 * `known-invalid` when the cheap canonical preflight already refuted the
	 * attempt (or it could not be derived), `pending` otherwise. This is live
	 * feedback, never acceptance: the release planner decides.
	 */
	status: TransientAttemptStatus;
	/** The canonical issue behind a `known-invalid` status, when a gate found it. */
	failure?: WallFirstArchitecturePreflightFailure;
	/** The same attempt as the Plan overlay intent (style + candidate marker). */
	intent: LayoutArchitectureEditIntent;
};

/** The core proposal intent one gesture asks for, from its frozen values only. */
export function architectureEditProposalIntent(
	gesture: LayoutArchitectureEditGesture
): WallFirstArchitectureProposalIntent {
	if (gesture.kind === 'junction-move') {
		return {
			kind: 'junction-move',
			junctionId: gesture.junctionId,
			point: [gesture.candidatePoint[0], gesture.candidatePoint[1]]
		};
	}
	if (gesture.kind === 'wall-move') {
		return {
			kind: 'wall-move',
			wallId: gesture.wallId,
			delta: [gesture.candidateDelta[0], gesture.candidateDelta[1]]
		};
	}
	if (gesture.kind === 'wall-bend') {
		return {
			kind: 'wall-bend',
			wallId: gesture.wallId,
			distance: gesture.bendDistance,
			point: [gesture.candidatePoint[0], gesture.candidatePoint[1]]
		};
	}
	return {
		kind: 'curve-control-move',
		wallId: gesture.wallId,
		knotId: gesture.anchorId,
		point: [gesture.candidatePoint[0], gesture.candidatePoint[1]]
	};
}

/**
 * Derive the transient attempt for the gesture's **current** candidate.
 *
 * The caller must have installed the candidate on the gesture first
 * (`updateLayoutArchitectureEdit`), because the candidate is gesture state and
 * never proposal state — that is what keeps the drag's geometry derived from
 * the total displacement rather than from a remembered preview.
 *
 * Returns `null` when there is nothing to render: no gesture, the press is
 * still a plain click (below the shared drag threshold), or the baseline is not
 * a canonical wall-first document (a direct architecture edit can only start on
 * one, so this is a type narrowing, not a policy).
 */
export function transientArchitectureEdit(input: {
	gesture: LayoutArchitectureEditGesture | null;
	/** The frozen pointer-down baseline document — never the live preview. */
	baseline: LayoutDocumentWallFirst | null;
	moved: boolean;
}): LayoutTransientArchitectureEdit | null {
	const { gesture, baseline, moved } = input;
	if (!gesture || !baseline || !moved) return null;
	const coreIntent = architectureEditProposalIntent(gesture);
	const walls = p2311Measure('proposal-derive', () =>
		proposeWallFirstArchitectureGeometry(baseline, coreIntent)
	);
	// Only a derivable attempt can be refuted by a gate; an underivable one is
	// already known-invalid (the planner cannot accept an intent it cannot even
	// build), so a failed proposal skips the preflight entirely.
	const failure = walls === undefined
		? undefined
		: p2311Measure('preflight', () =>
				preflightWallFirstArchitectureCandidate(baseline, coreIntent)
			);
	const status: TransientAttemptStatus =
		walls === undefined || failure ? 'known-invalid' : 'pending';
	// A live gesture past the drag threshold is exactly the intent gate's own
	// precondition, so the attempt always renders: there is no "proposal exists
	// but nothing is drawn" state, which is what keeps the drag's feedback
	// independent of the release planner's verdict.
	const intent = architectureEditIntentFor(gesture, moved, walls, status);
	if (!intent) return null;
	return { walls, status, ...(failure ? { failure } : {}), intent };
}

/**
 * Reinstate the frozen baseline, unless the live preview already **is** that
 * baseline.
 *
 * A transient drag installs nothing, so the ordinary restore would be a full
 * reactive write (and project clone) of a document that never changed. The
 * guard is the history controller's own document comparison, so "already the
 * baseline" means exactly what it means everywhere else; a path that did
 * install still restores. Undo/Redo cannot see the difference: the snapshot is
 * a snapshot, and a skipped restore leaves it installed.
 */
export function restoreTransientArchitectureBaseline(
	preview: LayoutPreviewState,
	snapshot: LayoutPreviewSnapshot
): void {
	if (layoutPreviewSnapshotMatchesLive(preview, snapshot)) return;
	restoreLayoutPreviewSnapshot(preview, snapshot);
}

/** What one canonical planner call reports back to its caller. */
export type ArchitectureEditPlanResult = {
	success: boolean;
	message?: string;
	code?: string;
};

/**
 * The gesture's single release decision.
 *
 * `commit`/`cancel` are the caller's transaction lifecycles and `plan` is the
 * canonical planner — this function owns only the *order and the count*: at
 * most one planner call, exactly one of commit/cancel, and an exact baseline
 * whenever the planner refuses.
 */
export type ArchitectureEditReleaseInput = {
	gesture: LayoutArchitectureEditGesture | null;
	moved: boolean;
	/**
	 * The one canonical planner call for this release. Runs at most once, and
	 * never for a sub-threshold release (which is still a plain click).
	 */
	plan: () => ArchitectureEditPlanResult;
	/** Open the single Layout history entry for the gesture. */
	commit: () => boolean;
	/** Abandon the gesture's open transaction (no history entry). */
	cancel: () => void;
	/**
	 * Reinstate the frozen baseline. A no-op when the baseline is still the
	 * installed document, which is the ordinary transient path.
	 */
	restoreBaseline: () => void;
};

export type ArchitectureEditReleaseOutcome = {
	kind: 'committed' | 'rejected' | 'idle';
	/** The one status line to show, or `null` to leave the status alone. */
	statusMessage: string | null;
	/** A real drag's release must not also deliver the click it never was. */
	suppressNextClick: boolean;
};

/** The status line one accepted gesture reports, per gesture kind. */
function committedStatusMessage(gesture: LayoutArchitectureEditGesture): string {
	if (gesture.kind === 'junction-move') return 'Moved junction';
	if (gesture.kind === 'wall-move') return 'Moved wall';
	return 'Moved wall point';
}

export function releaseArchitectureEdit(
	input: ArchitectureEditReleaseInput
): ArchitectureEditReleaseOutcome {
	const { gesture, moved, plan, commit, cancel, restoreBaseline } = input;
	// A sub-threshold release is an ordinary click: the transaction opened at
	// pointer-down is closed and nothing is planned (the release position is
	// deliberately never resolved for it).
	if (!gesture || !moved) {
		cancel();
		restoreBaseline();
		return { kind: 'idle', statusMessage: null, suppressNextClick: false };
	}
	const result = plan();
	if (result.success) {
		const changed = commit();
		return {
			kind: 'committed',
			statusMessage: changed ? committedStatusMessage(gesture) : null,
			suppressNextClick: false
		};
	}
	cancel();
	restoreBaseline();
	return {
		kind: 'rejected',
		// A `no_op` release is not a rejection the user asked for: it stays
		// silent instead of reporting a failure nobody requested.
		statusMessage: result.code === 'no_op' ? null : result.message ?? null,
		suppressNextClick: true
	};
}
