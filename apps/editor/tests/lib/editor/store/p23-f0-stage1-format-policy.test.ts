/**
 * P23.0 F0 stage 1 — exhaustive document-format dual-dispatch architecture
 * test + the central guard's behavioral contract.
 *
 * Plan rule (P23.0 "Editor-adapter cutover before writer enable" + the
 * execution-order addendum): every editor mutation entry point must be
 * adapted / read-only / explicitly disabled per document format, the guard
 * placement is CENTRAL DISPATCH by default, and the inventory is pinned by
 * an architecture test that fails when any mutator ships unclassified.
 *
 * The central seam: every authoring mutation is bracketed by exactly one of
 * `beginLayoutTransaction` (layout domain) or `beginDocumentTransaction` /
 * `beginCameraFramingTransaction` (scene/camera domain) on the `EditorStore`
 * facade, and each of those consults the policy table in
 * `document-format-policy.svelte.ts` before opening the transaction.
 *
 * The scans below are intentionally mechanical:
 * 1. every file that CALLS a transaction method must be in the reviewed
 *    guarded-family inventory (else a mutator may bypass the format guard);
 * 2. every file with a DIRECT document-array write must be on the reviewed
 *    exception list with a named reason (else it may write outside the
 *    transaction bracket);
 * 3. the facade's begin AND commit methods must textually consult the
 *    policy (the commit re-check closes the mid-transaction swap hazard).
 *
 * Scope note (F0 review): scan 2 covers structural collection writes
 * (assignment + mutating array methods). Scalar field writes
 * (`node.position = …`) match no pattern — they are covered instead by
 * scan 1: every bracket that could host them opens through the guarded
 * facade, and the commit re-checks above refuse a swapped format.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFixtureEditorStore } from '../editor-test-utils';
import { chopinProject } from '$lib/content/chopin-project';
import {
	classifyLayoutFormat,
	classifySceneFormat,
	isMutationAllowed,
	LAYOUT_MUTATION_POLICY,
	LAYOUT_MUTATION_REASONS,
	SCENE_MUTATION_POLICY,
	SCENE_MUTATION_REASONS,
	layoutMutationClassFor,
	sceneMutationClassFor
} from '$lib/editor/store/document-format-policy.svelte';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-wall-first-codec';

const EDITOR_SRC_LIB = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'..',
	'src',
	'lib'
);

/** Recursively list .ts/.svelte source files under `root` (posix-relative). */
function walkSourceFiles(root: string): string[] {
	const out: string[] = [];
	const visit = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				visit(full);
				continue;
			}
			if ((entry.name.endsWith('.ts') || entry.name.endsWith('.svelte')) && !entry.name.endsWith('.d.ts')) {
				out.push(full);
			}
		}
	};
	visit(root);
	return out.sort();
}

const ALL_SOURCE_FILES = walkSourceFiles(EDITOR_SRC_LIB);

/** Files that CALL a document-transaction method on the store/facade. */
const TRANSACTION_CALL_PATTERN =
	/\.(beginLayoutTransaction|commitLayoutTransaction|cancelLayoutTransaction|beginDocumentTransaction|commitDocumentTransaction|cancelDocumentTransaction|beginCameraFramingTransaction)\(/;

/**
 * The reviewed guarded-family inventory: files allowed to reference the
 * transaction surface. Every entry routes through the facade methods that
 * consult the central format policy.
 */
const GUARDED_TRANSACTION_FILES = [
	// the facade: declares the guarded begin/commit/cancel methods
	'editor/editor-store.svelte.ts',
	// layout-side transaction consumers
	'editor/EditorViewport.svelte',
	'editor/app/PlanWorkspace.svelte',
	'editor/app/WorkspaceRibbon.svelte',
	'editor/gizmo/layout-gizmo-adapter.svelte.ts',
	'editor/layout/arrange-delete.ts',
	'editor/layout/layout-mutation-runner.ts',
	// scene/camera-side transaction consumers
	'editor/EditorPlacementTools.svelte',
	'editor/EditorSelection.svelte',
	'editor/app/CameraPlanInspector.svelte',
	'editor/app/PlanWorkspace.svelte',
	'editor/camera-plan/CameraPlanViewport.svelte',
	'editor/gizmo/camera-gizmo-adapter.svelte.ts',
	'editor/gizmo/scene-gizmo-adapter.svelte.ts',
	'editor/store/camera-preview-commands.svelte.ts',
	'editor/store/camera-timeline-controller.svelte.ts',
	'editor/store/controller-hosts.ts',
	'editor/store/material-resource-mutator.svelte.ts',
	'editor/store/navigation-graph-mutator.svelte.ts',
	'editor/store/path-anchor-mutator.svelte.ts',
	'editor/store/placement-cluster-mutator.svelte.ts',
	'editor/store/view-keyframe-controller.svelte.ts',
	// the history/document core the facade brackets
	'editor/store/document-store.svelte.ts',
	'editor/store/history-controller.svelte.ts'
] as const;

/**
 * Files with direct document-array writes, each with its named reason
 * (P23.0: every path is adapted / read-only / disabled — no unclassified
 * writes). Absence from this list is the guarantee the architecture test
 * enforces: a NEW direct-write file fails the suite until reviewed.
 */
const DIRECT_WRITE_EXCEPTIONS: Record<string, string> = {
	// room-registry plumbing replaced with each document swap — not a
	// document-array mutation.
	'editor/store/document-store.svelte.ts':
		'Room-registry assignment plumbing (document swap), not a document-array mutation',
	// pure reducers over CLONED layout documents; the caller commits through
	// the guarded layout transaction runner.
	'editor/gizmo/layout-gizmo-candidate.ts':
		'Pure reducer over a cloned layout; commit rides the guarded transaction runner',
	'editor/layout/layout-room-transform.ts':
		'Pure room-frame computation over a cloned layout',
	// draft-preview mutators: PlanWorkspace / UnifiedProjectTree /
	// LayoutPlanViewport call these through runLayoutMutation +
	// layoutMutationRunnerFor(store, ...) → store.beginLayoutTransaction.
	// The remaining matches are preview-cache plumbing and boot-time
	// scaffolding that runs before any authoring mutator exists.
	'editor/layout/layout-preview-state.svelte.ts':
		'Draft-preview mutators committed through the guarded layout runner; boot/preview-cache plumbing only',
	// scene mutators writing through host.document INSIDE document
	// transactions opened via the guarded facade methods.
	'editor/store/navigation-graph-mutator.svelte.ts':
		'Writes inside guarded beginDocumentTransaction brackets (camera/scene domain)',
	'editor/store/placement-cluster-mutator.svelte.ts':
		'Writes inside guarded beginDocumentTransaction brackets (camera/scene domain)',
	// material/texture registry writes — each site is immediately preceded
	// by host.beginDocumentTransaction() in the same function.
	'editor/store/material-resource-mutator.svelte.ts':
		'textures/materials writes inside guarded beginDocumentTransaction brackets (material domain)',
	// connection.pathAnchors splices (review round 2) — every call site is
	// wrapped by the guarded layout/scene transaction runner above it.
	'editor/store/path-anchor-mutator.svelte.ts':
		'positionPath.anchors splices inside guarded beginDocumentTransaction brackets (anchor domain)',
	// P23.11 diagnosis harness — the fixture matrix builds a throwaway
	// wall-first document locally to feed `importLayoutPreviewJson`; it never
	// writes a live editor document and never reaches a transaction.
	'bench/p2311-bend-fixtures.ts':
		'P23.11 diagnostic fixture factory — builds a throwaway wall-first document; never mutates a live document'
};

describe('P23.0 F0 stage 1 — central format-dispatch policy tables', () => {
	it('classifies every domain × format; nothing is unclassified', () => {
		const layoutFormats = ['legacy', 'wall-first', 'unrecognized'] as const;
		const sceneFormats = ['legacy-room-local', 'project-world', 'unrecognized'] as const;
		for (const format of layoutFormats) {
			expect(LAYOUT_MUTATION_POLICY[format]).toBeDefined();
		}
		for (const format of sceneFormats) {
			expect(SCENE_MUTATION_POLICY[format]).toBeDefined();
		}
	});

	it('wall-first layout mutation is adapted after the stage-6 flip (2026-09-10 owner go-ahead)', () => {
		expect(LAYOUT_MUTATION_POLICY['wall-first']).toBe('adapted');
		// The refusal reason is retired: the flip enabled wall-first writes.
		expect(LAYOUT_MUTATION_REASONS['wall-first']).toBeNull();
		// The shipped Chopin layout is legacy and adapted; a minimal
		// wall-first-shaped value (real fixtures live in the codec suite)
		// classifies as wall-first and is now adapted.
		expect(classifyLayoutFormat(chopinProject.layout)).toBe('legacy');
		const wallFirstShape = {
			units: 'meters',
			formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
			floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
			junctions: [],
			walls: [],
			rooms: [],
			openings: [],
			objects: []
		};
		expect(classifyLayoutFormat(wallFirstShape)).toBe('wall-first');
		const adaptedClass = layoutMutationClassFor(wallFirstShape);
		expect(adaptedClass.policy).toBe('adapted');
		expect(adaptedClass.reason).toBeNull();
		expect(isMutationAllowed(adaptedClass)).toBe(true);
	});

	it('unrecognized layouts are disabled; legacy layout is adapted', () => {
		expect(LAYOUT_MUTATION_POLICY.unrecognized).toBe('disabled');
		expect(LAYOUT_MUTATION_POLICY.legacy).toBe('adapted');
		expect(layoutMutationClassFor({ units: 'nonsense' }).policy).toBe('disabled');
		expect(layoutMutationClassFor(chopinProject.layout).policy).toBe('adapted');
	});

	it('both scene formats are adapted in stage 1 (P23.0b adapter audit)', () => {
		expect(SCENE_MUTATION_POLICY['legacy-room-local']).toBe('adapted');
		expect(SCENE_MUTATION_POLICY['project-world']).toBe('adapted');
		const worldLocal = { ...(chopinProject.scene as object), formatVersion: 1 } as Parameters<typeof classifySceneFormat>[0];
		expect(classifySceneFormat(worldLocal)).toBe('project-world');
		expect(sceneMutationClassFor(worldLocal).policy).toBe('adapted');
		expect(SCENE_MUTATION_REASONS['project-world']).toBeNull();
	});

	it('unrecognized scene versions are disabled, never legacy (F0 review fail-closed)', () => {
		expect(SCENE_MUTATION_POLICY.unrecognized).toBe('disabled');
		expect(SCENE_MUTATION_REASONS.unrecognized).toBeTruthy();
		const future = { ...(chopinProject.scene as object), formatVersion: 2 } as unknown as Parameters<typeof classifySceneFormat>[0];
		expect(classifySceneFormat(future)).toBe('unrecognized');
		const refused = sceneMutationClassFor(future);
		expect(refused.policy).toBe('disabled');
		expect(refused.reason).toBe(SCENE_MUTATION_REASONS.unrecognized);
		expect(isMutationAllowed(refused)).toBe(false);
		// The discriminated formats still classify exactly.
		expect(classifySceneFormat(chopinProject.scene)).toBe('legacy-room-local');
	});
});

describe('P23.0 F0 stage 1 — exhaustive mutation-entry-point inventory', () => {
	it('every transaction-method caller is in the reviewed guarded family', () => {
		const callers = ALL_SOURCE_FILES.filter((file) =>
			TRANSACTION_CALL_PATTERN.test(readFileSync(file, 'utf8'))
		).map((file) => file.slice(EDITOR_SRC_LIB.length + 1));

		const allowed = new Set<string>(GUARDED_TRANSACTION_FILES);
		const unclassified = callers.filter((file) => !allowed.has(file));
		expect(unclassified, `Files calling document transactions outside the guarded family: ${unclassified.join(', ')}`).toEqual([]);
	});

	it('every direct document-array write file is on the reviewed exception list', () => {
		// Widen per review round 2: mutating methods beyond push (splice/sort/
		// index-assign), the remaining SceneDocument arrays (connections/
		// textures/materials), and nested path anchors. Local-copy splices
		// (e.g. CameraFlowPanel's filtered copy) deliberately don't match —
		// only direct document-collection writes are audited.
		const collections = 'floors|rooms|boundary|openings|objects|entities|clusters|navigationNodes|pathAnchors|walls|junctions|connections|textures|materials';
		const writePattern = new RegExp(
			`\\.(${collections}) = [^=]|\\.(${collections}|anchors)\\.(push|splice|unshift|pop|shift|sort|reverse|fill|copyWithin)\\(`
		);
		const writers = ALL_SOURCE_FILES.filter((file) =>
			writePattern.test(readFileSync(file, 'utf8'))
		).map((file) => file.slice(EDITOR_SRC_LIB.length + 1));

		const unclassified = writers.filter((file) => !(file in DIRECT_WRITE_EXCEPTIONS));
		expect(unclassified, `Direct document writers missing a reviewed classification: ${unclassified.join(', ')}`).toEqual([]);
		for (const file of writers) {
			expect(DIRECT_WRITE_EXCEPTIONS[file], `missing reason for ${file}`).toBeTruthy();
		}
	});

	it('the facade begin AND commit methods consult the central policy (guard wiring)', () => {
		const storeSource = readFileSync(join(EDITOR_SRC_LIB, 'editor', 'editor-store.svelte.ts'), 'utf8');
		const beginLayout = storeSource.slice(
			storeSource.indexOf('beginLayoutTransaction(): boolean'),
			storeSource.indexOf('commitLayoutTransaction(snapshot')
		);
		expect(beginLayout).toContain('classifyLayoutFormat');
		expect(beginLayout).toContain('LAYOUT_MUTATION_POLICY');

		// F0 review: the commit re-check is the highest-risk line — pin that
		// it consults the policy. Post stage-6 the re-check enforces the
		// cross-format invariant (begin format = current format = candidate
		// format, all adapted) and refuses with its own named message; the
		// per-format REASONS table is only consulted when a format is not
		// adapted at all.
		const commitLayout = storeSource.slice(
			storeSource.indexOf('commitLayoutTransaction(snapshot'),
			storeSource.indexOf('cancelLayoutTransaction(): boolean')
		);
		expect(commitLayout).toContain('classifyLayoutFormat');
		expect(commitLayout).toContain('LAYOUT_MUTATION_POLICY');
		expect(commitLayout).toContain('Layout format changed mid-transaction');

		const beginDocument = storeSource.slice(
			storeSource.indexOf('beginDocumentTransaction()'),
			storeSource.indexOf('beginCameraFramingTransaction()')
		);
		expect(beginDocument).toContain('classifySceneFormat');
		expect(beginDocument).toContain('SCENE_MUTATION_POLICY');

		const commitDocument = storeSource.slice(
			storeSource.indexOf('commitDocumentTransaction()'),
			storeSource.indexOf('cancelDocumentTransaction()')
		);
		expect(commitDocument).toContain('classifySceneFormat');
		expect(commitDocument).toContain('SCENE_MUTATION_POLICY');
		expect(commitDocument).toContain('SCENE_MUTATION_REASONS');

		const beginFraming = storeSource.slice(storeSource.indexOf('beginCameraFramingTransaction()'));
		expect(beginFraming).toContain('classifySceneFormat');
		expect(beginFraming).toContain('SCENE_MUTATION_POLICY');
	});
});

describe('P23.0 F0 stage 1 — behavioral guard contract', () => {
	const wallFirstLayout = {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'j-a', point: [0, 0] },
			{ id: 'j-b', point: [6, 0] },
			{ id: 'j-c', point: [6, 4] },
			{ id: 'j-d', point: [0, 4] }
		],
		walls: [
			{ id: 'w-a', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'w-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'w-c', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
			{ id: 'w-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const}
		],
		rooms: [],
		openings: [],
		objects: []
	};

	/** Minimal layout-history host + format source over one mutable layout. */
	function attachLayoutHost(store: ReturnType<typeof createFixtureEditorStore>, layout: unknown) {
		const holder = { project: { layout } };
		store.registerLayoutHistory({
			capture: () => holder,
			replace: () => {},
			matches: () => true
		});
		store.setLayoutFormatPolicySource(() => holder);
		return holder;
	}

	it('legacy layout documents keep authoring (guard is a no-op on reachable formats)', () => {
		const store = createFixtureEditorStore();
		attachLayoutHost(store, chopinProject.layout);
		expect(store.beginLayoutTransaction()).toBe(true);
		expect(store.statusMessage).toBeNull();
		expect(store.cancelLayoutTransaction()).toBe(true);
	});

	it('wall-first layout documents accept layout authoring after the stage-6 flip', () => {
		const store = createFixtureEditorStore();
		expect(classifyLayoutFormat(wallFirstLayout)).toBe('wall-first');
		const holder = attachLayoutHost(store, chopinProject.layout);

		// Legacy first: authoring opens.
		expect(store.beginLayoutTransaction()).toBe(true);
		store.cancelLayoutTransaction();

		// Swap the live layout to wall-first: the central guard is adapted —
		// the flip means the switch is the document, not a per-controller
		// flag, and no refusal message is set.
		holder.project.layout = wallFirstLayout;
		expect(store.beginLayoutTransaction()).toBe(true);
		expect(store.statusMessage).toBeNull();
		store.cancelLayoutTransaction();

		// Swap back: legacy authoring still opens.
		holder.project.layout = chopinProject.layout;
		expect(store.beginLayoutTransaction()).toBe(true);
		store.cancelLayoutTransaction();
	});

	/**
	 * P23.0 stage-6 safety invariant — the cross-format transaction matrix.
	 * The commit re-check must refuse ANY format change across one undo
	 * boundary (begin format ≠ live format, or the committed snapshot
	 * carries a different format than the transaction began on), because
	 * `HistoryController.commitLayout` blindly pushes `before` and lets
	 * `undo()` replace host state — a mixed-schema history entry would
	 * corrupt deterministic replay once both schemas are writable.
	 */
	function expectMidTransactionSwapRefused(
		store: ReturnType<typeof createFixtureEditorStore>,
		holder: { project: { layout: unknown } },
		commitSnapshot: unknown
	): void {
		expect(store.commitLayoutTransaction(commitSnapshot)).toBe(false);
		expect(store.statusMessage).toBe('Layout format changed mid-transaction — edit refused');
		// The refused commit rolled back via cancel(): no open transaction
		// leaks — re-opening on the ORIGINAL format works cleanly.
		holder.project.layout = chopinProject.layout;
		expect(store.beginLayoutTransaction()).toBe(true);
		store.cancelLayoutTransaction();
	}

	it('a legacy → wall-first swap landing mid-transaction refuses commit and closes the bracket (stage-6 invariant)', () => {
		const store = createFixtureEditorStore();
		const holder = attachLayoutHost(store, chopinProject.layout);
		expect(store.beginLayoutTransaction()).toBe(true); // begin saw legacy

		// The swap lands while the transaction is open: begin saw legacy,
		// the live layout is now wall-first. The pre-flip policy refused this
		// implicitly (wall-first was disabled); the commit re-check must keep
		// refusing it explicitly.
		holder.project.layout = wallFirstLayout;
		expectMidTransactionSwapRefused(store, holder, null);
	});

	it('a wall-first → legacy swap landing mid-transaction refuses commit and closes the bracket (stage-6 invariant)', () => {
		const store = createFixtureEditorStore();
		const holder = attachLayoutHost(store, wallFirstLayout);
		expect(store.beginLayoutTransaction()).toBe(true); // begin saw wall-first

		holder.project.layout = chopinProject.layout;
		expectMidTransactionSwapRefused(store, holder, null);
	});

	it('a wall-first → wall-first transaction commits normally (no false refusal)', () => {
		const store = createFixtureEditorStore();
		// Same harness as `attachLayoutHost` but with a distinguishing
		// `matches` (the shared host answers `true`, which makes every commit
		// a history no-op — here the commit must actually go through).
		const holder = { project: { layout: wallFirstLayout as unknown } };
		store.registerLayoutHistory({
			capture: () => holder,
			replace: () => {},
			matches: () => false
		});
		store.setLayoutFormatPolicySource(() => holder);
		expect(store.beginLayoutTransaction()).toBe(true);

		// Same format at begin, live host and candidate — the invariant holds
		// and the bracket closes through the normal commit path.
		expect(store.commitLayoutTransaction({ project: { layout: wallFirstLayout } })).toBe(true);
		expect(store.statusMessage).toBeNull();
		// No leaked bracket: the next transaction opens.
		expect(store.beginLayoutTransaction()).toBe(true);
		store.cancelLayoutTransaction();
	});

	it('a candidate snapshot format change is refused even when the live host format did not change', () => {
		const store = createFixtureEditorStore();
		const holder = attachLayoutHost(store, chopinProject.layout);
		expect(store.beginLayoutTransaction()).toBe(true); // begin/live both legacy

		// The host stays legacy, but the candidate carries wall-first shape.
		// This directly pins the third leg of begin = live = candidate.
		expectMidTransactionSwapRefused(store, holder, { project: { layout: wallFirstLayout } });
	});

	it('an adapted → unrecognized swap landing mid-transaction refuses commit and closes the bracket (F0 review, post-flip)', () => {
		const store = createFixtureEditorStore();
		const holder = attachLayoutHost(store, chopinProject.layout);
		expect(store.beginLayoutTransaction()).toBe(true); // begin saw legacy

		// The live layout is now unrecognized — refused both by the begin
		// format mismatch and by the never-adapted policy entry.
		holder.project.layout = { units: 'nonsense' };
		expectMidTransactionSwapRefused(store, holder, null);
	});

	it('a scene swap landing mid-transaction refuses document commit and closes the bracket (F0 review)', () => {
		const store = createFixtureEditorStore();
		expect(store.beginDocumentTransaction()).toBe(true);

		// No public swap primitive preserves an open transaction, so the
		// test triggers the re-check branch directly: the live document
		// carries a future (unrecognized) format at commit time.
		(store.document as unknown as Record<string, unknown>).formatVersion = 2;
		expect(store.commitDocumentTransaction()).toBe(false);
		expect(store.statusMessage).toBe('Unrecognized scene format cannot be authored');

		// cancel() restored the pre-transaction snapshot (legacy): authoring
		// re-opens with no leaked bracket. (The refusal message persists;
		// begin() only sets on refusal.)
		expect(store.beginDocumentTransaction()).toBe(true);
		store.cancelDocumentTransaction();
	});
});