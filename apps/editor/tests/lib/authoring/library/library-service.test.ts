/**
 * T2.S8 U5 — the Library service over a real unit coordinator.
 *
 * Selecting users writes nothing; Apply is exactly one assignment or one
 * `scene-finish-patch`, and Undo restores the project. A draft can be opened
 * and stepped with an empty history; its Apply is the single write, with the
 * Finish Card's in-place / just-this / all reach. A target wearing another
 * Finish refuses in place and preserves the draft.
 */
import { describe, expect, it } from 'vitest';
import type { SceneEntity, SceneMaterialInstance, SceneSurfaceRef, SemanticReference } from '@portfolio/project-model';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import { SCENE_UNIT_FORMAT_VERSION } from '@portfolio/project-model/units';
import { createFinishPlanners } from '@portfolio/project-model/scene-planning';
import { createFinishAuthoring } from '$lib/authoring/look/finish-authoring.svelte';
import { createMemoryPaintPreferences } from '$lib/authoring/look/paint-preferences';
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

const label = (id: MaterialId): string => (materialById.has(id) ? getMaterial(id).label : id);
const facts = materialTreatmentFacts(label);

function box(id: string, finish?: string): SceneEntity {
	return {
		kind: 'primitive',
		id,
		name: id,
		position: [0, 0, 0],
		rotation: [0, 0, 0],
		primitive: 'box',
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'wood-oak-veneer',
		castShadow: true,
		receiveShadow: true,
		...(finish === undefined ? {} : { materialInstanceId: finish })
	} as SceneEntity;
}

async function harness(input: {
	readonly entities: readonly SceneEntity[];
	readonly materials?: readonly SceneMaterialInstance[];
	readonly surfaces?: readonly { surface: SceneSurfaceRef; finish: unknown }[];
}) {
	const layout = createEmptyWallFirstLayoutDocument();
	layout.junctions = [
		{ id: 'a', point: [0, 0] },
		{ id: 'b', point: [4, 0] }
	];
	layout.walls = [
		{ id: 'wall', startJunctionId: 'a', endJunctionId: 'b', thickness: 0.2, height: 3, centerline: { kind: 'line' } }
	];
	const project = await createUnitProject({
		id: 'project-library',
		name: 'Library',
		layout,
		scene: {
			formatVersion: SCENE_UNIT_FORMAT_VERSION,
			textures: [],
			materials: [...(input.materials ?? [])],
			entities: [...input.entities],
			palette: [],
			...(input.surfaces === undefined ? {} : { surfaceFinishes: input.surfaces as never })
		}
	});
	const revision = unitRevision(project.id);
	const admitted = await admitUnitProject(project, revision);
	if (admitted.kind !== 'admitted') throw new Error(`fixture not admitted: ${admitted.message}`);
	const coordinator = await createUnitCoordinator({
		baseline: {
			revision,
			source: admitted.project,
			canonicalJson: admitted.canonicalJson,
			sourceContentId: admitted.sourceContentId
		},
		planners: createFinishPlanners({
			labelForMaterial: label,
			treatmentFacts: facts,
			targetAnalysis: (requests) =>
				requests.map((request) => ({
					subject: request.subject,
					geometryRevision: request.expectedGeometryRevision,
					metricBasis: { uvMeters: [1, 1], surfaceMeters: [1, 1] },
					draws: [{ drawKey: request.subject, uvSets: [0], normalFrameSets: [0] }]
				})) as never
		}),
		mintRevisionId: (ordinal) => `revision-${ordinal + 1}`
	});
	const accepted: string[] = [];
	const notices: string[] = [];
	let primary: SemanticReference | null = null;
	let ordered: { reference: SemanticReference }[] = [];
	const snapshot = () => {
		const source = coordinator.current().source;
		return attachUnitStageSource(
			{
				...admitted.snapshot,
				acceptedRevision: coordinator.acceptedRevision(),
				domain: {
					...admitted.snapshot.domain,
					scene: source.units.scene.data,
					unitRevisions: {
						...admitted.snapshot.domain.unitRevisions,
						scene: source.units.scene.header.contentRevision,
						layout: source.units.layout.header.contentRevision
					}
				}
			} as never,
			source
		);
	};
	const services = {
		stage: {
			snapshot,
			selectionState: () => ({ ordered, primary }),
			setSelection: (state: { ordered: { reference: SemanticReference }[]; primary: SemanticReference | null }) => {
				ordered = state.ordered;
				primary = state.primary;
				return { kind: 'selected' as const };
			}
		},
		authoring: {
			accept: async (intent: Parameters<typeof coordinator.accept>[0]) => {
				const result = await coordinator.accept(intent);
				if (result.kind === 'accepted') accepted.push(intent.kind);
				return result.kind === 'accepted'
					? { kind: 'installed' as const }
					: {
							kind: 'refused' as const,
							code: (result as { code?: string }).code,
							reason: (result as { reason?: string | null }).reason ?? null,
							message: (result as { message?: string }).message ?? ''
						};
			}
		}
	} as unknown as StageAdapterServices;
	const finishes = createFinishAuthoring({
		services: () => services,
		onNotice: (message) => notices.push(message),
		openFinishes: () => undefined,
		armPaint: () => undefined,
		openLibrarySwap: () => undefined,
		preferences: createMemoryPaintPreferences()
	});
	const scene = () => coordinator.current().source.units.scene.data;
	const entityReference = (id: string): SemanticReference => {
		const current = snapshot();
		return {
			version: 1,
			domain: 'scene',
			revision: { kind: 'exact', contentRevision: current.domain.unitRevisions.scene },
			subject: { kind: 'entity', id },
			instancePath: [],
			location: { kind: 'project-root' },
			componentId: null,
			capabilityId: null
		};
	};
	const selectEntity = (id: string): void => {
		primary = entityReference(id);
		ordered = [{ reference: primary }];
	};
	return { coordinator, finishes, accepted, notices, scene, selectEntity, selection: () => ({ ordered, primary }) };
}

describe('T2.S8 U5 — Library service', () => {
	it('browses 21 curated entries and selects every user without a write', async () => {
		const shared: SceneMaterialInstance = {
			id: 'oak',
			name: 'Lobby oak',
			base: { catalogue: 'wood-oak-veneer' },
			overrides: { roughness: 0.9 }
		};
		const fx = await harness({ entities: [box('a', 'oak'), box('b', 'oak')], materials: [shared] });
		const entries = fx.finishes.libraryBrowse();
		expect(entries.filter((entry) => entry.source === 'curated')).toHaveLength(21);
		expect(entries[0]).toMatchObject({
			key: 'project:oak',
			name: 'Lobby oak',
			usage: 2,
			userKeys: ['entity:a', 'entity:b']
		});
		fx.selectEntity('a');
		expect(fx.finishes.libraryTarget()).toMatchObject({ kind: 'entity', key: 'entity:a', label: 'a' });
		expect(await fx.finishes.selectFinishUsers({ project: 'oak' })).toBe(true);
		expect(fx.accepted).toEqual([]);
		expect(fx.selection().ordered).toHaveLength(2);
		expect(fx.selection().primary).toMatchObject({ subject: { kind: 'entity', id: 'a' } });
	});

	it('applies a browsed material to the selection as one assignment and one Undo', async () => {
		const fx = await harness({ entities: [box('a')] });
		fx.selectEntity('a');
		expect(await fx.finishes.applyLibraryFinish({ curated: 'wood-walnut-veneer' })).toBe(true);
		expect(fx.accepted).toEqual(['scene-finish-assign']);
		expect((fx.scene().entities[0] as { materialId?: string }).materialId).toBe('wood-walnut-veneer');
		expect((await fx.coordinator.undo()).kind).toBe('restored');
		expect((fx.scene().entities[0] as { materialId?: string }).materialId).toBe('wood-oak-veneer');
	});

	it('opens and steps a draft with no history, then applies one in-place patch', async () => {
		const shared: SceneMaterialInstance = {
			id: 'oak',
			name: 'Lobby oak',
			base: { catalogue: 'wood-oak-veneer' },
			overrides: { roughness: 0.9 }
		};
		const fx = await harness({ entities: [box('a', 'oak')], materials: [shared] });
		fx.selectEntity('a');
		expect(fx.finishes.libraryDraft).toBeNull();
		expect(fx.finishes.openLibraryDraft({ project: 'oak' })).toBe(true);
		fx.finishes.setLibraryDraftStep('gloss');
		expect(fx.accepted).toEqual([]);
		expect(fx.finishes.libraryDraft?.step).toBe('gloss');
		const status = fx.finishes.libraryDraftStatus();
		expect(status).toMatchObject({ active: true, canApply: true, changed: true, targetLabel: 'a' });
		expect(await fx.finishes.applyLibraryDraft()).toBe(true);
		expect(fx.accepted).toEqual(['scene-finish-patch']);
		expect(fx.finishes.libraryDraft).toBeNull();
		expect(fx.scene().materials[0]?.overrides?.roughness).toBeLessThan(0.9);
		expect((await fx.coordinator.undo()).kind).toBe('restored');
		expect(fx.scene().materials[0]?.overrides?.roughness).toBe(0.9);
	});

	it('copies just the selected user of a shared project Finish', async () => {
		const shared: SceneMaterialInstance = {
			id: 'oak',
			name: 'Lobby oak',
			base: { catalogue: 'wood-oak-veneer' },
			overrides: { roughness: 0.9 }
		};
		const fx = await harness({ entities: [box('a', 'oak'), box('b', 'oak')], materials: [shared] });
		fx.selectEntity('a');
		expect(fx.finishes.openLibraryDraft({ project: 'oak' })).toBe(true);
		fx.finishes.setLibraryDraftStep('gloss');
		expect(await fx.finishes.applyLibraryDraft()).toBe(true);
		expect(fx.accepted).toEqual(['scene-finish-patch']);
		expect(fx.scene().materials).toHaveLength(2);
		const created = fx.scene().materials.find((material) => material.id !== 'oak');
		expect((fx.scene().entities.find((entity) => entity.id === 'a') as { materialInstanceId?: string }).materialInstanceId).toBe(created?.id);
		expect((fx.scene().entities.find((entity) => entity.id === 'b') as { materialInstanceId?: string }).materialInstanceId).toBe('oak');
		expect((await fx.coordinator.undo()).kind).toBe('restored');
		expect(fx.scene().materials).toHaveLength(1);
		expect((fx.scene().entities.find((entity) => entity.id === 'a') as { materialInstanceId?: string }).materialInstanceId).toBe('oak');
	});

	it('materializes a curated draft for its user, then Undo returns the curated normal form', async () => {
		const fx = await harness({ entities: [box('a')] });
		fx.selectEntity('a');
		expect(fx.finishes.openLibraryDraft({ curated: 'wood-oak-veneer' })).toBe(true);
		fx.finishes.setLibraryDraftStep('gloss');
		expect(await fx.finishes.applyLibraryDraft()).toBe(true);
		expect(fx.accepted).toEqual(['scene-finish-patch']);
		expect(fx.scene().materials).toHaveLength(1);
		expect((fx.scene().entities[0] as { materialInstanceId?: string }).materialInstanceId).toBe(fx.scene().materials[0]?.id);
		expect((await fx.coordinator.undo()).kind).toBe('restored');
		expect(fx.scene().materials).toHaveLength(0);
		expect((fx.scene().entities[0] as { materialInstanceId?: string }).materialInstanceId).toBeUndefined();
	});

	it('refuses a draft on a target wearing another Finish and keeps the draft', async () => {
		const oak: SceneMaterialInstance = {
			id: 'oak',
			name: 'Oak',
			base: { catalogue: 'wood-oak-veneer' },
			overrides: { roughness: 0.9 }
		};
		const walnut: SceneMaterialInstance = {
			id: 'walnut',
			name: 'Walnut',
			base: { catalogue: 'wood-walnut-veneer' },
			overrides: { roughness: 0.9 }
		};
		const fx = await harness({
			entities: [box('a', 'oak'), box('b', 'walnut')],
			materials: [oak, walnut]
		});
		fx.selectEntity('b');
		expect(fx.finishes.openLibraryDraft({ project: 'oak' })).toBe(true);
		fx.finishes.setLibraryDraftStep('gloss');
		expect(fx.finishes.libraryDraftStatus()).toMatchObject({ canApply: false, changed: true });
		expect(await fx.finishes.applyLibraryDraft()).toBe(false);
		expect(fx.accepted).toEqual([]);
		expect(fx.finishes.libraryDraft?.finishKey).toBe('project:oak');
		expect(fx.finishes.libraryDraftStatus().reason).toMatch(/applies only where Oak is worn/);
	});

	it('assigns an unchanged draft to another target as one Undo', async () => {
		const oak: SceneMaterialInstance = { id: 'oak', name: 'Oak', base: { catalogue: 'wood-oak-veneer' }, overrides: { color: '#a07850' } } as SceneMaterialInstance;
		const walnut: SceneMaterialInstance = { id: 'walnut', name: 'Walnut', base: { catalogue: 'wood-walnut-veneer' }, overrides: { roughness: 0.9 } };
		const fx = await harness({ entities: [box('a', 'oak'), box('b', 'walnut')], materials: [oak, walnut] });
		fx.selectEntity('b');
		expect(fx.finishes.openLibraryDraft({ project: 'oak' })).toBe(true);
		expect(fx.finishes.libraryDraftStatus()).toMatchObject({ canApply: true, changed: false, canPaint: true });
		expect(fx.finishes.libraryDraftPreview()?.instance.id).toBe('oak');
		expect(await fx.finishes.applyLibraryDraft()).toBe(true);
		expect(fx.accepted).toHaveLength(1);
		expect((fx.scene().entities[1] as { materialInstanceId?: string }).materialInstanceId).toBe('oak');
		expect(fx.finishes.libraryDraft).toBeNull();
		expect((await fx.coordinator.undo()).kind).toBe('restored');
		expect((fx.scene().entities[1] as { materialInstanceId?: string }).materialInstanceId).toBe('walnut');
	});

	it('retargets the draft preview without touching the selection or writing', async () => {
		const oak: SceneMaterialInstance = { id: 'oak', name: 'Oak', base: { catalogue: 'wood-oak-veneer' }, overrides: { color: '#a07850' } } as SceneMaterialInstance;
		const fx = await harness({ entities: [box('a', 'oak'), box('b', 'oak')], materials: [oak] });
		fx.selectEntity('a');
		const before = fx.selection();
		expect(fx.finishes.openLibraryDraft({ project: 'oak' })).toBe(true);
		expect(fx.finishes.libraryDraftTarget()?.label).toBe('a');
		const moved = fx.finishes.retargetLibraryDraft({ kind: 'entity', entityId: 'b' });
		expect(moved).toBe(true);
		expect(fx.finishes.libraryDraftTarget()?.label).toBe('b');
		expect(fx.finishes.retargetLibraryDraft({ kind: 'entity', entityId: 'missing' })).toBe(false);
		expect(fx.finishes.libraryDraftTarget()?.label).toBe('b');
		expect(fx.selection()).toEqual(before);
		fx.finishes.setLibraryDraftStep('gloss');
		expect(fx.finishes.libraryDraftPreview()?.users).toEqual([fx.finishes.libraryDraftTarget()?.key]);
		expect(fx.finishes.paintLibraryDraft()).toBe(false);
		expect(fx.finishes.libraryDraftStatus().reason).toMatch(/no Paint path/);
		fx.finishes.resetLibraryDraftStep();
		expect(fx.finishes.paintLibraryDraft()).toBe(true);
		expect(fx.finishes.libraryDraft).toBeNull();
		expect(fx.accepted).toEqual([]);
	});

	it('swaps the Card target through the treatment-preserving command and refuses a stale reach', async () => {
		const oak: SceneMaterialInstance = { id: 'oak', name: 'Oak', base: { catalogue: 'wood-oak-veneer' }, overrides: { roughness: 0.9 } };
		const fx = await harness({ entities: [box('a', 'oak')], materials: [oak] });
		const target = { kind: 'entity' as const, entityId: 'a' };
		expect(fx.finishes.requestLibrarySwap(target, 'a')).toBe(true);
		expect(fx.finishes.librarySwap).toMatchObject({ place: 'a', currentId: 'wood-oak-veneer', users: 1 });
		expect(await fx.finishes.applyLibrarySwap('wood-oak-veneer')).toMatchObject({ ok: false });
		expect(fx.accepted).toEqual([]);
		expect(await fx.finishes.applyLibrarySwap('wood-walnut-veneer')).toEqual({ ok: true });
		expect(fx.accepted).toHaveLength(1);
		const finish = fx.scene().materials.find((material) => material.id === (fx.scene().entities[0] as { materialInstanceId?: string }).materialInstanceId);
		const worn = fx.scene().entities[0] as { materialId?: string };
		expect(finish?.base ?? { catalogue: worn.materialId }).toEqual({ catalogue: 'wood-walnut-veneer' });
		fx.finishes.clearLibrarySwap();
		expect(await fx.finishes.applyLibrarySwap('wood-oak-veneer')).toMatchObject({ ok: false });
	});
});
