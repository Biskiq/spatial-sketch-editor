/**
 * V1c — direct manipulation of one authored region.
 *
 * The selected region publishes its corner knobs, its body move, its turn mark
 * and its height ray, and this session turns each one into **one** retained
 * planner candidate on release. Pointer moves only re-evaluate proposal math:
 * no document is planned, no compile runs and no history entry exists until the
 * release accepts the captured candidate. Escape restores.
 *
 * Nothing here re-implements a gate. A footprint, a rotation, an elevation and a
 * move all go through the layout-core planners, so G1/G5 and every identity rule
 * answer exactly as they do from the Card.
 */
import {
	distanceToChord,
	type LayoutManipulationPorts,
	type SettledLayoutRefusal
} from './manipulation-support';
import { datumSnapDistance, isPointerDrag, previewCoordinates } from './manipulation-support';
import { resolvePlanarDragSnap, type LayoutSnapWinner } from './snap';
import { pointerWorkingPlanePoint, pointerViewportRay } from './stage-pointer';
import type { RegionEdgePick } from './session-ports';
import { candidatePreviewOf } from './candidate-preview';
import { selectedRegion } from './layout-subjects';
import {
	LAYOUT_REGION_ELEVATION_KIND,
	LAYOUT_REGION_FOOTPRINT_KIND,
	LAYOUT_REGION_MOVE_KIND,
	LAYOUT_REGION_ROTATE_KIND,
	regionEditIntent
} from './region-planners';

import {
	axisTravelFromRay,
	type StageAdapterContext,
	type StageCandidatePreview,
	type StageHandleDescriptor,
	type StageKeyboardIntent,
	type StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';
import { stageUnitRevision } from '$lib/authoring/stage/stage-adapter-host';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-adapter-host';
import type { LayoutVec2 } from '@portfolio/layout-core';

/** The bend-point removal zone, reused verbatim for a footprint corner. */
const REMOVE_ENTER_METERS = 0.12;
const REMOVE_LEAVE_METERS = 0.3;
/** A corner press that never travels this far is a click, not a drag. */
const CORNER_CLICK_METERS = 0.02;

const BODY_MARK = 'layout-region-move-mark';
const TURN_MARK = 'layout-region-turn-mark';
const HEIGHT_MARK = 'layout-region-height';
const CORNER_PREFIX = 'layout-region-corner:';
const EDGE_PREFIX = 'layout-region-edge:';
/** A hover within this many Stage pixels of an edge offers its picker. */
const EDGE_HOVER_CSS = 12;

type CornerGesture = {
	readonly mode: 'corner';
	readonly regionId: string;
	readonly index: number;
	readonly evaluationId: string;
	readonly revision: string;
	readonly pressCss: readonly [number, number];
	readonly pressPoint: LayoutVec2;
	readonly lease: Extract<GestureAcquisition, { kind: 'granted' }>;
	readonly baseline: readonly LayoutVec2[];
	points: LayoutVec2[];
	removal: boolean;
	leftRemovalZone: boolean;
	snap: LayoutSnapWinner | null;
	refusal: string | null;
};

type MoveGesture = {
	readonly mode: 'move';
	readonly regionId: string;
	readonly evaluationId: string;
	readonly revision: string;
	readonly pressCss: readonly [number, number];
	readonly pressPoint: LayoutVec2;
	/** The slab face the body is drawn on; the press and every sample aim here. */
	readonly elevation: number;
	readonly lease: Extract<GestureAcquisition, { kind: 'granted' }>;
	readonly baseline: readonly LayoutVec2[];
	delta: LayoutVec2;
	snap: LayoutSnapWinner | null;
	refusal: string | null;
};

type RotateGesture = {
	readonly mode: 'rotate';
	readonly regionId: string;
	readonly evaluationId: string;
	readonly revision: string;
	readonly pressCss: readonly [number, number];
	readonly lease: Extract<GestureAcquisition, { kind: 'granted' }>;
	readonly pivot: LayoutVec2;
	/** The slab face the turn mark is drawn on. */
	readonly elevation: number;
	readonly pressAngle: number;
	angle: number;
	refusal: string | null;
};

type HeightGesture = {
	readonly mode: 'height';
	readonly regionId: string;
	readonly evaluationId: string;
	readonly revision: string;
	readonly pressCss: readonly [number, number];
	readonly lease: Extract<GestureAcquisition, { kind: 'granted' }>;
	readonly anchor: LayoutVec2;
	readonly startElevation: number;
	readonly startTravel: number;
	elevation: number;
	refusal: string | null;
};

type RegionGesture = CornerGesture | MoveGesture | RotateGesture | HeightGesture;

function pointsOf(points: readonly LayoutVec2[]): LayoutVec2[] {
	return points.map(([x, z]): LayoutVec2 => [x, z]);
}

function translate(points: readonly LayoutVec2[], delta: LayoutVec2): LayoutVec2[] {
	return points.map(([x, z]): LayoutVec2 => [x + delta[0], z + delta[1]]);
}

/** Area centroid of a simple footprint; the same pivot the planner rotates about. */
function centroidOf(points: readonly LayoutVec2[]): LayoutVec2 | null {
	let twiceArea = 0;
	let x = 0;
	let z = 0;
	for (let index = 0; index < points.length; index++) {
		const [ax, az] = points[index]!;
		const [bx, bz] = points[(index + 1) % points.length]!;
		const cross = ax * bz - bx * az;
		twiceArea += cross;
		x += (ax + bx) * cross;
		z += (az + bz) * cross;
	}
	if (Math.abs(twiceArea) <= 1e-12) return null;
	return [x / (3 * twiceArea), z / (3 * twiceArea)];
}

function rotate(point: LayoutVec2, pivot: LayoutVec2, angle: number): LayoutVec2 {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const x = point[0] - pivot[0];
	const z = point[1] - pivot[1];
	return [pivot[0] + x * cos + z * sin, pivot[1] - x * sin + z * cos];
}

function normalizeAngle(angle: number): number {
	return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function edgeMidpoint(points: readonly LayoutVec2[], index: number): LayoutVec2 {
	const start = points[index]!;
	const end = points[(index + 1) % points.length]!;
	return [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
}

export function createRegionGestureSession(
	ports: LayoutManipulationPorts & { readonly edgePick: RegionEdgePick }
) {
	const { services, document, levelId, contentRevision, edgePick } = ports;
	let gesture: RegionGesture | null = null;
	let edgeHover: { readonly regionId: string; readonly index: number } | null = null;

	function endGesture(): void {
		const current = gesture;
		gesture = null;
		if (current !== null && current.lease.lease.active) current.lease.lease.release();
	}

	function leaseFor(
		owner: string,
		intent: StagePointerIntent
	): Extract<GestureAcquisition, { kind: 'granted' }> | null {
		const lease = services.stage.acquireGesture({
			owner,
			evaluationId: intent.evaluationId,
			policy: 'cancel-on-reading-change'
		});
		return lease.kind === 'granted' ? lease : null;
	}

	/** The region marks: corner knobs, edge adds, body move, turn and height. */
	function descriptors(ctx: StageAdapterContext): readonly StageHandleDescriptor[] {
		if (services.stage.session.task() !== null) return [];
		const selected = selectedRegion(document, ctx);
		if (selected === null) return [];
		const { region } = selected;
		const y = ctx.snapshot.domain.datumMeters;
		const live = gesture?.regionId === region.id ? gesture : null;
		const points =
			live?.mode === 'corner'
				? live.points
				: live?.mode === 'move'
					? translate(region.footprint.points, live.delta)
					: region.footprint.points;
		const elevation = live?.mode === 'height' ? live.elevation : region.elevation;
		const marked = region.intendedGaps;
		const marks: StageHandleDescriptor[] = [];
		points.forEach((point, index) => {
			const cornerActive = live?.mode === 'corner' && live.index === index;
			marks.push({
				id: `${CORNER_PREFIX}${index}`,
				kind: 'point',
				role: 'edit',
				anchor: [point[0], y + elevation, point[1]],
				axis: [1, 0, 0],
				draw: { pointRadius: cornerActive ? 6.8 : 4.6, ...(cornerActive ? { bend: true } : {}) },
				label: `Region corner ${index + 1}`,
				fact: 'corner',
				verb: 'Move corner',
				planner: LAYOUT_REGION_FOOTPRINT_KIND,
				value: cornerActive && live !== null
					? live.removal
						? 'Release to remove corner'
						: `X ${point[0].toFixed(2)} · Z ${point[1].toFixed(2)} m`
					: 'Drag onto the edge to remove',
				refusal: cornerActive ? live.refusal : null
			});
		});
		const centroid = centroidOf(points);
		if (centroid === null) return marks;
		// The body move has no glyph: a plain body press is the surface, and this
		// hidden record keeps the stable writer identity while a drag is live.
		marks.push({
			id: BODY_MARK,
			kind: 'track',
			role: 'edit',
			anchor: [centroid[0], y + elevation, centroid[1]],
			axis: [1, 0, 0],
			extent: 0,
			bothWays: true,
			draw: { hidden: true },
			label: 'Region position',
			fact: 'position',
			verb: 'Position',
			planner: LAYOUT_REGION_MOVE_KIND,
			value:
				live?.mode === 'move'
					? `Δx ${live.delta[0].toFixed(2)} · Δz ${live.delta[1].toFixed(2)} m`
					: `X ${centroid[0].toFixed(2)} · Z ${centroid[1].toFixed(2)} m`,
			refusal: live?.mode === 'move' ? live.refusal : null
		});
		const radius = Math.max(
			0.25,
			...points.map(([x, z]) => Math.hypot(x - centroid[0], z - centroid[1]))
		);
		marks.push({
			id: TURN_MARK,
			kind: 'point',
			role: 'edit',
			anchor: [centroid[0] + radius + 0.5, y + elevation, centroid[1]],
			axis: [1, 0, 0],
			draw: { cross: true },
			label: 'Region rotation',
			fact: 'rotation',
			verb: 'Turn',
			planner: LAYOUT_REGION_ROTATE_KIND,
			value:
				live?.mode === 'rotate'
					? `${((live.angle * 180) / Math.PI).toFixed(1)}°`
					: 'Turn',
			refusal: live?.mode === 'rotate' ? live.refusal : null
		});
		// The height ray is the elevation writer. A floor region may sit at the
		// datum; the grip keeps a visible length while its value stays the exact
		// authored elevation.
		marks.push({
			id: HEIGHT_MARK,
			kind: 'ray',
			role: 'edit',
			anchor: [centroid[0], y, centroid[1]],
			axis: [0, 1, 0],
			extent: Math.max(0.5, elevation),
			label: 'Region elevation',
			fact: 'elevation',
			verb: 'Elevation',
			planner: LAYOUT_REGION_ELEVATION_KIND,
			value:
				live?.mode === 'height'
					? `${live.elevation.toFixed(3)} m`
					: `${region.elevation.toFixed(3)} m`,
			refusal: live?.mode === 'height' ? live.refusal : null
		});
		return marks;
	}

	/** Press on a region mark, or on the selected region's own body. */
	function pointer(intent: StagePointerIntent, ctx: StageAdapterContext): boolean {
		if (intent.phase === 'down') {
			const selected = selectedRegion(document, ctx);
			if (selected === null) return false;
			const { region } = selected;
			if (intent.handleId?.startsWith(CORNER_PREFIX)) {
				const index = Number(intent.handleId.slice(CORNER_PREFIX.length));
				return beginCorner(intent, ctx, region.id, index);
			}
			if (intent.handleId?.startsWith(EDGE_PREFIX)) {
				const index = Number(intent.handleId.slice(EDGE_PREFIX.length));
				if (!Number.isInteger(index) || index < 0 || index >= region.footprint.points.length) {
					return false;
				}
				// Picking the edge is not an edit: the footprint changes only when the
				// Card's scoped Add corner here action runs.
				edgePick.write({ regionId: region.id, index });
				services.stage.notifySurfaceChange();
				return true;
			}
			if (intent.handleId === TURN_MARK) return beginRotate(intent, ctx, region.id);
			if (intent.handleId === HEIGHT_MARK) return beginHeight(intent, ctx, region.id);
			if (intent.handleId === BODY_MARK) return beginMove(intent, ctx, region.id);
			return false;
		}
		const current = gesture;
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
			if (current.mode === 'corner') moveCorner(current, ctx, intent);
			else if (current.mode === 'move') moveBody(current, ctx, intent);
			else if (current.mode === 'rotate') rotateBody(current, ctx, intent);
			else moveHeight(current, ctx, intent);
			services.stage.notifySurfaceChange();
			return true;
		}
		endGesture();
		if (intent.phase === 'up') void release(current, intent);
		services.stage.notifySurfaceChange();
		return true;
	}

	/** A body press on the selected region (the adapter's fallback path). */
	function beginBody(intent: StagePointerIntent, ctx: StageAdapterContext): boolean {
		const selected = selectedRegion(document, ctx);
		if (selected === null) return false;
		return beginMove(intent, ctx, selected.region.id);
	}

	function beginMove(
		intent: StagePointerIntent,
		ctx: StageAdapterContext,
		regionId: string
	): boolean {
		const selected = selectedRegion(document, ctx);
		if (selected === null || selected.region.id !== regionId) return false;
		// The body is drawn on the slab's face, not the floor datum: in perspective
		// a datum press grabs a point metres behind the Region and scales the drag.
		const elevation = ctx.snapshot.domain.datumMeters + selected.region.elevation;
		const point = pointerWorkingPlanePoint(ctx, intent.css, elevation);
		if (point === null) return false;
		const lease = leaseFor('layout-region-move', intent);
		if (lease === null) return false;
		ports.settleRefusal(null);
		gesture = {
			mode: 'move',
			regionId,
			evaluationId: intent.evaluationId,
			revision: services.authoring.acceptedRevision().revisionId,
			pressCss: intent.css,
			pressPoint: [point[0], point[1]],
			elevation,
			lease,
			baseline: pointsOf(selected.region.footprint.points),
			delta: [0, 0],
			snap: null,
			refusal: null
		};
		services.stage.notifySurfaceChange();
		return true;
	}

	function beginCorner(
		intent: StagePointerIntent,
		ctx: StageAdapterContext,
		regionId: string,
		index: number
	): boolean {
		const selected = selectedRegion(document, ctx);
		// A Region's corner is drawn at the Region's world elevation, not on the
		// floor datum; the press must name the same plane or a raised corner misses.
		const point =
			selected === null
				? null
				: pointerWorkingPlanePoint(
						ctx,
						intent.css,
						ctx.snapshot.domain.datumMeters + selected.region.elevation
					);
		if (
			selected === null ||
			selected.region.id !== regionId ||
			point === null ||
			!Number.isInteger(index) ||
			index < 0 ||
			index >= selected.region.footprint.points.length
		) {
			return false;
		}
		const lease = leaseFor('layout-region-corner', intent);
		if (lease === null) return false;
		ports.settleRefusal(null);
		gesture = {
			mode: 'corner',
			regionId,
			index,
			evaluationId: intent.evaluationId,
			revision: services.authoring.acceptedRevision().revisionId,
			pressCss: intent.css,
			pressPoint: pointsOf(selected.region.footprint.points)[index]!,
			lease,
			baseline: pointsOf(selected.region.footprint.points),
			points: pointsOf(selected.region.footprint.points),
			removal: false,
			leftRemovalZone: false,
			snap: null,
			refusal: null
		};
		services.stage.notifySurfaceChange();
		return true;
	}

	/** The selected Region's edge picker, shown only for the edge under the pointer. */
	function edgeHandles(ctx: StageAdapterContext): readonly StageHandleDescriptor[] {
		if (services.stage.session.task() !== null || edgeHover === null) return [];
		const selected = selectedRegion(document, ctx);
		if (selected === null || selected.region.id !== edgeHover.regionId) return [];
		const index = edgeHover.index;
		if (index < 0 || index >= selected.region.footprint.points.length) return [];
		const midpoint = edgeMidpoint(selected.region.footprint.points, index);
		return [
			{
				id: `${EDGE_PREFIX}${index}`,
				kind: 'point',
				role: 'edit',
				anchor: [
					midpoint[0],
					ctx.snapshot.domain.datumMeters + selected.region.elevation,
					midpoint[1]
				],
				axis: [1, 0, 0],
				draw: { pointRadius: 4.2, hollow: true },
				label: `Edge ${index + 1}`,
				fact: 'edge',
				verb: 'Pick edge',
				planner: LAYOUT_REGION_FOOTPRINT_KIND,
				value: 'Press to pick this edge'
			}
		];
	}

	/** Track the edge under the pointer; picking it is the Stage half of the action. */
	function updateEdgeHover(
		intent: StagePointerIntent,
		ctx: StageAdapterContext,
		blocked: boolean
	): boolean {
		if (blocked || intent.phase === 'cancel') {
			edgeHover = null;
			return false;
		}
		const selected = selectedRegion(document, ctx);
		if (selected === null) {
			edgeHover = null;
			return false;
		}
		const y = ctx.snapshot.domain.datumMeters + selected.region.elevation;
		const points = selected.region.footprint.points.map((point) => {
			const projected = ctx.project([point[0], y, point[1]]);
			return projected === null
				? null
				: [
						projected[0] - ctx.evaluation.rect.left,
						projected[1] - ctx.evaluation.rect.top
					] as const;
		});
		let best: { index: number; distance: number } | null = null;
		for (let index = 0; index < points.length; index++) {
			const start = points[index];
			const end = points[(index + 1) % points.length];
			if (start === null || end === null) continue;
			const distance = distanceToCssSegment(intent.css, start, end);
			if (best === null || distance < best.distance) best = { index, distance };
		}
		if (best !== null && best.distance <= EDGE_HOVER_CSS) {
			edgeHover = { regionId: selected.region.id, index: best.index };
			return true;
		}
		edgeHover = null;
		return false;
	}

	function distanceToCssSegment(
		point: readonly [number, number],
		start: readonly [number, number],
		end: readonly [number, number]
	): number {
		const dx = end[0] - start[0];
		const dy = end[1] - start[1];
		const squared = dx * dx + dy * dy;
		if (!(squared > 0)) return Math.hypot(point[0] - start[0], point[1] - start[1]);
		const t = Math.min(
			1,
			Math.max(0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / squared)
		);
		return Math.hypot(point[0] - (start[0] + dx * t), point[1] - (start[1] + dy * t));
	}

	function beginRotate(
		intent: StagePointerIntent,
		ctx: StageAdapterContext,
		regionId: string
	): boolean {
		const selected = selectedRegion(document, ctx);
		if (selected === null || selected.region.id !== regionId) return false;
		const elevation = ctx.snapshot.domain.datumMeters + selected.region.elevation;
		const point = pointerWorkingPlanePoint(ctx, intent.css, elevation);
		if (point === null) return false;
		const pivot = centroidOf(selected.region.footprint.points);
		if (pivot === null) return false;
		const lease = leaseFor('layout-region-rotate', intent);
		if (lease === null) return false;
		ports.settleRefusal(null);
		gesture = {
			mode: 'rotate',
			regionId,
			evaluationId: intent.evaluationId,
			revision: services.authoring.acceptedRevision().revisionId,
			pressCss: intent.css,
			lease,
			pivot,
			elevation,
			pressAngle: Math.atan2(point[1] - pivot[1], point[0] - pivot[0]),
			angle: 0,
			refusal: null
		};
		services.stage.notifySurfaceChange();
		return true;
	}

	function beginHeight(
		intent: StagePointerIntent,
		ctx: StageAdapterContext,
		regionId: string
	): boolean {
		const selected = selectedRegion(document, ctx);
		if (selected === null || selected.region.id !== regionId) return false;
		const centroid = centroidOf(selected.region.footprint.points);
		const ray = pointerViewportRay(ctx, intent.css);
		if (centroid === null || ray === null) return false;
		const travel = axisTravelFromRay({
			origin: [centroid[0], ctx.snapshot.domain.datumMeters, centroid[1]],
			direction: [0, 1, 0],
			rayOrigin: ray.origin,
			rayDirection: ray.direction
		});
		if (travel === null) return false;
		const lease = leaseFor('layout-region-height', intent);
		if (lease === null) return false;
		ports.settleRefusal(null);
		gesture = {
			mode: 'height',
			regionId,
			evaluationId: intent.evaluationId,
			revision: services.authoring.acceptedRevision().revisionId,
			pressCss: intent.css,
			lease,
			anchor: centroid,
			startElevation: selected.region.elevation,
			startTravel: travel,
			elevation: selected.region.elevation,
			refusal: null
		};
		services.stage.notifySurfaceChange();
		return true;
	}

	function moveBody(
		current: MoveGesture,
		ctx: StageAdapterContext,
		intent: StagePointerIntent
	): void {
		if (!isPointerDrag(current.pressCss, intent.css)) {
			current.delta = [0, 0];
			current.snap = null;
			return;
		}
		const point = pointerWorkingPlanePoint(ctx, intent.css, current.elevation);
		if (point === null) return;
		const snapped = resolvePlanarDragSnap(current.pressPoint, point, ctx.drafting(), (from, to) =>
			datumSnapDistance(ctx, from, to)
		);
		current.delta = [
			Number((snapped.point[0] - current.pressPoint[0]).toFixed(9)),
			Number((snapped.point[1] - current.pressPoint[1]).toFixed(9))
		];
		current.snap = snapped.winner;
	}

	function moveCorner(
		current: CornerGesture,
		ctx: StageAdapterContext,
		intent: StagePointerIntent
	): void {
		const region = document.regions.find((candidate) => candidate.id === current.regionId);
		if (region === undefined) return;
		const point = pointerWorkingPlanePoint(
			ctx,
			intent.css,
			ctx.snapshot.domain.datumMeters + region.elevation
		);
		if (point === null) return;
		const snapped = resolvePlanarDragSnap(current.pressPoint, point, ctx.drafting(), (from, to) =>
			datumSnapDistance(ctx, from, to)
		);
		current.snap = snapped.winner;
		const points = [...current.baseline];
		points[current.index] = [snapped.point[0], snapped.point[1]];
		current.points = points;
		// A corner dragged almost onto its neighbours' chord is removed, exactly as
		// a bend point is. The hysteresis keeps a jittering pointer from toggling it.
		const previous = current.baseline[
			(current.index - 1 + current.baseline.length) % current.baseline.length
		]!;
		const next = current.baseline[(current.index + 1) % current.baseline.length]!;
		// Removal reads the **pointer**, not the snapped corner: the bend rule does
		// the same, so a 0.5 m snap cannot hold the pointer outside the 0.12 m band
		// and make the gesture unreachable.
		const distance = distanceToChord(
			[point[0], point[1]],
			[previous[0], previous[1]],
			[next[0], next[1]]
		);
		if (distance > REMOVE_LEAVE_METERS) current.leftRemovalZone = true;
		current.removal =
			current.baseline.length > 3 && current.leftRemovalZone && distance <= REMOVE_ENTER_METERS;
	}

	function rotateBody(
		current: RotateGesture,
		ctx: StageAdapterContext,
		intent: StagePointerIntent
	): void {
		const point = pointerWorkingPlanePoint(ctx, intent.css, current.elevation);
		if (point === null) return;
		const angle = Math.atan2(point[1] - current.pivot[1], point[0] - current.pivot[0]);
		current.angle = Number(normalizeAngle(angle - current.pressAngle).toFixed(9));
	}

	function moveHeight(
		current: HeightGesture,
		ctx: StageAdapterContext,
		intent: StagePointerIntent
	): void {
		const ray = pointerViewportRay(ctx, intent.css);
		if (ray === null) return;
		const travel = axisTravelFromRay({
			origin: [current.anchor[0], ctx.snapshot.domain.datumMeters, current.anchor[1]],
			direction: [0, 1, 0],
			rayOrigin: ray.origin,
			rayDirection: ray.direction
		});
		if (travel === null) return;
		const elevation = Number((current.startElevation + travel - current.startTravel).toFixed(9));
		current.elevation = elevation;
	}

	async function release(current: RegionGesture, intent: StagePointerIntent): Promise<void> {
		if (stageUnitRevision(services.stage.snapshot(), 'layout') !== contentRevision) return;
		if (current.mode === 'move') {
			if (current.delta[0] === 0 && current.delta[1] === 0) return;
			if (!isPointerDrag(current.pressCss, intent.css)) return;
			await acceptEdit(LAYOUT_REGION_MOVE_KIND, current.regionId, {
				deltaX: current.delta[0],
				deltaZ: current.delta[1]
			}, current.revision);
			return;
		}
		if (current.mode === 'corner') {
			if (!isPointerDrag(current.pressCss, intent.css)) return;
			const points = current.removal
				? current.baseline.filter((_, index) => index !== current.index)
				: current.points;
			await acceptFootprint(current.regionId, points, current.revision);
			return;
		}
		if (current.mode === 'rotate') {
			if (!isPointerDrag(current.pressCss, intent.css) || current.angle === 0) return;
			await acceptEdit(LAYOUT_REGION_ROTATE_KIND, current.regionId, {
				angleRadians: current.angle
			}, current.revision);
			return;
		}
		if (presenceDrift(current)) {
			await acceptEdit(LAYOUT_REGION_ELEVATION_KIND, current.regionId, {
				elevation: current.elevation
			}, current.revision);
		}
	}

	/** A height press that never moved is not an edit; a zero delta is a no-op. */
	function presenceDrift(current: HeightGesture): boolean {
		return Math.abs(current.elevation - current.startElevation) > 1e-9;
	}

	async function acceptFootprint(
		regionId: string,
		points: readonly LayoutVec2[],
		revision = services.authoring.acceptedRevision().revisionId
	): Promise<void> {
		await acceptEdit(LAYOUT_REGION_FOOTPRINT_KIND, regionId, {
			points: points.map(([x, z]) => [x, z])
		}, revision);
	}

	async function acceptEdit(
		kind: string,
		regionId: string,
		payload: ReturnType<typeof regionEditIntent>['payload'],
		revision: string
	): Promise<void> {
		const snapshot = services.stage.snapshot();
		if (stageUnitRevision(snapshot, 'layout') !== contentRevision) return;
		const outcome = await services.authoring.accept(
			regionEditIntent({
				kind,
				regionId,
				payload,
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: revision,
				contentRevision,
				levelId
			})
		);
		if (outcome.kind === 'refused') {
			ports.publishRefusal(outcome.message);
			if (stageUnitRevision(services.stage.snapshot(), 'layout') === contentRevision) {
				settleRefusal(regionId, outcome.message);
			}
		}
		services.stage.notifySurfaceChange();
	}

	function settleRefusal(regionId: string, text: string): void {
		const region = document.regions.find((candidate) => candidate.id === regionId);
		if (region === undefined) return;
		const centroid = centroidOf(region.footprint.points);
		if (centroid === null) return;
		const refusal: SettledLayoutRefusal = {
			subject: { kind: 'region', regionId },
			contentRevision,
			point: centroid,
			text
		};
		ports.settleRefusal(refusal);
	}

	function key(intent: StageKeyboardIntent): boolean {
		if (gesture === null || intent.kind !== 'cancel') return false;
		endGesture();
		services.stage.notifySurfaceChange();
		return true;
	}

	/** The live proposal: the candidate footprint, with its adopted snap named. */
	function previews(ctx: StageAdapterContext, y: number): readonly StageCandidatePreview[] | null {
		const current = gesture;
		// Null, not empty: an idle region gesture must fall through to Ink's own
		// candidate instead of suppressing every other preview source.
		if (current === null) return null;
		const selected = document.regions.find((region) => region.id === current.regionId);
		if (selected === undefined) return null;
		const { world } = previewCoordinates(y);
		const elevation = y + (current.mode === 'height' ? current.elevation : selected.elevation);
		let points: readonly LayoutVec2[] = selected.footprint.points;
		let label = '';
		let snap: LayoutSnapWinner | null = null;
		if (current.mode === 'move') {
			if (current.delta[0] === 0 && current.delta[1] === 0) return [];
			points = translate(selected.footprint.points, current.delta);
			label = `Δx ${current.delta[0].toFixed(2)} · Δz ${current.delta[1].toFixed(2)} m`;
			snap = current.snap;
		} else if (current.mode === 'corner') {
			points = current.removal
				? current.baseline.filter((_, index) => index !== current.index)
				: current.points;
			label = current.removal ? 'Remove corner' : 'Move corner';
			snap = current.snap;
		} else if (current.mode === 'rotate') {
			points = selected.footprint.points.map((point) =>
				rotate(point, current.pivot, current.angle)
			);
			label = `${((current.angle * 180) / Math.PI).toFixed(1)}°`;
		} else {
			label = `Elevation ${current.elevation.toFixed(3)} m`;
		}
		const centroid = centroidOf(points);
		if (centroid === null) return [];
		return [
			candidatePreviewOf({
				id: 'layout-region-candidate',
				role: 'subject',
				geometry: {
					polygons: [points.map((point) => world(point, elevation))],
					segments: []
				},
				labels: [{ world: [centroid[0], elevation, centroid[1]], text: label }],
				...(snap === null ? {} : { snap: { world: world(snap.point), name: snap.name } })
			})
		];
	}

		return {
		descriptors,
		edgeHandles,
		updateEdgeHover,
		pointer,
		beginBody, key, previews, endGesture };
}

export type RegionGestureSession = ReturnType<typeof createRegionGestureSession>;
