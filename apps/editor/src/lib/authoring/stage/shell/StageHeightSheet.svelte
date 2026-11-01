<script module lang="ts">
	/**
	 * How long the one-time pin hint stays before it clears itself. The hint is never
	 * dismissed by the creator: it appears once per Stage session and goes away.
	 */
	export const PIN_HINT_MS = 6000;
	/**
	 * The rail's height in CSS px (13 rem at the root size). The tick labels use it only to
	 * skip a label that would sit on the one above it; the layout itself is in rem.
	 */
	export const RAIL_PX = 208;
	/** The smallest gap, in CSS px, between two tick labels that are both shown. */
	export const TICK_LABEL_GAP_PX = 16;
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
	 *
	 * R217.S22 (D11, D42): a thin line with a knob and semantic ticks, not a boxed
	 * panel. The value shows on focus, drag and touch. The one pin hint is owned by the
	 * Stage session (`pinHintSeen`, TD-15), appears on the first pin use and clears
	 * itself. The Sheet positions its own lane, and the route measures that lane.
	 *
	 * R217.S23 (the light-ground fix): the Sheet's ink does not depend on the ground it
	 * sits on. The 3D ground is pale on the plate and dark on the mat margin, Paper is
	 * pale and Shaded is dark, so the rail, ticks, knob, value and labels all stand on
	 * their own pale plate (`--shell-paper`) in forest ink (`--shell-forest`,
	 * `--shell-forest-raised`). Pins are gold (`--shell-gold`, `--shell-gold-ink`). Every
	 * pairing is a shell-role token, so the contrast is the same on any ground.
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
		pinHintSeen = false,
		onPinHintSeen = () => {},
		laneRef = $bindable(null),
		onSetHeight,
		onAddPin,
		onRemovePin,
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
		/**
		 * Whether this Stage session has already shown the pin hint. The owner (the Stage
		 * host) holds it, so a fresh Stage session shows its own first-pin hint.
		 */
		pinHintSeen?: boolean;
		onPinHintSeen?: () => void;
		/** The Sheet's own lane box, so the host can publish its measured width. */
		laneRef?: HTMLElement | null;
		onSetHeight: (heightMeters: number, cause: StageHeightCause) => void;
		onAddPin: () => void;
		onRemovePin: (heightMeters: number) => void;
		onActiveChange: (active: boolean) => void;
		onResetSubscribe: (onReset: () => void) => () => void;
	} = $props();

	let active = false;
	let dragging = $state(false);
	let hovered = $state(false);
	let focused = $state(false);
	/** A finger is on the rail: the value shows for a tap as well as a drag. */
	let touching = $state(false);
	let dragPointerId: number | null = null;
	let snapName = $state<string | null>(null);
	let hintVisible = $state(false);
	let hintTimer: ReturnType<typeof setTimeout> | null = null;
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
			if (best === null || Math.abs(tick.heightMeters - heightMeters) < Math.abs(best.heightMeters - heightMeters)) {
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
			const px = (tick.heightMeters / Math.max(maxMeters, 1e-9)) * RAIL_PX;
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
			if (hintTimer !== null) {
				clearTimeout(hintTimer);
				hintTimer = null;
			}
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

	/**
	 * Pin the current height. The first pin of a Stage session shows the hint, once,
	 * and the hint clears itself; a later pin shows nothing.
	 */
	function pinAtHeight(): void {
		onAddPin();
		if (pinHintSeen) return;
		onPinHintSeen();
		hintVisible = true;
		if (hintTimer !== null) clearTimeout(hintTimer);
		hintTimer = setTimeout(() => {
			hintVisible = false;
			hintTimer = null;
		}, PIN_HINT_MS);
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
	data-ink="forest-on-paper"
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
	<div class="rail-wrap">
		{#if labelsShown}
			<span class="labels" aria-hidden="true">
				{#each labelledTicks as tick (`${tick.kind}:${tick.heightMeters}:${tick.label}`)}
					<span class="tick-label" class:datum={tick.kind === 'datum'} style={`bottom: ${percentOf(tick.heightMeters)}%`}>{tick.label}</span>
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
			onclick={pinAtHeight}
		>
			＋
		</button>
	</div>
	<p class="readout" class:shown={valueShown} aria-live="polite">{heightMeters.toFixed(2)} m</p>
	{#if snapName !== null}
		<p class="snap" role="status">{snapName}</p>
	{/if}
</div>
{#if hintVisible}
	<p class="hint" role="note" data-pin-hint>Pins mark a working height for this session. They are never saved.</p>
{/if}

<style>
	/*
	 * The Sheet is a line on its own pale plate, not a box (R217.S22, D11) and not dark on
	 * the mat (R217.S23). It is absolutely placed in the Stage's right-edge (or left-edge)
	 * lane. The route measures this lane's width and clears the Card from it. Every colour is
	 * a shell-role token (`shell-roles.css`), so the ink holds on any ground.
	 */
	.sheet {
		--track-left: 4.5rem;
		--track-w: 2.25rem;
		--add-w: 1.4rem;
		position: absolute;
		top: 50%;
		right: 0.75rem;
		z-index: 8;
		transform: translateY(-50%);
		display: grid;
		justify-items: start;
		gap: 0.3rem;
		/* The label column, the track and the add button; the Card clears the measured width. */
		width: calc(var(--track-left) + var(--track-w) + 0.25rem + var(--add-w) + 0.25rem);
		font-size: 0.68rem;
		line-height: 1.25;
		color: var(--shell-forest, #11291f);
	}
	.sheet.left {
		right: auto;
		left: 0.75rem;
	}
	.rail-wrap {
		position: relative;
		width: 100%;
		height: 13rem;
	}
	/* The tick names sit in their own column, on the left of the track. */
	.labels {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: calc(var(--track-left) - 0.25rem);
		pointer-events: none;
	}
	.tick-label {
		position: absolute;
		right: 0;
		max-width: 100%;
		overflow: hidden;
		padding: 0 0.3rem;
		border: 1px solid var(--shell-forest-raised, #22503c);
		border-radius: 0.25rem;
		background: var(--shell-paper, #e9ebe6);
		color: var(--shell-forest, #11291f);
		font-size: 0.66rem;
		line-height: 1.4;
		white-space: nowrap;
		text-overflow: ellipsis;
		transform: translateY(50%);
	}
	.tick-label.datum {
		font-weight: 650;
	}
	/*
	 * The track is the pressable rail: a pale plate the ink stands on. Its hit area is the
	 * whole track width; the plate is the drawn capsule inside it.
	 */
	.track {
		position: absolute;
		top: 0;
		bottom: 0;
		left: var(--track-left);
		width: var(--track-w);
		cursor: ns-resize;
		touch-action: none;
	}
	.track::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 1.25rem;
		box-sizing: border-box;
		transform: translateX(-50%);
		border: 1px solid var(--shell-forest-raised, #22503c);
		border-radius: 0.625rem;
		background: var(--shell-paper, #e9ebe6);
	}
	.rail {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 1px;
		transform: translateX(-50%);
		background: var(--shell-forest-raised, #22503c);
	}
	.tick {
		position: absolute;
		left: 50%;
		width: 0.9rem;
		height: 1px;
		transform: translate(-50%, 50%);
		background: var(--shell-forest-raised, #22503c);
	}
	.tick.datum {
		width: 1.1rem;
		background: var(--shell-forest, #11291f);
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
		border: 1px solid var(--shell-gold-ink, #74560c);
		border-radius: 50%;
		background: var(--shell-gold, #d4ad45);
		color: var(--shell-forest, #11291f);
		font-size: 0.65rem;
		cursor: pointer;
	}
	/* The knob is the drawn ring on the plate; its pressable area is the rail's track. */
	.knob {
		position: absolute;
		left: 50%;
		width: 0.9rem;
		height: 0.9rem;
		box-sizing: border-box;
		transform: translate(-50%, 50%);
		border: 2px solid var(--shell-forest, #11291f);
		border-radius: 50%;
		background: var(--shell-paper, #e9ebe6);
		pointer-events: none;
	}
	.add {
		position: absolute;
		left: calc(var(--track-left) + var(--track-w) + 0.1rem);
		width: var(--add-w);
		height: var(--add-w);
		padding: 0;
		transform: translate(0, 50%);
		border: 1px solid var(--shell-forest-raised, #22503c);
		border-radius: 50%;
		background: var(--shell-forest-raised, #22503c);
		color: var(--shell-paper, #e9ebe6);
		font: inherit;
		cursor: pointer;
	}
	/* The value and the snap name are chips: forest ink on the pale plate. */
	.readout,
	.snap {
		margin: 0 0 0 var(--track-left);
		padding: 0.05rem 0.35rem;
		border: 1px solid var(--shell-forest-raised, #22503c);
		border-radius: 0.25rem;
		background: var(--shell-paper, #e9ebe6);
		color: var(--shell-forest, #11291f);
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.01em;
		white-space: nowrap;
	}
	.readout {
		opacity: 0;
		transition: opacity 120ms ease;
	}
	.readout.shown {
		opacity: 1;
	}
	.snap {
		font-size: 0.62rem;
	}
	/*
	 * The pin hint is a Stage note above the lower column, on the left edge, clear of the
	 * Card and the Sheet lane. It is not interactive and it clears itself. Forest ground and
	 * paper ink, both shell roles, so it reads on the pale plate and on the mat alike.
	 */
	.hint {
		position: absolute;
		z-index: 9;
		left: calc(var(--sheet-lane-left, 0px) + 1rem);
		bottom: calc(var(--lower-column-height, 0px) + 1.25rem);
		width: min(16rem, calc(100% - 2rem));
		margin: 0;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--shell-gold-ink, #74560c);
		border-radius: 0.4rem;
		background: var(--shell-forest, #11291f);
		color: var(--shell-paper, #e9ebe6);
		font-size: 0.66rem;
		line-height: 1.35;
		pointer-events: none;
	}
	.track:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--shell-gold, #d4ad45);
		outline-offset: 2px;
	}
	.instant .tick,
	.instant .knob,
	.instant .readout {
		transition: none;
	}
	/* PLATE's coarse-pointer law: every pressable part of the Sheet is 44 × 44 px, even
	   though the drawn mark stays small. The knob's own box is 44 px; the track is 44 px wide. */
	@media (pointer: coarse) {
		.sheet {
			--track-w: 44px;
			--add-w: 44px;
		}
		.track {
			width: 44px;
		}
		.knob {
			width: 44px;
			height: 44px;
			border: 0;
			background: transparent;
		}
		.knob::before {
			content: '';
			position: absolute;
			inset: 15px;
			box-sizing: border-box;
			border: 2px solid var(--shell-forest, #11291f);
			border-radius: 50%;
			background: var(--shell-paper, #e9ebe6);
		}
		.add,
		.pin {
			min-width: 44px;
			min-height: 44px;
			font-size: 1rem;
		}
		.add {
			width: 44px;
			height: 44px;
		}
	}
</style>
