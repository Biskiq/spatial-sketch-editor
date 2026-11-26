/**
 * `layout-space-open-side.ts` — the read-only reading of a Space's stated open
 * sides, in the one mixed boundary order.
 *
 * A virtual edge is a handle of its Space, never a subject: it has no id, no
 * coordinates and no Card. This module therefore exposes frames keyed by the
 * Space and the edge's Junction pair, and it never writes. The composer owns
 * order; the frame only reads it.
 *
 * The two adjoining Walls are the ones a handle may slide along:
 *
 * ```text
 *   previous Wall ──▶ virtual edge ──▶ next Wall
 *   (oriented end)      start → end      (oriented start)
 * ```
 *
 * Only the edge's **start** touches the previous Wall and only its **end**
 * touches the next Wall. A virtual edge whose neighbour is another virtual edge
 * has no Wall at that end, so that end has no slide handle.
 */
import type { LayoutVec2 } from '../geometry/coordinates';
import { composeSpaceBoundary, type SpaceBoundaryEdge } from './reconciliation-boundary';
import type { LayoutDocumentWallFirst } from '../wall/types';

/** One boundary Wall at an open side's end, in this Space's traversal. */
export type SpaceOpenSideEndWall = {
	readonly wallId: string;
	readonly direction: 'forward' | 'reverse';
	/** The Wall's start/end as this Space traverses it. */
	readonly orientedStartJunctionId: string;
	readonly orientedEndJunctionId: string;
};

/** One stated open side as a handle frame. Never authored, never persisted. */
export type SpaceOpenSideFrame = {
	readonly roomId: string;
	readonly roomName: string;
	/** Position in the composed cycle, stable for one document. */
	readonly edgeIndex: number;
	readonly startJunctionId: string;
	readonly endJunctionId: string;
	readonly start: LayoutVec2;
	readonly end: LayoutVec2;
	readonly midpoint: LayoutVec2;
	/** Unit start → end direction. */
	readonly direction: LayoutVec2;
	/** Unit perpendicular, `[-dz, dx]`; positive offset is this side. */
	readonly normal: LayoutVec2;
	readonly length: number;
	/** The Wall ending at the edge's start, or null for a virtual run. */
	readonly startWall: SpaceOpenSideEndWall | null;
	/** The Wall starting at the edge's end, or null for a virtual run. */
	readonly endWall: SpaceOpenSideEndWall | null;
};

function wallEnd(edge: Extract<SpaceBoundaryEdge, { kind: 'wall' }>): SpaceOpenSideEndWall {
	return {
		wallId: edge.wallId,
		direction: edge.direction,
		orientedStartJunctionId: edge.startJunctionId,
		orientedEndJunctionId: edge.endJunctionId,
	};
}

function samePair(
	first: { readonly startJunctionId: string; readonly endJunctionId: string },
	second: { readonly startJunctionId: string; readonly endJunctionId: string },
): boolean {
	return (
		first.startJunctionId === second.startJunctionId && first.endJunctionId === second.endJunctionId
	);
}

/**
 * Every composed open side of one Space, in composer order.
 *
 * A Space that cannot compose contributes no frames: the codec and compiler
 * already report that boundary failure with its own code, and a handle on an
 * unresolvable outline would be an affordance that lies.
 */
export function spaceOpenSideFrames(
	document: LayoutDocumentWallFirst,
	roomId: string,
): readonly SpaceOpenSideFrame[] {
	const room = document.rooms.find((candidate) => candidate.id === roomId);
	if (room === undefined || room.virtualEdges.length === 0) return [];
	const composed = composeSpaceBoundary(document, room);
	if (composed.kind === 'failed') return [];
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const frames: SpaceOpenSideFrame[] = [];
	const count = composed.edges.length;
	for (let index = 0; index < count; index += 1) {
		const edge = composed.edges[index]!;
		if (edge.kind !== 'virtual') continue;
		const start = junctionById.get(edge.startJunctionId)?.point;
		const end = junctionById.get(edge.endJunctionId)?.point;
		if (start === undefined || end === undefined) continue;
		const dx = end[0] - start[0];
		const dz = end[1] - start[1];
		const length = Math.hypot(dx, dz);
		if (!(length > 0)) continue;
		const previous = composed.edges[(index - 1 + count) % count]!;
		const next = composed.edges[(index + 1) % count]!;
		frames.push({
			roomId: room.id,
			roomName: room.name,
			edgeIndex: index,
			startJunctionId: edge.startJunctionId,
			endJunctionId: edge.endJunctionId,
			start: [start[0], start[1]],
			end: [end[0], end[1]],
			midpoint: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
			direction: [dx / length, dz / length],
			normal: [-dz / length, dx / length],
			length,
			startWall: previous.kind === 'wall' ? wallEnd(previous) : null,
			endWall: next.kind === 'wall' ? wallEnd(next) : null,
		});
	}
	return frames;
}

/** One open side addressed by its own Junction pair, or `null`. */
export function spaceOpenSideFrame(
	document: LayoutDocumentWallFirst,
	roomId: string,
	startJunctionId: string,
	endJunctionId: string,
): SpaceOpenSideFrame | null {
	return (
		spaceOpenSideFrames(document, roomId).find((frame) =>
			samePair(frame, { startJunctionId, endJunctionId }),
		) ?? null
	);
}

/**
 * The **attempted** document for one perpendicular offset, without validation.
 *
 * It moves only the edge's two end Junctions. The adjoining Walls reshape
 * because they share those Junctions; nothing is invented and no id is
 * allocated. This is preview evidence, not an acceptance path: every writer
 * still goes through the retained planner and its canonical gates.
 */
export function proposeSpaceOpenSideOffset(
	document: LayoutDocumentWallFirst,
	frame: SpaceOpenSideFrame,
	offset: number,
): LayoutDocumentWallFirst {
	if (!Number.isFinite(offset) || offset === 0) return document;
	const dx = frame.normal[0] * offset;
	const dz = frame.normal[1] * offset;
	const moved = new Map<string, LayoutVec2>([
		[frame.startJunctionId, [frame.start[0] + dx, frame.start[1] + dz]],
		[frame.endJunctionId, [frame.end[0] + dx, frame.end[1] + dz]],
	]);
	return {
		...document,
		junctions: document.junctions.map((junction) => {
			const point = moved.get(junction.id);
			return point === undefined ? junction : { ...junction, point: [point[0], point[1]] };
		}),
	};
}
