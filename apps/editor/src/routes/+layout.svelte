<script lang="ts">
	/*
	 * App-level presentation roles. Declared once at `:root` so the editor shell,
	 * the landing and login pages, Projects and the visitor surfaces all consume
	 * the same roles; the editor's `.editor-host` only consumes them.
	 */
	import '$lib/design/presentation-tokens.css';

	let { children } = $props();
</script>

{@render children()}
