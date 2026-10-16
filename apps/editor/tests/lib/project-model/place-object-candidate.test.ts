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
import {
	createEmptyWallFirstProject,
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
const FRAME: LocalInputFrame = { origin: [1, 0.5, 2], yaw: Math.PI / 2 };

function support(elevation: number, generationId = GENERATION): FloorSupportCandidate {
	return {
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
	return {
		document: emptyScene(),
		entityId: 'entity-1',
		definition: nativeDefinition(),
		worldXZ: [1, 0],
		yaw: 0.25,
		frame: FRAME,
		generationId: GENERATION,
		support: { kind: 'resolved', support: support(2.5) },
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
