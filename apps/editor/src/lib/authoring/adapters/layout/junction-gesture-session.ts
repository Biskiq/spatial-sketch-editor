import { planarDeltaLabel } from '$lib/authoring/stage/stage-adapter-host';
import {
	mintLayoutIdCapture,
	planDissolveJunction,
	proposeWallFirstArchitectureGeometry,
	type WallFirstArchitectureProposalWall,
	type FixedWallEndpoint,
	type LayoutDocumentWallFirst,
	type LayoutIdCapture,
	type LayoutVec2,
	wallCenterlinePoints
} from '@portfolio/layout-core';

import {
	type StageAdapterContext,
	type StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';
import { stageLayout, stageUnitRevision } from '$lib/authoring/stage/stage-adapter-host';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-adapter-host';

import { wallJoinRefusalWords, wallRefusalWords } from './refusals';
import { LAYOUT_WALL_JOIN_KIND, wallJoinIntent } from './join-planners';
import { pointerDatumPoint } from './stage-pointer';
import type { StageHandleDescriptor } from '$lib/authoring/stage/stage-adapter-host';
import {
	planNumericEntryField,
	planNumericEntrySubmit,
	planNumericFields,
	type PlanNumericEntryState
} from '$lib/authoring/layout/plan-numeric-entry';
import { LAYOUT_JUNCTION_MOVE_KIND, type WallManipulationRequest } from './precision';
import { DRAG_GRID_SNAP_CSS_PX, type LayoutSnapWinner } from './snap';
import {
	DRAFTING_SNAP_METERS,
	draftingSnapIncrementMeters,
	snapDraftingPlacement,
	snapDraftingPoint
} from '$lib/authoring/stage/stage-adapter-host';
import { type CandidatePaperGeometry, candidatePreviewOf } from './candidate-preview';
import { selectedWall } from './layout-subjects';
import {
	attemptedConflictPoint,
	createWallDragReader,
	datumSnapDistance,
	distanceToChord,
	isPointerDrag,
	numericWords,
	previewCoordinates,
	wallProposalPaper,
	type LayoutManipulationPorts,
	type NumericGestureTarget
} from './manipulation-support';

/** One unselected Junction gesture admitted from the Plan-only hover mark. */
type JunctionHoverGesture = {
	readonly evaluationId: string;
	/** Stage-local CSS origin shared with the host's click tolerance. */
	readonly pressCss: readonly [number, number];
	readonly junctionId: string;
	readonly wallId: string;
	readonly wallIds: readonly string[];
	readonly startPoint: LayoutVec2;
	readonly pressPoint: LayoutVec2;
	readonly lease: GestureAcquisition | null;
	numeric: PlanNumericEntryState | null;
	request: Extract<WallManipulationRequest, { readonly kind: 'junction' }> | null;
	/** Complete attempted network, retained through validation refusal. */
	attempt: WallFirstArchitectureProposalWall[] | null;
	refusalPoint: LayoutVec2 | null;
	proposal: WallFirstArchitectureProposalWall[] | null;
	readonly readPreview: ReturnType<typeof createWallDragReader>;
	snap: LayoutSnapWinner | null;
	pointerPoint: LayoutVec2 | null;
	/** The operation's captured nonce: the join preview and its commit share it. */
	readonly capture: LayoutIdCapture;
	/** The pointer names **Remove joint** rather than a Junction move. */
	removal: boolean;
	/** The pointer has left the removal zone since press; leaving arms removal. */
	leftRemovalZone: boolean;
	/** The dissolve candidate while removal is armed; `null` when refused. */
	joinPreview: { readonly document: LayoutDocumentWallFirst; readonly survivorWallId: string } | null;
	/**
	 * The pointer travelled past the drag threshold at some point since the press.
	 *
	 * A junction edit is a drag, not a displacement: an out-and-back that ends
	 * where it started is still an edit request, and `isPointerDrag(press, release)`
	 * alone would discard it.
	 */
	dragged: boolean;
};
/** A held joint names **Remove joint** inside this distance of its neighbours' chord. */
const JOINT_REMOVE_ENTER_METERS = 0.12;
/** The joint must leave this wider zone once before removal can arm. */
const JOINT_REMOVE_LEAVE_METERS = 0.3;
/** The two Walls a degree-2 Joint joins, with each one's far endpoint. */
function degreeTwoPair(
	document: LayoutDocumentWallFirst,
	junctionId: string
): { readonly firstFar: LayoutVec2; readonly secondFar: LayoutVec2 } | null {
	const incident = document.walls.filter(
		(wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId
	);
	if (incident.length !== 2) return null;
	const farOf = (wall: LayoutDocumentWallFirst['walls'][number]): LayoutVec2 | null => {
		// A closed Wall is one canonical loop; its seam is not a pair at all.
		if (wall.startJunctionId === wall.endJunctionId) return null;
		const farId = wall.startJunctionId === junctionId ? wall.endJunctionId : wall.startJunctionId;
		const junction = document.junctions.find((entry) => entry.id === farId);
		return junction === undefined ? null : [junction.point[0], junction.point[1]];
	};
	const firstFar = farOf(incident[0]!);
	const secondFar = farOf(incident[1]!);
	return firstFar === null || secondFar === null ? null : { firstFar, secondFar };
}

/**
 * Whether a held Joint is naming **Remove joint**.
 *
 * This is the bend-point removal rule one topology level up: a Joint of exactly
 * two Walls dragged within `JOINT_REMOVE_ENTER_METERS` of the chord between their
 * far ends asks for the join, and the pointer must have left the wider zone once
 * since the press (`leftRemovalZone`) so a Joint that is already collinear does
 * not arm the moment it is touched. A Joint of any other degree names no chord
 * and is never offered removal — "delete a junction" has no single meaning once
 * three Walls meet.
 */
function jointRemovalArmed(
	gesture: JunctionHoverGesture,
	document: LayoutDocumentWallFirst,
	point: LayoutVec2
): boolean {
	const pair = degreeTwoPair(document, gesture.junctionId);
	if (pair === null) return false;
	const distance = distanceToChord(point, pair.firstFar, pair.secondFar);
	if (distance > JOINT_REMOVE_LEAVE_METERS) gesture.leftRemovalZone = true;
	return gesture.leftRemovalZone && distance <= JOINT_REMOVE_ENTER_METERS;
}

/**
 * The join candidate as the Stage draws it: the joined Wall's own canonical
 * centerline points, read from the planned document through the one centerline
 * reader. Nothing here re-derives curve geometry or reorders spans by hand.
 */
function joinedPreview(plan: {
	readonly document: LayoutDocumentWallFirst;
	readonly survivorWallId: string;
}): WallFirstArchitectureProposalWall[] {
	const joined = plan.document.walls.find((wall) => wall.id === plan.survivorWallId);
	if (joined === undefined) return [];
	const start = plan.document.junctions.find((junction) => junction.id === joined.startJunctionId);
	const end = plan.document.junctions.find((junction) => junction.id === joined.endJunctionId);
	if (start === undefined || end === undefined) return [];
	return [
		{
			wallId: joined.id,
			points: wallCenterlinePoints(joined.centerline, start.point, end.point, 'forward')
		}
	];
}
type IdleJunctionHover = {
	readonly junctionId: string;
	readonly point: LayoutVec2;
	readonly wallId: string;
	readonly wallIds: readonly string[];
};

export function createJunctionGestureSession({
	services,
	document,
	levelId,
	contentRevision,
	publishRefusal,
	settleRefusal,
	commit
}: LayoutManipulationPorts & {
	readonly commit: (
		request: WallManipulationRequest,
		fixed: FixedWallEndpoint,
		wallId: string,
		point?: LayoutVec2 | null,
		attemptGeometry?: CandidatePaperGeometry | null
	) => Promise<void>;
}) {
	let junctionGesture: JunctionHoverGesture | null = null;
	let idleJunctionHover: IdleJunctionHover | null = null;
	/** Release the live hover-Junction lease and clear its transient candidate. */
	function endJunctionGesture(): void {
		const current = junctionGesture;
		junctionGesture = null;
		idleJunctionHover = null;
		if (current?.lease?.kind === 'granted' && current.lease.lease.active) current.lease.lease.release();
	}
	/** A hovered Junction may address any one of its existing incident Walls. */
	function incidentWallIds(junctionId: string): readonly string[] {
		return document.walls
			.filter((wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId)
			.map((wall) => wall.id)
			.sort((a, b) => a.localeCompare(b));
	}

	/**
	 * O9's one preselection exception: a fine pointer may reveal the nearest
	 * Layout Junction in Plan. The Stage has already offered selected marks, so
	 * this contributes only when that higher tier missed.
	 */
	function updateIdleJunctionHover(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext,
		blocked: boolean
	): boolean {
		const previous = idleJunctionHover;
		if (intent.phase === 'cancel') {
			idleJunctionHover = null;
			if (previous !== null) services.stage.notifySurfaceChange();
			return false;
		}
		if (
			intent.phase !== 'move' ||
			intent.coarse === true ||
			junctionGesture !== null ||
			blocked ||
			services.stage.session.task() !== null ||
			services.stage.session.gesture() !== null ||
			adapterContext.evaluation.renderedReading !== 'plan'
		) {
			idleJunctionHover = null;
			if (previous !== null) services.stage.notifySurfaceChange();
			return false;
		}
		const selected = selectedWall(adapterContext);
		let nearest: { readonly value: IdleJunctionHover; readonly distanceCss: number } | null = null;
		for (const junction of adapterContext.snapshot.domain.geometry.junctions ?? []) {
			const junctionId = junction.junctionId;
			if (
				selected !== null &&
				(junctionId === selected.frame.startJunctionId || junctionId === selected.frame.endJunctionId)
			)
				continue;
			const wallIds = incidentWallIds(junctionId);
			const wallId = wallIds[0];
			if (wallId === undefined) continue;
			const projected = adapterContext.project([
				junction.point[0],
				adapterContext.snapshot.domain.datumMeters,
				junction.point[1]
			]);
			if (projected === null) continue;
			const local: LayoutVec2 = [
				projected[0] - adapterContext.evaluation.rect.left,
				projected[1] - adapterContext.evaluation.rect.top
			];
			const distanceCss = Math.hypot(intent.css[0] - local[0], intent.css[1] - local[1]);
			if (distanceCss > 10) continue;
			const value = {
				junctionId,
				point: [junction.point[0], junction.point[1]] as LayoutVec2,
				wallId,
				wallIds
			};
			if (
				nearest === null ||
				distanceCss < nearest.distanceCss ||
				(distanceCss === nearest.distanceCss && junctionId.localeCompare(nearest.value.junctionId) < 0)
			)
				nearest = { value, distanceCss };
		}
		idleJunctionHover = nearest?.value ?? null;
		const changed =
			previous?.junctionId !== idleJunctionHover?.junctionId ||
			previous?.point[0] !== idleJunctionHover?.point[0] ||
			previous?.point[1] !== idleJunctionHover?.point[1];
		if (changed) services.stage.notifySurfaceChange();
		return idleJunctionHover !== null;
	}

	/** The one admitted Stage point for the active hover or its live drag. */
	function idleJunctionHandles(
		adapterContext: StageAdapterContext,
		taskOpen: boolean,
		refusal: string | null
	): readonly StageHandleDescriptor[] {
		if (taskOpen || services.stage.session.task() !== null) return [];
		if (adapterContext.evaluation.renderedReading !== 'plan') return [];
		const active = junctionGesture;
		if (active === null && services.stage.session.gesture() !== null) return [];
		const hover = idleJunctionHover;
		const junctionId = active?.junctionId ?? hover?.junctionId;
		if (junctionId === undefined) return [];
		const source = document.junctions.find((candidate) => candidate.id === junctionId);
		if (source === undefined) return [];
		const point = active?.request?.point ?? active?.startPoint ?? hover!.point;
		const numericValue =
			active?.numeric === null || active === null
				? null
				: `${planNumericEntryField(active.numeric).label} ${active.numeric.text}`;
		const selected = selectedWall(adapterContext);
		if (
			active === null &&
			selected !== null &&
			(junctionId === selected.frame.startJunctionId || junctionId === selected.frame.endJunctionId)
		)
			return [];
		return [
			{
				id: 'layout-junction-hover',
				kind: 'point',
				role: 'edit',
				anchor: [point[0], adapterContext.snapshot.domain.datumMeters, point[1]],
				// The armed mark is the join's own operation, not a Junction move with a
				// different caption: label, verb and planner all name the join it will
				// accept. The handle id is unchanged, so gesture ownership is untouched.
				label: active?.removal === true ? 'Remove joint' : 'Move point',
				fact: 'junction',
				verb: active?.removal === true ? 'Join' : 'Move',
				planner: active?.removal === true ? LAYOUT_WALL_JOIN_KIND : LAYOUT_JUNCTION_MOVE_KIND,
				value:
					numericValue ??
					(active?.removal === true
						? 'Remove joint'
						: active?.request === null || active?.request === undefined
							? planarDeltaLabel(0, 0)
							: planarDeltaLabel(
									active.request.point[0] - active.startPoint[0],
									active.request.point[1] - active.startPoint[1]
								)),
				refusal: active === null ? null : refusal
			}
		];
	}

	/**
	 * Commit one joint removal through the join intent. The capture was minted at
	 * the press, so the candidate the creator previewed and the document that
	 * lands describe the same ids — Undo and Redo replay them.
	 */
	async function commitJoin(junctionId: string, capture: LayoutIdCapture): Promise<void> {
		const snapshot = services.stage.snapshot();
		const outcome = await services.authoring.accept(
			wallJoinIntent({
				junctionId,
				capture,
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: services.authoring.acceptedRevision().revisionId,
				contentRevision: stageUnitRevision(snapshot, 'layout'),
				levelId: snapshot.domain.layoutLevelId
			})
		);
		publishRefusal(
			outcome.kind === 'refused' ? wallJoinRefusalWords(outcome.code, outcome.message) : null
		);
		services.stage.notifySurfaceChange();
	}
	function begin(intent: StagePointerIntent, adapterContext: StageAdapterContext) {
		const hovered = idleJunctionHover;
		if (hovered === null || intent.coarse === true) return false;
		const current = document.junctions.find((junction) => junction.id === hovered.junctionId);
		const wallId = hovered.wallId;
		if (
			current === undefined ||
			!document.walls.some(
				(wall) =>
					wall.id === wallId &&
					(wall.startJunctionId === hovered.junctionId || wall.endJunctionId === hovered.junctionId)
			)
		) {
			idleJunctionHover = null;
			return false;
		}
		const point = pointerDatumPoint(adapterContext, intent.css);
		if (point === null) return false;
		const acquisition = services.stage.acquireGesture({
			owner: 'layout-precision',
			evaluationId: intent.evaluationId,
			policy: 'cancel-on-reading-change'
		});
		if (acquisition.kind !== 'granted') return false;
		const baseline = stageLayout(adapterContext.snapshot);
		junctionGesture = {
			evaluationId: intent.evaluationId,
			pressCss: intent.css,
			junctionId: hovered.junctionId,
			wallId,
			wallIds: hovered.wallIds,
			startPoint: current.point,
			pressPoint: [point[0], point[1]],
			lease: acquisition,
			numeric: null,
			request: null,
			attempt: null,
			refusalPoint: null,
			proposal: null,
			readPreview: createWallDragReader(baseline),
			snap: null,
			pointerPoint: [point[0], point[1]],
			capture: mintLayoutIdCapture(),
			removal: false,
			leftRemovalZone: false,
			joinPreview: null,
			dragged: false
		};
		idleJunctionHover = null;
		services.stage.notifySurfaceChange();
		return true;
	}

	function move(intent: StagePointerIntent, adapterContext: StageAdapterContext) {
		if (junctionGesture === null) return false;
		if (isPointerDrag(junctionGesture.pressCss, intent.css)) junctionGesture.dragged = true;
		if (!junctionGesture.dragged) {
			junctionGesture.request = null;
			junctionGesture.proposal = null;
			junctionGesture.snap = null;
			publishRefusal(null);
			services.stage.notifySurfaceChange();
			return true;
		}
		const point = pointerDatumPoint(adapterContext, intent.css);
		if (point === null) {
			services.stage.notifySurfaceChange();
			return true;
		}
		const drafting = adapterContext.drafting();
		const aimed: LayoutVec2 = [
			junctionGesture.startPoint[0] + (point[0] - junctionGesture.pressPoint[0]),
			junctionGesture.startPoint[1] + (point[1] - junctionGesture.pressPoint[1])
		];
		const gridPoint = snapDraftingPoint(aimed, drafting);
		const snap =
			draftingSnapIncrementMeters(drafting) !== null &&
			Math.hypot(gridPoint[0] - aimed[0], gridPoint[1] - aimed[1]) <= DRAFTING_SNAP_METERS / 4 &&
			datumSnapDistance(adapterContext, gridPoint, aimed) <= DRAG_GRID_SNAP_CSS_PX;
		const free = snapDraftingPlacement(aimed, null);
		const snappedPoint = snap ? gridPoint : [free.x, free.z];
		junctionGesture.pointerPoint = [point[0], point[1]];
		// **Remove joint.** A degree-2 joint dragged onto the chord between its
		// neighbours' far ends names the join, exactly as a bend point dragged
		// onto its neighbours' line names the knot removal. The preview is the
		// real dissolve candidate; a refusal keeps the attempted chord and its
		// words, and release writes nothing.
		const armed = jointRemovalArmed(junctionGesture, document, [
			snappedPoint[0],
			snappedPoint[1]
		] as LayoutVec2);
		junctionGesture.removal = armed;
		if (armed) {
			const dissolved = planDissolveJunction(
				document,
				junctionGesture.junctionId,
				junctionGesture.capture,
				adapterContext.snapshot.domain.layoutLevelId
			);
			junctionGesture.request = null;
			junctionGesture.snap = null;
			if (dissolved.kind === 'rejected') {
				junctionGesture.joinPreview = null;
				junctionGesture.proposal = null;
				junctionGesture.attempt =
					proposeWallFirstArchitectureGeometry(document, {
						kind: 'junction-move',
						junctionId: junctionGesture.junctionId,
						point: [snappedPoint[0], snappedPoint[1]] as LayoutVec2
					}) ?? null;
				junctionGesture.refusalPoint = [snappedPoint[0], snappedPoint[1]];
				publishRefusal(wallJoinRefusalWords(dissolved.rejection.code, dissolved.rejection.message));
			} else {
				junctionGesture.joinPreview = dissolved;
				junctionGesture.attempt = joinedPreview(dissolved);
				junctionGesture.proposal = junctionGesture.attempt;
				junctionGesture.refusalPoint = null;
				publishRefusal(null);
			}
			services.stage.notifySurfaceChange();
			return true;
		}
		junctionGesture.joinPreview = null;
		if (
			Math.hypot(
				snappedPoint[0] - junctionGesture.startPoint[0],
				snappedPoint[1] - junctionGesture.startPoint[1]
			) < 1e-9
		) {
			junctionGesture.request = null;
			junctionGesture.attempt = null;
			junctionGesture.refusalPoint = null;
			junctionGesture.proposal = null;
			junctionGesture.snap = null;
			publishRefusal(null);
			services.stage.notifySurfaceChange();
			return true;
		}
		const request = {
			kind: 'junction' as const,
			junctionId: junctionGesture.junctionId,
			point: [snappedPoint[0], snappedPoint[1]] as LayoutVec2
		};
		const attempted =
			proposeWallFirstArchitectureGeometry(document, {
				kind: 'junction-move',
				junctionId: request.junctionId,
				point: request.point
			}) ?? null;
		junctionGesture.attempt = attempted;
		const planned = junctionGesture.readPreview({ ...request, kind: 'junction-move' });
		if (planned.kind === 'refused') {
			junctionGesture.request = null;
			junctionGesture.proposal = null;
			junctionGesture.snap = null;
			junctionGesture.refusalPoint =
				attempted === null
					? junctionGesture.pointerPoint
					: (attemptedConflictPoint(attempted, document) ?? junctionGesture.pointerPoint);
			publishRefusal(wallRefusalWords(planned.code));
		} else {
			junctionGesture.request = request;
			junctionGesture.proposal = planned.walls;
			junctionGesture.refusalPoint = null;
			junctionGesture.snap = snap ? { point: request.point, kind: 'grid', name: 'Grid' } : null;
			publishRefusal(null);
		}
		services.stage.notifySurfaceChange();
		return true;
	}

	function release(adapterContext: StageAdapterContext, refusal: string | null) {
		if (junctionGesture === null) return false;
		const dragged = junctionGesture.dragged;
		// A Joint in the removal zone is not a move: its parameter is withdrawn
		// while armed, so release writes the join or its refusal and can never
		// install the move the pointer passed through on the way.
		const removing = dragged && junctionGesture.removal && junctionGesture.joinPreview !== null;
		const pending = dragged && !junctionGesture.removal ? junctionGesture.request : null;
		const wallId = junctionGesture.wallId;
		const junctionId = junctionGesture.junctionId;
		const capture = junctionGesture.capture;
		const attemptGeometry =
			junctionGesture.attempt === null
				? null
				: wallProposalPaper(junctionGesture.attempt, adapterContext.snapshot.domain.datumMeters);
		if (dragged && pending === null && refusal !== null && junctionGesture.pointerPoint !== null) {
			settleRefusal({
				subject: { kind: 'junction' },
				contentRevision: adapterContext.snapshot.domain.unitRevisions.layout,
				point: junctionGesture.refusalPoint ?? junctionGesture.pointerPoint,
				text: refusal,
				...(attemptGeometry === null ? {} : { geometry: attemptGeometry })
			});
		}
		const point = junctionGesture.pointerPoint;
		endJunctionGesture();
		if (removing) void commitJoin(junctionId, capture);
		else if (pending !== null) void commit(pending, 'start', wallId, point, attemptGeometry);
		services.stage.notifySurfaceChange();
		return true;
	}

	function numericTarget(): NumericGestureTarget | null {
		const junction = junctionGesture;
		if (junction !== null) {
			const field = planNumericFields('junction').find((candidate) => candidate.id === 'x');
			if (field === undefined) return null;
			const point = junction.request?.point ?? junction.startPoint;
			return {
				host: 'junction',
				field,
				ownerId: junction.junctionId,
				candidates: { x: point[0], z: point[1] }
			};
		}
		return null;
	}

	function submitNumeric() {
		const junction = junctionGesture;
		if (junction !== null) {
			if (junction.numeric === null) return false;
			const outcome = planNumericEntrySubmit(junction.numeric);
			if (outcome.kind === 'refuse') {
				junction.numeric = outcome.state;
				publishRefusal(numericWords(outcome.reason));
				services.stage.notifySurfaceChange();
				return true;
			}
			if (outcome.kind === 'ignored') return true;
			const point = junction.request?.point ?? junction.startPoint;
			const request: WallManipulationRequest = {
				kind: 'junction',
				junctionId: junction.junctionId,
				point: [outcome.values.x ?? point[0], outcome.values.z ?? point[1]]
			};
			const wallId = junction.wallId;
			endJunctionGesture();
			void commit(request, 'start', wallId);
			services.stage.notifySurfaceChange();
			return true;
		}
		return false;
	}

	function setNumeric(next: PlanNumericEntryState | null) {
		if (junctionGesture !== null) junctionGesture.numeric = next;
	}
	function previews(y: number, refusal: string | null) {
		const { world, snapOf } = previewCoordinates(y);
		const activeJunction = junctionGesture;
		if (activeJunction !== null) {
			// A successful join candidate is the whole joined Wall, not a Junction
			// move: it has no Junction parameter, so `request` is null by design.
			// Drawn from the planner's own document through the same paper pass as
			// every other candidate, before the move branch can read that null as
			// "nothing to preview".
			if (
				activeJunction.removal &&
				activeJunction.joinPreview !== null &&
				activeJunction.proposal !== null
			) {
				return [
					candidatePreviewOf({
						id: 'layout-candidate-junction-join',
						role: 'subject',
						geometry: wallProposalPaper(activeJunction.proposal, y),
						labels: [
							{
								world: world(activeJunction.pointerPoint ?? activeJunction.startPoint),
								text: 'Remove joint'
							}
						]
					})
				];
			}
			if (activeJunction.request === null || activeJunction.proposal === null) {
				if (refusal !== null && activeJunction.pointerPoint !== null) {
					return [
						candidatePreviewOf({
							id: 'layout-candidate-junction-refused',
							role: 'refused',
							geometry:
								activeJunction.attempt === null
									? { polygons: [], segments: [] }
									: wallProposalPaper(activeJunction.attempt, y),
							labels: [
								{
									world: world(activeJunction.refusalPoint ?? activeJunction.pointerPoint),
									text: refusal
								}
							]
						})
					];
				}
				return [];
			}
			return [
				candidatePreviewOf({
					id: 'layout-candidate-junction-hover',
					role: 'subject',
					geometry: wallProposalPaper(activeJunction.proposal, y),
					labels: [
						{
							world: world(activeJunction.request.point),
							text: planarDeltaLabel(
								activeJunction.request.point[0] - activeJunction.startPoint[0],
								activeJunction.request.point[1] - activeJunction.startPoint[1]
							)
						}
					],
					snap: snapOf(activeJunction.snap)
				})
			];
		}
		return null;
	}

	return {
		get active() {
			return junctionGesture !== null;
		},
		get evaluationId() {
			return junctionGesture?.evaluationId;
		},
		get numeric() {
			return junctionGesture?.numeric ?? null;
		},
		numericTarget,
		submitNumeric,
		setNumeric,
		begin,
		move,
		release,
		endJunctionGesture,
		updateIdleJunctionHover,
		idleJunctionHandles,
		previews
	};
}
