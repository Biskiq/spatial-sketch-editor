/**
 * C3 checkpoint 5 — the unfold session and inverse picking.
 *
 * The session is display state over checkpoint 4's one development map: it
 * never writes the document, never enters history and never touches the camera
 * directly. These tests cover the checkpoint's owner-visible contract:
 *
 * - `u = 0` is exactly the canonical mesh and `u = 1` preserves arc-length
 *   stations within the checkpoint-4 tolerance;
 * - the D12 release rules and exact cancellation;
 * - the D13 edit policy (Openings and height enabled, shape edits refused);
 * - pointer rays on the developed strip resolve station, span, face and
 *   Opening identity on straight, multi-Bézier, S-curve, inflection and closed
 *   circle geometry;
 * - an unfolded pick feeds the existing canonical Opening planner and survives
 *   Save/Load;
 * - a closed Wall's seam-crossing Opening stays one canonical Opening while the
 *   display cut never moves the seam.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	createClosedWallCircleDocument,
	createEmptyWallFirstLayoutDocument,
	cubicBezierArcLength,
	deriveChainSpans,
	developmentOpeningIdentity,
	developmentPointAtStationFromBuffers,
	createWallDevelopmentBuffers,
	evaluateWallDevelopment,
	isClosedWall,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	mintLayoutIdCapture,
	parseWallFirstLayoutDocumentJson,
	planCreateWallFirstOpening,
	planMoveWallFirstOpening,
	planUpdateWallFirstOpening,
	pointAtDistance,
	serializeWallFirstLayoutDocument,
	spanForStation,
	wallCenterlineCubics,
	wallCenterlineSamples,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCubicSpan,
	type LayoutWallCurveKnot,
	type WallDevelopment,
	type WallDevelopmentSourceSpan
} from '@portfolio/layout-core';
import type { InspectionPose } from '@portfolio/camera-core';

import {
	createWallUnfoldState,
	isClosedCompiledWall,
	prepareWallUnfoldDevelopment,
	refoldWallUnfold,
	setWallUnfoldAmount,
	snapWallUnfoldAmount,
	unfoldAmountFromDrag,
	unfoldCanonicalStation,
	wallUnfoldAnchor,
	wallUnfoldEditPolicy,
	wallUnfoldInvalidation,
	wallUnfoldRefusesShapeEdit,
	WALL_UNFOLD_SHAPE_REFUSAL,
	type WallUnfoldEntryRecipe
} from '$lib/layout/wall-unfold';
import {
	buildWallUnfoldDisplay,
	evaluateWallUnfoldDisplay,
	pickWallUnfold,
	pickWallUnfoldSheetPoint,
	type WallUnfoldRay
} from '$lib/layout/wall-unfold-pick';

type Fixture = {
	readonly label: string;
	readonly document: LayoutDocumentWallFirst;
	readonly wallId: string;
	readonly closed: boolean;
	readonly thickness: number;
	readonly height: number;
};

const ENTRY: WallUnfoldEntryRecipe = {
	pose: {
		target: [0, 1.5, 0],
		azimuthRadians: 0.4,
		elevationRadians: 0.3,
		targetPlaneHeightMeters: 12
	} satisfies InspectionPose,
	reading: '3d'
};

function knotsOf(...points: LayoutVec2[]): LayoutWallCurveKnot[] {
	return points.map((point, index) => ({
		id: `wall-a:knot:${index + 1}`,
		point: [point[0], point[1]] as LayoutVec2
	}));
}

function chainOf(
	start: LayoutVec2,
	end: LayoutVec2,
	interior: LayoutVec2[],
	spans?: LayoutWallCubicSpan[]
): LayoutWall['centerline'] {
	return wallCubicChain(knotsOf(...interior), spans ?? deriveChainSpans([start, ...interior, end]));
}

function documentOf(centerline: LayoutWall['centerline'], start: LayoutVec2, end: LayoutVec2): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.junctions = [
		{ id: 'j-a', point: [start[0], start[1]] },
		{ id: 'j-b', point: [end[0], end[1]] }
	];
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			thickness: 0.2,
			height: 3,
			centerline
		} as LayoutWall
	];
	return document;
}

function straightFixture(): Fixture {
	return {
		label: 'straight',
		document: documentOf({ kind: 'line' }, [0, 0], [6, 0]),
		wallId: 'wall-a',
		closed: false,
		thickness: 0.2,
		height: 3
	};
}

function multiFixture(): Fixture {
	const points: LayoutVec2[] = [[0, 0], [2, 1.5], [4, -1], [6, 1], [8, -1], [10, 1.2], [12, 0]];
	return {
		label: 'multi-bezier',
		document: documentOf(chainOf(points[0]!, points.at(-1)!, points.slice(1, -1)), points[0]!, points.at(-1)!),
		wallId: 'wall-a',
		closed: false,
		thickness: 0.3,
		height: 3
	};
}

function sCurveFixture(): Fixture {
	const points: LayoutVec2[] = [[0, 0], [1.5, 2.5], [4.5, -2.5], [6, 0]];
	return {
		label: 's-curve',
		document: documentOf(chainOf(points[0]!, points.at(-1)!, points.slice(1, -1)), points[0]!, points.at(-1)!),
		wallId: 'wall-a',
		closed: false,
		thickness: 0.25,
		height: 3
	};
}

function inflectionFixture(): Fixture {
	const span: LayoutWallCubicSpan = { handleOut: [1.5, 3], handleIn: [4.5, -3] };
	return {
		label: 'inflection',
		document: documentOf(wallCubicChain([], [span]), [0, 0], [6, 0]),
		wallId: 'wall-a',
		closed: false,
		thickness: 0.2,
		height: 3
	};
}

function circleFixture(): Fixture {
	const created = createClosedWallCircleDocument({
		center: [0, 0],
		rim: [5, 0],
		junctionId: 'j-circle',
		wallId: 'wall-circle',
		thickness: 0.2,
		height: 3
	});
	if (created.kind !== 'success') throw new Error(JSON.stringify(created.rejection));
	return {
		label: 'closed-circle',
		document: created.document,
		wallId: 'wall-circle',
		closed: true,
		thickness: 0.2,
		height: 3
	};
}

function allFixtures(): Fixture[] {
	return [straightFixture(), multiFixture(), sCurveFixture(), inflectionFixture(), circleFixture()];
}

function compiledWall(fixture: Fixture) {
	const compilation = compileWallFirstLayoutGeometry(fixture.document);
	return compilation.geometry.walls.find((wall) => wall.wallId === fixture.wallId)!;
}

function spansOf(fixture: Fixture, development: WallDevelopment): WallDevelopmentSourceSpan[] {
	const wall = fixture.document.walls.find((candidate) => candidate.id === fixture.wallId)!;
	if (wall.centerline.kind === 'line') {
		return [
			{
				index: 0,
				startKnotId: wall.startJunctionId,
				endKnotId: wall.endJunctionId,
				startStation: 0,
				endStation: development.length,
				arcLength: development.length
			}
		];
	}
	const start = fixture.document.junctions.find((junction) => junction.id === wall.startJunctionId)!.point;
	const end = fixture.document.junctions.find((junction) => junction.id === wall.endJunctionId)!.point;
	const cubics = wallCenterlineCubics(wall.centerline, start, end, 'forward');
	let station = 0;
	return cubics.map((cubic, index) => {
		const arcLength = cubicBezierArcLength(cubic);
		const span: WallDevelopmentSourceSpan = {
			index,
			startKnotId:
				index === 0
					? wall.startJunctionId!
					: wall.centerline.kind === 'cubic-chain'
						? wall.centerline.knots[index - 1]!.id
						: '',
			endKnotId:
				index === cubics.length - 1
					? wall.endJunctionId!
					: wall.centerline.kind === 'cubic-chain'
						? wall.centerline.knots[index]!.id
						: '',
			startStation: station,
			endStation: station + arcLength,
			arcLength
		};
		station += arcLength;
		return span;
	});
}

function stateFor(
	fixture: Fixture,
	anchorStation = 0,
	u = 1
): ReturnType<typeof createWallUnfoldState> {
	return createWallUnfoldState({
		wall: compiledWall(fixture),
		anchorStation,
		entry: ENTRY,
		u
	});
}

function developmentFor(fixture: Fixture, state: ReturnType<typeof createWallUnfoldState>) {
	const prepared = prepareWallUnfoldDevelopment(state, compiledWall(fixture));
	if ('refused' in prepared) throw new Error(prepared.message);
	return prepared;
}

function cachedSamples(fixture: Fixture) {
	const wall = fixture.document.walls.find((candidate) => candidate.id === fixture.wallId)!;
	const start = fixture.document.junctions.find((junction) => junction.id === wall.startJunctionId)!.point;
	const end = fixture.document.junctions.find((junction) => junction.id === wall.endJunctionId)!.point;
	const sampled = wallCenterlineSamples(wall, start, end, 'forward');
	if (sampled === undefined) throw new Error('fixture did not sample');
	return sampled;
}

function wrap(value: number, length: number): number {
	const result = value % length;
	return result < 0 ? result + length : result;
}

function stationDistance(a: number, b: number, length: number, closed: boolean): number {
	return closed ? Math.min(wrap(a - b, length), wrap(b - a, length)) : Math.abs(a - b);
}

function topRayAt(fixture: Fixture, state: ReturnType<typeof createWallUnfoldState>, station: number): WallUnfoldRay {
	const development = developmentFor(fixture, state);
	const buffers = createWallDevelopmentBuffers(development);
	evaluateWallDevelopment(development, state.u, buffers);
	const point = developmentPointAtStationFromBuffers(development, buffers, station).point;
	return {
		origin: [point[0], fixture.height + 5, point[1]],
		direction: [0, -1, 0]
	};
}

function withOpening(
	document: LayoutDocumentWallFirst,
	wallId: string,
	offset: number,
	width: number,
	id: string
): LayoutDocumentWallFirst {
	const placed = planCreateWallFirstOpening(
		document,
		{ wallId, kind: 'window', offset, width, height: 1.2, sillHeight: 1 },
		mintLayoutIdCapture(() => id),
		document.floor.id
	);
	if (placed.kind !== 'success') throw new Error(JSON.stringify(placed.rejection));
	return placed.document;
}

describe('C3 checkpoint 5 — unfold session', () => {
	it('prepares u = 0 exactly from the compiled samples and u = 1 with preserved stations', () => {
		for (const fixture of allFixtures()) {
			const wall = compiledWall(fixture);
			const state = stateFor(fixture, wall.length * 0.3, 0);
			const development = developmentFor(fixture, state);
			const sampled = cachedSamples(fixture);
			const buffers = createWallDevelopmentBuffers(development);
			evaluateWallDevelopment(development, 0, buffers);
			let maxZeroError = 0;
			for (let index = 0; index < development.sampleCount; index += 1) {
				const point: LayoutVec2 = [buffers.points[index * 2]!, buffers.points[index * 2 + 1]!];
				const canonical = pointAtDistance(sampled, development.s[index]!).point;
				maxZeroError = Math.max(
					maxZeroError,
					Math.hypot(point[0] - canonical[0], point[1] - canonical[1])
				);
			}
			expect(maxZeroError).toBeLessThan(1e-9);

			evaluateWallDevelopment(development, 1, buffers);
			const direction: LayoutVec2 = [
				Math.cos(development.anchorDirection),
				Math.sin(development.anchorDirection)
			];
			const normal: LayoutVec2 = [-direction[1], direction[0]];
			let maxStationError = 0;
			let maxPerpendicularError = 0;
			for (const station of development.s) {
				const point = developmentPointAtStationFromBuffers(development, buffers, station).point;
				const dx = point[0] - development.anchorPoint[0];
				const dz = point[1] - development.anchorPoint[1];
				maxStationError = Math.max(
					maxStationError,
					Math.abs(dx * direction[0] + dz * direction[1] - (station - development.anchorStation))
				);
				maxPerpendicularError = Math.max(maxPerpendicularError, Math.abs(dx * normal[0] + dz * normal[1]));
			}
			expect(maxStationError).toBeLessThan(1e-9);
			expect(maxPerpendicularError).toBeLessThan(1e-9);
		}
	});

	it('holds the D12 scrub rules, magnetic stops and exact cancellation', () => {
		expect(unfoldAmountFromDrag(0)).toBe(0);
		expect(unfoldAmountFromDrag(130)).toBeCloseTo(0.5, 12);
		expect(unfoldAmountFromDrag(-260)).toBe(1);
		expect(unfoldAmountFromDrag(520)).toBe(1);

		expect(snapWallUnfoldAmount(0.02)).toBe(0);
		expect(snapWallUnfoldAmount(0.039)).toBe(0);
		expect(snapWallUnfoldAmount(0.041)).toBe(0.041);
		expect(snapWallUnfoldAmount(0.47)).toBe(0.5);
		expect(snapWallUnfoldAmount(0.53)).toBe(0.5);
		expect(snapWallUnfoldAmount(0.97)).toBe(1);
		expect(snapWallUnfoldAmount(0.8)).toBe(0.8);

		const fixture = sCurveFixture();
		const state = stateFor(fixture, 2, 0.75);
		const canonical = refoldWallUnfold(state);
		expect(canonical.u).toBe(0);
		expect(canonical.entry).toBe(state.entry);
		expect(canonical.anchorStation).toBe(state.anchorStation);
		expect(canonical.side).toBe(state.side);
		expect(setWallUnfoldAmount(state, 2).u).toBe(1);
		expect(setWallUnfoldAmount(state, -1).u).toBe(0);
		expect(setWallUnfoldAmount(state, Number.NaN).u).toBe(0.75);
	});

	it('puts the closed display cut opposite the anchor and never moves the seam', () => {
		const fixture = circleFixture();
		const wall = compiledWall(fixture);
		const state = stateFor(fixture, wall.length * 0.2);
		expect(isClosedCompiledWall(wall)).toBe(true);
		expect(
			isClosedWall({ startJunctionId: wall.startJunctionId!, endJunctionId: wall.endJunctionId! })
		).toBe(true);
		expect(state.cutStation).not.toBeNull();
		expect(
			Math.abs(wrap(state.cutStation! - state.anchorStation, wall.length) - wall.length / 2)
		).toBeLessThan(1e-9);
		const openState = stateFor(straightFixture(), 1);
		expect(openState.cutStation).toBeNull();
	});

	it('selects the anchor from the selected Opening, then the view centre, then the start', () => {
		const fixture = sCurveFixture();
		const wall = compiledWall(fixture);
		expect(wallUnfoldAnchor({ wall, selectedOpeningCenter: 3.2, viewCentreStation: 1 })).toBe(3.2);
		expect(wallUnfoldAnchor({ wall, selectedOpeningCenter: null, viewCentreStation: 1 })).toBe(1);
		expect(wallUnfoldAnchor({ wall })).toBe(0);
		const circle = compiledWall(circleFixture());
		const anchored = wallUnfoldAnchor({ wall: circle, selectedOpeningCenter: circle.length + 1 });
		expect(anchored).toBeGreaterThanOrEqual(0);
		expect(anchored).toBeLessThan(circle.length);
	});

	it('states the D13 policy explicitly: Openings and height stay, shape edits refuse', () => {
		const state = stateFor(sCurveFixture(), 1);
		const policy = wallUnfoldEditPolicy(state);
		expect(policy.openingPlacement).toBe('enabled');
		expect(policy.openingEditing).toBe('enabled');
		expect(policy.wallHeight).toBe('enabled');
		expect(policy.centerline.kind).toBe('refused');
		expect(policy.knots.kind).toBe('refused');
		expect(policy.bodyBend.kind).toBe('refused');
		expect(policy.centerline.message).toBe(WALL_UNFOLD_SHAPE_REFUSAL);
		expect(wallUnfoldRefusesShapeEdit(state, 'knots')).toEqual({
			refused: true,
			message: WALL_UNFOLD_SHAPE_REFUSAL
		});
		expect(wallUnfoldRefusesShapeEdit(null, 'centerline')).toEqual({ refused: false, message: null });
	});

	it('invalidates without guessing a nearby Wall', () => {
		const state = stateFor(straightFixture(), 0);
		expect(
			wallUnfoldInvalidation({ state, wallIds: new Set(['wall-a']) }).kind
		).toBe('valid');
		expect(
			wallUnfoldInvalidation({ state, wallIds: new Set(['other']) })
		).toEqual({ kind: 'invalidated', reason: 'wall-removed' });
		expect(
			wallUnfoldInvalidation({ state, wallIds: new Set(['wall-a']), documentReplaced: true })
		).toEqual({ kind: 'invalidated', reason: 'document-replaced' });
	});
});

describe('C3 checkpoint 5 — inverse picking on every geometry', () => {
	it.each(allFixtures().map((fixture) => [fixture.label, fixture] as const))(
		'round-trips station, span and face at u = 0, 0.5 and 1: %s',
		(_label, fixture) => {
			const wall = compiledWall(fixture);
			const developmentState = stateFor(fixture, wall.length * 0.15, 0);
			const development = developmentFor(fixture, developmentState);
			const spans = spansOf(fixture, development);
			const station = wall.length * 0.37;
			for (const u of [0, 0.5, 1]) {
				const state = { ...developmentState, u };
				const display = buildWallUnfoldDisplay(wall, state, { spans });
				expect(display).not.toBeNull();
				if (display === null) continue;

				// The sheet inverse is the station map's exact inverse on the
				// displayed polyline: a point ON it round-trips within the
				// checkpoint-4 station tolerance.
				const buffers = createWallDevelopmentBuffers(display.development);
				evaluateWallDevelopment(display.development, u, buffers);
				const onSheet = developmentPointAtStationFromBuffers(display.development, buffers, station).point;
				const inverse = pickWallUnfoldSheetPoint(display, onSheet);
				expect(inverse).not.toBeNull();
				if (inverse === null) continue;
				expect(stationDistance(inverse.station, station, wall.length, fixture.closed)).toBeLessThan(
					1e-6
				);

				// A pointer ray over the developed strip interpolates the same
				// attribution. The top face's centroid carries the mean of its
				// vertices' canonical stations, which the pick must reproduce.
				const top = display.mesh.triangles.find((triangle) => triangle.face === 'top');
				expect(top).toBeDefined();
				if (top === undefined) continue;
				const [a, b, c] = top.indices;
				const expectedStation =
					(display.mesh.vertices[a]!.station +
						display.mesh.vertices[b]!.station +
						display.mesh.vertices[c]!.station) /
					3;
				const centroid: [number, number, number] = [
					(display.positions[a * 3]! + display.positions[b * 3]! + display.positions[c * 3]!) / 3,
					(display.positions[a * 3 + 1]! + display.positions[b * 3 + 1]! + display.positions[c * 3 + 1]!) / 3,
					(display.positions[a * 3 + 2]! + display.positions[b * 3 + 2]! + display.positions[c * 3 + 2]!) / 3
				];
				const pick = pickWallUnfold(display, {
					origin: [centroid[0], fixture.height + 5, centroid[2]],
					direction: [0, -1, 0]
				});
				expect(pick).not.toBeNull();
				if (pick === null) continue;
				expect(stationDistance(pick.station, expectedStation, wall.length, fixture.closed)).toBeLessThan(
					1e-6
				);
				const span = spanForStation(spans, pick.station, wall.length, fixture.closed)!;
				expect(pick.spanIndex).toBe(span.index);
				expect(pick.startKnotId).toBe(span.startKnotId);
				expect(pick.endKnotId).toBe(span.endKnotId);
				expect(['left', 'right', 'top', 'bottom']).toContain(pick.face);
			}
		}
	);

	it.each(allFixtures().map((fixture) => [fixture.label, fixture] as const))(
		'identifies an Opening under the developed face: %s',
		(_label, fixture) => {
			const wall = compiledWall(fixture);
			const station = wall.length * 0.4;
			const document = withOpening(fixture.document, fixture.wallId, station - 0.5, 1, 'unfold-opening');
			const openingId = document.openings.at(-1)!.id;
			const compilation = compileWallFirstLayoutGeometry(document);
			const compiled = compilation.geometry.walls.find((candidate) => candidate.wallId === fixture.wallId)!;
			const state = createWallUnfoldState({
				wall: compiled,
				anchorStation: wall.length * 0.15,
				entry: ENTRY,
				u: 1
			});
			const prepared = prepareWallUnfoldDevelopment(state, compiled);
			if ('refused' in prepared) throw new Error(prepared.message);
			const spans = spansOf(fixture, prepared);
			const display = buildWallUnfoldDisplay(compiled, state, { spans })!;
			const buffers = createWallDevelopmentBuffers(prepared);
			evaluateWallDevelopment(prepared, 1, buffers);
			const point = developmentPointAtStationFromBuffers(prepared, buffers, station).point;
			const normal = developmentPointAtStationFromBuffers(prepared, buffers, station).normal;
			const ray: WallUnfoldRay = {
				origin: [point[0] + normal[0] * 2, 1.5, point[1] + normal[1] * 2],
				direction: [-normal[0], 0, -normal[1]]
			};
			const pick = pickWallUnfold(display, ray);
			expect(pick).not.toBeNull();
			if (pick === null) return;
			expect(pick.openingId).toBe(openingId);
			expect(stationDistance(pick.station, station, compiled.length, fixture.closed)).toBeLessThan(1e-3);
		}
	);

	it('uses the sheet inverse for a drag that leaves the sheet', () => {
		const fixture = sCurveFixture();
		const wall = compiledWall(fixture);
		const state = stateFor(fixture, 1, 1);
		const development = developmentFor(fixture, state);
		const spans = spansOf(fixture, development);
		const display = buildWallUnfoldDisplay(wall, state, { spans })!;
		const buffers = createWallDevelopmentBuffers(development);
		evaluateWallDevelopment(development, 1, buffers);
		const onSheet = developmentPointAtStationFromBuffers(development, buffers, wall.length * 0.42);
		const pick = pickWallUnfoldSheetPoint(display, [
			onSheet.point[0] + onSheet.normal[0] * 0.4,
			onSheet.point[1] + onSheet.normal[1] * 0.4
		]);
		expect(pick).not.toBeNull();
		if (pick === null) return;
		expect(Math.abs(pick.station - wall.length * 0.42)).toBeLessThan(1e-6);
		expect(pick.face).toBe('left');
	});

	it('re-maps the same display at a new u without changing its station attribution', () => {
		const fixture = sCurveFixture();
		const wall = compiledWall(fixture);
		const state = stateFor(fixture, 0, 0);
		const display = buildWallUnfoldDisplay(wall, state)!;
		const atZero = display.positions.slice();
		const remapped = evaluateWallUnfoldDisplay(display, { ...state, u: 0 });
		expect([...remapped.positions]).toEqual([...atZero]);
		const atOne = evaluateWallUnfoldDisplay(display, { ...state, u: 1 });
		expect([...atOne.positions]).not.toEqual([...atZero]);
	});
});

describe('C3 checkpoint 5 — canonical Opening edits from the sheet', () => {
	it('writes a picked station through the existing planner and round-trips Save/Load', () => {
		const fixture = sCurveFixture();
		const wall = compiledWall(fixture);
		const document = withOpening(fixture.document, fixture.wallId, wall.length * 0.3, 1.1, 'edit-opening');
		const openingId = document.openings.at(-1)!.id;
		const compilation = compileWallFirstLayoutGeometry(document);
		const compiled = compilation.geometry.walls.find((candidate) => candidate.wallId === fixture.wallId)!;
		const state = createWallUnfoldState({ wall: compiled, anchorStation: 0, entry: ENTRY, u: 0.5 });
		const development = prepareWallUnfoldDevelopment(state, compiled);
		if ('refused' in development) throw new Error(development.message);
		const spans = spansOf({ ...fixture, document }, development);
		const display = buildWallUnfoldDisplay(compiled, state, { spans })!;
		const picked = pickWallUnfold(display, topRayAt({ ...fixture, document }, state, compiled.length * 0.55));
		expect(picked).not.toBeNull();
		if (picked === null) return;

		const opening = document.openings.find((candidate) => candidate.id === openingId)!;
		const newOffset = picked.station - opening.width / 2;
		const moved = planMoveWallFirstOpening(document, opening.id, newOffset);
		expect(moved.kind).toBe('success');
		if (moved.kind !== 'success') return;
		expect(moved.document.openings.find((candidate) => candidate.id === opening.id)!.offset).toBeCloseTo(
			newOffset,
			9
		);
		expect(moved.document.openings).toHaveLength(1);
		expect(moved.document.openings[0]!.id).toBe(opening.id);

		const saved = serializeWallFirstLayoutDocument(moved.document);
		const parsed = parseWallFirstLayoutDocumentJson(saved);
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		const reloaded = parsed.document.openings.find((candidate) => candidate.id === opening.id)!;
		expect(reloaded.offset).toBeCloseTo(newOffset, 9);
		expect(reloaded.width).toBeCloseTo(opening.width, 9);
		expect(reloaded.wallId).toBe(fixture.wallId);
	});

	it('keeps a seam-crossing Opening as one canonical Opening at either fragment', () => {
		const fixture = circleFixture();
		const wall = compiledWall(fixture);
		const document = withOpening(fixture.document, fixture.wallId, wall.length - 0.2, 0.4, 'seam-opening');
		const openingId = document.openings.at(-1)!.id;
		const compilation = compileWallFirstLayoutGeometry(document);
		const compiled = compilation.geometry.walls.find((candidate) => candidate.wallId === fixture.wallId)!;
		const state = createWallUnfoldState({
			wall: compiled,
			anchorStation: wall.length * 0.1,
			entry: ENTRY,
			u: 1
		});
		const prepared = prepareWallUnfoldDevelopment(state, compiled);
		if ('refused' in prepared) throw new Error(prepared.message);
		const display = buildWallUnfoldDisplay(compiled, state)!;
		const buffers = createWallDevelopmentBuffers(prepared);
		evaluateWallDevelopment(prepared, 1, buffers);
		// One station before the seam and one after it both resolve to the same id.
		// The identity function is the seam-crossing contract; the ray pick is
		// covered on the same closed geometry by the Opening test above.
		for (const station of [compiled.length - 0.1, 0.1]) {
			expect(developmentOpeningIdentity(prepared, display.openingBands, station, 1.5)).toBe(openingId);
		}
		const beforeSeam = developmentPointAtStationFromBuffers(prepared, buffers, compiled.length - 0.1);
		const picked = pickWallUnfold(display, {
			origin: [beforeSeam.point[0] + beforeSeam.normal[0] * 2, 1.5, beforeSeam.point[1] + beforeSeam.normal[1] * 2],
			direction: [-beforeSeam.normal[0], 0, -beforeSeam.normal[1]]
		});
		expect(picked?.openingId).toBe(openingId);
		expect(document.openings.filter((opening) => opening.id === openingId)).toHaveLength(1);
		// A canonical field edit from the seam context updates that one record:
		// the fragment never creates a second Opening.
		const edited = planUpdateWallFirstOpening(document, openingId, { sillHeight: 1.1 });
		expect(edited.kind).toBe('success');
		if (edited.kind !== 'success') return;
		expect(edited.document.openings).toHaveLength(1);
		expect(edited.document.openings[0]!.id).toBe(openingId);
		expect(edited.document.openings[0]!.sillHeight).toBeCloseTo(1.1, 9);
	});

	it('maps a sheet station to the canonical domain and keeps the entry recipe untouched', () => {
		const fixture = straightFixture();
		const wall = compiledWall(fixture);
		const state = stateFor(fixture, 2, 0.5);
		expect(unfoldCanonicalStation(state, wall, 1)).toBe(3);
		const scrubbed = setWallUnfoldAmount(state, 0.9);
		expect(scrubbed.entry).toBe(state.entry);
		expect(scrubbed.entry.pose).toEqual(ENTRY.pose);
	});
});
