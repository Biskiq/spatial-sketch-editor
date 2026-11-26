<script lang="ts">
	let { label, onOpen }: { label: string; onOpen: () => void } = $props();
</script>

<button type="button" class="location" data-head-location title={label} onclick={onOpen}>{label}</button>

<style>
	button {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		gap: 4px;
		min-height: 24px;
		padding: 0 7px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button:hover {
		background: var(--shell-on-forest-wash-strong);
	}
	.location {
		order: 1;
		height: 28px;
		max-width: 320px;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: var(--shell-text-utility);
		background: var(--shell-on-forest-wash);
	}
	@media (max-width: 1100px) {
		.location {
			max-width: 180px;
		}
	}
	@media (max-width: 860px) {
		.location {
			flex: 0 1 130px;
			max-width: 130px;
		}
	}
	@media (pointer: coarse) {
		.location { min-width: 44px; min-height: 44px; }
	}
</style>
