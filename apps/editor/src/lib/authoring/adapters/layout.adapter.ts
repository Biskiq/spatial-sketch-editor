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
 * **S05 pointer manipulation** stays here: endpoint handles for exact length
 * (drag) and angle (shift-drag) and a body handle for rigid translation, offered
 * while a Wall is selected and no contributed task is armed
 * (`pressWhenNoTask`) — the arming route changed with the Dimensions task's
 * retirement, the manipulation and its refusals did not. A press is claimed only
 * on a handle; each move previews through the retained planner on an immutable
 * baseline, and release commits once through the same F.4 intent a typed field
 * builds. Escape, a pointer cancel, capture loss, task close and replacement
 * cancel with no document change.
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
	mintLayoutIdCapture,
	type FixedWallEndpoint,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import type { StageAdapterFactory, StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import {
	datumWorkingPlane,
	type StageAdapter,
	type StageAdapterBinding,
	type StageAdapterContext,
	type StageCardAction,
	type StageCardFact,
	type StageCardSubject,
	type StageKeyboardIntent,
	type StagePointerIntent
} from '$lib/authoring/stage/stage-facade';
import { stageLayout, stageUnitRevision } from '$lib/authoring/stage/unit-stage-source';
import type { GestureAcquisition, ProposalLease } from '$lib/authoring/stage/stage-session';
import { perfInstall, perfMark } from '$lib/platform/perf-marks';

import LayoutCardFields from './layout/LayoutCardFields.svelte';
import LayoutInkPalette from './layout/LayoutInkPalette.svelte';
import LayoutPlacementInstrument from './layout/LayoutPlacementInstrument.svelte';
import {
	EMPTY_CHAIN_DRAFT,
	appendChainPoint,
	backtrackChainPoint,
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
	createDrawingPlanners,
	planWallDeletion,
	wallChainCommitIntent,
	wallDeleteIntent,
	type WallDeletionPreview
} from './layout/drawing-planners';
import {
	classifyInkPointerTarget,
	pointOnWallCenterline,
	publishInkSurface,
	type InkController,
	type InkPaletteSnapshot,
	type InkPointerTarget,
	type ProjectedJunction,
	type ProjectedWall
} from './layout/ink';
import {
	LAYOUT_PLINTH_PLACE_KIND,
	createLayoutPlanners,
	layoutFacts,
	layoutSubjectOf,
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
	pickWallHandle,
	pointerWallRequest,
	wallHandleFixedEndpoint,
	wallRequestExactLabel,
	wallRequestLabel,
	type WallHandle,
	type WallHandlePoints,
	type WallPointerMode
} from './layout/wall-gesture';
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
 * exactly as the Scene adapter's floor query does), while the intents and the
 * overlay use Stage-local pixels; the one accepted evaluation rect is the only
 * translation between them.
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

/** One claimed Wall gesture, from its immutable baseline to its one commit. */
type WallGesture = {
	/** The evaluation the press was measured in; a change pauses the writer. */
	readonly evaluationId: string;
	readonly handle: WallHandle;
	readonly fixed: FixedWallEndpoint;
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
	/** Neighbours the candidate reshaped at the edited junction. */
	neighbours: readonly WallNeighbourPreview[];
};

export const createAdapter: StageAdapterFactory = (services) => {
	for (const planner of [...createLayoutPlanners(), ...createDrawingPlanners()]) {
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
	 * The deleted-Wall disclosure is derived from the canonical planner, which is
	 * a full planning pass; the Card asks for it on render, so the answer for one
	 * (source, Wall) pair is remembered. The map is bounded and keyed by content
	 * identity, so a different document can never read a stale disclosure.
	 */
	const deletionDisclosures = new Map<string, WallDeletionPreview>();

	const adapter: StageAdapter = {
		id: 'layout',
		requiredCapabilities: ['stage-instrument-v1'],
		bind(context): StageAdapterBinding {
			const document = stageLayout(context.snapshot);
			const levelId = context.snapshot.domain.layoutLevelId;
			const contentRevision = context.snapshot.domain.unitRevisions.layout;
			/** The task this binding is showing; pointer handles belong to it. */
			let openTaskKind: string | null = null;
			let gesture: WallGesture | null = null;
			let pausedProposal: PausedWallProposal | null = null;
			let refusal: string | null = null;
			/** The live chain draft, its hover target and its planner preview. */
			let draft: ChainDraft = EMPTY_CHAIN_DRAFT;
			/** One operation, one capture: the same identity previews and commits. */
			let chainCapture: ReturnType<typeof mintLayoutIdCapture> | null = null;
			let inkHover: InkPointerTarget | null = null;
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
				refusal = outcome.kind === 'refused' ? outcome.message : null;
				services.stage.notifySurfaceChange();
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
					return { target: hit, point: junction.point, css };
				}
				const point = pointerDatumPoint(adapterContext, css);
				if (point === null) return null;
				if (hit?.kind === 'host') {
					const wall = projected.walls.find((candidate) => candidate.id === hit.wallId);
					if (wall === undefined) return null;
					// The split lands where the creator aimed: the pointer projected onto
					// that Wall's centerline, never the cursor's raw plane point.
					return { target: hit, point: pointOnWallCenterline(wall, [point[0], point[1]]), css };
				}
				return { target: { kind: 'free' }, point: [point[0], point[1]], css };
			}

			/** Re-plan the draft (with the hover point, when there is one). */
			function refreshInkPreview(): void {
				const points =
					inkHover === null ? draft : appendChainPoint(draft, { point: inkHover.point, target: inkHover.target });
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

			function snapshotForPalette(): InkPaletteSnapshot {
				const withHover =
					inkHover === null ? draft : appendChainPoint(draft, { point: inkHover.point, target: inkHover.target });
				const effective = 'points' in withHover ? withHover : draft;
				const pending =
					inkHover === null ? null : pendingLegFacts(draft, inkHover.point);
				return {
					points: effective.points.map((entry) => [entry.point[0], entry.point[1]] as LayoutVec2),
					closed: effective.closed,
					canFinish: draft.points.length >= 2,
					canClose: draft.points.length >= 3 && !draft.closed,
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
						hover: target
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
					const target = inkTargetAt(adapterContext, intent.css);
					if (target !== null) {
						current.hover = target;
						inkHover = target;
						refreshInkPreview();
					}
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
				if (travel <= 4) appendInkPoint({ point: release.point, target: release.target });
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

			return {
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
				/** The Wall's scoped delete, disclosing its consequences first. */
				cardActions(cardSubject: StageCardSubject): readonly StageCardAction[] {
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
				keyIntent(intent: StageKeyboardIntent): boolean {
					if (openTaskKind !== LAYOUT_INK_TASK) return false;
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
				pointerIntent(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {
					if (openTaskKind === LAYOUT_INK_TASK) return inkPointer(intent, adapterContext);
					if (openTaskKind !== null) return false;

					if (intent.phase === 'down') {
						if (gesture !== null) endGesture();
						pausedProposal = null;
						// A new gesture supersedes the previous paused value for this source.
						clearPausedProposalsForSource(adapterContext.snapshot.domain.unitRevisions.layout);
						refusal = null;
						const selected = selectedWall(adapterContext);
						if (selected === null) return false;
						const points = projectWallHandles(adapterContext, selected.frame, 'stage');
						if (points === null) return false;
						const handle = pickWallHandle(intent.css, points);
						if (handle === null) return false;
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
						gesture = {
							evaluationId: intent.evaluationId,
							handle,
							fixed: handle === 'body' ? 'start' : wallHandleFixedEndpoint(handle),
							baseline: stageLayout(adapterContext.snapshot),
							frame: selected.frame,
							startPoint: point,
							lease: acquisition,
							request: null,
							preview: null,
							neighbours: []
						};
						warmLayoutPlannerBaseline(gesture.baseline);
						services.stage.notifySurfaceChange();
						return true;
					}

					if (gesture === null) return false;

					if (intent.phase === 'cancel') {
						endGesture();
						services.stage.notifySurfaceChange();
						return true;
					}

					// **Reading flip.** The pointer mapping was measured in the old
					// projection; committing it here would silently reinterpret the drag.
					// Preserve the last explicit parameter, end the writer and let the
					// creator apply it deliberately from the Card or cancel it.
					if (intent.evaluationId !== gesture.evaluationId) {
						preservePausedProposal(adapterContext.snapshot.domain.unitRevisions.layout);
						endGesture();
						services.stage.notifySurfaceChange();
						return true;
					}

					if (intent.phase === 'move') {
						const point = pointerDatumPoint(adapterContext, intent.css);
						if (point === null) {
							gesture.request = null;
							gesture.preview = null;
							services.stage.notifySurfaceChange();
							return true;
						}
						const mode: WallPointerMode =
							gesture.handle === 'body' ? 'move' : intent.shift === true ? 'angle' : 'length';
						const request = pointerWallRequest({
							handle: gesture.handle,
							mode,
							frame: gesture.frame,
							fixed: gesture.fixed,
							startPoint: gesture.startPoint,
							point
						});
						// A pointer dragged across the fixed endpoint names no length on this
						// Wall: the planner would place the moved endpoint on the existing side,
						// mirroring the preview away from the hand. Withdraw the candidate and
						// name the refusal instead of committing a mirrored Wall.
						if (request.kind === 'length' && request.length <= 0) {
							gesture.request = null;
							gesture.preview = null;
							gesture.neighbours = [];
							refusal = 'Drag the endpoint back across the fixed endpoint to name a length.';
							// T3.P03.S02: a refused sample installs no preview, so the harness must
							// see it as refused rather than as an input that never arrived.
							perfMark('wall-preview:refused', { wallId: gesture.frame.wallId });
							services.stage.notifySurfaceChange();
							return true;
						}
						const planned = planWallManipulation(
							gesture.baseline,
							gesture.frame.wallId,
							request,
							gesture.fixed
						);
						if (planned.kind === 'refused') {
							// A refused candidate is not a proposal: drop the preview so a
							// later release cannot install the last valid pose on its behalf.
							gesture.request = null;
							gesture.preview = null;
							gesture.neighbours = [];
							refusal = planned.message;
							perfMark('wall-preview:refused', { wallId: gesture.frame.wallId });
						} else {
							gesture.request = request;
							gesture.preview = planned.wall;
							gesture.neighbours = planned.neighbours;
							refusal = null;
							// The candidate is installed into the overlay here; presentation is
							// the next frame, which the harness pairs by sequence.
							perfInstall('wall-preview', { wallId: gesture.frame.wallId });
						}
						services.stage.notifySurfaceChange();
						return true;
					}

					// **Release.** Commit once, and only a proposal this gesture still owns.
					const pending = gesture.request;
					const fixed = gesture.fixed;
					const wallId = gesture.frame.wallId;
					endGesture();
					if (pending !== null) void commit(pending, fixed, wallId);
					services.stage.notifySurfaceChange();
					return true;
				},
				overlay(adapterContext) {
					if (openTaskKind === LAYOUT_INK_TASK) return inkOverlay(adapterContext);
					if (openTaskKind !== null) return [];
					// Direct manipulation is offered only while the creator is in Select.
					// Another adapter's open task owns the pointer, so the same handles here
					// would be marks the creator cannot press.
					if (services.stage.session.task() !== null) return [];
					const selected = selectedWall(adapterContext);
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
							{ id: 'layout-wall-start', css: points.start, label: 'Wall start: drag for length, shift-drag for angle' },
							{ id: 'layout-wall-end', css: points.end, label: 'Wall end: drag for length, shift-drag for angle' },
							{ id: 'layout-wall-body', css: points.middle, label: 'Wall body: drag to move rigidly' },
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
						{ id: 'layout-wall-start', css: points.start, label: 'Wall start: drag for length, shift-drag for angle' },
						{ id: 'layout-wall-end', css: points.end, label: 'Wall end: drag for length, shift-drag for angle' },
						{ id: 'layout-wall-body', css: points.middle, label: 'Wall body: drag to move rigidly' },
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
				instrument(task) {
					openTaskKind = task.kind;
					if (task.kind === LAYOUT_INK_TASK) {
						publishInk();
						return {
							summary: 'Ink',
							facts: [
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
					openTaskKind = null;
					if (pausedProposal !== null) {
						clearPausedProposal(pausedProposal.sourceContentId, pausedProposal.wallId);
					}
					pausedProposal = null;
					refusal = null;
					endGesture();
					// Disarming the tool cancels the live chain: nothing is left hidden.
					endInkPress();
					clearChain();
					publishInkSurface(null);
				},
				dispose() {
					openTaskKind = null;
					if (pausedProposal !== null) {
						clearPausedProposal(pausedProposal.sourceContentId, pausedProposal.wallId);
					}
					pausedProposal = null;
					refusal = null;
					endGesture();
					endInkPress();
					clearChain();
					publishInkSurface(null);
				}
			};

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
				const project = (point: readonly [number, number]) => {
					const css = adapterContext.project([point[0], y, point[1]]);
					return css === null
						? null
						: ([css[0] - adapterContext.evaluation.rect.left, css[1] - adapterContext.evaluation.rect.top] as const);
				};
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
				const livePoints =
					inkHover === null ? draft : appendChainPoint(draft, { point: inkHover.point, target: inkHover.target });
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
					markers.push({
						id: 'layout-ink-target',
						css: inkHover.css,
						label:
							inkHover.target.kind === 'junction'
								? `Deliberate Junction ${inkHover.target.junctionId}`
								: inkHover.target.kind === 'host'
									? `Deliberate Wall interior — splits ${inkHover.target.wallId}`
									: 'Free point'
					});
				}
				const pending = inkHover === null ? null : pendingLegFacts(draft, inkHover.point);
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
							: inkHover.css;
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
