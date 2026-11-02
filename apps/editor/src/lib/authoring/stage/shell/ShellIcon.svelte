<script lang="ts">
 import { shellIcons } from './shell-icons';
 let { name, size = 18 }: { name: string; size?: number } = $props();
</script>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{@html shellIcons[name] ?? shellIcons.dot}</svg>
