/**
 * `hierarchy-navigator-state.svelte.ts` — P23.6e slice 3 (plan §Navigator state).
 *
 * UI-only state for the relationship-aware Scene Navigator: which page is open,
 * the global search query, the two calm filters, the disclosure and collapsed
 * sets, the scroll offset, a bounded back stack, and a transient row emphasis
 * for the Plan bridge. It is **coordination state, not authority**:
 *
 * - it never selects: row activation goes through the existing canonical
 *   selection writers, and `open`/`showIn`/`back` never touch a selection slot;
 * - it never mutates a document, dirtiness, a mutation transaction or editor
 *   Undo/Redo — it imports no codec, mutation planner, history controller,
 *   editor store or visitor code;
 * - it stores no projected rows and no selected identity: the projection and the
 *   pinned-strip state stay `$derived` from current documents + active selection
 *   in the component, so there is exactly one truth for each.
 *
 * History semantics (plan §Navigator state, §History transition table):
 *
 * | event | page | current entry | back stack | intent |
 * |---|---|---|---|---|
 * | `open` | destination | new defaults | push prior | `ordinary-entry` |
 * | `showIn` | named home | empty query + required disclosure | push prior | `show-in` + target |
 * | `back` | restored | exact popped snapshot | pop | `history-restore` |
 * | query/filter/disclosure/collapse/scroll | unchanged | updated in place | unchanged | (none) |
 *
 * The transition intent is a monotonic, one-render-cycle coordination signal so
 * the renderer can tell a page change from a selection change. It is not part of
 * a history entry and is consumed by the renderer after the destination
 * render/scroll step (it compares `revision`).
 */

import type {
	HierarchyDestination,
	HierarchyHistoryEntry,
	HierarchyPage,
	HierarchyProjectedRow,
	HierarchyRevealTarget,
	HierarchyTransitionKind,
	OpeningFilter,
	WallFilter
} from '../hierarchy/hierarchy-page-projection';
import type { HierarchyEntityKey } from '../hierarchy/hierarchy-source-index';

/** Context key so hierarchy children read the one Navigator instance. */
export const HIERARCHY_NAVIGATOR_KEY = Symbol('hierarchy-navigator');

// The transition vocabulary is owned by the pure reveal model, so the store and
// `evaluateHierarchyReveal` can never drift apart. Re-exported for consumers.
export type { HierarchyTransitionKind };

export type HierarchyTransitionIntent = {
	/** Monotonic across the store's lifetime; the renderer handles each once. */
	revision: number;
	kind: HierarchyTransitionKind;
	page: HierarchyPage;
	/** Exact canonical reveal target — present only for `show-in`. */
	target: HierarchyRevealTarget | null;
};

/** Is a page still addressable? Missing Room parameters fall back, never selected. */
export type HierarchyPageValidity = (page: HierarchyPage) => boolean;

export const HIERARCHY_DEFAULT_WALL_FILTER: WallFilter = 'all';
export const HIERARCHY_DEFAULT_OPENING_FILTER: OpeningFilter = 'all';

/** The calm top/default state of a page entry. */
export function defaultHierarchyHistoryEntry(
	page: HierarchyPage = { kind: 'root' }
): HierarchyHistoryEntry {
	return {
		page,
		query: '',
		wallFilter: HIERARCHY_DEFAULT_WALL_FILTER,
		openingFilter: HIERARCHY_DEFAULT_OPENING_FILTER,
		disclosure: [],
		collapsed: [],
		scrollTop: 0
	};
}

function cloneEntry(entry: HierarchyHistoryEntry): HierarchyHistoryEntry {
	return {
		...entry,
		page: { ...entry.page },
		disclosure: [...entry.disclosure],
		collapsed: [...(entry.collapsed ?? [])]
	};
}

/**
 * Disclosure is UI state, not data: `defaultOpen` is the initial state, while a
 * current-entry collapsed override can close that row. `alwaysOpen` is reserved
 * for sections the plan fixes open (currently Room Boundary).
 */
export function hierarchyDisclosureOpen(
	entry: Pick<HierarchyHistoryEntry, 'disclosure' | 'collapsed'>,
	row: Pick<HierarchyProjectedRow, 'disclosureKey' | 'defaultOpen' | 'alwaysOpen'>
): boolean {
	if (!row.disclosureKey || row.alwaysOpen) return true;
	if (entry.collapsed?.includes(row.disclosureKey)) return false;
	return row.defaultOpen === true || entry.disclosure.includes(row.disclosureKey);
}

export class HierarchyNavigatorStore {
	/** The active UI entry. Never a document/selection/history authority. */
	current = $state<HierarchyHistoryEntry>(defaultHierarchyHistoryEntry());
	/** Prior snapshots, newest last. Bounded by explicit page navigation. */
	backStack = $state<HierarchyHistoryEntry[]>([]);
	/** Transient row emphasis for the Plan hover/focus bridge; never selection. */
	emphasis = $state<HierarchyEntityKey | null>(null);
	/** Last transition intent (coordination state, not a history field). */
	transition = $state<HierarchyTransitionIntent>({
		revision: 0,
		kind: 'ordinary-entry',
		page: { kind: 'root' },
		target: null
	});
	/**
	 * Monotonic count of **user** disclosure gestures. `revealDisclosure` must not
	 * bump it: the reveal effect reads it to tell a deliberate expand (scroll
	 * only) from its own auto-disclosure (which owes no further scroll).
	 */
	disclosureRevision = $state(0);

	#revision = 0;

	get canGoBack(): boolean {
		return this.backStack.length > 0;
	}

	/** Ordinary entry: push the current snapshot, install calm defaults. */
	open(page: HierarchyPage): void {
		this.#pushCurrent();
		this.current = defaultHierarchyHistoryEntry(page);
		this.#emit('ordinary-entry', page, null);
	}

	/**
	 * Explicit `Show in…`: push the current snapshot, install the named home at
	 * its calm defaults with the target's required disclosure chain, and carry
	 * the exact canonical reveal target. This is the one entry that scrolls.
	 */
	showIn(destination: HierarchyDestination): void {
		this.#pushCurrent();
		const target = destination.reveal;
		this.current = {
			...defaultHierarchyHistoryEntry(destination.page),
			disclosure: target ? [...target.ancestorDisclosureKeys] : []
		};
		this.#emit(target ? 'show-in' : 'ordinary-entry', destination.page, target);
	}

	/**
	 * Pop one entry and restore page/query/filters/disclosure/scroll exactly.
	 * Invalid entries (a Room that no longer exists) are pruned on use — never by
	 * mutating documents. Back never selects and pushes nothing.
	 */
	back(options: { isPageValid?: HierarchyPageValidity } = {}): boolean {
		const isPageValid = options.isPageValid ?? (() => true);
		while (this.backStack.length > 0) {
			const entry = this.backStack[this.backStack.length - 1]!;
			this.backStack = this.backStack.slice(0, -1);
			if (!isPageValid(entry.page)) continue;
			this.current = cloneEntry(entry);
			this.#emit('history-restore', this.current.page, null);
			return true;
		}
		return false;
	}

	/** In-place transient updates: they never push history or move the page. */
	setQuery(query: string): void {
		this.current = { ...this.current, query };
	}

	setWallFilter(wallFilter: WallFilter): void {
		this.current = { ...this.current, wallFilter };
	}

	setOpeningFilter(openingFilter: OpeningFilter): void {
		this.current = { ...this.current, openingFilter };
	}

	setDisclosure(disclosure: readonly string[]): void {
		const nextDisclosure = [...disclosure];
		this.current = {
			...this.current,
			disclosure: nextDisclosure,
			collapsed: (this.current.collapsed ?? []).filter((key) => !nextDisclosure.includes(key))
		};
	}

	toggleDisclosure(disclosureKey: string, defaultOpen = false, alwaysOpen = false): void {
		if (alwaysOpen) return;

		const collapsed = this.current.collapsed ?? [];
		if (defaultOpen) {
			const isCollapsed = collapsed.includes(disclosureKey);
			this.current = {
				...this.current,
				disclosure: this.current.disclosure.filter((key) => key !== disclosureKey),
				collapsed: isCollapsed
					? collapsed.filter((key) => key !== disclosureKey)
					: [...collapsed, disclosureKey]
			};
		} else {
			const disclosure = this.current.disclosure.includes(disclosureKey)
				? this.current.disclosure.filter((key) => key !== disclosureKey)
				: [...this.current.disclosure, disclosureKey];
			this.current = {
				...this.current,
				disclosure,
				collapsed: collapsed.filter((key) => key !== disclosureKey)
			};
		}
		// An explicit user gesture: the renderer may scroll to a selection it just
		// rendered, but it must never expand anything on its own here.
		this.disclosureRevision += 1;
	}

	/** Auto-disclosure for a represented selection: open its required ancestors. */
	revealDisclosure(keys: readonly string[]): boolean {
		const missing = keys.filter((key) => !this.current.disclosure.includes(key));
		const collapsed = this.current.collapsed ?? [];
		const uncollapsed = collapsed.filter((key) => !keys.includes(key));
		if (missing.length === 0 && uncollapsed.length === collapsed.length) return false;
		this.current = {
			...this.current,
			disclosure: [...this.current.disclosure, ...missing],
			collapsed: uncollapsed
		};
		return true;
	}

	setScrollTop(scrollTop: number): void {
		if (this.current.scrollTop === scrollTop) return;
		this.current = { ...this.current, scrollTop };
	}

	setEmphasis(entity: HierarchyEntityKey): void {
		if (this.emphasis?.id !== entity.id) this.emphasis = entity;
	}

	/** Clear only when the leaving row still owns the current emphasis. */
	clearEmphasis(entity?: HierarchyEntityKey): void {
		if (entity && this.emphasis !== null && this.emphasis.id !== entity.id) return;
		this.emphasis = null;
	}

	/**
	 * Reproject after import/reset/document replacement: back to the root entry
	 * with an empty stack and no selection involvement.
	 */
	reset(): void {
		this.current = defaultHierarchyHistoryEntry();
		this.backStack = [];
		this.emphasis = null;
		this.#emit('ordinary-entry', { kind: 'root' }, null);
	}

	/**
	 * Reconcile the current page against the documents. A page whose parameter no
	 * longer exists falls back to `rooms` (a missing Room) or `root` — without
	 * selecting anything and without creating document history. Query, filters
	 * and scroll survive; disclosure keys are page-specific and are dropped.
	 */
	reconcile(options: { isPageValid?: HierarchyPageValidity } = {}): boolean {
		const isPageValid = options.isPageValid ?? (() => true);
		if (isPageValid(this.current.page)) return false;
		const fallback: HierarchyPage =
			this.current.page.kind === 'room' ? { kind: 'rooms' } : { kind: 'root' };
		this.current = { ...this.current, page: fallback, disclosure: [], collapsed: [] };
		this.#emit('ordinary-entry', fallback, null);
		return true;
	}

	#pushCurrent(): void {
		this.backStack = [...this.backStack, cloneEntry(this.current)];
	}

	/** Page navigation clears row emphasis; the revision is monotonic. */
	#emit(kind: HierarchyTransitionKind, page: HierarchyPage, target: HierarchyRevealTarget | null): void {
		this.emphasis = null;
		this.#revision += 1;
		this.transition = { revision: this.#revision, kind, page: { ...page }, target };
	}
}
