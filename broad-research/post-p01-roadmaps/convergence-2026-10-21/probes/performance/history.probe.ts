// Disposable probe: retained heap of the F.4 coordinator's bounded history
// (AUTHORING_HISTORY_LIMIT entries) after a long edit session, and accept-time
// drift across it. Coordinator only: the Stage host's own per-install snapshot
// and the renderer's buffers are NOT included. Results: ./results/history-warm.json.
import { it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AcceptedRevision } from '@portfolio/project-model';
import {
	computeEnvelopeSourceContentId,
	createEmptyUnitEnvelope,
	createUnitAcceptanceAdapter,
	createUnitAcceptancePreparation,
	createUnitPlannerRegistry,
	serializeProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import { AUTHORING_HISTORY_LIMIT } from '$lib/authoring/f4/history';
import { LAYOUT_WALL_HEIGHT_KIND, buildLayoutIntent, createLayoutPlanners, layoutReference } from '$lib/authoring/adapters/layout/precision';
import { addOpenings, buildGrid } from './fixtures';

const here = path.dirname(fileURLToPath(import.meta.url));
const gc = (globalThis as { gc?: () => void }).gc;
const heapMiB = () => {
	gc?.();
	gc?.();
	return process.memoryUsage().heapUsed / 1048576;
};

it('measures coordinator history retention over a long session', async () => {
	const rows: Record<string, unknown>[] = [];
	for (const k of (process.env.PERF_SIZES ?? '3,7').split(',').map(Number)) {
		const doc = addOpenings(buildGrid(k));
		const revision: AcceptedRevision = { projectId: 'perf-history', revisionId: 'r1' };
		const envelope: ProjectEnvelope = await createEmptyUnitEnvelope({ id: revision.projectId, name: `grid-${k}`, acceptedRevision: revision, layout: doc });
		const before = heapMiB();
		const registry = createUnitPlannerRegistry<ProjectEnvelope>();
		const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
			adapter: createUnitAcceptanceAdapter({ compound: true }),
			preparation: createUnitAcceptancePreparation({ registry, sessionEpoch: 's' }),
			sessionEpoch: 's',
			baseline: { revision, source: envelope, canonicalJson: serializeProjectEnvelope(envelope), sourceContentId: await computeEnvelopeSourceContentId(envelope), blockingIssues: [] },
			planners: createLayoutPlanners()
		});
		const wallIds = doc.walls.map((w) => w.id);
		const edits = AUTHORING_HISTORY_LIMIT + 20;
		const times: number[] = [];
		const heapAt: Record<number, number> = {};
		for (let i = 0; i < edits; i++) {
			const snapshot = coordinator.acceptedSnapshot();
			const rev = coordinator.acceptedRevision();
			const contentRevision = snapshot.domain.source.units.layout.header.contentRevision;
			const wallId = wallIds[i % wallIds.length]!;
			const intent = buildLayoutIntent({
				kind: LAYOUT_WALL_HEIGHT_KIND,
				operationId: `op-${i}`,
				projectId: rev.projectId,
				revisionId: rev.revisionId,
				contentRevision,
				targets: [layoutReference(snapshot as never, { kind: 'wall', id: wallId }, contentRevision)],
				payload: { wallId, height: 3.5 + i * 0.01 }
			});
			const t = performance.now();
			const result = await coordinator.accept(intent);
			times.push(performance.now() - t);
			if (result.kind !== 'accepted') throw new Error(`accept ${result.kind}`);
			if (i + 1 === 10 || i + 1 === 50 || i + 1 === AUTHORING_HISTORY_LIMIT || i + 1 === edits) heapAt[i + 1] = Math.round((heapMiB() - before) * 10) / 10;
		}
		const first10 = [...times.slice(0, 10)].sort((a, b) => a - b)[5]!;
		const last10 = [...times.slice(-10)].sort((a, b) => a - b)[5]!;
		const row = { label: `grid-${k}+openings`, walls: doc.walls.length, historyLimit: AUTHORING_HISTORY_LIMIT, edits, retainedHeapMiBAfterEdits: heapAt, acceptMedianFirst10Ms: Math.round(first10 * 10) / 10, acceptMedianLast10Ms: Math.round(last10 * 10) / 10 };
		rows.push(row);
		console.log(JSON.stringify(row));
		void coordinator;
	}
	mkdirSync(path.join(here, 'results'), { recursive: true });
	writeFileSync(path.join(here, 'results', 'history-warm.json'), JSON.stringify({ node: process.version, date: new Date().toISOString(), gcExposed: Boolean(gc), rows }, null, 1) + '\n');
});
