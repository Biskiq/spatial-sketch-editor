/**
 * Generate the S06 workload cache (T1.P02.S06 A.1, B). Setup, not measurement.
 *
 *   npm run perf:workloads --workspace @portfolio/editor            # missing or stale only
 *   npm run perf:workloads --workspace @portfolio/editor -- --force  # everything
 *   npm run perf:workloads --workspace @portfolio/editor -- grid-L museum
 *   npm run perf:workloads --workspace @portfolio/editor -- --verify   # reproducibility check
 *
 * Runs under `vite-node` with the editor config, so the real Stage admission,
 * the editor catalogue and T3's public Experience operations resolve. Each
 * workload builds in its own child process (they are independent), so the total
 * wall time is about the slowest one rather than the sum. Every envelope must
 * admit through `admitSourceJson` with zero blocking issues before it is written;
 * a refused or diagnostic workload fails the run and writes nothing.
 *
 * `--verify` rebuilds grid-M and grid-L and requires the cached digest to match.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';

import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import { serializeProjectEnvelope, type ProjectEnvelope } from '@portfolio/project-model/units';

import { admitSourceJson } from '$lib/authoring/stage/source-admission';

import { buildWorkload } from './lib/workloads/build';
import {
	contentDigestOf,
	loadWorkload,
	workloadJsonFor,
	WORKLOAD_CACHE_DIR,
	WORKLOADS,
	workloadInputKey,
	workloadPaths,
	workloadStatus,
	type WorkloadFacts,
	type WorkloadId,
	type WorkloadMeta
} from './lib/workloads/registry';

function factsOf(envelope: ProjectEnvelope, bytes: number): WorkloadFacts {
	const layout = envelope.units.layout.data;
	return {
		walls: layout.walls.length,
		junctions: layout.junctions.length,
		openings: layout.openings.length,
		rooms: layout.rooms.length,
		entities: envelope.units.scene.data.entities.length,
		views: envelope.units.camera.data.views.length,
		stops: envelope.units.experience.data.experiences.reduce((sum, experience) => sum + experience.stops.length, 0),
		bytes
	};
}

async function generateOne(id: WorkloadId): Promise<void> {
	const spec = WORKLOADS[id];
	if (spec.blocked !== undefined) throw new Error(`${id} is blocked: ${spec.blocked}`);
	const started = performance.now();
	const { envelope, focusWallId } = await buildWorkload(spec);
	const blocking = compileWallFirstLayoutGeometry(envelope.units.layout.data).issues.filter((issue) => issue.severity !== 'warning');
	if (blocking.length > 0) throw new Error(`${id} has ${blocking.length} blocking compile issues: ${blocking[0]!.message}`);
	const canonicalJson = serializeProjectEnvelope(envelope);
	const admitted = await admitSourceJson(canonicalJson, {
		sessionEpoch: 'session:perf-workload-check',
		acceptedRevision: envelope.acceptedRevision
	});
	if (admitted.kind !== 'admitted') {
		throw new Error(`${id} did not admit: ${admitted.kind} ${JSON.stringify(admitted.issues.slice(0, 3))}`);
	}
	// Admitted for reading is not enough: a closure or diagnostic finding would
	// refuse every measured edit (F4 `lock-closure`) or Save.
	const { closure, diagnostics } = admitted.snapshot.domain;
	if (closure.length > 0 || diagnostics.length > 0) {
		throw new Error(`${id} admitted with findings: ${JSON.stringify([...closure, ...diagnostics].slice(0, 3))}`);
	}
	const meta: WorkloadMeta = {
		id,
		projectId: spec.projectId,
		inputKey: workloadInputKey(spec),
		contentDigest: contentDigestOf(canonicalJson),
		facts: factsOf(envelope, Buffer.byteLength(canonicalJson)),
		...(focusWallId === undefined ? {} : { focusWallId }),
		generatedAt: new Date().toISOString(),
		generationMs: Math.round(performance.now() - started)
	};
	mkdirSync(WORKLOAD_CACHE_DIR, { recursive: true });
	const paths = workloadPaths(id);
	writeFileSync(paths.json, canonicalJson);
	writeFileSync(paths.meta, `${JSON.stringify(meta, null, 2)}\n`);
	console.log(`${id}: ${JSON.stringify(meta.facts)} digest=${meta.contentDigest} in ${(meta.generationMs / 1000).toFixed(1)} s`);
}

async function verifyOne(id: WorkloadId): Promise<string> {
	const loaded = loadWorkload(id);
	const { envelope } = await buildWorkload(loaded.spec);
	const rebuilt = contentDigestOf(serializeProjectEnvelope(envelope));
	if (rebuilt !== loaded.meta.contentDigest) throw new Error(`${id} is not reproducible: cached ${loaded.meta.contentDigest}, rebuilt ${rebuilt}`);
	const projectId = `perf-verify-${id.toLowerCase()}`;
	const rewritten = workloadJsonFor(loaded, projectId);
	const parsed = JSON.parse(rewritten) as ProjectEnvelope;
	const admitted = await admitSourceJson(rewritten, { sessionEpoch: 'session:perf-workload-verify', acceptedRevision: parsed.acceptedRevision });
	if (admitted.kind !== 'admitted' || parsed.id !== projectId || parsed.acceptedRevision.projectId !== projectId) {
		throw new Error(`${id}: the id-rewritten copy did not admit under ${projectId}`);
	}
	if (admitted.snapshot.domain.closure.length > 0 || admitted.snapshot.domain.diagnostics.length > 0) {
		throw new Error(`${id}: the id-rewritten copy admitted with findings`);
	}
	return rebuilt;
}

function runChild(id: WorkloadId): Promise<void> {
	return new Promise((resolvePromise, reject) => {
		const child = spawn('npx', ['vite-node', 'perf/generate-workloads.ts', '--one', id], { stdio: 'inherit', env: process.env });
		child.on('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error(`${id} generation exited ${code}`))));
	});
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const one = args.indexOf('--one');
	if (one >= 0) {
		await generateOne(args[one + 1] as WorkloadId);
		return;
	}
	if (args.includes('--verify')) {
		const named = args.filter((arg) => !arg.startsWith('--')) as WorkloadId[];
		for (const id of named.length > 0 ? named : (['grid-M', 'grid-L'] as WorkloadId[])) {
			const started = performance.now();
			console.log(`${id}: reproducible, id-rewrite admits, ${await verifyOne(id)} (${((performance.now() - started) / 1000).toFixed(1)} s)`);
		}
		return;
	}
	const force = args.includes('--force');
	const named = args.filter((arg) => !arg.startsWith('--')) as WorkloadId[];
	const ids = (named.length > 0 ? named : (Object.keys(WORKLOADS) as WorkloadId[])).filter((id) => {
		const status = workloadStatus(id);
		if (status.kind === 'blocked') {
			console.log(`${id}: skipped, ${status.reason}`);
			return false;
		}
		if (status.kind === 'fresh' && !force) {
			console.log(`${id}: fresh (${status.meta.contentDigest})`);
			return false;
		}
		return true;
	});
	const started = Date.now();
	const queue = [...ids];
	const workers = Array.from({ length: Math.max(1, Math.min(queue.length, availableParallelism() - 2)) }, async () => {
		while (queue.length > 0) await runChild(queue.shift()!);
	});
	await Promise.all(workers);
	console.log(`generated ${ids.length} workload(s) in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
