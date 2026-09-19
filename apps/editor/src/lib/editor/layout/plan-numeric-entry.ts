/**
 * `plan-numeric-entry.ts` — P23.13 S7: the ratified numeric-entry lifecycle
 * (spec §7 "Adopt optional type-to-enter", A5's keyboard contract).
 *
 * Before S7 the viewport had one honest answer to "what does typing do while
 * drafting": nothing. §7 ratifies a small editor instead, and it is deliberately
 * **one** editor for every gesture — a finite field set per host, a trigger that
 * depends on the field's *canonical domain* rather than its label, units that are
 * parsed but never guessed, and exactly the exits §7 lists (Enter once, Escape to
 * restore then cancel, blur never commits, tool change cancels).
 *
 * Nothing here measures geometry, solves, or writes history. A parsed value is
 * handed to the same canonical planner the pointer path calls, so an explicit
 * value cannot reach acceptance by a second route — which is why the module stops
 * at "this field holds this number, valid or refused with a reason" and never
 * claims to know an endpoint. That is also why the module needs no browser: the
 * suite runs in vitest's `node` environment, and the lifecycle a reviewer cares
 * about (Enter once, Tab wrap, Escape restore, invalid stays editable) is decided
 * here rather than in an untestable `onkeydown`.
 */

/** A field's canonical domain — never its display label — decides the trigger. */
export type PlanNumericDomain =
	/** Strictly greater than zero: §7 ratifies "Length/Width must be positive". */
	| 'positive'
	/** Zero is a legal value (an offset flush with the canonical start). */
	| 'nonnegative'
	/** Negative values are legal (signed angle, movement delta, world coordinate). */
	| 'signed';

export type PlanNumericUnit = 'length' | 'angle';

export type PlanNumericFieldId =
	| 'length'
	| 'angle'
	| 'width'
	| 'depth'
	| 'offset'
	| 'dx'
	| 'dz'
	| 'x'
	| 'z'
	| 'yaw';

export type PlanNumericField = {
	readonly id: PlanNumericFieldId;
	/** §7's own word for the field, so the form and the spec agree. */
	readonly label: string;
	readonly unit: PlanNumericUnit;
	readonly domain: PlanNumericDomain;
	/**
	 * Decimal places the field displays at. Display rounding is presentation:
	 * the parsed value keeps full precision (S6's rule, same instrument).
	 */
	readonly decimals: number;
};

/** A meter-valued field. */
function meters(
	id: PlanNumericFieldId,
	label: string,
	domain: PlanNumericDomain,
	decimals = 2
): PlanNumericField {
	return { id, label, unit: 'length', domain, decimals };
}

/**
 * #35 (§7) — the canonical axis a field measures, or `null` when the field is a
 * magnitude/angle and has none. Only axis-valued fields get the spatial axis
 * ink; painting ΔX red because it is "a number" would teach the wrong reading,
 * because red/green/blue are the transform axes' spatial meaning (DS §8).
 */
export function planNumericFieldAxis(field: PlanNumericField): 'x' | 'y' | 'z' | null {
	switch (field.id) {
		case 'x':
		case 'dx':
			return 'x';
		case 'z':
		case 'dz':
			return 'z';
		default:
			return null;
	}
}

/** A degree-valued field. Angles are the only signed numeric §7 displays. */
function degrees(id: PlanNumericFieldId, label: string, domain: PlanNumericDomain = 'signed'): PlanNumericField {
	return { id, label, unit: 'angle', domain, decimals: 1 };
}

/**
 * The numeric host a gesture offers fields for. §7's table fixes the automatic
 * measures; "Adopt optional type-to-enter" fixes which of them are enterable, and
 * rows the spec does not ratify for entry (area, clearance, object bounding
 * boxes) have no host here at all — absence is the enforcement.
 */
export type PlanNumericHost =
	/** Straight Wall draw: "Length, angle" (§7 row 1). */
	| 'wall-chain'
	/**
	 * An *existing* Wall, reached from explicit focus (A5's "focused selected
	 * primary dimension"): the same Length/Angle pair §7 grants the draw, but the
	 * command is an edit of that Wall rather than a new segment. One host per
	 * *command*, never one per field set — the field sets are where the spec's
	 * table lives, and two commands that offer the same fields are still two
	 * commands.
	 */
	| 'wall-edit'
	/** Rect Room: "Width + depth" (§7 row Rect Room). */
	| 'rectangle'
	/** Opening insert: type-to-enter "width/offset". */
	| 'opening-insert'
	/** Opening slide: type-to-enter "offset/width". */
	| 'opening-slide'
	/** Opening resize: the same offset/width pair, width primary. */
	| 'opening-resize'
	/** Rigid Wall move: "ΔX / ΔZ". */
	| 'wall-move'
	/** Junction move: "X/Z when numeric editing". */
	| 'junction'
	/** Curve bend point: "active point X/Z on focus". */
	| 'curve-point'
	/** Layout object transform: "supported size/delta/yaw only". */
	| 'object-transform';

/**
 * The finite applicable field set per host, in Tab order. The first field is the
 * **primary** one §7's digit trigger starts in; the order is the ratified
 * reading order, so Tab is predictable rather than alphabetical.
 */
export const PLAN_NUMERIC_FIELD_SETS = {
	'wall-chain': [meters('length', 'Length', 'positive'), degrees('angle', 'Angle')],
	'wall-edit': [meters('length', 'Length', 'positive'), degrees('angle', 'Angle')],
	rectangle: [meters('width', 'Width', 'positive'), meters('depth', 'Depth', 'positive')],
	'opening-insert': [meters('width', 'Width', 'positive'), meters('offset', 'Offset', 'nonnegative')],
	'opening-slide': [meters('offset', 'Offset', 'nonnegative'), meters('width', 'Width', 'positive')],
	'opening-resize': [meters('width', 'Width', 'positive'), meters('offset', 'Offset', 'nonnegative')],
	'wall-move': [meters('dx', 'ΔX', 'signed'), meters('dz', 'ΔZ', 'signed')],
	junction: [meters('x', 'X', 'signed'), meters('z', 'Z', 'signed')],
	'curve-point': [meters('x', 'X', 'signed'), meters('z', 'Z', 'signed')],
	'object-transform': [
		meters('width', 'Width', 'positive'),
		meters('depth', 'Depth', 'positive'),
		degrees('yaw', 'Rotation')
	]
} as const satisfies Record<PlanNumericHost, readonly PlanNumericField[]>;

/** The applicable fields for a host, in Tab order. */
export function planNumericFields(host: PlanNumericHost): readonly PlanNumericField[] {
	return PLAN_NUMERIC_FIELD_SETS[host];
}

/**
 * The live candidate value per field, for seeding. A `null` candidate means "no
 * canonical value yet" (a Junction that does not exist, a draft with no leg), and
 * seeds an empty field rather than a fabricated zero: blank is invalid, not zero
 * — the same rule the Inspector's precision editors already keep.
 */
export type PlanNumericCandidates = Partial<Record<PlanNumericFieldId, number | null>>;

// ---------------------------------------------------------------------------
// Explicit focus (A5's second reach)
// ---------------------------------------------------------------------------

/**
 * Where an *explicit* focus opens the editor — §7's "typing while drafting;
 * explicit click/focus otherwise", ratified as A5: "numeric editing during
 * gestures **and** from explicitly focused selected primary dimensions". The
 * spec gives two ways in: "click on its underlined value is the pointer
 * alternative; keyboard-focused control + Enter is the discoverable
 * alternative", and "Idle dimensions remain passive unless explicitly
 * focused".
 *
 * A target therefore names three things and nothing else: which host's fields
 * are being edited, which field the caret starts in, and which canonical owner
 * the number belongs to. It carries no value and no geometry — the caller seeds
 * it from canonical state exactly as it seeds a gesture-driven entry, so an
 * explicit focus cannot become a second route to acceptance either.
 */
export type PlanNumericEntryTarget = {
	readonly host: PlanNumericHost;
	readonly fieldId: PlanNumericFieldId;
	readonly ownerId: string;
};

/**
 * The resting dimension keys that carry an entry, and the field each one means.
 * The keys are §7's measures as the Plan already derives them (`plan-dimensions`),
 * so the mapping cannot drift from the instrument: a dimension the derivation
 * stops producing simply has no target.
 */
const PLAN_NUMERIC_DIMENSION_TARGETS: readonly {
	readonly prefix: string;
	readonly host: PlanNumericHost;
	readonly fieldId: PlanNumericFieldId;
}[] = [
	// §7's "Selected, idle" row for a straight Wall: "Length only; angle through
	// focused precision" — the focus opens the Length, and the Angle is one Tab
	// away rather than a second resting measure.
	{ prefix: 'selected-wall:', host: 'wall-edit', fieldId: 'length' },
	// Offset before Width: `selected-opening-offset:` reads as
	// `selected-opening:` with a suffix, and matching the shorter prefix first
	// would open the editor on the wrong number of the same Opening.
	{ prefix: 'selected-opening-offset:', host: 'opening-resize', fieldId: 'offset' },
	{ prefix: 'selected-opening:', host: 'opening-resize', fieldId: 'width' }
];

/**
 * The entry a resting dimension carries, or `null` when it carries none. Null is
 * a real answer and the common one: a measure the spec leaves passive is not
 * offered an editor, so a Room's identity label or an arc length never acquires
 * an affordance it cannot honour.
 */
export function planNumericDimensionEntryTarget(dimensionKey: string): PlanNumericEntryTarget | null {
	for (const target of PLAN_NUMERIC_DIMENSION_TARGETS) {
		if (!dimensionKey.startsWith(target.prefix)) continue;
		const ownerId = dimensionKey.slice(target.prefix.length);
		if (!ownerId) continue;
		return { host: target.host, fieldId: target.fieldId, ownerId };
	}
	return null;
}

/**
 * The entry a **resting** measure offers, or `null`. This is the rule both
 * consumers of A5's second reach apply, so the affordance and the target cannot
 * disagree: the paint layer underlines exactly the values this answers a target
 * for, and the viewport hit-tests exactly the same ones.
 *
 * A curved host's length is the case the rule exists for. §7 measures it
 * canonically ("curves use canonical arc length, explicitly identified"), but
 * setting an exact length on a curve is a chord solve the canonical planner
 * refuses as unsupported — so the measure is *not* offered an editor rather than
 * offered and then refused. §7's "invalid values stay editable with a reason" is
 * about a value the user typed; an invitation the Plan knows it cannot honour is
 * a different thing, and §7 asks for quiet.
 */
export function planNumericRestingEntryTarget(measure: {
	readonly key: string;
	readonly arc?: boolean;
}): PlanNumericEntryTarget | null {
	if (measure.arc) return null;
	return planNumericDimensionEntryTarget(measure.key);
}

/**
 * The entry a focused *control* carries — §7's "keyboard-focused control + Enter
 * is the discoverable alternative", read against the control vocabulary §6
 * already ratifies.
 *
 * Only a control whose canonical command exists is a target. `curve-control`
 * ("active point X/Z on focus") and the two rotation controls have no exact
 * command wired here, and a control with nothing to reach is left unoffered
 * rather than opened onto a second solver — the same "absence is the
 * enforcement" rule the field sets keep. `null` is that answer.
 */
const PLAN_NUMERIC_CONTROL_TARGETS: Readonly<Record<string, { host: PlanNumericHost; fieldId: PlanNumericFieldId }>> = {
	// §7: "Junction move … Coordinates on focused handle".
	junction: { host: 'junction', fieldId: 'x' },
	// §7: "Opening insert / slide | Width; offset on focus" and "Opening resize |
	// Width" — the width edge is the handle §7 grants the width to.
	'opening-edge': { host: 'opening-resize', fieldId: 'width' },
	// The paired body grip is the offset's own handle (§7: "offset on focus").
	'opening-slide': { host: 'opening-slide', fieldId: 'offset' }
};

export function planNumericControlEntryTarget(
	control: string,
	ownerId: string
): PlanNumericEntryTarget | null {
	const target = PLAN_NUMERIC_CONTROL_TARGETS[control];
	if (!target || !ownerId) return null;
	return { host: target.host, fieldId: target.fieldId, ownerId };
}

/**
 * Open the editor **on the value it replaces**, with no keystroke to start it:
 * §7's "Entry replaces the displayed value with a small input at the same
 * location", reached by clicking the underlined value rather than by typing.
 *
 * The difference from the digit trigger is exactly what the user has said so
 * far. A digit *is* an explicit value — it replaces the candidate outright — so
 * the trigger seeds `typed` with the keystroke and the candidate is only a
 * placeholder. Clicking the value says "edit this number", not "this number":
 * the field opens showing the canonical value, editable and selected, and a field
 * with no canonical value opens blank and refused (`Exact value is blank`) rather
 * than pretending to hold a zero.
 *
 * What the user has *not* said is the number itself, so `typed` stays **empty**.
 * Seeding it with the displayed text would be a value the user never chose — and
 * worse, a *rounded* one: the field shows two decimals, so an untouched submit of
 * a 2.675 m Wall would compare 2.68 against 2.675, decide the field had changed,
 * and write 5 mm of geometry plus a history entry for a keystroke that said
 * nothing. `display rounding ≠ precision` is S6's invariant for this same
 * instrument; keeping `typed` empty is what keeps it true here. It also keeps
 * §7's suppression rule honest: "showing the candidate is not choosing it", so
 * the snap winner stays until the first keystroke, and an untouched Enter reaches
 * the caller with no values at all, which is a fact it can act on structurally
 * rather than by comparing floats.
 */
export function planNumericEntryOpen(
	target: PlanNumericEntryTarget,
	candidates: PlanNumericCandidates = {}
): PlanNumericEntryState {
	const fields = planNumericFields(target.host);
	const found = fields.findIndex((field) => field.id === target.fieldId);
	const fieldIndex = found < 0 ? 0 : found;
	const text = planNumericFieldText(candidates[fields[fieldIndex].id] ?? null, fields[fieldIndex]);
	return {
		host: target.host,
		fields,
		fieldIndex,
		candidates,
		text,
		// Empty on purpose, not because no value is shown: the text above *is* the
		// value, and the first keystroke replaces it (`planNumericEntryInput`).
		typed: {},
		dragActive: false,
		pointerUpConsumed: false,
		submitted: false,
		invalidReason: text === '' ? 'blank' : null
	};
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Why a typed value was refused. Each reason is a *different user action*, so
 * they are not collapsed into one "invalid": "cannot be negative" and "must be
 * greater than zero" ask the user for different things.
 */
export type PlanNumericInvalidReason =
	| 'blank'
	| 'not-a-number'
	| 'not-finite'
	| 'unit-not-allowed'
	| 'sign-not-allowed'
	| 'not-positive';

export type PlanNumericParse =
	| { ok: true; value: number }
	| { ok: false; reason: PlanNumericInvalidReason };

/**
 * A numeric literal, and nothing else. `Number()` alone would accept `0x10`,
 * `Infinity` and `1e999`, which is a command language §7 explicitly does not
 * want; the exponent form stays because it is a numeric literal, not an
 * expression.
 */
const PLAN_NUMERIC_LITERAL = /^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;

/** Accepted spellings per unit, longest first so `cm` cannot be read as `m`. */
const PLAN_NUMERIC_UNIT_TOKENS: Record<PlanNumericUnit, readonly string[]> = {
	length: ['cm', 'centimetre', 'centimetres', 'centimeter', 'centimeters', 'm', 'metre', 'metres', 'meter', 'meters'],
	angle: ['deg', 'degs', 'degree', 'degrees', '°']
};

/** Values per meter for the ratified length suffixes (`m` is the default). */
const PLAN_NUMERIC_METERS_PER: Record<string, number> = { cm: 0.01 };

/**
 * Parse one field's text. Units: lengths default to meters and accept `m`/`cm`
 * spellings; angles are degrees. A suffix the field cannot carry is refused as
 * such rather than as "not a number", because "Only m or cm here" tells the user
 * what to type and "Exact value must be a number" does not. No expression, no
 * silent clamp, no coercion of a sign the domain forbids — a minus typed into a
 * nonnegative field is *text* and is refused with its own reason.
 */
export function parsePlanNumericText(text: string, field: PlanNumericField): PlanNumericParse {
	// A locale decimal separator is a separator, not an expression; accept both.
	const normalized = text.trim().replace(/,/g, '.');
	if (!normalized) return { ok: false, reason: 'blank' };

	const suffixMatch = /^(.*?)\s*([a-z°]+)$/i.exec(normalized);
	// A suffix is only a *unit* when a number precedes it: `abc` is a number the
	// user has not finished typing, and answering it with "Only m or cm here"
	// would blame the wrong half of the entry.
	const hasBody = suffixMatch !== null && suffixMatch[1].trim().length > 0;
	const body = suffixMatch && hasBody ? suffixMatch[1].trim() : normalized;
	const suffix = suffixMatch && hasBody ? suffixMatch[2].toLowerCase() : '';

	let scale = 1;
	if (suffix) {
		const token = PLAN_NUMERIC_UNIT_TOKENS[field.unit].find(
			(candidate) => candidate === suffix || (candidate.length > 1 && suffix.startsWith(candidate))
		);
		if (!token) return { ok: false, reason: 'unit-not-allowed' };
		scale = PLAN_NUMERIC_METERS_PER[token] ?? 1;
	}

	if (!body || !PLAN_NUMERIC_LITERAL.test(body)) return { ok: false, reason: 'not-a-number' };
	if (field.domain !== 'signed' && body.startsWith('-')) return { ok: false, reason: 'sign-not-allowed' };

	const scaled = Number(body) * scale;
	if (!Number.isFinite(scaled)) return { ok: false, reason: 'not-finite' };
	if (field.domain === 'positive' && scaled <= 0) return { ok: false, reason: 'not-positive' };
	return { ok: true, value: scaled };
}

/**
 * The reason shown beside an editable, refused value. Kept in the Inspector's
 * established voice ("Exact value …") so the two numeric surfaces read as one
 * editor, and it always names the field's own constraint rather than a guess.
 */
export function planNumericInvalidMessage(reason: PlanNumericInvalidReason, field: PlanNumericField): string {
	switch (reason) {
		case 'blank':
			return 'Exact value is blank';
		case 'not-a-number':
			return 'Exact value must be a number';
		case 'not-finite':
			return 'Exact value must be finite';
		case 'unit-not-allowed':
			return field.unit === 'angle' ? 'Angles are degrees' : 'Only m or cm here';
		case 'sign-not-allowed':
			return `${field.label} cannot be negative`;
		case 'not-positive':
			return `${field.label} must be greater than zero`;
	}
}

/** The field's display text for a value; `null`/non-finite seeds an empty field. */
export function planNumericFieldText(value: number | null | undefined, field: PlanNumericField): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '';
	// `-0` is a signed zero, not a negative measurement; showing `-0.00` would
	// suggest a value the field never held.
	return (value === 0 ? 0 : value).toFixed(field.decimals);
}

/**
 * §9's readout text for one field of a host: `Width 0.90 m`, `Rotation 45.0°`.
 *
 * The keyboard readout must announce "name/reference, control role, current
 * value and units", and the value it announces has to be the one the same field
 * shows when Enter opens it — same label, same decimals, same unit — so
 * `planNumericFieldText` stays the one formatter rather than gaining a
 * differently-rounded sibling. `null` (no canonical value yet) announces *no*
 * value rather than a fabricated zero, the same rule a blank field keeps.
 */
export function planNumericFieldReadout(
	value: number | null | undefined,
	field: PlanNumericField
): string | null {
	const text = planNumericFieldText(value, field);
	if (!text) return null;
	return `${field.label} ${text}${field.unit === 'angle' ? '°' : ' m'}`;
}

/**
 * The readout for a host's field set, in the host's own Tab order, joined for
 * one utterance: a Junction or curve point reads `X 3.20 m, Z 1.40 m`, an
 * Opening width edge reads `Width 0.90 m` on its own. A host is only ever asked
 * for the field(s) the control actually owns, so a caller passing one candidate
 * gets one measure instead of every field the host could offer; `null` when none
 * of them has a canonical value.
 */
export function planNumericHostReadout(
	host: PlanNumericHost,
	candidates: PlanNumericCandidates
): string | null {
	const parts: string[] = [];
	for (const field of planNumericFields(host)) {
		const part = planNumericFieldReadout(candidates[field.id], field);
		if (part) parts.push(part);
	}
	return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Degrees → the canonical unit direction. `planExactWallAngle` sets
 * `direction = [cos θ, sin θ]` in (x, z) radians, so this is the one place the
 * editor converts a typed angle into the same vector the planner would derive.
 */
export function planNumericAngleDirection(degreesValue: number): [number, number] {
	const radians = (degreesValue * Math.PI) / 180;
	return [Math.cos(radians), Math.sin(radians)];
}

/**
 * The canonical angle of a (dx, dz) direction in degrees, for seeding the angle
 * field. S6's dimension text uses this same `atan2(dz, dx)` convention, so the
 * number the user reads on the leg is the number they type back.
 */
export function planNumericAngleDegrees(dx: number, dz: number): number {
	return (Math.atan2(dz, dx) * 180) / Math.PI;
}

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

export type PlanNumericEntryRequest = {
	readonly host: PlanNumericHost;
	readonly candidates?: PlanNumericCandidates;
	/**
	 * True when a pointer drag is in flight: §7's active-drag rule consumes that
	 * drag's eventual pointer-up without committing.
	 */
	readonly dragActive?: boolean;
};

/** The key event fields the trigger is allowed to care about, and nothing else. */
export type PlanNumericTriggerEvent = {
	readonly key: string;
	readonly isComposing?: boolean;
	readonly metaKey?: boolean;
	readonly ctrlKey?: boolean;
	readonly altKey?: boolean;
};

/**
 * §7's trigger, as a decision about *which* field the keystroke means.
 *
 * A digit or decimal separator starts entry in the **primary** field, and the
 * typed character *replaces* the displayed value (§7: "Entry replaces the
 * displayed value with a small input at the same location") rather than appending
 * to it. `-` starts entry in the first **signed** field of the set, and starts
 * nothing when the set has none — §7 permits it "only for a field whose canonical
 * domain allows negative values" and says in the same breath that it "does not
 * start Length, Width, or canonical-start Opening offset entry". Reading those two
 * clauses together is what fixes the target: on the Wall draw the set is
 * `[Length, Angle]`, and Tab cannot reach the angle *before* entry exists
 * (`Tab cycles forward through the finite applicable field set` — within the
 * active editor), so a `-` that refused to start the signed angle would make a
 * negative angle unreachable by keyboard while the spec calls that trigger
 * ratified. A set whose fields are all nonnegative (`Length`/`Width`/`Offset`)
 * starts nothing, and the `-` falls through to the shell.
 *
 * Composition events and keys belonging to other text fields never intercept, and
 * neither do modifier chords: the idle Plan must never hijack a global shortcut.
 */
export function planNumericEntryTrigger(
	event: PlanNumericTriggerEvent,
	request: PlanNumericEntryRequest
): PlanNumericEntryState | null {
	if (event.isComposing) return null;
	if (event.metaKey || event.ctrlKey || event.altKey) return null;
	if (event.key.length !== 1) return null;

	const fields = planNumericFields(request.host);
	const isDigit = /^[0-9]$/.test(event.key);
	let fieldIndex = 0;
	if (!isDigit && event.key !== '.' && event.key !== ',') {
		if (event.key !== '-') return null;
		fieldIndex = fields.findIndex((field) => field.domain === 'signed');
		if (fieldIndex < 0) return null;
	}

	const field = fields[fieldIndex];
	// The seed is validated like any other text: a lone `.` or `-` is an entry in
	// progress, not an error to hide, and not a value to submit either.
	const seeded = parsePlanNumericText(event.key, field);
	return {
		host: request.host,
		fields,
		fieldIndex,
		candidates: request.candidates ?? {},
		text: event.key,
		// The triggering keystroke *is* an explicit value: the user typed it.
		typed: { [field.id]: event.key },
		dragActive: request.dragActive === true,
		pointerUpConsumed: false,
		submitted: false,
		invalidReason: seeded.ok ? null : seeded.reason
	};
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * One open field. Every exit returns `null` (the entry is gone) so the caller
 * cannot keep editing a field the user left — the viewport's job is only to
 * mirror this state into an input element.
 */
export type PlanNumericEntryState = {
	readonly host: PlanNumericHost;
	readonly fields: readonly PlanNumericField[];
	readonly fieldIndex: number;
	/** The live candidate per field, as the gesture supplied them. */
	readonly candidates: PlanNumericCandidates;
	/** Live text of the focused field — what the input element shows. */
	readonly text: string;
	/**
	 * The text the user *typed*, per field. This is the set of §7's explicit values,
	 * and it exists so Tab cannot discard one: leaving a field keeps what was typed
	 * into it, and Enter applies every one of them to the same candidate (see
	 * `planNumericEntrySubmit`). A value merely *seeded* from the live gesture is
	 * deliberately absent — showing the candidate is not choosing it, so a field the
	 * user never touched must fall back to the pointer, not freeze it.
	 */
	readonly typed: Partial<Record<PlanNumericFieldId, string>>;
	/** A pointer drag was in flight when entry began. */
	readonly dragActive: boolean;
	/** That drag's pointer-up came and was swallowed (never committed). */
	readonly pointerUpConsumed: boolean;
	/** Enter has already submitted this editor instance (Enter submits once). */
	readonly submitted: boolean;
	readonly invalidReason: PlanNumericInvalidReason | null;
};

/** The field the entry is currently in. */
export function planNumericEntryField(state: PlanNumericEntryState): PlanNumericField {
	return state.fields[state.fieldIndex];
}

/**
 * The focused field's live candidate — what it was seeded from, and what its text
 * falls back to when the user typed nothing into it.
 */
export function planNumericEntryCandidate(state: PlanNumericEntryState): number | null {
	return state.candidates[planNumericEntryField(state).id] ?? null;
}

/** The focused field's text: what the user typed, else the live candidate. */
function focusedText(state: PlanNumericEntryState, fieldIndex: number): string {
	const field = state.fields[fieldIndex];
	const typed = state.typed[field.id];
	if (typed !== undefined) return typed;
	return planNumericFieldText(state.candidates[field.id] ?? null, field);
}

/** Move the caret to a field and show its own text, validated. */
function focusField(
	state: PlanNumericEntryState,
	fieldIndex: number,
	overrides: { text?: string; invalidReason?: PlanNumericInvalidReason | null } = {}
): PlanNumericEntryState {
	const text = overrides.text ?? focusedText(state, fieldIndex);
	const field = state.fields[fieldIndex];
	const parsed = parsePlanNumericText(text, field);
	return {
		...state,
		fieldIndex,
		text,
		invalidReason:
			overrides.invalidReason !== undefined
				? overrides.invalidReason
				: text === ''
					? null
					: parsed.ok
						? null
						: parsed.reason
	};
}

export type PlanNumericTabDirection = 'forward' | 'backward' | 1 | -1;

/**
 * §7: "Tab cycles forward through the finite applicable field set; Shift+Tab
 * cycles backward, both wrapping within that active numeric editor." Tab never
 * leaves the editor and never reaches a field the host does not offer.
 *
 * Tab also never *discards* a value: a field the user typed into keeps its own
 * text, so Tab can only ever reveal a different field of the same candidate (the
 * live candidates are refreshed as they come, which is why a field the user left
 * alone still rides the pointer). The opposite reading — leaving a field throwing
 * its text away — would make "type width, Tab, type offset, Enter" impossible,
 * which is the primary flow of every two-field host.
 */
export function planNumericEntryTab(
	state: PlanNumericEntryState,
	direction: PlanNumericTabDirection,
	candidates: PlanNumericCandidates = {}
): PlanNumericEntryState {
	const step = direction === 'forward' || direction === 1 ? 1 : -1;
	const count = state.fields.length;
	const fieldIndex = ((state.fieldIndex + step) % count + count) % count;
	return focusField({ ...state, candidates }, fieldIndex);
}

/** Typing. Validation is continuous, but never a commit by itself. */
export function planNumericEntryInput(state: PlanNumericEntryState, text: string): PlanNumericEntryState {
	const field = planNumericEntryField(state);
	const parsed = parsePlanNumericText(text, field);
	return {
		...state,
		text,
		// Recorded even when refused: an invalid value is still the user's explicit
		// text, and it has to be there to be corrected (never silently dropped).
		typed: { ...state.typed, [field.id]: text },
		invalidReason: parsed.ok ? null : parsed.reason
	};
}

export type PlanNumericSubmitOutcome =
	/**
	 * Every typed value is valid and this Enter is the one submission. `values`
	 * carries one entry per field the user typed into — fields they left alone are
	 * absent, and the caller resolves those from the live gesture. With a single
	 * field typed this is one pair; with both, it is the candidate the user
	 * described, in one commit.
	 */
	| {
			kind: 'commit';
			values: Partial<Record<PlanNumericFieldId, number>>;
			state: PlanNumericEntryState;
		}
	/**
	 * Refused with a reason. The state focuses the field the reason is about, so the
	 * refusal is shown beside the number that caused it rather than beside whatever
	 * field happened to be open.
	 */
	| {
			kind: 'refuse';
			reason: PlanNumericInvalidReason;
			field: PlanNumericField;
			state: PlanNumericEntryState;
		}
	/** This editor instance already submitted (key repeat, or a second Enter). */
	| { kind: 'ignored'; state: PlanNumericEntryState };

/**
 * Enter. §7: "Enter submits once" and "Invalid values stay editable with a
 * reason; no history or allocation". "Once" bounds the *count* of commits, not
 * their reach: one Enter submits every field the user typed into, resolved
 * together, because the canonical resolver already takes the pair at once
 * (`resolveWallChainEndpointAtLength(length, direction)`) and because committing
 * only the focused field would silently discard the other — the failure Tab used
 * to cause one step earlier.
 *
 * The outcome is data, so the caller commits through the canonical planner and
 * this lifecycle stays unable to write history: a refusal is `commits === 0` by
 * construction, not by discipline.
 */
export function planNumericEntrySubmit(state: PlanNumericEntryState): PlanNumericSubmitOutcome {
	if (state.submitted) return { kind: 'ignored', state };
	const values: Partial<Record<PlanNumericFieldId, number>> = {};
	let refused: { index: number; field: PlanNumericField; reason: PlanNumericInvalidReason } | null = null;
	for (const [index, field] of state.fields.entries()) {
		const text = state.typed[field.id];
		if (text === undefined) continue;
		const parsed = parsePlanNumericText(text, field);
		if (parsed.ok) values[field.id] = parsed.value;
		else if (!refused) refused = { index, field, reason: parsed.reason };
	}
	if (refused) {
		const refusal = refused;
		return {
			kind: 'refuse',
			reason: refusal.reason,
			field: refusal.field,
			state: focusField(state, refusal.index, { invalidReason: refusal.reason })
		};
	}
	return { kind: 'commit', values, state: { ...state, submitted: true, invalidReason: null } };
}

/**
 * §7: "Escape in a field restores the pre-entry candidate; second Escape cancels
 * the gesture." An open field restores, and the gesture's own cancel handles the
 * second press (`cancel-gesture` is what an Escape with no field open means).
 *
 * Restoring is not an operation: the proposal was frozen for as long as the field
 * was open, so the canonical candidate was never mutated and there is nothing to
 * reconstruct — the entry simply closes and the proposal resumes following the
 * pointer. Blur is the same closure without the Escape's intent (`discard`).
 */
export type PlanNumericEscapeAction = 'restore' | 'cancel-gesture';

export function planNumericEntryEscape(state: PlanNumericEntryState | null): PlanNumericEscapeAction {
	return state ? 'restore' : 'cancel-gesture';
}

/** §7: "Blur never silently commits." The field closes and nothing is written. */
export type PlanNumericBlurAction = 'discard';

export function planNumericEntryBlur(state: PlanNumericEntryState | null): PlanNumericBlurAction | null {
	return state ? 'discard' : null;
}

/**
 * §7: "In an active pointer drag, typing freezes the proposal, transfers to
 * numeric editing, and consumes the eventual pointer-up without committing."
 * `consumed` is true exactly once per open entry, and the entry stays open
 * afterwards — the pointer-up that ended the drag is not the Enter that submits.
 */
export function planNumericPointerUp(state: PlanNumericEntryState | null): {
	readonly consumed: boolean;
	readonly state: PlanNumericEntryState | null;
} {
	if (!state || !state.dragActive || state.pointerUpConsumed) return { consumed: false, state };
	return { consumed: true, state: { ...state, pointerUpConsumed: true } };
}

/**
 * Whether this entry holds an explicit value, i.e. whether §7's "Explicit values
 * outrank a conflicting snap" applies: the snap winner marker is removed and the
 * relation reports `Exact value` (S5 shipped that presentation; S7 owns setting
 * it). Only a *valid* value suppresses — a half-typed `-` is not an explicit
 * value yet, and suppressing a snap on its behalf would hide the very relation
 * the user is about to override.
 */
export function planNumericEntryHoldsExplicitValue(state: PlanNumericEntryState | null): boolean {
	if (!state) return false;
	// Any typed field counts, not just the focused one: Tab must not hand the snap
	// its winner marker back while an explicit value is still pending on Enter.
	return state.fields.some((field) => {
		const text = state.typed[field.id];
		return text !== undefined && parsePlanNumericText(text, field).ok;
	});
}
