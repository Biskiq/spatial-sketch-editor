<script lang="ts">
	/**
	 * Align on wall / floor overlay (T2.S8 U6).
	 *
	 * View-only DOM + SVG chrome around the live Stage framed by Camera (`face`
	 * or Plan + `fit`). Ruler, repeat grid and offset/rotation handles are placed
	 * from the surface's metric mapping frame and are never serialized.
	 * Dragging or nudging previews through the Card adapter; pointerup / keyup
	 * commits once (C12).
	 */
	import { onDestroy, onMount } from 'svelte';
	import {
		alignMappingEdits,
		alignResetEdits,
		mod,
		nudgeAlignAngle,
		nudgeAlignOffset,
		snapAlignAngle,
		snapAlignOffset,
		type ActiveFinishAlign
	} from '$lib/authoring/look/finish-align.svelte';
	import type { FinishPatchEdit, FinishSource } from '@portfolio/project-model/scene-planning';
	import type { Recipe } from '@portfolio/project-model/materials';

	let {
		align,
		refusal = null,
		tileMeters,
		offsetMeters,
		angleDeg,
		source,
		recipes,
		onMaterialPreview,
		onCancelPreview,
		onCommit,
		onPutBack,
		viewportWidth = 856,
		viewportHeight = 608,
		projected = null
	}: {
		align: ActiveFinishAlign;
		refusal?: string | null;
		tileMeters: number;
		offsetMeters: readonly [number, number];
		angleDeg: number;
		source: FinishSource;
		recipes: ReadonlyMap<string, Recipe>;
		onMaterialPreview: (edits: readonly FinishPatchEdit[]) => void;
		onCancelPreview: () => void;
		onCommit: (edits: readonly FinishPatchEdit[]) => Promise<boolean> | void;
		onPutBack: () => void;
		viewportWidth?: number;
		viewportHeight?: number;
		/** The target surface's four corners projected through the live Camera, in Stage-local CSS px. */
		projected?: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number } | null;
	} = $props();

	let liveOff = $state<[number, number] | null>(null);
	let liveRot = $state<number | null>(null);
	let keyDirty = $state<'offset' | 'angle' | null>(null);
	let cancelDrag: (() => void) | null = null;

	function discardGesture(): void {
		cancelDrag?.();
		cancelDrag = null;
		liveOff = null;
		liveRot = null;
		keyDirty = null;
		onCancelPreview();
	}

	onMount(() => {
		const onEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') discardGesture();
		};
		window.addEventListener('keydown', onEscape, true);
		window.addEventListener('blur', discardGesture);
		return () => {
			window.removeEventListener('keydown', onEscape, true);
			window.removeEventListener('blur', discardGesture);
		};
	});

	onDestroy(discardGesture);

	// The layer covers the whole Stage so projected Stage-local pixels map 1:1;
	// CSS clips its chrome to the Index/Card/tray-free region. Never measured here.
	const boxW = $derived(Math.max(320, viewportWidth));
	const boxH = $derived(Math.max(240, viewportHeight));

	const tile = $derived(Math.max(0.02, tileMeters));
	const curOff = $derived<readonly [number, number]>(liveOff ?? [offsetMeters[0], offsetMeters[1]]);
	const curRot = $derived(liveRot ?? angleDeg);
	const displayOx = $derived(mod(curOff[0], tile));
	const displayOy = $derived(mod(curOff[1], tile));

	// Ruler padding (l 44, r 24, t 20, b 40) only frames the fallback rectangle.
	const pad = { l: 44, r: 24, t: 20, b: 40 };
	/**
	 * The faced surface rectangle in the SVG's own pixel frame. When the live
	 * Camera projection is available it is the target's projected corners; the
	 * fallback (no evaluation yet, or tests) fits the declared extent.
	 */
	const surfaceRect = $derived.by(() => {
		const width = boxW;
		const height = boxH;
		const live = projected;
		if (live !== null) {
			return {
				boxW: width,
				boxH: height,
				x0: live.left,
				y0: live.top,
				w: Math.max(1, live.right - live.left),
				h: Math.max(1, live.bottom - live.top)
			};
		}
		const scale = Math.min((width - pad.l - pad.r) / align.widthMeters, (height - pad.t - pad.b) / align.heightMeters);
		const w = align.widthMeters * scale;
		const h = align.heightMeters * scale;
		return {
			boxW: width,
			boxH: height,
			x0: pad.l + (width - pad.l - pad.r - w) / 2,
			y0: pad.t + (height - pad.t - pad.b - h) / 2,
			w,
			h
		};
	});
	const rectW = $derived(surfaceRect.w);
	const rectH = $derived(surfaceRect.h);
	const x0 = $derived(surfaceRect.x0);
	const y0 = $derived(surfaceRect.y0);
	const y1 = $derived(y0 + rectH);
	const scaleX = $derived(rectW / align.widthMeters);
	const scaleY = $derived(rectH / align.heightMeters);
	const tilePxX = $derived(Math.max(8, tile * scaleX));
	const tilePxY = $derived(Math.max(8, tile * scaleY));

	const hx = $derived(x0 + Math.min(displayOx, align.widthMeters) * scaleX);
	const hy = $derived(y1 - Math.min(displayOy, align.heightMeters) * scaleY);
	const armRadius = $derived(Math.min(Math.max(Math.min(tilePxX, tilePxY) * 0.9, 56), 120));
	const armAngleRad = $derived((-curRot * Math.PI) / 180);
	const rx = $derived(hx + Math.cos(armAngleRad) * armRadius);
	const ry = $derived(hy + Math.sin(armAngleRad) * armRadius);

	const xTicks = $derived.by(() => {
		const out: { x: number; major: boolean; label: string }[] = [];
		for (let m = 0; m <= align.widthMeters + 1e-6; m = Number((m + 0.1).toFixed(2))) {
			const major = Math.abs(m - Math.round(m)) < 1e-4;
			out.push({ x: x0 + m * scaleX, major, label: `${Math.round(m)} m` });
		}
		return out;
	});
	const yTicks = $derived.by(() => {
		const out: { y: number; major: boolean; label: string }[] = [];
		for (let m = 0; m <= align.heightMeters + 1e-6; m = Number((m + 0.1).toFixed(2))) {
			const major = Math.abs(m - Math.round(m)) < 1e-4;
			out.push({ y: y1 - m * scaleY, major, label: `${Math.round(m)}` });
		}
		return out;
	});

	function previewNow(off: readonly [number, number], rot: number): void {
		onMaterialPreview(alignMappingEdits(source, recipes, off, rot));
	}

	function commitNow(off: readonly [number, number], rot: number): void {
		liveOff = null;
		liveRot = null;
		keyDirty = null;
		onCancelPreview();
		const edits = alignMappingEdits(source, recipes, off, rot);
		if (edits.length > 0) void onCommit(edits);
	}

	function startOffsetDrag(event: PointerEvent): void {
		discardGesture();
		event.preventDefault();
		const el = event.currentTarget as Element;
		el.setPointerCapture(event.pointerId);
		const startX = event.clientX;
		const startY = event.clientY;
		const startOff: [number, number] = [curOff[0], curOff[1]];
		let latest: [number, number] = [...startOff];
		const onMove = (ev: Event) => {
			const pe = ev as PointerEvent;
			if (pe.pointerId !== event.pointerId) return;
			const dx = pe.clientX - startX;
			const dy = pe.clientY - startY;
			latest = [
				snapAlignOffset(startOff[0] + dx / scaleX, pe.shiftKey),
				snapAlignOffset(startOff[1] - dy / scaleY, pe.shiftKey)
			];
			liveOff = latest;
			previewNow(latest, curRot);
		};
		const cleanup = () => {
			el.removeEventListener('pointermove', onMove);
			el.removeEventListener('pointerup', onUp);
			el.removeEventListener('pointercancel', onCancel);
			el.removeEventListener('lostpointercapture', onCancel);
			window.removeEventListener('blur', onCancel);
			cancelDrag = null;
		};
		const onUp = (ev: Event) => {
			if ((ev as PointerEvent).pointerId !== event.pointerId) return;
			cleanup();
			commitNow(latest, curRot);
		};
		const onCancel = () => discardGesture();
		cancelDrag = cleanup;
		el.addEventListener('pointermove', onMove);
		el.addEventListener('pointerup', onUp);
		el.addEventListener('pointercancel', onCancel);
		el.addEventListener('lostpointercapture', onCancel);
		window.addEventListener('blur', onCancel);
	}

	function startAngleDrag(event: PointerEvent): void {
		discardGesture();
		event.preventDefault();
		const el = event.currentTarget as Element;
		el.setPointerCapture(event.pointerId);
		const originClientX = event.clientX - (hx + Math.cos((-curRot * Math.PI) / 180) * 64);
		const originClientY = event.clientY - (hy + Math.sin((-curRot * Math.PI) / 180) * 64);
		let latest = curRot;
		const onMove = (ev: Event) => {
			const pe = ev as PointerEvent;
			if (pe.pointerId !== event.pointerId) return;
			const px = pe.clientX - originClientX;
			const py = pe.clientY - originClientY;
			const rawDeg = (-Math.atan2(py - hy, px - hx) * 180) / Math.PI;
			latest = snapAlignAngle(rawDeg, pe.altKey);
			liveRot = latest;
			previewNow(curOff, latest);
		};
		const cleanup = () => {
			el.removeEventListener('pointermove', onMove);
			el.removeEventListener('pointerup', onUp);
			el.removeEventListener('pointercancel', onCancel);
			el.removeEventListener('lostpointercapture', onCancel);
			window.removeEventListener('blur', onCancel);
			cancelDrag = null;
		};
		const onUp = (ev: Event) => {
			if ((ev as PointerEvent).pointerId !== event.pointerId) return;
			cleanup();
			commitNow(curOff, latest);
		};
		const onCancel = () => discardGesture();
		cancelDrag = cleanup;
		el.addEventListener('pointermove', onMove);
		el.addEventListener('pointerup', onUp);
		el.addEventListener('pointercancel', onCancel);
		el.addEventListener('lostpointercapture', onCancel);
		window.addEventListener('blur', onCancel);
	}

	function onOffsetKeydown(event: KeyboardEvent): void {
		const next = nudgeAlignOffset(curOff, event.key, event.shiftKey);
		if (next === null) return;
		event.preventDefault();
		event.stopPropagation();
		liveOff = next;
		keyDirty = 'offset';
		previewNow(next, curRot);
	}

	function onOffsetKeyup(event: KeyboardEvent): void {
		if (keyDirty !== 'offset' || nudgeAlignOffset(curOff, event.key, event.shiftKey) === null) return;
		commitNow(curOff, curRot);
	}

	function onAngleKeydown(event: KeyboardEvent): void {
		const next = nudgeAlignAngle(curRot, event.key);
		if (next === null) return;
		event.preventDefault();
		event.stopPropagation();
		liveRot = next;
		keyDirty = 'angle';
		previewNow(curOff, next);
	}

	function onAngleKeyup(event: KeyboardEvent): void {
		if (keyDirty !== 'angle' || nudgeAlignAngle(curRot, event.key) === null) return;
		commitNow(curOff, curRot);
	}

	function resetAlign(): void {
		discardGesture();
		const edits = alignResetEdits(source, recipes);
		if (edits.length > 0) void onCommit(edits);
	}

	const patternTransform = $derived(`translate(${x0 + curOff[0] * scaleX} ${y1 - curOff[1] * scaleY}) rotate(${-curRot})`);
</script>

<div
	class="align-shell"
	data-finish-align={align.surface}
	aria-label={align.surface === 'floor' ? 'Align on floor' : 'Align on wall'}
>
	<div class="al-bar" data-align-bar>
		<strong>{align.surface === 'floor' ? 'Align on floor' : 'Align on wall'}</strong>
		<span class="al-meta">{align.place} · {align.widthMeters.toFixed(1)} × {align.heightMeters.toFixed(1)} m · straight on</span>
		<span class="al-read mono" data-align-readout>
			offset {displayOx.toFixed(2)} → · {displayOy.toFixed(2)} ↑ m · {curRot.toFixed(0)}° · repeat {tile.toFixed(2)} m
		</span>
		<button
			type="button"
			class="al-btn ghost"
			title="No offset, no turn — one undo"
			data-align-reset
			onclick={resetAlign}
		>Reset</button>
		<button
			type="button"
			class="al-btn pri"
			title="Back to the room view (Esc)"
			data-align-put-back
			onclick={() => { discardGesture(); onPutBack(); }}
		>Put back</button>
	</div>
	{#if refusal}<div role="status" class="al-refusal">{refusal}</div>{/if}

	<div class="al-clip">
		<svg
			class="al-svg"
			style={`width:${surfaceRect.boxW}px;height:${surfaceRect.boxH}px`}
			width={surfaceRect.boxW}
		height={surfaceRect.boxH}
		viewBox={`0 0 ${surfaceRect.boxW} ${surfaceRect.boxH}`}
		role="img"
		aria-label={`${align.place} faced straight on, ${align.widthMeters.toFixed(1)} by ${align.heightMeters.toFixed(1)} metres`}
	>
		<defs>
			<pattern
				id="stage-align-grid"
				patternUnits="userSpaceOnUse"
				x="0"
				y="0"
				width={tilePxX}
				height={tilePxY}
				patternTransform={patternTransform}
			>
				<path
					d={`M0 0.7h${Math.max(1, tilePxX - 0.7)}v${tilePxY}`}
					fill="none"
					stroke="#ffffff"
					stroke-width="1.4"
					stroke-dasharray="5 4"
					opacity="0.9"
				/>
			</pattern>
			<clipPath id="stage-align-clip">
				<rect x={x0} y={y0} width={rectW} height={rectH} />
			</clipPath>
			<!-- Ivory surround masks everything outside the faced surface so the surface reads alone -->
			<mask id="stage-align-surround-mask">
				<rect x="0" y="0" width={boxW} height={boxH} fill="#ffffff" />
				<rect x={x0} y={y0} width={rectW} height={rectH} fill="#000000" />
			</mask>
		</defs>

		<!-- Surround mask over live Stage -->
		<rect
			x="0"
			y="0"
			width={boxW}
			height={boxH}
			fill="var(--shell-ivory)"
			mask="url(#stage-align-surround-mask)"
		/>

		<!-- Dashed repeat grid over the live surface -->
		<rect
			x={x0}
			y={y0}
			width={rectW}
			height={rectH}
			fill="url(#stage-align-grid)"
			clip-path="url(#stage-align-clip)"
			pointer-events="none"
		/>
		<rect
			x={x0}
			y={y0}
			width={rectW}
			height={rectH}
			fill="none"
			stroke="rgb(18 38 29 / 0.55)"
			stroke-width="1.5"
			pointer-events="none"
		/>

		<!-- Rulers: 0.1 m ticks, metre labels -->
		<g class="al-ruler" pointer-events="none">
			{#each xTicks as t (t.x)}
				<line x1={t.x} x2={t.x} y1={y1 + 4} y2={y1 + (t.major ? 14 : 8)} />
				{#if t.major}
					<text x={t.x} y={y1 + 27} text-anchor="middle">{t.label}</text>
				{/if}
			{/each}
			{#each yTicks as t (t.y)}
				<line x1={x0 - 4} x2={x0 - (t.major ? 14 : 8)} y1={t.y} y2={t.y} />
				{#if t.major}
					<text x={x0 - 18} y={t.y + 4} text-anchor="end">{t.label}</text>
				{/if}
			{/each}
		</g>

		<!-- Offset (square) and rotation (round) handles -->
		<g class="al-handles">
			<line class="arm" x1={hx} y1={hy} x2={rx} y2={ry} />
			<rect
				class="hsq"
				x={hx - 8}
				y={hy - 8}
				width="16"
				height="16"
				rx="3"
				tabindex="0"
				role="slider"
				aria-label="Move the pattern (offset)"
				aria-valuenow={Number(displayOx.toFixed(2))}
				data-align-handle-offset
				onpointerdown={startOffsetDrag}
				onkeydown={onOffsetKeydown}
				onkeyup={onOffsetKeyup}
				onblur={discardGesture}
			/>
			<circle
				class="hrot"
				cx={rx}
				cy={ry}
				r="8"
				tabindex="0"
				role="slider"
				aria-label="Turn the pattern"
				aria-valuenow={Math.round(curRot)}
				data-align-handle-angle
				onpointerdown={startAngleDrag}
				onkeydown={onAngleKeydown}
				onkeyup={onAngleKeyup}
				onblur={discardGesture}
			/>
			</g>
		</svg>
	</div>

	<div class="al-frame" aria-hidden="true"></div>

	<div class="al-note" data-align-note>
		Drag the square to move the pattern (1 cm snap, Shift for 1 mm) · drag the round handle to turn it (15° steps, Alt for any angle) · arrows nudge. Ruler, grid and handles are never saved.
	</div>
</div>

<style>
	.align-shell {
		position: absolute;
		z-index: 42;
		inset: 0;
		pointer-events: none;
	}
	/* The shell's chrome is clipped to the same Stage region as the SVG. */
	.al-frame {
		position: absolute;
		z-index: 2;
		top: 10px;
		left: calc(var(--library-index-cover, var(--index-cover, 0px)) + 10px);
		right: calc(var(--card-cover, 298px) + 10px);
		bottom: calc(var(--lower-column-height, 92px) + 14px);
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 14px;
		box-shadow: var(--shell-shadow);
		pointer-events: none;
	}
	.al-bar {
		position: absolute;
		z-index: 3;
		top: 10px;
		left: calc(var(--library-index-cover, var(--index-cover, 0px)) + 10px);
		right: calc(var(--card-cover, 298px) + 10px);
		min-height: 41px;
		border-radius: 14px 14px 0 0;
		border: 1px solid var(--shell-hairline-strong);
		border-bottom: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		background: var(--shell-field);
		border-bottom: 1px solid var(--shell-hairline);
		font-size: 12px;
		color: var(--shell-ink);
		pointer-events: auto;
	}
	.al-meta { color: var(--shell-ink-2); }
	.al-refusal {
		padding: 6px 12px;
		background: var(--shell-caution-bg);
		color: var(--shell-caution);
		font-size: 12px;
	}
	.al-read {
		margin-left: auto;
		font-size: 11px;
		color: var(--shell-ink-2);
	}
	.mono { font-family: var(--shell-mono); }
	.al-btn {
		flex: 0 0 auto;
		white-space: nowrap;
		height: 26px;
		padding: 0 10px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 7px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font: inherit;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}
	.al-btn.ghost { background: transparent; }
	.al-btn.pri {
		background: var(--shell-action);
		border-color: var(--shell-action);
		color: var(--shell-on-action);
	}
	/* Full-Stage SVG in its own Stage coordinates, clipped by an HTML box to the
	   Index/Card/tray-free region; the overlay never reads layout. */
	.al-clip {
		position: absolute;
		z-index: 1;
		top: 10px;
		left: calc(var(--library-index-cover, var(--index-cover, 0px)) + 10px);
		right: calc(var(--card-cover, 298px) + 10px);
		bottom: calc(var(--lower-column-height, 92px) + 14px);
		overflow: hidden;
		pointer-events: none;
	}
	.al-svg {
		position: absolute;
		top: -10px;
		left: calc(-1 * (var(--library-index-cover, var(--index-cover, 0px)) + 10px));
		display: block;
		pointer-events: none;
	}
	.al-ruler line { stroke: var(--shell-ink-2); stroke-width: 1; }
	.al-ruler text {
		fill: var(--shell-ink-2);
		font-family: var(--shell-mono);
		font-size: 10px;
	}
	.arm {
		stroke: var(--shell-action);
		stroke-width: 1.8;
		stroke-dasharray: 4 3;
		pointer-events: none;
	}
	.hsq,
	.hrot {
		fill: var(--shell-field);
		stroke: var(--shell-action);
		stroke-width: 2;
		cursor: grab;
		pointer-events: auto;
	}
	.hsq:focus-visible,
	.hrot:focus-visible {
		outline: 2px solid var(--stage-proposal);
		outline-offset: 2px;
	}
	.al-note {
		position: absolute;
		z-index: 3;
		bottom: calc(var(--lower-column-height, 92px) + 14px);
		left: calc(var(--library-index-cover, var(--index-cover, 0px)) + 10px);
		right: calc(var(--card-cover, 298px) + 10px);
		border-radius: 0 0 14px 14px;
		min-height: 46px;
		display: flex;
		align-items: center;
		padding: 6px 12px;
		background: var(--shell-field);
		border-top: 1px solid var(--shell-hairline);
		font-size: 11px;
		color: var(--shell-ink-2);
		pointer-events: auto;
	}
	@media (pointer: coarse) {
		.al-btn { min-height: var(--shell-touch-target); }
	}
</style>
