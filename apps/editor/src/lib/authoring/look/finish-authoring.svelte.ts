/**
 * The Finish authoring service (T2.S4a).
 *
 * One service owns the creator's Finish intent outside the Scene document:
 *
 * - the **active** pick Paint applies (a Finish, or a colour through the
 *  colour-coat seam) and the creator's favourites and recents;
 * - the Finish Card adapter (U4, `finish-card.svelte.ts`), which shows reach
 *  before an edit and owns the Card's preview;
 * - the project palette's own writes and the From-image flow;
 * - the semantic **dropper**, which copies an authored Finish or colour rather
 *  than rendered pixels.
 *
 * Every write is one F.4 intent through the route's one acceptance host. The
 * service reads the live accepted snapshot each time, so the Card and the
 * planner compute the same reach.
 */
import {
	PALETTE_NAME_MAX_LENGTH,
	catalogueBaseOf,
	coatColourOf,
	finishRefOfKey,
	finishKeyOfRef,
	finishKeyOfSurface,
	inspectFinish,
	isFinishPaintable,
	isPristineInstance,
	materialInstanceById,
	nextFinishName,
	paletteHasRoom,
	type SceneFinishRef,
} from '@portfolio/project-model/scene-planning';
import type { AcceptedRevision, SemanticReference } from '@portfolio/project-model/references';
import type {
	MaterialId,
	SceneEntity,
	SceneMaterialInstance,
	SceneSurfaceRef,
} from '@portfolio/project-model/scene';
import { surfaceKey } from '@portfolio/layout-core/plan';
import {
	entityReference,
	newId,
	surfaceTargetComponent,
	surfaceTargetSubject,
	type FinishAcceptInput,
	type FinishAcceptOutcome,
	type FinishAuthoringHost,
	type FinishEntityView,
	type ImageWriteContext,
	type PaintTrayView,
	type PaintableSurface,
} from './finish-authoring-contract';

export type {
	FinishAuthoringHost,
	FinishEntityView,
	FinishPaletteView,
	LibraryDraftPick,
	LibrarySwapRequest,
	PaintColourPort,
	PaintSwatch,
	PaintTrayView,
	PaintableSurface,
} from './finish-authoring-contract';

import { getMaterial, materialById } from '$lib/content/materials';
import {
	colourKey,
	normaliseHex,
	toggleFavourite as toggleFavouriteKey,
	touchRecent,
	type PaintColour,
	type PaintDraftPick,
	type PaintPick,
} from './paint-pick';
import { createDevicePaintPreferences, type PaintPreferences } from './paint-preferences';
import { stageEnvelope, type StageAdapterServices } from '../stage/stage-adapter-host';
import {
	createFinishImageFlow,
	finishImagePin,
	type FinishImageFlow,
	type FinishImageOutcome,
	type FinishImageState,
} from './finish-image.svelte';
import type { ImportedProjectImage } from '../artwork/project-artwork';
import type { CoatReading } from './colour-coat-port';
import { createFinishCard, type FinishCard, type FinishCardTarget } from './finish-card.svelte';
import { createFinishEditor, type FinishEditor } from './finish-editor.svelte';
import { createFinishAlign, type FinishAlign } from './finish-align.svelte';
import { createFinishLibraryAuthoring } from './finish-library.svelte';
import {
	colourKeyResolves as colourKeyPresent,
	finishColour,
	finishDefinition,
	finishKeyResolves as finishKeyPresent,
	finishLabel,
	finishTextureId,
	paintColourLabel,
	readFinishEntity,
	readFinishPalette,
	readPaintTray,
} from './finish-readings';
import {
	createAppearanceIssues,
	repairSurfaceRef,
	type AppearanceIssue,
	type AppearanceIssueActionKind,
	type AppearanceIssuesService,
} from './appearance-issues.svelte';
import { materialTreatmentFacts } from '$lib/content/material-presentation';
import { selectionEntriesOfFinishUsers } from '../library/library-target';
import { predictDerivedAssign } from '../library/library-draft';

export function createFinishAuthoring(host: FinishAuthoringHost) {
	let activeKey = $state.raw<string | null>(null);
	let activeColour = $state.raw<PaintColour | null>(null);
	let activeDraft = $state.raw<PaintDraftPick | null>(null);
	const preferenceStore = host.preferences ?? createDevicePaintPreferences();
	let prefs = $state.raw<PaintPreferences>(preferenceStore.load());
	let dropper = $state(false);
	let busy = $state(false);
	/** The one From-image flow: upload states, cancellation and retry. */
	const imageFlow: FinishImageFlow = createFinishImageFlow({
		api: () => host.api?.() ?? null,
		projectId: () => host.projectId?.() ?? null,
		canEdit: () => host.canEdit?.() ?? true,
		isSaved: () => host.isSaved?.() ?? true,
		onNotice: (message) => host.onNotice(message),
	});

	const servicesNow = (): StageAdapterServices | null => host.services();

	function captureImageWrite(): ImageWriteContext | null {
		const services = servicesNow();
		if (services === null) return null;
		return { services, acceptedRevision: services.stage.snapshot().acceptedRevision };
	}

	function sameAcceptedRevision(left: AcceptedRevision, right: AcceptedRevision): boolean {
		return left.projectId === right.projectId && left.revisionId === right.revisionId;
	}

	/**
	 * An upload is project I/O, not a Scene write. If the Stage or the accepted
	 * revision changed while the bytes were in flight, the completion is stale
	 * and must not write into the replacement source.
	 */
	function imageWriteIsCurrent(context: ImageWriteContext): boolean {
		if (servicesNow() !== context.services) return false;
		return sameAcceptedRevision(
			context.services.stage.snapshot().acceptedRevision,
			context.acceptedRevision,
		);
	}

	function scene() {
		return servicesNow()?.stage.snapshot().domain.scene ?? null;
	}

	function entityOf(entityId: string | null): SceneEntity | null {
		if (entityId === null) return null;
		return scene()?.entities.find((entity) => entity.id === entityId) ?? null;
	}

	function paintabilityNotice(entity: SceneEntity | null): string {
		if (entity === null) return 'Select a Scene object first.';
		if (entity.kind === 'light') return 'Lights have no Finish.';
		if (entity.kind === 'artwork') return 'Artwork is not painted.';
		return 'That subject cannot be painted.';
	}

	/** Arm a Finish. Arming never writes and never touches the recents. */
	function activate(key: string): void {
		activeKey = key;
		activeColour = null;
		activeDraft = null;
	}

	function setPrefs(next: PaintPreferences): void {
		prefs = next;
		preferenceStore.save(next);
	}

	/** A write succeeded with this Finish: it joins the recents. */
	function noteUsed(key: string): void {
		if (key === 'model-own') return;
		setPrefs({ ...prefs, recentMaterials: touchRecent(prefs.recentMaterials, key) });
	}

	function noteUsedColour(colour: PaintColour): void {
		setPrefs({ ...prefs, recentColours: touchRecent(prefs.recentColours, colourKey(colour)) });
	}

	const labelOfKey = (key: string) => finishLabel(scene(), key);
	const definitionOf = (instance: SceneMaterialInstance | undefined) =>
		finishDefinition(scene(), instance);
	const textureIdFor = (
		instance: SceneMaterialInstance | undefined,
		role: Parameters<typeof finishTextureId>[2],
	) => finishTextureId(scene(), instance, role);
	const colorOfKey = (key: string) => finishColour(scene(), key);
	const paletteView = () => readFinishPalette(scene());
	const colourLabel = (colour: PaintColour) => paintColourLabel(scene(), colour);
	const finishKeyResolves = (key: string) => finishKeyPresent(scene(), key);
	const colourKeyResolves = (key: string) => colourKeyPresent(scene(), key);
	function viewFor(entityId: string): FinishEntityView | null {
		const snapshot = servicesNow()?.stage.snapshot();
		return snapshot === undefined ? null : readFinishEntity(snapshot, entityId, host);
	}

	function paintTray(): PaintTrayView {
		const shelf = library.libraryShelf();
		return readPaintTray(scene(), shelf, prefs, {
			activeKey,
			activeColour,
			colourEnabled: host.colourCoat !== undefined,
			dropper: dropper !== null,
		});
	}

	function selectionEntityId(): string | null {
		const services = servicesNow();
		const primary = services?.stage.selectionState().primary;
		return primary?.domain === 'scene' && primary.subject.kind === 'entity'
			? primary.subject.id
			: null;
	}

	function selectionEntity(): SceneEntity | null {
		return entityOf(selectionEntityId());
	}

	async function accept(
		input: FinishAcceptInput,
		context?: ImageWriteContext,
	): Promise<FinishAcceptOutcome> {
		const services = context?.services ?? servicesNow();
		if (services === null) return { kind: 'unavailable', message: 'The Stage is still opening.' };
		if (context !== undefined && !imageWriteIsCurrent(context)) return { kind: 'no-op' };
		const outcome = await services.authoring.accept({
			version: 1,
			kind: input.kind,
			operationId: crypto.randomUUID(),
			expectedRevision: context?.acceptedRevision ?? services.stage.snapshot().acceptedRevision,
			targets: input.targets ?? (input.entityIds ?? []).map((id) => entityReference(services, id)),
			payload: input.payload as never,
			capturedInputs: [],
			allocatedIds: input.allocatedIds ?? [],
		});
		if (
			outcome.kind === 'refused' &&
			outcome.code !== 'no-change' &&
			outcome.reason !== 'no-change'
		) {
			host.onNotice(outcome.message);
		}
		// The Stage reports a landed write as `installed`; every caller here asks
		// whether the write was accepted, so a landed write reads as `accepted`.
		return outcome.kind === 'installed' ? { ...outcome, kind: 'accepted' } : outcome;
	}

	/** One Finish assignment for one or more objects. */
	async function assign(entityIds: readonly string[], ref: SceneFinishRef): Promise<boolean> {
		const current = scene();
		if (current === null || entityIds.length === 0) return false;
		const targets = entityIds
			.map((id) => entityOf(id))
			.filter((entity): entity is SceneEntity => entity !== null);
		const notices = targets.filter((entity) => !isFinishPaintable(entity));
		const paintable = targets.filter(isFinishPaintable);
		if (paintable.length === 0) {
			host.onNotice(paintabilityNotice(targets[0] ?? null));
			return false;
		}
		if (ref === 'model-own' && paintable.some((entity) => entity.kind !== 'model')) {
			host.onNotice("Model's own can only be painted onto a model.");
			return false;
		}
		let allocations: { kind: string; id: string }[] = [];
		if (
			typeof ref === 'object' &&
			'curated' in ref &&
			paintable.some((entity) => entity.kind === 'model')
		) {
			const reusable = current.materials.some(
				(instance) => isPristineInstance(instance) && catalogueBaseOf(instance) === ref.curated,
			);
			if (!reusable) allocations = [newId('scene-finish', crypto.randomUUID())];
		}
		busy = true;
		try {
			const outcome = await accept({
				kind: 'scene-finish-assign',
				payload: { finish: ref, entityIds: paintable.map((entity) => entity.id) },
				entityIds: paintable.map((entity) => entity.id),
				allocatedIds: allocations,
			});
			if (outcome.kind === 'accepted') {
				if (notices.length > 0) {
					host.onNotice(
						`Painted ${paintable.length} object${paintable.length === 1 ? '' : 's'}; ` +
							`${notices.length} subject${notices.length === 1 ? ' is' : 's are'} not painted.`,
					);
				}
				return true;
			}
			return false;
		} finally {
			busy = false;
		}
	}

	/**
	 * A Library pick. With Paint armed, or with nothing selected, it arms Paint and
	 * writes nothing; otherwise it is a Replace of the selection's Finish.
	 */
	async function pickFinish(ref: SceneFinishRef): Promise<void> {
		const key =
			typeof ref === 'object' && 'curated' in ref
				? `curated:${ref.curated}`
				: typeof ref === 'object'
					? `project:${ref.project}`
					: 'model-own';
		const armed = host.isPaintArmed?.() ?? false;
		const selected = selectionEntity();
		if (selected === null || armed) {
			activate(key);
			if (!armed) host.armPaint({ kind: 'paint' });
			return;
		}
		if (!isFinishPaintable(selected)) {
			host.onNotice(paintabilityNotice(selected));
			return;
		}
		const assigned = await assign([selected.id], ref);
		if (assigned) {
			activate(key);
			noteUsed(key);
		}
	}

	/** A tray pick of a material: arm it. Never writes. */
	function pickMaterialKey(key: string): void {
		if (!finishKeyResolves(key)) {
			host.onNotice('That Finish is not in this project.');
			return;
		}
		dropper = false;
		activate(key);
	}

	/** A tray pick of a colour: arm it. Only when the colour-coat seam exists. */
	function pickColour(colour: PaintColour): void {
		if (host.colourCoat === undefined) return;
		if (colour.kind === 'literal') {
			const hex = normaliseHex(colour.hex);
			if (hex === null) return;
			activeColour = { kind: 'literal', hex };
		} else {
			if (!colourKeyResolves(colourKey(colour))) {
				host.onNotice('That palette colour is gone.');
				return;
			}
			activeColour = colour;
		}
		dropper = false;
		activeDraft = null;
		activeKey = null;
	}

	/** Star or unstar the active pick. */
	function toggleActiveFavourite(): void {
		const active =
			activeColour !== null
				? { kind: 'colour' as const, key: colourKey(activeColour) }
				: activeKey !== null && finishKeyResolves(activeKey)
					? { kind: 'finish' as const, key: activeKey }
					: null;
		if (active === null) return;
		setPrefs(
			active.kind === 'colour'
				? { ...prefs, favouriteColours: toggleFavouriteKey(prefs.favouriteColours, active.key) }
				: {
						...prefs,
						favouriteMaterials: toggleFavouriteKey(prefs.favouriteMaterials, active.key),
					},
		);
	}

	/** The one Scene write an imported image performs when replacing a Finish. */
	async function applyImageReplace(
		entityId: string,
		image: ImportedProjectImage,
		reach: number,
		mode: 'just-this' | 'all' | 'in-place',
		warning: string | null,
		context: ImageWriteContext,
	): Promise<FinishImageOutcome> {
		if (!imageWriteIsCurrent(context)) return { kind: 'no-op' };
		const view = viewFor(entityId);
		if (view === null || !view.editable) {
			return { kind: 'refused', message: "Model's own has no Finish to edit." };
		}
		const needsNew = view.ref !== 'model-own' && ('curated' in view.ref || mode === 'just-this');
		busy = true;
		try {
			const outcome = await accept(
				{
					kind: 'scene-finish-from-image',
					payload: {
						name: image.name,
						texture: { assetId: image.assetId, pin: finishImagePin(image) },
						entityIds: [],
						replaceFinishOf: { entityId, reach, mode },
					},
					entityIds: [entityId],
					allocatedIds: needsNew ? [newId('scene-finish', crypto.randomUUID())] : [],
				},
				context,
			);
			if (outcome.kind === 'accepted') {
				if (warning !== null) host.onNotice(warning);
				return { kind: 'accepted' };
			}
			if (outcome.kind === 'refused') {
				// Re-choosing the bytes already on this Finish is not a failure: the
				// asset was reused and the Scene already says exactly this.
				if (outcome.reason === 'no-change' || outcome.code === 'no-change') {
					host.onNotice('That image is already applied.');
					return { kind: 'no-op', message: 'That image is already applied.' };
				}
				return { kind: 'refused', message: outcome.message ?? 'The image could not be saved.' };
			}
			return { kind: 'no-op' };
		} finally {
			busy = false;
		}
	}

	/**
	 * Library › Finishes › + From image. With a selection the new Finish is
	 * assigned to it; with nothing selected the Finish is created and Paint arms
	 * with it, exactly as a Library pick does.
	 */
	function addFromImage(file: File): Promise<void> {
		const context = captureImageWrite();
		const selected = selectionEntity();
		if (context === null) {
			host.onNotice('The Stage is still opening.');
			return Promise.resolve();
		}
		if (selected !== null && !isFinishPaintable(selected)) {
			host.onNotice(paintabilityNotice(selected));
			return Promise.resolve();
		}
		return imageFlow
			.begin(file, async (image, warning, label) => {
				if (!imageWriteIsCurrent(context)) return { kind: 'no-op' };
				const current = context.services.stage.snapshot().domain.scene;
				const entityIds = selected === null ? [] : [selected.id];
				const finishId = crypto.randomUUID();
				// The planner bounds a Finish name at 120; keep the suffix inside it.
				const name = nextFinishName(label, current.materials).slice(0, 120);
				const outcome = await accept(
					{
						kind: 'scene-finish-from-image',
						payload: {
							name,
							texture: { assetId: image.assetId, pin: finishImagePin(image) },
							entityIds,
						},
						entityIds,
						allocatedIds: [newId('scene-finish', finishId)],
					},
					context,
				);
				if (outcome.kind === 'accepted') {
					activate(`project:${finishId}`);
					if (entityIds.length > 0) noteUsed(`project:${finishId}`);
					if (warning !== null) host.onNotice(warning);
					if (entityIds.length === 0) host.armPaint({ kind: 'paint' });
					return { kind: 'accepted' };
				}
				if (outcome.kind === 'refused') {
					return { kind: 'refused', message: outcome.message ?? 'The image could not be saved.' };
				}
				return { kind: 'no-op' };
			})
			.then(() => undefined);
	}

	function setPaletteSlotColor(slotId: string, color: string): Promise<void> {
		return accept({
			kind: 'scene-palette-slot-set',
			payload: { slotId, color },
		}).then(() => undefined);
	}

	function renamePaletteSlot(slotId: string, name: string): Promise<boolean> {
		const trimmed = name.trim();
		if (trimmed.length === 0 || trimmed.length > PALETTE_NAME_MAX_LENGTH) {
			host.onNotice(`A palette name must be 1 to ${PALETTE_NAME_MAX_LENGTH} characters.`);
			return Promise.resolve(false);
		}
		return accept({
			kind: 'scene-palette-slot-rename',
			payload: { slotId, name: trimmed },
		}).then((outcome) => outcome.kind === 'accepted' || outcome.code === 'no-change');
	}

	/** Paint › Edit palette's +: one new slot, nothing adopts it (one Undo). */
	async function addPaletteSlot(color: string): Promise<string | null> {
		if (!paletteHasRoom(scene()?.palette)) {
			host.onNotice('The palette already holds eight colours.');
			return null;
		}
		const slotId = crypto.randomUUID();
		const outcome = await accept({
			kind: 'scene-palette-slot-add',
			payload: { color },
			allocatedIds: [newId('scene-palette-slot', slotId)],
		});
		return outcome.kind === 'accepted' ? slotId : null;
	}

	function removePaletteSlot(slotId: string): Promise<void> {
		return accept({ kind: 'scene-palette-slot-remove', payload: { slotId } }).then(() => undefined);
	}

	/**
	 * Arm the semantic dropper. The Stage arms Paint in dropper mode; a click
	 * arms the copied Finish or coat colour and writes nothing.
	 */
	function armDropper(): void {
		dropper = true;
		host.armPaint({ kind: 'dropper' });
	}

	function cancelDropper(): void {
		dropper = false;
	}

	/** The dropper's one click: copy the target's Finish, or its authored colour. */
	async function copyFrom(target: { readonly sourceId: string } | string): Promise<boolean> {
		const targetId = typeof target === 'string' ? target : target.sourceId;
		// The draft editor borrows the dropper's pick: a click moves its proposal.
		if (library.draft !== null)
			return library.retargetLibraryDraft({ kind: 'entity', entityId: targetId });
		const view = viewFor(targetId);
		dropper = false;
		if (view === null) {
			host.onNotice('That has no Finish colour.');
			return false;
		}
		if (armCoatColour(view.instance)) return true;
		activate(view.key);
		host.onNotice(`Paint · ${view.label}`);
		return true;
	}

	/**
	 * The dropper over a coat arms its colour (a palette slot or a literal), as
	 * in the accepted design; anything else arms the Finish.
	 */
	function armCoatColour(instance: SceneMaterialInstance | null | undefined): boolean {
		if (host.colourCoat === undefined || instance === null || instance === undefined) return false;
		const recipes = scene()?.materialIndex?.definitions as
			| ReadonlyMap<string, import('@portfolio/project-model/materials').Recipe>
			| undefined;
		const colour = coatColourOf(instance, recipes);
		if (colour === null) return false;
		const pick: PaintColour =
			typeof colour === 'string'
				? { kind: 'literal', hex: colour }
				: { kind: 'slot', slotId: colour.slot };
		if (pick.kind === 'slot' && !colourKeyResolves(colourKey(pick))) return false;
		activeColour = pick;
		activeKey = null;
		activeDraft = null;
		host.onNotice(`Paint · ${colourLabel(pick)}`);
		return true;
	}

	/**
	 * Paint commits one acceptance for every object a stroke crossed. It never
	 * edits a Finish, so it never asks. Objects already wearing the pick are left
	 * out of the write; when none is left the answer is `already`.
	 */
	async function paintEntities(
		entityIds: readonly string[],
	): Promise<'accepted' | 'already' | 'refused'> {
		if (activeDraft !== null) {
			const draft = activeDraft;
			const current = scene();
			const services = servicesNow();
			if (current === null || services === null) return 'refused';
			const source: SceneMaterialInstance | null =
				'curated' in draft.ref
					? {
							id: `curated:${draft.ref.curated}`,
							name: draft.name,
							base: { catalogue: draft.ref.curated },
						}
					: (materialInstanceById(current.materials, draft.ref.project) ?? null);
			if (source === null) {
				host.onNotice('That Finish no longer exists.');
				return 'refused';
			}
			const views = entityIds
				.map((id) => viewFor(id))
				.filter((v): v is FinishEntityView => v !== null);
			if (views.length === 0) {
				host.onNotice(paintabilityNotice(entityOf(entityIds[0] ?? null)));
				return 'refused';
			}
			const recipes = (current.materialIndex?.definitions ?? new Map()) as ReadonlyMap<
				string,
				import('@portfolio/project-model/materials').Recipe
			>;
			const prediction = predictDerivedAssign({
				materials: current.materials,
				sourceInstance: source,
				edits: draft.edits,
				recipes,
				includesModel: views.some((v) => v.kind === 'model'),
			});
			if (!prediction.ok) {
				host.onNotice(prediction.message);
				return 'refused';
			}
			const fresh =
				prediction.existingKey === null
					? views
					: views.filter((v) => v.key !== prediction.existingKey);
			if (fresh.length === 0) {
				host.onNotice(`Already ${draft.name}`);
				return 'already';
			}
			const allocatedId = prediction.allocates ? `finish:${crypto.randomUUID()}` : null;
			const _snapshot = services.stage.snapshot();
			busy = true;
			try {
				const outcome = await accept({
					kind: 'scene-finish-assign',
					payload: {
						finish: draft.ref,
						entityIds: fresh.map((v) => v.entityId),
						derive: { edits: draft.edits, identity: 'reuse' },
					},
					targets: fresh.map((v) => entityReference(services, v.entityId)),
					allocatedIds: allocatedId === null ? [] : [newId('scene-finish', allocatedId)],
				});
				if (outcome.kind !== 'accepted') return 'refused';
				const resultingKey = prediction.existingKey ?? `project:${allocatedId}`;
				// Re-arm the resolved Finish so subsequent strokes reuse it without adding another.
				activeDraft = null;
				activeKey = resultingKey;
				noteUsed(resultingKey);
				return 'accepted';
			} finally {
				busy = false;
			}
		}
		if (activeColour !== null) {
			const port = host.colourCoat;
			if (port === undefined) return 'refused';
			if (port.isAlready?.({ entityIds, surfaces: [] }, activeColour) === true) return 'already';
			const painted = await port.paintEntities(entityIds, activeColour);
			if (painted) noteUsedColour(activeColour);
			return painted ? 'accepted' : 'refused';
		}
		if (activeKey === null) {
			host.onNotice('Choose a Finish first.');
			return 'refused';
		}
		const key = activeKey;
		const views = entityIds.map((id) => viewFor(id));
		if (views.every((view) => view === null)) {
			host.onNotice(paintabilityNotice(entityOf(entityIds[0] ?? null)));
			return 'refused';
		}
		const readable = views.filter((view): view is FinishEntityView => view !== null);
		const fresh = readable.filter((view) => view.key !== key);
		if (fresh.length === 0) {
			host.onNotice(`Already ${labelOfKey(key)}`);
			return 'already';
		}
		const targets = key === 'model-own' ? fresh.filter((view) => view.kind === 'model') : fresh;
		if (targets.length === 0) {
			host.onNotice("Model's own can only be painted onto a model.");
			return 'refused';
		}
		const ref = finishRefOfKey(key);
		if (ref === null) {
			host.onNotice('That Finish no longer exists.');
			return 'refused';
		}
		const accepted = await assign(
			targets.map((view) => view.entityId),
			ref,
		);
		if (accepted) noteUsed(key);
		return accepted ? 'accepted' : 'refused';
	}

	/** Paint one or more stable Layout surfaces in one Scene acceptance. */
	async function paintSurface(surfaces: readonly PaintableSurface[]): Promise<boolean> {
		if (activeDraft !== null) {
			const draft = activeDraft;
			const current = scene();
			const services = servicesNow();
			if (current === null || services === null || surfaces.length === 0) return false;
			const source: SceneMaterialInstance | null =
				'curated' in draft.ref
					? {
							id: `curated:${draft.ref.curated}`,
							name: draft.name,
							base: { catalogue: draft.ref.curated },
						}
					: (materialInstanceById(current.materials, draft.ref.project) ?? null);
			if (source === null) {
				host.onNotice('That Finish no longer exists.');
				return false;
			}
			const recipes = (current.materialIndex?.definitions ?? new Map()) as ReadonlyMap<
				string,
				import('@portfolio/project-model/materials').Recipe
			>;
			const prediction = predictDerivedAssign({
				materials: current.materials,
				sourceInstance: source,
				edits: draft.edits,
				recipes,
				includesModel: false,
			});
			if (!prediction.ok) {
				host.onNotice(prediction.message);
				return false;
			}
			const allocatedId = prediction.allocates ? `finish:${crypto.randomUUID()}` : null;
			const snapshot = services.stage.snapshot();
			const targets: SemanticReference[] = surfaces.map((surface) => ({
				version: 1,
				domain: 'layout',
				revision: { kind: 'exact', contentRevision: snapshot.domain.unitRevisions.layout },
				subject: surfaceTargetSubject(surface),
				instancePath: [],
				location: {
					kind: 'layout-location',
					levelId: snapshot.domain.layoutLevelId,
					structureInstancePath: [],
				},
				componentId: surfaceTargetComponent(surface),
				capabilityId: null,
			}));
			busy = true;
			try {
				const outcome = await accept({
					kind: 'scene-surface-finish-assign',
					payload: {
						finish: draft.ref,
						surfaces,
						derive: { edits: draft.edits, identity: 'reuse' },
					},
					targets,
					allocatedIds: allocatedId === null ? [] : [newId('scene-finish', allocatedId)],
				});
				if (outcome.kind !== 'accepted') return false;
				const resultingKey = prediction.existingKey ?? `project:${allocatedId}`;
				activeDraft = null;
				activeKey = resultingKey;
				noteUsed(resultingKey);
				return true;
			} finally {
				busy = false;
			}
		}
		if (activeColour !== null) {
			const port = host.colourCoat;
			if (port === undefined || surfaces.length === 0) return false;
			const painted = await port.paintSurfaces(surfaces, activeColour);
			if (painted) noteUsedColour(activeColour);
			return painted;
		}
		if (activeKey === null) {
			host.onNotice('Choose a Finish first.');
			return false;
		}
		if (
			surfaces.length === 0 ||
			surfaces.some((surface) => surface.kind === 'region-face' && surface.face === 'edge')
		) {
			host.onNotice('Paint needs one or more paintable surfaces.');
			return false;
		}
		if (activeKey === 'model-own') {
			host.onNotice("Model's own cannot be painted onto a Layout surface.");
			return false;
		}
		const ref = finishRefOfKey(activeKey);
		if (ref === null || ref === 'model-own') {
			host.onNotice('That Finish no longer exists.');
			return false;
		}
		const accepted = await assignSurfaces(surfaces, ref);
		if (accepted) noteUsed(activeKey);
		return accepted;
	}

	/** Assign one Finish to Layout surfaces: one acceptance, one Undo. */
	async function assignSurfaces(
		surfaces: readonly PaintableSurface[],
		ref: Exclude<SceneFinishRef, 'model-own'>,
	): Promise<boolean> {
		if (surfaces.length === 0) {
			host.onNotice('Paint needs one or more paintable surfaces.');
			return false;
		}
		const services = servicesNow();
		if (services === null) {
			host.onNotice('The Stage is still opening.');
			return false;
		}
		const snapshot = services.stage.snapshot();
		const targets: SemanticReference[] = surfaces.map((surface) => ({
			version: 1,
			domain: 'layout',
			revision: { kind: 'exact', contentRevision: snapshot.domain.unitRevisions.layout },
			subject: surfaceTargetSubject(surface),
			instancePath: [],
			location: {
				kind: 'layout-location',
				levelId: snapshot.domain.layoutLevelId,
				structureInstancePath: [],
			},
			componentId: surfaceTargetComponent(surface),
			capabilityId: null,
		}));
		busy = true;
		try {
			const outcome = await accept({
				kind: 'scene-surface-finish-assign',
				payload: { finish: ref, surfaces },
				targets,
			});
			return outcome.kind === 'accepted';
		} finally {
			busy = false;
		}
	}

	function activeSurfaceIsAlready(surfaces: readonly PaintableSurface[]): boolean {
		const current = scene();
		if (activeColour !== null) {
			return host.colourCoat?.isAlready?.({ entityIds: [], surfaces }, activeColour) ?? false;
		}
		if (current === null || activeKey === null || surfaces.length === 0) return false;
		const assignments = new Map(
			(current.surfaceFinishes ?? []).map((assignment) => [
				surfaceKey(assignment.surface),
				assignment,
			]),
		);
		return surfaces.every((surface) => {
			const assignment = assignments.get(surfaceKey(surface));
			return assignment !== undefined && finishKeyOfSurface(current, assignment) === activeKey;
		});
	}

	/** Copy the authored Finish from a Layout surface; an unpainted surface has nothing to copy. */
	async function copySurface(surface: PaintableSurface): Promise<boolean> {
		if (library.draft !== null)
			return library.retargetLibraryDraft({ kind: 'surface', surface: surface as SceneSurfaceRef });
		const current = scene();
		dropper = false;
		if (current === null) {
			host.onNotice('That has no Finish colour.');
			return false;
		}
		const assignment = current.surfaceFinishes?.find(
			(entry) => surfaceKey(entry.surface) === surfaceKey(surface),
		);
		if (assignment === undefined) {
			host.onNotice('That has no Finish colour.');
			return false;
		}
		const key = finishKeyOfSurface(current, assignment);
		if (
			'materialInstanceId' in assignment.finish &&
			armCoatColour(materialInstanceById(current.materials, assignment.finish.materialInstanceId))
		) {
			return true;
		}
		activate(key);
		host.onNotice(`Paint · ${labelOfKey(key)}`);
		return true;
	}

	/** The name of what a surface or object wears now (the consequence line); `null` when it has none. */
	function wornLabel(
		target: { readonly surface: PaintableSurface } | { readonly entityId: string },
	): string | null {
		if ('entityId' in target) return viewFor(target.entityId)?.label ?? null;
		const current = scene();
		const assignment = current?.surfaceFinishes?.find(
			(entry) => surfaceKey(entry.surface) === surfaceKey(target.surface),
		);
		return current === null || assignment === undefined
			? null
			: labelOfKey(finishKeyOfSurface(current, assignment));
	}

	/** What the active colour does to a target; `null` while the pick is a material. */
	function coatReading(
		target: { readonly surface: PaintableSurface } | { readonly entityId: string },
	): CoatReading | null {
		if (activeColour === null) return null;
		return host.colourCoat?.read?.(target) ?? null;
	}

	function isFavouriteMaterial(key: string): boolean {
		return prefs.favouriteMaterials.includes(key);
	}

	function toggleFavouriteMaterial(key: string): void {
		if (!finishKeyResolves(key)) return;
		setPrefs({ ...prefs, favouriteMaterials: toggleFavouriteKey(prefs.favouriteMaterials, key) });
	}

	/** The Card's More › Image › Replace: the reach was chosen before the edit (D2). */
	function replaceImageFor(
		entityId: string,
		file: File,
		mode: 'just-this' | 'all' | 'in-place',
	): Promise<FinishImageOutcome> {
		const context = captureImageWrite();
		if (context === null) {
			host.onNotice('The Stage is still opening.');
			return Promise.resolve({ kind: 'refused', message: 'The Stage is still opening.' });
		}
		return imageFlow.begin(file, async (image, warning) => {
			if (!imageWriteIsCurrent(context)) return { kind: 'no-op' };
			const latest = viewFor(entityId);
			if (latest === null || !latest.editable) {
				return {
					kind: 'refused',
					message: "A model's own materials take no edits. Paint a material first.",
				};
			}
			return applyImageReplace(entityId, image, latest.users, mode, warning, context);
		});
	}

	/** Select every present user of a Finish: a selection, never a write. */
	async function selectFinishUsers(ref: Exclude<SceneFinishRef, 'model-own'>): Promise<boolean> {
		const services = servicesNow();
		if (services === null) return false;
		const snapshot = services.stage.snapshot();
		const inspection = inspectFinish(stageEnvelope(snapshot), ref, {
			labelForMaterial: (id) => catalogueLabel(id as MaterialId),
		});
		const label = labelOfKey(finishKeyOfRef(ref));
		if (inspection === null || inspection.users.length === 0) {
			host.onNotice(`No surfaces use ${label}.`);
			return false;
		}
		const entries = selectionEntriesOfFinishUsers(inspection.users, snapshot);
		if (entries.length === 0) {
			host.onNotice(`Every user of ${label} is dormant or retired.`);
			return false;
		}
		const result = services.stage.setSelection({
			ordered: entries,
			primary: entries[0]!.reference,
		});
		if (result.kind === 'refused') {
			host.onNotice(result.message);
			return false;
		}
		host.onNotice(`${entries.length} user${entries.length === 1 ? '' : 's'} of ${label} selected.`);
		return true;
	}

	const catalogueLabel = (id: MaterialId): string =>
		materialById.has(id) ? getMaterial(id).label : id;
	const treatmentFacts = materialTreatmentFacts(catalogueLabel);
	const swatchOf = (id: MaterialId): string => {
		if (!materialById.has(id)) return '#c4b4a0';
		const material = getMaterial(id);
		return material.swatchColor ?? material.fallbackColor;
	};
	/** The quick Finish on the Card (U4): its one adapter. */
	const card: FinishCard = createFinishCard({
		services: servicesNow,
		labelForMaterial: catalogueLabel,
		facts: treatmentFacts,
		swatchOf,
		isFavourite: isFavouriteMaterial,
		toggleFavourite: toggleFavouriteMaterial,
		replaceImage: replaceImageFor,
		onAccepted: () => undefined,
		selectFinishUsers,
		onOwnCopy: () => host.onNotice('This surface now has its own copy'),
	});
	const library = createFinishLibraryAuthoring({
		host,
		services: servicesNow,
		scene,
		card,
		busy: () => busy,
		setBusy: (value) => {
			busy = value;
		},
		favouriteMaterials: () => prefs.favouriteMaterials,
		labelOfKey,
		noteUsed,
		assign,
		assignSurfaces,
		accept,
		entityOf,
		textureIdFor,
		colorOfKey,
		definitionOf,
		pickMaterialKey,
		armDraft: (draft) => {
			activeKey = null;
			activeColour = null;
			activeDraft = draft;
			dropper = false;
		},
	});

	/** The Material editor facet (U6): Finish mode over the Card adapter. */
	const editor: FinishEditor = createFinishEditor({
		card: () => card,
		facts: treatmentFacts,
		labelForMaterial: catalogueLabel,
		swatchOf,
	});
	/** Align on wall and floor session (U6). */
	const align: FinishAlign = createFinishAlign();

	/** Appearance issues service (U6): static + runtime merged for pill, drawer, strip & hatch. */
	const issues: AppearanceIssuesService = createAppearanceIssues({
		envelope: () => {
			const services = servicesNow();
			return services === null ? null : stageEnvelope(services.stage.snapshot());
		},
		targetAnalysis: host.targetAnalysis,
		repairAsset: host.repairAsset,
		invalidateAndReloadAsset: host.invalidateAndReloadAsset,
		retryTextures: host.retryTextures,
	});

	function targetFromKey(targetKey: string): FinishCardTarget | null {
		if (targetKey.startsWith('entity:')) {
			return { kind: 'entity', entityId: targetKey.slice('entity:'.length) };
		}
		if (targetKey.startsWith('surface:')) {
			const surface = repairSurfaceRef(targetKey);
			return surface === null ? null : { kind: 'surface', surface };
		}
		return null;
	}

	function focusIssueTarget(issue: AppearanceIssue): boolean {
		const services = servicesNow();
		const firstKey = issue.affected[0];
		if (services === null || firstKey === undefined) return false;
		const target = targetFromKey(firstKey);
		if (target === null) return false;
		const ref = finishRefOfKey(issue.finishKey);
		const shot = services.stage.snapshot();
		const envelope = stageEnvelope(shot);
		const inspected = ref !== null && ref !== 'model-own' ? inspectFinish(envelope, ref) : null;
		const matchingUser = inspected?.users.find((u) => u.key === firstKey);
		if (matchingUser !== undefined) {
			const entries = selectionEntriesOfFinishUsers([matchingUser], shot);
			if (entries.length > 0) {
				services.stage.setSelection({ ordered: entries, primary: entries[0]!.reference });
			}
		}
		card.requestOpen(target);
		return true;
	}

	async function runIssueAction(
		issue: AppearanceIssue,
		kind: AppearanceIssueActionKind,
		target: FinishCardTarget,
		file?: File,
	): Promise<boolean> {
		if (kind === 'retry') {
			issues.retry(issue);
			return true;
		}
		if (kind === 'relink') {
			if (file === undefined) return false;
			const outcome = await issues.relink(issue, file);
			if (outcome.ok) host.onNotice(`Relinked ${issue.file ?? 'image'}`);
			return outcome.ok;
		}
		if (kind === 'replace') {
			if (file === undefined) return false;
			const role = issue.role ?? 'color';
			let outcome: FinishImageOutcome;
			if (role === 'color' && target.kind === 'entity') {
				// An object's colour image: S4's own replace, with its tint rule.
				outcome = await card.replaceImage(target, file);
			} else {
				// Any other role, or a surface: the S4 import, then one E4 patch that
				// binds the image to exactly this role and registers its pin.
				const context = captureImageWrite();
				if (context === null) {
					issues.setRefusal(issue.id, 'The Stage is still opening.');
					return false;
				}
				outcome = await imageFlow.begin(file, async (image, warning) => {
					if (!imageWriteIsCurrent(context)) return { kind: 'no-op' };
					if (await card.replaceRoleImage(target, role, image)) {
						if (warning !== null) host.onNotice(warning);
						return { kind: 'accepted' };
					}
					return {
						kind: 'refused',
						message: card.refusalFor(target) ?? 'The image was not replaced.',
					};
				});
			}
			if (outcome.kind !== 'accepted') {
				issues.setRefusal(issue.id, outcome.message ?? 'The image was not replaced.');
				return false;
			}
			issues.noteRepaired({
				finishKey: issue.finishKey,
				finishName: issue.finishName,
				code: issue.code,
				role: issue.role,
				action: 'replaced image',
				history: 'authored',
			});
			return true;
		}
		if (kind === 'disable-role') {
			const role = issue.role ?? 'color';
			let ok = false;
			if (role === 'color') {
				ok = await card.setColourMode(target, 'painted');
			} else {
				ok = await card.edit(target, () => [{ field: `maps.${role}` as const, op: 'disable' }]);
			}
			if (ok) {
				issues.noteRepaired({
					finishKey: issue.finishKey,
					finishName: issue.finishName,
					code: issue.code,
					role: issue.role,
					action: role === 'color' ? 'used colour instead' : `turned off ${role}`,
					history: 'authored',
				});
			}
			return ok;
		}
		if (kind === 'uv0') {
			const ok = await card.edit(target, () => [
				{
					field: 'mapping',
					op: 'set',
					value: { kind: 'uv', set: 0, repeat: [1, 1], rotation: 0, offset: [0, 0] },
				},
			]);
			if (ok) {
				issues.noteRepaired({
					finishKey: issue.finishKey,
					finishName: issue.finishName,
					code: issue.code,
					role: issue.role,
					action: 'UV set 0',
					history: 'authored',
				});
			}
			return ok;
		}
		if (kind === 'surface-mapping') {
			const ok = await card.edit(target, () => [
				{
					field: 'mapping',
					op: 'set',
					value: {
						kind: 'surface',
						metric: { tileMeters: [1, 1], offset: [0, 0], rotation: 0 },
					},
				},
			]);
			if (ok) {
				issues.noteRepaired({
					finishKey: issue.finishKey,
					finishName: issue.finishName,
					code: issue.code,
					role: issue.role,
					action: 'surface mapping',
					history: 'authored',
				});
			}
			return ok;
		}
		return false;
	}

	function requestAlign(
		target: FinishCardTarget,
		place: string,
		invoker?: HTMLElement | null,
	): { readonly ok: boolean; readonly message?: string } {
		const services = servicesNow();
		if (services === null) return { ok: false, message: 'The Stage is still opening.' };
		const shot = services.stage.snapshot();
		editor.close(false);
		const res = align.enter({
			target,
			place,
			layout: stageEnvelope(shot).units.layout.data,
			geometry: shot.domain.geometry,
			invoker,
		});
		if (!res.ok) return { ok: false, message: res.message };
		return { ok: true };
	}

	function setActive(entityId: string): void {
		const view = viewFor(entityId);
		if (view === null || view.key === 'model-own') {
			host.onNotice('That has no Finish colour.');
			return;
		}
		activate(view.key);
	}

	function activeLabel(): string {
		if (activeDraft !== null) return activeDraft.name;
		if (activeColour !== null) return colourLabel(activeColour);
		return activeKey === null ? 'No Finish' : labelOfKey(activeKey);
	}

	/** Whether every one of these objects already wears the active pick. */
	function activeIsAlready(entityIds: readonly string[]): boolean {
		if (activeColour !== null) {
			return host.colourCoat?.isAlready?.({ entityIds, surfaces: [] }, activeColour) ?? false;
		}
		if (activeKey === null || entityIds.length === 0) return false;
		return entityIds.every((id) => {
			const view = viewFor(id);
			return view !== null && view.key === activeKey;
		});
	}

	function hasActive(): boolean {
		return activeKey !== null || activeColour !== null || activeDraft !== null;
	}

	function isAssignable(entityId: string): boolean {
		const view = viewFor(entityId);
		if (view === null || activeKey === null) return false;
		if (activeKey === 'model-own') return view.kind === 'model';
		return true;
	}

	return {
		get activeKey() {
			return activeKey;
		},
		get activeColour() {
			return activeColour;
		},
		get activePick(): PaintPick | null {
			return activeDraft !== null
				? activeDraft
				: activeColour !== null
					? { kind: 'colour', colour: activeColour }
					: activeKey === null
						? null
						: { kind: 'finish', key: activeKey };
		},
		get dropperArmed() {
			// An open draft editor picks its target through the dropper path.
			return dropper || library.draft !== null;
		},
		get busy() {
			return busy;
		},
		get image(): FinishImageState {
			return imageFlow.state;
		},
		card,
		editor,
		align,
		requestAlign,
		noteUsedFinish: noteUsed,
		libraryShelf: library.libraryShelf,
		libraryBrowse: library.libraryBrowse,
		libraryTarget: library.libraryTarget,
		selectFinishUsers,
		applyLibraryFinish: library.applyLibraryFinish,
		openLibraryDraft: library.openLibraryDraft,
		setLibraryDraftStep: library.setLibraryDraftStep,
		patchLibraryDraft: library.patchLibraryDraft,
		setLibraryDraftEdits: library.setLibraryDraftEdits,
		libraryDraftFields: library.libraryDraftFields,
		cancelLibraryDraft: library.cancelLibraryDraft,
		libraryDraftStatus: library.libraryDraftStatus,
		applyLibraryDraft: library.applyLibraryDraft,
		get libraryDraft() {
			return library.draft;
		},
		libraryDraftTarget: library.libraryDraftTarget,
		libraryDraftPreview: library.libraryDraftPreview,
		libraryDraftInstance: library.libraryDraftInstance,
		retargetLibraryDraft: library.retargetLibraryDraft,
		resetLibraryDraftStep: library.resetLibraryDraftStep,
		paintLibraryDraft: library.paintLibraryDraft,
		get librarySwap() {
			return library.swap;
		},
		requestLibrarySwap: library.requestLibrarySwap,
		clearLibrarySwap: library.clearLibrarySwap,
		applyLibrarySwap: library.applyLibrarySwap,
		paletteView,
		paintTray,
		pickFinish,
		assign,
		paintEntities,
		paintSurface,
		activeSurfaceIsAlready,
		copySurface,
		wornLabel,
		coatReading,
		addFromImage,
		retryImageUpload: () => imageFlow.retry().then(() => undefined),
		cancelImage: () => imageFlow.cancel(),
		resetImage: () => imageFlow.reset(),
		setPaletteSlotColor,
		renamePaletteSlot,
		removePaletteSlot,
		addPaletteSlot,
		setActive,
		pickMaterialKey,
		pickColour,
		toggleFavouriteMaterial,
		toggleActiveFavourite,
		hasActive,
		activeLabel,
		activeIsAlready,
		isAssignable,
		armDropper,
		cancelDropper,
		copyFrom,
		openFinishes: () => host.openFinishes(),
		issues,
		runIssueAction,
		focusIssueTarget,
	};
}

export type FinishAuthoring = ReturnType<typeof createFinishAuthoring>;
