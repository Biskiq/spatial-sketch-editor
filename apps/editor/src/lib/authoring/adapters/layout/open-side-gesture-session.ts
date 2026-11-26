/**
 * SP1d — direct manipulation of a selected open Space's stated open sides.
 *
 * A virtual edge is not a subject and has no id of its own. This session
 * therefore publishes two kinds of **handles on the Space**:
 *
 * - one mid-grip per open side, which moves the side square to itself by
 *   translating both end Junctions along the side's normal; and
 * - one end knob per end that touches a real Wall, which slides along that Wall
 *   and, at release, splits it there.
 *
 * Both are ordinary Stage editing grips naming one retained planner. Press and
 * release holds a gesture lease, previews are candidate evidence only, and no
 * pointer move writes. The release submits exactly one intent, so one drag is
 * one F.4 history entry; Escape, a refusal and a no-move release write nothing.
 *
 * The end knob's split identity is captured at the press. Preview and release
 * call the same canonical planner with that capture, so the candidate the
 * creator saw and the document that lands carry the same Junction and stub
 * Wall ids.
 */
import {
	allocateCapturedId,
	mintLayoutIdCapture,
	type LayoutIdCapture,
} from '@portfolio/layout-core/plan';
import {
	planSpaceOpenSideEndSlide,
	planSpaceOpenSideOffset,
	type LayoutDocumentWallFirst,
	type NodingIdAllocator,
} from '@portfolio/layout-core/wall';
import {
	proposeSpaceOpenSideOffset,
	roomBoundaryPolygon,
	spaceOpenSideFrames,
	spaceOutlineSelfIntersects,
	spaceOutlineSignedArea,
	spacePlacementIssues,
	type SpaceOpenSideFrame,
} from '@portfolio/layout-core/room';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type { Vec3 } from '@portfolio/camera-core/camera';

import {
	type StageAdapterContext,
	type StageCandidatePreview,
	type StageHandleDescriptor,
	type StageKeyboardIntent,
	type StagePointerIntent,
} from '$lib/authoring/stage/stage-adapter-host';
import { stageUnitRevision } from '$lib/authoring/stage/stage-adapter-host';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-adapter-host';

import { openSideRefusalWords } from './refusals';
import {
	LAYOUT_OPEN_SIDE_OFFSET_KIND,
	LAYOUT_OPEN_SIDE_SLIDE_KIND,
	openSideOffsetIntent,
	openSideSlideIntent,
} from './open-side-planners';
import {
	datumSnapDistance,
	isPointerDrag,
	type LayoutManipulationPorts,
} from './manipulation-support';
import { pointerDatumPoint } from './stage-pointer';
import { candidatePreviewOf } from './candidate-preview';
import { resolvePlanarDragSnap, type LayoutSnapWinner } from './snap';
import { wallStationFrame, type WallStationFrame } from './precision-frames';

const MID_PREFIX = 'layout-open-side-mid|';
const END_PREFIX = 'layout-open-side-end|';
const PREVIEW_ID = 'layout-open-side-candidate';

type OpenSideEnd = 'start' | 'end';

type OffsetGesture = {
	readonly kind: 'offset';
	readonly roomId: string;
	readonly frame: SpaceOpenSideFrame;
	readonly evaluationId: string;
	readonly pressCss: readonly [number, number];
	/** The press's normal component, so the grip does not jump under the hand. */
	readonly pressOffset: number;
	readonly revision: string;
	readonly lease: Extract<GestureAcquisition, { kind: 'granted' }>;
	offset: number;
	snap: LayoutSnapWinner | null;
	refusal: string | null;
	/** The attempted document used for the live candidate. */
	preview: LayoutDocumentWallFirst | null;
};

type SlideGesture = {
	readonly kind: 'slide';
	readonly roomId: string;
	readonly startJunctionId: string;
	readonly endJunctionId: string;
	readonly end: OpenSideEnd;
	readonly wallId: string;
	readonly stationFrame: WallStationFrame;
	readonly endpointStation: number;
	readonly endpointPoint: LayoutVec2;
	readonly evaluationId: string;
	readonly pressCss: readonly [number, number];
	readonly pressPoint: LayoutVec2;
	/** The press's Wall station, so the knob does not jump under the hand. */
	readonly pressStation: number;
	readonly revision: string;
	readonly capture: LayoutIdCapture;
	readonly lease: Extract<GestureAcquisition, { kind: 'granted' }>;
	station: number;
	point: LayoutVec2;
	snap: LayoutSnapWinner | null;
	refusal: string | null;
	/** The validated attempted document, or null while refused. */
	preview: LayoutDocumentWallFirst | null;
};

type OpenSideGesture = OffsetGesture | SlideGesture;

function sameEdge(
	first: { readonly startJunctionId: string; readonly endJunctionId: string },
	second: { readonly startJunctionId: string; readonly endJunctionId: string },
): boolean {
	return (
		first.startJunctionId === second.startJunctionId && first.endJunctionId === second.endJunctionId
	);
}

function clean(value: number): number {
	return Number(value.toFixed(9));
}

function midpointLabel(offset: number): string {
	return `Δn ${offset >= 0 ? '+' : '-'}${Math.abs(offset).toFixed(2)} m`;
}

function stationLabel(station: number): string {
	return `${station.toFixed(2)} m`;
}

/** The nearest authored Space named by a placement rejection. */
function otherSpaceName(
	document: LayoutDocumentWallFirst,
	roomId: string,
	targetIds: readonly string[],
): string | null {
	const other = targetIds.find((id) => id !== roomId);
	return other === undefined
		? null
		: (document.rooms.find((room) => room.id === other)?.name ?? null);
}

/**
 * The preview's own refusal, using the same placement gate the planner runs.
 * A self-crossing or inverted outline is not a placement conflict, so it gets
 * the session's own words rather than a second geometry verdict.
 */
function attemptedRefusal(attempted: LayoutDocumentWallFirst, roomId: string): string | null {
	const polygon = roomBoundaryPolygon(attempted, roomId);
	if (
		polygon === null ||
		polygon.length < 3 ||
		spaceOutlineSignedArea(polygon) <= 0 ||
		spaceOutlineSelfIntersects(polygon)
	) {
		return 'This open side would fold its Space';
	}
	const placement = spacePlacementIssues(attempted).find((issue) => issue.roomIds.includes(roomId));
	if (placement === undefined) return null;
	const name = otherSpaceName(attempted, roomId, placement.roomIds);
	return openSideRefusalWords(placement.code, placement.message, name);
}

/** The other Space a placement message names, for the release refusal. */
function otherSpaceNameInMessage(
	document: LayoutDocumentWallFirst,
	roomId: string,
	message: string,
): string | null {
	const own = document.rooms.find((room) => room.id === roomId)?.name;
	return (
		[...message.matchAll(/Space '([^']+)'/g)]
			.map((match) => match[1]!)
			.find((name) => name !== own) ?? null
	);
}

/** A snap is only shown when the constrained handle actually reaches it. */
function constrainedSnap(
	winner: LayoutSnapWinner | null,
	point: LayoutVec2,
): LayoutSnapWinner | null {
	if (winner === null) return null;
	return Math.hypot(winner.point[0] - point[0], winner.point[1] - point[1]) <= 1e-6 ? winner : null;
}

function refusalForSlideRejection(
	document: LayoutDocumentWallFirst,
	roomId: string,
	code: string,
	message: string,
	targetIds: readonly string[],
): string {
	return openSideRefusalWords(code, message, otherSpaceName(document, roomId, targetIds));
}

function previewPolygon(
	document: LayoutDocumentWallFirst,
	roomId: string,
	y: number,
): readonly Vec3[] {
	const polygon = roomBoundaryPolygon(document, roomId);
	if (polygon === null) return [];
	return polygon.map(([x, z]) => [x, y, z] as Vec3);
}

/** Nearest station on a curved or straight Wall to one datum point. */
function stationAtPoint(frame: WallStationFrame, point: LayoutVec2): number | null {
	if (!frame.curved) {
		const along =
			(point[0] - frame.start[0]) * frame.direction[0] +
			(point[1] - frame.start[1]) * frame.direction[1];
		return clean(along);
	}
	let best: number | null = null;
	let bestDistance = Infinity;
	const coarse = 64;
	const sample = (station: number) => {
		const at = frame.pointAt(station);
		if (at === null) return;
		const distance = (at.point[0] - point[0]) ** 2 + (at.point[1] - point[1]) ** 2;
		if (distance < bestDistance) {
			bestDistance = distance;
			best = station;
		}
	};
	for (let index = 0; index <= coarse; index += 1) sample((frame.length * index) / coarse);
	if (best === null) return null;
	let step = frame.length / coarse;
	for (let round = 0; round < 24; round += 1) {
		const center = best;
		step /= 2;
		sample(center - step);
		sample(center + step);
	}
	return clean(best);
}

/** The captured noder allocation shared by the slide's preview and release. */
function capturedNodingAllocator(capture: LayoutIdCapture): NodingIdAllocator {
	return {
		nextWallId(baseDocument: LayoutDocumentWallFirst, seed: string): string {
			return allocateCapturedId(new Set(baseDocument.walls.map((wall) => wall.id)), seed, capture);
		},
		nextJunctionId(baseDocument: LayoutDocumentWallFirst, seed: string): string {
			return allocateCapturedId(
				new Set(baseDocument.junctions.map((junction) => junction.id)),
				seed,
				capture,
			);
		},
	};
}

export function createOpenSideGestureSession({
	services,
	document,
	levelId,
	contentRevision,
	publishRefusal,
	settleRefusal,
}: LayoutManipulationPorts) {
	let openSideGesture: OpenSideGesture | null = null;

	function endGesture(): void {
		const current = openSideGesture;
		openSideGesture = null;
		if (current?.lease.lease.active) current.lease.lease.release();
		publishRefusal(null);
	}

	function selectedOpenRoomId(ctx: StageAdapterContext): string | null {
		const primary = ctx.selectionState().primary;
		if (primary === null || primary.domain !== 'layout' || primary.subject.kind !== 'room') {
			return null;
		}
		const room = document.rooms.find((candidate) => candidate.id === primary.subject.id);
		return room !== undefined && room.virtualEdges.length > 0 ? room.id : null;
	}

	function descriptors(ctx: StageAdapterContext): readonly StageHandleDescriptor[] {
		const roomId = selectedOpenRoomId(ctx);
		if (roomId === null) return [];
		const y = ctx.snapshot.domain.datumMeters;
		const current = openSideGesture?.roomId === roomId ? openSideGesture : null;
		const result: StageHandleDescriptor[] = [];
		for (const frame of spaceOpenSideFrames(document, roomId)) {
			const activeOffset =
				current?.kind === 'offset' && sameEdge(current.frame, frame) ? current : null;
			const offset = activeOffset?.offset ?? 0;
			const mid: [number, number, number] = [
				frame.midpoint[0] + frame.normal[0] * offset,
				y,
				frame.midpoint[1] + frame.normal[1] * offset,
			];
			result.push({
				id: `${MID_PREFIX}${frame.startJunctionId}|${frame.endJunctionId}`,
				kind: 'point',
				role: 'edit',
				draw: { cross: true },
				anchor: mid,
				extent: Math.max(0.35, Math.min(frame.length / 2, 1.2)),
				label: 'Open side',
				fact: 'open-side-offset',
				verb: 'Move',
				planner: LAYOUT_OPEN_SIDE_OFFSET_KIND,
				value: midpointLabel(offset),
				refusal: activeOffset?.refusal ?? null,
			});
			for (const end of ['start', 'end'] as const) {
				const wall = end === 'start' ? frame.startWall : frame.endWall;
				if (wall === null) continue;
				const activeSlide =
					current?.kind === 'slide' &&
					current.end === end &&
					current.wallId === wall.wallId &&
					current.startJunctionId === frame.startJunctionId &&
					current.endJunctionId === frame.endJunctionId
						? current
						: null;
				const at: [number, number, number] =
					activeSlide === null
						? [frame[end][0], y, frame[end][1]]
						: [activeSlide.point[0], y, activeSlide.point[1]];
				result.push({
					id: `${END_PREFIX}${end}|${frame.startJunctionId}|${frame.endJunctionId}`,
					kind: 'point',
					role: 'edit',
					draw: { pointRadius: 5, hollow: true },
					anchor: at,
					extent: 0.3,
					label: end === 'start' ? 'Open side start' : 'Open side end',
					fact: 'open-side-end',
					verb: 'Slide',
					planner: LAYOUT_OPEN_SIDE_SLIDE_KIND,
					value:
						activeSlide === null ? `${frame.roomName} · open` : stationLabel(activeSlide.station),
					refusal: activeSlide?.refusal ?? null,
				});
			}
		}
		return result;
	}

	/** Parse one admitted handle id back into its addressed edge. */
	function addressedHandle(id: string): {
		readonly kind: 'offset' | 'slide';
		readonly end?: OpenSideEnd;
		readonly startJunctionId: string;
		readonly endJunctionId: string;
	} | null {
		if (id.startsWith(MID_PREFIX)) {
			const [startJunctionId, endJunctionId] = id.slice(MID_PREFIX.length).split('|');
			return startJunctionId && endJunctionId
				? { kind: 'offset', startJunctionId, endJunctionId }
				: null;
		}
		if (id.startsWith(END_PREFIX)) {
			const [end, startJunctionId, endJunctionId] = id.slice(END_PREFIX.length).split('|');
			if ((end !== 'start' && end !== 'end') || !startJunctionId || !endJunctionId) return null;
			return { kind: 'slide', end, startJunctionId, endJunctionId };
		}
		return null;
	}

	function acquire(evaluationId: string): Extract<GestureAcquisition, { kind: 'granted' }> | null {
		const lease = services.stage.acquireGesture({
			owner: 'layout-open-side',
			evaluationId,
			policy: 'cancel-on-reading-change',
		});
		return lease.kind === 'granted' ? lease : null;
	}

	function beginOffset(
		intent: StagePointerIntent,
		ctx: StageAdapterContext,
		addressed: { readonly startJunctionId: string; readonly endJunctionId: string },
	): boolean {
		const roomId = selectedOpenRoomId(ctx);
		if (roomId === null) return false;
		const frame = spaceOpenSideFrames(document, roomId).find((candidate) =>
			sameEdge(candidate, addressed),
		);
		const point = pointerDatumPoint(ctx, intent.css);
		if (frame === undefined || point === null) return false;
		const lease = acquire(intent.evaluationId);
		if (lease === null) return false;
		settleRefusal(null);
		openSideGesture = {
			kind: 'offset',
			roomId,
			frame,
			evaluationId: intent.evaluationId,
			pressCss: intent.css,
			pressOffset:
				(point[0] - frame.midpoint[0]) * frame.normal[0] +
				(point[1] - frame.midpoint[1]) * frame.normal[1],
			revision: services.authoring.acceptedRevision().revisionId,
			lease,
			offset: 0,
			snap: null,
			refusal: null,
			preview: null,
		};
		services.stage.notifySurfaceChange();
		return true;
	}

	function beginSlide(
		intent: StagePointerIntent,
		ctx: StageAdapterContext,
		addressed: {
			readonly end?: OpenSideEnd;
			readonly startJunctionId: string;
			readonly endJunctionId: string;
		},
	): boolean {
		const roomId = selectedOpenRoomId(ctx);
		if (roomId === null || addressed.end === undefined) return false;
		const frame = spaceOpenSideFrames(document, roomId).find((candidate) =>
			sameEdge(candidate, addressed),
		);
		const point = pointerDatumPoint(ctx, intent.css);
		if (frame === undefined || point === null) return false;
		const end = addressed.end;
		const adjoining = end === 'start' ? frame.startWall : frame.endWall;
		if (adjoining === null) return false;
		const stationFrame = wallStationFrame(document, adjoining.wallId);
		if (stationFrame === null) return false;
		const pressStation = stationAtPoint(stationFrame, [point[0], point[1]]);
		if (pressStation === null) return false;
		const endpointStation =
			end === 'start'
				? adjoining.direction === 'forward'
					? stationFrame.length
					: 0
				: adjoining.direction === 'forward'
					? 0
					: stationFrame.length;
		const lease = acquire(intent.evaluationId);
		if (lease === null) return false;
		settleRefusal(null);
		openSideGesture = {
			kind: 'slide',
			roomId,
			startJunctionId: frame.startJunctionId,
			endJunctionId: frame.endJunctionId,
			end,
			wallId: adjoining.wallId,
			stationFrame,
			endpointStation,
			endpointPoint: [...frame[end]] as LayoutVec2,
			evaluationId: intent.evaluationId,
			pressCss: intent.css,
			pressPoint: [point[0], point[1]],
			pressStation,
			revision: services.authoring.acceptedRevision().revisionId,
			capture: mintLayoutIdCapture(),
			lease,
			station: endpointStation,
			point: [...frame[end]] as LayoutVec2,
			snap: null,
			refusal: null,
			preview: null,
		};
		services.stage.notifySurfaceChange();
		return true;
	}

	function moveOffset(
		current: OffsetGesture,
		intent: StagePointerIntent,
		ctx: StageAdapterContext,
	): void {
		if (!isPointerDrag(current.pressCss, intent.css)) {
			current.offset = 0;
			current.refusal = null;
			current.snap = null;
			services.stage.notifySurfaceChange();
			return;
		}
		const point = pointerDatumPoint(ctx, intent.css);
		if (point === null) return;
		const frame = current.frame;
		const raw =
			(point[0] - frame.midpoint[0]) * frame.normal[0] +
			(point[1] - frame.midpoint[1]) * frame.normal[1] -
			current.pressOffset;
		const desired: LayoutVec2 = [
			frame.midpoint[0] + frame.normal[0] * raw,
			frame.midpoint[1] + frame.normal[1] * raw,
		];
		const snapped = resolvePlanarDragSnap(frame.midpoint, desired, ctx.drafting(), (from, to) =>
			datumSnapDistance(ctx, from, to),
		);
		const offset = clean(
			(snapped.point[0] - frame.midpoint[0]) * frame.normal[0] +
				(snapped.point[1] - frame.midpoint[1]) * frame.normal[1],
		);
		current.offset = Math.abs(offset) <= 1e-9 ? 0 : offset;
		current.preview = null;
		current.snap = null;
		current.refusal = null;
		if (current.offset !== 0) {
			const attempted = proposeSpaceOpenSideOffset(document, frame, current.offset);
			const plan = planSpaceOpenSideOffset(
				document,
				current.roomId,
				frame.startJunctionId,
				frame.endJunctionId,
				current.offset,
			);
			if (plan.kind === 'success') {
				current.preview = plan.document;
				current.refusal = attemptedRefusal(plan.document, current.roomId);
			} else {
				current.preview = attempted;
				current.refusal = openSideRefusalWords(
					plan.rejection.code,
					plan.rejection.message,
					otherSpaceName(document, current.roomId, plan.rejection.targetIds ?? []),
				);
			}
		}
		const at = movedMidpoint(current);
		current.snap = constrainedSnap(snapped.winner, at);
		services.stage.notifySurfaceChange();
	}

	function moveSlide(
		current: SlideGesture,
		intent: StagePointerIntent,
		ctx: StageAdapterContext,
	): void {
		if (!isPointerDrag(current.pressCss, intent.css)) {
			current.station = current.endpointStation;
			current.point = [...current.endpointPoint] as LayoutVec2;
			current.refusal = null;
			current.snap = null;
			current.preview = null;
			services.stage.notifySurfaceChange();
			return;
		}
		const point = pointerDatumPoint(ctx, intent.css);
		if (point === null) return;
		const snapped = resolvePlanarDragSnap(
			current.pressPoint,
			[point[0], point[1]],
			ctx.drafting(),
			(from, to) => datumSnapDistance(ctx, from, to),
		);
		const pointerStation = stationAtPoint(current.stationFrame, [
			snapped.point[0],
			snapped.point[1],
		]);
		if (pointerStation === null) return;
		const station = clean(current.endpointStation + (pointerStation - current.pressStation));
		const at = current.stationFrame.pointAt(station);
		if (at === null) return;
		current.station = station;
		current.point = [at.point[0], at.point[1]];
		current.snap = constrainedSnap(snapped.winner, current.point);
		current.preview = null;
		current.refusal = null;
		if (station <= 1e-9 || station >= current.stationFrame.length - 1e-9) {
			current.refusal = 'Slide the open side inside its Wall';
			services.stage.notifySurfaceChange();
			return;
		}
		const plan = planSpaceOpenSideEndSlide(
			document,
			current.roomId,
			current.startJunctionId,
			current.endJunctionId,
			current.end,
			current.wallId,
			station,
			current.point,
			capturedNodingAllocator(current.capture),
		);
		if (plan.kind === 'success') {
			current.preview = plan.document;
			current.refusal = attemptedRefusal(plan.document, current.roomId);
		} else {
			current.refusal = refusalForSlideRejection(
				document,
				current.roomId,
				plan.rejection.code,
				plan.rejection.message,
				plan.rejection.targetIds ?? [],
			);
		}
		services.stage.notifySurfaceChange();
	}

	function pointer(intent: StagePointerIntent, ctx: StageAdapterContext): boolean {
		if (intent.phase === 'down') {
			const handleId =
				intent.handleId ??
				(() => {
					const hit = services.stage.hitMark({ css: intent.css, coarse: intent.coarse === true });
					return hit !== null && hit.adapterId === 'layout' && hit.role === 'edit'
						? hit.id
						: undefined;
				})();
			if (handleId === undefined) return false;
			const addressed = addressedHandle(handleId);
			if (addressed === null) return false;
			return addressed.kind === 'offset'
				? beginOffset(intent, ctx, addressed)
				: beginSlide(intent, ctx, addressed);
		}
		const current = openSideGesture;
		if (current === null) return false;
		if (
			intent.phase === 'cancel' ||
			intent.evaluationId !== current.evaluationId ||
			!current.lease.lease.active
		) {
			endGesture();
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.phase === 'move') {
			if (current.kind === 'offset') moveOffset(current, intent, ctx);
			else moveSlide(current, intent, ctx);
			return true;
		}
		// Release: one captured intent, one history entry.
		if (current.kind === 'offset') {
			// A release can name a position no move event delivered.
			moveOffset(current, intent, ctx);
			const moved = Math.abs(current.offset) > 1e-9 && isPointerDrag(current.pressCss, intent.css);
			const refusal = current.refusal;
			const at = movedMidpoint(current);
			endGesture();
			if (moved && refusal === null) void commitOffset(current);
			else if (moved && refusal !== null) settleAtRoom(current.roomId, at, refusal);
			services.stage.notifySurfaceChange();
			return true;
		}
		moveSlide(current, intent, ctx);
		const moved =
			Math.abs(current.station - current.endpointStation) > 1e-9 &&
			isPointerDrag(current.pressCss, intent.css);
		const refusal = current.refusal;
		endGesture();
		if (moved && refusal === null) void commitSlide(current);
		else if (moved && refusal !== null) settleAtRoom(current.roomId, current.point, refusal);
		services.stage.notifySurfaceChange();
		return true;
	}

	function movedMidpoint(current: OffsetGesture): LayoutVec2 {
		return [
			current.frame.midpoint[0] + current.frame.normal[0] * current.offset,
			current.frame.midpoint[1] + current.frame.normal[1] * current.offset,
		];
	}

	function settleAtRoom(roomId: string, point: LayoutVec2, text: string): void {
		settleRefusal({
			subject: { kind: 'room', roomId },
			contentRevision,
			point: [point[0], point[1]],
			text,
		});
	}

	async function commitOffset(current: OffsetGesture): Promise<void> {
		const snapshot = services.stage.snapshot();
		if (stageUnitRevision(snapshot, 'layout') !== contentRevision) return;
		const outcome = await services.authoring.accept(
			openSideOffsetIntent({
				roomId: current.roomId,
				startJunctionId: current.frame.startJunctionId,
				endJunctionId: current.frame.endJunctionId,
				offset: current.offset,
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: current.revision,
				contentRevision,
				levelId,
			}),
		);
		if (
			outcome.kind === 'refused' &&
			stageUnitRevision(services.stage.snapshot(), 'layout') === contentRevision
		) {
			settleAtRoom(
				current.roomId,
				movedMidpoint(current),
				openSideRefusalWords(
					outcome.code,
					outcome.message,
					otherSpaceNameInMessage(document, current.roomId, outcome.message),
				),
			);
		}
		services.stage.notifySurfaceChange();
	}

	async function commitSlide(current: SlideGesture): Promise<void> {
		const snapshot = services.stage.snapshot();
		if (stageUnitRevision(snapshot, 'layout') !== contentRevision) return;
		const outcome = await services.authoring.accept(
			openSideSlideIntent({
				roomId: current.roomId,
				startJunctionId: current.startJunctionId,
				endJunctionId: current.endJunctionId,
				end: current.end,
				wallId: current.wallId,
				station: current.station,
				capture: current.capture,
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: current.revision,
				contentRevision,
				levelId,
			}),
		);
		if (
			outcome.kind === 'refused' &&
			stageUnitRevision(services.stage.snapshot(), 'layout') === contentRevision
		) {
			settleAtRoom(
				current.roomId,
				current.point,
				openSideRefusalWords(
					outcome.code,
					outcome.message,
					otherSpaceNameInMessage(document, current.roomId, outcome.message),
				),
			);
		}
		services.stage.notifySurfaceChange();
	}

	function previews(y: number): readonly StageCandidatePreview[] | null {
		const current = openSideGesture;
		if (current === null) return null;
		if (current.kind === 'offset') {
			if (current.offset === 0) return [];
			const at = movedMidpoint(current);
			const label = {
				world: [at[0], y, at[1]] as [number, number, number],
				text: current.refusal ?? midpointLabel(current.offset),
			};
			return [
				candidatePreviewOf({
					id: PREVIEW_ID,
					role: current.refusal === null ? 'subject' : 'refused',
					geometry: {
						polygons: [previewPolygon(current.preview ?? document, current.roomId, y)],
						segments: [],
					},
					labels: [label],
					snap: current.snap === null ? undefined : { world: label.world, name: current.snap.name },
				}),
			];
		}
		const at = current.point;
		const label = {
			world: [at[0], y, at[1]] as [number, number, number],
			text: current.refusal ?? stationLabel(current.station),
		};
		const source = current.preview ?? document;
		return [
			candidatePreviewOf({
				id: PREVIEW_ID,
				role: current.refusal === null ? 'subject' : 'refused',
				geometry: { polygons: [previewPolygon(source, current.roomId, y)], segments: [] },
				labels: [label],
				snap: current.snap === null ? undefined : { world: label.world, name: current.snap.name },
			}),
		];
	}

	function key(intent: StageKeyboardIntent): boolean {
		if (openSideGesture === null || intent.kind !== 'cancel') return false;
		endGesture();
		services.stage.notifySurfaceChange();
		return true;
	}

	return { descriptors, pointer, previews, key, endGesture };
}
