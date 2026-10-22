// Synthetic Layout fixtures for the performance probe, built ONLY through public
// layout-core planners (planWallChain with declared host snaps, then
// planCreateWallFirstOpening) — no document literal encodes topology, exactly as
// the starter gallery does. Every fixture is validated by the canonical compiler
// before it is used.
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	planCreateWallFirstOpening,
	planWallChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

export const CELL_METERS = 6;

function point(doc: LayoutDocumentWallFirst, id: string): LayoutVec2 {
	const j = doc.junctions.find((candidate) => candidate.id === id);
	if (!j) throw new Error(`missing junction ${id}`);
	return j.point;
}

/** The Wall whose straight span contains `p` strictly inside (a host for a declared T). */
function hostWallAt(doc: LayoutDocumentWallFirst, p: LayoutVec2): string {
	for (const wall of doc.walls) {
		const a = point(doc, wall.startJunctionId);
		const b = point(doc, wall.endJunctionId);
		const abx = b[0] - a[0];
		const abz = b[1] - a[1];
		const len2 = abx * abx + abz * abz;
		const t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / len2;
		if (t <= 1e-6 || t >= 1 - 1e-6) continue;
		const qx = a[0] + t * abx - p[0];
		const qz = a[1] + t * abz - p[1];
		if (qx * qx + qz * qz < 1e-10) return wall.id;
	}
	throw new Error(`no host wall at ${p.join(',')}`);
}

function chain(
	doc: LayoutDocumentWallFirst,
	points: LayoutVec2[],
	options: { close: boolean; hostSnapEnds?: boolean }
): LayoutDocumentWallFirst {
	const plan = planWallChain({
		baseline: doc,
		points,
		close: options.close,
		role: 'boundary',
		...(options.hostSnapEnds
			? {
					endpointHostSnaps: [
						{ pointIndex: 0, wallId: hostWallAt(doc, points[0]!) },
						{ pointIndex: points.length - 1, wallId: hostWallAt(doc, points[points.length - 1]!) }
					]
				}
			: {})
	});
	if (plan.kind !== 'success') throw new Error(`chain refused: ${plan.rejection.code} ${plan.rejection.message}`);
	return plan.document;
}

/**
 * A k x k gallery grid of CELL_METERS rooms: outer boundary, then k-1 full-length
 * vertical and k-1 full-length horizontal Walls declared as T-connections onto the
 * outer boundary (horizontals node X crossings with the verticals inside the same
 * group). Walls = 2k^2 + 2k after noding, Rooms = k^2.
 */
export function buildGrid(k: number): LayoutDocumentWallFirst {
	const w = k * CELL_METERS;
	let doc = chain(
		createEmptyWallFirstLayoutDocument(),
		[
			[0, 0],
			[w, 0],
			[w, w],
			[0, w]
		],
		{ close: true }
	);
	for (let i = 1; i < k; i++) {
		const x = i * CELL_METERS;
		doc = chain(doc, [[x, 0], [x, w]], { close: false, hostSnapEnds: true });
	}
	for (let i = 1; i < k; i++) {
		const z = i * CELL_METERS;
		doc = chain(doc, [[0, z], [w, z]], { close: false, hostSnapEnds: true });
	}
	return doc;
}

/** One Opening per Wall of length >= 3 m: interior Walls get a door, others a window. */
export function addOpenings(doc: LayoutDocumentWallFirst, perimeterWindows = true): LayoutDocumentWallFirst {
	let current = doc;
	const roomCount = new Map<string, number>();
	for (const room of doc.rooms) for (const ref of room.boundary) roomCount.set(ref.wallId, (roomCount.get(ref.wallId) ?? 0) + 1);
	for (const wall of doc.walls) {
		const a = point(current, wall.startJunctionId);
		const b = point(current, wall.endJunctionId);
		const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
		if (len < 3) continue;
		const interior = (roomCount.get(wall.id) ?? 0) >= 2;
		if (!interior && !perimeterWindows) continue;
		const kind = interior ? 'door' : 'window';
		const plan = planCreateWallFirstOpening(current, { wallId: wall.id, kind, offset: len / 2 - 0.5 });
		if (plan.kind !== 'success') throw new Error(`opening refused on ${wall.id}: ${JSON.stringify((plan as { rejection?: unknown }).rejection)}`);
		current = plan.document;
	}
	return current;
}

export type FixtureSize = { readonly label: string; readonly k: number };
export const SIZES: readonly FixtureSize[] = [
	{ label: 'grid-3 (~20 walls)', k: 3 },
	{ label: 'grid-7 (~100 walls)', k: 7 },
	{ label: 'grid-14 (~400 walls)', k: 14 }
];

export function describeLayout(doc: LayoutDocumentWallFirst) {
	const compiled = compileWallFirstLayoutGeometry(doc);
	const blocking = compiled.issues.filter((issue) => issue.severity !== 'warning');
	return {
		walls: doc.walls.length,
		junctions: doc.junctions.length,
		openings: doc.openings.length,
		rooms: doc.rooms.length,
		blockingIssues: blocking.length,
		firstBlocking: blocking[0]?.message ?? null
	};
}
