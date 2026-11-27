/**
 * The shipped-asset grant rule (D8a §4.1).
 *
 * A catalogue model's first placement adds the asset resource and its exact
 * `resource:asset` lock in the same accepted result. A matching held record is
 * reused unchanged; any other record refuses `incompatible-resource` and is left
 * byte-identical. The grant never resolves, rewrites or upgrades a held record.
 */
import { describe, expect, it } from 'vitest';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core/wall';
import {
	grantShippedAssetResources,
	shippedAssetLockEntry,
	shippedModelResourceEntry,
} from '@portfolio/project-model/scene-planning';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	createProjectEnvelope,
	serializeProjectEnvelope,
	type DependencyLockEntry,
	type ProjectEnvelope,
	type TypedResource,
	type UnresolvedBinding,
} from '@portfolio/project-model/units';

const ASSET_ID = 'paris-salon-chair';
const OTHER_REVISION = `sha256-${'0'.repeat(64)}`;

async function envelope(
	options: {
		resources?: readonly TypedResource[];
		lockEntries?: readonly DependencyLockEntry[];
	} = {},
): Promise<ProjectEnvelope> {
	return createProjectEnvelope({
		id: 'project-d8a',
		name: 'D8a grant project',
		acceptedRevision: { projectId: 'project-d8a', revisionId: 'revision-1' },
		dependencyLock: { formatVersion: 1, entries: options.lockEntries ?? [] },
		layout: { unitId: 'unit-layout', data: createEmptyWallFirstLayoutDocument() },
		scene: {
			unitId: 'unit-scene',
			data: {
				formatVersion: SCENE_UNIT_FORMAT_VERSION,
				textures: [],
				materials: [],
				entities: [],
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
			data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: options.resources ?? [] },
		},
	});
}

function assetResource(
	contentRevision: string | null,
	unresolved: UnresolvedBinding | null = null,
): TypedResource {
	return { kind: 'asset', id: ASSET_ID, contentRevision, pin: null, unresolved };
}

function assetLock(contentRevision: string): DependencyLockEntry {
	return {
		domain: 'resource:asset',
		subjectKind: 'resource',
		subjectId: ASSET_ID,
		instancePath: [],
		contentRevision,
		requiredCapabilities: [],
		pin: null,
	};
}

const UNRESOLVED: UnresolvedBinding = {
	reference: {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision: OTHER_REVISION },
		subject: { kind: 'entity', id: 'entity-1' },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
	},
	domain: 'scene',
	status: 'missing',
	message: 'The asset bytes are not available',
};

function refusal(result: ReturnType<typeof grantShippedAssetResources>): string | null {
	return result.kind === 'refused' ? result.diagnostics.join('|') : null;
}

describe('shipped asset resource entry', () => {
	it('pins the production bytes and creates the exact resource:asset lock', () => {
		const entry = shippedModelResourceEntry(ASSET_ID);
		expect(entry).not.toBeNull();
		expect(entry!.resource).toEqual({
			kind: 'asset',
			id: ASSET_ID,
			contentRevision: 'sha256-480698dafa0c4d17960db4d218e7db462a327ea86a8e7d22a8f49fb25ab6ff9e',
			pin: null,
			unresolved: null,
		});
		expect(entry!.lock).toEqual({
			domain: 'resource:asset',
			subjectKind: 'resource',
			subjectId: ASSET_ID,
			instancePath: [],
			contentRevision: 'sha256-480698dafa0c4d17960db4d218e7db462a327ea86a8e7d22a8f49fb25ab6ff9e',
			requiredCapabilities: [],
			pin: null,
		});
	});

	it('refuses a fallback-only placeholder and an unknown id', () => {
		expect(shippedModelResourceEntry('paris-writing-desk')).toBeNull();
		expect(shippedModelResourceEntry('not-a-shipped-model')).toBeNull();
		expect(() => shippedAssetLockEntry(assetResource(null))).toThrow();
	});
});

describe('shipped asset grant rule', () => {
	it('adds the resource and its lock when the project holds neither', async () => {
		const before = await envelope();
		const granted = grantShippedAssetResources(before, [ASSET_ID]);
		expect(granted.kind).toBe('granted');
		if (granted.kind !== 'granted') return;
		expect(granted.addedResources.map((resource) => resource.id)).toEqual([ASSET_ID]);
		expect(granted.addedLocks).toHaveLength(1);
		expect(granted.envelope.units.resources.data.resources).toHaveLength(1);
		expect(granted.envelope.dependencyLock.entries).toHaveLength(1);
	});

	it('reuses a matching resolved resource and adds only the missing lock', async () => {
		const entry = shippedModelResourceEntry(ASSET_ID)!;
		const held = entry.resource;
		const before = await envelope({ resources: [held] });
		const granted = grantShippedAssetResources(before, [ASSET_ID]);
		expect(granted.kind).toBe('granted');
		if (granted.kind !== 'granted') return;
		expect(granted.addedResources).toEqual([]);
		expect(granted.addedLocks).toHaveLength(1);
		expect(granted.envelope.units.resources.data.resources[0]).toEqual(held);
	});

	it('is idempotent when the resource and lock already match', async () => {
		const entry = shippedModelResourceEntry(ASSET_ID)!;
		const before = await envelope({ resources: [entry.resource], lockEntries: [entry.lock] });
		const granted = grantShippedAssetResources(before, [ASSET_ID]);
		expect(granted.kind).toBe('granted');
		if (granted.kind !== 'granted') return;
		expect(granted.envelope).toBe(before);
		expect(granted.addedResources).toEqual([]);
		expect(granted.addedLocks).toEqual([]);
	});

	it('refuses a held resource at another revision and leaves the envelope byte-identical', async () => {
		const before = await envelope({ resources: [assetResource(OTHER_REVISION)] });
		const serialized = serializeProjectEnvelope(before);
		const granted = grantShippedAssetResources(before, [ASSET_ID]);
		expect(refusal(granted)).toBe(`${ASSET_ID}|revision-differs`);
		expect(serializeProjectEnvelope(before)).toBe(serialized);
		expect(before.units.resources.data.resources[0]!.contentRevision).toBe(OTHER_REVISION);
	});

	/**
	 * A host admission refuses these records before a grant can see them; these
	 * cases hold the helper's defensive branches to "refuse, never resolve"
	 * without pretending the malformed payload is an admitted envelope.
	 */
	async function malformedEnvelope(resources: readonly TypedResource[]): Promise<ProjectEnvelope> {
		const base = await envelope();
		return {
			...base,
			units: {
				...base.units,
				resources: {
					...base.units.resources,
					data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources },
				},
			},
		};
	}

	it('refuses a held resource with no revision', async () => {
		const granted = grantShippedAssetResources(
			await malformedEnvelope([assetResource(null)]),
			[ASSET_ID],
		);
		expect(refusal(granted)).toBe(`${ASSET_ID}|no-content-revision`);
	});

	it('refuses an unresolved held resource instead of resolving it', async () => {
		const granted = grantShippedAssetResources(
			await malformedEnvelope([assetResource(null, UNRESOLVED)]),
			[ASSET_ID],
		);
		expect(refusal(granted)).toBe(`${ASSET_ID}|unresolved-resource`);
	});

	it('refuses when a lock pins another revision, even with no held resource', async () => {
		const before = await envelope({ lockEntries: [assetLock(OTHER_REVISION)] });
		const granted = grantShippedAssetResources(before, [ASSET_ID]);
		expect(refusal(granted)).toBe(`${ASSET_ID}|lock-pins-another-revision`);
		expect(granted.kind).toBe('refused');
	});

	it('reuses a matching orphan lock and adds only the resource', async () => {
		const entry = shippedModelResourceEntry(ASSET_ID)!;
		const before = await envelope({ lockEntries: [entry.lock] });
		const granted = grantShippedAssetResources(before, [ASSET_ID]);
		expect(granted.kind).toBe('granted');
		if (granted.kind !== 'granted') return;
		expect(granted.addedResources).toHaveLength(1);
		expect(granted.addedLocks).toEqual([]);
		expect(granted.envelope.dependencyLock.entries).toHaveLength(1);
	});

	it('grants one record per distinct asset id', async () => {
		const granted = grantShippedAssetResources(await envelope(), [ASSET_ID, ASSET_ID]);
		expect(granted.kind).toBe('granted');
		if (granted.kind !== 'granted') return;
		expect(granted.envelope.units.resources.data.resources).toHaveLength(1);
		expect(granted.envelope.dependencyLock.entries).toHaveLength(1);
	});

	it('is atomic across ids: a later refusal returns no partial grant', async () => {
		const before = await envelope({ resources: [assetResource(OTHER_REVISION)] });
		const serialized = serializeProjectEnvelope(before);
		const granted = grantShippedAssetResources(before, ['paris-salon-table', ASSET_ID]);
		expect(refusal(granted)).toBe(`${ASSET_ID}|revision-differs`);
		expect(serializeProjectEnvelope(before)).toBe(serialized);
	});
});
