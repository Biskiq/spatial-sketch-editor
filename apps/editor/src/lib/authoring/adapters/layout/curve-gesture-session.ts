import {
	planResizeClosedWallRadius,
	planTranslateClosedWall,
	prepareWallBend,
	proposeWallKnotRemoval,
	validateWallFirstOpeningSubset,
	type LayoutWallCenterline,
	wallCenterlineSamples,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import {
	type StageAdapterContext,
	type StageCardActionOutcome,
	type StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';
import { stageLayout, stageUnitRevision } from '$lib/authoring/stage/stage-adapter-host';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-adapter-host';

import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
import { WALL_UNFOLD_SHAPE_REFUSAL } from '$lib/layout/wall-unfold';
import { wallRefusalWords } from './refusals';
import { circleRadiusIntent, circleTranslateIntent } from './drawing-planners';
import { pointerDatumPoint } from './stage-pointer';
import {
	curvedWallPointAt,
	previewWallKnotDelete,
	wallBendIntent,
	wallKnotDeleteIntent,
	wallStationAtPoint,
	wallStationNearPoint,
	type OpenWallFrame
} from './precision';
import { candidatePreviewOf } from './candidate-preview';
import { selectedClosedWall, selectedOpenWall, selectedCurvedWall } from './layout-subjects';
import {
	distanceToChord,
	isPointerDrag,
	previewCoordinates,
	wallProposalPaper,
	type LayoutManipulationPorts
} from './manipulation-support';
import { type LayoutSessionPorts } from './session-ports';

/** One claimed Bend gesture: a body press anywhere on an open Wall. */
type BendGesture = {
	readonly evaluationId: string;
	readonly pressCss: readonly [number, number];
	readonly markId: string;
	readonly wallId: string;
	/** Captured identity the write may insert; preview and commit share it. */
	readonly knotId: string;
	readonly frame: OpenWallFrame;
	/** Physical station the press resolved on the sampled centerline. */
	readonly distance: number;
	/** The captured point on the Wall and the pointer-to-point grab offset. */
	readonly anchor: LayoutVec2;
	readonly grabOffset: LayoutVec2;
	readonly existingKnot: boolean;
	readonly lease: GestureAcquisition | null;
	readonly revision: string;
	readonly shape: ReturnType<typeof prepareWallBend>;
	readonly openingRefusal: (centerline: LayoutWallCenterline) => string | null;
	readonly removalRefusal: string | null;
	readonly removedPoints: readonly LayoutVec2[] | null;
	readonly removalChord: readonly [LayoutVec2, LayoutVec2] | null;
	intent: { readonly distance: number; readonly point: LayoutVec2 } | null;
	previewPoints: readonly LayoutVec2[] | null;
	/** Snapped into the neighbour chord: release removes this existing knot. */
	removal: boolean;
	/** The pointer has left the removal zone since press; leaving arms removal. */
	leftRemovalZone: boolean;
	/** Display-only attempted centerline, retained through validation refusal. */
	attemptPoints: readonly LayoutVec2[];
	attemptPoint: LayoutVec2 | null;
	refusal: string | null;
};

/** A body press is on the Wall when its sampled centerline is this near, in metres. */
const BEND_BODY_TOLERANCE_METERS = 0.35;
/** A held knot enters the remove zone inside this distance of its neighbour chord. */
const REMOVE_ENTER_METERS = 0.12;
/** It must leave this wider zone once before removal can arm; the hysteresis stops flicker. */
const REMOVE_LEAVE_METERS = 0.3;
export function createCurveGestureSession({
	services,
	document,
	levelId,
	contentRevision,
	publishRefusal,
	settleRefusal,
	candidatePaper
}: LayoutManipulationPorts & Pick<LayoutSessionPorts, 'candidatePaper'>) {
	/**
	 * Hover discovery for the selected Wall's Bend writer. It names the span
	 * midpoint under the pointer, using the same sampled frame and the same
	 * span boundaries the span rings use. Ephemeral: no mark is installed and
	 * no gesture is armed, so a body press still means Move.
	 */
	let idleBendHint: {
		readonly wallId: string;
		readonly point: LayoutVec2;
		readonly station: number;
	} | null = null;
	/** Release the live manipulation lease and drop the in-flight gesture. */
	let bendGesture: BendGesture | null = null;
	/** C2 — one radius grip drag on a selected closed Wall. */
	type CircleRadiusGesture = {
		readonly evaluationId: string;
		readonly pressCss: readonly [number, number];
		readonly lease: Extract<GestureAcquisition, { kind: 'granted' }>;
		readonly wallId: string;
		readonly baseline: LayoutDocumentWallFirst;
		readonly center: LayoutVec2;
		preview: LayoutDocumentWallFirst | null;
		radius: number | null;
		refusal: string | null;
	};
	let circleRadiusGesture: CircleRadiusGesture | null = null;
	function endCircleRadius(): void {
		const current = circleRadiusGesture;
		circleRadiusGesture = null;
		if (current?.lease.lease.active) current.lease.lease.release();
	}
	/** D8 — one rigid body drag on a selected closed Wall. */
	type CircleTranslateGesture = {
		readonly evaluationId: string;
		readonly lease: Extract<GestureAcquisition, { kind: 'granted' }>;
		readonly wallId: string;
		readonly baseline: LayoutDocumentWallFirst;
		readonly pressPoint: LayoutVec2;
		preview: LayoutDocumentWallFirst | null;
		delta: LayoutVec2 | null;
		refusal: string | null;
	};
	let circleTranslateGesture: CircleTranslateGesture | null = null;
	function endCircleTranslate(): void {
		const current = circleTranslateGesture;
		circleTranslateGesture = null;
		if (current?.lease.lease.active) current.lease.lease.release();
	}
	/**
	 * C1/D2 — the bend point the Card currently names. It is selection-scoped
	 * session state: never serialized, cleared by Escape or a different host,
	 * and read by both the marks and the Card's one action channel.
	 */
	let activeKnot: { readonly wallId: string; readonly knotId: string } | null = null;
	function endBendGesture(): void {
		const current = bendGesture;
		bendGesture = null;
		if (current?.lease?.kind === 'granted' && current.lease.lease.active) current.lease.lease.release();
	}

	/**
	 * D2 — one bend-point removal for both callers: the Card action and the
	 * Delete/Backspace key. The keyboard must not grow a second write path, so it
	 * calls exactly this helper: preview the retained planner, capture one intent,
	 * accept it once, then clear the session's active knot.
	 */
	async function removeWallKnot(wallId: string, knotId: string): Promise<StageCardActionOutcome> {
		const preview = previewWallKnotDelete(document, wallId, knotId);
		if (preview.kind === 'refused') return { kind: 'refused', message: preview.message };
		const snapshot = services.stage.snapshot();
		const outcome = await services.authoring.accept(
			wallKnotDeleteIntent({
				wallId,
				knotId,
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: services.authoring.acceptedRevision().revisionId,
				contentRevision: stageUnitRevision(snapshot, 'layout'),
				levelId: snapshot.domain.layoutLevelId
			})
		);
		if (outcome.kind === 'refused') return { kind: 'refused', message: outcome.message };
		if (activeKnot?.wallId === wallId && activeKnot.knotId === knotId) activeKnot = null;
		services.stage.notifySurfaceChange();
		return { kind: 'accepted' };
	}

	async function commitBend(current: BendGesture): Promise<void> {
		if (wallUnfold.isActive(current.wallId)) return;
		const snapshot = services.stage.snapshot();
		if (stageUnitRevision(snapshot, 'layout') !== contentRevision) return;
		const target = {
			wallId: current.wallId,
			knotId: current.knotId,
			operationId: globalThis.crypto.randomUUID(),
			projectId: snapshot.acceptedRevision.projectId,
			revisionId: current.revision,
			contentRevision,
			levelId: snapshot.domain.layoutLevelId
		};
		const intent = current.intent;
		if (!current.removal && intent === null) return;
		const outcome = await services.authoring.accept(
			current.removal ? wallKnotDeleteIntent(target) : wallBendIntent({ ...target, ...intent! })
		);
		if (
			outcome.kind === 'refused' &&
			stageUnitRevision(services.stage.snapshot(), 'layout') === contentRevision
		) {
			settleRefusal({
				subject: { kind: 'wall', wallId: current.wallId },
				contentRevision,
				point: current.attemptPoint ?? current.anchor,
				text:
					outcome.code === 'planner-rejected'
						? outcome.message
						: wallRefusalWords(outcome.code, outcome.message)
			});
			services.stage.notifySurfaceChange();
		}
	}

	/**
	 * C2/D8 — the radius grip. A press captures the selected closed Wall and
	 * one gesture lease; every move previews the retained radius planner; the
	 * release accepts exactly that radius once. Bending never enters this path.
	 */
	function circleRadiusPointer(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext
	): boolean {
		const active = circleRadiusGesture;
		if (active === null) {
			if (intent.phase !== 'down' || intent.handleId !== 'layout-circle-radius-mark') return false;
			const selected = selectedClosedWall(adapterContext);
			if (selected === null) return false;
			const acquisition = services.stage.acquireGesture({
				owner: 'layout-circle-radius',
				evaluationId: intent.evaluationId,
				policy: 'cancel-on-reading-change'
			});
			if (acquisition.kind !== 'granted') {
				publishRefusal(`The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`);
				return false;
			}
			circleRadiusGesture = {
				evaluationId: intent.evaluationId,
				pressCss: intent.css,
				lease: acquisition,
				wallId: selected.wallId,
				baseline: stageLayout(adapterContext.snapshot),
				center: selected.center,
				preview: null,
				radius: null,
				refusal: null
			};
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.phase === 'cancel' || intent.evaluationId !== active.evaluationId) {
			endCircleRadius();
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.phase === 'move') {
			const point = pointerDatumPoint(adapterContext, intent.css);
			if (point === null) return true;
			const radius = Math.hypot(point[0] - active.center[0], point[1] - active.center[1]);
			const planned = planResizeClosedWallRadius({
				document: active.baseline,
				wallId: active.wallId,
				radius
			});
			if (planned.kind === 'rejected') {
				active.preview = null;
				active.radius = null;
				active.refusal = planned.rejection.message;
			} else {
				active.preview = planned.document;
				active.radius = radius;
				active.refusal = null;
			}
			publishRefusal(active.refusal);
			services.stage.notifySurfaceChange();
			return true;
		}
		// release: one captured write, never a clamped repair.
		const current = circleRadiusGesture;
		if (current === null) return true;
		const radius = current.radius;
		const wallId = current.wallId;
		endCircleRadius();
		if (radius !== null) {
			const snapshot = services.stage.snapshot();
			void services.authoring.accept(
				circleRadiusIntent({
					wallId,
					radius,
					operationId: globalThis.crypto.randomUUID(),
					projectId: snapshot.acceptedRevision.projectId,
					revisionId: services.authoring.acceptedRevision().revisionId,
					contentRevision: stageUnitRevision(snapshot, 'layout'),
					levelId: snapshot.domain.layoutLevelId
				})
			);
		}
		services.stage.notifySurfaceChange();
		return true;
	}

	/**
	 * C2/D8 — a circular Wall is translated by a body drag. The straight move
	 * path requires a chord frame, which a self-connected Wall does not have,
	 * so this gesture runs the closed-Wall translation planner and the canonical
	 * `layout-wall-move` intent. It never enters the bend sub-machine:
	 * `openWallFrame` deliberately refuses a self-connected Wall, and the bend
	 * planner refuses `closed_wall_not_bendable`.
	 */
	function circleTranslatePointer(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext
	): boolean {
		const active = circleTranslateGesture;
		if (active === null) {
			if (intent.phase !== 'down') return false;
			// Any admitted mark keeps its own writer; only an unmarked body press
			// moves the Wall.
			if (intent.handleId !== undefined) return false;
			const selected = selectedClosedWall(adapterContext);
			if (selected === null) return false;
			const hit = services.stage.hitMark({ css: intent.css, coarse: intent.coarse === true });
			if (hit !== null) return false;
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
			)
				return false;
			const point = pointerDatumPoint(adapterContext, intent.css);
			if (point === null) return false;
			const acquisition = services.stage.acquireGesture({
				owner: 'layout-circle-move',
				evaluationId: intent.evaluationId,
				policy: 'cancel-on-reading-change'
			});
			if (acquisition.kind !== 'granted') {
				publishRefusal(`The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`);
				return false;
			}
			circleTranslateGesture = {
				evaluationId: intent.evaluationId,
				lease: acquisition,
				wallId: selected.wallId,
				baseline: stageLayout(adapterContext.snapshot),
				pressPoint: [point[0], point[1]],
				preview: null,
				delta: null,
				refusal: null
			};
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.phase === 'cancel' || intent.evaluationId !== active.evaluationId) {
			endCircleTranslate();
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.phase === 'move') {
			const point = pointerDatumPoint(adapterContext, intent.css);
			if (point === null) return true;
			const delta: LayoutVec2 = [point[0] - active.pressPoint[0], point[1] - active.pressPoint[1]];
			if (Math.hypot(delta[0], delta[1]) < 1e-9) {
				active.preview = null;
				active.delta = null;
				active.refusal = null;
				services.stage.notifySurfaceChange();
				return true;
			}
			const planned = planTranslateClosedWall({
				document: active.baseline,
				wallId: active.wallId,
				delta
			});
			if (planned.kind === 'rejected') {
				active.preview = null;
				active.delta = null;
				active.refusal = planned.rejection.message;
			} else {
				active.preview = planned.document;
				active.delta = delta;
				active.refusal = null;
			}
			publishRefusal(active.refusal);
			services.stage.notifySurfaceChange();
			return true;
		}
		const current = circleTranslateGesture;
		if (current === null) return true;
		const delta = current.delta;
		const wallId = current.wallId;
		endCircleTranslate();
		if (delta !== null) {
			// One captured intent on release, through the same retained planner
			// the preview ran. The straight `layout-wall-move` planner is not used:
			// a self-connected Wall has no endpoint chord to solve.
			const snapshot = services.stage.snapshot();
			void services.authoring.accept(
				circleTranslateIntent({
					wallId,
					delta,
					operationId: globalThis.crypto.randomUUID(),
					projectId: snapshot.acceptedRevision.projectId,
					revisionId: services.authoring.acceptedRevision().revisionId,
					contentRevision: stageUnitRevision(snapshot, 'layout'),
					levelId: snapshot.domain.layoutLevelId
				})
			);
		}
		services.stage.notifySurfaceChange();
		return true;
	}

	/**
	 * C1 — the Bend sub-machine, driven through the same `pointer()` entry as
	 * every other captured gesture. A press on the body captures one station
	 * and one knot id; a move previews through the retained planner; the up
	 * commits exactly once. The rigid move mark never enters this path.
	 */
	function bendPointer(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext,
		blocked: boolean
	): boolean {
		const active = bendGesture;
		if (active === null) {
			if (intent.phase !== 'down' || intent.handleId === 'layout-wall-move-mark') return false;
			if (blocked) return false;
			const selected = selectedOpenWall(document, adapterContext);
			if (selected === null) return false;
			const handle = intent.handleId;
			const knotMark = handle?.startsWith('layout-wall-knot:') === true;
			const spanMark = handle?.startsWith('layout-wall-span:') === true;
			if (handle !== undefined && !knotMark && !spanMark) return false;
			// D1 — a plain body press is the rigid move, not a bend. Meta/Ctrl is
			// captured on pointer-down; the visible span rings are the direct
			// touch/keyboard alternative and need no hidden armed mode.
			const shapeModifier = intent.metaKey === true || intent.ctrlKey === true;
			const press = pointerDatumPoint(adapterContext, intent.css);
			if (press === null) return false;
			const source = document.walls.find((candidate) => candidate.id === selected.wallId);
			if (source === undefined) return false;
			// Targeted precedence: a press any admitted mark or other pickable
			// subject claims belongs to that path. Only a genuine body press on this
			// Wall reaches the bend — straight and curved alike (D1).
			let effectiveHandle = handle;
			if (effectiveHandle === undefined) {
				const hit = services.stage.hitMark({ css: intent.css, coarse: intent.coarse === true });
				if (hit !== null) {
					const bendMark =
						hit.adapterId === 'layout' &&
						(hit.id.startsWith('layout-wall-knot:') || hit.id.startsWith('layout-wall-span:'));
					if (!bendMark) return false;
					effectiveHandle = hit.id;
				}
			}
			if (effectiveHandle === undefined) {
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
				)
					return false;
			}
			const resolvedKnotMark = effectiveHandle?.startsWith('layout-wall-knot:') === true;
			// Reuse a stored knot only when it is within the visible 10 CSS px mark
			// promotion radius. The 0.35 m body fallback is not a mark radius.
			const nearestKnot =
				!resolvedKnotMark && effectiveHandle === undefined && source.centerline.kind !== 'line'
					? source.centerline.knots.find((candidate) => {
							const projected = adapterContext.project([
								candidate.point[0],
								adapterContext.snapshot.domain.datumMeters,
								candidate.point[1]
							]);
							return (
								projected !== null &&
								Math.hypot(
									projected[0] - adapterContext.evaluation.rect.left - intent.css[0],
									projected[1] - adapterContext.evaluation.rect.top - intent.css[1]
								) <= 10
							);
						})
					: undefined;
			// A plain body press within the hidden knot's 10 px promotion radius
			// activates/edits that knot; anywhere else it is the rigid move.
			if (effectiveHandle === undefined && nearestKnot === undefined && !shapeModifier) return false;
			const knot =
				resolvedKnotMark && source.centerline.kind !== 'line'
					? source.centerline.knots.find(
							(candidate) => candidate.id === effectiveHandle!.slice('layout-wall-knot:'.length)
						)
					: nearestKnot;
			if (resolvedKnotMark && knot === undefined) return false;
			const knotId = knot?.id ?? globalThis.crypto.randomUUID();
			const distance =
				knot === undefined
					? wallStationNearPoint(
							document,
							selected.wallId,
							[press[0], press[1]],
							BEND_BODY_TOLERANCE_METERS
						)
					: wallStationAtPoint(document, selected.wallId, [knot.point[0], knot.point[1]]);
			if (distance === null || !(distance > 0) || distance >= selected.frame.length) return false;
			const anchor =
				knot === undefined ? curvedWallPointAt(selected.frame, distance)?.point : knot.point;
			if (anchor === undefined) return false;
			const acquisition = services.stage.acquireGesture({
				owner: 'layout-bend',
				evaluationId: intent.evaluationId,
				policy: 'cancel-on-reading-change'
			});
			if (acquisition.kind !== 'granted') return false;
			const removal =
				knot === undefined ? null : proposeWallKnotRemoval(document, selected.wallId, knotId);
			const knots = source.centerline.kind === 'cubic-chain' ? source.centerline.knots : [];
			const knotIndex = knots.findIndex((entry) => entry.id === knotId);
			const openings = document.openings.flatMap((opening, index) =>
				opening.wallId === selected.wallId ? [{ opening, index }] : []
			);
			const pointById = new Map([
				[source.startJunctionId, selected.frame.start],
				[source.endJunctionId, selected.frame.end]
			]);
			const openingRefusal = (centerline: LayoutWallCenterline): string | null => {
				if (openings.length === 0) return null;
				const [issue] = validateWallFirstOpeningSubset(document, openings, {
					pointById,
					wallById: new Map([[source.id, { ...source, centerline }]])
				});
				return issue ? wallRefusalWords(issue.code, issue.message) : null;
			};
			const samples =
				removal?.kind === 'proposed'
					? wallCenterlineSamples(
							{ id: selected.wallId, centerline: removal.centerline },
							removal.start,
							removal.end,
							'forward'
						)
					: undefined;
			settleRefusal(null);
			bendGesture = {
				evaluationId: intent.evaluationId,
				pressCss: intent.css,
				markId: effectiveHandle ?? 'layout-wall-body',
				wallId: selected.wallId,
				knotId,
				frame: selected.frame,
				distance,
				anchor: [anchor[0], anchor[1]],
				grabOffset: [anchor[0] - press[0], anchor[1] - press[1]],
				existingKnot: knot !== undefined,
				lease: acquisition,
				revision: services.authoring.acceptedRevision().revisionId,
				shape: prepareWallBend(document, selected.wallId, distance, knotId),
				openingRefusal,
				removalRefusal: removal?.kind === 'proposed' ? openingRefusal(removal.centerline) : null,
				removedPoints: samples?.samples.map((sample) => sample.point) ?? null,
				removalChord:
					knotIndex < 0
						? null
						: [
								knots[knotIndex - 1]?.point ?? selected.frame.start,
								knots[knotIndex + 1]?.point ?? selected.frame.end
							],
				intent: null,
				previewPoints: null,
				removal: false,
				leftRemovalZone: false,
				attemptPoints: selected.frame.samples.map(
					(sample) => [sample.point[0], sample.point[1]] as LayoutVec2
				),
				attemptPoint: null,
				refusal: null
			};
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.phase === 'cancel' || intent.evaluationId !== active.evaluationId) {
			endBendGesture();
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.phase === 'move') {
			if (wallUnfold.isActive(active.wallId)) {
				active.intent = null;
				active.previewPoints = null;
				active.removal = false;
				active.refusal = WALL_UNFOLD_SHAPE_REFUSAL;
				services.stage.notifySurfaceChange();
				return true;
			}
			if (!isPointerDrag(active.pressCss, intent.css)) {
				active.intent = null;
				active.previewPoints = null;
				active.removal = false;
				active.refusal = null;
				services.stage.notifySurfaceChange();
				return true;
			}
			const point = pointerDatumPoint(adapterContext, intent.css);
			if (point === null) return true;
			const attempted: LayoutVec2 = [point[0] + active.grabOffset[0], point[1] + active.grabOffset[1]];
			const attemptPoints = active.frame.samples.map(
				(sample) => [sample.point[0], sample.point[1]] as LayoutVec2
			);
			const insertAt = active.frame.samples.findIndex((sample) => sample.distance >= active.distance);
			if (active.existingKnot && insertAt >= 0) attemptPoints[insertAt] = attempted;
			else
				attemptPoints.splice(Math.max(1, insertAt < 0 ? attemptPoints.length : insertAt), 0, attempted);
			active.attemptPoints = attemptPoints;
			active.attemptPoint = attempted;
			// A held existing knot that comes back onto its neighbours' chord is
			// a removal, not a bend. The preview is the real no-knot candidate and
			// release writes exactly that one command; leaving the chord returns
			// to the ordinary bend. `leftRemovalZone` is the must-leave hysteresis.
			active.removal = false;
			if (active.removalChord !== null) {
				const distance = distanceToChord(attempted, ...active.removalChord);
				if (distance > REMOVE_LEAVE_METERS) active.leftRemovalZone = true;
				active.removal = active.leftRemovalZone && distance <= REMOVE_ENTER_METERS;
			}
			const shape = active.shape;
			const proposal = shape.kind === 'ready' ? shape.reshape(attempted) : shape;
			const samples =
				shape.kind === 'ready' && proposal.kind === 'proposed'
					? wallCenterlineSamples(
							{ id: active.wallId, centerline: proposal.centerline },
							shape.start,
							shape.end,
							'forward'
						)
					: undefined;
			const points = active.removal
				? active.removedPoints
				: samples?.samples.map((sample) => sample.point);
			active.previewPoints = points ?? null;
			active.intent = active.removal || !points ? null : { distance: active.distance, point: attempted };
			const openingIssue = active.removal
				? active.removalRefusal
				: proposal.kind === 'proposed'
					? active.openingRefusal(proposal.centerline)
					: null;
			active.refusal =
				openingIssue ??
				(points
					? null
					: proposal.kind === 'rejected'
						? wallRefusalWords(proposal.rejection.code, proposal.rejection.message)
						: 'This shape is not a valid Wall layout.');
			services.stage.notifySurfaceChange();
			return true;
		}
		// up: one captured gesture is at most one accepted command.
		const current = bendGesture;
		bendGesture = null;
		if (current?.lease?.kind === 'granted' && current.lease.lease.active) current.lease.lease.release();
		// D2 — the knot a gesture created or edited stays named after release,
		// including a brand-new knot, until Escape or a different selection.
		if (current !== null && current.removal) {
			// The removal is one canonical knot-delete command. The knot is gone,
			// so the session's active shape point is cleared; Undo restores it.
			activeKnot = null;
			if (current.refusal === null) void commitBend(current);
		} else if (current !== null) activeKnot = { wallId: current.wallId, knotId: current.knotId };
		if (current !== null && !current.removal && current.intent !== null && current.refusal === null)
			void commitBend(current);
		else if (
			current !== null &&
			(current.existingKnot || current.markId.startsWith('layout-wall-knot:')) &&
			!isPointerDrag(current.pressCss, intent.css)
		) {
			// A click, not a drag: the solid point becomes the active bend point the
			// Card names. No document write, so no history entry is created.
			activeKnot = { wallId: current.wallId, knotId: current.knotId };
		}
		services.stage.notifySurfaceChange();
		return true;
	}

	/**
	 * Reveal the available Bend target on hover/proximity. Only the selected
	 * open Wall qualifies; the hint is the midpoint of the span under the
	 * pointer, so pressing the same place is the ordinary span-ring Bend. A
	 * coarse pointer does not hover, and any owned task or live gesture keeps
	 * the pointer for itself.
	 */
	function updateIdleBendHover(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext,
		blocked: boolean
	): boolean {
		const previous = idleBendHint;
		const clear = (): false => {
			idleBendHint = null;
			if (previous !== null) services.stage.notifySurfaceChange();
			return false;
		};
		if (intent.phase === 'cancel') return clear();
		if (
			intent.phase !== 'move' ||
			intent.coarse === true ||
			blocked ||
			services.stage.session.task() !== null ||
			services.stage.session.gesture() !== null ||
			bendGesture !== null
		)
			return clear();
		const selected = selectedOpenWall(document, adapterContext);
		if (selected === null || wallUnfold.isActive(selected.wallId)) return clear();
		const point = pointerDatumPoint(adapterContext, intent.css);
		if (point === null) return clear();
		const station = wallStationNearPoint(
			document,
			selected.wallId,
			[point[0], point[1]],
			BEND_BODY_TOLERANCE_METERS
		);
		if (station === null || !(station > 0.02) || station >= selected.frame.length - 0.02) return clear();
		const source = document.walls.find((candidate) => candidate.id === selected.wallId);
		if (source === undefined) return clear();
		const boundaries = [0];
		if (source.centerline.kind !== 'line') {
			for (const knot of source.centerline.knots) {
				const knotStation = wallStationAtPoint(document, selected.wallId, [
					knot.point[0],
					knot.point[1]
				]);
				if (
					knotStation !== null &&
					knotStation > boundaries[0]! &&
					knotStation < selected.frame.length
				) {
					boundaries.push(knotStation);
				}
			}
		}
		boundaries.push(selected.frame.length);
		boundaries.sort((a, b) => a - b);
		let from = 0;
		let to = selected.frame.length;
		for (let index = 1; index < boundaries.length; index += 1) {
			if (station >= boundaries[index - 1]! && station <= boundaries[index]!) {
				from = boundaries[index - 1]!;
				to = boundaries[index]!;
				break;
			}
		}
		if (!(to - from > 0.02)) return clear();
		const at = curvedWallPointAt(selected.frame, (from + to) / 2)?.point;
		if (at === undefined) return clear();
		const next = {
			wallId: selected.wallId,
			point: [at[0], at[1]] as LayoutVec2,
			station: (from + to) / 2
		};
		idleBendHint = next;
		if (
			previous?.wallId !== next.wallId ||
			previous.point[0] !== next.point[0] ||
			previous.point[1] !== next.point[1]
		)
			services.stage.notifySurfaceChange();
		return true;
	}

	function previews(y: number) {
		const { world } = previewCoordinates(y);
		// C2 — the radius grip's candidate is the same resized closed Wall the
		// release writes. A refused radius draws no geometry and names its reason.
		const activeCircleRadius = circleRadiusGesture;
		if (activeCircleRadius !== null && activeCircleRadius.preview !== null) {
			const built = candidatePaper(
				activeCircleRadius.preview,
				y,
				new Set([activeCircleRadius.wallId]),
				new Set()
			);
			if (built !== null) {
				return [
					candidatePreviewOf({
						id: 'layout-candidate-circle-radius',
						role: 'subject',
						geometry: built.paper.subject,
						snap: undefined
					})
				];
			}
		}
		// D8 — a body drag previews the translated closed Wall it will commit.
		const activeCircleTranslate = circleTranslateGesture;
		if (activeCircleTranslate !== null && activeCircleTranslate.preview !== null) {
			const built = candidatePaper(
				activeCircleTranslate.preview,
				y,
				new Set([activeCircleTranslate.wallId]),
				new Set()
			);
			if (built !== null) {
				return [
					candidatePreviewOf({
						id: 'layout-candidate-circle-translate',
						role: 'subject',
						geometry: built.paper.subject,
						snap: undefined
					})
				];
			}
		}
		// A typed value with no pointer movement has no candidate document, but its
		// tag still belongs at the press, not only on the midpoint grip.
		const activeBend = bendGesture;
		if (activeBend !== null) {
			if (activeBend.previewPoints !== null && activeBend.refusal === null) {
				return [
					candidatePreviewOf({
						id: activeBend.removal ? 'layout-candidate-wall-bend-remove' : 'layout-candidate-wall-bend',
						role: 'subject',
						geometry: wallProposalPaper(
							[{ wallId: activeBend.wallId, points: [...activeBend.previewPoints] }],
							y
						),
						...(activeBend.removal
							? { labels: [{ world: world(activeBend.anchor), text: 'Remove bend point' }] }
							: {})
					})
				];
			}
			if (activeBend.attemptPoints.length >= 2) {
				const geometry = wallProposalPaper(
					[{ wallId: activeBend.wallId, points: [...activeBend.attemptPoints] }],
					y
				);
				return [
					candidatePreviewOf({
						id:
							activeBend.refusal === null
								? 'layout-candidate-wall-bend-attempt'
								: 'layout-candidate-wall-bend-refused',
						role: activeBend.refusal === null ? 'subject' : 'refused',
						geometry,
						...(activeBend.refusal === null || activeBend.attemptPoint === null
							? {}
							: {
									labels: [{ world: world(activeBend.attemptPoint), text: activeBend.refusal }]
								})
					})
				];
			}
			return [];
		}
		return null;
	}

	function clearBendHint() {
		if (idleBendHint === null) return false;
		idleBendHint = null;
		return true;
	}

	function reconcileSelection(ctx: StageAdapterContext) {
		const primary = ctx.selectionState().primary;
		if (
			activeKnot !== null &&
			(primary === null || primary.subject.kind !== 'wall' || primary.subject.id !== activeKnot.wallId)
		) {
			activeKnot = null;
		}
	}

	function clearKnot() {
		if (activeKnot === null) return false;
		activeKnot = null;
		services.stage.notifySurfaceChange();
		return true;
	}

	function deleteKnotKey(adapterContext: StageAdapterContext) {
		const curved = selectedCurvedWall(document, adapterContext);
		// A straight Wall with no active knot leaves Delete to the host's
		// existing map. A surviving active-knot record on a now-straight Wall is
		// stale, so it claims and refuses instead of deleting the Wall.
		if (curved === null) return activeKnot !== null;
		if (activeKnot === null || activeKnot.wallId !== curved.wallId) return true;
		void removeWallKnot(curved.wallId, activeKnot.knotId);
		return true;
	}

	function removeSelectedKnot(wallId: string) {
		if (wallUnfold.isActive(wallId))
			return { kind: 'refused', message: WALL_UNFOLD_SHAPE_REFUSAL } satisfies StageCardActionOutcome;
		if (activeKnot === null || activeKnot.wallId !== wallId) {
			return {
				kind: 'refused',
				message: 'Select the bend point again before removing it.'
			} satisfies StageCardActionOutcome;
		}
		return removeWallKnot(wallId, activeKnot.knotId);
	}

	return {
		circleRadiusPointer,
		circleTranslatePointer,
		bendPointer,
		updateIdleBendHover,
		previews,
		clearBendHint,
		reconcileSelection,
		clearKnot,
		deleteKnotKey,
		removeSelectedKnot,
		get isBending() {
			return bendGesture !== null;
		},
		get activeKnot() {
			return activeKnot;
		},
		markState: () => ({
			activeKnot,
			idleBendHint,
			radiusRefusal: circleRadiusGesture?.refusal ?? null,
			bend:
				bendGesture === null
					? null
					: {
							wallId: bendGesture.wallId,
							markId: bendGesture.markId,
							knotId: bendGesture.knotId,
							refusal: bendGesture.refusal
						}
		}),
		cancel() {
			endCircleRadius();
			endCircleTranslate();
			endBendGesture();
		}
	};
}
