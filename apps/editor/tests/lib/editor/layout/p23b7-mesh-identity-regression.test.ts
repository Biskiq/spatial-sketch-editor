/**
 * P23B.7 S6 / P23B.6 S-R — the reactive commit-path mesh identity oracle.
 *
 * THE DEFECT. Before S-R, every accepted edit built the full Wall-mesh set TWICE:
 * once inside `plan-apply`, then again inside `commit-replace`'s restore. The
 * outer Svelte `$state` graph deep-proxied compiled geometry, so capture handed
 * restore an identity different from the one the install cached. S-R keeps
 * geometry raw behind a reactive field signal, so install and capture naturally
 * share the cache key.
 *
 * THE ORACLE. This test drives the PRODUCTION seams on a `$state`-backed preview
 * state (`p23b7-reactive-preview-state.ts`) and counts mesh builds on the interval
 * the plan pins:
 *
 * ```text
 * fixture initialization          WARM-UP, outside the count
 * beginLayoutTransaction()        the pointer-down bracket
 * the accepted edit's install     install → one build of the new compile
 * capture + history commit        restore → cache hit, still ONE total build
 * the between-action restore      counted SEPARATELY, must be ZERO (it already hit)
 * ```
 *
 * The between-action restore is deliberately NOT folded into the same interval;
 * it has its own zero-build assertion.
 *
 * WHY THE EXISTING PLAIN-STATE TEST IS NOT THIS GATE. `layout-transient-preview`
 * pins the cache's identity semantics on a plain object and observes the restore
 * HITTING, because a plain state reads the compile's own object back. It passes
 * while the shipped app rebuilds twice, so it is a semantics pin, never this
 * proof. `$state.snapshot` is likewise not a substitute: it deep-clones, which
 * destroys the identity the cache is keyed on.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { proxy } from 'svelte/internal/client';

import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { serializeWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from '$lib/bench/p23b-fixtures';
import {
	p2311MeshIdentityRecords,
	p2311ResetMeshIdentity,
	type P23BMeshIdentityRecord
} from '$lib/editor/layout/p23b-mesh-identity';
import { getPreparedWallMeshes } from '$lib/editor/layout/prepared-wall-meshes';
import {
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';
import {
	createClientReactiveLayoutPreviewState,
	createProxyBackedLayoutPreviewState,
	loadClientCompiledPreviewModule,
	isSvelteStateProxy,
	type ClientPreviewRuntime
} from './p23b7-reactive-preview-state';

const FIXTURE_ID = 'p23b-12-wall-target-curved-v1';
const PREFIX = 'p2311:';

/** The committed fixture, as the app imports it. */
function fixtureJson(): string {
	const spec = P23B_MATRIX_SPECS.find((entry) => entry.id === FIXTURE_ID);
	if (!spec) throw new Error(`unknown fixture ${FIXTURE_ID}`);
	return serializeWallFirstLayoutDocument(buildP23BMatrixFixture(spec));
}

/** The accepted edit every count is measured across: a rigid move of one Wall. */
const EDIT_WALL = 'room-0:wall-0';
const EDIT_DELTA = [0, 1] as const;

type Harness = {
	store: ReturnType<typeof createEditorStore>;
	preview: LayoutPreviewState;
	runtime: ClientPreviewRuntime;
	/** The authored canonical JSON before the edit, for the undo/redo content claim. */
	before: string;
	/** The authored canonical JSON the accepted edit installs. */
	after: string;
};

async function harness(proxyBacked = false): Promise<Harness> {
	const runtime = await loadClientCompiledPreviewModule();
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const preview = proxyBacked
		? createProxyBackedLayoutPreviewState()
		: await createClientReactiveLayoutPreviewState();
	if (!runtime.importLayoutPreviewJson(preview, fixtureJson())) throw new Error('fixture import failed');
	store.registerLayoutHistory({
		capture: () => runtime.captureLayoutPreviewSnapshot(preview),
		replace: (snapshot) => runtime.restoreLayoutPreviewSnapshot(preview, snapshot as never),
		matches: (a, b) =>
			JSON.stringify((a as { project: { layout: unknown } }).project.layout) ===
			JSON.stringify((b as { project: { layout: unknown } }).project.layout)
	});
	store.setLayoutFormatPolicySource(() => preview);
	const before = runtime.layoutPreviewAuthoredJson(preview);
	return { store, preview, runtime, before, after: before };
}

/**
 * Drive the pinned interval for one accepted edit: the pointer-down bracket, the
 * accepted edit's install, the capture and the history commit. Returns the
 * authored JSON the edit committed.
 */
function acceptedEdit(input: Harness): Harness {
	expect(input.store.beginLayoutTransaction(), 'the pointer-down bracket opens').toBe(true);
	const applied = input.runtime.updateWallFirstWallMove(
		input.preview,
		EDIT_WALL,
		[EDIT_DELTA[0], EDIT_DELTA[1]]
	);
	expect(applied.success, `the accepted edit installs: ${applied.success ? '' : applied.message}`).toBe(
		true
	);
	const snapshot = input.runtime.captureLayoutPreviewSnapshot(input.preview);
	expect(input.store.commitLayoutTransaction(snapshot), 'the history commit installs').toBe(true);
	return { ...input, after: input.runtime.layoutPreviewAuthoredJson(input.preview) };
}

/** Fresh `mesh-prebuild` measures — one whole-generation preparation per miss. */
function buildMeasures(): number {
	return performance.getEntriesByType('measure').filter((entry) => entry.name === `${PREFIX}mesh-prebuild`).length;
}

/** Misses and hits from the DEV identity probe — the same instrument as the pin. */
function meshIdentity(
	records: readonly P23BMeshIdentityRecord[] = p2311MeshIdentityRecords()
): { misses: P23BMeshIdentityRecord[]; hits: P23BMeshIdentityRecord[] } {
	return {
		misses: records.filter((record) => record.phase === 'prebuild-miss'),
		hits: records.filter((record) => record.phase === 'prebuild-hit')
	};
}

beforeAll(() => {
	(globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__ = true;
});

afterAll(() => {
	(globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__ = false;
});

beforeEach(() => {
	performance.clearMarks();
	performance.clearMeasures();
	p2311ResetMeshIdentity();
});

describe('P23B.7 S6 — compiled values stay raw inside the reactive preview state', () => {
	it('keeps the preview reactive while capture preserves the raw geometry identity', async () => {
		const { preview } = await harness();
		// The preview root is a client proxy, but the client-compiled raw-field
		// accessors keep the compiled model and geometry as their original values.
		expect(isSvelteStateProxy(preview), 'the preview state is a $state proxy').toBe(true);
		expect(isSvelteStateProxy(preview.geometry), 'compiled geometry stays raw').toBe(false);
		expect(isSvelteStateProxy(preview.model), 'the projected model stays raw').toBe(false);
		const runtime = await loadClientCompiledPreviewModule();
		expect(
			runtime.captureLayoutPreviewSnapshot(preview).geometry,
			'a capture keeps that identity'
		).toBe(preview.geometry);
	});

	it('records the same installed and captured identity (the pin, in-process)', async () => {
		const input = await harness();
		const mark = p2311MeshIdentityRecords().length;
		acceptedEdit(input);
		const records = p2311MeshIdentityRecords().slice(mark);
		const install = [...records]
			.reverse()
			.find((record) => record.phase === 'install-bundle' || record.phase === 'install');
		const capture = [...records].reverse().find((record) => record.phase === 'capture');
		expect(install?.geometryId, 'the install records the identity it cached').not.toBeNull();
		expect(capture?.geometryId, 'the capture records the identity it hands the restore').not.toBeNull();
		expect(capture!.geometryId, 'capture hands restore the installed raw geometry').toBe(
			install!.geometryId
		);
		expect(capture!.sameAsInstall).toBe(true);
	});

	it('rebuilds if a caller supplies an unrelated proxied geometry identity', async () => {
		const { preview, runtime } = await harness();
		const snapshot = runtime.captureLayoutPreviewSnapshot(preview);
		const forcedProxy = proxy(snapshot.geometry);
		const before = buildMeasures();
		runtime.restoreLayoutPreviewSnapshot(preview, { ...snapshot, geometry: forcedProxy });
		expect(buildMeasures() - before, 'a proxy identity cannot reuse the raw-keyed meshes').toBe(1);
	});

	it('maps proxy-backed installs through capture and commit to the original compile cache key', async () => {
		const input = await harness(true);
		expect(
			isSvelteStateProxy(input.preview.geometry),
			'the legacy geometry field is proxied'
		).toBe(true);
		const warmUp = buildMeasures();
		const probeMark = p2311MeshIdentityRecords().length;

		acceptedEdit(input);

		const builds = buildMeasures() - warmUp;
		const interval = p2311MeshIdentityRecords().slice(probeMark);
		const { misses, hits } = meshIdentity(interval);
		expect(builds, 'the proxy-backed commit restores the installed cache entry').toBe(1);
		expect(misses, 'the accepted install is the only build miss').toHaveLength(1);
		expect(hits, 'capture/commit resolves the proxy back to the installed compile').toHaveLength(1);
	});
});

describe('P23B.7 S6 — one mesh build per accepted edit, zero on the between-action restore', () => {
	it('moves the compiled geometry through the production seams in one pass', async () => {
		const input = await harness();
		const warmUp = buildMeasures();
		expect(warmUp, 'fixture initialization is outside the count').toBeGreaterThan(0);

		const probeMark = p2311MeshIdentityRecords().length;
		const measured = acceptedEdit(input);

		// PINNED INTERVAL: before the accepted edit's install through the commit.
		const builds = buildMeasures() - warmUp;
		const interval = p2311MeshIdentityRecords().slice(probeMark);
		const { misses, hits } = meshIdentity(interval);
		// The commit's own capture is the LAST one in the interval (the first is the
		// pointer-down bracket's pre-edit snapshot), and the restore follows it.
		const capture = [...interval].reverse().find((record) => record.phase === 'capture')!;
		const restore = interval.find((record) => record.phase === 'restore')!;
		expect(builds, 'an accepted edit builds the wall-mesh set ONCE').toBe(1);
		const prepared = getPreparedWallMeshes(measured.preview.geometry);
		expect(prepared, 'the one measured call prepared the installed generation').toBeDefined();
		expect(
			prepared!.stats.reused,
			'per-Wall mesh reuse happens inside the one full-generation preparation'
		).toBeGreaterThan(0);
		expect(misses.length, 'exactly one cache miss in the interval, and it is the install').toBe(1);
		expect(misses[0]?.sameAsInstall, 'the miss is the install caching its own compile').toBe(true);
		expect(hits.length, 'the commit restore HITS the meshes the install cached').toBe(1);
		expect(restore.geometryId, 'the restore is handed the capture identity').toBe(capture.geometryId);
		expect(hits[0]?.geometryId, 'the hit is the identity the restore handed over').toBe(
			restore.geometryId
		);
		// S-R keeps geometry raw at the reactive field boundary, so capture and
		// install now naturally hand the same identity to the cache.
		expect(capture.sameAsInstall, 'capture reads the installed geometry identity').toBe(true);

		// SEPARATELY COUNTED: the between-action restore, which already hits today.
		const settled = buildMeasures();
		measured.runtime.restoreLayoutPreviewSnapshot(
			measured.preview,
			measured.runtime.captureLayoutPreviewSnapshot(measured.preview)
		);
		expect(buildMeasures() - settled, 'a between-action restore builds nothing').toBe(0);
	});

	it('keeps undo and redo content identical across the fixed commit path', async () => {
		const input = acceptedEdit(await harness());
		expect(input.after, 'the accepted edit changed the document').not.toBe(input.before);

		input.store.undo();
		expect(
			input.runtime.layoutPreviewAuthoredJson(input.preview),
			'undo restores the pre-edit document'
		).toBe(
			input.before
		);
		input.store.redo();
		expect(
			input.runtime.layoutPreviewAuthoredJson(input.preview),
			'redo reinstates the committed document'
		).toBe(
			input.after
		);
	});
});
