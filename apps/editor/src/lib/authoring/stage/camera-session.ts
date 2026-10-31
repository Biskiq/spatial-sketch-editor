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
	createViewportCameraState,
	evaluateViewport,
	rebaseViewportSource,
	requestViewingIntent,
	type InspectionPose,
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

export type CameraSession = {
	state(): ViewportCameraState;
	evaluation(): ViewportEvaluation | null;
	evaluationId(): string | null;
	/** Evaluate at the explicit clock and keep the result as the current output. */
	evaluate(rect: ViewportRect, clockSeconds: number): ViewportEvaluationResult;
	/** Submit one viewing intent through the authority. */
	applyIntent(intent: ViewingIntent, clockSeconds: number): ViewingIntentResult;
	/** A content change: camera pose is preserved; the landed output claim is rebased too. */
	rebaseSource(sourceRevision: string, bounds?: { min: Vec3; max: Vec3 } | null): {
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

export function evaluationIdOf(evaluation: ViewportEvaluation): string {
	return `${evaluation.token.outputId}::${evaluation.token.sessionEpoch}::${evaluation.token.sourceRevision}::${evaluation.token.evaluationGeneration}`;
}

export function createCameraSession(input: CameraSessionInput): CameraSession {
	let bounds = input.snapshot.domain.geometry.bounds ?? null;
	const pose = input.pose ?? initialInspectionPose(bounds);
	let currentState = createViewportCameraState({
		outputId: input.outputId,
		sessionEpoch: input.snapshot.sessionEpoch,
		sourceRevision: input.snapshot.sourceContentId,
		pose,
		sceneRadiusMeters: sceneRadiusOf(bounds)
	});
	let generation = 0;
	let currentEvaluation: ViewportEvaluation | null = null;
	let output = createCameraOutputState({
		outputId: input.outputId,
		viewportId: input.viewportId,
		sessionEpoch: input.snapshot.sessionEpoch,
		sourceRevision: input.snapshot.sourceContentId
	});
	let ticket: CameraOutputTicket | null = null;
	let preview: CameraOutputTicket | null = null;

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
		evaluate(rect, clockSeconds) {
			// A frame clock that has run past a reading flip's endpoint applies it
			// exactly once *here*, at the frame that realises it. Without this the
			// settled reading would lag the rendered one until some unrelated intent
			// happened to arrive: the Plan toggle would still read "3D" over a plan
			// view, and the settled endpoint would be reported by a frame nobody drew.
			currentState = advanceViewport(currentState, clockSeconds);
			// Source bounds calibrate Camera's own depth evaluation; they never refit
			// the pose. Recompute after a pan as well as after an authored edit.
			const radius = sceneRadiusOf(bounds, currentState.pose.target);
			if (radius !== currentState.sceneRadiusMeters) currentState = { ...currentState, sceneRadiusMeters: radius };
			generation += 1;
			const result = evaluateViewport(currentState, rect, clockSeconds, generation);
			currentEvaluation = result.kind === 'evaluated' ? result.evaluation : null;
			return result;
		},
		applyIntent(intent, clockSeconds) {
			const result = requestViewingIntent(currentState, intent, clockSeconds);
			currentState = result.state;
			return result;
		},
		rebaseSource(sourceRevision, nextBounds = bounds) {
			const viewport = rebaseViewportSource(currentState, sourceRevision);
			currentState = viewport.state;
			if (viewport.kind !== 'refused') bounds = nextBounds;
			// The output named the previous revision, so it is not the current output
			// any more: dropping it is the honest answer until the host evaluates the
			// new source, and it stops a stale token being handed out as live.
			currentEvaluation = null;
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
		previewTicket: () => preview
	};
}
