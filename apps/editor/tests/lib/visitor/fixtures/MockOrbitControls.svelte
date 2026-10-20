<script lang="ts">
	let {
		target = null,
		enableDamping = false
	}: { target?: unknown; enableDamping?: boolean } = $props();
</script>

<span hidden data-target={String(target)} data-damping={String(enableDamping)}></span>
