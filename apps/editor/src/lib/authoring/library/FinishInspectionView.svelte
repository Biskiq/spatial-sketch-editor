<script lang="ts">
	/**
	 * Interactive Library detail (T2.S8 U5): the one active inspection.
	 *
	 * It asks the Stage's E7 inspection host, through the Finish picture
	 * service, for a live draw of one subject with real geometry and lighting
	 * controls. A changed subject, geometry or lighting replaces the request;
	 * leaving releases it. Browse cards never come here: they keep the 256 px
	 * sample-tile derivatives. With no Stage renderer (a test, a lost context)
	 * the view shows the subject's tile and says why.
 *
 * Studio here is the Library's brighter neutral `library-studio` rig on a
 * light backdrop; E7's engineering `studio` rig, U1's sample tiles and the
 * Stage's own lighting are untouched.
	 */
	import { tryUseFinishTiles } from '$lib/authoring/look/finish-tiles-context';
	import FinishTile from '$lib/authoring/look/FinishTile.svelte';
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import type { InspectionLightingMode, InspectionState } from '$lib/render/materials/inspection-host';
	import type { InspectionSubject } from '$lib/render/materials/inspection-subject';
	import type { WorldLightSample } from '$lib/render/materials/inspection-world';

	type Geometry = 'sphere' | 'plane' | 'block';
	type Lighting = 'studio' | 'grazing' | 'world';

	let {
		source,
		color,
		imageUri = null,
		label,
		world = null,
		worldReason = 'World light needs a placed surface to read from.',
		caption = null
	}: {
		source: FinishTileSource | null;
		color: string;
		imageUri?: string | null;
		label: string;
		/** A World light sample at a qualified anchor; null keeps World unavailable. */
		world?: WorldLightSample | null;
		worldReason?: string;
		/** Which render this is (Original / Draft), shown over the picture. */
		caption?: string | null;
	} = $props();

	const tiles = tryUseFinishTiles();
	const SIZE = 480;

	let geometry = $state<Geometry>('sphere');
	let lighting = $state<Lighting>('studio');
	let reading = $state.raw<InspectionState | null>(null);
	let canvas = $state<HTMLCanvasElement>();

	const subject = $derived.by((): InspectionSubject | null => {
		if (source === null) return null;
		return source.kind === 'catalogue' ? { kind: 'catalogue', id: source.id } : source.subject;
	});
	const live = $derived(tiles !== null);

	// World falls back to Studio the moment its anchor stops qualifying.
	$effect(() => {
		if (lighting === 'world' && world === null) lighting = 'studio';
	});

	$effect(() => {
		const current = subject;
		const mode: InspectionLightingMode =
			lighting === 'world' && world !== null ? { world } : lighting === 'grazing' ? 'grazing' : 'library-studio';
		void tiles?.epoch;
		reading = null;
		if (current === null || tiles === null) return;
		const stop = tiles.inspect(
			{ subject: current, geometry, lighting: mode, display: 'lit', sizePx: [SIZE, SIZE] },
			(next) => (reading = next)
		);
		return () => stop?.();
	});

	$effect(() => {
		const drawn = reading;
		if (canvas === undefined || drawn === null || (drawn.status !== 'ready' && drawn.status !== 'partial')) return;
		const context = canvas.getContext('2d');
		if (context === null) return;
		canvas.width = drawn.frame.width;
		canvas.height = drawn.frame.height;
		context.putImageData(
			new ImageData(new Uint8ClampedArray(drawn.frame.pixels), drawn.frame.width, drawn.frame.height),
			0,
			0
		);
	});

	const drawn = $derived(reading !== null && (reading.status === 'ready' || reading.status === 'partial'));
	const note = $derived.by((): string | null => {
		if (!live || subject === null) return 'Live preview needs the Stage renderer; showing the sample tile.';
		if (reading === null || reading.status === 'pending') return null;
		if (reading.status === 'refused') {
			const code = reading.issues[0]?.code ?? 'refused';
			return code === 'world-anchor-required'
				? 'World light needs a placed surface to read from.'
				: 'This Finish cannot be drawn live here; showing the sample tile.';
		}
		if (reading.status === 'partial') return 'Some images could not load; the rest still read.';
		return null;
	});
</script>

<div class="inspect" data-library-inspect data-inspect-lighting-mode={lighting} data-inspect-state={reading?.status ?? (live ? 'idle' : 'off')}>
	<div class="view" aria-label={`${label} preview`} role="img">
		{#if drawn}
			<canvas bind:this={canvas} width={SIZE} height={SIZE}></canvas>
		{:else}
			<FinishTile {source} {color} {imageUri} size={168} />
		{/if}
		{#if caption !== null}<span class="caption" data-inspect-caption>{caption}</span>{/if}
	</div>
	<div class="controls">
		<span class="seg" role="group" aria-label="Preview geometry">
			{#each [['sphere', 'Sphere'], ['plane', 'Flat'], ['block', 'Block']] as const as [id, text] (id)}
				<button type="button" aria-pressed={geometry === id} data-inspect-geometry={id} onclick={() => (geometry = id)}>{text}</button>
			{/each}
		</span>
		<span class="seg" role="group" aria-label="Preview lighting">
			{#each [['studio', 'Studio'], ['grazing', 'Grazing'], ['world', 'World']] as const as [id, text] (id)}
				<button
					type="button"
					aria-pressed={lighting === id}
					disabled={id === 'world' && world === null}
					title={id === 'world' && world === null ? worldReason : `${text} light`}
					data-inspect-lighting={id}
					onclick={() => (lighting = id)}
				>{text}</button>
			{/each}
		</span>
	</div>
	{#if note !== null}<p class="note" data-inspect-note>{note}</p>{/if}
</div>

<style>
	.inspect { display: grid; gap: 8px; }
	.view {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		border-radius: 10px;
		overflow: hidden;
		background: #e2dfd8;
		display: grid;
		place-items: center;
	}
	.view canvas { display: block; width: 100%; height: 100%; }
	.view :global(.finish-tile), .view :global(img) { width: 100%; height: 100%; }
	.caption {
		position: absolute;
		left: 8px;
		top: 8px;
		padding: 2px 7px;
		border-radius: 999px;
		background: color-mix(in srgb, #fff 82%, transparent);
		color: #23302a;
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.02em;
		pointer-events: none;
	}
	.controls { display: flex; flex-wrap: wrap; gap: 6px; }
	.seg {
		display: inline-flex;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 7px;
		overflow: hidden;
	}
	.seg button {
		border: 0;
		border-right: 1px solid var(--shell-hairline);
		background: transparent;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 11px;
		padding: 5px 8px;
		cursor: pointer;
		min-height: 28px;
	}
	.seg button:last-child { border-right: 0; }
	.seg button[aria-pressed='true'] { background: var(--shell-forest); color: var(--shell-ivory); }
	.seg button:disabled { opacity: 0.5; cursor: not-allowed; }
	.seg button:focus-visible { outline: 2px solid var(--shell-forest); outline-offset: -2px; }
	.note { margin: 0; font-size: 11px; color: var(--shell-ink-2); }
	@media (pointer: coarse) { .seg button { min-height: 44px; padding: 0 12px; } }
</style>
