// Disposable warm-process cost probe (convergence 2026-10-21, performance packet).
//
// Measures, per Layout size, the Node-side cost of the authoring pipeline the
// Stage runs: canonical compile, Plan representation, Layout codec, unit
// envelope serialization + content identity, Stage source admission (the
// project-open path: parse, validate, compile, runtime), the per-pointer-move
// Wall manipulation preview solve, a C1-like Wall-chain commit planner, and one
// F.4 unit acceptance + Undo/Redo through the real editor coordinator with the
// real Layout precision planners.
//
// These are RELATIVE cost and scaling evidence on a developer machine — not
// reference-laptop budgets. Results land in ./results/compile-warm.json.
import { it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	compileWallFirstLayoutGeometry,
	evaluateLayoutPlan,
	parseWallFirstLayoutDocumentJson,
	planCreateWallFirstOpening,
	planWallChain,
	serializeWallFirstLayoutDocument,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import type { AcceptedRevision } from '@portfolio/project-model';
import {
	computeEnvelopeSourceContentId,
	createEmptyUnitEnvelope,
	createUnitAcceptanceAdapter,
	createUnitAcceptancePreparation,
	createUnitPlannerRegistry,
	serializeProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import {
	LAYOUT_WALL_HEIGHT_KIND,
	buildLayoutIntent,
	createLayoutPlanners,
	layoutReference,
	planWallManipulation
} from '$lib/authoring/adapters/layout/precision';
import { admitSource, admitSourceJson } from '$lib/authoring/stage/source-admission';
import { buildStarterEnclosureLayout } from '$lib/authoring/stage/starter-gallery';
import { planParameters } from '$lib/authoring/stage/plan-parameters';
import { addOpenings, buildGrid, describeLayout } from './fixtures';

const here = path.dirname(fileURLToPath(import.meta.url));
const gc = (globalThis as { gc?: () => void }).gc;

type Stats = { n: number; first: number; median: number; p95: number; max: number; min: number };
function stats(samples: number[], first = samples[0] ?? NaN): Stats {
	const s = [...samples].sort((a, b) => a - b);
	const q = (p: number) => s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]!;
	const r = (x: number) => Math.round(x * 1000) / 1000;
	return { n: s.length, first: r(first), median: r(q(0.5)), p95: r(q(0.95)), max: r(s[s.length - 1]!), min: r(s[0]!) };
}
function timeSync(fn: () => unknown): number {
	const t = performance.now();
	fn();
	return performance.now() - t;
}
async function timeAsync(fn: () => Promise<unknown>): Promise<number> {
	const t = performance.now();
	await fn();
	return performance.now() - t;
}
function repeat(n: number, fn: () => unknown): number[] {
	const out: number[] = [];
	for (let i = 0; i < n; i++) out.push(timeSync(fn));
	return out;
}
/** Retained heap of one value, between two forced collections (MiB). */
function retainedMiB(make: () => unknown): number | null {
	if (!gc) return null;
	gc();
	gc();
	const before = process.memoryUsage().heapUsed;
	const keep = make();
	gc();
	gc();
	const after = process.memoryUsage().heapUsed;
	(globalThis as { __keep?: unknown }).__keep = keep;
	(globalThis as { __keep?: unknown }).__keep = undefined;
	return Math.round(((after - before) / 1048576) * 100) / 100;
}

const REVISION: AcceptedRevision = { projectId: 'perf-probe', revisionId: 'revision-1' };
const CONTEXT = { sessionEpoch: 'perf-session', acceptedRevision: REVISION };

function pointOf(doc: LayoutDocumentWallFirst, id: string) {
	return doc.junctions.find((j) => j.id === id)!.point;
}
/** An interior vertical Wall (x = 6) for drag/height edits. */
function interiorVerticalWall(doc: LayoutDocumentWallFirst): string {
	const wall = doc.walls.find((w) => {
		const a = pointOf(doc, w.startJunctionId);
		const b = pointOf(doc, w.endJunctionId);
		return Math.abs(a[0] - 6) < 1e-9 && Math.abs(b[0] - 6) < 1e-9 && Math.min(a[1], b[1]) < 1e-9;
	});
	return (wall ?? doc.walls[0]!).id;
}
function hostAt(doc: LayoutDocumentWallFirst, p: [number, number]): string | null {
	for (const w of doc.walls) {
		const a = pointOf(doc, w.startJunctionId);
		const b = pointOf(doc, w.endJunctionId);
		const len2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
		const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / len2;
		if (t <= 1e-6 || t >= 1 - 1e-6) continue;
		if ((a[0] + t * (b[0] - a[0]) - p[0]) ** 2 + (a[1] + t * (b[1] - a[1]) - p[1]) ** 2 < 1e-10) return w.id;
	}
	return null;
}

async function measure(label: string, buildMs: number, doc: LayoutDocumentWallFirst, openingPlannerMs: number[]) {
	const shape = describeLayout(doc);
	if (shape.blockingIssues > 0) throw new Error(`${label} does not compile: ${shape.firstBlocking}`);
	const row: Record<string, unknown> = { label, shape, fixtureBuildMs: Math.round(buildMs) };
	if (openingPlannerMs.length) row.openingCreatePlannerMs = stats(openingPlannerMs.slice(-30), openingPlannerMs[openingPlannerMs.length - 30] ?? openingPlannerMs[0]);

	// Compile: first at this size, then warm repeats.
	const firstCompile = timeSync(() => compileWallFirstLayoutGeometry(doc));
	for (let i = 0; i < 3; i++) compileWallFirstLayoutGeometry(doc);
	row.compileMs = stats(repeat(doc.walls.length > 300 ? 15 : 40, () => compileWallFirstLayoutGeometry(doc)), firstCompile);
	row.compiledRetainedMiB = retainedMiB(() => compileWallFirstLayoutGeometry(doc));

	// Plan representation over one compiled result.
	const compiled = compileWallFirstLayoutGeometry(doc).geometry!;
	const ctx = { generationId: 'g', target: [0, 0] as [number, number], datumMeters: 0 };
	const firstPlan = timeSync(() => evaluateLayoutPlan(compiled, planParameters(), ctx));
	row.planEvaluateMs = stats(repeat(30, () => evaluateLayoutPlan(compiled, planParameters(), ctx)), firstPlan);

	// Layout codec.
	const json = serializeWallFirstLayoutDocument(doc);
	row.layoutJsonBytes = Buffer.byteLength(json);
	row.layoutSerializeMs = stats(repeat(30, () => serializeWallFirstLayoutDocument(doc)));
	row.layoutParseValidateMs = stats(repeat(30, () => parseWallFirstLayoutDocumentJson(json)));

	// Unit envelope: canonical serialization + content identity (SHA-256 over canonical bytes).
	const envelope: ProjectEnvelope = await createEmptyUnitEnvelope({ id: REVISION.projectId, name: label, acceptedRevision: REVISION, layout: doc });
	const envJson = serializeProjectEnvelope(envelope);
	row.envelopeJsonBytes = Buffer.byteLength(envJson);
	row.envelopeSerializeMs = stats(repeat(20, () => serializeProjectEnvelope(envelope)));
	const idSamples: number[] = [];
	for (let i = 0; i < 20; i++) idSamples.push(await timeAsync(() => computeEnvelopeSourceContentId(envelope)));
	row.envelopeContentIdMs = stats(idSamples);

	// Project open: Stage admission from JSON (parse, validate, compile, runtime, identity).
	const openSamples: number[] = [];
	for (let i = 0; i < (doc.walls.length > 300 ? 6 : 12); i++) {
		openSamples.push(
			await timeAsync(async () => {
				const outcome = await admitSourceJson(envJson, CONTEXT);
				if (outcome.kind !== 'admitted') throw new Error(`${label} admission ${outcome.kind}`);
			})
		);
	}
	row.stageAdmitJsonMs = stats(openSamples);
	if (gc) {
		gc();
		gc();
		const before = process.memoryUsage().heapUsed;
		const admitted = await admitSourceJson(envJson, CONTEXT);
		gc();
		gc();
		row.admittedSnapshotRetainedMiB = Math.round(((process.memoryUsage().heapUsed - before) / 1048576) * 100) / 100;
		void admitted;
	}

	// Drag preview: one retained-planner solve per pointer move (rigid move of an interior Wall).
	const wallId = interiorVerticalWall(doc);
	const kinds = new Map<string, number>();
	const dragSamples: number[] = [];
	for (let i = 1; i <= 60; i++) {
		dragSamples.push(
			timeSync(() => {
				const plan = planWallManipulation(doc, wallId, { kind: 'move', delta: [0.01 * i, 0] }, 'start');
				kinds.set(plan.kind, (kinds.get(plan.kind) ?? 0) + 1);
			})
		);
	}
	row.dragPreviewSolveMs = { ...stats(dragSamples), outcomes: Object.fromEntries(kinds) };

	// C1-like commit planners: an independent new Wall outside the grid, and a
	// declared T-partition that splits one Room (topology + Room reconciliation).
	const maxX = Math.max(...doc.junctions.map((j) => j.point[0]));
	const independent = repeat(10, () => {
		const plan = planWallChain({ baseline: doc, points: [[maxX + 4, 0], [maxX + 8, 0]], close: false, role: 'boundary' });
		if (plan.kind !== 'success') throw new Error('independent chain refused');
	});
	row.wallChainIndependentMs = stats(independent);
	const h0 = hostAt(doc, [1.5, 0]);
	const h1 = hostAt(doc, [1.5, 6]);
	if (h0 && h1) {
		const outcomes = new Map<string, number>();
		row.wallChainRoomSplitMs = stats(
			repeat(10, () => {
				const plan = planWallChain({
					baseline: doc,
					points: [[1.5, 0], [1.5, 6]],
					close: false,
					role: 'boundary',
					endpointHostSnaps: [
						{ pointIndex: 0, wallId: h0 },
						{ pointIndex: 1, wallId: h1 }
					]
				});
				outcomes.set(plan.kind, (outcomes.get(plan.kind) ?? 0) + 1);
			})
		);
		row.wallChainRoomSplitOutcomes = Object.fromEntries(outcomes);
	}

	// F.4: accept a Wall height edit through the real coordinator + planners, then
	// the Stage's own post-install admission (what host-acceptance runs), then Undo/Redo.
	const registry = createUnitPlannerRegistry<ProjectEnvelope>();
	const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
		adapter: createUnitAcceptanceAdapter({ compound: true }),
		preparation: createUnitAcceptancePreparation({ registry, sessionEpoch: 'perf-session' }),
		sessionEpoch: 'perf-session',
		baseline: {
			revision: REVISION,
			source: envelope,
			canonicalJson: envJson,
			sourceContentId: await computeEnvelopeSourceContentId(envelope),
			blockingIssues: []
		},
		planners: createLayoutPlanners()
	});
	const acceptSamples: number[] = [];
	const installSamples: number[] = [];
	for (let i = 0; i < (doc.walls.length > 300 ? 8 : 16); i++) {
		const snapshot = coordinator.acceptedSnapshot();
		const revision = coordinator.acceptedRevision();
		const contentRevision = snapshot.domain.source.units.layout.header.contentRevision;
		const intent = buildLayoutIntent({
			kind: LAYOUT_WALL_HEIGHT_KIND,
			operationId: `op-${label.replace(/[^a-z0-9-]+/gi, '-')}-${i}`,
			projectId: revision.projectId,
			revisionId: revision.revisionId,
			contentRevision,
			targets: [layoutReference(snapshot as never, { kind: 'wall', id: wallId }, contentRevision)],
			payload: { wallId, height: i % 2 === 0 ? 3.2 : 3.0 }
		});
		let result: Awaited<ReturnType<typeof coordinator.accept>> | undefined;
		acceptSamples.push(await timeAsync(async () => (result = await coordinator.accept(intent))));
		if (result?.kind !== 'accepted') throw new Error(`${label} accept ${result?.kind}: ${JSON.stringify(result).slice(0, 300)}`);
		const accepted = result;
		installSamples.push(
			await timeAsync(async () => {
				const admission = await admitSource(accepted.snapshot.domain.source, { sessionEpoch: 'perf-session', acceptedRevision: accepted.afterRevision });
				if (admission.kind !== 'admitted') throw new Error('post-install admission failed');
			})
		);
	}
	row.f4AcceptMs = stats(acceptSamples);
	row.stagePostInstallAdmitMs = stats(installSamples);
	const undo: number[] = [];
	const redo: number[] = [];
	for (let i = 0; i < 6; i++) undo.push(await timeAsync(() => coordinator.undo()));
	for (let i = 0; i < 6; i++) redo.push(await timeAsync(() => coordinator.redo()));
	row.f4UndoMs = stats(undo);
	row.f4RedoMs = stats(redo);
	return row;
}

function buildWithOpenings(k: number, withOpenings: boolean) {
	const t = performance.now();
	let doc = buildGrid(k);
	const openingMs: number[] = [];
	if (withOpenings) {
		// Same as fixtures.addOpenings but timing each opening planner call.
		const roomCount = new Map<string, number>();
		for (const room of doc.rooms) for (const ref of room.boundary) roomCount.set(ref.wallId, (roomCount.get(ref.wallId) ?? 0) + 1);
		for (const wall of [...doc.walls]) {
			const a = pointOf(doc, wall.startJunctionId);
			const b = pointOf(doc, wall.endJunctionId);
			const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
			if (len < 3) continue;
			const kind = (roomCount.get(wall.id) ?? 0) >= 2 ? 'door' : 'window';
			let plan!: ReturnType<typeof planCreateWallFirstOpening>;
			openingMs.push(timeSync(() => (plan = planCreateWallFirstOpening(doc, { wallId: wall.id, kind, offset: len / 2 - 0.5 }))));
			if (plan.kind !== 'success') throw new Error('opening refused');
			doc = plan.document;
		}
	}
	return { doc, buildMs: performance.now() - t, openingMs };
}

it('measures warm compile/edit/acceptance cost by Layout size', async () => {
	const rows: Record<string, unknown>[] = [];
	const t0 = performance.now();
	const starter = buildStarterEnclosureLayout();
	rows.push(await measure('starter-enclosure', performance.now() - t0, starter, []));
	const sizes = (process.env.PERF_SIZES ?? '3,7,14').split(',').map(Number);
	for (const k of sizes) {
		const built = buildWithOpenings(k, true);
		rows.push(await measure(`grid-${k}+openings`, built.buildMs, built.doc, built.openingMs));
		console.log(JSON.stringify(rows[rows.length - 1]));
	}
	// Stress above the expected maximum: walls only (openings would add ~20 min of fixture build).
	if (process.env.PERF_STRESS !== '0') {
		const stress = buildWithOpenings(20, false);
		rows.push(await measure('grid-20-walls-only-stress', stress.buildMs, stress.doc, []));
		console.log(JSON.stringify(rows[rows.length - 1]));
	}

	const out = {
		probe: 'compile.probe.ts (warm, in-process, vitest forks --expose-gc)',
		date: new Date().toISOString(),
		node: process.version,
		v8: process.versions.v8,
		platform: `${os.platform()} ${os.release()} ${os.arch()}`,
		cpu: os.cpus()[0]?.model,
		cpus: os.cpus().length,
		memGiB: Math.round(os.totalmem() / 2 ** 30),
		gcExposed: Boolean(gc),
		rows
	};
	mkdirSync(path.join(here, 'results'), { recursive: true });
	writeFileSync(path.join(here, 'results', process.env.PERF_OUT ?? 'compile-warm.json'), JSON.stringify(out, null, 1) + '\n');
});
