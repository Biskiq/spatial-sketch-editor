import { describe, expect, it } from 'vitest';
import {
	HIERARCHY_DEFAULT_OPENING_FILTER,
	HIERARCHY_DEFAULT_WALL_FILTER,
	HierarchyNavigatorStore,
	defaultHierarchyHistoryEntry,
	hierarchyDisclosureOpen,
	type HierarchyTransitionKind
} from '$lib/editor/app/hierarchy-navigator-state.svelte';
import type { HierarchyRevealTarget } from '$lib/editor/hierarchy/hierarchy-page-projection';
import { wallEntityKey } from '$lib/editor/hierarchy/hierarchy-source-index';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_DIR = fileURLToPath(new URL('../../../../src/lib', import.meta.url));

function readLibSource(relativePath: string): string {
	return fs.readFileSync(path.join(LIB_DIR, relativePath), 'utf8');
}

const wallReveal: HierarchyRevealTarget = {
	entity: wallEntityKey('w2'),
	rowKey: 'walls:wall:w2',
	ancestorDisclosureKeys: []
};

function openingReveal(): HierarchyRevealTarget {
	return {
		entity: { id: 'layout:opening:w2:op-win-2', owner: 'layout', kind: 'opening', wallId: 'w2', openingId: 'op-win-2' },
		rowKey: 'walls:wall:w2:opening:op-win-2',
		ancestorDisclosureKeys: ['walls:wall:w2']
	};
}

function intentKind(store: HierarchyNavigatorStore): HierarchyTransitionKind {
	return store.transition.kind;
}

describe('P23.6e slice 3 — Navigator entry and back semantics', () => {
	it('starts at the root entry with an empty stack and calm defaults', () => {
		const store = new HierarchyNavigatorStore();
		expect(store.current).toEqual(defaultHierarchyHistoryEntry());
		expect(store.current).toEqual({
			page: { kind: 'root' },
			query: '',
			wallFilter: HIERARCHY_DEFAULT_WALL_FILTER,
			openingFilter: HIERARCHY_DEFAULT_OPENING_FILTER,
			disclosure: [],
			scrollTop: 0
		});
		expect(store.canGoBack).toBe(false);
		expect(store.emphasis).toBeNull();
		expect(store.transition.revision).toBe(0);
	});

	it('open() pushes the prior snapshot, installs defaults and emits ordinary-entry', () => {
		const store = new HierarchyNavigatorStore();
		store.setQuery('gallery');
		store.setScrollTop(240);
		store.setWallFilter('with-openings');
		store.toggleDisclosure('root:heading:architecture');

		store.open({ kind: 'walls' });

		expect(store.current).toEqual({
			page: { kind: 'walls' },
			query: '',
			wallFilter: 'all',
			openingFilter: 'all',
			disclosure: [],
			scrollTop: 0
		});
		expect(store.canGoBack).toBe(true);
		// Ordinary entry carries no reveal target: a pre-existing represented
		// selection highlights immediately but is never auto-scrolled.
		expect(store.transition).toEqual({
			revision: 1,
			kind: 'ordinary-entry',
			page: { kind: 'walls' },
			target: null
		});
	});

	it('showIn() installs the named home with the required disclosure and a targeted intent', () => {
		const store = new HierarchyNavigatorStore();
		store.setQuery('anything');
		store.setOpeningFilter('window');

		const reveal = openingReveal();
		store.showIn({ page: { kind: 'walls' }, reveal });

		expect(store.current).toEqual({
			page: { kind: 'walls' },
			query: '',
			wallFilter: 'all',
			openingFilter: 'all',
			disclosure: ['walls:wall:w2'],
			scrollTop: 0
		});
		expect(store.transition).toEqual({
			revision: 1,
			kind: 'show-in',
			page: { kind: 'walls' },
			target: reveal
		});
	});

	it('showIn() without a reveal target degrades to an ordinary entry', () => {
		const store = new HierarchyNavigatorStore();
		store.showIn({ page: { kind: 'room', roomId: 'room-a' }, reveal: null });
		expect(store.current.page).toEqual({ kind: 'room', roomId: 'room-a' });
		expect(store.current.disclosure).toEqual([]);
		expect(intentKind(store)).toBe('ordinary-entry');
		expect(store.transition.target).toBeNull();
	});

	it('back() restores the exact five fields and emits history-restore', () => {
		const store = new HierarchyNavigatorStore();
		store.open({ kind: 'room', roomId: 'room-a' });
		store.setQuery('door');
		store.setWallFilter('one-room');
		store.setOpeningFilter('door');
		store.toggleDisclosure('room:room-a:section:junctions');
		store.setScrollTop(512);
		const snapshot = { ...store.current, page: { ...store.current.page }, disclosure: [...store.current.disclosure] };

		// Navigate away, then come back.
		store.open({ kind: 'junctions' });
		expect(store.back()).toBe(true);

		expect(store.current).toEqual(snapshot);
		expect(intentKind(store)).toBe('history-restore');
		expect(store.transition.target).toBeNull();
		// The initial root entry is still behind it.
		expect(store.canGoBack).toBe(true);
	});

	it('back() on an empty stack is a no-op with no revision churn', () => {
		const store = new HierarchyNavigatorStore();
		const transition = store.transition;
		expect(store.back()).toBe(false);
		expect(store.current).toEqual(defaultHierarchyHistoryEntry());
		expect(store.transition).toBe(transition);
	});

	it('back() prunes invalid back entries on use instead of mutating documents', () => {
		const store = new HierarchyNavigatorStore();
		store.open({ kind: 'room', roomId: 'room-a' });
		store.open({ kind: 'room', roomId: 'room-gone' });
		// Stack is [root, room-a]; both Room entries are now invalid.
		const isPageValid = (page: { kind: string }) => page.kind !== 'room';
		expect(store.back({ isPageValid: isPageValid as never })).toBe(true);
		expect(store.current.page).toEqual({ kind: 'root' });
		expect(store.backStack).toEqual([]);
		expect(store.back()).toBe(false);
	});

	it('navigates back through several entries in order', () => {
		const store = new HierarchyNavigatorStore();
		store.open({ kind: 'rooms' });
		store.open({ kind: 'room', roomId: 'room-a' });
		store.open({ kind: 'walls' });
		expect(store.back()).toBe(true);
		expect(store.current.page).toEqual({ kind: 'room', roomId: 'room-a' });
		expect(store.back()).toBe(true);
		expect(store.current.page).toEqual({ kind: 'rooms' });
		expect(store.back()).toBe(true);
		expect(store.current.page).toEqual({ kind: 'root' });
		expect(store.canGoBack).toBe(false);
	});
});

describe('P23.6e slice 3 — transient in-place state', () => {
	it('query/filter/disclosure/scroll update the current entry without pushing history', () => {
		const store = new HierarchyNavigatorStore();
		store.open({ kind: 'walls' });
		const stackLength = store.backStack.length;
		const transition = store.transition;

		store.setQuery('w2');
		store.setWallFilter('multiple-rooms');
		store.setOpeningFilter('window');
		store.toggleDisclosure('walls:wall:w2');
		store.setScrollTop(120);

		expect(store.current).toEqual({
			page: { kind: 'walls' },
			query: 'w2',
			wallFilter: 'multiple-rooms',
			openingFilter: 'window',
			disclosure: ['walls:wall:w2'],
			scrollTop: 120
		});
		// No page transition, no history: the intent object is untouched, so the
		// renderer never mistakes a query change for a navigation cycle.
		expect(store.backStack).toHaveLength(stackLength);
		expect(store.transition).toBe(transition);
	});

	it('toggleDisclosure opens then closes the same key in place', () => {
		const store = new HierarchyNavigatorStore();
		store.toggleDisclosure('walls:wall:w2');
		expect(store.current.disclosure).toEqual(['walls:wall:w2']);
		store.toggleDisclosure('walls:wall:w2');
		expect(store.current.disclosure).toEqual([]);
	});

	it('counts user disclosure gestures only, so auto-reveal cannot re-trigger itself', () => {
		const store = new HierarchyNavigatorStore();
		expect(store.disclosureRevision).toBe(0);
		store.toggleDisclosure('room:room-a:section:junctions');
		expect(store.disclosureRevision).toBe(1);
		store.toggleDisclosure('room:room-a:section:junctions');
		expect(store.disclosureRevision).toBe(2);
		// Auto-disclosure, bulk writes, navigation and transient fields are not
		// user gestures: the reveal cycle must not scroll again for them.
		store.revealDisclosure(['room:room-a:section:objects']);
		store.setDisclosure(['room:room-a:section:boundary']);
		store.open({ kind: 'walls' });
		store.back();
		store.setQuery('wall');
		store.setScrollTop(10);
		store.reset();
		expect(store.disclosureRevision).toBe(2);
	});

	it('revealDisclosure unions required ancestors in place and reports real changes', () => {
		const store = new HierarchyNavigatorStore();
		store.open({ kind: 'walls' });
		const transition = store.transition;
		expect(store.revealDisclosure(['walls:wall:w2'])).toBe(true);
		expect(store.current.disclosure).toEqual(['walls:wall:w2']);
		// Already satisfied: no write, no history, no intent.
		expect(store.revealDisclosure(['walls:wall:w2'])).toBe(false);
		expect(store.revealDisclosure(['walls:wall:w2', 'walls:wall:w3'])).toBe(true);
		expect(store.current.disclosure).toEqual(['walls:wall:w2', 'walls:wall:w3']);
		expect(store.transition).toBe(transition);
		// Auto-disclosure never pushes history.
		expect(store.canGoBack).toBe(true);
		expect(store.backStack).toHaveLength(1);
	});

	it('setScrollTop is idempotent and keeps the entry identity stable', () => {
		const store = new HierarchyNavigatorStore();
		store.setScrollTop(0);
		const entry = store.current;
		expect(store.current).toBe(entry);
		store.setScrollTop(48);
		expect(store.current.scrollTop).toBe(48);
	});

	it('scroll/query changes never move the page or the stack (selection-agnostic)', () => {
		const store = new HierarchyNavigatorStore();
		store.open({ kind: 'room', roomId: 'room-a' });
		const page = JSON.stringify(store.current.page);
		const stack = JSON.stringify(store.backStack);
		store.setQuery('x');
		store.setScrollTop(999);
		store.revealDisclosure(['room:room-a:wall:w2']);
		expect(JSON.stringify(store.current.page)).toBe(page);
		expect(JSON.stringify(store.backStack)).toBe(stack);
	});

	it('pins the one-cycle reveal inputs: ordinary entry and history restore carry no target', () => {
		const store = new HierarchyNavigatorStore();
		store.open({ kind: 'walls' });
		// Ordinary entry ⇒ the renderer highlights a represented selection but
		// schedules no auto-disclosure/scroll.
		expect(store.transition.kind).toBe('ordinary-entry');
		expect(store.transition.target).toBeNull();

		store.showIn({ page: { kind: 'walls' }, reveal: wallReveal });
		expect(store.transition.kind).toBe('show-in');
		expect(store.transition.target).toEqual(wallReveal);

		// History restore ⇒ the renderer suppresses selection-driven reveal for
		// exactly this restoration cycle and the restored scrollTop wins.
		store.setScrollTop(300);
		store.open({ kind: 'junctions' });
		expect(store.back()).toBe(true);
		expect(store.transition.kind).toBe('history-restore');
		expect(store.transition.target).toBeNull();
		expect(store.current.scrollTop).toBe(300);
	});
});

describe('P23.6e slice 3 — reconciliation, emphasis and reset', () => {
	it('reconcile() falls back from a missing Room to the Rooms page without touching selection or history', () => {
		const store = new HierarchyNavigatorStore();
		store.open({ kind: 'room', roomId: 'room-gone' });
		store.setQuery('gallery');
		store.setScrollTop(88);
		const stack = JSON.stringify(store.backStack);

		expect(store.reconcile({ isPageValid: (page) => page.kind !== 'room' })).toBe(true);
		expect(store.current.page).toEqual({ kind: 'rooms' });
		// Search/filters/scroll survive; page-specific disclosure is dropped.
		expect(store.current.query).toBe('gallery');
		expect(store.current.scrollTop).toBe(88);
		expect(store.current.disclosure).toEqual([]);
		expect(store.transition.kind).toBe('ordinary-entry');
		expect(JSON.stringify(store.backStack)).toBe(stack);
	});

	it('reconcile() is a no-op while the page still validates (no revision churn)', () => {
		const store = new HierarchyNavigatorStore();
		store.open({ kind: 'room', roomId: 'room-a' });
		const transition = store.transition;
		expect(store.reconcile({ isPageValid: (page) => page.kind === 'room' })).toBe(false);
		expect(store.current.page).toEqual({ kind: 'room', roomId: 'room-a' });
		expect(store.transition).toBe(transition);
	});

	it('emphasis is transient, owner-scoped and cleared by page navigation', () => {
		const store = new HierarchyNavigatorStore();
		const wall = wallEntityKey('w2');
		store.setEmphasis(wall);
		expect(store.emphasis).toEqual(wall);
		// A different row leaving does not steal the emphasis.
		store.clearEmphasis(wallEntityKey('w3'));
		expect(store.emphasis).toEqual(wall);
		store.clearEmphasis(wall);
		expect(store.emphasis).toBeNull();

		store.setEmphasis(wall);
		store.open({ kind: 'walls' });
		expect(store.emphasis).toBeNull();
		store.setEmphasis(wall);
		store.showIn({ page: { kind: 'walls' }, reveal: wallReveal });
		expect(store.emphasis).toBeNull();
	});

	it('reset() returns to the root entry with an empty stack', () => {
		const store = new HierarchyNavigatorStore();
		store.open({ kind: 'walls' });
		store.setEmphasis(wallEntityKey('w2'));
		store.setQuery('x');
		store.reset();
		expect(store.current).toEqual(defaultHierarchyHistoryEntry());
		expect(store.backStack).toEqual([]);
		expect(store.emphasis).toBeNull();
		expect(store.transition.kind).toBe('ordinary-entry');
	});

	it('disclosure helper: defaultOpen rows are open regardless; others need their key', () => {
		const entry = { disclosure: ['walls:wall:w2'] };
		expect(hierarchyDisclosureOpen(entry, { disclosureKey: 'walls:wall:w2' })).toBe(true);
		expect(hierarchyDisclosureOpen(entry, { disclosureKey: 'walls:wall:w3' })).toBe(false);
		expect(hierarchyDisclosureOpen(entry, {})).toBe(true);
		expect(
			hierarchyDisclosureOpen(entry, { disclosureKey: 'room:room-a:section:boundary', defaultOpen: true })
		).toBe(true);
	});
});

describe('P23.6e slice 3 — authority isolation', () => {
	it('never touches a document snapshot or editor-history callback', () => {
		// The store receives neither: this test exercises the whole API with
		// watched stand-ins and proves nothing outside the Navigator changed.
		const documentSnapshot = { layout: { walls: [{ id: 'w2' }] }, scene: { entities: [] } };
		const history: { capture: () => number; push: (entry: unknown) => void } = {
			capture: () => 0,
			push: () => {}
		};
		const before = JSON.stringify(documentSnapshot);
		let captures = 0;
		let pushes = 0;
		history.capture = () => {
			captures += 1;
			return 0;
		};
		history.push = () => {
			pushes += 1;
		};

		const store = new HierarchyNavigatorStore();
		store.open({ kind: 'rooms' });
		store.open({ kind: 'room', roomId: 'room-a' });
		store.setQuery('gallery');
		store.setWallFilter('multiple-rooms');
		store.setOpeningFilter('door');
		store.toggleDisclosure('room:room-a:wall:w2');
		store.revealDisclosure(['room:room-a:section:junctions']);
		store.setScrollTop(42);
		store.setEmphasis(wallEntityKey('w2'));
		store.showIn({ page: { kind: 'walls' }, reveal: wallReveal });
		store.back();
		store.reconcile({ isPageValid: () => true });
		store.reset();

		expect(JSON.stringify(documentSnapshot)).toBe(before);
		expect(captures).toBe(0);
		expect(pushes).toBe(0);
	});

	it('is UI-only state: no document, mutation, history, camera or Svelte-effect machinery', () => {
		const source = readLibSource('editor/app/hierarchy-navigator-state.svelte.ts');
		for (const forbidden of [
			'editor-store',
			'history-controller',
			'layout-mutation-runner',
			'layout-preview-state',
			'project-persistence',
			'CameraFlowPanel',
			'$effect'
		]) {
			expect(source, `navigator store must not reference ${forbidden}`).not.toContain(forbidden);
		}
		expect(source).toContain('$state');
	});
});
