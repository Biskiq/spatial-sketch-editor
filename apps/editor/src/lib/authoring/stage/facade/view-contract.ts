import type { InspectionPose, PointerRay, PointerRayResult, ProjectWorldResult, Vec3, ViewingIntent, ViewportEvaluation, WorkingPlane, WorkingPlaneHit } from '@portfolio/camera-core';
import type { PlanEvaluationResult, PlanFragment } from '@portfolio/layout-core';
import type { CameraOutputClaim, CameraOutputDecision, CameraOutputPolicy, CameraOutputTicket } from '@portfolio/project-model';
import type { StageReadSnapshot } from '../accepted-read';
import type { CameraSession } from '../camera-session';
import type { PlanParameterOverrides } from '../plan-parameters';
import type { EntryRequalification } from '../selection-requalification';
import type { StageSelectionChange, StageSelectionEntry, StageSelectionState } from '../semantic-selection';
import type { StageDraftingPatch, StageDraftingState } from '../stage-drafting';
import type { StageHandleDiagnostic, StageMarkHit, StageMarkView } from '../stage-handles';
import type { StageHeightSheet, StageHeightTick } from '../stage-height-sheet';
import type { StageLightPreview } from '../stage-light-preview.svelte';
import type { GestureAcquisition, SelectionRemoval, SelectionRequalification, SelectionRequalificationOutcome, StageLens, StageSelection, StageSession, StageTask, TaskResumeOutcome } from '../stage-session';
import type { SKIP_REBIND_CONTROL } from './adapter-bindings';
import type {
	StageAdapter,
	StageAdapterRegistration,
	StageCandidatePreview,
	StageCardActionRecord,
	StageCardFactRecord,
	StageCardNameWriterRecord,
	StageCardSubject,
	StageCardWriterRecord,
	StageEraseAnswer,
	StageFindEntryRecord,
	StageGhostMesh,
	StageGuideContribution,
	StageHitCandidate,
	StageInkReadingRecord,
	StageInkReadingSession,
	StageInstrumentContent,
	StageIntentResult,
	StageKeyboardIntent,
	StageOverlayContribution,
	StagePickQuery,
	StagePointerIntent,
	StageSourceHit,
	StageSubject,
	StageTaskEntry,
	StageWorldGraphic
} from './adapter-contract';

export type ResolvedStageHit =
	| { readonly kind: 'resolved'; readonly hit: StageSourceHit }
	| { readonly kind: 'refused'; readonly hit: StageSourceHit; readonly message: string }
	/** The mark tier: an admitted mark of the primary selection's owning binding. */
	| { readonly kind: 'mark'; readonly mark: StageMarkView }
	/**
	 * Nothing selectable is under the candidate.
	 *
	 * A source the Plan excluded places **no fragment at all** (the evaluator emits a
	 * placement only for an eligible candidate), so an excluded target cannot
	 * intercept input by construction — there is no filter at the hit test that a
	 * defect could mis-set. The reason is therefore always "no fragment here", and a
	 * caller that needs to explain an exclusion reads membership, which is the
	 * surface that owns exclusions and their Reveal.
	 */
	| { readonly kind: 'none'; readonly reason: 'no-fragment' }
	| {
			readonly kind: 'failed';
			readonly code: 'stale-evaluation' | 'invalid-css-point' | 'invalid-viewport' | 'degenerate-ray' | 'parallel' | 'behind' | 'outside-supported-domain' | 'invalid-frame';
	  };

/**
 * R217.S10 — what one **host tool** (Measure, Eraser) finds at a Stage-local point.
 *
 * The host asks every binding that declares the tool in `hostTools` and arbitrates
 * only between their winners, exactly as Select does. `datumPoint` is the raw
 * (unsnapped) datum-plane point under the pointer, for a tool whose miss still
 * names a place; the host computes no domain fact from it.
 */
export type StageHostToolTarget =
	| { readonly kind: 'failed'; readonly code: 'stale-evaluation' | 'invalid-css-point' }
	| { readonly kind: 'none'; readonly datumPoint: Vec3 | null }
	| {
			readonly kind: 'hit';
			readonly adapterId: string;
			readonly hit: StageSourceHit;
			/** The winning domain's refusal for this tool, in its own words; `null` when eligible. */
			readonly refusal: string | null;
			readonly datumPoint: Vec3 | null;
	  };

/** One guide after the facade projects it into Stage CSS space. */
export type StageGuideView = {
	readonly id: string;
	readonly role: StageGuideContribution['role'];
	readonly segments: readonly (readonly [readonly [number, number], readonly [number, number]])[];
	readonly derivedSegments: readonly (readonly [readonly [number, number], readonly [number, number]])[];
	readonly labels: readonly { readonly css: readonly [number, number]; readonly text: string }[];
};

/** One candidate after the facade projects it into Stage CSS space. */
export type StageCandidatePreviewView = {
	readonly id: string;
	readonly role: StageCandidatePreview['role'];
	readonly drawing?: boolean;
	readonly polygons: readonly (readonly (readonly [number, number])[])[];
	readonly segments: readonly (readonly [readonly [number, number], readonly [number, number]])[];
	readonly labels: readonly { readonly css: readonly [number, number]; readonly text: string }[];
	readonly snap?: { readonly css: readonly [number, number]; readonly name: string };
};

/**
 * The outcome of installing changed content for the already-mounted project.
 *
 * `installed` is the whole post-edit transition: the accepted slot swapped, every
 * factory-bound adapter's previous binding disposed exactly once at install and
 * its replacement built on the next live evaluation, the live claim rebased onto
 * the new source revision, and a fresh inspection claim acquired at the **same**
 * pose. `unchanged` is the identical
 * content case: nothing is rebased and the live claim stays in place. `refused`
 * means the caller is looking at a different project identity (a replacement) or
 * has nothing mounted yet, and the host must mount it instead.
 */
export type StageContentInstall =
	| {
			readonly kind: 'installed';
			readonly previousSourceContentId: string;
			readonly sourceContentId: string;
			/** The pose the view continues at; identical to the pose it had before. */
			readonly pose: InspectionPose;
			/** The claim the source rebase ended, when one was live. */
			readonly endedClaim: CameraOutputClaim | null;
			/** The fresh claim re-acquired for the new source revision. */
			readonly claim: CameraOutputClaim | null;
			/**
			 * Adapters whose factory binding was retired for this snapshot. The binding
			 * itself is disposed here and rebuilt on the next live evaluation, so this
			 * names the retirement, not a completed rebuild.
			 */
			readonly reboundAdapters: readonly string[];
			readonly clearedSelection: boolean;
			readonly closedTask: boolean;
			readonly releasedGestures: number;
			/**
			 * The retained Layout helper's report for its primary projection. The canonical
			 * record of what survived is `selectionRemovals`, which also covers domains the
			 * Layout helper never described.
			 */
			readonly requalification: SelectionRequalificationOutcome;
			readonly selectionRemovals: readonly SelectionRemoval[];
	  }
	| { readonly kind: 'unchanged'; readonly sourceContentId: string; readonly claim: CameraOutputClaim | null }
	| {
			readonly kind: 'refused';
			readonly code: 'disposed' | 'no-current-source' | 'different-project' | 'stale-session';
			readonly message: string;
	  };

export type StageFacade = {
	/** The one current accepted source; it changes only through a content change. */
	snapshot(): StageReadSnapshot;
	readonly session: StageSession;
	readonly camera: CameraSession;
	/** The session-only light preview, or `null` when this host provides none. */
	lightPreview(): StageLightPreview | null;
	evaluation(): ViewportEvaluation | null;
	evaluationId(): string | null;
	/** The drawn body of one Scene entity, as the host's pick source measured it. */
	sceneBounds(id: string): { readonly min: Vec3; readonly max: Vec3 } | null;
	projectWorld(point: unknown, evaluationId: string): ProjectWorldResult;
	pointerRay(cssPoint: unknown, evaluationId: string): PointerRayResult;
	intersectWorkingPlane(ray: PointerRay, plane: WorkingPlane, evaluationId: string): WorkingPlaneHit;
	/** Submit a viewing intent; the run must present the current inspection ticket. */
	requestViewingIntent(intent: ViewingIntent, ticket: CameraOutputTicket | null, clockSeconds: number): StageIntentResult;
	/** Acquire the host's own inspection claim on the current output at the current pose. */
	acquireInspection(policy?: CameraOutputPolicy): CameraOutputDecision;
	/** The live inspection claim, or `null` while the output is free. */
	inspectionClaim(): CameraOutputClaim | null;
	/** The live inspection ticket a run must present for a viewing intent. */
	inspectionTicket(): CameraOutputTicket | null;
	/**
	 * A same-project content change: the view stays, factory-bound adapters are
	 * rebuilt, the output is re-acquired, and the selection is requalified through
	 * the supplied accepted correspondence (or cleared with a reason).
	 */
	installAccepted(
		next: StageReadSnapshot,
		options?: {
			readonly requalify?: SelectionRequalification;
			readonly requalifyEntry?: (entry: StageSelectionEntry) => EntryRequalification;
			/**
			 * Mutation-control seam for the adapter-lifetime criterion, keyed by a
			 * symbol this module exports so no ordinary option can trigger it. Only the
			 * conformance suite passes it; production omits it, and rebinding always
			 * happens. It exists so the rebind/disposal assertions can be shown to fail
			 * when the host does not rebuild factory bindings.
			 */
			readonly [SKIP_REBIND_CONTROL]?: true;
		}
	): StageContentInstall;
	/** Update project-level metadata without rebinding domain semantics or clearing selection. */
	adoptMetadata(next: StageReadSnapshot): ReturnType<StageSession['adoptMetadata']>;
	plan(overrides?: PlanParameterOverrides): PlanEvaluationResult;
	/**
	 * A string that changes exactly when `plan()` would produce a different
	 * evaluation.
	 *
	 * A presenter caches on **this**, not on its own guess. The Plan's inputs are the
	 * compile generation, the level datum, the parameters and — only when the
	 * lateral span is bounded, or the target is not finite — the inspection target.
	 * A caller that keyed on the target unconditionally re-evaluated the whole Plan
	 * on every pan frame for a result that could not change; a caller that assumed
	 * the target never matters would keep a stale Plan the moment an adapter bounded
	 * the span. Neither caller has to know which case it is in.
	 */
	planDependencyKey(): string;
	/**
	 * The host's current Plan parameters. Reveal is creator intent that must widen
	 * **hit** eligibility as well as display, so it is host state the hit path reads
	 * too — never a per-call argument that could disagree with the render.
	 */
	setPlanParameters(overrides: PlanParameterOverrides): void;
	/** The one Height Sheet height fact; session view state, never source. */
	heightSheet(): StageHeightSheet;
	/** Owner-declared height ticks, merged and sorted by the host. */
	heightTicks(): readonly StageHeightTick[];
	eligibleFragments(): readonly PlanFragment[];
	resolveSourceHit(candidate: StageHitCandidate): ResolvedStageHit;
	resolvePick(query: StagePickQuery, toolOwner?: string | null): ResolvedStageHit;
	/** R217.S10 — the one host-tool winner (with its owning adapter) at a Stage-local point. */
	hostToolTarget(query: StageHitCandidate & { readonly tool: string; readonly coarse?: boolean }): StageHostToolTarget;
	/** R217.S10 — the owning binding's erase answer for its own winner. */
	eraseAnswer(adapterId: string, hit: StageSourceHit): StageEraseAnswer | null;
	/** Admitted selected-subject marks, then any current domain idle-hover marks. */
	marks(): readonly StageMarkView[];
	/** The mark under a Stage-local CSS point, or `null`. */
	hitMark(query: { readonly css: readonly [number, number]; readonly coarse: boolean }): StageMarkHit | null;
	/** Update idle-hover contributors and return their mark at this pointer, if any. */
	idleHoverIntent(intent: StagePointerIntent): StageMarkHit | null;
	/** Hover emphasis for one mark; never selection, history or source. */
	setMarkHover(mark: { readonly adapterId: string; readonly id: string } | null): void;
	/** Toggle a disclosure mark. Returns `true` when a disclosure was activated. */
	activateDisclosure(id: string): boolean;
	/** Close an open disclosure; `true` when one was open and is now closed. */
	closeDisclosure(): boolean;
	/** Every handle admission refusal the host has recorded. */
	handleDiagnostics(): readonly StageHandleDiagnostic[];
	selection(): StageSelection | null;
	selectionState(): StageSelectionState;
	setSelection(value: StageSelectionState): StageSelectionChange;
	select(selection: StageSelection | null): void;
	/** The one Grid/Snap view state. It never reaches source, history or Save. */
	drafting(): StageDraftingState;
	setDrafting(patch: StageDraftingPatch): StageDraftingState;
	openTask(task: StageTask): boolean;
	closeTask(): boolean;
	changeLens(next: StageLens): boolean;
	resumeTask(): TaskResumeOutcome;
	registerStageAdapter(adapter: StageAdapter): StageAdapterRegistration;
	adapters(): readonly StageAdapter[];
	/**
	 * Subscribe to registration and binding changes (register, dispose, rebuild).
	 * A UI's derived contribution views read this signal so an adapter mounted after
	 * the fact reaches the Index, the Card and the instrument host without a shell
	 * edit and without an unrelated state change to shake it loose.
	 */
	onAdaptersChanged(listener: () => void): () => void;
	/** Every contributed task, ordered deterministically and stamped with its adapter. */
	tasks(): readonly StageTaskEntry[];
	/** Every contributed Ink reading, ordered deterministically and stamped with its adapter. */
	inkReadings(): readonly StageInkReadingRecord[];
	/**
	 * Open one contributed Ink reading's session. The reading is selected by its
	 * contribution ID; when two adapters contribute the same ID, the first in the
	 * deterministic order wins. A throwing begin refuses rather than degrading the
	 * Stage, exactly as a throwing contributor does elsewhere in this host.
	 */
	openInkReading(id: string, adapterId?: string):
		| { readonly reading: StageInkReadingRecord; readonly session: StageInkReadingSession }
		| null;
	/**
	 * Open one contributed task by its contribution ID.
	 *
	 * Contribution IDs are per-adapter: when two adapters contribute the same ID,
	 * the first in the deterministic order (explicit order, then adapter ID) wins,
	 * and the returned `adapterId` names the owner that actually opened it.
	 */
	instrumentForTask(id: string, adapterId?: string): StageInstrumentContent | null;
	openFindEntry(adapterId: string, id: string): ReturnType<StageFacade['openContributedTask']>;
	openContributedTask(id: string, adapterId?: string):
		| {
				readonly kind: 'opened';
				readonly taskId: string;
				readonly task: StageTask;
				readonly adapterId: string;
				/** Content the owning adapter contributes for the mounted instrument. */
				readonly instrument: StageInstrumentContent | null;
		  }
		| { readonly kind: 'refused'; readonly code: 'unknown-task' | 'task-closed' | 'wrong-lens'; readonly message: string };
	/** Every contributed Find entry, ordered deterministically and stamped with its adapter. */
	findEntries(): readonly StageFindEntryRecord[];
	subjects(): readonly StageSubject[];
	/** Card facts contributed for one subject, ordered by adapter ID then label. */
	cardFacts(subject: StageCardSubject): readonly StageCardFactRecord[];
	/** The one name writer contributed for a subject, or `null` when none claims it. */
	cardNameWriter(subject: StageCardSubject): StageCardNameWriterRecord | null;
	/** The one Card field writer contributed for a subject, or `null`. */
	cardWriter(subject: StageCardSubject): StageCardWriterRecord | null;
	/** Every scoped Card action contributed for a subject, in deterministic order. */
	cardActions(subject: StageCardSubject): readonly StageCardActionRecord[];
	overlays(): readonly StageOverlayContribution[];
	/** Every adapter's persistent line guide, projected once into Stage CSS space. */
	guides(): readonly StageGuideView[];
	/** Every adapter candidate, projected once into Stage CSS space. */
	candidatePreviews(): readonly StageCandidatePreviewView[];
	graphics(): readonly StageWorldGraphic[];
	/** Every adapter's proposed-pose mesh for the live evaluation. */
	ghosts(): readonly StageGhostMesh[];
	/**
	 * Offer a press to the binding that owns the open task. Returns the adapter
	 * that claimed it, or `null` when the host's navigation gesture keeps it.
	 */
	pointerIntent(intent: StagePointerIntent): { readonly claimed: boolean; readonly adapterId: string | null };
	hoverIntent(intent: StagePointerIntent): boolean;
	/**
	 * Offer a command key to the binding that owns the open task. Returns the
	 * adapter that answered it, or `null` when the host's own unwinding keeps it.
	 */
	keyboardIntent(intent: StageKeyboardIntent): { readonly claimed: boolean; readonly adapterId: string | null };
	/**
	 * Offer a command/typing key to the adapter that claimed the live no-task
	 * press. This is the gesture's own writer path; a task's keys still travel
	 * through `keyboardIntent`.
	 */
	gestureKeyIntent(intent: StageKeyboardIntent): { readonly claimed: boolean; readonly adapterId: string | null };
	/**
	 * Offer a command key to the registered adapters when neither an open task nor
	 * a live press owns the keyboard. A selected subject's adapter can claim a
	 * key it has a scoped meaning for (D2: Delete/Backspace on an active bend
	 * point); every other adapter leaves it to the host's existing map.
	 */
	selectionKeyIntent(intent: StageKeyboardIntent): { readonly claimed: boolean; readonly adapterId: string | null };
	/**
	 * Ask the shell to re-read contributions now. An adapter that changes preview
	 * state (a candidate pose) calls this so the overlay reflects it without a
	 * document change.
	 */
	notifySurfaceChange(): void;
	acquireGesture(request: {
		owner: string;
		evaluationId: string;
		policy: 'continue-after-revalidation' | 'suspend-proposal' | 'cancel-on-reading-change';
		/** `true` for the host's own navigation press; default `false` (authored work). */
		navigation?: boolean;
	}): GestureAcquisition;
	dispose(): void;
};
