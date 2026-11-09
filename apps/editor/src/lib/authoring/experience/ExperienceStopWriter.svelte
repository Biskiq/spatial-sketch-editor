<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import {
		EXPERIENCE_INVITATION_PROMPT_MAX_LENGTH,
		EXPERIENCE_STAY_MIN_SECONDS,
		type ExperienceStop
	} from '@portfolio/project-model/units';
	import ShellIcon from '../stage/shell/ShellIcon.svelte';
	import ExperienceSnapshot from './ExperienceSnapshot.svelte';
	import type { ExperienceController } from './experience-controller.svelte';
	import { experienceHomes } from './experience-homes';
	import { formatPathSeconds } from './experience-paths';

	let {
		secondary,
	}: {
		services?: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet;
		secondary?: Snippet<[Snippet?]>;
		more?: Snippet<[Snippet?]>;
	} = $props();

	/**
	 * The Stop Card (sheet §31, §32) holds only what belongs to this visit: Enter at,
	 * Stay (Automatic) or Until Next (Manual, set by the Guide), and Invite to explore.
	 * How the tour arrives and leaves is shown as Connections, each a link to its
	 * Transition Card, where it is edited. Pacing is the Guide Card's.
	 */
	const BUSY_REASON = 'Wait for the last change to save';
	const NOT_IN_GUIDE_REASON = 'This Stop is not in the open Guide';
	/** An invitation on a stay shorter than this shows only briefly. */
	const SHORT_INVITE_SECONDS = 6;

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const stop = $derived(controller?.selectedStop ?? null);
	const guide = $derived(controller?.guideStops ?? []);
	const transportGuideId = $derived(stop === null ? null : homes.guideForStop(stop.id));
	const transportGuide = $derived(controller?.guides.find((entry) => entry.id === transportGuideId) ?? null);
	const transportPosition = $derived(
		stop === null || transportGuide === null ? 0 : transportGuide.stopIds.indexOf(stop.id) + 1
	);
	const manual = $derived((controller?.contextGuide ?? transportGuide)?.pacing === 'manual');
	/** The Stop's one-based place in the open Guide, or 0 when the Guide does not list it. */
	const position = $derived(stop === null ? 0 : guide.findIndex((entry) => entry.id === stop.id) + 1);
	const presentation = $derived(
		controller === null || stop === null
			? null
			: (controller.current?.presentations.find((entry) => entry.id === stop.presentationId) ?? null)
	);
	const views = $derived(
		stop === null || controller === null ? [] : (controller.viewsOf.get(stop.presentationId) ?? [])
	);
	const defaultViewId = $derived(presentation?.views[0]?.viewId ?? null);
	const entryId = $derived(stop?.entryViewId ?? defaultViewId);
	const entryName = $derived(views.find((view) => view.id === entryId)?.label ?? 'Missing View');
	/** A Presentation an earlier Stop of the Guide already visits reads *again* (harvest §2.4). */
	const again = $derived(
		stop !== null &&
			position > 1 &&
			guide.slice(0, position - 1).some((entry) => entry.presentationId === stop.presentationId)
	);
	const previous = $derived(position > 1 ? (guide[position - 2] ?? null) : null);
	const following = $derived(position > 0 && position < guide.length ? (guide[position] ?? null) : null);
	const previousReason = $derived(
		position === 0 ? NOT_IN_GUIDE_REASON : position === 1 ? 'This is the first Stop' : null
	);
	const followingReason = $derived(
		position === 0 ? NOT_IN_GUIDE_REASON : position === guide.length ? 'This is the last Stop' : null
	);
	const busyReason = $derived(controller?.busy === true ? BUSY_REASON : null);

	/** One connection read for the Connections links: kind, time and where it goes. */
	type ConnectionRead = {
		readonly fromStopId: string;
		readonly label: string;
		readonly kind: 'cut' | 'travel' | 'end';
		readonly seconds: string | null;
		readonly gap: boolean;
	};
	function connectionFrom(source: ExperienceStop | null): ConnectionRead | null {
		if (controller === null || source === null) return null;
		const resolved = controller.resolveContinuation(source.id);
		if (resolved === null) return null;
		if (resolved.kind === 'end') {
			return { fromStopId: source.id, label: 'The tour ends', kind: 'end', seconds: null, gap: false };
		}
		const path = controller.pathFor({ kind: 'transition', stopId: source.id });
		const place = resolved.position === null ? '' : `Stop ${resolved.position} · `;
		const target = controller.current?.stops.find((entry) => entry.id === resolved.stopId);
		const sourcePlace = guide.findIndex((entry) => entry.id === source.id) + 1;
		const label = target?.id === stop?.id
			? `${sourcePlace > 0 ? `Stop ${sourcePlace} · ` : ''}${controller.presentationLabel(source.presentationId)}`
			: `${place}${target === undefined ? 'Missing Stop' : controller.presentationLabel(target.presentationId)}`;
		return {
			fromStopId: source.id,
			label,
			kind: resolved.transition,
			seconds: resolved.transition === 'travel' && path?.state === 'ready' ? formatPathSeconds(path.seconds) : null,
			gap: resolved.transition === 'travel' && (path === null || path.state === 'gap' || path.state === 'ambiguous')
		};
	}
	/**
	 * The connection that arrives here: the previous Stop's when it continues to
	 * this one, else the first Stop of the Guide that jumps here. A Stop no
	 * connection reaches says so rather than borrowing its neighbour's.
	 */
	const arrivingFrom = $derived.by((): ExperienceStop | null => {
		if (controller === null || stop === null || position <= 1) return null;
		const reaches = (source: ExperienceStop) => {
			const resolved = controller.resolveContinuation(source.id);
			return resolved !== null && resolved.kind !== 'end' && resolved.stopId === stop.id;
		};
		if (previous !== null && reaches(previous)) return previous;
		return guide.find((entry) => entry.id !== stop.id && reaches(entry)) ?? null;
	});
	const incoming = $derived(connectionFrom(arrivingFrom));
	const outgoing = $derived(stop === null || position === 0 ? null : connectionFrom(stop));

	function selectStop(target: ExperienceStop | null): void {
		if (target !== null) homes.select({ kind: 'stop', stopId: target.id });
	}

	function chooseEntry(viewId: string): void {
		if (controller === null || stop === null || controller.busy) return;
		void controller.setStopEntry(stop.id, viewId);
	}

	function stepStay(direction: -1 | 1): void {
		if (controller === null || stop === null || controller.busy) return;
		const step = stop.staySeconds < 10 || (stop.staySeconds === 10 && direction === -1) ? 1 : 5;
		void controller.setStopStay(stop.id, Math.max(EXPERIENCE_STAY_MIN_SECONDS, stop.staySeconds + direction * step));
	}

	function onStayKey(event: KeyboardEvent): void {
		if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
		event.preventDefault();
		stepStay(event.key === 'ArrowUp' ? 1 : -1);
	}

	function toggleInvitation(): void {
		if (controller === null || stop === null || controller.busy) return;
		void controller.setStopInvitation(stop.id, stop.invitation === null ? { prompt: null } : null);
	}

	let promptDraft = $state('');
	$effect(() => {
		promptDraft = stop?.invitation?.prompt ?? '';
	});
	function commitPrompt(): void {
		if (controller === null || stop === null || stop.invitation === null) return;
		const prompt = promptDraft.trim() === '' ? null : promptDraft.trim();
		if (prompt === stop.invitation.prompt) return;
		void controller.setStopInvitation(stop.id, { prompt });
	}
	const moreViews = $derived(Math.max(0, views.length - 1));
	const defaultPrompt = $derived(
		moreViews > 0 ? `Take a closer look · ${moreViews} more ${moreViews === 1 ? 'view' : 'views'}` : 'Look around'
	);
	const stayLabel = (seconds: number) => (Number.isInteger(seconds) ? `${seconds} s` : `${seconds.toFixed(1)} s`);
</script>

{#snippet connectionLink(direction: 'In' | 'Out', connection: ConnectionRead | null, emptyText: string)}
	<li class="conn">
		<span class="conn-dir">{direction}</span>
		{#if connection === null}
			<span class="c-note">{emptyText}</span>
		{:else if connection.kind === 'end'}
			<button type="button" class="link-row" onclick={() => homes.select({ kind: 'transition', stopId: connection.fromStopId })}>
				<span>{connection.label}</span>
				<ShellIcon name="chevronRight" size={12} />
			</button>
		{:else}
			<button
				type="button"
				class="link-row"
				data-connection={direction.toLowerCase()}
				title="Open this transition's Card, where it is edited"
				onclick={() => homes.select({ kind: 'transition', stopId: connection.fromStopId })}
			>
				<ShellIcon name={connection.kind === 'travel' ? 'travel' : 'cut'} size={13} />
				<span>
					{connection.kind === 'travel' ? 'Travel' : 'Cut'}{connection.seconds === null ? '' : ` · ${connection.seconds}`}
					{#if connection.gap}<b class="warn" title="Travel needs a path">⚠</b>{/if}
				</span>
				<span class="conn-to">{direction === 'In' ? 'from' : 'to'} {connection.label}</span>
				<ShellIcon name="chevronRight" size={12} />
			</button>
		{/if}
	</li>
{/snippet}

{#if controller !== null && stop !== null}
	<div class="writer" data-experience-writer="stop">
		<div class="visits-row">
		<button
			type="button"
			class="visits"
			title="Open the Presentation"
			onclick={() => homes.select({ kind: 'presentation', presentationId: stop.presentationId })}
		>
			<span class="visits-thumb">
				<ExperienceSnapshot label={entryName} viewId={entryId ?? undefined} ratio="stop" />
				{#if position > 0}<span class="num lg">{position}</span>{/if}
			</span>
			<span class="visits-txt">
				<small>{again ? 'Visits again' : 'Visits'}</small>
				<b>{controller.presentationLabel(stop.presentationId)}</b>
				<span class="open">Open Presentation <ShellIcon name="chevronRight" size={11} /></span>
			</span>
		</button>
		<section class="stop-nav" aria-label="Guide position">
			<span class="step">
				<button
					type="button"
					class="icon-btn"
					aria-label="Previous Stop"
					title={previousReason ?? 'Previous Stop'}
					disabled={previous === null}
					onclick={() => selectStop(previous)}
				>
					<ShellIcon name="chevronLeft" size={14} />
				</button>
				<button
					type="button"
					class="icon-btn"
					aria-label="Next Stop"
					title={followingReason ?? 'Next Stop'}
					disabled={following === null}
					onclick={() => selectStop(following)}
				>
					<ShellIcon name="chevronRight" size={14} />
				</button>
			</span>
		</section>
		</div>
		{#if position === 0}<p class="where">Not in the open Guide</p>{/if}

		<section class="c-sec" aria-labelledby="stop-entry-title">
			<h3 id="stop-entry-title">Enter at</h3>
			<div class="entry-list" role="radiogroup" aria-labelledby="stop-entry-title">
				{#each views as view, index (view.id)}
					<button
						type="button"
						class="entry"
						role="radio"
						aria-checked={view.id === entryId}
						disabled={busyReason !== null}
						title={busyReason ?? (index === 0 ? 'The Default: View 1 of the Presentation' : `Enter at ${view.label}`)}
						data-entry-view={view.id}
						onclick={() => chooseEntry(view.id)}
					>
						<span class="entry-n">{index + 1}</span>
						<span class="entry-name">{view.label}</span>
						{#if index === 0}<em class="tag">Default</em>{/if}
					</button>
				{/each}
			</div>
			<p class="c-foot-note">
				{stop.entryViewId === null ? 'Follows the Presentation’s View 1 when you reorder.' : 'Enters here on this visit; the Default stays View 1.'}
			</p>
		</section>

		<section class="c-sec" aria-labelledby="stop-stay-title">
			<h3 id="stop-stay-title">Stay</h3>
			{#if manual}
				<p class="c-foot-note" data-stay="until-next"><b>Until Next</b> · set on the Guide strip.</p>
				<p class="c-foot-note">Its time, {stayLabel(stop.staySeconds)}, is kept for switching back to Automatic.</p>
			{:else}
				<div class="stay-row">
					<span class="stepper" role="group" aria-label="Stay">
						<button type="button" aria-label="Shorter stay"
							disabled={busyReason !== null || stop.staySeconds <= EXPERIENCE_STAY_MIN_SECONDS}
							title={busyReason ?? 'Shorter stay'} onclick={() => stepStay(-1)}>
							<ShellIcon name="minus" size={11} />
						</button>
						<b class="value" tabindex="0" role="spinbutton" aria-label="Stay in seconds"
							aria-valuenow={stop.staySeconds} aria-valuemin={EXPERIENCE_STAY_MIN_SECONDS}
							onkeydown={onStayKey} data-stay="seconds">{stayLabel(stop.staySeconds)}</b>
						<button type="button" aria-label="Longer stay" disabled={busyReason !== null}
							title={busyReason ?? 'Longer stay'} onclick={() => stepStay(1)}>
							<ShellIcon name="plus" size={11} />
						</button>
					</span>
					<span class="c-note">then the tour moves on</span>
				</div>
			{/if}
		</section>

		<section class="c-sec" aria-labelledby="stop-invite-title">
			<div class="switch-row">
				<span>
					<span id="stop-invite-title" class="h3">Invite to explore</span>
					<small>{moreViews > 0 ? `${moreViews} more ${moreViews === 1 ? 'View' : 'Views'} here` : 'One View: invites looking around'}</small>
				</span>
				<button
					type="button"
					class="switch"
					role="switch"
					aria-checked={stop.invitation !== null}
					aria-labelledby="stop-invite-title"
					disabled={busyReason !== null}
					onclick={toggleInvitation}
				><i></i></button>
			</div>
			{#if stop.invitation !== null}
				<label class="prompt">
					<span>Prompt</span>
					<input
						type="text"
						maxlength={EXPERIENCE_INVITATION_PROMPT_MAX_LENGTH}
						placeholder={defaultPrompt}
						bind:value={promptDraft}
						onblur={commitPrompt}
						onkeydown={(event) => {
							if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur();
						}}
					/>
				</label>
				{#if !manual && stop.staySeconds < SHORT_INVITE_SECONDS}
					<p class="warn-note">Short stay: the invitation shows for only {stayLabel(stop.staySeconds)}.</p>
				{/if}
				<p class="c-foot-note">Shows when the Stop arrives and leaves with it. Ignoring it never pauses the tour.</p>
			{/if}
			<p class="c-foot-note">Visitors can always press <b>Explore</b>. It pauses the tour and adds no time.</p>
		</section>

		<section class="c-sec" aria-labelledby="stop-connections-title">
			<h3 id="stop-connections-title">Connections</h3>
			<ul class="conns">
				{@render connectionLink('In', incoming, position <= 1 ? 'The tour starts here' : 'No Stop continues here')}
				{@render connectionLink('Out', outgoing, position === 0 ? NOT_IN_GUIDE_REASON : 'No connection')}
			</ul>
		</section>

		<section class="c-sec row-end" aria-label="Playback">
			<button type="button" class="btn ghost" disabled={transportGuideId === null || stop === null || transportPosition === 0}
				title={transportPosition === 0 ? NOT_IN_GUIDE_REASON : transportGuideId === null ? 'There is no Guide to play' : 'Play from this Stop'}
				onclick={() => transportGuideId !== null && stop !== null && homes.playGuide(transportGuideId, { kind: 'stop', stopId: stop.id })}>
				<ShellIcon name="play" size={12} />Play from this Stop
			</button>
		</section>

		{#if secondary}{@render secondary()}{/if}
	</div>
{/if}

<style>
	.entry-list {
		display: grid;
		gap: 2px;
	}
	.entry {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 30px;
		padding: 0 8px;
		border: 1px solid transparent;
		border-radius: 7px;
		background: none;
		text-align: left;
	}
	.entry:hover:not(:disabled) {
		background: var(--shell-hover);
	}
	.entry[aria-checked='true'] {
		border-color: var(--shell-forest-raised);
		background: var(--shell-selected);
	}
	.entry-n {
		display: inline-grid;
		place-items: center;
		min-width: 18px;
		height: 18px;
		border-radius: 9px;
		background: var(--shell-hover);
		font-size: 10.5px;
		font-weight: 600;
	}
	.entry-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.stay-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.switch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.switch-row .h3 {
		display: block;
		font-size: var(--shell-text-utility);
		font-weight: 600;
	}
	.switch-row small {
		color: var(--shell-ink-3);
		font-size: 11px;
	}
	.switch {
		position: relative;
		flex: none;
		width: 32px;
		height: 18px;
		padding: 0;
		border: 0;
		border-radius: 9px;
		background: var(--shell-hairline-strong);
	}
	.switch i {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 7px;
		background: var(--shell-surface-raised);
		transition: transform 120ms ease;
	}
	.switch[aria-checked='true'] {
		background: var(--shell-forest-raised);
	}
	.switch[aria-checked='true'] i {
		transform: translateX(14px);
	}
	.prompt {
		display: grid;
		gap: 3px;
		margin-top: 8px;
		font-size: 11px;
		color: var(--shell-ink-3);
	}
	.prompt input {
		min-height: 28px;
		padding: 0 8px;
		border: 1px solid var(--shell-field-line);
		border-radius: 7px;
		background: var(--shell-field);
		font: inherit;
		font-size: var(--shell-text-utility);
		color: var(--shell-ink);
	}
	.warn-note {
		margin: 6px 0 0;
		color: var(--shell-caution);
		font-size: 11px;
	}
	.conns {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.conn {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.conn-dir {
		flex: none;
		width: 26px;
		color: var(--shell-ink-3);
		font-size: 10.5px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.conn .link-row {
		flex: 1;
		min-width: 0;
	}
	.conn-to {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		color: var(--shell-ink-3);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.warn {
		margin-left: 4px;
		color: var(--shell-caution);
	}

	.writer {
		display: flex;
		flex-direction: column;
		color: var(--shell-ink);
		font-size: var(--shell-text-utility);
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
	.icon-btn {
		display: inline-grid;
		place-items: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: 6px;
		background: none;
		color: var(--shell-ink-2);
	}
	.icon-btn:hover:not(:disabled) {
		background: var(--shell-hover);
		color: var(--shell-ink);
	}
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		min-height: 28px;
		padding: 0 10px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 7px;
		background: var(--shell-card);
		font-size: var(--shell-text-utility);
		font-weight: 500;
		white-space: nowrap;
	}
	.btn:hover:not(:disabled) {
		background: var(--shell-hover);
	}
	.btn.ghost {
		padding: 0 8px;
		border-color: transparent;
		background: none;
		color: var(--shell-forest-raised);
	}
	.btn.ghost:hover:not(:disabled) {
		background: var(--shell-leaf-tint);
	}

	/* Stop navigation: previous / next, stacked beside the Visits block (review round 3). */
	.visits-row {
		display: flex;
		align-items: stretch;
		gap: 4px;
		margin: 8px 12px 0;
	}
	.visits-row .visits {
		flex: 1;
		min-width: 0;
		margin: 0;
	}
	.stop-nav {
		display: flex;
		align-items: center;
	}
	.stop-nav .step {
		flex-direction: column;
		margin: 0;
	}
	.step {
		display: inline-flex;
		gap: 2px;
		flex: none;
		margin-left: auto;
	}
	.where {
		margin: 4px 12px 0;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--shell-ink-3);
		font-size: 11.5px;
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
		color: var(--shell-on-action);
		font: 600 10.5px/1 var(--shell-mono);
		flex: none;
	}
	.num.lg {
		min-width: 24px;
		height: 24px;
		border-radius: 12px;
		font-size: var(--shell-text-utility);
	}

	/* Visits: the Presentation this Stop visits. */
	.visits {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 8px 12px 0;
		padding: 8px;
		border: 1px solid var(--shell-hairline);
		border-radius: 10px;
		background: var(--shell-card);
		text-align: left;
		box-shadow: var(--shell-furniture-shadow);
	}
	.visits:hover {
		border-color: var(--shell-hairline-strong);
	}
	.visits-thumb {
		position: relative;
		flex: none;
		width: 84px;
	}
	.visits-thumb .num {
		position: absolute;
		left: -6px;
		top: -6px;
		box-shadow: 0 0 0 2px var(--shell-card);
	}
	.visits-txt {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.visits-txt small {
		color: var(--shell-ink-3);
		font-size: 9.5px;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}
	.visits-txt b {
		font: 600 var(--shell-text-title)/1.2 var(--shell-sans);
		overflow-wrap: anywhere;
	}
	.visits-txt .open {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		margin-top: 2px;
		color: var(--shell-forest-raised);
		font-size: 11.5px;
		font-weight: 600;
		/* One line even when the Card's scrollbar narrows the row beside the steppers. */
		white-space: nowrap;
	}

	/* Sections */
	.c-sec {
		display: flex;
		flex-direction: column;
		padding: 12px 12px 4px;
	}
	.c-sec + .c-sec {
		border-top: 1px solid var(--shell-hairline);
		margin-top: 12px;
	}
	.c-sec h3 {
		margin: 0 0 8px;
		font: 650 12.5px/1.2 var(--shell-sans);
		color: var(--shell-ink);
	}
	.c-foot-note {
		display: flex;
		gap: 5px;
		align-items: baseline;
		margin: 10px 0 0;
		color: var(--shell-ink-3);
		font-size: 11.5px;
		line-height: 1.45;
	}
	.c-note {
		margin: 6px 0 0;
		color: var(--shell-ink-2);
		font-size: var(--shell-text-utility);
		line-height: 1.5;
	}
	.c-sec.row-end {
		flex-direction: row;
		justify-content: flex-end;
		border-top: 0;
		margin-top: 4px;
		padding-top: 8px;
		padding-bottom: 10px;
	}

	/* The entry tag reads like the Guide's *Start* tag: small, outlined, not a slab. */
	.tag {
		flex: none;
		padding: 0 4px;
		border: 1px solid currentColor;
		border-radius: 3px;
		color: var(--shell-forest-raised);
		font: 500 10px/1.4 var(--shell-mono);
		font-style: normal;
		letter-spacing: 0.02em;
	}
	.stepper {
		display: inline-flex;
		align-items: center;
		height: 22px;
		border: 1px solid var(--shell-hairline);
		border-radius: 7px;
		background: var(--shell-card);
	}
	.stepper button {
		display: inline-grid;
		place-items: center;
		width: 20px;
		height: 20px;
		padding: 0;
		border: 0;
		border-radius: 6px;
		background: none;
		color: var(--shell-ink-3);
	}
	.stepper button:hover:not(:disabled) {
		background: var(--shell-leaf-tint);
		color: var(--shell-forest-raised);
	}
	.stepper .value {
		min-width: 26px;
		text-align: center;
		font: 600 11px var(--shell-mono);
	}

	/* Connections */
	.link-row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 34px;
		padding: 5px 8px;
		border: 1px solid var(--shell-hairline);
		border-radius: 8px;
		background: var(--shell-card);
		font-size: var(--shell-text-utility);
		text-align: left;
	}
	.link-row > span {
		flex: 1;
	}
	.link-row:hover {
		border-color: var(--shell-hairline-strong);
		background: var(--shell-hover);
	}
	.link-row > :global(svg:last-child) {
		color: var(--shell-ink-3);
	}

	/* Menus */
	@media (pointer: coarse) {
		button {
			min-height: 44px;
		}
		.icon-btn {
			min-width: 44px;
		}
		.stepper { height: auto; }
	}
</style>
