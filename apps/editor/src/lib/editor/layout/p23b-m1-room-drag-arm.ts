/**
 * Pre-P23B.8 follow-up — M1's BEFORE/AFTER ARM for the whole-Room drag.
 *
 * WHY THIS EXISTS. Every recorded M1 absolute is SESSION-CONDITIONED: the same
 * code re-measured in a later session moved by ×0.38–×1.03 with no code change,
 * so a before/after taken across two sessions (or two trees) measures the
 * machine, not the change. The only honest comparison is both arms measured in
 * ONE session, which is impossible for a change that is already in the tree
 * unless the tree can still run the OLD path on demand. This module is that
 * switch: a DEV-only arm, read per pointer event, that selects which of the two
 * whole-Room drag paths the shipped viewport executes.
 *
 *   `transient`  the shipped path: one proposal per pointermove, no planner
 *                call, no compile, no install, no history (the AFTER arm).
 *   `per-move`   the PRE-CHANGE path, verbatim: restore the frozen baseline and
 *                run the canonical planner per pointermove, installing every
 *                intermediate candidate (the BEFORE arm).
 *
 * THE ARM IS MEASUREMENT-ONLY AND CANNOT REACH A PRODUCT BUILD. It is read
 * through `p23bM1RoomDragArm()`, which returns `transient` unless the DEV build
 * AND `__P2311_PERF__` are both on; a production build pays one boolean and
 * runs the shipped path. It changes no acceptance decision either way: the
 * release still re-derives from the release coordinate against the frozen
 * baseline and writes exactly one history entry, so the arm changes only what
 * the pointermoves cost.
 *
 * WHAT THE RECORD DOES WITH IT. The driver interleaves the arms per attempt and
 * records the arm against the resolved ACTION index, so the record can split a
 * class's measured population by arm and report the two distributions side by
 * side. Interleaving (rather than one arm after the other) is what keeps the two
 * arms inside one session's drift: a machine that warms up or throttles mid-run
 * moves both arms, not one.
 */

/** The two whole-Room drag paths M1 compares. */
export type P23BM1RoomDragArm = 'transient' | 'per-move';

/**
 * The arm order the driver interleaves. `transient` (the shipped path) takes the
 * even attempts and `per-move` (the pre-change path) the odd ones, so the arms
 * alternate across the whole class rather than in two blocks.
 */
export const P23B_M1_ROOM_DRAG_ARMS = ['transient', 'per-move'] as const satisfies readonly P23BM1RoomDragArm[];

export const P23B_M1_ARM_RULE =
	'One session, two arms, interleaved PER ATTEMPT: `transient` (the shipped path — one proposal per pointermove, no planner call, no compile, no install, no history) and `per-move` (the pre-change path — the frozen baseline restored and the canonical planner run per pointermove, every intermediate candidate installed). The arm is recorded against the RESOLVED ACTION index, and both arms run under the same runtime, the same fixture, the same viewport and the same warm-up rule, so the comparison is a WITHIN-SESSION one by construction. Interleaving is the drift control: a machine that warms up, throttles or is otherwise re-conditioned mid-run moves both arms rather than one. A cross-session or cross-tree comparison is NOT admissible under this protocol — every M1 absolute is session-conditioned — and is never made here.';

type ArmGlobals = typeof globalThis & {
	__P2311_PERF__?: boolean;
	__P23B_M1_ROOM_DRAG_ARM__?: P23BM1RoomDragArm;
};

/**
 * The same gate every other capture-side DEV instrument uses: the DEV build plus
 * `__P2311_PERF__`. A production build does one early return.
 */
export function p23bM1RoomDragArmEnabled(): boolean {
	const viteDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV;
	return viteDev !== false && (globalThis as ArmGlobals).__P2311_PERF__ === true;
}

/**
 * The arm the next pointermove runs under. `transient` whenever the instrument is
 * off, so the shipped path is the default and the pre-change path is unreachable
 * without an explicit DEV switch.
 */
export function p23bM1RoomDragArm(): P23BM1RoomDragArm {
	if (!p23bM1RoomDragArmEnabled()) return 'transient';
	const arm = (globalThis as ArmGlobals).__P23B_M1_ROOM_DRAG_ARM__;
	return arm === 'per-move' ? 'per-move' : 'transient';
}

/** Set (or with `null`, clear) the arm. Nothing here is persisted. */
export function setP23bM1RoomDragArm(arm: P23BM1RoomDragArm | null): void {
	const globals = globalThis as ArmGlobals;
	if (arm === null) delete globals.__P23B_M1_ROOM_DRAG_ARM__;
	else globals.__P23B_M1_ROOM_DRAG_ARM__ = arm;
}

/** One action's arm, keyed to the class it was measured in AND the action index. */
export type P23BM1ActionArmRecord = {
	fixtureId: string;
	actionClass: string;
	/** The ledger index of the resolved action, the same key the gesture registry uses. */
	actionIndex: number;
	arm: P23BM1RoomDragArm;
};

let records: P23BM1ActionArmRecord[] = [];

/** Drop everything the M1 run has recorded so far. */
export function p23bM1ResetActionArms(): void {
	records = [];
}

/**
 * Record the arm one action ran under. Only actions that RESOLVED are recorded
 * (an attempt that threw has no ledger index), which is exactly the population
 * the record can attribute.
 */
export function p23bM1RecordActionArm(
	fixtureId: string,
	actionClass: string,
	actionIndex: number,
	arm: P23BM1RoomDragArm
): void {
	records = [...records, { fixtureId, actionClass, actionIndex, arm }];
}

/** A fixed copy, so a reader can never mutate the registry. */
export function p23bM1ActionArmRecords(): readonly P23BM1ActionArmRecord[] {
	return records.map((record) => ({ ...record }));
}

/**
 * The action index → arm map for one fixture+class, or an empty map when the
 * class ran no arms (every other class, and every non-arm run). The record
 * splits a class's population with exactly this map, so an action can never be
 * attributed to an arm it did not run under.
 */
export function p23bM1ActionArms(
	fixtureId: string,
	actionClass: string
): ReadonlyMap<number, P23BM1RoomDragArm> {
	const byIndex = new Map<number, P23BM1RoomDragArm>();
	for (const record of records) {
		if (record.fixtureId !== fixtureId || record.actionClass !== actionClass) continue;
		byIndex.set(record.actionIndex, record.arm);
	}
	return byIndex;
}
