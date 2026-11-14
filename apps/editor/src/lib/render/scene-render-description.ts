/**
 * E7/R4 — the Scene render description: resolved Scene in, frozen items out.
 *
 * `renderer-refactor.md` §2 makes this the missing layer for Scene content. The
 * accepted Scene is already a derived description (one resolution per changed
 * unit, retained by G2/E2); this module turns it into per-drawable items — what
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
 * its own; when the lazy form kernel has not arrived yet, form items are omitted
 * — exactly what the lazy `EntityForm` mount did before them.
 */
import {
	isSceneFormEntity,
	isScenePrimitiveEntity
} from '$lib/content/scene';
import { artworkFrameLayout, artworkHeight } from '@portfolio/project-model';
import type {
	RuntimeScene,
	SceneArtworkEntity,
	SceneDocument,
	SceneFormEntity,
	SceneFormSource,
	ScenePrimitiveEntity
} from '@portfolio/project-model';
import type { FormMesh } from '@portfolio/geometry-core';
import { materialKey } from './resources/material-descriptor';
import {
	geometryKeyOf,
	type GeometrySpec,
	type SceneArtworkItem,
	type SceneRenderDescription,
	type SceneRenderItem,
	type SceneTransform,
	type SceneVec3
} from './resources/scene-render-item';
import { sceneLookFor } from '$lib/museum/materials/scene-instance-material';

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

function cached(scene: RuntimeScene, forms: SceneFormSupport | null, build: () => SceneRenderDescription): SceneRenderDescription {
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

function primitiveGeometry(entity: ScenePrimitiveEntity): {
	readonly spec: GeometrySpec;
	readonly scale: SceneVec3;
} {
	switch (entity.primitive) {
		case 'box':
			return {
				spec: { kind: 'unit', shape: 'box' },
				scale: [entity.dimensions.width, entity.dimensions.height, entity.dimensions.depth]
			};
		case 'plane':
			return {
				spec: { kind: 'unit', shape: 'plane' },
				scale: [entity.dimensions.width, entity.dimensions.height, 1]
			};
		case 'cylinder':
			// A unit cylinder scaled to `(2r, h, 2r)` is the geometry the component
			// built at size, vertex for vertex (R4's parity test proves it).
			return {
				spec: { kind: 'unit', shape: 'cylinder', radialSegments: 32 },
				scale: [entity.dimensions.radius * 2, entity.dimensions.height, entity.dimensions.radius * 2]
			};
		case 'sphere':
			return {
				spec: { kind: 'unit', shape: 'sphere', widthSegments: 32, heightSegments: 24 },
				scale: [
					entity.dimensions.radius * 2,
					entity.dimensions.radius * 2,
					entity.dimensions.radius * 2
				]
			};
	}
}

function primitiveSurface(entity: ScenePrimitiveEntity): [number, number] {
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
}

function entityTransform(
	entity: ScenePrimitiveEntity | SceneFormEntity,
	scale: number
): SceneTransform {
	return {
		position: [entity.position[0], entity.position[1], entity.position[2]],
		rotation: [entity.rotation[0], entity.rotation[1], entity.rotation[2]],
		scale: [scale, scale, scale]
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
	receiveShadow: boolean
): string {
	return [
		id,
		geometryKeyOf(geometry),
		...geometryScale,
		materialKey(material),
		textures === null
			? 'none'
			: `${textures.variantSeed}@${textures.repeat[0]}x${textures.repeat[1]}`,
		...transform.position,
		...transform.rotation,
		...transform.scale,
		castShadow ? 1 : 0,
		receiveShadow ? 1 : 0
	].join('|');
}

/**
 * E9/R5 — one Artwork's resolved item: the frame layout evaluated once.
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
			? {
					geometry: {
						kind: 'artwork-frame',
						outerWidth: layout.outerWidth,
						outerHeight: layout.outerHeight,
						faceMeters: layout.faceMeters,
						depth: layout.depth
					},
					color: layout.frameColor,
					z: 0
				} as const
			: null;
	const mat =
		layout.mat !== null
			? {
					geometry: {
						kind: 'artwork-mat',
						width: layout.mat.width,
						height: layout.mat.height,
						innerWidth: layout.mat.innerWidth,
						innerHeight: layout.mat.innerHeight
					},
					color: layout.matColor,
					z: layout.mat.z
				} as const
			: null;
	const backing =
		layout.backing !== null && layout.backingColor !== null
			? {
					geometry: { kind: 'artwork-backing', width: layout.backing.width, height: layout.backing.height },
					color: layout.backingColor,
					z: layout.backing.z
				} as const
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
		backing
	};
}

export function describeSceneRender(
	scene: RuntimeScene,
	forms: SceneFormSupport | null = null
): SceneRenderDescription {
	return cached(scene, forms, () => {
		const document = {
			materials: scene.materials,
			textures: scene.textures
		} as Pick<SceneDocument, 'materials' | 'textures'>;
		const items: SceneRenderItem[] = [];
		const artworks: SceneArtworkItem[] = [];

		for (const entity of scene.entities) {
			if (entity.kind === 'artwork') {
				artworks.push(describeSceneArtwork(entity));
				continue;
			}
			if (isScenePrimitiveEntity(entity)) {
				const geometry = primitiveGeometry(entity);
				const surface = primitiveSurface(entity);
				const look = sceneLookFor(
					document,
					{
						materialInstanceId: entity.materialInstanceId ?? null,
						fallbackCatalogueId: entity.materialId
					},
					surface
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
						entity.receiveShadow
					),
					geometry: geometry.spec,
					geometryScale: geometry.scale,
					material: look.material,
					textures: look.textures,
					transform,
					castShadow: entity.castShadow,
					receiveShadow: entity.receiveShadow
				});
				continue;
			}
			if (!isSceneFormEntity(entity)) continue;
			// Until the lazy kernel arrives a form has no drawable geometry. The
			// description omits it exactly as the old `{#if FormComponent}` did,
			// and a new description is built when the kernel arrives.
			const form = forms?.evaluate(entity.form) ?? null;
			if (form === null) continue;
			const look = sceneLookFor(
				document,
				{
					materialInstanceId: entity.materialInstanceId ?? null,
					fallbackCatalogueId: entity.materialId
				},
				// Form UVs are metres, so one surface unit is one metre.
				[1, 1]
			);
			const geometry: GeometrySpec = {
				kind: 'form',
				evaluationKey: form.evaluationKey,
				mesh: form.mesh,
				plane: form.plane
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
					entity.receiveShadow
				),
				geometry,
				geometryScale: scale,
				material: look.material,
				textures: look.textures,
				transform,
				castShadow: entity.castShadow,
				receiveShadow: entity.receiveShadow
			});
		}

		return { items, artworks };
	});
}
