/**
 * P23B.6 S1a one-off measurement runner. Execute from apps/editor with:
 *
 *   npm exec -- vite-node --config vitest.config.ts --mode development tests/lib/bench/p23b6-s1-node-probe.cli.ts
 *   npm exec -- vite-node --config vitest.config.ts --mode production tests/lib/bench/p23b6-s1-node-probe.cli.ts
 *
 * It prints advisory node/proxy timings and deterministic action-reachability
 * counts. It is deliberately not a test and writes no baseline or ratchet.
 */
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV as SVELTE_DEV } from 'esm-env';
import { proxy } from 'svelte/internal/client';
import { MeshBasicMaterial } from 'three';

import {
	compileWallFirstLayoutGeometry,
	legJoinsByWall,
	planBendWallCurveKnot,
	planExactWallThickness,
	planRigidWallMove,
	planWallChain,
	planWallFirstRoomMove,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS, P23B_OWNER_LAYOUT } from '$lib/bench/p23b-fixtures';
import { timeOp } from '$lib/bench/bench-harness';
import { s1DeepEqual } from './p23b6-comparator-strategies';
import { withPlanAttentionSceneInk } from '$lib/editor/layout/plan-attention';
import { createPlanSalienceMemory, resolvePlanSalience } from '$lib/editor/layout/plan-salience';
import {
	buildStandaloneWallMesh,
	STANDALONE_WALL_MESH_BUILDER_SIGNATURE
} from '$lib/layout/wall-mesh-builder';
import { buildPlanRenderModel } from '$lib/layout/plan-render-model';
import { toWallBufferGeometry } from '$lib/render/wall-geometry-adapter';
import type { PlanPolygonPrimitive } from '$lib/layout/plan-render-model';

const WARMUP = 5;
const SAMPLES = 15;
const editorRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const repositoryRoot = path.resolve(editorRoot, '../..');
const codeHead =
	process.env.GIT_SHA ??
	execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
const workingTreeDirty =
	execFileSync('git', ['status', '--porcelain'], { cwd: repositoryRoot, encoding: 'utf8' }).trim().length > 0;
const BUILDER_SIGNATURE = STANDALONE_WALL_MESH_BUILDER_SIGNATURE;
const VIEW = {
	center: [40, 24] as [number, number],
	width: 1280,
	height: 800,
	pixelsPerMeter: 19.29,
	initialized: true,
	gridEnabled: true,
	snapEnabled: true,
	angleSnapEnabled: true,
	showTourOverlay: false
};

function measure(work: () => unknown) {
	return timeOp(work, { warmup: WARMUP, samples: SAMPLES });
}

function compiled(document: LayoutDocumentWallFirst): CompiledLayoutGeometry {
	const result = compileWallFirstLayoutGeometry(document);
	if (result.issues.length > 0) throw new Error(`fixture compile failed: ${result.issues.map((issue) => issue.code).join(', ')}`);
	return result.geometry;
}

function countNodes(value: unknown, seen = new Set<object>()): number {
	if (value === null || typeof value !== 'object' || seen.has(value)) return 0;
	seen.add(value);
	return 1 + Object.values(value).reduce((sum, child) => sum + countNodes(child, seen), 0);
}

function wallInputMap(geometry: CompiledLayoutGeometry) {
	const endsByWall = legJoinsByWall(geometry.junctions);
	const elevations = new Map(geometry.floors.map((floor) => [floor.floorId, floor.elevation] as const));
	return new Map(geometry.walls.map((wall) => [wall.wallId, {
		wall,
		floorElevation: elevations.get(wall.floorId) ?? 0,
		ends: endsByWall.get(wall.wallId) ?? null,
		builderSignature: BUILDER_SIGNATURE
	}] as const));
}

function compareGeneration(reference: CompiledLayoutGeometry, candidate: CompiledLayoutGeometry) {
	const referenceInputs = wallInputMap(reference);
	const candidateInputs = wallInputMap(candidate);
	const equalIds: string[] = [];
	for (const [wallId, candidateInput] of candidateInputs) {
		const referenceInput = referenceInputs.get(wallId);
		if (referenceInput && s1DeepEqual(referenceInput, candidateInput)) equalIds.push(wallId);
	}
	return { equalIds, candidateWallCount: candidate.walls.length };
}

function buildMeshes(geometry: CompiledLayoutGeometry, wallIds?: ReadonlySet<string>): number {
	const endsByWall = legJoinsByWall(geometry.junctions);
	const elevations = new Map(geometry.floors.map((floor) => [floor.floorId, floor.elevation] as const));
	let built = 0;
	for (const wall of geometry.walls) {
		if (wallIds && !wallIds.has(wall.wallId)) continue;
		const result = buildStandaloneWallMesh(wall, elevations.get(wall.floorId) ?? 0, endsByWall.get(wall.wallId) ?? null);
		if (!result.mesh) throw new Error(`mesh build failed for ${wall.wallId}: ${result.issues.map((issue) => issue.code).join(', ')}`);
		built += result.mesh.indices.length;
	}
	return built;
}

function buildPreparedMeshes(geometry: CompiledLayoutGeometry): NonNullable<ReturnType<typeof buildStandaloneWallMesh>['mesh']>[] {
	const endsByWall = legJoinsByWall(geometry.junctions);
	const elevations = new Map(geometry.floors.map((floor) => [floor.floorId, floor.elevation] as const));
	const meshes: NonNullable<ReturnType<typeof buildStandaloneWallMesh>['mesh']>[] = [];
	for (const wall of geometry.walls) {
		const result = buildStandaloneWallMesh(wall, elevations.get(wall.floorId) ?? 0, endsByWall.get(wall.wallId) ?? null);
		if (!result.mesh) throw new Error(`mesh build failed for ${wall.wallId}: ${result.issues.map((issue) => issue.code).join(', ')}`);
		meshes.push(result.mesh);
	}
	return meshes;
}

function actionCandidates(document: LayoutDocumentWallFirst, base: CompiledLayoutGeometry) {
	const targetWall = document.walls.find((wall) => wall.id.endsWith(':wall-1')) ?? document.walls[1]!;
	const candidates: Array<{ actionClass: string; document: LayoutDocumentWallFirst | null; note?: string }> = [];
	const resize = planExactWallThickness(document, targetWall.id, targetWall.thickness + 0.05);
	candidates.push({ actionClass: 'single-wall-resize-release', document: resize.kind === 'success' ? resize.document : null, note: resize.kind === 'rejected' ? resize.rejection.code : undefined });
	const move = planRigidWallMove(document, targetWall.id, [0, 0.25]);
	candidates.push({ actionClass: 'single-wall-move-release', document: move.kind === 'success' ? move.document : null, note: move.kind === 'rejected' ? move.rejection.code : undefined });

	const curvedWall = document.walls.find((wall) => wall.centerline.kind === 'cubic-chain');
	if (!curvedWall) {
		candidates.push({ actionClass: 'bend-release', document: null, note: 'not applicable: fixture has no authored curve knot' });
	} else {
		const knot = curvedWall.centerline.kind === 'cubic-chain' ? curvedWall.centerline.knots[0] : undefined;
		const points = knot
			? [[knot.point[0] + 0.25, knot.point[1]], [knot.point[0] - 0.25, knot.point[1]], [knot.point[0], knot.point[1] + 0.25], [knot.point[0], knot.point[1] - 0.25]] as const
			: [];
		let accepted: LayoutDocumentWallFirst | null = null;
		let rejection = 'no candidate point accepted';
		for (const point of points) {
			const plan = planBendWallCurveKnot(document, curvedWall.id, { distance: 4, point: point as [number, number] });
			if (plan.kind === 'success') { accepted = plan.document; break; }
			rejection = plan.rejection.code;
		}
		candidates.push({ actionClass: 'bend-release', document: accepted, note: accepted ? undefined : rejection });
	}

	const maxX = Math.max(...document.junctions.map((junction) => junction.point[0]));
	const minZ = Math.min(...document.junctions.map((junction) => junction.point[1]));
	const room = planWallChain({
		baseline: document,
		points: [[maxX + 8, minZ], [maxX + 12, minZ], [maxX + 12, minZ + 4], [maxX + 8, minZ + 4]],
		close: true,
		role: 'boundary'
	});
	candidates.push({ actionClass: 'room-creation-commit', document: room.kind === 'success' ? room.document : null, note: room.kind === 'rejected' ? room.rejection.code : undefined });

	const roomMove = document.rooms[0] ? planWallFirstRoomMove(document, document.rooms[0].id, [0.25, 0]) : null;
	candidates.push({ actionClass: 'whole-room-move-bridge', document: roomMove?.kind === 'success' ? roomMove.document : null, note: roomMove?.kind === 'rejected' ? roomMove.rejection.code : undefined });

	return candidates.map(({ actionClass, document: candidateDocument, note }) => {
		if (!candidateDocument) return { actionClass, accepted: false, note };
		const next = compiled(candidateDocument);
		const result = compareGeneration(base, next);
		const equalIds = new Set(result.equalIds);
		const comparator = measure(() => compareGeneration(base, next));
		const skippedBuild = measure(() => buildMeshes(base, equalIds));
		const fullBuild = measure(() => buildMeshes(next));
		return {
			actionClass,
			accepted: true,
			candidateWalls: result.candidateWallCount,
			valueEqualWalls: result.equalIds.length,
			addedOrChangedWalls: result.candidateWallCount - result.equalIds.length,
			comparatorMs: comparator,
			buildMsForSkippedWalls: skippedBuild,
			fullCandidateMeshBuildMs: fullBuild,
			comparatorPercentOfSkippedBuild: skippedBuild.p50 === 0 ? null : Math.round(comparator.p50 / skippedBuild.p50 * 1000) / 10
		};
	});
}

function fixtureDocs(): Array<{ id: string; document: LayoutDocumentWallFirst }> {
	const ids = ['p23b-40-wall-straight-v1', 'p23b-40-wall-target-curved-v1', 'p23b-40-wall-all-curved-v1'];
	return [
		...ids.map((id) => ({ id, document: buildP23BMatrixFixture(P23B_MATRIX_SPECS.find((spec) => spec.id === id)!) })),
		{ id: 'owner-40-curved-v1', document: P23B_OWNER_LAYOUT }
	];
}

const report = {
	protocol: 'P23B.6 S1a one-off; advisory node timing; no timing threshold; no baseline or ratchet access',
	provenance: {
		commitSha: codeHead,
		workingTreeDirty,
		workingTreeChangesIncluded: workingTreeDirty,
		date: new Date().toISOString(),
		node: process.version,
		platform: `${platform()} ${release()} ${arch()}`,
		cpu: cpus()[0]?.model ?? 'unknown',
		cpuCount: cpus().length,
		totalMemoryBytes: totalmem(),
		nodeEnv: process.env.NODE_ENV ?? 'unset',
		svelteRuntime: SVELTE_DEV ? 'development' : 'production'
	},
	configuration: { warmup: WARMUP, samples: SAMPLES, comparatorBuilderSignature: BUILDER_SIGNATURE },
	fixtures: fixtureDocs().map(({ id, document }) => {
		const geometry = compiled(document);
		const compileMs = measure(() => compileWallFirstLayoutGeometry(document));
		const meshBuild = measure(() => buildMeshes(geometry));
		const preparedMeshes = buildPreparedMeshes(geometry);
		const material = new MeshBasicMaterial();
		const adapterMs = measure(() => {
			const adapters = preparedMeshes.map((mesh) => toWallBufferGeometry(mesh, () => ({ material })));
			for (const adapter of adapters) adapter.dispose();
		});
		material.dispose();
		const rawModel = buildPlanRenderModel(geometry);
		const proxyRoot = proxy(geometry) as CompiledLayoutGeometry;
		const warmProxyModel = buildPlanRenderModel(proxyRoot);
		const planModelRaw = measure(() => buildPlanRenderModel(geometry));
		const planModelProxyCold = measure(() => buildPlanRenderModel(proxy(geometry) as CompiledLayoutGeometry));
		const planModelProxyWarm = measure(() => buildPlanRenderModel(proxyRoot));
		const rawPlanView = { ...VIEW, center: [...VIEW.center] as [number, number] };
		const proxyPlanView = proxy({ ...VIEW, center: [...VIEW.center] as [number, number] });
		const proxiedPlanModel = proxy(rawModel);
		const salienceMemory = createPlanSalienceMemory();
		const proxySalienceMemory = createPlanSalienceMemory();
		const salienceRaw = measure(() => resolvePlanSalience({ model: rawModel, view: rawPlanView }, salienceMemory));
		const salienceProxyModelAndView = measure(() => resolvePlanSalience({ model: proxiedPlanModel, view: proxyPlanView }, proxySalienceMemory));
		const zone = { minX: 0, minY: 0, maxX: 600, maxY: 500, radiusPx: 180, touchedAtMs: 0 };
		const resolvedSalienceRaw = resolvePlanSalience({ model: rawModel, view: rawPlanView }, createPlanSalienceMemory());
		const resolvedSalienceProxy = resolvePlanSalience({ model: proxiedPlanModel, view: proxyPlanView }, createPlanSalienceMemory());
		const sceneProbe = {
			key: 'p23b6-scene-probe',
			kind: 'scene-footprint',
			points: [[39, 23], [41, 23], [41, 25], [39, 25]]
		} as unknown as PlanPolygonPrimitive;
		const planPresentationRaw = measure(() => {
			const presentation = withPlanAttentionSceneInk(resolvedSalienceRaw, rawPlanView, zone);
			return presentation.sceneInkFor?.(sceneProbe) ?? presentation.sceneInk;
		});
		const planPresentationProxy = measure(() => {
			const presentation = withPlanAttentionSceneInk(resolvedSalienceProxy, proxyPlanView, proxy(zone));
			return presentation.sceneInkFor?.(sceneProbe) ?? presentation.sceneInk;
		});
		const geometryNodes = countNodes(geometry);
		return {
			fixtureId: id,
			rooms: document.rooms.length,
			walls: geometry.walls.length,
			compiledGeometryNodes: geometryNodes,
			planPrimitiveCount: rawModel.layers.reduce((sum, layer) => sum + layer.primitives.length, 0),
			compileMs,
			meshBuildMs: meshBuild,
			adapter40Ms: adapterMs,
			planModelMs: {
				rawGeometry: planModelRaw,
				stateProxyCold: planModelProxyCold,
				stateProxyWarm: planModelProxyWarm,
				proxyColdMultiplier: planModelRaw.p50 === 0 ? null : Math.round(planModelProxyCold.p50 / planModelRaw.p50 * 100) / 100,
				proxyWarmMultiplier: planModelRaw.p50 === 0 ? null : Math.round(planModelProxyWarm.p50 / planModelRaw.p50 * 100) / 100,
				proxyOutputMatchesRaw: JSON.stringify(warmProxyModel) === JSON.stringify(rawModel)
			},
			planSalienceMs: { rawDerivedModelAndView: salienceRaw, proxyDiagnosticModelAndView: salienceProxyModelAndView },
			planPresentationMs: {
				note: 'Wrapper construction plus one representative sceneInkFor footprint lookup; salience is pre-resolved and excluded.',
				rawDerivedInputs: planPresentationRaw,
				proxyDiagnosticInputs: planPresentationProxy
			},
			actionReachability: actionCandidates(document, geometry)
		};
	})
};

console.log(JSON.stringify(report, null, 2));
