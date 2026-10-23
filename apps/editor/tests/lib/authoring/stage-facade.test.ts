/**
 * The Stage facade is the **consumer boundary** of `T1.viewport-projection@1`.
 *
 * Four claims are pinned here, in the order the seam makes them:
 *
 * 1. one evaluation drives the meshes, the Plan and the hit path, so the render
 *    and the selection cannot disagree about which generation is live;
 * 2. a source the Plan excludes can never intercept input, and Reveal widens the
 *    **hit** path as well as display — the same room floor is unpickable while it
 *    is `filtered-type` and pickable once it is revealed;
 * 3. there is one selection owner, one task home and one gesture lease, and an
 *    adapter that requires a capability this host does not provide refuses to
 *    mount rather than mounting degraded;
 * 4. inspection ownership is the landed ticket protocol's answer: a viewing intent
 *    presented without the live claim is `superseded`, never silently applied.
 *
 * Every source here is built through the retained chain planner and admitted
 * through the one admission path, so the suite exercises the host on real
 * current-format documents rather than on hand-written shapes.
 */
import { describe, expect, it } from 'vitest';
import { VIEWPORT_READING_TRANSITION_SECONDS } from '@portfolio/camera-core';
import {
	createEmptyWallFirstLayoutDocument,
	planCreateWallFirstOpening,
	planWallChain,
	type LayoutVec2
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import {
	admitSource,
	type AdmissionContext,
	type StageReadSnapshot
} from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import {
	createStageFacade,
	HOST_STAGE_CAPABILITIES,
	type StageFacade
} from '$lib/authoring/stage/stage-facade';
import { STARTER_ENCLOSURE_POINTS } from '$lib/authoring/stage/starter-gallery';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const PROJECT_ID = 'project-stage-facade';
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

/** A real closed enclosure through the retained chain planner: no literal topology. */
async function enclosureProject(points: readonly LayoutVec2[], id: string = PROJECT_ID): Promise<ProjectEnvelope> {
	const plan = planWallChain({
		baseline: createEmptyWallFirstLayoutDocument(),
		points: points.map((point) => [point[0], point[1]] as LayoutVec2),
		close: true,
		capture: freshCapture(),
		levelId: createEmptyWallFirstLayoutDocument().floor.id
	});
	if (plan.kind !== 'success') throw new Error(`the enclosure no longer plans: ${plan.rejection.code}`);
	return createUnitProject({ id, name: 'Stage facade project', layout: plan.document });
}

/** The enclosure with one door opening, so its first Wall has two solid spans. */
async function enclosureWithDoor(): Promise<ProjectEnvelope> {
	const base = await enclosureProject(STARTER_ENCLOSURE_POINTS);
	const baseLayout = base.units.layout.data;
	const wallId = baseLayout.walls[0]!.id;
	const door = planCreateWallFirstOpening(
		baseLayout,
		{
			wallId,
			kind: 'door',
			offset: 0.5,
			width: 1,
			height: 2.1,
			sillHeight: 0
		},
		freshCapture(),
		baseLayout.floor.id
	);
	if (door.kind !== 'success') throw new Error(`the door fixture no longer plans: ${door.rejection.code}`);
	return createUnitProject({ id: base.id, name: base.name, layout: door.document });
}

let revisionCounter = 0;

/** A fresh acceptance context, as the route host supplies per boot. */
function admissionContext(projectId: string = PROJECT_ID): AdmissionContext {
	revisionCounter += 1;
	return {
		sessionEpoch: `session-${revisionCounter}`,
		acceptedRevision: { projectId, revisionId: `revision-${revisionCounter}` }
	};
}

type Mounted = {
	readonly facade: StageFacade;
	readonly session: StageSession;
	readonly snapshot: StageReadSnapshot;
	readonly revision: number;
};

/** The host's own mount order: admit, replace the session, then create the facade. */
async function mount(document?: ProjectEnvelope): Promise<Mounted> {
	const source = document ?? (await enclosureProject(STARTER_ENCLOSURE_POINTS));
	const context = admissionContext(source.id);
	const admitted = await admitSource(source, context);
	if (admitted.kind !== 'admitted') throw new Error(`the fixture source was not admitted: ${admitted.kind}`);
	const session = createStageSession({ sessionEpoch: context.sessionEpoch });
	session.replace(admitted.snapshot);
	const facade = createStageFacade({ snapshot: admitted.snapshot, session });
	return { facade, session, snapshot: admitted.snapshot, revision: revisionCounter };
}

/** Evaluate once at an explicit clock and keep the result as the current output. */
function evaluate(facade: StageFacade): string {
	const result = facade.camera.evaluate(RECT, 1);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	return facade.evaluationId() ?? '';
}

/** The project-world XZ centre of one fragment's geometry, at its own elevation. */
function fragmentCentre(fragment: { geometry: unknown; elevationMeters: number }): [number, number, number] | null {
	const geometry = fragment.geometry as
		| { kind: 'span'; start: LayoutVec2; end: LayoutVec2 }
		| { kind: 'polyline'; polyline: readonly LayoutVec2[] }
		| { kind: 'polygon'; polygon: readonly LayoutVec2[] };
	const points =
		geometry.kind === 'span'
			? [geometry.start, geometry.end]
			: geometry.kind === 'polyline'
				? geometry.polyline
				: geometry.polygon;
	if (points.length === 0) return null;
	const centre = points.reduce<[number, number]>(
		(accumulator, point) => [accumulator[0] + point[0] / points.length, accumulator[1] + point[1] / points.length],
		[0, 0]
	);
	return [centre[0], fragment.elevationMeters, centre[1]];
}

describe('Stage facade — one evaluation, one Plan, one selection owner', () => {
	it('names every Plan fragment with the snapshot compile generation and the live evaluation', async () => {
		const { facade, snapshot } = await mount();
		const plan = facade.plan();
		expect(plan.kind).toBe('evaluated');
		if (plan.kind !== 'evaluated') return;

		// The generation is the host's own, so a stale fragment cannot be selected
		// into a later content state.
		expect(plan.plan.generationId).toBe(snapshot.compileGeneration);
		expect(plan.plan.fragments.length).toBeGreaterThan(0);
		for (const fragment of plan.plan.fragments) {
			expect(fragment.ref.generationId).toBe(snapshot.compileGeneration);
		}
		expect(facade.eligibleFragments().length).toBeGreaterThan(0);

		// A hit is judged against the live evaluation: the id that names it is the
		// one the evaluation itself carries, and any other is explicitly stale.
		const id = evaluate(facade);
		const evaluation = facade.evaluation();
		expect(evaluation).not.toBeNull();
		if (evaluation === null) return;
		expect(id).toBe(
			`${evaluation.token.outputId}::${evaluation.token.sessionEpoch}::${evaluation.token.sourceRevision}::${evaluation.token.evaluationGeneration}`
		);
		const bounds = snapshot.domain.geometry.bounds;
		expect(bounds).not.toBeNull();
		if (bounds === null) return;
		const centre: [number, number, number] = [
			(bounds.min[0] + bounds.max[0]) / 2,
			(bounds.min[1] + bounds.max[1]) / 2,
			(bounds.min[2] + bounds.max[2]) / 2
		];
		expect(facade.projectWorld(centre, id).kind).toBe('projected');
		expect(facade.projectWorld(centre, 'not-the-live-evaluation').kind).toBe('failed');
	});

	it('resolves a hit on an eligible fragment through its own projection', async () => {
		const { facade } = await mount();
		const id = evaluate(facade);
		const eligible = facade.eligibleFragments();
		const eligibleIds = new Set(eligible.map((fragment) => fragment.ref.sourceId));

		let selfResolved = 0;
		for (const fragment of eligible) {
			const centre = fragmentCentre(fragment);
			if (centre === null) continue;
			const projected = facade.projectWorld(centre, id);
			expect(projected.kind).toBe('projected');
			if (projected.kind !== 'projected') continue;
			const hit = facade.resolveSourceHit({ evaluationId: id, css: projected.css });
			if (hit.kind === 'resolved') {
				// Whichever fragment wins at that point, it is always one the Plan
				// itself called eligible.
				expect(eligibleIds.has(hit.hit.sourceId)).toBe(true);
				if (hit.hit.sourceId === fragment.ref.sourceId) selfResolved += 1;
			}
		}
		expect(selfResolved).toBeGreaterThan(0);

		// A candidate from another evaluation generation is refused, not resolved.
		expect(facade.resolveSourceHit({ evaluationId: 'stale', css: [10, 10] })).toEqual({
			kind: 'failed',
			code: 'stale-evaluation'
		});
	});

	it('keeps an excluded source unpickable, while Reveal widens the hit path too', async () => {
		const { facade } = await mount();
		const id = evaluate(facade);
		const defaultPlan = facade.plan();
		expect(defaultPlan.kind).toBe('evaluated');
		if (defaultPlan.kind !== 'evaluated') return;
		const floor = defaultPlan.plan.membership.find((row) => row.sourceKind === 'room-floor');
		expect(floor, 'the enclosure must compile a room-floor source').toBeDefined();
		if (floor === undefined) return;

		// The point the room-floor polygon covers: pickable by default.
		const interior: [number, number, number] = [
			STARTER_ENCLOSURE_POINTS.reduce((sum, point) => sum + point[0], 0) / STARTER_ENCLOSURE_POINTS.length,
			0,
			STARTER_ENCLOSURE_POINTS.reduce((sum, point) => sum + point[1], 0) / STARTER_ENCLOSURE_POINTS.length
		];
		const projected = facade.projectWorld(interior, id);
		expect(projected.kind).toBe('projected');
		if (projected.kind !== 'projected') return;
		const css: [number, number] = [projected.css[0], projected.css[1]];
		const before = facade.resolveSourceHit({ evaluationId: id, css });
		expect(before.kind === 'resolved' ? before.hit.sourceId : null).toBe(floor.sourceId);

		// Filtered out: the source stays discoverable but is not selectable, and the
		// very same click cannot select it.
		facade.setPlanParameters({ sourceKindFilter: ['wall'] });
		const filtered = facade.plan();
		expect(filtered.kind).toBe('evaluated');
		if (filtered.kind !== 'evaluated') return;
		const excluded = filtered.plan.membership.find((row) => row.sourceId === floor.sourceId);
		expect(excluded?.reason).toBe('filtered-type');
		expect(excluded?.eligible).toBe(false);
		// The excluded source places no fragment at all, so the very same click has
		// nothing to intercept: exclusion is structural, not a filter at the hit test.
		expect(filtered.plan.fragments.some((fragment) => fragment.ref.sourceId === floor.sourceId)).toBe(false);
		expect(facade.resolveSourceHit({ evaluationId: id, css })).toEqual({ kind: 'none', reason: 'no-fragment' });

		// Reveal is creator intent that widens display *and* hit eligibility, while
		// the declared reason stays exactly what it was.
		facade.setPlanParameters({ sourceKindFilter: ['wall'], reveal: [floor.sourceId] });
		const revealed = facade.plan();
		expect(revealed.kind).toBe('evaluated');
		if (revealed.kind !== 'evaluated') return;
		const widened = revealed.plan.membership.find((row) => row.sourceId === floor.sourceId);
		expect(widened?.reason).toBe('filtered-type');
		expect(widened?.revealed).toBe(true);
		expect(widened?.eligible).toBe(true);
		const after = facade.resolveSourceHit({ evaluationId: id, css });
		expect(after.kind === 'resolved' ? after.hit.sourceId : null).toBe(floor.sourceId);

		// Sweep the whole frame: no ineligible source may ever intercept input, and
		// every resolved identity is one the Plan called eligible.
		const eligibleIds = new Set(
			revealed.plan.membership.filter((row) => row.eligible).map((row) => row.sourceId)
		);
		for (let x = 0; x <= RECT.width; x += 160) {
			for (let y = 0; y <= RECT.height; y += 120) {
				const hit = facade.resolveSourceHit({ evaluationId: id, css: [x, y] });
				if (hit.kind === 'resolved') expect(eligibleIds.has(hit.hit.sourceId)).toBe(true);
			}
		}
	});

	it('resolves a Stage-local candidate when the Stage does not start at the window origin', async () => {
		// The Index sits beside the Stage, so the surface is offset in the window.
		// The route sends Stage-local CSS; the Camera projects into viewport CSS.
		// The facade is the one boundary that translates, or a click selects a
		// subject one Index panel away from the one under the pointer.
		const OFFSET_RECT = { left: 352, top: 119, width: 928, height: 458, devicePixelRatio: 1 };
		const { facade } = await mount();
		expect(facade.camera.evaluate(OFFSET_RECT, 1).kind).toBe('evaluated');
		const id = facade.evaluationId() ?? '';
		const planResult = facade.plan();
		expect(planResult.kind).toBe('evaluated');
		if (planResult.kind !== 'evaluated') return;
		const floor = planResult.plan.membership.find((row) => row.sourceKind === 'room-floor');
		expect(floor).toBeDefined();
		if (floor === undefined) return;
		const interior: [number, number, number] = [
			STARTER_ENCLOSURE_POINTS.reduce((sum, point) => sum + point[0], 0) / STARTER_ENCLOSURE_POINTS.length,
			0,
			STARTER_ENCLOSURE_POINTS.reduce((sum, point) => sum + point[1], 0) / STARTER_ENCLOSURE_POINTS.length
		];
		const projected = facade.projectWorld(interior, id);
		expect(projected.kind).toBe('projected');
		if (projected.kind !== 'projected') return;
		const local: [number, number] = [
			projected.css[0] - OFFSET_RECT.left,
			projected.css[1] - OFFSET_RECT.top
		];
		const hit = facade.resolveSourceHit({ evaluationId: id, css: local });
		expect(hit.kind === 'resolved' ? hit.hit.sourceId : null).toBe(floor.sourceId);
	});

	it('paints adapter markers in Stage-local CSS when the Stage is offset in the window', async () => {
		const OFFSET_RECT = { left: 352, top: 119, width: 928, height: 458, devicePixelRatio: 1 };
		const { facade } = await mount();
		expect(facade.camera.evaluate(OFFSET_RECT, 1).kind).toBe('evaluated');
		const id = facade.evaluationId() ?? '';
		const point: [number, number, number] = [
			STARTER_ENCLOSURE_POINTS.reduce((sum, p) => sum + p[0], 0) / STARTER_ENCLOSURE_POINTS.length,
			0,
			STARTER_ENCLOSURE_POINTS.reduce((sum, p) => sum + p[1], 0) / STARTER_ENCLOSURE_POINTS.length
		];
		facade.registerStageAdapter({
			id: 'probe-offset-marker',
			requiredCapabilities: [HOST_STAGE_CAPABILITIES[0]!],
			overlay: (context) => {
				const css = context.project(point);
				return css === null ? [] : [{ id: 'probe-offset-marker', css, label: 'probe' }];
			}
		});
		const projected = facade.projectWorld(point, id);
		expect(projected.kind).toBe('projected');
		if (projected.kind !== 'projected') return;
		const marker = facade.overlays().find((contribution) => contribution.id === 'probe-offset-marker');
		expect(marker?.css).toEqual([
			projected.css[0] - OFFSET_RECT.left,
			projected.css[1] - OFFSET_RECT.top
		]);
		// Inside the surface box the overlay actually paints in.
		expect(marker!.css[0]).toBeGreaterThanOrEqual(0);
		expect(marker!.css[0]).toBeLessThanOrEqual(OFFSET_RECT.width);
	});

	it('keeps one selection owner and one task home', async () => {
		const { facade, session, snapshot } = await mount();
		const fragment = facade.eligibleFragments()[0];
		expect(fragment).toBeDefined();
		if (fragment === undefined) return;
		facade.select({
			sourceId: fragment.ref.sourceId,
			sourceKind: fragment.ref.sourceKind,
			generationId: fragment.ref.generationId,
			ref: fragment.ref
		});
		expect(session.selection()?.sourceId).toBe(fragment.ref.sourceId);
		expect(facade.selection()?.generationId).toBe(snapshot.compileGeneration);
		facade.select(null);
		expect(facade.selection()).toBeNull();

		// One task home: opening replaces, closing reports whether anything closed.
		expect(
			facade.openTask({ kind: 'subject-membership', label: 'Plan membership', targetRef: fragment.ref })
		).toBe(true);
		expect(facade.closeTask()).toBe(true);
		expect(facade.closeTask()).toBe(false);
	});

	it('grants one gesture lease at a time and releases it exactly once', async () => {
		const { facade } = await mount();
		const id = evaluate(facade);
		const first = facade.acquireGesture({
			owner: 'stage-pointer',
			evaluationId: id,
			policy: 'continue-after-revalidation'
		});
		expect(first.kind).toBe('granted');
		if (first.kind !== 'granted') return;
		expect(facade.acquireGesture({ owner: 'navigation', evaluationId: id, policy: 'suspend-proposal' })).toEqual({
			kind: 'refused',
			code: 'gesture-held',
			owner: 'stage-pointer'
		});
		first.lease.release();
		const second = facade.acquireGesture({ owner: 'navigation', evaluationId: id, policy: 'suspend-proposal' });
		expect(second.kind).toBe('granted');
	});

	it('does not notify adapter listeners when a gesture lease is granted', async () => {
		const { facade } = await mount();
		const id = evaluate(facade);
		let notifications = 0;
		const unsubscribe = facade.onAdaptersChanged(() => {
			notifications += 1;
		});

		const outcome = facade.acquireGesture({
			owner: 'layout-dimensions',
			evaluationId: id,
			policy: 'suspend-proposal'
		});
		expect(outcome.kind).toBe('granted');
		if (outcome.kind !== 'granted') return;

		// A lease is not a contribution change. Notifying here would rebuild the
		// factory adapters and dispose the instrument that just took the lease, so
		// Undo could never actually observe `live-proposal`.
		expect(notifications).toBe(0);

		outcome.lease.release();
		expect(notifications).toBe(0);
		unsubscribe();
	});

	it('refuses an adapter that requires a capability this host does not provide', async () => {
		const { facade } = await mount();

		const refused = facade.registerStageAdapter({
			id: 'probe-unknown-capability',
			requiredCapabilities: ['experience-renderer-v1'],
			overlay: () => [{ id: 'never', css: [0, 0], label: 'never' }]
		});
		expect(refused.kind).toBe('refused');
		if (refused.kind !== 'refused') return;
		expect(refused.code).toBe('unknown-required-capability');
		expect(refused.missing).toEqual(['experience-renderer-v1']);
		expect(facade.adapters()).toEqual([]);

		const registered = facade.registerStageAdapter({
			id: 'probe-adapter',
			requiredCapabilities: [HOST_STAGE_CAPABILITIES[0]!],
			overlay: () => [{ id: 'probe-marker', css: [12, 24], label: 'probe' }]
		});
		expect(registered.kind).toBe('registered');
		if (registered.kind !== 'registered') return;
		expect(facade.adapters().map((adapter) => adapter.id)).toEqual(['probe-adapter']);

		// One registration per id, and an explicit end rather than a silent one.
		expect(facade.registerStageAdapter({ id: 'probe-adapter' }).kind).toBe('refused');
		evaluate(facade);
		expect(facade.overlays().map((overlay) => overlay.id)).toEqual(['probe-marker']);
		registered.dispose();
		expect(facade.overlays()).toEqual([]);
	});

	it('treats a viewing intent without the live claim as superseded, never as applied', async () => {
		const { facade } = await mount();
		const before = facade.camera.state().pose;

		// No claim: the host has not acquired its inspection output yet.
		const unowned = facade.requestViewingIntent({ kind: 'zoom', scale: 2 }, null, 1);
		expect(unowned.kind).toBe('superseded');
		expect(facade.camera.state().pose).toEqual(before);

		const acquired = facade.acquireInspection('exclusive');
		expect(acquired.kind).toBe('acquired');
		const ticket = facade.inspectionTicket();
		expect(ticket).not.toBeNull();
		expect(facade.inspectionClaim()?.ticket.runEpoch).toBe(ticket?.runEpoch);

		const accepted = facade.requestViewingIntent({ kind: 'zoom', scale: 2 }, ticket, 1);
		expect(accepted.kind).toBe('accepted');

		// A ticket for another output is refused by the protocol, not by a field
		// comparison that could coincidentally match.
		const foreign = facade.requestViewingIntent(
			{ kind: 'zoom', scale: 2 },
			{ ...ticket!, outputId: 'another-output' },
			1
		);
		expect(foreign.kind).toBe('superseded');

		// A spent run epoch cannot request again once the output moved on.
		const refreshed = facade.acquireInspection('ordered-replacement');
		expect(refreshed.kind).toBe('acquired');
		expect(facade.inspectionTicket()?.runEpoch).toBeGreaterThan(ticket!.runEpoch);
		expect(facade.requestViewingIntent({ kind: 'zoom', scale: 2 }, ticket, 1).kind).toBe('superseded');
	});

	it('lets a domain adapter claim a candidate the Layout Plan resolves to nothing', async () => {
		const { facade, snapshot } = await mount();
		const id = evaluate(facade);

		// A frame point where the built-in Layout resolution finds nothing: the Plan
		// places fragments only where a compiled source is, so the corners of the
		// frame are the honest free space.
		let freeCss: [number, number] | null = null;
		for (let x = 8; x < RECT.width && freeCss === null; x += 24) {
			for (let y = 8; y < RECT.height; y += 24) {
				if (facade.resolveSourceHit({ evaluationId: id, css: [x, y] }).kind === 'none') {
					freeCss = [x, y];
					break;
				}
			}
		}
		expect(freeCss, 'the frame must have at least one point with nothing selectable').not.toBeNull();
		if (freeCss === null) return;
		expect(facade.resolveSourceHit({ evaluationId: id, css: freeCss })).toEqual({
			kind: 'none',
			reason: 'no-fragment'
		});

		// `hitProvider` was declared on the seam but never consulted, so a T2/T3
		// adapter could register a 3D picker and nothing it offered was reachable.
		const contexts: string[] = [];
		const probe = facade.registerStageAdapter({
			id: 'scene-probe',
			hitProvider: (candidate, context) => {
				contexts.push(context.evaluationId);
				if (candidate.css[0] !== freeCss[0] || candidate.css[1] !== freeCss[1]) return null;
				return {
					sourceId: 'entity-plinth',
					sourceKind: 'object',
					generationId: snapshot.compileGeneration,
					stream: 'symbol',
					subRef: null,
					worldPoint: [0, 0, 0]
				};
			}
		});
		expect(probe.kind).toBe('registered');

		const claimed = facade.resolveSourceHit({ evaluationId: id, css: freeCss });
		expect(claimed.kind === 'resolved' ? claimed.hit.sourceId : null).toBe('entity-plinth');
		expect(contexts).toEqual([id]);
		// The provider is handed the host's own live evaluation, never a second one.
		const withContext = facade.adapters()[0];
		expect(withContext?.hitProvider).toBeDefined();

		// A provider that declines leaves the candidate to the next claimant, and the
		// built-in Layout resolution still answers over the drawn room floor:
		// adapter-first order changes nothing while no adapter claims.
		const floorPlan = facade.plan();
		expect(floorPlan.kind).toBe('evaluated');
		if (floorPlan.kind !== 'evaluated') return;
		const floorId = floorPlan.plan.membership.find((row) => row.sourceKind === 'room-floor')?.sourceId;
		expect(floorId).toBeDefined();
		const onFloor = (() => {
			const floor = facade.eligibleFragments().find((fragment) => fragment.ref.sourceId === floorId);
			if (floor === undefined) return null;
			const geometry = floor.geometry;
			const points =
				geometry.kind === 'span'
					? [geometry.start, geometry.end]
					: geometry.kind === 'polyline'
						? geometry.polyline
						: geometry.polygon;
			const middle = points.reduce<[number, number]>(
				(accumulator, point) => [
					accumulator[0] + point[0] / points.length,
					accumulator[1] + point[1] / points.length
				],
				[0, 0]
			);
			return facade.projectWorld([middle[0], floor.elevationMeters, middle[1]], id);
		})();
		expect(onFloor?.kind).toBe('projected');
		if (onFloor === null || onFloor === undefined || onFloor.kind !== 'projected') return;
		const layoutHit = facade.resolveSourceHit({ evaluationId: id, css: onFloor.css });
		expect(layoutHit.kind === 'resolved' ? layoutHit.hit.sourceKind : null).toBe('room-floor');

		// Registration order is the deterministic tie rule: a later adapter that
		// claims the same point wins over Layout's own fragment, and the host never
		// invents a cross-domain priority it cannot measure.
		const claiming = facade.registerStageAdapter({
			id: 'scene-claim-all',
			hitProvider: () => ({
				sourceId: 'entity-claim',
				sourceKind: 'object',
				generationId: snapshot.compileGeneration,
				stream: 'symbol',
				subRef: null,
				worldPoint: [0, 0, 0]
			})
		});
		expect(claiming.kind).toBe('registered');
		const overridden = facade.resolveSourceHit({ evaluationId: id, css: onFloor.css });
		expect(overridden.kind === 'resolved' ? overridden.hit.sourceId : null).toBe('entity-claim');

		// A stale candidate is refused before any provider is asked: a provider must
		// never see a candidate from an evaluation the host no longer publishes.
		const callsBefore = contexts.length;
		expect(facade.resolveSourceHit({ evaluationId: 'stale', css: freeCss })).toEqual({
			kind: 'failed',
			code: 'stale-evaluation'
		});
		expect(contexts.length).toBe(callsBefore);

		// Ending the registrations ends their reach too.
		if (claiming.kind === 'registered') claiming.dispose();
		if (probe.kind === 'registered') probe.dispose();
		expect(facade.resolveSourceHit({ evaluationId: id, css: freeCss })).toEqual({
			kind: 'none',
			reason: 'no-fragment'
		});
	});

	it('runs the live gesture policy once when a reading change is accepted', async () => {
		const { facade, session } = await mount();
		const id = evaluate(facade);
		facade.acquireInspection('exclusive');
		const ticket = facade.inspectionTicket();
		expect(ticket).not.toBeNull();
		if (ticket === null) return;

		// `cancel-on-reading-change` is T2.S03's dependency: the gesture must be gone
		// *before* a frame draws the flip, or its samples pan a 3D gesture in Plan.
		const cancelling = facade.acquireGesture({
			owner: 'stage-pointer',
			evaluationId: id,
			policy: 'cancel-on-reading-change'
		});
		expect(cancelling.kind).toBe('granted');
		const flip = facade.requestViewingIntent({ kind: 'set-reading', reading: 'plan' }, ticket, 1);
		expect(flip.kind).toBe('accepted');
		expect(session.gesture()).toBeNull();
		expect(facade.evaluation()?.settledReading).toBe('3d');

		const settled = facade.camera.evaluate(RECT, 1 + VIEWPORT_READING_TRANSITION_SECONDS + 0.5);
		expect(settled.kind).toBe('evaluated');
		if (settled.kind !== 'evaluated') return;
		expect(settled.evaluation.settledReading).toBe('plan');

		// `continue-after-revalidation` keeps the same lease across the same flip: the
		// accepted revision is unchanged, so the operation it names is unchanged.
		const continuing = facade.acquireGesture({
			owner: 'stage-pointer',
			evaluationId: facade.evaluationId() ?? '',
			policy: 'continue-after-revalidation'
		});
		expect(continuing.kind).toBe('granted');
		const back = facade.requestViewingIntent({ kind: 'set-reading', reading: '3d' }, ticket, 10);
		expect(back.kind).toBe('accepted');
		expect(session.gesture()).toBe(continuing.kind === 'granted' ? continuing.lease : null);

		// A reading request the evaluator refuses changes no projection, so the policy
		// must not run: the lease survives a no-op Plan press.
		const again = facade.camera.evaluate(RECT, 10 + VIEWPORT_READING_TRANSITION_SECONDS + 0.5);
		expect(again.kind).toBe('evaluated');
		const refused = facade.requestViewingIntent({ kind: 'set-reading', reading: '3d' }, ticket, 40);
		expect(refused.kind).toBe('rejected');
		expect(session.gesture()).not.toBeNull();
	});

	it('selects the visible Wall in the 3D reading, where a datum-plane pick lands metres away', async () => {
		const { facade } = await mount();
		facade.acquireInspection('exclusive');
		const bounds = facade.snapshot().domain.geometry.bounds;
		expect(bounds).not.toBeNull();
		if (bounds === null) return;
		// Frame the enclosure and keep the 3D reading: this is the ordinary 3D view a
		// creator clicks in, not a top-down Plan where the two models coincide.
		expect(
			facade.requestViewingIntent(
				{ kind: 'fit', bounds: { min: bounds.min, max: bounds.max }, rect: RECT },
				facade.inspectionTicket(),
				1
			).kind
		).toBe('accepted');
		const id = evaluate(facade);
		expect(facade.evaluation()?.settledReading).toBe('3d');

		const wall = facade.eligibleFragments().find((fragment) => fragment.ref.sourceKind === 'wall');
		expect(wall).toBeDefined();
		if (wall === undefined) return;
		const geometry = wall.geometry;
		const points =
			geometry.kind === 'span'
				? [geometry.start, geometry.end]
				: geometry.kind === 'polyline'
					? geometry.polyline
					: geometry.polygon;
		const start = points[0];
		const end = points[Math.min(1, points.length - 1)];
		if (start === undefined || end === undefined) return;
		const midpoint: [number, number, number] = [
			(start[0] + end[0]) / 2,
			wall.elevationMeters,
			(start[1] + end[1]) / 2
		];
		const onWall = facade.projectWorld(midpoint, id);
		expect(onWall.kind).toBe('projected');
		if (onWall.kind !== 'projected') return;
		const hit = facade.resolveSourceHit({ evaluationId: id, css: onWall.css });
		expect(hit.kind === 'resolved' ? hit.hit.sourceId : null).toBe(wall.ref.sourceId);

		// The middle of the drawn face, not its top edge: a Wall is a surface, so a
		// click anywhere on the band between its footprint and its top must land on
		// it. Testing only the top line left the whole visible face unpickable.
		const datum = facade.snapshot().domain.datumMeters;
		const onFace = facade.projectWorld(
			[(start[0] + end[0]) / 2, datum + (wall.elevationMeters - datum) / 2, (start[1] + end[1]) / 2],
			id
		);
		expect(onFace.kind).toBe('projected');
		if (onFace.kind !== 'projected') return;
		const faceHit = facade.resolveSourceHit({ evaluationId: id, css: onFace.css });
		expect(faceHit.kind === 'resolved' ? faceHit.hit.sourceId : null).toBe(wall.ref.sourceId);
	});

	it('picks the Wall above the Plan cut, where the cut fragment is shorter than the Wall', async () => {
		const { facade } = await mount();
		facade.acquireInspection('exclusive');
		const bounds = facade.snapshot().domain.geometry.bounds;
		expect(bounds).not.toBeNull();
		if (bounds === null) return;
		expect(
			facade.requestViewingIntent(
				{ kind: 'fit', bounds: { min: bounds.min, max: bounds.max }, rect: RECT },
				facade.inspectionTicket(),
				1
			).kind
		).toBe('accepted');
		const id = evaluate(facade);
		const datum = facade.snapshot().domain.datumMeters;

		const plan = facade.plan();
		expect(plan.kind).toBe('evaluated');
		if (plan.kind !== 'evaluated') return;
		const wall = facade.eligibleFragments().find((fragment) => fragment.ref.sourceKind === 'wall');
		expect(wall).toBeDefined();
		if (wall === undefined) return;
		const compiled = facade
			.snapshot()
			.domain.geometry.walls.find((candidate) => candidate.wallId === wall.ref.sourceId);
		expect(compiled).toBeDefined();
		if (compiled === undefined) return;

		// The premise of the defect: the Plan places a Wall's cut fragment **at the cut**,
		// while the Wall is drawn to its own height. A picker built from the fragment's
		// elevation therefore covered only the part of the Wall below 1.2 m.
		expect(wall.ref.stream).toBe('cut');
		expect(wall.elevationMeters).toBeCloseTo(plan.plan.cutHeightMeters + datum, 6);
		expect(compiled.height).toBeGreaterThan(plan.plan.cutHeightMeters + 1);

		const geometry = wall.geometry;
		const points =
			geometry.kind === 'span'
				? [geometry.start, geometry.end]
				: geometry.kind === 'polyline'
					? geometry.polyline
					: geometry.polygon;
		const start = points[0];
		const end = points[Math.min(1, points.length - 1)];
		if (start === undefined || end === undefined) return;
		const along: [number, number] = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];

		// The upper visible region of the Wall: well above the cut, and again just under
		// its top edge. Both must resolve to the Wall, because both are drawn Wall.
		for (const heightFraction of [0.85, 0.98]) {
			const height = datum + compiled.height * heightFraction;
			expect(height).toBeGreaterThan(wall.elevationMeters);
			const projected = facade.projectWorld([along[0], height, along[1]], id);
			expect(projected.kind).toBe('projected');
			if (projected.kind !== 'projected') return;
			const hit = facade.resolveSourceHit({ evaluationId: id, css: projected.css });
			expect(hit.kind === 'resolved' ? hit.hit.sourceKind : null).toBe('wall');
			if (hit.kind !== 'resolved') return;
			expect(hit.hit.sourceId).toBe(wall.ref.sourceId);

			// The reported point lies on the Wall — on its span line in plan, at the height
			// the creator pointed at — not on a horizontal plane at the cut height.
			expect(hit.hit.worldPoint[1]).toBeCloseTo(height, 1);
			const dx = end[0] - start[0];
			const dz = end[1] - start[1];
			const length = Math.hypot(dx, dz);
			const offsetX = hit.hit.worldPoint[0] - start[0];
			const offsetZ = hit.hit.worldPoint[2] - start[1];
			const perpendicular = Math.abs(offsetX * dz - offsetZ * dx) / length;
			expect(perpendicular).toBeLessThan(0.05);
		}
	});

	it('picks only the span its own fragment names, on a Wall split by an Opening', async () => {
		const document = await enclosureWithDoor();
		const { facade } = await mount(document);
		facade.acquireInspection('exclusive');
		const bounds = facade.snapshot().domain.geometry.bounds;
		expect(bounds).not.toBeNull();
		if (bounds === null) return;
		expect(
			facade.requestViewingIntent(
				{ kind: 'fit', bounds: { min: bounds.min, max: bounds.max }, rect: RECT },
				facade.inspectionTicket(),
				1
			).kind
		).toBe('accepted');
		const id = evaluate(facade);
		const datum = facade.snapshot().domain.datumMeters;
		// The Wall the fixture's door sits in: its compiled spans include a lintel that
		// starts at the door head instead of at the datum.
		const splitWall = facade
			.snapshot()
			.domain.geometry.walls.find((wall) => wall.solidSpans.some((span) => span.bottomY > 0));
		expect(splitWall).toBeDefined();
		if (splitWall === undefined) return;
		const wallId = splitWall.wallId;

		// Every Wall placement is its own fragment with its own `interval`, and a Wall split
		// by an Opening has several. Testing the whole Wall from every fragment let the
		// first fragment answer for any other span and report its own sub-ref.
		const spans = facade.eligibleFragments().filter((fragment) => fragment.ref.sourceId === wallId);
		expect(spans.length).toBeGreaterThan(1);

		const intervalOf = (fragment: (typeof spans)[number]): readonly [number, number] => {
			if (fragment.ref.subRef?.kind !== 'interval') throw new Error('a Wall placement lost its interval');
			return [fragment.ref.subRef.start, fragment.ref.subRef.end];
		};
		const midpointOf = (fragment: (typeof spans)[number]): [number, number] => {
			const geometry = fragment.geometry;
			if (geometry.kind !== 'span') throw new Error('a Wall placement is not a span');
			return [(geometry.start[0] + geometry.end[0]) / 2, (geometry.start[1] + geometry.end[1]) / 2];
		};
		const compiledSpanOf = (fragment: (typeof spans)[number]) => {
			const [start, end] = intervalOf(fragment);
			return splitWall.solidSpans.find(
				(span) => Math.abs(span.startDistance - start) < 1e-6 && Math.abs(span.endDistance - end) < 1e-6
			);
		};
		const resolveAt = (point: readonly [number, number], height: number) => {
			const projected = facade.projectWorld([point[0], height, point[1]], id);
			expect(projected.kind).toBe('projected');
			if (projected.kind !== 'projected') throw new Error('the probe did not project');
			return facade.resolveSourceHit({ evaluationId: id, css: projected.css });
		};

		for (const fragment of spans) {
			const span = compiledSpanOf(fragment);
			expect(span, 'every Wall fragment names a compiled span').toBeDefined();
			if (span === undefined) return;
			const [x, z] = midpointOf(fragment);
			const hit = resolveAt([x, z], datum + (span.bottomY + span.topY) / 2);
			expect(hit.kind === 'resolved' ? hit.hit.sourceId : null).toBe(wallId);
			if (hit.kind !== 'resolved' || hit.hit.subRef?.kind !== 'interval') return;
			// The picked span's own identity: start and end of the span the pointer is on.
			expect([hit.hit.subRef.start, hit.hit.subRef.end]).toEqual(intervalOf(fragment));
		}

		// Eligibility is per placement, not per source: a span the Plan excludes has no
		// fragment, and no sibling fragment may reach its surface on its behalf.
		const target = facade.camera.state().pose.target;
		const distanceOf = (fragment: (typeof spans)[number]): number => {
			const [x, z] = midpointOf(fragment);
			return Math.hypot(x - target[0], z - target[2]);
		};
		const ordered = [...spans].sort((left, right) => distanceOf(left) - distanceOf(right));
		const far = ordered[ordered.length - 1]!;
		const halfWidth = (distanceOf(ordered[0]!) + distanceOf(far)) / 2;
		facade.setPlanParameters({ lateralSpanHalfWidthMeters: halfWidth });

		const visible = facade.eligibleFragments().filter((fragment) => fragment.ref.sourceId === wallId);
		expect(visible.length).toBeGreaterThan(0);
		expect(visible.some((fragment) => intervalOf(fragment).join(':') === intervalOf(far).join(':'))).toBe(false);

		// The excluded span's own midpoint is not reachable through an included sibling.
		const farSpan = compiledSpanOf(far);
		const [farX, farZ] = midpointOf(far);
		const farHeight = datum + ((farSpan?.bottomY ?? 0) + (farSpan?.topY ?? 0)) / 2;
		const excluded = resolveAt([farX, farZ], farHeight);
		expect(excluded).toEqual({ kind: 'none', reason: 'no-fragment' });
	});
});
