// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { mountWithProps, settle } from '../../../kit/dom';
import StageLibrary from '$lib/authoring/library/StageLibrary.svelte';
import { getMaterial } from '$lib/content/materials';
import { materialFamilyOf, type MaterialFamilyId } from '$lib/content/material-presentation';
import type { MaterialId } from '$lib/types/materials';
import type { LibraryFinishEntry } from '$lib/authoring/library/library-catalogue';
import type { LibraryTarget } from '$lib/authoring/library/library-target';
import { STAGE_LIBRARY_VIEW_DEFAULT } from '$lib/authoring/stage/route/stage-shell-state.svelte';
import type { FinishSheenReading } from '@portfolio/project-model/scene-planning';
import { reactiveProps } from '../__fixtures__/reactive-props.svelte';

const reading: FinishSheenReading = {
	steps: [
		{ id: 'matte', label: 'Matte', target: 0.8, factor: 1, disabled: false },
		{ id: 'satin', label: 'Satin', target: 0.5, factor: 0.6, disabled: false },
		{ id: 'gloss', label: 'Gloss', target: 0.2, factor: 0.3, disabled: false }
	],
	current: 'satin',
	original: 'satin',
	originalExact: true,
	effective: 0.5,
	scan: { mean: 0.5, approximate: false },
	changed: false
};

function curated(id: MaterialId): LibraryFinishEntry {
	const material = getMaterial(id);
	const family = materialFamilyOf(id) as MaterialFamilyId | null;
	return {
		key: `curated:${id}`,
		source: 'curated',
		ref: { curated: id },
		name: material.label,
		materialLabel: material.label,
		family,
		familyLabel: family ?? 'Other',
		subline: 'Wood · 1 m',
		tileSize: '1 m',
		color: material.swatchColor ?? material.fallbackColor,
		imageUri: null,
		curatedId: id,
		projectId: null,
		favourite: false,
		usage: 0,
		userKeys: [],
		changes: 0,
		reading,
		sheen: material.roughness,
		metalness: material.metalness,
		hasColourImage: true,
		warning: null
	};
}

const project: LibraryFinishEntry = {
	...curated('wood-oak-veneer'),
	key: 'project:lobby',
	source: 'project',
	ref: { project: 'lobby' },
	name: 'Lobby oak',
	subline: 'from Oak Veneer · 1 change',
	curatedId: null,
	projectId: 'lobby',
	usage: 2,
	userKeys: ['entity:a', 'entity:b'],
	changes: 1
};

const oak = curated('wood-oak-veneer');
const walnut = curated('wood-walnut-veneer');
const target = (key: string, label: string): LibraryTarget => ({ kind: 'entity', key, entityId: label, label, finishKey: null });

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const unmount of cleanups.splice(0)) unmount();
});

function render(extra: Record<string, unknown> = {}) {
	const callbacks = {
		onView: vi.fn(),
		onClose: vi.fn(),
		onPaint: vi.fn(),
		onReplace: vi.fn(async () => ({ ok: true as const })),
		onSwap: vi.fn(async () => ({ ok: true as const })),
		onSelectUsers: vi.fn(async () => true),
		onCustomise: vi.fn(),
		onToggleFavourite: vi.fn(),
		onObject: vi.fn(),
		onArtwork: vi.fn(),
		onArtworkImport: vi.fn(),
		onLook: vi.fn()
	};
	const props = reactiveProps({
		entries: [project, oak, walnut],
		view: STAGE_LIBRARY_VIEW_DEFAULT,
		tileSource: () => null,
		...callbacks,
		...extra
	} as Record<string, unknown>);
	const { target: host, unmount } = mountWithProps(StageLibrary, props as never);
	cleanups.push(unmount);
	const q = <T extends Element = HTMLElement>(selector: string) => host.querySelector(selector) as T | null;
	return { host, props, q, ...callbacks };
}

describe('Library browsing and activation', () => {
	it('opens on the remembered view, nests the families and writes the view back', () => {
		const fx = render({ view: { ...STAGE_LIBRARY_VIEW_DEFAULT, source: 'curated', query: 'oak' } });
		expect(fx.q<HTMLInputElement>('[data-library-search]')?.value).toBe('oak');
		expect(fx.q('[data-library-source="curated"]')?.getAttribute('aria-pressed')).toBe('true');
		expect(fx.q('[data-library-family]')).not.toBeNull();
		expect(fx.onView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'materials', source: 'curated', query: 'oak' }));
	});

	it('shows a capped project shelf in All with See all', () => {
		const many = Array.from({ length: 10 }, (_, index) => ({ ...project, key: `project:p${index}`, ref: { project: `p${index}` }, name: `Finish ${index}` }));
		const fx = render({ entries: [...many, oak, walnut] });
		const shelf = fx.host.querySelectorAll('[data-library-shelf="project"]');
		// At most eight render; CSS clamps the shelf to one row.
		expect(shelf.length).toBe(8);
		expect(fx.q('[data-library-see-all="project"]')?.textContent).toMatch(/See all 10/);
		fx.q<HTMLButtonElement>('[data-library-see-all="project"]')?.click();
		flushSync();
		expect(fx.q('[data-library-source="project"]')?.getAttribute('aria-pressed')).toBe('true');
	});

	it.each([
		['paint', /Pick for Paint/],
		['browse', /Browse/]
	] as const)('arms Paint from %s without a write and preserves Shift-click', (intent, context) => {
		const fx = render({ intent });
		expect(fx.q('[data-library-context]')?.textContent).toMatch(context);
		const chooseOak = fx.q<HTMLButtonElement>(`[data-library-choose="${oak.key}"]`);
		expect(chooseOak?.getAttribute('aria-label')).toBe('Oak Veneer — pick for Paint');
		chooseOak?.click();
		expect(fx.onPaint).toHaveBeenCalledWith(oak, false);
		fx.q<HTMLButtonElement>(`[data-library-choose="${walnut.key}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
		flushSync();
		expect(fx.onPaint).toHaveBeenLastCalledWith(walnut, true);
		expect(fx.q('[data-library-note]')?.textContent).toMatch(/stays open/);
		expect(fx.onReplace).not.toHaveBeenCalled();
	});

	it('shows the measured tile size independently of a Finish card’s change count', () => {
		const fx = render();
		fx.q<HTMLButtonElement>(`[data-library-detail-open="${project.key}"]`)?.click();
		flushSync();
		const detail = fx.q(`[data-library-detail="${project.key}"]`);
		const label = [...(detail?.querySelectorAll('dt') ?? [])].find((term) => term.textContent === 'Real size');
		expect(label?.nextElementSibling?.textContent).toBe('1 m');
	});

	it('the detail control opens detail and never chooses; Escape closes detail first', () => {
		const fx = render();
		fx.q<HTMLButtonElement>(`[data-library-detail-open="${oak.key}"]`)?.click();
		flushSync();
		expect(fx.q(`[data-library-detail="${oak.key}"]`)).not.toBeNull();
		expect(fx.q('[data-library-inspect]')?.getAttribute('data-inspect-state')).toBe('off');
		expect(fx.q('[data-inspect-note]')?.textContent).toMatch(/sample tile/);
		expect(fx.q<HTMLButtonElement>('[data-inspect-lighting="world"]')?.disabled).toBe(true);
		expect(fx.onPaint).not.toHaveBeenCalled();
		fx.q('[data-stage-library]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		flushSync();
		expect(fx.q('[data-library-detail]')).toBeNull();
		expect(fx.onClose).not.toHaveBeenCalled();
		fx.q('[data-stage-library]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(fx.onClose).toHaveBeenCalledTimes(1);
	});

	it('the narrow-layout Back closes detail and returns focus to its card', async () => {
		const fx = render();
		fx.q<HTMLButtonElement>(`[data-library-detail-open="${oak.key}"]`)?.click();
		flushSync();
		fx.q<HTMLButtonElement>('[data-library-detail-back]')?.click();
		await settle();
		expect(fx.q('[data-library-detail]')).toBeNull();
		expect(document.activeElement).toBe(fx.q(`[data-library-detail-open="${oak.key}"]`));
		expect(fx.onClose).not.toHaveBeenCalled();
	});

	it('the folded sources menu switches source like the segmented control', () => {
		const fx = render();
		const menu = fx.q<HTMLSelectElement>('[data-library-source-menu]');
		expect(menu).not.toBeNull();
		menu!.value = 'project';
		menu!.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		expect(fx.q('[data-library-source="project"]')?.getAttribute('aria-pressed')).toBe('true');
	});

	it('Replace applies to the captured target and refuses a stale one in place', async () => {
		const fx = render({ intent: 'replace', target: target('entity:a', 'Chair') });
		expect(fx.q('[data-library-context]')?.textContent).toMatch(/Replace\s*Chair/);
		fx.q<HTMLButtonElement>(`[data-library-choose="${oak.key}"]`)?.click();
		await settle();
		expect(fx.onReplace).toHaveBeenCalledWith(oak, false);
		fx.props.target = target('entity:b', 'Table');
		flushSync();
		fx.q<HTMLButtonElement>(`[data-library-choose="${walnut.key}"]`)?.click();
		await settle();
		expect(fx.onReplace).toHaveBeenCalledTimes(1);
		expect(fx.q('[data-library-refusal]')?.textContent).toMatch(/selection changed/);
	});

	it('Replace inserts a saved item through My library instead of the curated Replace path', async () => {
		const saved: LibraryFinishEntry = {
			...oak,
			key: 'mine:saved',
			source: 'mine',
			ref: null,
			curatedId: null,
			projectId: null,
			name: 'Saved oak',
			libraryItem: { id: 'saved', savedAt: '2026-11-01', savedFrom: '', flattened: [], imageCount: 0 }
		};
		const fx = render({ entries: [saved, oak], intent: 'replace', target: target('entity:a', 'Chair') });
		fx.q<HTMLButtonElement>('[data-library-choose="mine:saved"]')?.click();
		await settle();
		expect(fx.onReplace).not.toHaveBeenCalled();
		expect(fx.q('[data-library-refusal]')?.textContent).toMatch(/My library is unavailable here/);
	});

	it('a saved shelf activation refuses after the captured target changed', async () => {
		const saved: LibraryFinishEntry = {
			...oak,
			key: 'mine:saved',
			source: 'mine',
			ref: null,
			curatedId: null,
			projectId: null,
			name: 'Saved oak',
			libraryItem: { id: 'saved', savedAt: '2026-11-01', savedFrom: '', flattened: [], imageCount: 0 }
		};
		const fx = render({ entries: [saved, oak], intent: 'replace', target: target('entity:a', 'Chair') });
		fx.props.target = target('entity:b', 'Table');
		flushSync();
		fx.q<HTMLButtonElement>('[data-library-choose="mine:saved"]')?.click();
		await settle();
		expect(fx.onReplace).not.toHaveBeenCalled();
		expect(fx.q('[data-library-refusal]')?.textContent).toMatch(/selection changed/);
	});

	it('saved detail Apply refuses after the captured target changed', async () => {
		const saved: LibraryFinishEntry = {
			...oak,
			key: 'mine:saved',
			source: 'mine',
			ref: null,
			curatedId: null,
			projectId: null,
			name: 'Saved oak',
			libraryItem: { id: 'saved', savedAt: '2026-11-01', savedFrom: '', flattened: [], imageCount: 0 }
		};
		const fx = render({ entries: [saved, oak], intent: 'replace', target: target('entity:a', 'Chair') });
		fx.q<HTMLButtonElement>(`[data-library-detail-open="${saved.key}"]`)?.click();
		flushSync();
		fx.props.target = target('entity:b', 'Table');
		flushSync();
		fx.q<HTMLButtonElement>('[data-library-detail-apply]')?.click();
		await settle();
		expect(fx.onReplace).not.toHaveBeenCalled();
		expect(fx.q('[data-library-refusal]')?.textContent).toMatch(/selection changed/);
	});

	it('Swap shows the target and reach, takes curated materials only', async () => {
		const swap = { place: 'Chair', reachLine: 'Just this one', target: { kind: 'entity', entityId: 'a' }, targetKey: 'entity:a', finishName: 'Oak', materialLabel: 'Oak Veneer', currentId: 'wood-oak-veneer', reach: 'this', users: 2 };
		const fx = render({ intent: 'swap', swap });
		expect(fx.q('[data-library-context]')?.textContent).toMatch(/Chair.*Just this one/);
		fx.q<HTMLButtonElement>(`[data-library-choose="${project.key}"]`)?.click();
		await settle();
		expect(fx.onSwap).not.toHaveBeenCalled();
		expect(fx.q('[data-library-refusal]')?.textContent).toMatch(/curated/);
		fx.q<HTMLButtonElement>(`[data-library-choose="${walnut.key}"]`)?.click();
		await settle();
		expect(fx.onSwap).toHaveBeenCalledWith('wood-walnut-veneer', false);
	});

	it('Browse selects a project Finish’s users and arms Paint for curated cards', async () => {
		const fx = render();
		fx.q<HTMLButtonElement>(`[data-library-choose="${project.key}"]`)?.click();
		await settle();
		expect(fx.onSelectUsers).toHaveBeenCalledWith(project);
		fx.q<HTMLButtonElement>(`[data-library-choose="${oak.key}"]`)?.click();
		expect(fx.onPaint).toHaveBeenCalledWith(oak, false);
	});

	it('Customise… hands the Finish on from detail', () => {
		const fx = render();
		fx.q<HTMLButtonElement>(`[data-library-detail-open="${project.key}"]`)?.click();
		flushSync();
		fx.q<HTMLButtonElement>('[data-library-customise]')?.click();
		expect(fx.onCustomise).toHaveBeenCalledWith(project);
	});
});
