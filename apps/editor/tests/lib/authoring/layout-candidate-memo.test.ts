/**
 * E4 / G1 — a live Layout candidate builds once per distinct candidate.
 *
 * Mounted through the real facade, acceptance host and production Layout
 * adapter on the certified `grid-M` workload (112 Walls, 49 Rooms, one Opening
 * per Wall of at least 3 m). Every count is read from the E0 counting seam at
 * its production call site: `compile:walls` from the canonical compiler and
 * `candidate:paper-build` from the candidate Paper builder.
 *
 * The 60-tick still-pointer gate drives `facade.candidatePreviews()` — the
 * route's per-tick read — with no input between ticks: the first tick builds the
 * candidate once (at most one whole-candidate compile plus the planner's own
 * session delta) and ticks 2–60 cost nothing. A changed pointer builds exactly
 * once and draws what an un-memoised build draws. The memo is released on end,
 * cancel and rebase; the project compile context survives rebinding and is
 * released, with nothing retained, when the project closes.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
	activeLayoutCompileSession,
	compileWallFirstLayoutGeometryFresh,
	readPassiveCompiledGeometry,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { admitSource } from '$lib/authoring/stage/source-admission';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createAdapter } from '$lib/authoring/adapters/layout.adapter';
import {
	createLayoutCompileContext,
	layoutAdapterLifetimeOf,
	type LayoutAdapterLifetime
} from '$lib/authoring/adapters/layout/compile-context';
import { setCandidateMemoBypassForTest } from '$lib/authoring/adapters/layout/candidate-presenter';
import type { StageAdapter } from '$lib/authoring/stage/stage-facade';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { inkSurface, type InkController } from '$lib/authoring/adapters/layout/ink';
import {
	clearOpeningRepeatProposalsForSource,
	publishOpeningRepeatProposal
} from '$lib/authoring/adapters/layout/opening-repeat-proposal';
import { addOpenings, buildGrid, sequentialCaptures } from '../../../perf/lib/workloads/grid';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { startStageCounting, type StageCounting } from '../../helpers/stage-counts';

const PROJECT_ID = 'project-e4-candidate-memo';
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const TICKS = 60;

let document: LayoutDocumentWallFirst;
let project: ProjectEnvelope;
let counting: StageCounting | null = null;

beforeAll(async () => {
	const captures = sequentialCaptures('e4-memo');
	document = addOpenings(buildGrid(7, captures), captures);
	project = await createUnitProject({ id: PROJECT_ID, name: 'E4 candidate memo', layout: document });
}, 60_000);

afterEach(() => {
	counting?.stop();
	counting = null;
	setCandidateMemoBypassForTest(false);
});

type Mounted = {
	readonly facade: StageFacade;
	readonly walls: number;
	readonly lifetime: LayoutAdapterLifetime;
	dispose(): void;
};

async function mount(): Promise<Mounted> {
	const admitted = await admitSource(project, {
		sessionEpoch: 'session-e4-memo',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`fixture not admitted: ${admitted.kind}`);
	const snapshot = admitted.snapshot;
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const facade = createStageFacade({ snapshot, session });
	facade.acquireInspection('exclusive');
	facade.camera.evaluate(RECT, 1);
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: snapshot.sessionEpoch,
		baseline: {
			revision: snapshot.acceptedRevision,
			source: project,
			canonicalJson: snapshot.canonicalJson,
			sourceContentId: snapshot.sourceContentId
		}
	});
	const registration = mountStageAdapter(facade, host, createAdapter);
	if (registration.kind !== 'registered') throw new Error('Layout adapter did not mount');
	const adapter = facade.adapters().find((entry) => entry.id === 'layout');
	const lifetime = adapter === undefined ? undefined : layoutAdapterLifetimeOf(adapter);
	if (lifetime === undefined) throw new Error('Layout adapter exposes no lifetime');
	return {
		facade,
		walls: document.walls.length,
		lifetime,
		dispose() {
			facade.dispose();
			host.dispose();
		}
	};
}

function settle(facade: StageFacade, reading: 'plan' | '3d', clockSeconds = 10): void {
	if (reading === 'plan') facade.camera.applyIntent({ kind: 'set-reading', reading: 'plan' }, 0);
	const result = facade.camera.evaluate(RECT, clockSeconds);
	if (result.kind !== 'evaluated') throw new Error(`the viewport did not evaluate: ${result.reason}`);
	expect(result.evaluation.settledReading).toBe(reading);
	facade.overlays();
	facade.candidatePreviews();
}

function armInk(facade: StageFacade): InkController {
	const opened = facade.openContributedTask('layout-ink');
	if (opened.kind !== 'opened') throw new Error(`Ink did not arm: ${opened.message}`);
	const surface = inkSurface();
	if (surface === null) throw new Error('Ink published no surface');
	return surface.controller;
}

function css(facade: StageFacade, point: readonly [number, number]): readonly [number, number] {
	const evaluationId = facade.evaluationId();
	if (evaluationId === null) throw new Error('no evaluation');
	const datum = facade.snapshot().domain.datumMeters;
	const projected = facade.projectWorld([point[0], datum, point[1]], evaluationId);
	if (projected.kind !== 'projected') throw new Error('point did not project');
	return [projected.css[0] - RECT.left, projected.css[1] - RECT.top];
}

function selectOpening(facade: StageFacade, openingId: string): void {
	const snapshot = facade.snapshot();
	const reference = {
		version: 1 as const,
		domain: 'layout' as const,
		revision: { kind: 'exact' as const, contentRevision: snapshot.domain.unitRevisions.layout },
		subject: { kind: 'opening' as const, id: openingId },
		instancePath: [],
		location: { kind: 'layout-location' as const, levelId: snapshot.domain.layoutLevelId, structureInstancePath: [] },
		componentId: null,
		capabilityId: null
	};
	facade.setSelection({ ordered: [{ reference }], primary: reference });
}

/** Every candidate build the binding can repeat per tick: Plan Paper, Opening outline/symbol, planner proposal. */
const BUILDS = ['candidate:paper-build', 'candidate:opening-build', 'candidate:proposal-plan'] as const;

type Still = {
	builds: number;
	walls: number;
	compiles: number;
	/** Each build kind on the first tick. */
	firstBuilds: Record<(typeof BUILDS)[number], number>;
	/** All builds of every kind over ticks 2–60. */
	restBuilds: number;
	restWalls: number;
};

function buildCounts(): Record<(typeof BUILDS)[number], number> {
	return Object.fromEntries(BUILDS.map((name) => [name, counting!.count(name)])) as Record<(typeof BUILDS)[number], number>;
}

/** Tick the route's read `TICKS` times with nothing changing between ticks. */
function stillTicks(facade: StageFacade, id: string): Still {
	counting!.reset();
	expect(facade.candidatePreviews().some((preview) => preview.id === id)).toBe(true);
	const firstBuilds = buildCounts();
	const first = { builds: counting!.count('candidate:paper-build'), walls: counting!.count('compile:walls') };
	const compiles = counting!.count('compile') - counting!.count('compile:passive-read');
	counting!.reset();
	for (let tick = 1; tick < TICKS; tick += 1) {
		expect(facade.candidatePreviews().some((preview) => preview.id === id)).toBe(true);
	}
	const rest = buildCounts();
	return {
		builds: first.builds + rest['candidate:paper-build'],
		walls: first.walls + counting!.count('compile:walls'),
		compiles,
		firstBuilds,
		restBuilds: BUILDS.reduce((sum, name) => sum + rest[name], 0),
		restWalls: counting!.count('compile:walls')
	};
}

function log(name: string, still: Still, walls: number): void {
	const first = BUILDS.map((name) => `${name}=${still.firstBuilds[name]}`).join(' ');
	console.info(
		`[E4 measure] ${name} 60 ticks: candidate:paper-build=${still.builds} compile:walls=${still.walls} ` +
			`(first tick ${first} compiles=${still.compiles}; ticks 2-60 builds=${still.restBuilds} walls=${still.restWalls}) W=${walls}`
	);
}

/** The still-pointer gate: each build kind at most once, one whole compile at most, nothing after the first tick. */
function expectStill(still: Still, walls: number, slack: number): void {
	expect(still.builds).toBeLessThanOrEqual(1);
	for (const name of BUILDS) expect(still.firstBuilds[name], name).toBeLessThanOrEqual(1);
	expect(still.restBuilds).toBe(0);
	expect(still.restWalls).toBe(0);
	// One whole-candidate compile; `slack` covers Walls the candidate adds or the
	// planner's own session delta re-evaluates (never a second whole compile).
	expect(still.walls).toBeLessThanOrEqual(walls + slack);
}

describe('E4/G1 — still pointer, 60 ticks', { timeout: 20_000 }, () => {
	it('a Wall-chain candidate in Plan builds once', async () => {
		const mounted = await mount();
		try {
			settle(mounted.facade, 'plan');
			armInk(mounted.facade);
			const evaluationId = mounted.facade.evaluationId()!;
			// A leg crossing the grid's outer Wall, so the candidate splits it and carries affected Paper.
			mounted.facade.pointerIntent({ phase: 'down', css: css(mounted.facade, [1, -2]), evaluationId });
			mounted.facade.pointerIntent({ phase: 'move', css: css(mounted.facade, [1, 2]), evaluationId });
			counting = startStageCounting();
			const still = stillTicks(mounted.facade, 'layout-candidate-chain');
			log('chain/plan', still, mounted.walls);
			// The candidate splits the outer Wall it crosses: a few more Walls than W.
			expectStill(still, mounted.walls, 4);
		} finally {
			mounted.dispose();
		}
	});

	it('an Opening placement candidate in 3D builds once', async () => {
		const mounted = await mount();
		try {
			settle(mounted.facade, '3d', 2);
			armInk(mounted.facade).setReading('opening');
			const evaluationId = mounted.facade.evaluationId()!;
			expect(mounted.facade.hoverIntent({ phase: 'move', css: css(mounted.facade, [1.2, 0]), evaluationId })).toBe(true);
			counting = startStageCounting();
			const still = stillTicks(mounted.facade, 'layout-candidate-opening');
			log('opening/3d', still, mounted.walls);
			expectStill(still, mounted.walls, 0);
		} finally {
			mounted.dispose();
		}
	});

	for (const reading of ['plan', '3d'] as const) {
		it(`an Opening Repeat proposal in ${reading} builds once`, async () => {
			const mounted = await mount();
			const sourceContentId = mounted.facade.snapshot().sourceContentId;
			try {
				settle(mounted.facade, reading, reading === 'plan' ? 10 : 2);
				const opening = document.openings[0]!;
				selectOpening(mounted.facade, opening.id);
				publishOpeningRepeatProposal({ sourceContentId, openingId: opening.id, wallId: opening.wallId, count: 1, spacing: -2 });
				counting = startStageCounting();
				const still = stillTicks(mounted.facade, 'layout-candidate-opening-repeat');
				log(`repeat/${reading}`, still, mounted.walls);
				// The proposal's validation compile runs in the project session; the
				// presenter reads that same compile back through the handover, so the
				// planner's own delta is the only work. A broken handover would add a
				// second whole candidate compile (~W Walls), which the `walls + 2` gate
				// alone would still pass — assert the compile count and the delta size.
				expectStill(still, mounted.walls, 2);
				expect(still.compiles).toBe(1);
				expect(still.walls).toBeLessThanOrEqual(2);
			} finally {
				clearOpeningRepeatProposalsForSource(sourceContentId);
				mounted.dispose();
			}
		});
	}

	it('a Circle candidate builds its plan once', async () => {
		const mounted = await mount();
		try {
			settle(mounted.facade, 'plan');
			const ink = armInk(mounted.facade);
			ink.setWallMode?.('circle');
			const evaluationId = mounted.facade.evaluationId()!;
			mounted.facade.pointerIntent({ phase: 'down', css: css(mounted.facade, [60, 10]), evaluationId });
			mounted.facade.pointerIntent({ phase: 'move', css: css(mounted.facade, [63, 10]), evaluationId });
			counting = startStageCounting();
			const still = stillTicks(mounted.facade, 'layout-candidate-circle');
			log('circle/plan', still, mounted.walls);
			expectStill(still, mounted.walls, 1);
		} finally {
			mounted.dispose();
		}
	});
});


describe('E4/G1 — pan with a live candidate', { timeout: 20_000 }, () => {
	it('a bounded span rebuilds Paper and reuses the unchanged candidate’s compile', async () => {
		const mounted = await mount();
		try {
			settle(mounted.facade, 'plan');
			// A bounded lateral span is the only Plan input a pan can reach.
			mounted.facade.setPlanParameters({ lateralSpanHalfWidthMeters: 20 });
			armInk(mounted.facade);
			const evaluationId = mounted.facade.evaluationId()!;
			mounted.facade.pointerIntent({ phase: 'down', css: css(mounted.facade, [1, -2]), evaluationId });
			mounted.facade.pointerIntent({ phase: 'move', css: css(mounted.facade, [1, 2]), evaluationId });
			counting = startStageCounting();
			expect(mounted.facade.candidatePreviews().some((preview) => preview.id === 'layout-candidate-chain')).toBe(true);
			expect(counting.count('compile:walls')).toBeGreaterThan(0);
			counting.reset();

			const target = mounted.facade.camera.state().pose.target;
			const dependency = mounted.facade.planDependencyKey();
			mounted.facade.acquireInspection('exclusive');
			mounted.facade.requestViewingIntent(
				{ kind: 'pan', deltaCss: [30, 0], rect: RECT },
				mounted.facade.inspectionTicket(),
				20
			);
			expect(mounted.facade.camera.state().pose.target).not.toEqual(target);
			expect(mounted.facade.planDependencyKey()).not.toBe(dependency);
			// The route's frame realises the panned view before the next read.
			expect(mounted.facade.camera.evaluate(RECT, 20).kind).toBe('evaluated');

			expect(mounted.facade.candidatePreviews().some((preview) => preview.id === 'layout-candidate-chain')).toBe(true);
			// The target is a Plan input, so the Paper is rebuilt once; the candidate
			// document did not change, so it is not compiled again.
			expect(counting.count('candidate:paper-build')).toBe(1);
			expect(counting.count('compile:walls')).toBe(0);
		} finally {
			mounted.dispose();
		}
	});
});

describe('E4/I2 — candidate compile release', { timeout: 20_000 }, () => {
	it('closing the task releases the gesture’s candidate compile', async () => {
		const mounted = await mount();
		try {
			settle(mounted.facade, 'plan');
			armInk(mounted.facade);
			const evaluationId = mounted.facade.evaluationId()!;
			mounted.facade.pointerIntent({ phase: 'down', css: css(mounted.facade, [1, -2]), evaluationId });
			mounted.facade.pointerIntent({ phase: 'move', css: css(mounted.facade, [1, 2]), evaluationId });
			counting = startStageCounting();
			expect(mounted.facade.candidatePreviews().some((preview) => preview.id === 'layout-candidate-chain')).toBe(true);
			expect(counting.count('compile:walls')).toBeGreaterThan(0);
			expect(mounted.lifetime.context.candidateHeld()).toBe(true);

			mounted.facade.closeTask();
			expect(mounted.lifetime.context.candidateHeld()).toBe(false);
		} finally {
			mounted.dispose();
		}
	});
});

/** The previews with every memo bypassed: what an un-memoised build draws. */
function coldPreviews(facade: StageFacade): unknown {
	setCandidateMemoBypassForTest(true);
	try {
		return JSON.parse(JSON.stringify(facade.candidatePreviews()));
	} finally {
		setCandidateMemoBypassForTest(false);
	}
}

describe('E4/G1 — changed pointer', { timeout: 20_000 }, () => {
	it('each changed chain pointer builds exactly once and equals an un-memoised build', async () => {
		const mounted = await mount();
		try {
			settle(mounted.facade, 'plan');
			armInk(mounted.facade);
			const evaluationId = mounted.facade.evaluationId()!;
			mounted.facade.pointerIntent({ phase: 'down', css: css(mounted.facade, [1, -2]), evaluationId });
			counting = startStageCounting();
			for (const y of [2, 1.8, 1.6]) {
				counting.reset();
				mounted.facade.pointerIntent({ phase: 'move', css: css(mounted.facade, [1, y]), evaluationId });
				const memoised = JSON.parse(JSON.stringify(mounted.facade.candidatePreviews()));
				expect(memoised.some((preview: { id: string }) => preview.id === 'layout-candidate-chain-affected')).toBe(true);
				expect(counting.count('candidate:paper-build')).toBe(1);
				counting.reset();
				expect(JSON.parse(JSON.stringify(mounted.facade.candidatePreviews()))).toEqual(memoised);
				expect(counting.count('candidate:paper-build')).toBe(0);
				expect(coldPreviews(mounted.facade)).toEqual(memoised);
			}
		} finally {
			mounted.dispose();
		}
	});

	it('each changed Opening hover in 3D builds exactly once and equals an un-memoised build', async () => {
		const mounted = await mount();
		try {
			settle(mounted.facade, '3d', 2);
			armInk(mounted.facade).setReading('opening');
			const evaluationId = mounted.facade.evaluationId()!;
			counting = startStageCounting();
			for (const x of [1.2, 1.6]) {
				expect(mounted.facade.hoverIntent({ phase: 'move', css: css(mounted.facade, [x, 0]), evaluationId })).toBe(true);
				counting.reset();
				const memoised = JSON.parse(JSON.stringify(mounted.facade.candidatePreviews()));
				expect(memoised.some((preview: { id: string }) => preview.id === 'layout-candidate-opening')).toBe(true);
				// The 3D reading reads the compiled outline; it builds no Plan Paper.
				expect(counting.count('candidate:paper-build')).toBe(0);
				expect(counting.count('candidate:opening-build')).toBe(1);
				expect(counting.count('compile:walls')).toBeLessThanOrEqual(mounted.walls);
				counting.reset();
				expect(JSON.parse(JSON.stringify(mounted.facade.candidatePreviews()))).toEqual(memoised);
				expect(counting.count('candidate:opening-build')).toBe(0);
				expect(coldPreviews(mounted.facade)).toEqual(memoised);
			}
		} finally {
			mounted.dispose();
		}
	});
});

describe('E4/G1 — memo release', () => {
	it('ending, cancelling and rebasing release the candidate memo', async () => {
		const mounted = await mount();
		try {
			settle(mounted.facade, 'plan');
			armInk(mounted.facade);
			const evaluationId = mounted.facade.evaluationId()!;
			const held = () => mounted.lifetime.memoHeld?.() ?? 0;

			// Cancel: closing the task resets the memo at once.
			mounted.facade.pointerIntent({ phase: 'down', css: css(mounted.facade, [1, -2]), evaluationId });
			mounted.facade.pointerIntent({ phase: 'move', css: css(mounted.facade, [1, 2]), evaluationId });
			mounted.facade.candidatePreviews();
			expect(held()).toBeGreaterThan(0);
			mounted.facade.closeTask();
			expect(held()).toBe(0);

			// End: a gesture that stops proposing releases on the next tick.
			armInk(mounted.facade);
			mounted.facade.pointerIntent({ phase: 'down', css: css(mounted.facade, [1, -2]), evaluationId });
			mounted.facade.pointerIntent({ phase: 'move', css: css(mounted.facade, [1, 2]), evaluationId });
			mounted.facade.candidatePreviews();
			expect(held()).toBeGreaterThan(0);
			mounted.facade.pointerIntent({ phase: 'move', css: css(mounted.facade, [1, -2]), evaluationId });
			mounted.facade.candidatePreviews();
			expect(held()).toBe(0);
			mounted.facade.closeTask();

			// Rebase: an accepted install disposes the binding and its memo; the new
			// binding starts empty and borrows the same project compile context.
			const before = mounted.lifetime.memoHeld;
			const context = mounted.lifetime.context;
			armInk(mounted.facade);
			const from = css(mounted.facade, [1, -2]);
			const to = css(mounted.facade, [1, 2]);
			const revision = mounted.facade.snapshot().sourceContentId;
			mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId });
			mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
			mounted.facade.candidatePreviews();
			expect(held()).toBeGreaterThan(0);
			mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
			await eventually(() => mounted.facade.snapshot().sourceContentId !== revision);
			settle(mounted.facade, 'plan', 20);
			expect(mounted.lifetime.memoHeld).not.toBe(before);
			expect(held()).toBe(0);
			expect(mounted.lifetime.context).toBe(context);
			expect(context.disposed()).toBe(false);
			expect(context.retained().walls).toBeGreaterThan(0);
		} finally {
			mounted.dispose();
		}
	});
});

describe('E4/I2 — compile context handover', () => {
	const clone = (): LayoutDocumentWallFirst => structuredClone(document) as LayoutDocumentWallFirst;

	it('serves a planner step’s own compile to the presenter once, for that exact document', () => {
		const context = createLayoutCompileContext();
		try {
			const accepted = clone();
			const candidate = clone();
			counting = startStageCounting();
			context.compiled(accepted);
			counting.reset();
			const planned = context.plan(accepted, () => activeLayoutCompileSession()!.compile(candidate));
			expect(planned.geometry.walls!.length).toBe(candidate.walls.length);
			// The step ran the canonical entry once; a content-equal clone may reuse
			// every Wall through the session delta, which is still that one compile.
			expect(counting.count('compile')).toBe(1);
			expect(context.retained().walls).toBe(candidate.walls.length);

			counting.reset();
			const presented = context.compiled(candidate);
			expect(presented.geometry).toBe(planned.geometry);
			expect(counting.counts()).toEqual({});

			// Only that exact object is covered: a distinct equal document compiles.
			const other = clone();
			const cold = context.compiled(other);
			expect(cold.geometry).not.toBe(presented.geometry);
			expect(counting.count('compile:walls')).toBe(other.walls.length);
		} finally {
			context.dispose();
		}
	});

	it('reuses the last document it compiled while that exact object is unchanged', () => {
		const context = createLayoutCompileContext();
		try {
			const first = clone();
			const equal = clone();
			counting = startStageCounting();
			const compiled = context.compiled(first);
			expect(counting.count('compile:walls')).toBe(first.walls.length);
			counting.reset();
			const reused = context.compiled(first);
			expect(reused.geometry).toBe(compiled.geometry);
			expect(counting.counts()).toEqual({});

			// One entry, matched by object identity: an equal clone compiles.
			context.compiled(equal);
			expect(counting.count('compile:walls')).toBe(equal.walls.length);

			// A planner step owns the candidate set again.
			context.plan(first, () => undefined);
			counting.reset();
			context.compiled(equal);
			expect(counting.count('compile:walls')).toBe(equal.walls.length);

			// dispose releases the entry; the canonical read still works cold.
			context.dispose();
			counting.reset();
			context.compiled(equal);
			expect(counting.count('compile:walls')).toBe(equal.walls.length);
			expect(context.retained()).toEqual({ walls: 0, junctions: 0, rooms: 0, objects: 0 });
		} finally {
			context.dispose();
		}
	});

	it('releases the cached candidate on request, so a closed gesture retains nothing', () => {
		const context = createLayoutCompileContext();
		try {
			const document = clone();
			counting = startStageCounting();
			context.compiled(document);
			expect(context.candidateHeld()).toBe(true);

			context.releaseCandidate();
			expect(context.candidateHeld()).toBe(false);
			// The release is real: the same object compiles again from cold.
			counting.reset();
			context.compiled(document);
			expect(counting.count('compile:walls')).toBe(document.walls.length);
		} finally {
			context.dispose();
		}
	});

	it('ends the handover on the next plan step and on dispose', () => {
		const context = createLayoutCompileContext();
		try {
			const accepted = clone();
			const planned = clone();
			const dropped = clone();
			context.plan(accepted, () => activeLayoutCompileSession()!.compile(planned));
			// A plan step that compiles nothing still ends the previous handover.
			context.plan(accepted, () => undefined);
			counting = startStageCounting();
			context.compiled(planned);
			expect(counting.count('compile:walls')).toBe(planned.walls.length);

			context.plan(accepted, () => activeLayoutCompileSession()!.compile(dropped));
			context.dispose();
			expect(context.disposed()).toBe(true);
			expect(context.retained()).toEqual({ walls: 0, junctions: 0, rooms: 0, objects: 0 });
			counting.reset();
			context.compiled(dropped);
			expect(counting.count('compile:walls')).toBe(dropped.walls.length);

			const late = clone();
			const lateWalls = context.plan(
				late,
				() => activeLayoutCompileSession()?.compile(late).geometry.walls!.length ?? -1
			);
			expect(lateWalls).toBe(-1);
			expect(context.retained()).toEqual({ walls: 0, junctions: 0, rooms: 0, objects: 0 });
		} finally {
			context.dispose();
		}
	});
});

describe('E4/I2 — project compile context lifetime', () => {
	it('closing the project releases the context, and a late planner step cannot refill it', async () => {
		const mounted = await mount();
		const { context } = mounted.lifetime;
		settle(mounted.facade, 'plan');
		armInk(mounted.facade);
		const evaluationId = mounted.facade.evaluationId()!;
		const from = css(mounted.facade, [60, 10]);
		const to = css(mounted.facade, [63, 10]);
		mounted.facade.pointerIntent({ phase: 'down', css: from, evaluationId });
		mounted.facade.pointerIntent({ phase: 'move', css: to, evaluationId });
		mounted.facade.pointerIntent({ phase: 'up', css: to, evaluationId });
		await eventually(() => context.retained().walls > 0);
		mounted.dispose();
		expect(context.disposed()).toBe(true);
		expect(context.retained()).toEqual({ walls: 0, junctions: 0, rooms: 0, objects: 0 });
		// A late planner step reaches the compiler through the same session seam the
		// real planners use, on a fresh clone with no record of its own. With no
		// session bound it cannot compile, so it cannot refill the released store.
		const late = structuredClone(document) as LayoutDocumentWallFirst;
		const lateWalls = context.plan(
			late,
			() => activeLayoutCompileSession()?.compile(late).geometry.walls!.length ?? -1
		);
		expect(lateWalls).toBe(-1);
		expect(context.retained()).toEqual({ walls: 0, junctions: 0, rooms: 0, objects: 0 });
	});

	it('the facade ends a factory registration once, after its last binding; binding-only factories are unchanged', async () => {
		const admitted = await admitSource(project, {
			sessionEpoch: 'session-e4-registration',
			acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
		});
		if (admitted.kind !== 'admitted') throw new Error(admitted.kind);
		const session = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
		session.replace(admitted.snapshot);
		const facade = createStageFacade({ snapshot: admitted.snapshot, session });
		facade.camera.evaluate(RECT, 1);
		const events: string[] = [];
		const factory = (id: string, own: boolean): StageAdapter => ({
			id,
			...(own ? { dispose: () => events.push(`${id}:registration`) } : {}),
			bind: () => ({ dispose: () => events.push(`${id}:binding`) })
		});
		const owned = facade.registerStageAdapter(factory('owned', true));
		const bindingOnly = facade.registerStageAdapter(factory('binding-only', false));
		expect(owned.kind).toBe('registered');
		expect(bindingOnly.kind).toBe('registered');
		facade.overlays();
		if (owned.kind === 'registered') owned.dispose();
		expect(events).toEqual(['owned:binding', 'owned:registration']);
		facade.dispose();
		if (owned.kind === 'registered') owned.dispose();
		expect(events).toEqual(['owned:binding', 'owned:registration', 'binding-only:binding']);
	});
});

describe('E4/I2 — shared records stay unmutated', () => {
	it('the accepted record is unchanged after the mounted gesture flows', async () => {
		const mounted = await mount();
		try {
			const accepted = stageEnvelope(mounted.facade.snapshot()).units.layout.data;
			mounted.lifetime.context.compiled(accepted);
			const record = readPassiveCompiledGeometry(accepted);
			expect(record?.sealed).toBe(true);
			const before = JSON.stringify(record!.geometry);
			settle(mounted.facade, 'plan');
			armInk(mounted.facade);
			const evaluationId = mounted.facade.evaluationId()!;
			mounted.facade.pointerIntent({ phase: 'down', css: css(mounted.facade, [1, -2]), evaluationId });
			mounted.facade.pointerIntent({ phase: 'move', css: css(mounted.facade, [1, 2]), evaluationId });
			for (let tick = 0; tick < 5; tick += 1) mounted.facade.candidatePreviews();
			mounted.facade.closeTask();
			armInk(mounted.facade).setReading('opening');
			mounted.facade.hoverIntent({ phase: 'move', css: css(mounted.facade, [1.2, 0]), evaluationId });
			mounted.facade.candidatePreviews();
			expect(readPassiveCompiledGeometry(accepted)).toBe(record);
			expect(JSON.stringify(record!.geometry)).toBe(before);
		} finally {
			mounted.dispose();
		}
	});
});

async function eventually(check: () => boolean, attempts = 200): Promise<void> {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('condition never became true');
}
