/**
 * X2 / decomposition contract G — the mounted Stage's one input arbiter.
 *
 * This controller owns the route's pointer, click, wheel, hover and interruption
 * dispatch. The **one** precedence order is preserved:
 *
 * 1. a second pointer hands off to the Experience posture's pinch, otherwise the
 *    first press is interrupted and navigation-owned pinch begins;
 * 2. the developed Unfold sheet (contract U) addresses primary presses;
 * 3. the active Experience posture;
 * 4. armed host tools (Measure / Eraser);
 * 5. specialized marks — a disclosure, then an adapter-claimed mark;
 * 6. adapters' idle/direct-manipulation intent;
 * 7. Stage navigation (pan / orbit) with its own gesture lease.
 *
 * Hover resolves once per frame and applies the same tiering. The press tracker
 * is the one drag-versus-click authority: a release ends the gesture but the
 * following click is still judged by distance, and every interruption refuses
 * that click. `pointercancel`, lost capture, Escape, blur, a hidden document, a
 * lens/reading change, replacement and unmount use the same interruption path.
 *
 * The controller is a dispatcher, not a second domain owner. It calls the
 * existing facade/adapter/session commands, the Unfold and Artwork controllers,
 * and the route's existing navigation commands. It implements no planner, no
 * acceptance write and no renderer resource.
 *
 * A `.svelte.ts` controller is created in the route's effect scope. It accepts
 * typed reads/callbacks only; it never imports the route, the acceptance host or
 * a domain planner.
 */
import type { ViewingIntent, ViewportEvaluation, ViewportRect } from '@portfolio/camera-core';
import type { PlanEvaluation } from '@portfolio/layout-core';
import {
	perfInput,
	perfMark,
	perfMarksEnabled
} from '$lib/platform/perf-marks';
import type { StagePostureLayer, StagePostureMark } from '../stage-adapter-host';
import type {
	StageFacade,
	StageIntentResult,
	StageSourceHit
} from '../stage-facade';
import type { StageSession, StageTask } from '../stage-session';
import type { StageMeasureController } from '../stage-measure';
import type { StageEraserController } from '../stage-eraser';
import { stageResizeCursorCss } from '../stage-glyphs';
import {
	layoutSelectionReference,
	primaryEntry,
	sameReference,
	type StageSelectionEntry
} from '../semantic-selection';
import { isStageDrag, type StagePressTracker } from '../stage-input';
import { stageWheelZoom } from '../stage-wheel-zoom';
import type { StageInterruptionReason } from '../stage-interruption';
import type { ScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import type { StageArtworkInteraction } from './stage-artwork-interaction.svelte';
import type { StageUnfoldGestures } from './stage-unfold-gestures.svelte';

export type StageInputArbiterInput = {
	readonly facade: () => StageFacade | null;
	readonly evaluation: () => ViewportEvaluation | null;
	readonly rect: () => ViewportRect | null;
	readonly measure: () => ViewportRect;
	readonly stageElement: () => HTMLElement | undefined;
	readonly session: StageSession;
	readonly activeLayer: () => StagePostureLayer | null;
	readonly artwork: StageArtworkInteraction;
	readonly unfold: StageUnfoldGestures;
	readonly stageCss: (event: PointerEvent) => readonly [number, number];
	readonly capturePointer: (target: Element, pointerId: number) => boolean;
	readonly press: StagePressTracker;
	readonly armedHostTool: () => string | null;
	readonly measureTool: () => StageMeasureController | null;
	readonly eraserTool: () => StageEraserController | null;
	readonly task: () => StageTask | null;
	readonly dockToolArmed: () => boolean;
	readonly planView: () => PlanEvaluation | null;
	readonly previewing: () => boolean;
	readonly pick: ScenePickSource['pick'];
	readonly viewMarkAt: (event: MouseEvent) => StagePostureMark | null;
	readonly eraseHover: () => StageSelectionEntry | null;
	readonly setEraseHover: (entry: StageSelectionEntry | null) => void;
	readonly onNotice: (message: string) => void;
	readonly onRefreshHostTools: () => void;
	readonly selectHit: (hit: StageSourceHit) => void;
	readonly pan: (dx: number, dy: number) => void;
	readonly orbit: (dAzimuth: number, dElevation: number) => void;
	readonly zoom: (scale: number) => void;
	readonly submit: (intent: ViewingIntent, clockSeconds: number) => StageIntentResult | null;
	readonly nowSeconds: () => number;
};

export type StageInputArbiter = ReturnType<typeof createStageInputArbiter>;

export function createStageInputArbiter(input: StageInputArbiterInput) {
	let drag = $state<{ x: number; y: number; mode: 'pan' | 'orbit' | 'adapter' | 'host' } | null>(null);
	let hoverSelection = $state<StageSelectionEntry | null>(null);
	let hoverMove = $state(false);
	let stageCursor = $state<string | null>(null);

	let adapterMarkPress = false;
	let disclosurePress: { readonly id: string; readonly x: number; readonly y: number } | null = null;
	/**
	 * The evaluation a claimed adapter press was measured in.
	 *
	 * The Camera raises a new evaluation generation every frame, so reading
	 * `evaluationId()` again on each move would tell the adapter its projection had
	 * changed on every sample: a drag would pause on its first move and a release
	 * would look stale, making direct manipulation unreachable. `StagePointerIntent`
	 * names *the evaluation the press was measured in*, so this one value is carried
	 * from the claimed down through every later phase of that press and cleared with
	 * it. A genuine reading change still ends the drag through the gesture lease's
	 * `cancel-on-reading-change` policy.
	 */
	let adapterEvaluationId: string | null = null;
	let pinch: Map<number, [number, number]> | null = null;
	let hoverFrame: number | null = null;
	let hoverSample: { css: [number, number]; shift: boolean; coarse: boolean } | null = null;

	/**
	 * End the live gesture exactly once.
	 *
	 * Release is idempotent, so every ending can call this without a second cancel
	 * of a lease that was already ended by the host's own policy run. It ends the
	 * **gesture** only: a normal pointer up still owes the following click its
	 * drag-versus-click decision, which is why the press tracker is not touched here.
	 */
	function endPinch(): void {
		const ending = pinch;
		pinch = null;
		if (ending === null) return;
		for (const id of ending.keys()) {
			input.press.refuse(id);
			const stageEl = input.stageElement();
			if (stageEl?.hasPointerCapture?.(id)) stageEl.releasePointerCapture(id);
		}
		input.session.gesture()?.release();
	}

	function endGesture(): void {
		drag = null;
		adapterEvaluationId = null;
		adapterMarkPress = false;
		disclosurePress = null;
		input.session.gesture()?.release();
	}

	/**
	 * End the gesture **and** refuse the click that may still arrive.
	 *
	 * Pointer cancel, a capture lost while the pointer is down, Escape and a policy
	 * cancel all mean the creator did not finish this press, so nothing it would
	 * select is theirs to select.
	 */
	function abortGesture(): void {
		input.press.abort();
		endPinch();
		endGesture();
	}

	function clearHover(): void {
		if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
		hoverFrame = null;
		hoverSample = null;
		input.unfold.setPinHovered(false);
		input.facade()?.setMarkHover(null);
		stageCursor = null;
		input.session.setHover(null);
		hoverSelection = null;
		hoverMove = false;
		if (drag?.mode !== 'host') {
			input.measureTool()?.hover(null);
			input.eraserTool()?.hover(null);
			input.setEraseHover(null);
		}
	}

	function resolveHover(): void {
		hoverFrame = null;
		const sample = hoverSample;
		hoverSample = null;
		const stage = input.facade();
		const id = stage?.evaluationId() ?? null;
		if (sample === null || stage === null || id === null || input.session.gesture() !== null || drag !== null) return;
		stageCursor = null;
		// An armed host tool previews its own winner (the Eraser's dashes, Measure's
		// second point); the ordinary subject hover would compete with it.
		const armedHostTool = input.armedHostTool();
		if (armedHostTool !== null) {
			stage.idleHoverIntent({ phase: 'cancel', css: sample.css, evaluationId: id, coarse: sample.coarse, shift: sample.shift });
			const toolInput = { css: sample.css, evaluationId: id, coarse: sample.coarse };
			if (armedHostTool === 'measure') input.measureTool()?.hover(toolInput);
			else input.eraserTool()?.hover(toolInput);
			input.session.setHover(null);
			hoverSelection = null;
			hoverMove = false;
			input.onRefreshHostTools();
			return;
		}
		// The pin is the sheet's one display handle. It sits above the sheet pick
		// so a tap can select its Opening and a drag can move the anchor without
		// selecting the Wall body underneath.
		if (input.unfold.pinAt(sample.css, sample.coarse, stage) !== null) {
			stage.idleHoverIntent({ phase: 'cancel', css: sample.css, evaluationId: id, coarse: sample.coarse, shift: sample.shift });
			stage.setMarkHover(null);
			input.session.setHover(null);
			hoverSelection = null;
			hoverMove = false;
			input.unfold.setPinHovered(true);
			stageCursor = 'grab';
			return;
		}
		input.unfold.setPinHovered(false);
		// The mark tier is above world candidates: a hovered grip suppresses the
		// subject tint underneath, so two emphases never compete for one pointer.
		const mark = stage.hitMark({ css: sample.css, coarse: sample.coarse });
		if (mark !== null) {
			stage.idleHoverIntent({ phase: 'cancel', css: sample.css, evaluationId: id, coarse: sample.coarse, shift: sample.shift });
			stage.setMarkHover({ adapterId: mark.adapterId, id: mark.id });
			stageCursor = mark.mark.resizeCursor === undefined
				? null
				: stageResizeCursorCss(mark.mark.resizeCursor, mark.mark.direction);
			input.session.setHover(null);
			hoverSelection = null;
			// R217.S15 — a selected Wall's own grips are draggable; every other
			// mark (an Opening's track, a disclosure) is not a body move.
			const primary = primaryEntry(stage.selectionState());
			hoverMove =
				primary !== null &&
				primary.reference.domain === 'layout' &&
				primary.reference.subject.kind === 'wall' &&
				mark.adapterId === 'layout' &&
				mark.id.startsWith('layout-wall-') &&
				mark.id !== 'layout-wall-preview';
			return;
		}
		stage.setMarkHover(null);
		stageCursor = null;
		const idleMark = stage.idleHoverIntent({ phase: 'move', css: sample.css, evaluationId: id, coarse: sample.coarse, shift: sample.shift });
		if (idleMark !== null) {
			stage.setMarkHover({ adapterId: idleMark.adapterId, id: idleMark.id });
			input.session.setHover(null);
			hoverSelection = null;
			hoverMove = true;
			return;
		}
		stage.idleHoverIntent({ phase: 'cancel', css: sample.css, evaluationId: id, coarse: sample.coarse, shift: sample.shift });
		if (stage.hoverIntent({ phase: 'move', css: sample.css, evaluationId: id, shift: sample.shift })) {
			input.session.setHover(null);
			hoverSelection = null;
			hoverMove = false;
			return;
		}
		const result = stage.resolvePick({ css: sample.css, evaluationId: id, purpose: 'hover', tool: null });
		if (result.kind !== 'resolved') {
			input.session.setHover(null);
			hoverSelection = null;
			hoverMove = false;
			return;
		}
		const hit = result.hit;
		const representation = hit.reference === undefined
			? { sourceId: hit.sourceId, sourceKind: hit.sourceKind, generationId: hit.generationId, stream: hit.stream, subRef: hit.subRef }
			: undefined;
		const reference = hit.reference ?? layoutSelectionReference(representation!, stage.snapshot());
		input.session.setHover({ reference });
		const primary = primaryEntry(stage.selectionState());
		// R217.S15 — the pick winner is the selected Wall itself, so a press here
		// would be claimed as its body drag. Select keeps the host Wall first until
		// S16 makes an Opening over it its own winner.
		hoverMove =
			primary !== null &&
			primary.reference.domain === 'layout' &&
			primary.reference.subject.kind === 'wall' &&
			hit.sourceKind === 'wall' &&
			hit.sourceId === primary.reference.subject.id;
		const nextHover =
			primary !== null && sameReference(primary.reference, reference)
				? null
				: representation === undefined
					? { reference }
					: { reference, representation };
		// Identity, not object identity: a pointer moving within one subject must not
		// rebuild the Stage's ink every frame.
		if (nextHover === null) hoverSelection = null;
		else if (hoverSelection === null || !sameReference(hoverSelection.reference, nextHover.reference)) hoverSelection = nextHover;
	}

	/** End the captured press without ending an independent multi-step proposal. */
	function interrupt(reason: StageInterruptionReason): void {
		if (input.unfold.interrupt()) return;
		if (input.activeLayer()?.interrupt?.() === 'claimed') return;
		if (pinch !== null) { endPinch(); clearHover(); return; }
		const pointerId = input.press.owner();
		if (pointerId === null || drag === null) { clearHover(); return; }
		perfMark('input:interruption', { reason });
		if (drag.mode === 'adapter') {
			const id = adapterEvaluationId ?? input.facade()?.evaluationId() ?? null;
			const currentRect = input.rect();
			const css: [number, number] = [drag.x - (currentRect?.left ?? 0), drag.y - (currentRect?.top ?? 0)];
			if (id !== null) input.facade()?.pointerIntent({ phase: 'cancel', css, evaluationId: id });
		}
		if (drag.mode === 'host') {
			input.measureTool()?.cancel();
			input.eraserTool()?.cancel();
			input.onRefreshHostTools();
		}
		abortGesture();
		clearHover();
		const stageEl = input.stageElement();
		if (reason !== 'second-pointer' && stageEl?.hasPointerCapture?.(pointerId)) stageEl.releasePointerCapture(pointerId);
	}

	function pointerDown(event: PointerEvent): void {
		const stage = input.facade();
		if (stage === null || input.evaluation() === null) return;
		clearHover();
		const firstId = input.press.owner();
		if (firstId !== null && firstId !== event.pointerId && drag !== null) {
			if (input.activeLayer()?.pinch(event) === 'claimed') return;
			const first: [number, number] = [drag.x, drag.y];
			interrupt('second-pointer');
			input.press.refuse(firstId); input.press.refuse(event.pointerId);
			const acquisition = stage.acquireGesture({ owner: 'stage-pinch', evaluationId: stage.evaluationId() ?? '', policy: 'continue-after-revalidation', navigation: true });
			if (acquisition.kind === 'granted') {
				pinch = new Map([[firstId, first], [event.pointerId, [event.clientX, event.clientY]]]);
				const surface = event.currentTarget as HTMLElement;
				// A pointer may already have ended.
				try { surface.setPointerCapture(event.pointerId); } catch { /* captured elsewhere */ }
			} else {
				const stageEl = input.stageElement();
				if (stageEl?.hasPointerCapture?.(firstId)) stageEl.releasePointerCapture(firstId);
			}
			return;
		}
		if (pinch !== null) { input.press.refuse(event.pointerId); return; }
		// Primary, unmodified presses address the developed sheet while a Wall is
		// unfolded. Shift/secondary presses stay navigation, which is how the
		// creator can still orbit the sheet.
		if (event.button === 0 && !event.shiftKey && input.unfold.pointerPress(event)) return;
		if (input.activeLayer()?.pointerDown(event, input.viewMarkAt(event)) === 'claimed') return;
		// The adapters get the press first: the binding that owns an open task (a
		// Scene transform, an armed Ink chain) may claim it, and so may a binding
		// that offers direct manipulation with no task at all (a selected Wall's
		// handles). Only a refusal falls through to navigation.
		const pointerEvaluationId = stage.evaluationId();
		if (pointerEvaluationId !== null) {
			const css = input.stageCss(event);
			const coarse = event.pointerType !== 'mouse';
			// R217.S10: an armed host tool asks every declaring domain for its winner.
			// A press that names nothing to measure or erase stays the host's navigation.
			const armedHostTool = input.armedHostTool();
			const hostTool = armedHostTool === 'measure' ? input.measureTool() : armedHostTool === 'erase' ? input.eraserTool() : null;
			if (hostTool !== null) {
				const claimed = hostTool.down({ css, evaluationId: pointerEvaluationId, coarse });
				input.onRefreshHostTools();
				if (claimed) {
					if (!input.capturePointer(event.currentTarget as HTMLElement, event.pointerId)) {
						hostTool.cancel();
						input.onRefreshHostTools();
						return;
					}
					if (input.press.begin({ x: event.clientX, y: event.clientY }, event.pointerId) === 'refused') {
						hostTool.cancel();
						input.onRefreshHostTools();
						return;
					}
					adapterEvaluationId = pointerEvaluationId;
					drag = { x: event.clientX, y: event.clientY, mode: 'host' };
					return;
				}
			}
			const mark = stage.hitMark({ css, coarse });
			// A disclosure is a press, not a drag: it reveals grips while the same
			// gesture context stays selected, and no adapter may claim the pointer for it.
			if (mark?.role === 'disclose' && mark.mark.drags !== true) {
				input.press.refuse(event.pointerId);
				if (stage.activateDisclosure(mark.id)) stage.notifySurfaceChange();
				return;
			}
			const claimAdapterPress = (handleId?: string, handleAdapterId?: string): boolean => {
				const claimed = stage.pointerIntent({
					phase: 'down',
					css,
					evaluationId: pointerEvaluationId,
					shift: event.shiftKey,
					metaKey: event.metaKey,
					ctrlKey: event.ctrlKey,
					coarse,
					...(handleId === undefined ? {} : { handleId }),
					...(handleAdapterId === undefined ? {} : { handleAdapterId })
				}).claimed;
				if (!claimed) return false;
				const captured = input.capturePointer(event.currentTarget as HTMLElement, event.pointerId);
				const began = captured ? input.press.begin({ x: event.clientX, y: event.clientY }, event.pointerId) : null;
				if (!captured || began === 'refused') {
					stage.pointerIntent({ phase: 'cancel', css, evaluationId: pointerEvaluationId, shift: event.shiftKey, coarse });
					return true;
				}
				adapterEvaluationId = pointerEvaluationId;
				adapterMarkPress = handleId !== undefined;
				drag = { x: event.clientX, y: event.clientY, mode: 'adapter' };
				return true;
			};
			if (mark?.role === 'disclose') {
				// The W·D·H chip: the adapter owns the press so a drag scales; a
				// release inside click tolerance still toggles the grips.
				stage.idleHoverIntent({ phase: 'cancel', css, evaluationId: pointerEvaluationId, shift: event.shiftKey, coarse });
				if (claimAdapterPress(mark.id, mark.adapterId)) {
					disclosurePress = { id: mark.id, x: event.clientX, y: event.clientY };
					return;
				}
				input.press.refuse(event.pointerId);
				if (stage.activateDisclosure(mark.id)) stage.notifySurfaceChange();
				return;
			}
			if (mark?.role === 'edit') {
				stage.idleHoverIntent({ phase: 'cancel', css, evaluationId: pointerEvaluationId, shift: event.shiftKey, coarse });
				if (claimAdapterPress(mark.id, mark.adapterId)) return;
			} else {
				// Hit priority: a selected subject body gets the press before an idle
				// Junction can offer its overlapping point mark.
				if (claimAdapterPress()) {
					stage.idleHoverIntent({ phase: 'cancel', css, evaluationId: pointerEvaluationId, shift: event.shiftKey, coarse });
					return;
				}
				if (mark === null) {
					const idleMark = stage.idleHoverIntent({ phase: 'move', css, evaluationId: pointerEvaluationId, shift: event.shiftKey, coarse });
					if (idleMark?.role === 'edit' && claimAdapterPress(idleMark.id, idleMark.adapterId)) return;
				} else {
					stage.idleHoverIntent({ phase: 'cancel', css, evaluationId: pointerEvaluationId, shift: event.shiftKey, coarse });
				}
			}
		}
		// A gesture is one captured writer with an explicit transition policy; a
		// replacement cancels it exactly once. Navigation cannot steal the lease, so a
		// refused acquisition means this press does not move the view at all — the
		// capture is taken only once the lease is actually ours.
		const acquisition = stage.acquireGesture({
			owner: 'stage-pointer',
			evaluationId: stage.evaluationId() ?? '',
			policy: 'continue-after-revalidation',
			// The host's own press is navigation, not authored work: it explicitly
			// declares so, which is why a pan never blocks Undo.
			navigation: true
		});
		if (acquisition.kind !== 'granted') {
			// This pointer is not ours: record it so its click cannot select, and leave the
			// holder's press and lease untouched.
			input.press.refuse(event.pointerId);
			input.onNotice(`The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`);
			return;
		}
		// A capture that throws (the pointer already ended) must hand the lease back,
		// or every later gesture is refused against a press that no longer exists.
		if (
			!input.capturePointer(event.currentTarget as HTMLElement, event.pointerId) ||
			input.press.begin({ x: event.clientX, y: event.clientY }, event.pointerId) === 'refused'
		) {
			// Defensive: the lease said yes but the tracker already has a live press.
			input.session.gesture()?.release();
			return;
		}
		drag = { x: event.clientX, y: event.clientY, mode: event.button === 0 && !event.shiftKey ? 'pan' : 'orbit' };
	}

	function pointerMove(event: PointerEvent): void {
		input.artwork.pointerMove(event);
		if (input.unfold.pointerMove(event)) return;
		if (pinch !== null) {
			if (!pinch.has(event.pointerId)) return;
			if (input.session.gesture() === null) { endPinch(); return; }
			const before = [...pinch.values()];
			pinch.set(event.pointerId, [event.clientX, event.clientY]);
			const after = [...pinch.values()];
			const oldDistance = Math.hypot(before[0]![0] - before[1]![0], before[0]![1] - before[1]![1]);
			const newDistance = Math.hypot(after[0]![0] - after[1]![0], after[0]![1] - after[1]![1]);
			input.pan((after[0]![0] + after[1]![0] - before[0]![0] - before[1]![0]) / 2, (after[0]![1] + after[1]![1] - before[0]![1] - before[1]![1]) / 2);
			if (oldDistance > 0 && newDistance > 0) input.zoom(oldDistance / newDistance);
			return;
		}
		if (input.activeLayer()?.pointerMove(event) === 'claimed') return;
		if (drag === null) {
			if (event.pointerType === 'touch' || input.session.gesture() !== null) { clearHover(); return; }
			hoverSample = { css: input.stageCss(event) as [number, number], shift: event.shiftKey, coarse: event.pointerType !== 'mouse' };
			if (hoverFrame === null) hoverFrame = requestAnimationFrame(resolveHover);
			return;
		}
		if (drag.mode === 'host') {
			if (!input.press.ownsPointer(event.pointerId)) return;
			if (input.session.gesture() === null) {
				interrupt('reading-change');
				return;
			}
			const id = input.facade()?.evaluationId() ?? null;
			if (id === null) return;
			const toolInput = { css: input.stageCss(event), evaluationId: id, coarse: event.pointerType !== 'mouse' };
			if (input.armedHostTool() === 'measure') input.measureTool()?.move(toolInput);
			else input.eraserTool()?.move(toolInput);
			drag = { x: event.clientX, y: event.clientY, mode: 'host' };
			input.onRefreshHostTools();
			return;
		}
		if (drag.mode === 'adapter') {
			if (!input.press.ownsPointer(event.pointerId)) return;
			// A reading change cancels the adapter's gesture lease before the next
			// frame. The pointer mapping was measured in the old projection, so the
			// press ends instead of dragging a proposal through a view it was never
			// measured in.
			if (input.session.gesture() === null) {
				interrupt('reading-change');
				return;
			}
			const stage = input.facade();
			const id = adapterEvaluationId ?? stage?.evaluationId() ?? null;
			if (stage === null || id === null) return;
			// T3.P03.S02: one monotonic sequence per continuous input sample. The
			// adapter's preview installation and the accepted result inherit it.
			if (perfMarksEnabled()) perfInput('pointermove', { wallMode: true, eventTimeStamp: event.timeStamp, timeOrigin: performance.timeOrigin });
			stage.pointerIntent({ phase: 'move', css: input.stageCss(event), evaluationId: id, shift: event.shiftKey, metaKey: event.metaKey, ctrlKey: event.ctrlKey, coarse: event.pointerType !== 'mouse' });
			drag = { x: event.clientX, y: event.clientY, mode: 'adapter' };
			return;
		}
		// Movement is the one thing a refused pointer still produces. Its samples are at
		// its own position, not the owner's, so taking them would pan by the distance
		// between two fingers — the camera would jump while the owner held the gesture.
		if (!input.press.ownsPointer(event.pointerId)) return;
		// The lease can end underneath us (a cancel-on-reading-change policy, a task
		// exit, an adapter taking the pointer). Samples taken under a lease we no
		// longer hold must not keep moving the view.
		if (input.session.gesture() === null) {
			abortGesture();
			return;
		}
		const dx = event.clientX - drag.x;
		const dy = event.clientY - drag.y;
		drag = { x: event.clientX, y: event.clientY, mode: drag.mode };
		if (drag.mode === 'orbit') input.orbit(-dx * 0.01, dy * 0.01);
		else input.pan(dx, dy);
	}

	function pointerUp(event: PointerEvent): void {
		if (input.artwork.pointerUp(event)) return;
		if (input.unfold.pointerUp(event)) return;
		if (input.activeLayer()?.pointerUp(event) === 'claimed') return;
		if (pinch?.has(event.pointerId)) { endPinch(); return; }
		// A normal ending: the click that follows decides by distance, so the press is
		// ended, not aborted. Only the owning pointer may end it — a refused second
		// pointer's release must not release the first pointer's lease.
		if (!input.press.end(event.pointerId)) return;
		if (drag?.mode === 'host') {
			// The host tool's tap is its own command, never a selection.
			input.press.claim(event.pointerId);
			// Host tools resolve against the current image on every sample. Unlike a
			// domain writer, they do not carry a press-time projection into a planner.
			const id = input.facade()?.evaluationId() ?? null;
			drag = null;
			adapterEvaluationId = null;
			const tool = input.armedHostTool() === 'measure' ? input.measureTool() : input.eraserTool();
			if (tool === null) return;
			if (input.session.gesture() === null || id === null) {
				tool.cancel();
				input.onRefreshHostTools();
				return;
			}
			const toolInput = { css: input.stageCss(event), evaluationId: id, coarse: event.pointerType !== 'mouse' };
			void Promise.resolve(tool.up(toolInput)).then(() => input.onRefreshHostTools());
			input.onRefreshHostTools();
			return;
		}
		if (drag?.mode === 'adapter') {
			// A task's tap is its own command (place a point, split a Wall, or a
			// refusal) and never a selection, so it claims the click. Direct
			// manipulation with no task is different: a release within tolerance
			// produces no request, so the ordinary click still runs and keeps the
			// selection; a real drag is longer than the click tolerance and the
			// click's own distance check discards it.
			if (input.task() !== null || adapterMarkPress) input.press.claim(event.pointerId);
			const stage = input.facade();
			const id = adapterEvaluationId ?? stage?.evaluationId() ?? null;
			const chip = disclosurePress;
			drag = null;
			adapterEvaluationId = null;
			adapterMarkPress = false;
			disclosurePress = null;
			if (stage !== null && id !== null) {
				// After a reading change the lease is already gone: the press is cancelled
				// rather than released, so no stale projection commits.
				const phase = input.session.gesture() === null ? 'cancel' : 'up';
				perfMark('input:release', { phase });
				stage.pointerIntent({ phase, css: input.stageCss(event), evaluationId: id, shift: event.shiftKey, metaKey: event.metaKey, ctrlKey: event.ctrlKey, coarse: event.pointerType !== 'mouse' });
				if (
					chip !== null &&
					phase === 'up' &&
					!isStageDrag(chip, { x: event.clientX, y: event.clientY }) &&
					stage.activateDisclosure(chip.id)
				) stage.notifySurfaceChange();
			}
			return;
		}
		endGesture();
	}

	function pointerCancel(event: PointerEvent): void {
		if (input.artwork.pointerCancel(event)) return;
		if (input.unfold.pointerCancel(event)) return;
		if (input.activeLayer()?.pointerCancel(event) === 'claimed') return;
		if (pinch?.has(event.pointerId) || input.press.ownsPointer(event.pointerId)) interrupt('pointercancel');
	}

	function lostPointerCapture(event: PointerEvent): void {
		if (input.artwork.lostCapture(event)) return;
		if (input.unfold.lostCapture(event)) return;
		if (input.activeLayer()?.lostCapture(event) === 'claimed') return;
		if (pinch?.has(event.pointerId) || (input.press.ownsPointer(event.pointerId) && drag !== null)) interrupt('lostpointercapture');
	}

	/** A click's pointer id, when the event carries one (a `PointerEvent` click does). */
	function pointerIdOf(event: MouseEvent): number | null {
		const candidate = (event as MouseEvent & { readonly pointerId?: unknown }).pointerId;
		return typeof candidate === 'number' ? candidate : null;
	}

	function click(event: MouseEvent): void {
		// A pan or orbit drag ends with a click too; it moved the view, so it must not
		// also select (or report that nothing was selectable). The decision is consumed
		// here, after the pointer sequence has ended, and only by the pointer it belongs to.
		if (!input.press.decide({ x: event.clientX, y: event.clientY }, pointerIdOf(event))) return;
		// The unfolded display is the addressed surface. A click that missed it must
		// not select the canonical Wall/Opening drawn behind the sheet (and so must
		// not disagree with the pointer pick); an empty click stays non-selecting.
		if (input.unfold.active) return;
		// The authoring owner's armed placement owns the click when it is live.
		if (input.artwork.click(event)) return;
		// A frustum's captured release also dispatches a click. Its View owns that
		// click just as it owned the press; picking the floor here clears the Card.
		// A View glyph, Look through or placement owns the release; it must not pick the Floor.
		if (input.activeLayer()?.click(event, input.viewMarkAt(event) !== null) === 'claimed') return;
		// An **armed dock tool** owns the Stage surface: its tap already placed a
		// point, split a Wall or was refused, and re-selecting underneath it would
		// silently move what the tool is editing. Another adapter's task (Compose,
		// Import) does not: clicking the Stage stays the host's own Select,
		// which those tasks already depend on to reach their subject.
		if (input.task() !== null && input.dockToolArmed()) return;
		const stage = input.facade();
		const id = stage?.evaluationId() ?? null;
		const currentRect = input.rect();
		if (stage === null || id === null || currentRect === null) return;
		const css: [number, number] = [event.clientX - currentRect.left, event.clientY - currentRect.top];
		const hit = stage.resolveSourceHit({ evaluationId: id, css });
		if (hit.kind === 'resolved') {
			input.selectHit(hit.hit);
			input.onNotice('');
			return;
		}
		if (hit.kind === 'none') {
			// The Plan places no fragment for an excluded source, so a miss cannot say
			// which subject the creator meant. Exclusion reasons and Reveal live on the
			// Index, and this notice points there without pretending to localize. An
			// ordinary empty click says nothing (R217.S22, D42).
			const planView = input.planView();
			if (planView !== null && planView.membership.some((row) => !row.eligible)) {
				input.onNotice('Nothing selectable there — some subjects are excluded from this Plan; Reveal one from the Index.');
			}
			return;
		}
		input.onNotice('That click did not land on the Plan.');
	}

	function wheel(event: WheelEvent): void {
		event.preventDefault();
		if (input.activeLayer()?.wheel(event, input.evaluation()?.rect.height ?? 1) === 'claimed') return;
		const scale = Math.exp(event.deltaY * 0.001);
		const stage = input.facade();
		if (stage && stage.camera.lookThrough() === null && drag === null &&
			pinch === null && input.session.gesture() === null) {
			input.submit(stageWheelZoom(
				scale, [event.clientX, event.clientY], stage.evaluation(),
				stage.snapshot().domain.scene, input.pick
			), input.nowSeconds());
			return;
		}
		input.zoom(scale);
	}

	return {
		get drag() {
			return drag;
		},
		get hoverSelection(): StageSelectionEntry | null {
			return hoverSelection;
		},
		get hoverMove(): boolean {
			return hoverMove;
		},
		get stageCursor(): string | null {
			return stageCursor;
		},
		get pinchActive(): boolean {
			return pinch !== null;
		},
		get pressing(): boolean {
			return drag !== null || pinch !== null;
		},
		get eraseHover(): StageSelectionEntry | null {
			return input.eraseHover();
		},
		pointerDown,
		pointerMove,
		pointerUp,
		pointerCancel,
		lostPointerCapture,
		click,
		wheel,
		clearHover,
		interrupt,
		/** Drop host view state for a replaced epoch without touching a lease. */
		reset(): void {
			drag = null;
			adapterEvaluationId = null;
			adapterMarkPress = false;
			disclosurePress = null;
			hoverSelection = null;
			input.press.abort();
		},
		dispose(): void {
			clearHover();
		}
	};
}
