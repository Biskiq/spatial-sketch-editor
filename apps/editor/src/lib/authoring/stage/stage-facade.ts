import { perfMark, perfMarksEnabled } from '$lib/platform/perf-marks';
import type { SceneRenderedHit } from '$lib/authoring/scene/scene-pick-source';
import { resolveStagePick } from './stage-pick';
import { EMPTY_SELECTION, primaryEntry, sameReference, type StageSelectionState, type StageSelectionChange } from './semantic-selection';
import type { EntryRequalification } from './selection-requalification';
import type { StageSelectionEntry } from './semantic-selection';
import type { SelectionRemoval, StageLens, TaskResumeOutcome } from './stage-session';
import {
	STAGE_DRAFTING_DEFAULTS,
	type StageDraftingPatch,
	type StageDraftingState
} from './stage-drafting';
import type { SemanticReference, F4JsonValue, SceneFormSource } from '@portfolio/project-model';
/**
 * The public editor host facade — the consumer boundary of
 * `T1.viewport-projection@1`.
 *
 * Everything a T2/T3 adapter may use is here, and nothing else. A domain adapter
 * registers through `registerStageAdapter`, projects and picks through the **same**
 * evaluation the meshes were drawn with, and reaches no private Stage state. The
 * facade owns:
 *
 * - the one current `ViewportEvaluation` and the id that names it, so projection,
 *   rays, overlays and the renderer cannot disagree about which matrices are live;
 * - the Layout-owned ordinary Plan evaluation and its **eligible** fragment
 *   projection, so hidden or excluded targets cannot intercept input;
 * - one canonical selection, one task home and the gesture lease, delegated to the
 *   session host (never a second selection or history);
 * - the one accepted-source slot and its **content change** transition: the same
 *   project with new content keeps the view exactly where it is — same pose, and
 *   its own inspection claim re-acquired against the new source revision — while a
 *   new project identity is a replacement the host mounts with a fresh view;
 * - editor-only adapter registration with **explicit capability refusal**: an
 *   adapter that requires a capability this host does not provide refuses to mount
 *   rather than mounting degraded.
 *
 * No writable store crosses the boundary: an adapter receives read access and
 * deliberate selection/intent requests, not the host's state.
 */
import {
	projectWorld,
	pointerRay,
	intersectWorkingPlane,
	type PointerRay,
	type PointerRayResult,
	type ProjectWorldResult,
	type InspectionPose,
	type ViewingIntent,
	type ViewingIntentResult,
	type ViewportCameraState,
	type ViewportEvaluation,
	type ViewportEvaluationToken,
	type WorkingPlane,
	type WorkingPlaneHit
} from '@portfolio/camera-core';
import type { Vec3 } from '@portfolio/camera-core';
import type { Component } from 'svelte';
import type { StageAdapterServices } from './stage-adapter-host';
import {
	createPlanRetainer,
	eligiblePlanFragments,
	planDependsOnTarget,
	planTargetsLiveView,
	type LayoutVec2,
	type PlanEvaluation,
	type PlanEvaluationResult,
	type PlanFragment,
	type PlanParameters,
	type PlanSourceKind,
	type PlanSourceRef,
	type PlanSubRef,
	type PlanStream
} from '@portfolio/layout-core';
import { requestCameraOutput } from '@portfolio/project-model';
import type {
	CameraOutputClaim,
	CameraOutputDecision,
	CameraOutputPolicy,
	CameraOutputRefusal,
	CameraOutputTicket
} from '@portfolio/project-model';

import {
	PLAN_DEFAULT_CUT_HEIGHT_METERS,
	planParameters,
	type PlanParameterOverrides
} from './plan-parameters';
import { createCameraSession, evaluationIdOf, type CameraSession } from './camera-session';
import type { StageReadSnapshot } from './accepted-read';
import {
	admitStageHandles,
	hitStageMark,
	projectStageHandles,
	stageHandleVisible,
	type StageHandleDescriptor,
	type StageHandleDiagnostic,
	type StageMarkHit,
	type StageMarkView
} from './stage-handles';
import {
	mergeStageHeightTicks,
	type StageHeightSheet,
	type StageHeightTick
} from './stage-height-sheet';
import type {
	GestureAcquisition,
	SelectionRequalification,
	SelectionRequalificationOutcome,
	StageSelection,
	StageSession,
	StageTask
} from './stage-session';

/** The capabilities this host actually provides. Anything else refuses mounting. */
export const HOST_STAGE_CAPABILITIES: readonly string[] = [
	'viewport-projection-v1',
	'layout-plan-representation-v1',
	'stage-selection-v1',
	'stage-instrument-v1',
	// T5.P01.S02 — Ink is one Pen that can carry readings from more than one
	// domain. The host keeps the contribution list; the reading's own session
	// owns its meaning, so this adds no document state to the Stage.
	'ink-readings-v1'
];


/** Domain-owned locator row, shared by Index and Head Find. */
export type StageSubject = {
	readonly id: string;
	readonly label: string;
	readonly reference: SemanticReference;
	readonly worldPoint: Vec3;
};

export type StageHitCandidate = {
	readonly evaluationId: string;
	readonly css: readonly [number, number];
};

export type StageToolQuery = { readonly kind: string; readonly scope: 'domain' | 'host' };
export type StagePickQuery = StageHitCandidate & {
	readonly purpose: 'select' | 'hover' | 'tool';
	readonly tool: StageToolQuery | null;
	/** Pointer class for the mark tier; default fine (22 px areas). */
	readonly coarse?: boolean;
};
export type StageDomainPick = {
	readonly hit: StageSourceHit;
	readonly refusal: string | null;
	readonly depthMeters: number | null;
	readonly planLayer: number | null;
	readonly cssDistance: number;
};

export type StageSourceHit = {
	readonly reference: SemanticReference;
	readonly sourceId: string;
	readonly sourceKind: 'entity';
	readonly worldPoint: Vec3;
} | {
	readonly reference?: undefined;
	readonly sourceId: string;
	readonly sourceKind: PlanSourceKind;
	readonly generationId: string;
	readonly stream: PlanStream;
	readonly subRef: PlanSubRef | null;
	readonly worldPoint: Vec3;
};

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

/**
 * A binding's answer to the Eraser for one of its own subjects: its existing Card
 * delete action (with the planner-derived disclosure it already shows), or a
 * refusal in the domain's words. The Eraser adds no rule and no planner.
 */
export type StageEraseAnswer =
	| {
			readonly kind: 'action';
			readonly action: StageCardAction;
			/**
			 * The domain asks for its disclosure to be read first (a Wall whose removal
			 * changes Rooms or hosted Openings): the Eraser shows `action.detail` at the
			 * pointer and runs on a second click of the same subject.
			 */
			readonly confirm: boolean;
	  }
	| { readonly kind: 'refused'; readonly message: string };

export type StageOverlayContribution = {
	readonly id: string;
	/**
	 * CSS pixels relative to the **Stage surface**, the space the overlay layer
	 * paints in and the same space `StagePointerIntent.css` uses. An adapter
	 * projects through the Camera's viewport CSS, and this boundary translates
	 * once, so a marker can never be painted at the surface offset.
	 */
	readonly css: readonly [number, number];
	readonly label: string;
};

/**
 * One candidate the creator is currently proposing, before acceptance.
 *
 * Domain contribution, in world coordinates. The Stage projects every point
 * once through the same `ViewportEvaluation` as the drawing, so a preview can
 * never disagree with the geometry release commits.
 */
export type StageCandidatePreview = {
	readonly id: string;
	readonly role: 'subject' | 'affected' | 'refused';
	readonly polygons: readonly (readonly Vec3[])[];
	readonly segments: readonly (readonly [Vec3, Vec3])[];
	readonly labels: readonly { readonly world: Vec3; readonly text: string }[];
	readonly snap?: { readonly world: Vec3; readonly name: string };
};

/** The world AABB of a candidate's drawn geometry, or `null` when it draws none. */
function candidateBounds(candidate: StageCandidatePreview): { readonly min: Vec3; readonly max: Vec3 } | null {
	const points = [
		...candidate.polygons.flat(),
		...candidate.segments.flatMap(([from, to]) => [from, to])
	];
	if (points.length === 0) return null;
	const min: [number, number, number] = [Infinity, Infinity, Infinity];
	const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
	for (const point of points) {
		if (!point.every(Number.isFinite)) return null;
		min[0] = Math.min(min[0], point[0]);
		min[1] = Math.min(min[1], point[1]);
		min[2] = Math.min(min[2], point[2]);
		max[0] = Math.max(max[0], point[0]);
		max[1] = Math.max(max[1], point[1]);
		max[2] = Math.max(max[2], point[2]);
	}
	return { min, max };
}

/** One candidate after the facade's single projection into Stage CSS space. */
export type StageCandidatePreviewView = {
	readonly id: string;
	readonly role: StageCandidatePreview['role'];
	readonly polygons: readonly (readonly (readonly [number, number])[])[];
	readonly segments: readonly (readonly [readonly [number, number], readonly [number, number]])[];
	readonly labels: readonly { readonly css: readonly [number, number]; readonly text: string }[];
	readonly snap?: { readonly css: readonly [number, number]; readonly name: string };
	/**
	 * The candidate's world extent, for Paper's bounded sheet. `null` when the
	 * candidate draws no geometry.
	 */
	readonly bounds: { readonly min: Vec3; readonly max: Vec3 } | null;
};

export type StageWorldGraphic = {
	readonly id: string;
	readonly kind: string;
	readonly world: Vec3;
};

/**
 * One candidate mesh the Stage draws in the shared Canvas at a proposed pose.
 *
 * It carries a pose and an extent, never a geometry or material: the one Canvas
 * owns rendering, so an adapter's preview cannot become a second renderer.
 */
export type StageGhostMesh = {
	readonly id: string;
	readonly center: Vec3;
	readonly yaw: number;
	readonly shape:
		| { readonly kind: 'box'; readonly size: Vec3 }
		| { readonly kind: 'cylinder'; readonly radius: number; readonly height: number }
		| { readonly kind: 'sphere'; readonly radius: number }
		/** A native form's own evaluated body: the same source the planner will install. */
		| { readonly kind: 'form'; readonly form: SceneFormSource };
};

/**
 * One pointer phase a contributed task may claim before the host's own
 * navigation gesture takes the press.
 *
 * The host asks the bindings only while a contributed task is open, and only the
 * binding that claimed the down phase receives the following move/up/cancel
 * phases. Coordinates are CSS pixels relative to the Stage surface, the same
 * space `StageHitCandidate.css` uses.
 */
export type StagePointerIntent = {
	readonly phase: 'down' | 'move' | 'up' | 'cancel';
	readonly css: readonly [number, number];
	readonly evaluationId: string;
	/** Modifier state at the press; a drag may use it for a second mode (yaw). */
	readonly shift?: boolean;
	/** The admitted mark the press started on, when the host resolved one. */
	readonly handleId?: string;
	/** Pointer class, so a coarse press uses the 44 px hit area. */
	readonly coarse?: boolean;
};

/**
 * One **command key** the host offers to the binding that owns the open task.
 *
 * `finish` and `backtrack` are the live proposal's own commands (`Enter` and
 * `Backspace`); `cancel` is the palette-first `Escape`, and it means the same
 * thing the palette's Cancel control does. The host never interprets them for the
 * adapter: a task that answers `false` simply leaves the key to the host's
 * unwinding.
 */
export type StageKeyboardIntent =
	| { readonly kind: 'finish' | 'backtrack' | 'cancel' }
	/** One printable keystroke while a gesture owns the pointer (numeric entry). */
	| { readonly kind: 'type'; readonly key: string };

/**
 * One **Ink reading** a domain offers to the one Pen (decision D5).
 *
 * Ink stays one tool with one palette and one stroke buffer. A reading is a
 * session a contributing domain owns: it receives the pointer and command keys
 * the open Ink task already receives, answers with its own overlays and ghosts,
 * and publishes its own palette view. The host contribution owns no document
 * state, no selection, no history and no writer — an accepted result still
 * travels through the owning domain's planner and F4, exactly as it does for
 * the built-in Wall reading.
 *
 * `view` is editor-only UI rendered inside the Ink palette while this reading is
 * active, so a domain brings its own controls without editing the shell. The
 * palette reads the reading's published surface; the view receives no Stage
 * internals.
 */
export type StageInkReadingSession = {
	/** Claim a pointer phase for this reading. `false` leaves the press to the host. */
	pointer(intent: StagePointerIntent, context: StageAdapterContext): boolean;
	/** An unpressed move while this reading is armed. Preview only; never claimed. */
	hover?(intent: StagePointerIntent, context: StageAdapterContext): boolean;
	/** Answer a Stage command key while this reading is armed. */
	key?(intent: StageKeyboardIntent, context: StageAdapterContext): boolean;
	/** Whether the reading holds uncommitted input that a switch would discard. */
	hasWork?(): boolean;
	/** End the live reading with no commit. Run on cancel, task close and dispose. */
	cancel(): void;
	taskClosed?(): void;
	overlay?(context: StageAdapterContext): readonly StageOverlayContribution[];
	ghosts?(context: StageAdapterContext): readonly StageGhostMesh[];
};

export type StageInkReading = {
	readonly id: string;
	readonly label: string;
	readonly summary: string;
	/** Explicit deterministic order after the built-in readings; ties break by adapter ID. */
	readonly order?: number;
	/** Open one reading session. The contributing binding owns everything it reads. */
	begin(): StageInkReadingSession;
	/** Editor-only palette controls for this reading, rendered in the Ink palette. */
	readonly view?: Component;
};

/** A contributed reading as the host publishes it, stamped with its owning adapter. */
export type StageInkReadingRecord = {
	readonly id: string;
	readonly label: string;
	readonly summary: string;
	readonly order: number;
	readonly adapterId: string;
	readonly view?: Component;
};

/**
 * The symbol key of the install-time mutation control.
 *
 * A conformance test uses it to run the real install with adapter re-binding
 * suppressed, proving the rebind/disposal assertions are load-bearing. It is a
 * symbol, not a string option, so no ordinary caller — and no serialized option
 * object — can switch it on by accident.
 */
export const SKIP_REBIND_CONTROL: unique symbol = Symbol('stage-skip-rebind-control');

export type StageAdapterContext = {
	readonly snapshot: StageReadSnapshot;
	readonly evaluation: ViewportEvaluation;
	readonly evaluationId: string;
	project(point: Vec3): readonly [number, number] | null;
	ray(css: readonly [number, number]): PointerRay | null;
	pickScene(ray: PointerRay): SceneRenderedHit | null;
	sceneBounds(id: string): { readonly min: Vec3; readonly max: Vec3 } | null;
	intersect(ray: PointerRay, plane: WorkingPlane): WorkingPlaneHit;
	selection(): StageSelection | null;
	selectionState(): StageSelectionState;
	setSelection(value: StageSelectionState): StageSelectionChange;
	select(selection: StageSelection | null): void;
	/** The one Grid/Snap view state, read live and never written by an adapter. */
	drafting(): StageDraftingState;
	requestIntent(intent: ViewingIntent, clockSeconds: number): StageIntentResult;
};

/** One task/instrument contribution an adapter offers for its own subjects. */
export type StageTaskContribution = {
	readonly id: string;
	/** The registered task kind the instrument host renders. */
	readonly taskKind: string;
	readonly label: string;
	readonly targetRef?: PlanSourceRef | null;
	readonly target?: SemanticReference | null;
	readonly configuration?: F4JsonValue;
	readonly lens?: StageLens;
	/** Called for explicit Resume against current content, never at lens return. */
	readonly revalidate?: (task: StageTask, snapshot: StageReadSnapshot) => TaskResumeOutcome;
	/** Explicit deterministic order; ties break by adapter ID, then contribution ID. */
	readonly order?: number;
};

/** A task contribution as the host publishes it, stamped with its owning adapter. */
export type StageTaskEntry = StageTaskContribution & {
	readonly adapterId: string;
	readonly order: number;
};

/**
 * Where a contributed operation lives: the bottom **dock** (an armable tool), or
 * Find (the default).
 *
 * Additive with a default: a contribution that names no home is a Find entry,
 * exactly as before this field existed, so no existing adapter has to change.
 */
export type StageEntryHome = 'dock' | 'find';

/** One PLATE rail-family / capability-Find entry that invokes this adapter's task. */
export type StageFindEntry = {
	readonly id: string;
	/** The PLATE rail family this entry belongs to. */
	readonly railFamily: string;
	/** The capability-Find key the entry appears under. */
	readonly capability: string;
	readonly label: string;
	/** The contributed task this entry invokes. */
	readonly taskKind: string;
	/** `dock` arms the tool from the bottom dock; `find` (default) invokes it. */
	readonly home?: StageEntryHome;
	/**
	 * R217.S10 — the fixed dock key a `dock` entry fills (`ink`, `library`). The
	 * dock's order, icon and shortcut belong to the slot; an entry with no slot is
	 * an extra key after the Eraser.
	 */
	readonly slot?: 'ink' | 'library';
	readonly order?: number;
};

/** A Find entry as the host publishes it, stamped with its owning adapter. */
export type StageFindEntryRecord = StageFindEntry & {
	readonly adapterId: string;
	readonly order: number;
};

/** One Card fact for a subject the adapter owns. */
export type StageCardFact = { readonly label: string; readonly value: string };

/** The Card's subject identity, supplied by the host (never private Stage state). */
export type StageCardSubject = {
	readonly sourceId: string;
	readonly sourceKind: string;
	readonly reference?: SemanticReference;
	readonly ref: PlanSourceRef | null;
};

/** A Card fact as the host publishes it, stamped with its owning adapter. */
export type StageCardFactRecord = StageCardFact & { readonly adapterId: string };

/**
 * The one writable Card fact: the subject's name, delegated to its owning domain
 * planner through the adapter that owns it.
 *
 * The Card renders the value and the host routes the command; it never builds an
 * intent itself, so the single name writer stays in the domain that already owns
 * canonical metadata planning.
 */
export type StageCardNameWrite =
	| { readonly kind: 'accepted' }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string };

export type StageCardNameTarget = {
	readonly value: string;
	commit(name: string): Promise<StageCardNameWrite>;
};

/** A Card name writer as the host publishes it, stamped with its owning adapter. */
export type StageCardNameWriterRecord = StageCardNameTarget & { readonly adapterId: string };

/**
 * One action the Card offers for the selected subject.
 *
 * The adapter owns the writer: the Card renders the label and its disclosed
 * consequence, calls `run()`, and shows the returned words. The host never builds
 * the intent, and the action never reaches the source directly.
 */
export type StageCardActionOutcome = {
	readonly kind: 'accepted' | 'no-op' | 'refused';
	readonly message?: string;
};

export type StageCardAction = {
	readonly id: string;
	readonly label: string;
	/**
	 * Words the creator reads **before** the action is taken: the planner-derived
	 * consequences (hosted Openings, Room merge/open). Required for a destructive
	 * action, and never a second opinion — the adapter derives it from the same
	 * planner call acceptance runs.
	 */
	readonly detail?: string;
	/** A destructive action states so, and the Card confirms before running it. */
	readonly destructive?: boolean;
	run(): Promise<StageCardActionOutcome>;
};

/** A Card action as the host publishes it, stamped with its owning adapter. */
export type StageCardActionRecord = StageCardAction & { readonly adapterId: string };

/**
 * The Card's contributed **writer** for one subject: the fields that used to be
 * the Dimensions instrument's, now rendered where PLATE puts them.
 */
export type StageCardWriterRecord = StageInstrumentContent & { readonly adapterId: string };

/**
 * What an adapter's instrument contribution shows for one invoked task.
 *
 * The host mounts it in the one `StageInstrumentHost`; the adapter supplies the
 * content, so a domain adapter never edits shell or route modules to bring its own
 * instrument to the Stage.
 */
export type StageInstrumentContent = {
	readonly summary: string;
	readonly facts?: readonly StageCardFact[];
	/** Editor-only UI; never serialized or imported by visitor surfaces. */
	readonly view?: { readonly component: Component<{ services: StageAdapterServices }>; readonly services: StageAdapterServices };
};

/** The binding context: the live read access plus the adapter's own identity. */
export type StageAdapterBindingContext = StageAdapterContext & { readonly adapterId: string };

/**
 * What one adapter contributes for one accepted snapshot.
 *
 * The host rebuilds this binding for every accepted source and disposes the
 * previous one exactly once, so a domain adapter keeps its registration across
 * live editing without ever reading a snapshot it was not built from.
 */
export type StageAdapterBinding = {
	/**
	 * This binding's manipulation marks for the primary selection.
	 *
	 * The host asks only the binding that owns the primary selection, and only
	 * while no contributed task is open. It admits the descriptors against the
	 * adapter's registered planners, owns disclosure state and draws/hit-tests the
	 * marks; the domain keeps every fact, planner and refusal.
	 */
	readonly handles?: (context: StageAdapterContext) => readonly StageHandleDescriptor[];
	/**
	 * The heights this binding's own surfaces offer to the Height Sheet.
	 *
	 * Additive and optional: a binding that declares nothing contributes no tick,
	 * and the host computes no surface itself. The Sheet merges and sorts the
	 * declarations; a throwing contributor contributes none.
	 */
	readonly heightTicks?: (context: StageAdapterContext) => readonly StageHeightTick[];
	readonly overlay?: (context: StageAdapterContext) => readonly StageOverlayContribution[];
	/**
	 * R217.S14 — the candidate geometry this binding proposes right now.
	 *
	 * Additive and optional. World coordinates only: the facade projects them
	 * once and the Stage overlay paints them, so no adapter owns a second
	 * projection or a second renderer. Nothing here is persisted.
	 */
	readonly candidatePreview?: (context: StageAdapterContext) => readonly StageCandidatePreview[];
	readonly graphics?: (context: StageAdapterContext) => readonly StageWorldGraphic[];
	/** Proposed-pose meshes the shared Canvas draws; empty when nothing is proposed. */
	readonly ghosts?: (context: StageAdapterContext) => readonly StageGhostMesh[];
	readonly pick?: (query: StagePickQuery, context: StageAdapterContext) => StageDomainPick | null;
	readonly hostTools?: readonly string[];
	/**
	 * R217.S10 — the Eraser's one question to the winning domain: which existing
	 * delete action removes this subject, or why it cannot be erased. Additive and
	 * optional; a binding that declares `erase` but answers `null` erases nothing.
	 */
	readonly eraseAction?: (hit: StageSourceHit) => StageEraseAnswer | null;
	/**
	 * Claim a press for this adapter's open task. Returning `true` on `down` takes
	 * the press from the host's navigation gesture; the same binding then receives
	 * `move`, `up` and `cancel`. A binding that returns `false` never sees the rest.
	 */
	readonly pointerIntent?: (intent: StagePointerIntent, context: StageAdapterContext) => boolean;
	/**
	 * An unpressed move while this adapter's task is open. It is a preview only:
	 * the move is never claimed, so Stage navigation and the next press stay with
	 * the host. Adapters that do not declare it never see unpressed moves.
	 */
	readonly hoverIntent?: (intent: StagePointerIntent, context: StageAdapterContext) => boolean;
	/**
	 * Answer a Stage **command key** while this binding's task is open.
	 *
	 * The mirror of `pointerIntent` for the keyboard: the shell owns the map and
	 * the adapter owns what a command means for its own live work. A binding that
	 * returns `false` (or does not declare it) leaves the key to the host's own
	 * unwinding, so an unhandled Escape still closes the task.
	 */
	readonly keyIntent?: (intent: StageKeyboardIntent, context: StageAdapterContext) => boolean;
	/**
	 * The host closed the contributed task (Esc, task replacement, or install),
	 * or a task opened over this binding's no-task direct manipulation.
	 */
	readonly taskClosed?: () => void;
	readonly selectionChanged?: (selection: StageSelectionState) => void;
	readonly selectionEcho?: (selection: StageSelection | null) => void;
	readonly tasks?: readonly StageTaskContribution[];
	/** Ink readings this binding offers to the one Pen, alongside the built-ins. */
	readonly readings?: readonly StageInkReading[];
	readonly subjects?: readonly StageSubject[];
	readonly cardFacts?: (subject: StageCardSubject) => readonly StageCardFact[];
	/**
	 * The subject's ordinary-field writer for the Card, or `null` when this adapter
	 * contributes none. Additive with a default: a binding that does not declare it
	 * contributes no Card fields, exactly as before.
	 */
	readonly cardWriter?: (subject: StageCardSubject) => StageInstrumentContent | null;
	/** The subject's scoped Card actions (a delete and its disclosure). */
	readonly cardActions?: (subject: StageCardSubject) => readonly StageCardAction[];
	/** The subject's name writer, or `null` when this adapter does not own one. */
	readonly cardName?: (subject: StageCardSubject) => StageCardNameTarget | null;
	/**
	 * Whether this binding offers a pointer press **while no contributed task is
	 * open** (direct manipulation of the current selection).
	 *
	 * Additive and off by default: an adapter that does not declare it is only
	 * asked for a press through its own open task, exactly as before. When no task
	 * is open the host asks the declaring bindings in deterministic (registration)
	 * order and the first claim wins.
	 */
	readonly pressWhenNoTask?: boolean;
	readonly findEntries?: readonly StageFindEntry[];
	/** The instrument this adapter's invoked task shows, or `null` for none. */
	readonly instrument?: (task: {
		readonly kind: string;
		readonly targetRef: PlanSourceRef | null;
	}) => StageInstrumentContent | null;
	/** Ends this binding (listeners, buffers, callbacks). Run exactly once. */
	readonly dispose?: () => void;
};

export type StageAdapter = StageAdapterBinding & {
	readonly id: string;
	/** Capabilities this adapter requires the host to provide. Unknown ones refuse mounting. */
	readonly requiredCapabilities?: readonly string[];
	/**
	 * The intent kinds this adapter's factory registered as its domain planners.
	 *
	 * Handle admission refuses an editing grip that names a planner outside this
	 * set, so a mark cannot promise an operation the domain never registered. It is
	 * host-facing data, not a second planner registry: the coordinator remains the
	 * one authority that accepts an intent.
	 */
	readonly plannerKinds?: readonly string[];
	/**
	 * Host-owned re-binding: built for each accepted snapshot and disposed exactly
	 * once when the next binding replaces it. An adapter without a factory keeps
	 * its static binding for the whole mount.
	 *
	 * When `bind` is present the binding it returns is the adapter's **only**
	 * contribution: top-level `overlay`/`graphics`/`tasks`/`cardFacts`/
	 * `findEntries`/`instrument` on this object are ignored, because a factory
	 * exists precisely so that none of them can outlive the source they read.
	 */
	readonly bind?: (context: StageAdapterBindingContext) => StageAdapterBinding;
};

export type StageAdapterRegistration =
	| { readonly kind: 'registered'; readonly id: string; dispose(): void }
	| {
			readonly kind: 'refused';
			readonly code: 'unknown-required-capability' | 'duplicate-adapter';
			readonly missing: readonly string[];
			readonly message: string;
	  };

/**
 * The intent result is the seam's vocabulary: `accepted`, `rejected` and
 * `superseded`. `superseded` is the ownership answer — the run presenting the
 * ticket no longer holds the inspection output — and is deliberately distinct from
 * a domain rejection.
 */
export type StageIntentResult =
	| ViewingIntentResult
	| {
			readonly kind: 'superseded';
			readonly state: ViewportCameraState;
			readonly message: string;
			/** The protocol's own refusal, when it was a refusal rather than a spent claim. */
			readonly reason?: CameraOutputRefusal;
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
	/** Admitted marks for the primary selection, in descriptor order, projected. */
	marks(): readonly StageMarkView[];
	/** The mark under a Stage-local CSS point, or `null`. */
	hitMark(query: { readonly css: readonly [number, number]; readonly coarse: boolean }): StageMarkHit | null;
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

function tokenOf(evaluation: ViewportEvaluation): ViewportEvaluationToken {
	return evaluation.token;
}

/** The working plane the Plan hit path intersects: the level datum, unbounded. */
export function datumWorkingPlane(datumMeters: number): WorkingPlane {
	return {
		originMeters: [0, datumMeters, 0],
		normal: [0, 1, 0],
		yawRadians: 0,
		datumMeters,
		supportedLocalExtent: null
	};
}

export function createStageFacade(input: {
	readonly snapshot: StageReadSnapshot;
	readonly session: StageSession;
	readonly viewportId?: string;
	readonly outputId?: string;
	readonly scenePick?: (ray: PointerRay, scene: StageReadSnapshot['domain']['scene']) => SceneRenderedHit | null;
	readonly sceneBounds?: (id: string, scene: StageReadSnapshot['domain']['scene']) => { readonly min: Vec3; readonly max: Vec3 } | null;
}): StageFacade {
	const { session } = input;
	let currentSnapshot = input.snapshot;
	const camera = createCameraSession({
		snapshot: currentSnapshot,
		viewportId: input.viewportId ?? 'stage',
		// The output identity is unique per *replacement lifetime*, not per epoch string:
		// a host that re-admitted under the same session epoch still gets a fresh output,
		// so a retained ticket from the previous project cannot qualify against it.
		outputId: input.outputId ?? `output:${currentSnapshot.sessionEpoch}:${session.token().epoch}`
	});
	/** Live listeners for the contribution surface; see `onAdaptersChanged`. */
	const adapterListeners = new Set<() => void>();
	let adaptersChangeQueued = false;
	function notifyAdaptersChanged(): void {
		for (const listener of [...adapterListeners]) {
			try {
				listener();
			} catch {
				// A listener that throws must not strand the rest or the facade.
			}
		}
	}
	/** Coalesce rebuild notifications out of the read path that discovered them. */
	function scheduleAdaptersChanged(): void {
		if (adaptersChangeQueued) return;
		adaptersChangeQueued = true;
		queueMicrotask(() => {
			adaptersChangeQueued = false;
			notifyAdaptersChanged();
		});
	}
	/**
	 * Registration id → the adapter, its current binding and the disposer that ends
	 * that binding exactly once. A factory-bound adapter is rebuilt per accepted
	 * snapshot; a static one keeps one binding for the mount.
	 */
	const adapters = new Map<
		string,
		{
			adapter: StageAdapter;
			contributions: StageAdapterBinding;
			/** `true` when the adapter builds a binding per accepted snapshot. */
			factory: boolean;
			/** A factory binding waiting for the next live evaluation. */
			pending: boolean;
			dispose: () => void;
		}
	>();
	/** The host's own inspection run order, minted strictly newer than every accepted epoch. */
	let inspectionRun = 0;
	const lifetimeToken = session.token();
	let disposed = false;
	const isLive = () => !disposed && session.isCurrent(lifetimeToken);
	let contributedTaskOwner: { adapterId: string; taskId: string } | null = null;
	/** The adapter that claimed the live press, if any. Cleared on up/cancel/close. */
	let pointerOwner: string | null = null;
	/** Which mark the pointer is over; view state only. */
	let markHover: { readonly adapterId: string; readonly id: string } | null = null;
	/** The mark a live press started on, for gold emphasis and live tags. */
	let activeMarkId: string | null = null;
	/** Open disclosure ids for the current primary selection. */
	const openDisclosures = new Set<string>();
	/** The selection the disclosure set belongs to; a change closes every one. */
	let disclosureSelection: SemanticReference | null = null;
	const handleDiagnostics: StageHandleDiagnostic[] = [];
	const reportedHandleDiagnostics = new Set<string>();

	/** A selection change closes disclosure; a 2D ↔ 3D flip deliberately does not. */
	function syncDisclosureSelection(): void {
		const entry = primaryEntry(session.selectionState());
		const next = entry?.reference ?? null;
		// The full canonical address is the identity: a same-id subject at another
		// instance path or revision is a different selection and closes the set.
		if (next === null ? disclosureSelection === null : disclosureSelection !== null && sameReference(next, disclosureSelection)) return;
		disclosureSelection = next;
		openDisclosures.clear();
		markHover = null;
		activeMarkId = null;
	}

	/**
	 * The next host inspection run epoch. It is monotonic over this output's whole
	 * session, including across a source rebase (which keeps the epoch floor), so a
	 * re-acquisition can never re-enter with a spent epoch.
	 */
	function nextInspectionRun(): number {
		inspectionRun = Math.max(inspectionRun + 1, camera.output().epochFloor + 1);
		return inspectionRun;
	}

	function currentToken(): ViewportEvaluationToken | null {
		const evaluation = camera.evaluation();
		return evaluation === null ? null : tokenOf(evaluation);
	}

	/** The host's live Plan parameters: calibration defaults plus what the host set. */
	let planOverrides: PlanParameterOverrides = {};
	/** The Sheet's role registration; one per facade lifetime, released on dispose. */
	let planCutUnsubscribe: (() => void) | null = null;

	/**
	 * The retained Plan evaluation, with the exact inputs it was produced from.
	 *
	 * **Why retention is exact.** An evaluation's only target-dependent output is
	 * its echoed `target` unless the lateral span is bounded
	 * (`planDependsOnTarget`), and the shipped provider default is explicit
	 * unbounded coverage. So a moving inspection target — every pan frame — names
	 * the same fragments, the same membership, the same streams and the same
	 * bounds. Re-deriving them is work proportional to the project for a change
	 * that is provably worth none of it.
	 *
	 * The retained evaluation reports the **live** target through
	 * `planTargetsLiveView`, so the field is never stale while the object identity
	 * stays fixed: nothing downstream re-derives on a pan either.
	 *
	 * A non-finite target is never served from here. The parameter boundary refuses
	 * it, and a cache that answered "evaluated" for a target no evaluation could
	 * accept would be a correctness bug dressed as an optimisation.
	 */
	let retainedPlan: { readonly key: string; readonly result: PlanEvaluationResult } | null = null;

	/**
	 * The Plan evaluator, kept across accepted edits.
	 *
	 * The key above answers "is this the same evaluation?". This answers the harder
	 * question a new generation asks: "which sources did the edit actually change?".
	 * An accepted Wall move changes the compile generation, and therefore every
	 * fragment's `ref`, so the fragment array is necessarily rebuilt — but the
	 * *derivation* behind each source (its placement, stream and membership row) is
	 * unchanged for every source the edit did not touch. The retainer keeps those and
	 * is handed only the work that is new, so a commit no longer re-sorts, re-measures
	 * and re-groups the whole project to place one Wall.
	 *
	 * It is one retainer for the facade's lifetime, not one per evaluation: its value
	 * is exactly what it remembers between them.
	 */
	const planRetainer = createPlanRetainer();

	function liveTarget(): LayoutVec2 {
		const target = camera.state().pose.target;
		return [target[0], target[2]];
	}

	/**
	 * Everything an evaluation reads, in one string. `target` appears only when the
	 * parameters or the target itself make it an input.
	 *
	 * Lists are JSON-encoded only when non-empty, so the ordinary frame (no filter,
	 * no reveal) does no serialization at all — and a non-empty list cannot be made
	 * ambiguous by a source id containing the separator.
	 */
	function planRetentionKey(parameters: PlanParameters, target: LayoutVec2, targetMatters: boolean): string {
		const span =
			parameters.lateralSpanHalfWidthMeters === null ? 'u' : `b${parameters.lateralSpanHalfWidthMeters}`;
		const filter =
			parameters.sourceKindFilter === null ? '' : `f${JSON.stringify(parameters.sourceKindFilter)}`;
		const reveal = parameters.reveal.length === 0 ? '' : `r${JSON.stringify(parameters.reveal)}`;
		return [
			currentSnapshot.compileGeneration,
			currentSnapshot.domain.datumMeters,
			parameters.cutHeightMeters,
			parameters.depthMeters,
			span,
			filter,
			reveal,
			targetMatters ? `t${target[0]}:${target[1]}` : ''
		].join('|');
	}

	/** The effective Plan parameters, as the retention key sees them. */
	function effectivePlanContext(): { parameters: PlanParameters; target: LayoutVec2; finiteTarget: boolean } {
		const parameters = planParameters(planOverrides);
		const target = liveTarget();
		return { parameters, target, finiteTarget: Number.isFinite(target[0]) && Number.isFinite(target[1]) };
	}

	function planFor(overrides?: PlanParameterOverrides): PlanEvaluationResult {
		const parameters = planParameters(overrides ?? planOverrides);
		const target = liveTarget();
		const finiteTarget = Number.isFinite(target[0]) && Number.isFinite(target[1]);
		const targetMatters = planDependsOnTarget(parameters) || !finiteTarget;
		if (finiteTarget) {
			const key = planRetentionKey(parameters, target, targetMatters);
			if (retainedPlan !== null && retainedPlan.key === key) return retainedPlan.result;
			const result = planRetainer.evaluate(currentSnapshot.domain.geometry, parameters, {
				generationId: currentSnapshot.compileGeneration,
				target,
				datumMeters: currentSnapshot.domain.datumMeters
			});
			const retained: PlanEvaluationResult =
				result.kind === 'evaluated' && !targetMatters
					? { kind: 'evaluated', plan: planTargetsLiveView(result.plan, liveTarget) }
					: result;
			retainedPlan = { key, result: retained };
			return retained;
		}
		// A non-finite target is the parameter boundary's refusal to make, not a
		// cache hit's; it is never retained.
		return planRetainer.evaluate(currentSnapshot.domain.geometry, parameters, {
			generationId: currentSnapshot.compileGeneration,
			target,
			datumMeters: currentSnapshot.domain.datumMeters
		});
	}


	/**
	 * One adapter context plus the handle that ends it.
	 *
	 * A context is bounded by **its binding**, not by the session's writer
	 * generation: opening or closing a task must not invalidate an adapter's
	 * selection capability, because the binding is still built from live content and
	 * the adapter is still registered. `end()` is what makes a rebuilt, replaced or
	 * disposed binding's old callbacks inert — the same lifetime the disposer already
	 * ends. Task-scoped callbacks are the ones that expire with a writer generation,
	 * and the instrument services guard them with it separately.
	 */
	type AdapterContextHandle = { readonly context: StageAdapterContext; end(): void };

	function adapterContext(): AdapterContextHandle | null {
		const evaluation = camera.evaluation();
		if (!isLive() || evaluation === null) return null;
		const boundSnapshot = currentSnapshot;
		let ended = false;
		const contextIsLive = () => !ended && isLive() && currentSnapshot === boundSnapshot;
		const token = tokenOf(evaluation);
		const id = evaluationIdOf(evaluation);
		const hasLiveEvaluation = () => contextIsLive() && camera.evaluationId() === id;
		const context: StageAdapterContext = {
			snapshot: currentSnapshot,
			evaluation,
			evaluationId: id,
			project(point) {
				if (!hasLiveEvaluation()) return null;
				const result = projectWorld(point, evaluation, token);
				return result.kind === 'projected' ? result.css : null;
			},
			ray(css) {
				if (!hasLiveEvaluation()) return null;
				const result = pointerRay(css, evaluation, token);
				return result.kind === 'ray' ? result.ray : null;
			},
			intersect(ray, plane) {
				if (!hasLiveEvaluation()) return { kind: 'failed', code: 'stale-evaluation', message: 'the adapter evaluation has ended' };
				return intersectWorkingPlane(ray, plane, evaluation, token);
			},
			pickScene: (ray) => hasLiveEvaluation() ? input.scenePick?.(ray, currentSnapshot.domain.scene) ?? null : null,
			sceneBounds: (id) => hasLiveEvaluation() ? input.sceneBounds?.(id, currentSnapshot.domain.scene) ?? null : null,
			selection: () => contextIsLive() ? session.selection() : null,
			selectionState: () => contextIsLive() ? session.selectionState() : EMPTY_SELECTION,
			setSelection: (value) => contextIsLive() ? setSelection(value) : { kind: 'refused', code: 'stale-binding', message: 'Reacquire the active adapter binding.' },
			select: (selection) => { if (contextIsLive()) select(selection); },
			// View state is still a session fact: an ended binding must not keep
			// reading the live session's Grid/Snap after its adapter is gone.
			drafting: () => (contextIsLive() ? session.drafting() : STAGE_DRAFTING_DEFAULTS),
			// The adapter names the clock: an adapter-initiated transition starts at
			// the caller's own time, never at a fabricated zero that would make every
			// transition begin in the past and land instantly.
			requestIntent: (intent, clockSeconds) =>
				contextIsLive() ? facade.requestViewingIntent(intent, camera.inspectionTicket(), clockSeconds)
				: { kind: 'superseded', state: camera.state(), message: 'the adapter binding lifetime has ended' }
		};
		return { context, end: () => { ended = true; } };
	}

	function select(selection: StageSelection | null): void {
		if (!isLive()) return;
		session.select(selection);
		syncDisclosureSelection();
		echoSelection();
		notifyAdaptersChanged();
	}

	function echoSelection(): void {
		for (const entry of adapters.values()) {
			try { entry.contributions.selectionEcho?.(session.selection()); entry.contributions.selectionChanged?.(session.selectionState()); } catch { /* Subscriber isolation. */ }
		}
	}
	function setSelection(value: StageSelectionState): StageSelectionChange {
		if (!isLive()) return { kind: 'refused', code: 'stale-session', message: 'This Stage lifetime has ended.' };
		const result = session.setSelection(value);
		if (result.kind === 'selected') { syncDisclosureSelection(); echoSelection(); notifyAdaptersChanged(); }
		return result;
	}

	/** Tell every binding its contributed task is gone, exactly once per close. */
	function notifyTaskClosed(): void {
		pointerOwner = null;
		// An accepted install closes the contributed task through the session, not
		// through `closeTask()`; the owner record must end with it, or the host
		// keeps offering presses and keys to a task that no longer exists and
		// never reaches a binding's no-task direct manipulation.
		contributedTaskOwner = null;
		for (const entry of adapters.values()) {
			try { entry.contributions.taskClosed?.(); } catch { /* Subscriber isolation. */ }
		}
	}

	/**
	 * The primary selection's admitted marks, projected through the live viewport.
	 *
	 * Asked only of the binding whose domain owns the primary selection, and only
	 * while no contributed task is open. Admission refusals are recorded once each
	 * and the mark is not returned, so "not drawn" and "not hit-testable" are the
	 * same fact.
	 */
	function stageMarks(): readonly StageMarkView[] {
		if (!isLive()) return [];
		syncDisclosureSelection();
		if (session.task() !== null) return [];
		const entry = primaryEntry(session.selectionState());
		if (entry === null) return [];
		ensureBindings();
		const adapterEntry = adapters.get(entry.reference.domain);
		if (adapterEntry === undefined) return [];
		const handle = adapterContext();
		if (handle === null) return [];
		let descriptors: readonly StageHandleDescriptor[] = [];
		try {
			descriptors = adapterEntry.contributions.handles?.(handle.context) ?? [];
		} catch {
			descriptors = [];
		} finally {
			handle.end();
		}
		if (descriptors.length === 0) return [];
		const admission = admitStageHandles({
			adapterId: adapterEntry.adapter.id,
			descriptors,
			plannerKinds: adapterEntry.adapter.plannerKinds ?? [],
			alreadyReported: reportedHandleDiagnostics
		});
		for (const diagnostic of admission.diagnostics) {
			reportedHandleDiagnostics.add(`${diagnostic.adapterId}\u0000${diagnostic.handleId}\u0000${diagnostic.code}`);
			handleDiagnostics.push(diagnostic);
		}
		const evaluation = camera.evaluation();
		if (evaluation === null) return [];
		return projectStageHandles({
			adapterId: adapterEntry.adapter.id,
			descriptors: admission.admitted,
			openDisclosures,
			hoveredId: markHover?.adapterId === adapterEntry.adapter.id ? markHover.id : null,
			activeId: activeMarkId,
			project: (point) => {
				const projected = projectWorld(point, evaluation, tokenOf(evaluation));
				// A behind-camera point mirrors through the origin; a clipped or
				// outside-frame point would paint outside the Stage. Neither is a mark
				// the creator can see and press.
				return projected.kind === 'projected' && projected.visibility === 'visible'
					? projected.css
					: null;
			},
			offset: [evaluation.rect.left, evaluation.rect.top]
		});
	}

	/** End every binding and registration: used by dispose, never by a content change. */
	function endAdapters(): readonly string[] {
		const ids = [...adapters.keys()];
		for (const entry of [...adapters.values()]) entry.dispose();
		adapters.clear();
		return ids;
	}

	function once(dispose: () => void): () => void {
		let ended = false;
		return () => {
			if (ended) return;
			ended = true;
			try { dispose(); } catch { /* Cleanup must continue for the other bindings. */ }
		};
	}

	/**
	 * Build one factory binding for the current snapshot.
	 *
	 * A factory that throws yields an empty binding rather than taking the host
	 * down: the adapter stays registered (so its failure is visible and repairable)
	 * but contributes nothing until the next accepted snapshot rebuilds it. A
	 * factory needs a live viewport output, so a build with no evaluation defers to
	 * `ensureBindings` rather than projecting against a viewport that no longer
	 * exists.
	 */
	function buildBinding(adapter: StageAdapter):
		| { readonly kind: 'built'; readonly contributions: StageAdapterBinding; readonly dispose: () => void }
		| { readonly kind: 'deferred' } {
		const handle = adapterContext();
		if (adapter.bind === undefined || handle === null) return { kind: 'deferred' };
		const { context, end } = handle;
		let binding: StageAdapterBinding = {};
		try {
			binding = adapter.bind({ ...context, adapterId: adapter.id });
		} catch {
			binding = {};
		}
		// A freshly built binding starts from the live selection, delivered once.
		// The install requalified it before any rebuild, so the adapter observes the
		// surviving selection — never a cleared-then-restored pair.
		const live = session.selection();
		{
			try {
				if (live !== null) binding.selectionEcho?.(live);
				binding.selectionChanged?.(session.selectionState());
			} catch {
				// An echo that throws must not discard a binding that was built.
			}
		}
		return { kind: 'built', contributions: binding, dispose: once(() => { end(); binding.dispose?.(); }) };
	}

	/**
	 * Rebuild every pending factory binding once a live evaluation exists again.
	 *
	 * A source rebase ends the old evaluation, so a rebuild waits for the host's
	 * next frame instead of being built against a viewport that no longer exists.
	 * The pending flag is cleared before the build, so exactly one rebuild happens
	 * per accepted snapshot.
	 */
	function ensureBindings(): void {
		if (camera.evaluation() === null) return;
		let rebuilt = false;
		for (const [id, entry] of [...adapters.entries()]) {
			if (!entry.factory || !entry.pending) continue;
			const built = buildBinding(entry.adapter);
			if (built.kind === 'deferred') continue;
			adapters.set(id, {
				adapter: entry.adapter,
				contributions: built.contributions,
				factory: true,
				pending: false,
				dispose: built.dispose
			});
			rebuilt = true;
		}
		// A rebuild is discovered **inside a read** (`overlays()`, `tasks()`, …), and the
		// host reads those from derived values. Notifying synchronously here would let a
		// subscriber write reactive state while a derivation is being evaluated, which
		// Svelte refuses. The rebuild invalidates the contribution surface on a
		// microtask instead; register/dispose keep notifying synchronously because they
		// originate from events.
		if (rebuilt) scheduleAdaptersChanged();
	}

	/**
	 * Host-owned re-binding across installs.
	 *
	 * The previous binding is disposed **exactly once, at install time** — it was
	 * built from content that no longer exists — and the next one is built against
	 * the newly installed snapshot on the next live evaluation. Live editing
	 * therefore never tears a domain adapter's registration down. Adapters without a
	 * factory are static and are left alone; replacement still ends everything
	 * through `endAdapters`.
	 */
	function rebindAdapters(): readonly string[] {
		const rebound = [...adapters.entries()]
			.filter(([, entry]) => entry.factory)
			.map(([id]) => id);
		for (const id of rebound) {
			const entry = adapters.get(id)!;
			entry.dispose();
			adapters.set(id, {
				adapter: entry.adapter,
				contributions: {},
				factory: true,
				pending: true,
				dispose: () => {}
			});
		}
		if (rebound.length === 0) return rebound;
		ensureBindings();
		return rebound;
	}

	/** Deterministic order: explicit `order`, then owning adapter ID, then entry ID. */
	function compareEntries(
		a: { readonly adapterId: string; readonly order: number; readonly id: string },
		b: { readonly adapterId: string; readonly order: number; readonly id: string }
	): number {
		if (a.order !== b.order) return a.order - b.order;
		if (a.adapterId !== b.adapterId) return a.adapterId < b.adapterId ? -1 : 1;
		return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
	}

	function tasksOf(): readonly StageTaskEntry[] {
		return [...adapters.entries()]
			.flatMap(([adapterId, entry]) =>
				(entry.contributions.tasks ?? []).map((task) => ({
					...task,
					adapterId,
					order: task.order ?? 0
				}))
			)
			.sort(compareEntries);
	}

	function inkReadingsOf(): readonly StageInkReadingRecord[] {
		return [...adapters.entries()]
			.flatMap(([adapterId, entry]) =>
				(entry.contributions.readings ?? []).map((reading) => ({
					id: reading.id,
					label: reading.label,
					summary: reading.summary,
					order: reading.order ?? 0,
					adapterId,
					...(reading.view === undefined ? {} : { view: reading.view })
				}))
			)
			.sort(compareEntries);
	}

	function findEntriesOf(): readonly StageFindEntryRecord[] {
		return [...adapters.entries()]
			.flatMap(([adapterId, entry]) =>
				(entry.contributions.findEntries ?? []).map((findEntry) => ({
					...findEntry,
					adapterId,
					order: findEntry.order ?? 0
				}))
			)
			.sort(compareEntries);
	}

	const facade: StageFacade = {
		snapshot: () => currentSnapshot,
		session,
		camera,
		evaluation: () => camera.evaluation(),
		evaluationId: () => camera.evaluationId(),
		sceneBounds: (id) => input.sceneBounds?.(id, currentSnapshot.domain.scene) ?? null,
		projectWorld(point, evaluationId) {
			const evaluation = camera.evaluation();
			if (evaluation === null || evaluationIdOf(evaluation) !== evaluationId) {
				return {
					kind: 'failed',
					code: 'stale-evaluation',
					message: 'the supplied evaluation id is not the current viewport output'
				};
			}
			return projectWorld(point, evaluation, tokenOf(evaluation));
		},
		pointerRay(cssPoint, evaluationId) {
			const evaluation = camera.evaluation();
			if (evaluation === null || evaluationIdOf(evaluation) !== evaluationId) {
				return {
					kind: 'failed',
					code: 'stale-evaluation',
					message: 'the supplied evaluation id is not the current viewport output'
				};
			}
			return pointerRay(cssPoint, evaluation, tokenOf(evaluation));
		},
		intersectWorkingPlane(ray, plane, evaluationId) {
			const evaluation = camera.evaluation();
			if (evaluation === null || evaluationIdOf(evaluation) !== evaluationId) {
				return {
					kind: 'failed',
					code: 'stale-evaluation',
					message: 'the supplied evaluation id is not the current viewport output'
				};
			}
			return intersectWorkingPlane(ray, plane, evaluation, tokenOf(evaluation));
		},
		requestViewingIntent(intent, ticket, clockSeconds) {
			if (!isLive()) return { kind: 'superseded', state: camera.state(), message: 'the Stage lifetime has ended' };
			// Ownership is the landed ticket protocol's answer, never a field
			// comparison: a ticket for another output, host session or source revision,
			// or one whose run epoch this output already spent, cannot drive it. A run
			// that no longer owns the output is told so (`superseded`) instead of being
			// left to write into an output it no longer holds — which is what makes a
			// prior-epoch completion unable to install its intent after a replacement or
			// a content change.
			const decision = requestCameraOutput(camera.output(), ticket);
			if (decision.kind !== 'accepted') {
				return {
					kind: 'superseded',
					state: camera.state(),
					message:
						decision.kind === 'refused'
							? `the stage inspection output refused this ticket: ${decision.reason}`
							: 'the inspection output is held by another run; acquire it before requesting a viewing intent',
					...(decision.kind === 'refused' ? { reason: decision.reason } : {})
				};
			}
			const result = camera.applyIntent(intent, clockSeconds);
			// A reading change is the one projection move a captured gesture must be told
			// about, and it happens at the *next* evaluation — `applyIntent` only moves
			// session state. Running the live lease's policy here is therefore strictly
			// before the projection changes, and it runs exactly once per accepted
			// request, whether the request came from the keyboard, the toolbar or an
			// adapter's `requestIntent`.
			if (result.kind === 'accepted' && intent.kind === 'set-reading') {
				session.applyReadingChange();
			}
			return result;
		},
		drafting: () => session.drafting(),
		setDrafting: (patch) => session.setDrafting(patch),
		heightSheet: () => session.heightSheet(),
		heightTicks() {
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return [];
			const declared: StageHeightTick[] = [];
			for (const entry of adapters.values()) {
				try {
					declared.push(...(entry.contributions.heightTicks?.(handle.context) ?? []));
				} catch {
					// A contributor that throws contributes no tick; the rest still count.
				}
			}
			const merged = mergeStageHeightTicks(declared);
			// The Sheet's range follows the surfaces its owners actually declared,
			// plus one metre of headroom. The default cut is itself a known height,
			// so an enclosure with no found surface still has a metre above it to
			// explore. The cap never moves the current height; it only bounds the
			// next creator action.
			const highest = merged.length === 0 ? 0 : merged[merged.length - 1]!.heightMeters;
			const sheet = session.heightSheet();
			sheet.setMaxHeightMeters(
				Math.max(PLAN_DEFAULT_CUT_HEIGHT_METERS + 1, highest + 1, sheet.height())
			);
			return merged;
		},
		acquireInspection(policy = 'exclusive') {
			// The host owns one inspection output, so it mints its own run order: every
			// claim this facade acquires is strictly newer than any epoch the output has
			// already accepted, and the observation it presents is the live one.
			return camera.acquireInspection(policy, nextInspectionRun());
		},
		inspectionClaim: () => camera.output().claim,
		inspectionTicket: () => camera.inspectionTicket(),
		installAccepted(next, options) {
			if (!isLive()) {
				return { kind: 'refused', code: 'disposed', message: 'the stage is disposed and installs no source' };
			}
			const previous = currentSnapshot;
			if (next.acceptedRevision.projectId !== previous.acceptedRevision.projectId) {
				return {
					kind: 'refused',
					code: 'different-project',
					message: 'a different project identity is a replacement, not a content change'
				};
			}
			if (next.sourceContentId === previous.sourceContentId) {
				// Identical content: the claim, the selection and the task all still mean
				// what they meant, so nothing is rebased and nothing is re-acquired.
				return { kind: 'unchanged', sourceContentId: next.sourceContentId, claim: camera.output().claim };
			}
			const requalify = options?.requalify;
			const installed = session.installAccepted(next, { requalify, requalifyEntry: options?.requalifyEntry });
			if (installed.kind !== 'installed') {
				// The session holds one accepted-source slot, so this is the "nothing
				// mounted yet" case; a disposed or divergent session is named as such.
				return {
					kind: 'refused',
					code:
						installed.kind === 'refused' && installed.code === 'disposed'
							? 'disposed'
							: installed.kind === 'refused' && installed.code === 'stale-session'
								? 'stale-session'
								: 'no-current-source',
					message:
						installed.kind === 'refused'
							? installed.message
							: 'the session reports identical content for a changed source'
				};
			}
			const endedClaim = camera.output().claim;
			const pose = camera.state().pose;
			// The source rebase ends the live claim (its intent was evaluated against the
			// old content) without touching the pose, and the host re-acquires at once.
			camera.rebaseSource(next.sourceContentId, next.domain.geometry.bounds ?? null);
			currentSnapshot = next;
			// A replacement closes disclosure: the grips it revealed belong to the
			// source that was replaced, not to whatever now shares its identity.
			openDisclosures.clear();
			markHover = null;
			activeMarkId = null;
			// Every factory-bound adapter is rebuilt for *this* snapshot: the registration
			// survives the edit, each previous binding is disposed exactly once, and its
			// replacements were built from the source that is now mounted.
			const reboundAdapters = options?.[SKIP_REBIND_CONTROL] === true ? [] : rebindAdapters();
			// A static binding keeps its registration across the change, so it never saw
			// the requalified selection: it is delivered exactly once, the same way a
			// rebuilt factory binding receives the live selection when it is built.
			if (installed.requalification.kind === 'requalified') {
				const surviving = installed.requalification.selection;
				for (const entry of adapters.values()) {
					if (entry.factory) continue;
					try {
						entry.contributions.selectionEcho?.(surviving);
					} catch {
						// An echo that throws must not fail the install.
					}
				}
			}
			for (const entry of adapters.values()) if (!entry.factory) { try { entry.contributions.selectionChanged?.(session.selectionState()); } catch { /* Subscriber isolation. */ } }
			const acquired = camera.acquireInspection('exclusive', nextInspectionRun());
			// End the closed task's adapters before telling the surface, so a listener
			// that rebuilds its contribution views sees one settled state. Only a closed
			// task forces a synchronous signal: a plain content change keeps the
			// deferred, read-discovered rebuild (the surface must not be notified from
			// inside a derivation). A panel that was showing the task has to learn now
			// that it is gone, or it keeps rendering an instrument whose services can
			// no longer act.
			if (installed.closedTask) {
				notifyTaskClosed();
				notifyAdaptersChanged();
			}
			return {
				kind: 'installed',
				previousSourceContentId: previous.sourceContentId,
				sourceContentId: next.sourceContentId,
				pose: camera.state().pose,
				endedClaim,
				claim: acquired.kind === 'acquired' ? acquired.claim : null,
				reboundAdapters,
				clearedSelection: installed.clearedSelection,
				closedTask: installed.closedTask,
				releasedGestures: installed.releasedGestures,
				requalification: installed.requalification,
				selectionRemovals: installed.selectionRemovals
			};
		},
		adoptMetadata(next) {
			if (!isLive()) return { kind: 'refused', code: 'disposed', message: 'The Stage session has ended.' };
			const adopted = session.adoptMetadata(next);
			if (adopted.kind !== 'adopted') return adopted;
			// Metadata-only source bytes still get a fresh identity. Rebase the one
			// camera output at its existing pose, then rebuild bound adapters against
			// the new authored envelope while retaining the session's selection/task.
			camera.rebaseSource(next.sourceContentId, next.domain.geometry.bounds ?? null);
			currentSnapshot = next;
			// Metadata still replaces the accepted bytes: a disclosed grip set belongs
			// to the source it was opened against and must not survive the swap.
			openDisclosures.clear();
			markHover = null;
			activeMarkId = null;
			rebindAdapters();
			camera.acquireInspection('exclusive', nextInspectionRun());
			notifyAdaptersChanged();
			return adopted;
		},
		plan: (overrides) => planFor(overrides),
		planDependencyKey() {
			const { parameters, target, finiteTarget } = effectivePlanContext();
			// A non-finite target is never retained, so its key must differ from every
			// retained one; the boundary refuses it on the next `plan()` call either way.
			if (!finiteTarget) return `${planRetentionKey(parameters, target, false)}|non-finite`;
			return planRetentionKey(parameters, target, planDependsOnTarget(parameters));
		},
		setPlanParameters(overrides) {
			planOverrides = { ...planOverrides, ...overrides };
		},
		eligibleFragments() {
			const result = planFor();
			return result.kind === 'evaluated' ? eligiblePlanFragments(result.plan) : [];
		},
		resolveSourceHit(candidate) {
			return facade.resolvePick({ ...candidate, purpose: 'select', tool: null });
		},
		resolvePick(query, toolOwner = null) {
			const started = perfMarksEnabled() ? performance.now() : null;
			let result: ResolvedStageHit = { kind: 'none', reason: 'no-fragment' };
			try {
				const evaluation = camera.evaluation();
				if (evaluation === null || evaluationIdOf(evaluation) !== query.evaluationId) return result = { kind: 'failed', code: 'stale-evaluation' };
				if (!query.css.every(Number.isFinite)) return result = { kind: 'failed', code: 'invalid-css-point' };
				ensureBindings();
				const handle = adapterContext();
				if (handle === null) return result;
				// The mark tier sits above world candidates. A host tool (Measure, Eraser)
				// asks the world, not the selection's manipulation language.
				if (query.purpose !== 'tool') {
					const mark = hitStageMark(stageMarks(), { css: query.css, coarse: query.coarse === true });
					if (mark !== null) return result = { kind: 'mark', mark: mark.mark };
				}
				const winner = resolveStagePick(query, [...adapters].map(([adapterId, entry]) => ({ adapterId, binding: entry.contributions })), handle.context, evaluation.renderedReading === 'plan' ? 'plan' : '3d', toolOwner ?? contributedTaskOwner?.adapterId ?? null);
				if (winner === null) return result;
				return result = winner.pick.refusal === null
					? { kind: 'resolved', hit: winner.pick.hit }
					: { kind: 'refused', hit: winner.pick.hit, message: winner.pick.refusal };
			} finally {
				if (started !== null) perfMark('stage:pick', { elapsedMs: performance.now() - started, outcome: result.kind,
					sourceId: result.kind === 'resolved' ? result.hit.sourceId : null,
					sourceKind: result.kind === 'resolved' ? result.hit.sourceKind : null });
			}
		},
		hostToolTarget(query) {
			const evaluation = camera.evaluation();
			if (evaluation === null || evaluationIdOf(evaluation) !== query.evaluationId) return { kind: 'failed', code: 'stale-evaluation' };
			if (!query.css.every(Number.isFinite)) return { kind: 'failed', code: 'invalid-css-point' };
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return { kind: 'none', datumPoint: null };
			try {
				const context = handle.context;
				const ray = context.ray([query.css[0] + evaluation.rect.left, query.css[1] + evaluation.rect.top]);
				const plane = ray === null ? null : context.intersect(ray, datumWorkingPlane(context.snapshot.domain.datumMeters));
				const datumPoint = plane?.kind === 'intersected' ? plane.worldPoint : null;
				const winner = resolveStagePick(
					{ evaluationId: query.evaluationId, css: query.css, purpose: 'tool', tool: { kind: query.tool, scope: 'host' }, ...(query.coarse === undefined ? {} : { coarse: query.coarse }) },
					[...adapters].map(([adapterId, entry]) => ({ adapterId, binding: entry.contributions })),
					context,
					evaluation.renderedReading === 'plan' ? 'plan' : '3d'
				);
				if (winner === null) return { kind: 'none', datumPoint };
				return { kind: 'hit', adapterId: winner.adapterId, hit: winner.pick.hit, refusal: winner.pick.refusal, datumPoint };
			} finally {
				handle.end();
			}
		},
		eraseAnswer(adapterId, hit) {
			if (!isLive()) return null;
			const entry = adapters.get(adapterId);
			if (entry === undefined || !entry.contributions.hostTools?.includes('erase')) return null;
			try {
				return entry.contributions.eraseAction?.(hit) ?? null;
			} catch {
				// A throwing contributor erases nothing, as everywhere else in this host.
				return null;
			}
		},
		marks() {
			return stageMarks();
		},
		hitMark(query) {
			return hitStageMark(stageMarks(), query);
		},
		setMarkHover(mark) {
			if (!isLive()) return;
			markHover = mark === null ? null : { adapterId: mark.adapterId, id: mark.id };
		},
		activateDisclosure(id) {
			if (!isLive()) return false;
			const mark = stageMarks().find((candidate) => candidate.id === id);
			if (mark === undefined || mark.role !== 'disclose') return false;
			if (openDisclosures.has(id)) openDisclosures.delete(id);
			else openDisclosures.add(id);
			return true;
		},
		closeDisclosure() {
			if (openDisclosures.size === 0) return false;
			openDisclosures.clear();
			return true;
		},
		handleDiagnostics() {
			return handleDiagnostics;
		},
		selection: () => session.selection(),
		selectionState: () => session.selectionState(),
		setSelection,
		select,
		openTask: (task) => { if (!isLive()) return false; contributedTaskOwner = null; return session.openTask(task); },
		closeTask: () => {
			if (!isLive()) return false;
			contributedTaskOwner = null;
			const closed = session.closeTask();
			// A closed task owns no press and no proposal: tell its adapter now, so the
			// session's one cancel path runs here rather than at unmount.
			if (closed) notifyTaskClosed();
			notifyAdaptersChanged();
			return closed;
		},
		changeLens(next) {
			if (!isLive() || !session.changeLens(next)) return false;
			openDisclosures.clear();
			markHover = null;
			activeMarkId = null;
			// A lens exit ends bindings as well as writers. Old callbacks cannot become live on return.
			rebindAdapters();
			notifyAdaptersChanged();
			return true;
		},
		resumeTask() {
			if (!isLive()) return { kind: 'refused', code: 'stale-session', message: 'This Stage lifetime has ended.' };
			ensureBindings();
			const owner = contributedTaskOwner;
			const entry = owner ? tasksOf().find((candidate) => candidate.adapterId === owner.adapterId && candidate.id === owner.taskId) : null;
			const result = session.resumeTask((task, snapshot) => {
				// The owning adapter may simply not be bound right now (a lens whose view
				// supplies no evaluation defers its bindings). Say so, instead of claiming
				// the capability was removed from a live adapter.
				if (owner && !entry) return { kind: 'refused', code: 'binding-unavailable', message: 'This capability is not bound in this lens. Return to its lens and resume again.' };
				if (entry && !entry.revalidate) return { kind: 'refused', code: 'resume-unavailable', message: 'This adapter cannot revalidate its task. Close it and invoke it again.' };
				return entry?.revalidate?.(task, snapshot) ?? { kind: 'resumed' };
			});
			if (result.kind === 'resumed') rebindAdapters();
			notifyAdaptersChanged();
			return result;
		},
		registerStageAdapter(adapter) {
			if (!isLive()) {
				return {
					kind: 'refused',
					code: 'unknown-required-capability',
					missing: [],
					message: 'the stage is disposed and mounts no adapter'
				};
			}
			if (adapters.has(adapter.id)) {
				return {
					kind: 'refused',
					code: 'duplicate-adapter',
					missing: [],
					message: `an adapter "${adapter.id}" is already registered`
				};
			}
			const required = adapter.requiredCapabilities ?? [];
			const missing = required.filter((capability) => !HOST_STAGE_CAPABILITIES.includes(capability));
			if (missing.length > 0) {
				return {
					kind: 'refused',
					code: 'unknown-required-capability',
					missing,
					message: `this host does not provide ${missing.join(', ')}; refusing to mount "${adapter.id}"`
				};
			}
			let ended = false;
			const factory = adapter.bind !== undefined;
			const built = factory
				? buildBinding(adapter)
				: { kind: 'built' as const, contributions: adapter, dispose: once(() => adapter.dispose?.()) };
			// The map entry owns the *binding* disposer; the registration disposer also
			// removes the entry, so a content change never ends a registration.
			const bindingDispose = built.kind === 'built' ? built.dispose : () => {};
			const dispose = () => {
				if (ended) return;
				ended = true;
				const currentBinding = disposed ? undefined : adapters.get(adapter.id);
				adapters.delete(adapter.id);
				if (contributedTaskOwner?.adapterId === adapter.id) {
					contributedTaskOwner = null;
					session.closeTask();
				}
				currentBinding?.dispose();
				notifyAdaptersChanged();
			};
			adapters.set(adapter.id, {
				adapter,
				contributions: built.kind === 'built' ? built.contributions : {},
				factory,
				pending: factory && built.kind === 'deferred',
				dispose: bindingDispose
			});
			session.addDisposable(dispose);
			notifyAdaptersChanged();
			return { kind: 'registered', id: adapter.id, dispose };
		},
		adapters: () => [...adapters.values()].map((entry) => entry.adapter),
		onAdaptersChanged(listener) {
			adapterListeners.add(listener);
			return () => {
				adapterListeners.delete(listener);
			};
		},
		// An adapter is third-party code. A throwing contributor is skipped, exactly as
		// an echo or a bind refusal is: the route calls these from its animation frame,
		// so one exception would otherwise stop the Stage's own rendering for good.
		overlays() {
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return [];
			// Adapters project through the Camera's viewport CSS; the overlay paints
			// inside the Stage surface. The one accepted evaluation rect is the only
			// translation, applied here so no adapter has to know the surface offset
			// and no marker can be painted one Index panel to the right of its target.
			const { left, top } = handle.context.evaluation.rect;
			return [...adapters.values()].flatMap((entry) => {
				try {
					return (entry.contributions.overlay?.(handle.context) ?? []).map((marker) => ({
						...marker,
						css: [marker.css[0] - left, marker.css[1] - top] as const
					}));
				} catch { return []; }
			});
		},
		candidatePreviews() {
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return [];
			const { left, top } = handle.context.evaluation.rect;
			// One projection, at the same boundary the overlay uses. World points an
			// adapter contributes are never translated again by it.
			const css = (world: Vec3): readonly [number, number] | null => {
				if (world.length !== 3 || !world.every(Number.isFinite)) return null;
				const projected = handle.context.project(world);
				return projected === null ? null : [projected[0] - left, projected[1] - top];
			};
			return [...adapters.values()].flatMap((entry) => {
				try {
					return (entry.contributions.candidatePreview?.(handle.context) ?? []).flatMap(
						(candidate): StageCandidatePreviewView[] => {
							const polygons = candidate.polygons.flatMap((polygon) => {
								const points = polygon.map(css);
								return points.length >= 3 && points.every((point) => point !== null)
									? [points as readonly (readonly [number, number])[]]
									: [];
							});
							const segments = candidate.segments.flatMap(([from, to]) => {
								const a = css(from);
								const b = css(to);
								return a === null || b === null ? [] : [[a, b] as const];
							});
							const labels = candidate.labels.flatMap((label) => {
								const point = css(label.world);
								return point === null ? [] : [{ css: point, text: label.text }];
							});
							const snapPoint = candidate.snap === undefined ? null : css(candidate.snap.world);
							return [{
								id: candidate.id,
								role: candidate.role,
								polygons,
								segments,
								labels,
								bounds: candidateBounds(candidate),
								...(snapPoint === null || candidate.snap === undefined
									? {}
									: { snap: { css: snapPoint, name: candidate.snap.name } })
							}];
						}
					);
				} catch { return []; }
			});
		},
		graphics() {
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return [];
			return [...adapters.values()].flatMap((entry) => {
				try { return entry.contributions.graphics?.(handle.context) ?? []; } catch { return []; }
			});
		},
		ghosts() {
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return [];
			return [...adapters.values()].flatMap((entry) => {
				try { return entry.contributions.ghosts?.(handle.context) ?? []; } catch { return []; }
			});
		},
		tasks() {
			ensureBindings();
			return tasksOf();
		},
		inkReadings() {
			ensureBindings();
			return inkReadingsOf();
		},
		openInkReading(id, adapterId) {
			if (!isLive()) return null;
			ensureBindings();
			const record = inkReadingsOf().find(
				(candidate) => candidate.id === id && (adapterId === undefined || candidate.adapterId === adapterId)
			);
			if (record === undefined) return null;
			const reading = adapters
				.get(record.adapterId)
				?.contributions.readings?.find((candidate) => candidate.id === record.id);
			if (reading === undefined) return null;
			try {
				return { reading: record, session: reading.begin() };
			} catch {
				return null;
			}
		},
		instrumentForTask(id, adapterId) {
			if (!isLive() || session.task() === null) return null;
			ensureBindings();
			const entry = tasksOf().find((candidate) => candidate.id === id && (adapterId === undefined || candidate.adapterId === adapterId));
			if (entry === undefined || session.task()?.kind !== entry.taskKind ||
				contributedTaskOwner?.adapterId !== entry.adapterId || contributedTaskOwner.taskId !== entry.id) return null;
			try {
				const content = adapters.get(entry.adapterId)?.contributions.instrument?.({
					kind: entry.taskKind, targetRef: entry.targetRef ?? null
				}) ?? null;
				if (!content?.view) return content;
				const services = content.view.services;
				// **TD-8.** These services belong to the *contributed task instance*, not to
				// a writer generation. A generation is bumped by every task lifecycle
				// change (open, close, resume, lens change, accepted install), so
				// capturing it here made a mounted panel keep a value that was stale by
				// design: after Undo/Redo the next `Begin` refused `stale-epoch`. The
				// lifetime the instrument actually needs is the task object it was opened
				// for: the same open task means the same authority, a replacement, reopen,
				// Resume, close or install is a different (or absent) task and refuses.
				// The facade already refuses each operation after those transitions, and a
				// closed task is announced synchronously (see `installAccepted`), so the
				// panel rebuilds instead of holding services that can no longer act.
				// Nothing here re-acquires host internals; the panel keeps what it was
				// handed.
				const openedFor = session.task();
				const taskOwner = { adapterId: entry.adapterId, taskId: entry.id };
				const active = () =>
					openedFor !== null &&
					isLive() &&
					session.task() === openedFor &&
					contributedTaskOwner?.adapterId === taskOwner.adapterId &&
					contributedTaskOwner.taskId === taskOwner.taskId;
				return { ...content, view: { ...content.view, services: {
					stage: { ...services.stage,
						setSelection: (value) => active() ? setSelection(value) : { kind: 'refused', code: 'inactive-task', message: 'Resume the task before selecting.' },
						select: (value) => { if (active()) select(value); },
						acquireGesture: (request) => active() ? facade.acquireGesture(request) : { kind: 'refused', code: 'stale-epoch', owner: request.owner }
					},
					authoring: { ...services.authoring, accept: (intent) => active() ? services.authoring.accept(intent) : Promise.resolve({ kind: 'refused', code: 'inactive-task', message: 'Resume the task before applying a proposal.' }) }
				} } };
			} catch { return null; }
		},
		openFindEntry(adapterId, id) {
			ensureBindings();
			const entry = findEntriesOf().find((candidate) => candidate.id === id && candidate.adapterId === adapterId);
			const tasks = tasksOf().filter((candidate) => candidate.adapterId === adapterId && candidate.taskKind === entry?.taskKind);
			if (tasks.length !== 1) return { kind: 'refused', code: 'unknown-task', message: 'Find requires one task of the declared kind in its owning adapter' };
			return facade.openContributedTask(tasks[0]!.id, adapterId);
		},
		openContributedTask(id, adapterId) {
			if (!isLive()) {
				return { kind: 'refused', code: 'task-closed', message: 'the stage is disposed and opens no task' };
			}
			ensureBindings();
			const entry = tasksOf().find((candidate) => candidate.id === id && (adapterId === undefined || candidate.adapterId === adapterId));
			if (entry === undefined) {
				return { kind: 'refused', code: 'unknown-task', message: `no adapter contributes a task "${id}"` };
			}
			const lens = entry.lens ?? 'world';
			if (lens !== session.lens()) {
				// A lens-bound operation is not a disposed session: name the lens, so the
				// creator returns there instead of reading "disposed" for a live Stage.
				return { kind: 'refused', code: 'wrong-lens', message: `Return to the ${lens} lens before invoking ${entry.label}.` };
			}
			// Opening a task ends the no-task surface too: a direct-manipulation gesture
			// (a size ray) must not outlive the task that now owns the pointer. A
			// replacement also closes its previous contributed task through the same
			// taskClosed path as Esc, so no lease survives into the new task.
			if (contributedTaskOwner === null ||
				contributedTaskOwner.adapterId !== entry.adapterId || contributedTaskOwner.taskId !== entry.id) {
				notifyTaskClosed();
			}
			const task: StageTask = {
				kind: entry.taskKind,
				label: entry.label,
				targetRef: entry.targetRef ?? null, target: entry.target ?? null, configuration: entry.configuration ?? null, lens
			};
			if (!session.openTask(task)) {
				return { kind: 'refused', code: 'task-closed', message: 'the session is disposed and opens no task' };
			}
			contributedTaskOwner = { adapterId: entry.adapterId, taskId: entry.id };
			notifyAdaptersChanged();
			const instrument = facade.instrumentForTask(id, entry.adapterId);
			return { kind: 'opened', taskId: entry.id, task, adapterId: entry.adapterId, instrument };
		},
		subjects() {
			ensureBindings();
			return [...adapters.values()].flatMap((entry) => entry.contributions.subjects ?? []);
		},
		findEntries() {
			ensureBindings();
			return findEntriesOf();
		},
		cardFacts(subject) {
			ensureBindings();
			const facts: StageCardFactRecord[] = [];
			for (const [adapterId, entry] of adapters.entries()) {
				let contributed: readonly StageCardFact[] = [];
				try { contributed = entry.contributions.cardFacts?.(subject) ?? []; } catch { contributed = []; }
				for (const fact of contributed) facts.push({ ...fact, adapterId });
			}
			return facts.sort((a, b) => {
				if (a.adapterId !== b.adapterId) return a.adapterId < b.adapterId ? -1 : 1;
				return a.label === b.label ? 0 : a.label < b.label ? -1 : 1;
			});
		},
		pointerIntent(intent) {
			if (!isLive()) return { claimed: false, adapterId: null };
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return { claimed: false, adapterId: null };
			if (intent.phase === 'down') {
				// Only the binding whose task owns the surface may claim the press: a
				// different adapter's pointer hook cannot take another task's gesture.
				const taskOwner = contributedTaskOwner;
				if (taskOwner !== null) {
					const entry = adapters.get(taskOwner.adapterId);
					const claim = entry?.contributions.pointerIntent;
					if (claim === undefined) return { claimed: false, adapterId: null };
					try {
						if (claim(intent, handle.context)) {
							pointerOwner = taskOwner.adapterId;
							return { claimed: true, adapterId: taskOwner.adapterId };
						}
					} catch {
						// A throwing claim is a refusal, not a stolen press.
					}
					return { claimed: false, adapterId: null };
				}
				// Direct manipulation belongs only to the primary selection's domain.
				const adapterId = primaryEntry(session.selectionState())?.reference.domain;
				const entry = adapterId === undefined ? undefined : adapters.get(adapterId);
				const claim = entry?.contributions.pressWhenNoTask === true ? entry.contributions.pointerIntent : undefined;
				if (claim !== undefined) {
					try {
						if (claim(intent, handle.context)) {
							pointerOwner = adapterId!;
							if (intent.handleId !== undefined) {
								activeMarkId = intent.handleId;
								markHover = { adapterId: adapterId!, id: intent.handleId };
							}
							return { claimed: true, adapterId: adapterId! };
						}
					} catch {
						// A throwing claim is a refusal, not a stolen press.
					}
				}
				return { claimed: false, adapterId: null };
			}
			const owner = pointerOwner;
			if (owner === null) {
				if (intent.phase === 'move') facade.hoverIntent(intent);
				return { claimed: false, adapterId: null };
			}
			const entry = adapters.get(owner);
			if (entry === undefined) {
				pointerOwner = null;
				return { claimed: false, adapterId: null };
			}
			try { entry.contributions.pointerIntent?.(intent, handle.context); } catch { /* Subscriber isolation. */ }
			if (intent.phase !== 'move') {
				// A writer that deliberately kept its gesture lease (numeric entry after
				// pointer-up) also keeps the keyboard until Enter or Esc. A writer that
				// released has ended, so the host drops ownership with it.
				if (session.gesture() === null) {
					pointerOwner = null;
					activeMarkId = null;
				}
			}
			return { claimed: true, adapterId: owner };
		},
		hoverIntent(intent) {
			if (!isLive() || session.gesture() !== null || contributedTaskOwner === null) return false;
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return false;
			try { return adapters.get(contributedTaskOwner.adapterId)?.contributions.hoverIntent?.(intent, handle.context) === true; }
			catch { return false; }
		},
		keyboardIntent(intent) {
			if (!isLive()) return { claimed: false, adapterId: null };
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return { claimed: false, adapterId: null };
			// Only the binding that owns the open task answers a command key: another
			// adapter's hook must not command work it does not own.
			const taskOwner = contributedTaskOwner;
			if (taskOwner === null) return { claimed: false, adapterId: null };
			const entry = adapters.get(taskOwner.adapterId);
			const claim = entry?.contributions.keyIntent;
			if (claim === undefined) return { claimed: false, adapterId: null };
			try {
				if (claim(intent, handle.context)) {
					return { claimed: true, adapterId: taskOwner.adapterId };
				}
			} catch {
				// A throwing claim is a refusal, never a stolen key.
			}
			return { claimed: false, adapterId: null };
		},
		gestureKeyIntent(intent) {
			if (!isLive() || session.task() !== null) return { claimed: false, adapterId: null };
			const owner = pointerOwner;
			if (owner === null) return { claimed: false, adapterId: null };
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return { claimed: false, adapterId: null };
			const claim = adapters.get(owner)?.contributions.keyIntent;
			if (claim === undefined) return { claimed: false, adapterId: null };
			try {
				return claim(intent, handle.context)
					? { claimed: true, adapterId: owner }
					: { claimed: false, adapterId: null };
			} catch {
				return { claimed: false, adapterId: null };
			}
		},
		notifySurfaceChange() {
			if (isLive()) notifyAdaptersChanged();
		},
		cardWriter(subject) {
			if (!isLive()) return null;
			ensureBindings();
			// Deterministic owner, exactly like the name writer: adapter ID order, so
			// two adapters cannot disagree about which fields the Card shows.
			const ids = [...adapters.keys()].sort();
			for (const adapterId of ids) {
				const entry = adapters.get(adapterId);
				if (entry?.contributions.cardWriter === undefined) continue;
				let content: StageInstrumentContent | null = null;
				try { content = entry.contributions.cardWriter(subject); } catch { content = null; }
				if (content !== null) return { ...content, adapterId };
			}
			return null;
		},
		cardActions(subject) {
			if (!isLive()) return [];
			ensureBindings();
			const actions: StageCardActionRecord[] = [];
			for (const [adapterId, entry] of adapters.entries()) {
				let contributed: readonly StageCardAction[] = [];
				try { contributed = entry.contributions.cardActions?.(subject) ?? []; } catch { contributed = []; }
				for (const action of contributed) actions.push({ ...action, adapterId });
			}
			return actions.sort((a, b) => {
				if (a.adapterId !== b.adapterId) return a.adapterId < b.adapterId ? -1 : 1;
				return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
			});
		},
		cardNameWriter(subject) {
			if (!isLive()) return null;
			ensureBindings();
			// Deterministic owner: adapter ID order, so two adapters cannot disagree
			// about which writer the Card shows on different renders.
			const ids = [...adapters.keys()].sort();
			for (const adapterId of ids) {
				const entry = adapters.get(adapterId);
				if (entry?.contributions.cardName === undefined) continue;
				let target: StageCardNameTarget | null = null;
				try { target = entry.contributions.cardName(subject); } catch { target = null; }
				if (target !== null) return { ...target, adapterId };
			}
			return null;
		},
		acquireGesture(request) {
			if (!isLive()) return { kind: 'refused', code: 'stale-epoch', owner: request.owner };
			const outcome = session.acquireGesture({
				owner: request.owner,
				evaluationId: request.evaluationId,
				acceptedRevision: currentSnapshot.acceptedRevision,
				policy: request.policy,
				...(request.navigation === true ? { navigation: true } : {})
			});
			// **Never notify adapter listeners here.** A lease is not a registration or
			// a binding change: a granted proposal changes what Undo reports, but the
			// host reads that on its own refresh frame. Notifying invalidated every
			// contribution view, which rebuilt the instrument that had just acquired
			// the lease, disposing it and releasing the proposal on the same keystroke —
			// so Undo could never actually observe `live-proposal`.
			return outcome;
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			if (session.isCurrent(lifetimeToken) && contributedTaskOwner !== null) session.closeTask();
			contributedTaskOwner = null;
			endAdapters();
			// A consumer that keeps this facade must not show stale contribution rows,
			// and no listener may outlive the facade it was registered on.
			notifyAdaptersChanged();
			adapterListeners.clear();
			planCutUnsubscribe?.();
			planCutUnsubscribe = null;
		}
	};

	// The one v1 consumer of the height fact. Registration is at mount, the
	// current height is pushed immediately (a recreated facade must not disagree
	// with the session), and the existing Plan-override path remains the only
	// parameter authority. The Sheet never imports this consumer.
	planCutUnsubscribe = session.heightSheet().subscribe('plan-cut', (heightMeters) => {
		facade.setPlanParameters({ cutHeightMeters: heightMeters });
	});
	facade.setPlanParameters({ cutHeightMeters: session.heightSheet().height() });

	return facade;
}
