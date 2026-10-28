/** On-demand S01 numerical/host CPU rows. No browser presentation or battery claim. */
import { writeFile, readFile } from 'node:fs/promises';
import { evaluateProfile, extrudeProfile } from '@portfolio/geometry-core';
import { createScenePlanners } from '@portfolio/project-model/scene-planning';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core';
import { createStageAcceptanceHost } from '../src/lib/authoring/stage/host-acceptance';
import { createStageFacade } from '../src/lib/authoring/stage/stage-facade';
import { createStageSession } from '../src/lib/authoring/stage/stage-session';
import { admitSource } from '../src/lib/authoring/stage/source-admission';
import { sceneEntityReference } from '../src/lib/authoring/adapters/scene/placement';
import { createUnitProject } from '../tests/lib/authoring/__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../tests/lib/layout/__fixtures__/layout-id-capture';

const output = process.env.PERF_RESULTS_DIR;
if (!output) throw new Error('PERF_RESULTS_DIR is required');
const rings = JSON.parse(await readFile(new URL('../tests/lib/geometry-core/__fixtures__/regular-ring-units.json', import.meta.url), 'utf8'));
const stats = (values: number[]) => {
	const sorted = [...values].sort((a, b) => a - b);
	return { median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * 0.95) - 1], max: sorted.at(-1), samples: sorted.length };
};
const results: Record<string, unknown> = { platform: process.platform, arch: process.arch, node: process.version, method: '30 warm-up +200 samples; varied source coordinates force numerical profile-cache misses; host CPU excludes renderer/presentation' };
for (const count of [32, 256]) {
	const samples: number[] = [];
	for (let i = 0; i < 230; i++) {
		const outline = (rings[String(count)] as [number, number][]).map(([u, v], key) => ({ key: key + 1, u: u + i * 0.000001, v, smooth: true }));
		const start = performance.now();
		extrudeProfile({ profile: evaluateProfile(outline), extent: 1, plane: 'plan', scale: [1, 1, 1] });
		if (i >= 30) samples.push(performance.now() - start);
	}
	results[`evaluation-${count}-cold-source-ms`] = stats(samples);
}
const layout = createEmptyWallFirstLayoutDocument();
const wall = planWallChain({ baseline: layout, points: [[0, 0], [9, 0], [9, 8], [0, 8]], close: true, levelId: layout.floor.id, capture: freshCapture() });
if (wall.kind !== 'success') throw new Error('floor fixture refused');
for (const count of [32, 256]) {
	const source = await createUnitProject({ id: `form-cpu-${count}`, name: 'Form CPU row', layout: wall.document });
	const admitted = await admitSource(source, { sessionEpoch: 'cpu', acceptedRevision: source.acceptedRevision });
	if (admitted.kind !== 'admitted') throw new Error('host fixture refused');
	const session = createStageSession({ sessionEpoch: 'cpu' }); session.replace(admitted.snapshot);
	const stage = createStageFacade({ snapshot: admitted.snapshot, session });
	stage.camera.evaluate({ left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 }, 1);
	stage.acquireInspection('exclusive');
	const host = createStageAcceptanceHost({ facade: stage, sessionEpoch: 'cpu', baseline: { revision: admitted.snapshot.acceptedRevision, source, canonicalJson: admitted.snapshot.canonicalJson, sourceContentId: admitted.snapshot.sourceContentId }, planners: createScenePlanners() });
	const measurements: Record<string, number[]> = {};
	async function measure(label: string, run: () => Promise<{ kind: string }>, measured: boolean) {
		const start = performance.now(); const result = await run(); const elapsed = performance.now() - start;
		if (result.kind !== 'installed') throw new Error(`${label}: ${JSON.stringify(result)}`);
		if (measured) (measurements[label] ??= []).push(elapsed);
	}
	try {
		for (let i = -10; i < 40; i++) {
			const id = `cpu-form-${i + 10}`;
			const outline = (rings[String(count)] as [number, number][]).map(([u, v]) => ({ u, v, smooth: true }));
			await measure('create-form', () => host.accept({ version: 1, kind: 'create-form', operationId: crypto.randomUUID(), expectedRevision: host.acceptedRevision(), targets: [], payload: { plane: 'plan', outline, extent: 1, position: [3, 0, 3], yaw: 0, materialId: 'plaster-warm', name: 'CPU form' }, capturedInputs: [], allocatedIds: [{ kind: 'scene-entity', id }] }), i >= 0);
			await measure('set-form-size', () => host.accept({ version: 1, kind: 'set-form-size', operationId: crypto.randomUUID(), expectedRevision: host.acceptedRevision(), targets: [sceneEntityReference(id, stage.snapshot().domain.unitRevisions.scene)], payload: { entityId: id, scale: [1.1, 1.2, 1.3] }, capturedInputs: [], allocatedIds: [] }), i >= 0);
			await measure('undo-size', () => host.undo(), i >= 0);
			await measure('undo-create', () => host.undo(), i >= 0);
			await measure('redo-create', () => host.redo(), i >= 0);
			await measure('redo-size', () => host.redo(), i >= 0);
			await host.undo(); await host.undo();
		}
		results[`host-${count}-cpu-ms`] = Object.fromEntries(Object.entries(measurements).map(([key, values]) => [key, stats(values)]));
	} finally { host.dispose(); stage.dispose(); }
}
await writeFile(`${output}/native-form-evaluation.json`, JSON.stringify(results, null, 2));
