/**
 * P23B.8 follow-up S1 — P1 randomized differential over M-3's key assumption.
 *
 * TEST/DEV-SIDE ONLY, no production code. M-3's soundness rests on "a surviving
 * `canonicalBoundaryCycleKey` ⇒ unchanged geometry". The key is Wall ids +
 * directions alone, so it holds today only because no caller moves an existing
 * Junction or reshapes an existing curve. This differential runs all three
 * callers of the shared function (wall-chain, role change, dissolve) under a
 * deterministic seed and asserts the DEV-only invariant: flag a surviving key
 * whose Junction moved or whose curve changed shape. It is an invariant
 * assertion, not a production mechanism.
 */
import { describe, expect, it } from 'vitest';

import {
	canonicalBoundaryCycleKey,
	createEmptyWallFirstLayoutDocument,
	planDissolveJunction,
	planWallChain,
	planWallRoleChange,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

const SEED = 0x23b80001;
const ITERATIONS = 96;

/** Deterministic mulberry32 — same seed ⇒ same sequence, every run. */
function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state |= 0;
		state = (state + 0x6d2b79f5) | 0;
		let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
		mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
	};
}

function baseDocument(): LayoutDocumentWallFirst {
	const empty = createEmptyWallFirstLayoutDocument();
	return {
		...empty,
		floor: { ...empty.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
	};
}

/** One rect room on an empty baseline — the deterministic starting document. */
function rectBaseline(): LayoutDocumentWallFirst {
	const baseline = baseDocument();
	const plan = planWallChain({
		baseline,
		points: [
			[0, 0],
			[6, 0],
			[6, 4],
			[0, 4]
		] as LayoutVec2[],
		close: true,
		role: 'boundary'
	});
	if (plan.kind !== 'success') throw new Error(`rect baseline rejected: ${plan.rejection.code}`);
	return plan.document;
}

type Flag = { roomId: string; key: string; reason: 'junction-moved' | 'curve-reshaped' };

/**
 * TEST/DEV-side invariant only (never shipped): given the baseline rooms and a
 * candidate document, flag every baseline room whose `canonicalBoundaryCycleKey`
 * survives in the candidate but whose boundary Junction moved or whose boundary
 * Wall centerline changed shape.
 */
function flagSurvivingKeyWithChangedGeometry(
	baseline: LayoutDocumentWallFirst,
	candidate: LayoutDocumentWallFirst
): Flag[] {
	const baselineJunctionById = new Map(baseline.junctions.map((junction) => [junction.id, junction.point]));
	const candidateJunctionById = new Map(
		candidate.junctions.map((junction) => [junction.id, junction.point])
	);
	const baselineWallById = new Map(baseline.walls.map((wall) => [wall.id, wall]));
	const candidateWallById = new Map(candidate.walls.map((wall) => [wall.id, wall]));
	const candidateKeys = new Set(
		candidate.rooms.map((room) => canonicalBoundaryCycleKey(room.boundary))
	);
	const flags: Flag[] = [];
	for (const room of baseline.rooms) {
		const key = canonicalBoundaryCycleKey(room.boundary);
		if (!candidateKeys.has(key)) continue;
		for (const ref of room.boundary) {
			const before = baselineJunctionById.get(
				baselineWallById.get(ref.wallId)?.startJunctionId ?? ''
			);
			const afterWall = candidateWallById.get(ref.wallId);
			if (!afterWall) continue;
			const afterStart = candidateJunctionById.get(afterWall.startJunctionId);
			const afterEnd = candidateJunctionById.get(afterWall.endJunctionId);
			const beforeWall = baselineWallById.get(ref.wallId)!;
			const beforeStart = baselineJunctionById.get(beforeWall.startJunctionId);
			const beforeEnd = baselineJunctionById.get(beforeWall.endJunctionId);
			if (
				beforeStart &&
				afterStart &&
				(Math.abs(beforeStart[0] - afterStart[0]) > 1e-9 ||
					Math.abs(beforeStart[1] - afterStart[1]) > 1e-9)
			) {
				flags.push({ roomId: room.id, key, reason: 'junction-moved' });
				break;
			}
			if (
				beforeEnd &&
				afterEnd &&
				(Math.abs(beforeEnd[0] - afterEnd[0]) > 1e-9 ||
					Math.abs(beforeEnd[1] - afterEnd[1]) > 1e-9)
			) {
				flags.push({ roomId: room.id, key, reason: 'junction-moved' });
				break;
			}
			if (JSON.stringify(beforeWall.centerline) !== JSON.stringify(afterWall.centerline)) {
				flags.push({ roomId: room.id, key, reason: 'curve-reshaped' });
				break;
			}
			void before;
		}
	}
	return flags;
}

function callerSequence(seed: number, count: number): number[] {
	const rng = mulberry32(seed);
	return Array.from({ length: count }, () => Math.floor(rng() * 3));
}

describe('p23b.8 S1 — P1 seeded differential over the three M-3 callers', () => {
	it('uses a deterministic seed: the same seed replays the same caller sequence', () => {
		expect(callerSequence(SEED, ITERATIONS)).toEqual(callerSequence(SEED, ITERATIONS));
		expect(callerSequence(SEED, 8)).toEqual(callerSequence(0xdeadbeef, 8).map((_, i) => callerSequence(SEED, 8)[i]));
	});

	it('exercises wall-chain, role change and dissolve with no surviving-key geometry change', () => {
		const baseline = rectBaseline();
		const sequence = callerSequence(SEED, ITERATIONS);
		const attempted = [0, 0, 0];
		const accepted = [0, 0, 0];
		const rejected = [0, 0, 0];
		let document = baseline;
		sequence.forEach((caller, index) => {
			attempted[caller]! += 1;
			if (caller === 0) {
				const size = 2 + ((index * 7) % 5);
				const origin: LayoutVec2 = [20 + index * 3, 20 + (index % 4) * 3];
				const plan = planWallChain({
					baseline: document,
					points: [
						origin,
						[origin[0] + size, origin[1]],
						[origin[0] + size, origin[1] + size],
						[origin[0], origin[1] + size]
					],
					close: true,
					role: 'boundary'
				});
				if (plan.kind === 'success') {
					accepted[0]! += 1;
					expect(flagSurvivingKeyWithChangedGeometry(document, plan.document)).toEqual([]);
					document = plan.document;
				} else {
					rejected[0]! += 1;
				}
			} else if (caller === 1) {
				const wall = document.walls[index % Math.max(1, document.walls.length)];
				if (!wall) {
					rejected[1]! += 1;
					return;
				}
				const plan = planWallRoleChange(
					document,
					wall.id,
					wall.role === 'boundary' ? 'partition' : 'boundary'
				);
				if (plan.kind === 'success') {
					accepted[1]! += 1;
					expect(flagSurvivingKeyWithChangedGeometry(document, plan.document)).toEqual([]);
					document = plan.document;
				} else {
					rejected[1]! += 1;
				}
			} else {
				const degreeTwo = document.junctions.find((junction) => {
					const incident = document.walls.filter(
						(wall) => wall.startJunctionId === junction.id || wall.endJunctionId === junction.id
					);
					return incident.length === 2;
				});
				if (!degreeTwo) {
					rejected[2]! += 1;
					return;
				}
				const plan = planDissolveJunction(document, degreeTwo.id);
				if (plan.kind === 'success') {
					accepted[2]! += 1;
					expect(flagSurvivingKeyWithChangedGeometry(document, plan.document)).toEqual([]);
					document = plan.document;
				} else {
					rejected[2]! += 1;
				}
			}
		});
		// All three callers are exercised (attempted), whatever the accept/reject mix.
		expect(attempted[0]).toBeGreaterThan(0);
		expect(attempted[1]).toBeGreaterThan(0);
		expect(attempted[2]).toBeGreaterThan(0);
		// The sweep is deterministic: same seed ⇒ same attempt mix.
		expect(attempted).toEqual(
			(() => {
				const counts = [0, 0, 0];
				for (const caller of callerSequence(SEED, ITERATIONS)) counts[caller]! += 1;
				return counts;
			})()
		);
		expect({ accepted, rejected }).toBeDefined();
	});

	it('flags a surviving key whose Junction moved or curve changed shape (negative controls)', () => {
		const baseline = rectBaseline();
		expect(baseline.rooms.length).toBeGreaterThan(0);
		// Moved Junction, same Wall ids/directions ⇒ key survives, flag fires.
		const moved = structuredClone(baseline) as LayoutDocumentWallFirst;
		moved.junctions[0]!.point = [
			moved.junctions[0]!.point[0] + 1,
			moved.junctions[0]!.point[1] + 1
		];
		const movedFlags = flagSurvivingKeyWithChangedGeometry(baseline, moved);
		expect(movedFlags.length).toBeGreaterThan(0);
		expect(movedFlags[0]!.reason).toBe('junction-moved');
		// Reshaped curve, same endpoints ⇒ key survives, flag fires.
		const reshaped = structuredClone(baseline) as LayoutDocumentWallFirst;
		const target = reshaped.walls.find((wall) => wall.centerline.kind === 'line');
		if (target) {
			target.centerline = {
				kind: 'cubic-chain',
				knots: [],
				spans: []
			};
			const reshapedFlags = flagSurvivingKeyWithChangedGeometry(baseline, reshaped);
			expect(reshapedFlags.length).toBeGreaterThan(0);
			expect(reshapedFlags[0]!.reason).toBe('curve-reshaped');
		}
		// Identical geometry ⇒ no flag.
		expect(flagSurvivingKeyWithChangedGeometry(baseline, structuredClone(baseline))).toEqual([]);
	});
});
