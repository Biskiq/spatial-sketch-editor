// @vitest-environment jsdom
/**
 * T2 D8a — a shipped catalogue model is placeable in a project that holds no
 * asset resource.
 *
 * One `place-object` installs the entity, the pinned asset resource and its
 * `resource:asset` lock; Undo removes all three and Redo restores them; a second
 * placement reuses the held record; Save and reopen preserve it; and the cold
 * visitor runtime composes the same model. A tampered revision refuses at cold
 * Load through the shared closure guard.
 */
import { describe, expect, it } from 'vitest';
import {
	createScenePlanners,
	type NormalizedPlacementDefinition,
} from '@portfolio/project-model/scene-planning';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import {
	captureUnitSave,
	readUnitEnvelopeForSave,
	type ProjectEnvelope,
} from '@portfolio/project-model/units';
import {
	catalogueModelDefinition,
	nativePlacementDefinition,
} from '$lib/authoring/scene/object-definition-policy';
import { composeColdReleaseBundle } from '$lib/visitor/visitor-cold-runtime';
import type { AcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import {
	admitUnitProject,
	createUnitCoordinator,
	createUnitProject,
} from '../__fixtures__/unit-envelope-fixtures';

const PROJECT_ID = 'project-d8a-catalogue';
const REVISION = { projectId: PROJECT_ID, revisionId: 'revision-1' };
const ASSET_ID = 'paris-salon-chair';
const ASSET_REVISION = 'sha256-480698dafa0c4d17960db4d218e7db462a327ea86a8e7d22a8f49fb25ab6ff9e';

function intent(input: {
	readonly revision: { projectId: string; revisionId: string };
	readonly operationId: string;
	readonly entityId: string;
	readonly definition: NormalizedPlacementDefinition;
	readonly worldXZ: readonly [number, number];
}): AuthoringIntent {
	return {
		version: 1,
		kind: 'place-object',
		operationId: input.operationId,
		expectedRevision: { ...input.revision },
		targets: [],
		payload: {
			definitionKey: input.definition.definitionKey,
			metadataContentId: input.definition.metadataContentId,
			worldXZ: [input.worldXZ[0], input.worldXZ[1]],
			yaw: 0,
			frame: { origin: [0, 0, 0], yaw: 0 },
			frameReference: { version: 1, kind: 'project-world' },
		},
		capturedInputs: [],
		allocatedIds: [{ kind: 'scene-entity', id: input.entityId }],
	};
}

async function boot() {
	const project = await createUnitProject({
		id: PROJECT_ID,
		name: 'D8a catalogue placement',
		acceptedRevision: REVISION,
	});
	const admitted = await admitUnitProject(project, REVISION);
	if (admitted.kind !== 'admitted') throw new Error(JSON.stringify(admitted.issues));
	const chair = await catalogueModelDefinition(ASSET_ID);
	if (chair === null) throw new Error('the salon chair has no admitted definition');
	const definitions = [await nativePlacementDefinition('box'), chair];
	const coordinator = await createUnitCoordinator({
		sessionEpoch: 'session-d8a',
		baseline: {
			revision: admitted.project.acceptedRevision,
			source: admitted.project,
			canonicalJson: admitted.canonicalJson,
			sourceContentId: admitted.sourceContentId,
		},
		planners: createScenePlanners({ definitions }),
		mintRevisionId: (ordinal: number) => `revision-${ordinal + 1}`,
	});
	return { coordinator, chair, admitted };
}

function now(coordinator: AcceptanceCoordinator<ProjectEnvelope>) {
	return coordinator.current();
}

function lockEntries(envelope: ProjectEnvelope) {
	return envelope.dependencyLock.entries.filter((entry) => entry.domain === 'resource:asset');
}

describe('catalogue model placement through the F.4 coordinator (D8a)', () => {
	it('installs entity, pinned resource and lock once, and Undo removes all three', async () => {
		const { coordinator, chair, admitted } = await boot();
		const placed = await coordinator.accept(
			intent({
				revision: now(coordinator).revision,
				operationId: 'op-chair-1',
				entityId: 'entity-chair-1',
				definition: chair,
				worldXZ: [1, 1],
			}),
		);
		expect(placed.kind).toBe('accepted');
		if (placed.kind !== 'accepted') return;

		const accepted = now(coordinator);
		const resource = accepted.source.units.resources.data.resources.find(
			(candidate) => candidate.kind === 'asset' && candidate.id === ASSET_ID,
		);
		expect(resource).toMatchObject({
			kind: 'asset',
			id: ASSET_ID,
			contentRevision: ASSET_REVISION,
			pin: null,
			unresolved: null,
		});
		expect(lockEntries(accepted.source)).toEqual([
			expect.objectContaining({ subjectId: ASSET_ID, contentRevision: ASSET_REVISION }),
		]);
		expect(accepted.source.units.scene.data.entities).toContainEqual(
			expect.objectContaining({ id: 'entity-chair-1', kind: 'model', assetId: ASSET_ID }),
		);

		const undo = await coordinator.undo();
		expect(undo.kind).toBe('restored');
		expect(now(coordinator).canonicalJson).toBe(admitted.canonicalJson);
		expect(now(coordinator).source.units.resources.data.resources).toEqual([]);
		expect(lockEntries(now(coordinator).source)).toEqual([]);

		const redo = await coordinator.redo();
		expect(redo.kind).toBe('restored');
		expect(now(coordinator).canonicalJson).toBe(accepted.canonicalJson);
		expect(now(coordinator).source.units.resources.data.resources).toHaveLength(1);
	});

	it('reuses the held resource on a second placement', async () => {
		const { coordinator, chair } = await boot();
		const first = await coordinator.accept(
			intent({
				revision: now(coordinator).revision,
				operationId: 'op-chair-1',
				entityId: 'entity-chair-1',
				definition: chair,
				worldXZ: [1, 1],
			}),
		);
		expect(first.kind).toBe('accepted');
		const second = await coordinator.accept(
			intent({
				revision: now(coordinator).revision,
				operationId: 'op-chair-2',
				entityId: 'entity-chair-2',
				definition: chair,
				worldXZ: [2, 2],
			}),
		);
		expect(second.kind).toBe('accepted');

		const source = now(coordinator).source;
		expect(
			source.units.resources.data.resources.filter((entry) => entry.id === ASSET_ID),
		).toHaveLength(1);
		expect(lockEntries(source)).toHaveLength(1);
		expect(
			source.units.scene.data.entities.filter(
				(entity) => entity.kind === 'model' && entity.assetId === ASSET_ID,
			),
		).toHaveLength(2);
	});

	it('preserves the grant across Save and reopen, and refuses a tampered revision at cold Load', async () => {
		const { coordinator, chair } = await boot();
		const placed = await coordinator.accept(
			intent({
				revision: now(coordinator).revision,
				operationId: 'op-chair-save',
				entityId: 'entity-chair-save',
				definition: chair,
				worldXZ: [1.5, 1.5],
			}),
		);
		expect(placed.kind).toBe('accepted');
		const accepted = now(coordinator);
		const captured = await captureUnitSave({
			snapshot: {
				acceptedRevision: accepted.revision,
				sourceContentId: accepted.sourceContentId,
				sourceKind: 'unit-envelope',
				sourceVersion: 1,
				domain: {
					identity: {
						acceptedRevision: accepted.revision,
						sourceContentId: accepted.sourceContentId,
					},
					source: accepted.source,
				},
			},
			operationId: 'op-chair-save-capture',
			precondition: { kind: 'create-only' },
		});
		expect(captured.kind).toBe('captured');
		if (captured.kind !== 'captured') return;

		const read = await readUnitEnvelopeForSave(captured.capture.canonicalJson);
		expect(read.kind).toBe('read');
		if (read.kind !== 'read') return;
		const reopened = await admitUnitProject(read.envelope, accepted.revision);
		expect(reopened.kind).toBe('admitted');
		if (reopened.kind !== 'admitted') return;
		expect(
			reopened.project.units.resources.data.resources.find((entry) => entry.id === ASSET_ID),
		).toMatchObject({ contentRevision: ASSET_REVISION });
		expect(lockEntries(reopened.project)).toHaveLength(1);

		// The visitor cold runtime composes the same body from the saved document.
		const bundle = composeColdReleaseBundle({
			document: JSON.parse(captured.capture.canonicalJson) as unknown,
			manifest: { releaseId: 'release-d8a', bytesByUri: new Map() },
		});
		expect(bundle.scene.entities).toContainEqual(
			expect.objectContaining({ kind: 'model', assetId: ASSET_ID }),
		);
		bundle.dispose();

		const tampered = JSON.parse(captured.capture.canonicalJson) as {
			units: {
				resources: { data: { resources: { id: string; contentRevision: string | null }[] } };
			};
		};
		for (const resource of tampered.units.resources.data.resources) {
			if (resource.id === ASSET_ID) resource.contentRevision = `sha256-${'0'.repeat(64)}`;
		}
		const refused = await admitUnitProject(tampered, accepted.revision);
		expect(refused.kind).toBe('rejected');
		if (refused.kind === 'rejected') {
			expect(refused.issues.map((issue) => issue.code)).toContain('asset-revision-mismatch');
		}
	});
});
