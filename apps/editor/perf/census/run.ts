/**
 * Run the deterministic censuses E1–E5 (T1.P02.S06 C). Agent-run, Node only,
 * no browser: they cost none of the three owner-run benches. Every number is a
 * count over fixture data, labelled "census, not timing", and carries its
 * workload's content digest and the revision it ran on.
 *
 *   npm run perf:census --workspace @portfolio/editor
 *   npm run perf:census --workspace @portfolio/editor -- --only e1,e5 --bound 120
 *
 * `--bound` is E1's per-tier runtime bound in seconds for the sampled tiers
 * (default 600, the plan's 10 minutes on the M2). The JSON and a Markdown
 * summary land in `PERF_RESULTS_DIR` (outside Git).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { commitSha, resultsDirectory } from '../lib/report';
import { loadWorkload, workloadStatus, type LoadedWorkload, type WorkloadId } from '../lib/workloads/registry';
import { compiledEntities } from './compiled-diff';
import { H1_PREMISE_LIMIT, runE1, summarizeE1, type E1Tier } from './e1-dependency';
import { E2_PORTAL_LIMIT, runE2, type E2Result } from './e2-visibility';
import { readModelFacts, runE3, runE4, type E3Result, type E4Result } from './e3e4-assets';
import { ATTRIBUTION, COUNTER_CLASSES, e5Slopes, necessaryWorkRatios, runE5Workload, type E5Row } from './e5-sweep';

const LABEL = 'census, not timing';

function argument(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

const only = new Set((argument('--only') ?? 'e1,e2,e3,e4,e5').split(','));
const boundSeconds = Number(argument('--bound') ?? 600);

function envelopeOf(workload: LoadedWorkload): ProjectEnvelope {
	return JSON.parse(workload.canonicalJson) as ProjectEnvelope;
}

function available(id: WorkloadId): LoadedWorkload | null {
	const status = workloadStatus(id);
	if (status.kind !== 'fresh') {
		console.log(`${id}: not available (${status.reason})`);
		return null;
	}
	return loadWorkload(id);
}

function percent(value: number): string {
	return `${(value * 100).toFixed(1)} %`;
}

async function main(): Promise<void> {
	const started = Date.now();
	// A census on uncommitted changes names its base commit and says the tree was dirty.
	const dirtyTree = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
	const report: Record<string, unknown> = { label: LABEL, commit: commitSha(), dirtyTree, startedAt: new Date().toISOString(), boundSeconds };
	const markdown: string[] = [`# S06 censuses — ${LABEL}`, '', `Revision \`${String(report.commit)}\`${dirtyTree ? ' with uncommitted changes' : ''}, ${String(report.startedAt)}.`, ''];

	const museum = available('museum');
	const digests: Record<string, string> = {};

	if (only.has('e1')) {
		const tiers: E1Tier[] = [];
		for (const [id, exhaustive] of [['grid-S', true], ['grid-M', true], ['grid-L', false], ['grid-XL', false], ['museum', false]] as const) {
			const workload = available(id);
			if (workload === null) continue;
			digests[id] = workload.meta.contentDigest;
			console.log(`E1 ${id} (${exhaustive ? 'exhaustive' : `sample ≤ ${boundSeconds} s`})…`);
			tiers.push(runE1({ workload: id, contentDigest: workload.meta.contentDigest, document: envelopeOf(workload).units.layout.data, exhaustive, boundSeconds, seed: 0x5e06 }));
		}
		report.e1 = tiers.map((tier) => ({ ...tier, summary: summarizeE1(tier) }));
		markdown.push('## E1 — dependency census', '', '| Workload | Mode | Walls sampled / total | N entities | Class | Samples | Refused | k median / p90 / max | k/N median / max |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
		for (const tier of tiers) {
			for (const summary of summarizeE1(tier)) {
				markdown.push(
					`| ${tier.workload} | ${tier.mode}${tier.boundReached ? ' (bound reached)' : ''} | ${tier.wallsSampled} / ${tier.walls} | ${tier.entities} | ${summary.editClass} | ${summary.samples} | ${summary.refused} | ${summary.k.median} / ${summary.k.p90} / ${summary.k.max} | ${percent(summary.kOverN.median)} / ${percent(summary.kOverN.max)} |`
				);
			}
		}
		const museumTier = tiers.find((tier) => tier.workload === 'museum');
		if (museumTier !== undefined) {
			markdown.push('', `**H1 premise per edit class (museum, median k/N ≤ ${percent(H1_PREMISE_LIMIT)}):**`);
			for (const summary of summarizeE1(museumTier)) {
				markdown.push(`- ${summary.editClass}: median k/N ${percent(summary.kOverN.median)} → ${summary.kOverN.median > H1_PREMISE_LIMIT ? 'refuted for this class (keep the full path)' : 'premise holds'}`);
			}
		}
		markdown.push('');
	}

	if (museum !== null && only.has('e2')) {
		const e2: E2Result = runE2('museum', museum.meta.contentDigest, envelopeOf(museum));
		report.e2 = e2;
		markdown.push(
			'## E2 — visibility census (museum)',
			'',
			`${e2.poses.length} poses (Views and Stops) over ${e2.rooms} Rooms. Median visible fraction ${percent(e2.medianFraction)}, worst ${percent(e2.worstFraction)} at ${e2.worstSightline}. ${e2.medianFraction > E2_PORTAL_LIMIT ? 'Above 40 %: weakens the cell-and-portal proposal.' : 'At or below 40 %: supports the cell-and-portal proposal.'} Conservative plan traversal (overcounts, never undercounts); direct visibility only.`,
			''
		);
	}

	if (only.has('e3') || only.has('e4')) {
		const placementWorkloads = (['museum', 'sweep-H10', 'sweep-D10', 'realistic-L'] as const).map((id) => [id, available(id)] as const).filter(([, workload]) => workload !== null) as [WorkloadId, LoadedWorkload][];
		const assetIds = placementWorkloads.flatMap(([, workload]) => envelopeOf(workload).units.scene.data.entities.flatMap((entity) => (entity.kind === 'model' ? [entity.assetId] : [])));
		const models = await readModelFacts(assetIds);
		if (only.has('e3')) {
			const e3: E3Result[] = placementWorkloads.map(([id, workload]) => runE3(id, workload.meta.contentDigest, envelopeOf(workload), models));
			report.e3 = e3;
			markdown.push('## E3 — sharing census', '', '| Workload | Placements | Unique definitions | Unique triples | Placement submissions | Submissions / triple | Materials created | per placement |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
			for (const row of e3) {
				markdown.push(`| ${row.workload} | ${row.placements} | ${row.uniqueDefinitions} | ${row.uniqueTriples} | ${row.placementSubmissions} | ${row.submissionsPerUniqueTriple.toFixed(1)} | ${row.materialsCreated} | ${row.materialsPerPlacement.toFixed(2)} |`);
			}
			markdown.push('', 'Finding for T2 (owner of `cloneModelScene`): each placement clones its model’s materials; geometry is shared by the SkeletonUtils clone.', '');
		}
		if (museum !== null && only.has('e4')) {
			const e4: E4Result = runE4('museum', museum.meta.contentDigest, envelopeOf(museum), models);
			report.e4 = e4;
			markdown.push(
				'## E4 — residency census (museum)',
				'',
				`Per Stop (E2-visible Rooms plus the next Stop's): texture bytes at RGBA8 + mips median ${e4.medianGpuRgba8MipMiB.toFixed(1)} MiB, max ${e4.maxGpuRgba8MipMiB.toFixed(1)} MiB against the 384 MiB laptop-A row (texture bytes only, never total GPU memory).`,
				'',
				'| Stop | Rooms | Textures | Stored MiB | RGBA8+mips MiB | 1 B/px MiB | 0.5 B/px MiB | Geometry MiB |',
				'| --- | --- | --- | --- | --- | --- | --- | --- |'
			);
			const mib = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
			for (const stop of e4.stops) {
				markdown.push(`| ${stop.stopId} | ${stop.rooms} | ${stop.uniqueTextures} | ${mib(stop.storedTextureBytes)} | ${mib(stop.gpuRgba8MipBytes)} | ${mib(stop.gpu1BppMipBytes)} | ${mib(stop.gpuHalfBppMipBytes)} | ${mib(stop.geometryBytes)} |`);
			}
			markdown.push('');
		}
	}

	if (museum !== null && only.has('e5')) {
		const baseDocument = envelopeOf(museum).units.layout.data;
		const baseEntityKeys = new Set(compiledEntities(compileWallFirstLayoutGeometry(baseDocument).geometry).keys());
		const baseEntityCount = baseDocument.walls.length + baseDocument.junctions.length + baseDocument.openings.length + baseDocument.rooms.length;
		const rows: E5Row[] = [];
		for (const [id, factor, variant] of [['museum', 1, 'base'], ['sweep-H3', 3, 'H'], ['sweep-H10', 10, 'H'], ['sweep-D3', 3, 'D'], ['sweep-D10', 10, 'D']] as const) {
			const workload = available(id);
			if (workload === null) continue;
			digests[id] = workload.meta.contentDigest;
			console.log(`E5 ${id}…`);
			rows.push(...(await runE5Workload({ workload, factor, variant, baseEntityKeys, baseEntityCount })));
		}
		const slopes = e5Slopes(rows);
		const ratios = necessaryWorkRatios(rows);
		report.e5 = { rows, slopes, necessaryWorkRatios: ratios, factorsBuilt: [1, 3, 10], x30: 'not built: generation exceeds the stated bound (≈ quadratic, ≈ 2 h measured extrapolation); slopes above ×10 are arithmetic only' };
		const independence = rows.filter((row) => row.changedSet !== undefined && row.changedSet.addedInChangedSet > 0);
		markdown.push(
			'## E5 — irrelevance sweep (Node counters)',
			'',
			`Semantic independence: ${independence.length === 0 ? 'every fixed edit’s changed set contains no added entity at every factor (holds)' : `**violated** in ${independence.length} row(s)`}.`,
			'',
			'Slope = counter growth per added entity between ×1 and the largest built factor, worst over the three edit classes; ✓ within its I1 bound, ✗ above it (attribution, not refutation).',
			''
		);
		const phases = ['move', 'commit', 'undo', 'redo'] as const;
		for (const variant of ['H', 'D'] as const) {
			const ofVariant = slopes.filter((slope) => slope.variant === variant);
			if (ofVariant.length === 0) continue;
			const added = Math.max(...ofVariant.map((slope) => slope.addedEntitiesAtTop));
			markdown.push(`**Variant ${variant}** (${added} added entities at the top factor)`, '', '| Counter | Bound | move | commit | undo | redo | Attribution when above |', '| --- | --- | --- | --- | --- | --- | --- |');
			for (const counter of Object.keys(COUNTER_CLASSES) as (keyof typeof COUNTER_CLASSES)[]) {
				const cells = phases.map((phase) => {
					const matching = ofVariant.filter((slope) => slope.counter === counter && slope.phase === phase);
					if (matching.length === 0) return '—';
					const worst = matching.reduce((a, b) => (b.slopePerAddedEntity > a.slopePerAddedEntity ? b : a));
					return `${worst.slopePerAddedEntity.toFixed(2)} ${matching.every((slope) => slope.withinBound) ? '✓' : '✗'}`;
				});
				if (cells.every((cell) => cell === '—')) continue;
				const above = ofVariant.some((slope) => slope.counter === counter && !slope.withinBound);
				markdown.push(`| ${counter} | ${COUNTER_CLASSES[counter].bound} | ${cells.join(' | ')} | ${above ? ATTRIBUTION[counter] : ''} |`);
			}
			markdown.push('');
		}
		markdown.push('', '**Necessary-work ratio R at variant H ×10 (per move; the flow share f comes from Bench 1):**', '');
		for (const ratio of ratios) markdown.push(`- ${ratio.editClass} — ${ratio.stage}: ${ratio.work.toFixed(0)} units for k = ${ratio.k} → R ≈ ${ratio.R.toFixed(1)}`);
		markdown.push('');
	}

	report.digests = digests;
	report.elapsedSeconds = (Date.now() - started) / 1000;
	const directory = resultsDirectory();
	mkdirSync(directory, { recursive: true });
	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const jsonPath = join(directory, `${stamp}-census.json`);
	const mdPath = join(directory, `${stamp}-census.md`);
	markdown.push('## Fixture digests', '', ...Object.entries(digests).map(([id, digest]) => `- ${id}: \`${digest}\``), '', `Elapsed ${Number(report.elapsedSeconds).toFixed(0)} s.`);
	writeFileSync(jsonPath, JSON.stringify(report, null, 2));
	writeFileSync(mdPath, `${markdown.join('\n')}\n`);
	console.log(`census report: ${mdPath}\n           json: ${jsonPath}`);
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
