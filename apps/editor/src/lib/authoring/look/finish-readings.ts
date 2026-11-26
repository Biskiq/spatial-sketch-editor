import {
	baseMaterialIdOf,
	catalogueBaseOf,
	finishOf,
	finishRefOfKey,
	followerSlotOf,
	isFinishPaintable,
	isPristineInstance,
	literalColorOf,
	materialInstanceById,
	metalReading,
	paletteHasRoom,
	usersOfFinish,
} from '@portfolio/project-model/scene-planning';
import type {
	MaterialId,
	SceneEntity,
	SceneMaterialInstance,
} from '@portfolio/project-model/scene';
import { getMaterial, materialById } from '$lib/content/materials';
import { stageEnvelope, type StageReadSnapshot } from '../stage/stage-adapter-host';
import type {
	FinishAuthoringHost,
	FinishEntityView,
	FinishPaletteView,
	PaintSwatch,
	PaintTrayView,
} from './finish-authoring-contract';
import { finishImageWarning } from './finish-image.svelte';
import type { createFinishLibraryAuthoring } from './finish-library.svelte';
import { colourKey, paintRow, parseColourKey, type PaintColour } from './paint-pick';
import type { PaintPreferences } from './paint-preferences';

type SceneNow = StageReadSnapshot['domain']['scene'];
type FinishTextureReadings = Pick<
	FinishAuthoringHost,
	'textureUri' | 'texturePreviewUri' | 'imageDimensions' | 'textureFailed'
>;

export function finishLabel(current: SceneNow | null, key: string): string {
	if (key === 'model-own') return "Model's own";
	if (key.startsWith('curated:')) {
		const id = key.slice('curated:'.length) as MaterialId;
		return getMaterial(id).label;
	}
	const id = key.slice('project:'.length);
	return current?.materials.find((material) => material.id === id)?.name ?? 'Finish';
}

/** The immutable definition a resource-backed Finish names. */
export function finishDefinition(
	current: SceneNow | null,
	instance: SceneMaterialInstance | undefined,
): import('@portfolio/project-model/materials').Recipe | null {
	if (instance === undefined || !('material' in instance.base)) return null;
	return current?.materialIndex?.definitions.get(instance.base.material) ?? null;
}

/** The local texture id an inherited or overridden binding resolves to. */
export function finishTextureId(
	current: SceneNow | null,
	instance: SceneMaterialInstance | undefined,
	role: 'color' | 'normal' | 'roughness' | 'metalness' | 'occlusion',
): string | null {
	const override = instance?.overrides?.maps?.[role];
	if (override === null) return null;
	if (override !== undefined) {
		return 'textureId' in override.image ? override.image.textureId : null;
	}
	const definition = finishDefinition(current, instance);
	if (definition === null) return null;
	const binding = definition.maps[role];
	if (binding === undefined) return null;
	const hash =
		instance !== undefined && 'material' in instance.base ? instance.base.material : null;
	const image =
		hash === null
			? undefined
			: current?.materialIndex?.definitionImages
					.get(hash)
					?.find((entry) => entry.hash === binding.image);
	return image !== undefined && 'textureId' in image.source ? image.source.textureId : null;
}

export function finishColour(current: SceneNow | null, key: string): string {
	if (current === null) return '#c4b4a0';
	if (key === 'model-own') return '#c4b4a0';
	if (key.startsWith('curated:')) {
		const material = getMaterial(key.slice('curated:'.length) as MaterialId);
		return material.swatchColor ?? material.fallbackColor;
	}
	const instance = current.materials.find(
		(material) => material.id === key.slice('project:'.length),
	);
	if (instance === undefined) return '#c4b4a0';
	const color = instance.overrides?.color;
	if (color === undefined) {
		const base = catalogueBaseOf(instance);
		const definition = finishDefinition(current, instance);
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
export function readFinishEntity(
	snapshot: StageReadSnapshot,
	entityId: string,
	textures: FinishTextureReadings,
): FinishEntityView | null {
	const current = snapshot.domain.scene;
	const entity = current.entities.find((candidate) => candidate.id === entityId) ?? null;
	if (entity === null || !isFinishPaintable(entity)) return null;
	const key = finishOf(entity, current.materials);
	if (key === null) return null;
	const ref = finishRefOfKey(key);
	if (ref === null) return null;
	const instance = materialInstanceById(
		current.materials,
		(entity as SceneEntity & { materialInstanceId?: string }).materialInstanceId,
	);
	const baseMaterialId = baseMaterialIdOf(entity, current.materials);
	const definition = finishDefinition(current, instance);
	const catalogueId =
		instance !== undefined && 'catalogue' in instance.base
			? instance.base.catalogue
			: baseMaterialId;
	const catalogue =
		catalogueId !== null && materialById.has(catalogueId as MaterialId)
			? getMaterial(catalogueId as MaterialId)
			: null;
	const baseLabel =
		definition !== null ? 'Imported material' : (catalogue?.label ?? baseMaterialId ?? 'Finish');
	const roughness =
		instance?.overrides?.roughness ?? definition?.roughness ?? catalogue?.roughness ?? 0.5;
	const roughnessAuthored = instance?.overrides?.roughness !== undefined;
	const metalness =
		instance?.overrides?.metalness ?? definition?.metalness ?? catalogue?.metalness ?? 0;
	const metal = metalReading(metalness);
	const literal = literalColorOf(entity, current.materials);
	const follower = followerSlotOf(entity, current.materials);
	const effectiveColor =
		literal ??
		(follower === null
			? undefined
			: current.palette?.find((slot) => slot.id === follower)?.color) ??
		definition?.color ??
		catalogue?.fallbackColor ??
		'#c4b4a0';
	const users = usersOfFinish(current, key, stageEnvelope(snapshot).units.layout.data).length;
	const isModelOwn = key === 'model-own';
	const colorMapId = finishTextureId(current, instance, 'color');
	const textureRecordUri = colorMapId === null ? null : (textures.textureUri?.(colorMapId) ?? null);
	// A project texture is authenticated bytes: CSS cannot fetch the Scene URI
	// from the editor origin, so the preview uses the scope's retained URL.
	const colorMapUri =
		colorMapId === null
			? (catalogue?.textures?.map ?? null)
			: textureRecordUri !== null && textureRecordUri.startsWith('/project-assets/')
				? (textures.texturePreviewUri?.(colorMapId) ?? null)
				: textureRecordUri;
	const imageDimensions =
		colorMapId === null ? null : (textures.imageDimensions?.(colorMapId) ?? null);
	const hasColorImage = Boolean(colorMapId ?? definition?.maps.color ?? catalogue?.textures?.map);
	const tileSizeAvailable = Boolean(
		(instance?.overrides?.maps !== undefined && Object.keys(instance.overrides.maps).length > 0) ||
			(definition !== null && Object.keys(definition.maps).length > 0) ||
			(catalogue?.textures !== undefined && Object.keys(catalogue.textures).length > 0),
	);
	const palette = current.palette ?? [];
	return {
		entityId,
		entityName: entity.name,
		kind: entity.kind as 'primitive' | 'form' | 'model',
		key,
		ref,
		label: isModelOwn
			? "Model's own"
			: key.startsWith('project:')
				? (instance?.name ?? finishLabel(current, key))
				: baseLabel,
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
		colorMapFailed:
			textureRecordUri !== null && (textures.textureFailed?.(textureRecordUri) ?? false),
		colorMapWarning:
			imageDimensions === null
				? null
				: finishImageWarning(imageDimensions.width, imageDimensions.height),
		tileMeters:
			instance?.overrides?.mapping !== undefined && instance.overrides.mapping.kind !== 'uv'
				? instance.overrides.mapping.metric.tileMeters
				: definition?.mapping.kind !== 'uv' && definition?.mapping !== undefined
					? definition.mapping.metric.tileMeters
					: null,
		defaultTileMeters:
			definition?.mapping.kind === 'target'
				? definition.mapping.metric.tileMeters
				: (catalogue?.defaultTileSizeMeters ?? [1, 1]),
		rotation:
			instance?.overrides?.mapping !== undefined && instance.overrides.mapping.kind !== 'uv'
				? instance.overrides.mapping.metric.rotation
				: definition?.mapping.kind !== 'uv' && definition?.mapping !== undefined
					? definition.mapping.metric.rotation
					: 0,
		tileSizeAvailable,
		directionAvailable: hasColorImage,
		canEditMapping: entity.kind !== 'model',
		scaleApproximate: entity.kind === 'primitive' && entity.primitive === 'box',
		canSaveToPalette:
			literal !== null &&
			paletteHasRoom(palette) &&
			!palette.some((slot) => slot.color === literal),
		paletteRoom: paletteHasRoom(palette),
		originalWritesWhite: hasColorImage && instance?.overrides?.maps?.color !== undefined,
	};
}

export function readFinishPalette(current: SceneNow | null): FinishPaletteView {
	const slots = current?.palette ?? [];
	return {
		room: paletteHasRoom(slots),
		slots: slots.map((slot) => ({
			id: slot.id,
			name: slot.name,
			color: slot.color,
			users:
				current?.materials.filter(
					(material) =>
						material.overrides?.color !== undefined &&
						typeof material.overrides.color !== 'string' &&
						material.overrides.color.slot === slot.id,
				).length ?? 0,
		})),
	};
}

export function paintColourLabel(current: SceneNow | null, colour: PaintColour): string {
	if (colour.kind === 'literal') return colour.hex.toUpperCase();
	return current?.palette?.find((slot) => slot.id === colour.slotId)?.name ?? 'Colour';
}

function colourHex(current: SceneNow | null, colour: PaintColour): string {
	if (colour.kind === 'literal') return colour.hex;
	return current?.palette?.find((slot) => slot.id === colour.slotId)?.color ?? '#c4b4a0';
}

/** Whether a stored Finish key still names a Finish this project can paint. */
export function finishKeyResolves(current: SceneNow | null, key: string): boolean {
	if (key === 'model-own') return false;
	if (key.startsWith('curated:'))
		return materialById.has(key.slice('curated:'.length) as MaterialId);
	if (key.startsWith('project:')) {
		const id = key.slice('project:'.length);
		return current?.materials.some((material) => material.id === id) ?? false;
	}
	return false;
}

export function colourKeyResolves(current: SceneNow | null, key: string): boolean {
	const colour = parseColourKey(key);
	if (colour === null) return false;
	return (
		colour.kind === 'literal' ||
		(current?.palette?.some((slot) => slot.id === colour.slotId) ?? false)
	);
}

export function readPaintTray(
	current: SceneNow | null,
	shelf: Pick<
		ReturnType<ReturnType<typeof createFinishLibraryAuthoring>['libraryShelf']>,
		'curated' | 'project'
	>,
	prefs: PaintPreferences,
	paint: {
		readonly activeKey: string | null;
		readonly activeColour: PaintColour | null;
		readonly colourEnabled: boolean;
		readonly dropper: boolean;
	},
): PaintTrayView {
	const { activeKey, activeColour } = paint;
	const favouriteMaterials = new Set(prefs.favouriteMaterials);
	const favouriteColours = new Set(prefs.favouriteColours);
	const projectImages = new Map(
		shelf.project.map((entry) => [`project:${entry.id}`, entry.imageUri]),
	);
	const finish = (key: string): PaintSwatch => ({
		kind: 'finish',
		key,
		label: finishLabel(current, key),
		color: finishColour(current, key),
		favourite: favouriteMaterials.has(key),
		imageUri: projectImages.get(key) ?? null,
	});
	const colour = (key: string): PaintSwatch => {
		const parsed = parseColourKey(key)!;
		return {
			kind: 'colour',
			key,
			label: paintColourLabel(current, parsed),
			color: colourHex(current, parsed),
			favourite: favouriteColours.has(key),
		};
	};
	const active: PaintSwatch | null =
		activeColour !== null
			? colour(colourKey(activeColour))
			: activeKey === null
				? null
				: finish(activeKey);
	return {
		colourEnabled: paint.colourEnabled,
		active,
		dropper: paint.dropper,
		colours: {
			row: paintRow(prefs.favouriteColours, prefs.recentColours, (key) =>
				colourKeyResolves(current, key),
			).map((entry) => colour(entry.key)),
			palette: (current?.palette ?? []).map((slot) => ({
				id: slot.id,
				name: slot.name,
				color: slot.color,
			})),
		},
		materials: {
			row: paintRow(prefs.favouriteMaterials, prefs.recentMaterials, (key) =>
				finishKeyResolves(current, key),
			).map((entry) => finish(entry.key)),
			project: shelf.project.map((entry) => finish(`project:${entry.id}`)),
			curated: shelf.curated.map((entry) => finish(`curated:${entry.id}`)),
		},
	};
}
