/**
 * P23B.7 S2 — the FROZEN whole-document preflight reference (tests only).
 *
 * WHAT THIS IS. The scoped gesture gate S4 introduces may change WHICH PAIRS the
 * canonical predicate sees, never the verdict it produces, so it must be compared
 * against the behaviour the shipped whole-document preflight has TODAY. This file
 * asserts that behaviour: for every OR-3 case it checks the status, the canonical
 * failure code and the exact message the CURRENT
 * `preflightWallFirstArchitectureCandidate` returns — and, for cases built to
 * carry more than one defect, which defect is returned FIRST, with a control row
 * proving the later defect is genuinely present rather than merely absent.
 *
 * WHERE THE FREEZE LIVES. The case table is
 * `p23b7-preflight-reference-cases.ts`, shared with S4's differential so both
 * read ONE frozen table and neither can drift against a copy. No value in it may
 * change; a change there is a change to the freeze.
 *
 * WHY IT IS GREEN ON LANDING. It asserts today's shipped code. It is the oracle
 * side of S4's differential (`p23b7-verdict-scope.test.ts` compares the scoped
 * path against THIS table), which is why it landed before the scoped path
 * existed: S4 may not merge without its comparison, and nothing scoped is ever
 * compared against another scoped variant.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not re-implement the gate (the
 * existing full preflight IS the oracle), does not assert sample counts and does
 * not pin wall-clock. It also does not claim the zero-length stage is unreachable:
 * it records the ORDERING FACT that a Wall whose endpoints coincide always has
 * those two Junctions in one component, so the Junction-coincidence stage reports
 * it first — which is exactly the kind of ordering claim S4 has to preserve.
 */
import { describe, expect, it } from 'vitest';

import {
	preflightWallFirstArchitectureCandidate,
	type LayoutDocumentWallFirst,
	type WallFirstArchitectureProposalIntent
} from '@portfolio/layout-core';
import {
	p23b7PreflightReferenceCases,
	type P23B7PreflightReference
} from './p23b7-preflight-reference-cases';

function referenceOf(document: LayoutDocumentWallFirst, intent: WallFirstArchitectureProposalIntent): P23B7PreflightReference {
	const failure = preflightWallFirstArchitectureCandidate(document, intent);
	return failure ? { status: 'known-invalid', code: failure.code, message: failure.message } : { status: 'pending' };
}

describe('P23B.7 S2 — the frozen whole-document preflight reference', () => {
	const rows = p23b7PreflightReferenceCases();

	it('freezes every case against the current whole-document preflight', () => {
		const observed = rows.map((row) => ({
			id: row.id,
			covers: row.covers,
			observed: referenceOf(row.document, row.intent)
		}));
		const expected = rows.map((row) => ({ id: row.id, covers: row.covers, observed: row.expected }));
		expect(observed).toEqual(expected);
	});

	it('proves each later-stage defect is present, not just absent', () => {
		const withControls = rows.filter((row) => row.laterDefect);
		expect(withControls.length, 'the order claims need at least one control').toBeGreaterThan(0);
		for (const row of withControls) {
			const control = row.laterDefect!;
			expect(
				referenceOf(control.control.document, control.control.intent),
				`${row.id}: the later defect must be observable through the same authority`
			).toEqual(control.expected);
		}
	});

	it('is deterministic: a second run of every case observes the same reference', () => {
		const first = rows.map((row) => referenceOf(row.document, row.intent));
		const second = rows.map((row) => referenceOf(row.document, row.intent));
		expect(second).toEqual(first);
	});

	it('covers all four OR-3 cases and the OR-8 lifecycle baseline', () => {
		const covered = new Set(rows.map((row) => row.covers));
		expect([...covered].sort()).toEqual(['OR-3a', 'OR-3b', 'OR-3c', 'OR-3d', 'OR-8', 'OR-3 issue order'].sort());
	});
});
