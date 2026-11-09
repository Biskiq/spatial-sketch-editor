<script lang="ts">
	import ShellIcon from '../stage/shell/ShellIcon.svelte';

	let {
		captureDisabled = false,
		captureReason,
		guideOpen = false,
		placeArmed = false,
		onPlaceView,
		onCapture,
		onToggleGuide
	}: {
		captureDisabled?: boolean;
		captureReason?: string;
		guideOpen?: boolean;
		/** S28: Place a View is armed on the Stage until Esc or another key. */
		placeArmed?: boolean;
		onPlaceView?: () => void;
		onCapture: () => void;
		onToggleGuide: () => void;
	} = $props();

	const captureHint = $derived(
		captureDisabled && captureReason ? captureReason : 'Capture: what you see becomes a View'
	);
</script>

<nav class="dock" aria-label="Experience dock" data-experience-dock>
	<button
		type="button"
		class="key armed"
		aria-pressed="true"
		aria-label="Select"
		title="Select: the pointer selects subjects on the Stage"
		data-dock-tool="select"
	>
		<ShellIcon name="select" size={16} />
	</button>
	<button
		type="button"
		class="key"
		class:place-armed={placeArmed}
		aria-pressed={placeArmed}
		aria-label="Place a View"
		title={placeArmed ? 'Place a View: click to place or drag to aim · Esc' : 'Place a View where the camera stands'}
		data-dock-tool="place-view"
		onclick={onPlaceView}
	>
		<ShellIcon name="camera" size={16} />
	</button>
	<span class="separator" aria-hidden="true"></span>
	<button
		type="button"
		class="key labeled"
		aria-label="Capture"
		title={captureHint}
		disabled={captureDisabled}
		aria-describedby={captureDisabled && captureReason ? 'experience-dock-capture-reason' : undefined}
		data-dock-tool="capture"
		onclick={onCapture}
	>
		<ShellIcon name="capture" size={16} />
		<span class="label">Capture</span>
	</button>
	<button
		type="button"
		class="key labeled"
		aria-pressed={guideOpen}
		aria-label="Guide"
		title="Guide: Stop composition, transitions and playback"
		data-dock-tool="guide"
		onclick={onToggleGuide}
	>
		<ShellIcon name="guide" size={16} />
		<span class="label">Guide</span>
	</button>
	{#if captureDisabled && captureReason}
		<span id="experience-dock-capture-reason" class="visually-hidden">{captureReason}</span>
	{/if}
</nav>

<style>
	.dock {
		position: relative;
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 4px;
		border: 1px solid var(--shell-line-on-forest);
		border-radius: 14px;
		background: var(--shell-dock-surface);
		color: var(--shell-ink-light);
		box-shadow:
			inset 0 1px 0 var(--shell-on-forest-wash),
			0 10px 28px rgb(0 0 0 / 0.28);
		backdrop-filter: blur(8px);
	}
	.separator {
		width: 1px;
		align-self: stretch;
		margin: 6px 4px;
		background: var(--shell-line-on-forest);
	}
	.key {
		position: relative;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: 0;
		border-radius: 9px;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	/* Labeled keys carry their word beside the icon, so the key widens to fit it. */
	.key.labeled {
		grid-auto-flow: column;
		gap: 6px;
		width: auto;
		padding: 0 9px;
		font: 500 var(--shell-text-control)/1 var(--shell-sans);
	}
	.key:hover {
		background: var(--shell-on-forest-wash);
	}
	.key.armed {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
		box-shadow: 0 1px 3px #0004;
	}
	/* Place a View is a temporary arm, not a second Select: a wash and an underline. */
	.key.place-armed {
		background: var(--shell-tool-armed-bg);
		color: var(--shell-tool-armed-ink);
		box-shadow: var(--shell-press-ring);
	}
	.key.place-armed::after {
		content: '';
		position: absolute;
		right: 10px;
		bottom: 4px;
		left: 10px;
		height: 2px;
		border-radius: 1px;
		background: var(--shell-tool-armed-ink);
		opacity: 0.8;
	}
	/* An open panel is engaged, so it wears the same light key as a mode. */
	.key[aria-pressed='true']:not(.armed):not(.place-armed) {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
	}
	.key:disabled {
		opacity: var(--shell-control-disabled-opacity);
		cursor: default;
	}
	.key:focus-visible {
		outline: var(--shell-focus-ring);
		outline-offset: 1px;
	}
	.visually-hidden {
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
	@media (pointer: coarse) {
		.key {
			height: var(--shell-touch-target);
			width: var(--shell-touch-target);
		}
		.key.labeled {
			width: auto;
		}
	}
</style>
