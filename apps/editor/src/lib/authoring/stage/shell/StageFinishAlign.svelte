<script lang="ts">
	/**
	 * Align on wall / floor overlay (T2.S8 U6).
	 *
	 * View-only DOM + SVG chrome around the live Stage framed by Camera (`face`
	 * or Plan + `fit`). Every mark is placed from the renderer's own sampling:
	 * a surface point's native uv goes through
	 *   t = diag(repeat) · R(−θ) · (uv − ½) + ½ + offset
	 * (`align-chart.ts`), so tile boundaries are drawn where `t_x` or `t_y` is an
	 * integer and projected through the live Camera, never as a screen pattern.
	 * Dragging or nudging previews through the Card adapter; pointerup / keyup
	 * commits once (C12). Nothing here is serialized.
	 */
	import { onDestroy, onMount } from 'svelte';
	import {
		alignArrowDirection,
		alignArrowTurn,
		alignPlacementEdits,
		alignResetEdits,
		alignSetMapping,
		type ActiveFinishAlign
	} from '$lib/authoring/look/finish-align.svelte';
	import {
		chartToWorld,
		dragOffset,
		handleLattice,
		handleMetersOf,
		offsetPlacing,
		samplingOf,
		screenToUvDelta,
		tileGridLines,
		tileToUv,
		turnAbout,
		turnBy,
		type AlignJacobian,
		type AlignSampling,
		type Vec2
	} from '$lib/authoring/look/align-chart';
	import type { FinishPatchEdit, FinishSource } from '@portfolio/project-model/scene-planning';
	import type { Recipe } from '@portfolio/project-model/materials';

	type Project = (point: readonly [number, number, number]) => readonly [number, number] | null;
	type Placement = { readonly rotation: number; readonly offset: readonly [number, number] };

	let {
		align,
		refusal = null,
		project = null,
		source,
		recipes,
		onMaterialPreview,
		onCancelPreview,
		onCommit,
		onPutBack,
		viewportWidth = 856,
		viewportHeight = 608
	}: {
		align: ActiveFinishAlign;
		refusal?: string | null;
		/** World → Stage-local CSS px through the live Camera; null while unavailable. */
		project?: Project | null;
		source: FinishSource;
		recipes: ReadonlyMap<string, Recipe>;
		onMaterialPreview: (edits: readonly FinishPatchEdit[]) => void;
		onCancelPreview: () => void;
		onCommit: (edits: readonly FinishPatchEdit[]) => Promise<boolean> | void;
		onPutBack: () => void;
		viewportWidth?: number;
		viewportHeight?: number;
	} = $props();

	let live = $state.raw<Placement | null>(null);
	/** The lattice point held under the square handle for the current gesture. */
	let heldK = $state.raw<readonly [number, number] | null>(null);
	let keyDirty = $state<'offset' | 'angle' | null>(null);
	let cancelDrag: (() => void) | null = null;

	function discardGesture(): void {
		cancelDrag?.();
		cancelDrag = null;
		live = null;
		heldK = null;
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

	const chart = $derived(align.chart);
	const setMap = $derived(alignSetMapping(source, recipes));
	/** The colour image follows its own mapping: the grid could not describe what the creator sees. */
	const separate = $derived(setMap.separateRoles.includes('color'));
	const accepted = $derived<AlignSampling>(samplingOf(setMap.mapping, chart.uvMeters));
	const sampling = $derived<AlignSampling>(
		live === null ? accepted : { ...accepted, rotation: live.rotation, offset: live.offset }
	);

	function projectUv(uv: Vec2): readonly [number, number] | null {
		return project === null ? null : project(chartToWorld(chart, uv));
	}

	const cornersUv = $derived<readonly Vec2[]>([
		[chart.uMin, chart.vMin],
		[chart.uMax, chart.vMin],
		[chart.uMax, chart.vMax],
		[chart.uMin, chart.vMax]
	]);
	const cornersPx = $derived.by(() => {
		if (project === null) return null;
		const out: (readonly [number, number])[] = [];
		for (const uv of cornersUv) {
			const p = projectUv(uv);
			if (p === null || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
			out.push(p);
		}
		return out;
	});
	const available = $derived(cornersPx !== null && !separate);

	/** The corner that reads as bottom-left on screen (largest y − x), and its two edges. */
	const frame = $derived.by(() => {
		const px = cornersPx;
		if (px === null) return null;
		let b = 0;
		for (let i = 1; i < 4; i += 1) if (px[i]![1] - px[i]![0] > px[b]![1] - px[b]![0]) b = i;
		const n1 = (b + 1) % 4;
		const n3 = (b + 3) % 4;
		const horizontalness = (i: number) => Math.abs(px[i]![0] - px[b]![0]) - Math.abs(px[i]![1] - px[b]![1]);
		const bottom = horizontalness(n1) >= horizontalness(n3) ? n1 : n3;
		const left = bottom === n1 ? n3 : n1;
		return { b, bottom, left };
	});

	const jacobianAt = (uv: Vec2): AlignJacobian | null => {
		const p0 = projectUv(uv);
		const pu = projectUv([uv[0] + 1, uv[1]]);
		const pv = projectUv([uv[0], uv[1] + 1]);
		if (p0 === null || pu === null || pv === null) return null;
		return { du: [pu[0] - p0[0], pu[1] - p0[1]], dv: [pv[0] - p0[0], pv[1] - p0[1]] };
	};

	const handle = $derived.by(() => {
		const f = frame;
		if (f === null) return null;
		if (heldK !== null) return { k: heldK, uv: tileToUv(heldK, sampling) };
		return handleLattice(chart, sampling, cornersUv[f.b]!);
	});
	const handlePx = $derived(handle === null ? null : projectUv(handle.uv));
	const jacobian = $derived(handle === null ? null : jacobianAt(handle.uv));
	/** +1 when a positive uv rotation turns counter-clockwise as seen (screen y grows down). */
	const ccwSign = $derived(jacobian === null ? 1 : jacobian.du[0] * jacobian.dv[1] - jacobian.dv[0] * jacobian.du[1] < 0 ? 1 : -1);

	const arm = $derived.by(() => {
		if (handlePx === null || jacobian === null) return null;
		const c = Math.cos(sampling.rotation);
		const n = Math.sin(sampling.rotation);
		const dx = jacobian.du[0] * c + jacobian.dv[0] * n;
		const dy = jacobian.du[1] * c + jacobian.dv[1] * n;
		const pxPerMetre = Math.hypot(dx, dy);
		if (!(pxPerMetre > 0)) return null;
		const length = Math.min(Math.max(pxPerMetre * sampling.tileMeters[0] * 0.9, 56), 120);
		return { x: handlePx[0] + (dx / pxPerMetre) * length, y: handlePx[1] + (dy / pxPerMetre) * length };
	});

	const gridPaths = $derived.by(() => {
		if (!available) return '';
		const lines = tileGridLines(chart, sampling);
		if (lines === null) return '';
		let d = '';
		for (const line of lines) {
			const a = projectUv(line.from);
			const b = projectUv(line.to);
			if (a === null || b === null) continue;
			d += `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
		}
		return d;
	});

	const surfacePolygon = $derived(cornersPx === null ? '' : cornersPx.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
	const surroundPath = $derived(
		cornersPx === null
			? ''
			: `M0 0H${boxW}V${boxH}H0Z M${cornersPx.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')}Z`
	);

	type Tick = { x1: number; y1: number; x2: number; y2: number; label: string | null; lx: number; ly: number };
	/** 0.1 m ticks along an edge from the bottom-left corner, labelled each metre, pushed outward by `out`. */
	function edgeTicks(from: number, to: number, out: readonly [number, number], labelSuffix: string): Tick[] {
		const px = cornersPx;
		if (px === null) return [];
		const a = cornersUv[from]!;
		const b = cornersUv[to]!;
		const metres = Math.hypot((b[0] - a[0]) * chart.uvMeters[0], (b[1] - a[1]) * chart.uvMeters[1]);
		if (!(metres > 0) || metres / 0.1 > 400) return [];
		const pa = px[from]!;
		const pb = px[to]!;
		const ticks: Tick[] = [];
		for (let i = 0; i * 0.1 <= metres + 1e-6; i += 1) {
			const f = (i * 0.1) / metres;
			const x = pa[0] + (pb[0] - pa[0]) * f;
			const y = pa[1] + (pb[1] - pa[1]) * f;
			const major = i % 10 === 0;
			const len = major ? 14 : 8;
			ticks.push({
				x1: x + out[0] * 4,
				y1: y + out[1] * 4,
				x2: x + out[0] * len,
				y2: y + out[1] * len,
				label: major ? `${i / 10}${labelSuffix}` : null,
				lx: x + out[0] * (out[1] !== 0 ? 27 : 18),
				ly: y + out[1] * 27 + (out[0] !== 0 ? 4 : 0)
			});
		}
		return ticks;
	}
	const xTicks = $derived(frame === null ? [] : edgeTicks(frame.b, frame.bottom, [0, 1], ' m'));
	const yTicks = $derived(frame === null ? [] : edgeTicks(frame.b, frame.left, [-1, 0], ''));

	const readOff = $derived<[number, number]>(
		frame === null || handle === null
			? [0, 0]
			: handleMetersOf(
					handle.uv,
					{ origin: cornersUv[frame.b]!, right: cornersUv[frame.bottom]!, up: cornersUv[frame.left]! },
					chart.uvMeters,
					sampling.tileMeters
				)
	);
	const readDeg = $derived(Math.round(((((sampling.rotation * ccwSign * 180) / Math.PI) % 360) + 360) % 360) % 360);
	const repeatLabel = $derived(
		Math.abs(sampling.tileMeters[0] - sampling.tileMeters[1]) < 1e-6
			? `${sampling.tileMeters[0].toFixed(2)} m`
			: `${sampling.tileMeters[0].toFixed(2)} × ${sampling.tileMeters[1].toFixed(2)} m`
	);

	function previewNow(next: Placement): void {
		live = next;
		const edits = alignPlacementEdits(source, recipes, next.rotation, next.offset);
		if (edits.length === 0) onCancelPreview();
		else onMaterialPreview(edits);
	}

	function commitNow(next: Placement): void {
		live = null;
		heldK = null;
		keyDirty = null;
		onCancelPreview();
		const edits = alignPlacementEdits(source, recipes, next.rotation, next.offset);
		if (edits.length > 0) void onCommit(edits);
	}

	function trackPointer(
		event: PointerEvent,
		onMove: (pe: PointerEvent) => void,
		onUp: () => void
	): void {
		const el = event.currentTarget as Element;
		el.setPointerCapture?.(event.pointerId);
		const move = (ev: Event) => {
			const pe = ev as PointerEvent;
			if (pe.pointerId !== event.pointerId) return;
			onMove(pe);
		};
		const cleanup = () => {
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerup', up);
			el.removeEventListener('pointercancel', cancel);
			el.removeEventListener('lostpointercapture', cancel);
			window.removeEventListener('blur', cancel);
			cancelDrag = null;
		};
		const up = (ev: Event) => {
			if ((ev as PointerEvent).pointerId !== event.pointerId) return;
			cleanup();
			onUp();
		};
		const cancel = () => discardGesture();
		cancelDrag = cleanup;
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', cancel);
		el.addEventListener('lostpointercapture', cancel);
		window.addEventListener('blur', cancel);
	}

	function startOffsetDrag(event: PointerEvent): void {
		discardGesture();
		if (!available || handle === null || jacobian === null) return;
		event.preventDefault();
		// preventDefault stops the browser focusing the handle; focus it so its arrow keys reach it.
		(event.currentTarget as SVGElement | null)?.focus?.();
		const start = { ...sampling };
		const k = handle.k;
		const startUv = handle.uv;
		const jac = jacobian;
		const x0 = event.clientX;
		const y0 = event.clientY;
		heldK = k;
		let latest: Placement = { rotation: start.rotation, offset: start.offset };
		trackPointer(
			event,
			(pe) => {
				const delta = screenToUvDelta(jac, [pe.clientX - x0, pe.clientY - y0]);
				if (delta === null) return;
				latest = { rotation: start.rotation, offset: dragOffset(start, k, startUv, delta, pe.shiftKey) };
				previewNow(latest);
			},
			() => commitNow(latest)
		);
	}

	function startAngleDrag(event: PointerEvent): void {
		discardGesture();
		if (!available || handle === null || jacobian === null || handlePx === null || arm === null) return;
		event.preventDefault();
		(event.currentTarget as SVGElement | null)?.focus?.();
		const start = { ...sampling };
		const k = handle.k;
		const pivotUv = handle.uv;
		const pivotPx = handlePx;
		const jac = jacobian;
		// Stage-local pointer = the round handle's position + the client delta (no DOM read).
		const origin: [number, number] = [arm.x - event.clientX, arm.y - event.clientY];
		heldK = k;
		let latest: Placement = { rotation: start.rotation, offset: start.offset };
		trackPointer(
			event,
			(pe) => {
				const px = origin[0] + pe.clientX - pivotPx[0];
				const py = origin[1] + pe.clientY - pivotPx[1];
				const dir = screenToUvDelta(jac, [px, py]);
				if (dir === null || Math.hypot(dir[0], dir[1]) < 1e-9) return;
				latest = turnAbout(start, k, pivotUv, dir, pe.altKey);
				previewNow(latest);
			},
			() => commitNow(latest)
		);
	}

	function onOffsetKeydown(event: KeyboardEvent): void {
		const dir = alignArrowDirection(event.key);
		if (dir === null || !available || handle === null || jacobian === null) return;
		event.preventDefault();
		event.stopPropagation();
		const uvDir = screenToUvDelta(jacobian, dir);
		if (uvDir === null) return;
		const length = Math.hypot(uvDir[0] * chart.uvMeters[0], uvDir[1] * chart.uvMeters[1]);
		if (!(length > 0)) return;
		const step = event.shiftKey ? 0.1 : 0.01;
		const k = handle.k;
		heldK = k;
		const target: Vec2 = [handle.uv[0] + (uvDir[0] / length) * step, handle.uv[1] + (uvDir[1] / length) * step];
		const raw = offsetPlacing(k, target, sampling, sampling.rotation);
		keyDirty = 'offset';
		previewNow({ rotation: sampling.rotation, offset: [((raw[0] % 1) + 1) % 1, ((raw[1] % 1) + 1) % 1] });
	}

	function onAngleKeydown(event: KeyboardEvent): void {
		const turn = alignArrowTurn(event.key);
		if (turn === null || !available || handle === null) return;
		event.preventDefault();
		event.stopPropagation();
		heldK = handle.k;
		keyDirty = 'angle';
		previewNow(turnBy(sampling, handle.k, handle.uv, (turn * ccwSign * Math.PI) / 12));
	}

	function onKeyup(kind: 'offset' | 'angle', event: KeyboardEvent): void {
		const isArrow = kind === 'offset' ? alignArrowDirection(event.key) !== null : alignArrowTurn(event.key) !== null;
		if (keyDirty !== kind || !isArrow || live === null) return;
		commitNow(live);
	}

	function resetAlign(): void {
		discardGesture();
		const edits = alignResetEdits(source, recipes);
		if (edits.length > 0) void onCommit(edits);
	}

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
			offset {readOff[0].toFixed(2)} → · {readOff[1].toFixed(2)} ↑ m · {readDeg}° · repeat {repeatLabel}
		</span>
		<button
			type="button"
			class="al-btn ghost"
			title="No offset, no turn — one undo"
			data-align-reset
			disabled={separate}
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
		{#if available && cornersPx !== null}
			<svg
				class="al-svg"
				style={`width:${boxW}px;height:${boxH}px`}
				width={boxW}
				height={boxH}
				viewBox={`0 0 ${boxW} ${boxH}`}
				role="img"
				aria-label={`${align.place} faced straight on, ${align.widthMeters.toFixed(1)} by ${align.heightMeters.toFixed(1)} metres`}
			>
				<defs>
					<clipPath id="stage-align-clip">
						<polygon points={surfacePolygon} />
					</clipPath>
				</defs>

				<!-- Ivory surround over the live Stage, with the faced surface cut out -->
				<path d={surroundPath} fill="var(--shell-ivory)" fill-rule="evenodd" data-align-surround />

				<!-- Dashed tile boundaries (t_x ∈ ℤ, t_y ∈ ℤ), projected -->
				<path
					d={gridPaths}
					fill="none"
					stroke="#ffffff"
					stroke-width="1.4"
					stroke-dasharray="5 4"
					opacity="0.9"
					clip-path="url(#stage-align-clip)"
					pointer-events="none"
					data-align-grid
				/>
				<polygon points={surfacePolygon} fill="none" stroke="rgb(18 38 29 / 0.55)" stroke-width="1.5" pointer-events="none" />

				<!-- Rulers: 0.1 m ticks, metre labels, from the bottom-left corner as seen -->
				<g class="al-ruler" pointer-events="none">
					{#each xTicks as t, i (i)}
						<line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
						{#if t.label !== null}<text x={t.lx} y={t.ly} text-anchor="middle">{t.label}</text>{/if}
					{/each}
					{#each yTicks as t, i (i)}
						<line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
						{#if t.label !== null}<text x={t.lx} y={t.ly} text-anchor="end">{t.label}</text>{/if}
					{/each}
				</g>

				<!-- Offset (square, on a tile corner) and rotation (round) handles -->
				{#if handlePx !== null && arm !== null}
					<g class="al-handles">
						<line class="arm" x1={handlePx[0]} y1={handlePx[1]} x2={arm.x} y2={arm.y} />
						<rect
							class="hsq"
							x={handlePx[0] - 8}
							y={handlePx[1] - 8}
							width="16"
							height="16"
							rx="3"
							tabindex="0"
							role="slider"
							aria-label="Move the pattern (offset)"
							aria-valuenow={Number(readOff[0].toFixed(2))}
							data-align-handle-offset
							onpointerdown={startOffsetDrag}
							onkeydown={onOffsetKeydown}
							onkeyup={(event) => onKeyup('offset', event)}
							onblur={discardGesture}
						/>
						<circle
							class="hrot"
							cx={arm.x}
							cy={arm.y}
							r="8"
							tabindex="0"
							role="slider"
							aria-label="Turn the pattern"
							aria-valuenow={readDeg}
							data-align-handle-angle
							onpointerdown={startAngleDrag}
							onkeydown={onAngleKeydown}
							onkeyup={(event) => onKeyup('angle', event)}
							onblur={discardGesture}
						/>
					</g>
				{/if}
			</svg>
		{:else}
			<div class="al-waiting" role="status" data-align-unavailable>
				{separate
					? 'This Finish maps its colour image on its own · use the Material editor’s Pattern fields.'
					: 'Waiting for the faced view…'}
			</div>
		{/if}
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
	.al-waiting {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: var(--shell-ivory);
		color: var(--shell-ink-2);
		font-size: 12px;
		padding: 0 24px;
		text-align: center;
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
