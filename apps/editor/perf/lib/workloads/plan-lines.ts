/**
 * Planner-only drawing helpers for the S06 workloads (T1.P02.S06).
 *
 * Every Wall, Junction, Room and Opening is produced by a public `layout-core`
 * planner. These helpers only choose the planner inputs a creator's gesture
 * would supply: the points, and the declared snaps an endpoint makes onto an
 * existing Junction or Wall. They never write a document literal.
 */

import {
	planCreateWallFirstOpening,
	planWallChain,
	planWallMetadataUpdate,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWallOpening
} from '@portfolio/layout-core';

import type { CaptureSource } from './grid';

const EPSILON = 1e-6;

function near(a: LayoutVec2, b: LayoutVec2): boolean {
	return Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON;
}

export function junctionPoint(document: LayoutDocumentWallFirst, id: string): LayoutVec2 {
	const junction = document.junctions.find((candidate) => candidate.id === id);
	if (junction === undefined) throw new Error(`missing junction ${id}`);
	return junction.point;
}

function junctionAt(document: LayoutDocumentWallFirst, p: LayoutVec2): string | null {
	return document.junctions.find((junction) => near(junction.point, p))?.id ?? null;
}

/** The straight Wall whose open span contains `p`. */
function hostAt(document: LayoutDocumentWallFirst, p: LayoutVec2): string | null {
	for (const wall of document.walls) {
		const a = junctionPoint(document, wall.startJunctionId);
		const b = junctionPoint(document, wall.endJunctionId);
		const abx = b[0] - a[0];
		const abz = b[1] - a[1];
		const lengthSquared = abx * abx + abz * abz;
		const t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / lengthSquared;
		if (t <= EPSILON || t >= 1 - EPSILON) continue;
		const qx = a[0] + t * abx - p[0];
		const qz = a[1] + t * abz - p[1];
		if (qx * qx + qz * qz < 1e-10) return wall.id;
	}
	return null;
}

/**
 * One drawn chain. An open chain declares the snap each endpoint makes (an
 * existing Junction first, else the Wall whose span it lands on), so it joins
 * that connected group and is noded against it, like a snapped gesture. With
 * `independent`, nothing is declared: the chain is free placement.
 */
export function drawChain(
	document: LayoutDocumentWallFirst,
	points: readonly LayoutVec2[],
	options: { captures: CaptureSource; close?: boolean; independent?: boolean }
): LayoutDocumentWallFirst {
	const close = options.close ?? false;
	const junctionSnaps: { pointIndex: number; junctionId: string }[] = [];
	const hostSnaps: { pointIndex: number; wallId: string }[] = [];
	if (!close && options.independent !== true) {
		for (const pointIndex of [0, points.length - 1]) {
			const p = points[pointIndex]!;
			const junctionId = junctionAt(document, p);
			if (junctionId !== null) {
				junctionSnaps.push({ pointIndex, junctionId });
				continue;
			}
			const wallId = hostAt(document, p);
			if (wallId !== null) hostSnaps.push({ pointIndex, wallId });
		}
	}
	const plan = planWallChain({
		baseline: document,
		points,
		close,
		capture: options.captures(),
		levelId: document.floor.id,
		...(junctionSnaps.length > 0 ? { endpointJunctionSnaps: junctionSnaps } : {}),
		...(hostSnaps.length > 0 ? { endpointHostSnaps: hostSnaps } : {})
	});
	if (plan.kind !== 'success') {
		throw new Error(`chain ${JSON.stringify(points)} refused: ${plan.rejection.code} ${plan.rejection.message}`);
	}
	return plan.document;
}

export function drawRectangle(
	document: LayoutDocumentWallFirst,
	x0: number,
	z0: number,
	x1: number,
	z1: number,
	captures: CaptureSource
): LayoutDocumentWallFirst {
	return drawChain(
		document,
		[
			[x0, z0],
			[x1, z0],
			[x1, z1],
			[x0, z1]
		],
		{ captures, close: true }
	);
}

/** An independent k×k block of `cell`-meter Rooms at `origin` (its own connected group). */
export function drawGridBlock(
	document: LayoutDocumentWallFirst,
	origin: LayoutVec2,
	k: number,
	cell: number,
	captures: CaptureSource
): LayoutDocumentWallFirst {
	const [ox, oz] = origin;
	const size = k * cell;
	let current = drawRectangle(document, ox, oz, ox + size, oz + size, captures);
	for (let index = 1; index < k; index++) {
		current = drawChain(current, [[ox + index * cell, oz], [ox + index * cell, oz + size]], { captures });
	}
	for (let index = 1; index < k; index++) {
		current = drawChain(current, [[ox, oz + index * cell], [ox + size, oz + index * cell]], { captures });
	}
	return current;
}

export type WallSpan = { readonly id: string; readonly start: LayoutVec2; readonly end: LayoutVec2; readonly length: number };

export function wallSpan(document: LayoutDocumentWallFirst, wallId: string): WallSpan {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (wall === undefined) throw new Error(`missing wall ${wallId}`);
	const start = junctionPoint(document, wall.startJunctionId);
	const end = junctionPoint(document, wall.endJunctionId);
	return { id: wall.id, start, end, length: Math.hypot(end[0] - start[0], end[1] - start[1]) };
}

/** Every Wall whose two endpoints lie on the axis-aligned segment a→b, ordered along it. */
export function wallsAlong(document: LayoutDocumentWallFirst, a: LayoutVec2, b: LayoutVec2): WallSpan[] {
	const onSegment = (p: LayoutVec2) => {
		const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
		if (Math.abs(cross) > 1e-6) return false;
		const t =
			((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) /
			((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
		return t >= -EPSILON && t <= 1 + EPSILON;
	};
	const param = (p: LayoutVec2) => Math.hypot(p[0] - a[0], p[1] - a[1]);
	return document.walls
		.map((wall) => wallSpan(document, wall.id))
		.filter((span) => onSegment(span.start) && onSegment(span.end))
		.sort((left, right) => param(left.start) + param(left.end) - (param(right.start) + param(right.end)));
}

/** The Rooms whose boundary uses this Wall (two for a dividing Wall). */
export function roomsOfWall(document: LayoutDocumentWallFirst, wallId: string): string[] {
	return document.rooms.filter((room) => room.boundary.some((ref) => ref.wallId === wallId)).map((room) => room.id);
}

export const DOOR_WIDTH = 1;
export const WINDOW_WIDTH = 1.2;

/**
 * One Opening centered on a Wall. A door between two Rooms declares their
 * `connectsRoomIds` relation, as the authored portal relation requires.
 */
export function addCenteredOpening(
	document: LayoutDocumentWallFirst,
	wallId: string,
	kind: LayoutWallOpening['kind'],
	captures: CaptureSource
): LayoutDocumentWallFirst {
	const span = wallSpan(document, wallId);
	const width = kind === 'door' ? DOOR_WIDTH : WINDOW_WIDTH;
	if (span.length < width + 1) return document;
	const rooms = roomsOfWall(document, wallId);
	const plan = planCreateWallFirstOpening(
		document,
		{
			wallId,
			kind,
			offset: (span.length - width) / 2,
			width,
			...(kind === 'door' && rooms.length === 2 ? { connectsRoomIds: [rooms[0]!, rooms[1]!] as [string, string] } : {})
		},
		captures(),
		document.floor.id
	);
	if (plan.kind !== 'success') throw new Error(`opening on ${wallId} refused: ${plan.rejection.code} ${plan.rejection.message}`);
	return plan.document;
}

/** Name one Wall so the shipped Index shows a stable, findable label. */
export function nameWall(document: LayoutDocumentWallFirst, wallId: string, name: string): LayoutDocumentWallFirst {
	const plan = planWallMetadataUpdate(document, wallId, { name });
	if (plan.kind !== 'success') throw new Error(`naming ${wallId} refused: ${plan.rejection.code}`);
	return plan.document;
}
