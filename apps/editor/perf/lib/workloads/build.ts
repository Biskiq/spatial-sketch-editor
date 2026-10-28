/**
 * Build one grid workload envelope. Captured identities come from a fixed
 * sequence, so the same inputs give byte-identical canonical JSON.
 */
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core';
import { createEmptyUnitEnvelope, type ProjectEnvelope } from '@portfolio/project-model/units';

import { addOpenings, buildGrid, sequentialCaptures } from './grid';
import type { WorkloadSpec } from './registry';

async function envelopeFor(spec: WorkloadSpec, layout: LayoutDocumentWallFirst): Promise<ProjectEnvelope> {
	return createEmptyUnitEnvelope({
		id: spec.projectId,
		name: spec.name,
		acceptedRevision: { projectId: spec.projectId, revisionId: `${spec.projectId}-r1` },
		layout
	});
}

export async function buildWorkload(spec: WorkloadSpec): Promise<{ envelope: ProjectEnvelope; focusWallId?: string }> {
	if (spec.params.kind !== 'grid') throw new Error(`workload ${spec.id} has no generator (${String(spec.params.kind)})`);
	const k = Number(spec.params.k);
	const captures = sequentialCaptures(`grid${k}x`);
	return { envelope: await envelopeFor(spec, addOpenings(buildGrid(k, captures), captures)) };
}
