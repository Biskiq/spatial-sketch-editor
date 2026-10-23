/**
 * Representative S/M project fixtures for the harness (T3.P03.S02).
 *
 * The grid construction is the convergence packet's own fixture generator
 * (`broad-research/post-p01-roadmaps/convergence-2026-10-21/probes/performance/fixtures.ts`,
 * `buildGrid`/`addOpenings` at the recorded 2026-10-22 run). It builds every
 * topology only through public `layout-core` planners — never a document literal
 * — so the fixture exercises the canonical compiler exactly as the starter
 * gallery does. Copying it here keeps the installed harness independent of a
 * research directory that may later be archived, and the workload stays the
 * packet's grid-3 / grid-7.
 *
 * S = grid-3 (~20 walls), M = grid-7 (~100 walls), per the performance
 * contract's representative workloads.
 */

import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	planCreateWallFirstOpening,
	planWallChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import type { AcceptedRevision } from '@portfolio/project-model';
import {
	createEmptyUnitEnvelope,
	serializeProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

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
	options: { close: boolean; hostSnapEnds?: boolean }
): LayoutDocumentWallFirst {
	const plan = planWallChain({
		baseline: document,
		points,
		close: options.close,
		role: 'boundary',
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
export function buildGrid(k: number): LayoutDocumentWallFirst {
	const width = k * CELL_METERS;
	let document = chain(
		createEmptyWallFirstLayoutDocument(),
		[
			[0, 0],
			[width, 0],
			[width, width],
			[0, width]
		],
		{ close: true }
	);
	for (let index = 1; index < k; index++) {
		const x = index * CELL_METERS;
		document = chain(document, [[x, 0], [x, width]], { close: false, hostSnapEnds: true });
	}
	for (let index = 1; index < k; index++) {
		const z = index * CELL_METERS;
		document = chain(document, [[0, z], [width, z]], { close: false, hostSnapEnds: true });
	}
	return document;
}

/** One Opening per Wall of length ≥ 3 m: interior Walls get a door, others a window. */
export function addOpenings(document: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
	let current = document;
	const roomCount = new Map<string, number>();
	for (const room of document.rooms) {
		for (const reference of room.boundary) {
			roomCount.set(reference.wallId, (roomCount.get(reference.wallId) ?? 0) + 1);
		}
	}
	for (const wall of document.walls) {
		const a = point(current, wall.startJunctionId);
		const b = point(current, wall.endJunctionId);
		const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
		if (length < 3) continue;
		const kind = (roomCount.get(wall.id) ?? 0) >= 2 ? 'door' : 'window';
		const plan = planCreateWallFirstOpening(current, { wallId: wall.id, kind, offset: length / 2 - 0.5 });
		if (plan.kind !== 'success') throw new Error(`opening refused on ${wall.id}`);
		current = plan.document;
	}
	return current;
}

export type FixtureSize = 'S' | 'M';
export const FIXTURE_GRID: Readonly<Record<FixtureSize, number>> = { S: 3, M: 7 };

export type FixtureProject = {
	readonly size: FixtureSize;
	readonly projectId: string;
	readonly envelope: ProjectEnvelope;
	readonly canonicalJson: string;
	readonly facts: { walls: number; openings: number; rooms: number };
};

export async function fixtureProject(size: FixtureSize, projectId: string): Promise<FixtureProject> {
	const document = addOpenings(buildGrid(FIXTURE_GRID[size]));
	const compiled = compileWallFirstLayoutGeometry(document);
	const blocking = compiled.issues.filter((issue) => issue.severity !== 'warning');
	if (blocking.length > 0) {
		throw new Error(`fixture ${size} has ${blocking.length} blocking compile issues: ${blocking[0]?.message}`);
	}
	const acceptedRevision: AcceptedRevision = { projectId, revisionId: `revision-${size.toLowerCase()}-1` };
	const envelope = await createEmptyUnitEnvelope({
		id: projectId,
		name: `Perf ${size} pavilion`,
		acceptedRevision,
		layout: document
	});
	return {
		size,
		projectId,
		envelope,
		canonicalJson: serializeProjectEnvelope(envelope),
		facts: { walls: document.walls.length, openings: document.openings.length, rooms: document.rooms.length }
	};
}
