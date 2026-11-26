// @vitest-environment jsdom
/**
 * T2.S8 U2 × U1 — the Paint tray draws every material through U1's FinishTile
 * and the route's one picture service: catalogue keys as catalogue masters,
 * project keys through the route's project source, colours never. D1 folds a
 * variant family to its primary (variants are the Library's), and every picture
 * the tray held is released when a pick changes or the tray closes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import PaintTrayTilesProbe from '../fixtures/PaintTrayTilesProbe.svelte';
import { createPaintTrayState } from '$lib/authoring/look/paint-tray-state.svelte';
import type { PaintSwatch, PaintTrayView } from '$lib/authoring/look/finish-authoring.svelte';
import type { FinishTileLease, FinishTileSource, FinishTiles } from '$lib/render/materials/finish-tiles.svelte';

const finish = (key: string, label: string): PaintSwatch => ({ kind: 'finish', key, label, color: '#a08060', favourite: false });
const colour = (key: string): PaintSwatch => ({ kind: 'colour', key, label: key, color: key, favourite: false });

const CURATED = [
	finish('curated:wood-oak-planks', 'Oak Planks'),
	finish('curated:concrete-smooth', 'Smooth Concrete'),
	finish('curated:concrete-polished', 'Polished Concrete'),
	finish('curated:metal-brass-satin', 'Satin Brass'),
	finish('curated:stone-terrazzo', 'Terrazzo')
];

function trayView(active: PaintSwatch | null, row: readonly PaintSwatch[] = []): PaintTrayView {
	return {
		colourEnabled: false,
		active,
		dropper: false,
		colours: { row: [colour('#336699')], palette: [] },
		materials: { row, project: [finish('project:f1', 'Kitchen oak')], curated: CURATED }
	};
}

/** A service that answers every ask at once and counts what is held. */
function liveTiles() {
	const asked: { source: FinishTileSource; size: number }[] = [];
	const held = new Map<string, number>();
	const urlOf = (source: FinishTileSource) =>
		source.kind === 'catalogue'
			? `blob:${source.id}`
			: source.kind === 'finish'
				? `blob:project:${source.subject.finishId}`
				: `blob:draft:${source.subject.draft.recipeHash}`;
	const lease = (source: FinishTileSource): FinishTileLease => {
		const url = urlOf(source);
		held.set(url, (held.get(url) ?? 0) + 1);
		let done = false;
		return {
			url,
			key: url,
			release: () => {
				if (done) return;
				done = true;
				held.set(url, held.get(url)! - 1);
			}
		};
	};
	const tiles = {
		epoch: 0,
		leaseNow: () => null,
		lease: (source: FinishTileSource, size: number) => {
			asked.push({ source, size });
			return Promise.resolve(lease(source));
		}
	} as unknown as FinishTiles;
	const holding = () => [...held].filter(([, n]) => n > 0).map(([url]) => url).sort();
	return { tiles, asked, holding };
}

const projectSource = (finishId: string): FinishTileSource =>
	({ kind: 'finish', subject: { kind: 'finish', finishId } }) as unknown as FinishTileSource;

const mounted: Record<string, unknown>[] = [];
afterEach(() => {
	for (const instance of mounted.splice(0)) void unmount(instance);
	document.body.innerHTML = '';
});

async function settle(): Promise<void> {
	flushSync();
	for (let i = 0; i < 4; i += 1) await tick();
}

function render(first: PaintTrayView) {
	const live = liveTiles();
	const view = createPaintTrayState();
	const onPick = vi.fn();
	const tileSource = vi.fn(projectSource);
	const target = document.createElement('div');
	document.body.append(target);
	const probe = mount(PaintTrayTilesProbe, { target, props: { tiles: live.tiles, first, view, onPick, tileSource } }) as Record<string, unknown> & {
		show(next: PaintTrayView): void;
	};
	mounted.push(probe);
	return { ...live, view, onPick, tileSource, target, probe };
}

const pictureIn = (target: HTMLElement, key: string) =>
	target.querySelector(`[data-paint-swatch="${key}"] img`)?.getAttribute('src') ?? null;

describe('T2.S8 U2 × U1 — Paint tray pictures', () => {
	it('draws row materials as U1 tiles at the row size and never asks for a colour', async () => {
		const one = render(trayView(null, [finish('curated:wood-oak-planks', 'Oak Planks'), finish('project:f1', 'Kitchen oak')]));
		await settle();
		expect(pictureIn(one.target, 'curated:wood-oak-planks')).toBe('blob:wood-oak-planks');
		expect(pictureIn(one.target, 'project:f1')).toBe('blob:project:f1');
		expect(one.tileSource).toHaveBeenCalledWith('f1');
		expect(one.asked.every((ask) => ask.size === 40)).toBe(true);
		// The swatch colour stays beneath as the fallback.
		expect(one.target.querySelector<HTMLElement>('[data-paint-swatch="curated:wood-oak-planks"] .finish-tile')!.style.backgroundColor).not.toBe('');
	});

	it('expands into families with one Concrete swatch and no variant chooser', async () => {
		const one = render(trayView(null));
		one.view.toggleExpanded();
		await settle();
		const families = [...one.target.querySelectorAll('[data-paint-family]')].map((group) => group.getAttribute('data-paint-family'));
		expect(families).toEqual(['wood', 'stone', 'plaster-concrete', 'metal']);
		// The approved tray lists primaries only: variants are the Library's (D1).
		expect(one.target.querySelector('[data-paint-swatch="curated:concrete-polished"]')).toBeNull();
		expect(one.target.querySelector('[data-paint-variant]')).toBeNull();
		const concrete = one.target.querySelector<HTMLButtonElement>('[data-paint-swatch="curated:concrete-smooth"]')!;
		expect(concrete.getAttribute('aria-label')).not.toMatch(/polished/i);
		expect(pictureIn(one.target, 'curated:concrete-smooth')).toBe('blob:concrete-smooth');
		concrete.click();
		expect(one.onPick).toHaveBeenCalledWith(expect.objectContaining({ key: 'curated:concrete-smooth' }));
	});

	it('leads the row with a variant picked elsewhere and releases it when the pick moves on', async () => {
		const one = render(trayView(finish('curated:concrete-polished', 'Polished Concrete')));
		one.view.toggleExpanded();
		await settle();
		expect(one.target.querySelector('[data-paint-lead] img')?.getAttribute('src')).toBe('blob:concrete-polished');
		// The Concrete primary is not the pick, so it is not ringed.
		expect(one.target.querySelector('[data-paint-swatch="curated:concrete-smooth"]')!.classList.contains('picked')).toBe(false);
		expect(one.holding()).toContain('blob:concrete-polished');
		// One oak tile only: no card borrows another family's picture.
		expect(one.target.querySelectorAll('[data-paint-swatch="curated:wood-oak-planks"]')).toHaveLength(1);

		one.probe.show(trayView(finish('curated:wood-oak-planks', 'Oak Planks')));
		await settle();
		expect(one.target.querySelector('[data-paint-lead] img')?.getAttribute('src')).toBe('blob:wood-oak-planks');
		expect(one.holding()).not.toContain('blob:concrete-polished');
	});

	it('says how to fill an empty row, and not while a pick leads it', async () => {
		const one = render(trayView(null));
		await settle();
		expect(one.target.querySelector('[data-paint-empty]')?.textContent).toBe('Star colours or materials to keep them here.');
		one.probe.show(trayView(finish('curated:stone-terrazzo', 'Terrazzo')));
		await settle();
		expect(one.target.querySelector('[data-paint-empty]')).toBeNull();
	});

	it('releases every picture it held when the tray closes', async () => {
		const one = render(trayView(finish('curated:metal-brass-satin', 'Satin Brass'), [finish('curated:stone-terrazzo', 'Terrazzo')]));
		one.view.toggleExpanded();
		await settle();
		expect(one.holding().length).toBeGreaterThan(0);
		void unmount(mounted.pop()!);
		await settle();
		expect(one.holding()).toEqual([]);
	});
});
