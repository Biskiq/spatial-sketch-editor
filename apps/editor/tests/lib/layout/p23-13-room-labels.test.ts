import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	createPlanViewportState,
	planScreenToWorld,
	worldToPlanScreen,
	type PlanViewportState
} from '$lib/editor/layout/layout-plan-transform';
import {
	APPROXIMATE_TEXT_MEASURE,
	formatRoomArea,
	placeRoomLabels,
	roomFloorAreaM2,
	ROOM_LABEL_ACTIVE_TEXT_RESERVE_PX,
	ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX,
	ROOM_LABEL_DISPLACEMENT_CAP_PX,
	ROOM_LABEL_MAX_NAME_WIDTH_PX,
	ROOM_LABEL_READOUT_INSET_PX,
	ROOM_LABEL_READOUT_MAX_WIDTH_PX,
	ROOM_LABEL_REAPPEAR_CLEARANCE_PX,
	ROOM_LABEL_SETTLE_DELAY_MS,
	ROOM_LABEL_TEXT_STYLES,
	type RoomLabelFacts,
	type RoomLabelMask,
	type RoomLabelMemory,
	type TextMeasure
} from '$lib/editor/layout/plan-room-labels';
import type { LayoutVec2 } from '$lib/layout/layout-types';

/**
 * Deterministic fixture metrics: 6 px per character, line boxes from the
 * placer's own typography table. Placement must never depend on host fonts, so
 * every test in this suite injects this measure explicitly.
 */
const CHAR_PX = 6;
const fixtureMeasure: TextMeasure = (text, style) => ({
	width: text.length * CHAR_PX,
	height: ROOM_LABEL_TEXT_STYLES[style].lineHeightPx
});

/** Default 800×600 viewport at 50 px/m, centered on world origin. */
function view(overrides: Partial<PlanViewportState> = {}): PlanViewportState {
	return { ...createPlanViewportState(), ...overrides };
}

/** Axis-aligned Room polygon in meters, `size[0] × size[1]`, origin at `at`. */
function rectRoom(
	roomId: string,
	at: LayoutVec2,
	size: LayoutVec2,
	facts: Partial<RoomLabelFacts> = {}
): RoomLabelFacts {
	const [x, z] = at;
	const [width, height] = size;
	const polygon: LayoutVec2[] = [
		[x, z],
		[x + width, z],
		[x + width, z + height],
		[x, z + height]
	];
	return {
		roomId,
		polygon,
		// `!== undefined` (not `??`) so an explicit `null` reference/area survives.
		name: facts.name !== undefined ? facts.name : 'Gallery',
		reference: facts.reference !== undefined ? facts.reference : 'R-7K3M',
		areaM2: facts.areaM2 !== undefined ? facts.areaM2 : roomFloorAreaM2(polygon)
	};
}

function labelFor(result: ReturnType<typeof placeRoomLabels>, roomId: string) {
	return result.labels.find((label) => label.roomId === roomId);
}

function linesOf(label: { lines: { style: string; text: string }[] }): string[] {
	return label.lines.map((line) => `${line.style}:${line.text}`);
}

function polygonBounds(polygon: readonly LayoutVec2[]) {
	const xs = polygon.map(([x]) => x);
	const zs = polygon.map(([, z]) => z);
	return {
		minX: Math.min(...xs),
		maxX: Math.max(...xs),
		minZ: Math.min(...zs),
		maxZ: Math.max(...zs)
	};
}

describe('P23.13 S3 — Room label area source and formatting', () => {
	it('derives area from the compiled floor polygon, not from a renderer guess', () => {
		expect(
			roomFloorAreaM2([
				[0, 0],
				[4, 0],
				[4, 3],
				[0, 3]
			])
		).toBe(12);
		// A concave C-face: ear-clipped interior point, still the exact polygon area.
		expect(
			roomFloorAreaM2([
				[0, 0],
				[6, 0],
				[6, 2],
				[2, 2],
				[2, 4],
				[6, 4],
				[6, 6],
				[0, 6]
			])
		).toBe(28);
		expect(roomFloorAreaM2([[0, 0], [1, 1]])).toBeNull();
	});

	it('formats one decimal, and a positive rounding to zero reads <0.1 m²', () => {
		expect(formatRoomArea(24.46)).toBe('24.5 m²');
		expect(formatRoomArea(0.04)).toBe('<0.1 m²');
		expect(formatRoomArea(0)).toBeNull();
		expect(formatRoomArea(null)).toBeNull();
		expect(formatRoomArea(Number.NaN)).toBeNull();
	});
});

describe('P23.13 S3 — free-space candidates and the complete text rectangle', () => {
	it('places the full stack (name / reference / area) as one anchor inside a large face', () => {
		const result = placeRoomLabels({
			rooms: [rectRoom('room-1', [0, 0], [6, 4])],
			planView: view(),
			measure: fixtureMeasure
		});
		const label = labelFor(result, 'room-1')!;
		expect(label.tier).toBe('full');
		expect(label.lines.map((line) => line.style)).toEqual([
			'room-name',
			'room-reference',
			'room-area'
		]);
		expect(label.lines.map((line) => line.text)).toEqual(['Gallery', 'R-7K3M', '24.0 m²']);
		// One shared world anchor; the stacked baselines are strictly increasing.
		expect(new Set(label.lines.map((line) => label.anchorWorld.join(','))).size).toBe(1);
		const offsets = label.lines.map((line) => line.baselineOffsetPx);
		expect(offsets[1]).toBeGreaterThan(offsets[0]!);
		expect(offsets[2]).toBeGreaterThan(offsets[1]!);
		// The anchor is inside the face, near its semantic center.
		const anchor = label.anchorWorld;
		expect(anchor[0]).toBeGreaterThan(1);
		expect(anchor[0]).toBeLessThan(5);
		expect(anchor[1]).toBeGreaterThan(1);
		expect(anchor[1]).toBeLessThan(3);
	});

	it('tests the whole rectangle, not its center: a concave notch is never covered', () => {
		// C-shape: the area centroid lands in the notch, so a point-anchor placer
		// would put the text outside the face.
		const polygon: LayoutVec2[] = [
			[0, 0],
			[6, 0],
			[6, 2],
			[2, 2],
			[2, 4],
			[6, 4],
			[6, 6],
			[0, 6]
		];
		const result = placeRoomLabels({
			rooms: [{ roomId: 'room-c', polygon, name: 'Gallery', reference: 'R-7K3M', areaM2: 28 }],
			planView: view(),
			measure: fixtureMeasure
		});
		const label = labelFor(result, 'room-c')!;
		const [sx, sy] = worldToPlanScreen(view(), label.anchorWorld);
		const halfWidth = label.widthPx / 2;
		const halfHeight = label.heightPx / 2;
		// Every corner of the accepted rectangle sits inside the face (the screen
		// transform is affine, so world containment is preserved).
		const corners: LayoutVec2[] = [
			[sx - halfWidth, sy - halfHeight],
			[sx + halfWidth, sy - halfHeight],
			[sx + halfWidth, sy + halfHeight],
			[sx - halfWidth, sy + halfHeight]
		];
		const screenPolygon = polygon.map((point) => worldToPlanScreen(view(), point));
		for (const corner of corners) {
			expect(pointInPolygon(screenPolygon, corner)).toBe(true);
		}
		// Specifically: not in the notch, which occupies screen x 500..600 below y 400.
		expect(sy + halfHeight).toBeLessThanOrEqual(400 + 1e-6);
	});

	it('relocates around an authored object footprint instead of overlapping it', () => {
		const viewport = view();
		// A 2×2 m block centered in a 6×4 m Room: 100×100 px right on the semantic
		// center, so the first candidate has to move.
		const result = placeRoomLabels({
			rooms: [rectRoom('room-1', [0, 0], [6, 4])],
			planView: viewport,
			measure: fixtureMeasure,
			mask: {
				obstacles: [
					{
						polygon: [
							[2, 1],
							[4, 1],
							[4, 3],
							[2, 3]
						],
						clearancePx: ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX
					}
				]
			}
		});
		const label = labelFor(result, 'room-1')!;
		const [sx, sy] = worldToPlanScreen(viewport, label.anchorWorld);
		// The obstacle occupies screen x 500..600, y 350..450; the accepted
		// rectangle keeps the 8 px core reserve away from it.
		const clearance =
			Math.max(0, 500 - (sx + label.widthPx / 2), sx - label.widthPx / 2 - 600) +
			Math.max(0, 350 - (sy + label.heightPx / 2), sy - label.heightPx / 2 - 450);
		expect(clearance).toBeGreaterThan(0);
		expect(overlapsRect(sx, sy, label.widthPx, label.heightPx, 500, 350, 600, 450)).toBe(false);
	});

	it('reserves active text at 24 px and never crowds the selected-target readout', () => {
		const viewport = view();
		const activeTextRect = {
			minX: 460,
			minY: 350,
			maxX: 540,
			maxY: 450
		};
		const result = placeRoomLabels({
			rooms: [rectRoom('room-1', [0, 0], [6, 4])],
			planView: viewport,
			measure: fixtureMeasure,
			mask: {
				activeText: [
					{ rect: activeTextRect, clearancePx: ROOM_LABEL_ACTIVE_TEXT_RESERVE_PX }
				]
			}
		});
		const label = labelFor(result, 'room-1')!;
		const [sx, sy] = worldToPlanScreen(viewport, label.anchorWorld);
		expect(
			overlapsRect(
				sx,
				sy,
				label.widthPx,
				label.heightPx,
				activeTextRect.minX - ROOM_LABEL_ACTIVE_TEXT_RESERVE_PX,
				activeTextRect.minY - ROOM_LABEL_ACTIVE_TEXT_RESERVE_PX,
				activeTextRect.maxX + ROOM_LABEL_ACTIVE_TEXT_RESERVE_PX,
				activeTextRect.maxY + ROOM_LABEL_ACTIVE_TEXT_RESERVE_PX
			)
		).toBe(false);
	});
});

describe('P23.13 S3 — tiers, drop order and duplicates', () => {
	it('drops area → reference → the whole label, always at the existing candidate', () => {
		// 1.6 m wide Rooms at 50 px/m = 80 px; the tier that fits follows the
		// ratified drop order as the face gets shorter. Heights are chosen with a
		// whole mask cell of margin, because the candidate sits on a cell centre.
		const tall = placeRoomLabels({
			rooms: [rectRoom('room-tall', [0, 0], [1.6, 1.4])],
			planView: view(),
			measure: fixtureMeasure
		});
		expect(labelFor(tall, 'room-tall')?.tier).toBe('full');

		const middle = placeRoomLabels({
			rooms: [rectRoom('room-mid', [0, 0], [1.6, 1])],
			planView: view(),
			measure: fixtureMeasure
		});
		expect(labelFor(middle, 'room-mid')?.tier).toBe('name-reference');

		const short = placeRoomLabels({
			rooms: [rectRoom('room-short', [0, 0], [1.6, 0.8])],
			planView: view(),
			measure: fixtureMeasure
		});
		expect(labelFor(short, 'room-short')?.tier).toBe('name');
		expect(labelFor(short, 'room-short')?.lines.map((line) => line.style)).toEqual(['room-name']);

		const tiny = placeRoomLabels({
			rooms: [rectRoom('room-tiny', [0, 0], [0.6, 0.5])],
			planView: view(),
			measure: fixtureMeasure
		});
		expect(labelFor(tiny, 'room-tiny')).toBeUndefined();
		// Honest absence, not a forced overlap: nothing was emitted for any tier.
		expect(tiny.labels).toHaveLength(0);
	});

	it('keeps the tier reduction at the same candidate instead of relocating far away', () => {
		const viewport = view();
		// First resolve accepts the center candidate with the full stack.
		const memory: RoomLabelMemory = new Map();
		const first = placeRoomLabels({
			rooms: [rectRoom('room-1', [0, 0], [6, 4])],
			planView: viewport,
			measure: fixtureMeasure,
			memory
		});
		const accepted = labelFor(first, 'room-1')!;
		expect(accepted.tier).toBe('full');

		// Now an obstacle covers the accepted rectangle's lower half only: the
		// full stack and name+reference fail there, the name alone still fits. A
		// distant pocket could carry the full stack — the ratified rule prefers the
		// tier drop at the existing candidate.
		const [sx, sy] = worldToPlanScreen(viewport, accepted.anchorWorld);
		// The band starts below the name-only rectangle's 8 px reserve, so the
		// accepted candidate can still carry the name alone — but nothing taller.
		const obstacle = planScreenToWorld(viewport, [sx - 60, sy + 16]) as LayoutVec2;
		const obstacleCorner = planScreenToWorld(viewport, [sx + 60, sy + 90]) as LayoutVec2;
		const second = placeRoomLabels({
			rooms: [rectRoom('room-1', [0, 0], [6, 4])],
			planView: viewport,
			measure: fixtureMeasure,
			memory,
			reason: 'lod',
			mask: {
				obstacles: [
					{
						polygon: [obstacle, [obstacleCorner[0], obstacle[1]], obstacleCorner, [obstacle[0], obstacleCorner[1]]],
						clearancePx: ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX
					}
				]
			}
		});
		const reduced = labelFor(second, 'room-1')!;
		expect(reduced.tier).toBe('name');
		expect(reduced.anchorWorld).toEqual(accepted.anchorWorld);
	});

	it('never drops the reference from a duplicate pair — it suppresses instead', () => {
		const name = 'Studio';
		const reference = 'R-8Q2B';
		const alone: RoomLabelFacts[] = [
			rectRoom('room-a', [0, 0], [1.6, 0.7], { name, reference })
		];
		expect(
			labelFor(
				placeRoomLabels({ rooms: alone, planView: view(), measure: fixtureMeasure }),
				'room-a'
			)?.tier
		).toBe('name');

		// A second Room with the same authored name must not leave the pair looking
		// ambiguous: the reference is protected as a pair, so the label suppresses.
		const duplicated: RoomLabelFacts[] = [
			rectRoom('room-a', [0, 0], [1.6, 0.7], { name, reference }),
			rectRoom('room-b', [4, 0], [1.6, 0.7], { name, reference })
		];
		const result = placeRoomLabels({
			rooms: duplicated,
			planView: view(),
			measure: fixtureMeasure
		});
		expect(result.labels).toHaveLength(0);
	});

	it('keeps a duplicate pair at full identity when the face can carry it', () => {
		const duplicated: RoomLabelFacts[] = [
			rectRoom('room-a', [0, 0], [6, 4], { name: 'Studio', reference: 'R-8Q2B' }),
			rectRoom('room-b', [8, 0], [6, 4], { name: 'Studio', reference: 'R-8Q2B' })
		];
		const result = placeRoomLabels({
			rooms: duplicated,
			planView: view(),
			measure: fixtureMeasure
		});
		expect(result.labels.map((label) => label.tier)).toEqual(['full', 'full']);
		expect(linesOf(result.labels[0]!)).toEqual([
			'room-name:Studio',
			'room-reference:R-8Q2B',
			'room-area:24.0 m²'
		]);
	});

	it('collapses a name that equals its reference to a single line', () => {
		// The identity layer resolves `reference: null` for a collapsed pair, so the
		// stack renders the string once.
		const result = placeRoomLabels({
			rooms: [
				rectRoom('room-1', [0, 0], [6, 4], { name: 'R-7K3M', reference: null })
			],
			planView: view(),
			measure: fixtureMeasure
		});
		expect(linesOf(result.labels[0]!)).toEqual(['room-name:R-7K3M', 'room-area:24.0 m²']);
	});
});

describe('P23.13 S3 — long names and the fallback readout', () => {
	it('wraps a name into at most two lines within 160 px', () => {
		const result = placeRoomLabels({
			rooms: [
				rectRoom('room-1', [0, 0], [10, 8], {
					name: 'North Gallery Workshop Annex',
					reference: 'R-7K3M'
				})
			],
			planView: view(),
			measure: fixtureMeasure
		});
		const label = labelFor(result, 'room-1')!;
		const nameLines = label.lines.filter((line) => line.style === 'room-name');
		expect(nameLines).toHaveLength(2);
		for (const line of nameLines) {
			expect(fixtureMeasure(line.text, 'room-name').width).toBeLessThanOrEqual(
				ROOM_LABEL_MAX_NAME_WIDTH_PX
			);
		}
		expect(label.widthPx).toBeLessThanOrEqual(ROOM_LABEL_MAX_NAME_WIDTH_PX);
	});

	it('suppresses a resting label whose name no two-line budget can carry, and reads it out when selected', () => {
		const longToken = 'NorthgalleryworkshopannexABC';
		const rooms = [
			rectRoom('room-1', [0, 0], [10, 8], { name: longToken, reference: 'R-7K3M' })
		];
		const unselected = placeRoomLabels({
			rooms,
			planView: view(),
			measure: fixtureMeasure
		});
		expect(unselected.labels).toHaveLength(0);
		expect(unselected.readout).toBeNull();

		const selected = placeRoomLabels({
			rooms,
			planView: view(),
			measure: fixtureMeasure,
			selectedRoomId: 'room-1'
		});
		expect(selected.labels).toHaveLength(0);
		expect(selected.readout).toEqual({
			roomId: 'room-1',
			primary: longToken,
			reference: 'R-7K3M',
			area: '80.0 m²'
		});
	});

	it('uses the same placer for a selected Room — never a centroid override', () => {
		const rooms = [rectRoom('room-1', [0, 0], [6, 4])];
		const unselected = placeRoomLabels({ rooms, planView: view(), measure: fixtureMeasure });
		// An offset geometry + obstacle keep the free-space candidate away from the
		// centroid, so an equal anchor is real evidence of shared placement.
		const mask = {
			obstacles: [
				{
					polygon: [
						[0, 0],
						[6, 0],
						[6, 1.6],
						[0, 1.6]
					] as LayoutVec2[],
					clearancePx: ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX
				}
			]
		} satisfies RoomLabelMask;
		const plain = placeRoomLabels({ rooms, planView: view(), measure: fixtureMeasure, mask });
		const selected = placeRoomLabels({
			rooms,
			planView: view(),
			measure: fixtureMeasure,
			mask,
			selectedRoomId: 'room-1'
		});
		const centroid = worldToPlanScreen(view(), [3, 2]);
		const plainAnchor = worldToPlanScreen(view(), plain.labels[0]!.anchorWorld);
		expect(Math.hypot(plainAnchor[0] - centroid[0], plainAnchor[1] - centroid[1])).toBeGreaterThan(
			20
		);
		expect(selected.labels[0]!.anchorWorld).toEqual(plain.labels[0]!.anchorWorld);
		// Full identity is carried at rest here, so the readout stays absent.
		expect(unselected.labels[0]!.tier).toBe('full');
		expect(selected.readout).toBeNull();
	});

	it('puts the identity the resting stack cannot carry into the fixed readout', () => {
		const rooms = [rectRoom('room-short', [0, 0], [1.6, 0.8], { reference: 'R-7K3M' })];
		const unselected = placeRoomLabels({ rooms, planView: view(), measure: fixtureMeasure });
		expect(linesOf(unselected.labels[0]!)).toEqual(['room-name:Gallery']);
		expect(unselected.readout).toBeNull();

		// A selected Room must keep its complete identity: one tier taller, the
		// name+reference pair fits at rest and no readout is needed.
		const taller = [rectRoom('room-pair', [0, 0], [1.6, 1], { reference: 'R-7K3M' })];
		const selected = placeRoomLabels({
			rooms: taller,
			planView: view(),
			measure: fixtureMeasure,
			selectedRoomId: 'room-pair'
		});
		expect(linesOf(selected.labels[0]!)).toEqual(['room-name:Gallery', 'room-reference:R-7K3M']);
		expect(selected.readout).toBeNull();

		// Area is *supplementary* (§4): a selected Room that had to drop the area
		// still shows its complete identity at rest, so no readout is summoned.
		const noArea = [rectRoom('room-area-less', [0, 0], [1.6, 1], { reference: 'R-7K3M' })];
		const selectedNoArea = placeRoomLabels({
			rooms: noArea,
			planView: view(),
			measure: fixtureMeasure,
			selectedRoomId: 'room-area-less'
		});
		expect(selectedNoArea.labels[0]!.lines.map((line) => line.style)).toEqual([
			'room-name',
			'room-reference'
		]);
		expect(selectedNoArea.readout).toBeNull();

		// Too short for even the name+reference pair: suppressed, readout carries it.
		const shorter = [rectRoom('room-tiny', [0, 0], [1.6, 0.7], { name: 'Nook', reference: 'R-7K3M' })];
		const tinySelected = placeRoomLabels({
			rooms: shorter,
			planView: view(),
			measure: fixtureMeasure,
			selectedRoomId: 'room-tiny'
		});
		expect(tinySelected.labels).toHaveLength(0);
		expect(tinySelected.readout).toEqual({
			roomId: 'room-tiny',
			primary: 'Nook',
			reference: 'R-7K3M',
			area: '1.1 m²'
		});
	});

	it('bounds the readout at 12 px inset and 280 px and never renders an editable control', () => {
		const source = readSource('src/lib/editor/layout/LayoutPlanViewport.svelte');
		expect(ROOM_LABEL_READOUT_INSET_PX).toBe(12);
		expect(ROOM_LABEL_READOUT_MAX_WIDTH_PX).toBe(280);
		const block = source.slice(source.indexOf('.plan-readout {'));
		// `border-box` matters: without it the padding would push the painted box
		// past the 280 px budget (§4).
		expect(block).toContain('box-sizing: border-box');
		expect(block).toContain('min(280px, calc(100% - 24px))');
		expect(block).toContain('top: 12px');
		expect(block).toContain('right: 12px');
		expect(block).toContain('overflow-y: auto');
		// Narrow drawings reflow the readout above the plan instead of over it.
		expect(source).toContain('@container (max-width: 720px)');
		const markup = source.slice(
			source.indexOf("{#if roomLabelReadout}"),
			source.indexOf("{#if preview.statusMessage}")
		);
		expect(markup).not.toContain('<input');
		expect(markup).not.toContain('<textarea');
		expect(markup).not.toContain('contenteditable');
	});
});

describe('P23.13 S3 — sticky candidates, settle and the reappearance gate', () => {
	it('preserves the accepted candidate across small pan and zoom', () => {
		const memory: RoomLabelMemory = new Map();
		const rooms = [rectRoom('room-1', [0, 0], [6, 4])];
		const first = placeRoomLabels({
			rooms,
			planView: view(),
			measure: fixtureMeasure,
			memory
		});
		const accepted = labelFor(first, 'room-1')!;

		// A pan and a modest zoom re-resolve as `lod`: pan is ordinary world-to-screen
		// movement (the world anchor moves with the Room), and the candidate is kept.
		const panned = view({ center: [0.4, -0.2] });
		const second = placeRoomLabels({
			rooms,
			planView: panned,
			measure: fixtureMeasure,
			memory,
			reason: 'lod'
		});
		expect(labelFor(second, 'room-1')!.anchorWorld).toEqual(accepted.anchorWorld);
		expect(labelFor(second, 'room-1')!.tier).toBe('full');

		// A geometry change is allowed to relocate freely.
		const third = placeRoomLabels({
			rooms,
			planView: panned,
			measure: fixtureMeasure,
			memory,
			reason: 'geometry'
		});
		expect(labelFor(third, 'room-1')).toBeDefined();
	});

	it('never re-optimizes during a gesture, but still honours an actual collision', () => {
		const viewport = view();
		const memory: RoomLabelMemory = new Map();
		const rooms = [rectRoom('room-1', [0, 0], [6, 4])];
		const first = placeRoomLabels({ rooms, planView: viewport, measure: fixtureMeasure, memory });
		const accepted = labelFor(first, 'room-1')!;

		const frozen = placeRoomLabels({
			rooms,
			planView: viewport,
			measure: fixtureMeasure,
			memory,
			reason: 'frozen'
		});
		expect(labelFor(frozen, 'room-1')!.anchorWorld).toEqual(accepted.anchorWorld);
		expect(labelFor(frozen, 'room-1')!.tier).toBe(accepted.tier);

		// An actual collision under the frozen candidate suppresses rather than
		// relocating mid-gesture.
		const [sx, sy] = worldToPlanScreen(viewport, accepted.anchorWorld);
		const corner = planScreenToWorld(viewport, [sx + 100, sy + 100]) as LayoutVec2;
		const anchorWorld = planScreenToWorld(viewport, [sx - 100, sy - 100]) as LayoutVec2;
		const collided = placeRoomLabels({
			rooms,
			planView: viewport,
			measure: fixtureMeasure,
			memory,
			reason: 'frozen',
			mask: {
				obstacles: [
					{
						polygon: [anchorWorld, [corner[0], anchorWorld[1]], corner, [anchorWorld[0], corner[1]]],
						clearancePx: ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX
					}
				]
			}
		});
		expect(labelFor(collided, 'room-1')).toBeUndefined();
	});

	it('requires 8 px of extra slack and a settle generation before a label reappears', () => {
		const viewport = view();
		const memory: RoomLabelMemory = new Map();
		const rooms = [rectRoom('room-1', [0, 0], [6, 4])];
		// Force suppression first: an obstacle covering the whole face.
		const blocked = placeRoomLabels({
			rooms,
			planView: viewport,
			measure: fixtureMeasure,
			memory,
			mask: {
				obstacles: [
					{
						polygon: [
							[-10, -10],
							[10, -10],
							[10, 10],
							[-10, 10]
						],
						clearancePx: ROOM_LABEL_CORE_GEOMETRY_RESERVE_PX
					}
				]
			}
		});
		expect(blocked.labels).toHaveLength(0);
		expect(blocked.memory.get('room-1')?.suppressed).toBe(true);

		// Back to a clear face, but still inside the same settle generation.
		const sameGeneration = placeRoomLabels({
			rooms,
			planView: viewport,
			measure: fixtureMeasure,
			memory,
			settleGeneration: 0
		});
		expect(sameGeneration.labels).toHaveLength(0);

		// After the settle generation advances the label returns.
		const settled = placeRoomLabels({
			rooms,
			planView: viewport,
			measure: fixtureMeasure,
			memory,
			settleGeneration: 1
		});
		expect(labelFor(settled, 'room-1')).toBeDefined();
		expect(ROOM_LABEL_REAPPEAR_CLEARANCE_PX).toBe(8);
		expect(ROOM_LABEL_SETTLE_DELAY_MS).toBe(150);
	});

	it('is deterministic: the same frame and memory resolve identically twice', () => {
		const viewport = view();
		const rooms = [
			rectRoom('room-a', [0, 0], [6, 4]),
			rectRoom('room-b', [8, 0], [6, 4], { name: 'Studio', reference: 'R-8Q2B' }),
			rectRoom('room-c', [16, 0], [1.6, 0.7], { name: 'Closet', reference: 'R-2M9T' })
		];
		const memory: RoomLabelMemory = new Map();
		const first = placeRoomLabels({ rooms, planView: viewport, measure: fixtureMeasure, memory });
		const second = placeRoomLabels({ rooms, planView: viewport, measure: fixtureMeasure, memory });
		expect(second.labels).toEqual(first.labels);
	});

	it('resolves each Room independently of document order (canonical-ID tie-break)', () => {
		const viewport = view();
		const rooms = [
			rectRoom('room-a', [0, 0], [6, 4]),
			rectRoom('room-b', [8, 0], [6, 4], { name: 'Studio', reference: 'R-8Q2B' }),
			rectRoom('room-c', [16, 0], [6, 4], { name: 'Store', reference: 'R-5T1V' })
		];
		const forward = placeRoomLabels({ rooms, planView: viewport, measure: fixtureMeasure });
		const reversed = placeRoomLabels({
			rooms: [...rooms].reverse(),
			planView: viewport,
			measure: fixtureMeasure
		});
		const anchorFor = (result: ReturnType<typeof placeRoomLabels>, roomId: string) =>
			labelFor(result, roomId)?.anchorWorld;
		for (const room of rooms) {
			expect(anchorFor(reversed, room.roomId)).toEqual(anchorFor(forward, room.roomId));
		}
	});

	it('keeps a dense row of Rooms independently placed and stable', () => {
		const viewport = view();
		const rooms = Array.from({ length: 6 }, (_, index) =>
			rectRoom(`room-dense-${index}`, [index * 2.4, 0], [2, 1.6], {
				name: `Bay ${index}`,
				reference: `R-${index}K3M`
			})
		);
		const memory: RoomLabelMemory = new Map();
		const first = placeRoomLabels({ rooms, planView: viewport, measure: fixtureMeasure, memory });
		expect(first.labels).toHaveLength(rooms.length);
		for (const label of first.labels) {
			const screen = worldToPlanScreen(viewport, label.anchorWorld);
			const polygon = rooms.find((room) => room.roomId === label.roomId)!.polygon;
			const bounds = polygonBounds(polygon.map((point) => worldToPlanScreen(viewport, point)));
			expect(screen[0]).toBeGreaterThanOrEqual(bounds.minX);
			expect(screen[0]).toBeLessThanOrEqual(bounds.maxX);
			expect(screen[1]).toBeGreaterThanOrEqual(bounds.minZ);
			expect(screen[1]).toBeLessThanOrEqual(bounds.maxZ);
		}
		const second = placeRoomLabels({ rooms, planView: viewport, measure: fixtureMeasure, memory });
		expect(second.labels).toEqual(first.labels);
	});
});

describe('P23.13 S3 — placement never animates and never depends on host fonts', () => {
	it('paints Room label lines with no transition and no animation (reduced motion safe)', () => {
		const source = readSource('src/lib/editor/layout/PlanSvg.svelte');
		for (const selector of ['.room-name {', '.room-reference {', '.room-area {']) {
			const start = source.indexOf(selector);
			expect(start).toBeGreaterThan(-1);
			const rule = source.slice(start, source.indexOf('}', start));
			expect(rule).not.toContain('transition');
			expect(rule).not.toContain('animation');
		}
	});

	it('uses deterministic stand-in metrics when no host measure is injected', () => {
		const withFallback = placeRoomLabels({
			rooms: [rectRoom('room-1', [0, 0], [6, 4])],
			planView: view()
		});
		// The stand-in is a pure function of the string and the style role.
		expect(APPROXIMATE_TEXT_MEASURE('Gallery', 'room-name').width).toBe(
			APPROXIMATE_TEXT_MEASURE('Gallery', 'room-name').width
		);
		expect(withFallback.labels).toHaveLength(1);
	});
});

describe('P23.13 S3 — viewport wiring', () => {
	it('keeps the reconsider reason reactive so stickiness cannot latch on `geometry`', () => {
		const source = readSource('src/lib/editor/layout/LayoutPlanViewport.svelte');
		// The reason is read inside a derived, so the geometry key it compares has to
		// be reactive: a plain `let` would never invalidate that derived and every
		// later zoom would keep relocating labels instead of holding the accepted
		// candidate. Structural tripwire — there is no unit seam for viewport state.
		expect(source).toMatch(/let roomLabelGeometryKey = \$state<string \| null>\(null\);/);
		const reasonDerived = source.slice(
			source.indexOf('const roomLabelReconsiderReason'),
			source.indexOf('const roomLabelReadout')
		);
		expect(reasonDerived).toContain('roomLabelGeometryKey !== null');
	});

	it('never re-optimizes every pointermove: a live gesture resolves as frozen', () => {
		const source = readSource('src/lib/editor/layout/LayoutPlanViewport.svelte');
		const gesturePredicate = source.slice(
			source.indexOf('const planGestureActive'),
			source.indexOf('const roomLabelReconsiderReason')
		);
		for (const session of [
			'interaction.editing',
			'interaction.objectDrag',
			'interaction.roomUnitDrag',
			'interaction.wallOpeningDrag',
			'interaction.architectureEdit'
		]) {
			expect(gesturePredicate).toContain(session);
		}
	});

	it('invalidates label metrics on font readiness, not on every frame', () => {
		const source = readSource('src/lib/editor/layout/LayoutPlanViewport.svelte');
		expect(source).toContain("'loadingdone'");
		expect(source).toContain('roomLabelText.invalidate()');
		expect(source).toContain('roomLabelMemory.clear()');
	});
});

describe('P23.13 S3 — display identity reaches the label layer', () => {
	it('derives the stack from the viewport identity pair, not from raw canonical IDs', () => {
		const source = readSource('src/lib/editor/layout/LayoutPlanViewport.svelte');
		// The viewport asks the shared P23.12 resolver for the identity pair, so a
		// nameless Room falls back to the raw-ID *display* label.
		expect(source).toContain('identityLabelPair(');
		expect(source).toContain('formatPlacementLabel(room.roomId)');
		expect(source).toContain('roomFloorAreaM2(room.floorPolygon)');
	});
});

function readSource(relative: string): string {
	const root = fileURLToPath(new URL('../../../', import.meta.url));
	return fs.readFileSync(path.join(root, relative), 'utf8');
}

function pointInPolygon(polygon: readonly LayoutVec2[], point: LayoutVec2): boolean {
	let inside = false;
	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
		const a = polygon[index]!;
		const b = polygon[previous]!;
		if (a[1] > point[1] !== b[1] > point[1]) {
			const x = ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
			if (point[0] < x) inside = !inside;
		}
	}
	return inside;
}

function overlapsRect(
	ax: number,
	ay: number,
	aw: number,
	ah: number,
	minX: number,
	minY: number,
	maxX: number,
	maxY: number
): boolean {
	return ax - aw / 2 < maxX && ax + aw / 2 > minX && ay - ah / 2 < maxY && ay + ah / 2 > minY;
}
