/**
 * T2.S6 — palette adoption.
 *
 * One pure plan serves the preview and the writer: literal Finish colours map
 * to the nearest palette slot in CIE Lab, image tints and inherited colours are
 * skipped and counted, and the writer revalidates every literal, slot id and
 * slot colour before it moves a follower.
 */
import { describe, expect, it } from 'vitest';
import type {
	AcceptedSnapshot,
	AuthoringIntent,
	SceneMaterialInstance
} from '@portfolio/project-model';
import {
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type CameraFreeSceneDocument,
	type ProjectEnvelope,
	type ScenePaletteSlot
} from '@portfolio/project-model/units';
import {
	SCENE_PALETTE_ADOPT,
	createFinishPlanners,
	nearestSlot,
	planPaletteAdoption
} from '@portfolio/project-model/scene-planning';

const PALETTE: ScenePaletteSlot[] = [
	{ id: 'coral', name: 'Coral', color: '#ee6c4d' },
	{ id: 'ink', name: 'Ink', color: '#293241' }
];

type LegacyMaterialInput = {
	color?: SceneMaterialInstance['overrides'] extends infer O ? (O extends { color?: infer C } ? C : never) : never;
	roughness?: number;
	metalness?: number;
	maps?: Record<string, string>;
	mapping?: { tileMeters?: [number, number]; rotation?: number; offset?: [number, number] };
};

function material(id: string, input: LegacyMaterialInput): SceneMaterialInstance {
	const { color, roughness, metalness, maps, mapping } = input;
	const overrides: Record<string, unknown> = {};
	if (color !== undefined) overrides.color = color;
	if (roughness !== undefined) overrides.roughness = roughness;
	if (metalness !== undefined) overrides.metalness = metalness;
	if (maps !== undefined) {
		overrides.maps = Object.fromEntries(
			Object.entries(maps).map(([role, textureId]) => [
				role,
				role === 'color' || role === 'normal'
					? { image: { textureId }, ...(role === 'normal' ? { convention: '+Y' } : {}) }
					: { image: { textureId }, component: 'r', invert: false }
			])
		);
	}
	if (mapping !== undefined) {
		overrides.mapping = {
			kind: 'target',
			metric: {
				tileMeters: mapping.tileMeters ?? [1, 1],
				rotation: mapping.rotation ?? 0,
				offset: mapping.offset ?? [0, 0]
			}
		};
	}
	return {
		id,
		name: id,
		base: { catalogue: 'plaster-warm' },
		...(Object.keys(overrides).length === 0 ? {} : { overrides: overrides as SceneMaterialInstance['overrides'] })
	};
}

function scene(materials: SceneMaterialInstance[], palette = PALETTE): CameraFreeSceneDocument {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials,
		entities: materials.map((entry) => ({
			kind: 'primitive',
			id: `box-${entry.id}`,
			name: entry.id,
			position: [0, 0, 0],
			rotation: [0, 0, 0],
			primitive: 'box',
			dimensions: { width: 1, height: 1, depth: 1 },
			materialId: 'plaster-warm',
			materialInstanceId: entry.id,
			castShadow: true,
			receiveShadow: true
		})) as CameraFreeSceneDocument['entities'],
		...(palette.length === 0 ? {} : { palette })
	};
}

function project(sceneData: CameraFreeSceneDocument): ProjectEnvelope {
	return {
		id: 'project-adopt',
		name: 'Adopt',
		units: { scene: { header: { contentRevision: 'scene-revision' }, data: sceneData } }
	} as unknown as ProjectEnvelope;
}

function snapshotOf(envelope: ProjectEnvelope): AcceptedSnapshot<ProjectEnvelope> {
	return {
		domain: { source: envelope },
		sourceKind: UNIT_SOURCE_KIND,
		sourceVersion: UNIT_SOURCE_VERSION
	} as unknown as AcceptedSnapshot<ProjectEnvelope>;
}

function adopt(input: CameraFreeSceneDocument, mapping: readonly { color: string; slotId: string; slotColor: string }[]) {
	const envelope = project(input);
	const intent: AuthoringIntent = {
		version: 1,
		kind: SCENE_PALETTE_ADOPT,
		operationId: 'adopt',
		expectedRevision: { projectId: envelope.id, revisionId: 'revision-1' },
		targets: [],
		payload: { mapping },
		capturedInputs: [],
		allocatedIds: []
	};
	const planner = createFinishPlanners().find((candidate) => candidate.kind === SCENE_PALETTE_ADOPT)!;
	return planner.prepare({
		snapshot: snapshotOf(envelope),
		intent,
		capturedInputs: [],
		allocatedIds: []
	});
}

describe('T2.S6 — planPaletteAdoption', () => {
	it('maps each literal to the nearest slot and counts its Finishes and objects', () => {
		const plan = planPaletteAdoption(
			scene([
				material('a', { color: '#ee6c4d' }),
				material('b', { color: '#ed6b4c' }),
				material('c', { color: '#2a3342' })
			])
		);
		expect(plan.rows).toEqual([
			{ color: '#ee6c4d', slotId: 'coral', slotName: 'Coral', slotColor: '#ee6c4d', finishes: 1, objects: 1 },
			{ color: '#ed6b4c', slotId: 'coral', slotName: 'Coral', slotColor: '#ee6c4d', finishes: 1, objects: 1 },
			{ color: '#2a3342', slotId: 'ink', slotName: 'Ink', slotColor: '#293241', finishes: 1, objects: 1 }
		]);
		expect(nearestSlot('#010101', PALETTE)?.id).toBe('ink');
	});

	it('groups equal literals and counts every Finish and object', () => {
		const plan = planPaletteAdoption(
			scene([material('a', { color: '#ee6c4d' }), material('b', { color: '#ee6c4d' })])
		);
		expect(plan.rows).toEqual([
			{ color: '#ee6c4d', slotId: 'coral', slotName: 'Coral', slotColor: '#ee6c4d', finishes: 2, objects: 2 }
		]);
	});

	it('skips image tints and inherited colours by count, and does nothing without a palette', () => {
		const image = planPaletteAdoption(
			scene([
				material('a', { color: '#ee6c4d', maps: { color: 'texture-1' } }),
				material('b', { color: { slot: 'coral' } })
			])
		);
		expect(image.rows).toEqual([]);
		expect(image.skipped).toEqual({ imageTints: 1, inherited: 1 });

		expect(planPaletteAdoption(scene([material('a', { color: '#ee6c4d' })], [])).slots).toBe(0);
	});
});

describe('T2.S6 — scene-palette-adopt', () => {
	it('moves every literal to a follower in one write and records it', () => {
		const before = scene([material('a', { color: '#ee6c4d' }), material('b', { color: { slot: 'ink' } })]);
		const outcome = adopt(before, [{ color: '#ee6c4d', slotId: 'coral', slotColor: '#ee6c4d' }]);
		expect(outcome.kind).toBe('prepared');
		if (outcome.kind !== 'prepared') return;
		expect(outcome.candidate.source.units.scene.data.materials).toEqual([
			{ ...before.materials[0], overrides: { ...before.materials[0]!.overrides, color: { slot: 'coral' } } },
			before.materials[1]
		]);
		expect(outcome.candidate.changes).toEqual([
			{ kind: SCENE_PALETTE_ADOPT, subjectIds: [], fields: ['materials'] }
		]);
	});

	it('refuses a stale literal, slot id or slot colour', () => {
		const before = scene([material('a', { color: '#ee6c4d' })]);
		expect(adopt(before, [{ color: '#123456', slotId: 'coral', slotColor: '#ee6c4d' }]))
			.toMatchObject({ kind: 'rejected', code: 'stale-adoption' });
		expect(adopt(before, [{ color: '#ee6c4d', slotId: 'missing', slotColor: '#ee6c4d' }]))
			.toMatchObject({ kind: 'rejected', code: 'unknown-slot' });
		expect(adopt(before, [{ color: '#ee6c4d', slotId: 'coral', slotColor: '#111111' }]))
			.toMatchObject({ kind: 'rejected', code: 'stale-adoption' });
		// A slot edit after the preview moves the slot colour, so the whole plan is stale.
		const edited = { ...before, palette: [{ ...PALETTE[0]!, color: '#ff0000' }, PALETTE[1]!] };
		expect(adopt(edited, [{ color: '#ee6c4d', slotId: 'coral', slotColor: '#ee6c4d' }]))
			.toMatchObject({ kind: 'rejected', code: 'stale-adoption' });
	});

	it('refuses a World with no palette and a mapping that changes nothing', () => {
		expect(adopt(scene([material('a', { color: '#ee6c4d' })], []), []))
			.toMatchObject({ kind: 'rejected', code: 'no-palette' });
		expect(adopt(scene([material('a', { color: { slot: 'coral' } })]), []))
			.toMatchObject({ kind: 'rejected', code: 'no-change' });
	});
});
