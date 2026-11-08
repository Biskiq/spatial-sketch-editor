<script module lang="ts">
	/**
	 * The rail's height in CSS px (13 rem at the root size). The tick labels use it only to
	 * skip a label that would sit on the one above it; the layout itself is in rem.
	 */
	export const RAIL_PX = 208;
	/** The smallest gap, in CSS px, between two tick labels that are both shown. */
	export const TICK_LABEL_GAP_PX = 16;
</script>

<script lang="ts">
	/** Session-only height rail and neutral pins. No source, history or selection writes. */
	import { onMount } from 'svelte';
	import { PLAN_DEFAULT_CUT_HEIGHT_METERS } from '../plan-parameters';
	import type { StageHeightCause, StageHeightTick } from '../stage-height-sheet';

	let {
		heightMeters,
		ticks,
		pins,
		snapIncrement,
		reducedMotion = false,
		side = 'right',
		/**
		 * While an authored drawing task owns the Stage, the Sheet's lane must not
		 * intercept presses aimed at the canvas beneath it. It stays visible and
		 * keyboard-operable; only its pointer surface yields.
		 */
		drawing = false,
		laneRef = $bindable(null),
		onSetHeight,
		onActiveChange,
		onResetSubscribe
	}: {
		heightMeters: number;
		ticks: readonly StageHeightTick[];
		pins: readonly number[];
		/** The S05 increment, or 0.1 m while Snap is off. */
		snapIncrement: number;
		reducedMotion?: boolean;
		side?: 'left' | 'right';
		drawing?: boolean;
		/** The Sheet's own lane box, so the host can publish its measured width. */
		laneRef?: HTMLElement | null;
		onSetHeight: (heightMeters: number, cause: StageHeightCause) => void;
		onActiveChange: (active: boolean) => void;
		onResetSubscribe: (onReset: () => void) => () => void;
	} = $props();

	let railHeight = $state(RAIL_PX);
	function measureRail(node: HTMLElement) {
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver((entries) => {
			railHeight = entries[0]?.contentRect.height ?? RAIL_PX;
		});
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}
	let active = false;
	let dragging = $state(false);
	let hovered = $state(false);
	let focused = $state(false);
	/** A finger is on the rail: the value shows for a tap as well as a drag. */
	let touching = $state(false);
	let dragPointerId: number | null = null;
	let snapName = $state<string | null>(null);
	let track = $state<HTMLDivElement | undefined>(undefined);

	const maxMeters = $derived(
		Math.max(
			// The default cut is a known height, so the rail always has a metre
			// above it even when no owner has declared a found surface yet.
			PLAN_DEFAULT_CUT_HEIGHT_METERS + 1,
			heightMeters,
			...ticks.map((tick) => tick.heightMeters + 1)
		)
	);
	/** The value is stated while the Sheet is focused, dragged or touched, and not otherwise. */
	const valueShown = $derived(focused || dragging || touching);
	/** The tick names show with the value, and while the pointer rests on the Sheet. */
	const labelsShown = $derived(valueShown || hovered);

	const percentOf = (height: number): number =>
		maxMeters > 0 ? Math.min(100, Math.max(0, (height / maxMeters) * 100)) : 0;
	const nearestTick = $derived.by(() => {
		let best: StageHeightTick | null = null;
		for (const tick of ticks) {
			if (
				best === null ||
				Math.abs(tick.heightMeters - heightMeters) < Math.abs(best.heightMeters - heightMeters)
			) {
				best = tick;
			}
		}
		return best;
	});
	/**
	 * The tick names that fit on the rail. Ticks are taken from the floor upward, and a
	 * name that would sit within `TICK_LABEL_GAP_PX` of the one below it is left out, so the
	 * labels never stack. The tick and its mark stay drawn even when its name is not.
	 */
	const labelledTicks = $derived.by(() => {
		const shown: StageHeightTick[] = [];
		let lastPx = Number.NEGATIVE_INFINITY;
		for (const tick of [...ticks].sort((a, b) => a.heightMeters - b.heightMeters)) {
			const px = (tick.heightMeters / Math.max(maxMeters, 1e-9)) * railHeight;
			if (px - lastPx < TICK_LABEL_GAP_PX) continue;
			shown.push(tick);
			lastPx = px;
		}
		return shown;
	});
	const valueText = $derived(
		nearestTick === null
			? `${heightMeters.toFixed(2)} metres`
			: `${heightMeters.toFixed(2)} metres, nearest ${nearestTick.label}`
	);

	/**
	 * The plane is shown while the Sheet is hovered, focused **or** dragged. They
	 * are separate reasons: releasing a drag while the slider is still focused
	 * must not start the hide tail, and leaving the pointer during a drag must
	 * keep the plane up until the gesture ends.
	 */
	function syncActive(): void {
		const next = dragging || hovered || focused;
		if (active === next) return;
		active = next;
		onActiveChange(next);
	}

	function clamp(value: number): number {
		return Math.min(maxMeters, Math.max(0, Math.round(value * 1000) / 1000));
	}

	function heightFromPointer(clientY: number): number {
		const rect = track?.getBoundingClientRect();
		if (rect === undefined || rect.height <= 0) return heightMeters;
		return clamp(((rect.bottom - clientY) / rect.height) * maxMeters);
	}

	function snapAtPointer(clientY: number): StageHeightTick | null {
		const rect = track?.getBoundingClientRect();
		if (rect === undefined || rect.height <= 0) return null;
		const threshold = window.matchMedia('(pointer: coarse)').matches ? 12 : 6;
		let best: { tick: StageHeightTick; distance: number } | null = null;
		for (const tick of ticks) {
			const projectedY = rect.bottom - (tick.heightMeters / maxMeters) * rect.height;
			const distance = Math.abs(clientY - projectedY);
			if (distance > threshold) continue;
			if (best === null || distance < best.distance) best = { tick, distance };
		}
		for (const pin of pins) {
			const projectedY = rect.bottom - (pin / maxMeters) * rect.height;
			const distance = Math.abs(clientY - projectedY);
			if (distance > threshold) continue;
			const tick: StageHeightTick = { kind: 'found', heightMeters: pin, label: 'Pin' };
			if (best === null || distance < best.distance) best = { tick, distance };
		}
		return best?.tick ?? null;
	}

	function applyDrag(clientY: number, suspendSnap: boolean): void {
		const snapped = suspendSnap ? null : snapAtPointer(clientY);
		snapName = snapped === null ? null : `Snapped to ${snapped.label}`;
		onSetHeight(snapped?.heightMeters ?? heightFromPointer(clientY), 'drag');
	}

	function onPointerDown(event: PointerEvent): void {
		// One press owns the Sheet until its matching terminal event. A secondary
		// contact must not take over capture or end the active drag.
		if (dragPointerId !== null) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		dragPointerId = event.pointerId;
		dragging = true;
		touching = event.pointerType === 'touch';
		syncActive();
		applyDrag(event.clientY, event.altKey);
	}

	function onPointerMove(event: PointerEvent): void {
		if (!dragging || event.pointerId !== dragPointerId) return;
		event.preventDefault();
		applyDrag(event.clientY, event.altKey);
	}

	function onPointerEnd(event: PointerEvent): void {
		if (event.pointerId !== dragPointerId) return;
		finishDrag();
	}

	/**
	 * End the drag without applying anything. The height only ever changes from
	 * applyDrag, so an interrupted press leaves the fact exactly where it was.
	 * Set `dragging` before releasing capture: releasing dispatches
	 * lostpointercapture synchronously, and the re-entrant call must be a no-op.
	 */
	function finishDrag(): void {
		if (!dragging) return;
		dragging = false;
		touching = false;
		snapName = null;
		const pointerId = dragPointerId;
		dragPointerId = null;
		if (pointerId !== null) {
			try {
				track?.releasePointerCapture(pointerId);
			} catch {
				// Capture may already have been lost; the gesture still ends here.
			}
		}
		syncActive();
	}

	onMount(() => {
		const onBlur = (): void => finishDrag();
		const onVisibility = (): void => {
			if (document.visibilityState === 'hidden') finishDrag();
		};
		const unsubscribeReset = onResetSubscribe(finishDrag);
		window.addEventListener('blur', onBlur);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			window.removeEventListener('blur', onBlur);
			document.removeEventListener('visibilitychange', onVisibility);
			unsubscribeReset();
			// The lens switch unmounts the Sheet; no active tail may survive it.
			dragging = false;
			dragPointerId = null;
			snapName = null;
			touching = false;
			if (active) {
				active = false;
				onActiveChange(false);
			}
		};
	});

	function stepBy(delta: number): void {
		const step = Number.isFinite(snapIncrement) && snapIncrement > 0 ? snapIncrement : 0.1;
		onSetHeight(clamp(heightMeters + delta * step), 'key');
	}

	function jumpTick(direction: 1 | -1): void {
		const values = [...new Set([0, ...ticks.map((tick) => tick.heightMeters), ...pins])].sort(
			(a, b) => a - b
		);
		const next =
			direction > 0
				? values.find((value) => value > heightMeters + 1e-6)
				: [...values].reverse().find((value) => value < heightMeters - 1e-6);
		onSetHeight(clamp(next ?? (direction > 0 ? maxMeters : 0)), 'tick');
	}

	function onKeydown(event: KeyboardEvent): void {
		switch (event.key) {
			case 'ArrowUp':
			case 'ArrowRight':
				event.preventDefault();
				stepBy(1);
				return;
			case 'ArrowDown':
			case 'ArrowLeft':
				event.preventDefault();
				stepBy(-1);
				return;
			case 'PageUp':
				event.preventDefault();
				jumpTick(1);
				return;
			case 'PageDown':
				event.preventDefault();
				jumpTick(-1);
				return;
			case 'Home':
				event.preventDefault();
				onSetHeight(0, 'key');
				return;
			default:
				return;
		}
	}

	function stopPointer(event: PointerEvent): void {
		event.stopPropagation();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="sheet"
	class:left={side === 'left'}
	class:instant={reducedMotion}
	class:drawing
	data-stage-height-sheet
	bind:this={laneRef}
	onpointerenter={() => {
		hovered = true;
		syncActive();
	}}
	onpointerleave={() => {
		hovered = false;
		syncActive();
	}}
	onfocusin={() => {
		focused = true;
		syncActive();
	}}
	onfocusout={(event) => {
		if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
			focused = false;
			syncActive();
		}
	}}
>
	<div class="rail-wrap" use:measureRail>
		{#if labelsShown}
			<span class="labels" aria-hidden="true">
				{#each labelledTicks as tick (`${tick.kind}:${tick.heightMeters}:${tick.label}`)}
					<span
						class="tick-label"
						class:datum={tick.kind === 'datum'}
						style={`bottom: ${percentOf(tick.heightMeters)}%`}>{tick.label}</span
					>
				{/each}
			</span>
		{/if}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="track"
			bind:this={track}
			role="slider"
			tabindex="0"
			aria-label="Height above the floor datum"
			aria-orientation="vertical"
			aria-valuemin={0}
			aria-valuemax={maxMeters}
			aria-valuenow={heightMeters}
			aria-valuetext={valueText}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerEnd}
			onpointercancel={onPointerEnd}
			onlostpointercapture={onPointerEnd}
			onkeydown={onKeydown}
			title="Working height · drag"
		>
			<span class="rail" aria-hidden="true"></span>
			{#each ticks as tick (`${tick.kind}:${tick.heightMeters}:${tick.label}`)}
				<span
					class="tick"
					class:datum={tick.kind === 'datum'}
					style={`bottom: ${percentOf(tick.heightMeters)}%`}
					title={`${tick.label} · ${tick.heightMeters.toFixed(3)} m`}
					aria-hidden="true"
				></span>
			{/each}
			{#each pins as pin (pin)}
				<button
					type="button"
					class="pin"
					style={`bottom: ${percentOf(pin)}%`}
					aria-label={`Jump to pin at ${pin.toFixed(2)} metres`}
					title={`Jump to pin at ${pin.toFixed(2)} m`}
					onpointerdown={stopPointer}
					onclick={() => onSetHeight(pin, 'tick')}
				>
					<span class="pin-dot"></span>
				</button>
			{/each}
			<span class="knob" style={`bottom: ${percentOf(heightMeters)}%`} aria-hidden="true"
				>{heightMeters.toFixed(2)}</span
			>
		</div>
	</div>

	{#if snapName !== null}
		<p class="snap" role="status">{snapName}</p>
	{/if}
</div>

<style>
	.sheet {
		position: absolute;
		top: 56px;
		bottom: 76px;
		right: 10px;
		z-index: 8;
		width: 40px;
		color: var(--shell-ink, #1b201c);
		font: 11px/1.35 var(--shell-mono, monospace);
	}
	.sheet.left {
		right: auto;
		left: calc(10px + var(--index-cover, 0px));
	}
	/*
	 * The armed drawing tool owns the Stage. The full-lane track yields so a press
	 * on the lane reaches the canvas; the knob handle and pins remain
	 * pointer-operable. The knob's expanded hit area is the slider's pointer
	 * handle during drawing.
	 */
	.sheet.drawing {
		pointer-events: none;
	}
	.sheet.drawing .track {
		pointer-events: none;
	}
	.sheet.drawing .knob {
		pointer-events: auto;
		cursor: ns-resize;
	}
	.sheet.drawing .knob::before {
		content: '';
		position: absolute;
		inset: -11px -2px;
		border-radius: 12px;
	}
	.sheet.drawing .pin {
		pointer-events: auto;
	}
	.rail-wrap {
		position: relative;
		width: 100%;
		height: 100%;
	}
	.track {
		position: absolute;
		inset: 0;
		cursor: ns-resize;
		touch-action: none;
	}
	.rail {
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(50% - 1px);
		width: 2px;
		border-radius: 1px;
		background: rgb(255 255 255 / 0.28);
	}
	.tick {
		position: absolute;
		left: 50%;
		width: 10px;
		height: 1.5px;
		background: rgb(255 255 255 / 0.7);
		transform: translate(-50%, 50%);
	}
	.tick.datum {
		width: 22px;
		height: 2.5px;
		background: #fff;
	}
	.knob {
		position: absolute;
		left: 50%;
		transform: translate(-50%, 50%);
		display: grid;
		place-items: center;
		box-sizing: border-box;
		height: 22px;
		min-width: 40px;
		padding: 0 5px;
		border-radius: 11px;
		background: var(--shell-sheet-knob, #fbfaf2);
		color: var(--shell-ink, #1b201c);
		box-shadow: 0 1px 4px #0006;
		font-size: 10.5px;
		font-weight: 600;
		pointer-events: none;
	}
	.labels {
		position: absolute;
		right: calc(100% + 6px);
		inset-block: 0;
		width: 180px;
		pointer-events: none;
	}
	.tick-label {
		position: absolute;
		right: 0;
		padding: 2px 5px;
		border-radius: 4px;
		background: var(--shell-sheet-knob, #fbfaf2);
		box-shadow: 0 1px 2px #0002;
		white-space: nowrap;
		transform: translateY(50%);
		font: 11px var(--shell-sans, system-ui);
	}
	.pin {
		position: absolute;
		left: 50%;
		transform: translate(-50%, 50%);
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.pin-dot {
		width: 8px;
		height: 8px;
		border: 0;
		border-radius: 50%;
		background: #fff;
	}
	.snap {
		position: absolute;
		bottom: -30px;
		right: 0;
		width: max-content;
		padding: 4px 6px;
		border-radius: 5px;
		background: #11291fdd;
		color: #fff;
	}
	@media (pointer: coarse) {
		.sheet {
			width: 44px;
		}
		.track {
			width: 44px;
		}
		.pin {
			pointer-events: auto;
			min-width: 44px;
			min-height: 44px;
		}
	}
</style>
