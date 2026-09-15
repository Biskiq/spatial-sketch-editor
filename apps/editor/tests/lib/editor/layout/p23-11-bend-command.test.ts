/**
 * P23.11 Slice 7 — the Bend command, the frozen gesture contract and the
 * no-keyboard authoring path.
 *
 * Three properties are pinned here, and they are the ones that keep the
 * feature honest:
 *
 * - **the modifier is a command** — `layout.wall.bend` resolves from a
 *   platform + modifier snapshot, matches exactly, and is remappable by
 *   swapping a binding table. No consumer reads `metaKey`/`altKey` as product
 *   logic, so no consumer changes when the binding does;
 * - **the intent is frozen at pointer-down** — the gesture carries the resolved
 *   command and a total-delta anchor, so it can neither lose a bend to rigid
 *   translation on release-the-key nor acquire one by pressing the key
 *   mid-drag;
 * - **one insertion authority** — the ⌘-drag gesture, the Inspector and the
 *   Wall context menu all reach the same canonical chain-algebra planner, so
 *   discoverability never buys a second curve-editing implementation.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	deriveChainSpans,
	planInsertWallCurveKnot,
	wallCubicChain,
	wallCurveKnotArcDistance,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWallCurveKnot
} from '@portfolio/layout-core';

import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import {
	heldEditorModifiers,
	resolveEditorCommandIntent,
	resolveEditorPlatform,
	EDITOR_COMMAND_BINDING_DEFAULTS,
	type EditorCommandBinding,
	type EditorModifierSnapshot
} from '$lib/editor/editor-command-intent';
import {
	architectureEditAllowedKinds,
	architectureEditExcludePoints,
	architectureEditRawTarget,
	beginLayoutArchitectureEdit,
	createLayoutInteractionState,
	updateLayoutArchitectureEdit,
	type LayoutArchitectureEditGesture
} from '$lib/editor/layout/layout-interaction';
import {
	captureLayoutPreviewSnapshot,
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	insertWallFirstWallCurveKnot,
	layoutPreviewDocument,
	restoreLayoutPreviewSnapshot,
	updateWallFirstWallBend,
	updateWallFirstWallMove,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import { buildPlanLayoutContextMenuItems } from '$lib/editor/context-menu/plan-menu-items';
import {
	createEmptyWallFirstLayoutDocument,
	serializeWallFirstLayoutDocument
} from '$lib/layout/layout-wall-first-codec';

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const LINE = { kind: 'line' } as const;
const CHORD = 12;

function knotsOf(...points: LayoutVec2[]): LayoutWallCurveKnot[] {
	return points.map((point, index) => ({
		id: `wall-a:knot:${index + 1}`,
		point: [point[0], point[1]] as LayoutVec2
	}));
}

/** A canonical chain from a point list, using the write-path smoothness rule. */
function chainOf(start: LayoutVec2, end: LayoutVec2, ...interior: LayoutVec2[]) {
	return wallCubicChain(knotsOf(...interior), deriveChainSpans([start, ...interior, end]));
}

/**
 * `wall-a` (j-a → j-b) plus one open partition Wall, so no face is enclosed and
 * the default fixture is a legal document without a Room.
 */
function documentOf(centerline: LayoutDocumentWallFirst['walls'][number]['centerline'] = LINE): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [CHORD, 0] },
		{ id: 'j-c', point: [CHORD, 4] },
		{ id: 'j-d', point: [0, 4] }
	];
	document.walls = [
		{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'partition', thickness: 0.2, height: 3, centerline },
		{ id: 'wall-x', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'partition', thickness: 0.2, height: 3, centerline: LINE }
	];
	return document;
}

function makeStore(seed: LayoutDocumentWallFirst = documentOf()) {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const layoutPreview = createEmptyLayoutPreviewState();
	if (!importLayoutPreviewJson(layoutPreview, serializeWallFirstLayoutDocument(seed))) {
		throw new Error('wall-first import failed');
	}
	store.registerLayoutHistory({
		capture: () => captureLayoutPreviewSnapshot(layoutPreview),
		replace: (snapshot) => restoreLayoutPreviewSnapshot(layoutPreview, snapshot as never),
		matches: (a, b) =>
			JSON.stringify((a as { project: { layout: unknown } }).project.layout) ===
			JSON.stringify((b as { project: { layout: unknown } }).project.layout)
	});
	store.setLayoutFormatPolicySource(() => layoutPreview);
	return { store, layoutPreview };
}

function wallFirstDocument(state: LayoutPreviewState): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(state);
	if (!('formatVersion' in document)) throw new Error('expected a wall-first document');
	return document;
}

const VIEWPORT_PATH = resolve(process.cwd(), 'src/lib/editor/layout/LayoutPlanViewport.svelte');

function viewportSource(): string {
	return readFileSync(VIEWPORT_PATH, 'utf8');
}

// ---------------------------------------------------------------------------
// the command layer
// ---------------------------------------------------------------------------

const MAC = 'mac' as const;
const OTHER = 'other' as const;

function snapshot(...held: Array<'meta' | 'ctrl' | 'alt' | 'shift'>): EditorModifierSnapshot {
	return {
		meta: held.includes('meta'),
		ctrl: held.includes('ctrl'),
		alt: held.includes('alt'),
		shift: held.includes('shift')
	};
}

describe('P23.11 slice 7 — Bend is a named editor command', () => {
	it('resolves ⌘ alone on macOS', () => {
		expect([...resolveEditorCommandIntent(snapshot('meta'), MAC)]).toEqual(['layout.wall.bend']);
		expect(EDITOR_COMMAND_BINDING_DEFAULTS.mac).toEqual([
			{ command: 'layout.wall.bend', hold: ['meta'] }
		]);
	});

	it('resolves Alt alone on the other platforms', () => {
		expect([...resolveEditorCommandIntent(snapshot('alt'), OTHER)]).toEqual(['layout.wall.bend']);
		// The wrong platform's default never resolves — no token is implied.
		expect([...resolveEditorCommandIntent(snapshot('meta'), OTHER)]).toEqual([]);
	});

	it('matches modifiers exactly: an extra held modifier never resolves', () => {
		for (const extra of [snapshot('meta', 'shift'), snapshot('meta', 'alt'), snapshot('meta', 'ctrl')]) {
			expect([...resolveEditorCommandIntent(extra, MAC)]).toEqual([]);
		}
		// And the bare modifiers that carry other meanings stay unclaimed.
		for (const bare of [snapshot('shift'), snapshot('alt'), snapshot('ctrl'), snapshot()]) {
			expect([...resolveEditorCommandIntent(bare, MAC)]).toEqual([]);
		}
		// An explicit ⌘⇧ binding is how a future shortcut claims the combination.
		const rebound: EditorCommandBinding[] = [{ command: 'layout.wall.bend', hold: ['meta', 'shift'] }];
		expect([...resolveEditorCommandIntent(snapshot('meta', 'shift'), MAC, rebound)]).toEqual([
			'layout.wall.bend'
		]);
		expect([...resolveEditorCommandIntent(snapshot('meta'), MAC, rebound)]).toEqual([]);
	});

	it('rebinding changes resolution with no consumer change', () => {
		const rebound: EditorCommandBinding[] = [{ command: 'layout.wall.bend', hold: ['ctrl', 'shift'] }];
		expect([...resolveEditorCommandIntent(snapshot('ctrl', 'shift'), MAC, rebound)]).toEqual([
			'layout.wall.bend'
		]);
		// The default macOS binding is gone under the new table — the resolver,
		// not a hard-coded key check, is what decides.
		expect([...resolveEditorCommandIntent(snapshot('meta'), MAC, rebound)]).toEqual([]);
	});

	it('is pure and injectable', () => {
		const held = snapshot('meta', 'shift');
		const frozen = JSON.stringify(held);
		const first = resolveEditorCommandIntent(held, MAC);
		const second = resolveEditorCommandIntent(held, MAC);
		expect([...first]).toEqual([...second]);
		expect(JSON.stringify(held)).toBe(frozen);
		expect(heldEditorModifiers(held)).toEqual(['meta', 'shift']);

		expect(resolveEditorPlatform({ platform: 'MacIntel' })).toBe('mac');
		expect(resolveEditorPlatform({ platform: 'iPhone' })).toBe('mac');
		expect(
			resolveEditorPlatform({ platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0)' })
		).toBe('other');
		expect(
			resolveEditorPlatform({ platform: '', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)' })
		).toBe('mac');
		expect(resolveEditorPlatform(null)).toBe('other');
	});
});

// ---------------------------------------------------------------------------
// the frozen gesture contract
// ---------------------------------------------------------------------------

function bendGesture(overrides: Partial<Extract<LayoutArchitectureEditGesture, { kind: 'wall-bend' }>> = {}) {
	return {
		kind: 'wall-bend' as const,
		command: 'layout.wall.bend' as const,
		pointerId: 7,
		wallId: 'wall-a',
		startPointer: [3, 1] as LayoutVec2,
		baselineGrabPoint: [3, 0.25] as LayoutVec2,
		bendDistance: 3,
		bendExcludePoints: [[0, 0] as LayoutVec2, [CHORD, 0] as LayoutVec2],
		affectedWallIds: ['wall-a'],
		candidatePoint: [3, 0.25] as LayoutVec2,
		valid: false,
		...overrides
	};
}

describe('P23.11 slice 7 — the Bend gesture is frozen at pointer-down', () => {
	it('stores the resolved command and never a live modifier flag', () => {
		const state = createLayoutInteractionState();
		beginLayoutArchitectureEdit(state, bendGesture());
		const gesture = state.architectureEdit!;
		expect(gesture.kind).toBe('wall-bend');
		// The resolved intent is recorded ON the gesture; there is no modifier
		// field, so no later pointer event can re-decide the gesture owner.
		expect((gesture as { command: string }).command).toBe('layout.wall.bend');
		expect(Object.keys(gesture)).not.toContain('metaKey');
		expect(Object.keys(gesture)).not.toContain('altKey');
		expect(Object.keys(gesture)).not.toContain('shiftKey');
	});

	it('is grab-relative and order-independent, like the other point anchors', () => {
		const state = createLayoutInteractionState();
		beginLayoutArchitectureEdit(state, bendGesture());
		// Total displacement from the immutable grab point — never a sum of
		// per-move deltas, so intermediate moves cannot accumulate error.
		expect(architectureEditRawTarget(state.architectureEdit!, [5, 2])).toEqual([5, 1.25]);
		expect(architectureEditRawTarget(state.architectureEdit!, [4, 1])).toEqual([4, 0.25]);
		// Releasing the modified pointer at the grabbed position is a total
		// displacement of zero, i.e. the identity-preserving release.
		expect(architectureEditRawTarget(state.architectureEdit!, [3, 1])).toEqual([3, 0.25]);
	});

	it('reports a point candidate and resets validity on every update', () => {
		const state = createLayoutInteractionState();
		beginLayoutArchitectureEdit(state, bendGesture());
		state.architectureEdit!.valid = true;
		state.architectureEdit!.rejectionCode = 'geometry_invalid';
		expect(updateLayoutArchitectureEdit(state, [5, 2])).toEqual([5, 2]);
		expect(state.architectureEdit!.candidatePoint).toEqual([5, 2]);
		// A stale validity can never survive into the release commit.
		expect(state.architectureEdit!.valid).toBe(false);
		expect(state.architectureEdit!.rejectionCode).toBeUndefined();
	});

	it('snaps like a point-anchored gesture, not like a rigid move', () => {
		const gesture = bendGesture();
		// A bend point landing on a Junction coordinate can only reject, so the
		// `'junction'` family is dropped and the baseline coordinates excluded by
		// point — exactly the curve-control rule.
		expect(architectureEditAllowedKinds(gesture)).toBeDefined();
		expect(architectureEditExcludePoints(gesture)).toEqual([
			[0, 0],
			[CHORD, 0]
		]);
		// A rigid Wall move keeps the full P23.2 ranking and excludes no point.
		expect(
			architectureEditAllowedKinds({
				kind: 'wall-move',
				pointerId: 1,
				wallId: 'wall-a',
				startPointer: [0, 0],
				baselineGrabPoint: [0, 0],
				startJunctionId: 'j-a',
				endJunctionId: 'j-b',
				baselineStart: [0, 0],
				baselineEnd: [CHORD, 0],
				affectedWallIds: ['wall-a'],
				candidateDelta: [0, 0],
				valid: false
			})
		).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// the adapter path: one drag, one curve, one history entry
// ---------------------------------------------------------------------------

describe('P23.11 slice 7 — Bend drag through the app adapter', () => {
	it('curves a straight Wall in one history entry, with exact Undo/Redo', () => {
		const { store, layoutPreview } = makeStore();
		const before = JSON.stringify(layoutPreviewDocument(layoutPreview));
		expect(store.canUndo).toBe(false);

		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => updateWallFirstWallBend(layoutPreview, 'wall-a', { distance: 3, point: [3, 1] }),
			(result) => result.success
		);
		if (outcome.kind !== 'committed') throw new Error(`expected one commit: ${JSON.stringify(outcome)}`);
		expect(outcome.result.success).toBe(true);

		const bent = wallFirstDocument(layoutPreview);
		const wall = bent.walls.find((candidate) => candidate.id === 'wall-a')!;
		// Straight ⇒ curve automatically: no "convert first" step, and the one
		// drag inserted exactly one bend point.
		expect(wall.centerline.kind).toBe('cubic-chain');
		if (wall.centerline.kind !== 'cubic-chain') return;
		expect(wall.centerline.knots).toHaveLength(1);
		expect(wall.centerline.spans).toHaveLength(2);
		expect(wall.centerline.knots[0]!.point).toEqual([3, 1]);
		// Both endpoint Junctions are untouched: a bend is not a rigid move.
		expect(bent.junctions).toEqual(documentOf().junctions);
		expect(store.canUndo).toBe(true);

		expect(store.undo()).toBe(true);
		expect(JSON.stringify(layoutPreviewDocument(layoutPreview))).toBe(before);
		expect(store.canUndo).toBe(false);
		expect(store.redo()).toBe(true);
		expect(JSON.stringify(layoutPreviewDocument(layoutPreview))).toBe(JSON.stringify(bent));
	});

	it('inserts and bends at the grabbed arc position on an existing curve', () => {
		const seed = documentOf(chainOf([0, 0], [CHORD, 0], [6, 2]));
		const { store, layoutPreview } = makeStore(seed);
		const wall = seed.walls.find((candidate) => candidate.id === 'wall-a')!;
		if (wall.centerline.kind !== 'cubic-chain') throw new Error('expected a chain');
		const grabbed = 4;

		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => updateWallFirstWallBend(layoutPreview, 'wall-a', { distance: grabbed, point: [4, 1] }),
			(result) => result.success
		);
		if (outcome.kind !== 'committed') throw new Error(`expected one commit: ${JSON.stringify(outcome)}`);
		const bent = wallFirstDocument(layoutPreview);
		const bentWall = bent.walls.find((candidate) => candidate.id === 'wall-a')!;
		if (bentWall.centerline.kind !== 'cubic-chain') throw new Error('expected a chain');
		// Two bend points now: the authored bow plus the grabbed position.
		expect(bentWall.centerline.knots).toHaveLength(2);
		// The new knot sits at the measured release point, and the ORIGINAL
		// authored bend point is still exactly where it was.
		const original = bentWall.centerline.knots.find((knot) => knot.id === 'wall-a:knot:1')!;
		expect(original.point).toEqual([6, 2]);
		const insertedPoint = bentWall.centerline.knots
			.filter((knot) => knot.id !== 'wall-a:knot:1')
			.map((knot) => knot.point);
		expect(insertedPoint).toHaveLength(1);

		expect(store.undo()).toBe(true);
		expect(JSON.stringify(layoutPreviewDocument(layoutPreview))).toBe(JSON.stringify(seed));
	});

	it('restores the exact baseline and writes nothing for an invalid release', () => {
		const { store, layoutPreview } = makeStore();
		const before = JSON.stringify(layoutPreviewDocument(layoutPreview));

		// Out of range: past the end of the Wall.
		const outOfRange = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => updateWallFirstWallBend(layoutPreview, 'wall-a', { distance: CHORD + 5, point: [13, 0] }),
			(result) => result.success
		);
		expect(outOfRange.kind).toBe('cancelled');
		// Non-finite release point.
		const nonFinite = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => updateWallFirstWallBend(layoutPreview, 'wall-a', { distance: 3, point: [Number.NaN, 1] }),
			(result) => result.success
		);
		expect(nonFinite.kind).toBe('cancelled');

		expect(store.canUndo).toBe(false);
		expect(JSON.stringify(layoutPreviewDocument(layoutPreview))).toBe(before);
	});

	it('keeps a plain Wall drag rigid and straight', () => {
		const { store, layoutPreview } = makeStore();
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => updateWallFirstWallMove(layoutPreview, 'wall-a', [0, 1]),
			(result) => result.success
		);
		if (outcome.kind !== 'committed') throw new Error('expected a commit');
		const moved = wallFirstDocument(layoutPreview);
		const wall = moved.walls.find((candidate) => candidate.id === 'wall-a')!;
		// No bend intent ⇒ no bend: the P23.10 contract is untouched.
		expect(wall.centerline).toEqual({ kind: 'line' });
		expect(moved.junctions.find((junction) => junction.id === 'j-a')?.point).toEqual([0, 1]);
		expect(moved.junctions.find((junction) => junction.id === 'j-b')?.point).toEqual([CHORD, 1]);
	});
});

// ---------------------------------------------------------------------------
// the no-keyboard authoring path
// ---------------------------------------------------------------------------

describe('P23.11 slice 7 — no-keyboard authoring reaches the same planner', () => {
	it('offers Add bend point here only with a resolved here', () => {
		const wall = { kind: 'wall' as const, wallId: 'wall-a', splitDistance: 4 };
		const withAction = buildPlanLayoutContextMenuItems({
			target: wall,
			mutationBlockedReason: null,
			actions: {
				deleteOpening: () => {},
				deleteObject: () => {},
				addBendPoint: () => {}
			}
		});
		expect(withAction.map((item) => item.id)).toContain('add-bend-point');
		expect(withAction.map((item) => item.label)).toContain('Add bend point here');

		// Omit-don't-dummy: a mount without the command gets no item, and
		// neither does a hit with no resolved coordinate.
		const withoutAction = buildPlanLayoutContextMenuItems({
			target: wall,
			mutationBlockedReason: null,
			actions: { deleteOpening: () => {}, deleteObject: () => {} }
		});
		expect(withoutAction.map((item) => item.id)).not.toContain('add-bend-point');

		const withoutDistance = buildPlanLayoutContextMenuItems({
			target: { kind: 'wall', wallId: 'wall-a' },
			mutationBlockedReason: null,
			actions: {
				deleteOpening: () => {},
				deleteObject: () => {},
				addBendPoint: () => {}
			}
		});
		expect(withoutDistance.map((item) => item.id)).not.toContain('add-bend-point');
	});

	it('reaches the canonical insertion planner through the adapter', () => {
		// A Wall that is already a chain: **Add bend point here** must land the new
		// knot ON the curve, exactly where the canonical planner puts it.
		const baseline = documentOf(chainOf([0, 0], [CHORD, 0], [6, 2]));
		const { layoutPreview } = makeStore(baseline);
		const distance = 4;

		const direct = planInsertWallCurveKnot(baseline, 'wall-a', distance);
		if (direct.kind !== 'success') throw new Error('expected the planner to accept');

		const inserted = insertWallFirstWallCurveKnot(layoutPreview, 'wall-a', distance);
		expect(inserted.success).toBe(true);
		// The adapter is a pass-through: the same document the planner produced,
		// so the context action, the Inspector and the gesture cannot diverge.
		expect(JSON.stringify(wallFirstDocument(layoutPreview))).toBe(JSON.stringify(direct.document));

		const wall = wallFirstDocument(layoutPreview).walls.find((candidate) => candidate.id === 'wall-a')!;
		if (wall.centerline.kind !== 'cubic-chain') throw new Error('expected a chain');
		expect(wall.centerline.knots).toHaveLength(2);
		// Insertion without a drag is identity-preserving: the new knot sits at
		// the requested arc distance on the existing curve, and the authored bow
		// has not moved.
		expect(
			wall.centerline.knots.find((knot) => knot.id === 'wall-a:knot:1')!.point
		).toEqual([6, 2]);
		const fresh = wall.centerline.knots.find((knot) => knot.id !== 'wall-a:knot:1')!;
		expect(
			wallCurveKnotArcDistance(
				{
					startPoint: [0, 0],
					endPoint: [CHORD, 0],
					knots: wall.centerline.knots,
					spans: wall.centerline.spans
				},
				fresh.id
			)
		).toBeCloseTo(distance, 6);
	});

	it('leads a straight Wall to the visible Convert action', () => {
		// Insertion is a chain operation, so a straight Wall refuses it — with a
		// message naming the visible action that unblocks it. That is the whole
		// no-keyboard path: Convert (Inspector) then Add bend point, no modifier.
		const { layoutPreview } = makeStore();
		const refused = insertWallFirstWallCurveKnot(layoutPreview, 'wall-a', 4);
		expect(refused.success).toBe(false);
		expect(refused.message).toContain('convert it to a curve');

		const converted = updateWallFirstWallBend(layoutPreview, 'wall-a', { distance: 4, point: [4, 0] });
		expect(converted.success).toBe(true);
		const wall = wallFirstDocument(layoutPreview).walls.find((candidate) => candidate.id === 'wall-a')!;
		expect(wall.centerline.kind).toBe('cubic-chain');
	});

	it('keeps one insertion implementation', () => {
		// Both surfaces call the adapter; neither reaches the core planner or
		// derives an insertion distance of its own.
		const inspector = readFileSync(
			resolve(process.cwd(), 'src/lib/editor/EditorInspector.svelte'),
			'utf8'
		);
		const workspace = readFileSync(resolve(process.cwd(), 'src/lib/editor/app/PlanWorkspace.svelte'), 'utf8');
		const adapter = readFileSync(
			resolve(process.cwd(), 'src/lib/editor/layout/layout-preview-state.svelte.ts'),
			'utf8'
		);
		expect(inspector).toContain('insertWallFirstWallCurveKnot');
		expect(workspace).toContain('insertWallFirstWallCurveKnot');
		// Only the adapter knows the core planner's name.
		expect(adapter).toContain('planInsertWallCurveKnot');
		expect(inspector).not.toContain('planInsertWallCurveKnot');
	});
});

// ---------------------------------------------------------------------------
// source contracts on the one surface that owns gesture ownership
// ---------------------------------------------------------------------------

describe('P23.11 slice 7 — the viewport consumes the intent, not a key', () => {
	it('resolves the command from a modifier snapshot and never branches on metaKey/altKey', () => {
		const source = viewportSource();
		const start = source.indexOf('function commandIntentFor(');
		expect(start).toBeGreaterThan(-1);
		const end = source.indexOf('function clearLayoutSnapFeedback', start);
		const resolver = source.slice(start, end);
		// The snapshot constructor is the ONLY place the Wall-body path reads a
		// raw modifier flag, and it hands it straight to the resolver.
		expect(resolver).toContain('resolveEditorCommandIntent');
		expect(resolver).toMatch(/meta:\s*event\.metaKey/);
		expect(resolver).toMatch(/alt:\s*event\.altKey/);

		// Neither Wall-body branch reads a key: both ask the resolved intent.
		// (Other gestures keep their own contracts — the scene-object pick reads
		// ⌘/Ctrl for its toggle, and a keydown handler reads the flags for scene
		// delete — but neither of those owns the Wall body.)
		const legacyStart = source.indexOf("if (target.kind === 'wall') ");
		const controlStart = source.indexOf("if (target.kind === 'wallCurveControl')");
		const physicalStart = source.indexOf("if (target.kind === 'physicalWall')");
		const roomStart = source.indexOf("if (target.kind !== 'room') return;", physicalStart);
		expect(legacyStart).toBeGreaterThan(-1);
		expect(controlStart).toBeGreaterThan(legacyStart);
		expect(physicalStart).toBeGreaterThan(controlStart);
		expect(roomStart).toBeGreaterThan(physicalStart);

		const legacyBranch = source.slice(legacyStart, controlStart);
		const physicalBranch = source.slice(physicalStart, roomStart);
		for (const branch of [legacyBranch, physicalBranch]) {
			expect(branch).toContain('commandIntentFor(event)');
			expect(branch).not.toMatch(/metaKey|altKey/);
		}
	});

	it('routes a Wall-body press through the Bend command and gates the legacy bend', () => {
		const source = viewportSource();
		expect(source).toContain("commandIntentFor(event).has('layout.wall.bend')");
		// The canonical branch resolves the intent into a bend gesture, and the
		// legacy branch is gated by the same intent instead of bending by default.
		const physical = source.slice(source.indexOf("if (target.kind === 'physicalWall')"));
		expect(physical).toContain("kind: 'wall-bend'");
		expect(physical).toContain('bendDistance: target.projection.offset');
		expect(physical).toContain("kind: 'wall-move'");

		const legacy = source.slice(source.indexOf("if (target.kind === 'wall')"));
		const legacyGuard = legacy.slice(0, legacy.indexOf('pendingWallBend = {'));
		expect(legacyGuard).toContain("commandIntentFor(event).has('layout.wall.bend')");
	});

	it('introduces no tangent-handle surface', () => {
		// Bend points are the visible model. The chain's control points stay
		// hidden implementation geometry: no render primitive, hit kind,
		// selection variant or Inspector row addresses them.
		const planHit = readFileSync(resolve(process.cwd(), 'src/lib/editor/layout/plan-hit.ts'), 'utf8');
		expect(planHit).not.toMatch(/curveHandle|controlHandle|tangentHandle/);
		const selection = readFileSync(
			resolve(process.cwd(), 'src/lib/editor/layout/layout-interaction.ts'),
			'utf8'
		);
		expect(selection).not.toMatch(/'curveHandle'|'controlHandle'|'tangentHandle'/);
	});
});
