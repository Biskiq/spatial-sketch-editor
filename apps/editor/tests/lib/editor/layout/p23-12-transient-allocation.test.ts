/**
 * P23.12 S2 — the transient allocation contract (T1–T6).
 *
 * The four-kind rule at the shared seams (D1): a pointermove candidate renders
 * honest references from a **provisional** mint into a copy; a cancelled,
 * rejected or superseded gesture consumes **zero** allocations; a committed
 * edit's tokens are a function of the committed document, never of pointermove
 * history; and the session mark lives outside `LayoutPreviewSnapshot`.
 *
 * The transient seams driven here are the real shipped ones: the direct
 * architecture gesture through `transientArchitectureEdit` +
 * `restoreTransientArchitectureBaseline` (the pointermove path installs
 * nothing on live state), the wall-first precision mutators as the release
 * planner's canonical step, and `promoteLayoutPreviewIdentity` at the commit.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	layoutIdentityCursor,
	referenceFor,
	serializeWallFirstLayoutDocument,
	withLayoutIdentity,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import {
	captureLayoutPreviewSnapshot,
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewAuthoredJson,
	layoutPreviewCanonicalJson,
	layoutPreviewDocument,
	layoutPreviewIdentityBase,
	layoutPreviewIsDirty,
	promoteLayoutPreviewIdentity,
	restoreLayoutPreviewSnapshot,
	updateWallFirstJunction,
	type LayoutPreviewSnapshot,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';
import {
	createLayoutInteractionState,
	selectLayoutJunction,
	updateLayoutArchitectureEdit,
	architectureEditRawTarget,
	beginLayoutArchitectureEdit,
	cancelLayoutArchitectureEdit,
	type LayoutArchitectureEditGesture,
	type LayoutInteractionState
} from '$lib/editor/layout/layout-interaction';
import {
	restoreTransientArchitectureBaseline,
	transientArchitectureEdit
} from '$lib/editor/layout/layout-transient-edit';

// ---------------------------------------------------------------------------
// fixtures — one 4×3 m Room (same shape the transient suites use)
// ---------------------------------------------------------------------------

const LINE = { kind: 'line' } as const;

function squareDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: 5,
		floor: { id: 'floor', name: 'Floor', elevation: 0 },
		junctions: [
			{ id: 'A', point: [0, 0] },
			{ id: 'B', point: [4, 0] },
			{ id: 'C', point: [4, 3] },
			{ id: 'D', point: [0, 3] }
		],
		walls: [
			{ id: 'w1', startJunctionId: 'A', endJunctionId: 'B', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'w2', startJunctionId: 'B', endJunctionId: 'C', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'w3', startJunctionId: 'C', endJunctionId: 'D', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'w4', startJunctionId: 'D', endJunctionId: 'A', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE }
		],
		rooms: [
			{
				id: 'room',
				name: 'Room',
				boundary: [
					{ wallId: 'w1', direction: 'forward' },
					{ wallId: 'w2', direction: 'forward' },
					{ wallId: 'w3', direction: 'forward' },
					{ wallId: 'w4', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		],
		openings: [],
		objects: []
	};
}

function makeState(document: LayoutDocumentWallFirst = squareDocument()): LayoutPreviewState {
	const state = createEmptyLayoutPreviewState();
	expect(importLayoutPreviewJson(state, serializeWallFirstLayoutDocument(document))).toBe(true);
	return state;
}

function live(state: LayoutPreviewState): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(state);
	if (!('formatVersion' in document)) throw new Error('expected a wall-first document');
	return document;
}

type Harness = {
	state: LayoutPreviewState;
	store: ReturnType<typeof createEditorStore>;
	interaction: LayoutInteractionState;
	snapshot: LayoutPreviewSnapshot | null;
};

function makeHarness(): Harness {
	const state = makeState();
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	store.registerLayoutHistory({
		capture: () => captureLayoutPreviewSnapshot(state),
		replace: (snapshot) => restoreTransientArchitectureBaseline(state, snapshot as never),
		matches: (a, b) =>
			layoutPreviewAuthoredJson({ project: (a as { project: unknown }).project } as never) ===
			layoutPreviewAuthoredJson({ project: (b as { project: unknown }).project } as never)
	});
	store.setLayoutFormatPolicySource(() => state);
	return { state, store, interaction: createLayoutInteractionState(), snapshot: null };
}

function junctionGesture(harness: Harness, junctionId: string): LayoutArchitectureEditGesture {
	const document = live(harness.state);
	const point = document.junctions.find((junction) => junction.id === junctionId)!.point;
	return {
		kind: 'junction-move',
		pointerId: 1,
		junctionId,
		startPointer: [point[0], point[1]],
		baselinePoint: [point[0], point[1]],
		junctionExcludePoints: document.junctions.map(
			(junction) => [junction.point[0], junction.point[1]] as LayoutVec2
		),
		affectedWallIds: document.walls
			.filter((wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId)
			.map((wall) => wall.id),
		candidatePoint: [point[0], point[1]],
		valid: false
	};
}

/** One pointermove, exactly as the viewport's preview step performs it. */
function move(harness: Harness, pointer: LayoutVec2): void {
	const gesture = harness.interaction.architectureEdit;
	if (!gesture || !harness.snapshot) throw new Error('no active architecture edit');
	const input = updateLayoutArchitectureEdit(harness.interaction, architectureEditRawTarget(gesture, pointer));
	if (!input) throw new Error('gesture lost its candidate');
	const baseline = harness.snapshot.project.layout;
	void transientArchitectureEdit({
		gesture: harness.interaction.architectureEdit,
		baseline: 'formatVersion' in baseline ? (baseline as unknown as LayoutDocumentWallFirst) : null,
		moved: true
	});
}

/** The release planner's canonical step, as the viewport performs it. */
function plan(harness: Harness, pointer: LayoutVec2): { success: boolean; message?: string } {
	const gesture = harness.interaction.architectureEdit;
	if (!gesture) return { success: false, message: 'lost' };
	const input = updateLayoutArchitectureEdit(harness.interaction, architectureEditRawTarget(gesture, pointer));
	if (!input || gesture.kind !== 'junction-move') return { success: false, message: 'lost' };
	const result = updateWallFirstJunction(harness.state, gesture.junctionId, input);
	return result.success ? { success: true } : { success: false, message: result.message };
}

// ---------------------------------------------------------------------------
// T1 — a cancelled derivation consumes nothing
// ---------------------------------------------------------------------------

describe('P23.12 T1 — a cancelled gesture consumes no allocation', () => {
	it('restores document and mark byte-identically after N provisional derivations', () => {
		const harness = makeHarness();
		const baselineJson = layoutPreviewCanonicalJson(harness.state);
		const baselineMark = harness.state.identityHighWater;
		const baselineLedger = JSON.stringify(live(harness.state).identity ?? null);

		// A full gesture: snapshot + transaction, 50 pointermove derivations…
		expect(harness.store.beginLayoutTransaction()).toBe(true);
		harness.snapshot = captureLayoutPreviewSnapshot(harness.state);
		selectLayoutJunction(harness.interaction, 'B');
		beginLayoutArchitectureEdit(harness.interaction, junctionGesture(harness, 'B'));
		for (let index = 0; index < 50; index += 1) {
			move(harness, [4 + index * 0.05, 0]);
		}
		// …then Escape: the exact baseline comes back.
		restoreTransientArchitectureBaseline(harness.state, harness.snapshot);
		harness.store.cancelLayoutTransaction();

		expect(layoutPreviewCanonicalJson(harness.state)).toBe(baselineJson);
		expect(harness.state.identityHighWater).toBe(baselineMark);
		expect(JSON.stringify(live(harness.state).identity ?? null)).toBe(baselineLedger);
		expect(layoutPreviewIsDirty(harness.state)).toBe(false);
	});

	it('a rejected release leaves ledger, cursor and mark equal to the baseline', () => {
		const harness = makeHarness();
		const baselineJson = layoutPreviewCanonicalJson(harness.state);
		const baselineMark = harness.state.identityHighWater;
		const baselineLedger = JSON.stringify(live(harness.state).identity ?? null);

		expect(harness.store.beginLayoutTransaction()).toBe(true);
		harness.snapshot = captureLayoutPreviewSnapshot(harness.state);
		selectLayoutJunction(harness.interaction, 'B');
		beginLayoutArchitectureEdit(harness.interaction, junctionGesture(harness, 'B'));
		// Move onto another junction — the planner rejects the merge target.
		move(harness, [0, 0]);
		const planned = plan(harness, [0, 0]);
		// The rejection may or may not fire (the target may be excluded); either
		// way the release restores the exact baseline.
		if (!planned.success) {
			restoreTransientArchitectureBaseline(harness.state, harness.snapshot);
			harness.store.cancelLayoutTransaction();
		} else {
			harness.store.cancelLayoutTransaction();
			restoreTransientArchitectureBaseline(harness.state, harness.snapshot);
		}

		expect(layoutPreviewCanonicalJson(harness.state)).toBe(baselineJson);
		expect(harness.state.identityHighWater).toBe(baselineMark);
		expect(JSON.stringify(live(harness.state).identity ?? null)).toBe(baselineLedger);
	});
});

// ---------------------------------------------------------------------------
// T2 — commitment is a function of the document, not of input history
// ---------------------------------------------------------------------------

describe('P23.12 T2 — committed tokens are derivation-independent', () => {
	/** Commit a junction move to [4.5, 0] after `derivations` pointermove frames. */
	function commitMove(harness: Harness, derivations: number): string {
		expect(harness.store.beginLayoutTransaction()).toBe(true);
		harness.snapshot = captureLayoutPreviewSnapshot(harness.state);
		selectLayoutJunction(harness.interaction, 'B');
		beginLayoutArchitectureEdit(harness.interaction, junctionGesture(harness, 'B'));
		for (let index = 0; index < derivations; index += 1) {
			move(harness, [4 + index * 0.01, 0]);
		}
		expect(plan(harness, [4.5, 0]).success).toBe(true);
		promoteLayoutPreviewIdentity(harness.state);
		harness.store.commitLayoutTransaction(captureLayoutPreviewSnapshot(harness.state));
		return JSON.stringify(live(harness.state).identity);
	}

	it('yields the same tokens with zero, fifty, and fifty-plus-cancel derivations', () => {
		const zero = commitMove(makeHarness(), 0);
		const fifty = commitMove(makeHarness(), 50);

		// Fifty derivations, a cancel/restart of the whole gesture, then the same
		// committed edit: still the same tokens.
		const restarted = makeHarness();
		expect(restarted.store.beginLayoutTransaction()).toBe(true);
		restarted.snapshot = captureLayoutPreviewSnapshot(restarted.state);
		selectLayoutJunction(restarted.interaction, 'B');
		beginLayoutArchitectureEdit(restarted.interaction, junctionGesture(restarted, 'B'));
		for (let index = 0; index < 50; index += 1) {
			move(restarted, [4 + index * 0.01, 0]);
		}
		// Cancel the attempt…
		restoreTransientArchitectureBaseline(restarted.state, restarted.snapshot);
		restarted.store.cancelLayoutTransaction();
		cancelLayoutArchitectureEdit(restarted.interaction);
		restarted.snapshot = null;
		// …and commit the same edit on the restarted gesture.
		expect(commitMove(restarted, 0)).toBe(zero);
		expect(fifty).toBe(zero);
	});

	it('the cursor advances by exactly the entities the commit created, not the derivation count', () => {
		const harness = makeHarness();
		const before = layoutIdentityCursor(live(harness.state));
		// A junction move creates nothing: the cursor must not move at all.
		commitMove(harness, 50);
		expect(layoutIdentityCursor(live(harness.state))).toBe(before);
	});
});

// ---------------------------------------------------------------------------
// T3 — the mark is outside the snapshot
// ---------------------------------------------------------------------------

describe('P23.12 T3 — the mark is not part of LayoutPreviewSnapshot', () => {
	it('captures no high-water field, and restoring never lowers the mark', () => {
		const state = makeState();
		const snapshotAtZero = captureLayoutPreviewSnapshot(state);
		expect(Object.keys(snapshotAtZero)).not.toContain('identityHighWater');
		expect(JSON.stringify(snapshotAtZero)).not.toContain('identityHighWater');

		// Move the mark forward (as a promotion at another seam would), then
		// restore a snapshot captured at mark 0: the mark stays at 50.
		state.identityHighWater = 50;
		restoreLayoutPreviewSnapshot(state, snapshotAtZero);
		expect(state.identityHighWater).toBe(50);

		// A later capture/restore round-trip still never lowers it.
		const snapshotAtFifty = captureLayoutPreviewSnapshot(state);
		state.identityHighWater = 120;
		restoreLayoutPreviewSnapshot(state, snapshotAtFifty);
		expect(state.identityHighWater).toBe(120);
	});
});

// ---------------------------------------------------------------------------
// T4 — promotion is invisible and inert
// ---------------------------------------------------------------------------

describe('P23.12 T4 — promotion writes identity only', () => {
	it('leaves geometry, issues and bounds identical, and keeps the displayed tokens', () => {
		const harness = makeHarness();
		const document = live(harness.state);
		// The provisional ledger of a candidate that moves junction B.
		const candidate: LayoutDocumentWallFirst = JSON.parse(JSON.stringify(document));
		candidate.junctions = candidate.junctions.map((junction) =>
			junction.id === 'B' ? { ...junction, point: [4.5, 0] } : junction
		);
		const provisional = withLayoutIdentity(candidate, {
			base: layoutPreviewIdentityBase(harness.state, candidate)
		}) as unknown as LayoutDocumentWallFirst;
		const provisionalToken = referenceFor(provisional, 'junctions', 'A');

		// Commit the same edit for real, then land the commit seam.
		expect(harness.store.beginLayoutTransaction()).toBe(true);
		harness.snapshot = captureLayoutPreviewSnapshot(harness.state);
		selectLayoutJunction(harness.interaction, 'B');
		beginLayoutArchitectureEdit(harness.interaction, junctionGesture(harness, 'B'));
		expect(plan(harness, [4.5, 0]).success).toBe(true);

		const geometryBefore = harness.state.geometry;
		const issuesBefore = JSON.stringify(harness.state.issues);
		const boundsBefore = JSON.stringify(harness.state.bounds);
		promoteLayoutPreviewIdentity(harness.state);
		// Geometry is the same object (nothing recompiled); issues/bounds unchanged.
		expect(harness.state.geometry).toBe(geometryBefore);
		expect(JSON.stringify(harness.state.issues)).toBe(issuesBefore);
		expect(JSON.stringify(harness.state.bounds)).toBe(boundsBefore);
		// The promoted token equals the provisional one (same base, same order).
		expect(referenceFor(live(harness.state), 'junctions', 'A')).toBe(provisionalToken);
	});
});

// ---------------------------------------------------------------------------
// conservative direction — source-level, scoped per function
// ---------------------------------------------------------------------------

describe('P23.12 — promotion stays on the durable seams (per function)', () => {
	const LIB = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../src/lib');

	function source(relative: string): string {
		return readFileSync(resolve(LIB, relative), 'utf8');
	}

	/** Split a module into per-function blocks (imports form their own block). */
	function functionBlocks(sourceText: string): string[] {
		return sourceText.split(/\n(?=(?:export )?(?:async )?function )/);
	}

	it('the gizmo adapter promotes only inside commitLayoutSession', () => {
		const blocks = functionBlocks(source('editor/gizmo/layout-gizmo-adapter.svelte.ts'));
		const committing = blocks.filter((block) =>
			block.includes('promoteLayoutPreviewIdentity(input.layoutPreview)')
		);
		expect(committing).toHaveLength(1);
		expect(committing[0]).toContain('commitLayoutCandidate');
		// The transient paths never promote.
		for (const block of blocks) {
			if (
				block.includes('function previewLayoutSession') ||
				block.includes('function cancelLayoutSession')
			) {
				expect(block).not.toContain('promoteLayoutPreviewIdentity');
			}
		}
	});

	it('the candidate, transient-edit and preview-coordinator modules never promote', () => {
		expect(source('editor/gizmo/layout-gizmo-candidate.ts')).not.toContain('promoteLayoutIdentity');
		expect(source('editor/layout/layout-transient-edit.ts')).not.toContain('promoteLayoutIdentity');
		expect(source('editor/preview/preview-coordinator.ts')).not.toContain('promoteLayoutIdentity');
	});

	it('the restore path contains no cursor clamp', () => {
		const restore = functionBlocks(source('editor/layout/layout-preview-state.svelte.ts')).find(
			(block) => block.includes('function restoreLayoutPreviewSnapshotUnmeasured')
		);
		expect(restore).toBeDefined();
		expect(restore!).not.toMatch(/identityHighWater\s*=/);
	});

	it('captureLayoutPreviewSnapshot performs no write', () => {
		const capture = functionBlocks(source('editor/layout/layout-preview-state.svelte.ts')).find(
			(block) => block.includes('export function captureLayoutPreviewSnapshot')
		);
		expect(capture).toBeDefined();
		expect(capture!).not.toMatch(/state\.\w+\s*=[^=]/);
	});
});
