/**
 * The Finish authoring service (T2.S4a).
 *
 * One service owns the creator's Finish intent outside the Scene document:
 *
 * - the **active** Finish Paint assigns and the session's five recents;
 * - the shared-Finish **Ask**: one pending edit (or palette adoption), its
 *   reach, *Just this* / *All N* / *Cancel*, and the optional "apply to all
 *   edits while this is open" memory;
 * - the transient colour **preview** the picker streams while the pointer is
 *   down; it never writes and never enters Undo;
 * - the semantic **dropper** target, which copies an authored Finish or colour
 *   rather than rendered pixels.
 *
 * Every write is one F.4 intent through the route's one acceptance host. The
 * service reads the live accepted snapshot each time, so the Card and the
 * planner compute the same reach.
 */
import {
	FINISH_SHEEN_STOPS,
	PALETTE_NAME_MAX_LENGTH,
	baseMaterialIdOf,
	catalogueBaseOf,
	followerSlotOf,
	finishOf,
	finishRefOfKey,
	finishKeyOfSurface,
	isFinishPaintable,
	isPristineInstance,
	literalColorOf,
	materialInstanceById,
	metalReading,
	nextFinishName,
	paletteHasRoom,
	sheenReading,
	usersOfFinish,
	type FinishKey,
	type SceneFinishEdit,
	type SceneFinishRef
} from '@portfolio/project-model/scene-planning';
import type {
	AcceptedRevision,
	MaterialId,
	SceneColor,
	SceneEntity,
	SceneMaterialInstance,
	SceneSurfaceRef,
	SemanticReference
} from '@portfolio/project-model';
import { surfaceKey } from '@portfolio/layout-core';
type PaintableSurface = SceneSurfaceRef;

/** The F.1 subject one surface identity names; the component carries the face. */
function surfaceTargetSubject(surface: PaintableSurface): { kind: 'wall' | 'room' | 'region'; id: string } {
	switch (surface.kind) {
		case 'wall-side': return { kind: 'wall', id: surface.wallId };
		case 'room-floor':
		case 'room-lid': return { kind: 'room', id: surface.roomId };
		case 'region-face': return { kind: 'region', id: surface.regionId };
	}
}

function surfaceTargetComponent(surface: PaintableSurface): string {
	switch (surface.kind) {
		case 'wall-side': return `side:${surface.side}`;
		case 'room-floor': return 'floor';
		case 'room-lid': return 'lid';
		case 'region-face': return surface.face;
	}
}
import { getMaterial, materialById, materials } from '$lib/content/materials';
import type { ProjectApi } from '$lib/platform/project-persistence';
import { stageEnvelope, type StageAdapterServices } from '../stage/stage-adapter-host';
import {
	createFinishImageFlow,
	finishImagePin,
	finishImageWarning,
	type FinishImageFlow,
	type FinishImageOutcome,
	type FinishImageState
} from './finish-image.svelte';
import type { ImportedProjectImage } from '../artwork/project-artwork';

export type FinishAuthoringHost = {
	readonly services: () => StageAdapterServices | null;
	readonly onNotice: (message: string) => void;
	/** Open Library › Finishes, scrolled to the current tile. */
	readonly openFinishes: () => void;
	/** Arm the host Paint task, optionally in the Finish dropper. */
	readonly armPaint: (mode: { readonly kind: 'paint' } | { readonly kind: 'dropper' }) => void;
	/**
	 * S4b's creator-bytes seam. These are absent in a route with no cloud project;
	 * *+ From image* then refuses with the same words Artwork uses.
	 */
	readonly api?: () => ProjectApi | null;
	readonly projectId?: () => string | null;
	readonly canEdit?: () => boolean;
	readonly isSaved?: () => boolean;
	/** Decoded width ÷ height of a project texture, or `null` until it loads. */
	readonly imageAspect?: (textureId: string) => number | null;
	/** Decoded pixel size, for the D3 low-resolution warning. */
	readonly imageDimensions?: (textureId: string) => { readonly width: number; readonly height: number } | null;
	/** The texture record's URI, if the image is a project texture. */
	readonly textureUri?: (textureId: string) => string | null;
	/** A retained, verified preview URL for that project texture (CSS only). */
	readonly texturePreviewUri?: (textureId: string) => string | null;
	readonly textureFailed?: (uri: string) => boolean;
	/** Targeted Retry: drop one source failure and reload that image. */
	readonly retryTexture?: (uri: string) => void;
};

export type FinishEntityView = {
	readonly entityId: string;
	readonly entityName: string;
	readonly kind: 'primitive' | 'form' | 'model';
	readonly key: FinishKey;
	readonly ref: SceneFinishRef;
	readonly label: string;
	readonly users: number;
	readonly editable: boolean;
	readonly pristine: boolean;
	readonly baseMaterialId: MaterialId | null;
	readonly baseLabel: string;
	readonly instance: SceneMaterialInstance | null;
	readonly effectiveColor: string;
	readonly literalColor: string | null;
	readonly followerSlot: string | null;
	readonly roughness: number;
	readonly roughnessAuthored: boolean;
	readonly sheenStop: ReturnType<typeof sheenReading>['stop'];
	readonly sheenCaption: string;
	readonly metalOn: boolean;
	readonly metalCaption: string;
	readonly hasColorImage: boolean;
	/** The colour map's texture id, or `null` when the image is the catalogue's. */
	readonly colorMapId: string | null;
	readonly colorMapUri: string | null;
	readonly colorMapFailed: boolean;
	readonly colorMapWarning: string | null;
	readonly tileMeters: readonly [number, number] | null;
	/** The catalogue's own tile size, the field's starting value before an edit. */
	readonly defaultTileMeters: readonly [number, number];
	readonly rotation: number;
	/** Scale is offered only when the Finish has a map to scale (D18). */
	readonly tileSizeAvailable: boolean;
	readonly directionAvailable: boolean;
	/** Scale/Direction are Floor/Form ideas; a model keeps its own UVs. */
	readonly canEditMapping: boolean;
	/** Box sides approximate their tiling with width × depth (existing rule). */
	readonly scaleApproximate: boolean;
	readonly canSaveToPalette: boolean;
	readonly paletteRoom: boolean;
	readonly originalWritesWhite: boolean;
};

export type FinishPaletteView = {
	readonly slots: readonly {
		readonly id: string;
		readonly name: string;
		readonly color: string;
		readonly users: number;
	}[];
	readonly room: boolean;
};

export type FinishPaintPalette = {
	readonly active: { readonly key: FinishKey; readonly label: string; readonly color: string } | null;
	readonly recents: readonly {
		readonly key: FinishKey;
		readonly label: string;
		readonly color: string;
	}[];
	readonly dropper: boolean;
};

type PendingEdit = {
	readonly kind: 'edit';
	readonly entityId: string;
	readonly from: FinishKey;
	readonly edit: SceneFinishEdit;
};

type PendingPalette = {
	readonly kind: 'palette-add';
	readonly entityId: string;
	readonly color: string;
	readonly slotId: string;
};

/** The Stage and revision an upload began in; a write may not outlive either. */
type ImageWriteContext = {
	readonly services: StageAdapterServices;
	readonly acceptedRevision: AcceptedRevision;
};

/**
 * A Replace that has already uploaded its bytes and now needs the shared-Finish
 * decision. The asset stays in P20 storage whatever the answer; the planner
 * reuses it, so Cancel costs no upload and writes nothing.
 */
type PendingImageReplace = {
	readonly kind: 'image-replace';
	readonly entityId: string;
	readonly reach: number;
	readonly image: ImportedProjectImage;
	readonly warning: string | null;
	readonly context: ImageWriteContext;
};

export type FinishAsk = {
	readonly kind: 'edit' | 'palette-add' | 'image-replace';
	readonly entityId: string;
	readonly label: string;
	readonly reach: number;
	readonly applyToAllEdits: boolean;
};

type Pending = PendingEdit | PendingPalette | PendingImageReplace;

const RECENTS_LIMIT = 5;

function entityReference(services: StageAdapterServices, entityId: string) {
	const snapshot = services.stage.snapshot();
	return {
		version: 1 as const,
		domain: 'scene' as const,
		revision: { kind: 'exact' as const, contentRevision: snapshot.domain.unitRevisions.scene },
		subject: { kind: 'entity' as const, id: entityId },
		instancePath: [],
		location: { kind: 'project-root' as const },
		componentId: null,
		capabilityId: null
	};
}

function newId(kind: string, id: string) {
	return { kind, id };
}

export function createFinishAuthoring(host: FinishAuthoringHost) {
	let activeKey = $state.raw<string | null>(null);
	let recents = $state.raw<readonly string[]>([]);
	let ask = $state.raw<FinishAsk | null>(null);
	let pending = $state.raw<Pending | null>(null);
	let applyToAllEdits = $state(false);
	/** The one remembered Ask choice for the open row, cleared by a subject change. */
	let sticky = $state.raw<{ readonly key: string; readonly mode: 'just-this' | 'all' } | null>(null);
	let preview = $state.raw<ReadonlyMap<string, string>>(new Map());
	let dropper = $state.raw<{ readonly forEntityId: string | null } | null>(null);
	let rowEntityId: string | null = null;
	let busy = $state(false);

	/** The one From-image flow: upload states, cancellation and retry. */
	const imageFlow: FinishImageFlow = createFinishImageFlow({
		api: () => host.api?.() ?? null,
		projectId: () => host.projectId?.() ?? null,
		canEdit: () => host.canEdit?.() ?? true,
		isSaved: () => host.isSaved?.() ?? true,
		onNotice: (message) => host.onNotice(message)
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
			context.acceptedRevision
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

	/**
	 * Preview a colour on one object without writing. The map is a render-only
	 * override the Stage consumes; it never enters the Scene, history or a planner.
	 */
	function previewColor(entityId: string, color: string): void {
		const next = new Map(preview);
		next.set(entityId, color);
		preview = next;
	}

	function clearPreview(): void {
		if (preview.size > 0) preview = new Map();
	}

	function remember(key: string): void {
		activeKey = key;
		recents = [key, ...recents.filter((entry) => entry !== key)].slice(0, RECENTS_LIMIT);
	}

	function labelOfKey(key: string): string {
		const current = scene();
		if (key === 'model-own') return "Model's own";
		if (key.startsWith('curated:')) {
			const id = key.slice('curated:'.length) as MaterialId;
			return getMaterial(id).label;
		}
		const id = key.slice('project:'.length);
		return current?.materials.find((material) => material.id === id)?.name ?? 'Finish';
	}

	/** The immutable definition a resource-backed Finish names. */
	function definitionOf(
		instance: SceneMaterialInstance | undefined
	): import('@portfolio/project-model/materials').Recipe | null {
		if (instance === undefined || !('material' in instance.base)) return null;
		return scene()?.materialIndex?.definitions.get(instance.base.material) ?? null;
	}

	/** The local texture id an inherited or overridden binding resolves to. */
	function textureIdFor(
		instance: SceneMaterialInstance | undefined,
		role: 'color' | 'normal' | 'roughness' | 'metalness' | 'occlusion'
	): string | null {
		const override = instance?.overrides?.maps?.[role];
		if (override === null) return null;
		if (override !== undefined) {
			return 'textureId' in override.image ? override.image.textureId : null;
		}
		const definition = definitionOf(instance);
		if (definition === null) return null;
		const binding = definition.maps[role];
		if (binding === undefined) return null;
		const hash = instance !== undefined && 'material' in instance.base ? instance.base.material : null;
		const image = hash === null
			? undefined
			: scene()?.materialIndex?.definitionImages.get(hash)?.find((entry) => entry.hash === binding.image);
		return image !== undefined && 'textureId' in image.source ? image.source.textureId : null;
	}

	function colorOfKey(key: string): string {
		const current = scene();
		if (current === null) return '#c4b4a0';
		if (key === 'model-own') return '#c4b4a0';
		if (key.startsWith('curated:')) {
			const material = getMaterial(key.slice('curated:'.length) as MaterialId);
			return material.swatchColor ?? material.fallbackColor;
		}
		const instance = current.materials.find((material) => material.id === key.slice('project:'.length));
		if (instance === undefined) return '#c4b4a0';
		const color = instance.overrides?.color;
		if (color === undefined) {
			const base = catalogueBaseOf(instance);
			const definition = definitionOf(instance);
			if (definition !== null) return definition.color;
			if (base === null || !materialById.has(base)) return '#c4b4a0';
			const material = getMaterial(base as MaterialId);
			return material.swatchColor ?? material.fallbackColor;
		}
		if (typeof color === 'string') return color;
		return current.palette?.find((slot) => slot.id === color.slot)?.color ?? '#c4b4a0';
	}

	/**
	 * One entity's whole Finish reading. The Card, the dropper and Paint all use
	 * it, so a shared Finish's reach is the same number everywhere.
	 */
	function viewFor(entityId: string): FinishEntityView | null {
		const snapshot = servicesNow()?.stage.snapshot();
		if (snapshot === undefined) return null;
		const current = snapshot.domain.scene;
		const entity = current.entities.find((candidate) => candidate.id === entityId) ?? null;
		if (entity === null || !isFinishPaintable(entity)) return null;
		const key = finishOf(entity, current.materials);
		if (key === null) return null;
		const ref = finishRefOfKey(key);
		if (ref === null) return null;
		const instance = materialInstanceById(
			current.materials,
			(entity as SceneEntity & { materialInstanceId?: string }).materialInstanceId
		);
		const baseMaterialId = baseMaterialIdOf(entity, current.materials);
		const definition = definitionOf(instance);
		const catalogueId = instance !== undefined && 'catalogue' in instance.base ? instance.base.catalogue : baseMaterialId;
		const catalogue = catalogueId !== null && materialById.has(catalogueId as MaterialId)
			? getMaterial(catalogueId as MaterialId)
			: null;
		const baseLabel = definition !== null ? 'Imported material' : (catalogue?.label ?? (baseMaterialId ?? 'Finish'));
		const roughness = instance?.overrides?.roughness ?? definition?.roughness ?? catalogue?.roughness ?? 0.5;
		const roughnessAuthored = instance?.overrides?.roughness !== undefined;
		const metalness = instance?.overrides?.metalness ?? definition?.metalness ?? catalogue?.metalness ?? 0;
		const sheen = sheenReading({ effectiveRoughness: roughness, authored: roughnessAuthored, baseLabel });
		const metal = metalReading(metalness);
		const literal = literalColorOf(entity, current.materials);
		const follower = followerSlotOf(entity, current.materials);
		const effectiveColor = literal ?? (follower === null ? undefined : current.palette?.find((slot) => slot.id === follower)?.color) ??
			definition?.color ?? catalogue?.fallbackColor ?? '#c4b4a0';
		const users = usersOfFinish(current, key, stageEnvelope(snapshot).units.layout.data).length;
		const isModelOwn = key === 'model-own';
		const colorMapId = textureIdFor(instance, 'color');
		const textureRecordUri = colorMapId === null ? null : (host.textureUri?.(colorMapId) ?? null);
		// A project texture is authenticated bytes: CSS cannot fetch the Scene URI
		// from the editor origin, so the preview uses the scope's retained URL.
		const colorMapUri =
			colorMapId === null
				? (catalogue?.textures?.map ?? null)
				: textureRecordUri !== null && textureRecordUri.startsWith('/project-assets/')
					? (host.texturePreviewUri?.(colorMapId) ?? null)
					: textureRecordUri;
		const imageDimensions = colorMapId === null ? null : (host.imageDimensions?.(colorMapId) ?? null);
		const hasColorImage = Boolean(colorMapId ?? definition?.maps.color ?? catalogue?.textures?.map);
		const tileSizeAvailable = Boolean(
			(instance?.overrides?.maps !== undefined && Object.keys(instance.overrides.maps).length > 0) ||
				(definition !== null && Object.keys(definition.maps).length > 0) ||
				(catalogue?.textures !== undefined && Object.keys(catalogue.textures).length > 0)
		);
		const palette = current.palette ?? [];
		return {
			entityId,
			entityName: entity.name,
			kind: entity.kind as 'primitive' | 'form' | 'model',
			key,
			ref,
			label: isModelOwn ? "Model's own" : key.startsWith('project:') ? (instance?.name ?? labelOfKey(key)) : baseLabel,
			users,
			editable: !isModelOwn,
			pristine: instance !== undefined && isPristineInstance(instance),
			baseMaterialId,
			baseLabel,
			instance: instance ?? null,
			effectiveColor,
			literalColor: literal,
			followerSlot: follower,
			roughness,
			roughnessAuthored,
			sheenStop: sheen.stop,
			sheenCaption: sheen.caption,
			metalOn: metal.on,
			metalCaption: metal.caption,
			hasColorImage,
			colorMapId,
			colorMapUri,
			colorMapFailed: textureRecordUri !== null && (host.textureFailed?.(textureRecordUri) ?? false),
			colorMapWarning:
				imageDimensions === null
					? null
					: finishImageWarning(imageDimensions.width, imageDimensions.height),
			tileMeters: instance?.overrides?.mapping !== undefined && instance.overrides.mapping.kind !== 'uv'
				? instance.overrides.mapping.metric.tileMeters
				: definition?.mapping.kind !== 'uv' && definition?.mapping !== undefined
					? definition.mapping.metric.tileMeters
					: null,
			defaultTileMeters: definition?.mapping.kind === 'target' ? definition.mapping.metric.tileMeters : (catalogue?.defaultTileSizeMeters ?? [1, 1]),
			rotation: instance?.overrides?.mapping !== undefined && instance.overrides.mapping.kind !== 'uv'
				? instance.overrides.mapping.metric.rotation
				: definition?.mapping.kind !== 'uv' && definition?.mapping !== undefined
					? definition.mapping.metric.rotation
					: 0,
			tileSizeAvailable,
			directionAvailable: hasColorImage,
			canEditMapping: entity.kind !== 'model',
			scaleApproximate: entity.kind === 'primitive' && entity.primitive === 'box',
			canSaveToPalette:
				literal !== null && paletteHasRoom(palette) && !palette.some((slot) => slot.color === literal),
			paletteRoom: paletteHasRoom(palette),
			originalWritesWhite: hasColorImage && instance?.overrides?.maps?.color !== undefined
		};
	}

	/** Library › Finishes: curated tiles, then the project's own Finishes. */
	function libraryShelf(): {
		readonly curated: readonly { readonly id: MaterialId; readonly label: string; readonly color: string }[];
		readonly project: readonly {
			readonly id: string;
			readonly name: string;
			readonly color: string;
			readonly imageUri: string | null;
			readonly warning: string | null;
		}[];
	} {
		const current = scene();
		return {
			curated: materials.map((material) => ({
				id: material.id,
				label: material.label,
				color: material.swatchColor ?? material.fallbackColor
			})),
			project: (current?.materials ?? [])
				.filter((instance) => !isPristineInstance(instance))
				.map((instance) => {
					const colorMapId = textureIdFor(instance, 'color');
					const dimensions = colorMapId === null ? null : (host.imageDimensions?.(colorMapId) ?? null);
					const textureRecordUri = colorMapId === null ? null : (host.textureUri?.(colorMapId) ?? null);
					return {
						id: instance.id,
						name: instance.name,
						color: colorOfKey(`project:${instance.id}`),
						imageUri:
							colorMapId === null
								? null
								: textureRecordUri !== null && textureRecordUri.startsWith('/project-assets/')
									? (host.texturePreviewUri?.(colorMapId) ?? null)
									: textureRecordUri,
						warning:
							dimensions === null
								? null
								: finishImageWarning(dimensions.width, dimensions.height)
					};
				})
		};
	}

	function paletteView(): FinishPaletteView {
		const current = scene();
		const slots = current?.palette ?? [];
		return {
			room: paletteHasRoom(slots),
			slots: slots.map((slot) => ({
				id: slot.id,
				name: slot.name,
				color: slot.color,
				users: current?.materials.filter(
					(material) =>
						material.overrides?.color !== undefined &&
						typeof material.overrides.color !== 'string' &&
						material.overrides.color.slot === slot.id
				).length ?? 0
			}))
		};
	}

	function paintPalette(): FinishPaintPalette {
		const resolve = (key: string) => ({ key, label: labelOfKey(key), color: colorOfKey(key) });
		return {
			active: activeKey === null ? null : resolve(activeKey),
			recents: recents.map(resolve),
			dropper: dropper !== null
		};
	}

	function selectionEntityId(): string | null {
		const services = servicesNow();
		const primary = services?.stage.selectionState().primary;
		return primary?.domain === 'scene' && primary.subject.kind === 'entity' ? primary.subject.id : null;
	}

	function selectionEntity(): SceneEntity | null {
		return entityOf(selectionEntityId());
	}

	async function accept(input: {
		kind: string;
		payload: unknown;
		entityIds?: readonly string[];
		targets?: readonly SemanticReference[];
		allocatedIds?: readonly { kind: string; id: string }[];
	}, context?: ImageWriteContext): Promise<{
		readonly kind: string;
		readonly code?: string;
		readonly reason?: string | null;
		readonly message?: string;
	}> {
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
			allocatedIds: input.allocatedIds ?? []
		});
		if (outcome.kind === 'refused' && outcome.code !== 'no-change' && outcome.reason !== 'no-change') {
			host.onNotice(outcome.message);
		}
		return outcome;
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
		if (typeof ref === 'object' && 'curated' in ref && paintable.some((entity) => entity.kind === 'model')) {
			const reusable = current.materials.some(
				(instance) => isPristineInstance(instance) && catalogueBaseOf(instance) === ref.curated
			);
			if (!reusable) allocations = [newId('scene-finish', crypto.randomUUID())];
		}
		busy = true;
		try {
			const outcome = await accept({
				kind: 'scene-finish-assign',
				payload: { finish: ref, entityIds: paintable.map((entity) => entity.id) },
				entityIds: paintable.map((entity) => entity.id),
				allocatedIds: allocations
			});
			if (outcome.kind === 'accepted') {
				if (notices.length > 0) {
					host.onNotice(
						`Painted ${paintable.length} object${paintable.length === 1 ? '' : 's'}; ` +
							`${notices.length} subject${notices.length === 1 ? ' is' : 's are'} not painted.`
					);
				}
				return true;
			}
			return false;
		} finally {
			busy = false;
		}
	}

	function setActiveFromKey(key: string): void {
		remember(key);
		host.onNotice(`Paint · ${labelOfKey(key)}`);
	}

	/** A Library pick: assign to the selection, or arm Paint when nothing is selected. */
	async function pickFinish(ref: SceneFinishRef): Promise<void> {
		const key = typeof ref === 'object' && 'curated' in ref ? `curated:${ref.curated}` : typeof ref === 'object' ? `project:${ref.project}` : 'model-own';
		const selected = selectionEntity();
		if (selected === null) {
			remember(key);
			host.armPaint({ kind: 'paint' });
			return;
		}
		if (!isFinishPaintable(selected)) {
			host.onNotice(paintabilityNotice(selected));
			return;
		}
		const assigned = await assign([selected.id], ref);
		if (assigned) remember(key);
	}

	function stickyMode(key: string): 'just-this' | 'all' | null {
		return sticky?.key === key ? sticky.mode : null;
	}

	async function applyEdit(
		entityId: string,
		edit: SceneFinishEdit,
		mode: 'just-this' | 'all' | 'in-place'
	): Promise<void> {
		const view = viewFor(entityId);
		if (view === null || !view.editable) {
			host.onNotice(view === null ? paintabilityNotice(entityOf(entityId)) : "Model's own has no Finish to edit.");
			return;
		}
		const needsNew = view.ref !== 'model-own' && ('curated' in view.ref || mode === 'just-this');
		busy = true;
		try {
			const outcome = await accept({
				kind: 'scene-finish-edit',
				payload: {
					entityId,
					from: view.key,
					reach: view.users,
					mode,
					edit
				},
				entityIds: [entityId],
				allocatedIds: needsNew ? [newId('scene-finish', crypto.randomUUID())] : []
			});
			if (outcome.kind === 'accepted') {
				clearPreview();
				ask = null;
				pending = null;
				return;
			}
			clearPreview();
			if (outcome.code === 'stale-reach') {
				// The editor's reach was stale: recompute from the live source and ask
				// again rather than widening the write.
				pending = { kind: 'edit', entityId, from: view.key, edit };
				const latest = viewFor(entityId);
				if (latest !== null && latest.users > 1) {
					ask = { kind: 'edit', entityId, label: latest.label, reach: latest.users, applyToAllEdits };
					host.onNotice(`That Finish is now used by ${latest.users} objects.`);
				} else {
					ask = null;
					pending = null;
				}
			}
		} finally {
			busy = false;
		}
	}

	/** An edit gesture: writes at once, or opens the Ask for a shared Finish. */
	async function edit(entityId: string, edit: SceneFinishEdit): Promise<void> {
		const view = viewFor(entityId);
		if (view === null) {
			host.onNotice(paintabilityNotice(entityOf(entityId)));
			return;
		}
		if (!view.editable) {
			host.onNotice("Model's own has no Finish to edit.");
			return;
		}
		if (view.users === 1) {
			await applyEdit(entityId, edit, view.ref !== 'model-own' && 'curated' in view.ref ? 'just-this' : 'in-place');
			return;
		}
		const remembered = stickyMode(view.key);
		if (applyToAllEdits && remembered !== null) {
			await applyEdit(entityId, edit, remembered);
			return;
		}
		pending = { kind: 'edit', entityId, from: view.key, edit };
		ask = { kind: 'edit', entityId, label: view.label, reach: view.users, applyToAllEdits };
	}

	/** Palette adoption: one slot append plus the follower edit. */
	async function saveToPalette(entityId: string): Promise<void> {
		const view = viewFor(entityId);
		if (view === null || view.literalColor === null) {
			host.onNotice('Only an authored colour can be saved to the palette.');
			return;
		}
		if (!paletteHasRoom(scene()?.palette)) {
			host.onNotice('The palette already holds eight colours.');
			return;
		}
		const slotId = crypto.randomUUID();
		if (view.users > 1) {
			pending = { kind: 'palette-add', entityId, color: view.literalColor, slotId };
			ask = {
				kind: 'palette-add',
				entityId,
				label: view.label,
				reach: view.users,
				applyToAllEdits
			};
			return;
		}
		await applyPalette(entityId, view.literalColor, slotId, view.users, view.ref !== 'model-own' && 'curated' in view.ref ? 'just-this' : 'in-place');
	}

	async function applyPalette(
		entityId: string,
		color: string,
		slotId: string,
		reach: number,
		mode: 'just-this' | 'all' | 'in-place'
	): Promise<void> {
		const view = viewFor(entityId);
		if (view === null) return;
		const needsFinish = view.ref !== 'model-own' && ('curated' in view.ref || mode === 'just-this');
		const allocations = [
			newId('scene-palette-slot', slotId),
			...(needsFinish ? [newId('scene-finish', crypto.randomUUID())] : [])
		];
		busy = true;
		try {
			const outcome = await accept({
				kind: 'scene-palette-slot-add',
				payload: { color, adoptEntityId: entityId, reach, mode },
				entityIds: [entityId],
				allocatedIds: allocations
			});
			if (outcome.kind === 'accepted') {
				ask = null;
				pending = null;
			}
		} finally {
			busy = false;
		}
	}

	/** Dismiss a pending shared-Finish Ask without writing. */
	function cancelAsk(): boolean {
		if (ask === null && pending === null) return false;
		ask = null;
		pending = null;
		applyToAllEdits = false;
		clearPreview();
		return true;
	}

	async function resolveAsk(choice: 'just-this' | 'all' | 'cancel'): Promise<void> {
		const current = pending;
		const asked = ask;
		if (choice === 'cancel' || current === null || asked === null) {
			ask = null;
			pending = null;
			applyToAllEdits = false;
			clearPreview();
			return;
		}
		const mode = choice === 'all' ? 'all' : 'just-this';
		ask = null;
		pending = null;
		if (applyToAllEdits && current.kind === 'edit') {
			sticky = { key: current.from, mode };
		}
		if (current.kind === 'edit') {
			await applyEdit(current.entityId, current.edit, mode);
		} else if (current.kind === 'image-replace') {
			await applyImageReplace(
				current.entityId,
				current.image,
				asked.reach,
				mode,
				current.warning,
				current.context
			);
		} else {
			await applyPalette(current.entityId, current.color, current.slotId, asked.reach, mode);
		}
	}

	function setApplyToAllEdits(value: boolean): void {
		applyToAllEdits = value;
		if (ask !== null) ask = { ...ask, applyToAllEdits: value };
	}

	function noteRow(entityId: string | null): void {
		if (rowEntityId === entityId) return;
		rowEntityId = entityId;
		sticky = null;
		ask = null;
		pending = null;
		applyToAllEdits = false;
		clearPreview();
	}

	function setColor(entityId: string, color: string | { readonly slot: string }): Promise<void> {
		return edit(entityId, { color });
	}

	/** *Original*: delete a curated override, or write white over an image Finish. */
	function setOriginal(entityId: string): Promise<void> {
		const view = viewFor(entityId);
		if (view === null) return Promise.resolve();
		return edit(entityId, { color: view.originalWritesWhite ? '#ffffff' : null });
	}

	function setSheen(entityId: string, stopId: (typeof FINISH_SHEEN_STOPS)[number]['id']): Promise<void> {
		const stop = FINISH_SHEEN_STOPS.find((candidate) => candidate.id === stopId);
		return stop === undefined ? Promise.resolve() : edit(entityId, { roughness: stop.roughness });
	}

	function setRoughness(entityId: string, roughness: number): Promise<void> {
		if (!Number.isFinite(roughness) || roughness < 0 || roughness > 1) {
			host.onNotice('Roughness must be between 0 and 1.');
			return Promise.resolve();
		}
		return edit(entityId, { roughness });
	}

	function setMetal(entityId: string, on: boolean): Promise<void> {
		return edit(entityId, { metalness: on ? 1 : 0 });
	}

	/**
	 * One tile's metre size. With an image bound the pair keeps its aspect
	 * (`[s, s × h/w]`); a map-less Finish has no aspect to keep and is not offered
	 * the field at all.
	 */
	function tileFor(entityId: string, metres: number): [number, number] {
		const view = viewFor(entityId);
		const aspect =
			view?.colorMapId === null || view?.colorMapId === undefined
				? null
				: (host.imageAspect?.(view.colorMapId) ?? null);
		return aspect !== null && Number.isFinite(aspect) && aspect > 0 ? [metres, metres / aspect] : [metres, metres];
	}

	/** More › Scale: one tile in metres, written through the normal Finish edit. */
	function setTileSize(entityId: string, metres: number): Promise<void> {
		if (!Number.isFinite(metres) || metres < 0.01 || metres > 100) {
			host.onNotice('One tile must be between 0.01 m and 100 m.');
			return Promise.resolve();
		}
		return edit(entityId, { tileMeters: tileFor(entityId, metres) });
	}

	/** More › Direction: degrees are shown; radians are stored, normalised to [0, 2π). */
	function setDirection(entityId: string, degrees: number): Promise<void> {
		if (!Number.isFinite(degrees)) {
			host.onNotice('Direction must be a number of degrees.');
			return Promise.resolve();
		}
		const radians = (degrees * Math.PI) / 180;
		return edit(entityId, { rotation: radians });
	}

	/** More › Image › Remove: delete `maps.color`, restoring the base's rule. */
	function removeImage(entityId: string): Promise<void> {
		return edit(entityId, { colorMap: null });
	}

	/** The one Scene write an imported image performs when replacing a Finish. */
	async function applyImageReplace(
		entityId: string,
		image: ImportedProjectImage,
		reach: number,
		mode: 'just-this' | 'all' | 'in-place',
		warning: string | null,
		context: ImageWriteContext
	): Promise<FinishImageOutcome> {
		if (!imageWriteIsCurrent(context)) return { kind: 'no-op' };
		const view = viewFor(entityId);
		if (view === null || !view.editable) {
			return { kind: 'refused', message: "Model's own has no Finish to edit." };
		}
		const needsNew = view.ref !== 'model-own' && ('curated' in view.ref || mode === 'just-this');
		busy = true;
		try {
			const outcome = await accept({
				kind: 'scene-finish-from-image',
				payload: {
					name: image.name,
					texture: { assetId: image.assetId, pin: finishImagePin(image) },
					entityIds: [],
					replaceFinishOf: { entityId, reach, mode }
				},
				entityIds: [entityId],
				allocatedIds: needsNew ? [newId('scene-finish', crypto.randomUUID())] : []
			}, context);
			if (outcome.kind === 'accepted') {
				if (warning !== null) host.onNotice(warning);
				return { kind: 'accepted' };
			}
			if (outcome.kind === 'refused') {
				// Re-choosing the bytes already on this Finish is not a failure: the
				// asset was reused and the Scene already says exactly this.
				if (outcome.reason === 'no-change' || outcome.code === 'no-change') {
					host.onNotice('That image is already applied.');
					return { kind: 'accepted' };
				}
				return { kind: 'refused', message: outcome.message ?? 'The image could not be saved.' };
			}
			return { kind: 'no-op' };
		} finally {
			busy = false;
		}
	}

	/**
	 * More › Image › Replace. The upload runs first; a shared Finish then raises
	 * the ordinary Ask in this row, and the answer is the one Write. Cancel keeps
	 * the uploaded asset (P20 retention) and writes no Scene state.
	 */
	function replaceImage(entityId: string, file: File): Promise<void> {
		const context = captureImageWrite();
		const view = viewFor(entityId);
		if (context === null || view === null || !view.editable) {
			host.onNotice(
				context === null
					? 'The Stage is still opening.'
					: view === null
						? paintabilityNotice(entityOf(entityId))
						: "Model's own has no Finish to edit."
			);
			return Promise.resolve();
		}
		return imageFlow.begin(file, async (image, warning) => {
			if (!imageWriteIsCurrent(context)) return { kind: 'no-op' };
			const latest = viewFor(entityId);
			if (latest === null || !latest.editable) {
				return { kind: 'refused', message: "Model's own has no Finish to edit." };
			}
			if (latest.users > 1) {
				pending = { kind: 'image-replace', entityId, reach: latest.users, image, warning, context };
				ask = {
					kind: 'image-replace',
					entityId,
					label: latest.label,
					reach: latest.users,
					applyToAllEdits: false
				};
				return { kind: 'no-op' };
			}
			const mode =
				latest.ref !== 'model-own' && 'curated' in latest.ref ? 'just-this' : 'in-place';
			return applyImageReplace(entityId, image, latest.users, mode, warning, context);
		});
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
		return imageFlow.begin(file, async (image, warning, label) => {
			if (!imageWriteIsCurrent(context)) return { kind: 'no-op' };
			const current = context.services.stage.snapshot().domain.scene;
			const entityIds = selected === null ? [] : [selected.id];
			const finishId = crypto.randomUUID();
			// The planner bounds a Finish name at 120; keep the suffix inside it.
			const name = nextFinishName(label, current.materials).slice(0, 120);
			const outcome = await accept({
				kind: 'scene-finish-from-image',
				payload: {
					name,
					texture: { assetId: image.assetId, pin: finishImagePin(image) },
					entityIds
				},
				entityIds,
				allocatedIds: [newId('scene-finish', finishId)]
			}, context);
			if (outcome.kind === 'accepted') {
				remember(`project:${finishId}`);
				if (warning !== null) host.onNotice(warning);
				if (entityIds.length === 0) host.armPaint({ kind: 'paint' });
				return { kind: 'accepted' };
			}
			if (outcome.kind === 'refused') {
				return { kind: 'refused', message: outcome.message ?? 'The image could not be saved.' };
			}
			return { kind: 'no-op' };
		});
	}

	/** Targeted Retry for a broken image: reload only that texture. */
	function retryImage(textureId: string): void {
		const uri = host.textureUri?.(textureId) ?? null;
		if (uri === null) return;
		host.retryTexture?.(uri);
	}

	function setPaletteSlotColor(slotId: string, color: string): Promise<void> {
		return accept({
			kind: 'scene-palette-slot-set',
			payload: { slotId, color }
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
			payload: { slotId, name: trimmed }
		}).then((outcome) => outcome.kind === 'accepted' || outcome.code === 'no-change');
	}

	function removePaletteSlot(slotId: string): Promise<void> {
		return accept({ kind: 'scene-palette-slot-remove', payload: { slotId } }).then(() => undefined);
	}

	/**
	 * Arm the semantic dropper. The Stage arms Paint in dropper mode; a click
	 * copies an authored value and writes nothing until the Card applies it.
	 */
	function armDropper(forEntityId: string | null): void {
		dropper = { forEntityId };
		host.armPaint({ kind: 'dropper' });
	}

	function cancelDropper(): void {
		dropper = null;
	}

	/** The dropper's one click: copy the target's Finish, or its authored colour. */
	async function copyFrom(target: { readonly sourceId: string } | string): Promise<boolean> {
		const targetId = typeof target === 'string' ? target : target.sourceId;
		const view = viewFor(targetId);
		const dropperState = dropper;
		dropper = null;
		if (view === null || (view.key === 'model-own' && dropperState?.forEntityId != null)) {
			host.onNotice('That has no Finish colour.');
			return false;
		}
		if (dropperState?.forEntityId != null) {
			const source: SceneColor =
				view.followerSlot !== null
					? { slot: view.followerSlot }
					: view.literalColor ?? view.effectiveColor;
			await edit(dropperState.forEntityId, { color: source });
			return true;
		}
		remember(view.key);
		host.onNotice(`Paint · ${view.label}`);
		return true;
	}

	/** Paint commits one object. It never edits a Finish, so it never asks. */
	async function paintEntity(entityId: string): Promise<'accepted' | 'already' | 'refused'> {
		if (activeKey === null) {
			host.onNotice('Choose a Finish first.');
			return 'refused';
		}
		const view = viewFor(entityId);
		if (view === null) {
			host.onNotice(paintabilityNotice(entityOf(entityId)));
			return 'refused';
		}
		if (view.key === activeKey) {
			host.onNotice(`Already ${view.label}`);
			return 'already';
		}
		if (activeKey === 'model-own' && view.kind !== 'model') {
			host.onNotice("Model's own can only be painted onto a model.");
			return 'refused';
		}
		const ref = finishRefOfKey(activeKey);
		if (ref === null) {
			host.onNotice('That Finish no longer exists.');
			return 'refused';
		}
		const accepted = await assign([entityId], ref);
		return accepted ? 'accepted' : 'refused';
	}

	/** Paint one or more stable Layout surfaces in one Scene acceptance. */
	async function paintSurface(surfaces: readonly PaintableSurface[]): Promise<boolean> {
		if (activeKey === null) {
			host.onNotice('Choose a Finish first.');
			return false;
		}
		if (surfaces.length === 0 || surfaces.some((surface) => surface.kind === 'region-face' && surface.face === 'edge')) {
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
			location: { kind: 'layout-location', levelId: snapshot.domain.layoutLevelId, structureInstancePath: [] },
			componentId: surfaceTargetComponent(surface),
			capabilityId: null
		}));
		busy = true;
		try {
			const outcome = await accept({
				kind: 'scene-surface-finish-assign',
				payload: { finish: ref, surfaces },
				targets
			});
			return outcome.kind === 'accepted';
		} finally {
			busy = false;
		}
	}

	function activeSurfaceIsAlready(surfaces: readonly PaintableSurface[]): boolean {
		const current = scene();
		if (current === null || activeKey === null || surfaces.length === 0) return false;
		const assignments = new Map((current.surfaceFinishes ?? []).map((assignment) => [surfaceKey(assignment.surface), assignment]));
		return surfaces.every((surface) => {
			const assignment = assignments.get(surfaceKey(surface));
			return assignment !== undefined && finishKeyOfSurface(current, assignment) === activeKey;
		});
	}

	/** Copy the authored Finish from a Layout surface; an unpainted surface has nothing to copy. */
	async function copySurface(surface: PaintableSurface): Promise<boolean> {
		const current = scene();
		const dropperState = dropper;
		dropper = null;
		if (current === null) {
			host.onNotice('That has no Finish colour.');
			return false;
		}
		const assignment = current.surfaceFinishes?.find((entry) => surfaceKey(entry.surface) === surfaceKey(surface));
		if (assignment === undefined) {
			host.onNotice('That has no Finish colour.');
			return false;
		}
		if (dropperState?.forEntityId != null) {
			const key = finishKeyOfSurface(current, assignment);
			const ref = finishRefOfKey(key);
			if (ref === null || ref === 'model-own') {
				host.onNotice('That has no Finish colour.');
				return false;
			}
			const source = colorOfKey(key);
			await edit(dropperState.forEntityId, { color: source });
			return true;
		}
		const key = finishKeyOfSurface(current, assignment);
		remember(key);
		host.onNotice(`Paint · ${labelOfKey(key)}`);
		return true;
	}

	function setActive(entityId: string): void {
		const view = viewFor(entityId);
		if (view === null || view.key === 'model-own') {
			host.onNotice('That has no Finish colour.');
			return;
		}
		remember(view.key);
	}

	function activeLabel(): string {
		return activeKey === null ? 'No Finish' : labelOfKey(activeKey);
	}

	function activeIsAlready(entityId: string): boolean {
		const view = viewFor(entityId);
		return view !== null && activeKey !== null && view.key === activeKey;
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
		get ask() {
			return ask;
		},
		get previewFinish() {
			return preview;
		},
		get dropperTarget() {
			return dropper?.forEntityId ?? null;
		},
		get dropperArmed() {
			return dropper !== null;
		},
		get busy() {
			return busy;
		},
		get image(): FinishImageState {
			return imageFlow.state;
		},
		get imageBusy(): boolean {
			return imageFlow.busy;
		},
		get imageCanRetry(): boolean {
			return imageFlow.canRetry;
		},
		viewFor,
		libraryShelf,
		paletteView,
		paintPalette,
		selectionEntityId,
		pickFinish,
		assign,
		paintEntity,
		paintSurface,
		activeSurfaceIsAlready,
		copySurface,
		edit,
		setColor,
		setOriginal,
		setSheen,
		setRoughness,
		setMetal,
		setTileSize,
		setDirection,
		removeImage,
		addFromImage,
		replaceImage,
		retryImage,
		retryImageUpload: () => imageFlow.retry(),
		cancelImage: () => imageFlow.cancel(),
		resetImage: () => imageFlow.reset(),
		saveToPalette,
		resolveAsk,
		cancelAsk,
		setApplyToAllEdits,
		noteRow,
		setPaletteSlotColor,
		renamePaletteSlot,
		removePaletteSlot,
		previewColor,
		clearPreview,
		setActive,
		setActiveFromKey,
		activeLabel,
		activeIsAlready,
		isAssignable,
		armDropper,
		cancelDropper,
		copyFrom,
		openFinishes: () => host.openFinishes()
	};
}

export type FinishAuthoring = ReturnType<typeof createFinishAuthoring>;
