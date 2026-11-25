import type { LayoutVec2 } from '../geometry/coordinates';
import { pointStrictlyInsidePolygon } from '../geometry/face-extraction';
import { compileWallFirstLayoutGeometry } from '../geometry/compiler';
import { hasBlockingLayoutIssues } from '../geometry/validation';
import { allocateCapturedId, isLayoutIdCapture, LayoutIdCollisionError, type LayoutIdCapture } from '../plan/id-capture';
import { coincidesAsJunction, JUNCTION_COINCIDENCE_EPSILON } from '../wall/junction-identity';
import { createPlanBoxIndex, type PlanBox } from '../world/plan-box-index';
import { orientXZ } from '../geometry/robust-orientation';
import { composeSpaceBoundary, createRoomBoundaryLookup, roomBoundaryPolygon, spaceBoundaryCycleKey, spaceBoundaryPolygonFromEdges } from './reconciliation-boundary';
import { pointOnRing, spaceOutlineSelfIntersects, spaceOutlineSignedArea, spacePairIssue } from './space-outline';
import { wallJunctionComponents } from './topology-components';
import { createWallSamplingDerivation, type WallSamplingDerivation } from '../wall/centerline';
import { resolveWallCurveSplit } from '../wall/curve-algebra';
import { validateWallFirstLayoutDocument } from '../wall/codec';
import { validateWallFirstTopology } from '../topology/wall-first';
import type { LayoutDocumentWallFirst, LayoutWall, LayoutWallFirstRoom } from '../wall/types';
import { planWallSplit } from '../wall/noding';
import { classifyWallIntersection } from '../wall/topology';
import { createAuthoringRoomAllocator } from '../wall/topology-ops';
import type { LayoutSurfaceLineage } from '../plan/surface-reference';

export type SpaceCreationAnchor =
	| { kind: 'junction'; id: string }
	| { kind: 'wall-station'; wallId: string; station: number }
	| { kind: 'corner'; key: string; point: LayoutVec2 };

export type SpaceCreationSpan =
	| { kind: 'wall'; wallId: string; from: SpaceCreationAnchor; to: SpaceCreationAnchor }
	| { kind: 'virtual'; from: SpaceCreationAnchor; to: SpaceCreationAnchor };

export type SpaceCreationCycle = readonly SpaceCreationSpan[];
export type SpaceCreationEvidence = {
	polygon: readonly LayoutVec2[];
	walls: readonly (readonly LayoutVec2[])[];
	virtual: readonly (readonly [LayoutVec2, LayoutVec2])[];
};
type RefusalCode = 'invalid-cycle' | 'degenerate' | 'self-intersection' | 'wall-contact' |
	'wall-side-owned' | 'space_overlap' | 'space_contains_space' | 'invalid-level' |
	'invalid-capture' | 'split' | 'id-collision' | 'invalid-document' | 'topology' | 'compile';
export type SpaceCreationRefusal = {
	kind: 'refused';
	code: RefusalCode;
	message: string;
	subjectIds: readonly string[];
	evidence?: SpaceCreationEvidence;
};
type ScreenedSpace = {
	kind: 'outline';
	cycle: SpaceCreationCycle;
	evidence: SpaceCreationEvidence;
	cycleKey: string;
};
export type SpaceCreationOutline = ScreenedSpace | SpaceCreationRefusal |
	{ kind: 'none' } | { kind: 'ambiguous' | 'indeterminate'; message: string };
const SEARCH_LIMIT = 4096;
const INDETERMINATE = { kind: 'indeterminate', message: "Couldn't find one outline · Draw open side" } as const;
const AMBIGUOUS = { kind: 'ambiguous', message: 'More than one outline · Draw open side' } as const;

function refuse(code: RefusalCode, message: string, subjectIds: readonly string[] = [], evidence?: SpaceCreationEvidence): SpaceCreationRefusal {
	return { kind: 'refused', code, message, subjectIds, ...(evidence === undefined ? {} : { evidence }) };
}

export function spaceCreationAnchorKey(anchor: SpaceCreationAnchor): string {
	switch (anchor.kind) {
		case 'junction': return JSON.stringify(['junction', anchor.id]);
		case 'wall-station': return JSON.stringify(['station', anchor.wallId, anchor.station]);
		case 'corner': return JSON.stringify(['corner', anchor.key]);
	}
}

const junction = (id: string): Extract<SpaceCreationAnchor, { kind: 'junction' }> => ({ kind: 'junction', id });
const reverseSpan = (span: SpaceCreationSpan): SpaceCreationSpan => ({ ...span, from: span.to, to: span.from });

function planBox(points: readonly LayoutVec2[]): PlanBox {
	const box = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
	for (const [x, z] of points) {
		box.minX = Math.min(box.minX, x);
		box.minZ = Math.min(box.minZ, z);
		box.maxX = Math.max(box.maxX, x);
		box.maxZ = Math.max(box.maxZ, z);
	}
	return box;
}

function inBox(box: PlanBox, [x, z]: LayoutVec2): boolean {
	return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
}

export function spaceCreationContains(evidence: SpaceCreationEvidence, point: LayoutVec2): boolean {
	return !pointOnRing(evidence.polygon, point) && pointStrictlyInsidePolygon(evidence.polygon, point);
}

function wallPaths(document: LayoutDocumentWallFirst, lookup: ReturnType<typeof createRoomBoundaryLookup>, sampling: WallSamplingDerivation) {
	return document.walls.flatMap((wall) => {
		const start = lookup.junctionById.get(wall.startJunctionId)?.point;
		const end = lookup.junctionById.get(wall.endJunctionId)?.point;
		const samples = start && end ? sampling.samples(wall, start, end, 'forward') : null;
		if (!samples) return [];
		const points = samples.samples.map((sample) => sample.point);
		return [{ wall, points, box: planBox(points) }];
	});
}

function screening(document: LayoutDocumentWallFirst) {
	const lookup = createRoomBoundaryLookup(document);
	const sampling = createWallSamplingDerivation();
	const paths = wallPaths(document, lookup, sampling);
	const boxes = createPlanBoxIndex(paths.map(({ box }) => box));
	const rooms = document.rooms.flatMap((room) => {
		const polygon = roomBoundaryPolygon(document, room.id, lookup, sampling);
		return polygon ? [{ room, polygon }] : [];
	});
	const roomBoxes = createPlanBoxIndex(rooms.map(({ polygon }) => planBox(polygon)));
	const owners = new Map<string, LayoutWallFirstRoom>();
	for (const { room } of rooms) {
		for (const ref of room.boundary) owners.set(JSON.stringify([ref.wallId, ref.direction]), room);
	}
	return { lookup, paths, boxes, rooms, roomBoxes, owners, sampling, pathsById: new Map(paths.map(({ wall, points }) => [wall.id, points])) };
}
type Screening = ReturnType<typeof screening>;

function inspectCycle(
	document: LayoutDocumentWallFirst,
	room: LayoutWallFirstRoom,
	read: Screening
): { evidence: SpaceCreationEvidence; area: number } | SpaceCreationRefusal {
	const composed = composeSpaceBoundary(document, room, read.lookup);
	if (composed.kind === 'failed') return refuse('invalid-cycle', composed.issue.message);
	const polygon = spaceBoundaryPolygonFromEdges(composed.edges, document, read.lookup, read.sampling);
	if (!polygon) return refuse('degenerate', 'This outline needs at least three points');
	const walls: LayoutVec2[][] = [];
	const virtual: [LayoutVec2, LayoutVec2][] = [];
	for (const edge of composed.edges) {
		if (edge.kind === 'wall') {
			const wall = read.pathsById.get(edge.wallId);
			if (wall) walls.push(edge.direction === 'forward' ? wall : [...wall].reverse());
		} else {
			const start = read.lookup.junctionById.get(edge.startJunctionId)!.point;
			const end = read.lookup.junctionById.get(edge.endJunctionId)!.point;
			virtual.push([start, end]);
		}
	}
	return { evidence: { polygon, walls, virtual }, area: spaceOutlineSignedArea(polygon) };
}

function screenPlacement(
	room: LayoutWallFirstRoom,
	read: Screening,
	evidence: SpaceCreationEvidence
): SpaceCreationRefusal | null {
	if (spaceOutlineSelfIntersects(evidence.polygon)) {
		return refuse('self-intersection', 'This outline crosses itself', [], evidence);
	}
	for (const ref of room.boundary) {
		const owner = read.owners.get(JSON.stringify([ref.wallId, ref.direction]));
		if (owner) return refuse('wall-side-owned', `${owner.name} already uses this Wall side`, [owner.id, ref.wallId], evidence);
	}
	for (const [index, edge] of room.virtualEdges.entries()) {
		const [start, end] = evidence.virtual[index]!;
		if (coincidesAsJunction(start, end)) return refuse('degenerate', 'This open side is too short', [], evidence);
		const box = planBox([start, end]);
		const epsilon = JUNCTION_COINCIDENCE_EPSILON;
		for (const wallIndex of read.boxes.overlaps({
			minX: box.minX - epsilon, minZ: box.minZ - epsilon,
			maxX: box.maxX + epsilon, maxZ: box.maxZ + epsilon
		})) {
			const { wall, points } = read.paths[wallIndex]!;
			for (let i = 1; i < points.length; i += 1) {
				const a = points[i - 1]!;
				const b = points[i]!;
				const result = classifyWallIntersection({ id: 'virtual', start, end }, { id: wall.id, start: a, end: b });
				const endpoints = [
					{ id: i === 1 ? wall.startJunctionId : null, point: a },
					{ id: i === points.length - 1 ? wall.endJunctionId : null, point: b }
				];
				const touches = endpoints.flatMap(({ id, point }) => [
					...(coincidesAsJunction(point, start) ? [id === edge.startJunctionId] : []),
					...(coincidesAsJunction(point, end) ? [id === edge.endJunctionId] : [])
				]);
				if (touches.includes(false) || (result.kind !== 'none' &&
					!(result.kind === 'collinear-endpoint-touch' && touches.includes(true)))) {
					return refuse('wall-contact', 'An open side crosses a Wall', [wall.id], evidence);
				}
			}
		}
	}
	for (const index of read.roomBoxes.overlaps(planBox(evidence.polygon))) {
		const other = read.rooms[index]!;
		const issue = spacePairIssue(evidence.polygon, other.polygon, true, other.room.virtualEdges.length > 0);
		if (issue) return refuse(issue, issue === 'space_overlap' ? `Overlaps ${other.room.name}` :
			`This outline would contain or be contained by ${other.room.name}`, [other.room.id], evidence);
	}
	return null;
}

function roomFromSpans(
	cycle: SpaceCreationCycle,
	endpoint: (anchor: SpaceCreationAnchor) => string,
	fragments: (span: Extract<SpaceCreationSpan, { kind: 'wall' }>) => LayoutWall[] | null,
	id: string,
	name: string
): LayoutWallFirstRoom | SpaceCreationRefusal {
	const firstWall = cycle.findIndex((span) => span.kind === 'wall');
	if (firstWall < 0) return refuse('invalid-cycle', 'Start on a Wall');
	const room: LayoutWallFirstRoom = {
		id, name, overhead: 'open-to-sky', boundary: [], virtualEdges: []
	};
	const used = new Set<string>();
	const ordered = [...cycle.slice(firstWall), ...cycle.slice(0, firstWall)];
	for (const [index, span] of ordered.entries()) {
		const start = endpoint(span.from);
		const end = endpoint(span.to);
		if (start === end || end !== endpoint(ordered[(index + 1) % ordered.length]!.from)) {
			return refuse('invalid-cycle', 'This outline does not connect');
		}
		if (span.kind === 'virtual') {
			room.virtualEdges.push({ startJunctionId: start, endJunctionId: end });
			continue;
		}
		const run = fragments(span);
		if (!run?.length) return refuse('invalid-cycle', 'This span does not follow its Wall', [span.wallId]);
		let cursor = start;
		for (const wall of run) {
			const direction = wall.startJunctionId === cursor ? 'forward' : wall.endJunctionId === cursor ? 'reverse' : null;
			if (direction === null || used.has(wall.id)) return refuse('invalid-cycle', 'This outline repeats or leaves a Wall', [wall.id]);
			room.boundary.push({ wallId: wall.id, direction });
			used.add(wall.id);
			cursor = direction === 'forward' ? wall.endJunctionId : wall.startJunctionId;
		}
		if (cursor !== end) return refuse('invalid-cycle', 'This span does not end on its Wall', [span.wallId]);
	}
	return room.virtualEdges.length ? room : refuse('invalid-cycle', 'Draw an open side');
}

export function spaceCreationAnchorPoint(document: LayoutDocumentWallFirst, anchor: SpaceCreationAnchor): LayoutVec2 | null {
	if (anchor.kind === 'corner') return anchor.point;
	if (anchor.kind === 'junction') return document.junctions.find(({ id }) => id === anchor.id)?.point ?? null;
	const wall = document.walls.find(({ id }) => id === anchor.wallId);
	if (!wall || wall.startJunctionId === wall.endJunctionId || !Number.isFinite(anchor.station)) return null;
	const start = document.junctions.find(({ id }) => id === wall.startJunctionId)?.point;
	const end = document.junctions.find(({ id }) => id === wall.endJunctionId)?.point;
	if (!start || !end) return null;
	if (wall.centerline.kind === 'line') {
		const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
		if (!(anchor.station > 0 && anchor.station < length)) return null;
		const t = anchor.station / length;
		return [start[0] + t * (end[0] - start[0]), start[1] + t * (end[1] - start[1])];
	}
	if (wall.centerline.kind !== 'cubic-chain') return null;
	const split = resolveWallCurveSplit({ startPoint: start, endPoint: end, ...wall.centerline }, anchor.station);
	return split.kind === 'resolved' ? split.result.point : null;
}

function stageCycle(baseline: LayoutDocumentWallFirst, capture: LayoutIdCapture, cycle: SpaceCreationCycle) {
	let document = baseline;
	const createdJunctionIds: string[] = [];
	const createdWallIds: string[] = [];
	const splitWallIds: string[] = [];
	const surfaceLineage: LayoutSurfaceLineage[number][] = [];
	const nodeIds = new Map<string, string>();
	const corners = new Map<string, LayoutVec2>();
	const stations = new Map<string, Map<number, LayoutVec2>>();
	const fragmentIds = new Map<string, string[]>();
	for (const { from, to } of cycle) {
		for (const anchor of [from, to]) {
			const key = spaceCreationAnchorKey(anchor);
			if (anchor.kind === 'corner') {
				const existing = corners.get(key);
				if (existing && (existing[0] !== anchor.point[0] || existing[1] !== anchor.point[1])) {
					return refuse('invalid-cycle', 'A corner has two positions');
				}
				corners.set(key, anchor.point);
			} else if (anchor.kind === 'wall-station') {
				const onWall = stations.get(anchor.wallId) ?? new Map<number, LayoutVec2>();
				if (onWall.has(anchor.station)) continue;
				const point = spaceCreationAnchorPoint(baseline, anchor);
				if (!point) return refuse('split', 'This anchor is outside its Wall', [anchor.wallId]);
				onWall.set(anchor.station, point);
				stations.set(anchor.wallId, onWall);
			} else if (!baseline.junctions.some(({ id }) => id === anchor.id)) {
				return refuse('invalid-cycle', 'This Junction is no longer available', [anchor.id]);
			}
		}
	}
	for (const [index, [key, point]] of [...corners].sort(([a], [b]) => a.localeCompare(b)).entries()) {
		const id = allocateCapturedId(new Set(document.junctions.map((node) => node.id)), `junction.open-space.${index}`, capture);
		document = { ...document, junctions: [...document.junctions, { id, point: [...point] }] };
		nodeIds.set(key, id);
		createdJunctionIds.push(id);
	}
	for (const [wallId, anchors] of [...stations].sort(([a], [b]) => a.localeCompare(b))) {
		const ordered = [...anchors].sort(([a], [b]) => b - a);
		const fragments = [wallId];
		for (const [index, [station, expected]] of ordered.entries()) {
			const seed = `open-space.${wallId}.${index}`;
			const split = planWallSplit(document, wallId, station, {
				nextWallId: (source) => allocateCapturedId(new Set(source.walls.map((wall) => wall.id)), `wall.${seed}`, capture),
				nextJunctionId: (source) => allocateCapturedId(new Set(source.junctions.map((node) => node.id)), `junction.${seed}`, capture)
			});
			if (split.kind === 'rejected') {
				return refuse('split', split.rejection.code === 'split_through_opening_interior' ?
					'The split crosses an Opening' : split.rejection.message, [wallId]);
			}
			const actual = split.document.junctions.find(({ id }) => id === split.junctionId)!.point;
			if (!coincidesAsJunction(expected, actual)) return refuse('split', 'The split would move the Wall anchor', [wallId]);
			document = split.document;
			surfaceLineage.push(...split.surfaceLineage);
			nodeIds.set(spaceCreationAnchorKey({ kind: 'wall-station', wallId, station }), split.junctionId);
			createdJunctionIds.push(split.junctionId);
			createdWallIds.push(...split.createdWallIds);
			fragments.splice(1, 0, ...split.createdWallIds);
		}
		splitWallIds.push(wallId);
		fragmentIds.set(wallId, fragments);
	}
	const read = screening(document);
	const endpoint = (anchor: SpaceCreationAnchor) => anchor.kind === 'junction' ? anchor.id : nodeIds.get(spaceCreationAnchorKey(anchor))!;
	function fragments(span: Extract<SpaceCreationSpan, { kind: 'wall' }>) {
		const ids = fragmentIds.get(span.wallId) ?? [span.wallId];
		const run = ids.map((id) => read.lookup.wallById.get(id));
		if (run.some((wall) => !wall)) return null;
		const walls = run as LayoutWall[];
		const vertices = [walls[0]!.startJunctionId, ...walls.map((wall) => wall.endJunctionId)];
		const from = vertices.indexOf(endpoint(span.from));
		const to = vertices.indexOf(endpoint(span.to));
		if (from < 0 || to < 0) return null;
		const between = walls.slice(Math.min(from, to), Math.max(from, to));
		return from < to ? between : between.reverse();
	}
	const roomId = allocateCapturedId(new Set(document.rooms.map(({ id }) => id)), 'room.open-space', capture);
	const name = createAuthoringRoomAllocator(capture, 'Open Space').nextRoomName(document.rooms.map(({ name }) => name));
	let room = roomFromSpans(cycle, endpoint, fragments, roomId, name);
	if ('kind' in room) return room;
	let outline = inspectCycle(document, room, read);
	if ('kind' in outline) return outline;
	if (outline.area < 0) {
		room = roomFromSpans([...cycle].reverse().map(reverseSpan), endpoint, fragments, roomId, name);
		if ('kind' in room) return room;
		outline = inspectCycle(document, room, read);
		if ('kind' in outline) return outline;
	}
	const placement = screenPlacement(room, read, outline.evidence);
	if (placement) return placement;
	if (!(outline.area > 0)) return refuse('degenerate', 'This outline has no area');
	return {
		kind: 'staged' as const, document: { ...document, rooms: [...document.rooms, room] },
		roomId, createdJunctionIds, createdWallIds, splitWallIds, surfaceLineage, evidence: outline.evidence,
		cycleKey: spaceBoundaryCycleKey(document, room, read.lookup)!
	};
}

export function planCreateOpenSpace(input: {
	baseline: LayoutDocumentWallFirst; levelId: string; capture: LayoutIdCapture; cycle: SpaceCreationCycle;
}) {
	const { baseline, levelId, capture, cycle } = input;
	if (levelId !== baseline.floor.id) return refuse('invalid-level', 'The working floor changed');
	if (!isLayoutIdCapture(capture)) return refuse('invalid-capture', 'The outline is missing its identity capture');
	if (!isSpaceCreationCycle(cycle)) return refuse('invalid-cycle', 'The outline is invalid');
	try {
		const staged = stageCycle(baseline, capture, cycle);
		if (staged.kind === 'refused') return staged;
		const structural = validateWallFirstLayoutDocument(staged.document);
		if (!structural.success) return refuse('invalid-document', structural.issues[0]!.message, [], staged.evidence);
		if (staged.createdJunctionIds.length > 0) {
			const issue = validateWallFirstTopology(structural.document);
			if (issue) return refuse('topology', issue.message, [], staged.evidence);
		}
		const compiled = compileWallFirstLayoutGeometry(structural.document);
		if (hasBlockingLayoutIssues(compiled.issues)) {
			return refuse('compile', compiled.issues.find((issue) => issue.severity !== 'warning')!.message, [], staged.evidence);
		}
		return { ...staged, kind: 'planned' as const, document: structural.document, compiled };
	} catch (error) {
		if (error instanceof LayoutIdCollisionError) return refuse('id-collision', error.message, [error.id]);
		throw error;
	}
}

export type PlannedSpaceCreation = Extract<ReturnType<typeof planCreateOpenSpace>, { kind: 'planned' }>;

function shape(value: unknown, ...keys: string[]): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && Object.keys(value).length === keys.length &&
		keys.every((key) => Object.hasOwn(value, key));
}
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function isAnchor(value: unknown): value is SpaceCreationAnchor {
	if (shape(value, 'kind', 'id')) return value.kind === 'junction' && id(value.id);
	if (shape(value, 'kind', 'wallId', 'station')) return value.kind === 'wall-station' && id(value.wallId) && finite(value.station) && value.station > 0;
	return shape(value, 'kind', 'key', 'point') && value.kind === 'corner' && id(value.key) &&
		Array.isArray(value.point) && value.point.length === 2 && finite(value.point[0]) && finite(value.point[1]);
}

export function isSpaceCreationCycle(value: unknown): value is SpaceCreationCycle {
	return Array.isArray(value) && value.length >= 2 && Array.from(value).every((span) =>
		((shape(span, 'kind', 'from', 'to') && span.kind === 'virtual') ||
			(shape(span, 'kind', 'wallId', 'from', 'to') && span.kind === 'wall' && id(span.wallId))) &&
		isAnchor(span.from) && isAnchor(span.to)
	);
}

type WallSpan = Extract<SpaceCreationSpan, { kind: 'wall' }>;
type Graph = Map<string, WallSpan[]>;
function wallGraph(document: LayoutDocumentWallFirst, anchors: readonly SpaceCreationAnchor[] = []): Graph {
	const graph: Graph = new Map();
	const byWall = new Map<string, Extract<SpaceCreationAnchor, { kind: 'wall-station' }>[]>();
	for (const anchor of anchors) {
		if (anchor.kind !== 'wall-station') continue;
		const stations = byWall.get(anchor.wallId) ?? [];
		if (!stations.some(({ station }) => station === anchor.station)) stations.push(anchor);
		byWall.set(anchor.wallId, stations);
	}
	for (const wall of [...document.walls].sort((a, b) => a.id.localeCompare(b.id))) {
		const vertices = [
			junction(wall.startJunctionId),
			...(byWall.get(wall.id) ?? []).sort((a, b) => a.station - b.station),
			junction(wall.endJunctionId)
		];
		for (let i = 1; i < vertices.length; i += 1) {
			const from = vertices[i - 1]!;
			const to = vertices[i]!;
			const span = { kind: 'wall' as const, wallId: wall.id, from, to };
			for (const edge of [span, { ...span, from: to, to: from }]) {
				const key = spaceCreationAnchorKey(edge.from);
				const incident = graph.get(key) ?? [];
				incident.push(edge);
				graph.set(key, incident);
			}
		}
	}
	return graph;
}

/** Each yield counts one attempted continuation, including rejected branches. */
function* walk(graph: Graph, start: SpaceCreationAnchor, end: SpaceCreationAnchor, reserved = new Set<string>()): Generator<WallSpan[] | null> {
	const startKey = spaceCreationAnchorKey(start);
	const endKey = spaceCreationAnchorKey(end);
	const visited = new Set([...reserved, startKey]);
	const path: WallSpan[] = [];
	const stack = [{ key: startKey, next: 0, incident: graph.get(startKey) ?? [] }];
	while (stack.length > 0) {
		const frame = stack.at(-1)!;
		const edge = frame.incident[frame.next++];
		if (!edge) {
			visited.delete(frame.key);
			stack.pop();
			path.pop();
			continue;
		}
		const key = spaceCreationAnchorKey(edge.to);
		if (key === endKey && key !== startKey) {
			yield [...path, edge];
		} else {
			yield null;
			if (visited.has(key)) continue;
			visited.add(key);
			path.push(edge);
			stack.push({ key, next: 0, incident: graph.get(key) ?? [] });
		}
	}
}

function capForRun(run: WallSpan[], read: Screening): SpaceCreationCycle {
	const first = run[0]!;
	const last = run.at(-1)!;
	const start = first.from;
	const end = last.to;
	const straight = { kind: 'virtual' as const, from: end, to: start };
	if (read.lookup.wallById.get(first.wallId)?.centerline.kind !== 'line' ||
		read.lookup.wallById.get(last.wallId)?.centerline.kind !== 'line') return [...run, straight];
	const point = (anchor: SpaceCreationAnchor) =>
		anchor.kind === 'junction' ? read.lookup.junctionById.get(anchor.id)?.point : undefined;
	const a = point(start);
	const b = point(end);
	const innerA = point(first.to);
	const innerB = point(last.from);
	if (!a || !b || !innerA || !innerB) return [...run, straight];
	const axis: LayoutVec2 = [a[0] - innerA[0], a[1] - innerA[1]];
	const other: LayoutVec2 = [b[0] - innerB[0], b[1] - innerB[1]];
	if (orientXZ([0, 0], axis, other) !== 0 || axis[0] * other[0] + axis[1] * other[1] <= 0) return [...run, straight];
	const length = Math.hypot(...axis);
	const unit: LayoutVec2 = [axis[0] / length, axis[1] / length];
	const advance = (a[0] - b[0]) * unit[0] + (a[1] - b[1]) * unit[1];
	if (Math.abs(advance) <= JUNCTION_COINCIDENCE_EPSILON) return [...run, straight];
	const near = advance > 0 ? b : a;
	const corner: SpaceCreationAnchor = {
		kind: 'corner', key: 'cap-corner',
		point: [near[0] + Math.abs(advance) * unit[0], near[1] + Math.abs(advance) * unit[1]]
	};
	return [...run, { kind: 'virtual', from: end, to: corner }, { kind: 'virtual', from: corner, to: start }];
}

function screenAuto(baseline: LayoutDocumentWallFirst, run: WallSpan[], source: Screening) {
	let cycle = capForRun(run, source);
	const corner = cycle.find((span) => span.from.kind === 'corner')?.from;
	let cornerId = 'room-tool.cap-corner';
	let read = source;
	if (corner?.kind === 'corner') {
		const nodes = new Map(run.flatMap(({ from, to }) => [from, to]).flatMap((anchor) => {
			const node = anchor.kind === 'junction' && source.lookup.junctionById.get(anchor.id);
			return node ? [[node.id, node] as const] : [];
		}));
		while (nodes.has(cornerId)) cornerId += '.corner';
		nodes.set(cornerId, { id: cornerId, point: corner.point });
		read = { ...source, lookup: { ...source.lookup, junctionById: nodes } };
	}
	const endpoint = (anchor: SpaceCreationAnchor) => anchor.kind === 'junction' ? anchor.id : cornerId;
	const fragments = ({ wallId }: WallSpan) => [read.lookup.wallById.get(wallId)!];
	let room = roomFromSpans(cycle, endpoint, fragments, '', '');
	if ('kind' in room) return room;
	let outline = inspectCycle(baseline, room, read);
	if ('kind' in outline) return outline;
	if (outline.area < 0) {
		cycle = [...cycle].reverse().map(reverseSpan);
		room = roomFromSpans(cycle, endpoint, fragments, '', '');
		if ('kind' in room) return room;
		outline = inspectCycle(baseline, room, read);
		if ('kind' in outline) return outline;
	}
	if (outline.area === 0 && !spaceOutlineSelfIntersects(outline.evidence.polygon)) {
		return refuse('degenerate', 'This outline has no area');
	}
	const rejected = screenPlacement(room, read, outline.evidence);
	return rejected ?? {
		kind: 'outline' as const, cycle, evidence: outline.evidence,
		cycleKey: spaceBoundaryCycleKey(baseline, room, read.lookup)!
	};
}

type WalkResult = { outcome: ScreenedSpace | SpaceCreationRefusal; bounds?: PlanBox } | null;

function* componentWalk(graph: Graph, tips: SpaceCreationAnchor[], screen: (run: WallSpan[]) => ScreenedSpace | SpaceCreationRefusal): Generator<WalkResult> {
	for (let i = 0; i < tips.length; i += 1) {
		for (let j = i + 1; j < tips.length; j += 1) {
			yield null; // Visiting the pair costs work even if it has no path.
			for (const run of walk(graph, tips[i]!, tips[j]!)) {
				if (!run) {
					yield null;
					continue;
				}
				const outcome = screen(run);
				yield { outcome, ...(outcome.evidence ? { bounds: planBox(outcome.evidence.polygon) } : {}) };
			}
		}
	}
}

function createOutlineQuery(baseline: LayoutDocumentWallFirst) {
	const graph = wallGraph(baseline);
	const read = screening(baseline);
	const wallBounds = new Map(read.paths.map(({ wall, box }) => [wall.id, box]));
	const components = wallJunctionComponents(baseline).sort((a, b) => a.key.localeCompare(b.key)).flatMap((component) => {
		const tips = [...component.junctionIds].sort().map(junction).filter((anchor) =>
			graph.get(spaceCreationAnchorKey(anchor))?.length === 1
		);
		if (tips.length < 2) return [];
		const points: LayoutVec2[] = [];
		for (const wallId of component.wallIds) {
			const box = wallBounds.get(wallId);
			if (box) points.push([box.minX, box.minZ], [box.maxX, box.maxZ]);
		}
		const bounds = planBox(points);
		const d = Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
		const region = { minX: bounds.minX - d, minZ: bounds.minZ - d, maxX: bounds.maxX + d, maxZ: bounds.maxZ + d };
		return [{
			bounds, region,
			walk: componentWalk(graph, tips, (run) => screenAuto(baseline, run, read)),
			cache: [] as WalkResult[]
		}];
	});
	return (point: LayoutVec2): SpaceCreationOutline => {
		let work = 0;
		const viable = new Map<string, ScreenedSpace>();
		const rejected = new Set<SpaceCreationRefusal>();
		let relevant = false;
		for (const component of components) {
			if (!inBox(component.region, point)) continue;
			relevant ||= inBox(component.bounds, point);
			for (let i = 0; ; i += 1) {
				if (work === SEARCH_LIMIT) return relevant || viable.size || rejected.size ? INDETERMINATE : { kind: 'none' };
				if (i === component.cache.length) {
					const next = component.walk.next();
					if (next.done) break;
					component.cache.push(next.value);
				}
				work += 1;
				const entry = component.cache[i];
				if (!entry?.bounds || !inBox(entry.bounds, point) || !spaceCreationContains(entry.outcome.evidence!, point)) continue;
				if (entry.outcome.kind === 'outline') {
					viable.set(entry.outcome.cycleKey, entry.outcome);
					if (viable.size === 2) return AMBIGUOUS;
				} else rejected.add(entry.outcome);
			}
		}
		return viable.values().next().value ?? (rejected.size === 1 ? rejected.values().next().value! :
			rejected.size > 1 ? refuse('invalid-cycle', "Couldn't find one outline · Draw open side") : { kind: 'none' });
	};
}

/** One binding's lazy reading of one accepted source. Cached work counts on every lookup. */
export function createSpaceCreationOutlineQuery(baseline: LayoutDocumentWallFirst, levelId: string) {
	let query: ReturnType<typeof createOutlineQuery> | undefined;
	return (point: LayoutVec2): SpaceCreationOutline => {
		if (levelId !== baseline.floor.id || !point.every(Number.isFinite)) return { kind: 'none' };
		query ??= createOutlineQuery(baseline);
		return query(point);
	};
}

export function findSpaceCreationOutline(baseline: LayoutDocumentWallFirst, levelId: string, point: LayoutVec2): SpaceCreationOutline {
	return createSpaceCreationOutlineQuery(baseline, levelId)(point);
}

export function spaceCreationWallChoices(
	baseline: LayoutDocumentWallFirst, from: SpaceCreationAnchor, draft: SpaceCreationCycle,
	start: SpaceCreationAnchor
): readonly WallSpan[] {
	const graph = wallGraph(baseline, [from, start, ...draft.flatMap(({ from, to }) => [from, to])]);
	const visited = new Set(draft.slice(1).map(({ from }) => spaceCreationAnchorKey(from)));
	return (graph.get(spaceCreationAnchorKey(from)) ?? []).filter(({ to }) =>
		spaceCreationAnchorKey(to) !== spaceCreationAnchorKey(from) && !visited.has(spaceCreationAnchorKey(to))
	);
}

/** Try completing the stated draft with a physical return path. */
export function findSpaceCreationReturn(
	baseline: LayoutDocumentWallFirst, capture: LayoutIdCapture, draft: SpaceCreationCycle
): (ScreenedSpace & { plan: PlannedSpaceCreation }) | Exclude<SpaceCreationOutline, ScreenedSpace> {
	const start = draft[0]?.from;
	const end = draft.at(-1)?.to;
	if (!start || !end || end.kind === 'corner') return { kind: 'none' };
	const anchors = draft.map(({ from }) => from);
	const closed = spaceCreationAnchorKey(start) === spaceCreationAnchorKey(end);
	const graph = wallGraph(baseline, [...anchors, end]);
	const returns = closed ? [[]] : walk(graph, end, start, new Set(anchors.slice(1).map(spaceCreationAnchorKey)));
	let work = 0;
	let viable: (ScreenedSpace & { plan: PlannedSpaceCreation }) | null = null;
	let rejected: SpaceCreationRefusal | null = null;
	let rejectionCount = 0;
	for (const path of returns) {
		if (++work > SEARCH_LIMIT) return INDETERMINATE;
		if (!path) continue;
		const cycle = [...draft, ...path];
		if (!isSpaceCreationCycle(cycle)) continue;
		const result = planCreateOpenSpace({ baseline, capture, cycle, levelId: baseline.floor.id });
		if (result.kind === 'refused') {
			rejectionCount += 1;
			rejected = result;
			continue;
		}
		if (viable && viable.cycleKey !== result.cycleKey) return AMBIGUOUS;
		viable = { kind: 'outline', cycle, evidence: result.evidence, cycleKey: result.cycleKey, plan: result };
	}
	return viable ?? (rejectionCount === 1 ? rejected! : { kind: 'none' });
}
