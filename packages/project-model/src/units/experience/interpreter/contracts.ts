import type { ProgramEvent, ProgramInvocation } from '../../../program/types';

export type ExperienceRunPhase =
	| 'ready'
	/** An arrival Travel is playing; the stay has not started yet. */
	| 'traveling'
	/** Reserved for a host that stages arrival; the reducer never produces it. */
	| 'arrived'
	| 'holding'
	| 'completed'
	| 'cancelled';

/** The lead-in a resumed stay keeps, so the tour never leaves the moment a visitor rejoins. */
export const EXPERIENCE_RESUME_LEAD_IN_MS = 2000;

export type ExperiencePanel = {
	readonly presentationId: string;
	readonly title: string;
	readonly content: readonly { readonly id: string; readonly text: string }[];
};

export type ExperienceVisit = {
	readonly stopId: string;
	readonly occurrenceId: string;
	/** One-based visit order within the run. */
	readonly index: number;
};

/**
 * A Stop occurrence that Explore suspended. `resume` restores exactly this: the
 * same occurrence, its View, the remaining stay (or the wait) and whether the
 * tour was paused. There is one resume point however many Presentations the
 * visitor opens.
 */
export type ExperienceSuspendedVisit = {
	readonly stopId: string;
	readonly occurrenceId: string;
	readonly viewId: string;
	/** Remaining stay in milliseconds, or `null` when the Stop was waiting for Next. */
	readonly holdRemainingMs: number | null;
	readonly paused: boolean;
	readonly returnToStopId: string | null;
};

export type ExperienceRunState = {
	readonly runId: string;
	readonly runEpoch: number;
	/**
	 * The lowering source this run was prepared from, or `null` when the host did
	 * not declare one. A run belongs to exactly one source: dispatching against a
	 * different source is a rebase and every event for the old run is stale.
	 */
	readonly sourceContentId: string | null;
	readonly entered: boolean;
	readonly stopId: string | null;
	readonly occurrenceId: string | null;
	readonly presentationId: string | null;
	/** The current Camera View, or `null` before any arrival. */
	readonly viewId: string | null;
	/** Zero-based index of the current View in its Presentation's order, or `null`. */
	readonly viewIndex: number | null;
	readonly phase: ExperienceRunPhase;
	/** Explicit integer Guide clock since the run entered, in milliseconds. */
	readonly elapsedMs: number;
	/** Remaining stay on the current occurrence, or `null` when none is running. */
	readonly holdRemainingMs: number | null;
	/** Automatic pacing only: the Guide clock is frozen until Play or Next. */
	readonly paused: boolean;
	readonly visited: readonly ExperienceVisit[];
	readonly values: Readonly<Record<string, string | boolean>>;
	readonly panel: ExperiencePanel | null;
	/** Content ids a lifecycle `show-content` selected before a panel existed. */
	readonly pendingContent: readonly string[];
	readonly invocation: ProgramInvocation | null;
	/** The logical predecessor of a Travel. */
	readonly invocationFromViewId: string | null;
	/** The origin a covered detour must return to, or `null`. */
	readonly returnToStopId: string | null;
	/**
	 * The Stop occurrence Explore suspended, or `null`. Only the explicit `resume`
	 * event returns to it; Next never does.
	 */
	readonly resume: ExperienceSuspendedVisit | null;
	readonly lastEvent: ProgramEvent | null;
};

type RunEvent<K extends string> = {
	readonly kind: K;
	readonly runId: string;
	readonly runEpoch: number;
};

export type ExperienceEvent =
	| RunEvent<'enter'>
	/**
	 * Enter one Presentation to explore it. From a Stop it keeps that occurrence
	 * suspended (landing an arrival Travel first); from nothing it is the
	 * guide-free Places path. It starts at `viewId` when that is one of the
	 * Presentation's Views, else at its Default, and never fabricates a Stop.
	 */
	| (RunEvent<'enter-presentation'> & { readonly presentationId: string; readonly viewId?: string })
	/** Step to one View of the explored Presentation: its authored step when adjacent, else a Cut. */
	| (RunEvent<'explore-view'> & { readonly viewId: string })
	/** Confirms the current arrival; after an arrival Travel it starts the stay. */
	| RunEvent<'arrival'>
	/** Next: lands an arrival now, ends a stay, or continues a wait; it also resumes play. */
	| RunEvent<'continue'>
	| RunEvent<'pause'>
	| RunEvent<'play'>
	/** Back to the tour: restore the suspended occurrence with its lead-in. */
	| RunEvent<'resume'>
	| RunEvent<'complete'>
	| RunEvent<'cancel'>
	| RunEvent<'reset'>
	| (RunEvent<'tick'> & { readonly milliseconds: number })
	| (RunEvent<'navigate'> & { readonly stopId: string })
	| (RunEvent<'set-state'> & { readonly stateId: string; readonly value: string | boolean });

export type ExperienceDetourPolicy = {
	readonly fromStopId: string;
	readonly toStopId: string;
	readonly returnToStopId: string;
};

/**
 * One validated runtime edge: the Camera invocation for arriving at `toStopId`
 * **from `fromStopId`**. Lowering derives these for every authored edge, so the
 * invocation a run uses is the one that starts at its actual predecessor, never
 * the Guide-adjacent binding of some other approach.
 */
export type ExperienceTransition = {
	readonly fromStopId: string;
	readonly toStopId: string;
	readonly invocation: ProgramInvocation;
};

export type ExperienceInterpreterOptions = {
	readonly runId: string;
	readonly runEpoch: number;
	/** The lowering source this run belongs to; a differing value ends the run. */
	readonly sourceContentId?: string | null;
	readonly detours?: readonly ExperienceDetourPolicy[];
	/**
	 * Lowering-derived invocation per authored edge. Without a table the run only
	 * trusts a Stop's own invocation for its authored predecessor; any other jump
	 * may Cut, and a Travel without a matching edge is a typed gap.
	 */
	readonly transitions?: readonly ExperienceTransition[];
};

export type ExperienceEffect =
	| {
			readonly kind: 'camera';
			/** `null` while exploring a Presentation, which has no Stop occurrence. */
			readonly stopId: string | null;
			readonly invocation: ProgramInvocation;
	  }
	| { readonly kind: 'hold'; readonly stopId: string; readonly milliseconds: number }
	| { readonly kind: 'ready'; readonly stopId: string | null }
	| { readonly kind: 'panel'; readonly panel: ExperiencePanel }
	| { readonly kind: 'open-url'; readonly url: string }
	| { readonly kind: 'completed' }
	| {
			readonly kind: 'gap';
			readonly fromStopId: string | null;
			readonly toStopId: string;
			readonly message: string;
	  };

export type ExperienceReduceOutcome = 'accepted' | 'ignored' | 'stale';

export type ExperienceReduceResult = {
	readonly state: ExperienceRunState;
	readonly outcome: ExperienceReduceOutcome;
	readonly effects: readonly ExperienceEffect[];
};
