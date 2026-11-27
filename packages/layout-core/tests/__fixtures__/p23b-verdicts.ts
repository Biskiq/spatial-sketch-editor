/**
 * Test-owned verdicts for the P23B fixture set.
 *
 * These are the deterministic expectations the suite pins for every fixture the
 * builders in `./p23b-fixtures.ts` can construct: the canonical serialization
 * identity (sha256 of the canonical Layout JSON), the document shape, and the
 * shipped codec/topology/compiler verdict.
 *
 * The values were transcribed from the P23B measurement ledger document under
 * the P23B roadmap when the suite stopped reading it (plan §7.6 area 4) — the 12
 * `canonicalSha256` digests excepted, because the format-6 cutover re-shaped what
 * they hash; see the note at the end of this header — so that
 * its measurement provenance — machine, browser session, sampling, commit, date
 * and the class/role bookkeeping that belongs to a recorded measurement — is no
 * longer part of any test. WP4 may now delete that document, and no test under
 * `apps/editor/tests` reads it.
 *
 * The ledger held a 16th row, the retired `owner-40-curved-v1` owner payload. It
 * has no builder here (see `P23B_RETIRED_OWNER_FIXTURE_ID`), so it is
 * deliberately absent: it is historical identity, never a live fixture
 * expectation.
 *
 * T1.P02.S01 — FORMAT 6 DIGEST RE-DERIVATION (2026-10-22). Format 6 removed the
 * authored Wall `role`, so every fixture's canonical serialization changed shape
 * and its `canonicalSha256` no longer equals the ledger's value. Each of the 12
 * digests was re-derived at the cutover from
 * `serializeWallFirstLayoutDocument` over the format-6 fixture; the suite pins
 * that equality, so the digest is a serialization identity of the current
 * document, not an independent record of what the code decides. The deliberate
 * scope of the re-derivation: `shape`, `topology` and `compilerIssues` are still
 * the ledger's transcriptions, unchanged, and they remain the behavioural
 * expectations. A digest is expected to move with a format that changes the
 * serialized fields; a shape, topology or issue-code move is a finding.
 *
 * C2 FORMAT 7 RE-DERIVATION (2026-11-09). The closed-Wall schema bump changes
 * the serialized `formatVersion`, so every canonical digest moved. Each value
 * below was re-derived from `serializeWallFirstLayoutDocument` at format 7;
 * shape, topology and compiler issue expectations are unchanged.
 *
 * C3 FORMAT 8 RE-DERIVATION (2026-11-17). Every Room now serializes required
 * `virtualEdges` and `overhead`, so every canonical digest moved again. Each
 * value below was re-derived from `serializeWallFirstLayoutDocument` at format 8;
 * shape, topology and compiler issue expectations are unchanged.
 *
 * V2A FORMAT 11 RE-DERIVATION (2026-11-27). Every Wall now serializes the
 * required `top` profile, so every canonical digest moved again. Each value below
 * was re-derived from `serializeWallFirstLayoutDocument` at format 11; shape,
 * topology and compiler issue expectations are unchanged.
 *
 * V3A FORMAT 12 RE-DERIVATION (2026-11-27). The Region form widening changes the
 * serialized `formatVersion` (these fixtures carry no Region), so every canonical
 * digest moved again. Each value below was re-derived from
 * `serializeWallFirstLayoutDocument` at format 12; shape, topology and compiler
 * issue expectations are unchanged.
 */
import type { P23BCorrectnessCaseId } from './p23b-fixtures';

export type P23BFixtureShape = {
	rooms: number;
	walls: number;
	junctions: number;
	openings: number;
	curvedWalls: number;
	centerlineKinds: Record<string, number>;
};

export type P23BFixtureVerdict = {
	/** sha256 of the canonical `serializeWallFirstLayoutDocument` output. */
	canonicalSha256: string;
	/** Deterministic document shape of the constructed fixture. */
	shape: P23BFixtureShape;
	/** `admitted`, or the rejecting `validateWallFirstTopology` code. */
	topology: string;
	/** The ordered `compileWallFirstLayoutGeometry` issue codes. */
	compilerIssues: readonly string[];
};

/** The six CLASS 5 matrix cells, straight / target-curved / all-curved per size. */
export const P23B_MATRIX_VERDICTS: Record<string, P23BFixtureVerdict> = {
	'p23b-12-wall-straight-v1': {
		canonicalSha256: '95febd4432a6ed2f0b9ef6cf847cfbf5f7b9232c98ca2e57d95c709d876ba179',
		shape: {
			rooms: 3,
			walls: 12,
			junctions: 12,
			openings: 0,
			curvedWalls: 0,
			centerlineKinds: { line: 12 }
		},
		topology: 'admitted',
		compilerIssues: []
	},
	'p23b-12-wall-target-curved-v1': {
		canonicalSha256: '34471ec3566db951e540f5e898e95de22d2d931e7afec1ca792545ef55aca0a2',
		shape: {
			rooms: 3,
			walls: 12,
			junctions: 12,
			openings: 0,
			curvedWalls: 1,
			centerlineKinds: { 'cubic-chain': 1, line: 11 }
		},
		topology: 'admitted',
		compilerIssues: []
	},
	'p23b-12-wall-all-curved-v1': {
		canonicalSha256: '6e0668b0c44247db7ad3a62bb2f83e4a16e476af4ce523460423f6884be12b29',
		shape: {
			rooms: 3,
			walls: 12,
			junctions: 12,
			openings: 0,
			curvedWalls: 12,
			centerlineKinds: { 'cubic-chain': 12 }
		},
		topology: 'admitted',
		compilerIssues: []
	},
	'p23b-40-wall-straight-v1': {
		canonicalSha256: '07e3c96a7fc0eddf1fcdb5577c16b6f7271f411ef459419f35c5d28728567210',
		shape: {
			rooms: 10,
			walls: 40,
			junctions: 40,
			openings: 0,
			curvedWalls: 0,
			centerlineKinds: { line: 40 }
		},
		topology: 'admitted',
		compilerIssues: []
	},
	'p23b-40-wall-target-curved-v1': {
		canonicalSha256: '496fbdd3809d454ac86163f800b2dcf2c0fede44f86bba844585c27e9b78674e',
		shape: {
			rooms: 10,
			walls: 40,
			junctions: 40,
			openings: 0,
			curvedWalls: 1,
			centerlineKinds: { 'cubic-chain': 1, line: 39 }
		},
		topology: 'admitted',
		compilerIssues: []
	},
	'p23b-40-wall-all-curved-v1': {
		canonicalSha256: '5e2a200d1ba7838f28a897f188d38e9acfb404d3da8b7e00abcf809d6425487b',
		shape: {
			rooms: 10,
			walls: 40,
			junctions: 40,
			openings: 0,
			curvedWalls: 40,
			centerlineKinds: { 'cubic-chain': 40 }
		},
		topology: 'admitted',
		compilerIssues: []
	}
};

/**
 * The correctness rows: D-12 identity regressions (class 2), the admitted
 * independent-component crossing (class 3), and the refusals (class 4).
 */
export const P23B_CORRECTNESS_VERDICTS: Record<P23BCorrectnessCaseId, P23BFixtureVerdict> = {
	'd12-exact-coincidence-v1': {
		canonicalSha256: 'f6d3ae6915c903b20d738e2a2743279dc17e3b3875c8cbb418bf34cc4676a9a2',
		shape: {
			rooms: 2,
			walls: 8,
			junctions: 8,
			openings: 1,
			curvedWalls: 0,
			centerlineKinds: { line: 8 }
		},
		topology: 'admitted',
		compilerIssues: []
	},
	'd12-partial-overlap-v1': {
		canonicalSha256: '8626e198706dc3d95fabd43d9b30d11d67f43ac4d4d127f57eac276cf7f0a52d',
		shape: {
			rooms: 2,
			walls: 8,
			junctions: 8,
			openings: 1,
			curvedWalls: 0,
			centerlineKinds: { line: 8 }
		},
		topology: 'admitted',
		compilerIssues: []
	},
	'd12-full-containment-v1': {
		canonicalSha256: '4d4a497a6f61af6539de3d0d4a94c48947960a058130ba9b512b4116e6d02238',
		shape: {
			rooms: 2,
			walls: 8,
			junctions: 8,
			openings: 1,
			curvedWalls: 0,
			centerlineKinds: { line: 8 }
		},
		topology: 'admitted',
		compilerIssues: []
	},
	'N-2': {
		canonicalSha256: '7ef3d7041b8d3e63554255a03487cbe69fcfaecfb9309aa02d229f102bcc1f6d',
		shape: {
			rooms: 0,
			walls: 2,
			junctions: 4,
			openings: 0,
			curvedWalls: 1,
			centerlineKinds: { line: 1, 'cubic-chain': 1 }
		},
		topology: 'admitted',
		compilerIssues: []
	},
	'N-2i': {
		canonicalSha256: 'cf7c8ede49c56a6294a1670e6fc66ecac3f86adf405bb3bcc14d8fa38df06608',
		shape: {
			rooms: 0,
			walls: 2,
			junctions: 3,
			openings: 0,
			curvedWalls: 1,
			centerlineKinds: { line: 1, 'cubic-chain': 1 }
		},
		topology: 'unsupported_wall_topology',
		compilerIssues: []
	},
	'class4-self-intersection-v1': {
		canonicalSha256: '6f167571e7565a67043141ef04cbca0069b7d199bb67dcfc29894840f2786d86',
		shape: {
			rooms: 0,
			walls: 1,
			junctions: 2,
			openings: 0,
			curvedWalls: 1,
			centerlineKinds: { 'cubic-chain': 1 }
		},
		topology: 'unsupported_wall_topology',
		compilerIssues: ['wall_offset_overlap']
	},
	'class4-zero-length-wall-v1': {
		canonicalSha256: 'a8e985b185e94c7ff5f3c8c5970b7e4c30910c95ee4f137c01ec58af6ed74976',
		shape: {
			rooms: 0,
			walls: 1,
			junctions: 2,
			openings: 0,
			curvedWalls: 0,
			centerlineKinds: { line: 1 }
		},
		topology: 'duplicate_junction_point',
		compilerIssues: []
	},
	'class4-open-room-boundary-v1': {
		canonicalSha256: '47a38a1b52b17703cee5541521ddacee2f77ea23ab00629606cdefa6793f1b00',
		shape: {
			rooms: 1,
			walls: 3,
			junctions: 4,
			openings: 0,
			curvedWalls: 0,
			centerlineKinds: { line: 3 }
		},
		topology: 'unsupported_wall_topology',
		compilerIssues: ['disconnected_boundary']
	},
	'class4-component-duplicate-junction-v1': {
		canonicalSha256: 'ead9fdaf2aa1056d78025436f2e1c51ec1864cdc60960f9a39b7100f6af3fa93',
		shape: {
			rooms: 1,
			walls: 5,
			junctions: 5,
			openings: 0,
			curvedWalls: 0,
			centerlineKinds: { line: 5 }
		},
		topology: 'duplicate_junction_point',
		compilerIssues: ['junction_partition_failed', 'junction_seam_uncovered']
	}
};

/** Look up one matrix cell's expectations, failing loudly on a missing row. */
export function p23bMatrixVerdict(id: string): P23BFixtureVerdict {
	const verdict = P23B_MATRIX_VERDICTS[id];
	if (verdict === undefined) throw new Error(`Missing P23B matrix verdict: ${id}`);
	return verdict;
}

/** Look up one correctness row's expectations; the record type makes it total. */
export function p23bCorrectnessVerdict(id: P23BCorrectnessCaseId): P23BFixtureVerdict {
	return P23B_CORRECTNESS_VERDICTS[id];
}
