/**
 * E3 / decomposition contract V — the mounted Stage's viewport and refresh
 * controller.
 *
 * The route composes the Stage; this controller owns the one measured rect, the
 * one Camera evaluation, the retained Plan/overlay views it drives and the one
 * animation-frame refresh loop that publishes them. It computes no pose and no
 * projection: `stage.camera.evaluate` (Camera) and the facade's Plan and
 * contribution reads remain the authorities, and this controller only measures
 * their input and publishes their output.
 *
 * **One loop for the mounted route.** `start()` installs exactly one scheduled
 * callback; `dispose()` stops rescheduling before the facade is disposed.
 * Preview pauses Stage evaluation by returning from the tick while keeping the
 * loop alive, exactly as the route's former inline loop did. A thrown adapter
 * contribution still reschedules from `finally`, so one bad contributor cannot
 * end the Stage's own refresh for the session.
 *
 * **Identity is retained, not recomputed.** A settled tick calls the repository's
 * unchanged `evaluate`, plan, overlay, guide, candidate and mark reads; those
 * return the previous object/array when their inputs are unchanged, so an idle
 * Stage publishes no new state and asks for no new render.
 *
 * A `.svelte.ts` controller is created in the route's effect scope. It accepts
 * typed reads/callbacks only; it never imports the route, acceptance, history or
 * a domain planner.
 */
import type { ViewportEvaluation, ViewportRect } from '@portfolio/camera-core';
import type { PlanEvaluation } from '@portfolio/layout-core';
import {
	perfMark,
	perfMarksEnabled,
	perfTracePreview,
	type PerfTracePreview
} from '$lib/platform/perf-marks';
import type {
	StageCandidatePreviewView,
	StageFacade,
	StageGhostMesh,
	StageGuideView,
	StageOverlayContribution
} from '../stage-facade';
import type { StageMarkView } from '../stage-handles';
import { projectRoomLabels, roomLabelFacts, type RoomLabelView } from '../room-labels';
import { stageEnvelope } from '../unit-stage-source';

/** A Stage-local Look-through capture frame, for the one renderer's scissor. */
export type StageFramedViewport = {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
};

export type StageFrameScheduler = {
	request(callback: FrameRequestCallback): number;
	cancel(handle: number): void;
};

export type StageViewportInput = {
	/** The mounted facade, or `null` before activation and after teardown. */
	readonly facade: () => StageFacade | null;
	readonly stageElement: () => HTMLElement | undefined;
	readonly throughFrameElement: () => HTMLElement | null;
	readonly lookThroughActive: () => boolean;
	/** The isolated visitor Preview owns the Camera output and unmounts the Canvas. */
	readonly previewing: () => boolean;
	readonly lens: () => 'world' | 'experience';
	/** The host's revealed source ids, as the Plan parameters read them. */
	readonly revealed: () => readonly string[];
	readonly roomLabels: () => { readonly plan: boolean; readonly threeD: boolean };
	readonly groundReachMeters: () => number | undefined;
	readonly nowSeconds: () => number;
	/** The existing Experience lens clock reads the route already used. */
	readonly advanceLookThroughZoom: (nowMilliseconds: number) => void;
	readonly advancePlayback: (nowMilliseconds: number) => void;
	/** Host-shell reads that must run on the same refresh, before the evaluation. */
	readonly onBeforeRefresh: () => void;
	/** Host-tool overlay projection, after the publication. */
	readonly onAfterRefresh: () => void;
	/** A deterministic scheduler in tests; the browser's rAF in production. */
	readonly scheduler?: StageFrameScheduler;
};

const browserScheduler: StageFrameScheduler = {
	request: (callback) => requestAnimationFrame(callback),
	cancel: (handle) => cancelAnimationFrame(handle)
};

function sameRect(left: ViewportRect, right: ViewportRect): boolean {
	return (
		left.left === right.left &&
		left.top === right.top &&
		left.width === right.width &&
		left.height === right.height &&
		left.devicePixelRatio === right.devicePixelRatio
	);
}

export function createStageViewport(input: StageViewportInput) {
	const scheduler = input.scheduler ?? browserScheduler;
	let evaluation = $state.raw<ViewportEvaluation | null>(null);
	let rect = $state.raw<ViewportRect | null>(null);
	let planView = $state.raw<PlanEvaluation | null>(null);
	let markers = $state.raw<readonly StageOverlayContribution[]>([]);
	let candidatePreviews = $state.raw<readonly StageCandidatePreviewView[]>([]);
	let guides = $state.raw<readonly StageGuideView[]>([]);
	let ghosts = $state.raw<readonly StageGhostMesh[]>([]);
	let roomLabels = $state.raw<readonly RoomLabelView[]>([]);
	let marks = $state.raw<readonly StageMarkView[]>([]);
	let framedViewport = $state.raw<StageFramedViewport | null>(null);
	let tracePreview = $state.raw<PerfTracePreview | null>(null);
	let planKey = '';
	let planParametersKey = '';
	let labelsKey = '';
	let lastOverlayKey = '';
	let frame: number | null = null;
	let started = false;
	let disposed = false;

	/** The one rect a pointer, the evaluation and the overlays all share. */
	function measure(): ViewportRect {
		const element = input.stageElement();
		const width = element?.clientWidth ?? 0;
		const height = element?.clientHeight ?? 0;
		const bounds = element?.getBoundingClientRect();
		return {
			left: bounds?.left ?? 0,
			top: bounds?.top ?? 0,
			width,
			height,
			devicePixelRatio: window.devicePixelRatio || 1
		};
	}

	/** The gold frame's content box: absolute for Camera, Stage-local for the scissor. */
	function measureThroughFrame():
		| { readonly absolute: ViewportRect; readonly local: StageFramedViewport }
		| null {
		const frameElement = input.throughFrameElement();
		if (input.stageElement() === undefined || frameElement === null) return null;
		const stageRect = rect ?? measure();
		const frameRect = frameElement.getBoundingClientRect();
		const width = frameRect.width;
		const height = frameRect.height;
		if (!(width > 0 && height > 0)) return null;
		const left = frameRect.left + frameElement.clientLeft;
		const top = frameRect.top + frameElement.clientTop;
		return {
			absolute: {
				left,
				top,
				width,
				height,
				devicePixelRatio: window.devicePixelRatio || 1
			},
			local: { left: left - stageRect.left, top: top - stageRect.top, width, height }
		};
	}

	function refresh(): void {
		input.advanceLookThroughZoom(performance.now());
		const stage = input.facade();
		if (stage === null) return;
		input.onBeforeRefresh();
		// Look through renders the real picture inside its 16:10 capture frame; the
		// same measured rect is both Camera's evaluation and the Canvas scissor.
		let currentRect = rect ?? measure();
		const framed = input.lookThroughActive() ? measureThroughFrame() : null;
		if (framed === null) {
			if (framedViewport !== null) framedViewport = null;
		} else {
			// Camera reads the capture frame's absolute viewport; the renderer's
			// scissor reads the same box in Stage-local coordinates. They are the
			// same capture frame in two spaces, never two different measurements.
			currentRect = framed.absolute;
			if (
				framedViewport === null ||
				framedViewport.left !== framed.local.left ||
				framedViewport.top !== framed.local.top ||
				framedViewport.width !== framed.local.width ||
				framedViewport.height !== framed.local.height
			) {
				framedViewport = framed.local;
			}
		}
		const result = stage.camera.evaluate(
			currentRect,
			input.nowSeconds(),
			input.groundReachMeters()
		);
		const nextEvaluation = result.kind === 'evaluated' ? result.evaluation : null;
		// An evaluation is immutable and its identity names the output generation.
		// Assigning the retained object again would re-render a Stage that did not
		// change; assign only a genuinely new evaluation.
		if (nextEvaluation !== evaluation) evaluation = nextEvaluation;
		if (nextEvaluation === null) return;

		// The Plan evaluation is recomputed only when it would actually differ, and
		// **the facade is the authority on that**, not this presenter.
		const parameters = { reveal: [...input.revealed()].sort() };
		const parametersKey =
			parameters.reveal.length === 0 ? '' : JSON.stringify(parameters.reveal);
		if (parametersKey !== planParametersKey) {
			planParametersKey = parametersKey;
			stage.setPlanParameters(parameters);
		}
		const key = stage.planDependencyKey();
		if (key !== planKey) {
			planKey = key;
			const planResult = stage.plan();
			const nextPlan = planResult.kind === 'evaluated' ? planResult.plan : null;
			if (nextPlan !== planView) planView = nextPlan;
		}

		// Overlays project through the *same* evaluation: adapter contributions and
		// the selection echo are CSS points from `projectWorld`, never a second
		// projection. The facade retains these arrays while their inputs are
		// unchanged, so a settled frame publishes the previous references.
		const nextMarkers = stage.overlays();
		if (nextMarkers !== markers) markers = nextMarkers;
		const nextCandidatePreviews = stage.candidatePreviews();
		if (nextCandidatePreviews !== candidatePreviews) candidatePreviews = nextCandidatePreviews;
		const nextGuides = stage.guides();
		if (nextGuides !== guides) guides = nextGuides;
		// The key is only evidence for the harness, so it must cost nothing in the
		// ordinary build: no string building or marker scan when the flag is absent.
		if (perfMarksEnabled()) {
			// Tenths of a CSS pixel: a slow drag moves a preview by less than one pixel
			// per sample, and a coarse key would make those presentations invisible.
			const overlayKey = nextMarkers
				.map(
					(marker) =>
						`${marker.id}:${Math.round(marker.css[0] * 10)},${Math.round(marker.css[1] * 10)}`
				)
				.join('|');
			if (overlayKey !== lastOverlayKey) {
				lastOverlayKey = overlayKey;
				tracePreview = perfTracePreview(nextMarkers);
				// The preview is presented by the frame that paints this overlay state; the
				// ledger's sequence says which input sample it belongs to.
				perfMark('overlay:updated', {
					markers: nextMarkers.length,
					preview: nextMarkers.some((marker) => marker.id.endsWith('-preview'))
				});
			}
		}
		const snapshot = stage.snapshot();
		const evaluationId = stage.evaluationId();
		// Room labels are a per-view ⚙ preference: on in 2D, off in 3D by default.
		const labelsShown =
			nextEvaluation.settledReading === 'plan'
				? input.roomLabels().plan
				: input.roomLabels().threeD;
		const nextLabelsKey = `${evaluationId ?? ''}|${input.lens()}|${labelsShown ? '1' : '0'}`;
		if (nextLabelsKey !== labelsKey) {
			labelsKey = nextLabelsKey;
			const nextLabels =
				evaluationId === null || input.lens() !== 'world' || !labelsShown
					? []
					: projectRoomLabels(
							roomLabelFacts(
								snapshot.domain.geometry,
								stageEnvelope(snapshot).units.layout.data.rooms
							),
							(point) => {
								const projected = stage.projectWorld(point, evaluationId);
								return projected.kind === 'projected' &&
									projected.visibility === 'visible' &&
									rect
									? [projected.css[0] - rect.left, projected.css[1] - rect.top]
									: null;
							},
							nextEvaluation.targetPlaneMetersPerCssPixel
						);
			if (nextLabels !== roomLabels) roomLabels = nextLabels;
		}
		const nextGhosts = stage.ghosts();
		if (nextGhosts !== ghosts) ghosts = nextGhosts;
		const nextMarks = stage.marks();
		if (nextMarks !== marks) marks = nextMarks;
		input.onAfterRefresh();
	}

	/** The one loop: measure, advance the lens clocks, publish. */
	function tick(): void {
		frame = null;
		if (disposed) return;
		try {
			// The isolated Preview owns the Camera output and the Stage's canvas is
			// unmounted: evaluating or refreshing an inspection view here would be a
			// second reader of an output this run no longer owns.
			if (input.previewing()) return;
			const element = input.stageElement();
			if (element !== undefined) {
				const next = measure();
				if (rect === null || !sameRect(rect, next)) rect = next;
			}
			input.advancePlayback(performance.now());
			refresh();
		} finally {
			// The next frame is scheduled in `finally`: one throwing adapter
			// contribution must not stop the Stage's own rendering for the rest of
			// the session. A disposed controller schedules nothing.
			if (!disposed) frame = scheduler.request(tick);
		}
	}

	return {
		get evaluation(): ViewportEvaluation | null {
			return evaluation;
		},
		get rect(): ViewportRect | null {
			return rect;
		},
		get planView(): PlanEvaluation | null {
			return planView;
		},
		get markers(): readonly StageOverlayContribution[] {
			return markers;
		},
		get candidatePreviews(): readonly StageCandidatePreviewView[] {
			return candidatePreviews;
		},
		get guides(): readonly StageGuideView[] {
			return guides;
		},
		get ghosts(): readonly StageGhostMesh[] {
			return ghosts;
		},
		get roomLabels(): readonly RoomLabelView[] {
			return roomLabels;
		},
		get marks(): readonly StageMarkView[] {
			return marks;
		},
		get framedViewport(): StageFramedViewport | null {
			return framedViewport;
		},
		get tracePreview(): PerfTracePreview | null {
			return tracePreview;
		},
		measure,
		refresh,
		/** Install the one frame loop. Idempotent; no-op after disposal. */
		start(): void {
			if (started || disposed) return;
			started = true;
			rect = measure();
			frame = scheduler.request(tick);
		},
		/** The Plan inputs changed outside the dependency key (an accepted source). */
		invalidatePlan(): void {
			planKey = '';
			planParametersKey = '';
		},
		/** Drop the host's view-dependent keys for a replaced source. */
		reset(): void {
			planView = null;
			planKey = '';
			planParametersKey = '';
			markers = [];
			marks = [];
			labelsKey = '';
		},
		/** Stop scheduling before the facade is disposed. Idempotent. */
		dispose(): void {
			disposed = true;
			if (frame !== null) {
				scheduler.cancel(frame);
				frame = null;
			}
		}
	};
}

export type StageViewport = ReturnType<typeof createStageViewport>;
