/**
 * P23.13 S10 — control-group keyboard traversal (spec §9).
 *
 * Pure contract: groups follow canonical endpoint/arc order, stepping wraps,
 * unknown ids yield absence (never a guess), and announcements name role +
 * position + owner for keyboard moves only.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	planTraversalAnnouncement,
	planTraversalEnteredFor,
	planTraversalGroup,
	planTraversalStep,
	type PlanTraversalLayout
} from '$lib/editor/layout/plan-keyboard-traversal';
import { PLAN_CONTROL_MARKS } from '$lib/layout/plan-control-grammar';

const here = dirname(fileURLToPath(import.meta.url));

function readLibSource(relativePath: string): string {
	return readFileSync(resolve(here, '../../../src/lib', relativePath), 'utf8');
}

function layout(): PlanTraversalLayout {
	return {
		walls: new Map([
			['wall-line', { startJunctionId: 'j-a', endJunctionId: 'j-b', knotIds: [] }],
			[
				'wall-curve',
				{ startJunctionId: 'j-b', endJunctionId: 'j-c', knotIds: ['knot-1', 'knot-2'] }
			]
		]),
		junctions: new Set(['j-a', 'j-b', 'j-c'])
	};
}

describe('P23.13 S10 traversal groups (§9)', () => {
	it('reads a straight wall in endpoint order', () => {
		const group = planTraversalGroup({ kind: 'physicalWall', wallId: 'wall-line' }, layout());
		expect(group?.map((control) => control.id)).toEqual(['j-a', 'j-b']);
		expect(group?.[0]).toMatchObject({ kind: 'junction', ownerId: 'j-a' });
	});

	it('reads a curved wall start → knots in arc order → end', () => {
		const group = planTraversalGroup({ kind: 'physicalWall', wallId: 'wall-curve' }, layout());
		expect(group?.map((control) => control.id)).toEqual(['j-b', 'knot-1', 'knot-2', 'j-c']);
		expect(group?.[1]).toMatchObject({ kind: 'curve-control', ownerId: 'wall-curve' });
	});

	it('reads an opening start edge → slide → end edge', () => {
		const group = planTraversalGroup({ kind: 'wallOpening', openingId: 'op-1' }, layout());
		expect(group?.map((control) => control.id)).toEqual(['op-1:start', 'op-1:slide', 'op-1:end']);
		expect(group?.map((control) => control.kind)).toEqual([
			'opening-edge',
			'opening-slide',
			'opening-edge'
		]);
	});

	it('treats a junction selection as its own single control', () => {
		const group = planTraversalGroup({ kind: 'junction', junctionId: 'j-a' }, layout());
		expect(group).toHaveLength(1);
		expect(group?.[0]).toMatchObject({ kind: 'junction', id: 'j-a', ownerId: 'j-a' });
	});

	it('answers null where the document supplies no group', () => {
		const known = layout();
		expect(planTraversalGroup({ kind: 'other' }, known)).toBeNull();
		expect(planTraversalGroup({ kind: 'physicalWall', wallId: 'wall-missing' }, known)).toBeNull();
		expect(planTraversalGroup({ kind: 'junction', junctionId: 'j-missing' }, known)).toBeNull();
		expect(planTraversalGroup({ kind: 'wallOpening', openingId: '' }, known)).toBeNull();
		expect(
			planTraversalGroup(
				{ kind: 'physicalWall', wallId: 'wall-line' },
				{ walls: known.walls, junctions: new Set(['j-a']) }
			)
		).toBeNull();
	});
});

describe('P23.13 S10 traversal stepping (§9)', () => {
	const group = [
		{ kind: 'junction' as const, id: 'j-a', ownerId: 'j-a' },
		{ kind: 'opening-slide' as const, id: 'op-1:slide', ownerId: 'op-1' },
		{ kind: 'junction' as const, id: 'j-b', ownerId: 'j-b' }
	];

	it('steps forward and backward with wrap', () => {
		expect(planTraversalStep(group, 'j-a', 1)?.id).toBe('op-1:slide');
		expect(planTraversalStep(group, 'j-b', 1)?.id).toBe('j-a');
		expect(planTraversalStep(group, 'j-a', -1)?.id).toBe('j-b');
		expect(planTraversalStep(group, 'op-1:slide', -1)?.id).toBe('j-a');
	});

	it('is a no-op unless the focus is inside this group (A5: Enter enters, arrows traverse)', () => {
		// The earlier cut of this module entered the group at the pressed end, which
		// let a selected Wall swallow ArrowRight/ArrowUp — and their scrolling —
		// before the user had entered anything. Absence is the enforcement.
		expect(planTraversalStep(group, null, 1)).toBeNull();
		expect(planTraversalStep(group, null, -1)).toBeNull();
		expect(planTraversalStep(group, 'elsewhere', 1)).toBeNull();
		expect(planTraversalStep(group, 'elsewhere', -1)).toBeNull();
	});

	it('stays on a single control and answers null for an empty group', () => {
		expect(planTraversalStep([group[0]!], 'j-a', 1)?.id).toBe('j-a');
		expect(planTraversalStep([], 'j-a', 1)).toBeNull();
	});
});

describe('P23.13 S10 keyboard group entry (A5)', () => {
	it('is entered only for the selection the keyboard entered', () => {
		expect(planTraversalEnteredFor('physicalWall:w-1', 'physicalWall:w-1')).toBe(true);
	});

	it('is not entered before Enter, and not after the selection moves on', () => {
		// `null` is "the keyboard has entered nothing": a pointer press focuses a
		// control but enters no group, so arrows must still belong to the page.
		expect(planTraversalEnteredFor(null, 'physicalWall:w-1')).toBe(false);
		expect(planTraversalEnteredFor(null, null)).toBe(false);
		// Selecting something else drops the entry by itself — no clear to remember.
		expect(planTraversalEnteredFor('physicalWall:w-1', 'physicalWall:w-2')).toBe(false);
		expect(planTraversalEnteredFor('physicalWall:w-1', null)).toBe(false);
	});
});

describe('P23.13 S10 traversal announcements (§9)', () => {
	it('names role, position, owner, current value and units for a keyboard move', () => {
		expect(
			planTraversalAnnouncement(
				{ kind: 'opening-slide', id: 'op-1:slide', ownerId: 'op-1' },
				1,
				3,
				'Door D-0007',
				'Offset 2.30 m'
			)
		).toBe('Opening slide 2 of 3 — Door D-0007 — Offset 2.30 m');
	});

	it('announces role, position and owner with no value clause where the control has no canonical value', () => {
		expect(
			planTraversalAnnouncement(
				{ kind: 'junction', id: 'j-a', ownerId: 'j-a' },
				0,
				1,
				'Wall W-7V24',
				null
			)
		).toBe('Junction 1 of 1 — Wall W-7V24');
	});

	it('pins the control kinds the shared point-mark table represents', () => {
		// This is a *shape* pin of one table, not a completeness proof for every
		// control the surface paints, and it must not be read as one: the table's own
		// contract is that an absent kind "draws no mark of its own", and two painted
		// controls are absent from it — the Opening slide grip (a paired polyline) and
		// the selected Room's rotation arm + ring (S10's review follow-up, carried to
		// P23.14). The traversal group's vocabulary is instead pinned by
		// `planTraversalGroup` above: the four kinds the layout candidate table
		// produces.
		expect(Object.keys(PLAN_CONTROL_MARKS).sort()).toEqual([
			'curve-control',
			'junction',
			'opening-edge'
		]);
		expect(PLAN_CONTROL_MARKS).not.toHaveProperty('opening-slide');
		expect(PLAN_CONTROL_MARKS).not.toHaveProperty('room-rotation');
	});
});

describe('P23.13 S10 viewport wiring (§9)', () => {
	const viewport = readLibSource('editor/layout/LayoutPlanViewport.svelte');

	/**
	 * T2b — these two units used to pin the rule *itself* as source text (which
	 * key strings the handler tested, the exact `planTraversalStep` call layout, the
	 * `if (group && group.length > 0 && …)` shape). The rule — arrows only inside an
	 * entered group on a quiet canvas, Enter entering before the numeric door, and
	 * neither reachable by a pointer press — is now
	 * `planKeyboardTraversalDecision`, proven directly in
	 * `plan-keyboard-session.test.ts` (14 its, each one failing on the defect it
	 * names; mutation evidence in the harvest §K.3). What is left here is the half
	 * only the component can prove: that it *asks* the rule and applies every one of
	 * its three answers. That is exactly the "machinery works vs call site invokes
	 * it" distinction the T2a review turned on, so it stays a call-site pin.
	 */
	it('asks the traversal rule at the keydown and applies every answer', () => {
		const askAt = viewport.indexOf('planKeyboardTraversalDecision({');
		expect(askAt).toBeGreaterThan(-1);
		const nextBlockAt = viewport.indexOf("interaction.planViewMode === 'staging'", askAt);
		expect(nextBlockAt).toBeGreaterThan(askAt);
		const body = viewport.slice(askAt, nextBlockAt);
		// The live facts the decision needs. `entered` is the A5 gate (the pointer
		// focuses controls by pressing them, so membership alone is not an entry), and
		// `quiet` is §9's no-gesture/no-field gate.
		expect(body).toContain(
			'entered: planTraversalEnteredFor(planKeyboardGroupKey, planKeyboardSelectionKey())'
		);
		expect(body).toContain('quiet: planTraversalGestureQuiet()');
		// The group stays lazy: it is document-derived and LOD-gated, so a key the
		// rule decides without must not build one.
		expect(body).toContain('group: planKeyboardGroup');
		expect(body).toContain('focusId: interaction.planFocus?.id ?? null');
		expect(body).toContain('numericEntryOpen: !numericEntry');
		// …and all three answers are applied, not just the first.
		expect(body).toContain("traversal?.kind === 'traverse'");
		expect(body).toContain("traversal?.kind === 'enter-group'");
		expect(body).toContain("traversal?.kind === 'open-numeric-door'");
		// Traverse moves the ring; enter-group also records the entry as state next to
		// the focus move; the door is attempted last, so a failed door keeps falling
		// through to the rest of the handler.
		expect(body).toContain('focusPlanControlByKeyboard(');
		expect(body).toContain('planKeyboardGroupKey = planKeyboardSelectionKey();');
		expect(body).toContain('beginNumericEntryFromFocus()');
		const doorAt = body.indexOf('open-numeric-door');
		expect(body.indexOf('enter-group')).toBeLessThan(doorAt);
	});

	it('keeps the same LOD gate the overlay draws controls with', () => {
		// Same gate the overlay draws controls with: invisible controls are never
		// focused, so the group (and therefore every traversal) is absent below it.
		expect(viewport).toContain(
			'if (interaction.planView.pixelsPerMeter < JUNCTION_HANDLES_MIN_PX_PER_M) return null;'
		);
	});

	it('retires the readout on a successful exact edit, keeping focus and the entry', () => {
		// The control's value just changed while the ring stayed on it, so a cached
		// announcement would describe a number the document no longer has. Sliced as
		// a composition pin rather than a string: the successful branch must retire
		// the *readout only* — not the focus, not the entry — because the user is
		// still standing on that control with the group entered.
		const fnAt = viewport.indexOf('function applyNumericEdit(');
		expect(fnAt).toBeGreaterThan(-1);
		const fnEnd = viewport.indexOf('/** A rejected exact edit', fnAt);
		expect(fnEnd).toBeGreaterThan(fnAt);
		const body = viewport.slice(fnAt, fnEnd);
		expect(body).toContain('onLayoutTransactionCommit();');
		expect(body).toContain('planAnnouncedFocus = null;');
		expect(body).not.toContain('planKeyboardGroupKey');
		for (const keeper of ['setPlanFocus', 'clearPlanFocus', 'clearPlanKeyboardFocus']) {
			expect(body, keeper).not.toContain(keeper);
		}
	});

	it('hands the instrument back on a primary press that reaches the canvas', () => {
		expect(viewport).toContain(
			'function releasePlanKeyboardInstrument(): void {\n\t\tplanKeyboardGroupKey = null;\n\t\tplanAnnouncedFocus = null;\n\t}'
		);
		// After the open-field swallow (which changes nothing and returns above) and
		// before the pointer sets its own focus.
		const pressAt = viewport.indexOf('releasePlanKeyboardInstrument();\n\t\tsvgElement?.focus();');
		expect(pressAt).toBeGreaterThan(-1);
		const fieldAt = viewport.indexOf('if (numericEntry) {');
		expect(pressAt).toBeGreaterThan(fieldAt);
	});

	it('unwinds focus and its readout together on Escape, without touching selection or history', () => {
		// One instrument: the ring and the announcement are released by one helper,
		// so no path can drop the ring and keep speaking about the control.
		expect(viewport).toContain(
			'function clearPlanKeyboardFocus(): void {\n\t\tclearPlanFocus(interaction);\n\t\tplanKeyboardGroupKey = null;\n\t\tplanAnnouncedFocus = null;\n\t}'
		);
		const dropAt = viewport.indexOf('clearPlanKeyboardFocus();\n\t\t\t\treturn;');
		expect(dropAt).toBeGreaterThan(-1);
		// After every gesture/draft branch (which return above), before the
		// coarse tail clears drafts.
		const tailAt = viewport.indexOf('clearLayoutDraft(interaction);\n\t\t\tcancelRoomEdit(interaction);');
		expect(tailAt).toBeGreaterThan(dropAt);
	});

	it('releases the readout wherever focus is invalidated, including outside this component', () => {
		// The mode/tool cancel path (which clears focus for "mode changes cancel
		// capture and clear the prior owner's instrument") uses the same helper…
		expect(viewport).toContain('clearPlanKeyboardFocus();\n\t\trotationHoverScreen = null;');
		// …and the stored announcement is reconciled against the live focus, because
		// `clearLayoutSelection` releases the instrument from `layout-interaction`,
		// where this component cannot hook it.
		expect(viewport).toContain(
			'planAnnouncedFocus && planAnnouncedFocus.controlId !== focusId'
		);
		expect(viewport).toContain('interaction.planFocus?.id ?? null');
	});

	it('moves focus without ever writing selection or history', () => {
		const focusAt = viewport.indexOf('function focusPlanControlByKeyboard');
		const endAt = viewport.indexOf('/**\n\t * Close the field.', focusAt);
		const body = viewport.slice(focusAt, endAt);
		expect(body).toContain('setPlanFocus(interaction,');
		expect(body).toContain('planTraversalAnnouncement(');
		// §9's readout owes the current value and units, resolved from canonical
		// facts by the same module the numeric door seeds from.
		expect(body).toContain('planKeyboardControlReadout(control)');
		for (const writer of [
			'selectLayout',
			'clearLayoutSelection',
			'onLayoutTransaction',
			'commitLayout',
			'History'
		]) {
			expect(body, writer).not.toContain(writer);
		}
	});

	it('announces keyboard moves once, and never pointer focus', () => {
		expect(viewport).toContain('<div class="plan-focus-announcement" role="status">{planFocusAnnouncement}</div>');
		expect(viewport).toContain('.plan-focus-announcement { position: absolute; width: 1px;');
		// The region's text is derived, and only from the announcement that names
		// the control the ring is on: a pointer press sets focus silently, so its
		// id can never match a stored announcement's.
		expect(viewport).toContain(
			'planAnnouncedFocus && interaction.planFocus?.id === planAnnouncedFocus.controlId'
		);
		// Six writes to the announcement and no more: the declaration, the keyboard
		// move, the two release paths (focus unwind, pointer taking the instrument
		// back), the successful exact edit that changed the announced value, and the
		// reconciliation that clears it when the focus moved without the keyboard.
		const assignments = viewport.split('planAnnouncedFocus = ').length - 1;
		expect(assignments).toBe(6);
	});
});
