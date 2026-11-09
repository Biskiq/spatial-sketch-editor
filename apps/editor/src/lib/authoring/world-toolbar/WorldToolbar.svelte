<script lang="ts">
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
	const activeAccent = $derived(activeFamily?.accent ?? 'var(--ld-gold)');

	$effect(() => {
		const family = familyOf(activeTool);
		if (family !== null) remembered[family.id] = activeTool;
	});

	function pressFamily(family: WorldFamily): void {
		if (activeFamily?.id === family.id) return;
		onTool(remembered[family.id] ?? family.defaultTool);
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
	const directTools = $derived([dockToolFor('paint'), dockToolFor('erase')]);
</script>

<section
	class="world-toolbar"
	data-world-toolbar
	data-active-tool={activeTool}
	style:--acc={activeAccent}
>
	<div class="tier">
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
				{:else if activeTool === 'select'}
					<button type="button" class="sub on" aria-pressed="true">
						Select<kbd>V</kbd>
					</button>
					{#if selection !== null}
						<span class="pn selection">
							<i class="selection-dot" aria-hidden="true"></i>
							<b>{selection.label}</b>
							<span>{selection.kind}</span>
						</span>
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
					{#if libraryCategory === 'objects'}
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
				{:else if activeTool === 'select' && selection === null}
					<div class="pn empty">
						<span><strong>Nothing selected</strong> Choose a wall, room or object on the Stage, or use the Index.</span>
						<kbd>V</kbd>
					</div>
				{:else if activeTool === 'select' && selection !== null}
					<div class="pg end">
						<span class="gl"></span>
						<div class="opts">
							{#each selection.actions as action (action.label)}
								<button type="button" class="act primary" onclick={action.run}>{action.label}</button>
							{/each}
							<button type="button" class="act" disabled title="Turning a selected subject arrives with T1">Turn</button>
							<button type="button" class="act" disabled title="Replacement arrives with T1">Replace</button>
						</div>
					</div>
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

	<nav class="dock" aria-label="World tool families">
		<button
			type="button"
			class="key"
			class:armed={activeTool === 'select' && !libraryOpen}
			aria-pressed={activeTool === 'select' && !libraryOpen}
			title="Select (V)"
			onclick={() => onTool('select')}
		>
			<WorldIcon name="select" size={25} />
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
				title={`${family.label}: ${family.tools.map((id) => worldTool(id).label).join(', ')}`}
				style:--key-acc={family.accent}
				onclick={() => pressFamily(family)}
			>
				<WorldIcon name={family.icon} size={25} />
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
				title={tool.summary}
				onclick={() => onTool(tool.id)}
			>
				<WorldIcon name={tool.icon} size={25} />
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
			title="Library (L)"
			onclick={() => openLibrary('objects')}
		>
			<WorldIcon name="library" size={25} />
			<span class="kl">Library</span>
			<kbd class="kk">L</kbd>
		</button>
	</nav>
</section>

<style>
	.world-toolbar {
		--ld-plate-line: rgb(38 35 29 / 0.12);
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		width: min(656px, 100%);
		max-height: min(228px, 46vh);
		border: 0;
		border-radius: var(--ld-radius);
		background: var(--ld-forest);
		box-shadow: 0 18px 46px rgb(8 20 13 / 0.34), 0 2px 6px rgb(8 20 13 / 0.18);
		color: var(--ld-light);
		font-family: var(--ld-sans);
		overflow: hidden;
	}
	.tier {
		flex: none;
		background: var(--ld-paper);
		color: var(--ld-ink);
	}
	.row,
	.strip,
	.dock {
		scrollbar-color: rgb(38 35 29 / 0.24) transparent;
		scrollbar-width: thin;
	}
	.row {
		display: flex;
		align-items: stretch;
		box-sizing: border-box;
	}
	.words {
		height: 40px;
	}
	.picks {
		height: 62px;
		border-top: 1px solid var(--ld-plate-line);
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
		color: var(--ld-ink-3);
		font: 500 17.5px/1 var(--ld-serif);
		letter-spacing: -0.012em;
		cursor: pointer;
	}
	.sub:hover {
		color: var(--ld-ink);
	}
	.sub.on {
		color: var(--ld-ink);
	}
	.sub.on::after {
		content: '';
		position: absolute;
		right: 7px;
		bottom: 3px;
		left: 7px;
		height: 2px;
		border-radius: 2px;
		background: var(--acc, var(--ld-gold));
	}
	.sub kbd {
		transform: translateY(-5px);
		color: var(--ld-ink-3);
		font: 400 8px/1 var(--ld-mono);
	}
	.pn {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		margin-left: 4px;
		color: var(--ld-ink-3);
		font: 11px/1.2 var(--ld-sans);
		overflow: hidden;
	}
	.pn b {
		flex: none;
		color: var(--ld-ink);
		font: 500 14px/1 var(--ld-serif);
	}
	.pn > span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pn.selection {
		gap: 7px;
	}
	.selection-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ld-gold);
	}
	.planned {
		flex: none;
		margin-left: auto;
		padding-right: 2px;
		color: var(--acc);
		font: 400 9px/1 var(--ld-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.close-word {
		flex: none;
		margin-left: auto;
		padding: 4px 6px 4px 10px;
		border: 0;
		background: transparent;
		color: var(--ld-ink-2);
		font: 500 10px/1 var(--ld-sans);
		cursor: pointer;
	}
	.close-word:hover {
		color: var(--ld-ink);
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
	.pg.end {
		margin-left: auto;
	}
	.gl {
		color: var(--ld-ink-3);
		font: 400 9.5px/1 var(--ld-mono);
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
		color: var(--ld-ink-2);
	}
	button.opt {
		cursor: pointer;
	}
	.opt:hover {
		background: rgb(38 35 29 / 0.075);
		color: var(--ld-ink);
	}
	.opt:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.opt.text {
		min-width: 0;
		padding: 0 8px;
		font: 500 11px/1 var(--ld-sans);
		white-space: nowrap;
	}
	.act {
		flex: none;
		height: 30px;
		padding: 0 8px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--ld-ink-2);
		font: 500 11.5px/1 var(--ld-sans);
		white-space: nowrap;
		cursor: pointer;
	}
	.act:hover {
		background: rgb(38 35 29 / 0.07);
		color: var(--ld-ink);
	}
	.act.primary {
		color: var(--ld-forest);
		font-weight: 600;
	}
	.act:disabled {
		color: var(--ld-ink-3);
		opacity: 0.42;
		cursor: default;
	}
	.empty {
		width: 100%;
		margin-left: 0;
		font-size: 11px;
	}
	.empty strong {
		margin-right: 5px;
		color: var(--ld-ink);
		font: 500 14px/1 var(--ld-serif);
	}
	.empty kbd {
		flex: none;
		margin-left: auto;
		padding: 2px 5px;
		border-radius: 3px;
		background: rgb(38 35 29 / 0.07);
		color: var(--ld-ink-3);
		font: 400 8px/1 var(--ld-mono);
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
		color: var(--ld-ink-3);
		font: 10px/1.35 var(--ld-sans);
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
		color: var(--ld-ink);
		font: 9.5px/1.1 var(--ld-sans);
		text-align: center;
		cursor: pointer;
	}
	.tile:hover {
		background: rgb(38 35 29 / 0.07);
	}
	.tile-glyph {
		display: grid;
		place-items: center;
		width: 100%;
		height: 28px;
		border-radius: 4px;
		background: rgb(38 35 29 / 0.055);
		color: var(--ld-ink-2);
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
		box-shadow: inset 0 0 0 1px rgb(38 35 29 / 0.12);
	}
	.planned-tile:disabled {
		opacity: 0.48;
		cursor: default;
	}
	.planned-tile small {
		color: var(--ld-ink-3);
		font: 8px/1 var(--ld-mono);
	}
	.note {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		color: var(--ld-ink-3);
		font: 10.5px/1.3 var(--ld-sans);
	}
	.note strong {
		flex: none;
		color: var(--ld-ink);
		font: 500 15px/1 var(--ld-serif);
	}
	.note .act {
		margin-left: auto;
	}
	.dock {
		flex: none;
		display: flex;
		align-items: stretch;
		height: 62px;
		overflow-x: auto;
		overflow-y: hidden;
		background: var(--ld-forest);
	}
	.key {
		position: relative;
		flex: 1 0 54px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 54px;
		padding: 0 4px;
		border: 0;
		background: transparent;
		color: var(--ld-light-2);
		cursor: pointer;
	}
	.key:hover {
		background: rgb(251 246 234 / 0.045);
		color: var(--ld-paper);
	}
	.key.armed {
		background: rgb(0 0 0 / 0.17);
		color: var(--ld-paper);
	}
	.kl {
		font: 500 13px/1 var(--ld-sans);
		letter-spacing: -0.005em;
		white-space: nowrap;
	}
	.kk {
		position: absolute;
		top: 4px;
		right: 5px;
		color: rgb(251 246 234 / 0.32);
		font: 400 7px/1 var(--ld-mono);
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
		background: rgb(251 246 234 / 0.25);
	}
	.family-dots i.on {
		background: var(--key-acc);
	}
	.sep {
		flex: none;
		align-self: stretch;
		width: 1px;
		margin: 12px 0;
		background: rgb(251 246 234 / 0.09);
	}
	button:focus-visible {
		outline: 2px solid var(--ld-gold);
		outline-offset: -2px;
	}
	@media (max-width: 760px) {
		.world-toolbar {
			width: 100%;
			max-height: 48vh;
		}
		.words {
			height: 40px;
		}
		.picks {
			height: 62px;
		}
		.dock {
			height: 58px;
		}
		.key {
			flex-basis: 55px;
			min-width: 55px;
		}
		.kl {
			font-size: 12px;
		}
	}
	@media (pointer: coarse) {
		.sub,
		.key {
			min-height: 44px;
		}
	}
</style>
