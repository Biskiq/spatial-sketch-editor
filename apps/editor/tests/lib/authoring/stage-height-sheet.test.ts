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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import StageHeightSheet, { PIN_HINT_MS } from '$lib/authoring/stage/shell/StageHeightSheet.svelte';
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
 * drag and touch, the keyboard and pins unchanged, and the one pin hint per Stage session.
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
		const calls = { heights: [] as Array<[number, StageHeightCause]>, added: 0, removed: [] as number[] };
		const component = mount(HeightSheetProbe, {
			target,
			props: {
				heightMeters: props.heightMeters ?? 1.2,
				pins: props.pins ?? [],
				ticks: ticksOf(),
				onSetHeight: (height: number, cause: StageHeightCause) => calls.heights.push([height, cause]),
				onAddPin: () => {
					calls.added += 1;
				},
				onRemovePin: (height: number) => calls.removed.push(height)
			}
		});
		cleanup = () => void unmount(component);
		return { target, calls };
	}

	const sheetOf = (target: HTMLElement) => target.querySelector<HTMLElement>('[data-stage-height-sheet]')!;
	const readoutOf = (target: HTMLElement) => target.querySelector<HTMLElement>('.readout')!;
	const hintOf = () => document.querySelector<HTMLElement>('[data-pin-hint]');
	const addButtonOf = (target: HTMLElement) =>
		target.querySelector<HTMLButtonElement>('button[aria-label^="Pin the height"]')!;

	it('draws a line with a knob and ticks, with no boxed title and no permanent value', () => {
		const { target } = mountSheet();
		expect(target.querySelector('.title')).toBeNull();
		expect(target.querySelector('[role="slider"]')).not.toBeNull();
		expect(target.querySelector('.knob')).not.toBeNull();
		expect(target.querySelectorAll('.tick')).toHaveLength(2);
		// The value is held back until the control is focused, dragged or touched.
		expect(readoutOf(target).classList.contains('shown')).toBe(false);
	});

	it('states the value on focus and drops it when focus leaves the Sheet', async () => {
		const { target } = mountSheet();
		sheetOf(target).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		await tick();
		expect(readoutOf(target).classList.contains('shown')).toBe(true);
		sheetOf(target).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
		await tick();
		expect(readoutOf(target).classList.contains('shown')).toBe(false);
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

	it('pins and removes through the knob and the pin marks, as before', async () => {
		const { target, calls } = mountSheet({ pins: [0.4] });
		addButtonOf(target).click();
		await tick();
		expect(calls.added).toBe(1);
		target.querySelector<HTMLButtonElement>('button[aria-label^="Remove the pin"]')!.click();
		await tick();
		expect(calls.removed).toEqual([0.4]);
	});

	it('shows the pin hint on the first pin of a Stage session and clears it by itself', async () => {
		vi.useFakeTimers();
		try {
			const { target } = mountSheet();
			expect(hintOf()).toBeNull();
			addButtonOf(target).click();
			await tick();
			expect(hintOf()?.getAttribute('role')).toBe('note');
			// It needs no dismissal: time alone clears it.
			vi.advanceTimersByTime(PIN_HINT_MS);
			await tick();
			expect(hintOf()).toBeNull();
			// Once per session: a second pin shows nothing.
			addButtonOf(target).click();
			await tick();
			expect(hintOf()).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('shows the hint again in a fresh Stage session, because the flag belongs to the session (TD-15)', async () => {
		const first = mountSheet();
		addButtonOf(first.target).click();
		await tick();
		expect(hintOf()).not.toBeNull();
		cleanup?.();
		cleanup = undefined;
		document.body.replaceChildren();
		expect(hintOf()).toBeNull();

		// A new Stage session holds its own flag: its first pin shows its own hint.
		const second = mountSheet();
		addButtonOf(second.target).click();
		await tick();
		expect(hintOf()).not.toBeNull();
	});

	it('keeps the coarse-pointer knob and track at 44 × 44 CSS px and the value to focus, drag and touch', () => {
		const source = readFileSync('src/lib/authoring/stage/shell/StageHeightSheet.svelte', 'utf8');
		const coarse = source.slice(source.indexOf('@media (pointer: coarse)'));
		expect(coarse).toMatch(/\.knob \{\s*width: 44px;\s*height: 44px;/);
		expect(coarse).toMatch(/\.track \{\s*width: 44px;/);
		expect(source).toContain('touching = event.pointerType');
		expect(source).toMatch(/const valueShown = \$derived\(focused \|\| dragging \|\| touching\)/);
		// The old module-scoped flag and the dismiss button are gone.
		expect(source).not.toContain('heightHintSeen');
		expect(source).not.toContain('Got it');
	});
});
