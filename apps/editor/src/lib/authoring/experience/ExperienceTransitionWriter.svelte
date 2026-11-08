<script lang="ts">
	/**
	 * The Card's writer for a Stop's outgoing transition (R217.S25), composed as the Conservatory
	 * Transition Card. The wide Cut / Travel switch is chosen here and only here (D6). The ends
	 * block names the entry View the move leaves from and the one it arrives at, or the End of the
	 * tour, resolved against the Guide (D11). Travel gaps the validator reports are listed as
	 * written. Movement is a disabled placeholder until Camera path editing and playback land
	 * (S26). It edits through the controller and holds no state.
	 */
	import type { Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import type { ExperienceStop } from '@portfolio/project-model/units';
	import ShellIcon from '../stage/shell/ShellIcon.svelte';
	import ExperienceSnapshot from './ExperienceSnapshot.svelte';
	import ExperiencePathMovement from './ExperiencePathMovement.svelte';
	import type { ExperienceController } from './experience-controller.svelte';
	import { stopEntryViewId as entryOf, stopExitViewId as exitOf } from './experience-model';
	import { experienceHomes } from './experience-homes';
	import { occurrenceLabel } from './experience-paths';


	let {
		secondary,
	}: {
		services?: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet;
		secondary?: Snippet<[Snippet?]>;
		more?: Snippet<[Snippet?]>;
	} = $props();

	type Continuation = NonNullable<ReturnType<ExperienceController['resolveContinuation']>>;

	const END_REASON = 'The tour ends here';
	const NOT_IN_GUIDE_REASON = 'This Stop is not in the open Guide';
	const BUSY_REASON = 'Wait for the last change to save';
	const CUT_PATH_REASON = 'A Cut has no travel path';

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	/** The subject's Stop: this transition leaves from it. */
	const stop = $derived(controller?.selectedStop ?? null);
	const transportGuideId = $derived(stop === null ? null : homes.guideForStop(stop.id));
	const continuation = $derived(
		controller === null || stop === null ? null : (controller.resolveContinuation(stop.id) as Continuation | null)
	);
	const isEnd = $derived(continuation !== null && continuation.kind === 'end');
	/** The Cut/Travel the continuation carries; End has none to show. */
	const transition = $derived(
		continuation === null || continuation.kind === 'end' ? null : continuation.transition
	);
	const travelling = $derived(transition === 'travel');

	/** The Stop the transition arrives at, when the resolution names one that the Experience holds. */
	const destination = $derived.by((): ExperienceStop | null => {
		if (controller === null || continuation === null || continuation.kind === 'end') return null;
		const targetId = continuation.stopId;
		return controller.current?.stops.find((entry) => entry.id === targetId) ?? null;
	});
	const travelGaps = $derived(
		stop === null || controller === null ? [] : (controller.travelGapsByStop.get(stop.id) ?? [])
	);
	/** R217.S29 — this transition's one derived Camera path read. */
	const path = $derived(
		controller?.pathOccurrence?.kind === 'transition' && controller.pathOccurrence.stopId === stop?.id
			? controller.selectedPath
			: null
	);
	/** Other moves that share this Camera path, shown as a small "Also used by" chip. */
	const sharedCount = $derived(travelling && path !== null ? path.sharedUses.length : 0);
	const busyReason = $derived(controller?.busy === true ? BUSY_REASON : null);
	/** Path is editable only for a supported Travel; a gap offers the one add action. */
	const pathReason = $derived(
		busyReason ??
			(isEnd
				? END_REASON
				: transition === 'cut'
					? CUT_PATH_REASON
					: path?.state === 'gap'
						? 'Add a Camera path for this move'
						: path?.state === 'ambiguous'
							? 'More than one Camera path joins these Views'
							: null)
	);

	const segmentReason = $derived(
		isEnd
			? END_REASON
			: continuation === null
				? NOT_IN_GUIDE_REASON
				: controller?.busy === true
					? BUSY_REASON
					: null
	);
	/** D-7: two Stops on the same View have nowhere to travel; offer no switch. */
	const sameView = $derived.by((): string | null => {
		if (stop === null || destination === null) return null;
		const from = stopExitViewId(stop);
		const to = stopEntryViewId(destination);
		return from !== null && from === to ? viewLabelOf(stop, from) : null;
	});

	const stopEntryViewId = (target: ExperienceStop): string =>
		(controller?.current == null ? null : entryOf(controller.current, target)) ?? '';
	const stopExitViewId = (target: ExperienceStop): string =>
		(controller?.current == null ? null : exitOf(controller.current, target)) ?? '';

	function viewLabelOf(target: ExperienceStop, viewId: string): string {
		const view = controller?.viewsOf.get(target.presentationId)?.find((entry) => entry.id === viewId);
		return view?.label ?? 'Missing View';
	}

	/** The destination's place in the open Guide, or 0 when the Guide does not list it. */
	function placeOf(target: ExperienceStop): number {
		return (controller?.guideStops ?? []).findIndex((entry) => entry.id === target.id) + 1;
	}

	/** The Stop's one-based place in the open Guide, or 0 when the Guide does not list it. */
	const fromPlace = $derived(stop === null ? 0 : placeOf(stop));
	const toPlace = $derived(destination === null ? 0 : placeOf(destination));

	function setTransition(next: 'cut' | 'travel'): void {
		if (controller === null || stop === null) return;
		void controller.setTransition(stop.id, next);
	}
</script>

{#if controller !== null && stop !== null}
	<div class="writer" data-experience-writer="transition">
		<div class="c-actions">
			{#if sameView !== null}
				<div class="same-view" role="status">
					<ShellIcon name="cut" size={13} />
					<b>Cut</b>
					<span aria-hidden="true">·</span>
					<span>Both Stops show {sameView}</span>
				</div>
			{:else}
				<div class="seg wide" role="group" aria-label="Transition">
					<button
						type="button"
						aria-pressed={transition === 'cut'}
						disabled={segmentReason !== null}
						title={segmentReason ?? 'Cut'}
						onclick={() => setTransition('cut')}
					>
						<ShellIcon name="cut" size={13} />
						Cut
						{#if segmentReason}<span class="sr-only">{segmentReason}</span>{/if}
					</button>
					<button
						type="button"
						aria-pressed={transition === 'travel'}
						disabled={segmentReason !== null}
						title={segmentReason ?? 'Travel'}
						onclick={() => setTransition('travel')}
					>
						<ShellIcon name="travel" size={13} />
						Travel
						{#if segmentReason}<span class="sr-only">{segmentReason}</span>{/if}
					</button>
				</div>
			{/if}
		</div>

		<section class="ends" aria-label="Leaves and arrives">
			<button type="button" class="end" onclick={() => homes.select({ kind: 'stop', stopId: stop.id })}>
				<small class="end-tag">Leaves</small>
				<span class="end-img">
					<ExperienceSnapshot
						label={viewLabelOf(stop, stopExitViewId(stop))}
						viewId={stopExitViewId(stop)}
					/>
					{#if fromPlace > 0}<span class="num">{fromPlace}</span>{/if}
				</span>
				<b>{viewLabelOf(stop, stopExitViewId(stop))}</b>
			</button>
			<span class="ends-mid" aria-hidden="true">
				<ShellIcon name="chevronRight" size={16} />
				{#if transition !== null}<small>{transition === 'cut' ? 'Cut' : 'Travel'}</small>{/if}
			</span>
			{#if destination !== null}
				<button
					type="button"
					class="end"
					onclick={() => homes.select({ kind: 'stop', stopId: destination.id })}
				>
					<small class="end-tag"
						>Arrives{#if toPlace === 0} · outside this Guide{/if}</small
					>
					<span class="end-img">
						<ExperienceSnapshot
							label={viewLabelOf(destination, stopEntryViewId(destination))}
							viewId={stopEntryViewId(destination)}
						/>
						{#if toPlace > 0}<span class="num">{toPlace}</span>{/if}
					</span>
					<b>{viewLabelOf(destination, stopEntryViewId(destination))}</b>
				</button>
			{:else if isEnd}
				<span class="end static">
					<small class="end-tag">Arrives</small>
					<span class="end-img finish"><ShellIcon name="pin" size={16} /></span>
					<b>End of tour</b>
				</span>
			{:else}
				<span class="end static">
					<small class="end-tag">Arrives</small>
					<span class="end-img finish"><ShellIcon name="warning" size={16} /></span>
					<b class="muted">The next Stop is missing from this Experience.</b>
				</span>
			{/if}
		</section>

		{#if sharedCount > 0 && path !== null}
			<div class="meta-row">
				<span class="chip" title="This path's time is one Camera fact: a change reaches each use">
					×{sharedCount + 1} · Same path in {sharedCount + 1} places, also {path.sharedUses
						.map((use) => occurrenceLabel(use, controller.guideStops.map((entry) => entry.id)))
						.join(', ')}: a change reaches each.
				</span>
			</div>
		{/if}

		{#if travelling && !isEnd}
			<ExperiencePathMovement
				{path}
				{pathReason}
				{busyReason}
				occurrence={{ kind: 'transition', stopId: stop.id }}
			/>
			{#if travelGaps.length > 0}
				<div class="gaps" role="alert">
					<div class="alert">
						<ShellIcon name="warning" size={13} /><span
							>Travel needs a Camera connection from “{viewLabelOf(stop, stopExitViewId(stop))}” to “{destination === null
								? 'the next View'
								: viewLabelOf(destination, stopEntryViewId(destination))}”. Add a Camera path for this move.</span
						>
					</div>
				</div>
			{/if}
		{:else if isEnd}
			<p class="c-note">This is the last Stop, so the tour ends here. There is no move to author.</p>
		{:else}
			<p class="c-note">Cut: the camera changes instantly. No path or timing to author.</p>
		{/if}

		{#if !isEnd}
			<section class="c-sec row-end" aria-label="Playback">
				<button type="button" class="btn" disabled={transportGuideId === null || stop === null}
					title={transportGuideId === null ? 'There is no Guide to play' : 'Preview this move'}
					onclick={() => transportGuideId !== null && stop !== null && homes.playGuide(transportGuideId, { kind: 'move', occurrence: { kind: 'transition', stopId: stop.id } })}>Preview this move<ShellIcon name="play" size={12} /></button>
			</section>
		{/if}

		{#if secondary}{@render secondary()}{/if}
	</div>
{/if}

<style>
	.writer {
		display: flex;
		flex-direction: column;
		color: var(--shell-ink);
		font-size: 12px;
	}
	button {
		position: relative;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	button:focus-visible {
		outline: 2px solid var(--shell-forest-raised);
		outline-offset: 1px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
	.muted {
		color: var(--shell-ink-3);
	}
	.c-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding: 8px 12px 12px;
		border-bottom: 1px solid var(--shell-hairline);
	}
	.seg {
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		border: 1px solid var(--shell-hairline);
		border-radius: 8px;
		background: var(--shell-hover);
	}
	.seg.wide {
		display: flex;
		width: 100%;
	}
	.same-view {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 30px;
		padding: 0 10px;
		border: 1px solid var(--shell-hairline);
		border-radius: 8px;
		background: var(--shell-hover);
		color: var(--shell-ink-2);
	}
	.same-view b {
		color: var(--shell-forest-raised);
	}
	.seg button {
		display: inline-flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: 5px;
		height: 30px;
		padding: 0 10px;
		border: 0;
		border-radius: 6px;
		background: none;
		color: var(--shell-ink-2);
		font-size: 12px;
		font-weight: 500;
	}
	.seg button[aria-pressed='true'] {
		background: var(--shell-card);
		color: var(--shell-forest-raised);
		box-shadow:
			0 1px 2px rgb(0 0 0 / 0.08),
			inset 0 0 0 1px var(--shell-hairline-strong);
	}

	/* Ends: where the move leaves from and where it arrives. */
	.ends {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: start;
		gap: 6px;
		padding: 12px 12px 4px;
	}
	.end {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
	}
	.end-img {
		position: relative;
		display: block;
		margin-bottom: 4px;
	}
	.end-img.finish {
		display: grid;
		place-items: center;
		aspect-ratio: 16 / 10;
		border: 1px dashed var(--shell-hairline-strong);
		border-radius: 6px;
		color: var(--shell-ink-3);
	}
	.end-img .num {
		position: absolute;
		left: 5px;
		top: 5px;
	}
	.num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		background: var(--shell-forest);
		color: var(--shell-white);
		font: 600 11px/1 var(--shell-sans);
	}
	.end-tag {
		color: var(--shell-ink-3);
		font: 600 10px/1.2 var(--shell-sans);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.end b {
		font: 600 12px/1.3 var(--shell-serif);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.end b.muted {
		font: 11px/1.4 var(--shell-sans);
		white-space: normal;
	}
	button.end:hover b {
		color: var(--shell-forest-raised);
	}
	.ends-mid {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		align-self: start;
		/* Sits level with the snapshot tiles, below the Leaves / Arrives tags. */
		padding-top: 40px;
		color: var(--shell-forest-raised);
	}
	.ends-mid small {
		font: 600 10px/1 var(--shell-sans);
	}
	.meta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 8px 12px 0;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		min-height: 20px;
		padding: 0 8px;
		border-radius: 999px;
		background: var(--shell-gold-tint);
		color: var(--shell-gold-ink);
		font: 500 11px/1.2 var(--shell-sans);
	}

	/* Sections */
	.c-sec {
		display: flex;
		flex-direction: column;
		padding: 12px 12px 4px;
	}
	.c-note {
		margin: 12px 12px 0;
		color: var(--shell-ink-2);
		font-size: 12px;
		line-height: 1.5;
	}
	.gaps {
		display: flex;
		flex-direction: column;
	}
	.alert {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		margin: 6px 0 0;
		padding: 8px 10px;
		border-radius: 8px;
		background: var(--shell-caution-bg);
		color: var(--shell-refuse);
		font-size: 11.5px;
		line-height: 1.45;
	}
	.alert :global(svg) {
		flex: none;
		margin-top: 1px;
		color: var(--shell-caution);
	}
	.c-sec.row-end {
		flex-direction: row;
		justify-content: flex-end;
		padding-top: 12px;
		padding-bottom: 12px;
	}
	.btn {
		display: inline-flex;
		/* The label comes first in the markup (the home-map guard reads a disabled Preview placeholder by it). */
		flex-direction: row-reverse;
		align-items: center;
		justify-content: center;
		gap: 5px;
		min-height: 28px;
		padding: 0 10px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 7px;
		background: var(--shell-card);
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
	}
	@media (pointer: coarse) {
		button {
			min-height: 44px;
		}
	}
</style>
