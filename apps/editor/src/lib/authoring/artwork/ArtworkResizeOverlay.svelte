<script lang="ts">
	import {
		artworkFrameLayout, artworkHeight, type SceneArtworkEntity
	} from '@portfolio/project-model';
	import { ARTWORK_CORNERS, artworkHandlePoint, type ArtworkCorner } from './artwork-resize';
	import { artworkSelectionGeometry } from './artwork-overlay';
	import type { StageFacade } from '$lib/authoring/stage/stage-facade';
	import type { ViewportEvaluation } from '@portfolio/camera-core';

	type Manipulation = ArtworkCorner | 'move' | 'turn';
	let { entity, stage, evaluation, resizing, blocked = false, canTurn = true, onStart }: {
		entity: SceneArtworkEntity; stage: StageFacade; evaluation: ViewportEvaluation;
		resizing: boolean; blocked?: boolean; canTurn?: boolean;
		onStart: (event: PointerEvent, corner: Manipulation) => void;
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
	const geometry = $derived.by(() => {
		const imageWidth = entity.widthMeters * 100;
		const imageHeight = artworkHeight(entity.widthMeters, entity.source) * 100;
		const layout = artworkFrameLayout(entity.widthMeters, artworkHeight(entity.widthMeters, entity.source), entity.frame);
		return artworkSelectionGeometry(points, {
			imageWidthCm: imageWidth,
			imageHeightCm: imageHeight,
			framedWidthCm: layout.outerWidth * 100,
			framedHeightCm: layout.outerHeight * 100
		}, resizing);
	});
	const center = $derived(points.length === 4 ? {
		x: (points[0]!.x + points[2]!.x) / 2,
		y: (points[0]!.y + points[2]!.y) / 2
	} : null);
</script>

{#if geometry.corners.length === 4}
	<svg class="artwork-selection" class:blocked aria-hidden="true">
		<polygon points={geometry.polygon} />
	</svg>
{/if}
{#each geometry.corners as point, index (index)}
	<button type="button" tabindex="-1" class="artwork-grip" style:left={`${point.x}px`} style:top={`${point.y}px`}
		aria-label="Resize Artwork" title="Resize Artwork"
		onpointerdown={(event) => onStart(event, points[index]?.corner ?? ARTWORK_CORNERS[index]!)}
		onclick={(event) => event.stopPropagation()}></button>
{/each}
{#each geometry.tags as tag (tag.id)}
	<output class="artwork-size" data-size-tag={tag.id} style:left={`${tag.x}px`} style:top={`${tag.y}px`}>{tag.text}</output>
{/each}
{#if center !== null}
	<button type="button" tabindex="-1" class="artwork-grip move" style:left={`${center.x}px`} style:top={`${center.y}px`}
		aria-label="Move Artwork" title="Move Artwork in its plane"
		onpointerdown={(event) => onStart(event, 'move')} onclick={(event) => event.stopPropagation()}>✥</button>
	{#if canTurn}
		<button type="button" tabindex="-1" class="artwork-grip turn"
			style:left={`${(points[1]!.x + points[2]!.x) / 2}px`} style:top={`${Math.min(points[1]!.y, points[2]!.y) - 24}px`}
			aria-label="Turn Artwork" title="Turn Artwork around its vertical axis"
			onpointerdown={(event) => onStart(event, 'turn')} onclick={(event) => event.stopPropagation()}>↻</button>
	{/if}
	{#if blocked}
		<output class="artwork-edge" style:left={`${center.x}px`} style:top={`${Math.min(points[1]!.y, points[2]!.y) - 48}px`}>Stops at the wall edge</output>
	{/if}
{/if}
<style>
	.artwork-selection {
		position: absolute; inset: 0; width: 100%; height: 100%;
		pointer-events: none; z-index: 4; overflow: visible;
	}
	.artwork-selection polygon {
		fill: none; stroke: #d9a521; stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.artwork-selection.blocked polygon {
		stroke: var(--shell-refuse);
		stroke-width: 1.4;
		stroke-dasharray: 4 3;
	}
	.artwork-grip, .artwork-size, .artwork-edge { position: absolute; transform: translate(-50%, -50%); z-index: 5; }
	.artwork-edge {
		color: #6b1d12; background: #f6d7c9; padding: 0.15rem 0.35rem;
		font: 10.5px var(--shell-mono); white-space: nowrap; pointer-events: none;
	}
	.artwork-grip { width: 24px; height: 24px; border: 0; background: transparent; cursor: nwse-resize; touch-action: none; }
	.artwork-grip::before {
		content: ''; display: block; width: 9px; height: 9px; margin: auto;
		background: #fff; outline: 1.5px solid #d9a521;
	}
	.move, .turn { color: var(--shell-ink); background: var(--shell-field); border: 1px solid var(--shell-field-line); border-radius: 50%; cursor: move; }
	.turn { cursor: grab; }
	.move::before, .turn::before { display: none; }
	.artwork-size {
		color: #292414; background: #f6dc8a; padding: 0.15rem 0.35rem;
		font: 10.5px var(--shell-mono); white-space: nowrap; pointer-events: none;
	}
</style>
