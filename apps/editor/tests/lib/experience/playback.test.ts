/**
 * R217.S30 — the ephemeral playback host.
 *
 * The clock is explicit frame delta, waits pause the transport until a fresh
 * Play, scrub addresses exact segment boundaries, Play from a Stop has no
 * incoming movement, Preview this move plays one occurrence, and an accepted
 * source edit invalidates the old run immediately.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	computeEnvelopeSourceContentId,
	lowerExperienceProgram,
	prepareUnitRuntime,
	type ExecutionProgram
} from '@portfolio/project-model/units';
import type { CameraGraph } from '@portfolio/camera-core';
import { experienceEnvelope, LOWERING_OPTIONS } from './fixtures';
import {
	createExperiencePlayback,
	shouldWritePlaybackSample,
	type PlaybackSource
} from '$lib/authoring/experience/playback.svelte';
import { guideTimeMapForProgram } from '$lib/authoring/experience/playback-map';

async function source(): Promise<PlaybackSource> {
	const envelope = await experienceEnvelope();
	const run = prepareUnitRuntime(envelope);
	if (run.kind !== 'ready') throw new Error('fixture did not prepare');
	const sourceContentId = await computeEnvelopeSourceContentId(envelope);
	const lowered = lowerExperienceProgram(envelope, { ...LOWERING_OPTIONS, sourceContentId });
	if (lowered.kind !== 'lowered') throw new Error(lowered.message);
	return {
		program: lowered.program,
		transitions: lowered.transitions,
		graph: run.graph as unknown as CameraGraph,
		entryStopId: 'stop-1'
	};
}

describe('R217.S30 playback', () => {
	it('plays holds and Travel, completes the terminal wait, then replays from the entry', async () => {
		const input = await source();
		const playback = createExperiencePlayback(() => input);
		playback.playPause();
		expect(playback.status).toBe('playing');
		// Still inside Stop 1's authored hold; the Travel has not started.
		playback.tick(0.4);
		expect(playback.activeStopId).toBe('stop-1');
		playback.tick(4.2);
		expect(playback.status).toBe('waiting');
		expect(playback.activeStopId).toBe('stop-2');
		// The final View is untimed, so the wait is terminal: a fresh Play has
		// nowhere to resume and the run is at its end.
		playback.playPause();
		expect(playback.status).toBe('ended');
		playback.playPause();
		expect(playback.status).toBe('playing');
		expect(playback.activeStopId).toBe('stop-1');
		expect(playback.elapsedLabel).toBe('0:00');
		playback.tick(0.4);
		expect(playback.cursor?.elapsedSeconds).toBeCloseTo(0.4);
	});

	it('scrubs to an exact addressable wait and normal scrub pauses', async () => {
		const input = await source();
		const playback = createExperiencePlayback(() => input);
		playback.playPause();
		const mapResult = guideTimeMapForProgram({
			program: input.program,
			transitions: input.transitions,
			graph: input.graph,
			entryStopId: input.entryStopId
		});
		if (mapResult.kind !== 'ready') throw new Error('map not ready');
		const wait = mapResult.map.segments.find((segment) => segment.kind === 'wait')!;
		playback.seekSegment(wait.id);
		expect(playback.status).toBe('paused');
		expect(playback.cursor?.segmentId).toBe(wait.id);
		playback.seek(0);
		expect(playback.status).toBe('paused');
	});

	it('plays from a Stop with no incoming movement, and from the start at the entry', async () => {
		const input = await source();
		const playback = createExperiencePlayback(() => input);
		playback.playFromStop('stop-2');
		expect(playback.activeStopId).toBe('stop-2');
		expect(playback.map?.segments[0]?.kind).toBe('cut');
		playback.playFromStart();
		expect(playback.activeStopId).toBe('stop-1');
	});

	it('previews one move and stops at its end', async () => {
		const input = await source();
		const playback = createExperiencePlayback(() => input);
		playback.previewMove({ kind: 'transition', stopId: 'stop-1' });
		expect(playback.status).toBe('playing');
		expect(playback.map?.segments).toHaveLength(1);
		playback.tick(4.1);
		expect(playback.status).toBe('ended');
	});

	it('derives on open, writes no Camera without Follow, and advances a seeked wait on Play', async () => {
		const input = await source();
		const playback = createExperiencePlayback(() => input);
		playback.prepare();
		expect(playback.status).toBe('idle');
		expect(playback.map).not.toBeNull();
		expect(playback.sample).not.toBeNull();
		// Plain play and scrub are bar/puck state, never an inspection write.
		expect(shouldWritePlaybackSample(playback.following, false)).toBe(false);
		const wait = playback.map!.segments.find((segment) => segment.kind === 'wait')!;
		playback.seek(wait.startSeconds);
		expect(playback.status).toBe('paused');
		// Seeking onto a wait respects that occurrence; the next Play moves past it.
		playback.playPause();
		expect(playback.status).toBe('ended');
		expect(shouldWritePlaybackSample(true, false)).toBe(true);
		expect(shouldWritePlaybackSample(true, true)).toBe(false);
	});

	it('keeps the accepted map and clock on the Stage, not in the Guide panel', () => {
		const page = readFileSync('src/routes/project/[projectId]/spatial/+page.svelte', 'utf8');
		const guide = readFileSync('src/lib/authoring/experience/ExperienceGuide.svelte', 'utf8');
		expect(page).toContain('createExperiencePlayback');
		expect(page).toContain('shouldWritePlaybackSample');
		expect(page).toContain('captureStandpoint');
		expect(page).toContain('restoreStandpoint');
		expect(page).toContain('playback.prepare()');
		expect(page).toContain('previewMode: (mode, guideId) => void openPreview(mode, guideId)');
		expect(guide).not.toContain('createExperiencePlayback');
		expect(guide).toContain('data-view-span');
		// The Card writers request transport through the host; only the host opens
		// the target Guide and commands the one clock.
		expect(readFileSync('src/lib/authoring/experience/ExperienceGuideWriter.svelte', 'utf8')).toContain("playGuide(guideId, { kind: 'start' })");
		expect(readFileSync('src/lib/authoring/experience/ExperienceStopWriter.svelte', 'utf8')).toContain("kind: 'stop'");
		expect(readFileSync('src/lib/authoring/experience/ExperienceTransitionWriter.svelte', 'utf8')).toContain("kind: 'move'");
		expect(page).toContain('playback: () => playback');
		expect(page).toContain('playback.playFromStart()');
		expect(page).toContain('playback.playFromStop(action.stopId)');
		expect(page).toContain('playback.previewMove(action.occurrence)');
	});

	it('invalidates immediately when the accepted source changes', async () => {
		const input = await source();
		const playback = createExperiencePlayback(() => input);
		playback.playFromStart();
		playback.invalidate();
		expect(playback.status).toBe('idle');
		expect(playback.map).toBeNull();
		expect(playback.sample).toBeNull();
	});

	it('carries the shell roles, type and 8 px / 44 px target metrics', () => {
		const guide = readFileSync('src/lib/authoring/experience/ExperienceGuide.svelte', 'utf8');
		expect(guide).toContain('data-playback-timeline');
		expect(guide).toContain('data-playback-total');
		expect(guide).toContain('--shell-gold');
		expect(guide).toContain('height: 8px');
		expect(guide).toContain('--shell-touch-target, 44px');
		expect(guide).toContain('min-height: 44px');
		expect(guide).not.toContain('Comes with Camera playback');
	});
});
