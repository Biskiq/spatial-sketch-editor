/** Bounded Node comparison of complete operations, not Bench 2/browser evidence.
 * Run via compare-persistent.mjs, which isolates 764175e0 and the working tree.
 * Count windows and unobserved timing windows are separate. */
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Session } from 'node:inspector';
import * as core from '@portfolio/layout-core';
import { immutableF4Data } from '@portfolio/project-model';
import {
 canonicalUnitJson, createProjectEnvelope, createEmptyUnitSceneDocument, createEmptyCameraPayload,
 createEmptyExperiencePayload, createEmptyResourcePayload, createUnitAcceptanceAdapter,
 createUnitAcceptancePreparation, createUnitPlannerRegistry, type ProjectEnvelope
} from '@portfolio/project-model/units';
import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import { createLayoutPlanners, wallManipulationIntent } from '$lib/authoring/adapters/layout/precision';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { createWallRepresentation } from '$lib/render/layout-wall-representation';
import { createObjectRepresentation } from '$lib/render/layout-object-representation';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from '../../tests/lib/layout/__fixtures__/layout-scale-fixtures';
import { outputDigest } from './persistent-oracle';

const roomCount = Number(process.env.S06_ROOMS ?? 10), iterations = Number(process.env.S06_STEPS ?? 12);
const mode = process.env.S06_MODE ?? 'local';
const render = process.env.S06_RENDER !== '0';
const counts: Record<string, number> = {}, spans: Record<string, number> = {};
const observer = { count(name: string, n: number) { counts[name] = (counts[name] ?? 0) + n; }, span(name: string, n: number) { spans[name] = (spans[name] ?? 0) + n; } };
let sink = 0;
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
async function gc() { await tick(); (globalThis as { gc?: () => void }).gc?.(); await tick(); }
let allocation: { samplingInterval: number; reportedBytes: number; samples: number } | undefined;
const inspector = new Session();
const post = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolve, reject) => inspector.post(method, params, (error, result) => error ? reject(error) : resolve(result)));
async function startAllocation() {
 if (process.env.S06_ALLOCATIONS !== '1') return;
 inspector.connect();
 await post('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
}
async function stopAllocation() {
 if (process.env.S06_ALLOCATIONS !== '1') return;
 const { profile } = await post('HeapProfiler.stopSampling');
 const bytes = (node: any): number => node.selfSize + node.children.reduce((sum: number, child: any) => sum + bytes(child), 0);
 allocation = { samplingInterval: 4096, reportedBytes: bytes(profile.head), samples: profile.samples.length };
 inspector.disconnect();
}
const phase = (name: string) => process.stderr.write(`phase:${name}\n`);
const times: number[] = [];
function quantile(q: number): number { const ordered = [...times].sort((a, b) => a - b); return ordered[Math.floor((ordered.length - 1) * q)] ?? 0; }
function useGeometry(geometry: core.CompiledLayoutGeometry, id: string): void {
 const api = core as typeof core & { indexedCompiledWall?: (g: core.CompiledLayoutGeometry, id: string) => core.CompiledPhysicalWall | undefined; indexedCompiledWallQueries?: (g: core.CompiledLayoutGeometry, id: string) => { spans: readonly unknown[] } | undefined };
 const wall = api.indexedCompiledWall ? api.indexedCompiledWall(geometry, id) : geometry.walls.find((w) => w.wallId === id);
 const records = api.indexedCompiledWallQueries ? api.indexedCompiledWallQueries(geometry, id)?.spans : geometry.queries.spans.filter((span) => span.segmentId === id);
 sink += (wall?.samples.length ?? 0) + (records?.length ?? 0);
}
phase('fixture');
const fixtureShape = process.env.S06_SHAPE ?? 'rooms';
const raw = buildScaleFixture({ ...SCALE_FIXTURE_SEEDS.small, roomCount, ...(fixtureShape === 'freestanding' ? { objectsPerRoom: 0 } : {}) });
if (fixtureShape === 'freestanding') {
 // 31,250 real, isolated Walls + 62,500 Junctions + 6,250 Windows =
 // 100,000 authored entities. Up to 1% of cells retain their seeded curve.
 const selected = Array.from({ length: roomCount }, (_, i) => i % 100 === 1 && raw.walls[i * 4 + 2]!.centerline.kind !== 'line' ? raw.walls[i * 4 + 2]! : raw.walls[i * 4 + 1]!);
 const wallIds = new Set(selected.map((wall) => wall.id));
 const junctionIds = new Set(selected.flatMap((wall) => [wall.startJunctionId, wall.endJunctionId]));
 raw.walls = selected; raw.junctions = raw.junctions.filter((junction) => junctionIds.has(junction.id));
 raw.openings = raw.openings.filter((opening) => opening.kind === 'window' && wallIds.has(opening.wallId) && Number(opening.id.split(':')[0]!.slice(5)) % 5 === 0);
 raw.rooms = []; raw.objects = [];
}
const targetIndex = fixtureShape === 'freestanding' ? 5 : 4;
const census = { rooms: raw.rooms.length, walls: raw.walls.length, junctions: raw.junctions.length, openings: raw.openings.length, objects: raw.objects.length };
const walls = createWallRepresentation(), objects = createObjectRepresentation();
let memoryBefore = 0, memoryAfter = 0;
let memoryBeforeAll: ReturnType<typeof process.memoryUsage> | undefined, memoryAfterAll: ReturnType<typeof process.memoryUsage> | undefined;
const restoration: Record<string, { milliseconds: number; counts: Record<string, number> }> = {};
let oracleDigest: string | undefined, sourceContentId: string | undefined, canonicalJsonSha256: string | undefined;
let historyRetention: { sampled: number; liveSampleIndices: number[]; fixtureBaselineMatchesSample0: boolean } | undefined;
if (mode === 'local') {
 let document = immutableF4Data(raw);
 const session = core.createLayoutCompileSession();
 phase('cold-compile'); const first = session.compile(document); phase('cold-world-index'); core.ensureLayoutWorldIndex(document);
 if (render) { walls.update(first.geometry); objects.update(first.geometry); }
 const target = raw.walls[targetIndex]!.id;
 const run = (i: number) => {
  const plan = core.withLayoutCompileSession(session, () => core.planRigidWallMove(document, { wallId: target, delta: [0, i % 2 ? -0.01 : 0.01] }));
  if (plan.kind !== 'success') throw new Error(plan.rejection.message);
  core.ensureLayoutWorldIndex(plan.document);
  useGeometry(plan.acceptance.geometry, target);
  if (render) { const a = walls.update(plan.acceptance.geometry), b = objects.update(plan.acceptance.geometry); sink += a.built + b.built; }
  document = plan.document;
 };
 for (let i = 0; i < 4; i += 1) { run(i); await tick(); }
 // A real counted operation and then equal, unobserved operations. No empty
 // loop, tiny synthetic point-update or changed baseline hides the work.
 await startAllocation(); core.setWorkObserver(observer); run(0); core.setWorkObserver(null); await stopAllocation();
 await gc(); memoryBeforeAll = process.memoryUsage(); memoryBefore = memoryBeforeAll.heapUsed;
 for (let i = 0; i < iterations; i += 1) {
  const begin = performance.now(); run(i); times.push(performance.now() - begin); await tick();
 }
 await gc(); memoryAfterAll = process.memoryUsage(); memoryAfter = memoryAfterAll.heapUsed;
 // Correctness checking/complete output materialization is outside timing.
 phase('warm-oracle'); const warm = session.compile(document);
 oracleDigest = outputDigest(warm);
 if (process.env.S06_SOURCE_FILE) writeFileSync(process.env.S06_SOURCE_FILE, JSON.stringify(document));
 session.reset();
} else {
 const projectId = 'persistent-comparison';
 const revision = { projectId, revisionId: 'revision-1' };
 const envelope = await createProjectEnvelope({
  id: projectId, name: 'Persistent comparison', acceptedRevision: revision,
  dependencyLock: { formatVersion: 1, entries: [] },
  layout: { unitId: 'layout', data: raw }, scene: { unitId: 'scene', data: createEmptyUnitSceneDocument() },
  camera: { unitId: 'camera', data: createEmptyCameraPayload() }, experience: { unitId: 'experience', data: createEmptyExperiencePayload() },
  resources: { unitId: 'resources', data: createEmptyResourcePayload() }
 });
 const adapter = createUnitAcceptanceAdapter({ compound: true });
 const baseline = await adapter.admit(envelope);
 if (baseline.kind !== 'admitted') throw new Error(JSON.stringify(baseline));
 const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({ adapter, sessionEpoch: 'comparison',
  baseline: { revision, source: baseline.source, sourceContentId: baseline.sourceContentId, canonicalJson: baseline.canonicalJson },
  preparation: createUnitAcceptancePreparation({ registry: createUnitPlannerRegistry(), sessionEpoch: 'comparison' }),
  planners: createLayoutPlanners(), mintRevisionId: (n) => `revision-${n + 1}` });
 const stageSession = core.createLayoutCompileSession();
 async function install(source: ProjectEnvelope, acceptedRevision: typeof revision, known: { sourceContentId: string; canonicalJson: string }) {
  const admitted = await admitSource(source, { acceptedRevision, sessionEpoch: 'comparison' }, { compileSession: stageSession, knownIdentity: known });
  if (admitted.kind !== 'admitted') throw new Error(JSON.stringify(admitted));
  if (render) { walls.update(admitted.snapshot.domain.geometry); objects.update(admitted.snapshot.domain.geometry); }
  useGeometry(admitted.snapshot.domain.geometry, raw.walls[targetIndex]!.id);
 }
 await install(coordinator.current().source, coordinator.acceptedRevision(), coordinator.current());
 const early: WeakRef<object>[] = [];
 async function run(i: number) {
  const before = coordinator.current();
  if (mode === 'history' && i < 10) early.push(new WeakRef(before.source.units.layout.data));
  const intent = wallManipulationIntent({ request: { kind: 'move', delta: [0, i % 2 ? -0.01 : 0.01] }, wallId: raw.walls[targetIndex]!.id, fixed: 'start', operationId: `comparison-${i}`,
   projectId, revisionId: before.revision.revisionId, contentRevision: before.source.units.layout.header.contentRevision, levelId: raw.floor.id });
  const result = await coordinator.accept(intent);
  if (result.kind !== 'accepted') throw new Error(JSON.stringify(result));
  const candidate = core.consumePreparedCowCandidate(intent.operationId, { baseline: before.source.units.layout.data, key: canonicalUnitJson(intent) });
  if (candidate) core.linkClonedCowCandidate(candidate, result.snapshot.domain.source.units.layout.data);
  await install(result.snapshot.domain.source, result.afterRevision, coordinator.current());
  sink += coordinator.installs();
 }
 for (let i = 0; i < 3; i += 1) { await run(i); await tick(); }
 await startAllocation(); core.setWorkObserver(observer); await run(3); core.setWorkObserver(null); await stopAllocation();
 await gc(); memoryBeforeAll = process.memoryUsage(); memoryBefore = memoryBeforeAll.heapUsed;
 for (let i = 4; i < iterations + 4; i += 1) { const begin = performance.now(); await run(i); times.push(performance.now() - begin); await tick(); }
 for (const direction of ['undo', 'redo'] as const) {
  const restoreCounts: Record<string, number> = {};
  core.setWorkObserver({ span() {}, count(name, amount) { restoreCounts[name] = (restoreCounts[name] ?? 0) + amount; } });
  const begin = performance.now();
  const restored = await coordinator[direction]();
  if (restored.kind !== 'restored') throw new Error(`${direction} refused`);
  await install(coordinator.current().source, coordinator.acceptedRevision(), coordinator.current());
  restoration[direction] = { milliseconds: performance.now() - begin, counts: restoreCounts };
  core.setWorkObserver(null);
 }
 await gc(); memoryAfterAll = process.memoryUsage(); memoryAfter = memoryAfterAll.heapUsed;
 historyRetention = { sampled: early.length, liveSampleIndices: early.flatMap((ref, index) => ref.deref() === undefined ? [] : [index]), fixtureBaselineMatchesSample0: early.length > 0 && early[0]!.deref() === baseline.source.units.layout.data };
 Object.assign(counts, { 'report:history-depth': coordinator.history().depth, 'report:early-sources-live': early.filter((ref) => ref.deref() !== undefined).length });
 sourceContentId = coordinator.current().sourceContentId;
 canonicalJsonSha256 = createHash('sha256').update(coordinator.current().canonicalJson).digest('hex');
 const finalDocument = coordinator.current().source.units.layout.data;
 oracleDigest = outputDigest(stageSession.compile(finalDocument));
 if (process.env.S06_SOURCE_FILE) writeFileSync(process.env.S06_SOURCE_FILE, JSON.stringify(finalDocument));
 stageSession.reset();
}
walls.dispose(); objects.dispose();
const result = { label: 'bounded Node comparison; not Bench 2 or product budget evidence', mode, render, fixtureShape, fixtureSeedRooms: roomCount, roomCount: census.rooms, iterations, census, entities: Object.values(census).reduce((a, b) => a + b, 0),
 timing: { medianMs: quantile(0.5), p95Ms: quantile(0.95), minMs: Math.min(...times), totalMs: times.reduce((a, b) => a + b, 0), samplesMs: times },
 counts, spans, restoration, historyRetention, allocation, oracleDigest, sourceContentId, canonicalJsonSha256, heap: { beforeBytes: memoryBefore, afterBytes: memoryAfter, retainedDeltaBytes: memoryAfter - memoryBefore, before: memoryBeforeAll, after: memoryAfterAll }, sink };
if (process.env.S06_RESULT) writeFileSync(process.env.S06_RESULT, JSON.stringify(result, null, 2) + '\n');
else process.stdout.write(JSON.stringify(result) + '\n');
