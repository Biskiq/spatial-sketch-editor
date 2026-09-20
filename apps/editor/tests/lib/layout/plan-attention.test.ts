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
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-compat';
import { compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-codec';
import type { LayoutVec2 } from '$lib/layout/layout-types';
import {
	buildPlanRenderModel,
	type PlanInteractionProjection,
	type PlanPolygonPrimitive,
	type PlanPresentationSource,
	type PlanRenderModel,
	type PlanRenderPrimitive
} from '$lib/layout/plan-render-model';
import { planSvgRule, renderPlanSvg } from '../../helpers/plan-render-harness';

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
	// A token with no class entry and no CSS rule is invisible ink — the failure a
	// plate would have caught. These claims used to be slices of `PlanSvg.svelte`'s
	// source text, which could not see whether the class was ever *emitted*; they
	// are now driven through `plan-render-harness`: the shipped component rendered
	// through its own props, plus the Svelte compiler's own stylesheet.
	//
	// The third claim of this row — "per-footprint Scene ink is read before the
	// regime value" — moved to its A6 owner (`plan-scene-paint`, §S8/
	// §1.12), where one footprint inside the live zone dims to the zone value
	// while the others keep the regime value. That test fails if the per-primitive
	// source is dropped, which the source slice could never establish.

	/** An empty plan plus this slice's interaction ink: one wash draft, one reason. */
	function inkModel(): PlanRenderModel {
		const document: LayoutDocumentWallFirst = {
			units: 'meters',
			formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
			floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
			junctions: [],
			walls: [],
			openings: [],
			rooms: [],
			objects: []
		};
		const interaction: PlanInteractionProjection = {
			selection: [],
			handles: [],
			drafts: [
				{
					kind: 'polygon',
					key: 'wash',
					points: [
						[0, 0],
						[2, 0],
						[2, 2],
						[0, 2]
					],
					style: 'closure-wash'
				}
			],
			labels: [
				{
					kind: 'text',
					key: 'reason',
					anchor: [1, 1],
					text: 'Needs a closed room',
					style: 'refusal-reason'
				}
			]
		};
		return buildPlanRenderModel(
			compileWallFirstLayoutGeometry(document).geometry,
			undefined,
			interaction
		);
	}

	it('maps the S8 tokens to a class and gives each one ink', () => {
		const rendered = renderPlanSvg({ model: inkModel() });
		const wash = rendered.find((element) => element.classes.includes('closure-wash'));
		const reason = rendered.find((element) => element.classes.includes('refusal-reason'));
		expect(wash?.tag).toBe('polygon');
		expect(reason?.tag).toBe('text');
		expect(reason?.text).toBe('Needs a closed room');
		// …and each emitted class is actually painted, read from the compiler's
		// stylesheet rather than from a regex over the file's text. Only the
		// declaration is asserted: the refusal ink's *value* is an owner-open
		// decision this refactor does not ratify.
		expect(planSvgRule('.closure-wash').fill).toBeTruthy();
		expect(planSvgRule('.refusal-reason').fill).toBeTruthy();
	});

	it('routes every style token through the class table rather than its own name', () => {
		// Both S8 tokens map to themselves, so their assertions above cannot tell a
		// consulted table from the identity fallback. A token whose class differs
		// from its style name is the proof that the table is what the renderer
		// reads — the failure mode that would make a *renamed* future token paint
		// as unstyled ink.
		const model = inkModel();
		const drafts = model.layers.find((entry) => entry.order === 12)!;
		const [wash] = drafts.primitives;
		const renamed: PlanRenderModel = {
			...model,
			layers: model.layers.map((layer) =>
				layer.order === 12
					? {
							...layer,
							primitives: [
								{ ...(wash as PlanPolygonPrimitive), style: 'opening-drag-preview-invalid' as const }
							]
						}
					: layer
			)
		};
		const emitted = renderPlanSvg({ model: renamed }).find((element) =>
			element.classes.includes('opening-drag-preview')
		);
		expect(emitted?.classes).toEqual(['opening-drag-preview', 'invalid']);
	});

	it('paints a polygon in the drafts layer, so the closure wash is not dead ink', () => {
		const layer = inkModel().layers.find((entry) => entry.order === 12);
		const drafts: PlanRenderPrimitive[] = layer ? [...layer.primitives] : [];
		expect(drafts).toHaveLength(1);
		expect(drafts[0]).toMatchObject({ kind: 'polygon', style: 'closure-wash' });
		// The same primitive reaches the markup as a polygon element, so layer
		// assignment and emission are proven together rather than in halves.
		expect(
			renderPlanSvg({ model: inkModel() }).filter((element) =>
				element.classes.includes('closure-wash')
			)
		).toHaveLength(1);
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
