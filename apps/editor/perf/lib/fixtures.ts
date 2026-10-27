/**
 * The pre-S06 in-flow fixture method (T3.P03.S02), kept only as Bench 1's
 * old-method comparison for the F2 S/M rows (T1.P02.S06 plan A.6).
 *
 * Every other flow loads a precomputed workload (`./workloads/cache.ts`); this
 * builder rebuilds topology through the planners inside each run, which is the
 * setup cost the new method removes.
 */

import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import type { AcceptedRevision } from '@portfolio/project-model';
import {
	createEmptyUnitEnvelope,
	serializeProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import { addOpenings, buildGrid } from './workloads/grid';

export { addOpenings, buildGrid, CELL_METERS } from './workloads/grid';

export type FixtureSize = 'S' | 'M';
export const FIXTURE_GRID: Readonly<Record<FixtureSize, number>> = { S: 3, M: 7 };

export type FixtureProject = {
	/** The old method's size, or a cached tier's workload id; names the chosen file. */
	readonly size: string;
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
