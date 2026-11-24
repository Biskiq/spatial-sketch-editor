<script lang="ts">
	/**
	 * Interactive material preview (T2.S8 U5 / U6): the one active E7 inspection.
	 *
	 * Used by Library detail (compact controls) and the Material editor (full
	 * Shape/Light/Turn/View/Probe/Split-Compare controls). Always holds at most
	 * one live E7 request: Split Compare renders the original frame first for the
	 * current view key, then observes the live subject and composites left/right
	 * halves with a 2 px white divider.
	 */
	import { tryUseFinishTiles } from '$lib/authoring/look/finish-tiles-context';
	import FinishTile from '$lib/authoring/look/FinishTile.svelte';
	import type { EditorDisplayMode } from '$lib/authoring/look/finish-editor.svelte';
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import type {
		InspectionDisplay,
		InspectionLightingMode,
		InspectionState
	} from '$lib/render/materials/inspection-host';
	type InspectionFrame = NonNullable<Extract<InspectionState, { readonly status: 'ready' }>['frame']>;
	import { inspectionSubjectIdentity, type InspectionSubject } from '$lib/render/materials/inspection-subject';
	import type { WorldLightSample } from '$lib/render/materials/inspection-world';
	import {
		LIBRARY_INSPECTION_DEFAULT,
		type LibraryInspectionGeometry,
		type LibraryInspectionLighting,
		type LibraryInspectionSettings
	} from './library-inspection';

	let {
		source,
		originalSource = null,
		color,
		imageUri = null,
		label,
		world = null,
		worldReason = 'Place it to see it in this room',
		caption = null,
		materialKey = null,
		settings = LIBRARY_INSPECTION_DEFAULT,
		onSettings = () => {},
		display = 'lit',
		onDisplay,
		lightTurnRadians = 0,
		onTurnLight,
		compare = false,
		probe = false,
		sampleWindowMeters = 1.4,
		showEditorControls = false
	}: {
		source: FinishTileSource | null;
		/** Original (base) subject for split Compare; null disables Compare. */
		originalSource?: FinishTileSource | null;
		color: string;
		imageUri?: string | null;
		label: string;
		/** A World light sample at a qualified anchor; null keeps This World unavailable. */
		world?: WorldLightSample | null;
		worldReason?: string;
		/** Single-frame caption when not in split Compare. */
		caption?: string | null;
		materialKey?: string | null;
		settings?: LibraryInspectionSettings;
		onSettings?: (next: LibraryInspectionSettings) => void;
		display?: EditorDisplayMode;
		onDisplay?: (next: EditorDisplayMode) => void;
		lightTurnRadians?: number;
		onTurnLight?: () => void;
		compare?: boolean;
		probe?: boolean;
		sampleWindowMeters?: number;
		showEditorControls?: boolean;
	} = $props();

	const tiles = tryUseFinishTiles();
	const SIZE = 480;

	const VIEW_OPTIONS: readonly (readonly [EditorDisplayMode, string])[] = [
		['lit', 'Lit'],
		['unlit-color', 'Colour'],
		['normal', 'Relief'],
		['roughness', 'Roughness'],
		['metalness', 'Metal'],
		['occlusion', 'Occlusion']
	];

	// Seeded from the session once; written back on every change.
	// svelte-ignore state_referenced_locally
	let geometry = $state<LibraryInspectionGeometry>(settings.geometry);
	// svelte-ignore state_referenced_locally
	let lighting = $state<LibraryInspectionLighting>(settings.lighting);
	let canvas = $state<HTMLCanvasElement>();
	let shownKey = $state<string | null>(null);
	let refused = $state.raw<{ readonly key: string; readonly code: string } | null>(null);
	let partial = $state(false);
	let pending = $state(false);
	let shownCaption = $state<string | null>(null);
	let probeText = $state('hover to probe');

	/** Cached original frame for split Compare, keyed to view parameters. */
	let origCache = $state.raw<{ readonly viewKey: string; readonly frame: InspectionFrame } | null>(null);
	let splitReadyKey = $state<string | null>(null);

	function toSubject(s: FinishTileSource | null): InspectionSubject | null {
		if (s === null) return null;
		return s.kind === 'catalogue' ? { kind: 'catalogue', id: s.id } : s.subject;
	}

	function toInspectionDisplay(mode: EditorDisplayMode): InspectionDisplay {
		if (mode === 'lit' || mode === 'unlit-color') return mode;
		return { solo: mode };
	}

	const subject = $derived(toSubject(source));
	const origSubject = $derived(toSubject(originalSource));
	const key = $derived(materialKey ?? (subject === null ? null : inspectionSubjectIdentity(subject)));
	const live = $derived(tiles !== null && subject !== null);

	const compareActive = $derived(compare && origSubject !== null && subject !== null);
	const viewKey = $derived(
		`${geometry}|${lighting}|${lightTurnRadians}|${display}|${SIZE}|${origSubject ? inspectionSubjectIdentity(origSubject) : ''}`
	);
	const needsOrigFrame = $derived(compareActive && origCache?.viewKey !== viewKey);

	function choose(next: Partial<LibraryInspectionSettings>): void {
		if (next.geometry !== undefined) geometry = next.geometry;
		if (next.lighting !== undefined) lighting = next.lighting;
		onSettings({ geometry, lighting });
	}

	// World falls back to Studio the moment its anchor stops qualifying.
	$effect(() => {
		if (lighting === 'world' && world === null) lighting = 'studio';
	});

	function paintSingle(frame: InspectionFrame): void {
		const context = canvas?.getContext('2d') ?? null;
		if (canvas === undefined || context === null) return;
		canvas.width = frame.width;
		canvas.height = frame.height;
		context.putImageData(new ImageData(new Uint8ClampedArray(frame.pixels), frame.width, frame.height), 0, 0);
	}

	function paintSplit(origFrame: InspectionFrame, liveFrame: InspectionFrame): void {
		const context = canvas?.getContext('2d') ?? null;
		if (canvas === undefined || context === null) return;
		const w = liveFrame.width;
		const h = liveFrame.height;
		canvas.width = w;
		canvas.height = h;
		const half = Math.floor(w / 2);
		const composite = new Uint8ClampedArray(liveFrame.pixels);
		if (origFrame.width === w && origFrame.height === h) {
			for (let row = 0; row < h; row += 1) {
				const rowStart = row * w * 4;
				composite.set(origFrame.pixels.subarray(rowStart, rowStart + half * 4), rowStart);
			}
		}
		context.putImageData(new ImageData(composite, w, h), 0, 0);
		context.fillStyle = '#ffffff';
		context.fillRect(half - 1, 0, 2, h);
	}

	$effect(() => {
		const current = needsOrigFrame ? origSubject : subject;
		const material = key;
		const mode: InspectionLightingMode =
			lighting === 'world' && world !== null
				? { world }
				: lighting === 'grazing'
					? 'library-grazing'
					: 'library-studio';
		const shape = geometry;
		const disp = toInspectionDisplay(display);
		const turn = lightTurnRadians;
		const cap = caption;
		const currentViewKey = viewKey;
		const capturingOrig = needsOrigFrame;
		const isSplit = compareActive;
		const cachedOrig = origCache;
		void tiles?.epoch;
		if (current === null || tiles === null || material === null) return;
		pending = true;
		const stop = tiles.inspect(
			{
				subject: current,
				geometry: shape,
				lighting: mode,
				display: disp,
				sizePx: [SIZE, SIZE],
				...(turn !== 0 ? { lightTurnRadians: turn } : {})
			},
			(next) => {
				if (next.status === 'pending') return;
				pending = false;
				if (next.status === 'refused') {
					refused = { key: material, code: next.issues[0]?.code ?? 'refused' };
					splitReadyKey = null;
					return;
				}
				if (capturingOrig) {
					origCache = { viewKey: currentViewKey, frame: next.frame };
					return;
				}
				if (isSplit && cachedOrig !== null && cachedOrig.viewKey === currentViewKey) {
					paintSplit(cachedOrig.frame, next.frame);
					splitReadyKey = currentViewKey;
				} else {
					paintSingle(next.frame);
					splitReadyKey = null;
				}
				refused = null;
				partial = next.status === 'partial';
				shownKey = material;
				shownCaption = cap;
			}
		);
		return () => stop?.();
	});

	function lin(c: number): number {
		const s = c / 255;
		return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	}

	function onPointerMove(event: PointerEvent): void {
		if (!probe || !holding || canvas === undefined) return;
		const ctx = canvas.getContext('2d');
		if (ctx === null) return;
		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width)));
		const y = Math.min(canvas.height - 1, Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height)));
		const data = ctx.getImageData(x, y, 1, 1).data;
		const hex = `#${[data[0]!, data[1]!, data[2]!].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
		const Y = 0.2126 * lin(data[0]!) + 0.7152 * lin(data[1]!) + 0.0722 * lin(data[2]!);
		const Ls = Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
		const meters =
			geometry === 'plane' ? `  ${(((x / canvas.width) - 0.5) * sampleWindowMeters).toFixed(2)} m` : '';
		probeText = `${hex}  L* ${Ls.toFixed(0)}${meters}`;
	}

	function onPointerLeave(): void {
		probeText = 'hover to probe';
	}

	const showsRefusal = $derived(refused !== null && refused.key === key);
	const isBudgetRefusal = $derived(showsRefusal && refused?.code === 'texture-budget');
	const holding = $derived(live && !showsRefusal && shownKey !== null && shownKey === key);
	const loading = $derived(live && !showsRefusal && !holding);
	const showingSplitLabels = $derived(compareActive && splitReadyKey === viewKey && holding);
	const visibleCaption = $derived(showingSplitLabels ? null : holding ? shownCaption : caption);
	const phase = $derived(
		!live ? 'off' : showsRefusal ? 'refused' : loading ? 'loading' : pending ? 'redrawing' : partial ? 'partial' : 'ready'
	);
	const lightNote = $derived(
		lighting === 'world'
			? 'Approximates this project’s Sky sun.'
			: lighting === 'grazing'
				? 'Low light across the surface: relief and scale errors show first.'
				: 'Even softbox and strip: colour and sheen read.'
	);
	const note = $derived.by((): string | null => {
		if (!live) return 'Live preview needs the Stage renderer; showing the sample tile.';
		if (showsRefusal) {
			if (isBudgetRefusal) return null;
			return refused?.code === 'world-anchor-required'
				? 'Place it to see it in this room'
				: 'This Finish cannot be drawn live here; showing the sample tile.';
		}
		if (holding && partial && !pending) return 'Some images could not load; the rest still read.';
		return null;
	});
</script>

<div
	class="inspect"
	class:editor-mode={showEditorControls}
	data-library-inspect
	data-inspect-lighting-mode={lighting}
	data-inspect-geometry-mode={geometry}
	data-inspect-display-mode={display}
	data-inspect-state={phase}
	aria-busy={loading || pending}
>
	<div class="view" aria-label={`${label} preview`} role="img">
		<canvas
			bind:this={canvas}
			width={SIZE}
			height={SIZE}
			class:hidden={!holding}
			data-inspect-canvas
			onpointermove={onPointerMove}
			onpointerleave={onPointerLeave}
		></canvas>
		{#if !live || showsRefusal}
			<div class="fallback">
				{#if isBudgetRefusal}
					<div class="flat-swatch" style:background={color}></div>
				{:else}
					<FinishTile {source} {color} {imageUri} size={168} />
				{/if}
			</div>
		{:else if loading}
			<div class="loading" data-inspect-loading><span class="dot"></span><span>Rendering preview…</span></div>
		{/if}
		{#if showingSplitLabels}
			<div class="cmp" data-inspect-compare-labels>
				<span>Original</span>
				<span>Now</span>
			</div>
		{:else if visibleCaption !== null}
			<span class="caption" data-inspect-caption>{visibleCaption}</span>
		{/if}
		{#if probe}
			<div class="probe" data-inspect-probe>{probeText}</div>
		{/if}
	</div>

	{#if isBudgetRefusal}
		<p class="note budget" data-inspect-budget>
			Too many large textures open · <button type="button" class="linkb" onclick={() => tiles?.retry()}>Retry</button>
		</p>
	{/if}

	{#if showEditorControls}
		<div class="edrow">
			<span class="el">Shape</span>
			<span class="seg" role="group" aria-label="Shape">
				{#each [['sphere', 'Sphere'], ['plane', 'Flat'], ['block', 'Tile']] as const as [id, text] (id)}
					<button type="button" aria-pressed={geometry === id} data-inspect-geometry={id} onclick={() => choose({ geometry: id })}>{text}</button>
				{/each}
			</span>
		</div>
		<div class="edrow">
			<span class="el">Light</span>
			<span class="seg" role="group" aria-label="Light">
				{#each [['studio', 'Studio'], ['grazing', 'Grazing'], ['world', 'This World']] as const as [id, text] (id)}
					<button
						type="button"
						aria-pressed={lighting === id}
						disabled={id === 'world' && world === null}
						title={id === 'world' && world === null ? worldReason : `${text} light`}
						data-inspect-lighting={id}
						onclick={() => choose({ lighting: id })}
					>{text}</button>
				{/each}
			</span>
			{#if onTurnLight}
				<button type="button" class="stepb" title="Turn the light" aria-label="Turn the light" data-inspect-turn onclick={onTurnLight}>↻</button>
			{/if}
		</div>
		{#if onDisplay}
			<div class="edrow">
				<span class="el">View</span>
				<select
					class="sel"
					aria-label="View"
					data-inspect-view
					value={display}
					onchange={(event) => onDisplay(event.currentTarget.value as EditorDisplayMode)}
				>
					{#each VIEW_OPTIONS as [val, text] (val)}
						<option value={val}>{text}</option>
					{/each}
				</select>
			</div>
		{/if}
		<p class="note" data-inspect-light-note>{lightNote}</p>
	{:else}
		<div class="controls">
			<span class="seg" role="group" aria-label="Preview geometry">
				{#each [['sphere', 'Sphere'], ['plane', 'Flat'], ['block', 'Block']] as const as [id, text] (id)}
					<button type="button" aria-pressed={geometry === id} data-inspect-geometry={id} onclick={() => choose({ geometry: id })}>{text}</button>
				{/each}
			</span>
			<span class="seg" role="group" aria-label="Preview lighting">
				{#each [['studio', 'Studio'], ['grazing', 'Grazing'], ['world', 'This World']] as const as [id, text] (id)}
					<button
						type="button"
						aria-pressed={lighting === id}
						disabled={id === 'world' && world === null}
						title={id === 'world' && world === null ? worldReason : `${text} light`}
						data-inspect-lighting={id}
						onclick={() => choose({ lighting: id })}
					>{text}</button>
				{/each}
			</span>
		</div>
	{/if}
	{#if note !== null}<p class="note" data-inspect-note>{note}</p>{/if}
</div>

<style>
	.inspect { display: grid; gap: 7px; min-width: 0; max-width: 100%; }
	.view {
		position: relative;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		aspect-ratio: 1;
		border-radius: 12px;
		overflow: hidden;
		background: #e2dfd8;
		display: grid;
		place-items: center;
	}
	.view canvas { display: block; width: 100%; height: 100%; grid-area: 1 / 1; }
	.view canvas.hidden { visibility: hidden; }
	.fallback, .loading { grid-area: 1 / 1; width: 100%; height: 100%; }
	.flat-swatch { width: 100%; height: 100%; }
	.fallback :global(.finish-tile), .fallback :global(img) { width: 100%; height: 100%; }
	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: var(--shell-ink-2);
		font-size: 11px;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--shell-ink-3);
		animation: pulse 1s ease-in-out infinite alternate;
	}
	@keyframes pulse { from { opacity: 0.35; } to { opacity: 1; } }
	@media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
	.caption {
		position: absolute;
		left: 8px;
		top: 8px;
		padding: 2px 7px;
		border-radius: 999px;
		background: color-mix(in srgb, #fff 82%, transparent);
		color: var(--shell-ink);
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.02em;
		pointer-events: none;
	}
	.cmp {
		position: absolute;
		inset: 8px 8px auto 8px;
		display: flex;
		justify-content: space-between;
		pointer-events: none;
	}
	.cmp span {
		padding: 2px 7px;
		border-radius: 999px;
		background: color-mix(in srgb, #fff 84%, transparent);
		color: var(--shell-ink);
		font-size: 10.5px;
		font-weight: 600;
	}
	.probe {
		position: absolute;
		left: 8px;
		bottom: 8px;
		padding: 2px 7px;
		border-radius: 6px;
		background: rgb(19 38 27 / 0.76);
		color: var(--shell-ivory);
		font-family: var(--shell-mono);
		font-size: 10px;
		pointer-events: none;
	}
	.controls { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
	.edrow {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 5px;
		min-width: 0;
	}
	.el {
		width: 32px;
		flex: 0 0 auto;
		font-size: 11px;
		color: var(--shell-ink-2);
	}
	.seg {
		display: inline-flex;
		max-width: 100%;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 999px;
		overflow: hidden;
	}
	.seg button {
		border: 0;
		border-right: 1px solid var(--shell-hairline);
		background: transparent;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 11px;
		padding: 0 6px;
		cursor: pointer;
		min-height: 24px;
		white-space: nowrap;
	}
	.seg button:last-child { border-right: 0; }
	.seg button[aria-pressed='true'] { background: var(--shell-action); color: var(--shell-on-action); }
	.seg button:disabled { opacity: 0.45; cursor: not-allowed; }
	.seg button:focus-visible { outline: 2px solid var(--shell-forest); outline-offset: -2px; }
	.stepb {
		flex: 0 0 auto;
		min-width: 24px;
		height: 24px;
		padding: 0 5px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 7px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font-size: 12px;
		cursor: pointer;
	}
	.sel {
		flex: 1 1 0;
		min-width: 0;
		max-width: 100%;
		height: 24px;
		padding: 0 6px;
		border: 1px solid var(--shell-field-line-strong);
		border-radius: 7px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font: inherit;
		font-size: 11.5px;
	}
	.note { margin: 0; font-size: 11px; color: var(--shell-ink-2); }
	.budget { color: var(--shell-caution); }
	.linkb { border: 0; padding: 0; background: transparent; color: inherit; text-decoration: underline; font: inherit; cursor: pointer; }
	@media (pointer: coarse) {
		.seg button, .stepb, .sel { min-height: var(--shell-touch-target); }
		.seg button { padding: 0 11px; }
	}
</style>
