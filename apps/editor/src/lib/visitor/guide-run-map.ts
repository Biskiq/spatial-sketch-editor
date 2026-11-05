/**
 * The one Guide clock (guide-playback plan, slice 4): project the lowered
 * `ExecutionProgram@4` into the Camera time map.
 *
 * This is the one adapter between the shared program and `camera-core`'s
 * structural time-map input, and it is visitor-safe: Preview, a published
 * release and the editor's Guide strip all read the same map, so the welcome's
 * "about m:ss", the strip's total and a visitor's run agree. It copies no Camera
 * fact: each Travel names the connection the program bound, and the Camera
 * resolves its directed motion and time.
 *
 * A Stop is one visit, so the adapter passes one View per Stop: its entry View
 * with `holdSeconds` = the stay in Automatic and `null` (a wait) in Manual. A
 * Presentation's explore steps add no Guide time and are never mapped here.
 *
 * The traversal follows the authored continuations from the run's entry Stop, so
 * a nonadjacent Next, a Cut between otherwise unconnected Stops and an
 * independent Travel pair all read exactly as the run would. A revisit is a new
 * occurrence; a sequence that would revisit a Stop forever is refused as a cycle
 * rather than expanded.
 *
 * Pure: no editor state, no renderer, no writes, no editor import.
 */
import {
	buildGuideTimeMap,
	type CameraGraph,
	type GuideTimeInvocation,
	type GuideTimeMapResult,
	type GuideTimeOccurrenceInput
} from '@portfolio/camera-core';
import type {
	ExecutionProgram,
	ExperienceProgramTransition,
	ProgramInvocation
} from '@portfolio/project-model/units';

type ProgramStop = ExecutionProgram['stops'][number];

export type GuideRunRefusal =
	| {
			readonly kind: 'gap';
			readonly reason: string;
			readonly stopId?: string;
	  }
	| { readonly kind: 'cycle'; readonly reason: string; readonly stopId: string };

export type GuideRunResult =
	| { readonly kind: 'ready'; readonly occurrences: readonly GuideTimeOccurrenceInput[] }
	| GuideRunRefusal;

/** The invocation lowering bound for the edge `fromStopId → toStopId`, or null. */
export function programTransitionFor(
	transitions: readonly ExperienceProgramTransition[],
	fromStopId: string,
	toStopId: string
): ProgramInvocation | null {
	const entry = transitions.find(
		(candidate) => candidate.fromStopId === fromStopId && candidate.toStopId === toStopId
	);
	return entry?.invocation ?? null;
}

/** The Stop the program continues to after `stop`, or null at the end. */
export function nextProgramStopId(program: ExecutionProgram, stop: ProgramStop): string | null {
	if (stop.continuation.kind === 'stop') return stop.continuation.stopId;
	if (stop.continuation.kind === 'end') return null;
	return program.stops[program.stops.findIndex((entry) => entry.id === stop.id) + 1]?.id ?? null;
}

function entryCut(stop: ProgramStop): ProgramInvocation {
	return { kind: 'cut', viewId: stop.entryViewId };
}

/**
 * Walk one finite run from `entryStopId`.
 *
 * The first occurrence never starts with a Travel. Every later occurrence takes
 * the invocation authored for the edge it actually came from (the transition
 * table), falling back to the Stop's own binding only when that binding is a Cut:
 * a Travel is never borrowed from another predecessor.
 */
export function guideRunFromProgram(input: {
	readonly program: ExecutionProgram;
	readonly transitions: readonly ExperienceProgramTransition[];
	/** Defaults to the program's entry Stop. */
	readonly entryStopId?: string | null;
}): GuideRunResult {
	const { program, transitions } = input;
	const stopById = new Map(program.stops.map((stop) => [stop.id, stop]));
	const startStopId = input.entryStopId ?? program.entryStopId;
	if (startStopId === null) return { kind: 'ready', occurrences: [] };
	const first = stopById.get(startStopId);
	if (first === undefined) {
		return { kind: 'gap', reason: `The run's entry Stop "${startStopId}" is not in this program.`, stopId: startStopId };
	}
	const occurrences: GuideTimeOccurrenceInput[] = [];
	const visited = new Set<string>();
	let current: ProgramStop | null = first;
	let previous: ProgramStop | null = null;
	let index = 1;
	while (current !== null) {
		if (visited.has(current.id)) {
			return {
				kind: 'cycle',
				reason: `The run revisits Stop "${current.id}", so a finite traversal cannot be represented.`,
				stopId: current.id
			};
		}
		visited.add(current.id);
		// A Travel with no authored transition for this approach plays as a Cut:
		// the gap stays a problem on its own link (the Card names it) instead of
		// making the whole Guide unplayable.
		const authored = previous === null ? null : programTransitionFor(transitions, previous.id, current.id);
		const arrival: ProgramInvocation =
			previous === null
				? entryCut(current)
				: authored ?? (current.invocation.kind === 'cut' ? current.invocation : entryCut(current));
		occurrences.push({
			occurrenceId: `${index}:${current.id}`,
			stopId: current.id,
			presentationId: current.presentationId,
			// One visit, one View: a stay in Automatic, a wait in Manual.
			views: [{ viewId: current.entryViewId, holdSeconds: current.staySeconds, step: null }],
			arrival: arrival as GuideTimeInvocation
		});
		const nextStopId = nextProgramStopId(program, current);
		const next: ProgramStop | null = nextStopId === null ? null : (stopById.get(nextStopId) ?? null);
		if (nextStopId !== null && next === null) {
			return {
				kind: 'gap',
				reason: `Stop "${current.id}" continues to "${nextStopId}", which is not in this program.`,
				stopId: current.id
			};
		}
		previous = current;
		current = next;
		index += 1;
	}
	return { kind: 'ready', occurrences };
}

/** The Guide's one time map, from its authored entry (or an explicit run entry). */
export function guideTimeMapForProgram(input: {
	readonly program: ExecutionProgram;
	readonly transitions: readonly ExperienceProgramTransition[];
	readonly graph: CameraGraph;
	readonly entryStopId?: string | null;
}): GuideTimeMapResult | GuideRunRefusal {
	const run = guideRunFromProgram(input);
	if (run.kind !== 'ready') return run;
	if (run.occurrences.length === 0) {
		return {
			kind: 'ready',
			map: {
				graph: input.graph,
				segments: [],
				totalSeconds: 0,
				waitCount: 0,
				stopEntries: [],
				occurrences: [],
				boundaries: []
			}
		};
	}
	return buildGuideTimeMap({ occurrences: run.occurrences, graph: input.graph });
}
