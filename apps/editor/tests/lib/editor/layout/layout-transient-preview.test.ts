/**
 * P23.11 transient direct-manipulation pass — the gesture contract.
 *
 * The viewport now drives a direct architecture gesture (Junction move, rigid
 * Wall move, curve-control move, Bend) like this, and these tests run the same
 * steps with the same shipped seams:
 *
 * ```
 * pointerdown → one snapshot + one transaction
 * pointermove → candidate on the gesture + render-only proposal
 * pointerup   → releaseArchitectureEdit (one planner, one commit-or-cancel)
 * Escape      → discard the proposal, baseline exact
 * ```
 *
 * What is pinned:
 *
 * - a pointermove **cannot** reach canonical acceptance: no planner, no
 *   compile, no document write, no history (measured, not asserted by comment);
 * - the attempt still follows the pointer, including into positions the
 *   planner refuses, because it is derived without acceptance;
 * - the release is the only canonical step: exactly one planner call, exactly
 *   one Layout history entry or an exact baseline;
 * - the geometry the preview displayed is the geometry that commits (same
 *   canonical sampler, same intent), and the Bend grab stays at its
 *   pointer-down arc distance;
 * - Room/Opening identity, Layout selection and the Scene/Camera domains are
 *   untouched by the transient layer.
 *
 * The mirror omits only the P23.2 snap resolution, which is orthogonal and
 * unchanged (it resolves before the candidate is installed, and its own suites
 * pin it).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
	deriveChainSpans,
	wallCenterlineSamples,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWallCurveKnot
} from '@portfolio/layout-core';

import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
// P23.12 — a ledger is minted at the install seam, so "wrote nothing" about a
// command is a *content* claim; references themselves are pinned in p23-12-*.
import { documentContentJson } from '../../layout/__fixtures__/layout-identity-content';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	serializeWallFirstLayoutDocument
} from '$lib/layout/layout-wall-first-codec';
import {
	architectureEditRawTarget,
	beginLayoutArchitectureEdit,
	cancelLayoutArchitectureEdit,
	createLayoutInteractionState,
	selectLayoutJunction,
	selectLayoutPhysicalWall,
	updateLayoutArchitectureEdit,
	type LayoutArchitectureEditGesture,
	type LayoutInteractionState
} from '$lib/editor/layout/layout-interaction';
import {
	captureLayoutPreviewSnapshot,
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	updateWallFirstJunction,
	updateWallFirstWallBend,
	updateWallFirstWallCurveKnot,
	updateWallFirstWallMove,
	type LayoutPreviewSnapshot,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';
import {
	architectureEditProposalIntent,
	releaseArchitectureEdit,
	restoreTransientArchitectureBaseline,
	transientArchitectureEdit,
	type ArchitectureEditReleaseOutcome,
	type LayoutTransientArchitectureEdit
} from '$lib/editor/layout/layout-transient-edit';

// ---------------------------------------------------------------------------
// fixtures — one 4×3 m Room with a door on `w1`
// ---------------------------------------------------------------------------

const LINE = { kind: 'line' } as const;

function knotsOf(...points: LayoutVec2[]): LayoutWallCurveKnot[] {
	return points.map((point, index) => ({
		id: `w1:knot:${index + 1}`,
		point: [point[0], point[1]] as LayoutVec2
	}));
}

/** A canonical chain from a point list, using the write-path smoothness rule. */
function curvedCenterline() {
	return wallCubicChain(knotsOf([2, 1]), deriveChainSpans([[0, 0], [2, 1], [4, 0]]));
}

function squareDocument(
	centerline: LayoutDocumentWallFirst['walls'][number]['centerline'] = LINE
): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor', name: 'Floor', elevation: 0 },
		junctions: [
			{ id: 'A', point: [0, 0] },
			{ id: 'B', point: [4, 0] },
			{ id: 'C', point: [4, 3] },
			{ id: 'D', point: [0, 3] }
		],
		walls: [
			{ id: 'w1', startJunctionId: 'A', endJunctionId: 'B', role: 'boundary', thickness: 0.2, height: 3, centerline },
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
		openings: [
			{ id: 'door', wallId: 'w1', kind: 'door', offset: 1, width: 1, height: 2, sillHeight: 0, profile: 'rectangular' }
		],
		objects: []
	};
}

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------

type Context = {
	store: ReturnType<typeof createEditorStore>;
	layoutPreview: LayoutPreviewState;
	interaction: LayoutInteractionState;
	snapshot: LayoutPreviewSnapshot | null;
	/** Every planner call this gesture made. */
	plans: number;
	/** Every transaction commit/cancel this gesture made. */
	commits: number;
	cancels: number;
	restores: number;
};

function makeStore(document: LayoutDocumentWallFirst = squareDocument()): Context {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const layoutPreview = createEmptyLayoutPreviewState();
	if (!importLayoutPreviewJson(layoutPreview, serializeWallFirstLayoutDocument(document))) {
		throw new Error('wall-first import failed');
	}
	store.registerLayoutHistory({
		capture: () => captureLayoutPreviewSnapshot(layoutPreview),
		replace: (snapshot) => restoreTransientArchitectureBaseline(layoutPreview, snapshot as never),
		matches: (a, b) =>
			JSON.stringify((a as { project: { layout: unknown } }).project.layout) ===
			JSON.stringify((b as { project: { layout: unknown } }).project.layout)
	});
	store.setLayoutFormatPolicySource(() => layoutPreview);
	return {
		store,
		layoutPreview,
		interaction: createLayoutInteractionState(),
		snapshot: null,
		plans: 0,
		commits: 0,
		cancels: 0,
		restores: 0
	};
}

function live(context: Context): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(context.layoutPreview);
	if (!('formatVersion' in document)) throw new Error('expected a wall-first document');
	return document;
}

function junctionPoint(context: Context, junctionId: string): LayoutVec2 {
	const junction = live(context).junctions.find((candidate) => candidate.id === junctionId);
	if (!junction) throw new Error(`missing junction ${junctionId}`);
	return [junction.point[0], junction.point[1]] as LayoutVec2;
}

// ---------------------------------------------------------------------------
// gesture primitives, mirroring the viewport
// ---------------------------------------------------------------------------

function startGesture(context: Context, gesture: LayoutArchitectureEditGesture): boolean {
	if (!context.store.beginLayoutTransaction()) return false;
	context.snapshot = captureLayoutPreviewSnapshot(context.layoutPreview);
	beginLayoutArchitectureEdit(context.interaction, gesture);
	return true;
}

function junctionGesture(context: Context, junctionId: string): LayoutArchitectureEditGesture {
	const document = live(context);
	return {
		kind: 'junction-move',
		pointerId: 1,
		junctionId,
		startPointer: junctionPoint(context, junctionId),
		baselinePoint: junctionPoint(context, junctionId),
		junctionExcludePoints: document.junctions.map(
			(junction) => [junction.point[0], junction.point[1]] as LayoutVec2
		),
		affectedWallIds: document.walls
			.filter((wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId)
			.map((wall) => wall.id),
		candidatePoint: junctionPoint(context, junctionId),
		valid: false
	};
}

function wallGesture(context: Context, wallId: string, grabPoint: LayoutVec2): LayoutArchitectureEditGesture {
	const document = live(context);
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) throw new Error(`missing wall ${wallId}`);
	const endpoints = new Set([wall.startJunctionId, wall.endJunctionId]);
	return {
		kind: 'wall-move',
		pointerId: 1,
		wallId,
		startPointer: [grabPoint[0], grabPoint[1]],
		baselineGrabPoint: [grabPoint[0], grabPoint[1]],
		startJunctionId: wall.startJunctionId,
		endJunctionId: wall.endJunctionId,
		baselineStart: junctionPoint(context, wall.startJunctionId),
		baselineEnd: junctionPoint(context, wall.endJunctionId),
		affectedWallIds: document.walls
			.filter((candidate) => endpoints.has(candidate.startJunctionId) || endpoints.has(candidate.endJunctionId))
			.map((candidate) => candidate.id),
		candidateDelta: [0, 0],
		valid: false
	};
}

function bendGesture(context: Context, wallId: string, grabPoint: LayoutVec2, distance: number): LayoutArchitectureEditGesture {
	const document = live(context);
	return {
		kind: 'wall-bend',
		command: 'layout.wall.bend',
		pointerId: 1,
		wallId,
		startPointer: [grabPoint[0], grabPoint[1]],
		baselineGrabPoint: [grabPoint[0], grabPoint[1]],
		bendDistance: distance,
		bendExcludePoints: [
			junctionPoint(context, 'A'),
			junctionPoint(context, 'B')
		],
		affectedWallIds: [wallId],
		candidatePoint: [grabPoint[0], grabPoint[1]],
		valid: false
	};
}

function curveGesture(context: Context, wallId: string, knotId: string): LayoutArchitectureEditGesture {
	const knot = (live(context).walls.find((wall) => wall.id === wallId)?.centerline as
		| { kind: 'cubic-chain'; knots: LayoutWallCurveKnot[] }
		| undefined)?.knots.find((candidate) => candidate.id === knotId);
	if (!knot) throw new Error(`missing knot ${knotId}`);
	return {
		kind: 'curve-control-move',
		pointerId: 1,
		wallId,
		anchorId: knotId,
		startPointer: [knot.point[0], knot.point[1]],
		baselineAnchorPoint: [knot.point[0], knot.point[1]],
		curveExcludePoints: [junctionPoint(context, 'A'), junctionPoint(context, 'B')],
		affectedWallIds: [wallId],
		candidatePoint: [knot.point[0], knot.point[1]],
		valid: false
	};
}

/**
 * One pointermove, exactly as `previewArchitectureEdit` performs it: resolve the
 * total-displacement candidate onto the gesture, then derive the render-only
 * attempt from the frozen baseline. Returns `null` below the drag threshold.
 */
function move(
	context: Context,
	pointer: LayoutVec2,
	options: { moved?: boolean } = {}
): LayoutTransientArchitectureEdit | null {
	const gesture = context.interaction.architectureEdit;
	if (!gesture || !context.snapshot) throw new Error('no active architecture edit');
	if (options.moved === false) return null;
	const input = updateLayoutArchitectureEdit(context.interaction, architectureEditRawTarget(gesture, pointer));
	if (!input) throw new Error('gesture lost its candidate');
	const baseline = context.snapshot.project.layout;
	return transientArchitectureEdit({
		gesture: context.interaction.architectureEdit,
		baseline: 'formatVersion' in baseline ? (baseline as unknown as LayoutDocumentWallFirst) : null,
		moved: true
	});
}

/**
 * One release, exactly as `commitArchitectureEditGesture` performs it: the
 * canonical planner runs inside `releaseArchitectureEdit`, on the release
 * coordinate only, and at most once.
 */
function release(
	context: Context,
	pointer: LayoutVec2 | null,
	options: { moved?: boolean } = {}
): ArchitectureEditReleaseOutcome {
	return releaseArchitectureEdit({
		gesture: context.interaction.architectureEdit,
		moved: options.moved ?? true,
		plan: () => {
			context.plans += 1;
			const gesture = context.interaction.architectureEdit;
			if (!gesture) return { success: false, message: 'Architecture edit gesture was lost' };
			if (!pointer) return { success: false, message: 'Could not resolve the release position' };
			const input = updateLayoutArchitectureEdit(
				context.interaction,
				architectureEditRawTarget(gesture, pointer)
			);
			if (!input) return { success: false, message: 'Architecture edit gesture was lost' };
			const result =
				gesture.kind === 'junction-move'
					? updateWallFirstJunction(context.layoutPreview, gesture.junctionId, input)
					: gesture.kind === 'wall-move'
						? updateWallFirstWallMove(context.layoutPreview, gesture.wallId, input)
						: gesture.kind === 'wall-bend'
							? updateWallFirstWallBend(context.layoutPreview, gesture.wallId, {
									distance: gesture.bendDistance,
									point: input
								})
							: updateWallFirstWallCurveKnot(
									context.layoutPreview,
									gesture.wallId,
									gesture.anchorId,
									input
								);
			if (result.success) return { success: true };
			return { success: false, message: result.message, code: result.code };
		},
		commit: () => {
			context.commits += 1;
			return context.store.commitLayoutTransaction(
				captureLayoutPreviewSnapshot(context.layoutPreview)
			);
		},
		cancel: () => {
			context.cancels += 1;
			context.store.cancelLayoutTransaction();
		},
		restoreBaseline: () => {
			context.restores += 1;
			if (!context.snapshot) return;
			restoreTransientArchitectureBaseline(context.layoutPreview, context.snapshot);
		}
	});
}

/** The viewport's teardown: the gesture state, its proposal and the snapshot. */
function finish(context: Context): void {
	cancelLayoutArchitectureEdit(context.interaction);
	context.snapshot = null;
}

/** Escape / pointer-cancel: discard the attempt, keep the baseline exact. */
function cancelGesture(context: Context): void {
	if (context.snapshot) restoreTransientArchitectureBaseline(context.layoutPreview, context.snapshot);
	context.store.cancelLayoutTransaction();
	context.cancels += 1;
	finish(context);
}

// ---------------------------------------------------------------------------
// instrumentation harness — the shipped p2311 marks
// ---------------------------------------------------------------------------

const PREFIX = 'p2311:';

function stageCount(name: string): number {
	return performance
		.getEntriesByType('measure')
		.filter((entry) => entry.name === `${PREFIX}${name}`).length;
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
});

// ---------------------------------------------------------------------------
// 1. a pointermove derives an attempt and writes nothing
// ---------------------------------------------------------------------------

describe('P23.11 transient pass — a pointermove writes nothing', () => {
	const cases: Array<{ name: string; gesture: (context: Context) => LayoutArchitectureEditGesture; start: LayoutVec2 }> = [
		{
			name: 'Junction move',
			gesture: (context) => junctionGesture(context, 'A'),
			start: [0, 0]
		},
		{
			name: 'rigid Wall move',
			gesture: (context) => wallGesture(context, 'w1', [2, 0]),
			start: [2, 0]
		},
		{
			name: 'Bend',
			gesture: (context) => bendGesture(context, 'w1', [1, 0], 1),
			start: [1, 0]
		}
	];

	for (const entry of cases) {
		it(`keeps the canonical document byte-identical across a ${entry.name} drag`, () => {
			const context = makeStore();
			const before = JSON.stringify(live(context));
			const geometry = context.layoutPreview.geometry;
			const selection = JSON.stringify(context.interaction.selection);
			const scene = JSON.stringify(context.store.document);

			expect(startGesture(context, entry.gesture(context))).toBe(true);
			const attempts: string[] = [];
			for (const offset of [0.2, 0.5, 0.9, 1.4, 2.1, -0.7]) {
				const attempt = move(context, [entry.start[0] + offset, entry.start[1] + offset]);
				expect(attempt).not.toBeNull();
				attempts.push(JSON.stringify(attempt!.walls));
			}

			expect(JSON.stringify(live(context))).toBe(before);
			// The compiled geometry is the very same object: no recompilation and
			// no re-install happened, which is what the Plan/3D surfaces read.
			expect(context.layoutPreview.geometry).toBe(geometry);
			expect(context.store.canUndo).toBe(false);
			expect(context.interaction.selection && JSON.stringify(context.interaction.selection)).toBe(selection);
			expect(JSON.stringify(context.store.document)).toBe(scene);
			expect(context.snapshot).not.toBeNull();
			// The attempt follows the pointer: it is derived per move and changes
			// with it (a remembered preview could not do this).
			expect(new Set(attempts).size).toBeGreaterThan(1);
		});
	}

	it('derives a curve-control attempt from the frozen baseline too', () => {
		// A curve-control move inside the Wall's own span is a plain pending
		// attempt: nothing cheap refutes it.

		const context = makeStore(squareDocument(curvedCenterline()));
		const before = JSON.stringify(live(context));
		expect(startGesture(context, curveGesture(context, 'w1', 'w1:knot:1'))).toBe(true);
		const first = move(context, [2, 2.5]);
		const second = move(context, [3, 1.6]);
		expect(first?.walls).toHaveLength(1);
		expect(second?.walls).toHaveLength(1);
		expect(JSON.stringify(first!.walls)).not.toBe(JSON.stringify(second!.walls));
		expect(JSON.stringify(live(context))).toBe(before);
		expect(stageCount('acceptance-compile')).toBe(0);
	});

	it('never reaches the canonical planner: no acceptance, no compile, no topology', () => {
		const context = makeStore();
		expect(startGesture(context, junctionGesture(context, 'A'))).toBe(true);
		// Deltas over the drag itself: the setup's own import/compile is not part
		// of what a pointermove costs.
		const watched = [
			'proposal-derive',
			'acceptance-compile',
			'planner-exact-split',
			'topology-pre',
			'room-reconciliation',
			'preview-compile',
			'baseline-restore'
		] as const;
		const before = new Map(watched.map((name) => [name, stageCount(name)]));
		for (let index = 0; index < 8; index += 1) {
			expect(move(context, [-0.1 * (index + 1), 0])).not.toBeNull();
		}
		// The one diagnostic that matters: eight moves asked for eight proposals
		// and reached acceptance exactly zero times.
		expect(stageCount('proposal-derive') - before.get('proposal-derive')!).toBe(8);
		for (const name of watched.slice(1)) {
			expect(`${name}:${stageCount(name) - before.get(name)!}`).toBe(`${name}:0`);
		}
		expect(context.plans).toBe(0);
	});

	it('follows the pointer into a position the planner refuses', () => {
		// The live refusal is cheap and canonical: the same gate the planner runs
		// before Room reconciliation, so the drag shows red geometry the release
		// is certain to reject — never a guess.
		const context = makeStore();
		expect(startGesture(context, junctionGesture(context, 'A'))).toBe(true);
		// Junction merging is out of scope: A onto C's coordinate is always
		// refused. The attempt must still track the pointer there.
		const attempt = move(context, [4, 3]);
		expect(attempt?.walls).toBeDefined();
		expect(attempt!.walls!.length).toBeGreaterThan(0);
		// `w1` is A→B, so the moved Junction is the polyline's own start.
		const moved = attempt!.walls!.find((wall) => wall.wallId === 'w1');
		expect(moved?.points[0]).toEqual([4, 3]);
		expect(attempt!.intent).toMatchObject({ kind: 'junction-move', point: [4, 3] });
		// Junction merging is out of scope, and the canonical gate the planner
		// runs first says so: the drag is refused *while* it follows the pointer.
		expect(attempt!.status).toBe('known-invalid');
		expect(attempt!.failure?.code).toBe('duplicate_junction_point');
		expect(attempt!.intent.invalid).toBe(true);

		const outcome = release(context, [4, 3]);
		expect(outcome.kind).toBe('rejected');
		expect(outcome.statusMessage).not.toBeNull();
		// The refusal restored the exact baseline and wrote no history.
		expect(documentContentJson(live(context))).toBe(documentContentJson(squareDocument()));
		expect(context.store.canUndo).toBe(false);
		expect(context.plans).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// 2. the release is the only canonical step
// ---------------------------------------------------------------------------

describe('P23.11 transient pass — the release is the only canonical step', () => {
	it('runs the planner once and writes one history entry for a whole drag', () => {
		const context = makeStore();
		const before = JSON.stringify(live(context));
		expect(startGesture(context, junctionGesture(context, 'A'))).toBe(true);
		for (let index = 0; index < 6; index += 1) {
			move(context, [-0.2 * (index + 1), 0.1 * (index + 1)]);
		}
		expect(stageCount('acceptance-compile')).toBe(0);

		const outcome = release(context, [-1.5, 0.5]);
		expect(outcome).toMatchObject({ kind: 'committed', statusMessage: 'Moved junction', suppressNextClick: false });
		expect(context.plans).toBe(1);
		expect(context.commits).toBe(1);
		expect(context.cancels).toBe(0);
		expect(stageCount('acceptance-compile')).toBe(1);
		expect(stageCount('planner-exact-split')).toBe(0);
		finish(context);

		expect(junctionPoint(context, 'A')).toEqual([-1.5, 0.5]);
		expect(context.store.canUndo).toBe(true);
		expect(JSON.stringify(live(context))).not.toBe(before);

		// One history entry, exactly revertible.
		expect(context.store.undo()).toBe(true);
		expect(JSON.stringify(live(context))).toBe(before);
		expect(context.store.redo()).toBe(true);
		expect(junctionPoint(context, 'A')).toEqual([-1.5, 0.5]);
	});

	it('never commits a preview the planner rejects (no remembered last valid)', () => {
		const context = makeStore();
		const before = JSON.stringify(live(context));
		expect(startGesture(context, junctionGesture(context, 'A'))).toBe(true);
		// Four moves the planner would have accepted under the old per-move
		// install (each derived from the same frozen baseline).
		for (const pointer of [[-0.5, 0], [-1, 0], [-1.5, 0], [-2, 0]] as LayoutVec2[]) {
			move(context, pointer);
		}
		expect(JSON.stringify(live(context))).toBe(before);

		// The release lands somewhere refused: nothing that flashed before may
		// survive into the document.
		const outcome = release(context, [4, 3]);
		expect(outcome.kind).toBe('rejected');
		expect(context.plans).toBe(1);
		expect(context.commits).toBe(0);
		expect(context.cancels).toBe(1);
		expect(context.restores).toBe(1);
		expect(outcome.suppressNextClick).toBe(true);
		finish(context);
		expect(JSON.stringify(live(context))).toBe(before);
		expect(context.store.canUndo).toBe(false);
	});

	it('treats a sub-threshold release as a plain click', () => {
		const context = makeStore();
		const before = JSON.stringify(live(context));
		expect(startGesture(context, junctionGesture(context, 'A'))).toBe(true);
		const outcome = release(context, [1, 1], { moved: false });
		expect(outcome).toEqual({ kind: 'idle', statusMessage: null, suppressNextClick: false });
		// No planner call, one cancelled transaction, an exact baseline.
		expect(context.plans).toBe(0);
		expect(stageCount('acceptance-compile')).toBe(0);
		expect(context.cancels).toBe(1);
		expect(context.restores).toBe(1);
		finish(context);
		expect(JSON.stringify(live(context))).toBe(before);
	});

	it('commits when release displaces beyond threshold even without pointermove', () => {
		const context = makeStore();
		const before = JSON.stringify(live(context));
		expect(startGesture(context, junctionGesture(context, 'A'))).toBe(true);
		// Simulate: pointerdown at A, no pointermove, release far enough to
		// cross the drag threshold. The viewport derives movedOnRelease from
		// screen distance; we pass moved: true to simulate that derivation.
		const outcome = release(context, [-1.5, 0.5], { moved: true });
		expect(outcome.kind).toBe('committed');
		expect(context.plans).toBe(1);
		expect(context.commits).toBe(1);
		expect(JSON.stringify(live(context))).not.toBe(before);
		expect(junctionPoint(context, 'A')).toEqual([-1.5, 0.5]);
		finish(context);
	});

	it('stays idle when release displacement is under threshold and no pointermove', () => {
		const context = makeStore();
		const before = JSON.stringify(live(context));
		expect(startGesture(context, junctionGesture(context, 'A'))).toBe(true);
		// moved: false AND release position is near start → idle
		const outcome = release(context, [1.1, 1.1], { moved: false });
		expect(outcome).toEqual({ kind: 'idle', statusMessage: null, suppressNextClick: false });
		expect(context.plans).toBe(0);
		expect(context.cancels).toBe(1);
		expect(JSON.stringify(live(context))).toBe(before);
		finish(context);
	});

	it('restores baseline when release beyond threshold planner rejects', () => {
		const context = makeStore();
		const before = JSON.stringify(live(context));
		expect(startGesture(context, junctionGesture(context, 'A'))).toBe(true);
		// moved: true (derived from screen displacement), but planner rejects
		const outcome = release(context, null, { moved: true });
		expect(outcome.kind).toBe('rejected');
		expect(context.plans).toBe(1);
		expect(context.cancels).toBe(1);
		expect(context.restores).toBe(1);
		finish(context);
		expect(JSON.stringify(live(context))).toBe(before);
	});

	it('still commits normally when pointermove crosses threshold', () => {
		const context = makeStore();
		const before = JSON.stringify(live(context));
		expect(startGesture(context, junctionGesture(context, 'A'))).toBe(true);
		move(context, [-0.4, 0.2]);
		const outcome = release(context, [-1.5, 0.5]);
		expect(outcome.kind).toBe('committed');
		expect(context.plans).toBe(1);
		expect(context.commits).toBe(1);
		expect(JSON.stringify(live(context))).not.toBe(before);
		finish(context);
	});

	it('stays silent for a no_op release and reports nothing as a failure', () => {
		const calls: string[] = [];
		const outcome = releaseArchitectureEdit({
			gesture: junctionGesture(makeStore(), 'A'),
			moved: true,
			plan: () => ({ success: false, code: 'no_op', message: 'Nothing moved' }),
			commit: () => {
				calls.push('commit');
				return true;
			},
			cancel: () => calls.push('cancel'),
			restoreBaseline: () => calls.push('restore')
		});
		expect(outcome).toEqual({ kind: 'rejected', statusMessage: null, suppressNextClick: true });
		expect(calls).toEqual(['cancel', 'restore']);
	});

	it('discards the attempt on cancel, leaving the baseline exact', () => {
		const context = makeStore();
		const before = JSON.stringify(live(context));
		const geometry = context.layoutPreview.geometry;
		expect(startGesture(context, wallGesture(context, 'w1', [2, 0]))).toBe(true);
		for (const pointer of [[2, -1], [2, -2], [2, -3]] as LayoutVec2[]) move(context, pointer);
		cancelGesture(context);
		expect(JSON.stringify(live(context))).toBe(before);
		expect(context.layoutPreview.geometry).toBe(geometry);
		expect(context.store.canUndo).toBe(false);
		expect(context.interaction.architectureEdit).toBeNull();
		expect(context.snapshot).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// 3. the attempt the preview showed is the geometry that commits
// ---------------------------------------------------------------------------

describe('P23.11 transient pass — the attempt and the commit agree', () => {
	it('shows the committed centerline: same intent, same canonical sampler', () => {
		const context = makeStore();
		expect(startGesture(context, bendGesture(context, 'w1', [1, 0], 1))).toBe(true);
		const releasePoint: LayoutVec2 = [1, -1.5];
		const displayed = move(context, releasePoint);
		const displayedPoints = displayed!.walls!.find((wall) => wall.wallId === 'w1')!.points;
		// The release re-resolves the same intent from the same frozen baseline:
		// no divergence between what the user saw and what is planned.
		expect(displayed!.intent).toMatchObject({ kind: 'wall-bend', point: releasePoint });

		const outcome = release(context, releasePoint);
		expect(outcome.kind).toBe('committed');
		finish(context);

		// The committed Wall, sampled by the one canonical authority, is exactly
		// the polyline the transient layer drew.
		const committed = live(context).walls.find((wall) => wall.id === 'w1')!;
		const sampled = wallCenterlineSamples(
			{ id: 'w1', centerline: committed.centerline },
			junctionPoint(context, 'A'),
			junctionPoint(context, 'B'),
			'forward'
		);
		expect(sampled).toBeDefined();
		expect(sampled!.samples.map((sample) => [sample.point[0], sample.point[1]])).toEqual(displayedPoints);
	});

	it('keeps the Bend grab at its pointer-down arc distance in one history entry', () => {
		const context = makeStore();
		const before = JSON.stringify(live(context));
		const grabbed = 1.25;
		expect(startGesture(context, bendGesture(context, 'w1', [grabbed, 0], grabbed))).toBe(true);
		for (const pointer of [[1.25, -0.4], [1.25, -0.9]] as LayoutVec2[]) move(context, pointer);
		const outcome = release(context, [1.25, -0.9]);
		expect(outcome).toMatchObject({ kind: 'committed', statusMessage: 'Moved wall point' });
		expect(context.commits).toBe(1);
		finish(context);

		const wall = live(context).walls.find((candidate) => candidate.id === 'w1')!;
		expect(wall.centerline.kind).toBe('cubic-chain');
		if (wall.centerline.kind !== 'cubic-chain') return;
		// Insertion + placement is one edit: one knot, at the release position.
		expect(wall.centerline.knots).toHaveLength(1);
		expect(wall.centerline.knots[0]!.point).toEqual([1.25, -0.9]);
		// Both endpoint Junctions stay exactly where they were: a Bend is not a
		// rigid move, and the grabbed arc position is on the straight chord.
		expect(live(context).junctions).toEqual(squareDocument().junctions);
		expect(context.store.undo()).toBe(true);
		expect(JSON.stringify(live(context))).toBe(before);
	});
});

// ---------------------------------------------------------------------------
// 3b. live feedback is three-state: pending, or canonically known-invalid
// ---------------------------------------------------------------------------

/**
 * Two 4×3 m Rooms in a row with a 2 m gap between them: bowing Room 1's east
 * Wall towards Room 2 is the canonical "attempt crosses a neighbour" case, and
 * the only thing between a legal near-miss and an illegal crossing is 2 m.
 */
function twoRoomDocument(): LayoutDocumentWallFirst {
	// Room 1's east Wall is the fixture's own `w2` (B → C at x = 4).
	const document = squareDocument();
	document.junctions = [
		...document.junctions,
		{ id: 'E', point: [6, 0] },
		{ id: 'F', point: [10, 0] },
		{ id: 'G', point: [10, 3] },
		{ id: 'H', point: [6, 3] }
	];
	document.walls = [
		...document.walls,
		{ id: 'w-r2-north', startJunctionId: 'E', endJunctionId: 'F', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'w-r2-east', startJunctionId: 'F', endJunctionId: 'G', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'w-r2-south', startJunctionId: 'G', endJunctionId: 'H', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'w-r2-west', startJunctionId: 'H', endJunctionId: 'E', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE }
	];
	document.rooms = [
		document.rooms[0]!,
		{
			id: 'room-2',
			name: 'Room 2',
			boundary: [
				{ wallId: 'w-r2-north', direction: 'forward' },
				{ wallId: 'w-r2-east', direction: 'forward' },
				{ wallId: 'w-r2-south', direction: 'forward' },
				{ wallId: 'w-r2-west', direction: 'forward' }
			],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}
	];
	return document;
}

describe('P23.11 transient pass — cheap canonical refusal during the drag', () => {
	it('marks a Bend that would cross a neighbouring Wall known-invalid', () => {
		const baseline = twoRoomDocument();
		const context = makeStore(baseline);
		const geometry = context.layoutPreview.geometry;
		expect(startGesture(context, bendGesture(context, 'w2', [4, 1.5], 1.5))).toBe(true);

		// A 0.5 m bow stays in the gap: nothing cheap refutes it.
		const nearMiss = move(context, [4.5, 1.5]);
		expect(nearMiss!.status).toBe('pending');
		expect(nearMiss!.failure).toBeUndefined();
		expect(nearMiss!.intent.invalid).toBeUndefined();

		// A 2.5 m bow reaches Room 2's west Wall: the canonical crossing gate the
		// planner runs first refuses it, and the drag says so while it follows.
		const crossing = move(context, [6.5, 1.5]);
		expect(crossing!.status).toBe('known-invalid');
		expect(crossing!.intent.invalid).toBe(true);
		expect(crossing!.failure?.message).toMatch(/cross/i);
		// Red or not, the attempt still tracks the pointer.
		const moved = crossing!.walls!.find((wall) => wall.wallId === 'w2')!;
		expect(moved.points.length).toBeGreaterThan(2);
		expect(Math.max(...moved.points.map((point) => point[0]))).toBeCloseTo(6.5, 6);

		// A refutation is still not a write: the canonical document and its
		// compiled geometry are byte-identical to the frozen baseline.
		expect(documentContentJson(live(context))).toBe(documentContentJson(baseline));
		expect(context.layoutPreview.geometry).toBe(geometry);
		expect(context.store.canUndo).toBe(false);
	});

	it('leaves everything after the cheap gate pending, and the release decides it', () => {
		// `w1` hosts the fixture's door (arc 1–2 m of a 4 m Wall). Moving Junction
		// `B` in shortens it to 1.5 m, so the canonical **Opening set** rejects the
		// candidate — a stage the planner runs *after* topology, and exactly the
		// kind of verdict a pointermove must not pretend to know.
		const context = makeStore();
		const before = JSON.stringify(live(context));
		expect(startGesture(context, junctionGesture(context, 'B'))).toBe(true);
		const watched = [
			'room-reconciliation',
			'face-extraction',
			'opening-set',
			'portal-relations',
			'acceptance-compile',
			'preview-compile'
		] as const;
		const counts = new Map(watched.map((name) => [name, stageCount(name)]));
		const attempt = move(context, [1.5, 0]);
		expect(attempt!.status).toBe('pending');
		expect(attempt!.failure).toBeUndefined();
		expect(attempt!.intent.invalid).toBeUndefined();

		// Nothing downstream of the cheap gate ran, so every verdict that only
		// exists there stayed pending — the release is what decides it.
		for (const name of watched) {
			expect(`${name}:${stageCount(name) - counts.get(name)!}`).toBe(`${name}:0`);
		}

		const outcome = release(context, [1.5, 0]);
		expect(outcome.kind).toBe('rejected');
		expect(context.plans).toBe(1);
		finish(context);
		expect(JSON.stringify(live(context))).toBe(before);
		expect(context.store.canUndo).toBe(false);
	});

	it('keeps a legal attempt pending and commits it on release', () => {
		const context = makeStore(twoRoomDocument());
		expect(startGesture(context, bendGesture(context, 'w2', [4, 1.5], 1.5))).toBe(true);
		const attempt = move(context, [4.6, 1.5]);
		expect(attempt!.status).toBe('pending');
		expect(attempt!.failure).toBeUndefined();
		const outcome = release(context, [4.6, 1.5]);
		expect(outcome.kind).toBe('committed');
		expect(context.commits).toBe(1);
		finish(context);
		const wall = live(context).walls.find((candidate) => candidate.id === 'w2')!;
		expect(wall.centerline.kind).toBe('cubic-chain');
	});
});

// ---------------------------------------------------------------------------
// 4. domains the transient layer must not touch
// ---------------------------------------------------------------------------

describe('P23.11 transient pass — isolation', () => {
	it('leaves Room/Opening identity, Layout selection and the Scene domain alone', () => {
		const context = makeStore();
		const { store, interaction } = context;
		selectLayoutPhysicalWall(interaction, 'w1');
		const selection = JSON.stringify(interaction.selection);
		const scene = JSON.stringify(store.document);
		const sceneSelection = JSON.stringify([...store.selectedPlacementIds]);
		const cameraSelection = JSON.stringify(store.cameraSelection);
		const cameraFocus = store.cameraFocusVersion;
		const rooms = live(context).rooms.map((room) => ({ id: room.id, boundary: room.boundary.length }));
		const openings = live(context).openings.map((opening) => ({ id: opening.id, wallId: opening.wallId }));

		expect(startGesture(context, bendGesture(context, 'w1', [1, 0], 1))).toBe(true);
		move(context, [1, -1]);
		move(context, [1, -2]);
		// Selection is stable through the whole drag (the attempt writes the
		// gesture, never the selection authority).
		expect(JSON.stringify(interaction.selection)).toBe(selection);
		expect(JSON.stringify(store.document)).toBe(scene);

		const outcome = release(context, [1, -1.5]);
		expect(outcome.kind).toBe('committed');
		finish(context);

		// The planner owns Room and Opening identity: a Bend adds no Room, no
		// Opening and re-parents nothing.
		expect(live(context).rooms.map((room) => ({ id: room.id, boundary: room.boundary.length }))).toEqual(rooms);
		expect(live(context).openings.map((opening) => ({ id: opening.id, wallId: opening.wallId }))).toEqual(openings);
		expect(JSON.stringify(interaction.selection)).toBe(selection);
		expect(JSON.stringify(store.document)).toBe(scene);
		expect(JSON.stringify([...store.selectedPlacementIds])).toBe(sceneSelection);
		expect(JSON.stringify(store.cameraSelection)).toBe(cameraSelection);
		expect(store.cameraFocusVersion).toBe(cameraFocus);
	});

	it('keeps the selection authority in the interaction state, not the proposal', () => {
		const context = makeStore();
		selectLayoutJunction(context.interaction, 'A');
		const selection = JSON.stringify(context.interaction.selection);
		// A Wall move under a selected Junction: the gesture changes, the
		// selection does not, because no render path can write it.
		expect(startGesture(context, wallGesture(context, 'w1', [2, 0]))).toBe(true);
		move(context, [2, -1]);
		expect(JSON.stringify(context.interaction.selection)).toBe(selection);
	});

	it('proposes from the frozen baseline, never from the live preview', () => {
		const context = makeStore();
		expect(startGesture(context, junctionGesture(context, 'A'))).toBe(true);
		// A private copy of the baseline is what the proposal reads: mutating the
		// live document behind the gesture's back must be visible in the attempt,
		// which proves the attempt is a function of (frozen baseline, intent).
		const frozen = move(context, [-1, 0]);
		const intent = architectureEditProposalIntent(context.interaction.architectureEdit!);
		expect(intent).toEqual({ kind: 'junction-move', junctionId: 'A', point: [-1, 0] });
		// `w4` is D→A: its tail is the moved Junction, its head is untouched D.
		const neighbour = frozen!.walls!.find((wall) => wall.wallId === 'w4')!;
		expect(neighbour.points.at(-1)).toEqual([-1, 0]);
		expect(neighbour.points[0]).toEqual([0, 3]);
	});
});
