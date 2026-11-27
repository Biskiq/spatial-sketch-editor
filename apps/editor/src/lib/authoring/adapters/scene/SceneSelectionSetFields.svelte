<script lang="ts">
	/**
	 * The Set Card's rows.
	 *
	 * A set has no primary, so its Card lists every identity it holds: a group
	 * reads as `Group · N items`, an object as its kind, and a light as `Light`.
	 * Pressing a row selects that one subject, which is the same canonical write
	 * the Stage uses. The reasons a set cannot Group or Light it are stated here,
	 * in the owning domain's words, and never as a disabled control with no
	 * explanation.
	 */
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { stageScene } from '$lib/authoring/stage/stage-adapter-host';
	import { sceneClusterById, sceneClusterMemberIds } from '../../scene/selection-target';

	let { services }: { services: StageAdapterServices } = $props();

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

	function reasons(): readonly string[] {
		const selection = services.stage.selectionState();
		const current = scene();
		const lines: string[] = [];
		const groups = selection.ordered
			.filter(
				(entry) =>
					entry.reference.domain === 'scene' && entry.reference.subject.kind === 'cluster',
			)
			.map((entry) => sceneClusterById(current, entry.reference.subject.id)?.name ?? 'a group');
		if (groups.length > 0)
			lines.push(
				`Group: a group can’t hold another group. Ungroup ${groups.join(', ')} first.`,
			);
		const hasLight = selection.ordered.some((entry) => {
			if (entry.reference.domain !== 'scene') return false;
			if (entry.reference.subject.kind === 'cluster') {
				return sceneClusterMemberIds(current, entry.reference.subject.id).some(
					(id) => current.entities.find((entity) => entity.id === id)?.kind === 'light',
				);
			}
			return (
				current.entities.find((entity) => entity.id === entry.reference.subject.id)?.kind ===
				'light'
			);
		});
		if (hasLight) lines.push('Light it: a light cannot be lit; select Artwork or an object.');
		return lines;
	}

	function select(reference: (ReturnType<typeof rows>)[number]['reference']): void {
		services.stage.setSelection({ ordered: [{ reference }], primary: reference });
	}
</script>

<div class="set-fields" data-selection-set-card-fields aria-label="Selected subjects">
	<div class="rows">
		{#each rows() as row (row.id)}
			<button
				type="button"
				class="row"
				data-set-row={row.id}
				title={`Select ${row.name}`}
				onclick={() => select(row.reference)}
			>
				<span class="name">{row.name}</span>
				<span class="kind">{row.kind}</span>
				<span class="go" aria-hidden="true">›</span>
			</button>
		{/each}
	</div>
	{#if reasons().length > 0}
		<p class="why" role="note">{reasons().join(' ')}</p>
	{/if}
</div>

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
		cursor: pointer;
	}
	.row:hover {
		background: var(--shell-field);
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
	.row .go {
		color: var(--shell-ink-3);
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
