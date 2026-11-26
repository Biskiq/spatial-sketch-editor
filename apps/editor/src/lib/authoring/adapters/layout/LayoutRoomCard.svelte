<script lang="ts">
	/**
	 * The Room Card's writer: the Room's area facts, its Radius and Diameter for
	 * a Round Room, then its Floor and Ceiling Finishes through the shared
	 * Finish section. The Room's relations stay in More, as before; the Card
	 * header remains the selection.
	 *
	 * C4 — Radius and Diameter are the **Room's** fields, whether the Room is one
	 * isolated closed Wall or a ring of open arc Walls. Both dispatch the one
	 * retained `layout-round-room-radius` planner, so typing and the Stage's
	 * radius ray cannot disagree. A refusal writes nothing and leaves the field
	 * showing the accepted value.
	 */
	import type { Snippet } from 'svelte';
	import { indexLabels, stageLayout, stageUnitRevision, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { resolveLayoutSurface } from '@portfolio/layout-core/plan';
	import FinishCardSection, { type FinishCardPart } from '$lib/authoring/look/FinishCardSection.svelte';
	import { layoutRoomFacts } from './precision-facts';
	import { roundRoomRadiusIntent } from './round-room-planners';

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
		const entry = layout.rooms.find((candidate) => candidate.id === roomId);
		if (entry === undefined) return null;
		const label = indexLabels(layout.rooms.map((candidate) => ({ identity: candidate.id, kind: 'Room', name: candidate.name ?? null }))).get(roomId)?.label ?? 'Room';
		return {
			roomId,
			label,
			round: entry.round ?? null,
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

	/** The live draft, keyed by field so a re-render of the other field cannot eat it. */
	let draft = $state<{ field: 'radius' | 'diameter'; text: string } | null>(null);
	let refusal = $state<string | null>(null);
	let busy = $state(false);

	function begin(field: 'radius' | 'diameter', value: number): void {
		draft = { field, text: String(value) };
		refusal = null;
	}

	function discard(): void {
		draft = null;
		refusal = null;
	}

	async function commit(): Promise<void> {
		const current = draft;
		const target = room;
		if (current === null || target === null || busy) return;
		const parsed = Number(current.text.trim());
		if (!Number.isFinite(parsed) || parsed <= 0) {
			refusal = 'Enter a radius or diameter greater than zero.';
			return;
		}
		busy = true;
		try {
			const snapshot = services.stage.snapshot();
			const outcome = await services.authoring.accept(
				roundRoomRadiusIntent({
					roomId: target.roomId,
					radius: current.field === 'diameter' ? parsed / 2 : parsed,
					operationId: globalThis.crypto.randomUUID(),
					projectId: snapshot.acceptedRevision.projectId,
					revisionId: services.authoring.acceptedRevision().revisionId,
					contentRevision: stageUnitRevision(snapshot, 'layout'),
					levelId: snapshot.domain.layoutLevelId
				})
			);
			if (outcome.kind === 'refused') {
				refusal = outcome.message;
				return;
			}
			draft = null;
			refusal = null;
			services.stage.notifySurfaceChange();
		} finally {
			busy = false;
		}
	}
</script>

{#if room !== null}
	<div class="room-card" data-layout-room-card>
		{#if room.areaFacts.length > 0}
			<dl class="facts">
				{#each room.areaFacts as fact (fact.label)}<dt>{fact.label}</dt><dd>{fact.value}</dd>{/each}
			</dl>
		{/if}
		{#if room.round !== null}
			<div class="round-fields" data-layout-round-room-fields>
				{#each [{ field: 'radius' as const, label: 'Radius', value: room.round.radius }, { field: 'diameter' as const, label: 'Diameter', value: room.round.radius * 2 }] as entry (entry.field)}
					<label>
						<span>{entry.label}</span>
						<input
							type="text"
							inputmode="decimal"
							aria-label={entry.label}
							value={draft?.field === entry.field ? draft.text : `${entry.value} m`}
							disabled={busy}
							onfocus={() => begin(entry.field, entry.value)}
							oninput={(event) => {
								if (draft?.field === entry.field) draft = { field: entry.field, text: event.currentTarget.value };
							}}
							onkeydown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									void commit();
								} else if (event.key === 'Escape') {
									event.preventDefault();
									discard();
								}
							}}
							onblur={() => {
								if (!busy) discard();
							}}
						/>
					</label>
				{/each}
				{#if refusal !== null}<p class="refusal" role="alert">{refusal}</p>{/if}
			</div>
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
	.round-fields {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 3px 8px;
		align-items: center;
		font-size: var(--shell-text-control);
	}
	.round-fields label {
		display: contents;
	}
	.round-fields span {
		color: var(--shell-ink-quiet);
	}
	.round-fields input {
		width: 100%;
		min-width: 0;
		font-family: var(--shell-mono);
		font-size: var(--shell-text-control);
		color: inherit;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 3px;
		padding: 1px 4px;
	}
	.round-fields input:focus {
		border-color: var(--shell-ink);
		outline: none;
	}
	.refusal {
		grid-column: 1 / -1;
		margin: 0;
		color: var(--stage-erase);
		font-size: var(--shell-text-control);
	}
</style>
