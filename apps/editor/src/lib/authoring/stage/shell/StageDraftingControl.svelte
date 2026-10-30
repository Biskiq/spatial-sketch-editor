<script lang="ts">
	/**
	 * R217.S13 — PLATE's **drafting cluster** in the Stage's top-left furniture slot.
	 *
	 * The cluster is one reading control and two words, never a toolbar of domain
	 * tools:
	 *
	 * - **2D | 3D** is the segmented reading control; it requests the existing
	 *   `set-reading` viewing intent, so it neither composes a pose nor refits.
	 * - **Grid** and **Snap** toggle their one fact and say it in words; a held
	 *   Alt/Option is reported as `Snap held`, never by colour alone. Their values
	 *   are fixed, so zoom can only thin the drawing.
	 *
	 * Scale's detents moved to Find and Fit moved to the lower-right zoom cluster;
	 * the interval menu and ⚙ left with them. Nothing here reaches source, history
	 * or Save.
	 *
	 * Every control is a native button with `aria-pressed`, so keyboard access and
	 * state announcement come from the control itself. Under `pointer: coarse`
	 * every target is at least 44 CSS px.
	 */
	import type { StageDraftingPatch, StageDraftingState } from '../stage-drafting';

	let {
		drafting,
		reading,
		quiet = false,
		gridWord,
		snapWord,
		onReading,
		onPatch
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
	} = $props();
</script>

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
	}
</style>
