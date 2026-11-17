/** Public editor-only composition seam. Domain factories never receive host internals. */
import type { DomainPlanner, RegistrationOutcome } from '@portfolio/project-model';
import type { StageAcceptanceHost } from './host-acceptance';
import type { StageAdapter, StageAdapterRegistration, StageFacade } from './stage-facade';
import type { StageSession } from './stage-session';
import type { FinishAuthoring } from '../look/finish-authoring.svelte';

/** Public Stage values used by adapter contributions; implementation remains in Stage. */
export { evaluationIdOf } from './camera-session';
export { datumWorkingPlane } from './stage-facade';
export { angleDeltaLabel, planarDeltaLabel, signed, sizeDeltaLabel } from './gesture-values';
export { roomLabelFacts } from './room-labels';
export { axisTravelFromRay } from './stage-axis-travel';
export { DRAFTING_SNAP_METERS, draftingSnapIncrementMeters, snapDraftingCoordinate, snapDraftingPlacement, snapDraftingPoint } from './stage-drafting';
export { isStageDrag, readingIntentClockSeconds } from './stage-input';
export { scopeAdmitsEntity } from './subject-scope';
export { stageEnvelope, stageLayout, stageScene, stageUnitRevision } from './unit-stage-source';
export { PAPER_LAYER, buildPaperPlan, unionOutline } from './paper-plan';
export { compactMeasure } from './shell/compact-measure';
export { indexLabels } from './shell/index-labels';
export { default as ShellIcon } from './shell/ShellIcon.svelte';
export type {
	StageAdapter, StageAdapterBinding, StageAdapterContext, StageCardAction,
	StageCardActionOutcome, StageCardFact, StageCardSubject, StageCandidatePreview,
	StageDomainPick, StageGhostMesh, StageGuideContribution, StageInkReadingRecord,
	StageInkReadingSession, StageInstrumentContent, StageKeyboardIntent, StageOverlayContribution,
	StagePointerIntent
} from './stage-facade';
export type { StageHandleDescriptor } from './stage-handles';
export type { GestureAcquisition, GestureLease, ProposalLease } from './stage-session';
export type { StageHeightTick } from './stage-height-sheet';
export type { StageDraftingState } from './stage-drafting';
export type { StageAcceptOutcome } from './host-acceptance';
export type { StageReadSnapshot } from './accepted-read';

/** Only the task and proposal state adapter contributions use. */
export type StageTaskPort = Pick<StageSession,
	'task' | 'gesture' | 'writerGeneration' | 'taskChoiceGeneration' | 'registerProposal'
>;

/** The same runtime facade, narrowed to the operations used by adapters. */
export type StageAdapterPort = Pick<StageFacade,
	'snapshot' | 'evaluation' | 'evaluationId' | 'plan' | 'heightSheet' | 'heightTicks' |
	'resolvePick' | 'hitMark' | 'selection' | 'selectionState' | 'setSelection' | 'select' |
	'drafting' | 'sceneBounds' | 'onAdaptersChanged' | 'inkReadings' | 'openInkReading' |
	'openContributedTask' | 'closeTask' | 'notifySurfaceChange' | 'postureScoped' | 'acquireGesture' |
	'lightPreview'
> & { readonly session: StageTaskPort };

/**
 * T2.S3b: the route's session-only light inspection, offered to the Light Card.
 * Entry uses the one Camera's inspection posture; it writes no document value.
 */
export type StageObjectStudio = {
	/** Whether the posture can open now (World lens, not already in Studio). */
	available(): boolean;
	/** Enter Object Studio on one native form. Writes no document value. */
	edit(entityId: string):
		| { readonly kind: 'entered' }
		| { readonly kind: 'refused'; readonly message: string };
};

export type StageLightInspection = {
	enter(lightId: string):
		| { readonly kind: 'entered' }
		| { readonly kind: 'refused'; readonly message: string };
};

export type StageAdapterServices = {
	readonly stage: StageAdapterPort;
	/** One epoch's F4 boundary. Planner registrations last for this epoch. */
	readonly authoring: Pick<StageAcceptanceHost, 'accept' | 'acceptedRevision'> & { registerPlanner(planner: DomainPlanner<unknown>): RegistrationOutcome };
	/**
	 * The route's one Spot Look-through session. Absent in tests and in a host
	 * that offers no inspection, so the Light Card simply omits its action.
	 */
	readonly lightInspection?: StageLightInspection;
	/**
	 * The route's Object Studio posture, offered to a form's Card as *Edit in Studio*.
	 * Absent in tests and hosts that offer no Studio, so the Card simply omits it.
	 */
	readonly objectStudio?: StageObjectStudio;
	/**
	 * The route's Finish service, filled once the route has built it. A port keeps
	 * the service and the adapter epoch from depending on each other's creation
	 * order; the Card reads `current` at render time.
	 */
	readonly finishes?: { readonly current: FinishAuthoring | null };
};

export type StageAdapterFactory = (services: StageAdapterServices) => StageAdapter;

/** One route-active interaction posture; at most one is active at a time. */
export type StagePostureClaim = 'claimed' | 'pass';

export type StagePostureMark = {
	readonly viewId: string;
	readonly kind: string;
	readonly mark: Element;
};

/**
 * A session-only posture that claims Stage input before adapters and navigation.
 * It owns no selection, history or Camera state; it realizes viewing through
 * facade intents only. `deactivate` ends transient posture on lens exit;
 * `dispose` is final and runs exactly once.
 */
export type StagePostureLayer = {
	readonly id: string;
	pointerDown(event: PointerEvent, mark: StagePostureMark | null): StagePostureClaim;
	pointerMove(event: PointerEvent): StagePostureClaim;
	pointerUp(event: PointerEvent): StagePostureClaim;
	pointerCancel(event: PointerEvent): StagePostureClaim;
	lostCapture(event: PointerEvent): StagePostureClaim;
	/** A second pointer arrives before navigation claims a pinch. */
	pinch(event: PointerEvent): StagePostureClaim;
	click(event: MouseEvent, overMark: boolean): StagePostureClaim;
	wheel(event: WheelEvent, viewportHeight: number): StagePostureClaim;
	/** A route interruption (lens or reading change, second pointer, Escape) ends a live posture press. */
	interrupt?(): StagePostureClaim;
	/** `capture` claims before adapters; `unwind` runs after shared dismiss handling. */
	key(event: KeyboardEvent, phase: 'capture' | 'unwind'): StagePostureClaim;
	readonly chrome?: {
		readonly dockToolFilter?: (id: string) => boolean;
		readonly cardInset?: number;
	};
	deactivate?(): void;
	dispose(): void;
};

/**
 * One epoch's adapter-facing ports. Constructing a second value over the same
 * facade and host is safe: it is access, not state, so a lens surface and the
 * adapter mount edit through the same Stage and the same F.4 boundary.
 */
export function createStageAdapterServices(
	stage: StageFacade,
	host: StageAcceptanceHost,
	finishes?: () => FinishAuthoring | null
): StageAdapterServices {
	return {
		stage,
		finishes: {
			get current() {
				return finishes?.() ?? null;
			}
		},
		authoring: {
			registerPlanner: (planner) => host.registerPlanner(planner),
			accept: (intent) => host.accept(intent),
			acceptedRevision: () => host.acceptedRevision()
		}
	};
}

export function mountStageAdapter(
	stage: StageFacade,
	host: StageAcceptanceHost,
	factory: StageAdapterFactory,
	finishes?: () => FinishAuthoring | null,
	/**
	 * The epoch's one services value, when the caller already composed it (the
	 * route fills `lightInspection` there). A fresh value is only for a direct
	 * test mount that has no route-owned ports to carry.
	 */
	services?: StageAdapterServices
): StageAdapterRegistration {
	return stage.registerStageAdapter(
		factory(services ?? createStageAdapterServices(stage, host, finishes))
	);
}
