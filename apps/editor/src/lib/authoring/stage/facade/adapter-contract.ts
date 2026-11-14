import type { Component, Snippet } from 'svelte';
import type { PointerRay, Vec3, ViewingIntent, ViewingIntentResult, ViewportCameraState, ViewportEvaluation, WorkingPlane, WorkingPlaneHit } from '@portfolio/camera-core';
import type { PlanSourceKind, PlanSourceRef, PlanStream, PlanSubRef } from '@portfolio/layout-core';
import type { CameraOutputRefusal, F4JsonValue, SceneFormSource, SemanticReference } from '@portfolio/project-model';
import type { SceneRenderedHit } from '$lib/authoring/scene/scene-pick-source';
import type { StageReadSnapshot } from '../accepted-read';
import type { StageAdapterServices } from '../stage-adapter-host';
import type { StageDraftingState } from '../stage-drafting';
import type { StageHandleDescriptor } from '../stage-handles';
import type { StageHeightTick } from '../stage-height-sheet';
import type { StageLens, StageSelection, StageTask, TaskResumeOutcome } from '../stage-session';
import type { StageSelectionChange, StageSelectionState } from '../semantic-selection';

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
 * A persistent, world-space guide contributed by a domain binding.
 *
 * Unlike a candidate preview, this is not an uncommitted proposal: it stays
 * while its subject is selected. The Stage projects both segment lists once
 * through the same evaluation as the candidate layer, so the guide can never
 * disagree with the geometry it describes.
 */
export type StageGuideContribution = {
	readonly id: string;
	readonly role: 'selection' | 'hover' | 'armed';
	readonly segments: readonly (readonly [Vec3, Vec3])[];
	/** Derived helpers (unbounded reach, stems) are drawn differently. */
	readonly derivedSegments?: readonly (readonly [Vec3, Vec3])[];
	/**
	 * A guide's own label, e.g. the selected instrument's name at its centre.
	 * It is never a permanent subject label: the host draws it in the live-tag
	 * style, and only for as long as the guide itself is contributed.
	 */
	readonly labels?: readonly { readonly world: Vec3; readonly text: string }[];
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
	readonly drawing?: boolean;
	readonly polygons: readonly (readonly Vec3[])[];
	readonly segments: readonly (readonly [Vec3, Vec3])[];
	readonly labels: readonly { readonly world: Vec3; readonly text: string }[];
	readonly snap?: { readonly world: Vec3; readonly name: string };
};

/** One candidate after the facade's single projection into Stage CSS space. */
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
	/** A model proxy is deliberately quieter; a refused candidate uses refusal ink. */
	readonly treatment?: 'subject' | 'proxy' | 'refused';
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
	/**
	 * The platform's alternate-shape modifier, sampled at the press. Cmd on macOS
	 * and Ctrl on Windows/Linux mean the same authoring intent; adapters read the
	 * pair on `down` and keep the chosen mode for the gesture.
	 */
	readonly metaKey?: boolean;
	readonly ctrlKey?: boolean;
	/** The admitted mark the press started on, when the host resolved one. */
	readonly handleId?: string;
	/** The binding that published the admitted mark, when the host resolved one. */
	readonly handleAdapterId?: string;
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
	/** The platform's delete key; the owning adapter may have a scoped meaning for it. */
	| { readonly kind: 'delete' }
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
	/**
	 * Keep the primary selection's admitted marks visible and hit-testable while
	 * this task is open. The task's pointer hook must claim those marks before its
	 * own task gesture. Default false: an open task owns the whole surface.
	 */
	readonly marksWhileOpen?: boolean;
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
	/** Optional editor-only invocation preparation, after eligibility. */
	readonly onInvoke?: () => void;
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

/**
 * One Card fact for a subject the adapter owns.
 *
 * `fieldId` names the subject field the fact shows (`height`, `position`, `name`, …).
 * The Card does not repeat a fact whose field is carried by its header (`name`, `kind`)
 * or by its contributed writer, which edits that field in place. A fact with no
 * `fieldId` is read-only and always shown.
 */
export type StageCardFact = {
	readonly label: string;
	readonly value: string;
	readonly fieldId?: string;
	/**
	 * T2.S3's derived relation affordance: the value is a subject the creator may
	 * reveal. The reference is the semantic identity; the callback is the one
	 * existing Stage selection write, never a second selection model.
	 */
	readonly select?: {
		readonly reference: SemanticReference;
		readonly onSelect: () => void;
	};
};

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
	/** A shorter Card-foot verb, when the full label is too long for the row. */
	readonly compactLabel?: string;
	/**
	 * Words the creator reads **before** the action is taken: the planner-derived
	 * consequences (hosted Openings, Room merge/open). Required for a destructive
	 * action, and never a second opinion — the adapter derives it from the same
	 * planner call acceptance runs.
	 */
	readonly detail?: string;
	/** A destructive action states so, and the Card confirms before running it. */
	readonly destructive?: boolean;
	/**
	 * `primary` (the default) stays in the Card's action row. `secondary` moves into the
	 * Card's More disclosure. Only `destructive: true` gets destructive styling, so a
	 * secondary action such as Duplicate never looks dangerous.
	 */
	readonly group?: 'primary' | 'secondary';
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
	readonly presentation?: 'palette' | 'instrument';
	readonly summary: string;
	readonly facts?: readonly StageCardFact[];
	/**
	 * The subject fields this content edits when it is the Card's writer. An ordinary
	 * Card fact whose `fieldId` is listed is shown by this writer, so it is not repeated.
	 */
	readonly fieldIds?: readonly string[];
	/**
	 * Place this writer's primary contributed actions in the Card foot instead of
	 * the subject menu. The Light Card uses it for Duplicate and Delete.
	 */
	readonly inlineActions?: boolean;
	/** Editor-only UI; never serialized or imported by visitor surfaces. */
	readonly view?: {
		readonly component: Component<{
			services: StageAdapterServices;
			detailOpen?: boolean;
			footer?: Snippet<[string?]>;
			secondary?: Snippet<[Snippet?]>;
			more?: Snippet<[Snippet?]>;
			/** The subject's scoped actions, so a writer can place a primary one in its foot. */
			actions?: readonly StageCardActionRecord[];
			onAction?: (action: StageCardActionRecord) => void;
		}>;
		readonly services: StageAdapterServices;
	};
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
	 * Marks that can appear under an idle pointer without a selected subject.
	 * Their owner updates them through `idleHoverIntent`; the host admits and
	 * projects them with the same planner and viewport rules as selected marks.
	 */
	readonly idleHandles?: (context: StageAdapterContext) => readonly StageHandleDescriptor[];
	/**
	 * The heights this binding's own surfaces offer to the Height Sheet.
	 *
	 * Additive and optional: a binding that declares nothing contributes no tick,
	 * and the host computes no surface itself. The Sheet merges and sorts the
	 * declarations; a throwing contributor contributes none.
	 */
	readonly heightTicks?: (context: StageAdapterContext) => readonly StageHeightTick[];
	readonly overlay?: (context: StageAdapterContext) => readonly StageOverlayContribution[];
	/** Persistent selected/armed guide lines; projected once by the host. */
	readonly guides?: (context: StageAdapterContext) => readonly StageGuideContribution[];
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
	 * Update this binding's transient idle-hover target. The host offers fine,
	 * unpressed moves only when no task or gesture owns the Stage.
	 */
	readonly idleHoverIntent?: (intent: StagePointerIntent, context: StageAdapterContext) => boolean;
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
	/**
	 * Ends this binding (listeners, buffers, callbacks). Run exactly once. On a
	 * factory adapter (one with `bind`), the adapter's own `dispose` instead ends
	 * the **registration**: the facade runs it exactly once, after the last
	 * binding, when the registration ends or the facade is disposed.
	 */
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
