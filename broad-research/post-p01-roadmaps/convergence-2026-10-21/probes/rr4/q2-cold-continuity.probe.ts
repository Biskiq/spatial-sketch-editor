/**
 * RR-4 Q2 — evaluated (B) versus rebased (C) cold continuity (disposable).
 *
 * Edit chain on owner planners: move → split → dissolve with a reversed survivor
 * → a later move, then JSON round trip and a fresh evaluation. Strategies:
 *   B-mig  evaluated attachment; bindings migrated atomically only when a host is retired/split
 *   B-lin  evaluated attachment; bindings never rewritten; Layout persists lineage records
 *   C-pose world pose stored; rewritten whenever it changes (optionally with an A1 provenance binding)
 * (ii) stable owner component identity has no provider and is recorded as blocked.
 */
import { describe, expect, it } from 'vitest';
import {
	JUNCTION_COINCIDENCE_EPSILON,
	planDissolveJunction,
	planRigidWallMove,
	planWallSplit,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import {
	arcLength,
	emptyDoc,
	evaluate,
	lineWall,
	occupancyAllocator,
	residual,
	transportDissolve,
	transportSplit,
	wallOf,
	type Binding,
	type Pose
} from './rr4-support';

const log = (label: string, value: unknown) => console.log(`RR4 Q2 ${label} ${JSON.stringify(value)}`);
const bytes = (value: unknown) => JSON.stringify(value).length;

type Lineage =
	| { op: 'split'; wall: string; created: string; d: number }
	| { op: 'dissolve'; survivor: string; retired: string; survivorForward: boolean; otherForward: boolean; survivorLength: number; otherLength: number };

function base(): { doc: LayoutDocumentWallFirst; bindings: Binding[] } {
	const doc = emptyDoc({ X: [4, 0], A: [0, 0], B: [8, 0] }, [lineWall('P', 'X', 'A'), lineWall('Q', 'X', 'B')]);
	const mk = (id: string, hostWallId: string, s: number, side: 'left' | 'right'): Binding => ({ id, hostWallId, s, side, width: 0.6, standoff: 0.02 });
	return { doc, bindings: [mk('p1', 'P', 1, 'left'), mk('p3', 'P', 3, 'right'), mk('q1', 'Q', 0.8, 'right'), mk('q2', 'Q', 2.0, 'left')] };
}

function must<T extends { kind: string }>(plan: T): Extract<T, { kind: 'success' }> {
	if (plan.kind !== 'success') throw new Error(JSON.stringify(plan));
	return plan as Extract<T, { kind: 'success' }>;
}

/** B-lin cold resolver: fold one stored binding through persisted lineage. Counts steps. */
function resolveThroughLineage(binding: Binding, lineage: readonly Lineage[]): { binding: Binding; steps: number } | { unresolved: string } {
	let current = binding;
	let steps = 0;
	for (const record of lineage) {
		steps += 1;
		if (record.op === 'split' && current.hostWallId === record.wall) {
			const lo = current.s - current.width / 2;
			const hi = current.s + current.width / 2;
			if (lo >= record.d) current = { ...current, hostWallId: record.created, s: current.s - record.d };
			else if (hi > record.d) return { unresolved: 'straddles-split' };
		} else if (record.op === 'dissolve' && (current.hostWallId === record.survivor || current.hostWallId === record.retired)) {
			const onSurvivor = current.hostWallId === record.survivor;
			const start = onSurvivor ? 0 : record.survivorLength;
			const length = onSurvivor ? record.survivorLength : record.otherLength;
			const forward = onSurvivor ? record.survivorForward : record.otherForward;
			current = {
				...current,
				hostWallId: record.survivor,
				s: forward ? start + current.s : start + length - current.s,
				side: forward ? current.side : current.side === 'left' ? 'right' : 'left'
			};
		}
	}
	return { binding: current, steps };
}

describe('RR-4 Q2 cold continuity', () => {
	it('B-mig, B-lin and C-pose agree on poses; differ in rewrites, bytes and retained intent', () => {
		const { doc: d0, bindings: b0 } = base();
		const ledger: Record<string, unknown>[] = [];
		const poses = (doc: LayoutDocumentWallFirst, bindings: readonly Binding[]) => bindings.map((binding) => evaluate(doc, binding)!);
		const changed = (a: readonly Pose[], b: readonly Pose[]) => a.filter((pose, index) => residual(pose, b[index]!).position > JUNCTION_COINCIDENCE_EPSILON).length;

		// E1 rigid move of P: shape edit; Q's start Junction moves with it.
		const d1 = must(planRigidWallMove(d0, 'P', [1, 0])).document;
		const e1 = { bMigRewrites: 0, bLinRecords: 0, cPoseRewrites: changed(poses(d0, b0), poses(d1, b0)) };

		// E2 split Q at 1.5: topology edit, shape preserving.
		const s2 = must(planWallSplit(d1, 'Q', 1.5, occupancyAllocator));
		const d2 = s2.document;
		const b2 = b0.map((binding) => {
			const moved = transportSplit(d2, 'Q', s2.createdWallIds[0]!, binding);
			if (moved.kind !== 'transported') throw new Error('review');
			return moved.binding;
		});
		const lineage: Lineage[] = [{ op: 'split', wall: 'Q', created: s2.createdWallIds[0]!, d: arcLength(d2, 'Q') }];
		const e2 = { bMigRewrites: b2.filter((binding, index) => binding !== b0[index]).length, bLinRecordBytes: bytes(lineage[0]), cPoseRewrites: changed(poses(d1, b0), poses(d2, b2)) };

		// E3 dissolve X: P and Q both start at X, so the survivor P is reversed.
		const junctionX = wallOf(d2, 'P')!.startJunctionId;
		const s3 = must(planDissolveJunction(d2, junctionX));
		const d3 = s3.document;
		const b3 = b2.map((binding) => {
			const moved = transportDissolve(d2, d3, s3, binding);
			if (moved.kind !== 'transported') throw new Error('review');
			return moved.binding;
		});
		const survivorBefore = wallOf(d2, s3.survivorWallId)!;
		const otherBefore = wallOf(d2, s3.retiredWallId)!;
		const dissolveRecord: Lineage = {
			op: 'dissolve',
			survivor: s3.survivorWallId,
			retired: s3.retiredWallId,
			survivorForward: survivorBefore.startJunctionId === wallOf(d3, s3.survivorWallId)!.startJunctionId,
			otherForward: otherBefore.startJunctionId === s3.retiredJunctionId,
			survivorLength: arcLength(d2, s3.survivorWallId),
			otherLength: arcLength(d2, s3.retiredWallId)
		};
		lineage.push(dissolveRecord);
		const e3 = { survivor: s3.survivorWallId, survivorForward: dissolveRecord.survivorForward, bMigRewrites: b3.filter((binding, index) => binding !== b2[index]).length, bLinRecordBytes: bytes(dissolveRecord), cPoseRewrites: changed(poses(d2, b2), poses(d3, b3)) };

		// E4 later rigid move of the joined Wall: following needs retained intent.
		const d4 = must(planRigidWallMove(d3, s3.survivorWallId, [0, 1])).document;
		const following = poses(d4, b3);
		const cWithoutIntent = poses(d3, b3); // C-pose that dropped intent: poses stay where they were
		const e4 = { bMigRewrites: 0, cPoseWithProvenanceRewrites: changed(cWithoutIntent, following), cPoseWithoutIntentLeftBehind: changed(cWithoutIntent, following) };

		// Persisted shapes after E4 and a cold JSON round trip.
		const persisted = {
			bMig: JSON.parse(JSON.stringify({ layout: d4, scene: b3 })),
			bLin: JSON.parse(JSON.stringify({ layout: d4, lineage, scene: b0 })),
			cPose: JSON.parse(JSON.stringify({ layout: d4, scene: following })),
			cPoseA1: JSON.parse(JSON.stringify({ layout: d4, scene: following.map((pose, index) => ({ pose, provenance: b3[index] })) }))
		};
		const coldBMig = (persisted.bMig.scene as Binding[]).map((binding) => evaluate(persisted.bMig.layout, binding)!);
		const coldBLin = (persisted.bLin.scene as Binding[]).map((binding) => {
			const resolved = resolveThroughLineage(binding, persisted.bLin.lineage);
			if ('unresolved' in resolved) throw new Error(resolved.unresolved);
			return { pose: evaluate(persisted.bLin.layout, resolved.binding)!, steps: resolved.steps };
		});
		const coldC = persisted.cPose.scene as Pose[];
		const agreeBLin = Math.max(...coldBLin.map((entry, index) => residual(entry.pose, coldBMig[index]!).position));
		const agreeC = Math.max(...coldC.map((pose, index) => residual(pose, coldBMig[index]!).position));
		const sceneBytes = {
			bMig: bytes(persisted.bMig.scene),
			bLinScene: bytes(persisted.bLin.scene),
			bLinLineage: bytes(persisted.bLin.lineage),
			cPose: bytes(persisted.cPose.scene),
			cPoseA1: bytes(persisted.cPoseA1.scene)
		};
		// B-lin compaction: a record is droppable only when no stored binding still names a pre-record ID.
		const stillNamed = (persisted.bLin.scene as Binding[]).filter((binding) => binding.hostWallId === 'Q' || binding.hostWallId === 'P').length;
		ledger.push({ e1, e2, e3, e4, sceneBytes, agreeBLin, agreeC, bLinStepsPerBinding: coldBLin.map((entry) => entry.steps), bLinCompactableRecords: stillNamed === 0 ? lineage.length : 0, finalBMig: persisted.bMig.scene });
		log('ledger', ledger[0]);

		expect(agreeBLin).toBeLessThanOrEqual(JUNCTION_COINCIDENCE_EPSILON);
		expect(agreeC).toBeLessThanOrEqual(JUNCTION_COINCIDENCE_EPSILON);
		expect(e3.survivorForward).toBe(false);
		// A cold fresh evaluator reproduces the in-session result exactly.
		expect(Math.max(...coldBMig.map((pose, index) => residual(pose, following[index]!).position))).toBe(0);
	});
});
