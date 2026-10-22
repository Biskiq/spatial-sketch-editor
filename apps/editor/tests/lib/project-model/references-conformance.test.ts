/**
 * F.1 `references-v1` conformance — the T1.P01.S01 provider for `F1.reference@1`.
 *
 * AM-1's required conformance set: non-zero floor qualification, root Scene,
 * stable instance-path round trips, generation invalidation,
 * missing/unauthorized/unsupported resolution and refusal of nearest/name repair
 * — plus the S01 acceptance rows: supported and unsupported kind, revision and
 * required-extension fixtures.
 *
 * Two layers are covered. The common interface is proved with test-only domain
 * resolvers — AM-1 draws that boundary at the interface, the resolver host and
 * the admission rules, not every future domain resolver. On top of it, the
 * bounded current-domain read adapters are proved against a real project
 * document built from the package's own project boot, including their binding to
 * the one supplied snapshot, its acceptance identity and its content identity. Runtime-safe import
 * closure is proved by `tests/lib/project-model-boundary.test.ts` (arch lane),
 * which walks every source file in this package.
 */
import { describe, expect, it } from 'vitest';

import {
	compareReferences,
	createEmptyWallFirstLayoutDocument,
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
	type ReferenceReadContext,
	type ReferenceResolver,
	type SemanticReference,
	type SnapshotIdentity
} from '@portfolio/project-model';
import {
	SCENE_UNIT_FORMAT_VERSION,
	type LayoutUnitPayload
} from '@portfolio/project-model/units';
import { createUnitReadContext } from '@portfolio/project-model/references/unit-resolution';
import { createUnitProject } from '../authoring/__fixtures__/unit-envelope-fixtures';

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
			return { kind: 'resolved', contentRevision: found.revision, location: reference.location };
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
			location: { kind: 'project-root' },
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

	it('orders the complete identity, so two references are never equal unless they are the same', () => {
		// The revision context and the location qualification are identity too: ordering by
		// the subject alone would treat two distinct references as one, which is exactly what
		// a consumer sorting a selection or deduplicating by `compare === 0` must not get.
		const atOldContent = layoutReference({ revision: { kind: 'exact', contentRevision: 'sha256-source-6' } });
		const atHeldContent = layoutReference({ revision: { kind: 'exact', contentRevision: 'sha256-source-7' } });
		expect(compareReferences(atOldContent, atHeldContent)).toBeLessThan(0);
		expect(compareReferences(atHeldContent, atHeldContent)).toBe(0);
		// A project-lock reference is not the exact reference with the same subject.
		const locked = layoutReference({ revision: { kind: 'project-lock', projectId: 'project-1' } });
		expect(compareReferences(atHeldContent, locked)).not.toBe(0);

		const atLevel = layoutReference({
			location: { kind: 'layout-location', levelId: 'floor-1', structureInstancePath: [] }
		});
		const atOtherLevel = layoutReference({
			location: { kind: 'layout-location', levelId: 'floor-2', structureInstancePath: [] }
		});
		expect(compareReferences(atLevel, atOtherLevel)).toBeLessThan(0);
		// project-root and a layout location are different qualifications, not equal ones.
		expect(compareReferences(atLevel, layoutReference())).not.toBe(0);
		const nestedLevel = layoutReference({
			location: { kind: 'layout-location', levelId: 'floor-1', structureInstancePath: ['instance-1'] }
		});
		expect(compareReferences(atLevel, nestedLevel)).toBeLessThan(0);

		// A declared optional extension carries no payload and cannot change core identity, so
		// it is deliberately not an ordering key.
		const extended = layoutReference({ extensions: [{ id: 'x.optional@1', required: false }] });
		expect(compareReferences(extended, layoutReference())).toBe(0);
	});
});

/**
 * A real F.2 envelope: the four authored domains this suite addresses are built
 * through the provider's own writer, so the Layout floor ID, the Scene records
 * and the Camera/Experience subjects are the ones a live reader resolves.
 *
 * T3.P01.S04 retired the bounded current-domain read adapters with the current
 * source. The equivalent coverage now runs through the unit read context, whose
 * resolvers are the only live implementation over an admitted envelope.
 */
function unitLayout(): LayoutUnitPayload {
	const layout = createEmptyWallFirstLayoutDocument();
	layout.floor = { id: 'floor-2', name: 'First floor', elevation: 3 };
	layout.junctions = [
		{ id: 'junction-1', point: [0, 0] },
		{ id: 'junction-2', point: [5, 0] },
		{ id: 'junction-3', point: [5, 4] }
	];
	layout.walls = [
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
			endJunctionId: 'junction-3',
			role: 'partition',
			thickness: 0.1,
			height: 3,
			centerline: { kind: 'line' },
			name: 'wall-1'
		}
	];
	layout.rooms = [
		{
			id: 'room-1',
			name: 'Room',
			boundary: [{ wallId: 'wall-1', direction: 'forward' }],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}
	];
	layout.openings = [
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
	layout.objects = [
		{ id: 'object-1', kind: 'box', position: [1, 2, 3], rotation: [0, 0, 0], dimensions: [1, 1, 1] }
	];
	return layout;
}

const DOCUMENT = await createUnitProject({
	id: 'project-1',
	name: 'Fixture',
	acceptedRevision: SNAPSHOT.acceptedRevision,
	layout: unitLayout(),
	scene: {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [{ id: 'texture-1', name: 'Paper', uri: '/textures/paper.png' }],
		materials: [{ id: 'material-1', name: 'Plaster', baseMaterialId: 'plaster-warm' }],
		entities: [
			{ id: 'entity-1', name: 'Free', position: [0, 0, 0], rotation: [0, 0, 0], kind: 'model', assetId: 'piano', fallback: 'piano' },
			{ id: 'entity-2', name: 'Clustered', position: [1, 0, 0], rotation: [0, 0, 0], kind: 'model', assetId: 'chair', fallback: 'chair' },
			{ id: 'entity-3', name: 'Clustered too', position: [2, 0, 0], rotation: [0, 0, 0], kind: 'model', assetId: 'chair', fallback: 'chair' }
		],
		clusters: [{ id: 'cluster-1', name: 'Cluster', memberIds: ['entity-2', 'entity-3'] }]
	},
	camera: {
		formatVersion: 1,
		views: [
			{ id: 'node-1', label: 'Entry', eye: [0, 0, 0], target: [0, 0, 1], fov: 54, connectedViewIds: ['node-2'] },
			{ id: 'node-2', label: 'Hall', eye: [0, 0, 2], target: [0, 0, 3], fov: 54, connectedViewIds: ['node-1'] }
		],
		connections: [
			{
				id: 'connection-1',
				fromNodeId: 'node-1',
				toNodeId: 'node-2',
				positionPath: { kind: 'auto-bezier', anchors: [] },
				clearance: 0.5
			}
		]
	},
	experience: {
		formatVersion: 2,
		experiences: [
			{
				id: 'experience-1',
				label: 'Walk',
				entryGuideId: 'guide-1',
				presentations: [
					{
						id: 'presentation-1',
						label: 'Entry',
						viewIds: ['node-1'],
						defaultViewId: 'node-1',
						subject: null,
						text: null
					}
				],
				stops: [{ id: 'stop-1', presentationId: 'presentation-1', continuation: { kind: 'end' } }],
				guides: [{ id: 'guide-1', label: 'Main', stopIds: ['stop-1'], entryStopId: 'stop-1' }],
				gates: [],
				detours: []
			}
		]
	}
});

const UNIT_REVISION = {
	layout: DOCUMENT.units.layout.header.contentRevision,
	scene: DOCUMENT.units.scene.header.contentRevision,
	camera: DOCUMENT.units.camera.header.contentRevision,
	experience: DOCUMENT.units.experience.header.contentRevision
} as const;

/** A reference into the envelope, at the revision its owning unit holds. */
function currentReference(overrides: Partial<SemanticReference> = {}): SemanticReference {
	const domain = overrides.domain ?? 'layout';
	const revision =
		domain === 'layout' || domain === 'scene' || domain === 'camera' || domain === 'experience'
			? UNIT_REVISION[domain]
			: SNAPSHOT.sourceContentId;
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: revision },
		subject: { kind: 'wall', id: 'wall-1' },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
		...overrides,
		...(overrides.revision === undefined ? { revision: { kind: 'exact', contentRevision: revision } } : {})
	};
}

/** The one live unit-backed read context, bound to the envelope's snapshot. */
function currentContext(overrides: Partial<ReferenceReadContext> = {}): ReferenceReadContext {
	return {
		...createUnitReadContext({
			envelope: DOCUMENT,
			acceptedRevision: SNAPSHOT.acceptedRevision,
			sourceContentId: SNAPSHOT.sourceContentId,
			sessionEpoch: 'session-1',
			generationId: 'generation-3'
		}),
		...overrides
	};
}

describe('F.1 references-v1 — unit-backed read context', () => {
	const read = currentContext();

	it('admits the unit domains and their typed-resource scopes from one admitted envelope', () => {
		expect(read.resolvers.map((resolver) => resolver.domain)).toEqual([
			'layout',
			'scene',
			'camera',
			'experience',
			'resource:texture',
			'resource:asset'
		]);
		// Layout, Scene, Camera and Experience all resolve from their owning unit.
		expect(read.resolvers.flatMap((resolver) => [...resolver.subjectKinds])).toEqual(
			expect.arrayContaining(['wall', 'entity', 'view', 'connection', 'experience', 'presentation', 'stop', 'guide'])
		);
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
				currentReference({
					subject: { kind, id },
					location: kind === 'wall' ? { kind: 'layout-location', levelId: 'floor-2', structureInstancePath: [] } : { kind: 'project-root' }
				}),
				read
			);
			expect(result.kind, `${kind} "${id}"`).toBe('resolved');
			if (result.kind !== 'resolved') continue;
			expect(result.subject.contentRevision).toBe(UNIT_REVISION.layout);
			expect(result.subject.owner).toBe('layout');
			expect(result.subject.subject).toEqual({ kind, id });
		// The resolver states the canonical location, whichever valid qualification was used:
		// a Layout entity sits on the one authored level, and the level at the root.
			expect(result.subject.location).toEqual(
				kind === 'level' ? { kind: 'project-root' } : { kind: 'layout-location', levelId: 'floor-2', structureInstancePath: [] }
			);
		}
		// Two distinct valid references to one wall resolve to one canonical subject.
		const rooted = resolveReference(currentReference({ subject: { kind: 'wall', id: 'wall-1' } }), read);
		const leveled = resolveReference(
			currentReference({ subject: { kind: 'wall', id: 'wall-1' }, location: { kind: 'layout-location', levelId: 'floor-2', structureInstancePath: [] } }),
			read
		);
		expect(rooted.kind === 'resolved' && leveled.kind === 'resolved' && rooted.subject).toEqual(leveled.kind === 'resolved' && leveled.subject);
		expect(compareReferences(rooted.reference, leveled.reference)).not.toBe(0);
	});

	it('resolves actual Scene entities, the Scene root and the read-only Camera subjects', () => {
		const sceneRoot = resolveReference(
			currentReference({ domain: 'scene', subject: { kind: 'scene', id: 'project-1' } }),
			read
		);
		expect(sceneRoot.kind).toBe('resolved');
		if (sceneRoot.kind !== 'resolved') return;
		expect(sceneRoot.subject.owner).toBe('scene');

		expect(
			resolveReference(currentReference({ domain: 'scene', subject: { kind: 'entity', id: 'entity-1' } }), read).kind
		).toBe('resolved');
		expect(
			resolveReference(currentReference({ domain: 'scene', subject: { kind: 'material', id: 'material-1' } }), read).kind
		).toBe('resolved');
		expect(
			resolveReference(currentReference({ domain: 'scene', subject: { kind: 'texture', id: 'texture-1' } }), read).kind
		).toBe('resolved');			expect(
			resolveReference(currentReference({ domain: 'camera', subject: { kind: 'view', id: 'node-1' } }), read).kind
		).toBe('resolved');
		const connection = resolveReference(
			currentReference({ domain: 'camera', subject: { kind: 'connection', id: 'connection-1' } }),
			read
		);
		expect(connection.kind).toBe('resolved');
		if (connection.kind !== 'resolved') return;
		expect(connection.subject.owner).toBe('camera');
		// The Experience domain resolves from its own unit, qualified by the
		// Experience id that owns each child subject.
		const experience = resolveReference(
			currentReference({
				domain: 'experience',
				subject: { kind: 'presentation', id: 'presentation-1' },
				instancePath: ['experience-1']
			}),
			read
		);
		expect(experience.kind).toBe('resolved');
		if (experience.kind === 'resolved') expect(experience.subject.owner).toBe('experience');
	});

	it('addresses a clustered entity by its stable id and treats cluster membership as grouping, not instancing', () => {
		// entity-2 is a cluster member. Membership is an organizational fact, not an
		// instance frame: the entity keeps the identity its stable id gives it, with an
		// empty instance path, before and after any regrouping.
		const member = resolveReference(currentReference({ domain: 'scene', subject: { kind: 'entity', id: 'entity-2' } }), read);
		expect(member.kind).toBe('resolved');
		if (member.kind !== 'resolved') return;
		expect(member.subject.instancePath).toEqual([]);
		// The cluster is a subject of its own, never a path segment of its members.
		expect(
			resolveReference(currentReference({ domain: 'scene', subject: { kind: 'cluster', id: 'cluster-1' } }), read).kind
		).toBe('resolved');
		// The Scene unit authors no instancing, so no instance path can qualify an
		// entity — neither a member nor a non-member, and not the cluster itself.
		const asPath = resolveReference(
			currentReference({ domain: 'scene', subject: { kind: 'entity', id: 'entity-2' }, instancePath: ['cluster-1'] }),
			read
		);
		expect(asPath.kind).toBe('failed');
		if (asPath.kind !== 'failed') return;
		expect(asPath.code).toBe('missing');
		expect(asPath.message).toContain('cluster-1');
		expect(
			resolveReference(
				currentReference({ domain: 'scene', subject: { kind: 'entity', id: 'entity-1' }, instancePath: ['cluster-1'] }),
				read
			).kind
		).toBe('failed');
		expect(
			resolveReference(
				currentReference({ domain: 'scene', subject: { kind: 'cluster', id: 'cluster-1' }, instancePath: ['cluster-1'] }),
				read
			).kind
		).toBe('failed');
	});

	it('refuses an id the source does not author and never resolves by name or label', () => {
		const unknown = resolveReference(currentReference({ subject: { kind: 'wall', id: 'wall-9' } }), read);
		expect(unknown.kind).toBe('failed');
		if (unknown.kind !== 'failed') return;
		expect(unknown.code).toBe('missing');
		expect(unknown.repairs.length).toBeGreaterThan(0);
		// wall-2 is *named* "wall-1": a name is not identity, so asking for the name is missing.
		const byName = resolveReference(currentReference({ subject: { kind: 'wall', id: 'perimeter-wall' } }), read);
		expect(byName.kind === 'failed' && byName.code).toBe('missing');
		// A level the source does not author is a missing subject, not a second level.
		const kind = resolveReference(currentReference({ subject: { kind: 'level', id: 'floor-1' } }), read);
		expect(kind.kind === 'failed' && kind.code).toBe('missing');
		// A subject kind no unit resolver declares is unsupported, not missing.
		const unsupportedKind = resolveReference(currentReference({ subject: { kind: 'placed-structure', id: 's-1' } }), read);
		expect(unsupportedKind.kind === 'failed' && unsupportedKind.code).toBe('incompatible');
	});

	it('qualifies the one authored level and invents no structure or level schema', () => {
		// The authored floor ID is the level qualification; another level is missing.
		const otherLevel = resolveReference(
			currentReference({ location: { kind: 'layout-location', levelId: 'floor-1', structureInstancePath: [] } }),
			read
		);
		expect(otherLevel.kind === 'failed' && otherLevel.code).toBe('missing');
		const structure = resolveReference(
			currentReference({ location: { kind: 'layout-location', levelId: 'floor-2', structureInstancePath: ['structure-1'] } }),
			read
		);
		expect(structure.kind === 'failed' && structure.code).toBe('missing');
		// A Scene subject cannot carry a Layout location qualification.
		const misplaced = resolveReference(
			currentReference({
				domain: 'scene',
				subject: { kind: 'entity', id: 'entity-1' },
				location: { kind: 'layout-location', levelId: 'floor-2', structureInstancePath: [] }
			}),
			read
		);
		expect(misplaced.kind === 'failed' && misplaced.code).toBe('missing');
	});

	it('resolves Experience subjects and leaves an unregistered resource domain incompatible', () => {
		const experience = resolveReference(
			currentReference({
				domain: 'experience',
				subject: { kind: 'experience', id: 'experience-1' },
				instancePath: ['experience-1']
			}),
			read
		);
		expect(experience.kind).toBe('resolved');
		const resource = resolveReference(
			currentReference({ domain: 'resource:audio', subject: { kind: 'audio', id: 'audio-1' } }),
			read
		);
		expect(resource.kind === 'failed' && resource.code).toBe('incompatible');
	});

	it('refuses an owner-qualified frame because the unit source authors none', () => {
		const frame = { version: 1, kind: 'owner-frame', owner: 'layout', frameId: 'floor-2-frame', revision: 'r1' } as const;
		const result = resolveFrame(frame, read);
		expect(result.kind).toBe('failed');
		if (result.kind !== 'failed') return;
		// The unit source admits no frame resolver, so an owner-qualified frame is
		// unsupported by this reader: no centroid or containment invents one.
		expect(result.code).toBe('incompatible');
		expect(result.repairs.length).toBeGreaterThan(0);
	});

	it('binds every resolution to the supplied project identity', () => {
		// The unit resolvers never compare acceptance revision ids: the accepted
		// revision is the snapshot's identity, while an envelope carries the
		// baseline it was prepared from. The binding they do enforce is the project.
		const otherProject = currentContext({
			snapshot: { acceptedRevision: { projectId: 'project-2', revisionId: 'revision-7' }, sourceContentId: 'sha256-source-7' }
		});
		const mismatched = resolveReference(currentReference(), otherProject);
		expect(mismatched.kind).toBe('failed');
		if (mismatched.kind !== 'failed') return;
		expect(mismatched.code).toBe('repair-required');
		expect(mismatched.repairs.length).toBeGreaterThan(0);
	});

	it('resolves identical unit content under a different acceptance revision', () => {
		// A revision change does not re-identify the content: the owning unit's
		// revision is what an exact reference names, so the same envelope still
		// answers after an acceptance that did not change its bytes.
		const later = currentContext({
			snapshot: { acceptedRevision: { projectId: 'project-1', revisionId: 'revision-8' }, sourceContentId: 'sha256-source-8' }
		});
		const resolved = resolveReference(currentReference(), later);
		expect(resolved.kind).toBe('resolved');
		if (resolved.kind !== 'resolved') return;
		expect(resolved.subject.contentRevision).toBe(UNIT_REVISION.layout);
	});

	it('refuses an exact reference that names content the supplied source is not', () => {
		const otherContent = resolveReference(
			currentReference({ revision: { kind: 'exact', contentRevision: 'sha256-source-6' } }),
			read
		);
		expect(otherContent.kind).toBe('failed');
		if (otherContent.kind !== 'failed') return;
		// The unit resolver reports a revision that names no content this unit holds.
		expect(otherContent.code).toBe('repair-required');
		expect(otherContent.repairs.length).toBeGreaterThan(0);

		// An acceptance token is not a content identity: naming the supplied snapshot's
		// `acceptedRevision.revisionId` as the exact content revision is other content.
		const token = resolveReference(
			currentReference({ revision: { kind: 'exact', contentRevision: SNAPSHOT.acceptedRevision.revisionId } }),
			read
		);
		expect(token.kind === 'failed' && token.code).toBe('repair-required');

		// The content the source actually holds still resolves, and records that content.
		const held = resolveReference(currentReference(), read);
		expect(held.kind).toBe('resolved');
		if (held.kind !== 'resolved') return;
		expect(held.subject.contentRevision).toBe(UNIT_REVISION.layout);
	});

	it('refuses a dependency lock that resolves another project or other content', () => {
		// A lock for another project: this adapter reads one project's source, so there is
		// nothing to resolve that identity against.
		const foreign = currentReference({ revision: { kind: 'project-lock', projectId: 'project-2' } });
		const foreignLock: DependencyLockReader = { projectId: 'project-2', contentRevisionFor: () => 'sha256-source-7' };
		const foreignResult = resolveReference(foreign, currentContext({ lock: foreignLock }));
		expect(foreignResult.kind).toBe('failed');
		if (foreignResult.kind !== 'failed') return;
		// The unit reader holds one project's source, so another project's lock names
		// no subject this reader can resolve.
		expect(foreignResult.code).toBe('missing');
		expect(foreignResult.message).toContain('project-2');

		// A lock that pins this project to content the supplied source is not.
		const own = currentReference({ revision: { kind: 'project-lock', projectId: 'project-1' } });
		const staleLock: DependencyLockReader = { projectId: 'project-1', contentRevisionFor: () => 'sha256-source-6' };
		const stale = resolveReference(own, currentContext({ lock: staleLock }));
		expect(stale.kind).toBe('failed');
		if (stale.kind !== 'failed') return;
		// The unit resolver reports a pin that names no content the unit holds.
		expect(stale.code).toBe('repair-required');

		// A lock resolving to the acceptance token rather than to content is other content too.
		const tokenLock: DependencyLockReader = { projectId: 'project-1', contentRevisionFor: () => 'revision-7' };
		expect(resolveReference(own, currentContext({ lock: tokenLock })).kind).toBe('failed');

		// The lock agrees with the content the supplied source holds: the reference resolves,
		// at that same content revision.
		const currentLock: DependencyLockReader = { projectId: 'project-1', contentRevisionFor: () => UNIT_REVISION.layout };
		const ok = resolveReference(own, currentContext({ lock: currentLock }));
		expect(ok.kind).toBe('resolved');
		if (ok.kind !== 'resolved') return;
		expect(ok.subject.contentRevision).toBe(UNIT_REVISION.layout);
	});

	it('refuses a component or capability qualifier the current source does not author', () => {
		const component = resolveReference(currentReference({ componentId: 'slab-top' }), read);
		expect(component.kind).toBe('failed');
		if (component.kind !== 'failed') return;
		expect(component.code).toBe('missing');
		expect(component.message).toContain('component');
		// The refusal is the qualification, not the subject: without it the subject resolves.
		expect(resolveReference(currentReference(), read).kind).toBe('resolved');

		const cameraCapability = resolveReference(
			currentReference({
				domain: 'camera',
				subject: { kind: 'view', id: 'node-1' },
				capabilityId: 'camera.session-inspection'
			}),
			read
		);
		expect(cameraCapability.kind).toBe('failed');
		if (cameraCapability.kind !== 'failed') return;
		expect(cameraCapability.code).toBe('missing');
		expect(cameraCapability.message).toContain('capability');

		const sceneCapability = resolveReference(
			currentReference({
				domain: 'scene',
				subject: { kind: 'entity', id: 'entity-1' },
				capabilityId: 'camera.session-inspection'
			}),
			read
		);
		expect(sceneCapability.kind).toBe('failed');
		const layoutCapability = resolveReference(currentReference({ capabilityId: 'layout.plan' }), read);
		expect(layoutCapability.kind).toBe('failed');
	});
});
