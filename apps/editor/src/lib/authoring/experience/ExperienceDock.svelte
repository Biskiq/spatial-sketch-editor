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
		/** Place a View is armed on the Stage until Esc or another key. */
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
		<ShellIcon name="select" size={20} />
		<span class="kl">Select</span>
	</button>
	<button
		type="button"
		class="key"
		class:armed={placeArmed}
		aria-pressed={placeArmed}
		aria-label="Place a View"
		title={placeArmed ? 'Place a View: click to place or drag to aim · Esc' : 'Place a View where the camera stands'}
		data-dock-tool="place-view"
		onclick={onPlaceView}
	>
		<ShellIcon name="camera" size={20} />
		<span class="kl">Place a View</span>
	</button>
	<span class="separator" aria-hidden="true"></span>
	<button
		type="button"
		class="key"
		aria-label="Capture"
		title={captureHint}
		disabled={captureDisabled}
		aria-describedby={captureDisabled && captureReason ? 'experience-dock-capture-reason' : undefined}
		data-dock-tool="capture"
		onclick={onCapture}
	>
		<ShellIcon name="capture" size={20} />
		<span class="kl">Capture</span>
	</button>
	<button
		type="button"
		class="key"
		class:engaged={guideOpen}
		aria-pressed={guideOpen}
		aria-label="Guide"
		title="Guide: Stop composition, transitions and playback"
		data-dock-tool="guide"
		onclick={onToggleGuide}
	>
		<ShellIcon name="guide" size={20} />
		<span class="kl">Guide</span>
	</button>
	{#if captureDisabled && captureReason}
		<span id="experience-dock-capture-reason" class="visually-hidden">{captureReason}</span>
	{/if}
</nav>

<style>
	/* The shared dock anatomy (--shell-dock-*), the same chassis and key as the World dock. */
	.dock {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--shell-dock-gap);
		height: var(--shell-dock-height);
		padding: 0 var(--shell-dock-pad-x);
		border-radius: var(--shell-instrument-radius);
		background: var(--shell-forest);
		color: var(--shell-ink-light);
		box-shadow: var(--shell-dock-shadow);
		max-width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
	}
	.separator {
		flex: none;
		width: 1px;
		height: var(--shell-dock-sep-height);
		margin: 0 var(--shell-dock-sep-margin);
		background: var(--shell-line-on-forest);
	}
	.key {
		position: relative;
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: var(--shell-dock-key-min-width);
		height: var(--shell-dock-key-height);
		padding: 0 var(--shell-dock-key-pad-x);
		border: 0;
		border-radius: var(--shell-dock-key-radius);
		background: transparent;
		color: var(--shell-ink-quiet);
		cursor: pointer;
	}
	.kl {
		font: 500 var(--shell-dock-label-size)/1 var(--shell-sans);
		letter-spacing: -0.005em;
		white-space: nowrap;
	}
	.key:hover:not(.armed):not(:disabled) {
		background: var(--shell-on-forest-wash);
		color: var(--shell-ink-light);
	}
	/* Select, and Place a View while it is armed: the one quiet forest-3 key. */
	.key.armed {
		background: var(--shell-tool-armed-bg);
		color: var(--shell-tool-armed-ink);
		box-shadow: var(--shell-tool-armed-edge);
	}
	/* An open panel is engaged, so it wears the same light key as a mode. */
	.key.engaged {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
	}
	.key:disabled {
		opacity: var(--shell-control-disabled-opacity);
		cursor: default;
	}
	.key:focus-visible {
		outline: var(--shell-focus-ring);
		outline-offset: -2px;
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
	@media (max-width: 700px) {
		.key {
			min-width: 44px;
			padding: 0 3px;
		}
	}
</style>
