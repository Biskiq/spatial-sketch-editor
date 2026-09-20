/**
 * P23.13 S10 / §9 + A5 — the keyboard traversal decision, driven directly (T2b,
 * K1/K2).
 *
 * These tests exist because the rule used to be inline in
 * `LayoutPlanViewport.svelte`: the suite could only slice the handler's source
 * text, so "arrows walk an entered group", "Enter enters before the numeric
 * door" and "the entry cannot be skipped by a pointer press" were pinned by
 * whitespace-exact string matches — they broke on refactors that changed
 * nothing and would have stayed green if the handler stopped calling the rule.
 * The decision is now `planKeyboardTraversalDecision` and every branch below
 * fails on the defect it names.
 */
import { describe, expect, it } from 'vitest';
import type { PlanTraversalControl } from '$lib/editor/layout/plan-keyboard-traversal';
import {
	planKeyboardTraversalDecision,
	type PlanKeyboardTraversalFacts
} from '$lib/editor/layout/plan-keyboard-session';

/** A straight Wall's group: start junction → end junction. */
const GROUP: readonly PlanTraversalControl[] = [
	{ kind: 'junction', id: 'j-a', ownerId: 'wall-a' },
	{ kind: 'junction', id: 'j-b', ownerId: 'wall-a' }
];

function facts(overrides: Partial<PlanKeyboardTraversalFacts> = {}): {
	readonly input: PlanKeyboardTraversalFacts;
	readonly groupCalls: () => number;
} {
	let calls = 0;
	const input: PlanKeyboardTraversalFacts = {
		key: 'ArrowRight',
		metaKey: false,
		ctrlKey: false,
		altKey: false,
		planViewMode: 'layout',
		tool: 'select',
		entered: true,
		quiet: true,
		group: () => {
			calls += 1;
			return GROUP;
		},
		focusId: 'j-a',
		numericEntryOpen: false,
		...overrides
	};
	return { input, groupCalls: () => calls };
}

describe('P23.13 S10 traversal decision — arrows (§9)', () => {
	it('steps forward and backward through the entered group, with wrap', () => {
		const forward = facts({ key: 'ArrowRight', focusId: 'j-a' });
		expect(planKeyboardTraversalDecision(forward.input)).toEqual({
			kind: 'traverse',
			control: GROUP[1],
			index: 1,
			groupSize: 2
		});
		// …and wraps off the end rather than stopping.
		expect(planKeyboardTraversalDecision(facts({ key: 'ArrowRight', focusId: 'j-b' }).input)).toEqual(
			{ kind: 'traverse', control: GROUP[0], index: 0, groupSize: 2 }
		);
		expect(planKeyboardTraversalDecision(facts({ key: 'ArrowLeft', focusId: 'j-a' }).input)).toEqual(
			{ kind: 'traverse', control: GROUP[1], index: 1, groupSize: 2 }
		);
	});

	it('maps both axes: Down walks forward, Up walks back', () => {
		expect(planKeyboardTraversalDecision(facts({ key: 'ArrowDown', focusId: 'j-a' }).input)).toMatchObject(
			{ kind: 'traverse', index: 1 }
		);
		expect(planKeyboardTraversalDecision(facts({ key: 'ArrowUp', focusId: 'j-a' }).input)).toMatchObject(
			{ kind: 'traverse', index: 1 }
		);
	});

	it('leaves the arrow to the page unless the group was entered (A5)', () => {
		// A pointer press focuses a control without entering anything, so
		// membership alone is not an unlocked door.
		const notEntered = facts({ entered: false });
		expect(planKeyboardTraversalDecision(notEntered.input)).toBeNull();
		expect(notEntered.groupCalls()).toBe(0);
	});

	it('leaves the arrow to the page on a canvas that is not quiet (§9)', () => {
		// A live gesture or open field owns the keyboard; a traversal move is never
		// an edit and must never interleave one.
		const noisy = facts({ quiet: false });
		expect(planKeyboardTraversalDecision(noisy.input)).toBeNull();
		expect(noisy.groupCalls()).toBe(0);
	});

	it('leaves the arrow to the page when the ring is outside the group', () => {
		expect(planKeyboardTraversalDecision(facts({ focusId: null }).input)).toBeNull();
		expect(planKeyboardTraversalDecision(facts({ focusId: 'j-elsewhere' }).input)).toBeNull();
		// No group at all is the same answer as a ring outside one.
		expect(planKeyboardTraversalDecision(facts({ group: () => null }).input)).toBeNull();
		expect(planKeyboardTraversalDecision(facts({ group: () => [] }).input)).toBeNull();
	});

	it('never enters the group from an arrow: only Enter does', () => {
		const decision = planKeyboardTraversalDecision(facts({ entered: false, focusId: null }).input);
		expect(decision).toBeNull();
	});
});

describe('P23.13 S10 traversal decision — Enter (A5, §7 door)', () => {
	it('enters the group on the first Enter, landing on its first control', () => {
		expect(planKeyboardTraversalDecision(facts({ key: 'Enter', entered: false, focusId: null }).input)).toEqual(
			{ kind: 'enter-group', control: GROUP[0], groupSize: 2 }
		);
	});

	it('cannot be skipped by a pointer-focused control', () => {
		// The ring is already on a member (the pointer put it there), but the entry
		// is not held: the chain is the same either way, so the first Enter enters.
		expect(
			planKeyboardTraversalDecision(facts({ key: 'Enter', entered: false, focusId: 'j-b' }).input)
		).toEqual({ kind: 'enter-group', control: GROUP[0], groupSize: 2 });
	});

	it('reaches the numeric door only on the second Enter', () => {
		// Entry held and the ring on a member: this Enter is the field.
		expect(
			planKeyboardTraversalDecision(facts({ key: 'Enter', entered: true, focusId: 'j-b' }).input)
		).toEqual({ kind: 'open-numeric-door' });
	});

	it('keeps the resting-measure door for a selection that owns no group', () => {
		expect(planKeyboardTraversalDecision(facts({ key: 'Enter', group: () => null }).input)).toEqual({
			kind: 'open-numeric-door'
		});
		expect(planKeyboardTraversalDecision(facts({ key: 'Enter', group: () => [] }).input)).toEqual({
			kind: 'open-numeric-door'
		});
		// A live gesture takes the group away, but Enter still reaches the door the
		// way it did before the group existed.
		expect(planKeyboardTraversalDecision(facts({ key: 'Enter', quiet: false }).input)).toEqual({
			kind: 'open-numeric-door'
		});
	});

	it('never steals a submit from an open field', () => {
		const open = facts({ key: 'Enter', numericEntryOpen: true });
		expect(planKeyboardTraversalDecision(open.input)).toBeNull();
		expect(open.groupCalls()).toBe(0);
	});
});

describe('P23.13 S10 traversal decision — keys it leaves alone', () => {
	it('claims only unmodified keys on the layout Plan with the select tool', () => {
		for (const modified of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }]) {
			expect(planKeyboardTraversalDecision(facts(modified).input)).toBeNull();
			expect(planKeyboardTraversalDecision(facts({ key: 'Enter', ...modified }).input)).toBeNull();
		}
		expect(planKeyboardTraversalDecision(facts({ planViewMode: 'staging' }).input)).toBeNull();
		expect(planKeyboardTraversalDecision(facts({ tool: 'wall' }).input)).toBeNull();
	});

	it('never builds a group for a key it leaves alone', () => {
		// The group is document-derived and LOD-gated, so a key with no claim on the
		// instrument must not pay for one.
		for (const override of [
			{ key: 'Tab' },
			{ key: 'Escape' },
			{ key: 'a' },
			{ planViewMode: 'staging' },
			{ tool: 'room' }
		]) {
			const probe = facts(override);
			expect(planKeyboardTraversalDecision(probe.input)).toBeNull();
			expect(probe.groupCalls(), JSON.stringify(override)).toBe(0);
		}
	});

	it('does not treat a bare Enter in another mode as a door', () => {
		expect(planKeyboardTraversalDecision(facts({ key: 'Enter', tool: 'wall' }).input)).toBeNull();
	});
});
