<script lang="ts">
	/**
	 * The destination end of Place copy in World: what is being placed, where it came
	 * from, and the way back. Presentation only: the saved object project and its
	 * My Objects item are untouched whatever the creator does here, and nothing in the
	 * destination is written until the creator clicks into position.
	 */
	let {
		name,
		armed,
		onReturn,
		onDismiss
	}: {
		name: string;
		/** The placement is still waiting for the creator's click. */
		armed: boolean;
		onReturn: () => void;
		onDismiss: () => void;
	} = $props();
</script>

<div class="transfer-strip" role="region" aria-label="Place copy in World" data-transfer-strip data-armed={armed}>
	<span class="words" role="status">
		{#if armed}
			Placing a copy of <strong>{name}</strong>. Click where it goes.
		{:else}
			Placement of <strong>{name}</strong> stopped. Your saved object is unchanged.
		{/if}
	</span>
	<span class="actions">
		<button type="button" class="primary" data-transfer-action="return" onclick={onReturn}>Return to object</button>
		{#if !armed}
			<button type="button" data-transfer-action="dismiss" onclick={onDismiss}>Stay here</button>
		{/if}
	</span>
</div>

<style>
	.transfer-strip {
		position: absolute;
		top: calc(var(--shell-head-height) + 8px);
		left: 50%;
		z-index: 31;
		transform: translateX(-50%);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 14px;
		max-width: min(40rem, calc(100% - 1.5rem));
		padding: 6px 8px 6px 14px;
		border: 1px solid var(--shell-hairline);
		border-radius: 14px;
		background: var(--shell-popover);
		box-shadow: var(--shell-shadow);
		color: var(--shell-ink);
		font-size: 12.5px;
	}
	.words strong {
		max-width: 14rem;
		display: inline-block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		vertical-align: bottom;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-left: auto;
	}
	button {
		min-height: 30px;
		padding: 4px 10px;
		border: 1px solid var(--shell-field-line);
		border-radius: 9px;
		background: var(--shell-field);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button.primary {
		border-color: transparent;
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
	}
	button:focus-visible {
		outline: 2px solid var(--shell-focus, currentColor);
		outline-offset: 2px;
	}
	@media (pointer: coarse) {
		button { min-height: 44px; padding: 6px 14px; }
	}
	@media (max-width: 640px) {
		.transfer-strip {
			top: auto;
			bottom: calc(76px + env(safe-area-inset-bottom, 0px));
			width: calc(100% - 1rem);
		}
		.actions { margin-left: 0; width: 100%; }
	}
</style>
