<script lang="ts">
	import type { ArtworkLibraryEntry } from '@portfolio/project-model';
	/**
	 * The Living Draft World toolbar: the #285 plate and dock.
	 *
	 * The surface is the prototype's cream plate over a forest dock. Every landed
	 * row still delegates to the route's controllers; planned rows stay inspectable
	 * without pretending to write the project.
	 */
	import type { Snippet } from 'svelte';
	import WorldIcon from './WorldIcon.svelte';
	import { assets } from '$lib/content/assets';
	import { materials } from '$lib/content/materials';
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

	let {
		activeTool,
		libraryOpen,
		onTool,
		onLibrary,
		onObjectPick,
		onMaterialPick,
		lookShelf = null,
		artworkShelf = null,
		onArtworkPick = () => {},
		onArtworkImport = () => {},
		onLookPick = () => {},
		plate,
		plateOpen = true,
		onPlateOpen = () => {}
	}: {
		activeTool: WorldToolId;
		libraryOpen: boolean;
		onTool: (id: WorldToolId) => void;
		onLibrary: () => void;
		onObjectPick: (assetId: string) => void;
		onMaterialPick: (materialId: string) => void;
		/** The Look shelf later T2 slices fill; empty in P0, so nothing is drawn. */
		lookShelf?: LookLibraryShelf | null;
		artworkShelf?: readonly ArtworkLibraryEntry[] | null;
		onArtworkPick?: (entry: ArtworkLibraryEntry) => void;
		onArtworkImport?: (files: File[]) => void;
		onLookPick?: (entryId: string) => void;
		plate?: Snippet;
		/** The upper parchment plate is an intentional expanded/collapsed state. */
		plateOpen?: boolean;
		onPlateOpen?: (open: boolean) => void;
	} = $props();

	const plateId = $props.id();
	let artworkFileInput = $state<HTMLInputElement>();
	let libraryCategory = $state<WorldLibraryCategory | 'look' | 'artwork'>('objects');
	let remembered = $state<Record<WorldFamily['id'], WorldToolId>>({
		build: 'walls',
		form: 'form',
		land: 'ground',
		furnish: 'objects'
	});

	const activeToolData = $derived(worldTool(activeTool));
	const activeFamily = $derived(familyOf(activeTool));
	const activeFamilyTools = $derived(activeFamily === null ? [] : familyTools(activeFamily));

	$effect(() => {
		const family = familyOf(activeTool);
		if (family !== null) remembered[family.id] = activeTool;
	});

	function pressFamily(family: WorldFamily): void {
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
		if (!libraryOpen) onLibrary();
		onPlateOpen(true);
	}

	function dockToolFor(id: WorldToolId): WorldTool {
		return worldTool(id);
	}

	const approvedAssets = assets.filter((asset) => asset.status === 'approved').slice(0, 8);
	const visibleMaterials = materials.slice(0, 6);
	const directTools = $derived([dockToolFor('paint'), dockToolFor('erase')]);
</script>	<section
		class="world-toolbar"
		class:folded={!plateOpen || activeTool === 'select'}
		data-world-toolbar
		data-active-tool={activeTool}
	>
		{#if activeTool !== 'select'}
		<div class="tier" id={plateId} hidden={!plateOpen}>
		<div class="row words">
			<div class="strip words-strip">
				{#if libraryOpen}
					{#each WORLD_LIBRARY_CATEGORIES as category (category.id)}
						<button
							type="button"
							class="sub"
							class:on={libraryCategory === category.id}
							aria-pressed={libraryCategory === category.id}
							onclick={() => (libraryCategory = category.id)}
						>{category.label}</button>
					{/each}
					{#if artworkShelf !== null}
						<button type="button" class="sub" class:on={libraryCategory === 'artwork'}
							aria-pressed={libraryCategory === 'artwork'} onclick={() => (libraryCategory = 'artwork')}>Artwork</button>
					{/if}
					{#if lookShelf !== null && lookShelf.entries.length > 0}
						<button
							type="button"
							class="sub"
							class:on={libraryCategory === 'look'}
							aria-pressed={libraryCategory === 'look'}
							onclick={() => (libraryCategory = 'look')}
						>{lookShelf.label}</button>
					{/if}
				{:else if activeFamily !== null}
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
				{#if libraryOpen}
					<button type="button" class="close-word" aria-label="Close Library" onclick={onLibrary}>Close</button>
				{/if}
			</div>
		</div>

		<div class="row picks">
			<div class="strip">
				{#if libraryOpen}
					{#if libraryCategory === 'artwork' && artworkShelf !== null}
						<div class="librow" aria-label="Artwork in this project">
							<input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden bind:this={artworkFileInput}
								onchange={() => { onArtworkImport(Array.from(artworkFileInput?.files ?? [])); if (artworkFileInput) artworkFileInput.value = ''; }} />
							<button class="tile" type="button" onclick={() => artworkFileInput?.click()}>Import</button>
							{#each artworkShelf as entry (entry.assetId)}
								<button class="tile" type="button" title={entry.name} onclick={() => onArtworkPick(entry)}>{entry.name}</button>
							{/each}
						</div>
					{:else if libraryCategory === 'look' && lookShelf !== null}
						<div class="librow" aria-label={lookShelf.label}>
							{#each lookShelf.entries as entry (entry.id)}
								<button type="button" class="tile" title={entry.summary ?? entry.label} onclick={() => onLookPick(entry.id)}>
									<span class="tile-glyph"><WorldIcon name="sun" size={20} /></span>
									<span class="tile-label">{entry.label}</span>
								</button>
							{/each}
						</div>
					{:else if libraryCategory === 'objects'}
						<div class="librow" aria-label="Approved objects">
							{#each approvedAssets as asset (asset.id)}
								<button type="button" class="tile" title={asset.name} onclick={() => onObjectPick(asset.id)}>
									<span class="tile-glyph"><WorldIcon name="object" size={20} /></span>
									<span class="tile-label">{asset.name}</span>
								</button>
							{/each}
						</div>
					{:else if libraryCategory === 'materials'}
						<div class="librow" aria-label="Materials">
							{#each visibleMaterials as material (material.id)}
								<button type="button" class="tile" title={material.label} onclick={() => onMaterialPick(material.id)}>
									<i class="material" style:background={material.fallbackColor}></i>
									<span class="tile-label">{material.label}</span>
								</button>
							{/each}
						</div>
					{:else if libraryCategory === 'my-objects'}
						<div class="note">
							<strong>My objects</strong>
							<span>Your own uploads and saved combinations will live here.</span>
							<button type="button" class="act" onclick={() => onObjectPick('')}>Open the Objects panel</button>
						</div>
					{:else}
						<div class="librow planned-row">
							{#each (libraryCategory === 'lights' ? ['Point', 'Spot', 'Area'] : libraryCategory === 'plants' ? ['Bed', 'Shrub', 'Hedge', 'Tree'] : ['House', 'Annex', 'Shed']) as label (label)}
								<button type="button" class="tile planned-tile" disabled>
									<span class="tile-glyph">
										<WorldIcon
											name={libraryCategory === 'lights' ? 'light' : libraryCategory === 'plants' ? 'plants' : 'building'}
											size={20}
										/>
									</span>
									<span class="tile-label">{label}</span>
									<small>Planned · T{libraryCategory === 'buildings' ? '5' : '2'}</small>
								</button>
							{/each}
						</div>
					{/if}
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

	<nav class="dock" aria-label="World tool families">
		<button
			type="button"
			class="key"
			class:armed={activeTool === 'select' && !libraryOpen}
			aria-pressed={activeTool === 'select' && !libraryOpen}
			title="Select (V)"
			onclick={pressSelect}
		>
			<WorldIcon name="select" size={20} hero />
			<span class="kl">Select</span>
			<kbd class="kk">V</kbd>
		</button>
		<i class="sep" aria-hidden="true"></i>
		{#each WORLD_FAMILIES as family (family.id)}
			<button
				type="button"
				class="key family"
				class:armed={activeFamily?.id === family.id && !libraryOpen}
				aria-pressed={activeFamily?.id === family.id && !libraryOpen}
				aria-expanded={activeFamily?.id === family.id && !libraryOpen ? plateOpen : undefined}
				aria-controls={activeFamily?.id === family.id && !libraryOpen ? plateId : undefined}
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
				<span class="kl">{tool.label}</span>
				{#if tool.shortcut}<kbd class="kk">{tool.shortcut}</kbd>{/if}
			</button>
		{/each}
		<i class="sep" aria-hidden="true"></i>
		<button
			type="button"
			class="key"
			class:armed={libraryOpen}
			aria-pressed={libraryOpen}
			aria-expanded={libraryOpen ? plateOpen : undefined}
			aria-controls={libraryOpen ? plateId : undefined}
			title="Library (L)"
			onclick={() => openLibrary('objects')}
		>
			<WorldIcon name="library" size={20} hero />
			<span class="kl">Library</span>
			<kbd class="kk">L</kbd>
		</button>
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
		box-shadow: var(--shell-instrument-shadow);
		color: var(--shell-ink-light);
		font-family: var(--shell-sans);
		overflow: hidden;
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
	.librow {
		display: flex;
		align-items: stretch;
		gap: 4px;
		height: 100%;
		min-width: max-content;
		padding: 4px 0;
		box-sizing: border-box;
	}
	.tile {
		display: grid;
		grid-template-rows: 1fr auto;
		gap: 2px;
		place-items: center;
		flex: none;
		width: 78px;
		height: 100%;
		padding: 3px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--shell-ink);
		font: 9.5px/1.1 var(--shell-sans);
		text-align: center;
		cursor: pointer;
	}
	.tile:hover {
		background: var(--shell-hover);
	}
	.tile-glyph {
		display: grid;
		place-items: center;
		width: 100%;
		height: 28px;
		border-radius: 4px;
		background: var(--shell-surface-sunken);
		color: var(--shell-ink-2);
	}
	.tile-label {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.material {
		width: 100%;
		height: 28px;
		border-radius: 4px;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--shell-ink) 12%, transparent);
	}
	.planned-tile:disabled {
		opacity: 0.58;
		cursor: default;
	}
	.planned-tile small {
		color: var(--shell-ink-3);
		font: 8px/1 var(--shell-mono);
	}
	.note {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		color: var(--shell-ink-3);
		font: var(--shell-text-label)/1.3 var(--shell-sans);
	}
	.note strong {
		flex: none;
		color: var(--shell-ink);
		font: 600 var(--shell-text-control)/1 var(--shell-sans);
	}
	.note .act {
		margin-left: auto;
	}
	.dock {
		flex: none;
		display: flex;
		align-items: stretch;
		height: 56px;
		overflow-x: auto;
		overflow-y: hidden;
		background: var(--shell-forest);
	}
	.key {
		position: relative;
		flex: 1 0 50px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 50px;
		padding: 0 4px;
		border: 0;
		background: transparent;
		color: var(--shell-ink-quiet);
		cursor: pointer;
	}
	.key:hover:not(.armed) {
		background: var(--shell-on-forest-wash);
		color: var(--shell-ink-light);
	}
	.key.armed {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
		box-shadow: inset 0 0 0 1px var(--shell-hairline);
	}
	.key.armed .kk {
		color: var(--shell-ink-3);
	}
	.key.armed .family-dots i {
		background: var(--shell-hairline-strong);
	}
	.key.armed .family-dots i.on {
		background: var(--shell-action);
	}
	.key:focus-visible {
		outline: 2px solid var(--shell-focus-halo);
		outline-offset: -2px;
	}
	.key.armed:focus-visible {
		outline-color: var(--shell-action);
	}
	.kl {
		font: 500 var(--shell-text-control)/1 var(--shell-sans);
		letter-spacing: -0.005em;
		white-space: nowrap;
	}
	.kk {
		position: absolute;
		top: 4px;
		right: 5px;
		color: color-mix(in srgb, var(--shell-ivory) 32%, transparent);
		font: 400 7px/1 var(--shell-mono);
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
		align-self: stretch;
		width: 1px;
		margin: 12px 0;
		background: var(--shell-line-on-forest);
	}
	button:focus-visible {
		outline: 2px solid var(--shell-leaf);
		outline-offset: -2px;
	}
	.dock button:focus-visible {
		outline-color: var(--shell-focus-halo);
	}
	.dock .key.armed:focus-visible {
		outline-color: var(--shell-action);
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
		.dock {
			height: 54px;
		}
		.key {
			flex-basis: 51px;
			min-width: 51px;
		}
		.kl {
			font-size: var(--shell-text-utility);
		}
	}
	@media (pointer: coarse) {
		.sub,
		.key {
			min-height: 44px;
		}
	}
</style>
