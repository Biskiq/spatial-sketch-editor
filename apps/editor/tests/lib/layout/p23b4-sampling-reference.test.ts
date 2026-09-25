import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	extractBoundaryCandidateFaces,
	validateWallFirstOpeningSet,
	validateWallFirstTopology,
	wallCenterlineSamples,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import {
	buildP23BCorrectnessFixture,
	buildP23BMatrixFixture,
	P23B_CORRECTNESS_SPECS,
	P23B_MATRIX_SPECS,
	P23B_OWNER_LAYOUT
} from '$lib/bench/p23b-fixtures';
import { p2311Fixture, P2311_FIXTURES } from '$lib/bench/p2311-bend-fixtures';

/**
 * P23B.4 S1 — freeze the per-consumer sampling reference (tests only, no production change).
 *
 * This records what each consumer derives TODAY through the single sampler seam
 * (`wallCenterlineSamples`, per wall, per traversal, with canonically resolved endpoints)
 * on the committed fixtures, as committed expectations. Green by construction: it asserts
 * today's code against itself. From S2 on it fails loudly if any change moves a consumer's
 * samples — the divergence alarm the slice depends on. The OR-1/OR-2 shared-derivation
 * COMPARISON is added by the step that introduces the shared derivation, in its own commit.
 *
 * Guarantee under test (plan §4 M-1, corrected): one derivation per distinct
 * (centerline identity + traversal + resolved-endpoint) key within the acceptance-chain
 * context. Pre/post may legitimately require different derivations (different inputs).
 */

type Traversal = 'forward' | 'reverse';

function sha16(value: string): string {
	return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function summarize(document: LayoutDocumentWallFirst, traversal: Traversal) {
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
	let walls = 0;
	let points = 0;
	let lengthSum = 0;
	const parts: string[] = [];
	const sorted = [...document.walls].sort((a, b) => (a.id < b.id ? -1 : 1));
	for (const wall of sorted) {
		const start = junctionById.get(wall.startJunctionId);
		const end = junctionById.get(wall.endJunctionId);
		if (!start || !end) {
			parts.push(`${wall.id}:unresolved`);
			continue;
		}
		const sampled = wallCenterlineSamples(wall, start, end, traversal);
		if (!sampled) {
			parts.push(`${wall.id}:undefined`);
			continue;
		}
		walls += 1;
		points += sampled.samples.length;
		lengthSum += sampled.length;
		const coords = sampled.samples
			.map((sample) => `${sample.point[0].toFixed(6)},${sample.point[1].toFixed(6)}`)
			.join(';');
		parts.push(`${wall.id}:${sampled.samples.length}:${sampled.length.toFixed(6)}:${sha16(coords)}`);
	}
	return {
		walls,
		points,
		lengthSum: Number(lengthSum.toFixed(6)),
		checksum: sha16(parts.join('|'))
	};
}

type FixtureEntry = { id: string; document: LayoutDocumentWallFirst };

function s1Fixtures(): FixtureEntry[] {
	const entries: FixtureEntry[] = [];
	for (const spec of P23B_MATRIX_SPECS) entries.push({ id: spec.id, document: buildP23BMatrixFixture(spec) });
	entries.push({ id: 'owner-40-curved-v1', document: P23B_OWNER_LAYOUT });
	// Opening-bearing fixtures: the all-curved matrix cells carry 0 Openings and cannot
	// exercise the Opening-set consumer (`layout-opening-set.ts:84`).
	for (const spec of P2311_FIXTURES.filter((candidate) => candidate.openings > 0)) {
		entries.push({ id: spec.id, document: p2311Fixture(spec) });
	}
	// Correctness cases: N-2/N-2i pin the shipped crossing validator; the class-4 and D12
	// cases pin invalid-baseline and coincidence behaviour the later oracles compare against.
	for (const spec of P23B_CORRECTNESS_SPECS) {
		entries.push({ id: spec.id, document: buildP23BCorrectnessFixture(spec) });
	}
	return entries;
}

// Committed expectations, recorded 2026-09-25 from today's code (see S1 probe run).
// Any change to these values means a consumer's samples moved.
const SAMPLER_REFERENCE: Record<string, { forward: string; reverse: string }> = {
	'p23b-12-wall-straight-v1': {
		forward: 'walls=12 points=540 lengthSum=132 checksum=b373a680c8fbf994',
		reverse: 'walls=12 points=540 lengthSum=132 checksum=00c19885accf0723'
	},
	'p23b-12-wall-target-curved-v1': {
		forward: 'walls=12 points=556 lengthSum=132.023111 checksum=f08acf9bfc3094b5',
		reverse: 'walls=12 points=556 lengthSum=132.023111 checksum=aecbb5d9a72df6b8'
	},
	'p23b-12-wall-all-curved-v1': {
		forward: 'walls=12 points=780 lengthSum=132.304972 checksum=e769b582c637a733',
		reverse: 'walls=12 points=780 lengthSum=132.304972 checksum=a8cdc4cbe3407a54'
	},
	'p23b-40-wall-straight-v1': {
		forward: 'walls=40 points=1800 lengthSum=440 checksum=496974b8a1e741a1',
		reverse: 'walls=40 points=1800 lengthSum=440 checksum=abbb69edebab5e31'
	},
	'p23b-40-wall-target-curved-v1': {
		forward: 'walls=40 points=1816 lengthSum=440.023111 checksum=b923afd05be9e7fc',
		reverse: 'walls=40 points=1816 lengthSum=440.023111 checksum=8aba49a7d643d867'
	},
	'p23b-40-wall-all-curved-v1': {
		forward: 'walls=40 points=2600 lengthSum=441.016573 checksum=9f76ccb325a4ca47',
		reverse: 'walls=40 points=2600 lengthSum=441.016573 checksum=0e5b99f40d54b687'
	},
	'owner-40-curved-v1': {
		forward: 'walls=40 points=1472 lengthSum=245.173295 checksum=e09faf8ef4a06580',
		reverse: 'walls=40 points=1472 lengthSum=245.173295 checksum=53be9df644993394'
	},
	'bend-10-wall-openings': {
		forward: 'walls=10 points=490 lengthSum=120 checksum=79535d4864d95702',
		reverse: 'walls=10 points=490 lengthSum=120 checksum=a316eb223bb72fdb'
	},
	'bend-3-room-openings': {
		forward: 'walls=12 points=540 lengthSum=132 checksum=e122b70070f20203',
		reverse: 'walls=12 points=540 lengthSum=132 checksum=69fdadd66b6aebba'
	},
	'd12-exact-coincidence-v1': {
		forward: 'walls=8 points=168 lengthSum=40 checksum=c6bc6876f17f1063',
		reverse: 'walls=8 points=168 lengthSum=40 checksum=61fe9c5c325bfd96'
	},
	'd12-partial-overlap-v1': {
		forward: 'walls=8 points=168 lengthSum=40 checksum=9b56f761a3b05e0a',
		reverse: 'walls=8 points=168 lengthSum=40 checksum=41a7b0d11a77d23a'
	},
	'd12-full-containment-v1': {
		forward: 'walls=8 points=136 lengthSum=32 checksum=44d6495adcd59812',
		reverse: 'walls=8 points=136 lengthSum=32 checksum=8c1b87cbc5793507'
	},
	'N-2': {
		forward: 'walls=2 points=144 lengthSum=26.236687 checksum=98bc4798147eb7a7',
		reverse: 'walls=2 points=144 lengthSum=26.236687 checksum=5c0435b2f976e9f7'
	},
	'N-2i': {
		forward: 'walls=2 points=107 lengthSum=19.327371 checksum=51f422c818dc49c4',
		reverse: 'walls=2 points=107 lengthSum=19.327371 checksum=dfaa88ef882aa594'
	},
	'class4-self-intersection-v1': {
		forward: 'walls=1 points=54 lengthSum=9 checksum=5c763eaa93338d76',
		reverse: 'walls=1 points=54 lengthSum=9 checksum=ca3f761f1e234dac'
	},
	'class4-zero-length-wall-v1': {
		forward: 'walls=1 points=2 lengthSum=0 checksum=14e82a1d6bf6608b',
		reverse: 'walls=1 points=2 lengthSum=0 checksum=14e82a1d6bf6608b'
	},
	'class4-open-room-boundary-v1': {
		forward: 'walls=3 points=67 lengthSum=16 checksum=ab930815fea8483c',
		reverse: 'walls=3 points=67 lengthSum=16 checksum=7483eead4b93dcfe'
	},
	'class4-component-duplicate-junction-v1': {
		forward: 'walls=5 points=109 lengthSum=26 checksum=ad184881e97e2d87',
		reverse: 'walls=5 points=109 lengthSum=26 checksum=9cac021cfb4a1451'
	}
};

// Per-consumer behaviour today on the same fixtures: topology verdict, face-extraction face
// count, Opening-set issue count, compile issue count. Covers the topology pre/post gates,
// face extraction (`layout-face-extraction.ts:181`, both traversals via half-edge direction),
// the Opening set (`layout-opening-set.ts:84`, exercised by the bend opening fixtures) and
// the compile path (arc-length `:260`, physical Walls `:367`, room validation).
const CONSUMER_REFERENCE: Record<string, string> = {
	'p23b-12-wall-straight-v1': 'topology=admitted faces=3 openings=0 compileIssues=0',
	'p23b-12-wall-target-curved-v1': 'topology=admitted faces=3 openings=0 compileIssues=0',
	'p23b-12-wall-all-curved-v1': 'topology=admitted faces=3 openings=0 compileIssues=0',
	'p23b-40-wall-straight-v1': 'topology=admitted faces=10 openings=0 compileIssues=0',
	'p23b-40-wall-target-curved-v1': 'topology=admitted faces=10 openings=0 compileIssues=0',
	'p23b-40-wall-all-curved-v1': 'topology=admitted faces=10 openings=0 compileIssues=0',
	'owner-40-curved-v1': 'topology=admitted faces=10 openings=0 compileIssues=0',
	'bend-10-wall-openings': 'topology=admitted faces=0 openings=0 compileIssues=0',
	'bend-3-room-openings': 'topology=admitted faces=3 openings=0 compileIssues=0',
	'd12-exact-coincidence-v1': 'topology=admitted faces=2 openings=0 compileIssues=0',
	'd12-partial-overlap-v1': 'topology=admitted faces=2 openings=0 compileIssues=0',
	'd12-full-containment-v1': 'topology=admitted faces=2 openings=0 compileIssues=0',
	'N-2': 'topology=admitted faces=0 openings=0 compileIssues=0',
	'N-2i': 'topology=unsupported_wall_topology faces=0 openings=0 compileIssues=0',
	'class4-self-intersection-v1': 'topology=unsupported_wall_topology faces=0 openings=0 compileIssues=1',
	'class4-zero-length-wall-v1': 'topology=duplicate_junction_point faces=0 openings=0 compileIssues=0',
	'class4-open-room-boundary-v1': 'topology=unsupported_wall_topology faces=0 openings=0 compileIssues=1',
	'class4-component-duplicate-junction-v1': 'topology=duplicate_junction_point faces=1 openings=0 compileIssues=2'
};

function format(summary: { walls: number; points: number; lengthSum: number; checksum: string }): string {
	return `walls=${summary.walls} points=${summary.points} lengthSum=${summary.lengthSum} checksum=${summary.checksum}`;
}

describe('P23B.4 S1 — per-consumer sampling reference', () => {
	it('freezes the sampler seam per wall, per traversal, with canonical endpoints', () => {
		for (const { id, document } of s1Fixtures()) {
			const expected = SAMPLER_REFERENCE[id];
			expect(expected, `missing sampler reference for ${id}`).toBeDefined();
			expect(format(summarize(document, 'forward')), `${id} forward`).toBe(expected!.forward);
			expect(format(summarize(document, 'reverse')), `${id} reverse`).toBe(expected!.reverse);
		}
	});

	it('freezes per-consumer behaviour on the same fixtures', () => {
		for (const { id, document } of s1Fixtures()) {
			const expected = CONSUMER_REFERENCE[id];
			expect(expected, `missing consumer reference for ${id}`).toBeDefined();
			const topology = validateWallFirstTopology(document);
			const faces = extractBoundaryCandidateFaces(document);
			const openings = validateWallFirstOpeningSet(document);
			const compiled = compileWallFirstLayoutGeometry(document);
			const actual =
				`topology=${topology === undefined ? 'admitted' : topology.code} ` +
				`faces=${faces.faces.length} openings=${openings.length} ` +
				`compileIssues=${compiled.issues.length}`;
			expect(actual, `${id} consumers`).toBe(expected);
		}
	});
});
