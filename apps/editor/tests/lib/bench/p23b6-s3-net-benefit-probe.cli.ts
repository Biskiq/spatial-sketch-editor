/**
 * P23B.6 S3 comparator/net-benefit A/B probe. Execute from apps/editor:
 *
 *   npm exec -- vite-node --config vitest.config.ts --mode production tests/lib/bench/p23b6-s3-net-benefit-probe.cli.ts
 *
 * This is an advisory one-off measurement, not a test. It compares the
 * committed S3b comparator with S1's Object.keys deep-equal and D-5's JSON
 * string ceiling on the same precompiled candidate generations. The reference
 * is prepared once. It writes no baseline or reuse ratchet and installs no
 * cross-generation reuse in production.
 */
import { execFileSync } from 'node:child_process';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	compileWallFirstLayoutGeometry,
	legJoinsByWall,
	planRigidWallMove,
	planWallFirstRoomMove,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS, P23B_OWNER_LAYOUT } from '$lib/bench/p23b-fixtures';
import { percentile, timeOp } from '$lib/bench/bench-harness';
import { buildStandaloneWallMesh, type IndexedWallMesh } from '$lib/layout/wall-mesh-builder';
import {
	preparedWallMeshInput,
	wallMeshReuseRefusalReason,
	type PreparedWallMeshInput,
	type PreparedWallMeshReference
} from '$lib/editor/layout/prepared-wall-meshes';
import { jsonStringDeepEqual, s1DeepEqual } from './p23b6-comparator-strategies';

const WARMUP = 5;
const SAMPLES = 15;
const SAMPLE_GENERATIONS = WARMUP + SAMPLES;
const editorRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const repositoryRoot = path.resolve(editorRoot, '../..');
const codeHead =
	process.env.GIT_SHA ??
	execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
const workingTreeDirty =
	execFileSync('git', ['status', '--porcelain'], { cwd: repositoryRoot, encoding: 'utf8' }).trim().length > 0;

type ComparatorName = 'deepEqualOwnData' | 'S1 Object.keys deepEqual' | 'D-5 JSON stringify';

const comparatorNames: ComparatorName[] = [
	'deepEqualOwnData',
	'S1 Object.keys deepEqual',
	'D-5 JSON stringify'
];

function compile(document: LayoutDocumentWallFirst): CompiledLayoutGeometry {
	const result = compileWallFirstLayoutGeometry(document);
	if (result.issues.length > 0) {
		throw new Error(`fixture compile failed: ${result.issues.map((issue) => issue.code).join(', ')}`);
	}
	return result.geometry;
}

function inputMap(geometry: CompiledLayoutGeometry): Map<string, PreparedWallMeshInput> {
	const endsByWall = legJoinsByWall(geometry.junctions);
	const elevations = new Map(geometry.floors.map((floor) => [floor.floorId, floor.elevation] as const));
	return new Map(
		geometry.walls.map((wall) => [
			wall.wallId,
			preparedWallMeshInput(wall, elevations.get(wall.floorId) ?? 0, endsByWall.get(wall.wallId) ?? null)
		] as const)
	);
}

function build(input: PreparedWallMeshInput): IndexedWallMesh {
	const result = buildStandaloneWallMesh(input.wall, input.floorElevation, input.ends);
	if (!result.mesh) {
		throw new Error(`mesh build failed for ${input.wall.wallId}: ${result.issues.map((issue) => issue.code).join(', ')}`);
	}
	return result.mesh;
}

function referenceMap(inputs: Map<string, PreparedWallMeshInput>): Map<string, PreparedWallMeshReference> {
	return new Map([...inputs].map(([wallId, input]) => [wallId, { input, mesh: build(input) }] as const));
}

function canReuse(
	comparator: ComparatorName,
	candidate: PreparedWallMeshInput,
	reference: PreparedWallMeshReference | null
): boolean {
	if (!reference?.mesh) return false;
	if (comparator === 'deepEqualOwnData') {
		return wallMeshReuseRefusalReason(candidate, reference) === null;
	}
	const equal = comparator === 'S1 Object.keys deepEqual' ? s1DeepEqual : jsonStringDeepEqual;
	return equal(candidate, reference.input);
}

function matchingWalls(
	comparator: ComparatorName,
	candidates: Map<string, PreparedWallMeshInput>,
	references: Map<string, PreparedWallMeshReference>
): string[] {
	const matches: string[] = [];
	for (const [wallId, candidate] of candidates) {
		if (canReuse(comparator, candidate, references.get(wallId) ?? null)) matches.push(wallId);
	}
	return matches;
}

function buildAll(inputs: Map<string, PreparedWallMeshInput>, wallIds?: ReadonlySet<string>): number {
	let indexCount = 0;
	for (const [wallId, input] of inputs) {
		if (wallIds && !wallIds.has(wallId)) continue;
		indexCount += build(input).indices.length;
	}
	return indexCount;
}

function prepareWithReuse(
	comparator: ComparatorName,
	candidates: Map<string, PreparedWallMeshInput>,
	references: Map<string, PreparedWallMeshReference>
): number {
	let indexCount = 0;
	for (const [wallId, candidate] of candidates) {
		const reference = references.get(wallId) ?? null;
		const mesh = canReuse(comparator, candidate, reference) ? reference!.mesh! : build(candidate);
		indexCount += mesh.indices.length;
	}
	return indexCount;
}

function measurePerGeneration<T>(
	items: readonly T[],
	work: (item: T) => unknown
): { value: number; p50: number; p95: number } {
	if (items.length !== SAMPLE_GENERATIONS) {
		throw new Error(`expected ${SAMPLE_GENERATIONS} fresh candidate generations, got ${items.length}`);
	}
	for (let index = 0; index < WARMUP; index += 1) work(items[index]!);
	const timings: number[] = [];
	for (let index = WARMUP; index < items.length; index += 1) {
		const start = performance.now();
		work(items[index]!);
		timings.push(performance.now() - start);
	}
	const p50 = percentile(timings, 50);
	return { value: p50, p50, p95: percentile(timings, 95) };
}

function candidateDocuments(document: LayoutDocumentWallFirst) {
	const target = document.walls.find((wall) => wall.id.endsWith(':wall-1')) ?? document.walls[1]!;
	const move = planRigidWallMove(document, target.id, [0, 0.25]);
	const roomMove = document.rooms[0]
		? planWallFirstRoomMove(document, document.rooms[0].id, [0.25, 0])
		: null;
	return [
		{
			actionClass: 'single-wall-move-release',
			document: move.kind === 'success' ? move.document : null,
			note: move.kind === 'rejected' ? move.rejection.code : undefined
		},
		{
			actionClass: 'whole-room-move-bridge',
			document: roomMove?.kind === 'success' ? roomMove.document : null,
			note: roomMove?.kind === 'rejected' ? roomMove.rejection.code : undefined
		}
	];
}

const fixtureSpecs = [
	'p23b-40-wall-straight-v1',
	'p23b-40-wall-target-curved-v1',
	'p23b-40-wall-all-curved-v1'
];
const fixtures = [
	...fixtureSpecs.map((fixtureId) => ({
		fixtureId,
		document: buildP23BMatrixFixture(P23B_MATRIX_SPECS.find((spec) => spec.id === fixtureId)!)
	})),
	{ fixtureId: 'owner-40-curved-v1', document: P23B_OWNER_LAYOUT }
];

const report = {
	protocol: 'P23B.6 S3 comparator A/B; advisory Node timing; no baseline or ratchet access',
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
		nodeEnv: process.env.NODE_ENV ?? 'unset'
	},
	configuration: {
		warmup: WARMUP,
		samples: SAMPLES,
		freshCompiledGenerationsPerAction: SAMPLE_GENERATIONS,
		referencePreparation: 'once per fixture before comparator/action measurements',
		comparators: comparatorNames
	},
	fixtures: fixtures.flatMap(({ fixtureId, document }) => {
		const baseInputs = inputMap(compile(document));
		const references = referenceMap(baseInputs);
		return candidateDocuments(document).map(({ actionClass, document: candidateDocument, note }) => {
			if (!candidateDocument) return { fixtureId, actionClass, accepted: false, note };
			const candidateGenerations = Array.from({ length: SAMPLE_GENERATIONS }, () => compile(candidateDocument));
			const freshCompiledGenerationCount = new Set(candidateGenerations).size;
			if (freshCompiledGenerationCount !== SAMPLE_GENERATIONS) {
				throw new Error(
					`${fixtureId} ${actionClass} expected ${SAMPLE_GENERATIONS} fresh compiled generations, got ${freshCompiledGenerationCount}`
				);
			}
			const candidateSamples = candidateGenerations.map(inputMap);
			const fullPreparationMs = measurePerGeneration(candidateSamples, (candidate) => buildAll(candidate));
			const comparatorResults = comparatorNames.map((comparator) => {
				const equalIds = matchingWalls(comparator, candidateSamples[WARMUP]!, references);
				const equalIdSet = new Set(equalIds);
				const comparatorMs = measurePerGeneration(candidateSamples, (candidate) =>
					matchingWalls(comparator, candidate, references)
				);
				const buildMsForSkippedWalls = timeOp(
					() => buildAll(baseInputs, equalIdSet),
					{ warmup: WARMUP, samples: SAMPLES }
				);
				const reusePreparationMs = measurePerGeneration(candidateSamples, (candidate) =>
					prepareWithReuse(comparator, candidate, references)
				);
				const netSavingsMs = fullPreparationMs.p50 - reusePreparationMs.p50;
				return {
					comparator,
					reusedWallMeshes: equalIds.length,
					builtWallMeshes: candidateSamples[WARMUP]!.size - equalIds.length,
					comparatorMs,
					buildMsForSkippedWalls,
					comparatorPercentOfSkippedBuild: buildMsForSkippedWalls.p50 === 0
						? null
						: Math.round((comparatorMs.p50 / buildMsForSkippedWalls.p50) * 1000) / 10,
					fullPreparationMs,
					reusePreparationMs,
					netSavingsMs: Math.round(netSavingsMs * 1000) / 1000,
					netSavingsPercent: fullPreparationMs.p50 === 0
						? null
						: Math.round((netSavingsMs / fullPreparationMs.p50) * 1000) / 10
				};
			});
			return {
				fixtureId,
				actionClass,
				accepted: true,
				candidateWalls: candidateSamples[WARMUP]!.size,
				freshCompiledGenerations: freshCompiledGenerationCount,
				fullPreparationMs,
				comparators: comparatorResults
			};
		});
	})
};

console.log(JSON.stringify(report, null, 2));
