/**
 * Experience profile controllers — guided, free and reduced motion (T3.P01.S06).
 *
 * These controllers translate an editorial invocation into a **Camera intent**:
 * a Cut realizes a resolved View, a Travel names one real Camera connection. They
 * add no pose, FOV, path or timing authority: travel geometry and directed timing
 * come from `getCameraConnectionRoute` / `getCameraMotionOptions`, and the Camera
 * engine evaluates the samples. A missing route is a typed gap, never an implicit
 * Cut and never a graph search from Experience.
 *
 * No controller owns renderer state, OrbitControls, Svelte or an animation loop.
 */

import {
	getCameraConnectionRoute,
	getCameraMotionOptions,
	type ResolvedCameraRoute
} from './camera-route';
import type { CameraMotionOptions, CameraPose } from './camera-motion';
import type { CameraGraph } from './navigation';
import type { CameraConnectionDirection } from './scene-types';

export type ExperienceControlInvocation =
	| { readonly kind: 'cut'; readonly viewId: string }
	| { readonly kind: 'travel'; readonly connectionId: string };

export type ExperienceControlStop = {
	readonly stopId: string;
	readonly viewId: string;
	readonly invocation: ExperienceControlInvocation;
	readonly holdSeconds: number | null;
};

export type ExperienceControlProgram = {
	readonly stops: readonly ExperienceControlStop[];
};

export type GuidedCameraIntent =
	| {
			readonly kind: 'cut';
			readonly stopId: string;
			readonly viewId: string;
			readonly holdSeconds: number | null;
			readonly route: null;
			readonly motionOptions: null;
	  }
	| {
			readonly kind: 'travel';
			readonly stopId: string;
			readonly connectionId: string;
			readonly direction: CameraConnectionDirection;
			readonly holdSeconds: number | null;
			readonly route: ResolvedCameraRoute;
			readonly motionOptions: CameraMotionOptions;
	  }
	| {
			readonly kind: 'gap';
			readonly stopId: string;
			readonly fromViewId: string | null;
			readonly toViewId: string;
			readonly message: string;
	  };

function findStop(program: ExperienceControlProgram, stopId: string): ExperienceControlStop | null {
	return program.stops.find((stop) => stop.stopId === stopId) ?? null;
}

function previousStop(
	program: ExperienceControlProgram,
	stopId: string,
	fromStopId: string | undefined
): ExperienceControlStop | null {
	if (fromStopId !== undefined) return findStop(program, fromStopId);
	const index = program.stops.findIndex((stop) => stop.stopId === stopId);
	return index > 0 ? program.stops[index - 1]! : null;
}

/**
 * The guided intent for one Stop occurrence.
 *
 * A Cut is complete without a route. A Travel must name a connection joining the
 * previous occurrence's View to this Stop's View; anything else reports a gap
 * that names both Views and refuses to play.
 */
export function guidedIntent(
	program: ExperienceControlProgram,
	graph: CameraGraph,
	stopId: string,
	fromStopId?: string
): GuidedCameraIntent {
	const stop = findStop(program, stopId);
	if (stop === null) {
		return { kind: 'gap', stopId, fromViewId: null, toViewId: '', message: `no Stop "${stopId}" is declared` };
	}
	if (stop.invocation.kind === 'cut') {
		return {
			kind: 'cut',
			stopId,
			viewId: stop.invocation.viewId,
			holdSeconds: stop.holdSeconds,
			route: null,
			motionOptions: null
		};
	}
	const previous = previousStop(program, stopId, fromStopId);
	const fromViewId = previous?.viewId ?? null;
	// Destructured after the Cut branch: the narrowing must not be lost inside
	// the find callback below.
	const invocation = stop.invocation;
	const connection = graph.connections.find((candidate) => candidate.id === invocation.connectionId);
	if (connection === undefined) {
		return {
			kind: 'gap',
			stopId,
			fromViewId,
			toViewId: stop.viewId,
			message: `Travel over connection "${invocation.connectionId}" has no Camera connection`
		};
	}
	const forward = connection.fromNodeId === fromViewId && connection.toNodeId === stop.viewId;
	const reverse = connection.fromNodeId === stop.viewId && connection.toNodeId === fromViewId;
	if (fromViewId === null || (!forward && !reverse)) {
		return {
			kind: 'gap',
			stopId,
			fromViewId,
			toViewId: stop.viewId,
			message:
				fromViewId === null
					? 'Travel needs a previous occurrence View'
					: `connection "${connection.id}" joins "${connection.fromNodeId}" and "${connection.toNodeId}", not "${fromViewId}" and "${stop.viewId}"`
		};
	}
	const direction: CameraConnectionDirection = forward ? 'forward' : 'reverse';
	try {
		return {
			kind: 'travel',
			stopId,
			connectionId: connection.id,
			direction,
			holdSeconds: stop.holdSeconds,
			route: getCameraConnectionRoute(connection.id, direction, graph),
			motionOptions: getCameraMotionOptions(connection, direction)
		};
	} catch (error) {
		return {
			kind: 'gap',
			stopId,
			fromViewId,
			toViewId: stop.viewId,
			message: error instanceof Error ? error.message : 'the Camera route could not be resolved'
		};
	}
}

export type GuidedController = {
	readonly ownership: 'guided-navigation';
	readonly intentFor: (stopId: string, fromStopId?: string) => GuidedCameraIntent;
};

/** Guided travel: the ordered program, evaluated through the Camera authority. */
export function createGuidedController(
	program: ExperienceControlProgram,
	graph: CameraGraph
): GuidedController {
	return {
		ownership: 'guided-navigation',
		intentFor: (stopId, fromStopId) => guidedIntent(program, graph, stopId, fromStopId)
	};
}

export type FreeRejoinIntent = {
	readonly kind: 'cut';
	readonly stopId: string;
	readonly viewId: string;
	/** The actual pose the visitor left; rejoin evaluates from it, never a guessed one. */
	readonly fromPose: CameraPose;
	readonly autoplay: 'paused';
	readonly ownership: 'free-navigation';
};

export type FreeController = {
	readonly ownership: 'free-navigation';
	readonly autoplay: 'paused';
	readonly rejoin: (stopId: string, fromPose: CameraPose) => FreeRejoinIntent | null;
};

/**
 * Free navigation releases guided control. Rejoining resolves the destination
 * View as a Cut from the visitor's actual current pose and leaves autoplay
 * paused; it never resumes the guided timeline from where it was.
 */
export function createFreeController(program: ExperienceControlProgram): FreeController {
	return {
		ownership: 'free-navigation',
		autoplay: 'paused',
		rejoin(stopId, fromPose) {
			const stop = findStop(program, stopId);
			if (stop === null) return null;
			return {
				kind: 'cut',
				stopId,
				viewId: stop.viewId,
				fromPose,
				autoplay: 'paused',
				ownership: 'free-navigation'
			};
		}
	};
}

export type ReducedMotionIntent = {
	readonly kind: 'cut';
	readonly stopId: string;
	readonly viewId: string;
	readonly reducedMotion: true;
};

export type ReducedMotionController = {
	readonly ownership: 'guided-navigation';
	readonly travel: 'disabled';
	readonly intentFor: (stopId: string) => ReducedMotionIntent | null;
};

/**
 * Reduced motion reaches the **same destination** without accelerated travel:
 * every invocation resolves to a Cut of the target View, and no Travel is played.
 * The preference cannot be disabled by the visitor profile (AM-6 requires it).
 */
export function createReducedMotionController(program: ExperienceControlProgram): ReducedMotionController {
	return {
		ownership: 'guided-navigation',
		travel: 'disabled',
		intentFor(stopId) {
			const stop = findStop(program, stopId);
			return stop === null
				? null
				: { kind: 'cut', stopId, viewId: stop.viewId, reducedMotion: true };
		}
	};
}
