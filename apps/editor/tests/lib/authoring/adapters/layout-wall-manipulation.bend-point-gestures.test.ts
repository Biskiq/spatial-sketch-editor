/**
 * T1.P01.S05 — existing straight-Wall manipulation.
 *
 * The suite drives the **real** F4 acceptance host and the production Layout
 * adapter; nothing here injects a source or a test-only install path. It pins
 * the slice's criteria:
 *
 * 1. exact length/angle (explicit fixed endpoint) and rigid translation are the
 *    retained planners' work, with the planner's own refusals and no partial write;
 * 2. the pointer path and the typed path produce the **same** canonical document
 *    for the same explicit parameter, and one gesture is one history entry;
 * 3. Esc, pointer cancel, a reading flip and an ended task change no document and
 *    add no history entry; a reading flip preserves the proposal instead of
 *    silently committing it;
 * 4. shared-Junction invalidity rejects atomically, and identities survive the
 *    supported operations;
 * 5. inactive helpers cannot pick.
 */

import { describe, expect, it } from 'vitest';
import { eventually } from '../../../kit/index';
import { createEmptyWallFirstLayoutDocument, planCreateWallFirstOpening, planWallChain, wallFirstWallLength, type LayoutDocumentWallFirst, type LayoutWall } from '@portfolio/layout-core/wall';
import { planCreateCircularRoom } from '@portfolio/layout-core/room';
import { setWorkObserver } from '@portfolio/layout-core/kernel';
import type { PlanSourceRef } from '@portfolio/layout-core/world';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { captureUnitSave, readUnitEnvelopeForSave } from '@portfolio/project-model/units';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { stageCardActions } from '$lib/authoring/stage/stage-contributions';
import { createCardFieldsInstrument } from '$lib/authoring/adapters/layout/adapter-support';
import { curvedWallFrame, curvedWallPointAt } from '$lib/authoring/adapters/layout/precision-frames';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-s05';
const ELEVATION = 0.5;
type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly host: StageAcceptanceHost;
	readonly services: StageAdapterServices;
	readonly document: LayoutDocumentWallFirst;
	readonly wallId: string;
	readonly openingId: string;
};
/**
 * The S04 enclosure, reused on purpose: every Wall shares its endpoints with a
 * neighbour and the first Wall hosts an Opening, so identity, Opening and Room
 * preservation are exercised by the same fixture the precision slice used.
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
	if (chained.kind !== 'success') throw new Error('the S05 enclosure was refused');
	const wallId = chained.document.walls[0]!.id;
	const opening = planCreateWallFirstOpening(
		chained.document,
		{
			wallId,
			kind: 'window',
			offset: 1,
			width: 1.2,
			height: 1.2,
			sillHeight: 1
		},
		freshCapture(),
		chained.document.floor.id
	);
	if (opening.kind === 'rejected') throw new Error(`opening fixture refused: ${opening.rejection.message}`);
	return { document: opening.document, wallId, openingId: opening.changedOpeningIds[0]! };
}
async function mount(
	fixture: { document: LayoutDocumentWallFirst; wallId: string; openingId: string } = fixtureDocument()
): Promise<Mounted> {
	const { document, wallId, openingId } = fixture;
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'S05 wall manipulation',
		layout: document,
		scene: { formatVersion: 1, textures: [], materials: [], entities: [], navigationNodes: [], connections: [] }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-s05',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`S05 fixture not admitted: ${admitted.kind}`);
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
	return { facade, session, host, services, document, wallId, openingId };
}
/** A complete selection for one Wall fragment of the mounted source. */
function selectWall(facade: StageFacade, sourceId: string): void {
	const snapshot = facade.snapshot();
	const reference = {
		version: 1 as const,
		domain: 'layout' as const,
		revision: { kind: 'exact' as const, contentRevision: snapshot.domain.unitRevisions.layout },
		subject: { kind: 'wall' as const, id: sourceId },
		instancePath: [],
		location: {
			kind: 'layout-location' as const,
			levelId: snapshot.domain.layoutLevelId,
			structureInstancePath: []
		},
		componentId: null,
		capabilityId: null
	};
	const representation: PlanSourceRef = {
		sourceId,
		sourceKind: 'wall',
		generationId: snapshot.compileGeneration,
		stream: 'projected',
		subRef: null
	};
	facade.setSelection({
		ordered: [{ reference, representation }],
		primary: reference
	});
}
function settle(facade: StageFacade, clockSeconds = 2): void {
	const result = facade.camera.evaluate(RECT, clockSeconds);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	facade.overlays();
	facade.tasks();
}
/** The projection of a world point on the level datum, in Stage-local CSS. */
function stageCss(facade: StageFacade, point: readonly [number, number]): readonly [number, number] {
	const id = facade.evaluationId();
	if (id === null) throw new Error('the mounted fixture has no evaluation');
	const projected = facade.projectWorld([point[0], ELEVATION, point[1]], id);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
}
/** D2 — bend the mounted Wall at one centerline station through the real press path. */
async function bendWallAt(mounted: Mounted, distance: number): Promise<void> {
	selectWall(mounted.facade, mounted.wallId);
	settle(mounted.facade, 3);
	const frame = curvedWallFrame(acceptedLayout(mounted.facade), mounted.wallId);
	const station = frame === null ? null : curvedWallPointAt(frame, distance);
	const point: [number, number] = station === null ? [distance, 0] : [station.point[0], station.point[1]];
	const evaluationId = mounted.facade.evaluationId()!;
	const from = stageCss(mounted.facade, point);
	const to = stageCss(mounted.facade, [point[0], point[1] + 0.6]);
	expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, metaKey: true }).claimed).toBe(true);
	// The modifier is captured at pointer-down; releasing it mid-drag does not
	// turn the bend into a move.
	mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
	mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
	const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
	const expected = wall.centerline.kind === 'cubic-chain' ? wall.centerline.knots.length + 1 : 1;
	await eventually(() => {
		const next = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
		return next.centerline.kind === 'cubic-chain' && next.centerline.knots.length === expected;
	});
}
/** Click the first bend mark so the session names it active, as the creator would. */
async function activateFirstBendPoint(mounted: Mounted): Promise<void> {
	selectWall(mounted.facade, mounted.wallId);
	settle(mounted.facade, 4);
	const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
	const knot = wall.centerline.kind === 'cubic-chain' ? wall.centerline.knots[0] : undefined;
	if (knot === undefined) throw new Error('the fixture has no bend point');
	const css = stageCss(mounted.facade, knot.point);
	const evaluationId = mounted.facade.evaluationId()!;
	expect(mounted.facade.pointerIntent({ phase: 'down', css, evaluationId }).claimed).toBe(true);
	mounted.facade.pointerIntent({ phase: 'up', css, evaluationId });
	await eventually(() =>
		mounted.facade.marks().some((candidate) => candidate.id === `layout-wall-knot:${knot.id}` && candidate.label === 'Active bend point')
	);
}
function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageEnvelope(facade.snapshot()).units.layout.data;
}

describe('bend point gestures', () => {
	it('selects an active bend point on canvas and removes it from the Card in one undo step', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		const knots = () => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
			return wall.centerline.kind === 'cubic-chain' ? wall.centerline.knots : [];
		};
		const bendAt = async (distance: number): Promise<void> => {
			selectWall(mounted.facade, mounted.wallId);
			settle(mounted.facade, 3);
			const frame = curvedWallFrame(acceptedLayout(mounted.facade), mounted.wallId);
			const point: [number, number] = frame === null
				? [distance, 0]
				: [
					curvedWallPointAt(frame, distance)!.point[0],
					curvedWallPointAt(frame, distance)!.point[1]
				];
			const evaluationId = mounted.facade.evaluationId()!;
			const from = stageCss(mounted.facade, point);
			const to = stageCss(mounted.facade, [point[0], point[1] + 0.6]);
			expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, metaKey: true }).claimed).toBe(true);
			mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
			mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
			const expected = knots().length + 1;
			await eventually(() => knots().length === expected);
		};
		await bendAt(4.5);
		await bendAt(1.5);
		expect(knots()).toHaveLength(2);
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 4);

		const firstKnot = knots()[0]!;
		const knotCss = stageCss(mounted.facade, firstKnot.point);
		const clickEvaluation = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: knotCss, evaluationId: clickEvaluation }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: knotCss, evaluationId: clickEvaluation });
		await eventually(() =>
			mounted.facade.marks().some((mark) => mark.id === `layout-wall-knot:${firstKnot.id}` && mark.label === 'Active bend point')
		);

		const subject = { sourceId: mounted.wallId, sourceKind: 'wall' as const, ref: null };
		const facts = mounted.facade.cardFacts(subject);
		expect(facts.map((fact) => fact.label)).toEqual(
			expect.arrayContaining(['Length (arc)', 'Bend points', 'Active bend point'])
		);
		expect(facts.find((fact) => fact.label === 'Bend points')?.value).toBe('2');
		const actions = stageCardActions(mounted.facade, subject);
		expect(actions.map((action) => action.id)).toEqual(
			expect.arrayContaining(['layout-wall-knot-remove', 'layout-wall-straighten', 'layout-wall-delete'])
		);
		const remove = actions.find((action) => action.id === 'layout-wall-knot-remove')!;
		expect(remove.detail).toContain('one undo step');
		expect((await remove.run()).kind).toBe('accepted');
		await eventually(() => knots().length === 1);
		expect(mounted.host.history()).toMatchObject({ depth: 4, position: 3 });

		// The accepted curved Wall round-trips through the Save envelope unchanged.
		const captured = await captureUnitSave({
			snapshot: mounted.host.coordinator().acceptedSnapshot(),
			operationId: 'c1-knot-remove-roundtrip',
			precondition: { kind: 'create-only' }
		});
		expect(captured.kind).toBe('captured');
		if (captured.kind !== 'captured') throw new Error(`Save capture refused: ${captured.message}`);
		const reloaded = await readUnitEnvelopeForSave(captured.capture.canonicalJson);
		expect(reloaded.kind).toBe('read');
		if (reloaded.kind !== 'read') throw new Error(`Save reload refused: ${reloaded.message}`);
		const readmitted = await admitSource(reloaded.envelope, {
			sessionEpoch: 'session-c1-knot-remove',
			acceptedRevision: captured.capture.acceptedRevision
		});
		expect(readmitted.kind).toBe('admitted');
		if (readmitted.kind !== 'admitted') throw new Error(`Reload admission refused: ${readmitted.kind}`);
		expect(stageEnvelope(readmitted.snapshot).units).toEqual(stageEnvelope(mounted.facade.snapshot()).units);

		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(knots()).toHaveLength(2);
	});

	it('removes the active bend point with Delete through the shared Card channel', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		await bendWallAt(mounted, 4.5);
		await bendWallAt(mounted, 1.5);
		await activateFirstBendPoint(mounted);
		const knots = () => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
			return wall.centerline.kind === 'cubic-chain' ? wall.centerline.knots : [];
		};
		expect(knots()).toHaveLength(2);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		// D2 — Delete is the Card's own removal helper: the retained delete planner
		// previews, one captured intent is accepted once, and the active knot clears.
		expect(mounted.facade.selectionKeyIntent({ kind: 'delete' })).toEqual({
			claimed: true,
			adapterId: 'layout'
		});
		await eventually(() => knots().length === 1);
		expect(mounted.host.history()).toMatchObject({
			depth: beforeHistory.depth + 1,
			position: beforeHistory.position + 1
		});
		expect(mounted.facade.marks().some((mark) => mark.label === 'Active bend point')).toBe(false);

		// The keyboard result is a canonical document: Save/Load admits it unchanged.
		const captured = await captureUnitSave({
			snapshot: mounted.host.coordinator().acceptedSnapshot(),
			operationId: 'd2-delete-roundtrip',
			precondition: { kind: 'create-only' }
		});
		expect(captured.kind).toBe('captured');
		if (captured.kind !== 'captured') throw new Error(`Save capture refused: ${captured.message}`);
		const reloaded = await readUnitEnvelopeForSave(captured.capture.canonicalJson);
		expect(reloaded.kind).toBe('read');
		if (reloaded.kind !== 'read') throw new Error(`Save reload refused: ${reloaded.message}`);
		const readmitted = await admitSource(reloaded.envelope, {
			sessionEpoch: 'session-d2-delete-roundtrip',
			acceptedRevision: captured.capture.acceptedRevision
		});
		expect(readmitted.kind).toBe('admitted');
		if (readmitted.kind !== 'admitted') throw new Error(`Reload admission refused: ${readmitted.kind}`);
		expect(stageEnvelope(readmitted.snapshot).units).toEqual(stageEnvelope(mounted.facade.snapshot()).units);

		// One keypress is one undo step, and Undo restores the exact prior curve.
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(knots()).toHaveLength(2);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
	});

	it('removes the active bend point with Backspace and Undo restores the curve', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		await bendWallAt(mounted, 4.5);
		await activateFirstBendPoint(mounted);
		const knots = () => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
			return wall.centerline.kind === 'cubic-chain' ? wall.centerline.knots : [];
		};
		expect(knots()).toHaveLength(1);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		expect(mounted.facade.selectionKeyIntent({ kind: 'backtrack' })).toEqual({
			claimed: true,
			adapterId: 'layout'
		});
		await eventually(() => knots().length === 0);
		expect(mounted.host.history()).toMatchObject({
			depth: beforeHistory.depth + 1,
			position: beforeHistory.position + 1
		});
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(knots()).toHaveLength(1);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
	});

	it('refuses Delete on a curved Wall with no active bend point instead of deleting it', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		await bendWallAt(mounted, 4.5);
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 4);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		// A curved Wall claims the key and refuses without an active knot, so Delete
		// can never fall through to the Wall's destructive Card action.
		expect(mounted.facade.selectionKeyIntent({ kind: 'delete' })).toEqual({
			claimed: true,
			adapterId: 'layout'
		});
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
		expect(acceptedLayout(mounted.facade).walls.some((wall) => wall.id === mounted.wallId)).toBe(true);
	});

	it('refuses Delete when the named bend point is already gone', async () => {
		// A pre-curved Wall stays curved after the inserted knot is undone, so the
		// selected Wall is still a valid Delete target while its named knot is not.
		const base = createEmptyWallFirstLayoutDocument();
		base.floor.elevation = ELEVATION;
		base.junctions = [
			{ id: 'stale-a', point: [0, 0] },
			{ id: 'stale-b', point: [6, 0] }
		];
		base.walls = [
			{
				id: 'stale-curve',
				startJunctionId: 'stale-a',
				endJunctionId: 'stale-b',
				thickness: 0.2,
				height: 3,
				centerline: {
					kind: 'cubic-chain',
					knots: [],
					spans: [{ handleOut: [2, 3], handleIn: [4, 3] }]
				}
			} satisfies LayoutWall
		];
		const mounted = await mount({ document: base, wallId: 'stale-curve', openingId: '' });
		settle(mounted.facade, 2);
		await bendWallAt(mounted, 3);
		await activateFirstBendPoint(mounted);
		expect((await mounted.host.undo()).kind).toBe('installed');
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === 'stale-curve')!;
			return wall.centerline.kind === 'cubic-chain' && wall.centerline.knots.length === 0;
		});
		// Undo rebases the source: the adapter binding is rebuilt on the host's
		// next live frame, exactly as every other post-write assertion does.
		settle(mounted.facade, 5);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();

		// Stale state refuses; it never straightens and never deletes the Wall.
		expect(mounted.facade.selectionKeyIntent({ kind: 'delete' })).toEqual({
			claimed: true,
			adapterId: 'layout'
		});
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
		expect(acceptedLayout(mounted.facade).walls.some((wall) => wall.id === 'stale-curve')).toBe(true);
	});

	it('leaves straight-Wall Delete to the host command map', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 4);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();
		// A straight Wall claims neither key, so the route keeps its existing Delete
		// action and Backspace command instead of growing a curve-only branch.
		expect(mounted.facade.selectionKeyIntent({ kind: 'delete' })).toEqual({ claimed: false, adapterId: null });
		expect(mounted.facade.selectionKeyIntent({ kind: 'backtrack' })).toEqual({ claimed: false, adapterId: null });
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
	});

	it('straightens a curved Wall from the Card and leaves straight Walls action-free', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const subject = { sourceId: mounted.wallId, sourceKind: 'wall' as const, ref: null };
		// Straight Walls expose the scoped Split and delete: no hidden Bend-armed
		// mode and no curve vocabulary leaks in; unfold entry lives in the Card foot.
		expect(stageCardActions(mounted.facade, subject).map((action) => action.id)).toEqual([
				'layout-wall-delete',
				'layout-wall-face',
				'layout-wall-split'
			]);

		const evaluationId = mounted.facade.evaluationId()!;
		const from = stageCss(mounted.facade, [4.5, 0]);
		const to = stageCss(mounted.facade, [4.5, 0.7]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, metaKey: true }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
			return wall.centerline.kind === 'cubic-chain';
		});
		selectWall(mounted.facade, mounted.wallId);
		settle(mounted.facade, 4);
		const curvedBytes = mounted.facade.snapshot().canonicalJson;
		const beforeOpening = acceptedLayout(mounted.facade).openings.find((opening) => opening.id === mounted.openingId)!;
		const actions = stageCardActions(mounted.facade, subject);
		expect(actions.map((action) => action.id)).toEqual(
			expect.arrayContaining(['layout-wall-straighten', 'layout-wall-delete'])
		);
		expect(actions.some((action) => action.id === 'layout-wall-knot-remove')).toBe(false);
		const straighten = actions.find((action) => action.id === 'layout-wall-straighten')!;
		expect((await straighten.run()).kind).toBe('accepted');
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === mounted.wallId)!;
			return wall.centerline.kind === 'line';
		});
		const afterOpening = acceptedLayout(mounted.facade).openings.find((opening) => opening.id === mounted.openingId)!;
		expect(afterOpening.offset).toBeCloseTo(beforeOpening.offset, 9);
		expect(afterOpening.width).toBeCloseTo(beforeOpening.width, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 3, position: 2 });
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(mounted.facade.snapshot().canonicalJson).toBe(curvedBytes);
	});

	it('publishes bend marks and bends a curved Wall from a meta body press in one Undo step', async () => {
		const base = createEmptyWallFirstLayoutDocument();
		base.floor.elevation = ELEVATION;
		base.junctions = [
			{ id: 'c-a', point: [0, 0] },
			{ id: 'c-b', point: [6, 0] }
		];
		base.walls = [
			{
				id: 'curved',
				startJunctionId: 'c-a',
				endJunctionId: 'c-b',
				thickness: 0.2,
				height: 3,
				centerline: {
					kind: 'cubic-chain',
					knots: [],
					spans: [{ handleOut: [2, 3], handleIn: [4, 3] }]
				}
			} satisfies LayoutWall
		];
		const mounted = await mount({ document: base, wallId: 'curved', openingId: '' });
		settle(mounted.facade, 2);
		selectWall(mounted.facade, 'curved');
		// C1/P1 — the selected Wall carries contextual shape points: both junction
		// ends and one hollow span ring, with no hidden Bend-armed mode.
		const bendMarks = mounted.facade
			.marks()
			.filter((mark) => mark.adapterId === 'layout' && mark.role === 'edit');
		expect(bendMarks.map((mark) => mark.id)).toEqual([
			'layout-wall-start-mark',
			'layout-wall-end-mark',
			'layout-wall-span:0'
		]);
		const curved = curvedWallFrame(acceptedLayout(mounted.facade), 'curved')!;
		const from = stageCss(mounted.facade, curvedWallPointAt(curved, curved.length / 2)!.point);
		const evaluationId = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, metaKey: true }).claimed).toBe(true);
		const to = stageCss(mounted.facade, [3, 3.4]);
		const work: string[] = [];
		const previous = setWorkObserver({ count: (name) => work.push(name), span: (name) => work.push(name) });
		try {
			mounted.facade.pointerIntent({ phase: 'move', css: stageCss(mounted.facade, [3, 3.1]), evaluationId });
			mounted.facade.candidatePreviews();
			mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
			expect(
				mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-wall-bend')
			).toBe(true);
		} finally {
			setWorkObserver(previous);
		}
		expect(work.filter((name) => name === 'compile' || name === 'validation:layout-document' || name === 'room-reconciliation')).toEqual([]);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === 'curved')!;
			return wall.centerline.kind === 'cubic-chain' && wall.centerline.knots.length === 1;
		});
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		// A second press cancelled before release leaves no preview and no write.
		selectWall(mounted.facade, 'curved');
		settle(mounted.facade, 3);
		const secondCurve = curvedWallFrame(acceptedLayout(mounted.facade), 'curved')!;
		const secondFrom = stageCss(mounted.facade, curvedWallPointAt(secondCurve, secondCurve.length / 2)!.point);
		const secondId = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: secondFrom, evaluationId: secondId, metaKey: true }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId: secondId });
		mounted.facade.pointerIntent({ phase: 'cancel', css: to, evaluationId: secondId });
		expect(mounted.session.gesture()).toBeNull();
		expect(mounted.session.liveProposal()).toBeNull();
		expect(
			mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-wall-bend')
		).toBe(false);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
		expect((await mounted.host.undo()).kind).toBe('installed');
		const restored = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === 'curved')!;
		expect(restored.centerline.kind).toBe('cubic-chain');
		if (restored.centerline.kind !== 'cubic-chain') return;
		expect(restored.centerline.knots).toHaveLength(0);
		// The Card remains the non-pointer path for the Wall's ordinary fields.
		expect(createCardFieldsInstrument(mounted.services)!.fields().some((field) => field.id === 'height')).toBe(true);
	});

	it('retries a refused Bend release without validating pointer moves', async () => {
		const base = createEmptyWallFirstLayoutDocument();
		base.floor.elevation = ELEVATION;
		base.junctions = [{ id: 'bend-start', point: [0, 0] }, { id: 'bend-end', point: [6, 0] }];
		base.walls = [{
			id: 'bend-wall', startJunctionId: 'bend-start', endJunctionId: 'bend-end',
			thickness: 0.2, height: 3, centerline: { kind: 'line' }
		}];
		const circle = planCreateCircularRoom({
			baseline: base, center: [3, 4.5], rim: [3.6, 4.5],
			capture: freshCapture(), levelId: base.floor.id
		});
		if (circle.kind !== 'success') throw new Error(circle.rejection.message);
		const mounted = await mount({ document: circle.document, wallId: 'bend-wall', openingId: '' });
		settle(mounted.facade, 2);
		selectWall(mounted.facade, 'bend-wall');
		const evaluationId = mounted.facade.evaluationId()!;
		const before = mounted.facade.snapshot().canonicalJson;
		const from = stageCss(mounted.facade, [3, 0]);
		const refused = stageCss(mounted.facade, [3, 4.5]);
		const clear = stageCss(mounted.facade, [3, 1]);

		const propose = (to: readonly [number, number]) => {
			expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, metaKey: true }).claimed).toBe(true);
			const work: string[] = [];
			const previous = setWorkObserver({ count: (name) => work.push(name), span: (name) => work.push(name) });
			try {
				mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
				expect(mounted.facade.candidatePreviews().some((preview) => preview.id === 'layout-candidate-wall-bend')).toBe(true);
			} finally {
				setWorkObserver(previous);
			}
			expect(work.filter((name) => name === 'compile' || name === 'validation:layout-document' || name === 'room-reconciliation')).toEqual([]);
			mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		};

		propose(refused);
		await eventually(() => mounted.facade.candidatePreviews().some((preview) =>
			preview.id === 'layout-candidate-refused-settled' && preview.labels.some((label) => label.text.includes('circular Wall'))
		));
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		expect(mounted.host.history().position).toBe(0);

		propose(clear);
		await eventually(() => acceptedLayout(mounted.facade).walls.find((wall) => wall.id === 'bend-wall')?.centerline.kind === 'cubic-chain');
		expect(mounted.host.history().position).toBe(1);
		mounted.facade.dispose();
	});

	it('removes an existing knot by flattening it onto the neighbour chord, and Undo restores it', async () => {
		const base = createEmptyWallFirstLayoutDocument();
		base.floor.elevation = ELEVATION;
		base.junctions = [
			{ id: 'c-a', point: [0, 0] },
			{ id: 'c-b', point: [6, 0] }
		];
		base.walls = [
			{
				id: 'curved',
				startJunctionId: 'c-a',
				endJunctionId: 'c-b',
				thickness: 0.2,
				height: 3,
				centerline: {
					kind: 'cubic-chain',
					knots: [],
					spans: [{ handleOut: [2, 3], handleIn: [4, 3] }]
				}
			} satisfies LayoutWall
		];
		const mounted = await mount({ document: base, wallId: 'curved', openingId: '' });
		settle(mounted.facade, 2);
		selectWall(mounted.facade, 'curved');
		const curved = curvedWallFrame(acceptedLayout(mounted.facade), 'curved')!;
		const from = stageCss(mounted.facade, curvedWallPointAt(curved, curved.length / 2)!.point);
		const evaluationId = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId, metaKey: true }).claimed).toBe(true);
		const bendTo = stageCss(mounted.facade, [3, 3.4]);
		mounted.facade.pointerIntent({ phase: 'move', css: bendTo, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: bendTo, evaluationId });
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === 'curved')!;
			return wall.centerline.kind === 'cubic-chain' && wall.centerline.knots.length === 1;
		});
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });

		selectWall(mounted.facade, 'curved');
		settle(mounted.facade, 3);
		const bent = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === 'curved')!;
		if (bent.centerline.kind !== 'cubic-chain') throw new Error('expected a bent chain');
		const knot = bent.centerline.knots[0]!;
		const knotCss = stageCss(mounted.facade, [knot.point[0], knot.point[1]]);
		const removalEvaluation = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: knotCss, evaluationId: removalEvaluation, metaKey: true }).claimed).toBe(true);
		// Leave the chord first, then return to it: the must-leave hysteresis.
		mounted.facade.pointerIntent({ phase: 'move', css: stageCss(mounted.facade, [3, 4]), evaluationId: removalEvaluation });
		const chord = stageCss(mounted.facade, [3, 0.02]);
		mounted.facade.pointerIntent({ phase: 'move', css: chord, evaluationId: removalEvaluation });
		const removal = mounted.facade.candidatePreviews().find((candidate) => candidate.id === 'layout-candidate-wall-bend-remove');
		expect(removal).toBeDefined();
		expect(removal!.labels[0]?.text).toBe('Remove bend point');
		mounted.facade.pointerIntent({ phase: 'up', css: chord, evaluationId: removalEvaluation });
		await eventually(() => {
			const wall = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === 'curved')!;
			return wall.centerline.kind !== 'cubic-chain' || wall.centerline.knots.length === 0;
		});
		expect(mounted.host.history()).toMatchObject({ depth: 3, position: 2 });
		expect((await mounted.host.undo()).kind).toBe('installed');
		const restored = acceptedLayout(mounted.facade).walls.find((candidate) => candidate.id === 'curved')!;
		expect(restored.centerline.kind).toBe('cubic-chain');
		if (restored.centerline.kind !== 'cubic-chain') return;
		expect(restored.centerline.knots).toHaveLength(1);
	});

	it('plain-drags a connected curved Wall without changing its knots or Opening station', async () => {
		const base = createEmptyWallFirstLayoutDocument();
		base.floor.elevation = ELEVATION;
		base.junctions = [
			{ id: 'c-a', point: [0, 0] },
			{ id: 'c-b', point: [6, 0] },
			{ id: 'c-c', point: [6, 3] }
		];
		base.walls = [
			{
				id: 'curved',
				startJunctionId: 'c-a',
				endJunctionId: 'c-b',
				thickness: 0.2,
				height: 3,
				centerline: { kind: 'cubic-chain', knots: [], spans: [{ handleOut: [2, 3], handleIn: [4, 3] }] }
			} satisfies LayoutWall,
			{
				id: 'neighbour',
				startJunctionId: 'c-b',
				endJunctionId: 'c-c',
				thickness: 0.2,
				height: 3,
				centerline: { kind: 'line' }
			} satisfies LayoutWall
		];
		const opened = planCreateWallFirstOpening(
			base,
			{ wallId: 'curved', kind: 'window', offset: 1, width: 1, height: 1.2, sillHeight: 1 },
			freshCapture(),
			base.floor.id
		);
		if (opened.kind === 'rejected') throw new Error(`opening fixture refused: ${opened.rejection.message}`);
		const mounted = await mount({
			document: opened.document,
			wallId: 'curved',
			openingId: opened.changedOpeningIds[0]!
		});
		settle(mounted.facade, 2);
		await bendWallAt(mounted, 2);
		await bendWallAt(mounted, 4);
		selectWall(mounted.facade, 'curved');
		settle(mounted.facade, 6);
		const before = acceptedLayout(mounted.facade);
		const beforeWall = before.walls.find((wall) => wall.id === 'curved')!;
		const beforeKnots = beforeWall.centerline.kind === 'cubic-chain' ? beforeWall.centerline.knots.length : 0;
		const beforeOpening = before.openings.find((opening) => opening.id === mounted.openingId)!;
		const beforeFrame = curvedWallFrame(before, 'curved')!;
		const beforeNeighbour = before.walls.find((wall) => wall.id === 'neighbour')!;
		const beforeShared = before.junctions.find((junction) => junction.id === beforeNeighbour.startJunctionId)!;
		const historyBefore = mounted.host.history().depth;
		const from = stageCss(mounted.facade, curvedWallPointAt(beforeFrame, 3)!.point);
		const to = stageCss(mounted.facade, [3, 1]);
		const evaluationId = mounted.facade.evaluationId()!;
		expect(mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-wall')).toBe(true);
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.id === 'layout-candidate-wall-bend')).toBe(false);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => mounted.host.history().depth === historyBefore + 1);
		const after = acceptedLayout(mounted.facade);
		const afterWall = after.walls.find((wall) => wall.id === 'curved')!;
		const afterKnots = afterWall.centerline.kind === 'cubic-chain' ? afterWall.centerline.knots.length : 0;
		expect(afterKnots).toBe(beforeKnots);
		expect(afterKnots).toBe(2);
		expect(wallFirstWallLength(after, 'curved')!).toBeCloseTo(wallFirstWallLength(before, 'curved')!, 6);
		const afterOpening = after.openings.find((opening) => opening.id === mounted.openingId)!;
		expect(afterOpening.offset).toBeCloseTo(beforeOpening.offset, 9);
		expect(afterOpening.width).toBeCloseTo(beforeOpening.width, 9);
		const afterNeighbour = after.walls.find((wall) => wall.id === 'neighbour')!;
		const afterShared = after.junctions.find((junction) => junction.id === afterNeighbour.startJunctionId)!;
		expect(afterShared.point[0]).toBeCloseTo(beforeShared.point[0], 6);
		expect(afterShared.point[1]).not.toBeCloseTo(beforeShared.point[1], 6);
	});
});
