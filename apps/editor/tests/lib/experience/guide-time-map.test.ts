/**
 * R217.S30 — the Guide time map contract.
 *
 * One derived read owns the bar, the total, scrub, play and every Stop time:
 * holds are authored seconds, Cut/zero hold/waits occupy zero seconds but stay
 * addressable, Travel uses Camera's exact directed motion, and reduced motion
 * settles to the destination without changing the displayed seconds.
 */
import { describe, expect, it } from 'vitest';
import {
	buildGuideTimeMap,
	formatGuideTotal,
	formatGuideWaits,
	guideTimeCursorAt,
	nextGuideTimeSegment,
	sampleGuideTime,
	type GuideTimeOccurrenceInput
} from '@portfolio/camera-core';
import {
	computeEnvelopeSourceContentId,
	lowerExperienceProgram,
	prepareUnitRuntime
} from '@portfolio/project-model/units';
import { experienceEnvelope, LOWERING_OPTIONS } from './fixtures';
import { guideTimeMapForProgram } from '$lib/authoring/experience/playback-map';

async function fixture() {
	const envelope = await experienceEnvelope();
	const run = prepareUnitRuntime(envelope);
	if (run.kind !== 'ready') throw new Error('fixture did not prepare');
	const sourceContentId = await computeEnvelopeSourceContentId(envelope);
	const lowered = lowerExperienceProgram(envelope, { ...LOWERING_OPTIONS, sourceContentId });
	if (lowered.kind !== 'lowered') throw new Error(lowered.message);
	return { envelope, graph: run.graph, program: lowered.program, transitions: lowered.transitions };
}

const CUT = (viewId: string) => ({ kind: 'cut' as const, viewId });

describe('R217.S30 Guide time map', () => {
	it('times holds, Cut and waits from the real lowered program; Camera owns the Travel seconds', async () => {
		const { graph, program, transitions } = await fixture();
		const result = guideTimeMapForProgram({ program, transitions, graph });
		expect(result.kind).toBe('ready');
		if (result.kind !== 'ready') return;
		const map = result.map;
		// arrival Cut (0) + 1 s stay + 4 s authored Travel + 2 s stay: one View per Stop.
		expect(map.totalSeconds).toBe(7);
		expect(map.waitCount).toBe(0);
		expect(map.segments.map((segment) => segment.kind)).toEqual(['cut', 'hold', 'travel', 'hold']);
		expect(map.segments.map((segment) => segment.durationSeconds)).toEqual([0, 1, 4, 2]);
		expect(formatGuideTotal(map)).toBe('0:07');
		expect(formatGuideWaits(2)).toBe('+ 2 waits');
		// Both zero-length and timed segments at 0 s stay distinct through the cursor.
		expect(map.boundaries[0]!.segmentIds.length).toBe(2);
		const start = guideTimeCursorAt(map, 0);
		expect(map.segments.find((segment) => segment.id === start.segmentId)!.kind).toBe('cut');
	});

	it('maps Manual pacing as a wait at every Stop, keeping the Travel time', async () => {
		const { graph, program, transitions } = await fixture();
		const manual = {
			...program,
			pacing: 'manual' as const,
			stops: program.stops.map((stop) => ({ ...stop, staySeconds: null })),
			localTime: []
		};
		const result = guideTimeMapForProgram({ program: manual, transitions, graph });
		if (result.kind !== 'ready') throw new Error('map not ready');
		expect(result.map.segments.map((segment) => segment.kind)).toEqual(['cut', 'wait', 'travel', 'wait']);
		expect(result.map.totalSeconds).toBe(4);
		expect(formatGuideTotal(result.map)).toBe('0:04 + 2 waits');
	});

	it('samples the authored pose, mid-travel motion and the reduced-motion destination', async () => {
		const { graph, program, transitions } = await fixture();
		const result = guideTimeMapForProgram({ program, transitions, graph });
		if (result.kind !== 'ready') throw new Error('map not ready');
		const map = result.map;
		const hold = map.segments.find((segment) => segment.kind === 'hold')!;
		const held = sampleGuideTime(map, { segmentId: hold.id, elapsedSeconds: 0.5 });
		expect(held.kind).toBe('camera');
		if (held.kind !== 'camera') return;
		expect(held.sample.eye).toEqual([0, 1.6, 2]);
		const travel = map.segments.find((segment) => segment.kind === 'travel')!;
		const mid = sampleGuideTime(map, { segmentId: travel.id, elapsedSeconds: 2 });
		const settled = sampleGuideTime(
			map,
			{ segmentId: travel.id, elapsedSeconds: 0 },
			{ reducedMotion: true }
		);
		expect(mid.kind).toBe('camera');
		expect(settled.kind).toBe('camera');
		if (mid.kind !== 'camera' || settled.kind !== 'camera') return;
		expect(mid.sample.eye).not.toEqual([0, 1.6, 2]);
		expect(mid.sample.eye).not.toEqual([4, 1.6, 2]);
		// Reduced motion settles at the destination; the segment still displays 4 s.
		expect(settled.sample.eye).toEqual([4, 1.6, 2]);
		expect(travel.durationSeconds).toBe(4);
	});

	it('addresses an initial wait and each stacked all-wait occurrence', () => {
		const graph = { nodeById: new Map(), connections: [] } as never;
		const occurrences: GuideTimeOccurrenceInput[] = [
			{
				occurrenceId: '1:a',
				stopId: 'a',
				presentationId: 'p',
				views: [{ viewId: 'v1', holdSeconds: null, step: null }],
				arrival: CUT('v1')
			},
			{
				occurrenceId: '2:b',
				stopId: 'b',
				presentationId: 'p',
				views: [{ viewId: 'v1', holdSeconds: null, step: null }],
				arrival: CUT('v1')
			}
		];
		const result = buildGuideTimeMap({ occurrences, graph });
		expect(result.kind).toBe('ready');
		if (result.kind !== 'ready') return;
		const map = result.map;
		expect(map.totalSeconds).toBe(0);
		expect(map.waitCount).toBe(2);
		// Both waits sit at 0 s. Starting must enter the first, not skip to the Cut.
		const first = guideTimeCursorAt(map, 0);
		const firstSegment = map.segments.find((segment) => segment.id === first.segmentId)!;
		expect(firstSegment.kind).toBe('wait');
		// The next occurrence's arrival Cut follows that wait; the wait after it is
		// the next stop, so each stacked wait remains its own addressable occurrence.
		const next = nextGuideTimeSegment(map, first);
		expect(next?.kind).toBe('cut');
		const nextWait = next === null ? null : nextGuideTimeSegment(map, { segmentId: next.id, elapsedSeconds: 0 });
		expect(nextWait?.kind).toBe('wait');
		expect(nextWait?.id).not.toBe(firstSegment.id);
	});

	it('refuses a Travel whose connection does not join the logical predecessor', () => {
		const graph = {
			nodeById: new Map(),
			connections: []
		} as never;
		const occurrences: GuideTimeOccurrenceInput[] = [
			{
				occurrenceId: '1:a',
				stopId: 'a',
				presentationId: 'p',
				views: [{ viewId: 'v1', holdSeconds: 1, step: null }],
				arrival: CUT('v1')
			}
		];
		const gap = buildGuideTimeMap({ occurrences, graph });
		expect(gap.kind).toBe('ready');
	});

	it('refuses an untimed Travel with no graph connection instead of inventing one', () => {
		const graph = { nodeById: new Map(), connections: [] } as never;
		const occurrences: GuideTimeOccurrenceInput[] = [
			{
				occurrenceId: '1:a',
				stopId: 'a',
				presentationId: 'p',
				views: [{ viewId: 'v1', holdSeconds: 1, step: null }],
				arrival: CUT('v1')
			},
			{
				occurrenceId: '2:b',
				stopId: 'b',
				presentationId: 'p',
				views: [{ viewId: 'v2', holdSeconds: null, step: null }],
				arrival: { kind: 'travel', connectionId: 'missing' }
			}
		];
		const result = buildGuideTimeMap({ occurrences, graph });
		expect(result.kind).toBe('gap');
	});
});
