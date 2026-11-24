/**
 * T2.S8 U4 — the Finish Card adapter over a real unit coordinator.
 *
 * Reach is decided before the edit (D2) and each completed control is exactly
 * one acceptance and one Undo: the reach table, D5's same-kind rule, a stale
 * reach that writes nothing, swap, rename, reset, and a preview that cancel
 * removes without a write.
 */
import { describe, expect, it } from 'vitest';
import type { SceneEntity, SceneMaterialInstance } from '@portfolio/project-model';
import { createEmptyWallFirstLayoutDocument, type LayoutSurfaceRef } from '@portfolio/layout-core';
import { SCENE_UNIT_FORMAT_VERSION, type ScenePaletteSlot } from '@portfolio/project-model/units';
import { createFinishPlanners } from '@portfolio/project-model/scene-planning';
import { createFinishCard, finishCardTargetKey, finishWritePlan, roleImageBinding, type FinishCardTarget } from '$lib/authoring/look/finish-card.svelte';
import { materialTreatmentFacts } from '$lib/content/material-presentation';
import { getMaterial, materialById } from '$lib/content/materials';
import type { MaterialId } from '$lib/types/materials';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { attachUnitStageSource } from '$lib/authoring/stage/unit-stage-source';
import {
	admitUnitProject,
	createUnitCoordinator,
	createUnitProject,
	unitRevision
} from '../__fixtures__/unit-envelope-fixtures';

const SAGE: ScenePaletteSlot = { id: 'slot-sage', name: 'Sage', color: '#8a9a7b' };
const label = (id: MaterialId): string => (materialById.has(id) ? getMaterial(id).label : id);
const facts = materialTreatmentFacts(label);

const LEFT: LayoutSurfaceRef = { kind: 'wall-side', wallId: 'wall', side: 'left' };
const RIGHT: LayoutSurfaceRef = { kind: 'wall-side', wallId: 'wall', side: 'right' };

function box(id: string, finish?: string): SceneEntity {
	return {
		kind: 'primitive', id, name: id, position: [0, 0, 0], rotation: [0, 0, 0], primitive: 'box',
		dimensions: { width: 1, height: 1, depth: 1 }, materialId: 'wood-walnut', castShadow: true, receiveShadow: true,
		...(finish === undefined ? {} : { materialInstanceId: finish })
	} as SceneEntity;
}

async function harness(input: {
	readonly entities: readonly SceneEntity[];
	readonly materials?: readonly SceneMaterialInstance[];
	readonly surfaces?: readonly { surface: LayoutSurfaceRef; finish: unknown }[];
}) {
	const layout = createEmptyWallFirstLayoutDocument();
	layout.junctions = [{ id: 'a', point: [0, 0] }, { id: 'b', point: [4, 0] }];
	layout.walls = [{ id: 'wall', startJunctionId: 'a', endJunctionId: 'b', thickness: 0.2, height: 3, centerline: { kind: 'line' } }];
	const project = await createUnitProject({
		id: 'project-card', name: 'Card', layout,
		scene: {
			formatVersion: SCENE_UNIT_FORMAT_VERSION, textures: [], materials: [...(input.materials ?? [])],
			entities: [...input.entities], palette: [SAGE],
			...(input.surfaces === undefined ? {} : { surfaceFinishes: input.surfaces as never })
		}
	});
	const revision = unitRevision(project.id);
	const admitted = await admitUnitProject(project, revision);
	if (admitted.kind !== 'admitted') throw new Error(`fixture not admitted: ${admitted.message}`);
	const coordinator = await createUnitCoordinator({
		baseline: { revision, source: admitted.project, canonicalJson: admitted.canonicalJson, sourceContentId: admitted.sourceContentId },
		planners: createFinishPlanners({
			labelForMaterial: label,
			treatmentFacts: facts,
			// Host geometry analysis stand-in: every user draws one metric UV set.
			targetAnalysis: (requests) => requests.map((request) => ({
				subject: request.subject,
				geometryRevision: request.expectedGeometryRevision,
				metricBasis: { uvMeters: [1, 1], surfaceMeters: [1, 1] },
				draws: [{ drawKey: request.subject, uvSets: [0], normalFrameSets: [0] }]
			})) as never
		}),
		mintRevisionId: (ordinal) => `revision-${ordinal + 1}`
	});
	const accepted: string[] = [];
	/** A one-shot refusal the next accept returns instead of writing (a race stand-in). */
	const race: { next: { code: string; reason?: string | null; message: string } | null } = { next: null };
	const services = {
		stage: {
			snapshot: () => {
				const source = coordinator.current().source;
				return attachUnitStageSource({
					...admitted.snapshot,
					acceptedRevision: coordinator.acceptedRevision(),
					domain: {
						...admitted.snapshot.domain,
						scene: source.units.scene.data,
						unitRevisions: { ...admitted.snapshot.domain.unitRevisions, scene: source.units.scene.header.contentRevision, layout: source.units.layout.header.contentRevision }
					}
				} as never, source);
			}
		},
		authoring: {
			accept: async (intent: Parameters<typeof coordinator.accept>[0]) => {
				if (race.next !== null) {
					const refusal = race.next;
					race.next = null;
					return { kind: 'refused' as const, code: refusal.code, reason: refusal.reason ?? null, message: refusal.message };
				}
				const result = await coordinator.accept(intent);
				if (result.kind === 'accepted') accepted.push(intent.kind);
				return result.kind === 'accepted'
					? { kind: 'installed' as const }
					: { kind: 'refused' as const, code: (result as { code?: string }).code, reason: (result as { reason?: string | null }).reason ?? null, message: (result as { message?: string }).message ?? '' };
			}
		}
	} as unknown as StageAdapterServices;
	const card = createFinishCard({ services: () => services, labelForMaterial: label, facts });
	const scene = () => coordinator.current().source.units.scene.data;
	return { coordinator, card, accepted, scene, race };
}

const entity = (entityId: string): FinishCardTarget => ({ kind: 'entity', entityId });
const surface = (ref: LayoutSurfaceRef): FinishCardTarget => ({ kind: 'surface', surface: ref });

function finishOfEntity(scene: { entities: readonly SceneEntity[] }, id: string): string | undefined {
	return (scene.entities.find((candidate) => candidate.id === id) as { materialInstanceId?: string } | undefined)?.materialInstanceId;
}

describe('the reach table (pure)', () => {
	it('maps every row of the table, including D5', () => {
		const one = { users: ['entity:a'], targetKey: 'entity:a' };
		expect(finishWritePlan({ ...one, curated: true }, 'this')).toMatchObject({ mode: 'all', allocates: true });
		expect(finishWritePlan({ ...one, curated: false }, 'this')).toMatchObject({ mode: 'in-place', allocates: false });
		const many = { users: ['entity:a', 'entity:b'], targetKey: 'entity:a' };
		expect(finishWritePlan({ ...many, curated: true }, 'this')).toMatchObject({ mode: 'just-this', selectedUsers: ['entity:a'] });
		expect(finishWritePlan({ ...many, curated: true }, 'all')).toMatchObject({ mode: 'all', selectedUsers: many.users });
		expect(finishWritePlan({ ...many, curated: false }, 'all')).toMatchObject({ mode: 'all', allocates: false });
		expect(finishWritePlan({ ...many, curated: false }, 'this')).toMatchObject({ mode: 'just-this', allocates: true });
		// D5: a curated All reaches the target's own kind only.
		const mixed = { users: ['entity:t', 'surface:w1', 'surface:w2'], targetKey: 'surface:w1', curated: true };
		expect(finishWritePlan(mixed, 'all')).toMatchObject({ mode: 'just-this', selectedUsers: ['surface:w1', 'surface:w2'] });
	});
});

describe('T2.S8 U4 — Finish Card adapter', () => {
	it('shows a curated shared Finish as This by default and Satin changes only the target, one Undo', async () => {
		const { card, accepted, scene, coordinator } = await harness({ entities: [box('a'), box('b')] });
		const view = card.view(entity('a'), 'a');
		expect(view?.kind).toBe('finish');
		if (view?.kind !== 'finish') return;
		expect(view.curated).toBe(true);
		expect(view.reach.choice).toBe('this');
		expect(view.reach.users).toBe(2);
		// The prototype's meta line and Material sub-line (`finish.js`, `ui-card.js`).
		expect(view.meta).toBe('Curated material · your first change makes a Finish');
		expect(view.material.sub).toMatch(/ · Curated$/);
		expect(await card.setSheen(entity('a'), 'satin')).toBe(true);
		expect(accepted).toEqual(['scene-finish-patch']);
		const materials = scene().materials;
		expect(materials).toHaveLength(1);
		expect(materials[0]!.name).toContain('Satin');
		expect(finishOfEntity(scene(), 'a')).toBe(materials[0]!.id);
		expect(finishOfEntity(scene(), 'b')).toBeUndefined();
		expect((await coordinator.undo()).kind).toBe('restored');
		expect(scene().materials).toEqual([]);
	});

	it('edits a shared project Finish in place for All and copies it for This', async () => {
		const shared: SceneMaterialInstance = { id: 'oak', name: 'Walnut Veneer · Sage', base: { catalogue: 'wood-walnut' }, overrides: { color: { slot: SAGE.id } } };
		const { card, accepted, scene } = await harness({ entities: [box('a', 'oak'), box('b', 'oak'), box('c', 'oak')], materials: [shared] });
		const view = card.view(entity('a'), 'a');
		if (view?.kind !== 'finish') throw new Error('expected a Finish');
		expect(view.reach.choice).toBe('all');
		expect(view.meta).toBe('Project Finish · from Walnut Wood');
		expect(view.material.sub).toBe('Wood · Curated');
		expect(card.proposals(entity('a')).entityIds).toEqual(['b', 'c']);
		card.focus(entity('a'));
		expect(card.proposalEntries().map((entry) => entry.reference.subject.id)).toEqual(['b', 'c']);
		expect(await card.setSheen(entity('a'), 'gloss')).toBe(true);
		expect(scene().materials).toHaveLength(1);
		expect(scene().materials[0]!.id).toBe('oak');
		card.setReach(entity('a'), 'this');
		expect(card.proposals(entity('a')).entityIds).toEqual([]);
		// Pattern changes sampling and needs host target analysis; Metal does not.
		expect(await card.setMetal(entity('a'), true)).toBe(true);
		expect(accepted).toEqual(['scene-finish-patch', 'scene-finish-patch']);
		expect(scene().materials).toHaveLength(2);
		expect(finishOfEntity(scene(), 'a')).not.toBe('oak');
		expect(finishOfEntity(scene(), 'b')).toBe('oak');
	});

	it('D5: All on a curated Finish opened from a wall reaches the walls only and notes the object', async () => {
		const { card, scene } = await harness({
			entities: [box('table')],
			surfaces: [
				{ surface: LEFT, finish: { materialId: 'wood-walnut' } },
				{ surface: RIGHT, finish: { materialId: 'wood-walnut' } }
			]
		});
		const view = card.view(surface(LEFT), 'wall · left');
		if (view?.kind !== 'finish') throw new Error('expected a Finish');
		expect(view.reach.users).toBe(3);
		card.setReach(surface(LEFT), 'all');
		const after = card.view(surface(LEFT), 'wall · left');
		if (after?.kind !== 'finish') throw new Error('expected a Finish');
		expect(after.reach.keepNote).toMatch(/1 object keeps/);
		expect(await card.setSheen(surface(LEFT), 'satin')).toBe(true);
		const created = scene().materials;
		expect(created).toHaveLength(1);
		const assigned = (scene().surfaceFinishes ?? []).map((entry) => (entry.finish as { materialInstanceId?: string }).materialInstanceId);
		expect(assigned).toEqual([created[0]!.id, created[0]!.id]);
		expect(finishOfEntity(scene(), 'table')).toBeUndefined();
	});

	it('refuses a stale reach in place, resets the reach and writes nothing', async () => {
		const shared: SceneMaterialInstance = { id: 'oak', name: 'Oak', base: { catalogue: 'wood-walnut' }, overrides: { roughness: 0.9 } };
		const fx = await harness({ entities: [box('a', 'oak'), box('b', 'oak')], materials: [shared] });
		fx.card.setReach(entity('a'), 'this');
		fx.race.next = { code: 'planner-rejected', reason: 'stale-reach', message: 'The Finish users changed.' };
		expect(await fx.card.setSheen(entity('a'), 'gloss')).toBe(false);
		expect(fx.accepted).toEqual([]);
		expect(fx.card.refusalFor(entity('a'))).toMatch(/Now used by 2 — reach updated\. Nothing changed\./);
		const view = fx.card.view(entity('a'), 'a');
		if (view?.kind !== 'finish') throw new Error('expected a Finish');
		expect(view.reach.choice).toBe('all');
		expect(fx.scene().materials).toEqual([shared]);
	});

	it('asks the edited surface to stay open across the install, and keeps its More open', async () => {
		const fx = await harness({ entities: [box('a')] });
		const key = finishCardTargetKey(entity('a'));
		fx.card.setMoreOpen(key);
		expect(fx.card.requested).toBeNull();
		expect(await fx.card.setSheen(entity('a'), 'satin')).toBe(true);
		expect(fx.card.requested).toBe(key);
		expect(fx.card.moreOpenFor).toBe(key);
		fx.card.clearRequest();
		// A refused write installs nothing, so nothing asks to reopen.
		fx.race.next = { code: 'stale-revision', message: 'The project changed. Try again.' };
		expect(await fx.card.setSheen(entity('a'), 'gloss')).toBe(false);
		expect(fx.card.requested).toBeNull();
	});

	it('shows any other refusal in place', async () => {
		const fx = await harness({ entities: [box('a')] });
		fx.race.next = { code: 'stale-revision', message: 'The project changed. Try again.' };
		expect(await fx.card.setSheen(entity('a'), 'satin')).toBe(false);
		expect(fx.card.refusalFor(entity('a'))).toBe('The project changed. Try again.');
		expect(await fx.card.setSheen(entity('a'), 'satin')).toBe(true);
		expect(fx.card.refusalFor(entity('a'))).toBeNull();
	});

	it('paints Stained then Natural as one patch each', async () => {
		const { card, accepted, scene } = await harness({ entities: [box('a')] });
		expect(await card.setColour(entity('a'), { slot: SAGE.id })).toBe(true);
		const stained = card.view(entity('a'), 'a');
		if (stained?.kind !== 'finish') throw new Error('expected a Finish');
		expect(stained.colour.mode).toBe('stained');
		expect(stained.name).toContain('Sage stain');
		expect(await card.setColourMode(entity('a'), 'natural')).toBe(true);
		expect(accepted).toEqual(['scene-finish-patch', 'scene-finish-patch']);
		// Natural with nothing else left collapses back to the curated normal form.
		expect(finishOfEntity(scene(), 'a') === undefined || scene().materials.every((material) => material.overrides?.color === undefined)).toBe(true);
	});

	it('swaps the base keeping the treatment, and renames a project Finish', async () => {
		const stain: SceneMaterialInstance = { id: 'oak', name: `${label('wood-walnut' as MaterialId)} · Sage stain`, base: { catalogue: 'wood-walnut' }, overrides: { color: { slot: SAGE.id } } };
		const { card, accepted, scene } = await harness({ entities: [box('a', 'oak')], materials: [stain] });
		const target = 'wood-oak-veneer' as MaterialId;
		expect(materialById.has(target)).toBe(true);
		expect(await card.swap(entity('a'), target)).toBe(true);
		const swapped = scene().materials.find((material) => material.id === 'oak')!;
		expect(swapped.base).toEqual({ catalogue: target });
		expect(swapped.overrides?.color).toEqual({ slot: SAGE.id });
		expect(swapped.name).toBe(`${label(target)} · Sage stain`);
		expect(await card.rename(entity('a'), 'Lobby oak')).toBe(true);
		expect(scene().materials.find((material) => material.id === 'oak')!.name).toBe('Lobby oak');
		expect(accepted.at(-1)).toBe('scene-finish-rename');
		expect(await card.setSheen(entity('a'), 'gloss')).toBe(true);
		expect(scene().materials.find((material) => material.id === 'oak')!.name).toBe('Lobby oak');
	});

	it('resets a surface-only project Finish to the curated normal form (no scope violation)', async () => {
		const stain: SceneMaterialInstance = { id: 'stain', name: 'Walnut Veneer · Sage stain', base: { catalogue: 'wood-walnut' }, overrides: { color: { slot: SAGE.id } } };
		const { card, accepted, scene } = await harness({
			entities: [],
			materials: [stain],
			surfaces: [{ surface: LEFT, finish: { materialInstanceId: 'stain' } }, { surface: RIGHT, finish: { materialInstanceId: 'stain' } }]
		});
		card.setReach(surface(LEFT), 'all');
		expect(await card.setColourMode(surface(LEFT), 'natural')).toBe(true);
		expect(accepted).toEqual(['scene-finish-patch']);
		expect(scene().materials).toEqual([]);
		expect(scene().surfaceFinishes?.map((entry) => entry.finish)).toEqual([{ materialId: 'wood-walnut' }, { materialId: 'wood-walnut' }]);
	});

	it('resets a primitive-only project Finish without leaving a pristine instance behind', async () => {
		const shared: SceneMaterialInstance = { id: 'oak', name: 'Walnut Veneer · Sage stain', base: { catalogue: 'wood-walnut' }, overrides: { color: { slot: SAGE.id } } };
		const { card, scene } = await harness({ entities: [box('a', 'oak'), box('b', 'oak')], materials: [shared] });
		expect(await card.setColourMode(entity('a'), 'natural')).toBe(true);
		expect(scene().materials).toEqual([]);
		expect(finishOfEntity(scene(), 'a')).toBeUndefined();
		expect(finishOfEntity(scene(), 'b')).toBeUndefined();
	});

	it('drops a preview dragged back to the accepted value', async () => {
		const shared: SceneMaterialInstance = { id: 'oak', name: 'Oak', base: { catalogue: 'wood-walnut' }, overrides: { roughness: 0.5 } };
		const { card, accepted } = await harness({ entities: [box('a', 'oak')], materials: [shared] });
		card.previewRoughness(entity('a'), 0.8);
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(card.gestureActive).toBe(true);
		const view = card.view(entity('a'), 'a');
		if (view?.kind !== 'finish') throw new Error('expected a Finish');
		card.previewRoughness(entity('a'), view.more.roughness);
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(card.preview).toBeNull();
		expect(card.gestureActive).toBe(false);
		expect(accepted).toEqual([]);
	});

	it('resets to the original in one patch', async () => {
		const shared: SceneMaterialInstance = { id: 'oak', name: 'Oak', base: { catalogue: 'wood-walnut' }, overrides: { roughness: 0.9, metalness: 1 } };
		const { card, accepted, scene } = await harness({ entities: [box('a', 'oak')], materials: [shared] });
		const view = card.view(entity('a'), 'a');
		if (view?.kind !== 'finish') throw new Error('expected a Finish');
		expect(view.resetCount).toBe(2);
		expect(await card.resetToOriginal(entity('a'))).toBe(true);
		expect(accepted).toEqual(['scene-finish-patch']);
		expect(scene().materials.find((material) => material.id === 'oak')?.overrides ?? {}).toEqual({});
	});

	it('previews on every reached user and cancel removes it without a write', async () => {
		const shared: SceneMaterialInstance = { id: 'oak', name: 'Oak', base: { catalogue: 'wood-walnut' } };
		const { card, accepted } = await harness({ entities: [box('a', 'oak'), box('b', 'oak')], materials: [shared] });
		card.focus(entity('a'));
		card.previewColour(entity('a'), '#ff0000');
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect(card.gestureActive).toBe(true);
		expect(card.cancel()).toBe(true);
		expect(card.preview).toBeNull();
		expect(card.gestureActive).toBe(false);
		expect(accepted).toEqual([]);
	});

	it('shows no Finish for an unpainted wall and nothing for a missing object', async () => {
		const { card } = await harness({ entities: [box('a')] });
		expect(card.view(surface(LEFT), 'wall')?.kind).toBe('none');
		expect(card.view(entity('missing'), 'x')).toBeNull();
	});
});

describe('T2.S8 U6 — role-aware Replace image…', () => {
	const HASH = `sha256-${'a'.repeat(64)}`;
	const ASSET = '00000000-0000-4000-8000-0000000000b1';
	const IMAGE = { assetId: ASSET, sha256: HASH, mime: 'image/png', byteSize: 1024, name: 'relief.png' } as const;

	it('binds each role in its own shape and keeps the existing mapping, convention and component', () => {
		const mapping = { kind: 'metric', size: [2, 2] } as never;
		const source = {
			base: { catalogue: 'wood-walnut' },
			overrides: {
				maps: {
					normal: { image: { textureId: 'old' }, convention: '-Y', mapping },
					roughness: { image: { textureId: 'old' }, component: 'a', invert: true }
				}
			}
		} as never;
		const recipes = new Map();
		expect(roleImageBinding(source, recipes, 'normal', 'tex-new')).toEqual({ image: { textureId: 'tex-new' }, convention: '-Y', mapping });
		expect(roleImageBinding(source, recipes, 'roughness', 'tex-new')).toEqual({ image: { textureId: 'tex-new' }, component: 'a', invert: true });
		// No binding yet: the role's defaults.
		expect(roleImageBinding(source, recipes, 'metalness', 'tex-new')).toEqual({ image: { textureId: 'tex-new' }, component: 'b', invert: false });
		expect(roleImageBinding(source, recipes, 'occlusion', 'tex-new')).toEqual({ image: { textureId: 'tex-new' }, component: 'r', invert: false });
		expect(roleImageBinding({ base: { catalogue: 'wood-walnut' } } as never, recipes, 'normal', 'tex-new')).toEqual({ image: { textureId: 'tex-new' }, convention: '+Y' });
		expect(roleImageBinding({ base: { catalogue: 'wood-walnut' } } as never, recipes, 'color', 'tex-new')).toEqual({ image: { textureId: 'tex-new' } });
	});

	it('replaces a non-colour role on a surface as one Finish patch that stages the image', async () => {
		const { card, accepted, scene } = await harness({
			entities: [],
			surfaces: [{ surface: LEFT, finish: { materialId: 'wood-walnut' } }]
		});
		expect(await card.replaceRoleImage(surface(LEFT), 'normal', IMAGE)).toBe(true);
		expect(accepted).toEqual(['scene-finish-patch']);
		const finish = scene().materials.find((material) => (material.overrides?.maps as Record<string, unknown> | undefined)?.normal !== undefined);
		expect((finish?.overrides?.maps as Record<string, { image: unknown }>).normal.image).toEqual({ textureId: ASSET });
		expect(scene().textures.map((texture) => texture.id)).toContain(ASSET);
	});
});
