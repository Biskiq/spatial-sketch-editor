/**
 * The Scene render description: resolved Scene in, frozen items out.
 *
 * This is the render-description layer for Scene content. The accepted Scene is
 * already a derived description (one resolution per changed unit, retained per
 * unit); this module turns it into per-drawable items — what
 * to draw, never how — and memoises the conversion by the Scene value's identity.
 *
 * Two properties are the point:
 *
 * - **One conversion per Scene identity.** An edit that does not touch Scene
 *   yields the same `RuntimeScene` object, so the same description object comes
 *   back and every layer below does nothing. Svelte never re-resolves a look or
 *   re-derives a form for an unrelated accept.
 * - **Identity is decided here, once.** A look produces a canonical material
 *   descriptor; a shape produces a geometry store key. Two entities with one look
 *   therefore carry the same descriptor, and sharing is a property of the
 *   description rather than of whichever component mounted first.
 *
 * Forms are the one content family whose geometry is not unit-scale. The item
 * carries the kernel's canonical evaluated mesh (from the existing evaluation
 * cache) so the geometry store can build its one buffer without an evaluator of
 * its own; when the lazy form kernel has not arrived yet, form items are omitted.
 */
import {
	isSceneFormEntity,
	isSceneModelEntity,
	isScenePrimitiveEntity,
} from '@portfolio/project-model/scene';
import { getAssetById } from '$lib/content/assets';
import { getMaterial } from '$lib/content/materials';
import {
	fallbackDimensionsFor,
	fallbackKindFor,
	type AssetFallbackKind,
} from '$lib/render/assets/fallbacks';
import { fallbackPartsFor, type FallbackPart } from '$lib/render/assets/fallback-shapes';
import { artworkFrameLayout, artworkHeight } from '@portfolio/project-model/artwork';
import type {
	RuntimeScene,
	SceneArtworkEntity,
	SceneFormEntity,
	SceneFormSource,
	SceneModelEntity,
	ScenePrimitiveEntity,
} from '@portfolio/project-model/scene';
import type { FormMesh } from '@portfolio/geometry-core';
import { materialKey } from './resources/material-descriptor';
import {
	geometryKeyOf,
	type GeometrySpec,
	type SceneArtworkItem,
	type SceneModelFallbackPart,
	type SceneModelItem,
	type SceneModelLook,
	type SceneRenderDescription,
	type SceneRenderItem,
	type SceneTransform,
	type SceneVec3,
} from './resources/scene-render-item';
import { sceneFinishFor } from '$lib/render/materials/scene-instance-material';
import type { StandardMaterialDescriptor } from './resources/material-descriptor';

/** One canonical Form evaluation, as the lazy form kernel produces it. */
export type SceneFormGeometry = {
	readonly evaluationKey: string;
	readonly mesh: FormMesh;
	readonly plane: 'plan' | 'elevation';
};

/**
 * The lazily loaded Form kernel, injected.
 *
 * `VisitorEntityGroups` fetches it only once a document carries a form, so a
 * project without forms never downloads the kernel or its adapter. The same
 * seam is what keeps `scene-entity-representation` free of project-model: the
 * representation receives items, never a form source.
 */
export type SceneFormSupport = {
	evaluate(form: SceneFormSource): SceneFormGeometry | null;
};

const descriptions = new WeakMap<
	RuntimeScene,
	Map<SceneFormSupport | null, SceneRenderDescription>
>();

function cached(
	scene: RuntimeScene,
	forms: SceneFormSupport | null,
	build: () => SceneRenderDescription,
): SceneRenderDescription {
	let bySupport = descriptions.get(scene);
	if (bySupport === undefined) {
		bySupport = new Map();
		descriptions.set(scene, bySupport);
	}
	const hit = bySupport.get(forms);
	if (hit !== undefined) return hit;
	const description = build();
	bySupport.set(forms, description);
	return description;
}

export function scenePrimitiveGeometry(entity: ScenePrimitiveEntity): {
	readonly spec: GeometrySpec;
	readonly scale: SceneVec3;
} {
	switch (entity.primitive) {
		case 'box':
			return {
				spec: { kind: 'unit', shape: 'box' },
				scale: [entity.dimensions.width, entity.dimensions.height, entity.dimensions.depth],
			};
		case 'plane':
			return {
				spec: { kind: 'unit', shape: 'plane' },
				scale: [entity.dimensions.width, entity.dimensions.height, 1],
			};
		case 'cylinder':
			// A unit cylinder scaled to `(2r, h, 2r)` matches a cylinder built at
			// size, vertex for vertex (the geometry parity test proves it).
			return {
				spec: { kind: 'unit', shape: 'cylinder', radialSegments: 32 },
				scale: [
					entity.dimensions.radius * 2,
					entity.dimensions.height,
					entity.dimensions.radius * 2,
				],
			};
		case 'sphere':
			return {
				spec: { kind: 'unit', shape: 'sphere', widthSegments: 32, heightSegments: 24 },
				scale: [
					entity.dimensions.radius * 2,
					entity.dimensions.radius * 2,
					entity.dimensions.radius * 2,
				],
			};
	}
}

/**
 * The primitive's tiling surface in **metres**, including the entity's uniform
 * scale (owner ruling D1).
 *
 * A primitive's UVs are 0..1 per face, so without this a scaled primitive's
 * tiles stretch with it. The surface is the authored size times `scale`, which
 * keeps one tile at its authored metre size on a scaled object. This is an
 * intentional appearance change for existing scaled, textured primitives.
 *
 * **Box approximation:** a box uses width × depth for every face, so its side
 * faces tile as if they were as deep as the box. This is the existing
 * behaviour and S4b keeps it; the Card says "Scale is approximate on boxes".
 */
export function scenePrimitiveSurfaceMeters(entity: ScenePrimitiveEntity): [number, number] {
	const scale = entity.scale ?? 1;
	const surface: [number, number] = (() => {
		switch (entity.primitive) {
			case 'box':
				return [entity.dimensions.width, entity.dimensions.depth];
			case 'plane':
				return [entity.dimensions.width, entity.dimensions.height];
			case 'cylinder':
				return [entity.dimensions.radius * 2, entity.dimensions.height];
			case 'sphere':
				return [entity.dimensions.radius * 2, entity.dimensions.radius * 2];
		}
	})();
	return [surface[0] * scale, surface[1] * scale];
}

function entityTransform(
	entity: ScenePrimitiveEntity | SceneFormEntity,
	scale: number,
): SceneTransform {
	return {
		position: [entity.position[0], entity.position[1], entity.position[2]],
		rotation: [entity.rotation[0], entity.rotation[1], entity.rotation[2]],
		scale: [scale, scale, scale],
	};
}

/**
 * The content key: everything that changes the drawn result, and nothing else.
 *
 * A retained item compares this string. A transform, look, texture variant,
 * geometry or shadow flag change rebuilds; an unrelated entity's edit does not.
 */
function itemKey(
	id: string,
	geometry: GeometrySpec,
	geometryScale: SceneVec3,
	material: SceneRenderItem['material'],
	textures: SceneRenderItem['textures'],
	transform: SceneTransform,
	castShadow: boolean,
	receiveShadow: boolean,
): string {
	return [
		id,
		geometryKeyOf(geometry),
		...geometryScale,
		materialKey(material),
		textures === null
			? 'none'
			: `${textures.variantSeed}@${textures.repeat[0]}x${textures.repeat[1]}@${textures.rotation}@${textures.offset[0]}x${textures.offset[1]}@${(
					textures.views ?? []
				)
					.map((view) => `${view.view}=${view.uri}`)
					.join(',')}`,
		...transform.position,
		...transform.rotation,
		...transform.scale,
		castShadow ? 1 : 0,
		receiveShadow ? 1 : 0,
	].join('|');
}

/**
 * One Artwork's resolved item: the frame layout evaluated once.
 *
 * Exported because the Stage's placement ghost is the same handler over one
 * item; it is still this one conversion, not a second reading of the frame.
 */
export function describeSceneArtwork(entity: SceneArtworkEntity): SceneArtworkItem {
	const { assetId, pixelWidth, pixelHeight } = entity.source;
	const width = entity.widthMeters;
	const height = artworkHeight(width, entity.source);
	const layout = artworkFrameLayout(width, height, entity.frame);
	const frame =
		layout.faceMeters > 0 && layout.frameColor !== null
			? ({
					geometry: {
						kind: 'artwork-frame',
						outerWidth: layout.outerWidth,
						outerHeight: layout.outerHeight,
						faceMeters: layout.faceMeters,
						depth: layout.depth,
					},
					color: layout.frameColor,
					z: 0,
				} as const)
			: null;
	const mat =
		layout.mat !== null
			? ({
					geometry: {
						kind: 'artwork-mat',
						width: layout.mat.width,
						height: layout.mat.height,
						innerWidth: layout.mat.innerWidth,
						innerHeight: layout.mat.innerHeight,
					},
					color: layout.matColor,
					z: layout.mat.z,
				} as const)
			: null;
	const backing =
		layout.backing !== null && layout.backingColor !== null
			? ({
					geometry: {
						kind: 'artwork-backing',
						width: layout.backing.width,
						height: layout.backing.height,
					},
					color: layout.backingColor,
					z: layout.backing.z,
				} as const)
			: null;
	const position: SceneVec3 = [entity.position[0], entity.position[1], entity.position[2]];
	const rotation: SceneVec3 = [entity.rotation[0], entity.rotation[1], entity.rotation[2]];
	const body = (part: { geometry: GeometrySpec; color: string; z: number } | null): string =>
		part === null ? '-' : `${geometryKeyOf(part.geometry)}@${part.color}@${part.z}`;
	return {
		id: entity.id,
		image: { assetId, pixelWidth, pixelHeight },
		sourceKey: `${assetId}/${pixelWidth}/${pixelHeight}`,
		bodyKey: [width, height, body(frame), body(mat), body(backing)].join('|'),
		placementKey: [...position, ...rotation].join('|'),
		position,
		rotation,
		imageSize: [width, height],
		frame,
		mat,
		backing,
	};
}

/**
 * One fallback part as a store geometry. Boxes, planes, spheres and closed
 * equal-radius cylinders are the unit geometries scaled to size, exactly as a
 * primitive is; a tapered or open cylinder is built at size under its own key.
 */
function fallbackGeometry(primitive: FallbackPart['primitive']): {
	readonly spec: GeometrySpec;
	readonly scale: SceneVec3;
} {
	switch (primitive.shape) {
		case 'box':
			return { spec: { kind: 'unit', shape: 'box' }, scale: [...primitive.size] };
		case 'plane':
			return {
				spec: { kind: 'unit', shape: 'plane' },
				scale: [primitive.width, primitive.height, 1],
			};
		case 'sphere': {
			const d = primitive.radius * 2;
			return {
				spec: {
					kind: 'unit',
					shape: 'sphere',
					widthSegments: primitive.widthSegments,
					heightSegments: primitive.heightSegments,
				},
				scale: [d, d, d],
			};
		}
		case 'cylinder': {
			if (primitive.radiusTop === primitive.radiusBottom && !primitive.openEnded) {
				const d = primitive.radiusTop * 2;
				return {
					spec: { kind: 'unit', shape: 'cylinder', radialSegments: primitive.radialSegments },
					scale: [d, primitive.height, d],
				};
			}
			return {
				spec: {
					kind: 'frustum',
					radiusTop: primitive.radiusTop,
					radiusBottom: primitive.radiusBottom,
					height: primitive.height,
					radialSegments: primitive.radialSegments,
					openEnded: primitive.openEnded,
				},
				scale: [1, 1, 1],
			};
		}
	}
}

/**
 * The fallback surface: the catalogue's untextured look, as `FallbackMaterial`
 * (`CatalogueMaterial` with `textures="off"`) acquired it.
 */
function fallbackDescriptor(part: FallbackPart, wireframe: boolean): StandardMaterialDescriptor {
	const definition = getMaterial(part.materialId);
	return {
		kind: 'standard',
		color: part.tint ?? definition.fallbackColor,
		roughness: definition.roughness,
		metalness: definition.metalness,
		toneMapped: true,
		...(wireframe ? { wireframe: true } : {}),
	};
}

/** What one model draws, as the Scene (or the asset QA page) states it. */
export type SceneModelInput = {
	readonly id: string;
	readonly assetId: string;
	/** The authored placement fallback; the catalogue's fallback when absent. */
	readonly fallback?: AssetFallbackKind;
	/** A creator model's approved footprint (metres); sizes the generic box. */
	readonly footprint?: { readonly width: number; readonly depth: number };
	readonly position: SceneVec3;
	readonly rotation: SceneVec3;
	readonly scale: number;
	readonly look: SceneModelLook | null;
	/** A resolve-time Treatment for the asset's own materials; a remap carries its own. */
	readonly treatment?: 'flat-colour' | 'clay';
	readonly wireframe?: boolean;
	readonly shadows?: boolean;
	readonly visible?: boolean;
};

/**
 * One model's resolved item. The catalogue record, the fallback body and
 * the shadow defaults are decided here once, with the rules `AssetModel` applied:
 *
 * - the placement fallback wins; otherwise the catalogue's; a creator model (absent
 *   from the catalogue) draws its approved footprint box;
 * - the catalogue file loads only when the asset is approved or testing;
 * - fallback shadows default off and drawn-model shadows default on.
 *
 * Exported because the asset QA page draws the same handler over its own items.
 */
export function describeSceneModel(input: SceneModelInput): SceneModelItem {
	const asset = getAssetById(input.assetId);
	const kind = fallbackKindFor(input.fallback, asset);
	const dimensions = fallbackDimensionsFor(kind, input.footprint);
	const wireframe = input.wireframe ?? false;
	const shadows = input.shadows ?? true;
	const visible = input.visible ?? true;
	const parts: SceneModelFallbackPart[] = fallbackPartsFor(kind, dimensions).map((part) => {
		const geometry = fallbackGeometry(part.primitive);
		return {
			geometry: geometry.spec,
			geometryScale: geometry.scale,
			position: [...part.position],
			rotation: [...part.rotation],
			material: fallbackDescriptor(part, wireframe),
		};
	});
	const fallbackCast = shadows && (asset?.castShadow ?? false);
	const fallbackReceive = shadows && (asset?.receiveShadow ?? false);
	const castShadow = shadows && (asset?.castShadow ?? true);
	const receiveShadow = shadows && (asset?.receiveShadow ?? true);
	const catalogueUrl =
		asset?.productionFile !== undefined &&
		(asset.status === 'approved' || asset.status === 'testing')
			? asset.productionFile
			: null;
	const presentation = {
		rotation: [...(asset?.defaultRotation ?? [0, 0, 0])] as unknown as SceneVec3,
		scale: asset?.defaultScale ?? 1,
	};
	const transform: SceneTransform = {
		position: [...input.position],
		rotation: [...input.rotation],
		scale: [input.scale, input.scale, input.scale],
	};
	const look = input.look;
	return {
		id: input.id,
		assetId: input.assetId,
		catalogueUrl,
		sourceKey: [
			input.assetId,
			catalogueUrl ?? '-',
			...presentation.rotation,
			presentation.scale,
		].join('|'),
		placementKey: [...transform.position, ...transform.rotation, input.scale, visible ? 1 : 0].join(
			'|',
		),
		fallbackKey: [
			kind,
			...dimensions,
			wireframe ? 1 : 0,
			fallbackCast ? 1 : 0,
			fallbackReceive ? 1 : 0,
		].join('|'),
		styleKey: [
			look?.variantSeed ?? '-',
			look?.color ?? '-',
			look?.roughness ?? '-',
			look?.metalness ?? '-',
			look?.normalScale?.join(',') ?? '-',
			// The legacy variant seed predates Finish, so two structurally
			// different plans can share it. Include the plan and its resolved image
			// sources so a restyle cannot retain the previous graph or bytes.
			look?.finish === undefined ? '-' : JSON.stringify(look.finish),
			look?.slotUris === undefined
				? '-'
				: Object.entries(look.slotUris)
						.sort(([left], [right]) => left.localeCompare(right))
						.map(([slot, uri]) => `${slot}=${uri}`)
						.join(','),
			input.treatment ?? '-',
			wireframe,
			castShadow,
			receiveShadow,
		].join('|'),
		transform,
		visible,
		presentation,
		fallback: {
			kind,
			dimensions: [...dimensions],
			parts,
			castShadow: fallbackCast,
			receiveShadow: fallbackReceive,
		},
		look,
		...(input.treatment === undefined ? {} : { treatment: input.treatment }),
		wireframe,
		castShadow,
		receiveShadow,
	};
}

function sceneModelItem(entity: SceneModelEntity, scene: RuntimeScene): SceneModelItem {
	// The resolved look a model's meshes are remapped to; without an instance the
	// asset keeps its own materials. `paper-aged` is the catalogue fallback the
	// per-entity renderer used for a model instance. A remap keeps the model's own
	// UV0, so a metric tile mapping has no basis and is ignored; an explicit UV
	// mapping, the normal strength and the flip still apply.
	const effective = entity.materialInstanceId
		? sceneFinishFor(
				scene,
				{
					materialInstanceId: entity.materialInstanceId,
					fallbackCatalogueId: 'paper-aged',
				},
				// A legacy model remap keeps identity UV0: the model's own chart is the
				// coordinate owner and the Finish's metric tile does not apply. The
				// GLB has not arrived yet, so both UV sets are provisionally admitted;
				// `model-realization` re-checks the actual draw before binding.
				{ kind: 'legacy', uvSets: [0, 1], normalFrameSets: [0, 1] },
			)
		: null;
	const look: SceneModelLook | null =
		effective === null
			? null
			: {
					color:
						typeof effective.material.color === 'string' ? effective.material.color : '#ffffff',
					roughness: effective.material.roughness,
					metalness: effective.material.metalness,
					variantSeed: effective.textures?.variantSeed ?? 'v-legacy',
					slotUris: effective.textures?.slotUris ?? {},
					...(effective.material.normalScale === undefined
						? {}
						: { normalScale: effective.material.normalScale }),
					...(effective.material.finish === undefined ? {} : { finish: effective.material.finish }),
					...(effective.textures?.views === undefined ? {} : { views: effective.textures.views }),
					...(entity.materialInstanceId !== undefined
						? { finishKey: `project:${entity.materialInstanceId}` }
						: {}),
				};
	const footprint = scene.modelFootprints?.get(entity.assetId);
	return describeSceneModel({
		id: entity.id,
		assetId: entity.assetId,
		fallback: entity.fallback,
		...(footprint === undefined ? {} : { footprint }),
		position: [entity.position[0], entity.position[1], entity.position[2]],
		rotation: [entity.rotation[0], entity.rotation[1], entity.rotation[2]],
		scale: entity.scale ?? 1,
		look,
		...(scene.environment?.treatment === undefined
			? {}
			: { treatment: scene.environment.treatment }),
	});
}

export function describeSceneRender(
	scene: RuntimeScene,
	forms: SceneFormSupport | null = null,
): SceneRenderDescription {
	return cached(scene, forms, () => {
		const items: SceneRenderItem[] = [];
		const artworks: SceneArtworkItem[] = [];
		const models: SceneModelItem[] = [];

		for (const entity of scene.entities) {
			if (isSceneModelEntity(entity)) {
				models.push(sceneModelItem(entity, scene));
				continue;
			}
			if (entity.kind === 'artwork') {
				artworks.push(describeSceneArtwork(entity));
				continue;
			}
			if (isScenePrimitiveEntity(entity)) {
				const geometry = scenePrimitiveGeometry(entity);
				const surface = scenePrimitiveSurfaceMeters(entity);
				const look = sceneFinishFor(
					scene,
					{
						materialInstanceId: entity.materialInstanceId ?? null,
						fallbackCatalogueId: entity.materialId,
					},
					// A primitive's UV0 is 0..1 per face, so one UV unit spans the
					// rendered surface in each axis; the box approximation is retained.
					{
						kind: 'metric',
						uvMeters: [surface[0], surface[1]],
						surfaceMeters: [surface[0], surface[1]],
					},
				);
				const transform = entityTransform(entity, entity.scale ?? 1);
				items.push({
					id: entity.id,
					key: itemKey(
						entity.id,
						geometry.spec,
						geometry.scale,
						look.material,
						look.textures,
						transform,
						entity.castShadow,
						entity.receiveShadow,
					),
					geometry: geometry.spec,
					geometryScale: geometry.scale,
					material: look.material,
					textures: look.textures,
					finishKey:
						entity.materialInstanceId !== undefined
							? `project:${entity.materialInstanceId}`
							: `curated:${entity.materialId}`,
					transform,
					castShadow: entity.castShadow,
					receiveShadow: entity.receiveShadow,
				});
				continue;
			}
			if (!isSceneFormEntity(entity)) continue;
			// Until the lazy kernel arrives a form has no drawable geometry. The
			// description omits it, and a new description is built when the kernel
			// arrives.
			const form = forms?.evaluate(entity.form) ?? null;
			if (form === null) continue;
			const look = sceneFinishFor(
				scene,
				{
					materialInstanceId: entity.materialInstanceId ?? null,
					fallbackCatalogueId: entity.materialId,
				},
				// Form UVs are metres, so one native unit is one metre.
				{ kind: 'metric', uvMeters: [1, 1], surfaceMeters: [1, 1] },
			);
			const geometry: GeometrySpec = {
				kind: 'form',
				evaluationKey: form.evaluationKey,
				mesh: form.mesh,
				plane: form.plane,
			};
			const scale: SceneVec3 = [1, 1, 1];
			const transform = entityTransform(entity, 1);
			items.push({
				id: entity.id,
				key: itemKey(
					entity.id,
					geometry,
					scale,
					look.material,
					look.textures,
					transform,
					entity.castShadow,
					entity.receiveShadow,
				),
				geometry,
				geometryScale: scale,
				material: look.material,
				textures: look.textures,
				finishKey:
					entity.materialInstanceId !== undefined
						? `project:${entity.materialInstanceId}`
						: `curated:${entity.materialId}`,
				transform,
				castShadow: entity.castShadow,
				receiveShadow: entity.receiveShadow,
			});
		}

		return { items, artworks, models };
	});
}
