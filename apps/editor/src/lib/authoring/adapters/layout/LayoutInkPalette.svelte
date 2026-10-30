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
</script>

<div class="ink-palette" data-layout-ink-palette>
	<fieldset class="reading">
		<legend>Reading</legend>
		{#each snapshot.readings as option (option.id)}
			<label class="reading-option">
				<input
					type="radio"
					name="layout-ink-reading"
					data-ink-reading={option.id}
					data-ink-reading-wall={option.id === 'wall' ? '' : undefined}
					data-ink-reading-opening={option.id === 'opening' ? '' : undefined}
					checked={snapshot.reading === option.id}
					onchange={() => inkSurface()?.controller.setReading(option.id)}
				/>{option.label}
			</label>
		{/each}
		<span class="quiet">{activeReading?.summary ?? ''}</span>
	</fieldset>

	{#if readingView !== null}
		{@const ReadingView = readingView}
		<ReadingView />
	{:else if snapshot.reading === 'wall'}
		<div class="wall-mode" role="radiogroup" aria-label="Wall shape">
			{#each [{ id: 'line', label: 'Line' }, { id: 'box', label: 'Box' }] as const as mode (mode.id)}
				<button
					type="button"
					role="radio"
					aria-checked={snapshot.wallMode === mode.id}
					data-ink-wall-mode={mode.id}
					onclick={() => inkSurface()?.controller.setWallMode(mode.id)}
				>
					{mode.label}
				</button>
			{/each}
		</div>
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

		<dl class="live">
			{#if snapshot.wallMode === 'box'}
				<div>
					<dt>Box</dt>
					<dd data-ink-box-size>{snapshot.box === null ? '—' : `${snapshot.box.width.toFixed(3)} × ${snapshot.box.depth.toFixed(3)} m`}</dd>
				</div>
			{:else}
				<div><dt>Points</dt><dd>{snapshot.points.length}{snapshot.closed ? ' · closed' : ''}</dd></div>
				<div><dt>Pending</dt><dd>{pendingText ?? '—'}</dd></div>
			{/if}
			<div class="consequence">
				<dt>On finish</dt>
				<dd>{snapshot.consequence ?? 'Name at least two points to see the planner’s consequence.'}</dd>
			</div>
		</dl>

		{#if snapshot.refusal !== null}
			<p class="refusal" role="alert" data-ink-refusal>{snapshot.refusal}</p>
		{/if}

		{#if snapshot.wallMode === 'box'}
		<div class="actions">
			<button type="button" data-ink-cancel onclick={() => inkSurface()?.controller.cancel()}>Cancel (Esc)</button>
		</div>
		<p class="quiet">Press one corner and drag to the opposite corner, or click two opposite corners. The four Walls close a Room.</p>
		{:else}
		<div class="actions">
			<button type="button" data-ink-finish disabled={!snapshot.canFinish} onclick={() => inkSurface()?.controller.finish()}>
				Finish (Enter)
			</button>
			<button type="button" data-ink-close disabled={!snapshot.canClose} onclick={() => inkSurface()?.controller.close()}>
				Close ring
			</button>
			<button type="button" data-ink-backtrack disabled={!snapshot.canBacktrack} onclick={() => inkSurface()?.controller.backtrack()}>
				Backtrack (Backspace)
			</button>
			<button type="button" data-ink-cancel onclick={() => inkSurface()?.controller.cancel()}>Cancel (Esc)</button>
		</div>

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
		<p class="quiet">Click the Stage to place points; click the start point to close the ring. Drag to draw one Wall and finish.</p>
		{/if}
	{:else}
		{#await import('./LayoutOpeningPalette.svelte') then { default: OpeningPalette }}
			<OpeningPalette services={_services} opening={snapshot.opening} />
		{/await}
	{/if}
</div>

<style>
	.ink-palette {
		display: grid;
		gap: 0.45rem;
		min-width: min(26rem, 80vw);
		font-size: 0.78rem;
	}
	.reading {
		display: grid;
		gap: 0.2rem;
		margin: 0;
		padding: 0.2rem 0.45rem 0.35rem;
		border: 1px solid #4d4655;
		border-radius: 0.35rem;
	}
	.reading legend {
		padding: 0 0.25rem;
		color: #c9a9ff;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.reading-option {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.wall-mode {
		display: flex;
		gap: 0.25rem;
	}
	.wall-mode button[aria-checked='true'] {
		border-color: #f3f0e4;
		background: #f3f0e4;
		color: #14231b;
	}
	.options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.options label {
		display: grid;
		grid-template-columns: auto 4.5rem auto;
		align-items: center;
		gap: 0.35rem;
	}
	input {
		min-height: 1.9rem;
		padding: 0.1rem 0.35rem;
		border: 1px solid #635a6f;
		border-radius: 0.3rem;
		background: #241f2b;
		color: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	.unit,
	.quiet {
		color: #8f8a99;
		font-size: 0.68rem;
	}
	.live {
		display: grid;
		gap: 0.15rem;
		margin: 0;
	}
	.live div {
		display: flex;
		justify-content: space-between;
		gap: 0.6rem;
	}
	.live dt {
		color: #8f8a99;
	}
	.live dd {
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	.consequence dd {
		text-align: right;
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
	.actions,
	.typed-point {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
	.typed-point label {
		display: grid;
		grid-template-columns: auto 4rem;
		align-items: center;
		gap: 0.3rem;
	}
	button {
		min-height: 2.25rem;
		padding: 0.15rem 0.55rem;
		border: 1px solid #635a6f;
		border-radius: 0.35rem;
		background: #292632;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid #2f8cff;
		outline-offset: 1px;
	}
</style>
