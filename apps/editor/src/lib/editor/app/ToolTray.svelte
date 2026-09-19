<!--
	P23.14 §11 — the Tool Tray: a 44 px vertical INSTRUMENT rail attached
	directly to the Paper edge. It is not a second sidebar and must not become
	one, so it holds only the current surface's tool vocabulary — engraved
	group labels plus compact icon-led tools (7 px / 8 px, the reference's
	micro-tier; see the TYPE note in controls.css), one presentation of the
	same toolbar component the View Bar uses for utilities.

	The rail chrome lives in styles/controls.css under `.project-editor
	.tool-tray` (the same shell-scoped grammar file that styles the View Bar
	tracks), so every theme resolves it through tokens and the frozen relic —
	which mounts the floating form of the same toolbars — is untouched.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { label, children }: { label: string; children: Snippet } = $props();
</script>

<aside class="tool-tray" aria-label={label}>
	{@render children()}
</aside>
