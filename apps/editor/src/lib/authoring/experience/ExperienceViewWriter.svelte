<script lang="ts">
	/**
	 * The Card's writer for a selected View (R217.S25, Conservatory composition at Round 2 width):
	 * the actions row, a 16:10 hero with its lens and eye height, the Framing facts and where
	 * visitors see the View. Make default is the only Default mutation (D12); the Default shows as
	 * an informational badge otherwise. Look through shows the View provisionally; Update View
	 * writes the exact re-aimed pose back. While looking through, Lens and Eye height apply live
	 * to the provisional Camera and are committed by Update View. It edits through the Experience
	 * controller and holds no state of its own.
	 *
	 * R217.S26: a View another Presentation also lists says *Also in ⟨Presentation⟩*, so a rename
	 * or a removal is read as shared before it runs. The name renames from the Card title.
	 */
	import type { Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import ShellIcon from '../stage/shell/ShellIcon.svelte';
	import ExperienceSnapshot from './ExperienceSnapshot.svelte';
	import { experienceHomes } from './experience-homes';
	import { lensMillimetres } from './experience-model';
	import { EYE_HEIGHT_STEPS, LENS_STEPS, eyeHeightStepOf, framingTag, lensStepOf } from './look-through';

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
	/** The Stops that guide this View, in the active Guide. */
	const entries = $derived(view === null || controller === null ? [] : controller.viewStops(view.id));
	const shownEntries = $derived(entries.slice(0, ENTRY_LIST_LIMIT));
	const moreEntries = $derived(entries.length - shownEntries.length);
	const explorable = $derived(controller?.selectedPresentation?.explorable ?? false);
	const ordinals = new Intl.PluralRules('en', { type: 'ordinal' });
	function positionLabel(index: number): string {
		if (index === 0) return 'entry';
		const position = index + 1;
		const suffix = { one: 'st', two: 'nd', few: 'rd' }[ordinals.select(position) as 'one' | 'two' | 'few'] ?? 'th';
		return `${position}${suffix} view`;
	}
	const through = $derived(view !== null && homes.lookThroughViewId() === view.id);
	const throughFraming = $derived(through ? homes.lookThroughFraming() : null);
	const lens = $derived(
		throughFraming !== null ? lensMillimetres(throughFraming.fovYDegrees) : (view?.lensMillimetres ?? 0)
	);
	const eyeHeight = $derived(
		throughFraming !== null ? throughFraming.eyeHeightMetres.toFixed(2) : (view?.eyeHeightMetres.toFixed(2) ?? '')
	);
	const tag = $derived(
		throughFraming !== null
			? framingTag(throughFraming.fovYDegrees, throughFraming.eyeHeightMetres)
			: view === null
				? ''
				: framingTag(view.fovDegrees, view.eyeHeightMetres)
	);
	const activeLens = $derived(
		throughFraming !== null ? lensStepOf(throughFraming.fovYDegrees) : view === null ? null : lensStepOf(view.fovDegrees)
	);
	const activeEye = $derived(
		throughFraming !== null ? eyeHeightStepOf(throughFraming.eyeHeightMetres) : view === null ? null : eyeHeightStepOf(view.eyeHeightMetres)
	);
	const throughMoved = $derived(homes.lookThroughMoved());
	const makeDefaultReason = $derived(controller?.busy ? 'Wait for the current change' : '');
	const alsoIn = $derived(view === null || controller === null ? [] : controller.alsoIn(view.id, view.presentationId));

	async function makeDefault(): Promise<void> {
		if (controller === null || view === null || makeDefaultReason !== '') return;
		await controller.setDefaultView(view.presentationId, view.id);
	}
	function selectStop(stopId: string): void {
		homes.select({ kind: 'stop', stopId });
	}
	async function setLens(fov: number): Promise<void> {
		if (through) {
			homes.lookThroughLens(fov);
			return;
		}
		if (controller === null || view === null) return;
		await controller.setViewFraming(view.id, { fov });
	}
	async function setEyeHeight(metres: number): Promise<void> {
		if (through) {
			homes.lookThroughEyeHeight(metres);
			return;
		}
		if (controller === null || view === null) return;
		await controller.setViewFraming(view.id, { eyeHeightMetres: metres });
	}
	function lookThrough(): void {
		if (view !== null) homes.lookThrough(view.id);
	}
	function exitLookThrough(): void {
		homes.exitLookThrough();
	}
	async function updateLookThrough(): Promise<void> {
		await homes.updateLookThrough();
	}
</script>

{#if controller !== null && view !== null}
	<div class="writer" data-experience-writer="view">
		<div class="c-actions cfoot">
			{#if through}
				<button type="button" class="btn" onclick={exitLookThrough}>Exit View</button>
				<button
					type="button"
					class="btn gold"
					disabled={!throughMoved || controller.busy}
					title={throughMoved ? 'Write the provisional pose back to this View' : 'Re-aim, change the lens or eye height first'}
					onclick={() => void updateLookThrough()}>Update View</button
				>
			{:else}
				<button type="button" class="btn primary" onclick={lookThrough}>
					<ShellIcon name="eye" size={14} />Look through
				</button>
			{/if}
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
				<ExperienceSnapshot label={view.label} viewId={view.id} selected />
				<span class="hero-tag">{tag}</span>
			</div>
		</section>

		<section class="sec">
			<h3>Framing <span class="tag-mono">{tag}</span></h3>
			<div class="field">
				<span class="f-lbl">Lens</span>
				<span class="seg" role="group" aria-label="Lens">
					{#each LENS_STEPS as step (step.label)}
						<button
							type="button"
							class="seg-btn"
							aria-pressed={activeLens?.label === step.label}
							disabled={controller.busy}
							title={`${step.label} · ${step.preset.focalLengthMm} mm`}
							onclick={() => void setLens(step.fovYDegrees)}>{step.label}</button
						>
					{/each}
				</span>
			</div>
			<div class="field">
				<span class="f-lbl">Eye height</span>
				<span class="seg" role="group" aria-label="Eye height">
					{#each EYE_HEIGHT_STEPS as step (step.label)}
						<button
							type="button"
							class="seg-btn"
							aria-pressed={activeEye?.label === step.label}
							disabled={controller.busy}
							title={`${step.label} · ${step.metres.toFixed(2)} m`}
							onclick={() => void setEyeHeight(step.metres)}>{step.label}</button
						>
					{/each}
				</span>
			</div>
			<p class="foot-note">{activeLens === null ? `Custom · ${lens} mm` : `${lens} mm`} · {eyeHeight} m eye. Look through to re-aim it by hand.</p>
		</section>

		<section class="sec" aria-label="Where visitors see it">
			<h3>Where visitors see it</h3>
			<p class="reach-row reach-note">
				<span class="chev"><ShellIcon name="eye" size={13} /></span>
				<span>{explorable ? (view.isDefault ? 'Free exploration · opens here' : 'Free exploration') : 'Hidden from free exploration'}</span>
			</p>
			{#if shownEntries.length > 0}
				<ul class="entries">
					{#each shownEntries as entry (entry.stopId)}
						<li>
							<button type="button" class="link-row" onclick={() => selectStop(entry.stopId)}>
								<span class="num">{entry.position}</span>
								<span>Stop {entry.position} · <em>{positionLabel(entry.index)}</em></span>
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
	.btn.gold {
		border-color: var(--shell-gold, #d4ad45);
		background: var(--shell-gold, #d4ad45);
		color: #2a2208;
	}
	.btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.tag-mono {
		margin-left: 4px;
		color: var(--shell-ink-3, #79817b);
		font: 500 10px var(--shell-mono, ui-monospace, monospace);
	}
	.seg {
		display: inline-flex;
		gap: 1px;
		padding: 2px;
		border-radius: 7px;
		background: var(--shell-hover, #eef0ed);
		box-shadow: inset 0 0 0 1px var(--shell-hairline, #e1e4de);
	}
	.seg-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 24px;
		padding: 0 7px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: var(--shell-ink-2, #4a524c);
		font: 500 11px var(--shell-sans, system-ui);
		cursor: pointer;
	}
	.seg-btn[aria-pressed='true'] {
		background: var(--shell-card, #fff);
		color: var(--shell-ink, #1b201c);
		box-shadow: inset 0 0 0 1px var(--shell-leaf, #4f8f6c);
	}
	.seg-btn:disabled {
		opacity: 0.5;
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
