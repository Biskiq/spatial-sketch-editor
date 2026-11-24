<script lang="ts">
	/**
	 * Appearance's World placements, in today's mount order: Import sheet,
	 * Align, the Library Draft or Finish material Editor, then the Paint tray.
	 * Each session owns its own mount condition; this component adds no DOM.
	 */
	import MaterialImportSheet from '../library/MaterialImportSheet.svelte';
	import LibraryMaterialEditor from '../library/LibraryMaterialEditor.svelte';
	import StageFinishAlign from '../stage/shell/StageFinishAlign.svelte';
	import StagePaintTray from '../stage/shell/StagePaintTray.svelte';
	import type { AlignProps, ImportSheetProps, MaterialEditorProps, PaintAppearanceProps } from './appearance-view';

	let {
		importSheet = null,
		align = null,
		materialEditor = null,
		paint = null
	}: {
		readonly importSheet?: ImportSheetProps | null;
		readonly align?: AlignProps | null;
		readonly materialEditor?: MaterialEditorProps | null;
		readonly paint?: PaintAppearanceProps | null;
	} = $props();
</script>

{#if importSheet !== null}
	<MaterialImportSheet {...importSheet} />
{/if}

{#if align !== null}
	<StageFinishAlign {...align} />
{/if}

{#if materialEditor !== null}
	{#key materialEditor.mode}
		<LibraryMaterialEditor {...materialEditor} />
	{/key}
{/if}

{#if paint !== null}
	<StagePaintTray {...paint} />
{/if}
