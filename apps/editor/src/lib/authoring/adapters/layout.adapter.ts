/**
 * T1.P01.S04/S05 — the Layout adapter.
 *
 * This is the slice's **only** module the Stage catalogue discovers, and it
 * reaches the shell exclusively through T1.P01.S07's AM-5 contribution points:
 * the Dimensions and placement instruments, the Card facts and the capability
 * Find entries. It edits no host core, route or shell module.
 *
 * It registers the production planners with the one F.4 coordinator
 * (`createLayoutPlanners`) and contributes:
 *
 * - `layout-place-plinth` — the Place → Layout plinth operation, always present;
 * - `layout-dimensions` — the settled-measure instrument for the selected Wall
 *   or Opening, present only while such a subject is selected;
 * - Card facts read from the accepted source, never from planning state.
 *
 * **T1.P01.S05** adds the pointer half of existing straight-Wall manipulation to
 * that same Dimensions task: endpoint handles for exact length (drag) and angle
 * (shift-drag), and a body handle for rigid translation. A press is claimed only
 * while this adapter owns the open task; each move previews through the retained
 * planner on an immutable baseline, and release commits exactly once through the
 * same F.4 intent a typed field builds. Escape, a pointer cancel, capture loss,
 * task close and replacement cancel with no document change. Inactive helpers
 * cannot pick because the facade offers the press only to the task's owner, and
 * the handles are drawn only while the task is open.
 *
 * A reading flip does not silently commit or reinterpret: the gesture is ended
 * without a commit and its explicit parameter is preserved as a paused proposal
 * that the overlay names. The creator applies it explicitly from Dimensions or
 * cancels it with Escape — never by the stale pointer-up.
 */

import type { FixedWallEndpoint, LayoutDocumentWallFirst } from '@portfolio/layout-core';

import type { StageAdapterFactory } from '$lib/authoring/stage/stage-adapter-host';
import {
	datumWorkingPlane,
	type StageAdapter,
	type StageAdapterBinding,
	type StageAdapterContext,
	type StageCardFact,
	type StageCardSubject,
	type StagePointerIntent
} from '$lib/authoring/stage/stage-facade';
import { currentStagePlanner, currentStageSource } from '$lib/authoring/stage/current-stage-source';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-session';

import LayoutDimensionsInstrument from './layout/LayoutDimensionsInstrument.svelte';
import LayoutPlacementInstrument from './layout/LayoutPlacementInstrument.svelte';
import {
	LAYOUT_PLINTH_PLACE_KIND,
	createLayoutPlanners,
	layoutFacts,
	layoutSubjectOf,
	planWallManipulation,
	wallFrame,
	wallManipulationIntent,
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
	publishPausedProposal,
	type PausedWallProposal
} from './layout/paused-proposal';

const LAYOUT_DIMENSIONS_TASK = 'layout-dimensions';

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
	for (const planner of createLayoutPlanners()) {
		const registration = services.authoring.registerPlanner(currentStagePlanner(planner));
		if (registration.kind !== 'registered') {
			throw new Error(
				`Layout adapter planner "${planner.kind}" was refused: ${registration.reason} — ${registration.message}`
			);
		}
	}

	const adapter: StageAdapter = {
		id: 'layout',
		requiredCapabilities: ['stage-instrument-v1'],
		bind(context): StageAdapterBinding {
			const document = currentStageSource(context.snapshot).source.layout;
			/** The task this binding is showing; pointer handles belong to it. */
			let openTaskKind: string | null = null;
			let gesture: WallGesture | null = null;
			let pausedProposal: PausedWallProposal | null = null;
			let refusal: string | null = null;

			/** Release the live lease and drop the in-flight gesture, exactly once. */
			function endGesture(): void {
				const current = gesture;
				gesture = null;
				// Release **this gesture's own** grant. Reading the session's live lease
				// would release another owner's after a reading change already spent ours.
				if (current?.lease?.kind === 'granted' && current.lease.lease.active) current.lease.lease.release();
			}

			/**
			 * A reading flip ends the writer but not the work: the last explicit
			 * parameter is kept as a paused proposal for the overlay to name. It is never
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
				// The instrument offers an explicit Resume from this store; it is not a
				// document and the retained planner revalidates the request on apply.
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
				const frame = wallFrame(currentStageSource(adapterContext.snapshot).source.layout, primary.subject.id);
				return frame === null ? null : { wallId: primary.subject.id, frame };
			}

			/**
			 * Commit one explicit parameter through the **same** captured intent the
			 * typed field builds. The operation id and revision are minted here, at
			 * release, so a proposal cannot install against the revision it started on
			 * if an acceptance landed in between.
			 */
			async function commit(
				request: WallManipulationRequest,
				fixed: FixedWallEndpoint,
				wallId: string
			): Promise<void> {
				const snapshot = services.stage.snapshot();
				const outcome = await services.authoring.accept(
					wallManipulationIntent({
						request,
						wallId,
						fixed,
						operationId: globalThis.crypto.randomUUID(),
						projectId: snapshot.acceptedRevision.projectId,
						revisionId: services.authoring.acceptedRevision().revisionId,
						contentRevision: snapshot.sourceContentId,
						levelId: snapshot.domain.layoutLevelId
					})
				);
				refusal = outcome.kind === 'refused' ? outcome.message : null;
				services.stage.notifySurfaceChange();
			}

			return {
				tasks: [
					{
						id: 'layout-place-plinth',
						taskKind: LAYOUT_PLINTH_PLACE_KIND,
						label: 'Place plinth',
						order: 10
					},
					{
						id: 'layout-dimensions',
						taskKind: LAYOUT_DIMENSIONS_TASK,
						label: 'Dimensions',
						targetRef: null,
						order: 0
					}
				],
				findEntries: [
					{
						id: 'layout-dimensions',
						taskKind: LAYOUT_DIMENSIONS_TASK,
						label: 'Dimensions',
						railFamily: 'inspect',
						capability: 'layout',
						order: 0
					},
					{
						id: 'layout-place-plinth',
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
				 * The pointer half of Wall manipulation.
				 *
				 * The facade calls this only for the adapter that owns the open task, so
				 * an inactive Dimensions helper can never claim a press. A press that is
				 * not on a handle is refused and falls through to navigation.
				 */
				pointerIntent(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {
					if (openTaskKind !== LAYOUT_DIMENSIONS_TASK) return false;

					if (intent.phase === 'down') {
						if (gesture !== null) endGesture();
						pausedProposal = null;
						// A new gesture supersedes the previous paused value for this source.
						clearPausedProposalsForSource(adapterContext.snapshot.sourceContentId);
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
							baseline: currentStageSource(adapterContext.snapshot).source.layout,
							frame: selected.frame,
							startPoint: point,
							lease: acquisition,
							request: null,
							preview: null,
							neighbours: []
						};
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
					// creator apply it deliberately from Dimensions or cancel it.
					if (intent.evaluationId !== gesture.evaluationId) {
						preservePausedProposal(adapterContext.snapshot.sourceContentId);
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
						} else {
							gesture.request = request;
							gesture.preview = planned.wall;
							gesture.neighbours = planned.neighbours;
							refusal = null;
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
					if (openTaskKind !== LAYOUT_DIMENSIONS_TASK) return [];
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
										]
							})
						];
					}
					const paused = pausedProposal;
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
										label: `Paused after a reading change — ${paused.label}. Enter it in Dimensions or Escape to cancel.`
									}
								]),
						...(refusal === null
							? []
							: [{ id: 'layout-wall-refusal', css: points.middle, label: refusal }])
					];
				},
				instrument(task) {
					openTaskKind = task.kind;
					if (task.kind === LAYOUT_DIMENSIONS_TASK) {
						const current = layoutSubjectOf(context.selection());
						if (current === null || current.kind === 'object') return null;
						return {
							summary: 'Dimensions',
							facts: factsFor(document, current),
							view: { component: LayoutDimensionsInstrument, services }
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
				/** Esc, task replacement and install all end the gesture with no commit. */
				taskClosed() {
					openTaskKind = null;
					if (pausedProposal !== null) {
						clearPausedProposal(pausedProposal.sourceContentId, pausedProposal.wallId);
					}
					pausedProposal = null;
					refusal = null;
					endGesture();
				},
				dispose() {
					openTaskKind = null;
					if (pausedProposal !== null) {
						clearPausedProposal(pausedProposal.sourceContentId, pausedProposal.wallId);
					}
					pausedProposal = null;
					refusal = null;
					endGesture();
				}
			};
		}
	};

	return adapter;
};
