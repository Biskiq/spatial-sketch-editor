/**
 * P23B.7 S7 (targeted, per the §0.8.3 owner ruling) — WHAT THE `commit-capture`
 * RESIDUAL ACTUALLY IS, and what removing it left behind.
 *
 * S6's capture left one measured, unaddressed cost on the accepted-edit path:
 * `commit-capture` (107–149 ms per accepted edit). This probe attributed it
 * WITHOUT another sweep: `captureLayoutPreviewSnapshot` handed `geometry` by
 * reference and deep-cloned three streams through `cloneJson`
 * (`JSON.parse(JSON.stringify(...))`, the proxy-safe clone) — the whole `project`
 * (layout + scene), the derived preview `model`, and `issues` — and the derived
 * `model` was 99.4 % of that payload (3,412,257 of 3,434,187 bytes; 39,106 of
 * 39,746 objects) with NO production reader.
 *
 * POST-FIX (review-time, owner-directed — see
 * `2026-09-25-s7-followup-model-free-capture-record.md`): the capture no longer
 * clones `model` at all. S7's PRE-fix accounting stays frozen in
 * `2026-09-25-s7-capture-attribution-record.md` §2 as the evidence that motivated
 * the fix; this file now pins the post-fix shape, re-measures the REMOVED stream
 * explicitly so the contrast stays citable from one session, and leaves the
 * durable payload bound to the permanent guard
 * (`tests/lib/editor/layout/p23b7-snapshot-payload-guard.test.ts`).
 *
 * CLAIMS ARE TWO-KINDED, exactly as the measurement rules require:
 *   · DETERMINISTIC (asserted): the structure (which streams are cloned, which is
 *     shared by reference, that `model` is not a member at all, and that a later
 *     live mutation cannot reach the snapshot), the payload sizes in bytes and
 *     objects on the committed fixtures, that the payload GROWS with the document,
 *     and that the removed stream still dominates the shipped payload; the cadence
 *     contract (one capture per accepted commit and per gesture start — never per
 *     pointermove).
 *   · ADVISORY (printed, never asserted): per-stream wall-clock in this single
 *     node session, incl. the removed stream measured by construction. The browser
 *     numbers stay S6's/S1's; no timing is a gate and no budget metric is added.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { serializeWallFirstLayoutDocument } from '@portfolio/layout-core';
import { projectLayoutPreviewModel } from '$lib/editor/layout/layout-mesh-factory';
import {
	captureLayoutPreviewSnapshot,
	createEmptyWallFirstLayoutPreviewState,
	importLayoutPreviewJson,
	restoreLayoutPreviewSnapshot,
	type LayoutPreviewSnapshot,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from '$lib/bench/p23b-fixtures';
import {
	createProxyBackedLayoutPreviewState,
	isSvelteStateProxy
} from '../editor/layout/p23b7-reactive-preview-state';

const here = path.dirname(fileURLToPath(import.meta.url));

function matrixFixture(id: string) {
	const spec = P23B_MATRIX_SPECS.find((entry) => entry.id === id);
	if (!spec) throw new Error(`unknown matrix fixture ${id}`);
	return buildP23BMatrixFixture(spec);
}

/** The canonical install a document replacement uses. */
function installedState(fixtureId: string | null): LayoutPreviewState {
	const state = createEmptyWallFirstLayoutPreviewState();
	if (fixtureId) {
		expect(importLayoutPreviewJson(state, serializeWallFirstLayoutDocument(matrixFixture(fixtureId)))).toBe(
			true
		);
	}
	return state;
}

/** Object/array node count of one JSON stream — the clone's work unit, size-independent. */
function countNodes(value: unknown): number {
	let count = 0;
	const walk = (node: unknown): void => {
		if (node === null || typeof node !== 'object') return;
		count += 1;
		if (Array.isArray(node)) {
			for (const entry of node) walk(entry);
			return;
		}
		for (const entry of Object.values(node as Record<string, unknown>)) walk(entry);
	};
	walk(value);
	return count;
}

type StreamAccounting = { bytes: number; nodes: number };

/** One JSON stream's accounting — bytes plus the clone's own work unit, objects. */
function streamOf(value: unknown): StreamAccounting {
	return { bytes: JSON.stringify(value).length, nodes: countNodes(value) };
}

/**
 * What the SHIPPED capture actually clones, DISCOVERED from the snapshot instead
 * of declared: every captured value that is an object and is not the state's own
 * object. `geometry` is excluded by identity (handed by reference, free), and
 * primitives carry no clone cost. A re-introduced clone of the derived model —
 * under that name or any other — lands in this list and is caught by the tests
 * below, which is why they are not tautological.
 */
function clonedStreams(state: LayoutPreviewState, snapshot: LayoutPreviewSnapshot) {
	const owner = state as unknown as Record<string, unknown>;
	const streams = Object.entries(snapshot)
		.filter(([key, value]) => value !== null && typeof value === 'object' && value !== owner[key])
		.map(([key, value]) => ({ key, ...streamOf(value) }));
	return {
		streams,
		bytes: streams.reduce((sum, entry) => sum + entry.bytes, 0),
		nodes: streams.reduce((sum, entry) => sum + entry.nodes, 0)
	};
}

function p50(samples: readonly number[]): number {
	const sorted = [...samples].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)]!;
}

/**
 * Advisory only: this session's node wall-clock for one measured call.
 *
 * The repetition count is a BUDGETING knob, never part of a claim: these
 * numbers are printed and never asserted, and this file also runs inside the
 * full suite on a loaded machine. One clone of the 40-Wall model through a
 * state proxy is ~130 ms idle, so 12 of them is already >1.5 s before load,
 * and the expensive callers ask for fewer reps rather than risk the runner's
 * default test timeout. The few-sample p50 stays advisory and single-session
 * either way.
 */
function advisoryP50(run: () => void, reps: { warmups?: number; samples?: number } = {}): number {
	const warmups = reps.warmups ?? 3;
	const sampleCount = reps.samples ?? 9;
	for (let index = 0; index < warmups; index += 1) run();
	const samples: number[] = [];
	for (let index = 0; index < sampleCount; index += 1) {
		const started = performance.now();
		run();
		samples.push(performance.now() - started);
	}
	return Number(p50(samples).toFixed(2));
}

describe('P23B.7 S7 — the commit-capture residual: what is cloned', () => {
	it('clones the document and its issues, hands geometry by reference, and carries no model', () => {
		const state = installedState('p23b-40-wall-all-curved-v1');
		const snapshot = captureLayoutPreviewSnapshot(state);
		// The deep-cloned streams describe the committed state but share nothing with
		// the live one...
		expect(snapshot.project).toEqual(state.project);
		expect(snapshot.issues).toEqual(state.issues);
		expect(snapshot.project).not.toBe(state.project);
		expect(snapshot.issues).not.toBe(state.issues);
		// ...while geometry is the SAME object: the capture pays nothing for the
		// compiled geometry (the state-side identity the S6 fix keys the mesh cache on).
		expect(snapshot.geometry).toBe(state.geometry);
		// THE FIX: the derived model is not a member at all, so the 99.4 % share S7
		// attributed cannot come back through the payload.
		expect('model' in snapshot, 'no captured model').toBe(false);
		// A live mutation after the capture cannot reach the snapshot: that is what the
		// JSON clone buys and why the capture cannot simply retain references.
		const before = JSON.stringify(snapshot.project);
		state.project.name = `${state.project.name} (mutated)`;
		expect(JSON.stringify(snapshot.project)).toBe(before);
	});

	it('keeps the payload document-sized while the removed stream still dominates it', () => {
		const fixtures = [
			['empty', installedState(null)],
			['12-wall', installedState('p23b-12-wall-target-curved-v1')],
			['40-wall curved', installedState('p23b-40-wall-all-curved-v1')],
			['40-wall straight', installedState('p23b-40-wall-straight-v1')]
		] as const;
		const accounted = fixtures.map(([label, state]) => ({
			label,
			...clonedStreams(state, captureLayoutPreviewSnapshot(state)),
			removed: streamOf(state.model)
		}));
		const of = (label: string) => accounted.find((entry) => entry.label === label)!;
		for (const entry of accounted) {
			// What is cloned is the document plus its issues — NOT a derived projection.
			const clonedKeys = entry.streams.map((stream) => stream.key);
			expect(clonedKeys, `${entry.label}: cloned streams`).toContain('project');
			expect(clonedKeys, `${entry.label}: cloned streams`).not.toContain('model');
		}
		// Deterministic scaling: a richer document is a bigger capture, and the empty
		// boot is the smallest. (No fixed byte count is asserted — this is not a budget.)
		expect(of('12-wall').bytes).toBeGreaterThan(of('empty').bytes);
		expect(of('40-wall curved').bytes).toBeGreaterThan(of('12-wall').bytes);
		expect(of('40-wall curved').nodes).toBeGreaterThan(of('empty').nodes);
		// THE ATTRIBUTED COST, still measurable in one session: the live derived model —
		// the stream the capture used to clone — is an order of magnitude larger than
		// the WHOLE shipped payload, on both 40-Wall fixtures.
		for (const label of ['40-wall curved', '40-wall straight'] as const) {
			const entry = of(label);
			expect(entry.removed.nodes, `${label}: the removed stream dominates`).toBeGreaterThan(
				entry.nodes * 10
			);
			expect(entry.removed.bytes, `${label}: the removed stream dominates`).toBeGreaterThan(
				entry.bytes * 10
			);
		}
	});

	it('restores the model CONTENT from the captured geometry, with no captured copy to install', () => {
		const state = installedState('p23b-12-wall-target-curved-v1');
		const snapshot = captureLayoutPreviewSnapshot(state);
		const frozen = JSON.stringify(state.model);
		expect('model' in snapshot).toBe(false);
		// A foreign projection stands in for whatever the transient edit left behind.
		const foreign = projectLayoutPreviewModel(state.geometry);
		state.model = foreign;
		restoreLayoutPreviewSnapshot(state, snapshot);
		// The contract the removed clone used to carry is preserved by re-projection:
		// same CONTENT, a fresh object (the transient guard reads `project.layout` only).
		expect(JSON.stringify(state.model)).toBe(frozen);
		expect(state.model).not.toBe(foreign);
	});

	it('keeps the cadence: one capture per accepted commit and per gesture start, never per move', () => {
		const workspace = fs.readFileSync(
			path.resolve(here, '../../../src/lib/editor/app/PlanWorkspace.svelte'),
			'utf8'
		);
		// The commit path's capture is exactly the marked one.
		expect(workspace.split("p2311Measure('commit-capture', () => captureLayoutPreviewSnapshot(layoutPreview))").length - 1).toBe(1);
		const viewport = fs.readFileSync(
			path.resolve(here, '../../../src/lib/editor/layout/LayoutPlanViewport.svelte'),
			'utf8'
		);
		// In the ARCHITECTURE path (this slice's surface) the capture is the frozen
		// baseline at pointer-down only: one per gesture start, and none on the
		// per-move path. Other gestures capture their own baselines the same way.
		const functionBody = (name: string): string => {
			const start = viewport.indexOf(`\n\tfunction ${name}(`);
			expect(start, `${name} is declared`).toBeGreaterThanOrEqual(0);
			const end = viewport.indexOf('\n\tfunction ', start + 1);
			return viewport.slice(start, end === -1 ? undefined : end);
		};
		const occurrences = (text: string, needle: string): number => text.split(needle).length - 1;
		expect(occurrences(functionBody('beginArchitectureEditGesture'), 'captureLayoutPreviewSnapshot(preview)')).toBe(1);
		expect(occurrences(functionBody('previewArchitectureEdit'), 'captureLayoutPreviewSnapshot')).toBe(0);
		expect(occurrences(functionBody('finishArchitectureEditGesture'), 'captureLayoutPreviewSnapshot')).toBe(0);
	});
});

describe('P23B.7 S7 — the commit-capture residual: advisory node timing (not a gate)', () => {
	it('prints the paired A/B: the removed stream through the state proxy vs the shipped capture', { timeout: 120000 }, () => {
		const reactive = createProxyBackedLayoutPreviewState();
		expect(
			importLayoutPreviewJson(reactive, serializeWallFirstLayoutDocument(matrixFixture('p23b-40-wall-all-curved-v1')))
		).toBe(true);
		// This is the historical deep-proxy timing fixture only; client field-signal
		// reactivity is covered separately by the client-compiled consumer test.
		expect(isSvelteStateProxy(reactive.model), 'the compatibility model is proxied').toBe(true);
		const removed = streamOf(reactive.model);
		const shipped = clonedStreams(reactive, captureLayoutPreviewSnapshot(reactive));
		// BOUNDED reps: this is the one caller whose single call is six figures of
		// microseconds, and the timeout above is a ceiling, not a licence to burn the
		// runner's budget inside the full suite.
		const proxyReps = { warmups: 1, samples: 3 } as const;
		// THE REMOVED WORK, reproduced exactly as the capture did it: the same JSON
		// round-trip over the same proxied graph (S7's pre-fix pricing of it, p50
		// ~133 ms, is frozen in the record).
		const removedMs = advisoryP50(() => JSON.parse(JSON.stringify(reactive.model)), proxyReps);
		// THE SHIPPED WORK: the document and its issues — no derived model.
		const shippedMs = advisoryP50(() => captureLayoutPreviewSnapshot(reactive), proxyReps);
		console.log(
			`P23B.7 S7 capture attribution (node, single session, ADVISORY): the REMOVED ${removed.bytes}-byte / ${removed.nodes}-object model clone costs p50 ${removedMs} ms through the editor-style $state proxy, against p50 ${shippedMs} ms for the shipped capture (${shipped.bytes} bytes / ${shipped.nodes} objects: ${shipped.streams.map((entry) => entry.key).join(' + ')})`
		);
	});

	it('prints the per-stream advisory p50 so the record can cite it', { timeout: 120000 }, () => {
		const state = installedState('p23b-40-wall-all-curved-v1');
		const snapshot = captureLayoutPreviewSnapshot(state);
		const shipped = clonedStreams(state, snapshot);
		const removed = streamOf(state.model);
		const rows = [
			...shipped.streams.map((entry) => ({
				key: entry.key,
				bytes: entry.bytes,
				nodes: entry.nodes,
				removed: false,
				advisoryMs: advisoryP50(() =>
					JSON.parse(JSON.stringify((snapshot as unknown as Record<string, unknown>)[entry.key]))
				)
			})),
			{
				key: 'model',
				bytes: removed.bytes,
				nodes: removed.nodes,
				removed: true,
				advisoryMs: advisoryP50(() => JSON.parse(JSON.stringify(state.model)))
			}
		];
		const whole = advisoryP50(() => captureLayoutPreviewSnapshot(state));
		console.log(
			[
				'P23B.7 S7 capture attribution (node, single session, ADVISORY):',
				...rows.map(
					(row) =>
						`  ${row.removed ? `${row.key}*` : row.key} ${String(row.bytes).padStart(7)} bytes · ${String(row.nodes).padStart(6)} objects · p50 ${row.advisoryMs} ms${row.removed ? '  <- REMOVED: not captured, re-projected on restore' : '  (shipped: cloned)'}`
				),
				`  capture ${String(shipped.bytes).padStart(7)} bytes payload · p50 ${whole} ms end-to-end`,
				'  (browser numbers stay S6/S1: commit-capture 107-149 ms; never a gate)'
			].join('\n')
		);
		// The only assertion here is that the accounting exists and is non-empty; the
		// milliseconds above are ADVISORY and deliberately unasserted.
		expect(rows.some((row) => row.removed)).toBe(true);
		expect(shipped.bytes).toBeGreaterThan(0);
	});
});
