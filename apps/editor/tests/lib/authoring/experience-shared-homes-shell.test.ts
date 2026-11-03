// @vitest-environment jsdom
/**
 * R217.S25 — the shared Index and Card carry the Experience lens's groups.
 *
 * The Index shows the Experience crumb with its sibling menu (New Experience), the Guides
 * group (one row per Guide, one active), and the Presentations with their Views. The search
 * appears from 8 Presentations or while a filter is typed. The Card takes an Experience
 * subject with no `•••` functions and no Bring into view, and a World subject keeps both.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import EditorIndex from '$lib/authoring/stage/shell/EditorIndex.svelte';
import EditorCard from '$lib/authoring/stage/shell/EditorCard.svelte';
import { createWorldIndexModel } from '$lib/authoring/stage/shell/world-index-model';
import type { ExperienceIndexGroups } from '$lib/authoring/stage/shell/experience-index-groups';

type Guide = ExperienceIndexGroups['guides'][number];
type Presentation = ExperienceIndexGroups['presentations'][number];
type View = Presentation['views'][number];

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	document.body.replaceChildren();
});

function view(id: string, label: string, overrides: Partial<View> = {}): View {
	return { id, label, onTour: false, isDefault: false, selected: false, ...overrides };
}

function presentation(id: string, label: string, overrides: Partial<Presentation> = {}): Presentation {
	const views = overrides.views ?? [view(`${id}-front`, 'Front')];
	return { id, label, viewCount: views.length, stopNumbers: [], selected: false, expanded: false, ...overrides, views };
}

function guide(id: string, label: string, overrides: Partial<Guide> = {}): Guide {
	return { id, label, stopCount: 1, open: false, selected: false, opening: false, ...overrides };
}

function groups(overrides: Partial<ExperienceIndexGroups> = {}): ExperienceIndexGroups {
	return {
		pending: false,
		experiences: [{ id: 'experience-1', label: 'Experience 1' }],
		current: { id: 'experience-1', label: 'Experience 1' },
		guides: [guide('guide-1', 'Tour', { stopCount: 2 })],
		presentations: [
			presentation('presentation-1', 'Entry hall'),
			presentation('presentation-2', 'Garden', { selected: true, stopNumbers: [2, 5] })
		],
		totalPresentations: 2,
		query: '',
		busy: false,
		onQuery: vi.fn(),
		onOpenExperience: vi.fn(),
		onCreateExperience: vi.fn(),
		onRenameExperience: vi.fn(async () => ({ kind: 'accepted' as const })),
		onOpenGuide: vi.fn(),
		onSelectPresentation: vi.fn(),
		onToggleExpand: vi.fn(),
		onSelectView: vi.fn(),
		...overrides
	};
}

function mountIndex(experience: ExperienceIndexGroups | null) {
	const target = document.createElement('div');
	document.body.append(target);
	const model = createWorldIndexModel()(null, [], 'Project');
	const component = mount(EditorIndex, {
		target,
		props: {
			open: true,
			model,
			scope: 'project',
			onScope: () => {},
			onClose: () => {},
			selectionId: null,
			query: '',
			onQuery: () => {},
			onSelect: () => {},
			onBringIntoView: () => {},
			onReveal: () => {},
			onRename: () => {},
			experience
		}
	});
	cleanup = () => void unmount(component);
	flushSync();
	return target;
}

function unmountIndex() {
	cleanup?.();
	cleanup = undefined;
	document.body.replaceChildren();
}

function buttonWithText(root: ParentNode, text: string): HTMLButtonElement | undefined {
	return [...root.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === text);
}

describe('R217.S25 — the Index groups in the Experience lens', () => {
	it('replaces the World locator with the Presentations group, in the same crumb and row grammar', () => {
		const target = mountIndex(groups());
		expect(target.querySelector('input[aria-label="Filter places and things"]')).toBeNull();
		expect(target.querySelector('.facets')).toBeNull();
		expect(target.querySelector('[aria-current="location"]')?.textContent).toBe('Experience 1');
		expect(target.querySelector('#index-presentations')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Presentations 2');
		expect(target.querySelector('#index-guides')?.textContent).toContain('Guides');
	});

	it('lists each Presentation as a row with its Views and Stop positions, marks the focused one current, and reports a row press', () => {
		const onSelectPresentation = vi.fn();
		const target = mountIndex(groups({ onSelectPresentation }));
		const rows = [...target.querySelectorAll<HTMLElement>('[data-presentation-id]')];
		expect(rows.map((row) => row.dataset.presentationId)).toEqual(['presentation-1', 'presentation-2']);
		expect(rows[1]!.querySelector('[aria-current="true"]')).not.toBeNull();
		expect(rows[0]!.querySelector('.item-meta')?.textContent).toContain('free');
		expect(rows[1]!.querySelector('.item-meta')?.textContent).toContain('Stops 2, 5');
		target.querySelector<HTMLButtonElement>('button[aria-label="Presentation Entry hall"]')!.click();
		expect(onSelectPresentation).toHaveBeenCalledWith('presentation-1');
	});

	it('makes each Presentation row a drag source: the drop carries its id as application/x-biskiq-presentation', () => {
		const target = mountIndex(groups());
		const row = target.querySelector<HTMLElement>('button[aria-label="Presentation Entry hall"]')!;
		expect(row.getAttribute('draggable')).toBe('true');
		const setData = vi.fn();
		const dataTransfer = { setData, effectAllowed: 'none' };
		const event = new Event('dragstart', { bubbles: true, cancelable: true });
		Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
		row.dispatchEvent(event);
		expect(setData).toHaveBeenCalledWith('application/x-biskiq-presentation', 'presentation-1');
		expect(dataTransfer.effectAllowed).toBe('copy');
	});

	it('offers New Experience in the crumb menu when the source has no Experience, and no Guide group', () => {
		const onCreateExperience = vi.fn();
		const target = mountIndex(groups({ experiences: [], current: null, presentations: [], guides: [], onCreateExperience }));
		expect(target.textContent).toContain('No Experience yet');
		expect(target.textContent).toContain('Create an Experience from the menu above to start presenting.');
		const menu = target.querySelector('.crumbs details.siblings')!;
		const create = buttonWithText(menu, 'New Experience');
		expect(create).toBeDefined();
		create!.click();
		expect(onCreateExperience).toHaveBeenCalledOnce();
		expect(target.querySelector('#index-guides')).toBeNull();
	});

	it('keeps New Experience reachable with a populated Index and retains Experience switching', () => {
		const onCreateExperience = vi.fn();
		const onOpenExperience = vi.fn();
		const target = mountIndex(
			groups({
				experiences: [
					{ id: 'experience-1', label: 'Experience 1' },
					{ id: 'experience-2', label: 'Experience 2' }
				],
				onCreateExperience,
				onOpenExperience
			})
		);
		const menu = target.querySelector('.crumbs details.siblings')!;
		expect(menu.querySelector('summary')?.getAttribute('aria-label')).toBe('Switch or create Experience');
		const create = buttonWithText(menu, 'New Experience');
		expect(create).toBeDefined();
		create!.click();
		expect(onCreateExperience).toHaveBeenCalledOnce();

		const sibling = buttonWithText(menu, 'Experience 2');
		expect(sibling).toBeDefined();
		sibling!.click();
		expect(onOpenExperience).toHaveBeenCalledWith('experience-2');
	});

	it('says no Presentation exists yet, and distinguishes a filter that matches nothing', () => {
		const empty = mountIndex(groups({ presentations: [], totalPresentations: 0 }));
		expect(empty.textContent).toContain('Nothing presented yet. Select an object and choose Present this, or press Capture in the dock.');
		unmountIndex();
		const filtered = mountIndex(groups({ presentations: [], query: 'zzz', totalPresentations: 2 }));
		expect(filtered.textContent).toContain('Nothing matches "zzz".');
	});

	it('always shows the Presentation search in the Index head, beside Hide Index', () => {
		const few = mountIndex(groups({ totalPresentations: 1 }));
		expect(few.querySelector('.index-search input[aria-label="Find a Presentation or View"]')).not.toBeNull();
		expect(few.querySelector('.index-search [aria-label="Hide Index"]')).not.toBeNull();
		unmountIndex();

		const many = mountIndex(groups({ totalPresentations: 8 }));
		expect(many.querySelector('input[aria-label="Find a Presentation or View"]')).not.toBeNull();
		unmountIndex();

		const typed = mountIndex(groups({ totalPresentations: 2, query: 'Gar' }));
		expect(typed.querySelector('input[aria-label="Find a Presentation or View"]')).not.toBeNull();
	});

	it('forwards the filter to the controller once the search is shown', () => {
		const onQuery = vi.fn();
		const target = mountIndex(groups({ totalPresentations: 8, onQuery }));
		const filter = target.querySelector<HTMLInputElement>('input[aria-label="Find a Presentation or View"]')!;
		filter.value = 'Garden';
		filter.dispatchEvent(new Event('input', { bubbles: true }));
		expect(onQuery).toHaveBeenLastCalledWith('Garden');
	});

	it('lists one row per Guide, marks the open one with an Open chip and not the gold selected role, and opens a Guide by its row', () => {
		const onOpenGuide = vi.fn();
		const target = mountIndex(
			groups({
				guides: [guide('guide-1', 'Tour', { stopCount: 3, open: true }), guide('guide-2', 'Evening', { stopCount: 1 })],
				onOpenGuide
			})
		);
		const open = target.querySelector<HTMLElement>('[data-guide-id="guide-1"]')!;
		expect(open.querySelector('.chip')?.textContent).toBe('Open');
		expect(open.classList.contains('selected')).toBe(false);
		expect(open.querySelector('.guide-row')?.getAttribute('aria-current')).toBeNull();
		expect(open.querySelector('.item-meta')?.textContent).toBe('3 stops');

		const other = target.querySelector<HTMLElement>('[data-guide-id="guide-2"]')!;
		expect(other.querySelector('.chip')).toBeNull();
		other.querySelector<HTMLButtonElement>('.guide-row')!.click();
		expect(onOpenGuide).toHaveBeenCalledWith('guide-2');
	});

	it('gives the "No Guide yet" row to open the empty Guide', () => {
		const onOpenGuide = vi.fn();
		const target = mountIndex(groups({ guides: [], onOpenGuide }));
		const row = [...target.querySelectorAll<HTMLButtonElement>('section[aria-labelledby="index-guides"] .guide-row')].find((button) =>
			button.textContent?.includes('No Guide yet')
		);
		expect(row).toBeDefined();
		row!.click();
		expect(onOpenGuide).toHaveBeenCalledWith(null);
	});

	it('shows the first 8 Views of an expanded Presentation and folds the rest into +N more', () => {
		const onSelectPresentation = vi.fn();
		const views = Array.from({ length: 10 }, (_, index) => view(`view-${index + 1}`, `View ${index + 1}`));
		const target = mountIndex(
			groups({
				presentations: [presentation('presentation-2', 'Garden', { selected: true, expanded: true, views })],
				totalPresentations: 1,
				onSelectPresentation
			})
		);
		expect(target.querySelectorAll('.view-row')).toHaveLength(8);
		const more = target.querySelector<HTMLButtonElement>('.view-more');
		expect(more?.textContent).toContain('+2 more');
		more!.click();
		expect(onSelectPresentation).toHaveBeenCalledWith('presentation-2');
	});

	it('selects a View row with its Presentation', () => {
		const onSelectView = vi.fn();
		const views = [view('view-1', 'Front', { onTour: true, isDefault: true }), view('view-2', 'Back')];
		const target = mountIndex(
			groups({
				presentations: [presentation('presentation-2', 'Garden', { expanded: true, views })],
				totalPresentations: 1,
				onSelectView
			})
		);
		const rows = [...target.querySelectorAll<HTMLButtonElement>('.view-row')];
		expect(rows[0]!.getAttribute('aria-label')).toBe('Front, on tour, Default View');
		expect(rows[1]!.getAttribute('aria-label')).toBe('Back, free');
		rows[1]!.click();
		expect(onSelectView).toHaveBeenCalledWith('view-2', 'presentation-2');
	});

	it('renders no picker: the Experience is switched in the locator, never by a select', () => {
		const target = mountIndex(groups());
		expect(target.querySelectorAll('select')).toHaveLength(0);
	});
});

describe('R217.S25 — the Card takes an Experience subject', () => {
	function mountCard(options: { functions?: readonly string[] | null; onBringIntoView?: (() => void) | null; kind?: string }) {
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(EditorCard, {
			target,
			props: {
				identity: {
					sourceId: 'experience:presentation:presentation-1',
					label: 'Entry hall',
					kind: options.kind ?? 'Presentation',
					status: 'Default View set'
				},
				facts: [{ label: 'Views', value: '2' }],
				writer: null,
				actions: [],
				nameWriter: null,
				onClose: () => {},
				functions: options.functions ?? null,
				onBringIntoView: options.onBringIntoView ?? null
			}
		});
		cleanup = () => void unmount(component);
		flushSync();
		return target;
	}

	it('shows neither the `•••` menu nor Bring into view for a Presentation that has no functions', () => {
		const target = mountCard({ functions: [] });
		expect(target.querySelector('[aria-label="Subject actions"]')).toBeNull();
		expect(target.querySelector('[aria-label="Bring into view"]')).toBeNull();
		expect(target.querySelector('h2.name')?.textContent).toContain('Entry hall');
		expect(target.querySelector('.kind')?.textContent).toBe('Presentation');
	});

	it('keeps the World subject: its object functions and Bring into view stay as they were', () => {
		const onBringIntoView = vi.fn();
		const target = mountCard({ functions: null, onBringIntoView, kind: 'Wall' });
		expect(target.querySelector('[aria-label="Subject actions"]')).not.toBeNull();
		const bring = target.querySelector<HTMLButtonElement>('[aria-label="Bring into view"]');
		expect(bring).not.toBeNull();
		bring!.click();
		expect(onBringIntoView).toHaveBeenCalledOnce();
	});
});

describe('R217.S26 — every Guide in the Index, with *opens* on the Opening Guide', () => {
	it('lists each Guide and tags only the Opening Guide', () => {
		const target = mountIndex(
			groups({ guides: [guide('guide-1', 'Salon tour', { opening: true }), guide('guide-2', 'Short tour', { open: true })] })
		);
		const rows = [...target.querySelectorAll('[data-guide-id]')];
		expect(rows.map((row) => row.getAttribute('data-guide-id'))).toEqual(['guide-1', 'guide-2']);
		expect(rows.map((row) => row.querySelector('[data-opening-guide]')?.textContent ?? null)).toEqual(['opens', null]);
		unmountIndex();
	});
});

describe('R217.S26 — Rename… opens the Experience crumb inline', () => {
	function startRename(target: HTMLElement): HTMLInputElement {
		const rename = buttonWithText(target, 'Rename…')!;
		flushSync(() => rename.click());
		return target.querySelector<HTMLInputElement>('input[aria-label="Experience name"]')!;
	}
	function type(input: HTMLInputElement, value: string) {
		flushSync(() => {
			input.value = value;
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});
	}

	it('commits on Enter through onRenameExperience', async () => {
		const onRenameExperience = vi.fn(async () => ({ kind: 'accepted' as const }));
		const target = mountIndex(groups({ onRenameExperience }));
		const input = startRename(target);
		expect(input.value).toBe('Experience 1');
		type(input, 'Salon evening');
		flushSync(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
		await tick();
		await tick();
		flushSync();
		expect(onRenameExperience).toHaveBeenCalledWith('Salon evening');
		expect(target.querySelector('input[aria-label="Experience name"]')).toBeNull();
		unmountIndex();
	});

	it('shows a refusal beside the crumb, and Esc cancels with no rename', async () => {
		const onRenameExperience = vi.fn(async () => ({ kind: 'refused' as const, message: 'A name is needed' }));
		const target = mountIndex(groups({ onRenameExperience }));
		const input = startRename(target);
		type(input, '');
		flushSync(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
		await tick();
		await tick();
		flushSync();
		expect(target.querySelector('.crumb-error')?.textContent).toBe('A name is needed');
		onRenameExperience.mockClear();
		flushSync(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
		expect(target.querySelector('input[aria-label="Experience name"]')).toBeNull();
		expect(onRenameExperience).not.toHaveBeenCalled();
		unmountIndex();
	});
});
