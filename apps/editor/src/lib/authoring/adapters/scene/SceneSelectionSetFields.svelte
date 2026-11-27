<script lang="ts">
	/**
	 * The Set Card's rows.
	 *
	 * A set has no primary, so its Card lists every identity it holds: a group
	 * reads as `Group · N items`, an object as its kind, and a light as `Light`.
	 * Disabled actions keep their explanation beside the list.
	 */
	import type { Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { stageScene } from '$lib/authoring/stage/stage-adapter-host';
	import { groupSetActions } from './group-card';
	import { sceneClusterById } from '../../scene/selection-target';

	let { services, footer }: { services: StageAdapterServices; footer?: Snippet<[(string | false)?]> } =
		$props();

	const scene = () => stageScene(services.stage.snapshot());

	function rows() {
		const selection = services.stage.selectionState();
		const current = scene();
		return selection.ordered.map((entry) => {
			const reference = entry.reference;
			if (reference.subject.kind === 'cluster') {
				const cluster = sceneClusterById(current, reference.subject.id);
				return {
					id: `cluster:${reference.subject.id}`,
					reference,
					name: cluster?.name ?? reference.subject.id,
					kind: `Group · ${cluster?.memberIds.length ?? 0} items`,
				};
			}
			const entity = current.entities.find((candidate) => candidate.id === reference.subject.id);
			return {
				id: `entity:${reference.subject.id}`,
				reference,
				name: entity?.name ?? reference.subject.id,
				kind:
					entity === undefined
						? 'Subject'
						: entity.kind === 'light'
							? 'Light'
							: entity.kind === 'artwork'
								? 'Artwork'
								: 'Object',
			};
		});
	}

	function reasons(): string[] {
		return groupSetActions(services).flatMap((action) =>
			action.disabled && action.detail !== undefined ? [action.detail] : []);
	}
</script>

<div class="set-fields" data-selection-set-card-fields aria-label="Selected subjects">
	<div class="rows">
		{#each rows() as row (row.id)}
			<div class="row" data-set-row={row.id}>
				<span class="name">{row.name}</span>
				<span class="kind">{row.kind}</span>
			</div>
		{/each}
	</div>
	{#if reasons().length > 0}
		<p class="why" role="note">{reasons().join(' ')}</p>
	{/if}
</div>
{#if footer}{@render footer(false)}{/if}

<style>
	.set-fields {
		padding: 0 12px 8px;
	}
	.rows {
		display: grid;
		gap: 2px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 28px;
		padding: 0 6px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--shell-ink);
		font: 12px var(--shell-sans);
		text-align: left;
	}
	.row .name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row .kind {
		color: var(--shell-ink-2);
		font-size: 10.5px;
	}
	.why {
		margin: 6px 6px 0;
		color: var(--shell-ink-2);
		font-size: 10.5px;
		line-height: 1.35;
	}
	@media (pointer: coarse) {
		.row {
			min-height: 44px;
		}
	}
</style>
