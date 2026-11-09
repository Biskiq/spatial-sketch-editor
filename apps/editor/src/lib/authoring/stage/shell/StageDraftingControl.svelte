<script lang="ts">
	/**
	 * The Stage's one viewing bar: reading, Plan appearance, drafting aids,
	 * inspection tools, Sky and the viewing preferences.
	 *
	 * It is a forest instrument on both readings. Every value is state the route
	 * already owns; the bar only groups the controls that used to float apart.
	 */
	import type { Snippet } from 'svelte';
	import type { StageDraftingPatch, StageDraftingState } from '../stage-drafting';
	import { PAPER_TONES, PAPER_TONE_IDS, type PaperTone } from '../paper-plan';
	import type { AppPreferences } from '$lib/platform/app-preferences';
	import ShellIcon from './ShellIcon.svelte';

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
		sky,
		roomLabels2d = true,
		roomLabels3d = false,
		heightSheetSide = 'right',
		onHeightSheetSide = () => {},
		reducedMotion = false,
		onToggleReducedMotion = () => {},
		motionSpeed = 'normal',
		onMotionSpeed = () => {},
		paperTone2d = 'current',
		paperTone3d = 'current',
		onViewPreference = () => {}
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
		/** SkyControl keeps its own state and popover; it is mounted inside this one bar. */
		sky?: Snippet;
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
	} = $props();

	/** One Paper tray open at a time; it stays open until its row is pressed again. */
	let toneTray = $state<'2d' | '3d' | null>(null);
	let viewingOpen = $state(false);
	let gear: HTMLButtonElement | undefined;
	const viewingId = $props.id();

	function closeViewing(returnFocus = false): void {
		viewingOpen = false;
		toneTray = null;
		if (returnFocus) gear?.focus();
	}

	function toggleViewing(): void {
		if (viewingOpen) {
			closeViewing(true);
			return;
		}
		viewingOpen = true;
	}

	/** Escape closes the panel and returns focus to its ⚙, and stops there so the Stage keeps its own Escape. */
	function onViewingKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape' || !viewingOpen) return;
		event.stopPropagation();
		closeViewing(true);
	}

	/**
	 * A press outside the ⚙ and its panel closes the panel, as the Head's disclosures do.
	 * It listens in the capture phase: the Stage's bar stops pointerdown below it,
	 * and a press on another bar control must still close the panel.
	 */
	function onWindowPointerDown(event: PointerEvent): void {
		if (!viewingOpen) return;
		const target = event.target;
		if (target instanceof Element && target.closest('.viewing-slot') === null) closeViewing(true);
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
		<button
			type="button"
			class="icon"
			data-view-slice
			disabled
			aria-label="Slice, planned"
			title="Slice is planned for T1"
		>
			<ShellIcon name="slice" size={15} />
		</button>
	</div>

	{#if sky}
		<span class="divider" aria-hidden="true"></span>
		<div class="sky-slot">{@render sky()}</div>
	{/if}

	<span class="divider" aria-hidden="true"></span>

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
			onclick={toggleViewing}
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
			<div class="pref-row">
				<span>Room labels</span>
				<span class="switches">
					<button type="button" role="switch" class="switch" aria-checked={roomLabels2d} data-room-labels="2d"
						onclick={() => onViewPreference({ roomLabels2d: !roomLabels2d })}>In 2D</button>
					<button type="button" role="switch" class="switch" aria-checked={roomLabels3d} data-room-labels="3d"
						onclick={() => onViewPreference({ roomLabels3d: !roomLabels3d })}>In 3D</button>
				</span>
			</div>
			<strong class="group-title">Paper</strong>
			<!-- One paper colour for the 2D plan and the 3D board; both preferences move together. -->
			<button type="button" class="tone-row" aria-expanded={toneTray !== null} data-paper-row="all"
				onclick={() => (toneTray = toneTray === null ? '3d' : null)}>
				<span>Paper colour</span>
				<span class="tone-now"><i class="swatch" style:background={PAPER_TONES[paperTone3d].ink}></i>{PAPER_TONES[paperTone3d].label}<span class="chev" aria-hidden="true">⌄</span></span>
			</button>
			{#if toneTray !== null}
				<div class="tone-tray" role="group" aria-label="Paper colour">
					{#each PAPER_TONE_IDS as tone (tone)}
						<button type="button" class="tile" aria-pressed={paperTone3d === tone} data-paper-tone={tone}
							onclick={() => onViewPreference({ paperTone2d: tone, paperTone3d: tone })}>
							<i class="paper" style:background-color={PAPER_TONES[tone].ink}></i>
							<span>{PAPER_TONES[tone].label}</span>
						</button>
					{/each}
				</div>
			{/if}
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
	/* Armed is temporary, so it stays a wash and an underline, never the light key. */
	.tools .icon.armed {
		background: var(--shell-tool-armed-bg);
		color: var(--shell-tool-armed-ink);
		box-shadow: var(--shell-press-ring);
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
	.bar button:focus-visible,
	.bar select:focus-visible {
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
	.sky-slot {
		display: flex;
		align-items: center;
	}
	.viewing-slot {
		position: relative;
		display: flex;
	}
	.viewing-slot .gear {
		min-width: 28px;
		width: 28px;
		padding: 0;
		font-size: 14px;
		line-height: 1;
	}
	.viewing {
		position: absolute;
		z-index: 40;
		top: 36px;
		right: 0;
		width: 264px;
		display: grid;
		gap: 8px;
		padding: 12px;
		border: 1px solid var(--shell-hairline);
		border-radius: 14px;
		background: var(--shell-popover);
		color: var(--shell-ink);
		box-shadow: var(--shell-shadow);
	}
	.viewing button {
		color: var(--shell-ink);
	}
	.viewing button:hover:not(:disabled) {
		background: var(--shell-hover);
	}
	.viewing button:focus-visible,
	.viewing select:focus-visible,
	.viewing input:focus-visible {
		outline-color: var(--shell-leaf);
	}
	/* Leaf checkbox in the light Card: shell-drawn, never the browser's blue. */
	.viewing .check input[type='checkbox'] {
		appearance: none;
		-webkit-appearance: none;
		flex: none;
		width: 18px;
		height: 18px;
		margin: 0;
		border: 1.5px solid var(--shell-field-line-strong);
		border-radius: 5px;
		background: var(--shell-field);
		cursor: pointer;
	}
	.viewing .check input[type='checkbox']:checked {
		border-color: var(--shell-leaf);
		background-color: var(--shell-leaf);
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.2 5 8.5 9.5 3.8' fill='none' stroke='white' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-size: 12px 12px;
		background-position: center;
		background-repeat: no-repeat;
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
		background-image: linear-gradient(45deg, transparent 50%, var(--shell-ink-2) 50%), linear-gradient(135deg, var(--shell-ink-2) 50%, transparent 50%);
		background-position: calc(100% - 10px) 50%, calc(100% - 6px) 50%;
		background-size: 4px 4px;
		background-repeat: no-repeat;
		border: 1px solid var(--shell-field-line);
		border-radius: 6px;
		background-color: var(--shell-field);
		color: var(--shell-ink);
		font: inherit;
	}
	.pref-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.switches {
		display: flex;
		gap: 4px;
	}
	.viewing .switch {
		height: 26px;
		padding: 0 9px;
		border: 1px solid var(--shell-field-line);
		border-radius: 13px;
		background: var(--shell-field);
		color: var(--shell-ink-2);
	}
	.viewing .switch[aria-checked='true'] {
		border-color: var(--shell-ink);
		background: var(--shell-ink);
		color: var(--shell-on-action);
	}
	.viewing .tone-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 0 4px;
		color: var(--shell-ink);
	}
	.viewing .tone-row:hover {
		background: var(--shell-hover);
	}
	.tone-now {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--shell-ink-2);
	}
	.swatch {
		width: 14px;
		height: 14px;
		border: 1px solid var(--shell-field-line);
		border-radius: 4px;
	}
	.chev {
		display: inline-block;
		transition: transform 120ms;
	}
	.tone-row[aria-expanded='true'] .chev {
		transform: rotate(180deg);
	}
	.tone-tray {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}
	.viewing .tile {
		display: grid;
		gap: 4px;
		height: auto;
		padding: 4px;
		border-radius: 8px;
		color: var(--shell-ink-2);
		font-size: var(--shell-text-label);
		white-space: normal;
	}
	.tile .paper {
		display: block;
		height: 44px;
		border: 1px solid var(--shell-field-line);
		border-radius: 6px;
		/* The tone's own grid, so the tile reads as Paper rather than a flat chip. */
		background-image: linear-gradient(color-mix(in srgb, var(--shell-ink) 9%, transparent) 1px, transparent 1px),
			linear-gradient(90deg, color-mix(in srgb, var(--shell-ink) 9%, transparent) 1px, transparent 1px);
		background-size: 8px 8px;
	}
	.tile[aria-pressed='true'] .paper {
		outline: 2px solid var(--shell-ink);
		outline-offset: 1px;
	}
	/* The view's pressed fill must not reach the panel's own controls. */
	.viewing .tile[aria-pressed='true'] {
		background: transparent;
		color: var(--shell-ink);
		font-weight: 600;
	}
	.group-title {
		font-size: var(--shell-text-meta);
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--shell-ink-2);
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
		.bar button,
		.viewing .switch,
		.viewing select {
			min-width: 44px;
			min-height: 44px;
		}
		.viewing-slot .gear {
			min-width: 44px;
			width: 44px;
		}
		.divider {
			height: 26px;
		}
	}
</style>
