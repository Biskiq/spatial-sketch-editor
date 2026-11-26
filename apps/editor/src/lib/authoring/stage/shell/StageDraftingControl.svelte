<script lang="ts">
	/**
	 * The Stage's one viewing bar: reading, Plan appearance, drafting aids,
	 * inspection tools, Sky and the viewing preferences.
	 *
	 * It is a forest instrument on both readings. Every value is state the route
	 * already owns; the bar only groups those controls in one place.
	 */
	import type { StageDraftingPatch, StageDraftingState } from '../stage-drafting';
	import type { PaperTone } from '../paper-plan';
	import type { AppPreferences } from '$lib/platform/app-preferences';
	import ShellIcon from './ShellIcon.svelte';
	import StageViewingPanel from './StageViewingPanel.svelte';

	type ViewPreferencePatch = Partial<
		Pick<AppPreferences, 'roomLabels2d' | 'roomLabels3d' | 'paperTone2d' | 'paperTone3d'>
	>;

	let {
		drafting,
		reading,
		gridWord,
		snapWord,
		onReading,
		onPatch,
		planAppearance = 'paper',
		onPlanAppearance = () => {},
		measureActive = false,
		onMeasure = () => {},
		studioWhileEditing = false,
		onStudioWhileEditing,
		roomLabels2d = true,
		roomLabels3d = false,
		heightSheetSide = 'right',
		onHeightSheetSide = () => {},
		reducedMotion = false,
		onToggleReducedMotion = () => {},
		motionSpeed = 'normal',
		onMotionSpeed = () => {},
		paperTone3d = 'current',
		onViewPreference = () => {},
		lift = null,
		nearWalls = null
	}: {
		drafting: StageDraftingState;
		/** The settled reading the segmented control reports. */
		reading: 'plan' | '3d';
		/** The Grid word for the tooltip; the button itself always reads `Grid`. */
		gridWord: string;
		/** The Snap word for the live status; the button itself always reads `Snap`. */
		snapWord: string;
		onReading: (reading: 'plan' | '3d') => void;
		onPatch: (patch: StageDraftingPatch) => void;
		/** The Plan's material: Living shaded surfaces, or the Paper drawing. */
		planAppearance?: 'paper' | 'shaded';
		onPlanAppearance?: (value: 'paper' | 'shaded') => void;
		/** The existing Measure tool; the bar mirror only, never a second controller. */
		measureActive?: boolean;
		onMeasure?: () => void;
		studioWhileEditing?: boolean;
		onStudioWhileEditing?: (value: boolean) => void;
		roomLabels2d?: boolean;
		roomLabels3d?: boolean;
		heightSheetSide?: 'left' | 'right';
		onHeightSheetSide?: (side: 'left' | 'right') => void;
		reducedMotion?: boolean;
		onToggleReducedMotion?: () => void;
		motionSpeed?: 'slow' | 'normal' | 'fast';
		onMotionSpeed?: (value: 'slow' | 'normal' | 'fast') => void;
		/** Review pass 2 §7 — per-view Room labels and Paper tones (view preferences only). */
		paperTone2d?: PaperTone;
		paperTone3d?: PaperTone;
		onViewPreference?: (patch: ViewPreferencePatch) => void;
		/**
		 * The reading control's ▾. X1 has exactly one more reading, Lift, so the menu
		 * carries exactly one item and no disabled or planned ones. Null hides the ▾.
		 */
		lift?: { readonly active: boolean; toggle(): void } | null;
		/**
		 * X2's `Near walls: Cut | Whole`, under Lift in the same ▾. It is a two-way
		 * item group with a default of Cut — never a pill, never a reading, and never
		 * in the Escape ladder. Null hides it.
		 */
		nearWalls?: { readonly mode: 'cut' | 'whole'; set(mode: 'cut' | 'whole'): void } | null;
	} = $props();

	let viewingOpen = $state(false);
	let liftOpen = $state(false);
	let liftMore = $state<HTMLButtonElement>();

	/** A press outside the reading menu closes it. */
	function onWindowPointerDown(event: PointerEvent): void {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (liftOpen && target.closest('.reading-more') === null) liftOpen = false;
	}

	function closeLift(returnFocus = false): void {
		liftOpen = false;
		if (returnFocus) liftMore?.focus();
	}

	function toggleLiftMenu(): void {
		if (liftOpen) {
			closeLift(true);
			return;
		}
		liftOpen = true;
	}

	/** Escape closes the menu first and stops there, so the Stage keeps its own Escape. */
	function onLiftKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape' || !liftOpen) return;
		event.stopPropagation();
		closeLift(true);
	}

	function chooseLift(): void {
		closeLift(true);
		lift?.toggle();
	}
</script>

<svelte:window onpointerdowncapture={onWindowPointerDown} />

<div
	class="bar"
	class:viewing-open={viewingOpen}
	data-stage-drafting
	data-stage-viewing-bar
	role="toolbar"
	aria-label="Stage viewing"
>
	<div class="seg readings" role="group" aria-label="Reading">
		<button
			type="button"
			data-drafting-reading="3d"
			aria-pressed={reading === '3d'}
			title="3D reading (3)"
			onclick={() => onReading('3d')}
		>
			3D
		</button>
		<button
			type="button"
			data-drafting-reading="plan"
			aria-pressed={reading === 'plan'}
			title="Plan reading (2)"
			onclick={() => onReading('plan')}
		>
			Plan
		</button>
		{#if lift !== null}
			<div class="reading-more">
				<button
					type="button"
					class="more"
					data-reading-more
					bind:this={liftMore}
					aria-label="More readings"
					aria-haspopup="menu"
					aria-expanded={liftOpen}
					title="More readings"
					onclick={toggleLiftMenu}
					onkeydown={onLiftKeydown}
				>
					<span aria-hidden="true">▾</span>
				</button>
				<div
					class="reading-menu"
					role="menu"
					tabindex="-1"
					aria-label="More readings"
					hidden={!liftOpen}
					onkeydown={onLiftKeydown}
				>
					<button
						type="button"
						role="menuitemcheckbox"
						aria-checked={lift.active}
						data-reading-lift
						onclick={chooseLift}
					>
						<span>Lift</span>
						{#if lift.active}<span class="check" aria-hidden="true">✓</span>{/if}
					</button>
					{#if nearWalls !== null}
						<div class="menu-group" role="group" aria-label="Near walls">
							<span class="menu-title">Near walls</span>
							<button
								type="button"
								role="menuitemradio"
								aria-checked={nearWalls.mode === 'cut'}
								data-near-walls="cut"
								onclick={() => { nearWalls.set('cut'); closeLift(true); }}
							>
								<span>Cut</span>
								{#if nearWalls.mode === 'cut'}<span class="check" aria-hidden="true">✓</span>{/if}
							</button>
							<button
								type="button"
								role="menuitemradio"
								aria-checked={nearWalls.mode === 'whole'}
								data-near-walls="whole"
								onclick={() => { nearWalls.set('whole'); closeLift(true); }}
							>
								<span>Whole</span>
								{#if nearWalls.mode === 'whole'}<span class="check" aria-hidden="true">✓</span>{/if}
							</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<span class="divider" aria-hidden="true"></span>

	<div class="seg appearances" role="group" aria-label="Plan appearance">
		<button
			type="button"
			data-plan-appearance="living"
			aria-pressed={planAppearance === 'shaded'}
			title="Living surfaces in Plan"
			onclick={() => onPlanAppearance('shaded')}
		>
			<span class="long">Living</span><span class="short" aria-hidden="true">L</span>
		</button>
		<button
			type="button"
			data-plan-appearance="paper"
			aria-pressed={planAppearance === 'paper'}
			title="Paper drawing in Plan"
			onclick={() => onPlanAppearance('paper')}
		>
			<span class="long">Paper</span><span class="short" aria-hidden="true">P</span>
		</button>
	</div>

	<span class="divider" aria-hidden="true"></span>

	<div class="seg toggles" role="group" aria-label="Drafting aids">
		<button
			type="button"
			data-drafting-grid
			aria-pressed={drafting.grid}
			aria-label={`Grid ${drafting.grid ? 'on' : 'off'}`}
			title={`${gridWord}: fixed 1 m and 5 m lines, thinned with zoom`}
			onclick={() => onPatch({ grid: !drafting.grid })}
		>
			<span class="icon-only" aria-hidden="true"><ShellIcon name="grid" size={14} /></span>
			<span class="label">Grid</span>
		</button>
		<button
			type="button"
			data-drafting-snap
			aria-pressed={drafting.snap}
			aria-label={drafting.snap ? 'Snap on' : 'Snap off'}
			aria-describedby="drafting-snap-state"
			title="Snap: fixed 0.5 m increment (hold Alt or Option to suspend)"
			onclick={() => onPatch({ snap: !drafting.snap })}
		>
			<span class="icon-only" aria-hidden="true"><ShellIcon name="snap" size={14} /></span>
			<span class="label">Snap</span>
		</button>
	</div>

	<span class="divider" aria-hidden="true"></span>

	<div class="seg tools" role="group" aria-label="Inspection tools">
		<button
			type="button"
			class="icon"
			class:armed={measureActive}
			data-view-measure
			aria-pressed={measureActive}
			aria-label="Measure"
			title="Measure (M)"
			onclick={onMeasure}
		>
			<ShellIcon name="measure" size={15} />
		</button>
	</div>



	<span class="divider" aria-hidden="true"></span>

	<div class="viewing-slot">
		<StageViewingPanel
			bind:open={viewingOpen}
			{roomLabels2d}
			{roomLabels3d}
			{onViewPreference}
			{paperTone3d}
			{heightSheetSide}
			{onHeightSheetSide}
			{studioWhileEditing}
			{onStudioWhileEditing}
			{reducedMotion}
			{onToggleReducedMotion}
			{motionSpeed}
			{onMotionSpeed}
		/>
	</div>
</div>

<!-- The durable aria-pressed is the switch; this polite status names the
     temporary Alt/Option hold, which would otherwise be visible only in text. -->
<span id="drafting-snap-state" class="sr-only" role="status" aria-live="polite">{snapWord}</span>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 2px;
		max-width: min(680px, calc(100vw - 20px));
		padding: 3px;
		border: 1px solid var(--shell-line-on-forest);
		border-radius: 10px;
		background: var(--shell-dock-surface);
		box-shadow: var(--shell-furniture-shadow);
		backdrop-filter: blur(8px);
		color: var(--shell-ink-light);
		font: var(--shell-text-control) var(--shell-sans);
	}
	.seg {
		display: flex;
		align-items: center;
		gap: 1px;
	}
	.bar button {
		height: 28px;
		min-width: 30px;
		padding: 0 7px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--shell-ink-light);
		font: inherit;
		white-space: nowrap;
		cursor: pointer;
	}
	/* Engaged controls keep their light key on hover; only idle controls wash. */
	.bar button:hover:not(:disabled):not([aria-pressed='true']) {
		background: var(--shell-on-forest-wash);
	}
	/*
	 * One engaged treatment for every settled control: readings, appearance,
	 * Grid and Snap. Weight never changes, so a toggle cannot resize the bar,
	 * and each toggle's word is constant in both states.
	 */
	.readings button {
		min-width: 38px;
	}
	.appearances button {
		min-width: 50px;
	}
	.toggles button {
		justify-content: flex-start;
		gap: 6px;
		min-width: 64px;
		padding: 0 8px;
	}
	.readings button[aria-pressed='true'],
	.appearances button[aria-pressed='true'],
	.toggles button[aria-pressed='true'] {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
	}
	.toggles button[aria-pressed='false'] {
		color: var(--shell-ink-quiet);
	}
	.tools .icon {
		position: relative;
		display: grid;
		place-items: center;
		width: 28px;
		padding: 0;
	}
	/* Armed is the shared forest-3 step (D12), never the light engaged key. */
	.tools .icon.armed {
		background: var(--shell-tool-armed-bg);
		color: var(--shell-tool-armed-ink);
		box-shadow: var(--shell-tool-armed-edge);
	}
	.tools .icon.armed::after {
		content: '';
		position: absolute;
		right: 8px;
		bottom: 3px;
		left: 8px;
		height: 2px;
		border-radius: 1px;
		background: var(--shell-ivory);
		opacity: 0.8;
	}
	.bar button:disabled {
		color: var(--shell-ink-quiet);
		opacity: var(--shell-control-disabled-opacity);
		cursor: default;
	}
	.bar button:focus-visible {
		outline: var(--shell-focus-ring);
		outline-offset: 1px;
	}
	.divider {
		flex: none;
		width: 1px;
		height: 18px;
		margin: 0 4px;
		background: var(--shell-line-on-forest);
	}
	.icon-only {
		display: none;
	}
	.short {
		display: none;
	}
	.viewing-slot {
		position: relative;
		display: flex;
	}
	.reading-more {
		position: relative;
		display: flex;
	}
	.reading-more .more {
		min-width: 20px;
		width: 20px;
		padding: 0;
		font-size: 11px;
		line-height: 1;
	}
	.reading-menu {
		position: absolute;
		z-index: 40;
		top: 36px;
		left: 0;
		min-width: 132px;
		padding: 4px;
		border: 1px solid var(--shell-hairline);
		border-radius: 10px;
		background: var(--shell-popover);
		color: var(--shell-ink);
		box-shadow: var(--shell-shadow);
	}
	.reading-menu[hidden] {
		display: none;
	}
	.reading-menu button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		color: var(--shell-ink);
	}
	.reading-menu button:hover:not(:disabled) {
		background: var(--shell-hover);
	}
	.reading-menu .check {
		color: var(--shell-leaf);
	}
	.reading-menu .menu-group {
		display: grid;
		gap: 1px;
		margin-top: 4px;
		padding-top: 4px;
		border-top: 1px solid var(--shell-hairline);
	}
	.reading-menu .menu-title {
		padding: 2px 7px 3px;
		color: var(--shell-ink-quiet);
		font: var(--shell-text-control) var(--shell-sans);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	@media (max-width: 700px) {
		.label {
			display: none;
		}
		.toggles button {
			justify-content: center;
			gap: 0;
			min-width: 28px;
			padding: 0;
		}
		.icon-only {
			display: inline-flex;
		}
		.divider {
			margin: 0 2px;
		}
	}
	@media (max-width: 820px) {
		.long {
			display: none;
		}
		.short {
			display: inline;
		}
		.appearances button {
			min-width: 26px;
			padding: 0 5px;
		}
	}
	@media (pointer: coarse) {
		.bar {
			padding: 0;
		}
		.bar button {
			min-width: 44px;
			min-height: 44px;
		}
		.divider {
			height: 26px;
		}
	}
</style>
