// @vitest-environment jsdom
/**
 * R217.S06 — the Height Sheet's one height fact.
 *
 * The Sheet is session view state: it resets on a project replacement, it never
 * writes source, history or Save, and a later Slice registers another consumer
 * role without editing the module. These tests pin the authority, the merge and
 * the replacement reset; the mounted control and Plan-cut integration are
 * proven by the route and facade suites in C2/C3.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import StageHeightSheet from '$lib/authoring/stage/shell/StageHeightSheet.svelte';
import HeightSheetProbe from './fixtures/HeightSheetProbe.svelte';
import {
	HEIGHT_TICK_MERGE_TOLERANCE_METERS,
	createStageHeightSheet,
	mergeStageHeightTicks,
	type StageHeightCause,
	type StageHeightTick
} from '$lib/authoring/stage/stage-height-sheet';
import { PLAN_DEFAULT_CUT_HEIGHT_METERS } from '$lib/authoring/stage/plan-parameters';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';

describe('R217.S06 — the one Height Sheet height fact', () => {
	it('starts at the calibrated Plan cut with no pins', () => {
		const sheet = createStageHeightSheet();
		expect(sheet.height()).toBe(PLAN_DEFAULT_CUT_HEIGHT_METERS);
		expect(sheet.pins()).toEqual([]);
		expect(sheet.maxHeightMeters()).toBe(Number.POSITIVE_INFINITY);
	});

	it('accepts a finite height, ignores a non-finite one and clamps to the range', () => {
		const sheet = createStageHeightSheet({ maxHeightMeters: 4 });
		sheet.set(2.4, 'drag');
		expect(sheet.height()).toBe(2.4);
		sheet.set(Number.NaN, 'key');
		expect(sheet.height()).toBe(2.4);
		sheet.set(Number.POSITIVE_INFINITY, 'key');
		expect(sheet.height()).toBe(2.4);
		sheet.set(-1, 'key');
		expect(sheet.height()).toBe(0);
		sheet.set(9, 'tick');
		expect(sheet.height()).toBe(4);
	});

	it('keeps the current height when the known-surface bound changes', () => {
		const sheet = createStageHeightSheet();
		sheet.set(3, 'drag');
		sheet.setMaxHeightMeters(1.5);
		expect(sheet.height()).toBe(3);
		expect(sheet.maxHeightMeters()).toBe(1.5);
		sheet.set(4, 'key');
		expect(sheet.height()).toBe(1.5);
	});

	it('notifies every role in registration order and only on a real change', () => {
		const sheet = createStageHeightSheet();
		const seen: string[] = [];
		sheet.subscribe('plan-cut', (height) => seen.push(`cut:${height}`));
		sheet.subscribe('probe', (height) => seen.push(`probe:${height}`));
		sheet.set(2, 'drag');
		sheet.set(2, 'drag');
		expect(seen).toEqual(['cut:2', 'probe:2']);
	});

	it('isolates a throwing subscriber and unsubscribes exactly once', () => {
		const sheet = createStageHeightSheet();
		const seen: number[] = [];
		const off = sheet.subscribe('broken', () => {
			throw new Error('consumer failed');
		});
		sheet.subscribe('probe', (height) => seen.push(height));
		sheet.set(1.8, 'key');
		expect(seen).toEqual([1.8]);
		off();
		sheet.set(2.1, 'key');
		expect(seen).toEqual([1.8, 2.1]);
	});

	it('notifies pin subscribers on add, remove and reset, including a same-height reset', () => {
		const sheet = createStageHeightSheet();
		const seen: (readonly number[])[] = [];
		const off = sheet.subscribePins('probe', (pins) => seen.push([...pins]));
		sheet.addPin(0.75);
		sheet.addPin(0.3);
		sheet.removePin(0.75);
		// A reset at the current height still clears pins, so the pin channel must
		// announce it even though the height channel has nothing to say.
		sheet.reset();
		expect(seen).toEqual([[0.75], [0.3, 0.75], [0.3], []]);
		off();
		sheet.addPin(1);
		expect(seen).toHaveLength(4);
	});

	it('keeps pins session-only, finite, sorted and deduped within 5 mm', () => {
		const sheet = createStageHeightSheet();
		sheet.addPin(0.75);
		sheet.addPin(0.3);
		sheet.addPin(0.752);
		sheet.addPin(Number.NaN);
		sheet.addPin(-1);
		expect(sheet.pins()).toEqual([0.3, 0.75]);
		expect(sheet.height()).toBe(PLAN_DEFAULT_CUT_HEIGHT_METERS);
		sheet.removePin(0.751);
		expect(sheet.pins()).toEqual([0.3]);
	});

	it('resets to the datum and clears pins while keeping subscribers', () => {
		const sheet = createStageHeightSheet();
		const seen: number[] = [];
		sheet.subscribe('probe', (height) => seen.push(height));
		sheet.set(2.6, 'drag');
		sheet.addPin(0.75);
		sheet.reset();
		expect(sheet.height()).toBe(PLAN_DEFAULT_CUT_HEIGHT_METERS);
		expect(sheet.pins()).toEqual([]);
		expect(seen).toEqual([2.6, PLAN_DEFAULT_CUT_HEIGHT_METERS]);
	});

	it('resets only on replace(), never on session creation or a content install', () => {
		const session = createStageSession({ sessionEpoch: 'session-height' });
		const sheet = session.heightSheet();
		sheet.set(2.4, 'drag');
		sheet.addPin(0.75);
		// The session reset is independent of snapshot contents; these transitions
		// pin lifecycle, not admission. The admitted snapshot's own epoch becomes
		// the session epoch, which is the only field replace() reads here.
		const admitted = { sessionEpoch: 'session-height-replacement' } as unknown as StageReadSnapshot;
		session.replace(admitted);
		expect(session.heightSheet()).toBe(sheet);
		expect(sheet.height()).toBe(PLAN_DEFAULT_CUT_HEIGHT_METERS);
		expect(sheet.pins()).toEqual([]);
		expect(session.sessionEpoch).toBe('session-height-replacement');
	});
});

describe('R217.S06 — owner-declared height ticks', () => {
	const tick = (kind: StageHeightTick['kind'], heightMeters: number, label: string): StageHeightTick => ({
		kind,
		heightMeters,
		label
	});

	it('sorts, keeps one datum and merges declared heights within 5 mm', () => {
		const merged = mergeStageHeightTicks([
			tick('found', 0.753, 'Table top'),
			tick('found', 0.75, 'Table'),
			tick('found', 0.004, 'Scene floor'),
			tick('datum', 0, 'Floor')
		]);
		expect(merged).toEqual([
			{ kind: 'datum', heightMeters: 0, label: 'Floor' },
			{ kind: 'found', heightMeters: 0.75, label: 'Table' }
		]);
		expect(HEIGHT_TICK_MERGE_TOLERANCE_METERS).toBe(0.005);
	});

	it('never chains a group past its anchor and is deterministic for a shuffled input', () => {
		const input = [
			tick('found', 0, 'Base'),
			tick('found', 0.004, 'Near base'),
			tick('found', 0.009, 'Anchored farther')
		];
		const shuffled = [input[2]!, input[0]!, input[1]!];
		expect(mergeStageHeightTicks(input)).toEqual(mergeStageHeightTicks(shuffled));
		expect(mergeStageHeightTicks(input)).toHaveLength(2);
	});

	it('drops non-finite, negative and unlabelled ticks and never mutates its input', () => {
		const input = [tick('datum', 0, 'Floor'), tick('found', Number.NaN, 'Broken'), tick('found', -1, 'Below'), tick('found', 1, '')];
		const copy = [...input];
		expect(mergeStageHeightTicks(input)).toEqual([{ kind: 'datum', heightMeters: 0, label: 'Floor' }]);
		expect(input).toEqual(copy);
	});

	it('keeps a datum as the group winner even when a found surface is nearer', () => {
		const merged = mergeStageHeightTicks([
			tick('found', 0.001, 'Plinth'),
			tick('datum', 0, 'Floor')
		]);
		expect(merged).toEqual([{ kind: 'datum', heightMeters: 0, label: 'Floor' }]);
	});
});

/**
 * R217.S22 — the Height Sheet as a control on the Stage: a thin line, the value on focus,
 * drag and touch, the keyboard, and pin jumps without an exposed editor.
 */
describe('R217.S22 — the Height Sheet control', () => {
	let cleanup: (() => void) | undefined;
	afterEach(() => {
		cleanup?.();
		cleanup = undefined;
		document.body.replaceChildren();
	});

	const ticksOf = (): StageHeightTick[] => [
		{ kind: 'datum', heightMeters: 0, label: 'Floor' },
		{ kind: 'found', heightMeters: 0.75, label: 'Table' }
	];

	function mountSheet(props: { heightMeters?: number; pins?: readonly number[] } = {}) {
		const target = document.createElement('div');
		document.body.append(target);
		const calls = { heights: [] as Array<[number, StageHeightCause]>, adds: 0 };
		const component = mount(HeightSheetProbe, {
			target,
			props: {
				heightMeters: props.heightMeters ?? 1.2,
				pins: props.pins ?? [],
				ticks: ticksOf(),
				onSetHeight: (height: number, cause: StageHeightCause) => calls.heights.push([height, cause]),
				onAddPin: () => {
					calls.adds += 1;
				}
			}
		});
		cleanup = () => void unmount(component);
		return { target, calls };
	}

	const readoutOf = (target: HTMLElement) => target.querySelector<HTMLElement>('.knob')!;

	it('draws a line with a knob and ticks, with no boxed title and no permanent value', () => {
		const { target } = mountSheet();
		expect(target.querySelector('.title')).toBeNull();
		expect(target.querySelector('[role="slider"]')).not.toBeNull();
		expect(target.querySelector('.knob')).not.toBeNull();
		expect(target.querySelectorAll('.tick')).toHaveLength(2);
		// The value is held back until the control is focused, dragged or touched.
		expect(readoutOf(target).textContent).toContain('1.20');
	});

	it('matches the production wireframe: thin axis, stage marks and a border-box sticker', () => {
		const source = readFileSync('src/lib/authoring/stage/shell/StageHeightSheet.svelte', 'utf8');
		expect(source).toMatch(/\.rail\s*\{[^}]*width:\s*2px;[^}]*background:\s*var\(--stage-height-rail\);/s);
		expect(source).toMatch(/\.pin-dot\s*\{[^}]*width:\s*8px;[^}]*height:\s*8px;[^}]*border:\s*1px solid var\(--stage-height-rail\);[^}]*background:\s*var\(--stage-height-cap\);/s);
		expect(source).toMatch(/\.tick\.datum\s*\{[^}]*width:\s*22px;[^}]*height:\s*2\.5px;[^}]*background:\s*var\(--stage-height-cap\);/s);
		expect(source).toMatch(/\.knob\s*\{[^}]*box-sizing:\s*border-box;[^}]*height:\s*22px;[^}]*min-width:\s*40px;/s);
	});

	it('keeps the pin button, opens no card and exposes no pin removal', async () => {
		const { target, calls } = mountSheet({ pins: [0.4] });
		const slider = target.querySelector<HTMLElement>('[role="slider"]')!;
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		slider.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
		await tick();
		expect(calls.heights).toEqual([]);
		expect(target.querySelector('form')).toBeNull();
		expect(target.querySelector('.numeric')).toBeNull();
		expect(target.querySelector('.pin-context')).toBeNull();
		const add = target.querySelector<HTMLButtonElement>('button[aria-label^="Pin the height"]');
		expect(add).not.toBeNull();
		add!.click();
		await tick();
		expect(calls.adds).toBe(1);
		expect(calls.heights).toEqual([]);
		expect([...target.querySelectorAll('button')].some((button) => button.textContent?.includes('Remove pin'))).toBe(false);
	});


	it('steps the height from the keyboard and jumps owner ticks, as before', async () => {
		const { target, calls } = mountSheet({ heightMeters: 1.2 });
		const slider = target.querySelector<HTMLElement>('[role="slider"]')!;
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		await tick();
		expect(calls.heights.at(-1)?.[1]).toBe('key');
		expect(calls.heights.at(-1)?.[0]).toBeCloseTo(1.3, 6);
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
		await tick();
		expect(calls.heights.at(-1)).toEqual([0.75, 'tick']);
	});

	it('jumps to an existing pin and opens no card', async () => {
		const { target, calls } = mountSheet({ pins: [0.4] });
		const pin = target.querySelector<HTMLButtonElement>('button[aria-label^="Jump to pin"]')!;
		expect(pin).not.toBeNull();
		pin.click();
		await tick();
		expect(calls.heights).toEqual([[0.4, 'tick']]);
		expect(target.querySelector('.pin-context')).toBeNull();
		expect(target.querySelector('.numeric')).toBeNull();
	});

});

/**
 * R217.S23 — the Sheet has one white mark set on the stage edge. It does not switch ink
 * for Paper or the overlay's light-ground flag, and its colours are shell-role tokens.
 */
describe('R217.S23 — the Height Sheet white mark set', () => {
	const SHEET_SOURCE = readFileSync('src/lib/authoring/stage/shell/StageHeightSheet.svelte', 'utf8');
	const ROLES = readFileSync('src/lib/design/presentation-tokens.css', 'utf8');
	const token = (name: string): string => {
		const match = ROLES.match(new RegExp(`--shell-${name}:\\s*(#[0-9a-fA-F]{6});`));
		if (match === null) throw new Error(`no shell token --shell-${name}`);
		return match[1]!;
	};
	/** WCAG 2.x relative luminance of a six-digit hex colour. */
	const luminance = (hex: string): number => {
		const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
		const [r, g, b] = channels.map((v) =>
			v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
		);
		return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
	};
	const contrast = (a: string, b: string): number => {
		const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
		return (hi! + 0.05) / (lo! + 0.05);
	};


	it('has no quiet or light-ground variant to switch', () => {
		expect(SHEET_SOURCE).not.toMatch(/\bquiet\b/);
		expect(SHEET_SOURCE).not.toContain('data-paper');
		expect(SHEET_SOURCE).not.toContain('lightGround');
		expect(SHEET_SOURCE).not.toContain('data-ink');
	});

	it('meets the contrast thresholds on the shell-role pairs the Sheet stands on', () => {
		const forest = token('forest');
		const forestRaised = token('forest-raised');
		const paper = token('paper');
		const gold = token('gold');
		const goldInk = token('gold-ink');
		// Text and value labels: 4.5:1. The rail, ticks, knob and pin ring: 3:1.
		expect(contrast(forest, paper)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(forestRaised, paper)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(goldInk, paper)).toBeGreaterThanOrEqual(3);
		// The pin glyph on its gold face, and the add glyph and hint text on their faces.
		expect(contrast(forest, gold)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(paper, forestRaised)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(paper, forest)).toBeGreaterThanOrEqual(4.5);
	});

	it('shows the tick names with the value, in forest on the plate, and leaves out a name that would stack', async () => {
		const ticks: StageHeightTick[] = [
			{ kind: 'datum', heightMeters: 0, label: 'Floor' },
			{ kind: 'found', heightMeters: 0.75, label: 'Table' },
			{ kind: 'found', heightMeters: 0.755, label: 'Stacked' }
		];
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(HeightSheetProbe, {
			target,
			props: {
				heightMeters: 1.2,
				ticks,
				onSetHeight: () => {}
			}
		});
		try {
			const labels = () => [...target.querySelectorAll('.tick-label')].map((node) => node.textContent?.trim());
			expect(labels()).toEqual([]);
			sheetOfProbe(target).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
			await tick();
			expect(labels()).toEqual(['Floor', 'Table']);
		} finally {
			void unmount(component);
			document.body.replaceChildren();
		}
	});

	it('takes no quiet, Paper or light-ground flag from the route', () => {
		const region = readFileSync('src/lib/authoring/stage/shell/StageViewportRegion.svelte', 'utf8');
		const start = region.indexOf('<StageHeightSheet');
		const end = region.indexOf('/>', start);
		expect(start).toBeGreaterThan(0);
		expect(region.slice(start, end)).not.toMatch(/quiet|lightGround|data-paper/);
	});
});

function sheetOfProbe(target: HTMLElement): HTMLElement {
	return target.querySelector<HTMLElement>('[data-stage-height-sheet]')!;
}
