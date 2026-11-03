<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { EXPERIENCE_STEP_DEFAULT_HOLD_SECONDS, type ExperienceStop } from '@portfolio/project-model/units';
	import ShellIcon from '../stage/shell/ShellIcon.svelte';
	import ExperienceSnapshot from './ExperienceSnapshot.svelte';
	import ExperiencePathMovement from './ExperiencePathMovement.svelte';
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

	type Continuation = NonNullable<ReturnType<ExperienceController['resolveContinuation']>>;
	type Target = 'next' | 'end' | { readonly stopId: string };
	type MenuName = 'next';
	type MenuItem = {
		readonly id: string;
		readonly label: string;
		readonly hint: string | null;
		readonly checked: boolean;
		/** Why the item cannot be chosen; null when it can. */
		readonly reason: string | null;
		readonly run: () => void;
	};

	/** Past this many Views left out of the Stop, they fold behind a disclosure (Conservatory). */
	const FOLD_VIEWS_AFTER = 4;
	const BUSY_REASON = 'Wait for the last change to save';
	const NOT_IN_GUIDE_REASON = 'This Stop is not in the open Guide';
	const LAST_VIEW_REASON = 'A Stop shows at least one View';
	const GUIDED_VIEW_MIME = 'application/x-biskiq-guided-view';

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const stop = $derived(controller?.selectedStop ?? null);
	const guide = $derived(controller?.guideStops ?? []);
	const transportGuideId = $derived(stop === null ? null : homes.guideForStop(stop.id));
	const transportPosition = $derived.by(() => {
		if (stop === null || transportGuideId === null || controller === null) return 0;
		const guide = controller.guides.find((entry) => entry.id === transportGuideId);
		return guide === undefined ? 0 : guide.stopIds.indexOf(stop.id) + 1;
	});
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
	const defaultViewId = $derived(presentation?.defaultViewId ?? null);
	const entryId = $derived(stop?.views[0]?.viewId);
	const entryName = $derived(views.find((view) => view.id === entryId)?.label ?? 'Missing View');
	const guided = $derived(stop?.views ?? []);
	const selectedStep = $derived(controller?.pathOccurrence?.kind === 'step' ? controller.pathOccurrence : null);
	const selectedStepPath = $derived(selectedStep === null ? null : (controller?.selectedPath ?? null));
	const selectedStepReason = $derived(
		selectedStepPath === null
			? null
			: selectedStepPath.state === 'gap'
				? 'Add a Camera path for this step'
				: selectedStepPath.state === 'ambiguous'
					? 'More than one Camera path joins these Views'
					: null
	);
	const otherViews = $derived(views.filter((view) => !guided.some((entry) => entry.viewId === view.id)));
	const folded = $derived(otherViews.length > FOLD_VIEWS_AFTER);
	let othersOpen = $state(false);
	/** A Presentation an earlier Stop of the Guide already visits reads *again* (harvest §2.4). */
	const again = $derived(
		stop !== null &&
			position > 1 &&
			guide.slice(0, position - 1).some((entry) => entry.presentationId === stop.presentationId)
	);
	const isLast = $derived(position > 0 && position === guide.length);

	const continuation = $derived(
		controller === null || stop === null ? null : (controller.resolveContinuation(stop.id) as Continuation | null)
	);

	function nameOf(target: ExperienceStop | undefined): string {
		if (target === undefined) return 'Missing Stop';
		return controller?.presentationLabel(target.presentationId) ?? '';
	}
	function placeOf(stopId: string): number {
		return guide.findIndex((entry) => entry.id === stopId) + 1;
	}

	/** The chip names where Next goes: the Stop's place and Presentation, or End (D11). */
	const chip = $derived.by(() => {
		if (controller === null || continuation === null) return { place: null as number | null, name: '' };
		if (continuation.kind === 'end') return { place: null, name: 'End' };
		const name = nameOf(controller.current?.stops.find((entry) => entry.id === continuation.stopId));
		return continuation.position === null
			? { place: null, name: `${name} (outside this Guide)` }
			: { place: continuation.position, name };
	});
	const transitionName = $derived(
		continuation === null || continuation.kind === 'end'
			? null
			: continuation.transition === 'travel'
				? 'Travel'
				: 'Cut'
	);

	/** Stop order for the Next menu: the open Guide first, then Stops it does not list. */
	const stopChoices = $derived.by((): readonly ExperienceStop[] => {
		if (controller === null || stop === null) return [];
		const listed = new Set(guide.map((entry) => entry.id));
		const unlisted = (controller.current?.stops ?? []).filter((entry) => !listed.has(entry.id));
		return [...guide, ...unlisted].filter((entry) => entry.id !== stop.id);
	});

	const previous = $derived(position > 1 ? (guide[position - 2] ?? null) : null);
	const following = $derived(position > 0 && position < guide.length ? (guide[position] ?? null) : null);
	const previousReason = $derived(
		position === 0 ? NOT_IN_GUIDE_REASON : position === 1 ? 'This is the first Stop' : null
	);
	const followingReason = $derived(
		position === 0 ? NOT_IN_GUIDE_REASON : position === guide.length ? 'This is the last Stop' : null
	);

	const busyReason = $derived(controller?.busy === true ? BUSY_REASON : null);

	const nextItems = $derived.by((): MenuItem[] => {
		if (controller === null || stop === null || continuation === null) return [];
		const explicit = continuation.explicit;
		const chosen = continuation.kind === 'end' ? null : continuation.stopId;
		const items: MenuItem[] = [
			{
				id: 'next',
				label: 'Next in the Guide',
				hint: null,
				checked: !explicit,
				reason: position === 0 ? NOT_IN_GUIDE_REASON : busyReason,
				run: () => setNext('next')
			}
		];
		for (const target of stopChoices) {
			const place = placeOf(target.id);
			items.push({
				id: `stop-${target.id}`,
				label: place > 0 ? `Stop ${place} · ${nameOf(target)}` : nameOf(target),
				hint: place > 0 ? null : 'Outside this Guide',
				checked: explicit && chosen === target.id,
				reason: busyReason,
				run: () => setNext({ stopId: target.id })
			});
		}
		items.push({
			id: 'end',
			label: 'End',
			hint: null,
			checked: explicit && continuation.kind === 'end',
			reason: busyReason,
			run: () => setNext('end')
		});
		return items;
	});

	function selectStop(target: ExperienceStop | null): void {
		if (target !== null) homes.select({ kind: 'stop', stopId: target.id });
	}

	function setNext(target: Target): void {
		if (controller === null || stop === null) return;
		void controller.setContinuation(stop.id, target);
	}

	function holdAt(index: number): number | null {
		return guided[index]?.holdSeconds ?? (index < guided.length - 1 ? EXPERIENCE_STEP_DEFAULT_HOLD_SECONDS : null);
	}

	/** R217.S29 — a step inside a Stop is a Cut or a Travel, stored beside its hold. */
	function setStepTransition(viewId: string, transition: 'cut' | 'travel'): void {
		if (controller === null || stop === null) return;
		const views = stop.views.map((view) =>
			view.viewId === viewId ? { ...view, transition } : view
		);
		void controller.setStopViews(stop.id, views);
		// The Path tool targets this step's own occurrence, not the Stop transition.
		controller.selectPath(transition === 'travel' ? { kind: 'step', stopId: stop.id, toViewId: viewId } : null);
	}

	function stepSeconds(viewId: string): string {
		if (controller === null || stop === null) return '—';
		const path = controller.pathFor?.({ kind: 'step', stopId: stop.id, toViewId: viewId });
		return path?.state === 'ready' ? formatPathSeconds(path.seconds) : '—';
	}

	function selectStep(viewId: string, transition: 'cut' | 'travel', event: MouseEvent): void {
		event.stopPropagation();
		if (controller === null || stop === null) return;
		const shot = stop.views.find((view) => view.viewId === viewId);
		const current = shot?.transition ?? 'cut';
		// Pressing the chosen kind again only selects this step's own path. A click on
		// the nested row never writes a no-op or selects a different subject.
		if (current === transition) {
			if (transition === 'travel') {
				controller.selectPath({ kind: 'step', stopId: stop.id, toViewId: viewId });
			}
			return;
		}
		setStepTransition(viewId, transition);
	}

	function stepHold(viewId: string, current: number | null, direction: 1 | -1): void {
		if (controller === null || stop === null || controller.busy) return;
		const next = direction === 1 ? (current ?? 0) + 1 : current === 0 ? null : Math.max(0, (current ?? 0) - 1);
		void controller.setViewHold(stop.id, viewId, next);
	}

	let draggingViewId = $state<string | null>(null);
	let dropAt = $state<{ viewId: string; after: boolean } | null>(null);

	function onViewKey(event: KeyboardEvent, viewId: string): void {
		if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
		event.preventDefault();
		event.stopPropagation();
		if (controller === null || stop === null || controller.busy) return;
		void controller.moveGuidedView(stop.id, viewId, event.key === 'ArrowUp' ? -1 : 1);
	}

	function onShotDragStart(event: DragEvent, viewId: string): void {
		if (controller?.busy || event.dataTransfer === null || guided.length < 2) {
			event.preventDefault();
			return;
		}
		draggingViewId = viewId;
		event.dataTransfer.setData(GUIDED_VIEW_MIME, viewId);
		event.dataTransfer.effectAllowed = 'move';
	}

	function onShotDragOver(event: DragEvent, viewId: string): void {
		if (draggingViewId === null || controller?.busy) return;
		event.preventDefault();
		if (draggingViewId === viewId) {
			dropAt = null;
			return;
		}
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		dropAt = { viewId, after: event.clientY > box.top + box.height / 2 };
	}

	function endShotDrag(): void {
		draggingViewId = null;
		dropAt = null;
	}

	function onShotDrop(event: DragEvent, viewId: string): void {
		if (draggingViewId === null) return;
		event.preventDefault();
		const dragged = draggingViewId;
		const target = dropAt;
		endShotDrag();
		if (stop === null || controller === null || controller.busy || target?.viewId !== viewId) return;
		const index = guided.filter((view) => view.viewId !== dragged).findIndex((view) => view.viewId === viewId);
		if (index >= 0) void controller.moveGuidedViewTo(stop.id, dragged, index + (target.after ? 1 : 0));
	}

	/** Menus: one open at a time; Esc closes and returns focus to its trigger. */
	let openMenu = $state<MenuName | null>(null);
	let menuElement = $state<HTMLDivElement | null>(null);
	const triggers = $state<Record<MenuName, HTMLButtonElement | null>>({ next: null });

	$effect(() => {
		void stop?.id;
		openMenu = null;
		othersOpen = false;
		endShotDrag();
	});

	async function openMenuFor(name: MenuName): Promise<void> {
		openMenu = name;
		await tick();
		const target =
			menuElement?.querySelector<HTMLElement>('[aria-checked="true"]:not(:disabled)') ??
			menuElement?.querySelector<HTMLElement>('[role="menuitemradio"]:not(:disabled)');
		target?.focus();
	}

	function closeMenu(returnFocus: boolean): void {
		const name = openMenu;
		openMenu = null;
		if (returnFocus && name !== null) triggers[name]?.focus();
	}

	function toggleMenu(name: MenuName): void {
		if (openMenu === name) closeMenu(true);
		else void openMenuFor(name);
	}

	function chooseItem(item: MenuItem): void {
		if (item.reason !== null) return;
		closeMenu(true);
		item.run();
	}

	function onMenuKey(event: KeyboardEvent): void {
		const menu = event.currentTarget as HTMLElement;
		const items = [...menu.querySelectorAll<HTMLElement>('[role="menuitemradio"]:not(:disabled)')];
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			closeMenu(true);
			return;
		}
		if (event.key === 'Tab') {
			closeMenu(false);
			return;
		}
		if (items.length === 0) return;
		const index = items.indexOf(document.activeElement as HTMLElement);
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const step = event.key === 'ArrowDown' ? 1 : -1;
			items[(index + step + items.length) % items.length]?.focus();
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
		}
	}

	function onOutside(event: PointerEvent): void {
		if (openMenu === null || !(event.target instanceof Element)) return;
		if (event.target.closest(`[data-menu-wrap="${openMenu}"]`) === null) closeMenu(false);
	}
</script>

<svelte:window onpointerdowncapture={onOutside} />

{#snippet choiceMenu(title: string, items: readonly MenuItem[])}
	<div class="popover">
		<p class="popover-title" aria-hidden="true">{title}</p>
		<div class="menu" role="menu" aria-label={title} tabindex="-1" bind:this={menuElement} onkeydown={onMenuKey}>
			{#each items as item (item.id)}
				<button
					type="button"
					class="menu-item"
					role="menuitemradio"
					aria-checked={item.checked}
					disabled={item.reason !== null}
					title={item.reason ?? undefined}
					onclick={() => chooseItem(item)}
				>
					<span class="menu-label">{item.label}</span>
					{#if item.hint}<span class="hint-text">{item.hint}</span>{/if}
					{#if item.checked}<ShellIcon name="check" size={13} />{/if}
					{#if item.reason}<span class="sr-only">{item.reason}</span>{/if}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

{#if controller !== null && stop !== null}
	<div class="writer" data-experience-writer="stop">
		<section class="stop-nav" aria-label="Guide position">
			{#if position === 0}<span class="where">Not in the open Guide</span>{/if}
			<span class="step">
				<button
					type="button"
					class="icon-btn"
					aria-label="Previous Stop"
					title={previousReason ?? 'Previous Stop'}
					aria-describedby={previousReason === null ? undefined : 'stop-previous-reason'}
					disabled={previous === null}
					onclick={() => selectStop(previous)}
				>
					<ShellIcon name="chevronLeft" size={14} />
					{#if previousReason}<span id="stop-previous-reason" class="sr-only">{previousReason}</span>{/if}
				</button>
				<button
					type="button"
					class="icon-btn"
					aria-label="Next Stop"
					title={followingReason ?? 'Next Stop'}
					aria-describedby={followingReason === null ? undefined : 'stop-following-reason'}
					disabled={following === null}
					onclick={() => selectStop(following)}
				>
					<ShellIcon name="chevronRight" size={14} />
					{#if followingReason}<span id="stop-following-reason" class="sr-only">{followingReason}</span>{/if}
				</button>
			</span>
		</section>

		<button
			type="button"
			class="visits"
			title="Open the Presentation"
			onclick={() => homes.select({ kind: 'presentation', presentationId: stop.presentationId })}
		>
			<span class="visits-thumb">
				<ExperienceSnapshot label={entryName} ratio="stop" />
				{#if position > 0}<span class="num lg">{position}</span>{/if}
			</span>
			<span class="visits-txt">
				<small>Visits{#if again} again{/if}</small>
				<b>{controller.presentationLabel(stop.presentationId)}</b>
				<span class="open">Open Presentation <ShellIcon name="chevronRight" size={11} /></span>
			</span>
		</button>

		<section class="c-sec" aria-labelledby="stop-views-title">
			<div class="c-sec-head">
				<h3 id="stop-views-title">Guided views<span class="n">{guided.length}</span></h3>
			</div>
			<ol class="shots">
				{#each guided as shot, index (shot.viewId)}
					{@const label = views.find((view) => view.id === shot.viewId)?.label ?? 'Missing View'}
					{@const hold = holdAt(index)}
					{@const leaveReason = guided.length === 1 ? LAST_VIEW_REASON : busyReason}
					{@const shorterReason = busyReason ?? (hold === null
						? 'No hold is set'
						: hold === 0 && index < guided.length - 1 ? 'The hold is already zero' : null)}
					<li
						class="shot"
						class:dragging={draggingViewId === shot.viewId}
						class:drop-before={dropAt?.viewId === shot.viewId && !dropAt.after}
						class:drop-after={dropAt?.viewId === shot.viewId && dropAt.after}
						ondragover={(event) => onShotDragOver(event, shot.viewId)}
						ondrop={(event) => onShotDrop(event, shot.viewId)}
						data-guided-view={shot.viewId}
					>
						<span class="grip" draggable={!controller.busy && guided.length > 1}
							ondragstart={(event) => onShotDragStart(event, shot.viewId)} ondragend={endShotDrag}
							title="Drag to reorder" aria-hidden="true">
							<ShellIcon name="menu" size={12} />
						</span>
						<span class="shot-n">{index + 1}</span>
						<span class="shot-thumb"><ExperienceSnapshot {label} viewId={shot.viewId} ratio="row" /></span>
						<span class="shot-main">
							<span class="shot-name">
								<button type="button" class="name-btn" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
									onkeydown={(event) => onViewKey(event, shot.viewId)}
									onclick={() => homes.select({ kind: 'view', viewId: shot.viewId, presentationId: stop.presentationId })}
								>{label}</button>
								{#if shot.viewId === defaultViewId}<span class="def" role="img" aria-label="Default View">◆</span>{/if}
								{#if index === 0}<em class="tag">Entry</em>{/if}
							</span>
								{#if index > 0}
									<span class="step-kind" role="group" aria-label={`Step to ${label}`}>
										<button type="button" aria-pressed={(shot.transition ?? 'cut') === 'cut'} disabled={busyReason !== null}
											title={busyReason ?? 'Cut'} onclick={(event) => selectStep(shot.viewId, 'cut', event)}>Cut</button>
										<button type="button" aria-pressed={(shot.transition ?? 'cut') === 'travel'} disabled={busyReason !== null}
											title={busyReason ?? 'Travel'} onclick={(event) => selectStep(shot.viewId, 'travel', event)}>Travel</button>
										{#if (shot.transition ?? 'cut') === 'travel'}
											<b class="step-seconds">{stepSeconds(shot.viewId)}</b>
											{#if controller.pathFor?.({ kind: 'step', stopId: stop.id, toViewId: shot.viewId })?.state === 'gap'}
												<button
													type="button"
													class="step-add"
													aria-label={`Add a Camera path to ${label}`}
													title="Add a Camera path"
													disabled={busyReason !== null}
													onclick={(event) => {
														event.stopPropagation();
														void controller?.createPath({ kind: 'step', stopId: stop.id, toViewId: shot.viewId });
													}}
												>+ Path</button>
											{/if}
										{/if}
										<button type="button" class="step-preview" title="Preview this step"
											disabled={transportGuideId === null || stop === null}
											onclick={(event) => {
												event.stopPropagation();
												if (transportGuideId !== null && stop !== null) homes.playGuide(transportGuideId, { kind: 'move', occurrence: { kind: 'step', stopId: stop.id, toViewId: shot.viewId } });
											}}>Preview</button>
									</span>
								{/if}
								<span class="shot-meta">
								<span class="hold-lbl">Hold</span>
								<span class="stepper" role="group" aria-label={`Hold for ${label}`}>
									<button type="button" aria-label="Shorter hold"
										title={shorterReason ?? 'Shorter hold'}
										disabled={shorterReason !== null} onclick={() => stepHold(shot.viewId, hold, -1)}>
										<ShellIcon name="minus" size={11} />
									</button>
									<b class="value" aria-live="polite" title={hold === null ? 'Waits for Next' : undefined}>
										{hold === null ? '—' : `${hold}s`}
									</b>
									<button type="button" aria-label="Longer hold" title={busyReason ?? 'Longer hold'}
										disabled={busyReason !== null} onclick={() => stepHold(shot.viewId, hold, 1)}>
										<ShellIcon name="plus" size={11} />
									</button>
								</span>
							</span>
						</span>
						<button type="button" class="icon-btn shot-look" title="Look through this View"
							aria-label={`Look through ${label}`}
							onclick={(event) => { event.stopPropagation(); homes.lookThrough(shot.viewId); }}>
							<ShellIcon name="eye" size={11} />
						</button>
						<button type="button" class="icon-btn shot-x" disabled={leaveReason !== null}
							title={leaveReason ?? 'Leave out'} aria-label={`Leave out ${label}`}
							onclick={() => void controller.leaveOutView(stop.id, shot.viewId)}>
							<ShellIcon name="close" size={11} />
							{#if leaveReason}<span class="sr-only">{leaveReason}</span>{/if}
						</button>
					</li>
				{/each}
			</ol>

			{#if otherViews.length > 0}
				{#if folded}
					<button
						type="button"
						class="disc"
						aria-expanded={othersOpen}
						onclick={() => (othersOpen = !othersOpen)}
					>
						<ShellIcon name={othersOpen ? 'chevronDown' : 'chevronRight'} size={12} />
						Not in this Stop ({otherViews.length})
					</button>
				{:else}
					<div class="c-sub">Not in this Stop</div>
				{/if}
				{#if !folded || othersOpen}
					<ul class="shots out">
						{#each otherViews as view (view.id)}
							<li class="shot is-out">
								<span class="shot-thumb"><ExperienceSnapshot label={view.label} viewId={view.id} ratio="row" /></span>
								<span class="shot-name">
									<button
										type="button"
										class="name-btn"
										onclick={() => homes.select({ kind: 'view', viewId: view.id, presentationId: stop.presentationId })}
										>{view.label}</button
									>
									{#if view.id === defaultViewId}<span class="def" role="img" aria-label="Default View">◆</span>{/if}
								</span>
								<button type="button" class="btn xs include" disabled={busyReason !== null} title={busyReason ?? undefined}
									aria-label={`Include ${view.label}`} onclick={() => void controller.includeView(stop.id, view.id)}>
									Include
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
			<p class="c-foot-note"><span class="def" aria-hidden="true">◆</span> marks the Presentation's Default View. Reordering here changes only this Stop.</p>
		</section>

		{#if selectedStep !== null && selectedStep.stopId === stop.id}
			<ExperiencePathMovement
				path={selectedStepPath}
				pathReason={selectedStepReason}
				{busyReason}
				occurrence={selectedStep}
			/>
		{/if}

		<section class="c-sec" aria-labelledby="stop-after-title">
			<h3 id="stop-after-title">After this Stop</h3>
			{#if position === 0}
				<p class="c-note">This Stop is not in this Guide.</p>
			{:else if continuation === null}
				<p class="c-note">Open this Stop's Guide to see where Next goes.</p>
			{:else}
				<div class="after">
					<div class="after-next" data-menu-wrap="next">
						<span class="an-lbl">Visitor presses <b>Next</b></span>
						<ShellIcon name="chevronRight" size={12} />
						<button
							type="button"
							class="stop-link"
							aria-haspopup="menu"
							aria-expanded={openMenu === 'next'}
							bind:this={triggers.next}
							onclick={() => toggleMenu('next')}
						>
							{#if chip.place !== null}<span class="num">{chip.place}</span>{/if}
							<span class="stop-link-name">{chip.name}</span>
							<ShellIcon name="chevronDown" size={11} />
						</button>
						{#if openMenu === 'next'}{@render choiceMenu('Next goes to', nextItems)}{/if}
					</div>
					{#if continuation.kind === 'end'}
						<p class="c-note">{isLast ? 'Last Stop. The tour ends here.' : 'The tour ends after this Stop.'}</p>
					{:else}
						<button
							type="button"
							class="link-row"
							onclick={() => homes.select({ kind: 'transition', stopId: stop.id })}
						>
							<ShellIcon name={continuation.transition === 'travel' ? 'travel' : 'cut'} size={13} />
							<span>{transitionName} · transition</span>
							<ShellIcon name="chevronRight" size={12} />
						</button>
					{/if}
				</div>
			{/if}
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
	.writer {
		display: flex;
		flex-direction: column;
		color: var(--shell-ink, #1b201c);
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
		outline: 2px solid var(--shell-forest-raised, #22503c);
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
	.icon-btn {
		display: inline-grid;
		place-items: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: 6px;
		background: none;
		color: var(--shell-ink-2, #4a524c);
	}
	.icon-btn:hover:not(:disabled) {
		background: var(--shell-hover, #eef0ed);
		color: var(--shell-ink, #1b201c);
	}
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		min-height: 28px;
		padding: 0 10px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 7px;
		background: var(--shell-card, #fff);
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
	}
	.btn:hover:not(:disabled) {
		background: var(--shell-hover, #eef0ed);
	}
	.btn.xs {
		min-height: 24px;
		padding: 0 8px;
		font-size: 11px;
		border-radius: 6px;
		box-shadow: none;
	}
	.btn.ghost {
		padding: 0 8px;
		border-color: transparent;
		background: none;
		color: var(--shell-forest-raised, #22503c);
	}
	.btn.ghost:hover:not(:disabled) {
		background: var(--shell-leaf-tint, #e7f1ea);
	}

	/* Stop navigation: previous / next with the place in the Guide. */
	.stop-nav {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px 0;
	}
	.step-kind {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
	.step-kind button {
		min-height: 20px;
		padding: 0 6px;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 5px;
		background: var(--shell-card, #fff);
		color: var(--shell-ink-2, #4a524c);
		font-size: 10px;
	}
	.step-kind button[aria-pressed='true'] {
		background: var(--shell-leaf-tint, #e8f1ea);
		color: var(--shell-forest-raised, #22503c);
	}
	.step-seconds {
		font: 600 10px var(--shell-mono, ui-monospace, monospace);
		color: var(--shell-ink-3, #79817b);
	}
	.step-add {
		color: var(--shell-caution, #b5682d);
		border-color: var(--shell-caution, #b5682d);
	}
	.step {
		display: inline-flex;
		gap: 2px;
		flex: none;
		margin-left: auto;
	}
	.where {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--shell-ink-3, #79817b);
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
		background: var(--shell-forest, #11291f);
		color: #fff;
		font: 600 10.5px/1 var(--shell-mono, ui-monospace, monospace);
		flex: none;
	}
	.num.lg {
		min-width: 24px;
		height: 24px;
		border-radius: 12px;
		font-size: 12px;
	}
	.def {
		flex: none;
		color: var(--shell-ink-2, #4a524c);
		font-size: 10px;
	}

	/* Visits: the Presentation this Stop visits. */
	.visits {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 8px 12px 0;
		padding: 8px;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 10px;
		background: var(--shell-card, #fff);
		text-align: left;
		box-shadow: var(--shell-furniture-shadow, none);
	}
	.visits:hover {
		border-color: var(--shell-hairline-strong, #cdd2ca);
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
		box-shadow: 0 0 0 2px var(--shell-card, #fff);
	}
	.visits-txt {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.visits-txt small {
		color: var(--shell-ink-3, #79817b);
		font-size: 9.5px;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}
	.visits-txt b {
		font: 500 15px/1.2 var(--shell-serif, serif);
		overflow-wrap: anywhere;
	}
	.visits-txt .open {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		margin-top: 2px;
		color: var(--shell-forest-raised, #22503c);
		font-size: 11.5px;
		font-weight: 600;
	}

	/* Sections */
	.c-sec {
		display: flex;
		flex-direction: column;
		padding: 12px 12px 4px;
	}
	.c-sec + .c-sec {
		border-top: 1px solid var(--shell-hairline, #e1e4de);
		margin-top: 12px;
	}
	.c-sec h3 {
		margin: 0 0 8px;
		font: 650 12.5px/1.2 var(--shell-sans, system-ui);
		color: var(--shell-ink, #1b201c);
	}
	.c-sec h3 .n {
		margin-left: 6px;
		padding: 1px 6px;
		border-radius: 8px;
		background: var(--shell-hover, #eef0ed);
		color: var(--shell-ink-3, #79817b);
		font-size: 10.5px;
		font-weight: 600;
	}
	.c-sec-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	.c-sub {
		margin: 12px 0 6px;
		color: var(--shell-ink-2, #4a524c);
		font-size: 11.5px;
		font-weight: 600;
	}
	.c-foot-note {
		display: flex;
		gap: 5px;
		align-items: baseline;
		margin: 10px 0 0;
		color: var(--shell-ink-3, #79817b);
		font-size: 11.5px;
		line-height: 1.45;
	}
	.c-note {
		margin: 6px 0 0;
		color: var(--shell-ink-2, #4a524c);
		font-size: 12px;
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

	/* Shots */
	.shots {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.shot {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 42px;
		padding: 4px 4px 4px 2px;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 8px;
		background: var(--shell-card, #fff);
	}
	.shot.dragging {
		border-color: var(--shell-gold, #d4ad45);
		box-shadow: var(--shell-shadow);
	}
	.grip {
		display: inline-flex;
		flex: none;
		color: var(--shell-ink-3, #79817b);
	}
	.grip[draggable="true"] {
		cursor: grab;
	}
	.shot-n {
		flex: none;
		width: 14px;
		text-align: center;
		color: var(--shell-forest, #11291f);
		font: 600 12px var(--shell-mono, ui-monospace, monospace);
		font-variant-numeric: tabular-nums;
	}
	.shot-thumb {
		display: inline-flex;
		flex: none;
	}
	.shot-thumb :global(.snapshot.row) {
		width: 52px;
		height: 36px;
		border-radius: 5px;
	}
	.shot.is-out .shot-thumb :global(.snapshot.row) {
		width: 46px;
		height: 30px;
	}
	.shot.drop-before::before,
	.shot.drop-after::after {
		position: absolute;
		z-index: 1;
		right: 0;
		left: 0;
		height: 2px;
		border-radius: 1px;
		background: var(--shell-gold, #d4ad45);
		content: '';
		pointer-events: none;
	}
	.shot.drop-before::before { top: -3px; }
	.shot.drop-after::after { bottom: -3px; }
	.shot-main {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.shot-name {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}
	.shot-meta {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.hold-lbl {
		color: var(--shell-ink-3, #79817b);
		font-size: 10.5px;
	}
	.name-btn {
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		font: 500 12px var(--shell-sans, system-ui);
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	button.name-btn:hover {
		color: var(--shell-forest-raised, #22503c);
		text-decoration: underline;
		text-decoration-color: var(--shell-hairline-strong, #cdd2ca);
	}
	.tag {
		flex: none;
		padding: 1px 5px;
		border-radius: 4px;
		background: var(--shell-forest, #11291f);
		color: #fff;
		font: 700 10px var(--shell-mono, ui-monospace, monospace);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.stepper {
		display: inline-flex;
		align-items: center;
		height: 22px;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 7px;
		background: var(--shell-card, #fff);
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
		color: var(--shell-ink-3, #79817b);
	}
	.stepper button:hover:not(:disabled) {
		background: var(--shell-leaf-tint, #e7f1ea);
		color: var(--shell-forest-raised, #22503c);
	}
	.stepper .value {
		min-width: 26px;
		text-align: center;
		font: 600 11px var(--shell-mono, ui-monospace, monospace);
	}
	.shot-x {
		flex: none;
		width: 24px;
		height: 24px;
		opacity: 0.55;
	}
	.shot-x:not(:disabled):is(:hover, :focus-visible) { opacity: 1; }
	.shot.is-out {
		padding-left: 6px;
		border-style: dashed;
		background: transparent;
	}
	.shot.is-out .shot-thumb {
		opacity: 0.6;
		filter: saturate(0.3);
	}
	.shot.is-out .name-btn {
		color: var(--shell-ink-2, #4a524c);
	}
	.include {
		flex: none;
	}
	.disc {
		display: flex;
		align-items: center;
		gap: 5px;
		width: 100%;
		min-height: 28px;
		margin-top: 10px;
		padding: 0 4px;
		border: 0;
		border-radius: 6px;
		background: none;
		color: var(--shell-ink-2, #4a524c);
		font-size: 11.5px;
		font-weight: 600;
		text-align: left;
	}
	.disc:hover {
		background: var(--shell-hover, #eef0ed);
	}

	/* After this Stop */
	.after {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.after-next {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		padding: 8px 10px;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 8px;
		background: var(--shell-leaf-tint, #e7f1ea);
		color: var(--shell-forest-raised, #22503c);
	}
	.an-lbl {
		color: var(--shell-ink-2, #4a524c);
		font-size: 11.5px;
	}
	.an-lbl b {
		color: var(--shell-ink, #1b201c);
	}
	.stop-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		max-width: 100%;
		min-height: 26px;
		padding: 0 8px 0 3px;
		border: 0;
		border-radius: 13px;
		background: var(--shell-card, #fff);
		box-shadow: inset 0 0 0 1px var(--shell-hairline-strong, #cdd2ca);
		color: var(--shell-forest, #11291f);
		font-size: 12px;
		font-weight: 600;
	}
	.stop-link:not(:has(.num)) {
		padding-left: 10px;
	}
	.stop-link[aria-expanded='true'] {
		box-shadow: inset 0 0 0 1px var(--shell-ink-3, #79817b);
	}
	.stop-link-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.link-row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 34px;
		padding: 5px 8px;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 8px;
		background: var(--shell-card, #fff);
		font-size: 12px;
		text-align: left;
	}
	.link-row > span {
		flex: 1;
	}
	.link-row:hover {
		border-color: var(--shell-hairline-strong, #cdd2ca);
		background: var(--shell-hover, #eef0ed);
	}
	.link-row > :global(svg:last-child) {
		color: var(--shell-ink-3, #79817b);
	}

	/* Menus */
	.popover {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		z-index: 5;
		padding: 4px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 8px;
		background: var(--shell-card, #fff);
		box-shadow: var(--shell-shadow);
	}
	.popover-title {
		margin: 2px 6px 4px;
		color: var(--shell-ink-3, #79817b);
		font: 600 10.5px var(--shell-sans, system-ui);
	}
	.menu {
		display: flex;
		flex-direction: column;
	}
	.menu-item {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		min-height: 28px;
		padding: 4px 6px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		font-size: 12px;
		text-align: left;
	}
	.menu-item:hover:not(:disabled) {
		background: var(--shell-hover, #eef0ed);
	}
	.menu-item[aria-checked='true'] {
		font-weight: 600;
	}
	.menu-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.hint-text {
		color: var(--shell-ink-3, #79817b);
		font-size: 11px;
	}
	@media (pointer: coarse) {
		button {
			min-height: 44px;
		}
		.step-kind button,
		.step-add {
			min-width: 44px;
			min-height: 44px;
		}
		.shot button,
		.icon-btn {
			min-width: 44px;
		}
		.shot {
			display: grid;
			grid-template-columns: 44px auto auto minmax(0, 1fr) auto;
		}
		.shot.is-out { grid-template-columns: auto minmax(0, 1fr) auto; }
		.shot-name { flex-wrap: wrap; }
		.grip {
			display: inline-grid;
			place-items: center;
			min-height: 44px;
		}
		.shot-main { display: contents; }
		.shot-meta {
			grid-column: 1 / -1;
			grid-row: 2;
		}
		.stepper { height: auto; }
	}
</style>
