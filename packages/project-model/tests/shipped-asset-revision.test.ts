/**
 * The shipped-asset revision guard, enabled after the D8a compatibility audit.
 *
 * Every resolved `asset` record that names a pinned shipped model must declare
 * the pin's exact content revision. A mismatch is executable closure, so Save,
 * cold Load, acceptance and release refuse it through the existing closure
 * envelope without rewriting the record.
 */
import { describe, expect, it } from 'vitest';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core/wall';
import {
	shippedModelResourceEntry,
} from '@portfolio/project-model/scene-planning';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	captureUnitSave,
	computeEnvelopeSourceContentId,
	createProjectEnvelope,
	readUnitEnvelopeForSave,
	serializeProjectEnvelope,
	validateProjectEnvelope,
	type DependencyLockEntry,
	type ProjectEnvelope,
	type TypedResource,
} from '@portfolio/project-model/units';

const ASSET_ID = 'paris-salon-chair';
const TAMPERED = `sha256-${'0'.repeat(64)}`;

async function envelope(revision: string): Promise<ProjectEnvelope> {
	const entry = shippedModelResourceEntry(ASSET_ID)!;
	const resource: TypedResource = { ...entry.resource, contentRevision: revision };
	const lock: DependencyLockEntry = { ...entry.lock, contentRevision: revision };
	return createProjectEnvelope({
		id: 'project-d8a-revision',
		name: 'D8a revision project',
		acceptedRevision: { projectId: 'project-d8a-revision', revisionId: 'revision-1' },
		dependencyLock: { formatVersion: 1, entries: [lock] },
		layout: { unitId: 'unit-layout', data: createEmptyWallFirstLayoutDocument() },
		scene: {
			unitId: 'unit-scene',
			data: {
				formatVersion: SCENE_UNIT_FORMAT_VERSION,
				textures: [],
				materials: [],
				entities: [
					{
						kind: 'model',
						id: 'entity-chair',
						name: 'Salon chair',
						assetId: ASSET_ID,
						fallback: 'generic',
						position: [0, 0, 0],
						rotation: [0, 0, 0],
					},
				],
			},
		},
		camera: {
			unitId: 'unit-camera',
			data: { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views: [], connections: [] },
		},
		experience: {
			unitId: 'unit-experience',
			data: { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences: [] },
		},
		resources: {
			unitId: 'unit-resources',
			data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [resource] },
		},
	});
}

describe('shipped asset revision guard', () => {
	it('accepts the exact shipped pin as closure-clean', async () => {
		const built = await envelope(shippedModelResourceEntry(ASSET_ID)!.resource.contentRevision!);
		const read = validateProjectEnvelope(built);
		expect(read.success).toBe(true);
		if (!read.success) return;
		expect(read.closure).toEqual([]);
	});

	it('reports a tampered resolved revision as asset-revision-mismatch', async () => {
		const read = validateProjectEnvelope(await envelope(TAMPERED));
		expect(read.success).toBe(true);
		if (!read.success) return;
		expect(read.closure).toEqual([
			expect.objectContaining({
				path: '$.units.resources.data.resources[0]',
				code: 'asset-revision-mismatch',
			}),
		]);
	});

	it('refuses a tampered revision at Save capture and at server admission', async () => {
		const built = await envelope(TAMPERED);
		const canonicalJson = serializeProjectEnvelope(built);
		const sourceContentId = await computeEnvelopeSourceContentId(built);
		const captured = await captureUnitSave({
			snapshot: {
				acceptedRevision: built.acceptedRevision,
				sourceContentId,
				sourceKind: 'unit-envelope',
				sourceVersion: 1,
				domain: {
					identity: { acceptedRevision: built.acceptedRevision, sourceContentId },
					source: built,
				},
			},
			operationId: 'op-d8a-revision',
			precondition: { kind: 'create-only' },
		});
		expect(captured.kind).toBe('refused');
		if (captured.kind === 'refused') {
			expect(captured.code).toBe('invalid-project');
			expect(captured.issues.map((issue) => issue.code)).toContain('asset-revision-mismatch');
		}
		const read = await readUnitEnvelopeForSave(canonicalJson);
		expect(read.kind).toBe('refused');
		if (read.kind === 'refused') {
			expect(read.issues.map((issue) => issue.code)).toContain('asset-revision-mismatch');
		}
	});
});
