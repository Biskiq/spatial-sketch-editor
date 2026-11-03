// @vitest-environment jsdom
/**
 * R217.S25 — the shared Index and Card carry the Experience lens's groups.
 *
 * The Index shows the Presentations list, its filter, the empty-state create and the Guide
 * group in the locator's own crumb and row grammar. The Card takes an Experience subject
 * with no `•••` functions and no Bring into view, and a World subject keeps both.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import EditorIndex from '$lib/authoring/stage/shell/EditorIndex.svelte';
import EditorCard from '$lib/authoring/stage/shell/EditorCard.svelte';
import { createWorldIndexModel } from '$lib/authoring/stage/shell/world-index-model';
import type { ExperienceIndexGroups } from '$lib/authoring/stage/shell/experience-index-groups';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	document.body.replaceChildren();
});

function groups(overrides: Partial<ExperienceIndexGroups> = {}): ExperienceIndexGroups {
	return {
		pending: false,
		experiences: [{ id: 'experience-1', label: 'Experience 1' }],
		current: { id: 'experience-1', label: 'Experience 1' },
		presentations: [
			{ id: 'presentation-1', label: 'Entry hall', selected: false },
			{ id: 'presentation-2', label: 'Garden', selected: true }
		],
		query: '',
		busy: false,
		guide: { label: 'Tour', open: false },
		onQuery: vi.fn(),
		onOpenExperience: vi.fn(),
		onSelectPresentation: vi.fn(),
		onCreateExperience: vi.fn(),
		onToggleGuide: vi.fn(),
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

describe('R217.S25 — the Index groups in the Experience lens', () => {
	it('replaces the World locator with the Presentations group, in the same crumb and row grammar', () => {
		const target = mountIndex(groups());
		expect(target.querySelector('input[aria-label="Filter presentations"]')).not.toBeNull();
		expect(target.querySelector('input[aria-label="Filter places and things"]')).toBeNull();
		expect(target.querySelector('.facets')).toBeNull();
		expect(target.querySelector('[aria-current="location"]')?.textContent).toBe('Experience 1');
		expect(target.querySelector('#index-presentations')?.textContent).toBe('Presentations');
	});

	it('lists each Presentation as a row, marks the focused one current, and reports a row press', () => {
		const onSelectPresentation = vi.fn();
		const target = mountIndex(groups({ onSelectPresentation }));
		const rows = [...target.querySelectorAll<HTMLElement>('[data-presentation-id]')];
		expect(rows.map((row) => row.dataset.presentationId)).toEqual(['presentation-1', 'presentation-2']);
		expect(rows[1]!.querySelector('[aria-current="true"]')).not.toBeNull();
		target.querySelector<HTMLButtonElement>('button[aria-label="Presentation Entry hall"]')!.click();
		expect(onSelectPresentation).toHaveBeenCalledWith('presentation-1');
	});

	it('offers the explicit create when the source has no Experience, and no Guide group', () => {
		const onCreateExperience = vi.fn();
		const target = mountIndex(
			groups({ experiences: [], current: null, presentations: [], guide: null, onCreateExperience })
		);
		expect(target.textContent).toContain('This world has no Experience yet');
		const create = [...target.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Create Experience');
		expect(create).toBeDefined();
		create!.click();
		expect(onCreateExperience).toHaveBeenCalledOnce();
		expect(target.querySelector('#index-guide')).toBeNull();
	});

	it('keeps Create Experience reachable with a populated Index and retains Experience switching', () => {
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
		const create = [...target.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent === 'Create Experience'
		);
		expect(create).toBeDefined();
		create!.click();
		expect(onCreateExperience).toHaveBeenCalledOnce();

		target.querySelector<HTMLElement>('[aria-label="Switch Experience"]')!.click();
		const sibling = [...target.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent === 'Experience 2'
		);
		expect(sibling).toBeDefined();
		sibling!.click();
		expect(onOpenExperience).toHaveBeenCalledWith('experience-2');
	});

	it('says no Presentation exists yet, and distinguishes a filter that matches nothing', () => {
		const empty = mountIndex(groups({ presentations: [] }));
		expect(empty.textContent).toContain('No Presentation yet. Capture a View to make one.');
		cleanup?.();
		document.body.replaceChildren();
		const filtered = mountIndex(groups({ presentations: [], query: 'zzz' }));
		expect(filtered.textContent).toContain('No Presentation matches this filter.');
	});

	it('forwards the filter to the controller and opens the Guide as a toggle with its state', () => {
		const onQuery = vi.fn();
		const onToggleGuide = vi.fn();
		const target = mountIndex(groups({ onQuery, onToggleGuide }));
		const filter = target.querySelector<HTMLInputElement>('input[aria-label="Filter presentations"]')!;
		filter.value = 'Garden';
		filter.dispatchEvent(new Event('input', { bubbles: true }));
		expect(onQuery).toHaveBeenLastCalledWith('Garden');
		const guide = target.querySelector<HTMLButtonElement>('.guide-toggle')!;
		expect(guide.getAttribute('aria-expanded')).toBe('false');
		guide.click();
		expect(onToggleGuide).toHaveBeenCalledOnce();
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
