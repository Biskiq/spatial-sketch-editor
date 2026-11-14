import { roomLabelFacts } from '$lib/authoring/stage/stage-adapter-host';
import {
	readClosedWallCircle,
	isClosedWall,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import { type StageAdapterContext } from '$lib/authoring/stage/stage-adapter-host';
import { stageLayout } from '$lib/authoring/stage/stage-adapter-host';

import {
	wallFrame,
	openWallFrame,
	wallStationFrame,
	type OpenWallFrame,
	type WallFrame,
	type WallStationFrame
} from './precision';
import { type WallHandlePoints } from './wall-gesture';

export type OpeningMarkSubject = {
	readonly openingId: string;
	readonly wallId: string;
	readonly frame: WallFrame;
	/** Arc-length on a curved host; linear on a straight one. */
	readonly station: WallStationFrame;
	readonly length: number;
	readonly offset: number;
	readonly width: number;
};

/** The selected open Wall's sampled frame, straight or curved. */
export function selectedOpenWall(
	document: LayoutDocumentWallFirst,
	adapterContext: StageAdapterContext
): { wallId: string; frame: OpenWallFrame } | null {
	const primary = adapterContext.selectionState().primary;
	if (primary === null || primary.domain !== 'layout' || primary.subject.kind !== 'wall') return null;
	const frame = openWallFrame(document, primary.subject.id);
	return frame === null ? null : { wallId: primary.subject.id, frame };
}
/** The selected closed Wall's persisted circle facts, or `null`. */
export function selectedClosedWall(
	adapterContext: StageAdapterContext
): { wallId: string; center: LayoutVec2; radius: number; seam: LayoutVec2 } | null {
	const primary = adapterContext.selectionState().primary;
	if (primary === null || primary.domain !== 'layout' || primary.subject.kind !== 'wall') return null;
	const source = stageLayout(adapterContext.snapshot).walls.find(
		(wall) => wall.id === primary.subject.id
	);
	if (source === undefined || !isClosedWall(source)) return null;
	const facts = readClosedWallCircle(stageLayout(adapterContext.snapshot), source.id);
	return facts === null
		? null
		: { wallId: source.id, center: facts.center, radius: facts.radius, seam: facts.seam };
}
/** The selected **curved** open Wall, or `null` for a straight one. */
export function selectedCurvedWall(
	document: LayoutDocumentWallFirst,
	adapterContext: StageAdapterContext
): { wallId: string; frame: OpenWallFrame } | null {
	const selected = selectedOpenWall(document, adapterContext);
	if (selected === null) return null;
	const source = document.walls.find((candidate) => candidate.id === selected.wallId);
	return source === undefined || source.centerline.kind === 'line' ? null : selected;
}
/** The straight Wall the canonical selection names, or `null`. */
export function selectedWall(
	adapterContext: StageAdapterContext
): { readonly wallId: string; readonly frame: WallFrame } | null {
	const primary = adapterContext.selectionState().primary;
	if (primary === null || primary.domain !== 'layout' || primary.subject.kind !== 'wall') {
		return null;
	}
	const frame = wallFrame(stageLayout(adapterContext.snapshot), primary.subject.id);
	return frame === null ? null : { wallId: primary.subject.id, frame };
}
/** The selected Opening and its host Wall's resolved frame, or `null`. */
export function selectedOpening(
	document: LayoutDocumentWallFirst,
	adapterContext: StageAdapterContext
): OpeningMarkSubject | null {
	const primary = adapterContext.selectionState().primary;
	if (primary === null || primary.domain !== 'layout' || primary.subject.kind !== 'opening') return null;
	const opening = stageLayout(adapterContext.snapshot).openings.find(
		(candidate) => candidate.id === primary.subject.id
	);
	if (opening === undefined) return null;
	const span = openingSpanOf(document, opening.wallId);
	if (span === null) return null;
	return {
		openingId: opening.id,
		wallId: opening.wallId,
		frame: span.frame,
		station: span.station,
		length: span.length,
		offset: opening.offset,
		width: opening.width
	};
}
export function selectedRoomLabel(
	ctx: StageAdapterContext
): { readonly roomId: string; readonly world: [number, number, number] } | null {
	const primary = ctx.selectionState().primary;
	if (primary === null || primary.domain !== 'layout' || primary.subject.kind !== 'room') return null;
	const fact = roomLabelFacts(ctx.snapshot.domain.geometry, stageLayout(ctx.snapshot).rooms).find(
		(entry) => entry.id === primary.subject.id
	);
	return fact === undefined ? null : { roomId: fact.id, world: fact.world };
}
export function wallLength(frame: WallFrame): number {
	return Math.hypot(frame.end[0] - frame.start[0], frame.end[1] - frame.start[1]);
}

export function wallDirection(frame: WallFrame): readonly [number, number] | null {
	const dx = frame.end[0] - frame.start[0];
	const dz = frame.end[1] - frame.start[1];
	const length = Math.hypot(dx, dz);
	return length > 0 ? [dx / length, dz / length] : null;
}

export function framePoint(frame: WallFrame, distance: number, y: number): [number, number, number] {
	const direction = wallDirection(frame);
	if (direction === null) return [frame.start[0], y, frame.start[1]];
	return [frame.start[0] + direction[0] * distance, y, frame.start[1] + direction[1] * distance];
}
/**
 * The two endpoint handles plus the body handle.
 *
 * `project` returns the viewport's CSS space (the same space the renderer and
 * the Camera use), while a Stage pointer intent is local to the Stage surface.
 * Hit-testing therefore subtracts the one accepted evaluation rect; the overlay
 * keeps the projected points, exactly as the Scene adapter's markers do.
 */
export function projectWallHandles(
	context: StageAdapterContext,
	frame: WallFrame,
	space: 'stage' | 'viewport' = 'viewport'
): WallHandlePoints | null {
	const y = context.snapshot.domain.datumMeters;
	const project = (point: readonly [number, number]) => {
		const css = context.project([point[0], y, point[1]]);
		if (css === null) return null;
		return space === 'viewport'
			? css
			: ([css[0] - context.evaluation.rect.left, css[1] - context.evaluation.rect.top] as const);
	};
	const start = project(frame.start);
	const end = project(frame.end);
	const middle = project([(frame.start[0] + frame.end[0]) / 2, (frame.start[1] + frame.end[1]) / 2]);
	if (start === null || end === null || middle === null) return null;
	return { start, end, middle };
}

/**
 * A curved body move still uses the canonical rigid-move request, whose
 * address is the Wall id and one world delta. The straight frame here is
 * only the local drag basis (normal and press anchor); the retained planner
 * reads the curved chain from the document and translates every knot.
 */
export function bodyFrameForOpenWall(frame: OpenWallFrame): WallFrame {
	const dx = frame.end[0] - frame.start[0];
	const dz = frame.end[1] - frame.start[1];
	const length = Math.hypot(dx, dz);
	return {
		wallId: frame.wallId,
		startJunctionId: frame.startJunctionId,
		endJunctionId: frame.endJunctionId,
		start: [frame.start[0], frame.start[1]],
		end: [frame.end[0], frame.end[1]],
		direction: [dx / length, dz / length],
		length,
		angleRadians: Math.atan2(dz, dx)
	};
}

/** The host Wall's frame and resolved length, when it has one. */
export function openingSpanOf(
	document: LayoutDocumentWallFirst,
	wallId: string
): { frame: WallFrame; length: number; station: WallStationFrame } | null {
	// Surface 3: one station frame per host. An Opening mark, ghost or
	// handle reads `station.pointAt`, which is exact arc length on a
	// curved centerline and linear on a straight one, so only curved
	// hosts move and straight-host output stays byte-identical.
	const station = wallStationFrame(document, wallId);
	if (station === null) return null;
	const frame = wallFrame(document, wallId) ?? {
		wallId,
		startJunctionId: '',
		endJunctionId: '',
		start: station.start,
		end: station.end,
		direction: station.direction,
		length: station.length,
		angleRadians: Math.atan2(station.direction[1], station.direction[0])
	};
	return station.length > 0 ? { frame, length: station.length, station } : null;
}
