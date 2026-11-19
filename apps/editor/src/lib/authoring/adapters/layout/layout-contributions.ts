import { selectedRegion, selectedRoomLabel } from './layout-subjects';
import { previewCoordinates, type SettledLayoutRefusal } from './manipulation-support';
import { regionWallRelations } from '@portfolio/layout-core';
import { candidatePreviewOf } from './candidate-preview';
import { restingObjectsOnFloorRegion } from './region-resting';
import type { StageCandidatePreview } from '$lib/authoring/stage/stage-adapter-host';
import { sizeDeltaLabel } from '$lib/authoring/stage/stage-adapter-host';
import {
	mintLayoutIdCapture,
	planDeleteWallFirstOpening,
	resolveRoomCopyEnclosure,
	isClosedWall,
	resolveLayoutSurface,
	spaceOfSurface,
	surfacesOfSpace,
	wallSideAt,
	type LayoutSurfaceRef,
	type FixedWallEndpoint,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import {
	type StageAdapterBinding,
	type StageAdapterContext,
	type StageCardAction,
	type StageCardActionOutcome,
	type StageCardSubject,
	type StageGuideContribution,
	type StagePaintAnswer,
	type StagePaintSpaceScope
} from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope, stageUnitRevision } from '$lib/authoring/stage/stage-adapter-host';
import type { StageHeightTick } from '$lib/authoring/stage/stage-adapter-host';

import LayoutInkPalette from './LayoutInkPalette.svelte';
import LayoutPlacementInstrument from './LayoutPlacementInstrument.svelte';
import LayoutCardFields from './LayoutCardFields.svelte';
import LayoutRegionCard from './LayoutRegionCard.svelte';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
import { interiorLift } from '$lib/authoring/layout/interior-lift-store.svelte';
import { wallFace } from '$lib/authoring/layout/wall-face-store';
import { WALL_UNFOLD_SHAPE_REFUSAL } from '$lib/layout/wall-unfold';
import { wallFaceFrame, wallSheetFaceFrame } from '$lib/layout/wall-face';
import { droppedRoomRelationWords, roomDuplicateRefusalWords, wallSplitRefusalWords } from './refusals';
import { independentWallOverlapGuides } from './room-overlap-cue';
import {
	LAYOUT_OPENING_RESIZE_KIND,
	openingDeleteIntent,
	openingRefusalWords,
	type OpeningResizeCorner,
	type OpeningResizeEdge
} from './opening-planners';
import {
	LAYOUT_CIRCLE_RADIUS_KIND,
	layoutSubjectReference,
	planWallDeletion,
	wallDeleteIntent,
	type WallDeletionPreview
} from './drawing-planners';
import { wallSplitIntent } from './split-planners';
import { LAYOUT_ROOM_DUPLICATE_KIND } from './room-duplicate-planners';
import {
	LAYOUT_REGION_FOOTPRINT_KIND,
	LAYOUT_REGION_REMOVE_KIND,
	layoutRegionNameTarget,
	regionEditIntent
} from './region-planners';
import type { RegionEdgePick } from './session-ports';
import { LAYOUT_INK_ENTRY, LAYOUT_INK_TASK } from './ink';
import type { StageHandleDescriptor } from '$lib/authoring/stage/stage-adapter-host';
import {
	planNumericEntryField,
	type PlanNumericEntryState,
	type PlanNumericField
} from '$lib/authoring/layout/plan-numeric-entry';
import {
	LAYOUT_OPENING_MEASURE_KIND,
	LAYOUT_PLINTH_PLACE_KIND,
	LAYOUT_JUNCTION_MOVE_KIND,
	LAYOUT_WALL_LENGTH_KIND,
	LAYOUT_WALL_MOVE_KIND,
	LAYOUT_WALL_BEND_KIND,
	LAYOUT_ROOM_OVERHEAD_KIND,
	LAYOUT_SPACE_REMOVE_KIND,
	buildLayoutIntent,
	layoutFacts,
	layoutRoomFacts,
	layoutCardFieldIds,
	layoutSubjectOf,
	wallStationFrame,
	curvedWallFrame,
	curvedWallPointAt,
	previewWallStraighten,
	layoutSurfaceLineageConsequence,
	wallStraightenIntent,
	wallStationAtPoint,
	type WallFrame,
	type WallManipulationRequest
} from './precision';
import { layoutNameTarget, layoutRoomNameTarget } from './adapter-support';
import { wallRequestLabel } from './wall-gesture';
import type { LayoutSessionPorts } from './session-ports';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import {
	selectedWall,
	selectedClosedWall,
	selectedCurvedWall,
	selectedOpening,
	wallLength,
	wallDirection,
	framePoint
} from './layout-subjects';

const LAYOUT_PLINTH_ENTRY = 'layout-place-plinth';

function roomDuplicateCount(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

type ActiveKnot = { readonly wallId: string; readonly knotId: string };
type LayoutMarkState = {
	readonly curve: {
		readonly activeKnot: ActiveKnot | null;
		readonly idleBendHint: { readonly wallId: string; readonly station: number } | null;
		readonly radiusRefusal: string | null;
		readonly bend: {
			readonly wallId: string;
			readonly knotId: string;
			readonly refusal: string | null;
		} | null;
	};
	readonly wall: {
		readonly markId: string;
		readonly numeric: PlanNumericEntryState | null;
		readonly request: WallManipulationRequest | null;
		readonly fixed: FixedWallEndpoint;
		readonly frame: WallFrame;
		readonly incidentWalls: number;
	} | null;
	readonly opening: {
		readonly openingId: string;
		readonly markId: string;
		readonly numeric: PlanNumericEntryState | null;
		readonly numericField: PlanNumericField;
		readonly previewDocument: LayoutDocumentWallFirst | null;
	} | null;
	readonly junctionActive: boolean;
	readonly refusal: string | null;
};

type ContributionPorts = {
	readonly services: StageAdapterServices;
	readonly context: StageAdapterContext;
	readonly document: LayoutDocumentWallFirst;
	readonly levelId: string;
	readonly deletionDisclosures: Map<string, WallDeletionPreview>;
	readonly selectLayoutSubject: LayoutSessionPorts['select'];
	readonly readActiveKnot: () => ActiveKnot | null;
	readonly requestRoomDuplicate: (roomId: string) => StageCardActionOutcome;
	readonly removeSelectedKnot: (
		wallId: string
	) => Promise<StageCardActionOutcome> | StageCardActionOutcome;
	readonly regionEdgePick: RegionEdgePick;
};

/**
 * X1 — Lift is a **reading, not an edit**.
 *
 * The action changes only the shell's temporary scope: no document value, no
 * history entry, no Camera intent. It is a Room action because a generated lid
 * has no subject of its own and is selected through its Room. Running it while
 * Lift is on with another scope narrows to this Space; while it is off, it
 * starts here. The label follows the live scope, so the same button offers the
 * way back.
 */
function roomLiftAction(
	services: StageAdapterServices,
	roomId: string,
	roomName: string
): StageCardAction {
	const scope = interiorLift.reading?.scope ?? null;
	const liftedHere = scope?.kind === 'space' && scope.roomId === roomId;
	return {
		id: 'layout-room-lift',
		label: liftedHere ? 'Put back' : 'Lift',
		detail: liftedHere
			? `Puts ${roomName}'s overhead back. Nothing in the document changes.`
			: `Lifts ${roomName}'s overhead to read inside. Nothing in the document changes.`,
		run: async () => {
			if (liftedHere) interiorLift.putBack();
			else interiorLift.lift({ kind: 'space', roomId });
			services.stage.notifySurfaceChange();
			return { kind: 'accepted' };
		}
	};
}

export function createLayoutContributions({
	services,
	context,
	document,
	levelId,
	deletionDisclosures,
	selectLayoutSubject,
	readActiveKnot,
	requestRoomDuplicate,
	removeSelectedKnot,
	regionEdgePick
}: ContributionPorts) {
	/**
	 * A5 — the derived **overlaps, not joined** cue. One query over this
	 * binding's accepted document, computed once and projected by the host with
	 * every other guide. Presentation only: it is never authored, planned,
	 * serialized or written to history, and it cannot be pressed.
	 */
	let overlapGuides: readonly StageGuideContribution[] | null = null;
	function guides(): readonly StageGuideContribution[] {
		if (overlapGuides === null) {
			overlapGuides = independentWallOverlapGuides(
				document,
				context.snapshot.domain.datumMeters
			);
		}
		return overlapGuides;
	}

	/**
	 * The marks a selected Wall or Opening publishes.
	 *
	 * Every descriptor names a real fact and the exact planner the Card field
	 * submits; the host admits it, owns disclosure and draws it. Values are the
	 * live candidate while a gesture is held, otherwise the accepted value.
	 */
	function markDescriptors(
		adapterContext: StageAdapterContext,
		state: LayoutMarkState,
		taskOpen: boolean
	): readonly StageHandleDescriptor[] {
		if (taskOpen || services.stage.session.task() !== null) return [];
		const { activeKnot, idleBendHint, radiusRefusal, bend: bendGesture } = state.curve;
		const { wall: gesture, opening: openingGesture, junctionActive, refusal } = state;
		const wall = selectedWall(adapterContext);
		const curved = wall === null ? selectedCurvedWall(document, adapterContext) : null;
		const closed = wall === null && curved === null ? selectedClosedWall(adapterContext) : null;
		const opening =
			wall === null && curved === null && closed === null
				? selectedOpening(document, adapterContext)
				: null;
		if (wall === null && curved === null && closed === null && opening === null) return [];
		const y = adapterContext.snapshot.domain.datumMeters;
		// The unrolled sheet is the editing surface: its Wall's canonical marks
		// (including a closed Wall's radius grip) are not drawn or hit while it
		// is open. Card fields remain available.
		if (
			(wall !== null && wallUnfold.isActive(wall.wallId)) ||
			(curved !== null && wallUnfold.isActive(curved.wallId)) ||
			(closed !== null && wallUnfold.isActive(closed.wallId))
		)
			return [];
		if (closed !== null) {
			// The only shape grip a closed Wall publishes is the radius grip.
			// It sits on the authored seam (the rim point) and writes the same
			// retained radius planner as the Card's Radius/Diameter fields.
			// The closed Wall's only shape grip is a radius ray from the centre to
			// the authored seam, never a pair of end points: a closed Wall has no
			// ends to move. The ray is the primary grip, so it stays visible.
			// The size chip sits away from the seam and discloses the retained
			// height/thickness writers; it never replaces the radius semantics.
			const planReading = adapterContext.evaluation.settledReading === 'plan';
			const seamX = closed.seam[0] - closed.center[0];
			const seamZ = closed.seam[1] - closed.center[1];
			const radius = Math.hypot(seamX, seamZ);
			const chipAngle = Math.atan2(seamZ, seamX) + Math.PI * 2 * 0.82;
			const chipPoint: LayoutVec2 = [
				closed.center[0] + Math.cos(chipAngle) * radius,
				closed.center[1] + Math.sin(chipAngle) * radius
			];
			return [
				{
					id: 'layout-wall-size-chip',
					kind: 'point',
					role: 'disclose',
					anchor: [chipPoint[0], y, chipPoint[1]],
					screen: { offset: [0, -22] },
					label: 'Size',
					reveals: ['layout-wall-thickness', ...(planReading ? [] : ['layout-wall-height'])]
				},
				{
					id: 'layout-circle-radius-mark',
					kind: 'ray',
					role: 'edit',
					anchor: [closed.center[0], y, closed.center[1]],
					axis: [seamX, 0, seamZ],
					extent: closed.radius,
					label: 'Radius',
					fact: 'radius',
					verb: 'Resize',
					planner: LAYOUT_CIRCLE_RADIUS_KIND,
					value: `${closed.radius.toFixed(2)} m`,
					refusal: radiusRefusal
				}
			];
		}
		if (curved !== null) {
			// A curved Wall does not carry a permanent constellation of bend
			// handles. The body is the ordinary editing surface; only the knot a
			// creator deliberately activated, or is currently dragging, is drawn.
			const source = document.walls.find((candidate) => candidate.id === curved.wallId);
			if (source === undefined || source.centerline.kind === 'line') return [];
			const planReading = adapterContext.evaluation.settledReading === 'plan';
			const chipAt = curvedWallPointAt(curved.frame, curved.frame.length * 0.82);
			const sizeChip =
				chipAt === null
					? null
					: ({
							id: 'layout-wall-size-chip',
							kind: 'point',
							role: 'disclose',
							anchor: [chipAt.point[0], y, chipAt.point[1]],
							screen: { offset: [0, -22] },
							label: 'Size',
							// A curved Wall has no exact-length writer: `planExactWallLength`
							// rejects a non-line centerline, so there is no honest length ray to
							// publish. The canonical arc length is a reading, not an operation,
							// and the chip's value is where the mark vocabulary carries one.
							value: `Length (arc) ${curved.frame.length.toFixed(3)} m`,
							// Arc length is not an exact-length writer on a curve, so the
							// disclosure offers only the retained height/thickness scalars.
							reveals: ['layout-wall-thickness', ...(planReading ? [] : ['layout-wall-height'])]
						} satisfies StageHandleDescriptor);
			const withSize = (marks: StageHandleDescriptor[]): StageHandleDescriptor[] =>
				sizeChip === null ? marks : [sizeChip, ...marks];
			// A different host clears the session's active knot. This is a
			// read-side reconciliation, not a document or history change.

			const live = bendGesture?.wallId === curved.wallId ? bendGesture : null;
			const shownId = activeKnot?.wallId === curved.wallId ? activeKnot.knotId : (live?.knotId ?? null);
			const knot =
				shownId === null
					? undefined
					: source.centerline.knots.find((candidate) => candidate.id === shownId);
			// Both ends of an open curved Wall stay reachable while its
			// body offers Bend. They are the same junction writers a straight Wall
			// uses, so shared ends keep canonical identity.
			const ends: StageHandleDescriptor[] = [
				{
					id: 'layout-wall-start-mark',
					kind: 'point',
					role: 'edit',
					anchor: [curved.frame.start[0], y, curved.frame.start[1]],
					draw: { pointRadius: 4.6 },
					label: 'Wall start',
					fact: 'start',
					verb: 'Move point',
					planner: LAYOUT_JUNCTION_MOVE_KIND,
					value: `X ${curved.frame.start[0].toFixed(2)} · Z ${curved.frame.start[1].toFixed(2)} m`,
					refusal: junctionActive ? refusal : null
				},
				{
					id: 'layout-wall-end-mark',
					kind: 'point',
					role: 'edit',
					anchor: [curved.frame.end[0], y, curved.frame.end[1]],
					draw: { pointRadius: 4.6 },
					label: 'Wall end',
					fact: 'end',
					verb: 'Move point',
					planner: LAYOUT_JUNCTION_MOVE_KIND,
					value: `X ${curved.frame.end[0].toFixed(2)} · Z ${curved.frame.end[1].toFixed(2)} m`,
					refusal: junctionActive ? refusal : null
				}
			];
			// One hollow shape point per span. It is the ordinary Bend writer at
			// that span's midpoint; the knot itself stays hidden until activated.
			const spanStations = [0];
			for (const candidate of source.centerline.knots) {
				const station = wallStationAtPoint(document, curved.wallId, [
					candidate.point[0],
					candidate.point[1]
				]);
				if (station !== null) spanStations.push(station);
			}
			spanStations.push(curved.frame.length);
			spanStations.sort((a, b) => a - b);
			const spanMarks: StageHandleDescriptor[] = [];
			// Shape points are contextual on the selected Wall. A body press
			// away from a ring still moves; a ring press bends. No hidden arm.
			for (let index = 1; index < spanStations.length; index += 1) {
				const from = spanStations[index - 1]!;
				const to = spanStations[index]!;
				if (!(to - from > 0.02)) continue;
				const at = curvedWallPointAt(curved.frame, (from + to) / 2)?.point;
				if (at === undefined) continue;
				// Proximity discovery uses the existing span ring: no second target
				// and no floating toolbar. The ring grows and names the action only
				// while the pointer is inside this span's body band.
				const hinted =
					idleBendHint?.wallId === curved.wallId &&
					idleBendHint.station >= from &&
					idleBendHint.station <= to;
				spanMarks.push({
					id: `layout-wall-span:${index - 1}`,
					kind: 'point',
					role: 'edit',
					anchor: [at[0], y, at[1]],
					draw: { pointRadius: hinted ? 6.4 : 4.4, hollow: true },
					label: 'Span midpoint',
					fact: 'bend',
					verb: 'Bend',
					planner: LAYOUT_WALL_BEND_KIND,
					value: hinted ? 'Bend · pull here' : 'Pull to bend',
					refusal: live?.refusal ?? null
				});
			}
			if (knot === undefined) return withSize([...ends, ...spanMarks]);
			const active = activeKnot?.knotId === knot.id && activeKnot.wallId === curved.wallId;
			return withSize([
				...ends,
				...spanMarks,
				{
					id: `layout-wall-knot:${knot.id}`,
					kind: 'point',
					role: 'edit',
					anchor: [knot.point[0], y, knot.point[1]],
					draw: active || live !== null ? { pointRadius: 6.8, bend: true } : { pointRadius: 5.2 },
					label: 'Active bend point',
					fact: 'bend',
					verb: 'Bend',
					planner: LAYOUT_WALL_BEND_KIND,
					value: `X ${knot.point[0].toFixed(2)} · Z ${knot.point[1].toFixed(2)} m`,
					refusal: live?.refusal ?? null
				}
			]);
		}
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
									baseline: gesture.frame,
									incidentWalls: gesture.incidentWalls
								}
							: { baseline: gesture.frame }
					);
				}
				return accepted;
			};
			const refusalFor = (markId: string): string | null =>
				gesture?.markId === markId ? refusal : null;
			const middle = framePoint(wall.frame, length / 2, y);
			const planReading = adapterContext.evaluation.settledReading === 'plan';
			const hinted = idleBendHint?.wallId === wall.wallId;
			// The one size disclosure owns the Wall's three dimensions. The
			// working thickness and height scalar handles are revealed by it.
			const descriptors: StageHandleDescriptor[] = [
				{
					// The Wall's one size disclosure: its measured handles live behind it.
					id: 'layout-wall-size-chip',
					kind: 'point',
					role: 'disclose',
					anchor: framePoint(wall.frame, length * 0.82, y),
					screen: { offset: [0, -22] },
					label: 'Size',
					reveals: [
						'layout-wall-length',
						'layout-wall-thickness',
						...(planReading ? [] : ['layout-wall-height'])
					]
				},
				{
					// The one span's plain shape point. The selected Wall's body remains
					// the rigid move surface; this ring is the Bend writer at mid-span.
					id: 'layout-wall-span:0',
					kind: 'point',
					role: 'edit',
					anchor: middle,
					draw: { pointRadius: hinted ? 6.4 : 4.4, hollow: true },
					label: 'Span midpoint',
					fact: 'bend',
					verb: 'Bend',
					planner: LAYOUT_WALL_BEND_KIND,
					value: hinted ? 'Bend · pull here' : 'Pull to bend',
					refusal: refusalFor('layout-wall-span:0')
				} satisfies StageHandleDescriptor,
				{
					id: 'layout-wall-start-mark',
					draw: { pointRadius: 4.6 },
					kind: 'point',
					role: 'edit',
					anchor: framePoint(wall.frame, 0, y),
					label: 'Wall start',
					fact: 'start',
					verb: 'Move point',
					planner: LAYOUT_JUNCTION_MOVE_KIND,
					value: valueFor(
						'layout-wall-start-mark',
						`X ${wall.frame.start[0].toFixed(2)} · Z ${wall.frame.start[1].toFixed(2)} m`
					),
					refusal: refusalFor('layout-wall-start-mark')
				},
				{
					id: 'layout-wall-end-mark',
					draw: { pointRadius: 4.6 },
					kind: 'point',
					role: 'edit',
					anchor: framePoint(wall.frame, length, y),
					label: 'Wall end',
					fact: 'end',
					verb: 'Move point',
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
					disclosedBy: 'layout-wall-size-chip',
					label: 'Wall length',
					fact: 'length',
					verb: 'Length',
					planner: LAYOUT_WALL_LENGTH_KIND,
					value: valueFor('layout-wall-length', `Length ${length.toFixed(3)} m`),
					refusal: refusalFor('layout-wall-length')
				},
				{
					// The rigid move has no visible glyph: a plain body press on the
					// selected Wall is the surface. This hidden record keeps the stable
					// numeric writer identity (`Distance`) and its tag while a body drag
					// or typed value is live; it is not drawn and cannot be hit.
					id: 'layout-wall-move-mark',
					draw: { hidden: true },
					kind: 'track',
					role: 'edit',
					anchor: middle,
					axis: [-direction[1], 0, direction[0]],
					extent: 0,
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
			// Each endpoint keeps its own anchor and the outward length ray keeps
			// the free end. Descriptor order is the domain's hit order. The rigid
			// move has no glyph: a plain body press on the selected Wall moves it,
			// and the retired mark id survives only as that press's stable writer
			// identity. Angle has no Stage grip: the owner's 2026-10-29 ruling keeps
			// it a Card field and removes the ring.
			const priority = [
				'layout-wall-size-chip',
				'layout-wall-start-mark',
				'layout-wall-span:0',
				'layout-wall-end-mark',
				'layout-wall-length'
			];
			return [...descriptors].sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));
		}
		const sourceOpening = document.openings.find((candidate) => candidate.id === opening!.openingId);
		if (sourceOpening === undefined) return [];
		const liveOpening =
			openingGesture?.openingId === opening!.openingId
				? (openingGesture.previewDocument?.openings.find(
						(candidate) => candidate.id === opening!.openingId
					) ?? sourceOpening)
				: sourceOpening;
		const direction = wallDirection(opening!.frame)!;
		const normal: readonly [number, number] = [-direction[1], direction[0]];
		const isPlan = adapterContext.evaluation.settledReading === 'plan';
		const hostThickness = document.walls.find((wall) => wall.id === opening!.wallId)?.thickness ?? 0;
		const viewSide = isPlan
			? 0
			: Math.sign(
					(adapterContext.evaluation.eye[0] - (opening!.frame.start[0] + opening!.frame.end[0]) / 2) *
						normal[0] +
						(adapterContext.evaluation.eye[2] - (opening!.frame.start[1] + opening!.frame.end[1]) / 2) *
							normal[1]
				) || 1;
		const faceOffset = (viewSide * hostThickness) / 2;
		const at = (distance: number, elevation: number, offset = faceOffset): [number, number, number] => {
			// A curved host reads the sampled station and its own tangent, so
			// the handle sits on the curve with the local face normal. The
			// straight path is kept verbatim to prove unchanged output.
			if (opening!.station.curved) {
				const local = opening!.station.pointAt(distance);
				if (local !== null) {
					const stationNormal: readonly [number, number] = [-local.tangent[1], local.tangent[0]];
					return [
						local.point[0] + stationNormal[0] * offset,
						elevation,
						local.point[1] + stationNormal[1] * offset
					];
				}
			}
			const point = framePoint(opening!.frame, distance, elevation);
			return [point[0] + normal[0] * offset, point[1], point[2] + normal[1] * offset];
		};
		const left = liveOpening.offset;
		const right = left + liveOpening.width;
		const bottom = y + liveOpening.sillHeight;
		const top = bottom + liveOpening.height;
		const numericValue = (markId: string): string | null => {
			if (openingGesture?.markId !== markId || openingGesture.numeric === null) return null;
			return `${openingGesture.numericField.label} ${openingGesture.numeric.text}`;
		};
		const edgeMark = (edge: OpeningResizeEdge): StageHandleDescriptor => {
			const horizontal = edge === 'left' || edge === 'right';
			const distance = edge === 'left' ? left : right;
			const atBottom = edge === 'bottom';
			const anchor = horizontal
				? at(distance, isPlan ? y : bottom + liveOpening.height / 2)
				: at((left + right) / 2, atBottom ? bottom : top);
			const hitSegment: [[number, number, number], [number, number, number]] = isPlan
				? [at(distance, y, -hostThickness / 2), at(distance, y, hostThickness / 2)]
				: horizontal
					? [at(distance, bottom), at(distance, top)]
					: [at(left, atBottom ? bottom : top), at(right, atBottom ? bottom : top)];
			const axis: [number, number, number] =
				edge === 'left'
					? [-direction[0], 0, -direction[1]]
					: edge === 'right'
						? [direction[0], 0, direction[1]]
						: edge === 'top'
							? [0, 1, 0]
							: [0, -1, 0];
			const id =
				edge === 'left'
					? 'layout-opening-width-start'
					: edge === 'right'
						? 'layout-opening-width-end'
						: edge === 'top'
							? 'layout-opening-height-top'
							: 'layout-opening-sill-bottom';
			return {
				id,
				kind: 'point',
				role: 'edit',
				anchor,
				axis,
				hitSegments: [hitSegment],
				hitRadiusCss: 22,
				hitGroup: 'opening-controls',
				draw: { hidden: true, resizeCursor: 'opening-edge' },
				label:
					edge === 'left' || edge === 'right'
						? 'Resize Opening width'
						: edge === 'top'
							? 'Resize Opening height'
							: 'Move Opening sill',
				fact: edge === 'left' || edge === 'right' ? 'width' : edge === 'top' ? 'height' : 'sillHeight',
				verb: edge === 'left' || edge === 'right' ? 'Width' : edge === 'top' ? 'Height' : 'Sill',
				planner: LAYOUT_OPENING_RESIZE_KIND,
				value:
					numericValue(id) ??
					(edge === 'left' || edge === 'right'
						? sizeDeltaLabel(liveOpening.width, sourceOpening.width)
						: edge === 'top'
							? sizeDeltaLabel(liveOpening.height, sourceOpening.height)
							: sizeDeltaLabel(liveOpening.sillHeight, sourceOpening.sillHeight)),
				refusal: openingGesture?.markId === id ? refusal : null
			};
		};
		const cornerMark = (corner: OpeningResizeCorner): StageHandleDescriptor => {
			const isLeft = corner.endsWith('left');
			const isBottom = corner.startsWith('bottom');
			const along = isLeft ? left : right;
			const elevation = isBottom ? bottom : top;
			const axis: [number, number, number] = [
				direction[0] * (isLeft ? -1 : 1),
				isBottom ? -1 : 1,
				direction[1] * (isLeft ? -1 : 1)
			];
			const id = `layout-opening-corner-${corner}`;
			return {
				id,
				kind: 'point',
				role: 'edit',
				anchor: at(along, elevation),
				axis,
				hitRadiusCss: 22,
				hitGroup: 'opening-controls',
				draw: { hidden: true, resizeCursor: 'opening-corner' },
				label: `Scale Opening from ${corner}`,
				fact: 'width',
				verb: 'Width and height',
				planner: LAYOUT_OPENING_RESIZE_KIND,
				value: sizeDeltaLabel(liveOpening.width, sourceOpening.width),
				refusal: openingGesture?.markId === id ? refusal : null
			};
		};
		const position: StageHandleDescriptor = {
			id: 'layout-opening-position',
			kind: 'point',
			role: 'edit',
			anchor: at((left + right) / 2, isPlan ? y : bottom + liveOpening.height / 2),
			axis: [direction[0], 0, direction[1]],
			draw: { cross: true, glyphScale: 0.62 },
			hitRadiusCss: 22,
			hitGroup: 'opening-controls',
			label: 'Opening position',
			fact: 'offset',
			verb: 'Offset',
			planner: LAYOUT_OPENING_MEASURE_KIND,
			value:
				numericValue('layout-opening-position') ??
				sizeDeltaLabel(liveOpening.offset, sourceOpening.offset),
			refusal: openingGesture?.markId === 'layout-opening-position' ? refusal : null
		};
		const descriptors: StageHandleDescriptor[] = [
			...(!isPlan
				? (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(cornerMark)
				: []),
			edgeMark('left'),
			edgeMark('right'),
			...(!isPlan ? [edgeMark('top'), edgeMark('bottom')] : []),
			position
		];
		return descriptors;
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
		const disclosed = preview.kind === 'planned'
			? (() => {
				const lineage = layoutSurfaceLineageConsequence({
					source: stageEnvelope(context.snapshot),
					beforeLayout: document,
					afterLayout: preview.document,
					lineage: preview.surfaceLineage
				});
				return lineage === 'No competing surface Finishes.'
					? preview
					: { ...preview, summary: `${preview.summary} ${lineage}` };
			})()
			: preview;
		if (deletionDisclosures.size >= 32) {
			const oldest = deletionDisclosures.keys().next().value;
			if (oldest !== undefined) deletionDisclosures.delete(oldest);
		}
		deletionDisclosures.set(key, disclosed);
		return disclosed;
	}
	function inkInstrument(
		contributed: { readonly label: string; readonly summary: string } | null,
		reading: string
	): NonNullable<ReturnType<NonNullable<StageAdapterBinding['instrument']>>> {
		return {
			presentation: 'palette',
			summary:
				contributed !== null
					? `Ink · ${contributed.label}`
					: reading === 'room'
						? 'Ink · Room'
						: reading === 'opening'
							? 'Ink · Opening'
							: 'Ink',
			facts:
				contributed !== null
					? [
							{ label: 'Reading', value: contributed.label },
							{ label: 'Meaning', value: contributed.summary }
						]
					: reading === 'room'
						? [{ label: 'Reading', value: 'Open Space from partial Walls' }]
						: reading === 'opening'
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

	function plinthInstrument() {
		return {
			summary: 'Place plinth',
			facts: [
				{ label: 'Floor datum', value: `${document.floor.elevation} m` },
				{ label: 'Creates', value: 'One ordinary Layout box' }
			],
			view: { component: LayoutPlacementInstrument, services }
		};
	}

	const contributions = {
		hostTools: ['erase', 'measure', 'paint'],
		/**
		 * Face Paint names the Wall-side identity from the exact 3D triangle or
		 * Layout's signed lateral reading of a Plan hit. Space membership is also
		 * Layout-owned; S5a expands it to Wall sides only (OD-J5 keeps floor/lid UI
		 * for S5b).
		 */
		paintAnswer(hit, reading): StagePaintAnswer {
			if (hit.sourceKind !== 'wall') {
				return { kind: 'refused', message: 'This part of a wall can’t be painted.' };
			}
			const componentId = hit.subRef?.kind === 'component' ? hit.subRef.componentId : null;
			const taggedSide = componentId?.match(/^side:(left|right)$/)?.[1];
			const side = taggedSide === 'left' || taggedSide === 'right'
				? taggedSide
				: reading === 'plan'
					? wallSideAt(context.snapshot.domain.geometry, hit.sourceId, [hit.worldPoint[0], hit.worldPoint[2]])
					: null;
			if (side === null) return { kind: 'refused', message: 'This part of a wall can’t be painted.' };
			const surface: LayoutSurfaceRef = { kind: 'wall-side', wallId: hit.sourceId, side };
			if (resolveLayoutSurface(document, surface) !== 'present') {
				return { kind: 'refused', message: 'That surface changed. Try again.' };
			}
			const membership = spaceOfSurface(document, surface);
			const space: StagePaintSpaceScope =
				membership.kind === 'unique'
					? {
							kind: 'unique', roomId: membership.roomId,
							surfaces: surfacesOfSpace(document, membership.roomId).surfaces
								.filter((candidate) => candidate.kind === 'wall-side')
						}
					: membership;
			return { kind: 'paintable-surface', surface, space };
		},
		guides,
		/**
		 * The Eraser reuses the Card's own delete for a Wall or an Opening — the
		 * same planner-derived disclosure and the same one F4 entry. Every other
		 * Layout subject was already refused, in Layout's words, by the pick.
		 */
		eraseAction(hit): ReturnType<NonNullable<StageAdapterBinding['eraseAction']>> {
			if (hit.sourceKind !== 'wall' && hit.sourceKind !== 'opening' && hit.sourceKind !== 'region') {
				return { kind: 'refused', message: 'That Layout subject cannot be erased.' };
			}
			const action = contributions
				.cardActions({ sourceId: hit.sourceId, sourceKind: hit.sourceKind, ref: null })
				.find((candidate) => candidate.destructive === true);
			if (action === undefined)
				return { kind: 'refused', message: 'That Layout subject cannot be erased.' };
			// A Wall that hosts Openings or changes Rooms has consequences beyond
			// itself; its existing disclosure is read before the second click runs it.
			const preview = hit.sourceKind === 'wall' ? deletionPreview(hit.sourceId) : null;
			// A floor region's derived resting-object count is disclosed before the
			// second click; it is a read, never a Scene write.
			const regionResting =
				hit.sourceKind === 'region'
					? restingObjectsOnFloorRegion(context.snapshot, hit.sourceId)
					: 0;
			const confirm =
				regionResting > 0 ||
				(preview?.kind === 'planned' &&
					(preview.hostedOpeningIds.length > 0 ||
						preview.retiredRoomIds.length > 0 ||
						preview.createdRoomIds.length > 0 ||
						preview.openedRoomIds.length > 0 ||
						preview.keptOpenRoomIds.length > 0));
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
			},
			// A4 — a procedure invoked by the Room Card, never a dock tool and
			// never an Index entry: no armable mode is added to the tool strip.
			{
				id: LAYOUT_ROOM_DUPLICATE_KIND,
				taskKind: LAYOUT_ROOM_DUPLICATE_KIND,
				label: 'Duplicate room',
				order: 20
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
			if (cardSubject.sourceKind === 'room' || cardSubject.sourceKind === 'room-floor') {
				return layoutRoomFacts(document, context.snapshot.domain.geometry, cardSubject.sourceId);
			}
			const subject = layoutSubjectOf({
				sourceKind: cardSubject.sourceKind,
				sourceId: cardSubject.sourceId
			});
			if (subject === null) return [];
			const facts = [...layoutFacts(document, subject)];
			const activeKnot = readActiveKnot();
			// The approved Card reads a curved Wall's arc length and bend-point
			// count, and names the active bend point when one is selected. Straight
			// Walls keep exactly their existing facts.
			const source =
				subject.kind === 'wall' ? document.walls.find((wall) => wall.id === subject.id) : undefined;
			if (source?.centerline.kind === 'cubic-chain' && !isClosedWall(source)) {
				const frame = curvedWallFrame(document, source.id);
				if (frame !== null) {
					facts.push({
						label: 'Length (arc)',
						value: `${frame.length.toFixed(3)} m`,
						fieldId: 'arcLength'
					});
				}
				facts.push({
					label: 'Bend points',
					value: String(source.centerline.knots.length),
					fieldId: 'bendPoints'
				});
				const activeIndex =
					activeKnot?.wallId === source.id
						? source.centerline.knots.findIndex((knot) => knot.id === activeKnot!.knotId)
						: -1;
				if (activeIndex >= 0) {
					facts.push({
						label: 'Active bend point',
						value: `${activeIndex + 1} of ${source.centerline.knots.length}`,
						fieldId: 'activeBendPoint'
					});
				}
			}
			return facts;
		},
		cardName(cardSubject: StageCardSubject) {
			if (cardSubject.sourceKind === 'room' || cardSubject.sourceKind === 'room-floor') {
				return layoutRoomNameTarget(services, cardSubject.sourceId);
			}
			if (cardSubject.sourceKind === 'region') {
				return layoutRegionNameTarget(services, cardSubject.sourceId);
			}
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
			if (cardSubject.sourceKind === 'region') {
				return {
					summary: 'Region fields',
					fieldIds: ['elevation', 'thickness', 'width', 'depth'],
					view: { component: LayoutRegionCard, services }
				};
			}
			const subject = layoutSubjectOf({
				sourceKind: cardSubject.sourceKind,
				sourceId: cardSubject.sourceId
			});
			if (subject === null) return null;
			// The writer edits every writable field except the name, which the Card
			// header's rename writer owns. Those fields are not repeated as facts.
			return {
				summary: subject.kind === 'wall' ? 'Wall fields' : 'Opening fields',
				fieldIds: layoutCardFieldIds(document, subject),
				view: { component: LayoutCardFields, services }
			};
		},
		/**
		 * Scoped deletes. The Wall action discloses hosted Openings and Room
		 * consequences; the Opening action removes exactly that Opening and
		 * returns the host Wall to the selection.
		 */
		cardActions(cardSubject: StageCardSubject): readonly StageCardAction[] {
			// A5 — Duplicate is the Room's one scoped action and it works for every
			// Room. The disclosure comes from the same copy-enclosure resolver the
			// acceptance re-proves: a shared boundary Wall copies privately, and
			// every Door relation that would leave the copy is named before the
			// click. Only a genuine refusal (an unknown Room, an unresolved
			// boundary or a read-only profile object) withholds the action.
			if (cardSubject.sourceKind === 'room' || cardSubject.sourceKind === 'room-floor') {
				const roomId = cardSubject.sourceId;
				const room = document.rooms.find((entry) => entry.id === roomId);
				if (room === undefined) {
					return [
						{
							id: 'layout-room-duplicate',
							label: 'Duplicate',
							group: 'secondary',
							detail: 'That Room is gone. Select the Room again.',
							run: async () => ({
								kind: 'refused',
								message: 'That Room is gone. Select the Room again.'
							})
						}
					];
				}
				const resolved = resolveRoomCopyEnclosure(document, roomId);
				let detail: string;
				if (resolved.kind === 'rejected') {
					detail = roomDuplicateRefusalWords(document, resolved.rejection);
				} else {
					const enclosure = resolved.enclosure;
					const objects = enclosure.associatedObjectIds.length;
					const dropped = droppedRoomRelationWords(document, roomId, enclosure.droppedRelations);
					detail = [
						`Copies ${room.name} as a free island with its ${roomDuplicateCount(enclosure.wallIds.length, 'Wall')}, ${roomDuplicateCount(enclosure.junctionIds.length, 'Junction')}, ${roomDuplicateCount(enclosure.openingIds.length, 'Opening')}${objects === 0 ? '' : ` and ${roomDuplicateCount(objects, 'object')}`}.`,
						...(dropped === null ? [] : [dropped]),
						'The copy starts clear of its source; move the pointer, then click to place it.'
					].join(' ');
				}
				const openSpace = room.virtualEdges.length > 0;
				const nextOverhead = room.overhead === 'open-to-sky' ? 'closed' : 'open-to-sky';
				return [
					roomLiftAction(services, roomId, room.name),
					{
						id: 'layout-room-duplicate',
						label: 'Duplicate',
						// Duplicate adds a copy and Undo removes it: it is scoped and
						// reversible, so it sits in the Card's More disclosure rather than
						// the destructive row.
						group: 'secondary',
						detail,
						run: async () => {
							if (resolved.kind === 'rejected') {
								return { kind: 'refused', message: detail };
							}
							return requestRoomDuplicate(roomId);
						}
					},
					{
						id: 'layout-room-overhead',
						label: nextOverhead === 'open-to-sky' ? 'Open to sky' : 'Close overhead',
						group: 'secondary',
						detail:
							nextOverhead === 'open-to-sky'
								? 'Removes the generated lid over this Space; its Walls, floor and area stay.'
								: 'Restores the generated lid over this Space; its Walls, floor and area stay.',
						run: async () => {
							const snapshot = services.stage.snapshot();
							const contentRevision = stageUnitRevision(snapshot, 'layout');
							const levelId = snapshot.domain.layoutLevelId;
							const outcome = await services.authoring.accept(
								buildLayoutIntent({
									kind: LAYOUT_ROOM_OVERHEAD_KIND,
									operationId: globalThis.crypto.randomUUID(),
									projectId: snapshot.acceptedRevision.projectId,
									revisionId: services.authoring.acceptedRevision().revisionId,
									contentRevision,
									levelId,
									targets: [
										layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId })
									],
									payload: { roomId, overhead: nextOverhead }
								})
							);
							if (outcome.kind === 'refused') {
								return { kind: 'refused', message: outcome.message };
							}
							services.stage.notifySurfaceChange();
							return outcome.kind === 'no-op'
								? { kind: 'no-op', message: 'The overhead already had that value.' }
								: { kind: 'accepted' };
						}
					},
					...(openSpace
						? [
								{
									id: 'layout-space-remove',
									label: 'Remove space',
									detail: `Removes ${room.name} and its open sides; its Walls stay. Objects keep their place and lose the association.`,
									destructive: true,
									run: async (): Promise<StageCardActionOutcome> => {
										const snapshot = services.stage.snapshot();
										const contentRevision = stageUnitRevision(snapshot, 'layout');
										const levelId = snapshot.domain.layoutLevelId;
										const outcome = await services.authoring.accept(
											buildLayoutIntent({
												kind: LAYOUT_SPACE_REMOVE_KIND,
												operationId: globalThis.crypto.randomUUID(),
												projectId: snapshot.acceptedRevision.projectId,
												revisionId: services.authoring.acceptedRevision().revisionId,
												contentRevision,
												levelId,
												targets: [
													layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId })
												],
												payload: { roomId }
											})
										);
										if (outcome.kind === 'refused') {
											return { kind: 'refused', message: outcome.message };
										}
										services.stage.notifySurfaceChange();
										return outcome.kind === 'no-op'
											? { kind: 'no-op', message: 'The Space was already gone.' }
											: { kind: 'accepted' };
									}
								}
							]
						: [])
				];
			}
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
			if (cardSubject.sourceKind === 'region') {
				const region = document.regions.find((entry) => entry.id === cardSubject.sourceId);
				if (region === undefined) return [];
				const resting = restingObjectsOnFloorRegion(context.snapshot, region.id);
				const kind = region.role === 'overhead' ? 'Flat Roof' : 'Terrace';
				const edge = regionEdgePick.read();
				const picked = edge !== null && edge.regionId === region.id ? edge.index : null;
				const addCorner: StageCardAction | null =
					picked === null || picked < 0 || picked >= region.footprint.points.length
						? null
						: {
								id: 'layout-region-add-corner',
								label: 'Add corner here',
								detail: `Adds a corner at the midpoint of edge ${picked + 1}. The Region, its elevation and its thickness stay.`,
								run: async (): Promise<StageCardActionOutcome> => {
									const points = region.footprint.points.map(([x, z]): LayoutVec2 => [x, z]);
									if (points.length >= 1024) {
										return {
											kind: 'refused',
											message: 'A region footprint can store at most 1024 corners.'
										};
									}
									const start = points[picked]!;
									const end = points[(picked + 1) % points.length]!;
									points.splice(picked + 1, 0, [
										(start[0] + end[0]) / 2,
										(start[1] + end[1]) / 2
									]);
									const snapshot = services.stage.snapshot();
									const outcome = await services.authoring.accept(
										regionEditIntent({
											kind: LAYOUT_REGION_FOOTPRINT_KIND,
											regionId: region.id,
											payload: { points },
											operationId: globalThis.crypto.randomUUID(),
											projectId: snapshot.acceptedRevision.projectId,
											revisionId: services.authoring.acceptedRevision().revisionId,
											contentRevision: stageUnitRevision(snapshot, 'layout'),
											levelId
										})
									);
									if (outcome.kind === 'refused') {
										return { kind: 'refused', message: outcome.message };
									}
									regionEdgePick.write(null);
									services.stage.notifySurfaceChange();
									return { kind: 'accepted' };
								}
							};
				return [
					...(addCorner === null ? [] : [addCorner]),
					{
						id: 'layout-region-delete',
						label: `Delete ${kind}`,
						destructive: true,
						detail: [
							region.role !== 'floor'
								? 'Removes this slab in one undo step; the Rooms and objects under it stay.'
								: resting === 1
									? '1 object rests on this platform and stays where it is when the platform is gone.'
									: `${resting} objects rest on this platform and stay where they are when the platform is gone.`,
							'Walls are unchanged.'
						].join(' '),
						run: async (): Promise<StageCardActionOutcome> => {
							const snapshot = services.stage.snapshot();
							const outcome = await services.authoring.accept(
								regionEditIntent({
									kind: LAYOUT_REGION_REMOVE_KIND,
									regionId: region.id,
									payload: { regionId: region.id },
									operationId: globalThis.crypto.randomUUID(),
									projectId: snapshot.acceptedRevision.projectId,
									revisionId: services.authoring.acceptedRevision().revisionId,
									contentRevision: stageUnitRevision(snapshot, 'layout'),
									levelId: snapshot.domain.layoutLevelId
								})
							);
							if (outcome.kind === 'refused') {
								return { kind: 'refused', message: outcome.message };
							}
							services.stage.notifySurfaceChange();
							return outcome.kind === 'no-op'
								? { kind: 'no-op', message: `The ${kind} was already gone.` }
								: { kind: 'accepted' };
						}
					}
				];
			}
			if (cardSubject.sourceKind !== 'wall') return [];
			const wallId = cardSubject.sourceId;
			// A6 — Face is one explicit Look action over the landed `face` intent.
			// Layout supplies the frame (bounds + look); the Camera derives the pose
			// and the route owns the clock, so nothing here writes a camera. Put back
			// restores the exact standpoint Face started from and is the action when
			// this Wall is the faced one.
			const facing = wallFace.isActive(wallId);
			const faceAction: StageCardAction = {
				id: 'layout-wall-face',
				label: facing ? 'Put back' : 'Face this wall',
				detail: facing
					? 'Returns the Camera to the view it had before Face.'
					: 'Squares the Camera to this Wall or its unrolled sheet. Put back returns to where you were looking.',
				run: async () => {
					if (wallFace.isActive(wallId)) {
						const outcome = wallFace.putBack(wallId);
						if (outcome.kind === 'refused') {
							return {
								kind: 'refused',
								message:
									outcome.reason === 'no-camera'
										? 'The Stage has no Camera to put back.'
										: 'The Camera could not return to where it was.'
							};
						}
						services.stage.notifySurfaceChange();
						return { kind: 'accepted' };
					}
					const wall = context.snapshot.domain.geometry.walls.find((candidate) => candidate.wallId === wallId);
					if (wall === undefined) {
						return { kind: 'refused', message: 'That Wall is no longer in the project.' };
					}
					const session = wallUnfold.state;
					const evaluation = services.stage.evaluation();
					if (evaluation === null) {
						return { kind: 'refused', message: 'The Stage is not ready to face a Wall.' };
					}
					const frame = session !== null && session.wallId === wallId
						? wallSheetFaceFrame({
								wall,
								state: session,
								sideAngle: wallUnfold.presentationAngle,
								floorY: context.snapshot.domain.datumMeters
							})
						: wallFaceFrame(wall, {
								pose: evaluation.pose,
								reading: evaluation.settledReading
							});
					if (frame === null) {
						return { kind: 'refused', message: 'That Wall has no face to square the view to.' };
					}
					const outcome = wallFace.face({ wallId, frame });
					if (outcome.kind === 'refused') {
						return {
							kind: 'refused',
							message:
								outcome.reason === 'no-camera'
									? 'The Stage has no Camera to face this Wall from.'
									: 'The Camera could not face this Wall.'
						};
					}
					services.stage.notifySurfaceChange();
					return { kind: 'accepted' };
				}
			};
			// One shared action channel for the active knot and the Wall's
			// shape. Each run previews the retained planner first and then accepts
			// one captured intent, so a refusal writes nothing and an acceptance is
			// one undo step. A straight Wall adds no action here.
			const wallSource = document.walls.find((candidate) => candidate.id === wallId);
			// One Split over the retained noder. The Card is the
			// midpoint path: a press elsewhere on the Wall never retargets it.
			// Pointer-specific placement belongs to the deferred Stage context
			// menu. Nothing here arms a tool or adds a mark.
			const splitLength = wallStationFrame(document, wallId)?.length;
			const splitAt = splitLength === undefined ? null : splitLength / 2;
			const splitOpening =
				splitAt === null
					? undefined
					: document.openings.find(
							(opening) =>
								opening.wallId === wallId &&
								splitAt > opening.offset &&
								splitAt < opening.offset + opening.width
						);
			const splitRefusal =
				wallSource === undefined
					? 'That Wall is no longer in the project.'
					: isClosedWall(wallSource)
						? wallSplitRefusalWords('closed_wall_isolated')
						: splitAt === null
							? 'This Wall has no resolvable length.'
							: splitOpening !== undefined
								? wallSplitRefusalWords('split_through_opening_interior')
								: null;
			const splitAction: StageCardAction = {
				id: 'layout-wall-split',
				label: 'Split wall here',
				detail:
					splitRefusal ??
					`Adds a joint at ${splitAt!.toFixed(2)} m. The start-side Wall keeps this Wall's identity; Openings keep their places and the Room is unchanged.`,
				run: async () => {
					if (splitRefusal !== null || splitAt === null) {
						return { kind: 'refused', message: splitRefusal ?? 'The Wall cannot be split there.' };
					}
					const capture = mintLayoutIdCapture();
					const snapshot = services.stage.snapshot();
					const outcome = await services.authoring.accept(
						wallSplitIntent({
							wallId,
							distance: splitAt,
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
					// The start-side fragment keeps the Wall id; keep the creator on it so
					// the Card describes the Wall they just divided.
					selectLayoutSubject('wall', wallId);
					services.stage.notifySurfaceChange();
					return outcome.kind === 'no-op'
						? { kind: 'no-op', message: 'The Wall was already split there.' }
						: { kind: 'accepted' };
				}
			};
			const curveActions: StageCardAction[] = [];
			if (wallSource?.centerline.kind === 'cubic-chain') {
				const knots = wallSource.centerline.knots;
				const activeKnot = readActiveKnot();
				const activeIndex =
					activeKnot?.wallId === wallId ? knots.findIndex((knot) => knot.id === activeKnot!.knotId) : -1;
				const runCurve = async (kind: 'delete' | 'straighten'): Promise<StageCardActionOutcome> => {
					// Centerline and knot shape edits are refused while unfolded,
					// explicitly and with the same words the Stage uses.
					if (wallUnfold.isActive(wallId)) {
						return { kind: 'refused', message: WALL_UNFOLD_SHAPE_REFUSAL };
					}
					// A Card record can outlive the session state it was rendered from. A
					// stale Remove must refuse, never fall through to the other shape action.
					if (kind === 'delete') return removeSelectedKnot(wallId);
					const preview = previewWallStraighten(document, wallId);
					if (preview.kind === 'refused') return { kind: 'refused', message: preview.message };
					const snapshot = services.stage.snapshot();
					const outcome = await services.authoring.accept(
						wallStraightenIntent({
							operationId: globalThis.crypto.randomUUID(),
							projectId: snapshot.acceptedRevision.projectId,
							revisionId: services.authoring.acceptedRevision().revisionId,
							contentRevision: stageUnitRevision(snapshot, 'layout'),
							levelId: snapshot.domain.layoutLevelId,
							wallId
						})
					);
					if (outcome.kind === 'refused') return { kind: 'refused', message: outcome.message };
					services.stage.notifySurfaceChange();
					return { kind: 'accepted' };
				};
				if (activeIndex >= 0) {
					curveActions.push({
						id: 'layout-wall-knot-remove',
						label: 'Remove bend point',
						detail: `Removes bend point ${activeIndex + 1} of ${knots.length}; its two spans merge in one undo step.`,
						run: () => runCurve('delete')
					});
				}
				curveActions.push({
					id: 'layout-wall-straighten',
					label: 'Straighten Wall',
					detail:
						'Returns this curved Wall to its straight chord in one undo step; hosted Openings keep their arc-length stations.',
					run: () => runCurve('straighten')
				});
			}
			// Unfold entry lives only in the Card foot; the Stage pill
			// owns Put back and the face switch. Shape rings are contextual on
			// the selected Wall; there is no hidden Bend-armed mode.
			const preview = deletionPreview(wallId);
			if (preview.kind === 'refused') {
				return [
					faceAction,
					splitAction,
					...curveActions,
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
				faceAction,
				splitAction,
				...curveActions,
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
		 * The Height Sheet's found surfaces this domain owns: the floor datum and
		 * the tops of solid Layout objects. Layout deliberately does not special-case
		 * a plinth preset id — a plinth is an ordinary box, and any box/cylinder
		 * top is a real surface a creator can snap to. Heights are datum-relative.
		 */
		heightTicks(): readonly StageHeightTick[] {
			const datum = context.snapshot.domain.datumMeters;
			const ticks: StageHeightTick[] = [{ kind: 'datum', heightMeters: 0, label: 'Floor' }];
			// Authored regions are drawn surfaces: a Terrace's top and a Flat Roof's
			// underside are real heights a later region or a Wall can snap to.
			for (const region of context.snapshot.domain.geometry.regions) {
				const authored = document.regions.find((candidate) => candidate.id === region.regionId);
				const heightMeters = (region.role === 'floor' ? region.topY : region.bottomY) - datum;
				if (!Number.isFinite(heightMeters) || heightMeters <= 0) continue;
				ticks.push({
					kind: 'found',
					heightMeters,
					label: `${region.role === 'floor' ? 'Terrace' : 'Flat Roof'} ${authored?.name ?? region.regionId}`
				});
			}
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
		}
	} satisfies Partial<StageAdapterBinding>;
	/**
	 * The selected Region's measured gaps.
	 *
	 * Relations are the derived authority and already carry the measure; this
	 * function only places the ink. A gap is a dimension between the footprint's
	 * nearest corner and the related Wall's nearest compiled sample, at the slab's
	 * own elevation (horizontal) or across the vertical clearance. An unselected
	 * Region draws no cue, which is why this reads the selection first.
	 */
	function regionGapPreviews(
		adapterContext: StageAdapterContext
	): readonly StageCandidatePreview[] | null {
		const selected = selectedRegion(document, adapterContext);
		if (selected === null) return null;
		const geometry = adapterContext.snapshot.domain.geometry;
		const relations = regionWallRelations(geometry, selected.region);
		if (relations.kind !== 'relations') return null;
		const gaps = relations.relations.filter(
			(relation) => relation.reading === 'gap' && relation.measureMeters !== null
		);
		if (gaps.length === 0) return null;
		const previews: StageCandidatePreview[] = [];
		for (const relation of gaps) {
			// The relation owns the pair its measure is read from: a corner-to-centerline
			// chord would be longer than the labelled Wall-body gap, and a vertical
			// segment from the slab top would be longer than the underside measure.
			const segment = relation.measureSegment;
			if (segment === null) continue;
			const text = `Gap ${relation.measureMeters!.toFixed(2)} m${relation.intended ? ' · intended' : ''}`;
			previews.push(
				candidatePreviewOf({
					id: `layout-region-gap:${relation.wallId}`,
					role: 'affected',
					geometry: {
					polygons: [],
					segments: [
						[
							[segment.from[0], segment.from[1], segment.from[2]],
							[segment.to[0], segment.to[1], segment.to[2]]
						]
					]
				},
					labels: [
						{
							world: [
								(segment.from[0] + segment.to[0]) / 2,
								(segment.from[1] + segment.to[1]) / 2,
								(segment.from[2] + segment.to[2]) / 2
							],
							text
						}
					]
				})
			);
		}
		return previews.length === 0 ? null : previews;
	}

	function settledPreviews(
		adapterContext: StageAdapterContext,
		y: number,
		settledRefusal: SettledLayoutRefusal | null
	): readonly StageCandidatePreview[] | null {
		const { world } = previewCoordinates(y);
		// The reason a refused release did not write outlives the gesture; the
		// tag stays until the next press, with no geometry and no history.
		if (
			settledRefusal !== null &&
			settledRefusal.contentRevision === adapterContext.snapshot.domain.unitRevisions.layout &&
			(settledRefusal.subject.kind === 'junction' ||
				(settledRefusal.subject.kind === 'wall'
					? selectedWall(adapterContext)?.frame.wallId === settledRefusal.subject.wallId
					: settledRefusal.subject.kind === 'room'
						? selectedRoomLabel(adapterContext)?.roomId === settledRefusal.subject.roomId
						: settledRefusal.subject.kind === 'region'
							? selectedRegion(document, adapterContext)?.region.id === settledRefusal.subject.regionId
							: selectedOpening(document, adapterContext)?.openingId === settledRefusal.subject.openingId))
		) {
			return [
				candidatePreviewOf({
					id: 'layout-candidate-refused-settled',
					role: 'refused',
					geometry: settledRefusal.geometry ?? { polygons: [], segments: [] },
					labels: [{ world: world(settledRefusal.point), text: settledRefusal.text }]
				})
			];
		}

		const gaps = regionGapPreviews(adapterContext);
		if (gaps !== null) return gaps;
		return null;
	}

	return { ...contributions, markDescriptors, inkInstrument, plinthInstrument, settledPreviews };
}
