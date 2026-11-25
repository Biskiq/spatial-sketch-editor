/**
 * T1 A6 — the Face frame.
 *
 * Layout's whole contribution to Face is a **bounds** and a horizontal **look**
 * direction. These tests pin what the Camera cannot check for itself:
 *
 * 1. a folded Wall is faced on the side the settled eye is on, and from Plan on
 *    its left/Room face;
 * 2. a curved Wall's look is the face normal at the station nearest the view
 *    centre, while the frame still covers the whole Wall;
 * 3. an unrolled sheet is faced as it is displayed, including the half-turn
 *    after the Outside face switch, and at the current peel amount;
 * 4. a degenerate Wall or tangent refuses rather than handing the Camera a line;
 * 5. camera-core's own `face` pose from that frame puts the eye outside the face
 *    and every corner inside the frame.
 */
import { describe, expect, it } from 'vitest';

import { compileWallFirstLayoutGeometry, deriveChainSpans, type CompiledPhysicalWall, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { createClosedWallCircleDocument, createEmptyWallFirstLayoutDocument, LAYOUT_WALL_FIRST_FORMAT_VERSION, wallCubicChain, type LayoutDocumentWallFirst, type LayoutWall, type LayoutWallCubicSpan } from '@portfolio/layout-core/wall';
import { createViewportCameraState, evaluateViewport, facePoseFromBounds, projectWorld, type InspectionPose, type ViewportCameraState, type ViewportRect } from '@portfolio/camera-core/viewport';

import { wallFaceFrame, wallFaceSide, wallSheetFaceFrame, type WallFaceFrame } from '$lib/layout/wall-face';
import {
	createWallUnfoldState,
	flipWallUnfoldSide,
	wallUnfoldSideAngle
} from '$lib/layout/wall-unfold';
import { buildWallUnfoldDisplay, unfoldDisplayPointAtStation } from '$lib/layout/wall-unfold-pick';

const RECT: ViewportRect = { left: 0, top: 0, width: 900, height: 600, devicePixelRatio: 1 };
const FLOOR_Y = 0.4;

function knotsOf(...points: LayoutVec2[]): { id: string; point: LayoutVec2 }[] {
	return points.map((point, index) => ({ id: `wall-a:knot:${index + 1}`, point: [point[0], point[1]] }));
}

function chainOf(start: LayoutVec2, end: LayoutVec2, interior: LayoutVec2[]): LayoutWall['centerline'] {
	const spans: LayoutWallCubicSpan[] = deriveChainSpans([start, ...interior, end]);
	return wallCubicChain(knotsOf(...interior), spans);
}

function documentOf(
	centerline: LayoutWall['centerline'],
	start: LayoutVec2,
	end: LayoutVec2,
	height = 3
): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.floor.elevation = FLOOR_Y;
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
			height,
			centerline
		} as LayoutWall
	];
	return document;
}

function compile(document: LayoutDocumentWallFirst, wallId: string): CompiledPhysicalWall {
	const geometry = compileWallFirstLayoutGeometry(document).geometry;
	const wall = geometry.walls.find((candidate) => candidate.wallId === wallId);
	if (wall === undefined) throw new Error('the fixture Wall did not compile');
	return wall;
}

/** A straight 6 m Wall on X, facing ±Z. */
function straightWall(): CompiledPhysicalWall {
	return compile(documentOf({ kind: 'line' }, [0, 0], [6, 0]), 'wall-a');
}

/** A smooth 6 m arc bulging toward +Z. */
function curvedWall(): CompiledPhysicalWall {
	const points: LayoutVec2[] = [[0, 0], [2, 2], [4, 2], [6, 0]];
	return compile(
		documentOf(chainOf(points[0]!, points.at(-1)!, points.slice(1, -1)), points[0]!, points.at(-1)!),
		'wall-a'
	);
}

function cameraAt(input: {
	target: readonly [number, number, number];
	azimuthRadians?: number;
	elevationRadians?: number;
	reading?: '3d' | 'plan';
}): ViewportCameraState {
	return createViewportCameraState({
		outputId: 'output-face-frame',
		sessionEpoch: 'session-face-frame',
		sourceRevision: 'content-face-frame',
		reading: input.reading ?? '3d',
		pose: {
			target: [input.target[0], input.target[1], input.target[2]],
			azimuthRadians: input.azimuthRadians ?? 0,
			elevationRadians: input.elevationRadians ?? 0.25,
			targetPlaneHeightMeters: 12
		},
		sceneRadiusMeters: 10
	});
}

/** The pose camera-core derives from a frame: the only pose Face uses. */
function facePose(frame: WallFaceFrame): InspectionPose {
	const pose = facePoseFromBounds({ bounds: frame.bounds, look: frame.look, rect: RECT });
	if (pose === null) throw new Error('camera-core refused the frame');
	return pose;
}

/**
 * A face footprint keeps the subject's extent and moves it so the subject's
 * eye-side face lies on the frame's target plane. Every part of the subject is
 * therefore behind the framed plane, never magnified in front of it.
 */
function expectFaceFootprint(
	frame: WallFaceFrame,
	source: { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] }
): void {
	expect(frame.bounds.max[0] - frame.bounds.min[0]).toBeCloseTo(source.max[0] - source.min[0], 9);
	expect(frame.bounds.max[2] - frame.bounds.min[2]).toBeCloseTo(source.max[2] - source.min[2], 9);
	expect(frame.bounds.min[1]).toBe(source.min[1]);
	expect(frame.bounds.max[1]).toBe(source.max[1]);
	const target: [number, number, number] = [
		(frame.bounds.min[0] + frame.bounds.max[0]) / 2,
		(frame.bounds.min[1] + frame.bounds.max[1]) / 2,
		(frame.bounds.min[2] + frame.bounds.max[2]) / 2
	];
	let nearest = Infinity;
	for (const x of [source.min[0], source.max[0]]) {
		for (const z of [source.min[2], source.max[2]]) {
			nearest = Math.min(nearest, (x - target[0]) * frame.look[0] + (z - target[2]) * frame.look[2]);
		}
	}
	expect(nearest).toBeCloseTo(0, 9);
}

describe('T1 A6 — Face frame', () => {
	it('faces the side the eye is on, and its opposite after orbiting around the Wall', () => {
		const wall = straightWall();
		const fromFront = wallFaceFrame(wall, cameraAt({ target: [3, 1.5, 4] }));
		expect(fromFront).not.toBeNull();
		expectFaceFootprint(fromFront!, wall.bounds3);
		expect(fromFront!.look[0]).toBeCloseTo(0, 9);
		expect(fromFront!.look[1]).toBe(0);
		expect(fromFront!.look[2]).toBeCloseTo(-1, 9);

		const fromBack = wallFaceFrame(wall, cameraAt({ target: [3, 1.5, -4], azimuthRadians: Math.PI }));
		expect(fromBack).not.toBeNull();
		expect(fromBack!.look[2]).toBeCloseTo(1, 9);
		expect(wallFaceSide(wall, cameraAt({ target: [3, 1.5, -4], azimuthRadians: Math.PI }))).toBe(-1);
	});

	it('faces the Wall left/Room face from the Plan reading, which has no eye', () => {
		const wall = straightWall();
		const frame = wallFaceFrame(
			wall,
			cameraAt({ target: [3, 1.5, 4], azimuthRadians: Math.PI, reading: 'plan', elevationRadians: Math.PI / 2 })
		);
		expect(frame).not.toBeNull();
		expect(wallFaceSide(wall, cameraAt({ target: [3, 1.5, 4], reading: 'plan' }))).toBe(1);
		expect(frame!.look[2]).toBeCloseTo(-1, 9);
	});

	it('faces a curved Wall at the view-centre station and still frames the whole Wall', () => {
		const wall = curvedWall();
		const frame = wallFaceFrame(wall, cameraAt({ target: [3, 1.5, 6] }));
		expect(frame).not.toBeNull();
		// The frame is the Wall's own compiled extent, not a chord, as a face
		// footprint: the near station is at the target plane, not in front of it.
		expectFaceFootprint(frame!, wall.bounds3);
		// The target moved to the face, against the look direction, by the box's
		// own eye-side depth.
		const sourceCentre: [number, number, number] = [
			(wall.bounds3.min[0] + wall.bounds3.max[0]) / 2,
			(wall.bounds3.min[1] + wall.bounds3.max[1]) / 2,
			(wall.bounds3.min[2] + wall.bounds3.max[2]) / 2
		];
		const frameCentre: [number, number, number] = [
			(frame!.bounds.min[0] + frame!.bounds.max[0]) / 2,
			(frame!.bounds.min[1] + frame!.bounds.max[1]) / 2,
			(frame!.bounds.min[2] + frame!.bounds.max[2]) / 2
		];
		expect((frameCentre[0] - sourceCentre[0]) * frame!.look[0] + (frameCentre[2] - sourceCentre[2]) * frame!.look[2]).toBeLessThan(0);
		// The look is horizontal and square to the curve at the station nearest
		// the view centre, not to the straight chord end to end.
		expect(frame!.look[1]).toBe(0);
		expect(Math.hypot(frame!.look[0], frame!.look[2])).toBeCloseTo(1, 9);
		const nearest = wall.samples.reduce((best, sample) =>
			Math.abs(sample.distance - 3) < Math.abs(best.distance - 3) ? sample : best
		);
		const dot = frame!.look[0] * -nearest.tangent[1] + frame!.look[2] * nearest.tangent[0];
		expect(dot).toBeLessThan(-0.9);
	});

	it('frames a closed circular Wall without inventing a chord face', () => {
		const created = createClosedWallCircleDocument({
			center: [0, 0],
			rim: [5, 0],
			junctionId: 'j-circle',
			wallId: 'wall-circle',
			thickness: 0.2,
			height: 3
		});
		if (created.kind !== 'success') throw new Error('the circle fixture was refused');
		const wall = compile(created.document, 'wall-circle');
		const frame = wallFaceFrame(wall, cameraAt({ target: [0, 1.5, 8] }));
		expect(frame).not.toBeNull();
		expectFaceFootprint(frame!, wall.bounds3);
		expect(Math.hypot(frame!.look[0], frame!.look[2])).toBeCloseTo(1, 9);
	});

	it('refuses a degenerate Wall, a zero tangent or unordered bounds', () => {
		const wall = straightWall();
		const camera = cameraAt({ target: [3, 1.5, 4] });
		expect(
			wallFaceFrame({ ...wall, bounds3: { min: [0, 0, 0], max: [0, 3, 0] } }, camera)
		).toBeNull();
		expect(
			wallFaceFrame(
				{ ...wall, samples: wall.samples.map((sample) => ({ ...sample, tangent: [0, 0] as LayoutVec2 })) },
				camera
			)
		).toBeNull();
		expect(wallFaceFrame({ ...wall, samples: [] }, camera)).toBeNull();
	});

	it('squares to the unrolled sheet, including after the Outside face switch', () => {
		const wall = curvedWall();
		const state = createWallUnfoldState({
			wall,
			anchorStation: 3,
			entry: { pose: cameraAt({ target: [3, 1.5, 4] }).pose, reading: '3d' },
			u: 1
		});
		const inside = wallSheetFaceFrame({ wall, state, sideAngle: wallUnfoldSideAngle(state.side), floorY: FLOOR_Y });
		expect(inside).not.toBeNull();
		const display = buildWallUnfoldDisplay(wall, state, {
			floorY: FLOOR_Y,
			sideAngle: wallUnfoldSideAngle(state.side)
		})!;
		const atPin = unfoldDisplayPointAtStation(display, state.anchorStation);
		// Square to the displayed face at the pin.
		expect(inside!.look[0]).toBeCloseTo(-atPin.normal[0], 6);
		expect(inside!.look[2]).toBeCloseTo(-atPin.normal[1], 6);
		// The frame is the displayed sheet's face footprint, and every displayed
		// vertex sits on or behind its target plane.
		const min: [number, number, number] = [Infinity, Infinity, Infinity];
		const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
		for (let index = 0; index + 2 < display.positions.length; index += 3) {
			for (let axis = 0; axis < 3; axis += 1) {
				min[axis] = Math.min(min[axis]!, display.positions[index + axis]!);
				max[axis] = Math.max(max[axis]!, display.positions[index + axis]!);
			}
		}
		expectFaceFootprint(inside!, { min, max });
		const target: [number, number, number] = [
			(inside!.bounds.min[0] + inside!.bounds.max[0]) / 2,
			(inside!.bounds.min[1] + inside!.bounds.max[1]) / 2,
			(inside!.bounds.min[2] + inside!.bounds.max[2]) / 2
		];
		for (let index = 0; index + 2 < display.positions.length; index += 3) {
			const depth =
				(display.positions[index]! - target[0]) * inside!.look[0] +
				(display.positions[index + 2]! - target[2]) * inside!.look[2];
			expect(depth).toBeGreaterThanOrEqual(-1e-6);
		}

		const outsideState = flipWallUnfoldSide(state);
		const outside = wallSheetFaceFrame({
			wall,
			state: outsideState,
			sideAngle: wallUnfoldSideAngle(outsideState.side),
			floorY: FLOOR_Y
		});
		expect(outside).not.toBeNull();
		expect(outside!.look[0]).toBeCloseTo(-inside!.look[0], 6);
		expect(outside!.look[2]).toBeCloseTo(-inside!.look[2], 6);
	});

	it('lets camera-core frame the face with the eye outside it and every part inside', () => {
		const wall = curvedWall();
		const frame = wallFaceFrame(wall, cameraAt({ target: [3, 1.5, 6] }))!;
		const pose = facePose(frame);
		const state = createViewportCameraState({
			outputId: 'output-face-frame',
			sessionEpoch: 'session-face-frame',
			sourceRevision: 'content-face-frame',
			pose,
			sceneRadiusMeters: 10
		});
		const evaluated = evaluateViewport(state, RECT, 0, 1);
		if (evaluated.kind !== 'evaluated') throw new Error(evaluated.reason);
		const evaluation = evaluated.evaluation;
		// The look is eye → face, so the eye sits on its negative side.
		expect(evaluation.eye[2]).toBeGreaterThan(evaluation.target[2] + 1);
		// The Wall body, not just the box: every station's top and bottom at both
		// thickness offsets is inside the frame, with room to spare. The near
		// station sits on the target plane, so it is the tightest part and the
		// padding still shows.
		const half = wall.thickness / 2;
		for (const sample of wall.samples) {
			for (const lateral of [-half, half]) {
				for (const y of [wall.bounds3.min[1], wall.bounds3.max[1]]) {
					const projected = projectWorld(
						[
							sample.point[0] + sample.normal[0] * lateral,
							y,
							sample.point[1] + sample.normal[1] * lateral
						],
						evaluation,
						evaluation.token
					);
					expect(projected.kind).toBe('projected');
					if (projected.kind !== 'projected') continue;
					expect(projected.visibility).toBe('visible');
					expect(projected.css[0]).toBeGreaterThan(RECT.left + 4);
					expect(projected.css[0]).toBeLessThan(RECT.left + RECT.width - 4);
					expect(projected.css[1]).toBeGreaterThan(RECT.top + 4);
					expect(projected.css[1]).toBeLessThan(RECT.top + RECT.height - 4);
				}
			}
		}
	});
});
