/**
 * Build one workload envelope (T1.P02.S06 A.1, B). Generator-only (`vite-node`).
 *
 * Captured identities come from fixed sequences, so the same inputs give
 * byte-identical canonical JSON. The museum part of every museum-derived
 * workload uses one sequence (`museum`) and the sweep additions their own, so a
 * museum entity has the same id at ×1, ×3 and ×10: E5 can then show that the
 * fixed edit's changed set never includes an added entity.
 */
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core';
import { createEmptyUnitEnvelope, type ProjectEnvelope } from '@portfolio/project-model/units';

import { addOpenings, buildGrid, sequentialCaptures } from './grid';
import { addSweepBlocks, buildMuseumLayout, SWEEP_BLOCK, type SweepVariant } from './museum-layout';
import { museumPlacements, sweepPlacements, withExperienceRoute, withPlacements } from './museum-content';
import type { WorkloadSpec } from './registry';

/** The museum's Wall count; a sweep factor k adds (k − 1) times as many Walls again. */
export const MUSEUM_BASE_WALLS = 328;

export function sweepBlocks(factor: number): number {
	const wallsPerBlock = 2 * SWEEP_BLOCK.k * SWEEP_BLOCK.k + 2 * SWEEP_BLOCK.k;
	return Math.round(((factor - 1) * MUSEUM_BASE_WALLS) / wallsPerBlock);
}

async function envelopeFor(spec: WorkloadSpec, layout: LayoutDocumentWallFirst): Promise<ProjectEnvelope> {
	return createEmptyUnitEnvelope({
		id: spec.projectId,
		name: spec.name,
		acceptedRevision: { projectId: spec.projectId, revisionId: `${spec.projectId}-r1` },
		layout
	});
}

export async function buildWorkload(spec: WorkloadSpec): Promise<{ envelope: ProjectEnvelope; focusWallId?: string }> {
	const kind = spec.params.kind;
	if (kind === 'grid') {
		const k = Number(spec.params.k);
		const captures = sequentialCaptures(`grid${k}x`);
		return { envelope: await envelopeFor(spec, addOpenings(buildGrid(k, captures), captures)) };
	}
	if (kind === 'museum' || kind === 'sweep') {
		const museum = buildMuseumLayout(sequentialCaptures('museumx'));
		let layout = museum.document;
		let entities = museumPlacements();
		if (kind === 'sweep') {
			const variant = spec.params.variant as SweepVariant;
			const blocks = sweepBlocks(Number(spec.params.factor));
			layout = addSweepBlocks(layout, variant, blocks, sequentialCaptures(`sweep${variant}x`));
			entities = [...entities, ...sweepPlacements(variant, blocks)];
		}
		const envelope = await withExperienceRoute(withPlacements(await envelopeFor(spec, layout), entities));
		return { envelope, focusWallId: museum.focusWallId };
	}
	throw new Error(`workload ${spec.id} has no generator (${String(kind)})`);
}
