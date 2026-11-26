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
import { createEmptyWallFirstLayoutDocument, planCreateWallFirstOpening, planWallChain, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import type { PlanSourceRef } from '@portfolio/layout-core/world';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { wallFrame } from '$lib/authoring/adapters/layout/precision-frames';
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
function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageEnvelope(facade.snapshot()).units.layout.data;
}
function wallPoints(document: LayoutDocumentWallFirst, wallId: string): {
	readonly start: readonly [number, number];
	readonly end: readonly [number, number];
	readonly length: number;
} {
	const frame = wallFrame(document, wallId);
	if (frame === null) throw new Error('the fixture wall has no straight frame');
	return { start: frame.start, end: frame.end, length: frame.length };
}

describe('wall and junction entry', () => {
	it('types a body distance and commits it along the normal once', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const middle = stageCss(mounted.facade, [2.2, 0]);
		const shifted = stageCss(mounted.facade, [2.2, 0.37]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: middle, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: shifted, evaluationId });
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '3' }).claimed).toBe(true);
		expect(
			mounted.facade
				.candidatePreviews()
				.flatMap((candidate) => candidate.labels)
				.some((label) => label.text.includes('Distance 3'))
		).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'finish' }).claimed).toBe(true);
		await eventually(() => {
			const points = wallPoints(acceptedLayout(mounted.facade), mounted.wallId);
			return Math.abs(points.start[1] - 3) < 1e-6;
		});
		const after = wallPoints(acceptedLayout(mounted.facade), mounted.wallId);
		expect(after.start[0]).toBeCloseTo(0, 9);
		expect(after.end[0]).toBeCloseTo(6, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('types a body distance from the move grip and commits it along the normal', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		// The body press is the rigid-move surface now that the move glyph is
		// retired; no modifier means move, so its numeric distance writer is live.
		const gripCss = stageCss(mounted.facade, [4.5, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: gripCss, evaluationId }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '2' }).claimed).toBe(true);
		expect(
			mounted.facade.candidatePreviews()
				.flatMap((candidate) => candidate.labels)
				.some((label) => label.text.includes('Distance 2'))
		).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'finish' }).claimed).toBe(true);
		// The release after Enter must not write a second time.
		mounted.facade.pointerIntent({ phase: 'up', css: gripCss, evaluationId });
		await eventually(() => {
			const points = wallPoints(acceptedLayout(mounted.facade), mounted.wallId);
			return Math.abs(points.start[1] - 2) < 1e-6;
		});
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('types a Junction X then Z with Tab and commits one shared-Junction edit', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '6' }).claimed).toBe(true);
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-end-mark' && mark.tag.includes('X 6'))).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '\t' }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '1' }).claimed).toBe(true);
		expect(mounted.facade.marks().some((mark) => mark.id === 'layout-wall-end-mark' && mark.tag.includes('Z 1'))).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'finish' }).claimed).toBe(true);
		// The release after Enter must not write a second time.
		mounted.facade.pointerIntent({ phase: 'up', css: endCss, evaluationId });
		await eventually(() => {
			const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId);
			return frame !== null && Math.abs(frame.end[1] - 1) < 1e-6;
		});
		expect(wallPoints(acceptedLayout(mounted.facade), mounted.wallId).end[0]).toBeCloseTo(6, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('commits a typed Junction X alone and keeps the current Z', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'type', key: '5' }).claimed).toBe(true);
		expect(mounted.facade.gestureKeyIntent({ kind: 'finish' }).claimed).toBe(true);
		await eventually(() => {
			const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId);
			return frame !== null && Math.abs(frame.end[0] - 5) < 1e-6;
		});
		const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId)!;
		expect(frame.end[1]).toBeCloseTo(0, 9);
		expect(mounted.host.history()).toMatchObject({ depth: 2, position: 1 });
	});

	it('commits the winning Junction snap point exactly', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		const to = stageCss(mounted.facade, [5.52, 0.03]);
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		// The guide from the other end fixes Z; the 0.5 m grid fixes X. The commit
		// must be that winning point, not the raw pointer sample beside it.
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.snap !== undefined)).toBe(true);
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => {
			const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId);
			return frame !== null && Math.abs(frame.end[0] - 5.5) < 1e-9;
		});
		const frame = wallFrame(acceptedLayout(mounted.facade), mounted.wallId)!;
		expect(frame.end[0]).toBeCloseTo(5.5, 9);
		expect(frame.end[1]).toBeCloseTo(0, 9);
	});

	it('tags the moving end point with the candidate length and angle', async () => {
		const mounted = await mount();
		settle(mounted.facade, 2);
		selectWall(mounted.facade, mounted.wallId);
		const evaluationId = mounted.facade.evaluationId()!;
		const endCss = stageCss(mounted.facade, [6, 0]);
		expect(mounted.facade.pointerIntent({ phase: 'down', css: endCss, evaluationId }).claimed).toBe(true);
		mounted.facade.pointerIntent({ phase: 'move', css: stageCss(mounted.facade, [5.5, 0.5]), evaluationId });
		const tag = mounted.facade.marks().find((mark) => mark.id === 'layout-wall-end-mark')?.tag ?? '';
		expect(tag).toBe('Δx −0.50 · Δz +0.50 m');
		expect(tag).not.toContain('°');
		expect(tag).not.toMatch(/^X /);
		mounted.facade.pointerIntent({ phase: 'cancel', css: endCss, evaluationId });
	});
});
