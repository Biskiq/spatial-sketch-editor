<script lang="ts">
	/**
	 * The Ink plate: the #285 shape row bound to Layout's existing Ink surface.
	 * It never writes geometry itself; every command goes through the adapter's
	 * published controller.
	 */
	import { inkSurface, inkSurfaceRevision, type InkPaletteSnapshot } from '../adapters/layout/ink';

	let {
		reading,
		onMore
	}: {
		reading: 'wall' | 'opening';
		onMore: () => void;
	} = $props();

	const emptySnapshot: InkPaletteSnapshot = {
		reading: 'wall',
		wallMode: 'line',
		box: null,
		readings: [
			{ id: 'wall', label: 'Wall', summary: 'Straight Wall chain.' },
			{ id: 'opening', label: 'Opening', summary: 'A straight door or window on one Wall face.' }
		],
		opening: null,
		points: [],
		closed: false,
		canFinish: false,
		canClose: false,
		canBacktrack: false,
		consequence: null,
		pending: null,
		refusal: null
	};

	let snapshot = $state<InkPaletteSnapshot>(emptySnapshot);

	$effect(() => {
		let frame = 0;
		let seenRevision = -1;
		let seenKey = '';
		const watch = () => {
			frame = requestAnimationFrame(watch);
			const surface = inkSurface();
			const next = surface?.snapshot() ?? emptySnapshot;
			const revision = inkSurfaceRevision();
			const key = JSON.stringify(next);
			if (revision !== seenRevision || key !== seenKey) {
				seenRevision = revision;
				seenKey = key;
				snapshot = next;
			}
		};
		frame = requestAnimationFrame(watch);
		return () => cancelAnimationFrame(frame);
	});

	$effect(() => {
		const surface = inkSurface();
		if (surface === null) return;
		if (surface.snapshot().reading !== reading) surface.controller.setReading(reading);
	});

	function setShape(mode: 'line' | 'box'): void {
		inkSurface()?.controller.setWallMode(mode);
	}

	function setHeight(height: number): void {
		inkSurface()?.controller.setOptions({
			thickness: snapshot.options?.thickness ?? 0.2,
			height
		});
	}

	function setOpening(kind: 'door' | 'window', profile: 'rectangular' | 'rounded' | 'pointed'): void {
		const opening = snapshot.opening;
		if (opening === null) return;
		inkSurface()?.controller.setOpeningOptions({
			kind,
			profile,
			width: opening.width,
			height: opening.height,
			sillHeight: kind === 'door' ? 0 : opening.sillHeight
		});
	}
</script>

<div class="ink-plate" data-ink-plate data-ink-reading={reading}>
	{#if reading === 'wall'}
		<div class="group">
			<span>Shape</span>
			<div class="segment">
				<button type="button" aria-pressed={snapshot.wallMode === 'line'} onclick={() => setShape('line')}>Line</button>
				<button type="button" aria-pressed={snapshot.wallMode === 'box'} onclick={() => setShape('box')}>Box</button>
				<button type="button" disabled title="Curved walls arrive with T1">Arc</button>
				<button type="button" disabled title="Circular rooms arrive with T1">Circle</button>
			</div>
		</div>
		<div class="group">
			<span>Height</span>
			<div class="segment">
				{#each [2.4, 3, 3.6] as height (height)}
					<button
						type="button"
						aria-pressed={Math.abs((snapshot.options?.height ?? 3) - height) < 0.01}
						onclick={() => setHeight(height)}
					>{height.toFixed(1)}</button>
				{/each}
			</div>
		</div>
	{:else}
		<div class="group">
			<span>Kind</span>
			<div class="segment">
				<button type="button" aria-pressed={snapshot.opening?.kind === 'door'} onclick={() => setOpening('door', snapshot.opening?.profile ?? 'rectangular')}>Door</button>
				<button type="button" aria-pressed={snapshot.opening?.kind === 'window'} onclick={() => setOpening('window', snapshot.opening?.profile ?? 'rectangular')}>Window</button>
			</div>
		</div>
		<div class="group">
			<span>Profile</span>
			<div class="segment">
				<button type="button" aria-pressed={snapshot.opening?.profile === 'rectangular'} onclick={() => setOpening(snapshot.opening?.kind ?? 'door', 'rectangular')}>Square</button>
				<button type="button" aria-pressed={snapshot.opening?.profile === 'rounded'} onclick={() => setOpening(snapshot.opening?.kind ?? 'door', 'rounded')}>Arch</button>
				<button type="button" disabled title="Pointed openings arrive with T1">Pointed</button>
			</div>
		</div>
	{/if}

	<div class="ink-actions">
		<button type="button" class="more" onclick={onMore} title="Open exact Ink settings">More</button>
		<button type="button" data-ink-backtrack disabled={!snapshot.canBacktrack} onclick={() => inkSurface()?.controller.backtrack()}>Back</button>
		<button type="button" data-ink-finish disabled={!snapshot.canFinish} onclick={() => inkSurface()?.controller.finish()}>Finish</button>
		<button type="button" data-ink-close disabled={!snapshot.canClose} onclick={() => inkSurface()?.controller.close()}>Close ring</button>
	</div>
	{#if snapshot.refusal !== null}
		<span class="refusal" role="status">{snapshot.refusal}</span>
	{/if}
</div>

<style>
	.ink-plate {
		position: relative;
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
	}
	.group {
		display: grid;
		flex: none;
		gap: 3px;
	}
	.group > span {
		font-size: 8.5px;
		font-weight: 500;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: rgb(242 240 230 / 0.52);
	}
	.segment {
		display: flex;
		gap: 1px;
		height: 29px;
		padding: 2px;
		border: 1px solid rgb(240 244 236 / 0.12);
		border-radius: 7px;
		background: rgb(0 0 0 / 0.12);
	}
	.segment button {
		height: 23px;
		padding: 0 8px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: rgb(242 240 230 / 0.82);
		font: 500 10.5px/1 var(--ld-sans, 'Instrument Sans', system-ui, sans-serif);
		white-space: nowrap;
		cursor: pointer;
	}
	.segment button:hover {
		background: rgb(242 240 230 / 0.08);
	}
	.segment button[aria-pressed='true'] {
		background: var(--ld-paper, #f4f1e6);
		color: var(--ld-forest-deep, #102d20);
		font-weight: 600;
	}
	.segment button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.ink-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
		flex: none;
	}
	.ink-actions button {
		height: 29px;
		padding: 0 8px;
		border: 1px solid rgb(240 244 236 / 0.16);
		border-radius: 6px;
		background: transparent;
		color: rgb(242 240 230 / 0.86);
		font: 500 10.5px/1 var(--ld-sans, 'Instrument Sans', system-ui, sans-serif);
		cursor: pointer;
	}
	.ink-actions button:hover {
		background: rgb(242 240 230 / 0.08);
	}
	.ink-actions button:disabled {
		opacity: 0.32;
		cursor: default;
	}
	.ink-actions .more {
		border-color: rgb(200 166 83 / 0.46);
		color: var(--ld-gold, #c8a653);
	}
	.refusal {
		position: absolute;
		left: 0;
		bottom: -1px;
		max-width: 100%;
		padding: 2px 5px;
		border-radius: 3px;
		background: rgb(200 90 72 / 0.2);
		color: #f2c5bb;
		font-size: 9px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	button:focus-visible {
		outline: 2px solid var(--ld-gold, #c8a653);
		outline-offset: 1px;
	}
</style>
