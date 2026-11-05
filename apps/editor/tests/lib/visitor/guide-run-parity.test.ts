/**
 * One Guide clock (guide-playback plan, slice 4): a replayed run's arrival
 * times equal the time map's.
 *
 * The interpreter counts stays and the time map derives them; both read
 * `staySeconds`, and both take Travel time from the Camera. This test drives the
 * one reducer the way every visitor surface does — ticks only while a Stop
 * stays, the Camera realizing each arrival Travel for its directed duration and
 * then confirming the arrival — and requires that each stay starts exactly when
 * the visitor-safe map says it does, and that the run ends at the map's total.
 */
import { describe, expect, it } from 'vitest';
import { buildGuideMovementMap } from '@portfolio/camera-core';
import {
	computeEnvelopeSourceContentId,
	createExperienceRun,
	lowerExperienceProgram,
	prepareUnitRuntime,
	reduceExperience,
	type ExecutionProgram,
	type ExperienceEvent,
	type ExperienceProgramTransition,
	type ExperienceRunState
} from '@portfolio/project-model/units';
import { guideTimeMapForProgram } from '$lib/visitor/guide-run-map';
import { experienceEnvelope, LOWERING_OPTIONS } from '../experience/fixtures';

const OPTIONS = { runId: 'run-1', runEpoch: 1 } as const;
const STEP_MS = 10;

async function fixture() {
	const envelope = await experienceEnvelope();
	const run = prepareUnitRuntime(envelope);
	if (run.kind !== 'ready') throw new Error('fixture did not prepare');
	const sourceContentId = await computeEnvelopeSourceContentId(envelope);
	const lowered = lowerExperienceProgram(envelope, { ...LOWERING_OPTIONS, sourceContentId });
	if (lowered.kind !== 'lowered') throw new Error(lowered.message);
	return { graph: run.graph, program: lowered.program, transitions: lowered.transitions };
}

/** Replay a visitor run on a fixed frame clock; returns when each stay began and when the run ended. */
function replay(
	program: ExecutionProgram,
	transitions: readonly ExperienceProgramTransition[],
	graph: Parameters<typeof buildGuideMovementMap>[0]['graph']
): { arrivals: { stopId: string; seconds: number }[]; endSeconds: number } {
	const options = { ...OPTIONS, transitions };
	const event = (kind: ExperienceEvent['kind'], extra: Record<string, unknown> = {}) =>
		({ kind, ...OPTIONS, ...extra }) as ExperienceEvent;
	let state: ExperienceRunState = reduceExperience(program, createExperienceRun(program, options), event('enter'), options).state;
	let clockMs = 0;
	let travelLeftMs = 0;
	let travellingFrom: string | null = null;
	const arrivals: { stopId: string; seconds: number }[] = [];
	let lastOccurrence: string | null = null;
	const noteArrival = () => {
		if ((state.phase === 'holding' || state.phase === 'ready') && state.occurrenceId !== lastOccurrence) {
			lastOccurrence = state.occurrenceId;
			arrivals.push({ stopId: state.stopId!, seconds: clockMs / 1000 });
		}
	};
	noteArrival();
	for (let frame = 0; frame < 100_000 && state.phase !== 'completed'; frame += 1) {
		if (state.phase === 'traveling') {
			if (travellingFrom !== state.occurrenceId) {
				travellingFrom = state.occurrenceId;
				const invocation = state.invocation!;
				const movement = buildGuideMovementMap({
					fromViewId: state.invocationFromViewId,
					toViewId: state.viewId!,
					invocation,
					stopId: state.stopId!,
					presentationId: state.presentationId!,
					occurrenceId: state.occurrenceId!,
					graph
				});
				if (movement.kind !== 'ready') throw new Error('movement gap');
				travelLeftMs = Math.round(movement.map.totalSeconds * 1000);
			}
			clockMs += STEP_MS;
			travelLeftMs -= STEP_MS;
			if (travelLeftMs <= 0) {
				state = reduceExperience(program, state, event('arrival'), options).state;
				noteArrival();
			}
			continue;
		}
		if (state.phase === 'holding') {
			clockMs += STEP_MS;
			state = reduceExperience(program, state, event('tick', { milliseconds: STEP_MS }), options).state;
			noteArrival();
			continue;
		}
		throw new Error(`unexpected phase ${state.phase}`);
	}
	return { arrivals, endSeconds: clockMs / 1000 };
}

describe('one Guide clock: run and map parity', () => {
	it("a replayed run's arrival times equal the map's Stop entries, and it ends at the map's total", async () => {
		const { graph, program, transitions } = await fixture();
		const result = guideTimeMapForProgram({ program, transitions, graph });
		if (result.kind !== 'ready') throw new Error('map not ready');
		const map = result.map;
		const mapArrivals = map.stopEntries.map((entry) => {
			const stay = map.segments.find(
				(segment) => segment.occurrenceId === entry.occurrenceId && (segment.kind === 'hold' || segment.kind === 'wait')
			)!;
			return { stopId: entry.stopId, seconds: stay.startSeconds };
		});
		const run = replay(program, transitions, graph);
		expect(run.arrivals).toEqual(mapArrivals);
		expect(run.endSeconds).toBeCloseTo(map.totalSeconds, 5);
		// Holds never count during the Travel: the run is as long as the welcome says.
		expect(map.totalSeconds).toBe(7);
	});

	it('keeps parity when the stays change and an arrival is a Cut', async () => {
		const { graph, program, transitions } = await fixture();
		const restayed: ExecutionProgram = {
			...program,
			stops: program.stops.map((stop, index) => ({ ...stop, staySeconds: index === 0 ? 3.5 : 1.25 })),
			localTime: program.stops.map((stop, index) => ({ stopId: stop.id, staySeconds: index === 0 ? 3.5 : 1.25 }))
		};
		const cutTransitions = transitions.map((entry) => ({
			...entry,
			invocation: { kind: 'cut' as const, viewId: restayed.stops.find((stop) => stop.id === entry.toStopId)!.entryViewId }
		}));
		for (const table of [transitions, cutTransitions]) {
			const result = guideTimeMapForProgram({ program: restayed, transitions: table, graph });
			if (result.kind !== 'ready') throw new Error('map not ready');
			const run = replay(restayed, table, graph);
			expect(run.endSeconds).toBeCloseTo(result.map.totalSeconds, 5);
		}
	});
});
