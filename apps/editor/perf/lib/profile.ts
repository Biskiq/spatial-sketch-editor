/**
 * Bench profiles (T1.P02.S06 Bench 2 owner decision, 2026-10-26).
 *
 * `acceptance` is the ratified method: 10 measured runs per row, 5 in-session
 * drag/precision samples, 20 Undo/Redo cycles, 20 edits per F13 cycle, every
 * cache state, the A.6 old-method rows and the delayed-preview proof.
 *
 * `diagnostic` is the owner-approved Bench 2 pre-pass. It counts as the second
 * authorized pass but cannot discharge a statistical acceptance gate: it keeps
 * the real browser interactions, 60 pointer inputs per drag and the full E5
 * correctness matrix, while reducing the observations used to decide whether
 * the S06 gains are present. Its rows and report are marked non-acceptance.
 *
 * The formal defaults are unchanged when no profile is named. Bench 3's lean
 * plan is deliberately not represented here: it is unratified.
 */

export type PerfProfile = 'acceptance' | 'diagnostic';

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
	if (value === 'acceptance' || value === 'diagnostic') return value;
	throw new Error(`profile takes acceptance or diagnostic, not ${value}`);
}

export function basePlan(profile: PerfProfile): SamplePlan {
	return profile === 'diagnostic' ? DIAGNOSTIC_PLAN : ACCEPTANCE_PLAN;
}
