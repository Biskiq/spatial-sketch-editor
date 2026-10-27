/**
 * Bench profiles (T1.P02.S06 owner decisions, 2026-10-26).
 *
 * `acceptance` is the original ratified method: 10 measured runs per row, 5
 * in-session drag/precision samples, 20 Undo/Redo cycles, 20 edits per F13
 * cycle, every cache state, the A.6 old-method rows and the delayed-preview
 * proof. Bench 1 measured it and its budgets are unchanged.
 *
 * `diagnostic` is the owner-approved Bench 2 pre-pass. It counts as the second
 * authorized pass but cannot discharge a statistical acceptance gate: it keeps
 * the real browser interactions, 60 pointer inputs per drag and the full E5
 * correctness matrix, while reducing the observations used to decide whether
 * the S06 gains are present. Its rows and report are marked non-acceptance.
 *
 * `milestone` is the S06 milestone gate (owner direction, 2026-10-26). It uses
 * Bench 2's representative interactions and lean cache-state coverage, then
 * spends additional independent runs only while a hard row is undecided
 * (`lib/milestone.ts`). Its decision rows are S06 milestone acceptance; it is
 * explicitly not production-scale or rare-tail certification. The formal
 * `acceptance` defaults remain unchanged when no profile is named.
 */

export type PerfProfile = 'acceptance' | 'diagnostic' | 'milestone';

export const CACHE_STATES = ['cold', 'warm', 'repeat-use'] as const;
export type CacheStateName = (typeof CACHE_STATES)[number];

export type FlowName = 'f2' | 'f3' | 'f7' | 'f13';

export type SamplePlan = {
	readonly profile: PerfProfile;
	/** Only an acceptance plan may be cited as formal evidence. */
	readonly acceptanceEvidence: boolean;
	readonly runs: number;
	readonly warmup: number;
	/** The contract floor: 60 pointer inputs per drag run, unchanged here. */
	readonly inputSamples: number;
	readonly dragSamples: number;
	readonly undoRedoCycles: number;
	readonly f13Edits: number;
	readonly f13Cycles: Readonly<Record<CacheStateName, number>>;
	readonly cacheStates: Readonly<Record<FlowName, readonly CacheStateName[]>>;
	/**
	 * Measured runs per flow. `f3` varies by cache state in the diagnostic plan:
	 * one cold and one repeat-use run are checks, not distributions.
	 */
	readonly runCounts: Readonly<Record<FlowName, number | Readonly<Record<CacheStateName, number>>>>;
	readonly oldMethod: boolean;
	readonly delayProof: boolean;
	/** `all`, or the only tiers whose attribution traces run. */
	readonly stageTraceTiers: 'all' | readonly string[];
	readonly note: string;
};

export const ACCEPTANCE_PLAN: SamplePlan = {
	profile: 'acceptance',
	acceptanceEvidence: true,
	runs: 10,
	warmup: 1,
	inputSamples: 60,
	dragSamples: 5,
	undoRedoCycles: 20,
	f13Edits: 20,
	f13Cycles: { cold: 10, warm: 1, 'repeat-use': 10 },
	cacheStates: {
		f2: CACHE_STATES,
		f3: CACHE_STATES,
		f7: CACHE_STATES,
		f13: CACHE_STATES
	},
	runCounts: { f2: 10, f3: 10, f7: 10, f13: 10 },
	oldMethod: true,
	delayProof: true,
	stageTraceTiers: 'all',
	note: 'ratified acceptance method: 10 measured runs, 60 pointer inputs per drag, every cache state, A.6 and the delayed-preview proof'
};

export const MILESTONE_PLAN: SamplePlan = {
	profile: 'milestone',
	acceptanceEvidence: true,
	// Three independent runs is the decision floor; `lib/milestone.ts` extends a
	// single row one run at a time (to 10, or 5 for F7) while it is undecided.
	runs: 3,
	warmup: 1,
	inputSamples: 60,
	// Bench 2's in-session cost: the decision uses independent runs, not more
	// pointer samples inside one run.
	dragSamples: 2,
	// Ten cycles keeps a ten-deep Undo/Redo history exercised; the contract's 20
	// is not rerun, and the deeper stack remains Bench 1 evidence (recorded).
	undoRedoCycles: 10,
	// The F13 hard row is defined over its edit and cycle counts, so the milestone
	// keeps 20 edits and the contract's ten measured cycles rather than Bench 2's
	// short leak check.
	f13Edits: 20,
	f13Cycles: { cold: 10, warm: 1, 'repeat-use': 10 },
	cacheStates: {
		f2: ['cold', 'warm'],
		f3: CACHE_STATES,
		f7: ['warm'],
		f13: CACHE_STATES
	},
	runCounts: {
		f2: 3,
		f3: { cold: 1, warm: 3, 'repeat-use': 1 },
		f7: 3,
		f13: 1
	},
	oldMethod: false,
	delayProof: false,
	stageTraceTiers: ['grid-L'],
	note: 'milestone method: 3 independent runs per decision row, extended one run at a time to 10 (F7 to 5) only while a hard row is undecided; 60 pointer inputs; 10 Undo/Redo cycles; 20 F13 edits over ten measured cycles; F2 cold+warm; F7 warm; full E5 matrix; no A.6 or delayed-preview proof (Bench 1 evidence)'
};

export const DIAGNOSTIC_PLAN: SamplePlan = {
	profile: 'diagnostic',
	acceptanceEvidence: false,
	runs: 3,
	warmup: 1,
	inputSamples: 60,
	dragSamples: 2,
	undoRedoCycles: 5,
	// F13 is a leak check, not a completion row; ten edits preserve a usable
	// retained-per-edit slope while three cycles keep the pre-pass short.
	f13Edits: 10,
	f13Cycles: { cold: 1, warm: 2, 'repeat-use': 1 },
	cacheStates: {
		f2: ['cold', 'warm'],
		f3: CACHE_STATES,
		f7: ['warm'],
		f13: CACHE_STATES
	},
	runCounts: {
		f2: 3,
		f3: { cold: 1, warm: 3, 'repeat-use': 1 },
		f7: 1,
		f13: 1
	},
	oldMethod: false,
	delayProof: false,
	stageTraceTiers: ['grid-L'],
	note: 'diagnostic, not acceptance evidence: 3 measured runs (one cold/repeat-use F3/F4/F8 run), 2 drag/precision samples, 5 Undo/Redo cycles, 10 F13 edits, F2 cold+warm, F7 warm only, traces at L only, no A.6 or delay proof'
};

export function parseProfile(value: string | undefined): PerfProfile {
	if (value === undefined || value === '') return 'acceptance';
	if (value === 'acceptance' || value === 'diagnostic' || value === 'milestone') return value;
	throw new Error(`profile takes acceptance, diagnostic or milestone, not ${value}`);
}

export function basePlan(profile: PerfProfile): SamplePlan {
	return profile === 'diagnostic' ? DIAGNOSTIC_PLAN : profile === 'milestone' ? MILESTONE_PLAN : ACCEPTANCE_PLAN;
}
