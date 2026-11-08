/**
 * R217.S30 — the ephemeral playback host.
 *
 * The clock is explicit frame delta, waits pause the transport until a fresh
 * Play, scrub addresses exact segment boundaries, Play from a Stop has no
 * incoming movement, Preview this move plays one occurrence, and an accepted
 * source edit invalidates the old run immediately.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDITOR_LIB, EDITOR_SRC, constructsImportedOwner, importClosure, stripComments } from '../../helpers/import-closure';
import {
	computeEnvelopeSourceContentId,
	lowerExperienceProgram,
	prepareUnitRuntime,
	type ExecutionProgram
} from '@portfolio/project-model/units';
import { formatGuideTime, type CameraGraph } from '@portfolio/camera-core';
import { EXPERIENCE, experienceEnvelope, LOWERING_OPTIONS } from './fixtures';
import {
	createExperiencePlayback,
	shouldWritePlaybackSample,
	type PlaybackSource
} from '$lib/authoring/experience/playback.svelte';
import { guideTimeMapForProgram } from '$lib/authoring/experience/playback-map';

async function source(pacing: 'automatic' | 'manual' = 'automatic'): Promise<PlaybackSource> {
	const envelope = await experienceEnvelope({
		experience: {
			...EXPERIENCE,
			experiences: EXPERIENCE.experiences.map((experience) => ({
				...experience,
				guides: experience.guides.map((guide) => ({ ...guide, pacing }))
			}))
		}
	});
	const run = prepareUnitRuntime(envelope);
	if (run.kind !== 'ready') throw new Error('fixture did not prepare');
	const sourceContentId = await computeEnvelopeSourceContentId(envelope);
	const lowered = lowerExperienceProgram(envelope, { ...LOWERING_OPTIONS, sourceContentId });
	if (lowered.kind !== 'lowered') throw new Error(lowered.message);
	return {
		program: lowered.program,
		transitions: lowered.transitions,
		graph: run.graph as unknown as CameraGraph,
		entryStopId: lowered.program.entryStopId,
		};
}

describe('R217.S30 playback', () => {
	it('plays stays and Travel in Automatic, and stops at every Stop in Manual', async () => {
		const automatic = createExperiencePlayback(() => auto);
		const auto = await source();
		automatic.playPause();
		automatic.tick(0.4);
		expect(automatic.activeStopId).toBe('stop-1');
		// 1 s stay + 4 s Travel + 2 s stay: the run ends after 7 s.
		automatic.tick(6.7);
		expect(automatic.status).toBe('ended');

		const input = await source('manual');
		const playback = createExperiencePlayback(() => input);
		playback.playPause();
		expect(playback.status).toBe('waiting');
		expect(playback.activeStopId).toBe('stop-1');
		playback.playPause();
		expect(playback.status).toBe('playing');
		playback.tick(4.2);
		expect(playback.status).toBe('waiting');
		expect(playback.activeStopId).toBe('stop-2');
		// The last Stop's wait is terminal: a fresh Play has nowhere to resume.
		playback.playPause();
		expect(playback.status).toBe('ended');
		// A finished run plays again from its own entry, which waits in Manual.
		playback.playPause();
		expect(playback.status).toBe('waiting');
		expect(playback.activeStopId).toBe('stop-1');
		expect(playback.elapsedLabel).toBe('0:00');
	});

	it('scrubs to an exact addressable wait and normal scrub pauses', async () => {
		const input = await source('manual');
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
		const input = await source('manual');
		const playback = createExperiencePlayback(() => input);
		playback.prepare();
		expect(playback.status).toBe('idle');
		expect(playback.map).not.toBeNull();
		expect(playback.sample).not.toBeNull();
		// Plain play and scrub are bar/puck state, never an inspection write.
		expect(shouldWritePlaybackSample(playback.following, false)).toBe(false);
		const wait = playback.map!.segments.filter((segment) => segment.kind === 'wait').at(-1)!;
		playback.seek(wait.startSeconds);
		expect(playback.status).toBe('paused');
		// Seeking onto a wait respects that occurrence; the next Play moves past it.
		playback.playPause();
		expect(playback.status).toBe('ended');
		expect(shouldWritePlaybackSample(true, false)).toBe(true);
		expect(shouldWritePlaybackSample(true, true)).toBe(false);
	});

	it('keeps the accepted map and clock on the Stage, not in the Guide panel', () => {
		const route = path.join(EDITOR_SRC, 'routes/project/[projectId]/spatial/+page.svelte');
		const experience = path.join(EDITOR_LIB, 'authoring/experience');
		const sources = [...importClosure([route])]
			.filter((file) => file === route || file.startsWith(`${experience}${path.sep}`))
			.filter((file) => /\.(svelte|ts)$/.test(file))
			.map((file) => ({ file, code: stripComments(readFileSync(file, 'utf8')) }));
		const owners = sources.filter(({ code }) => /\bconst playback = createExperiencePlayback\(/.test(code));
		expect(owners.map(({ file }) => file)).toHaveLength(1);
		if (owners[0]!.file !== route) {
			expect(constructsImportedOwner(route, readFileSync(route, 'utf8'), owners[0]!.file, 'createExperienceLens')).toBe(true);
		}
		const page = owners[0]!.code;
		const routeCode = stripComments(readFileSync(route, 'utf8'));
		const guide = readFileSync('src/lib/authoring/experience/ExperienceGuide.svelte', 'utf8');
		expect(page).toContain('createExperiencePlayback');
		expect(page).toContain('shouldWritePlaybackSample');
		expect(page).toContain('captureStandpoint');
		expect(page).toContain('restoreStandpoint');
		expect(page).toContain('playback.prepare()');
		expect(routeCode).toContain('previewMode: (mode, guideId) => void previewController.open(mode, guideId)');
		expect(guide).not.toContain('createExperiencePlayback');
		expect(guide).toContain('data-view-span');
		// The strip requests transport through the host; only the host opens the
		// target Guide and commands the one clock. The Experience Card has no transport.
		expect(readFileSync('src/lib/authoring/experience/ExperienceExperienceWriter.svelte', 'utf8')).not.toContain('playGuide(');
		expect(readFileSync('src/lib/authoring/experience/ExperienceStopWriter.svelte', 'utf8')).toContain("kind: 'stop'");
		expect(readFileSync('src/lib/authoring/experience/ExperienceTransitionWriter.svelte', 'utf8')).toContain("kind: 'move'");
		expect(routeCode).toContain('playback: () => experienceLens.playback');
		expect(routeCode).toContain('experienceLens.install()');
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
		// Owner review (5 Nov): the strip's highlight is gold, and its one track is a 3 px rail.
		expect(guide).toContain('--shell-gold');
		expect(guide).toContain('height: 3px');
		expect(guide).toContain('--shell-touch-target, 44px');
		expect(guide).toContain('min-height: 44px');
		expect(guide).not.toContain('Comes with Camera playback');
	});
});

describe('Review round 3 — the Guide reads like a video timeline', () => {
	it('a pressed Stop moves the playhead into the whole run, paused, and a playing run keeps playing', async () => {
		const input = await source();
		const playback = createExperiencePlayback(() => input);
		playback.seekStop('stop-2');
		expect(playback.status).toBe('paused');
		expect(playback.activeStopId).toBe('stop-2');
		// The run is the Guide's own, from its entry: not a run that starts at Stop 2.
		expect(playback.map?.stopEntries[0]?.stopId).toBe('stop-1');
		const entry = playback.map!.stopEntries.find((candidate) => candidate.stopId === 'stop-2')!;
		expect(playback.elapsedLabel).toBe(formatGuideTime(entry.startSeconds));

		playback.seekStop('stop-1');
		playback.playPause();
		expect(playback.status).toBe('playing');
		playback.seekStop('stop-2');
		expect(playback.status).toBe('playing');
		expect(playback.activeStopId).toBe('stop-2');
	});

	it('has no Play-from menu: ▶ plays from the playhead, and pressing a Stop or a move seeks', () => {
		const guide = readFileSync('src/lib/authoring/experience/ExperienceGuide.svelte', 'utf8');
		expect(guide).not.toContain('Play from…');
		expect(guide).not.toContain('transport-menu');
		expect(guide).toContain("playback.seekStop(stopId, 'start')");
		expect(guide).toContain("playback.seekStop(stopId, 'end')");
	});
});
