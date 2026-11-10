<script lang="ts">
	/**
	 * T1.P02.S02 — the Ink palette: the one lower-column reading the dock arms.
	 *
	 * PLATE (Round 2) puts the armable tool, its supported readings and the live
	 * facts in one palette above the palette's own dock key. Ink exposes exactly the
	 * reading the domain supports — a straight Wall chain, drawn as Line points or
	 * as a Box from two opposite corners (R217.S10). There are no empty
	 * Slice/Eraser/Brush/Measure slots and no unsupported Shape/Round/roof option,
	 * because a control this shell offers would be a promise the domain cannot keep.
	 *
	 * R217.S23 — the palette is one compact row above the dock. Reading, mode, Finish,
	 * Close ring, Backtrack and Cancel are keys in that row. The typed X/Z point and
	 * the Wall or Opening options are not drawn until asked for: each discloses
	 * upward from the row, one at a time, so the drawing stays visible.
	 *
	 * Everything it shows is read from the adapter's published surface; every
	 * command goes back through the same controller, so the palette cannot become a
	 * second writer of the chain. Keyboard parity: Enter finishes, Backspace
	 * backtracks, Escape cancels (the host owns those keys on the Stage).
	 */
	import { untrack, type Component } from 'svelte';
	import { ShellIcon } from '$lib/authoring/stage/stage-adapter-host';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { parseMeasureInput, parsePlacementXZ } from './precision';
	import { inkSurface, inkSurfaceRevision, type InkPaletteSnapshot } from './ink';

	// The shell mounts this palette with the binding's services, like every other
	// instrument. The palette reads and commands the **published** surface instead
	// of the binding: a rebuilt binding must never leave a mounted panel driving a
	// draft its adapter has already ended.
	let { services: _services }: { services: StageAdapterServices } = $props();

	/** Remembered for the session: a creator draws a run of Walls at one setting. */
	const defaults = { thickness: '0.2', height: '3' };
	let thicknessText = $state(defaults.thickness);
	let heightText = $state(defaults.height);
	let optionError = $state<string | null>(null);
	let pointX = $state('');
	let pointZ = $state('');
	let pointError = $state<string | null>(null);
	/**
	 * The one disclosure open above the row, if any. `point` is the typed X/Z path and
	 * `options` the Wall thickness and height, or the Opening's own measures. Session
	 * view state only: it never reaches the chain, and a reading change closes it.
	 */
	let disclosed = $state<'point' | 'options' | 'pens' | null>(null);

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
	/** The contributed reading's own palette controls, when one is active. */
	let readingView = $state<Component | null>(null);
	const activeReading = $derived(
		snapshot.readings.find((reading) => reading.id === snapshot.reading) ?? null
	);

	// The adapter owns the draft, and a pointer move does not re-render this panel.
	// One frame loop reads the published surface and writes state only on change.
	$effect(() => {
		let frame = 0;
		let seenRevision = -1;
		let seenKey = '';
		const watch = () => {
			frame = requestAnimationFrame(watch);
			const surface = inkSurface();
			const revision = inkSurfaceRevision();
			const next = surface?.snapshot() ?? emptySnapshot;
			const key = JSON.stringify(next);
			if (revision !== seenRevision || key !== seenKey) {
				seenRevision = revision;
				seenKey = key;
				snapshot = next;
				readingView =
					_services.stage.inkReadings().find((reading) => reading.id === next.reading)?.view ??
					null;
			}
		};
		frame = requestAnimationFrame(watch);
		return () => cancelAnimationFrame(frame);
	});

	/** Open one disclosure above the row, or close it when it is already open. */
	function toggle(name: 'point' | 'options' | 'pens'): void {
		if (name === 'options' && disclosed !== 'options') {
			const options = inkSurface()?.snapshot().options;
			thicknessText = String(options?.thickness ?? 0.2);
			heightText = String(options?.height ?? 3);
		}
		disclosed = disclosed === name ? null : name;
	}

	function chooseReading(id: string): void {
		disclosed = null;
		inkSurface()?.controller.setReading(id);
	}

	function chooseWallMode(mode: 'line' | 'box' | 'circle'): void {
		// Box and Circle have no typed point, so an open point disclosure does not carry over.
		if (mode !== 'line' && disclosed === 'point') disclosed = null;
		inkSurface()?.controller.setWallMode(mode);
	}

	function commitOptions(): void {
		const thickness = parseMeasureInput(thicknessText);
		if (!thickness.ok) {
			optionError = `Thickness: ${thickness.reason}`;
			return;
		}
		if (!(thickness.value > 0)) {
			optionError = 'Thickness must be greater than zero.';
			return;
		}
		const height = parseMeasureInput(heightText);
		if (!height.ok) {
			optionError = `Height: ${height.reason}`;
			return;
		}
		if (!(height.value > 0)) {
			optionError = 'Height must be greater than zero.';
			return;
		}
		optionError = null;
		inkSurface()?.controller.setOptions({ thickness: thickness.value, height: height.value });
	}

	function addTypedPoint(): void {
		const parsed = parsePlacementXZ(pointX, pointZ);
		if (!parsed.ok) {
			pointError = parsed.reason;
			return;
		}
		pointError = null;
		inkSurface()?.controller.typePoint(pointX, pointZ);
	}

	const pendingText = $derived(
		snapshot.pending === null
			? null
			: `${snapshot.pending.length.toFixed(3)} m · ${snapshot.pending.angleDegrees.toFixed(1)}°`
	);
	const wallHint =
		'Click the Stage to place points; click the start point to close the ring. Drag to draw one Wall and finish.';
	const boxHint =
		'Press one corner and drag to the opposite corner, or click two opposite corners. The four Walls close a Room.';
	/** The Opening reading shows its refusal in its own panel while that panel is open. */
	const refusalShown = $derived(
		snapshot.refusal !== null && !(snapshot.reading === 'opening' && disclosed === 'options')
	);
	/** The planner's consequence, read on the live facts rather than drawn as a line of its own. */
	const consequenceText = $derived(
		`On finish: ${snapshot.consequence ?? 'Name at least two points to see the planner’s consequence.'}`
	);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="ink-palette"
	data-layout-ink-palette
	data-ink-points={snapshot.points.length}
	onkeydown={(event) => {
		if (event.key === 'Escape' && disclosed !== null) {
			event.preventDefault();
			event.stopPropagation();
			disclosed = null;
		}
	}}
>
	{#if disclosed === 'pens'}
		<div class="panel" aria-label="Ink settings">
			{#if snapshot.reading !== 'opening'}<button
					type="button"
					data-ink-reading-opening
					onclick={() => {
						chooseReading('opening');
						disclosed = 'options';
					}}>Opening…</button
				>{/if}
			{#if snapshot.reading !== 'wall'}<button
					type="button"
					data-ink-reading-wall
					onclick={() => chooseReading('wall')}>Wall</button
				>{/if}
			{#if snapshot.reading === 'wall'}<button type="button" data-ink-options-toggle onclick={() => toggle('options')}
				>Wall options…</button
			>{/if}
			{#if snapshot.reading === 'wall' && snapshot.wallMode === 'line'}<button
					type="button"
					data-ink-point-toggle
					onclick={() => toggle('point')}>Point…</button
				>
				<button
					type="button"
					data-ink-finish
					disabled={!snapshot.canFinish}
					onclick={() => inkSurface()?.controller.finish()}>Finish (Enter)</button
				>
				<button
					type="button"
					data-ink-close
					disabled={!snapshot.canClose}
					onclick={() => inkSurface()?.controller.close()}>Close ring</button
				>
				<button
					type="button"
					data-ink-backtrack
					disabled={!snapshot.canBacktrack}
					onclick={() => inkSurface()?.controller.backtrack()}>Backtrack</button
				>{/if}
			<button type="button" data-ink-cancel onclick={() => inkSurface()?.controller.cancel()}
				>Cancel stroke</button
			>
		</div>
	{:else if readingView !== null}
		{@const ReadingView = readingView}
		<ReadingView />
	{:else if disclosed === 'point' && snapshot.reading === 'wall' && snapshot.wallMode === 'line'}
		<div class="panel" id="ink-panel-point" role="group" aria-label="Typed point">
			<form
				class="typed-point"
				onsubmit={(event) => {
					event.preventDefault();
					addTypedPoint();
				}}
			>
				<label>
					<span>X</span>
					<input
						type="text"
						inputmode="decimal"
						data-ink-x
						bind:value={pointX}
						aria-label="Next point X"
					/>
				</label>
				<label>
					<span>Z</span>
					<input
						type="text"
						inputmode="decimal"
						data-ink-z
						bind:value={pointZ}
						aria-label="Next point Z"
					/>
				</label>
				<button type="submit" data-ink-add-point>Add point</button>
			</form>
			{#if pointError !== null}<p class="error" role="alert">{pointError}</p>{/if}
		</div>
	{:else if disclosed === 'options' && snapshot.reading === 'wall' && readingView === null}
		<div class="panel" id="ink-panel-options" role="group" aria-label="Wall options">
			<div class="options">
				<label>
					<span>Thickness</span>
					<input
						type="text"
						inputmode="decimal"
						data-ink-thickness
						bind:value={thicknessText}
						onchange={commitOptions}
					/>
					<span class="unit">m</span>
				</label>
				<label>
					<span>Height</span>
					<input
						type="text"
						inputmode="decimal"
						data-ink-height
						bind:value={heightText}
						onchange={commitOptions}
					/>
					<span class="unit">m</span>
				</label>
			</div>
			{#if optionError !== null}<p class="error" role="alert">{optionError}</p>{/if}
		</div>
	{:else if disclosed === 'options' && snapshot.reading === 'opening' && readingView === null}
		<div class="panel" id="ink-panel-options" role="group" aria-label="Opening options">
			{#await import('./LayoutOpeningPalette.svelte') then { default: OpeningPalette }}
				<OpeningPalette services={_services} opening={snapshot.opening} />
			{/await}
		</div>
	{/if}

	{#if refusalShown}
		<p class="refusal" role="alert" data-ink-refusal>{snapshot.refusal}</p>
	{/if}

	<div class="keys">
		<button
			type="button"
			class="key more"
			aria-label="Ink settings and Opening"
			aria-expanded={disclosed === 'pens'}
			onclick={() => toggle('pens')}
			><ShellIcon name="more" size={14} />
		</button>

		{#if snapshot.reading === 'wall'}
			<button
				type="button"
				class="key"
				aria-label="Round unavailable"
				aria-disabled="true"
				title="Round is not available yet"><ShellIcon name="round" size={16} /></button
			>
			{#each ['box', 'line', 'circle'] as const as mode}
				<button
					type="button"
					class="key"
					role="radio"
					aria-label={mode === 'box' ? 'Box' : mode === 'circle' ? 'Circle' : 'Line'}
					aria-checked={snapshot.wallMode === mode}
					data-ink-wall-mode={mode}
					onclick={() => chooseWallMode(mode)}
				><ShellIcon name={mode === 'circle' ? 'round' : mode} size={16} /></button
				>
			{/each}
			<button
				type="button"
				class="key"
				aria-label="Sketch unavailable"
				aria-disabled="true"
				title="Sketch is not available yet"><ShellIcon name="sketch" size={16} /></button
			>
		{/if}
	</div>
</div>

<style>
	.ink-palette {
		position: relative;
		color: var(--shell-ink-light);
		font: 12px var(--shell-sans);
	}
	.keys {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.key {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 0;
		border-radius: 8px;
		color: inherit;
		background: transparent;
		cursor: pointer;
	}
	.key.more {
		height: 18px;
	}
	.key:hover {
		background: var(--shell-on-forest-wash);
	}
	.key[aria-checked='true'] {
		background: var(--shell-on-forest-wash-strong);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--shell-ink-light) 55%, transparent);
	}
	.key[aria-disabled='true'] {
		opacity: 0.35;
		cursor: default;
	}
	.panel {
		position: absolute;
		z-index: 30;
		bottom: calc(100% + 8px);
		left: -8px;
		display: grid;
		gap: 6px;
		width: 216px;
		padding: 8px;
		border: 1px solid var(--shell-line-on-forest);
		border-radius: 12px;
		background: var(--shell-popup-dark);
		box-shadow: var(--shell-shadow);
	}
	.panel button {
		min-height: 28px;
		padding: 4px 6px;
		border: 0;
		border-radius: 6px;
		background: var(--shell-on-forest-wash);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.options,
	.typed-point {
		display: grid;
		gap: 6px;
	}
	.options label,
	.typed-point label {
		display: grid;
		grid-template-columns: 1fr 80px auto;
		align-items: center;
		gap: 4px;
	}
	input {
		box-sizing: border-box;
		min-width: 0;
		width: 100%;
		height: 26px;
		border: 1px solid color-mix(in srgb, var(--shell-ink-light) 30%, transparent);
		border-radius: 6px;
		padding: 0 6px;
		background: var(--shell-forest);
		color: var(--shell-ink-light);
		font: 12px var(--shell-mono);
	}
	.refusal {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 0;
		width: 240px;
		padding: 8px;
		margin: 0;
		border-radius: 8px;
		background: var(--shell-refuse-bg);
		color: var(--shell-refuse);
	}
	.error {
		margin: 0;
		color: color-mix(in srgb, var(--shell-caution) 55%, var(--shell-ink-light));
	}
	.unit {
		color: var(--shell-ink-quiet);
	}
	@media (pointer: coarse) {
		.key,
		.key.more,
		input,
		.panel button {
			width: 44px;
			min-height: 44px;
		}
		.panel button,
		input {
			width: 100%;
		}
	}
</style>
