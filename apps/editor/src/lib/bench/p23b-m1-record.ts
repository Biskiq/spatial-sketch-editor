/**
 * Pre-P23B.8 follow-up — M1 record builder (DEV only, pure).
 *
 * One M1 session per runtime produces ONE record. This module decides what that
 * record says; the harness page only collects inputs and the CDP runner only
 * adds the presentation-grade section. Everything here is pure, so the rows the
 * record reports are pinned by unit tests instead of by the capture.
 *
 * THREE RULES ARE ENFORCED HERE, because they are what make M1's numbers
 * readable rather than merely present:
 *
 * 1. ONE POPULATION. A class's boundary rows, mark rows, release spans AND its
 *    gesture series are all taken over the same actions: completed actions with a
 *    resolved path, the leading warm-up SLOTS excluded per path, accepted
 *    outcomes only — exactly the interaction report's own rule. A mark p50 and
 *    the boundary p50 beside it therefore describe the same actions, and the
 *    gesture series cannot be merged over brackets the class does not report.
 *    The population is DECOMPOSED (`populations`) rather than summarized into one
 *    number, because warm-up is counted in slots and a class with extra
 *    non-accepted actions on its path legitimately reports a different measured
 *    count — which must be visible, since unequal counts are not equivalent
 *    samples.
 *
 * 2. KEYED, SELF-ONLY-WHERE-PRICEABLE. Mark and boundary rows use the S7 keyed
 *    shape and take their exclusive time from the containment record's own rule
 *    (reported only when every occurrence in the class can be exclusive-priced),
 *    so nothing is summed across nodes and a withheld self is visible.
 *
 * 3. EVERY ROW CARRIES ITS SIGNAL AND ITS COVERAGE. The release-side row is the
 *    existing `browser-frame` PROXY unless a presentation-grade signal is
 *    present, and it states how many releases it covers. The gesture row states
 *    its frame count, its drag count and how many frames fell inside the
 *    product's pointermove windows. The long-frame row states its release
 *    coverage and whether the runtime reported the entry type at all.
 */
import {
	percentile,
	summarizeContainmentByPath,
	walk,
	type P23BContainmentNode,
	type P23BContainmentNodeSummary,
	type P23BContainmentRecord
} from '$lib/bench/p23b-containment';
import type {
	BenchInteractionOutcome,
	BenchInteractionPath,
	P23BActionLedger,
	P23BCaptureLedger
} from '$lib/bench/bench-types';
import { P23B11_CONNECTED_CASE_ID } from '$lib/bench/p23b11-connected-case';
import {
	P23B_M1_ARM_RULE,
	P23B_M1_ROOM_DRAG_ARMS,
	type P23BM1RoomDragArm
} from '$lib/editor/layout/p23b-m1-room-drag-arm';
import {
	P23B_M1_ROOM_LABEL_ARMS,
	P23B_M1_ROOM_LABEL_ARM_AFTER,
	P23B_M1_ROOM_LABEL_ARM_RULE,
	type P23BM1ActionLabelArmRecord,
	type P23BM1GridBuildKeySummary,
	type P23BM1RecordedRoomLabelCall,
	type P23BM1RoomLabelArm
} from '$lib/editor/layout/p23b-m1-room-label-arm';
import {
	summarizeM1Attribution,
	type P23BM1Attribution
} from '$lib/bench/p23b-m1-attribution';
import {
	p23bM1GestureFramesFor,
	P23B_M1_GESTURE_POPULATION_RULE,
	P23B_M1_LABEL_ARM_WINDOW_RULE,
	P23B_M1_LONG_FRAME_DEFINITION,
	P23B_M1_PRESENTED_FRAME_DEFINITION,
	P23B_M1_RELEASE_PROXY_DEFINITION,
	P23B_M1_WINDOW_ARM_NOTE,
	type P23BM1FrameTiming,
	type P23BM1GestureFrameSeries,
	type P23BM1IntervalSeries,
	type P23BM1LongFrameEntry,
	type P23BM1LongFrameSummary,
	type P23BM1PresentedWindowSummary,
	type P23BM1WindowArmComparisonRow,
	type P23BM1WindowArmRow,
	summarizeIntervals,
	summarizeLongFrames
} from '$lib/bench/p23b-m1-frame-timing';
import type { P23BM1CpuWindowRow } from '$lib/bench/p23b-m1-cpu-profile';

/** The S7 keyed row: named fields, exclusive time only where it is priceable. */
export type P23BM1KeyedRow = {
	count: number;
	p50: number;
	p95: number;
	exclusiveSelf: { count: number; p50: number; p95: number } | null;
	/** Why exclusive self is withheld; the containment record's own stated reason. */
	exclusiveSelfWithheld: string | null;
	/** Occurrences of this label inside one action, at most. `> 1` means repeats. */
	maxPerAction: number;
	/** Actions this label occurred in. */
	actionsPresent: number;
};

/** One accepted release's own interval, so a presentation clock can be correlated to it. */
export type P23BM1ReleaseSpan = {
	actionIndex: number;
	path: BenchInteractionPath;
	outcome: BenchInteractionOutcome;
	start: number;
	end: number;
	/** The proxy boundary for the same action, when the action recorded one. */
	browserFrame: { start: number; end: number } | null;
};

export type P23BM1Population = {
	rule: string;
	/** Completed actions of this class's path that entered the rule at all. */
	completedOfPath: number;
	/**
	 * Leading actions of the path dropped as warm-up SLOTS, whatever their outcome
	 * (the shipped report's rule slices first, then filters).
	 */
	warmupSlots: number;
	/** ...of which were accepted outcomes, and so are the warm-up's accepted loss. */
	warmupAcceptedExcluded: number;
	/** Completed path actions left after the warm-up slots. */
	consideredAfterWarmup: number;
	/** ...of which were not accepted and are therefore not reported. */
	excludedByOutcome: number;
	/** The reported population: accepted actions after the warm-up slots. */
	measuredAccepted: number;
	/** The class's nominal measured size (actions minus warm-up), when the caller states it. */
	nominalMeasured: number | null;
	/**
	 * False when this class reports a different number of measured actions than the
	 * nominal one — which is legitimate (extra non-accepted actions of the same path
	 * consume warm-up slots) and must be visible, because rows over different counts
	 * are not equivalent samples.
	 */
	matchesNominal: boolean | null;
	outcomes: Partial<Record<BenchInteractionOutcome, number>>;
};

export type P23BM1ClassRow = {
	fixtureId: string;
	sessionId: string;
	actionClass: string;
	actionPath: BenchInteractionPath;
	ledger: {
		recordedActions: number | null;
		fixtureResets: number | null;
		droppedBoundaries: number | null;
		settled: boolean | null;
	};
	population: P23BM1Population;
	boundaries: Record<string, P23BM1KeyedRow>;
	marks: Record<string, P23BM1KeyedRow>;
	/** Marks inside the action but outside its boundaries, per name (the containment record's own shape). */
	unboundInsideActions: Record<string, { count: number; p50: number; p95: number }>;
	/** The `commit-capture` mark's own row (D7), or `null` when the class never reached it. */
	commitCapture: P23BM1KeyedRow | null;
	/** Accepted release spans, the population a presentation clock is correlated against. */
	releaseSpans: P23BM1ReleaseSpan[];
	releaseRow: {
		signal: 'presented-frame' | 'proxy';
		definition: string;
		distribution: P23BM1IntervalSeries;
		coverage: { releases: number; coveredReleases: number; coveredShare: number };
		/** The proxy row is reported beside a presentation-grade row, never replaced by it. */
		proxy: { definition: string; distribution: P23BM1IntervalSeries; coverage: { releases: number; coveredReleases: number; coveredShare: number } };
	};
	gestureFrames: P23BM1GestureFrameSeries | null;
	longFrames: P23BM1LongFrameSummary;
	/**
	 * The class's rows partitioned into geometry computation, state installation
	 * and Plan rendering, with the release-side signal beside them. Derived, so the
	 * split travels with the evidence instead of being re-derived by hand.
	 */
	attribution: P23BM1Attribution;
	/**
	 * `true` only on the cold pass's row for this class (§16) — the same class, the
	 * same arms, the camera moved between attempts. Absent on the repeat row, which is
	 * every table's default population. Every table that matches a class by name
	 * suffix MUST skip a cold row: both prefixes end in `:${actionClass}`, so without
	 * the flag the cold twin could be silently substituted for the repeat class.
	 */
	cold?: boolean;
	/**
	 * PAGE-SIDE WORK AFTER THE RELEASE, per accepted action, out of the class's own
	 * containment trees. This is the component the D6 question needs: the
	 * release-to-next-presented wait is a compositor fact, and the page can only say
	 * what part of it it was busy for — split into the restore path (the transient
	 * baseline being put back) and the commit path (the edit being made permanent).
	 */
	postRelease: P23BM1PostRelease;
	/**
	 * The SAME rows paired with the presented-frame instant, per action. Filled by
	 * the CDP runner, because presentation-grade instants exist only there; `null`
	 * in the page's own record and on any run without a presentation signal.
	 */
	postReleaseVsPresented: P23BM1PostReleasePairing | null;
	/**
	 * The SAME window, priced from the trace's own DURATIONS: what frame work the
	 * renderer did after the release, phase by phase, and how much of the wait no
	 * frame covers at all. Filled by the CDP runner (a trace exists only there);
	 * `null` in the page's own record.
	 */
	presentedWindow: P23BM1PresentedWindowSummary | null;
	/**
	 * The containment record's own counters for this class. `unattributed` is the
	 * number of marks that fell OUTSIDE every action's span, and those marks are in
	 * neither the class's mark rows nor `postRelease` — which makes every
	 * action-attributed window a LOWER bound on the page's work. Reported here so the
	 * bound is visible instead of implied.
	 */
	containmentMarks: { observed: number; attributed: number; unbound: number; unattributed: number };
	/** Marks outside every action of this class, pooled by name: work no attributed window can contain. */
	unattributedOutsideActions: {
		name: string;
		count: number;
		p50: number;
		p95: number;
		totalMs: number;
	}[];
	/**
	 * The BEFORE/AFTER split of this class's measured population, when the run took
	 * it, or `null` for every class that ran one path only.
	 *
	 * This is what makes a same-session before/after possible WITHOUT a pre-change
	 * tree: the two arms are the two code paths, both reachable in this build, and
	 * the driver interleaves them so the comparison cannot measure the session.
	 * When present, the class's own rows above span BOTH arms (`mixed`), and the
	 * per-arm rows here are the honest ones to read.
	 */
	arms: P23BM1ArmsBlock | null;
	/**
	 * The Room-label arm each resolved action ran under — a DIFFERENT arm over a
	 * DIFFERENT population (the placer runs in every class, so every class that ran
	 * arms carries this block). The RUNNER splits its post-release windows and its
	 * CPU-profile slice with `byAction`; the page reports only the assignment.
	 */
	labelArms: P23BM1LabelArmsBlock | null;
};

/** One arm's own rows, over ITS measured accepted actions and nothing else. */
export type P23BM1ArmRow = {
	arm: P23BM1RoomDragArm;
	/** Measured accepted actions that ran under this arm. */
	actions: number;
	boundaries: Record<string, P23BM1KeyedRow>;
	marks: Record<string, P23BM1KeyedRow>;
	/** The `browser-frame` PROXY row over this arm's own releases. */
	releaseRow: {
		distribution: P23BM1IntervalSeries;
		coverage: { releases: number; coveredReleases: number; coveredShare: number };
	};
	/** This arm's gesture-frame series, over this arm's measured actions only. */
	gestureFrames: P23BM1GestureFrameSeries | null;
	longFrames: P23BM1LongFrameSummary;
};

/**
 * One row of the before/after table. `perMoveMs` is the BEFORE arm (the pre-change
 * per-pointermove planner call) and `transientMs` the AFTER arm (the shipped
 * proposal-only drag); the delta is signed `transient − perMove`, so a negative
 * value is the change being faster.
 */
export type P23BM1ArmComparisonRow = {
	/** `release` (the D1 boundary), `mark <name>`, or `gesture <row>`. */
	label: string;
	perMoveMs: number | null;
	transientMs: number | null;
	deltaMs: number | null;
	/** `transientMs / perMoveMs`; `null` when the before arm reported no such row. */
	ratio: number | null;
};

export const P23B_M1_ARM_COMPARISON_NOTE =
	'Same-session before/after: the two arms are p50s of their OWN measured accepted actions, taken under one runtime, one fixture, one viewport and one warm-up rule, interleaved per attempt so session drift moves both arms. This is a WITHIN-SESSION comparison BY CONSTRUCTION — no cross-session and no cross-tree delta is ever derived from it, because every M1 absolute is session-conditioned. Values are midpoints of the arm populations, not paired per-action differences; the arm action counts are stated beside them, and an arm too thin to report a p50 leaves its cell null rather than zero.';

/**
 * The Room-label arm's assignment for one class: the rule the two arms were
 * produced under, the arms in the order the driver interleaves them, and the
 * action index → arm map. It carries no rows of its own because the rows this arm
 * moves are the post-release WINDOW rows, which only the runner (trace durations)
 * and the CPU profile can price — the page cannot see a presented frame. Keeping
 * the assignment here and the rows there is the same division the window-phase
 * block already uses.
 */
/**
 * What the class's grid-build keys say, and what they deliberately do NOT say. The two
 * scopes are reported apart because they measure different reuses: a repeat WITHIN one
 * attempt is the reuse the SHIPPED placer's own grid cache now takes (one owner, one bound,
 * a key that IS its invalidation), while a repeat across the class's attempts is the
 * ceiling for a cache that would OUTLIVE the attempt — a larger reuse, and a different
 * decision, which this row does not recommend taking.
 */
export const P23B_M1_GRID_BUILD_KEY_NOTE =
	'Grid builds are keyed by the inputs that determine the grid (the Room’s projected polygon, the projected mask with its clearances, and the semantic centre), hashed over every coordinate’s exact bits, so two builds with one key would have produced one identical grid. `buildsPerAction.distinct` counts the attempt’s own distinct keys, summed over the class’s actions: `total − distinct` is what a cache scoped to ONE attempt could have skipped, and what the SHIPPED placer’s own bounded grid cache now does skip — it is keyed by the same exact-bit inputs, owned by the grid’s own module, and needs no invalidation owner because a hit means the inputs are identical, which means the grid is. `gridBuildKeys` reports the same question over the class’s actions taken together, so `repeatedBuilds` there is the ceiling for a cache that OUTLIVES the attempt — a larger reuse and a different decision, and NOT one this row recommends. A key is derived from the inputs, never from the Room’s identity, so two Rooms with identical screen inputs share a key by construction; and the hashing is no longer DEV-only, because the shipped cache keys every grid request with it — one short walk over the polygon and mask per request, against the grid build it can skip. `byAction[].keySequence` is the attempt’s builds IN ARRIVAL ORDER, each as the ordinal of its key in first-seen order: the counts say how much repeated, and the order says whether a cache would have been there when the repeat arrived, so a cache policy can be simulated offline from this capture rather than assumed.';

export type P23BM1LabelArmsBlock = {
	rule: string;
	arms: readonly P23BM1RoomLabelArm[];
	/** Sorted by action index; the runner's split key. */
	byAction: {
		actionIndex: number;
		arm: P23BM1RoomLabelArm;
		builds: number;
		/** Of `builds`, how many used inputs this attempt had not already built. */
		distinctBuilds: number;
		/**
		 * The attempt's builds in arrival order, as key ordinals in first-seen order. The
		 * counts above say how much repeated; this says whether a cache would have been
		 * there when the repeat arrived, so a policy can be simulated from the capture.
		 * Empty for an attempt that built no grid.
		 */
		keySequence: number[];
		/**
		 * The placer calls this attempt made, in order, each with the Rooms, `reason`,
		 * memory and entry time it was handed, and the range of `keySequence` it produced.
		 * The keys say WHICH builds repeat; this says which CALL repeats them, which is what
		 * tells a second consumer apart from the same pass run twice.
		 */
		labelCalls: P23BM1RecordedRoomLabelCall[];
	}[];
	/**
	 * Eligibility grids one accepted action REQUESTED, over the actions above. The count
	 * is arm-INDEPENDENT by construction — every arm's placer asks for the same grids on
	 * the same Plan renders — so it is the reuse budget: `p50` is how many times the grid
	 * was able to change between one accepted action and the next, and a `p50` of 1 with a
	 * `max` of 1 would mean there is nothing left to reuse. This counts REQUESTS, not
	 * builds: the SHIPPED path now answers some of them from its grid cache, so it is
	 * `distinct` (below), the cache's own hit counters and the per-arm profile self time
	 * that move between arms, not this.
	 */
	buildsPerAction: {
		actions: number;
		total: number;
		p50: number | null;
		max: number;
		/**
		 * The attempts' own distinct keys, summed — i.e. the number of REQUESTED inputs that
		 * were new, which is the number of grids a cache scoped to one attempt would actually
		 * build. `total − distinct` is therefore what such a cache could have skipped, and on
		 * the shipped path what it DID skip. These counts still cannot tell a hit from a
		 * rebuild — a cache hit records the key of the request it served like any other — so
		 * the evidence that the shipped cache hit is its OWN counters
		 * (`p23bM1RoomLabelMemoHits`) and the per-arm profile slice, where `seeded-grid`'s grid
		 * self time sits against `no-memo-grid`'s. `null` when this run recorded no keys.
		 */
		distinct: number | null;
	};
	/** The class's keys over all its attempts; `null` when no key was recorded. */
	gridBuildKeys: P23BM1GridBuildKeySummary | null;
	note: string;
};

/**
 * The class's Room-label arm assignment and its grid-build budget, from the arm
 * module's own per-attempt records. Returns `null` — not an empty block — when the
 * class ran no arm, so a non-arm run cannot be read as a measured pair.
 *
 * The count travels with the arm because both were taken at the same instant: the
 * arm module's counter is reset when the arm is set, so `builds` is that attempt's
 * own grid builds and never a neighbour's.
 */
export function summarizeM1LabelArms(
	records: readonly P23BM1ActionLabelArmRecord[] | null,
	/** The class's grid-build keys, or `null` when the run/keyed mode recorded none. */
	gridBuildKeys: P23BM1GridBuildKeySummary | null = null
): P23BM1LabelArmsBlock | null {
	if (!records || records.length === 0) return null;
	// Later records win for one action index, so an action retried in the same
	// attempt cannot appear twice in the split the runner keys by index.
	const byIndex = new Map<number, P23BM1ActionLabelArmRecord>();
	for (const record of records) byIndex.set(record.actionIndex, record);
	const byAction = [...byIndex.values()]
		.map(({ actionIndex, arm, builds, distinctBuilds, sequence, calls }) => ({
			actionIndex,
			arm,
			builds,
			distinctBuilds,
			keySequence: [...sequence],
			labelCalls: calls.map((call) => ({ ...call }))
		}))
		.sort((left, right) => left.actionIndex - right.actionIndex);
	const builds = byAction.map((entry) => entry.builds);
	// A run that recorded no key has no distinct count either; reporting 0 there would
	// read as "every build repeated", which is the opposite of "not measured".
	const keyed = byAction.some((entry) => entry.distinctBuilds > 0);
	return {
		rule: P23B_M1_ROOM_LABEL_ARM_RULE,
		arms: P23B_M1_ROOM_LABEL_ARMS,
		byAction,
		buildsPerAction: {
			actions: builds.length,
			total: builds.reduce((sum, value) => sum + value, 0),
			p50: builds.length === 0 ? null : percentile(builds, 0.5),
			max: builds.length === 0 ? 0 : Math.max(...builds),
			distinct: keyed ? byAction.reduce((sum, entry) => sum + entry.distinctBuilds, 0) : null
		},
		gridBuildKeys,
		note: P23B_M1_GRID_BUILD_KEY_NOTE
	};
}

/**
 * The RUNNER's half of the label arm: the per-arm rows, keyed the way the assignment
 * above is keyed, for one class. The page reports the assignment; only a runtime that
 * can read presented frames and trace durations can price what the arm moved, which
 * is why the rows live here and not in the page's own record.
 *
 * `cpu` is the SAME split priced by V8's samples instead of the trace's durations,
 * so a row that the timeline attributes to a container can be attributed to the
 * function that ran. It is empty — not zero-filled — when no profile was taken.
 */
export type P23BM1LabelArmWindowRow = {
	/** The class key (`fixtureId/actionClass`) the split was taken out of. */
	key: string;
	/** Windows whose action recorded no arm: in no arm, and counted here. */
	unassignedWindows: number;
	arms: P23BM1WindowArmRow[];
	comparison: P23BM1WindowArmComparisonRow[];
	/** The same arms' windows, priced by self time. Empty without a profile. */
	cpu: P23BM1CpuWindowRow[];
};

/**
 * The whole label-arm split of one run: the rule and note it was produced under,
 * which arm is which side of the signed delta, and one row per class that ran arms.
 */
export type P23BM1LabelArmWindows = {
	rule: string;
	note: string;
	/** The arm the runner signed as AFTER — the shipped grid for this pass. */
	afterArm: P23BM1RoomLabelArm;
	/** The arm signed as BEFORE — absent since P23B.8 S8 retired the before side. */
	beforeArm?: P23BM1RoomLabelArm;
	rows: P23BM1LabelArmWindowRow[];
	/** Why the split reports no rows; `null` when it reports some. */
	notMeasuredReason: string | null;
};

/**
 * Assemble the runner's split into the block the record carries. Pure, so the shape
 * and the "no rows" reason are pinned by a test rather than by a capture.
 */
export function summarizeLabelArmWindows(input: {
	rows: readonly P23BM1LabelArmWindowRow[];
	afterArm?: P23BM1RoomLabelArm;
	beforeArm?: P23BM1RoomLabelArm;
	/** Windows the run covered in total, for the not-measured reason. */
	presentedWindows: number;
}): P23BM1LabelArmWindows | null {
	const afterArm = input.afterArm ?? P23B_M1_ROOM_LABEL_ARM_AFTER;
	// P23B.8 S8: no before side is signed anymore — the comparison protocols are retired.
	const beforeArm = input.beforeArm;
	if (input.rows.length === 0) return null;
	return {
		rule: P23B_M1_LABEL_ARM_WINDOW_RULE,
		note: P23B_M1_WINDOW_ARM_NOTE,
		afterArm,
		beforeArm,
		rows: [...input.rows].sort((left, right) => left.key.localeCompare(right.key)),
		notMeasuredReason:
			input.rows.every((row) => row.arms.every((arm) => arm.windows === 0))
				? `NOT MEASURED — this run took no label arm, or no release in it was paired with a presented instant (${input.presentedWindows} window(s) covered in total); the class rows are then the only readable ones and no before/after is derived.`
				: null
	};
}

export type P23BM1ArmsBlock = {
	/** The protocol rule the two arms were produced under. */
	rule: string;
	arms: readonly P23BM1RoomDragArm[];
	/**
	 * True when the class's own rows (the ones beside this block) were taken over
	 * BOTH arms and are therefore a mixed population. `rows` is the readable split.
	 */
	mixed: boolean;
	rows: P23BM1ArmRow[];
	comparison: { note: string; rows: P23BM1ArmComparisonRow[] };
};

export type P23BM1D1Row = {
	row: 'wall-authoring' | 'whole-room-move-bridge';
	mark: 'release';
	fixtureId: string;
	actionClass: string;
	p50: number;
	p95: number;
	count: number;
	/** P23B.6's S1b numbers for the same row and fixture, for comparison ONLY. */
	comparison: { capture: string; before: number; after: number; note: string };
};

/**
 * The fixtures that are measured ONLY to prove the protocol runs them (§3.2's
 * connected case last): their rows are evidence of the run, never recorded
 * evidence, so they are marked here and held out of D1's and D7's tables.
 */
export const P23B_M1_ADVISORY_FIXTURES: readonly string[] = [P23B11_CONNECTED_CASE_ID];

function isAdvisoryFixture(fixtureId: string): boolean {
	return P23B_M1_ADVISORY_FIXTURES.includes(fixtureId);
}

export type P23BM1FixtureSummary = {
	fixtureId: string;
	classes: P23BM1ClassRow[];
	/** A fixture measured under the protocol but never a recorded row (see the array above). */
	advisory: boolean;
	settled: boolean;
	droppedBoundaries: number;
};

export type P23BM1Record = {
	schema: {
		note: string;
		advisoryFixtures: string;
		keyed: string;
		population: string;
		gesturePopulation: string;
		releaseSide: string;
		/** The BEFORE/AFTER arm rule, present only when this run took arms. */
		arms: string;
		advisory: string;
	};
	protocol: string;
	provenance: Record<string, unknown>;
	fixtures: P23BM1FixtureSummary[];
	/**
	 * The reported population of every class, with the warm-up decomposition. This
	 * exists so that a row taken over 23 measured actions and a row taken over 20
	 * cannot be read as equivalent samples: the block states the counts and which
	 * classes differ, instead of leaving a reader to reconcile them from a single
	 * `warmupExcluded` number.
	 */
	populations: {
		note: string;
		rows: {
			fixtureId: string;
			actionClass: string;
			completedOfPath: number;
			warmupSlots: number;
			warmupAcceptedExcluded: number;
			excludedByOutcome: number;
			measuredAccepted: number;
			nominalMeasured: number | null;
			matchesNominal: boolean | null;
		}[];
		/** Every distinct measured count, so a divergence is a stated fact and not a range. */
		measuredCounts: number[];
	};
	d1: { note: string; rows: P23BM1D1Row[] };
	d7: { note: string; rows: { fixtureId: string; actionClass: string; mark: P23BM1KeyedRow | null }[] };
	d13: { note: string; coverageLimit: string };
	limitations: string[];
};

/** P23B.6's S1b final-head numbers, read from its closed record. Comparison only. */
export const P23B6_S1B_D1_COMPARISON = {
	'wall-authoring': {
		capture: 'P23B.6 S1b final-head (headless Chrome 152)',
		before: 2147.0,
		after: 3601.2,
		note: 'all-curved Wall-authoring release p50 ms; UNRESOLVED increase, re-read here as comparison only (never as a delta claim against a differently-run capture)'
	},
	'whole-room-move-bridge': {
		capture: 'P23B.6 S1b final-head (headless Chrome 152)',
		before: 73.4,
		after: 493.4,
		note: 'all-curved Whole-Room move release p50 ms; UNRESOLVED increase, re-read here as comparison only (never as a delta claim against a differently-run capture)'
	}
} as const;

export const P23B_M1_WARMUP_RULE =
	'Completed actions with a resolved path, in ledger order, per path: the leading warm-up SLOTS are dropped — the first five completed actions of the path, whatever their outcome — and only accepted outcomes are reported. This is the interaction report\'s own rule (`summarizeInteractionCapture` slices, then filters), so a mark row and the boundary row beside it describe the same actions. A class whose path also carries non-reported actions (the wall-authoring run\'s `setup` press) loses those actions to warm-up slots too, so it can report MORE than actions − warm-up measured accepted actions; the row states the slots, the accepted actions inside them and the measured count separately, and never treats unequal counts as equivalent samples.';

export const P23B_M1_D13_NOTE =
	'D13 — the accepted partial baseline (P23B.0-durable disposition A) covers synchronous press/move-phase boundaries only; it has no post-release flush/frame coverage and no end-to-end settlement claim. M1 does not extend, re-capture or rewrite it: this session is new advisory evidence, not a baseline.';

/**
 * The interaction report's own population rule, applied over a ledger so the
 * release spans can be taken from the SAME actions the mark rows describe.
 *
 * IT IS A SLICE THEN A FILTER, and the decomposition is returned rather than
 * summarized into one number: warm-up is counted in SLOTS (the first five
 * completed actions of the path) and in ACCEPTED actions inside those slots, so a
 * class whose path carries extra non-accepted actions reports a measured count
 * that a reader can still reconcile with the accepted total. Reporting only
 * `min(warmup, accepted)` — as this used to — claims five accepted actions were
 * dropped of a class that really dropped three `setup` actions and two accepted
 * ones, and makes 25 − 5 ≠ 23 look like an arithmetic error instead of a stated
 * population.
 */
export function m1Population(
	ledger: P23BCaptureLedger | null,
	path: BenchInteractionPath,
	warmup: number
): {
	measured: P23BActionLedger[];
	completedOfPath: number;
	warmupSlots: number;
	warmupAcceptedExcluded: number;
	consideredAfterWarmup: number;
	excludedByOutcome: number;
} {
	const completed = (ledger?.actions ?? []).filter(
		(action): action is P23BActionLedger & { path: BenchInteractionPath } =>
			action.status === 'completed' && action.path !== null
	);
	const ofPath = completed.filter((action) => action.path === path);
	const warmupActions = ofPath.slice(0, Math.max(0, warmup));
	const rest = ofPath.slice(warmupActions.length);
	return {
		measured: rest.filter((action) => action.outcome === 'accepted'),
		completedOfPath: ofPath.length,
		warmupSlots: warmupActions.length,
		warmupAcceptedExcluded: warmupActions.filter((action) => action.outcome === 'accepted').length,
		consideredAfterWarmup: rest.length,
		excludedByOutcome: rest.filter((action) => action.outcome !== 'accepted').length
	};
}

function keyedRow(row: P23BContainmentNodeSummary): P23BM1KeyedRow {
	return {
		count: row.total.count,
		p50: row.total.p50,
		p95: row.total.p95,
		exclusiveSelf: row.self ? { count: row.self.count, p50: row.self.p50, p95: row.self.p95 } : null,
		exclusiveSelfWithheld: row.selfWithheld,
		maxPerAction: row.maxPerAction,
		actionsPresent: row.actionsPresent
	};
}

// ---------------------------------------------------------------------------
// the post-release window: restore versus commit
// ---------------------------------------------------------------------------

/** The three buckets a page-side post-release mark is reported in. */
export type P23BM1PostReleaseFamily = 'restore' | 'commit' | 'other';

export const P23B_M1_POST_RELEASE_RULE =
	'Page-side work after a release is read out of the action\'s own containment tree: only MARK nodes that begin at or after the release boundary\'s end, and only the OUTERMOST of those (a mark whose enclosing mark also begins after the release end is inside its parent, and is never counted twice). THIS IS A LOWER BOUND: the tree only holds marks inside the action\'s own span, so a mark that fell outside every action is in the containment record\'s `unattributed` pool and appears in no window — see the class row\'s `containmentMarks` and `unattributedOutsideActions` counters, which state exactly how much work that pool held. Each kept mark is bucketed by its own label — `restore` for the transient-baseline teardown path, `commit` for the accepted edit being made permanent, `other` for everything else WITH its own name — and every bucket is reported as the UNION of its intervals, never their sum, because two marks of one family may overlap. The union of ALL kept marks is the page-side window, which is a COMPONENT of the release-to-presented wait and never the wait itself: the remainder is what the page was not running JavaScript for.';

/**
 * LABEL → BUCKET. Deliberately narrow, like the phase map: only the two paths this
 * split exists to separate are named, and an unknown label is reported as `other`
 * WITH its own row rather than absorbed into a family it might not belong to.
 */
export const P23B_M1_POST_RELEASE_FAMILY: Readonly<Record<string, P23BM1PostReleaseFamily>> = {
	// The transient-baseline teardown, which the editor runs to put the frozen
	// baseline back after an architecture gesture.
	'p2311:baseline-restore': 'restore',
	'p2311:restore-reactive-write': 'restore',
	'p2311:restore-project-clone': 'restore',
	'p2311:restore-model-project': 'restore',
	'p2311:restore-issues-clone': 'restore',
	'p2311:restore-mesh-install': 'restore',
	'p2311:restore-bookkeeping': 'restore',
	// The accepted edit becoming permanent.
	'p2311:acceptance-compile': 'commit',
	'p2311:commit-capture': 'commit',
	'p2311:commit-matches': 'commit',
	'p2311:commit-replace': 'commit',
	'p2311:gesture-commit': 'commit',
	'p2311:wall-chain-commit-install': 'commit'
};

/** Clock slack when deciding whether a mark begins "at or after" the release end. */
const POST_RELEASE_EPSILON_MS = 0.05;

export type P23BM1PostReleaseLabel = {
	label: string;
	family: P23BM1PostReleaseFamily;
	/** When this mark began, relative to the release end (ms; negative = inside the release). */
	startOffsetMs: number;
	ms: number;
	/**
	 * Whether the action's containment tree held this mark inside a boundary of
	 * that action (`bound`) or recorded it as unbound — inside the action's span but
	 * outside every boundary of it. Kept apart because "unbound" is the containment
	 * record's own visible remainder, and a window read out of it must not look like
	 * a window read out of attened work.
	 */
	placement: 'bound' | 'unbound';
};

export type P23BM1PostReleaseBucket = {
	/** Union of every mark in this bucket. */
	windowMs: number;
	restoreMs: number;
	commitMs: number;
	otherMs: number;
	/** The part of `windowMs` that came from the action's `unbound` list rather than its tree. */
	unboundMs: number;
	/** Offset of the FIRST mark, relative to the release end, or `null` when there is none. */
	firstStartOffsetMs: number | null;
	labels: P23BM1PostReleaseLabel[];
};

export type P23BM1PostReleaseRow = {
	actionIndex: number;
	releaseStart: number;
	releaseEnd: number;
	/**
	 * Marks INSIDE the release interval. These are part of the release row itself
	 * (the D1 boundary), NOT of the wait after it: the release boundary's own
	 * duration already contains them, so they must never be added to a post-release
	 * window.
	 */
	insideRelease: P23BM1PostReleaseBucket;
	/**
	 * Marks that BEGIN at or after the release end — the page-side component of the
	 * release-to-next-presented wait, whether the tree held them or the action
	 * recorded them as unbound.
	 */
	afterRelease: P23BM1PostReleaseBucket;
};

export type P23BM1PostRelease = {
	rule: string;
	actions: number;
	/** Actions in the measured population that carried a release boundary at all. */
	withRelease: number;
	/** AFTER the release — the wait's page-side component. */
	window: P23BM1IntervalSeries;
	restore: P23BM1IntervalSeries;
	commit: P23BM1IntervalSeries;
	other: P23BM1IntervalSeries;
	/** INSIDE the release — part of the release row, reported beside it so the reader can see which side the work landed on. */
	insideReleaseWindow: P23BM1IntervalSeries;
	insideReleaseRestore: P23BM1IntervalSeries;
	insideReleaseCommit: P23BM1IntervalSeries;
	/** Per label, both placements, each as the union within one action. */
	byLabel: Record<
		string,
		{
			family: P23BM1PostReleaseFamily;
			actionsAfter: number;
			actionsInside: number;
			afterMs: P23BM1IntervalSeries;
			insideMs: P23BM1IntervalSeries;
		}
	>;
	rows: P23BM1PostReleaseRow[];
};

/** Union length of intervals: overlaps merged, never summed. */
export function unionMs(intervals: readonly { start: number; end: number }[]): number {
	if (intervals.length === 0) return 0;
	const ordered = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);
	let total = 0;
	let start = ordered[0]!.start;
	let end = ordered[0]!.end;
	for (const interval of ordered.slice(1)) {
		if (interval.start > end) {
			total += end - start;
			start = interval.start;
			end = interval.end;
			continue;
		}
		if (interval.end > end) end = interval.end;
	}
	return total + (end - start);
}

/**
 * The outermost marks of one action that begin at or after `releaseEnd`. A mark
 * inside another kept mark belongs to it and is not collected separately, which is
 * what keeps the buckets from counting the same milliseconds twice (the restore
 * path nests: `baseline-restore` contains the mesh install, which contains the
 * preparation).
 */
function collectPostReleaseMarks(
	nodes: readonly P23BContainmentNode[],
	releaseEnd: number,
	insideKeptMark: boolean,
	out: { label: string; start: number; end: number }[]
): void {
	for (const node of nodes) {
		if (node.kind === 'mark' && node.start >= releaseEnd - POST_RELEASE_EPSILON_MS) {
			if (!insideKeptMark) out.push({ label: node.label, start: node.start, end: node.end });
			collectPostReleaseMarks(node.children, releaseEnd, true, out);
			continue;
		}
		collectPostReleaseMarks(node.children, releaseEnd, insideKeptMark, out);
	}
}

type CollectedMark = {
	label: string;
	start: number;
	end: number;
	placement: 'bound' | 'unbound';
};

const postReleaseFamilyOf = (label: string): P23BM1PostReleaseFamily =>
	P23B_M1_POST_RELEASE_FAMILY[label] ?? 'other';

/** One action's own marks split into `insideRelease` and `afterRelease`. */
function bucketOf(marks: readonly CollectedMark[], releaseEnd: number): P23BM1PostReleaseBucket {
	const family = (name: P23BM1PostReleaseFamily) =>
		unionMs(marks.filter((mark) => postReleaseFamilyOf(mark.label) === name));
	return {
		windowMs: unionMs(marks),
		restoreMs: family('restore'),
		commitMs: family('commit'),
		otherMs: family('other'),
		unboundMs: unionMs(marks.filter((mark) => mark.placement === 'unbound')),
		firstStartOffsetMs:
			marks.length === 0 ? null : Math.min(...marks.map((mark) => mark.start - releaseEnd)),
		labels: marks
			.map((mark) => ({
				label: mark.label,
				family: postReleaseFamilyOf(mark.label),
				startOffsetMs: mark.start - releaseEnd,
				ms: mark.end - mark.start,
				placement: mark.placement
			}))
			.sort((a, b) => a.startOffsetMs - b.startOffsetMs)
	};
}

/**
 * Every measured action's own marks, split by where they fell relative to the
 * release: INSIDE it (part of the release row, which already contains them) or
 * AFTER it (the page-side component of the release-to-presented wait). The
 * population is the class's measured one — the same rule as every other row — and
 * an action whose tree carries no `release` boundary is skipped rather than
 * reported as an empty window.
 */
export function postReleaseWindowOf(
	containment: P23BContainmentRecord,
	measured: readonly P23BActionLedger[]
): P23BM1PostRelease {
	const trees = new Map(containment.actions.map((action) => [action.index, action]));
	const rows: P23BM1PostReleaseRow[] = [];
	let withRelease = 0;
	for (const action of measured) {
		const tree = trees.get(action.index);
		if (!tree) continue;
		let releaseStart: number | null = null;
		let releaseEnd: number | null = null;
		for (const node of walk(tree.roots)) {
			if (node.kind !== 'boundary' || node.label !== 'release') continue;
			releaseStart = node.start;
			releaseEnd = node.end;
		}
		if (releaseStart === null || releaseEnd === null) continue;
		withRelease += 1;
		const after: CollectedMark[] = [];
		// Marks the tree holds after the release end (outermost only), plus the
		// action's own `unbound` remainder — both are work the release did not
		// measure, and either can be empty.
		collectPostReleaseMarks(tree.roots, releaseEnd, false, after);
		for (const entry of tree.unbound) {
			if (entry.startTime < releaseEnd - POST_RELEASE_EPSILON_MS) continue;
			after.push({
				label: entry.name,
				start: entry.startTime,
				end: entry.startTime + entry.duration,
				placement: 'unbound'
			});
		}
		const inside: CollectedMark[] = [];
		for (const node of walk(tree.roots)) {
			if (node.kind !== 'mark') continue;
			if (node.start >= releaseEnd - POST_RELEASE_EPSILON_MS) continue;
			if (node.end <= releaseStart + POST_RELEASE_EPSILON_MS) continue;
			inside.push({ label: node.label, start: node.start, end: node.end, placement: 'bound' });
		}
		rows.push({
			actionIndex: action.index,
			releaseStart,
			releaseEnd,
			insideRelease: bucketOf(inside, releaseEnd),
			afterRelease: bucketOf(after, releaseEnd)
		});
	}
	const labels = new Set<string>();
	for (const row of rows) {
		for (const entry of row.afterRelease.labels) labels.add(entry.label);
		for (const entry of row.insideRelease.labels) labels.add(entry.label);
	}
	const byLabel: P23BM1PostRelease['byLabel'] = {};
	for (const label of labels) {
		const after: number[] = [];
		const inside: number[] = [];
		let actionsAfter = 0;
		let actionsInside = 0;
		for (const row of rows) {
			const ownAfter = row.afterRelease.labels
				.filter((entry) => entry.label === label)
				.map((entry) => ({ start: entry.startOffsetMs, end: entry.startOffsetMs + entry.ms }));
			if (ownAfter.length > 0) {
				actionsAfter += 1;
				after.push(unionMs(ownAfter));
			}
			const ownInside = row.insideRelease.labels
				.filter((entry) => entry.label === label)
				.map((entry) => ({ start: entry.startOffsetMs, end: entry.startOffsetMs + entry.ms }));
			if (ownInside.length > 0) {
				actionsInside += 1;
				inside.push(unionMs(ownInside));
			}
		}
		byLabel[label] = {
			family: postReleaseFamilyOf(label),
			actionsAfter,
			actionsInside,
			afterMs: summarizeIntervals(after),
			insideMs: summarizeIntervals(inside)
		};
	}
	return {
		rule: P23B_M1_POST_RELEASE_RULE,
		actions: measured.length,
		withRelease,
		window: summarizeIntervals(rows.map((row) => row.afterRelease.windowMs)),
		restore: summarizeIntervals(rows.map((row) => row.afterRelease.restoreMs)),
		commit: summarizeIntervals(rows.map((row) => row.afterRelease.commitMs)),
		other: summarizeIntervals(rows.map((row) => row.afterRelease.otherMs)),
		insideReleaseWindow: summarizeIntervals(rows.map((row) => row.insideRelease.windowMs)),
		insideReleaseRestore: summarizeIntervals(rows.map((row) => row.insideRelease.restoreMs)),
		insideReleaseCommit: summarizeIntervals(rows.map((row) => row.insideRelease.commitMs)),
		byLabel,
		rows
	};
}

export type P23BM1PostReleasePairing = {
	rule: string;
	/** Actions paired: a presented sample AND a post-release row for the same index. */
	matchedActions: number;
	presented: P23BM1IntervalSeries;
	/** Page-side marks after the release end, unioned per action. */
	window: P23BM1IntervalSeries;
	restore: P23BM1IntervalSeries;
	commit: P23BM1IntervalSeries;
	other: P23BM1IntervalSeries;
	/** Page-side marks inside the release itself — part of the release row, reported here for contrast. */
	insideRelease: P23BM1IntervalSeries;
	/** `max(0, presented − window)`: what the page was NOT running JavaScript for. */
	unexplained: P23BM1IntervalSeries;
	/**
	 * The same split as MEDIANS OF THE PAIRED POPULATION, with shares stated as
	 * ratios OF those medians. A ratio of medians is not a median of ratios, and the
	 * rule says which one it is so no reader has to guess.
	 */
	medians: {
		presentedMs: number;
		windowMs: number;
		restoreMs: number;
		commitMs: number;
		otherMs: number;
		unexplainedMs: number;
		windowShare: number;
		restoreShare: number;
		commitShare: number;
		otherShare: number;
		unexplainedShare: number;
	};
};

/**
 * Join the page's post-release rows to the presented-frame samples, action by
 * action. Only pairs where BOTH exist are reported, and the count of pairs is
 * stated, so a thin join is visible instead of looking like a small number.
 */
export function pairM1PostReleaseWithPresented(
	postRelease: P23BM1PostRelease,
	samples: readonly { actionIndex: number; latencyMs: number }[]
): P23BM1PostReleasePairing | null {
	const rows = new Map(postRelease.rows.map((row) => [row.actionIndex, row]));
	const presented: number[] = [];
	const window: number[] = [];
	const restore: number[] = [];
	const commit: number[] = [];
	const other: number[] = [];
	const insideRelease: number[] = [];
	const unexplained: number[] = [];
	for (const sample of samples) {
		const row = rows.get(sample.actionIndex);
		if (!row) continue;
		presented.push(sample.latencyMs);
		window.push(row.afterRelease.windowMs);
		restore.push(row.afterRelease.restoreMs);
		commit.push(row.afterRelease.commitMs);
		other.push(row.afterRelease.otherMs);
		insideRelease.push(row.insideRelease.windowMs);
		unexplained.push(Math.max(0, sample.latencyMs - row.afterRelease.windowMs));
	}
	if (presented.length === 0) return null;
	const presentedSeries = summarizeIntervals(presented);
	const windowSeries = summarizeIntervals(window);
	const restoreSeries = summarizeIntervals(restore);
	const commitSeries = summarizeIntervals(commit);
	const otherSeries = summarizeIntervals(other);
	const unexplainedSeries = summarizeIntervals(unexplained);
	const share = (part: number) =>
		presentedSeries.p50 === 0 ? 0 : Math.round((part / presentedSeries.p50) * 1000) / 1000;
	return {
		rule: 'Each pair is one action: the presented-frame latency measured for that release, beside the page-side marks the SAME action\'s containment tree reports AFTER that release\'s end (union per action, never a sum; the action\'s own `unbound` remainder included and counted). Values are p50s of the paired population; shares are ratios of those p50s (a ratio of medians, NOT a median of ratios). `unexplained` is `max(0, presented − window)` per action and is what the page was not running JavaScript for — paint, compositor and scheduling — never a claim that nothing else ran. `insideRelease` is reported beside it because a synchronous restore would land THERE, inside the release boundary the D1 row already reports, and must not be read as part of the wait.',
		matchedActions: presented.length,
		presented: presentedSeries,
		window: windowSeries,
		restore: restoreSeries,
		commit: commitSeries,
		other: otherSeries,
		insideRelease: summarizeIntervals(insideRelease),
		unexplained: unexplainedSeries,
		medians: {
			presentedMs: presentedSeries.p50,
			windowMs: windowSeries.p50,
			restoreMs: restoreSeries.p50,
			commitMs: commitSeries.p50,
			otherMs: otherSeries.p50,
			unexplainedMs: unexplainedSeries.p50,
			windowShare: share(windowSeries.p50),
			restoreShare: share(restoreSeries.p50),
			commitShare: share(commitSeries.p50),
			otherShare: share(otherSeries.p50),
			unexplainedShare: share(unexplainedSeries.p50)
		}
	};
}

function releaseSpansOf(actions: readonly P23BActionLedger[], path: BenchInteractionPath): P23BM1ReleaseSpan[] {
	const spans: P23BM1ReleaseSpan[] = [];
	for (const action of actions) {
		const release = action.samples.find(
			(sample) => sample.boundary === 'release' && typeof sample.start === 'number' && typeof sample.end === 'number'
		);
		if (!release || release.start === undefined || release.end === undefined) continue;
		const frame = action.samples.find(
			(sample) =>
				sample.boundary === 'browser-frame' && typeof sample.start === 'number' && typeof sample.end === 'number'
		);
		spans.push({
			actionIndex: action.index,
			path,
			outcome: action.outcome ?? 'unclassified',
			start: release.start,
			end: release.end,
			browserFrame:
				frame && frame.start !== undefined && frame.end !== undefined
					? { start: frame.start, end: frame.end }
					: null
		});
	}
	return spans;
}

/** One fixture+class capture → one reported class row. */
/**
 * WHICH LEDGER A CLASS ROW IS BUILT FROM. The live interaction registry keeps
 * only its most recent few sessions readable (`p23b-interaction-measure.ts`'s
 * `SESSION_HISTORY`), and M1 opens nineteen class sessions in one run. A record
 * built after the run therefore CANNOT look a closed session up again: the
 * lookup returns `null` and every population, D1 and D7 column of that class
 * silently reads as missing while the class's marks still look complete.
 *
 * The harness closes that gap by keeping the ledger it read back at the moment
 * the class closed, and that close-time snapshot is what this rule prefers. The
 * live lookup stays as the fallback so a row can still be built from a session
 * that is somehow still readable.
 */
export function m1ClassLedger(
	entry: { sessionId: string; ledger: P23BCaptureLedger | null },
	lookup: (sessionId: string) => P23BCaptureLedger | null
): P23BCaptureLedger | null {
	return entry.ledger ?? lookup(entry.sessionId);
}

/**
 * The measured action indices of one population, the key the gesture registry is
 * filtered by. Derived here, from the same array the mark and release rows are
 * taken over, so the series and the population can never be decided separately.
 */
export function m1MeasuredActionIndices(measured: readonly P23BActionLedger[]): Set<number> {
	return new Set(measured.map((action) => action.index));
}

export function summarizeM1Class(input: {
	fixtureId: string;
	sessionId: string;
	actionClass: string;
	actionPath: BenchInteractionPath;
	ledger: P23BCaptureLedger | null;
	containment: P23BContainmentRecord;
	warmup: number;
	/**
	 * The M1 gesture registry, NOT a pre-merged series: the class's series is
	 * resolved here, over the measured population this same function computes, so a
	 * series can never be reported over a different population than the rows beside
	 * it (warm-up drags and retried attempts are excluded, and counted).
	 */
	gestureRegistry: P23BM1FrameTiming;
	/** Accepted actions per class the protocol targets, for the nominal-count check. */
	actionsPerClass?: number;
	/** The class's long-frame window (item (b2)), or `null` when no window was opened. */
	longFrameWindow: { entries: readonly P23BM1LongFrameEntry[]; supported: boolean } | null;
	/**
	 * The BEFORE/AFTER arm each resolved action ran under, or `null`/empty for a
	 * class that ran one path only. The arm dimension is a measurement of the SAME
	 * protocol, not a second protocol: the population rule, the warm-up slots and
	 * the row shapes are unchanged, and the split is taken over the measured
	 * accepted actions this function already computed.
	 */
	actionArms?: ReadonlyMap<number, P23BM1RoomDragArm> | null;
	/**
	 * The Room-label arm each resolved action ran under, WITH the attempt's own
	 * grid-build count, or `null`/empty. A separate dimension from `actionArms`: it is
	 * recorded over EVERY class (the placer runs on every Plan render), and its rows
	 * are the runner's windows, so the page hands over the arm module's records and
	 * nothing else. `actionLabelArmKeys` is the class's grid-build key histogram, which
	 * is what turns the build count into a repeat rate.
	 */
	actionLabelArms?: readonly P23BM1ActionLabelArmRecord[] | null;
	/** The class's grid-build keys, or `null` when the run recorded none. */
	actionLabelArmKeys?: P23BM1GridBuildKeySummary | null;
	/**
	 * Whether this row is the class's COLD pass (§16): the same class, measured
	 * again with the camera moved between attempts. A DIFFERENT population of the
	 * same protocol, so every table defined over the repeat workload must be able to
	 * skip it — and the two names differ only in a prefix, so the flag travels with
	 * the row instead of being re-derived from the name by each table.
	 */
	cold?: boolean;
}): P23BM1ClassRow {
	const population = m1Population(input.ledger, input.actionPath, input.warmup);
	const {
		measured,
		completedOfPath,
		warmupSlots,
		warmupAcceptedExcluded,
		consideredAfterWarmup,
		excludedByOutcome
	} = population;
	const nominalMeasured =
		input.actionsPerClass === undefined ? null : Math.max(0, input.actionsPerClass - input.warmup);
	const gestureFrames = p23bM1GestureFramesFor(
		input.gestureRegistry,
		input.fixtureId,
		input.actionClass,
		m1MeasuredActionIndices(measured)
	);
	const byPath = summarizeContainmentByPath(input.containment, {
		warmup: input.warmup,
		outcomes: ['accepted']
	})[input.actionPath];
	const marks = Object.fromEntries(
		Object.entries(byPath?.nodes ?? {}).map(([label, row]) => [label, keyedRow(row)])
	);
	const boundaries = Object.fromEntries(
		Object.entries(byPath?.boundaries ?? {}).map(([label, row]) => [label, keyedRow(row)])
	);
	const unbound = Object.fromEntries(
		Object.entries(byPath?.unbound ?? {}).map(([label, row]) => [label, { ...row }])
	);
	const releaseSpans = releaseSpansOf(measured, input.actionPath);
	const frameValues = releaseSpans
		.map((span) => span.browserFrame)
		.filter((frame): frame is { start: number; end: number } => frame !== null)
		.map((frame) => Math.max(0, frame.end - frame.start));
	const outcomes: Partial<Record<BenchInteractionOutcome, number>> = {};
	for (const action of input.ledger?.actions ?? []) {
		if (action.status !== 'completed') continue;
		const key = action.path ?? action.intent;
		if (key !== input.actionPath) continue;
		const outcome = action.outcome ?? 'unclassified';
		outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
	}
	// The page-side record always reports the PROXY: only the CDP runner may
	// replace it with a presentation-grade row, and it does so explicitly — and
	// when it does, it rebuilds `attribution` from the replaced row
	// (`summarizeM1Attribution`) so the partition's presentation signal cannot
	// describe a different row than the class reports.
	const releaseRow: P23BM1ClassRow['releaseRow'] = {
		signal: 'proxy',
		definition: P23B_M1_RELEASE_PROXY_DEFINITION,
		distribution: summarizeIntervals(frameValues),
		coverage: {
			releases: releaseSpans.length,
			coveredReleases: frameValues.length,
			coveredShare: releaseSpans.length > 0 ? frameValues.length / releaseSpans.length : 0
		},
		proxy: {
			definition: P23B_M1_RELEASE_PROXY_DEFINITION,
			distribution: summarizeIntervals(frameValues),
			coverage: {
				releases: releaseSpans.length,
				coveredReleases: frameValues.length,
				coveredShare: releaseSpans.length > 0 ? frameValues.length / releaseSpans.length : 0
			}
		}
	};
	return {
		fixtureId: input.fixtureId,
		sessionId: input.sessionId,
		actionClass: input.actionClass,
		actionPath: input.actionPath,
		// Carried so a table defined over the REPEAT workload can exclude the cold
		// pass's twin of the same class (§16). Both prefixes end in `:${actionClass}`,
		// so a suffix match alone cannot tell them apart.
		...(input.cold ? { cold: true } : {}),
		ledger: {
			recordedActions: input.ledger?.actions.length ?? null,
			fixtureResets: input.ledger?.fixtureResets ?? null,
			droppedBoundaries: input.ledger?.droppedBoundaries ?? null,
			settled: input.ledger?.settled ?? null
		},
		population: {
			rule: P23B_M1_WARMUP_RULE,
			completedOfPath,
			warmupSlots,
			warmupAcceptedExcluded,
			consideredAfterWarmup,
			excludedByOutcome,
			measuredAccepted: measured.length,
			nominalMeasured,
			matchesNominal: nominalMeasured === null ? null : measured.length === nominalMeasured,
			outcomes
		},
		boundaries,
		marks,
		unboundInsideActions: unbound,
		commitCapture: marks['p2311:commit-capture'] ?? null,
		releaseSpans,
		releaseRow,
		gestureFrames,
		attribution: summarizeM1Attribution({
			marks,
			boundaries,
			releaseRow,
			measuredActions: measured.length
		}),
		postRelease: postReleaseWindowOf(input.containment, measured),
		// Filled by the CDP runner, which is the only side that sees a presented
		// frame: the page cannot know when the compositor presented anything.
		postReleaseVsPresented: null,
		// Same reason: a trace with durations is collected by the runner, not the page.
		presentedWindow: null,
		containmentMarks: { ...input.containment.marks },
		unattributedOutsideActions: input.containment.unattributed.map((pool) => ({
			name: pool.name,
			count: pool.count,
			p50: pool.p50,
			p95: pool.p95,
			totalMs: pool.totalMs
		})),
		longFrames: input.longFrameWindow
			? summarizeLongFrames(
					input.longFrameWindow.entries,
					releaseSpans,
					input.longFrameWindow.supported,
					input.longFrameWindow.supported
						? null
						: 'NOT MEASURED — this runtime did not report long-animation-frame entries.'
				)
			: summarizeLongFrames(
					[],
					releaseSpans,
					false,
					'NOT MEASURED — no long-frame window was opened for this class.'
				),
		arms: summarizeM1Arms({
			fixtureId: input.fixtureId,
			actionClass: input.actionClass,
			actionPath: input.actionPath,
			containment: input.containment,
			measured,
			gestureRegistry: input.gestureRegistry,
			longFrameWindow: input.longFrameWindow,
			actionArms: input.actionArms ?? null
		}),
		labelArms: summarizeM1LabelArms(input.actionLabelArms ?? null, input.actionLabelArmKeys ?? null)
	};
}

/**
 * Split one class's measured population by the BEFORE/AFTER arm each action ran
 * under, and take every row over the arm's OWN actions.
 *
 * REUSES THE CLASS'S OWN SUMMARIZERS. The arm's containment rows come from
 * `summarizeContainmentByPath` over the record's own action trees filtered to
 * that arm (`warmup: 0`, because the warm-up slots were already removed from the
 * measured population), and the arm's series comes from `p23bM1GestureFramesFor`
 * over that arm's action indices. Nothing here re-derives a row the class row
 * does not already derive, so an arm's mark p50 and the class's mark p50 are the
 * same number when the arm holds the whole population.
 *
 * Returns `null` — not an empty block — when no arm was recorded, so a reader can
 * tell "this class ran one path" from "this class ran arms and neither reported".
 */
export function summarizeM1Arms(input: {
	fixtureId: string;
	actionClass: string;
	actionPath: BenchInteractionPath;
	containment: P23BContainmentRecord;
	measured: readonly P23BActionLedger[];
	gestureRegistry: P23BM1FrameTiming;
	longFrameWindow: { entries: readonly P23BM1LongFrameEntry[]; supported: boolean } | null;
	actionArms: ReadonlyMap<number, P23BM1RoomDragArm> | null;
}): P23BM1ArmsBlock | null {
	const assignments = input.actionArms;
	if (!assignments || assignments.size === 0) return null;
	const present = P23B_M1_ROOM_DRAG_ARMS.filter((arm) => input.measured.some((action) => assignments.get(action.index) === arm));
	if (present.length === 0) return null;
	const rows: P23BM1ArmRow[] = present.map((arm) => {
		const own = input.measured.filter((action) => assignments.get(action.index) === arm);
		const indices = new Set(own.map((action) => action.index));
		const split: P23BContainmentRecord = {
			...input.containment,
			actions: input.containment.actions.filter((action) => indices.has(action.index))
		};
		const byPath = summarizeContainmentByPath(split, { warmup: 0, outcomes: ['accepted'] })[
			input.actionPath
		];
		const releaseSpans = releaseSpansOf(own, input.actionPath);
		const frameValues = releaseSpans
			.map((span) => span.browserFrame)
			.filter((frame): frame is { start: number; end: number } => frame !== null)
			.map((frame) => Math.max(0, frame.end - frame.start));
		return {
			arm,
			actions: own.length,
			boundaries: Object.fromEntries(
				Object.entries(byPath?.boundaries ?? {}).map(([label, row]) => [label, keyedRow(row)])
			),
			marks: Object.fromEntries(
				Object.entries(byPath?.nodes ?? {}).map(([label, row]) => [label, keyedRow(row)])
			),
			releaseRow: {
				distribution: summarizeIntervals(frameValues),
				coverage: {
					releases: releaseSpans.length,
					coveredReleases: frameValues.length,
					coveredShare: releaseSpans.length > 0 ? frameValues.length / releaseSpans.length : 0
				}
			},
			gestureFrames: p23bM1GestureFramesFor(
				input.gestureRegistry,
				input.fixtureId,
				input.actionClass,
				indices
			),
			longFrames: input.longFrameWindow
				? summarizeLongFrames(
						input.longFrameWindow.entries,
						releaseSpans,
						input.longFrameWindow.supported,
						input.longFrameWindow.supported
							? null
							: 'NOT MEASURED — this runtime did not report long-animation-frame entries.'
					)
				: summarizeLongFrames(
						[],
						releaseSpans,
						false,
						'NOT MEASURED — no long-frame window was opened for this class.'
					)
		};
	});
	const byArm = new Map(rows.map((row) => [row.arm, row]));
	// Legacy arm strings: old legs split `per-move` against `transient`, but no new
	// run records `per-move` (P23B.8 S8 retired the BEFORE arm), so `before` is null
	// going forward and the comparison rows carry nulls instead of a delta.
	const before = byArm.get('per-move' as P23BM1RoomDragArm) ?? null;
	const after = byArm.get('transient') ?? null;
	const comparisonRows: P23BM1ArmComparisonRow[] = [];
	const compare = (label: string, beforeMs: number | null, afterMs: number | null): void => {
		comparisonRows.push({
			label,
			perMoveMs: beforeMs,
			transientMs: afterMs,
			deltaMs: beforeMs === null || afterMs === null ? null : afterMs - beforeMs,
			ratio: beforeMs === null || afterMs === null || beforeMs === 0 ? null : afterMs / beforeMs
		});
	};
	compare('release', before?.boundaries['release']?.p50 ?? null, after?.boundaries['release']?.p50 ?? null);
	const markNames = [
		...new Set([...Object.keys(before?.marks ?? {}), ...Object.keys(after?.marks ?? {})])
	].sort();
	for (const name of markNames) {
		compare(`mark ${name}`, before?.marks[name]?.p50 ?? null, after?.marks[name]?.p50 ?? null);
	}
	compare(
		'gesture rAF interval p50',
		before?.gestureFrames?.distribution.p50 ?? null,
		after?.gestureFrames?.distribution.p50 ?? null
	);
	compare(
		'gesture rAF interval p95',
		before?.gestureFrames?.distribution.p95 ?? null,
		after?.gestureFrames?.distribution.p95 ?? null
	);
	compare(
		'gesture frames per action',
		before?.gestureFrames ? before.gestureFrames.frames / Math.max(1, before.actions) : null,
		after?.gestureFrames ? after.gestureFrames.frames / Math.max(1, after.actions) : null
	);
	return {
		rule: P23B_M1_ARM_RULE,
		arms: present,
		mixed: present.length > 1,
		rows,
		comparison: { note: P23B_M1_ARM_COMPARISON_NOTE, rows: comparisonRows }
	};
}

export function buildP23BM1Record(input: {
	provenance: Record<string, unknown>;
	protocol: string;
	classes: readonly P23BM1ClassRow[];
	fixtureOrder: readonly string[];
	limitations: readonly string[];
}): P23BM1Record {
	const fixtureIds = [...new Set(input.classes.map((row) => row.fixtureId))];
	const fixtures: P23BM1FixtureSummary[] = fixtureIds.map((fixtureId) => {
		const classes = input.classes.filter((row) => row.fixtureId === fixtureId);
		return {
			fixtureId,
			classes,
			advisory: isAdvisoryFixture(fixtureId),
			settled: classes.every((row) => row.ledger.settled === true),
			droppedBoundaries: classes.reduce((sum, row) => sum + (row.ledger.droppedBoundaries ?? 0), 0)
		};
	});
	const d1Rows: P23BM1D1Row[] = [];
	for (const row of ['wall-authoring', 'whole-room-move-bridge'] as const) {
		for (const fixture of fixtures) {
			// The advisory fixture is evidence that the protocol runs it, never a
			// recorded row: a connected case inside D1's table is a fixture leak.
			if (fixture.advisory) continue;
			// Matched on the CLASS, not the path: D1's second row is a drag that rides the
			// shared `plan-drag-edit` path, so the path alone would pick the wrong class —
			// and on the REPEAT workload: D1 is defined over the protocol as it has been
			// run, and the cold pass's twin of the same class ends with the same suffix,
			// so without this exclusion the cold class could be silently substituted for
			// the measured one (see `P23BM1ClassRow.cold`).
			const entry = fixture.classes.find(
				(candidate) => !candidate.cold && candidate.actionClass.endsWith(`:${row}`)
			);
			const release = entry?.boundaries['release'];
			if (!entry || !release) continue;
			d1Rows.push({
				row,
				mark: 'release',
				fixtureId: fixture.fixtureId,
				actionClass: entry.actionClass,
				p50: release.p50,
				p95: release.p95,
				count: release.count,
				comparison: P23B6_S1B_D1_COMPARISON[row]
			});
		}
	}
	return {			schema: {
			gesturePopulation: P23B_M1_GESTURE_POPULATION_RULE,
			advisoryFixtures:
				'The connected case runs LAST under the same protocol as evidence that it runs at all — never a recorded row. Its classes stay inside its own `fixtures` entry, marked `advisory: true`, and it is excluded from D1\'s and D7\'s rows so a connected case can never be read as measured evidence.',
			note: 'Pre-P23B.8 follow-up M1 — one runtime, one protocol, both D1 rows, the gesture-frame series, the release-side row with its signal label and coverage, long-frame incidence, D7 and the D13 note. ADVISORY: one machine, one DEV session. Not a baseline, not a budget, no threshold, no ratchet and no baseline file is read or written.',
			keyed:
				'Mark/boundary rows are keyed by label: { count, p50, p95, exclusiveSelf|null, exclusiveSelfWithheld, maxPerAction, actionsPresent }. exclusiveSelf is reported only where every occurrence in the class could be exclusive-priced (the containment rule). Nothing here may be summed across labels, across classes or across release windows.',
			population: P23B_M1_WARMUP_RULE,
			releaseSide:
				'A release row is labelled `presented-frame` only when a presentation-grade signal was correlated to it (the CDP runner adds that section); otherwise it is the existing `browser-frame` PROXY and is labelled one, with its coverage. The long-frame row is an incidence row and is never presented-frame latency.',
			arms: P23B_M1_ARM_RULE,
			advisory: 'One machine, DEV, advisory numbers only. No statistical claim and no numeric target.'
		},
		protocol: input.protocol,
		provenance: { ...input.provenance, fixtureOrder: [...input.fixtureOrder] },
		fixtures,
		populations: {
			note:
				'One row per class: the warm-up SLOTS consumed (the first completed actions of the path, whatever their outcome), how many accepted actions were inside those slots, how many non-accepted actions were filtered after the slots, and the reported measured count. A class whose path carries non-reported actions (the wall-authoring run\'s `setup` press) therefore reports more measured accepted actions than actions − warm-up. Rows over DIFFERENT counts are not equivalent samples and are never compared by count; `measuredCounts` lists every count this session reports.',
			rows: input.classes.map((row) => ({
				fixtureId: row.fixtureId,
				actionClass: row.actionClass,
				completedOfPath: row.population.completedOfPath,
				warmupSlots: row.population.warmupSlots,
				warmupAcceptedExcluded: row.population.warmupAcceptedExcluded,
				excludedByOutcome: row.population.excludedByOutcome,
				measuredAccepted: row.population.measuredAccepted,
				nominalMeasured: row.population.nominalMeasured,
				matchesNominal: row.population.matchesNominal
			})),
			measuredCounts: [...new Set(input.classes.map((row) => row.population.measuredAccepted))].sort(
				(a, b) => a - b
			)
		},
		d1: {
			note: 'D1 — both P23B.6 final-capture rows re-read on this runtime beside P23B.6 S1b final-head numbers. COMPARISON ONLY: a differently-run capture is never a delta claim; the increases stay UNRESOLVED unless this session explains them, and repeating one is a finding, not a fix. Each row states the measured population it was taken over (see `populations`): the wall-authoring classes report 23 measured accepted actions because their path also carries a `setup` press that consumes warm-up slots, while the drag classes report 20. No row is compared to another by count.',
			rows: d1Rows
		},
		d7: {
			note: 'D7 — the post-fix `commit-capture` number (the product mark in the commit path). Pre-fix browser evidence was 107–149 ms; ABSENT here with a reason means the class never reached a commit. Advisory fixtures are excluded, like D1\'s rows.',
			rows: input.classes
				.filter((row) => row.commitCapture !== null && !isAdvisoryFixture(row.fixtureId))
				.map((row) => ({ fixtureId: row.fixtureId, actionClass: row.actionClass, mark: row.commitCapture }))
		},
		d13: {
			note: 'D13 is NOTED beside M1 session, not folded into it.',
			coverageLimit: P23B_M1_D13_NOTE
		},
		limitations: [...input.limitations]
	};
}

/** The row labels the record's release section may carry; the runner sets them explicitly. */
export const P23B_M1_RELEASE_SIGNALS = {
	presented: P23B_M1_PRESENTED_FRAME_DEFINITION,
	proxy: P23B_M1_RELEASE_PROXY_DEFINITION,
	longFrames: P23B_M1_LONG_FRAME_DEFINITION
} as const;
