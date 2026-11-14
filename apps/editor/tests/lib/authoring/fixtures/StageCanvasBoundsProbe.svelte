<script module lang="ts">
	import { vi } from 'vitest';
	import type { ScenePickSource } from '$lib/authoring/scene/scene-pick-source';

	export const canvasBoundsProbe = {
		readBounds: vi.fn(),
		setSource: vi.fn(),
		registerLayoutIdentity: vi.fn(),
		refresh: null as ScenePickSource['refresh'] | null
	};
</script>

<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import type StageCanvas from '$lib/authoring/stage/shell/StageCanvas.svelte';

	let { scenePick, scene, contentBounds }: ComponentProps<typeof StageCanvas> = $props();
	canvasBoundsProbe.refresh = () => scenePick.refresh();

	// Mirror the two effects at the renderer boundary without scheduling a
	// second notification, so a regression fails by call count instead of hanging.
	$effect(() => canvasBoundsProbe.setSource(scenePick, scene));
	$effect(() => canvasBoundsProbe.registerLayoutIdentity(scenePick.registerLayoutIdentity));
	$effect(() => canvasBoundsProbe.readBounds(contentBounds));
</script>

<div data-testid="stage-canvas"></div>
