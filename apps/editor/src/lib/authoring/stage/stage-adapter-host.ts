/** Public editor-only composition seam. Domain factories never receive host internals. */
import type { DomainPlanner, RegistrationOutcome } from '@portfolio/project-model/f4';
import type { SemanticReference } from '@portfolio/project-model/references';
import type { StageAcceptanceHost } from './host-acceptance';
import type { StageAdapter, StageAdapterRegistration, StageFacade } from './stage-facade';
import type { StageSession } from './stage-session';
import type {
	AppearanceIssue,
	AppearanceIssueActionKind,
	AppearanceIssuesService,
} from '../look/appearance-issues.svelte';
import type { FinishAlign } from '../look/finish-align.svelte';
import type { FinishCard, FinishCardTarget } from '../look/finish-card.svelte';
import type { FinishEditor } from '../look/finish-editor.svelte';
import { createMaterialProofRegistry } from '../material-proof';
import {
	createSceneTargetAnalysis,
	type ModelDerivativeAnalysisProvider,
} from '$lib/render/materials/target-analysis';
import { stageEnvelope } from './unit-stage-source';

/** Public Stage values used by adapter contributions; implementation remains in Stage. */
export { evaluationIdOf } from './camera-session';
export { datumWorkingPlane } from './stage-facade';
export { angleDeltaLabel, planarDeltaLabel, signed, sizeDeltaLabel } from './gesture-values';
export { roomLabelFacts } from './room-labels';
export { axisTravelFromRay } from './stage-axis-travel';
export {
	DRAFTING_SNAP_METERS,
	draftingSnapIncrementMeters,
	snapDraftingCoordinate,
	snapDraftingPlacement,
	snapDraftingPoint,
} from './stage-drafting';
export { isStageDrag, readingIntentClockSeconds } from './stage-input';
export { sameSubject } from './semantic-selection';
export { scopeAdmitsEntity } from './subject-scope';
export { stageEnvelope, stageLayout, stageScene, stageUnitRevision } from './unit-stage-source';
export { PAPER_LAYER, buildPaperPlan, unionOutline } from './paper-plan';
export { compactMeasure } from './shell/compact-measure';
export { indexLabels } from './shell/index-labels';
export { default as ShellIcon } from './shell/ShellIcon.svelte';
export type {
	StageAdapter,
	StageAdapterBinding,
	StageAdapterContext,
	StageCardAction,
	StageCardActionOutcome,
	StageCardFact,
	StageCardSubject,
	StageCandidatePreview,
	StagePaintAnswer,
	StagePaintSpaceScope,
	StageDomainPick,
	StageGhostMesh,
	StageGuideContribution,
	StageInkReadingRecord,
	StageInkReadingSession,
	StageInstrumentContent,
	StageKeyboardIntent,
	StageOverlayContribution,
	StagePointerIntent,
} from './stage-facade';
export type { StageHandleDescriptor } from './stage-handles';
export type { GestureAcquisition, GestureLease, ProposalLease } from './stage-session';
export type { StageHeightTick } from './stage-height-sheet';
export type { StageDraftingState } from './stage-drafting';
export type { StageAcceptOutcome } from './host-acceptance';
export type { StageReadSnapshot } from './accepted-read';

/** Only the task and proposal state adapter contributions use. */
export type StageTaskPort = Pick<
	StageSession,
	'task' | 'gesture' | 'writerGeneration' | 'taskChoiceGeneration' | 'registerProposal'
>;

/** The same runtime facade, narrowed to the operations used by adapters. */
export type StageAdapterPort = Pick<
	StageFacade,
	| 'snapshot'
	| 'evaluation'
	| 'evaluationId'
	| 'plan'
	| 'heightSheet'
	| 'heightTicks'
	| 'resolvePick'
	| 'hitMark'
	| 'selection'
	| 'selectionState'
	| 'setSelection'
	| 'select'
	| 'drafting'
	| 'sceneBounds'
	| 'onAdaptersChanged'
	| 'inkReadings'
	| 'openInkReading'
	| 'openContributedTask'
	| 'closeTask'
	| 'notifySurfaceChange'
	| 'postureScoped'
	| 'acquireGesture'
	| 'lightPreview'
> & { readonly session: StageTaskPort };

/**
 * T2.S3b: the route's session-only light inspection, offered to the Light Card.
 * Entry uses the one Camera's inspection posture; it writes no document value.
 */
export type StageObjectStudio = {
	/** Whether the posture can open now (World lens, not already in Studio). */
	available(): boolean;
	/** Enter Object Studio on one native form. Writes no document value. */
	edit(
		entityId: string,
	): { readonly kind: 'entered' } | { readonly kind: 'refused'; readonly message: string };
};

export type StageLightInspection = {
	enter(
		lightId: string,
	): { readonly kind: 'entered' } | { readonly kind: 'refused'; readonly message: string };
};

/** The shared Finish section consumes this narrow view of the Appearance session. */
export type StageFinishCardPort = {
	readonly align: Pick<FinishAlign, 'active'>;
	readonly card: Pick<
		FinishCard,
		| 'cancel'
		| 'clearRequest'
		| 'focus'
		| 'giveOwnCopy'
		| 'previewColour'
		| 'refusalFor'
		| 'rename'
		| 'requested'
		| 'resetToOriginal'
		| 'selectAllUsers'
		| 'setColour'
		| 'setColourMode'
		| 'setReach'
		| 'setSheen'
		| 'stepPattern'
		| 'swap'
		| 'toggleFavourite'
		| 'turnPattern'
		| 'view'
	>;
	readonly editor: Pick<FinishEditor, 'openFor'>;
	readonly issues: Pick<
		AppearanceIssuesService,
		'hasIssuesForTarget' | 'issuesForTarget' | 'refusalFor'
	>;
	requestAlign(
		target: FinishCardTarget,
		place: string,
		invoker?: HTMLElement | null,
	): {
		readonly ok: boolean;
		readonly message?: string;
	};
	requestLibrarySwap(target: FinishCardTarget, place: string): boolean;
	runIssueAction(
		issue: AppearanceIssue,
		kind: AppearanceIssueActionKind,
		target: FinishCardTarget,
		file?: File,
	): Promise<boolean>;
};

export type StageAdapterServices = {
	readonly stage: StageAdapterPort;
	/** The route session's content-addressed material proofs. */
	readonly materialProofs: import('$lib/authoring/material-proof').MaterialProofRegistry;
	/**
	 * Host-owned geometry facts for the exact accepted Scene revision. Finish
	 * registration compares the caller's echo against this analysis; it never
	 * trusts a fact the host did not derive from the exact geometry.
	 */
	readonly targetAnalysis: import('$lib/render/materials/target-analysis').TargetAnalysis;
	/** Open the Card for a freshly installed and selected Space. */
	readonly openSpaceCreated?: (reference: SemanticReference) => void;
	/** One epoch's F4 boundary. Planner registrations last for this epoch. */
	readonly authoring: Pick<StageAcceptanceHost, 'accept' | 'acceptedRevision'> & {
		registerPlanner(planner: DomainPlanner<unknown>): RegistrationOutcome;
	};
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
	/** Lazy because the adapter services bind the admitted epoch to the Card. */
	readonly finishCard?: { readonly current: StageFinishCardPort | null };
};

export type StageAdapterFactory = (services: StageAdapterServices) => StageAdapter;

/** Host-owned sources the production target analysis reads, never authored data. */
export type StageTargetSources = {
	/**
	 * Analysis of one exact approved model derivative, keyed by its pin digest.
	 * The route fills this from the same owner-only derivative bytes the Stage
	 * draws; a missing digest stays a strict `target-pending` refusal.
	 */
	readonly models?: ModelDerivativeAnalysisProvider;
};

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
	finishCard?: () => StageFinishCardPort | null,
	materialProofs?: import('$lib/authoring/material-proof').MaterialProofRegistry,
	targetSources?: StageTargetSources,
): StageAdapterServices {
	return {
		stage,
		materialProofs: materialProofs ?? createMaterialProofRegistry(),
		targetAnalysis: createSceneTargetAnalysis({
			read: () => {
				const snapshot = stage.snapshot();
				const domain = snapshot.domain;
				let digests: ReadonlyMap<string, string> | null = null;
				return {
					scene: domain.scene,
					sceneRevision: domain.unitRevisions.scene,
					layoutRevision: domain.unitRevisions.layout,
					geometry: domain.geometry,
					modelDigest(assetId: string): string | null {
						if (digests === null) {
							const pins = new Map<string, string>();
							for (const resource of stageEnvelope(snapshot).units.resources.data.resources) {
								if (
									resource.kind !== 'model' ||
									resource.pin === null ||
									resource.unresolved !== null
								)
									continue;
								pins.set(resource.id, resource.pin.hash);
							}
							digests = pins;
						}
						return digests.get(assetId) ?? null;
					},
				};
			},
			...(targetSources?.models === undefined ? {} : { models: targetSources.models }),
		}),
		finishCard: {
			get current() {
				return finishCard?.() ?? null;
			},
		},
		authoring: {
			registerPlanner: (planner) => host.registerPlanner(planner),
			accept: (intent) => host.accept(intent),
			acceptedRevision: () => host.acceptedRevision(),
		},
	};
}

export function mountStageAdapter(
	stage: StageFacade,
	host: StageAcceptanceHost,
	factory: StageAdapterFactory,
	finishCard?: () => StageFinishCardPort | null,
	/**
	 * The epoch's one services value, when the caller already composed it (the
	 * route fills `lightInspection` there). A fresh value is only for a direct
	 * test mount that has no route-owned ports to carry.
	 */
	services?: StageAdapterServices,
	/** Route-owned target sources, used only when composing a fresh services value. */
	targetSources?: StageTargetSources,
): StageAdapterRegistration {
	return stage.registerStageAdapter(
		factory(
			services ?? createStageAdapterServices(stage, host, finishCard, undefined, targetSources),
		),
	);
}
