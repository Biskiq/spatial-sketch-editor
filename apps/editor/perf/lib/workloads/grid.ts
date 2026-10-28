/**
 * Grid workloads M and L (grid-7 and grid-14).
 *
 * The grid construction is the convergence packet's own fixture generator
 * (`buildGrid`/`addOpenings` at the recorded 2026-10-22 run). It builds every
 * topology only through public `layout-core` planners — never a document literal
 * — so a workload exercises the canonical compiler exactly as the starter
 * gallery does.
 *
 * S = grid-3, M = grid-7, L = grid-14, XL = grid-20, per the performance
 * contract's historical representative workloads. The spot check generates M and L.
 */

import {
	createEmptyWallFirstLayoutDocument,
	deriveLayoutWallRole,
	mintLayoutIdCapture,
	planCreateWallFirstOpening,
	planWallChain,
	type LayoutDocumentWallFirst,
	type LayoutIdCapture,
	type LayoutVec2
} from '@portfolio/layout-core';

/** Supplies each operation's captured identity; a sequence makes a workload reproducible. */
export type CaptureSource = () => LayoutIdCapture;

/** Deterministic, opaque nonces: the same generator inputs give the same ids. */
export function sequentialCaptures(prefix: string): CaptureSource {
	let next = 0;
	return () => mintLayoutIdCapture(() => `${prefix}${String(next++).padStart(8, '0')}`);
}

const randomCaptures: CaptureSource = () => mintLayoutIdCapture();

export const CELL_METERS = 6;

function point(document: LayoutDocumentWallFirst, id: string): LayoutVec2 {
	const junction = document.junctions.find((candidate) => candidate.id === id);
	if (junction === undefined) throw new Error(`missing junction ${id}`);
	return junction.point;
}

/** The Wall whose straight span strictly contains `p` (a declared T host). */
function hostWallAt(document: LayoutDocumentWallFirst, p: LayoutVec2): string {
	for (const wall of document.walls) {
		const a = point(document, wall.startJunctionId);
		const b = point(document, wall.endJunctionId);
		const abx = b[0] - a[0];
		const abz = b[1] - a[1];
		const lengthSquared = abx * abx + abz * abz;
		const t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / lengthSquared;
		if (t <= 1e-6 || t >= 1 - 1e-6) continue;
		const qx = a[0] + t * abx - p[0];
		const qz = a[1] + t * abz - p[1];
		if (qx * qx + qz * qz < 1e-10) return wall.id;
	}
	throw new Error(`no host wall at ${p.join(',')}`);
}

function chain(
	document: LayoutDocumentWallFirst,
	points: LayoutVec2[],
	options: { close: boolean; hostSnapEnds?: boolean; captures: CaptureSource }
): LayoutDocumentWallFirst {
	const plan = planWallChain({
		baseline: document,
		points,
		close: options.close,
		capture: options.captures(),
		levelId: document.floor.id,
		...(options.hostSnapEnds
			? {
					endpointHostSnaps: [
						{ pointIndex: 0, wallId: hostWallAt(document, points[0]!) },
						{ pointIndex: points.length - 1, wallId: hostWallAt(document, points[points.length - 1]!) }
					]
				}
			: {})
	});
	if (plan.kind !== 'success') {
		throw new Error(`chain refused: ${plan.rejection.code} ${plan.rejection.message}`);
	}
	return plan.document;
}

/** A k×k gallery grid of CELL_METERS rooms; walls = 2k²+2k, rooms = k². */
export function buildGrid(k: number, captures: CaptureSource = randomCaptures): LayoutDocumentWallFirst {
	const width = k * CELL_METERS;
	let document = chain(
		createEmptyWallFirstLayoutDocument(),
		[
			[0, 0],
			[width, 0],
			[width, width],
			[0, width]
		],
		{ close: true, captures }
	);
	for (let index = 1; index < k; index++) {
		const x = index * CELL_METERS;
		document = chain(document, [[x, 0], [x, width]], { close: false, hostSnapEnds: true, captures });
	}
	for (let index = 1; index < k; index++) {
		const z = index * CELL_METERS;
		document = chain(document, [[0, z], [width, z]], { close: false, hostSnapEnds: true, captures });
	}
	return document;
}

/** One Opening per Wall of length ≥ 3 m: interior Walls get a door, others a window. */
export function addOpenings(
	document: LayoutDocumentWallFirst,
	captures: CaptureSource = randomCaptures
): LayoutDocumentWallFirst {
	let current = document;
	for (const wall of document.walls) {
		const a = point(current, wall.startJunctionId);
		const b = point(current, wall.endJunctionId);
		const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
		if (length < 3) continue;
		const kind = deriveLayoutWallRole(current, wall.id) === 'dividing' ? 'door' : 'window';
		const plan = planCreateWallFirstOpening(
			current,
			{ wallId: wall.id, kind, offset: length / 2 - 0.5 },
			captures(),
			current.floor.id
		);
		if (plan.kind !== 'success') throw new Error(`opening refused on ${wall.id}`);
		current = plan.document;
	}
	return current;
}
