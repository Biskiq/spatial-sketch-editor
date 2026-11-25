<script lang="ts">
	import type { ArtworkLibraryEntry } from '@portfolio/project-model/artwork';
	import type { MaterialId } from '@portfolio/project-model/scene';
	import type { Snippet } from 'svelte';
	import FinishTile from '$lib/authoring/look/FinishTile.svelte';
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import { foldVariantCards, variantCardOf } from '$lib/content/material-presentation';
	import type { LookLibraryShelf } from '$lib/authoring/look/look-authoring.svelte';
	import type { SceneFinishRef } from '@portfolio/project-model/scene-planning';
	import type { FinishImageState } from '$lib/authoring/look/finish-image.svelte';
	import WorldIcon from './WorldIcon.svelte';
	import type { WorldLibraryCategory } from './registry';

	let {
		category,
		artworkShelf,
		lookShelf,
		approvedAssets,
		visibleMaterials,
		finishShelf,
		finishTileSource,
		finishImage,
		onFinishPick,
		onMaterialPick,
		onObjectPick,
		onArtworkPick,
		onArtworkImport,
		onLookPick,
		onFinishImageImport,
		onFinishImageCancel,
		onFinishImageRetry,
		onFinishImageReset
	}: {
		category: WorldLibraryCategory | 'look' | 'artwork';
		artworkShelf: readonly ArtworkLibraryEntry[] | null;
		lookShelf: LookLibraryShelf | null;
		approvedAssets: readonly { readonly id: string; readonly name: string }[];
		visibleMaterials: readonly {
			readonly id: string;
			readonly label: string;
			readonly swatchColor?: string | null;
			readonly fallbackColor: string;
		}[];
		finishShelf: {
			readonly curated: readonly { readonly id: MaterialId; readonly label: string; readonly color: string }[];
			readonly project: readonly {
				readonly id: string;
				readonly name: string;
				readonly color: string;
				readonly imageUri: string | null;
				readonly warning: string | null;
			}[];
		} | null;
		finishTileSource: (finishId: string) => FinishTileSource | null;
		finishImage: FinishImageState | null;
		onFinishPick: (ref: SceneFinishRef) => void;
		onMaterialPick: (materialId: string) => void;
		onObjectPick: (assetId: string) => void;
		onArtworkPick: (entry: ArtworkLibraryEntry) => void;
		onArtworkImport: (files: File[]) => void;
		onLookPick: (entryId: string) => void;
		onFinishImageImport: (file: File) => void;
		onFinishImageCancel: () => void;
		onFinishImageRetry: () => void;
		onFinishImageReset: () => void;
	} = $props();

	/** D1: a variant card shows one entry and a chip row for the rest. */
	let variantChoice = $state<Record<string, string>>({});
	const curatedCards = $derived(
		finishShelf === null
			? []
			: foldVariantCards(finishShelf.curated, (primary) => variantChoice[primary] as MaterialId | undefined).map(
					(card) => ({ ...card, label: card.cardLabel ?? card.label })
				)
	);
	let artworkFileInput = $state<HTMLInputElement>();
	let finishFileInput = $state<HTMLInputElement>();
</script>

					{#if category === 'artwork' && artworkShelf !== null}
						<div class="librow" aria-label="Artwork in this project">
							<input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden bind:this={artworkFileInput}
								onchange={() => { onArtworkImport(Array.from(artworkFileInput?.files ?? [])); if (artworkFileInput) artworkFileInput.value = ''; }} />
							<button class="tile" type="button" onclick={() => artworkFileInput?.click()}>Import</button>
							{#each artworkShelf as entry (entry.assetId)}
								<button class="tile" type="button" title={entry.name} onclick={() => onArtworkPick(entry)}>{entry.name}</button>
							{/each}
						</div>
					{:else if category === 'look' && lookShelf !== null}
						<div class="librow" aria-label={lookShelf.label}>
							{#each lookShelf.entries as entry (entry.id)}
								<button type="button" class="tile" title={entry.summary ?? entry.label} onclick={() => onLookPick(entry.id)}>
									<span class="tile-glyph"><WorldIcon name="sun" size={20} /></span>
									<span class="tile-label">{entry.label}</span>
								</button>
							{/each}
						</div>
					{:else if category === 'objects'}
						<div class="librow" aria-label="Approved objects">
							{#each approvedAssets as asset (asset.id)}
								<button type="button" class="tile" title={asset.name} onclick={() => onObjectPick(asset.id)}>
									<span class="tile-glyph"><WorldIcon name="object" size={20} /></span>
									<span class="tile-label">{asset.name}</span>
								</button>
							{/each}
						</div>
					{:else if category === 'materials'}
						<div class="librow" aria-label="Finishes">
							{#if finishShelf === null}
								{#each visibleMaterials as material (material.id)}
									<button type="button" class="tile" title={material.label} onclick={() => onMaterialPick(material.id)}>
										<i class="material" style:background={material.swatchColor ?? material.fallbackColor}></i>
										<span class="tile-label">{material.label}</span>
									</button>
								{/each}
							{:else}
								{#each curatedCards as finish (finish.variants.length > 0 ? `card:${finish.label}` : finish.id)}
									<div class="finish-card" class:variants={finish.variants.length > 0}>
										<button
											type="button"
											class="tile"
											title={finish.variants.length > 0
												? `${finish.label}, ${finish.variants.find((v) => v.id === finish.id)?.label ?? ''}`
												: finish.label}
											data-finish-tile={`curated:${finish.id}`}
											onclick={() => onFinishPick({ curated: finish.id })}
										>
											<FinishTile
												source={{ kind: 'catalogue', id: finish.id }}
												color={finish.color}
												size={32}
											/>
											<span class="tile-label">{finish.label}</span>
										</button>
										{#if finish.variants.length > 0}
											<div class="variant-chip" role="group" aria-label={`${finish.label} finish`}>
												{#each finish.variants as variant (variant.id)}
													<button
														type="button"
														class:on={variant.id === finish.id}
														aria-pressed={variant.id === finish.id}
														data-finish-variant={variant.id}
														onclick={() => {
															const group = variantCardOf(variant.id);
															if (group !== undefined) variantChoice[group.primary] = variant.id;
														}}>{variant.label}</button
													>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
								{#each finishShelf.project as finish (finish.id)}
									<button
										type="button"
										class="tile"
										title={finish.warning ?? finish.name}
										data-finish-tile={`project:${finish.id}`}
										onclick={() => onFinishPick({ project: finish.id })}
									>
										<FinishTile
											source={finishTileSource(finish.id)}
											color={finish.color}
											imageUri={finish.imageUri}
											size={32}
										/>
										<span class="tile-label">{finish.name}</span>
									</button>
								{/each}
								<input
									type="file"
									accept="image/png,image/jpeg,image/webp"
									hidden
									bind:this={finishFileInput}
									onchange={() => {
										const file = finishFileInput?.files?.[0] ?? null;
										if (finishFileInput) finishFileInput.value = '';
										if (file !== null) onFinishImageImport(file);
								}}
								/>
								{#if finishImage !== null && finishImage.phase !== 'idle'}
									<div class="finish-image-state" data-finish-image-phase={finishImage.phase}>
										{#if finishImage.phase === 'checking' || finishImage.phase === 'uploading'}
											<span class="spinner" aria-hidden="true"></span>
											<span>{finishImage.phase === 'checking' ? 'Checking' : 'Uploading'} {finishImage.fileName}…</span>
											<button type="button" class="act" data-finish-image-cancel onclick={onFinishImageCancel}>Cancel</button>
										{:else if finishImage.phase === 'saving'}
											<span class="spinner" aria-hidden="true"></span>
											<span>Saving {finishImage.fileName}…</span>
										{:else if finishImage.phase === 'failed'}
											<span class="finish-image-message">{finishImage.message ?? 'Upload failed.'}</span>
											{#if finishImage.message !== null && finishImage.fileName !== null}
												<button type="button" class="act" data-finish-image-retry onclick={onFinishImageRetry}>Try again</button>
											{/if}
											<button type="button" class="act" onclick={onFinishImageReset}>Dismiss</button>
										{:else if finishImage.phase === 'refused'}
											<span class="finish-image-message">{finishImage.message}</span>
											<button type="button" class="act" onclick={onFinishImageReset}>Dismiss</button>
										{:else}
											<span class="finish-image-message">Image added.</span>
											<button type="button" class="act" onclick={onFinishImageReset}>Dismiss</button>
										{/if}
										{#if finishImage.warning !== null}
											<span class="finish-image-warning">{finishImage.warning}</span>
										{/if}
									</div>
								{:else}
									<button
										type="button"
										class="tile"
										title="Make a Finish from a PNG, JPEG or WebP"
										data-finish-image-add
										onclick={() => finishFileInput?.click()}
									>
										<i class="material from-image" aria-hidden="true">+</i>
										<span class="tile-label">From image</span>
									</button>
								{/if}
							{/if}
							<button
								type="button"
								class="tile"
								title="Model's own restores a model's imported material"
								data-finish-tile="model-own"
								onclick={() => onFinishPick('model-own')}
							>
								<i class="material model-own"></i>
								<span class="tile-label">Model's own</span>
							</button>
						</div>
					{:else if category === 'my-objects'}
						<div class="note">
							<strong>My objects</strong>
							<span>Your own uploads and saved combinations will live here.</span>
							<button type="button" class="act" onclick={() => onObjectPick('')}>Open the Objects panel</button>
						</div>
					{:else}
						<div class="librow planned-row">
							{#each (category === 'plants' ? ['Bed', 'Shrub', 'Hedge', 'Tree'] : ['House', 'Annex', 'Shed']) as label (label)}
								<button type="button" class="tile planned-tile" disabled>
									<span class="tile-glyph">
										<WorldIcon name={category === 'plants' ? 'plants' : 'building'} size={20} />
									</span>
									<span class="tile-label">{label}</span>
									<small>Planned · T{category === 'buildings' ? '5' : '2'}</small>
								</button>
							{/each}
						</div>
					{/if}

<style>
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
	.finish-card {
		position: relative;
		flex: none;
		display: flex;
		align-items: center;
		height: 100%;
	}
	.variant-chip {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 0 4px 0 -6px;
		padding: 2px;
		border-radius: 7px;
		background: color-mix(in srgb, var(--shell-ink, #000) 8%, transparent);
	}
	.variant-chip button {
		padding: 2px 5px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: var(--shell-ink-2, inherit);
		font: 8px/1.2 var(--shell-sans);
		text-align: left;
		cursor: pointer;
	}
	.variant-chip button.on {
		background: var(--shell-ink, #222);
		color: var(--shell-surface, #fff);
	}
	.material.from-image {
		display: grid;
		place-items: center;
		color: var(--shell-ink-quiet);
		font-size: 1rem;
	}
	.finish-image-state {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.35rem;
		font-size: var(--shell-text-utility);
	}
	.finish-image-message {
		max-width: 14rem;
	}
	.finish-image-warning {
		flex-basis: 100%;
		color: var(--shell-ink-quiet);
	}
	.spinner {
		width: 0.75rem;
		height: 0.75rem;
		border: 2px solid var(--shell-hairline);
		border-top-color: var(--stage-selection);
		border-radius: 50%;
		animation: finish-image-spin 0.8s linear infinite;
	}
	@keyframes finish-image-spin {
		to {
			transform: rotate(360deg);
		}
	}
	.material {
		width: 100%;
		height: 28px;
		border-radius: 4px;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--shell-ink) 12%, transparent);
	}
	.material.model-own {
		background: repeating-linear-gradient(
			135deg,
			var(--shell-hairline) 0 4px,
			var(--shell-ink-light) 4px 8px
		);
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
</style>
