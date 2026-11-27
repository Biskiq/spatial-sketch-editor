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
		canonicalSha256: '7c1131eeebf8dfbac497b0c1ef7c842cc3b15116399bc085bc87a23fd1b7c74d',
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
		canonicalSha256: 'a2b5f7688926d0ad6996113e01e6b3d057d2095c10fdadb6e7a0ecf805cbc9fe',
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
		canonicalSha256: '68f1d6b0a6d8386bf560447a3e55603a2ac8bf45ec5447a7009ee4065725f48d',
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
		canonicalSha256: 'f96da44a13f72279fa98936fe79a86db86579d7e2cbf4008dda14760f7af84ab',
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
		canonicalSha256: 'a86e6982bf252742f74b11431d4bf77fc3ab0d3e9338234f5b0108329e79eadf',
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
		canonicalSha256: '2dfb74ce9cf674caa9441385296bed6c128a5b43bb676a4876973f32d4cc4b77',
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
		canonicalSha256: '6845dfa0dba8ffa5b5e596d7ceed3b9d2be182f8c75d3255c5679c31cc778cab',
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
		canonicalSha256: 'd4c2134dde3042f4afe2775ddcd71e6ca1e73c1eb015a19ead8287d784936fbd',
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
		canonicalSha256: '72854fb77de432f5e26f786dec6fb60b617aaef2df23410ebe2feb514ef4723a',
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
		canonicalSha256: '767d705bfbb028de4943987acf348d2137647b8793208eb6991805f6cac71a82',
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
		canonicalSha256: '1603483ed1fff825275fa3d40a4bd4f04a3fd63c7c0f8fd4fe85e9e6ef5296f3',
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
		canonicalSha256: 'e5e5aaa65e0a97af449113ab96653a25de3b4e475ac3c66bcb7956c938094923',
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
		canonicalSha256: 'c40545fa6415dddc19f32a38c0f9d8d60db949a4a79c371cf85535d3a91cfc44',
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
		canonicalSha256: '6ce01bc889893a0e649e0ae54683d7f98ce9335f818f0d8ae5838a65e9612281',
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
