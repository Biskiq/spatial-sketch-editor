/**
 * The Stage marks a selected Layout subject publishes.
 *
 * Every descriptor names a real fact and the exact planner the Card field
 * submits; values are the live candidate while a gesture is held, otherwise the
 * accepted value. Shape grips are contextual on the selected subject, never a
 * permanent handle constellation.
 */
import type { FixedWallEndpoint, LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
import type { StageAdapterContext, StageAdapterServices, StageHandleDescriptor } from '$lib/authoring/stage/stage-adapter-host';
import { sizeDeltaLabel } from '$lib/authoring/stage/stage-adapter-host';
import { planNumericEntryField, type PlanNumericEntryState, type PlanNumericField } from '$lib/authoring/layout/plan-numeric-entry';
import { LAYOUT_OPENING_RESIZE_KIND, type OpeningResizeCorner, type OpeningResizeEdge } from './opening-planners';
import { LAYOUT_CIRCLE_RADIUS_KIND } from './drawing-planners';
import { LAYOUT_OPENING_MEASURE_KIND, LAYOUT_JUNCTION_MOVE_KIND, LAYOUT_WALL_LENGTH_KIND, LAYOUT_WALL_MOVE_KIND, LAYOUT_WALL_BEND_KIND } from './precision';
import { wallRequestLabel } from './wall-gesture';
import { selectedWall, selectedClosedWall, selectedCurvedWall, selectedOpening, wallLength, wallDirection, framePoint } from './layout-subjects';
import { curvedWallPointAt, wallStationAtPoint, type WallFrame, type WallManipulationRequest } from './precision-frames';

export type ActiveKnot = { readonly wallId: string; readonly knotId: string };
export type LayoutMarkState = {
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

export function layoutMarkDescriptors(input: {
		readonly services: StageAdapterServices;
		readonly document: LayoutDocumentWallFirst;
		readonly adapterContext: StageAdapterContext;
		readonly state: LayoutMarkState;
		readonly taskOpen: boolean;
	}): readonly StageHandleDescriptor[] {
	const { services, document, adapterContext, state, taskOpen } = input;
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

