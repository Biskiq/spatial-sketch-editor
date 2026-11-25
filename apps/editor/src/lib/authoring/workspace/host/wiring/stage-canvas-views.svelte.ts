import { overlayList, type OverlayLists } from '$lib/authoring/workspace/region-ownership';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
import type { createCoreRegionViews } from '$lib/authoring/stage/route/core-region-views';
import type { createAppearanceFeature } from '$lib/authoring/look/appearance-feature.svelte';
import type { createLayoutReadingsFeature } from '$lib/authoring/stage/readings/layout-readings-feature.svelte';
import type { createSkyFeature } from '$lib/authoring/look/sky-feature.svelte';
import type { createArtworkFeature } from '$lib/authoring/artwork/artwork-feature.svelte';
import type { createStudioFeature } from '$lib/authoring/studio/studio-feature.svelte';

/**
 * Assembles the Canvas and overlay descriptors from the core view and the four
 * visual features. The host only supplies the admitted snapshot; each feature
 * keeps ownership of its contribution and its own reactive surface.
 */
export function createStageCanvasViews(input: {
	readonly snapshot: () => StageReadSnapshot | null;
	readonly overlayLists: OverlayLists;
	readonly coreRegions: ReturnType<typeof createCoreRegionViews>;
	readonly appearance: ReturnType<typeof createAppearanceFeature>;
	readonly readings: ReturnType<typeof createLayoutReadingsFeature>;
	readonly sky: ReturnType<typeof createSkyFeature>;
	readonly artwork: ReturnType<typeof createArtworkFeature>;
	readonly studioFeature: ReturnType<typeof createStudioFeature>;
}) {
	const canvas = $derived.by(() => {
		const snapshot = input.snapshot();
		if (snapshot === null) return null;
		const coreCanvas = input.coreRegions.canvas(snapshot);
		const appearanceCanvas = input.appearance.regions.regionsCanvas(snapshot);
		const features = {
			get studio() {
				void input.studioFeature.ports.revision();
				const studio = input.studioFeature.controller;
				return studio.active ? { rootId: studio.rootId, context: studio.context } : null;
			},
		};
		// Assemble descriptors once per admitted source so Svelte reads each
		// Canvas getter independently of the other regions and source props.
		const { liftCanvas, cutawayCanvas, sliceCanvas, unfoldCanvas } = input.readings.regions;
		// The idle Unfold anchor was sampled with the source props.
		const unfold = {
			...Object.getOwnPropertyDescriptors(unfoldCanvas),
			unfoldAnchorPin: { value: unfoldCanvas.unfoldAnchorPin, enumerable: true }
		};
		return Object.defineProperties(coreCanvas, {
			...Object.getOwnPropertyDescriptors(features),
			...Object.getOwnPropertyDescriptors(appearanceCanvas),
			...Object.getOwnPropertyDescriptors(input.sky.regions.canvas),
			...Object.getOwnPropertyDescriptors(input.artwork.regions.canvas),
			...Object.getOwnPropertyDescriptors(liftCanvas),
			...Object.getOwnPropertyDescriptors(cutawayCanvas),
			...Object.getOwnPropertyDescriptors(sliceCanvas),
			...unfold
		}) as typeof coreCanvas & typeof features & typeof appearanceCanvas & typeof input.sky.regions.canvas & typeof input.artwork.regions.canvas & typeof liftCanvas & typeof cutawayCanvas & typeof sliceCanvas & typeof unfoldCanvas;
	});

	const lists = { core: input.coreRegions.overlay, ...input.overlayLists };
	const overlay = $derived({
		...input.coreRegions.overlay,
		celestial: input.sky.regions.overlay.celestial,
		marks: overlayList('marks', lists),
		candidates: overlayList('candidates', lists),
		sliceDraft: input.readings.regions.overlay.sliceDraft
	});

	return {
		get canvas() {
			return canvas;
		},
		get overlay() {
			return overlay;
		}
	};
}
