/**
 * T2.P01.S01 exit criteria — deterministic `place-object` candidates.
 *
 * The suite proves the four things a placement candidate is allowed to claim:
 *
 * 1. **The pose.** Upright, scale 1, contact-resolved Y from Layout support,
 *    yaw composed with the input frame once, and the frame's incidental origin
 *    height discarded.
 * 2. **The Scene.** The entity list is replaced; every other field — including
 *    the Camera-bearing nodes, connections and clusters — is carried over, so
 *    their canonical bytes cannot change. This is asserted on canonical
 *    serialization, not on object identity alone.
 * 3. **The refusals.** Each required code is exercised with an input that
 *    really produces it, including a support refusal passed through from the
 *    query and a stale compile generation.
 * 4. **Determinism.** The same captured inputs prepare the identical candidate
 *    twice, which is why a Plan-point and a 3D-hit for the same X/Z and support
 *    cannot diverge: a mesh hit's Y has nowhere to enter.
 */
import { describe, expect, it } from 'vitest';
import { cloneFixtureDocument } from '../content/__fixtures__/load-fixture-scene';
import {
	createEmptyWallFirstProject,
	framePointToWorld,
	planWallChain,
	compileWallFirstLayoutGeometry,
	floorSupportSnapshotOf,
	queryFloorSupports,
	chooseFloorSupport,
	parseProjectJson,
	serializeProject,
	validateDerivedSourceRef,
	preparePlaceObjectCandidate,
	validateProject,
	type FloorSupportCandidate,
	type LocalInputFrame,
	type NormalizedPlacementDefinition,
	type ObjectCreationDefaults,
	type PlaceObjectInput,
	type PlaceObjectRefusalCode,
	type PlaceObjectResult,
	type SceneDocument
} from '@portfolio/project-model';

const GENERATION = 'generation-1';
const SNAPSHOT = { acceptedRevision: { projectId: 'project-1', revisionId: 'revision-1' }, sourceContentId: 'content-1' };
const FRAME: LocalInputFrame = { origin: [1, 0.5, 2], yaw: Math.PI / 2 };

function support(elevation: number, generationId = GENERATION): FloorSupportCandidate {
	return {
		queryPoint: [1, 1],
		elevation,
		upNormal: [0, 1, 0],
		generationId,
		witnesses: [
			{
				floorId: 'floor-1',
				roomId: 'room-1',
				recordId: 'record-1',
				cacheKey: 'record-1:cache',
				sourceId: 'record-1:source',
				orderKey: 'record-1:order'
			}
		],
		orderKey: 'record-1:order',
		label: 'Floor floor-1 / Room room-1'
	};
}

function nativeDefinition(
	overrides: Partial<NormalizedPlacementDefinition> = {}
): NormalizedPlacementDefinition {
	return {
		definitionKey: 'native:box',
		metadataContentId: 'sha256-0000000000000000000000000000000000000000000000000000000000000000',
		admission: {
			operations: ['place-object'],
			supportedSurfaces: ['floor'],
			uprightOnly: true,
			provenance: { kind: 'analytical', detail: 'Centered primitive: contactMinY = -height/2.' },
			exclusions: []
		},
		footprintMeters: [
			[-0.5, -0.5],
			[0.5, -0.5],
			[0.5, 0.5],
			[-0.5, 0.5]
		],
		contactMinY: -0.5,
		creationDefaults: {
			kind: 'primitive',
			primitive: 'box',
			name: 'Block',
			dimensions: { width: 1, height: 1, depth: 1 },
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true
		},
		// A deliberately non-unit renderer correction: it must never reach the
		// authored instance transform.
		renderNormalization: { defaultScale: 0.032 },
		...overrides
	};
}

function modelDefinition(
	overrides: Partial<NormalizedPlacementDefinition> = {}
): NormalizedPlacementDefinition {
	return {
		definitionKey: 'model:paris-grand-piano',
		metadataContentId: 'sha256-1111111111111111111111111111111111111111111111111111111111111111',
		admission: {
			operations: ['place-object'],
			supportedSurfaces: ['floor'],
			uprightOnly: true,
			provenance: { kind: 'verified-model', verificationId: 'verification-1' },
			exclusions: []
		},
		footprintMeters: [
			[-0.74, 0.75],
			[0.74, 0.75],
			[0.74, -0.2],
			[0, -0.84],
			[-0.74, -0.2]
		],
		contactMinY: 0,
		creationDefaults: {
			kind: 'model',
			name: 'Paris Salon Grand Piano',
			assetId: 'paris-grand-piano',
			fallback: 'piano'
		},
		renderNormalization: { defaultScale: 0.032 },
		...overrides
	};
}

function emptyScene(): SceneDocument {
	return createEmptyWallFirstProject({ id: 'project-1', name: 'Project' }).scene;
}

function placeInput(overrides: Partial<PlaceObjectInput> = {}): PlaceObjectInput {
	const point = framePointToWorld(overrides.frame ?? FRAME, [(overrides.worldXZ ?? [1, 0])[0], 0, (overrides.worldXZ ?? [1, 0])[1]]);
	return {
		snapshot: SNAPSHOT, supportSnapshot: SNAPSHOT, frameSnapshot: SNAPSHOT,
		frameReference: { version: 1, kind: 'owner-frame', owner: 'scene', frameId: 'supplied-input-frame', revision: 'content-1' },
		document: emptyScene(),
		entityId: 'entity-1',
		definition: nativeDefinition(),
		worldXZ: [1, 0],
		yaw: 0.25,
		frame: FRAME,
		generationId: GENERATION,
		support: { kind: 'resolved', support: { ...support(2.5), queryPoint: [point[0], point[2]] } },
		...overrides
	};
}

function refusalCode(result: PlaceObjectResult): PlaceObjectRefusalCode | 'candidate' {
	return result.kind === 'candidate' ? 'candidate' : result.code;
}

describe('place-object candidate pose', () => {
	it('rests the entity on the chosen support elevation, never on the frame origin height', () => {
		const result = preparePlaceObjectCandidate(placeInput());
		expect(result.kind).toBe('candidate');
		if (result.kind !== 'candidate') return;
		const { position, rotation, scale } = result.candidate.worldPose;
		// local (1, 0) through a 90-degree frame at origin (1, 0.5, 2) is world (1, ~, 1).
		expect(position[0]).toBeCloseTo(1, 9);
		expect(position[2]).toBeCloseTo(1, 9);
		// 2.5 support elevation minus scale 1 * contactMinY (-0.5).
		expect(position[1]).toBeCloseTo(3, 9);
		// The frame's own Y (0.5) is never the resting height.
		expect(position[1]).not.toBeCloseTo(0.5, 3);
		expect(rotation[0]).toBe(0);
		expect(rotation[1]).toBeCloseTo(Math.PI / 2 + 0.25, 9);
		expect(rotation[2]).toBe(0);
		expect(scale).toBe(1);
		expect(result.candidate.entity.scale).toBe(1);
		expect(result.candidate.support.elevation).toBe(2.5);
		expect(result.candidate.support.generationId).toBe(GENERATION);
	});

	it('carries the renderer normalization as evidence without authoring it', () => {
		const result = preparePlaceObjectCandidate(
			placeInput({ definition: modelDefinition(), worldXZ: [0, 0], yaw: 0 })
		);
		expect(result.kind).toBe('candidate');
		if (result.kind !== 'candidate') return;
		const entity = result.candidate.entity;
		expect(entity.kind).toBe('model');
		expect(entity.scale).toBe(1);
		expect(JSON.stringify(entity)).not.toContain('0.032');
		expect(result.candidate.definitionKey).toBe('model:paris-grand-piano');
		expect(result.candidate.metadataContentId).toBe(modelDefinition().metadataContentId);
	});

	it('prepares an upright yaw-only rotation for a cylinder and a sphere too', () => {
		const cylinderDefaults: ObjectCreationDefaults = {
			kind: 'primitive',
			primitive: 'cylinder',
			name: 'Column',
			dimensions: { radius: 0.5, height: 1 },
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true
		};
		const sphereDefaults: ObjectCreationDefaults = {
			kind: 'primitive',
			primitive: 'sphere',
			name: 'Sphere',
			dimensions: { radius: 0.5 },
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true
		};
		for (const [definitionKey, creationDefaults] of [
			['native:cylinder', cylinderDefaults],
			['native:sphere', sphereDefaults]
		] as const) {
			const result = preparePlaceObjectCandidate(
				placeInput({ definition: nativeDefinition({ definitionKey, creationDefaults }) })
			);
			expect(refusalCode(result)).toBe('candidate');
			if (result.kind !== 'candidate') continue;
			expect(result.candidate.entity.kind).toBe('primitive');
			expect(result.candidate.worldPose.rotation[0]).toBe(0);
			expect(result.candidate.worldPose.rotation[2]).toBe(0);
		}
	});
});

describe('place-object candidate Scene', () => {
	it('replaces the entity list and carries every other Scene field over', () => {
		const document = emptyScene();
		const result = preparePlaceObjectCandidate(placeInput({ document }));
		expect(result.kind).toBe('candidate');
		if (result.kind !== 'candidate') return;
		const scene = result.candidate.scene;
		expect(scene.entities).toHaveLength(document.entities.length + 1);
		expect(scene.entities.at(-1)!.id).toBe('entity-1');
		expect(scene).not.toBe(document);
		// Structural carry-over: the same objects the accepted source held.
		expect(scene.navigationNodes).toBe(document.navigationNodes);
		expect(scene.connections).toBe(document.connections);
		expect(scene.textures).toBe(document.textures);
		expect(scene.materials).toBe(document.materials);
		expect(scene.clusters).toBe(document.clusters);
		expect(scene.formatVersion).toBe(document.formatVersion);
	});

	it('leaves canonical Camera-bearing bytes identical and creates no roomId', () => {
		const project = createEmptyWallFirstProject({ id: 'project-1', name: 'Project' });
		const node = {
			id: 'node-1',
			label: 'Entry',
			position: [1, 1.65, 2] as [number, number, number],
			cameraTarget: [1, 1.25, 0] as [number, number, number],
			fov: 54,
			connectedNodeIds: [] as string[]
		};
		const source = {
			...project,
			scene: { ...project.scene, navigationNodes: [node] }
		};
		const baseline = validateProject(source);
		expect(baseline.success).toBe(true);
		if (!baseline.success) return;

		const result = preparePlaceObjectCandidate(
			placeInput({
				document: source.scene,
				definition: modelDefinition(),
				worldXZ: [3, -1],
				yaw: 0.4
			})
		);
		expect(result.kind).toBe('candidate');
		if (result.kind !== 'candidate') return;

		const candidate = validateProject({ ...source, scene: result.candidate.scene });
		expect(candidate.success).toBe(true);
		if (!candidate.success) return;

		const withoutEntities = (scene: SceneDocument): string => {
			const { entities: _entities, ...rest } = scene;
			return JSON.stringify(rest);
		};
		expect(withoutEntities(candidate.project.scene)).toBe(withoutEntities(baseline.project.scene));
		expect(candidate.project.scene.entities.slice(0, baseline.project.scene.entities.length)).toEqual(
			baseline.project.scene.entities
		);
		// No `roomId` is created anywhere in the new entity.
		const placed = candidate.project.scene.entities.at(-1)!;
		expect(placed.id).toBe('entity-1');
		expect('roomId' in placed).toBe(false);
		expect(JSON.stringify(placed)).not.toContain('roomId');
	});
});

describe('place-object refusals', () => {
	it('refuses a non-finite point, a duplicate entity id and a malformed frame', () => {
		expect(refusalCode(preparePlaceObjectCandidate(placeInput({ worldXZ: [Number.NaN, 0] })))).toBe(
			'invalid-value'
		);
		expect(refusalCode(preparePlaceObjectCandidate(placeInput({ yaw: Number.POSITIVE_INFINITY })))).toBe(
			'invalid-value'
		);
		expect(
			refusalCode(
				preparePlaceObjectCandidate(
					placeInput({ frame: { origin: [0, Number.NaN, 0], yaw: 0 } })
				)
			)
		).toBe('invalid-value');
		expect(refusalCode(preparePlaceObjectCandidate(placeInput({ generationId: '' })))).toBe(
			'invalid-value'
		);

		const project = createEmptyWallFirstProject({ id: 'project-1', name: 'Project' });
		const existing = preparePlaceObjectCandidate(
			placeInput({ document: project.scene, entityId: 'entity-1' })
		);
		if (existing.kind !== 'candidate') throw new Error('expected a candidate');
		const duplicate = preparePlaceObjectCandidate(
			placeInput({ document: existing.candidate.scene, entityId: 'entity-1' })
		);
		expect(refusalCode(duplicate)).toBe('invalid-value');
	});

	it('refuses a definition with no usable footprint or contact', () => {
		expect(
			refusalCode(preparePlaceObjectCandidate(placeInput({ definition: nativeDefinition({ footprintMeters: [] }) })))
		).toBe('missing-footprint');
		expect(
			refusalCode(
				preparePlaceObjectCandidate(
					placeInput({
						definition: nativeDefinition({
							footprintMeters: [
								[0, 0],
								[1, 0],
								[Number.NaN, 1]
							]
						})
					})
				)
			)
		).toBe('missing-footprint');
		expect(
			refusalCode(
				preparePlaceObjectCandidate(
					placeInput({
						definition: nativeDefinition({
							contactMinY: Number.NaN,
							footprintMeters: [
								[0, 0],
								[1, 0],
								[1, 1]
							]
						})
					})
				)
			)
		).toBe('missing-contact-metadata');
	});

	it('refuses a surface this slice does not admit', () => {
		const wallDefinition = nativeDefinition({
			admission: {
				operations: ['place-object'],
				supportedSurfaces: ['wall'],
				uprightOnly: true,
				provenance: { kind: 'analytical', detail: 'wall-mounted' },
				exclusions: [{ code: 'plane-primitive', reason: 'vertical surface' }]
			}
		});
		const result = preparePlaceObjectCandidate(placeInput({ definition: wallDefinition }));
		expect(refusalCode(result)).toBe('unsupported-surface');
		if (result.kind === 'refusal') {
			expect(result.diagnostics).toContain('plane-primitive');
		}

		const tilted = preparePlaceObjectCandidate(
			placeInput({ definition: nativeDefinition({ admission: { ...nativeDefinition().admission, uprightOnly: false } }) })
		);
		expect(refusalCode(tilted)).toBe('unsupported-surface');
	});

	it('refuses an unresolved, ambiguous or refused support instead of choosing one', () => {
		expect(refusalCode(preparePlaceObjectCandidate(placeInput({ support: { kind: 'none' } })))).toBe(
			'no-support'
		);
		const ambiguous = preparePlaceObjectCandidate(
			placeInput({
				support: { kind: 'choice-required', candidates: [support(0), support(2.5)] }
			})
		);
		expect(refusalCode(ambiguous)).toBe('support-choice-required');
		if (ambiguous.kind === 'refusal') {
			expect(ambiguous.diagnostics).toEqual(['record-1:order', 'record-1:order']);
		}

		const refused = preparePlaceObjectCandidate(
			placeInput({
				support: { kind: 'refused', code: 'unknown-scope-floor', message: 'chosen floor is not in this Layout' }
			})
		);
		expect(refusalCode(refused)).toBe('invalid-value');
		if (refused.kind === 'refusal') expect(refused.diagnostics).toContain('unknown-scope-floor');
	});

	it('refuses support resolved against another compile generation', () => {
		const result = preparePlaceObjectCandidate(
			placeInput({ generationId: 'generation-2', support: { kind: 'resolved', support: support(0) } })
		);
		expect(refusalCode(result)).toBe('stale-generation');
		if (result.kind === 'refusal') expect(result.diagnostics).toContain('generation-1');
	});
});

describe('place-object determinism', () => {
	it('prepares the identical candidate for the same captured inputs', () => {
		const first = preparePlaceObjectCandidate(placeInput());
		// A 3D mesh hit carries no more than its X/Z: the same point and support
		// prepare the same candidate, with no place to put a face height.
		const second = preparePlaceObjectCandidate(
			placeInput({ worldXZ: [1, 0], definition: nativeDefinition() })
		);
		expect(second).toEqual(first);
	});

	it('does not mutate the accepted source it reads', () => {
		const document = emptyScene();
		const before = JSON.stringify(document);
		preparePlaceObjectCandidate(placeInput({ document }));
		expect(JSON.stringify(document)).toBe(before);
	});
});


describe('independent placement regressions', () => {
	it('keeps a stale query refusal typed as stale-generation', () => {
		expect(refusalCode(preparePlaceObjectCandidate(placeInput({ support: { kind: 'refused', code: 'stale-generation', message: 'old hit' } })))).toBe('stale-generation');
	});
	it('refuses degenerate and self-intersecting footprints', () => {
		for (const footprintMeters of [[[0, 0], [1, 0], [2, 0]], [[0, 0], [2, 2], [0, 2], [2, 0]]] as [number, number][][]) {
			expect(refusalCode(preparePlaceObjectCandidate(placeInput({ definition: nativeDefinition({ footprintMeters }) })))).toBe('missing-footprint');
		}
	});
	it('refuses invalid dimensions and dangling material defaults before returning a candidate', () => {
		const defaults = nativeDefinition().creationDefaults;
		if (defaults.kind !== 'primitive' || defaults.primitive !== 'box') throw new Error('box fixture');
		for (const creationDefaults of [{ ...defaults, dimensions: { ...defaults.dimensions, height: -1 } }, { ...defaults, materialInstanceId: 'missing-material' }, { ...defaults, name: '' }]) {
			expect(refusalCode(preparePlaceObjectCandidate(placeInput({ definition: nativeDefinition({ creationDefaults }) })))).toBe('invalid-value');
		}
	});
	it('refuses unverified model contact and invalid renderer correction', () => {
		const definition = modelDefinition();
		expect(refusalCode(preparePlaceObjectCandidate(placeInput({ definition: modelDefinition({ admission: { ...definition.admission, provenance: { kind: 'analytical', detail: 'guess' } } }) })))).toBe('missing-contact-metadata');
		expect(refusalCode(preparePlaceObjectCandidate(placeInput({ definition: modelDefinition({ renderNormalization: { defaultScale: Number.NaN } }) })))).toBe('invalid-value');
	});
	it('refuses a non-upward resolved support', () => {
		expect(refusalCode(preparePlaceObjectCandidate(placeInput({ support: { kind: 'resolved', support: { ...support(0), upNormal: [0, -1, 0] } } })))).toBe('unsupported-surface');
	});
	it('never returns a non-finite rotation for finite captured yaw inputs', () => {
		const result = preparePlaceObjectCandidate(placeInput({ yaw: Number.MAX_VALUE, frame: { origin: [0, 0, 0], yaw: Number.MAX_VALUE } }));
		expect(result.kind).toBe('candidate');
		if (result.kind === 'candidate') expect(result.candidate.entity.rotation.every(Number.isFinite)).toBe(true);
	});
});


describe('placement source and support qualification', () => {
	it('retains every equivalent witness as an exact F1 derived source reference', () => {
		const chosen = support(0);
		chosen.witnesses = [chosen.witnesses[0]!, { ...chosen.witnesses[0]!, roomId: 'room-2', recordId: 'record-2', sourceId: 'room-2' }];
		const result = preparePlaceObjectCandidate(placeInput({ support: { kind: 'resolved', support: chosen } }));
		expect(result.kind).toBe('candidate');
		if (result.kind !== 'candidate') return;
		expect(result.candidate.baseline).toEqual(SNAPSHOT);
		expect(result.candidate.support.witnesses).toEqual(chosen.witnesses);
		expect(result.candidate.support.fragments).toHaveLength(2);
		for (const [index, fragment] of result.candidate.support.fragments.entries()) {
			expect(validateDerivedSourceRef(fragment).success).toBe(true);
			expect(fragment.source.subject).toEqual({ kind: 'room', id: chosen.witnesses[index]!.roomId });
			expect(fragment.source.revision).toEqual({ kind: 'exact', contentRevision: SNAPSHOT.sourceContentId });
			expect(fragment.generationId).toBe(GENERATION);
		}
	});
	it('refuses a support from another accepted revision even if the generation string matches', () => {
		for (const supportSnapshot of [
			{ ...SNAPSHOT, sourceContentId: 'old-content' },
			{ ...SNAPSHOT, acceptedRevision: { ...SNAPSHOT.acceptedRevision, revisionId: 'old-revision' } },
			{ ...SNAPSHOT, acceptedRevision: { ...SNAPSHOT.acceptedRevision, projectId: 'other-project' } }
		]) expect(refusalCode(preparePlaceObjectCandidate(placeInput({ supportSnapshot })))).toBe('stale-revision');
	});
	it('refuses a stale input frame and a nonidentity project-world conversion', () => {
		expect(refusalCode(preparePlaceObjectCandidate(placeInput({ frameSnapshot: { ...SNAPSHOT, sourceContentId: 'old-content' } })))).toBe('stale-revision');
		expect(refusalCode(preparePlaceObjectCandidate(placeInput({ frameReference: { version: 1, kind: 'project-world' } })))).toBe('invalid-value');
	});
	it('refuses support queried for a different placement point', () => {
		const input = placeInput();
		input.support = { kind: 'resolved', support: { ...support(0), queryPoint: [30, 40] } };
		expect(refusalCode(preparePlaceObjectCandidate(input))).toBe('invalid-value');
	});
});


it('places on a real raised compiled floor with Plan/3D parity and strict project round trip', () => {
	const project = createEmptyWallFirstProject({ id: 'project-1', name: 'Raised gallery' });
	const baseline = { ...project.layout, floor: { ...project.layout.floor, elevation: 2.5 } };
	const planned = planWallChain({ baseline, points: [[0, 0], [7, 0], [7, 6], [0, 6]], close: true, role: 'boundary' });
	if (planned.kind !== 'success') throw new Error('enclosure failed');
	const source = { ...project, layout: planned.document };
	const compiled = compileWallFirstLayoutGeometry(source.layout);
	const result = queryFloorSupports(floorSupportSnapshotOf(compiled.geometry), { generationId: GENERATION, x: 3, z: 2 });
	if (result.kind !== 'candidates') throw new Error('support query failed');
	const chosen = chooseFloorSupport(result.candidates);
	if (chosen.kind !== 'resolved') throw new Error('support choice failed');
	const input = placeInput({ document: source.scene, worldXZ: [3, 2], frame: { origin: [0, 0, 0], yaw: 0 }, frameReference: { version: 1, kind: 'project-world' }, support: chosen });
	const plan = preparePlaceObjectCandidate(input);
	const meshHit = { x: 3, y: 9999, z: 2 };
	const hit = preparePlaceObjectCandidate({ ...input, worldXZ: [meshHit.x, meshHit.z] });
	expect(hit).toEqual(plan);
	if (plan.kind !== 'candidate') throw new Error('placement failed');
	expect(plan.candidate.entity.position).toEqual([3, 3, 2]);
	const candidateProject = { ...source, scene: plan.candidate.scene };
	expect(validateProject(candidateProject).success).toBe(true);
	expect(parseProjectJson(serializeProject(candidateProject)).success).toBe(true);
	expect(plan.candidate.support.fragments[0]!.source.subject.id).toBe(compiled.geometry.rooms[0]!.roomId);
});


it('does not confuse a frame owner revision with the snapshot content identity', () => {
	expect(preparePlaceObjectCandidate(placeInput({ frameReference: { version: 1, kind: 'owner-frame', owner: 'scene', frameId: 'frame-1', revision: 'independent-frame-revision' } })).kind).toBe('candidate');
});

it('refuses a finite native contact inconsistent with the primitive dimensions', () => {
	expect(refusalCode(preparePlaceObjectCandidate(placeInput({ definition: nativeDefinition({ contactMinY: -0.25 }) })))).toBe('missing-contact-metadata');
});


it('preserves populated Camera, resource and cluster bytes across every admitted entity kind', () => {
 const document = cloneFixtureDocument('tour-minimal');
 document.textures = [{ id: 'texture-1', name: 'Texture', uri: '/textures/test.png' }];
 document.materials = [{ id: 'material-1', name: 'Material', baseMaterialId: 'plaster-warm', baseTextureId: 'texture-1', roughness: 0.25, metalness: 0.75 }];
 document.clusters = [{ id: 'cluster-1', name: 'Group', memberIds: document.entities.map(entity => entity.id) }];
 const freeze = (value: unknown): void => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
 };
 freeze(document);
 const before = JSON.stringify(document);
 const canonicalUnrelated = (scene: SceneDocument): string => {
  const validated = validateProject({ ...createEmptyWallFirstProject({ id: 'project-1', name: 'Project' }), scene });
  if (!validated.success) throw new Error(JSON.stringify(validated.issues));
  const { entities: _entities, ...rest } = validated.project.scene;
  return JSON.stringify(rest);
 };
 for (const definition of [nativeDefinition(), modelDefinition(), ...(['cylinder', 'sphere'] as const).map(primitive => nativeDefinition({
  creationDefaults: { kind: 'primitive', primitive, name: primitive, dimensions: primitive === 'sphere' ? { radius: 0.5 } : { radius: 0.5, height: 1 }, materialId: 'plaster-warm', castShadow: true, receiveShadow: true } as ObjectCreationDefaults
 }))]) {
  const result = preparePlaceObjectCandidate(placeInput({ document, definition }));
  if (result.kind !== 'candidate') throw new Error(result.message);
  expect(canonicalUnrelated(result.candidate.scene)).toBe(canonicalUnrelated(document));
  expect(result.candidate.scene.entities.slice(0, document.entities.length)).toEqual(document.entities);
  expect(JSON.stringify(document)).toBe(before);
 }
});
