<script lang="ts">
	import { artworkHeight, type SceneArtworkEntity } from '@portfolio/project-model';
	import { ARTWORK_CORNERS, artworkHandlePoint, type ArtworkCorner } from './artwork-resize';
	import type { StageFacade } from '$lib/authoring/stage/stage-facade';
	import type { ViewportEvaluation } from '@portfolio/camera-core';

	type Manipulation = ArtworkCorner | 'move' | 'turn';
	let { entity, stage, evaluation, resizing, onStart }: {
		entity: SceneArtworkEntity; stage: StageFacade; evaluation: ViewportEvaluation;
		resizing: boolean; onStart: (event: PointerEvent, corner: Manipulation) => void;
	} = $props();
	const points = $derived.by(() => {
		const id = stage.evaluationId();
		if (id === null) return [];
		return ARTWORK_CORNERS.flatMap((corner) => {
			const projected = stage.projectWorld(artworkHandlePoint(entity, corner).toArray(), id);
			return projected.kind === 'projected'
				? [{ corner, x: projected.css[0] - evaluation.rect.left, y: projected.css[1] - evaluation.rect.top }]
				: [];
		});
	});
	const center = $derived(points.length === 4 ? {
		x: (points[0]!.x + points[2]!.x) / 2,
		y: (points[0]!.y + points[2]!.y) / 2
	} : null);
</script>

{#each points as point, index (index)}
	<button type="button" tabindex="-1" class="artwork-grip" style:left={`${point.x}px`} style:top={`${point.y}px`}
		aria-label="Resize Artwork" title="Resize Artwork"
		onpointerdown={(event) => onStart(event, point.corner)}
		onclick={(event) => event.stopPropagation()}></button>
{/each}
{#if center !== null}
	<button type="button" tabindex="-1" class="artwork-grip move" style:left={`${center.x}px`} style:top={`${center.y}px`}
		aria-label="Move Artwork" title="Move Artwork in its plane"
		onpointerdown={(event) => onStart(event, 'move')} onclick={(event) => event.stopPropagation()}>✥</button>
	<button type="button" tabindex="-1" class="artwork-grip turn"
		style:left={`${(points[1]!.x + points[2]!.x) / 2}px`} style:top={`${Math.min(points[1]!.y, points[2]!.y) - 24}px`}
		aria-label="Turn Artwork" title="Turn Artwork around its vertical axis"
		onpointerdown={(event) => onStart(event, 'turn')} onclick={(event) => event.stopPropagation()}>↻</button>
{/if}

{#if resizing && points[1]}
	<output style:left={`${points[1].x}px`} style:top={`${points[1].y - 25}px`}>
		{(entity.widthMeters * 100).toFixed(1)} × {(artworkHeight(entity.widthMeters, entity.source) * 100).toFixed(1)} cm
	</output>
{/if}
<style>
	.artwork-grip, output { position: absolute; transform: translate(-50%, -50%); z-index: 4; }
	.artwork-grip { width: 24px; height: 24px; border: 0; background: transparent; cursor: nwse-resize; touch-action: none; }
	.artwork-grip::before { content: ''; display: block; width: 8px; height: 8px; margin: auto; background: #f9d772; outline: 1px solid #292414; }
	.move, .turn { color: var(--shell-ink); background: var(--shell-field); border: 1px solid var(--shell-field-line); border-radius: 50%; cursor: move; }
	.turn { cursor: grab; }
	.move::before, .turn::before { display: none; }
	output { color: #292414; background: #f9d772; padding: 0.15rem 0.35rem; white-space: nowrap; pointer-events: none; }
</style>
