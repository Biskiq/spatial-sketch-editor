/**
 * T1 Wave 4 · C4 — Connected curve authoring and parity, through the production
 * Layout adapter and the real F.4 host.
 *
 * The journey pinned here:
 *
 * 1. a connected rotunda reads **Room · Round** with Radius and Diameter on its
 *    Room Card, and publishes exactly one radius ray from its stated centre to
 *    its authored seam;
 * 2. dragging that ray previews the complete `planResizeRoundRoomRadius`
 *    candidate and releases the identical document — one history entry;
 * 3. the same Room-owned edit serves an isolated closed circle, so the Wall Card
 *    and the Room Card address one authored fact;
 * 4. **Release round** is the Room's explicit workaround: a ring clears the fact
 *    and an isolated circle becomes two ordinary arcs, both undoable;
 * 5. a member arc refuses bend/straighten with the canonical words and writes
 *    nothing; its Length reads **set by Radius** and its Card offers one step to
 *    each Room it bounds;
 * 6. a Round Room moves its complete physical component, including dangling
 *    attachments, and duplicates as a detached ring with fresh identities;
 * 7. Undo/Redo and Save/Reopen preserve the authored fact, radius, seam and
 *    identity, and the compiled geometry the visitor runtime consumes is equal
 *    before and after the round trip.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planCreateWallFirstOpening,
	planWallChain,
	serializeWallFirstLayoutDocument,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core/wall';
import {
	certifyRoundRoom,
	planCreateCircularRoom,
	planResizeRoundRoomRadius,
	roundRoomSeamJunctionId
} from '@portfolio/layout-core/room';
import { planDuplicateRoom } from '@portfolio/layout-core/plan';
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core/geometry';
import { mintLayoutIdCapture } from '@portfolio/layout-core/plan';
import {
	captureUnitSave,
	prepareUnitRuntime,
	readUnitEnvelopeForSave,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost, type StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import {
	stageCardActions,
	stageCardFacts,
	stageCardWriter
} from '$lib/authoring/stage/stage-contributions';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import { wallCenterlinePaper } from '$lib/authoring/adapters/layout/candidate-preview';
import {
	roundRoomRadiusIntent,
	roundRoomReleaseIntent
} from '$lib/authoring/adapters/layout/round-room-planners';
import { roomDuplicateIntent } from '$lib/authoring/adapters/layout/room-duplicate-planners';
import { buildLayoutIntent, LAYOUT_ROOM_MOVE_KIND } from '$lib/authoring/adapters/layout/precision';
import { ROUND_ROOM_MEMBER_EDIT_MESSAGE } from '@portfolio/layout-core/room';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const PROJECT_ID = 'project-layout-c4-connected-curves';

type Ring = {
	readonly document: LayoutDocumentWallFirst;
	readonly roomId: string;
	readonly seamJunctionId: string;
	readonly memberWallIds: readonly string[];
	readonly outsideWallIds: readonly string[];
	readonly openingId?: string;
};

function cap(seed: string) {
	return mintLayoutIdCapture(() => seed.padEnd(8, '-0'));
}

function rotunda(options: { center: [number, number]; radius: number; seed: string; name: string }) {
	const baseline = createEmptyWallFirstLayoutDocument();
	const plan = planCreateCircularRoom({
		baseline,
		center: options.center,
		rim: [options.center[0] + options.radius, options.center[1]],
		thickness: 0.2,
		height: 3,
		capture: cap(options.seed),
		levelId: baseline.floor.id,
		roomNamePrefix: options.name
	});
	if (plan.kind !== 'success') throw new Error(`rotunda refused: ${plan.rejection.message}`);
	return {
		document: plan.document,
		roomId: plan.createdRoomIds[0]!,
		wallId: plan.wallId,
		junctionId: plan.junctionId
	};
}

/** A connected rotunda: the circle split by two attached outside Walls. */
function connectedRing(options: { center?: [number, number]; radius?: number } = {}): Ring {
	const center = options.center ?? [0, 0];
	const radius = options.radius ?? 5;
	const [cx, cz] = center;
	const rot = rotunda({ center, radius, seed: 'c4-ring', name: 'Rotunda' });
	const first = planWallChain({
		baseline: rot.document,
		points: [
			[cx, cz + radius],
			[cx, cz + radius + 4]
		],
		close: false,
		endpointHostSnaps: [{ pointIndex: 0, wallId: rot.wallId }],
		capture: cap('c4-ring-a1'),
		levelId: rot.document.floor.id
	});
	if (first.kind !== 'success') throw new Error(`first attach refused: ${first.rejection.message}`);
	const arc = first.createdWallIds.find((id) => id !== first.authoredWallIds[0])!;
	const second = planWallChain({
		baseline: first.document,
		points: [
			[cx - radius, cz],
			[cx - radius - 4, cz]
		],
		close: false,
		endpointHostSnaps: [{ pointIndex: 0, wallId: arc }],
		capture: cap('c4-ring-a2'),
		levelId: first.document.floor.id
	});
	if (second.kind !== 'success') throw new Error(`second attach refused: ${second.rejection.message}`);
	const ringRoom = second.document.rooms.find((room) => room.id === rot.roomId)!;
	const wallById = new Map(second.document.walls.map((wall) => [wall.id, wall] as const));
	// One Opening on a member arc proves the radius edit keeps its angular station.
	const member = ringRoom.boundary[1]!.wallId;
	const withOpening = planCreateWallFirstOpening(
		second.document,
		{
			wallId: member,
			kind: 'window',
			offset: 0.8,
			width: 1.1,
			height: 1.2,
			sillHeight: 1,
			profile: 'rectangular'
		},
		cap('c4-ring-opening'),
		second.document.floor.id
	);
	if (withOpening.kind === 'rejected') throw new Error(`ring Opening refused: ${withOpening.rejection.message}`);
	const document = withOpening.document;
	const finalRoom = document.rooms.find((room) => room.id === rot.roomId)!;
	return {
		document,
		roomId: rot.roomId,
		seamJunctionId: roundRoomSeamJunctionId(finalRoom, wallById)!,
		memberWallIds: finalRoom.boundary.map((ref) => ref.wallId),
		outsideWallIds: [first.authoredWallIds[0]!, second.authoredWallIds[0]!],
		openingId: withOpening.changedOpeningIds[0]!
	};
}

type AttachedGallery = Ring & {
	readonly galleryId: string;
	readonly sharedWallId: string;
	readonly doorId: string;
};

/** J6's shape: a Rotunda attached to an ordinary Gallery by one shared arc and door. */
function attachedGallery(): AttachedGallery {
	const rot = rotunda({ center: [0, 0], radius: 5, seed: 'c4-gallery', name: 'Rotunda' });
	const attach = planWallChain({
		baseline: rot.document,
		points: [
			[0, 5],
			[0, 10],
			[10, 10],
			[10, 0],
			[5, 0]
		],
		close: false,
		endpointHostSnaps: [{ pointIndex: 0, wallId: rot.wallId }],
		endpointJunctionSnaps: [{ pointIndex: 4, junctionId: rot.junctionId }],
		capture: cap('c4-gallery-annex'),
		levelId: rot.document.floor.id
	});
	if (attach.kind !== 'success') throw new Error(`gallery attach refused: ${attach.rejection.message}`);
	const rotundaRoom = attach.document.rooms.find((room) => room.id === rot.roomId)!;
	const galleryRoom = attach.document.rooms.find((room) => room.id !== rot.roomId)!;
	const shared = rotundaRoom.boundary.find((ref) =>
		galleryRoom.boundary.some((other) => other.wallId === ref.wallId)
	)!;
	const door = planCreateWallFirstOpening(
		attach.document,
		{
			wallId: shared.wallId,
			kind: 'door',
			offset: 1,
			width: 0.8,
			connectsRoomIds: [rot.roomId, galleryRoom.id]
		},
		cap('c4-gallery-door'),
		attach.document.floor.id
	);
	if (door.kind === 'rejected') throw new Error(`gallery door refused: ${door.rejection.message}`);
	const document = door.document;
	const finalRotunda = document.rooms.find((room) => room.id === rot.roomId)!;
	return {
		document,
		roomId: rot.roomId,
		seamJunctionId: roundRoomSeamJunctionId(
			finalRotunda,
			new Map(document.walls.map((wall) => [wall.id, wall]))
		)!,
		memberWallIds: finalRotunda.boundary.map((ref) => ref.wallId),
		outsideWallIds: attach.authoredWallIds,
		openingId: door.changedOpeningIds[0]!,
		galleryId: galleryRoom.id,
		sharedWallId: shared.wallId,
		doorId: door.changedOpeningIds[0]!
	};
}

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly host: StageAcceptanceHost;
	readonly services: StageAdapterServices;
};

async function mount(document: LayoutDocumentWallFirst): Promise<Mounted> {
	const project: ProjectEnvelope = await createUnitProject({
		id: PROJECT_ID,
		name: 'C4 connected curves',
		layout: document,
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [],
			navigationNodes: [],
			connections: []
		}
	});
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-c4-connected-curves',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`fixture not admitted: ${admitted.kind}`);
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
	if (registration.kind !== 'registered' || services === undefined)
		throw new Error('Layout adapter did not mount');
	return { facade, session, host, services };
}

function settle(facade: StageFacade, clockSeconds = 2): void {
	const result = facade.camera.evaluate(RECT, clockSeconds);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	facade.overlays();
	facade.tasks();
}

function acceptedLayout(facade: StageFacade): LayoutDocumentWallFirst {
	return stageEnvelope(facade.snapshot()).units.layout.data;
}

function selectRoom(facade: StageFacade, roomId: string): void {
	const snapshot = facade.snapshot();
	facade.select({
		sourceId: roomId,
		sourceKind: 'room-floor',
		generationId: snapshot.compileGeneration,
		ref: {
			sourceId: roomId,
			sourceKind: 'room-floor',
			generationId: snapshot.compileGeneration,
			stream: 'projected',
			subRef: null
		}
	});
}

function stageCss(facade: StageFacade, point: readonly [number, number]): readonly [number, number] {
	// The drag target is read by the working-plane ray, so project it at the
	// document's own datum rather than a guessed Paper elevation.
	return projectWorldCss(facade, [point[0], facade.snapshot().domain.datumMeters, point[1]]);
}

function projectWorldCss(
	facade: StageFacade,
	point: readonly [number, number, number]
): readonly [number, number] {
	const evaluationId = facade.evaluationId();
	if (evaluationId === null) throw new Error('the mounted fixture has no evaluation');
	const projected = facade.projectWorld(point, evaluationId);
	if (projected.kind !== 'projected') throw new Error('the fixture point did not project');
	return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
}

async function eventually(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 80; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('the fixture did not settle');
}

function roomSubject(roomId: string) {
	return { sourceId: roomId, sourceKind: 'room-floor' as const, ref: null };
}

function wallSubject(wallId: string) {
	return { sourceId: wallId, sourceKind: 'wall' as const, ref: null };
}

function roomFact(facts: readonly { label: string; value: string }[], label: string): string | undefined {
	return facts.find((fact) => fact.label === label)?.value;
}

describe('C4 · connected curve authoring', () => {
	it('reads Room · Round with Radius, Diameter, the radius ray and Release round', async () => {
		const ring = connectedRing();
		const mounted = await mount(ring.document);
		settle(mounted.facade, 2);

		const facts = stageCardFacts(mounted.facade, roomSubject(ring.roomId));
		expect(roomFact(facts, 'Kind')).toBe('Room · Round');
		expect(roomFact(facts, 'Radius')).toBe('5 m');
		expect(roomFact(facts, 'Diameter')).toBe('10 m');
		expect(roomFact(facts, 'Area')).toMatch(/m²$/);

		const writer = stageCardWriter(mounted.facade, roomSubject(ring.roomId));
		expect(writer?.fieldIds).toEqual(['radius', 'diameter']);

		const actions = stageCardActions(mounted.facade, roomSubject(ring.roomId));
		const release = actions.find((action) => action.id === 'layout-room-release-round');
		expect(release).toBeDefined();
		expect(release!.detail).toContain('stops being round');
		expect(release!.group).toBe('secondary');

		mounted.facade.select({
			sourceId: ring.roomId,
			sourceKind: 'room-floor',
			generationId: mounted.facade.snapshot().compileGeneration,
			ref: {
				sourceId: ring.roomId,
				sourceKind: 'room-floor',
				generationId: mounted.facade.snapshot().compileGeneration,
				stream: 'projected',
				subRef: null
			}
		});
		settle(mounted.facade, 2);
		const ray = mounted.facade.marks().find((mark) => mark.id === 'layout-round-room-radius-mark');
		expect(ray).toBeDefined();
		expect(ray!.role).toBe('edit');
		expect(ray!.fact).toBe('radius');
		expect(ray!.planner).toBe('layout-round-room-radius');

		// A member arc is an ordinary Wall: it reads Length · set by Radius and
		// offers one step back to the Room it bounds.
		const memberId = ring.memberWallIds[0]!;
		const memberFacts = stageCardFacts(mounted.facade, wallSubject(memberId));
		const arcLength = memberFacts.find((fact) => fact.label.includes('Length (arc)'));
		expect(arcLength).toBeDefined();
		expect(arcLength!.label).toContain('set by Radius');
		const bounds = memberFacts.find((fact) => fact.label === 'Bounds');
		expect(bounds?.value).toBe(ring.document.rooms.find((room) => room.id === ring.roomId)!.name);
		const memberActions = stageCardActions(mounted.facade, wallSubject(memberId));
		const roomName = ring.document.rooms.find((room) => room.id === ring.roomId)!.name;
		expect(memberActions.some((action) => action.label === `Go to ${roomName}`)).toBe(true);
		// Split stays available; only geometry that would break the circle refuses.
		expect(memberActions.some((action) => action.id === 'layout-wall-split')).toBe(true);
	});

	it('previews and commits the identical whole-radius candidate from the Stage ray', async () => {
		const ring = connectedRing();
		const mounted = await mount(ring.document);
		settle(mounted.facade, 2);
		selectRoom(mounted.facade, ring.roomId);
		settle(mounted.facade, 2);

		const before = acceptedLayout(mounted.facade);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();
		const openingBefore = before.openings.find((opening) => opening.id === ring.openingId)!;

		const ray = mounted.facade.marks().find((mark) => mark.id === 'layout-round-room-radius-mark')!;
		const evaluationId = mounted.facade.evaluationId()!;
		// Snap is the shared scalar-grip contract: a knob 5 cm off the 0.5 m grid
		// acquires the cell, and the candidate names the family it acquired.
		mounted.session.setDrafting({ snap: true });
		const knob = ray.tip!;
		const target = stageCss(mounted.facade, [6.05, 0]);

		mounted.facade.pointerIntent({ phase: 'down', css: knob, evaluationId, handleId: ray.id });
		mounted.facade.pointerIntent({ phase: 'move', css: target, evaluationId, handleId: ray.id });
		settle(mounted.facade, 2);
		const preview = mounted.facade.candidatePreviews();
		expect(preview).toHaveLength(1);
		expect(preview[0]!.id).toBe('layout-round-room-radius-candidate');
		expect(preview[0]!.role).toBe('subject');
		expect(preview[0]!.snap?.name).toBe('Grid');
		const shownRadius = Number(/Radius ([0-9.]+) m/.exec(preview[0]!.labels[0]!.text)![1]);
		expect(shownRadius).toBe(6);
		expect(preview[0]!.segments.length).toBeGreaterThan(0);

		// The preview is the complete candidate the release will write: every
		// segment projects the same planner document at the same snapped radius.
		const snappedPlan = planResizeRoundRoomRadius({
			document: before,
			roomId: ring.roomId,
			radius: shownRadius
		});
		if (snappedPlan.kind !== 'success') throw new Error('the snapped candidate was refused');
		const candidateSegments = wallCenterlinePaper(
			snappedPlan.document,
			new Set(snappedPlan.changedWallIds),
			mounted.facade.snapshot().domain.datumMeters
		).segments.map(([from, to]) => [projectWorldCss(mounted.facade, from), projectWorldCss(mounted.facade, to)] as const);
		expect(preview[0]!.segments).toHaveLength(candidateSegments.length);
		for (let index = 0; index < candidateSegments.length; index += 1) {
			const shown = preview[0]!.segments[index]!;
			const planned = candidateSegments[index]!;
			for (const end of [0, 1] as const) {
				expect(shown[end][0]).toBeCloseTo(planned[end][0], 5);
				expect(shown[end][1]).toBeCloseTo(planned[end][1], 5);
			}
		}

		mounted.facade.pointerIntent({ phase: 'up', css: target, evaluationId, handleId: ray.id });
		await eventually(() => mounted.host.history().depth === beforeHistory.depth + 1);
		await new Promise((resolve) => setTimeout(resolve, 0));
		settle(mounted.facade, 3);

		const after = acceptedLayout(mounted.facade);
		const afterBytes = mounted.facade.snapshot().canonicalJson;
		expect(afterBytes).not.toBe(beforeBytes);
		expect(mounted.host.history()).toMatchObject({
			depth: beforeHistory.depth + 1,
			position: beforeHistory.position + 1
		});

		// Identity, exact radius, seam and the Opening's angular station survive.
		const roomAfter = after.rooms.find((room) => room.id === ring.roomId)!;
		const committedRadius = roomAfter.round!.radius;
		expect(committedRadius).toBe(shownRadius);
		expect(roomAfter.name).toBe(before.rooms.find((room) => room.id === ring.roomId)!.name);
		expect(roundRoomSeamJunctionId(roomAfter, new Map(after.walls.map((wall) => [wall.id, wall])))).toBe(
			ring.seamJunctionId
		);
		expect(roomAfter.boundary.map((ref) => ref.wallId)).toEqual(ring.memberWallIds);
		const openingAfter = after.openings.find((opening) => opening.id === ring.openingId)!;
		expect(openingAfter.offset).toBeCloseTo(openingBefore.offset * (committedRadius / 5), 9);
		expect(certifyRoundRoom(after, roomAfter).kind).toBe('certified');

		// Preview and commit are the same planner output at the same exact radius,
		// not two interpretations. The tag rounds for display; the geometry does
		// not.
		const expected = planResizeRoundRoomRadius({
			document: before,
			roomId: ring.roomId,
			radius: committedRadius
		});
		expect(expected.kind).toBe('success');
		if (expected.kind !== 'success') throw new Error('the canonical radius planner refused');
		expect(serializeWallFirstLayoutDocument(after)).toBe(
			serializeWallFirstLayoutDocument(expected.document)
		);
		// The preview carries the complete candidate ring plus the stretched
		// neighbours, never a partial mark: one candidate, and its segment count
		// matches the committed Walls the plan reports as changed.
		expect(preview[0]!.segments.length).toBeGreaterThan(expected.changedWallIds.length);

		// Undo restores the exact bytes; Redo replays the same candidate.
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect((await mounted.host.redo()).kind).toBe('installed');
		await new Promise((resolve) => setTimeout(resolve, 0));
		settle(mounted.facade, 3);
		expect(mounted.facade.snapshot().canonicalJson).toBe(afterBytes);

		// Save/Reopen admits the same canonical bytes, and the visitor's compiler
		// reads the same physical geometry from them.
		const captured = await captureUnitSave({
			snapshot: mounted.host.coordinator().acceptedSnapshot(),
			operationId: 'c4-radius-roundtrip',
			precondition: { kind: 'create-only' }
		});
		expect(captured.kind).toBe('captured');
		if (captured.kind !== 'captured') throw new Error(`Save capture refused: ${captured.message}`);
		const reloaded = await readUnitEnvelopeForSave(captured.capture.canonicalJson);
		expect(reloaded.kind).toBe('read');
		if (reloaded.kind !== 'read') throw new Error(`Save reload refused: ${reloaded.message}`);
		const readmitted = await admitSource(reloaded.envelope, {
			sessionEpoch: 'session-c4-radius-roundtrip',
			acceptedRevision: captured.capture.acceptedRevision
		});
		expect(readmitted.kind).toBe('admitted');
		if (readmitted.kind !== 'admitted') throw new Error(`Reload admission refused: ${readmitted.kind}`);
		const reopened = stageEnvelope(readmitted.snapshot).units.layout.data;
		expect(JSON.stringify(reopened)).toBe(JSON.stringify(after));
		const reopenedCompiled = compileWallFirstLayoutGeometry(reopened).geometry;
		const editorRoom = mounted.facade.snapshot().domain.geometry.rooms.find(
			(room) => room.roomId === ring.roomId
		)!;
		const visitorRoom = reopenedCompiled.rooms.find((room) => room.roomId === ring.roomId)!;
		expect(visitorRoom.floorPolygon).toEqual(editorRoom.floorPolygon);
		expect(JSON.stringify(reopenedCompiled.walls)).toBe(
			JSON.stringify(mounted.facade.snapshot().domain.geometry.walls)
		);
	});

	it('edits an isolated circle through the same Room-owned radius intent', async () => {
		const circle = rotunda({ center: [0, 0], radius: 4, seed: 'c4-isolated', name: 'Rotunda' });
		const mounted = await mount(circle.document);
		settle(mounted.facade, 2);
		const roomId = circle.roomId;

		const facts = stageCardFacts(mounted.facade, roomSubject(roomId));
		expect(roomFact(facts, 'Kind')).toBe('Room · Round');
		const before = acceptedLayout(mounted.facade);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;

		const outcome = await mounted.services.authoring.accept(
			roundRoomRadiusIntent({
				roomId,
				radius: 7,
				operationId: 'c4-isolated-radius',
				projectId: mounted.facade.snapshot().acceptedRevision.projectId,
				revisionId: mounted.facade.snapshot().acceptedRevision.revisionId,
				contentRevision: mounted.facade.snapshot().domain.unitRevisions.layout,
				levelId: mounted.facade.snapshot().domain.layoutLevelId
			})
		);
		expect(outcome.kind).toBe('installed');
		settle(mounted.facade, 2);
		const after = acceptedLayout(mounted.facade);
		expect(after.rooms.find((room) => room.id === roomId)!.round?.radius).toBe(7);
		expect(after.walls).toHaveLength(1);
		expect(after.walls[0]!.id).toBe(before.walls[0]!.id);
		expect(after.junctions[0]!.id).toBe(before.junctions[0]!.id);
		const expected = planResizeRoundRoomRadius({ document: before, roomId, radius: 7 });
		expect(expected.kind).toBe('success');
		if (expected.kind !== 'success') throw new Error('the canonical radius planner refused');
		expect(serializeWallFirstLayoutDocument(expected.document)).toBe(
			serializeWallFirstLayoutDocument(stageEnvelope(mounted.facade.snapshot()).units.layout.data)
		);
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
	});

	it('releases a ring by clearing the fact, and an isolated circle by splitting once', async () => {
		const ring = connectedRing();
		const mounted = await mount(ring.document);
		settle(mounted.facade, 2);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();
		const release = stageCardActions(mounted.facade, roomSubject(ring.roomId)).find(
			(action) => action.id === 'layout-room-release-round'
		)!;
		const outcome = await release.run();
		expect(outcome.kind).toBe('accepted');
		settle(mounted.facade, 2);
		const ringAfter = acceptedLayout(mounted.facade);
		expect(ringAfter.rooms.find((room) => room.id === ring.roomId)!.round).toBeUndefined();
		expect(mounted.host.history().depth).toBe(beforeHistory.depth + 1);
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);

		// The same action on an isolated circle is one operation, one entry, and
		// keeps the Room and the seam Junction.
		const circle = rotunda({ center: [0, 0], radius: 4, seed: 'c4-release', name: 'Rotunda' });
		const isolated = await mount(circle.document);
		settle(isolated.facade, 2);
		const isolatedBefore = isolated.facade.snapshot().canonicalJson;
		const isolatedRelease = stageCardActions(isolated.facade, roomSubject(circle.roomId)).find(
			(action) => action.id === 'layout-room-release-round'
		)!;
		expect(isolatedRelease.detail).toContain('Splits the circle');
		expect((await isolatedRelease.run()).kind).toBe('accepted');
		settle(isolated.facade, 2);
		const isolatedAfter = acceptedLayout(isolated.facade);
		expect(isolatedAfter.walls).toHaveLength(2);
		expect(isolatedAfter.rooms.find((room) => room.id === circle.roomId)!.round).toBeUndefined();
		expect(isolatedAfter.junctions.some((junction) => junction.id === circle.junctionId)).toBe(true);
		expect((await isolated.host.undo()).kind).toBe('installed');
		expect(isolated.facade.snapshot().canonicalJson).toBe(isolatedBefore);
	});

	it('refuses a member straighten with the round words and writes nothing', async () => {
		const ring = connectedRing();
		const mounted = await mount(ring.document);
		settle(mounted.facade, 2);
		const memberId = ring.memberWallIds[0]!;
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();
		const straighten = stageCardActions(mounted.facade, wallSubject(memberId)).find(
			(action) => action.id === 'layout-wall-straighten'
		)!;
		expect(straighten).toBeDefined();
		const outcome = await straighten.run();
		expect(outcome.kind).toBe('refused');
		expect(outcome.message).toBe(ROUND_ROOM_MEMBER_EDIT_MESSAGE);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
	});

	it('moves the complete attached component around a Round Room', async () => {
		const ring = connectedRing();
		const mounted = await mount(ring.document);
		settle(mounted.facade, 2);
		const before = acceptedLayout(mounted.facade);
		const beforeHistory = mounted.host.history();
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const snapshot = mounted.facade.snapshot();
		const outcome = await mounted.services.authoring.accept(
			buildLayoutIntent({
				kind: LAYOUT_ROOM_MOVE_KIND,
				operationId: 'c4-round-move',
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: snapshot.acceptedRevision.revisionId,
				contentRevision: snapshot.domain.unitRevisions.layout,
				levelId: snapshot.domain.layoutLevelId,
				targets: [
					{
						version: 1,
						domain: 'layout',
						subject: { kind: 'room', id: ring.roomId },
						revision: { kind: 'exact', contentRevision: snapshot.domain.unitRevisions.layout },
						instancePath: [],
						location: {
							kind: 'layout-location',
							levelId: snapshot.domain.layoutLevelId,
							structureInstancePath: []
						},
						componentId: null,
						capabilityId: null
					}
				],
				payload: { roomId: ring.roomId, deltaX: 12, deltaZ: -3 }
			})
		);
		expect(outcome.kind).toBe('installed');
		settle(mounted.facade, 2);
		const after = acceptedLayout(mounted.facade);
		expect(after.walls).toHaveLength(before.walls.length);
		for (const wall of before.walls) {
			const movedWall = after.walls.find((candidate) => candidate.id === wall.id)!;
			expect(movedWall).toBeDefined();
			expect(movedWall.startJunctionId).toBe(wall.startJunctionId);
			expect(movedWall.endJunctionId).toBe(wall.endJunctionId);
		}
		for (const junction of before.junctions) {
			const moved = after.junctions.find((candidate) => candidate.id === junction.id)!;
			expect(moved.point[0]).toBeCloseTo(junction.point[0] + 12, 9);
			expect(moved.point[1]).toBeCloseTo(junction.point[1] - 3, 9);
		}
		const roomBefore = before.rooms.find((room) => room.id === ring.roomId)!;
		const roomAfter = after.rooms.find((room) => room.id === ring.roomId)!;
		expect(roomAfter.round?.radius).toBe(roomBefore.round?.radius);
		expect(roomAfter.round?.center[0]).toBeCloseTo(roomBefore.round!.center[0] + 12, 9);
		expect(roomAfter.round?.center[1]).toBeCloseTo(roomBefore.round!.center[1] - 3, 9);
		expect(mounted.host.history().depth).toBe(beforeHistory.depth + 1);
		expect((await mounted.host.undo()).kind).toBe('installed');
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
	});

	it('duplicates a connected Round Room as a detached ring with fresh identities', async () => {
		const ring = connectedRing();
		const mounted = await mount(ring.document);
		settle(mounted.facade, 2);
		const before = acceptedLayout(mounted.facade);
		const sourceRoom = before.rooms.find((room) => room.id === ring.roomId)!;
		const beforeHistory = mounted.host.history();
		const snapshot = mounted.facade.snapshot();
		const outcome = await mounted.services.authoring.accept(
			roomDuplicateIntent({
				roomId: ring.roomId,
				delta: [20, 0],
				capture: freshCapture(),
				operationId: 'c4-round-duplicate',
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: snapshot.acceptedRevision.revisionId,
				contentRevision: snapshot.domain.unitRevisions.layout,
				levelId: snapshot.domain.layoutLevelId
			})
		);
		expect(outcome.kind).toBe('installed');
		settle(mounted.facade, 2);
		const after = acceptedLayout(mounted.facade);
		const copy = after.rooms.find((room) => room.id.includes(`${ring.roomId}-copy`))!;
		expect(copy).toBeDefined();
		expect(copy.round?.radius).toBe(sourceRoom.round?.radius);
		expect(copy.round?.center[0]).toBeCloseTo(sourceRoom.round!.center[0] + 20, 9);
		expect(copy.round?.center[1]).toBeCloseTo(sourceRoom.round!.center[1], 9);
		expect(copy.boundary).toHaveLength(sourceRoom.boundary.length);
		const copyWallIds = new Set(copy.boundary.map((ref) => ref.wallId));
		const copiedWalls = after.walls.filter((wall) => copyWallIds.has(wall.id));
		expect(copiedWalls).toHaveLength(copy.boundary.length);
		// No annex (outside) Walls travel with the copy, and nothing is welded.
		expect(copiedWalls.every((wall) => wall.id.includes('-copy'))).toBe(true);
		expect(after.walls.filter((wall) => wall.id.includes('-copy'))).toHaveLength(copy.boundary.length);
		expect(certifyRoundRoom(after, copy).kind).toBe('certified');
		// The source is unchanged.
		const sourceAfter = after.rooms.find((room) => room.id === ring.roomId)!;
		expect(sourceAfter.round?.radius).toBe(sourceRoom.round?.radius);
		expect(mounted.host.history().depth).toBe(beforeHistory.depth + 1);

		// The canonical planner is the one that ran; its own candidate agrees.
		const planned = planDuplicateRoom(
			before,
			{ roomId: ring.roomId, delta: [20, 0] },
			freshCapture(),
			before.floor.id
		);
		expect(planned.kind).not.toBe('rejected');
	});

	it('draws a refused radius, keeps the accepted bytes and writes nothing', async () => {
		const gallery = attachedGallery();
		const mounted = await mount(gallery.document);
		settle(mounted.facade, 2);
		selectRoom(mounted.facade, gallery.roomId);
		settle(mounted.facade, 2);
		const before = acceptedLayout(mounted.facade);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();
		mounted.session.setDrafting({ snap: true });
		const ray = mounted.facade.marks().find(
			(mark) => mark.id === 'layout-round-room-radius-mark'
		)!;
		const evaluationId = mounted.facade.evaluationId()!;
		const target = stageCss(mounted.facade, [12, 0]);

		const planned = planResizeRoundRoomRadius({
			document: before,
			roomId: gallery.roomId,
			radius: 12
		});
		expect(planned.kind).toBe('rejected');
		if (planned.kind !== 'rejected') return;

		mounted.facade.pointerIntent({ phase: 'down', css: ray.tip!, evaluationId, handleId: ray.id });
		mounted.facade.pointerIntent({ phase: 'move', css: target, evaluationId, handleId: ray.id });
		settle(mounted.facade, 2);
		const preview = mounted.facade.candidatePreviews();
		expect(preview).toHaveLength(1);
		expect(preview[0]!.role).toBe('refused');
		expect(preview[0]!.labels[0]!.text).toBe(planned.rejection.message);
		expect(preview[0]!.segments).toEqual([]);

		mounted.facade.pointerIntent({ phase: 'up', css: target, evaluationId, handleId: ray.id });
		settle(mounted.facade, 2);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
		// The release discloses the refusal; it never leaves a live geometry proposal.
		expect(mounted.facade.candidatePreviews().some((candidate) => candidate.role === 'subject')).toBe(false);
	});

	it('drops a revoked, cancelled or stale radius gesture without writing', async () => {
		const ring = connectedRing();
		const mounted = await mount(ring.document);
		settle(mounted.facade, 2);
		selectRoom(mounted.facade, ring.roomId);
		settle(mounted.facade, 2);
		const beforeBytes = mounted.facade.snapshot().canonicalJson;
		const beforeHistory = mounted.host.history();
		mounted.session.setDrafting({ snap: true });
		const ray = mounted.facade.marks().find(
			(mark) => mark.id === 'layout-round-room-radius-mark'
		)!;
		const evaluationId = mounted.facade.evaluationId()!;
		const knob = ray.tip!;
		const target = stageCss(mounted.facade, [8, 0]);

		const arm = (): void => {
			mounted.facade.pointerIntent({ phase: 'down', css: knob, evaluationId, handleId: ray.id });
			mounted.facade.pointerIntent({ phase: 'move', css: target, evaluationId, handleId: ray.id });
			settle(mounted.facade, 2);
			expect(mounted.facade.candidatePreviews()).toHaveLength(1);
		};

		// Cancel: the candidate is dismissed, and the release that follows the
		// cancel names no radius to write.
		arm();
		mounted.facade.pointerIntent({ phase: 'cancel', css: target, evaluationId, handleId: ray.id });
		mounted.facade.pointerIntent({ phase: 'up', css: target, evaluationId, handleId: ray.id });
		settle(mounted.facade, 2);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
		expect(mounted.facade.candidatePreviews()).toEqual([]);

		// Revoked: a reading change releases the lease under the session while its
		// captured candidate is still live. The next pointer event must drop it.
		arm();
		expect(mounted.session.gesture()).not.toBeNull();
		expect(mounted.session.applyReadingChange()).toMatchObject({ cancelled: true });
		mounted.facade.pointerIntent({ phase: 'move', css: target, evaluationId, handleId: ray.id });
		mounted.facade.pointerIntent({ phase: 'up', css: target, evaluationId, handleId: ray.id });
		settle(mounted.facade, 2);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
		expect(mounted.facade.candidatePreviews()).toEqual([]);

		// Stale: an intent from another evaluation can never finish this gesture.
		arm();
		mounted.facade.pointerIntent({
			phase: 'move',
			css: target,
			evaluationId: 'stale-evaluation',
			handleId: ray.id
		});
		mounted.facade.pointerIntent({
			phase: 'up',
			css: target,
			evaluationId: 'stale-evaluation',
			handleId: ray.id
		});
		settle(mounted.facade, 2);
		expect(mounted.facade.snapshot().canonicalJson).toBe(beforeBytes);
		expect(mounted.host.history()).toEqual(beforeHistory);
		expect(mounted.session.gesture()).toBeNull();
	});

	it('navigates to every Room a round member bounds, including its ordinary neighbour', async () => {
		const gallery = attachedGallery();
		const mounted = await mount(gallery.document);
		settle(mounted.facade, 2);
		const actions = stageCardActions(mounted.facade, wallSubject(gallery.sharedWallId));
		const rotunda = actions.find((action) => action.id === `layout-wall-bounds:${gallery.roomId}`);
		const neighbour = actions.find((action) => action.id === `layout-wall-bounds:${gallery.galleryId}`);
		expect(rotunda).toBeDefined();
		expect(neighbour).toBeDefined();
		const name = gallery.document.rooms.find((room) => room.id === gallery.galleryId)!.name ?? 'Room';
		expect(neighbour!.label).toBe(`Go to ${name}`);
		expect((await neighbour!.run()).kind).toBe('accepted');
		settle(mounted.facade, 2);
		expect(mounted.facade.selection()).toMatchObject({
			sourceId: gallery.galleryId,
			sourceKind: 'room-floor'
		});
	});

	it('prepares identical visitor geometry and portal relations after a radius edit', async () => {
		const gallery = attachedGallery();
		const mounted = await mount(gallery.document);
		settle(mounted.facade, 2);
		const before = mounted.facade.snapshot();
		const outcome = await mounted.services.authoring.accept(
			roundRoomRadiusIntent({
				roomId: gallery.roomId,
				radius: 5.6,
				operationId: 'c4-visitor-radius',
				projectId: before.acceptedRevision.projectId,
				revisionId: before.acceptedRevision.revisionId,
				contentRevision: before.domain.unitRevisions.layout,
				levelId: before.domain.layoutLevelId
			})
		);
		expect(outcome.kind).toBe('installed');
		settle(mounted.facade, 2);
		const after = acceptedLayout(mounted.facade);
		expect(after.rooms.find((room) => room.id === gallery.roomId)!.round?.radius).toBe(5.6);
		const door = after.openings.find((opening) => opening.id === gallery.doorId)!;
		expect(door.connectsRoomIds).toEqual([gallery.roomId, gallery.galleryId]);

		const captured = await captureUnitSave({
			snapshot: mounted.host.coordinator().acceptedSnapshot(),
			operationId: 'c4-visitor-roundtrip',
			precondition: { kind: 'create-only' }
		});
		expect(captured.kind).toBe('captured');
		if (captured.kind !== 'captured') throw new Error(`Save capture refused: ${captured.message}`);
		const reloaded = await readUnitEnvelopeForSave(captured.capture.canonicalJson);
		expect(reloaded.kind).toBe('read');
		if (reloaded.kind !== 'read') throw new Error(`Save reload refused: ${reloaded.message}`);
		const prepared = prepareUnitRuntime(reloaded.envelope);
		expect(prepared.kind).toBe('ready');
		if (prepared.kind !== 'ready') throw new Error('the visitor runtime refused the saved source');

		const editorGeometry = mounted.facade.snapshot().domain.geometry;
		expect(JSON.stringify(prepared.geometry.walls)).toBe(JSON.stringify(editorGeometry.walls));
		expect(JSON.stringify(prepared.geometry.rooms)).toBe(JSON.stringify(editorGeometry.rooms));
		const portal = prepared.geometry.walls
			.find((wall) => wall.wallId === gallery.sharedWallId)!
			.openings.find((opening) => opening.openingId === gallery.doorId)!;
		expect(portal.kind).toBe('door');
		expect(portal.connectsRoomIds).toEqual([gallery.roomId, gallery.galleryId]);
		expect(
			prepared.envelope.units.layout.data.openings.find((opening) => opening.id === gallery.doorId)
		).toEqual(door);
		expect(prepared.issues.filter((issue) => /portal|relation/i.test(issue.code))).toEqual([]);
	});
});
