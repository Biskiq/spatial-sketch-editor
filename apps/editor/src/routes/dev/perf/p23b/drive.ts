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
/** Wheel steps climbed after the zoom floor: 2 * 1.12^20 ≈ 19.29 px/m. */
const ZOOM_STEPS_IN = 20;
const ZOOM_OUT_STEPS = 40;
const WHEEL_DELTA = 120;
/** Kept in step with the shipped Plan snap; the protocol states "Snap 0.25 m on". */
const GRID_STEP_M = 0.25;
const ACTION_TIMEOUT_MS = 6000;
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

	/** P23B.6 S1b: isolated classes let Plan containment retain action identity without changing the baseline schema. */
	async function captureS1Class(
		fixture: P23BDriveFixture,
		actionClass: string,
		work: (sessionId: string) => Promise<void>
	): Promise<void> {
		report(`${fixture.id}: ${actionClass}`);
		const sessionId = hooks.startCapture(`p23b6:${actionClass}`);
		try {
			await work(sessionId);
		} finally {
			await hooks.stopCapture();
		}
		const ledger = hooks.ledger(sessionId);
		if (!(ledger?.settled ?? false)) throw new Error(`${fixture.id}/${actionClass}: capture did not settle`);
		if ((ledger?.droppedBoundaries ?? 0) !== 0) {
			throw new Error(`${fixture.id}/${actionClass}: dropped ${ledger?.droppedBoundaries} deferred boundaries`);
		}
		note(`${fixture.id}/${actionClass}: ${ledger?.actions.length ?? 0} recorded interaction(s); settled`);
	}

	async function runS1Fixture(fixture: P23BDriveFixture): Promise<void> {
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
		const selection = clientPoint(targets.selection);

		report(`${fixture.id}: rigid-wall-drag`);
		await captureS1Class(fixture, 'rigid-wall-drag', async (sessionId) => {
			await repeatPath(sessionId, 'plan-drag-edit', DRIVE_ACTIONS_PER_PATH, async () => {
				const action = await pointerGesture(sessionId, clientPoint(targets.dragFrom), clientPoint(targets.dragTo));
				const accepted = action.path === 'plan-drag-edit' && action.outcome === 'accepted';
				if (accepted) await restore();
				return { action, accepted };
			});
		});

		if (!fixture.notApplicable['bend-knot-edit'] && targets.bend) {
			report(`${fixture.id}: bend`);
			await captureS1Class(fixture, 'bend', async (sessionId) => {
				await pointerTap(sessionId, selection);
				const bend = targets.bend!;
				await repeatPath(sessionId, 'bend-knot-edit', DRIVE_ACTIONS_PER_PATH, async () => {
					const action = await pointerGesture(
						sessionId,
						clientPoint(bend),
						clientPoint(oneGridStepAlong(snapToGrid(bend), [0, 1]))
					);
					const accepted = action.path === 'bend-knot-edit' && action.outcome === 'accepted';
					if (accepted) await restore();
					else await pointerTap(sessionId, selection);
					return { action, accepted };
				});
			});
		}

		report(`${fixture.id}: whole-room-move-bridge`);
		await captureS1Class(fixture, 'whole-room-move-bridge', async (sessionId) => {
			const roomCenter = targets.roomCenter;
			const moved = oneGridStepAlong(snapToGrid(roomCenter), [1, 0]);
			await repeatPath(sessionId, 'plan-drag-edit', DRIVE_ACTIONS_PER_PATH, async () => {
				const action = await pointerGesture(sessionId, clientPoint(roomCenter), clientPoint(moved));
				const accepted = action.path === 'plan-drag-edit' && action.outcome === 'accepted';
				if (accepted) await restore();
				return { action, accepted };
			});
		});

		report(`${fixture.id}: wall-authoring`);
		ensureTool('Wall');
		await captureS1Class(fixture, 'wall-authoring', async (sessionId) => {
			await repeatPath(sessionId, 'wall-authoring', DRIVE_ACTIONS_PER_PATH, async () => {
				await cancelPendingRun();
				let setup = await pointerTap(sessionId, clientPoint(targets.authoringFrom));
				if (setup.outcome === 'suppressed') setup = await pointerTap(sessionId, clientPoint(targets.authoringFrom));
				const commit = await pointerTap(sessionId, clientPoint(targets.authoringTo));
				const accepted = commit.path === 'wall-authoring' && commit.outcome === 'accepted';
				await restore();
				return { action: commit, accepted };
			});
		});

		report(`${fixture.id}: room-creation-commit`);
		ensureTool('Rect Room');
		await captureS1Class(fixture, 'room-creation-commit', async (sessionId) => {
			await repeatPath(sessionId, 'wall-authoring', DRIVE_ACTIONS_PER_PATH, async () => {
				const action = await pointerGesture(
					sessionId,
					clientPoint(targets.roomCreationFrom),
					clientPoint(targets.roomCreationTo),
					{ click: false }
				);
				const accepted = action.path === 'wall-authoring' && action.outcome === 'accepted';
				if (accepted) await restore();
				return { action, accepted };
			});
		});

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

	return { run, runP23B6S1, targetsFor, ladderPixelsPerMeter };
}
