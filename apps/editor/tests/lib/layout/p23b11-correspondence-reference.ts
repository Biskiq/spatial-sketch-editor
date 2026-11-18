/**
 * P23B.11 S2 — THE FROZEN OR-1 CORRESPONDENCE AND RECONCILIATION REFERENCE.
 *
 * This module IS the freeze. Every row records what TODAY'S shipped code returned
 * for one OR-1 case: the planner verdict and its reconciled document, the rebuilt
 * pass's fidelity against that document, the face×Room pair counts by D-12 class,
 * the OR-6 predicate-evaluation baseline, the correspondence components, the face
 * keys and the reconciliation outcome (lineage, retired Rooms, surviving Room
 * identities, document digest).
 *
 * WHY IT IS ITS OWN MODULE. S3's differential must compare the optimized path
 * against THIS table — not against a copy and not against another optimized
 * variant. Two consumers, one table: `p23b11-correspondence-reference.test.ts`
 * keeps asserting the live path against it (so the freeze cannot drift), and the
 * S3 differential asserts the short-circuited path returns the same rows.
 *
 * HOW IT WAS GENERATED (one-time, no hand-editing). Written at commit 9a89e42b on
 * 2026-09-27, node v26.7.0, darwin arm64, by running a temporary generator that
 * executed `frozenCaseRows()` from `p23b11-correspondence-cases.ts` over the
 * UNOPTIMIZED code and serialized the result in this file's style; the generator
 * was removed once the freeze was written, and nothing regenerates this module
 * (the cutover's one-time re-emission recorded below is the single exception).
 * Two consecutive generator runs produced byte-identical output before the file
 * was written, and the S2 freeze test was green on landing because it asserts
 * exactly this code. A future step that needs to move a row must change it as a
 * reviewable finding — never by re-running a generator over changed code.
 *
 * T1.P02.S01 §1 FINDING (2026-10-22) — CAPTURED IDENTITY, REVIEWED ROW BY ROW.
 *
 * Every planner now derives its ids from the operation's captured nonce, so a
 * row whose operation mints ids carries different ones. This table is the ONE
 * RECORDED EXCEPTION to the rule above, and it is recorded as an exception, not
 * as a precedent: its rows were re-emitted once at the cutover (which is why they
 * now carry trailing commas the base table did not), and every row was then
 * compared field by field against the base revision `55683981`
 * (`git show 55683981:` this module), not against the cutover, which would
 * compare the table with itself. What the freeze equality below CANNOT prove is
 * behavioural stability on the nine moved rows: it asserts today's code against
 * this table, so for those rows the field-by-field comparison against `55683981`
 * is the evidence, and the nonce-locality property is what keeps it checkable.
 * The comparison is exact: 24 rows,
 * matched by id, field by field (counts, operation verdict/code, component
 * shape, face-key set, reconciliation kind, lineage kinds, retired/surviving
 * Room ids, fidelity). It found exactly three kinds of difference:
 *
 * 1. IDENTITY, 9 rows: `b-straight-40-rect-room`, `b-all-curved-40-rect-room`,
 *    `c-straight-12-room-division`, `c-all-curved-12-room-division`,
 *    `f-d12-full-containment-mirror-role-change`, `f-d12-whole-boundary-replacement`,
 *    `g-empty-closed-chain`, `g-faces-only-clear-gap`, `h-connected-room-division`.
 *    Planner-created Wall/Junction/Room ids gained `.<case nonce>` (the case
 *    table pins the nonce as `p23b11-<case id>`); the face keys that embed those
 *    ids gained the same suffix and their length prefixes, and each accepted
 *    document digest moved with them. The two 40-face rows additionally re-sort
 *    their component array, because component order is face-key order. In all
 *    nine: the component SET, the predecessor sets, the pair and predicate
 *    counts, the surviving Room set and the retired Room set are unchanged.
 * 2. ORDER, 2 rows: `lineage` in `b-straight-40-rect-room` and
 *    `b-all-curved-40-rect-room` (`created` moved from first to last) because
 *    lineage follows Room order, which follows id order. The lineage KIND SET,
 *    the surviving Room ids and the retired Room set are unchanged.
 * 3. FIDELITY, 1 row: `f-d12-full-containment-mirror-role-change` records
 *    `fidelity: false`. This is the format-6 change, not captured identity: the
 *    authored role is gone, so the D-12 mirror is expressed as `planDeleteWall`,
 *    and a deletion prunes orphaned Junctions that the correspondence-only
 *    rebuilt pass does not model. The freeze test names this row as
 *    `DELETION_EXCEPTION` and asserts the recorded `false` THERE, so the
 *    exemption cannot silently widen; every other planned row must still
 *    reproduce the planner's document.
 *
 * The other 15 rows are identical to the base revision apart from the trailing
 * commas the regeneration emitted (an object/array formatting difference only;
 * no count, set, verdict or kind differs on them). The nonce locality property
 * in `p23b11-correspondence-reference.test.ts` keeps the general claim checkable:
 * re-running a case under a DIFFERENT nonce changes identity-bearing content
 * only — never a count, a relation, a lineage kind, a retired set or a verdict —
 * so "the ids moved" cannot hide a behavioural change.
 *
 * A future move is expected to be recorded the same way: state the category, the
 * verification and the row names, and add the property that makes it checkable.
 *
 * NO VALUE IN THIS MODULE MAY CHANGE. A change here silently moves what both the
 * freeze test and the differential treat as the reference. If a row has to move,
 * it is a finding about the LIVE behaviour and is recorded as one.
 *
 * ONE ROW WAS ADDED (2026-09-27, owner-review fix). The case table gained the
 * dissolve row `h-connected-corner-dissolve` — the third live caller of the
 * shared `buildCorrespondenceComponents` — and its frozen row was generated from
 * the EXHAUSTIVE (test-only bypass) path, today's loop verbatim, then pasted here
 * unchanged; the S3 differential asserts the shipped path and the bypass both
 * reproduce it. Every pre-existing row in this module is untouched.
 *
 * ONE ROW MOVED (T1 A2 `layout.wall-join`, 2026-11-12).
 * `h-connected-corner-dissolve` now records a REFUSAL: the A2 join gate refuses
 * a non-tangent curved pair, and the grid's 90° corner meets that rule
 * (`non_tangent_curved_pair`). The row was regenerated from the live planner —
 * never edited by hand — so its components are empty and its fidelity is `null`
 * because the operation is refused before the correspondence pass. The finding
 * this records: dissolve no longer exercises `buildCorrespondenceComponents` on
 * a corner. That is deliberate, because a cornered chain is not a join the
 * product offers; the remaining planned rows keep the builder's live coverage.
 * Every other row is untouched.
 *
 * FORMAT 8 RE-DERIVATION (2026-11-17). Every Room now serializes required
 * `virtualEdges` and `overhead`, so every accepted document's canonical bytes —
 * and therefore its `documentSha256` — moved. This was a SHA-only re-emission:
 * 18 distinct digests across the accepted rows, and no other field changed. The
 * field-by-field comparison is `git diff --word-diff` over this module: apart
 * from this note, every added or removed line is a `documentSha256` assignment.
 * Counts, verdicts, component shapes, lineage kinds, retired/surviving sets and
 * fidelity are the pre-format-8 records and remain the behavioural reference.
 */
import type { P23B11FrozenCase } from './p23b11-correspondence-cases';

/** Keyed by case id; the table order is the case table's order. */
export const P23B11_OR1_REFERENCE: readonly P23B11FrozenCase[] = [
	{
		id: 'a-straight-40-clear-gap',
		covers: 'OR-1(a)',
		operation: {
			verdict: 'success',
			documentSha256: '492b6d0ac20f93977ec6b96de220dddeacd691a83272715d340115acd73e8318'
		},
		fidelity: true,
		counts: {
			faces: 10,
			predecessors: 10,
			pairs: 100,
			sameGroupPairs: 10,
			crossGroupPairs: 90,
			undefinedPairs: 0,
			insideEvaluations: 100,
			overlapEvaluations: 100
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F15:room-0:wall-2~F15:room-0:wall-3~F'
				],
				predecessorRoomIds: [
					'room-0'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F'
				],
				predecessorRoomIds: [
					'room-1'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F'
				],
				predecessorRoomIds: [
					'room-2'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-3:wall-0~F15:room-3:wall-1~F15:room-3:wall-2~F15:room-3:wall-3~F'
				],
				predecessorRoomIds: [
					'room-3'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-4:wall-0~F15:room-4:wall-1~F15:room-4:wall-2~F15:room-4:wall-3~F'
				],
				predecessorRoomIds: [
					'room-4'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-5:wall-0~F15:room-5:wall-1~F15:room-5:wall-2~F15:room-5:wall-3~F'
				],
				predecessorRoomIds: [
					'room-5'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-6:wall-0~F15:room-6:wall-1~F15:room-6:wall-2~F15:room-6:wall-3~F'
				],
				predecessorRoomIds: [
					'room-6'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-7:wall-0~F15:room-7:wall-1~F15:room-7:wall-2~F15:room-7:wall-3~F'
				],
				predecessorRoomIds: [
					'room-7'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-8:wall-0~F15:room-8:wall-1~F15:room-8:wall-2~F15:room-8:wall-3~F'
				],
				predecessorRoomIds: [
					'room-8'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-9:wall-0~F15:room-9:wall-1~F15:room-9:wall-2~F15:room-9:wall-3~F'
				],
				predecessorRoomIds: [
					'room-9'
				]
			}
		],
		faceKeys: [
			'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F15:room-0:wall-2~F15:room-0:wall-3~F',
			'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
			'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
			'5:4:face15:room-3:wall-0~F15:room-3:wall-1~F15:room-3:wall-2~F15:room-3:wall-3~F',
			'5:4:face15:room-4:wall-0~F15:room-4:wall-1~F15:room-4:wall-2~F15:room-4:wall-3~F',
			'5:4:face15:room-5:wall-0~F15:room-5:wall-1~F15:room-5:wall-2~F15:room-5:wall-3~F',
			'5:4:face15:room-6:wall-0~F15:room-6:wall-1~F15:room-6:wall-2~F15:room-6:wall-3~F',
			'5:4:face15:room-7:wall-0~F15:room-7:wall-1~F15:room-7:wall-2~F15:room-7:wall-3~F',
			'5:4:face15:room-8:wall-0~F15:room-8:wall-1~F15:room-8:wall-2~F15:room-8:wall-3~F',
			'5:4:face15:room-9:wall-0~F15:room-9:wall-1~F15:room-9:wall-2~F15:room-9:wall-3~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face15:room-0:wall-0~F15:room-0:wall-1~F15:room-0:wall-2~F15:room-0:wall-3~F',
					roomId: 'room-0',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
					roomId: 'room-1',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
					roomId: 'room-2',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-3:wall-0~F15:room-3:wall-1~F15:room-3:wall-2~F15:room-3:wall-3~F',
					roomId: 'room-3',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-4:wall-0~F15:room-4:wall-1~F15:room-4:wall-2~F15:room-4:wall-3~F',
					roomId: 'room-4',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-5:wall-0~F15:room-5:wall-1~F15:room-5:wall-2~F15:room-5:wall-3~F',
					roomId: 'room-5',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-6:wall-0~F15:room-6:wall-1~F15:room-6:wall-2~F15:room-6:wall-3~F',
					roomId: 'room-6',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-7:wall-0~F15:room-7:wall-1~F15:room-7:wall-2~F15:room-7:wall-3~F',
					roomId: 'room-7',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-8:wall-0~F15:room-8:wall-1~F15:room-8:wall-2~F15:room-8:wall-3~F',
					roomId: 'room-8',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-9:wall-0~F15:room-9:wall-1~F15:room-9:wall-2~F15:room-9:wall-3~F',
					roomId: 'room-9',
					kind: 'preserved'
				}
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room-0',
					name: 'Room 0'
				},
				{
					id: 'room-1',
					name: 'Room 1'
				},
				{
					id: 'room-2',
					name: 'Room 2'
				},
				{
					id: 'room-3',
					name: 'Room 3'
				},
				{
					id: 'room-4',
					name: 'Room 4'
				},
				{
					id: 'room-5',
					name: 'Room 5'
				},
				{
					id: 'room-6',
					name: 'Room 6'
				},
				{
					id: 'room-7',
					name: 'Room 7'
				},
				{
					id: 'room-8',
					name: 'Room 8'
				},
				{
					id: 'room-9',
					name: 'Room 9'
				}
			],
			documentSha256: '492b6d0ac20f93977ec6b96de220dddeacd691a83272715d340115acd73e8318'
		}
	},
	{
		id: 'a-all-curved-40-clear-gap',
		covers: 'OR-1(a)',
		operation: {
			verdict: 'success',
			documentSha256: '492b6d0ac20f93977ec6b96de220dddeacd691a83272715d340115acd73e8318'
		},
		fidelity: true,
		counts: {
			faces: 10,
			predecessors: 10,
			pairs: 100,
			sameGroupPairs: 10,
			crossGroupPairs: 90,
			undefinedPairs: 0,
			insideEvaluations: 100,
			overlapEvaluations: 100
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F15:room-0:wall-2~F15:room-0:wall-3~F'
				],
				predecessorRoomIds: [
					'room-0'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F'
				],
				predecessorRoomIds: [
					'room-1'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F'
				],
				predecessorRoomIds: [
					'room-2'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-3:wall-0~F15:room-3:wall-1~F15:room-3:wall-2~F15:room-3:wall-3~F'
				],
				predecessorRoomIds: [
					'room-3'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-4:wall-0~F15:room-4:wall-1~F15:room-4:wall-2~F15:room-4:wall-3~F'
				],
				predecessorRoomIds: [
					'room-4'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-5:wall-0~F15:room-5:wall-1~F15:room-5:wall-2~F15:room-5:wall-3~F'
				],
				predecessorRoomIds: [
					'room-5'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-6:wall-0~F15:room-6:wall-1~F15:room-6:wall-2~F15:room-6:wall-3~F'
				],
				predecessorRoomIds: [
					'room-6'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-7:wall-0~F15:room-7:wall-1~F15:room-7:wall-2~F15:room-7:wall-3~F'
				],
				predecessorRoomIds: [
					'room-7'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-8:wall-0~F15:room-8:wall-1~F15:room-8:wall-2~F15:room-8:wall-3~F'
				],
				predecessorRoomIds: [
					'room-8'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-9:wall-0~F15:room-9:wall-1~F15:room-9:wall-2~F15:room-9:wall-3~F'
				],
				predecessorRoomIds: [
					'room-9'
				]
			}
		],
		faceKeys: [
			'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F15:room-0:wall-2~F15:room-0:wall-3~F',
			'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
			'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
			'5:4:face15:room-3:wall-0~F15:room-3:wall-1~F15:room-3:wall-2~F15:room-3:wall-3~F',
			'5:4:face15:room-4:wall-0~F15:room-4:wall-1~F15:room-4:wall-2~F15:room-4:wall-3~F',
			'5:4:face15:room-5:wall-0~F15:room-5:wall-1~F15:room-5:wall-2~F15:room-5:wall-3~F',
			'5:4:face15:room-6:wall-0~F15:room-6:wall-1~F15:room-6:wall-2~F15:room-6:wall-3~F',
			'5:4:face15:room-7:wall-0~F15:room-7:wall-1~F15:room-7:wall-2~F15:room-7:wall-3~F',
			'5:4:face15:room-8:wall-0~F15:room-8:wall-1~F15:room-8:wall-2~F15:room-8:wall-3~F',
			'5:4:face15:room-9:wall-0~F15:room-9:wall-1~F15:room-9:wall-2~F15:room-9:wall-3~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face15:room-0:wall-0~F15:room-0:wall-1~F15:room-0:wall-2~F15:room-0:wall-3~F',
					roomId: 'room-0',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
					roomId: 'room-1',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
					roomId: 'room-2',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-3:wall-0~F15:room-3:wall-1~F15:room-3:wall-2~F15:room-3:wall-3~F',
					roomId: 'room-3',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-4:wall-0~F15:room-4:wall-1~F15:room-4:wall-2~F15:room-4:wall-3~F',
					roomId: 'room-4',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-5:wall-0~F15:room-5:wall-1~F15:room-5:wall-2~F15:room-5:wall-3~F',
					roomId: 'room-5',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-6:wall-0~F15:room-6:wall-1~F15:room-6:wall-2~F15:room-6:wall-3~F',
					roomId: 'room-6',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-7:wall-0~F15:room-7:wall-1~F15:room-7:wall-2~F15:room-7:wall-3~F',
					roomId: 'room-7',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-8:wall-0~F15:room-8:wall-1~F15:room-8:wall-2~F15:room-8:wall-3~F',
					roomId: 'room-8',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-9:wall-0~F15:room-9:wall-1~F15:room-9:wall-2~F15:room-9:wall-3~F',
					roomId: 'room-9',
					kind: 'preserved'
				}
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room-0',
					name: 'Room 0'
				},
				{
					id: 'room-1',
					name: 'Room 1'
				},
				{
					id: 'room-2',
					name: 'Room 2'
				},
				{
					id: 'room-3',
					name: 'Room 3'
				},
				{
					id: 'room-4',
					name: 'Room 4'
				},
				{
					id: 'room-5',
					name: 'Room 5'
				},
				{
					id: 'room-6',
					name: 'Room 6'
				},
				{
					id: 'room-7',
					name: 'Room 7'
				},
				{
					id: 'room-8',
					name: 'Room 8'
				},
				{
					id: 'room-9',
					name: 'Room 9'
				}
			],
			documentSha256: '492b6d0ac20f93977ec6b96de220dddeacd691a83272715d340115acd73e8318'
		}
	},
	{
		id: 'b-straight-40-rect-room',
		covers: 'OR-1(b)',
		operation: {
			verdict: 'success',
			documentSha256: '329f46226ae33f7cadb477613eda586e12e543929a6b946979e5c4707e7490c1',
		},
		fidelity: true,
		counts: {
			faces: 11,
			predecessors: 10,
			pairs: 110,
			sameGroupPairs: 10,
			crossGroupPairs: 100,
			undefinedPairs: 0,
			insideEvaluations: 110,
			overlapEvaluations: 110,
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F15:room-0:wall-2~F15:room-0:wall-3~F',
				],
				predecessorRoomIds: [
					'room-0',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
				],
				predecessorRoomIds: [
					'room-1',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
				],
				predecessorRoomIds: [
					'room-2',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-3:wall-0~F15:room-3:wall-1~F15:room-3:wall-2~F15:room-3:wall-3~F',
				],
				predecessorRoomIds: [
					'room-3',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-4:wall-0~F15:room-4:wall-1~F15:room-4:wall-2~F15:room-4:wall-3~F',
				],
				predecessorRoomIds: [
					'room-4',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-5:wall-0~F15:room-5:wall-1~F15:room-5:wall-2~F15:room-5:wall-3~F',
				],
				predecessorRoomIds: [
					'room-5',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-6:wall-0~F15:room-6:wall-1~F15:room-6:wall-2~F15:room-6:wall-3~F',
				],
				predecessorRoomIds: [
					'room-6',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-7:wall-0~F15:room-7:wall-1~F15:room-7:wall-2~F15:room-7:wall-3~F',
				],
				predecessorRoomIds: [
					'room-7',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-8:wall-0~F15:room-8:wall-1~F15:room-8:wall-2~F15:room-8:wall-3~F',
				],
				predecessorRoomIds: [
					'room-8',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-9:wall-0~F15:room-9:wall-1~F15:room-9:wall-2~F15:room-9:wall-3~F',
				],
				predecessorRoomIds: [
					'room-9',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face45:wall-chain-1.p23b11-b-straight-40-rect-room~F45:wall-chain-2.p23b11-b-straight-40-rect-room~F45:wall-chain-3.p23b11-b-straight-40-rect-room~F45:wall-chain-4.p23b11-b-straight-40-rect-room~F',
				],
				predecessorRoomIds: [],
			},
		],
		faceKeys: [
			'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F15:room-0:wall-2~F15:room-0:wall-3~F',
			'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
			'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
			'5:4:face15:room-3:wall-0~F15:room-3:wall-1~F15:room-3:wall-2~F15:room-3:wall-3~F',
			'5:4:face15:room-4:wall-0~F15:room-4:wall-1~F15:room-4:wall-2~F15:room-4:wall-3~F',
			'5:4:face15:room-5:wall-0~F15:room-5:wall-1~F15:room-5:wall-2~F15:room-5:wall-3~F',
			'5:4:face15:room-6:wall-0~F15:room-6:wall-1~F15:room-6:wall-2~F15:room-6:wall-3~F',
			'5:4:face15:room-7:wall-0~F15:room-7:wall-1~F15:room-7:wall-2~F15:room-7:wall-3~F',
			'5:4:face15:room-8:wall-0~F15:room-8:wall-1~F15:room-8:wall-2~F15:room-8:wall-3~F',
			'5:4:face15:room-9:wall-0~F15:room-9:wall-1~F15:room-9:wall-2~F15:room-9:wall-3~F',
			'5:4:face45:wall-chain-1.p23b11-b-straight-40-rect-room~F45:wall-chain-2.p23b11-b-straight-40-rect-room~F45:wall-chain-3.p23b11-b-straight-40-rect-room~F45:wall-chain-4.p23b11-b-straight-40-rect-room~F',
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face15:room-0:wall-0~F15:room-0:wall-1~F15:room-0:wall-2~F15:room-0:wall-3~F',
					roomId: 'room-0',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
					roomId: 'room-1',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
					roomId: 'room-2',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-3:wall-0~F15:room-3:wall-1~F15:room-3:wall-2~F15:room-3:wall-3~F',
					roomId: 'room-3',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-4:wall-0~F15:room-4:wall-1~F15:room-4:wall-2~F15:room-4:wall-3~F',
					roomId: 'room-4',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-5:wall-0~F15:room-5:wall-1~F15:room-5:wall-2~F15:room-5:wall-3~F',
					roomId: 'room-5',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-6:wall-0~F15:room-6:wall-1~F15:room-6:wall-2~F15:room-6:wall-3~F',
					roomId: 'room-6',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-7:wall-0~F15:room-7:wall-1~F15:room-7:wall-2~F15:room-7:wall-3~F',
					roomId: 'room-7',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-8:wall-0~F15:room-8:wall-1~F15:room-8:wall-2~F15:room-8:wall-3~F',
					roomId: 'room-8',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-9:wall-0~F15:room-9:wall-1~F15:room-9:wall-2~F15:room-9:wall-3~F',
					roomId: 'room-9',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face45:wall-chain-1.p23b11-b-straight-40-rect-room~F45:wall-chain-2.p23b11-b-straight-40-rect-room~F45:wall-chain-3.p23b11-b-straight-40-rect-room~F45:wall-chain-4.p23b11-b-straight-40-rect-room~F',
					roomId: 'room.5:4:face45:wall-chain-1.p23b11-b-straight-40-rect-room-F45:wall-chain-2.p23b11-b-straight-40-rect-room-F45:wall-chain-3.p23b11-b-straight-40-rect-room-F45:wall-chain-4.p23b11-b-straight-40-rect-room-F.p23b11-b-straight-40-rect-room',
					kind: 'created',
				},
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room-0',
					name: 'Room 0',
				},
				{
					id: 'room-1',
					name: 'Room 1',
				},
				{
					id: 'room-2',
					name: 'Room 2',
				},
				{
					id: 'room-3',
					name: 'Room 3',
				},
				{
					id: 'room-4',
					name: 'Room 4',
				},
				{
					id: 'room-5',
					name: 'Room 5',
				},
				{
					id: 'room-6',
					name: 'Room 6',
				},
				{
					id: 'room-7',
					name: 'Room 7',
				},
				{
					id: 'room-8',
					name: 'Room 8',
				},
				{
					id: 'room-9',
					name: 'Room 9',
				},
				{
					id: 'room.5:4:face45:wall-chain-1.p23b11-b-straight-40-rect-room-F45:wall-chain-2.p23b11-b-straight-40-rect-room-F45:wall-chain-3.p23b11-b-straight-40-rect-room-F45:wall-chain-4.p23b11-b-straight-40-rect-room-F.p23b11-b-straight-40-rect-room',
					name: 'Draft Room 1',
				},
			],
			documentSha256: '329f46226ae33f7cadb477613eda586e12e543929a6b946979e5c4707e7490c1',
		},
	},
	{
		id: 'b-all-curved-40-rect-room',
		covers: 'OR-1(b)',
		operation: {
			verdict: 'success',
			documentSha256: 'c807fe6d4e3eba45e72d5ce51193452eed28c71d2d87b394352385d4f1de586e',
		},
		fidelity: true,
		counts: {
			faces: 11,
			predecessors: 10,
			pairs: 110,
			sameGroupPairs: 10,
			crossGroupPairs: 100,
			undefinedPairs: 0,
			insideEvaluations: 110,
			overlapEvaluations: 110,
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F15:room-0:wall-2~F15:room-0:wall-3~F',
				],
				predecessorRoomIds: [
					'room-0',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
				],
				predecessorRoomIds: [
					'room-1',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
				],
				predecessorRoomIds: [
					'room-2',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-3:wall-0~F15:room-3:wall-1~F15:room-3:wall-2~F15:room-3:wall-3~F',
				],
				predecessorRoomIds: [
					'room-3',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-4:wall-0~F15:room-4:wall-1~F15:room-4:wall-2~F15:room-4:wall-3~F',
				],
				predecessorRoomIds: [
					'room-4',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-5:wall-0~F15:room-5:wall-1~F15:room-5:wall-2~F15:room-5:wall-3~F',
				],
				predecessorRoomIds: [
					'room-5',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-6:wall-0~F15:room-6:wall-1~F15:room-6:wall-2~F15:room-6:wall-3~F',
				],
				predecessorRoomIds: [
					'room-6',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-7:wall-0~F15:room-7:wall-1~F15:room-7:wall-2~F15:room-7:wall-3~F',
				],
				predecessorRoomIds: [
					'room-7',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-8:wall-0~F15:room-8:wall-1~F15:room-8:wall-2~F15:room-8:wall-3~F',
				],
				predecessorRoomIds: [
					'room-8',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-9:wall-0~F15:room-9:wall-1~F15:room-9:wall-2~F15:room-9:wall-3~F',
				],
				predecessorRoomIds: [
					'room-9',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face47:wall-chain-1.p23b11-b-all-curved-40-rect-room~F47:wall-chain-2.p23b11-b-all-curved-40-rect-room~F47:wall-chain-3.p23b11-b-all-curved-40-rect-room~F47:wall-chain-4.p23b11-b-all-curved-40-rect-room~F',
				],
				predecessorRoomIds: [],
			},
		],
		faceKeys: [
			'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F15:room-0:wall-2~F15:room-0:wall-3~F',
			'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
			'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
			'5:4:face15:room-3:wall-0~F15:room-3:wall-1~F15:room-3:wall-2~F15:room-3:wall-3~F',
			'5:4:face15:room-4:wall-0~F15:room-4:wall-1~F15:room-4:wall-2~F15:room-4:wall-3~F',
			'5:4:face15:room-5:wall-0~F15:room-5:wall-1~F15:room-5:wall-2~F15:room-5:wall-3~F',
			'5:4:face15:room-6:wall-0~F15:room-6:wall-1~F15:room-6:wall-2~F15:room-6:wall-3~F',
			'5:4:face15:room-7:wall-0~F15:room-7:wall-1~F15:room-7:wall-2~F15:room-7:wall-3~F',
			'5:4:face15:room-8:wall-0~F15:room-8:wall-1~F15:room-8:wall-2~F15:room-8:wall-3~F',
			'5:4:face15:room-9:wall-0~F15:room-9:wall-1~F15:room-9:wall-2~F15:room-9:wall-3~F',
			'5:4:face47:wall-chain-1.p23b11-b-all-curved-40-rect-room~F47:wall-chain-2.p23b11-b-all-curved-40-rect-room~F47:wall-chain-3.p23b11-b-all-curved-40-rect-room~F47:wall-chain-4.p23b11-b-all-curved-40-rect-room~F',
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face15:room-0:wall-0~F15:room-0:wall-1~F15:room-0:wall-2~F15:room-0:wall-3~F',
					roomId: 'room-0',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
					roomId: 'room-1',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
					roomId: 'room-2',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-3:wall-0~F15:room-3:wall-1~F15:room-3:wall-2~F15:room-3:wall-3~F',
					roomId: 'room-3',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-4:wall-0~F15:room-4:wall-1~F15:room-4:wall-2~F15:room-4:wall-3~F',
					roomId: 'room-4',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-5:wall-0~F15:room-5:wall-1~F15:room-5:wall-2~F15:room-5:wall-3~F',
					roomId: 'room-5',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-6:wall-0~F15:room-6:wall-1~F15:room-6:wall-2~F15:room-6:wall-3~F',
					roomId: 'room-6',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-7:wall-0~F15:room-7:wall-1~F15:room-7:wall-2~F15:room-7:wall-3~F',
					roomId: 'room-7',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-8:wall-0~F15:room-8:wall-1~F15:room-8:wall-2~F15:room-8:wall-3~F',
					roomId: 'room-8',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-9:wall-0~F15:room-9:wall-1~F15:room-9:wall-2~F15:room-9:wall-3~F',
					roomId: 'room-9',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face47:wall-chain-1.p23b11-b-all-curved-40-rect-room~F47:wall-chain-2.p23b11-b-all-curved-40-rect-room~F47:wall-chain-3.p23b11-b-all-curved-40-rect-room~F47:wall-chain-4.p23b11-b-all-curved-40-rect-room~F',
					roomId: 'room.5:4:face47:wall-chain-1.p23b11-b-all-curved-40-rect-room-F47:wall-chain-2.p23b11-b-all-curved-40-rect-room-F47:wall-chain-3.p23b11-b-all-curved-40-rect-room-F47:wall-chain-4.p23b11-b-all-curved-40-rect-room-F.p23b11-b-all-curved-40-rect-room',
					kind: 'created',
				},
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room-0',
					name: 'Room 0',
				},
				{
					id: 'room-1',
					name: 'Room 1',
				},
				{
					id: 'room-2',
					name: 'Room 2',
				},
				{
					id: 'room-3',
					name: 'Room 3',
				},
				{
					id: 'room-4',
					name: 'Room 4',
				},
				{
					id: 'room-5',
					name: 'Room 5',
				},
				{
					id: 'room-6',
					name: 'Room 6',
				},
				{
					id: 'room-7',
					name: 'Room 7',
				},
				{
					id: 'room-8',
					name: 'Room 8',
				},
				{
					id: 'room-9',
					name: 'Room 9',
				},
				{
					id: 'room.5:4:face47:wall-chain-1.p23b11-b-all-curved-40-rect-room-F47:wall-chain-2.p23b11-b-all-curved-40-rect-room-F47:wall-chain-3.p23b11-b-all-curved-40-rect-room-F47:wall-chain-4.p23b11-b-all-curved-40-rect-room-F.p23b11-b-all-curved-40-rect-room',
					name: 'Draft Room 1',
				},
			],
			documentSha256: 'c807fe6d4e3eba45e72d5ce51193452eed28c71d2d87b394352385d4f1de586e',
		},
	},
	{
		id: 'c-straight-12-room-division',
		covers: 'OR-1(c)',
		operation: {
			verdict: 'success',
			documentSha256: '78e474ed1058bb8980b6a297d6dc1a9269c2e2596e7c0f6b606af5b4f0a7a59d',
		},
		fidelity: true,
		counts: {
			faces: 4,
			predecessors: 3,
			pairs: 12,
			sameGroupPairs: 4,
			crossGroupPairs: 8,
			undefinedPairs: 0,
			insideEvaluations: 12,
			overlapEvaluations: 12,
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F49:wall-chain-1.p23b11-c-straight-12-room-division~R52:room-0:wall-3-b.p23b11-c-straight-12-room-division~F',
					'5:4:face52:room-0:wall-1-b.p23b11-c-straight-12-room-division~F15:room-0:wall-2~F15:room-0:wall-3~F49:wall-chain-1.p23b11-c-straight-12-room-division~F',
				],
				predecessorRoomIds: [
					'room-0',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
				],
				predecessorRoomIds: [
					'room-1',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
				],
				predecessorRoomIds: [
					'room-2',
				],
			},
		],
		faceKeys: [
			'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F49:wall-chain-1.p23b11-c-straight-12-room-division~R52:room-0:wall-3-b.p23b11-c-straight-12-room-division~F',
			'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
			'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
			'5:4:face52:room-0:wall-1-b.p23b11-c-straight-12-room-division~F15:room-0:wall-2~F15:room-0:wall-3~F49:wall-chain-1.p23b11-c-straight-12-room-division~F',
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face52:room-0:wall-1-b.p23b11-c-straight-12-room-division~F15:room-0:wall-2~F15:room-0:wall-3~F49:wall-chain-1.p23b11-c-straight-12-room-division~F',
					roomId: 'room-0',
					kind: 'split-survivor',
				},
				{
					faceKey: '5:4:face15:room-0:wall-0~F15:room-0:wall-1~F49:wall-chain-1.p23b11-c-straight-12-room-division~R52:room-0:wall-3-b.p23b11-c-straight-12-room-division~F',
					roomId: 'room.5:4:face15:room-0:wall-0-F15:room-0:wall-1-F49:wall-chain-1.p23b11-c-straight-12-room-division-R52:room-0:wall-3-b.p23b11-c-straight-12-room-division-F.p23b11-c-straight-12-room-division',
					kind: 'created',
				},
				{
					faceKey: '5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
					roomId: 'room-1',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
					roomId: 'room-2',
					kind: 'preserved',
				},
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room-0',
					name: 'Room 0',
				},
				{
					id: 'room.5:4:face15:room-0:wall-0-F15:room-0:wall-1-F49:wall-chain-1.p23b11-c-straight-12-room-division-R52:room-0:wall-3-b.p23b11-c-straight-12-room-division-F.p23b11-c-straight-12-room-division',
					name: 'Draft Room 1',
				},
				{
					id: 'room-1',
					name: 'Room 1',
				},
				{
					id: 'room-2',
					name: 'Room 2',
				},
			],
			documentSha256: '78e474ed1058bb8980b6a297d6dc1a9269c2e2596e7c0f6b606af5b4f0a7a59d',
		},
	},
	{
		id: 'c-all-curved-12-room-division',
		covers: 'OR-1(c)',
		operation: {
			verdict: 'success',
			documentSha256: 'ecc4a93852eb272f18140481148273595e691ce87471be6a29ed47852d7cf5b6',
		},
		fidelity: true,
		counts: {
			faces: 4,
			predecessors: 3,
			pairs: 12,
			sameGroupPairs: 4,
			crossGroupPairs: 8,
			undefinedPairs: 0,
			insideEvaluations: 12,
			overlapEvaluations: 12,
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F51:wall-chain-1.p23b11-c-all-curved-12-room-division~R54:room-0:wall-3-b.p23b11-c-all-curved-12-room-division~F',
					'5:4:face54:room-0:wall-1-b.p23b11-c-all-curved-12-room-division~F15:room-0:wall-2~F15:room-0:wall-3~F51:wall-chain-1.p23b11-c-all-curved-12-room-division~F',
				],
				predecessorRoomIds: [
					'room-0',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
				],
				predecessorRoomIds: [
					'room-1',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
				],
				predecessorRoomIds: [
					'room-2',
				],
			},
		],
		faceKeys: [
			'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F51:wall-chain-1.p23b11-c-all-curved-12-room-division~R54:room-0:wall-3-b.p23b11-c-all-curved-12-room-division~F',
			'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
			'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
			'5:4:face54:room-0:wall-1-b.p23b11-c-all-curved-12-room-division~F15:room-0:wall-2~F15:room-0:wall-3~F51:wall-chain-1.p23b11-c-all-curved-12-room-division~F',
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face54:room-0:wall-1-b.p23b11-c-all-curved-12-room-division~F15:room-0:wall-2~F15:room-0:wall-3~F51:wall-chain-1.p23b11-c-all-curved-12-room-division~F',
					roomId: 'room-0',
					kind: 'split-survivor',
				},
				{
					faceKey: '5:4:face15:room-0:wall-0~F15:room-0:wall-1~F51:wall-chain-1.p23b11-c-all-curved-12-room-division~R54:room-0:wall-3-b.p23b11-c-all-curved-12-room-division~F',
					roomId: 'room.5:4:face15:room-0:wall-0-F15:room-0:wall-1-F51:wall-chain-1.p23b11-c-all-curved-12-room-division-R54:room-0:wall-3-b.p23b11-c-all-curved-12-room-division-F.p23b11-c-all-curved-12-room-division',
					kind: 'created',
				},
				{
					faceKey: '5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
					roomId: 'room-1',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
					roomId: 'room-2',
					kind: 'preserved',
				},
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room-0',
					name: 'Room 0',
				},
				{
					id: 'room.5:4:face15:room-0:wall-0-F15:room-0:wall-1-F51:wall-chain-1.p23b11-c-all-curved-12-room-division-R54:room-0:wall-3-b.p23b11-c-all-curved-12-room-division-F.p23b11-c-all-curved-12-room-division',
					name: 'Draft Room 1',
				},
				{
					id: 'room-1',
					name: 'Room 1',
				},
				{
					id: 'room-2',
					name: 'Room 2',
				},
			],
			documentSha256: 'ecc4a93852eb272f18140481148273595e691ce87471be6a29ed47852d7cf5b6',
		},
	},
	{
		id: 'd-connected-shared-wall-merge',
		covers: 'OR-1(d) + OR-1(h)',
		operation: {
			verdict: 'success',
			documentSha256: 'c74d1ae961d3b4331c46b1a904cdd7fafc3a57a7feb5303ea3829cea7bb251c8'
		},
		fidelity: true,
		counts: {
			faces: 3,
			predecessors: 4,
			pairs: 12,
			sameGroupPairs: 12,
			crossGroupPairs: 0,
			undefinedPairs: 0,
			insideEvaluations: 12,
			overlapEvaluations: 12
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face12:grid:h-0-1~F12:grid:v-1-1~F12:grid:h-0-2~R12:grid:v-0-1~R'
				],
				predecessorRoomIds: [
					'grid:room-0-1'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R'
				],
				predecessorRoomIds: [
					'grid:room-1-1'
				]
			},
			{
				candidateFaceKeys: [
					'7:4:face12:grid:h-0-0~F12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R12:grid:h-0-1~R12:grid:v-0-0~R'
				],
				predecessorRoomIds: [
					'grid:room-0-0',
					'grid:room-1-0'
				]
			}
		],
		faceKeys: [
			'5:4:face12:grid:h-0-1~F12:grid:v-1-1~F12:grid:h-0-2~R12:grid:v-0-1~R',
			'5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R',
			'7:4:face12:grid:h-0-0~F12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R12:grid:h-0-1~R12:grid:v-0-0~R'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face12:grid:h-0-1~F12:grid:v-1-1~F12:grid:h-0-2~R12:grid:v-0-1~R',
					roomId: 'grid:room-0-1',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R',
					roomId: 'grid:room-1-1',
					kind: 'preserved'
				},
				{
					faceKey: '7:4:face12:grid:h-0-0~F12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R12:grid:h-0-1~R12:grid:v-0-0~R',
					roomId: 'grid:room-1-0',
					kind: 'merge-survivor'
				}
			],
			retiredRoomIds: [
				'grid:room-0-0'
			],
			rooms: [
				{
					id: 'grid:room-0-1',
					name: 'Grid Room 0-1'
				},
				{
					id: 'grid:room-1-1',
					name: 'Grid Room 1-1'
				},
				{
					id: 'grid:room-1-0',
					name: 'Grid Room 1-0'
				}
			],
			documentSha256: 'c74d1ae961d3b4331c46b1a904cdd7fafc3a57a7feb5303ea3829cea7bb251c8'
		}
	},
	{
		id: 'd-connected-outer-wall-retire',
		covers: 'OR-1(d) + OR-1(h)',
		operation: {
			verdict: 'success',
			// SP1c carries the opened Space; the reconciliation-only reference below
			// stays on the pre-SP1c retirement contract (recorded exception).
			documentSha256: '36ddadd441dfce297617ba46ae0bfce07768722619de358a9fe3583b74dc333b'
		},
		fidelity: false,
		counts: {
			faces: 3,
			predecessors: 4,
			pairs: 12,
			sameGroupPairs: 12,
			crossGroupPairs: 0,
			undefinedPairs: 0,
			insideEvaluations: 12,
			overlapEvaluations: 12
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face12:grid:h-0-1~F12:grid:v-1-1~F12:grid:h-0-2~R12:grid:v-0-1~R'
				],
				predecessorRoomIds: [
					'grid:room-0-1'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R12:grid:v-1-0~R'
				],
				predecessorRoomIds: [
					'grid:room-1-0'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R'
				],
				predecessorRoomIds: [
					'grid:room-1-1'
				]
			}
		],
		faceKeys: [
			'5:4:face12:grid:h-0-1~F12:grid:v-1-1~F12:grid:h-0-2~R12:grid:v-0-1~R',
			'5:4:face12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R12:grid:v-1-0~R',
			'5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face12:grid:h-0-1~F12:grid:v-1-1~F12:grid:h-0-2~R12:grid:v-0-1~R',
					roomId: 'grid:room-0-1',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R12:grid:v-1-0~R',
					roomId: 'grid:room-1-0',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R',
					roomId: 'grid:room-1-1',
					kind: 'preserved'
				}
			],
			retiredRoomIds: [
				'grid:room-0-0'
			],
			rooms: [
				{
					id: 'grid:room-0-1',
					name: 'Grid Room 0-1'
				},
				{
					id: 'grid:room-1-0',
					name: 'Grid Room 1-0'
				},
				{
					id: 'grid:room-1-1',
					name: 'Grid Room 1-1'
				}
			],
			documentSha256: 'a7c930b5ae556b7f9b506140a31723ebdd045b1c80c0a55e4ed5d9878193414d'
		}
	},
	{
		id: 'd-straight-12-outer-wall-retire',
		covers: 'OR-1(d)',
		operation: {
			verdict: 'success',
			documentSha256: '4a78f54886b4a29d697718ea5e0318d3bd5342a88d814c0038b2fdde189428ba'
		},
		fidelity: false,
		counts: {
			faces: 2,
			predecessors: 3,
			pairs: 6,
			sameGroupPairs: 2,
			crossGroupPairs: 4,
			undefinedPairs: 0,
			insideEvaluations: 6,
			overlapEvaluations: 6
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F'
				],
				predecessorRoomIds: [
					'room-1'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F'
				],
				predecessorRoomIds: [
					'room-2'
				]
			}
		],
		faceKeys: [
			'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
			'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
					roomId: 'room-1',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
					roomId: 'room-2',
					kind: 'preserved'
				}
			],
			retiredRoomIds: [
				'room-0'
			],
			rooms: [
				{
					id: 'room-1',
					name: 'Room 1'
				},
				{
					id: 'room-2',
					name: 'Room 2'
				}
			],
			documentSha256: '9750f96fdc17fb506f26ba9738e4156a92bdc98194166254edf286d577912e73'
		}
	},
	{
		id: 'd-d12-remove-room-retire',
		covers: 'OR-1(d)',
		operation: {
			verdict: 'success',
			documentSha256: '0436d89e05f58c28b7c38154371e8283ff45ec713be4708748aa39ec61112d84'
		},
		fidelity: true,
		counts: {
			faces: 1,
			predecessors: 2,
			pairs: 2,
			sameGroupPairs: 1,
			crossGroupPairs: 0,
			undefinedPairs: 1,
			insideEvaluations: 2,
			overlapEvaluations: 2
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F'
				],
				predecessorRoomIds: [
					'room-k'
				]
			}
		],
		faceKeys: [
			'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F',
					roomId: 'room-k',
					kind: 'preserved'
				}
			],
			retiredRoomIds: [
				'room-c'
			],
			rooms: [
				{
					id: 'room-k',
					name: 'Room k'
				}
			],
			documentSha256: '0436d89e05f58c28b7c38154371e8283ff45ec713be4708748aa39ec61112d84'
		}
	},
	{
		id: 'e-exact-coincidence-chain-across',
		covers: 'OR-1(e)',
		operation: {
			verdict: 'success',
			documentSha256: '85251572250bceea656387b58edd4661c5380a53178c284ca7c7e937777a9c7e'
		},
		fidelity: true,
		counts: {
			faces: 2,
			predecessors: 2,
			pairs: 4,
			sameGroupPairs: 2,
			crossGroupPairs: 2,
			undefinedPairs: 0,
			insideEvaluations: 4,
			overlapEvaluations: 4
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face6:c-a1~F6:c-b1~F6:c-c1~F6:c-d1~F'
				],
				predecessorRoomIds: [
					'room-c'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F'
				],
				predecessorRoomIds: [
					'room-k'
				]
			}
		],
		faceKeys: [
			'5:4:face6:c-a1~F6:c-b1~F6:c-c1~F6:c-d1~F',
			'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face6:c-a1~F6:c-b1~F6:c-c1~F6:c-d1~F',
					roomId: 'room-c',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F',
					roomId: 'room-k',
					kind: 'preserved'
				}
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room-c',
					name: 'Room c'
				},
				{
					id: 'room-k',
					name: 'Room k'
				}
			],
			documentSha256: '85251572250bceea656387b58edd4661c5380a53178c284ca7c7e937777a9c7e'
		}
	},
	{
		id: 'e-full-containment-chain-across',
		covers: 'OR-1(e)',
		operation: {
			verdict: 'success',
			documentSha256: '85251572250bceea656387b58edd4661c5380a53178c284ca7c7e937777a9c7e'
		},
		fidelity: true,
		counts: {
			faces: 2,
			predecessors: 2,
			pairs: 4,
			sameGroupPairs: 2,
			crossGroupPairs: 2,
			undefinedPairs: 0,
			insideEvaluations: 4,
			overlapEvaluations: 4
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face6:c-a1~F6:c-b1~F6:c-c1~F6:c-d1~F'
				],
				predecessorRoomIds: [
					'room-c'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F'
				],
				predecessorRoomIds: [
					'room-k'
				]
			}
		],
		faceKeys: [
			'5:4:face6:c-a1~F6:c-b1~F6:c-c1~F6:c-d1~F',
			'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face6:c-a1~F6:c-b1~F6:c-c1~F6:c-d1~F',
					roomId: 'room-c',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F',
					roomId: 'room-k',
					kind: 'preserved'
				}
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room-c',
					name: 'Room c'
				},
				{
					id: 'room-k',
					name: 'Room k'
				}
			],
			documentSha256: '85251572250bceea656387b58edd4661c5380a53178c284ca7c7e937777a9c7e'
		}
	},
	{
		id: 'e-exact-coincidence-collinear-chain',
		covers: 'OR-1(e)',
		operation: {
			verdict: 'rejected',
			code: 'collinear_overlap'
		},
		fidelity: null,
		counts: {
			faces: 0,
			predecessors: 0,
			pairs: 0,
			sameGroupPairs: 0,
			crossGroupPairs: 0,
			undefinedPairs: 0,
			insideEvaluations: 0,
			overlapEvaluations: 0
		},
		components: [],
		faceKeys: [],
		reconciliation: {
			kind: 'not-run',
			reason: 'operation refused before the pass'
		}
	},
	{
		id: 'f-d12-exact-coincidence-role-change',
		covers: 'OR-1(f)',
		operation: {
			verdict: 'success',
			documentSha256: '7a3481ed82760f17c4fcf400304b6d0475de487d3bdcb799cc2cf84880b18e94'
		},
		fidelity: false,
		counts: {
			faces: 1,
			predecessors: 2,
			pairs: 2,
			sameGroupPairs: 1,
			crossGroupPairs: 1,
			undefinedPairs: 0,
			insideEvaluations: 2,
			overlapEvaluations: 2
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F'
				],
				predecessorRoomIds: [
					'room-k'
				]
			}
		],
		faceKeys: [
			'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F',
					roomId: 'room-k',
					kind: 'preserved'
				}
			],
			retiredRoomIds: [
				'room-c'
			],
			rooms: [
				{
					id: 'room-k',
					name: 'Room k'
				}
			],
			documentSha256: '0436d89e05f58c28b7c38154371e8283ff45ec713be4708748aa39ec61112d84'
		}
	},
	{
		id: 'f-d12-partial-overlap-role-change',
		covers: 'OR-1(f)',
		operation: {
			verdict: 'success',
			documentSha256: '0436d89e05f58c28b7c38154371e8283ff45ec713be4708748aa39ec61112d84'
		},
		fidelity: true,
		counts: {
			faces: 1,
			predecessors: 2,
			pairs: 2,
			sameGroupPairs: 1,
			crossGroupPairs: 1,
			undefinedPairs: 0,
			insideEvaluations: 2,
			overlapEvaluations: 2
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F'
				],
				predecessorRoomIds: [
					'room-k'
				]
			}
		],
		faceKeys: [
			'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F',
					roomId: 'room-k',
					kind: 'preserved'
				}
			],
			retiredRoomIds: [
				'room-c'
			],
			rooms: [
				{
					id: 'room-k',
					name: 'Room k'
				}
			],
			documentSha256: '0436d89e05f58c28b7c38154371e8283ff45ec713be4708748aa39ec61112d84'
		}
	},
	{
		id: 'f-d12-full-containment-role-change',
		covers: 'OR-1(f)',
		operation: {
			verdict: 'success',
			documentSha256: '7a3481ed82760f17c4fcf400304b6d0475de487d3bdcb799cc2cf84880b18e94'
		},
		fidelity: false,
		counts: {
			faces: 1,
			predecessors: 2,
			pairs: 2,
			sameGroupPairs: 1,
			crossGroupPairs: 1,
			undefinedPairs: 0,
			insideEvaluations: 2,
			overlapEvaluations: 2
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F'
				],
				predecessorRoomIds: [
					'room-k'
				]
			}
		],
		faceKeys: [
			'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F',
					roomId: 'room-k',
					kind: 'preserved'
				}
			],
			retiredRoomIds: [
				'room-c'
			],
			rooms: [
				{
					id: 'room-k',
					name: 'Room k'
				}
			],
			documentSha256: '0436d89e05f58c28b7c38154371e8283ff45ec713be4708748aa39ec61112d84'
		}
	},
	{
		id: 'f-d12-full-containment-mirror-role-change',
		covers: 'OR-1(f)',
		operation: {
			verdict: 'success',
			documentSha256: '51bfb757e21be0feb2a30e2720ecebd5f12d1f6f1a2cef11d31278ab7d71210b',
		},
		fidelity: false,
		counts: {
			faces: 1,
			predecessors: 2,
			pairs: 2,
			sameGroupPairs: 1,
			crossGroupPairs: 1,
			undefinedPairs: 0,
			insideEvaluations: 2,
			overlapEvaluations: 2,
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face6:c-a1~F6:c-b1~F6:c-c1~F6:c-d1~F',
				],
				predecessorRoomIds: [
					'room-c',
				],
			},
		],
		faceKeys: [
			'5:4:face6:c-a1~F6:c-b1~F6:c-c1~F6:c-d1~F',
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face6:c-a1~F6:c-b1~F6:c-c1~F6:c-d1~F',
					roomId: 'room-c',
					kind: 'preserved',
				},
			],
			retiredRoomIds: [
				'room-k',
			],
			rooms: [
				{
					id: 'room-c',
					name: 'Room c',
				},
			],
			documentSha256: 'dec8592675287bea24a6e43ed7e642092fc983c59804897ba8b1b888e8a82f96',
		},
	},
	{
		id: 'f-d12-whole-boundary-replacement',
		covers: 'OR-1(f)',
		operation: {
			verdict: 'not-run',
			reason: 'direct pass row: no planner operation',
		},
		fidelity: null,
		counts: {
			faces: 2,
			predecessors: 2,
			pairs: 4,
			sameGroupPairs: 1,
			crossGroupPairs: 1,
			undefinedPairs: 2,
			insideEvaluations: 4,
			overlapEvaluations: 4,
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face15:c-a1-replaced~F15:c-b1-replaced~F15:c-c1-replaced~F15:c-d1-replaced~F',
				],
				predecessorRoomIds: [],
			},
			{
				candidateFaceKeys: [
					'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F',
				],
				predecessorRoomIds: [
					'room-k',
				],
			},
		],
		faceKeys: [
			'5:4:face15:c-a1-replaced~F15:c-b1-replaced~F15:c-c1-replaced~F15:c-d1-replaced~F',
			'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F',
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face15:c-a1-replaced~F15:c-b1-replaced~F15:c-c1-replaced~F15:c-d1-replaced~F',
					roomId: 'room.5:4:face15:c-a1-replaced-F15:c-b1-replaced-F15:c-c1-replaced-F15:c-d1-replaced-F.p23b11-f-d12-whole-boundary-replacement',
					kind: 'created',
				},
				{
					faceKey: '5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F',
					roomId: 'room-k',
					kind: 'preserved',
				},
			],
			retiredRoomIds: [
				'room-c',
			],
			rooms: [
				{
					id: 'room.5:4:face15:c-a1-replaced-F15:c-b1-replaced-F15:c-c1-replaced-F15:c-d1-replaced-F.p23b11-f-d12-whole-boundary-replacement',
					name: 'Draft Room 1',
				},
				{
					id: 'room-k',
					name: 'Room k',
				},
			],
			documentSha256: '64d6bddb42cd60b6a8e198f01255381a0b6f5756a525b8d5b68aefd071560787',
		},
	},
	{
		id: 'g-empty-closed-chain',
		covers: 'OR-1(g)',
		operation: {
			verdict: 'success',
			documentSha256: '38ec58b70f27332bd1936d75ce9daee28caf972f7231f4ce715d59ece3da26f3',
		},
		fidelity: true,
		counts: {
			faces: 1,
			predecessors: 0,
			pairs: 0,
			sameGroupPairs: 0,
			crossGroupPairs: 0,
			undefinedPairs: 0,
			insideEvaluations: 0,
			overlapEvaluations: 0,
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face42:wall-chain-1.p23b11-g-empty-closed-chain~F42:wall-chain-2.p23b11-g-empty-closed-chain~F42:wall-chain-3.p23b11-g-empty-closed-chain~F42:wall-chain-4.p23b11-g-empty-closed-chain~F',
				],
				predecessorRoomIds: [],
			},
		],
		faceKeys: [
			'5:4:face42:wall-chain-1.p23b11-g-empty-closed-chain~F42:wall-chain-2.p23b11-g-empty-closed-chain~F42:wall-chain-3.p23b11-g-empty-closed-chain~F42:wall-chain-4.p23b11-g-empty-closed-chain~F',
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face42:wall-chain-1.p23b11-g-empty-closed-chain~F42:wall-chain-2.p23b11-g-empty-closed-chain~F42:wall-chain-3.p23b11-g-empty-closed-chain~F42:wall-chain-4.p23b11-g-empty-closed-chain~F',
					roomId: 'room.5:4:face42:wall-chain-1.p23b11-g-empty-closed-chain-F42:wall-chain-2.p23b11-g-empty-closed-chain-F42:wall-chain-3.p23b11-g-empty-closed-chain-F42:wall-chain-4.p23b11-g-empty-closed-chain-F.p23b11-g-empty-closed-chain',
					kind: 'created',
				},
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room.5:4:face42:wall-chain-1.p23b11-g-empty-closed-chain-F42:wall-chain-2.p23b11-g-empty-closed-chain-F42:wall-chain-3.p23b11-g-empty-closed-chain-F42:wall-chain-4.p23b11-g-empty-closed-chain-F.p23b11-g-empty-closed-chain',
					name: 'Draft Room 1',
				},
			],
			documentSha256: '38ec58b70f27332bd1936d75ce9daee28caf972f7231f4ce715d59ece3da26f3',
		},
	},
	{
		id: 'g-faces-only-clear-gap',
		covers: 'OR-1(g)',
		operation: {
			verdict: 'success',
			documentSha256: '3841bf93d2dba5db6be240df994a65fbec33e2e9a80bdad6703ff04407321ab0',
		},
		fidelity: true,
		counts: {
			faces: 1,
			predecessors: 0,
			pairs: 0,
			sameGroupPairs: 0,
			crossGroupPairs: 0,
			undefinedPairs: 0,
			insideEvaluations: 0,
			overlapEvaluations: 0,
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face5:f-1~F5:f-2~F5:f-3~F5:f-4~F',
				],
				predecessorRoomIds: [],
			},
		],
		faceKeys: [
			'5:4:face5:f-1~F5:f-2~F5:f-3~F5:f-4~F',
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face5:f-1~F5:f-2~F5:f-3~F5:f-4~F',
					roomId: 'room.5:4:face5:f-1-F5:f-2-F5:f-3-F5:f-4-F.p23b11-g-faces-only-clear-gap',
					kind: 'created',
				},
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room.5:4:face5:f-1-F5:f-2-F5:f-3-F5:f-4-F.p23b11-g-faces-only-clear-gap',
					name: 'Draft Room 1',
				},
			],
			documentSha256: '3841bf93d2dba5db6be240df994a65fbec33e2e9a80bdad6703ff04407321ab0',
		},
	},
	{
		id: 'h-connected-authoring-inside',
		covers: 'OR-1(h)',
		operation: {
			verdict: 'success',
			documentSha256: '49d9c9bf0309bac006e0046daf07508b2958a59fffe70040d1e74181e857819e'
		},
		fidelity: true,
		counts: {
			faces: 4,
			predecessors: 4,
			pairs: 16,
			sameGroupPairs: 16,
			crossGroupPairs: 0,
			undefinedPairs: 0,
			insideEvaluations: 16,
			overlapEvaluations: 16
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face12:grid:h-0-0~F12:grid:v-1-0~F12:grid:h-0-1~R12:grid:v-0-0~R'
				],
				predecessorRoomIds: [
					'grid:room-0-0'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face12:grid:h-0-1~F12:grid:v-1-1~F12:grid:h-0-2~R12:grid:v-0-1~R'
				],
				predecessorRoomIds: [
					'grid:room-0-1'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R12:grid:v-1-0~R'
				],
				predecessorRoomIds: [
					'grid:room-1-0'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R'
				],
				predecessorRoomIds: [
					'grid:room-1-1'
				]
			}
		],
		faceKeys: [
			'5:4:face12:grid:h-0-0~F12:grid:v-1-0~F12:grid:h-0-1~R12:grid:v-0-0~R',
			'5:4:face12:grid:h-0-1~F12:grid:v-1-1~F12:grid:h-0-2~R12:grid:v-0-1~R',
			'5:4:face12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R12:grid:v-1-0~R',
			'5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face12:grid:h-0-0~F12:grid:v-1-0~F12:grid:h-0-1~R12:grid:v-0-0~R',
					roomId: 'grid:room-0-0',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face12:grid:h-0-1~F12:grid:v-1-1~F12:grid:h-0-2~R12:grid:v-0-1~R',
					roomId: 'grid:room-0-1',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R12:grid:v-1-0~R',
					roomId: 'grid:room-1-0',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R',
					roomId: 'grid:room-1-1',
					kind: 'preserved'
				}
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'grid:room-0-0',
					name: 'Grid Room 0-0'
				},
				{
					id: 'grid:room-0-1',
					name: 'Grid Room 0-1'
				},
				{
					id: 'grid:room-1-0',
					name: 'Grid Room 1-0'
				},
				{
					id: 'grid:room-1-1',
					name: 'Grid Room 1-1'
				}
			],
			documentSha256: '49d9c9bf0309bac006e0046daf07508b2958a59fffe70040d1e74181e857819e'
		}
	},
	{
		id: 'h-connected-room-division',
		covers: 'OR-1(c) + OR-1(h)',
		operation: {
			verdict: 'success',
			documentSha256: 'a08dceec623d6b3d98c0d3f9e899964a49cb9528f407bab4f749e8cadb359747',
		},
		fidelity: true,
		counts: {
			faces: 5,
			predecessors: 4,
			pairs: 20,
			sameGroupPairs: 20,
			crossGroupPairs: 0,
			undefinedPairs: 0,
			insideEvaluations: 20,
			overlapEvaluations: 20,
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face12:grid:h-0-0~F12:grid:v-1-0~F47:wall-chain-1.p23b11-h-connected-room-division~R12:grid:v-0-0~R',
					'5:4:face12:grid:h-0-1~R47:grid:v-0-0-b.p23b11-h-connected-room-division~R47:wall-chain-1.p23b11-h-connected-room-division~F47:grid:v-1-0-b.p23b11-h-connected-room-division~F',
				],
				predecessorRoomIds: [
					'grid:room-0-0',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face12:grid:h-0-1~F12:grid:v-1-1~F12:grid:h-0-2~R12:grid:v-0-1~R',
				],
				predecessorRoomIds: [
					'grid:room-0-1',
				],
			},
			{
				candidateFaceKeys: [
					'5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R',
				],
				predecessorRoomIds: [
					'grid:room-1-1',
				],
			},
			{
				candidateFaceKeys: [
					'6:4:face12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R47:grid:v-1-0-b.p23b11-h-connected-room-division~R12:grid:v-1-0~R',
				],
				predecessorRoomIds: [
					'grid:room-1-0',
				],
			},
		],
		faceKeys: [
			'5:4:face12:grid:h-0-0~F12:grid:v-1-0~F47:wall-chain-1.p23b11-h-connected-room-division~R12:grid:v-0-0~R',
			'5:4:face12:grid:h-0-1~F12:grid:v-1-1~F12:grid:h-0-2~R12:grid:v-0-1~R',
			'5:4:face12:grid:h-0-1~R47:grid:v-0-0-b.p23b11-h-connected-room-division~R47:wall-chain-1.p23b11-h-connected-room-division~F47:grid:v-1-0-b.p23b11-h-connected-room-division~F',
			'5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R',
			'6:4:face12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R47:grid:v-1-0-b.p23b11-h-connected-room-division~R12:grid:v-1-0~R',
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face12:grid:h-0-1~R47:grid:v-0-0-b.p23b11-h-connected-room-division~R47:wall-chain-1.p23b11-h-connected-room-division~F47:grid:v-1-0-b.p23b11-h-connected-room-division~F',
					roomId: 'grid:room-0-0',
					kind: 'split-survivor',
				},
				{
					faceKey: '5:4:face12:grid:h-0-0~F12:grid:v-1-0~F47:wall-chain-1.p23b11-h-connected-room-division~R12:grid:v-0-0~R',
					roomId: 'room.5:4:face12:grid:h-0-0-F12:grid:v-1-0-F47:wall-chain-1.p23b11-h-connected-room-division-R12:grid:v-0-0-R.p23b11-h-connected-room-division',
					kind: 'created',
				},
				{
					faceKey: '5:4:face12:grid:h-0-1~F12:grid:v-1-1~F12:grid:h-0-2~R12:grid:v-0-1~R',
					roomId: 'grid:room-0-1',
					kind: 'preserved',
				},
				{
					faceKey: '5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R',
					roomId: 'grid:room-1-1',
					kind: 'preserved',
				},
				{
					faceKey: '6:4:face12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R47:grid:v-1-0-b.p23b11-h-connected-room-division~R12:grid:v-1-0~R',
					roomId: 'grid:room-1-0',
					kind: 'preserved',
				},
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'grid:room-0-0',
					name: 'Grid Room 0-0',
				},
				{
					id: 'room.5:4:face12:grid:h-0-0-F12:grid:v-1-0-F47:wall-chain-1.p23b11-h-connected-room-division-R12:grid:v-0-0-R.p23b11-h-connected-room-division',
					name: 'Draft Room 1',
				},
				{
					id: 'grid:room-0-1',
					name: 'Grid Room 0-1',
				},
				{
					id: 'grid:room-1-1',
					name: 'Grid Room 1-1',
				},
				{
					id: 'grid:room-1-0',
					name: 'Grid Room 1-0',
				},
			],
			documentSha256: 'a08dceec623d6b3d98c0d3f9e899964a49cb9528f407bab4f749e8cadb359747',
		},
	},
	{
		id: 'h-connected-shared-run-junction-move',
		covers: 'OR-1(h)',
		operation: {
			verdict: 'success',
			documentSha256: '642877ecfc417656d5c1ef35bfad816cba9d751bbe19061eb331cc27cc4942e2'
		},
		fidelity: null,
		counts: {
			faces: 0,
			predecessors: 0,
			pairs: 0,
			sameGroupPairs: 0,
			crossGroupPairs: 0,
			undefinedPairs: 0,
			insideEvaluations: 0,
			overlapEvaluations: 0
		},
		components: [],
		faceKeys: [],
		reconciliation: {
			kind: 'not-run',
			reason: 'operation-only row: this planner declares identity lineage and runs no geometric correspondence'
		}
	},
	{
		id: 'h-connected-corner-dissolve',
		covers: 'OR-1(h)',
		operation: {
			verdict: 'rejected',
			code: 'non_tangent_curved_pair'
		},
		fidelity: null,
		counts: {
			faces: 0,
			predecessors: 0,
			pairs: 0,
			sameGroupPairs: 0,
			crossGroupPairs: 0,
			undefinedPairs: 0,
			insideEvaluations: 0,
			overlapEvaluations: 0
		},
		components: [],
		faceKeys: [],
		reconciliation: {
			kind: 'not-run',
			reason: 'operation refused before the pass'
		}
	}
];
