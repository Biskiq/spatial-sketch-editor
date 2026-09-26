/**
 * P23B.7 follow-up (review-time, owner-directed) — THE PERMANENT GUARD behind the
 * model-free capture fix.
 *
 * WHAT IT ENFORCES. S7 attributed `commit-capture`'s 107–149 ms to a JSON round-trip
 * over the DERIVED preview model — 3,412,257 of a 3,434,187-byte payload (99.4 %;
 * 39,106 of 39,746 objects) that no production reader ever installed, because a
 * restore re-projects the model from the `geometry` the snapshot already carries by
 * reference. The fix stops cloning it; this file makes sure it stays stopped:
 *
 *   1. RUNTIME PAYLOAD BOUND — a capture of the biggest committed fixture clones only
 *      document-sized streams, and no captured stream may come within an order of
 *      magnitude of the projection the capture used to clone. The bound is relative
 *      to the DOCUMENT and to that projection, never a fixed byte count: this is not
 *      a budget, adds no metric and writes no baseline.
 *   2. SOURCE CONTRACT — the snapshot type declares no `model` member, the capture
 *      clones none, the restore still re-projects from the captured geometry, and no
 *      production source reads `.model` off a snapshot-typed binding.
 *   3. THE DETECTOR IS SELF-TESTED — negative controls prove it flags re-introduced
 *      readers, and a non-vacuity assertion proves the scan recognises the production
 *      files that really do hold snapshots. A rotted pattern cannot pass forever.
 *
 * Why a source scan at all, when the member is gone: a type can grow the field back,
 * or a differently-named clone can be added beside it, without any behavioural test
 * noticing until the milliseconds return. This is the only check that fails at the
 * moment such a reader or clone is written.
 *
 * HONEST LIMITS. The scan is a NAME-BASED recogniser over raw source (comments and
 * strings included), so it can over-report — a comment mentioning `<binding>.model`
 * trips it, and a same-named local of another object type would too. Over-reporting
 * is the safe direction for a guard and the failure message names the file and the
 * expression, so the fix is a look, not a puzzle. Aliasing a snapshot to a new name
 * before reading it (`const alias = snapshot; alias.model`) is not detected; the
 * runtime members above are what make that shape pointless rather than undetectable.
 */
import { describe, expect, it } from 'vitest';

import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from '$lib/bench/p23b-fixtures';
import {
	captureLayoutPreviewSnapshot,
	createEmptyWallFirstLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewSnapshotMatchesLive,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';
import { serializeWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import {
	CAMERA_CORE_DIR,
	LIB_DIR,
	ROUTES_DIR,
	VISITOR_ROUTES_DIR,
	readLibSource,
	readSourceTree
} from '../../../helpers/lib-source';

const FIXTURE_ID = 'p23b-40-wall-all-curved-v1';

/** The committed fixture, as the app imports it. */
function fixtureJson(id: string): string {
	const spec = P23B_MATRIX_SPECS.find((entry) => entry.id === id);
	if (!spec) throw new Error(`unknown fixture ${id}`);
	return serializeWallFirstLayoutDocument(buildP23BMatrixFixture(spec));
}

function installedState(id: string): LayoutPreviewState {
	const state = createEmptyWallFirstLayoutPreviewState();
	expect(importLayoutPreviewJson(state, fixtureJson(id)), `${id} installs`).toBe(true);
	return state;
}

/** Object/array count of one JSON stream — the clone's work unit, size-independent. */
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

/**
 * The streams a capture actually CLONED, discovered rather than declared: every
 * captured value that is an object and is not the state's own object. `geometry` is
 * excluded by identity (handed by reference), primitives carry no clone cost, and a
 * re-introduced clone — under that name or any other — lands in this list.
 */
function clonedStreams(
	state: LayoutPreviewState,
	snapshot: object
): { key: string; nodes: number; bytes: number }[] {
	const owner = state as unknown as Record<string, unknown>;
	return Object.entries(snapshot)
		.filter(([key, value]) => value !== null && typeof value === 'object' && value !== owner[key])
		.map(([key, value]) => ({ key, nodes: countNodes(value), bytes: JSON.stringify(value).length }));
}

/** Slice one declaration out of a source file, asserting the start marker exists. */
function slice(source: string, start: string, end: string | null): string {
	const from = source.indexOf(start);
	expect(from, `${start} is present`).toBeGreaterThanOrEqual(0);
	const to = end === null ? -1 : source.indexOf(end, from + start.length);
	return source.slice(from, to === -1 ? source.length : to);
}

/**
 * The bindings in one source file that hold a `LayoutPreviewSnapshot`: declared with
 * the type, produced by a capture, or cast from one. `capturedModelReads` is only as
 * sharp as this recogniser — hence the non-vacuity assertion in the scan below, which
 * runs it against the production files that really do hold snapshots.
 */
function snapshotBindings(source: string): string[] {
	const names = new Set<string>();
	const collect = (pattern: RegExp): void => {
		for (const match of source.matchAll(pattern)) names.add(match[1]!);
	};
	// `function restore(preview: LayoutPreviewState, snapshot: LayoutPreviewSnapshot)`
	collect(/\b([A-Za-z_$][\w$]*)\s*:\s*LayoutPreviewSnapshot\b/g);
	// `let dragSnapshot = $state<LayoutPreviewSnapshot | null>(null)`
	collect(/\b([A-Za-z_$][\w$]*)\s*=\s*\$state<\s*LayoutPreviewSnapshot\b/g);
	// `const snapshot = captureLayoutPreviewSnapshot(preview)`
	collect(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*captureLayoutPreviewSnapshot\s*\(/g);
	// `const typed = snapshot as ReturnType<typeof captureLayoutPreviewSnapshot>` — the
	// host callbacks in EditorApp/MuseumEditorApp type their `snapshot` by CONTEXT, so
	// this cast (and its name) is the only binding they have. The lookahead, not `\b`,
	// is what terminates the pattern: the match ends on `>`.
	collect(
		/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[A-Za-z_$][\w$]*\s+as\s+(?:ReturnType<typeof captureLayoutPreviewSnapshot>|LayoutPreviewSnapshot)(?![A-Za-z0-9_$])/g
	);
	return [...names];
}

/** Reads of a snapshot binding's derived `model` — what the fix must keep absent. */
function capturedModelReads(source: string): string[] {
	const names = snapshotBindings(source);
	const reads: string[] = [];
	for (const name of names) {
		const escaped = name.replace(/\$/g, '\\$');
		for (const pattern of [
			new RegExp(`\\b${escaped}\\s*\\??\\.\\s*model\\b`, 'g'),
			new RegExp(`\\b${escaped}\\s*\\??\\[\\s*['"]model['"]\\s*\\]`, 'g')
		]) {
			for (const match of source.matchAll(pattern)) reads.push(match[0]);
		}
	}
	// A destructured read never mentions the binding: `const { model } = snapshot`, or
	// straight off the capture, where no binding name exists at all.
	const right = [...names, 'captureLayoutPreviewSnapshot\\s*\\([^)]*\\)'].join('|');
	const destructured = new RegExp(`\\{[^}]*\\bmodel\\b[^}]*\\}\\s*=\\s*(?:${right})`, 'g');
	for (const match of source.matchAll(destructured)) reads.push(match[0]);
	return reads;
}

describe('P23B.7 follow-up — the capture stays model-free', () => {
	it('captures a document-sized payload: no stream approaches the removed projection', () => {
		const state = installedState(FIXTURE_ID);
		const snapshot = captureLayoutPreviewSnapshot(state);
		const modelNodes = countNodes(state.model);
		const projectNodes = countNodes(snapshot.project);
		// Non-vacuity: on this fixture the removed stream really is an order of
		// magnitude bigger than the document, or the bound below proves nothing.
		expect(modelNodes, 'the removed stream dominates the document').toBeGreaterThan(projectNodes * 10);
		// The derived model is not a member at all...
		expect('model' in snapshot).toBe(false);
		// ...and the identity guard still decides from what IS captured.
		expect(layoutPreviewSnapshotMatchesLive(state, snapshot)).toBe(true);
		// No captured stream can smuggle a projection back in, whatever it is called:
		// every one of them stays an order of magnitude below the removed stream.
		const streams = clonedStreams(state, snapshot);
		expect(streams.length, 'the capture clones something').toBeGreaterThan(0);
		for (const stream of streams) {
			expect(stream.nodes, `captured stream '${stream.key}'`).toBeLessThan(modelNodes / 10);
		}
		// The bound in the document's own terms — never a fixed byte count, no budget:
		// the whole cloned payload is a small multiple of the authored document.
		const payloadNodes = streams.reduce((sum, entry) => sum + entry.nodes, 0);
		expect(payloadNodes, 'the payload stays document-sized').toBeLessThan(projectNodes * 4);
	});

	it('keeps the source contract: no model member, no clone, and the restore re-projects', () => {
		const source = readLibSource('editor/layout/layout-preview-state.svelte.ts');
		// The type: no `model` member.
		expect(slice(source, 'export type LayoutPreviewSnapshot = {', '\n};')).not.toMatch(/\bmodel\s*:/);
		// The capture: no model key to clone (its own suite already pins no writes).
		const capture = slice(source, 'export function captureLayoutPreviewSnapshot(', '\nexport function ');
		expect(capture, 'the capture clones no model').not.toMatch(/\bmodel\s*:/);
		// The restore: the re-projection is what makes the absence safe.
		expect(slice(source, 'function restoreLayoutPreviewSnapshotUnmeasured(', null)).toContain(
			'projectLayoutPreviewModel(snapshot.geometry)'
		);
	});

	it('finds no production reader of a captured model, and recognises the real consumers', () => {
		const production = [LIB_DIR, ROUTES_DIR, VISITOR_ROUTES_DIR, CAMERA_CORE_DIR].flatMap((root) =>
			readSourceTree(root)
		);
		// The population floor: a broken root or a broken walker must not be able to
		// turn this scan into a silent pass.
		expect(production.length, 'the scan has a population').toBeGreaterThan(300);
		const carriers = production
			.filter((file) => snapshotBindings(file.source).length > 0)
			.map((file) => file.path);
		for (const expected of [
			'layout-transient-edit.ts',
			'LayoutPlanViewport.svelte',
			'EditorApp.svelte',
			'MuseumEditorApp.svelte'
		]) {
			expect(
				carriers.some((filePath) => filePath.endsWith(expected)),
				`the scan recognises ${expected}`
			).toBe(true);
		}
		const offenders = production.flatMap((file) =>
			capturedModelReads(file.source).map((read) => `${file.path}: ${read}`)
		);
		expect(offenders, 'no production source reads a captured model').toEqual([]);
	});

	it('would flag a re-introduced reader, so the guard cannot rot into a no-op', () => {
		const flagged = [
			'const snapshot = captureLayoutPreviewSnapshot(preview);\nreturn snapshot.model.rooms.length;',
			'function restore(snapshot: LayoutPreviewSnapshot) { return snapshot?.model.rooms; }',
			'const typed = snapshot as ReturnType<typeof captureLayoutPreviewSnapshot>;\nreturn typed.model;',
			'let dragSnapshot = $state<LayoutPreviewSnapshot | null>(null);\nreturn dragSnapshot["model"];',
			'const { model } = captureLayoutPreviewSnapshot(preview);'
		];
		for (const source of flagged) {
			expect(capturedModelReads(source), source).not.toHaveLength(0);
		}
		const clean = [
			'const snapshot = captureLayoutPreviewSnapshot(preview);\nreturn snapshot.project.layout;',
			'const snapshot = captureLayoutPreviewSnapshot(preview);\nreturn projectLayoutPreviewModel(snapshot.geometry);',
			'const model = projectLayoutPreviewModel(state.geometry);\nreturn model.rooms;'
		];
		for (const source of clean) {
			expect(capturedModelReads(source), source).toHaveLength(0);
		}
	});
});
