/**
 * The Finish authoring service (T2.S4a).
 *
 * One service owns the creator's Finish intent outside the Scene document:
 *
 * - the **active** pick Paint applies (a Finish, or a colour through the
 *   colour-coat seam) and the creator's favourites and recents;
 * - the Finish Card adapter (U4, `finish-card.svelte.ts`), which shows reach
 *   before an edit and owns the Card's preview;
 * - the project palette's own writes and the From-image flow;
 * - the semantic **dropper**, which copies an authored Finish or colour rather
 *   than rendered pixels.
 *
 * Every write is one F.4 intent through the route's one acceptance host. The
 * service reads the live accepted snapshot each time, so the Card and the
 * planner compute the same reach.
 */
import {
	PALETTE_NAME_MAX_LENGTH,
	baseMaterialIdOf,
	catalogueBaseOf,
	followerSlotOf,
	coatColourOf,
	finishOf,
	finishRefOfKey,
	finishKeyOfRef,
	finishKeyOfSurface,
	finishSheenReading,
	finishHasColourImage,
	inspectFinish,
	isFinishPaintable,
	isPristineInstance,
	literalColorOf,
	materialInstanceById,
	metalReading,
	nextFinishName,
	paletteHasRoom,
	usersOfFinish,
	type FinishKey,
	type SceneFinishRef
} from '@portfolio/project-model/scene-planning';
import type {
	AcceptedRevision,
	MaterialId,
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
import {
	colourKey,
	normaliseHex,
	paintRow,
	parseColourKey,
	pickKey,
	toggleFavourite as toggleFavouriteKey,
	touchRecent,
	type PaintColour,
	type PaintPick
} from './paint-pick';
import {
	createDevicePaintPreferences,
	type PaintPreferenceStore,
	type PaintPreferences
} from './paint-preferences';
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
import type { CoatReading } from './colour-coat-port';
import { createFinishCard, type FinishCard } from './finish-card.svelte';
import {
	materialFamilies,
	materialFamilyOf,
	materialTreatmentFacts,
	type MaterialFamilyId
} from '$lib/content/material-presentation';
import { catalogueRecipe } from '@portfolio/project-model/materials';
import {
	libraryFamilyLabel,
	type LibraryFinishEntry
} from '../library/library-catalogue';
import { libraryTargetOf, selectionEntriesOfFinishUsers, type LibraryTarget } from '../library/library-target';
import {
	beginLibraryDraft,
	libraryDraftChanged,
	libraryDraftPlan,
	type LibraryDraft
} from '../library/library-draft';

export type FinishAuthoringHost = {
	readonly services: () => StageAdapterServices | null;
	readonly onNotice: (message: string) => void;
	/** Open Library › Finishes, scrolled to the current tile. */
	readonly openFinishes: () => void;
	/** Arm the host Paint task, optionally in the Finish dropper. */
	readonly armPaint: (mode: { readonly kind: 'paint' } | { readonly kind: 'dropper' }) => void;
	/** Whether the host Paint tool is armed now; a Library pick then arms, never assigns. */
	readonly isPaintArmed?: () => boolean;
	/** Creator favourites and recents. Defaults to the device store. */
	readonly preferences?: PaintPreferenceStore;
	/**
	 * The colour-coat seam. U3's planner supplies it; until then Paint offers no
	 * Colours tab, because a colour that keeps relief needs the coat dedupe rule
	 * rather than an edit of a Finish other surfaces share.
	 */
	readonly colourCoat?: PaintColourPort;
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

/** The seam U3's colour-coat planner implements. Paint never edits a Finish. */
export type PaintColourPort = {
	/** One acceptance: coat these objects with the colour. */
	readonly paintEntities: (entityIds: readonly string[], colour: PaintColour) => Promise<boolean>;
	/** One acceptance: coat these Layout surfaces with the colour. */
	readonly paintSurfaces: (surfaces: readonly SceneSurfaceRef[], colour: PaintColour) => Promise<boolean>;
	/** Whether every target already wears this colour (no write, no history entry). */
	readonly isAlready?: (
		targets: { readonly entityIds: readonly string[]; readonly surfaces: readonly SceneSurfaceRef[] },
		colour: PaintColour
	) => boolean;
	/** What a colour does to one target: refuse in place, or coat it keeping the named relief. */
	readonly read?: (target: { readonly entityId: string } | { readonly surface: SceneSurfaceRef }) => CoatReading | null;
};

export type PaintSwatch = {
	readonly kind: 'finish' | 'colour';
	/** A Finish key, `slot:<id>` or `#rrggbb`: the stored reference. */
	readonly key: string;
	readonly label: string;
	readonly color: string;
	readonly favourite: boolean;
	/** A project Finish's own colour image, multiplied over the swatch until its picture loads. */
	readonly imageUri?: string | null;
};

/** Everything the Paint tray draws. Resolved here so the tray owns no Finish state. */
export type PaintTrayView = {
	/** False until a colour-coat port exists; the tray then has one tab. */
	readonly colourEnabled: boolean;
	readonly active: PaintSwatch | null;
	readonly dropper: boolean;
	readonly colours: {
		readonly row: readonly PaintSwatch[];
		readonly palette: readonly { readonly id: string; readonly name: string; readonly color: string }[];
	};
	readonly materials: {
		readonly row: readonly PaintSwatch[];
		readonly project: readonly PaintSwatch[];
		readonly curated: readonly PaintSwatch[];
	};
};

/** The Stage and revision an upload began in; a write may not outlive either. */
type ImageWriteContext = {
	readonly services: StageAdapterServices;
	readonly acceptedRevision: AcceptedRevision;
};

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
	let activeColour = $state.raw<PaintColour | null>(null);
	const preferenceStore = host.preferences ?? createDevicePaintPreferences();
	let prefs = $state.raw<PaintPreferences>(preferenceStore.load());
	let dropper = $state(false);
	let busy = $state(false);
	/** The Library's Customise… draft; view state only until Apply. */
	let libraryDraft = $state.raw<LibraryDraft | null>(null);

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

	/** Arm a Finish. Arming never writes and never touches the recents. */
	function activate(key: string): void {
		activeKey = key;
		activeColour = null;
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

	function libraryTileLabel(tile: readonly [number, number]): string {
		const value = (number: number): string => `${Math.round(number * 100) / 100} m`;
		return tile[0] === tile[1] ? value(tile[0]) : `${value(tile[0])} × ${value(tile[1])}`;
	}

	function finishChangeCount(instance: SceneMaterialInstance): number {
		const overrides = instance.overrides;
		if (overrides === undefined) return 0;
		let count = 0;
		for (const field of ['color', 'roughness', 'metalness', 'occlusionStrength', 'normalScale', 'mapping'] as const) {
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
		const services = servicesNow();
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
		const favourite = new Set(prefs.favouriteMaterials);
		const curated = materials.map((material): LibraryFinishEntry => {
			const key = `curated:${material.id}`;
			const source = { base: { catalogue: material.id } } as const;
			const reading = finishSheenReading(source, recipes, facts);
			const recipe = catalogueRecipe(material.id);
			const family = materialFamilyOf(material.id);
			const familyLabel = libraryFamilyLabel(family);
			const mapping = recipe?.mapping;
			const tile = mapping !== undefined && mapping.kind !== 'uv'
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
				userKeys: users.map((user) => (user.kind === 'entity' ? `entity:${user.id}` : `surface:${user.key}`)),
				changes: 0,
				reading,
				sheen: reading.effective,
				metalness: recipe?.metalness ?? material.metalness,
				hasColourImage: finishHasColourImage(source, recipes),
				warning: null
			};
		});
		const project = current.materials
			.filter((instance) => !isPristineInstance(instance))
			.map((instance): LibraryFinishEntry => {
				const key = `project:${instance.id}`;
				const ref = { project: instance.id } as const;
				const inspection = inspectFinish(envelope, ref, {
					labelForMaterial: (id) => catalogueLabel(id as MaterialId)
				});
				const users = inspection?.users ?? [];
				const definition = definitionOf(instance);
				const baseId = catalogueBaseOf(instance);
				const base = baseId === null ? null : catalogueRecipe(baseId);
				const baseLabel = definition !== null
					? 'Imported material'
					: baseId !== null && materialById.has(baseId)
						? getMaterial(baseId).label
						: 'Imported material';
				const family = baseId === null ? null : materialFamilyOf(baseId);
				const changes = finishChangeCount(instance);
				const source = { base: instance.base, overrides: instance.overrides } as const;
				const reading = finishSheenReading(source, recipes, facts);
				const colorMapId = textureIdFor(instance, 'color');
				const dimensions = colorMapId === null ? null : (host.imageDimensions?.(colorMapId) ?? null);
				const textureRecordUri = colorMapId === null ? null : (host.textureUri?.(colorMapId) ?? null);
				return {
					key,
					source: 'project',
					ref,
					name: instance.name,
					materialLabel: baseLabel,
					family,
					familyLabel: libraryFamilyLabel(family),
					subline: changes === 0
						? `from ${baseLabel}`
						: `from ${baseLabel} · ${changes} change${changes === 1 ? '' : 's'}`,
					color: colorOfKey(key),
					/* Only the project's scoped preview; a catalogue map is never a Library picture. */
				imageUri:
					textureRecordUri !== null && textureRecordUri.startsWith('/project-assets/')
						? (host.texturePreviewUri?.(colorMapId!) ?? null)
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
					warning: dimensions === null ? null : finishImageWarning(dimensions.width, dimensions.height)
				};
			});
		return [...project, ...curated];
	}

	/** The Finish target the current Stage selection names, or null. */
	function libraryTarget(): LibraryTarget | null {
		const services = servicesNow();
		if (services === null) return null;
		const snapshot = services.stage.snapshot();
		return libraryTargetOf(services.stage.selectionState().primary, stageEnvelope(snapshot));
	}

	/** Select every present user of a Finish: a selection, never a write. */
	async function selectFinishUsers(ref: Exclude<SceneFinishRef, 'model-own'>): Promise<boolean> {
		const services = servicesNow();
		if (services === null) return false;
		const snapshot = services.stage.snapshot();
		const inspection = inspectFinish(stageEnvelope(snapshot), ref, {
			labelForMaterial: (id) => catalogueLabel(id as MaterialId)
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
		const result = services.stage.setSelection({ ordered: entries, primary: entries[0]!.reference });
		if (result.kind === 'refused') {
			host.onNotice(result.message);
			return false;
		}
		host.onNotice(`${entries.length} user${entries.length === 1 ? '' : 's'} of ${label} selected.`);
		return true;
	}

	/** Apply a browsed Finish to the selected object or surface: one Undo, no Card. */
	async function applyLibraryFinish(ref: Exclude<SceneFinishRef, 'model-own'>): Promise<boolean> {
		const target = libraryTarget();
		if (target === null) {
			host.onNotice('Select an object or surface first.');
			return false;
		}
		const key = finishKeyOfRef(ref);
		if (target.finishKey === key) {
			host.onNotice(`${target.label} already wears ${labelOfKey(key)}.`);
			return false;
		}
		if (target.kind === 'entity') {
			const accepted = await assign([target.entityId], ref);
			if (!accepted) return false;
			noteUsed(key);
			host.onNotice(`Applied ${labelOfKey(key)} to ${target.label}.`);
			return true;
		}
		const accepted = await assignSurfaces([target.surface], ref);
		if (!accepted) return false;
		noteUsed(key);
		host.onNotice(`Applied ${labelOfKey(key)} to ${target.label}.`);
		return true;
	}

	/**
	 * Open a Customise… draft. Draft state is view state: this call and every
	 * step change write nothing. Apply is the one authoring call.
	 */
	function openLibraryDraft(ref: Exclude<SceneFinishRef, 'model-own'>): boolean {
		const key = finishKeyOfRef(ref);
		const entry = libraryBrowse().find((candidate) => candidate.key === key);
		if (entry === undefined) {
			host.onNotice('That Finish is not in this project.');
			return false;
		}
		libraryDraft = beginLibraryDraft(entry);
		return true;
	}

	function setLibraryDraftStep(step: LibraryDraft['step']): void {
		if (libraryDraft === null) return;
		libraryDraft = { ...libraryDraft, step };
	}

	function cancelLibraryDraft(): void {
		libraryDraft = null;
	}

	/** What Apply would do, for the detail pane; no host call. */
	function libraryDraftStatus(): {
		readonly active: boolean;
		readonly canApply: boolean;
		readonly changed: boolean;
		readonly targetLabel: string | null;
		readonly reason: string | null;
	} {
		const draft = libraryDraft;
		if (draft === null) {
			return { active: false, canApply: false, changed: false, targetLabel: null, reason: null };
		}
		const target = libraryTarget();
		const entry = libraryBrowse().find((candidate) => candidate.key === draft.finishKey);
		const reading = entry?.reading ?? draft.reading;
		const users = entry?.userKeys ?? draft.users;
		const plan = libraryDraftPlan(draft, target, reading, users);
		return {
			active: true,
			canApply: plan.ok,
			changed: libraryDraftChanged(draft, reading),
			targetLabel: target?.label ?? null,
			reason: plan.ok ? null : plan.message
		};
	}

	/** One accepted scene-finish-patch for the draft: the same path as the Finish Card. */
	async function applyLibraryDraft(): Promise<boolean> {
		const draft = libraryDraft;
		if (draft === null) return false;
		const target = libraryTarget();
		const entry = libraryBrowse().find((candidate) => candidate.key === draft.finishKey);
		if (entry === undefined) {
			host.onNotice('That Finish is no longer in this project.');
			return false;
		}
		const plan = libraryDraftPlan(draft, target, entry.reading, entry.userKeys);
		if (!plan.ok) {
			host.onNotice(plan.message);
			return false;
		}
		busy = true;
		try {
			const outcome = await accept({
				kind: 'scene-finish-patch',
				payload: {
					finish: draft.ref,
					edits: plan.edits,
					mode: plan.mode,
					selectedUsers: plan.selectedUsers,
					expectedUsers: plan.expectedUsers
				},
				allocatedIds: plan.allocates ? [newId('scene-finish', crypto.randomUUID())] : []
			});
			if (outcome.kind !== 'accepted') return false;
			host.onNotice(`Applied ${draft.name} to ${target?.label ?? 'the selection'}.`);
			libraryDraft = null;
			return true;
		} finally {
			busy = false;
		}
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

	function colourLabel(colour: PaintColour): string {
		if (colour.kind === 'literal') return colour.hex.toUpperCase();
		return scene()?.palette?.find((slot) => slot.id === colour.slotId)?.name ?? 'Colour';
	}

	function colourHex(colour: PaintColour): string {
		if (colour.kind === 'literal') return colour.hex;
		return scene()?.palette?.find((slot) => slot.id === colour.slotId)?.color ?? '#c4b4a0';
	}

	/** Whether a stored Finish key still names a Finish this project can paint. */
	function finishKeyResolves(key: string): boolean {
		if (key === 'model-own') return false;
		if (key.startsWith('curated:')) return materialById.has(key.slice('curated:'.length) as MaterialId);
		if (key.startsWith('project:')) {
			const id = key.slice('project:'.length);
			return scene()?.materials.some((material) => material.id === id) ?? false;
		}
		return false;
	}

	function colourKeyResolves(key: string): boolean {
		const colour = parseColourKey(key);
		if (colour === null) return false;
		return colour.kind === 'literal' || (scene()?.palette?.some((slot) => slot.id === colour.slotId) ?? false);
	}

	function paintTray(): PaintTrayView {
		const favouriteMaterials = new Set(prefs.favouriteMaterials);
		const favouriteColours = new Set(prefs.favouriteColours);
		const shelf = libraryShelf();
		const projectImages = new Map(shelf.project.map((entry) => [`project:${entry.id}`, entry.imageUri]));
		const finish = (key: string): PaintSwatch => ({
			kind: 'finish',
			key,
			label: labelOfKey(key),
			color: colorOfKey(key),
			favourite: favouriteMaterials.has(key),
			imageUri: projectImages.get(key) ?? null
		});
		const colour = (key: string): PaintSwatch => {
			const parsed = parseColourKey(key)!;
			return { kind: 'colour', key, label: colourLabel(parsed), color: colourHex(parsed), favourite: favouriteColours.has(key) };
		};
		const current = scene();
		const active: PaintSwatch | null =
			activeColour !== null
				? colour(colourKey(activeColour))
				: activeKey === null
					? null
					: finish(activeKey);
		return {
			colourEnabled: host.colourCoat !== undefined,
			active,
			dropper: dropper !== null,
			colours: {
				row: paintRow(prefs.favouriteColours, prefs.recentColours, colourKeyResolves).map((entry) => colour(entry.key)),
				palette: (current?.palette ?? []).map((slot) => ({ id: slot.id, name: slot.name, color: slot.color }))
			},
			materials: {
				row: paintRow(prefs.favouriteMaterials, prefs.recentMaterials, finishKeyResolves).map((entry) => finish(entry.key)),
				project: shelf.project.map((entry) => finish(`project:${entry.id}`)),
				curated: shelf.curated.map((entry) => finish(`curated:${entry.id}`))
			}
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


	/**
	 * A Library pick. With Paint armed, or with nothing selected, it arms Paint and
	 * writes nothing; otherwise it is a Replace of the selection's Finish.
	 */
	async function pickFinish(ref: SceneFinishRef): Promise<void> {
		const key = typeof ref === 'object' && 'curated' in ref ? `curated:${ref.curated}` : typeof ref === 'object' ? `project:${ref.project}` : 'model-own';
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
		activeKey = null;
	}

	/** Star or unstar the active pick. */
	function toggleActiveFavourite(): void {
		const active = activeColour !== null ? { kind: 'colour' as const, key: colourKey(activeColour) } : activeKey !== null && finishKeyResolves(activeKey) ? { kind: 'finish' as const, key: activeKey } : null;
		if (active === null) return;
		setPrefs(
			active.kind === 'colour'
				? { ...prefs, favouriteColours: toggleFavouriteKey(prefs.favouriteColours, active.key) }
				: { ...prefs, favouriteMaterials: toggleFavouriteKey(prefs.favouriteMaterials, active.key) }
		);
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
		});
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
			allocatedIds: [newId('scene-palette-slot', slotId)]
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
		const recipes = scene()?.materialIndex?.definitions as ReadonlyMap<string, import('@portfolio/project-model/materials').Recipe> | undefined;
		const colour = coatColourOf(instance, recipes);
		if (colour === null) return false;
		const pick: PaintColour = typeof colour === 'string' ? { kind: 'literal', hex: colour } : { kind: 'slot', slotId: colour.slot };
		if (pick.kind === 'slot' && !colourKeyResolves(colourKey(pick))) return false;
		activeColour = pick;
		activeKey = null;
		host.onNotice(`Paint · ${colourLabel(pick)}`);
		return true;
	}

	/**
	 * Paint commits one acceptance for every object a stroke crossed. It never
	 * edits a Finish, so it never asks. Objects already wearing the pick are left
	 * out of the write; when none is left the answer is `already`.
	 */
	async function paintEntities(entityIds: readonly string[]): Promise<'accepted' | 'already' | 'refused'> {
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
		const accepted = await assign(targets.map((view) => view.entityId), ref);
		if (accepted) noteUsed(key);
		return accepted ? 'accepted' : 'refused';
	}

	/** Paint one or more stable Layout surfaces in one Scene acceptance. */
	async function paintSurface(surfaces: readonly PaintableSurface[]): Promise<boolean> {
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
		const accepted = await assignSurfaces(surfaces, ref);
		if (accepted) noteUsed(activeKey);
		return accepted;
	}

	/** Assign one Finish to Layout surfaces: one acceptance, one Undo. */
	async function assignSurfaces(
		surfaces: readonly PaintableSurface[],
		ref: Exclude<SceneFinishRef, 'model-own'>
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
		if (activeColour !== null) {
			return host.colourCoat?.isAlready?.({ entityIds: [], surfaces }, activeColour) ?? false;
		}
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
		dropper = false;
		if (current === null) {
			host.onNotice('That has no Finish colour.');
			return false;
		}
		const assignment = current.surfaceFinishes?.find((entry) => surfaceKey(entry.surface) === surfaceKey(surface));
		if (assignment === undefined) {
			host.onNotice('That has no Finish colour.');
			return false;
		}
		const key = finishKeyOfSurface(current, assignment);
		if ('materialInstanceId' in assignment.finish && armCoatColour(materialInstanceById(current.materials, assignment.finish.materialInstanceId))) {
			return true;
		}
		activate(key);
		host.onNotice(`Paint · ${labelOfKey(key)}`);
		return true;
	}

	/** The name of what a surface or object wears now (the consequence line); `null` when it has none. */
	function wornLabel(target: { readonly surface: PaintableSurface } | { readonly entityId: string }): string | null {
		if ('entityId' in target) return viewFor(target.entityId)?.label ?? null;
		const current = scene();
		const assignment = current?.surfaceFinishes?.find((entry) => surfaceKey(entry.surface) === surfaceKey(target.surface));
		return current === null || assignment === undefined ? null : labelOfKey(finishKeyOfSurface(current, assignment));
	}

	/** What the active colour does to a target; `null` while the pick is a material. */
	function coatReading(target: { readonly surface: PaintableSurface } | { readonly entityId: string }): CoatReading | null {
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
	function replaceImageFor(entityId: string, file: File, mode: 'just-this' | 'all' | 'in-place'): Promise<void> {
		const context = captureImageWrite();
		if (context === null) {
			host.onNotice('The Stage is still opening.');
			return Promise.resolve();
		}
		return imageFlow.begin(file, async (image, warning) => {
			if (!imageWriteIsCurrent(context)) return { kind: 'no-op' };
			const latest = viewFor(entityId);
			if (latest === null || !latest.editable) {
				return { kind: 'refused', message: "A model's own materials take no edits. Paint a material first." };
			}
			return applyImageReplace(entityId, image, latest.users, mode, warning, context);
		});
	}

	const catalogueLabel = (id: MaterialId): string => (materialById.has(id) ? getMaterial(id).label : id);
	/** The quick Finish on the Card (U4): its one adapter. */
	const card: FinishCard = createFinishCard({
		services: servicesNow,
		labelForMaterial: catalogueLabel,
		facts: materialTreatmentFacts(catalogueLabel),
		swatchOf: (id) => {
			if (!materialById.has(id)) return '#c4b4a0';
			const material = getMaterial(id);
			return material.swatchColor ?? material.fallbackColor;
		},
		isFavourite: isFavouriteMaterial,
		toggleFavourite: toggleFavouriteMaterial,
		replaceImage: replaceImageFor,
		onAccepted: () => undefined
	});

	function setActive(entityId: string): void {
		const view = viewFor(entityId);
		if (view === null || view.key === 'model-own') {
			host.onNotice('That has no Finish colour.');
			return;
		}
		activate(view.key);
	}

	function activeLabel(): string {
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
		return activeKey !== null || activeColour !== null;
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
			return activeColour !== null
				? { kind: 'colour', colour: activeColour }
				: activeKey === null
					? null
					: { kind: 'finish', key: activeKey };
		},
		get dropperArmed() {
			return dropper;
		},
		get busy() {
			return busy;
		},
		get image(): FinishImageState {
			return imageFlow.state;
		},
		card,
		libraryShelf,
		libraryBrowse,
		libraryTarget,
		selectFinishUsers,
		applyLibraryFinish,
		openLibraryDraft,
		setLibraryDraftStep,
		cancelLibraryDraft,
		libraryDraftStatus,
		applyLibraryDraft,
		get libraryDraft() {
			return libraryDraft;
		},
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
		retryImageUpload: () => imageFlow.retry(),
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
		openFinishes: () => host.openFinishes()
	};
}

export type FinishAuthoring = ReturnType<typeof createFinishAuthoring>;
