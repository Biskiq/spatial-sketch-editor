/**
 * P23.6I — continuous Wall-run height (I3, editor half).
 *
 * The durable birth rule lives in the pure planner (`resolveWallBirthHeight`, see
 * `p23-6i-wall-birth-height.test.ts`). The editor owns only the **transient
 * continuation** value:
 *
 * ```text
 * first segment of a run → no explicit height  → core resolves from topology
 * later segments         → wallChainRunHeight  → passed back explicitly
 * ```
 *
 * That split is what keeps one continuous draw vertically coherent: turning onto
 * a Junction whose incident Wall is taller (or whose incident heights disagree)
 * must not change the height of the run in progress, while a *new* run at that
 * same Junction resolves from topology again.
 *
 * `wallChainRunHeight` is transient by construction: not persisted, never in
 * history, and cleared on every run-end path alongside the rest of the run state.
 */
import { describe, expect, it } from 'vitest';
import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import {
	advanceWallChainContinuation,
	beginWallChain,
	cancelWallChainRun,
	captureWallChainRun,
	createLayoutInteractionState,
	restoreWallChainRun,
	setLayoutDraftTool
} from '$lib/editor/layout/layout-interaction';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import {
	captureLayoutPreviewSnapshot,
	commitWallSegment,
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	layoutPreviewSnapshotMatchesLive,
	resetLayoutPreview,
	restoreLayoutPreviewSnapshot
} from '$lib/editor/layout/layout-preview-state.svelte';
import { serializeWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	planWallSegment,
	WALL_AUTHORING_DEFAULT_HEIGHT,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

/**
 * Baseline: one 4 m partition Wall running north from the origin, so the Junction
 * `(0,0)` has exactly one incident height to inherit.
 */
function tallWallDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'a', point: [0, 0] },
			{ id: 'b', point: [0, 3] }
		],
		walls: [
			{
				id: 'w1',
				startJunctionId: 'a',
				endJunctionId: 'b',
				role: 'partition',
				thickness: 0.2,
				height: 4,
				centerline: { kind: 'line' } as const,
			}
		],
		rooms: [],
		openings: [],
		objects: []
	};
}

function emptyDocument(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [],
		walls: [],
		rooms: [],
		openings: [],
		objects: []
	};
}

function makeStore(document: LayoutDocumentWallFirst) {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const layoutPreview = createEmptyLayoutPreviewState();
	const imported = importLayoutPreviewJson(
		layoutPreview,
		serializeWallFirstLayoutDocument(document)
	);
	if (!imported) throw new Error('wall-first import failed');
	const layoutInteraction = createLayoutInteractionState();
	store.registerLayoutHistory({
		capture: () => captureLayoutPreviewSnapshot(layoutPreview),
		replace: (snapshot) => {
			const typed = snapshot as ReturnType<typeof captureLayoutPreviewSnapshot>;
			if (!layoutPreviewSnapshotMatchesLive(layoutPreview, typed)) {
				cancelWallChainRun(layoutInteraction);
			}
			restoreLayoutPreviewSnapshot(layoutPreview, typed);
		},
		matches: (a, b) =>
			JSON.stringify((a as { project: { layout: unknown } }).project.layout) ===
			JSON.stringify((b as { project: { layout: unknown } }).project.layout)
	});
	store.setLayoutFormatPolicySource(() => layoutPreview);
	return { store, layoutPreview, layoutInteraction };
}

type Store = ReturnType<typeof makeStore>;

function liveDocument(context: Store): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(context.layoutPreview);
	if (!('formatVersion' in document)) throw new Error('expected wall-first document');
	return document;
}

function junctionPoint(document: LayoutDocumentWallFirst, junctionId: string): LayoutVec2 {
	const junction = document.junctions.find((candidate) => candidate.id === junctionId);
	if (!junction) throw new Error(`missing junction ${junctionId}`);
	return [...junction.point] as LayoutVec2;
}

/**
 * Exactly the viewport's flow: pass the live transient run height in (if any),
 * then seed continuation from the committed result — including its height.
 */
function commitRunSegment(
	context: Store,
	start: LayoutVec2,
	end: LayoutVec2,
	role: 'boundary' | 'partition' = 'partition'
) {
	const { store, layoutPreview, layoutInteraction } = context;
	const outcome = runLayoutMutation(
		layoutMutationRunnerFor(store, layoutPreview),
		() =>
			commitWallSegment(
				layoutPreview,
				start,
				end,
				role,
				layoutInteraction.wallChainRunHeight ?? undefined
			),
		(result) => result.success
	);
	if (outcome.kind !== 'committed') return outcome;
	const result = outcome.result;
	if (!result.success || result.operation !== 'wall-segment-commit') {
		throw new Error('unexpected commit result');
	}
	const document = liveDocument(context);
	const runStartBefore = layoutInteraction.wallChainRunStartJunctionId;
	const closedRun =
		role === 'boundary' &&
		result.endJunctionId === (runStartBefore ?? result.startJunctionId);
	if (closedRun) {
		cancelWallChainRun(layoutInteraction);
	} else {
		advanceWallChainContinuation(layoutInteraction, {
			endPoint: junctionPoint(document, result.endJunctionId),
			endJunctionId: result.endJunctionId,
			startJunctionId: result.startJunctionId,
			...(result.wallHeight !== undefined ? { wallHeight: result.wallHeight } : {})
		});
	}
	return outcome;
}

/**
 * Height of the Wall the commit actually authored, read from the live document
 * through the result's own `wallIds` — never from a hardcoded generated ID.
 */
function authoredHeight(context: Store, outcome: ReturnType<typeof commitRunSegment>): number {
	if (outcome.kind !== 'committed') throw new Error(`expected a commit: ${outcome.kind}`);
	const result = outcome.result;
	if (!result.success || result.operation !== 'wall-segment-commit') {
		throw new Error('unexpected commit result');
	}
	const wallId = result.wallIds[0];
	if (!wallId) throw new Error('commit reported no authored Wall');
	const wall = liveDocument(context).walls.find((candidate) => candidate.id === wallId);
	if (!wall) throw new Error(`missing authored wall ${wallId}`);
	return wall.height;
}

describe('P23.6I continuous Wall-run height — one run, one height', () => {
	it('starts the run at the canonical birth height and records it as run state', () => {
		const context = makeStore(tallWallDocument());
		beginWallChain(context.layoutInteraction, [0, 0]);
		expect(context.layoutInteraction.wallChainRunHeight).toBeNull();

		const outcome = commitRunSegment(context, [0, 0], [3, 0]);
		// (0,0) has exactly one incident 4 m Wall, so the first segment inherits
		// 4 m — and that becomes the run's height.
		expect(authoredHeight(context, outcome)).toBe(4);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(4);
	});

	it('keeps the run height when a later segment reaches a taller Junction', () => {
		// The decisive case: the run began on an isolated start (default height),
		// then turned onto a Junction whose single incident Wall is 4 m tall. The
		// run in progress must keep its own height instead of re-resolving.
		const context = makeStore(tallWallDocument());
		beginWallChain(context.layoutInteraction, [6, 0]);
		const first = commitRunSegment(context, [6, 0], [0, 0]);
		expect(authoredHeight(context, first)).toBe(WALL_AUTHORING_DEFAULT_HEIGHT);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(WALL_AUTHORING_DEFAULT_HEIGHT);

		const second = commitRunSegment(context, [0, 0], [-3, 0]);
		expect(authoredHeight(context, second)).toBe(WALL_AUTHORING_DEFAULT_HEIGHT);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(WALL_AUTHORING_DEFAULT_HEIGHT);

		// …while a *new* run resolves from topology again: the far end of the tall
		// Wall still has exactly one incident height, so a fresh run there inherits 4.
		beginWallChain(context.layoutInteraction, [0, 3]);
		const fresh = commitRunSegment(context, [0, 3], [3, 3]);
		expect(authoredHeight(context, fresh)).toBe(4);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(4);
		// The earlier run's 3 m Walls are still 3 m — run state never rewrote them.
		expect(context.layoutInteraction.wallChainRunHeight).not.toBe(
			authoredHeight(context, second)
		);
	});

	it('uses one explicit height for every segment of a run', () => {
		const context = makeStore(emptyDocument());
		beginWallChain(context.layoutInteraction, [0, 0]);
		context.layoutInteraction.wallChainRunHeight = 1.2;
		const outcome = commitRunSegment(context, [0, 0], [4, 0]);
		expect(authoredHeight(context, outcome)).toBe(1.2);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(1.2);
	});

	it('matches the headless planner for the first segment of a run', () => {
		// The architecture contract: UI and headless/domain callers execute the same
		// semantic operation. The editor must not add a second birth rule.
		const headless = planWallSegment({
			baseline: tallWallDocument(),
			start: [0, 0],
			end: [3, 0],
			role: 'partition'
		});
		if (headless.kind !== 'success') throw new Error('expected a headless success');
		const headlessHeight = headless.document.walls.find((wall) =>
			headless.authoredWallIds.includes(wall.id)
		)!.height;

		const context = makeStore(tallWallDocument());
		beginWallChain(context.layoutInteraction, [0, 0]);
		const outcome = commitRunSegment(context, [0, 0], [3, 0]);
		expect(authoredHeight(context, outcome)).toBe(headlessHeight);
	});
});

describe('P23.6I continuous Wall-run height — every run-end path clears it', () => {
	it('clears on Escape (cancelWallChainRun) without touching committed Walls', () => {
		const context = makeStore(tallWallDocument());
		beginWallChain(context.layoutInteraction, [0, 0]);
		const outcome = commitRunSegment(context, [0, 0], [3, 0]);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(4);
		expect(outcome.kind).toBe('committed');

		cancelWallChainRun(context.layoutInteraction);
		expect(context.layoutInteraction.wallChainRunHeight).toBeNull();
		expect(context.layoutInteraction.wallChainStart).toBeNull();
		// The committed Wall survives; only the transient continuation is gone.
		expect(liveDocument(context).walls).toHaveLength(2);
	});

	it('clears on tool change', () => {
		const context = makeStore(tallWallDocument());
		beginWallChain(context.layoutInteraction, [0, 0]);
		commitRunSegment(context, [0, 0], [3, 0]);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(4);
		setLayoutDraftTool(context.layoutInteraction, 'select');
		expect(context.layoutInteraction.wallChainRunHeight).toBeNull();
	});

	it('clears when the boundary run closes', () => {
		const context = makeStore(emptyDocument());
		context.layoutInteraction.tool = 'wall-chain';
		const corners: LayoutVec2[] = [
			[0, 0],
			[4, 0],
			[4, 3],
			[0, 3],
			[0, 0]
		];
		beginWallChain(context.layoutInteraction, corners[0]!);
		for (let index = 0; index < corners.length - 1; index += 1) {
			const outcome = commitRunSegment(context, corners[index]!, corners[index + 1]!, 'boundary');
			if (outcome.kind !== 'committed') {
				throw new Error(`expected commit ${index}: ${JSON.stringify(outcome)}`);
			}
		}
		// The final leg ends on the canonical run-start Junction, which closes the
		// run and clears the transient height with the rest of the run state.
		expect(context.layoutInteraction.wallChainRunHeight).toBeNull();
		expect(context.layoutInteraction.wallChainStart).toBeNull();
		expect(liveDocument(context).walls).toHaveLength(4);
	});

	it('does not leak into a new run after a reset', () => {
		const context = makeStore(emptyDocument());
		beginWallChain(context.layoutInteraction, [0, 0]);
		context.layoutInteraction.wallChainRunHeight = 1.2;
		commitRunSegment(context, [0, 0], [4, 0]);
		cancelWallChainRun(context.layoutInteraction);

		beginWallChain(context.layoutInteraction, [0, 6]);
		expect(context.layoutInteraction.wallChainRunHeight).toBeNull();
		const next = commitRunSegment(context, [0, 6], [4, 6]);
		expect(authoredHeight(context, next)).toBe(WALL_AUTHORING_DEFAULT_HEIGHT);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(WALL_AUTHORING_DEFAULT_HEIGHT);
	});

	it('ends the run when a layout import replaces the document', () => {
		// The reviewer's cross-document hazard: a 4 m first segment sets the
		// run height, then Document B replaces the live document mid-run. The
		// shell's post-replacement step (`onLayoutReplaced` in `EditorApp`,
		// wired to `cancelWallChainRun`) must end the run, so the stale 4 m
		// height can never cross into B as an explicit planner input.
		const context = makeStore(tallWallDocument());
		beginWallChain(context.layoutInteraction, [0, 0]);
		const first = commitRunSegment(context, [0, 0], [3, 0]);
		expect(authoredHeight(context, first)).toBe(4);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(4);

		const imported = importLayoutPreviewJson(
			context.layoutPreview,
			serializeWallFirstLayoutDocument(emptyDocument())
		);
		expect(imported).toBe(true);
		cancelWallChainRun(context.layoutInteraction);
		expect(context.layoutInteraction.wallChainRunHeight).toBeNull();
		expect(context.layoutInteraction.wallChainStart).toBeNull();

		// A fresh run in B resolves from B's own (empty) topology: the
		// authoring default, not the 4 m leaked from A.
		beginWallChain(context.layoutInteraction, [0, 0]);
		const next = commitRunSegment(context, [0, 0], [4, 0]);
		expect(authoredHeight(context, next)).toBe(WALL_AUTHORING_DEFAULT_HEIGHT);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(WALL_AUTHORING_DEFAULT_HEIGHT);
	});

	it('ends the run when reset replaces the document', () => {
		const context = makeStore(tallWallDocument());
		beginWallChain(context.layoutInteraction, [0, 0]);
		commitRunSegment(context, [0, 0], [3, 0]);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(4);

		expect(resetLayoutPreview(context.layoutPreview)).toBe(true);
		cancelWallChainRun(context.layoutInteraction);
		expect(context.layoutInteraction.wallChainRunHeight).toBeNull();
		expect(context.layoutInteraction.wallChainStart).toBeNull();

		beginWallChain(context.layoutInteraction, [0, 0]);
		const next = commitRunSegment(context, [0, 0], [4, 0]);
		expect(authoredHeight(context, next)).toBe(WALL_AUTHORING_DEFAULT_HEIGHT);
	});

	it('preserves the run when an import is rejected (no document replacement)', () => {
		// The shell only ends the run on *successful* replacement
		// (`onLayoutReplaced` fires only when `importLayoutPreviewJson` returns
		// true). A rejected paste must leave the in-flight run — including its
		// height — untouched.
		const context = makeStore(tallWallDocument());
		beginWallChain(context.layoutInteraction, [0, 0]);
		commitRunSegment(context, [0, 0], [3, 0]);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(4);
		const before = liveDocument(context);

		expect(importLayoutPreviewJson(context.layoutPreview, '{ not json')).toBe(false);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(4);
		expect(context.layoutInteraction.wallChainStart).not.toBeNull();
		expect(liveDocument(context)).toEqual(before);
	});

	it('survives a capture/restore round-trip (rejection retry)', () => {
		const context = makeStore(tallWallDocument());
		beginWallChain(context.layoutInteraction, [0, 0]);
		commitRunSegment(context, [0, 0], [3, 0]);

		const snapshot = captureWallChainRun(context.layoutInteraction);
		if (!snapshot) throw new Error('expected a run snapshot');
		expect(snapshot.runHeight).toBe(4);
		cancelWallChainRun(context.layoutInteraction);
		restoreWallChainRun(context.layoutInteraction, snapshot);
		expect(context.layoutInteraction.wallChainRunHeight).toBe(4);
	});

	it('leaves the run height untouched when a segment is rejected', () => {
		const context = makeStore(tallWallDocument());
		beginWallChain(context.layoutInteraction, [0, 0]);
		commitRunSegment(context, [0, 0], [3, 0]);
		const before = liveDocument(context);

		// Collinear overlap with the just-committed Wall: the planner rejects and
		// the history runner cancels the transaction, so nothing was authored.
		const rejected = commitRunSegment(context, [0, 0], [1, 0]);
		expect(rejected.kind).toBe('cancelled');
		if (rejected.kind === 'cancelled') {
			expect(rejected.result.success).toBe(false);
		}
		expect(context.layoutInteraction.wallChainRunHeight).toBe(4);
		expect(liveDocument(context)).toEqual(before);
	});
});
