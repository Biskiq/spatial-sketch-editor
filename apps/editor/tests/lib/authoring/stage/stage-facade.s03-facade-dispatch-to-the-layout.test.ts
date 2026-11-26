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
import { describe, expect, it, vi } from 'vitest';
import { VIEWPORT_READING_TRANSITION_SECONDS } from '@portfolio/camera-core/viewport';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { createPlanPickProvider } from '$lib/authoring/layout/plan-pick-provider';
import { resolveStagePick } from '$lib/authoring/stage/stage-pick';
import type { StageAdapterContext } from '$lib/authoring/stage/stage-facade';
import { createEmptyWallFirstLayoutDocument, planCreateWallFirstOpening, planWallChain } from '@portfolio/layout-core/wall';
import { planFragmentOf } from '@portfolio/layout-core/world';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { createUnitProject } from '../__fixtures__/unit-envelope-fixtures';
import {
	admitSource,
	type AdmissionContext,
	type StageReadSnapshot
} from '$lib/authoring/stage/source-admission';
import { createStageSession, type StageSession } from '$lib/authoring/stage/stage-session';
import type { StageHeightTick } from '$lib/authoring/stage/stage-height-sheet';
import {
	createStageFacade,
	HOST_STAGE_CAPABILITIES,
	type StageFacade
} from '$lib/authoring/stage/stage-facade';
import { STARTER_ENCLOSURE_POINTS } from '$lib/authoring/stage/starter-gallery';
import { freshCapture } from '../../layout/__fixtures__/layout-id-capture';

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
async function enclosureWithDoor(profile: 'rectangular' | 'rounded' | 'pointed' = 'rectangular'): Promise<ProjectEnvelope> {
	const base = await enclosureProject(STARTER_ENCLOSURE_POINTS);
	const baseLayout = base.units.layout.data;
	const wallId = baseLayout.walls[0]!.id;
	const door = planCreateWallFirstOpening(
		baseLayout,
		{
			wallId,
			kind: 'door',
			profile,
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
async function mount(document?: ProjectEnvelope, withLayoutPicker = true): Promise<Mounted> {
	const source = document ?? (await enclosureProject(STARTER_ENCLOSURE_POINTS));
	const context = admissionContext(source.id);
	const admitted = await admitSource(source, context);
	if (admitted.kind !== 'admitted') throw new Error(`the fixture source was not admitted: ${JSON.stringify(admitted)}`);
	const session = createStageSession({ sessionEpoch: context.sessionEpoch });
	session.replace(admitted.snapshot);
	const facade = createStageFacade({ snapshot: admitted.snapshot, session });
	if (withLayoutPicker) facade.registerStageAdapter({ id: 'layout', pick: createPlanPickProvider(() => facade.plan()) });
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

/**
 * The Plan is **retained across a camera move**, because a pan is not a Plan
 * change.
 *
 * `evaluateLayoutPlan` reads the inspection target in one place only, the
 * `lateral-span` stage, whose provider default is explicit unbounded coverage. So
 * a pan cannot change a fragment, a membership row, a stream or a bound — yet the
 * host used to re-evaluate the whole Plan on every pan frame and hand every
 * consumer a new object to re-derive from. These tests pin the retention *and* its
 * two boundaries: an input that does matter still re-evaluates, and a bounded
 * lateral span goes back to depending on the target.
 */

/**
 * The indexed hit path is a **broad phase**, so it can only ever remove work —
 * never a candidate.
 *
 * Each eligible fragment's own drawn vertices project to a point at distance `0`
 * from itself, which is inside the tolerance by definition. If the index pruned
 * any fragment that can be hit, one of these points would answer `no-fragment`.
 */

it('binds pending registrations in order on the first read and defers the settled surface notification', async () => {
	const { facade } = await mount(undefined, false);
	const events: string[] = [];
	facade.onAdaptersChanged(() => events.push('changed'));

	const register = (id: string) => facade.registerStageAdapter({
		id,
		bind: () => {
			events.push(`bind:${id}`);
			return {
				overlay: () => [{ id, css: [12, 18], label: id }],
				dispose: () => events.push(`binding-end:${id}`)
			};
		},
		dispose: () => events.push(`registration-end:${id}`)
	});
	const first = register('z-first');
	const second = register('a-second');
	if (first.kind !== 'registered' || second.kind !== 'registered') throw new Error('adapter refused');
	expect(events).toEqual(['changed', 'changed']);
	expect(facade.overlays()).toEqual([]);
	evaluate(facade);

	const overlays = facade.overlays();
	expect(overlays.map((overlay) => overlay.id)).toEqual(['z-first', 'a-second']);
	expect(facade.overlays()).toBe(overlays);
	expect(events).toEqual(['changed', 'changed', 'bind:z-first', 'bind:a-second']);
	await Promise.resolve();
	expect(events).toEqual(['changed', 'changed', 'bind:z-first', 'bind:a-second', 'changed']);

	events.length = 0;
	first.dispose();
	first.dispose();
	facade.dispose();
	expect(events).toEqual([
		'binding-end:z-first', 'registration-end:z-first', 'changed',
		'binding-end:a-second', 'registration-end:a-second', 'changed'
	]);
});

/**
 * E3 — identity retention at the Camera host and at the facade's output boundary.
 *
 * A settled Stage refreshes every display frame. These are the two identities
 * that make that refresh publish nothing: the Camera returns its previous
 * evaluation for identical inputs, and the facade returns its previous
 * contribution arrays until one of their inputs changes.
 */

describe('S03 facade dispatch to the Layout provider', () => {
	it('returns the provider winner over 400 samples in each reading', async () => {
		const fixtures = [
			await enclosureProject(STARTER_ENCLOSURE_POINTS),
			await enclosureProject([[0, 0], [8, 0], [8, 3], [4, 3], [4, 7], [0, 7]]),
			await enclosureWithDoor()
		];
		for (const fixture of fixtures) {
		const { facade, snapshot } = await mount(fixture);
		evaluate(facade);
		const provider = createPlanPickProvider(() => facade.plan());
		let exactCount = 0;
		for (const reading of ['3d', 'plan'] as const) {
			if (reading === 'plan') {
				facade.acquireInspection('exclusive');
				facade.requestViewingIntent({ kind: 'set-reading', reading }, facade.inspectionTicket(), 1);
				facade.camera.evaluate(RECT, 1 + VIEWPORT_READING_TRANSITION_SECONDS + 0.5);
			}
			const evaluation = facade.evaluation()!;
			const id = facade.evaluationId()!;
			const context = { snapshot, evaluation, pickScene: () => null };
			for (let x = 0; x < 20; x++) for (let y = 0; y < 20; y++) {
				const css = [(x + 0.5) * RECT.width / 20, (y + 0.5) * RECT.height / 20] as const;
				const previous = facade.resolveSourceHit({ css, evaluationId: id });
				const next = provider({ css, evaluationId: id, purpose: 'select', tool: null }, context);
				expect(next?.hit ?? null, `${reading} sample ${x},${y}`).toEqual(previous.kind === 'resolved' ? previous.hit : null);
				if (reading === '3d' && next?.depthMeters != null) {
					expect(Number.isFinite(next.depthMeters) && next.depthMeters >= 0).toBe(true);
					exactCount++;
				}
			}
		}
		expect(exactCount).toBeGreaterThan(0);
		}
	});
});
