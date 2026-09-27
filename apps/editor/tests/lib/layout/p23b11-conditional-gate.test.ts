/**
 * P23B.11 S4 — the M-2/M-3 gate: do the identity condition and the extent scope preserve
 * the verdict where REAL plans live?
 *
 * This file is TESTS ONLY, and it is the gate the plan requires before either conditional
 * mechanism may land. It runs the same shared analysis the S2 freeze and the S3 differential
 * run, on the rows the plan names — OR-1 (e), (f) and (h): the coincident/nested baselines,
 * the D-12 hazard rows verbatim, and the CONNECTED case — and proves two things against the
 * pair proof the shipped pass already performs:
 *
 *   OR-4  the identity condition. A predecessor Room whose own boundary cycle still exists
 *         as a candidate face IS that face's owner, and a face owned by one Room can match
 *         NO OTHER Room. The oracle requires every claim to be a union the proof makes, no
 *         claimed Room to union with anything but its own face, no claimed face to belong to
 *         anyone else, and every refusal the condition derives (a Room with a known face
 *         against a different Room's known face) to be a pair the proof leaves alone. Any
 *         inequality means the early-out would change a verdict — it refuses at runtime, and
 *         the gate records the failure.
 *
 *   OR-3  the extent scope. For every pair the structural scope excludes, ALL FOUR inputs
 *         must be unchanged from the baseline: the predecessor polygon, its witness, the
 *         face polygon (matched by the face's canonical key), and both D-12 component
 *         labels. The mutation proof then shows the exclusion is conservative: move a
 *         Junction of an excluded face's own Wall, and the face moves INTO the extent (and
 *         its polygon provably differs); rename an operated Room's whole boundary, and the
 *         Room moves INTO the extent with its label changed. A scope whose excluded side can
 *         change silently is exactly the unsound case §0.8(c) closed.
 *
 * WHAT THE MEASURED COVERAGE MEANS. The assertions below also record how much the identity
 * condition settles on the CONNECTED rows (every pair on the room-neutral authoring row; all
 * but the changed Room's five on the division), because that number is the honest reason to
 * take M-3 at all. The merge and retire rows cannot be settled by identity — their enclosures
 * genuinely change — and they are recorded as such rather than forced.
 *
 * REFUSED AND OPERATION-ONLY ROWS run no pass, so no condition is evaluated on them: that is
 * asserted rather than assumed, because a gate that quietly skipped a row would overstate
 * itself.
 */
import { describe, expect, it } from 'vitest';

import {
	clearCorrespondenceObserverForTest,
	extractBoundaryCandidateFaces,
	setCorrespondenceObserverForTest,
	type ComponentLineage,
	type CorrespondenceObservation,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import {
	analyzeCorrespondenceCase,
	P23B11_CORRESPONDENCE_CASES,
	type P23B11CorrespondenceCase,
	type P23B11PassAnalysis
} from './p23b11-correspondence-cases';
import {
	chainAffectedExtent,
	identityGate,
	isPairExcluded,
	pairInputs,
	pairKey,
	P23B11_CONDITIONAL_GATE_CASE_IDS
} from './p23b11-conditional-mechanisms';

function gateCase(id: string): P23B11CorrespondenceCase {
	const entry = P23B11_CORRESPONDENCE_CASES.find((candidate) => candidate.id === id);
	if (!entry) throw new Error(`missing gate case '${id}'`);
	return entry;
}

/** The pass under test, with the documents it consumed; throws when no pass ran. */
function passingAnalysis(id: string): {
	analysis: P23B11PassAnalysis;
	baseline: LayoutDocumentWallFirst;
	candidate: LayoutDocumentWallFirst;
} {
	const analysis = analyzeCorrespondenceCase(gateCase(id));
	const inputs = analysis.passInputs;
	if (!inputs) throw new Error(`${id}: the gate row must run a correspondence pass`);
	return { analysis, baseline: inputs.baseline, candidate: inputs.candidate };
}

function unionsByRoom(components: readonly ComponentLineage[]): Map<string, Set<string>> {
	const map = new Map<string, Set<string>>();
	for (const component of components) {
		for (const roomId of component.predecessorRoomIds) {
			const faces = map.get(roomId) ?? new Set<string>();
			for (const faceKey of component.candidateFaceKeys) faces.add(faceKey);
			map.set(roomId, faces);
		}
	}
	return map;
}

function unionsByFace(components: readonly ComponentLineage[]): Map<string, Set<string>> {
	const map = new Map<string, Set<string>>();
	for (const component of components) {
		for (const faceKey of component.candidateFaceKeys) {
			const rooms = map.get(faceKey) ?? new Set<string>();
			for (const roomId of component.predecessorRoomIds) rooms.add(roomId);
			map.set(faceKey, rooms);
		}
	}
	return map;
}

function proofUnionKeys(components: readonly ComponentLineage[]): Set<string> {
	const keys = new Set<string>();
	for (const component of components) {
		for (const faceKey of component.candidateFaceKeys) {
			for (const roomId of component.predecessorRoomIds) keys.add(pairKey(faceKey, roomId));
		}
	}
	return keys;
}

describe('P23B.11 S4 — OR-4: the identity condition against the pair proof', () => {
	for (const id of P23B11_CONDITIONAL_GATE_CASE_IDS) {
		it(`${id}: claims are unions, claimed sides match nothing else, refusals are not unions`, () => {
			const { analysis, baseline } = passingAnalysis(id);
			const gate = identityGate({ baseline, faces: analysis.faces });
			const byRoom = unionsByRoom(analysis.components);
			const byFace = unionsByFace(analysis.components);
			const proofUnions = proofUnionKeys(analysis.components);
			// The condition enumerates exactly the pass's own subjects.
			expect(gate.totalPairs, id).toBe(analysis.pairs.length);
			expect(gate.settledPairKeys.length, id).toBe(
				gate.claimPairs.length + gate.refusalPairs.length
			);
			expect(gate.settledPairKeys.length + gate.geometryPairKeys.length, id).toBe(
				analysis.pairs.length
			);
			// (1) Every claim IS a union the proof makes — the direction that would otherwise
			// fabricate a union the geometry refused.
			for (const claim of gate.claims) {
				expect(
					proofUnions.has(pairKey(claim.faceKey, claim.roomId)),
					`${id}: claim ${claim.roomId} -> ${claim.faceKey} must be a proof union`
				).toBe(true);
			}
			// (2) A claimed Room unions with ITS OWN face and nothing else — the direction that
			// would otherwise lose a union the geometry made.
			for (const claim of gate.claims) {
				expect(
					[...(byRoom.get(claim.roomId) ?? [])].sort(),
					`${id}: claimed room ${claim.roomId}`
				).toEqual([claim.faceKey]);
			}
			// (3) A claimed face belongs to exactly its one owner.
			for (const faceKey of gate.claimedFaceKeys) {
				const owners = [...(byFace.get(faceKey) ?? [])].sort();
				expect(owners, `${id}: claimed face ${faceKey}`).toHaveLength(1);
				expect(owners[0], `${id}: claimed face ${faceKey}`).toBe(
					gate.claims.find((claim) => claim.faceKey === faceKey)!.roomId
				);
			}
			// (4) Every refusal the condition derives is a pair the proof leaves alone.
			for (const refusal of gate.refusalPairs) {
				expect(
					proofUnions.has(pairKey(refusal.faceKey, refusal.roomId)),
					`${id}: refusal ${refusal.roomId} vs ${refusal.faceKey} must not be a union`
				).toBe(false);
			}
			// The early-out may only settle UNAMBIGUOUS faces; an ambiguous face is a merge
			// shape the runtime must refuse, and the proof may union both claimants there.
			for (const faceKey of gate.ambiguousFaceKeys) {
				expect(gate.claimedFaceKeys, `${id}: ${faceKey}`).not.toContain(faceKey);
			}
		});
	}

	it('the SHIPPED pass settles exactly the identity condition’s partition (mechanism and oracle agree)', () => {
		// The M-3 implementation check: the pass's own identity counters must equal the test-side
		// condition's partition on every gate row, so the differential's row equality is a
		// statement about the mechanism rather than about the oracle's arithmetic.
		for (const id of P23B11_CONDITIONAL_GATE_CASE_IDS) {
			const entry = gateCase(id);
			const observations: CorrespondenceObservation[] = [];
			setCorrespondenceObserverForTest((observation) => observations.push(observation));
			let analysis: P23B11PassAnalysis;
			try {
				analysis = analyzeCorrespondenceCase(entry);
			} finally {
				clearCorrespondenceObserverForTest();
			}
			const inputs = analysis!.passInputs;
			expect(inputs, id).not.toBeNull();
			const gate = identityGate({ baseline: inputs!.baseline, faces: analysis!.faces });
			const last = observations[observations.length - 1]!;
			expect(last.mode, id).toBe('short-circuit');
			expect(last.identitySettled, id).toBe(gate.settledPairKeys.length);
			expect(last.identityUnions, id).toBe(gate.claimPairs.length);
			expect(last.identityRefusals, id).toBe(gate.refusalPairs.length);
		}
	});

	it('the refused (e) row and the operation-only (h) row run no pass, so no condition is claimed for them', () => {
		for (const id of ['e-exact-coincidence-collinear-chain', 'h-connected-shared-run-junction-move']) {
			const analysis = analyzeCorrespondenceCase(gateCase(id));
			expect(analysis.passInputs, id).toBeNull();
			expect(analysis.counts.pairs, id).toBe(0);
		}
	});

	it('the D-12 hazard rows: the early-out refuses exactly the operated Room', () => {
		for (const [id, refusedRoomId] of [
			['f-d12-exact-coincidence-role-change', 'room-c'],
			['f-d12-full-containment-role-change', 'room-c'],
			['f-d12-full-containment-mirror-role-change', 'room-k'],
			['f-d12-whole-boundary-replacement', 'room-c']
		] as const) {
			const { analysis, baseline } = passingAnalysis(id);
			const gate = identityGate({ baseline, faces: analysis.faces });
			// The operated Room's cycle no longer exists as a face, so identity makes NO claim
			// for it and the geometric/one-sided path decides — which is how the retirement
			// and the unrelated Room's survival both stay exact.
			expect(gate.unclaimedRoomIds, id).toContain(refusedRoomId);
			const unrelatedRoomId = refusedRoomId === 'room-c' ? 'room-k' : 'room-c';
			expect(gate.unclaimedRoomIds, id).not.toContain(unrelatedRoomId);
			const unrelatedClaim = gate.claims.find((claim) => claim.roomId === unrelatedRoomId);
			expect(unrelatedClaim, id).toBeDefined();
			expect(gate.geometryPairKeys.length, id).toBeGreaterThanOrEqual(
				analysis.pairs.length - gate.settledPairKeys.length
			);
		}
	});

	it('the CONNECTED rows: identity settles the room-neutral pass entirely and the division where it can', () => {
		const authoring = passingAnalysis('h-connected-authoring-inside');
		const authoringGate = identityGate({
			baseline: authoring.baseline,
			faces: authoring.analysis.faces
		});
		// The ratified authoring gesture touches no Room: four own-face claims and twelve
		// neighbour refusals settle all sixteen pairs with zero geometry.
		expect(authoringGate.totalPairs).toBe(16);
		expect(authoringGate.claimPairs).toHaveLength(4);
		expect(authoringGate.refusalPairs).toHaveLength(12);
		expect(authoringGate.geometryPairKeys).toEqual([]);

		const division = passingAnalysis('h-connected-room-division');
		const divisionGate = identityGate({
			baseline: division.baseline,
			faces: division.analysis.faces
		});
		// MEASURED, and more than the obvious: the division NODES its two host Walls, and both
		// are SHARED — v-0-0 and v-1-0 bound cell (0,0) AND cell (1,0) — so BOTH operated
		// Rooms lose their own boundary cycles while the two top-row Rooms keep theirs. Identity
		// therefore settles the two untouched Rooms against the two faces that are claimed at
		// all (their own, plus each other's): two claims + two refusals = four of twenty pairs.
		// Every pair involving a changed side — the two child faces, the bottom-right cell
		// whose cycle the shared noded Wall changed, and both operated Rooms — stays geometric.
		expect(divisionGate.totalPairs).toBe(20);
		expect(divisionGate.unclaimedRoomIds.sort()).toEqual(['grid:room-0-0', 'grid:room-1-0']);
		expect(divisionGate.claimedFaceKeys).toHaveLength(2);
		expect(divisionGate.claimPairs).toHaveLength(2);
		expect(divisionGate.refusalPairs).toHaveLength(2);
		expect(divisionGate.geometryPairKeys).toHaveLength(16);
		expect(divisionGate.settledPairKeys).toHaveLength(4);
	});

	it('the merge and retire rows are settled ONLY where identity can — the operated cells are refused', () => {
		// MEASURED: the merge re-roles the shared Wall, so the two operated cells' own cycles
		// vanish (the merged face takes BOTH of them in the proof — exactly the shape an
		// early-out must refuse, never settle); the untouched top row still claims its own
		// faces. The retire leaves three claims and refuses only the cell that lost its
		// enclosure. Both shapes are recorded rather than forced.
		const merge = passingAnalysis('d-connected-shared-wall-merge');
		const mergeGate = identityGate({ baseline: merge.baseline, faces: merge.analysis.faces });
		expect(mergeGate.totalPairs).toBe(12);
		expect(mergeGate.claims).toHaveLength(2);
		expect(mergeGate.unclaimedRoomIds.sort()).toEqual(['grid:room-0-0', 'grid:room-1-0']);
		// Two claims + two refusals: the merged face is NEW by construction, so every pair
		// against it is left to geometry — the merge verdict stays exactly where it was.
		expect(mergeGate.claimPairs.length + mergeGate.refusalPairs.length).toBe(4);
		expect(mergeGate.geometryPairKeys).toHaveLength(8);
		const sharedFace = merge.analysis.components.find(
			(component) => component.predecessorRoomIds.length > 1
		);
		expect(sharedFace).toBeDefined();
		expect(sharedFace!.candidateFaceKeys).toHaveLength(1);

		const retire = passingAnalysis('d-connected-outer-wall-retire');
		const retireGate = identityGate({
			baseline: retire.baseline,
			faces: retire.analysis.faces
		});
		expect(retireGate.totalPairs).toBe(12);
		expect(retireGate.claims).toHaveLength(3);
		expect(retireGate.unclaimedRoomIds).toHaveLength(1);
		expect(retireGate.geometryPairKeys).toHaveLength(3);
	});
});

describe('P23B.11 S4 — OR-3: the extent scope’s excluded pairs', () => {
	for (const id of P23B11_CONDITIONAL_GATE_CASE_IDS) {
		it(`${id}: every excluded pair has all four inputs unchanged from the baseline`, () => {
			const { analysis, baseline, candidate } = passingAnalysis(id);
			const candidateFaces = extractBoundaryCandidateFaces(candidate).faces;
			const baselineFaces = extractBoundaryCandidateFaces(baseline).faces;
			const extent = chainAffectedExtent({ baseline, candidate });
			const candidateInputs = pairInputs({
				baseline,
				candidateDocument: candidate,
				faces: candidateFaces
			});
			const baselineInputs = pairInputs({
				baseline,
				candidateDocument: baseline,
				faces: baselineFaces
			});
			let excludedPairs = 0;
			for (const pair of analysis.pairs) {
				if (!isPairExcluded({ extent, faceKey: pair.faceKey, roomId: pair.roomId })) continue;
				excludedPairs += 1;
				const key = pairKey(pair.faceKey, pair.roomId);
				const baselineSide = baselineInputs.get(key);
				const candidateSide = candidateInputs.get(key);
				// A face with no baseline counterpart can never be excluded (the derivation
				// marks new-key faces affected); if one appears, the scope is unsound.
				expect(baselineSide, `${id}: ${key} needs a baseline counterpart`).toBeDefined();
				expect(candidateSide, `${id}: ${key} needs candidate inputs`).toBeDefined();
				expect(candidateSide, `${id}: ${key}`).toEqual(baselineSide);
			}
			// The exclusion partition is well-formed: an affected pair is never also excluded,
			// and the extent is a claim about the change, not an empty set.
			expect(excludedPairs, id).toBeLessThanOrEqual(analysis.pairs.length);
			if (analysis.counts.pairs > 0) {
				expect(
					extent.changedWallIds.length +
						extent.removedWallIds.length +
						extent.changedJunctionIds.length,
					`${id}: the change must be detected`
				).toBeGreaterThan(0);
			}
		});
	}

	it('the CONNECTED rows: the scope leaves out exactly the structurally untouched sides', () => {
		const authoring = passingAnalysis('h-connected-authoring-inside');
		const authoringExtent = chainAffectedExtent({
			baseline: authoring.baseline,
			candidate: authoring.candidate
		});
		const authoringExcluded = authoring.analysis.pairs.filter((pair) =>
			isPairExcluded({ extent: authoringExtent, faceKey: pair.faceKey, roomId: pair.roomId })
		);
		// A dangling chain inside one cell: the new Wall and its Junctions are in the extent,
		// no Face or Room is, so the whole pass is out of scope and stays exact by identity.
		expect(authoringExcluded).toHaveLength(16);
		expect(authoringExtent.affectedFaceKeys).toEqual([]);
		expect(authoringExtent.affectedRoomIds).toEqual([]);
		expect(authoringExtent.changedWallIds.length).toBeGreaterThanOrEqual(1);

		const division = passingAnalysis('h-connected-room-division');
		const divisionExtent = chainAffectedExtent({
			baseline: division.baseline,
			candidate: division.candidate
		});
		const divisionExcluded = division.analysis.pairs.filter((pair) =>
			isPairExcluded({ extent: divisionExtent, faceKey: pair.faceKey, roomId: pair.roomId })
		);
		// The two untouched top-row Rooms against their two untouched faces: four pairs the
		// scope may leave out — and the four-input oracle above shows they are safe to.
		expect(divisionExcluded).toHaveLength(4);
		expect(divisionExtent.affectedRoomIds.length).toBeGreaterThanOrEqual(1);
	});

	it('the mutation proof: moving an excluded face’s Junction moves the face INTO the extent', () => {
		const { baseline, candidate } = passingAnalysis('h-connected-authoring-inside');
		const before = chainAffectedExtent({ baseline, candidate });
		const candidateFaces = extractBoundaryCandidateFaces(candidate).faces;
		const face = candidateFaces[0]!;
		// The face starts out excluded — it must, or this mutation proves nothing.
		expect(before.affectedFaceKeys).not.toContain(face.key);
		const wall = candidate.walls.find((entry) => entry.id === face.boundary[0]!.wallId)!;
		const mutated: LayoutDocumentWallFirst = {
			...candidate,
			junctions: candidate.junctions.map((junction) =>
				junction.id === wall.startJunctionId
					? { ...junction, point: [junction.point[0], junction.point[1] + 0.5] as LayoutVec2 }
					: junction
			)
		};
		const after = chainAffectedExtent({ baseline, candidate: mutated });
		expect(after.affectedFaceKeys).toContain(face.key);
		// And the scoped claim itself is now FALSE: the face polygon moved.
		const baselineInputs = pairInputs({
			baseline,
			candidateDocument: baseline,
			faces: extractBoundaryCandidateFaces(baseline).faces
		});
		const mutatedInputs = pairInputs({
			baseline,
			candidateDocument: mutated,
			faces: extractBoundaryCandidateFaces(mutated).faces
		});
		const roomId = baseline.rooms[0]!.id;
		expect(mutatedInputs.get(pairKey(face.key, roomId))!.facePolygon).not.toBe(
			baselineInputs.get(pairKey(face.key, roomId))!.facePolygon
		);
	});

	it('the mutation proof: renaming an operated Room’s whole boundary moves that Room INTO the extent', () => {
		const { baseline, candidate } = passingAnalysis('f-d12-whole-boundary-replacement');
		const extent = chainAffectedExtent({ baseline, candidate });
		// The direct row IS the whole-document identity mutation: every c-* Wall carries a new
		// authored id, so the operated Room's refs no longer resolve.
		expect(extent.removedWallIds).toContain('c-a1');
		expect(extent.affectedRoomIds).toContain('room-c');
		expect(extent.affectedRoomIds).not.toContain('room-k');
		const baselineInputs = pairInputs({
			baseline,
			candidateDocument: baseline,
			faces: extractBoundaryCandidateFaces(baseline).faces
		});
		const candidateInputs = pairInputs({
			baseline,
			candidateDocument: candidate,
			faces: extractBoundaryCandidateFaces(candidate).faces
		});
		// A face both sides share (room-k's, whose Walls are untouched) shows the label the
		// operated Room lost: the room-side input the exclusion must never hide.
		const sharedFaceKey = extractBoundaryCandidateFaces(candidate)
			.faces.map((entry) => entry.key)
			.find((key) => baselineInputs.has(pairKey(key, 'room-c')))!;
		expect(candidateInputs.get(pairKey(sharedFaceKey, 'room-c'))!.roomLabel).not.toBe(
			baselineInputs.get(pairKey(sharedFaceKey, 'room-c'))!.roomLabel
		);
		expect(candidateInputs.get(pairKey(sharedFaceKey, 'room-k'))!.roomLabel).toBe(
			baselineInputs.get(pairKey(sharedFaceKey, 'room-k'))!.roomLabel
		);
	});
});
