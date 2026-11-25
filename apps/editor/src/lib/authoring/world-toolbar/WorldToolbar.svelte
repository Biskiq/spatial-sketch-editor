<script lang="ts">
	import type { ArtworkLibraryEntry } from '@portfolio/project-model/artwork';
	import type { MaterialId } from '@portfolio/project-model/scene';
	/**
	 * The Living Draft World toolbar: the prototype's plate and dock.
	 *
	 * The surface is the prototype's cream plate over a forest dock. Every landed
	 * row still delegates to the route's controllers; planned rows stay inspectable
	 * without pretending to write the project.
	 */
	import type { Snippet } from 'svelte';
	import WorldIcon from './WorldIcon.svelte';
	import FinishTile from '$lib/authoring/look/FinishTile.svelte';
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import { assets } from '$lib/content/assets';
	import WorldToolbarLibrary from './WorldToolbarLibrary.svelte';
	import { materials } from '$lib/content/materials';
	import WorldFurnishStrip from './WorldFurnishStrip.svelte';
	import WorldToolbarLibraryTabs from './WorldToolbarLibraryTabs.svelte';
	import {
		WORLD_FAMILIES,
		WORLD_LIBRARY_CATEGORIES,
		familyOf,
		familyTools,
		worldTool,
		type WorldFamily,
		type WorldLibraryCategory,
		type WorldTool,
		type WorldToolId
	} from './registry';
import type { LookLibraryShelf } from '$lib/authoring/look/look-authoring.svelte';
	import type { SceneFinishRef } from '@portfolio/project-model/scene-planning';
	import type { FinishImageState } from '$lib/authoring/look/finish-image.svelte';

	let {
		activeTool,
		libraryOpen,
		onTool,
		onLibrary,
		onObjectPick,
		onMaterialPick,
		finishShelf = null,
		onFinishPick = () => {},
		finishTileSource = () => null,
		finishImage = null,
		onFinishImageImport = () => {},
		onFinishImageCancel = () => {},
		onFinishImageRetry = () => {},
		onFinishImageReset = () => {},
		lookShelf = null,
		artworkShelf = null,
		onArtworkPick = () => {},
		onArtworkImport = () => {},
		onLookPick = () => {},
		plate,
		plateOpen = true,
		onPlateOpen = () => {},
		requestedCategory = null,
		studio = false,
		paintChip = null,
		trayOwnsPlate = false,
		furnishOpen = false,
		onFurnish = () => {},
		onFurnishBrowse = () => {}
	}: {
		activeTool: WorldToolId;
		libraryOpen: boolean;
		onTool: (id: WorldToolId) => void;
		onLibrary: () => void;
		onObjectPick: (assetId: string) => void;
		onMaterialPick: (materialId: string) => void;
		/** Library › Finishes: curated then project Finishes. */
		finishShelf?: {
			readonly curated: readonly { readonly id: MaterialId; readonly label: string; readonly color: string }[];
			readonly project: readonly {
				readonly id: string;
				readonly name: string;
				readonly color: string;
				readonly imageUri: string | null;
				readonly warning: string | null;
			}[];
		} | null;
		onFinishPick?: (ref: SceneFinishRef) => void;
		/** The picture source of one project Finish (U1); null while none can be drawn. */
		finishTileSource?: (finishId: string) => FinishTileSource | null;
		/** *+ From image*: the one upload state machine shared with the Card. */
		finishImage?: FinishImageState | null;
		onFinishImageImport?: (file: File) => void;
		onFinishImageCancel?: () => void;
		onFinishImageRetry?: () => void;
		onFinishImageReset?: () => void;
		/** The Look shelf; nothing is drawn while it is empty. */
		lookShelf?: LookLibraryShelf | null;
		artworkShelf?: readonly ArtworkLibraryEntry[] | null;
		onArtworkPick?: (entry: ArtworkLibraryEntry) => void;
		onArtworkImport?: (files: File[]) => void;
		onLookPick?: (entryId: string) => void;
		plate?: Snippet;
		/** The upper parchment plate is an intentional expanded/collapsed state. */
		plateOpen?: boolean;
		onPlateOpen?: (open: boolean) => void;
		/** A route request to show one Library shelf (Library › Finishes). */
		requestedCategory?: { readonly category: WorldLibraryCategory; readonly nonce: number } | null;
		/** Object Studio's dock: Select, Objects, Measure and Eraser only. */
		studio?: boolean;
		/** The Paint key's live chip: the active pick, a circle for a colour and a rounded square for a material. */
		paintChip?: { readonly color: string; readonly shape: 'colour' | 'material'; readonly source?: FinishTileSource | null } | null;
		/** An armed tool's own tray stands in for the words plate (Paint's tray), so no second card opens above the dock. */
		trayOwnsPlate?: boolean;
		/**
		 * Furnish's quick strip (owner decision): a placeholder strip with no tool
		 * armed, whose one action opens the Library on Objects.
		 */
		furnishOpen?: boolean;
		onFurnish?: () => void;
		onFurnishBrowse?: () => void;
	} = $props();

	const plateId = $props.id();
	let libraryCategory = $state<WorldLibraryCategory | 'look' | 'artwork'>('objects');
	let remembered = $state<Record<WorldFamily['id'], WorldToolId>>({
		build: 'walls',
		form: 'form',
		land: 'ground',
		furnish: 'objects'
	});

	const baseToolData = $derived(worldTool(activeTool));
	/** Studio words its own Objects row: the Library's furniture and models stay in the World. */
	const activeToolData = $derived(
		studio && activeTool === 'objects'
			? { ...baseToolData, summary: 'Add a new object to this scene.' }
			: baseToolData
	);
	const activeFamily = $derived(familyOf(activeTool));
	const activeFamilyTools = $derived(activeFamily === null ? [] : familyTools(activeFamily));

	$effect(() => {
		const family = familyOf(activeTool);
		if (family !== null) remembered[family.id] = activeTool;
	});

	// The Lights tool opens the Library on the Look shelf; it is the same one
	// arm the shelf uses, not a second placement controller.
	$effect(() => {
		if (libraryOpen && activeTool === 'lights') libraryCategory = 'look';
	});
	$effect(() => {
		const request = requestedCategory;
		if (request !== null) libraryCategory = request.category;
	});

	function pressFamily(family: WorldFamily): void {
		if (family.id === 'furnish' && !studio) {
			onFurnish();
			return;
		}
		if (activeFamily?.id === family.id) {
			onPlateOpen(!plateOpen);
			return;
		}
		onTool(remembered[family.id] ?? family.defaultTool);
		onPlateOpen(true);
	}

	/**
	 * Select owns no plate: the Stage gizmo is its whole readout. Pressing it
	 * arms the tool and closes whatever plate was open.
	 */
	function pressSelect(): void {
		onTool('select');
		onPlateOpen(false);
	}

	function pressTool(id: WorldToolId): void {
		if (activeTool === id && !libraryOpen) {
			onPlateOpen(!plateOpen);
			return;
		}
		onTool(id);
		onPlateOpen(true);
	}

	function openLibrary(category: WorldLibraryCategory = 'objects'): void {
		libraryCategory = category;
		// The armed Library key toggles the external sheet; a closed key opens it.
		if (libraryOpen) {
			onLibrary();
			return;
		}
		onLibrary();
		onPlateOpen(true);
	}

	function dockToolFor(id: WorldToolId): WorldTool {
		return worldTool(id);
	}

	const approvedAssets = assets.filter((asset) => asset.status === 'approved').slice(0, 8);
	const visibleMaterials = materials.slice(0, 6);
	/** World (not Studio) strips hover above a stationary dock, like Paint's tray. */
	const detached = $derived(!studio);
	const familyArmed = (family: WorldFamily): boolean =>
		family.id === 'furnish' && !studio
			? furnishOpen && !libraryOpen
			: activeFamily?.id === family.id && !libraryOpen;
	const directTools = $derived(
		studio
			? [dockToolFor('objects'), dockToolFor('measure'), dockToolFor('erase')]
			: [dockToolFor('paint'), dockToolFor('erase')]
	);
</script>	<section
		class="world-toolbar"
		class:folded={(!plateOpen || activeTool === 'select' || trayOwnsPlate) && !furnishOpen}
		class:detached
		data-world-toolbar
		data-active-tool={activeTool}
	>
		<!-- The external Library sheet owns the plate while it is open; the dock stays. -->
		{#if furnishOpen && !libraryOpen && !studio}
			<WorldFurnishStrip {plateId} onBrowse={onFurnishBrowse} />
		{:else if activeTool !== 'select' && !trayOwnsPlate && !libraryOpen}
		<div class="tier" id={plateId} hidden={!plateOpen} data-world-strip={activeFamily?.id ?? activeTool}>
		<div class="row words">
			<div class="strip words-strip">
				{#if libraryOpen}
					<WorldToolbarLibraryTabs
						category={libraryCategory}
						onCategory={(next) => (libraryCategory = next)}
						{artworkShelf}
						{lookShelf}
						onClose={onLibrary}
					/>
				{:else if activeFamily !== null && !studio}
					<div class="subs" aria-label={`${activeFamily.label} tools`}>
						{#each activeFamilyTools as tool (tool.id)}
							<button
								type="button"
								class="sub"
								class:on={activeTool === tool.id}
								aria-pressed={activeTool === tool.id}
								title={tool.summary}
								onclick={() => onTool(tool.id)}
							>
								{tool.label}
								{#if tool.shortcut}<kbd>{tool.shortcut}</kbd>{/if}
							</button>
						{/each}
					</div>
					{#if activeToolData.stage === 'planned'}
						<span class="planned">Planned · {activeToolData.after}</span>
					{/if}
				{:else}
					<span class="pn">
						<b>{activeToolData.label}</b>
						<span>{activeToolData.summary}</span>
					</span>
				{/if}
			</div>
		</div>

		<div class="row picks">
			<div class="strip">
				{#if libraryOpen}
					<WorldToolbarLibrary
						category={libraryCategory}
						{artworkShelf}
						{lookShelf}
						{approvedAssets}
						{visibleMaterials}
						{finishShelf}
						{finishTileSource}
						{finishImage}
						onFinishPick={onFinishPick}
						onMaterialPick={onMaterialPick}
						onObjectPick={onObjectPick}
						onArtworkPick={onArtworkPick}
						onArtworkImport={onArtworkImport}
						onLookPick={onLookPick}
						onFinishImageImport={onFinishImageImport}
						onFinishImageCancel={onFinishImageCancel}
						onFinishImageRetry={onFinishImageRetry}
						onFinishImageReset={onFinishImageReset}
					/>
				{:else if activeToolData.stage === 'planned'}
					<div class="planned-options">
						{#each activeToolData.options ?? [] as group (group.label)}
							<div class="pg plan">
								<span class="gl">{group.label}</span>
								<div class="opts">
									{#each group.options as option (option.label)}
										<button
											type="button"
											class="opt text"
											disabled={option.disabled}
											aria-disabled={option.disabled ? 'true' : undefined}
										>{option.label}</button>
									{/each}
								</div>
							</div>
						{/each}
						<span class="planned-note">
							{activeToolData.summary} This row is inspectable; the capability follows in {activeToolData.after}.
						</span>
					</div>
				{:else if plate}
					{@render plate()}
				{:else}
					<div class="pn empty">
						<span>{activeToolData.summary}</span>
						<button type="button" class="act" onclick={() => onTool('select')}>Done</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
	{/if}

	<nav class="dock" aria-label={studio ? 'Object Studio tools' : 'World tool families'} data-studio-dock={studio ? 'true' : undefined}>
		<button
			type="button"
			class="key"
			class:armed={activeTool === 'select' && !libraryOpen && !furnishOpen}
			aria-pressed={activeTool === 'select' && !libraryOpen && !furnishOpen}
			data-world-select
			title="Select (V)"
			onclick={pressSelect}
		>
			<WorldIcon name="select" size={20} hero />
			<span class="kl">Select</span>
			<kbd class="kk">V</kbd>
		</button>
		<i class="sep" aria-hidden="true"></i>
		{#each studio ? [] : WORLD_FAMILIES as family (family.id)}
			<button
				type="button"
				class="key family"
				class:armed={familyArmed(family)}
				aria-pressed={familyArmed(family)}
				aria-expanded={family.id === 'furnish' && !studio ? furnishOpen && !libraryOpen : familyArmed(family) ? plateOpen : undefined}
				aria-controls={familyArmed(family) ? plateId : undefined}
				data-world-family={family.id}
				title={`${family.label}: ${family.tools.map((id) => worldTool(id).label).join(', ')}`}
				onclick={() => pressFamily(family)}
			>
				<WorldIcon name={family.icon} size={20} hero />
				<span class="kl">{family.label}</span>
				<span class="family-dots" aria-hidden="true">
					{#each family.tools as id (id)}<i class:on={activeTool === id}></i>{/each}
				</span>
			</button>
		{/each}
		<i class="sep" aria-hidden="true"></i>
		{#each directTools as tool (tool.id)}
			<button
				type="button"
				class="key"
				class:armed={activeTool === tool.id && !libraryOpen}
				aria-pressed={activeTool === tool.id && !libraryOpen}
				aria-expanded={activeTool === tool.id && !libraryOpen ? plateOpen : undefined}
				aria-controls={activeTool === tool.id && !libraryOpen ? plateId : undefined}
				title={tool.summary}
				onclick={() => pressTool(tool.id)}
			>
				<WorldIcon name={tool.icon} size={20} hero />
				{#if tool.id === 'paint' && paintChip !== null}
					<i class="chip {paintChip.shape}" data-paint-chip style={`background: ${paintChip.color}`} aria-hidden="true">
						{#if paintChip.shape === 'material'}<FinishTile source={paintChip.source ?? null} color={paintChip.color} size={13} />{/if}
					</i>
				{/if}
				<span class="kl">{tool.label}</span>
				{#if tool.shortcut}<kbd class="kk">{tool.shortcut}</kbd>{/if}
			</button>
		{/each}
		{#if !studio}
		<i class="sep" aria-hidden="true"></i>
		<button
			type="button"
			class="key"
			class:armed={libraryOpen}
			aria-pressed={libraryOpen}
			aria-expanded={libraryOpen ? plateOpen : undefined}
			aria-controls={libraryOpen ? plateId : undefined}
			data-world-library-key
			title="Library (L)"
			onclick={() => openLibrary('objects')}
		>
			<WorldIcon name="library" size={20} hero />
			<span class="kl">Library</span>
			<kbd class="kk">L</kbd>
		</button>
		{/if}
	</nav>
</section>

<style>
	/*
	 * Miniature marks (mono shortcuts, planned tags, counts) intentionally sit
	 * below the UI scale; ordinary controls and captions use --shell-text-*.
	 */
	.world-toolbar {
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		width: min(656px, 100%);
		max-height: min(228px, 46vh);
		border: 0;
		border-radius: var(--shell-instrument-radius);
		background: var(--shell-forest);
		box-shadow: var(--shell-dock-shadow);
		color: var(--shell-ink-light);
		font-family: var(--shell-sans);
		overflow: hidden;
	}
	/*
	 * World strips hover above a stationary dock (owner direction): the strip is
	 * its own instrument with the same 8 px Stage gap as Paint's tray, and the
	 * dock keeps its height and alignment whether a strip is open or not.
	 */
	.world-toolbar.detached {
		gap: 8px;
		max-height: none;
		border-radius: 0;
		background: transparent;
		box-shadow: none;
		overflow: visible;
	}
	.detached .tier {
		overflow: hidden;
		border: 1px solid var(--shell-hairline);
		border-radius: var(--shell-instrument-radius);
		box-shadow: 0 8px 24px rgb(18 38 29 / 16%);
	}
	.detached .tier[hidden] {
		display: none;
	}
	.detached .dock {
		border-radius: var(--shell-instrument-radius);
		box-shadow: var(--shell-dock-shadow);
	}
	/* The menu is the same off-white key as the selected dock control. */
	.tier {
		flex: none;
		background: var(--shell-mode-active-bg);
		color: var(--shell-ink);
	}
	.row,
	.strip,
	.dock {
		scrollbar-color: color-mix(in srgb, var(--shell-ink) 24%, transparent) transparent;
		scrollbar-width: thin;
	}
	.row {
		display: flex;
		align-items: stretch;
		box-sizing: border-box;
	}
	.words {
		height: 38px;
	}
	.picks {
		height: 58px;
		border-top: 1px solid var(--shell-hairline);
	}
	.strip {
		display: flex;
		align-items: center;
		gap: 0;
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 0 8px;
		overflow-x: auto;
		overflow-y: hidden;
		white-space: nowrap;
	}
	.words-strip {
		align-items: stretch;
	}
	.subs {
		display: flex;
		align-items: stretch;
		align-self: stretch;
		gap: 1px;
		min-width: 0;
	}
	.sub {
		position: relative;
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 100%;
		padding: 0 8px;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--shell-ink-3);
		font: 500 var(--shell-text-identity)/1 var(--shell-sans);
		letter-spacing: -0.012em;
		cursor: pointer;
	}
	.sub:hover {
		color: var(--shell-ink);
	}
	.sub.on {
		color: var(--shell-ink);
	}
	.sub.on::after {
		content: '';
		position: absolute;
		right: 7px;
		bottom: 3px;
		left: 7px;
		height: 2px;
		border-radius: 2px;
		background: var(--shell-ink);
	}
	.sub kbd {
		transform: translateY(-5px);
		color: var(--shell-ink-3);
		font: 400 8px/1 var(--shell-mono);
	}
	.pn {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		margin-left: 4px;
		color: var(--shell-ink-3);
		font: var(--shell-text-label)/1.2 var(--shell-sans);
		overflow: hidden;
	}
	.pn b {
		flex: none;
		color: var(--shell-ink);
		font: 600 var(--shell-text-control)/1 var(--shell-sans);
	}
	.pn > span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.planned {
		flex: none;
		margin-left: auto;
		padding-right: 2px;
		color: var(--shell-ink-2);
		font: 400 9px/1 var(--shell-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.close-word {
		flex: none;
		margin-left: auto;
		padding: 4px 6px 4px 10px;
		border: 0;
		background: transparent;
		color: var(--shell-ink-2);
		font: 500 var(--shell-text-meta)/1 var(--shell-sans);
		cursor: pointer;
	}
	.close-word:hover {
		color: var(--shell-ink);
	}
	.picks .strip {
		gap: 18px;
		padding: 0 8px;
	}
	.pg {
		display: grid;
		flex: none;
		gap: 3px;
	}
	.gl {
		color: var(--shell-ink-3);
		font: 400 9.5px/1 var(--shell-mono);
		letter-spacing: 0.02em;
	}
	.pg.plan .gl {
		letter-spacing: 0.065em;
		text-transform: uppercase;
	}
	.opts {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 31px;
	}
	.opt {
		display: grid;
		place-items: center;
		flex: none;
		min-width: 30px;
		height: 30px;
		padding: 0 4px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--shell-ink-2);
	}
	button.opt {
		cursor: pointer;
	}
	.opt:hover {
		background: var(--shell-hover);
		color: var(--shell-ink);
	}
	.opt:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.opt.text {
		min-width: 0;
		padding: 0 8px;
		font: 500 var(--shell-text-label)/1 var(--shell-sans);
		white-space: nowrap;
	}
	.act {
		flex: none;
		height: 30px;
		padding: 0 8px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--shell-ink-2);
		font: 500 var(--shell-text-utility)/1 var(--shell-sans);
		white-space: nowrap;
		cursor: pointer;
	}
	.act:hover {
		background: var(--shell-hover);
		color: var(--shell-ink);
	}
	.act:disabled {
		color: var(--shell-ink-3);
		opacity: 0.58;
		cursor: default;
	}
	.empty {
		width: 100%;
		margin-left: 0;
		font-size: var(--shell-text-label);
	}
	.empty .act {
		margin-left: auto;
	}
	.planned-options {
		display: flex;
		align-items: center;
		gap: 18px;
		width: 100%;
		min-width: max-content;
	}
	.planned-note {
		flex: 1 0 210px;
		max-width: 260px;
		color: var(--shell-ink-3);
		font: var(--shell-text-meta)/1.35 var(--shell-sans);
		white-space: normal;
	}
	/* The shared dock anatomy (--shell-dock-*): inset rounded keys centred on a 56 px forest bar. */
	.dock {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: safe center;
		gap: var(--shell-dock-gap);
		height: var(--shell-dock-height);
		padding: 0 var(--shell-dock-pad-x);
		overflow-x: auto;
		overflow-y: hidden;
		background: var(--shell-forest);
	}
	.key {
		position: relative;
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: var(--shell-dock-key-min-width);
		height: var(--shell-dock-key-height);
		padding: 0 var(--shell-dock-key-pad-x);
		border: 0;
		border-radius: var(--shell-dock-key-radius);
		background: transparent;
		color: var(--shell-ink-quiet);
		cursor: pointer;
	}
	.key:hover:not(.armed) {
		background: var(--shell-on-forest-wash);
		color: var(--shell-ink-light);
	}
	.key.armed {
		background: var(--shell-tool-armed-bg);
		color: var(--shell-tool-armed-ink);
		box-shadow: var(--shell-tool-armed-edge);
	}
	.key:focus-visible {
		outline: 2px solid var(--shell-focus-halo);
		outline-offset: -2px;
	}
	.kl {
		font: 500 var(--shell-dock-label-size)/1 var(--shell-sans);
		letter-spacing: -0.005em;
		white-space: nowrap;
	}
	.chip {
		position: absolute;
		top: 5px;
		left: 50%;
		width: 13px;
		height: 13px;
		transform: translateX(4px);
		border: 1.5px solid var(--shell-forest);
		box-shadow: 0 0 0 1px var(--shell-hairline-strong);
		pointer-events: none;
	}
	.chip.colour {
		border-radius: 50%;
	}
	.chip.material {
		overflow: hidden;
		border-radius: 3px;
	}
	.chip :global(.finish-tile) {
		width: 100%;
		height: 100%;
		border-radius: 0;
		box-shadow: none;
	}
	.kk {
		position: absolute;
		top: 3px;
		right: 5px;
		color: var(--shell-dock-hint-ink);
		font: 400 var(--shell-dock-hint-size)/1 var(--shell-mono);
	}
	.family-dots {
		display: flex;
		gap: 2px;
		height: 3px;
	}
	.family-dots i {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--shell-ivory) 25%, transparent);
	}
	.family-dots i.on {
		background: var(--shell-ink-light);
	}
	.sep {
		flex: none;
		align-self: center;
		width: 1px;
		height: var(--shell-dock-sep-height);
		margin: 0 var(--shell-dock-sep-margin);
		background: var(--shell-line-on-forest);
	}
	button:focus-visible {
		outline: 2px solid var(--shell-leaf);
		outline-offset: -2px;
	}
	.dock button:focus-visible {
		outline-color: var(--shell-focus-halo);
	}
	@media (max-width: 760px) {
		.world-toolbar {
			width: 100%;
			max-height: 48vh;
		}
		.words {
			height: 38px;
		}
		.picks {
			height: 58px;
		}
		.key {
			min-width: 44px;
			padding: 0 3px;
		}
		.kk {
			display: none;
		}
	}
	@media (pointer: coarse) {
		.sub,
		.key {
			min-height: 44px;
		}
	}
</style>
