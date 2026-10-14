/**
 * Test-owned verdicts for the P23B fixture set.
 *
 * These are the deterministic expectations the suite pins for every fixture the
 * builders in `./p23b-fixtures.ts` can construct: the canonical serialization
 * identity (sha256 of the canonical Layout JSON), the document shape, and the
 * shipped codec/topology/compiler verdict.
 *
 * The values were transcribed from the P23B measurement ledger document under
 * the P23B roadmap when the suite stopped reading it (plan §7.6 area 4), so that
 * its measurement provenance — machine, browser session, sampling, commit, date
 * and the class/role bookkeeping that belongs to a recorded measurement — is no
 * longer part of any test. WP4 may now delete that document, and no test under
 * `apps/editor/tests` reads it.
 *
 * The ledger held a 16th row, the retired `owner-40-curved-v1` owner payload. It
 * has no builder here (see `P23B_RETIRED_OWNER_FIXTURE_ID`), so it is
 * deliberately absent: it is historical identity, never a live fixture
 * expectation.
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
		canonicalSha256: '3c91ddc928aad8b9ff3d31c0a288bde1b46228c3d9d20bcdb8a1d1a9a882e401',
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
		canonicalSha256: '319fe997b5489304b177c8eb891e27ca7c17cee3a3a48f045b3e2aa3af62b44e',
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
		canonicalSha256: 'de138bcc81954d4f738610dc2ecbed7c968d64523c9daaeaec8e35884427edc6',
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
		canonicalSha256: '814ed5370d9dc72e9d7718e3d8dba631a654763cb6abac46331011d41978d9b2',
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
		canonicalSha256: '7d2f8dae33189a64ec9955e5c3bcd40b39105f02d3b5a1273e9c9ae0276314fe',
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
		canonicalSha256: '22efb326d057974476bfed7fca7d1f3d13dbad203af9bbd8054359cc9df3d461',
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
		canonicalSha256: '28234ec62593912185a6759a328b0f30fde6bc493fde1709d58d3c114c08a6d4',
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
		canonicalSha256: '565c67c6c87ac2a4fe20c8010d5473b88f1f9f164dbcba437b41b5ef57232f12',
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
		canonicalSha256: '70a9395ec8c4252a6a1cd58b8a64b0c922fd9720465566a7bc9cf2c8ad6b7dfb',
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
		canonicalSha256: '08cad1bc3365784eb2fa6389ab2396f8a53130812946fb2a19069bb0a2ff4c48',
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
		canonicalSha256: '1a1eeca04b5f2a7c02fc70e50cdc43aa85d02420566abde6062002ff9d5dfbc2',
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
		canonicalSha256: '04bcbdd7a0b4439d660996a13631816926a1de12ce02a6bccb4b5f4f2228018b',
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
		canonicalSha256: 'a59da5db5b8dc1a0b0576e615118e87274098daea5ad3491bc32e768ceaab3b9',
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
		canonicalSha256: '8a270ac9066b2ed9a1bc2ace47bd7028c2b8e26faab3f786cae0473a3df9fbd6',
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
		canonicalSha256: 'fb2f18c8f94fca9e7387338c61d9ac679256032ac94e327a652ece2f7fe15626',
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
