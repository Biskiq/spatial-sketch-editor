/**
 * R217.S30 — the Guide time map: one pure, derived read of editorial time.
 *
 * The map is the only source for the timeline bar, the Guide's tour time, each
 * Stop's time, scrub and playback. It is **derivation**, not authority: the
 * Experience already authors an ordered occurrence list, its holds and its
 * Cut/Travel selectors; this module turns that list into timed segments and
 * samples the Camera for a cursor. It owns no frame loop, state, output claim or
 * serialized field.
 *
 * The input is structural on purpose. `camera-core` must not import
 * `project-model` (its reverse import): a caller projects the lowered program's
 * occurrences into `GuideTimeOccurrenceInput` shape, and the Camera owns the
 * directed route, timing, easing and pose evaluation.
 *
 * Every boundary is addressable. A Cut, a zero hold and a wait occupy zero
 * elapsed seconds, so several segments may share one timestamp; a cursor names
 * the segment **and** its local elapsed seconds, never only a time.
 */

import {
	getCameraConnectionRoute,
	getCameraMotionOptions
} from './camera-route';
import {
	createCameraMotion,
	createCameraMotionSample,
	sampleCameraMotion,
	type CameraMotion,
	type CameraMotionSample
} from './camera-motion';
import { getNode, type CameraGraph } from './navigation';
import type { CameraConnectionDirection, Vec3 } from './scene-types';

/** One Camera invocation a segment realizes. */
export type GuideTimeInvocation =
	| { readonly kind: 'cut'; readonly viewId: string }
	| { readonly kind: 'travel'; readonly connectionId: string };

/** One guided View occurrence and its step into the next View. */
export type GuideTimeGuidedView = {
	readonly viewId: string;
	/** Finite non-negative seconds, or `null` for an untimed final View (a wait). */
	readonly holdSeconds: number | null;
	/** `null` on the entry View; every later View names the step into it. */
	readonly step: GuideTimeInvocation | null;
};

/**
 * One Stop occurrence in the run. `arrival` is how the run reaches this
 * occurrence; the run's first occurrence is presented without movement, and the
 * caller passes a Cut to its first View for it.
 */
export type GuideTimeOccurrenceInput = {
	readonly occurrenceId: string;
	readonly stopId: string;
	readonly presentationId: string;
	readonly views: readonly GuideTimeGuidedView[];
	readonly arrival: GuideTimeInvocation;
};

export type GuideTimeSegmentKind = 'hold' | 'wait' | 'cut' | 'travel';

type GuideTimeSegmentBase = {
	/** Stable identity: occurrence + boundary position, never a React index. */
	readonly id: string;
	readonly occurrenceId: string;
	readonly stopId: string;
	readonly presentationId: string;
	readonly viewIndex: number;
	readonly viewId: string;
	readonly fromViewId: string | null;
	readonly connectionId: string | null;
	readonly startSeconds: number;
	readonly endSeconds: number;
};

export type GuideTimeHoldSegment = GuideTimeSegmentBase & {
	readonly kind: 'hold';
	readonly durationSeconds: number;
};

/** One fixed-width hatch for an untimed final View; zero elapsed seconds. */
export type GuideTimeWaitSegment = GuideTimeSegmentBase & {
	readonly kind: 'wait';
	readonly durationSeconds: 0;
};

/** A Cut settles immediately; zero elapsed seconds, still addressable. */
export type GuideTimeCutSegment = GuideTimeSegmentBase & {
	readonly kind: 'cut';
	readonly durationSeconds: 0;
};

export type GuideTimeTravelSegment = GuideTimeSegmentBase & {
	readonly kind: 'travel';
	readonly durationSeconds: number;
	readonly direction: CameraConnectionDirection;
	/** Camera's evaluated directed motion; a handle, never re-evaluated in UI. */
	readonly motion: CameraMotion;
};

export type GuideTimeSegment =
	| GuideTimeHoldSegment
	| GuideTimeWaitSegment
	| GuideTimeCutSegment
	| GuideTimeTravelSegment;

export type GuideTimeOccurrenceRange = {
	readonly occurrenceId: string;
	readonly stopId: string;
	readonly presentationId: string;
	readonly viewIds: readonly string[];
	readonly startSeconds: number;
	readonly endSeconds: number;
};

export type GuideTimeStopEntry = {
	readonly stopId: string;
	readonly occurrenceId: string;
	readonly presentationId: string;
	/** Seconds at which this occurrence is presented. */
	readonly startSeconds: number;
	readonly endSeconds: number;
};

export type GuideTimeBoundary = {
	readonly seconds: number;
	/** Segment ids in stable ordering at this timestamp. */
	readonly segmentIds: readonly string[];
};

export type GuideTimeMap = {
	/** The accepted Camera graph the segments were derived against; read-only. */
	readonly graph: CameraGraph;
	readonly segments: readonly GuideTimeSegment[];
	readonly totalSeconds: number;
	readonly waitCount: number;
	readonly stopEntries: readonly GuideTimeStopEntry[];
	readonly occurrences: readonly GuideTimeOccurrenceRange[];
	readonly boundaries: readonly GuideTimeBoundary[];
};

export type GuideTimeGap = {
	readonly kind: 'gap';
	readonly reason: string;
	readonly stopId?: string;
	readonly viewIndex?: number;
};

export type GuideTimeMapResult =
	| { readonly kind: 'ready'; readonly map: GuideTimeMap }
	| GuideTimeGap;

/**
 * One addressable position: the segment plus its local elapsed seconds. Two
 * zero-length segments sharing a timestamp stay distinct because the segment id
 * is part of the cursor.
 */
export type GuideTimeCursor = {
	readonly segmentId: string;
	readonly elapsedSeconds: number;
};

export type GuideTimeSample =
	| {
			readonly kind: 'camera';
			readonly segmentId: string;
			readonly segmentKind: GuideTimeSegmentKind;
			readonly occurrenceId: string;
			readonly stopId: string;
			readonly presentationId: string;
			readonly viewIndex: number;
			readonly viewId: string;
			readonly elapsedSeconds: number;
			readonly sample: {
				readonly eye: Vec3;
				readonly target: Vec3;
				readonly fov: number;
			};
	  }
	| GuideTimeGap;

export type GuideTimeSampleOptions = {
	/**
	 * The visitor's reduced-motion profile: Travel settles to the destination
	 * immediately through the shared Camera sample, and the authored seconds do
	 * not change.
	 */
	readonly reducedMotion?: boolean;
};

function segmentId(occurrenceId: string, boundary: string): string {
	return `${occurrenceId}:${boundary}`;
}

function viewPose(graph: CameraGraph, viewId: string):
	| { readonly kind: 'pose'; readonly eye: Vec3; readonly target: Vec3; readonly fov: number }
	| GuideTimeGap {
	try {
		const node = getNode(viewId, graph);
		return {
			kind: 'pose',
			eye: [node.position[0], node.position[1], node.position[2]],
			target: [node.cameraTarget[0], node.cameraTarget[1], node.cameraTarget[2]],
			fov: node.fov
		};
	} catch (error) {
		return {
			kind: 'gap',
			reason: error instanceof Error ? error.message : `Camera View "${viewId}" is unavailable.`
		};
	}
}

/**
 * Resolve one directed movement through Camera's exact connection. A Travel must
 * name the one connection joining the two Views; anything else is a typed gap,
 * never an invented route or a silent Cut.
 */
function resolveMovement(input: {
	readonly invocation: GuideTimeInvocation;
	readonly fromViewId: string | null;
	readonly toViewId: string;
	readonly graph: CameraGraph;
	readonly stopId: string;
	readonly viewIndex: number;
	readonly label: string;
}):
	| {
			readonly kind: 'resolved';
			readonly kindOfMovement: 'cut' | 'travel';
			readonly connectionId: string | null;
			readonly direction: CameraConnectionDirection | null;
			readonly motion: CameraMotion | null;
			readonly durationSeconds: number;
	  }
	| GuideTimeGap {
	const { invocation, fromViewId, toViewId, graph } = input;
	if (invocation.kind === 'cut') {
		return {
			kind: 'resolved',
			kindOfMovement: 'cut',
			connectionId: null,
			direction: null,
			motion: null,
			durationSeconds: 0
		};
	}
	const connection = graph.connections.find((candidate) => candidate.id === invocation.connectionId);
	if (connection === undefined) {
		return {
			kind: 'gap',
			reason: `${input.label} names Camera connection "${invocation.connectionId}", which this graph does not carry.`,
			stopId: input.stopId,
			viewIndex: input.viewIndex
		};
	}
	if (fromViewId === null) {
		return {
			kind: 'gap',
			reason: `${input.label} binds a Travel with no logical predecessor View.`,
			stopId: input.stopId,
			viewIndex: input.viewIndex
		};
	}
	let direction: CameraConnectionDirection | null = null;
	if (connection.fromNodeId === fromViewId && connection.toNodeId === toViewId) direction = 'forward';
	else if (connection.toNodeId === fromViewId && connection.fromNodeId === toViewId) direction = 'reverse';
	if (direction === null) {
		return {
			kind: 'gap',
			reason: `${input.label} binds a Travel, and Camera connection "${connection.id}" joins "${connection.fromNodeId}" and "${connection.toNodeId}", not "${fromViewId}" and "${toViewId}".`,
			stopId: input.stopId,
			viewIndex: input.viewIndex
		};
	}
	try {
		const route = getCameraConnectionRoute(connection.id, direction, graph);
		const options = getCameraMotionOptions(connection, direction);
		const motion = createCameraMotion(route, undefined, options);
		return {
			kind: 'resolved',
			kindOfMovement: 'travel',
			connectionId: connection.id,
			direction,
			motion,
			durationSeconds: Math.max(0, motion.durationSeconds)
		};
	} catch (error) {
		return {
			kind: 'gap',
			reason: error instanceof Error ? error.message : `${input.label} could not resolve its Camera motion.`,
			stopId: input.stopId,
			viewIndex: input.viewIndex
		};
	}
}

type SegmentDraft = GuideTimeSegment extends infer T
	? T extends GuideTimeSegment
		? Omit<T, 'startSeconds' | 'endSeconds'>
		: never
	: never;

/**
 * Build the one Guide time map from an ordered occurrence stream.
 *
 * Occurrences are visited in the order they are supplied; a repeated Stop is a
 * distinct occurrence because its `occurrenceId` differs. The caller that walks
 * a Guide's continuations owns the finite-traversal check and reports a cycle
 * rather than expanding one here.
 */
export function buildGuideTimeMap(input: {
	readonly occurrences: readonly GuideTimeOccurrenceInput[];
	readonly graph: CameraGraph;
}): GuideTimeMapResult {
	const segments: GuideTimeSegment[] = [];
	const occurrences: GuideTimeOccurrenceRange[] = [];
	const stopEntries: GuideTimeStopEntry[] = [];
	let seconds = 0;
	let waitCount = 0;
	let previousOccurrence: GuideTimeOccurrenceInput | null = null;

	for (const occurrence of input.occurrences) {
		if (occurrence.views.length === 0) {
			return {
				kind: 'gap',
				reason: `Stop "${occurrence.stopId}" has no guided View to time.`,
				stopId: occurrence.stopId
			};
		}
		const occurrenceStart = seconds;
		const previousExitViewId = previousOccurrence?.views.at(-1)?.viewId ?? null;
		let cursorViewId = previousExitViewId;
		const drafts: SegmentDraft[] = [];

		const arrival = resolveMovement({
			invocation: occurrence.arrival,
			fromViewId: previousOccurrence === null ? null : previousExitViewId,
			toViewId: occurrence.views[0]!.viewId,
			graph: input.graph,
			stopId: occurrence.stopId,
			viewIndex: 0,
			label: `The arrival at Stop "${occurrence.stopId}"`
		});
		if (arrival.kind === 'gap') return arrival;
		// The first occurrence is presented with no incoming movement: the caller
		// supplies a Cut for it, and a Travel there would be a caller defect.
		if (previousOccurrence === null && arrival.kindOfMovement === 'travel') {
			return {
				kind: 'gap',
				reason: `The run's first occurrence cannot begin with a Travel.`,
				stopId: occurrence.stopId,
				viewIndex: 0
			};
		}
		drafts.push(
			arrival.kindOfMovement === 'travel'
				? {
						kind: 'travel',
						id: segmentId(occurrence.occurrenceId, 'arrival'),
						occurrenceId: occurrence.occurrenceId,
						stopId: occurrence.stopId,
						presentationId: occurrence.presentationId,
						viewIndex: 0,
						viewId: occurrence.views[0]!.viewId,
						fromViewId: previousExitViewId,
						connectionId: arrival.connectionId,
						durationSeconds: arrival.durationSeconds,
						direction: arrival.direction!,
						motion: arrival.motion!
					}
				: {
						kind: 'cut',
						id: segmentId(occurrence.occurrenceId, 'arrival'),
						occurrenceId: occurrence.occurrenceId,
						stopId: occurrence.stopId,
						presentationId: occurrence.presentationId,
						viewIndex: 0,
						viewId: occurrence.views[0]!.viewId,
						fromViewId: previousExitViewId,
						connectionId: null,
						durationSeconds: 0
					}
		);
		cursorViewId = occurrence.views[0]!.viewId;

		for (const [viewIndex, view] of occurrence.views.entries()) {
			if (viewIndex > 0) {
				const step = resolveMovement({
					invocation: view.step ?? { kind: 'cut', viewId: view.viewId },
					fromViewId: cursorViewId,
					toViewId: view.viewId,
					graph: input.graph,
					stopId: occurrence.stopId,
					viewIndex,
					label: `Step ${viewIndex + 1} of Stop "${occurrence.stopId}"`
				});
				if (step.kind === 'gap') return step;
				drafts.push(
					step.kindOfMovement === 'travel'
						? {
								kind: 'travel',
								id: segmentId(occurrence.occurrenceId, `step-${viewIndex}`),
								occurrenceId: occurrence.occurrenceId,
								stopId: occurrence.stopId,
								presentationId: occurrence.presentationId,
								viewIndex,
								viewId: view.viewId,
								fromViewId: cursorViewId,
								connectionId: step.connectionId,
								durationSeconds: step.durationSeconds,
								direction: step.direction!,
								motion: step.motion!
							}
						: {
								kind: 'cut',
								id: segmentId(occurrence.occurrenceId, `step-${viewIndex}`),
								occurrenceId: occurrence.occurrenceId,
								stopId: occurrence.stopId,
								presentationId: occurrence.presentationId,
								viewIndex,
								viewId: view.viewId,
								fromViewId: cursorViewId,
								connectionId: null,
								durationSeconds: 0
							}
				);
				cursorViewId = view.viewId;
			}
			const finalView = viewIndex === occurrence.views.length - 1;
			if (view.holdSeconds === null && finalView) {
				drafts.push({
					kind: 'wait',
					id: segmentId(occurrence.occurrenceId, `wait-${viewIndex}`),
					occurrenceId: occurrence.occurrenceId,
					stopId: occurrence.stopId,
					presentationId: occurrence.presentationId,
					viewIndex,
					viewId: view.viewId,
					fromViewId: cursorViewId,
					connectionId: null,
					durationSeconds: 0
				});
				waitCount += 1;
				continue;
			}
			const holdSeconds = view.holdSeconds === null ? 0 : Math.max(0, view.holdSeconds);
			drafts.push({
				kind: 'hold',
				id: segmentId(occurrence.occurrenceId, `hold-${viewIndex}`),
				occurrenceId: occurrence.occurrenceId,
				stopId: occurrence.stopId,
				presentationId: occurrence.presentationId,
				viewIndex,
				viewId: view.viewId,
				fromViewId: cursorViewId,
				connectionId: null,
				durationSeconds: holdSeconds
			});
		}

		for (const draft of drafts) {
			const durationSeconds = draft.durationSeconds;
			const segment = {
				...draft,
				startSeconds: seconds,
				endSeconds: seconds + durationSeconds
			} as GuideTimeSegment;
			segments.push(segment);
			seconds = segment.endSeconds;
		}
		occurrences.push({
			occurrenceId: occurrence.occurrenceId,
			stopId: occurrence.stopId,
			presentationId: occurrence.presentationId,
			viewIds: occurrence.views.map((view) => view.viewId),
			startSeconds: occurrenceStart,
			endSeconds: seconds
		});
		stopEntries.push({
			stopId: occurrence.stopId,
			occurrenceId: occurrence.occurrenceId,
			presentationId: occurrence.presentationId,
			startSeconds: occurrenceStart,
			endSeconds: seconds
		});
		previousOccurrence = occurrence;
	}

	const totalSeconds = seconds;
	const boundaries = buildBoundaries(segments);
	return {
		kind: 'ready',
		map: { graph: input.graph, segments, totalSeconds, waitCount, stopEntries, occurrences, boundaries }
	};
}

function buildBoundaries(segments: readonly GuideTimeSegment[]): GuideTimeBoundary[] {
	const bySecond = new Map<number, string[]>();
	for (const segment of segments) {
		const list = bySecond.get(segment.startSeconds);
		if (list === undefined) bySecond.set(segment.startSeconds, [segment.id]);
		else list.push(segment.id);
	}
	return [...bySecond.entries()]
		.sort((left, right) => left[0] - right[0])
		.map(([seconds, segmentIds]) => ({ seconds, segmentIds }));
}

/**
 * The one exact Camera movement a timeline needs without a run: Preview this
 * move. A Cut settles immediately; a Travel carries its evaluated motion and
 * directed seconds.
 */
export function buildGuideMovementMap(input: {
	readonly fromViewId: string | null;
	readonly toViewId: string;
	readonly invocation: GuideTimeInvocation;
	readonly stopId: string;
	readonly presentationId: string;
	readonly occurrenceId: string;
	readonly graph: CameraGraph;
}): GuideTimeMapResult {
	const movement = resolveMovement({
		invocation: input.invocation,
		fromViewId: input.fromViewId,
		toViewId: input.toViewId,
		graph: input.graph,
		stopId: input.stopId,
		viewIndex: 0,
		label: `The movement into "${input.toViewId}"`
	});
	if (movement.kind === 'gap') return movement;
	const durationSeconds = movement.durationSeconds;
	const base = {
		id: `${input.occurrenceId}:move`,
		occurrenceId: input.occurrenceId,
		stopId: input.stopId,
		presentationId: input.presentationId,
		viewIndex: 0,
		viewId: input.toViewId,
		fromViewId: input.fromViewId,
		connectionId: movement.connectionId,
		startSeconds: 0,
		endSeconds: durationSeconds
	};
	const segment: GuideTimeSegment =
		movement.kindOfMovement === 'travel'
			? {
					...base,
					kind: 'travel',
					durationSeconds,
					direction: movement.direction!,
					motion: movement.motion!
				}
			: { ...base, kind: 'cut', durationSeconds: 0 };
	return {
		kind: 'ready',
		map: {
			graph: input.graph,
			segments: [segment],
			totalSeconds: durationSeconds,
			waitCount: 0,
			stopEntries: [
				{
					stopId: input.stopId,
					occurrenceId: input.occurrenceId,
					presentationId: input.presentationId,
					startSeconds: 0,
					endSeconds: durationSeconds
				}
			],
			occurrences: [
				{
					occurrenceId: input.occurrenceId,
					stopId: input.stopId,
					presentationId: input.presentationId,
					viewIds: [input.toViewId],
					startSeconds: 0,
					endSeconds: durationSeconds
				}
			],
			boundaries: buildBoundaries([segment])
		}
	};
}

function segmentAtSeconds(map: GuideTimeMap, seconds: number): GuideTimeSegment {
	if (seconds <= 0) return map.segments[0]!;
	let containing: GuideTimeSegment | null = null;
	let latest: GuideTimeSegment = map.segments[0]!;
	for (const segment of map.segments) {
		if (segment.startSeconds > seconds) break;
		latest = segment;
		if (seconds >= segment.startSeconds && seconds < segment.endSeconds) {
			containing = segment;
			break;
		}
	}
	return containing ?? latest;
}

/** Absolute elapsed seconds -> the one stable segment and its local elapsed. */
export function guideTimeCursorAt(map: GuideTimeMap, seconds: number): GuideTimeCursor {
	if (map.segments.length === 0) return { segmentId: '', elapsedSeconds: 0 };
	const clamped = Number.isFinite(seconds) ? Math.max(0, Math.min(seconds, map.totalSeconds)) : 0;
	// An untimed first View is a wait at 0 s. A run that starts (or seeks to the
	// start) must respect that occurrence, not skip it to the following Cut.
	if (clamped === 0) {
		const initialWait = map.segments.find(
			(segment) => segment.kind === 'wait' && segment.startSeconds === 0
		);
		if (initialWait !== undefined) return { segmentId: initialWait.id, elapsedSeconds: 0 };
	}
	const segment = segmentAtSeconds(map, clamped);
	return {
		segmentId: segment.id,
		elapsedSeconds: Math.max(0, Math.min(clamped - segment.startSeconds, segment.durationSeconds))
	};
}

/** The normalized cursor for an explicit segment, clamped to its own span. */
export function normalizeGuideTimeCursor(
	map: GuideTimeMap,
	cursor: GuideTimeCursor
): GuideTimeCursor | null {
	const segment = map.segments.find((entry) => entry.id === cursor.segmentId);
	if (segment === undefined) return null;
	return {
		segmentId: segment.id,
		elapsedSeconds: Math.max(
			0,
			Math.min(Number.isFinite(cursor.elapsedSeconds) ? cursor.elapsedSeconds : 0, segment.durationSeconds)
		)
	};
}

export function guideTimeSegmentOf(
	map: GuideTimeMap,
	cursor: GuideTimeCursor
): GuideTimeSegment | null {
	return map.segments.find((entry) => entry.id === cursor.segmentId) ?? null;
}

/** The next segment in stable order, or null at the map's end. */
export function nextGuideTimeSegment(
	map: GuideTimeMap,
	cursor: GuideTimeCursor
): GuideTimeSegment | null {
	const index = map.segments.findIndex((entry) => entry.id === cursor.segmentId);
	return index < 0 ? null : (map.segments[index + 1] ?? null);
}

/** The segment before a cursor's own, or null at the map's start. */
export function previousGuideTimeSegment(
	map: GuideTimeMap,
	cursor: GuideTimeCursor
): GuideTimeSegment | null {
	const index = map.segments.findIndex((entry) => entry.id === cursor.segmentId);
	return index <= 0 ? null : map.segments[index - 1]!;
}

/** Which occurrence presents a Stop, by authored Stop identity. */
export function guideTimeEntryForStop(
	map: GuideTimeMap,
	stopId: string
): GuideTimeStopEntry | null {
	return map.stopEntries.find((entry) => entry.stopId === stopId) ?? null;
}

/**
 * Sample the Camera and the UI occurrence at a cursor.
 *
 * The read is pure: it returns the evaluated pose/FOV and the occurrence it
 * belongs to. A held View or a wait reads its authored View; a Cut reads its
 * destination; a Travel samples its evaluated directed motion. Reduced motion
 * settles Travel to the destination without changing the displayed seconds.
 */
export function sampleGuideTime(
	map: GuideTimeMap,
	cursor: GuideTimeCursor,
	options: GuideTimeSampleOptions = {}
): GuideTimeSample {
	const normalized = normalizeGuideTimeCursor(map, cursor);
	if (normalized === null) {
		return { kind: 'gap', reason: 'That playback position is no longer in the Guide time map.' };
	}
	const segment = map.segments.find((entry) => entry.id === normalized.segmentId)!;
	return sampleSegmentWithGraph(segment, normalized.elapsedSeconds, options, map.graph);
}

const motionSample = createCameraMotionSample();

function sampleSegmentWithGraph(
	segment: GuideTimeSegment,
	elapsedSeconds: number,
	options: GuideTimeSampleOptions,
	graph: CameraGraph
): GuideTimeSample {
	if (segment.kind === 'travel') {
		const progress =
			options.reducedMotion === true || segment.durationSeconds <= 0
				? 1
				: Math.max(0, Math.min(1, segment.durationSeconds <= 0 ? 1 : elapsedSeconds / segment.durationSeconds));
		sampleCameraMotion(segment.motion, progress, motionSample);
		return {
			kind: 'camera',
			segmentId: segment.id,
			segmentKind: segment.kind,
			occurrenceId: segment.occurrenceId,
			stopId: segment.stopId,
			presentationId: segment.presentationId,
			viewIndex: segment.viewIndex,
			viewId: segment.viewId,
			elapsedSeconds,
			sample: {
				eye: [motionSample.position.x, motionSample.position.y, motionSample.position.z],
				target: [motionSample.target.x, motionSample.target.y, motionSample.target.z],
				fov: motionSample.fov
			}
		};
	}
	const pose = viewPose(graph, segment.viewId);
	if (pose.kind === 'gap') return pose;
	return {
		kind: 'camera',
		segmentId: segment.id,
		segmentKind: segment.kind,
		occurrenceId: segment.occurrenceId,
		stopId: segment.stopId,
		presentationId: segment.presentationId,
		viewIndex: segment.viewIndex,
		viewId: segment.viewId,
		elapsedSeconds,
		sample: { eye: pose.eye, target: pose.target, fov: pose.fov }
	};
}

/** `m:ss`, used by the bar, the Guide total and every Stop time. */
export function formatGuideTime(seconds: number): string {
	const rounded = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
	const minutes = Math.floor(rounded / 60);
	const remainder = rounded % 60;
	return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/** `+ 2 waits` / `+ 1 wait`, separately pluralized. */
export function formatGuideWaits(waitCount: number): string {
	const count = Number.isFinite(waitCount) ? Math.max(0, Math.trunc(waitCount)) : 0;
	return `+ ${count} ${count === 1 ? 'wait' : 'waits'}`;
}

/** `0:41 + 2 waits` */
export function formatGuideTotal(map: Pick<GuideTimeMap, 'totalSeconds' | 'waitCount'>): string {
	const total = formatGuideTime(map.totalSeconds);
	return map.waitCount === 0 ? total : `${total} ${formatGuideWaits(map.waitCount)}`;
}
