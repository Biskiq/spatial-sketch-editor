/**
 * E1 — dependency census (T1.P02.S06 C). "Census, not timing."
 *
 * For each Wall and each edit class (length, angle, rigid move), apply a small,
 * distinct edit through the shipped per-move planner (`planWallManipulation`,
 * the same call the Wall-handle drag makes) and diff the full canonical compile
 * before and after. k is the number of compiled entities whose output changed:
 * the changed set, a lower bound on what an incremental evaluator must evaluate.
 *
 * S and M are exhaustive. L, XL and the museum-shaped layout are a seeded,
 * stratified sample (Junction degree × hosted Openings × Room-boundary
 * membership), visited round-robin across strata until the tier's runtime bound.
 */
import {
	compileWallFirstLayoutGeometry,
	planExactWallAngle,
	planExactWallLength,
	planRigidWallMove,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';

import { planWallManipulation, type WallManipulationRequest } from '$lib/authoring/adapters/layout/precision';

import { changedEntities, compiledEntities } from './compiled-diff';

export const EDIT_CLASSES = ['length', 'angle', 'move'] as const;
export type EditClass = (typeof EDIT_CLASSES)[number];

/**
 * The canonical candidate document of one Wall manipulation: the layout-core
 * plan `planWallManipulation` wraps (it returns only the preview frames), so
 * the changed set is diffed on exactly the document the drag previews.
 */
export function candidateDocument(
	document: LayoutDocumentWallFirst,
	wallId: string,
	request: WallManipulationRequest
): LayoutDocumentWallFirst | null {
	const plan =
		request.kind === 'length'
			? planExactWallLength(document, { wallId, length: request.length, fixedEndpoint: 'start' })
			: request.kind === 'angle'
				? planExactWallAngle(document, { wallId, angle: request.angleRadians, fixedEndpoint: 'start' })
				: planRigidWallMove(document, wallId, request.delta);
	return plan.kind === 'success' ? plan.document : null;
}

/** A small edit, made distinct per Wall so no two samples share an input. */
export function fixedEdit(
	document: LayoutDocumentWallFirst,
	wallId: string,
	editClass: EditClass,
	salt: number
): WallManipulationRequest {
	const wall = document.walls.find((candidate) => candidate.id === wallId)!;
	const start = document.junctions.find((junction) => junction.id === wall.startJunctionId)!.point;
	const end = document.junctions.find((junction) => junction.id === wall.endJunctionId)!.point;
	const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
	const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
	const epsilon = 1e-4 * (salt % 997);
	if (editClass === 'length') return { kind: 'length', length: length * 0.98 - epsilon };
	if (editClass === 'angle') return { kind: 'angle', angleRadians: angle + 0.004 + epsilon * 0.01 };
	// A rigid move across the Wall, a few centimetres.
	const nx = -(end[1] - start[1]) / length;
	const nz = (end[0] - start[0]) / length;
	const distance = 0.05 + epsilon;
	return { kind: 'move', delta: [nx * distance, nz * distance] };
}

type Stratum = { readonly key: string; readonly wallIds: string[] };

function seededShuffle<T>(items: T[], seed: number): T[] {
	let state = seed >>> 0 || 1;
	const next = () => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return (state >>> 0) / 4294967296;
	};
	for (let index = items.length - 1; index > 0; index--) {
		const swap = Math.floor(next() * (index + 1));
		[items[index], items[swap]] = [items[swap]!, items[index]!];
	}
	return items;
}

/** Walls ordered so that every stratum is covered before any is revisited. */
export function stratifiedOrder(document: LayoutDocumentWallFirst, seed: number): { order: string[]; strata: Stratum[] } {
	const degree = new Map<string, number>();
	for (const wall of document.walls) {
		for (const id of [wall.startJunctionId, wall.endJunctionId]) degree.set(id, (degree.get(id) ?? 0) + 1);
	}
	const openings = new Map<string, number>();
	for (const opening of document.openings) openings.set(opening.wallId, (openings.get(opening.wallId) ?? 0) + 1);
	const rooms = new Map<string, number>();
	for (const room of document.rooms) for (const ref of room.boundary) rooms.set(ref.wallId, (rooms.get(ref.wallId) ?? 0) + 1);
	const byKey = new Map<string, string[]>();
	for (const wall of document.walls) {
		const maxDegree = Math.max(degree.get(wall.startJunctionId) ?? 0, degree.get(wall.endJunctionId) ?? 0);
		const key = `deg${Math.min(maxDegree, 4)}|open${Math.min(openings.get(wall.id) ?? 0, 1)}|rooms${rooms.get(wall.id) ?? 0}`;
		byKey.set(key, [...(byKey.get(key) ?? []), wall.id]);
	}
	const strata = [...byKey.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, wallIds], index) => ({ key, wallIds: seededShuffle([...wallIds], seed + index) }));
	const order: string[] = [];
	for (let round = 0; order.length < document.walls.length; round++) {
		for (const stratum of strata) if (round < stratum.wallIds.length) order.push(stratum.wallIds[round]!);
	}
	return { order, strata };
}

export type E1Sample = {
	readonly wallId: string;
	readonly editClass: EditClass;
	readonly outcome: 'changed' | 'refused';
	readonly k: number;
	readonly refusal?: string;
};

export type E1Tier = {
	readonly workload: string;
	readonly contentDigest: string;
	readonly mode: 'exhaustive' | 'stratified-sample';
	readonly boundSeconds: number;
	readonly walls: number;
	readonly entities: number;
	readonly strata: readonly { key: string; walls: number; sampled: number }[];
	readonly wallsSampled: number;
	readonly boundReached: boolean;
	readonly samples: readonly E1Sample[];
	readonly elapsedSeconds: number;
};

export function runE1(input: {
	readonly workload: string;
	readonly contentDigest: string;
	readonly document: LayoutDocumentWallFirst;
	readonly exhaustive: boolean;
	readonly boundSeconds: number;
	readonly seed: number;
}): E1Tier {
	const { document } = input;
	const started = performance.now();
	const base = compileWallFirstLayoutGeometry(document).geometry;
	const before = compiledEntities(base);
	const { order, strata } = stratifiedOrder(document, input.seed);
	const samples: E1Sample[] = [];
	const sampledWalls = new Set<string>();
	let boundReached = false;
	for (const [index, wallId] of order.entries()) {
		if (!input.exhaustive && (performance.now() - started) / 1000 > input.boundSeconds) {
			boundReached = true;
			break;
		}
		for (const editClass of EDIT_CLASSES) {
			const wall = document.walls.find((candidate) => candidate.id === wallId)!;
			if (wall.centerline.kind !== 'line' && editClass !== 'move') continue;
			const request = fixedEdit(document, wallId, editClass, index);
			const plan = planWallManipulation(document, wallId, request, 'start');
			if (plan.kind === 'refused') {
				samples.push({ wallId, editClass, outcome: 'refused', k: 0, refusal: plan.message.slice(0, 120) });
				continue;
			}
			const candidate = candidateDocument(document, wallId, request);
			if (candidate === null) throw new Error(`${wallId} ${editClass}: planned preview without a canonical candidate`);
			const after = compiledEntities(compileWallFirstLayoutGeometry(candidate).geometry);
			samples.push({ wallId, editClass, outcome: 'changed', k: changedEntities(before, after).length });
		}
		sampledWalls.add(wallId);
	}
	return {
		workload: input.workload,
		contentDigest: input.contentDigest,
		mode: input.exhaustive ? 'exhaustive' : 'stratified-sample',
		boundSeconds: input.boundSeconds,
		walls: document.walls.length,
		entities: before.size,
		strata: strata.map((stratum) => ({
			key: stratum.key,
			walls: stratum.wallIds.length,
			sampled: stratum.wallIds.filter((id) => sampledWalls.has(id)).length
		})),
		wallsSampled: sampledWalls.size,
		boundReached,
		samples,
		elapsedSeconds: (performance.now() - started) / 1000
	};
}

function quantile(sorted: readonly number[], q: number): number {
	if (sorted.length === 0) return Number.NaN;
	return sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))]!;
}

export type E1ClassSummary = {
	readonly editClass: EditClass;
	readonly samples: number;
	readonly refused: number;
	readonly k: { min: number; median: number; p90: number; max: number };
	readonly kOverN: { median: number; p90: number; max: number };
};

export function summarizeE1(tier: E1Tier): E1ClassSummary[] {
	return EDIT_CLASSES.map((editClass) => {
		const rows = tier.samples.filter((sample) => sample.editClass === editClass);
		const ks = rows.filter((row) => row.outcome === 'changed').map((row) => row.k).sort((a, b) => a - b);
		const ratios = ks.map((k) => k / tier.entities);
		return {
			editClass,
			samples: rows.length,
			refused: rows.filter((row) => row.outcome === 'refused').length,
			k: { min: ks[0] ?? Number.NaN, median: quantile(ks, 0.5), p90: quantile(ks, 0.9), max: ks[ks.length - 1] ?? Number.NaN },
			kOverN: { median: quantile(ratios, 0.5), p90: quantile(ratios, 0.9), max: ratios[ratios.length - 1] ?? Number.NaN }
		};
	});
}

/** Plan C: a median k/N above 20 % on the museum-shaped layout refutes H1's premise for that class. */
export const H1_PREMISE_LIMIT = 0.2;
