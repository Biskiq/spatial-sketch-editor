<script lang="ts">
	/**
	 * R217.S13 — PLATE's **drafting cluster** in the Stage's top-left furniture slot,
	 * with R217.S20's **⚙ viewing preferences** beside it.
	 *
	 * The cluster is one reading control and two words, never a toolbar of domain
	 * tools:
	 *
	 * - **2D | 3D** is the segmented reading control; it requests the existing
	 *   `set-reading` viewing intent, so it neither composes a pose nor refits.
	 * - **Grid** and **Snap** toggle their one fact and say it in words; a held
	 *   Alt/Option is reported as `Snap held`, never by colour alone. Their values
	 *   are fixed, so zoom can only thin the drawing.
	 * - **⚙** opens the viewing preferences: 2D appearance, Height Sheet side, Reduce
	 *   motion and motion speed. These are browser preferences, never source, and the
	 *   panel holds no drafting value: Grid and Snap stay the words above.
	 *
	 * Nothing here reaches source, history or Save. Every control is a native button
	 * with `aria-pressed` or `aria-expanded`, so keyboard access and state
	 * announcement come from the control itself. Under `pointer: coarse` every target
	 * is at least 44 CSS px.
	 */
	import type { StageDraftingPatch, StageDraftingState } from '../stage-drafting';

	let {
		drafting,
		reading,
		quiet = false,
		gridWord,
		snapWord,
		onReading,
		onPatch,
		planAppearance = 'paper',
		onPlanAppearance = () => {},
		heightSheetSide = 'right',
		onHeightSheetSide = () => {},
		reducedMotion = false,
		onToggleReducedMotion = () => {},
		motionSpeed = 'normal',
		onMotionSpeed = () => {}
	}: {
		drafting: StageDraftingState;
		/** The settled reading the segmented control reports. */
		reading: 'plan' | '3d';
		/** Paper's quiet light ink instead of the mat's chassis ink. */
		quiet?: boolean;
		/** The Grid word at the fixed values, or `Grid off`. */
		gridWord: string;
		/** The Snap word: fixed increment, `held`, or `off`. */
		snapWord: string;
		onReading: (reading: 'plan' | '3d') => void;
		onPatch: (patch: StageDraftingPatch) => void;
		/** The ⚙ viewing preferences: browser session values, never source. */
		planAppearance?: 'paper' | 'shaded';
		onPlanAppearance?: (value: 'paper' | 'shaded') => void;
		heightSheetSide?: 'left' | 'right';
		onHeightSheetSide?: (side: 'left' | 'right') => void;
		reducedMotion?: boolean;
		onToggleReducedMotion?: () => void;
		motionSpeed?: 'slow' | 'normal' | 'fast';
		onMotionSpeed?: (value: 'slow' | 'normal' | 'fast') => void;
	} = $props();

	let viewingOpen = $state(false);
	let gear: HTMLButtonElement | undefined;
	const viewingId = $props.id();

	/** Escape closes the panel and returns focus to its ⚙, and stops there so the Stage keeps its own Escape. */
	function onViewingKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape' || !viewingOpen) return;
		event.stopPropagation();
		viewingOpen = false;
		gear?.focus();
	}

	/**
	 * A press outside the ⚙ and its panel closes the panel, as the Head's disclosures do.
	 * It listens in the capture phase: the Stage's cluster stops pointerdown below it,
	 * and a press on another cluster control must still close the panel.
	 */
	function onWindowPointerDown(event: PointerEvent): void {
		if (!viewingOpen) return;
		const target = event.target;
		if (target instanceof Element && target.closest('.viewing-slot') === null) viewingOpen = false;
	}
</script>

<svelte:window onpointerdowncapture={onWindowPointerDown} />

<div class="cluster" class:quiet data-stage-drafting role="group" aria-label="Drafting state">
	<div class="reading" role="group" aria-label="Reading">
		<button
			type="button"
			data-drafting-reading="plan"
			aria-pressed={reading === 'plan'}
			title="2D plan reading (2)"
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
		<button
			type="button"
			data-drafting-grid
			aria-pressed={drafting.grid}
			title="Grid: fixed 1 m and 5 m lines, thinned with zoom"
			onclick={() => onPatch({ grid: !drafting.grid })}
		>
			{gridWord}
		</button>
		<button
			type="button"
			data-drafting-snap
			aria-pressed={drafting.snap}
			aria-describedby="drafting-snap-state"
			title="Snap: fixed 0.5 m increment (hold Alt or Option to suspend)"
			onclick={() => onPatch({ snap: !drafting.snap })}
		>
			{snapWord}
		</button>
	</div>
	<!-- The durable aria-pressed is the switch; this polite status names the
	     temporary Alt/Option hold, which would otherwise be visible only in text. -->
	<span id="drafting-snap-state" class="sr-only" role="status" aria-live="polite">{snapWord}</span>

	<div class="viewing-slot">
		<button
			type="button"
			class="gear"
			data-stage-viewing
			bind:this={gear}
			aria-label="Viewing settings"
			aria-expanded={viewingOpen}
			aria-controls={viewingId}
			title="Viewing settings"
			onclick={() => (viewingOpen = !viewingOpen)}
			onkeydown={onViewingKeydown}
		>
			<span aria-hidden="true">⚙</span>
		</button>
		<!-- Escape closes the panel from any of its controls; the controls themselves are the focus targets. -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			id={viewingId}
			class="viewing"
			role="group"
			aria-label="Viewing settings"
			data-stage-viewing-panel
			hidden={!viewingOpen}
			onkeydown={onViewingKeydown}
		>
			<strong class="group-title">Viewing</strong>
			<label>
				<span>2D appearance</span>
				<select
					value={planAppearance}
					onchange={(event) => onPlanAppearance(event.currentTarget.value as 'paper' | 'shaded')}
				>
					<option value="paper">Paper</option>
					<option value="shaded">Shaded</option>
				</select>
			</label>
			<label>
				<span>Height Sheet</span>
				<select
					value={heightSheetSide}
					onchange={(event) => onHeightSheetSide(event.currentTarget.value as 'left' | 'right')}
				>
					<option value="right">Right</option>
					<option value="left">Left</option>
				</select>
			</label>
			<strong class="group-title">Settings</strong>
			<label class="check">
				<input type="checkbox" checked={reducedMotion} onchange={() => onToggleReducedMotion()} />
				<span>Reduce motion</span>
			</label>
			<label>
				<span>Editor motion speed</span>
				<select
					value={motionSpeed}
					onchange={(event) => onMotionSpeed(event.currentTarget.value as 'slow' | 'normal' | 'fast')}
				>
					<option value="slow">Slow</option>
					<option value="normal">Normal</option>
					<option value="fast">Fast</option>
				</select>
			</label>
		</div>
	</div>
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
	.words {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}
	.reading {
		display: inline-flex;
		overflow: hidden;
		border: 1px solid var(--chassis-hairline, #405d4c);
		border-radius: 0.4rem;
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
	/* The off state is struck through as well as named; the reading segmented
	   control is not a value and keeps its own selected treatment. */
	.words button[aria-pressed='false'] {
		text-decoration: line-through;
		opacity: 0.5;
	}
	button:focus-visible {
		outline: 2px solid #9fd0b4;
		outline-offset: 2px;
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

	/* The ⚙ and its panel: a viewing disclosure, not a drafting control. */
	.viewing-slot {
		position: relative;
	}
	.gear {
		width: 2.25rem;
		padding: 0;
		font-size: 0.95rem;
	}
	/*
		The panel reads the shell's roles (shell-roles.css), not the cluster's chassis
		inks: a mat panel is forest with light ink, and a Paper panel is Paper with forest ink.
	*/
	.viewing {
		position: absolute;
		z-index: 9;
		top: calc(100% + 0.4rem);
		left: 0;
		display: grid;
		gap: 0.5rem;
		width: 16rem;
		padding: 0.75rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.4rem;
		background: var(--shell-forest, #11291f);
		color: var(--shell-ink-light, #f3f4ee);
		box-shadow: 0 0.6rem 1.4rem rgb(6 20 14 / 40%);
		font-size: 0.76rem;
	}
	.viewing[hidden] {
		display: none;
	}
	.viewing label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}
	.viewing label.check {
		justify-content: flex-start;
	}
	.viewing select {
		min-height: 2.1rem;
		padding: 0 0.3rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.35rem;
		background: var(--shell-forest, #11291f);
		color: inherit;
		font: inherit;
	}
	.group-title {
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--shell-ink-quiet, #9fb2a2);
	}

	/* D42: on Paper the words read quietly, never as a dark inverted toolbar. */
	.cluster.quiet {
		--chassis-forest: #f4f0e9;
		--chassis-hairline: #a9b7a9;
	}
	.cluster.quiet button {
		color: #14231b;
	}
	.cluster.quiet button:hover {
		border-color: #4f6b58;
	}
	.cluster.quiet button[aria-pressed='true'] {
		background: #22503c;
		color: #f4f0e9;
	}
	.cluster.quiet button:focus-visible {
		outline-color: #22503c;
	}
	/* On Paper the panel is Paper with forest ink; the selects are white Cards on it. Only shell roles. */
	.cluster.quiet .viewing {
		background: var(--shell-paper, #e9ebe6);
		border-color: var(--shell-ink-quiet, #9fb2a2);
		color: var(--shell-forest, #11291f);
	}
	.cluster.quiet .viewing select {
		border-color: var(--shell-ink-quiet, #9fb2a2);
		background: var(--shell-card, #ffffff);
		color: var(--shell-forest, #11291f);
	}
	.cluster.quiet .group-title {
		color: var(--shell-forest-raised, #22503c);
	}

	/* Touch targets: PLATE requires 44 px under a coarse pointer. */
	@media (pointer: coarse) {
		button {
			min-height: 44px;
			min-width: 44px;
			padding: 0 0.8rem;
		}
		.reading button {
			min-width: 56px;
		}
		.gear {
			width: 44px;
			padding: 0;
		}
		.viewing select {
			min-height: 44px;
		}
	}
</style>
