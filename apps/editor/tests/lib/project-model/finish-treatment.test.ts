/**
 * T2.S8 U4 — the Finish Card's treatment vocabulary.
 *
 * Colour modes (Natural / Stained / Painted, Painted equals a U3 coat), the D6
 * sheen steps over effective roughness, Swap carry-over, generated names and
 * the planner's naming rule (regenerate only while generated; a palette rename
 * follows). Presentation facts come from the real side table, so a drift
 * between it and F's evidence fails here.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SceneEntity, SceneMaterialInstance } from '@portfolio/project-model/scene';
import { SCENE_UNIT_FORMAT_VERSION, type ScenePaletteSlot } from '@portfolio/project-model/units';
import { catalogueRecipe, type FinishOverrides } from '@portfolio/project-model/materials';
import {
	coatColourOf,
	coatRecipe,
	colourModeEdits,
	createFinishPlanners,
	defaultColourMode,
	editsToward,
	finishColourMode,
	finishSheenReading,
	generatedFinishName,
	isGeneratedFinishName,
	planColourCoats,
	sheenStepEdits,
	swapEdits,
	swapOverrides,
	applyFinishPatch,
	SCENE_FINISH_PATCH,
	SCENE_FINISH_RENAME,
	SCENE_PALETTE_SLOT_RENAME,
	type FinishSource
} from '@portfolio/project-model/scene-planning';
import { getMaterial, materialById, materials } from '$lib/content/materials';
import { materialRoughnessMean, materialTreatmentFacts } from '$lib/content/material-presentation';
import type { MaterialId } from '$lib/types/materials';
import {
	admitUnitProject,
	createUnitCoordinator,
	createUnitProject,
	unitRevision
} from '../authoring/__fixtures__/unit-envelope-fixtures';

const label = (id: MaterialId) => (materialById.has(id) ? getMaterial(id).label : id);
const facts = materialTreatmentFacts(label);
const cat = (id: string): FinishSource => ({ base: { catalogue: id } });
const withOverrides = (id: string, overrides: FinishOverrides): FinishSource => ({ base: { catalogue: id }, overrides });
const apply = (source: FinishSource, edits: ReturnType<typeof colourModeEdits>) => {
	const result = applyFinishPatch(
		{ id: 'x', name: 'x', base: source.base, ...(source.overrides ? { overrides: source.overrides } : {}) },
		edits,
		catalogueRecipe((source.base as { catalogue: string }).catalogue)
	);
	if (!result.ok) throw new Error(JSON.stringify(result.problem));
	return result.instance;
};

describe('presentation facts', () => {
	it('match F’s qualified roughness means for every curated entry with a scanned roughness image', () => {
		const evidence = JSON.parse(
			readFileSync(
				new URL(
					'../../../../../docs/roadmap/t2-look-atmosphere/s8-professional-material-foundation/evidence/s8-f-catalogue.json',
					import.meta.url
				),
				'utf8'
			)
		) as { sets: { setId: string; measurements: { qualified: { roughnessMean: number } } }[] };
		const bySet = new Map(evidence.sets.map((set) => [set.setId, set.measurements.qualified.roughnessMean]));
		const setOf: Record<string, string> = {
			'concrete-polished': 'concrete-smooth',
			'leather-cognac': 'leather-smooth',
			'metal-stainless-satin': 'metal-satin',
			'metal-brass-satin': 'metal-satin',
			'metal-copper-satin': 'metal-satin',
			'metal-gold-satin': 'metal-satin',
			'metal-stainless-brushed': 'metal-brushed',
			'metal-aluminium-brushed': 'metal-brushed'
		};
		const curated = materials.filter((entry) => !(entry as { legacy?: boolean }).legacy && !(entry as { technical?: boolean }).technical);
		expect(curated.length).toBe(21);
		for (const entry of curated) {
			const expected = bySet.get(setOf[entry.id] ?? entry.id);
			expect(expected, entry.id).toBeDefined();
			expect(Math.abs((materialRoughnessMean[entry.id] ?? -1) - expected!), entry.id).toBeLessThanOrEqual(0.0005);
		}
	});
});

describe('colour modes', () => {
	it('classifies Natural, Stained and Painted from the overrides', () => {
		expect(finishColourMode(cat('wood-oak-veneer'))).toBe('natural');
		expect(finishColourMode(withOverrides('wood-oak-veneer', { color: '#8a9a7b' }))).toBe('stained');
		expect(finishColourMode(withOverrides('wood-oak-veneer', { color: '#8a9a7b', maps: { color: null } }))).toBe('painted');
		// A plain base: colour alone is Painted.
		expect(finishColourMode(withOverrides('metal-stainless-satin', { color: '#8a9a7b' }))).toBe('painted');
	});

	it('defaults a first colour to a stain on wood, stone, masonry, leather and textile, and to paint otherwise', () => {
		expect(defaultColourMode(cat('wood-oak-veneer'), undefined, facts)).toBe('stained');
		expect(defaultColourMode(cat('textile-linen'), undefined, facts)).toBe('stained');
		expect(defaultColourMode(cat('plaster-painted'), undefined, facts)).toBe('painted');
		expect(defaultColourMode(cat('metal-brass-satin'), undefined, facts)).toBe('painted');
	});

	it('Painted is exactly the U3 coat; Stained keeps the image; Natural restores it', () => {
		const oak = cat('wood-oak-veneer');
		const painted = apply(oak, colourModeEdits(oak, 'painted', { slot: 'sage' }));
		expect(painted.overrides).toEqual(coatRecipe(oak, { slot: 'sage' }).overrides);
		expect(coatColourOf(painted)).toEqual({ slot: 'sage' });

		const stained = apply(painted, colourModeEdits(painted, 'stained', '#8A9A7B'));
		expect(stained.overrides).toEqual({ color: '#8a9a7b' });
		expect(coatColourOf(stained)).toBeNull();

		expect(colourModeEdits(painted, 'natural', null)).toEqual([
			{ field: 'color', op: 'reset' },
			{ field: 'maps.color', op: 'reset' }
		]);
	});

	it('reads Stained as Painted on a plain base, writing the colour alone', () => {
		const steel = cat('metal-stainless-satin');
		expect(colourModeEdits(steel, 'stained', '#aabbcc')).toEqual([{ field: 'color', op: 'set', value: '#aabbcc' }]);
	});

	it('keeps every other override (sheen, mapping) through a mode change', () => {
		const source = withOverrides('wood-oak-veneer', { roughness: 0.5, color: '#112233' });
		expect(colourModeEdits(source, 'painted', '#112233')).toEqual([{ field: 'maps.color', op: 'disable' }]);
	});
});

describe('sheen (D6)', () => {
	it('reads three steps over factor × scanned mean, disabling steps rougher than the capture', () => {
		// Walnut Veneer is captured at 0.6458: Matte (0.8) would need a factor above 1.
		const reading = finishSheenReading(cat('wood-walnut-veneer'), undefined, facts);
		expect(reading.steps.map((step) => [step.id, step.disabled])).toEqual([
			['matte', true],
			['satin', false],
			['gloss', false]
		]);
		expect(reading.current).toBeNull(); // 0.6458 is Custom
		expect(reading.original).toBe('satin');
		expect(reading.originalExact).toBe(false);
		expect(reading.changed).toBe(false);
		expect(sheenStepEdits(reading, 'satin')).toEqual([{ field: 'roughness', op: 'set', value: 0.774 }]);
		expect(sheenStepEdits(reading, 'matte')).toEqual([]);
	});

	it('reads a value within 0.05 of a target as that step and resets when the base already reads as it', () => {
		// Polished concrete: factor 0.45 on 0.4947 ≈ 0.223, which reads as Gloss.
		const pristine = finishSheenReading(cat('concrete-polished'), undefined, facts);
		expect(pristine.current).toBe('gloss');
		expect(pristine.original).toBe('gloss');
		expect(pristine.originalExact).toBe(true);
		expect(sheenStepEdits(pristine, 'gloss')).toEqual([]);
		const satin = finishSheenReading(withOverrides('concrete-polished', { roughness: 1 }), undefined, facts);
		expect(satin.current).toBe('satin');
		expect(sheenStepEdits(satin, 'gloss')).toEqual([{ field: 'roughness', op: 'reset' }]);
	});

	it('has no reachable step on a capture glossier than Gloss, and places no dot', () => {
		const tile = finishSheenReading(cat('tile-ceramic-white'), undefined, facts);
		expect(tile.steps.every((step) => step.disabled)).toBe(true);
		expect(tile.original).toBeNull();
	});

	it('treats an uncharacterized roughness image as approximate and a base without one as exact on the factor', () => {
		expect(finishSheenReading(cat('plaster-warm'), undefined, facts).scan).toEqual({ mean: 1, approximate: true });
		const plain = finishSheenReading(cat('marble-light'), undefined, facts);
		expect(plain.scan).toEqual({ mean: 1, approximate: false });
		expect(plain.steps.every((step) => !step.disabled)).toBe(true);
	});
});

describe('swap', () => {
	it('carries the stain, the effective sheen and the direction; returns the pattern to real size', () => {
		const source = withOverrides('wood-oak-veneer', {
			color: { slot: 'sage' },
			roughness: 0.682, // Satin on Oak Veneer (0.5 / 0.7334)
			normalScale: 0.5,
			mapping: { kind: 'target', metric: { tileMeters: [1, 1], rotation: Math.PI / 2, offset: [0.25, 0] } }
		});
		expect(swapOverrides(source, { catalogue: 'wood-walnut-veneer' }, undefined, facts)).toEqual({
			color: { slot: 'sage' },
			roughness: 0.775, // the same effective 0.5 on Walnut's 0.6458
			mapping: { kind: 'target', metric: { tileMeters: [1, 1], rotation: Math.PI / 2, offset: [0, 0] } }
		});
	});

	it('turns a stain into paint on a plain base and paint stays paint', () => {
		const stained = withOverrides('wood-oak-veneer', { color: '#aabbcc' });
		expect(swapOverrides(stained, { catalogue: 'metal-brass-satin' })).toEqual({ color: '#aabbcc' });
		const painted = withOverrides('wood-oak-veneer', { color: '#aabbcc', maps: { color: null } });
		expect(swapOverrides(painted, { catalogue: 'stone-travertine' })).toEqual({ color: '#aabbcc', maps: { color: null } });
	});

	it('leaves nothing on an untreated Finish, so the result collapses to the curated entry', () => {
		expect(swapEdits(cat('wood-oak-veneer'), { catalogue: 'wood-walnut-veneer' })).toEqual([]);
		// Overrides tied to the old images go.
		expect(swapEdits(withOverrides('wood-oak-veneer', { normalScale: 0.3 }), { catalogue: 'wood-walnut-veneer' })).toEqual([
			{ field: 'normalScale', op: 'reset' }
		]);
	});
});

describe('editsToward', () => {
	it('distinguishes an absent map from a disabled one', () => {
		expect(editsToward({ maps: { color: null } }, {})).toEqual([{ field: 'maps.color', op: 'reset' }]);
		expect(editsToward({}, { maps: { color: null } })).toEqual([{ field: 'maps.color', op: 'disable' }]);
		expect(editsToward({ color: '#000000' }, { color: '#000000' })).toEqual([]);
	});
});

const PALETTE: ScenePaletteSlot[] = [{ id: 'sage', name: 'Sage', color: '#8a9a7b' }];

describe('generated names', () => {
	const context = { palette: PALETTE, facts };
	it('reads Material · colour[ stain] · sheen step, and a coat keeps the U3 name', () => {
		expect(generatedFinishName(withOverrides('wood-oak-veneer', { color: { slot: 'sage' } }), context)).toBe('Oak Veneer · Sage stain');
		expect(generatedFinishName(withOverrides('wood-oak-veneer', { color: { slot: 'sage' }, maps: { color: null } }), context)).toBe(
			'Oak Veneer · Sage'
		);
		expect(generatedFinishName(withOverrides('wood-walnut-veneer', { roughness: 0.774 }), context)).toBe('Walnut Veneer · Satin');
		expect(generatedFinishName(withOverrides('wood-walnut-veneer', { roughness: 0.9 }), context)).toBe('Walnut Veneer · Custom sheen');
		expect(generatedFinishName(withOverrides('metal-brass-satin', { color: '#aabbcc' }), context)).toBe('Satin Brass · #AABBCC');
	});

	it('counts the generated name and its numbered copies as generated, and a rename as not', () => {
		const source = withOverrides('wood-oak-veneer', { color: { slot: 'sage' } });
		expect(isGeneratedFinishName('Oak Veneer · Sage stain', source, context)).toBe(true);
		expect(isGeneratedFinishName('Oak Veneer · Sage stain 2', source, context)).toBe(true);
		expect(isGeneratedFinishName('Oak Veneer · Sage stain 1', source, context)).toBe(false);
		expect(isGeneratedFinishName('Lobby oak', source, context)).toBe(false);
	});

	it('names a coat over a project Finish with its sheen, as one generated name', () => {
		const scene = {
			entities: [],
			materials: [{ id: 'p', name: 'Walnut Veneer · Satin', base: { catalogue: 'wood-walnut-veneer' }, overrides: { roughness: 0.774 } }],
			palette: PALETTE
		} as never;
		const plan = planColourCoats(
			{ ...(scene as object), entities: [{ kind: 'primitive', id: 'a', materialId: 'wood-walnut-veneer', materialInstanceId: 'p' }] } as never,
			{ colour: { slot: 'sage' }, targets: [{ kind: 'entity', id: 'a' }], labelForMaterial: label, facts }
		);
		expect(plan).toMatchObject({ kind: 'planned', creates: [{ name: 'Walnut Veneer · Sage · Satin' }] });
	});
});

// ---------------------------------------------------------------------------
// The planner's naming rule

function box(id: string, materialId: string, instanceId?: string): SceneEntity {
	return {
		kind: 'primitive',
		id,
		name: id,
		position: [0, 0, 0],
		rotation: [0, 0, 0],
		primitive: 'box',
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId,
		castShadow: true,
		receiveShadow: true,
		...(instanceId === undefined ? {} : { materialInstanceId: instanceId })
	} as SceneEntity;
}

async function boot(input: { entities: SceneEntity[]; materials?: SceneMaterialInstance[]; palette?: ScenePaletteSlot[] }) {
	const project = await createUnitProject({
		id: 'project-u4',
		name: 'U4',
		scene: {
			formatVersion: SCENE_UNIT_FORMAT_VERSION,
			textures: [],
			materials: input.materials ?? [],
			entities: input.entities,
			...(input.palette === undefined ? {} : { palette: input.palette })
		}
	});
	const revision = unitRevision(project.id);
	const admitted = await admitUnitProject(project, revision);
	if (admitted.kind !== 'admitted') throw new Error(JSON.stringify(admitted.issues));
	return createUnitCoordinator({
		baseline: { revision, source: admitted.project, canonicalJson: admitted.canonicalJson, sourceContentId: admitted.sourceContentId },
		planners: createFinishPlanners({ labelForMaterial: label, treatmentFacts: facts }),
		mintRevisionId: (ordinal) => `revision-${ordinal + 1}`
	});
}

type Coordinator = Awaited<ReturnType<typeof boot>>;
let ordinal = 0;
function intent(coordinator: Coordinator, kind: string, payload: unknown, allocatedIds: { kind: string; id: string }[] = []): AuthoringIntent {
	return {
		version: 1,
		kind,
		operationId: `u4-${++ordinal}`,
		expectedRevision: coordinator.acceptedRevision(),
		targets: [],
		payload: payload as AuthoringIntent['payload'],
		capturedInputs: [],
		allocatedIds
	};
}
const materialsOf = (coordinator: Coordinator) => coordinator.current().source.units.scene.data.materials;

describe('the patch planner names Finishes by their treatment', () => {
	it('names a materialized Finish, regenerates it in place, and keeps a rename', async () => {
		const coordinator = await boot({ entities: [box('a', 'wood-walnut-veneer')], palette: PALETTE });
		const users = ['entity:a'];
		const satin = await coordinator.accept(intent(coordinator, SCENE_FINISH_PATCH, {
			finish: { curated: 'wood-walnut-veneer' }, mode: 'all', selectedUsers: users, expectedUsers: users,
			edits: [{ field: 'roughness', op: 'set', value: 0.774 }]
		}, [{ kind: 'scene-finish', id: 'w' }]));
		expect(satin.kind).toBe('accepted');
		expect(materialsOf(coordinator)).toMatchObject([{ id: 'w', name: 'Walnut Veneer · Satin' }]);

		await coordinator.accept(intent(coordinator, SCENE_FINISH_PATCH, {
			finish: { project: 'w' }, mode: 'in-place', selectedUsers: users, expectedUsers: users,
			edits: [{ field: 'color', op: 'set', value: { slot: 'sage' } }]
		}));
		expect(materialsOf(coordinator)[0]!.name).toBe('Walnut Veneer · Sage stain · Satin');

		expect((await coordinator.accept(intent(coordinator, SCENE_FINISH_RENAME, { finish: { project: 'w' }, name: 'Lobby walnut' }))).kind).toBe('accepted');
		await coordinator.accept(intent(coordinator, SCENE_FINISH_PATCH, {
			finish: { project: 'w' }, mode: 'in-place', selectedUsers: users, expectedUsers: users,
			edits: [{ field: 'roughness', op: 'reset' }]
		}));
		expect(materialsOf(coordinator)[0]!.name).toBe('Lobby walnut');
	});

	it('numbers a generated name another Finish already holds', async () => {
		const coordinator = await boot({
			entities: [box('a', 'wood-walnut-veneer', 'held'), box('b', 'wood-walnut-veneer')],
			materials: [{ id: 'held', name: 'Walnut Veneer · Satin', base: { catalogue: 'wood-walnut-veneer' }, overrides: { roughness: 0.774 } }]
		});
		await coordinator.accept(intent(coordinator, SCENE_FINISH_PATCH, {
			finish: { curated: 'wood-walnut-veneer' }, mode: 'all', selectedUsers: ['entity:b'], expectedUsers: ['entity:b'],
			edits: [{ field: 'roughness', op: 'set', value: 0.774 }]
		}, [{ kind: 'scene-finish', id: 'copy' }]));
		expect(materialsOf(coordinator).find((material) => material.id === 'copy')!.name).toBe('Walnut Veneer · Satin 2');
	});

	it('renames generated palette followers when their slot is renamed, never a renamed one', async () => {
		const coordinator = await boot({
			entities: [box('a', 'wood-oak-veneer', 'gen'), box('b', 'wood-oak-veneer', 'own')],
			materials: [
				{ id: 'gen', name: 'Oak Veneer · Sage stain', base: { catalogue: 'wood-oak-veneer' }, overrides: { color: { slot: 'sage' } } },
				{ id: 'own', name: 'Lobby oak', base: { catalogue: 'wood-oak-veneer' }, overrides: { color: { slot: 'sage' }, roughness: 0.4 } }
			],
			palette: PALETTE
		});
		const result = await coordinator.accept(intent(coordinator, SCENE_PALETTE_SLOT_RENAME, { slotId: 'sage', name: 'Moss' }));
		expect(result.kind).toBe('accepted');
		expect(materialsOf(coordinator).map((material) => material.name)).toEqual(['Oak Veneer · Moss stain', 'Lobby oak']);
		expect((await coordinator.undo()).kind).toBe('restored');
		expect(materialsOf(coordinator)[0]!.name).toBe('Oak Veneer · Sage stain');
	});
});
