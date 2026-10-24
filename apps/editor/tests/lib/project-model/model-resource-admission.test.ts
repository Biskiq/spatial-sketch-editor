/**
 * T2.P02.S01 — model resources, their closure and admission.
 *
 * The slice's editor-visible contract: a `model` resource is an approved
 * immutable revision (derivative pin + retained source manifest + recipe +
 * report digest + floor placement); a Scene model names the catalogue or a
 * `model` resource of the same envelope, with the generic fallback; a model
 * resource without its lock and a lock without its resource are executable
 * closure failures; old format numbers refuse; and a resource- or lock-changing
 * candidate needs **both** the host's staging grant and the producing planner's
 * `resources` grant.
 *
 * The API storage and Save verification of the same pins are proven against real
 * Postgres in `apps/api/tests/model-resources.test.mjs`.
 */
import { describe, expect, it } from 'vitest';

import { createEmptyWallFirstLayoutDocument } from '@portfolio/project-model';
import type { PlannerAdmission } from '@portfolio/project-model';
import {
	creatorModelDefinition,
	creatorModelResourceEntry,
	withCreatorModelResource
} from '@portfolio/project-model/scene-planning';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	MODEL_RESOURCE_MIME,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	createProjectEnvelope,
	createUnitAcceptanceAdapter,
	prepareUnitRuntime,
	validateProjectEnvelope,
	validateResourcePayload,
	type DependencyLockEntry,
	type ModelPlacement,
	type ModelResourceDetail,
	type ProjectEnvelope,
	type ResourcePin,
	type TypedResource
} from '@portfolio/project-model/units';

const DERIVATIVE_HASH = `sha256-${'d'.repeat(64)}`;
const SOURCE_MANIFEST_HASH = `sha256-${'a'.repeat(64)}`;
const REPORT_DIGEST = `sha256-${'b'.repeat(64)}`;
const MODEL_ID = 'creator-model-1';

const DERIVATIVE_PIN: ResourcePin = {
	hash: DERIVATIVE_HASH,
	mime: MODEL_RESOURCE_MIME,
	size: 4096,
	locator: `/projects/project-1/models/content/${DERIVATIVE_HASH}`
};

const PLACEMENT: ModelPlacement = {
	metresPerSourceUnit: 0.5,
	pivot: [0, 0, 0],
	footprint: { width: 1.2, depth: 0.8 },
	contactMinY: 0,
	placement: 'floor'
};

const MODEL_DETAIL: ModelResourceDetail = {
	source: { manifestHash: SOURCE_MANIFEST_HASH, size: 8192, fileCount: 2 },
	recipe: { id: 'creator-import', version: 1 },
	reportDigest: REPORT_DIGEST,
	placement: PLACEMENT
};

function modelResource(overrides: Partial<TypedResource> = {}): TypedResource {
	return {
		kind: 'model',
		id: MODEL_ID,
		contentRevision: DERIVATIVE_HASH,
		pin: DERIVATIVE_PIN,
		unresolved: null,
		model: MODEL_DETAIL,
		...overrides
	};
}

function modelLockEntry(overrides: Partial<DependencyLockEntry> = {}): DependencyLockEntry {
	return {
		domain: 'resource:model',
		subjectKind: 'resource',
		subjectId: MODEL_ID,
		instancePath: [],
		contentRevision: DERIVATIVE_HASH,
		requiredCapabilities: [{ id: 'F2.unit-envelope', version: '1' }],
		pin: DERIVATIVE_PIN,
		...overrides
	};
}

async function envelope(
	options: {
		resources?: readonly TypedResource[];
		lockEntries?: readonly DependencyLockEntry[];
		entities?: readonly Record<string, unknown>[];
		id?: string;
	} = {}
): Promise<ProjectEnvelope> {
	const id = options.id ?? 'project-1';
	return createProjectEnvelope({
		id,
		name: 'Creator model project',
		acceptedRevision: { projectId: id, revisionId: 'revision-1' },
		dependencyLock: { formatVersion: 1, entries: options.lockEntries ?? [] },
		layout: { unitId: `${id}:layout`, data: createEmptyWallFirstLayoutDocument() },
		scene: {
			unitId: `${id}:scene`,
			data: {
				formatVersion: SCENE_UNIT_FORMAT_VERSION,
				textures: [],
				materials: [],
				entities: (options.entities ?? []) as never
			}
		},
		camera: { unitId: `${id}:camera`, data: { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views: [], connections: [] } },
		experience: { unitId: `${id}:experience`, data: { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences: [] } },
		resources: {
			unitId: `${id}:resources`,
			data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: options.resources ?? [] }
		}
	});
}

function placedModel(assetId = MODEL_ID): Record<string, unknown> {
	return {
		kind: 'model',
		id: 'entity-model-1',
		name: 'Imported model',
		assetId,
		fallback: 'generic',
		position: [0, 0, 0],
		rotation: [0, 0, 0]
	};
}

describe('the model resource format', () => {
	it('round trips an approved model resource with its retained source, recipe, report and placement', async () => {
		const built = await envelope({ resources: [modelResource()], lockEntries: [modelLockEntry()] });
		const read = validateProjectEnvelope(JSON.parse(JSON.stringify(built)));
		expect(read.success).toBe(true);
		if (!read.success) return;
		expect(read.envelope.units.resources.data.resources[0]).toMatchObject({
			kind: 'model',
			id: MODEL_ID,
			contentRevision: DERIVATIVE_HASH,
			pin: DERIVATIVE_PIN,
			model: MODEL_DETAIL
		});
		expect(read.closure).toEqual([]);
	});

	it('refuses a model resource with no approved derivative pin or no detail', () => {
		const noPin = validateResourcePayload({
			formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
			resources: [{ ...modelResource(), pin: null, contentRevision: null }]
		});
		expect(noPin.success).toBe(false);
		if (noPin.success) return;
		// Without a pin a model resource is an unresolved binding, never an admitted
		// resource; the reader refuses before any Scene can name it.
		expect(noPin.issues.map((issue) => issue.code)).toContain('unresolved-resource-without-diagnostic');

		const noDetail = validateResourcePayload({
			formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
			resources: [{ kind: 'model', id: MODEL_ID, contentRevision: DERIVATIVE_HASH, pin: DERIVATIVE_PIN, unresolved: null }]
		});
		expect(noDetail.success).toBe(false);
		if (noDetail.success) return;
		expect(noDetail.issues.map((issue) => issue.code)).toContain('missing-model-detail');
	});

	it('refuses a null model detail on a model resource and on a texture resource', () => {
		const nullModel = validateResourcePayload({
			formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
			resources: [{ ...modelResource(), model: null }]
		});
		expect(nullModel.success).toBe(false);
		if (!nullModel.success) {
			expect(nullModel.issues.map((issue) => issue.code)).toContain('invalid-type');
		}

		const nullTexture = validateResourcePayload({
			formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
			resources: [
				{
					kind: 'texture',
					id: 'unused-texture',
					contentRevision: null,
					pin: { hash: DERIVATIVE_HASH, mime: 'image/png', size: 8, locator: `/projects/project-1/assets/unused-texture` },
					unresolved: null,
					model: null
				}
			]
		});
		expect(nullTexture.success).toBe(false);
		if (!nullTexture.success) {
			expect(nullTexture.issues.map((issue) => issue.code)).toContain('invalid-type');
		}
	});

	it('refuses a content revision that is not the derivative pin hash and a non-GLB derivative type', () => {
		const mismatched = validateResourcePayload({
			formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
			resources: [modelResource({ contentRevision: `sha256-${'c'.repeat(64)}` })]
		});
		expect(mismatched.success).toBe(false);
		if (!mismatched.success) {
			expect(mismatched.issues.map((issue) => issue.code)).toContain('content-revision-mismatch');
		}

		const wrongType = validateResourcePayload({
			formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
			resources: [modelResource({ pin: { ...DERIVATIVE_PIN, mime: 'application/octet-stream' } })]
		});
		expect(wrongType.success).toBe(false);
		if (!wrongType.success) {
			expect(wrongType.issues.map((issue) => issue.code)).toContain('unsupported-media-type');
		}
	});

	it('refuses an unknown model key and a part field on the model detail', () => {
		const unknown = validateResourcePayload({
			formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
			resources: [{ ...modelResource(), parts: [] }]
		});
		expect(unknown.success).toBe(false);

		const partField = validateResourcePayload({
			formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
			resources: [
				{
					...modelResource(),
					model: { ...MODEL_DETAIL, placement: { ...PLACEMENT, variant: 'left' } }
				}
			]
		});
		expect(partField.success).toBe(false);
	});

	it('refuses the old resources and Scene format numbers without migrating them', async () => {
		expect(validateResourcePayload({ formatVersion: 1, resources: [] }).success).toBe(false);
		const built = await envelope();
		const back = JSON.parse(JSON.stringify(built)) as {
			units: Record<string, { header: Record<string, unknown>; data: Record<string, unknown> }>;
		};
		const oldScene = {
			...back,
			units: { ...back.units, scene: { header: back.units.scene!.header, data: { ...back.units.scene!.data, formatVersion: 2 } } }
		};
		expect(validateProjectEnvelope(oldScene).success).toBe(false);
		const oldResources = {
			...back,
			units: {
				...back.units,
				resources: { header: back.units.resources!.header, data: { ...back.units.resources!.data, formatVersion: 1 } }
			}
		};
		expect(validateProjectEnvelope(oldResources).success).toBe(false);
	});
});

describe('model closure', () => {
	it('requires a lock entry for every model resource', async () => {
		const built = await envelope({ resources: [modelResource()] });
		const read = validateProjectEnvelope(JSON.parse(JSON.stringify(built)));
		expect(read.success).toBe(true);
		if (!read.success) return;
		expect(read.closure.map((finding) => finding.code)).toEqual(['missing-lock']);
	});

	it('refuses a lock entry whose resource the registry does not carry', async () => {
		const built = await envelope({ lockEntries: [modelLockEntry()] });
		const read = validateProjectEnvelope(JSON.parse(JSON.stringify(built)));
		expect(read.success).toBe(true);
		if (!read.success) return;
		expect(read.closure.map((finding) => finding.code)).toEqual(['missing-resource']);
	});

	it('requires the entry a Scene model names and accepts the entry plus its lock', async () => {
		const missingEntry = await envelope({ entities: [placedModel()] });
		const read = validateProjectEnvelope(JSON.parse(JSON.stringify(missingEntry)));
		expect(read.success).toBe(true);
		if (!read.success) return;
		expect(read.closure.map((finding) => finding.code)).toEqual(['missing-resource']);

		const complete = await envelope({
			entities: [placedModel()],
			resources: [modelResource()],
			lockEntries: [modelLockEntry()]
		});
		const admitted = validateProjectEnvelope(JSON.parse(JSON.stringify(complete)));
		expect(admitted.success).toBe(true);
		if (!admitted.success) return;
		expect(admitted.closure).toEqual([]);
	});

	it('still reports a catalogue model whose asset resource is absent (unchanged catalogue rule)', async () => {
		const built = await envelope({ entities: [placedModel('paris-grand-piano')] });
		const read = validateProjectEnvelope(JSON.parse(JSON.stringify(built)));
		expect(read.success).toBe(true);
		if (!read.success) return;
		expect(read.closure.map((finding) => finding.code)).toEqual(['missing-resource']);
	});
});

describe('admission', () => {
	it('refuses a model id that is neither catalogue nor this envelope’s model resource', async () => {
		const built = await envelope({ entities: [placedModel('someone-elses-model')] });
		const catalogue = { isKnownAssetId: (id: string) => id.startsWith('paris-') };
		const prepared = prepareUnitRuntime(JSON.parse(JSON.stringify(built)), catalogue);
		expect(prepared.kind).toBe('rejected');
	});
});

describe('the resource grant is the host’s plus the planner’s', () => {
	async function pair(): Promise<{ before: ProjectEnvelope; after: ProjectEnvelope }> {
		const before = await envelope();
		const after = await envelope({
			resources: [modelResource()],
			lockEntries: [modelLockEntry()]
		});
		return { before, after };
	}

	const planner: PlannerAdmission = {
		domain: 'scene',
		compound: false,
		units: true,
		resources: true
	};

	it('refuses a resource and lock change without the host staging grant', async () => {
		const { before, after } = await pair();
		const adapter = createUnitAcceptanceAdapter({ compound: true });
		const issues = adapter.validateChange!(before, after, planner);
		expect(issues.map((issue) => issue.code)).toContain('unsupported-resource');
	});

	it('refuses the same change when the host grants staging but the planner does not declare resources', async () => {
		const { before, after } = await pair();
		const adapter = createUnitAcceptanceAdapter({ compound: true, resourceStaging: true });
		const issues = adapter.validateChange!(before, after, { ...planner, resources: false });
		expect(issues.map((issue) => issue.code)).toContain('unsupported-resource');
		expect(issues.find((issue) => issue.code === 'unsupported-resource')?.message).toContain(
			'producing planner does not declare resource staging'
		);
	});

	it('admits the change only with both grants', async () => {
		const { before, after } = await pair();
		const adapter = createUnitAcceptanceAdapter({ compound: true, resourceStaging: true });
		expect(adapter.validateChange!(before, after, planner)).toEqual([]);
	});
});

/**
 * T2.P02.S02 — approval → resource + lock, and resource → placement definition.
 *
 * These are the two translations the import journey adds over S01's storage. Both
 * are total and refuse rather than repair, so an unplaceable or unpinnable
 * approval can never reach the floor through a fallback.
 */
describe('creator model placement translation', () => {
	function approval(overrides: Record<string, unknown> = {}) {
		return {
			derivative: {
				hash: DERIVATIVE_HASH,
				mime: MODEL_RESOURCE_MIME,
				size: 4096,
				locator: `/projects/project-1/models/content/${DERIVATIVE_HASH}`
			},
			source: { manifestHash: SOURCE_MANIFEST_HASH, size: 8192, fileCount: 2 },
			recipe: { id: 'creator-import@1', version: 1 },
			reportDigest: REPORT_DIGEST,
			placement: {
				metresPerSourceUnit: 0.01,
				pivot: [0, 0, 0] as [number, number, number],
				footprint: { width: 0.8, depth: 0.6 },
				contactMinY: -0.25
			},
			...overrides
		} as Parameters<typeof creatorModelResourceEntry>[1];
	}

	it('turns one approval into a pinned model resource and its exact lock', () => {
		const entry = creatorModelResourceEntry(MODEL_ID, approval());
		expect(entry).not.toBeNull();
		expect(entry!.resource).toMatchObject({
			kind: 'model',
			id: MODEL_ID,
			contentRevision: DERIVATIVE_HASH,
			pin: { hash: DERIVATIVE_HASH, mime: MODEL_RESOURCE_MIME, size: 4096 },
			unresolved: null
		});
		expect(entry!.lock).toMatchObject({
			domain: 'resource:model',
			subjectId: MODEL_ID,
			contentRevision: DERIVATIVE_HASH,
			pin: { hash: DERIVATIVE_HASH }
		});
	});

	it('refuses an approval the editor cannot pin or place', () => {
		const cases: [string, Record<string, unknown>][] = [
			['wrong media type', { derivative: { ...approval().derivative, mime: 'model/gltf+json' } }],
			['bad pin hash', { derivative: { ...approval().derivative, hash: 'sha256-nope' } }],
			['zero derivative', { derivative: { ...approval().derivative, size: 0 } }],
			['unknown recipe', { recipe: { id: 'creator-import@2', version: 2 } }],
			['bad report digest', { reportDigest: 'not-a-digest' }],
			['non-positive scale', { placement: { ...approval().placement, metresPerSourceUnit: 0 } }],
			['degenerate footprint', { placement: { ...approval().placement, footprint: { width: 0, depth: 0.6 } } }],
			['non-finite contact', { placement: { ...approval().placement, contactMinY: Number.NaN } }],
			['no source files', { source: { ...approval().source, fileCount: 0 } }]
		];
		for (const [label, overrides] of cases) {
			expect(creatorModelResourceEntry(MODEL_ID, approval(overrides)), label).toBeNull();
		}
		expect(creatorModelResourceEntry('   ', approval())).toBeNull();
	});

	it('derives the normalized definition from the confirmed placement, not from a mesh', async () => {
		const entry = creatorModelResourceEntry(MODEL_ID, approval())!;
		const definition = await creatorModelDefinition(entry.resource, 'Chair');
		expect(definition).not.toBeNull();
		expect(definition!.definitionKey).toBe('model:creator-model-1');
		expect(definition!.contactMinY).toBe(-0.25);
		expect(definition!.footprintMeters).toEqual([
			[-0.4, -0.3],
			[0.4, -0.3],
			[0.4, 0.3],
			[-0.4, 0.3]
		]);
		expect(definition!.creationDefaults).toEqual({
			kind: 'model',
			name: 'Chair',
			assetId: MODEL_ID,
			fallback: 'generic'
		});
		expect(definition!.admission.provenance).toEqual({
			kind: 'verified-model',
			verificationId: `creator-import:${REPORT_DIGEST}`
		});

		// The identity covers the captured metadata: a different name is a different
		// definition, so a replayed placement refuses instead of renaming silently.
		const renamed = await creatorModelDefinition(entry.resource, 'Stool');
		expect(renamed!.metadataContentId).not.toBe(definition!.metadataContentId);
		// And it is stable for the same facts.
		const again = await creatorModelDefinition(entry.resource, 'Chair');
		expect(again!.metadataContentId).toBe(definition!.metadataContentId);
	});

	it('adds the resource and lock together, and refuses a duplicate or a broken pin', async () => {
		const source = await envelope();
		const entry = creatorModelResourceEntry(MODEL_ID, approval())!;
		const once = withCreatorModelResource(source, entry);
		expect(once).not.toBeNull();
		expect(once!.units.resources.data.resources.map((resource) => resource.id)).toEqual([MODEL_ID]);
		expect(once!.dependencyLock.entries.filter((lock) => lock.subjectId === MODEL_ID)).toHaveLength(1);
		// The original envelope is untouched: the caller installs the candidate.
		expect(source.units.resources.data.resources.some((resource) => resource.id === MODEL_ID)).toBe(false);
		// A second introduction of the same id refuses rather than silently de-duping.
		expect(withCreatorModelResource(once!, entry)).toBeNull();
	});
});
