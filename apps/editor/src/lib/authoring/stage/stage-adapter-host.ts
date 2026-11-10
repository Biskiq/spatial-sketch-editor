/** Public editor-only composition seam. Domain factories never receive host internals. */
import type { DomainPlanner, RegistrationOutcome } from '@portfolio/project-model';
import type { StageAcceptanceHost } from './host-acceptance';
import type { StageAdapter, StageAdapterRegistration, StageFacade } from './stage-facade';
import type { StageSession } from './stage-session';

/** Public Stage values used by adapter contributions; implementation remains in Stage. */
export { evaluationIdOf } from './camera-session';
export { datumWorkingPlane } from './stage-facade';
export { angleDeltaLabel, planarDeltaLabel, signed, sizeDeltaLabel } from './gesture-values';
export { roomLabelFacts } from './room-labels';
export { axisTravelFromRay } from './stage-axis-travel';
export { DRAFTING_SNAP_METERS, draftingSnapIncrementMeters, snapDraftingCoordinate, snapDraftingPlacement, snapDraftingPoint } from './stage-drafting';
export { isStageDrag } from './stage-input';
export { stageEnvelope, stageLayout, stageScene, stageUnitRevision } from './unit-stage-source';
export { PAPER_LAYER, buildPaperPlan, unionOutline } from './paper-plan';
export { compactMeasure } from './shell/compact-measure';
export { indexLabels } from './shell/index-labels';
export { default as ShellIcon } from './shell/ShellIcon.svelte';
export type {
	StageAdapter, StageAdapterBinding, StageAdapterContext, StageCardAction,
	StageCardActionOutcome, StageCardFact, StageCardSubject, StageCandidatePreview,
	StageDomainPick, StageGhostMesh, StageInkReadingRecord, StageInkReadingSession,
	StageKeyboardIntent, StageOverlayContribution, StagePointerIntent
} from './stage-facade';
export type { StageHandleDescriptor } from './stage-handles';
export type { GestureAcquisition, ProposalLease } from './stage-session';
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
	'drafting' | 'onAdaptersChanged' | 'inkReadings' | 'openInkReading' |
	'openContributedTask' | 'notifySurfaceChange' | 'acquireGesture'
> & { readonly session: StageTaskPort };

export type StageAdapterServices = {
	readonly stage: StageAdapterPort;
	/** One epoch's F4 boundary. Planner registrations last for this epoch. */
	readonly authoring: Pick<StageAcceptanceHost, 'accept' | 'acceptedRevision'> & { registerPlanner(planner: DomainPlanner<unknown>): RegistrationOutcome };
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
export function createStageAdapterServices(stage: StageFacade, host: StageAcceptanceHost): StageAdapterServices {
	return {
		stage,
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
	factory: StageAdapterFactory
): StageAdapterRegistration {
	return stage.registerStageAdapter(factory(createStageAdapterServices(stage, host)));
}
