/**
 * T1.P01.S02 — the session inspection viewport evaluation.
 *
 * The viewport provider's whole claim is that **one** evaluator produces the pose,
 * the matrices and every CSS↔world answer, so meshes, overlays, pointer rays and
 * working-plane inverses cannot disagree. These assertions are therefore mostly
 * *agreement* assertions rather than literal value pins:
 *
 * 1. view/projection inverses really invert, and the view matrix sends the eye to
 *    the origin and the target straight down its own −Z;
 * 2. world → CSS → ray → working plane returns the point it started from, in both
 *    readings and at intermediate points of a reading flip;
 * 3. the Plan endpoint is *exactly* orthographic and to scale on both top-down axes,
 *    while the flip's intermediate steps keep the target-plane extent — the
 *    measured proof that the transition is the Camera's projective evaluation and
 *    not a second affine transform or a tiny-FOV stand-in;
 * 4. a flip preserves target and target-plane scale, settles azimuth deterministically
 *    (including the exact tie) and returns to the last working elevation;
 * 5. aspect change moves nothing but the aspect, and every intent either moves the
 *    pose exactly or refuses with a typed reason.
 */
import { describe, expect, it } from 'vitest';
import {
	addVec3,
	advanceViewport,
	createViewportCameraState,
	crossVec3,
	dotVec3,
	evaluateViewport,
	intersectWorkingPlane,
	multiplyMatrices,
	nearestQuarterTurn,
	normalizeVec3,
	pointerRay,
	projectWorld,
	rebaseViewportSource,
	requestViewingIntent,
	scaleVec3,
	subtractVec3,
	transformPoint,
	VIEWPORT_ELEVATION_LIMIT_RADIANS,
	VIEWPORT_READING_TRANSITION_SECONDS,
	VIEWPORT_TARGET_PLANE_MAX_METERS,
	type ViewportCameraState,
	type ViewportEvaluation,
	type ViewportRect,
	type Vec3,
	type WorkingPlane
} from '@portfolio/camera-core';

const RECT: ViewportRect = { left: 0, top: 0, width: 800, height: 600, devicePixelRatio: 2 };

/** Shared session identity for the suite. */
const IDENTITY = { outputId: 'output-1', sessionEpoch: 'session-1', sourceRevision: 'content-a' };

function state(overrides: Partial<ViewportCameraState> = {}): ViewportCameraState {
	const base = createViewportCameraState({
		...IDENTITY,
		pose: { target: [0, 2, 0], azimuthRadians: 0, elevationRadians: 0.35, targetPlaneHeightMeters: 8 },
		sceneRadiusMeters: 6
	});
	return { ...base, ...overrides };
}

function evaluated(
	camera: ViewportCameraState,
	rect: unknown = RECT,
	clockSeconds = 0,
	evaluationGeneration = 1,
	plane: WorkingPlane | null = null
): ViewportEvaluation {
	const result = evaluateViewport(camera, rect, clockSeconds, evaluationGeneration, plane);
	if (result.kind !== 'evaluated') throw new Error(`expected an evaluation, got ${result.reason}`);
	return result.evaluation;
}

function expectClose(actual: number, expected: number, tolerance = 1e-9): void {
	expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function identityMatrix(): number[] {
	return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function expectMatrixClose(actual: readonly number[], expected: readonly number[], tolerance = 1e-9): void {
	expect(actual).toHaveLength(16);
	for (let index = 0; index < 16; index += 1) expectClose(actual[index]!, expected[index]!, tolerance);
}

/** An explicit working plane through `origin`, horizontal, unbounded. */
function planeAt(origin: Vec3, extent: WorkingPlane['supportedLocalExtent'] = null): WorkingPlane {
	return { originMeters: origin, normal: [0, 1, 0], yawRadians: 0, datumMeters: null, supportedLocalExtent: extent };
}

/** The signed screen basis in project world: the axes a pan and every mark are expressed in. */
function screenBasis(evaluation: ViewportEvaluation): { right: Vec3; up: Vec3 } {
	const backward = normalizeVec3(subtractVec3(evaluation.eye, evaluation.target));
	if (backward === null) throw new Error('the evaluation has no view direction');
	const right = normalizeVec3(crossVec3(evaluation.up, backward));
	if (right === null) throw new Error('the evaluation has no screen right');
	const up = normalizeVec3(crossVec3(backward, right));
	if (up === null) throw new Error('the evaluation has no screen up');
	return { right, up };
}

/** Screen-right in project world for an evaluation: the basis a pan is expressed in. */
function screenRight(evaluation: ViewportEvaluation): Vec3 {
	return screenBasis(evaluation).right;
}

/** A pose from the 21-pose camera trace: four viewports collapse to a matrix sweep here. */
function traceState(azimuthDegrees: number, elevationDegrees: number): ViewportCameraState {
	return createViewportCameraState({
		...IDENTITY,
		pose: {
			target: [3.5, 1.5, -1],
			azimuthRadians: (azimuthDegrees * Math.PI) / 180,
			elevationRadians: (elevationDegrees * Math.PI) / 180,
			targetPlaneHeightMeters: 15.2
		},
		sceneRadiusMeters: 5
	});
}

describe('view viewport', () => {
	it('refuses a hidden or invalid viewport instead of dividing by a zero extent', () => {
		const camera = state();
		const hidden = evaluateViewport(camera, { ...RECT, width: 0 }, 0, 1);
		expect(hidden.kind).toBe('unavailable');
		if (hidden.kind === 'unavailable') expect(hidden.reason).toBe('hidden-viewport');
		for (const rect of [{ ...RECT, width: -1 }, { ...RECT, devicePixelRatio: Number.NaN }, 'nope']) {
			const result = evaluateViewport(camera, rect, 0, 1);
			expect(result.kind).toBe('unavailable');
			if (result.kind === 'unavailable') expect(result.reason).toBe('invalid-viewport');
		}
	});

	it('produces matrices whose inverses invert and whose view places the eye and target', () => {
		const camera = state();
		const evaluation = evaluated(camera);
		expectMatrixClose(multiplyMatrices(evaluation.viewMatrix, evaluation.inverseViewMatrix), identityMatrix(), 1e-12);
		expectMatrixClose(multiplyMatrices(evaluation.projectionMatrix, evaluation.inverseProjectionMatrix), identityMatrix(), 1e-9);
		expectMatrixClose(multiplyMatrices(evaluation.viewProjectionMatrix, evaluation.inverseViewProjectionMatrix), identityMatrix(), 1e-9);

		const eyeInView = transformPoint(evaluation.viewMatrix, evaluation.eye);
		expectClose(eyeInView[0], 0, 1e-12);
		expectClose(eyeInView[1], 0, 1e-12);
		expectClose(eyeInView[2], 0, 1e-12);

		const targetInView = transformPoint(evaluation.viewMatrix, evaluation.target);
		expectClose(targetInView[0], 0, 1e-12);
		expectClose(targetInView[1], 0, 1e-12);
		// The camera looks down its own −Z, so the target sits at a negative camera-space z.
		expect(targetInView[2]).toBeLessThan(0);
		expect(evaluation.eye[1]).toBeGreaterThan(evaluation.target[1]);
		expect(evaluation.projectionKind).toBe('perspective-3d');
	});

	it('reports the target-plane scale in CSS pixels and projects the target to the frame centre', () => {
		const evaluation = evaluated(state());
		expectClose(evaluation.targetPlaneMetersPerCssPixel, evaluation.pose.targetPlaneHeightMeters / RECT.height, 1e-12);
		const projected = projectWorld(evaluation.target, evaluation, evaluation.token);
		expect(projected.kind).toBe('projected');
		if (projected.kind !== 'projected') return;
		expect(projected.visibility).toBe('visible');
		expectClose(projected.css[0], RECT.left + RECT.width / 2, 1e-9);
		expectClose(projected.css[1], RECT.top + RECT.height / 2, 1e-9);
		expect(projected.ndcDepth).toBeLessThan(1);
	});

	it('agrees through world → CSS → ray → working plane in 3D', () => {
		const camera = state();
		const evaluation = evaluated(camera);
		const plane = planeAt(camera.pose.target);
		for (const worldPoint of [
			camera.pose.target,
			addVec3(camera.pose.target, [2, 0, 1]),
			addVec3(camera.pose.target, [-3, 0, -2])
		]) {
			const projected = projectWorld(worldPoint, evaluation, evaluation.token);
			if (projected.kind !== 'projected') throw new Error('expected a projection');
			expect(projected.visibility).toBe('visible');
			const ray = pointerRay(projected.css, evaluation, evaluation.token);
			if (ray.kind !== 'ray') throw new Error('expected a ray');
			const hit = intersectWorkingPlane(ray.ray, plane, evaluation, evaluation.token);
			if (hit.kind !== 'intersected') throw new Error(`expected an intersection, got ${hit.code}`);
			expectClose(hit.worldPoint[0], worldPoint[0], 1e-6);
			expectClose(hit.worldPoint[1], worldPoint[1], 1e-6);
			expectClose(hit.worldPoint[2], worldPoint[2], 1e-6);
		}
	});

	it('distinguishes visible, outside-frame, clipped and behind', () => {
		const camera = state();
		const evaluation = evaluated(camera);
		const toTarget = normalizeVec3(subtractVec3(camera.pose.target, evaluation.eye));
		if (toTarget === null) throw new Error('degenerate');
		const beyondFar = projectWorld(addVec3(evaluation.eye, scaleVec3(toTarget, evaluation.far + 10)) as Vec3, evaluation, evaluation.token);
		expect(beyondFar.kind === 'projected' && beyondFar.visibility).toBe('clipped');
		const behind = projectWorld(
			addVec3(evaluation.eye, scaleVec3(scaleVec3(toTarget, -1), 5)) as Vec3,
			evaluation,
			evaluation.token
		);
		expect(behind.kind === 'projected' && behind.visibility).toBe('behind');
		const aside = projectWorld(addVec3(camera.pose.target, scaleVec3(screenRight(evaluation), 500)) as Vec3, evaluation, evaluation.token);
		expect(aside.kind === 'projected' && aside.visibility).toBe('outside-frame');
	});

	it('is deterministic for identical inputs', () => {
		const first = evaluated(state());
		const second = evaluated(state());
		expect(second.viewMatrix).toEqual(first.viewMatrix);
		expect(second.projectionMatrix).toEqual(first.projectionMatrix);
		expect(second.viewProjectionMatrix).toEqual(first.viewProjectionMatrix);
	});

	it('changes aspect without moving the view', () => {
		const camera = state();
		const wide = evaluated(camera, { ...RECT, width: 1200 });
		const base = evaluated(camera);
		expect(wide.target).toEqual(base.target);
		expect(wide.pose.targetPlaneHeightMeters).toBe(base.pose.targetPlaneHeightMeters);
		expect(wide.eye).toEqual(base.eye);
		expect(wide.targetPlaneMetersPerCssPixel).toBe(base.targetPlaneMetersPerCssPixel);
		// The projection itself does differ: only the aspect moved, no implicit fit.
		expect(wide.projectionMatrix).not.toEqual(base.projectionMatrix);
	});
});

describe('view reading flip', () => {
	it('keeps the signed screen basis continuous on every transition frame', () => {
		// The D23 regression: near the overhead threshold the view basis used to turn
		// 180°, so screen right and up reversed and a Wall on the left jumped to the
		// right. Every elevation/azimuth pair from the camera trace is swept at the
		// transition's own 601-frame sampling rate, in both directions.
		for (const elevation of [5, 45, 88]) {
			for (const azimuth of [0, 44, 46, 90, 179, 225, 315]) {
				const camera = traceState(azimuth, elevation);
				const flip = requestViewingIntent(camera, { kind: 'set-reading', reading: 'plan' }, 0);
				if (flip.kind !== 'accepted') throw new Error(`expected an accepted flip, got ${flip.code}`);
				let previous = screenBasis(evaluated(flip.state, RECT, 0));
				for (let frame = 1; frame <= 600; frame += 1) {
					const clock = (VIEWPORT_READING_TRANSITION_SECONDS * frame) / 600;
					const current = screenBasis(evaluated(flip.state, RECT, clock));
					expect(dotVec3(previous.right, current.right)).toBeGreaterThan(0.999);
					expect(dotVec3(previous.up, current.up)).toBeGreaterThan(0.999);
					previous = current;
				}

				// The reverse transition owns the same guarantee, including its onset.
				const settled = advanceViewport(flip.state, VIEWPORT_READING_TRANSITION_SECONDS);
				const back = requestViewingIntent(settled, { kind: 'set-reading', reading: '3d' }, 10);
				if (back.kind !== 'accepted') throw new Error(`expected an accepted flip back, got ${back.code}`);
				previous = screenBasis(evaluated(back.state, RECT, 10));
				for (let frame = 1; frame <= 600; frame += 1) {
					const clock = 10 + (VIEWPORT_READING_TRANSITION_SECONDS * frame) / 600;
					const current = screenBasis(evaluated(back.state, RECT, clock));
					expect(dotVec3(previous.right, current.right)).toBeGreaterThan(0.999);
					expect(dotVec3(previous.up, current.up)).toBeGreaterThan(0.999);
					previous = current;
				}
			}
		}
	});

	it('keeps the signed Plan basis at the settled azimuth, including the quarter-turn tie', () => {
		for (const azimuth of [0, 44, 45, 46, 90, 179, 180, 225, 315]) {
			const camera = traceState(azimuth, 45);
			const flip = requestViewingIntent(camera, { kind: 'set-reading', reading: 'plan' }, 0);
			if (flip.kind !== 'accepted') throw new Error('expected an accepted flip');
			const plan = evaluated(flip.state, RECT, VIEWPORT_READING_TRANSITION_SECONDS);
			const settledAzimuth = nearestQuarterTurn((azimuth * Math.PI) / 180);
			expect(plan.pose.azimuthRadians).toBe(settledAzimuth);
			// Plan reads screen right +X at azimuth 0 and screen up −Z: O3's endpoint contract.
			const basis = screenBasis(plan);
			for (const [actual, expected] of [
				[basis.right, [Math.cos(settledAzimuth), 0, -Math.sin(settledAzimuth)]],
				[basis.up, [-Math.sin(settledAzimuth), 0, -Math.cos(settledAzimuth)]]
			] as const) {
				for (let axis = 0; axis < 3; axis += 1) expectClose(actual[axis], expected[axis], 1e-9);
			}
		}
	});

	it('does not reverse under a mid-transition reversal, fast switching or a reduced-motion cut', () => {
		// One interruption, then every frame the session would realise: a reversal may
		// extend or cancel a motion, but never turn the drawing over.
		let camera = traceState(0, 45);
		const first = requestViewingIntent(camera, { kind: 'set-reading', reading: 'plan' }, 0);
		if (first.kind !== 'accepted') throw new Error('expected an accepted flip');
		camera = advanceViewport(first.state, 0.3);
		const reversed = requestViewingIntent(camera, { kind: 'set-reading', reading: '3d' }, 0.3);
		if (reversed.kind !== 'accepted') throw new Error('expected an accepted reversal');
		camera = reversed.state;
		let previous = screenBasis(evaluated(camera, RECT, 0.3));
		for (let frame = 1; frame <= 90; frame += 1) {
			const clock = 0.3 + frame * 0.01;
			camera = advanceViewport(camera, clock);
			const current = screenBasis(evaluated(camera, RECT, clock));
			expect(dotVec3(previous.right, current.right)).toBeGreaterThan(0.99);
			expect(dotVec3(previous.up, current.up)).toBeGreaterThan(0.99);
			previous = current;
		}
		expect(camera.reading).toBe('3d');

		// Repeated fast switching, sampled at the frame rate the session evaluates at.
		camera = traceState(0, 45);
		let clock = 0;
		let reading: '3d' | 'plan' = '3d';
		previous = screenBasis(evaluated(camera));
		for (let switchIndex = 0; switchIndex < 24; switchIndex += 1) {
			clock += 0.05;
			reading = reading === '3d' ? 'plan' : '3d';
			const next = requestViewingIntent(camera, { kind: 'set-reading', reading }, clock);
			if (next.kind !== 'accepted') throw new Error('expected an accepted switch');
			camera = next.state;
			for (let step = 0; step < 5; step += 1) {
				const sample = clock + 0.01 * (step + 1);
				camera = advanceViewport(camera, sample);
				const current = screenBasis(evaluated(camera, RECT, sample));
				expect(dotVec3(previous.right, current.right)).toBeGreaterThan(0.99);
				expect(dotVec3(previous.up, current.up)).toBeGreaterThan(0.99);
				previous = current;
			}
		}

		// Reduced motion dates the request before its own transition, so the next frame
		// is already the endpoint: a cut, never a shortened tween and never a roll. A cut
		// may change pitch; it may not turn the drawing over, and it lands on Plan's
		// signed endpoint basis.
		const reduced = traceState(0, 45);
		const before = screenBasis(evaluated(reduced));
		const cut = requestViewingIntent(
			reduced,
			{ kind: 'set-reading', reading: 'plan' },
			20 - VIEWPORT_READING_TRANSITION_SECONDS - 1
		);
		if (cut.kind !== 'accepted') throw new Error('expected an accepted cut');
		const endpoint = evaluated(cut.state, RECT, 20);
		expect(endpoint.projectionKind).toBe('plan-orthographic');
		expect(endpoint.orthographicWeight).toBe(1);
		const cutBasis = screenBasis(endpoint);
		expect(dotVec3(before.right, cutBasis.right)).toBeGreaterThan(0.999);
		expectClose(cutBasis.up[2], -1, 1e-9);
	});

	it('keeps target, scale and remembered elevation across twenty settled cycles', () => {
		let camera = traceState(0, 45);
		let clock = 0;
		for (let cycle = 0; cycle < 20; cycle += 1) {
			const plan = requestViewingIntent(camera, { kind: 'set-reading', reading: 'plan' }, clock);
			if (plan.kind !== 'accepted') throw new Error('expected an accepted flip');
			clock += VIEWPORT_READING_TRANSITION_SECONDS + 0.001;
			camera = advanceViewport(plan.state, clock);
			expect(camera.reading).toBe('plan');
			expect(camera.pose.target).toEqual([3.5, 1.5, -1]);
			expect(camera.pose.targetPlaneHeightMeters).toBe(15.2);
			const settledPlan = evaluated(camera, RECT, clock);
			expectClose(screenBasis(settledPlan).right[0], 1, 1e-9);

			clock += 1;
			const back = requestViewingIntent(camera, { kind: 'set-reading', reading: '3d' }, clock);
			if (back.kind !== 'accepted') throw new Error('expected an accepted flip back');
			clock += VIEWPORT_READING_TRANSITION_SECONDS + 0.001;
			camera = advanceViewport(back.state, clock);
			expect(camera.reading).toBe('3d');
			expectClose(camera.pose.elevationRadians, Math.PI / 4, 1e-12);
			expect(camera.pose.target).toEqual([3.5, 1.5, -1]);
			expect(camera.pose.targetPlaneHeightMeters).toBe(15.2);
			clock += 1;
		}
	});

	it('starts exactly at the settled matrices and settles at the exact Plan endpoint', () => {
		const camera = state();
		const before = evaluated(camera);
		const flip = requestViewingIntent(camera, { kind: 'set-reading', reading: 'plan' }, 0);
		if (flip.kind !== 'accepted') throw new Error(`expected an accepted flip, got ${flip.code}`);

		const atStart = evaluated(flip.state, RECT, 0);
		expectMatrixClose(atStart.viewMatrix, before.viewMatrix, 1e-12);
		expectMatrixClose(atStart.projectionMatrix, before.projectionMatrix, 1e-9);
		expect(atStart.progress).toBe(0);
		expect(atStart.orthographicWeight).toBe(0);

		const atEnd = evaluated(flip.state, RECT, VIEWPORT_READING_TRANSITION_SECONDS);
		expect(atEnd.projectionKind).toBe('plan-orthographic');
		expect(atEnd.orthographicWeight).toBe(1);
		expect(atEnd.renderedReading).toBe('plan');
		expect(atEnd.settledReading).toBe('3d');
		expect(atEnd.pose.elevationRadians).toBe(Math.PI / 2);
		expect(atEnd.pose.target).toEqual(camera.pose.target);
		expect(atEnd.pose.targetPlaneHeightMeters).toBe(camera.pose.targetPlaneHeightMeters);
		// The top-down endpoint stands exactly over the target with a nondegenerate, horizontal up.
		expectClose(atEnd.eye[0], camera.pose.target[0], 1e-12);
		expectClose(atEnd.eye[2], camera.pose.target[2], 1e-12);
		expect(atEnd.up[1]).toBe(0);
		expectClose(Math.hypot(atEnd.up[0], atEnd.up[2]), 1, 1e-12);

		const settled = advanceViewport(flip.state, VIEWPORT_READING_TRANSITION_SECONDS);
		expect(settled.reading).toBe('plan');
		expect(settled.transition).toBeNull();
		expect(settled.pose).toEqual(atEnd.pose);
	});

	it('is exactly orthographic and to scale on both top-down axes', () => {
		const camera = state();
		const flip = requestViewingIntent(camera, { kind: 'set-reading', reading: 'plan' }, 0);
		if (flip.kind !== 'accepted') throw new Error('expected an accepted flip');
		const plan = evaluated(flip.state, RECT, VIEWPORT_READING_TRANSITION_SECONDS);
		const metersPerPixel = plan.targetPlaneMetersPerCssPixel;

		const origin = projectWorld(plan.target, plan, plan.token);
		const alongX = projectWorld(addVec3(plan.target, [1, 0, 0]) as Vec3, plan, plan.token);
		const alongZ = projectWorld(addVec3(plan.target, [0, 0, 1]) as Vec3, plan, plan.token);
		if (origin.kind !== 'projected' || alongX.kind !== 'projected' || alongZ.kind !== 'projected') {
			throw new Error('expected all three projections');
		}
		// One world meter along a top-down axis is exactly one over the scale in CSS pixels.
		expectClose(Math.abs(alongX.css[0] - origin.css[0]), 1 / metersPerPixel, 1e-6);
		expectClose(Math.abs(alongX.css[1] - origin.css[1]), 0, 1e-6);
		expectClose(Math.abs(alongZ.css[1] - origin.css[1]), 1 / metersPerPixel, 1e-6);
		expectClose(Math.abs(alongZ.css[0] - origin.css[0]), 0, 1e-6);
		// Orthographic has no "behind": the projection's w is always 1, so a point above the
		// camera eye is only ever depth-clipped, and rays are parallel.
		const insideScene = projectWorld(addVec3(plan.target, [0, -3, 0]) as Vec3, plan, plan.token);
		expect(insideScene.kind === 'projected' && insideScene.visibility).toBe('visible');
		const aboveEye = projectWorld(addVec3(plan.target, [0, 200, 0]) as Vec3, plan, plan.token);
		expect(aboveEye.kind === 'projected' && aboveEye.visibility).toBe('clipped');
		const firstRay = pointerRay([200, 150], plan, plan.token);
		const secondRay = pointerRay([600, 450], plan, plan.token);
		if (firstRay.kind !== 'ray' || secondRay.kind !== 'ray') throw new Error('expected both rays');
		expectClose(firstRay.ray.direction[0], secondRay.ray.direction[0], 1e-12);
		expectClose(firstRay.ray.direction[1], secondRay.ray.direction[1], 1e-12);
		expectClose(firstRay.ray.direction[2], secondRay.ray.direction[2], 1e-12);
		expect(firstRay.ray.origin).not.toEqual(secondRay.ray.origin);
	});

	it('holds the target-plane extent through every intermediate step', () => {
		const camera = state();
		const flip = requestViewingIntent(camera, { kind: 'set-reading', reading: 'plan' }, 0);
		if (flip.kind !== 'accepted') throw new Error('expected an accepted flip');
		const settledPlan = evaluated(flip.state, RECT, VIEWPORT_READING_TRANSITION_SECONDS);
		for (const progress of [0.1, 0.25, 0.5, 0.75, 0.9]) {
			const clock = progress * VIEWPORT_READING_TRANSITION_SECONDS;
			const step = evaluated(flip.state, RECT, clock);
			expect(step.projectionKind).toBe('projective-transition');
			expect(step.orthographicWeight).toBeGreaterThan(0);
			expect(step.orthographicWeight).toBeLessThan(1);
			expect(step.targetPlaneMetersPerCssPixel).toBeCloseTo(settledPlan.targetPlaneMetersPerCssPixel, 12);
			// A world→CSS→ray→plane round trip still closes at the flip's own matrices.
			const plane = planeAt(step.target);
			const world = addVec3(step.target, [1, 0, 0.5]) as Vec3;
			const projected = projectWorld(world, step, step.token);
			if (projected.kind !== 'projected') throw new Error('expected a projection');
			const ray = pointerRay(projected.css, step, step.token);
			if (ray.kind !== 'ray') throw new Error('expected a ray');
			const hit = intersectWorkingPlane(ray.ray, plane, step, step.token);
			if (hit.kind !== 'intersected') throw new Error(`expected an intersection, got ${hit.code}`);
			expectClose(hit.worldPoint[0], world[0], 1e-3);
			expectClose(hit.worldPoint[2], world[2], 1e-3);
		}
	});

	it('returns to the last working elevation without refitting', () => {
		const camera = state();
		const flip = requestViewingIntent(camera, { kind: 'set-reading', reading: 'plan' }, 0);
		if (flip.kind !== 'accepted') throw new Error('expected an accepted flip');
		const settled = advanceViewport(flip.state, VIEWPORT_READING_TRANSITION_SECONDS);
		const back = requestViewingIntent(settled, { kind: 'set-reading', reading: '3d' }, 10);
		if (back.kind !== 'accepted') throw new Error(`expected an accepted flip back, got ${back.code}`);
		const restored = evaluated(back.state, RECT, 10 + VIEWPORT_READING_TRANSITION_SECONDS);
		expect(restored.projectionKind).toBe('perspective-3d');
		expect(restored.pose.elevationRadians).toBeCloseTo(camera.pose.elevationRadians, 12);
		expect(restored.pose.target).toEqual(camera.pose.target);
		expect(restored.pose.targetPlaneHeightMeters).toBe(camera.pose.targetPlaneHeightMeters);
		expectMatrixClose(restored.viewMatrix, evaluated(camera, RECT, 0).viewMatrix, 1e-9);
	});

	it('settles the azimuth at the nearest quarter turn with a deterministic tie', () => {
		expect(nearestQuarterTurn(0)).toBe(0);
		expect(nearestQuarterTurn(Math.PI / 2 + 0.01)).toBeCloseTo(Math.PI / 2, 12);
		expect(nearestQuarterTurn(Math.PI / 4 + 0.001)).toBeCloseTo(Math.PI / 2, 12);
		// Exactly between two detents the lower normalized detent wins.
		expect(nearestQuarterTurn(Math.PI / 4)).toBe(0);
		expect(nearestQuarterTurn(-Math.PI / 4)).toBeCloseTo(-Math.PI / 2, 12);
		expect(nearestQuarterTurn((3 * Math.PI) / 4)).toBeCloseTo(Math.PI / 2, 12);

		const camera = state({ pose: { target: [1, 0, 1], azimuthRadians: Math.PI / 4, elevationRadians: 0.3, targetPlaneHeightMeters: 4 } });
		const flip = requestViewingIntent(camera, { kind: 'set-reading', reading: 'plan' }, 0);
		if (flip.kind !== 'accepted') throw new Error('expected an accepted flip');
		const plan = evaluated(flip.state, RECT, VIEWPORT_READING_TRANSITION_SECONDS);
		expect(plan.pose.azimuthRadians).toBe(0);
	});

	it('refuses a reading the viewport already settled at', () => {
		const camera = state();
		const flip = requestViewingIntent(camera, { kind: 'set-reading', reading: 'plan' }, 0);
		if (flip.kind !== 'accepted') throw new Error('expected an accepted flip');
		const settled = advanceViewport(flip.state, VIEWPORT_READING_TRANSITION_SECONDS);
		const again = requestViewingIntent(settled, { kind: 'set-reading', reading: 'plan' }, 2);
		expect(again.kind).toBe('rejected');
		if (again.kind === 'rejected') expect(again.code).toBe('already-settled');
	});
});

describe('view viewing intents', () => {
	it('pans exactly in the target plane, preserving the target-plane scale', () => {
		const camera = state();
		const before = evaluated(camera);
		const pan = requestViewingIntent(camera, { kind: 'pan', deltaCss: [100, 50], rect: RECT }, 0);
		if (pan.kind !== 'accepted') throw new Error(`expected an accepted pan, got ${pan.code}`);
		const after = evaluated(pan.state);
		expect(after.pose.targetPlaneHeightMeters).toBe(before.pose.targetPlaneHeightMeters);
		expect(after.pose.elevationRadians).toBe(before.pose.elevationRadians);

		// A fixed point **in the target plane** — the plane through the target
		// perpendicular to the view direction — appears displaced by exactly the CSS
		// delta: the pan moves the target inside that plane by delta × target-plane
		// scale, and a point at the target's own depth keeps that scale. A point off the
		// plane is nearer or farther by construction, so perspective rescales its
		// apparent displacement; the interfaces contract scopes the scale claim to the
		// target plane, never to all depths or foreshortened 3D geometry.
		const backward = normalizeVec3(subtractVec3(before.eye, before.target));
		if (backward === null) throw new Error('the evaluation has no view direction');
		const right = screenRight(before);
		const inPlaneUp = crossVec3(backward, right);
		const world = addVec3(before.target, addVec3(scaleVec3(right, 1), scaleVec3(inPlaneUp, 0.5))) as Vec3;
		const projectedBefore = projectWorld(world, before, before.token);
		const projectedAfter = projectWorld(world, after, after.token);
		if (projectedBefore.kind !== 'projected' || projectedAfter.kind !== 'projected') throw new Error('expected projections');
		expectClose(projectedAfter.css[0] - projectedBefore.css[0], 100, 1e-6);
		expectClose(projectedAfter.css[1] - projectedBefore.css[1], 50, 1e-6);
	});

	it('orbits within the 3D limits and refuses elevation in the Plan reading', () => {
		const camera = state();
		const orbit = requestViewingIntent(camera, { kind: 'orbit', deltaAzimuthRadians: 0.5, deltaElevationRadians: 0.1 }, 0);
		if (orbit.kind !== 'accepted') throw new Error('expected an accepted orbit');
		expectClose(orbit.state.pose.azimuthRadians, 0.5, 1e-12);
		expectClose(orbit.state.pose.elevationRadians, 0.45, 1e-12);

		const clamped = requestViewingIntent(camera, { kind: 'orbit', deltaAzimuthRadians: 0, deltaElevationRadians: 10 }, 0);
		if (clamped.kind !== 'accepted') throw new Error('expected an accepted orbit');
		expect(clamped.state.pose.elevationRadians).toBe(VIEWPORT_ELEVATION_LIMIT_RADIANS);

		const planFlip = requestViewingIntent(camera, { kind: 'set-reading', reading: 'plan' }, 0);
		if (planFlip.kind !== 'accepted') throw new Error('expected an accepted flip');
		const plan = advanceViewport(planFlip.state, VIEWPORT_READING_TRANSITION_SECONDS);
		const elevation = requestViewingIntent(plan, { kind: 'orbit', deltaAzimuthRadians: 0, deltaElevationRadians: 0.2 }, 5);
		expect(elevation.kind).toBe('rejected');
		if (elevation.kind === 'rejected') expect(elevation.code).toBe('unsupported-in-plan-reading');
		const azimuth = requestViewingIntent(plan, { kind: 'orbit', deltaAzimuthRadians: 0.25, deltaElevationRadians: 0 }, 5);
		if (azimuth.kind !== 'accepted') throw new Error('expected an accepted azimuth orbit');
		expectClose(azimuth.state.pose.elevationRadians, Math.PI / 2, 1e-12);
	});

	it('zooms multiplicatively with declared bounds, refusing a non-positive scale', () => {
		const camera = state();
		const zoomIn = requestViewingIntent(camera, { kind: 'zoom', scale: 2 }, 0);
		if (zoomIn.kind !== 'accepted') throw new Error('expected an accepted zoom');
		expectClose(zoomIn.state.pose.targetPlaneHeightMeters, 16, 1e-12);
		const capped = requestViewingIntent(camera, { kind: 'zoom', scale: 1e9 }, 0);
		if (capped.kind !== 'accepted') throw new Error('expected an accepted zoom');
		expect(capped.state.pose.targetPlaneHeightMeters).toBe(VIEWPORT_TARGET_PLANE_MAX_METERS);
		for (const scale of [0, -1, Number.NaN]) {
			const refused = requestViewingIntent(camera, { kind: 'zoom', scale }, 0);
			expect(refused.kind).toBe('rejected');
			if (refused.kind === 'rejected') expect(refused.code).toBe('invalid-intent');
		}
	});

	it('frames an explicit Fit request and Bring into view separately', () => {
		const camera = state();
		const fit = requestViewingIntent(
			camera,
			{ kind: 'fit', bounds: { min: [0, 0, 0], max: [4, 2.6, 3] }, rect: RECT },
			0
		);
		if (fit.kind !== 'accepted') throw new Error(`expected an accepted fit, got ${fit.code}`);
		expect(fit.state.pose.target).toEqual([2, 1.3, 1.5]);
		expect(fit.state.pose.targetPlaneHeightMeters).toBeGreaterThan(2.6);

		const invalidBounds = requestViewingIntent(camera, { kind: 'fit', bounds: { min: [1, 0, 0], max: [0, 0, 0] }, rect: RECT }, 0);
		expect(invalidBounds.kind).toBe('rejected');

		const bring = requestViewingIntent(camera, { kind: 'bring-into-view', target: [3, 1, 3] }, 0);
		if (bring.kind !== 'accepted') throw new Error('expected an accepted bring-into-view');
		expect(bring.state.pose.target).toEqual([3, 1, 3]);
		// Bring into view moves the view; it never refits the scale unless told to.
		expect(bring.state.pose.targetPlaneHeightMeters).toBe(camera.pose.targetPlaneHeightMeters);
	});

	it('applies an intent during a flip to the flip’s declared endpoint', () => {
		const camera = state();
		const flip = requestViewingIntent(camera, { kind: 'set-reading', reading: 'plan' }, 0);
		if (flip.kind !== 'accepted') throw new Error('expected an accepted flip');
		const zoomed = requestViewingIntent(flip.state, { kind: 'zoom', scale: 0.5 }, 0.1);
		if (zoomed.kind !== 'accepted') throw new Error('expected an accepted zoom');
		const endpoint = advanceViewport(zoomed.state, VIEWPORT_READING_TRANSITION_SECONDS);
		expect(endpoint.reading).toBe('plan');
		expectClose(endpoint.pose.targetPlaneHeightMeters, camera.pose.targetPlaneHeightMeters / 2, 1e-12);
	});
});

describe('view working plane and evaluation identity', () => {
	it('separates parallel, behind, outside-supported-domain and invalid frames', () => {
		const evaluation = evaluated(state());
		const down = { origin: [0, 5, 0] as Vec3, direction: [0, -1, 0] as Vec3 };
		const parallel = intersectWorkingPlane({ origin: [0, 5, 0] as Vec3, direction: [1, 0, 0] as Vec3 }, planeAt([0, 2, 0]), evaluation, evaluation.token);
		expect(parallel.kind === 'failed' && parallel.code).toBe('parallel');
		const behind = intersectWorkingPlane({ origin: [0, 5, 0] as Vec3, direction: [0, 1, 0] as Vec3 }, planeAt([0, 2, 0]), evaluation, evaluation.token);
		expect(behind.kind === 'failed' && behind.code).toBe('behind');
		const outside = intersectWorkingPlane(
			{ origin: [2, 5, 0] as Vec3, direction: [0, -1, 0] as Vec3 },
			planeAt([0, 2, 0], { min: [0, 0], max: [0.5, 0.5] }),
			evaluation,
			evaluation.token
		);
		expect(outside.kind === 'failed' && outside.code).toBe('outside-supported-domain');
		const plain = intersectWorkingPlane(down, planeAt([0, 2, 0], null), evaluation, evaluation.token);
		if (plain.kind !== 'intersected') throw new Error(`expected an intersection, got ${plain.code}`);
		expect(plain.worldPoint[1]).toBeCloseTo(2, 9);
		expectClose(plain.local.x, 0, 1e-12);
		expectClose(plain.local.y, 0, 1e-12);
		const degenerate = intersectWorkingPlane(
			{ origin: [0, 5, 0] as Vec3, direction: [0, -1, 0] as Vec3 },
			{ ...planeAt([0, 2, 0]), normal: [0, 0, 0] },
			evaluation,
			evaluation.token
		);
		expect(degenerate.kind === 'failed' && degenerate.code).toBe('invalid-frame');
	});

	it('refuses a stale evaluation rather than projecting through superseded matrices', () => {
		const evaluation = evaluated(state(), RECT, 0, 1);
		const stale = { ...evaluation.token, evaluationGeneration: 2 };
		const projection = projectWorld(evaluation.target, evaluation, stale);
		expect(projection.kind === 'failed' && projection.code).toBe('stale-evaluation');
		const ray = pointerRay([10, 10], evaluation, stale);
		expect(ray.kind === 'failed' && ray.code).toBe('stale-evaluation');
		const plane = intersectWorkingPlane({ origin: [0, 5, 0] as Vec3, direction: [0, -1, 0] as Vec3 }, planeAt([0, 2, 0]), evaluation, stale);
		expect(plane.kind === 'failed' && plane.code).toBe('stale-evaluation');
		const badPoint = projectWorld([Number.NaN, 0, 0], evaluation, evaluation.token);
		expect(badPoint.kind === 'failed' && badPoint.code).toBe('invalid-point');
	});

	it('qualifies the supplied working plane and reports a missing one', () => {
		const using = evaluated(state(), RECT, 0, 1, planeAt([0, 0, 0]));
		expect(using.workingPlane.kind).toBe('qualified');
		const without = evaluated(state());
		expect(without.workingPlane).toEqual({ kind: 'unavailable', reason: 'no-plane-supplied' });
		const invalid = evaluated(state(), RECT, 0, 1, { ...planeAt([0, 0, 0]), normal: [0, 0, 0] });
		expect(invalid.workingPlane).toEqual({ kind: 'unavailable', reason: 'invalid-plane' });
	});
});

describe('view source rebase', () => {
	it('is unchanged for identical content and preserves the pose across an install', () => {
		const camera = state();
		const identical = rebaseViewportSource(camera, IDENTITY.sourceRevision);
		expect(identical.kind).toBe('unchanged');

		const rebased = rebaseViewportSource(camera, 'content-b');
		expect(rebased.kind).toBe('rebased');
		if (rebased.kind !== 'rebased') return;
		expect(rebased.previousSourceRevision).toBe('content-a');
		expect(rebased.state.sourceRevision).toBe('content-b');
		expect(rebased.state.pose).toEqual(camera.pose);
		expect(rebased.state.reading).toBe(camera.reading);
		// The claimed pose alone cannot prove "no refit": the realised matrices must be identical.
		expectMatrixClose(evaluated(rebased.state, RECT, 0).viewProjectionMatrix, evaluated(camera, RECT, 0).viewProjectionMatrix, 1e-12);

		const refused = rebaseViewportSource(camera, ' ');
		expect(refused.kind).toBe('refused');
	});

	it('settles an in-flight flip to its declared endpoint before the install', () => {
		const camera = state();
		const flip = requestViewingIntent(camera, { kind: 'set-reading', reading: 'plan' }, 0);
		if (flip.kind !== 'accepted') throw new Error('expected an accepted flip');
		const rebased = rebaseViewportSource(flip.state, 'content-b');
		if (rebased.kind !== 'rebased') throw new Error('expected a rebase');
		expect(rebased.state.transition).toBeNull();
		expect(rebased.state.reading).toBe('plan');
		expect(rebased.state.pose.elevationRadians).toBe(Math.PI / 2);
	});
});
