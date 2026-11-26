<script lang="ts">
	/**
	 * The Stage's viewing preferences disclosure: its ⚙, the panel it opens and
	 * the one Paper tray inside it. Open state, the tray and focus return are
	 * local to this panel; every preference is read and written through a prop.
	 */
	import type { AppPreferences } from '$lib/platform/app-preferences';
	import { PAPER_TONES, PAPER_TONE_IDS, type PaperTone } from '../paper-plan';

	type ViewPreferencePatch = Partial<
		Pick<AppPreferences, 'roomLabels2d' | 'roomLabels3d' | 'paperTone2d' | 'paperTone3d'>
	>;

	let {
		open = $bindable(false),
		roomLabels2d = true,
		roomLabels3d = false,
		onViewPreference = () => {},
		paperTone3d = 'current',
		heightSheetSide = 'right',
		onHeightSheetSide = () => {},
		studioWhileEditing = false,
		onStudioWhileEditing,
		reducedMotion = false,
		onToggleReducedMotion = () => {},
		motionSpeed = 'normal',
		onMotionSpeed = () => {}
	}: {
		open?: boolean;
		roomLabels2d?: boolean;
		roomLabels3d?: boolean;
		onViewPreference?: (patch: ViewPreferencePatch) => void;
		paperTone3d?: PaperTone;
		heightSheetSide?: 'left' | 'right';
		onHeightSheetSide?: (side: 'left' | 'right') => void;
		studioWhileEditing?: boolean;
		onStudioWhileEditing?: (value: boolean) => void;
		reducedMotion?: boolean;
		onToggleReducedMotion?: () => void;
		motionSpeed?: 'slow' | 'normal' | 'fast';
		onMotionSpeed?: (value: 'slow' | 'normal' | 'fast') => void;
	} = $props();

	/** One Paper tray open at a time; it stays open until its row is pressed again. */
	let toneTray = $state<'2d' | '3d' | null>(null);
	let gear: HTMLButtonElement | undefined;
	const viewingId = $props.id();

	function closeViewing(returnFocus = false): void {
		open = false;
		toneTray = null;
		if (returnFocus) gear?.focus();
	}

	function toggleViewing(): void {
		if (open) {
			closeViewing(true);
			return;
		}
		open = true;
	}

	/** Escape closes the panel and returns focus to its ⚙, and stops there so the Stage keeps its own Escape. */
	function onViewingKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape' || !open) return;
		event.stopPropagation();
		closeViewing(true);
	}

	/**
	 * A press outside the ⚙ and its panel closes the panel, as the Head's disclosures do.
	 * It listens in the capture phase: the Stage's bar stops pointerdown below it,
	 * and a press on another bar control must still close the panel.
	 */
	function onWindowPointerDown(event: PointerEvent): void {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (open && target.closest('.viewing-slot') === null) closeViewing(true);
	}
</script>

<svelte:window onpointerdowncapture={onWindowPointerDown} />

<button
	type="button"
	class="gear"
	data-stage-viewing
	bind:this={gear}
	aria-label="Viewing settings"
	aria-expanded={open}
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
	hidden={!open}
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
	{#if onStudioWhileEditing}
		<label class="check">
			<input type="checkbox" checked={studioWhileEditing} onchange={(event) => onStudioWhileEditing?.(event.currentTarget.checked)} />
			<span>Studio light while editing · this browser</span>
		</label>
	{/if}
	<label class="check">
		<input type="checkbox" data-reduce-motion checked={reducedMotion} onchange={() => onToggleReducedMotion()} />
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

<style>
	/* The bar's base control treatment, repeated because this panel is its own component. */
	.gear,
	.viewing button {
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
	.gear:hover:not(:disabled):not([aria-pressed='true']) {
		background: var(--shell-on-forest-wash);
	}
	.gear:disabled,
	.viewing button:disabled {
		color: var(--shell-ink-quiet);
		opacity: var(--shell-control-disabled-opacity);
		cursor: default;
	}
	.gear:focus-visible,
	.viewing button:focus-visible,
	.viewing select:focus-visible,
	.viewing input:focus-visible {
		outline: var(--shell-focus-ring);
		outline-offset: 1px;
	}
	.gear {
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
	@media (pointer: coarse) {
		.gear,
		.viewing button,
		.viewing select {
			min-width: 44px;
			min-height: 44px;
		}
		.gear {
			min-width: 44px;
			width: 44px;
		}
	}
</style>
