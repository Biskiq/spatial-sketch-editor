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
 * was removed once the freeze was written, and nothing regenerates this module.
 * Two consecutive generator runs produced byte-identical output before the file
 * was written, and the S2 freeze test was green on landing because it asserts
 * exactly this code. A future step that needs to move a row must change it as a
 * reviewable finding — never by re-running a generator over changed code.
 *
 * NO VALUE IN THIS MODULE MAY CHANGE. A change here silently moves what both the
 * freeze test and the differential treat as the reference. If a row has to move,
 * it is a finding about the LIVE behaviour and is recorded as one.
 */
import type { P23B11FrozenCase } from './p23b11-correspondence-cases';

/** Keyed by case id; the table order is the case table's order. */
export const P23B11_OR1_REFERENCE: readonly P23B11FrozenCase[] = [
	{
		id: 'a-straight-40-clear-gap',
		covers: 'OR-1(a)',
		operation: {
			verdict: 'success',
			documentSha256: '1d4ad1812e0b7789f3f255de754ebdf4234ddd778c3fa84deaea8e62ceb46d6d'
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
			documentSha256: '1d4ad1812e0b7789f3f255de754ebdf4234ddd778c3fa84deaea8e62ceb46d6d'
		}
	},
	{
		id: 'a-all-curved-40-clear-gap',
		covers: 'OR-1(a)',
		operation: {
			verdict: 'success',
			documentSha256: '1d4ad1812e0b7789f3f255de754ebdf4234ddd778c3fa84deaea8e62ceb46d6d'
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
			documentSha256: '1d4ad1812e0b7789f3f255de754ebdf4234ddd778c3fa84deaea8e62ceb46d6d'
		}
	},
	{
		id: 'a-owner-40-clear-gap',
		covers: 'OR-1(a)',
		operation: {
			verdict: 'success',
			documentSha256: '0a1023f2f6afee4e4d41ee1592c43e9d1ce08e87ae4e368fd569a3ca6a2d74a6'
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
					'5:4:face16:wall-chain-1.2~F16:wall-chain-1.3~F16:wall-chain-1.4~F14:wall-chain-1~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face19:wall-chain-1-copy~F21:wall-chain-1.2-copy~F21:wall-chain-1.3-copy~F21:wall-chain-1.4-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face24:wall-chain-1-copy-copy~F26:wall-chain-1.2-copy-copy~F26:wall-chain-1.3-copy-copy~F26:wall-chain-1.4-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face29:wall-chain-1-copy-copy-copy~F31:wall-chain-1.2-copy-copy-copy~F31:wall-chain-1.3-copy-copy-copy~F31:wall-chain-1.4-copy-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face34:wall-chain-1-copy-copy-copy-copy~F36:wall-chain-1.2-copy-copy-copy-copy~F36:wall-chain-1.3-copy-copy-copy-copy~F36:wall-chain-1.4-copy-copy-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face39:wall-chain-1-copy-copy-copy-copy-copy~F41:wall-chain-1.2-copy-copy-copy-copy-copy~F41:wall-chain-1.3-copy-copy-copy-copy-copy~F41:wall-chain-1.4-copy-copy-copy-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face44:wall-chain-1-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.2-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.3-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.4-copy-copy-copy-copy-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face49:wall-chain-1-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face54:wall-chain-1-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face59:wall-chain-1-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy-copy-copy'
				]
			}
		],
		faceKeys: [
			'5:4:face16:wall-chain-1.2~F16:wall-chain-1.3~F16:wall-chain-1.4~F14:wall-chain-1~F',
			'5:4:face19:wall-chain-1-copy~F21:wall-chain-1.2-copy~F21:wall-chain-1.3-copy~F21:wall-chain-1.4-copy~F',
			'5:4:face24:wall-chain-1-copy-copy~F26:wall-chain-1.2-copy-copy~F26:wall-chain-1.3-copy-copy~F26:wall-chain-1.4-copy-copy~F',
			'5:4:face29:wall-chain-1-copy-copy-copy~F31:wall-chain-1.2-copy-copy-copy~F31:wall-chain-1.3-copy-copy-copy~F31:wall-chain-1.4-copy-copy-copy~F',
			'5:4:face34:wall-chain-1-copy-copy-copy-copy~F36:wall-chain-1.2-copy-copy-copy-copy~F36:wall-chain-1.3-copy-copy-copy-copy~F36:wall-chain-1.4-copy-copy-copy-copy~F',
			'5:4:face39:wall-chain-1-copy-copy-copy-copy-copy~F41:wall-chain-1.2-copy-copy-copy-copy-copy~F41:wall-chain-1.3-copy-copy-copy-copy-copy~F41:wall-chain-1.4-copy-copy-copy-copy-copy~F',
			'5:4:face44:wall-chain-1-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.2-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.3-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.4-copy-copy-copy-copy-copy-copy~F',
			'5:4:face49:wall-chain-1-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy~F',
			'5:4:face54:wall-chain-1-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy-copy~F',
			'5:4:face59:wall-chain-1-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy-copy-copy~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face16:wall-chain-1.2~F16:wall-chain-1.3~F16:wall-chain-1.4~F14:wall-chain-1~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face19:wall-chain-1-copy~F21:wall-chain-1.2-copy~F21:wall-chain-1.3-copy~F21:wall-chain-1.4-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face24:wall-chain-1-copy-copy~F26:wall-chain-1.2-copy-copy~F26:wall-chain-1.3-copy-copy~F26:wall-chain-1.4-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face29:wall-chain-1-copy-copy-copy~F31:wall-chain-1.2-copy-copy-copy~F31:wall-chain-1.3-copy-copy-copy~F31:wall-chain-1.4-copy-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face34:wall-chain-1-copy-copy-copy-copy~F36:wall-chain-1.2-copy-copy-copy-copy~F36:wall-chain-1.3-copy-copy-copy-copy~F36:wall-chain-1.4-copy-copy-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face39:wall-chain-1-copy-copy-copy-copy-copy~F41:wall-chain-1.2-copy-copy-copy-copy-copy~F41:wall-chain-1.3-copy-copy-copy-copy-copy~F41:wall-chain-1.4-copy-copy-copy-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face44:wall-chain-1-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.2-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.3-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.4-copy-copy-copy-copy-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face49:wall-chain-1-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face54:wall-chain-1-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face59:wall-chain-1-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy-copy-copy',
					kind: 'preserved'
				}
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F',
					name: 'Draft Room 1'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy',
					name: 'Draft Room 1 copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy',
					name: 'Draft Room 1 copy copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy',
					name: 'Draft Room 1 copy copy copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy',
					name: 'Draft Room 1 copy copy copy copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy',
					name: 'Draft Room 1 copy copy copy copy copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy',
					name: 'Draft Room 1 copy copy copy copy copy copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy',
					name: 'Draft Room 1 copy copy copy copy copy copy copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy-copy',
					name: 'Draft Room 1 copy copy copy copy copy copy copy copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy-copy-copy',
					name: 'Draft Room 1 copy copy copy copy copy copy copy copy copy'
				}
			],
			documentSha256: '0a1023f2f6afee4e4d41ee1592c43e9d1ce08e87ae4e368fd569a3ca6a2d74a6'
		}
	},
	{
		id: 'b-straight-40-rect-room',
		covers: 'OR-1(b)',
		operation: {
			verdict: 'success',
			documentSha256: 'ca87c760853ac9d17ece89a6e0d8762642c5f65fd2e5022b34690da4b516d807'
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
			overlapEvaluations: 110
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face14:wall-chain-1~F14:wall-chain-2~F14:wall-chain-3~F14:wall-chain-4~F'
				],
				predecessorRoomIds: []
			},
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
			'5:4:face14:wall-chain-1~F14:wall-chain-2~F14:wall-chain-3~F14:wall-chain-4~F',
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
					faceKey: '5:4:face14:wall-chain-1~F14:wall-chain-2~F14:wall-chain-3~F14:wall-chain-4~F',
					roomId: 'room.5:4:face14:wall-chain-1-F14:wall-chain-2-F14:wall-chain-3-F14:wall-chain-4-F',
					kind: 'created'
				},
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
					id: 'room.5:4:face14:wall-chain-1-F14:wall-chain-2-F14:wall-chain-3-F14:wall-chain-4-F',
					name: 'Draft Room 1'
				},
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
			documentSha256: 'ca87c760853ac9d17ece89a6e0d8762642c5f65fd2e5022b34690da4b516d807'
		}
	},
	{
		id: 'b-all-curved-40-rect-room',
		covers: 'OR-1(b)',
		operation: {
			verdict: 'success',
			documentSha256: 'ca87c760853ac9d17ece89a6e0d8762642c5f65fd2e5022b34690da4b516d807'
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
			overlapEvaluations: 110
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face14:wall-chain-1~F14:wall-chain-2~F14:wall-chain-3~F14:wall-chain-4~F'
				],
				predecessorRoomIds: []
			},
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
			'5:4:face14:wall-chain-1~F14:wall-chain-2~F14:wall-chain-3~F14:wall-chain-4~F',
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
					faceKey: '5:4:face14:wall-chain-1~F14:wall-chain-2~F14:wall-chain-3~F14:wall-chain-4~F',
					roomId: 'room.5:4:face14:wall-chain-1-F14:wall-chain-2-F14:wall-chain-3-F14:wall-chain-4-F',
					kind: 'created'
				},
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
					id: 'room.5:4:face14:wall-chain-1-F14:wall-chain-2-F14:wall-chain-3-F14:wall-chain-4-F',
					name: 'Draft Room 1'
				},
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
			documentSha256: 'ca87c760853ac9d17ece89a6e0d8762642c5f65fd2e5022b34690da4b516d807'
		}
	},
	{
		id: 'b-owner-40-rect-room',
		covers: 'OR-1(b)',
		operation: {
			verdict: 'success',
			documentSha256: 'c4910f225870b29ef817d71f44ff63e20abc2f5957de4c03cbad6c8da767262b'
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
			overlapEvaluations: 110
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face16:wall-chain-1.2~F16:wall-chain-1.3~F16:wall-chain-1.4~F14:wall-chain-1~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face16:wall-chain-1.5~F14:wall-chain-2~F14:wall-chain-3~F14:wall-chain-4~F'
				],
				predecessorRoomIds: []
			},
			{
				candidateFaceKeys: [
					'5:4:face19:wall-chain-1-copy~F21:wall-chain-1.2-copy~F21:wall-chain-1.3-copy~F21:wall-chain-1.4-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face24:wall-chain-1-copy-copy~F26:wall-chain-1.2-copy-copy~F26:wall-chain-1.3-copy-copy~F26:wall-chain-1.4-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face29:wall-chain-1-copy-copy-copy~F31:wall-chain-1.2-copy-copy-copy~F31:wall-chain-1.3-copy-copy-copy~F31:wall-chain-1.4-copy-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face34:wall-chain-1-copy-copy-copy-copy~F36:wall-chain-1.2-copy-copy-copy-copy~F36:wall-chain-1.3-copy-copy-copy-copy~F36:wall-chain-1.4-copy-copy-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face39:wall-chain-1-copy-copy-copy-copy-copy~F41:wall-chain-1.2-copy-copy-copy-copy-copy~F41:wall-chain-1.3-copy-copy-copy-copy-copy~F41:wall-chain-1.4-copy-copy-copy-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face44:wall-chain-1-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.2-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.3-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.4-copy-copy-copy-copy-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face49:wall-chain-1-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face54:wall-chain-1-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy-copy'
				]
			},
			{
				candidateFaceKeys: [
					'5:4:face59:wall-chain-1-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy-copy-copy~F'
				],
				predecessorRoomIds: [
					'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy-copy-copy'
				]
			}
		],
		faceKeys: [
			'5:4:face16:wall-chain-1.2~F16:wall-chain-1.3~F16:wall-chain-1.4~F14:wall-chain-1~F',
			'5:4:face16:wall-chain-1.5~F14:wall-chain-2~F14:wall-chain-3~F14:wall-chain-4~F',
			'5:4:face19:wall-chain-1-copy~F21:wall-chain-1.2-copy~F21:wall-chain-1.3-copy~F21:wall-chain-1.4-copy~F',
			'5:4:face24:wall-chain-1-copy-copy~F26:wall-chain-1.2-copy-copy~F26:wall-chain-1.3-copy-copy~F26:wall-chain-1.4-copy-copy~F',
			'5:4:face29:wall-chain-1-copy-copy-copy~F31:wall-chain-1.2-copy-copy-copy~F31:wall-chain-1.3-copy-copy-copy~F31:wall-chain-1.4-copy-copy-copy~F',
			'5:4:face34:wall-chain-1-copy-copy-copy-copy~F36:wall-chain-1.2-copy-copy-copy-copy~F36:wall-chain-1.3-copy-copy-copy-copy~F36:wall-chain-1.4-copy-copy-copy-copy~F',
			'5:4:face39:wall-chain-1-copy-copy-copy-copy-copy~F41:wall-chain-1.2-copy-copy-copy-copy-copy~F41:wall-chain-1.3-copy-copy-copy-copy-copy~F41:wall-chain-1.4-copy-copy-copy-copy-copy~F',
			'5:4:face44:wall-chain-1-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.2-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.3-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.4-copy-copy-copy-copy-copy-copy~F',
			'5:4:face49:wall-chain-1-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy~F',
			'5:4:face54:wall-chain-1-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy-copy~F',
			'5:4:face59:wall-chain-1-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy-copy-copy~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face16:wall-chain-1.2~F16:wall-chain-1.3~F16:wall-chain-1.4~F14:wall-chain-1~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face16:wall-chain-1.5~F14:wall-chain-2~F14:wall-chain-3~F14:wall-chain-4~F',
					roomId: 'room.5:4:face16:wall-chain-1.5-F14:wall-chain-2-F14:wall-chain-3-F14:wall-chain-4-F',
					kind: 'created'
				},
				{
					faceKey: '5:4:face19:wall-chain-1-copy~F21:wall-chain-1.2-copy~F21:wall-chain-1.3-copy~F21:wall-chain-1.4-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face24:wall-chain-1-copy-copy~F26:wall-chain-1.2-copy-copy~F26:wall-chain-1.3-copy-copy~F26:wall-chain-1.4-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face29:wall-chain-1-copy-copy-copy~F31:wall-chain-1.2-copy-copy-copy~F31:wall-chain-1.3-copy-copy-copy~F31:wall-chain-1.4-copy-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face34:wall-chain-1-copy-copy-copy-copy~F36:wall-chain-1.2-copy-copy-copy-copy~F36:wall-chain-1.3-copy-copy-copy-copy~F36:wall-chain-1.4-copy-copy-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face39:wall-chain-1-copy-copy-copy-copy-copy~F41:wall-chain-1.2-copy-copy-copy-copy-copy~F41:wall-chain-1.3-copy-copy-copy-copy-copy~F41:wall-chain-1.4-copy-copy-copy-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face44:wall-chain-1-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.2-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.3-copy-copy-copy-copy-copy-copy~F46:wall-chain-1.4-copy-copy-copy-copy-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face49:wall-chain-1-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy~F51:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face54:wall-chain-1-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy-copy~F56:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy-copy',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face59:wall-chain-1-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.2-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.3-copy-copy-copy-copy-copy-copy-copy-copy-copy~F61:wall-chain-1.4-copy-copy-copy-copy-copy-copy-copy-copy-copy~F',
					roomId: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy-copy-copy',
					kind: 'preserved'
				}
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F',
					name: 'Draft Room 1'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.5-F14:wall-chain-2-F14:wall-chain-3-F14:wall-chain-4-F',
					name: 'Draft Room 2'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy',
					name: 'Draft Room 1 copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy',
					name: 'Draft Room 1 copy copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy',
					name: 'Draft Room 1 copy copy copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy',
					name: 'Draft Room 1 copy copy copy copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy',
					name: 'Draft Room 1 copy copy copy copy copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy',
					name: 'Draft Room 1 copy copy copy copy copy copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy',
					name: 'Draft Room 1 copy copy copy copy copy copy copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy-copy',
					name: 'Draft Room 1 copy copy copy copy copy copy copy copy'
				},
				{
					id: 'room.5:4:face16:wall-chain-1.2-F16:wall-chain-1.3-F16:wall-chain-1.4-F14:wall-chain-1-F-copy-copy-copy-copy-copy-copy-copy-copy-copy',
					name: 'Draft Room 1 copy copy copy copy copy copy copy copy copy'
				}
			],
			documentSha256: 'c4910f225870b29ef817d71f44ff63e20abc2f5957de4c03cbad6c8da767262b'
		}
	},
	{
		id: 'c-straight-12-room-division',
		covers: 'OR-1(c)',
		operation: {
			verdict: 'success',
			documentSha256: 'f10a145da5e261aedd0b063ffb1bc6729941a4d477593eda818e4fc5b0c0e49a'
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
			overlapEvaluations: 12
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F14:wall-chain-1~R17:room-0:wall-3-b~F',
					'5:4:face17:room-0:wall-1-b~F15:room-0:wall-2~F15:room-0:wall-3~F14:wall-chain-1~F'
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
			}
		],
		faceKeys: [
			'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F14:wall-chain-1~R17:room-0:wall-3-b~F',
			'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
			'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
			'5:4:face17:room-0:wall-1-b~F15:room-0:wall-2~F15:room-0:wall-3~F14:wall-chain-1~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face17:room-0:wall-1-b~F15:room-0:wall-2~F15:room-0:wall-3~F14:wall-chain-1~F',
					roomId: 'room-0',
					kind: 'split-survivor'
				},
				{
					faceKey: '5:4:face15:room-0:wall-0~F15:room-0:wall-1~F14:wall-chain-1~R17:room-0:wall-3-b~F',
					roomId: 'room.5:4:face15:room-0:wall-0-F15:room-0:wall-1-F14:wall-chain-1-R17:room-0:wall-3-b-F',
					kind: 'created'
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
				}
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room-0',
					name: 'Room 0'
				},
				{
					id: 'room.5:4:face15:room-0:wall-0-F15:room-0:wall-1-F14:wall-chain-1-R17:room-0:wall-3-b-F',
					name: 'Draft Room 1'
				},
				{
					id: 'room-1',
					name: 'Room 1'
				},
				{
					id: 'room-2',
					name: 'Room 2'
				}
			],
			documentSha256: 'f10a145da5e261aedd0b063ffb1bc6729941a4d477593eda818e4fc5b0c0e49a'
		}
	},
	{
		id: 'c-all-curved-12-room-division',
		covers: 'OR-1(c)',
		operation: {
			verdict: 'success',
			documentSha256: 'f10a145da5e261aedd0b063ffb1bc6729941a4d477593eda818e4fc5b0c0e49a'
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
			overlapEvaluations: 12
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F14:wall-chain-1~R17:room-0:wall-3-b~F',
					'5:4:face17:room-0:wall-1-b~F15:room-0:wall-2~F15:room-0:wall-3~F14:wall-chain-1~F'
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
			}
		],
		faceKeys: [
			'5:4:face15:room-0:wall-0~F15:room-0:wall-1~F14:wall-chain-1~R17:room-0:wall-3-b~F',
			'5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
			'5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
			'5:4:face17:room-0:wall-1-b~F15:room-0:wall-2~F15:room-0:wall-3~F14:wall-chain-1~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face17:room-0:wall-1-b~F15:room-0:wall-2~F15:room-0:wall-3~F14:wall-chain-1~F',
					roomId: 'room-0',
					kind: 'split-survivor'
				},
				{
					faceKey: '5:4:face15:room-0:wall-0~F15:room-0:wall-1~F14:wall-chain-1~R17:room-0:wall-3-b~F',
					roomId: 'room.5:4:face15:room-0:wall-0-F15:room-0:wall-1-F14:wall-chain-1-R17:room-0:wall-3-b-F',
					kind: 'created'
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
				}
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room-0',
					name: 'Room 0'
				},
				{
					id: 'room.5:4:face15:room-0:wall-0-F15:room-0:wall-1-F14:wall-chain-1-R17:room-0:wall-3-b-F',
					name: 'Draft Room 1'
				},
				{
					id: 'room-1',
					name: 'Room 1'
				},
				{
					id: 'room-2',
					name: 'Room 2'
				}
			],
			documentSha256: 'f10a145da5e261aedd0b063ffb1bc6729941a4d477593eda818e4fc5b0c0e49a'
		}
	},
	{
		id: 'd-connected-shared-wall-merge',
		covers: 'OR-1(d) + OR-1(h)',
		operation: {
			verdict: 'success',
			documentSha256: '8e9e2b6151197838775c8e4f0b607f91a01e83bf29ab0049be9a2860fcb4742a'
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
			documentSha256: '8e9e2b6151197838775c8e4f0b607f91a01e83bf29ab0049be9a2860fcb4742a'
		}
	},
	{
		id: 'd-connected-outer-wall-retire',
		covers: 'OR-1(d) + OR-1(h)',
		operation: {
			verdict: 'success',
			documentSha256: 'f18a15a707323e38aef6900aea315e01504d58dd73b4a04a1f700e36c9d14c9f'
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
			documentSha256: 'f18a15a707323e38aef6900aea315e01504d58dd73b4a04a1f700e36c9d14c9f'
		}
	},
	{
		id: 'd-straight-12-outer-wall-retire',
		covers: 'OR-1(d)',
		operation: {
			verdict: 'success',
			documentSha256: '5b83acbb0c339d6d40196085a7a46f6e8de314e0c83247b59d40daafa2ad7208'
		},
		fidelity: true,
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
			documentSha256: '5b83acbb0c339d6d40196085a7a46f6e8de314e0c83247b59d40daafa2ad7208'
		}
	},
	{
		id: 'd-d12-remove-room-retire',
		covers: 'OR-1(d)',
		operation: {
			verdict: 'success',
			documentSha256: '636d7943b02c400d7d04cc3ac335daea77662e3677931c7a9b821abdab494b7b'
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
			documentSha256: '636d7943b02c400d7d04cc3ac335daea77662e3677931c7a9b821abdab494b7b'
		}
	},
	{
		id: 'e-exact-coincidence-chain-across',
		covers: 'OR-1(e)',
		operation: {
			verdict: 'success',
			documentSha256: 'cfc9197e99adbebf10f04919efe7fbf36115dba9478115f747c53208c0757456'
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
			documentSha256: 'cfc9197e99adbebf10f04919efe7fbf36115dba9478115f747c53208c0757456'
		}
	},
	{
		id: 'e-full-containment-chain-across',
		covers: 'OR-1(e)',
		operation: {
			verdict: 'success',
			documentSha256: 'cfc9197e99adbebf10f04919efe7fbf36115dba9478115f747c53208c0757456'
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
			documentSha256: 'cfc9197e99adbebf10f04919efe7fbf36115dba9478115f747c53208c0757456'
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
			documentSha256: '636d7943b02c400d7d04cc3ac335daea77662e3677931c7a9b821abdab494b7b'
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
			documentSha256: '636d7943b02c400d7d04cc3ac335daea77662e3677931c7a9b821abdab494b7b'
		}
	},
	{
		id: 'f-d12-partial-overlap-role-change',
		covers: 'OR-1(f)',
		operation: {
			verdict: 'success',
			documentSha256: '636d7943b02c400d7d04cc3ac335daea77662e3677931c7a9b821abdab494b7b'
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
			documentSha256: '636d7943b02c400d7d04cc3ac335daea77662e3677931c7a9b821abdab494b7b'
		}
	},
	{
		id: 'f-d12-full-containment-role-change',
		covers: 'OR-1(f)',
		operation: {
			verdict: 'success',
			documentSha256: '636d7943b02c400d7d04cc3ac335daea77662e3677931c7a9b821abdab494b7b'
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
			documentSha256: '636d7943b02c400d7d04cc3ac335daea77662e3677931c7a9b821abdab494b7b'
		}
	},
	{
		id: 'f-d12-full-containment-mirror-role-change',
		covers: 'OR-1(f)',
		operation: {
			verdict: 'success',
			documentSha256: '6f99981c6212e726c16991a3d2d4287b3ede302e0660cbad86a33e9d905dd3dc'
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
					'5:4:face6:c-a1~F6:c-b1~F6:c-c1~F6:c-d1~F'
				],
				predecessorRoomIds: [
					'room-c'
				]
			}
		],
		faceKeys: [
			'5:4:face6:c-a1~F6:c-b1~F6:c-c1~F6:c-d1~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face6:c-a1~F6:c-b1~F6:c-c1~F6:c-d1~F',
					roomId: 'room-c',
					kind: 'preserved'
				}
			],
			retiredRoomIds: [
				'room-k'
			],
			rooms: [
				{
					id: 'room-c',
					name: 'Room c'
				}
			],
			documentSha256: '6f99981c6212e726c16991a3d2d4287b3ede302e0660cbad86a33e9d905dd3dc'
		}
	},
	{
		id: 'f-d12-whole-boundary-replacement',
		covers: 'OR-1(f)',
		operation: {
			verdict: 'not-run',
			reason: 'direct pass row: no planner operation'
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
			overlapEvaluations: 4
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face15:c-a1-replaced~F15:c-b1-replaced~F15:c-c1-replaced~F15:c-d1-replaced~F'
				],
				predecessorRoomIds: []
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
			'5:4:face15:c-a1-replaced~F15:c-b1-replaced~F15:c-c1-replaced~F15:c-d1-replaced~F',
			'5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face15:c-a1-replaced~F15:c-b1-replaced~F15:c-c1-replaced~F15:c-d1-replaced~F',
					roomId: 'room.5:4:face15:c-a1-replaced-F15:c-b1-replaced-F15:c-c1-replaced-F15:c-d1-replaced-F',
					kind: 'created'
				},
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
					id: 'room.5:4:face15:c-a1-replaced-F15:c-b1-replaced-F15:c-c1-replaced-F15:c-d1-replaced-F',
					name: 'Draft Room 1'
				},
				{
					id: 'room-k',
					name: 'Room k'
				}
			],
			documentSha256: '1e46a18ccc756c122a3ed54e6d9768da291f334b497b6c47b33b0d8f4e6cedf9'
		}
	},
	{
		id: 'g-empty-closed-chain',
		covers: 'OR-1(g)',
		operation: {
			verdict: 'success',
			documentSha256: '1a9bb719c3de6d5c51f731f67822cf4081f5b6e84b46c3c5ec0aadbf36154175'
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
			overlapEvaluations: 0
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face14:wall-chain-1~F14:wall-chain-2~F14:wall-chain-3~F14:wall-chain-4~F'
				],
				predecessorRoomIds: []
			}
		],
		faceKeys: [
			'5:4:face14:wall-chain-1~F14:wall-chain-2~F14:wall-chain-3~F14:wall-chain-4~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face14:wall-chain-1~F14:wall-chain-2~F14:wall-chain-3~F14:wall-chain-4~F',
					roomId: 'room.5:4:face14:wall-chain-1-F14:wall-chain-2-F14:wall-chain-3-F14:wall-chain-4-F',
					kind: 'created'
				}
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room.5:4:face14:wall-chain-1-F14:wall-chain-2-F14:wall-chain-3-F14:wall-chain-4-F',
					name: 'Draft Room 1'
				}
			],
			documentSha256: '1a9bb719c3de6d5c51f731f67822cf4081f5b6e84b46c3c5ec0aadbf36154175'
		}
	},
	{
		id: 'g-faces-only-clear-gap',
		covers: 'OR-1(g)',
		operation: {
			verdict: 'success',
			documentSha256: '5ab24c1ca0b2c7f55195195bdd774b4e892d5c44f7c7011ca6cb243b4696e98f'
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
			overlapEvaluations: 0
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face5:f-1~F5:f-2~F5:f-3~F5:f-4~F'
				],
				predecessorRoomIds: []
			}
		],
		faceKeys: [
			'5:4:face5:f-1~F5:f-2~F5:f-3~F5:f-4~F'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face5:f-1~F5:f-2~F5:f-3~F5:f-4~F',
					roomId: 'room.5:4:face5:f-1-F5:f-2-F5:f-3-F5:f-4-F',
					kind: 'created'
				}
			],
			retiredRoomIds: [],
			rooms: [
				{
					id: 'room.5:4:face5:f-1-F5:f-2-F5:f-3-F5:f-4-F',
					name: 'Draft Room 1'
				}
			],
			documentSha256: '5ab24c1ca0b2c7f55195195bdd774b4e892d5c44f7c7011ca6cb243b4696e98f'
		}
	},
	{
		id: 'h-connected-authoring-inside',
		covers: 'OR-1(h)',
		operation: {
			verdict: 'success',
			documentSha256: '283ee6f29bb8af35284438f32ee3e6785a35af388b3049ff82aedf3bb68081bf'
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
			documentSha256: '283ee6f29bb8af35284438f32ee3e6785a35af388b3049ff82aedf3bb68081bf'
		}
	},
	{
		id: 'h-connected-room-division',
		covers: 'OR-1(c) + OR-1(h)',
		operation: {
			verdict: 'success',
			documentSha256: 'f7f767838a08696388cd0bc6963957708401964bd9cf2c82ec834d90bdcf6155'
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
			overlapEvaluations: 20
		},
		components: [
			{
				candidateFaceKeys: [
					'5:4:face12:grid:h-0-0~F12:grid:v-1-0~F14:wall-chain-1~R12:grid:v-0-0~R',
					'5:4:face12:grid:h-0-1~R14:grid:v-0-0-b~R14:wall-chain-1~F14:grid:v-1-0-b~F'
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
					'5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R'
				],
				predecessorRoomIds: [
					'grid:room-1-1'
				]
			},
			{
				candidateFaceKeys: [
					'6:4:face12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R14:grid:v-1-0-b~R12:grid:v-1-0~R'
				],
				predecessorRoomIds: [
					'grid:room-1-0'
				]
			}
		],
		faceKeys: [
			'5:4:face12:grid:h-0-0~F12:grid:v-1-0~F14:wall-chain-1~R12:grid:v-0-0~R',
			'5:4:face12:grid:h-0-1~F12:grid:v-1-1~F12:grid:h-0-2~R12:grid:v-0-1~R',
			'5:4:face12:grid:h-0-1~R14:grid:v-0-0-b~R14:wall-chain-1~F14:grid:v-1-0-b~F',
			'5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R',
			'6:4:face12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R14:grid:v-1-0-b~R12:grid:v-1-0~R'
		],
		reconciliation: {
			kind: 'ok',
			lineage: [
				{
					faceKey: '5:4:face12:grid:h-0-1~R14:grid:v-0-0-b~R14:wall-chain-1~F14:grid:v-1-0-b~F',
					roomId: 'grid:room-0-0',
					kind: 'split-survivor'
				},
				{
					faceKey: '5:4:face12:grid:h-0-0~F12:grid:v-1-0~F14:wall-chain-1~R12:grid:v-0-0~R',
					roomId: 'room.5:4:face12:grid:h-0-0-F12:grid:v-1-0-F14:wall-chain-1-R12:grid:v-0-0-R',
					kind: 'created'
				},
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
					faceKey: '6:4:face12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R14:grid:v-1-0-b~R12:grid:v-1-0~R',
					roomId: 'grid:room-1-0',
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
					id: 'room.5:4:face12:grid:h-0-0-F12:grid:v-1-0-F14:wall-chain-1-R12:grid:v-0-0-R',
					name: 'Draft Room 1'
				},
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
			documentSha256: 'f7f767838a08696388cd0bc6963957708401964bd9cf2c82ec834d90bdcf6155'
		}
	},
	{
		id: 'h-connected-shared-run-junction-move',
		covers: 'OR-1(h)',
		operation: {
			verdict: 'success',
			documentSha256: 'b3b97ff29603292f187968e9af5cfc9e3ba3471bfaf30a96c384aa0e3074e34c'
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
	}
];
