import { describe, expect, it } from 'vitest';
import {
	buildP23BContainment,
	summarizeContainmentByPath,
	type P23BContainmentNode,
	type P23BContainmentRecord
} from '$lib/bench/p23b-containment';
import type { BenchInteractionOutcome, P23BCaptureLedger } from '$lib/bench/bench-types';

/**
 * The containment builder is the measurement-only step's core: it decides which
 * action owns each pooled `p2311:` mark. These tests pin the four rules that
 * make the resulting tree honest — innermost containment, two visible
 * remainders, exclusive time only where containment holds, and distributions
 * that are never added together.
 */

function ledgerWith(
	samples: P23BCaptureLedger['actions'][number]['samples'],
	path: P23BCaptureLedger['actions'][number]['path'] = 'plan-drag-edit'
): P23BCaptureLedger {
	return {
		sessionId: 'session-1',
		startedAt: 0,
		endedAt: 100,
		fixtureResets: 0,
		droppedBoundaries: 0,
		settled: true,
		actions: [
			{
				index: 0,
				intent: path ?? 'plan-drag-edit',
				path,
				outcome: 'accepted',
				status: 'completed',
				planView: null,
				samples
			}
		]
	};
}

const DRAG_SAMPLES: P23BCaptureLedger['actions'][number]['samples'] = [
	{ boundary: 'input', duration: 10, start: 0, end: 10 },
	{ boundary: 'release', duration: 30, start: 40, end: 70 },
	{ boundary: 'reactive', duration: 20, start: 45, end: 65 },
	{ boundary: 'plan-apply', duration: 12, start: 46, end: 58 },
	{ boundary: 'svelte-flush', duration: 5, start: 70, end: 75 },
	{ boundary: 'browser-frame', duration: 9, start: 70, end: 79 }
];

function flatten(nodes: readonly P23BContainmentNode[]): P23BContainmentNode[] {
	return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

describe('P23B action containment', () => {
	it('attaches each mark to the innermost boundary that encloses it', () => {
		const record = buildP23BContainment(ledgerWith(DRAG_SAMPLES), [
			{ name: 'p2311:preview-compile', startTime: 47, duration: 4 },
			{ name: 'p2311:mesh-prebuild', startTime: 72, duration: 3 }
		]);
		const action = record.actions[0]!;
		const nodes = flatten(action.roots);
		const planApply = nodes.find((node) => node.label === 'plan-apply')!;
		// The flush and the frame both contain 72–75; the smaller interval wins, so
		// the mark is not counted twice and not left on the outer frame.
		const flush = nodes.find((node) => node.label === 'svelte-flush')!;
		const frame = nodes.find((node) => node.label === 'browser-frame')!;
		expect(planApply.children.map((child) => child.label)).toEqual(['p2311:preview-compile']);
		expect(flush.children.map((child) => child.label)).toEqual(['p2311:mesh-prebuild']);
		expect(frame.children.map((child) => child.label)).toEqual(['svelte-flush']);
		expect(record.marks).toEqual({ observed: 2, attributed: 2, unbound: 0, unattributed: 0 });
	});

	it('nests ambient boundaries and reports exclusive time only where containment holds', () => {
		const record = buildP23BContainment(ledgerWith(DRAG_SAMPLES), []);
		const nodes = flatten(record.actions[0]!.roots);
		const byLabel = (label: string) => nodes.find((node) => node.label === label)!;
		expect(record.actions[0]!.roots.map((node) => node.label).sort()).toEqual([
			'browser-frame',
			'input',
			'release'
		]);
		expect(byLabel('release').children.map((child) => child.label)).toEqual(['reactive']);
		expect(byLabel('reactive').children.map((child) => child.label)).toEqual(['plan-apply']);
		// total - enclosed children, and nothing else.
		expect(byLabel('release').self).toBe(10);
		expect(byLabel('reactive').self).toBe(8);
		expect(byLabel('plan-apply').self).toBe(12);
		expect(byLabel('browser-frame').self).toBe(4);
		expect(byLabel('svelte-flush').self).toBe(5);
		expect(byLabel('input').self).toBe(10);
		expect(byLabel('release').selfUnavailable).toBeNull();
	});

	it('refuses exclusive time when enclosed marks overlap, instead of subtracting both', () => {
		const record = buildP23BContainment(ledgerWith(DRAG_SAMPLES), [
			{ name: 'p2311:first', startTime: 47, duration: 5 },
			{ name: 'p2311:second', startTime: 49, duration: 5 }
		]);
		const planApply = flatten(record.actions[0]!.roots).find((node) => node.label === 'plan-apply')!;
		expect(planApply.self).toBeNull();
		expect(planApply.selfUnavailable).toBe(
			'contained marks p2311:first and p2311:second overlap inside plan-apply'
		);
	});

	it('keeps a mark inside the action but outside its boundaries visibly unbound', () => {
		const record = buildP23BContainment(ledgerWith(DRAG_SAMPLES), [
			{ name: 'p2311:preflight-topology', startTime: 38, duration: 2 }
		]);
		const action = record.actions[0]!;
		expect(action.unbound.map((entry) => entry.name)).toEqual(['p2311:preflight-topology']);
		expect(flatten(action.roots).some((node) => node.label === 'p2311:preflight-topology')).toBe(false);
		expect(record.marks.unbound).toBe(1);
	});

	it('pools marks outside every action as unattributed and never guesses them into one', () => {
		const record = buildP23BContainment(ledgerWith(DRAG_SAMPLES), [
			{ name: 'p2311:baseline-restore', startTime: 200, duration: 6 },
			{ name: 'p2311:baseline-restore', startTime: 300, duration: 8 }
		]);
		// p50 is the repo's nearest-rank upper percentile, so two values give the
		// lower of the pair; the two are still reported as a distribution.
		expect(record.unattributed).toEqual([
			{ name: 'p2311:baseline-restore', count: 2, p50: 6, p95: 8, totalMs: 14 }
		]);
		expect(flatten(record.actions[0]!.roots).some((node) => node.label === 'p2311:baseline-restore')).toBe(false);
	});

	it('ignores its own boundary measures and legacy samples that carry no interval', () => {
		const record = buildP23BContainment(ledgerWith(DRAG_SAMPLES), [
			{ name: 'p2311:p23b:plan-drag-edit:release', startTime: 40, duration: 30 },
			{ name: 'p2311:mesh-prebuild', startTime: 72, duration: 3 }
		]);
		expect(record.marks.observed).toBe(1);
		expect(record.actions[0]!.roots).not.toBeUndefined();

		const legacy = buildP23BContainment(
			ledgerWith([{ boundary: 'input', duration: 10 }]),
			[{ name: 'p2311:mesh-prebuild', startTime: 1, duration: 2 }]
		);
		// A ledger without intervals yields no containment and no attribution: the
		// mark stays unattributed rather than being assigned to a guessed action.
		expect(legacy.actions).toEqual([]);
		expect(legacy.unattributed.map((entry) => entry.name)).toEqual(['p2311:mesh-prebuild']);
	});

	it('reports occurrences separately from actions, so a repeat cannot hide', () => {
		const record = buildP23BContainment(ledgerWith(DRAG_SAMPLES), [
			{ name: 'p2311:mesh-prebuild', startTime: 47, duration: 2 },
			{ name: 'p2311:mesh-prebuild', startTime: 50, duration: 2 }
		]);
		const node = summarizeContainmentByPath(record)['plan-drag-edit']!.nodes['p2311:mesh-prebuild']!;
		// Two occurrences inside ONE action: the old aggregation reported this as a
		// single p50 of 2 and nothing said the mark had fired twice.
		expect(node.total.count).toBe(2);
		expect(node.actionsPresent).toBe(1);
		expect(node.maxPerAction).toBe(2);
	});

	it('reports an identical-interval attachment as ambiguous instead of deciding it', () => {
		// A mark that starts and ends with `plan-apply` exactly: which one encloses
		// which is not decidable from timestamps, and the browser capture carried a
		// pair like this (restore-mesh-install against mesh-prebuild), which is how an
		// inverted nesting became possible.
		const record = buildP23BContainment(ledgerWith(DRAG_SAMPLES), [
			{ name: 'p2311:identically-timed', startTime: 46, duration: 12 }
		]);
		expect(record.actions[0]!.ambiguous).toEqual([
			{ mark: 'p2311:identically-timed', node: 'plan-apply' }
		]);
	});

	it('withholds exclusive time when any occurrence could not be priced, instead of mixing populations', () => {
		const record = buildP23BContainment(ledgerWith(DRAG_SAMPLES), [
			{ name: 'p2311:first', startTime: 47, duration: 5 },
			{ name: 'p2311:second', startTime: 49, duration: 5 }
		]);
		const planApply = summarizeContainmentByPath(record)['plan-drag-edit']!.boundaries['plan-apply']!;
		expect(planApply.total.count).toBe(1);
		expect(planApply.self).toBeNull();
		expect(planApply.selfWithheld).toBe(
			'1 of 1 occurrences could not be exclusive-priced (overlapping contained marks)'
		);
	});

	it('applies the interaction report\'s population rule to the marks it aggregates', () => {
		const action = (index: number, outcome: BenchInteractionOutcome) => ({
			index,
			intent: 'plan-drag-edit' as const,
			path: 'plan-drag-edit' as const,
			outcome,
			status: 'completed' as const,
			planView: null,
			samples: [{ boundary: 'release' as const, duration: 10, start: index * 100, end: index * 100 + 10 }]
		});
		const record: P23BContainmentRecord = {
			note: '',
			marks: { observed: 0, attributed: 0, unbound: 0, unattributed: 0 },
			unattributed: [],			actions: [
				{ index: 0, path: 'plan-drag-edit', outcome: 'accepted', start: 0, end: 10, roots: [], unbound: [], ambiguous: [] },
				{ index: 1, path: 'plan-drag-edit', outcome: 'rejected', start: 100, end: 110, roots: [], unbound: [], ambiguous: [] },
				{ index: 2, path: 'plan-drag-edit', outcome: 'accepted', start: 200, end: 210, roots: [], unbound: [], ambiguous: [] },
				{ index: 3, path: 'plan-drag-edit', outcome: 'setup', start: 300, end: 310, roots: [], unbound: [], ambiguous: [] }
				]
		};
		// Ledger order is what warm-up excludes, exactly as the report does: the first
		// action is warm-up even though it is the only one that was accepted there.
		const group = summarizeContainmentByPath(record, { warmup: 1, outcomes: ['accepted'] })['plan-drag-edit']!;
		// One action survives both rules: the warm-up one is excluded even though it
		// is the only accepted one before the rejected and setup actions are dropped.
		expect(group.actions).toBe(1);
		expect(group.warmupExcluded).toBe(1);
		expect(group.excludedByOutcome).toBe(2);
		// Without the filter every completed action of the path is in the population.
		expect(summarizeContainmentByPath(record)['plan-drag-edit']?.actions).toBe(4);
		expect(action(0, 'accepted').status).toBe('completed');
	});

	it('reports distributions per path, never a sum of independent work', () => {
		const base = ledgerWith(DRAG_SAMPLES);
		const second = ledgerWith(
			[
				{ boundary: 'input', duration: 2, start: 100, end: 102 },
				{ boundary: 'release', duration: 4, start: 110, end: 114 }
			],
			'bend-knot-edit'
		);
		const first = buildP23BContainment(base, [{ name: 'p2311:mesh-prebuild', startTime: 72, duration: 4 }]);
		const next = buildP23BContainment(second, [{ name: 'p2311:mesh-prebuild', startTime: 111, duration: 3 }]);
		const merged = {
			...first,
			actions: [...first.actions, ...next.actions]
		};
		const byPath = summarizeContainmentByPath(merged);
		expect(byPath['plan-drag-edit']?.actions).toBe(1);
		expect(byPath['plan-drag-edit']?.nodes['p2311:mesh-prebuild']).toEqual({
			total: { count: 1, p50: 4, p95: 4 },
			actionsPresent: 1,
			maxPerAction: 1,
			self: { count: 1, p50: 4, p95: 4 },
			selfWithheld: null
		});
		expect(byPath['bend-knot-edit']?.nodes['p2311:mesh-prebuild']?.total.p50).toBe(3);
		// Two groups, two distributions, two independent `present` counts. The record
		// exposes no combined figure at all: the only totals it holds are one action's
		// own tree and one group's distribution.
		expect(Object.keys(byPath).sort()).toEqual(['bend-knot-edit', 'plan-drag-edit']);
		expect(JSON.stringify(byPath)).not.toContain('"p50":7');
	});
});
