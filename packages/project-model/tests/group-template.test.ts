/**
 * T2 D8b — the group template codec and extraction probe.
 *
 * The template is the only source shape both D8 tracks share, so this suite
 * pins the four facts everything else depends on:
 *
 * 1. **Strict admission.** A template admits exactly what Scene 13 admits, and
 *    refuses the four things that cannot travel: Artwork, a plane, a non-upright
 *    body and a model without a shipped pin. A member never carries an `id` or a
 *    project Finish.
 * 2. **Canonical bytes.** One template has one byte spelling, independent of the
 *    object's key order, and the writer is the only producer.
 * 3. **Deterministic frame.** The origin is the rigid pivot at the support
 *    beneath the group's lowest point, so a stored position is that member's
 *    height above the support.
 * 4. **Honest refusals.** An unsupported group names `no-support`; an ineligible
 *    member names the member and its reason.
 */
import { describe, expect, it } from 'vitest';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core/wall';
import type { CameraFreeSceneDocument } from '../src/units';
import { SCENE_UNIT_FORMAT_VERSION } from '../src/units';
import type {
	SceneEntity,
	SceneLightEntity,
	SceneObjectCluster,
	ScenePrimitiveEntity,
} from '../src/scene';
import type { NormalizedPlacementDefinition } from '../src/scene-planning/types';
import {
	canonicalGroupTemplate,
	canonicalGroupTemplateBytes,
	canonicalGroupTemplateJson,
	groupTemplateFromCluster,
	readGroupTemplate,
	type GroupTemplate,
	type GroupTemplateMember,
} from '../src/scene-planning/group-template';

const LAYOUT = createEmptyWallFirstLayoutDocument();
const SOURCE = 'content-group-template';

function box(
	id: string,
	position: [number, number, number],
	overrides: Partial<Pick<ScenePrimitiveEntity, 'materialInstanceId'>> & {
		readonly rotation?: [number, number, number];
	} = {},
): ScenePrimitiveEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name: id,
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position,
		rotation: overrides.rotation ?? [0, 0, 0],
		scale: 1,
		...(overrides.materialInstanceId === undefined
			? {}
			: { materialInstanceId: overrides.materialInstanceId }),
	};
}

/** A template-shaped box: no captured id and no project Finish. */
function memberBox(
	name: string,
	position: [number, number, number],
	rotation: [number, number, number] = [0, 0, 0],
) {
	return {
		kind: 'primitive' as const,
		primitive: 'box' as const,
		name,
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm' as const,
		castShadow: true,
		receiveShadow: true,
		position,
		rotation,
		scale: 1,
	};
}

function spot(id: string, position: [number, number, number]): SceneLightEntity {
	return {
		kind: 'light',
		light: 'spot',
		id,
		name: id,
		color: '#ffd9a0',
		intensity: 12,
		angle: 0.9,
		penumbra: 0.5,
		castShadow: false,
		position,
		rotation: [-Math.PI / 2, 0, 0],
	};
}

function sceneWith(
	entities: readonly SceneEntity[],
	clusters?: readonly SceneObjectCluster[],
): CameraFreeSceneDocument {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials: [],
		entities: [...entities],
		...(clusters === undefined ? {} : { clusters: [...clusters] }),
	};
}

function pair(): SceneObjectCluster {
	return { id: 'cluster-pair', name: 'Chair and lamp', memberIds: ['box-a', 'box-b', 'spot-a'] };
}

const CHAIR_CONTACT = -5.2503001946035965e-12;

function chairDefinition(): NormalizedPlacementDefinition {
	return {
		definitionKey: 'model:paris-salon-chair',
		metadataContentId: `sha256-${'1'.repeat(64)}`,
		admission: {
			operations: ['place-object'],
			supportedSurfaces: ['floor'],
			uprightOnly: true,
			provenance: { kind: 'verified-model', verificationId: 'r186-salon-chair-contact-footprint-v1' },
			exclusions: [],
		},
		footprintMeters: [
			[-0.3215, -0.2685],
			[0.3215, -0.2685],
			[0.3215, 0.2685],
			[-0.3215, 0.2685],
		],
		contactMinY: CHAIR_CONTACT,
		creationDefaults: {
			kind: 'model',
			name: 'Salon chair',
			assetId: 'paris-salon-chair',
			fallback: 'chair',
		},
		renderNormalization: { defaultScale: 0.92 },
	};
}

function memberShape(member: GroupTemplateMember): Record<string, unknown> {
	return member as unknown as Record<string, unknown>;
}

/** The template member list of a successful read, so a refusal is a test failure. */
function readMembers(input: unknown): readonly GroupTemplateMember[] {
	const parsed = readGroupTemplate(input);
	if (!parsed.success) throw new Error(JSON.stringify(parsed.issues));
	return parsed.template.members;
}

describe('group template — strict codec', () => {
	it('round-trips the canonical shape and never carries an id or a Finish', () => {
		const scene = sceneWith([
			box('box-a', [1, 0.5, 1], { materialInstanceId: 'finish-walnut' }),
			box('box-b', [3, 0.5, 2]),
			spot('spot-a', [2, 2.2, 1.5]),
		], [pair()]);
		const extracted = groupTemplateFromCluster({
			scene,
			layout: LAYOUT,
			sourceContentId: SOURCE,
			clusterId: pair().id,
		});
		expect(extracted.kind).toBe('template');
		if (extracted.kind !== 'template') return;

		// The pivot is the X/Z centre of the members; the origin Y is the datum
		// support beneath the lowest point.
		expect(extracted.origin).toEqual([2, 0, 1.5]);
		expect(extracted.template.name).toBe('Chair and lamp');
		expect(extracted.template.members.map((member) => member.position)).toEqual([
			[-1, 0.5, -0.5],
			[1, 0.5, 0.5],
			[0, 2.2, 0],
		]);
		// A project Finish is dropped; the catalogue material and the rest of the
		// source travel verbatim.
		expect(memberShape(extracted.template.members[0]!)).not.toHaveProperty('materialInstanceId');
		expect(memberShape(extracted.template.members[0]!)).not.toHaveProperty('id');
		expect(extracted.template.members[0]).toMatchObject({
			kind: 'primitive',
			materialId: 'plaster-warm',
		});
		const bytes = canonicalGroupTemplateBytes(extracted.template);
		expect(new TextDecoder().decode(bytes)).not.toContain('finish-walnut');
		const reread = readGroupTemplate(JSON.parse(new TextDecoder().decode(bytes)));
		expect(reread.success).toBe(true);
		if (!reread.success) return;
		expect(reread.canonicalJson).toBe(canonicalGroupTemplateJson(extracted.template));
		expect(reread.template).toEqual(extracted.template);
	});

	it('is canonical across key order and strips an identity a caller appended', () => {
		const first: GroupTemplate = {
			name: '  Copy  ',
			members: [
				{
					kind: 'primitive',
					primitive: 'box',
					name: 'Block',
					dimensions: { width: 1, height: 1, depth: 1 },
					materialId: 'plaster-warm',
					castShadow: true,
					receiveShadow: true,
					position: [0, 0.5, 0],
					rotation: [0, 0.4, 0],
					scale: 1,
				},
				{
					kind: 'light',
					light: 'point',
					name: 'Bulb',
					color: '#ffffff',
					intensity: 3,
					castShadow: false,
					position: [0, 2, 0],
					rotation: [0, 0, 0],
				},
			],
		};
		const second: GroupTemplate = {
			members: [
				{
					position: [0, 0.5, 0],
					rotation: [0, 0.4, 0],
					scale: 1,
					receiveShadow: true,
					castShadow: true,
					materialId: 'plaster-warm',
					dimensions: { depth: 1, width: 1, height: 1 },
					primitive: 'box',
					name: 'Block',
					kind: 'primitive',
				},
				{
					light: 'point',
					kind: 'light',
					name: 'Bulb',
					color: '#ffffff',
					intensity: 3,
					castShadow: false,
					position: [0, 2, 0],
					rotation: [0, 0, 0],
				},
			],
			name: 'Copy',
		};
		expect(canonicalGroupTemplateJson(second)).toBe(canonicalGroupTemplateJson(first));
		// The canonical writer is a projection: a stray captured id on the runtime
		// object cannot reach the bytes.
		const withIdentity = canonicalGroupTemplate({
			...first,
			members: [
				first.members[0]!,
				{ ...first.members[1]!, id: 'leaked' } as unknown as GroupTemplateMember,
			],
		});
		expect(JSON.stringify(withIdentity)).not.toContain('leaked');
		expect(canonicalGroupTemplate(first).name).toBe('Copy');
	});

	it('refuses Artwork, a plane, a non-upright member and a model without a shipped pin', () => {
		const base = {
			name: 'Refused',
			members: [
				memberBox('box-a', [0, 0.5, 0]),
				memberBox('box-b', [1, 0.5, 0]),
			],
		};
		const artwork = {
			kind: 'artwork',
			name: 'Print',
			position: [0, 1, 0],
			rotation: [0, 0, 0],
			source: {
				kind: 'image',
				assetId: '00000000-0000-4000-8000-000000000000',
				pixelWidth: 100,
				pixelHeight: 100,
			},
			widthMeters: 1,
		};
		const plane = {
			...memberBox('plane-a', [0, 0.5, 0]),
			primitive: 'plane',
			dimensions: { width: 1, height: 1 },
		};
		const tilted = memberBox('tilted', [0, 0.5, 0], [0.4, 0, 0]);
		const creatorModel = {
			kind: 'model',
			name: 'Imported chair',
			assetId: 'resource-created-chair',
			fallback: 'generic',
			position: [0, 0.5, 0],
			rotation: [0, 0, 0],
			scale: 1,
		};
		const cases: Array<{ member: unknown; code: string; message: RegExp }> = [
			{ member: artwork, code: 'ineligible-member', message: /Artwork/ },
			{ member: plane, code: 'ineligible-member', message: /plane/ },
			{ member: tilted, code: 'ineligible-member', message: /not upright/ },
			{ member: creatorModel, code: 'ineligible-member', message: /not a pinned shipped/ },
		];
		for (const sample of cases) {
			const parsed = readGroupTemplate({
				name: base.name,
				members: [base.members[0], sample.member],
			});
			expect(parsed.success, JSON.stringify(sample.member)).toBe(false);
			if (parsed.success) continue;
			expect(
				parsed.issues.map((issue) => issue.code),
				JSON.stringify({ member: sample.member, issues: parsed.issues }),
			).toContain(sample.code);
			expect(parsed.issues.some((issue) => sample.message.test(issue.message))).toBe(true);
		}
		const leakedId = readGroupTemplate({
			name: 'Leak',
			members: [{ ...base.members[0], id: 'box-a' }, base.members[1]],
		});
		expect(leakedId.success).toBe(false);
		if (!leakedId.success) expect(leakedId.issues[0]?.code).toBe('unknown-key');
		const leakedFinish = readGroupTemplate({
			name: 'Leak',
			members: [{ ...base.members[0], materialInstanceId: 'finish-1' }, base.members[1]],
		});
		expect(leakedFinish.success).toBe(false);
		const oneMember = readGroupTemplate({ name: 'Small', members: [base.members[0]] });
		expect(oneMember.success).toBe(false);
		if (!oneMember.success) expect(oneMember.issues[0]?.code).toBe('group_too_small');
		const longName = readGroupTemplate({ name: 'x'.repeat(121), members: base.members });
		expect(longName.success).toBe(false);
	});

	it('admits the pinned salon chair and a catalogue light only as upright templates', () => {
		const members = readMembers({
			name: 'Chair and light',
			members: [
				{
					kind: 'model',
					name: 'Salon chair',
					assetId: 'paris-salon-chair',
					fallback: 'chair',
					position: [0, 0, 0],
					rotation: [0, 0.3, 0],
					scale: 1,
				},
				{
					kind: 'light',
					light: 'spot',
					name: 'Bulb',
					color: '#ffd9a0',
					intensity: 12,
					angle: 0.9,
					penumbra: 0.5,
					castShadow: false,
					position: [0, 2.1, 0],
					rotation: [-Math.PI / 2, 0, 0],
				},
			],
		});
		expect(members).toHaveLength(2);
		expect(members[0]).toMatchObject({ kind: 'model', assetId: 'paris-salon-chair' });
		expect(members[1]).toMatchObject({ kind: 'light', light: 'spot', angle: 0.9 });
	});
});

describe('group template — frame extraction', () => {
	it('keeps a lifted member’s height above the support beneath the group', () => {
		const scene = sceneWith([box('box-a', [0, 1.5, 0]), box('box-b', [2, 0.5, 0])], [
			{ id: 'cluster-lifted', name: 'Lifted', memberIds: ['box-a', 'box-b'] },
		]);
		const extracted = groupTemplateFromCluster({
			scene,
			layout: LAYOUT,
			sourceContentId: SOURCE,
			clusterId: 'cluster-lifted',
		});
		expect(extracted.kind).toBe('template');
		if (extracted.kind !== 'template') return;
		// The lowest base rests at 0 on the datum; the lifted box keeps its 1 m lift.
		expect(extracted.origin).toEqual([1, 0, 0]);
		expect(extracted.template.members.map((member) => member.position[1])).toEqual([1.5, 0.5]);
	});

	it('uses the admitted contact for a pinned model and refuses one without it', () => {
		const scene = sceneWith(
			[
				{
					kind: 'model',
					id: 'chair',
					name: 'Salon chair',
					assetId: 'paris-salon-chair',
					fallback: 'chair',
					position: [0, 0, 0],
					rotation: [0, 0, 0],
					scale: 1,
				},
				box('box-b', [2, 0.5, 0]),
			],
			[{ id: 'cluster-chair', name: 'Chair group', memberIds: ['chair', 'box-b'] }],
		);
		const admitted = groupTemplateFromCluster({
			scene,
			layout: LAYOUT,
			sourceContentId: SOURCE,
			clusterId: 'cluster-chair',
			definitions: [chairDefinition()],
		});
		expect(admitted.kind).toBe('template');
		if (admitted.kind !== 'template') return;
		expect(admitted.contacts).toEqual([CHAIR_CONTACT, -0.5]);

		const refused = groupTemplateFromCluster({
			scene,
			layout: LAYOUT,
			sourceContentId: SOURCE,
			clusterId: 'cluster-chair',
		});
		expect(refused.kind).toBe('rejected');
		if (refused.kind !== 'rejected') return;
		expect(refused.code).toBe('ineligible-member');
		expect(refused.message).toContain('Salon chair');
		expect(refused.diagnostics.map((entry) => entry.message)).toContain('chair');
	});

	it('refuses an unreadable cluster, a non-upright member and a group with nothing beneath it', () => {
		const missing = groupTemplateFromCluster({
			scene: sceneWith([]),
			layout: LAYOUT,
			sourceContentId: SOURCE,
			clusterId: 'absent',
		});
		expect(missing.kind).toBe('rejected');
		if (missing.kind === 'rejected') expect(missing.code).toBe('missing-target');

		const tiltedScene = sceneWith(
			[box('tilted', [0, 0.5, 0], { rotation: [0.3, 0, 0] }), box('box-b', [2, 0.5, 0])],
			[{ id: 'cluster-tilted', name: 'Tilted', memberIds: ['tilted', 'box-b'] }],
		);
		const tilted = groupTemplateFromCluster({
			scene: tiltedScene,
			layout: LAYOUT,
			sourceContentId: SOURCE,
			clusterId: 'cluster-tilted',
		});
		expect(tilted.kind).toBe('rejected');
		if (tilted.kind === 'rejected') {
			expect(tilted.code).toBe('ineligible-member');
			expect(tilted.message).toContain('tilted');
		}

		// A light below the datum is the group's lowest point, and nothing supports
		// a point beneath the floor.
		const sunken = sceneWith(
			[box('box-a', [0, 0.5, 0]), spot('spot-low', [0, -1, 0])],
			[{ id: 'cluster-sunken', name: 'Sunken', memberIds: ['box-a', 'spot-low'] }],
		);
		const refused = groupTemplateFromCluster({
			scene: sunken,
			layout: LAYOUT,
			sourceContentId: SOURCE,
			clusterId: 'cluster-sunken',
		});
		expect(refused.kind).toBe('rejected');
		if (refused.kind === 'rejected') expect(refused.code).toBe('no-support');
	});
});
