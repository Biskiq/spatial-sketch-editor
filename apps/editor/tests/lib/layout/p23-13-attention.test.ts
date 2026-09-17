import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	createPlanViewportState,
	worldToPlanScreen,
	type PlanViewportState
} from '$lib/editor/layout/layout-plan-transform';
import {
	APPROXIMATE_TEXT_MEASURE,
	ROOM_LABEL_TEXT_STYLES,
	placeRoomLabels,
	roomFloorAreaM2,
	type RoomLabelFacts,
	type TextMeasure
} from '$lib/editor/layout/plan-room-labels';
import {
	PLAN_ATTENTION_MAX_RADIUS_PX,
	PLAN_ATTENTION_PAD_PX,
	PLAN_ATTENTION_RESTORE_MS,
	PLAN_SCENE_INK_IN_ZONE,
	planAttentionLabelTierDrop,
	planAttentionZoneAt,
	resolvePlanAttentionZone,
	withPlanAttentionSceneInk
} from '$lib/editor/layout/plan-attention';
import type { LayoutVec2 } from '$lib/layout/layout-types';
import type {
	PlanPolygonPrimitive,
	PlanPresentationSource
} from '$lib/layout/plan-render-model';

/**
 * P23.13 S8 / §1.12 — the instrument zone.
 *
 * Local and quiet: a pad around the active handle, a cap so it can never become
 * a spotlight, a settle window that restores everything, and a *region-scoped*
 * tier ceiling — a label outside the zone never notices the zone exists.
 */

const CHAR_PX = 6;
const fixtureMeasure: TextMeasure = (text, style) => ({
	width: text.length * CHAR_PX,
	height: ROOM_LABEL_TEXT_STYLES[style].lineHeightPx
});

function view(overrides: Partial<PlanViewportState> = {}): PlanViewportState {
	return { ...createPlanViewportState(), ...overrides };
}

function rectRoom(roomId: string, at: LayoutVec2, size: LayoutVec2): RoomLabelFacts {
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
		name: 'Gallery',
		reference: 'R-7K3M',
		areaM2: roomFloorAreaM2(polygon)
	};
}

function linesOf(result: ReturnType<typeof placeRoomLabels>, roomId: string): string[] {
	const label = result.labels.find((entry) => entry.roomId === roomId);
	return label ? label.lines.map((line) => line.style) : [];
}

describe('P23.13 S8 attention zone geometry', () => {
	it('pads the locus by the ratified 64 px and reports its own radius', () => {
		const planView = view();
		const locusPx = worldToPlanScreen(planView, [0, 0]);
		const zone = resolvePlanAttentionZone({ view: planView, locus: [0, 0], atMs: 10 });
		expect(zone.minX).toBeCloseTo(locusPx[0] - PLAN_ATTENTION_PAD_PX, 6);
		expect(zone.maxX).toBeCloseTo(locusPx[0] + PLAN_ATTENTION_PAD_PX, 6);
		expect(zone.minY).toBeCloseTo(locusPx[1] - PLAN_ATTENTION_PAD_PX, 6);
		expect(zone.maxY).toBeCloseTo(locusPx[1] + PLAN_ATTENTION_PAD_PX, 6);
		expect(zone.radiusPx).toBeCloseTo(PLAN_ATTENTION_PAD_PX, 6);
		expect(zone.touchedAtMs).toBe(10);
	});

	it('grows with the annotation but is capped at 180 px from the locus', () => {
		const planView = view();
		const locusPx = worldToPlanScreen(planView, [0, 0]);
		const zone = resolvePlanAttentionZone({
			view: planView,
			locus: [0, 0],
			// A second point 10 m away: far outside the cap on the +x side.
			bounds: [[10, 0]],
			atMs: 0
		});
		expect(zone.maxX).toBeCloseTo(locusPx[0] + PLAN_ATTENTION_MAX_RADIUS_PX, 6);
		expect(zone.maxY).toBeCloseTo(locusPx[1] + PLAN_ATTENTION_PAD_PX, 6);
		expect(zone.radiusPx).toBeCloseTo(PLAN_ATTENTION_MAX_RADIUS_PX, 6);
	});

	it('settles 150 ms after the last touch, and a backwards clock never settles it', () => {
		const zone = resolvePlanAttentionZone({ view: view(), locus: [0, 0], atMs: 1_000 });
		expect(planAttentionZoneAt(zone, 1_000)).not.toBeNull();
		expect(planAttentionZoneAt(zone, 1_000 + PLAN_ATTENTION_RESTORE_MS - 1)).not.toBeNull();
		expect(planAttentionZoneAt(zone, 1_000 + PLAN_ATTENTION_RESTORE_MS)).toBeNull();
		expect(planAttentionZoneAt(zone, 0)).not.toBeNull();
		expect(planAttentionZoneAt(null, 0)).toBeNull();
	});

	it('hands the placer a region and a pair-safe ceiling', () => {
		expect(planAttentionLabelTierDrop(null)).toBeNull();
		const zone = resolvePlanAttentionZone({ view: view(), locus: [0, 0], atMs: 0 });
		expect(planAttentionLabelTierDrop(zone)).toEqual({
			minX: zone.minX,
			minY: zone.minY,
			maxX: zone.maxX,
			maxY: zone.maxY,
			ceiling: 'name-reference'
		});
	});
});

describe('P23.13 S8 attention suppression in the Room label placer', () => {
	function place(tierDropZone?: Parameters<typeof placeRoomLabels>[0]['tierDropZone']) {
		return placeRoomLabels({
			rooms: [rectRoom('room-1', [0, 0], [6, 4])],
			planView: view(),
			measure: fixtureMeasure,
			reason: 'lod',
			...(tierDropZone ? { tierDropZone } : {})
		});
	}

	it('drops area → reference for a label inside the zone (pair-safe)', () => {
		// No zone: the full stack rests, area included.
		expect(linesOf(place(), 'room-1')).toEqual(['room-name', 'room-reference', 'room-area']);
		// A zone over the whole paper: the area line goes, name + reference stay
		// together (a duplicate pair is never split).
		const zoned = place({ minX: -10_000, minY: -10_000, maxX: 10_000, maxY: 10_000, ceiling: 'name-reference' });
		expect(linesOf(zoned, 'room-1')).toEqual(['room-name', 'room-reference']);
	});

	it('changes nothing outside the zone', () => {
		const elsewhere = place({ minX: 10_000, minY: 10_000, maxX: 20_000, maxY: 20_000, ceiling: 'name-reference' });
		expect(linesOf(elsewhere, 'room-1')).toEqual(['room-name', 'room-reference', 'room-area']);
	});

	it('never drops the label itself: the reduced stack has to fit where the fuller one fits', () => {
		// Same room, same zone, deterministic metrics: the reduced tier still
		// rests. A zone is a quieting preference, not a licence to lose a label.
		const zoned = place({ minX: -10_000, minY: -10_000, maxX: 10_000, maxY: 10_000, ceiling: 'name-reference' });
		expect(zoned.labels).toHaveLength(1);
	});
});

describe('P23.13 S8 region-scoped Scene ink', () => {
	const footprint = (
		key: string,
		points: LayoutVec2[]
	): PlanPolygonPrimitive => ({
		kind: 'polygon',
		key,
		points,
		style: 'scene-footprint'
	});

	function source(sceneInk: number): PlanPresentationSource {
		return { decisionsFor: () => ({}), sceneInk };
	}

	it('is the identity source when no instrument is live', () => {
		const base = source(0.3);
		expect(withPlanAttentionSceneInk(base, view(), null)).toBe(base);
	});

	it('dims only the footprints inside the zone and leaves the rest at the regime value', () => {
		const planView = view();
		const zone = resolvePlanAttentionZone({ view: planView, locus: [0, 0], atMs: 0 });
		const wrapped = withPlanAttentionSceneInk(source(0.3), planView, zone);
		// A 1 m footprint at the locus sits inside; one 20 m away does not.
		const inside = footprint('in', [
			[-0.5, -0.5],
			[0.5, 0.5]
		]);
		const outside = footprint('out', [
			[19, 19],
			[21, 21]
		]);
		expect(wrapped.sceneInkFor?.(inside)).toBe(PLAN_SCENE_INK_IN_ZONE);
		expect(wrapped.sceneInkFor?.(outside)).toBe(0.3);
	});

	it('reads 10% inside the zone whatever the regime, and never brightens anything', () => {
		const planView = view();
		const zone = resolvePlanAttentionZone({ view: planView, locus: [0, 0], atMs: 0 });
		const inside = footprint('in', [
			[-0.5, -0.5],
			[0.5, 0.5]
		]);
		// §1.12 states an absolute value: normal/near 30% and far 15% both land on
		// the zone's 10%.
		expect(withPlanAttentionSceneInk(source(0.3), planView, zone).sceneInkFor?.(inside)).toBe(
			PLAN_SCENE_INK_IN_ZONE
		);
		expect(withPlanAttentionSceneInk(source(0.15), planView, zone).sceneInkFor?.(inside)).toBe(
			PLAN_SCENE_INK_IN_ZONE
		);
		// The one guard on top of the value: a regime dimmer than the zone keeps its
		// own ink — the zone quiets context and must never brighten any.
		expect(withPlanAttentionSceneInk(source(0.05), planView, zone).sceneInkFor?.(inside)).toBe(0.05);
	});
});

describe('P23.13 S8 paint contract (tokens reach the renderer)', () => {
	// The plates the earlier slices used to eyeball paint cannot run in this
	// `node` suite, so the link that *can* silently break is pinned as a source
	// contract instead: a token with no class entry and no CSS rule is invisible
	// ink, which is exactly what a plate would have caught.
	const here = path.dirname(fileURLToPath(import.meta.url));
	const svg = fs.readFileSync(
		path.resolve(here, '../../../src/lib/editor/layout/PlanSvg.svelte'),
		'utf8'
	);

	it('maps the S8 tokens to a class and gives each one ink', () => {
		expect(svg).toContain("'closure-wash': 'closure-wash'");
		expect(svg).toContain("'refusal-reason': 'refusal-reason'");
		expect(svg).toMatch(/\.closure-wash \{[^}]*fill:/);
		expect(svg).toMatch(/\.refusal-reason \{[^}]*fill:/);
	});

	it('paints a polygon in the drafts layer, so the closure wash is not dead ink', () => {
		expect(svg).toContain("primitive.kind === 'polygon'");
		expect(svg).toContain('class={tokenClass(primitive.style)} points={pointsAttr(primitive.points)}');
	});

	it('reads the per-footprint Scene ink before the regime value', () => {
		expect(svg).toContain('presentation.sceneInkFor?.(primitive) ?? presentation.sceneInk');
	});
});

describe('P23.13 S8 attention wiring (source contract)', () => {
	const here = path.dirname(fileURLToPath(import.meta.url));
	const viewport = fs.readFileSync(
		path.resolve(here, '../../../src/lib/editor/layout/LayoutPlanViewport.svelte'),
		'utf8'
	);

	it('re-stamps the zone per frame and restores it on settle', () => {
		expect(viewport).toContain('touchPlanAttention(');
		expect(viewport).toContain('PLAN_ATTENTION_RESTORE_MS');
		expect(viewport).toContain('planAttentionZoneAt(attentionZone, Date.now())');
	});

	it('passes the ceiling into the label context rather than suppressing labels itself', () => {
		expect(viewport).toContain('tierDropZone: planAttentionLabelTierDrop(activeAttentionZone) ?? undefined');
	});

	it('wraps the salience snapshot with the zone instead of rewriting it', () => {
		expect(viewport).toContain('withPlanAttentionSceneInk(planSalience, interaction.planView, activeAttentionZone)');
		expect(viewport).toContain('presentation={planPresentation}');
	});
});
