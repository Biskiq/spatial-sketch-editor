<script lang="ts">
	/**
	 * R217.S05 — PLATE's **drafting cluster** in the Stage's top-left furniture slot.
	 *
	 * The cluster is one reading control and three words, never a toolbar of
	 * domain tools:
	 *
	 * - **2D | 3D** is the segmented reading control; it requests the existing
	 *   `set-reading` viewing intent, so it neither composes a pose nor refits.
	 * - **Scale** reads the current ratio and opens the detents and **Fit all**,
	 *   each of which is a viewing intent request owned by the host.
	 * - **Grid** and **Snap** toggle their one fact and say it in words; a held
	 *   Alt/Option is reported as `Snap held`, never by colour alone.
	 * - The configuration disclosure overrides the minor interval and the snap
	 *   fact. It is view state: nothing here reaches source, history or Save.
	 *
	 * Every control is a native button with `aria-pressed` or `aria-expanded`, so
	 * keyboard access and state announcement come from the control itself. Under
	 * `pointer: coarse` every target is at least 44 CSS px.
	 */
	import {
		GRID_MINOR_CHOICES,
		formatMeters,
		type StageDraftingPatch,
		type StageDraftingState
	} from '../stage-drafting';

	let {
		drafting,
		reading,
		scaleLabel,
		scaleDetents,
		gridWord,
		snapWord,
		onReading,
		onPatch,
		onScaleDetent,
		onFitAll
	}: {
		drafting: StageDraftingState;
		/** The settled reading the segmented control reports. */
		reading: 'plan' | '3d';
		/** The Scale word, already including its ratio (for example `1:100`). */
		scaleLabel: string;
		scaleDetents: readonly number[];
		/** The Grid word at the interval actually drawn. */
		gridWord: string;
		/** The Snap word: increment, `held`, or `off`. */
		snapWord: string;
		onReading: (reading: 'plan' | '3d') => void;
		onPatch: (patch: StageDraftingPatch) => void;
		onScaleDetent: (ratio: number) => void;
		onFitAll: () => void;
	} = $props();

	let scaleOpen = $state(false);
	let configOpen = $state(false);
	let scaleButton = $state<HTMLButtonElement>();
	let configButton = $state<HTMLButtonElement>();
	let scalePanel = $state<HTMLDivElement>();
	let configPanel = $state<HTMLDivElement>();

	function closeAll(restoreFocus = false): void {
		const hadFocus = document.activeElement !== null;
		if (scaleOpen) {
			scaleOpen = false;
			if (restoreFocus && hadFocus) queueMicrotask(() => scaleButton?.focus());
		}
		if (configOpen) {
			configOpen = false;
			if (restoreFocus && hadFocus) queueMicrotask(() => configButton?.focus());
		}
	}

	function onWindowKey(event: KeyboardEvent): void {
		if (event.key !== 'Escape' || (!scaleOpen && !configOpen)) return;
		event.preventDefault();
		event.stopPropagation();
		closeAll(true);
	}

	function onWindowPointer(event: PointerEvent): void {
		// A press inside either disclosure is the disclosure's own; anything else
		// dismisses it, exactly as a popover is expected to behave.
		const target = event.target;
		if (!(target instanceof Node)) return;
		if (scalePanel?.contains(target) || configPanel?.contains(target)) return;
		if (scaleButton?.contains(target) || configButton?.contains(target)) return;
		closeAll();
	}

	$effect(() => {
		if (!scaleOpen && !configOpen) return;
		window.addEventListener('keydown', onWindowKey, true);
		// Capture, because the Stage's action wrapper stops pointerdown before it
		// bubbles. A sibling control (Grid, Snap, 2D/3D) is outside the disclosure
		// and must dismiss it, while the containment checks below keep presses
		// inside the panel or on its trigger from closing it first.
		window.addEventListener('pointerdown', onWindowPointer, true);
		return () => {
			window.removeEventListener('keydown', onWindowKey, true);
			window.removeEventListener('pointerdown', onWindowPointer, true);
		};
	});

	function toggleScale(): void {
		scaleOpen = !scaleOpen;
		configOpen = false;
	}

	function toggleConfig(): void {
		configOpen = !configOpen;
		scaleOpen = false;
	}

	$effect(() => {
		// A dialog that opens must take focus into its own contents; Escape (or a
		// detent) closes it and returns focus to the trigger. Without this the
		// dialog role would be announced while focus stayed on the trigger behind
		// it, and Tab would walk the page instead of the panel.
		if (!scaleOpen && !configOpen) return;
		const panel = scaleOpen ? scalePanel : configPanel;
		queueMicrotask(() => {
			panel?.querySelector<HTMLElement>('button, select, input, a[href]')?.focus();
		});
	});

	function pickDetent(ratio: number): void {
		onScaleDetent(ratio);
		closeAll(true);
	}

	function pickFit(): void {
		onFitAll();
		closeAll(true);
	}

	function setMinor(event: Event): void {
		const value = Number((event.currentTarget as HTMLSelectElement).value);
		onPatch({ gridMinorMeters: value });
	}
</script>

<div class="cluster" data-stage-drafting role="group" aria-label="Drafting state">
	<div class="reading" role="group" aria-label="Reading">
		<button
			type="button"
			data-drafting-reading="plan"
			aria-pressed={reading === 'plan'}
			title="2D plan reading (P)"
			onclick={() => onReading('plan')}
		>
			2D
		</button>
		<button
			type="button"
			data-drafting-reading="3d"
			aria-pressed={reading === '3d'}
			title="3D reading (3)"
			onclick={() => onReading('3d')}
		>
			3D
		</button>
	</div>

	<div class="words">
		<div class="disclosure">
			<button
				type="button"
				bind:this={scaleButton}
				data-drafting-scale
				aria-haspopup="dialog"
				aria-controls="drafting-scale-panel"
				aria-expanded={scaleOpen}
				title="Scale: choose a detent or Fit all"
				onclick={toggleScale}
			>
				{scaleLabel}<span class="caret" aria-hidden="true">▾</span>
			</button>
			{#if scaleOpen}
				<div
					id="drafting-scale-panel"
					class="panel scale-panel"
					bind:this={scalePanel}
					role="dialog"
					aria-label="Scale"
				>
					<strong>Scale</strong>
					<div class="detents">
						{#each scaleDetents as ratio (ratio)}
							<button type="button" data-drafting-detent={ratio} onclick={() => pickDetent(ratio)}>
								1:{ratio}
							</button>
						{/each}
					</div>
					<button type="button" class="fit" data-drafting-fit onclick={pickFit}>Fit all</button>
				</div>
			{/if}
		</div>

		<button
			type="button"
			data-drafting-grid
			aria-pressed={drafting.grid}
			title="Grid: show or hide the measured grid"
			onclick={() => onPatch({ grid: !drafting.grid })}
		>
			{gridWord}
		</button>
		<button
			type="button"				data-drafting-snap
				aria-pressed={drafting.snap}
				aria-describedby="drafting-snap-state"
				title="Snap: round free points to the configured minor interval (hold Alt or Option to suspend)"
			onclick={() => onPatch({ snap: !drafting.snap })}
		>
			{snapWord}
		</button>

		<div class="disclosure">
			<button
				type="button"
				class="config-key"
				bind:this={configButton}
				data-drafting-config
				aria-haspopup="dialog"
				aria-controls="drafting-config-panel"
				aria-expanded={configOpen}
				aria-label="Drafting configuration"
				title="Drafting configuration"
				onclick={toggleConfig}
			>
				<span aria-hidden="true">⚙</span>
			</button>
			{#if configOpen}
				<div
					id="drafting-config-panel"
					class="panel config-panel"
					bind:this={configPanel}
					role="dialog"
					aria-label="Drafting configuration"
				>
					<label>
						<span>Minor interval</span>
						<select value={drafting.gridMinorMeters} onchange={setMinor}>
							{#each GRID_MINOR_CHOICES as choice (choice)}
								<option value={choice}>{formatMeters(choice)}</option>
							{/each}
						</select>
					</label>
					<label class="check">
						<input
							type="checkbox"
							checked={drafting.snap}
							onchange={(event) => onPatch({ snap: event.currentTarget.checked })}
						/>
						<span>Snap free points to the current Grid interval</span>
					</label>
				</div>
			{/if}
		</div>
	</div>
	<!-- The durable aria-pressed is the switch; this polite status names the
	     temporary Alt/Option hold, which would otherwise be visible only in text. -->
	<span id="drafting-snap-state" class="sr-only" role="status" aria-live="polite">{snapWord}</span>
</div>

<style>
	.cluster {
		/* The Head's calibrated chassis inks; the cluster lives outside `.head`, so
		   without these the fallbacks were a visibly lighter chrome. */
		--chassis-forest: #11291f;
		--chassis-hairline: #2f4a3d;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		max-width: min(46rem, calc(100vw - 2rem));
	}
	.reading {
		display: inline-flex;
		overflow: hidden;
		border: 1px solid var(--chassis-hairline, #405d4c);
		border-radius: 0.4rem;
	}
	.words {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}
	button {
		min-height: 2.25rem;
		padding: 0 0.6rem;
		border: 1px solid var(--chassis-hairline, #405d4c);
		border-radius: 0.4rem;
		background: var(--chassis-forest, #11291f);
		color: #f4f0e9;
		font: inherit;
		font-size: 0.76rem;
		letter-spacing: 0.01em;
		white-space: nowrap;
		cursor: pointer;
	}
	.reading button {
		border: 0;
		border-radius: 0;
	}
	.reading button + button {
		border-left: 1px solid var(--chassis-hairline, #405d4c);
	}
	button:hover {
		border-color: #6d8f7b;
	}
	button[aria-pressed='true'] {
		background: #f4f0e9;
		color: #14231b;
		font-weight: 650;
	}
	.reading button[aria-pressed='true'] {
		background: #f4f0e9;
		color: #14231b;
	}
	.config-key {
		min-width: 2.25rem;
		font-size: 0.9rem;
	}
	button:focus-visible,
	select:focus-visible,
	input:focus-visible {
		outline: 2px solid #9fd0b4;
		outline-offset: 2px;
	}
	.caret {
		margin-left: 0.3rem;
		opacity: 0.75;
	}
	.disclosure {
		position: relative;
	}
	.panel {
		position: absolute;
		z-index: 40;
		top: calc(100% + 0.35rem);
		left: 0;
		display: grid;
		gap: 0.45rem;
		width: 14rem;
		padding: 0.6rem;
		border: 1px solid #405d4c;
		border-radius: 0.45rem;
		background: #11291f;
		box-shadow: 0 0.5rem 1.5rem rgb(6 20 14 / 45%);
		color: #f4f0e9;
		font-size: 0.74rem;
	}
	.scale-panel {
		width: 12rem;
	}
	.detents {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.3rem;
	}
	.detents button {
		font-variant-numeric: tabular-nums;
	}
	.fit {
		background: #22503c;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.config-panel {
		right: 0;
		left: auto;
		width: 15rem;
		/* Never wider than the viewport; the panel is anchored to a wrapped gear. */
		max-width: calc(100vw - 1rem);
	}
	.config-panel label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}
	.config-panel label.check {
		justify-content: flex-start;
	}
	select {
		background: #1b2b23;
		color: #f4f0e9;
		border: 1px solid #405d4c;
		border-radius: 0.3rem;
		font: inherit;
		padding: 0.15rem 0.25rem;
	}
	/* Touch targets: PLATE requires 44 px under a coarse pointer. */	@media (pointer: coarse) {
		button {
			min-height: 44px;
			min-width: 44px;
			padding: 0 0.8rem;
		}
		.reading button {
			min-width: 56px;
		}
		.panel label {
			min-height: 44px;
		}
		select {
			min-height: 44px;
		}
	}
</style>
