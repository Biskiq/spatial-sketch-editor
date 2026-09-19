<script lang="ts">
	// Sidebar shell. Replaces the workspace-switching
	// `EditorLeftSidebar` in the editor shell (the relic keeps its own sidebar
	// byte-for-byte). One unified hierarchy is always mounted; Scene Plan and
	// Scene 3D expose a Hierarchy | Assets tab row (reusing `store.leftPanel`). The
	// layout-preview summary's counts are replaced by the tree's own rows; the
	// source/status badge + import error move to a compact header strip, hidden
	// for the common boot-empty case. "Reset empty" is dropped (it duplicated
	// the Project menu's resetLayout).
	import type { Asset } from '$lib/types/assets';
	import type { SceneTextureAsset } from '$lib/content/scene';
	import type { ProjectAssetMetadata } from '$lib/editor/project-persistence';
	import { BinaryTextureStore } from '$lib/editor/store/binary-texture-store.svelte';
	import EditorAssetLibrary from '$lib/editor/EditorAssetLibrary.svelte';
	import {
		layoutPreviewDocument,
		layoutPreviewSessionStatus,
		layoutPreviewSourceLabel,
		type LayoutPreviewState
	} from '$lib/editor/layout/layout-preview-state.svelte';
	import { setLayoutDraftTool, setPlanViewMode, type LayoutInteractionState } from '$lib/editor/layout/layout-interaction';
	import type { EditorStore } from '$lib/editor/editor-store.svelte';
	import type { EditorContextMenuStore } from '$lib/editor/context-menu/context-menu-state.svelte';
	import UnifiedProjectTree from '$lib/editor/UnifiedProjectTree.svelte';
	import { resolveRovingIndex, tablistTabIndex } from './roving-focus';
	import CameraSidebar from './CameraSidebar.svelte';
	import type { EditorActiveSelectionStore } from './active-editor-selection.svelte';
	import type { EditorViewState } from './editor-view-state.svelte';

	let {
		store,
		layoutPreview,
		layoutInteraction,
		activeSelection,
		viewState,
		outlinerElement = $bindable(),
		onAssetSelection,
		onSelectAsset,
		projectAssets = [],
		projectAssetsStatus = 'unavailable',
		retryableProjectAssetId = null,
		retryableProjectTextureId = null,
		onUploadProjectTexture,
		onRetryProjectTexture,
		onAcceptProjectTexture,
		canConvertProjectTexture,
		onConvertProjectTexture,
		onProjectTextureFileSelected,
		contextMenu = null,
		collapsed = false
	}: {
		store: EditorStore;
		layoutPreview: LayoutPreviewState;
		layoutInteraction: LayoutInteractionState;
		activeSelection: EditorActiveSelectionStore;
		viewState: EditorViewState;
		outlinerElement?: HTMLElement | null;
		onAssetSelection?: (asset: Asset | undefined) => void;
		onSelectAsset?: (asset: Asset) => void;
		projectAssets?: readonly ProjectAssetMetadata[];
		projectAssetsStatus?: 'unavailable' | 'loading' | 'ready' | 'error';
		retryableProjectAssetId?: string | null;
		retryableProjectTextureId?: string | null;
		onUploadProjectTexture?: (name: string, bytes: Uint8Array) => Promise<string | null>;
		onRetryProjectTexture?: () => Promise<string | null>;
		onAcceptProjectTexture?: (assetId: string) => Promise<string | null>;
		canConvertProjectTexture?: (texture: SceneTextureAsset) => boolean;
		onConvertProjectTexture?: (textureId: string) => Promise<string | null>;
		onProjectTextureFileSelected?: () => void;
		contextMenu?: EditorContextMenuStore | null;
		/** P21.6 Slice C — collapsed panels clip + go inert (CSS grid only). */
		collapsed?: boolean;
	} = $props();

	const domain = $derived(viewState.domain);
	const wallFirstLayout = $derived('formatVersion' in layoutPreviewDocument(layoutPreview));
	const showScenePanelTabs = $derived(domain === 'scene');
	// Boot-empty editor surfaces no badge (status 'blank' and no import error).
	// importError is `string | null` — check `!== null`, not `!== undefined`
	// (which is always true and would show the header on every blank boot).
	const showHeaderStrip = $derived(
		layoutPreview.importError !== null ||
			layoutPreviewSessionStatus(layoutPreview) !== 'blank'
	);

	const PANEL_TABS = ['scene', 'assets'] as const;
	/** Roving focus targets for the Hierarchy | Assets tablist (#39). */
	let panelTabElements = $state<(HTMLButtonElement | null)[]>([]);

	function switchLeftPanel(panel: 'scene' | 'assets') {
		store.setLeftPanel(panel);
	}

	/**
	 * #39 — one tab stop for the strip; arrows move focus and select (automatic
	 * activation: both panels stay mounted, so switching costs nothing).
	 */
	function onPanelTabsKeydown(event: KeyboardEvent) {
		const selected = PANEL_TABS.indexOf(store.leftPanel);
		const next = resolveRovingIndex(PANEL_TABS.length, selected, event.key, 'horizontal');
		if (next === null) return;
		event.preventDefault();
		switchLeftPanel(PANEL_TABS[next]!);
		panelTabElements[next]?.focus();
	}

	function resolveTextureImageSrc(uri: string): string | null {
		const source = BinaryTextureStore.objectUrlFor(uri) ?? uri;
		return source.startsWith('/project-assets/') ? null : source;
	}

	// S10.1 — Rooms header (+): jump to Scene → Plan and start a rectangle-room draft.
	function startRoomDraft() {
		viewState.setDomain('scene');
		viewState.setView('scene', 'plan');
		setPlanViewMode(layoutInteraction, 'layout');
		setLayoutDraftTool(layoutInteraction, 'rectangle');
	}
</script>

<aside
	bind:this={outlinerElement}
	class="panel outliner"
	class:collapsed
	aria-label="Editor sidebar"
	style="grid-area: left;"
	inert={collapsed}
>
	<div class="sidebar-content" inert={store.isVisitorCameraPreview}>
	{#if showHeaderStrip}
		<div class="header-strip" aria-label="Layout preview source">
			<span class="source-badge">
				{layoutPreviewSourceLabel(layoutPreview.source)} · {layoutPreviewSessionStatus(layoutPreview)}
			</span>
			{#if layoutPreview.importError}
				<p class="layout-error" role="alert">Import failed: {layoutPreview.importError}</p>
			{/if}
		</div>
	{/if}

	{#if showScenePanelTabs}
		<div
			class="panel-tabs"
			role="tablist"
			aria-label="Editor panels"
			tabindex="-1"
			onkeydown={onPanelTabsKeydown}
		>
			{#each PANEL_TABS as panel, index (panel)}
				<button
					bind:this={panelTabElements[index]}
					type="button"
					role="tab"
					aria-selected={store.leftPanel === panel}
					tabindex={tablistTabIndex(index, PANEL_TABS.indexOf(store.leftPanel))}
					class:active={store.leftPanel === panel}
					onclick={() => switchLeftPanel(panel)}
				>{panel === 'scene' ? 'Hierarchy' : 'Assets'}</button>
			{/each}
		</div>
	{/if}

	{#if domain === 'camera'}
		<!-- P1.7 — Camera domain gets the dedicated four-section sidebar
		     (Environment · Sequence Inspector · Unsequenced · Connections),
		     fading in via the shared shell transition on its root. -->
		<div class="panel-content">
			<CameraSidebar {store} {layoutPreview} />
		</div>
	{:else}
		<!-- Both panels stay mounted; the inactive one is hidden by class so the
		     tree's component-local expansion state survives tab switches. -->
		<div
			class="panel-content panel-content--tree"
			class:panel-content--hidden={showScenePanelTabs && store.leftPanel === 'assets'}
		>
			<UnifiedProjectTree
				{store}
				{layoutPreview}
				{layoutInteraction}
				{activeSelection}
				domain={viewState.domain}
				view={viewState.activeView}
				onAddRoom={domain === 'scene' && !wallFirstLayout ? startRoomDraft : undefined}
				{contextMenu}
			/>
		</div>
		{#if showScenePanelTabs}
			<div class="panel-content" class:panel-content--hidden={store.leftPanel !== 'assets'}>
				<EditorAssetLibrary
					{store}
					onselectionchange={onAssetSelection}
					{onSelectAsset}
					{projectAssets}
					{projectAssetsStatus}
					{retryableProjectAssetId}
					{retryableProjectTextureId}
					{onUploadProjectTexture}
					{onRetryProjectTexture}
					{onAcceptProjectTexture}
					{canConvertProjectTexture}
					{onConvertProjectTexture}
					{onProjectTextureFileSelected}
					{resolveTextureImageSrc}
				/>
			</div>
		{/if}
	{/if}
	</div>

</aside>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem 1.1rem;
		border-right: 1px solid var(--editor-border-subtle);
		overflow: auto;
		background: var(--editor-bg-panel);
	}
	/* P21.6 Slice C — collapsed panels clip to the zero-width grid track
	   (the track carries the collapse; this only clips contents). Combined
	   with `inert`; zero-width alone never removes keyboard focus. */
	.panel.collapsed {
		overflow: hidden;
		visibility: hidden;
		min-width: 0;
	}
	.sidebar-content { display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column; gap: 1rem; }
	.header-strip { display: flex; flex-direction: column; gap: 0.45rem; }
	.source-badge {
		align-self: flex-start;
		padding: 0.24rem 0.45rem;
		border: 1px solid var(--editor-accent-border);
		border-radius: 999px;
		background: var(--editor-bg-selected);
		color: var(--editor-text-primary);
		font-size: var(--editor-font-size-xs);
		font-weight: 650;
	}
	.panel-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; }
	.panel-tabs button { padding: 0.42rem; border: 1px solid var(--editor-border-normal); border-radius: 0.32rem; background: var(--editor-bg-panel-raised); color: var(--editor-text-secondary); font: inherit; font-size: var(--editor-font-size-md); cursor: pointer; }
	.panel-tabs button.active { border-color: var(--editor-accent); background: var(--editor-bg-selected); color: var(--editor-text-primary); }
	.panel-content { display: contents; }
	/* P23.6e — the hierarchy owns its inner scroll viewport: give the tree a
	   bounded flex track so page reveal/scroll restoration has a stable owner. */
	.panel-content--tree { display: flex; min-height: 0; flex: 1 1 auto; flex-direction: column; }
	.panel-content--hidden { display: none; }
	.layout-error { margin: 0; color: var(--editor-danger-fg); font-size: var(--editor-font-size-md); line-height: 1.4; }

	@media (max-width: 62rem) {
		.panel { min-height: 0; max-height: 34rem; border-top: 1px solid var(--editor-border-subtle); }
	}
	@media (max-width: 44rem) {
		.panel { max-height: 30rem; border-right: 0; }
	}
</style>
