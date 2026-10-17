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
import {
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type LayoutVec2
} from '@portfolio/layout-core';
import { createEmptyWorldLocalSceneDocument, type ProjectDocument } from '@portfolio/project-model';
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

const PROJECT_ID = 'project-stage-facade';
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

/** A real closed enclosure through the retained chain planner: no literal topology. */
function enclosureProject(points: readonly LayoutVec2[], id: string = PROJECT_ID): ProjectDocument {
	const plan = planWallChain({
		baseline: createEmptyWallFirstLayoutDocument(),
		points: points.map((point) => [point[0], point[1]] as LayoutVec2),
		close: true,
		role: 'boundary'
	});
	if (plan.kind !== 'success') throw new Error(`the enclosure no longer plans: ${plan.rejection.code}`);
	return {
		id,
		name: 'Stage facade project',
		layout: plan.document,
		scene: createEmptyWorldLocalSceneDocument()
	};
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
async function mount(document: ProjectDocument = enclosureProject(STARTER_ENCLOSURE_POINTS)): Promise<Mounted> {
	const context = admissionContext(document.id);
	const admitted = await admitSource(document, context);
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
});
