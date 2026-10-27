/**
 * The museum-shaped census layout and its irrelevance-sweep additions (T1.P02.S06 B).
 *
 * One realistic, non-grid plan with ordinary counts, built only through public
 * planners (see `plan-lines.ts`). Plan meters; the building spans
 * x ∈ [-12, 84], z ∈ [-12, 48]:
 *
 * - **South wing** (z ∈ [-12, 6]): two rows of nine galleries of varied widths.
 *   Every divider carries a door at the same place along its row, so each row
 *   is an **enfilade** of aligned doors. The east exterior Wall of the north row
 *   carries one window on the enfilade's axis (z = 1.5): variant D is seen
 *   through it, and variant H stays out of its sightline.
 * - **Corridor loop**: four corridor Rooms (south, west, north, east) around the
 *   central block, joined at the corners by doors, so the portal graph has a cycle.
 * - **Central block** (x ∈ [-9, 81], z ∈ [9, 36]): galleries in three rows plus
 *   one **large hall** (x ∈ [30, 57], z ∈ [18, 36]).
 * - **North wing** (z ∈ [39, 48]): two rows of eight galleries.
 * - Free-standing display partitions inside the galleries (three parallel runs
 *   each) and pilaster stubs on the long exterior Walls.
 *
 * The **focus wing** is the south wing's two west columns (x ∈ [-12, 14]). Its
 * north-west gallery contains the plan origin, where the Stage's shadowed
 * directional light aims its default shadow camera. The fixed edits act on its
 * named display partition, `FOCUS_WALL_NAME`.
 *
 * Doors between two Rooms declare their `connectsRoomIds` relation. Windows sit
 * only on the south and north exterior Walls and on the enfilade's east window.
 */

import type { LayoutDocumentWallFirst, LayoutVec2 } from '@portfolio/layout-core';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';

import type { CaptureSource } from './grid';
import {
	addCenteredOpening,
	drawChain,
	drawGridBlock,
	drawRectangle,
	nameWall,
	roomsOfWall,
	wallsAlong,
	type WallSpan
} from './plan-lines';

export const MUSEUM_BOUNDS = { x0: -12, z0: -12, x1: 84, z1: 48 } as const;
export const FOCUS_WALL_NAME = 'Focus partition';
/** The focus wing's plan extent (the two west columns of the south wing). */
export const FOCUS_WING = { x0: -12, z0: -12, x1: 14, z1: 6 } as const;

const SOUTH_DIVIDERS = [4, 14, 24, 36, 46, 56, 66, 76];
const NORTH_DIVIDERS = [6, 16, 28, 38, 50, 60, 72];
const CENTRAL_COLUMNS = [3, 15, 69];
const HALL = { x0: 30, z0: 18, x1: 57, z1: 36 } as const;

/** Room centers (plan) where the generator places a display partition. */
function partitionSites(): { center: LayoutVec2; along: 'x' | 'z'; length: number }[] {
	const sites: { center: LayoutVec2; along: 'x' | 'z'; length: number }[] = [];
	const southColumns = [MUSEUM_BOUNDS.x0, ...SOUTH_DIVIDERS, MUSEUM_BOUNDS.x1];
	for (let column = 0; column + 1 < southColumns.length; column++) {
		const x = (southColumns[column]! + southColumns[column + 1]!) / 2;
		// The focus gallery's site is the first: it stands in the fixed View's own
		// Room (the north row's first gallery), in its frustum and inside the
		// light's shadow camera, clear of the enfilade axis (z = 1.5), so the
		// fixed edit is visible at the fixed View (E5's framebuffer check).
		sites.push(column === 0 ? { center: [-2, -1], along: 'x', length: 3 } : { center: [x, -7.5], along: 'x', length: 3 });
	}
	const northColumns = [MUSEUM_BOUNDS.x0, ...NORTH_DIVIDERS, MUSEUM_BOUNDS.x1];
	for (let column = 0; column + 1 < northColumns.length; column++) {
		const x = (northColumns[column]! + northColumns[column + 1]!) / 2;
		sites.push({ center: [x, 45.75], along: 'x', length: 3 });
	}
	const centralColumns = [-9, ...CENTRAL_COLUMNS.slice(0, 2), 30];
	for (let column = 0; column + 1 < centralColumns.length; column++) {
		const x = (centralColumns[column]! + centralColumns[column + 1]!) / 2;
		for (const z of [13.5, 22.5, 31.5]) sites.push({ center: [x, z], along: 'z', length: 3 });
	}
	for (const x of [63, 75]) for (const z of [13.5, 22.5, 31.5]) sites.push({ center: [x, z], along: 'z', length: 3 });
	// The hall keeps a run of partitions, as a large exhibition hall does.
	for (const x of [36, 43.5, 51]) for (const z of [24, 30]) sites.push({ center: [x, z], along: 'x', length: 4 });
	return sites;
}

function doorsOn(document: LayoutDocumentWallFirst, spans: readonly WallSpan[], captures: CaptureSource): LayoutDocumentWallFirst {
	let current = document;
	for (const span of spans) {
		if (roomsOfWall(current, span.id).length !== 2) continue;
		current = addCenteredOpening(current, span.id, 'door', captures);
	}
	return current;
}

export type MuseumLayout = {
	readonly document: LayoutDocumentWallFirst;
	readonly focusWallId: string;
};

export function buildMuseumLayout(captures: CaptureSource): MuseumLayout {
	const { x0, z0, x1, z1 } = MUSEUM_BOUNDS;
	let d = drawRectangle(createEmptyWallFirstLayoutDocument(), x0, z0, x1, z1, captures);
	const line = (a: LayoutVec2, b: LayoutVec2) => {
		d = drawChain(d, [a, b], { captures });
	};

	// Band lines: south wing rows, corridor ring and north wing rows.
	for (const z of [-3, 6, 9, 36, 39, 43.5]) line([x0, z], [x1, z]);
	// South and north wing dividers.
	for (const x of SOUTH_DIVIDERS) line([x, z0], [x, 6]);
	for (const x of NORTH_DIVIDERS) line([x, 39], [x, z1]);
	// The corridor ring's inner west/east sides.
	line([-9, 9], [-9, 36]);
	line([81, 9], [81, 36]);
	// Central block rows, columns and the hall.
	line([-9, 18], [81, 18]);
	for (const x of [...CENTRAL_COLUMNS, HALL.x0, HALL.x1]) line([x, 9], [x, 36]);
	line([45, 9], [45, 18]);
	line([-9, 27], [HALL.x0, 27]);
	line([HALL.x1, 27], [81, 27]);

	// Pilaster stubs at the quarter points of each south and north gallery's
	// exterior Wall; they split it, so its middle span keeps the window.
	const southColumns = [x0, ...SOUTH_DIVIDERS, x1];
	const northColumns = [x0, ...NORTH_DIVIDERS, x1];
	for (const [columns, z, inward] of [
		[southColumns, z0, 1.5],
		[northColumns, z1, -1.5]
	] as [number[], number, number][]) {
		for (let column = 0; column + 1 < columns.length; column++) {
			const a = columns[column]!;
			const w = columns[column + 1]! - a;
			for (const x of [a + w / 4, a + (3 * w) / 4]) line([x, z], [x, z + inward]);
		}
	}

	// Display partitions: free placement inside a gallery, no shared topology.
	// Each site is a run of three parallel partitions 1.5 m apart.
	const sites = partitionSites();
	for (const site of sites) {
		const half = site.length / 2;
		const [cx, cz] = site.center;
		for (const shift of [-1.5, 0, 1.5]) {
			const ends: [LayoutVec2, LayoutVec2] =
				site.along === 'x'
					? [[cx - half, cz + shift], [cx + half, cz + shift]]
					: [[cx + shift, cz - half], [cx + shift, cz + half]];
			d = drawChain(d, ends, { captures, independent: true });
		}
	}

	// Enfilades: aligned doors on every south and north wing divider.
	for (const x of SOUTH_DIVIDERS) d = doorsOn(d, wallsAlong(d, [x, z0], [x, 6]), captures);
	for (const x of NORTH_DIVIDERS) d = doorsOn(d, wallsAlong(d, [x, 39], [x, z1]), captures);
	// Row-to-row and gallery-to-corridor doors.
	for (const z of [-3, 6, 39, 43.5]) d = doorsOn(d, wallsAlong(d, [x0, z], [x1, z]), captures);
	// The corridor loop's corners and the central block's own doors.
	for (const [a, b] of [
		[[x0, 9], [-9, 9]],
		[[x0, 36], [-9, 36]],
		[[81, 9], [x1, 9]],
		[[81, 36], [x1, 36]]
	] as [LayoutVec2, LayoutVec2][]) {
		d = doorsOn(d, wallsAlong(d, a, b), captures);
	}
	for (const z of [9, 18, 27, 36]) d = doorsOn(d, wallsAlong(d, [-9, z], [81, z]), captures);
	for (const x of [-9, ...CENTRAL_COLUMNS, HALL.x0, HALL.x1, 45, 81]) d = doorsOn(d, wallsAlong(d, [x, 9], [x, 36]), captures);

	// Windows: the middle span of each south and north exterior gallery Wall,
	// plus the enfilade's east window.
	for (const z of [z0, z1]) {
		for (const span of wallsAlong(d, [x0, z], [x1, z])) {
			if (span.length >= 4) d = addCenteredOpening(d, span.id, 'window', captures);
		}
	}
	const eastWindow = wallsAlong(d, [x1, -3], [x1, 6]);
	if (eastWindow.length !== 1) throw new Error(`expected one east enfilade Wall, found ${eastWindow.length}`);
	d = addCenteredOpening(d, eastWindow[0]!.id, 'window', captures);

	// The focus wing's display partition carries the fixed edits.
	const focusSite = sites[0]!;
	const focus = wallsAlong(
		d,
		[focusSite.center[0] - focusSite.length / 2, focusSite.center[1]],
		[focusSite.center[0] + focusSite.length / 2, focusSite.center[1]]
	);
	if (focus.length !== 1) throw new Error(`expected one focus partition, found ${focus.length}`);
	d = nameWall(d, focus[0]!.id, FOCUS_WALL_NAME);
	return { document: d, focusWallId: focus[0]!.id };
}

/**
 * Sweep variants: hidden-and-independent (H), distant-and-visible (D) or
 * connected (C, the owner's D3 ruling): C joins the museum's Wall graph and
 * carries Openings, so the Room×Opening and Wall×Opening pair terms grow with it.
 */
export type SweepVariant = 'H' | 'D' | 'C';

/** The museum's own size in the units the sweep scales: one ×1 base worth of complexity. */
export const SWEEP_BLOCK = { k: 7, cell: 6 } as const;

/**
 * Where the n-th added block of a variant goes.
 *
 * - **H** blocks sit east and north-east of the building, off the enfilade's
 *   sightline (|z − 1.5| ≥ 20 m beyond x = 84) and far outside the default
 *   directional shadow camera around the origin. Their first block is inside
 *   the fixed View's horizontal frustum, behind the focus wing's Walls.
 * - **D** blocks continue the enfilade's axis eastwards, beyond the east window.
 * - **C** blocks form one strip eastwards from the museum's north-east corner
 *   (z ∈ [48, 90]): the first shares that corner Junction, each later one the
 *   previous block's east Wall run, so the museum and every block are one
 *   connected Wall graph. The strip stays north of the enfilade's sightline.
 */
export function sweepBlockOrigin(variant: SweepVariant, index: number): LayoutVec2 {
	const size = SWEEP_BLOCK.k * SWEEP_BLOCK.cell;
	const gap = 12;
	if (variant === 'C') return [MUSEUM_BOUNDS.x1 + index * size, MUSEUM_BOUNDS.z1];
	if (variant === 'D') return [MUSEUM_BOUNDS.x1 + 30 + index * (size + gap), 1.5 - size / 2];
	const column = Math.floor(index / 2);
	const north = index % 2 === 0;
	return [MUSEUM_BOUNDS.x1 + 30 + column * (size + gap), north ? 24 : -21 - size];
}

/**
 * One connected k×k block (variant C). Its outline is drawn as open chains
 * snapped to the Junctions it shares: the museum's corner for the first block,
 * the previous block's east corners for the rest, whose east Wall run is this
 * block's west side. Interior lines snap onto the outline, like a creator's
 * gesture.
 */
function drawConnectedBlock(
	document: LayoutDocumentWallFirst,
	origin: LayoutVec2,
	k: number,
	cell: number,
	captures: CaptureSource,
	sharesWest: boolean
): LayoutDocumentWallFirst {
	const [ox, oz] = origin;
	const size = k * cell;
	let current = sharesWest
		? drawChain(document, [[ox, oz], [ox + size, oz], [ox + size, oz + size], [ox, oz + size]], { captures })
		: drawChain(
				drawChain(document, [[ox, oz], [ox + size, oz], [ox + size, oz + size]], { captures }),
				[[ox, oz], [ox, oz + size], [ox + size, oz + size]],
				{ captures }
			);
	for (let index = 1; index < k; index++) {
		current = drawChain(current, [[ox + index * cell, oz], [ox + index * cell, oz + size]], { captures });
	}
	for (let index = 1; index < k; index++) {
		current = drawChain(current, [[ox, oz + index * cell], [ox + size, oz + index * cell]], { captures });
	}
	return current;
}

/**
 * A connected block's Openings, about 63 per block: a door on every Wall
 * between two Rooms of a row (each row is an enfilade), a door chain up the
 * middle column, one door through the shared west Wall run, and a window on
 * each span of the south and north sides.
 */
function addConnectedBlockOpenings(
	document: LayoutDocumentWallFirst,
	origin: LayoutVec2,
	k: number,
	cell: number,
	captures: CaptureSource,
	sharesWest: boolean
): LayoutDocumentWallFirst {
	const [ox, oz] = origin;
	const size = k * cell;
	const middle = Math.floor(k / 2);
	let current = document;
	for (let index = 1; index < k; index++) {
		current = doorsOn(current, wallsAlong(current, [ox + index * cell, oz], [ox + index * cell, oz + size]), captures);
	}
	for (let index = 1; index < k; index++) {
		const z = oz + index * cell;
		current = doorsOn(current, wallsAlong(current, [ox + middle * cell, z], [ox + (middle + 1) * cell, z]), captures);
	}
	if (sharesWest) current = doorsOn(current, wallsAlong(current, [ox, oz + middle * cell], [ox, oz + (middle + 1) * cell]), captures);
	for (const z of [oz, oz + size]) {
		for (const span of wallsAlong(current, [ox, z], [ox + size, z])) {
			if (span.length >= 4) current = addCenteredOpening(current, span.id, 'window', captures);
		}
	}
	return current;
}

/**
 * Add `blocks` gallery blocks for a sweep variant. H and D blocks are
 * independent and add Rooms and Walls only: no Opening (nothing to see
 * through), no light. C blocks are connected and carry Openings.
 */
export function addSweepBlocks(
	document: LayoutDocumentWallFirst,
	variant: SweepVariant,
	blocks: number,
	captures: CaptureSource,
	firstIndex = 0
): LayoutDocumentWallFirst {
	let current = document;
	for (let index = firstIndex; index < firstIndex + blocks; index++) {
		const origin = sweepBlockOrigin(variant, index);
		if (variant === 'C') {
			current = drawConnectedBlock(current, origin, SWEEP_BLOCK.k, SWEEP_BLOCK.cell, captures, index > 0);
			current = addConnectedBlockOpenings(current, origin, SWEEP_BLOCK.k, SWEEP_BLOCK.cell, captures, index > 0);
		} else {
			current = drawGridBlock(current, origin, SWEEP_BLOCK.k, SWEEP_BLOCK.cell, captures);
		}
	}
	return current;
}
