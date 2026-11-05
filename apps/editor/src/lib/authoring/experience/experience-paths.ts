/**
 * R217.S29 — the one derived read of a Guided occurrence's Camera path.
 *
 * An occurrence is where a Guided move happens: the outgoing edge of a Stop, or
 * a step between two Views inside one Stop. The key is source identity only
 * (`{kind:'transition', stopId}` / `{kind:'step', stopId, toViewId}`); its
 * endpoints are resolved from the accepted Experience against the context Guide.
 *
 * Everything Camera-owned is read from `camera-core` through the accepted
 * Camera unit: the one direct connection, its direction, motion and evaluated
 * duration, route length and position samples. Exactly one direct connection
 * counts; zero is a named gap and two or more are ambiguous, never a pick-first
 * and never an indirect route. A Layout route-versus-Wall advisory is supplied
 * by the caller with the already compiled representation.
 *
 * Pure: no editor state, no renderer, no writes.
 */
import {
	createCameraMotion,
	getCameraConnectionRoute,
	getCameraMotionOptions,
	type CameraGraph,
	type CameraMotion,
	type CameraMotionOptions
} from '@portfolio/camera-core';
import type {
	CameraView,
	Experience,
	ExperienceGuide,
	ExperienceStop,
	ExperienceTransitionKind,
	ProjectEnvelope
} from '@portfolio/project-model/units';
import type { NavigationGraph, SceneConnection } from '@portfolio/project-model';
import { routeCrossesWall, type CompiledLayoutGeometry, type RouteWallRead } from '@portfolio/layout-core';
import { resolveContinuation, guideStopsOf, stopEntryViewId, stopExitViewId } from './experience-model';
import {
	findNearestCurveProgress
} from '../camera/editor-camera-path';
import type { Vec3 } from '@portfolio/camera-core';

/** One Guided move, addressed by authored identity only. */
export type ExperiencePathOccurrence =
	| { readonly kind: 'transition'; readonly stopId: string }
	| { readonly kind: 'step'; readonly stopId: string; readonly toViewId: string };

export type ResolvedPathOccurrence = {
	readonly occurrence: ExperiencePathOccurrence;
	readonly fromViewId: string;
	readonly toViewId: string;
	readonly transition: ExperienceTransitionKind;
	/** The Stop the occurrence belongs to (the source Stop for a transition). */
	readonly stopId: string;
	/** The destination Stop for a transition; null for a step. */
	readonly toStopId: string | null;
};

export type ExperiencePathState = 'cut' | 'gap' | 'ambiguous' | 'ready';

export type ExperiencePathRead = {
	readonly occurrence: ExperiencePathOccurrence;
	readonly fromViewId: string;
	readonly toViewId: string;
	readonly transition: ExperienceTransitionKind;
	readonly state: ExperiencePathState;
	/** Unique direct connection, or null for a Cut / gap / ambiguous pair. */
	readonly connectionId: string | null;
	readonly direction: 'forward' | 'reverse' | null;
	/** Camera's evaluated directed duration, in seconds. */
	readonly seconds: number | null;
	/** The authored duration for this direction, or null when Camera is automatic. */
	readonly authoredSeconds: number | null;
	/** Camera's evaluated route length, in metres. */
	readonly lengthMeters: number | null;
	readonly anchorCount: number;
	/** The authored interior points, in order, for drawing and point selection. */
	readonly anchors: readonly { readonly id: string; readonly position: Vec3 }[];
	/** Other Travel occurrences that share the same connection. */
	readonly sharedUses: readonly ResolvedPathOccurrence[];
	/** Evaluated route samples in project-world metres. */
	readonly samples: readonly Vec3[];
	/** The Layout advisory, or null when no compiled representation was supplied. */
	readonly wall: RouteWallRead | null;
};

export function occurrenceKey(occurrence: ExperiencePathOccurrence): string {
	return occurrence.kind === 'transition'
		? `transition:${occurrence.stopId}`
		: `step:${occurrence.stopId}:${occurrence.toViewId}`;
}

export function sameOccurrence(
	left: ExperiencePathOccurrence | null,
	right: ExperiencePathOccurrence | null
): boolean {
	if (left === null || right === null) return left === right;
	return occurrenceKey(left) === occurrenceKey(right);
}

function stopOf(experience: Experience, stopId: string): ExperienceStop | null {
	return experience.stops.find((stop) => stop.id === stopId) ?? null;
}

/** Resolve one occurrence's authored endpoints against the context Guide. */
export function resolvePathOccurrence(
	experience: Experience,
	guide: ExperienceGuide | null,
	occurrence: ExperiencePathOccurrence
): ResolvedPathOccurrence | null {
	const stop = stopOf(experience, occurrence.stopId);
	if (stop === null) return null;
	if (occurrence.kind === 'transition') {
		const resolved = resolveContinuation(experience, guide, stop.id);
		if (resolved === null || resolved.kind === 'end') return null;
		const destination = stopOf(experience, resolved.stopId);
		if (destination === null) return null;
		return {
			occurrence,
			fromViewId: stopExitViewId(stop),
			toViewId: stopEntryViewId(destination),
			transition: resolved.transition,
			stopId: stop.id,
			toStopId: destination.id
		};
	}
	const index = stop.views.findIndex((view) => view.viewId === occurrence.toViewId);
	if (index <= 0) return null;
	return {
		occurrence,
		fromViewId: stop.views[index - 1]!.viewId,
		toViewId: stop.views[index]!.viewId,
		transition: stop.views[index]!.transition ?? 'cut',
		stopId: stop.id,
		toStopId: null
	};
}

/** Every occurrence of one Experience, in authored Stop order. */
export function experiencePathOccurrences(
	experience: Experience,
	guide: ExperienceGuide | null
): readonly ResolvedPathOccurrence[] {
	const occurrences: ResolvedPathOccurrence[] = [];
	// A visible route belongs to the open Guide: iterate its actual Stop order,
	// including a nonadjacent Next and every in-Stop Travel.
	for (const stop of guide === null ? experience.stops : guideStopsOf(experience, guide)) {
		const transition = resolvePathOccurrence(experience, guide, { kind: 'transition', stopId: stop.id });
		if (transition !== null) occurrences.push(transition);
		for (const view of stop.views.slice(1)) {
			const step = resolvePathOccurrence(experience, guide, {
				kind: 'step',
				stopId: stop.id,
				toViewId: view.viewId
			});
			if (step !== null) occurrences.push(step);
		}
	}
	return occurrences;
}

/** One connection's directed Camera motion and route, cached per accepted graph. */
const motionCache = new WeakMap<object, Map<string, { motion: CameraMotion; options: CameraMotionOptions }>>();
const readCache = new WeakMap<object, WeakMap<object, Map<string, { motion: CameraMotion; samples: Vec3[]; wall: ReturnType<typeof routeCrossesWall> | null }>>>();
const NO_GEOMETRY = {};

function readCacheFor(graph: object, geometry: object | null) {
	let byGeometry = readCache.get(graph);
	if (byGeometry === undefined) {
		byGeometry = new WeakMap();
		readCache.set(graph, byGeometry);
	}
	const key = geometry ?? NO_GEOMETRY;
	let entries = byGeometry.get(key);
	if (entries === undefined) {
		entries = new Map();
		byGeometry.set(key, entries);
	}
	return entries;
}

export function pathMotionFor(
	connection: SceneConnection,
	direction: 'forward' | 'reverse',
	graph: CameraGraph
): { readonly motion: CameraMotion; readonly options: CameraMotionOptions } {
	const key = `${connection.id}:${direction}`;
	let byGraph = motionCache.get(graph);
	if (byGraph === undefined) {
		byGraph = new Map();
		motionCache.set(graph, byGraph);
	}
	const cached = byGraph.get(key);
	if (cached !== undefined) return cached;
	const route = getCameraConnectionRoute(connection.id, direction, graph);
	const options = getCameraMotionOptions(connection, direction);
	const value = { motion: createCameraMotion(route, undefined, options), options };
	byGraph.set(key, value);
	return value;
}

/** Evaluate a temporary anchor edit through the same Camera route and motion. */
export function previewPathSamples(
	connectionId: string,
	direction: 'forward' | 'reverse',
	graph: CameraGraph,
	anchors: readonly SceneConnection['positionPath']['anchors'][number][]
): Vec3[] | null {
	const connection = graph.connections.find((entry) => entry.id === connectionId);
	if (connection === undefined) return null;
	const from = connection.positionPath.anchors[0];
	const to = connection.positionPath.anchors.at(-1);
	if (from === undefined || to === undefined) return null;
	const candidate = {
		...connection,
		positionPath: { ...connection.positionPath, anchors: [from, ...anchors, to] }
	};
	const draft = {
		...graph,
		connections: graph.connections.map((entry) => entry.id === candidate.id ? candidate : entry)
	};
	const route = getCameraConnectionRoute(candidate.id, direction, draft);
	return pathSamples(createCameraMotion(route, undefined, getCameraMotionOptions(candidate, direction)));
}

function connectionDirection(
	connection: SceneConnection,
	fromViewId: string,
	toViewId: string
): 'forward' | 'reverse' | null {
	if (connection.fromNodeId === fromViewId && connection.toNodeId === toViewId) return 'forward';
	if (connection.toNodeId === fromViewId && connection.fromNodeId === toViewId) return 'reverse';
	return null;
}

/** Fixed route sampling for display and the Layout advisory. */
export function pathSamples(motion: CameraMotion, count = 96): Vec3[] {
	const samples: Vec3[] = [];
	const total = Math.max(2, Math.min(256, Math.round(count)));
	for (let index = 0; index < total; index += 1) {
		const point = motion.positionPath.getPointAt(index / (total - 1));
		samples.push([point.x, point.y, point.z]);
	}
	return samples;
}

/**
 * Read one occurrence's Camera path.
 *
 * `geometry` is the already compiled Layout representation when the caller has
 * it; without it no advisory is claimed. The read never creates, selects or
 * rewrites a connection.
 */
export function readExperiencePath(input: {
	readonly experience: Experience;
	readonly guide: ExperienceGuide | null;
	/** The accepted read's canonical Camera graph; never regenerated here. */
	readonly graph: NavigationGraph;
	readonly occurrence: ExperiencePathOccurrence;
	readonly geometry?: CompiledLayoutGeometry | null;
}): ExperiencePathRead | null {
	const { experience, guide, graph, occurrence } = input;
	const resolved = resolvePathOccurrence(experience, guide, occurrence);
	if (resolved === null) return null;
	const base = {
		occurrence,
		fromViewId: resolved.fromViewId,
		toViewId: resolved.toViewId,
		transition: resolved.transition
	};
	if (resolved.transition === 'cut') {
		return {
			...base,
			state: 'cut',
			connectionId: null,
			direction: null,
			authoredSeconds: null,
			seconds: null,
			lengthMeters: null,
			anchorCount: 0,
			anchors: [],
			sharedUses: [],
			samples: [],
			wall: null
		};
	}
	const connections = graph.connections.filter(
		(connection) =>
			(connection.fromNodeId === resolved.fromViewId && connection.toNodeId === resolved.toViewId) ||
			(connection.toNodeId === resolved.fromViewId && connection.fromNodeId === resolved.toViewId)
	);
	if (connections.length !== 1) {
		return {
			...base,
			state: connections.length === 0 ? 'gap' : 'ambiguous',
			connectionId: null,
			direction: null,
			authoredSeconds: null,
			seconds: null,
			lengthMeters: null,
			anchorCount: 0,
			anchors: [],
			sharedUses: [],
			samples: [],
			wall: null
		};
	}
	const connection = connections[0]!;
	const direction = connectionDirection(connection as SceneConnection, resolved.fromViewId, resolved.toViewId);
	if (direction === null) return null;
	const cache = readCacheFor(input.graph, input.geometry ?? null);
	const key = `${connection.id}:${direction}`;
	let computed = cache.get(key);
	if (computed === undefined) {
		const { motion } = pathMotionFor(connection as SceneConnection, direction, input.graph as unknown as CameraGraph);
		const samples = pathSamples(motion);
		computed = {
			motion,
			samples,
			wall: input.geometry == null ? null : routeCrossesWall({ samples, geometry: input.geometry })
		};
		cache.set(key, computed);
	}
	const { motion, samples, wall } = computed;
	// The canonical graph inserts generated endpoint anchors; only authored
	// interior points are counted, selected or written back.
	const anchors = connection.positionPath.anchors.slice(1, -1).map((anchor) => ({
		id: anchor.id,
		position: [...anchor.position] as Vec3
	}));
	const sharedUses = experiencePathOccurrences(experience, guide).filter((candidate) => {
		if (sameOccurrence(candidate.occurrence, occurrence)) return false;
		// A Cut has no visible Camera route; only an actual Travel sharing this
		// one connection is a shared use.
		if (candidate.transition !== 'travel') return false;
		const candidateConnections = graph.connections.filter(
			(entry) =>
				(entry.fromNodeId === candidate.fromViewId && entry.toNodeId === candidate.toViewId) ||
				(entry.toNodeId === candidate.fromViewId && entry.fromNodeId === candidate.toViewId)
		);
		return candidateConnections.length === 1 && candidateConnections[0]!.id === connection.id;
	});
	return {
		...base,
		state: 'ready',
		connectionId: connection.id,
		direction,
		authoredSeconds: connection.timing?.[direction]?.durationSeconds ?? null,
		seconds: motion.durationSeconds,
		lengthMeters: motion.totalPositionDistance,
		anchorCount: anchors.length,
		anchors,
		sharedUses,
		samples,
		wall
	};
}

/** A validated insertion slot in the connection's **authored** anchor order. */
export type PathAnchorInsertion = {
	readonly index: number;
	readonly position: Vec3;
};

/**
 * The one canonical insertion slot for a point on an evaluated Camera path.
 *	 * The nearest forward-curve progress is Camera's own (`findNearestCurveProgress`),
	 * and the slot counts the authored interior points whose progress lies before
	 * it. Direction is travel, not geometry: a reversed connection inserts at the
	 * same authored slot as its forward twin. The count is defined for both
	 * `auto-bezier` and `rounded-polyline`; it never assumes one curve per anchor.
 */
export function resolvePathAnchorInsertion(input: {
	readonly connection: SceneConnection;
	readonly direction: 'forward' | 'reverse';
	readonly graph: NavigationGraph;
	readonly point: Vec3;
}): PathAnchorInsertion | null {
	if (!Number.isFinite(input.point[0]) || !Number.isFinite(input.point[1]) || !Number.isFinite(input.point[2])) {
		return null;
	}
	// Geometry is direction-free: both directions are the same curve. Reading the
	// forward motion keeps the slot in authored order, so a reverse-travelled
	// connection inserts at the same place as its authored twin.
	const { motion } = pathMotionFor(input.connection, 'forward', input.graph as unknown as CameraGraph);
	const progress = findNearestCurveProgress(motion.positionPath, input.point);
	if (!Number.isFinite(progress)) return null;
	const anchors = input.connection.positionPath.anchors;
	if (anchors.length === 0) return { index: 0, position: [input.point[0], input.point[1], input.point[2]] };
	let directedSlot = 0;
	for (const anchor of anchors) {
		const anchorProgress = findNearestCurveProgress(motion.positionPath, anchor.position);
		if (!Number.isFinite(anchorProgress)) continue;
		if (anchorProgress < progress) directedSlot += 1;
	}
	const index = Math.max(0, Math.min(anchors.length, directedSlot));
	return { index, position: [input.point[0], input.point[1], input.point[2]] };
}

/** Whether this read is the one path the armed overlay may write. */
export function isPathEditTarget(
	read: ExperiencePathRead | null,
	selected: ExperiencePathRead | null
): boolean {
	// Sharing one connection is not enough: another Travel occurrence that uses
	// the same path is still a different visible route and must not write it.
	return read !== null && selected !== null && read.connectionId !== null && sameOccurrence(read.occurrence, selected.occurrence);
}

/** Whole seconds for whole values, one decimal otherwise. */
export function formatPathSeconds(seconds: number | null): string {
	if (seconds === null || !Number.isFinite(seconds)) return '—';
	const rounded = Math.round(seconds * 10) / 10;
	return Number.isInteger(rounded) ? `${rounded.toFixed(0)} s` : `${rounded.toFixed(1)} s`;
}

/** Route length to one decimal metre. */
export function formatPathLength(meters: number | null): string {
	if (meters === null || !Number.isFinite(meters)) return '—';
	return `${meters.toFixed(1)} m`;
}

/** `3 points · 12.4 m` */
export function formatPathFacts(read: ExperiencePathRead): string {
	const points = read.anchorCount;
	return `${points} ${points === 1 ? 'point' : 'points'} · ${formatPathLength(read.lengthMeters)}`;
}

/** A short name for an occurrence, used by the shared-path note. */
export function occurrenceLabel(read: ResolvedPathOccurrence, guideNames: readonly string[]): string {
	if (read.occurrence.kind === 'transition') {
		const index = guideNames.indexOf(read.occurrence.stopId);
		return index >= 0 ? `Stop ${index + 1} → ${index + 2}` : 'a Stop transition';
	}
	return 'a step inside a Stop';
}
