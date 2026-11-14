import type { SettledLayoutRefusal } from './layout/manipulation-support';
import { type LayoutDocumentWallFirst } from '@portfolio/layout-core';

import { createPlanPickProvider } from '$lib/authoring/layout/plan-pick-provider';
import type { StageAdapterFactory } from '$lib/authoring/stage/stage-adapter-host';
import {
	type StageAdapter,
	type StageAdapterBinding,
	type StageAdapterContext,
	type StageCandidatePreview
} from '$lib/authoring/stage/stage-adapter-host';
import { stageLayout } from '$lib/authoring/stage/stage-adapter-host';

import { createOpeningPlanners } from './layout/opening-planners';
import { createDrawingPlanners, type WallDeletionPreview } from './layout/drawing-planners';
import { createSplitPlanners } from './layout/split-planners';
import {
	bindLayoutCompileContext,
	createLayoutCompileContext,
	plannerInContext,
	type LayoutAdapterLifetime
} from './layout/compile-context';
import { createLayoutCandidatePresenter } from './layout/candidate-presenter';
import { createJoinPlanners } from './layout/join-planners';
import {
	createRoomDuplicatePlanners,
	LAYOUT_ROOM_DUPLICATE_KIND
} from './layout/room-duplicate-planners';
import { LAYOUT_INK_TASK } from './layout/ink';
import { createInkSession } from './layout/ink-session';
import { createOpeningPlacementSession } from './layout/opening-placement-session';
import { createInkMemory } from './layout/session-ports';
import {
	planNumericEntryInput,
	planNumericEntryKey,
	planNumericEntryOpen,
	planNumericEntryTab
} from '$lib/authoring/layout/plan-numeric-entry';
import { LAYOUT_PLINTH_PLACE_KIND, createLayoutPlanners } from './layout/precision';
import { type CandidatePaperGeometry, type LayoutCandidatePaper } from './layout/candidate-preview';
import { createOpeningRepeatPlanners } from './layout/opening-repeat';
import {
	selectedWall,
	selectedCurvedWall,
	selectedOpening,
	bodyFrameForOpenWall
} from './layout/layout-subjects';
import { createWallGestureSession } from './layout/wall-gesture-session';
import { createCurveGestureSession } from './layout/curve-gesture-session';
import { createJunctionGestureSession } from './layout/junction-gesture-session';
import { createOpeningGestureSession } from './layout/opening-gesture-session';
import { createRoomGestureSession } from './layout/room-gesture-session';
import { createLayoutContributions } from './layout/layout-contributions';

export const createAdapter: StageAdapterFactory = (services) => {
	const pick = createPlanPickProvider(() => services.stage.plan());
	/** E4 — this project's compile context; bindings borrow it, the registration end releases it. */
	const compileContext = createLayoutCompileContext();
	const lifetime: LayoutAdapterLifetime = { context: compileContext, memoHeld: null };
	const planners = [
		...createLayoutPlanners(),
		...createDrawingPlanners(),
		...createSplitPlanners(),
		...createJoinPlanners(),
		...createRoomDuplicatePlanners(),
		...createOpeningPlanners(),
		// T1 A8 — Repeat is one retained planner beside the other Opening
		// operations, on the same registry, admission and coordinator.
		...createOpeningRepeatPlanners()
	].map((planner) => plannerInContext(compileContext, planner));
	for (const planner of planners) {
		const registration = services.authoring.registerPlanner(planner);
		if (registration.kind !== 'registered') {
			throw new Error(
				`Layout adapter planner "${planner.kind}" was refused: ${registration.reason} — ${registration.message}`
			);
		}
	}

	/**
	 * Ink defaults are the **adapter's** memory, not a binding's: thickness, height,
	 * reading, wall mode and the next Opening's options survive an accepted chain's
	 * rebind. Captured gesture state does not — it lives in the binding's sessions.
	 */
	const inkMemory = createInkMemory();
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
		/** E4 — ends the registration: release this project's compile context. */
		dispose: () => compileContext.dispose(),
		bind(context): StageAdapterBinding {
			const document = stageLayout(context.snapshot);
			/** E4 — this binding's candidate memo; it dies with the binding (rebase). */
			const presenter = createLayoutCandidatePresenter(compileContext);
			lifetime.memoHeld = presenter.held;
			const levelId = context.snapshot.domain.layoutLevelId;
			const contentRevision = context.snapshot.domain.unitRevisions.layout;
			/** The task this binding is showing; pointer handles belong to it. */
			let openTaskKind: string | null = null;

			// Binding-level presentation transitions shared by dispatch. The sessions
			// own their captures and request publication through these commands.
			let refusal: string | null = null;
			let settledRefusal: SettledLayoutRefusal | null = null;
			function publishRefusal(text: string | null): void {
				refusal = text;
			}
			function settleRefusal(value: SettledLayoutRefusal | null): void {
				settledRefusal = value;
			}

			const manipulation = {
				services,
				document,
				levelId,
				contentRevision,
				publishRefusal,
				settleRefusal
			};
			const wall = createWallGestureSession({
				...manipulation,
				candidatePaper,
				junctionActive: (): boolean => junction.active
			});
			const junction = createJunctionGestureSession({ ...manipulation, commit: wall.commit });
			const existingOpening = createOpeningGestureSession({
				...manipulation,
				candidatePaper,
				openingFace,
				presenter,
				planCandidate: (plan) => compileContext.plan(document, plan)
			});
			const curve = createCurveGestureSession({ ...manipulation, candidatePaper });
			const room = createRoomGestureSession(manipulation);
			const {
				markDescriptors: projectMarks,
				settledPreviews,
				inkInstrument,
				plinthInstrument,
				...contributions
			} = createLayoutContributions({
				services,
				context,
				document,
				levelId,
				deletionDisclosures,
				selectLayoutSubject,
				readActiveKnot: () => curve.activeKnot,
				requestRoomDuplicate: room.requestDuplicate,
				removeSelectedKnot: curve.removeSelectedKnot
			});

			function markDescriptors(adapterContext: StageAdapterContext) {
				if (openTaskKind === null && services.stage.session.task() === null)
					curve.reconcileSelection(adapterContext);
				return projectMarks(
					adapterContext,
					{
						curve: curve.markState(),
						wall: wall.markState(),
						opening: existingOpening.markState(),
						junctionActive: junction.active,
						refusal
					},
					openTaskKind !== null
				);
			}

			function endManipulation(): void {
				wall.endGesture();
				junction.endJunctionGesture();
				existingOpening.endOpeningGesture();
			}
			/**
			 * The Opening and Ink one-operation controllers. Both are binding-scoped:
			 * their captures, previews, leases and in-flight guards die with this binding,
			 * while the adapter-lifetime defaults live in `inkMemory`.
			 */
			const sessionPorts = {
				services,
				document,
				levelId,
				presenter,
				memory: inkMemory,
				inkTaskOpen: () => openTaskKind === LAYOUT_INK_TASK,
				candidatePaper,
				openingFace
			};
			const opening = createOpeningPlacementSession({
				...sessionPorts,
				publish: () => ink.publish(),
				select: selectLayoutSubject
			});
			const ink = createInkSession({ ...sessionPorts, opening });

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

			const binding: StageAdapterBinding = {
				pick,
				...contributions,
				keyIntent(intent, adapterContext) {
					if (openTaskKind === LAYOUT_INK_TASK) return ink.key(intent, adapterContext);
					if (wall.scalarKey(intent)) return true;
					if (room.roomMoveKey(intent)) return true;
					const active = wall.active
						? wall
						: junction.active
							? junction
							: existingOpening.active
								? existingOpening
								: null;
					if (intent.kind === 'cancel' && !curve.isBending && active === null && curve.clearKnot())
						return true;
					if (active === null) {
						if (
							(intent.kind === 'delete' || intent.kind === 'backtrack') &&
							!curve.isBending &&
							!wall.hasScalar
						) {
							return curve.deleteKnotKey(adapterContext);
						}
						return false;
					}
					const numeric = active.numeric;
					if (intent.kind === 'type') {
						if (intent.key === '\t') {
							const target = active.numericTarget();
							if (numeric === null || target === null) return false;
							active.setNumeric(planNumericEntryTab(numeric, 'forward', target.candidates));
						} else if (numeric === null) {
							const target = active.numericTarget();
							if (target === null) return false;
							active.setNumeric(
								planNumericEntryInput(
									planNumericEntryOpen(
										{ host: target.host, fieldId: target.field.id, ownerId: target.ownerId },
										target.candidates
									),
									intent.key
								)
							);
							refusal = null;
						} else {
							active.setNumeric(planNumericEntryKey(numeric, intent.key));
							refusal = null;
						}
					} else if (intent.kind === 'finish') {
						return numeric !== null && active.submitNumeric();
					} else if (intent.kind === 'backtrack') {
						if (numeric === null) return false;
						active.setNumeric(
							numeric.text.length <= 1 ? null : planNumericEntryInput(numeric, numeric.text.slice(0, -1))
						);
					} else if (numeric !== null) {
						active.setNumeric(null);
					} else {
						refusal = null;
						endManipulation();
					}
					services.stage.notifySurfaceChange();
					return true;
				},
				pressWhenNoTask: true,
				handles(adapterContext) {
					const marks = markDescriptors(adapterContext);
					if (openTaskKind !== null || services.stage.session.task() !== null) return marks;
					return [
						...marks,
						...room.roomMoveDescriptors(adapterContext),
						...wall.scalarDescriptors(adapterContext)
					];
				},
				idleHandles(adapterContext) {
					return junction.idleJunctionHandles(adapterContext, openTaskKind !== null, refusal);
				},
				hoverIntent(intent, adapterContext) {
					if (openTaskKind === LAYOUT_ROOM_DUPLICATE_KIND)
						return room.roomDuplicateHover(intent, adapterContext);
					return openTaskKind === LAYOUT_INK_TASK && ink.hover(intent, adapterContext);
				},
				idleHoverIntent(intent, adapterContext) {
					const blocked = openTaskKind !== null || wall.active || existingOpening.active;
					if (junction.updateIdleJunctionHover(intent, adapterContext, blocked)) {
						curve.clearBendHint();
						return true;
					}
					return curve.updateIdleBendHover(
						intent,
						adapterContext,
						blocked || junction.active || wall.hasScalar
					);
				},
				pointerIntent(intent, adapterContext) {
					if (openTaskKind === LAYOUT_ROOM_DUPLICATE_KIND)
						return room.roomDuplicatePointer(intent, adapterContext);
					if (intent.phase === 'down' && curve.clearBendHint()) services.stage.notifySurfaceChange();
					if (openTaskKind === LAYOUT_INK_TASK) return ink.pointer(intent, adapterContext);
					if (openTaskKind !== null) return false;
					if (curve.circleRadiusPointer(intent, adapterContext)) return true;
					if (curve.circleTranslatePointer(intent, adapterContext)) return true;
					if (
						curve.bendPointer(
							intent,
							adapterContext,
							wall.active || junction.active || existingOpening.active
						)
					)
						return true;
					if (wall.scalarPointer(intent, adapterContext)) return true;
					if (room.roomMovePointer(intent, adapterContext)) return true;

					if (intent.phase === 'down') {
						if (wall.active) wall.endGesture();
						if (junction.active) junction.endJunctionGesture();
						if (existingOpening.active) existingOpening.endOpeningGesture();
						wall.replacePaused(adapterContext.snapshot.domain.unitRevisions.layout);
						refusal = null;
						settledRefusal = null;
						if (intent.handleId === 'layout-junction-hover')
							return junction.begin(intent, adapterContext);
						// A curved open Wall has no straight `WallFrame`; its body still moves
						// through the same rigid-move request, using the endpoint chord only as
						// the local drag basis. The retained planner translates the real chain.
						const selectedStraight = selectedWall(adapterContext);
						const selectedCurved =
							selectedStraight === null ? selectedCurvedWall(document, adapterContext) : null;
						const selected =
							selectedStraight ??
							(selectedCurved === null
								? null
								: { wallId: selectedCurved.wallId, frame: bodyFrameForOpenWall(selectedCurved.frame) });
						const selectedOpeningSubject =
							selected === null ? selectedOpening(document, adapterContext) : null;
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
								// click uses. In Plan Select an Opening now outranks its host, so an
								// aperture press cannot move the selected Wall.
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
							} else if (selectedOpeningSubject !== null) {
								const picked = services.stage.resolvePick({
									css: intent.css,
									evaluationId: intent.evaluationId,
									purpose: 'select',
									tool: null,
									...(intent.coarse === undefined ? {} : { coarse: intent.coarse })
								});
								if (
									picked.kind !== 'resolved' ||
									picked.hit.sourceKind !== 'opening' ||
									picked.hit.sourceId !== selectedOpeningSubject.openingId
								)
									return false;
								markId = 'layout-opening-position';
							} else {
								return false;
							}
						}
						const descriptor = bodyPress
							? undefined
							: descriptors.find((candidate) => candidate.id === markId);
						if (!bodyPress && (descriptor === undefined || descriptor.role !== 'edit')) return false;

						if (markId === undefined) return false;
						if (selected !== null)
							return wall.begin(intent, adapterContext, selected, markId, bodyPress);
						return (
							selectedOpeningSubject !== null &&
							existingOpening.begin(intent, adapterContext, selectedOpeningSubject, markId)
						);
					}

					const evaluationId =
						junction.evaluationId ?? wall.evaluationId ?? existingOpening.evaluationId;
					if (evaluationId === undefined) return false;
					if (intent.phase === 'cancel' || intent.evaluationId !== evaluationId) {
						if (intent.phase !== 'cancel' && wall.active)
							wall.preservePausedProposal(adapterContext.snapshot.domain.unitRevisions.layout);
						endManipulation();
						services.stage.notifySurfaceChange();
						return true;
					}
										if (wall.numeric !== null || junction.numeric !== null || existingOpening.numeric !== null) {
						if (intent.phase === 'up') services.stage.notifySurfaceChange();
						return true;
					}
					if (intent.phase === 'move') {
						if (junction.active) return junction.move(intent, adapterContext);
						if (existingOpening.active) return existingOpening.move(intent, adapterContext);
						return wall.move(intent, adapterContext);
					}
					if (junction.active) return junction.release(adapterContext, refusal);
					if (existingOpening.active) return existingOpening.release(intent, adapterContext, refusal);
					return wall.release(intent, adapterContext, refusal);
				},
				candidatePreview(adapterContext) {
					presenter.beginFrame();
					try {
						return candidatePreviews(adapterContext);
					} finally {
						presenter.endFrame();
					}
				},
				overlay(adapterContext) {
					if (openTaskKind === LAYOUT_INK_TASK) return ink.overlay(adapterContext);
					if (openTaskKind !== null) return [];
					// Direct manipulation is offered only while the creator is in Select.
					// Another adapter's open task owns the pointer, so the same handles here
					// would be marks the creator cannot press.
					if (services.stage.session.task() !== null) return [];
					return wall.overlay(adapterContext, refusal);
				},
				/** A contributed reading's proposed body, drawn by the one Canvas. */
				ghosts(adapterContext: StageAdapterContext) {
					if (openTaskKind !== LAYOUT_INK_TASK) return [];
					return ink.ghosts(adapterContext);
				},
				instrument(task) {
					openTaskKind = task.kind;
					settledRefusal = null;
					if (task.kind === LAYOUT_INK_TASK) {
						const contributed = ink.contributedReading();
						if (contributed !== null) ink.ensureContributedSession();
						ink.publish();
						return inkInstrument(contributed, inkMemory.reading);
					}
					if (task.kind === LAYOUT_PLINTH_PLACE_KIND) {
						return plinthInstrument();
					}
					if (task.kind === LAYOUT_ROOM_DUPLICATE_KIND) {
						return room.duplicateInstrument();
					}
					return null;
				},
				/** Esc, task replacement and install all end the writer with no commit. */
				taskClosed() {
					opening.invalidateRearm();
					presenter.reset();
					// A gesture's candidate compile is not retained after its task ends.
					compileContext.releaseCandidate();
					room.endRoomMove();

					room.endRoomDuplicate();
					openTaskKind = null;
					settledRefusal = null;
					wall.clearPaused();
					refusal = null;
					endManipulation();
					curve.cancel();
					ink.release();
				},
				dispose() {
					opening.invalidateRearm();
					presenter.reset();
					// The binding owns no candidate compile; the project context keeps none
					// for the next binding to inherit.
					compileContext.releaseCandidate();
					if (lifetime.memoHeld === presenter.held) lifetime.memoHeld = null;
					room.endRoomMove();
					openTaskKind = null;
					wall.clearPaused();
					refusal = null;
					endManipulation();
					curve.cancel();
					room.endRoomDuplicate();
					ink.release();
				}
			};
			return binding;

			/** The filtered Paper drawing for one planner candidate document. */
			function candidatePaper(
				document: LayoutDocumentWallFirst,
				datumMeters: number,
				subjectIds: ReadonlySet<string>,
				affectedIds: ReadonlySet<string>
			): { readonly paper: LayoutCandidatePaper } | null {
				const result = services.stage.plan();
				if (result.kind !== 'evaluated') return null;
				return { paper: presenter.paper(document, result.plan, datumMeters, subjectIds, affectedIds) };
			}

			/**
			 * The 3D reading's Opening outline. It draws only when the live Plan
			 * evaluates (the same null condition the Plan reading has) and never
			 * builds the Plan Paper it would discard.
			 */
			function openingFace(
				document: LayoutDocumentWallFirst,
				openingIds: ReadonlySet<string>,
				datumMeters: number
			): CandidatePaperGeometry | null {
				if (services.stage.plan().kind !== 'evaluated') return null;
				return presenter.face(document, openingIds, datumMeters);
			}

			function candidatePreviews(adapterContext: StageAdapterContext): readonly StageCandidatePreview[] {
				const y = adapterContext.snapshot.domain.datumMeters;
				const priority = room.previews(adapterContext, y) ?? wall.scalarPreviews(y);
				if (priority !== null) return priority;
				if (
					!wall.active &&
					!junction.active &&
					!existingOpening.active &&
					services.stage.session.task() === null
				) {
					const settled = settledPreviews(adapterContext, y, settledRefusal);
					if (settled !== null) return settled;
				}

				const manipulationPreview =
					wall.refusedPreviews(y, refusal) ??
					curve.previews(y) ??
					wall.previews(y) ??
					junction.previews(y, refusal) ??
					existingOpening.previews(adapterContext, y, refusal);
				if (manipulationPreview !== null) return manipulationPreview;

				return existingOpening.repeatPreviews(adapterContext, y) ?? ink.previews(adapterContext, y);
			}
		}
	};

	bindLayoutCompileContext(adapter, lifetime);
	return adapter;
};
