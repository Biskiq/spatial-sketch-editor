/**
 * P23B.11 S2 — the reference freeze, asserted against today's code.
 *
 * The plan's reference-first rule: no oracle may require code that does not exist
 * yet, so the whole-document behaviour the later differential compares against is
 * frozen FIRST, tests only, and this file is the half that keeps it honest. Every
 * OR-1 case runs the REAL planner and then the pass that consumes it; the row is
 * compared with `p23b11-correspondence-reference.ts` as a whole, and the property
 * rows below state the things S3's differential will read out of it — so the
 * freeze is not merely a blob that happens to match.
 *
 * WHY THE PROPERTY ROWS EXIST BESIDE THE EQUALITY. The equality alone would still
 * pass if the case table silently lost a case or grew a degenerate one. The
 * properties name what each part of the table is for (island share, connected
 * same-group, the 2→1 merge, the D-12 denials, the OR-6 baseline, ordering,
 * determinism), so erosion of the case set fails here rather than weakening S3.
 *
 * The freeze is green on landing because it asserts TODAY'S code, unoptimized.
 * It must stay green after S3: the differential asserts the same rows against the
 * short-circuited path, and this file asserts them against the reference path.
 */
import { describe, expect, it } from 'vitest';

import {
	analyzeCorrespondenceCase,
	frozenCaseRows,
	freezeAnalysis,
	P23B11_CORRESPONDENCE_CASES,
	type P23B11FrozenCase
} from './p23b11-correspondence-cases';
import { P23B11_OR1_REFERENCE } from './p23b11-correspondence-reference';

/** Every case, analysed and reduced once for the whole file. */
const liveRows: P23B11FrozenCase[] = frozenCaseRows();
const frozenById = new Map(P23B11_OR1_REFERENCE.map((row) => [row.id, row]));

/** The OR-1 letters a case's `covers` field names. */
function coveredRows(row: P23B11FrozenCase): string[] {
	return [...row.covers.matchAll(/OR-1\(([a-h])\)/g)].map((match) => match[1]!);
}

function rowById(id: string): P23B11FrozenCase {
	const row = liveRows.find((candidate) => candidate.id === id);
	if (!row) throw new Error(`missing case '${id}'`);
	return row;
}

describe('P23B.11 S2 — the frozen OR-1 reference', () => {
	it('covers OR-1 (a)–(h), and every case exactly once, in table order', () => {
		expect(P23B11_OR1_REFERENCE.map((row) => row.id)).toEqual(
			P23B11_CORRESPONDENCE_CASES.map((entry) => entry.id)
		);
		expect(new Set(P23B11_OR1_REFERENCE.map((row) => row.id)).size).toBe(
			P23B11_OR1_REFERENCE.length
		);
		const covered = new Set(P23B11_OR1_REFERENCE.flatMap((row) => coveredRows(row)));
		expect([...covered].sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
		// The CONNECTED case is MANDATORY at S3, so it must be in the freeze itself.
		expect(P23B11_OR1_REFERENCE.map((row) => row.covers).join(' ')).toContain('OR-1(h)');
	});

	for (const [index, entry] of P23B11_CORRESPONDENCE_CASES.entries()) {
		it(
			`${entry.id} (${entry.covers}) reproduces its frozen row`,
			{ timeout: 120000 },
			() => {
				// The single equality the differential also uses: the live analysis,
				// reduced by the shared `freezeAnalysis`, against the frozen literal.
				expect(liveRows[index]).toEqual(frozenById.get(entry.id));
			}
		);
	}
});

describe('P23B.11 S2 — the properties the S3 differential reads', () => {
	it('the rebuilt pass IS the planner’s own pass wherever a planner ran one', () => {
		// Rows without a planner pass: the direct row, the operation-only precision
		// row, and rows whose operation was refused before the pass (no planner
		// reconciliation to compare with).
		const planned = liveRows.filter((row) => row.fidelity !== null);
		expect(planned.length).toBeGreaterThanOrEqual(18);
		for (const row of planned) {
			expect(row.fidelity, `${row.id} must reproduce the planner’s document`).toBe(true);
		}
	});

	it('today evaluates BOTH predicates for EVERY pair (OR-6 baseline)', () => {
		for (const row of liveRows) {
			expect(row.counts.insideEvaluations, row.id).toBe(row.counts.pairs);
			expect(row.counts.overlapEvaluations, row.id).toBe(row.counts.pairs);
			expect(row.counts.pairs, row.id).toBe(row.counts.faces * row.counts.predecessors);
			expect(
				row.counts.sameGroupPairs + row.counts.crossGroupPairs + row.counts.undefinedPairs,
				row.id
			).toBe(row.counts.pairs);
		}
	});

	it('the committed fixtures are islands while the CONNECTED case is one group', () => {
		// The diagnosis's island shape: on the size-40 fixtures almost every pair
		// crosses groups, which is why a group check alone removes most of the work.
		for (const row of liveRows.filter((candidate) => /^[ab]-/.test(candidate.id))) {
			const share = row.counts.crossGroupPairs / row.counts.pairs;
			expect(share, `${row.id} is an island fixture`).toBeGreaterThanOrEqual(0.9);
		}
		// The connected case: nothing crosses a group, so the group check skips
		// nothing and the same-group rows carry the whole cost.
		for (const row of liveRows.filter(
			(candidate) => candidate.covers.includes('OR-1(h)') && candidate.counts.pairs > 0
		)) {
			expect(row.counts.crossGroupPairs, row.id).toBe(0);
			expect(row.counts.sameGroupPairs, row.id).toBe(row.counts.pairs);
		}
	});

	it('the recorded 2→1 merge is one component with two predecessors and a retirement', () => {
		const row = rowById('d-connected-shared-wall-merge');
		expect(row.operation.verdict).toBe('success');
		const merged = row.components.filter((component) => component.predecessorRoomIds.length === 2);
		expect(merged).toHaveLength(1);
		expect(merged[0]!.candidateFaceKeys).toHaveLength(1);
		expect(merged[0]!.predecessorRoomIds).toEqual(['grid:room-0-0', 'grid:room-1-0']);
		expect(row.reconciliation.kind).toBe('ok');
		if (row.reconciliation.kind !== 'ok') return;
		const survivor = row.reconciliation.lineage.find((record) => record.kind === 'merge-survivor');
		expect(survivor).toBeDefined();
		// The retirement is the merge's OTHER predecessor, never the survivor.
		expect(row.reconciliation.retiredRoomIds).toEqual(['grid:room-0-0']);
		expect(row.reconciliation.retiredRoomIds).not.toContain(survivor!.roomId);
	});

	it('the D-12 hazard rows never union the coincident pair, and the unrelated Room survives', () => {
		const hazardRows = liveRows.filter((row) => row.id.startsWith('f-d12-') && row.id.endsWith('role-change'));
		expect(hazardRows).toHaveLength(4);
		for (const row of hazardRows) {
			for (const component of row.components) {
				expect(
					component.predecessorRoomIds.includes('room-c') &&
						component.predecessorRoomIds.includes('room-k'),
					`${row.id}: the coincident pair must never share a component`
				).toBe(false);
			}
			expect(row.reconciliation.kind, row.id).toBe('ok');
			const reconciliation = row.reconciliation;
			if (reconciliation.kind !== 'ok') continue;
			// Exactly one of the two coincident Rooms retires; the other keeps its
			// identity (id AND name) and nothing merges into it.
			expect(reconciliation.retiredRoomIds, row.id).toHaveLength(1);
			const survivingIds = reconciliation.rooms.map((room) => room.id);
			const survivor = ['room-c', 'room-k'].find(
				(id) => !reconciliation.retiredRoomIds.includes(id)
			);
			expect(survivingIds, row.id).toContain(survivor!);
			expect(
				reconciliation.lineage.some((record) => record.kind === 'merge-survivor'),
				row.id
			).toBe(false);
		}
	});

	it('the one-sided denial rows carry exactly the undefined sides D-12 denies on', () => {
		// `planRemoveRoom` on the coincident pair: the operated Room’s whole ring is
		// gone, so its ONE surviving face pair is the exactly-one-resolves branch.
		const removal = rowById('d-d12-remove-room-retire');
		expect(removal.counts).toMatchObject({
			pairs: 2,
			sameGroupPairs: 1,
			crossGroupPairs: 0,
			undefinedPairs: 1
		});
		// The whole-boundary replacement: the identity-less predecessor contributes
		// an undefined side on both of its pairs, and forms no component at all.
		const replacement = rowById('f-d12-whole-boundary-replacement');
		expect(replacement.counts.undefinedPairs).toBe(2);
		expect(replacement.components.flatMap((component) => component.predecessorRoomIds)).toEqual([
			'room-k'
		]);
		expect(replacement.reconciliation.kind).toBe('ok');
		if (replacement.reconciliation.kind === 'ok') {
			// The unrelated Room is preserved and NO merge happened; the identity-less
			// predecessor retires while its enclosure is born under a fresh identity.
			expect(replacement.reconciliation.retiredRoomIds).toEqual(['room-c']);
			expect(replacement.reconciliation.lineage.map((record) => record.kind)).toEqual([
				'created',
				'preserved'
			]);
		}
	});

	it('component and face-key ordering is the deterministic production order', () => {
		for (const row of liveRows) {
			for (const component of row.components) {
				expect(component.candidateFaceKeys, row.id).toEqual(
					[...component.candidateFaceKeys].sort()
				);
			}
			const smallestKeys = row.components.map((component) => component.candidateFaceKeys[0]!);
			expect(smallestKeys, row.id).toEqual([...smallestKeys].sort());
			// Every extracted face is claimed by exactly one component — including the
			// two faces a 1→2 split component legitimately holds.
			expect(new Set(row.faceKeys).size, row.id).toBe(row.faceKeys.length);
			expect(
				row.components.flatMap((component) => component.candidateFaceKeys).sort(),
				row.id
			).toEqual([...row.faceKeys].sort());
		}
	});

	it('a refused case is frozen with its code and runs no pass', () => {
		const refused = liveRows.filter((row) => row.operation.verdict === 'rejected');
		expect(refused.length).toBeGreaterThanOrEqual(1);
		for (const row of refused) {
			if (row.operation.verdict !== 'rejected') continue;
			expect(row.operation.code, row.id).toMatch(/^[a-z_]+$/);
			expect(row.counts.pairs, row.id).toBe(0);
			expect(row.reconciliation.kind, row.id).toBe('not-run');
		}
		// The D-12 refusal contract: a chain landing exactly along an authored wall
		// is still refused for the same reason.
		expect(rowById('e-exact-coincidence-collinear-chain').operation).toEqual({
			verdict: 'rejected',
			code: 'collinear_overlap'
		});
	});

	it('re-analysing the cheap rows is byte-identical (the pass is deterministic)', () => {
		// The size-40 rows are excluded here only because re-running them doubles
		// this file's cost for no additional signal: every row travels the same
		// code path, and the four expensive ones are already compared once above.
		const cheap = P23B11_CORRESPONDENCE_CASES.filter(
			(entry) => (frozenById.get(entry.id)?.counts.pairs ?? 0) <= 20
		);
		expect(cheap.length).toBeGreaterThanOrEqual(15);
		expect(frozenCaseRows(cheap)).toEqual(cheap.map((entry) => frozenById.get(entry.id)));
	});

	it('the analysis the freeze quantizes is the analysis the differential calls', () => {
		// One quantization, two consumers: `freezeAnalysis(analyzeCorrespondenceCase())`
		// is exactly what produced the reference file, so a differential row and a
		// frozen row can never be compared on two different projections.
		const sample = P23B11_CORRESPONDENCE_CASES.find(
			(entry) => entry.id === 'd-connected-shared-wall-merge'
		)!;
		expect(freezeAnalysis(analyzeCorrespondenceCase(sample))).toEqual(
			frozenById.get('d-connected-shared-wall-merge')
		);
	});
});
