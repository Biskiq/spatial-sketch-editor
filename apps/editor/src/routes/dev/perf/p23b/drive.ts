/**
 * P23B.0 method-v5 scripted capture driver (DEV only).
 *
 * The interaction baseline is only comparable across fixtures if every fixture
 * is measured in the same viewport, with the same targets and the same action
 * counts, and if every action is verified to be the interaction it is meant to
 * be. This module is that protocol as code: it hosts each fixture, puts the Plan
 * viewport onto one shared px/m ladder, performs the fixed actions, and reads
 * the capture ledger back to confirm each action's own path and outcome. An
 * action that does not reach its intended path is repeated — the repeat is the
 * retry the ledger records, so nothing is silently averaged in.
 *
 * It drives the SHIPPED handlers with synthetic input events; it never calls an
 * editing function directly and never rewrites an action's result. The one
 * browser-API concession is that pointer capture is a no-op: a synthetic pointer
 * is never captured by the browser, so `setPointerCapture` would throw.
 *
 * Every action that mutates the document is put back with the editor's own undo
 * before the next action, and the restore is recorded as a fixture reset, so all
 * actions of a path are performed on the ratified document instead of on a
 * document that slowly drifts away from the fixed target.
 *
 * Shared viewport ladder: zoom out past the viewport's own `[2, 2000]` px/m
 * clamp (so the floor is exactly 2 for every fixture), then climb an identical
 * number of fixed 1.12 steps. Every fixture therefore lands on the same px/m
 * value by construction rather than by coincidentally equal framing, and the pan
 * that follows is the only fixture-specific view adjustment.
 */

import type {
	BenchInteractionPath,
	P23BActionLedger,
	P23BCaptureLedger
} from '$lib/bench/bench-types';
import {
	createP23BGestureFrameSampler,
	createP23BLongFrameObserver,
	p23bM1RecordGestureFrames,
	p23bM1RecordLongFrames,
	p23bM1ResetFrameTiming
} from '$lib/bench/p23b-m1-frame-timing';
import {
	P23B_M1_ROOM_DRAG_ARMS,
	p23bM1RecordActionArm,
	p23bM1ResetActionArms,
	setP23bM1RoomDragArm,
	type P23BM1RoomDragArm
} from '$lib/editor/layout/p23b-m1-room-drag-arm';
import {
	P23B_M1_ROOM_LABEL_ARMS,
	p23bM1RecordActionLabelArm,
	p23bM1ResetActionLabelArms,
	setP23bM1RoomLabelArm,
	type P23BM1RoomLabelArm
} from '$lib/editor/layout/p23b-m1-room-label-arm';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';

export type P23BDriveTargets = {
	selectionWallId: string;
	dragWallId: string;
	dragGrabFraction: number;
	bendWallId: string;
	bendKnotId: string;
	authoringFrom: [number, number];
	authoringTo: [number, number];
};

export type P23BDriveFixture = {
	id: string;
	label: string;
	document: LayoutDocumentWallFirst;
	targets: P23BDriveTargets;
	notApplicable: Partial<Record<BenchInteractionPath, string>>;
};

export type P23BDrivePathProgress = { attempted: number; accepted: number };

export type P23BDriveProgress = {
	running: boolean;
	fixtureId: string | null;
	step: string;
	paths: Partial<Record<BenchInteractionPath, P23BDrivePathProgress>>;
};

export type P23BDriveHooks = {
	fixtures(): readonly P23BDriveFixture[];
	/** Host one fixture; the editor remounts with the ratified document. */
	host(fixtureId: string): void;
	startCapture(actionClass?: string): string;
	stopCapture(): Promise<void>;
	ledger(sessionId: string): P23BCaptureLedger | null;
	captureCount(): number;
	/** Declare that the action just performed was put back to the ratified document. */
	recordFixtureReset(): void;
	log(line: string): void;
	progress(progress: P23BDriveProgress): void;
};

/** Accepted actions per path; the ledger excludes the leading five as warm-up. */
export const DRIVE_ACTIONS_PER_PATH = 25;
/**
 * P23B.11 S1/S7 fixture order: the three committed fixtures P23B.6 measured,
 * plus the generated connected case last (advisory evidence; never recorded).
 */
export const P23B11_S1_FIXTURE_ORDER = [
	'p23b-40-wall-straight-v1',
	'p23b-40-wall-all-curved-v1',
	'owner-40-curved-v1',
	'connected-curved-grid-v1'
] as const;
/**
 * Pre-P23B.8 follow-up, M1 §3.2: the same three committed fixtures in harness
 * order, then the generated connected case LAST as advisory evidence that is
 * never recorded. Named separately from the P23B.11 order because the two are
 * allowed to diverge deliberately; today they are the same list.
 */
export const P23B_M1_FIXTURE_ORDER = P23B11_S1_FIXTURE_ORDER;
/**
 * M1's classes and the path each one is measured as (§3.3). The first three are
 * REAL DRAG workloads (down · moves · up) and carry the gesture-frame series;
 * the authoring pair keeps the S1 sequences unchanged for the D1 comparison.
 * The order matches the S1 run so a fixture's classes are captured in one known
 * sequence on both runtimes.
 */
export const P23B_M1_ACTION_CLASSES = [
	{ actionClass: 'rigid-wall-drag', path: 'plan-drag-edit', drag: true },
	{ actionClass: 'bend', path: 'bend-knot-edit', drag: true },
	{ actionClass: 'whole-room-move-bridge', path: 'plan-drag-edit', drag: true },
	{ actionClass: 'wall-authoring', path: 'wall-authoring', drag: false },
	{ actionClass: 'room-creation-commit', path: 'wall-authoring', drag: false }
] as const satisfies readonly { actionClass: string; path: BenchInteractionPath; drag: boolean }[];
/** The M1 action-class session prefix, so no M1 class can be mistaken for another slice's. */
export const P23B_M1_PREFIX = 'p23b-m1:';

/**
 * THE NAME AN M1 CLASS IS MEASURED UNDER, and therefore the key its gesture-frame
 * series and its long-frame window are stored under.
 *
 * One string names a class end to end: the session it opens is
 * `${P23B_M1_PREFIX}${actionClass}`, the record reports it as
 * `p23b-m1:…`, and both M1 registries are read back by that same recorded name.
 * A class measured under its bare name (`rigid-wall-drag`) therefore stores a
 * row nobody can read: the record finds no window and no series and reports both
 * as not measured, WITHOUT failing — the capture still looks complete. That is why
 * the key is built here rather than written out twice.
 */
export function p23bM1MeasuredClass(actionClass: string): string {
	return `${P23B_M1_PREFIX}${actionClass}`;
}
/**
 * Pre-P23B.8 follow-up M1 §16 — the COLD protocol's session prefix.
 *
 * The cold pass runs the SAME five classes, the same gestures and the same window
 * definitions as the repeat pass, and changes exactly one thing: the camera moves
 * between attempts, so no render repeats a projection the session has already drawn.
 * It is the same protocol read at the other end of the bracket — the repeat pass is
 * the session shape that gives a persistent cache the MOST (the undo between attempts
 * returns the geometry to a state the previous attempt already drew), the cold pass
 * the shape that gives it the LEAST. A separate prefix keeps the two populations
 * apart: their recorded class names are `p23b-m1-cold:…` and `p23b-m1:…`, so no row
 * can be read as the other workload's.
 */
export const P23B_M1_COLD_PREFIX = 'p23b-m1-cold:';

/** The cold prefix's measured-class name, the twin of `p23bM1MeasuredClass`. */
export function p23bM1ColdMeasuredClass(actionClass: string): string {
	return `${P23B_M1_COLD_PREFIX}${actionClass}`;
}

/**
 * THE COLD WORKLOAD'S CAMERA STEP, in screen pixels: a fixed-length pan whose
 * direction advances by the golden angle every attempt.
 *
 * TWO PROPERTIES ARE LOAD-BEARING, and both are the reason this is a controlled read
 * of the reuse rather than a second workload. It is a PAN and not a zoom, so the
 * projected polygon is TRANSLATED and nothing else: the cell budget comes from the
 * polygon's own screen bounding box and the mask shifts with it, so the placer does
 * exactly the same work per action and only the cache KEY moves. And the direction
 * advances by the golden angle, which never revisits an earlier direction modulo the
 * circle, so the walk does not return to a projection an earlier attempt drew — which
 * is the whole point, and is checked by reading the cold capture's own cross-action
 * repeat share rather than by assuming it.
 *
 * The step is small (8 px is ≈0.4 m at the shared ladder) so the walk stays near the
 * fixture and every target stays in the neighbourhood it was measured in.
 */
const COLD_CAMERA_STEP_PX = 8;
const COLD_CAMERA_GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5));
/** Wheel steps climbed after the zoom floor: 2 * 1.12^20 ≈ 19.29 px/m. */
const ZOOM_STEPS_IN = 20;
const ZOOM_OUT_STEPS = 40;
const WHEEL_DELTA = 120;
/** Kept in step with the shipped Plan snap; the protocol states "Snap 0.25 m on". */
const GRID_STEP_M = 0.25;
/** The driver's own action guard; recorded as provenance so a bounded coverage is visible. */
export const DRIVE_ACTION_TIMEOUT_MS = 6000;
const ACTION_TIMEOUT_MS = DRIVE_ACTION_TIMEOUT_MS;
const ATTEMPT_LIMIT = 5;
const VIEW_MARGIN_PX = 28;
const VIEW_EPSILON_PX_PER_M = 1e-6;
const PAN_STEP_PX = 14;
const PAN_ROUND_TRIPS = 12;
const WHEEL_PAIRS = 8;

type Point = [number, number];
type PlanView = { pixelsPerMeter: number; center: Point; width: number; height: number };
type DriverTargets = {
	selection: Point;
	bend: Point | null;
	dragFrom: Point;
	dragTo: Point;
	authoringFrom: Point;
	authoringTo: Point;
	roomCenter: Point;
	roomCreationFrom: Point;
	roomCreationTo: Point;
};

type P23BDriveGlobals = typeof globalThis & { __P23B_PLAN_VIEW__?: PlanView };

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextFrame(): Promise<void> {
	return new Promise((resolve) => {
		if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
		else setTimeout(resolve, 0);
	});
}

async function settleFrames(count = 2): Promise<void> {
	for (let index = 0; index < count; index += 1) await nextFrame();
}

/** A synthetic pointer is never captured by the browser, so capture is a no-op. */
function installPointerCaptureNoop(): void {
	const marker = globalThis as typeof globalThis & { __P23B_DRIVE_CAPTURE_PATCHED__?: boolean };
	if (marker.__P23B_DRIVE_CAPTURE_PATCHED__) return;
	marker.__P23B_DRIVE_CAPTURE_PATCHED__ = true;
	Element.prototype.setPointerCapture = function setPointerCapture(): void {};
	Element.prototype.releasePointerCapture = function releasePointerCapture(): void {};
	Element.prototype.hasPointerCapture = function hasPointerCapture(): boolean {
		return false;
	};
}

function planCanvas(): SVGSVGElement | null {
	return document.querySelector<SVGSVGElement>('svg.plan-canvas');
}

function publishedPlanView(): PlanView | null {
	return (globalThis as P23BDriveGlobals).__P23B_PLAN_VIEW__ ?? null;
}

function toolbarButton(groupLabel: string, label: string): HTMLButtonElement | null {
	for (const button of document.querySelectorAll<HTMLButtonElement>(`.tool-group[aria-label="${groupLabel}"] button`)) {
		if ((button.textContent ?? '').trim().includes(label)) return button;
	}
	return null;
}

function lerp(a: Point, b: Point, fraction: number): Point {
	return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
}

function snapToGrid(point: Point): Point {
	return [
		Math.round(point[0] / GRID_STEP_M) * GRID_STEP_M,
		Math.round(point[1] / GRID_STEP_M) * GRID_STEP_M
	];
}

/** One grid increment along the chord's normal, along its dominant axis. */
function oneGridStepAlong(origin: Point, normal: Point): Point {
	return Math.abs(normal[0]) >= Math.abs(normal[1])
		? [origin[0] + Math.sign(normal[0] || 1) * GRID_STEP_M, origin[1]]
		: [origin[0], origin[1] + Math.sign(normal[1] || 1) * GRID_STEP_M];
}

/**
 * The bend gesture's release point: one grid increment along +Z, measured from
 * the PRESS point rather than from the snapped knot.
 *
 * A knot move commits the SNAPPED release point, so one grid step past any
 * point snaps to one grid step past that point's snapped position: the committed
 * bend is identical whichever end the step is measured from. The POINTER travel
 * is not. Measuring from the snapped knot shortens the gesture by exactly the
 * knot's own off-grid deviation, and a fixture whose knot is off-grid on both
 * axes (the generated connected case) loses the gesture entirely: 3.5 px of
 * travel is under `EDITOR_DRAG_THRESHOLD_PX`, so the release is committed as the
 * click it also is — no bend action, no accepted action, and the class retries
 * forever. Measuring from the press keeps every fixture's drag at exactly one
 * grid increment (0.25 m, ≈4.8 px on the shared px/m ladder) and leaves the
 * committed geometry unchanged.
 *
 * Exported because it IS the gesture: the M1 target test asserts that the
 * gesture this rule produces crosses the app's own drag threshold on every
 * protocol fixture, which is the property the sub-threshold case violated.
 */
export function p23bBendReleasePoint(press: Point): Point {
	return [press[0], press[1] + GRID_STEP_M];
}

/**
 * The whole-Room move gesture's release point: one grid increment along +X from
 * the SNAPPED Room-interior grab, so the committed move is one grid increment
 * whatever the grab point's own off-grid offset is. Exported for the same reason
 * as `p23bBendReleasePoint`: the gesture's own travel is asserted, not assumed.
 */
export function p23bRoomMoveReleasePoint(center: Point): Point {
	return oneGridStepAlong(snapToGrid(center), [1, 0]);
}

function chordNormal(a: Point, b: Point): Point {
	const dx = b[0] - a[0];
	const dz = b[1] - a[1];
	const length = Math.hypot(dx, dz) || 1;
	return [-dz / length, dx / length];
}

export function createP23BCaptureDriver(hooks: P23BDriveHooks) {
	let progress: P23BDriveProgress = { running: false, fixtureId: null, step: '', paths: {} };
	let pointerId = 1;

	function report(step: string): void {
		progress = { ...progress, step };
		hooks.progress({ ...progress });
		(globalThis as typeof globalThis & { __P23B_DRIVE__?: unknown }).__P23B_DRIVE__ = {
			...progress,
			paths: { ...progress.paths }
		};
	}

	function note(line: string): void {
		hooks.log(line);
	}

	/**
	 * The progress line for ONE class, naming the workload it belongs to when it is the
	 * cold one (§16). The two workloads run the same five classes, so without this the
	 * status of a run says `rigid-wall-drag` for six of the ten classes it drives and a
	 * reader watching a leg cannot tell which pass it is in — which is exactly the
	 * ambiguity that makes a failed cold leg unattributable.
	 */
	function reportClass(fixtureId: string, actionClass: string, cold: boolean): void {
		report(`${fixtureId}: ${cold ? 'cold ' : ''}${actionClass}`);
	}

	/**
	 * EVERY class that drags the EXISTING document declares the Select tool, and it
	 * declares it itself rather than relying on whoever ran before.
	 *
	 * The tool is PAGE state that outlives a class. The Wall-authoring class leaves
	 * `Wall` on and the Rect Room class leaves `Rect Room` on — both deliberately, both
	 * reset by their caller — so a class that needs `Select` and does not ask for it
	 * draws its gesture with someone else's tool: the drag resolves to `wall-authoring`
	 * and is REJECTED, every attempt, until `repeatPath` gives up. That is exactly how
	 * §16's cold pass failed its first class the first six times it was run, silently
	 * reading as a repeat-pass failure. A protocol that runs the same classes twice
	 * cannot depend on the order a tool happens to be left in.
	 */
	function ensureSelectTool(): void {
		ensureTool('Select');
	}

	function requireCanvas(): SVGSVGElement {
		const canvas = planCanvas();
		if (!canvas) throw new Error('The Plan canvas is not mounted');
		return canvas;
	}

	function requireView(): PlanView {
		const view = publishedPlanView();
		if (!view) throw new Error('The Plan viewport has not published its view');
		return view;
	}

	function canvasCenter(): Point {
		const rect = requireCanvas().getBoundingClientRect();
		return [rect.left + rect.width / 2, rect.top + rect.height / 2];
	}

	function clientPoint(world: Point): Point {
		const view = requireView();
		const rect = requireCanvas().getBoundingClientRect();
		const scaleX = rect.width / view.width;
		const scaleY = rect.height / view.height;
		return [
			rect.left + (view.width / 2 + (world[0] - view.center[0]) * view.pixelsPerMeter) * scaleX,
			rect.top + (view.height / 2 + (world[1] - view.center[1]) * view.pixelsPerMeter) * scaleY
		];
	}

	function dispatchPointer(
		type: 'pointerdown' | 'pointermove' | 'pointerup',
		point: Point,
		options: { button?: number; id: number }
	): void {
		const button = options.button ?? 0;
		requireCanvas().dispatchEvent(
			new PointerEvent(type, {
				bubbles: true,
				cancelable: true,
				composed: true,
				pointerId: options.id,
				pointerType: 'mouse',
				isPrimary: true,
				button,
				buttons: type === 'pointerup' ? 0 : button === 1 ? 4 : 1,
				clientX: point[0],
				clientY: point[1]
			})
		);
	}

	function dispatchClick(point: Point): void {
		requireCanvas().dispatchEvent(
			new MouseEvent('click', {
				bubbles: true,
				cancelable: true,
				composed: true,
				clientX: point[0],
				clientY: point[1]
			})
		);
	}

	function dispatchWheel(point: Point, deltaY: number): void {
		requireCanvas().dispatchEvent(
			new WheelEvent('wheel', {
				bubbles: true,
				cancelable: true,
				composed: true,
				deltaY,
				clientX: point[0],
				clientY: point[1]
			})
		);
	}

	function dispatchKey(key: string, modifiers: { metaKey?: boolean; ctrlKey?: boolean } = {}): void {
		document.body.dispatchEvent(
			new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers })
		);
	}

	function actionCount(sessionId: string): number {
		return hooks.ledger(sessionId)?.actions.length ?? 0;
	}

	async function waitForAction(sessionId: string, fromIndex: number): Promise<P23BActionLedger> {
		const deadline = performance.now() + ACTION_TIMEOUT_MS;
		for (;;) {
			const action = (hooks.ledger(sessionId)?.actions ?? []).find(
				(candidate) => candidate.index >= fromIndex && candidate.status === 'completed'
			);
			if (action) return action;
			if (performance.now() >= deadline) {
				throw new Error(`action ${fromIndex} did not complete within ${ACTION_TIMEOUT_MS} ms`);
			}
			await sleep(16);
		}
	}

	/** press → moves → release → the click a real pointer always delivers. */
	async function pointerGesture(
		sessionId: string,
		from: Point,
		to: Point,
		options: { button?: number; moves?: number; click?: boolean } = {}
	): Promise<P23BActionLedger> {
		const button = options.button ?? 0;
		const moves = options.moves ?? 4;
		const id = (pointerId += 1);
		const before = actionCount(sessionId);
		dispatchPointer('pointerdown', from, { button, id });
		await nextFrame();
		for (let step = 1; step <= moves; step += 1) {
			dispatchPointer('pointermove', lerp(from, to, step / moves), { button, id });
			await nextFrame();
		}
		dispatchPointer('pointerup', to, { button, id });
		if (options.click ?? button === 0) dispatchClick(to);
		return waitForAction(sessionId, before);
	}

	async function pointerTap(sessionId: string, point: Point): Promise<P23BActionLedger> {
		const id = (pointerId += 1);
		const before = actionCount(sessionId);
		dispatchPointer('pointerdown', point, { id });
		await nextFrame();
		dispatchPointer('pointerup', point, { id });
		dispatchClick(point);
		return waitForAction(sessionId, before);
	}

	function chordPoints(document_: LayoutDocumentWallFirst, wallId: string): [Point, Point] {
		const wall = document_.walls.find((candidate) => candidate.id === wallId);
		if (!wall) throw new Error(`unknown Wall ${wallId}`);
		const start = document_.junctions.find((junction) => junction.id === wall.startJunctionId);
		const end = document_.junctions.find((junction) => junction.id === wall.endJunctionId);
		if (!start || !end) throw new Error(`Wall ${wallId} is missing a Junction`);
		return [
			[start.point[0], start.point[1]],
			[end.point[0], end.point[1]]
		];
	}

	function wallById(document_: LayoutDocumentWallFirst, wallId: string) {
		const wall = document_.walls.find((candidate) => candidate.id === wallId);
		if (!wall) throw new Error(`unknown Wall ${wallId}`);
		return wall;
	}

	/** The wall's own midpoint: its knot for a one-knot chain, its chord otherwise. */
	function centerlinePoint(document_: LayoutDocumentWallFirst, wallId: string): Point {
		const wall = wallById(document_, wallId);
		if (wall.centerline.kind === 'cubic-chain' && wall.centerline.knots.length === 1) {
			const knot = wall.centerline.knots[0]!;
			return [knot.point[0], knot.point[1]];
		}
		const [start, end] = chordPoints(document_, wallId);
		return lerp(start, end, 0.5);
	}

	function firstRoomMoveTarget(document_: LayoutDocumentWallFirst): Point {
		const room = document_.rooms[0];
		if (!room) throw new Error(`${document_.formatVersion}: fixture has no Room to move`);
		const wallIds = new Set(room.boundary.map((edge) => edge.wallId));
		const junctionIds = new Set<string>();
		for (const wall of document_.walls) {
			if (!wallIds.has(wall.id)) continue;
			junctionIds.add(wall.startJunctionId);
			junctionIds.add(wall.endJunctionId);
		}
		const points = document_.junctions.filter((junction) => junctionIds.has(junction.id)).map((junction) => junction.point);
		if (points.length < 3) throw new Error(`Room ${room.id} has fewer than three boundary Junctions`);
		const minX = Math.min(...points.map((point) => point[0]));
		const maxX = Math.max(...points.map((point) => point[0]));
		const minZ = Math.min(...points.map((point) => point[1]));
		const maxZ = Math.max(...points.map((point) => point[1]));
		// The arithmetic centroid sits under the room-label overlay in the matrix
		// fixture, so its pointer resolves to selection instead of the filled Room.
		// Use a stable off-centre interior target shared by the rectangular matrix
		// cells and owner fixture.
		return [
			minX + (maxX - minX) / 3,
			minZ + ((maxZ - minZ) * 2) / 3
		];
	}

	/** The fixture's bend target, or `null` when its geometry has no knot to bend. */
	function bendPoint(fixture: P23BDriveFixture): Point | null {
		const wall = fixture.document.walls.find((candidate) => candidate.id === fixture.targets.bendWallId);
		if (!wall || wall.centerline.kind !== 'cubic-chain') return null;
		const knot =
			wall.centerline.knots.find((candidate) => candidate.id === fixture.targets.bendKnotId) ??
			wall.centerline.knots[0];
		return knot ? [knot.point[0], knot.point[1]] : null;
	}

	function targetsFor(fixture: P23BDriveFixture): DriverTargets {
		const { targets } = fixture;
		const [chordStart, chordEnd] = chordPoints(fixture.document, targets.dragWallId);
		const grab = lerp(chordStart, chordEnd, targets.dragGrabFraction);
		return {
			selection: centerlinePoint(fixture.document, targets.selectionWallId),
			bend: bendPoint(fixture),
			dragFrom: grab,
			dragTo: oneGridStepAlong(snapToGrid(grab), chordNormal(chordStart, chordEnd)),
			authoringFrom: [...targets.authoringFrom],
			authoringTo: [...targets.authoringTo],
			roomCenter: firstRoomMoveTarget(fixture.document),
			roomCreationFrom: [...targets.authoringFrom],
			roomCreationTo: [targets.authoringFrom[0] + 4, targets.authoringFrom[1] + 2]
		};
	}

	function targetBox(targets: DriverTargets): { min: Point; max: Point } {
		const points = [
			targets.selection,
			targets.dragFrom,
			targets.dragTo,
			targets.authoringFrom,
			targets.authoringTo,
			targets.roomCenter,
			targets.roomCreationFrom,
			targets.roomCreationTo
		];
		if (targets.bend) points.push(targets.bend);
		const xs = points.map((point) => point[0]);
		const zs = points.map((point) => point[1]);
		return { min: [Math.min(...xs), Math.min(...zs)], max: [Math.max(...xs), Math.max(...zs)] };
	}

	function ladderPixelsPerMeter(): number {
		let pixelsPerMeter = 2;
		for (let step = 0; step < ZOOM_STEPS_IN; step += 1) pixelsPerMeter *= 1.12;
		return pixelsPerMeter;
	}

	async function panBy(delta: Point): Promise<void> {
		const center = canvasCenter();
		const id = (pointerId += 1);
		const to: Point = [center[0] + delta[0], center[1] + delta[1]];
		dispatchPointer('pointerdown', center, { button: 1, id });
		await nextFrame();
		dispatchPointer('pointermove', to, { button: 1, id });
		await nextFrame();
		dispatchPointer('pointerup', to, { button: 1, id });
		await settleFrames(2);
	}

	/**
	 * One step of the cold workload's camera walk (§16): see `COLD_CAMERA_STEP_PX`.
	 *
	 * A pan IS an action in the ledger, and it is deliberately left unassigned to any
	 * Room-label arm: the arm split drops windows whose action recorded no arm, so the
	 * camera move's own post-release window is counted as `unassignedWindows` instead of
	 * being merged into the gesture's window population. The gesture that follows is
	 * measured under the moved camera, which is the only thing the cold pass changes.
	 */
	async function nudgeCamera(attempt: number): Promise<void> {
		const angle = attempt * COLD_CAMERA_GOLDEN_ANGLE_RAD;
		await panBy([COLD_CAMERA_STEP_PX * Math.cos(angle), COLD_CAMERA_STEP_PX * Math.sin(angle)]);
	}

	/** The view every fixture must publish before its capture opens. */
	async function setSharedView(targets: DriverTargets): Promise<PlanView> {
		const anchor = canvasCenter();
		for (let step = 0; step < ZOOM_OUT_STEPS; step += 1) dispatchWheel(anchor, WHEEL_DELTA);
		await settleFrames(3);
		for (let step = 0; step < ZOOM_STEPS_IN; step += 1) dispatchWheel(anchor, -WHEEL_DELTA);
		await settleFrames(3);
		const expected = ladderPixelsPerMeter();
		const box = targetBox(targets);
		const center: Point = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2];
		for (let attempt = 0; attempt < 8; attempt += 1) {
			const view = requireView();
			if (Math.abs(view.pixelsPerMeter - expected) > VIEW_EPSILON_PX_PER_M * expected) {
				throw new Error(
					`the Plan viewport is at ${view.pixelsPerMeter} px/m instead of the shared ladder value ${expected}`
				);
			}
			const dx = (view.center[0] - center[0]) * view.pixelsPerMeter;
			const dy = (view.center[1] - center[1]) * view.pixelsPerMeter;
			if (Math.hypot(dx, dy) <= 0.5) break;
			await panBy([dx, dy]);
		}
		const view = requireView();
		const margin = VIEW_MARGIN_PX / view.pixelsPerMeter;
		const wide = box.max[0] - box.min[0] + margin * 2;
		const tall = box.max[1] - box.min[1] + margin * 2;
		const availableWidth = view.width / view.pixelsPerMeter;
		const availableHeight = view.height / view.pixelsPerMeter;
		if (wide > availableWidth || tall > availableHeight) {
			throw new Error(
				`the fixed target box does not fit the shared view: ${wide.toFixed(2)}x${tall.toFixed(2)} m of ${availableWidth.toFixed(2)}x${availableHeight.toFixed(2)} m`
			);
		}
		return view;
	}

	function ensureTool(label: 'Wall' | 'Select' | 'Rect Room'): void {
		const group = label === 'Select' ? 'Selection tool' : 'Draw tools';
		const button = toolbarButton(group, label);
		if (!button) throw new Error(`The ${label} tool button is not rendered`);
		if (button.getAttribute('aria-pressed') !== 'true') button.click();
	}

	function ensureViewOption(label: 'Snap' | 'Grid'): void {
		for (const button of document.querySelectorAll<HTMLButtonElement>(
			'.tool-group[aria-label="Plan options"] button'
		)) {
			if (!(button.textContent ?? '').trim().startsWith(label)) continue;
			if (button.getAttribute('aria-pressed') !== 'true') button.click();
			return;
		}
		throw new Error(`The ${label} plan option is not rendered`);
	}

	async function restore(): Promise<void> {
		dispatchKey('z', { metaKey: true, ctrlKey: true });
		await settleFrames(3);
		hooks.recordFixtureReset();
	}

	async function cancelPendingRun(): Promise<void> {
		dispatchKey('Escape');
		await settleFrames(2);
	}

	/**
	 * Repeat the fixed action until it reaches its intended path and outcome.
	 * A repeat is a retry, and the ledger's own retry count reports it.
	 */
	async function repeatPath(
		sessionId: string,
		pathName: BenchInteractionPath,
		target: number,
		attempt: (index: number) => Promise<{ action: P23BActionLedger; accepted: boolean }>
	): Promise<void> {
		let accepted = 0;
		let index = 0;
		let attempts = 0;
		while (accepted < target) {
			attempts += 1;
			if (attempts > target * ATTEMPT_LIMIT) {
				throw new Error(`${pathName}: gave up after ${attempts} attempts with ${accepted} accepted actions`);
			}
			const result = await attempt(index);
			index += 1;
			if (result.accepted) accepted += 1;
			else {
				note(
					`${pathName}: attempt ${attempts} recorded ${result.action.path ?? 'unresolved'}/${result.action.outcome ?? 'unresolved'}; repeating`
				);
			}
			progress = { ...progress, paths: { ...progress.paths, [pathName]: { attempted: attempts, accepted } } };
			hooks.progress({ ...progress });
			(globalThis as typeof globalThis & { __P23B_DRIVE__?: unknown }).__P23B_DRIVE__ = {
				...progress,
				paths: { ...progress.paths }
			};
		}
		note(`${pathName}: ${accepted} accepted actions in ${attempts} attempts`);
	}

	async function runPaths(fixture: P23BDriveFixture, sessionId: string, targets: DriverTargets): Promise<void> {
		report(`${fixture.id}: selection`);
		await repeatPath(sessionId, 'selection', DRIVE_ACTIONS_PER_PATH, async () => {
			const action = await pointerTap(sessionId, clientPoint(targets.selection));
			// A release sample exists only when the press armed a direct edit, so an
			// accepted release proves the click actually landed on the Wall.
			const accepted =
				action.path === 'selection' &&
				action.outcome === 'accepted' &&
				action.samples.some((sample) => sample.boundary === 'release');
			return { action, accepted };
		});

		if (!fixture.notApplicable['bend-knot-edit'] && targets.bend) {
			report(`${fixture.id}: bend-knot-edit`);
			const bend = targets.bend;
			await repeatPath(sessionId, 'bend-knot-edit', DRIVE_ACTIONS_PER_PATH, async () => {
				const from = clientPoint(bend);
				const to = clientPoint(oneGridStepAlong(snapToGrid(bend), [0, 1]));
				const action = await pointerGesture(sessionId, from, to);
				const accepted = action.path === 'bend-knot-edit' && action.outcome === 'accepted';
				// The Wall stays selected between bends; a miss re-selects and retries.
				if (!accepted) await pointerTap(sessionId, clientPoint(targets.selection));
				else await restore();
				return { action, accepted };
			});
		}

		report(`${fixture.id}: plan-drag-edit`);
		await repeatPath(sessionId, 'plan-drag-edit', DRIVE_ACTIONS_PER_PATH, async () => {
			const action = await pointerGesture(sessionId, clientPoint(targets.dragFrom), clientPoint(targets.dragTo));
			const accepted = action.path === 'plan-drag-edit' && action.outcome === 'accepted';
			if (accepted) await restore();
			return { action, accepted };
		});

		report(`${fixture.id}: wall-authoring`);
		ensureTool('Wall');
		await repeatPath(sessionId, 'wall-authoring', DRIVE_ACTIONS_PER_PATH, async () => {
			await cancelPendingRun();
			let setup = await pointerTap(sessionId, clientPoint(targets.authoringFrom));
			if (setup.outcome === 'suppressed') setup = await pointerTap(sessionId, clientPoint(targets.authoringFrom));
			const commit = await pointerTap(sessionId, clientPoint(targets.authoringTo));
			const accepted = commit.path === 'wall-authoring' && commit.outcome === 'accepted';
			await restore();
			return { action: commit, accepted };
		});
		ensureTool('Select');

		report(`${fixture.id}: plan-pan-zoom`);
		await repeatPath(sessionId, 'plan-pan-zoom', PAN_ROUND_TRIPS * 2 + WHEEL_PAIRS * 2 + 1, async (index) => {
			const panRounds = PAN_ROUND_TRIPS * 2;
			const wheelRounds = panRounds + WHEEL_PAIRS * 2;
			if (index < panRounds) {
				const direction = index % 2 === 0 ? 1 : -1;
				const from = canvasCenter();
				const to: Point = [from[0] + direction * PAN_STEP_PX, from[1]];
				const action = await pointerGesture(sessionId, from, to, { button: 1, click: false });
				return { action, accepted: action.path === 'plan-pan-zoom' && action.outcome === 'accepted' };
			}
			if (index < wheelRounds) {
				const wheelIndex = index - panRounds;
				const before = actionCount(sessionId);
				const anchor = canvasCenter();
				dispatchWheel(anchor, wheelIndex % 2 === 0 ? -WHEEL_DELTA : WHEEL_DELTA);
				await waitForAction(sessionId, before);
				const second = actionCount(sessionId);
				dispatchWheel(anchor, wheelIndex % 2 === 0 ? WHEEL_DELTA : -WHEEL_DELTA);
				const action = await waitForAction(sessionId, second);
				return { action, accepted: action.path === 'plan-pan-zoom' && action.outcome === 'accepted' };
			}
			// Closing tap: it changes nothing, so the capture's last observed view is
			// the canonical one the first measured action also reported.
			const point = canvasCenter();
			const action = await pointerGesture(sessionId, point, point, { button: 1, moves: 1, click: false });
			return { action, accepted: action.path === 'plan-pan-zoom' && action.outcome === 'accepted' };
		});
		const restored = requireView();
		const box = targetBox(targets);
		const center: Point = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2];
		const drift = Math.hypot(
			restored.center[0] - center[0],
			restored.center[1] - center[1]
		);
		if (drift * restored.pixelsPerMeter > 1) {
			throw new Error(`${fixture.id}: the pan/zoom path left the view ${(drift * restored.pixelsPerMeter).toFixed(1)} px off center`);
		}
		note(`${fixture.id}: view restored within ${(drift * restored.pixelsPerMeter).toFixed(4)} px`);
	}

	async function captureFixture(fixture: P23BDriveFixture): Promise<void> {
		const previousCanvas = planCanvas();
		const previousView = publishedPlanView();
		report(`hosting ${fixture.id}`);
		hooks.host(fixture.id);
		const remountDeadline = performance.now() + 20000;
		for (;;) {
			const canvas = planCanvas();
			const view = publishedPlanView();
			if (canvas && canvas !== previousCanvas && view && view !== previousView) break;
			if (performance.now() >= remountDeadline) throw new Error(`${fixture.id}: the editor did not remount`);
			await sleep(50);
		}
		await settleFrames(3);
		ensureViewOption('Snap');
		ensureViewOption('Grid');
		ensureTool('Select');
		const targets = targetsFor(fixture);
		report(`${fixture.id}: setting the shared view`);
		const view = await setSharedView(targets);
		note(
			`${fixture.id}: shared view ${view.pixelsPerMeter.toFixed(6)} px/m centered ${view.center
				.map((value) => value.toFixed(4))
				.join(', ')} (${view.width}x${view.height})`
		);
		const sessionId = hooks.startCapture();
		const capturesBefore = hooks.captureCount();
		report(`${fixture.id}: capturing`);
		await runPaths(fixture, sessionId, targets);
		await hooks.stopCapture();
		if (hooks.captureCount() <= capturesBefore) throw new Error(`${fixture.id}: the capture was not recorded`);
		const ledger = hooks.ledger(sessionId);
		note(
			`${fixture.id}: session ${sessionId.slice(0, 8)} actions ${ledger?.actions.length ?? 0} resets ${ledger?.fixtureResets ?? 0} dropped ${ledger?.droppedBoundaries ?? 0} settled ${ledger?.settled ?? false}`
		);
		if ((ledger?.droppedBoundaries ?? 0) !== 0) {
			throw new Error(`${fixture.id}: dropped ${ledger?.droppedBoundaries} deferred boundaries`);
		}
		if (!(ledger?.settled ?? false)) throw new Error(`${fixture.id}: the capture did not settle`);
	}

	/**
	 * P23B.6 S1b: isolated classes let Plan containment retain action identity
	 * without changing the baseline schema. P23B.11 S1 reuses the same machinery
	 * with its own `p23b11:` prefix, so the two slices' containment records can
	 * never be mistaken for each other.
	 */
	async function captureS1Class(
		fixture: P23BDriveFixture,
		actionClass: string,
		work: (sessionId: string) => Promise<void>,
		prefix = 'p23b6:',
		timing: { fixtureId: string; actionClass: string; cold?: boolean } | null = null
	): Promise<void> {
		// THE ONE PLACE THAT KNOWS BOTH the class and the workload it was measured
		// under. Every class-level `report` above it is overwritten by this line, so
		// marking the workload anywhere else leaves a run that says `rigid-wall-drag`
		// for six of the ten classes it drives — which is what made a failed cold leg
		// read as a failed repeat leg.
		reportClass(fixture.id, actionClass, timing?.cold === true);
		const sessionId = hooks.startCapture(`${prefix}${actionClass}`);
		// The long-frame observer (item (b2)) is started AFTER the session opens, so
		// the DEV measurement switch is already on, and stopped after the session
		// closes: its window is exactly this class, and its rows are summarized
		// against this class's own release spans.
		const observer = timing ? longFrameObserverOf() : null;
		observer?.start();
		try {
			await work(sessionId);
		} finally {
			await hooks.stopCapture();
			if (observer && timing) {
				p23bM1RecordLongFrames(timing.fixtureId, timing.actionClass, observer.stop(), observer.supported());
			}
		}
		const ledger = hooks.ledger(sessionId);
		if (!(ledger?.settled ?? false)) throw new Error(`${fixture.id}/${actionClass}: capture did not settle`);
		if ((ledger?.droppedBoundaries ?? 0) !== 0) {
			throw new Error(`${fixture.id}/${actionClass}: dropped ${ledger?.droppedBoundaries} deferred boundaries`);
		}
		note(`${fixture.id}/${actionClass}: ${ledger?.actions.length ?? 0} recorded interaction(s); settled`);
	}

	/**
	 * P23B.11 S1 — host one fixture and put it on the shared S1 view. Split out of
	 * `runS1Fixture` so the focused P23B.11 run can drive the same protocol (same
	 * px/m ladder, same settled capture, same undo restore) without re-listing the
	 * classes that slice does not measure.
	 */
	async function hostS1Fixture(
		fixture: P23BDriveFixture
	): Promise<{ targets: DriverTargets; selection: Point }> {
		const previousCanvas = planCanvas();
		const previousView = publishedPlanView();
		report(`hosting S1 fixture ${fixture.id}`);
		hooks.host(fixture.id);
		const remountDeadline = performance.now() + 20000;
		for (;;) {
			const canvas = planCanvas();
			const view = publishedPlanView();
			if (canvas && canvas !== previousCanvas && view && view !== previousView) break;
			if (performance.now() >= remountDeadline) throw new Error(`${fixture.id}: the editor did not remount`);
			await sleep(50);
		}
		await settleFrames(3);
		ensureViewOption('Snap');
		ensureViewOption('Grid');
		ensureTool('Select');
		const targets = targetsFor(fixture);
		await setSharedView(targets);
		return { targets, selection: clientPoint(targets.selection) };
	}

	/**
	 * The Wall-authoring class, shared by the P23B.6 attribution run and the
	 * P23B.11 wall-chain run: one tap starts (or re-starts) the run and one tap
	 * completes the 4 m segment; every accepted action is put back with the
	 * editor's own undo, so all actions act on the ratified fixture.
	 */
	async function runWallAuthoringClass(
		fixture: P23BDriveFixture,
		targets: DriverTargets,
		prefix = 'p23b6:',
		timing: M1ClassTiming | null = null
	): Promise<void> {
		report(`${fixture.id}: wall-authoring`);
		ensureTool('Wall');
		await captureS1Class(
			fixture,
			'wall-authoring',
			async (sessionId) => {
				await repeatPath(sessionId, 'wall-authoring', DRIVE_ACTIONS_PER_PATH, async (index) => {
					// The whole attempt runs under one label arm, not just the commit tap: the
					// setup tap renders the Plan too, and the attempt is the unit the arm
					// alternates over.
					const commit = await withLabelArm(timing, index, async () => {
						await cancelPendingRun();
						let setup = await pointerTap(sessionId, clientPoint(targets.authoringFrom));
						if (setup.outcome === 'suppressed') setup = await pointerTap(sessionId, clientPoint(targets.authoringFrom));
						return pointerTap(sessionId, clientPoint(targets.authoringTo));
					});
					const accepted = commit.path === 'wall-authoring' && commit.outcome === 'accepted';
					await restore();
					return { action: commit, accepted };
				});
			},
			prefix,
			timing
		);
	}

	/**
	 * Pre-P23B.8 follow-up M1 — the two instrumentation items the plan's §4 asks
	 * for, bracketed around the drags themselves. Neither changes an action: the
	 * series is sampled beside the gesture and the observer only listens.
	 */
	type M1ClassTiming = {
		fixtureId: string;
		actionClass: string;
		drag: boolean;
		/**
		 * The BEFORE/AFTER arm list this class interleaves per attempt, or `null`
		 * for a class that runs one path only. Only the whole-Room class takes arms;
		 * every other class leaves the arm switch alone.
		 */
		arms?: readonly P23BM1RoomDragArm[] | null;
		/**
		 * The Room-label arm list this class interleaves per attempt, or `null`.
		 *
		 * UNLIKE `arms` THIS ONE IS NOT CONFINED TO A CLASS. The placer runs on every
		 * Plan render, and the render a release produces is what the post-release
		 * window measures, so every class that changes the Plan's geometry while it is
		 * drawn takes this arm — which is all five of them.
		 */
		labelArms?: readonly P23BM1RoomLabelArm[] | null;
		/**
		 * Whether this class runs the COLD workload (§16): one `nudgeCamera` step before
		 * every attempt, so no render repeats a projection the session already drew.
		 * Chosen per class by `runM1Fixture`, and the ONLY difference between a class's
		 * two passes.
		 */
		cold?: boolean;
	};

	let gestureSampler: ReturnType<typeof createP23BGestureFrameSampler> | null = null;
	let longFrameObserver: ReturnType<typeof createP23BLongFrameObserver> | null = null;

	function gestureSamplerOf(): ReturnType<typeof createP23BGestureFrameSampler> {
		gestureSampler ??= createP23BGestureFrameSampler();
		return gestureSampler;
	}

	function longFrameObserverOf(): ReturnType<typeof createP23BLongFrameObserver> {
		longFrameObserver ??= createP23BLongFrameObserver();
		return longFrameObserver;
	}

	/**
	 * Bracket ONE drag with the gesture-frame series (item (a)). The sampler is
	 * started immediately before the press and stopped once the action has
	 * resolved, so the frames it reports are the frames the drag itself produced.
	 * No drag workload is ever measured without it; a non-drag class gets the work
	 * function untouched.
	 *
	 * THE BRACKET CARRIES ITS ACTION'S IDENTITY. The series is recorded with the
	 * ledger index and outcome of the action it resolved to, because a bracket is
	 * per ATTEMPT and the reported row is per MEASURED ACTION: `repeatPath` retries,
	 * and the leading warm-up drags are measured but not reported. Without the
	 * identity the merge could only pool every bracket, quietly averaging warm-up
	 * and retry frames into a row that claims to be the measured class. An attempt
	 * that throws or never resolves records `null` and can therefore never be
	 * merged into a measured action.
	 */
	async function bracketGestureFrames(
		timing: M1ClassTiming | null,
		label: string,
		work: () => Promise<P23BActionLedger>
	): Promise<P23BActionLedger> {
		if (!timing?.drag) return work();
		const sampler = gestureSamplerOf();
		sampler.start(label);
		let resolved: P23BActionLedger | null = null;
		try {
			resolved = await work();
			return resolved;
		} finally {
			const series = sampler.stop();
			if (series) {
				p23bM1RecordGestureFrames(
					timing.fixtureId,
					timing.actionClass,
					label,
					series,
					resolved ? { index: resolved.index, outcome: resolved.outcome ?? null } : null
				);
			}
		}
	}

	/**
	 * Pre-P23B.8 follow-up — the Room-label arm's per-ATTEMPT bracket, the same shape
	 * as `bracketGestureFrames` above and for the same reason.
	 *
	 * WHY THE ARM IS SET HERE AND NOT SOMEWHERE CHEAPER. The placer runs on the Plan
	 * RENDER, which happens after the release (pointerup) and lands in the window the
	 * runner measures, so the arm has to be selected before the gesture begins and
	 * stay selected until that action's render has happened — clearing it in a
	 * `finally` would race the very render the comparison is about. It is therefore
	 * set per attempt and released once per fixture by its caller, exactly as the
	 * room-drag arm is released once per class.
	 *
	 * It is chosen by ATTEMPT index and recorded against the action the attempt
	 * RESOLVED to, while the reported population is per MEASURED action: `repeatPath`
	 * retries and the leading warm-ups are measured but not reported, so recording the
	 * resolved index is what lets the runner split a class by arm without ever
	 * attributing an action to an arm it did not run under.
	 */
	async function withLabelArm(
		timing: M1ClassTiming | null,
		index: number,
		work: () => Promise<P23BActionLedger>
	): Promise<P23BActionLedger> {
		const arms = timing?.labelArms ?? null;
		const arm = arms && arms.length > 0 ? arms[index % arms.length]! : null;
		// The arm is set with the class it belongs to, so the instrument can report the
		// class's grid-build keys beside the build count the same attempt already carries.
		if (arm && timing)
			setP23bM1RoomLabelArm(arm, {
				fixtureId: timing.fixtureId,
				actionClass: timing.actionClass
			});
		// THE COLD WORKLOAD (§16) — the camera moves BEFORE the gesture, inside the arm
		// bracket, so the gesture and the release that follows it are drawn under a
		// projection this session has not drawn before. Nothing else about the attempt
		// changes: same arm, same gesture, same restore.
		if (timing?.cold) await nudgeCamera(index);
		const action = await work();
		if (arm && timing) p23bM1RecordActionLabelArm(timing.fixtureId, timing.actionClass, action.index, arm);
		return action;
	}

	/**
	 * The rigid Plan drag class: one drag of the Wall by one grid step per accepted
	 * action, restored with the editor's own undo. Shared by the P23B.6 S1 run and
	 * the M1 run, which differ only in whether the gesture series is bracketed.
	 */
	async function runRigidWallDragClass(
		fixture: P23BDriveFixture,
		targets: DriverTargets,
		prefix = 'p23b6:',
		timing: M1ClassTiming | null = null
	): Promise<void> {
		report(`${fixture.id}: rigid-wall-drag`);
		ensureSelectTool();
		await captureS1Class(
			fixture,
			'rigid-wall-drag',
			async (sessionId) => {
				await repeatPath(sessionId, 'plan-drag-edit', DRIVE_ACTIONS_PER_PATH, async (index) => {
					const action = await withLabelArm(timing, index, () =>
						bracketGestureFrames(timing, 'plan-drag-edit', () =>
							pointerGesture(sessionId, clientPoint(targets.dragFrom), clientPoint(targets.dragTo))
						)
					);
					const accepted = action.path === 'plan-drag-edit' && action.outcome === 'accepted';
					if (accepted) await restore();
					return { action, accepted };
				});
			},
			prefix,
			timing
		);
	}

	/**
	 * The bend class: the Wall is selected first, then one knot drag per accepted
	 * action. The selection tap is part of the S1 sequence and is kept as-is.
	 *
	 * THE DRAG IS ONE FULL GRID INCREMENT OF POINTER TRAVEL, measured from the
	 * PRESS point, not from the snapped knot. The committed bend is the same
	 * either way — a knot-move lands on the snapped release point, and one grid
	 * step past any point snaps to one grid step past that point's snapped
	 * position — but the pointer travel is not. Deriving the destination from the
	 * SNAPPED knot shortens the gesture by exactly the knot's own off-grid
	 * deviation, and on the generated connected case (whose knots are off-grid on
	 * BOTH axes) that dropped the gesture to 3.5 px — under the app's shared
	 * `EDITOR_DRAG_THRESHOLD_PX` of 4 — so every release committed as a click
	 * instead of a bend and the class could never reach an accepted action. A
	 * gesture measured as a drag must actually cross the drag threshold.
	 */
	async function runBendClass(
		fixture: P23BDriveFixture,
		targets: DriverTargets,
		selection: Point,
		prefix = 'p23b6:',
		timing: M1ClassTiming | null = null
	): Promise<void> {
		if (fixture.notApplicable['bend-knot-edit'] || !targets.bend) return;
		report(`${fixture.id}: bend`);
		ensureSelectTool();
		await captureS1Class(
			fixture,
			'bend',
			async (sessionId) => {
				await pointerTap(sessionId, selection);
				const bend = targets.bend!;
				await repeatPath(sessionId, 'bend-knot-edit', DRIVE_ACTIONS_PER_PATH, async (index) => {
					const action = await withLabelArm(timing, index, () =>
						bracketGestureFrames(timing, 'bend-knot-edit', () =>
							pointerGesture(
								sessionId,
								clientPoint(bend),
								clientPoint(p23bBendReleasePoint(bend))
							)
						)
					);
					const accepted = action.path === 'bend-knot-edit' && action.outcome === 'accepted';
					if (accepted) await restore();
					else await pointerTap(sessionId, selection);
					return { action, accepted };
				});
			},
			prefix,
			timing
		);
	}

	/**
	 * The whole-Room move class (D1's second row): one drag of the whole Room by one
	 * grid step, through the same plan-drag-edit path the S1 capture used.
	 */
	async function runWholeRoomMoveClass(
		fixture: P23BDriveFixture,
		targets: DriverTargets,
		prefix = 'p23b6:',
		timing: M1ClassTiming | null = null
	): Promise<void> {
		report(`${fixture.id}: whole-room-move-bridge`);
		ensureSelectTool();
		await captureS1Class(
			fixture,
			'whole-room-move-bridge',
			async (sessionId) => {
				const roomCenter = targets.roomCenter;
				const moved = p23bRoomMoveReleasePoint(roomCenter);
				const arms = timing?.arms ?? null;
				await repeatPath(sessionId, 'plan-drag-edit', DRIVE_ACTIONS_PER_PATH, async (index) => {
					// The BEFORE/AFTER arm is chosen per ATTEMPT and recorded against the
					// action the attempt resolved to, so the record can split the class's
					// measured population by the arm that actually produced it.
					const arm = arms && arms.length > 0 ? arms[index % arms.length]! : null;
					if (arm) setP23bM1RoomDragArm(arm);
					const action = await withLabelArm(timing, index, () =>
						bracketGestureFrames(timing, 'plan-drag-edit', () =>
							pointerGesture(sessionId, clientPoint(roomCenter), clientPoint(moved))
						)
					);
					if (arm && timing) p23bM1RecordActionArm(timing.fixtureId, timing.actionClass, action.index, arm);
					const accepted = action.path === 'plan-drag-edit' && action.outcome === 'accepted';
					if (accepted) await restore();
					return { action, accepted };
				});
				// Hand the next class back the shipped path: the arm is per class, and a
				// leaked `per-move` would silently measure the before arm everywhere.
				if (arms) setP23bM1RoomDragArm(null);
			},
			prefix,
			timing
		);
	}

	/** The Rect Room creation class (one 4×2 m drag commit per accepted action). */
	async function runRoomCreationClass(
		fixture: P23BDriveFixture,
		targets: DriverTargets,
		prefix = 'p23b6:',
		timing: M1ClassTiming | null = null
	): Promise<void> {
		report(`${fixture.id}: room-creation-commit`);
		ensureTool('Rect Room');
		await captureS1Class(
			fixture,
			'room-creation-commit',
			async (sessionId) => {
				await repeatPath(sessionId, 'wall-authoring', DRIVE_ACTIONS_PER_PATH, async (index) => {
					const action = await withLabelArm(timing, index, () =>
						pointerGesture(
							sessionId,
							clientPoint(targets.roomCreationFrom),
							clientPoint(targets.roomCreationTo),
							{ click: false }
						)
					);
					const accepted = action.path === 'wall-authoring' && action.outcome === 'accepted';
					if (accepted) await restore();
					return { action, accepted };
				});
			},
			prefix,
			timing
		);
	}

	/** Host the fixture, then run the remaining classes of the P23B.6 attribution series. */
	async function runS1Fixture(fixture: P23BDriveFixture): Promise<void> {
		const { targets, selection } = await hostS1Fixture(fixture);
		await runRigidWallDragClass(fixture, targets);
		await runBendClass(fixture, targets, selection);
		await runWholeRoomMoveClass(fixture, targets);

		await runWallAuthoringClass(fixture, targets);
		await runRoomCreationClass(fixture, targets);

		ensureTool('Select');
		report(`${fixture.id}: persistent-pan-zoom`);
		await captureS1Class(fixture, 'persistent-pan-zoom', async (sessionId) => {
			await repeatPath(sessionId, 'plan-pan-zoom', PAN_ROUND_TRIPS * 2 + WHEEL_PAIRS * 2 + 1, async (index) => {
				const panRounds = PAN_ROUND_TRIPS * 2;
				const wheelRounds = panRounds + WHEEL_PAIRS * 2;
				if (index < panRounds) {
					const direction = index % 2 === 0 ? 1 : -1;
					const from = canvasCenter();
					const to: Point = [from[0] + direction * PAN_STEP_PX, from[1]];
					const action = await pointerGesture(sessionId, from, to, { button: 1, click: false });
					return { action, accepted: action.path === 'plan-pan-zoom' && action.outcome === 'accepted' };
				}
				if (index < wheelRounds) {
					const wheelIndex = index - panRounds;
					const before = actionCount(sessionId);
					const anchor = canvasCenter();
					dispatchWheel(anchor, wheelIndex % 2 === 0 ? -WHEEL_DELTA : WHEEL_DELTA);
					await waitForAction(sessionId, before);
					const second = actionCount(sessionId);
					dispatchWheel(anchor, wheelIndex % 2 === 0 ? WHEEL_DELTA : -WHEEL_DELTA);
					const action = await waitForAction(sessionId, second);
					return { action, accepted: action.path === 'plan-pan-zoom' && action.outcome === 'accepted' };
				}
				const point = canvasCenter();
				const action = await pointerGesture(sessionId, point, point, { button: 1, moves: 1, click: false });
				return { action, accepted: action.path === 'plan-pan-zoom' && action.outcome === 'accepted' };
			});
		});

		report(`${fixture.id}: idle-frames`);
		const idleSamples: number[] = [];
		await captureS1Class(fixture, 'idle-frames', async () => {
			let previous = performance.now();
			for (let index = 0; index < 120; index += 1) {
				await nextFrame();
				const now = performance.now();
				idleSamples.push(now - previous);
				previous = now;
			}
		});
		const idleReport = globalThis as typeof globalThis & {
			__P23B6_S1_IDLE_FRAMES__?: Array<{ fixtureId: string; samples: number[] }>;
		};
		idleReport.__P23B6_S1_IDLE_FRAMES__ ??= [];
		idleReport.__P23B6_S1_IDLE_FRAMES__.push({ fixtureId: fixture.id, samples: idleSamples });
	}

	async function runP23B6S1(): Promise<void> {
		installPointerCaptureNoop();
		progress = { running: true, fixtureId: null, step: 'P23B.6 S1 starting', paths: {} };
		hooks.progress({ ...progress });
		try {
			const order = ['p23b-40-wall-straight-v1', 'p23b-40-wall-all-curved-v1', 'owner-40-curved-v1'];
			for (const id of order) {
				const fixture = hooks.fixtures().find((candidate) => candidate.id === id);
				if (!fixture) throw new Error(`S1 fixture is missing: ${id}`);
				progress = { ...progress, fixtureId: fixture.id, paths: {} };
				hooks.progress({ ...progress });
				await runS1Fixture(fixture);
			}
			report('P23B.6 S1 complete');
		} finally {
			progress = { ...progress, running: false };
			hooks.progress({ ...progress });
		}
	}

	/**
	 * P23B.11 S1/S7 — the focused wall-chain release-delay capture.
	 *
	 * Same S6 protocol as `runP23B6S1` (settled capture, zero dropped boundaries,
	 * undo-restored actions, one shared px/m ladder), but only the two paths this
	 * slice measures — `wall-authoring` and `room-creation-commit` — on the three
	 * committed fixtures and on the generated CONNECTED case. Each class is its own
	 * measurement session (`p23b11:` prefix), so the containment record binds the
	 * chain's marks to the action that produced them, and nothing enters the
	 * baseline report (action-class captures are containment-only).
	 */
	async function runP23B11S1(): Promise<void> {
		installPointerCaptureNoop();
		progress = { running: true, fixtureId: null, step: 'P23B.11 S1 starting', paths: {} };
		hooks.progress({ ...progress });
		try {
			for (const id of P23B11_S1_FIXTURE_ORDER) {
				const fixture = hooks.fixtures().find((candidate) => candidate.id === id);
				if (!fixture) throw new Error(`P23B.11 S1 fixture is missing: ${id}`);
				progress = { ...progress, fixtureId: fixture.id, paths: {} };
				hooks.progress({ ...progress });
				const { targets } = await hostS1Fixture(fixture);
				await runWallAuthoringClass(fixture, targets, 'p23b11:');
				await runRoomCreationClass(fixture, targets, 'p23b11:');
			}
			report('P23B.11 S1 complete');
		} finally {
			progress = { ...progress, running: false };
			hooks.progress({ ...progress });
		}
	}

	/**
	 * Pre-P23B.8 follow-up M1 — one fixture's classes on the one protocol (§3.3).
	 *
	 * The three drag workloads run first (they carry the §4.2 gesture series),
	 * then the two authoring classes whose sequences are UNCHANGED from the S1
	 * capture so D1's rows stay comparable. Each class is its own isolated,
	 * settled session under the M1 prefix; the connected case is hosted last and
	 * its classes are containment-only, so nothing about it can be recorded.
	 *
	 * When `coldLabelArms` is set the whole class list runs a SECOND time under the
	 * cold prefix, with one camera step before every attempt (§16). Both passes are
	 * inside one run, on one runtime, against one fixture remount, so the repeat and
	 * cold populations are read in the same session and neither is compared across
	 * sessions.
	 */
	async function runM1Fixture(
		fixture: P23BDriveFixture,
		arms = false,
		labelArms = false,
		coldLabelArms = false
	): Promise<void> {
		const { targets, selection } = await hostS1Fixture(fixture);
		/**
		 * ONE pass over the class list. `cold` is the whole of §16's difference: the
		 * session prefix (and therefore the recorded class name) and one camera step
		 * per attempt. Everything else — the classes, the order, the gestures, the
		 * per-attempt arm, the undo restore, the window definition — is identical, so
		 * the two passes are the same protocol at the two ends of one bracket.
		 */
		const pass = async (cold: boolean): Promise<void> => {
			const prefix = cold ? P23B_M1_COLD_PREFIX : P23B_M1_PREFIX;
			for (const entry of P23B_M1_ACTION_CLASSES) {
				const timing: M1ClassTiming = {
					fixtureId: fixture.id,
					// The RECORDED class name, so the series and the window this class
					// measures are found again by the row that reports them. The cold
					// pass's name is the prefix apart, so it can never be read as the
					// repeat pass's row.
					actionClass: `${prefix}${entry.actionClass}`,
					drag: entry.drag,
					// BEFORE/AFTER mode interleaves the arms on the whole-Room class and
					// nowhere else: it is the one class this change touched.
					arms: arms && entry.actionClass === 'whole-room-move-bridge' ? P23B_M1_ROOM_DRAG_ARMS : null,
					// The Room-label arm is NOT confined to a class: the placer runs on every
					// Plan render, so every class that changes the Plan while it is drawn
					// takes it — which is all five.
					labelArms: labelArms ? P23B_M1_ROOM_LABEL_ARMS : null,
					cold
				};
				switch (entry.actionClass) {
					case 'rigid-wall-drag':
						await runRigidWallDragClass(fixture, targets, prefix, timing);
						break;
					case 'bend':
						await runBendClass(fixture, targets, selection, prefix, timing);
						break;
					case 'whole-room-move-bridge':
						await runWholeRoomMoveClass(fixture, targets, prefix, timing);
						break;
					case 'wall-authoring':
						await runWallAuthoringClass(fixture, targets, prefix, timing);
						break;
					default:
						await runRoomCreationClass(fixture, targets, prefix, timing);
				}
			}
		};
		await pass(false);
		if (coldLabelArms) await pass(true);
		// The label arm is per fixture, not per class: it was set inside each attempt's
		// gesture and must be released before the next fixture is hosted, or a render
		// during hosting would run the pre-change grid.
		setP23bM1RoomLabelArm(null);
		ensureTool('Select');
	}

	/**
	 * Pre-P23B.8 follow-up M1 — the one protocol, one runtime: the M1 fixture order,
	 * every class of `P23B_M1_ACTION_CLASSES`, the gesture-frame and long-frame
	 * instruments bracketed around the drags they belong to. This run writes no
	 * baseline and reads none; every class it opens is `p23b-m1:`-prefixed.
	 *
	 * `arms` interleaves the room-drag arms (one class), `labelArms` the Room-label
	 * arms (every class). They are separate switches on purpose: the two changes are
	 * orthogonal, and a run that flipped both at once would thin every cell to a
	 * quarter and confound them on the one class they share.
	 *
	 * `coldLabelArms` adds §16's second pass over the same classes with the camera
	 * moved between attempts. It is a THIRD switch rather than part of `labelArms` so
	 * that a reader can still run the repeat workload alone, and so the cold pass can
	 * never be mistaken for the population §14 §15 were measured on.
	 */
	async function runM1(arms = false, labelArms = false, coldLabelArms = false): Promise<void> {
		installPointerCaptureNoop();
		p23bM1ResetFrameTiming();
		p23bM1ResetActionArms();
		p23bM1ResetActionLabelArms();
		setP23bM1RoomDragArm(null);
		setP23bM1RoomLabelArm(null);
		progress = {
			running: true,
			fixtureId: null,
			step: arms
				? 'M1 arms starting'
				: coldLabelArms
					? 'M1 cold label arms starting'
					: labelArms
						? 'M1 label arms starting'
						: 'M1 starting',
			paths: {}
		};
		hooks.progress({ ...progress });
		try {
			for (const id of P23B_M1_FIXTURE_ORDER) {
				const fixture = hooks.fixtures().find((candidate) => candidate.id === id);
				if (!fixture) throw new Error(`M1 fixture is missing: ${id}`);
				progress = { ...progress, fixtureId: fixture.id, paths: {} };
				hooks.progress({ ...progress });
				await runM1Fixture(fixture, arms, labelArms, coldLabelArms);
			}
			report(
				arms
					? 'M1 arms complete'
					: coldLabelArms
						? 'M1 cold label arms complete'
						: labelArms
							? 'M1 label arms complete'
							: 'M1 complete'
			);
		} finally {
			// Both switches are released here as well as at their own boundaries, so an
			// aborted run can never leave a before path selected for a later session.
			setP23bM1RoomDragArm(null);
			setP23bM1RoomLabelArm(null);
			progress = { ...progress, running: false };
			hooks.progress({ ...progress });
		}
	}

	async function run(): Promise<void> {
		installPointerCaptureNoop();
		progress = { running: true, fixtureId: null, step: 'starting', paths: {} };
		hooks.progress({ ...progress });
		try {
			for (const fixture of hooks.fixtures()) {
				progress = { ...progress, fixtureId: fixture.id, paths: {} };
				hooks.progress({ ...progress });
				await captureFixture(fixture);
			}
			report('complete');
		} finally {
			progress = { ...progress, running: false };
			hooks.progress({ ...progress });
		}
	}

	return { run, runP23B6S1, runP23B11S1, runM1, targetsFor, ladderPixelsPerMeter };
}
