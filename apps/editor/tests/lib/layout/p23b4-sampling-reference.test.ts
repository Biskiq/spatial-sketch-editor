import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	extractBoundaryCandidateFaces,
	sampleSegment,
	validateWallFirstOpeningSet,
	validateWallFirstTopology,
	wallCenterlineSamples,
	wallCenterlineSegment,
	wallFirstWallSpan,
	type LayoutDocumentWallFirst,
	type LayoutWall
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
 * For each committed fixture, this records what each consumer derives TODAY, per call site
 * and per traversal, as committed expectations:
 *
 * - topology gate (`layout-wall-first-precision.ts:2054`): forward, canonical endpoints,
 *   curved Walls (straight Walls take the chord path, which carries no samples).
 * - face extraction (`layout-face-extraction.ts:181`): per half-edge direction — the consumer
 *   builds BOTH half-edges per boundary Wall, so forward and reverse are frozen separately
 *   over curved boundary Walls; plus the extracted face polygons, which embed the sampled
 *   interior points at full precision.
 * - Opening set (`layout-opening-set.ts:84`): per-Wall spans through the consumer's own
 *   `wallFirstWallSpan`, at full precision (the bend fixtures carry Openings; the all-curved
 *   matrix cells carry 0 and cannot exercise this consumer).
 * - compile arc length (`layout-geometry.ts:260`): canonical-forward lengths.
 * - compile physical Walls (`layout-geometry.ts:367`): `sampleSegment(wallCenterlineSegment(
 *   …, 'forward'))` — the segment+kernel path rather than the seam wrapper.
 * - compile room validation (via `layout-geometry.ts:933` → `prepareLayoutRoomSegments`):
 *   per Room boundary ref, under that ref's own traversal authority.
 * - compiled geometry hash: the end-to-end consumer output that must stay byte-identical
 *   (INV-1), so a sampling change that preserved issue counts would still fail here.
 *
 * Fidelity: every sample contributes ALL FIVE `CurveSample` fields (point, distance,
 * tangent, normal, t) at FULL precision — no rounding. Checksums are SHA-256 over the
 * exact JSON encoding, so ANY numerical change in any field fails. Counts alone or
 * rounded fingerprints would be near-equality; this reference is exact-equality at the
 * hash level, and S2+ prove element-wise array equality (OR-1/OR-2) against it.
 *
 * Green by construction: it asserts today's code against itself. From here on it fails
 * loudly if any change moves a consumer's samples — the divergence alarm the slice needs.
 * The OR-1/OR-2 shared-derivation COMPARISON is added by the step that introduces the
 * shared derivation, in its own commit.
 *
 * Guarantee under test (plan §4 M-1, corrected): one derivation per distinct
 * (centerline identity + traversal + resolved-endpoint) key within the acceptance-chain
 * context. Pre/post may legitimately require different derivations (different inputs).
 */

type Traversal = 'forward' | 'reverse';

function sha(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function encSample(sample: {
	point: readonly number[];
	distance: number;
	tangent: readonly number[];
	normal: readonly number[];
	t: number;
}): string {
	return JSON.stringify({ p: sample.point, d: sample.distance, tan: sample.tangent, nor: sample.normal, u: sample.t });
}

type FixtureEntry = { id: string; document: LayoutDocumentWallFirst };

function s1Fixtures(): FixtureEntry[] {
	const entries: FixtureEntry[] = [];
	for (const spec of P23B_MATRIX_SPECS) entries.push({ id: spec.id, document: buildP23BMatrixFixture(spec) });
	entries.push({ id: 'owner-40-curved-v1', document: P23B_OWNER_LAYOUT });
	for (const spec of P2311_FIXTURES.filter((candidate) => candidate.openings > 0)) {
		entries.push({ id: spec.id, document: p2311Fixture(spec) });
	}
	for (const spec of P23B_CORRECTNESS_SPECS) {
		entries.push({ id: spec.id, document: buildP23BCorrectnessFixture(spec) });
	}
	return entries;
}

function junctionMaps(document: LayoutDocumentWallFirst) {
	return {
		points: new Map(document.junctions.map((junction) => [junction.id, junction.point])),
		walls: new Map(document.walls.map((wall) => [wall.id, wall]))
	};
}

function sortedWalls(document: LayoutDocumentWallFirst): LayoutWall[] {
	return [...document.walls].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Seam table: wallCenterlineSamples per wall with canonical endpoints, exact full samples. */
function seamTable(document: LayoutDocumentWallFirst, filter: (wall: LayoutWall) => boolean, traversal: Traversal): string {
	const { points } = junctionMaps(document);
	const parts: string[] = [];
	let count = 0;
	for (const wall of sortedWalls(document)) {
		if (!filter(wall)) continue;
		const start = points.get(wall.startJunctionId);
		const end = points.get(wall.endJunctionId);
		if (!start || !end) {
			parts.push(`${wall.id}:unresolved`);
			continue;
		}
		const sampled = wallCenterlineSamples(wall, start, end, traversal);
		if (!sampled) {
			parts.push(`${wall.id}:undefined`);
			continue;
		}
		count += sampled.samples.length;
		parts.push(`${wall.id}:${sampled.samples.length}:${String(sampled.length)}:${sha(sampled.samples.map(encSample).join('|'))}`);
	}
	return `walls=${parts.length} points=${count} checksum=${sha(parts.join('~'))}`;
}

/** Compile-physical path (:367): segment + kernel directly, exact full samples. */
function compilePhysicalTable(document: LayoutDocumentWallFirst): string {
	const { points } = junctionMaps(document);
	const parts: string[] = [];
	let count = 0;
	for (const wall of sortedWalls(document)) {
		const start = points.get(wall.startJunctionId);
		const end = points.get(wall.endJunctionId);
		if (!start || !end) {
			parts.push(`${wall.id}:unresolved`);
			continue;
		}
		try {
			const sampled = sampleSegment(wallCenterlineSegment(wall, start, end, 'forward'));
			count += sampled.samples.length;
			parts.push(`${wall.id}:${sampled.samples.length}:${String(sampled.length)}:${sha(sampled.samples.map(encSample).join('|'))}`);
		} catch {
			parts.push(`${wall.id}:throw`);
		}
	}
	return `walls=${parts.length} points=${count} checksum=${sha(parts.join('~'))}`;
}

/** Compile-validation path: per Room boundary ref under its own traversal authority. */
function compileValidationTable(document: LayoutDocumentWallFirst): string {
	const { points, walls } = junctionMaps(document);
	const parts: string[] = [];
	for (const room of document.rooms) {
		for (const ref of room.boundary) {
			const wall = walls.get(ref.wallId);
			const start = wall ? points.get(wall.startJunctionId) : undefined;
			const end = wall ? points.get(wall.endJunctionId) : undefined;
			if (!wall || !start || !end) {
				parts.push(`${room.id}:${ref.wallId}:${ref.direction}:unresolved`);
				continue;
			}
			try {
				const sampled = sampleSegment(
					wallCenterlineSegment(wall, start, end, ref.direction === 'reverse' ? 'reverse' : 'forward')
				);
				parts.push(`${room.id}:${ref.wallId}:${ref.direction}:${sampled.samples.length}:${String(sampled.length)}:${sha(sampled.samples.map(encSample).join('|'))}`);
			} catch {
				parts.push(`${room.id}:${ref.wallId}:${ref.direction}:throw`);
			}
		}
	}
	return `refs=${parts.length} checksum=${sha(parts.join('~'))}`;
}

/** Opening-set consumer: per-Wall spans through the consumer's own function, exact lengths. */
function openingSpanTable(document: LayoutDocumentWallFirst): string {
	const parts: string[] = [];
	for (const wall of sortedWalls(document)) {
		const span = wallFirstWallSpan(document, wall);
		parts.push(span ? `${wall.id}:${String(span.length)}` : `${wall.id}:undefined`);
	}
	return `walls=${parts.length} checksum=${sha(parts.join('~'))}`;
}

function faceTable(document: LayoutDocumentWallFirst): string {
	const result = extractBoundaryCandidateFaces(document);
	const sorted = [...result.faces].sort((a, b) => (a.key < b.key ? -1 : 1));
	const parts = sorted.map(
		(face) =>
			`${face.key}|${face.boundary.map((ref) => `${ref.wallId}:${ref.direction}`).join(',')}|${JSON.stringify(face.polygon)}|${String(face.signedArea)}`
	);
	return `faces=${sorted.length} checksum=${sha(parts.join('~'))} diagnostics=${JSON.stringify(result.diagnostics.map((diagnostic) => diagnostic.code))} dangling=${JSON.stringify([...result.danglingWallIds].sort())} cut=${JSON.stringify([...result.cutEdgeWallIds].sort())}`;
}

function verdictLine(document: LayoutDocumentWallFirst): string {
	const topology = validateWallFirstTopology(document);
	const openings = validateWallFirstOpeningSet(document);
	const compiled = compileWallFirstLayoutGeometry(document);
	return `topology=${topology === undefined ? 'admitted' : topology.code} openingIssues=${JSON.stringify(openings.map((issue) => issue.code ?? 'issue'))} compileIssues=${JSON.stringify(compiled.issues.map((issue) => issue.code))} compiled=${sha(JSON.stringify(compiled.geometry))}`;
}

const isCurved = (wall: LayoutWall): boolean => wall.centerline.kind !== 'line';
const isCurvedBoundary = (wall: LayoutWall): boolean => wall.centerline.kind !== 'line' && wall.role === 'boundary';
const allWalls = (): boolean => true;

// Committed expectations, recorded from today's code at full precision (no rounding;
// all five CurveSample fields contribute to every checksum).
const REFERENCE: Record<string, { seamForward: string; seamReverse: string; topologyCurved: string; faceForward: string; faceReverse: string; compilePhysical: string; compileValidation: string; openingSpans: string; faces: string; verdicts: string }> = {
	'p23b-12-wall-straight-v1': {
		seamForward: 'walls=12 points=540 checksum=1c0d431940d1394a00f3287749898880904598a0eafef5d2ef9ace0196462e14',
		seamReverse: 'walls=12 points=540 checksum=0564e3c7c34102512e37e781317ae00fb481599bfc2b1521f1dadd558cad6184',
		topologyCurved: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceForward: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceReverse: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		compilePhysical: 'walls=12 points=540 checksum=1c0d431940d1394a00f3287749898880904598a0eafef5d2ef9ace0196462e14',
		compileValidation: 'refs=12 checksum=993c9bdf241500caa2f4209446f7c7fe7bc3e7802a33d8f4162927b5ac4dd8ca',
		openingSpans: 'walls=12 checksum=963b59ff64c86d875c44426967e9529bdf5906bff9496d44b72f52e5686064f6',
		faces: 'faces=3 checksum=1b3edc5c45ba003be19c984919dd86c8a68fe169a89326af4c219121f620cdfe diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=admitted openingIssues=[] compileIssues=[] compiled=d3161b6e1b8fea5bf483a4c9423f8124cb4d94161afa1eb0e0ef095881425141'
	},
	'p23b-12-wall-target-curved-v1': {
		seamForward: 'walls=12 points=556 checksum=d6b6657a4d8cf381207d1351658fe2dcb4da42f4570f0485472e17883313f6c3',
		seamReverse: 'walls=12 points=556 checksum=3c37d4cbed146b9ad7061eb01cbca8fd403e49d745a1e007274837858e613c6d',
		topologyCurved: 'walls=1 points=65 checksum=32072d2191a6c7525798b1f3c9669dd0363458dd373d4bca5fd2eeedd880c1c4',
		faceForward: 'walls=1 points=65 checksum=32072d2191a6c7525798b1f3c9669dd0363458dd373d4bca5fd2eeedd880c1c4',
		faceReverse: 'walls=1 points=65 checksum=30f3340576f86c08d5c98b73d0bdd327d4bc9a76b9494c6414b91436eb356631',
		compilePhysical: 'walls=12 points=556 checksum=d6b6657a4d8cf381207d1351658fe2dcb4da42f4570f0485472e17883313f6c3',
		compileValidation: 'refs=12 checksum=c3d35c3e7c4171d8e6cc529ce0679614916ebfb61791d7121d888af7f6bf5ba0',
		openingSpans: 'walls=12 checksum=042fd9c75d547557561ba886784bb13db6d0c9846e4e09e4e2ab85c7e6e0874c',
		faces: 'faces=3 checksum=85930b21d420b94d87c18506d64b86c1713f76a33b629b07c09f785368700f96 diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=admitted openingIssues=[] compileIssues=[] compiled=7fd98b88210d078c910b8c3d7e6462b64372d88746979186cc99163f21126964'
	},
	'p23b-12-wall-all-curved-v1': {
		seamForward: 'walls=12 points=780 checksum=4fe3fad5ed360c1f10cf9e82a5e68c3589aaeb551daac2adfbd3eb806230a939',
		seamReverse: 'walls=12 points=780 checksum=775dde5adc3f109a24f24fe481e4e0a918eb67fbe8ae28cb1f9be0c32ff2dea2',
		topologyCurved: 'walls=12 points=780 checksum=4fe3fad5ed360c1f10cf9e82a5e68c3589aaeb551daac2adfbd3eb806230a939',
		faceForward: 'walls=12 points=780 checksum=4fe3fad5ed360c1f10cf9e82a5e68c3589aaeb551daac2adfbd3eb806230a939',
		faceReverse: 'walls=12 points=780 checksum=775dde5adc3f109a24f24fe481e4e0a918eb67fbe8ae28cb1f9be0c32ff2dea2',
		compilePhysical: 'walls=12 points=780 checksum=4fe3fad5ed360c1f10cf9e82a5e68c3589aaeb551daac2adfbd3eb806230a939',
		compileValidation: 'refs=12 checksum=c04eb82104611c49b98d57ec3e283e7d1c5cb03399a25692989e41d1b15e2645',
		openingSpans: 'walls=12 checksum=14f72c2c6dcc776111c2e51b0c98c2fc0f1fed233eff23f3a311fb926edb84f4',
		faces: 'faces=3 checksum=ec560af2848391a885ef85e1444b5ae8ced4e0f7f5490fd775e91906a91fb44f diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=admitted openingIssues=[] compileIssues=[] compiled=48f54b16499dc6f530b72e83df1c7fc3287f4ab35ab83299944de33a680eadb9'
	},
	'p23b-40-wall-straight-v1': {
		seamForward: 'walls=40 points=1800 checksum=8eadcc3ac3f9f4c41fdfb042c53334a755de3751ea9f452d00797909d947260a',
		seamReverse: 'walls=40 points=1800 checksum=912a77085b869e72c263c4d80e42b0c6f0b34e39f84b0a2f7406303404ae526d',
		topologyCurved: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceForward: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceReverse: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		compilePhysical: 'walls=40 points=1800 checksum=8eadcc3ac3f9f4c41fdfb042c53334a755de3751ea9f452d00797909d947260a',
		compileValidation: 'refs=40 checksum=f04457d3db35274c6a3dda28824ecb0fe945a4e7ad6c6f884fe032597ba36764',
		openingSpans: 'walls=40 checksum=9c143c59732fed10707cbb05a74a07accd4c8303343acebfb671c89e38919964',
		faces: 'faces=10 checksum=c41747a498a88249845cb4061f44f5b8210648dc30c7432be86216529b107002 diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=admitted openingIssues=[] compileIssues=[] compiled=3c0732e4708e749e2e2c62f5c91aaa1df95fa519ba9b4bd35f4b144b5d25a3c9'
	},
	'p23b-40-wall-target-curved-v1': {
		seamForward: 'walls=40 points=1816 checksum=41581222597d7c14ba68cafaf25f7054e53842f1f76d540846cf20fe92425e8e',
		seamReverse: 'walls=40 points=1816 checksum=180798b8c24103e01fba8fbcd0b4cfcd14a09532d0ff0819915cf78a15c39ba3',
		topologyCurved: 'walls=1 points=65 checksum=32072d2191a6c7525798b1f3c9669dd0363458dd373d4bca5fd2eeedd880c1c4',
		faceForward: 'walls=1 points=65 checksum=32072d2191a6c7525798b1f3c9669dd0363458dd373d4bca5fd2eeedd880c1c4',
		faceReverse: 'walls=1 points=65 checksum=30f3340576f86c08d5c98b73d0bdd327d4bc9a76b9494c6414b91436eb356631',
		compilePhysical: 'walls=40 points=1816 checksum=41581222597d7c14ba68cafaf25f7054e53842f1f76d540846cf20fe92425e8e',
		compileValidation: 'refs=40 checksum=6ae5169acabcadc924a23bc4deb2aa1f5a6cb6eb03f9aaab55248684728998d8',
		openingSpans: 'walls=40 checksum=610d259867977d2700fe296d90c0eb0a100cd39e7e1fd4f4361519daea6b0448',
		faces: 'faces=10 checksum=e70b50d32d6c648b6627ef70e4f6325e43f80249dc8f15f2b42a278466da3ea0 diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=admitted openingIssues=[] compileIssues=[] compiled=7eadf178f6433b0193bbbbd1d7abf150fe4f02f97e6be13140b62cff49fe09aa'
	},
	'p23b-40-wall-all-curved-v1': {
		seamForward: 'walls=40 points=2600 checksum=d1712b5b998ea924827772b2fdce3398429cbaf7438f37e8d3a6988f1b6d7481',
		seamReverse: 'walls=40 points=2600 checksum=f7537d82f15d9773b52b58cd705034d0428ea4c7dda11ed11b99fd25478948a2',
		topologyCurved: 'walls=40 points=2600 checksum=d1712b5b998ea924827772b2fdce3398429cbaf7438f37e8d3a6988f1b6d7481',
		faceForward: 'walls=40 points=2600 checksum=d1712b5b998ea924827772b2fdce3398429cbaf7438f37e8d3a6988f1b6d7481',
		faceReverse: 'walls=40 points=2600 checksum=f7537d82f15d9773b52b58cd705034d0428ea4c7dda11ed11b99fd25478948a2',
		compilePhysical: 'walls=40 points=2600 checksum=d1712b5b998ea924827772b2fdce3398429cbaf7438f37e8d3a6988f1b6d7481',
		compileValidation: 'refs=40 checksum=7c223ea6567c9de04a02c7f97fbabbcb57e7e7e2d5098667dc05c88c361fbf88',
		openingSpans: 'walls=40 checksum=3517e5aa187f7e2be5bce200b4564770e2e478838b6a62841492118b0ee62fb8',
		faces: 'faces=10 checksum=5941119a2f226a9da4286abf778b9597866659e08e31f21ce8a55c508daa1140 diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=admitted openingIssues=[] compileIssues=[] compiled=f9f00f911ca65c4b947e9af522482dfaefaf77d81c1b7bbbebc75202bdf22de9'
	},
	'owner-40-curved-v1': {
		seamForward: 'walls=40 points=1472 checksum=bd510001c3e8008175d46a033ce6346b0a2d6a5c8e7567dd2823601d80bdbba3',
		seamReverse: 'walls=40 points=1472 checksum=793ec9133af4349f2c8945f6eda0282be5a7a6455b2ecdd93c8b7dfcaea19e4a',
		topologyCurved: 'walls=40 points=1472 checksum=bd510001c3e8008175d46a033ce6346b0a2d6a5c8e7567dd2823601d80bdbba3',
		faceForward: 'walls=40 points=1472 checksum=bd510001c3e8008175d46a033ce6346b0a2d6a5c8e7567dd2823601d80bdbba3',
		faceReverse: 'walls=40 points=1472 checksum=793ec9133af4349f2c8945f6eda0282be5a7a6455b2ecdd93c8b7dfcaea19e4a',
		compilePhysical: 'walls=40 points=1472 checksum=bd510001c3e8008175d46a033ce6346b0a2d6a5c8e7567dd2823601d80bdbba3',
		compileValidation: 'refs=40 checksum=66115f0571801178e22156110b86a22d510b01c97576c300ca28416221712c9c',
		openingSpans: 'walls=40 checksum=dbb18387873a4ce3455868c567273565c5d0e1c2543238939268bd0984fa929e',
		faces: 'faces=10 checksum=56fb53980df002af32bbd6514470736cf7b7057c83fb95cc654105d917553dde diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=admitted openingIssues=[] compileIssues=[] compiled=6fd383c59599e643d7e5605e2a5f66a26c47025eb80a89ce4ed880480ce4781c'
	},
	'bend-10-wall-openings': {
		seamForward: 'walls=10 points=490 checksum=8206c580f5adf2d3d3066abe1d0f30f928b8770d2402edef86aa47ac5081a9ec',
		seamReverse: 'walls=10 points=490 checksum=ce19532ff3fccc50b67f3c9ed240e1af0e65d5a41c58f26cde19760422d57703',
		topologyCurved: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceForward: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceReverse: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		compilePhysical: 'walls=10 points=490 checksum=8206c580f5adf2d3d3066abe1d0f30f928b8770d2402edef86aa47ac5081a9ec',
		compileValidation: 'refs=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		openingSpans: 'walls=10 checksum=a24dce67ca3aa695ad7930d082b52f8fed9b501e86055a922c6223b9db32d512',
		faces: 'faces=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=admitted openingIssues=[] compileIssues=[] compiled=be313ae317283aa0ce523b19ec76dacda03969c6b7b1ef5df0e84d7574e54701'
	},
	'bend-3-room-openings': {
		seamForward: 'walls=12 points=540 checksum=d0d90abd3d4f64c868525666eb8cfe7dac575cda4789f47bf4e5076a702b17e2',
		seamReverse: 'walls=12 points=540 checksum=e7bd4f702a700f48c300a1d8178bfabfdbb3fb7ea27ba06363136ef9acd4163c',
		topologyCurved: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceForward: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceReverse: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		compilePhysical: 'walls=12 points=540 checksum=d0d90abd3d4f64c868525666eb8cfe7dac575cda4789f47bf4e5076a702b17e2',
		compileValidation: 'refs=12 checksum=0382e49fb0436d4e4809cae15989a8ba28ccdd292be35593a0c3791a533fd9c9',
		openingSpans: 'walls=12 checksum=8d89fb0015d82a4536d82a2144d586ce5eb275e36339134a9ed0682536e8f2ff',
		faces: 'faces=3 checksum=c5f5f241ec57152d33933ad05020bb2d12b23706d98b456ae9bf1a056414623f diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=admitted openingIssues=[] compileIssues=[] compiled=f4ac82d63fda9968dabfbab95e12e9d2009f16b3a72a3fb6f12fa62d3ea37ddf'
	},
	'd12-exact-coincidence-v1': {
		seamForward: 'walls=8 points=168 checksum=4a86dd594371b5b8f7bb0044ec2e5f298bb66d80b90dff285e4778de4f450c85',
		seamReverse: 'walls=8 points=168 checksum=a084921e7603a51c4b7a97d350352de3b2d9a67f4d56e1e74c76bd47f35096f1',
		topologyCurved: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceForward: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceReverse: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		compilePhysical: 'walls=8 points=168 checksum=4a86dd594371b5b8f7bb0044ec2e5f298bb66d80b90dff285e4778de4f450c85',
		compileValidation: 'refs=8 checksum=f85480407721adbfc7525c31f30f00e8c77ca679d55e91d8fa056b9e220965f7',
		openingSpans: 'walls=8 checksum=eb42b3e59707927a0199cbd51ca22857ec84496d3aedba7ae686a4c2f391f0dd',
		faces: 'faces=2 checksum=44c5a810ff23bf301db4239a0e45d6d0676a47b6144c0b43621d18d49e0f5741 diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=admitted openingIssues=[] compileIssues=[] compiled=58dbec90ad562ed31ccb772ad2d0350082aaca697eaf06b282ec42021785decf'
	},
	'd12-partial-overlap-v1': {
		seamForward: 'walls=8 points=168 checksum=8aaf066e0b39713ac37c688516af3ed3f00a3d368bdb5a26526dabdf51988a28',
		seamReverse: 'walls=8 points=168 checksum=9ab8b56fa627fd8027b9c8c3549183c82dbff89b007308a255e861cc59a5ef0c',
		topologyCurved: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceForward: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceReverse: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		compilePhysical: 'walls=8 points=168 checksum=8aaf066e0b39713ac37c688516af3ed3f00a3d368bdb5a26526dabdf51988a28',
		compileValidation: 'refs=8 checksum=735e6f79651bf9faad3a3e6a4d96b353528fdeda84132ce27b19a4049e289e56',
		openingSpans: 'walls=8 checksum=eb42b3e59707927a0199cbd51ca22857ec84496d3aedba7ae686a4c2f391f0dd',
		faces: 'faces=2 checksum=6b7e6c8247f16375c41bd1347340d462182edbd3e4eb62618d724740e50ea940 diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=admitted openingIssues=[] compileIssues=[] compiled=bc57e144d5ee275eec2641dd09ad18bb6f3654c6e4890fe07d47d9535a35fb36'
	},
	'd12-full-containment-v1': {
		seamForward: 'walls=8 points=136 checksum=277a6589b966f039a200d6c116fa3d4e554e0d087249b8aa94a3541f01370400',
		seamReverse: 'walls=8 points=136 checksum=0f0d75f5cb2879a1f9a1ad82d8f06ffceb5df8628d9374c0d63a443aacf8748a',
		topologyCurved: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceForward: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceReverse: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		compilePhysical: 'walls=8 points=136 checksum=277a6589b966f039a200d6c116fa3d4e554e0d087249b8aa94a3541f01370400',
		compileValidation: 'refs=8 checksum=43065b75f43d8b586cbe7f4b85463e9f5935464f97586375ac7b991f3dc70961',
		openingSpans: 'walls=8 checksum=bcb5e258435b9ba38b6f9218214f0f088d14133cf41b9b457f621a2a2dd7bd57',
		faces: 'faces=2 checksum=1967b754c08a842db3b0bb0023cdfeebb9c6484d0d6734257549259a80b6ab62 diagnostics=["nested_boundary_loop"] dangling=[] cut=[]',
		verdicts: 'topology=admitted openingIssues=[] compileIssues=[] compiled=08fb75d0f0ea43c5440f9020f77ccf4179a997d57dae063095559a2628ed1bd8'
	},
	'N-2': {
		seamForward: 'walls=2 points=144 checksum=7835b95da66b13979c486cde9e310c4bb2ca53c79cab8b53cee9fec97bfffe1d',
		seamReverse: 'walls=2 points=144 checksum=42d0f66a722c60f054f3d07bba5270e98eee02aedc2c14f1a90bf9b6d628f619',
		topologyCurved: 'walls=1 points=111 checksum=63b92b56e6a34f48c1923be7f0e1693f80e237920253851e63d4f15977b8c084',
		faceForward: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceReverse: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		compilePhysical: 'walls=2 points=144 checksum=7835b95da66b13979c486cde9e310c4bb2ca53c79cab8b53cee9fec97bfffe1d',
		compileValidation: 'refs=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		openingSpans: 'walls=2 checksum=48c0b2cb3c4ef7bea452bd78c8157e05bd9d931e9a9881189e566fd7d2fd4f84',
		faces: 'faces=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=admitted openingIssues=[] compileIssues=[] compiled=43e3b50722266aaca15d076a6ae90ef0153996b63dd0285aff19a05429e2796b'
	},
	'N-2i': {
		seamForward: 'walls=2 points=107 checksum=c2f006f2067215c669b9a6e7e6266bfe55b314b213cde91abcbaa0ba17693062',
		seamReverse: 'walls=2 points=107 checksum=748f9db2043f4aedae7e66e6cce6168d280db1a850f26a0ba933e9491e51dd46',
		topologyCurved: 'walls=1 points=82 checksum=422d7abd9aec2e7013af178e42da1a21a8f2f3ace3915b969cbad97545615db3',
		faceForward: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceReverse: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		compilePhysical: 'walls=2 points=107 checksum=c2f006f2067215c669b9a6e7e6266bfe55b314b213cde91abcbaa0ba17693062',
		compileValidation: 'refs=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		openingSpans: 'walls=2 checksum=e73b66f8519e1475a61eaae41d9fb02f1ea24ddc3506bc80387042e3ecbe72be',
		faces: 'faces=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=unsupported_wall_topology openingIssues=[] compileIssues=[] compiled=3858050d49627e4bb01d75238bb67dae183700df0df2cec7a651fd0dcb0f9e97'
	},
	'class4-self-intersection-v1': {
		seamForward: 'walls=1 points=54 checksum=33b7416071c1630b6d9f8a141804337b0a47ace4db8212a95b218c8f1796917b',
		seamReverse: 'walls=1 points=54 checksum=c29ff1c14e32b4b2c1405160780e4814f343e03f504ed208a3c9e0b258275f9a',
		topologyCurved: 'walls=1 points=54 checksum=33b7416071c1630b6d9f8a141804337b0a47ace4db8212a95b218c8f1796917b',
		faceForward: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceReverse: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		compilePhysical: 'walls=1 points=54 checksum=33b7416071c1630b6d9f8a141804337b0a47ace4db8212a95b218c8f1796917b',
		compileValidation: 'refs=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		openingSpans: 'walls=1 checksum=438b52ba0d0880b5c34d4ba67fa4dad910b36ae83a92438e61974cf72d1f5302',
		faces: 'faces=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=unsupported_wall_topology openingIssues=[] compileIssues=["wall_offset_overlap"] compiled=b4b7cbd16175101c437887c8c3398025d2a47aca3d763c8b148f17244e79a418'
	},
	'class4-zero-length-wall-v1': {
		seamForward: 'walls=1 points=2 checksum=5c6a2094b4440671be69ef20148131f54fa37d6c156e1b2d8766170bf5ed69aa',
		seamReverse: 'walls=1 points=2 checksum=5c6a2094b4440671be69ef20148131f54fa37d6c156e1b2d8766170bf5ed69aa',
		topologyCurved: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceForward: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceReverse: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		compilePhysical: 'walls=1 points=2 checksum=5c6a2094b4440671be69ef20148131f54fa37d6c156e1b2d8766170bf5ed69aa',
		compileValidation: 'refs=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		openingSpans: 'walls=1 checksum=f39b0056fc22f9d8ec4a7de094ba29a5278d6d9976c1803f3bb7d075cb67a746',
		faces: 'faces=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=duplicate_junction_point openingIssues=[] compileIssues=[] compiled=e9a681a9ac440e29f2602582c60e990ef1f6a6416ded8286f8733ce890b73fec'
	},
	'class4-open-room-boundary-v1': {
		seamForward: 'walls=3 points=67 checksum=8b7cef44c238d3e1a2b19b22ffb9d7b8545615dcf5a0bcc1e2afec1313a64006',
		seamReverse: 'walls=3 points=67 checksum=d980ac16bf4dab0531412615289c23199b77329ff9afc2d1a51abac24e304477',
		topologyCurved: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceForward: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceReverse: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		compilePhysical: 'walls=3 points=67 checksum=8b7cef44c238d3e1a2b19b22ffb9d7b8545615dcf5a0bcc1e2afec1313a64006',
		compileValidation: 'refs=3 checksum=5f531276d19c19ef0b105b00d89abd6fa6d25614974f5ca84c8a9394eb17b10c',
		openingSpans: 'walls=3 checksum=7ded74946b58d66780ef0c6b4e6f969b9f650a4b909ddefdd2f06b3e46670f0e',
		faces: 'faces=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 diagnostics=["boundary_dangle","boundary_dangle","boundary_dangle"] dangling=["wall-0","wall-1","wall-2"] cut=[]',
		verdicts: 'topology=unsupported_wall_topology openingIssues=[] compileIssues=["disconnected_boundary"] compiled=12b0381a9ff65a41814c175299695f78b11587ae918a8f58265883ff63922d54'
	},
	'class4-component-duplicate-junction-v1': {
		seamForward: 'walls=5 points=109 checksum=69594d2aa798061fd9e02e8c5bbb6ba737fd58afc0babb36a460cee0b68ec89d',
		seamReverse: 'walls=5 points=109 checksum=25e0b91844875d786fce8b49fb56ad33ff3d60cb6aed7d26b4ba1a36ab56381d',
		topologyCurved: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceForward: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		faceReverse: 'walls=0 points=0 checksum=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		compilePhysical: 'walls=5 points=109 checksum=69594d2aa798061fd9e02e8c5bbb6ba737fd58afc0babb36a460cee0b68ec89d',
		compileValidation: 'refs=4 checksum=b7e674a7d35f99c0112b75cc89cd50b143283368465a72a2de581f1f9ae1e362',
		openingSpans: 'walls=5 checksum=a2150bde71b0a821f352b6c1d39c9917229f8e1c356c527d01bcb5e20823e816',
		faces: 'faces=1 checksum=96bff554461c6d0b1b300473d0ccf9b3d68a9adce9737038a42a5fcf5452b483 diagnostics=[] dangling=[] cut=[]',
		verdicts: 'topology=duplicate_junction_point openingIssues=[] compileIssues=["junction_partition_failed","junction_seam_uncovered"] compiled=377dc4359477a241d67bccf2be6f958faf4fdc26c2a0581b251ab0766d6db961'
	}
};

describe('P23B.4 S1 — per-consumer sampling reference', () => {
	it('freezes each sampling call site per wall and traversal at full precision', () => {
		for (const { id, document } of s1Fixtures()) {
			const expected = REFERENCE[id];
			expect(expected, `missing sampler reference for ${id}`).toBeDefined();
			expect(seamTable(document, allWalls, 'forward'), `${id} seamForward`).toBe(expected!.seamForward);
			expect(seamTable(document, allWalls, 'reverse'), `${id} seamReverse`).toBe(expected!.seamReverse);
			expect(seamTable(document, isCurved, 'forward'), `${id} topologyCurved`).toBe(expected!.topologyCurved);
			expect(seamTable(document, isCurvedBoundary, 'forward'), `${id} faceForward`).toBe(expected!.faceForward);
			expect(seamTable(document, isCurvedBoundary, 'reverse'), `${id} faceReverse`).toBe(expected!.faceReverse);
			expect(compilePhysicalTable(document), `${id} compilePhysical`).toBe(expected!.compilePhysical);
			expect(compileValidationTable(document), `${id} compileValidation`).toBe(expected!.compileValidation);
			expect(openingSpanTable(document), `${id} openingSpans`).toBe(expected!.openingSpans);
		}
	});

	it('freezes consumer outputs that embed sampled data, exactly', () => {
		for (const { id, document } of s1Fixtures()) {
			const expected = REFERENCE[id];
			expect(expected, `missing consumer reference for ${id}`).toBeDefined();
			expect(faceTable(document), `${id} faces`).toBe(expected!.faces);
			expect(verdictLine(document), `${id} verdicts`).toBe(expected!.verdicts);
		}
	});
});
