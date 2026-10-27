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
import { describe, expect, it } from 'vitest';
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
function fixtureDocument(): { document: LayoutDocumentWallFirst; wallId: string; openingId: string } {
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
	return { document: opening.document, wallId, openingId: opening.changedOpeningIds[0]! };
}

async function mount(): Promise<Mounted> {
	const { document, wallId, openingId } = fixtureDocument();
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
