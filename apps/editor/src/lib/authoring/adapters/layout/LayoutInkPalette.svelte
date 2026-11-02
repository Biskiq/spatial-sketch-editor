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
	import type { Component } from 'svelte';
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
	let disclosed = $state<'point' | 'options' | null>(null);

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
				readingView = _services.stage.inkReadings().find((reading) => reading.id === next.reading)?.view ?? null;
			}
		};
		frame = requestAnimationFrame(watch);
		return () => cancelAnimationFrame(frame);
	});

	/** Open one disclosure above the row, or close it when it is already open. */
	function toggle(name: 'point' | 'options'): void {
		disclosed = disclosed === name ? null : name;
	}

	function chooseReading(id: string): void {
		disclosed = null;
		inkSurface()?.controller.setReading(id);
	}

	function chooseWallMode(mode: 'line' | 'box'): void {
		// A Box has no typed point, so an open point disclosure does not carry over.
		if (mode === 'box' && disclosed === 'point') disclosed = null;
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

<div class="ink-palette" data-layout-ink-palette>
	{#if readingView !== null}
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
					<input type="text" inputmode="decimal" data-ink-x bind:value={pointX} aria-label="Next point X" />
				</label>
				<label>
					<span>Z</span>
					<input type="text" inputmode="decimal" data-ink-z bind:value={pointZ} aria-label="Next point Z" />
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
					<input type="text" inputmode="decimal" data-ink-height bind:value={heightText} onchange={commitOptions} />
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
		<fieldset class="group reading">
			<legend class="sr-only">Reading</legend>
			{#each snapshot.readings as option (option.id)}
				<label class="key" class:armed={snapshot.reading === option.id} title={option.summary}>
					<input
						class="radio"
						type="radio"
						name="layout-ink-reading"
						data-ink-reading={option.id}
						data-ink-reading-wall={option.id === 'wall' ? '' : undefined}
						data-ink-reading-opening={option.id === 'opening' ? '' : undefined}
						checked={snapshot.reading === option.id}
						onchange={() => chooseReading(option.id)}
					/>
					<span>{option.label}</span>
				</label>
			{/each}
		</fieldset>

		{#if readingView === null && snapshot.reading === 'wall'}
			<div class="group" role="radiogroup" aria-label="Wall shape" title={snapshot.wallMode === 'box' ? boxHint : wallHint}>
				{#each [{ id: 'line', label: 'Line' }, { id: 'box', label: 'Box' }] as const as mode (mode.id)}
					<button
						type="button"
						class="key"
						role="radio"
						aria-checked={snapshot.wallMode === mode.id}
						data-ink-wall-mode={mode.id}
						onclick={() => chooseWallMode(mode.id)}
					>
						{mode.label}
					</button>
				{/each}
			</div>

			{#if snapshot.wallMode === 'line'}
				<div class="group">
					<button type="button" class="key" data-ink-finish title="Finish (Enter)" aria-keyshortcuts="Enter" disabled={!snapshot.canFinish} onclick={() => inkSurface()?.controller.finish()}>
						Finish
					</button>
					<button type="button" class="key" data-ink-close title="Close the ring to the start point" disabled={!snapshot.canClose} onclick={() => inkSurface()?.controller.close()}>
						Close ring
					</button>
					<button type="button" class="key" data-ink-backtrack title="Backtrack (Backspace)" aria-keyshortcuts="Backspace" disabled={!snapshot.canBacktrack} onclick={() => inkSurface()?.controller.backtrack()}>
						Backtrack
					</button>
				</div>
			{/if}

			<div class="group">
				{#if snapshot.wallMode === 'line'}
					<button
						type="button"
						class="key"
						data-ink-point-toggle
						aria-expanded={disclosed === 'point'}
						aria-controls="ink-panel-point"
						onclick={() => toggle('point')}
					>
						Point
					</button>
				{/if}
				<button
					type="button"
					class="key"
					data-ink-options-toggle
					aria-expanded={disclosed === 'options'}
					aria-controls="ink-panel-options"
					onclick={() => toggle('options')}
				>
					Options
				</button>
			</div>

			<div class="group live-facts">
				<dl class="live" title={consequenceText}>
					{#if snapshot.wallMode === 'box'}
						<div><dt>Box</dt><dd data-ink-box-size>{snapshot.box === null ? '—' : `${snapshot.box.width.toFixed(3)} × ${snapshot.box.depth.toFixed(3)} m`}</dd></div>
					{:else}
						<div><dt>Points</dt><dd>{snapshot.points.length}{snapshot.closed ? ' · closed' : ''}</dd></div>
						<div><dt>Pending</dt><dd>{pendingText ?? '—'}</dd></div>
					{/if}
				</dl>
			</div>

			<div class="group">
				<button type="button" class="key" data-ink-cancel title="Cancel (Esc)" aria-keyshortcuts="Escape" onclick={() => inkSurface()?.controller.cancel()}>
					Cancel
				</button>
			</div>
		{:else if readingView === null && snapshot.reading === 'opening'}
			<div class="group">
				<button
					type="button"
					class="key"
					data-ink-options-toggle
					aria-expanded={disclosed === 'options'}
					aria-controls="ink-panel-options"
					onclick={() => toggle('options')}
				>
					Options
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.ink-palette {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
		max-width: 100%;
		color: var(--shell-ink-light, #f3f4ee);
		font-size: var(--shell-text-utility, 12px);
	}
	.keys {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem 0.25rem;
	}
	.group {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.group + .group {
		padding-left: 0.5rem;
		border-left: 1px solid var(--shell-hairline, #2f4a3d);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
	/* A compact key: the dock's material with an ivory armed state; the label stays text. */
	.key {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-width: 2rem;
		min-height: var(--shell-control-height, 32px);
		margin: 0;
		padding: 0 0.5rem;
		border: 1px solid transparent;
		border-radius: 0.35rem;
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
		cursor: pointer;
	}
	.key:hover:not(:disabled) {
		border-color: var(--shell-ink-quiet, #9fb2a2);
	}
	.key[aria-checked='true'],
	.key.armed {
		border-color: var(--shell-ink-light, #f3f4ee);
		background: var(--shell-ink-light, #f3f4ee);
		color: var(--shell-forest, #11291f);
	}
	.key[aria-expanded='true'] {
		border-color: var(--shell-ink-quiet, #9fb2a2);
		background: var(--shell-forest-raised, #22503c);
	}
	.key:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
	/* The reading radio is visually a key; its label takes the focus ring. */
	.reading .key {
		cursor: pointer;
	}
	.radio {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		opacity: 0;
		pointer-events: none;
	}
	.key:focus-visible,
	.key:focus-within,
	input:focus-visible {
		outline: 2px solid var(--shell-gold, #d4ad45);
		outline-offset: 2px;
	}
	.panel {
		display: grid;
		gap: 0.4rem;
		padding: 0.45rem 0.5rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.4rem;
		background: var(--shell-forest, #11291f);
	}
	.options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.options label,
	.typed-point label {
		display: grid;
		grid-template-columns: auto 4.5rem auto;
		align-items: center;
		gap: 0.35rem;
	}
	.typed-point label {
		grid-template-columns: auto 4rem;
	}
	input:not(.radio) {
		min-height: var(--shell-control-height, 32px);
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--shell-ink-quiet, #9fb2a2);
		border-radius: 0.3rem;
		background: var(--shell-forest, #11291f);
		color: var(--shell-ink-light, #f3f4ee);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	.typed-point {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
	.typed-point button {
		min-height: var(--shell-control-height, 32px);
		padding: 0 0.55rem;
		border: 1px solid var(--shell-ink-quiet, #9fb2a2);
		border-radius: 0.35rem;
		background: var(--shell-forest, #11291f);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.unit,
	.live dt {
		color: var(--shell-ink-quiet, #9fb2a2);
	}
	.live-facts {
		min-width: 0;
		border: 0;
	}
	.live {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.1rem 0.6rem;
		margin: 0;
		padding: 0 0.25rem;
		font-size: 0.72rem;
		cursor: help;
	}
	.live div {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
	}
	.live dd {
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	.refusal {
		margin: 0;
		padding: 0.3rem 0.4rem;
		border: 1px solid #a4583c;
		border-radius: 0.3rem;
		background: #3a2018;
		color: #f3d9cd;
	}
	.error {
		margin: 0;
		color: #f0a98c;
	}
	@media (pointer: coarse) {
		.key,
		input:not(.radio),
		.typed-point button {
			min-width: var(--shell-touch-target, 44px);
			min-height: var(--shell-touch-target, 44px);
		}
	}
</style>
