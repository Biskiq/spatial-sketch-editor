/**
 * T1.P02.S06 D.3 (H4) — the retained representation, counted.
 *
 * Bench 1 measured two things this probe answers with counts instead of timings:
 *
 * - **the per-commit representation cost.** Every compile used to rebuild every
 *   Wall's and object's `BufferGeometry`, materials and mesh (F4/F8's
 *   representation half at L: 167 ms), and each drag preview paid it again.
 * - **F13's "geometries back to baseline" clause.** Each accepted commit left
 *   about 1.3 more live geometries per mesh (+2,968 at L) because a superseded
 *   geometry was never released.
 *
 * The probe drives one representation through a sequence of single-Junction edits
 * — the same shape a precision drag produces — and reports, per edit, how many
 * meshes were built, how many were kept by reference and how many were released.
 * It counts `BufferGeometry.dispose` calls against the meshes the representation
 * built, so "return to baseline" is a subtraction rather than an inference.
 *
 * Node only, no browser, no GPU: these are construction counts, not frame times.
 *
 * Usage: `PERF_WORKLOAD_DIR=perf/.workloads npx vite-node perf/census/probe-h4-representation.ts`
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BufferGeometry } from 'three';
import {
	compileWallFirstLayoutGeometry,
	createLayoutCompileSession,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import { createObjectRepresentation } from '../../src/lib/render/layout-object-representation';
import { createWallRepresentation } from '../../src/lib/render/layout-wall-representation';
import { neutralVisitorRoomPresentation } from '../../src/lib/visitor/room-presentation';

const WORKLOADS = ['grid-S', 'grid-M', 'grid-L', 'museum'] as const;
const EDITS = 10;

function workload(name: string): LayoutDocumentWallFirst {
	const directory = process.env.PERF_WORKLOAD_DIR ?? 'perf/.workloads';
	const parsed = JSON.parse(readFileSync(join(directory, `${name}.json`), 'utf8')) as {
		document?: LayoutDocumentWallFirst;
		units?: { layout?: { data: LayoutDocumentWallFirst } };
	};
	return parsed.document ?? parsed.units?.layout?.data ?? (parsed as unknown as LayoutDocumentWallFirst);
}

/** The i-th distinct single-Junction edit: what a precision drag emits. */
function edited(document: LayoutDocumentWallFirst, index: number): LayoutDocumentWallFirst {
	const next = JSON.parse(JSON.stringify(document)) as LayoutDocumentWallFirst;
	const wall = next.walls[index % next.walls.length]!;
	const junction = next.junctions.find((candidate) => candidate.id === wall.startJunctionId);
	if (!junction) return next;
	junction.point = [junction.point[0] + 1e-3, junction.point[1] + 1e-3] as LayoutVec2;
	return next;
}

const dispose = BufferGeometry.prototype.dispose;
let disposed = 0;
BufferGeometry.prototype.dispose = function counted(this: BufferGeometry): void {
	disposed += 1;
	dispose.call(this);
};

for (const name of WORKLOADS) {
	// The prototype patch counts across every workload, so each row reports its
	// own delta.
	const disposedAtStart = disposed;
	const document = workload(name);
	const session = createLayoutCompileSession();
	const walls = createWallRepresentation();
	const objects = createObjectRepresentation();
	const presentation = (geometry: ReturnType<typeof compileWallFirstLayoutGeometry>['geometry']) =>
		Object.fromEntries(geometry.rooms.map((room) => [room.roomId, neutralVisitorRoomPresentation]));

	const first = session.compile(document).geometry;
	walls.update(first, presentation(first));
	objects.update(first);
	const wallCount = walls.object3d.children.length;
	const objectCount = objects.object3d.children.length;
	// One `BufferGeometry` per mesh the representation builds.
	let meshesBuilt = wallCount + objectCount;
	let wallsBuilt = 0;
	let wallsKept = 0;
	let wallsReleased = 0;
	let objectsBuilt = 0;
	let meshesRetained = 0;
	for (let index = 0; index < EDITS; index += 1) {
		const next = session.compile(edited(document, index)).geometry;
		const wallStats = walls.update(next, presentation(next));
		const objectStats = objects.update(next);
		wallsBuilt += wallStats.built;
		wallsKept += wallStats.retained;
		wallsReleased += wallStats.released;
		objectsBuilt += objectStats.built;
		meshesBuilt += wallStats.built + objectStats.built;
		meshesRetained += wallStats.retained + objectStats.retained;
	}

	// What is live *after* the edits: one mesh per current Wall and object, which
	// is the F13 clause (superseded representation does not accumulate).
	const liveWalls = walls.object3d.children.length;
	const liveAfterEdits = liveWalls + objects.object3d.children.length;

	// Release everything the representation owns: after this, every geometry it
	// ever built must have been disposed exactly once, and the scene graph empty.
	walls.dispose();
	objects.dispose();
	const afterTeardown = walls.object3d.children.length + objects.object3d.children.length;
	const disposedHere = disposed - disposedAtStart;

	console.log(
		`${name}: walls ${wallCount} objects ${objectCount} | per edit built ` +
			`${(wallsBuilt / EDITS).toFixed(1)} walls + ${(objectsBuilt / EDITS).toFixed(1)} objects and retained ` +
			`${(meshesRetained / EDITS).toFixed(0)} meshes | released in-flight ${wallsReleased} | ` +
			`live after ${EDITS} edits ${liveAfterEdits} | geometries built ${meshesBuilt}, ` +
			`disposed ${disposedHere} | after teardown ${afterTeardown} meshes`
	);

	// The probe fails rather than reports: a whole-document rebuild, an
	// accumulating representation or an unbalanced geometry ledger is a
	// regression, and a printed number nobody reads is not an oracle.
	const currentEntities = wallCount + objectCount;
	if (liveWalls !== wallCount || liveAfterEdits !== currentEntities) {
		throw new Error(`${name}: the representation does not hold one mesh per entity (${liveAfterEdits} of ${currentEntities})`);
	}
	if (wallCount > 8 && wallsBuilt / EDITS >= wallCount) {
		throw new Error(`${name}: a single edit rebuilt every Wall (${(wallsBuilt / EDITS).toFixed(1)} of ${wallCount})`);
	}
	if (disposedHere !== meshesBuilt) {
		throw new Error(`${name}: geometries built (${meshesBuilt}) != disposed (${disposedHere})`);
	}
	if (afterTeardown !== 0) throw new Error(`${name}: ${afterTeardown} meshes survived teardown`);
}

BufferGeometry.prototype.dispose = dispose;
