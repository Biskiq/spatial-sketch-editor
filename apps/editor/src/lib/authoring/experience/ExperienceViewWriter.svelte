<script lang="ts">
	/**
	 * The Card's writer for a selected View (R217.S25, Conservatory composition at Round 2 width):
	 * the actions row, a 16:10 hero with its lens and eye height, the Framing facts and where
	 * visitors see the View. Make default is the only Default mutation (D12); the Default shows as
	 * an informational badge otherwise. Look through waits for View placement (S26). It edits
	 * through the Experience controller and holds no state of its own.
	 *
	 * R217.S26: a View another Presentation also lists says *Also in ⟨Presentation⟩*, so a rename
	 * or a removal is read as shared before it runs. The name renames from the Card title.
	 */
	import type { Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import ShellIcon from '../stage/shell/ShellIcon.svelte';
	import ExperienceSnapshot from './ExperienceSnapshot.svelte';
	import { experienceHomes } from './experience-homes';

	let {
		secondary,
	}: {
		services?: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet;
		secondary?: Snippet<[Snippet?]>;
		more?: Snippet<[Snippet?]>;
	} = $props();

	/** Past this many Stops, the list says how many more it leaves out. */
	const ENTRY_LIST_LIMIT = 6;

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const view = $derived(controller?.selectedView ?? null);
	/** The Stops that enter at this View, in the active Guide. */
	const entries = $derived(view === null || controller === null ? [] : controller.viewStops(view.id));
	const shownEntries = $derived(entries.slice(0, ENTRY_LIST_LIMIT));
	const moreEntries = $derived(entries.length - shownEntries.length);
	const lens = $derived(view === null ? 0 : Math.round(view.lensMillimetres));
	const eyeHeight = $derived(view === null ? '' : view.eyeHeightMetres.toFixed(2));
	const makeDefaultReason = $derived(controller?.busy ? 'Wait for the current change' : '');
	const alsoIn = $derived(view === null || controller === null ? [] : controller.alsoIn(view.id, view.presentationId));

	async function makeDefault(): Promise<void> {
		if (controller === null || view === null || makeDefaultReason !== '') return;
		await controller.setDefaultView(view.presentationId, view.id);
	}
	function selectStop(stopId: string): void {
		homes.select({ kind: 'stop', stopId });
	}
</script>

{#if controller !== null && view !== null}
	<div class="writer" data-experience-writer="view">
		<div class="c-actions cfoot">
			<button
				type="button"
				class="btn primary"
				disabled
				aria-describedby="view-look-through-reason"
				title="Comes with Look through"
			>
				<ShellIcon name="eye" size={14} />Look through
			</button>
			<span id="view-look-through-reason" class="sr">Comes with Look through</span>
			{#if view.isDefault}
				<span class="badge def default-note">◆ Default View</span>
			{:else}
				<button
					type="button"
					class="btn"
					disabled={makeDefaultReason !== ''}
					title={makeDefaultReason || 'Make this the Presentation’s Default View'}
					aria-describedby={makeDefaultReason !== '' ? 'make-default-reason' : undefined}
					onclick={() => void makeDefault()}>Make default</button
				>
				{#if makeDefaultReason !== ''}<span id="make-default-reason" class="sr">{makeDefaultReason}</span>{/if}
			{/if}
		</div>

		{#if alsoIn.length > 0}
			<p class="also-in" data-view-also-in>
				Also in
				{#each alsoIn as other, index (other.id)}{#if index > 0},{/if}
					<button type="button" class="also-link" onclick={() => homes.select({ kind: 'presentation', presentationId: other.id })}
						>{other.label}</button
					>{/each}
			</p>
		{/if}

		<section class="sec hero-sec">
			<div class="hero">
				<ExperienceSnapshot label={view.label} selected />
				<span class="hero-tag">{lens} mm · {eyeHeight} m eye</span>
			</div>
		</section>

		<section class="sec">
			<h3>Framing</h3>
			<div class="field">
				<span class="f-lbl">Lens</span>
				<span class="f-val">{lens} mm</span>
			</div>
			<div class="field">
				<span class="f-lbl">Eye height</span>
				<span class="f-val">{eyeHeight} m</span>
			</div>
			<p class="foot-note">Look through to re-aim it by hand.</p>
		</section>

		<section class="sec" aria-label="Where visitors see it">
			<h3>Where visitors see it</h3>
			{#if shownEntries.length > 0}
				<ul class="entries">
					{#each shownEntries as entry (entry.stopId)}
						<li>
							<button type="button" class="link-row" onclick={() => selectStop(entry.stopId)}>
								<span class="num">{entry.position}</span>
								<span>Stop {entry.position} · <em>entry</em></span>
								<span class="chev"><ShellIcon name="chevronRight" size={13} /></span>
							</button>
						</li>
					{/each}
				</ul>
				{#if moreEntries > 0}<p class="reach-row">and {moreEntries} more Stops</p>{/if}
			{:else}
				<p class="reach-row reach-note">
					<span class="chev"><ShellIcon name="guide" size={13} /></span>
					<span>Not in any Stop</span>
				</p>
			{/if}
		</section>

		{#if secondary}{@render secondary()}{/if}
	</div>
{/if}

<style>
	.also-in {
		margin: 0;
		padding: 0 12px 8px;
		color: var(--shell-ink-2, #4a524c);
		font-size: 11.5px;
	}
	button.also-link {
		display: inline;
		min-height: 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--shell-ink, #1b201c);
		font: inherit;
		text-decoration: underline;
		text-decoration-color: var(--shell-hairline-strong, #cdd2ca);
		text-underline-offset: 2px;
		cursor: pointer;
	}
	.writer {
		display: flex;
		flex-direction: column;
		color: var(--shell-ink, #1b201c);
		font-size: 12.5px;
		line-height: 1.45;
	}
	.c-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding: 10px 14px 12px;
		border-bottom: 1px solid var(--shell-hairline, #e1e4de);
	}
	.sec {
		padding: 12px 14px 4px;
	}
	.sec + .sec {
		border-top: 1px solid var(--shell-hairline, #e1e4de);
	}
	.sec h3 {
		margin: 0 0 8px;
		color: var(--shell-ink, #1b201c);
		font-size: 12.5px;
		font-weight: 650;
	}
	.hero {
		position: relative;
	}
	.hero-tag {
		position: absolute;
		right: 8px;
		bottom: 8px;
		padding: 3px 8px;
		border-radius: 10px;
		background: rgb(17 41 31 / 0.8);
		color: #e3eee7;
		font-size: 11px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}
	.field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-height: 30px;
	}
	.f-lbl {
		color: var(--shell-ink-2, #4a524c);
	}
	.f-val {
		font-variant-numeric: tabular-nums;
	}
	.foot-note {
		margin: 8px 0 0;
		color: var(--shell-ink-3, #79817b);
		font-size: 11.5px;
	}
	.entries {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.link-row {
		display: flex;
		align-items: center;
		gap: 9px;
		width: 100%;
		min-height: 34px;
		margin-top: 6px;
		padding: 5px 8px;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 8px;
		background: var(--shell-card, #fff);
		color: var(--shell-ink, #1b201c);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.link-row:hover {
		border-color: var(--shell-hairline-strong, #cdd2ca);
		background: var(--shell-leaf-tint, #e7f1ea);
	}
	.link-row em {
		font-style: normal;
		font-weight: 600;
		color: var(--shell-forest-raised, #22503c);
	}
	.link-row > span:not(.num):not(.chev) {
		flex: 1;
	}
	.num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 20px;
		height: 20px;
		padding: 0 5px;
		border-radius: 10px;
		background: var(--shell-forest, #11291f);
		color: #fff;
		font: 600 11px/1 var(--shell-mono, ui-monospace, monospace);
		font-variant-numeric: tabular-nums;
	}
	.chev {
		display: inline-flex;
		color: var(--shell-ink-3, #79817b);
	}
	.reach-row {
		display: flex;
		align-items: center;
		gap: 9px;
		min-height: 30px;
		margin: 6px 0 0;
		color: var(--shell-ink-2, #4a524c);
	}
	.reach-note {
		margin: 0;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		height: 26px;
		padding: 0 10px;
		border-radius: 13px;
		font-size: 11.5px;
		font-weight: 600;
	}
	.badge.def {
		background: var(--shell-leaf-tint, #e7f1ea);
		color: var(--shell-forest-raised, #22503c);
		box-shadow: inset 0 0 0 1px var(--shell-hairline-strong, #cdd2ca);
	}
	.default-note {
		color: var(--shell-forest-raised, #22503c);
	}
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: 28px;
		padding: 0 10px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 7px;
		background: var(--shell-card, #fff);
		color: var(--shell-ink, #1b201c);
		font: inherit;
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
		cursor: pointer;
	}
	.btn:hover:not(:disabled) {
		background: var(--shell-hover, #eef0ed);
	}
	.btn.primary {
		border-color: var(--shell-forest-raised, #22503c);
		background: var(--shell-forest-raised, #22503c);
		color: #fff;
	}
	.btn.primary:hover:not(:disabled) {
		background: var(--shell-forest-raised, #22503c);
		filter: brightness(1.12);
	}
	.btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	@media (pointer: coarse) {
		.btn,
		.link-row,
		button.also-link {
			min-height: 44px;
		}
	}
</style>
