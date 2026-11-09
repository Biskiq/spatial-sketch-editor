<script lang="ts">
	/**
	 * The Living Draft World toolbar: two rows and a dock.
	 *
	 * It presents the whole #285 family system, but every landed row delegates to
	 * the route's existing controllers. Planned rows are visibly inspectable and
	 * cannot pretend to write the project.
	 */
	import type { Snippet } from 'svelte';
	import ShellIcon from '../stage/shell/ShellIcon.svelte';
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

	export type WorldSelectionAction = {
		readonly label: string;
		readonly run: () => void;
	};

	export type WorldSelection = {
		readonly label: string;
		readonly kind: string;
		readonly actions: readonly WorldSelectionAction[];
	};

	let {
		activeTool,
		libraryOpen,
		selection,
		onTool,
		onLibrary,
		onObjectPick,
		onMaterialPick,
		plate
	}: {
		activeTool: WorldToolId;
		libraryOpen: boolean;
		selection: WorldSelection | null;
		onTool: (id: WorldToolId) => void;
		onLibrary: () => void;
		onObjectPick: (assetId: string) => void;
		onMaterialPick: (materialId: string) => void;
		plate?: Snippet;
	} = $props();

	let libraryCategory = $state<WorldLibraryCategory>('objects');
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
		if (activeFamily?.id === family.id) return;
		const target = remembered[family.id] ?? family.defaultTool;
		onTool(target);
	}

	function openLibrary(category: WorldLibraryCategory = 'objects'): void {
		libraryCategory = category;
		if (!libraryOpen) onLibrary();
	}

	function dockToolFor(id: WorldToolId): WorldTool {
		return worldTool(id);
	}

	const approvedAssets = assets.filter((asset) => asset.status === 'approved').slice(0, 8);
	const visibleMaterials = materials.slice(0, 6);

	const directTools = $derived([
		dockToolFor('paint'),
		dockToolFor('erase'),
		dockToolFor('measure')
	]);

	const isActive = (id: WorldToolId): boolean => activeTool === id;
</script>

<section class="world-toolbar" data-world-toolbar data-active-tool={activeTool}>
	<div class="words" aria-label={libraryOpen ? 'Library' : 'World tools'}>
		{#if libraryOpen}
			{#each WORLD_LIBRARY_CATEGORIES as category (category.id)}
				<button
					type="button"
					class:active={libraryCategory === category.id}
					aria-pressed={libraryCategory === category.id}
					onclick={() => (libraryCategory = category.id)}
				>{category.label}</button>
			{/each}
			<button type="button" class="close-word" onclick={onLibrary}>Close</button>
		{:else if activeTool === 'select' && selection !== null}
			<span class="selection-title">{selection.label}</span>
			<span class="selection-kind">{selection.kind}</span>
		{:else if activeTool === 'select'}
			<span class="selection-title">Select</span>
		{:else if activeFamily !== null}
			{#each activeFamilyTools as tool (tool.id)}
				<button
					type="button"
					class:active={isActive(tool.id)}
					aria-pressed={isActive(tool.id)}
					title={tool.summary}
					onclick={() => onTool(tool.id)}
				>{tool.label}</button>
			{/each}
			{#if activeToolData.stage === 'planned'}
				<span class="planned-word">Planned · {activeToolData.after}</span>
			{/if}
		{:else}
			<span class="selection-title">{activeToolData.label}</span>
			<span class="selection-kind">{activeToolData.summary}</span>
			{#if activeToolData.stage === 'planned'}
				<span class="planned-word">Planned · {activeToolData.after}</span>
			{/if}
		{/if}
	</div>

	<div class="pictures" class:library-pictures={libraryOpen}>
		{#if libraryOpen}
			{#if libraryCategory === 'objects'}
				<div class="library-row" aria-label="Approved objects">
					{#each approvedAssets as asset (asset.id)}
						<button type="button" class="object-tile" title={asset.name} onclick={() => onObjectPick(asset.id)}>
							<span class="object-glyph"><ShellIcon name="object" size={20} /></span>
							<span>{asset.name}</span>
						</button>
					{/each}
				</div>
			{:else if libraryCategory === 'materials'}
				<div class="library-row" aria-label="Materials">
					{#each visibleMaterials as material (material.id)}
						<button type="button" class="material-tile" title={material.label} onclick={() => onMaterialPick(material.id)}>
							<i style:background={material.fallbackColor}></i>
							<span>{material.label}</span>
						</button>
					{/each}
				</div>
			{:else if libraryCategory === 'my-objects'}
				<div class="library-note">
					<strong>My objects</strong>
					<span>Your own uploads and saved combinations will live here.</span>
					<button type="button" onclick={() => onObjectPick('')}>Open the Objects panel</button>
				</div>
			{:else}
				<div class="library-plan-row">
					{#each (libraryCategory === 'lights' ? ['Point', 'Spot', 'Area'] : libraryCategory === 'plants' ? ['Bed', 'Shrub', 'Hedge', 'Tree'] : ['House', 'Annex', 'Shed']) as label (label)}
						<button type="button" class="planned-tile" disabled>
							<ShellIcon name={libraryCategory === 'lights' ? 'light' : libraryCategory === 'plants' ? 'leaf' : 'familyBuild'} size={20} />
							<span>{label}</span>
							<small>Planned · T{libraryCategory === 'buildings' ? '5' : '2'}</small>
						</button>
					{/each}
				</div>
			{/if}
		{:else if activeTool === 'select' && selection === null}
			<div class="selection-empty">
				<span><strong>No subject selected</strong> Choose a wall, room or object on the Stage, or use the Index.</span>
				<kbd>V</kbd>
			</div>
		{:else if activeTool === 'select' && selection !== null}
			<div class="selection-actions">
				{#each selection.actions as action (action.label)}
					<button type="button" onclick={action.run}>{action.label}</button>
				{/each}
				<button type="button" disabled title="Turning a selected subject arrives with T1">Turn</button>
				<button type="button" disabled title="Replacement arrives with T1">Replace</button>
			</div>
		{:else if activeToolData.stage === 'planned'}
			<div class="planned-options">
				{#each activeToolData.options ?? [] as group (group.label)}
					<div class="option-group">
						<span>{group.label}</span>
						<div>
							{#each group.options as option (option.label)}
								<button type="button" disabled={option.disabled}>{option.label}</button>
							{/each}
						</div>
					</div>
				{/each}
				<p>{activeToolData.summary} This row is inspectable; the capability follows in {activeToolData.after}.</p>
			</div>
		{:else if plate}
			{@render plate()}
		{:else}
			<div class="stage-hint">
				<span>{activeToolData.summary}</span>
				<button type="button" onclick={() => onTool('select')}>Done</button>
			</div>
		{/if}
	</div>

	<nav class="dock" aria-label="World tool families">
		<button
			type="button"
			class:active={activeTool === 'select' && !libraryOpen}
			aria-pressed={activeTool === 'select' && !libraryOpen}
			title="Select (V)"
			onclick={() => onTool('select')}
		>
			<span class="key-icon"><ShellIcon name="select" size={20} /></span>
			<span class="key-word">Select</span>
			<span class="key-shortcut">V</span>
		</button>
		{#each WORLD_FAMILIES as family (family.id)}
			<button
				type="button"
				class:active={activeFamily?.id === family.id}
				aria-pressed={activeFamily?.id === family.id}
				title={`${family.label}: ${family.tools.map((id) => worldTool(id).label).join(', ')}`}
				onclick={() => pressFamily(family)}
			>
				<span class="key-icon"><ShellIcon name={family.icon} size={20} /></span>
				<span class="key-word">{family.label}</span>
				<span class="family-dots" aria-hidden="true">
					{#each family.tools as id (id)}<i class:on={isActive(id)}></i>{/each}
				</span>
			</button>
		{/each}
		{#each directTools as tool (tool.id)}
			<button
				type="button"
				class:active={isActive(tool.id) && !libraryOpen}
				aria-pressed={isActive(tool.id)}
				title={tool.summary}
				onclick={() => onTool(tool.id)}
			>
				<span class="key-icon"><ShellIcon name={tool.icon} size={20} /></span>
				<span class="key-word">{tool.label}</span>
				{#if tool.shortcut}<span class="key-shortcut">{tool.shortcut}</span>{/if}
			</button>
		{/each}
		<button type="button" class:active={libraryOpen} aria-pressed={libraryOpen} title="Library (L)" onclick={() => openLibrary('objects')}>
			<span class="key-icon"><ShellIcon name="library" size={20} /></span>
			<span class="key-word">Library</span>
			<span class="key-shortcut">L</span>
		</button>
	</nav>
</section>

<style>
	.world-toolbar {
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		width: min(656px, calc(100vw - 20px));
		max-height: min(210px, 42vh);
		border: 1px solid rgb(241 245 237 / 0.14);
		border-radius: var(--ld-radius, 14px);
		background: var(--ld-forest, #173d2a);
		box-shadow: var(--ld-shadow, 0 14px 40px rgb(10 24 18 / 0.18));
		color: var(--ld-light, #f2f0e6);
		font-family: var(--ld-sans, 'Instrument Sans', system-ui, sans-serif);
		overflow: hidden;
	}
	.words,
	.pictures,
	.dock {
		flex: none;
		scrollbar-color: rgb(242 240 230 / 0.28) transparent;
		scrollbar-width: thin;
	}
	.words {
		display: flex;
		align-items: center;
		gap: 3px;
		height: 40px;
		padding: 0 10px;
		border-bottom: 1px solid var(--ld-hairline, rgb(240 244 236 / 0.16));
		overflow-x: auto;
	}
	.words button {
		flex: none;
		height: 28px;
		padding: 0 8px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--ld-light-2, #c3d1c6);
		font: 500 12px/1 var(--ld-sans, 'Instrument Sans', system-ui, sans-serif);
		cursor: pointer;
	}
	.words button:hover {
		background: rgb(242 240 230 / 0.08);
		color: var(--ld-light, #f2f0e6);
	}
	.words button.active {
		background: transparent;
		color: var(--ld-light, #f2f0e6);
		box-shadow: inset 0 -2px 0 var(--ld-mint, #96c7a9);
	}
	.words .close-word {
		margin-left: auto;
	}
	.selection-title {
		flex: none;
		font-family: var(--ld-serif, 'Fraunces', Georgia, serif);
		font-size: 17px;
		font-weight: 500;
		letter-spacing: -0.01em;
	}
	.selection-kind,
	.planned-word {
		flex: none;
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ld-light-2, #c3d1c6);
	}
	.selection-kind {
		margin-left: 4px;
	}
	.planned-word {
		margin-left: auto;
		padding: 3px 7px;
		border: 1px solid var(--ld-hairline, rgb(240 244 236 / 0.16));
		border-radius: 999px;
		color: var(--ld-mint, #96c7a9);
	}
	.pictures {
		display: flex;
		align-items: center;
		height: 62px;
		padding: 0 8px;
		overflow-x: auto;
		overflow-y: hidden;
	}
	.library-pictures {
		align-items: stretch;
		padding: 5px 8px;
	}
	.dock {
		display: flex;
		align-items: stretch;
		height: 62px;
		border-top: 1px solid var(--ld-hairline, rgb(240 244 236 / 0.16));
		overflow-x: auto;
		overflow-y: hidden;
	}
	.dock > button {
		position: relative;
		flex: 1 0 54px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 54px;
		border: 0;
		border-right: 1px solid rgb(240 244 236 / 0.08);
		background: transparent;
		color: var(--ld-light-2, #c3d1c6);
		cursor: pointer;
	}
	.dock > button:hover {
		background: rgb(242 240 230 / 0.06);
		color: var(--ld-light, #f2f0e6);
	}
	.dock > button.active {
		background: rgb(150 199 169 / 0.11);
		color: var(--ld-light, #f2f0e6);
	}
	.dock > button.active::after {
		content: '';
		position: absolute;
		inset: auto 14px 0;
		height: 2px;
		background: var(--ld-mint, #96c7a9);
	}
	.key-icon {
		display: grid;
		place-items: center;
		height: 22px;
	}
	.key-word {
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}
	.key-shortcut {
		position: absolute;
		top: 4px;
		right: 5px;
		font-family: var(--ld-mono, 'DM Mono', monospace);
		font-size: 7px;
		color: rgb(242 240 230 / 0.4);
	}
	.family-dots {
		display: flex;
		gap: 2px;
		height: 4px;
	}
	.family-dots i {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: rgb(242 240 230 / 0.27);
	}
	.family-dots i.on {
		background: var(--ld-mint, #96c7a9);
	}
	.library-row,
	.library-plan-row {
		display: flex;
		gap: 6px;
		min-width: max-content;
		height: 100%;
	}
	.object-tile,
	.material-tile,
	.planned-tile {
		display: grid;
		grid-template-rows: 1fr auto;
		gap: 2px;
		place-items: center;
		width: 78px;
		height: 100%;
		padding: 4px;
		border: 1px solid rgb(240 244 236 / 0.12);
		border-radius: 8px;
		background: rgb(242 240 230 / 0.04);
		color: var(--ld-light, #f2f0e6);
		font: 10px/1.15 var(--ld-sans, 'Instrument Sans', system-ui, sans-serif);
		text-align: center;
		cursor: pointer;
	}
	.object-tile span:last-child,
	.material-tile span,
	.planned-tile span {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.object-glyph {
		display: grid;
		place-items: center;
		width: 100%;
		height: 30px;
		border-radius: 5px;
		background: rgb(242 240 230 / 0.08);
	}
	.material-tile i {
		width: 100%;
		height: 30px;
		border: 1px solid rgb(242 240 230 / 0.16);
		border-radius: 5px;
	}
	.planned-tile:disabled {
		opacity: 0.58;
		cursor: default;
	}
	.planned-tile small {
		font-size: 8px;
		color: var(--ld-mint, #96c7a9);
	}
	.library-note {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		color: var(--ld-light-2, #c3d1c6);
		font-size: 11px;
	}
	.library-note strong {
		font-family: var(--ld-serif, 'Fraunces', Georgia, serif);
		font-size: 15px;
		color: var(--ld-light, #f2f0e6);
	}
	.library-note button,
	.selection-actions button,
	.stage-hint button {
		height: 30px;
		padding: 0 11px;
		border: 1px solid rgb(240 244 236 / 0.2);
		border-radius: 7px;
		background: rgb(242 240 230 / 0.06);
		color: var(--ld-light, #f2f0e6);
		font: 500 11px/1 var(--ld-sans, 'Instrument Sans', system-ui, sans-serif);
		cursor: pointer;
	}
	.selection-empty {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		color: var(--ld-light-2, #c3d1c6);
		font-size: 11px;
	}
	.selection-empty strong {
		margin-right: 6px;
		color: var(--ld-light, #f2f0e6);
		font-family: var(--ld-serif, 'Fraunces', Georgia, serif);
		font-size: 14px;
		font-weight: 500;
	}
	.selection-empty kbd {
		margin-left: auto;
		padding: 2px 6px;
		border: 1px solid rgb(240 244 236 / 0.16);
		border-radius: 4px;
		font-family: var(--ld-mono, 'DM Mono', monospace);
		font-size: 8px;
		color: rgb(242 240 230 / 0.62);
	}
	.selection-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		overflow-x: auto;
	}
	.selection-actions button:first-child {
		border-color: var(--ld-gold, #c8a653);
		background: var(--ld-gold, #c8a653);
		color: var(--ld-forest-deep, #102d20);
	}
	.selection-actions button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.stage-hint {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		color: var(--ld-light-2, #c3d1c6);
		font-size: 11px;
	}
	.stage-hint button {
		margin-left: auto;
	}
	.planned-options {
		display: flex;
		align-items: center;
		gap: 18px;
		width: 100%;
		overflow-x: auto;
	}
	.option-group {
		display: grid;
		gap: 4px;
		flex: none;
	}
	.option-group > span {
		font-size: 9px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ld-light-2, #c3d1c6);
	}
	.option-group > div {
		display: flex;
		gap: 2px;
	}
	.option-group button {
		height: 28px;
		padding: 0 9px;
		border: 0;
		border-radius: 6px;
		background: rgb(242 240 230 / 0.06);
		color: var(--ld-light, #f2f0e6);
		font: 11px var(--ld-sans, 'Instrument Sans', system-ui, sans-serif);
	}
	.option-group button:disabled {
		opacity: 0.45;
	}
	.planned-options p {
		flex: 1 0 190px;
		margin: 0;
		color: var(--ld-light-2, #c3d1c6);
		font-size: 10px;
		line-height: 1.35;
	}
	button:focus-visible {
		outline: 2px solid var(--ld-gold, #c8a653);
		outline-offset: 1px;
	}
	@media (max-width: 760px) {
		.world-toolbar {
			width: calc(100vw - 16px);
			max-height: 46vh;
		}
		.words {
			height: 42px;
			padding: 0 8px;
		}
		.pictures {
			height: 66px;
		}
		.dock {
			height: 58px;
		}
		.dock > button {
			flex-basis: 58px;
			min-width: 58px;
		}
		.key-word {
			font-size: 9px;
		}
	}
	@media (pointer: coarse) {
		.words button,
		.dock > button {
			min-height: 44px;
		}
	}
</style>
