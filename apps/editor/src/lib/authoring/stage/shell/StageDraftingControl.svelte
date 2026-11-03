<script lang="ts">
	/** Reading and drafting families: light in Plan, dark glass in 3D. The gear holds viewing preferences. */
	import type { StageDraftingPatch, StageDraftingState } from '../stage-drafting';
	import { PAPER_TONES, PAPER_TONE_IDS, type PaperTone } from '../paper-plan';
	import type { AppPreferences } from '$lib/platform/app-preferences';

	type ViewPreferencePatch = Partial<
		Pick<AppPreferences, 'roomLabels2d' | 'roomLabels3d' | 'paperTone2d' | 'paperTone3d'>
	>;

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
		onMotionSpeed = () => {},
		roomLabels2d = true,
		roomLabels3d = false,
		paperTone2d = 'current',
		paperTone3d = 'current',
		onViewPreference = () => {}
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
		/** Review pass 2 §7 — per-view Room labels and Paper tones (view preferences only). */
		roomLabels2d?: boolean;
		roomLabels3d?: boolean;
		paperTone2d?: PaperTone;
		paperTone3d?: PaperTone;
		onViewPreference?: (patch: ViewPreferencePatch) => void;
	} = $props();

	/** One Paper tray open at a time; it stays open until its row is pressed again. */
	let toneTray = $state<'2d' | '3d' | null>(null);

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
		if (target instanceof Element && target.closest('.viewing-slot') === null) { viewingOpen = false; toneTray = null; gear?.focus(); }
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
				{#each [{ view: '2d', word: '2D plan', tone: paperTone2d }, { view: '3d', word: '3D board', tone: paperTone3d }] as row (row.view)}
					<button type="button" class="tone-row" aria-expanded={toneTray === row.view} data-paper-row={row.view}
						onclick={() => (toneTray = toneTray === row.view ? null : (row.view as '2d' | '3d'))}>
						<span>{row.word}</span>
						<span class="tone-now"><i class="swatch" style:background={PAPER_TONES[row.tone].ink}></i>{PAPER_TONES[row.tone].label}<span class="chev" aria-hidden="true">⌄</span></span>
					</button>
					{#if toneTray === row.view}
						<div class="tone-tray" role="group" aria-label={`${row.word} paper tone`}>
							{#each PAPER_TONE_IDS as tone (tone)}
								<button type="button" class="tile" aria-pressed={row.tone === tone} data-paper-tone={tone}
									onclick={() => onViewPreference(row.view === '2d' ? { paperTone2d: tone } : { paperTone3d: tone })}>
									<i class="paper" style:background-color={PAPER_TONES[tone].ink}></i>
									<span>{PAPER_TONES[tone].label}</span>
								</button>
							{/each}
						</div>
					{/if}
				{/each}
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
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 13px;
		background: #fff;
		color: var(--shell-ink-2, #4a524c);
	}
	.viewing .switch[aria-checked='true'] {
		border-color: var(--shell-ink, #1b201c);
		background: var(--shell-ink, #1b201c);
		color: #fff;
	}
	.viewing .tone-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 0 4px;
		color: var(--shell-ink, #1b201c);
	}
	.viewing .tone-row:hover {
		background: var(--shell-hover, #eef0ed);
	}
	.tone-now {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--shell-ink-2, #4a524c);
	}
	.swatch {
		width: 14px;
		height: 14px;
		border: 1px solid rgb(27 32 28 / 0.25);
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
		color: var(--shell-ink-2, #4a524c);
		font-size: 11px;
		white-space: normal;
	}
	.tile .paper {
		display: block;
		height: 44px;
		border: 1px solid rgb(27 32 28 / 0.18);
		border-radius: 6px;
		/* The tone's own grid, so the tile reads as Paper rather than a flat chip. */
		background-image: linear-gradient(rgb(27 32 28 / 0.09) 1px, transparent 1px),
			linear-gradient(90deg, rgb(27 32 28 / 0.09) 1px, transparent 1px);
		background-size: 8px 8px;
	}
	.tile[aria-pressed='true'] .paper {
		outline: 2px solid var(--shell-ink, #1b201c);
		outline-offset: 1px;
	}
	/* The 2D|3D segment's pressed fill must not reach the panel's own controls. */
	.reading .viewing .tile[aria-pressed='true'] {
		background: transparent;
		color: var(--shell-ink, #1b201c);
		font-weight: 600;
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
