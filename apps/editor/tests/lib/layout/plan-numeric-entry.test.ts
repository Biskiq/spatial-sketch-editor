import { describe, expect, it } from 'vitest';

import {
	PLAN_NUMERIC_FIELD_SETS,
	parsePlanNumericText,
	planNumericAngleDegrees,
	planNumericAngleDirection,
	planNumericEntryBlur,
	planNumericEntryCandidate,
	planNumericEntryEscape,
	planNumericEntryField,
	planNumericEntryHoldsExplicitValue,
	planNumericDimensionEntryTarget,
	planNumericControlEntryTarget,
	planNumericEntryInput,
	planNumericEntryOpen,
	planNumericEntrySubmit,
	planNumericEntryTab,
	planNumericEntryTrigger,
	planNumericFieldReadout,
	planNumericFieldText,
	planNumericFields,
	planNumericHostReadout,
	planNumericInvalidMessage,
	planNumericPointerUp,
	type PlanNumericDomain,
	type PlanNumericEntryState,
	type PlanNumericField,
	type PlanNumericHost
} from '$lib/editor/layout/plan-numeric-entry';

/**
 * P23.13 S7 — the ratified type-to-enter lifecycle (spec §7, A5).
 *
 * §7 fixes the whole editor in one paragraph: a digit or decimal separator starts
 * entry in the primary field, `-` only where the canonical domain allows it,
 * Tab/Shift+Tab wrap *within* the active field set, Enter submits once, Escape
 * restores then cancels, blur never commits, invalid values stay editable with a
 * reason and write no history. A5 fixes the field sets per gesture. Each block
 * below pins one of those sentences, and the ones that could regress silently (the
 * `-` target, the wrap, Enter-once, the pointer-up consumption) are pinned by
 * value rather than by shape.
 */

const KEY = (key: string, extras: Partial<Parameters<typeof planNumericEntryTrigger>[0]> = {}) => ({
	key,
	...extras
});

/**
 * The other half of §7's reach: "typing while drafting; explicit click/focus
 * otherwise" (A5). Here the entry is not started by a keystroke but by the user
 * pointing at a value that is already on the drawing — the resting primary
 * dimension of a selected entity, or a focused control — so these tests pin what
 * an *explicit* focus means: which host it opens, which field the caret lands in,
 * and that an opened field holds the value it replaced rather than an invention.
 */
describe('P23.13 S7 — explicit focus opens the editor (A5)', () => {
	it('maps a resting Wall measure to the Wall edit host, in its Length field', () => {
		expect(planNumericDimensionEntryTarget('selected-wall:W-7K3M')).toEqual({
			host: 'wall-edit',
			fieldId: 'length',
			ownerId: 'W-7K3M'
		});
	});

	it('reads an Opening offset as the offset, never as its width', () => {
		// `selected-opening-offset:` begins with `selected-opening:` as text, so a
		// shortest-prefix-first match would silently open the width field on an
		// offset measure — one number edited in place of another.
		expect(planNumericDimensionEntryTarget('selected-opening-offset:O-2Q9K')).toEqual({
			host: 'opening-resize',
			fieldId: 'offset',
			ownerId: 'O-2Q9K'
		});
		expect(planNumericDimensionEntryTarget('selected-opening:O-2Q9K')).toEqual({
			host: 'opening-resize',
			fieldId: 'width',
			ownerId: 'O-2Q9K'
		});
	});

	it('offers no editor for a measure §7 leaves passive', () => {
		expect(planNumericDimensionEntryTarget('leg:length')).toBeNull();
		expect(planNumericDimensionEntryTarget('leg:angle')).toBeNull();
		expect(planNumericDimensionEntryTarget('selected-wall:')).toBeNull();
		expect(planNumericDimensionEntryTarget('')).toBeNull();
	});

	it('maps only the focused controls whose canonical command exists', () => {
		expect(planNumericControlEntryTarget('junction', 'J-AEM9')).toEqual({
			host: 'junction',
			fieldId: 'x',
			ownerId: 'J-AEM9'
		});
		expect(planNumericControlEntryTarget('opening-edge', 'O-2Q9K')).toEqual({
			host: 'opening-resize',
			fieldId: 'width',
			ownerId: 'O-2Q9K'
		});
		expect(planNumericControlEntryTarget('opening-slide', 'O-2Q9K')).toEqual({
			host: 'opening-slide',
			fieldId: 'offset',
			ownerId: 'O-2Q9K'
		});
		// A control with nothing to reach is not offered an editor rather than opened
		// onto a second solver; the rotation controls and curve knots are those cases
		// until their commands are wired.
		expect(planNumericControlEntryTarget('curve-control', 'K-1')).toBeNull();
		expect(planNumericControlEntryTarget('object-rotation', 'OBJ-1')).toBeNull();
		expect(planNumericControlEntryTarget('room-rotation', 'R-1')).toBeNull();
		expect(planNumericControlEntryTarget('junction', '')).toBeNull();
	});

	it('every target field belongs to the host it opens', () => {
		// A target that named a field its host does not offer would open the editor
		// on field 0 through the `findIndex < 0` fallback and quietly edit another
		// number; this pins the two tables against each other.
		const targets = [
			planNumericDimensionEntryTarget('selected-wall:W-1'),
			planNumericDimensionEntryTarget('selected-opening:O-1'),
			planNumericDimensionEntryTarget('selected-opening-offset:O-1'),
			planNumericControlEntryTarget('junction', 'J-1'),
			planNumericControlEntryTarget('opening-edge', 'O-1'),
			planNumericControlEntryTarget('opening-slide', 'O-1')
		];
		for (const target of targets) {
			expect(target).not.toBeNull();
			const ids = planNumericFields(target!.host).map((field) => field.id);
			expect(ids).toContain(target!.fieldId);
		}
	});

	it('opens on the value it replaces without claiming the user chose it', () => {
		const target = planNumericDimensionEntryTarget('selected-wall:W-1')!;
		const state = planNumericEntryOpen(target, { length: 3.372, angle: -46.31 });
		expect(planNumericEntryField(state)).toMatchObject({ id: 'length', label: 'Length', unit: 'length' });
		// The field shows the value it replaces, at its own display precision.
		expect(state.text).toBe('3.37');
		expect(state.invalidReason).toBeNull();
		// ...but showing it is not choosing it: nothing is typed, so the snap is not
		// suppressed and §7's "explicit values outrank a conflicting snap" has not
		// been invoked yet.
		expect(state.typed).toEqual({});
		expect(planNumericEntryHoldsExplicitValue(state)).toBe(false);
		const outcome = planNumericEntrySubmit(state);
		expect(outcome.kind).toBe('commit');
		if (outcome.kind !== 'commit') return;
		// An untouched Enter submits *no values*: the caller sees "nothing was typed"
		// structurally. Seeding `typed` with the displayed text instead would submit a
		// rounded 3.37 for a 3.372 Wall — 2 mm of author-visible geometry, and a
		// history entry, for a keystroke that said nothing.
		expect(outcome.values).toEqual({});
	});

	it('submits the value once the user types one, at full precision', () => {
		const target = planNumericDimensionEntryTarget('selected-wall:W-1')!;
		const opened = planNumericEntryOpen(target, { length: 3.372, angle: -46.31 });
		const typed = planNumericEntryInput(opened, '3.372');
		expect(planNumericEntryHoldsExplicitValue(typed)).toBe(true);
		const outcome = planNumericEntrySubmit(typed);
		expect(outcome.kind).toBe('commit');
		if (outcome.kind !== 'commit') return;
		expect(outcome.values.length).toBeCloseTo(3.372, 9);
	});

	it('opens in the field the focus named, not in the host primary', () => {
		const target = planNumericDimensionEntryTarget('selected-opening-offset:O-1')!;
		const state = planNumericEntryOpen(target, { width: 0.9, offset: 1.25 });
		expect(planNumericEntryField(state).id).toBe('offset');
		expect(state.text).toBe('1.25');
	});

	it('opens blank and refused when the value does not exist yet', () => {
		const target = planNumericEntryTargetForBlankTest();
		const state = planNumericEntryOpen(target, { length: null });
		expect(state.text).toBe('');
		expect(state.invalidReason).toBe('blank');
		// Nothing typed, so Enter cannot smuggle a blank past the blank check.
		expect(state.typed).toEqual({});
		expect(planNumericEntryHoldsExplicitValue(state)).toBe(false);
		const outcome = planNumericEntrySubmit(state);
		expect(outcome.kind).toBe('commit');
		if (outcome.kind !== 'commit') return;
		expect(outcome.values).toEqual({});
	});

	it('keeps the opened value across Tab without promoting the next field', () => {
		const target = planNumericDimensionEntryTarget('selected-wall:W-1')!;
		const opened = planNumericEntryOpen(target, { length: 3.372, angle: -46.31 });
		const tabbed = planNumericEntryTab(opened, 'forward', { length: 3.372, angle: -46.31 });
		expect(planNumericEntryField(tabbed).id).toBe('angle');
		// The Angle shows the Wall's own canonical angle — the number the user would
		// read on the leg — but showing it is not choosing it.
		expect(tabbed.text).toBe('-46.3');
		// Tab is not a submit and not a keystroke: what follows the user is what they
		// *typed*, so neither field is promoted. The opened value is still displayed,
		// which is why this asserts through `typed` and through the submission rather
		// than through `text` alone.
		expect(tabbed.typed).toEqual({});
		const outcome = planNumericEntrySubmit(tabbed);
		expect(outcome.kind).toBe('commit');
		if (outcome.kind !== 'commit') return;
		// Neither value goes in. This is Finding 1 of the step-2 review, as a pin: had
		// the open seeded `typed` with the displayed text, this Enter would submit the
		// rounded 3.37 for a 3.372 Wall — 2 mm of author-visible geometry and a history
		// entry, from the very submit §7 promises closes silently.
		expect(outcome.values).toEqual({});
	});

	it('offers the same field pair for an existing Wall as it does for the draw', () => {
		// Same fields, different command: the pair is §7's, and the *host* is what
		// tells the caller whether acceptance creates a segment or edits one.
		expect(planNumericFields('wall-edit')).toEqual(planNumericFields('wall-chain'));
	});
});

/** The Wall edit target, spelled once so the blank test reads as the point. */
function planNumericEntryTargetForBlankTest(): Parameters<typeof planNumericEntryOpen>[0] {
	const target = planNumericDimensionEntryTarget('selected-wall:W-1');
	if (!target) throw new Error('expected a target for the selected Wall');
	return target;
}



/** Open an entry in `host` the way a keystroke would, for the exit tests. */
function open(host: PlanNumericHost, key = '5', candidates = {}): PlanNumericEntryState {
	const state = planNumericEntryTrigger(KEY(key), { host, candidates, dragActive: true });
	if (!state) throw new Error(`no entry for ${host} / ${key}`);
	return state;
}

function field(id: string, host: PlanNumericHost = 'wall-chain'): PlanNumericField {
	const found = planNumericFields(host).find((candidate) => candidate.id === id);
	if (!found) throw new Error(`no field ${id} in ${host}`);
	return found;
}

describe('field sets', () => {
	it('offers §7 row 1 the Wall draw pair, length first', () => {
		expect(planNumericFields('wall-chain').map((entry) => entry.id)).toEqual(['length', 'angle']);
		expect(field('length').domain).toBe('positive');
		expect(field('angle').domain).toBe('signed');
	});

	it('keeps every host finite and every id in the ratified vocabulary', () => {
		const ratified = new Set(['length', 'angle', 'width', 'depth', 'offset', 'dx', 'dz', 'x', 'z', 'yaw']);
		for (const host of Object.keys(PLAN_NUMERIC_FIELD_SETS) as PlanNumericHost[]) {
			const fields = planNumericFields(host);
			expect(fields.length).toBeGreaterThan(0);
			for (const entry of fields) {
				expect(ratified.has(entry.id)).toBe(true);
				expect(entry.label.length).toBeGreaterThan(0);
				expect(entry.decimals).toBeGreaterThan(0);
			}
		}
	});

	it('hosts no field for a passive measure (area and clearance are never inputs)', () => {
		const ids = (Object.keys(PLAN_NUMERIC_FIELD_SETS) as PlanNumericHost[]).flatMap((host) =>
			planNumericFields(host).map((entry) => entry.id)
		);
		expect(ids).not.toContain('area');
		expect(ids).not.toContain('clearance');
	});

	it('keeps a canonical-start Opening offset nonnegative and its width positive', () => {
		const insert = planNumericFields('opening-insert');
		expect(insert[0]).toMatchObject({ id: 'width', domain: 'positive' });
		expect(insert[1]).toMatchObject({ id: 'offset', domain: 'nonnegative' });
	});

	it('offers the canonical transform trio with rotation last', () => {
		expect(planNumericFields('object-transform').map((entry) => entry.id)).toEqual(['width', 'depth', 'yaw']);
		expect(field('yaw', 'object-transform')).toMatchObject({ unit: 'angle', domain: 'signed' });
	});
});

describe('trigger', () => {
	it('starts entry in the primary field on a digit', () => {
		const state = planNumericEntryTrigger(KEY('7'), { host: 'wall-chain' });
		expect(state).not.toBeNull();
		expect(planNumericEntryField(state!).id).toBe('length');
		// §7: entry *replaces* the displayed value, so the keystroke is the text.
		expect(state!.text).toBe('7');
	});

	it('starts entry on either decimal separator', () => {
		expect(planNumericEntryTrigger(KEY('.'), { host: 'wall-chain' })!.text).toBe('.');
		expect(planNumericEntryTrigger(KEY(','), { host: 'wall-chain' })!.text).toBe(',');
	});

	it('sends `-` to the signed field, not the primary nonnegative one', () => {
		const state = planNumericEntryTrigger(KEY('-'), { host: 'wall-chain' });
		expect(state).not.toBeNull();
		expect(planNumericEntryField(state!).id).toBe('angle');
		// A signed primary is the `-` field, so a Junction goes straight to X.
		expect(planNumericEntryField(planNumericEntryTrigger(KEY('-'), { host: 'junction' })!).id).toBe('x');
		expect(planNumericEntryField(planNumericEntryTrigger(KEY('-'), { host: 'wall-move' })!).id).toBe('dx');
	});

	it('refuses to start anything on `-` when no field in the set is signed', () => {
		for (const host of ['rectangle', 'opening-insert', 'opening-slide', 'opening-resize'] as const) {
			expect(planNumericEntryTrigger(KEY('-'), { host })).toBeNull();
			// The same hosts still accept a digit: only the *trigger* is refused.
			expect(planNumericEntryTrigger(KEY('4'), { host })).not.toBeNull();
		}
	});

	it('never intercepts composition, chords, or non-typing keys', () => {
		expect(planNumericEntryTrigger(KEY('1', { isComposing: true }), { host: 'wall-chain' })).toBeNull();
		expect(planNumericEntryTrigger(KEY('1', { metaKey: true }), { host: 'wall-chain' })).toBeNull();
		expect(planNumericEntryTrigger(KEY('1', { ctrlKey: true }), { host: 'wall-chain' })).toBeNull();
		expect(planNumericEntryTrigger(KEY('1', { altKey: true }), { host: 'wall-chain' })).toBeNull();
		for (const key of ['Enter', 'Tab', 'Escape', 'ArrowLeft', 'Backspace', 'a', ' ', '+']) {
			expect(planNumericEntryTrigger(KEY(key), { host: 'wall-chain' }), key).toBeNull();
		}
	});

	it('seeds the live candidate and remembers an in-flight drag', () => {
		const state = planNumericEntryTrigger(KEY('2'), {
			host: 'wall-chain',
			candidates: { length: 4.25 },
			dragActive: true
		})!;
		expect(planNumericEntryCandidate(state)).toBe(4.25);
		expect(state.dragActive).toBe(true);
		expect(state.pointerUpConsumed).toBe(false);
		// A click-based draft has no drag to consume.
		expect(planNumericEntryTrigger(KEY('2'), { host: 'wall-chain' })!.dragActive).toBe(false);
	});

	it('validates the seed like any other text, without refusing the entry', () => {
		const sep = planNumericEntryTrigger(KEY('.'), { host: 'wall-chain' })!;
		expect(sep.text).toBe('.');
		expect(sep.invalidReason).toBe('not-a-number');
		expect(planNumericEntryTrigger(KEY('5'), { host: 'wall-chain' })!.invalidReason).toBeNull();
	});
});

describe('units and domain', () => {
	it('defaults lengths to meters and accepts m and cm spellings', () => {
		expect(parsePlanNumericText('3', field('length'))).toEqual({ ok: true, value: 3 });
		expect(parsePlanNumericText('3 m', field('length'))).toEqual({ ok: true, value: 3 });
		expect(parsePlanNumericText('250cm', field('length'))).toEqual({ ok: true, value: 2.5 });
		expect(parsePlanNumericText('2.5 metres', field('length'))).toEqual({ ok: true, value: 2.5 });
	});

	it('reads both decimal separators as separators', () => {
		expect(parsePlanNumericText('2,5', field('length'))).toEqual({ ok: true, value: 2.5 });
	});

	it('treats angles as degrees', () => {
		expect(parsePlanNumericText('30', field('angle'))).toEqual({ ok: true, value: 30 });
		expect(parsePlanNumericText('30°', field('angle'))).toEqual({ ok: true, value: 30 });
		expect(parsePlanNumericText('-45 deg', field('angle'))).toEqual({ ok: true, value: -45 });
	});

	it('refuses a unit the field cannot carry, as a unit problem', () => {
		expect(parsePlanNumericText('2 mm', field('length'))).toEqual({ ok: false, reason: 'unit-not-allowed' });
		expect(parsePlanNumericText('3 m', field('angle'))).toEqual({ ok: false, reason: 'unit-not-allowed' });
		expect(planNumericInvalidMessage('unit-not-allowed', field('angle'))).toBe('Angles are degrees');
	});

	it('refuses an expression or a non-literal that Number() would accept', () => {
		expect(parsePlanNumericText('1/2', field('length'))).toEqual({ ok: false, reason: 'not-a-number' });
		expect(parsePlanNumericText('0x10', field('length'))).toEqual({ ok: false, reason: 'not-a-number' });
		expect(parsePlanNumericText('abc', field('length'))).toEqual({ ok: false, reason: 'not-a-number' });
		// An exponent is a literal, not an expression.
		expect(parsePlanNumericText('1e2', field('length'))).toEqual({ ok: true, value: 100 });
		expect(parsePlanNumericText('1e999', field('length'))).toEqual({ ok: false, reason: 'not-finite' });
	});

	it('refuses blank rather than committing zero', () => {
		expect(parsePlanNumericText('', field('length'))).toEqual({ ok: false, reason: 'blank' });
		expect(parsePlanNumericText('   ', field('length'))).toEqual({ ok: false, reason: 'blank' });
		expect(parsePlanNumericText('m', field('length'))).toEqual({ ok: false, reason: 'not-a-number' });
	});

	it('keeps zero out of Length and Width but allows it where the domain does', () => {
		expect(parsePlanNumericText('0', field('length'))).toEqual({ ok: false, reason: 'not-positive' });
		expect(parsePlanNumericText('-1', field('length'))).toEqual({ ok: false, reason: 'sign-not-allowed' });
		expect(parsePlanNumericText('0', field('offset', 'opening-insert'))).toEqual({ ok: true, value: 0 });
		expect(parsePlanNumericText('-0.5', field('x', 'junction'))).toEqual({ ok: true, value: -0.5 });
	});

	it('names the field in the reason it shows', () => {
		expect(planNumericInvalidMessage('sign-not-allowed', field('length'))).toBe('Length cannot be negative');
		expect(planNumericInvalidMessage('not-positive', field('width', 'rectangle'))).toBe(
			'Width must be greater than zero'
		);
		const reasons = [
			'blank',
			'not-a-number',
			'not-finite',
			'unit-not-allowed',
			'sign-not-allowed',
			'not-positive'
		] as const;
		for (const reason of reasons) {
			expect(planNumericInvalidMessage(reason, field('length', 'wall-chain')).length).toBeGreaterThan(0);
		}
	});
});

describe('field text', () => {
	it('formats at the field display precision and never shows a signed zero', () => {
		expect(planNumericFieldText(2.5, field('length'))).toBe('2.50');
		expect(planNumericFieldText(-0, field('length'))).toBe('0.00');
		expect(planNumericFieldText(30, field('angle'))).toBe('30.0');
	});

	it('seeds an empty field when there is no canonical value yet', () => {
		expect(planNumericFieldText(null, field('length'))).toBe('');
		expect(planNumericFieldText(undefined, field('length'))).toBe('');
		expect(planNumericFieldText(Number.NaN, field('length'))).toBe('');
	});
});

describe('angles', () => {
	it('converts degrees to the canonical unit direction', () => {
		const east = planNumericAngleDirection(0);
		expect(east[0]).toBeCloseTo(1);
		expect(east[1]).toBeCloseTo(0);
		const south = planNumericAngleDirection(90);
		expect(south[0]).toBeCloseTo(0);
		expect(south[1]).toBeCloseTo(1);
		const north = planNumericAngleDirection(-90);
		expect(north[1]).toBeCloseTo(-1);
	});

	it('reads a direction back with S6s own convention', () => {
		// `atan2(dz, dx)` in degrees — the leg angle the dimension text shows.
		expect(planNumericAngleDegrees(0, 1)).toBeCloseTo(90);
		expect(planNumericAngleDegrees(-1, 0)).toBeCloseTo(180);
		expect(planNumericAngleDegrees(1, 1)).toBeCloseTo(45);
	});

	it('round-trips a typed angle through the direction and back', () => {
		for (const angle of [0, 30, 45, -120, 179.9]) {
			const [dx, dz] = planNumericAngleDirection(angle);
			expect(planNumericAngleDegrees(dx, dz)).toBeCloseTo(angle);
		}
	});
});

describe('Tab', () => {
	it('cycles forward within the set and wraps', () => {
		const length = open('wall-chain', '3');
		const angle = planNumericEntryTab(length, 'forward', { angle: 45 });
		expect(planNumericEntryField(angle).id).toBe('angle');
		// The newly focused field is re-seeded from its own candidate.
		expect(angle.text).toBe('45.0');
		expect(planNumericEntryField(planNumericEntryTab(angle, 'forward', { length: 3 })).id).toBe('length');
	});

	it('cycles backward and wraps', () => {
		const length = open('wall-chain', '3');
		const angle = planNumericEntryTab(length, 'backward', { angle: 12 });
		expect(planNumericEntryField(angle).id).toBe('angle');
		expect(angle.text).toBe('12.0');
	});

	it('stays inside the host field set and clears the previous refusal', () => {
		const insert = open('opening-insert', '3', {});
		const second = planNumericEntryTab({ ...insert, invalidReason: 'not-a-number' }, 'forward', { offset: 0.9 });
		expect(planNumericEntryField(second).id).toBe('offset');
		expect(second.invalidReason).toBeNull();
		expect(planNumericEntryField(planNumericEntryTab(second, 'forward', { width: 0.9 })).id).toBe('width');
	});

	it('seeds an empty field when the next field has no canonical value', () => {
		const tabbed = planNumericEntryTab(open('wall-chain', '3'), 'forward', {});
		expect(tabbed.text).toBe('');
		expect(planNumericEntryCandidate(tabbed)).toBeNull();
	});
});

describe('Enter', () => {
	it('submits once and ignores every later Enter on the same editor', () => {
		const state = planNumericEntryInput(open('wall-chain', '4'), '4.5');
		const first = planNumericEntrySubmit(state);
		expect(first.kind).toBe('commit');
		if (first.kind !== 'commit') return;
		expect(first.values).toEqual({ length: 4.5 });
		expect(first.state.submitted).toBe(true);
		// Key repeat, or a stray second event, must not commit twice.
		expect(planNumericEntrySubmit(first.state).kind).toBe('ignored');
	});

	it('submits every field the user typed into, resolved together', () => {
		// The owner call on review finding 1: "Enter submits once" bounds the count of
		// commits, not their reach. Typing a length, Tab, then an angle describes ONE
		// segment, and the canonical resolver already takes the pair at once.
		const length = planNumericEntryInput(open('wall-chain', '3'), '3.37');
		const angle = planNumericEntryTab(length, 'forward', { angle: -46 });
		const typedAngle = planNumericEntryInput(angle, '-30');
		const outcome = planNumericEntrySubmit(typedAngle);
		expect(outcome.kind).toBe('commit');
		if (outcome.kind !== 'commit') return;
		expect(outcome.values).toEqual({ length: 3.37, angle: -30 });
	});

	it('leaves a field the user never touched out of the submission', () => {
		// A seeded value is a display of the live candidate, not a choice: freezing it
		// would make the pointer useless the moment a field appeared.
		const length = planNumericEntryInput(open('wall-chain', '3'), '3.37');
		const angle = planNumericEntryTab(length, 'forward', { angle: -46 });
		expect(angle.text).toBe('-46.0');
		const outcome = planNumericEntrySubmit(angle);
		if (outcome.kind !== 'commit') throw new Error('expected a commit');
		expect(outcome.values).toEqual({ length: 3.37 });
	});

	it('keeps a typed value across Tab in both directions', () => {
		const typed = planNumericEntryInput(open('wall-chain', '3'), '3.37');
		const angle = planNumericEntryTab(typed, 'forward', { angle: -46 });
		expect(angle.text).toBe('-46.0');
		const back = planNumericEntryTab(angle, 'backward', { length: 9 });
		// The live candidate moved to 9, but the user's explicit 3.37 stands.
		expect(planNumericEntryField(back).id).toBe('length');
		expect(back.text).toBe('3.37');
	});

	it('refuses the whole submission and focuses the field the reason is about', () => {
		const length = planNumericEntryInput(open('wall-chain', '3'), '3.37');
		const angle = planNumericEntryTab(length, 'forward', { angle: -46 });
		const bad = planNumericEntryInput(angle, '1/2');
		const outcome = planNumericEntrySubmit(bad);
		expect(outcome.kind).toBe('refuse');
		if (outcome.kind !== 'refuse') return;
		expect(outcome.reason).toBe('not-a-number');
		expect(outcome.field.id).toBe('angle');
		// Both explicit values survive the refusal, so both can be corrected.
		expect(outcome.state.fieldIndex).toBe(1);
		expect(outcome.state.typed).toEqual({ length: '3.37', angle: '1/2' });
		const fixed = planNumericEntrySubmit(planNumericEntryInput(outcome.state, '-30'));
		if (fixed.kind !== 'commit') throw new Error('expected a commit');
		expect(fixed.values).toEqual({ length: 3.37, angle: -30 });
	});

	it('keeps the snap suppressed while an explicit value waits on another field', () => {
		const length = planNumericEntryInput(open('wall-chain', '3'), '3.37');
		const angle = planNumericEntryTab(length, 'forward', { angle: -46 });
		expect(planNumericEntryHoldsExplicitValue(angle)).toBe(true);
	});

	it('refuses an invalid value with a reason, no value, and no history', () => {
		const state = planNumericEntryInput(open('wall-chain', '4'), 'abc');
		const outcome = planNumericEntrySubmit(state);
		expect(outcome.kind).toBe('refuse');
		if (outcome.kind !== 'refuse') return;
		expect(outcome.reason).toBe('not-a-number');
		// Nothing to hand a planner: a refusal carries no value at all.
		expect('value' in outcome).toBe(false);
		// Still editable, still unsubmitted — a corrected Enter commits once.
		expect(outcome.state.text).toBe('abc');
		expect(outcome.state.submitted).toBe(false);
		const corrected = planNumericEntrySubmit(planNumericEntryInput(outcome.state, '3'));
		expect(corrected.kind).toBe('commit');
	});

	it('submits a centimetre entry as meters', () => {
		const state = planNumericEntryInput(open('wall-chain', '4'), '250cm');
		const outcome = planNumericEntrySubmit(state);
		expect(outcome.kind).toBe('commit');
		if (outcome.kind !== 'commit') return;
		expect(outcome.values).toEqual({ length: 2.5 });
	});

	it('submits the seeded value untouched when the user typed digits only', () => {
		expect(planNumericEntrySubmit(open('wall-chain', '7')).kind).toBe('commit');
	});

	it('refuses on a blank field rather than committing the candidate', () => {
		const blanked = planNumericEntryInput(open('wall-chain', '7'), '');
		const outcome = planNumericEntrySubmit(blanked);
		expect(outcome.kind).toBe('refuse');
		if (outcome.kind !== 'refuse') return;
		expect(outcome.reason).toBe('blank');
	});
});

describe('exits', () => {
	it('restores the candidate on Escape and cancels the gesture on the second', () => {
		const state = open('wall-chain', '3');
		expect(planNumericEntryEscape(state)).toBe('restore');
		// The field is gone; the next Escape belongs to the gesture itself.
		expect(planNumericEntryEscape(null)).toBe('cancel-gesture');
	});

	it('never commits on blur', () => {
		expect(planNumericEntryBlur(open('wall-chain', '3'))).toBe('discard');
		expect(planNumericEntryBlur(null)).toBeNull();
	});

	it('consumes a drag pointer-up exactly once and leaves the editor open', () => {
		const state = open('wall-chain', '3');
		const first = planNumericPointerUp(state);
		expect(first.consumed).toBe(true);
		expect(first.state?.pointerUpConsumed).toBe(true);
		// Enter still submits after the drag ended.
		expect(planNumericEntrySubmit(first.state!).kind).toBe('commit');
		expect(planNumericPointerUp(first.state).consumed).toBe(false);
	});

	it('does not consume a pointer-up for a click-based draft', () => {
		const state = planNumericEntryTrigger(KEY('3'), { host: 'wall-chain' })!;
		expect(planNumericPointerUp(state).consumed).toBe(false);
		expect(planNumericPointerUp(null).consumed).toBe(false);
	});
});

describe('explicit value', () => {
	it('suppresses the snap only once the field holds a valid value', () => {
		expect(planNumericEntryHoldsExplicitValue(null)).toBe(false);
		expect(planNumericEntryHoldsExplicitValue(open('wall-chain', '3'))).toBe(true);
		expect(planNumericEntryHoldsExplicitValue(open('wall-chain', '.'))).toBe(false);
		expect(planNumericEntryHoldsExplicitValue(planNumericEntryInput(open('wall-chain', '3'), ''))).toBe(false);
	});

	it('holds an explicit value on a signed field', () => {
		expect(planNumericEntryHoldsExplicitValue(planNumericEntryTrigger(KEY('-'), { host: 'junction' })!)).toBe(
			false
		);
		expect(
			planNumericEntryHoldsExplicitValue(
				planNumericEntryInput(planNumericEntryTrigger(KEY('-'), { host: 'junction' })!, '-2.5')
			)
		).toBe(true);
	});
});

/**
 * S10's readout: §9 requires the keyboard announcement to carry the focused
 * control's *current value and units*. The value has to be the one the field
 * shows when Enter opens it — same label, same decimals — so these pin the
 * shared formatter rather than a second spelling of the same number.
 */
describe('field readout (§9 keyboard announcement)', () => {
	it('spells a length with its label, its decimals and meters', () => {
		const [width] = planNumericFields('opening-resize');
		expect(planNumericFieldReadout(0.9, width!)).toBe('Width 0.90 m');
		expect(planNumericFieldReadout(2.3, planNumericFields('opening-slide')[0]!)).toBe('Offset 2.30 m');
	});

	it('spells an angle in degrees, at the field’s own precision', () => {
		const yaw = planNumericFields('object-transform').find((field) => field.id === 'yaw')!;
		expect(planNumericFieldReadout(45, yaw)).toBe('Rotation 45.0°');
	});

	it('announces no value rather than a fabricated zero', () => {
		const [width] = planNumericFields('opening-resize');
		expect(planNumericFieldReadout(null, width!)).toBeNull();
		expect(planNumericFieldReadout(Number.NaN, width!)).toBeNull();
		expect(planNumericHostReadout('opening-resize', { width: null })).toBeNull();
	});

	it('joins a host’s own fields in Tab order, and reports only the measures it was given', () => {
		expect(planNumericHostReadout('junction', { x: 3.2, z: 1.4 })).toBe('X 3.20 m, Z 1.40 m');
		expect(planNumericHostReadout('junction', { x: 3.2 })).toBe('X 3.20 m');
	});
});

describe('domains', () => {
	it('keeps every ratifyable domain spelled the same way in every set', () => {
		const domains: PlanNumericDomain[] = ['positive', 'nonnegative', 'signed'];
		for (const host of Object.keys(PLAN_NUMERIC_FIELD_SETS) as PlanNumericHost[]) {
			for (const entry of planNumericFields(host)) {
				expect(domains).toContain(entry.domain);
			}
		}
	});
});
