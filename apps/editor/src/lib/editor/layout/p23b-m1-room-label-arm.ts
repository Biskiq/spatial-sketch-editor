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
 *   `pruned-grid`    the shipped path: one bounding-box prune on the
 *                    point-to-polyline distance, an early exit once a cell's slack
 *                    is already negative, active-text inflation hoisted out of the
 *                    per-cell loop, and the even-odd inside test computed per ROW
 *                    (the AFTER arm).
 *   `per-cell-grid`  the PRE-CHANGE path, verbatim: every cell measured against
 *                    every boundary vertex, the inside test walked per cell, the
 *                    inflation rebuilt per cell, the bbox in four mapped arrays and
 *                    a neighbour array per BFS cell (the BEFORE arm).
 *
 * THE ARM IS MEASUREMENT-ONLY AND CANNOT REACH A PRODUCT BUILD. It is read through
 * `p23bM1RoomLabelArm()`, which returns `pruned-grid` unless the DEV build AND
 * `__P2311_PERF__` are both on; a production build pays one boolean and runs the
 * shipped path. It changes NO placement decision either way — that is the whole
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

/** The two Room-label grid implementations M1 compares. */
export type P23BM1RoomLabelArm = 'pruned-grid' | 'per-cell-grid';

/**
 * The arm order the driver interleaves. `pruned-grid` (the shipped path) takes the
 * even attempts and `per-cell-grid` (the pre-change path) the odd ones, so the arms
 * alternate across the whole class rather than in two blocks.
 */
export const P23B_M1_ROOM_LABEL_ARMS = ['pruned-grid', 'per-cell-grid'] as const satisfies readonly P23BM1RoomLabelArm[];

export const P23B_M1_ROOM_LABEL_ARM_RULE =
	'One session, two arms, interleaved PER ATTEMPT, in every class of the protocol: `pruned-grid` (the shipped eligibility grid — bbox-pruned point-to-polyline distance, early exit on an already-negative slack, hoisted text inflation, per-row even-odd inside test) and `per-cell-grid` (the pre-change grid — every cell against every vertex, per-cell inside test, per-cell inflation, per-cell allocations). The arm is recorded against the RESOLVED ACTION index, and both arms run under the same runtime, the same fixture, the same viewport and the same warm-up rule, so the comparison is a WITHIN-SESSION one by construction. The placer is a PRESENTATION-path cost, so the rows it moves are the post-release window (release end → first presented frame) and the samples inside that window, not the release itself; the release row is reported beside them as the unchanged control. A cross-session or cross-tree comparison is NOT admissible under this protocol — every M1 absolute is session-conditioned — and is never made here.';

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

/**
 * The implementation the next grid build uses. `pruned-grid` whenever the
 * instrument is off, so the shipped path is the default and the pre-change path is
 * unreachable without an explicit DEV switch.
 */
export function p23bM1RoomLabelArm(): P23BM1RoomLabelArm {
	if (!p23bM1RoomLabelArmEnabled()) return 'pruned-grid';
	const arm = (globalThis as ArmGlobals).__P23B_M1_ROOM_LABEL_ARM__;
	return arm === 'per-cell-grid' ? 'per-cell-grid' : 'pruned-grid';
}

/** Set (or with `null`, clear) the arm. Nothing here is persisted. */
export function setP23bM1RoomLabelArm(arm: P23BM1RoomLabelArm | null): void {
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
};

let records: P23BM1ActionLabelArmRecord[] = [];

/** Drop everything the M1 run has recorded so far. */
export function p23bM1ResetActionLabelArms(): void {
	records = [];
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
	records = [...records, { fixtureId, actionClass, actionIndex, arm }];
}

/** A fixed copy, so a reader can never mutate the registry. */
export function p23bM1ActionLabelArmRecords(): readonly P23BM1ActionLabelArmRecord[] {
	return records.map((record) => ({ ...record }));
}

/**
 * The action index → arm map for one fixture+class, or an empty map when the class
 * ran no arms (every non-arm run). The record splits a class's population with
 * exactly this map, so an action can never be attributed to an arm it did not run
 * under.
 */
export function p23bM1ActionLabelArms(
	fixtureId: string,
	actionClass: string
): ReadonlyMap<number, P23BM1RoomLabelArm> {
	const byIndex = new Map<number, P23BM1RoomLabelArm>();
	for (const record of records) {
		if (record.fixtureId !== fixtureId || record.actionClass !== actionClass) continue;
		byIndex.set(record.actionIndex, record.arm);
	}
	return byIndex;
}
