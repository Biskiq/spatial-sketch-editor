import type { ComponentProps } from 'svelte';
import type StagePaintTray from '../stage/shell/StagePaintTray.svelte';
import type LibraryMaterialEditor from '../library/LibraryMaterialEditor.svelte';
import type MaterialImportSheet from '../library/MaterialImportSheet.svelte';
import type StageFinishAlign from '../stage/shell/StageFinishAlign.svelte';
import type StageRepairDrawer from '../stage/shell/StageRepairDrawer.svelte';
import type { RegionProps } from '../workspace/region-ownership';

export type PaintAppearanceProps = ComponentProps<typeof StagePaintTray>;
export type PaintChip = NonNullable<RegionProps['toolbars']['world']>['paintChip'];
export type MaterialEditorProps = ComponentProps<typeof LibraryMaterialEditor>;
export type ImportSheetProps = ComponentProps<typeof MaterialImportSheet>;
export type AlignProps = ComponentProps<typeof StageFinishAlign>;
export type RepairProps = ComponentProps<typeof StageRepairDrawer>;

/** The World placements Appearance owns, in today's mount order. */
export type AppearanceWorldView = {
	readonly importSheet: ImportSheetProps | null;
	readonly align: AlignProps | null;
	readonly materialEditor: MaterialEditorProps | null;
	readonly paint: PaintAppearanceProps | null;
};

/** The surfaces Appearance shares with other workspaces. */
export type AppearanceSharedView = {
	readonly previewing: boolean;
	readonly repair: RepairProps | null;
};
