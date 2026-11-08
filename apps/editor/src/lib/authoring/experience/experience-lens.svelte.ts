/**
 * The Experience lens: the route-local posture that runs before adapter routing.
 *
 * It owns the ephemeral Guide playback session and the exact settled inspection Follow
 * restores. It never owns selection, history or Camera state: a Follow sample is written
 * through the Stage's one set-view intent, and the entry standpoint is restored through
 * Camera's own command.
 *
 * Construct it during route initialisation so its `$effect`s belong to the route's effect
 * tree. `dispose()` is idempotent: lens exit, project replacement and route teardown may
 * each ask, and only the first restore happens.
 */
import { tick, untrack } from 'svelte';
import type { ViewportCameraState } from '@portfolio/camera-core';
import type { StageFacade } from '../stage/stage-facade';
import type { ExperienceController } from './experience-controller.svelte';
import type { ExperienceGuideTransport } from './experience-homes';
import { guideTimeMapForProgram } from './playback-map';
import { createExperiencePlayback, shouldWritePlaybackSample } from './playback.svelte';

export type ExperienceLensHost = {
	/** The controller the lens shows; null in World. */
	activeController: () => ExperienceController | null;
	stage: () => StageFacade | null;
	lens: () => 'world' | 'experience';
	guideOpen: () => boolean;
	setGuideOpen: (open: boolean) => void;
	reducedMotion: () => boolean;
	previewOpen: () => boolean;
	previewBusy: () => boolean;
	previewRequested: () => boolean;
	lookThroughOpen: () => boolean;
	/** Play a View is armed or a placement press is live. */
	placementOpen: () => boolean;
	tool: () => 'select' | 'place';
	notice: (message: string) => void;
};

type PlaybackView = {
	readonly eye: [number, number, number];
	readonly target: [number, number, number];
	readonly fov: number;
};

export function createExperienceLens(host: ExperienceLensHost) {
	const playback = createExperiencePlayback(() => host.activeController()?.playbackSource ?? null);
	/** The exact settled inspection (pose **and** reading) Follow restores. */
	let entryStandpoint = $state.raw<ViewportCameraState | null>(null);
	/** The Stage that captured the standpoint; a replacement must never inherit it. */
	let entryStage = $state.raw<object | null>(null);
	/** A restore refused while a handoff owned the Camera; retry only on the same Stage. */
	let restorePending = $state.raw<{ readonly stage: object; readonly standpoint: ViewportCameraState } | null>(null);
	let disposed = false;

	/** Playback is a Guide instrument: any takeover or armed tool ends it. */
	const suppressed = $derived(
		host.previewOpen() ||
			host.previewBusy() ||
			host.previewRequested() ||
			host.lookThroughOpen() ||
			host.placementOpen() ||
			host.tool() === 'place' ||
			host.lens() !== 'experience' ||
			!host.guideOpen()
	);

	/** S30 playback writes the one Camera through a set-view intent, never a pose copy. */
	function applyView(view: PlaybackView): boolean {
		const stage = host.stage();
		if (stage === null) return false;
		const ticket = stage.inspectionTicket();
		if (ticket === null) return false;
		const result = stage.requestViewingIntent(
			{ kind: 'set-view', eye: view.eye, target: view.target, fovYDegrees: view.fov },
			ticket,
			performance.now() / 1000
		);
		return result.kind === 'accepted';
	}

	/** A Card transport action opens its own Guide; the rail need not be open first. */
	function guideSeconds(guideId: string): number | null {
		const source = host.activeController()?.playbackSourceFor(guideId) ?? null;
		if (source === null) return null;
		const map = guideTimeMapForProgram({
			program: source.program,
			transitions: source.transitions,
			graph: source.graph,
			entryStopId: source.entryStopId
		});
		return map.kind === 'ready' ? map.map.totalSeconds : null;
	}

	function playGuide(guideId: string, action: ExperienceGuideTransport): void {
		const controller = host.activeController();
		if (
			controller === null ||
			host.lens() !== 'experience' ||
			host.previewOpen() ||
			host.previewBusy() ||
			host.previewRequested() ||
			host.lookThroughOpen() ||
			host.placementOpen() ||
			host.tool() === 'place'
		) return;
		controller.openGuide(guideId);
		host.setGuideOpen(true);
		void tick().then(() => {
			if (host.activeController() !== controller || !host.guideOpen()) return;
			playback.prepare();
			if (action.kind === 'start') playback.playFromStart();
			else if (action.kind === 'stop') playback.playFromStop(action.stopId);
			else playback.previewMove(action.occurrence);
		});
	}

	/** Synchronously end Follow and restore its exact entry before any handoff. */
	function stopAndRestore(): void {
		const stage = host.stage();
		if (restorePending !== null && restorePending.stage !== stage) restorePending = null;
		playback.stop();
		if (entryStandpoint !== null) restoreEntry(stage);
	}

	function restoreEntry(stage: StageFacade | null = host.stage()): boolean {
		const standpoint = entryStandpoint;
		if (standpoint === null) return true;
		if (stage === null || entryStage !== stage) {
			// Never write an old Stage's standpoint into a replacement.
			entryStandpoint = null;
			entryStage = null;
			return false;
		}
		if (!stage.camera.restoreStandpoint(standpoint)) {
			restorePending = { stage, standpoint };
			return false;
		}
		entryStandpoint = null;
		entryStage = null;
		restorePending = null;
		return true;
	}

	/** Register the lens's lifecycle effects during route initialisation. */
	function install(): void {
	$effect(() => {
		const source = host.activeController()?.playbackSource ?? null;
		playback.setReducedMotion(host.reducedMotion());
		playback.setBlocked(suppressed);
		if (source === null || host.lens() !== 'experience' || !host.guideOpen()) {
			stopAndRestore();
			return;
		}
		// Derive as soon as the Guide opens; an accepted edit derives a new map
		// immediately and stops the old clock. Refused edits never reach here.
		if (playback.source !== source || playback.map === null) {
			if (playback.following) stopAndRestore();
			playback.invalidate();
			playback.prepare();
		}
	});
	$effect(() => {
		if (suppressed && playback.status !== 'idle') stopAndRestore();
	});
	$effect(() => {
		if (playback.following && entryStandpoint === null && host.stage() !== null) {
			entryStandpoint = host.stage()!.camera.captureStandpoint();
			entryStage = host.stage();
		}
	});
	$effect(() => {
		if (!playback.following && entryStandpoint !== null) restoreEntry();
	});
	$effect(() => {
		const stage = host.stage();
		void host.lookThroughOpen();
		void host.previewOpen();
		if (restorePending === null) return;
		if (host.lookThroughOpen() || host.previewOpen()) return;
		if (restorePending.stage !== stage) {
			restorePending = null;
			return;
		}
		const pending = restorePending;
		restorePending = null;
		restoreEntry(stage);
		void pending;
	});
	$effect(() => {
		// A replacement owns a new Camera: drop, never transplant, the old entry.
		const stage = host.stage();
		if (entryStage !== null && entryStage !== stage) {
			entryStandpoint = null;
			entryStage = null;
		}
		if (restorePending !== null && restorePending.stage !== stage) restorePending = null;
	});

	}

	/**
	 * The playback clock runs inside the Stage's own frame loop (`advancePlayback`,
	 * called just before the Camera is evaluated), so a Follow pose is written and
	 * drawn in the same frame.
	 */
	let playbackClock: number | null = null;
	let lastFollowSample: typeof playback.sample = null;
	function writeFollowSample(): void {
		const sample = playback.sample;
		if (sample === null || !shouldWritePlaybackSample(playback.following, suppressed)) {
			lastFollowSample = null;
			return;
		}
		if (sample === lastFollowSample) return;
		lastFollowSample = sample;
		const accepted = applyView({
			eye: [sample.eye[0], sample.eye[1], sample.eye[2]],
			target: [sample.target[0], sample.target[1], sample.target[2]],
			fov: sample.fov
		});
		// A refused write stops the run instead of letting the playhead drift on
		// a Camera the Stage no longer owns.
		if (!accepted) playback.fail('The Stage refused the playback camera.');
	}
	function advancePlayback(now: number): void {
		if (playback.status !== 'playing' || suppressed) {
			playbackClock = null;
		} else {
			if (playbackClock !== null) playback.tick((now - playbackClock) / 1000);
			playbackClock = now;
		}
		writeFollowSample();
	}
	// A seek, a Stop press or Follow turning on while paused writes at once; the
	// frame loop covers playing.
	$effect(() => {
		void playback.sample;
		void playback.following;
		untrack(() => writeFollowSample());
	});

	$effect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			if (event.key === 'Escape' && playback.following) {
				event.preventDefault();
				playback.setFollow(false);
				return;
			}
			if (event.key !== ' ' || !host.guideOpen() || host.lens() !== 'experience' || host.previewOpen()) return;
			if (host.activeController()?.busy === true || suppressed) return;
			const target = event.target;
			if (
				target instanceof HTMLElement &&
				target.closest('input, textarea, select, button, a[href], [contenteditable="true"], [role="menu"], [role="slider"]') !== null
			) return;
			event.preventDefault();
			playback.playPause();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	/** Idempotent: the first caller restores the entry and stops the session. */
	function dispose(): void {
		if (disposed) return;
		disposed = true;
		stopAndRestore();
	}

	return {
		playback,
		get suppressed() {
			return suppressed;
		},
		guideSeconds,
		playGuide,
		install,
		advancePlayback,
		stopAndRestore,
		dispose
	};
}

export type ExperienceLens = ReturnType<typeof createExperienceLens>;
