/**
 * T1.P02.S02 — drawing and deletion through the live F4 boundary.
 *
 * The suite drives the **real** acceptance host, coordinator and production
 * Layout adapter: nothing here injects a source, a planner or a test-only install
 * path, so a defect in registration, capture threading, scope or the pointer
 * contract fails here rather than in a browser. What it pins:
 *
 * 1. a drawn chain is accepted **once**, as one history entry, and Ink stays armed
 *    with the last created Wall selected;
 * 2. a chain that deliberately starts on an existing Junction keeps that authored
 *    Junction — drawing never re-mints an identity the creator connected to;
 * 3. the policy refusal refuses in words with **zero** partial source, keeps the
 *    live chain editable, and holds Undo with the chain's own reason until the
 *    chain settles (cancel included);
 * 4. deleting a Wall discloses its hosted Openings and Room consequence before
 *    acceptance, deletes the Opening in the same undo step, and Undo restores both.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planCreateWallFirstOpening,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageCardActions, stageCardWriter } from '$lib/authoring/stage/stage-contributions';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { inkSurface, type InkController } from '$lib/authoring/adapters/layout/ink';
import { drawnGridMinorMeters } from '$lib/authoring/stage/stage-grid';
import { draftingSnapIncrementMeters, snapDraftingPlacement } from '$lib/authoring/stage/stage-drafting';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-s02-drawing';
const ELEVATION = 0.5;

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly host: StageAcceptanceHost;
	readonly services: StageAdapterServices;
	readonly document: LayoutDocumentWallFirst;
	readonly wallId: string;
	readonly openingId: string;
	/** The enclosure's `(0, 4)` corner Junction — an authored anchor to draw from. */
	readonly cornerJunctionId: string;
};

/**
 * The S04/S05 enclosure, reused on purpose: every Wall shares its endpoints with a
 * neighbour and the first Wall hosts an Opening, so a drawn extension lands on real
 * topology and a deletion has real consequences to disclose.
 */
function fixtureDocument(
	extraObjects: LayoutDocumentWallFirst['objects'] = []
): { document: LayoutDocumentWallFirst; wallId: string; openingId: string } {
	const base = createEmptyWallFirstLayoutDocument();
	base.floor.elevation = ELEVATION;
	const chained = planWallChain({
		baseline: base,
		points: [
			[0, 0],
			[6, 0],
			[6, 4],
			[0, 4]
		],
		close: true,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (chained.kind !== 'success') throw new Error('the enclosure fixture was refused');
	const wallId = chained.document.walls[0]!.id;
	const opening = planCreateWallFirstOpening(
		chained.document,
		{ wallId, kind: 'window', offset: 1, width: 1.2, height: 1.2, sillHeight: 1 },
		freshCapture(),
		chained.document.floor.id
	);
	if (opening.kind === 'rejected') throw new Error(`opening fixture refused: ${opening.rejection.message}`);
	opening.document.objects.push(...extraObjects);
	return { document: opening.document, wallId, openingId: opening.changedOpeningIds[0]! };
}

async function mount(extraObjects: LayoutDocumentWallFirst['objects'] = []): Promise<Mounted> {
	const { document, wallId, openingId } = fixtureDocument(extraObjects);
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'S02 drawing',
		layout: document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [], navigationNodes: [], connections: [] }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-s02-drawing',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`S02 fixture not admitted: ${admitted.kind}`);
	const snapshot = admitted.snapshot;
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const facade = createStageFacade({ snapshot, session });
	facade.acquireInspection('exclusive');
	facade.camera.evaluate(RECT, 1);
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: snapshot.sessionEpoch,
		baseline: {
			revision: snapshot.acceptedRevision,
			source: project,
			canonicalJson: snapshot.canonicalJson,
			sourceContentId: snapshot.sourceContentId
		}
	});
	let services: StageAdapterServices | undefined;
	const registration = mountStageAdapter(facade, host, (port) => {
		services = port;
		return createAdapter(port);
	});
	if (registration.kind !== 'registered' || services === undefined) throw new Error('Layout adapter did not mount');
	const corner = document.junctions.find((junction) => junction.point[0] === 0 && junction.point[1] === 4);
	if (corner === undefined) throw new Error('the enclosure has no (0, 4) Junction');
	return { facade, session, host, services, document, wallId, openingId, cornerJunctionId: corner.id };
}

/** Arm Ink and hand back its published controller, exactly as the palette does. */
function armInk(facade: StageFacade): InkController {
	const opened = facade.openContributedTask('layout-ink');
	if (opened.kind !== 'opened') throw new Error(`Ink did not arm: ${opened.message}`);
	const surface = inkSurface();
	if (surface === null) throw new Error('Ink published no surface while its task was open');
	return surface.controller;
}

async function eventually(check: () => boolean, attempts = 80): Promise<void> {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('condition never became true');
}

function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageEnvelope(facade.snapshot()).units.layout.data;
}

describe('T1.P02.S02 — drawn chains', () => {
	it('accepts one typed chain once and selects the Wall it created', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);

		// Two typed points: one free-standing Wall inside the enclosure.
		controller.typePoint('1', '1');
		controller.typePoint('3', '1');
		controller.finish();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		const layout = acceptedLayout(mounted.facade);
		const created = layout.walls.find(
			(wall) => !mounted.document.walls.some((known) => known.id === wall.id)
		);
		expect(created).toBeDefined();
		// One chain, one history entry, and the created Wall is what the Card shows.
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect(mounted.facade.selection()?.sourceId).toBe(created!.id);
		// The draft is consumed by the acceptance: the palette offers a fresh chain,
		// and the shell is the one that re-arms the tool for the next run (an install
		// closes the active task; the mounted-host suite proves the re-arm).
		expect(inkSurface()).toBeNull();

		// Undo removes the whole chain in one step, including the junctions it minted.
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(acceptedLayout(mounted.facade).walls.map((wall) => wall.id).sort()).toEqual(
			mounted.document.walls.map((wall) => wall.id).sort()
		);
	});

	it('keeps the authored Junction a chain deliberately starts from', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		// The typed point coincides with an existing Junction, which the canonical
		// classifier turns into a **declared** anchor: the chain extends that group
		// instead of minting a parallel Junction at the same coordinate.
		controller.typePoint('0', '4');
		controller.typePoint('2', '2');
		controller.finish();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		const layout = acceptedLayout(mounted.facade);
		const created = layout.walls.find((wall) => !mounted.document.walls.some((known) => known.id === wall.id));
		expect(created).toBeDefined();
		expect([created!.startJunctionId, created!.endJunctionId]).toContain(mounted.cornerJunctionId);
		// No parallel Junction was minted at the corner: the authored identity survives.
		const corners = layout.junctions.filter((junction) => junction.point[0] === 0 && junction.point[1] === 4);
		expect(corners.map((junction) => junction.id)).toEqual([mounted.cornerJunctionId]);
	});
});

/**
 * The drag half of the same contract: a drag names one Wall — the point the press
 * landed on **and** the point it was released on — in one acceptance, with the
 * press's own deliberate target (a Junction, a Wall's interior or a free point)
 * preserved across every later move of the hand.
 */
describe('T1.P02.S02 — the drag gesture', () => {
	/** The projection of a world point on the level datum, in Stage-local CSS. */
	function stageCss(facade: StageFacade, point: readonly [number, number]): readonly [number, number] {
		const evaluationId = facade.evaluationId();
		if (evaluationId === null) throw new Error('the mounted fixture has no evaluation');
		const projected = facade.projectWorld([point[0], ELEVATION, point[1]], evaluationId);
		if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
		return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
	}

	it('draws one Wall from a single drag, between the pressed and released points', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		armInk(mounted.facade);
		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, [1, 1]);
		const to = stageCss(mounted.facade, [3, 1]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		// The hand moves before it lets go; the Wall still starts where it pressed.
		mounted.facade.pointerIntent({ phase: 'move', css: [from[0] + 6, from[1] + 6], evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		const layout = acceptedLayout(mounted.facade);
		const created = layout.walls.filter(
			(wall) => !mounted.document.walls.some((known) => known.id === wall.id)
		);
		// One drag, one Wall: the press point was recorded, so the chain carried the
		// two points the planner needs and the release finished it in one step.
		expect(created).toHaveLength(1);
		const pointOf = (junctionId: string) =>
			layout.junctions.find((junction) => junction.id === junctionId)!.point;
		const ends = [pointOf(created[0]!.startJunctionId), pointOf(created[0]!.endJunctionId)].sort(
			(a, b) => a[0] - b[0]
		);
		expect(ends[0]![0]).toBeCloseTo(1, 3);
		expect(ends[0]![1]).toBeCloseTo(1, 3);
		expect(ends[1]![0]).toBeCloseTo(3, 3);
		expect(ends[1]![1]).toBeCloseTo(1, 3);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });

		// The whole gesture is one Undo, exactly like a tapped chain.
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(acceptedLayout(mounted.facade).walls.map((wall) => wall.id).sort()).toEqual(
			mounted.document.walls.map((wall) => wall.id).sort()
		);
	});

	it('keeps the Junction a drag starts from across every move of the hand', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		armInk(mounted.facade);
		const evaluationId = mounted.facade.evaluationId()!;
		// Pressed on the enclosure's `(0, 4)` Junction, released inside the Room.
		const from = stageCss(mounted.facade, [0, 4]);
		const through = stageCss(mounted.facade, [1, 3]);
		const to = stageCss(mounted.facade, [2, 2]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: through, evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		const layout = acceptedLayout(mounted.facade);
		const created = layout.walls.find(
			(wall) => !mounted.document.walls.some((known) => known.id === wall.id)
		)!;
		// The press named the Junction, so the drag extends that authored group: no
		// parallel Junction was minted at the corner it started from.
		expect([created.startJunctionId, created.endJunctionId]).toContain(mounted.cornerJunctionId);
		const corners = layout.junctions.filter(
			(junction) => junction.point[0] === 0 && junction.point[1] === 4
		);
		expect(corners.map((junction) => junction.id)).toEqual([mounted.cornerJunctionId]);
	});
});

describe('T1.P02.S02 — drawing refusals and deletion', () => {
	it('refuses a crossing without a Junction, writes nothing and holds Undo until the chain settles', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);

		// A leg from below the enclosure to inside it crosses the south Wall.
		controller.typePoint('3', '-2');
		controller.typePoint('3', '2');
		// Before finishing, the chain is a live proposal: Undo names it and refuses.
		expect(mounted.host.history().undoUnavailableReason).toContain('chain is live');
		expect(await mounted.host.undo()).toMatchObject({ kind: 'unavailable', reason: 'live-proposal' });

		controller.finish();
		await eventually(() => inkSurface()!.snapshot().refusal !== null);
		const refusal = inkSurface()!.snapshot().refusal!;
		expect(refusal).toContain(mounted.wallId);
		expect(refusal.length).toBeGreaterThan(40);
		// Zero partial source, and the chain is still editable rather than dropped.
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
		expect(inkSurface()!.snapshot().points).toHaveLength(2);

		// Escape's command cancels the chain: no source, no proposal, Undo available.
		expect(mounted.facade.keyboardIntent({ kind: 'cancel' }).claimed).toBe(true);
		expect(inkSurface()!.snapshot().points).toHaveLength(0);
		expect(mounted.host.history().undoUnavailableReason ?? '').not.toContain('chain is live');
		expect(acceptedLayout(mounted.facade).walls).toHaveLength(mounted.document.walls.length);
	});

	it('discloses the hosted Opening and the Room consequence, then deletes both in one undo step', async () => {
		const mounted = await mount();
		const subject = { sourceId: mounted.wallId, sourceKind: 'wall' as const, ref: null };
		const actions = stageCardActions(mounted.facade, subject);
		expect(actions).toHaveLength(1);
		const action = actions[0]!;
		expect(action).toMatchObject({ id: 'layout-wall-delete', destructive: true, adapterId: 'layout' });
		// The words the creator reads before accepting name the real consequences:
		// the hosted Opening, in the same undo step, and what happens to the Room.
		expect(action.detail).toContain('1 hosted Opening in the same undo step');
		expect(action.detail).toContain('retires 1 Room');
		// Two sentences, no repeated verb and no second "and" clause: the disclosure
		// reads as prose because the creator has to read it before confirming.
		expect(action.detail).toBe(
			'This deletes the Wall and 1 hosted Opening in the same undo step. It opens the enclosure and retires 1 Room.'
		);

		const outcome = await action.run();
		expect(outcome).toMatchObject({ kind: 'accepted' });
		const layout = acceptedLayout(mounted.facade);
		expect(layout.walls.some((wall) => wall.id === mounted.wallId)).toBe(false);
		expect(layout.openings.some((opening) => opening.id === mounted.openingId)).toBe(false);
		expect(layout.rooms).toHaveLength(0);
		// The Card is now describing a subject that no longer exists: it contributes
		// no writer for it rather than a half-editable panel.
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect(stageCardWriter(mounted.facade, subject)).toBeNull();

		// One undo restores the Wall, its Opening and the Room, with their identities.
		expect((await mounted.host.undo()).kind).toBe('installed');
		const restored = acceptedLayout(mounted.facade);
		expect(restored.walls.some((wall) => wall.id === mounted.wallId)).toBe(true);
		expect(restored.openings.some((opening) => opening.id === mounted.openingId)).toBe(true);
		expect(restored.rooms).toHaveLength(1);
	});
});

/**
 * R217.S05 — free Ink points honour the shared drafting Snap.
 *
 * The increment is the same fact Scene placement consumes; Junction and Wall
 * targets keep precedence, so snapping can never move a connection off the
 * subject the creator deliberately aimed at.
 */
/**
 * R217.S10 — Ink's Box for the Wall reading. Two opposite corners are one closed
 * four-point chain through the same `layout-wall-chain-commit`, so the Room derives
 * exactly as four Lines closed by hand would derive it.
 */
describe('R217.S10 — Ink Box', () => {
	const FIXED_NONCE = '00000000-0000-4000-8000-0000000000b0';

	function boxCss(facade: StageFacade, point: readonly [number, number]): readonly [number, number] {
		const projected = facade.projectWorld([point[0], ELEVATION, point[1]], facade.evaluationId()!);
		if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
		return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
	}

	it('commits one drag as four Walls and one Room, byte-identical to four closed Lines', async () => {
		// Both fixtures mint the same id sequence and both operations capture one
		// fixed identity, so the two accepted Layouts can be compared byte for byte.
		let minted = 0;
		const uuid = vi
			.spyOn(globalThis.crypto, 'randomUUID')
			.mockImplementation(() => `00000000-0000-4000-8000-${String(++minted).padStart(12, '0')}` as `${string}-${string}-${string}-${string}-${string}`);
		try {
			const boxed = await mount();
			minted = 0;
			const lined = await mount();
			uuid.mockReturnValue(FIXED_NONCE);
			const baseline = boxed.facade.snapshot().canonicalJson;
			const controller = armInk(boxed.facade);
			controller.setWallMode('box');
			expect(inkSurface()?.snapshot().wallMode).toBe('box');
			const evaluationId = boxed.facade.evaluationId()!;
			const from = boxCss(boxed.facade, [8, 0]);
			const to = boxCss(boxed.facade, [11, 3]);
			expect(boxed.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
			boxed.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
			expect(inkSurface()?.snapshot().box).toEqual({ width: 3, depth: 3 });
			boxed.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
			await eventually(() => boxed.facade.snapshot().canonicalJson !== baseline);

			const layout = acceptedLayout(boxed.facade);
			expect(layout.walls).toHaveLength(boxed.document.walls.length + 4);
			expect(layout.rooms).toHaveLength(boxed.document.rooms.length + 1);
			expect(boxed.host.history()).toMatchObject({ depth: 2, position: 1 });

			const lineBaseline = lined.facade.snapshot().canonicalJson;
			const lines = armInk(lined.facade);
			lines.typePoint('8', '0');
			lines.typePoint('11', '0');
			lines.typePoint('11', '3');
			lines.typePoint('8', '3');
			lines.close();
			await eventually(() => lined.facade.snapshot().canonicalJson !== lineBaseline);
			expect(JSON.stringify(acceptedLayout(lined.facade))).toBe(JSON.stringify(layout));
			uuid.mockRestore();

			expect((await boxed.host.undo()).kind).toBe('installed');
			expect(boxed.facade.snapshot().canonicalJson).toBe(baseline);
		} finally {
			vi.restoreAllMocks();
		}
	});

	it('takes two clicked corners, and holds Undo with the chain reason until the second', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		armInk(mounted.facade).setWallMode('box');
		const evaluationId = mounted.facade.evaluationId()!;
		const click = (point: readonly [number, number]) => {
			const css = boxCss(mounted.facade, point);
			mounted.facade.pointerIntent({ phase: 'down', css, evaluationId });
			mounted.facade.pointerIntent({ phase: 'up', css, evaluationId });
		};
		click([8, 0]);
		expect(mounted.session.liveProposal()).not.toBeNull();
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
		click([10, 2]);
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);
		expect(acceptedLayout(mounted.facade).rooms).toHaveLength(mounted.document.rooms.length + 1);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect(mounted.session.liveProposal()).toBeNull();
	});

	it('refuses a degenerate box in words with no entry', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		armInk(mounted.facade).setWallMode('box');
		const evaluationId = mounted.facade.evaluationId()!;
		const from = boxCss(mounted.facade, [8, 0]);
		const along = boxCss(mounted.facade, [11, 0]);
		mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: along, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: along, evaluationId });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(inkSurface()?.snapshot().refusal).toMatch(/Box needs two corners apart/);
		expect(mounted.facade.snapshot().canonicalJson).toBe(baseline);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		expect(mounted.session.liveProposal()).toBeNull();
	});

	it('refuses switching to Box while a Line chain is live', async () => {
		const mounted = await mount();
		const controller = armInk(mounted.facade);
		controller.typePoint('8', '0');
		controller.setWallMode('box');
		expect(inkSurface()?.snapshot().wallMode).toBe('line');
		expect(inkSurface()?.snapshot().refusal).toMatch(/before switching between Line and Box/);
	});
});

describe('R217.S05 — the shared drafting snap in Layout Ink', () => {
	function stageCss(facade: StageFacade, point: readonly [number, number]): readonly [number, number] {
		const evaluationId = facade.evaluationId();
		if (evaluationId === null) throw new Error('the mounted fixture has no evaluation');
		const projected = facade.projectWorld([point[0], ELEVATION, point[1]], evaluationId);
		if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
		return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
	}

	function tap(facade: StageFacade, point: readonly [number, number]): void {
		const evaluationId = facade.evaluationId()!;
		const css = stageCss(facade, point);
		facade.pointerIntent({ phase: 'down', css, evaluationId });
		facade.pointerIntent({ phase: 'up', css, evaluationId });
	}

	function snappedPoint(facade: StageFacade, point: readonly [number, number]) {
		const drafting = facade.drafting();
		const minor = drawnGridMinorMeters(
			drafting,
			facade.evaluation()?.targetPlaneMetersPerCssPixel ?? null
		);
		return snapDraftingPlacement(point, draftingSnapIncrementMeters(drafting, minor));
	}

	/** Every junction of the walls this drawing created, in world coordinates. */
	function createdEndpoints(
		mounted: Mounted,
		layout: LayoutDocumentWallFirst,
		created: readonly { readonly startJunctionId: string; readonly endJunctionId: string }[]
	): readonly (readonly [number, number])[] {
		const ids = new Set(created.flatMap((wall) => [wall.startJunctionId, wall.endJunctionId]));
		return [...ids].map((id) => layout.junctions.find((junction) => junction.id === id)!.point);
	}

	it('rounds free points to the current shared Grid/Snap increment by default', async () => {
		const mounted = await mount();
		const expectedA = snappedPoint(mounted.facade, [1.37, 2.81]);
		const expectedB = snappedPoint(mounted.facade, [3.37, 2.81]);
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		tap(mounted.facade, [1.37, 2.81]);
		tap(mounted.facade, [3.37, 2.81]);
		controller.finish();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		const layout = acceptedLayout(mounted.facade);
		const created = layout.walls.filter(
			(wall) => !mounted.document.walls.some((known) => known.id === wall.id)
		);
		expect(created).toHaveLength(1);
		const ends = [...createdEndpoints(mounted, layout, created)].sort((a, b) => a[0] - b[0]);
		expect(ends[0]![0]).toBeCloseTo(expectedA.x, 6);
		expect(ends[0]![1]).toBeCloseTo(expectedA.z, 6);
		expect(ends[1]![0]).toBeCloseTo(expectedB.x, 6);
		expect(ends[1]![1]).toBeCloseTo(expectedB.z, 6);
	});

	it.each([
		{ name: 'Snap off', patch: { snap: false } },
		{ name: 'Snap held', patch: { snapSuspended: true } }
	])('commits the raw free point when %s', async ({ patch }) => {
		const mounted = await mount();
		mounted.facade.setDrafting(patch);
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		tap(mounted.facade, [1.37, 2.81]);
		tap(mounted.facade, [3.37, 2.81]);
		controller.finish();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		const layout = acceptedLayout(mounted.facade);
		const created = layout.walls.filter(
			(wall) => !mounted.document.walls.some((known) => known.id === wall.id)
		);
		expect(created).toHaveLength(1);
		const ends = [...createdEndpoints(mounted, layout, created)].sort((a, b) => a[0] - b[0]);
		expect(ends[0]![0]).toBeCloseTo(1.37, 6);
		expect(ends[0]![1]).toBeCloseTo(2.81, 6);
		expect(ends[1]![0]).toBeCloseTo(3.37, 6);
	});

	it('keeps a Junction target while Snap is on, even when the snapped grid point is elsewhere', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		// Aim inside the Junction's CSS tolerance but away from the grid point: the
		// deliberate connection wins, and the snapped coordinate never replaces it.
		tap(mounted.facade, [0.02, 3.98]);
		tap(mounted.facade, [2.37, 2.52]);
		controller.finish();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		const layout = acceptedLayout(mounted.facade);
		const created = layout.walls.filter(
			(wall) => !mounted.document.walls.some((known) => known.id === wall.id)
		);
		expect(created).toHaveLength(1);
		const createdJunctions = new Set(
			created.flatMap((wall) => [wall.startJunctionId, wall.endJunctionId])
		);
		expect(createdJunctions.has(mounted.cornerJunctionId)).toBe(true);
		const corner = layout.junctions.find((junction) => junction.id === mounted.cornerJunctionId)!;
		expect(corner.point[0]).toBeCloseTo(0, 6);
		expect(corner.point[1]).toBeCloseTo(4, 6);
	});

	it('does not let a free snap invent an undeclared Wall contact', async () => {
		const mounted = await mount();
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		// Both points are 0.22 m from the z = 4 Wall, outside its CSS hit tolerance,
		// and snap to (1, 4) and (3, 4) if rounding is allowed to create contact. The
		// guard must keep the creator's raw free aim rather than author that contact.
		tap(mounted.facade, [1.37, 3.78]);
		tap(mounted.facade, [3.37, 3.78]);
		controller.finish();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		const layout = acceptedLayout(mounted.facade);
		const created = layout.walls.filter(
			(wall) => !mounted.document.walls.some((known) => known.id === wall.id)
		);
		expect(created).toHaveLength(1);
		const ends = createdEndpoints(mounted, layout, created);
		for (const end of ends) expect(end[1]).toBeCloseTo(3.78, 6);
	});

	it('keeps a Wall-interior target exact while the free end snaps', async () => {
		const mounted = await mount();
		const snappedEnd = snappedPoint(mounted.facade, [3.37, 2.81]);
		const baseline = mounted.facade.snapshot().canonicalJson;
		const controller = armInk(mounted.facade);
		// Aimed at the north Wall's centerline (z = 4), where no Opening is hosted,
		// and not at a grid line.
		tap(mounted.facade, [1.37, 3.98]);
		tap(mounted.facade, [3.37, 2.81]);
		controller.finish();
		await eventually(() => mounted.facade.snapshot().canonicalJson !== baseline);

		const layout = acceptedLayout(mounted.facade);
		const created = layout.walls.filter(
			(wall) => !mounted.document.walls.some((known) => known.id === wall.id)
		);
		// The split Wall segments plus the drawn Wall; the drawn Wall is the one
		// that reaches the snapped free point.
		const drawn = created.find((wall) => {
			const ends = [wall.startJunctionId, wall.endJunctionId].map(
				(id) => layout.junctions.find((junction) => junction.id === id)!.point
			);
			return ends.some((point) => Math.abs(point[1] - 4) < 1e-6 && Math.abs(point[0] - 1.37) < 1e-6) &&
				ends.some((point) => Math.abs(point[0] - snappedEnd.x) < 1e-6 && Math.abs(point[1] - snappedEnd.z) < 1e-6);
		});
		expect(drawn).toBeDefined();
		const anchored = [drawn!.startJunctionId, drawn!.endJunctionId]
			.map((id) => layout.junctions.find((junction) => junction.id === id)!.point)
			.find((point) => Math.abs(point[1] - 4) < 1e-6);
		// The Wall target was not rounded to the 1 m grid: its exact aim survives.
		expect(anchored![0]).toBeCloseTo(1.37, 6);
		expect(anchored![1]).toBeCloseTo(4, 6);
	});
});

describe('R217.S06 — Layout owner height ticks', () => {
	it('publishes the floor datum and an upright solid object top', async () => {
		const mounted = await mount([
			{
				id: 'plinth-height-test',
				kind: 'box',
				position: [2, 1.25, 2],
				rotation: [0, 0, 0],
				dimensions: [1, 1.5, 1]
			}
		]);
		const ticks = mounted.facade.heightTicks();
		expect(ticks[0]).toMatchObject({ kind: 'datum', heightMeters: 0, label: 'Floor' });
		const found = ticks.filter((tick) => tick.kind === 'found');
		expect(found).toHaveLength(1);
		// The floor datum is 0.5 m above the world origin; the box top is 2.0 m
		// world, so the owner reports 1.5 m above its datum.
		expect(found[0]!.heightMeters).toBeCloseTo(1.5, 6);
		expect(found[0]!.label).toContain('plinth-height-test');
	});

	it('does not publish a tilted top as a horizontal surface', async () => {
		const mounted = await mount([
			{
				id: 'tilted-height-test',
				kind: 'box',
				position: [2, 1.25, 2],
				rotation: [0.4, 0, 0],
				dimensions: [1, 1.5, 1]
			}
		]);
		expect(mounted.facade.heightTicks().filter((tick) => tick.kind === 'found')).toEqual([]);
	});
});
