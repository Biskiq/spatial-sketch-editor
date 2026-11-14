/**
 * The Stage's Camera **inspection session**: one output, one controller, one
 * evaluator — the host half of `T1.viewport-projection@1`.
 *
 * This module owns no pose mathematics. Every realized matrix comes back out of
 * `evaluateViewport`; the session only holds the session state, the current
 * evaluation, the evaluation generation and the landed F.3 Camera-output ticket
 * claim. That split is the invariant the seam names: the renderer realizes
 * evaluated output and never computes its own, and no shell tween or second affine
 * transform exists anywhere.
 *
 * **Ownership is the landed ticket protocol's job.** The session drives
 * `@portfolio/project-model`'s `camera-output` acquire/replace/return/cancel
 * against the current session and source identities, and passes camera-core
 * exactly the `outputId`/`sessionEpoch`/`sourceRevision` that ticket was qualified
 * for — there is no translation table and no host-minted ticket.
 *
 * **Preview is a handoff, not an unmount (T3.P02.S02).** Entering the isolated
 * visitor Preview transfers this one output through the protocol's ordered
 * handoff (`role: 'preview'`) and issues the Camera-owned return token. While the
 * Preview holds it the inspection ticket is `null`, so no Stage intent can be
 * presented against an output this run no longer owns; leaving Preview returns
 * the output to the inspection run, which continues under a strictly newer epoch.
 * A source change ends both claims and voids the return, exactly as the landed
 * rebase says.
 *
 * Editor machinery is absent: no Svelte, no Three, no DOM.
 */
import {
	advanceViewport,
	aimPoseAlongRay,
	createViewportCameraState,
	evaluateViewport,
	eyeOfInspectionPose,
	fovYDegreesOf,
	rebaseViewportSource,
	requestViewingIntent,
	type InspectionPose,
	type PointerRay,
	type ViewingIntent,
	type ViewingIntentResult,
	type ViewportCameraState,
	type ViewportEvaluation,
	type ViewportEvaluationResult,
	type ViewportRect,
	type ViewportSourceRebase
} from '@portfolio/camera-core';
import type { Vec3 } from '@portfolio/camera-core';
import {
	acquireCameraOutput,
	cancelCameraOutput,
	createCameraOutputState,
	rebaseCameraOutputSource,
	replaceCameraOutput,
	returnCameraOutput,
	type CameraOutputCancelDecision,
	type CameraOutputDecision,
	type CameraOutputPolicy,
	type CameraOutputRebaseDecision,
	type CameraOutputReturnDecision,
	type CameraOutputState,
	type CameraOutputTicket
} from '@portfolio/project-model';

import type { StageReadSnapshot } from './accepted-read';
import { countWork } from '@portfolio/layout-core';

/** The default inspection framing of a project, from its compiled bounds. */
export function initialInspectionPose(bounds: { min: Vec3; max: Vec3 } | null): InspectionPose {
	if (bounds === null) {
		return {
			target: [0, 0, 0],
			azimuthRadians: 0,
			elevationRadians: Math.PI / 4,
			targetPlaneHeightMeters: 12
		};
	}
	const target: Vec3 = [
		(bounds.min[0] + bounds.max[0]) / 2,
		(bounds.min[1] + bounds.max[1]) / 2,
		(bounds.min[2] + bounds.max[2]) / 2
	];
	const horizontal = Math.hypot(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]);
	const height = bounds.max[1] - bounds.min[1];
	const extent = Math.max(horizontal, height, 1);
	return {
		target,
		azimuthRadians: 0,
		elevationRadians: Math.PI / 4,
		targetPlaneHeightMeters: extent * 1.6
	};
}

type SceneBounds = { readonly min: Vec3; readonly max: Vec3 };

function boundsUnion(a: SceneBounds | null, b: SceneBounds | null): { min: Vec3; max: Vec3 } | null {
	if (a === null || b === null) return (a ?? b) as { min: Vec3; max: Vec3 } | null;
	return {
		min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
		max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])]
	};
}

/** The declared scene radius used for the depth range and the Plan eye distance. */
export function sceneRadiusOf(bounds: { min: Vec3; max: Vec3 } | null, target?: Vec3): number {
	if (bounds === null) return 1;
	if (target !== undefined) {
		// The inspection target stays put during editing and may also be panned.
		// A half-diagonal about the bounds centre no longer encloses the scene then.
		return Math.max(1, Math.hypot(...target.map((coordinate, axis) =>
			Math.max(Math.abs(bounds.min[axis]! - coordinate), Math.abs(bounds.max[axis]! - coordinate))
		)));
	}
	return Math.max(
		Math.hypot(
			bounds.max[0] - bounds.min[0],
			bounds.max[1] - bounds.min[1],
			bounds.max[2] - bounds.min[2]
		) / 2,
		0.5
	);
}

export type LookThroughView = {
	readonly viewId: string;
	readonly presentationId: string;
	readonly label: string;
	readonly eye: Vec3;
	readonly target: Vec3;
	readonly fovYDegrees: number;
};

/** The live Look-through posture: the authored View and the provisional camera. */
export type LookThroughState = {
	readonly view: LookThroughView;
	readonly authored: LookThroughView;
	readonly moved: boolean;
};

export type CameraSession = {
	state(): ViewportCameraState;
	/**
	 * R217.S28 — the provisional Look-through posture, or `null` at ordinary rest.
	 * It is session state: no authored document holds it.
	 */
	lookThrough(): LookThroughState | null;
	beginLookThrough(view: LookThroughView): { readonly kind: 'entered' } | { readonly kind: 'refused'; readonly message: string };
	/** Re-aim the provisional camera at a fixed eye. */
	reaimLookThrough(target: Vec3): boolean;
	/** Re-aim through Camera's own pointer ray at the existing focal distance. */
	reaimLookThroughRay(ray: PointerRay): boolean;
	/** Step the provisional lens at a fixed eye and target. */
	stepLookThroughLens(fovYDegrees: number): boolean;
	/** Turn the provisional view in place by bounded yaw/pitch deltas (drag). */
	turnLookThrough(deltaYawRadians: number, deltaPitchRadians: number): boolean;
	/** Step the provisional eye and target together along the level aim (scroll). */
	stepLookThrough(deltaMeters: number): boolean;
	truckLookThrough(deltaRightMeters: number, deltaUpMeters: number): boolean;
	/** Move eye and target together to a floor-relative eye height. */
	setLookThroughEyeHeight(eyeHeightMetres: number, floorDatumMeters?: number): boolean;
	/**
	 * R217.S30 — the exact settled inspection standpoint **and reading** a Follow
	 * run restores. A pose copy is not enough: Plan/3D posture is part of it.
	 */
	captureStandpoint(): ViewportCameraState;
	restoreStandpoint(state: ViewportCameraState): boolean;
	/** The provisional pose, for Update View or Capture while through. */
	provisionalView(): LookThroughView | null;
	/** Update View: the provisional pose becomes the authored one. */
	commitLookThrough(): LookThroughView | null;
	/** Exit View: restore the exact settled pose and reading the inspection had. */
	endLookThrough(): boolean;
	evaluation(): ViewportEvaluation | null;
	evaluationId(): string | null;
	/** Evaluate at the explicit clock and keep the result as the current output. */
	evaluate(rect: ViewportRect, clockSeconds: number, minimumGroundReachMeters?: number): ViewportEvaluationResult;
	/** Submit one viewing intent through the authority. */
	applyIntent(intent: ViewingIntent, clockSeconds: number): ViewingIntentResult;
	/**
	 * A content change: camera pose is preserved; the landed output claim is rebased too.
	 * `displayGroundYMeters` is the new level datum the mat ground sits at, when it changed.
	 */
	/**
	 * The rendered Layout ∪ Scene bounds. The compiled bounds know no Scene object,
	 * and a near plane calibrated without them cuts through one. Depth only: never
	 * the pose or Fit.
	 */
	setContentBounds(bounds: SceneBounds | null): void;
	rebaseSource(
		sourceRevision: string,
		bounds?: { min: Vec3; max: Vec3 } | null,
		displayGroundYMeters?: number
	): {
		readonly viewport: ViewportSourceRebase;
		readonly output: CameraOutputRebaseDecision;
	};
	output(): CameraOutputState;
	acquireInspection(policy: CameraOutputPolicy, runEpoch: number): CameraOutputDecision;
	/** Ordered handoff; the return token names the transfer the replaced run may claim. */
	replaceInspection(runEpoch: number, returnToken: string): CameraOutputDecision;
	returnInspection(ticket: CameraOutputTicket): CameraOutputReturnDecision;
	cancelInspection(ticket: CameraOutputTicket): void;
	/** The inspection run's claim; `null` while the output is free or Preview holds it. */
	inspectionTicket(): CameraOutputTicket | null;
	/** Hand the one output to the isolated Preview run through an ordered handoff. */
	handOffToPreview(runEpoch: number, returnToken: string): CameraOutputDecision;
	/** Return the output to the inspection run the handoff replaced. */
	returnFromPreview(ticket: CameraOutputTicket): CameraOutputReturnDecision;
	/** End the Preview claim without a return; the protocol voids its return context. */
	cancelPreview(ticket: CameraOutputTicket): CameraOutputCancelDecision;
	/** The Preview run's claim, or `null` when no Preview holds this output. */
	previewTicket(): CameraOutputTicket | null;
};

export type CameraSessionInput = {
	readonly snapshot: StageReadSnapshot;
	readonly viewportId: string;
	readonly outputId: string;
	readonly pose?: InspectionPose;
};

function sameViewportRect(left: ViewportRect, right: ViewportRect): boolean {
	return (
		left.left === right.left &&
		left.top === right.top &&
		left.width === right.width &&
		left.height === right.height &&
		left.devicePixelRatio === right.devicePixelRatio
	);
}

export function evaluationIdOf(evaluation: ViewportEvaluation): string {
	return `${evaluation.token.outputId}::${evaluation.token.sessionEpoch}::${evaluation.token.sourceRevision}::${evaluation.token.evaluationGeneration}`;
}

export function createCameraSession(input: CameraSessionInput): CameraSession {
	let bounds = input.snapshot.domain.geometry.bounds ?? null;
	let contentBounds: SceneBounds | null = null;
	const pose = input.pose ?? initialInspectionPose(bounds);
	let currentState = createViewportCameraState({
		outputId: input.outputId,
		sessionEpoch: input.snapshot.sessionEpoch,
		sourceRevision: input.snapshot.sourceContentId,
		pose,
		sceneRadiusMeters: sceneRadiusOf(bounds),
		// R217.S19 — the mat ground's datum widens the clip range to the visible
		// ground. It is a session input only: never scene bounds, Fit or the pose.
		displayGroundYMeters: input.snapshot.domain.datumMeters
	});
	let generation = 0;
	let currentEvaluation: ViewportEvaluation | null = null;
	/**
	 * The inputs the current evaluation was produced from. A settled Stage refreshes
	 * every display frame; re-evaluating identical inputs would mint a new object (and
	 * therefore a new render) for a view that has not changed. Identity is retained
	 * only while these inputs are identical, so every real change still evaluates.
	 */
	let lastEvaluationRect: ViewportRect | null = null;
	let lastMinimumGroundReach: number | undefined;
	let output = createCameraOutputState({
		outputId: input.outputId,
		viewportId: input.viewportId,
		sessionEpoch: input.snapshot.sessionEpoch,
		sourceRevision: input.snapshot.sourceContentId
	});
	let ticket: CameraOutputTicket | null = null;
	let preview: CameraOutputTicket | null = null;
	/**
	 * R217.S28 — the exact settled inspection the through-camera temporarily
	 * replaces. It holds a pose, a reading and the source identity it was captured
	 * under: the output ticket protocol still owns the output, and a content
	 * rebase moves the saved entry to the new revision with the live state so Exit
	 * cannot restore a superseded source.
	 */
	let lookThroughState:
		| {
				readonly entry: ViewportCameraState;
				readonly view: LookThroughView;
				authored: LookThroughView;
				moved: boolean;
		  }
		| null = null;

	function cloneView(view: LookThroughView): LookThroughView {
		return {
			viewId: view.viewId,
			presentationId: view.presentationId,
			label: view.label,
			eye: [view.eye[0], view.eye[1], view.eye[2]],
			target: [view.target[0], view.target[1], view.target[2]],
			fovYDegrees: view.fovYDegrees
		};
	}

	function provisionalView(): LookThroughView | null {
		if (lookThroughState === null) return null;
		const pose = currentState.pose;
		return {
			viewId: lookThroughState.view.viewId,
			presentationId: lookThroughState.view.presentationId,
			label: lookThroughState.view.label,
			eye: eyeOfInspectionPose(pose),
			target: [pose.target[0], pose.target[1], pose.target[2]],
			fovYDegrees: fovYDegreesOf(pose)
		};
	}

	function applyLookThroughIntent(intent: ViewingIntent): boolean {
		const result = requestViewingIntent(currentState, intent, Number.POSITIVE_INFINITY);
		currentState = result.state;
		return result.kind === 'accepted';
	}

	function inspectionRequest(runEpoch: number) {
		return {
			outputId: output.outputId,
			sourceRevision: output.sourceRevision,
			sessionEpoch: output.sessionEpoch,
			ownerId: `${output.viewportId}:inspection`,
			runEpoch
		} as const;
	}

	function previewRequest(runEpoch: number) {
		return {
			outputId: output.outputId,
			sourceRevision: output.sourceRevision,
			sessionEpoch: output.sessionEpoch,
			ownerId: `${output.viewportId}:preview`,
			runEpoch
		} as const;
	}

	return {
		state: () => currentState,
		evaluation: () => currentEvaluation,
		evaluationId: () => (currentEvaluation === null ? null : evaluationIdOf(currentEvaluation)),
		evaluate(rect, clockSeconds, minimumGroundReachMeters) {
			// A frame clock that has run past a reading flip's endpoint applies it
			// exactly once *here*, at the frame that realises it. Without this the
			// settled reading would lag the rendered one until some unrelated intent
			// happened to arrive: the Plan toggle would still read "3D" over a plan
			// view, and the settled endpoint would be reported by a frame nobody drew.
			const previousState = currentState;
			currentState = advanceViewport(currentState, clockSeconds);
			// Source bounds calibrate Camera's own depth evaluation; they never refit
			// the pose. Recompute after a pan as well as after an authored edit.
			const radius = sceneRadiusOf(boundsUnion(bounds, contentBounds), currentState.pose.target);
			if (radius !== currentState.sceneRadiusMeters) currentState = { ...currentState, sceneRadiusMeters: radius };
			// A reading transition is an animation: its progress changes with the clock
			// even though the settled state object does not, so it is never retained.
			const stateUnchanged = currentState === previousState && currentState.transition === null;
			if (
				stateUnchanged &&
				currentEvaluation !== null &&
				lastEvaluationRect !== null &&
				sameViewportRect(lastEvaluationRect, rect) &&
				lastMinimumGroundReach === minimumGroundReachMeters
			) {
				return { kind: 'evaluated', evaluation: currentEvaluation };
			}
			countWork('camera:evaluate');
			generation += 1;
			const evaluationState = minimumGroundReachMeters === undefined
				? currentState
				: { ...currentState, minimumGroundReachMeters };
			const result = evaluateViewport(evaluationState, rect, clockSeconds, generation);
			currentEvaluation = result.kind === 'evaluated' ? result.evaluation : null;
			lastEvaluationRect = currentEvaluation === null ? null : { ...rect };
			lastMinimumGroundReach = minimumGroundReachMeters;
			return result;
		},
		applyIntent(intent, clockSeconds) {
			const result = requestViewingIntent(currentState, intent, clockSeconds);
			currentState = result.state;
			return result;
		},
		setContentBounds(next) {
			contentBounds = next;
		},
		rebaseSource(sourceRevision, nextBounds = bounds, displayGroundYMeters) {
			const viewport = rebaseViewportSource(currentState, sourceRevision);
			currentState = viewport.state;
			if (viewport.kind !== 'refused') {
				bounds = nextBounds;
				if (displayGroundYMeters !== undefined && Number.isFinite(displayGroundYMeters)) {
					currentState = { ...currentState, displayGroundYMeters };
				}
				if (lookThroughState !== null) {
					// The entry is a full camera state, not a bare pose: leaving it on the
					// old revision would make Exit restore a source the host has replaced.
					const rebasedEntry = rebaseViewportSource(lookThroughState.entry, sourceRevision);
					const entryState =
						displayGroundYMeters !== undefined && Number.isFinite(displayGroundYMeters)
							? { ...rebasedEntry.state, displayGroundYMeters }
							: rebasedEntry.state;
					lookThroughState =
						rebasedEntry.kind === 'refused'
							? null
							: { ...lookThroughState, entry: entryState };
				}
			}
			// The output named the previous revision, so it is not the current output
			// any more: dropping it is the honest answer until the host evaluates the
			// new source, and it stops a stale token being handed out as live.
			currentEvaluation = null;
			lastEvaluationRect = null;
			const rebasedOutput = rebaseCameraOutputSource(output, sourceRevision);
			output = rebasedOutput.state;
			if (rebasedOutput.kind === 'rebased') {
				// Both claims end and the pending return is voided: a Preview cannot
				// return the inspection run to a source it never evaluated.
				ticket = null;
				preview = null;
			}
			return { viewport, output: rebasedOutput };
		},
		output: () => output,
		acquireInspection(policy, runEpoch) {
			const decision = acquireCameraOutput(output, {
				ticket: inspectionRequest(runEpoch),
				role: 'inspection',
				expected: ticket === null ? { kind: 'unowned' } : { kind: 'held', ticket },
				policy
			});
			output = decision.state;
			if (decision.kind === 'acquired') ticket = decision.claim.ticket;
			return decision;
		},
		replaceInspection(runEpoch, returnToken) {
			const decision = replaceCameraOutput(output, {
				ticket: inspectionRequest(runEpoch),
				role: 'inspection',
				expected: ticket === null ? { kind: 'unowned' } : { kind: 'held', ticket },
				returnToken
			});
			output = decision.state;
			if (decision.kind === 'acquired') ticket = decision.claim.ticket;
			return decision;
		},
		returnInspection(candidate) {
			const context = output.claim?.returnContext ?? null;
			const decision = returnCameraOutput(output, candidate, context?.token ?? null);
			output = decision.state;
			if (decision.kind === 'returned') ticket = decision.claim.ticket;
			return decision;
		},
		cancelInspection(candidate) {
			const decision = cancelCameraOutput(output, candidate);
			output = decision.state;
			if (decision.kind === 'cancelled' && ticket !== null && ticket.runEpoch === candidate.runEpoch) {
				ticket = null;
			}
		},
		handOffToPreview(runEpoch, returnToken) {
			const decision = replaceCameraOutput(output, {
				ticket: previewRequest(runEpoch),
				role: 'preview',
				expected: ticket === null ? { kind: 'unowned' } : { kind: 'held', ticket },
				returnToken
			});
			output = decision.state;
			if (decision.kind === 'acquired') {
				preview = decision.claim.ticket;
				// The inspection run no longer owns the output, so it holds no ticket
				// to present for a Stage intent either.
				ticket = null;
			}
			return decision;
		},
		returnFromPreview(candidate) {
			const context = output.claim?.returnContext ?? null;
			const decision = returnCameraOutput(output, candidate, context?.token ?? null);
			output = decision.state;
			if (decision.kind === 'returned') {
				ticket = decision.claim.ticket;
				preview = null;
			}
			return decision;
		},
		cancelPreview(candidate) {
			const decision = cancelCameraOutput(output, candidate);
			output = decision.state;
			if (decision.kind === 'cancelled' && preview !== null && preview.runEpoch === candidate.runEpoch) {
				preview = null;
			}
			return decision;
		},
		inspectionTicket: () => ticket,
		previewTicket: () => preview,
		lookThrough: () =>
			lookThroughState === null
				? null
				: {
						view: lookThroughState.view,
						authored: lookThroughState.authored,
						moved: lookThroughState.moved
					},
		beginLookThrough(view) {
			if (lookThroughState !== null) {
				return { kind: 'refused', message: 'Already looking through a View; exit it first.' };
			}
			const entry = currentState;
			const result = requestViewingIntent(
				currentState,
				{ kind: 'set-view', eye: view.eye, target: view.target, fovYDegrees: view.fovYDegrees },
				Number.POSITIVE_INFINITY
			);
			currentState = result.state;
			if (result.kind === 'rejected') return { kind: 'refused', message: result.message };
			const clone = cloneView(view);
			lookThroughState = { entry, view: clone, authored: clone, moved: false };
			return { kind: 'entered' };
		},
		reaimLookThrough(target) {
			if (lookThroughState === null) return false;
			if (!applyLookThroughIntent({ kind: 'aim', target })) return false;
			lookThroughState = { ...lookThroughState, moved: true };
			return true;
		},
		reaimLookThroughRay(ray) {
			if (lookThroughState === null) return false;
			const aimed = aimPoseAlongRay(currentState.pose, ray);
			if (aimed === null) return false;
			if (!applyLookThroughIntent({ kind: 'aim', target: aimed.target })) return false;
			lookThroughState = { ...lookThroughState, moved: true };
			return true;
		},
		turnLookThrough(deltaYawRadians, deltaPitchRadians) {
			if (lookThroughState === null) return false;
			if (!applyLookThroughIntent({ kind: 'turn', deltaYawRadians, deltaPitchRadians })) return false;
			lookThroughState = { ...lookThroughState, moved: true };
			return true;
		},
		stepLookThrough(deltaMeters) {
			if (lookThroughState === null) return false;
			if (!applyLookThroughIntent({ kind: 'step', deltaMeters })) return false;
			lookThroughState = { ...lookThroughState, moved: true };
			return true;
		},
		truckLookThrough(deltaRightMeters, deltaUpMeters) {
			if (lookThroughState === null) return false;
			if (!applyLookThroughIntent({ kind: 'truck', deltaRightMeters, deltaUpMeters })) return false;
			lookThroughState = { ...lookThroughState, moved: true };
			return true;
		},
		stepLookThroughLens(fovYDegrees) {
			if (lookThroughState === null) return false;
			if (!applyLookThroughIntent({ kind: 'lens', fovYDegrees })) return false;
			lookThroughState = { ...lookThroughState, moved: true };
			return true;
		},
		setLookThroughEyeHeight(eyeHeightMetres, floorDatumMeters = 0) {
			const provisional = provisionalView();
			if (lookThroughState === null || provisional === null) return false;
			if (!Number.isFinite(eyeHeightMetres) || !Number.isFinite(floorDatumMeters)) return false;
			const delta = floorDatumMeters + eyeHeightMetres - provisional.eye[1];
			if (Math.abs(delta) < 1e-6) return false;
			if (!applyLookThroughIntent({ kind: 'lift', deltaMeters: delta })) return false;
			lookThroughState = { ...lookThroughState, moved: true };
			return true;
		},
		provisionalView,
		captureStandpoint: () => currentState,
		restoreStandpoint(state) {
			// Follow never starts through Look through, and a restored entry is the
			// whole settled inspection: pose, reading and ground datum.
			if (lookThroughState !== null) return false;
			currentState = state;
			currentEvaluation = null;
			lastEvaluationRect = null;
			return true;
		},
		commitLookThrough() {
			const provisional = provisionalView();
			if (lookThroughState === null || provisional === null) return null;
			lookThroughState = { ...lookThroughState, authored: provisional, moved: false };
			return provisional;
		},
		endLookThrough() {
			if (lookThroughState === null) return false;
			// The entry state is the whole settled inspection: pose, reading and any
			// last-reading elevation. Restoring it is not a Camera move and enters no
			// history; the output claim was never transferred.
			currentState = lookThroughState.entry;
			lookThroughState = null;
			return true;
		}
	};
}
