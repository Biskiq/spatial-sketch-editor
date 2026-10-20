/**
 * T1.P01.S02 — the **consumer probes** for `T1.viewport-projection@1`.
 *
 * The seam's consumer boundary is the public editor host, so its acceptance cannot
 * be shown from inside the host: a T2/T3 adapter must be able to project, pick,
 * render an overlay, request a Camera inspection and mount an instrument **through
 * the facade only**, with no private Stage state. Two test-only adapters stand in
 * for those consumers, exactly as `interfaces.md`'s probe table describes them.
 *
 * What fails here when the seam is wrong:
 *
 * - a second projection (the adapter's `project` disagreeing with the host's own
 *   `projectWorld` for the same evaluation) — the mesh, the overlay and the ray
 *   would then be drawn from different cameras;
 * - a stale evaluation being handed to an adapter, or a reading flip that never
 *   reaches the settled endpoint;
 * - a world→CSS→ray→plane round trip that does not return the point it projected;
 * - an overlay changing ownership, or a retained ticket still driving a replaced
 *   output (one output, one controller);
 * - mounting or closing a task that moves the view — the host reframes nothing
 *   because chrome appeared.
 *
 * The source is the existing conformance fixture (a real Layout object, one
 * primitive Scene entity and Camera-bearing navigation nodes), admitted through the
 * one admission path. Nothing here imports Three, a compiler or a private Stage
 * module.
 */
import { describe, expect, it } from 'vitest';
import { VIEWPORT_READING_TRANSITION_SECONDS, type ViewportRect } from '@portfolio/camera-core';
import {
	admitSource,
	type AdmissionContext,
	type StageReadSnapshot
} from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import {
	createStageFacade,
	datumWorkingPlane,
	type StageAdapterContext,
	type StageFacade
} from '$lib/authoring/stage/stage-facade';
import { FIXTURE_PROJECT_ID, buildCurrentSourceFixture } from './__fixtures__/f4-current-source-fixtures';

const RECT: ViewportRect = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
/** A clock past the longest transition, so a reading is settled rather than mid-flight. */
const CLOCK_SETTLED = 1 + VIEWPORT_READING_TRANSITION_SECONDS + 0.5;

type Mounted = {
	readonly facade: StageFacade;
	readonly snapshot: StageReadSnapshot;
};

/** The host's own mount order, through the public admission path. */
async function mount(): Promise<Mounted> {
	const { project } = await buildCurrentSourceFixture();
	const context: AdmissionContext = {
		sessionEpoch: 'session-consumer-probes',
		acceptedRevision: { projectId: FIXTURE_PROJECT_ID, revisionId: 'revision-probes-1' }
	};
	const admitted = await admitSource(project, context);
	if (admitted.kind !== 'admitted') {
		throw new Error(`the probe fixture was not admitted: ${admitted.kind}`);
	}
	const session = createStageSession({ sessionEpoch: context.sessionEpoch });
	session.replace(admitted.snapshot);
	const facade = createStageFacade({ snapshot: admitted.snapshot, session });
	// The host owns one inspection output; every intent below presents this claim.
	facade.acquireInspection('exclusive');
	return { facade, snapshot: admitted.snapshot };
}

/** Evaluate at an explicit clock and return the id that names the live output. */
function settle(facade: StageFacade, clockSeconds: number): string {
	const result = facade.camera.evaluate(RECT, clockSeconds);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	const id = facade.evaluationId();
	if (id === null) throw new Error('the evaluated output has no id');
	return id;
}

/**
 * The context an adapter received on its last overlay evaluation.
 *
 * A consumer receives its context by being invoked, so the probe records it there
 * rather than reaching for host state — which is the whole point of the boundary.
 */
type Observed = { context: StageAdapterContext | null };

function contextOf(observed: Observed): StageAdapterContext {
	const context = observed.context;
	if (context === null) throw new Error('the adapter was never invoked with a context');
	return context;
}

/** The host's own projection of one point, for comparison with an adapter's. */
function cssOf(facade: StageFacade, point: readonly [number, number, number], evaluationId: string): readonly [number, number] {
	const projected = facade.projectWorld(point, evaluationId);
	if (projected.kind !== 'projected') {
		throw new Error(`the probe point did not project: ${projected.code}`);
	}
	return projected.css;
}

/** A stub Scene planner: it is handed an explicit plane point, never a Y or a support. */
function placeSceneObject(point: { readonly x: number; readonly z: number }, supportY: number) {
	return { position: [point.x, supportY, point.z] as [number, number, number] };
}

describe('viewport-projection-v1 — consumer probes through the public editor host', () => {
	it('lets a T2-style adapter project a canonical Scene entity and resolve a working-plane point', async () => {
		const { facade, snapshot } = await mount();
		const entity = snapshot.domain.scene.entities.find((candidate) => candidate.kind === 'primitive');
		expect(entity, 'the fixture must carry one primitive Scene entity').toBeDefined();
		if (entity === undefined) return;
		const world = entity.position;

		// A deterministic frame: the consumer's own Fit request through the host, when
		// the compile has bounds to fit (the initial inspected pose is the fallback).
		const bounds = snapshot.domain.geometry.bounds;
		if (bounds !== null) {
			expect(
				facade.requestViewingIntent(
					{ kind: 'fit', bounds: { min: bounds.min, max: bounds.max }, rect: RECT },
					facade.inspectionTicket(),
					1
				).kind
			).toBe('accepted');
		}

		const observed: Observed = { context: null };
		const registered = facade.registerStageAdapter({
			id: 'probe-scene-adapter',
			requiredCapabilities: ['viewport-projection-v1'],
			overlay: (context) => {
				observed.context = context;
				return [];
			}
		});
		expect(registered.kind).toBe('registered');
		if (registered.kind !== 'registered') return;

		// 3D: the adapter's projection *is* the host's own projection.
		const id3d = settle(facade, 1.5);
		facade.overlays();
		const in3d = contextOf(observed);
		expect(in3d.evaluationId).toBe(id3d);
		const projected3d = in3d.project(world);
		expect(projected3d).toEqual(cssOf(facade, world, id3d));
		expect(facade.evaluation()?.settledReading).toBe('3d');

		// Plan: the same entity, still through one evaluation, and a real reading change.
		expect(in3d.requestIntent({ kind: 'set-reading', reading: 'plan' }, 1.5).kind).toBe('accepted');
		const idPlan = settle(facade, CLOCK_SETTLED);
		facade.overlays();
		const inPlan = contextOf(observed);
		expect(inPlan.evaluationId).toBe(idPlan);
		const evaluation = facade.evaluation();
		expect(evaluation?.settledReading).toBe('plan');
		expect(evaluation?.projectionKind).toBe('plan-orthographic');
		const projectedPlan = inPlan.project(world);
		expect(projectedPlan).toEqual(cssOf(facade, world, idPlan));
		expect(projectedPlan).not.toEqual(projected3d);

		// The inverse round trip: CSS → ray → the datum plane returns the point that
		// was projected. Plan is exactly orthographic, so XZ survives exactly.
		const css = projectedPlan;
		expect(css).not.toBeNull();
		if (css === null) return;
		const ray = inPlan.ray(css);
		expect(ray).not.toBeNull();
		if (ray === null) return;
		const hit = inPlan.intersect(ray, datumWorkingPlane(snapshot.domain.datumMeters));
		expect(hit.kind).toBe('intersected');
		if (hit.kind !== 'intersected') return;
		// The settled Plan is orthographic and to scale, so the round trip returns the
		// projected point's own XZ. The entity sits half a metre above the datum and
		// the Plan pose is a hair off vertical (a nondegenerate up vector), so the
		// tolerance is a centimetre rather than exact equality.
		expect(hit.worldPoint[1]).toBeCloseTo(snapshot.domain.datumMeters, 6);
		expect(hit.worldPoint[0]).toBeCloseTo(world[0], 2);
		expect(hit.worldPoint[2]).toBeCloseTo(world[2], 2);

		// The host authors no Y and chooses no support: the consumer's own planner
		// receives the explicit plane point and decides the rest.
		const placed = placeSceneObject(
			{ x: hit.worldPoint[0], z: hit.worldPoint[2] },
			snapshot.domain.datumMeters
		);
		expect(placed.position[0]).toBeCloseTo(world[0], 2);
		expect(placed.position[2]).toBeCloseTo(world[2], 2);

		// Teardown: the registration is gone, and the seam keeps nothing of it.
		registered.dispose();
		expect(facade.adapters()).toEqual([]);
		expect(facade.overlays()).toEqual([]);
	});

	it('lets a T3-style adapter project a read-only Camera subject under one inspection claim', async () => {
		const { facade, snapshot } = await mount();
		const node = snapshot.domain.scene.navigationNodes[0];
		expect(node, 'the fixture must carry one Camera navigation node').toBeDefined();
		if (node === undefined) return;
		const eye = node.position;
		const target = node.cameraTarget;

		const observed: Observed = { context: null };
		const registered = facade.registerStageAdapter({
			id: 'probe-camera-adapter',
			requiredCapabilities: ['viewport-projection-v1'],
			overlay: (context) => {
				observed.context = context;
				const eyeCss = context.project(eye);
				const targetCss = context.project(target);
				return [
					...(eyeCss === null ? [] : [{ id: 'camera-eye', css: eyeCss, label: `${node.label} eye` }]),
					...(targetCss === null
						? []
						: [{ id: 'camera-target', css: targetCss, label: `${node.label} target` }])
				];
			}
		});
		expect(registered.kind).toBe('registered');
		if (registered.kind !== 'registered') return;

		const id = settle(facade, 1);
		const claim = facade.inspectionClaim();
		expect(claim).not.toBeNull();
		if (claim === null) return;
		const runEpoch = claim.ticket.runEpoch;

		// The overlay contributes exactly the host's own projections of the read-only
		// Camera subject — one evaluation, so the marker cannot disagree with the mesh.
		const overlays = facade.overlays();
		expect(overlays).toEqual([
			{ id: 'camera-eye', css: cssOf(facade, eye, id), label: `${node.label} eye` },
			{ id: 'camera-target', css: cssOf(facade, target, id), label: `${node.label} target` }
		]);
		// Rendering changes no ownership: the same run still holds the one output.
		expect(facade.inspectionClaim()?.ticket.runEpoch).toBe(runEpoch);

		// The adapter consumes a Camera inspection request through the claim.
		expect(contextOf(observed).requestIntent({ kind: 'zoom', scale: 1.2 }, 1).kind).toBe('accepted');

		// One output, one controller: a retained ticket cannot drive a replaced claim.
		const retained = facade.inspectionTicket();
		expect(retained).not.toBeNull();
		if (retained === null) return;
		expect(facade.acquireInspection('ordered-replacement').kind).toBe('acquired');
		expect(facade.requestViewingIntent({ kind: 'zoom', scale: 1.2 }, retained, 1).kind).toBe('superseded');

		// The instrument slot mounts and unmounts without touching the Camera: the
		// pose and the live output are exactly what they were.
		const pose = facade.camera.state().pose;
		const evaluationBefore = facade.evaluationId();
		expect(facade.openTask({ kind: 'camera-summary', label: 'Camera summary', targetRef: null })).toBe(true);
		expect(facade.session.task()?.label).toBe('Camera summary');
		expect(facade.camera.state().pose).toEqual(pose);
		expect(facade.evaluationId()).toBe(evaluationBefore);
		expect(facade.closeTask()).toBe(true);
		expect(facade.session.task()).toBeNull();
		expect(facade.camera.state().pose).toEqual(pose);

		// A deliberate selection request is the only way an adapter changes the one
		// canonical selection — it receives no writable store.
		const fragment = facade.eligibleFragments()[0];
		expect(fragment).toBeDefined();
		if (fragment === undefined) return;
		contextOf(observed).select({
			sourceId: fragment.ref.sourceId,
			sourceKind: fragment.ref.sourceKind,
			generationId: fragment.ref.generationId,
			ref: fragment.ref
		});
		expect(facade.selection()?.sourceId).toBe(fragment.ref.sourceId);
		expect(contextOf(observed).selection()?.sourceId).toBe(fragment.ref.sourceId);

		registered.dispose();
		expect(facade.adapters()).toEqual([]);
	});
});
