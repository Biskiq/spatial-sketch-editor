/**
 * E7/R4 — the Scene render item: what to draw, never how.
 *
 * `renderer-refactor.md` §2.2 defines a `RenderItem` as frozen, Three-free data
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
import type { MaterialTextureSlotKey, StandardMaterialDescriptor } from './material-descriptor';

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

/** What shape to draw. Plain data: the store decides how to build it. */
export type GeometrySpec = UnitGeometrySpec | FormGeometrySpec;

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

/**
 * One resolved texture binding: the variant the look loads, the slots it covers
 * and the surface repeat. The scope is deliberately absent — a Canvas supplies
 * its own cache namespace when it acquires.
 */
export type SceneTextureSpec = {
	readonly variantSeed: string;
	readonly slotUris: Readonly<Partial<Record<MaterialTextureSlotKey, string>>>;
	readonly repeat: readonly [number, number];
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
	readonly transform: SceneTransform;
	readonly castShadow: boolean;
	readonly receiveShadow: boolean;
};

/** One Scene conversion's drawable items, in authored order. */
export type SceneRenderDescription = {
	readonly items: readonly SceneRenderItem[];
};
