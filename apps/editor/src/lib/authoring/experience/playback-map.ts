/**
 * R217.S30 — the editor's movement previews over the one Guide clock.
 *
 * The Guide's time map itself lives in the visitor-safe `guide-run-map` module
 * (guide-playback plan, slice 4), so Preview, a release and the editor read one
 * adapter. This module adds only the editor's single-movement preview ("play
 * this move"), for a Guide connection or a Presentation's explore step.
 *
 * Pure: no editor state, no renderer, no writes.
 */
import {
	buildGuideMovementMap,
	type CameraGraph,
	type GuideTimeInvocation,
	type GuideTimeMapResult
} from '@portfolio/camera-core';
import type {
	ExecutionProgram,
	ExperienceProgramTransition,
	ProgramInvocation
} from '@portfolio/project-model/units';
import { nextProgramStopId, programTransitionFor } from '$lib/visitor/guide-run-map';
import type { ExperiencePathOccurrence } from './experience-paths';

export {
	guideRunFromProgram,
	guideTimeMapForProgram,
	type GuideRunRefusal,
	type GuideRunResult
} from '$lib/visitor/guide-run-map';

/** The authoring identity of one move, projected to its program edge or step. */
export function movementForOccurrence(input: {
	readonly occurrence: ExperiencePathOccurrence;
	readonly program: ExecutionProgram;
	readonly transitions: readonly ExperienceProgramTransition[];
}): {
	readonly fromViewId: string | null;
	readonly toViewId: string;
	readonly invocation: ProgramInvocation;
	readonly stopId: string | null;
	readonly presentationId: string;
} | null {
	const occurrence = input.occurrence;
	if (occurrence.kind === 'step') {
		const presentation = input.program.presentations.find((entry) => entry.id === occurrence.presentationId);
		if (presentation === undefined) return null;
		const viewIndex = presentation.viewIds.indexOf(occurrence.toViewId);
		if (viewIndex <= 0) return null;
		return {
			fromViewId: presentation.viewIds[viewIndex - 1]!,
			toViewId: occurrence.toViewId,
			invocation: presentation.steps[viewIndex - 1] ?? { kind: 'cut', viewId: occurrence.toViewId },
			stopId: null,
			presentationId: presentation.id
		};
	}
	const stop = input.program.stops.find((entry) => entry.id === occurrence.stopId);
	if (stop === undefined) return null;
	const nextStopId = nextProgramStopId(input.program, stop);
	if (nextStopId === null) return null;
	const next = input.program.stops.find((entry) => entry.id === nextStopId);
	if (next === undefined) return null;
	return {
		fromViewId: stop.entryViewId,
		toViewId: next.entryViewId,
		// A Travel is used only when the authored edge names one; never inferred
		// from connectivity and never borrowed from another approach.
		invocation:
			programTransitionFor(input.transitions, stop.id, next.id) ??
			{ kind: 'cut', viewId: next.entryViewId },
		stopId: stop.id,
		presentationId: stop.presentationId
	};
}

/** Preview this move: one exact movement, then the end. */
export function movementTimeMap(input: {
	readonly occurrence: ExperiencePathOccurrence;
	readonly program: ExecutionProgram;
	readonly transitions: readonly ExperienceProgramTransition[];
	readonly graph: CameraGraph;
}): GuideTimeMapResult | null {
	const movement = movementForOccurrence(input);
	if (movement === null) return null;
	const occurrenceRef: string =
		input.occurrence.kind === 'step'
			? `${input.occurrence.presentationId}:${input.occurrence.toViewId}`
			: input.occurrence.stopId;
	return buildGuideMovementMap({
		fromViewId: movement.fromViewId,
		toViewId: movement.toViewId,
		invocation: movement.invocation as GuideTimeInvocation,
		stopId: movement.stopId ?? movement.presentationId,
		presentationId: movement.presentationId,
		occurrenceId: `${input.occurrence.kind}:${occurrenceRef}`,
		graph: input.graph
	});
}
