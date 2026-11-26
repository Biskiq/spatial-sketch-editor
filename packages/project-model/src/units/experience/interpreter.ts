/**
 * The one Experience interpreter (AM-6).
 *
 * A deterministic reducer over `ExecutionProgram@4`: an initial state plus
 * ordered events produce the same state every time, and an explicit integer
 * clock supplies every hold. There is no ambient time, randomness, network,
 * renderer or Camera evaluation here — the interpreter derives editorial state
 * and emits Camera *intents*, and the Camera authority evaluates pose,
 * projection and route timing.
 *
 * Identity rules:
 *
 * - a Stop is a stable authored occurrence; each visit adds a **fresh run
 *   occurrence identity** (`occurrenceId`), so revisiting a Stop never reuses a
 *   visit;
 * - every event is qualified by `runId` + `runEpoch`; an event from an older run
 *   is rejected (`stale`) and can neither advance, complete nor clear the newer
 *   run;
 * - an `arrival` event only confirms the current occurrence. The Camera intent is
 *   emitted once at editorial arrival, so a confirmation never reissues it, and
 *   a terminal run ignores the confirmation entirely;
 * - state is initialized once per run and reset explicitly, never on every
 *   arrival. A `reset` rewinds the **same** run (`runId`/`runEpoch` unchanged)
 *   to a fresh entry; starting a new run is the host's new-run path, not reset.
 *
 * Guide clock (sheet §31): a Stop's stay counts only after its arrival
 * completes. An arrival by Travel is `traveling` until the host confirms it with
 * `arrival` (or Next lands it now with a Cut); then the Stop `holding`s for its
 * stay (Automatic) and plays on, or waits `ready` for Next (Manual). Pause and
 * Explore freeze the clock: ticks are ignored. Explore keeps the Stop occurrence
 * suspended, and `resume` restores it — the same occurrence, the remaining stay
 * (with a lead-in) and the play or pause state — as a Cut, never a fresh arrival.
 *
 * The reducer owns no authored source: a run is session state and is never
 * written back to the envelope.
 */

export type {
	ExperienceRunPhase,
	ExperiencePanel,
	ExperienceVisit,
	ExperienceSuspendedVisit,
	ExperienceRunState,
	ExperienceEvent,
	ExperienceDetourPolicy,
	ExperienceTransition,
	ExperienceInterpreterOptions,
	ExperienceEffect,
	ExperienceReduceOutcome,
	ExperienceReduceResult,
} from './interpreter/contracts';
export { EXPERIENCE_RESUME_LEAD_IN_MS } from './interpreter/contracts';
export {
	createExperienceRun,
	isExploring,
	reduceExperience,
	replayExperience,
} from './interpreter/reduce';
export { createExperienceInterpreter } from './interpreter/session';
