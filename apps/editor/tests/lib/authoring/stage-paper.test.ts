/**
 * R217.S04 — Paper Plan: the drawing is the Plan, and it is the same Plan that
 * picks.
 *
 * These are pure-data claims. Every fixture is a real current-format Layout
 * compiled by the canonical compiler and evaluated by `evaluateLayoutPlan`;
 * Scene footprints come from the same `buildPlanSceneFootprintProjection` the
 * Stage uses. The suite proves four things no type check can see:
 *
 * 1. **Drawn equals picked** — the drawn source/stream set is exactly the
 *    eligible-fragment set, and every drawn Scene footprint resolves to its
 *    entity through the Scene Plan hit policy.
 * 2. **Stream treatment follows the representation** — cut walls are poché,
 *    a below-cut Wall is dashed hidden ink, a lintel above the cut is projected,
 *    an Opening is a symbol, and a revealed source is drawn.
 * 3. **Tilted forms use the existing polygon union** — the outline is the union
 *    boundary, not every triangle edge.
 * 4. **Appearance is a camera/layer fact** — Paper and Shaded use layer masks,
 *    no Paper module writes `Object3D.visible`, and Paper is the default.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../../helpers/import-closure';
import { Layers, Mesh } from 'three';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	eligiblePlanFragments,
	evaluateLayoutPlan,
	planCreateWallFirstOpening,
	planWallChain,
	setWorkObserver,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type PlanEvaluation,
	type PlanFragment,
	type PlanParameters
} from '@portfolio/layout-core';
import type { SceneDocument, SceneEntity } from '$lib/content/scene';
import {
	buildPlanSceneFootprintProjection,
	planSceneFootprintsFor,
	type PlanSceneProjection
} from '$lib/authoring/scene/plan-scene-footprint';
import { resolvePlanSceneHit } from '$lib/authoring/scene/plan-scene-hit';
import { createPaperScene } from '$lib/authoring/stage/paper-scene';
import { createPaperMarkScene } from '$lib/authoring/stage/paper-marks';
import {
	buildPaperPlan,
	fragmentLayer,
	fragmentTreatment,
	isPaperPlanVisible,
	MAT_BACKGROUND_INK,
	MAT_GROUND_INK,
	PAPER_GROUND_INK,
	PAPER_LAYER,
	PAPER_LINE_STYLE,
	stageCameraLayerMask,
	unionOutline,
	STAGE_OVERLAY_LAYER,
	STAGE_WORLD_LAYER
} from '$lib/authoring/stage/paper-plan';
import { STARTER_ENCLOSURE_POINTS } from '$lib/authoring/stage/starter-gallery';
import { DEFAULT_APP_PREFERENCES } from '$lib/platform/app-preferences';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

type Fixture = { readonly compiled: CompiledLayoutGeometry; readonly document: LayoutDocumentWallFirst };

function enclosure(points: readonly LayoutVec2[]): Fixture {
	const baseline = createEmptyWallFirstLayoutDocument();
	const planned = planWallChain({
		baseline,
		points: points.map((point) => [point[0], point[1]] as LayoutVec2),
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id
	});
	if (planned.kind !== 'success') throw new Error(`the envelope no longer plans: ${planned.rejection.code}`);
	return { compiled: compileWallFirstLayoutGeometry(planned.document).geometry, document: planned.document };
}

function standaloneWall(): Fixture {
	const baseline = createEmptyWallFirstLayoutDocument();
	const planned = planWallChain({
		baseline,
		points: [[0, 0], [4, 0]],
		close: false,
		capture: freshCapture(),
		levelId: baseline.floor.id
	});
	if (planned.kind !== 'success') throw new Error(`the standalone Wall no longer plans: ${planned.rejection.code}`);
	return { compiled: compileWallFirstLayoutGeometry(planned.document).geometry, document: planned.document };
}

const L_POINTS: readonly LayoutVec2[] = [
	[0, 0],
	[6, 0],
	[6, 3],
	[3, 3],
	[3, 6],
	[0, 6]
];

function withDoor(fixture: Fixture): Fixture {
	const layout = fixture.document;
	const door = planCreateWallFirstOpening(
		layout,
		{ wallId: layout.walls[0]!.id, kind: 'door', offset: 1, width: 0.9, height: 2.1, sillHeight: 0 },
		freshCapture(),
		layout.floor.id
	);
	if (door.kind !== 'success') throw new Error(`the door no longer plans: ${door.rejection.code}`);
	return { compiled: compileWallFirstLayoutGeometry(door.document).geometry, document: door.document };
}

function withLowWalls(fixture: Fixture, height: number): Fixture {
	const document: LayoutDocumentWallFirst = {
		...fixture.document,
		walls: fixture.document.walls.map((wall) => ({ ...wall, height }))
	};
	return { compiled: compileWallFirstLayoutGeometry(document).geometry, document };
}

function evaluate(
	compiled: CompiledLayoutGeometry,
	overrides: Partial<PlanParameters> = {},
	datumMeters = 0
): PlanEvaluation {
	const bounds = compiled.bounds;
	const target: LayoutVec2 =
		bounds === null ? [0, 0] : [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[2] + bounds.max[2]) / 2];
	const result = evaluateLayoutPlan(
		compiled,
		{
			cutHeightMeters: 1.2,
			depthMeters: 100,
			lateralSpanHalfWidthMeters: null,
			sourceKindFilter: null,
			reveal: [],
			...overrides
		},
		{ generationId: 'generation-paper', target, datumMeters }
	);
	if (result.kind !== 'evaluated') throw new Error(`the fixture Plan did not evaluate: ${JSON.stringify(result.issues)}`);
	return result.plan;
}

const EMPTY_PROJECTION: PlanSceneProjection = { footprints: [] };

function drawnSourceStreams(drawing: ReturnType<typeof buildPaperPlan>): Set<string> {
	const drawn = new Set<string>();
	for (const line of drawing.lines) drawn.add(`${line.sourceId}::${line.stream}`);
	for (const fill of drawing.fills) drawn.add(`${fill.sourceId}::${fill.treatment === 'room-floor' ? 'projected' : 'cut'}`);
	return drawn;
}

function eligibleSourceStreams(fragments: readonly PlanFragment[]): Set<string> {
	return new Set(fragments.map((fragment) => `${fragment.ref.sourceId}::${fragment.ref.stream}`));
}

function primitive(id: string, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]): SceneEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name: id,
		dimensions: { width: 1, height: 1.6, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position,
		rotation
	};
}

function form(id: string, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]): SceneEntity {
	return {
		kind: 'form',
		id,
		name: id,
		position,
		rotation,
		form: {
			generator: {
				kind: 'extrude',
				plane: 'plan',
				outline: [
					{ key: 1, u: 0, v: 0, smooth: false },
					{ key: 2, u: 1, v: 0, smooth: false },
					{ key: 3, u: 1, v: 1, smooth: false },
					{ key: 4, u: 0, v: 1, smooth: false }
				],
				extent: 1
			},
			scale: [1, 1, 1],
			nextKey: 5
		},
		materialId: 'paper-aged',
		castShadow: true,
		receiveShadow: true
	};
}

function projectionOf(entities: SceneEntity[]): PlanSceneProjection {
	return buildPlanSceneFootprintProjection({ entities } as Pick<SceneDocument, 'entities'>);
}

describe('Paper Plan — drawn equals picked', () => {
	const fixtures: ReadonlyArray<readonly [string, Fixture]> = [
		['the starter enclosure', enclosure(STARTER_ENCLOSURE_POINTS)],
		['the L enclosure', enclosure(L_POINTS)]
	];

	it.each(fixtures)('draws exactly the eligible fragments on %s', (_name, fixture) => {
		const plan = evaluate(fixture.compiled);
		const drawing = buildPaperPlan(plan, fixture.compiled, EMPTY_PROJECTION);
		const eligible = eligiblePlanFragments(plan);
		expect(eligible.length).toBeGreaterThan(0);
		expect(drawnSourceStreams(drawing)).toEqual(eligibleSourceStreams(eligible));

		// Every drawn entry names a fragment the provider can return, and its layer is
		// the rank the provider reports for that fragment.
		const bySourceStream = new Map(eligible.map((fragment) => [`${fragment.ref.sourceId}::${fragment.ref.stream}`, fragment]));
		for (const line of drawing.lines) {
			const fragment = bySourceStream.get(`${line.sourceId}::${line.stream}`);
			expect(fragment, `${line.key} must name an eligible fragment`).toBeDefined();
			if (fragment !== undefined) expect(line.layer).toBe(fragmentLayer(fragment));
		}
		for (const fill of drawing.fills) {
			const entries = eligible.filter(
				(fragment) =>
					fragment.ref.sourceId === fill.sourceId &&
					(fill.treatment === 'room-floor' ? fragment.ref.sourceKind === 'room-floor' : fragment.ref.stream === 'cut')
			);
			expect(entries.length).toBeGreaterThan(0);
		}
	});

	it.each(fixtures)('draws every Scene footprint on %s, and each resolves to its own entity', (_name, fixture) => {
		const plan = evaluate(fixture.compiled);
		const entities: SceneEntity[] = [
			primitive('entity-box', [1.5, 0, 1]),
			primitive('entity-rotated', [3.5, 0, 2], [0, Math.PI / 4, 0]),
			form('entity-form', [5, 0, 4])
		];
		const projection = projectionOf(entities);
		const drawing = buildPaperPlan(plan, fixture.compiled, projection);
		expect(drawing.footprints.map((entry) => entry.entityId).sort()).toEqual(
			projection.footprints.map((entry) => entry.entityId).sort()
		);
		for (const footprint of projection.footprints) {
			const points = footprint.polygons ?? [footprint.points];
			const first = points[0]!;
			const centre = first.reduce<[number, number]>(
				(accumulator, point) => [accumulator[0] + point[0] / first.length, accumulator[1] + point[1] / first.length],
				[0, 0]
			);
			const resolved = resolvePlanSceneHit(projection.footprints, centre);
			expect(resolved, `${footprint.entityId} must be hit at its own interior`).not.toBeNull();
			if (resolved !== null) expect(resolved.entityId).toBe(footprint.entityId);
			const drawn = drawing.footprints.find((entry) => entry.entityId === footprint.entityId);
			expect(drawn?.layer).toBe(PAPER_LAYER.sceneFootprint);
		}
	});

	it('shares one footprint projection between the drawn layer and the hit path', () => {
		const document = { entities: [primitive('entity-one', [1, 0, 1])] } as Pick<SceneDocument, 'entities'>;
		const modelFootprints = new Map([['model-a', { width: 2, depth: 3 }]]);
		expect(planSceneFootprintsFor(document, modelFootprints)).toBe(planSceneFootprintsFor(document, modelFootprints));
	});
});

describe('Paper Plan — stream treatment', () => {
	it('draws a deselected standalone Wall on an otherwise empty Layout', () => {
		const fixture = standaloneWall();
		expect(fixture.document.rooms).toHaveLength(0);
		const plan = evaluate(fixture.compiled);
		const drawing = buildPaperPlan(plan, fixture.compiled, EMPTY_PROJECTION);
		const wallId = fixture.document.walls[0]!.id;
		expect(eligiblePlanFragments(plan).some((fragment) => fragment.ref.sourceId === wallId)).toBe(true);
		expect(drawing.fills.some((fill) => fill.sourceId === wallId && fill.treatment === 'cut')).toBe(true);
		expect(drawing.lines.some((line) => line.sourceId === wallId && line.treatment === 'cut')).toBe(true);
	});

	it('draws cut Walls as poché with a band at the compiled thickness', () => {
		const fixture = enclosure(STARTER_ENCLOSURE_POINTS);
		const plan = evaluate(fixture.compiled);
		const drawing = buildPaperPlan(plan, fixture.compiled, EMPTY_PROJECTION);
		const cutFragments = eligiblePlanFragments(plan).filter((fragment) => fragment.ref.stream === 'cut');
		expect(cutFragments.length).toBeGreaterThan(0);
		const poche = drawing.fills.filter((fill) => fill.treatment === 'cut');
		expect(poche).toHaveLength(cutFragments.length);
		for (const fill of poche) {
			expect(fill.layer).toBe(PAPER_LAYER.cut);
			expect(fill.polygons[0]).toHaveLength(4);
			// The band is the Wall's own thickness, not a centre-line stroke: at least one
			// edge is separated from its opposite by the compiled thickness.
			const polygon = fill.polygons[0]!;
			const thickness = Math.hypot(polygon[3]![0] - polygon[0]![0], polygon[3]![1] - polygon[0]![1]);
			const wall = fixture.compiled.walls.find((candidate) => candidate.wallId === fill.sourceId);
			expect(thickness).toBeCloseTo(wall!.thickness, 6);
		}
		// The cut edge is the heavier 1.5 px ink.
		expect(drawing.lines.some((line) => line.treatment === 'cut' && line.layer === PAPER_LAYER.cut)).toBe(true);
		expect(PAPER_LINE_STYLE.cut.widthCssPx).toBe(1.5);
	});

	it('draws an Opening symbol, and a lintel above the cut as projected', () => {
		const fixture = withDoor(enclosure(STARTER_ENCLOSURE_POINTS));
		const plan = evaluate(fixture.compiled);
		const drawing = buildPaperPlan(plan, fixture.compiled, EMPTY_PROJECTION);
		const symbols = drawing.lines.filter((line) => line.stream === 'symbol');
		expect(symbols.length).toBeGreaterThan(0);
		expect(symbols.every((line) => line.layer === PAPER_LAYER.symbol)).toBe(true);
		const lintels = drawing.lines.filter(
			(line) => line.stream === 'projected' && eligiblePlanFragments(plan).some((fragment) => fragment.ref.sourceId === line.sourceId && fragment.ref.sourceKind === 'wall')
		);
		expect(lintels.length, 'a Wall span above the cut is projected').toBeGreaterThan(0);
		expect(lintels.every((line) => line.layer === PAPER_LAYER.projected)).toBe(true);
	});

	it('draws a Wall wholly below the cut as dashed hidden ink', () => {
		const fixture = withLowWalls(enclosure(STARTER_ENCLOSURE_POINTS), 0.8);
		const plan = evaluate(fixture.compiled);
		expect(eligiblePlanFragments(plan).every((fragment) => fragment.ref.stream === 'hidden' || fragment.ref.sourceKind === 'room-floor')).toBe(true);
		const drawing = buildPaperPlan(plan, fixture.compiled, EMPTY_PROJECTION);
		const hidden = drawing.lines.filter((line) => line.stream === 'hidden');
		expect(hidden.length).toBeGreaterThan(0);
		expect(hidden.every((line) => line.layer === PAPER_LAYER.hidden)).toBe(true);
		expect(PAPER_LINE_STYLE.hidden.dashed).toBe(true);
		expect(PAPER_LINE_STYLE.hidden.opacity).toBeLessThan(PAPER_LINE_STYLE.projected.opacity);
	});

	it('draws a revealed source with its own stream treatment', () => {
		const fixture = enclosure(STARTER_ENCLOSURE_POINTS);
		const filtered = evaluate(fixture.compiled, { sourceKindFilter: ['wall'] });
		const floor = filtered.membership.find((row) => row.sourceKind === 'room-floor')!;
		expect(floor.eligible).toBe(false);
		const before = buildPaperPlan(filtered, fixture.compiled, EMPTY_PROJECTION);
		expect(before.fills.some((fill) => fill.sourceId === floor.sourceId)).toBe(false);

		const revealed = evaluate(fixture.compiled, { sourceKindFilter: ['wall'], reveal: [floor.sourceId] });
		const after = buildPaperPlan(revealed, fixture.compiled, EMPTY_PROJECTION);
		expect(after.fills.some((fill) => fill.sourceId === floor.sourceId)).toBe(true);
	});

	it('derives the layer and treatment from the fragment, never from a second table', () => {
		const fixture = enclosure(STARTER_ENCLOSURE_POINTS);
		const plan = evaluate(fixture.compiled);
		for (const fragment of eligiblePlanFragments(plan)) {
			expect(fragmentLayer(fragment)).toBe(
				fragment.ref.sourceKind === 'room-floor'
					? PAPER_LAYER.roomFloor
					: fragment.ref.stream === 'symbol'
						? PAPER_LAYER.symbol
						: fragment.ref.stream === 'cut'
							? PAPER_LAYER.cut
							: fragment.ref.stream === 'projected'
								? PAPER_LAYER.projected
								: PAPER_LAYER.hidden
			);
			expect(fragmentTreatment(fragment)).toBe(
				fragment.ref.sourceKind === 'room-floor'
					? 'room-floor'
					: fragment.ref.stream === 'symbol'
						? 'symbol'
						: fragment.ref.stream === 'cut'
							? 'cut'
							: fragment.ref.stream === 'projected'
								? 'projected'
								: 'hidden'
			);
		}
	});
});

describe('Paper Plan — Scene and native-form outlines', () => {
	it('unions thousands of sampled 1000m Wall bands to the exact outer contour', () => {
		// The compiler samples the long Wall at 0.25m, and Plan emits one cut-band
		// quad per solid sample interval. The contour remains the four exact outer
		// edges; internal sample seams are not authored or drawn boundaries.
		const fixture = enclosure([[0, 0], [1000, 0], [1000, 4], [0, 4]]);
		const wallId = fixture.document.walls[0]!.id;
		const drawing = buildPaperPlan(evaluate(fixture.compiled, { depthMeters: 2000 }), fixture.compiled, EMPTY_PROJECTION);
		const bands = drawing.fills.filter((fill) => fill.sourceId === wallId).flatMap((fill) => fill.polygons);
		expect(bands).toHaveLength(4000);
		const fills = drawing.fills.filter((fill) => fill.sourceId === wallId);
		const paper = createPaperScene({ fills, lines: [], footprints: [] }, [1280, 720]);
		const selected = createPaperMarkScene({
			selection: { fills, contours: [] },
			hover: { fills: [], contours: [] },
			erase: { fills: [], contours: [] }
		}, [1280, 720]);
		try {
			for (const resources of [paper, selected]) {
				// Render cost must not grow one draw call/material per sample band.
				expect(resources.group.children).toHaveLength(1);
				const mesh = resources.group.children[0] as Mesh;
				expect(mesh).toBeInstanceOf(Mesh);
				expect(mesh.geometry.index!.count).toBe(bands.length * 6);
				const positions = mesh.geometry.getAttribute('position');
				expect(positions.count).toBe(bands.length * 4);
				for (let index = 0; index < positions.count; index += 1) {
					expect(positions.getY(index)).toBeCloseTo(fills[0]!.elevationMeters, 6);
				}
			}
		} finally {
			paper.dispose();
			selected.dispose();
		}

		const counts = new Map<string, number>();
		const previousObserver = setWorkObserver({
			span() {},
			count(name, amount) {
				counts.set(name, (counts.get(name) ?? 0) + amount);
			}
		});
		let outline: ReturnType<typeof unionOutline>;
		try {
			outline = unionOutline(bands);
		} finally {
			setWorkObserver(previousObserver);
		}
		expect(outline).toHaveLength(4);
		// Every narrow-phase interaction comes from the indexed candidate set.
		// This deterministic work ceiling fails if the former all-bands scan returns.
		expect(counts.get('grid:build-box-visit')).toBe(bands.length);
		expect(counts.get('grid:entry-test')).toBeGreaterThan(0);
		expect(counts.get('grid:entry-test')!).toBeLessThan(bands.length * 64);
		const lengths = outline.map(([start, end]) => Math.hypot(end[0] - start[0], end[1] - start[1])).sort((a, b) => a - b);
		expect(lengths[0]).toBeCloseTo(0.2, 6);
		expect(lengths[1]).toBeCloseTo(0.2, 6);
		expect(lengths[2]).toBeCloseTo(1000.2, 6);
		expect(lengths[3]).toBeCloseTo(1000.2, 6);

		// Rotation changes both the broad-phase cell coverage and exact edge
		// coordinates; it must retain the same source union and output lengths.
		const angle = Math.PI / 4;
		const rotated = bands.map((polygon) => polygon.map(([x, z]) => [
			x * Math.cos(angle) - z * Math.sin(angle),
			x * Math.sin(angle) + z * Math.cos(angle)
		] as LayoutVec2));
		const rotatedOutline = unionOutline(rotated);
		const rotatedLengths = rotatedOutline
			.map(([start, end]) => Math.hypot(end[0] - start[0], end[1] - start[1]))
			.sort((a, b) => a - b);
		expect(rotatedOutline).toHaveLength(4);
		expect(rotatedLengths[0]).toBeCloseTo(0.2, 5);
		expect(rotatedLengths[1]).toBeCloseTo(0.2, 5);
		expect(rotatedLengths[2]).toBeCloseTo(1000.2, 5);
		expect(rotatedLengths[3]).toBeCloseTo(1000.2, 5);
	});

	it('keeps the outer silhouette when an edge is only partly covered', () => {
		// Two offset rectangles: A=[0,2]×[0,2], B=[1,3]×[1,3]. Four full edges have
		// their midpoint inside the other rectangle, but each still contributes a
		// partial outer boundary. A midpoint-only test would drop those whole edges.
		const outline = unionOutline([
			[[0, 0], [2, 0], [2, 2], [0, 2]],
			[[1, 1], [3, 1], [3, 3], [1, 3]]
		]);
		const key = (segment: readonly [LayoutVec2, LayoutVec2]): string => {
			const point = (value: LayoutVec2): string => `${value[0].toFixed(6)},${value[1].toFixed(6)}`;
			const forward = `${point(segment[0])}|${point(segment[1])}`;
			const reverse = `${point(segment[1])}|${point(segment[0])}`;
			return forward < reverse ? forward : reverse;
		};
		const expected: ReadonlyArray<readonly [LayoutVec2, LayoutVec2]> = [
			[[0, 0], [2, 0]],
			[[2, 0], [2, 1]],
			[[2, 1], [3, 1]],
			[[3, 1], [3, 3]],
			[[3, 3], [1, 3]],
			[[1, 3], [1, 2]],
			[[1, 2], [0, 2]],
			[[0, 2], [0, 0]]
		];
		expect(new Set(outline.map(key))).toEqual(new Set(expected.map(key)));
	});

	it('draws tilted forms as the boundary of their projected polygon union', () => {
		const entities: SceneEntity[] = [form('entity-tilted', [2, 0, 2], [0.4, 0, 0])];
		const projection = projectionOf(entities);
		const footprint = projection.footprints[0]!;
		expect(footprint.polygons?.length ?? 0).toBeGreaterThan(1);
		const fixture = enclosure(STARTER_ENCLOSURE_POINTS);
		const drawing = buildPaperPlan(evaluate(fixture.compiled), fixture.compiled, projection);
		const outlined = drawing.footprints[0]!;
		// The union boundary is a closed silhouette, not a fan of triangle edges.
		expect(outlined.segments.length).toBeGreaterThanOrEqual(4);
		const degree = new Map<string, number>();
		const key = (point: LayoutVec2): string => `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
		for (const [start, end] of outlined.segments) {
			degree.set(key(start), (degree.get(key(start)) ?? 0) + 1);
			degree.set(key(end), (degree.get(key(end)) ?? 0) + 1);
		}
		expect([...degree.values()].every((count) => count === 2)).toBe(true);
		// A triangle edge inside the union would have union on both sides; the outline
		// must not contain one.
		expect(outlined.segments.length).toBeLessThan((footprint.polygons ?? []).length * 3);
	});

	it('does not draw a footprint the Scene picker cannot reach', () => {
		const entities: SceneEntity[] = [primitive('entity-mounted', [2, 0, 2]), primitive('entity-unmounted', [5, 0, 2])];
		const projection = projectionOf(entities);
		const fixture = enclosure(STARTER_ENCLOSURE_POINTS);
		const drawing = buildPaperPlan(evaluate(fixture.compiled), fixture.compiled, projection, {
			isFootprintMounted: (entityId) => entityId === 'entity-mounted'
		});
		expect(drawing.footprints.map((entry) => entry.entityId)).toEqual(['entity-mounted']);
	});

	it('draws footprints on the level datum, not the world origin', () => {
		const projection = projectionOf([primitive('entity-box', [2, 0, 3])]);
		const fixture = enclosure(STARTER_ENCLOSURE_POINTS);
		const drawing = buildPaperPlan(evaluate(fixture.compiled), fixture.compiled, projection, {
			datumMeters: 2.75
		});
		expect(drawing.footprints[0]!.elevationMeters).toBe(2.75);
	});

	it('keeps an upright footprint as its exact ring', () => {
		const entities: SceneEntity[] = [primitive('entity-box', [2, 0, 3])];
		const projection = projectionOf(entities);
		const fixture = enclosure(STARTER_ENCLOSURE_POINTS);
		const drawing = buildPaperPlan(evaluate(fixture.compiled), fixture.compiled, projection);
		const outlined = drawing.footprints[0]!;
		expect(outlined.segments).toHaveLength(4);
		expect(outlined.polygons[0]).toEqual(projection.footprints[0]!.points);
	});
});

describe('Paper Plan — appearance is a camera layer mask', () => {
	it('shows only the overlay layer on Paper and both layers in the world reading', () => {
		expect(stageCameraLayerMask(true)).toEqual([STAGE_OVERLAY_LAYER]);
		expect(stageCameraLayerMask(false)).toEqual([STAGE_WORLD_LAYER, STAGE_OVERLAY_LAYER]);

		const paper = new Layers();
		paper.disableAll();
		for (const layer of stageCameraLayerMask(true)) paper.enable(layer);
		const mat = new Layers();
		mat.disableAll();
		for (const layer of stageCameraLayerMask(false)) mat.enable(layer);
		const world = new Layers();
		world.disableAll();
		world.enable(STAGE_WORLD_LAYER);
		const overlay = new Layers();
		overlay.disableAll();
		overlay.enable(STAGE_OVERLAY_LAYER);
		expect(paper.test(world)).toBe(false);
		expect(paper.test(overlay)).toBe(true);
		expect(mat.test(world)).toBe(true);
		expect(mat.test(overlay)).toBe(true);
	});

	it('draws only when the Plan has settled and Paper is chosen', () => {
		const plan = { renderedReading: 'plan', orthographicWeight: 1 } as const;
		expect(isPaperPlanVisible(plan, 'paper')).toBe(true);
		expect(isPaperPlanVisible(plan, 'shaded')).toBe(false);
		expect(isPaperPlanVisible({ renderedReading: 'plan', orthographicWeight: 0.98 }, 'paper')).toBe(false);
		expect(isPaperPlanVisible({ renderedReading: 'transition', orthographicWeight: 1 }, 'paper')).toBe(false);
		expect(isPaperPlanVisible({ renderedReading: '3d', orthographicWeight: 0 }, 'paper')).toBe(false);
		expect(DEFAULT_APP_PREFERENCES.planAppearance).toBe('paper');
	});

	it('puts every Paper object on layer 2 and orders it by its Plan layer', () => {
		const fixture = enclosure(STARTER_ENCLOSURE_POINTS);
		const plan = evaluate(fixture.compiled);
		const projection = projectionOf([primitive('entity-box', [2, 0, 2])]);
		const drawing = buildPaperPlan(plan, fixture.compiled, projection);
		const resources = createPaperScene(drawing, [1280, 720]);
		const overlay = new Layers();
		overlay.disableAll();
		overlay.enable(STAGE_OVERLAY_LAYER);
		const world = new Layers();
		world.disableAll();
		world.enable(STAGE_WORLD_LAYER);
		let objects = 0;
		resources.group.traverse((node) => {
			if (node.type === 'Group') return;
			objects += 1;
			expect(node.layers.test(overlay)).toBe(true);
			expect(node.layers.test(world)).toBe(false);
			expect(node.renderOrder).toBeGreaterThanOrEqual(PAPER_LAYER.roomFloor);
			expect(node.renderOrder).toBeLessThanOrEqual(PAPER_LAYER.sceneFootprint);
		});
		expect(objects).toBeGreaterThan(0);
		resources.dispose();
	});

	it('puts 3D on the mat and keeps Paper inks out of the renderer tone map', () => {
		expect(PAPER_GROUND_INK).toBe('#e9ebe6');
		expect(MAT_BACKGROUND_INK).toBe('#152c26');
		expect(MAT_GROUND_INK).toBe('#1d3a33');

		const canvas = readFileSync(join(REPO_ROOT, 'apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte'), 'utf8');
		// No fog: the mat is a measured ground, not an atmospheric room.
		expect(canvas).not.toMatch(/<T\.Fog/);
		// R217.S19: the Canvas mounts the mat ground, whose material wears the mat ink.
		expect(canvas).toContain('<StageMatGround');
		const matGround = readFileSync(
			join(REPO_ROOT, 'apps/editor/src/lib/authoring/stage/shell/StageMatGround.svelte'),
			'utf8'
		);
		expect(matGround).toContain('createMatGroundMaterial');
		const groundShader = readFileSync(join(REPO_ROOT, 'apps/editor/src/lib/authoring/stage/shell/stage-mat-grid.ts'), 'utf8');
		expect(groundShader).toContain('uMatInk: { value: new Color(MAT_GROUND_INK) }');

		// PLATE inks are semantic colors; tone mapping would shift the vellum and ink
		// away from the shell's own values. Every Paper material opts out.
		const scene = readFileSync(join(REPO_ROOT, 'apps/editor/src/lib/authoring/stage/paper-scene.ts'), 'utf8');
		expect(scene.match(/toneMapped: false/g)?.length ?? 0).toBeGreaterThanOrEqual(3);

		const camera = readFileSync(join(REPO_ROOT, 'apps/editor/src/lib/authoring/stage/shell/StageCamera.svelte'), 'utf8');
		expect(camera).toContain('renderer.setClearColor');
	});

	it('redraws Paper when a root gains geometry or a lazy renderer arrives', () => {
		const canvas = readFileSync(join(REPO_ROOT, 'apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte'), 'utf8');
		expect(canvas).toContain('hasPickableBody');
		expect(canvas).toContain('onEntityRenderable={entityRendererReady}');
		expect(canvas).toContain('revision={sceneRootRevision + entityRenderRevision}');

		const entities = readFileSync(join(REPO_ROOT, 'apps/editor/src/lib/authoring/stage/shell/StageEntities.svelte'), 'utf8');
		expect(entities).toContain('onEntityRenderable?.()');
	});

	it('never writes Object3D.visible in Paper or appearance code', () => {
		const files = [
			'apps/editor/src/lib/authoring/stage/paper-plan.ts',
			'apps/editor/src/lib/authoring/stage/paper-scene.ts',
			'apps/editor/src/lib/authoring/stage/shell/StagePaper.svelte',
			'apps/editor/src/lib/authoring/stage/shell/StageCamera.svelte',
			'apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte'
		];
		for (const file of files) {
			const source = readFileSync(join(REPO_ROOT, file), 'utf8');
			expect(source, file).not.toMatch(/\.visible\s*=/);
			expect(source, file).not.toMatch(/visible\s*:\s*false/);
		}
	});
});
