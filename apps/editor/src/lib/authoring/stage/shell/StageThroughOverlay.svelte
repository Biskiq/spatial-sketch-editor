<script lang="ts">
	/**
	 * The Look through capture frame, its pill and the shared-View confirmation.
	 * The frame element is bound up for capture; every command stays on the
	 * inspection port the region was handed.
	 */
	let {
		lookThrough,
		lightCoverage,
		element = $bindable(undefined)
	}: {
		lookThrough: {
			readonly mode: 'view' | 'light';
			readonly label: string;
			readonly moved: boolean;
			readonly confirm?: readonly string[] | null;
			readonly canUpdate: boolean;
			readonly beam?: { readonly halfAngleDegrees: number; readonly reachMeters: number | null } | null;
			onUpdate: () => void;
			onExit: () => void;
			onCapture?: () => void;
			onClearConfirm?: () => void;
		};
		lightCoverage: {
			readonly capRing: readonly (readonly [number, number])[];
			readonly innerRing: readonly (readonly [number, number])[] | null;
		} | null;
		element?: HTMLElement;
	} = $props();

	/** One projected world ring as an SVG polygon; the overlay is not a projection. */
	function ringPoints(points: readonly (readonly [number, number])[]): string {
		return points.map((point) => `${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(' ');
	}
</script>

<!-- The capture frame sits beside the Card and above the Guide; helpers are hidden. -->
<div class="through-slot" bind:this={element} data-through-frame>
	<div class="through-frame" aria-hidden="true"></div>
	<div class="through-safe" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
	{#if lightCoverage !== null}
		<!-- The real Spot cone, projected by the same evaluation the render
		     uses. A ring outside the frame is the truthful answer that the
		     beam is wider than this lens, never a FOV-shaped beam claim. -->
		<svg class="light-coverage" aria-hidden="true">
			{#if lightCoverage.innerRing !== null}
				<polygon class="inner" points={ringPoints(lightCoverage.innerRing)} />
			{/if}
			<polygon class="cap" points={ringPoints(lightCoverage.capRing)} />
		</svg>
	{/if}
</div>
<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div
	class="mode-pill through-pill"
	class:light={lookThrough.mode === 'light'}
	data-look-through-pill
	onclick={(event) => event.stopPropagation()}
	onpointerdown={(event) => event.stopPropagation()}
>
	<span class="live-dot" aria-hidden="true"></span>
	<span>Looking through <b>{lookThrough.label}</b></span>
	{#if lookThrough.mode === 'light' && lookThrough.beam}
		<span class="beam"
			>Beam {Math.round(lookThrough.beam.halfAngleDegrees)}°{lookThrough.beam.reachMeters === null
				? ''
				: ` · ${lookThrough.beam.reachMeters.toFixed(2)} m`}</span
		>
	{/if}
	{#if lookThrough.moved}<span class="moved">moved</span>{/if}
	{#if lookThrough.mode === 'light'}
		<button
			type="button"
			class="pill-primary"
			disabled={!lookThrough.canUpdate}
			title="Write the Spot’s aim as one change"
			onclick={() => lookThrough.onUpdate()}>Done</button
		>
		<button type="button" onclick={() => lookThrough.onExit()}>Exit Esc</button>
	{:else}
		<button
			type="button"
			class="pill-primary"
			disabled={!lookThrough.moved || !lookThrough.canUpdate}
			title={lookThrough.moved
				? 'Write the provisional pose back to this View'
				: 'Adjust the camera or lens first'}
			onclick={() => lookThrough.onUpdate()}>Update View</button
		>
		<button type="button" onclick={() => lookThrough.onExit()}>Exit View Esc</button>
		<button
			type="button"
			title="Capture this provisional pose as a new View"
			onclick={() => lookThrough.onCapture?.()}>Capture</button
		>
	{/if}
</div>
{#if lookThrough.mode === 'view' && lookThrough.confirm != null}
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div
		class="through-confirm"
		role="alertdialog"
		tabindex="-1"
		aria-label="Update a shared View"
		onclick={(event) => event.stopPropagation()}
		onpointerdown={(event) => event.stopPropagation()}
	>
		<p>Also changes {lookThrough.confirm.join(', ')}.</p>
		<div class="through-confirm-actions">
			<button
				type="button"
				class="pill-primary"
				onclick={() => lookThrough.onUpdate()}>Update View</button
			>
			<button type="button" onclick={() => lookThrough.onClearConfirm?.()}>Cancel</button>
		</div>
	</div>
{/if}

<style>
	/* Look through fills the Stage: a gold edge and 16:10 safe-frame ticks. */
	.through-slot {
		position: absolute;
		inset: 0;
		z-index: 2;
		container-type: size;
		pointer-events: none;
	}
	.through-frame {
		position: absolute;
		inset: 0;
		box-shadow: inset 0 0 0 3px var(--shell-gold);
	}
	.through-safe {
		position: absolute;
		left: 50%;
		top: 50%;
		width: min(100cqw - 48px, (100cqh - 24px) * 1.6);
		aspect-ratio: 16 / 10;
		transform: translate(-50%, -50%);
	}
	.through-safe i {
		position: absolute;
		width: 22px;
		height: 22px;
		border: 0 solid var(--shell-ink-light);
		filter: drop-shadow(0 0 1px rgb(0 0 0 / 0.6));
	}
	.through-safe i:nth-child(1) {
		left: 0;
		top: 0;
		border-width: 2px 0 0 2px;
	}
	.through-safe i:nth-child(2) {
		right: 0;
		top: 0;
		border-width: 2px 2px 0 0;
	}
	.through-safe i:nth-child(3) {
		left: 0;
		bottom: 0;
		border-width: 0 0 2px 2px;
	}
	.through-safe i:nth-child(4) {
		right: 0;
		bottom: 0;
		border-width: 0 2px 2px 0;
	}
	.mode-pill {
		position: absolute;
		left: 50%;
		top: 0.75rem;
		z-index: 6;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 4px 4px 12px;
		border-radius: 20px;
		background: var(--shell-glass-dark);
		color: var(--shell-ink-light);
		font-size: 12px;
		box-shadow: 0 8px 20px rgb(0 0 0 / 0.28);
	}
	.mode-pill button {
		height: 28px;
		padding: 0 11px;
		border: 0;
		border-radius: 14px;
		background: var(--shell-on-forest-wash-strong);
		color: inherit;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.mode-pill button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.mode-pill button.pill-primary {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
		font-weight: 600;
	}
	.mode-pill .live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--shell-leaf-soft);
	}
	.mode-pill .moved {
		color: var(--shell-leaf-soft);
		font-weight: 600;
	}
	.mode-pill .beam {
		color: var(--shell-ink-light);
		font: 10.5px var(--shell-mono);
		opacity: 0.78;
	}
	/* The real Spot cone: a line-only coverage ring over the rendered picture. */
	.light-coverage {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		pointer-events: none;
	}
	.light-coverage .cap {
		fill: none;
		stroke: var(--shell-gold-ink);
		stroke-width: 1.5;
		stroke-dasharray: 6 4;
		stroke-linecap: round;
		opacity: 0.92;
	}
	.light-coverage .inner {
		fill: none;
		stroke: var(--shell-ink-light);
		stroke-width: 1;
		stroke-dasharray: 2 4;
		stroke-linecap: round;
		opacity: 0.64;
	}
	/* Center Look through in the part of the Stage that the Index leaves visible. */
	.mode-pill.through-pill {
		--through-index-cover: var(--index-cover, 0px);
		left: calc((100% + var(--through-index-cover)) / 2);
		width: max-content;
		max-width: calc(100% - var(--through-index-cover) - 1.5rem);
		flex-wrap: wrap;
		justify-content: center;
	}
	/* A light pill is wider than a View's: keep it out of the Stage viewing toolbar. */
	.mode-pill.through-pill.light {
		top: 3.4rem;
	}
	@media (width <= 1100px) {
		:global(.editor-body[data-index-open='true']) .through-pill {
			--through-index-cover: min(var(--shell-index-width), 256px, 80%);
		}
	}
	@media (width <= 440px) {
		:global(.editor-body[data-index-open='true']) .through-pill {
			/* The narrow Index leaves too little room beside it for the controls. */
			--through-index-cover: 0px;
			z-index: 21;
		}
	}
	.through-confirm {
		position: absolute;
		left: 50%;
		top: 3.4rem;
		z-index: 7;
		transform: translateX(-50%);
		width: min(22rem, calc(100% - 2rem));
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--shell-popup-dark);
		color: var(--shell-ink-light);
		box-shadow: 0 10px 28px rgb(0 0 0 / 0.35);
		font-size: 12px;
	}
	.through-confirm p {
		margin: 0 0 8px;
	}
	.through-confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
	}
	.through-confirm button {
		height: 28px;
		padding: 0 10px;
		border: 0;
		border-radius: 7px;
		background: var(--shell-on-forest-wash-strong);
		color: inherit;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.through-confirm button.pill-primary {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
		font-weight: 600;
	}
	@media (pointer: coarse) {
		.mode-pill button,
		.through-confirm button {
			min-width: 44px;
			min-height: 44px;
		}
	}
</style>
