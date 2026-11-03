<script module lang="ts">
	/** Each mounted Guide takes its own id, so the hidden reason references never collide. */
	let instances = 0;
</script>

<script lang="ts">
	/**
	 * The Guide instrument (R217.S25): the Experience's Stops as 118 px cards with their
	 * connectors, the header (name, + Stop, compact, close) and the Stop-order bar. It sits
	 * in the lower column above the dock, in the shared forest material.
	 *
	 * It holds no Experience state. Every read goes through the controller and every write
	 * through a controller command; selecting goes through the homes' one `select`, which
	 * never moves the Camera. Its own state is local: whether the cards are compact, the
	 * typed first-Guide name, the open + Stop menu, and the drag in progress.
	 */
	import { tick, untrack } from 'svelte';
	import ShellIcon from '../stage/shell/ShellIcon.svelte';
	import ExperienceSnapshot from './ExperienceSnapshot.svelte';
	import { experienceHomes } from './experience-homes';

	let { onClose }: { onClose: () => void } = $props();

	instances += 1;
	const instanceId = `experience-guide-${instances}`;
	const followReasonId = `${instanceId}-follow-reason`;
	const playReasonId = `${instanceId}-play-reason`;
	const addReasonId = `${instanceId}-add-reason`;

	/** What the Index's Presentation rows put on the drag (contract: agent B). */
	const PRESENTATION_MIME = 'application/x-biskiq-presentation';

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const current = $derived(controller?.current ?? null);
	const hasGuide = $derived((controller?.guides.length ?? 0) > 0);
	const guide = $derived(controller?.currentGuide ?? null);
	const stops = $derived(controller?.guideStops ?? []);
	const presentations = $derived(current?.presentations ?? []);
	const busy = $derived(controller?.busy ?? false);
	const subject = $derived(controller?.subject ?? null);
	const subjectStopId = $derived(
		subject !== null && (subject.kind === 'stop' || subject.kind === 'transition') ? subject.stopId : null
	);
	const selectedStopId = $derived(
		subjectStopId !== null && stops.some((stop) => stop.id === subjectStopId) ? subjectStopId : null
	);
	const selectedStopIndex = $derived(stops.findIndex((stop) => stop.id === selectedStopId));
	const guideSelected = $derived(subject?.kind === 'guide');
	/** The Presentation awaiting a first-Guide name (Presentation Add to Guide, or a drop without a name). */
	const pending = $derived(homes.guideNamePrompt());
	const pendingLabel = $derived(pending === null ? null : (controller?.presentationLabel(pending) ?? null));

	let compact = $state(false);
	let guideName = $state('');
	let nameInput = $state<HTMLInputElement | null>(null);
	let menuOpen = $state(false);
	let menuWrap = $state<HTMLElement | null>(null);
	let addButton = $state<HTMLButtonElement | null>(null);
	let scrollerEl = $state<HTMLElement | null>(null);
	let rowEl = $state<HTMLElement | null>(null);
	let barEl = $state<HTMLElement | null>(null);
	/** Cards the pointer has focused last, so the roving tab stop survives a cleared selection. */
	let focusedStopId = $state<string | null>(null);

	// ---- Reading: cards, connectors, reasons ----

	type Connector = {
		readonly shape: 'adjacent' | 'jump' | 'end';
		readonly text: string;
		readonly name: string;
		readonly transition: 'cut' | 'travel' | null;
		readonly gap: boolean;
	};
	type CardFacts = {
		readonly stopId: string;
		readonly number: number;
		readonly label: string;
		readonly hold: string | null;
		readonly again: boolean;
		readonly name: string;
		readonly connector: Connector | null;
	};

	function transitionWord(transition: 'cut' | 'travel'): string {
		return transition === 'travel' ? 'Travel' : 'Cut';
	}

	function holdWord(seconds: number | undefined): string | null {
		if (seconds === undefined) return null;
		return `${Number.isInteger(seconds) ? seconds : Number(seconds.toFixed(1))}s`;
	}

	const cards = $derived.by((): readonly CardFacts[] => {
		if (controller === null) return [];
		return stops.map((stop, index) => {
			const number = index + 1;
			const label = controller.presentationLabel(stop.presentationId);
			const again = stops.slice(0, index).some((earlier) => earlier.presentationId === stop.presentationId);
			const hold = holdWord(stop.holdSeconds);
			const resolved = controller.resolveContinuation(stop.id);
			const gaps = controller.travelGapsByStop.get(stop.id) ?? [];
			let connector: Connector | null = null;
			if (resolved !== null && resolved.kind === 'end') {
				connector = { shape: 'end', text: 'End', name: `Stop ${number} ends the Guide`, transition: null, gap: false };
			} else if (resolved !== null) {
				const gap = resolved.transition === 'travel' && gaps.length > 0;
				const target =
					resolved.kind === 'adjacent' || resolved.position !== null
						? `Stop ${resolved.position}`
						: 'a Stop outside this Guide';
				const attention = gap ? '. Travel has no Camera connection yet' : '';
				connector = {
					shape: resolved.kind,
					text:
						resolved.kind === 'adjacent'
							? resolved.transition
							: resolved.position === null
								? '→ elsewhere'
								: `→ ${resolved.position}`,
					name: `Stop ${number} continues to ${target} by ${transitionWord(resolved.transition)}${attention}`,
					transition: resolved.transition,
					gap
				};
			}
			const spoken = [`Stop ${number}`, label];
			if (again) spoken.push('again');
			if (hold !== null) spoken.push(`hold ${hold.slice(0, -1)} seconds`);
			return { stopId: stop.id, number, label, hold, again, name: spoken.join(', '), connector };
		});
	});

	/** The roving tab stop: the selected card, else the last focused one, else the first. */
	const rovingStopId = $derived(
		selectedStopId ?? (stops.some((stop) => stop.id === focusedStopId) ? focusedStopId : (stops[0]?.id ?? null))
	);

	const addReason = $derived.by((): string | null => {
		if (busy) return 'Saving the last change';
		if (!hasGuide && guideName.trim() === '') return 'Name the Guide first';
		if (presentations.length === 0) return 'Add a Presentation first';
		return null;
	});

	function inGuide(presentationId: string): boolean {
		return stops.some((stop) => stop.presentationId === presentationId);
	}

	// ---- Writing: adding Stops ----

	async function addStop(presentationId: string, afterStopId?: string): Promise<boolean> {
		if (controller === null) return false;
		const options: { afterStopId?: string; firstGuideLabel?: string } = {};
		if (afterStopId !== undefined) options.afterStopId = afterStopId;
		if (!hasGuide) options.firstGuideLabel = guideName.trim();
		const accepted = await controller.addStop(presentationId, Object.keys(options).length > 0 ? options : undefined);
		if (accepted && homes.guideNamePrompt() !== null) homes.requestGuideName(null);
		return accepted;
	}

	/** The first Stop of an empty Guide: needs the Guide's name when there is no Guide yet (D8). */
	async function addFirstStop(presentationId: string): Promise<void> {
		if (!hasGuide && guideName.trim() === '') {
			homes.requestGuideName(presentationId);
			nameInput?.focus();
			return;
		}
		await addStop(presentationId);
	}

	async function chooseFromMenu(presentationId: string): Promise<void> {
		closeMenu();
		await addStop(presentationId);
	}

	async function commitPending(): Promise<void> {
		if (pending === null || guideName.trim() === '' || busy) return;
		await addStop(pending);
	}

	function onNameKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			void commitPending();
		}
	}

	// Asked for a name: put the cursor where it is typed.
	$effect(() => {
		if (pending !== null && !hasGuide && nameInput !== null) nameInput.focus();
	});

	// ---- Selection ----

	function selectStop(stopId: string): void {
		homes.select({ kind: 'stop', stopId });
	}

	function selectTransition(stopId: string): void {
		homes.select({ kind: 'transition', stopId });
	}

	function selectGuide(): void {
		if (guide !== null) homes.select({ kind: 'guide', guideId: guide.id });
	}

	// ---- The + Stop menu ----

	function openMenu(): void {
		if (addReason !== null) return;
		menuOpen = true;
		void tick().then(() => menuWrap?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
	}

	function closeMenu(): void {
		menuOpen = false;
	}

	function onWindowPointerDown(event: PointerEvent): void {
		if (menuOpen && menuWrap !== null && !menuWrap.contains(event.target as Node)) closeMenu();
	}

	function onMenuKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.stopPropagation();
			closeMenu();
			addButton?.focus();
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const items = [...(menuWrap?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
		const at = items.indexOf(document.activeElement as HTMLElement);
		const next = event.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
		items[next]?.focus();
	}

	// ---- Cards: DOM measure, reveal, bracket ----

	function cardEls(): HTMLElement[] {
		return rowEl === null ? [] : [...rowEl.querySelectorAll<HTMLElement>(':scope > .stop-card')];
	}

	function cardEl(stopId: string): HTMLElement | null {
		return cardEls().find((el) => el.dataset.stopId === stopId) ?? null;
	}

	/** Scrolls a card just into view; instant, never smooth (a drag must not chase a moving target). */
	function revealStop(stopId: string): boolean {
		const scroller = scrollerEl;
		const el = cardEl(stopId);
		if (scroller === null || el === null) return false;
		const left = el.offsetLeft - 16;
		const right = el.offsetLeft + el.offsetWidth + 60;
		if (left < scroller.scrollLeft) scroller.scrollLeft = Math.max(0, left);
		else if (right > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = right - scroller.clientWidth;
		return true;
	}

	let lastRevealed: { key: string; scroller: HTMLElement } | null = null;
	$effect(() => {
		const key = selectedStopId;
		const scroller = scrollerEl;
		void stops; // retried when the new card arrives after its selection
		untrack(() => {
			if (key === null || scroller === null) {
				lastRevealed = null;
				return;
			}
			if (lastRevealed?.key === key && lastRevealed.scroller === scroller) return;
			if (dragging !== null) return;
			if (revealStop(key)) lastRevealed = { key, scroller };
		});
	});

	/** The cards scrolled into view, as first and last index; null when they all show. */
	let inView = $state<{ first: number; last: number } | null>(null);

	function measureView(): void {
		const scroller = scrollerEl;
		const els = cardEls();
		if (scroller === null || els.length === 0) {
			inView = null;
			return;
		}
		const from = scroller.scrollLeft;
		const to = from + scroller.clientWidth;
		let first = -1;
		let last = -1;
		els.forEach((el, index) => {
			const centre = el.offsetLeft + el.offsetWidth / 2;
			if (centre > from && centre < to) {
				if (first < 0) first = index;
				last = index;
			}
		});
		inView = first < 0 || (first === 0 && last === els.length - 1) ? null : { first, last };
	}

	$effect(() => {
		const scroller = scrollerEl;
		const row = rowEl;
		void stops;
		if (scroller === null || row === null) {
			inView = null;
			return;
		}
		measureView();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(() => measureView());
		observer.observe(scroller);
		observer.observe(row);
		return () => observer.disconnect();
	});

	// ---- Keyboard ----

	async function focusCard(stopId: string): Promise<void> {
		await tick();
		cardEl(stopId)?.focus();
	}

	function onCardKeydown(event: KeyboardEvent, stopId: string, index: number): void {
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			const direction = event.key === 'ArrowLeft' ? -1 : 1;
			if (event.altKey) {
				if (controller === null || busy) return;
				void controller.moveStop(stopId, direction).then(async () => {
					await tick();
					revealStop(stopId);
					cardEl(stopId)?.focus();
				});
				return;
			}
			const target = stops[index + direction];
			if (target === undefined) return;
			selectStop(target.id);
			void focusCard(target.id);
		} else if (event.key === 'Home' || event.key === 'End') {
			const target = event.key === 'Home' ? stops[0] : stops[stops.length - 1];
			if (target === undefined) return;
			event.preventDefault();
			selectStop(target.id);
			void focusCard(target.id);
		}
	}

	// ---- Insertion point (caret) ----

	/** The caret's place in the card row, and on the bar, as the gap it stands in. */
	let caretPx = $state<number | null>(null);
	let barCaretPct = $state<number | null>(null);
	/** An empty Guide's drop zone is hovered by a Presentation. */
	let emptyOver = $state(false);

	function gapX(at: number): number | null {
		const els = cardEls();
		if (els.length === 0) return null;
		if (at <= 0) return els[0]!.offsetLeft - 4;
		const previous = els[at - 1]!;
		const previousRight = previous.offsetLeft + previous.offsetWidth;
		if (at >= els.length) return previousRight + 4;
		return (previousRight + els[at]!.offsetLeft) / 2;
	}

	/** The gap, as an insertion index in the current order, the pointer is nearest. */
	function atFromX(clientX: number, skip: number | null): number {
		const els = cardEls();
		for (let index = 0; index < els.length; index += 1) {
			if (index === skip) continue;
			const rect = els[index]!.getBoundingClientRect();
			if (clientX < rect.left + rect.width / 2) return index;
		}
		return els.length;
	}

	/** The bar segment under the pointer (with a margin around the bar), or null off the bar. */
	function barSegment(clientX: number, clientY: number): { seg: number; rel: number } | null {
		if (barEl === null || stops.length === 0) return null;
		const rect = barEl.getBoundingClientRect();
		if (clientY < rect.top - 14 || clientY > rect.bottom + 14) return null;
		if (clientX < rect.left - 10 || clientX > rect.right + 10) return null;
		const rel = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * stops.length;
		return { seg: Math.min(stops.length - 1, Math.floor(rel)), rel };
	}

	function clearCaret(): void {
		caretPx = null;
		barCaretPct = null;
		emptyOver = false;
	}

	// ---- Reorder by pointer ----

	type Press = { stopId: string; from: number; x: number; y: number; scroll: number };
	let press: Press | null = null;
	let dragging = $state<{ stopId: string; dx: number; dy: number; onBar: boolean } | null>(null);
	let suppressClick = false;

	function onCardPointerDown(event: PointerEvent, stopId: string, from: number): void {
		if (event.button !== 0 || busy || stops.length < 2) return;
		press = { stopId, from, x: event.clientX, y: event.clientY, scroll: scrollerEl?.scrollLeft ?? 0 };
		window.addEventListener('pointermove', onPressMove);
		window.addEventListener('pointerup', onPressUp);
		window.addEventListener('pointercancel', endPress);
		window.addEventListener('keydown', onPressKey, true);
	}

	/** Where a dragged card would land, as its final index, for the pointer's position. */
	function dropIndex(clientX: number, clientY: number, from: number): { to: number; onBar: boolean } {
		const bar = barSegment(clientX, clientY);
		if (bar !== null) return { to: bar.seg, onBar: true };
		const at = atFromX(clientX, from);
		return { to: at > from ? at - 1 : at, onBar: false };
	}

	function showReorderCaret(to: number, from: number, onBar: boolean): void {
		if (to === from) {
			clearCaret();
			return;
		}
		if (onBar) {
			caretPx = null;
			barCaretPct = ((to > from ? to + 1 : to) / stops.length) * 100;
		} else {
			barCaretPct = null;
			caretPx = gapX(to > from ? to + 1 : to);
		}
	}

	function onPressMove(event: PointerEvent): void {
		if (press === null) return;
		const scroller = scrollerEl;
		const dx = event.clientX - press.x + ((scroller?.scrollLeft ?? 0) - press.scroll);
		const dy = event.clientY - press.y;
		if (dragging === null && Math.hypot(event.clientX - press.x, dy) < 6) return;
		if (scroller !== null) {
			const rect = scroller.getBoundingClientRect();
			if (event.clientY > rect.top - 20 && event.clientY < rect.bottom) {
				if (event.clientX < rect.left + 50) scroller.scrollLeft -= 14;
				else if (event.clientX > rect.right - 50) scroller.scrollLeft += 14;
			}
		}
		const { to, onBar } = dropIndex(event.clientX, event.clientY, press.from);
		dragging = { stopId: press.stopId, dx, dy: onBar ? dy : 0, onBar };
		showReorderCaret(to, press.from, onBar);
	}

	function onPressUp(event: PointerEvent): void {
		const finished = press;
		const wasDragging = dragging !== null;
		endPress();
		if (finished === null || !wasDragging) return;
		suppressClick = true;
		setTimeout(() => (suppressClick = false), 0);
		const { to } = dropIndex(event.clientX, event.clientY, finished.from);
		if (to !== finished.from && controller !== null) {
			void controller.moveStopTo(finished.stopId, to).then(() => focusCard(finished.stopId));
		}
	}

	/** Escape leaves the drag alone and keeps the selection and the Guide as they are. */
	function onPressKey(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		event.stopPropagation();
		event.preventDefault();
		endPress();
	}

	function endPress(): void {
		window.removeEventListener('pointermove', onPressMove);
		window.removeEventListener('pointerup', onPressUp);
		window.removeEventListener('pointercancel', endPress);
		window.removeEventListener('keydown', onPressKey, true);
		press = null;
		dragging = null;
		clearCaret();
	}

	$effect(() => endPress);

	function onCardClick(stopId: string): void {
		if (suppressClick) return;
		selectStop(stopId);
	}

	// ---- Insert by dropping a Presentation from the Index ----

	type DropTarget = { kind: 'first' } | { kind: 'after'; afterStopId: string; at: number; onBar: boolean };

	function dropTarget(event: DragEvent): DropTarget | null {
		if (controller === null || busy) return null;
		const target = event.target instanceof Element ? event.target : null;
		if (stops.length === 0) return target?.closest('.empty') ? { kind: 'first' } : null;
		let at: number;
		let onBar = false;
		const bar = barSegment(event.clientX, event.clientY);
		if (bar !== null) {
			at = Math.round(bar.rel);
			onBar = true;
		} else if (target?.closest('.cards')) {
			at = atFromX(event.clientX, null);
		} else {
			return null;
		}
		// The gap before the first card is not an insert target: no card stands to its left.
		const left = stops[at - 1];
		return left === undefined ? null : { kind: 'after', afterStopId: left.id, at, onBar };
	}

	function isPresentationDrag(event: DragEvent): boolean {
		return event.dataTransfer?.types.includes(PRESENTATION_MIME) ?? false;
	}

	function onDragOver(event: DragEvent): void {
		if (!isPresentationDrag(event)) return;
		const target = dropTarget(event);
		if (target === null) {
			clearCaret();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
			return;
		}
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		if (target.kind === 'first') {
			caretPx = null;
			barCaretPct = null;
			emptyOver = true;
		} else if (target.onBar) {
			caretPx = null;
			emptyOver = false;
			barCaretPct = (target.at / stops.length) * 100;
		} else {
			barCaretPct = null;
			emptyOver = false;
			caretPx = gapX(target.at);
		}
	}

	function onDragLeave(event: DragEvent): void {
		const next = event.relatedTarget;
		if (!(next instanceof Node) || !(event.currentTarget as HTMLElement).contains(next)) clearCaret();
	}

	function onDrop(event: DragEvent): void {
		if (!isPresentationDrag(event)) return;
		const presentationId = event.dataTransfer?.getData(PRESENTATION_MIME) ?? '';
		const target = dropTarget(event);
		clearCaret();
		if (presentationId === '' || target === null) return;
		event.preventDefault();
		if (target.kind === 'first') void addFirstStop(presentationId);
		else void addStop(presentationId, target.afterStopId);
	}
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

{#if controller === null}
	<p class="status" role="status">The Experience lens mounts with the admitted project source.</p>
{:else if current === null}
	<p class="status">Create an Experience in the Index before composing its Guide.</p>
{:else}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="guide"
		role="group"
		aria-label="Guide"
		data-experience-guide
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		<header class="head">
			<span class="kicker">Guide</span>
			{#if hasGuide}
				{#if guide !== null}
					<button
						type="button"
						class="guide-name"
						class:selected={guideSelected}
						aria-pressed={guideSelected}
						title="Show this Guide's Card"
						onclick={selectGuide}
					>
						{guide.label}
					</button>
				{:else}
					<span class="guide-name plain">Guide</span>
				{/if}
				<span class="count">{stops.length} {stops.length === 1 ? 'stop' : 'stops'}</span>
			{:else}
				<input
					class="name-input"
					type="text"
					placeholder="Name this Guide"
					aria-label="Guide name"
					bind:value={guideName}
					bind:this={nameInput}
					onkeydown={onNameKeydown}
				/>
			{/if}
			<span class="spacer"></span>
			<button
				type="button"
				class="tool"
				disabled
				title="Comes with Camera playback"
				aria-describedby={followReasonId}
			>
				<ShellIcon name="camera" size={13} />
				<span class="word">Follow</span>
			</button>
			<span class="menu-wrap" bind:this={menuWrap}>
				<button
					type="button"
					class="tool"
					bind:this={addButton}
					disabled={addReason !== null}
					title={addReason ?? 'Add a Presentation as a Stop'}
					aria-describedby={addReason !== null ? addReasonId : undefined}
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					onclick={() => (menuOpen ? closeMenu() : openMenu())}
				>
					<ShellIcon name="plus" size={13} />
					<span class="word">Stop</span>
				</button>
				{#if menuOpen}
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<div class="menu" role="menu" aria-label="Add a Presentation as a Stop" tabindex="-1" onkeydown={onMenuKeydown}>
						{#each presentations as presentation (presentation.id)}
							<button type="button" role="menuitem" class="menu-item" onclick={() => void chooseFromMenu(presentation.id)}>
								<span class="menu-label">{presentation.label}</span>
								{#if inGuide(presentation.id)}<span class="menu-hint">again</span>{/if}
							</button>
						{/each}
					</div>
				{/if}
			</span>
			{#if stops.length > 0}
				<button
					type="button"
					class="icon"
					class:flipped={compact}
					aria-expanded={!compact}
					aria-label={compact ? 'Show Stop cards' : 'Compact Guide'}
					title={compact ? 'Show Stop cards' : 'Compact: overview only'}
					onclick={() => (compact = !compact)}
				>
					<ShellIcon name="chevronDown" size={15} />
				</button>
			{/if}
			<button type="button" class="icon" aria-label="Close Guide" title="Close the Guide" onclick={onClose}>
				<ShellIcon name="close" size={15} />
			</button>
		</header>

		{#if stops.length === 0}
			<div class="empty" class:over={emptyOver}>
				<p>Choose <b>+ Stop</b>, or drag a Presentation here from the Index.</p>
				{#if pending !== null && !hasGuide}
					<p class="empty-note">
						{#if guideName.trim() === ''}
							Name the Guide, then press Enter to add {pendingLabel ?? 'it'}.
						{:else}
							Press Enter to add {pendingLabel ?? 'it'} as the first Stop.
						{/if}
					</p>
					<button
						type="button"
						class="tool"
						disabled={guideName.trim() === '' || busy}
						title={guideName.trim() === '' ? 'Name the Guide first' : undefined}
						onclick={() => void commitPending()}
					>
						Add {pendingLabel ?? 'it'}
					</button>
				{/if}
			</div>
		{:else}
			{#if !compact}
				<div class="cards" bind:this={scrollerEl} onscroll={measureView}>
					<div class="row" role="group" aria-label={guide !== null ? `Stops in ${guide.label}` : 'Stops'} bind:this={rowEl}>
						{#each cards as card, index (card.stopId)}
							{@const selected = selectedStopId === card.stopId && subject?.kind === 'stop'}
							{@const isDragging = dragging?.stopId === card.stopId}
							<button
								type="button"
								class="stop-card"
								class:selected
								class:dragging={isDragging}
								data-stop-id={card.stopId}
								aria-pressed={selected}
								aria-label={card.name}
								tabindex={rovingStopId === card.stopId ? 0 : -1}
								style:transform={isDragging && dragging !== null
									? `translate(${dragging.dx}px, ${dragging.dy}px)${dragging.onBar ? ' scale(.9)' : ''}`
									: undefined}
								onpointerdown={(event) => onCardPointerDown(event, card.stopId, index)}
								onclick={() => onCardClick(card.stopId)}
								onkeydown={(event) => onCardKeydown(event, card.stopId, index)}
								onfocus={() => (focusedStopId = card.stopId)}
							>
								<ExperienceSnapshot label={card.label} number={card.number} ratio="stop" />
								<span class="stop-name">{card.label}</span>
								<span class="stop-meta">
									{#if card.again}<em>again</em>{/if}
									{#if card.again && card.hold !== null}<span aria-hidden="true"> · </span>{/if}
									{#if card.hold !== null}<span>{card.hold}</span>{/if}
								</span>
							</button>
							<span class="slot" class:adjacent={card.connector?.shape === 'adjacent'}>
								{#if card.connector !== null}
									{@const connector = card.connector}
									<button
										type="button"
										class="chip {connector.shape}"
										class:cut={connector.transition === 'cut'}
										class:travel={connector.transition === 'travel'}
										class:gap={connector.gap}
										class:selected={subject?.kind === 'transition' && subject.stopId === card.stopId}
										aria-pressed={subject?.kind === 'transition' && subject.stopId === card.stopId}
										aria-label={connector.name}
										title={connector.name}
										tabindex={rovingStopId === card.stopId ? 0 : -1}
										onclick={() => selectTransition(card.stopId)}
									>
										{connector.text}
									</button>
								{/if}
							</span>
						{/each}
						{#if caretPx !== null}
							<span class="caret" style:left="{caretPx}px" aria-hidden="true"></span>
						{/if}
					</div>
				</div>
			{/if}

			<div class="scrub">
				<button
					type="button"
					class="play"
					disabled
					aria-label="Play"
					title="Comes with Camera playback"
					aria-describedby={playReasonId}
				>
					<ShellIcon name="play" size={13} />
				</button>
				<div
					class="bar"
					role="img"
					aria-label={selectedStopIndex >= 0
						? `${stops.length} Stops in order, Stop ${selectedStopIndex + 1} selected`
						: `${stops.length} Stops in order`}
					bind:this={barEl}
				>
					{#each stops as stop, index (stop.id)}
						<span class="seg" class:selected={selectedStopId === stop.id}>
							{#if cards[index]?.hold}<span class="seg-hold">{cards[index]?.hold}</span>{/if}
						</span>
					{/each}
					{#if inView !== null && !compact}
						<span
							class="bracket"
							style:left="{(inView.first / stops.length) * 100}%"
							style:width="{((inView.last - inView.first + 1) / stops.length) * 100}%"
						></span>
					{/if}
					{#if barCaretPct !== null}
						<span class="bar-caret" style:left="{barCaretPct}%"></span>
					{/if}
				</div>
			</div>
		{/if}

		<span id={followReasonId} class="visually-hidden">Comes with Camera playback</span>
		<span id={playReasonId} class="visually-hidden">Comes with Camera playback</span>
		{#if addReason !== null}<span id={addReasonId} class="visually-hidden">{addReason}</span>{/if}
	</div>
{/if}

<style>
	.status {
		margin: 0;
		color: var(--shell-ink-quiet, #9fb2a5);
		font-size: 12px;
	}
	.guide {
		position: relative;
		display: flex;
		flex-direction: column;
		/* Centred, it stays clear of the Card on the right, so the Card can run down to the dock. */
		--guide-room: max(320px, calc(100% - 2 * (var(--shell-card-width, 288px) + var(--sheet-lane-right, 40px) + 30px)));
		width: max-content;
		min-width: min(560px, var(--guide-room));
		max-width: var(--guide-room);
		border-radius: 12px;
		background: var(--shell-forest, #11291f);
		color: var(--shell-ink-light, #eef1ec);
		box-shadow: 0 12px 30px rgb(0 0 0 / 0.28);
	}

	/* ---- Header ---- */
	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 6px 6px 12px;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
	}
	.kicker {
		font: 600 10px var(--shell-sans, system-ui, sans-serif);
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: #9fbcaa;
	}
	.guide-name {
		min-width: 0;
		max-width: 22ch;
		padding: 0;
		border: 0;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: #fff;
		font: 15px var(--shell-serif, Georgia, serif);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
	}
	.guide-name.plain {
		cursor: default;
	}
	.guide-name:hover:not(.plain) {
		border-bottom-color: rgb(255 255 255 / 0.3);
	}
	.guide-name.selected {
		border-bottom-color: var(--shell-gold, #d4ad45);
	}
	.count {
		color: var(--shell-ink-quiet, #9fb2a5);
		font-size: 11.5px;
		white-space: nowrap;
	}
	.name-input {
		flex: 1;
		min-width: 8ch;
		max-width: 26ch;
		height: 26px;
		padding: 0 8px;
		border: 1px solid rgb(255 255 255 / 0.18);
		border-radius: 7px;
		background: rgb(255 255 255 / 0.07);
		color: #fff;
		font: 15px var(--shell-serif, Georgia, serif);
	}
	.name-input::placeholder {
		color: #9fbcaa;
	}
	.spacer {
		flex: 1;
	}
	.tool {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 26px;
		padding: 0 9px;
		border: 0;
		border-radius: 7px;
		background: rgb(255 255 255 / 0.09);
		color: inherit;
		font: inherit;
		font-size: 12px;
		white-space: nowrap;
		cursor: pointer;
	}
	.tool:hover:not(:disabled) {
		background: rgb(255 255 255 / 0.16);
	}
	.tool[aria-expanded='true'] {
		background: rgb(79 143 108 / 0.45);
	}
	.icon {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		padding: 0;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: #cfdcd2;
		cursor: pointer;
	}
	.icon:hover {
		background: rgb(255 255 255 / 0.1);
	}
	.icon.flipped :global(svg) {
		transform: rotate(180deg);
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.guide button:focus-visible,
	.guide input:focus-visible {
		outline: 2px solid var(--shell-ink-light, #eef1ec);
		outline-offset: 1px;
		box-shadow: none;
	}

	/* ---- + Stop menu: opens upward, over the Stage, since the Guide sits at the lower edge ---- */
	.menu-wrap {
		position: relative;
		display: inline-flex;
	}
	.menu {
		position: absolute;
		right: 0;
		bottom: calc(100% + 8px);
		z-index: 5;
		display: flex;
		flex-direction: column;
		min-width: 200px;
		max-width: 320px;
		max-height: min(16rem, 50vh);
		overflow-y: auto;
		padding: 4px;
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 10px;
		background: var(--shell-popup-dark, rgba(17, 41, 31, 0.97));
		box-shadow: 0 10px 28px rgb(0 0 0 / 0.32);
	}
	.menu-item {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 8px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.menu-item:hover,
	.menu-item:focus-visible {
		background: rgb(255 255 255 / 0.1);
	}
	.menu-label {
		font: 13px var(--shell-serif, Georgia, serif);
	}
	.menu-hint {
		color: var(--shell-ink-quiet, #9fb2a5);
		font: italic 11px var(--shell-sans, system-ui, sans-serif);
	}

	/* ---- Empty Guide ---- */
	.empty {
		display: grid;
		justify-items: center;
		gap: 6px;
		margin: 10px 12px 12px;
		padding: 14px 12px;
		border: 1.5px dashed rgb(255 255 255 / 0.3);
		border-radius: 10px;
		color: #c9d6cc;
		text-align: center;
	}
	.empty.over {
		border-color: var(--shell-ink-light, #eef1ec);
		background: rgb(255 255 255 / 0.06);
	}
	.empty p {
		margin: 0;
		font-size: 12.5px;
	}
	.empty b {
		color: #fff;
		font-weight: 600;
	}
	.empty .empty-note {
		color: var(--shell-ink-quiet, #9fb2a5);
		font-size: 11.5px;
	}

	/* ---- Stop cards and connectors ---- */
	.cards {
		overflow-x: auto;
		padding: 8px 0 2px;
		scrollbar-width: thin;
		scrollbar-color: rgb(255 255 255 / 0.22) transparent;
	}
	.cards::-webkit-scrollbar { height: 6px; }
	.cards::-webkit-scrollbar-track { background: transparent; }
	.cards::-webkit-scrollbar-thumb {
		border-radius: 6px;
		background: rgb(255 255 255 / 0.22);
	}
	.cards::-webkit-scrollbar-thumb:hover { background: rgb(255 255 255 / 0.38); }
	.row {
		position: relative;
		display: flex;
		align-items: stretch;
		width: max-content;
		min-width: 100%;
		padding: 0 12px;
	}
	.stop-card {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 118px;
		padding: 5px;
		border: 2px solid transparent;
		border-radius: 8px;
		background: var(--shell-index, #f6f7f5);
		color: var(--shell-ink, #1b201c);
		font: inherit;
		text-align: left;
		cursor: pointer;
		user-select: none;
	}
	.stop-card.selected {
		border-color: var(--shell-gold, #d4ad45);
		background: var(--shell-card, #fff);
	}
	.stop-card.dragging {
		position: relative;
		z-index: 2;
		cursor: grabbing;
		opacity: 0.92;
		box-shadow: 0 8px 20px rgb(0 0 0 / 0.35);
	}
	.stop-name {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font: 12.5px/1.15 var(--shell-serif, Georgia, serif);
	}
	.stop-meta {
		min-height: 1.3em;
		color: var(--shell-ink-3, #79817b);
		font-size: 10.5px;
	}
	.stop-meta em {
		font-style: italic;
	}
	.slot {
		position: relative;
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
	}
	/* Adjacency is drawn only for a connector whose destination is the neighbour (D11). */
	.slot.adjacent::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		border-top: 1px solid rgb(255 255 255 / 0.28);
	}
	.chip {
		position: relative;
		padding: 2px 6px;
		border: 1px solid transparent;
		border-radius: 10px;
		background: color-mix(in srgb, #fff 8%, var(--shell-forest, #11291f));
		color: var(--shell-ink-light, #eef1ec);
		font: 11px var(--shell-mono, ui-monospace, monospace);
		white-space: nowrap;
		cursor: pointer;
	}
	.chip.cut {
		border: 1px dashed rgb(255 255 255 / 0.35);
	}
	.chip.travel {
		background: color-mix(in srgb, var(--shell-leaf, #4f8f6c) 40%, var(--shell-forest, #11291f));
	}
	.chip.jump,
	.chip.end {
		border: 1px solid rgb(255 255 255 / 0.22);
	}
	.chip.gap {
		border: 1px dashed var(--shell-caution, #c85a48);
		background: color-mix(in srgb, var(--shell-caution, #c85a48) 28%, var(--shell-forest, #11291f));
		color: color-mix(in srgb, var(--shell-caution, #c85a48) 35%, #fff);
	}
	.chip.selected {
		box-shadow: 0 0 0 2px var(--shell-gold, #d4ad45);
	}
	.caret {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 3px;
		margin-left: -1.5px;
		border-radius: 2px;
		background: var(--shell-gold, #d4ad45);
		pointer-events: none;
	}

	/* ---- Stop-order bar ---- */
	.scrub {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 2px 12px 8px;
	}
	.play {
		display: grid;
		place-items: center;
		flex: none;
		width: 24px;
		height: 22px;
		padding: 0;
		border: 0;
		border-radius: 7px;
		background: var(--shell-gold, #d4ad45);
		color: #2a2208;
	}
	.bar {
		position: relative;
		display: flex;
		flex: 1;
		gap: 2px;
		height: 10px;
		min-width: 0;
	}
	.seg {
		flex: 1 1 0;
		display: flex;
		align-items: center;
		justify-content: center;
		container-type: inline-size;
		min-width: 0;
		overflow: hidden;
		border-radius: 3px;
		background: rgb(79 143 108 / 0.55);
	}
	.seg.selected {
		background: var(--shell-gold, #d4ad45);
	}
	/* The hold is written on its segment only while the segment is wide enough for it. */
	.seg-hold {
		display: none;
		font: 600 8px/1 var(--shell-mono, ui-monospace, monospace);
		color: #e3eee7;
		white-space: nowrap;
		pointer-events: none;
	}
	@container (min-width: 24px) {
		.seg-hold {
			display: block;
		}
	}
	.seg.selected .seg-hold {
		color: #2a2208;
	}
	.bracket {
		position: absolute;
		top: -3px;
		bottom: -3px;
		border: 1.5px solid rgb(255 255 255 / 0.7);
		border-radius: 5px;
		pointer-events: none;
	}
	.bar-caret {
		position: absolute;
		top: -4px;
		bottom: -4px;
		width: 3px;
		margin-left: -1.5px;
		border-radius: 2px;
		background: var(--shell-gold, #d4ad45);
		pointer-events: none;
	}

	.visually-hidden {
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

	/* Below 620 px the header goes icon-only (harvest §2.2). */
	@media (max-width: 620px) {
		.tool .word,
		.kicker {
			display: none;
		}
	}
	@media (pointer: coarse) {
		.tool,
		.icon,
		.play,
		.name-input,
		.chip {
			min-height: var(--shell-touch-target, 44px);
		}
		.icon,
		.play {
			min-width: var(--shell-touch-target, 44px);
		}
	}
</style>
