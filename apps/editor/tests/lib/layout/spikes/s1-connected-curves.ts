/** S1 fixture operations. The Round fact and operation staging live only here. */
import {
	buildClosedWallCircleCenterline,
	buildCorrespondenceComponents,
	compileWallFirstLayoutGeometry,
	createAuthoringRoomAllocator,
	createEmptyWallFirstLayoutDocument,
	extractBoundaryCandidateFaces,
	hasBlockingLayoutIssues,
	interiorWitness,
	mintLayoutIdCapture,
	planCreateCircularRoom,
	planDeleteWall,
	planWallChain,
	planWallSplit,
	reconcileRooms,
	resolveWallCurveSplit,
	roomBoundaryPolygon,
	validateWallFirstLayoutDocument,
	validateWallFirstOpeningSet,
	validateWallFirstPortalRelations,
	validateWallFirstTopology,
	wallCenterlineCubics,
	wallCubicChain,
	type LayoutDocumentWallFirst as Layout,
	type LayoutVec2,
	type LayoutWall,
	type OrientedWallRef
} from '@portfolio/layout-core';

export type Round = { center: LayoutVec2; radius: number };
export type State = { layout: Layout; roundByRoom: Record<string, Round> };
export const center: LayoutVec2 = [0, 0];
export const radius = 5;
export const capture = (step: string) => mintLayoutIdCapture(() => `s1-fixture-${step}`);
export const nodingIds = (step: string) => ({
	nextWallId: () => `s1-arc-${step}`,
	nextJunctionId: () => `s1-rim-${step}`
});

type Verdict = { kind: 'success' } | { kind: 'rejected'; rejection: unknown };

export function accepted<T extends Verdict>(result: T): Extract<T, { kind: 'success' }>;
export function accepted(result: Verdict) {
	if (result.kind === 'rejected') throw new Error(JSON.stringify(result.rejection));
	return result;
}

export function circle() {
	const layout = createEmptyWallFirstLayoutDocument();
	const created = accepted(planCreateCircularRoom({
		baseline: layout, center, rim: [radius, 0], capture: capture('circle'), levelId: layout.floor.id,
		roomNamePrefix: 'Rotunda'
	}));
	const roomId = created.createdRoomIds[0]!;
	const state: State = { layout: created.document, roundByRoom: { [roomId]: { center, radius } } };
	return { state, roomId, seamId: created.junctionId, wallId: created.wallId };
}

export function point(layout: Layout, junctionId: string): LayoutVec2 {
	return layout.junctions.find((junction) => junction.id === junctionId)!.point;
}

export function wall(layout: Layout, wallId: string): LayoutWall {
	return layout.walls.find((entry) => entry.id === wallId)!;
}

export function boundary(layout: Layout, roomId: string): readonly OrientedWallRef[] {
	return layout.rooms.find((room) => room.id === roomId)!.boundary;
}

export function cubics(layout: Layout, wallId: string, direction: OrientedWallRef['direction'] = 'forward') {
	const entry = wall(layout, wallId);
	return wallCenterlineCubics(
		entry.centerline, point(layout, entry.startJunctionId), point(layout, entry.endJunctionId), direction
	);
}

export function radialScale(point: LayoutVec2, center: LayoutVec2, ratio: number): LayoutVec2 {
	return [center[0] + (point[0] - center[0]) * ratio, center[1] + (point[1] - center[1]) * ratio];
}

// Exercise existing gates independently of how the fixture staged the candidate.
export function gate(layout: Layout) {
	const validated = validateWallFirstLayoutDocument(layout);
	if (!validated.success) return { kind: 'rejected' as const, rejection: validated.issues };
	const openings = validateWallFirstOpeningSet(validated.document);
	if (openings.length) return { kind: 'rejected' as const, rejection: openings };
	const topology = validateWallFirstTopology(validated.document);
	if (topology) return { kind: 'rejected' as const, rejection: [topology] };
	const portals = validateWallFirstPortalRelations(validated.document);
	if (portals.length) return { kind: 'rejected' as const, rejection: portals };
	const compiled = compileWallFirstLayoutGeometry(validated.document);
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return { kind: 'rejected' as const, rejection: compiled.issues };
	}
	return { kind: 'success' as const, document: validated.document, geometry: compiled.geometry };
}

export function reconcileFixture(baseline: Layout, candidateDocument: Layout) {
	const extraction = extractBoundaryCandidateFaces(candidateDocument);
	const predecessorPolygons = new Map(baseline.rooms.map((room) => [
		room.id, roomBoundaryPolygon(baseline, room.id)!
	]));
	const predecessorWitnesses = new Map([...predecessorPolygons].map(([id, polygon]) => [
		id, interiorWitness(polygon)
	]));
	const components = buildCorrespondenceComponents({
		faces: extraction.faces, predecessorRoomIds: baseline.rooms.map((room) => room.id),
		predecessorWitnesses, predecessorPolygons, candidateDocument, baselineRooms: baseline.rooms
	});
	const result = reconcileRooms({
		baseline, candidateDocument, extraction, components, predecessorWitnesses, predecessorPolygons,
		allocator: createAuthoringRoomAllocator(capture('reconcile'))
	});
	if ('rejection' in result) throw new Error(JSON.stringify(result.rejection));
	return result;
}

export function splitAt(layout: Layout, wallId: string, distance: number) {
	const source = wall(layout, wallId);
	if (source.centerline.kind !== 'cubic-chain') throw new Error('Expected a curved Wall');
	const resolved = resolveWallCurveSplit({
		startPoint: point(layout, source.startJunctionId), endPoint: point(layout, source.endJunctionId),
		knots: source.centerline.knots, spans: source.centerline.spans
	}, distance);
	if (resolved.kind !== 'resolved') throw new Error(JSON.stringify(resolved));
	return resolved.result;
}

/** Only the first split needs fixture staging. Keep the seam as a degree-two Junction
 * and one old Wall ID as the production reconciliation anchor. No prewritten Room. */
export function stageFirstSplit(layout: Layout, wallId: string, distance: number) {
	const ids = nodingIds('1');
	const first = wall(layout, wallId);
	const split = splitAt(layout, wallId, distance);
	const junctionId = ids.nextJunctionId();
	const nextWallId = ids.nextWallId();
	const candidate: Layout = {
		...layout,
		junctions: [...layout.junctions, { id: junctionId, point: split.point }],
		walls: [
			{ ...first, endJunctionId: junctionId, centerline: wallCubicChain(split.fragments.a.knots, split.fragments.a.spans) },
			{ ...first, id: nextWallId, startJunctionId: junctionId, centerline: wallCubicChain(split.fragments.b.knots, split.fragments.b.spans) }
		]
	};
	return { candidate, junctionId, nextWallId };
}

export const attachmentDistances = [1.25, 5.1, 6.2, 7.9] as const;

/** The open-arc splits and the incoming Wall chain use shipped planners. The
 * second attachment closes an adjoining Room sharing one arc with the rotunda. */
export function attach(state: State, hostId: string, index: number) {
	const before = state.layout;
	const distance = attachmentDistances[index]!;
	const step = String(index + 1);
	const ids = nodingIds(step);
	let staged: Layout;
	if (index === 0) {
		const first = stageFirstSplit(before, hostId, distance);
		staged = accepted(gate(reconcileFixture(before, first.candidate).document)).document;
	} else {
		staged = accepted(planWallSplit(before, hostId, distance, ids)).document;
	}
	const junctionId = ids.nextJunctionId();
	const rim = point(staged, junctionId);
	const outer = radialScale(rim, center, 1.6);
	const firstTip = before.walls.find((entry) => entry.startJunctionId === nodingIds('1').nextJunctionId()
		&& entry.centerline.kind === 'line')?.endJunctionId;
	const points = index === 1 ? [point(staged, firstTip!), outer, rim] : [rim, outer];
	const endpointJunctionSnaps = index === 1
		? [{ pointIndex: 0, junctionId: firstTip! }, { pointIndex: 2, junctionId }]
		: [{ pointIndex: 0, junctionId }];
	const { document: layout } = accepted(planWallChain({
		baseline: staged, points, endpointJunctionSnaps,
		close: false, capture: capture(`attach-${step}`), levelId: staged.floor.id
	}));
	return { state: { ...state, layout }, nextWallId: ids.nextWallId(), junctionId };
}

export function stripAnnex(layout: Layout, roomId: string): Layout {
	const ring = new Set(boundary(layout, roomId).map((ref) => ref.wallId));
	const outside = layout.walls.filter((entry) => !ring.has(entry.id));
	return outside.reduce((current, entry, index) => accepted(
		planDeleteWall(current, entry.id, capture(`detach-${index}`), current.floor.id)
	).document, layout);
}

/** Fixture repack after the production Wall deletions. The fixture has uniform
 * Walls and its one Opening is already on the seam fragment, with the same
 * origin. General join/Opening lineage is outside this staging case. */
export function repackCircle(layout: Layout, round: Round, seamWallId: string): Layout {
	const source = wall(layout, seamWallId);
	const { centerline } = accepted(buildClosedWallCircleCenterline({
		center: round.center, rim: point(layout, source.startJunctionId), wallId: source.id
	}));
	const candidate = {
		...layout,
		junctions: layout.junctions.filter((junction) => junction.id === source.startJunctionId),
		walls: [{ ...source, endJunctionId: source.startJunctionId, centerline }]
	};
	return accepted(gate(reconcileFixture(layout, candidate).document)).document;
}

/** One immutable similarity transform around the stated centre. Shared Junction
 * IDs carry the moved endpoints into the straight neighbours automatically. */
export function resize(state: State, roomId: string, radius: number) {
	const { layout } = state;
	const round = state.roundByRoom[roomId]!;
	const ratio = radius / round.radius;
	const scale = (point: LayoutVec2) => radialScale(point, round.center, ratio);
	const ring = new Set(boundary(layout, roomId).map((ref) => ref.wallId));
	const rim = new Set(layout.walls.filter((entry) => ring.has(entry.id))
		.flatMap((entry) => [entry.startJunctionId, entry.endJunctionId]));
	const candidate: Layout = {
		...layout,
		junctions: layout.junctions.map((junction) => rim.has(junction.id)
			? { ...junction, point: scale(junction.point) } : junction),
		walls: layout.walls.map((entry) => {
			if (!ring.has(entry.id) || entry.centerline.kind !== 'cubic-chain') return entry;
			return {
				...entry,
				centerline: wallCubicChain(
					entry.centerline.knots.map((knot) => ({ ...knot, point: scale(knot.point) })),
					entry.centerline.spans.map((span) => ({
						handleOut: scale(span.handleOut), handleIn: scale(span.handleIn)
					}))
				)
			};
		}),
		openings: layout.openings.map((entry) => ring.has(entry.wallId)
			? { ...entry, offset: entry.offset * ratio } : entry)
	};
	const verdict = gate(candidate);
	if (verdict.kind === 'rejected') return verdict;
	return {
		kind: 'success' as const,
		state: { layout: verdict.document, roundByRoom: { ...state.roundByRoom, [roomId]: { ...round, radius } } }
	};
}

export function clearRound(state: State, roomId: string): State {
	const roundByRoom = { ...state.roundByRoom };
	delete roundByRoom[roomId];
	return { ...state, roundByRoom };
}

export type InsideRef = { roomId: string; role: 'inside' };

/** Fixture reference only. Resolve against the current compiled physical Walls
 * and the Room's oriented boundary, including the inside face of shared Walls. */
export function resolveInside(state: State, ref: InsideRef) {
	if (!state.roundByRoom[ref.roomId]) return [];
	const { geometry } = accepted(gate(state.layout));
	return boundary(state.layout, ref.roomId).map(({ wallId, direction }) => {
		const physical = geometry.walls.find((entry) => entry.wallId === wallId);
		if (!physical) throw new Error(`No compiled physical Wall for ${wallId}`);
		return { wallId, side: direction === 'forward' ? 'left' : 'right', physical } as const;
	});
}
