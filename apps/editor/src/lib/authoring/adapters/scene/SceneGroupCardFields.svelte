<script lang="ts">
	/**
	 * The Group Card's member list.
	 *
	 * One row per member in the group's own order: pressing it drills into that
	 * member, which is the same canonical selection write the Stage uses, never a
	 * second selection model. The rows are read-only facts about membership; the
	 * group's name and actions belong to the Card shell and the adapter.
	 */
	import type { Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { stageScene } from '$lib/authoring/stage/stage-adapter-host';
	import {
		sceneClusterById,
		sceneClusterMembers,
		sceneEntityTargetReference,
	} from '../../scene/selection-target';

	let { services, footer, secondary }: {
		services: StageAdapterServices;
		footer?: Snippet<[(string | false)?]>;
		secondary?: Snippet;
	} = $props();

	function cluster() {
		const primary = services.stage.selectionState().primary;
		if (primary?.domain !== 'scene' || primary.subject.kind !== 'cluster') return null;
		return sceneClusterById(stageScene(services.stage.snapshot()), primary.subject.id);
	}

	function members() {
		const current = cluster();
		if (current === null) return [];
		return sceneClusterMembers(stageScene(services.stage.snapshot()), current.id);
	}

	function drill(entityId: string): void {
		const reference = sceneEntityTargetReference(
			entityId,
			services.stage.snapshot().domain.unitRevisions.scene,
		);
		services.stage.setSelection({ ordered: [{ reference }], primary: reference });
	}

	const kindWord = (kind: string): string =>
		kind === 'light' ? 'Light' : kind === 'artwork' ? 'Artwork' : 'Object';
</script>

{#if cluster() !== null}
	<div class="group-fields" data-scene-group-card-fields aria-label="Group members">
		<div class="members">
			{#each members() as member (member.id)}
				<button
					type="button"
					class="member"
					data-group-member={member.id}
					title={`Select ${member.name} in ${cluster()?.name ?? 'this group'}`}
					onclick={() => drill(member.id)}
				>
					<span class="name">{member.name}</span>
					<span class="kind">{kindWord(member.kind)}</span>
					<span class="go" aria-hidden="true">›</span>
				</button>
			{/each}
		</div>
	</div>
	{#if footer}{@render footer(false)}{/if}
	{#if secondary}{@render secondary()}{/if}
{/if}

<style>
	.group-fields {
		padding: 0 12px 8px;
	}
	.members {
		display: grid;
		gap: 2px;
	}
	.member {
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
	.member:hover {
		background: var(--shell-field);
	}
	.member .name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.member .kind {
		color: var(--shell-ink-2);
		font-size: 10.5px;
	}
	.member .go {
		color: var(--shell-ink-3);
	}
	@media (pointer: coarse) {
		.member {
			min-height: 44px;
		}
	}
</style>
