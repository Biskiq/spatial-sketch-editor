<script lang="ts">
	import LibraryWorldRegion from '$lib/authoring/library/LibraryWorldRegion.svelte';
	import AppearanceWorldRegions from '$lib/authoring/look/AppearanceWorldRegions.svelte';
	import type { ComponentProps } from 'svelte';

	type Library = ComponentProps<typeof LibraryWorldRegion>;
	type Appearance = ComponentProps<typeof AppearanceWorldRegions>;

	let {
		libraryView,
		importSheet,
		align,
		materialEditor,
		paint
	}: {
		libraryView: Library['view'];
		importSheet: Appearance['importSheet'];
		align: Appearance['align'];
		materialEditor: Appearance['materialEditor'];
		paint: Appearance['paint'];
	} = $props();
</script>

<LibraryWorldRegion view={libraryView} />

<AppearanceWorldRegions {importSheet} {align} {materialEditor} {paint} />
