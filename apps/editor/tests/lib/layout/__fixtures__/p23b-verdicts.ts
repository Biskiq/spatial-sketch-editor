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
		canonicalSha256: '7efea76009fe435b9200751e48c88d29a2e0d5ceb5bfaf31fcc5f0d346606ba4',
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
		canonicalSha256: 'cf050a9e6036dfbdd68f0f6cda0f836d8955b145aa8d2e446ab9e25b01d7272c',
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
		canonicalSha256: '999749d3b10026f689e6fcef4e5cc1ce42777bd013d1ef3f12c629ce05c32077',
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
		canonicalSha256: 'ad4c0f8caa491578e904670a1ebdf67fe65fbb49875573367de5be32324fd9c0',
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
		canonicalSha256: '5e639e6989a5fc8d36e9c4f7255fbd47efc7dca309e04644978c6aeaa7d23baa',
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
		canonicalSha256: '14fc13a5f72affaf3c493cd77e43dc3d78790437142ffa33ffbf6a17b8614eb3',
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
		canonicalSha256: '2eaa0604c01d24eedbb8152655d7437b527228b694232f21f8da84b76d522474',
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
		canonicalSha256: '958cb02324b3ed0a49b8d382f4f5cb6c87ed0092eac85ef67757a67d154adc49',
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
		canonicalSha256: 'acad3086506185a6e3df738f56f96a616468fd5638e630ad2aa9c14192d9b895',
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
		canonicalSha256: '6d477402c985f70e453bb599da248f135db323806fb10cf7efd653be0acb3e5d',
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
		canonicalSha256: '603baefdcf609a7887cd1cfa7e0cf1ae21506be88cc39917f723c36efc86e712',
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
		canonicalSha256: '7d0d7a80d52de6f0dd4c8e8cab1978e20448bf36c2a9207044e5fc812aa57541',
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
		canonicalSha256: '80826f679e36a0addef27d81cb5668f9e40a010e1ebd6d000456f849a61922cb',
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
		canonicalSha256: 'f6d2d9c59ae9c2dd39fc9d25a97eb8a004d93066fd04879cdbf1f620cabf57cc',
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
