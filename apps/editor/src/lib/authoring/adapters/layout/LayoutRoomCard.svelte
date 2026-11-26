<script lang="ts">
	/**
	 * The Room Card's writer: the Room's area facts, then its Floor and
	 * Ceiling Finishes through the shared Finish section. The Room's relations
	 * stay in More, as before; the Card header remains the selection.
	 */
	import type { Snippet } from 'svelte';
	import { indexLabels, stageLayout, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { resolveLayoutSurface } from '@portfolio/layout-core/plan';
	import FinishCardSection, { type FinishCardPart } from '$lib/authoring/look/FinishCardSection.svelte';
	import { layoutRoomFacts } from './precision-facts';

	let {
		services,
		footer,
		secondary,
		more
	}: {
		services: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet;
		secondary?: Snippet<[Snippet?]>;
		more?: Snippet<[Snippet?]>;
	} = $props();

	let revision = $state(0);
	$effect(() => services.stage.onAdaptersChanged(() => (revision += 1)));

	const room = $derived.by(() => {
		void revision;
		const selection = services.stage.selection();
		if (selection === null || selection.sourceKind !== 'room-floor') return null;
		const snapshot = services.stage.snapshot();
		const layout = stageLayout(snapshot);
		const roomId = selection.sourceId;
		if (!layout.rooms.some((entry) => entry.id === roomId)) return null;
		const label = indexLabels(layout.rooms.map((entry) => ({ identity: entry.id, kind: 'Room', name: entry.name ?? null }))).get(roomId)?.label ?? 'Room';
		return {
			roomId,
			label,
			areaFacts: layoutRoomFacts(layout, snapshot.domain.geometry, roomId).filter((fact) => fact.label.toLowerCase().includes('area')),
			hasCeiling: resolveLayoutSurface(layout, { kind: 'room-lid', roomId }) === 'present'
		};
	});

	const parts = $derived.by((): readonly FinishCardPart[] => {
		if (room === null) return [];
		const list: FinishCardPart[] = [
			{ target: { kind: 'surface', surface: { kind: 'room-floor', roomId: room.roomId } }, label: 'Floor', place: `${room.label} · Floor` }
		];
		if (room.hasCeiling) {
			list.push({ target: { kind: 'surface', surface: { kind: 'room-lid', roomId: room.roomId } }, label: 'Ceiling', place: `${room.label} · Ceiling` });
		}
		return list;
	});
</script>

{#if room !== null}
	<div class="room-card" data-layout-room-card>
		{#if room.areaFacts.length > 0}
			<dl class="facts">
				{#each room.areaFacts as fact (fact.label)}<dt>{fact.label}</dt><dd>{fact.value}</dd>{/each}
			</dl>
		{/if}
		<FinishCardSection {services} {parts} subjectLabel={room.label} />
		{#if footer}{@render footer()}{/if}
		{#if more}{@render more()}{/if}
		{#if secondary}{@render secondary()}{/if}
	</div>
{/if}

<style>
	.room-card {
		display: grid;
		gap: 0.35rem;
	}
	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 3px 8px;
		margin: 0;
		font-size: var(--shell-text-control);
	}
	.facts dt {
		color: var(--shell-ink-quiet);
	}
	.facts dd {
		margin: 0;
		font-family: var(--shell-mono);
	}
</style>
