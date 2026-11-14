/**
 * X5 — Ink drawing: the Wall reading's one-operation controller.
 *
 * It owns the Line, Box, Arc and Circle state machines: the live chain draft,
 * the one identity capture shared by preview and acceptance, the in-flight
 * guard, the press lease, the planner preview, the palette controller and the
 * keyboard commands (finish, backtrack, cancel). It plans through the existing
 * drawing planners (`drawing-planners`, `chain`) and accepts through the one
 * coordinator port; it writes no source of its own and owns no geometry
 * algorithm. The Opening reading is its sibling controller
 * (`opening-placement-session`), driven through the same palette.
 *
 * Two lifetimes, kept apart:
 *
 * - **Adapter-lifetime defaults** — thickness, height, reading and wall mode —
 *   live in the shared `InkMemory`, so an accepted write's rebind does not
 *   forget them.
 * - **Captured gesture state** — the draft, its capture, the hover and snap, the
 *   preview, the notice, the press lease and the proposal lease — is created
 *   here per binding. `clear()` and `release()` end it exactly once: a live
 *   chain's proposal lease is released on finish, cancel, backtrack-to-empty,
 *   task close, replacement and disposal, so Undo is never stranded behind it.
 *
 * A refused acceptance leaves the chain editable with its capture kept for the
 * retry; a settled chain never donates its capture to the next one.
 */
import {
	MIN_WALL_ARC_RISE,
	measureWallArc,
	mintLayoutIdCapture,
	planCreateCircularRoom,
	type LayoutVec2,
	type WallChainArc
} from '@portfolio/layout-core';

import {
	stageUnitRevision,
	type GestureAcquisition,
	type ProposalLease,
	type StageAdapterBinding,
	type StageAdapterContext,
	type StageCandidatePreview,
	type StageInkReadingRecord,
	type StageInkReadingSession,
	type StageKeyboardIntent,
	type StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';

import { candidatePreviewOf, type CandidatePaperGeometry } from './candidate-preview';
import {
	EMPTY_CHAIN_DRAFT,
	appendChainPoint,
	backtrackChainPoint,
	boxChainDraft,
	chainPlanRequest,
	classifyTypedChainPoint,
	closeChainDraft,
	isDraftStart,
	pendingLegFacts,
	planChainDraft,
	type ChainDraft,
	type ChainDraftPoint,
	type ChainPlanPreview
} from './chain';
import { circleRoomCreateIntent, wallChainCommitIntent } from './drawing-planners';
import {
	INK_JUNCTION_HIT_CSS_PX,
	LAYOUT_INK_ENTRY,
	LAYOUT_INK_TASK,
	classifyInkPointerTarget,
	pointOnWallCenterline,
	publishInkSurface,
	type InkController,
	type InkPaletteReading,
	type InkPaletteSnapshot,
	type InkPointerTarget,
	type InkWallMode
} from './ink';
import type { OpeningPlacementSession } from './opening-placement-session';
import { openWallFrame, parsePlacementXZ } from './precision';
import type { LayoutSessionPorts } from './session-ports';
import { resolveInkPointSnap, type LayoutSnapWinner } from './snap';
import { pointerDatumPoint, projectedScene } from './stage-pointer';

const EMPTY_CANDIDATE_GEOMETRY: CandidatePaperGeometry = { polygons: [], segments: [] };

/** The Ink task as the binding drives it, across every reading it carries. */
export type InkSession = {
	/** The Ink pointer contract: contributed reading, Opening reading or Wall reading. */
	pointer(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	/** A hover updates the live candidate; it never claims the move. */
	hover(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	/**
	 * The command keys drawing owns while Ink is armed: `finish` and `backtrack` are
	 * the same two commands the palette runs, and `cancel` ends the chain before the
	 * host's unwind disarms the tool. A key the live chain has nothing to say about
	 * is refused, not swallowed.
	 */
	key(intent: StageKeyboardIntent, adapterContext: StageAdapterContext): boolean;
	/** The planner's live candidate for the current reading, in world coordinates. */
	previews(adapterContext: StageAdapterContext, datumMeters: number): readonly StageCandidatePreview[];
	overlay(adapterContext: StageAdapterContext): ReturnType<NonNullable<StageAdapterBinding['overlay']>>;
	/** A contributed reading's proposed body, drawn by the one Canvas. */
	ghosts(adapterContext: StageAdapterContext): ReturnType<NonNullable<StageAdapterBinding['ghosts']>>;
	/** The contributed reading currently selected, or `null` for a built-in. */
	contributedReading(): StageInkReadingRecord | null;
	/** Open the contributed reading's session against this binding when it is selected. */
	ensureContributedSession(): StageInkReadingSession | null;
	/** Publish the palette's chapter: this binding's own live state. */
	publish(): void;
	/**
	 * End every transient with no commit and no document write: the press lease,
	 * the live chain and its proposal, the Opening candidate, the contributed
	 * session and the palette surface. Task close and disposal both end here.
	 */
	release(): void;
};

export function createInkSession(
	ports: Omit<LayoutSessionPorts, 'publish' | 'select'> & { readonly opening: OpeningPlacementSession }
): InkSession {
	const { services, document, levelId, presenter, memory, opening } = ports;

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
	/** A3 — the decided bulge apex and the raw plane point currently shaping it. */
	let inkArcApex: LayoutVec2 | null = null;
	let inkArcHover: LayoutVec2 | null = null;
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

	/** The contributed reading currently selected, or `null` for a built-in. */
	function contributedReading(): StageInkReadingRecord | null {
		if (memory.reading === 'wall' || memory.reading === 'opening') return null;
		return (
			services.stage.inkReadings().find((reading) => reading.id === memory.reading) ?? null
		);
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
		const start = memory.wallMode === 'line' && draft.points.length >= 3 ? draft.points[0] : undefined;
		if (start !== undefined) {
			const { left, top } = adapterContext.evaluation.rect;
			const projected = adapterContext.project([start.point[0], adapterContext.snapshot.domain.datumMeters, start.point[1]]);
			if (projected !== null && Math.hypot(css[0] + left - projected[0], css[1] + top - projected[1]) <= INK_JUNCTION_HIT_CSS_PX) {
				inkSnapWinner = { point: start.point, kind: 'junction', name: 'Junction' };
				return { ...start, css };
			}
		}
		const projected = projectedScene(document, adapterContext);
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
		if (base.points.length >= 2 && isDraftStart(base, inkHover.point, 1e-9)) return { ...base, closed: true };
		const extended = appendChainPoint(base, { point: inkHover.point, target: inkHover.target });
		return 'points' in extended ? extended : base;
	}

	/** Re-plan the draft (with the hover point, when there is one). */
	function refreshInkPreview(): void {
		if (inkHover === null) inkSnapWinner = null;
		// A contributed reading owns its own preview; this binding's Wall chain
		// planner must never speak for it.
		if (memory.reading !== 'wall' && memory.reading !== 'opening') {
			inkPreview = null;
			inkNotice = null;
			return;
		}
		if (memory.reading === 'wall' && memory.wallMode === 'circle') {
			// Circle previews the exact captured centre → rim plan its release
			// commits. The authored rim point is the canonical seam, so the ghost
			// shows the same seam the saved Wall will carry.
			const circle = circlePreviewPoints();
			inkPreview = circle === null ? null : circleDraftPreview(circle);
			if (inkPreview !== null) inkNotice = inkPreview.kind === 'refused' ? inkPreview.message : null;
			return;
		}
		if (memory.reading === 'wall' && memory.wallMode === 'arc') {
			// A3 — the preview is the exact cubic the third activation commits. The
			// planner owns the range refusal, so the Stage shows the drawn bulge and
			// repeats its words rather than clamping the bulge to a semicircle.
			if (draft.points.length < 2) {
				inkPreview = null;
				inkNotice = null;
				return;
			}
			if (inkArcHover !== null) {
				// A pointer on the chord names no bulge: clearing here prevents a
				// stale curve from outliving the bulge the creator moved away from.
				inkArcApex = arcApexAt(inkArcHover);
			}
			if (inkArcApex === null) {
				// Keep the release's words ("pull the bulge…") readable: a chord
				// with no rise is not a plan, but the refusal is still the answer.
				inkPreview = null;
				return;
			}
			inkPreview = planInkDraft(draft, { pointIndex: 0, apex: inkArcApex });
			inkNotice = inkPreview.kind === 'refused' ? inkPreview.message : null;
			return;
		}
		if (memory.reading === 'wall' && memory.wallMode === 'box') {
			// Box previews the very ring its release commits. With no second corner
			// yet there is nothing to plan, and a refusal set by the last release
			// stays readable until the pointer names a new box.
			const box = boxPreviewDraft();
			inkPreview = box === null ? null : planInkDraft(box);
			if (inkPreview !== null) inkNotice = inkPreview.kind === 'refused' ? inkPreview.message : null;
			return;
		}
		const points = linePreviewDraft();
		inkPreview = planInkDraft(points);
		// A refusal is only words for the palette: the live chain is untouched.
		inkNotice =
			inkPreview.kind === 'refused' && points.points.length >= 2 ? inkPreview.message : null;
	}

	/** One planner pass over a draft at the remembered thickness and height. */
	function planInkDraft(target: ChainDraft, arc?: WallChainArc): ChainPlanPreview {
		return planChainDraft({
			document,
			draft: target,
			capture: chainCapture ?? mintLayoutIdCapture(),
			levelId,
			...(memory.thickness === null ? {} : { thickness: memory.thickness }),
			...(memory.height === null ? {} : { height: memory.height }),
			...(arc === undefined ? {} : { arc })
		});
	}

	/**
	 * The bulge apex under a raw working-plane point. Only the perpendicular
	 * rise is kept; a bulge past the semicircle is passed through as drawn so
	 * the canonical planner can refuse it, never silently clamped.
	 */
	function arcApexAt(point: LayoutVec2): LayoutVec2 | null {
		const start = draft.points[0];
		const end = draft.points[1];
		if (start === undefined || end === undefined) return null;
		const measured = measureWallArc(start.point, end.point, point);
		if (measured === null) return null;
		const magnitude = Math.abs(measured.rise);
		if (!(magnitude > 0)) return null;
		const sign = measured.rise < 0 ? -1 : 1;
		const dx = end.point[0] - start.point[0];
		const dz = end.point[1] - start.point[1];
		const mx = (start.point[0] + end.point[0]) / 2;
		const mz = (start.point[1] + end.point[1]) / 2;
		return [mx - (dz / measured.chord) * magnitude * sign, mz + (dx / measured.chord) * magnitude * sign];
	}

	/**
	 * Circle's two authored points: a centre tap (or the live press) and the
	 * rim under the pointer. The rim is the canonical seam, exactly as D9
	 * requires; no separate circle geometry is inferred later.
	 */
	function circlePreviewPoints(): { center: ChainDraftPoint; rim: ChainDraftPoint } | null {
		const placed = draft.points[0];
		const pressed = inkPress?.pressTarget;
		const center = placed ?? (pressed === undefined ? null : { point: pressed.point, target: pressed.target });
		if (center === null || inkHover === null) return null;
		if (Math.hypot(inkHover.point[0] - center.point[0], inkHover.point[1] - center.point[1]) < 1e-9) return null;
		return { center, rim: { point: inkHover.point, target: inkHover.target } };
	}

	/**
	 * The live Circle preview plan, once per distinct centre → rim, size and
	 * capture (E4). The preview reads only its outcome and words; the release
	 * plans for itself through `planCircleDraft`.
	 */
	function circleDraftPreview(circle: { center: ChainDraftPoint; rim: ChainDraftPoint }): ChainPlanPreview {
		return presenter.proposal(
			[
				'circle', document, chainCapture, memory.thickness, memory.height,
				circle.center.point[0], circle.center.point[1], circle.rim.point[0], circle.rim.point[1]
			],
			() => planCircleDraft(circle.center, circle.rim)
		);
	}

	/** One retained circular-Room plan over the live centre → rim pair. */
	function planCircleDraft(center: ChainDraftPoint, rim: ChainDraftPoint): ChainPlanPreview {
		const plan = planCreateCircularRoom({
			baseline: document,
			center: [center.point[0], center.point[1]],
			rim: [rim.point[0], rim.point[1]],
			capture: chainCapture ?? mintLayoutIdCapture(),
			levelId,
			roomNamePrefix: 'Room',
			...(memory.thickness === null ? {} : { thickness: memory.thickness }),
			...(memory.height === null ? {} : { height: memory.height })
		});
		if (plan.kind === 'rejected') {
			return { kind: 'refused', code: plan.rejection.code, message: plan.rejection.message };
		}
		return {
			kind: 'planned',
			document: plan.document,
			authoredWallIds: [plan.wallId],
			createdWallIds: [plan.wallId],
			createdJunctionIds: [plan.junctionId],
			splitWallIds: [],
			createdRoomIds: [...plan.createdRoomIds],
			retiredRoomIds: [],
			consequence: { kind: 'encloses', summary: 'Creates one circular Room on finish.' }
		};
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

	/**
	 * Accept one Circle as one captured closed-Wall intent. The preview and
	 * the commit use the same capture and the same centre/rim points, so the
	 * seam is exactly the authored rim and a replay reproduces both ids.
	 */
	async function commitCircle(center: ChainDraftPoint, rim: ChainDraftPoint): Promise<void> {
		if (chainCommitInFlight) return;
		const capture = chainCapture ?? mintLayoutIdCapture();
		const planned = planCircleDraft(center, rim);
		if (planned.kind === 'refused') {
			inkNotice = planned.message;
			publish();
			return;
		}
		chainCommitInFlight = true;
		try {
			const snapshot = services.stage.snapshot();
			const outcome = await services.authoring.accept(
				circleRoomCreateIntent({
					payload: {
						center: [center.point[0], center.point[1]],
						rim: [rim.point[0], rim.point[1]],
						thickness: memory.thickness,
						height: memory.height
					},
					capture,
					operationId: globalThis.crypto.randomUUID(),
					projectId: snapshot.acceptedRevision.projectId,
					revisionId: services.authoring.acceptedRevision().revisionId,
					contentRevision: stageUnitRevision(snapshot, 'layout'),
					levelId
				})
			);
			if (outcome.kind === 'refused') {
				inkNotice = outcome.message;
				publish();
				return;
			}
			const wallId = planned.authoredWallIds[0] ?? null;
			clearChain();
			const fresh = services.stage.snapshot();
			if (wallId !== null) {
				services.stage.select({
					sourceId: wallId,
					sourceKind: 'wall',
					generationId: fresh.compileGeneration,
					ref: {
						sourceId: wallId,
						sourceKind: 'wall',
						generationId: fresh.compileGeneration,
						stream: 'projected',
						subRef: null
					}
				});
			}
			services.stage.openContributedTask(LAYOUT_INK_ENTRY, 'layout');
			services.stage.notifySurfaceChange();
		} finally {
			chainCommitInFlight = false;
		}
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
		const boxMode = memory.reading === 'wall' && memory.wallMode === 'box';
		const circleMode = memory.reading === 'wall' && memory.wallMode === 'circle';
		const arcMode = memory.reading === 'wall' && memory.wallMode === 'arc';
		const withHover = circleMode || arcMode ? draft : linePreviewDraft();
		const effective = boxMode ? (boxPreviewDraft() ?? draft)
			: 'points' in withHover ? withHover : draft;
		const pending =
			inkHover === null || boxMode || circleMode || arcMode
				? null
				: pendingLegFacts(linePreviewBase(), inkHover.point);
		const anchor = boxMode ? boxAnchor() : null;
		const box =
			anchor === null || inkHover === null
				? null
				: {
						width: Math.abs(inkHover.point[0] - anchor.point[0]),
						depth: Math.abs(inkHover.point[1] - anchor.point[1])
					};
		const arc =
			arcMode && draft.points.length >= 2 && inkArcApex !== null
				? (() => {
						const measured = measureWallArc(draft.points[0]!.point, draft.points[1]!.point, inkArcApex!);
						return measured === null
							? null
							: {
									chord: measured.chord,
									rise: measured.rise,
									radius: measured.radius,
									belowMinimum: Math.abs(measured.rise) < MIN_WALL_ARC_RISE
								};
					})()
				: null;
		return {
			options: { thickness: memory.thickness, height: memory.height },
			reading: memory.reading,
			wallMode: memory.wallMode,
			arc,
			box,
			readings: paletteReadings(),
			opening: memory.reading === 'opening' ? opening.paletteView() : null,
			points: effective.points.map((entry) => [entry.point[0], entry.point[1]] as LayoutVec2),
			closed: effective.closed,
			canFinish: !boxMode && !circleMode && !arcMode && draft.points.length >= 2,
			canClose: !boxMode && !circleMode && !arcMode && draft.points.length >= 3 && !draft.closed,
			canBacktrack: draft.points.length > 0,
			consequence:
				inkPreview !== null &&
				inkPreview.kind === 'planned' &&
				(circleMode || arcMode || effective.points.length >= 2)
					? inkPreview.consequence.summary
					: null,
			pending,
			refusal: inkNotice
		};
	}

	/** Begin the live chain: one capture and one proposal lease per operation. */
	function beginChain(point: ChainDraftPoint): void {
		draft = { points: [point], closed: false };
		inkArcApex = null;
		inkArcHover = null;
		chainCapture = mintLayoutIdCapture();
		inkProposal?.release();
		inkProposal = services.stage.session.registerProposal({
			owner: LAYOUT_INK_TASK,
			reason: 'A Wall chain is live; finish it or cancel it — Undo is available once it settles.'
		});
		inkNotice = null;
		refreshInkPreview();
		publish();
	}

	/** Drop the live chain's last point, keeping the operation alive while any remain. */
	function backtrackChain(): void {
		draft = backtrackChainPoint(draft);
		if (draft.points.length < 2) {
			inkArcApex = null;
			inkArcHover = null;
		}
		if (draft.points.length === 0) {
			inkProposal?.release();
			inkProposal = null;
			chainCapture = null;
		}
		inkNotice = null;
		refreshInkPreview();
		publish();
	}

	/** Drop the live chain and its proposal, exactly once. */
	function clearChain(): void {
		draft = EMPTY_CHAIN_DRAFT;
		inkArcApex = null;
		inkArcHover = null;
		chainCapture = null;
		inkHover = null;
		inkSnapWinner = null;
		inkPreview = null;
		inkNotice = null;
		inkProposal?.release();
		inkProposal = null;
		publish();
	}

	/** The chapter the palette reads: the live binding's own state. */
	function publish(): void {
		if (!ports.inkTaskOpen()) {
			publishInkSurface(null);
			return;
		}
		const controller: InkController = {
			setReading: (next) => {
				if (next === memory.reading) return;
				if (!paletteReadings().some((reading) => reading.id === next)) {
					inkNotice = 'That reading is not available in this project.';
					publish();
					return;
				}
				if (draft.points.length > 0) {
					inkNotice = 'Finish or cancel the Wall chain before switching readings.';
					publish();
					return;
				}
				// A contributed reading owns live input too; a switch must not
				// silently throw away a half-drawn outline or a chosen depth.
				if (contributedSession?.session.hasWork?.() === true) {
					inkNotice = 'Finish or cancel the live reading before switching readings.';
					publish();
					return;
				}
				// A contributed reading's session lives only while it is selected.
				endContributedSession();
				if (next === 'opening') opening.captureHost();
				memory.reading = next;
				inkNotice = null;
				// The palette remounts from the last valid options on the next Opening
				// reading, so its fields and the adapter agree again.
				if (next === 'opening') memory.openingOptionsValid = true;
				opening.clear();
				inkHover = null;
				if (next === 'wall') refreshInkPreview();
				else if (next !== 'opening') ensureContributedSession();
				services.stage.notifySurfaceChange();
				publish();
			},
			setWallMode: (mode: InkWallMode) => {
				if (mode === memory.wallMode) return;
				if (draft.points.length > 0 || inkPress !== null) {
					inkNotice = 'Finish or cancel the Wall chain before switching between Line, Arc, Box and Circle.';
					publish();
					return;
				}
				memory.wallMode = mode;
				inkNotice = null;
				inkArcApex = null;
				inkArcHover = null;
				inkHover = null;
				refreshInkPreview();
				services.stage.notifySurfaceChange();
				publish();
			},
			setOpeningOptions: (options) => opening.setOptions(options),
			placeOpening: (offsetText) => opening.placeAtOffset(offsetText),
			finish: () => {
				if (memory.reading === 'wall' && memory.wallMode === 'arc') {
					if (draft.points.length < 2 || inkArcApex === null) {
						inkNotice = 'An Arc needs a start, an end and a bulge.';
						publish();
						return;
					}
					void commitChain(draft, { pointIndex: 0, apex: inkArcApex });
					return;
				}
				void commitChain();
			},
			close: () => {
				if (memory.reading === 'wall' && memory.wallMode === 'arc') {
					inkNotice = 'An Arc is one open Wall; a ring is closed with Line.';
					publish();
					return;
				}
				const closed = closeChainDraft(draft);
				if ('points' in closed) void commitChain(closed);
				else {
					inkNotice = closed.message;
					publish();
				}
			},
			backtrack: () => backtrackChain(),
			cancel: () => clearChain(),
			typePoint: (xText: string, zText: string) => {
				const parsed = parsePlacementXZ(xText, zText);
				if (!parsed.ok) {
					inkNotice = parsed.reason;
					publish();
					return;
				}
				if (memory.reading === 'wall' && memory.wallMode === 'arc' && draft.points.length >= 2) {
					inkNotice = 'An Arc takes its bulge from the Stage: move the pointer and click to finish.';
					publish();
					return;
				}
				const next = classifyTypedChainPoint(document, parsed.point);
				appendInkPoint(next);
			},
			setOptions: (options) => {
				memory.thickness = options.thickness;
				memory.height = options.height;
				refreshInkPreview();
				publish();
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
			publish();
			return;
		}
		draft = appended;
		if (memory.reading === 'wall' && memory.wallMode === 'arc') {
			inkArcApex = null;
			inkArcHover = null;
		}
		inkNotice = null;
		inkHover = null;
		refreshInkPreview();
		publish();
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
		if (draft.points.length >= 2 && isDraftStart(draft, release.point, 1e-9)) {
			void commitChain({ ...draft, closed: true });
			return;
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
	async function commitChain(override?: ChainDraft, arc?: WallChainArc): Promise<void> {
		// One chain, one acceptance. A second activation of the same command (a
		// focused Finish button activated by the very keydown the host maps) is the
		// same creator intent, not a second operation.
		if (chainCommitInFlight) return;
		const target = override ?? draft;
		if (target.points.length < 2) {
			inkNotice = 'A chain needs at least two points.';
			publish();
			return;
		}
		chainCommitInFlight = true;
		try {
			await commitChainOnce(target, arc);
		} finally {
			chainCommitInFlight = false;
		}
	}

	/** The one acceptance pass; `commitChain` owns the in-flight guard. */
	async function commitChainOnce(target: ChainDraft, arc?: WallChainArc): Promise<void> {
		const capture = chainCapture ?? mintLayoutIdCapture();
		const request = chainPlanRequest(target);
		const payload = {
			points: request.points,
			close: request.close,
			junctionSnaps: request.endpointJunctionSnaps,
			hostSnaps: request.endpointHostSnaps,
			thickness: memory.thickness,
			height: memory.height,
			...(arc === undefined ? {} : { arc })
		};
		const planned = planChainDraft({
			document,
			draft: target,
			capture,
			levelId,
			...(memory.thickness === null ? {} : { thickness: memory.thickness }),
			...(memory.height === null ? {} : { height: memory.height }),
			...(arc === undefined ? {} : { arc })
		});
		if (planned.kind === 'refused') {
			// Refused in words, with a repair: the chain stays exactly as it was and
			// no source is written.
			inkNotice = planned.message;
			publish();
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
			publish();
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
				publish();
				return false;
			}
			const acquisition = services.stage.acquireGesture({
				owner: LAYOUT_INK_TASK,
				evaluationId: intent.evaluationId,
				policy: 'cancel-on-reading-change'
			});
			if (acquisition.kind !== 'granted') {
				inkNotice = `The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`;
				publish();
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
			const pressedArcHover = pointerDatumPoint(adapterContext, intent.css);
			inkArcHover = pressedArcHover === null ? null : [pressedArcHover[0], pressedArcHover[1]];
			refreshInkPreview();
			services.stage.notifySurfaceChange();
			publish();
			return true;
		}
		const current = inkPress;
		if (current === null) return false;
		if (intent.phase === 'cancel') {
			endInkPress();
			inkHover = null;
			refreshInkPreview();
			services.stage.notifySurfaceChange();
			publish();
			return true;
		}
		if (intent.evaluationId !== current.evaluationId) {
			// Reading flip: the press was measured in a projection that no longer
			// describes what is drawn. End the press and keep the live chain.
			endInkPress();
			inkHover = null;
			refreshInkPreview();
			services.stage.notifySurfaceChange();
			publish();
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
			const movedArcHover = pointerDatumPoint(adapterContext, intent.css);
			inkArcHover = movedArcHover === null ? null : [movedArcHover[0], movedArcHover[1]];
			if (memory.reading === 'wall' && memory.wallMode === 'arc') inkNotice = null;
			refreshInkPreview();
			services.stage.notifySurfaceChange();
			publish();
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
		if (memory.reading === 'wall' && memory.wallMode === 'arc') {
			// A3 — start, end, bulge. A drag from the first point names both
			// endpoints in one gesture; the third activation sets the bulge.
			const apexPoint = pointerDatumPoint(adapterContext, intent.css);
			const rawRelease: LayoutVec2 =
				apexPoint === null ? [release.point[0], release.point[1]] : [apexPoint[0], apexPoint[1]];
			if (draft.points.length === 0) {
				beginChain({ point: pressTarget.point, target: pressTarget.target });
				if (travel > 4) {
					const appended = appendChainPoint(draft, { point: release.point, target: release.target });
					if ('points' in appended) {
						draft = appended;
						inkArcApex = null;
					}
				}
			} else if (draft.points.length === 1) {
				const appended = appendChainPoint(draft, { point: release.point, target: release.target });
				if ('points' in appended) {
					draft = appended;
					inkArcApex = null;
				} else {
					inkNotice = appended.message;
				}
			} else {
				const bulge = arcApexAt(rawRelease);
				if (bulge !== null) {
					inkArcApex = bulge;
					inkArcHover = rawRelease;
					// The commit's own refusal words must survive: re-planning here
					// could clear a policy refusal the preview never ran.
					void commitChain(draft, { pointIndex: 0, apex: bulge });
					publish();
					return true;
				}
				inkNotice = 'Pull the bulge away from the chord to set the Arc.';
			}
			refreshInkPreview();
			publish();
			return true;
		}
		if (memory.reading === 'wall' && memory.wallMode === 'box') {
			// Box: a drag names both corners; a tap names the first corner, and the
			// next tap the opposite one.
			const releasePoint: ChainDraftPoint = { point: release.point, target: release.target };
			if (travel > 4) commitBox(draft.points[0] ?? { point: pressTarget.point, target: pressTarget.target }, releasePoint);
			else if (draft.points.length === 0) beginChain(releasePoint);
			else commitBox(draft.points[0]!, releasePoint);
		} else if (memory.reading === 'wall' && memory.wallMode === 'circle') {
			// Circle: a drag names centre → rim in one gesture; a tap names the
			// centre, and the next tap names the rim. The rim is released exactly
			// where the creator finished, so it is the canonical seam.
			const releasePoint: ChainDraftPoint = { point: release.point, target: release.target };
			if (travel > 4) {
				void commitCircle(
					draft.points[0] ?? { point: pressTarget.point, target: pressTarget.target },
					releasePoint
				);
			} else if (draft.points.length === 0) beginChain(releasePoint);
			else void commitCircle(draft.points[0]!, releasePoint);
		} else if (travel <= 4) appendInkPoint({ point: release.point, target: release.target });
		else dragInkWall(pressTarget, release);
		refreshInkPreview();
		services.stage.notifySurfaceChange();
		publish();
		return true;
	}

	/**
	 * The Wall reading's live candidate: the ring, Arc, Circle or cursor the creator
	 * is aiming, from the planner's own candidate document through the existing
	 * compile + Paper path. A refusal contributes only its words. Nothing is persisted.
	 */
	function previews(adapterContext: StageAdapterContext, y: number): readonly StageCandidatePreview[] {
		const world = (point: readonly [number, number], elevation = y): [number, number, number] => [point[0], elevation, point[1]];
		const snapOf = (winner: LayoutSnapWinner | null) =>
			winner === null ? undefined : { world: world(winner.point), name: winner.name };
		if (memory.reading === 'opening') return opening.previews(adapterContext, y);

		// A3 — Arc's preview is the canonical cubic the third activation commits.
		// Until the bulge is named, the chord and its length stand in; a straight
		// fallback says so in words before the creator accepts it.
		if (memory.reading === 'wall' && memory.wallMode === 'arc') {
			const start = draft.points[0];
			const end = draft.points[1];
			if (start === undefined) {
				return [];
			}
			if (end === undefined) {
				if (inkHover === null) return [];
				const length = Math.hypot(
					inkHover.point[0] - start.point[0],
					inkHover.point[1] - start.point[1]
				);
				return [candidatePreviewOf({
					id: 'layout-candidate-arc-cursor',
					role: 'subject',
					drawing: true,
					geometry: { polygons: [], segments: [[world(start.point), world(inkHover.point)]] },
					labels: [{ world: world(inkHover.point), text: `${length.toFixed(2)} m` }],
					snap: snapOf(inkSnapWinner)
				})];
			}
			const chord = Math.hypot(end.point[0] - start.point[0], end.point[1] - start.point[1]);
			const midpoint: [number, number] = [
				(start.point[0] + end.point[0]) / 2,
				(start.point[1] + end.point[1]) / 2
			];
			if (inkArcApex === null) {
				return [candidatePreviewOf({
					id: 'layout-candidate-arc',
					role: 'subject',
					drawing: true,
					geometry: { polygons: [], segments: [[world(start.point), world(end.point)]] },
					labels: [{ world: world(midpoint), text: `${chord.toFixed(2)} m · pull the bulge` }]
				})];
			}
			const measured = measureWallArc(start.point, end.point, inkArcApex);
			const fallback = measured !== null && Math.abs(measured.rise) < MIN_WALL_ARC_RISE;
			const facts =
				measured === null
					? null
					: fallback
						? `Line · rise under ${MIN_WALL_ARC_RISE.toFixed(2)} m`
						: `Rise ${Math.abs(measured.rise).toFixed(2)} m · R ${Number.isFinite(measured.radius) ? measured.radius.toFixed(2) : '∞'} m`;
			if (inkPreview?.kind === 'planned') {
				const wallId = inkPreview.authoredWallIds[0];
				const frame = wallId === undefined ? null : openWallFrame(inkPreview.document, wallId);
				const segments =
					frame === null
						? ([[world(start.point), world(end.point)]] as const)
						: frame.samples
								.slice(1)
								.map((sample, index) => [world(frame.samples[index]!.point), world(sample.point)] as const);
				const closesRoom = inkPreview.createdRoomIds.length > 0;
				const built = closesRoom
					? ports.candidatePaper(inkPreview.document, y, new Set(inkPreview.createdRoomIds), new Set())
					: null;
				const labels: { world: [number, number, number]; text: string }[] = [];
				if (facts !== null) labels.push({ world: world(inkArcApex), text: facts });
				if (closesRoom) {
					labels.push({
						world: world(start.point),
						text: inkPreview.createdRoomIds.length === 1 ? 'Creates 1 Room' : `Creates ${inkPreview.createdRoomIds.length} Rooms`
					});
				}
				return [candidatePreviewOf({
					id: 'layout-candidate-arc',
					role: 'subject',
					drawing: true,
					geometry: { polygons: built?.paper.subject.polygons ?? [], segments },
					labels
				})];
			}
			if (inkPreview?.kind === 'refused') {
				return [candidatePreviewOf({
					id: 'layout-candidate-arc-refused',
					role: 'refused',
					geometry: { polygons: [], segments: [[world(start.point), world(end.point)]] },
					labels: [{ world: world(inkArcApex), text: inkPreview.message }]
				})];
			}
			return [];
		}

		// Circle is one authored closed-Wall intent, so its live preview is the
		// authored ring itself. The radius leg stays a measurement label; it is
		// never the primary shape the creator sees while aiming.
		if (memory.reading === 'wall' && memory.wallMode === 'circle') {
			const circle = circlePreviewPoints();
			if (circle === null) return [];
			const radius = Math.hypot(
				circle.rim.point[0] - circle.center.point[0],
				circle.rim.point[1] - circle.center.point[1]
			);
			if (!(radius > 0)) return [];
			const planned = circleDraftPreview(circle);
			const segments: [[number, number, number], [number, number, number]][] = [];
			const steps = 64;
			for (let index = 0; index < steps; index += 1) {
				const from = (index / steps) * Math.PI * 2;
				const to = ((index + 1) / steps) * Math.PI * 2;
				segments.push([
					[
						circle.center.point[0] + Math.cos(from) * radius,
						y,
						circle.center.point[1] + Math.sin(from) * radius
					],
					[
						circle.center.point[0] + Math.cos(to) * radius,
						y,
						circle.center.point[1] + Math.sin(to) * radius
					]
				]);
			}
			const facts = `r ${radius.toFixed(2)} m · ⌀ ${(radius * 2).toFixed(2)} m`;
			return [candidatePreviewOf({
				id: 'layout-candidate-circle',
				role: planned.kind === 'refused' ? 'refused' : 'subject',
				geometry: { polygons: [], segments },
				labels: [{ world: world(circle.center.point), text: planned.kind === 'refused' ? `${facts} — ${planned.message}` : facts }],
				snap: snapOf(inkSnapWinner)
			})];
		}

		// Wall chain / Box, including the cursor point before a plan exists.
		const boxMode = memory.wallMode === 'box';
		const live = boxMode
			? (boxPreviewDraft() ?? draft)
			: linePreviewDraft();
		const points = 'points' in live ? live.points : draft.points;
		if (inkPreview?.kind === 'planned') {
			const closesRoom = !boxMode && live.closed && inkPreview.createdRoomIds.length > 0;
			const subjectIds = new Set(closesRoom ? inkPreview.createdRoomIds : []);
			const affectedIds = new Set(inkPreview.splitWallIds);
			const built = subjectIds.size > 0 || affectedIds.size > 0
				? ports.candidatePaper(inkPreview.document, y, subjectIds, affectedIds)
				: null;
			const geometry = {
				polygons: built?.paper.subject.polygons ?? [],
				segments: [
					...points.slice(1).map((point, i) => [world(points[i]!.point), world(point.point)] as const),
					...(live.closed && points.length > 2 ? [[world(points.at(-1)!.point), world(points[0]!.point)] as const] : [])
				]
			};
			const labels: { world: [number, number, number]; text: string }[] = [];
			if (closesRoom) {
				const count = inkPreview.createdRoomIds.length;
				labels.push({ world: world(points[0]!.point), text: count === 1 ? 'Creates 1 Room' : `Creates ${count} Rooms` });
			} else if (inkHover !== null && !boxMode) {
				const pending = pendingLegFacts(linePreviewBase(), inkHover.point);
				if (pending !== null) labels.push({ world: world(inkHover.point), text: `${pending.length.toFixed(2)} m` });
			}
			if (boxMode && inkHover !== null) {
				const anchor = boxAnchor();
				if (anchor !== null) {
					labels.push({
						world: world(inkHover.point),
						text: `${Math.abs(inkHover.point[0] - anchor.point[0]).toFixed(2)} × ${Math.abs(inkHover.point[1] - anchor.point[1]).toFixed(2)} m`
					});
				}

			}
			return [
				candidatePreviewOf({
					id: 'layout-candidate-chain', role: 'subject', drawing: true, geometry, labels,
					snap: closesRoom ? { world: world(points[0]!.point), name: 'Close Room' } : snapOf(inkSnapWinner)
				}),
				...(built === null || (built.paper.affected.polygons.length === 0 && built.paper.affected.segments.length === 0)
					? []
					: [candidatePreviewOf({ id: 'layout-candidate-chain-affected', role: 'affected', geometry: built.paper.affected })])
			];
		}
		if (inkPreview?.kind === 'refused' && points.length >= 2) {
			// The placed legs stay drawn: only the live leg is refused (review
			// pass 2 §3). They are the same ink line the creator already drew.
			const placed = live.closed ? points : points.slice(0, -1);
			const from = live.closed ? points.at(-1)! : points.at(-2)!;
			const to = live.closed ? points[0]! : points.at(-1)!;
			return [...(placed.length < 2 ? [] : [candidatePreviewOf({
				id: 'layout-candidate-chain',
				role: 'subject',
				drawing: true,
				geometry: { polygons: [], segments: placed.slice(1).map((point, i) => [world(placed[i]!.point), world(point.point)] as const) }
			})]), candidatePreviewOf({
				id: 'layout-candidate-chain-refused',
				role: 'refused',
				// A dashed cursor reach names the refused input, never a Wall band.
				geometry: { polygons: [], segments: [[world(from.point), world(to.point)]] },
				labels: [{ world: world(to.point), text: inkPreview.message }]
			})];
		}
		if (inkHover !== null && linePreviewBase().points.length > 0) {
			const last = linePreviewBase().points.at(-1)!.point;
			const pending = pendingLegFacts(linePreviewBase(), inkHover.point);
			return [candidatePreviewOf({
				id: 'layout-candidate-cursor',
				role: 'subject',
				drawing: true,
				geometry: { polygons: [], segments: [[world(last), world(inkHover.point)]] },
				labels: pending === null ? [] : [{ world: world(inkHover.point), text: `${pending.length.toFixed(2)} m` }],
				snap: snapOf(inkSnapWinner)
			})];
		}
		if (inkHover !== null && inkSnapWinner !== null) {
			return [candidatePreviewOf({
				id: 'layout-candidate-cursor',
				role: 'subject',
				drawing: true,
				geometry: EMPTY_CANDIDATE_GEOMETRY,
				snap: snapOf(inkSnapWinner)
			})];
		}
		return [];
	}

	/** The Ink hover: a contributed reading's, the Opening's, or the live chain's. */
	function hover(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {
		if (memory.reading !== 'wall' && memory.reading !== 'opening') {
			const session = ensureContributedSession();
			if (session === null) return false;
			const claimed = session.hover?.(intent, adapterContext) ?? false;
			if (claimed) publish();
			return claimed;
		}
		if (memory.reading === 'opening') return opening.hover(intent, adapterContext);
		// A Wall-reading hover updates the live chain. It never claims a move:
		// the host's navigation gesture and the next press stay the host's.
		if (intent.phase !== 'move') return false;
		if (memory.reading === 'wall' && memory.wallMode === 'arc') {
			const hoveredArc = pointerDatumPoint(adapterContext, intent.css);
			inkArcHover = hoveredArc === null ? null : [hoveredArc[0], hoveredArc[1]];
			inkNotice = null;
		}
		inkHover = inkTargetAt(adapterContext, intent.css);
		refreshInkPreview();
		services.stage.notifySurfaceChange();
		publish();
		return true;
	}

	/** The pointer contract across readings: contributed, Opening, then Wall. */
	function pointer(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {
		if (memory.reading !== 'wall' && memory.reading !== 'opening') {
			const session = ensureContributedSession();
			if (session === null) {
				inkNotice = 'That reading is not available in this project.';
				publish();
				return false;
			}
			const claimed = session.pointer(intent, adapterContext);
			publish();
			return claimed;
		}
		if (memory.reading === 'opening') return opening.pointer(intent, adapterContext);
		return inkPointer(intent, adapterContext);
	}

	function key(intent: StageKeyboardIntent, adapterContext: StageAdapterContext): boolean {
		if (memory.reading !== 'wall' && memory.reading !== 'opening') {
			const session = ensureContributedSession();
			if (session === null) return false;
			const claimed = session.key?.(intent, adapterContext) ?? false;
			publish();
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
	}

	function overlay(adapterContext: StageAdapterContext): ReturnType<NonNullable<StageAdapterBinding['overlay']>> {
		if (memory.reading !== 'wall' && memory.reading !== 'opening') {
			return contributedSession?.session.overlay?.(adapterContext) ?? [];
		}
		if (memory.reading === 'opening') return opening.overlay(adapterContext);
		// The Wall reading's marks are the Stage's own candidate geometry, never a
		// second overlay drawing.
		return [];
	}

	function ghosts(adapterContext: StageAdapterContext): ReturnType<NonNullable<StageAdapterBinding['ghosts']>> {
		if (memory.reading === 'wall' || memory.reading === 'opening') return [];
		return contributedSession?.session.ghosts?.(adapterContext) ?? [];
	}

	return {
		pointer,
		hover,
		key,
		previews,
		overlay,
		ghosts,
		contributedReading,
		ensureContributedSession,
		publish,
		release() {
			endInkPress();
			clearChain();
			opening.clear();
			endContributedSession();
			publishInkSurface(null);
		}
	};
}
