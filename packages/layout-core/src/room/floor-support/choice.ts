import type { Vec3 } from '../../kernel/types';
import type { LayoutVec2 } from '../../geometry/coordinates';
import type {
	FloorSupportCandidate,
	FloorSupportQueryInput,
	FloorSupportWitness,
} from './contracts';
import { FLOOR_SUPPORT_TOLERANCES, FLOOR_SUPPORT_UP_NORMAL } from './contracts';

/** An explicit creator choice, by opaque source-derived choice key or by elevation. */
export type FloorSupportChoice =
	| { kind: 'order-key'; orderKey: string }
	| { kind: 'elevation'; elevation: number };

export type FloorSupportChoiceResult =
	| { kind: 'resolved'; support: FloorSupportCandidate }
	| { kind: 'choice-required'; candidates: readonly FloorSupportCandidate[] }
	| {
			kind: 'invalid-choice';
			code: 'no-support' | 'unknown-choice' | 'ambiguous-choice';
			message: string;
	  };

/**
 * Resolve one support from the query's candidates.
 *
 * Exactly one candidate resolves without a choice; anything else asks for one.
 * An elevation choice that matches two candidates (two floors sharing a datum)
 * is `ambiguous-choice`, never a silent first match — that is why the ordering
 * key exists.
 */
export function chooseFloorSupport(
	candidates: readonly FloorSupportCandidate[],
	explicitChoice?: FloorSupportChoice,
): FloorSupportChoiceResult {
	if (candidates.length === 0) {
		return {
			kind: 'invalid-choice',
			code: 'no-support',
			message: 'No floor-support candidate is available to choose from.',
		};
	}
	if (explicitChoice === undefined) {
		if (candidates.length === 1) return { kind: 'resolved', support: candidates[0]! };
		return { kind: 'choice-required', candidates };
	}

	const matches =
		explicitChoice.kind === 'order-key'
			? candidates.filter((candidate) => candidate.orderKey === explicitChoice.orderKey)
			: Number.isFinite(explicitChoice.elevation)
				? candidates.filter(
						(candidate) =>
							Math.abs(candidate.elevation - explicitChoice.elevation) <=
							FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters,
					)
				: [];

	if (matches.length === 0) {
		return {
			kind: 'invalid-choice',
			code: 'unknown-choice',
			message:
				explicitChoice.kind === 'order-key'
					? `No floor-support candidate carries ordering key "${explicitChoice.orderKey}".`
					: `No floor-support candidate matches elevation ${String((explicitChoice as { elevation: number }).elevation)}.`,
		};
	}
	if (matches.length > 1) {
		return {
			kind: 'invalid-choice',
			code: 'ambiguous-choice',
			message: `${matches.length} floor-support candidates match this choice: ${matches
				.map((candidate) => candidate.orderKey)
				.join(', ')}.`,
		};
	}
	return { kind: 'resolved', support: matches[0]! };
}

export function registerWitness(
	byKey: Map<string, FloorSupportWitness>,
	key: string,
	witness: FloorSupportWitness,
): boolean {
	const previous = byKey.get(key);
	if (previous !== undefined) {
		return previous.cacheKey === witness.cacheKey && previous.sourceId === witness.sourceId;
	}
	byKey.set(key, witness);
	return true;
}

export function contradictory(recordId: string) {
	return {
		kind: 'unsupported' as const,
		code: 'contradictory-support-facts' as const,
		message: `Compiled record "${recordId}" has conflicting source correspondence.`,
	};
}

export function groupSupportCandidates(
	input: FloorSupportQueryInput,
	witnessByKey: ReadonlyMap<string, FloorSupportWitness>,
): FloorSupportCandidate[] {
	return groupWitnessesByElevation(witnessByKey)
		.map((group) => {
			const first = group.witnesses[0]!;
			return {
				queryPoint: [input.x, input.z] as LayoutVec2,
				elevation: group.elevation,
				upNormal: [
					FLOOR_SUPPORT_UP_NORMAL[0],
					FLOOR_SUPPORT_UP_NORMAL[1],
					FLOOR_SUPPORT_UP_NORMAL[2],
				] as Vec3,
				generationId: input.generationId,
				witnesses: group.witnesses,
				orderKey: first.orderKey,
				label: witnessLabel(first),
			};
		})
		.sort((left, right) => compareWitnesses(left.witnesses[0]!, right.witnesses[0]!));
}

type WitnessGroup = { floorId: string; elevation: number; witnesses: FloorSupportWitness[] };

export function groupWitnessesByElevation(
	witnessByKey: ReadonlyMap<string, FloorSupportWitness>,
): WitnessGroup[] {
	const witnesses = [...witnessByKey.values()].sort(compareWitnesses);
	const groups: WitnessGroup[] = [];
	for (const witness of witnesses) {
		// Every member must be within tolerance of the new witness. Checking only
		// the bucket's first elevation would let a middle elevation bridge two
		// supports that are themselves farther apart than one tolerance.
		const group = groups.find(
			(candidate) =>
				candidate.floorId === witness.floorId &&
				candidate.witnesses.every(
					(member) =>
						Math.abs(member.elevation - witness.elevation) <=
						FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters,
				),
		);
		if (group === undefined)
			groups.push({ floorId: witness.floorId, elevation: witness.elevation, witnesses: [witness] });
		else group.witnesses.push(witness);
	}
	return groups;
}

export function witnessLabel(witness: FloorSupportWitness): string {
	return witness.source.kind === 'room'
		? `Floor ${witness.floorId} / Room ${witness.source.roomId}`
		: `Floor ${witness.floorId} / Region ${witness.source.regionId}`;
}

// `geometryId` is collision-safe identity encoding, not a lexical sort key:
// its length prefixes would sort "b" before "a-long-source".
export function compareWitnesses(left: FloorSupportWitness, right: FloorSupportWitness): number {
	if (left.source.kind !== right.source.kind) return left.source.kind < right.source.kind ? -1 : 1;
	const leftId = left.source.kind === 'room' ? left.source.roomId : left.source.regionId;
	const rightId = right.source.kind === 'room' ? right.source.roomId : right.source.regionId;
	if (leftId !== rightId) return leftId < rightId ? -1 : 1;
	for (const key of ['floorId', 'recordId', 'cacheKey'] as const) {
		if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
	}
	return 0;
}

export function hasUsableBoundary(polygon: readonly LayoutVec2[]): boolean {
	if (polygon.length < 3 || polygon.some((point) => point.some((value) => !Number.isFinite(value))))
		return false;
	const origin = polygon[0]!;
	let area = 0;
	for (let index = 1; index + 1 < polygon.length; index++) {
		const a = polygon[index]!;
		const b = polygon[index + 1]!;
		area += (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
	}
	return Number.isFinite(area) && area !== 0;
}

export function distanceToSegment(point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): number {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const squared = dx * dx + dz * dz;
	if (!(squared > 0)) return Math.hypot(point[0] - start[0], point[1] - start[1]);
	const rawT = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / squared;
	const t = Math.min(1, Math.max(0, rawT));
	return Math.hypot(point[0] - (start[0] + dx * t), point[1] - (start[1] + dz * t));
}

export function pointWithinToleranceOfBounds(
	point: LayoutVec2,
	polygon: readonly LayoutVec2[],
	toleranceMeters: number,
): boolean {
	if (polygon.length === 0) return false;
	let minX = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxZ = -Infinity;
	for (const [x, z] of polygon) {
		if (!Number.isFinite(x) || !Number.isFinite(z)) return true;
		minX = Math.min(minX, x);
		minZ = Math.min(minZ, z);
		maxX = Math.max(maxX, x);
		maxZ = Math.max(maxZ, z);
	}
	return (
		point[0] >= minX - toleranceMeters &&
		point[0] <= maxX + toleranceMeters &&
		point[1] >= minZ - toleranceMeters &&
		point[1] <= maxZ + toleranceMeters
	);
}
