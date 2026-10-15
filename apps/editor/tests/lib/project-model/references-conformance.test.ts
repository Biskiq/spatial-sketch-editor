/**
 * F.1 `references-v1` conformance — the T1.P01.S01 provider for `F1.reference@1`.
 *
 * AM-1's required conformance set: non-zero floor qualification, root Scene,
 * stable instance-path round trips, generation invalidation,
 * missing/unauthorized/unsupported resolution and refusal of nearest/name repair
 * — plus the S01 acceptance rows: supported and unsupported kind, revision and
 * required-extension fixtures.
 *
 * The fixtures register test-only domain resolvers. That is the boundary AM-1
 * draws for this gate: the provider proves the common interface, the resolver
 * host and the admission rules, not every future domain resolver. Layout, Scene
 * and read-only Camera subject resolution attaches later, owned by its own
 * authority. Runtime-safe import closure is proved by
 * `tests/lib/project-model-boundary.test.ts` (arch lane), which walks every
 * source file in this package.
 */
import { describe, expect, it } from 'vitest';

import {
	CURRENT_CAMERA_SUBJECT_KINDS,
	CURRENT_LAYOUT_SUBJECT_KINDS,
	CURRENT_SCENE_SUBJECT_KINDS,
	compareReferences,
	createCurrentDomainReadAdapters,
	createCurrentDomainResolverHost,
	createEmptyWallFirstProject,
	createReferenceResolverHost,
	matchesGeneration,
	resolveDerivedSourceRef,
	resolveFrame,
	resolveReference,
	validateAcceptedRevision,
	validateDerivedSourceRef,
	validateFrameReference,
	validateSemanticReference,
	validateSnapshotIdentity,
	type DependencyLockReader,
	type FrameResolver,
	type ProjectDocument,
	type ReferenceReadContext,
	type ReferenceResolver,
	type SemanticReference,
	type SnapshotIdentity
} from '@portfolio/project-model';

const SNAPSHOT: SnapshotIdentity = {
	acceptedRevision: { projectId: 'project-1', revisionId: 'revision-7' },
	sourceContentId: 'sha256-source-7'
};

type Entity = { kind: string; id: string; label: string; revision: string };

/** A test-only Layout resolver: look subjects up by canonical kind and id. */
function layoutResolver(entities: readonly Entity[], seen: { contentRevision: string | null }): ReferenceResolver {
	return {
		id: 'fixture.layout@1',
		domain: 'layout',
		subjectKinds: ['wall', 'opening', 'floor'],
		owner: 'layout',
		resolve(reference, request) {
			seen.contentRevision = request.contentRevision;
			const found = entities.find(
				(entity) => entity.kind === reference.subject.kind && entity.id === reference.subject.id
			);
			if (found === undefined) {
				return { kind: 'missing', message: `no ${reference.subject.kind} "${reference.subject.id}"` };
			}
			return { kind: 'resolved', contentRevision: found.revision };
		}
	};
}

const ENTITIES: readonly Entity[] = [
	{ kind: 'wall', id: 'wall-1', label: 'perimeter-wall', revision: 'sha256-source-7' },
	// wall-2 *displays* "wall-1": a name collision that identity must survive.
	{ kind: 'wall', id: 'wall-2', label: 'wall-1', revision: 'sha256-source-7' },
	{ kind: 'floor', id: 'floor-2', label: 'First floor', revision: 'sha256-source-7' }
];

function context(overrides: Partial<ReferenceReadContext> = {}): ReferenceReadContext {
	const seen = { contentRevision: null as string | null };
	return {
		snapshot: SNAPSHOT,
		sessionEpoch: 'session-1',
		generationId: 'generation-3',
		supportedExtensions: ['known-extension'],
		lock: null,
		resolvers: [layoutResolver(ENTITIES, seen)],
		frameResolvers: [],
		...overrides
	};
}

function layoutReference(overrides: Partial<SemanticReference> = {}): SemanticReference {
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: 'sha256-source-7' },
		subject: { kind: 'wall', id: 'wall-1' },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
		...overrides
	};
}

describe('F.1 references-v1 — strict validation', () => {
	it('accepts a root reference and preserves its identity exactly', () => {
		const reference = layoutReference();
		const result = validateSemanticReference(reference);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.value).toEqual(reference);
		expect(result.ignoredOptionalExtensions).toEqual([]);
	});

	it('round-trips a non-zero floor qualification with a structure-instance path', () => {
		// Non-zero floor qualification: an explicit level plus an ordered
		// structure-instance path, with no Level schema and no invented Room frame.
		const reference = layoutReference({
			subject: { kind: 'floor', id: 'floor-2' },
			location: { kind: 'layout-location', levelId: 'level-2', structureInstancePath: ['wing-a', 'instance-7'] },
			componentId: 'slab-top',
			capabilityId: null
		});
		const first = validateSemanticReference(JSON.parse(JSON.stringify(reference)));
		expect(first.success).toBe(true);
		if (!first.success) return;
		expect(first.value).toEqual(reference);
		expect(first.value.location).toEqual({
			kind: 'layout-location',
			levelId: 'level-2',
			structureInstancePath: ['wing-a', 'instance-7']
		});

		// Distinct paths stay distinct: a path is identity, never a decoration.
		const other = validateSemanticReference(
			layoutReference({
				location: { kind: 'layout-location', levelId: 'level-2', structureInstancePath: ['instance-7', 'wing-a'] }
			})
		);
		expect(other.success).toBe(true);
		if (!other.success) return;
		expect(other.value.location).not.toEqual(first.value.location);
	});

	it('treats an empty instance path and project root as the root subject', () => {
		const root = validateSemanticReference(
			layoutReference({ domain: 'scene', subject: { kind: 'root', id: 'world' }, instancePath: [] })
		);
		expect(root.success).toBe(true);
		if (!root.success) return;
		expect(root.value.instancePath).toEqual([]);
		expect(root.value.location).toEqual({ kind: 'project-root' });
		expect(root.value.componentId).toBeNull();
		expect(root.value.capabilityId).toBeNull();
	});

	it('rejects unknown keys, an unsupported version, empty identities and a malformed path', () => {
		expect(validateSemanticReference({ ...layoutReference(), label: 'Wall A' }).success).toBe(false);
		expect(validateSemanticReference({ ...layoutReference(), version: 2 }).success).toBe(false);
		expect(validateSemanticReference(layoutReference({ subject: { kind: 'wall', id: '' } })).success).toBe(false);
		expect(validateSemanticReference(layoutReference({ subject: { kind: 'wall', id: 'a b' } })).success).toBe(false);
		expect(validateSemanticReference(layoutReference({ instancePath: [1] as never })).success).toBe(false);
		expect(validateSemanticReference(layoutReference({ domain: 'museum' as never })).success).toBe(false);
		expect(
			validateSemanticReference(layoutReference({ location: { kind: 'room', id: 'room-1' } as never })).success
		).toBe(false);
		// A tagged revision carries exactly its own fields, never both.
		expect(
			validateSemanticReference(
				layoutReference({ revision: { kind: 'exact', contentRevision: 'sha256-source-7', projectId: 'p' } as never })
			).success
		).toBe(false);
	});

	it('rejects an unsupported required extension and ignores an unsupported optional one', () => {
		const required = validateSemanticReference(
			layoutReference({ extensions: [{ id: 'future-extension', required: true }] }),
			{ supportedExtensions: ['known-extension'] }
		);
		expect(required.success).toBe(false);
		if (required.success) return;
		expect(required.issues.map((issue) => issue.code)).toContain('unsupported-extension');

		const optional = validateSemanticReference(
			layoutReference({ extensions: [{ id: 'future-extension', required: false }] }),
			{ supportedExtensions: ['known-extension'] }
		);
		expect(optional.success).toBe(true);
		if (!optional.success) return;
		expect(optional.ignoredOptionalExtensions).toEqual(['future-extension']);
		expect(
			validateSemanticReference(layoutReference({ extensions: [{ id: 'x', required: true }, { id: 'x', required: true }] })).success
		).toBe(false);
	});

	it('validates the snapshot identity and accepted revision separately from the reference', () => {
		expect(validateSnapshotIdentity(SNAPSHOT).success).toBe(true);
		expect(validateAcceptedRevision({ projectId: 'p', revisionId: 'r' }).success).toBe(true);
		expect(validateSnapshotIdentity({ ...SNAPSHOT, sessionEpoch: 'session-1' }).success).toBe(false);
		expect(validateAcceptedRevision({ projectId: 'p' }).success).toBe(false);
		expect(validateAcceptedRevision({ projectId: 'p', revisionId: 'r', version: 3 }).success).toBe(false);
	});
});

describe('F.1 references-v1 — typed resolution', () => {
	it('resolves to a canonical subject with its concrete revision and owner', () => {
		const result = resolveReference(layoutReference(), context());
		expect(result.kind).toBe('resolved');
		if (result.kind !== 'resolved') return;
		expect(result.subject).toEqual({
			domain: 'layout',
			subject: { kind: 'wall', id: 'wall-1' },
			instancePath: [],
			componentId: null,
			capabilityId: null,
			contentRevision: 'sha256-source-7',
			owner: 'layout'
		});
		expect(result.reference).toEqual(layoutReference());
	});

	it('returns typed failures and never repairs as a read effect', () => {
		const missing = resolveReference(layoutReference({ subject: { kind: 'wall', id: 'wall-404' } }), context());
		expect(missing.kind).toBe('failed');
		if (missing.kind !== 'failed') return;
		expect(missing.code).toBe('missing');
		expect(missing.repairs.length).toBeGreaterThan(0);
		expect(missing.reference.subject.id).toBe('wall-404');

		const unauthorized: ReferenceResolver = {
			...layoutResolver(ENTITIES, { contentRevision: null }),
			resolve: () => ({ kind: 'unauthorized', message: 'the reader is not authorized for this subject' })
		};
		const denied = resolveReference(layoutReference(), context({ resolvers: [unauthorized] }));
		expect(denied.kind === 'failed' && denied.code).toBe('unauthorized');
	});

	it('refuses a display label as identity and offers no nearest or name repair', () => {
		const seen = { contentRevision: null as string | null };
		const resolvers = [layoutResolver(ENTITIES, seen)];
		// "perimeter-wall" is wall-1's display label: a valid opaque string that is
		// still not identity, so it resolves missing rather than to wall-1.
		const byLabel = resolveReference(layoutReference({ subject: { kind: 'wall', id: 'perimeter-wall' } }), context({ resolvers }));
		expect(byLabel.kind).toBe('failed');
		if (byLabel.kind !== 'failed') return;
		expect(byLabel.code).toBe('missing');

		// The id "wall-1" is wall-1's identity even though wall-2 displays that name.
		const byId = resolveReference(layoutReference({ subject: { kind: 'wall', id: 'wall-1' } }), context({ resolvers }));
		expect(byId.kind).toBe('resolved');
		if (byId.kind !== 'resolved') return;
		expect(byId.subject.subject.id).toBe('wall-1');

		const byProximity = resolveReference(layoutReference({ subject: { kind: 'wall', id: 'wall-3' } }), context({ resolvers }));
		expect(byProximity.kind === 'failed' && byProximity.code).toBe('missing');
	});

	it('treats an unsupported domain and an unsupported subject kind as incompatible', () => {
		const experience = resolveReference(layoutReference({ domain: 'experience' }), context());
		expect(experience.kind === 'failed' && experience.code).toBe('incompatible');

		const resource = resolveReference(layoutReference({ domain: 'resource:audio' }), context());
		expect(resource.kind === 'failed' && resource.code).toBe('incompatible');

		const undeclaredKind = resolveReference(layoutReference({ subject: { kind: 'light', id: 'light-1' } }), context());
		expect(undeclaredKind.kind).toBe('failed');
		if (undeclaredKind.kind !== 'failed') return;
		expect(undeclaredKind.code).toBe('incompatible');
		expect(undeclaredKind.message).toContain('light');
	});

	it('refuses project-lock resolution without an admitted lock reader and manufactures no lock', () => {
		const locked = layoutReference({ revision: { kind: 'project-lock', projectId: 'project-1' } });
		const withoutLock = resolveReference(locked, context());
		expect(withoutLock.kind === 'failed' && withoutLock.code).toBe('incompatible');
		if (withoutLock.kind !== 'failed') return;
		expect(withoutLock.message).toContain('dependency-lock');

		const seen = { contentRevision: null as string | null };
		const lock: DependencyLockReader = { projectId: 'project-1', contentRevisionFor: () => 'sha256-source-7' };
		const admitted = resolveReference(locked, context({ lock, resolvers: [layoutResolver(ENTITIES, seen)] }));
		expect(admitted.kind).toBe('resolved');
		expect(seen.contentRevision).toBe('sha256-source-7');

		const wrongProject = resolveReference(
			locked,
			context({ lock: { projectId: 'project-2', contentRevisionFor: () => 'sha256-other' } })
		);
		expect(wrongProject.kind === 'failed' && wrongProject.code).toBe('incompatible');

		const absentEntry = resolveReference(
			locked,
			context({ lock: { projectId: 'project-1', contentRevisionFor: () => null } })
		);
		expect(absentEntry.kind === 'failed' && absentEntry.code).toBe('missing');
	});

	it('reports a duplicated authority instead of shadowing one resolver', () => {
		const seen = { contentRevision: null as string | null };
		const host = createReferenceResolverHost(
			[layoutResolver(ENTITIES, seen), layoutResolver(ENTITIES, seen)],
			[]
		);
		expect(host.problems.join('\n')).toContain('two resolvers are registered for domain "layout"');
		expect(createReferenceResolverHost([layoutResolver(ENTITIES, seen)], []).problems).toEqual([]);
	});
});

describe('F.1 references-v1 — generation-qualified correspondence', () => {
	it('resolves a fragment of the active generation and stores the canonical source', () => {
		const fragment = {
			source: layoutReference({ subject: { kind: 'wall', id: 'wall-1' } }),
			generationId: 'generation-3',
			stream: 'cut',
			subRef: { kind: 'interval', start: 0.25, end: 0.75 }
		};
		const result = resolveDerivedSourceRef(fragment, context());
		expect(result.kind).toBe('resolved');
		if (result.kind !== 'resolved') return;
		// Selection stores the canonical source, never the fragment identity.
		expect(result.source.subject.id).toBe('wall-1');
		expect(result.fragment.subRef).toEqual({ kind: 'interval', start: 0.25, end: 0.75 });
	});

	it('invalidates every fragment of a superseded generation', () => {
		const fragment = {
			source: layoutReference(),
			generationId: 'generation-2',
			stream: 'cut',
			subRef: null
		};
		const stale = resolveDerivedSourceRef(fragment, context({ generationId: 'generation-3' }));
		expect(stale.kind).toBe('failed');
		if (stale.kind !== 'failed') return;
		expect(stale.code).toBe('stale-generation');
		expect(stale.repairs.length).toBeGreaterThan(0);

		// With no active generation nothing is current, and generation is required.
		expect(resolveDerivedSourceRef(fragment, context({ generationId: null })).kind).toBe('failed');
		expect(matchesGeneration(fragment, 'generation-2')).toBe(true);
		expect(matchesGeneration(fragment, 'generation-3')).toBe(false);
		expect(matchesGeneration(fragment, null)).toBe(false);
	});

	it('rejects a fragment without generation qualification or with a malformed sub-reference', () => {
		const source = layoutReference();
		expect(validateDerivedSourceRef({ source, stream: 'cut', subRef: null }).success).toBe(false);
		expect(
			validateDerivedSourceRef({ source, generationId: 'g-1', stream: 'cut', subRef: { kind: 'interval', start: 2, end: 1 } })
				.success
		).toBe(false);
		expect(
			validateDerivedSourceRef({ source, generationId: 'g-1', stream: 'cut', subRef: null, selected: true }).success
		).toBe(false);
		expect(
			validateDerivedSourceRef({
				source,
				generationId: 'g-1',
				stream: 'cut',
				subRef: { kind: 'component', componentId: 'slab-top' }
			}).success
		).toBe(true);
	});
});

describe('F.1 references-v1 — frame qualification', () => {
	const worldFrame = { version: 1, kind: 'project-world' } as const;

	it('resolves the project-world frame to the project origin datum', () => {
		const result = resolveFrame(worldFrame, context());
		expect(result.kind).toBe('resolved');
		if (result.kind !== 'resolved') return;
		expect(result.placement).toEqual({ originMeters: [0, 0, 0], yawRadians: 0, datumMeters: 0 });
	});

	it('refuses an owner-qualified frame whose owner admits no resolver', () => {
		const frame = { version: 1, kind: 'owner-frame', owner: 'layout', frameId: 'floor-2-frame', revision: 'r1' } as const;
		const result = resolveFrame(frame, context());
		expect(result.kind === 'failed' && result.code).toBe('incompatible');

		const layoutFrames: FrameResolver = {
			id: 'fixture.layout-frames@1',
			owner: 'layout',
			resolve: () => ({ kind: 'missing', message: 'the floor carries no authored frame' })
		};
		// A Room or floor without an authored frame cannot qualify, and the shared
		// layer invents no centroid, nearest Room or containment frame.
		expect(resolveFrame(frame, context({ frameResolvers: [layoutFrames] })).kind === 'failed').toBe(true);

		const authored: FrameResolver = {
			id: 'fixture.layout-authored@1',
			owner: 'layout',
			resolve: () => ({ kind: 'resolved', placement: { originMeters: [1, 2, 3], yawRadians: Math.PI / 2, datumMeters: 2 } })
		};
		const resolved = resolveFrame(frame, context({ frameResolvers: [authored] }));
		expect(resolved.kind).toBe('resolved');
		if (resolved.kind !== 'resolved') return;
		expect(resolved.placement.originMeters).toEqual([1, 2, 3]);
		expect(resolved.placement.datumMeters).toBe(2);

		const nonFinite: FrameResolver = {
			id: 'fixture.layout-non-finite@1',
			owner: 'layout',
			resolve: () => ({
				kind: 'resolved',
				placement: { originMeters: [0, Number.NaN, 0], yawRadians: 0, datumMeters: null }
			})
		};
		expect(resolveFrame(frame, context({ frameResolvers: [nonFinite] })).kind === 'failed').toBe(true);
	});

	it('rejects a frame reference with unknown keys or an owner outside the domain vocabulary', () => {
		expect(validateFrameReference(worldFrame).success).toBe(true);
		expect(validateFrameReference({ ...worldFrame, datum: 2 }).success).toBe(false);
		expect(
			validateFrameReference({ version: 1, kind: 'owner-frame', owner: 'museum', frameId: 'f', revision: 'r' }).success
		).toBe(false);
		expect(validateFrameReference({ version: 1, kind: 'owner-frame', owner: 'layout', frameId: 'f' }).success).toBe(false);
	});
});

describe('F.1 references-v1 — stable ID ordering', () => {
	it('orders by stable identity, never by display label or construction order', () => {
		const first = layoutReference({ subject: { kind: 'wall', id: 'wall-1' } });
		const second = layoutReference({ subject: { kind: 'wall', id: 'wall-2' } });
		expect(compareReferences(first, first)).toBe(0);
		expect(compareReferences(first, second)).toBeLessThan(0);
		expect(compareReferences(second, first)).toBeGreaterThan(0);
		// Instance-path position is identity: a longer path sorts after its prefix.
		const nested = layoutReference({ subject: { kind: 'wall', id: 'wall-1' }, instancePath: ['instance-7'] });
		expect(compareReferences(first, nested)).toBeLessThan(0);
	});
});

/**
 * A genuinely current document: the canonical new-project boot, then a small authored
 * world. It is built from the package's own boot value rather than a hand-written payload,
 * so the Layout floor ID, the Scene root and the entity collections are the real ones.
 */
function currentDocument(): ProjectDocument {
	const project = createEmptyWallFirstProject({ id: 'project-1', name: 'Fixture' });
	project.layout.floor = { id: 'floor-2', name: 'First floor', elevation: 3 };
	project.layout.junctions = [
		{ id: 'junction-1', point: [0, 0] },
		{ id: 'junction-2', point: [5, 0] }
	];
	project.layout.walls = [
		{
			id: 'wall-1',
			startJunctionId: 'junction-1',
			endJunctionId: 'junction-2',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' },
			name: 'perimeter-wall'
		},
		// wall-2 *displays* "wall-1": identity is the id, never the authored name.
		{
			id: 'wall-2',
			startJunctionId: 'junction-2',
			endJunctionId: 'junction-1',
			role: 'partition',
			thickness: 0.1,
			height: 3,
			centerline: { kind: 'line' },
			name: 'wall-1'
		}
	];
	project.layout.rooms = [{ id: 'room-1', name: 'Room', boundary: [], floorThickness: 0.1, ceilingThickness: 0.1 }];
	project.layout.openings = [
		{
			id: 'opening-1',
			wallId: 'wall-1',
			kind: 'door',
			offset: 1,
			width: 0.9,
			height: 2.1,
			sillHeight: 0,
			profile: 'rectangular'
		}
	];
	project.layout.objects = [
		{ id: 'object-1', kind: 'box', position: [1, 2, 3], rotation: [0, 0, 0], dimensions: [1, 1, 1] }
	];
	project.scene.clusters = [{ id: 'cluster-1', name: 'Cluster', memberIds: ['entity-2'] }];
	project.scene.entities = [
		{ id: 'entity-1', name: 'Free', position: [0, 0, 0], rotation: [0, 0, 0], kind: 'model', assetId: 'piano', fallback: 'piano' },
		{ id: 'entity-2', name: 'Clustered', position: [1, 0, 0], rotation: [0, 0, 0], kind: 'model', assetId: 'chair', fallback: 'chair' }
	];
	project.scene.materials = [{ id: 'material-1', name: 'Plaster', baseMaterialId: 'plaster-warm' }];
	project.scene.textures = [{ id: 'texture-1', name: 'Paper', uri: 'paper.png' }];
	project.scene.navigationNodes = [
		{ id: 'node-1', label: 'Entry', position: [0, 0, 0], cameraTarget: [0, 0, 1], fov: 54, connectedNodeIds: ['node-2'] }
	];
	project.scene.connections = [
		{
			id: 'connection-1',
			fromNodeId: 'node-1',
			toNodeId: 'node-2',
			positionPath: { kind: 'auto-bezier', anchors: [] },
			clearance: 0.5
		}
	];
	return project;
}

/** The read context for one supplied document, built from its own bounded adapters. */
function currentContext(document: ProjectDocument, overrides: Partial<ReferenceReadContext> = {}): ReferenceReadContext {
	const host = createCurrentDomainResolverHost(document);
	return {
		snapshot: SNAPSHOT,
		sessionEpoch: 'session-1',
		generationId: 'generation-3',
		supportedExtensions: [],
		lock: null,
		resolvers: host.resolvers,
		frameResolvers: host.frameResolvers,
		...overrides
	};
}

describe('F.1 references-v1 — bounded current-domain read adapters', () => {
	const document = currentDocument();
	const read = currentContext(document);

	it('admits actual Layout, Scene and read-only Camera subjects from one supplied source', () => {
		const host = createCurrentDomainResolverHost(document);
		expect(host.problems).toEqual([]);
		expect(host.resolvers.map((resolver) => resolver.domain)).toEqual(['layout', 'scene', 'camera']);
		expect(host.resolvers.map((resolver) => [...resolver.subjectKinds])).toEqual([
			[...CURRENT_LAYOUT_SUBJECT_KINDS],
			[...CURRENT_SCENE_SUBJECT_KINDS],
			[...CURRENT_CAMERA_SUBJECT_KINDS]
		]);
		// Experience and typed resources have no current provider: no resolver is registered, and
		// the shared layer reports exactly that instead of a fabricated resolved subject.
		expect(createCurrentDomainReadAdapters(document).resolvers.map((resolver) => resolver.domain)).not.toContain('experience');
	});

	it('resolves every actual Layout entity by its stable id and records the concrete revision', () => {
		const cases: Array<[string, string]> = [
			['level', 'floor-2'],
			['wall', 'wall-1'],
			['wall', 'wall-2'],
			['room', 'room-1'],
			['opening', 'opening-1'],
			['junction', 'junction-1'],
			['object', 'object-1']
		];
		for (const [kind, id] of cases) {
			const result = resolveReference(
				layoutReference({
					subject: { kind, id },
					location: kind === 'wall' ? { kind: 'layout-location', levelId: 'floor-2', structureInstancePath: [] } : { kind: 'project-root' }
				}),
				read
			);
			expect(result.kind, `${kind} "${id}"`).toBe('resolved');
			if (result.kind !== 'resolved') continue;
			expect(result.subject.contentRevision).toBe('sha256-source-7');
			expect(result.subject.owner).toBe('layout');
			expect(result.subject.subject).toEqual({ kind, id });
		}
	});

	it('resolves actual Scene entities, the Scene root and the read-only Camera subjects', () => {
		const sceneRoot = resolveReference(
			layoutReference({ domain: 'scene', subject: { kind: 'scene', id: 'project-1' } }),
			read
		);
		expect(sceneRoot.kind).toBe('resolved');
		if (sceneRoot.kind !== 'resolved') return;
		expect(sceneRoot.subject.owner).toBe('scene');

		expect(
			resolveReference(layoutReference({ domain: 'scene', subject: { kind: 'entity', id: 'entity-1' } }), read).kind
		).toBe('resolved');
		expect(
			resolveReference(layoutReference({ domain: 'scene', subject: { kind: 'material', id: 'material-1' } }), read).kind
		).toBe('resolved');
		expect(
			resolveReference(layoutReference({ domain: 'scene', subject: { kind: 'texture', id: 'texture-1' } }), read).kind
		).toBe('resolved');
		expect(
			resolveReference(layoutReference({ domain: 'camera', subject: { kind: 'navigation-node', id: 'node-1' } }), read).kind
		).toBe('resolved');
		const connection = resolveReference(
			layoutReference({ domain: 'camera', subject: { kind: 'connection', id: 'connection-1' } }),
			read
		);
		expect(connection.kind).toBe('resolved');
		if (connection.kind !== 'resolved') return;
		expect(connection.subject.owner).toBe('camera');
	});

	it('treats a clustered entity as its cluster path, and refuses the wrong path', () => {
		// entity-2 is a cluster member: its canonical path is the cluster, so the bare path is
		// not a second identity for the same subject.
		const bare = resolveReference(layoutReference({ domain: 'scene', subject: { kind: 'entity', id: 'entity-2' } }), read);
		expect(bare.kind === 'failed' && bare.code).toBe('missing');
		const path = resolveReference(
			layoutReference({ domain: 'scene', subject: { kind: 'entity', id: 'entity-2' }, instancePath: ['cluster-1'] }),
			read
		);
		expect(path.kind).toBe('resolved');
		if (path.kind !== 'resolved') return;
		expect(path.subject.instancePath).toEqual(['cluster-1']);
		// A cluster that does not contain the entity, and a deeper path, are refusals.
		expect(
			resolveReference(
				layoutReference({ domain: 'scene', subject: { kind: 'entity', id: 'entity-1' }, instancePath: ['cluster-1'] }),
				read
			).kind
		).toBe('failed');
		expect(
			resolveReference(
				layoutReference({ domain: 'scene', subject: { kind: 'entity', id: 'entity-2' }, instancePath: ['cluster-1', 'cluster-1'] }),
				read
			).kind
		).toBe('failed');
	});

	it('refuses an id the source does not author and never resolves by name or label', () => {
		const unknown = resolveReference(layoutReference({ subject: { kind: 'wall', id: 'wall-9' } }), read);
		expect(unknown.kind).toBe('failed');
		if (unknown.kind !== 'failed') return;
		expect(unknown.code).toBe('missing');
		expect(unknown.repairs.length).toBeGreaterThan(0);
		// wall-2 is *named* "wall-1": a name is not identity, so asking for the name is missing.
		const byName = resolveReference(layoutReference({ subject: { kind: 'wall', id: 'perimeter-wall' } }), read);
		expect(byName.kind === 'failed' && byName.code).toBe('missing');
		// A level the source does not author is a missing subject, not a second level.
		const kind = resolveReference(layoutReference({ subject: { kind: 'level', id: 'floor-1' } }), read);
		expect(kind.kind === 'failed' && kind.code).toBe('missing');
		// A subject kind no current adapter resolves is unsupported, not missing.
		const unsupportedKind = resolveReference(layoutReference({ subject: { kind: 'placed-structure', id: 's-1' } }), read);
		expect(unsupportedKind.kind === 'failed' && unsupportedKind.code).toBe('incompatible');
	});

	it('qualifies the one authored level and invents no structure or level schema', () => {
		// The current floor ID is the level qualification; another level is missing.
		const otherLevel = resolveReference(
			layoutReference({ location: { kind: 'layout-location', levelId: 'floor-1', structureInstancePath: [] } }),
			read
		);
		expect(otherLevel.kind === 'failed' && otherLevel.code).toBe('missing');
		const structure = resolveReference(
			layoutReference({ location: { kind: 'layout-location', levelId: 'floor-2', structureInstancePath: ['structure-1'] } }),
			read
		);
		expect(structure.kind === 'failed' && structure.code).toBe('missing');
		// A Scene subject cannot carry a Layout location qualification.
		const misplaced = resolveReference(
			layoutReference({
				domain: 'scene',
				subject: { kind: 'entity', id: 'entity-1' },
				location: { kind: 'layout-location', levelId: 'floor-2', structureInstancePath: [] }
			}),
			read
		);
		expect(misplaced.kind === 'failed' && misplaced.code).toBe('missing');
	});

	it('leaves Experience and typed resources explicitly unresolved', () => {
		const experience = resolveReference(layoutReference({ domain: 'experience', subject: { kind: 'tour', id: 'tour-1' } }), read);
		expect(experience.kind === 'failed' && experience.code).toBe('incompatible');
		const resource = resolveReference(
			layoutReference({ domain: 'resource:audio', subject: { kind: 'audio', id: 'audio-1' } }),
			read
		);
		expect(resource.kind === 'failed' && resource.code).toBe('incompatible');
	});

	it('refuses an owner-qualified frame because the current source authors none', () => {
		const frame = { version: 1, kind: 'owner-frame', owner: 'layout', frameId: 'floor-2-frame', revision: 'r1' } as const;
		const result = resolveFrame(frame, read);
		expect(result.kind).toBe('failed');
		if (result.kind !== 'failed') return;
		// A Room without an authored frame is not a frame: no centroid or containment invents one.
		expect(result.code).toBe('missing');
		expect(result.repairs.length).toBeGreaterThan(0);
	});
});
