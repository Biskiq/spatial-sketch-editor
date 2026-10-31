/**
 * T1.P01.S04/S05 + T1.P02.S02 — the Layout adapter.
 *
 * This is the slice's **only** module the Stage catalogue discovers, and it
 * reaches the shell exclusively through the AM-5 contribution points: the dock
 * tool, the invoked Instrument, the Card's facts/name/field writer and its
 * scoped actions, and the capability Find entries. It edits no host core, route
 * or shell module.
 *
 * It registers the production planners with the one F.4 coordinator
 * (`createLayoutPlanners` + `createDrawingPlanners`) and contributes:
 *
 * - `layout-ink` — the **dock** tool that draws straight Wall chains, with its
 *   palette (the one supported reading) as the invoked Instrument;
 * - `layout-place-plinth` — the Place → Layout plinth operation;
 * - Card facts, the name writer, the ordinary-field writer (`LayoutCardFields`,
 *   the migrated Dimensions fields) and the Wall delete action, all read from
 *   the accepted source and written through captured F.4 intents;
 * - a capability Find entry for each.
 *
 * **S05 pointer manipulation** stays here, expressed through the shared Stage
 * marks: endpoint points for exact length, a free-end length ray and a two-way
 * body track for rigid translation, offered while a Wall is selected and no
 * contributed task is armed (`pressWhenNoTask`). An Opening publishes a slide
 * track and one truthful width ray. The Wall angle has **no** Stage grip: by the
 * owner's 2026-10-29 ruling it is a Card field only. A press is claimed only on
 * an admitted mark;
 * each move previews through the retained planner on an immutable baseline, and
 * release commits once through the same F.4 intent a typed field builds. Typing
 * freezes the candidate into numeric entry; Enter commits once and Esc restores,
 * then cancels. Escape, a pointer cancel, capture loss, task close and
 * replacement cancel with no document change.
 *
 * **S02 drawing** is the chain state machine in `./chain`: taps name points, a
 * drag draws one Wall and finishes, the start point closes the ring, and every
 * preview and commit runs the canonical planner over the same captured identity.
 * A live chain holds a **proposal lease**, so Undo explains finish-or-cancel
 * until it settles; a refused finish keeps the chain editable and writes no
 * partial source.
 *
 * A reading flip does not silently commit or reinterpret: the manipulation
 * gesture is ended without a commit and its explicit parameter is preserved as a
 * paused proposal that the overlay names. The creator applies it explicitly from
 * the Card or cancels it with Escape — never by the stale pointer-up.
 */

import {
	compileWallFirstLayoutGeometry,
	evaluateLayoutPlan,
	mintLayoutIdCapture,
	planCreateWallFirstOpening,
	planDeleteWallFirstOpening,
	planUpdateWallFirstOpening,
	type FixedWallEndpoint,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import { createPlanPickProvider } from '$lib/authoring/layout/plan-pick-provider';
import type { StageAdapterFactory, StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import {
	datumWorkingPlane,
	type StageAdapter,
	type StageAdapterBinding,
	type StageAdapterContext,
	type StageCardAction,
	type StageCardFact,
	type StageCardSubject,
	type StageCandidatePreview,
	type StageKeyboardIntent,
	type StagePointerIntent
} from '$lib/authoring/stage/stage-facade';
import { stageLayout, stageUnitRevision } from '$lib/authoring/stage/unit-stage-source';
import type { GestureAcquisition, ProposalLease } from '$lib/authoring/stage/stage-session';
import type { StageHeightTick } from '$lib/authoring/stage/stage-height-sheet';
import { perfInstall, perfMark } from '$lib/platform/perf-marks';

import LayoutCardFields from './layout/LayoutCardFields.svelte';
import LayoutInkPalette from './layout/LayoutInkPalette.svelte';
import LayoutPlacementInstrument from './layout/LayoutPlacementInstrument.svelte';
import { wallRefusalWords } from './layout/refusals';
import {
	EMPTY_CHAIN_DRAFT,
	appendChainPoint,
	backtrackChainPoint,
	boxChainDraft,
	chainPlanRequest,
	classifyTypedChainPoint,
	closeChainDraft,
	isDraftStart,
	planChainDraft,
	plannedLegs,
	pendingLegFacts,
	type ChainDraft,
	type ChainDraftPoint,
	type ChainPlanPreview
} from './layout/chain';
import {
	createOpeningPlanners,
	openingCreateIntent,
	openingDeleteIntent,
	openingRefusalWords,
	type OpeningCreatePayload
} from './layout/opening-planners';
import {
	createDrawingPlanners,
	planWallDeletion,
	wallChainCommitIntent,
	wallDeleteIntent,
	type WallDeletionPreview
} from './layout/drawing-planners';
import {
	classifyInkPointerTarget,
	classifyOpeningHost,
	offsetAlongWall,
	pointOnWallCenterline,
	publishInkSurface,
	type InkController,
	type InkOpeningOptions,
	type InkPaletteSnapshot,
	type InkPointerTarget,
	type InkPaletteReading,
	type InkReading,
	type InkWallMode,
	type ProjectedJunction,
	type ProjectedWall
} from './layout/ink';
import type { StageInkReadingRecord, StageInkReadingSession } from '$lib/authoring/stage/stage-facade';
import type { SemanticReference } from '@portfolio/project-model';
import type { StageHandleDescriptor } from '$lib/authoring/stage/stage-handles';
import {
	planNumericEntryField,
	planNumericEntryInput,
	planNumericEntryKey,
	planNumericEntryOpen,
	planNumericEntrySubmit,
	planNumericEntryTab,
	planNumericFields,
	type PlanNumericEntryState,
	type PlanNumericField,
	type PlanNumericHost
} from '$lib/authoring/layout/plan-numeric-entry';
import {
	LAYOUT_OPENING_MEASURE_KIND,
	LAYOUT_PLINTH_PLACE_KIND,
	LAYOUT_JUNCTION_MOVE_KIND,
	LAYOUT_WALL_LENGTH_KIND,
	LAYOUT_WALL_MOVE_KIND,
	buildLayoutIntent,
	createLayoutPlanners,
	layoutFacts,
	layoutSubjectOf,
	parseMeasureInput,
	parsePlacementXZ,
	planWallManipulation,
	wallFrame,
	wallManipulationIntent,
	warmLayoutPlannerBaseline,
	type LayoutSubject,
	type WallFrame,
	type WallManipulationRequest,
	type WallNeighbourPreview
} from './layout/precision';
import { layoutNameTarget } from './layout/adapter-support';
import {
	pointerWallRequest,
	wallRequestExactLabel,
	wallRequestLabel,
	type WallHandle,
	type WallHandlePoints,
	type WallPointerMode
} from './layout/wall-gesture';
import {
	resolveInkPointSnap,
	resolveJunctionPointSnap,
	resolveOpeningSlideSnap,
	resolveOpeningWidthSnap,
	snapWallDistance,
	snapWallLength,
	type LayoutSnapWinner
} from './layout/snap';
import { draftingSnapIncrementMeters } from '$lib/authoring/stage/stage-drafting';
import {
	buildLayoutCandidatePaper,
	candidatePreviewOf,
	openingIdsOnWalls,
	type CandidatePaperGeometry
} from './layout/candidate-preview';
import {
	clearPausedProposal,
	clearPausedProposalsForSource,
	pausedWallProposal,
	publishPausedProposal,
	type PausedWallProposal
} from './layout/paused-proposal';

/** The dock tool's contributed task and Find-entry id. */
const LAYOUT_INK_TASK = 'layout-ink';
const LAYOUT_INK_ENTRY = 'layout-ink';
const LAYOUT_PLINTH_ENTRY = 'layout-place-plinth';

function factsFor(
	document: LayoutDocumentWallFirst,
	subject: LayoutSubject
): readonly StageCardFact[] {
	return layoutFacts(document, subject);
}

/**
 * The two endpoint handles plus the body handle.
 *
 * `project` returns the viewport's CSS space (the same space the renderer and
 * the Camera use), while a Stage pointer intent is local to the Stage surface.
 * Hit-testing therefore subtracts the one accepted evaluation rect; the overlay
 * keeps the projected points, exactly as the Scene adapter's markers do.
 */
function projectWallHandles(
	context: StageAdapterContext,
	frame: WallFrame,
	space: 'stage' | 'viewport' = 'viewport'
): WallHandlePoints | null {
	const y = context.snapshot.domain.datumMeters;
	const project = (point: readonly [number, number]) => {
		const css = context.project([point[0], y, point[1]]);
		if (css === null) return null;
		return space === 'viewport'
			? css
			: ([css[0] - context.evaluation.rect.left, css[1] - context.evaluation.rect.top] as const);
	};
	const start = project(frame.start);
	const end = project(frame.end);
	const middle = project([
		(frame.start[0] + frame.end[0]) / 2,
		(frame.start[1] + frame.end[1]) / 2
	]);
	if (start === null || end === null || middle === null) return null;
	return { start, end, middle };
}

/**
 * The working-plane point a Stage-local pointer position names.
 *
 * The ray uses the viewport's CSS space (its origin includes the surface offset,
 * exactly as the Scene adapter's floor query does), while pointer intents use
 * Stage-local pixels; the one accepted evaluation rect is the only translation
 * between them. Overlay contributions are viewport CSS and are translated once
 * by `StageFacade.overlays()`, never here.
 */
function pointerDatumPoint(
	context: StageAdapterContext,
	css: readonly [number, number]
): readonly [number, number] | null {
	const ray = context.ray([
		css[0] + context.evaluation.rect.left,
		css[1] + context.evaluation.rect.top
	]);
	if (ray === null) return null;
	const hit = context.intersect(ray, datumWorkingPlane(context.snapshot.domain.datumMeters));
	return hit.kind === 'intersected' ? [hit.worldPoint[0], hit.worldPoint[2]] : null;
}

/**
 * One host-relative Opening candidate.
 *
 * `offset` is the exact near-edge distance from the canonical Wall start; the
 * ghost edges are world points for the overlay. A candidate that does not fit is
 * still shown (with planner words), never moved to make it fit.
 */
type OpeningCandidate = {
	readonly wallId: string;
	readonly offset: number;
};

type OpeningPreview =
	| {
			readonly kind: 'planned';
			readonly openingId: string;
			/** The planner candidate preview compiles; release submits the same request. */
			readonly document: LayoutDocumentWallFirst;
			readonly changedWallIds: readonly string[];
	  }
	| { readonly kind: 'refused'; readonly message: string };

/** One claimed Wall gesture, from its immutable baseline to its one commit. */
type WallGesture = {
	/** The evaluation the press was measured in; a change pauses the writer. */
	readonly evaluationId: string;
	readonly markId: string;
	readonly handle: WallHandle;
	readonly fixed: FixedWallEndpoint;
	/** What the mark means: length, angle, rigid move or a free Junction move. */
	readonly mode: WallPointerMode;
	/** The Junction a point gesture moves, or `null` for a body/length gesture. */
	readonly junctionId: string | null;
	/** The Wall's other end: the orthogonal guide for a point gesture. */
	readonly otherPoint: readonly [number, number] | null;
	/** The Wall's current normal, in world X/Z. */
	readonly normal: readonly [number, number];
	/** Which way the current drag moves along that normal. */
	normalSign: 1 | -1;
	readonly numericHost: PlanNumericHost;
	readonly numericField: PlanNumericField;
	/** Numeric entry opened by typing at the gesture; `null` while pointer-driven. */
	numeric: PlanNumericEntryState | null;
	/** The accepted document the preview always re-solves from. */
	readonly baseline: LayoutDocumentWallFirst;
	readonly frame: WallFrame;
	readonly startPoint: readonly [number, number];
	/** The exact lease this gesture was granted, never whichever lease is live. */
	readonly lease: GestureAcquisition | null;
	/** The last valid explicit parameter, or `null` after a refused move. */
	request: WallManipulationRequest | null;
	/** The planner's candidate frame for the overlay, or `null`. */
	preview: WallFrame | null;
	/** The planner's exact candidate document; preview compiles this one. */
	previewDocument: LayoutDocumentWallFirst | null;
	/** Neighbours the candidate reshaped at the edited junction. */
	neighbours: readonly WallNeighbourPreview[];
	/** The winning snap, or `null` when nothing won. */
	snap: LayoutSnapWinner | null;
	/** The pointer's last datum point, for a refused candidate's dash. */
	pointerPoint: LayoutVec2 | null;
	/** The signed body distance the pointer currently names. */
	distance: number;
	/** The moving endpoint's current point (the Junction or free end). */
	movingPoint: readonly [number, number];
};

/** One claimed Opening mark: slide position or width, through the Opening planner. */
type OpeningMarkGesture = {
	readonly evaluationId: string;
	readonly markId: string;
	readonly openingId: string;
	readonly wallId: string;
	readonly frame: WallFrame;
	readonly length: number;
	readonly offsetAtStart: number;
	readonly widthAtStart: number;
	readonly startPoint: readonly [number, number];
	readonly lease: GestureAcquisition | null;
	readonly numericHost: PlanNumericHost;
	readonly numericField: PlanNumericField;
	readonly baseline: LayoutDocumentWallFirst;
	/** The last candidate this gesture owns, or `null` after a refusal. */
	request: { readonly field: 'offset' | 'width'; readonly value: number } | null;
	/** The snap the pointer named, when one won. */
	snap: LayoutSnapWinner | null;
	/** The canonical candidate document the preview compiles. */
	previewDocument: LayoutDocumentWallFirst | null;
	numeric: PlanNumericEntryState | null;
};

/** The accepted Opening a mark addresses, with its host Wall's frame. */
type OpeningMarkSubject = {
	readonly openingId: string;
	readonly wallId: string;
	readonly frame: WallFrame;
	readonly length: number;
	readonly offset: number;
	readonly width: number;
};

function wallLength(frame: WallFrame): number {
	return Math.hypot(frame.end[0] - frame.start[0], frame.end[1] - frame.start[1]);
}

/** The Wall's unit direction in plan XZ, or `null` for a degenerate frame. */
function wallDirection(frame: WallFrame): readonly [number, number] | null {
	const dx = frame.end[0] - frame.start[0];
	const dz = frame.end[1] - frame.start[1];
	const length = Math.hypot(dx, dz);
	return length > 0 ? [dx / length, dz / length] : null;
}

/** A world point on the Wall centreline at `distance` from its canonical start. */
function framePoint(frame: WallFrame, distance: number, y: number): [number, number, number] {
	const direction = wallDirection(frame);
	if (direction === null) return [frame.start[0], y, frame.start[1]];
	return [frame.start[0] + direction[0] * distance, y, frame.start[1] + direction[1] * distance];
}

export const createAdapter: StageAdapterFactory = (services) => {
	const pick = createPlanPickProvider(() => services.stage.plan());
	const planners = [
		...createLayoutPlanners(),
		...createDrawingPlanners(),
		...createOpeningPlanners()
	];
	for (const planner of planners) {
		const registration = services.authoring.registerPlanner(planner);
		if (registration.kind !== 'registered') {
			throw new Error(
				`Layout adapter planner "${planner.kind}" was refused: ${registration.reason} — ${registration.message}`
			);
		}
	}

	/**
	 * Ink options are the **adapter's** memory, not a binding's: a creator draws a
	 * run of Walls at one thickness/height, and an accepted chain rebuilds the
	 * binding. They are UI state only — the intent carries the resolved numbers.
	 */
	let inkThickness: number | null = null;
	let inkHeight: number | null = null;
	/**
	 * The one Ink tool's current reading. It is adapter memory so a content
	 * install's binding rebuild re-arms the tool on the reading the creator was
	 * using, not on a shell default.
	 */
	let inkReading: InkReading = 'wall';
	/** Line or Box for the Wall reading; adapter memory for the same reason. */
	let inkWallMode: InkWallMode = 'line';
	/** The next Opening's kind and exact defaults; UI state only, never serialized. */
	let openingOptions: InkOpeningOptions = {
		kind: 'door',
		width: 0.9,
		height: 2.1,
		sillHeight: 0
	};
	/** The palette's fields are currently valid; pointer placement must honour that. */
	let openingOptionsValid = true;
	/**
	 * The deleted-Wall disclosure is derived from the canonical planner, which is
	 * a full planning pass; the Card asks for it on render, so the answer for one
	 * (source, Wall) pair is remembered. The map is bounded and keyed by content
	 * identity, so a different document can never read a stale disclosure.
	 */
	const deletionDisclosures = new Map<string, WallDeletionPreview>();

	const adapter: StageAdapter = {
		id: 'layout',
		// Ink is the one Pen and the host's reading contribution point is what lets
		// Scene offer Shape beside Layout's Wall and Opening readings.
		requiredCapabilities: ['stage-instrument-v1', 'ink-readings-v1'],
		// Handle admission reads the planner kinds this factory actually registered;
		// a mark cannot promise an operation the coordinator never received.
		plannerKinds: planners.map((planner) => planner.kind),
		bind(context): StageAdapterBinding {
			const document = stageLayout(context.snapshot);
			const levelId = context.snapshot.domain.layoutLevelId;
			const contentRevision = context.snapshot.domain.unitRevisions.layout;
			/** The task this binding is showing; pointer handles belong to it. */
			let openTaskKind: string | null = null;
			let gesture: WallGesture | null = null;
			let openingGesture: OpeningMarkGesture | null = null;
			let pausedProposal: PausedWallProposal | null = null;
			let refusal: string | null = null;
			/**
			 * A refused release leaves no geometry and no history, but the reason must
			 * outlive the pointer-up so the tag can say why the change did not land.
			 * The next press clears it; nothing is serialized.
			 */
			let settledRefusal: {
				readonly wallId: string;
				readonly contentRevision: string;
				readonly point: LayoutVec2;
				readonly text: string;
			} | null = null;
			/**
			 * The contributed reading this binding is carrying, if any. Ink stays one
			 * task: this session receives the same pointer/key phases the Wall reading
			 * does, and publishes its own palette view. It is binding-scoped, so a
			 * content install replaces it exactly as it replaces every other binding
			 * fact; the reading selection itself is adapter memory.
			 */
			let contributedSession: { readonly readingId: string; readonly session: StageInkReadingSession } | null = null;
			/** The live chain draft, its hover target and its planner preview. */
			let draft: ChainDraft = EMPTY_CHAIN_DRAFT;
			/** One operation, one capture: the same identity previews and commits. */
			let chainCapture: ReturnType<typeof mintLayoutIdCapture> | null = null;
			let inkHover: InkPointerTarget | null = null;
			/** The snap the current Ink hover named; never persisted. */
			let inkSnapWinner: LayoutSnapWinner | null = null;
			let inkNotice: string | null = null;
			let inkPreview: ChainPlanPreview | null = null;
			/** The live chain's lease: Undo names finish-or-cancel until it settles. */
			let inkProposal: ProposalLease | null = null;
			/**
			 * Set while one acceptance is in flight. The palette's Finish button and the
			 * `Enter` command can both fire for one gesture (a focused button activates on
			 * the same keydown the host maps), and two accepts for one chain would be two
			 * authored operations that were meant to be one.
			 */
			let chainCommitInFlight = false;
			let rearmEpoch = 0;
			/**
			 * The Opening reading's own one-operation state: one capture for preview
			 * and commit, one in-flight acceptance, and a press lease that is released
			 * on every exit path (up, cancel, reading switch, task close, dispose).
			 */
			let openingCapture: ReturnType<typeof mintLayoutIdCapture> | null = null;
			let openingCandidate: OpeningCandidate | null = null;
			let openingPreview: OpeningPreview | null = null;
			let openingNotice: string | null = null;
			let openingCommitInFlight = false;
			let openingPress: {
				readonly evaluationId: string;
				readonly lease: GestureAcquisition | null;
				readonly css: readonly [number, number];
			} | null = null;
			let inkPress: {
				/** Where the press landed, in Stage-local CSS: the drag's own first point. */
				readonly origin: readonly [number, number];
				readonly evaluationId: string;
				readonly lease: GestureAcquisition | null;
				/**
				 * The deliberate target the **press** named. A drag authors its Wall from
				 * here, so a later move must never overwrite it — otherwise the Wall would
				 * start wherever the hand happened to hover last.
				 */
				readonly pressTarget: InkPointerTarget;
				/** The latest deliberate target under the pointer; the release falls back to it. */
				hover: InkPointerTarget;
				dragging: boolean;
			} | null = null;

			/** Release the live manipulation lease and drop the in-flight gesture. */
			function endGesture(): void {
				const current = gesture;
				gesture = null;
				// Release **this gesture's own** grant. Reading the session's live lease
				// would release another owner's after a reading change already spent ours.
				if (current?.lease?.kind === 'granted' && current.lease.lease.active) current.lease.lease.release();
			}

			/**
			 * A reading flip ends the writer but not the work: the last explicit
			 * parameter is kept as a paused proposal for the Card to name. It is never
			 * committed by the pointer-up that follows, which is what "no silent commit"
			 * means mechanically.
			 */
			function preservePausedProposal(sourceContentId: string): void {
				const current = gesture;
				if (current === null || current.request === null) {
					pausedProposal = null;
					return;
				}
				const proposal = {
					sourceContentId,
					wallId: current.frame.wallId,
					request: current.request,
					fixed: current.fixed,
					label: wallRequestExactLabel(current.request, current.fixed)
				};
				pausedProposal = proposal;
				// The Card's field writer offers an explicit Resume from this store; it is
				// not a document and the retained planner revalidates the request on apply.
				publishPausedProposal(proposal);
			}

			/** The contributed reading currently selected, or `null` for a built-in. */
			function contributedReading(): StageInkReadingRecord | null {
				if (inkReading === 'wall' || inkReading === 'opening') return null;
				return services.stage.inkReadings().find((reading) => reading.id === inkReading) ?? null;
			}

			/**
			 * End the live contributed reading with no commit. The session is owned by the
			 * contributing binding, never by this one; cancelling is the only operation
			 * this adapter performs on it.
			 */
			function endContributedSession(): void {
				const current = contributedSession;
				contributedSession = null;
				current?.session.cancel();
			}

			/** The live contributed session, opened lazily against the current binding. */
			function ensureContributedSession(): StageInkReadingSession | null {
				const reading = contributedReading();
				if (reading === null) return null;
				if (contributedSession?.readingId === reading.id) return contributedSession.session;
				endContributedSession();
				const opened = services.stage.openInkReading(reading.id, reading.adapterId);
				if (opened === null) return null;
				contributedSession = { readingId: opened.reading.id, session: opened.session };
				return opened.session;
			}

			/** The straight Wall the canonical selection names, or `null`. */
			function selectedWall(
				adapterContext: StageAdapterContext
			): { readonly wallId: string; readonly frame: WallFrame } | null {
				const primary = adapterContext.selectionState().primary;
				if (primary === null || primary.domain !== 'layout' || primary.subject.kind !== 'wall') {
					return null;
				}
				const frame = wallFrame(stageLayout(adapterContext.snapshot), primary.subject.id);
				return frame === null ? null : { wallId: primary.subject.id, frame };
			}

			/** The selected Opening and its host Wall's resolved frame, or `null`. */
			function selectedOpening(adapterContext: StageAdapterContext): OpeningMarkSubject | null {
				const primary = adapterContext.selectionState().primary;
				if (primary === null || primary.domain !== 'layout' || primary.subject.kind !== 'opening') return null;
				const opening = stageLayout(adapterContext.snapshot).openings.find(
					(candidate) => candidate.id === primary.subject.id
				);
				if (opening === undefined) return null;
				const span = openingSpan(opening.wallId);
				if (span === null) return null;
				return {
					openingId: opening.id,
					wallId: opening.wallId,
					frame: span.frame,
					length: span.length,
					offset: opening.offset,
					width: opening.width
				};
			}

			/**
			 * The marks a selected Wall or Opening publishes.
			 *
			 * Every descriptor names a real fact and the exact planner the Card field
			 * submits; the host admits it, owns disclosure and draws it. Values are the
			 * live candidate while a gesture is held, otherwise the accepted value.
			 */
			function markDescriptors(adapterContext: StageAdapterContext): readonly StageHandleDescriptor[] {
				if (openTaskKind !== null || services.stage.session.task() !== null) return [];
				const wall = selectedWall(adapterContext);
				const opening = wall === null ? selectedOpening(adapterContext) : null;
				if (wall === null && opening === null) return [];
				const y = adapterContext.snapshot.domain.datumMeters;
				if (wall !== null) {
					const length = wallLength(wall.frame);
					const direction = wallDirection(wall.frame);
					if (direction === null) return [];
					const numericValue = (markId: string): string | null => {
						if (gesture?.markId !== markId || gesture.numeric === null) return null;
						return `${planNumericEntryField(gesture.numeric).label} ${gesture.numeric.text}`;
					};
					const valueFor = (markId: string, accepted: string): string => {
						const numeric = numericValue(markId);
						if (numeric !== null) return numeric;
						if (gesture?.markId === markId && gesture.request !== null) {
							// The target's point tag is the candidate's length and angle (plus the
							// shared-Wall count); X/Z stays in the Card's disclosure.
							return wallRequestLabel(
								gesture.request,
								gesture.fixed,
								gesture.request.kind === 'junction'
									? {
											frame: gesture.preview ?? undefined,
											incidentWalls: gesture.neighbours.length + 1
										}
									: undefined
							);
						}
						return accepted;
					};
					const refusalFor = (markId: string): string | null =>
						gesture?.markId === markId ? refusal : null;
					const middle = framePoint(wall.frame, length / 2, y);
					const descriptors: StageHandleDescriptor[] = [
						{
							id: 'layout-wall-start-mark',
							kind: 'point',
							role: 'edit',
							anchor: framePoint(wall.frame, 0, y),
							label: 'Wall start',
							fact: 'start',
							verb: 'Junction',
							planner: LAYOUT_JUNCTION_MOVE_KIND,
							value: valueFor(
								'layout-wall-start-mark',
								`X ${wall.frame.start[0].toFixed(2)} · Z ${wall.frame.start[1].toFixed(2)} m`
							),
							refusal: refusalFor('layout-wall-start-mark')
						},
						{
							id: 'layout-wall-end-mark',
							kind: 'point',
							role: 'edit',
							anchor: framePoint(wall.frame, length, y),
							label: 'Wall end',
							fact: 'end',
							verb: 'Junction',
							planner: LAYOUT_JUNCTION_MOVE_KIND,
							value: valueFor(
								'layout-wall-end-mark',
								`X ${wall.frame.end[0].toFixed(2)} · Z ${wall.frame.end[1].toFixed(2)} m`
							),
							refusal: refusalFor('layout-wall-end-mark')
						},
						{
							// The **free end** carries the measure ray: its drag moves the end
							// while the start stays fixed. Anchoring it at the start would put the
							// grip a wall-length away from the point it moves.
							id: 'layout-wall-length',
							kind: 'ray',
							role: 'edit',
							anchor: framePoint(wall.frame, length, y),
							axis: [direction[0], 0, direction[1]],
							extent: length,
							label: 'Wall length',
							fact: 'length',
							verb: 'Length',
							planner: LAYOUT_WALL_LENGTH_KIND,
							value: valueFor('layout-wall-length', `Length ${length.toFixed(3)} m`),
							refusal: refusalFor('layout-wall-length')
						},
						{
							// The grammar's **two-way base ray**: the whole base line slides
							// either way, so the reach is drawn on both sides of one anchor.
							// The rigid move itself is not clamped; this is an affordance.
							id: 'layout-wall-move-mark',
							kind: 'track',
							role: 'edit',
							anchor: middle,
							axis: [-direction[1], 0, direction[0]],
							extent: 0.6,
							bothWays: true,
							label: 'Wall position',
							fact: 'position',
							verb: 'Position',
							planner: LAYOUT_WALL_MOVE_KIND,
							value: valueFor(
								'layout-wall-move-mark',
								`X ${wall.frame.start[0].toFixed(3)} · Z ${wall.frame.start[1].toFixed(3)} m`
							),
							refusal: refusalFor('layout-wall-move-mark')
						}
					];
					// Each endpoint keeps its own anchor; the base ray then wins the middle
					// and the outward length ray keeps the free end. Descriptor order is the
					// domain's hit order. Angle has no Stage grip: the owner's 2026-10-29
					// ruling keeps it a Card field and removes the ring.
					const priority = ['layout-wall-start-mark', 'layout-wall-end-mark', 'layout-wall-move-mark', 'layout-wall-length'];
					return [...descriptors].sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));
				}
				const liveOffset =
					openingGesture?.openingId === opening!.openingId && openingGesture.request?.field === 'offset'
						? openingGesture.request.value
						: opening!.offset;
				const liveWidth =
					openingGesture?.openingId === opening!.openingId && openingGesture.request?.field === 'width'
						? openingGesture.request.value
						: opening!.width;
				const numericValue = (markId: string): string | null => {
					if (openingGesture?.markId !== markId || openingGesture.numeric === null) return null;
					return `${openingGesture.numericField.label} ${openingGesture.numeric.text}`;
				};
				const descriptors: StageHandleDescriptor[] = [
					{
						id: 'layout-opening-position',
						kind: 'track',
						role: 'edit',
						// The track's anchor is the Opening centre, the same point the drag
						// preserves; an anchor on the start edge would jump by half a width on
						// the first press.
						anchor: framePoint(opening!.frame, liveOffset + liveWidth / 2, y),
						axis: (() => {
							const direction = wallDirection(opening!.frame)!;
							return [direction[0], 0, direction[1]] as [number, number, number];
						})(),
						extent: Math.max(0.2, liveWidth),
						label: 'Opening position',
						fact: 'offset',
						verb: 'Offset',
						planner: LAYOUT_OPENING_MEASURE_KIND,
						value: numericValue('layout-opening-position') ?? `Offset ${liveOffset.toFixed(3)} m`,
						refusal: openingGesture?.markId === 'layout-opening-position' ? refusal : null
					},
					{
						id: 'layout-opening-width-end',
						kind: 'ray',
						role: 'edit',
						anchor: framePoint(opening!.frame, liveOffset + liveWidth, y),
						axis: (() => {
							const direction = wallDirection(opening!.frame)!;
							return [direction[0], 0, direction[1]] as [number, number, number];
						})(),
						extent: Math.max(0.2, liveWidth),
						label: 'Opening width — fixed start edge',
						fact: 'width',
						verb: 'Width',
						planner: LAYOUT_OPENING_MEASURE_KIND,
						value: numericValue('layout-opening-width-end') ?? `Width ${liveWidth.toFixed(3)} m`,
						refusal: openingGesture?.markId === 'layout-opening-width-end' ? refusal : null
					}
				];
				// The width edge wins its own anchor; the slide track is reachable between
				// the edges. The start edge is deliberately not a width mark: the existing
				// one-field measure planner changes width with the start fixed, so a
				// start-edge grip would lie about which edge the drag moves.
				const priority = ['layout-opening-width-end', 'layout-opening-position'];
				return [...descriptors].sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));
			}

			/** The Wall operation a mark id names, or `null` for a non-Wall mark. */
			function wallMarkSpec(markId: string): {
				readonly handle: WallHandle;
				readonly fixed: FixedWallEndpoint;
				readonly mode: WallPointerMode;
				readonly host: PlanNumericHost;
				readonly numericField: 'length' | 'angle' | 'distance' | 'x';
			} | null {
				switch (markId) {
					case 'layout-wall-start-mark':
						return { handle: 'start', fixed: 'end', mode: 'junction', host: 'junction', numericField: 'x' };
					case 'layout-wall-end-mark':
						return { handle: 'end', fixed: 'start', mode: 'junction', host: 'junction', numericField: 'x' };
					case 'layout-wall-length':
						return { handle: 'end', fixed: 'start', mode: 'length', host: 'wall-edit', numericField: 'length' };
					case 'layout-wall-move-mark':
						return { handle: 'body', fixed: 'start', mode: 'move', host: 'wall-normal', numericField: 'distance' };
					default:
						return null;
				}
			}

			/** The Opening field a mark id names, or `null`. */
			function openingMarkField(markId: string): 'offset' | 'width' | null {
				if (markId === 'layout-opening-position') return 'offset';
				if (markId === 'layout-opening-width-end') return 'width';
				return null;
			}

			/**
			 * Commit one explicit manipulation parameter through the **same** captured
			 * intent the typed field builds. The operation id and revision are minted
			 * here, at release, so a proposal cannot install against the revision it
			 * started on if an acceptance landed in between.
			 */
			async function commit(
				request: WallManipulationRequest,
				fixed: FixedWallEndpoint,
				wallId: string
			): Promise<void> {
				// T3.P03.S02: release commits exactly once; that commit is the command
				// whose completion the performance flow measures.
				perfMark('command:commit', { wallId });
				const snapshot = services.stage.snapshot();
				const outcome = await services.authoring.accept(
					wallManipulationIntent({
						request,
						wallId,
						fixed,
						operationId: globalThis.crypto.randomUUID(),
						projectId: snapshot.acceptedRevision.projectId,
						revisionId: services.authoring.acceptedRevision().revisionId,
						contentRevision: stageUnitRevision(snapshot, 'layout'),
						levelId: snapshot.domain.layoutLevelId
					})
				);
				refusal = outcome.kind === 'refused' ? wallRefusalWords(outcome.code) : null;
				services.stage.notifySurfaceChange();
			}

			/** The canonical reference an Opening mark's intent addresses. */
			function openingReference(openingId: string): SemanticReference {
				const snapshot = services.stage.snapshot();
				return {
					version: 1,
					domain: 'layout',
					subject: { kind: 'opening', id: openingId },
					revision: { kind: 'exact', contentRevision: stageUnitRevision(snapshot, 'layout') },
					instancePath: [],
					location: {
						kind: 'layout-location',
						levelId: snapshot.domain.layoutLevelId,
						structureInstancePath: []
					},
					componentId: null,
					capabilityId: null
				};
			}

			/**
			 * Commit one Opening measure through the same `layout-opening-measure`
			 * planner the Card field uses. One field per intent, no combined patch, and
			 * the planner owns every fit/overlap refusal.
			 */
			async function commitMarkOpening(request: {
				readonly openingId: string;
				readonly field: 'offset' | 'width';
				readonly value: number;
			}): Promise<void> {
				perfMark('command:commit', { openingId: request.openingId });
				const snapshot = services.stage.snapshot();
				const outcome = await services.authoring.accept(
					buildLayoutIntent({
						kind: LAYOUT_OPENING_MEASURE_KIND,
						operationId: globalThis.crypto.randomUUID(),
						projectId: snapshot.acceptedRevision.projectId,
						revisionId: services.authoring.acceptedRevision().revisionId,
						contentRevision: stageUnitRevision(snapshot, 'layout'),
						levelId: snapshot.domain.layoutLevelId,
						targets: [openingReference(request.openingId)],
						payload: {
							openingId: request.openingId,
							field: request.field,
							value: request.value
						}
					})
				);
				refusal = outcome.kind === 'refused' ? outcome.message : null;
				services.stage.notifySurfaceChange();
			}

			/** Release the Opening gesture's own lease and drop its candidate. */
			function endOpeningGesture(): void {
				const current = openingGesture;
				openingGesture = null;
				if (current?.lease?.kind === 'granted' && current.lease.lease.active) current.lease.lease.release();
			}

			/** The numeric field a live mark opens, with its current candidate. */
			function gestureNumericTarget(): {
				readonly host: PlanNumericHost;
				readonly field: PlanNumericField;
				readonly ownerId: string;
				readonly candidates: Readonly<Record<string, number | null>>;
			} | null {
				const wall = gesture;
				if (wall !== null) {
					const length = wallLength(wall.frame);
					const angle =
						(((Math.atan2(
							wall.frame.end[1] - wall.frame.start[1],
							wall.frame.end[0] - wall.frame.start[0]
						) *
							180) /
							Math.PI) +
							360) %
						360;
					return {
						host: wall.numericHost,
						field: wall.numericField,
						ownerId: wall.frame.wallId,
						candidates:
							wall.numericHost === 'wall-normal'
								? { distance: Math.abs(wall.distance) }
								: wall.numericHost === 'junction'
									? { x: wall.movingPoint[0], z: wall.movingPoint[1] }
									: wall.numericField.id === 'angle'
										? { angle }
										: { length }
					};
				}
				const opening = openingGesture;
				if (opening === null) return null;
				return {
					host: opening.numericHost,
					field: opening.numericField,
					ownerId: opening.openingId,
					candidates: { offset: opening.offsetAtStart, width: opening.widthAtStart }
				};
			}

			/** Digits while a mark is held freeze the candidate and open numeric entry. */
			function openGestureNumeric(key: string): boolean {
				const target = gestureNumericTarget();
				if (target === null) return false;
				const opened = planNumericEntryOpen(
					{ host: target.host, fieldId: target.field.id, ownerId: target.ownerId },
					target.candidates
				);
				const state = planNumericEntryInput(opened, key);
				if (gesture !== null) gesture.numeric = state;
				else if (openingGesture !== null) openingGesture.numeric = state;
				refusal = null;
				services.stage.notifySurfaceChange();
				return true;
			}

			function growGestureNumeric(key: string): boolean {
				const state = gesture?.numeric ?? openingGesture?.numeric ?? null;
				if (state === null) return false;
				const next = planNumericEntryKey(state, key);
				if (gesture !== null) gesture.numeric = next;
				else if (openingGesture !== null) openingGesture.numeric = next;
				// Correcting the text clears the previous refusal immediately; the tag
				// must not keep saying a value is invalid after it changed.
				refusal = null;
				services.stage.notifySurfaceChange();
				return true;
			}

			function numericWords(reason: string): string {
				switch (reason) {
					case 'blank':
						return 'Type a value.';
					case 'not-positive':
						return 'Enter a value greater than zero.';
					case 'sign-not-allowed':
						return 'This value cannot be negative.';
					case 'unit-not-allowed':
						return 'Use m or cm for this measure.';
					default:
						return 'Enter a finite number.';
				}
			}

			/** Enter: commit once through the same planner the field uses. */
			function submitGestureNumeric(): boolean {
				const wall = gesture;
				if (wall !== null) {
					if (wall.numeric === null) return false;
					const outcome = planNumericEntrySubmit(wall.numeric);
					if (outcome.kind === 'refuse') {
						wall.numeric = outcome.state;
						refusal = numericWords(outcome.reason);
						services.stage.notifySurfaceChange();
						return true;
					}
					if (outcome.kind === 'ignored') return true;
					wall.numeric = null;
					const values = outcome.values;
					let request: WallManipulationRequest | null = null;
					if (wall.numericHost === 'wall-normal') {
						const distance = (values.distance ?? 0) * wall.normalSign;
						request = { kind: 'move', delta: [wall.normal[0] * distance, wall.normal[1] * distance] };
					} else if (wall.numericHost === 'junction' && wall.junctionId !== null) {
						request = {
							kind: 'junction',
							junctionId: wall.junctionId,
							point: [values.x ?? wall.movingPoint[0], values.z ?? wall.movingPoint[1]]
						};
					} else if (wall.numericField.id === 'length' && values.length !== undefined) {
						request = { kind: 'length', length: values.length };
					} else if (wall.numericField.id === 'angle' && values.angle !== undefined) {
						request = { kind: 'angle', angleRadians: (values.angle * Math.PI) / 180 };
					}
					const fixed = wall.fixed;
					const wallId = wall.frame.wallId;
					endGesture();
					if (request !== null) void commit(request, fixed, wallId);
					services.stage.notifySurfaceChange();
					return true;
				}
				const opening = openingGesture;
				if (opening === null || opening.numeric === null) return false;
				const outcome = planNumericEntrySubmit(opening.numeric);
				if (outcome.kind === 'refuse') {
					opening.numeric = outcome.state;
					refusal = numericWords(outcome.reason);
					services.stage.notifySurfaceChange();
					return true;
				}
				if (outcome.kind === 'ignored') return true;
				opening.numeric = null;
				const field = opening.numericField.id === 'width' ? 'width' : 'offset';
				const value = field === 'width' ? outcome.values.width : outcome.values.offset;
				const openingId = opening.openingId;
				endOpeningGesture();
				if (value !== undefined) void commitMarkOpening({ openingId, field, value });
				services.stage.notifySurfaceChange();
				return true;
			}

			/* --- Ink: the chain state machine ---------------------------------- */

			/** Every Junction and Wall of the accepted source, projected once. */
			function projectedScene(adapterContext: StageAdapterContext): {
				junctions: readonly ProjectedJunction[];
				walls: readonly ProjectedWall[];
			} {
				const y = adapterContext.snapshot.domain.datumMeters;
				const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
				const junctions: ProjectedJunction[] = [];
				for (const junction of document.junctions) {
					const css = adapterContext.project([junction.point[0], y, junction.point[1]]);
					if (css === null) continue;
					junctions.push({
						id: junction.id,
						css: [css[0] - adapterContext.evaluation.rect.left, css[1] - adapterContext.evaluation.rect.top],
						point: [junction.point[0], junction.point[1]]
					});
				}
				const walls: ProjectedWall[] = [];
				for (const wall of document.walls) {
					if (wall.centerline.kind !== 'line') continue;
					const start = junctionById.get(wall.startJunctionId)?.point;
					const end = junctionById.get(wall.endJunctionId)?.point;
					if (start === undefined || end === undefined) continue;
					const startCss = adapterContext.project([start[0], y, start[1]]);
					const endCss = adapterContext.project([end[0], y, end[1]]);
					if (startCss === null || endCss === null) continue;
					walls.push({
						id: wall.id,
						startCss: [startCss[0] - adapterContext.evaluation.rect.left, startCss[1] - adapterContext.evaluation.rect.top],
						endCss: [endCss[0] - adapterContext.evaluation.rect.left, endCss[1] - adapterContext.evaluation.rect.top],
						start: [start[0], start[1]],
						end: [end[0], end[1]]
					});
				}
				return { junctions, walls };
			}

			/* --- Opening: host preference and one host-relative candidate ----- */

			/** The Wall a selected subject should prefer as host, or `null`. */
			function preferredHostOf(sourceKind: string, sourceId: string): string | null {
				if (sourceKind === 'wall') return sourceId;
				if (sourceKind !== 'opening') return null;
				return document.openings.find((opening) => opening.id === sourceId)?.wallId ?? null;
			}

			/** The host Wall's frame and resolved length, when it has one. */
			function openingSpan(wallId: string): { frame: WallFrame; length: number } | null {
				const frame = wallFrame(document, wallId);
				if (frame === null) return null;
				const length = Math.hypot(frame.end[0] - frame.start[0], frame.end[1] - frame.start[1]);
				return length > 0 ? { frame, length } : null;
			}

			/**
			 * The two ghost edge points in world space for one host-relative offset.
			 * They are drawn even when the candidate overruns the Wall, so the refusal
			 * points at the same geometry the planner rejected instead of hiding it.
			 */
			function openingGhost(
				wallId: string,
				offset: number
			): readonly [LayoutVec2, LayoutVec2] | null {
				const span = openingSpan(wallId);
				if (span === null) return null;
				const { frame, length } = span;
				const at = (distance: number): LayoutVec2 => [
					frame.start[0] + ((frame.end[0] - frame.start[0]) / length) * distance,
					frame.start[1] + ((frame.end[1] - frame.start[1]) / length) * distance
				];
				return [at(offset), at(offset + openingOptions.width)];
			}

			/**
			 * Plan the exact candidate with the canonical create planner. Preview and
			 * acceptance share the minted capture, so the id the ghost implies is the id
			 * acceptance writes.
			 */
			function planOpeningCandidate(candidate: OpeningCandidate): OpeningPreview {
				const capture = openingCapture ?? mintLayoutIdCapture();
				openingCapture = capture;
				const payload: OpeningCreatePayload = {
					wallId: candidate.wallId,
					kind: openingOptions.kind,
					offset: candidate.offset,
					width: openingOptions.width,
					height: openingOptions.height,
					sillHeight: openingOptions.sillHeight
				};
				const plan = planCreateWallFirstOpening(document, payload, capture, levelId);
				return plan.kind === 'rejected'
					? { kind: 'refused', message: openingRefusalWords(document, plan.rejection, payload) }
					: {
							kind: 'planned',
							openingId: plan.changedOpeningIds[0]!,
							document: plan.document,
							changedWallIds: plan.changedWallIds
						};
			}

			/** Re-plan the current candidate (pointer or typed) after any change. */
			function refreshOpeningPreview(): void {
				openingPreview =
					openingCandidate === null
						? null
						: !openingOptionsValid
							? {
									kind: 'refused',
									message: 'Check the Opening Width, Height and Sill before placing.'
								}
							: planOpeningCandidate(openingCandidate);
			}

			/**
			 * Set the candidate and publish its planner answer. New-Opening placement
			 * is edge-positioned and deliberately unsnapped, so there is no placement
			 * snap winner to carry here.
			 */
			function setOpeningCandidate(next: OpeningCandidate | null): void {
				openingCandidate = next;
				if (next === null) {
					openingPreview = null;
					return;
				}
				openingNotice = null;
				refreshOpeningPreview();
			}

			/** Drop every Opening-reading transient; no document write. */
			function clearOpeningState(): void {
				openingCandidate = null;
				openingPreview = null;
				openingNotice = null;
				openingCapture = null;
				endOpeningPress();
			}

			function endOpeningPress(): void {
				const current = openingPress;
				openingPress = null;
				if (current?.lease?.kind === 'granted' && current.lease.lease.active) current.lease.lease.release();
			}

			/**
			 * The visible Wall face under the pointer, not just its datum line.
			 * A 3D face is a vertical quad; intersecting its span plane and keeping the
			 * hit only inside the authored height makes a click anywhere on the face
			 * name the same host and signed offset as a click at the base.
			 */
			function openingFaceAt(
				adapterContext: StageAdapterContext,
				css: readonly [number, number],
				walls: readonly ProjectedWall[]
			): OpeningCandidate | null {
				// `css` is Stage-local; the viewport ray expects viewport coordinates.
				const ray = adapterContext.ray([
					css[0] + adapterContext.evaluation.rect.left,
					css[1] + adapterContext.evaluation.rect.top
				]);
				if (ray === null) return null;
				const datum = adapterContext.snapshot.domain.datumMeters;
				const preferredWallId = adapterContext.selectionState().primary;
				const preferred =
					preferredWallId === null
						? null
						: preferredHostOf(preferredWallId.subject.kind, preferredWallId.subject.id);
				let best: { readonly candidate: OpeningCandidate; readonly distance: number } | null = null;
				let preferredBest: { readonly candidate: OpeningCandidate; readonly distance: number } | null = null;
				for (const wall of walls) {
					const data = document.walls.find((candidate) => candidate.id === wall.id);
					if (data === undefined) continue;
					const dx = wall.end[0] - wall.start[0];
					const dz = wall.end[1] - wall.start[1];
					const length = Math.hypot(dx, dz);
					if (!(length > 0)) continue;
					const hit = adapterContext.intersect(ray, {
						originMeters: [wall.start[0], datum, wall.start[1]],
						normal: [-dz / length, 0, dx / length],
						yawRadians: Math.atan2(dx, dz),
						datumMeters: datum,
						supportedLocalExtent: null
					});
					if (hit.kind !== 'intersected') continue;
					const offset =
						((hit.worldPoint[0] - wall.start[0]) * dx +
							(hit.worldPoint[2] - wall.start[1]) * dz) /
						length;
					const y = hit.worldPoint[1];
					if (offset < 0 || offset > length || y < datum || y > datum + data.height) continue;
					const candidate = { wallId: wall.id, offset };
					if (best === null || hit.distanceMeters < best.distance) {
						best = { candidate, distance: hit.distanceMeters };
					}
					if (wall.id === preferred && (preferredBest === null || hit.distanceMeters < preferredBest.distance)) {
						preferredBest = { candidate, distance: hit.distanceMeters };
					}
				}
				return (preferredBest ?? best)?.candidate ?? null;
			}

			/** The candidate one Stage-local pointer position names, or `null`. */
			function openingCandidateAt(
				adapterContext: StageAdapterContext,
				css: readonly [number, number]
			): OpeningCandidate | null {
				const projected = projectedScene(adapterContext);
				const face = openingFaceAt(adapterContext, css, projected.walls);
				if (face !== null) return face;
				const primary = adapterContext.selectionState().primary;
				const hit = classifyOpeningHost({
					css,
					walls: projected.walls,
					preferredWallId:
						primary === null ? null : preferredHostOf(primary.subject.kind, primary.subject.id)
				});
				if (hit === null) return null;
				const wall = projected.walls.find((candidate) => candidate.id === hit.wallId);
				if (wall === undefined) return null;
				const point = pointerDatumPoint(adapterContext, css);
				if (point === null) return null;
				const offset = offsetAlongWall(wall, [point[0], point[1]]);
				return { wallId: wall.id, offset };
			}

			// New-Opening placement is **edge-positioned**: the pointer names the
			// start edge, so a slide resolver would snap a centre the creator did not
			// name (and at a non-integer width shift the edge off the pointer). Snap
			// belongs to the existing Opening slide and width marks, where the
			// resolver's centre/edge anchors are the authored gesture.

			/**
			 * A typed placement on the preferred host: empty offset centers exactly;
			 * a typed offset is used verbatim, never clamped. The planner still owns fit.
			 */
			function openingCandidateForHost(wallId: string, offsetText: string): OpeningCandidate | null {
				const span = openingSpan(wallId);
				if (span === null) {
					openingNotice = 'That Wall has no resolvable span. Repair it or select another Wall.';
					return null;
				}
				const { length } = span;
				let offset: number;
				if (offsetText.trim() === '') {
					if (openingOptions.width > length) {
						openingNotice = `A ${openingOptions.width.toFixed(2)} m ${openingOptions.kind} is wider than the ${length.toFixed(2)} m Wall. Narrow the Opening or choose another host.`;
						return null;
					}
					offset = (length - openingOptions.width) / 2;
				} else {
					const parsed = parseMeasureInput(offsetText);
					if (!parsed.ok) {
						openingNotice = `Offset: ${parsed.reason}`;
						return null;
					}
					if (parsed.value < 0) {
						openingNotice = 'Offset must be zero or greater.';
						return null;
					}
					offset = parsed.value;
				}
				return { wallId, offset };
			}

			/**
			 * Re-arm Ink after an install, on the next live evaluation.
			 *
			 * An install disposes the binding synchronously; its replacement is built on
			 * the next evaluation, so opening the task in the acceptance continuation
			 * would find no contributed task. One frame later the rebuilt task exists.
			 * The session writer generation also guards choices made on the replacement
			 * binding, including a task opened and closed before the frame runs.
			 */
			function rearmInkAfterInstall(): void {
				if (typeof window === 'undefined') return;
				const epoch = ++rearmEpoch;
				const generation = services.stage.session.writerGeneration();
				let attempts = 0;
				const open = () => {
					if (epoch !== rearmEpoch || services.stage.session.writerGeneration() !== generation ||
						services.stage.session.task() !== null) return;
					const result = services.stage.openContributedTask(LAYOUT_INK_ENTRY, 'layout');
					if (result.kind === 'refused' && result.code === 'unknown-task' && attempts < 3) {
						attempts += 1;
						window.requestAnimationFrame(open);
						return;
					}
					if (epoch !== rearmEpoch) return;
					services.stage.notifySurfaceChange();
				};
				window.requestAnimationFrame(open);
			}

			/** Install one created Opening as the selection, by id, on the fresh source. */
			function selectLayoutSubject(sourceKind: 'wall' | 'opening', sourceId: string): void {
				const fresh = services.stage.snapshot();
				services.stage.select({
					sourceId,
					sourceKind,
					generationId: fresh.compileGeneration,
					ref: {
						sourceId,
						sourceKind,
						generationId: fresh.compileGeneration,
						stream: 'projected',
						subRef: null
					}
				});
			}

			/**
			 * Accept one Opening placement exactly once.
			 *
			 * The preview's capture is the accepted intent's capture; a refusal leaves
			 * the candidate editable and writes no source.
			 */
			async function commitOpening(target: OpeningCandidate | null = openingCandidate): Promise<void> {
				if (openingCommitInFlight || target === null || inkReading !== 'opening') return;
				if (!openingOptionsValid) {
					openingNotice = 'Check the Opening Width, Height and Sill before placing.';
					services.stage.notifySurfaceChange();
					publishInk();
					return;
				}
				const preview = planOpeningCandidate(target);
				openingPreview = preview;
				if (preview.kind === 'refused') {
					openingNotice = preview.message;
					services.stage.notifySurfaceChange();
					publishInk();
					return;
				}
				openingCommitInFlight = true;
				const taskChoice = services.stage.session.taskChoiceGeneration();
				try {
					const capture = openingCapture ?? mintLayoutIdCapture();
					openingCapture = capture;
					const snapshot = services.stage.snapshot();
					const payload: OpeningCreatePayload = {
						wallId: target.wallId,
						kind: openingOptions.kind,
						offset: target.offset,
						width: openingOptions.width,
						height: openingOptions.height,
						sillHeight: openingOptions.sillHeight
					};
					const outcome = await services.authoring.accept(
						openingCreateIntent({
							payload,
							capture,
							operationId: globalThis.crypto.randomUUID(),
							projectId: snapshot.acceptedRevision.projectId,
							revisionId: services.authoring.acceptedRevision().revisionId,
							contentRevision: stageUnitRevision(snapshot, 'layout'),
							levelId: snapshot.domain.layoutLevelId
						})
					);
					if (outcome.kind === 'refused') {
						openingNotice = outcome.message;
						services.stage.notifySurfaceChange();
						publishInk();
						return;
					}
					const shouldRearm = services.stage.session.taskChoiceGeneration() === taskChoice &&
						services.stage.session.task() === null;
					const openingId = preview.openingId;
					clearOpeningState();
					selectLayoutSubject('opening', openingId);
					// The install replaced the binding; re-arm Ink on the next evaluation
					// against the installed source, on the remembered Opening reading.
					if (shouldRearm) rearmInkAfterInstall();
					services.stage.notifySurfaceChange();
				} finally {
					openingCommitInFlight = false;
				}
			}

			/** The Opening half of the pointer contract. */
			function openingPointer(
				intent: StagePointerIntent,
				adapterContext: StageAdapterContext
			): boolean {
				if (intent.phase === 'down') {
					if (!openingOptionsValid) {
						openingNotice = 'Check the Opening Width, Height and Sill before placing.';
						setOpeningCandidate(null);
						services.stage.notifySurfaceChange();
						publishInk();
						return true;
					}
					const candidate = openingCandidateAt(adapterContext, intent.css);
					if (candidate === null) {
						openingNotice = 'Aim at a Wall face to place an Opening; the Stage is not a free host.';
						setOpeningCandidate(null);
						services.stage.notifySurfaceChange();
						publishInk();
						return true;
					}
					const acquisition = services.stage.acquireGesture({
						owner: LAYOUT_INK_TASK,
						evaluationId: intent.evaluationId,
						policy: 'cancel-on-reading-change'
					});
					if (acquisition.kind !== 'granted') {
						openingNotice = `The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`;
						publishInk();
						return false;
					}
					openingPress = {
						evaluationId: intent.evaluationId,
						lease: acquisition,
						css: intent.css
					};
					setOpeningCandidate(candidate);
					services.stage.notifySurfaceChange();
					publishInk();
					return true;
				}
				const current = openingPress;
				if (current === null) return false;
				if (intent.phase === 'cancel' || intent.evaluationId !== current.evaluationId) {
					endOpeningPress();
					setOpeningCandidate(null);
					openingNotice =
						intent.phase === 'cancel' ? null : 'The reading changed; aim again on the Wall.';
					services.stage.notifySurfaceChange();
					publishInk();
					return true;
				}
				if (intent.phase === 'move') {
					const candidate = openingCandidateAt(adapterContext, intent.css);
					if (candidate === null) {
						openingNotice = 'Aim at a Wall face to place an Opening.';
						setOpeningCandidate(null);
					} else {
						setOpeningCandidate(candidate);
					}
					services.stage.notifySurfaceChange();
					publishInk();
					return true;
				}
				// Release: one click commits the candidate under the pointer, once.
				const rawRelease = openingCandidateAt(adapterContext, intent.css);
				endOpeningPress();
				if (rawRelease === null) {
					openingNotice = 'Aim at a Wall face to place an Opening.';
					setOpeningCandidate(null);
				} else {
					setOpeningCandidate(rawRelease);
					void commitOpening(rawRelease);
				}
				services.stage.notifySurfaceChange();
				publishInk();
				return true;
			}

			/** Preview the candidate under an unpressed hover; never claims the move. */
			function openingHover(
				intent: StagePointerIntent,
				adapterContext: StageAdapterContext
			): boolean {
				if (openTaskKind !== LAYOUT_INK_TASK || inkReading !== 'opening' || intent.phase !== 'move') {
					return false;
				}
				const candidate = openingCandidateAt(adapterContext, intent.css);
				if (candidate?.wallId === openingCandidate?.wallId && candidate?.offset === openingCandidate?.offset) {
					return true;
				}
				setOpeningCandidate(candidate);
				services.stage.notifySurfaceChange();
				publishInk();
				return true;
			}

			/**
			 * Whether rounding a free point would land it on an existing Junction or
			 * Wall centerline.
			 *
			 * A free target that silently becomes a contact is an undeclared
			 * connection: the chain policy refuses `unconnected_interior_contact` (or a
			 * crossing) even though the creator aimed at open floor. The deliberate
			 * target must stay the creator's aim, so such a point keeps its raw
			 * coordinate rather than inventing a connection the drawing did not name.
			 */
			function freePointWouldCreateContact(
				point: readonly [number, number],
				projected: ReturnType<typeof projectedScene>
			): boolean {
				const tolerance = 1e-6;
				if (
					projected.junctions.some(
						(junction) =>
							Math.hypot(junction.point[0] - point[0], junction.point[1] - point[1]) <=
							tolerance
					)
				) {
					return true;
				}
				return projected.walls.some((wall) => {
					const onCenterline = pointOnWallCenterline(wall, [point[0], point[1]]);
					return (
						Math.hypot(onCenterline[0] - point[0], onCenterline[1] - point[1]) <=
						tolerance
					);
				});
			}

			/**
			 * The deliberate target one Stage-local pointer position names, in world
			 * coordinates. `null` when the working plane cannot be resolved there.
			 */
			function inkTargetAt(
				adapterContext: StageAdapterContext,
				css: readonly [number, number]
			): InkPointerTarget | null {
				const projected = projectedScene(adapterContext);
				const hit = classifyInkPointerTarget({ css, junctions: projected.junctions, walls: projected.walls });
				if (hit?.kind === 'junction') {
					const junction = projected.junctions.find((candidate) => candidate.id === hit.junctionId);
					if (junction === undefined) return null;
					inkSnapWinner = { point: junction.point, kind: 'junction', name: 'Junction' };
					return { target: hit, point: junction.point, css };
				}
				const point = pointerDatumPoint(adapterContext, css);
				if (point === null) return null;
				if (hit?.kind === 'host') {
					const wall = projected.walls.find((candidate) => candidate.id === hit.wallId);
					if (wall === undefined) return null;
					// The split lands where the creator aimed: the pointer projected onto
					// that Wall's centerline, never the cursor's raw plane point.
					const split = pointOnWallCenterline(wall, [point[0], point[1]]);
					inkSnapWinner = { point: split, kind: 'wall-span', name: 'Wall', wallId: wall.id };
					return { target: hit, point: split, css };
				}
				// Free placement asks the one Layout snap resolver. Junction and host
				// targets above keep precedence, so snap can never move a connection off
				// the subject the creator deliberately aimed at. The inverse is guarded
				// too: a grid point that would land on an existing Junction or Wall keeps
				// the creator's raw aim instead of authoring an undeclared contact.
				const drafting = adapterContext.drafting();
				const winner = resolveInkPointSnap({
					geometry: adapterContext.snapshot.domain.geometry,
					point: [point[0], point[1]],
					pixelsPerMeter: 1 / adapterContext.evaluation.targetPlaneMetersPerCssPixel,
					anchor: linePreviewBase().points.at(-1)?.point ?? null,
					drafting
				});
				if (winner !== null) {
					if (winner.kind === 'junction') {
						const junction = projected.junctions.find(
							(candidate) =>
								Math.hypot(candidate.point[0] - winner.point[0], candidate.point[1] - winner.point[1]) <= 1e-9
						);
						if (junction !== undefined) {
							inkSnapWinner = winner;
							return { target: { kind: 'junction', junctionId: junction.id }, point: junction.point, css };
						}
					}
					if (winner.kind === 'wall-span' && winner.wallId !== undefined) {
						const wall = projected.walls.find((candidate) => candidate.id === winner.wallId);
						if (wall !== undefined) {
							inkSnapWinner = winner;
							return { target: { kind: 'host', wallId: wall.id }, point: winner.point, css };
						}
					}
					if (freePointWouldCreateContact(winner.point, projected)) {
						inkSnapWinner = null;
						return { target: { kind: 'free' }, point: [point[0], point[1]], css };
					}
					inkSnapWinner = winner;
					return { target: { kind: 'free' }, point: winner.point, css };
				}
				inkSnapWinner = null;
				return { target: { kind: 'free' }, point: [point[0], point[1]], css };
			}

			/** The transient press anchor follows the same start rule as dragInkWall.
			 * It never appends to the deliberate click chain before release. */
			function linePreviewBase(): ChainDraft {
				if (!inkPress?.dragging) return draft;
				const pressed = inkPress.pressTarget;
				const start: ChainDraftPoint = { point: pressed.point, target: pressed.target };
				const tip = draft.points.at(-1);
				if (tip?.point[0] === start.point[0] && tip?.point[1] === start.point[1]) return draft;
				if (draft.points.length === 0) return { points: [start], closed: false };
				if (isDraftStart(draft, start.point, 1e-9) && draft.points.length >= 2) return { points: draft.points, closed: true };
				const begun = appendChainPoint(draft, start);
				return 'points' in begun ? begun : draft;
			}

			function linePreviewDraft(): ChainDraft {
				const base = linePreviewBase();
				if (base.closed || inkHover === null) return base;
				const extended = appendChainPoint(base, { point: inkHover.point, target: inkHover.target });
				return 'points' in extended ? extended : base;
			}

			/** Re-plan the draft (with the hover point, when there is one). */
			function refreshInkPreview(): void {
				if (inkHover === null) inkSnapWinner = null;
				// A contributed reading owns its own preview; this binding's Wall chain
				// planner must never speak for it.
				if (inkReading !== 'wall' && inkReading !== 'opening') {
					inkPreview = null;
					inkNotice = null;
					return;
				}
				if (inkReading === 'wall' && inkWallMode === 'box') {
					// Box previews the very ring its release commits. With no second corner
					// yet there is nothing to plan, and a refusal set by the last release
					// stays readable until the pointer names a new box.
					const box = boxPreviewDraft();
					inkPreview = box === null ? null : planInkDraft(box);
					if (inkPreview !== null) inkNotice = inkPreview.kind === 'refused' ? inkPreview.message : null;
					return;
				}
				const points =
					linePreviewDraft();
				if (!('points' in points)) {
					inkPreview = null;
					return;
				}
				inkPreview = planChainDraft({
					document,
					draft: points,
					capture: chainCapture ?? mintLayoutIdCapture(),
					levelId,
					...(inkThickness === null ? {} : { thickness: inkThickness }),
					...(inkHeight === null ? {} : { height: inkHeight })
				});
				// A refusal is only words for the palette: the live chain is untouched.
				inkNotice =
					inkPreview.kind === 'refused' && points.points.length >= 2 ? inkPreview.message : null;
			}

			/** One planner pass over a draft at the remembered thickness and height. */
			function planInkDraft(target: ChainDraft): ChainPlanPreview {
				return planChainDraft({
					document,
					draft: target,
					capture: chainCapture ?? mintLayoutIdCapture(),
					levelId,
					...(inkThickness === null ? {} : { thickness: inkThickness }),
					...(inkHeight === null ? {} : { height: inkHeight })
				});
			}

			/**
			 * Box's first corner: the one a tap already placed, or the corner the live
			 * press landed on (press-drag-release names both corners in one gesture).
			 */
			function boxAnchor(): ChainDraftPoint | null {
				const placed = draft.points[0];
				if (placed !== undefined) return placed;
				const pressed = inkPress?.pressTarget;
				return pressed === undefined ? null : { point: pressed.point, target: pressed.target };
			}

			/** The closed four-Wall ring the anchor and the pointer name, or `null`. */
			function boxPreviewDraft(): ChainDraft | null {
				const anchor = boxAnchor();
				if (anchor === null || inkHover === null) return null;
				const box = boxChainDraft(document, anchor, { point: inkHover.point, target: inkHover.target });
				return 'points' in box ? box : null;
			}

			/**
			 * Commit one Box through the same Wall-chain acceptance four Lines use. A
			 * degenerate box refuses in words and writes nothing; a tapped first corner
			 * stays so the creator can name another opposite corner.
			 */
			function commitBox(first: ChainDraftPoint, opposite: ChainDraftPoint): void {
				const box = boxChainDraft(document, first, opposite);
				if (!('points' in box)) {
					inkNotice = box.message;
					return;
				}
				void commitChain(box);
			}

			/** Layout's built-in readings, then every contributed reading in host order. */
			function paletteReadings(): readonly InkPaletteReading[] {
				return [
					{ id: 'wall', label: 'Wall', summary: 'Straight Wall chain.' },
					{
						id: 'opening',
						label: 'Opening',
						summary: 'A straight door or window on one Wall face.'
					},
					...services.stage.inkReadings().map((reading) => ({
						id: reading.id,
						label: reading.label,
						summary: reading.summary
					}))
				];
			}

			function snapshotForPalette(): InkPaletteSnapshot {
				const boxMode = inkReading === 'wall' && inkWallMode === 'box';
				const withHover =
					linePreviewDraft();
				const effective = boxMode ? boxPreviewDraft() ?? draft : 'points' in withHover ? withHover : draft;
				const pending =
					inkHover === null || boxMode ? null : pendingLegFacts(linePreviewBase(), inkHover.point);
				const anchor = boxMode ? boxAnchor() : null;
				const box =
					anchor === null || inkHover === null
						? null
						: {
								width: Math.abs(inkHover.point[0] - anchor.point[0]),
								depth: Math.abs(inkHover.point[1] - anchor.point[1])
							};
				const selection = services.stage.selection();
				const selectedHostId = selection === null ? null : preferredHostOf(selection.sourceKind, selection.sourceId);
				const hostId = openingCandidate?.wallId ?? selectedHostId;
				return {
					reading: inkReading,
					wallMode: inkWallMode,
					box,
					readings: paletteReadings(),
					opening:
						inkReading !== 'opening'
							? null
							: {
									hostId,
									selectedHostId,
									offset: openingCandidate?.offset ?? null,
									width: openingOptions.width,
									height: openingOptions.height,
									sillHeight: openingOptions.sillHeight,
									kind: openingOptions.kind,
									canPlace: openingPreview?.kind === 'planned',
									refusal:
										openingNotice ??
										(openingPreview?.kind === 'refused' ? openingPreview.message : null)
								}
					,
					points: effective.points.map((entry) => [entry.point[0], entry.point[1]] as LayoutVec2),
					closed: effective.closed,
					canFinish: !boxMode && draft.points.length >= 2,
					canClose: !boxMode && draft.points.length >= 3 && !draft.closed,
					canBacktrack: draft.points.length > 0,
					consequence:
						inkPreview !== null && inkPreview.kind === 'planned' && effective.points.length >= 2
							? inkPreview.consequence.summary
							: null,
					pending,
					refusal: inkNotice
				};
			}

			/** Begin the live chain: one capture and one proposal lease per operation. */
			function beginChain(point: ChainDraftPoint): void {
				draft = { points: [point], closed: false };
				chainCapture = mintLayoutIdCapture();
				inkProposal?.release();
				inkProposal = services.stage.session.registerProposal({
					owner: LAYOUT_INK_TASK,
					reason: 'A Wall chain is live; finish it or cancel it — Undo is available once it settles.'
				});
				inkNotice = null;
				refreshInkPreview();
				publishInk();
			}

			/** Drop the live chain's last point, keeping the operation alive while any remain. */
			function backtrackChain(): void {
				draft = backtrackChainPoint(draft);
				if (draft.points.length === 0) {
					inkProposal?.release();
					inkProposal = null;
					chainCapture = null;
				}
				inkNotice = null;
				refreshInkPreview();
				publishInk();
			}

			/** Drop the live chain and its proposal, exactly once. */
			function clearChain(): void {
				draft = EMPTY_CHAIN_DRAFT;
				chainCapture = null;
				inkHover = null;
				inkSnapWinner = null;
				inkPreview = null;
				inkNotice = null;
				inkProposal?.release();
				inkProposal = null;
				publishInk();
			}

			/** The chapter the palette reads: the live binding's own state. */
			function publishInk(): void {
				if (openTaskKind !== LAYOUT_INK_TASK) {
					publishInkSurface(null);
					return;
				}
				const controller: InkController = {
					setReading: (next) => {
						if (next === inkReading) return;
						if (!paletteReadings().some((reading) => reading.id === next)) {
							inkNotice = 'That reading is not available in this project.';
							publishInk();
							return;
						}
						if (draft.points.length > 0) {
							inkNotice = 'Finish or cancel the Wall chain before switching readings.';
							publishInk();
							return;
						}
						// A contributed reading owns live input too; a switch must not
						// silently throw away a half-drawn outline or a chosen depth.
						if (contributedSession?.session.hasWork?.() === true) {
							inkNotice = 'Finish or cancel the live reading before switching readings.';
							publishInk();
							return;
						}
						// A contributed reading's session lives only while it is selected.
						endContributedSession();
						inkReading = next;
						inkNotice = null;
						// The palette remounts from the last valid options on the next Opening
						// reading, so its fields and the adapter agree again.
						if (next === 'opening') openingOptionsValid = true;
						clearOpeningState();
						inkHover = null;
						if (next === 'wall') refreshInkPreview();
						else if (next !== 'opening') ensureContributedSession();
						services.stage.notifySurfaceChange();
						publishInk();
					},
					setWallMode: (mode: InkWallMode) => {
						if (mode === inkWallMode) return;
						if (draft.points.length > 0 || inkPress !== null) {
							inkNotice = 'Finish or cancel the Wall chain before switching between Line and Box.';
							publishInk();
							return;
						}
						inkWallMode = mode;
						inkNotice = null;
						inkHover = null;
						refreshInkPreview();
						services.stage.notifySurfaceChange();
						publishInk();
					},
					setOpeningOptions: (options) => {
						openingOptionsValid = options !== null;
						if (options !== null) openingOptions = options;
						if (openingCandidate !== null) refreshOpeningPreview();
						services.stage.notifySurfaceChange();
						publishInk();
					},
					placeOpening: (offsetText) => {
						const selection = services.stage.selection();
						const hostId = selection === null ? null : preferredHostOf(selection.sourceKind, selection.sourceId);
						if (hostId === null) {
							openingNotice = 'Select a Wall — or one of its Openings — before placing by offset.';
							publishInk();
							return;
						}
						const candidate = openingCandidateForHost(hostId, offsetText);
						if (candidate === null) {
							publishInk();
							return;
						}
						setOpeningCandidate(candidate);
						void commitOpening(candidate);
					},
					finish: () => void commitChain(),
					close: () => {
						const closed = closeChainDraft(draft);
						if ('points' in closed) void commitChain(closed);
						else {
							inkNotice = closed.message;
							publishInk();
						}
					},
					backtrack: () => backtrackChain(),
					cancel: () => clearChain(),
					typePoint: (xText: string, zText: string) => {
						const parsed = parsePlacementXZ(xText, zText);
						if (!parsed.ok) {
							inkNotice = parsed.reason;
							publishInk();
							return;
						}
						const next = classifyTypedChainPoint(document, parsed.point);
						appendInkPoint(next);
					},
					setOptions: (options) => {
						inkThickness = options.thickness;
						inkHeight = options.height;
						refreshInkPreview();
						publishInk();
					}
				};
				publishInkSurface({ snapshot: snapshotForPalette, controller });
			}

			/** Append one deliberate point, closing the ring when it returns to the start. */
			function appendInkPoint(next: ChainDraftPoint): void {
				if (draft.points.length === 0) {
					beginChain(next);
					return;
				}
				if (isDraftStart(draft, next.point, 1e-9) && draft.points.length >= 2) {
					void commitChain({ points: draft.points, closed: true });
					return;
				}
				const appended = appendChainPoint(draft, next);
				if (!('points' in appended)) {
					inkNotice = appended.message;
					publishInk();
					return;
				}
				draft = appended;
				inkNotice = null;
				inkHover = null;
				refreshInkPreview();
				publishInk();
			}

			/**
			 * A drag names one Wall: the point the press landed on **and** the point it was
			 * released on, accepted in one step.
			 *
			 * Recording only the release left a fresh chain a single point long, which the
			 * planner correctly refuses as an insufficient chain — so the primary gesture
			 * could not draw a Wall at all. The **press's own** target is the one kept: a
			 * move may have hovered elsewhere since, and a drag that starts on a Junction
			 * or on a Wall's interior declares that connection exactly as a tap does.
			 */
			function dragInkWall(press: InkPointerTarget, release: InkPointerTarget): void {
				const start: ChainDraftPoint = { point: press.point, target: press.target };
				const tip = draft.points[draft.points.length - 1];
				const continuesFromTip =
					tip !== undefined && tip.point[0] === start.point[0] && tip.point[1] === start.point[1];
				if (!continuesFromTip) {
					if (draft.points.length === 0) {
						// The chain's first point: one capture and one live proposal, exactly as
						// the first tap of a chain begins it.
						beginChain(start);
					} else if (isDraftStart(draft, start.point, 1e-9) && draft.points.length >= 2) {
						// The press landed on the chain's own first vertex: that is the enclosure
						// gesture, and the release is its finish.
						void commitChain({ points: draft.points, closed: true });
						return;
					} else {
						const begun = appendChainPoint(draft, start);
						if (!('points' in begun)) {
							inkNotice = begun.message;
							return;
						}
						draft = begun;
					}
				}
				const appended = appendChainPoint(draft, { point: release.point, target: release.target });
				if (!('points' in appended)) {
					inkNotice = appended.message;
					return;
				}
				draft = appended;
				void commitChain(appended);
			}

			/**
			 * Accept the whole chain once.
			 *
			 * Preview and acceptance run the **same** captured input: the draft's own
			 * points and declarations with one identity capture, so what the creator
			 * saw is what the planner commits. A refusal leaves the live chain editable
			 * and writes no partial source.
			 */
			async function commitChain(override?: ChainDraft): Promise<void> {
				// One chain, one acceptance. A second activation of the same command (a
				// focused Finish button activated by the very keydown the host maps) is the
				// same creator intent, not a second operation.
				if (chainCommitInFlight) return;
				const target = override ?? draft;
				if (target.points.length < 2) {
					inkNotice = 'A chain needs at least two points.';
					publishInk();
					return;
				}
				chainCommitInFlight = true;
				try {
					await commitChainOnce(target);
				} finally {
					chainCommitInFlight = false;
				}
			}

			/** The one acceptance pass; `commitChain` owns the in-flight guard. */
			async function commitChainOnce(target: ChainDraft): Promise<void> {
				const capture = chainCapture ?? mintLayoutIdCapture();
				const request = chainPlanRequest(target);
				const payload = {
					points: request.points,
					close: request.close,
					junctionSnaps: request.endpointJunctionSnaps,
					hostSnaps: request.endpointHostSnaps,
					thickness: inkThickness,
					height: inkHeight
				};
				const planned = planChainDraft({
					document,
					draft: target,
					capture,
					levelId,
					...(inkThickness === null ? {} : { thickness: inkThickness }),
					...(inkHeight === null ? {} : { height: inkHeight })
				});
				if (planned.kind === 'refused') {
					// Refused in words, with a repair: the chain stays exactly as it was and
					// no source is written.
					inkNotice = planned.message;
					publishInk();
					return;
				}
				const snapshot = services.stage.snapshot();
				const outcome = await services.authoring.accept(
					wallChainCommitIntent({
						payload,
						capture,
						operationId: globalThis.crypto.randomUUID(),
						projectId: snapshot.acceptedRevision.projectId,
						revisionId: services.authoring.acceptedRevision().revisionId,
						contentRevision: stageUnitRevision(snapshot, 'layout'),
						levelId: snapshot.domain.layoutLevelId
					})
				);
				if (outcome.kind === 'refused') {
					inkNotice = outcome.message;
					publishInk();
					return;
				}
				const lastWallId =
					planned.authoredWallIds[planned.authoredWallIds.length - 1] ??
					planned.createdWallIds[planned.createdWallIds.length - 1] ??
					null;
				clearChain();
				// Accept the whole chain once and select the last created Wall; Ink stays
				// armed. A content install closes the active task, so the tool is re-armed
				// against the **new** source — its ids and generation are read after the
				// install, never from the binding the commit started in.
				const fresh = services.stage.snapshot();
				if (lastWallId !== null) {
					services.stage.select({
						sourceId: lastWallId,
						sourceKind: 'wall',
						generationId: fresh.compileGeneration,
						ref: {
							sourceId: lastWallId,
							sourceKind: 'wall',
							generationId: fresh.compileGeneration,
							stream: 'projected',
							subRef: null
						}
					});
				}
				services.stage.openContributedTask(LAYOUT_INK_ENTRY, 'layout');
				services.stage.notifySurfaceChange();
			}

			function endInkPress(): void {
				const current = inkPress;
				inkPress = null;
				if (current?.lease?.kind === 'granted' && current.lease.lease.active) current.lease.lease.release();
			}

			/** The Ink half of the pointer contract. */
			function inkPointer(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {
				if (intent.phase === 'down') {
					const target = inkTargetAt(adapterContext, intent.css);
					if (target === null) {
						inkNotice = 'That press does not land on the working plane.';
						publishInk();
						return false;
					}
					const acquisition = services.stage.acquireGesture({
						owner: LAYOUT_INK_TASK,
						evaluationId: intent.evaluationId,
						policy: 'cancel-on-reading-change'
					});
					if (acquisition.kind !== 'granted') {
						inkNotice = `The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`;
						publishInk();
						return false;
					}
					inkPress = {
						origin: intent.css,
						evaluationId: intent.evaluationId,
						lease: acquisition,
						pressTarget: target,
						hover: target,
						dragging: false
					};
					inkHover = target;
					refreshInkPreview();
					services.stage.notifySurfaceChange();
					publishInk();
					return true;
				}
				const current = inkPress;
				if (current === null) return false;
				if (intent.phase === 'cancel') {
					endInkPress();
					inkHover = null;
					refreshInkPreview();
					services.stage.notifySurfaceChange();
					publishInk();
					return true;
				}
				if (intent.evaluationId !== current.evaluationId) {
					// Reading flip: the press was measured in a projection that no longer
					// describes what is drawn. End the press and keep the live chain.
					endInkPress();
					inkHover = null;
					refreshInkPreview();
					services.stage.notifySurfaceChange();
					publishInk();
					return true;
				}
				if (intent.phase === 'move') {
					current.dragging = Math.hypot(intent.css[0] - current.origin[0], intent.css[1] - current.origin[1]) > 4;
					const target = inkTargetAt(adapterContext, intent.css);
					if (target !== null) {
						current.hover = target;
						inkHover = target;
					} else {
						inkHover = null;
					}
					refreshInkPreview();
					services.stage.notifySurfaceChange();
					publishInk();
					return true;
				}
				// Release: a tap names one point; a drag names a Wall — the point the press
				// landed on and the point it was released on — and finishes it.
				const release = inkTargetAt(adapterContext, intent.css) ?? current.hover;
				const travel = Math.hypot(
					intent.css[0] - current.origin[0],
					intent.css[1] - current.origin[1]
				);
				const pressTarget = current.pressTarget;
				endInkPress();
				inkHover = null;
				if (inkReading === 'wall' && inkWallMode === 'box') {
					// Box: a drag names both corners; a tap names the first corner, and the
					// next tap the opposite one.
					const releasePoint: ChainDraftPoint = { point: release.point, target: release.target };
					if (travel > 4) commitBox(draft.points[0] ?? { point: pressTarget.point, target: pressTarget.target }, releasePoint);
					else if (draft.points.length === 0) beginChain(releasePoint);
					else commitBox(draft.points[0]!, releasePoint);
				} else if (travel <= 4) appendInkPoint({ point: release.point, target: release.target });
				else dragInkWall(pressTarget, release);
				refreshInkPreview();
				services.stage.notifySurfaceChange();
				publishInk();
				return true;
			}

			/* --- Delete with consequences ------------------------------------- */

			/**
			 * The deletion disclosure for one Wall, from the canonical planner.
			 *
			 * The same call the acceptance makes, so the words the creator reads and
			 * the change that lands cannot disagree; it is a planning pass, so the
			 * answer is remembered for this (content, Wall) pair.
			 */
			function deletionPreview(wallId: string): WallDeletionPreview {
				const key = `${context.snapshot.sourceContentId}\u0000${wallId}`;
				const remembered = deletionDisclosures.get(key);
				if (remembered !== undefined) return remembered;
				const preview = planWallDeletion({
					document,
					wallId,
					capture: mintLayoutIdCapture(),
					levelId
				});
				if (deletionDisclosures.size >= 32) {
					const oldest = deletionDisclosures.keys().next().value;
					if (oldest !== undefined) deletionDisclosures.delete(oldest);
				}
				deletionDisclosures.set(key, preview);
				return preview;
			}

			const EMPTY_CANDIDATE_GEOMETRY: CandidatePaperGeometry = { polygons: [], segments: [] };
			const binding: StageAdapterBinding = {
				pick,
				hostTools: ['erase', 'measure'],
				/**
				 * The Eraser reuses the Card's own delete for a Wall or an Opening — the
				 * same planner-derived disclosure and the same one F4 entry. Every other
				 * Layout subject was already refused, in Layout's words, by the pick.
				 */
				eraseAction(hit) {
					if (hit.sourceKind !== 'wall' && hit.sourceKind !== 'opening') {
						return { kind: 'refused', message: 'That Layout subject cannot be erased.' };
					}
					const action = binding.cardActions?.({ sourceId: hit.sourceId, sourceKind: hit.sourceKind, ref: null })
						.find((candidate) => candidate.destructive === true);
					if (action === undefined) return { kind: 'refused', message: 'That Layout subject cannot be erased.' };
					// A Wall that hosts Openings or changes Rooms has consequences beyond
					// itself; its existing disclosure is read before the second click runs it.
					const preview = hit.sourceKind === 'wall' ? deletionPreview(hit.sourceId) : null;
					const confirm =
						preview?.kind === 'planned' &&
						(preview.hostedOpeningIds.length > 0 || preview.retiredRoomIds.length > 0 || preview.createdRoomIds.length > 0);
					return { kind: 'action', action, confirm };
				},
				tasks: [
					{
						id: LAYOUT_INK_TASK,
						taskKind: LAYOUT_INK_TASK,
						label: 'Ink',
						order: 0
					},
					{
						id: 'layout-place-plinth',
						taskKind: LAYOUT_PLINTH_PLACE_KIND,
						label: 'Place plinth',
						order: 10
					}
				],
				findEntries: [
					{
						id: LAYOUT_INK_ENTRY,
						taskKind: LAYOUT_INK_TASK,
						label: 'Ink · Wall',
						railFamily: 'draw',
						capability: 'layout',
						// Ink is an armable **dock** tool: it is armed from the bottom dock
						// (and found by name in the Head), not listed as an Index task.
						home: 'dock',
						slot: 'ink',
						order: 0
					},
					{
						id: LAYOUT_PLINTH_ENTRY,
						taskKind: LAYOUT_PLINTH_PLACE_KIND,
						label: 'Place plinth',
						railFamily: 'place',
						capability: 'layout',
						order: 10
					}
				],
				cardFacts(cardSubject: StageCardSubject) {
					const subject = layoutSubjectOf({
						sourceKind: cardSubject.sourceKind,
						sourceId: cardSubject.sourceId
					});
					return subject === null ? [] : factsFor(document, subject);
				},
				cardName(cardSubject: StageCardSubject) {
					const subject = layoutSubjectOf({
						sourceKind: cardSubject.sourceKind,
						sourceId: cardSubject.sourceId
					});
					// A Layout object's name is its identity, so it owns no writer.
					if (subject === null || subject.kind === 'object') return null;
					return layoutNameTarget(services, subject);
				},
				/**
				 * The Card's ordinary-field writer: the migrated Dimensions fields, in the
				 * one place Round 2 names. It is the only writer for those facts — the
				 * Dimensions task and its Find/keyboard route are retired in this cutover.
				 */
				cardWriter(cardSubject: StageCardSubject) {
					const subject = layoutSubjectOf({
						sourceKind: cardSubject.sourceKind,
						sourceId: cardSubject.sourceId
					});
					if (subject === null) return null;
					return {
						summary: subject.kind === 'wall' ? 'Wall fields' : 'Opening fields',
						view: { component: LayoutCardFields, services }
					};
				},
				/**
				 * Scoped deletes. The Wall action discloses hosted Openings and Room
				 * consequences (S02); the Opening action removes exactly that Opening and
				 * returns the host Wall to the selection.
				 */
				cardActions(cardSubject: StageCardSubject): readonly StageCardAction[] {
					if (cardSubject.sourceKind === 'opening') {
						const opening = document.openings.find((entry) => entry.id === cardSubject.sourceId);
						if (opening === undefined) {
							return [
								{
									id: 'layout-opening-delete',
									label: 'Delete Opening',
									detail: 'That Opening is no longer in the project. Select its Wall and try again.',
									destructive: true,
									run: async () => ({
										kind: 'refused',
										message: 'That Opening is no longer in the project.'
									})
								}
							];
						}
						const disclosure = planDeleteWallFirstOpening(document, opening.id);
						if (disclosure.kind === 'rejected') {
							return [
								{
									id: 'layout-opening-delete',
									label: 'Delete Opening',
									detail: openingRefusalWords(document, disclosure.rejection, {
										openingId: opening.id
									}),
									destructive: true,
									run: async () => ({ kind: 'refused', message: 'The Opening could not be deleted.' })
								}
							];
						}
						const hostWallId = opening.wallId;
						return [
							{
								id: 'layout-opening-delete',
								label: 'Delete Opening',
								detail: 'Removes this Opening from its Wall in one undo step.',
								destructive: true,
								run: async () => {
									const capture = mintLayoutIdCapture();
									const snapshot = services.stage.snapshot();
									const outcome = await services.authoring.accept(
										openingDeleteIntent({
											openingId: opening.id,
											capture,
											operationId: globalThis.crypto.randomUUID(),
											projectId: snapshot.acceptedRevision.projectId,
											revisionId: services.authoring.acceptedRevision().revisionId,
											contentRevision: stageUnitRevision(snapshot, 'layout'),
											levelId: snapshot.domain.layoutLevelId
										})
									);
									if (outcome.kind === 'refused') {
										services.stage.notifySurfaceChange();
										return { kind: 'refused', message: outcome.message };
									}
									selectLayoutSubject('wall', hostWallId);
									services.stage.notifySurfaceChange();
									return outcome.kind === 'no-op'
										? { kind: 'no-op', message: 'The Opening was already gone.' }
										: { kind: 'accepted' };
								}
							}
						];
					}
					if (cardSubject.sourceKind !== 'wall') return [];
					const wallId = cardSubject.sourceId;
					const preview = deletionPreview(wallId);
					if (preview.kind === 'refused') {
						return [
							{
								id: 'layout-wall-delete',
								label: 'Delete Wall',
								detail: preview.message,
								destructive: true,
								run: async () => ({ kind: 'refused', message: preview.message })
							}
						];
					}
					return [
						{
							id: 'layout-wall-delete',
							label: 'Delete Wall',
							detail: preview.summary,
							destructive: true,
							run: async () => {
								const capture = mintLayoutIdCapture();
								const snapshot = services.stage.snapshot();
								const outcome = await services.authoring.accept(
									wallDeleteIntent({
										wallId,
										capture,
										operationId: globalThis.crypto.randomUUID(),
										projectId: snapshot.acceptedRevision.projectId,
										revisionId: services.authoring.acceptedRevision().revisionId,
										contentRevision: stageUnitRevision(snapshot, 'layout'),
										levelId: snapshot.domain.layoutLevelId
									})
								);
								services.stage.notifySurfaceChange();
								if (outcome.kind === 'refused') {
									return { kind: 'refused', message: outcome.message };
								}
								return outcome.kind === 'no-op'
									? { kind: 'no-op', message: 'The Wall was already gone.' }
									: { kind: 'accepted' };
							}
						}
					];
				},
				/**
				 * The command keys drawing owns while Ink is armed.
			 *
				 * `finish` and `backtrack` are the same two commands the palette's controls
				 * run (one live chain, one state machine), and `cancel` is the palette-first
				 * **Escape**: the chain ends here, before the host's unwind disarms the tool,
				 * so no hidden proposal can survive as an invisible block on history. A key
				 * the live chain has nothing to say about is refused, not swallowed.
				 */
				keyIntent(intent: StageKeyboardIntent, adapterContext: StageAdapterContext): boolean {
					if (openTaskKind !== LAYOUT_INK_TASK) {
						// Direct manipulation has no task, but its press is a writer: typing
						// freezes the pointer candidate and opens numeric entry, Enter commits
						// once, and Esc discards without a document change or history entry.
						const active = gesture ?? openingGesture;
						if (active === null) return false;
						if (intent.kind === 'type') {
							if (intent.key === '\t') {
								if (active.numeric === null) return false;
								const target = gestureNumericTarget();
								if (target === null) return false;
								const next = planNumericEntryTab(active.numeric, 'forward', target.candidates);
								if (gesture !== null) gesture.numeric = next;
								else if (openingGesture !== null) openingGesture.numeric = next;
								services.stage.notifySurfaceChange();
								return true;
							}
							return active.numeric === null ? openGestureNumeric(intent.key) : growGestureNumeric(intent.key);
						}
						if (intent.kind === 'finish') return active.numeric === null ? false : submitGestureNumeric();
						if (intent.kind === 'backtrack') {
							if (active.numeric === null) return false;
							const next = active.numeric.text.length <= 1 ? null : planNumericEntryInput(active.numeric, active.numeric.text.slice(0, -1));
							if (gesture !== null) gesture.numeric = next;
							else if (openingGesture !== null) openingGesture.numeric = next;
							services.stage.notifySurfaceChange();
							return true;
						}
						// First Esc restores the transient pointer value and keeps the writer;
						// the next Esc cancels the gesture. Neither writes source or history.
						if (active.numeric !== null) {
							if (gesture !== null) gesture.numeric = null;
							else if (openingGesture !== null) openingGesture.numeric = null;
							services.stage.notifySurfaceChange();
							return true;
						}
						refusal = null;
						endGesture();
						endOpeningGesture();
						services.stage.notifySurfaceChange();
						return true;
					}
					if (inkReading !== 'wall' && inkReading !== 'opening') {
						const session = ensureContributedSession();
						if (session === null) return false;
						const claimed = session.key?.(intent, adapterContext) ?? false;
						publishInk();
						return claimed;
					}
					switch (intent.kind) {
						case 'finish':
							if (draft.points.length < 2) return false;
							void commitChain();
							return true;
						case 'backtrack':
							if (draft.points.length === 0) return false;
							backtrackChain();
							return true;
						case 'cancel':
							if (draft.points.length === 0) return false;
							clearChain();
							return true;
						default:
							return false;
					}
				},
				/**
				 * The pointer half of Wall manipulation **and** of drawing.
				 *
				 * With Ink armed this claims the press for the chain. Without a contributed
				 * task the facade offers the press here too (`pressWhenNoTask`), because a
				 * selected Wall's handles are direct manipulation, not a task: a press that
				 * is not on a handle is refused and falls through to navigation.
				 */
				pressWhenNoTask: true,
				/** The one mark vocabulary: Stage admits, projects, hit-tests and draws. */
				handles(adapterContext: StageAdapterContext) {
					return markDescriptors(adapterContext);
				},
				/**
				 * The Height Sheet's found surfaces this domain owns: the floor datum and
				 * the tops of solid Layout objects. Layout deliberately does not special-case
				 * a plinth preset id — a plinth is an ordinary box, and any box/cylinder
				 * top is a real surface a creator can snap to. Heights are datum-relative.
				 */
				heightTicks(): readonly StageHeightTick[] {
					const datum = context.snapshot.domain.datumMeters;
					const ticks: StageHeightTick[] = [{ kind: 'datum', heightMeters: 0, label: 'Floor' }];
					for (const object of document.objects) {
						if (object.kind !== 'box' && object.kind !== 'cylinder') continue;
						// A top tilted away from horizontal is not a surface the Plan cut can
						// snap to; the owner publishes only its real horizontal tops.
						if (Math.abs(object.rotation[0]) > 1e-6 || Math.abs(object.rotation[2]) > 1e-6) continue;
						const top = object.position[1] + object.dimensions[1] / 2;
						const heightMeters = top - datum;
						if (!Number.isFinite(heightMeters) || heightMeters <= 0) continue;
						ticks.push({
							kind: 'found',
							heightMeters,
							label: `${object.kind === 'box' ? 'Box' : 'Cylinder'} ${object.id}`
						});
					}
					return ticks;
				},
				hoverIntent(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {
					if (openTaskKind !== LAYOUT_INK_TASK) return false;
					if (inkReading !== 'wall' && inkReading !== 'opening') {
						const session = ensureContributedSession();
						if (session === null) return false;
						const claimed = session.hover?.(intent, adapterContext) ?? false;
						if (claimed) publishInk();
						return claimed;
					}
					if (inkReading === 'opening') return openingHover(intent, adapterContext);
					// A Wall-reading hover updates the live chain. It never claims a move:
					// the host's navigation gesture and the next press stay the host's.
					if (intent.phase !== 'move') return false;
					inkHover = inkTargetAt(adapterContext, intent.css);
					refreshInkPreview();
					services.stage.notifySurfaceChange();
					publishInk();
					return true;
				},
				pointerIntent(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {
					if (openTaskKind === LAYOUT_INK_TASK && inkReading !== 'wall' && inkReading !== 'opening') {
						const session = ensureContributedSession();
						if (session === null) {
							inkNotice = 'That reading is not available in this project.';
							publishInk();
							return false;
						}
						const claimed = session.pointer(intent, adapterContext);
						publishInk();
						return claimed;
					}
					if (openTaskKind === LAYOUT_INK_TASK && inkReading === 'opening') {
						return openingPointer(intent, adapterContext);
					}
					if (openTaskKind === LAYOUT_INK_TASK) return inkPointer(intent, adapterContext);
					if (openTaskKind !== null) return false;

					if (intent.phase === 'down') {
						if (gesture !== null) endGesture();
						if (openingGesture !== null) endOpeningGesture();
					pausedProposal = null;
					// A new gesture supersedes the previous paused value for this source.
					clearPausedProposalsForSource(adapterContext.snapshot.domain.unitRevisions.layout);
					refusal = null;
					settledRefusal = null;
					const selected = selectedWall(adapterContext);
						const selectedOpeningSubject = selected === null ? selectedOpening(adapterContext) : null;
						if (selected === null && selectedOpeningSubject === null) return false;
						const descriptors = markDescriptors(adapterContext);
						let markId = intent.handleId;
						let bodyPress = false;
						if (markId === undefined) {
							// The host's resolver is the one mark-tier authority; a fallback press
							// (an older caller, a test) uses the same admitted hit areas.
							const hit = services.stage.hitMark({ css: intent.css, coarse: intent.coarse === true });
							if (hit !== null && hit.adapterId === 'layout' && hit.role === 'edit') {
								markId = hit.id;
							} else if (selected !== null) {
								// R217.S15 — a selected subject's owner may claim a press on its
								// own body. The pick is resolved once, with the same purpose a
								// click uses. S16 makes an Opening on the Wall its own winner;
								// until then Select ranks the host Wall first, so that press moves
								// the Wall.
								const picked = services.stage.resolvePick({
									css: intent.css,
									evaluationId: intent.evaluationId,
									purpose: 'select',
									tool: null,
									...(intent.coarse === undefined ? {} : { coarse: intent.coarse })
								});
								if (
									picked.kind !== 'resolved' ||
									picked.hit.sourceKind !== 'wall' ||
									picked.hit.sourceId !== selected.wallId
								) {
									return false;
								}
								bodyPress = true;
								// The fallback press is the same body writer as the move grip, so it
								// carries that mark's id: its tag, numeric entry and refusal stay visible.
								markId = 'layout-wall-move-mark';
							} else {
								return false;
							}
						}
						const descriptor = bodyPress
							? undefined
							: descriptors.find((candidate) => candidate.id === markId);
						if (!bodyPress && (descriptor === undefined || descriptor.role !== 'edit')) return false;
						const point = pointerDatumPoint(adapterContext, intent.css);
						if (point === null) return false;
						const acquisition = services.stage.acquireGesture({
							owner: 'layout-precision',
							evaluationId: intent.evaluationId,
							policy: 'cancel-on-reading-change'
						});
						if (acquisition.kind !== 'granted') {
							refusal = `The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`;
							return false;
						}
						const wallSpec = selected === null
							? null
							: bodyPress
								? { handle: 'body' as const, fixed: 'start' as const, mode: 'move' as const, host: 'wall-normal' as const, numericField: 'distance' as const }
								: wallMarkSpec(markId);
						if (selected !== null && wallSpec !== null) {
							const numericFields = planNumericFields(wallSpec.host);
							const numericField = numericFields.find((field) => field.id === wallSpec.numericField) ?? numericFields[0]!;
							const normal: readonly [number, number] = [
								-selected.frame.direction[1],
								selected.frame.direction[0]
							];
							const junctionId =
								wallSpec.mode !== 'junction'
									? null
									: wallSpec.handle === 'start'
										? selected.frame.startJunctionId
										: selected.frame.endJunctionId;
							const otherPoint =
								wallSpec.mode !== 'junction'
									? null
									: wallSpec.handle === 'start'
										? selected.frame.end
										: selected.frame.start;
							const movingPoint =
								wallSpec.mode === 'junction'
									? wallSpec.handle === 'start'
										? selected.frame.start
										: selected.frame.end
									: point;
							const nextGesture: WallGesture = {
								evaluationId: intent.evaluationId,
								markId,
								handle: wallSpec.handle,
								fixed: wallSpec.fixed,
								mode: wallSpec.mode,
								junctionId,
								otherPoint,
								normal,
								normalSign: 1,
								numericHost: wallSpec.host,
								numericField,
								numeric: null,
								baseline: stageLayout(adapterContext.snapshot),
								frame: selected.frame,
								startPoint: point,
								lease: acquisition,
								request: null,
								preview: null,
								previewDocument: null,
								neighbours: [],
								snap: null,
								pointerPoint: [point[0], point[1]],
								distance: 0,
								movingPoint
							};
							gesture = nextGesture;
							warmLayoutPlannerBaseline(nextGesture.baseline);
							services.stage.notifySurfaceChange();
							return true;
						}
						const field = openingMarkField(markId);
						if (selectedOpeningSubject === null || field === null) {
							acquisition.kind === 'granted' && acquisition.lease.release();
							return false;
						}
						const numericHost: PlanNumericHost = field === 'offset' ? 'opening-slide' : 'opening-resize';
						openingGesture = {
							evaluationId: intent.evaluationId,
							markId,
							openingId: selectedOpeningSubject.openingId,
							wallId: selectedOpeningSubject.wallId,
							frame: selectedOpeningSubject.frame,
							length: selectedOpeningSubject.length,
							offsetAtStart: selectedOpeningSubject.offset,
							widthAtStart: selectedOpeningSubject.width,
							startPoint: point,
							lease: acquisition,
							numericHost,
							numericField: planNumericFields(numericHost)[0]!,
							baseline: stageLayout(adapterContext.snapshot),
							request: null,
							snap: null,
							previewDocument: null,
							numeric: null
						};
						services.stage.notifySurfaceChange();
						return true;
					}

					if (gesture === null && openingGesture === null) return false;

					if (intent.phase === 'cancel') {
						endGesture();
						endOpeningGesture();
						services.stage.notifySurfaceChange();
						return true;
					}

					const activeEvaluation = gesture?.evaluationId ?? openingGesture!.evaluationId;
					// **Reading flip.** The pointer mapping was measured in the old
					// projection; committing it here would silently reinterpret the drag.
					// Preserve the last explicit Wall parameter, end the writer and let the
					// creator apply it deliberately from the Card or cancel it.
					if (intent.evaluationId !== activeEvaluation) {
						if (gesture !== null) preservePausedProposal(adapterContext.snapshot.domain.unitRevisions.layout);
						endGesture();
						endOpeningGesture();
						services.stage.notifySurfaceChange();
						return true;
					}

					if (intent.phase === 'move') {
						// Typing freezes the proposal: the pointer no longer rewrites the value
						// the creator is entering, and its eventual up never commits.
						if ((gesture?.numeric ?? openingGesture?.numeric ?? null) !== null) return true;
						const point = pointerDatumPoint(adapterContext, intent.css);
						if (point === null) {
							// R217.S15 — a Wall drag whose ray misses the datum keeps its last
							// preview. The creator is still holding the same press; dropping
							// the candidate on one bad sample would flash the drawing away
							// and back without naming a different value.
							if (gesture !== null) {
								services.stage.notifySurfaceChange();
								return true;
							}
							if (openingGesture !== null) {
								openingGesture.request = null;
								openingGesture.previewDocument = null;
								openingGesture.snap = null;
							}
							services.stage.notifySurfaceChange();
							return true;
						}
						if (openingGesture !== null) {
							const field = openingMarkField(openingGesture.markId)!;
							const direction = wallDirection(openingGesture.frame);
							const along = direction === null
								? 0
								: (point[0] - openingGesture.frame.start[0]) * direction[0] +
									(point[1] - openingGesture.frame.start[1]) * direction[1];
							const hostSpan = {
								segmentId: openingGesture.wallId,
								start: openingGesture.frame.start,
								end: openingGesture.frame.end
							};
							const pixelsPerMeter = 1 / adapterContext.evaluation.targetPlaneMetersPerCssPixel;
							let value: number;
							let winner: LayoutSnapWinner | null;
							if (field === 'offset') {
								const snapped = resolveOpeningSlideSnap({
									geometry: adapterContext.snapshot.domain.geometry,
									hostSpan,
									openingId: openingGesture.openingId,
									pointerCenterOffset: along,
									width: openingGesture.widthAtStart,
									pixelsPerMeter,
									drafting: adapterContext.drafting()
								});
								value = snapped.offset;
								winner = snapped.winner;
							} else {
								const snapped = resolveOpeningWidthSnap({
									geometry: adapterContext.snapshot.domain.geometry,
									hostSpan,
									openingId: openingGesture.openingId,
									pointerEdgeOffset: along,
									pixelsPerMeter,
									drafting: adapterContext.drafting()
								});
								value = Math.max(snapped.edgeOffset - openingGesture.offsetAtStart, 0.05);
								winner = snapped.winner;
							}
							openingGesture.snap = winner;
							const planned = planUpdateWallFirstOpening(
								openingGesture.baseline,
								openingGesture.openingId,
								{ [field]: value }
							);
							if (planned.kind === 'rejected') {
								openingGesture.request = null;
								openingGesture.previewDocument = null;
								refusal = planned.rejection.message;
							} else {
								openingGesture.request = { field, value };
								openingGesture.previewDocument = planned.document;
								refusal = null;
							}
							services.stage.notifySurfaceChange();
							return true;
						}
						const wallGesture = gesture!;
						const drafting = adapterContext.drafting();
						const snapActive = draftingSnapIncrementMeters(drafting) !== null;
						wallGesture.pointerPoint = [point[0], point[1]];
						let request: WallManipulationRequest;
						let winner: LayoutSnapWinner | null = null;
						let snappedPoint: readonly [number, number] = point;
						if (wallGesture.mode === 'junction') {
							const anchor = wallGesture.otherPoint;
							if (anchor === null) return true;
							const snapped = resolveJunctionPointSnap({
								geometry: adapterContext.snapshot.domain.geometry,
								point: [point[0], point[1]],
								anchor: [anchor[0], anchor[1]],
								pixelsPerMeter: 1 / adapterContext.evaluation.targetPlaneMetersPerCssPixel,
								drafting
							});
							snappedPoint = snapped?.point ?? point;
							winner = snapped;
							request = pointerWallRequest({
								handle: wallGesture.handle,
								mode: 'junction',
								frame: wallGesture.frame,
								fixed: wallGesture.fixed,
								startPoint: wallGesture.startPoint,
								point: snappedPoint
							});
							wallGesture.movingPoint = snappedPoint;
							// A press that has not left the endpoint's own cell names no move. It is
							// neither a refusal nor a proposal, so release commits nothing.
							const origin = wallGesture.handle === 'start' ? wallGesture.frame.start : wallGesture.frame.end;
							if (Math.hypot(snappedPoint[0] - origin[0], snappedPoint[1] - origin[1]) < 1e-9) {
								wallGesture.request = null;
								wallGesture.preview = null;
								wallGesture.previewDocument = null;
								wallGesture.neighbours = [];
								wallGesture.snap = null;
								refusal = null;
								services.stage.notifySurfaceChange();
								return true;
							}
						} else if (wallGesture.handle === 'body' || wallGesture.mode === 'move') {
							const rawDistance =
								(point[0] - wallGesture.startPoint[0]) * wallGesture.normal[0] +
								(point[1] - wallGesture.startPoint[1]) * wallGesture.normal[1];
							wallGesture.normalSign = rawDistance < 0 ? -1 : 1;
							const distance = snapWallDistance(rawDistance, drafting);
							wallGesture.distance = distance;
							if (distance === 0) {
								// A zero delta is not a refusal and not a proposal: the Wall has not
								// left its line, so release commits nothing.
								wallGesture.request = null;
								wallGesture.preview = null;
								wallGesture.previewDocument = null;
								wallGesture.neighbours = [];
								wallGesture.snap = null;
								refusal = null;
								services.stage.notifySurfaceChange();
								return true;
							}
							snappedPoint = [
								wallGesture.startPoint[0] + wallGesture.normal[0] * distance,
								wallGesture.startPoint[1] + wallGesture.normal[1] * distance
							];
							wallGesture.movingPoint = snappedPoint;
							request = pointerWallRequest({
								handle: 'body',
								mode: 'move',
								frame: wallGesture.frame,
								fixed: wallGesture.fixed,
								startPoint: wallGesture.startPoint,
								point: snappedPoint
							});
						} else {
							request = pointerWallRequest({
								handle: wallGesture.handle,
								mode: 'length',
								frame: wallGesture.frame,
								fixed: wallGesture.fixed,
								startPoint: wallGesture.startPoint,
								point
							});
						}
						// A pointer dragged across the fixed endpoint names no length on this
						// Wall: the planner would place the moved endpoint on the existing side,
						// mirroring the preview away from the hand. Withdraw the candidate and
						// name the refusal instead of committing a mirrored Wall.
						if (request.kind === 'length' && request.length <= 0) {
							wallGesture.request = null;
							wallGesture.preview = null;
							wallGesture.previewDocument = null;
							wallGesture.neighbours = [];
							wallGesture.snap = null;
							refusal = 'Drag the endpoint back across the fixed endpoint to name a length.';
							// T3.P03.S02: a refused sample installs no preview, so the harness must
							// see it as refused rather than as an input that never arrived.
							perfMark('wall-preview:refused', { wallId: wallGesture.frame.wallId });
							services.stage.notifySurfaceChange();
							return true;
						}
						if (request.kind === 'length') {
							const snappedLength = snapWallLength(request.length, drafting);
							if (snappedLength !== request.length) {
								request = { kind: 'length', length: snappedLength };
							}
							// The ray's own accepted length is not a proposal: a click-like sample
							// leaves the Wall and the Card untouched.
							if (Math.abs(request.length - wallGesture.frame.length) < 1e-9) {
								wallGesture.request = null;
								wallGesture.preview = null;
								wallGesture.previewDocument = null;
								wallGesture.neighbours = [];
								wallGesture.snap = null;
								refusal = null;
								services.stage.notifySurfaceChange();
								return true;
							}
							if (snapActive) {
								const fixedPoint = wallGesture.fixed === 'start' ? wallGesture.frame.start : wallGesture.frame.end;
								const sign = wallGesture.fixed === 'start' ? 1 : -1;
								winner = {
									point: [
										fixedPoint[0] + wallGesture.frame.direction[0] * snappedLength * sign,
										fixedPoint[1] + wallGesture.frame.direction[1] * snappedLength * sign
									],
									kind: 'grid',
									name: 'Grid'
								};
							}
							wallGesture.movingPoint = winner?.point ?? point;
						}
						const planned = planWallManipulation(
							wallGesture.baseline,
							wallGesture.frame.wallId,
							request,
							wallGesture.fixed
						);
						if (planned.kind === 'refused') {
							// A refused candidate is not a proposal: drop the preview so a
							// later release cannot install the last valid pose on its behalf.
							wallGesture.request = null;
							wallGesture.preview = null;
							wallGesture.previewDocument = null;
							wallGesture.neighbours = [];
							wallGesture.snap = null;
							refusal = wallRefusalWords(planned.code);
							perfMark('wall-preview:refused', { wallId: wallGesture.frame.wallId });
						} else {
							wallGesture.request = request;
							wallGesture.preview = planned.wall;
							wallGesture.previewDocument = planned.document;
							wallGesture.neighbours = planned.neighbours;
							wallGesture.snap =
								request.kind === 'move' && snapActive
									? {
											point: [
												(planned.wall.start[0] + planned.wall.end[0]) / 2,
												(planned.wall.start[1] + planned.wall.end[1]) / 2
											],
											kind: 'grid',
											name: 'Grid'
										}
									: winner;
							refusal = null;
							// The candidate is installed into the overlay here; presentation is
							// the next frame, which the harness pairs by sequence.
							perfInstall('wall-preview', { wallId: wallGesture.frame.wallId });
						}
						services.stage.notifySurfaceChange();
						return true;
					}

					// **Release.** Commit once, and only a proposal this gesture still owns.
					// Typing froze the proposal: its eventual pointer-up is consumed, the
					// writer and its lease stay live, and only Enter commits the explicit value.
					if (openingGesture?.numeric !== null && openingGesture !== null) {
						services.stage.notifySurfaceChange();
						return true;
					}
					if (gesture?.numeric !== null && gesture !== null) {
						services.stage.notifySurfaceChange();
						return true;
					}
					if (openingGesture !== null) {
						const pendingOpening = openingGesture.numeric === null ? openingGesture.request : null;
						const openingId = openingGesture.openingId;
						endOpeningGesture();
						if (pendingOpening !== null) void commitMarkOpening({ ...pendingOpening, openingId });
						services.stage.notifySurfaceChange();
						return true;
					}
					const pending = gesture!.numeric === null ? gesture!.request : null;
					const fixed = gesture!.fixed;
					const wallId = gesture!.frame.wallId;
					const refusedPoint = gesture!.pointerPoint;
					const refusedText = refusal;
					if (pending === null && refusedText !== null && refusedPoint !== null) {
						settledRefusal = {
							wallId,
							contentRevision: adapterContext.snapshot.domain.unitRevisions.layout,
							point: refusedPoint,
							text: refusedText
						};
					}
					endGesture();
					if (pending !== null) void commit(pending, fixed, wallId);
					services.stage.notifySurfaceChange();
					return true;
				},
				/**
				 * The planner's live candidate, in world coordinates. The Stage projects it
				 * once; this binding owns no second projection and no second drawing.
				 */
				candidatePreview(adapterContext) {
					return candidatePreviews(adapterContext);
				},
				overlay(adapterContext) {
					if (openTaskKind === LAYOUT_INK_TASK && inkReading !== 'wall' && inkReading !== 'opening') {
						return contributedSession?.session.overlay?.(adapterContext) ?? [];
					}
					if (openTaskKind === LAYOUT_INK_TASK && inkReading === 'opening') {
						return openingOverlay(adapterContext);
					}
					if (openTaskKind === LAYOUT_INK_TASK) return inkOverlay(adapterContext);
					if (openTaskKind !== null) return [];
					// Direct manipulation is offered only while the creator is in Select.
					// Another adapter's open task owns the pointer, so the same handles here
					// would be marks the creator cannot press.
					if (services.stage.session.task() !== null) return [];
					const selected = selectedWall(adapterContext);
					// Marks are the shared manipulation language and are drawn by the Stage
					// overlay from `handles`; these contributions are only the gesture's own
					// preview/refusal/paused evidence.
					// An Opening's marks carry its live candidate and refusal themselves.
					if (selected === null) return [];
					const points = projectWallHandles(adapterContext, selected.frame);
					if (points === null) return [];
					const activeGesture = gesture;
					const preview = activeGesture?.preview ?? null;
					if (activeGesture !== null && preview !== null && activeGesture.request !== null) {
						const css = adapterContext.project([
							preview.end[0],
							adapterContext.snapshot.domain.datumMeters,
							preview.end[1]
						]);
						return [
							...(css === null
								? []
								: [
										{
											id: 'layout-wall-preview',
											css,
											label: wallRequestLabel(activeGesture.request, activeGesture.fixed)
										}
									]),
							// Neighbours the canonical candidate reshaped: the junction this edit
							// moved is shown at each affected Wall's candidate endpoint.
							...activeGesture.neighbours.flatMap((neighbour) => {
								const marker = adapterContext.project([
									neighbour.point[0],
									adapterContext.snapshot.domain.datumMeters,
									neighbour.point[1]
								]);
								return marker === null
									? []
									: [
											{
												id: `layout-wall-neighbour-${neighbour.wallId}`,
												css: marker,
												label: `Neighbour ${neighbour.wallId} reshaped by this edit`
											}
										];
							})
						];
					}
					// The adapter-owned store is the one source: Discard (or any other
					// clear) removes the overlay marker too, rather than leaving a paused
					// value the panel no longer offers to apply.
					const paused =
						pausedProposal === null
							? null
							: pausedWallProposal(pausedProposal.sourceContentId, pausedProposal.wallId);
					return [
						...(paused === null
							? []
							: [
									{
										id: 'layout-wall-paused',
										css: points.middle,
										label: `Paused after a reading change — ${paused.label}. Resume or Discard in the selection Card, or Escape to cancel.`
									}
								]),
						...(refusal === null
							? []
							: [{ id: 'layout-wall-refusal', css: points.middle, label: refusal }])
					];
				},
				/** A contributed reading's proposed body, drawn by the one Canvas. */
				ghosts(adapterContext: StageAdapterContext) {
					if (openTaskKind !== LAYOUT_INK_TASK) return [];
					if (inkReading === 'wall' || inkReading === 'opening') return [];
					return contributedSession?.session.ghosts?.(adapterContext) ?? [];
				},
				instrument(task) {
					openTaskKind = task.kind;
					settledRefusal = null;
					if (task.kind === LAYOUT_INK_TASK) {
						const contributed = contributedReading();
						if (contributed !== null) ensureContributedSession();
						publishInk();
						return {
							summary: contributed !== null ? `Ink · ${contributed.label}` : inkReading === 'opening' ? 'Ink · Opening' : 'Ink',
							facts:
								contributed !== null
									? [
											{ label: 'Reading', value: contributed.label },
											{ label: 'Meaning', value: contributed.summary }
										]
									: inkReading === 'opening'
										? [
												{ label: 'Reading', value: 'Opening on a Wall face' },
												{
													label: 'Host',
													value: 'Aim at a Wall; a selected host wins a tie'
												}
											]
										: [
												{ label: 'Reading', value: 'Straight Wall' },
												{
													label: 'Finish',
													value: 'Enter · Close ring from the start point · Esc cancels the chain'
												}
											],
							view: { component: LayoutInkPalette, services }
						};
					}
					if (task.kind === LAYOUT_PLINTH_PLACE_KIND) {
						return {
							summary: 'Place plinth',
							facts: [
								{ label: 'Floor datum', value: `${document.floor.elevation} m` },
								{ label: 'Creates', value: 'One ordinary Layout box' }
							],
							view: { component: LayoutPlacementInstrument, services }
						};
					}
					return null;
				},
				/** Esc, task replacement and install all end the writer with no commit. */
				taskClosed() {
					rearmEpoch += 1;
					openTaskKind = null;
					settledRefusal = null;
					if (pausedProposal !== null) {
						clearPausedProposal(pausedProposal.sourceContentId, pausedProposal.wallId);
					}
					pausedProposal = null;
					refusal = null;
					endGesture();
					// Disarming the tool cancels the live chain and the Opening candidate:
					// nothing is left hidden.
					endInkPress();
					clearChain();
					clearOpeningState();
					endContributedSession();
					publishInkSurface(null);
				},
				dispose() {
					rearmEpoch += 1;
					openTaskKind = null;
					if (pausedProposal !== null) {
						clearPausedProposal(pausedProposal.sourceContentId, pausedProposal.wallId);
					}
					pausedProposal = null;
					refusal = null;
					endGesture();
					endInkPress();
					clearChain();
					clearOpeningState();
					endContributedSession();
					publishInkSurface(null);
				}
			};
			return binding;

			/** The filtered Paper drawing for one planner candidate document. */
			function candidatePaper(
				document: LayoutDocumentWallFirst,
				datumMeters: number,
				subjectIds: ReadonlySet<string>,
				affectedIds: ReadonlySet<string>
			): { readonly paper: ReturnType<typeof buildLayoutCandidatePaper> } | null {
				const result = services.stage.plan();
				if (result.kind !== 'evaluated') return null;
				return { paper: buildLayoutCandidatePaper(document, result.plan, datumMeters, subjectIds, affectedIds) };
			}

			/**
			 * The live candidate or candidates this binding proposes.
			 *
			 * Every geometry comes from the planner's candidate document through the
			 * existing compile + Paper path, filtered to the sources the operation
			 * changed. A refusal contributes no geometry: only its words, which the
			 * overlay paints at the pointer. Nothing is persisted.
			 */
			function candidatePreviews(adapterContext: StageAdapterContext): readonly StageCandidatePreview[] {
				const y = adapterContext.snapshot.domain.datumMeters;
				const world = (point: readonly [number, number], elevation = y): [number, number, number] => [point[0], elevation, point[1]];
				const snapOf = (winner: LayoutSnapWinner | null) =>
					winner === null ? undefined : { world: world(winner.point), name: winner.name };

				const activeWall = gesture;
				// The reason a refused release did not write outlives the gesture; the
				// tag stays until the next press, with no geometry and no history.
				if (
					activeWall === null &&
					settledRefusal !== null &&
					settledRefusal.contentRevision === adapterContext.snapshot.domain.unitRevisions.layout &&
					services.stage.session.task() === null &&
					selectedWall(adapterContext)?.frame.wallId === settledRefusal.wallId
				) {
					return [
						candidatePreviewOf({
							id: 'layout-candidate-wall-refused-settled',
							role: 'refused',
							geometry: { polygons: [], segments: [] },
							labels: [{ world: world(settledRefusal.point), text: settledRefusal.text }]
						})
					];
				}
				// A refused sample has no candidate; it draws one neutral dashed reach to
				// the pointer plus the human reason, never the last valid pose and never
				// the Ink hover mark. This is checked before the preview document because
				// a refusal deliberately clears it.
				if (activeWall !== null && activeWall.request === null && refusal !== null && activeWall.pointerPoint !== null) {
					const middle: LayoutVec2 = [
						(activeWall.frame.start[0] + activeWall.frame.end[0]) / 2,
						(activeWall.frame.start[1] + activeWall.frame.end[1]) / 2
					];
					return [
						candidatePreviewOf({
							id: 'layout-candidate-wall-refused',
							role: 'refused',
							geometry: { polygons: [], segments: [[world(middle), world(activeWall.pointerPoint)]] },
							labels: [{ world: world(activeWall.pointerPoint), text: refusal }]
						})
					];
				}
				// A typed value with no pointer movement has no candidate document, but its
				// tag still belongs at the press, not only on the midpoint grip.
				if (activeWall !== null && activeWall.previewDocument === null && activeWall.numeric !== null) {
					return [
						candidatePreviewOf({
							id: 'layout-candidate-wall-numeric',
							role: 'subject',
							geometry: { polygons: [], segments: [] },
							labels: [
								{
									world: world(activeWall.movingPoint),
									text: `${planNumericEntryField(activeWall.numeric).label} ${activeWall.numeric.text}`
								}
							]
						})
					];
				}
				if (activeWall !== null && activeWall.previewDocument !== null) {
					const subjectWalls = new Set([activeWall.frame.wallId]);
					const affectedWalls = new Set(activeWall.neighbours.map((neighbour) => neighbour.wallId));
					const subjectIds = new Set([...subjectWalls, ...openingIdsOnWalls(activeWall.previewDocument, subjectWalls)]);
					const affectedIds = new Set([...affectedWalls, ...openingIdsOnWalls(activeWall.previewDocument, affectedWalls)]);
					const built = candidatePaper(activeWall.previewDocument, y, subjectIds, affectedIds);
					if (built !== null) {
						return [
							candidatePreviewOf({
								id: 'layout-candidate-wall',
								role: 'subject',
								geometry: built.paper.subject,
								...(activeWall.request === null
									? {}
									: {
											labels: [
												{
													world: world(activeWall.movingPoint),
													// While numeric entry is open it is the live value: the pointer's last
												// request is frozen and must not overwrite what the creator is typing.
													text:
														activeWall.numeric !== null
															? `${planNumericEntryField(activeWall.numeric).label} ${activeWall.numeric.text}`
															: wallRequestLabel(activeWall.request, activeWall.fixed, {
																	frame: activeWall.preview ?? undefined,
																	incidentWalls: activeWall.neighbours.length + 1
																})
												}
											]
										}),
								snap: snapOf(activeWall.snap)
							}),
							...(built.paper.affected.polygons.length === 0 && built.paper.affected.segments.length === 0
								? []
								: [candidatePreviewOf({ id: 'layout-candidate-neighbours', role: 'affected', geometry: built.paper.affected })])
						];
					}
					return [];
				}
				if (activeWall !== null) return [];

				const activeOpeningMark = openingGesture;
				if (activeOpeningMark !== null && activeOpeningMark.previewDocument !== null) {
					const subjectIds = new Set([activeOpeningMark.openingId, activeOpeningMark.wallId]);
					const built = candidatePaper(activeOpeningMark.previewDocument, y, subjectIds, new Set());
					if (built !== null) {
						return [candidatePreviewOf({ id: 'layout-candidate-opening-mark', role: 'subject', geometry: built.paper.subject, snap: snapOf(activeOpeningMark.snap) })];
					}
					return [];
				}
				if (activeOpeningMark !== null) return [];

				if (inkReading === 'opening') {
					if (openingPreview?.kind === 'planned') {
						const subjectIds = new Set([openingPreview.openingId, ...openingPreview.changedWallIds]);
						const built = candidatePaper(openingPreview.document, y, subjectIds, new Set());
						if (built !== null) {
							const ghost = openingCandidate === null ? null : openingGhost(openingCandidate.wallId, openingCandidate.offset);
							return [candidatePreviewOf({
								id: 'layout-candidate-opening',
								role: 'subject',
								geometry: built.paper.subject,
								labels: ghost === null ? [] : [{ world: world(ghost[1]), text: `Width ${openingOptions.width.toFixed(3)} m` }]
							})];
						}
					}
					const refusedWords =
						openingNotice ?? (openingPreview?.kind === 'refused' ? openingPreview.message : null);
					if (openingCandidate !== null && refusedWords !== null) {
						const ghost = openingGhost(openingCandidate.wallId, openingCandidate.offset);
						return [candidatePreviewOf({
							id: 'layout-candidate-opening-refused',
							role: 'refused',
							geometry: EMPTY_CANDIDATE_GEOMETRY,
							...(ghost === null ? {} : { labels: [{ world: world(ghost[0]), text: refusedWords }] })
						})];
					}
					return [];
				}

				// Wall chain / Box, including the cursor point before a plan exists.
				const boxMode = inkWallMode === 'box';
				const live = boxMode
					? boxPreviewDraft() ?? draft
					: linePreviewDraft();
				const points = 'points' in live ? live.points : draft.points;
				if (inkPreview?.kind === 'planned') {
					const subjectIds = new Set([...inkPreview.authoredWallIds, ...inkPreview.createdRoomIds]);
					const affectedIds = new Set(inkPreview.splitWallIds);
					const built = candidatePaper(inkPreview.document, y, subjectIds, affectedIds);
					const geometry = built?.paper.subject ?? EMPTY_CANDIDATE_GEOMETRY;
					const labels: { world: [number, number, number]; text: string }[] = [];
					if (inkHover !== null && !boxMode) {
						const pending = pendingLegFacts(linePreviewBase(), inkHover.point);
						if (pending !== null) labels.push({ world: world(inkHover.point), text: `Length ${pending.length.toFixed(3)} m · angle ${pending.angleDegrees.toFixed(1)}°` });
					}
					if (boxMode && inkHover !== null) {
						const anchor = boxAnchor();
						if (anchor !== null) {
							labels.push({
								world: world(inkHover.point),
								text: `Box ${Math.abs(inkHover.point[0] - anchor.point[0]).toFixed(3)} × ${Math.abs(inkHover.point[1] - anchor.point[1]).toFixed(3)} m`
							});
						}
						labels.push({ world: world(inkHover.point), text: inkPreview.consequence.summary });
					}
					return [
						candidatePreviewOf({ id: 'layout-candidate-chain', role: 'subject', geometry, labels, snap: snapOf(inkSnapWinner) }),
						...(built === null || (built.paper.affected.polygons.length === 0 && built.paper.affected.segments.length === 0)
							? []
							: [candidatePreviewOf({ id: 'layout-candidate-chain-affected', role: 'affected', geometry: built.paper.affected })])
					];
				}
				if (inkPreview?.kind === 'refused' && points.length >= 2) {
					return [candidatePreviewOf({
						id: 'layout-candidate-chain-refused',
						role: 'refused',
						// A dashed cursor reach names the refused input, never a Wall band.
						geometry: { polygons: [], segments: [[world(points[points.length - 2]!.point), world(points[points.length - 1]!.point)]] },
						labels: [{ world: world(points[points.length - 1]!.point), text: inkPreview.message }]
					})];
				}
				if (inkHover !== null && linePreviewBase().points.length > 0) {
					const last = linePreviewBase().points.at(-1)!.point;
					const pending = pendingLegFacts(linePreviewBase(), inkHover.point);
					return [candidatePreviewOf({
						id: 'layout-candidate-cursor',
						role: 'subject',
						geometry: { polygons: [], segments: [[world(last), world(inkHover.point)]] },
						labels: pending === null ? [] : [{ world: world(inkHover.point), text: `Length ${pending.length.toFixed(3)} m · angle ${pending.angleDegrees.toFixed(1)}°` }],
						snap: snapOf(inkSnapWinner)
					})];
				}
				if (inkHover !== null && inkSnapWinner !== null) {
					return [candidatePreviewOf({
						id: 'layout-candidate-cursor',
						role: 'subject',
						geometry: EMPTY_CANDIDATE_GEOMETRY,
						snap: snapOf(inkSnapWinner)
					})];
				}
				return [];
			}

			/**
			 * The host-relative Opening ghost: two edges, the live offset/width and the
			 * planner's refusal words. The edges are drawn even when the candidate
			 * overruns the Wall, so refusal points at what the planner rejected.
			 */
			function openingOverlay(
				adapterContext: StageAdapterContext
			): ReturnType<NonNullable<StageAdapterBinding['overlay']>> {
				const markers: { id: string; css: readonly [number, number]; label: string }[] = [];
				const y = adapterContext.snapshot.domain.datumMeters;
				const project = (point: readonly [number, number]) =>
					adapterContext.project([point[0], y, point[1]]);
				const candidate = openingCandidate;
				const ghost = candidate === null ? null : openingGhost(candidate.wallId, candidate.offset);
				const start = ghost === null ? null : project(ghost[0]);
				const mark = (id: string, css: readonly [number, number] | null, label: string) => {
					if (css !== null) markers.push({ id, css, label });
				};
				if (candidate !== null) {
					mark(
						'layout-opening-start',
						start,
						`Opening start — offset ${candidate.offset.toFixed(3)} m on Wall ${candidate.wallId}`
					);
					mark('layout-opening-end', ghost === null ? null : project(ghost[1]), `Opening end — ${openingOptions.width.toFixed(3)} m wide`);
				}
				const refusal =
					openingNotice ?? (openingPreview?.kind === 'refused' ? openingPreview.message : null);
				if (refusal !== null) {
					// Overlay contributions are viewport CSS; only the no-ghost fallback
					// carries a raw Stage-local pointer point, so translate that one here.
					const press = openingPress;
					const fallback =
						press === null
							? null
							: ([press.css[0] + adapterContext.evaluation.rect.left, press.css[1] + adapterContext.evaluation.rect.top] as const);
					mark('layout-opening-refusal', start ?? fallback, refusal);
				}
				return markers;
			}

			/**
			 * The ghost chain, its live marks and the refusal/repair words.
			 *
			 * Every marker is projected through the same evaluation the meshes were
			 * drawn with, and the ghost legs come from the planner's own candidate — so
			 * the preview can never show a chain the planner would refuse.
			 */
			function inkOverlay(adapterContext: StageAdapterContext): ReturnType<NonNullable<StageAdapterBinding['overlay']>> {
				const markers: { id: string; css: readonly [number, number]; label: string }[] = [];
				const y = adapterContext.snapshot.domain.datumMeters;
				const project = (point: readonly [number, number]) =>
					adapterContext.project([point[0], y, point[1]]);
				if (inkPreview !== null && inkPreview.kind === 'planned' && inkPreview.authoredWallIds.length > 0) {
					for (const leg of plannedLegs(inkPreview.document, inkPreview.authoredWallIds)) {
						const css = project([
							(leg.start[0] + leg.end[0]) / 2,
							(leg.start[1] + leg.end[1]) / 2
						]);
						if (css === null) continue;
						markers.push({
							id: `layout-ink-leg-${leg.id}`,
							css,
							label: `Ghost Wall ${leg.id} — ${inkPreview.consequence.summary}`
						});
					}
				}
				const boxMode = inkReading === 'wall' && inkWallMode === 'box';
				const livePoints = boxMode
					? boxPreviewDraft() ?? draft
					: linePreviewDraft();
				const points = 'points' in livePoints ? livePoints.points : draft.points;
				points.forEach((entry, index) => {
					const css = project(entry.point);
					if (css === null) return;
					const targetWords =
						entry.target.kind === 'junction'
							? `connects to Junction ${entry.target.junctionId}`
							: entry.target.kind === 'host'
								? `splits Wall ${entry.target.wallId}`
								: 'free point';
					markers.push({
						id: `layout-ink-point-${index}`,
						css,
						label: `Chain point ${index + 1} — ${targetWords}`
					});
				});
				if (inkHover !== null) {
					const targetCss = project(inkHover.point);
					if (targetCss !== null) {
						markers.push({
							id: 'layout-ink-target',
							css: targetCss,
						label:
							inkHover.target.kind === 'junction'
								? `Deliberate Junction ${inkHover.target.junctionId}`
								: inkHover.target.kind === 'host'
									? `Deliberate Wall interior — splits ${inkHover.target.wallId}`
									: 'Free point'
						});
					}
				}
				const pending = inkHover === null || boxMode ? null : pendingLegFacts(linePreviewBase(), inkHover.point);
				const anchor = boxMode ? boxAnchor() : null;
				if (anchor !== null && inkHover !== null) {
					const css = project(inkHover.point);
					if (css !== null) {
						markers.push({
							id: 'layout-ink-box',
							css,
							label: `Box ${Math.abs(inkHover.point[0] - anchor.point[0]).toFixed(3)} × ${Math.abs(inkHover.point[1] - anchor.point[1]).toFixed(3)} m`
						});
					}
				}
				if (pending !== null && inkHover !== null) {
					const css = project(inkHover.point);
					if (css !== null) {
						markers.push({
							id: 'layout-ink-pending',
							css,
							label: `Length ${pending.length.toFixed(3)} m · angle ${pending.angleDegrees.toFixed(1)}°`
						});
					}
				}
				if (refusal === null ? inkNotice !== null : refusal !== null) {
					const anchor =
						inkHover === null
							? points.length > 0
								? project(points[points.length - 1]!.point)
								: null
							: project(inkHover.point);
					if (anchor !== null) {
						markers.push({
							id: 'layout-ink-refusal',
							css: anchor,
							label: (refusal ?? inkNotice) as string
						});
					}
				}
				return markers;
			}
		}
	};

	return adapter;
};
