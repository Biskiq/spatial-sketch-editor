/** Rebuild a Preview playhead through the Experience reducer; Camera keeps timing and sampling. */
import type { GuideTimeCursor, GuideTimeMap, GuideTimeSegment } from '@portfolio/camera-core';
import {
	createExperienceRun, reduceExperience,
	type ExecutionProgram, type ExperienceInterpreterOptions
} from '@portfolio/project-model/units';

export function seekGuideRun(
	program: ExecutionProgram,
	options: ExperienceInterpreterOptions,
	map: GuideTimeMap,
	cursor: GuideTimeCursor
) {
	const segment = map.segments.find((entry) => entry.id === cursor.segmentId);
	if (!segment || !Number.isFinite(cursor.elapsedSeconds)) return null;
	const target = map.stopEntries.findIndex((entry) => entry.stopId === segment.stopId);
	if (target < 0) return null;
	let state = createExperienceRun(program, options);
	const send = (event: { kind: 'enter' | 'arrival' | 'continue' | 'pause' } | { kind: 'tick'; milliseconds: number }) => {
		state = reduceExperience(program, state, { ...event, runId: state.runId, runEpoch: state.runEpoch }, options).state;
	};
	send({ kind: 'enter' });
	// Replay actual stays and arrivals. No interpreter fields are patched by the UI.
	for (let index = 0; index < target; index += 1) {
		if (state.stopId !== map.stopEntries[index]!.stopId || state.phase === 'completed') return null;
		if (state.phase === 'traveling') send({ kind: 'arrival' });
		if (state.holdRemainingMs !== null) send({ kind: 'tick', milliseconds: state.holdRemainingMs });
		else send({ kind: 'continue' });
	}
	if (state.stopId !== segment.stopId || state.phase === 'completed') return null;
	let elapsedSeconds = Math.max(0, Math.min(segment.durationSeconds, cursor.elapsedSeconds));
	if (segment.kind !== 'travel') {
		if (state.phase === 'traveling') send({ kind: 'arrival' });
		if (segment.kind === 'hold') {
			// Keep the last visible frame addressable: Play can finish its final millisecond.
			const milliseconds = Math.min(Math.floor(elapsedSeconds * 1000), Math.max(0, (state.holdRemainingMs ?? 0) - 1));
			if (milliseconds > 0) send({ kind: 'tick', milliseconds });
			elapsedSeconds = milliseconds / 1000;
		}
	}
	send({ kind: 'pause' });
	return { state, segment, elapsedSeconds } satisfies { state: typeof state; segment: GuideTimeSegment; elapsedSeconds: number };
}
