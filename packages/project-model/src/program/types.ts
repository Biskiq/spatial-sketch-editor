/**
 * `ExecutionProgram@4` — the shared visitor program codec (AM-6).
 *
 * One lowered program is executed by Preview and by a prepared release; T4
 * persists it as an immutable delivery derivative and creates no second
 * interpreter. Everything here is derived from accepted Experience/Camera/source
 * identities, so a program never becomes another editable order format: it
 * copies no Camera pose/path/graph, no renderer object, no source selection or
 * history, and no arbitrary executable code.
 *
 * The format is closed at its minimum. Empty collections are explicit — a
 * program with no stops says so with an empty `stops` list and a `null` entry,
 * not by omitting a field — and every optional-looking shape is required, because
 * an ambiguous absence here would later be read as a default.
 *
 * This module and `./validate` are the whole import closure of the
 * `@portfolio/project-model/program` entry: delivery validation only, no source
 * codec, no Layout compiler, no root barrel, no Camera evaluator and no Three.
 */

/** The program kind discriminator. */
export const EXECUTION_PROGRAM_KIND = 'execution-program' as const;

/** The program format version this module implements. */
export const EXECUTION_PROGRAM_FORMAT_VERSION = 4 as const;

/**
 * A capability the program requires or tolerates. A reader must refuse an
 * unsupported **required** capability and may ignore an unsupported optional one.
 */
export type ProgramCapability = { id: string; required: boolean };

/** A content record shown by a Presentation. v1 admits text only. */
export type ProgramContentRecord = { id: string; kind: 'text'; text: string };

/**
 * A labelled, enterable Presentation: the visitor-facing use of the Camera Views
 * it names.
 *
 * `viewIds` is the Presentation's own suggested order — never Guide order and
 * never connectivity — and its first View is the Default the Presentation
 * enters at. `steps[i]` is the resolved Cut or Travel from `viewIds[i]` to
 * `viewIds[i + 1]`, which a visitor plays with ‹ › while exploring; it adds no
 * Guide time. A Travel plays its connection in either direction. Lowering omits
 * a Presentation with no resolvable Default View: the delivery format only
 * carries enterable ones.
 */
export type ProgramPresentation = {
	id: string;
	label: string;
	viewIds: readonly string[];
	steps: readonly ProgramInvocation[];
	explorable: boolean;
	content: readonly ProgramContentRecord[];
};

/** How the Guide plays: Automatic moves on after each stay; Manual waits for Next. */
export type ProgramPacing = 'automatic' | 'manual';

/** A Stop's invitation to explore; `prompt` is `null` for the default wording. */
export type ProgramInvitation = { prompt: string | null };

/**
 * A Camera invocation binding. `cut` realizes a resolved view with no travel;
 * `travel` plays one Camera connection. A program never stores a gap as a cut —
 * a missing route is reported by the caller, not encoded here.
 */
export type ProgramInvocation =
	| { kind: 'cut'; viewId: string }
	| { kind: 'travel'; connectionId: string };

/** Continuation after one Stop occurrence. */
export type ProgramContinuation =
	| { kind: 'sequence-next' }
	| { kind: 'stop'; stopId: string }
	| { kind: 'end' };

/**
 * One stable Stop occurrence: one visit to one Presentation at its resolved
 * entry View, with its arrival invocation. `staySeconds` is the finite stay in
 * Automatic pacing and `null` exactly when the program is Manual (the Stop waits
 * for Next). A stay counts only after the arrival completes.
 */
export type ProgramStop = {
	id: string;
	presentationId: string;
	entryViewId: string;
	staySeconds: number | null;
	invitation: ProgramInvitation | null;
	invocation: ProgramInvocation;
	continuation: ProgramContinuation;
};

/** A typed scoped state declaration with explicit initial and reset values. */
export type ProgramStateDeclaration = {
	id: string;
	type: 'boolean' | 'choice';
	/** Admitted values for `choice`; empty for `boolean`. */
	values: readonly string[];
	initial: string | boolean;
	reset: string | boolean;
};

/** A bounded guard expression: literal, state read, equality or conjunction. */
export type ProgramGuard =
	| { kind: 'literal'; value: boolean }
	| { kind: 'state'; stateId: string }
	| { kind: 'equals'; stateId: string; value: string | boolean }
	| { kind: 'conjunction'; guards: readonly ProgramGuard[] };

/** A finite local-time mapping: the stay of one timed Stop. Empty when Manual. */
export type ProgramLocalTime = { stopId: string; staySeconds: number };

/** A channel policy: which shared family the run reads and how it owns it. */
export type ProgramChannelPolicy = {
	id: string;
	family: string;
	policy: 'exclusive' | 'shared-inspection';
};

/** Run-scoped lifecycle events. */
export const PROGRAM_EVENTS = ['enter', 'arrival', 'complete', 'cancel'] as const;
export type ProgramEvent = (typeof PROGRAM_EVENTS)[number];

/** A run-scoped action. `openUrl` carries a real URL, never an abstract intent. */
export type ProgramAction =
	| { kind: 'show-content'; contentId: string }
	| { kind: 'navigate-to'; stopId: string }
	| { kind: 'open-url'; url: string }
	| { kind: 'continue' }
	| { kind: 'set-state'; stateId: string; value: string | boolean };

/** One lifecycle action with its optional bounded guard. */
export type ProgramLifecycleAction = {
	event: ProgramEvent;
	action: ProgramAction;
	guard: ProgramGuard | null;
};

/**
 * The bounded first visitor profile. Both capabilities are required, so a
 * program can never be executed with reduced motion or semantic DOM navigation
 * silently disabled.
 */
export type ProgramProfile = {
	reducedMotion: 'required';
	semanticDomNavigation: 'required';
};

/**
 * The complete program. `entryStopId` is `null` exactly when `stops` is empty: an
 * empty program is explicit rather than a program with a dangling entry. A
 * program with no Stops still carries its enterable Presentations, which the
 * interpreter enters through the Presentation-entry event (a guide-free
 * Experience enters one Presentation, never a fabricated Stop).
 */
export type ExecutionProgram = {
	kind: typeof EXECUTION_PROGRAM_KIND;
	formatVersion: typeof EXECUTION_PROGRAM_FORMAT_VERSION;
	capabilities: readonly ProgramCapability[];
	experienceId: string;
	welcome: string | null;
	pacing: ProgramPacing;
	entryStopId: string | null;
	presentations: readonly ProgramPresentation[];
	stops: readonly ProgramStop[];
	state: readonly ProgramStateDeclaration[];
	localTime: readonly ProgramLocalTime[];
	channels: readonly ProgramChannelPolicy[];
	lifecycle: readonly ProgramLifecycleAction[];
	profile: ProgramProfile;
};
