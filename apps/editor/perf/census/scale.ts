/**
 * Scale feasibility census toward 10,000 Rooms (T1.P02.S06; the owner's D2
 * ruling, 2026-10-24). Agent-run, Node only, never inside an owner pass and
 * never admitted in a browser. "Census, not timing": the Node wall times are
 * one run on the agent's machine, a feasibility read, never a timing row.
 *
 *   npm run perf:scale --workspace @portfolio/editor              # every point
 *   npm run perf:scale --workspace @portfolio/editor -- --point 3k
 *
 * Planner construction cannot reach these sizes (it is quadratic: grid-XL's
 * 400 Rooms took 24 min). D2 grants the assembly exception instead: the
 * planner-built grid-L block (196 Rooms) is replicated with ID remapping into
 * one **connected** layout. Adjacent tiles share their boundary Junctions
 * (deduplicated by coordinate on the 6 m lattice) and Walls (deduplicated by
 * endpoint pair; Room boundary refs follow the kept Wall and flip direction
 * where its orientation differs, and the dropped duplicate's Openings go with
 * it). The assembled source then goes through the canonical path only:
 * `admitSourceJson` (envelope validation, compile, runtime, digest, freeze) and
 * one shipped per-move plan on the Wall nearest the centre.
 *
 * Each point runs in its own child process under a 10-minute bound. A point
 * that exceeds it, runs out of memory or is refused is recorded with the phase
 * it reached and is not retried.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LayoutDocumentWallFirst, LayoutVec2 } from '@portfolio/layout-core';
import { serializeProjectEnvelope, type ProjectEnvelope } from '@portfolio/project-model/units';

import { admitSourceJson } from '$lib/authoring/stage/source-admission';
import { planWallManipulation } from '$lib/authoring/adapters/layout/precision';

import { commitSha, resultsDirectory } from '../lib/report';
import { loadWorkload } from '../lib/workloads/registry';
import { fixedEdit } from './e1-dependency';
import { allPairVisits, countWork, countWorkAsync, entityEvaluations, lookupVisits, pairVisits, wholeDocumentPasses, type WorkCounts } from './work-counter';

/** Points: tiles of grid-L (14×14 Rooms of 6 m, an 84 m pitch). */
const POINTS: Readonly<Record<string, { readonly tilesX: number; readonly tilesZ: number }>> = {
	'1k': { tilesX: 2, tilesZ: 3 },
	'3k': { tilesX: 4, tilesZ: 4 },
	'10k': { tilesX: 7, tilesZ: 7 }
};
const TILE = 'grid-L' as const;
const TILE_PITCH_METERS = 84;
const POINT_BOUND_SECONDS = 600;

type Layout = LayoutDocumentWallFirst;

/** One connected layout of tilesX × tilesZ copies of the tile, sharing their boundaries. */
export function assembleConnected(tile: Layout, tilesX: number, tilesZ: number, pitch: number): Layout {
	if (!tile.walls.every((wall) => wall.centerline.kind === 'line')) throw new Error('the scale assembly expects straight Walls only');
	const junctions: Layout['junctions'][number][] = [];
	const walls: Layout['walls'][number][] = [];
	const rooms: Layout['rooms'][number][] = [];
	const openings: Layout['openings'][number][] = [];
	const junctionAtPoint = new Map<string, string>();
	const wallByEnds = new Map<string, { readonly id: string; readonly start: string }>();
	for (let tz = 0; tz < tilesZ; tz++) {
		for (let tx = 0; tx < tilesX; tx++) {
			const suffix = `.t${tx}x${tz}`;
			const junctionIds = new Map<string, string>();
			for (const junction of tile.junctions) {
				const point: LayoutVec2 = [junction.point[0] + tx * pitch, junction.point[1] + tz * pitch];
				const key = `${point[0]},${point[1]}`;
				let id = junctionAtPoint.get(key);
				if (id === undefined) {
					id = `${junction.id}${suffix}`;
					junctionAtPoint.set(key, id);
					junctions.push({ ...junction, id, point });
				}
				junctionIds.set(junction.id, id);
			}
			const wallIds = new Map<string, { readonly id: string; readonly flipped: boolean }>();
			const dropped = new Set<string>();
			for (const wall of tile.walls) {
				const start = junctionIds.get(wall.startJunctionId)!;
				const end = junctionIds.get(wall.endJunctionId)!;
				const key = start < end ? `${start}|${end}` : `${end}|${start}`;
				const existing = wallByEnds.get(key);
				if (existing !== undefined) {
					wallIds.set(wall.id, { id: existing.id, flipped: existing.start !== start });
					dropped.add(wall.id);
					continue;
				}
				const id = `${wall.id}${suffix}`;
				wallByEnds.set(key, { id, start });
				walls.push({ ...wall, id, startJunctionId: start, endJunctionId: end });
				wallIds.set(wall.id, { id, flipped: false });
			}
			for (const room of tile.rooms) {
				rooms.push({
					...room,
					id: `${room.id}${suffix}`,
					boundary: room.boundary.map((ref) => {
						const mapped = wallIds.get(ref.wallId)!;
						return { ...ref, wallId: mapped.id, direction: mapped.flipped ? (ref.direction === 'forward' ? 'reverse' : 'forward') : ref.direction };
					})
				});
			}
			for (const opening of tile.openings) {
				if (dropped.has(opening.wallId)) continue;
				openings.push({
					...opening,
					id: `${opening.id}${suffix}`,
					wallId: wallIds.get(opening.wallId)!.id,
					...(opening.connectsRoomIds === undefined ? {} : { connectsRoomIds: opening.connectsRoomIds.map((id) => `${id}${suffix}`) as [string, string] })
				});
			}
		}
	}
	return { ...tile, junctions, walls, rooms, openings };
}

function centreWallId(layout: Layout): string {
	const point = new Map(layout.junctions.map((junction) => [junction.id, junction.point] as const));
	const xs = layout.junctions.map((junction) => junction.point[0]);
	const zs = layout.junctions.map((junction) => junction.point[1]);
	const centre: LayoutVec2 = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
	let best = layout.walls[0]!.id;
	let bestDistance = Infinity;
	for (const wall of layout.walls) {
		const a = point.get(wall.startJunctionId)!;
		const b = point.get(wall.endJunctionId)!;
		const distance = Math.hypot((a[0] + b[0]) / 2 - centre[0], (a[1] + b[1]) / 2 - centre[1]);
		if (distance < bestDistance) {
			bestDistance = distance;
			best = wall.id;
		}
	}
	return best;
}

function derived(counts: WorkCounts): Record<string, number> {
	return {
		compiles: counts.compile ?? 0,
		entityEvaluations: entityEvaluations(counts),
		wholeDocumentPasses: wholeDocumentPasses(counts),
		pairVisitsH3: pairVisits(counts),
		allPairVisits: allPairVisits(counts),
		lookupVisits: lookupVisits(counts),
		cacheKeyChars: counts['cache-key:chars'] ?? 0,
		envelopeValidations: counts['envelope:validate'] ?? 0,
		digestBytes: counts['digest:bytes'] ?? 0,
		frozenObjects: counts['f4:freeze-object'] ?? 0
	};
}

type PointResult = {
	readonly point: string;
	readonly tiles: string;
	readonly facts: { walls: number; junctions: number; openings: number; rooms: number; sourceBytes: number };
	readonly assemblyMs: number;
	readonly admission: { outcome: string; findings: number; wallMs: number; counts: WorkCounts; derived: Record<string, number> };
	readonly perMove?: { wallId: string; outcome: string; wallMs: number; counts: WorkCounts; derived: Record<string, number> };
	readonly heapUsedAfterMiB: number;
	readonly peakRssMiB: number;
};

/** One point, in this (child) process; prints its result as one JSON line. */
async function runPoint(name: string): Promise<void> {
	const shape = POINTS[name];
	if (shape === undefined) throw new Error(`unknown point ${name}`);
	const progress = (phase: string) => console.error(`[scale ${name}] ${phase}`);
	const tile = loadWorkload(TILE);
	const envelope = JSON.parse(tile.canonicalJson) as ProjectEnvelope;
	const assemblyStarted = performance.now();
	const layout = assembleConnected(envelope.units.layout.data, shape.tilesX, shape.tilesZ, TILE_PITCH_METERS);
	const projectId = `perf-scale-${name}`;
	const assembled: ProjectEnvelope = {
		...envelope,
		id: projectId,
		name: `Perf scale ${name} (grid-L ×${shape.tilesX * shape.tilesZ}, connected)`,
		acceptedRevision: { projectId, revisionId: `${projectId}-r1` },
		units: { ...envelope.units, layout: { ...envelope.units.layout, data: layout } }
	};
	const json = serializeProjectEnvelope(assembled);
	const assemblyMs = performance.now() - assemblyStarted;
	progress(`assembled ${layout.rooms.length} Rooms, ${layout.walls.length} Walls in ${(assemblyMs / 1000).toFixed(1)} s; admitting`);
	const admissionStarted = performance.now();
	const admitted = await countWorkAsync(() => admitSourceJson(json, { sessionEpoch: 'session:perf-scale', acceptedRevision: assembled.acceptedRevision }));
	const admissionMs = performance.now() - admissionStarted;
	const findings = admitted.result.kind === 'admitted' ? admitted.result.snapshot.domain.closure.length + admitted.result.snapshot.domain.diagnostics.length : -1;
	progress(`admission ${admitted.result.kind} in ${(admissionMs / 1000).toFixed(1)} s; per-move plan`);
	let perMove: PointResult['perMove'];
	if (admitted.result.kind === 'admitted') {
		const wallId = centreWallId(layout);
		const moveStarted = performance.now();
		const plan = countWork(() => planWallManipulation(layout, wallId, fixedEdit(layout, wallId, 'length', 0), 'start'));
		perMove = { wallId, outcome: plan.result.kind, wallMs: performance.now() - moveStarted, counts: plan.counts, derived: derived(plan.counts) };
	}
	(globalThis as { gc?: () => void }).gc?.();
	const result: PointResult = {
		point: name,
		tiles: `${shape.tilesX}×${shape.tilesZ} ${TILE}`,
		facts: { walls: layout.walls.length, junctions: layout.junctions.length, openings: layout.openings.length, rooms: layout.rooms.length, sourceBytes: Buffer.byteLength(json) },
		assemblyMs,
		admission: { outcome: admitted.result.kind, findings, wallMs: admissionMs, counts: admitted.counts, derived: derived(admitted.counts) },
		...(perMove === undefined ? {} : { perMove }),
		heapUsedAfterMiB: process.memoryUsage().heapUsed / 2 ** 20,
		peakRssMiB: process.resourceUsage().maxRSS / 1024
	};
	console.log(`SCALE-RESULT ${JSON.stringify(result)}`);
}

function main(): void {
	const index = process.argv.indexOf('--one');
	if (index >= 0) {
		runPoint(process.argv[index + 1]!).catch((error: unknown) => {
			console.error(error);
			process.exit(1);
		});
		return;
	}
	const only = process.argv.indexOf('--point');
	const names = only >= 0 ? [process.argv[only + 1]!] : Object.keys(POINTS);
	const started = Date.now();
	const results: unknown[] = [];
	for (const name of names) {
		console.log(`scale ${name}…`);
		const child = spawnSync('npx', ['vite-node', 'perf/census/scale.ts', '--one', name], {
			cwd: join(dirname(fileURLToPath(import.meta.url)), '..', '..'),
			encoding: 'utf8',
			timeout: POINT_BOUND_SECONDS * 1000,
			killSignal: 'SIGKILL',
			maxBuffer: 64 * 2 ** 20,
			env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --expose-gc --max-old-space-size=12288`.trim() },
			stdio: ['ignore', 'pipe', 'pipe']
		});
		const line = child.stdout.split('\n').find((candidate) => candidate.startsWith('SCALE-RESULT '));
		const reached = child.stderr.split('\n').filter((candidate) => candidate.startsWith(`[scale ${name}]`)).pop() ?? 'started';
		if (line !== undefined) results.push(JSON.parse(line.slice('SCALE-RESULT '.length)));
		else {
			const cause = child.error?.message.includes('ETIMEDOUT') || child.signal === 'SIGKILL' ? `exceeded the ${POINT_BOUND_SECONDS} s bound` : `exit ${child.status ?? child.signal}`;
			// V8's fatal line (heap limit, invalid string length) names the wall; the stack tail does not.
			const fatal = child.stderr.split('\n').find((candidate) => /FATAL|RangeError|Error:/.test(candidate)) ?? null;
			results.push({ point: name, failed: cause, lastPhase: reached, fatal, stderrTail: child.stderr.split('\n').slice(-6).join('\n') });
		}
		console.log(`scale ${name}: ${line === undefined ? 'failed' : 'done'} (${reached})`);
	}
	const report = {
		label: 'census, not timing: Node wall times are one agent run, a feasibility read',
		ruling: 'owner D2 (2026-10-24): A.1 assembly exception, Node only',
		commit: commitSha(),
		tile: { id: TILE, digest: loadWorkload(TILE).meta.contentDigest },
		pointBoundSeconds: POINT_BOUND_SECONDS,
		results,
		elapsedSeconds: (Date.now() - started) / 1000
	};
	const directory = resultsDirectory();
	mkdirSync(directory, { recursive: true });
	const path = join(directory, `${new Date().toISOString().replace(/[:.]/g, '-')}-scale-census.json`);
	writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
	console.log(`scale census: ${path}`);
}

main();
