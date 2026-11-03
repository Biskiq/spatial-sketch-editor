<script lang="ts">
	/**
	 * The invoked Guide instrument (R217.S25): Stops in order, reorder, Insert, the first
	 * Guide, and the Travel gaps of the selected Stop. It is the content StageInstrumentHost
	 * mounts in the lower edge, so its header and close control belong to the host. Every
	 * edit is a controller command; the panel holds no Experience state of its own.
	 */
	import type { StageAdapterServices } from '../stage/stage-adapter-host';
	import { experienceHomes } from './experience-homes';

	// The instrument contract passes services; the panel reads the controller from the homes.
	let {}: { services?: StageAdapterServices } = $props();

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const current = $derived(controller?.current ?? null);
	const guide = $derived(controller?.currentGuide ?? null);
	const stops = $derived(controller?.guideStops ?? []);
	const selectedStop = $derived(controller?.selectedStop ?? null);

	/** A Stop's place in the Experience, for naming a Continue-to target. */
	function stopPosition(stopId: string): number {
		return (current?.stops.findIndex((stop) => stop.id === stopId) ?? -1) + 1;
	}

	function continuationWord(stopId: string): string {
		const stop = current?.stops.find((entry) => entry.id === stopId);
		const continuation = stop?.continuation;
		if (continuation?.kind === 'end') return 'End';
		if (continuation?.kind === 'stop') return `Continues to Stop ${stopPosition(continuation.stopId)}`;
		return 'Next in Guide';
	}

	function entryWord(stopId: string): string {
		const stop = current?.stops.find((entry) => entry.id === stopId);
		if (stop === undefined) return 'Default View';
		return controller?.viewsOf.get(stop.presentationId)?.find((view) => view.id === stop.entryViewId)?.label ?? 'Default View';
	}

	function selectStop(stopId: string): void {
		controller?.selectStop(stopId);
		homes.focusCardSubject('stop');
	}

	async function insertStop(): Promise<void> {
		if (controller === null) return;
		await controller.insertStop();
		homes.focusCardSubject('stop');
	}

	function chooseGuide(event: Event & { currentTarget: HTMLSelectElement }): void {
		controller?.chooseGuide(event.currentTarget.value);
	}

	function setDraft(field: 'firstGuideLabel', event: Event & { currentTarget: HTMLInputElement }): void {
		if (controller !== null) controller.drafts[field] = event.currentTarget.value;
	}
</script>

{#if controller === null}
	<p class="hint" role="status">The Experience lens mounts with the admitted project source.</p>
{:else if current === null}
	<p class="hint">Create an Experience in the Index before composing its Guide.</p>
{:else}
	{#if current.guides.length > 0}
		<label class="inline">
			<span>Guide</span>
			<select value={guide?.id ?? ''} onchange={chooseGuide}>
				<option value="">None</option>
				{#each current.guides as entry (entry.id)}<option value={entry.id}>{entry.label}</option>{/each}
			</select>
		</label>
	{/if}

	{#if guide === null}
		{#if current.guides.length > 0}
			<p class="hint">No Guide is selected. Choose a saved Guide to edit its Stops; None leaves the saved Guides unchanged.</p>
		{:else}
			<p class="hint">
				This Experience carries no Guide, so its Presentations are entered from the visitor list.
			</p>
		{/if}
		{#if current.guides.length === 0}
			<div class="first-guide" aria-label="First Guide">
				<p class="hint">
					Creates one Guide with an initial distinct Stop from the selected Presentation (or the selected
					Stop's Presentation). The Stop enters that Presentation's own View; no Camera pose is copied and
					no Connection is made.
				</p>
				<label class="field">
					<span>Guide label</span>
					<input value={controller.drafts.firstGuideLabel} placeholder="Guide" oninput={(event) => setDraft('firstGuideLabel', event)} />
				</label>
				<div class="actions">
					<button
						type="button"
						onclick={() => void controller.createFirstGuide()}
						disabled={controller.busy || controller.firstGuidePresentation() === null}
					>
						Create first Guide
					</button>
				</div>
			</div>
		{/if}
	{:else}
		<ol class="stop-list" aria-label="Stops">
			{#each stops as stop, index (stop.id)}
				<li>
					<button
						type="button"
						class="row"
						class:active={selectedStop?.id === stop.id}
						aria-pressed={selectedStop?.id === stop.id}
						onclick={() => selectStop(stop.id)}
					>
						<span class="row-label">{index + 1}. {controller.presentationLabel(stop.presentationId)}</span>
						<span class="row-meta">
							{entryWord(stop.id)} · hold {stop.holdSeconds ?? 0}s · {continuationWord(stop.id)}{stop.continuation !== undefined &&
							stop.continuation.kind !== 'end'
								? ` · ${stop.continuation.transition ?? 'cut'}`
								: ''}
						</span>
					</button>
					<span class="reorder">
						<button type="button" class="quiet" aria-label="Move up" onclick={() => void controller.moveStop(stop.id, -1)} disabled={index === 0 || controller.busy}>↑</button>
						<button type="button" class="quiet" aria-label="Move down" onclick={() => void controller.moveStop(stop.id, 1)} disabled={index === stops.length - 1 || controller.busy}>↓</button>
					</span>
				</li>
			{:else}
				<li class="hint">This Guide has no Stops yet.</li>
			{/each}
		</ol>

		<div class="actions">
			<button type="button" onclick={() => void insertStop()} disabled={controller.busy || controller.selectedPresentation === null}>
				Insert selected Presentation as a Stop
			</button>
		</div>

		{#if selectedStop !== null}
			{#each controller.travelGaps as gap (gap)}
				<p class="hint" role="alert">{gap}</p>
			{/each}
		{/if}
	{/if}
{/if}

<style>
	.hint {
		margin: 0;
		color: #b9c7bd;
		font-size: 12px;
	}
	.inline,
	.actions,
	.reorder {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.inline span,
	.field span {
		color: #9fb2a2;
		font-size: 11px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.field input,
	.inline select {
		min-height: 32px;
		padding: 0 0.4rem;
		border: 1px solid rgb(255 255 255 / 0.16);
		border-radius: 6px;
		background: rgb(255 255 255 / 0.06);
		color: inherit;
		font: inherit;
	}
	.stop-list {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.stop-list li {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}
	.row {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		align-items: flex-start;
		padding: 0.3rem 0.45rem;
		border: 1px solid transparent;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.row:hover {
		background: rgb(255 255 255 / 0.08);
	}
	.row.active,
	.row[aria-pressed='true'] {
		border-color: rgb(255 255 255 / 0.4);
		background: rgb(255 255 255 / 0.12);
	}
	.row-label {
		font-weight: 600;
	}
	.row-meta {
		color: #b9c7bd;
		font-size: 11px;
	}
	button {
		min-height: 30px;
		padding: 0 0.6rem;
		border: 1px solid rgb(255 255 255 / 0.2);
		border-radius: 6px;
		background: rgb(255 255 255 / 0.08);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button.quiet {
		padding: 0 0.4rem;
		border-color: transparent;
		background: transparent;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	@media (pointer: coarse) {
		button,
		.row {
			min-height: 44px;
		}
	}
</style>
