/**
 * Pre-P23B.8 follow-up — M1's BEFORE/AFTER ARM for the Room-label placer's
 * eligibility grid.
 *
 * WHY THIS EXISTS, in the words of the arm it copies. Every recorded M1 absolute
 * is SESSION-CONDITIONED: the same code re-measured in a later session moved by
 * ×0.38–×1.03 with no code change, so a before/after taken across two sessions
 * measures the machine, not the change. The 2026-09-28 post-release-window pass
 * found the Room-label free-space placer's grid inside the post-release window
 * (`edgeDistance` at 39.5 % of that window, 17.11 % of the whole run), changed it,
 * and could only report the result as THREE legs of the same protocol — whose
 * third leg had to be thrown away as a delta because the machine had moved. This
 * module is the switch that removes the need for that: a DEV-only arm, read when
 * the grid is built, that selects which of the two grid implementations the
 * shipped placer executes.
 *
 *   `seeded-grid`    the shipped path: the same grid as below, run through the
 *                    placer's bounded, content-addressed candidate cache.
 *                    (P23B.8 S8: the pre-change `per-cell-grid` and the previous
 *                    `pruned-grid` are retired.)
 *   `no-memo-grid`   the SHIPPED grid with its cache BYPASSED — not a second grid at all,
 *                    just `seeded-grid` without the reuse the shipped path now runs. It
 *                    exists because that reuse was PROMOTED out of this arm and into the
 *                    placer, and an arm comparison must be able to run the shipped path's
 *                    own grid without its cache, or the cache's effect would be
 *                    unmeasurable inside the session the protocol exists to keep honest.
 *
 * THE CACHE IS NO LONGER AN ARM — IT IS THE SHIPPED PATH. `seeded-grid` runs the
 * seeded grid THROUGH the placer's bounded, content-addressed candidate cache;
 * `no-memo-grid` is that same grid with the cache skipped. The arm list has two
 * entries because the promotion changed what `seeded-grid` RUNS, not how many
 * arms the protocol compares.
 *
 * TWO ARMS, ONE DELTA. The pair the runner reports is `seeded-grid` against
 * `no-memo-grid` — the SHIPPED path, cache included, against itself bypassed,
 * which is the reuse delta a reader wants. (P23B.8 S8: the signed before/after
 * pair is retired with the pre-change arms.)
 *
 * THE ARM IS MEASUREMENT-ONLY AND CANNOT REACH A PRODUCT BUILD. It is read through
 * `p23bM1RoomLabelArm()`, which returns `P23B_M1_ROOM_LABEL_ARM_AFTER` unless the DEV build
 * AND `__P2311_PERF__` are both on; a production build pays one boolean and runs the
 * shipped path — which now INCLUDES the candidate cache, because that cache is shipped
 * behaviour rather than an arm. It changes NO placement decision either way — that is the whole
 * point of the two implementations and it is asserted directly, by running both
 * arms over the same fixture set and requiring identical labels.
 *
 * WHAT THE RECORD DOES WITH IT. The driver interleaves the arms per attempt in
 * EVERY class (the placer runs on every Plan render, so unlike the room drag this
 * arm is not confined to one class) and records the arm against the resolved
 * ACTION index, so a class's measured population splits by arm and the runner can
 * build each arm's own post-release windows, window-phase rows and CPU-profile
 * slice. Interleaving rather than one arm after the other is the drift control: a
 * machine that warms up or throttles mid-run moves both arms, not one.
 */

import {
	exactBitHashDigest,
	exactBitHashNumber,
	exactBitHashReset,
	exactBitHashWord,
	roomLabelGridKey,
	type RoomLabelGridInputs
} from './room-label-grid-key';

/**
 * THE KEY AND THE HASHING NOW LIVE WITH THE GRID, in `room-label-grid-key.ts`, and this
 * instrument re-exports them under their M1 names because captures, records and tests
 * name them — and imports the primitives because its result digests are built from the
 * SAME machinery on purpose.
 *
 * The move is what keeps the dependency pointing INSTRUMENT → PRODUCT. The shipped placer
 * keys its own bounded cache of grid candidates by this key, and a shipped cache must not
 * depend on a module whose job is to measure the placer: an instrument can be retired, and
 * the key must not retire with it.
 */
export type P23BM1GridBuildInputs = RoomLabelGridInputs;
export { roomLabelGridKey as p23bM1GridBuildKey };

/** The Room-label grid implementations M1 compares (P23B.8 S8: pre-change/previous retired). */
export type P23BM1RoomLabelArm = 'seeded-grid' | 'no-memo-grid';

/**
 * The arm order the driver interleaves, round-robin by attempt index: the shipped
 * path, then the same grid with its cache bypassed. Alternating rather than
 * blocking is the drift control — a machine that warms up or throttles mid-run moves
 * every arm, not one.
 */
export const P23B_M1_ROOM_LABEL_ARMS = ['seeded-grid', 'no-memo-grid'] as const satisfies readonly P23BM1RoomLabelArm[];

/** The shipped path — the only grid the placer runs. */
export const P23B_M1_ROOM_LABEL_ARM_AFTER = 'seeded-grid' as const;

export const P23B_M1_ROOM_LABEL_ARM_RULE =
	'One session, TWO arms, interleaved PER ATTEMPT, in every class of the protocol: `seeded-grid` (the shipped eligibility grid) and `no-memo-grid` (the SAME grid with the candidate cache BYPASSED, so the difference is the reuse alone). The arm is recorded against the RESOLVED ACTION index, and both arms run under the same runtime, the same fixture, the same viewport and the same warm-up rule, so a comparison between them is a WITHIN-SESSION one by construction — every M1 absolute is session-conditioned — and is never made across sessions. (P23B.8 S8: the pre-change `per-cell-grid` and previous `pruned-grid` arms are retired; no before/after pair is signed anymore.)';

type ArmGlobals = typeof globalThis & {
	__P2311_PERF__?: boolean;
	__P23B_M1_ROOM_LABEL_ARM__?: P23BM1RoomLabelArm;
};

/**
 * The same gate every other capture-side DEV instrument uses: the DEV build plus
 * `__P2311_PERF__`. A production build does one early return.
 */
export function p23bM1RoomLabelArmEnabled(): boolean {
	const viteDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV;
	return viteDev !== false && (globalThis as ArmGlobals).__P2311_PERF__ === true;
}

let gridBuilds = 0;

/**
 * The implementation the next grid build uses, and the one call per build the
 * shipped placer is allowed to make. `seeded-grid` whenever the instrument is off,
 * so the shipped path is the default and no experimental path is reachable without
 * an explicit DEV switch; an unrecognised value falls back to the shipped path
 * rather than to an arm nobody asked for.
 *
 * IT ALSO COUNTS ITS OWN CALLS, AND KEYS THEIR INPUTS. The placer calls this exactly
 * once per eligibility grid it builds and hands it the three arguments that grid was
 * built from, so one call settles two questions: how many grids an action paid for,
 * and whether those grids were built from inputs that had already been built — which is
 * what decides whether a memo could pay. The counting and the keying live here rather
 * than in the placer for the same reason the arm does: the product module keeps its
 * single read, and the instrument that wants to know something about the grid does the
 * work. Passing three references costs the shipped path nothing (no object is built and
 * nothing is hashed unless the gate is on), and the DEV run pays a hash per build, which
 * is reported as the instrument's own cost rather than hidden inside the product's.
 */
export function p23bM1RoomLabelArm(
	polygonScreen?: P23BM1GridBuildInputs['polygonScreen'],
	mask?: P23BM1GridBuildInputs['mask'],
	centerScreen?: P23BM1GridBuildInputs['centerScreen']
): P23BM1RoomLabelArm {
	gridBuilds += 1;
	if (!p23bM1RoomLabelArmEnabled()) return P23B_M1_ROOM_LABEL_ARM_AFTER;
	if (polygonScreen && mask && centerScreen) recordGridBuild({ polygonScreen, mask, centerScreen });
	const arm = (globalThis as ArmGlobals).__P23B_M1_ROOM_LABEL_ARM__;
	return arm === 'no-memo-grid' ? arm : P23B_M1_ROOM_LABEL_ARM_AFTER;
}

/**
 * Eligibility grids built since the last arm change, then reset by the next one: the
 * window that count belongs to is one attempt, which is the unit the arm alternates
 * over. Read by the driver when the attempt resolves, so a class can report how many
 * grid builds one accepted action paid for.
 */
export function p23bM1RoomLabelGridBuilds(): number {
	return gridBuilds;
}

/* ------------------------------------------------------------------ *
 * WHETHER THE GRID GETS BUILT AGAIN FROM THE SAME INPUTS
 * ------------------------------------------------------------------ */

/**
 * One class's grid builds, keyed by their inputs. `builds - distinctKeys` is the work a
 * memo keyed on those inputs could have skipped FOR THIS CLASS; `maxRepeatOfOneKey` says
 * how much of that saving is one single input set coming back.
 */
export type P23BM1GridBuildKeySummary = {
	builds: number;
	distinctKeys: number;
	repeatedBuilds: number;
	maxRepeatOfOneKey: number;
};

/** The class's key histogram while a run is in flight, and the attempt's own key set. */
let classKeys = new Map<string, { builds: number; keys: Map<string, number> }>();
let attemptKeys = new Map<string, number>();
/**
 * THIS ATTEMPT'S BUILDS IN ARRIVAL ORDER, each as the ORDINAL of its key in first-seen
 * order (`1 1 2 3 2` = the first build's inputs, then those same inputs again, then two
 * new sets, then the second one again). The counts say HOW MUCH repeated; the order says
 * whether a cache would have been there when the repeat arrived, which is the question a
 * memo's design turns on — an adjacent pair is caught by a single-entry cache, an
 * interleaved return needs a map. Recording the order rather than a hit count for one
 * guessed policy is deliberate: any policy (one entry, N entries, the whole attempt) can
 * be simulated offline from the same capture, so the policy is chosen from the data
 * instead of being baked into the instrument.
 */
let attemptKeyOrdinals: number[] = [];
/** Bound on the recorded order: an attempt longer than this is summarized by its first
 * `MAX_KEY_SEQUENCE` builds, and the truncation is visible as a length exactly equal to
 * the cap rather than silently dropped. */
const MAX_KEY_SEQUENCE = 2048;
let attemptContext: { fixtureId: string; actionClass: string } | null = null;

function classKeyOf(fixtureId: string, actionClass: string): string {
	return `${fixtureId}\u0000${actionClass}`;
}

/**
 * Key one build, in both scopes: the ATTEMPT's own set (one accepted action) and the
 * CLASS's histogram (every attempt in it). Both are needed because they answer different
 * questions — an attempt-scoped memo is the placer's own business, while a class-scoped
 * one would outlive the attempt that filled it.
 */
function recordGridBuild(inputs: P23BM1GridBuildInputs): void {
	const key = roomLabelGridKey(inputs);
	let ordinal = attemptKeys.get(key);
	if (ordinal === undefined) {
		ordinal = attemptKeys.size + 1;
		attemptKeys.set(key, ordinal);
	}
	if (attemptKeyOrdinals.length < MAX_KEY_SEQUENCE) attemptKeyOrdinals.push(ordinal);
	if (attemptContext === null) return;
	const classKey = classKeyOf(attemptContext.fixtureId, attemptContext.actionClass);
	let totals = classKeys.get(classKey);
	if (!totals) {
		totals = { builds: 0, keys: new Map() };
		classKeys.set(classKey, totals);
	}
	totals.builds += 1;
	totals.keys.set(key, (totals.keys.get(key) ?? 0) + 1);
}

/** How many distinct input sets this attempt's own builds used. */
export function p23bM1RoomLabelAttemptKeys(): number {
	return attemptKeys.size;
}

/**
 * This attempt's builds in arrival order, as key ordinals in first-seen order. Read when
 * the attempt resolves, so the record carries the reuse pattern beside the counts.
 */
export function p23bM1RoomLabelAttemptSequence(): readonly number[] {
	return [...attemptKeyOrdinals];
}

/**
 * The class's grid-build keys, or `null` for a class that built no grid (every run without
 * the arm). Read by the page when it builds the class row, so the repeat rate lands beside
 * the build count it belongs to.
 */
export function p23bM1GridBuildKeys(
	fixtureId: string,
	actionClass: string
): P23BM1GridBuildKeySummary | null {
	const totals = classKeys.get(classKeyOf(fixtureId, actionClass));
	if (!totals || totals.builds === 0) return null;
	let maxRepeatOfOneKey = 0;
	for (const count of totals.keys.values()) if (count > maxRepeatOfOneKey) maxRepeatOfOneKey = count;
	return {
		builds: totals.builds,
		distinctKeys: totals.keys.size,
		repeatedBuilds: totals.builds - totals.keys.size,
		maxRepeatOfOneKey
	};
}

/* ------------------------------------------------------------------ *
 * WHICH CALL BUILT WHAT
 * ------------------------------------------------------------------ */

/**
 * ONE CALL TO THE PLACER, as the placer itself sees it, plus the range of the attempt's
 * build order it produced (`buildStart`/`builds` index `byAction[].keySequence`).
 *
 * The key measurement says HOW MUCH the grid recomputes; this says WHICH pass does the
 * recomputing. A trailing subset rebuilt from identical inputs is consistent with at least
 * two very different stories — a second consumer planning the same Rooms, or the same
 * per-Room pass repeated — and they are told apart by what each call was handed: how many
 * Rooms it was given, under which `reason`, whether it got the sticky `memory`, and how
 * long after the previous call it started (`at`, `performance.now()` at entry).
 */
export type P23BM1RoomLabelCall = {
	rooms: number;
	reason: string;
	settleGeneration: number;
	hasMemory: boolean;
	at: number;
};

/** The same, once the build count it produced is known. */
export type P23BM1RecordedRoomLabelCall = P23BM1RoomLabelCall & {
	/** Index into the attempt's own build order where this call's builds begin. */
	buildStart: number;
	/** How many grids this call built. */
	builds: number;
	/**
	 * The call's own wall time, from its entry to its single exit — the whole pass, i.e.
	 * its grid builds AND the placement work around them. `null` when the run recorded the
	 * entry but no exit, which reads as NOT MEASURED rather than as free.
	 */
	durationMs: number | null;
	/**
	 * What this call PLACED — every label (Room id, tier, both anchors, the accepted
	 * rectangle, its lines' text/styles/baselines) plus the optional readout — hashed over
	 * exact bits and UTF-16 units. Identical inputs prove the same grids; only this can say
	 * whether the pass that rebuilt them also placed the same labels. Two sections are kept
	 * apart because they answer different questions: `labelsDigest` is what a render paints
	 * (so equal digests mean its consumer could have reused the previous placement), while
	 * `memoryDigest` is the sticky state the NEXT pass inherits. `null` when not measured.
	 */
	labelsDigest: string | null;
	/** Digest of the memory entries this call left behind; see `labelsDigest`. */
	memoryDigest: string | null;
};

let callSites: P23BM1RoomLabelCall[] = [];
/** `gridBuilds` at the moment each recorded call started, which is what makes builds
 * attributable per call without the placer having to count its own. */
let callBuildStarts: number[] = [];
/** Each call's own wall time, filled in by its exit. */
let callDurations: (number | null)[] = [];
/** Each call's result digests, filled in at the same exit. */
let callLabelDigests: (string | null)[] = [];
let callMemoryDigests: (string | null)[] = [];

/**
 * The one call per `placeRoomLabels` invocation this module accepts. It is a DEV-only
 * recording with no return value, so the placer's behaviour cannot depend on it: with the
 * gate off this is one boolean test and an early return, and the shipped path is untouched.
 */
export function p23bM1RecordRoomLabelCall(call: P23BM1RoomLabelCall): void {
	if (!p23bM1RoomLabelArmEnabled()) return;
	callSites.push(call);
	callBuildStarts.push(gridBuilds);
	callDurations.push(null);
	callLabelDigests.push(null);
	callMemoryDigests.push(null);
}

/**
 * The other half of the same recording, taken at the call's ONE exit: the pass's own wall
 * time. Counting the grids a pass built says what part of it is redundant at the grid
 * level; timing the whole pass says what the redundancy is WORTH, placement included —
 * which is the number a fix has to beat, and the one the keys cannot see. Same gate, same
 * no-return contract: with the instrument off this is one boolean and an early return.
 */
export function p23bM1EndRoomLabelCall(): void {
	if (!p23bM1RoomLabelArmEnabled()) return;
	const index = callSites.length - 1;
	const call = callSites[index];
	if (!call) return;
	callDurations[index] = (typeof performance === 'undefined' ? 0 : performance.now()) - call.at;
}

/**
 * THE PASS'S RESULT, DIGESTED. Identical inputs prove the same grids; only the result can
 * say whether the pass that rebuilt them also PLACED the same labels, and that difference is
 * exactly the one between a redundant pass and a pass that merely looks redundant.
 *
 * Numbers are hashed over their exact bits and strings over their UTF-16 units, for the same
 * reason the grid key is: "the same labels" has to mean it rather than mean "close enough".
 * The placer opens the walk, feeds the values it is about to return, and closes it into one
 * of two sections — `labels` (the labels + the readout: what a render paints) or `memory`
 * (the sticky entries the next pass inherits). Gated, allocation-free, and with no return
 * value the placer could branch on.
 */
export function p23bM1BeginRoomLabelValueDigest(): void {
	if (!p23bM1RoomLabelArmEnabled()) return;
	exactBitHashReset();
}

/** One number of the value being digested, over all 64 of its bits. */
export function p23bM1DigestNumber(value: number): void {
	if (!p23bM1RoomLabelArmEnabled()) return;
	exactBitHashNumber(value);
}

/** One string of the value being digested: its length, then every UTF-16 unit. */
export function p23bM1DigestString(value: string): void {
	if (!p23bM1RoomLabelArmEnabled()) return;
	exactBitHashWord(value.length);
	for (let index = 0; index < value.length; index += 1) exactBitHashWord(value.charCodeAt(index));
}

/** Close the digest and attach it to the call being recorded. */
export function p23bM1EndRoomLabelValueDigest(section: 'labels' | 'memory'): void {
	if (!p23bM1RoomLabelArmEnabled()) return;
	const index = callSites.length - 1;
	if (index < 0) return;
	const digest = exactBitHashDigest();
	if (section === 'labels') callLabelDigests[index] = digest;
	else callMemoryDigests[index] = digest;
}

/**
 * The attempt's calls, each with the range of the build order it produced. The last call
 * is closed with the attempt's current build count, so nothing a call built is attributed
 * to a neighbour.
 */
function recordedCalls(): P23BM1RecordedRoomLabelCall[] {
	return callSites.map((call, index) => {
		const buildStart = callBuildStarts[index] ?? 0;
		const buildEnd = index + 1 < callBuildStarts.length ? (callBuildStarts[index + 1] ?? 0) : gridBuilds;
		return {
			...call,
			buildStart,
			builds: Math.max(0, buildEnd - buildStart),
			durationMs: callDurations[index] ?? null,
			labelsDigest: callLabelDigests[index] ?? null,
			memoryDigest: callMemoryDigests[index] ?? null
		};
	});
}

/* ------------------------------------------------------------------ *
 * THE SHIPPED CACHE, OBSERVED — the instrument's half
 * ------------------------------------------------------------------ */

/**
 * THE PLACER NOW OWNS A CACHE, AND THIS IS THE INSTRUMENT'S HALF OF IT: counting only.
 *
 * `memo-grid` was an ARM once — the placer handed a build thunk here and this module owned
 * the map. The reuse that arm measured was then PROMOTED into the shipped placer path, so
 * the cache moved to the grid's own module (`plan-room-labels.ts`), keyed by
 * `roomLabelGridKey` and bounded there. It had to move: a cache whose lifetime is the
 * product's may not be owned by a module whose job is to measure the product, and there
 * must be exactly ONE implementation of it.
 *
 * So this module no longer HOLDS the cache — it OBSERVES it. The placer makes one gated,
 * no-return call per cache decision, and these counters are what let a test and a leg say
 * the shipped cache was EXERCISED rather than assumed. A cache that never hit would pass a
 * parity test by doing nothing at all, which is exactly the reading these exist to refuse.
 *
 * WHAT REPLACED THE OLD `memo-grid` ARM is `no-memo-grid`: the SAME shipped grid with the
 * cache BYPASSED. That arm is still needed, because an arm comparison must be able to run
 * the shipped path's own grid without its cache — otherwise the cache's effect is
 * unmeasurable inside the one session the arm protocol exists to keep honest.
 */
let gridCacheHits = 0;
let gridCacheMisses = 0;

/**
 * One decision from the shipped placer's grid cache: `true` when the candidates came from
 * the cache, `false` when the grid was built and stored. Gated and with no return value, so
 * the placer cannot branch on it (one boolean and an early return with the instrument off).
 */
export function p23bM1RecordRoomLabelGridCache(hit: boolean): void {
	if (!p23bM1RoomLabelArmEnabled()) return;
	if (hit) gridCacheHits += 1;
	else gridCacheMisses += 1;
}

/** Empty the cache counters wherever the arm's own accounting is reset. */
function resetGridCacheCounters(): void {
	gridCacheHits = 0;
	gridCacheMisses = 0;
}

/**
 * How many decisions the SHIPPED grid cache answered from memory and how many it had to
 * build, since the last arm change. DEV-only bookkeeping for the arm's own test, which has
 * to be able to say the cache was EXERCISED — a cache that never hit would pass a parity
 * test by doing nothing at all.
 */
export function p23bM1RoomLabelMemoHits(): number {
	return gridCacheHits;
}

export function p23bM1RoomLabelMemoMisses(): number {
	return gridCacheMisses;
}

/**
 * Set (or with `null`, clear) the arm, start the next attempt's build count, and — when
 * the caller knows them — the fixture and class the attempt belongs to, so a class can be
 * asked afterwards whether its grids were built from repeating inputs. Nothing here is
 * persisted.
 */
export function setP23bM1RoomLabelArm(
	arm: P23BM1RoomLabelArm | null,
	context?: { fixtureId: string; actionClass: string }
): void {
	gridBuilds = 0;
	resetGridCacheCounters();
	attemptKeys = new Map();
	attemptKeyOrdinals = [];
	callSites = [];
	callBuildStarts = [];
	callDurations = [];
	callLabelDigests = [];
	callMemoryDigests = [];
	attemptContext = context ?? null;
	const globals = globalThis as ArmGlobals;
	if (arm === null) delete globals.__P23B_M1_ROOM_LABEL_ARM__;
	else globals.__P23B_M1_ROOM_LABEL_ARM__ = arm;
}

/** One action's arm, keyed to the class it was measured in AND the action index. */
export type P23BM1ActionLabelArmRecord = {
	fixtureId: string;
	actionClass: string;
	/** The ledger index of the resolved action, the same key the gesture registry uses. */
	actionIndex: number;
	arm: P23BM1RoomLabelArm;
	/**
	 * Eligibility grids built while this attempt's arm was set — the attempt's own
	 * builds, since the arm is set once per attempt and setting it resets the count.
	 */
	builds: number;
	/**
	 * How many of those builds used a set of inputs the attempt had not already built.
	 * `builds - distinctBuilds` is what a memo scoped to ONE attempt could have skipped;
	 * see `p23bM1GridBuildKeys` for the same question over the whole class.
	 */
	distinctBuilds: number;
	/**
	 * The attempt's builds in ARRIVAL ORDER, as key ordinals in first-seen order, so the
	 * reuse pattern is recorded rather than a hit count for one guessed policy. Empty when
	 * the attempt built no grid, or in a run recorded before the sequence existed.
	 */
	sequence: readonly number[];
	/**
	 * The placer calls this attempt made, in order, each with the Rooms it was handed, its
	 * `reason`, whether it received the sticky memory, when it started, and the range of
	 * `sequence` it produced. This is what turns "a trailing subset was rebuilt" into
	 * "which call rebuilt it, and on what instructions".
	 */
	calls: readonly P23BM1RecordedRoomLabelCall[];
};

let records: P23BM1ActionLabelArmRecord[] = [];

/**
 * Drop everything the M1 run has recorded so far, including the attempt's build
 * count: a reset starts a new run, and a run whose first record carried builds counted
 * before it began would attribute another run's grid to its own first action.
 */
export function p23bM1ResetActionLabelArms(): void {
	records = [];
	gridBuilds = 0;
	resetGridCacheCounters();
	attemptKeys = new Map();
	attemptKeyOrdinals = [];
	callSites = [];
	callBuildStarts = [];
	callDurations = [];
	callLabelDigests = [];
	callMemoryDigests = [];
	attemptContext = null;
	classKeys = new Map();
}

/**
 * Record the arm one action ran under. Only actions that RESOLVED are recorded (an
 * attempt that threw has no ledger index), which is exactly the population the
 * record can attribute.
 */
export function p23bM1RecordActionLabelArm(
	fixtureId: string,
	actionClass: string,
	actionIndex: number,
	arm: P23BM1RoomLabelArm
): void {
	records = [
		...records,
		{
			fixtureId,
			actionClass,
			actionIndex,
			arm,
			builds: gridBuilds,
			distinctBuilds: attemptKeys.size,
			sequence: [...attemptKeyOrdinals],
			calls: recordedCalls()
		}
	];
}

/** A fixed copy, so a reader can never mutate the registry. */
export function p23bM1ActionLabelArmRecords(): readonly P23BM1ActionLabelArmRecord[] {
	return records.map((record) => ({ ...record }));
}

/**
 * One fixture+class's own records, in the order they were taken, or an empty list
 * for a class that ran no arms (every non-arm run).
 *
 * THIS IS THE CLASS'S ARM ASSIGNMENT, records and all: the record splits a class's
 * population by it, so an action can never be attributed to an arm it did not run
 * under — and the attempt's grid-build count travels with the same entry, so the
 * count can never be paired with another attempt's arm.
 */
export function p23bM1ActionLabelArmRecordsFor(
	fixtureId: string,
	actionClass: string
): readonly P23BM1ActionLabelArmRecord[] {
	return records
		.filter((record) => record.fixtureId === fixtureId && record.actionClass === actionClass)
		.map((record) => ({ ...record }));
}
