<script lang="ts">
	/**
	 * The Experience lower-edge dock (R217.S25): Select, Capture and Guide, in the same
	 * forest bar and key grammar as the World dock. Capture submits through the controller's
	 * one acceptance port; Guide opens or closes the invoked Guide instrument above it. It
	 * holds no state: the route passes the open flag and the handlers.
	 */
	import ShellIcon from '../stage/shell/ShellIcon.svelte';

	let {
		captureDisabled = false,
		guideOpen = false,
		onCapture,
		onToggleGuide
	}: {
		captureDisabled?: boolean;
		guideOpen?: boolean;
		onCapture: () => void;
		onToggleGuide: () => void;
	} = $props();
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
		<ShellIcon name="select" size={18} />
	</button>
	<button
		type="button"
		class="key"
		aria-label="Capture"
		title="Capture: what you see becomes a View"
		disabled={captureDisabled}
		data-dock-tool="capture"
		onclick={onCapture}
	>
		<ShellIcon name="capture" size={18} />
	</button>
	<span class="separator" aria-hidden="true"></span>
	<button
		type="button"
		class="key"
		aria-pressed={guideOpen}
		aria-label="Guide"
		title="Guide: Stop composition, transitions and playback"
		data-dock-tool="guide"
		onclick={onToggleGuide}
	>
		<ShellIcon name="guide" size={18} />
	</button>
</nav>

<style>
	.dock {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 4px;
		border: 1px solid rgb(255 255 255 / 0.09);
		border-radius: 14px;
		background: rgba(17, 41, 31, 0.95);
		color: #e6ece6;
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.05),
			0 10px 28px rgb(0 0 0 / 0.28);
		backdrop-filter: blur(8px);
	}
	.separator {
		width: 1px;
		align-self: stretch;
		margin: 6px 4px;
		background: rgb(255 255 255 / 0.14);
	}
	.key {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	.key:hover {
		background: rgb(255 255 255 / 0.08);
	}
	.key.armed {
		background: var(--shell-ivory, #f3f0e4);
		color: var(--shell-forest, #11291f);
		box-shadow: 0 1px 3px #0004;
	}
	/* Guide open is a pressed key, not a second armed tool: Select stays the one armed key. */
	.key[aria-pressed='true']:not(.armed) {
		background: rgb(255 255 255 / 0.16);
	}
	.key:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.key:focus-visible {
		outline: 2px solid var(--shell-gold, #d4ad45);
		outline-offset: 1px;
	}
	@media (pointer: coarse) {
		.key {
			width: var(--shell-touch-target, 44px);
			height: var(--shell-touch-target, 44px);
		}
	}
</style>
