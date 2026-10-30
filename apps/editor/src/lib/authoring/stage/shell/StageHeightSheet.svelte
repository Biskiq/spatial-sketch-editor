<script module lang="ts">
	/** The one-time hint is a session fact, not project state. */
	let heightHintSeen = false;
</script>

<script lang="ts">
	/**
	 * R217.S06 — PLATE's **Height Sheet** in the Stage's right-edge slot.
	 *
	 * The Sheet answers "at what height" and publishes one fact. It is host view
	 * state: dragging it moves the Plan cut, it snaps to owner-declared surfaces
	 * and to session pins, and it never arms a tool, changes selection, writes
	 * source, creates history or makes the project dirty.
	 *
	 * Ticks are the floor datum (long), found surfaces (short) and pins (round).
	 * The host has already merged the owners' declarations; this component only
	 * draws them and maps pointer travel to the same height fact.
	 */
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
		onSetHeight,
		onAddPin,
		onRemovePin,
		onActiveChange
	}: {
		heightMeters: number;
		ticks: readonly StageHeightTick[];
		pins: readonly number[];
		/** The S05 increment, or 0.1 m while Snap is off. */
		snapIncrement: number;
		reducedMotion?: boolean;
		side?: 'left' | 'right';
		onSetHeight: (heightMeters: number, cause: StageHeightCause) => void;
		onAddPin: () => void;
		onRemovePin: (heightMeters: number) => void;
		onActiveChange: (active: boolean) => void;
	} = $props();

	let active = false;
	let dragging = $state(false);
	let hovered = false;
	let focused = false;
	let dragPointerId: number | null = null;
	let snapName = $state<string | null>(null);
	let hintDismissed = $state(false);
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
	const foundTick = $derived(ticks.find((tick) => tick.kind === 'found') ?? null);
	const showHint = $derived(foundTick !== null && !hintDismissed && !heightHintSeen);

	const percentOf = (height: number): number =>
		maxMeters > 0 ? Math.min(100, Math.max(0, (height / maxMeters) * 100)) : 0;
	const nearestTick = $derived.by(() => {
		let best: StageHeightTick | null = null;
		for (const tick of ticks) {
			if (best === null || Math.abs(tick.heightMeters - heightMeters) < Math.abs(best.heightMeters - heightMeters)) {
				best = tick;
			}
		}
		return best;
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
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		dragPointerId = event.pointerId;
		dragging = true;
		syncActive();
		applyDrag(event.clientY, event.altKey);
	}

	function onPointerMove(event: PointerEvent): void {
		if (!dragging) return;
		event.preventDefault();
		applyDrag(event.clientY, event.altKey);
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
		window.addEventListener('blur', onBlur);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			window.removeEventListener('blur', onBlur);
			document.removeEventListener('visibilitychange', onVisibility);
			// The lens switch unmounts the Sheet; no active tail may survive it.
			dragging = false;
			dragPointerId = null;
			snapName = null;
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
		const values = [...new Set([0, ...ticks.map((tick) => tick.heightMeters), ...pins])].sort((a, b) => a - b);
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

	function dismissHint(): void {
		hintDismissed = true;
		heightHintSeen = true;
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
	data-stage-height-sheet
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
	<span class="title">Height</span>
	<div class="rail-wrap">
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
			onpointerup={finishDrag}
			onpointercancel={finishDrag}
			onlostpointercapture={finishDrag}
			onkeydown={onKeydown}
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
					aria-label={`Remove the pin at ${pin.toFixed(2)} metres`}
					title={`Remove pin at ${pin.toFixed(2)} m`}
					onpointerdown={stopPointer}
					onclick={() => onRemovePin(pin)}
				>
					×
				</button>
			{/each}
			<span class="knob" style={`bottom: ${percentOf(heightMeters)}%`} aria-hidden="true"></span>
		</div>
		<button
			type="button"
			class="add"
			style={`bottom: ${percentOf(heightMeters)}%`}
			aria-label={`Pin the height at ${heightMeters.toFixed(2)} metres`}
			title="Pin this height for the session"
			onpointerdown={stopPointer}
			onclick={onAddPin}
		>
			＋
		</button>
	</div>
	<p class="readout" aria-live="polite">{heightMeters.toFixed(2)} m</p>
	{#if snapName !== null}
		<p class="snap" role="status">{snapName}</p>
	{/if}
	{#if showHint}
		<div class="hint" role="note">
			<p>Pins mark a working height for this session. They are never saved.</p>
			<button type="button" onclick={dismissHint}>Got it</button>
		</div>
	{/if}
</div>

<style>
	.sheet {
		--chassis-forest: #11291f;
		--chassis-hairline: #405d4c;
		display: grid;
		justify-items: center;
		gap: 0.3rem;
		width: 4.6rem;
		padding: 0.55rem 0.4rem 0.45rem;
		border: 1px solid var(--chassis-hairline);
		border-radius: 0.5rem;
		background: rgb(17 41 31 / 94%);
		color: #f4f0e9;
		box-shadow: 0 0.4rem 1.2rem rgb(6 20 14 / 35%);
		font-size: 0.68rem;
		line-height: 1.25;
	}
	.title {
		letter-spacing: 0.04em;
		text-transform: uppercase;
		opacity: 0.78;
	}
	.rail-wrap {
		position: relative;
		display: grid;
		justify-items: center;
		height: 13rem;
	}
	.track {
		position: relative;
		width: 2.6rem;
		height: 100%;
		cursor: ns-resize;
		touch-action: none;
	}
	.rail {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 1px;
		transform: translateX(-50%);
		background: #6d8f7b;
	}
	.tick {
		position: absolute;
		left: 50%;
		width: 0.55rem;
		height: 1px;
		transform: translate(-50%, 50%);
		background: #9fb8a8;
	}
	.tick.datum {
		width: 1.1rem;
		background: #f4f0e9;
	}
	.pin {
		position: absolute;
		left: 50%;
		display: grid;
		place-items: center;
		width: 1.1rem;
		height: 1.1rem;
		padding: 0;
		transform: translate(-50%, 50%);
		border: 1px solid #d8b26a;
		border-radius: 50%;
		background: #3a3020;
		color: #f5e8b5;
		font-size: 0.65rem;
		cursor: pointer;
	}
	.knob {
		position: absolute;
		left: 50%;
		width: 0.9rem;
		height: 0.9rem;
		transform: translate(-50%, 50%);
		border: 2px solid #f4f0e9;
		border-radius: 50%;
		background: #11291f;
		pointer-events: none;
	}
	.add {
		position: absolute;
		left: calc(100% - 0.1rem);
		width: 1.4rem;
		height: 1.4rem;
		padding: 0;
		transform: translate(0, 50%);
		border: 1px solid var(--chassis-hairline);
		border-radius: 50%;
		background: #22503c;
		color: #f4f0e9;
		font: inherit;
		cursor: pointer;
	}
	.readout {
		margin: 0;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.01em;
	}
	.snap {
		margin: 0;
		max-width: 7rem;
		color: #f5e8b5;
		font-size: 0.62rem;
		text-align: center;
	}
	.hint {
		position: absolute;
		right: calc(100% + 0.45rem);
		bottom: 0;
		width: 11rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid #8a6a31;
		border-radius: 0.4rem;
		background: #2b2417;
		color: #f4e5c8;
		font-size: 0.66rem;
	}
	.sheet.left .hint {
		right: auto;
		left: calc(100% + 0.45rem);
	}
	.hint p {
		margin: 0 0 0.35rem;
	}
	.hint button {
		padding: 0.25rem 0.45rem;
		border: 1px solid #8a6a31;
		border-radius: 0.3rem;
		background: #3a3020;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.sheet {
		position: relative;
	}
	.track:focus-visible {
		outline: 2px solid #9fd0b4;
		outline-offset: 3px;
		border-radius: 0.3rem;
	}
	button:focus-visible {
		outline: 2px solid #9fd0b4;
		outline-offset: 2px;
	}
	.instant .tick,
	.instant .knob {
		transition: none;
	}
	/* PLATE's coarse-pointer law: the knob's pressable area is 44 px, even
	   though the drawn mark stays small. */
	@media (pointer: coarse) {
		.track {
			width: 44px;
		}
		.add,
		.pin {
			min-width: 44px;
			min-height: 44px;
			font-size: 1rem;
		}
		.pin {
			background: rgb(58 48 32 / 92%);
		}
	}
</style>
