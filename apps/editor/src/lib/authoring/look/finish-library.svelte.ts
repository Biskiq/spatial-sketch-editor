import type { SemanticReference } from '@portfolio/project-model/references';
import type {
	MaterialId,
	SceneEntity,
	SceneMaterialInstance,
	SceneSurfaceRef,
} from '@portfolio/project-model/scene';
import type { FinishPatchEdit, SceneFinishRef } from '@portfolio/project-model/scene-planning';
import {
	applyFinishPatch,
	baseRecipeOf,
	catalogueBaseOf,
	finishHasColourImage,
	finishKeyOfRef,
	finishSheenReading,
	inspectFinish,
	isPristineInstance,
	materialInstanceById,
	sheenStepEdits,
	usersOfFinish,
	type FinishInstancePreview,
} from '@portfolio/project-model/scene-planning';
import type { PaintDraftPick } from './paint-pick';
import {
	buildFinishEditorFields,
	mergeDraftEdits,
	type EditorFieldsView,
} from './finish-editor.svelte';
import type { FinishCard, FinishCardTarget } from './finish-card.svelte';
import { finishCardTargetKey } from './finish-card.svelte';
import { finishImageWarning } from './finish-image.svelte';
import { getMaterial, materialById, materials } from '$lib/content/materials';
import { materialFamilyOf, materialTreatmentFacts } from '$lib/content/material-presentation';
import { catalogueRecipe } from '@portfolio/project-model/materials';
import { libraryFamilyLabel, type LibraryFinishEntry } from '../library/library-catalogue';
import {
	libraryTargetOf,
	libraryTargetOfPick,
	type LibraryTarget,
} from '../library/library-target';
import {
	beginLibraryDraft,
	draftEntryOf,
	libraryDraftChanged,
	predictDerivedAssign,
	type LibraryDraft,
} from '../library/library-draft';
import { stageEnvelope, type StageAdapterServices } from '../stage/stage-adapter-host';
import {
	entityReference,
	newId,
	surfaceTargetComponent,
	surfaceTargetSubject,
	type FinishAcceptInput,
	type FinishAcceptOutcome,
	type FinishAuthoringHost,
	type LibraryDraftPick,
	type LibrarySwapRequest,
	type PaintableSurface,
} from './finish-authoring-contract';

type SceneNow = ReturnType<StageAdapterServices['stage']['snapshot']>['domain']['scene'];
type SurfaceTarget = SceneSurfaceRef;

export type FinishLibraryPorts = {
	readonly host: FinishAuthoringHost;
	readonly services: () => StageAdapterServices | null;
	readonly scene: () => SceneNow | null;
	readonly card: FinishCard;
	readonly busy: () => boolean;
	readonly setBusy: (value: boolean) => void;
	readonly favouriteMaterials: () => readonly string[];
	readonly labelOfKey: (key: string) => string;
	readonly noteUsed: (key: string) => void;
	readonly assign: (entityIds: readonly string[], ref: SceneFinishRef) => Promise<boolean>;
	readonly assignSurfaces: (
		surfaces: readonly SurfaceTarget[],
		ref: Exclude<SceneFinishRef, 'model-own'>,
	) => Promise<boolean>;
	readonly accept: (input: FinishAcceptInput) => Promise<FinishAcceptOutcome>;
	readonly entityOf: (entityId: string | null) => SceneEntity | null;
	readonly textureIdFor: (
		instance: SceneMaterialInstance | undefined,
		role: 'normal' | 'color' | 'roughness' | 'metalness' | 'occlusion',
	) => string | null;
	readonly colorOfKey: (key: string) => string;
	readonly definitionOf: (instance: SceneMaterialInstance) => { readonly metalness: number } | null;
	readonly pickMaterialKey: (key: string) => void;
	readonly armDraft: (draft: PaintDraftPick) => void;
};

export function createFinishLibraryAuthoring(ports: FinishLibraryPorts) {
	/** The Library's Customise… draft; view state only until Apply. */
	let libraryDraft = $state.raw<LibraryDraft | null>(null);
	/** The draft editor's own target: a Stage pick, kept apart from the canonical selection. */
	let libraryDraftPick = $state.raw<LibraryDraftPick | null>(null);
	/** The draft's last refusal, shown in place until the next edit or retarget. */
	let draftRefusal = $state<string | null>(null);

	const catalogueLabel = (id: MaterialId): string =>
		materialById.has(id) ? getMaterial(id).label : id;
	const treatmentFacts = materialTreatmentFacts(catalogueLabel);

	function libraryShelf(): {
		readonly curated: readonly {
			readonly id: MaterialId;
			readonly label: string;
			readonly color: string;
		}[];
		readonly project: readonly {
			readonly id: string;
			readonly name: string;
			readonly color: string;
			readonly imageUri: string | null;
			readonly warning: string | null;
		}[];
	} {
		const current = ports.scene();
		return {
			curated: materials.map((material) => ({
				id: material.id,
				label: material.label,
				color: material.swatchColor ?? material.fallbackColor,
			})),
			project: (current?.materials ?? [])
				.filter((instance) => !isPristineInstance(instance))
				.map((instance) => {
					const colorMapId = ports.textureIdFor(instance, 'color');
					const dimensions =
						colorMapId === null ? null : (ports.host.imageDimensions?.(colorMapId) ?? null);
					const textureRecordUri =
						colorMapId === null ? null : (ports.host.textureUri?.(colorMapId) ?? null);
					return {
						id: instance.id,
						name: instance.name,
						color: ports.colorOfKey(`project:${instance.id}`),
						imageUri:
							colorMapId === null
								? null
								: textureRecordUri !== null && textureRecordUri.startsWith('/project-assets/')
									? (ports.host.texturePreviewUri?.(colorMapId) ?? null)
									: textureRecordUri,
						warning:
							dimensions === null ? null : finishImageWarning(dimensions.width, dimensions.height),
					};
				}),
		};
	}

	function libraryTileLabel(tile: readonly [number, number]): string {
		const value = (number: number): string => `${Math.round(number * 100) / 100} m`;
		return tile[0] === tile[1] ? value(tile[0]) : `${value(tile[0])} × ${value(tile[1])}`;
	}

	function finishChangeCount(instance: SceneMaterialInstance): number {
		const overrides = instance.overrides;
		if (overrides === undefined) return 0;
		let count = 0;
		for (const field of [
			'color',
			'roughness',
			'metalness',
			'occlusionStrength',
			'normalScale',
			'mapping',
		] as const) {
			if (overrides[field] !== undefined) count += 1;
		}
		count += Object.values(overrides.maps ?? {}).filter((map) => map !== undefined).length;
		return count;
	}

	/**
	 * Everything the Library browses: 21 curated entries (20 D1 cards) and
	 * every named project Finish. It reads masters and preview names only; no
	 * texture URI and no full-resolution catalogue image is fetched here.
	 */
	function libraryBrowse(): readonly LibraryFinishEntry[] {
		const services = ports.services();
		const snapshot = services?.stage.snapshot();
		const current = snapshot?.domain.scene;
		if (snapshot === undefined || current === undefined) return [];
		const envelope = stageEnvelope(snapshot);
		const layout = envelope.units.layout.data;
		const recipes = (current.materialIndex?.definitions ?? new Map()) as ReadonlyMap<
			string,
			import('@portfolio/project-model/materials').Recipe
		>;
		const facts = materialTreatmentFacts(catalogueLabel);
		const favourite = new Set(ports.favouriteMaterials());
		const curated = materials.map((material): LibraryFinishEntry => {
			const key = `curated:${material.id}`;
			const source = { base: { catalogue: material.id } } as const;
			const reading = finishSheenReading(source, recipes, facts);
			const recipe = catalogueRecipe(material.id);
			const family = materialFamilyOf(material.id);
			const familyLabel = libraryFamilyLabel(family);
			const mapping = recipe?.mapping;
			const tile =
				mapping !== undefined && mapping.kind !== 'uv'
					? mapping.metric.tileMeters
					: (material.defaultTileSizeMeters ?? [1, 1]);
			const users = usersOfFinish(current, key, layout);
			return {
				key,
				source: 'curated',
				ref: { curated: material.id },
				name: material.label,
				materialLabel: material.label,
				family,
				familyLabel,
				subline: `${familyLabel} · ${libraryTileLabel(tile)}`,
				color: material.swatchColor ?? material.fallbackColor,
				imageUri: null,
				curatedId: material.id,
				projectId: null,
				favourite: favourite.has(key),
				usage: users.length,
				userKeys: users.map((user) =>
					user.kind === 'entity' ? `entity:${user.id}` : `surface:${user.key}`,
				),
				changes: 0,
				reading,
				sheen: reading.effective,
				metalness: recipe?.metalness ?? material.metalness,
				hasColourImage: finishHasColourImage(source, recipes),
				warning: null,
			};
		});
		const project = current.materials
			.filter((instance) => !isPristineInstance(instance))
			.map((instance): LibraryFinishEntry => {
				const key = `project:${instance.id}`;
				const ref = { project: instance.id } as const;
				const inspection = inspectFinish(envelope, ref, {
					labelForMaterial: (id) => catalogueLabel(id as MaterialId),
				});
				const users = inspection?.users ?? [];
				const definition = ports.definitionOf(instance);
				const baseId = catalogueBaseOf(instance);
				const base = baseId === null ? null : catalogueRecipe(baseId);
				const baseLabel =
					definition !== null
						? 'Imported material'
						: baseId !== null && materialById.has(baseId)
							? getMaterial(baseId).label
							: 'Imported material';
				const family = baseId === null ? null : materialFamilyOf(baseId);
				const changes = finishChangeCount(instance);
				const source = { base: instance.base, overrides: instance.overrides } as const;
				const reading = finishSheenReading(source, recipes, facts);
				const colorMapId = ports.textureIdFor(instance, 'color');
				const dimensions =
					colorMapId === null ? null : (ports.host.imageDimensions?.(colorMapId) ?? null);
				const textureRecordUri =
					colorMapId === null ? null : (ports.host.textureUri?.(colorMapId) ?? null);
				return {
					key,
					source: 'project',
					ref,
					name: instance.name,
					materialLabel: baseLabel,
					family,
					familyLabel: libraryFamilyLabel(family),
					subline:
						changes === 0
							? `from ${baseLabel}`
							: `from ${baseLabel} · ${changes} change${changes === 1 ? '' : 's'}`,
					color: ports.colorOfKey(key),
					/* Only the project's scoped preview; a catalogue map is never a Library picture. */
					imageUri:
						textureRecordUri !== null && textureRecordUri.startsWith('/project-assets/')
							? (ports.host.texturePreviewUri?.(colorMapId!) ?? null)
							: null,
					curatedId: null,
					projectId: instance.id,
					favourite: favourite.has(key),
					usage: users.length,
					userKeys: users.map((user) => user.key),
					changes,
					reading,
					sheen: reading.effective,
					metalness: instance.overrides?.metalness ?? definition?.metalness ?? base?.metalness ?? 0,
					hasColourImage: finishHasColourImage(source, recipes),
					warning:
						dimensions === null ? null : finishImageWarning(dimensions.width, dimensions.height),
				};
			});
		return [...project, ...curated];
	}

	/** The Finish target the current Stage selection names, or null. */
	function libraryTarget(): LibraryTarget | null {
		const services = ports.services();
		if (services === null) return null;
		const snapshot = services.stage.snapshot();
		return libraryTargetOf(services.stage.selectionState().primary, stageEnvelope(snapshot));
	}

	/** Apply a browsed Finish to the selected object or surface: one Undo, no Card. */
	async function applyLibraryFinish(ref: Exclude<SceneFinishRef, 'model-own'>): Promise<boolean> {
		const target = libraryTarget();
		if (target === null) {
			ports.host.onNotice('Select an object or surface first.');
			return false;
		}
		const key = finishKeyOfRef(ref);
		if (target.finishKey === key) {
			ports.host.onNotice(`${target.label} already wears ${ports.labelOfKey(key)}.`);
			return false;
		}
		if (target.kind === 'entity') {
			const accepted = await ports.assign([target.entityId], ref);
			if (!accepted) return false;
			ports.noteUsed(key);
			ports.host.onNotice(`Applied ${ports.labelOfKey(key)} to ${target.label}.`);
			return true;
		}
		const accepted = await ports.assignSurfaces([target.surface], ref);
		if (!accepted) return false;
		ports.noteUsed(key);
		ports.host.onNotice(`Applied ${ports.labelOfKey(key)} to ${target.label}.`);
		return true;
	}

	/**
	 * Open a Customise… draft. Draft state is view state: this call, every
	 * field change and every retarget write nothing. Apply is the one write.
	 * The draft target starts on the qualified selection and is never the
	 * canonical selection afterwards.
	 */
	function openLibraryDraft(ref: Exclude<SceneFinishRef, 'model-own'>): boolean {
		const key = finishKeyOfRef(ref);
		const entry = draftEntryOf(libraryBrowse().find((candidate) => candidate.key === key));
		if (entry === null) {
			ports.host.onNotice('That Finish is not in this project.');
			return false;
		}
		libraryDraft = beginLibraryDraft(entry);
		const target = libraryTarget();
		libraryDraftPick =
			target === null
				? null
				: target.kind === 'entity'
					? { kind: 'entity', entityId: target.entityId }
					: { kind: 'surface', surface: target.surface };
		draftRefusal = null;
		return true;
	}

	function setLibraryDraftStep(step: LibraryDraft['step']): void {
		if (libraryDraft === null) return;
		const entry = libraryBrowse().find((candidate) => candidate.key === libraryDraft!.finishKey);
		const reading = entry?.reading ?? libraryDraft.reading;
		const stepEdits = sheenStepEdits(reading, step);
		libraryDraft = {
			...libraryDraft,
			step,
			edits:
				stepEdits.length === 0
					? libraryDraft.edits.filter((e) => e.field !== 'roughness')
					: mergeDraftEdits(libraryDraft.edits, stepEdits),
		};
		draftRefusal = null;
	}

	function patchLibraryDraft(incoming: readonly FinishPatchEdit[]): void {
		if (libraryDraft === null || incoming.length === 0) return;
		libraryDraft = {
			...libraryDraft,
			edits: mergeDraftEdits(libraryDraft.edits, incoming),
		};
		draftRefusal = null;
	}

	function setLibraryDraftEdits(edits: readonly FinishPatchEdit[]): void {
		if (libraryDraft === null) return;
		libraryDraft = { ...libraryDraft, edits: [...edits] };
		draftRefusal = null;
	}

	/** Back to the Finish's own recipe: a local reset, no write. */
	function resetLibraryDraftStep(): void {
		if (libraryDraft === null) return;
		const entry = draftEntryOf(
			libraryBrowse().find((candidate) => candidate.key === libraryDraft!.finishKey),
		);
		libraryDraft = beginLibraryDraft(
			entry ?? {
				key: libraryDraft.finishKey,
				ref: libraryDraft.ref,
				name: libraryDraft.name,
				materialLabel: libraryDraft.baseLabel,
				source: libraryDraft.source,
				reading: libraryDraft.reading,
				userKeys: libraryDraft.users,
			},
		);
		draftRefusal = null;
	}

	function cancelLibraryDraft(): void {
		libraryDraft = null;
		libraryDraftPick = null;
		draftRefusal = null;
	}

	/** The draft's target, requalified against the accepted Scene now. */
	function libraryDraftTarget(): LibraryTarget | null {
		const pick = libraryDraftPick;
		const services = ports.services();
		if (pick === null || services === null) return null;
		return libraryTargetOfPick(pick, stageEnvelope(services.stage.snapshot()));
	}

	/**
	 * A Stage pick while the draft editor is open moves the cobalt proposal. An
	 * ineligible pick leaves the proposal where it was and says why.
	 */
	function retargetLibraryDraft(pick: LibraryDraftPick): boolean {
		const services = ports.services();
		if (libraryDraft === null || services === null) return false;
		const next = libraryTargetOfPick(pick, stageEnvelope(services.stage.snapshot()));
		if (next === null) {
			const kept = libraryDraftTarget();
			ports.host.onNotice(
				kept === null
					? 'That cannot take a Finish. Click a surface or object.'
					: `That cannot take a Finish. The preview stays on ${kept.label}.`,
			);
			return false;
		}
		libraryDraftPick = pick;
		draftRefusal = null;
		ports.host.onNotice(`Draft preview on ${next.label} · nothing is written`);
		return true;
	}

	function draftSourceInstance(draft: LibraryDraft): SceneMaterialInstance | null {
		const current = ports.scene();
		if (current === null) return null;
		return 'curated' in draft.ref
			? {
					id: `curated:${draft.ref.curated}`,
					name: draft.name,
					base: { catalogue: draft.ref.curated },
				}
			: (materialInstanceById(current.materials, draft.ref.project) ?? null);
	}

	/** What the draft would write, as a plan or a reason; no host call. */
	function draftPlanNow():
		| { readonly kind: 'assign'; readonly target: LibraryTarget }
		| {
				readonly kind: 'derive';
				readonly target: LibraryTarget;
				readonly allocates: boolean;
				readonly existingKey: string | null;
		  }
		| { readonly kind: 'refused'; readonly message: string } {
		const draft = libraryDraft;
		if (draft === null) return { kind: 'refused', message: 'No draft is open.' };
		const target = libraryDraftTarget();
		if (target === null)
			return { kind: 'refused', message: 'Click a surface or object to preview and apply.' };
		const current = ports.scene();
		const source = draftSourceInstance(draft);
		if (current === null || source === null)
			return { kind: 'refused', message: 'That Finish is no longer in this project.' };
		if (!libraryDraftChanged(draft)) {
			if (target.finishKey === draft.finishKey) {
				return {
					kind: 'refused',
					message: `${target.label} already wears ${draft.name}. Change a field or pick another surface.`,
				};
			}
			return { kind: 'assign', target };
		}
		const recipes = (current.materialIndex?.definitions ?? new Map()) as ReadonlyMap<
			string,
			import('@portfolio/project-model/materials').Recipe
		>;
		const includesModel =
			target.kind === 'entity' && ports.entityOf(target.entityId)?.kind === 'model';
		const prediction = predictDerivedAssign({
			materials: current.materials,
			sourceInstance: source,
			edits: draft.edits,
			recipes,
			includesModel,
		});
		if (!prediction.ok) {
			return { kind: 'refused', message: prediction.message };
		}
		if (prediction.existingKey !== null && target.finishKey === prediction.existingKey) {
			return { kind: 'refused', message: `${target.label} already wears this.` };
		}
		return {
			kind: 'derive',
			target,
			allocates: prediction.allocates,
			existingKey: prediction.existingKey,
		};
	}

	/** What Apply would do, for the editor footer; no host call. */
	function libraryDraftStatus(): {
		readonly active: boolean;
		readonly canApply: boolean;
		readonly changed: boolean;
		readonly targetLabel: string | null;
		readonly reason: string | null;
		readonly canPaint: boolean;
		readonly paintReason: string | null;
	} {
		const draft = libraryDraft;
		if (draft === null) {
			return {
				active: false,
				canApply: false,
				changed: false,
				targetLabel: null,
				reason: null,
				canPaint: false,
				paintReason: null,
			};
		}
		const target = libraryDraftTarget();
		const changed = libraryDraftChanged(draft);
		const plan = draftPlanNow();
		return {
			active: true,
			canApply: plan.kind !== 'refused' && !ports.busy(),
			changed,
			targetLabel: target?.label ?? null,
			reason: draftRefusal ?? (plan.kind === 'refused' ? plan.message : null),
			canPaint: !ports.busy(),
			paintReason: null,
		};
	}

	/**
	 * The render-only Stage projection of the draft on its target. Null when it
	 * cannot project (no target, unresolved Finish): the editor then says so.
	 */
	function libraryDraftPreview(): FinishInstancePreview | null {
		const draft = libraryDraft;
		const target = libraryDraftTarget();
		const current = ports.scene();
		if (draft === null || target === null || current === null) return null;
		const instance = draftSourceInstance(draft);
		if (instance === null) return null;
		const recipes = (current.materialIndex?.definitions ?? new Map()) as ReadonlyMap<
			string,
			import('@portfolio/project-model/materials').Recipe
		>;
		if (draft.edits.length === 0) {
			return target.finishKey === draft.finishKey ? null : { users: [target.key], instance };
		}
		const result = applyFinishPatch(instance, draft.edits, baseRecipeOf(instance, recipes));
		if (!result.ok) {
			return result.problem.code === 'no-change' ? { users: [target.key], instance } : null;
		}
		return { users: [target.key], instance: result.instance };
	}

	/**
	 * The draft's own Finish for inspection, independent of the target.
	 */
	function libraryDraftInstance():
		| { readonly ok: true; readonly changed: boolean; readonly instance: SceneMaterialInstance }
		| { readonly ok: false; readonly reason: string }
		| null {
		const draft = libraryDraft;
		const current = ports.scene();
		if (draft === null || current === null) return null;
		const instance = draftSourceInstance(draft);
		if (instance === null) {
			return { ok: false, reason: 'The Finish is no longer in the project.' };
		}
		const recipes = (current.materialIndex?.definitions ?? new Map()) as ReadonlyMap<
			string,
			import('@portfolio/project-model/materials').Recipe
		>;
		if (draft.edits.length === 0) return { ok: true, changed: false, instance };
		const result = applyFinishPatch(instance, draft.edits, baseRecipeOf(instance, recipes));
		if (!result.ok) {
			return result.problem.code === 'no-change'
				? { ok: true, changed: false, instance }
				: { ok: false, reason: result.problem.message };
		}
		return { ok: true, changed: true, instance: result.instance };
	}

	function libraryDraftFields(): EditorFieldsView | null {
		const draft = libraryDraft;
		const current = ports.scene();
		if (draft === null || current === null) return null;
		const resolved = libraryDraftInstance();
		if (resolved === null || !resolved.ok) return null;
		const target = libraryDraftTarget();
		const entityKind =
			target !== null && target.kind === 'entity'
				? ((ports.entityOf(target.entityId)?.kind as 'primitive' | 'form' | 'model' | undefined) ??
					null)
				: null;
		const recipes = (current.materialIndex?.definitions ?? new Map()) as ReadonlyMap<
			string,
			import('@portfolio/project-model/materials').Recipe
		>;
		return buildFinishEditorFields({
			source: { base: resolved.instance.base, overrides: resolved.instance.overrides },
			recipes,
			palette: current.palette ?? [],
			entityKind,
			facts: treatmentFacts,
			materialLabel: draft.baseLabel,
			curated: draft.source === 'curated',
		});
	}

	/**
	 * Apply the draft: one accepted assign, one Undo. An edited draft uses
	 * `derive: { edits, identity: 'reuse' }` on the named target only, never
	 * mutating any Finish definition or unrelated shared user.
	 */
	async function applyLibraryDraft(): Promise<boolean> {
		const draft = libraryDraft;
		if (draft === null || ports.busy()) return false;
		const plan = draftPlanNow();
		if (plan.kind === 'refused') {
			draftRefusal = plan.message;
			return false;
		}
		if (plan.kind === 'assign') {
			const target = plan.target;
			const accepted =
				target.kind === 'entity'
					? await ports.assign([target.entityId], draft.ref)
					: await ports.assignSurfaces([target.surface], draft.ref);
			if (!accepted) {
				draftRefusal = 'That change could not be made. Nothing changed.';
				return false;
			}
			ports.noteUsed(draft.finishKey);
			ports.host.onNotice(`Applied ${draft.name} to ${target.label} · one undo`);
			cancelLibraryDraft();
			return true;
		}
		const target = plan.target;
		const services = ports.services();
		if (services === null) {
			draftRefusal = 'The Stage is still opening.';
			return false;
		}
		const allocatedId = plan.allocates ? `finish:${crypto.randomUUID()}` : null;
		const snapshot = services.stage.snapshot();
		ports.setBusy(true);
		try {
			const isEntity = target.kind === 'entity';
			const intentTargets: SemanticReference[] = isEntity
				? [entityReference(services, target.entityId)]
				: [
						{
							version: 1,
							domain: 'layout',
							revision: { kind: 'exact', contentRevision: snapshot.domain.unitRevisions.layout },
							subject: surfaceTargetSubject(target.surface as PaintableSurface),
							instancePath: [],
							location: {
								kind: 'layout-location',
								levelId: snapshot.domain.layoutLevelId,
								structureInstancePath: [],
							},
							componentId: surfaceTargetComponent(target.surface as PaintableSurface),
							capabilityId: null,
						},
					];
			const outcome = await ports.accept({
				kind: isEntity ? 'scene-finish-assign' : 'scene-surface-finish-assign',
				payload: isEntity
					? {
							finish: draft.ref,
							entityIds: [target.entityId],
							derive: { edits: draft.edits, identity: 'reuse' },
						}
					: {
							finish: draft.ref,
							surfaces: [target.surface],
							derive: { edits: draft.edits, identity: 'reuse' },
						},
				targets: intentTargets,
				allocatedIds: allocatedId === null ? [] : [newId('scene-finish', allocatedId)],
			});
			if (outcome.kind !== 'accepted') {
				draftRefusal = 'That change could not be made. Nothing changed.';
				return false;
			}
			const resultingKey =
				plan.existingKey ?? (allocatedId !== null ? `project:${allocatedId}` : draft.finishKey);
			ports.noteUsed(resultingKey);
			ports.host.onNotice(`Applied ${draft.name} to ${target.label} · one undo`);
			cancelLibraryDraft();
			return true;
		} finally {
			ports.setBusy(false);
		}
	}

	/** *Use for Paint* from the draft: arms its existing Finish (unchanged) or a draft pick (edited). */
	function paintLibraryDraft(): boolean {
		const draft = libraryDraft;
		if (draft === null) return false;
		if (!libraryDraftChanged(draft)) {
			ports.pickMaterialKey(draft.finishKey);
			cancelLibraryDraft();
			return true;
		}
		ports.armDraft({ kind: 'draft', ref: draft.ref, edits: draft.edits, name: draft.name });
		ports.host.onNotice(`Paint · ${draft.name}`);
		cancelLibraryDraft();
		return true;
	}

	/**
	 * The Card's *Swap…* hand-off: the target, place and reach the Card showed,
	 * captured once. The Library shows it before activation; Apply requalifies it.
	 */
	let librarySwap = $state.raw<LibrarySwapRequest | null>(null);

	function requestLibrarySwap(target: FinishCardTarget, place: string): boolean {
		const view = ports.card.view(target, place);
		if (view === null || view.kind !== 'finish' || !view.material.swappable) {
			ports.host.onNotice('This surface has no material to swap.');
			return false;
		}
		librarySwap = {
			target,
			targetKey: finishCardTargetKey(target),
			place,
			finishName: view.name,
			materialLabel: view.material.label,
			currentId: view.material.catalogueId,
			reach: view.reach.options === null ? null : view.reach.choice,
			reachLine:
				view.reach.options === null
					? view.reach.line
					: view.reach.choice === 'all'
						? view.reach.options.allLabel
						: view.reach.options.thisLabel,
			users: view.reach.users,
		};
		if (ports.host.openLibrarySwap === undefined) {
			librarySwap = null;
			return false;
		}
		ports.host.openLibrarySwap();
		return true;
	}

	function clearLibrarySwap(): void {
		librarySwap = null;
	}

	/**
	 * Swap the captured target to a curated material through the Card's
	 * treatment-preserving command. A stale target or reach refuses in place.
	 */
	async function applyLibrarySwap(
		materialId: MaterialId,
	): Promise<{ readonly ok: true } | { readonly ok: false; readonly message: string }> {
		const request = librarySwap;
		if (request === null) return { ok: false, message: 'Open Swap from a Finish Card first.' };
		const view = ports.card.view(request.target, request.place);
		if (view === null || view.kind !== 'finish' || !view.material.swappable) {
			return { ok: false, message: `${request.place} can no longer be swapped. Nothing changed.` };
		}
		if (view.reach.users !== request.users) {
			return {
				ok: false,
				message: `Now used by ${view.reach.users} — reopen Swap from the Card. Nothing changed.`,
			};
		}
		if (view.material.catalogueId === materialId) {
			return { ok: false, message: `${request.place} is already ${view.material.label}.` };
		}
		if (request.reach !== null && view.reach.choice !== request.reach)
			ports.card.setReach(request.target, request.reach);
		ports.setBusy(true);
		try {
			const accepted = await ports.card.swap(request.target, materialId);
			if (!accepted) {
				return {
					ok: false,
					message:
						ports.card.refusalFor(request.target) ??
						'That swap could not be made. Nothing changed.',
				};
			}
			ports.host.onNotice(
				`Swapped ${request.place} to ${catalogueLabel(materialId)} — colour and sheen kept.`,
			);
			librarySwap = {
				...request,
				currentId: materialId,
				materialLabel: catalogueLabel(materialId),
			};
			return { ok: true };
		} finally {
			ports.setBusy(false);
		}
	}

	return {
		libraryShelf,
		libraryBrowse,
		libraryTarget,
		applyLibraryFinish,
		openLibraryDraft,
		setLibraryDraftStep,
		patchLibraryDraft,
		setLibraryDraftEdits,
		libraryDraftFields,
		cancelLibraryDraft,
		libraryDraftStatus,
		applyLibraryDraft,
		get draft() {
			return libraryDraft;
		},
		libraryDraftTarget,
		libraryDraftPreview,
		libraryDraftInstance,
		retargetLibraryDraft,
		resetLibraryDraftStep,
		paintLibraryDraft,
		get swap() {
			return librarySwap;
		},
		requestLibrarySwap,
		clearLibrarySwap,
		applyLibrarySwap,
	};
}
