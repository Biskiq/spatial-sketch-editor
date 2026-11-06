/**
 * Visitor progress: one segment per authored Stop, in Guide order.
 *
 * The run state already owns what was actually visited and how much of the
 * current stay remains. This adapter only projects those facts into display
 * values; it never advances the tour or invents a visit for a skipped Stop.
 */
import type { ExecutionProgram, ExperienceRunState } from '@portfolio/project-model/units';

export type VisitorProgressSegment = {
	readonly stopId: string;
	readonly label: string;
	readonly visited: boolean;
	readonly current: boolean;
	readonly outline: boolean;
	/** Stay fill, 0–1. Manual pacing keeps the current segment empty. */
	readonly fill: number;
	/** The connector arriving at this segment, filled once that arrival happened. */
	readonly travelFill: number;
};

export type VisitorProgress = {
	readonly segments: readonly VisitorProgressSegment[];
	readonly visitedCount: number;
	readonly currentIndex: number | null;
};

function clampFraction(value: number): number {
	return Math.max(0, Math.min(1, value));
}

export function visitorProgressFor(
	program: ExecutionProgram,
	state: ExperienceRunState,
	options: { readonly order?: readonly string[]; readonly travelProgress?: number } = {}
): VisitorProgress {
	const stopById = new Map(program.stops.map((stop) => [stop.id, stop]));
	const orderedStops = (options.order ?? program.stops.map((stop) => stop.id)).flatMap((stopId) => {
		const stop = stopById.get(stopId);
		return stop === undefined ? [] : [stop];
	});
	const currentIndex = state.stopId === null
		? null
		: orderedStops.findIndex((stop) => stop.id === state.stopId);
	const visitedStops = new Set(state.visited.map((visit) => visit.stopId));
	const presentationLabels = new Map(
		program.presentations.map((presentation) => [presentation.id, presentation.label])
	);
	const wait = state.resume?.holdRemainingMs ?? state.holdRemainingMs;
	const travelProgress = clampFraction(options.travelProgress ?? 0);
	const segments = orderedStops.map((stop, index): VisitorProgressSegment => {
		const current = index === currentIndex;
		const visited = visitedStops.has(stop.id);
		const liveTravel = current && state.phase === 'traveling';
		const travelFill = index === 0 ? 0 : liveTravel ? travelProgress : visited ? 1 : 0;
		let fill = visited ? 1 : 0;
		if (current && program.pacing === 'manual') fill = 0;
		if (current && visited && program.pacing === 'automatic' && state.phase !== 'traveling') {
			const stay = stop.staySeconds;
			fill = stay === null || wait === null ? 0 : clampFraction(1 - wait / (stay * 1000));
		}
		return {
			stopId: stop.id,
			label: presentationLabels.get(stop.presentationId) ?? stop.id,
			visited,
			current,
			outline: current && program.pacing === 'manual',
			fill,
			travelFill
		};
	});
	return {
		segments,
		visitedCount: new Set(state.visited.map((visit) => visit.stopId)).size,
		currentIndex: currentIndex === null || currentIndex < 0 ? null : currentIndex
	};
}