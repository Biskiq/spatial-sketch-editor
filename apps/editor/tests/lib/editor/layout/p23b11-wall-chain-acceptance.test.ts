/**
 * P23B.11 S6 — OR-5: the wall-chain commit installs the compile its own plan
 * already accepted (M-4).
 *
 * WHAT M-4 IS. `planWallChain` compiles its committed candidate ONCE, at the
 * final canonical gate, to prove it does not block. The editor then derived the
 * preview bundle for the SAME document by compiling it a second time. M-4 carries
 * that gate's own result on the successful `WallChainPlan` (`acceptance`, the
 * existing `WallFirstAcceptanceCompile` shape) and hands it to
 * `deriveInstallBundle` from `commitWallChain` / `commitWallSegment` — the
 * wall-chain analogue of the contract the precise path already uses.
 *
 * WHAT THIS FILE PROVES (the plan's OR-5, and §7's deterministic row (iv)):
 *
 *   1. EQUALITY — the acceptance the plan carries equals a fresh compile of the
 *      committed document: canonical JSON, geometry and issues.
 *   2. THE INSTALL PATH — after `commitWallChain` / `commitWallSegment` the
 *      install observed `preview-compile-reused` exactly once and
 *      `preview-compile` zero times, so the accepted compile is installed rather
 *      than repeated: per accepted boundary chain the compile count is 1 (the
 *      plan's canonical gate), where it was 2 before M-4.
 *   3. THE FALLBACK — a re-parsed document that DIFFERS from the accepted one must
 *      not reuse anything: the existing canonical-JSON guard
 *      (`reusesAcceptedCompile`) is exercised, not weakened or bypassed, and the
 *      install still produces exactly what a from-scratch derive produces.
 *
 * The installed state is compared against a from-scratch derive of the committed
 * document (geometry, model, issues, bounds), never against a wall-clock budget,
 * so the suite cannot become flaky. The reused compile rides the SHIPPED
 * DEV + `__P2311_PERF__` gate, so nothing here reaches production.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	planWallSegment,
	serializeWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import {
	commitWallChain,
	commitWallSegment,
	createEmptyLayoutPreviewState,
	derivePreviewBundle,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';

// ---------------------------------------------------------------------------
// measurement plumbing (the same marks the browser harness reads)
// ---------------------------------------------------------------------------

const PREFIX = 'p2311:';

function recordedStages(): Map<string, number[]> {
	const byName = new Map<string, number[]>();
	for (const entry of performance.getEntriesByType('measure')) {
		if (!entry.name.startsWith(PREFIX)) continue;
		const key = entry.name.slice(PREFIX.length);
		const values = byName.get(key);
		if (values) values.push(entry.duration);
		else byName.set(key, [entry.duration]);
	}
	return byName;
}

function stageCount(name: string): number {
	return recordedStages().get(name)?.length ?? 0;
}

function resetWindow(): void {
	performance.clearMarks();
	performance.clearMeasures();
}

beforeAll(() => {
	(globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__ = true;
});

afterAll(() => {
	(globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__ = false;
});

// ---------------------------------------------------------------------------
// fixtures (the same wall-first preview state the commit suite uses)
// ---------------------------------------------------------------------------

function wallFirstPreviewState(): LayoutPreviewState {
	const state = createEmptyLayoutPreviewState();
	const document = createEmptyWallFirstLayoutDocument();
	document.floor = { id: 'floor-1', name: 'Floor 1', elevation: 0 };
	if (!importLayoutPreviewJson(state, serializeWallFirstLayoutDocument(document))) {
		throw new Error(`wall-first import failed: ${state.importError ?? 'unknown'}`);
	}
	return state;
}

function wallFirstDocument(state: LayoutPreviewState): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(state);
	if (!('formatVersion' in document)) throw new Error('expected a wall-first document');
	return document as unknown as LayoutDocumentWallFirst;
}

/** The document argument `derivePreviewBundle` accepts, without a cast per call. */
function asDeriveDocument(document: LayoutDocumentWallFirst): Parameters<typeof derivePreviewBundle>[2] {
	return document as unknown as Parameters<typeof derivePreviewBundle>[2];
}

function cloneDocument(document: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
	return JSON.parse(JSON.stringify(document)) as LayoutDocumentWallFirst;
}

/** One closed boundary square, the chain every row below commits. */
const SQUARE: LayoutVec2[] = [
	[0, 0],
	[4, 0],
	[4, 3],
	[0, 3]
];

// ---------------------------------------------------------------------------
// 1. the plan carries what its canonical gate compiled
// ---------------------------------------------------------------------------

describe('P23B.11 OR-5 — the plan carries the compile its canonical gate made', () => {
	it('the chain plan and the segment plan each carry an acceptance equal to a fresh compile', () => {
		const baseline = wallFirstDocument(wallFirstPreviewState());
		const chain = planWallChain({ baseline, points: SQUARE, close: true, role: 'boundary' });
		if (chain.kind !== 'success') throw new Error(`chain rejected: ${chain.rejection.code}`);
		const segment = planWallSegment({ baseline, start: [0, 0], end: [4, 0], role: 'boundary' });
		if (segment.kind !== 'success') throw new Error(`segment rejected: ${segment.rejection.code}`);

		for (const [label, plan] of [
			['closed boundary chain', chain],
			['single boundary segment', segment]
		] as const) {
			// The canonical JSON the plan's own validation produced IS the
			// serialization the install guard compares against — not a copy that
			// happens to serialize the same today.
			expect(plan.acceptance.documentJson, `${label} canonical JSON`).toBe(
				serializeWallFirstLayoutDocument(plan.document)
			);
			const fresh = compileWallFirstLayoutGeometry(plan.document);
			expect(fresh.issues, `${label} fresh compile blocks`).toEqual([]);
			expect(JSON.stringify(plan.acceptance.geometry), `${label} geometry`).toBe(
				JSON.stringify(fresh.geometry)
			);
			expect(JSON.stringify(plan.acceptance.issues), `${label} issues`).toBe(
				JSON.stringify(fresh.issues)
			);
		}
	});
});

// ---------------------------------------------------------------------------
// 2. both commit paths install it instead of compiling again
// ---------------------------------------------------------------------------

describe('P23B.11 OR-5 — both commit paths install the accepted compile', () => {
	it('a committed boundary chain reuses its plan compile once and never compiles again', () => {
		const state = wallFirstPreviewState();
		resetWindow();
		const result = commitWallChain(state, SQUARE, 'boundary', { close: true });
		expect(result.success).toBe(true);
		if (!result.success || result.operation !== 'wall-chain-commit') throw new Error('chain commit failed');

		// §7(iv): ONE compile per accepted boundary chain — the plan's canonical
		// gate — and none at install. Before M-4 this row was two.
		expect(stageCount('chain-canonical-gates'), 'plan compiles').toBe(1);
		expect(stageCount('preview-compile-reused'), 'install reused').toBe(1);
		expect(stageCount('preview-compile'), 'install recompiled').toBe(0);

		// The installed state is exactly what a from-scratch derive of the
		// committed document produces.
		const control = derivePreviewBundle(
			state.project.id,
			state.project.name,
			layoutPreviewDocument(state),
			state.project.scene
		);
		expect(JSON.stringify(state.geometry), 'geometry').toBe(JSON.stringify(control.geometry));
		expect(JSON.stringify(state.model), 'model').toBe(JSON.stringify(control.model));
		expect(JSON.stringify(state.issues), 'issues').toBe(JSON.stringify(control.issues));
		expect(state.bounds, 'bounds').toEqual(control.bounds);
	});

	it('a committed segment reuses too, and a rejected chain installs nothing at all', () => {
		const segmentState = wallFirstPreviewState();
		resetWindow();
		const segment = commitWallSegment(segmentState, [0, 0], [4, 0], 'boundary');
		expect(segment.success).toBe(true);
		expect(stageCount('chain-canonical-gates'), 'plan compiles').toBe(1);
		expect(stageCount('preview-compile-reused'), 'install reused').toBe(1);
		expect(stageCount('preview-compile'), 'install recompiled').toBe(0);

		// Rejection still installs nothing — and with M-4 that means the whole
		// commit path runs no install compile and no install boundary at all.
		const rejectedState = wallFirstPreviewState();
		const before = serializeWallFirstLayoutDocument(wallFirstDocument(rejectedState));
		resetWindow();
		const rejected = commitWallChain(rejectedState, [[0, 0], [4, 0], [2, 0]], 'boundary', {
			close: false
		});
		expect(rejected.success).toBe(false);
		expect(serializeWallFirstLayoutDocument(wallFirstDocument(rejectedState))).toBe(before);
		expect(stageCount('wall-chain-commit-install'), 'install boundary ran').toBe(0);
		expect(stageCount('preview-compile-reused') + stageCount('preview-compile'), 'installs ran').toBe(0);
	});
});

// ---------------------------------------------------------------------------
// 3. the guard still refuses a document acceptance did not prove
// ---------------------------------------------------------------------------

describe('P23B.11 OR-5 — the canonical-JSON guard still refuses a differing document', () => {
	it('falls back to the ordinary compile, and the accepted document still reuses exactly', () => {
		const state = wallFirstPreviewState();
		const plan = planWallChain({
			baseline: wallFirstDocument(state),
			points: SQUARE,
			close: true,
			role: 'boundary'
		});
		if (plan.kind !== 'success') throw new Error('chain rejected');
		const acceptance = plan.acceptance;

		// A REAL payload for a DIFFERENT document: the same chain with one Wall's
		// thickness changed, so the guard must not admit the acceptance's geometry.
		const other = cloneDocument(plan.document);
		other.walls = other.walls.map((wall, index) =>
			index === 0 ? { ...wall, thickness: wall.thickness + 0.05 } : wall
		);

		resetWindow();
		const mismatched = derivePreviewBundle(
			state.project.id,
			state.project.name,
			asDeriveDocument(other),
			state.project.scene,
			acceptance
		);
		expect(stageCount('preview-compile-reused'), 'reused anyway').toBe(0);
		expect(stageCount('preview-compile'), 'fallback compile').toBe(1);

		// ...and it installed the OTHER document's geometry, not the payload's.
		const control = derivePreviewBundle(
			state.project.id,
			state.project.name,
			asDeriveDocument(other),
			state.project.scene
		);
		expect(JSON.stringify(mismatched.geometry), 'fallback geometry').toBe(
			JSON.stringify(control.geometry)
		);
		expect(JSON.stringify(mismatched.geometry), 'installed the payload geometry').not.toBe(
			JSON.stringify(acceptance.geometry)
		);

		// The document the payload was accepted for still reuses its exact compile.
		resetWindow();
		const matched = derivePreviewBundle(
			state.project.id,
			state.project.name,
			asDeriveDocument(plan.document),
			state.project.scene,
			acceptance
		);
		expect(stageCount('preview-compile-reused'), 'accepted document did not reuse').toBe(1);
		expect(stageCount('preview-compile'), 'accepted document recompiled').toBe(0);
		expect(matched.geometry, 'reused object').toBe(acceptance.geometry);
	});
});
