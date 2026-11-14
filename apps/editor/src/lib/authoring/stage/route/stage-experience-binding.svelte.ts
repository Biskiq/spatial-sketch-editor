/**
 * X3 / decomposition contract S — the Experience binding.
 *
 * This controller owns the route-local Experience presentation wiring that used
 * to sit inline in the spatial page: the lens posture, the Guide disclosure, the
 * one-Stage-pick link mode, the Welcome note, the View marker hit test, the path
 * anchor drag lease and the live turn-arc projection. Capture, View/path edits,
 * playback and Camera operations stay with their existing owners:
 *
 * - `experience-lens` remains the lens/playback/Look-Through state machine;
 * - `experience-controller` remains the Experience document authority;
 * - `experienceFocus` remains the one Card subject;
 * - the facade's Camera/inspection seam remains the only pose writer;
 * - the Stage viewport controller remains the one viewport reader.
 *
 * The binding disposes only its own lens subscriptions/restores (the lens's own
 * idempotent `dispose`); the route still runs one ordered teardown.
 */
import type { ViewportEvaluation, ViewportRect } from '@portfolio/camera-core';
import { untrack } from 'svelte';
import { experienceFocus } from '$lib/authoring/experience/focus.svelte';
import {
	createExperienceLens,
	type ExperienceLens
} from '$lib/authoring/experience/experience-lens.svelte';
import { provideExperienceHomes } from '$lib/authoring/experience/experience-homes';
import { experienceIndexFor } from '$lib/authoring/experience/experience-index';
import {
	experienceShownCardFor,
	type ExperienceShownCard
} from '$lib/authoring/experience/experience-card-wiring';
import { rememberWelcomeDismissed, welcomeDismissed } from '$lib/authoring/experience/experience-welcome';
import type { ExperienceController } from '$lib/authoring/experience/experience-controller.svelte';
import type { ExperienceSubject } from '$lib/authoring/experience/experience-model';
import type { ExperienceProblem } from '$lib/authoring/experience/experience-problems';
import { yawFromEye } from '$lib/authoring/experience/experience-view-edit';
import type { StageFacade } from '../stage-facade';
import type { StagePostureLayer } from '../stage-adapter-host';
import type { StageSelectionEntry } from '../semantic-selection';
import type { StageSession } from '../stage-session';
import type { StageShellState } from './stage-shell-state.svelte';

type StageTriple = [number, number, number];

export type StageExperienceBindingInput = {
	readonly session: StageSession;
	readonly stage: () => StageFacade | null;
	readonly shell: () => StageShellState;
	readonly selection: () => StageSelectionEntry | null;
	readonly cardIdentity: () => { readonly label: string } | null;
	readonly floorDatum: () => number;
	readonly closeSelection: () => void;
	/** The lens host's selection clear (facade + route slot), without focus/card. */
	readonly clearStageSelection: () => void;
	readonly preview: () => {
		readonly openState: boolean;
		readonly busy: boolean;
		readonly requestedMode: unknown;
		open(mode: 'guided' | 'free', guideId: string | null): unknown;
		close(): void;
	};
	readonly reducedMotion: () => boolean;
	readonly evaluation: () => ViewportEvaluation | null;
	readonly rect: () => ViewportRect | null;
	readonly stageElement: () => HTMLElement | undefined;
	readonly capturePointer: (target: Element, pointerId: number) => boolean;
	readonly stageCss: (event: PointerEvent) => [number, number];
	readonly absoluteCss: (event: PointerEvent) => [number, number];
	readonly refresh: () => void;
	readonly renameRequest: () => void;
	readonly clearHover: () => void;
	readonly refusePress: (pointerId: number) => void;
	readonly interruptPress: (reason: 'lens-change') => void;
	readonly gestureActive: () => boolean;
	readonly notice: (message: string) => void;
	readonly setPreviewProblem: (problem: ExperienceProblem | null) => void;
	readonly setStagePickPresentationId: (presentationId: string | null) => void;
};

export function createStageExperienceBinding(input: StageExperienceBindingInput) {
	let lensState = $state<'world' | 'experience'>('world');
	let controller = $state.raw<ExperienceController | null>(null);
	/** The Guide is closed by default; every lens entry starts closed (R217.S25). */
	let experienceGuideOpen = $state(false);
	/** Manual View placement is armed lens-local posture. */
	let experienceTool = $state<'select' | 'place'>('select');
	/** The Welcome note is a first-run hint, not a mode. */
	let experienceWelcome = $state(false);
	let started = false;

	/** One path anchor drag lease, owned here until release/cancel/teardown. */
	let pathDragLease: { release(): void } | null = null;

	const lens: ExperienceLens = createExperienceLens({
		activeController: () => activeExperience,
		stage: () => input.stage(),
		lens: () => lensState,
		guideOpen: () => experienceGuideOpen,
		setGuideOpen: (open) => {
			experienceGuideOpen = open;
		},
		clearStageSelection: () => {
			input.setStagePickPresentationId(null);
			input.clearStageSelection();
		},
		openCard: () => input.shell().setCardOpen(true),
		pickActive: () => input.shell().stagePickPresentationId !== null,
		cancelPick: () => {
			input.setStagePickPresentationId(null);
			input.notice('Pick cancelled.');
		},
		dismiss: () => {
			if (experienceFocus.subject !== null) {
				experienceFocus.select(null);
				return true;
			}
			if (input.selection() !== null) {
				input.closeSelection();
				return true;
			}
			if (experienceGuideOpen) {
				experienceGuideOpen = false;
				return true;
			}
			return false;
		},
		reducedMotion: () => input.reducedMotion(),
		previewOpen: () => input.preview().openState,
		previewBusy: () => input.preview().busy,
		previewRequested: () => input.preview().requestedMode !== null,
		pathAnchorPoint: (css, height) => pathAnchorPoint(css, height),
		stageCss: (event) => input.stageCss(event),
		showMarkers: () => input.shell().showMarkers,
		showFrustums: () => input.shell().showFrustums,
		gestureActive: () => input.gestureActive(),
		refusePress: (pointerId) => input.refusePress(pointerId),
		clearHover: () => input.clearHover(),
		evaluationGeneration: () => input.evaluation()?.token.evaluationGeneration ?? 0,
		tool: () => experienceTool,
		setTool: (next) => {
			experienceTool = next;
		},
		absoluteCss: (event) => input.absoluteCss(event),
		stageElement: () => input.stageElement(),
		capturePointer: (target, pointerId) => input.capturePointer(target, pointerId),
		floorDatum: () => input.floorDatum(),
		evaluation: () => input.evaluation(),
		refresh: () => input.refresh(),
		renameRequest: () => input.renameRequest(),
		notice: (message) => input.notice(message)
	});
	lens.install();
	/** The playback object is one session reference; keep it across lens teardown. */
	const playback = lens.playback;
	/** The one active posture; World dispatches to adapters and navigation directly. */
	const activeLayer = $derived<StagePostureLayer | null>(
		lensState === 'experience' ? lens.posture : null
	);
	/** The controller the homes read; null outside the Experience lens. */
	const activeExperience = $derived(lensState === 'experience' ? controller : null);
	const experienceSceneSubject = $derived.by(() => {
		const selected = input.selection();
		if (
			selected === null ||
			selected.reference.domain !== 'scene' ||
			selected.reference.subject.kind !== 'entity'
		) {
			return null;
		}
		return {
			entityId: selected.reference.subject.id,
			label: input.cardIdentity()?.label ?? 'Object'
		};
	});

	function pathAnchorPoint(css: readonly [number, number], height: number): StageTriple | null {
		const stage = input.stage();
		const id = stage?.evaluationId() ?? null;
		if (stage === null || id === null) return null;
		const ray = stage.pointerRay([css[0], css[1]], id);
		if (ray.kind !== 'ray') return null;
		const hit = stage.intersectWorkingPlane(
			ray.ray,
			{
				originMeters: [0, height, 0],
				normal: [0, 1, 0],
				yawRadians: 0,
				datumMeters: input.floorDatum(),
				supportedLocalExtent: null
			},
			id
		);
		return hit.kind === 'intersected' ? hit.worldPoint : null;
	}

	function beginPathDragLease(): boolean {
		const stage = input.stage();
		const id = stage?.evaluationId() ?? null;
		if (stage === null || id === null || pathDragLease !== null) return false;
		const outcome = stage.acquireGesture({
			owner: 'experience-path-point',
			evaluationId: id,
			policy: 'cancel-on-reading-change'
		});
		if (outcome.kind !== 'granted') return false;
		pathDragLease = outcome.lease;
		return true;
	}

	function endPathDragLease(): void {
		pathDragLease?.release();
		pathDragLease = null;
	}

	function viewMarkAt(event: MouseEvent) {
		const target = event.target;
		if (!(target instanceof Element)) return null;
		const mark = target.closest('[data-view-mark]');
		const viewId = mark?.getAttribute('data-view-mark') ?? null;
		const kind =
			target.closest('[data-turn-grip]') !== null
				? 'turn'
				: (mark?.getAttribute('data-mark-kind') ?? null);
		return viewId === null || kind === null || mark === null ? null : { viewId, kind, mark };
	}

	const viewEditPreview = $derived.by(() => {
		const stage = input.stage();
		const id = stage?.evaluationId() ?? null;
		const edit = lens.viewEdit();
		const origin = input.rect();
		if (stage === null || id === null || edit === null || origin === null) return null;
		const local = (point: readonly [number, number]): [number, number] => [
			point[0] - origin.left,
			point[1] - origin.top
		];
		const eye = stage.projectWorld(edit.eye, id);
		if (eye.kind !== 'projected') return null;
		const target = stage.projectWorld(edit.target, id);
		const eyeCss = local(eye.css);
		const targetCss = target.kind === 'projected' ? local(target.css) : null;
		// Turn (G1): a ghost wedge along the new direction, an arc from the start
		// direction and the angle; never a line that stretches with the pointer.
		let turn: {
			readonly wedge: string;
			readonly arc: string;
			readonly label: string;
			readonly labelAt: readonly [number, number];
		} | null = null;
		if (edit.kind === 'turn' && targetCss !== null) {
			const start = stage.projectWorld(edit.start.target, id);
			if (start.kind === 'projected') {
				const startCss = local(start.css);
				const a0 = Math.atan2(startCss[1] - eyeCss[1], startCss[0] - eyeCss[0]);
				const a1 = Math.atan2(targetCss[1] - eyeCss[1], targetCss[0] - eyeCss[0]);
				let delta = a1 - a0;
				while (delta > Math.PI) delta -= 2 * Math.PI;
				while (delta < -Math.PI) delta += 2 * Math.PI;
				const half = (Math.max(10, Math.min(110, edit.start.fov)) * Math.PI) / 360;
				const at = (angle: number, radius: number): string =>
					`${(eyeCss[0] + Math.cos(angle) * radius).toFixed(1)},${(eyeCss[1] + Math.sin(angle) * radius).toFixed(1)}`;
				const length = 90;
				const arcRadius = 46;
				const startYaw = yawFromEye(edit.start, edit.start.target);
				const turnedYaw = yawFromEye(edit.start, edit.target);
				const yawChange = startYaw === null || turnedYaw === null ? 0 : turnedYaw - startYaw;
				const degrees = Math.round(
					(Math.abs(Math.atan2(Math.sin(yawChange), Math.cos(yawChange))) * 180) / Math.PI
				);
				turn = {
					wedge: `M${eyeCss[0]},${eyeCss[1]}L${at(a1 - half, length)}A${length},${length} 0 0 1 ${at(a1 + half, length)}Z`,
					arc: `M${at(a0, arcRadius)}A${arcRadius},${arcRadius} 0 0 ${delta > 0 ? 1 : 0} ${at(a1, arcRadius)}`,
					label: `${degrees}°`,
					labelAt: [
						eyeCss[0] + Math.cos(a0 + delta / 2) * (arcRadius + 16),
						eyeCss[1] + Math.sin(a0 + delta / 2) * (arcRadius + 16)
					]
				};
			}
		}
		return { kind: edit.kind, eye: eyeCss, target: targetCss, turn };
	});

	/**
	 * R217.S25 — the Experience lens's groups for the shared Index: the Experience
	 * switch, the Guides, and the Presentations with their Views and Stop numbers.
	 */
	const experienceIndex = $derived(
		experienceIndexFor({
			lens: lensState,
			controller,
			guideOpen: experienceGuideOpen,
			expandedPresentationId: input.shell().expandedPresentationId,
			select: lens.selectSubject,
			setExpanded: (presentationId) => input.shell().setExpandedPresentationId(presentationId),
			setCardOpen: (open) => input.shell().setCardOpen(open),
			setGuideOpen: (open) => {
				experienceGuideOpen = open;
			}
		})
	);

	function changeLens(next: 'world' | 'experience'): void {
		// A lens switch invalidates any Present-this framing run still waiting.
		input.setStagePickPresentationId(null);

		const previous = lensState;
		// Preview returns to the lens it was entered from; a lens switch ends it.
		input.preview().close();
		input.clearHover();
		input.interruptPress('lens-change');
		// A notice describes the previous context; the lens is the new one.
		input.notice('');
		const stage = input.stage();
		if (stage?.changeLens(next)) {
			lensState = input.session.lens();
			// Leaving the lens ends its transient posture; a refused switch keeps it.
			if (previous === 'experience' && lensState !== 'experience') lens.deactivate();
			input.shell().setTask(null);
			input.shell().bumpContributions();
			// R217.S25: the Guide instrument is closed by default, so every entry starts
			// closed. A Card subject left from the last visit is cleared too, or its
			// Guide-type subject would reopen it.
			if (lensState === 'experience') {
				experienceGuideOpen = false;
				experienceFocus.select(null);
				// With no Experience there is no Card for a carried-over World selection.
				if (controller?.current == null && input.selection() !== null) input.closeSelection();
			}
		}
		// Arming the Experience dock's Guide key is not a mode: the lens owns it.
	}

	/** Open the Card a source problem names; the chip itself never edits the source. */
	function showProblem(problem: ExperienceProblem): void {
		if (problem.subject === null) return;
		if (lensState !== 'experience') changeLens('experience');
		input.shell().setCardOpen(true);
		const subject = problem.subject;
		if (subject.kind === 'guide') {
			// D-2: a Guide has no Card. Show opens its instrument and keeps the Experience Card.
			const current = activeExperience;
			const guide = current?.guides.find((entry) => entry.id === subject.guideId);
			if (current == null || guide === undefined) return;
			lens.openGuide(guide.id);
			experienceFocus.select({ kind: 'experience' });
			return;
		}
		experienceFocus.select(subject);
	}

	provideExperienceHomes(
		lens.homes({
			controller: () => activeExperience,
			guideOpen: () => experienceGuideOpen,
			setGuideOpen: (open) => {
				experienceGuideOpen = open;
			},
			select: lens.selectSubject,
			sceneSubject: () => experienceSceneSubject,
			openInWorld: () => changeLens('world'),
			pickStageSubject: (presentationId) => {
				if (lensState !== 'experience') return false;
				input.setStagePickPresentationId(presentationId);
				input.notice('Pick a Stage object to link. Esc cancels.');
				return true;
			},
			previewMode: (mode, guideId) => void input.preview().open(mode, guideId),
			guideForStop: (stopId) => controller?.guideForStop(stopId) ?? null
		})
	);

	// The controller can set a subject itself (a Capture, an added Stop); the Stage
	// selection it replaces must not linger beside it.
	$effect(() => {
		if (activeExperience?.subject == null) return;
		untrack(() => {
			if (input.selection() === null) return;
			input.clearStageSelection();
		});
	});
	// A subject whose ids no longer resolve (an undo, a redo or a removed
	// Presentation) would leave the Card blank: clear it, so the Card falls back
	// to the Stage selection or to nothing.
	$effect(() => {
		const current = activeExperience;
		const subject = current?.subject ?? null;
		if (current === null || subject === null) return;
		const resolves =
			subject.kind === 'experience'
				? current.current !== null
				: subject.kind === 'view'
					? current.selectedView !== null
					: subject.kind === 'stop' || subject.kind === 'transition'
						? current.selectedStop !== null
						: current.selectedPresentation !== null;
		if (!resolves) untrack(() => experienceFocus.select(null));
	});
	// A Stop or transition belongs to the Guide, so its instrument opens. A
	// Presentation, View, Experience or Stage subject never closes it.
	$effect(() => {
		const kind = activeExperience?.subject?.kind;
		if (kind !== 'stop' && kind !== 'transition') return;
		untrack(() => lens.openGuide());
	});
	// The Index opens the selected Presentation's Views. Only its id drives the
	// effect, so a new object for the same Presentation cannot re-expand a row the
	// user collapsed.
	const selectedPresentationId = $derived(activeExperience?.selectedPresentation?.id ?? null);
	$effect(() => {
		if (selectedPresentationId !== null) {
			input.shell().setExpandedPresentationId(selectedPresentationId);
		}
	});
	// A notice describes the previous context; in the lens it is a transient line.
	$effect(() => {
		const shown = input.shell().notice;
		if (lensState !== 'experience' || shown === '') return;
		const timeout = setTimeout(() => input.shell().clearNotice(shown), 4000);
		return () => clearTimeout(timeout);
	});

	function start(): void {
		if (started) return;
		started = true;
		try {
			experienceWelcome = !welcomeDismissed();
		} catch {
			experienceWelcome = true;
		}
	}

	function dispose(): void {
		lens.dispose();
	}

	return {
		lens,
		get lensState() {
			return lensState;
		},
		get controller() {
			return controller;
		},
		setController(next: ExperienceController | null) {
			controller = next;
		},
		get active() {
			return activeExperience;
		},
		get guideOpen() {
			return experienceGuideOpen;
		},
		get experienceTool() {
			return experienceTool;
		},
		get welcome() {
			return experienceWelcome;
		},
		showWelcome() {
			experienceWelcome = true;
		},
		dismissWelcome() {
			rememberWelcomeDismissed();
			experienceWelcome = false;
		},
		get playback() {
			return playback;
		},
		get posture() {
			return activeLayer;
		},
		get index() {
			return experienceIndex;
		},
		get sceneSubject() {
			return experienceSceneSubject;
		},
		selectSubject: (subject: ExperienceSubject | null) => lens.selectSubject(subject),
		lookThroughActive: () => lens.lookThroughSession() !== null,
		advanceLookThroughZoom: (now: number) => lens.advanceLookThroughZoom(now),
		advancePlayback: (now: number) => lens.advancePlayback(now),
		placementGhost: () => lens.placementGhost(),
		lookThroughView: (viewId: string) => lens.lookThroughView(viewId),
		openGuide: (guideId?: string) => lens.openGuide(guideId),
		stopAndRestore: () => lens.stopAndRestore(),
		changeLens,
		showProblem,
		cardView(slots: {
			readonly services: unknown;
			readonly selection: StageSelectionEntry | null;
			readonly sceneSubject: { readonly entityId: string; readonly label: string } | null;
			readonly cardIdentity: { readonly sourceId: string; readonly label: string; readonly kind: string; readonly status: string } | null;
			readonly bring: () => void;
			readonly selectStageReference: (reference: StageSelectionEntry['reference']) => void;
			readonly referenceLabel: (reference: StageSelectionEntry['reference']) => string | null;
		}): ExperienceShownCard {
			const current = activeExperience;
			if (current === null) {
				return {
					identity: null,
					facts: [],
					nameWriter: null,
					writer: null,
					actions: [],
					functions: [],
					bringIntoView: null,
					kindLink: null,
					menu: null,
					back: null
				};
			}
			return experienceShownCardFor({
				controller: current,
				services: slots.services,
				selection: slots.selection,
				sceneSubject: slots.sceneSubject,
				cardIdentity: slots.cardIdentity,
				select: lens.selectSubject,
				changeLens: () => changeLens('world'),
				bring: slots.bring,
				selectStageReference: slots.selectStageReference,
				referenceLabel: slots.referenceLabel,
				openCard: () => input.shell().setCardOpen(true)
			});
		},
		get viewEdit() {
			return lens.viewEdit();
		},
		get advancedViewId() {
			return lens.advancedViewId();
		},
		get pendingViewWrite() {
			return lens.pendingViewWrite();
		},
		confirmPendingViewWrite() {
			return lens.confirmPendingViewWrite();
		},
		clearPendingViewWrite() {
			lens.clearPendingViewWrite();
		},
		get viewEditPreview() {
			return viewEditPreview;
		},
		viewMarkAt,
		pathAnchorPoint,
		beginPathDragLease,
		endPathDragLease,
		lookThroughSession: () => lens.lookThroughSession(),
		lookThroughMoved: () => lens.lookThroughMoved(),
		lookThroughConfirm: () => lens.lookThroughConfirm(),
		clearLookThroughConfirm: () => lens.clearLookThroughConfirm(),
		updateLookThrough: (confirm: boolean) => lens.updateLookThrough(confirm),
		exitLookThrough: () => lens.exitLookThrough(),
		captureProvisional: () => lens.captureProvisional(),
		togglePlaceView: () => lens.togglePlaceView(),
		captureReason: () => lens.captureReason(),
		toggleGuide: () => lens.toggleGuide(),
		capture: () => void activeExperience?.capture(),
		get feedback() {
			return activeExperience?.feedback ?? null;
		},
		start,
		dispose
	};
}

export type StageExperienceBinding = ReturnType<typeof createStageExperienceBinding>;
