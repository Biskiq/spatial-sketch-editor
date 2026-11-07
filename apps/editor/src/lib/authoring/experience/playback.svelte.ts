/**
 * R217.S30 — the one ephemeral Guide playback session.
 *
 * It is host view state, never authored state: the map is derived from the
 * accepted program and Camera graph, the clock advances only by explicit frame
 * delta, and nothing here is written to F4, history, Save or the envelope.
 *
 * An accepted source edit invalidates the session immediately: the map, cursor
 * and sample are dropped, and the next Play derives from the new source. Refused
 * edits never reach this class, so they neither stop the clock nor create history.
 *
 * A wait is zero elapsed seconds and its own addressable occurrence: playback
 * stops on the first wait crossed, and a fresh Play moves past that wait.
 */
import {
	formatGuideTime,
	guideTimeCursorAt,
	nextGuideTimeSegment,
	normalizeGuideTimeCursor,
	sampleGuideTime,
	type CameraGraph,
	type GuideTimeCursor,
	type GuideTimeMap
} from '@portfolio/camera-core';
import type {
	ExecutionProgram,
	ExperienceProgramTransition
} from '@portfolio/project-model/units';
import type { ExperiencePathOccurrence } from './experience-paths';
import { guideTimeMapForProgram, movementTimeMap } from './playback-map';

export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'waiting' | 'ended';

export type PlaybackSource = {
	readonly program: ExecutionProgram;
	readonly transitions: readonly ExperienceProgramTransition[];
	readonly graph: CameraGraph;
	/** The Guide's authored start, so "Play from the start" is the tour's entry. */
	readonly entryStopId: string | null;
};

export type PlaybackView = {
	readonly status: PlaybackStatus;
	readonly map: GuideTimeMap | null;
	readonly cursor: GuideTimeCursor | null;
	readonly activeStopId: string | null;
	readonly activeViewId: string | null;
	readonly following: boolean;
	readonly sample: { readonly eye: readonly [number, number, number]; readonly target: readonly [number, number, number]; readonly fov: number } | null;
	readonly elapsedLabel: string;
	readonly totalLabel: string;
	readonly message: string;
};

/** A sample may drive the Stage only during Follow, never during plain play/scrub. */
export function shouldWritePlaybackSample(following: boolean, suppressed: boolean): boolean {
	return following && !suppressed;
}

export function createExperiencePlayback(read: () => PlaybackSource | null) {
	let status = $state<PlaybackStatus>('idle');
	let map = $state.raw<GuideTimeMap | null>(null);
	let cursor = $state<GuideTimeCursor | null>(null);
	let following = $state(false);
	let blocked = false;
	let sample = $state<PlaybackView['sample']>(null);
	let activeStopId = $state<string | null>(null);
	let activeViewId = $state<string | null>(null);
	let message = $state('');
	/** Set by the host from `prefers-reduced-motion`; affects insertion only. */
	let reducedMotion = false;
	/** The source the current map was derived from, for immediate invalidation. */
	let mapSource: PlaybackSource | null = null;

	function reset(): void {
		status = 'idle';
		map = null;
		cursor = null;
		sample = null;
		activeStopId = null;
		activeViewId = null;
		mapSource = null;
		// No reset path may leave Follow writing an old entry standpoint.
		following = false;
	}

	function readSource(): PlaybackSource | null {
		const source = read();
		if (source === null) return null;
		return source;
	}

	function derive(entryStopId: string | null): GuideTimeMap | null {
		const source = readSource();
		if (source === null) {
			message = 'There is no accepted Guide to play.';
			return null;
		}
		const derived = guideTimeMapForProgram({
			program: source.program,
			transitions: source.transitions,
			graph: source.graph,
			entryStopId
		});
		if (derived.kind !== 'ready') {
			message = derived.reason;
			reset();
			return null;
		}
		mapSource = source;
		map = derived.map;
		message = '';
		return derived.map;
	}

	function updateSample(): void {
		if (map === null || cursor === null) {
			sample = null;
			activeStopId = null;
			activeViewId = null;
			return;
		}
		const read = sampleGuideTime(map, cursor, { reducedMotion });
		if (read.kind === 'gap') {
			sample = null;
			activeStopId = null;
			activeViewId = null;
			message = read.reason;
			return;
		}
		sample = read.sample;
		activeStopId = read.stopId;
		activeViewId = read.viewId;
		if (status === 'ended') following = false;
	}

	function cursorSeconds(): number {
		if (map === null || cursor === null) return 0;
		const segment = map.segments.find((entry) => entry.id === cursor!.segmentId);
		return segment === undefined ? 0 : segment.startSeconds + cursor.elapsedSeconds;
	}

	function currentSegment() {
		if (map === null || cursor === null) return null;
		return map.segments.find((entry) => entry.id === cursor!.segmentId) ?? null;
	}

	/** The initial cursor: a wait at 0 s is the run's first occurrence. */
	function initialCursor(guideMap: GuideTimeMap): GuideTimeCursor {
		const wait = guideMap.segments.find(
			(segment) => segment.kind === 'wait' && segment.startSeconds === 0
		);
		return wait === undefined
			? guideTimeCursorAt(guideMap, 0)
			: { segmentId: wait.id, elapsedSeconds: 0 };
	}

	function seekTo(seconds: number): void {
		if (map === null || map.segments.length === 0) return;
		cursor = guideTimeCursorAt(map, seconds);
		updateSample();
	}

	function startAt(guideMap: GuideTimeMap, seconds: number): void {
		map = guideMap;
		if (guideMap.segments.length === 0) {
			status = 'idle';
			return;
		}
		// Starting on a wait (an untimed first View, or an all-wait Guide) enters
		// that occurrence and waits; only a fresh Play moves past it.
		cursor = seconds === 0 ? initialCursor(guideMap) : guideTimeCursorAt(guideMap, seconds);
		status = currentSegment()?.kind === 'wait' ? 'waiting' : 'playing';
		updateSample();
	}

	function pause(): void {
		if (status === 'playing') status = 'paused';
	}

	function resumePastWait(): void {
		if (map === null || cursor === null) return;
		const segment = map.segments.find((entry) => entry.id === cursor!.segmentId);
		if (segment === undefined || segment.kind !== 'wait') return;
		const next = nextGuideTimeSegment(map, cursor);
		if (next === null) {
			status = 'ended';
			following = false;
			return;
		}
		cursor = { segmentId: next.id, elapsedSeconds: 0 };
		// Each stacked wait is its own occurrence: entering the next wait pauses
		// again rather than silently skipping it.
		status = next.kind === 'wait' ? 'waiting' : 'playing';
		updateSample();
	}

	function tick(deltaSeconds: number): void {
		if (status !== 'playing' || map === null || cursor === null) return;
		if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
		let remaining = deltaSeconds;
		let current = normalizeGuideTimeCursor(map, cursor);
		if (current === null) {
			reset();
			return;
		}
		while (remaining > 0) {
			const segment = map.segments.find((entry) => entry.id === current!.segmentId);
			if (segment === undefined) {
				status = 'ended';
				updateSample();
				return;
			}
			// A Cut, zero hold or wait consumes no elapsed time: playback passes
			// through it and only stops when the next segment is a wait.
			if (segment.durationSeconds <= 0) {
				const next = nextGuideTimeSegment(map, current);
				if (next === null) {
					cursor = { segmentId: segment.id, elapsedSeconds: 0 };
					status = 'ended';
					updateSample();
					return;
				}
				if (next.kind === 'wait') {
					cursor = { segmentId: next.id, elapsedSeconds: 0 };
					status = 'waiting';
					updateSample();
					return;
				}
				current = { segmentId: next.id, elapsedSeconds: 0 };
				cursor = current;
				continue;
			}
			const localRemaining = Math.max(0, segment.durationSeconds - current.elapsedSeconds);
			if (remaining < localRemaining) {
				current = { segmentId: segment.id, elapsedSeconds: current.elapsedSeconds + remaining };
				remaining = 0;
				cursor = current;
				break;
			}
			remaining -= localRemaining;
			const next = nextGuideTimeSegment(map, current);
			if (next === null) {
				cursor = { segmentId: segment.id, elapsedSeconds: segment.durationSeconds };
				status = 'ended';
				updateSample();
				return;
			}
			// Playback pauses on the first wait crossed; a fresh Play passes it.
			if (next.kind === 'wait') {
				cursor = { segmentId: next.id, elapsedSeconds: 0 };
				status = 'waiting';
				updateSample();
				return;
			}
			current = { segmentId: next.id, elapsedSeconds: 0 };
			cursor = current;
			if (next.durationSeconds === 0) continue;
		}
		updateSample();
	}

	return {
		get status() {
			return status;
		},
		get map() {
			return map;
		},
		get cursor() {
			return cursor;
		},
		get following() {
			return following;
		},
		get sample() {
			return sample;
		},
		get activeStopId() {
			return activeStopId;
		},
		get activeViewId() {
			return activeViewId;
		},
		get message() {
			return message;
		},
		get elapsedLabel() {
			return formatGuideTime(cursorSeconds());
		},
		get totalLabel() {
			return map === null ? '0:00' : formatGuideTime(map.totalSeconds);
		},
		get reducedMotion() {
			return reducedMotion;
		},
		setReducedMotion(value: boolean): void {
			reducedMotion = value;
			updateSample();
		},
		/** The accepted source changed: the old clock is invalid at once. */
		invalidate(): void {
			if (status === 'idle' && map === null) return;
			reset();
		},
		/**
		 * Derive the accepted map without starting the clock. The bar, Stop times,
		 * playhead and initial scrub exist as soon as the Guide opens.
		 */
		prepare(): void {
			const source = readSource();
			if (source === null) {
				if (map !== null) reset();
				return;
			}
			if (mapSource === source && map !== null) return;
			const derived = derive(source.entryStopId);
			if (derived === null) return;
			cursor = initialCursor(derived);
			status = 'idle';
			updateSample();
		},
		/** Drop playback when the Guide closes, the lens changes or Preview opens. */
		stop(): void {
			reset();
		},
		/** A suppressed instrument must not be restarted by Space or a Card action. */
		setBlocked(value: boolean): void {
			blocked = value;
		},
		playPause(): void {
			if (blocked) return;
			if (status === 'playing') {
				pause();
				return;
			}
			if (status === 'waiting') {
				resumePastWait();
				return;
			}
			if (map !== null && status === 'ended') {
				// A finished run plays again from its own entry, never from a stale end.
				startAt(map, 0);
				return;
			}
			if (currentSegment()?.kind === 'wait') {
				if (status === 'idle') {
					// Entering the run's first wait pauses on it.
					status = 'waiting';
					updateSample();
					return;
				}
				resumePastWait();
				return;
			}
			if (map !== null && cursor !== null && status === 'paused') {
				status = 'playing';
				return;
			}
			if (map !== null && cursor !== null && status === 'idle') {
				status = 'playing';
				return;
			}

			const derived = derive(readSource()?.entryStopId ?? null);
			if (derived !== null) startAt(derived, 0);
		},
		/** Normal scrub pauses the transport and lands on the exact segment. */
		seek(seconds: number): void {
			if (map === null) {
				const derived = derive(readSource()?.entryStopId ?? null);
				if (derived === null) return;
			}
			status = status === 'ended' ? 'paused' : status === 'playing' ? 'paused' : status === 'waiting' ? 'paused' : status;
			if (status === 'idle') status = 'paused';
			seekTo(seconds);
		},
		/**
		 * Review round 3: the Guide reads like a video timeline. Pressing a Stop (or the
		 * move after it) moves the playhead to that Stop's start (or end) in the Guide's
		 * own run; a playing run keeps playing from there, anything else pauses there.
		 */
		seekStop(stopId: string, edge: 'start' | 'end' = 'start'): void {
			if (blocked) return;
			if (map === null) {
				const derived = derive(readSource()?.entryStopId ?? null);
				if (derived === null) return;
			}
			const entry = map!.stopEntries.find((candidate) => candidate.stopId === stopId);
			if (entry === undefined) return;
			const keepPlaying = status === 'playing';
			seekTo(edge === 'start' ? entry.startSeconds : entry.endSeconds);
			status = keepPlaying ? (currentSegment()?.kind === 'wait' ? 'waiting' : 'playing') : 'paused';
			updateSample();
		},
		/** A pointer hit on a hatch lands exactly on that addressable wait. */
		seekSegment(segmentId: string): void {
			if (map === null) return;
			const segment = map.segments.find((entry) => entry.id === segmentId);
			if (segment === undefined) return;
			if (status === 'playing' || status === 'waiting') status = 'paused';
			if (status === 'idle' || status === 'ended') status = 'paused';
			cursor = { segmentId, elapsedSeconds: 0 };
			updateSample();
		},
		/** The Guide's authored entry, from the top. */
		playFromStart(): void {
			if (blocked) return;
			const source = readSource();
			if (source === null) return;
			const derived = derive(source.entryStopId);
			if (derived !== null) startAt(derived, 0);
		},
		/** A Stop's first View, with no incoming movement. */
		playFromStop(stopId: string): void {
			if (blocked) return;
			const source = readSource();
			if (source === null) return;
			const derived = derive(stopId);
			if (derived === null) return;
			const entry = derived.stopEntries.find((candidate) => candidate.stopId === stopId);
			if (entry === undefined) {
				message = `Stop "${stopId}" is not in this Guide's run.`;
				reset();
				return;
			}
			startAt(derived, entry.startSeconds);
		},
		/** Preview this move: the chosen occurrence only, then the end. */
		previewMove(occurrence: ExperiencePathOccurrence): void {
			if (blocked) return;
			const source = readSource();
			if (source === null) return;
			const derived = movementTimeMap({
				occurrence,
				program: source.program,
				transitions: source.transitions,
				graph: source.graph
			});
			if (derived === null) {
				message = 'That move is no longer part of this Guide.';
				return;
			}
			if (derived.kind !== 'ready') {
				message = derived.reason;
				reset();
				return;
			}
			mapSource = source;
			map = derived.map;
			message = '';
			// A Cut settles immediately and the move is already at its end.
			if (derived.map.totalSeconds <= 0) {
				cursor = guideTimeCursorAt(derived.map, 0);
				status = 'ended';
				updateSample();
				return;
			}
			startAt(derived.map, 0);
		},
		setFollow(enabled: boolean): void {
			following = enabled && status !== 'idle' && status !== 'ended';
		},
		/** The host reports a rejected Camera write; playback stops rather than drifting. */
		fail(reason: string): void {
			message = reason;
			reset();
			following = false;
		},
		tick,
		/** The source object the live map was derived from, if any. */
		get source() {
			return mapSource;
		}
	};
}

export type ExperiencePlayback = ReturnType<typeof createExperiencePlayback>;
