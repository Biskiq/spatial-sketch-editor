/**
 * E7/R4 — the resolved Scene description.
 *
 * The description is where identity is decided: one look produces one canonical
 * descriptor, one shape produces one geometry key, and one Scene identity
 * produces one description object. Those are the properties the representation
 * relies on to do nothing when nothing changed, so they are tested directly.
 */
import { describe, expect, it } from 'vitest';
import type { SceneEntity, SceneTextureAsset, SceneMaterialInstance } from '@portfolio/project-model';
import type { RuntimeScene } from '$lib/content/scene';
import { materialKey } from '$lib/render/resources/material-descriptor';
import { describeSceneRender, type SceneFormSupport } from '$lib/render/scene-render-description';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import { startStageCounting } from '../../helpers/stage-counts';

const LOOK_SHARED = 'look-shared';
const LOOK_SECOND = 'look-second';
/** A marble catalogue base carries no texture slots: the one untextured look. */
const LOOK_PLAIN = 'look-plain';
const LOOK_TEXTURED = 'look-textured';
const TEXTURE_ID = 'texture-one';

function primitive(
	id: string,
	primitiveKind: 'box' | 'plane' | 'cylinder' | 'sphere',
	position: [number, number, number],
	look: string | null,
	overrides: Partial<{ scale: number; castShadow: boolean; receiveShadow: boolean }> = {}
): SceneEntity {
	const dimensions =
		primitiveKind === 'box'
			? { width: 0.6, height: 0.8, depth: 0.6 }
			: primitiveKind === 'sphere'
				? { radius: 0.3 }
				: primitiveKind === 'cylinder'
					? { radius: 0.25, height: 0.9 }
					: { width: 0.6, height: 0.6 };
	return {
		kind: 'primitive',
		primitive: primitiveKind,
		id,
		name: id,
		dimensions,
		materialId: 'plaster-warm',
		materialInstanceId: look,
		castShadow: overrides.castShadow ?? true,
		receiveShadow: overrides.receiveShadow ?? true,
		position,
		rotation: [0, 0, 0],
		...(overrides.scale === undefined ? {} : { scale: overrides.scale })
	} as SceneEntity;
}

const FORM_ENTITY: SceneEntity = {
	kind: 'form',
	id: 'form-1',
	name: 'form-1',
	position: [1, 0, 2],
	rotation: [0, 0.5, 0],
	materialId: 'plaster-warm',
	materialInstanceId: LOOK_SHARED,
	castShadow: true,
	receiveShadow: true,
	form: {
		generator: {
			kind: 'extrude',
			plane: 'plan',
			extent: 0.2,
			outline: [
				{ key: 1, u: 0, v: 0, smooth: false },
				{ key: 2, u: 1, v: 0, smooth: false },
				{ key: 3, u: 1, v: 0.5, smooth: false },
				{ key: 4, u: 0, v: 0.5, smooth: false }
			]
		},
		scale: [1, 1, 1],
		nextKey: 5
	}
} as SceneEntity;

const TEXTURES: SceneTextureAsset[] = [{ id: TEXTURE_ID, name: 'One', uri: '/textures/one.png' }];
const MATERIALS: SceneMaterialInstance[] = [
	{ id: LOOK_SHARED, name: 'Shared', baseMaterialId: 'plaster-warm', roughness: 0.85, metalness: 0 },
	{ id: LOOK_SECOND, name: 'Second', baseMaterialId: 'plaster-warm', roughness: 0.4, metalness: 0 },
	{ id: LOOK_PLAIN, name: 'Plain', baseMaterialId: 'marble-light', roughness: 0.5, metalness: 0 },
	{
		id: LOOK_TEXTURED,
		name: 'Textured',
		baseMaterialId: 'plaster-warm',
		baseTextureId: TEXTURE_ID,
		roughness: 0.65,
		metalness: 0
	}
];

function scene(entities: SceneEntity[]): RuntimeScene {
	return { entities, materials: MATERIALS, textures: TEXTURES } as unknown as RuntimeScene;
}

const FORM_SUPPORT: SceneFormSupport = {
	evaluate: (form) => {
		const mesh = evaluateFormMesh(form);
		return mesh === null ? null : { evaluationKey: 'form-key-1', mesh, plane: form.generator.plane };
	}
};

describe('E7/R4 — resolved Scene description', () => {
	it('memoises by Scene identity: an unrelated accept converts nothing again', () => {
		const counting = startStageCounting();
		try {
			const entities = [
				primitive('box-a', 'box', [0, 0, 0], LOOK_SHARED),
				primitive('box-b', 'box', [2, 0, 0], LOOK_SHARED)
			];
			const value = scene(entities);
			const first = describeSceneRender(value);
			expect(first.items).toHaveLength(2);
			const resolutions = counting.count('material:resolve');
			expect(resolutions).toBe(2);

			const second = describeSceneRender(value);
			expect(second).toBe(first);
			expect(counting.count('material:resolve')).toBe(resolutions);

			// A new Scene identity is a new conversion, even with equal content.
			const rebuilt = describeSceneRender(scene(entities));
			expect(rebuilt).not.toBe(first);
			expect(rebuilt.items.map((item) => item.key)).toEqual(first.items.map((item) => item.key));
		} finally {
			counting.stop();
		}
	});

	it('gives equal looks one descriptor and distinct looks another', () => {
		const value = scene([
			primitive('box-a', 'box', [0, 0, 0], LOOK_SHARED),
			primitive('plane-b', 'plane', [2, 0, 0], LOOK_SHARED),
			primitive('sphere-c', 'sphere', [4, 0, 0], LOOK_SECOND)
		]);
		const { items } = describeSceneRender(value);
		expect(items).toHaveLength(3);
		expect(items[0]!.material).toEqual(items[1]!.material);
		expect(materialKey(items[0]!.material)).toBe(materialKey(items[1]!.material));
		expect(materialKey(items[0]!.material)).not.toBe(materialKey(items[2]!.material));
		// Identity, not deep equality: the representation keys its store by it.
		expect(items[0]!.material).not.toBe(items[1]!.material);
	});

	it('carries the authored transform, the unit geometry scale and the shadow flags', () => {
		const sceneValue = scene([
			primitive('box-a', 'box', [1, 2, 3], LOOK_SHARED, { scale: 2, receiveShadow: false }),
			primitive('cylinder-b', 'cylinder', [0, 0, 0], LOOK_SHARED),
			primitive('plane-c', 'plane', [0, 0, 0], LOOK_SHARED),
			primitive('sphere-d', 'sphere', [0, 0, 0], LOOK_SHARED)
		]);
		const { items } = describeSceneRender(sceneValue);
		expect(items[0]).toMatchObject({
			geometry: { kind: 'unit', shape: 'box' },
			geometryScale: [0.6, 0.8, 0.6],
			transform: { position: [1, 2, 3], rotation: [0, 0, 0], scale: [2, 2, 2] },
			castShadow: true,
			receiveShadow: false
		});
		expect(items[1]).toMatchObject({
			geometry: { kind: 'unit', shape: 'cylinder', radialSegments: 32 },
			geometryScale: [0.5, 0.9, 0.5]
		});
		expect(items[2]).toMatchObject({
			geometry: { kind: 'unit', shape: 'plane' },
			geometryScale: [0.6, 0.6, 1]
		});
		expect(items[3]).toMatchObject({
			geometry: { kind: 'unit', shape: 'sphere', widthSegments: 32, heightSegments: 24 },
			geometryScale: [0.6, 0.6, 0.6]
		});
	});

	it('keys changes only when the drawn result changes', () => {
		const base = [primitive('box-a', 'box', [0, 0, 0], LOOK_SHARED), primitive('box-b', 'box', [1, 0, 0], LOOK_SHARED)];
		const before = describeSceneRender(scene(base)).items;
		const moved = describeSceneRender(
			scene([{ ...base[0]!, position: [0.5, 0, 0] } as SceneEntity, base[1]!])
		).items;
		expect(moved[0]!.key).not.toBe(before[0]!.key);
		// The untouched entity's key is the same string: a representation keeps it.
		expect(moved[1]!.key).toBe(before[1]!.key);

		const lookChanged = describeSceneRender(
			scene([
				{ ...base[0]!, materialInstanceId: LOOK_SECOND } as SceneEntity,
				base[1]!
			])
		).items;
		expect(lookChanged[0]!.key).not.toBe(before[0]!.key);
		expect(lookChanged[1]!.key).toBe(before[1]!.key);

		const shadowsChanged = describeSceneRender(
			scene([{ ...base[0]!, castShadow: false } as SceneEntity, base[1]!])
		).items;
		expect(shadowsChanged[0]!.key).not.toBe(before[0]!.key);
	});

	it('resolves a textured look to a variant and the surface repeat, and an untextured one to none', () => {
		const { items } = describeSceneRender(
			scene([
				primitive('box-textured', 'box', [0, 0, 0], LOOK_TEXTURED),
				primitive('box-plain', 'box', [1, 0, 0], LOOK_PLAIN)
			])
		);
		expect(items[0]!.textures).not.toBeNull();
		expect(items[0]!.textures!.slotUris).toMatchObject({ map: '/textures/one.png' });
		expect(items[0]!.material.textures).toBeUndefined();
		// `plaster-warm` tiles every 2 m, so a 0.6 m box surface repeats 0.3 times.
		expect(items[0]!.textures!.repeat).toEqual([0.3, 0.3]);
		expect(items[1]!.textures).toBeNull();
	});

	it('omits Forms until the lazy kernel arrives, then carries the kernel mesh', () => {
		const value = scene([primitive('box-a', 'box', [0, 0, 0], LOOK_SHARED), FORM_ENTITY]);
		const before = describeSceneRender(value);
		expect(before.items.map((item) => item.id)).toEqual(['box-a']);

		const arrived = describeSceneRender(value, FORM_SUPPORT);
		expect(arrived).not.toBe(before);
		expect(arrived.items.map((item) => item.id)).toEqual(['box-a', 'form-1']);
		const form = arrived.items[1]!;
		expect(form.geometry.kind).toBe('form');
		expect(form.geometryScale).toEqual([1, 1, 1]);
		expect(form.transform).toMatchObject({ position: [1, 0, 2], rotation: [0, 0.5, 0], scale: [1, 1, 1] });
		if (form.geometry.kind === 'form') {
			expect(form.geometry.evaluationKey).toBe('form-key-1');
			expect(form.geometry.mesh.indices.length).toBeGreaterThan(0);
		}

		// The support is part of the memo identity: the same Scene and support memoise.
		expect(describeSceneRender(value, FORM_SUPPORT)).toBe(arrived);
		// A support that cannot evaluate keeps the Form omitted.
		expect(describeSceneRender(value, { evaluate: () => null }).items.map((item) => item.id)).toEqual(['box-a']);
	});
});
