/**
 * P23B.7 S7 (targeted, per the §0.8.3 owner ruling) — WHAT THE `commit-capture`
 * RESIDUAL ACTUALLY IS.
 *
 * S6's capture left one measured, unaddressed cost on the accepted-edit path:
 * `commit-capture` (107–149 ms per accepted edit). This probe attributes it
 * WITHOUT another sweep. `captureLayoutPreviewSnapshot` hands `geometry` by
 * reference and deep-clones three streams through `cloneJson`
 * (`JSON.parse(JSON.stringify(...))`, the proxy-safe clone): the whole `project`
 * (layout + scene), the derived preview `model`, and `issues`.
 *
 * CLAIMS ARE TWO-KINDED, exactly as the measurement rules require:
 *   · DETERMINISTIC (asserted): the structure (which streams are cloned, which is
 *     shared by reference, and that a later live mutation cannot reach the
 *     snapshot), the payload sizes in bytes and nodes on the committed fixtures,
 *     and that the payload GROWS with the document; the cadence contract (one
 *     capture per accepted commit and per gesture start — never per pointermove).
 *   · ADVISORY (printed, never asserted): per-stream wall-clock in this single
 *     node session. The browser numbers stay S6's/S1's; no timing is a gate and
 *     no budget metric is added.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { serializeWallFirstLayoutDocument } from '@portfolio/layout-core';
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
	createReactiveLayoutPreviewState,
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

type StreamAccounting = { key: 'project' | 'model' | 'issues'; bytes: number; nodes: number };

function accountingOf(snapshot: LayoutPreviewSnapshot): StreamAccounting[] {
	const streams: StreamAccounting[] = [
		{ key: 'project', bytes: JSON.stringify(snapshot.project).length, nodes: countNodes(snapshot.project) },
		{ key: 'model', bytes: JSON.stringify(snapshot.model).length, nodes: countNodes(snapshot.model) },
		{ key: 'issues', bytes: JSON.stringify(snapshot.issues).length, nodes: countNodes(snapshot.issues) }
	];
	return streams;
}

function p50(samples: readonly number[]): number {
	const sorted = [...samples].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)]!;
}

/** Advisory only: this session's node wall-clock for one measured call. */
function advisoryP50(run: () => void): number {
	for (let index = 0; index < 3; index += 1) run();
	const samples: number[] = [];
	for (let index = 0; index < 9; index += 1) {
		const started = performance.now();
		run();
		samples.push(performance.now() - started);
	}
	return Number(p50(samples).toFixed(2));
}

describe('P23B.7 S7 — the commit-capture residual: what is cloned', () => {
	it('clones project, model and issues, and hands geometry by reference', () => {
		const state = installedState('p23b-40-wall-all-curved-v1');
		const snapshot = captureLayoutPreviewSnapshot(state);
		// The three deep-cloned streams describe the committed state but share nothing
		// with the live one...
		expect(snapshot.project).toEqual(state.project);
		expect(snapshot.model).toEqual(state.model);
		expect(snapshot.issues).toEqual(state.issues);
		expect(snapshot.project).not.toBe(state.project);
		expect(snapshot.model).not.toBe(state.model);
		expect(snapshot.issues).not.toBe(state.issues);
		// ...while geometry is the SAME object: the capture pays nothing for the
		// compiled geometry (the state-side identity the S6 fix keys the mesh cache on).
		expect(snapshot.geometry).toBe(state.geometry);
		// A live mutation after the capture cannot reach the snapshot: that is what the
		// JSON clone buys and why the capture cannot simply retain references.
		const before = JSON.stringify(snapshot.project);
		state.project.name = `${state.project.name} (mutated)`;
		expect(JSON.stringify(snapshot.project)).toBe(before);
	});

	it('accounts the payload in bytes and nodes, and it grows with the document', () => {
		const empty = accountingOf(captureLayoutPreviewSnapshot(installedState(null)));
		const small = accountingOf(captureLayoutPreviewSnapshot(installedState('p23b-12-wall-target-curved-v1')));
		const large = accountingOf(captureLayoutPreviewSnapshot(installedState('p23b-40-wall-all-curved-v1')));
		const straight = accountingOf(captureLayoutPreviewSnapshot(installedState('p23b-40-wall-straight-v1')));

		const totalBytes = (streams: StreamAccounting[]) => streams.reduce((sum, entry) => sum + entry.bytes, 0);
		const totalNodes = (streams: StreamAccounting[]) => streams.reduce((sum, entry) => sum + entry.nodes, 0);
		for (const [label, streams] of [
			['empty', empty],
			['12-wall', small],
			['40-wall curved', large],
			['40-wall straight', straight]
		] as const) {
			for (const entry of streams) {
				expect(entry.bytes, `${label}: ${entry.key} bytes`).toBeGreaterThanOrEqual(0);
				expect(entry.nodes, `${label}: ${entry.key} nodes`).toBeGreaterThanOrEqual(0);
			}
		}
		// Deterministic scaling: a richer document is a bigger capture, and the empty
		// boot is the smallest. (No fixed byte count is asserted — this is not a budget.)
		expect(totalBytes(small)).toBeGreaterThan(totalBytes(empty));
		expect(totalBytes(large)).toBeGreaterThan(totalBytes(small));
		expect(totalNodes(large)).toBeGreaterThan(totalNodes(empty));
		// THE MEASURED FINDING: the payload is dominated by the DERIVED PREVIEW MODEL,
		// not by the project document — and the next test pins that no production
		// reader installs the captured clone (restore re-projects the model from the
		// shared `geometry`).
		for (const [label, streams] of [
			['12-wall', small],
			['40-wall curved', large],
			['40-wall straight', straight]
		] as const) {
			const model = streams.find((entry) => entry.key === 'model')!;
			const others = streams.filter((entry) => entry.key !== 'model');
			expect(model.bytes, `${label}: the model dominates the bytes`).toBeGreaterThan(
				others.reduce((sum, entry) => sum + entry.bytes, 0)
			);
			expect(model.nodes, `${label}: the model dominates the nodes`).toBeGreaterThan(
				others.reduce((sum, entry) => sum + entry.nodes, 0)
			);
		}
	});

	it('restores a re-projected model, so the captured clone has no production reader', () => {
		const state = installedState('p23b-12-wall-target-curved-v1');
		const snapshot = captureLayoutPreviewSnapshot(state);
		restoreLayoutPreviewSnapshot(state, snapshot);
		// Same content, a DIFFERENT object: the restore re-projects from the shared
		// geometry instead of installing the captured copy (the transient guard reads
		// `project.layout` only).
		expect(state.model).toEqual(snapshot.model);
		expect(state.model).not.toBe(snapshot.model);
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
	it('attributes the browser gap: the same payload cloned through the editor state proxy', () => {
		const plain = installedState('p23b-40-wall-all-curved-v1');
		const reactive = createReactiveLayoutPreviewState();
		expect(
			importLayoutPreviewJson(reactive, serializeWallFirstLayoutDocument(matrixFixture('p23b-40-wall-all-curved-v1')))
		).toBe(true);
		// The harness precondition: the editor state really is reactive, and the
		// fixture state really is not — the S6 pin's own distinction.
		expect(isSvelteStateProxy(reactive.model), 'the live model is a state proxy').toBe(true);
		expect(isSvelteStateProxy(plain.model), 'the fixture model is plain').toBe(false);
		const plainModelBytes = accountingOf(captureLayoutPreviewSnapshot(plain)).find((entry) => entry.key === 'model')!.bytes;
		const reactiveModelBytes = accountingOf(captureLayoutPreviewSnapshot(reactive)).find((entry) => entry.key === 'model')!.bytes;
		// The SAME content and projected size is cloned either way: the difference is
		// not what the capture writes, it is the graph it reads through. (Advisory ms
		// below is printed, never asserted.)
		expect(reactiveModelBytes).toBe(plainModelBytes);
		const plainMs = advisoryP50(() => captureLayoutPreviewSnapshot(plain));
		const reactiveMs = advisoryP50(() => captureLayoutPreviewSnapshot(reactive));
		console.log(
			`P23B.7 S7 capture attribution (node, single session, ADVISORY): the same ${plainModelBytes}-byte model clone costs p50 ${plainMs} ms on a plain state and p50 ${reactiveMs} ms through the editor-style $state proxy`
		);
	});

	it('prints the per-stream advisory p50 so the record can cite it', () => {
		const state = installedState('p23b-40-wall-all-curved-v1');
		const snapshot = captureLayoutPreviewSnapshot(state);
		const rows = accountingOf(snapshot).map((entry) => ({
			stream: entry.key,
			bytes: entry.bytes,
			nodes: entry.nodes,
			advisoryMs: advisoryP50(() => JSON.parse(JSON.stringify((snapshot as never as Record<string, unknown>)[entry.key])))
		}));
		const whole = advisoryP50(() => captureLayoutPreviewSnapshot(state));
		const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
		console.log(
			[
				'P23B.7 S7 capture attribution (node, single session, ADVISORY):',
				...rows.map(
					(row) =>
						`  ${row.stream.padEnd(7)} ${String(row.bytes).padStart(7)} bytes · ${String(row.nodes).padStart(6)} nodes · p50 ${row.advisoryMs} ms (${((row.bytes / totalBytes) * 100).toFixed(1)}% of bytes)`
				),
				`  capture ${String(totalBytes).padStart(7)} bytes payload · p50 ${whole} ms end-to-end`,
				'  (browser numbers stay S6/S1: commit-capture 107-149 ms; never a gate)'
			].join('\n')
		);
		// The only assertion here is that the accounting exists and is non-empty; the
		// milliseconds above are ADVISORY and deliberately unasserted.
		expect(rows).toHaveLength(3);
		expect(totalBytes).toBeGreaterThan(0);
	});
});
