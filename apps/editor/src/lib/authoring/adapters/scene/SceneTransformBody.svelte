<script lang="ts">
	import { ShellIcon } from '$lib/authoring/stage/stage-adapter-host';
	import type { ArmedFormCopy } from './placement';
	import MyObjectsSectionLazy from './library/MyObjectsSectionLazy.svelte';
	import { SHAPE_KINDS } from './shape/outline';
	import type { ObjectTile } from './shape/armed-tile';

	const OBJECT_TILES: readonly { readonly id: ObjectTile; readonly label: string; readonly summary: string }[] = [
		...SHAPE_KINDS,
		{ id: 'sphere', label: 'Sphere', summary: 'Click to place a sphere.' }
	];

	let {
		composeTask,
		composeActive,
		composeSubjectId,
		composeSubject,
		composeSupport,
		candidate,
		onFocusOut,
		cancel,
		composeScaleText,
		scaleInput = $bindable(),
		onKeydown,
		updateScale,
		commitResize,
		beginResize,
		duplicateSelected,
		deleteSelected,
		armedModelPresent,
		activeTile,
		chooseTile,
		drawCanFinish,
		finishDraw,
		compact,
		setCompact,
		catalogueModels,
		placementChoice,
		chooseCatalogueModel,
		placeTask,
		inStudio,
		armedFormCopy,
		armFormCopy,
		clearFormCopy,
		openImport,
		precisionOpen,
		x = $bindable(),
		z = $bindable(),
		place,
		message
	}: {
		composeTask: boolean;
		composeActive: boolean;
		composeSubjectId: string | null;
		composeSubject: { id: string } | null;
		composeSupport: { resize: boolean; duplicate: boolean; reason: string | null } | null;
		candidate: { kind: string } | null;
		onFocusOut: (event: FocusEvent) => void;
		cancel: () => void;
		composeScaleText: string;
		scaleInput: HTMLInputElement | null;
		onKeydown: (event: KeyboardEvent) => void;
		updateScale: (text: string) => void;
		commitResize: () => void;
		beginResize: () => void;
		duplicateSelected: () => void;
		deleteSelected: () => void;
		armedModelPresent: boolean;
		activeTile: ObjectTile;
		chooseTile: (tile: ObjectTile) => void;
		drawCanFinish: boolean;
		finishDraw: () => void;
		compact: boolean;
		setCompact: (next: boolean) => void;
		catalogueModels: readonly { id: string; name: string }[];
		placementChoice: string;
		chooseCatalogueModel: (assetId: string) => void;
		placeTask: boolean;
		inStudio: boolean;
		armedFormCopy: ArmedFormCopy | null;
		armFormCopy: (copy: ArmedFormCopy) => boolean;
		clearFormCopy: () => void;
		openImport: () => void;
		precisionOpen: boolean;
		x: string;
		z: string;
		place: () => void;
		message: string;
	} = $props();

	const armedName = $derived.by(() => {
		if (armedFormCopy !== null) return armedFormCopy.item.name;
		if (!armedModelPresent) return null;
		const assetId = placementChoice.startsWith('catalogue:') ? placementChoice.slice('catalogue:'.length) : null;
		return catalogueModels.find((asset) => asset.id === assetId)?.name ?? 'Imported model';
	});
</script>
<section class="scene-instrument" aria-label="Scene transform">
	{#if composeTask}
		<div class="editing" onfocusout={onFocusOut}>
			<div class="row">
				<span class="subject"
					>Compose <code>{composeActive ? (composeSubjectId ?? 'no entity')
							: (composeSubject?.id ?? 'no entity')}</code></span
				>
				{#if composeActive}<button type="button" class="quiet" onclick={cancel}>Cancel</button>{/if}
			</div>
			{#if composeActive}
				<div class="fields">
					<label>
						<span>Scale (uniform)</span>
						<input
							bind:this={scaleInput}
							type="text"
							inputmode="decimal"
							value={composeScaleText}
							onkeydown={onKeydown}
							oninput={(event) => updateScale(event.currentTarget.value)}
						/>
					</label>
					<button type="button" onclick={commitResize} disabled={candidate?.kind !== 'resize'}>Resize</button>
				</div>
			{:else}
				<div class="row">
					<button
						type="button"
						onmousedown={(event) => event.preventDefault()}
						onclick={beginResize}
						disabled={composeSupport === null || !composeSupport.resize}
					>
						Resize…
					</button>
				</div>
			{/if}
			<div class="row">
				<button type="button" onclick={duplicateSelected} disabled={composeSupport === null || !composeSupport.duplicate}>Duplicate</button>
				<button type="button" onclick={deleteSelected} disabled={composeSubject === null}>Delete</button>
			</div>

			{#if composeSupport?.reason}
				<p class="hint">{composeSupport.reason}</p>
			{/if}
		</div>
	{:else}
		<div class="objects-tiles" role="group" aria-label="Shapes">
			{#each OBJECT_TILES as tile (tile.id)}
				<button
					type="button"
					aria-pressed={armedName === null && activeTile === tile.id}
					title={tile.summary}
					onclick={() => chooseTile(tile.id)}
				><ShellIcon
						name={tile.id === 'sphere'
							? 'round'
							: tile.id === 'box'
								? 'view3d'
								: 'shape'}
						size={26}
					/><span>{tile.label}</span></button>
			{/each}
			{#if armedName !== null}<span class="armed-name">{armedName}</span>{/if}
			{#if drawCanFinish}<button type="button" onclick={finishDraw}>Finish</button>{/if}
			{#if compact}<button type="button" class="quiet" onclick={() => setCompact(false)}>All</button>{/if}
		</div>
		{#if !compact}
			{#if catalogueModels.length > 0}
				<div class="objects-section">
					<h4>Models</h4>
					<ul class="objects-models">
						{#each catalogueModels as asset (asset.id)}
							<li>
								<button
									type="button"
									aria-pressed={placementChoice === `catalogue:${asset.id}`}
									onclick={() => chooseCatalogueModel(asset.id)}
								><ShellIcon name="object" size={26} /><span>{asset.name}</span
									></button>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if placeTask && !inStudio}
				<MyObjectsSectionLazy
					armedCopy={armedFormCopy}
					onArm={armFormCopy}
					onClear={clearFormCopy}
				/>
				<button type="button" onclick={openImport}>Import model…</button>
			{/if}
			{#if precisionOpen}
				<div class="row place" role="group" aria-label="Exact position">
					<span>Exact position</span>
					<label>
						<span>X (m)</span>
						<input type="text" inputmode="decimal" value={x} oninput={(event) => (x = event.currentTarget.value)} />
					</label>
					<label>
						<span>Z (m)</span>
						<input type="text" inputmode="decimal" value={z} oninput={(event) => (z = event.currentTarget.value)} />
					</label>
					<button type="button" onclick={place}>Place</button>
				</div>
			{/if}
		{/if}
	{/if}

	<p class="feedback" hidden={!message} aria-live="polite">{message}</p>
</section>


<style>
	.objects-tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
		gap: 6px;
	}

	.objects-section h4 {
		margin: 0 0 0.25rem;
		font-size: inherit;
		font-weight: 600;
	}

	.objects-models {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.armed-name {
		padding: 0 0.25rem;
	}

	.scene-instrument {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.78rem;
	}

	.row {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.fields {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.editing {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	label > span {
		color: var(--shell-ink-quiet);
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	input,
	button {
		font: inherit;
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--shell-ink-quiet);
		border-radius: 0.3rem;
		background: var(--shell-forest-raised);
		color: inherit;
	}

	input {
		width: 6.5rem;
	}

	button {
		cursor: pointer;
	}

	button:disabled {
		cursor: default;
		opacity: 0.5;
	}

	button.quiet {
		background: transparent;
	}

	.subject code {
		color: var(--shell-gold);
	}

	.hint {
		color: var(--shell-ink-quiet);
	}

	.feedback {
		margin: 0;
		min-height: 1.1rem;
		color: var(--shell-ink-light);
	}
	.objects-tiles button,
	.objects-models button {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 6px;
		min-height: 62px;
		width: 100%;
		border: 2px solid transparent;
		border-radius: 8px;
		background: var(--shell-forest-raised);
		color: var(--shell-ink-light);
		font: 600 11px var(--shell-sans);
	}
	.objects-tiles button[aria-pressed='true'],
	.objects-models button[aria-pressed='true'] {
		border-color: var(--shell-gold);
		background: color-mix(in srgb, var(--shell-gold) 18%, transparent);
		color: var(--shell-ink-light);
	}
	.objects-models {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
		gap: 6px;
	}
	.row.place {
		padding-top: 8px;
		border-top: 1px solid var(--shell-line-on-forest);
		font-size: 11px;
	}
	@media (pointer: coarse) {
		button,
		input {
			min-width: 44px;
			min-height: 44px;
		}
	}
</style>
