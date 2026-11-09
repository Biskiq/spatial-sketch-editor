<script lang="ts">
	/**
	 * The Ink plate: the #285 shape row bound to Layout's existing Ink surface.
	 * It never writes geometry itself; every command goes through the adapter's
	 * published controller.
	 */
	import WorldIcon from './WorldIcon.svelte';
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

	function setShape(mode: 'line' | 'box' | 'circle'): void {
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

	const height = $derived(snapshot.options?.height ?? 3);
	const heightName = $derived(Math.abs(height - 2.4) < 0.01 ? 'Low' : Math.abs(height - 3.6) < 0.01 ? 'Tall' : 'Room');
	const shapeName = $derived(
		snapshot.wallMode === 'box' ? 'Box' : snapshot.wallMode === 'circle' ? 'Circle' : 'Line'
	);
	// The donor shows the current choice even before a Wall exists. The controls
	// still write only through the Ink surface once it has an Opening to change.
	const openingKind = $derived(snapshot.opening?.kind ?? 'door');
	const openingProfile = $derived(snapshot.opening?.profile ?? 'rectangular');
	const kindName = $derived(openingKind === 'window' ? 'Window' : 'Door');
	const profileName = $derived(
		openingProfile === 'rounded' ? 'Arch' : openingProfile === 'pointed' ? 'Pointed' : 'Square'
	);
</script>

<div class="ink-plate" data-ink-plate data-ink-reading={reading}>
	{#if reading === 'wall'}
		<div class="pg">
			<span class="gl" title="Shape">{shapeName}</span>
			<div class="opts" role="group" aria-label="Shape">
				<button
					type="button"
					class="opt"
					aria-label="Line"
					aria-pressed={snapshot.wallMode === 'line'}
					title="Line"
					onclick={() => setShape('line')}
				><WorldIcon name="shape-line" size={19} /></button>
				<button type="button" class="opt" aria-label="Arc" title="Curved walls arrive with T1" disabled>
					<WorldIcon name="shape-arc" size={19} />
				</button>
				<button
					type="button"
					class="opt"
					aria-label="Box"
					aria-pressed={snapshot.wallMode === 'box'}
					title="Box"
					onclick={() => setShape('box')}
				><WorldIcon name="shape-box" size={19} /></button>
				<button
					type="button"
					class="opt"
					aria-label="Circle"
					aria-pressed={snapshot.wallMode === 'circle'}
					title="Circle"
					onclick={() => setShape('circle')}
				><WorldIcon name="shape-circle" size={19} /></button>
			</div>
		</div>
		<div class="pg">
			<span class="gl" title="Height">{heightName} · {height.toFixed(1)} m</span>
			<div class="opts" role="group" aria-label="Height">
				{#each [2.4, 3, 3.6] as option (option)}
					<button
						type="button"
						class="opt"
						aria-label={`${option.toFixed(1)} metres`}
						aria-pressed={Math.abs(height - option) < 0.01}
						title={`${option.toFixed(1)} m`}
						onclick={() => setHeight(option)}
					><WorldIcon name={option === 2.4 ? 'h-low' : option === 3.6 ? 'h-tall' : 'h-room'} size={19} /></button>
				{/each}
			</div>
		</div>
	{:else}
		<div class="pg">
			<span class="gl" title="Kind">{kindName}</span>
			<div class="opts" role="group" aria-label="Kind">
				<button
					type="button"
					class="opt"
					aria-label="Door"
					aria-pressed={openingKind === 'door'}
					title="Door"
					onclick={() => setOpening('door', openingProfile)}
				><WorldIcon name="op-door" size={19} /></button>
				<button
					type="button"
					class="opt"
					aria-label="Window"
					aria-pressed={openingKind === 'window'}
					title="Window"
					onclick={() => setOpening('window', openingProfile)}
				><WorldIcon name="op-window" size={19} /></button>
			</div>
		</div>
		<div class="pg">
			<span class="gl" title="Profile">{profileName}</span>
			<div class="opts" role="group" aria-label="Profile">
				<button
					type="button"
					class="opt"
					aria-label="Square"
					aria-pressed={openingProfile === 'rectangular'}
					title="Square"
					onclick={() => setOpening(openingKind, 'rectangular')}
				><WorldIcon name="shape-box" size={19} /></button>
				<button
					type="button"
					class="opt"
					aria-label="Arch"
					aria-pressed={openingProfile === 'rounded'}
					title="Arch"
					onclick={() => setOpening(openingKind, 'rounded')}
				><WorldIcon name="op-arch" size={19} /></button>
				<button type="button" class="opt" aria-label="Pointed" title="Pointed openings arrive with T1" disabled>
					<WorldIcon name="op-niche" size={19} />
				</button>
			</div>
		</div>
	{/if}

	<div class="pg end">
		<span class="gl"></span>
		<div class="opts ink-actions">
			<button type="button" class="act more" onclick={onMore} title="Open exact Ink settings">More</button>
			<button type="button" class="act" data-ink-backtrack disabled={!snapshot.canBacktrack} onclick={() => inkSurface()?.controller.backtrack()}>Back</button>
			<button type="button" class="act" data-ink-finish disabled={!snapshot.canFinish} onclick={() => inkSurface()?.controller.finish()}>Finish</button>
			<button type="button" class="act" data-ink-close disabled={!snapshot.canClose} onclick={() => inkSurface()?.controller.close()}>Close ring</button>
		</div>
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
		gap: 18px;
		width: 100%;
		min-width: max-content;
		height: 100%;
	}
	.pg {
		display: grid;
		flex: none;
		gap: 3px;
	}
	.pg.end {
		margin-left: auto;
	}
	/* Miniature marks stay below the UI scale. */
	.gl {
		color: var(--shell-ink-3);
		font: 400 9.5px/1 var(--shell-mono);
		letter-spacing: 0.02em;
		white-space: nowrap;
	}
	.opts {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 31px;
	}
	.opt {
		display: grid;
		place-items: center;
		flex: none;
		width: 30px;
		height: 30px;
		padding: 0;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--shell-ink-2);
		cursor: pointer;
	}
	.opt:hover:not([aria-pressed='true']) {
		background: var(--shell-hover);
		color: var(--shell-ink);
	}
	.opt[aria-pressed='true'] {
		background: var(--shell-forest);
		color: var(--shell-ink-light);
	}
	.opt:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.act {
		flex: none;
		height: 30px;
		padding: 0 8px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--shell-ink-2);
		font: 500 var(--shell-text-utility)/1 var(--shell-sans);
		white-space: nowrap;
		cursor: pointer;
	}
	.act:hover {
		background: var(--shell-hover);
		color: var(--shell-ink);
	}
	.act:disabled {
		color: var(--shell-ink-3);
		opacity: 0.58;
		cursor: default;
	}
	/* The plate's disclosure mark keeps the gold accent; it is not a state. */
	.act.more {
		color: var(--shell-gold);
	}
	.refusal {
		position: absolute;
		right: 0;
		bottom: 0;
		max-width: 100%;
		padding: 2px 5px;
		border-radius: 3px;
		background: var(--shell-refuse-bg);
		color: var(--shell-refuse);
		font: 9px/1.2 var(--shell-sans);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	button:focus-visible {
		outline: var(--shell-focus-ring-light);
		outline-offset: -2px;
	}
</style>
