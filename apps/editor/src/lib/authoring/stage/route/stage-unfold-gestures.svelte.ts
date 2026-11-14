/**
 * X2 / decomposition contract U — Unfold gesture sessions.
 *
 * This controller owns the route-local captured operations on the developed
 * Wall sheet: the pin drag that slides the anchor and selects on a tap, the free
 * edge peel that scrubs the session amount, and the canonical Opening offset /
 * width edit. It reads the existing `wallUnfold` session and the layout-core
 * development maps; it owns neither geometry nor the Sheet.
 *
 * **One captured operation at a time.** Each session carries the pointer id that
 * captured it and refuses that press in the host's tracker, so a release can
 * neither select behind the sheet nor run the canonical Stage pick. Every ending
 * is explicit: `pointerUp` finishes, `pointerCancel` / `lostCapture` /
 * `interrupt` cancel, and a cancellation clears the display-only Opening preview.
 * The planner payload is the existing `buildLayoutIntent` request; acceptance
 * stays the route's F4 command through the supplied port.
 *
 * No Height Sheet numeric entry and no pin removal (issue #284) is added here.
 *
 * A `.svelte.ts` controller is created in the route's effect scope. It accepts
 * typed reads/callbacks only; it never imports the route, the acceptance host or
 * a renderer.
 */
import {
	pointerRay,
	type ViewportEvaluation,
	type ViewportRect
} from '@portfolio/camera-core';
import type { CompiledPhysicalWall } from '@portfolio/layout-core';
import type { AuthoringIntent } from '@portfolio/project-model';
import type { LayoutUnitPayload } from '@portfolio/project-model/units';
import {
	isStraightCompiledWall,
	wallUnfoldAnchor,
	wallUnfoldFreeEdgeStation,
	wallUnfoldSourceSpans,
	wallUnfoldTopPoint,
	chooseUnfoldAmount,
	snapWallUnfoldAmount,
	WALL_UNFOLD_EDGE_HIT_CSS,
	WALL_UNFOLD_EDGE_HIT_COARSE_CSS,
	WALL_UNFOLD_PIN_HIT_CSS,
	WALL_UNFOLD_PIN_HIT_COARSE_CSS,
	type WallUnfoldEdgeCandidate
} from '$lib/layout/wall-unfold';
import {
	buildWallUnfoldDisplay,
	evaluateWallUnfoldDisplay,
	pickWallUnfold,
	type WallUnfoldPick,
	unfoldDisplayPointAtStation
} from '$lib/layout/wall-unfold-pick';
import {
	mapSheetOpeningDrag,
	sheetOpeningModeFromEdges,
	type SheetOpeningMode
} from '$lib/layout/wall-unfold-opening-drag';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
import { buildLayoutIntent, LAYOUT_OPENING_MEASURE_KIND } from '$lib/authoring/adapters/layout/precision';
import { LAYOUT_OPENING_RESIZE_KIND } from '$lib/authoring/adapters/layout/opening-planners';
import { stageUnitRevision } from '../unit-stage-source';
import type { StageAdapterServices } from '../stage-adapter-host';
import type { StageFacade } from '../stage-facade';
import type { StageAcceptOutcome } from '../host-acceptance';
import type { StagePressTracker } from '../stage-input';
import type { StageTask } from '../stage-session';

export type UnfoldPinContext = {
	readonly wallId: string;
	readonly station: number;
	readonly point: readonly [number, number, number];
	readonly active: boolean;
};

export type UnfoldPinHit = { readonly css: readonly [number, number] };

export type StageSelectedCurvedWall = {
	readonly wall: CompiledPhysicalWall;
	readonly datumMeters: number;
	readonly defaultStation: number;
};

type SheetOpeningDrag = {
	readonly pointerId: number;
	readonly wallId: string;
	readonly openingId: string;
	readonly mode: SheetOpeningMode;
	readonly grabStation: number;
	readonly startOffset: number;
	readonly startWidth: number;
	readonly length: number;
	readonly closed: boolean;
	readonly pressX: number;
	readonly pressY: number;
	moved: boolean;
	previewOffset: number;
	previewWidth: number;
};

type SheetEdgeDrag = {
	readonly pointerId: number;
	readonly wallId: string;
	readonly pressY: number;
	readonly startU: number;
	/** Pointer minus the grabbed edge point at press, so the edge does not jump. */
	readonly grabOffset: readonly [number, number];
	readonly candidates: readonly WallUnfoldEdgeCandidate[];
};

type SheetPinDrag = {
	readonly pointerId: number;
	readonly wallId: string;
	readonly pressX: number;
	readonly pressY: number;
	moved: boolean;
	/** Only a press on the live sheet pin may select on release. */
	readonly activeAtPress: boolean;
};

export type StageUnfoldGesturesInput = {
	readonly facade: () => StageFacade | null;
	readonly evaluation: () => ViewportEvaluation | null;
	readonly rect: () => ViewportRect | null;
	readonly measure: () => ViewportRect;
	readonly stageElement: () => HTMLElement | undefined;
	/** The route's accepted Stage-local CSS mapping, shared with the arbiter. */
	readonly stageCss: (event: PointerEvent) => readonly [number, number];
	readonly layout: () => LayoutUnitPayload | null;
	readonly task: () => StageTask | null;
	readonly selectedCurvedWall: () => StageSelectedCurvedWall | null;
	readonly services: () => StageAdapterServices | null;
	readonly acceptOpening: (
		services: StageAdapterServices,
		intent: AuthoringIntent
	) => Promise<StageAcceptOutcome>;
	readonly selectSubject: (wallId: string, openingId: string | null) => void;
	readonly press: StagePressTracker;
	readonly capturePointer: (target: Element, pointerId: number) => boolean;
	readonly clearHover: () => void;
	readonly onNotice: (message: string) => void;
};

export type StageUnfoldGestures = ReturnType<typeof createStageUnfoldGestures>;

export function createStageUnfoldGestures(input: StageUnfoldGesturesInput) {
	let sheetOpeningDrag = $state.raw<SheetOpeningDrag | null>(null);
	let sheetEdgeDrag = $state.raw<SheetEdgeDrag | null>(null);
	let sheetPinDrag = $state.raw<SheetPinDrag | null>(null);
	let pinHovered = $state(false);

	/** The idle pin drawn before Unroll; the active sheet draws its own copy. */
	const idlePin = $derived.by<{
		readonly wallId: string;
		readonly station: number;
		readonly point: readonly [number, number, number];
	} | null>(() => {
		if (wallUnfold.state !== null) return null;
		const candidate = input.selectedCurvedWall();
		if (candidate === null) return null;
		const station = wallUnfold.anchorForWall(candidate.wall) ?? candidate.defaultStation;
		const point = wallUnfoldTopPoint(candidate.wall, station, candidate.datumMeters);
		return point === null ? null : { wallId: candidate.wall.wallId, station, point };
	});

	/** The one pin context shared by hover, press and rendering. */
	function pinContext(stage: StageFacade): UnfoldPinContext | null {
		const state = wallUnfold.state;
		if (state !== null) {
			const snapshot = stage.snapshot();
			const wall = snapshot.domain.geometry.walls.find((candidate) => candidate.wallId === state.wallId);
			if (wall === undefined) return null;
			const point = wallUnfoldTopPoint(wall, state.anchorStation, snapshot.domain.datumMeters);
			return point === null
				? null
				: { wallId: wall.wallId, station: state.anchorStation, point, active: true };
		}
		const candidate = input.selectedCurvedWall();
		if (candidate === null) return null;
		const station = wallUnfold.anchorForWall(candidate.wall) ?? candidate.defaultStation;
		const point = wallUnfoldTopPoint(candidate.wall, station, candidate.datumMeters);
		return point === null ? null : { wallId: candidate.wall.wallId, station, point, active: false };
	}

	function beginSheetPin(event: PointerEvent, wallId: string, activeAtPress: boolean): boolean {
		const stageEl = input.stageElement();
		// A failed capture still consumes the pin press: releasing it to navigation
		// or the canonical pick would make the same press mean two different things.
		if (stageEl === undefined || !input.capturePointer(stageEl, event.pointerId)) {
			input.press.refuse(event.pointerId);
			return true;
		}
		sheetPinDrag = {
			pointerId: event.pointerId,
			wallId,
			pressX: event.clientX,
			pressY: event.clientY,
			moved: false,
			activeAtPress
		};
		input.press.refuse(event.pointerId);
		return true;
	}

	/** The pin's Stage-local screen point, using the same canonical top point. */
	function pinAt(
		css: readonly [number, number],
		coarse: boolean,
		stage: StageFacade
	): UnfoldPinHit | null {
		const projectionId = stage.evaluationId();
		if (projectionId === null) return null;
		const pin = pinContext(stage);
		if (pin === null) return null;
		const projected = stage.projectWorld(
			[pin.point[0], pin.point[1], pin.point[2]],
			projectionId
		);
		if (projected.kind !== 'projected') return null;
		// `projectWorld` is viewport CSS; `sample.css` and edge picks are local to
		// the Stage. Normalise here so hover and press agree on the handle.
		const current = input.rect() ?? input.measure();
		const local: [number, number] = [projected.css[0] - current.left, projected.css[1] - current.top];
		const distance = Math.hypot(local[0] - css[0], local[1] - css[1]);
		const threshold = coarse ? WALL_UNFOLD_PIN_HIT_COARSE_CSS : WALL_UNFOLD_PIN_HIT_CSS;
		return distance <= threshold ? { css: local } : null;
	}

	/** Map a pointer sample onto the as-built centreline, for a pin drag. */
	function wallStationAtPointer(
		wall: CompiledPhysicalWall,
		datum: number,
		stage: StageFacade,
		event: PointerEvent
	): number | null {
		const projectionId = stage.evaluationId();
		if (projectionId === null || wall.samples.length < 2) return null;
		const height = datum + wall.height + 0.09;
		let nearest: number | null = null;
		let nearestDistance = Number.POSITIVE_INFINITY;
		for (let index = 0; index < wall.samples.length - 1; index += 1) {
			const from = wall.samples[index]!;
			const to = wall.samples[index + 1]!;
			const a = stage.projectWorld([from.point[0], height, from.point[1]], projectionId);
			const b = stage.projectWorld([to.point[0], height, to.point[1]], projectionId);
			if (a.kind !== 'projected' || b.kind !== 'projected') continue;
			const dx = b.css[0] - a.css[0];
			const dy = b.css[1] - a.css[1];
			const lengthSq = dx * dx + dy * dy;
			const t = lengthSq <= 1e-9
				? 0
				: Math.min(1, Math.max(0, ((event.clientX - a.css[0]) * dx + (event.clientY - a.css[1]) * dy) / lengthSq));
			const distance = Math.hypot(
				event.clientX - (a.css[0] + dx * t),
				event.clientY - (a.css[1] + dy * t)
			);
			if (distance < nearestDistance) {
				nearestDistance = distance;
				nearest = from.distance + (to.distance - from.distance) * t;
			}
		}
		return nearest;
	}

	/**
	 * C3 checkpoint 5 — the live unfolded press.
	 *
	 * The developed sheet is the addressed surface while unfolded, so a primary
	 * press is cast through the accepted Camera evaluation into the same
	 * checkpoint-4 display strip the Stage draws. The nearest positive hit is
	 * attributed to canonical Station/span/knot/face and selected through the
	 * route's ordinary selection state. This reads geometry and writes only
	 * selection/pick evidence: no document write, no edit, no undo entry.
	 */
	function pointerPress(event: PointerEvent): boolean {
		const stage = input.facade();
		const state = wallUnfold.state;
		const current = input.evaluation();
		const layout = input.layout();
		if (stage === null || current === null || layout === null || input.task() !== null) return false;
		if (state === null) {
			// Before Unroll the pin is the only developed-sheet gesture: it seeds the
			// anchor and never starts a peel.
			const pin = pinContext(stage);
			if (pin === null) return false;
			if (pinAt(input.stageCss(event), event.pointerType !== 'mouse', stage) === null) return false;
			return beginSheetPin(event, pin.wallId, false);
		}
		const snapshot = stage.snapshot();
		const wall = snapshot.domain.geometry.walls.find((candidate) => candidate.wallId === state.wallId);
		if (wall === undefined) return false;
		const spans = wallUnfoldSourceSpans(layout, wall.wallId, wall.length);
		const preview = wallUnfold.previewOpening;
		const displayWall = preview?.wallId === wall.wallId ? {
			...wall,
			openings: wall.openings.map((opening) => opening.openingId === preview.openingId
				? { ...opening, offset: preview.offset, width: preview.width }
				: opening)
		} : wall;
		const display = buildWallUnfoldDisplay(displayWall, state, {
			floorY: snapshot.domain.datumMeters,
			spans,
			sideAngle: wallUnfold.presentationAngle
		});
		if (display === null) return false;
		// The sheet pick wins when the ray lands on the developed Wall. The free
		// edge is only a peel target when the pick is empty; otherwise a press on
		// an Opening or Wall near the edge would become an accidental refold.
		const ray = pointerRay([event.clientX, event.clientY], current, current.token);
		const pick = ray.kind === 'ray' ? pickWallUnfold(display, ray.ray) : null;
		if (pick === null) {
			// Peel starts on the free edge, using the same development map. The
			// candidates are a display solve, not a second geometry authority. A short
			// screen path falls back to the bounded vertical mapping in `sheetEdgeMove`.
			const candidates = edgeCandidates(display, state, wall, stage);
			if (candidates.length >= 2) {
				const threshold = event.pointerType === 'mouse' ? WALL_UNFOLD_EDGE_HIT_CSS : WALL_UNFOLD_EDGE_HIT_COARSE_CSS;
				let nearest: WallUnfoldEdgeCandidate | null = null;
				let nearestDistance = Number.POSITIVE_INFINITY;
				for (const candidate of candidates) {
					const distance = Math.hypot(candidate.css[0] - event.clientX, candidate.css[1] - event.clientY);
					if (distance < nearestDistance) {
						nearest = candidate;
						nearestDistance = distance;
					}
				}
				if (nearest !== null && nearestDistance <= threshold) {
					// The peel consumes the press even if capture fails, so the failure
					// cannot leave a half-started edge drag behind or fall through to a pick.
					const stageEl = input.stageElement();
					if (stageEl === undefined || !input.capturePointer(stageEl, event.pointerId)) {
						input.press.refuse(event.pointerId);
						return true;
					}
					sheetEdgeDrag = {
						pointerId: event.pointerId,
						wallId: wall.wallId,
						pressY: event.clientY,
						startU: state.u,
						grabOffset: [event.clientX - nearest.css[0], event.clientY - nearest.css[1]],
						candidates
					};
					input.press.refuse(event.pointerId);
					return true;
				}
			}
		}
		// The pin is the next handle: press-and-release selects its Opening
		// (or the Wall on solid Wall); press-and-move slides the anchor along the
		// canonical centreline. It never moves the Camera or changes the face.
		const pin = pinContext(stage);
		if (pin !== null && pinAt(input.stageCss(event), event.pointerType !== 'mouse', stage) !== null) {
			return beginSheetPin(event, wall.wallId, true);
		}
		if (ray.kind !== 'ray' || pick === null) return false;
		wallUnfold.recordPick(pick, event.pointerId);
		input.selectSubject(wall.wallId, pick.openingId);
		// S5b — a press on an Opening void starts a canonical offset/width edit.
		// The jamb is chosen by the projected edge distance; the void's analytic
		// pick returns its centre, so edge proximity must be measured separately.
		const sourceOpening = pick.openingId === null ? undefined : layout.openings.find((opening) => opening.id === pick.openingId);
		const band = pick.openingId === null ? undefined : display.openingBands.find((candidate) => candidate.openingId === pick.openingId);
		if (sourceOpening !== undefined && band !== undefined && pick.openingId !== null) {
			// Measure each jamb at the height the pointer actually picked, not the
			// void's mid-height. On a tall Opening those are visibly different points.
			const height = snapshot.domain.datumMeters + Math.max(
				band.sillHeight,
				Math.min(band.headHeight, pick.height)
			);
			const projectionId = stage.evaluationId();
			const edgeAt = (station: number): number => {
				if (projectionId === null) return Infinity;
				// A station past a closed Wall's seam wraps to the drawn strip's other
				// end, where the crossing jamb is actually rendered; clamping would put
				// the hit test on the wrong side of the strip.
				const wrapped = display.development.closed
					? ((station % wall.length) + wall.length) % wall.length
					: station;
				const at = unfoldDisplayPointAtStation(display, wrapped, wallUnfold.presentationAngle);
				const projected = stage.projectWorld([at.point[0], height, at.point[1]], projectionId);
				return projected.kind === 'projected'
					? Math.hypot(projected.css[0] - event.clientX, projected.css[1] - event.clientY)
					: Infinity;
			};
			const mode = sheetOpeningModeFromEdges(edgeAt(band.stationStart), edgeAt(band.stationEnd));
			// A failed capture keeps the new Opening selection but installs no drag
			// preview, so there is no orphaned edit to strand the next press.
			const stageEl = input.stageElement();
			if (stageEl !== undefined && input.capturePointer(stageEl, event.pointerId)) {
				sheetOpeningDrag = {
					pointerId: event.pointerId,
					wallId: wall.wallId,
					openingId: pick.openingId,
					mode,
					grabStation: mode === 'left' ? band.stationStart : mode === 'right' ? band.stationEnd : pick.station,
					startOffset: sourceOpening.offset,
					startWidth: sourceOpening.width,
					length: wall.length,
					closed: display.development.closed,
					pressX: event.clientX,
					pressY: event.clientY,
					moved: false,
					previewOffset: sourceOpening.offset,
					previewWidth: sourceOpening.width
				};
				wallUnfold.setOpeningPreview({ wallId: wall.wallId, openingId: pick.openingId, offset: sourceOpening.offset, width: sourceOpening.width });
			} else {
				sheetOpeningDrag = null;
				wallUnfold.setOpeningPreview(null);
			}
		}
		// The press is consumed: its release must not run the canonical Stage pick.
		input.press.refuse(event.pointerId);
		return true;
	}

	/** Sample the free edge across the peel range, then restore the live display. */
	function edgeCandidates(
		display: ReturnType<typeof buildWallUnfoldDisplay>,
		state: NonNullable<typeof wallUnfold.state>,
		wall: CompiledPhysicalWall,
		stage: StageFacade
	): WallUnfoldEdgeCandidate[] {
		if (display === null) return [];
		const projectionId = stage.evaluationId();
		if (projectionId === null) return [];
		const station = wallUnfoldFreeEdgeStation(state, wall.length);
		const candidates: WallUnfoldEdgeCandidate[] = [];
		for (let step = 0; step <= 40; step += 1) {
			const u = step / 40;
			evaluateWallUnfoldDisplay(display, { ...state, u }, wallUnfold.presentationAngle);
			const at = unfoldDisplayPointAtStation(display, station, wallUnfold.presentationAngle);
			const projected = stage.projectWorld(
				[at.point[0], display.floorY + display.height / 2, at.point[1]],
				projectionId
			);
			if (projected.kind === 'projected') {
				candidates.push({ u, css: [projected.css[0], projected.css[1]] });
			}
		}
		evaluateWallUnfoldDisplay(display, state, wallUnfold.presentationAngle);
		return candidates;
	}

	function sheetEdgeMove(event: PointerEvent): void {
		const active = sheetEdgeDrag;
		const state = wallUnfold.state;
		const stage = input.facade();
		if (active === null || active.pointerId !== event.pointerId || state === null || stage === null) return;
		const wall = stage.snapshot().domain.geometry.walls.find((candidate) => candidate.wallId === active.wallId);
		if (wall === undefined) return;
		const chosen = chooseUnfoldAmount({
			candidates: active.candidates,
			pointer: [event.clientX, event.clientY],
			currentU: state.u,
			grabOffset: active.grabOffset
		});
		const next = chosen ?? Math.min(
			1,
			Math.max(0, active.startU - (event.clientY - active.grabOffset[1] - active.pressY) / 260)
		);
		wallUnfold.setU(wall, next);
	}

	function finishSheetEdge(): void {
		const active = sheetEdgeDrag;
		const state = wallUnfold.state;
		const stage = input.facade();
		sheetEdgeDrag = null;
		if (active === null || state === null || stage === null) return;
		const wall = stage.snapshot().domain.geometry.walls.find((candidate) => candidate.wallId === active.wallId);
		if (wall !== undefined) wallUnfold.setU(wall, snapWallUnfoldAmount(state.u));
	}

	function cancelSheetEdge(): void {
		sheetEdgeDrag = null;
	}

	function sheetPinMove(event: PointerEvent): void {
		const active = sheetPinDrag;
		const stage = input.facade();
		if (active === null || active.pointerId !== event.pointerId || stage === null) return;
		if (!active.moved) {
			if (Math.hypot(event.clientX - active.pressX, event.clientY - active.pressY) < 3) return;
			active.moved = true;
			pinHovered = false;
		}
		const snapshot = stage.snapshot();
		const wall = snapshot.domain.geometry.walls.find((candidate) => candidate.wallId === active.wallId);
		if (wall === undefined) return;
		const station = wallStationAtPointer(wall, snapshot.domain.datumMeters, stage, event);
		if (station !== null) wallUnfold.setAnchor(wall, station);
	}

	function finishSheetPin(): void {
		const active = sheetPinDrag;
		sheetPinDrag = null;
		if (active === null) return;
		if (!active.moved && active.activeAtPress) input.selectSubject(active.wallId, wallUnfold.pinnedOpeningId);
		input.clearHover();
	}

	function cancelSheetPin(): void {
		sheetPinDrag = null;
	}

	function sheetOpeningMove(event: PointerEvent): void {
		const active = sheetOpeningDrag;
		const stage = input.facade();
		const current = input.evaluation();
		const layout = input.layout();
		const state = wallUnfold.state;
		if (active === null || active.pointerId !== event.pointerId || stage === null || current === null || layout === null || state === null) return;
		const snapshot = stage.snapshot();
		const wall = snapshot.domain.geometry.walls.find((candidate) => candidate.wallId === active.wallId);
		if (wall === undefined) return;
		const preview = wallUnfold.previewOpening;
		const displayWall = preview?.wallId === wall.wallId ? {
			...wall,
			openings: wall.openings.map((opening) => opening.openingId === preview.openingId
				? { ...opening, offset: preview.offset, width: preview.width }
				: opening)
		} : wall;
		const display = buildWallUnfoldDisplay(displayWall, state, {
			floorY: snapshot.domain.datumMeters,
			spans: wallUnfoldSourceSpans(layout, wall.wallId, wall.length),
			sideAngle: wallUnfold.presentationAngle
		});
		if (display === null) return;
		const ray = pointerRay([event.clientX, event.clientY], current, current.token);
		if (ray.kind !== 'ray') return;
		const pick = pickWallUnfold(display, ray.ray);
		if (pick === null) return;
		// A press without travel is a click, not an edit: leave the preview at the
		// canonical values so release commits nothing and the selection stands.
		if (!active.moved && Math.hypot(event.clientX - active.pressX, event.clientY - active.pressY) <= 3) return;
		active.moved = true;
		const edit = mapSheetOpeningDrag({
			mode: active.mode,
			startOffset: active.startOffset,
			startWidth: active.startWidth,
			grabStation: active.grabStation,
			pointerStation: pick.station,
			length: active.length,
			closed: active.closed
		});
		active.previewOffset = edit.offset;
		active.previewWidth = edit.width;
		wallUnfold.setOpeningPreview({ wallId: active.wallId, openingId: active.openingId, offset: edit.offset, width: edit.width });
	}

	async function finishSheetOpening(event: PointerEvent): Promise<void> {
		const active = sheetOpeningDrag;
		if (active === null || active.pointerId !== event.pointerId) return;
		sheetOpeningDrag = null;
		// An unmoved press selected the Opening at press time; it owes no edit.
		if (!active.moved) {
			wallUnfold.setOpeningPreview(null);
			return;
		}
		const services = input.services();
		const stage = input.facade();
		if (services === null || stage === null) { wallUnfold.setOpeningPreview(null); return; }
		const snapshot = stage.snapshot();
		// A jamb drag previews both fields. The left edge therefore commits through
		// the coupled resize planner (fixed right edge), not a width-only measure.
		const edge = active.mode === 'left' ? 'left' as const : 'right' as const;
		const value = edge === 'left'
			? active.previewOffset
			: active.previewOffset + active.previewWidth;
		const target = {
			version: 1 as const,
			domain: 'layout' as const,
			subject: { kind: 'opening' as const, id: active.openingId },
			revision: { kind: 'exact' as const, contentRevision: stageUnitRevision(snapshot, 'layout') },
			instancePath: [] as const,
			location: {
				kind: 'layout-location' as const,
				levelId: snapshot.domain.layoutLevelId,
				structureInstancePath: [] as const
			},
			componentId: null,
			capabilityId: null
		};
		const request = {
			operationId: globalThis.crypto.randomUUID(),
			projectId: snapshot.acceptedRevision.projectId,
			revisionId: services.authoring.acceptedRevision().revisionId,
			contentRevision: stageUnitRevision(snapshot, 'layout'),
			levelId: snapshot.domain.layoutLevelId,
			targets: [target]
		};
		const outcome = active.mode === 'slide'
			? await input.acceptOpening(services, buildLayoutIntent({
				...request,
				kind: LAYOUT_OPENING_MEASURE_KIND,
				payload: { openingId: active.openingId, field: 'offset', value: active.previewOffset }
			}))
			: await input.acceptOpening(services, buildLayoutIntent({
				...request,
				kind: LAYOUT_OPENING_RESIZE_KIND,
				payload: { openingId: active.openingId, kind: 'edge', edge, value }
			}));
		if (input.services() === services && outcome.kind === 'refused') input.onNotice(outcome.message);
		wallUnfold.setOpeningPreview(null);
		stage.notifySurfaceChange();
	}

	function cancelSheetOpening(): void {
		if (sheetOpeningDrag === null) return;
		sheetOpeningDrag = null;
		wallUnfold.setOpeningPreview(null);
	}

	/** The arbiter's move branch; `true` means an Unfold session consumed the sample. */
	function pointerMove(event: PointerEvent): boolean {
		if (sheetPinDrag !== null) {
			if (event.pointerId === sheetPinDrag.pointerId) sheetPinMove(event);
			return true;
		}
		if (sheetEdgeDrag !== null) {
			if (event.pointerId === sheetEdgeDrag.pointerId) sheetEdgeMove(event);
			return true;
		}
		if (sheetOpeningDrag !== null) {
			if (event.pointerId === sheetOpeningDrag.pointerId) sheetOpeningMove(event);
			return true;
		}
		return false;
	}

	function pointerUp(event: PointerEvent): boolean {
		if (sheetPinDrag !== null && event.pointerId === sheetPinDrag.pointerId) {
			finishSheetPin();
			return true;
		}
		if (sheetEdgeDrag !== null && event.pointerId === sheetEdgeDrag.pointerId) {
			finishSheetEdge();
			return true;
		}
		if (sheetOpeningDrag !== null && event.pointerId === sheetOpeningDrag.pointerId) {
			void finishSheetOpening(event);
			return true;
		}
		return false;
	}

	function pointerCancel(event: PointerEvent): boolean {
		if (sheetPinDrag !== null && event.pointerId === sheetPinDrag.pointerId) {
			cancelSheetPin();
			input.clearHover();
			return true;
		}
		if (sheetEdgeDrag !== null && event.pointerId === sheetEdgeDrag.pointerId) {
			cancelSheetEdge();
			return true;
		}
		if (sheetOpeningDrag !== null && event.pointerId === sheetOpeningDrag.pointerId) {
			cancelSheetOpening();
			return true;
		}
		return false;
	}

	function lostCapture(event: PointerEvent): boolean {
		if (sheetPinDrag !== null && event.pointerId === sheetPinDrag.pointerId) {
			cancelSheetPin();
			input.clearHover();
			return true;
		}
		if (sheetEdgeDrag !== null && event.pointerId === sheetEdgeDrag.pointerId) {
			cancelSheetEdge();
			return true;
		}
		if (sheetOpeningDrag !== null && event.pointerId === sheetOpeningDrag.pointerId) {
			cancelSheetOpening();
			return true;
		}
		return false;
	}

	/** The host interruption: cancel the captured sheet operation, if any. */
	function interrupt(): boolean {
		if (sheetPinDrag !== null) {
			cancelSheetPin();
			input.clearHover();
			return true;
		}
		if (sheetEdgeDrag !== null) {
			cancelSheetEdge();
			input.clearHover();
			return true;
		}
		if (sheetOpeningDrag !== null) {
			cancelSheetOpening();
			input.clearHover();
			return true;
		}
		return false;
	}

	return {
		/** The developed sheet owns the Stage surface while it is unfolded. */
		get active(): boolean {
			return wallUnfold.state !== null;
		},
		get pinHovered(): boolean {
			return pinHovered;
		},
		get sheetPinActive(): boolean {
			return sheetPinDrag !== null;
		},
		get idlePin() {
			return idlePin;
		},
		setPinHovered(value: boolean): void {
			pinHovered = value;
		},
		pinContext,
		pinAt,
		pointerPress,
		pointerMove,
		pointerUp,
		pointerCancel,
		lostCapture,
		interrupt,
		dispose(): void {
			cancelSheetPin();
			cancelSheetEdge();
			cancelSheetOpening();
			// The preview belongs to the module-level Unfold store, so clear it even
			// when a previous cleanup already dropped the drag. This keeps repeated
			// disposal harmless and prevents an orphaned display-only Opening.
			wallUnfold.setOpeningPreview(null);
		}
	};
}

/** Whether the selected Wall is curved; `null` leaves no idle pin. */
export function selectedCurvedWallOf(
	selection: { readonly reference: { readonly domain: string; readonly subject: { readonly kind: string; readonly id: string } } } | null,
	geometry: { readonly walls: readonly CompiledPhysicalWall[] },
	datumMeters: number,
	viewTarget: readonly [number, number, number] | null,
	viewCentreStation: (wall: CompiledPhysicalWall, target: readonly [number, number, number]) => number | null
): StageSelectedCurvedWall | null {
	if (
		selection === null ||
		selection.reference.domain !== 'layout' ||
		selection.reference.subject.kind !== 'wall'
	) return null;
	const wall = geometry.walls.find((candidate) => candidate.wallId === selection.reference.subject.id);
	if (wall === undefined || isStraightCompiledWall(wall)) return null;
	const viewCentre = viewTarget === null ? null : viewCentreStation(wall, viewTarget);
	return {
		wall,
		datumMeters,
		defaultStation: wallUnfoldAnchor({ wall, pinStation: viewCentre })
	};
}
