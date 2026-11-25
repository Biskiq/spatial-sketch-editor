import type { LayoutSurfaceRef } from '@portfolio/layout-core/plan';
import type { SceneTextureSpec } from '$lib/render/resources/scene-render-item';
import type { StandardMaterialDescriptor } from '$lib/render/resources/material-descriptor';

/** The canonical Layout surface identity Scene admits. */
export type SceneSurfaceRef = LayoutSurfaceRef;

/** Plain resolved look passed from the Scene resolver into retained representations. */
export type SceneSurfaceLook = {
	readonly material: StandardMaterialDescriptor;
	readonly textures: SceneTextureSpec | null;
	/** Canonical Finish key (`project:<id>` or `curated:<id>`) for outcome reporting. */
	readonly finishKey?: string;
};

/** A retained representation asks only for a look; it never reads Scene truth. */
export type SceneSurfaceLookResolver = (surface: SceneSurfaceRef) => SceneSurfaceLook | null;
