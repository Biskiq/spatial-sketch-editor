<script lang="ts">
	/** Reading and drafting families: light in Plan, dark glass in 3D. The gear holds viewing preferences. */
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
		if (target instanceof Element && target.closest('.viewing-slot') === null) { viewingOpen = false; gear?.focus(); }
	}
</script>

<svelte:window onpointerdowncapture={onWindowPointerDown} />

<div
	class="cluster"
	class:quiet={reading === 'plan'}
	data-stage-drafting
	role="group"
	aria-label="Drafting state"
>
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
						onchange={(event) =>
							onMotionSpeed(event.currentTarget.value as 'slow' | 'normal' | 'fast')}
					>
						<option value="slow">Slow</option>
						<option value="normal">Normal</option>
						<option value="fast">Fast</option>
					</select>
				</label>
			</div>
		</div>
	</div>

	<div class="words">
		<button
			type="button"
			data-drafting-grid
			aria-pressed={drafting.grid}
			title="Grid: fixed 1 m and 5 m lines, thinned with zoom"
			onclick={() => onPatch({ grid: !drafting.grid })}
		>
			Grid
		</button>
		<button
			type="button"
			data-drafting-snap
			aria-pressed={drafting.snap}
			aria-describedby="drafting-snap-state"
			title="Snap: fixed 0.5 m increment (hold Alt or Option to suspend)"
			onclick={() => onPatch({ snap: !drafting.snap })}
		>
			{drafting.snap ? (snapWord.includes('held') ? 'Snap held' : 'Snap') : 'Snap'}
		</button>
	</div>
	<!-- The durable aria-pressed is the switch; this polite status names the
	     temporary Alt/Option hold, which would otherwise be visible only in text. -->
	<span id="drafting-snap-state" class="sr-only" role="status" aria-live="polite">{snapWord}</span>
</div>

<style>
	.cluster {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		max-width: calc(100vw - 20px);
		color: #e7ece7;
		font: 12px var(--shell-sans, system-ui);
	}
	.reading,
	.words {
		display: flex;
		align-items: center;
		padding: 2px;
		gap: 1px;
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 9px;
		background: rgba(14, 30, 25, 0.8);
		box-shadow: var(--shell-furniture-shadow);
	}
	button {
		height: 28px;
		min-width: 34px;
		padding: 0 8px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: inherit;
		font: inherit;
		white-space: nowrap;
		cursor: pointer;
	}
	button:hover {
		background: rgb(255 255 255 / 0.08);
	}
	.reading button[aria-pressed='true'] {
		background: var(--shell-forest-raised, #22503c);
		color: #fff;
		font-weight: 600;
	}
	.words {
		padding: 2px;
	}
	.words button {
		height: 26px;
		padding: 0 7px;
		border-radius: 6px;
		min-width: 0;
	}
	.words [aria-pressed='false'] {
		opacity: 0.5;
		text-decoration: line-through;
	}
	.quiet {
		color: var(--shell-ink, #1b201c);
	}
	.quiet .reading,
	.quiet .words {
		background: rgba(255, 255, 255, 0.94);
		border-color: var(--shell-hairline, #e1e4de);
	}
	.quiet button:hover {
		background: var(--shell-hover, #eef0ed);
	}
	.viewing-slot {
		position: relative;
	}
	.reading .gear {
		min-width: 26px;
		width: 26px;
		padding: 0 5px;
	}
	.viewing {
		position: absolute;
		z-index: 20;
		top: 36px;
		left: 0;
		width: 256px;
		display: grid;
		gap: 8px;
		padding: 12px;
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 10px;
		background: var(--shell-card, #fff);
		color: var(--shell-ink, #1b201c);
		border-color: var(--shell-hairline, #e1e4de);
		box-shadow: var(--shell-shadow);
	}
	.viewing[hidden] {
		display: none;
	}
	.viewing label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.viewing select {
		appearance: none;
		min-height: 30px;
		padding: 0 22px 0 8px;
		background-image: linear-gradient(45deg, transparent 50%, #4a524c 50%), linear-gradient(135deg, #4a524c 50%, transparent 50%);
		background-position: calc(100% - 10px) 50%, calc(100% - 6px) 50%;
		background-size: 4px 4px;
		background-repeat: no-repeat;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 6px;
		background-color: var(--shell-control-surface, #fafbf9);
		color: var(--shell-ink, #1b201c);
		font: inherit;
	}
	.group-title {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--shell-ink-2, #4a524c);
	}
	.quiet .viewing {
		background: #fff;
		color: var(--shell-ink, #1b201c);
		border-color: var(--shell-hairline, #e1e4de);
	}
	.quiet .group-title {
		color: var(--shell-ink-3, #79817b);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	@media (pointer: coarse) {
		button,
		.words button,
		.reading .gear,
		select {
			min-width: 44px;
			min-height: 44px;
		}
		.reading,
		.words {
			padding: 0;
		}
		.cluster {
			gap: 6px;
		}
	}
</style>
