/**
 * P23B.6 S3 integrated preparation/net-benefit probe. Execute from apps/editor:
 *
 *   npm exec -- vite-node --config vitest.config.ts --mode production tests/lib/bench/p23b6-s3-net-benefit-probe.cli.ts
 *
 * This is advisory timing only. It exercises the same generation preparation
 * and single WeakMap cache used by the editor; it writes no baseline or ratchet.
 */
import { execFileSync } from 'node:child_process';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	compileWallFirstLayoutGeometry,
	planRigidWallMove,
	planWallFirstRoomMove,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS, P23B_OWNER_LAYOUT } from '$lib/bench/p23b-fixtures';
import { percentile } from '$lib/bench/bench-harness';
import {
	collectPreparedWallMeshInputs,
	getPreparedWallMeshes,
	prepareWallMeshes,
	validatePreparedWallMeshInputs,
	wallMeshReuseRefusalReason,
	type PreparedWallMeshInput,
	type PreparedWallMeshReference
} from '$lib/editor/layout/prepared-wall-meshes';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';

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

type Timings = { p50: number; p95: number };

function rounded(value: number): number {
	return Math.round(value * 1000) / 1000;
}

function summarize(samples: number[]): Timings {
	return { p50: rounded(percentile(samples, 50)), p95: rounded(percentile(samples, 95)) };
}

function compile(document: LayoutDocumentWallFirst): CompiledLayoutGeometry {
	const result = compileWallFirstLayoutGeometry(document);
	if (result.issues.length > 0) {
		throw new Error(`fixture compile failed: ${result.issues.map((issue) => issue.code).join(', ')}`);
	}
	return result.geometry;
}

function measurePerGeneration<T>(
	items: readonly T[],
	work: (item: T) => unknown
): Timings {
	if (items.length !== SAMPLE_GENERATIONS) {
		throw new Error(`expected ${SAMPLE_GENERATIONS} fresh generations, got ${items.length}`);
	}
	for (let index = 0; index < WARMUP; index += 1) work(items[index]!);
	const timings: number[] = [];
	for (let index = WARMUP; index < items.length; index += 1) {
		const start = performance.now();
		work(items[index]!);
		timings.push(performance.now() - start);
	}
	return summarize(timings);
}

function measureRepeated(work: () => unknown): Timings {
	for (let index = 0; index < WARMUP; index += 1) work();
	const timings: number[] = [];
	for (let index = 0; index < SAMPLES; index += 1) {
		const start = performance.now();
		work();
		timings.push(performance.now() - start);
	}
	return summarize(timings);
}

function referenceFor(
	wallId: string,
	referenceInputs: ReadonlyMap<string, PreparedWallMeshInput>,
	prepared: NonNullable<ReturnType<typeof getPreparedWallMeshes>>
): PreparedWallMeshReference | null {
	const input = referenceInputs.get(wallId);
	if (!input) return null;
	return {
		input,
		structureValid: prepared.reuseInputsStructureValid,
		mesh: prepared.wallMeshesByWall.get(wallId),
		issues: prepared.wallMeshIssuesByWall.get(wallId)
	};
}

function compareGenerationInputs(
	candidateInputs: ReadonlyMap<string, PreparedWallMeshInput>,
	candidateStructureValid: boolean,
	referenceInputs: ReadonlyMap<string, PreparedWallMeshInput>,
	referencePrepared: NonNullable<ReturnType<typeof getPreparedWallMeshes>>
) {
	const reusedWallIds: string[] = [];
	const refusedByReason: Record<string, number> = {};
	for (const [wallId, input] of candidateInputs) {
		const reference = referenceFor(wallId, referenceInputs, referencePrepared);
		const reason = wallMeshReuseRefusalReason(input, reference, candidateStructureValid);
		if (reason === null && reference?.mesh && reference.issues?.length === 0) {
			reusedWallIds.push(wallId);
		} else {
			const refusal = reason ?? 'reference-build-failed';
			refusedByReason[refusal] = (refusedByReason[refusal] ?? 0) + 1;
		}
	}
	return { reusedWallIds, refusedByReason };
}

function candidateDocuments(document: LayoutDocumentWallFirst) {
	const target = document.walls.find((wall) => wall.id.endsWith(':wall-1')) ?? document.walls[1]!;
	const move = planRigidWallMove(document, target.id, [0, 0.25]);
	const roomMove = document.rooms[0]
		? planWallFirstRoomMove(document, document.rooms[0].id, [0.25, 0])
		: null;
	return [
		{
			actionClass: 'accepted-single-wall-move-release',
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
	protocol: 'P23B.6 S3 integrated generation-preparation probe; advisory Node timing; no baseline or ratchet access',
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
		viteMode: import.meta.env.MODE,
		viteDev: import.meta.env.DEV
	},
	configuration: {
		warmup: WARMUP,
		samples: SAMPLES,
		freshCompiledGenerationsPerPathAndAction: SAMPLE_GENERATIONS,
		preparationCountingUnit: 'one full generation preparation; per-Wall reuse is inside this call',
		referencePreparation: 'one prepared currently-installed generation per fixture',
		paths: ['full-preparation-no-reference', 'integrated-preparation-with-reference']
	},
	fixtures: fixtures.flatMap(({ fixtureId, document }) => {
		const referenceGeometry = compile(document);
		const referencePrepared = prepareWallMeshes(referenceGeometry);
		if (referencePrepared.issues.length > 0) {
			throw new Error(`${fixtureId} reference prep failed: ${referencePrepared.issues.map((issue) => issue.code).join(', ')}`);
		}
		const referenceInputs = referencePrepared.wallMeshInputsByWall;
		return candidateDocuments(document).map(({ actionClass, document: candidateDocument, note }) => {
			if (!candidateDocument) return { fixtureId, actionClass, accepted: false, note };
			const fullGenerations = Array.from({ length: SAMPLE_GENERATIONS }, () => compile(candidateDocument));
			const reuseGenerations = Array.from({ length: SAMPLE_GENERATIONS }, () => compile(candidateDocument));
			const uniqueGenerations = new Set([...fullGenerations, ...reuseGenerations]).size;
			if (uniqueGenerations !== SAMPLE_GENERATIONS * 2) {
				throw new Error(`${fixtureId} ${actionClass} compiled generation identities were not fresh`);
			}

			const fullPreparationMs = measurePerGeneration(fullGenerations, (generation) =>
				prepareWallMeshes(generation)
			);
			const integratedPreparationMs = measurePerGeneration(reuseGenerations, (generation) =>
				prepareWallMeshes(generation, referenceGeometry)
			);
			const netBenefitMs = rounded(fullPreparationMs.p50 - integratedPreparationMs.p50);

			const preparedInputs = reuseGenerations.map(collectPreparedWallMeshInputs);
			const generationStructuralGuardMs = measurePerGeneration(preparedInputs, (inputs) =>
				validatePreparedWallMeshInputs(inputs)
			);
			const comparisonOnlyMs = measurePerGeneration(preparedInputs, (inputs) =>
				compareGenerationInputs(
					inputs,
					true,
					referenceInputs,
					referencePrepared
				)
			);
			const comparison = compareGenerationInputs(
				preparedInputs[WARMUP]!,
				validatePreparedWallMeshInputs(preparedInputs[WARMUP]!),
				referenceInputs,
				referencePrepared
			);
			const representative = getPreparedWallMeshes(reuseGenerations[WARMUP]!);
			if (!representative) throw new Error(`${fixtureId} ${actionClass} integrated prep was not cached`);

			const savedWallIds = new Set(comparison.reusedWallIds);
			const buildsSkippedMs = measureRepeated(() => {
				let indices = 0;
				for (const wallId of savedWallIds) {
					const input = referenceInputs.get(wallId)!;
					const result = buildStandaloneWallMesh(input.wall, input.floorElevation, input.ends);
					if (!result.mesh) throw new Error(`reference build failed for ${wallId}`);
					indices += result.mesh.indices.length;
				}
				return indices;
			});

			return {
				fixtureId,
				actionClass,
				accepted: true,
				walls: referenceInputs.size,
				freshCompiledGenerationsPerPath: SAMPLE_GENERATIONS,
				reusedWallMeshes: representative.stats.reused,
				builtWallMeshes: representative.stats.built,
				refusedByReason: representative.stats.refusedByReason,
				fullPreparationMs,
				integratedPreparationMs,
				netBenefitMs,
				structuralGuardOnlyMs: generationStructuralGuardMs,
				comparisonOnlyMs,
				buildsSkippedMs,
				comparisonReusedWallCount: comparison.reusedWallIds.length
			};
		});
	})
};

console.log(JSON.stringify(report, null, 2));
