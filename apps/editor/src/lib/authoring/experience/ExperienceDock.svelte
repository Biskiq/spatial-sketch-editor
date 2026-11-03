<script lang="ts">
	/**
	 * The Experience lower-edge dock (R217.S25): Select, Place a View, Path, Capture and Guide,
	 * in the same forest bar and key grammar as the World dock. Place a View and Path are
	 * placeholders for capabilities that arrive later, so they are disabled keys with their
	 * reason in title and in a hidden description. Capture submits through the controller's
	 * one acceptance port; Guide opens or closes the invoked Guide instrument above it. It
	 * holds no state: the route passes the open flag and the handlers.
	 */
	import ShellIcon from '../stage/shell/ShellIcon.svelte';

	let {
		captureDisabled = false,
		captureReason,
		guideOpen = false,
		onCapture,
		onToggleGuide
	}: {
		captureDisabled?: boolean;
		captureReason?: string;
		guideOpen?: boolean;
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
		<ShellIcon name="select" size={18} />
	</button>
	<button
		type="button"
		class="key"
		disabled
		aria-label="Place a View"
		title="Comes with View placement"
		aria-describedby="experience-dock-place-view-reason"
		data-dock-tool="place-view"
	>
		<ShellIcon name="camera" size={18} />
	</button>
	{#if guideOpen}
		<button
			type="button"
			class="key"
			disabled
			aria-label="Path"
			title="Comes with path editing"
			aria-describedby="experience-dock-path-reason"
			data-dock-tool="path"
		>
			<ShellIcon name="path" size={18} />
		</button>
	{/if}
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
		<ShellIcon name="capture" size={18} />
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
		<ShellIcon name="guide" size={18} />
		<span class="label">Guide</span>
	</button>
	<span id="experience-dock-place-view-reason" class="visually-hidden">Comes with View placement</span>
	{#if guideOpen}
		<span id="experience-dock-path-reason" class="visually-hidden">Comes with path editing</span>
	{/if}
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
	/* Labeled keys carry their word beside the icon, so the key widens to fit it. */
	.key.labeled {
		grid-auto-flow: column;
		gap: 6px;
		width: auto;
		padding: 0 10px;
		font-size: 13px;
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
		background: rgb(243 240 228 / 0.16);
	}
	.key:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.key:focus-visible {
		outline: 2px solid var(--shell-gold, #d4ad45);
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
			height: var(--shell-touch-target, 44px);
			width: var(--shell-touch-target, 44px);
		}
		.key.labeled {
			width: auto;
		}
	}
</style>
