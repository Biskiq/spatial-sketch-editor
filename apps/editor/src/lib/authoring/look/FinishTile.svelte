<script lang="ts">
	/**
	 * One Finish picture: the flat, lit sample tile (U1) over the colour swatch.
	 *
	 * The swatch is always the background, so a tile that has not loaded, cannot
	 * be drawn (no host yet, a refusal, a failure) or has no service keeps the
	 * colour a creator already recognises; the picture fades over it. The
	 * derivative is chosen from the tile's CSS size and the display's pixel
	 * ratio, never larger than needed.
	 */
	import { untrack } from 'svelte';
	import { tryUseFinishTiles } from './finish-tiles-context';
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';

	let {
		source,
		color,
		size = 44,
		label = '',
		imageUri = null
	}: {
		/** Null for a Finish with nothing to draw (a model's own look). */
		source: FinishTileSource | null;
		/** The swatch fallback. */
		color: string;
		/** The tile's CSS edge. */
		size?: number;
		label?: string;
		/** The Finish's own colour image, shown multiplied over the swatch until its picture loads (a project Finish). */
		imageUri?: string | null;
	} = $props();

	const tiles = tryUseFinishTiles();
	let url = $state<string | null>(null);
	let ratio = $state(1);

	$effect(() => {
		ratio = window.devicePixelRatio || 1;
	});

	$effect(() => {
		if (tiles === null || source === null) {
			url = null;
			return;
		}
		// A renderer registering or leaving retries a picture that had none.
		void tiles.epoch;
		const wanted = source;
		const edge = size;
		const dpr = ratio;
		const controller = new AbortController();
		untrack(() => {
			void tiles.picture(wanted, edge, dpr, controller.signal).then((picture) => {
				if (!controller.signal.aborted) url = picture?.url ?? null;
			});
		});
		return () => controller.abort();
	});
</script>

<i
	class="finish-tile"
	class:pictured={url !== null}
	style:background-color={color}
	style:background-image={imageUri === null ? null : `url("${imageUri}")`}
	style:background-size="cover"
	style:background-position="center"
	style:background-blend-mode="multiply"
	style:--tile-size={`${size}px`}
	role={label === '' ? undefined : 'img'}
	aria-label={label === '' ? undefined : label}
>
	{#if url !== null}
		<img src={url} alt="" width={size} height={size} draggable="false" />
	{/if}
</i>

<style>
	.finish-tile {
		display: block;
		position: relative;
		width: var(--tile-size);
		height: var(--tile-size);
		max-width: 100%;
		border-radius: 4px;
		overflow: hidden;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--shell-ink, #000) 12%, transparent);
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		animation: finish-tile-in 160ms ease-out;
	}
	@keyframes finish-tile-in {
		from {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		img {
			animation: none;
		}
	}
</style>
