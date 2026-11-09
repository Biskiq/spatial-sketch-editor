<script lang="ts">
	let { size = 22 }: { size?: number } = $props();
</script>

<svg
	class="mark"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	aria-hidden="true"
	focusable="false"
>
	<path d="M8.6 18.6c0-6.4 4.2-10.8 12-11.4-.4 7.6-5 11.4-12 11.4z" fill="var(--brand-mark-leaf)" />
	<path d="M3.4 3.4v17.2h17.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
	<path d="M3.4 9.4 14.6 20.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".55" />
	<path d="M8.6 18.6c3.2-3.4 6.6-6.8 10-9.6" fill="none" stroke="var(--brand-mark-ink)" stroke-width="1.1" stroke-linecap="round" opacity=".55" />
</svg>
