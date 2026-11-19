import type { LayoutSurfaceRef } from '@portfolio/layout-core';
import type { SceneTextureSpec } from '$lib/render/resources/scene-render-item';
import type { StandardMaterialDescriptor } from '$lib/render/resources/material-descriptor';

/** Scene-admitted subset of the canonical Layout surface identity. */
export type SceneSurfaceRef = Exclude<LayoutSurfaceRef, { readonly kind: 'region-face' }>;

/** Plain resolved look passed from the Scene resolver into retained representations. */
export type SceneSurfaceLook = {
	readonly material: StandardMaterialDescriptor;
	readonly textures: SceneTextureSpec | null;
};

/** A retained representation asks only for a look; it never reads Scene truth. */
export type SceneSurfaceLookResolver = (surface: SceneSurfaceRef) => SceneSurfaceLook | null;
