/**
 * The Scene render item: what to draw, never how.
 *
 * The rendering contract defines a `RenderItem` as frozen, Three-free data
 * built once per derived-description identity. This module is its type and its
 * canonical geometry key; it imports no value from Three and nothing from an
 * authored-unit reader, so both the description that builds items and the
 * representation that consumes them can depend on it without either one reaching
 * the other's layer.
 *
 * The item carries resolved facts, not decisions:
 *
 * - `geometry` is what shape, as a store spec (a unit geometry or a Form's
 *   canonical evaluated mesh);
 * - `geometryScale` is the unit-geometry scale that reproduces the authored size
 *   exactly — the parity test compares it against a geometry built at size;
 * - `material` is the canonical descriptor for the resolved look, and `textures`
 *   names the variant that look binds (identity only, no GPU object);
 * - `transform` is the authored placement, so a retained root keeps the world
 *   matrix the accepted entity has;
 * - `key` changes only when something that changes the drawn result changes.
 */
import type { FormMesh } from '@portfolio/geometry-core';
import type {
	MaterialTextureSlotKey,
	StandardFinishPlan,
	StandardMaterialDescriptor
} from './material-descriptor';

export type SceneVec3 = readonly [number, number, number];

/** The form's profile plane, as the geometry adapter reads it. */
export type FormPlane = 'plan' | 'elevation';

export type UnitGeometrySpec =
	| { readonly kind: 'unit'; readonly shape: 'box' | 'plane' }
	| { readonly kind: 'unit'; readonly shape: 'cylinder'; readonly radialSegments: number }
	| {
			readonly kind: 'unit';
			readonly shape: 'sphere';
			readonly widthSegments: number;
			readonly heightSegments: number;
	  };

export type FormGeometrySpec = {
	readonly kind: 'form';
	/** `formEvaluationKey` of the source; two equal sources are one buffer. */
	readonly evaluationKey: string;
	/** The canonical evaluated mesh, produced once per source by the form cache. */
	readonly mesh: FormMesh;
	readonly plane: FormPlane;
};

/**
 * The three keyed Artwork bodies. The image itself is `unit:plane`.
 *
 * Each spec names exactly the numbers its buffer is built from, so two Artworks
 * whose frame layout resolves to the same numbers share one buffer, and any size
 * or profile change is a different key.
 */
export type ArtworkGeometrySpec =
	| {
			/** The frame ring, extruded `depth` back from the face. */
			readonly kind: 'artwork-frame';
			readonly outerWidth: number;
			readonly outerHeight: number;
			readonly faceMeters: number;
			readonly depth: number;
	  }
	| {
			/** The flat Mat ring around the image. */
			readonly kind: 'artwork-mat';
			readonly width: number;
			readonly height: number;
			readonly innerWidth: number;
			readonly innerHeight: number;
	  }
	| {
			/** The backing plate behind the opening. */
			readonly kind: 'artwork-backing';
			readonly width: number;
			readonly height: number;
	  };

/**
 * A tapered or open-ended cylinder, built at size.
 *
 * A model fallback's tapered legs, stems and shades are not a scaled unit
 * cylinder (its radii differ, or it has no caps), so the buffer is built from the
 * exact numbers and keyed by them: equal fallback parts across instances share one
 * buffer.
 */
export type FrustumGeometrySpec = {
	readonly kind: 'frustum';
	readonly radiusTop: number;
	readonly radiusBottom: number;
	readonly height: number;
	readonly radialSegments: number;
	readonly openEnded: boolean;
};

/** What shape to draw. Plain data: the store decides how to build it. */
export type GeometrySpec = UnitGeometrySpec | FormGeometrySpec | ArtworkGeometrySpec | FrustumGeometrySpec;

/**
 * The canonical key of one geometry spec.
 *
 * Unit geometries carry their segment counts because a 32-segment cylinder is a
 * different mesh from a 24-segment one; the key is what makes sharing honest.
 * It lives here, above Three, so the description can decide sharing identity
 * without importing the store that builds the buffer.
 */
export function geometryKeyOf(spec: GeometrySpec): string {
	if (spec.kind === 'form') return `form:${spec.evaluationKey}`;
	if (spec.kind === 'artwork-frame') {
		return `artwork-frame:${spec.outerWidth}x${spec.outerHeight}:face=${spec.faceMeters}:depth=${spec.depth}`;
	}
	if (spec.kind === 'artwork-mat') {
		return `artwork-mat:${spec.width}x${spec.height}:inner=${spec.innerWidth}x${spec.innerHeight}`;
	}
	if (spec.kind === 'artwork-backing') return `artwork-backing:${spec.width}x${spec.height}`;
	if (spec.kind === 'frustum') {
		return `frustum:${spec.radiusTop}/${spec.radiusBottom}x${spec.height}:${spec.radialSegments}${spec.openEnded ? ':open' : ''}`;
	}
	switch (spec.shape) {
		case 'box':
			return 'unit:box';
		case 'plane':
			return 'unit:plane';
		case 'cylinder':
			return `unit:cylinder:${spec.radialSegments}`;
		case 'sphere':
			return `unit:sphere:${spec.widthSegments}x${spec.heightSegments}`;
	}
}

/** The authored placement of one entity; never the unit-geometry scale. */
export type SceneTransform = {
	readonly position: SceneVec3;
	readonly rotation: SceneVec3;
	readonly scale: SceneVec3;
};

/** One acquired view a sampled material's plan names. */
export type SceneFinishViewSource = {
	/** The stable view key the descriptor's plan entry names. */
	readonly view: string;
	/** The verified image URI the view is loaded from. */
	readonly uri: string;
	readonly role: 'color' | 'normal' | 'roughness' | 'metalness' | 'occlusion';
};

/**
 * One resolved texture binding: the variant the look loads, the slots it covers
 * and the surface repeat. The scope is deliberately absent — a Canvas supplies
 * its own cache namespace when it acquires.
 *
 * `views` is present only on the sampled path. The legacy fields stay for the
 * existing variant pool and for the `sceneLookFor` descriptor oracle; a sampled
 * descriptor carries its plan and never binds a stock map slot.
 */
export type SceneTextureSpec = {
	readonly variantSeed: string;
	readonly slotUris: Readonly<Partial<Record<MaterialTextureSlotKey, string>>>;
	readonly repeat: readonly [number, number];
	/** Radians about the UV centre (0.5, 0.5). */
	readonly rotation: number;
	/** Shift in tile fractions, u then v. */
	readonly offset: readonly [number, number];
	/** Present when the material samples through a Finish plan. */
	readonly views?: readonly SceneFinishViewSource[];
};

export type SceneRenderItem = {
	/** The authored entity id: the retained representation's patch key. */
	readonly id: string;
	/** Content identity: an unchanged key means nothing to do. */
	readonly key: string;
	readonly geometry: GeometrySpec;
	/** Unit-geometry scale reproducing the authored dimensions. */
	readonly geometryScale: SceneVec3;
	readonly material: StandardMaterialDescriptor;
	readonly textures: SceneTextureSpec | null;
	/** Canonical Finish key (`project:<id>` or `curated:<id>`) for outcome reporting. */
	readonly finishKey?: string;
	readonly transform: SceneTransform;
	readonly castShadow: boolean;
	readonly receiveShadow: boolean;
};

/** The image an Artwork shows: the artwork scope's lease identity. */
export type SceneArtworkImage = {
	readonly assetId: string;
	readonly pixelWidth: number;
	readonly pixelHeight: number;
};

/** One flat or extruded Artwork body: its keyed buffer, colour and offset from the face. */
export type SceneArtworkBody<K extends ArtworkGeometrySpec['kind']> = {
	readonly geometry: Extract<ArtworkGeometrySpec, { kind: K }>;
	readonly color: string;
	readonly z: number;
};

/**
 * One Artwork, resolved: what to draw, never how.
 *
 * The frame layout is evaluated once here, by the description, so the handler
 * never reads authored truth. Three keys split the work an edit causes:
 *
 * - `sourceKey` — the image. A change releases the image lease and the Artwork
 *   disappears until the new image arrives, as the component did.
 * - `bodyKey` — size and framing. A change rebuilds the meshes and their leases
 *   and keeps the loaded image.
 * - `placementKey` — position and rotation. A change moves the retained group.
 */
export type SceneArtworkItem = {
	readonly id: string;
	readonly image: SceneArtworkImage;
	readonly sourceKey: string;
	readonly bodyKey: string;
	readonly placementKey: string;
	readonly position: SceneVec3;
	readonly rotation: SceneVec3;
	/** The image surface size: `unit:plane` scaled by `(width, height, 1)`. */
	readonly imageSize: readonly [number, number];
	readonly frame: SceneArtworkBody<'artwork-frame'> | null;
	readonly mat: SceneArtworkBody<'artwork-mat'> | null;
	readonly backing: SceneArtworkBody<'artwork-backing'> | null;
};

/** One fallback part: a keyed buffer, its unit scale, its local pose and its surface. */
export type SceneModelFallbackPart = {
	readonly geometry: GeometrySpec;
	readonly geometryScale: SceneVec3;
	readonly position: SceneVec3;
	readonly rotation: SceneVec3;
	readonly material: StandardMaterialDescriptor;
};

/**
 * The resolved material a model's meshes are remapped to: the colour and
 * PBR scalars and the texture variant it loads. Identity only, no GPU object.
 */
export type SceneModelLook = {
	readonly color: string;
	readonly roughness: number;
	readonly metalness: number;
	readonly variantSeed: string;
	readonly slotUris: Readonly<Partial<Record<MaterialTextureSlotKey, string>>>;
	/** The Finish's normal strength and flip; applied only while a normal map binds. */
	readonly normalScale?: readonly [number, number];
	/** The sampled plan for a legacy-UV0 model remap, when one exists. */
	readonly finish?: StandardFinishPlan;
	/** The views the sampled plan names. */
	readonly views?: readonly SceneFinishViewSource[];
	/** Canonical Finish key (`project:<id>` or `curated:<id>`) for outcome reporting. */
	readonly finishKey?: string;
};

/**
 * One approved model, resolved: what to draw, never how.
 *
 * The description resolves the catalogue record, the fallback body and the look
 * once, so the model handler never reads authored truth or the asset catalogue.
 * Its keys split an edit's work:
 *
 * - `sourceKey` — which bytes. A change releases the drawn instance and its
 *   leases, shows the fallback and loads the new bytes. (A resolved approved
 *   derivative URL is runtime data the handler adds to this key.)
 * - `placementKey` — position, rotation, scale and visibility. A change moves the
 *   retained group and nothing else.
 * - `fallbackKey` — the fallback body. A change rebuilds the fallback meshes.
 * - `styleKey` — the look, wireframe and shadow flags of the drawn instance. A
 *   change starts one new presentation of the arrived template.
 */
export type SceneModelItem = {
	readonly id: string;
	readonly assetId: string;
	/** The catalogue's production file when the asset is approved/testing; otherwise null. */
	readonly catalogueUrl: string | null;
	readonly sourceKey: string;
	readonly placementKey: string;
	readonly fallbackKey: string;
	readonly styleKey: string;
	readonly transform: SceneTransform;
	readonly visible: boolean;
	/** The catalogue's orientation and scale correction for the asset's own frame. */
	readonly presentation: { readonly rotation: SceneVec3; readonly scale: number };
	readonly fallback: {
		readonly kind: string;
		/** Approximate fallback bounds in metres: [width, height, depth]. */
		readonly dimensions: SceneVec3;
		readonly parts: readonly SceneModelFallbackPart[];
		readonly castShadow: boolean;
		readonly receiveShadow: boolean;
	};
	/** The resolved remap, or null to keep the asset's own materials. */
	readonly look: SceneModelLook | null;
	/** The resolve-time Treatment for the asset's own materials (ignored with a remap). */
	readonly treatment?: 'flat-colour' | 'clay';
	readonly wireframe: boolean;
	/** The drawn instance's shadow flags. */
	readonly castShadow: boolean;
	readonly receiveShadow: boolean;
};

/** One Scene conversion's drawable items, in authored order. */
export type SceneRenderDescription = {
	readonly items: readonly SceneRenderItem[];
	/** Artworks, in authored order. Drawn by the artwork handler. */
	readonly artworks: readonly SceneArtworkItem[];
	/** Approved models, in authored order. Drawn by the model handler. */
	readonly models: readonly SceneModelItem[];
};
