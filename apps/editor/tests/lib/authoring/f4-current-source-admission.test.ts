/**
 * `local-single-domain-v1` admission (T1.P01.S03 plan §Admission).
 *
 * Four claims are pinned here, in the order the plan makes them:
 *
 * 1. an admitted source is validated through the project's one writer and the
 *    visitor's one runtime preparation, and its snapshot carries the AM-4 field
 *    names a host composes its boot snapshot from;
 * 2. the *host's* Scene options decide admission, so a source the option-less
 *    reader accepts and the visitor cold runtime refuses cannot be accepted by
 *    the editor ("otherwise the editor could accept a document the visitor cold
 *    runtime refuses");
 * 3. a blocking canonical-compile issue refuses the candidate unless the
 *    baseline already carries it;
 * 4. the per-accept cost is measured on the densest current fixture rather than
 *    assumed.
 */
import { describe, expect, it } from 'vitest';

import {
	CURRENT_SOURCE_KIND,
	CURRENT_SOURCE_VERSION,
	admitCurrentSource,
	admitCurrentSourceContent,
	createCurrentSourceAdapter,
	serializeProject,
	sourceContentIdForCanonicalJson,
	validateProject,
	type AcceptedRevision
} from '@portfolio/project-model';
import {
	FIXTURE_PROJECT_ID,
	FIXTURE_UNKNOWN_ASSET_ID,
	HOST_SCENE_OPTIONS,
	buildCurrentSourceFixture,
	buildDenseCurrentSourceFixture,
	buildFoldedPartitionProject,
	buildUnknownAssetProject
} from './__fixtures__/f4-current-source-fixtures';

const REVISION: AcceptedRevision = { projectId: FIXTURE_PROJECT_ID, revisionId: 'revision-1' };

describe('current-source admission', () => {
	it('admits a valid current source with its content identity and a real runtime preparation', async () => {
		const { project } = buildCurrentSourceFixture();
		const admitted = await admitCurrentSource(project, { acceptedRevision: REVISION });
		expect(admitted.kind).toBe('admitted');
		if (admitted.kind !== 'admitted') return;

		expect(admitted.acceptedRevision).toEqual(REVISION);
		expect(admitted.snapshot.acceptedRevision).toEqual(REVISION);
		expect(admitted.snapshot.sourceKind).toBe(CURRENT_SOURCE_KIND);
		expect(admitted.snapshot.sourceVersion).toBe(CURRENT_SOURCE_VERSION);
		expect(admitted.snapshot.sourceContentId).toBe(admitted.sourceContentId);
		expect(admitted.sourceContentId).toMatch(/^sha256-[0-9a-f]{64}$/);
		// The F.1 read-context identity is the same accepted revision and content.
		expect(admitted.snapshot.domain.identity).toEqual({
			acceptedRevision: REVISION,
			sourceContentId: admitted.sourceContentId
		});
		expect(admitted.snapshot.domain.source).toBe(admitted.project);
		// The canonical bytes are the writer's, not a second serialization.
		const validated = validateProject(project);
		expect(validated.success).toBe(true);
		if (!validated.success) return;
		expect(admitted.canonicalJson).toBe(validated.canonicalJson);
		// The runtime path ran: compiled geometry, resolved Scene and graph.
		expect(admitted.runtime.runtimeScene.navigationNodes.map((node) => node.id)).toEqual(['tour-a', 'tour-b']);
		expect(admitted.runtime.graph.connections.map((connection) => connection.id)).toEqual(['tour-a-b']);
		expect(admitted.blockingIssues).toEqual([]);
	});

	it('refuses a malformed project with the writer\'s own issues', async () => {
		const { project } = buildCurrentSourceFixture();
		const refused = await admitCurrentSource({ ...project, layout: { units: 'meters' } }, {
			acceptedRevision: REVISION
		});
		expect(refused.kind).toBe('rejected');
		if (refused.kind !== 'rejected') return;
		expect(refused.code).toBe('invalid-project');
		expect(refused.issues.length).toBeGreaterThan(0);
	});

	it('refuses a source the visitor cold runtime refuses, though the option-less reader accepts it', async () => {
		const project = buildUnknownAssetProject();
		// The discriminating fact: without the host's catalogue the same document
		// is valid, so admission would be worthless if it validated without them.
		expect(validateProject(project).success).toBe(true);

		const refused = await admitCurrentSource(project, {
			acceptedRevision: REVISION,
			scene: HOST_SCENE_OPTIONS
		});
		expect(refused.kind).toBe('rejected');
		if (refused.kind !== 'rejected') return;
		expect(refused.code).toBe('invalid-project');
		expect(JSON.stringify(refused.issues)).toContain(FIXTURE_UNKNOWN_ASSET_ID);
	});

	it('refuses a new blocking compile issue and admits the same source when the baseline carries it', async () => {
		const project = buildFoldedPartitionProject();
		const first = await admitCurrentSource(project, { acceptedRevision: REVISION });
		expect(first.kind).toBe('rejected');
		if (first.kind !== 'rejected') return;
		expect(first.code).toBe('blocking-geometry');
		expect(first.blockingIssues.map((issue) => issue.code)).toEqual(['wall_offset_fold']);

		// The later-repair-mode path: the same source is admitted when the baseline
		// already carries exactly that issue — baseline-relative, not absolute.
		const repaired = await admitCurrentSource(project, {
			acceptedRevision: REVISION,
			baselineBlockingIssues: first.blockingIssues
		});
		expect(repaired.kind).toBe('admitted');
		if (repaired.kind !== 'admitted') return;
		expect(repaired.blockingIssues.map((issue) => issue.code)).toEqual(['wall_offset_fold']);
	});

	it('exposes the same admission through the source adapter', async () => {
		const adapter = createCurrentSourceAdapter({ scene: HOST_SCENE_OPTIONS });
		expect(adapter.sourceKind).toBe(CURRENT_SOURCE_KIND);
		expect(adapter.sourceVersion).toBe(CURRENT_SOURCE_VERSION);

		const { project } = buildCurrentSourceFixture();
		const admitted = await adapter.admit(project, []);
		expect(admitted.kind).toBe('admitted');

		const refused = await adapter.admit(buildUnknownAssetProject(), []);
		expect(refused.kind).toBe('rejected');
		if (refused.kind !== 'rejected') return;
		expect(refused.issues.length).toBeGreaterThan(0);
		// The adapter's issues are the shared reader's vocabulary, so a coordinator
		// can report them without translating a second shape.
		expect(Object.keys(refused.issues[0]!).sort()).toEqual(['code', 'message', 'path']);
	});

	it('records the per-accept cost on the densest current fixture', async () => {
		const { project } = buildDenseCurrentSourceFixture();
		expect(project.scene.entities).toHaveLength(240);

		const validationStart = performance.now();
		const validated = validateProject(project);
		const validationMs = performance.now() - validationStart;
		expect(validated.success).toBe(true);

		const serializationStart = performance.now();
		const canonicalJson = serializeProject(project);
		const serializationMs = performance.now() - serializationStart;

		const digestStart = performance.now();
		const sourceContentId = await sourceContentIdForCanonicalJson(canonicalJson);
		const digestMs = performance.now() - digestStart;

		const admissionStart = performance.now();
		const admitted = await admitCurrentSourceContent(project);
		const admissionMs = performance.now() - admissionStart;
		expect(admitted.kind).toBe('admitted');
		if (admitted.kind !== 'admitted') return;
		expect(admitted.sourceContentId).toBe(sourceContentId);

		// A recorded observation, never a gate: `tests/README.md` rule 11 forbids a
		// wall-clock floor or threshold in this suite. The numbers exist so the
		// acceptance record can state what per-accept validation, serialization and
		// hashing actually cost on the densest current fixture (the TD-5 lesson)
		// instead of asserting that they are cheap.
		console.info(
			`[T1.P01.S03] per-accept cost, dense current fixture (240 entities, 41 Layout objects): validate ${validationMs.toFixed(1)} ms · serialize ${serializationMs.toFixed(1)} ms · digest ${digestMs.toFixed(1)} ms · admission total ${admissionMs.toFixed(1)} ms`
		);
	}, 30000);
});
