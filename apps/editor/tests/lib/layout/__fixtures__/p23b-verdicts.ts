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
		canonicalSha256: 'bedc86951d23391891113b9660b327365ea1647ccf1130533cf6ffa6452b4f56',
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
		canonicalSha256: 'b5322df4412ca394335f40dc4bbce9d2589a3b70e62a326190d8ee56c74cd4a4',
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
		canonicalSha256: '1974b3a26b5a1d03f4b2151f3d6bfd38c7e42c25f81165d85ca5ae17016f101c',
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
		canonicalSha256: 'ee48d880a1bca64be43e0b911520a9d000338daa67220036983e270047a2859c',
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
		canonicalSha256: '37aa38e2ade68b8f1d47be4e76044e00671c109ca78450dc4a461db03969b28e',
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
		canonicalSha256: '8778b574f0091de872d5160c31df1890782d5a122b3f0eef4433d6306890b86e',
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
		canonicalSha256: 'b448c0e037ef413863767e49270d5dd345c53b0d234928fdda84245b2dcfa759',
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
		canonicalSha256: '56d949ac6de7bc9b2a64ec6284f94dae0779b13cfabc40de582901a7959fe113',
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
		canonicalSha256: 'e780d7990cb9ce209e5f766a90acb5f8f06c2bdc3c125e0b6be9596b8fc76561',
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
		canonicalSha256: '373e576ad967ed5dabcccc86341a28042ae491af5eec8c4ee03e4d90d952d848',
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
		canonicalSha256: '1d9bea151d67e738b9a9d7f977862632f91ac249cbab0f1f975325a92df4f16b',
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
		canonicalSha256: '1b0a0af8fd3fd1c324e8f4ed48ccc750970683b2509a83149a68f91acbb77c11',
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
		canonicalSha256: 'def75dc6fe23e5c697ac484178213f26474e35fb8e7a8c2f3e4a2037151bd44b',
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
		canonicalSha256: '89a334cf1cebd0722b18eb2908f658da417935f081317a95a13d0b196394965f',
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
