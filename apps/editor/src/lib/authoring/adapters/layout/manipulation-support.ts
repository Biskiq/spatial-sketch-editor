import {
	createWallFirstArchitectureVerdictScope,
	createWallSamplingDerivation,
	readWallFirstDragProposal,
	type WallFirstArchitectureProposalWall,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import { type StageAdapterContext } from '$lib/authoring/stage/stage-adapter-host';
import { isStageDrag } from '$lib/authoring/stage/stage-adapter-host';

import { type PlanNumericField, type PlanNumericHost } from '$lib/authoring/layout/plan-numeric-entry';
import { type LayoutSnapWinner } from './snap';
import { type CandidatePaperGeometry } from './candidate-preview';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';

/** Compare actual displacement on the Stage, including perspective foreshortening. */
export function datumSnapDistance(
	ctx: StageAdapterContext,
	from: Readonly<LayoutVec2>,
	to: Readonly<LayoutVec2>
): number {
	const y = ctx.snapshot.domain.datumMeters;
	const a = ctx.project([from[0], y, from[1]]);
	const b = ctx.project([to[0], y, to[1]]);
	return a === null || b === null ? Infinity : Math.hypot(a[0] - b[0], a[1] - b[1]);
}
export function createWallDragReader(baseline: LayoutDocumentWallFirst) {
	const sampling = createWallSamplingDerivation();
	const scope = createWallFirstArchitectureVerdictScope(baseline);
	const sampleLimit = baseline.walls.length * 2 + 256;
	return (intent: Parameters<typeof readWallFirstDragProposal>[1]) => {
		// Retain untouched Walls across moves without accumulating an entire drag's samples.
		if (sampling.stats.entries > sampleLimit) sampling.reset();
		return readWallFirstDragProposal(baseline, intent, sampling, scope);
	};
}
export function wallProposalPaper(
	walls: readonly WallFirstArchitectureProposalWall[],
	y: number
): CandidatePaperGeometry {
	return {
		polygons: [],
		segments: walls.flatMap(({ points }) =>
			points.slice(1).map(([x, z], index) => [
				[points[index]![0], y, points[index]![1]],
				[x, y, z]
			])
		)
	};
}
/** The first real crossing or contact between an attempted network and untouched Walls. */
export function attemptedConflictPoint(
	attempt: readonly WallFirstArchitectureProposalWall[],
	baseline: LayoutDocumentWallFirst
): LayoutVec2 | null {
	const attemptedIds = new Set(attempt.map((wall) => wall.wallId));
	const attemptedSegments = attempt.flatMap((wall) =>
		wall.points.slice(1).map((point, index) => [wall.points[index]!, point] as const)
	);
	const baselineSegments = baseline.walls.flatMap((wall) => {
		if (attemptedIds.has(wall.id)) return [];
		const start = baseline.junctions.find((junction) => junction.id === wall.startJunctionId)?.point;
		const end = baseline.junctions.find((junction) => junction.id === wall.endJunctionId)?.point;
		if (start === undefined || end === undefined) return [];
		const points =
			wall.centerline.kind === 'line'
				? [start, end]
				: [start, ...wall.centerline.knots.map((knot) => knot.point), end];
		return points.slice(1).map((point, index) => [points[index]!, point] as const);
	});
	const cross = (a: LayoutVec2, b: LayoutVec2, c: LayoutVec2, d: LayoutVec2): LayoutVec2 | null => {
		const denominator = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
		if (Math.abs(denominator) < 1e-9) return null;
		const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / denominator;
		const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / denominator;
		return t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9
			? [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
			: null;
	};
	for (const [a, b] of attemptedSegments) {
		for (const [c, d] of baselineSegments) {
			const point = cross(a, b, c, d);
			if (point !== null) return point;
		}
	}
	return null;
}
/** Planar distance from `point` to the chord between two neighbour knots. */
export function distanceToChord(point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): number {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const lengthSquared = dx * dx + dz * dz;
	if (lengthSquared === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
	const t = Math.max(
		0,
		Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared)
	);
	return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dz));
}
export function isPointerDrag(
	origin: readonly [number, number],
	point: readonly [number, number]
): boolean {
	return isStageDrag({ x: origin[0], y: origin[1] }, { x: point[0], y: point[1] });
}

export function numericWords(reason: string): string {
	switch (reason) {
		case 'blank':
			return 'Type a value.';
		case 'not-positive':
			return 'Enter a value greater than zero.';
		case 'sign-not-allowed':
			return 'This value cannot be negative.';
		case 'unit-not-allowed':
			return 'Use m or cm for this measure.';
		default:
			return 'Enter a finite number.';
	}
}

export function previewCoordinates(y: number) {
	const world = (point: readonly [number, number], elevation = y): [number, number, number] => [
		point[0],
		elevation,
		point[1]
	];
	const snapOf = (winner: LayoutSnapWinner | null) =>
		winner === null ? undefined : { world: world(winner.point), name: winner.name };
	return { world, snapOf };
}

export type SettledLayoutRefusal = {
	readonly subject:
		| { readonly kind: 'wall'; readonly wallId: string }
		| { readonly kind: 'opening'; readonly openingId: string }
		| { readonly kind: 'room'; readonly roomId: string }
		| { readonly kind: 'junction' };
	readonly contentRevision: string;
	readonly point: LayoutVec2;
	readonly text: string;
	readonly geometry?: CandidatePaperGeometry;
};

export type NumericGestureTarget = {
	readonly host: PlanNumericHost;
	readonly field: PlanNumericField;
	readonly ownerId: string;
	readonly candidates: Readonly<Record<string, number | null>>;
};

export type LayoutManipulationPorts = {
	readonly services: StageAdapterServices;
	readonly document: LayoutDocumentWallFirst;
	readonly levelId: string;
	readonly contentRevision: string;
	readonly publishRefusal: (text: string | null) => void;
	readonly settleRefusal: (refusal: SettledLayoutRefusal | null) => void;
};
