/**
 * The Scene editing surface: placement plus the bounded uniform Resize,
 * duplicate and delete commands.
 *
 * A framework-free placement session over the pure Scene planners and the
 * Stage's one gesture lease:
 *
 * - **Arming is session state only.** No document, history or view changes when
 *   Place/Move/Yaw is armed; Place stays armed after a success until Select or
 *   Esc disarms it.
 * - **The displayed candidate is the committed candidate.** Preview and commit
 *   call the **same** pure planner with the same captured inputs; the last
 *   displayed pose is what the intent carries, so there is no post-preview Y
 *   correction.
 * - **Snap is the shared Stage fact.** The session applies the increment its
 *   adapter supplies from `StageAdapterContext.drafting()`; it owns no switch
 *   and no default. The step is applied to the captured candidate and reported
 *   in feedback. It never becomes a hidden commit-time correction.
 * - **One cancel path.** The lease policy is `cancel-on-reading-change`; Esc,
 *   blur, capture loss, replacement and adapter unmount all use `cancel()`,
 *   which restores the accepted baseline and releases the lease exactly once.
 * - **Scene mutates Scene only.** Support is resolved by the retained planner
 *   from compiled Layout; this session never writes Layout.
 * - **Compose adds no second writer.** Resize, duplicate and delete all build the
 *   same F.4 intent shape the move/yaw paths use, and each previews through the
 *   same retained planner that commit calls. Resize resolves its contact on the
 *   entity's own accepted X/Z inside the planner, so the shown Y and the
 *   installed Y cannot disagree.
 */

import {
	type CreatorModelResourceEntry,
	type NormalizedPlacementDefinition,
	type SceneSupportChoice
} from '@portfolio/project-model/scene-planning';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SceneEntity, SceneFormSource, Vec3 } from '@portfolio/project-model/scene';
import type { FormLibraryPayload } from '@portfolio/project-model/library';
import type {
	CameraFreeSceneDocument,
	LayoutUnitPayload,
} from '@portfolio/project-model/units';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-adapter-host';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope, stageLayout, stageScene, stageUnitRevision } from '$lib/authoring/stage/stage-adapter-host';
import {
	snapDraftingPlacement
} from '$lib/authoring/stage/stage-adapter-host';

import {
	catalogueModelContactMinY,
	type NativePlacementPrimitive
} from '../../scene/object-definition-policy';

import { createSceneSession } from './scene-session';
export { createSceneSession } from './scene-session';
export { sceneModelContactMinY } from '$lib/authoring/model-contact';
export {
	localContactMinY,
	parseNumber,
	sceneComposeSupport,
	sceneEntityReference,
	sceneReadingKey,
	sceneSurfaceFor,
	publishSceneSurface,
	retireSceneSurface,
	type SceneComposeSupport,
	type SceneSurface
} from './scene-placement-support';

/**
 * The shared drafting snap applied to one **free** scene placement.
 *
 * Only the plan position rounds: the support-resolved elevation and the retain
 * yaw are not placement coordinates and are never re-derived from the snapped
 * point here. A null or non-positive increment is off, not a zero step.
 */
export function snapFreePlacement(
	point: readonly [number, number],
	incrementMeters: number | null
): { readonly x: number; readonly z: number; readonly snappedStep: number | null } {
	return snapDraftingPlacement(point, incrementMeters);
}

export type SceneWriteOutcome =
	| { readonly kind: 'installed' | 'unchanged' | 'no-op' }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string };

export type SceneWritePort = {
	accept(intent: AuthoringIntent): Promise<SceneWriteOutcome>;
	acceptedRevision(): { readonly revisionId: string };
	acquireGesture(request: {
		readonly owner: string;
		readonly evaluationId: string;
		readonly policy: 'continue-after-revalidation' | 'suspend-proposal' | 'cancel-on-reading-change';
	}): GestureAcquisition;
};

export type SceneEditingSnapshot = {
	readonly projectId: string;
	readonly contentRevision: string;
	/** The two unit payloads a Scene operation may read; Layout is read-only. */
	readonly source: {
		readonly layout: LayoutUnitPayload;
		readonly scene: CameraFreeSceneDocument;
	};
	/**
	 * The approved floor contact of one model instance, read from the accepted
	 * envelope's `model` resource. A creator model's contact is authored metadata,
	 * not a live mesh bound, so only the resource can answer it.
	 */
	readonly contactMinYFor?: (entity: SceneEntity) => number | null;
	readonly compileGeneration: string;
	readonly evaluationId: string;
	/**
	 * The live evaluation id, when the host can answer it.
	 *
	 * A proposal survives the redraws that follow it, so the id captured when the
	 * session was built is not the id the lease must name: a lease is acquired at
	 * `begin`, against whatever evaluation is live then. Without this the session
	 * would report the frame it was created in, which is a weaker claim than the
	 * token it actually ran against.
	 */
	readonly currentEvaluationId?: () => string | null;
};

export type SceneCandidate = {
	/**
	 * `place` proposes a new entity; `move`/`yaw`/`resize` propose an existing one.
	 * `resize` is uniform and keeps the entity's X/Z and yaw; its Y is the
	 * contact-resolved value the planner computed.
	 */
	readonly kind: 'move' | 'yaw' | 'resize' | 'place';
	readonly entityId: string | null;
	/** The placed primitive, or `null` for an existing entity. */
	readonly primitive: NativePlacementPrimitive | null;
	/** The exact world pose the planner would commit. */
	readonly position: Vec3;
	readonly rotation: Vec3;
	readonly worldXZ: readonly [number, number];
	readonly yaw: number;
	/** The uniform scale the candidate would install (`1` when unset). */
	readonly scale: number;
	/** Present only when snap was applied; feedback must show it. */
	readonly snappedStep: number | null;
	/** A creator model's confirmed footprint, so its ghost is its own extent. */
	readonly footprint?: { readonly width: number; readonly depth: number };
	/** Approved model-local floor contact used to seat a footprint proxy ghost. */
	readonly modelContactMinY?: number;
	/** The creator model resource key for the candidate-only Plan footprint. */
	readonly modelAssetId?: string;
	/** A My Objects copy's authored source, so the ghost is its own body. */
	readonly form?: SceneFormSource;
};

/**
 * One approved creator model armed for placement.
 *
 * `resource` is present only while the resource is not yet in the accepted
 * envelope: the first placement installs it with the entity. Later placements
 * reuse the accepted resource and lock and carry `null`.
 */
export type ArmedModelPlacement = {
	readonly definition: NormalizedPlacementDefinition;
	readonly resource: CreatorModelResourceEntry | null;
};

/**
 * One saved My Objects form armed for insertion.
 *
 * `contactMinY` is the evaluated contact of the item's own source (the panel
 * derives it once from the codec-verified bytes). The planner re-evaluates and
 * refuses a disagreement, so the captured value can never install a wrong Y.
 */
export type ArmedFormCopy = {
	/** The listed item's logical id, for this panel's armed marker only. */
	readonly itemId: string;
	readonly item: FormLibraryPayload;
	readonly contactMinY: number;
	/**
	 * Caller-supplied entity id for a cross-project transfer copy. The transfer
	 * mints it so the destination can tie settlement to this exact insertion; a
	 * normal My Objects copy leaves it absent and the planner allocates one.
	 */
	readonly entityId?: string;
};

export type SceneSessionOutcome =
	| { readonly kind: 'candidate'; readonly candidate: SceneCandidate }
	| { readonly kind: 'committed' }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string }
	| { readonly kind: 'invalid'; readonly code: 'blank' | 'non-finite' | 'malformed'; readonly message: string }
	/** The acceptance transport itself failed; the proposal is withdrawn. */
	| { readonly kind: 'failed'; readonly code: 'accept-failed'; readonly message: string }
	| { readonly kind: 'idle' };

export type ScenePlacementSession = {
	/** Arm/disarm is session state; no intent, no history. */
	armed(): 'select' | 'place' | 'move' | 'yaw' | 'resize';
	arm(mode: 'select' | 'place' | 'move' | 'yaw' | 'resize'): void;
	snapStep(): number | null;
	setSnapStep(step: number | null): void;
	begin(entityId: string): SceneSessionOutcome;
	/**
	 * Arm and begin one pointer placement: no document change, one gesture lease,
	 * and a candidate built by `previewPlace` until release.
	 */
	beginPlace(primitive: NativePlacementPrimitive): SceneSessionOutcome;
	/** The primitive pointer Place will propose; explicit, defaulting to `box`. */
	placePrimitive(): NativePlacementPrimitive;
	setPlacePrimitive(primitive: NativePlacementPrimitive): void;
	/** Arm one approved creator model for the next floor placement, or clear it. */
	setArmedModel(model: ArmedModelPlacement | null): void;
	armedModel(): ArmedModelPlacement | null;
	/** Arm one My Objects copy for insertion, or clear it. */
	setArmedFormCopy(copy: ArmedFormCopy | null): void;
	armedFormCopy(): ArmedFormCopy | null;
	/** Begin one pointer insertion of an armed My Objects copy. */
	beginPlaceFormCopy(copy: ArmedFormCopy): SceneSessionOutcome;
	/** Preview one My Objects insertion at a resolved floor elevation. */
	previewPlaceFormCopy(
		copy: ArmedFormCopy,
		x: number,
		z: number,
		supportElevation: number,
		choice?: SceneSupportChoice,
		/** The increment the caller already applied; omission reports none. */
		snappedStep?: number | null
	): SceneSessionOutcome;
	/** Place one My Objects copy at exact X/Z; the saved source is written verbatim. */
	placeFormCopy(
		copy: ArmedFormCopy,
		x: number,
		z: number,
		choice?: SceneSupportChoice
	): Promise<SceneSessionOutcome>;
	/** Begin one pointer placement of the armed creator model. */
	beginPlaceModel(model: ArmedModelPlacement): SceneSessionOutcome;
	/** Preview one creator-model placement at a resolved floor elevation. */
	previewPlaceModel(
		model: ArmedModelPlacement,
		x: number,
		z: number,
		supportElevation: number,
		/** The increment the caller already applied; omission reports none. */
		snappedStep?: number | null,
		/** The support the pointer preview showed, pinned for this commit. */
		choice?: SceneSupportChoice
	): SceneSessionOutcome;
	previewMove(x: number, z: number): SceneSessionOutcome;
	previewYaw(radians: number): SceneSessionOutcome;
	/** Begin one uniform Resize of the selected entity under the host lease. */
	beginResize(entityId: string): SceneSessionOutcome;
	/**
	 * Preview a uniform scale. The planner owns the support/contact result, so the
	 * shown Y is the Y commit installs; X/Z and yaw are preserved.
	 */
	previewResize(scale: number): SceneSessionOutcome;
	/** Exact typed scale entry; blank/non-finite/non-positive never become a scale. */
	setResizeEntry(text: string): SceneSessionOutcome;
	/** Commit the shown Resize candidate once, through the same planner. */
	commitResize(): Promise<SceneSessionOutcome>;
	/**
	 * Duplicate one entity at the planner's fixed +0.5 m world offset, with a
	 * captured new id. A cluster member is refused by the planner, never regrouped.
	 */
	duplicate(entityId: string): Promise<SceneSessionOutcome>;
	/** Delete exactly one entity; membership cleanup belongs to the planner. */
	remove(entityId: string): Promise<SceneSessionOutcome>;
	/**
	 * Preview one placement at a resolved floor elevation. The displayed candidate
	 * carries the exact X/Z and the contact-resolved Y the planner installs.
	 */
	previewPlace(
		primitive: NativePlacementPrimitive,
		x: number,
		z: number,
		supportElevation: number,
		/** The increment the caller already applied; omission reports none. */
		snappedStep?: number | null,
		/** The support the pointer preview showed, pinned for this commit. */
		choice?: SceneSupportChoice
	): SceneSessionOutcome;
	/**
	 * Withdraw the displayed candidate without ending the subject or the lease: a
	 * pointer move that no longer has valid support must not leave an obsolete pose
	 * committable on release.
	 */
	invalidatePreview(): void;
	/** End a pointer interruption without disarming an armed Place tool. */
	abortGesture(): void;
	setEntry(kind: 'x' | 'z' | 'yaw', text: string): SceneSessionOutcome;
	commit(): Promise<SceneSessionOutcome>;
	/** Commit the displayed placement candidate; Place stays armed on success. */
	commitPlace(): Promise<SceneSessionOutcome>;
	place(primitive: NativePlacementPrimitive, x: number, z: number): Promise<SceneSessionOutcome>;
	cancel(): void;
	/** The accepted baseline the cancel path restores. */
	baseline(): { readonly position: Vec3; readonly rotation: Vec3 } | null;
	/** The entity the last successful Place allocated, for the host's selection. */
	placedEntityId(): string | null;
	/** The entity this proposal reads, or `null` when nothing is being edited. */
	subjectEntityId(): string | null;
	/** The captured pose currently shown, or `null` when no proposal is displayed. */
	candidate(): SceneCandidate | null;
	/**
	 * Whether a granted gesture lease is still active, i.e. the host has not ended
	 * it with a reading change.
	 *
	 * This is the one authority on whether a proposal may outlive the frame it was
	 * prepared in: a redraw keeps the lease, while a reading change
	 * (`applyReadingChange`), a content install, a task close or teardown release
	 * it.
	 */
	proposalLive(): boolean;
	/** Let the pointer adapter report its planner outcome through the open instrument. */
	setPointerOutcomeListener(listener: ((outcome: SceneSessionOutcome) => void) | null): void;
	reportPointerOutcome(outcome: SceneSessionOutcome): void;
	/**
	 * The one listener notified synchronously after this session commits a
	 * placement. The adapter uses it to select the new entity and to keep its
	 * persistent Place task open after its own install closed it; both pointer and
	 * typed entry share this path. It receives the entity the commit installed
	 * rather than closing over one session, so a reading change — which replaces
	 * the session without rebuilding the adapter binding — can carry it to
	 * whichever session carries the creator's next commit. Setting `null` clears
	 * it.
	 */
	setPlacementCommittedListener(listener: ((placedEntityId: string | null) => void) | null): void;
	placementCommittedListener(): ((placedEntityId: string | null) => void) | null;
};

/** Build the session from the public adapter services. */
export function sceneSessionFromServices(input: {
	readonly services: StageAdapterServices;
	readonly evaluationId: string;
}): ScenePlacementSession {
	const snapshot = input.services.stage.snapshot();
	const source = { layout: stageLayout(snapshot), scene: stageScene(snapshot) };
	// A creator model's floor contact is approved metadata: read it from the
	// accepted envelope's `model` resource, never from a live mesh bound.
	const modelContacts = new Map<string, number>();
	for (const resource of stageEnvelope(snapshot).units.resources.data.resources) {
		if (resource.kind === 'model' && resource.model !== undefined) {
			modelContacts.set(resource.id, resource.model.placement.contactMinY);
		}
	}
	return createSceneSession({
		snapshot: {
			projectId: snapshot.acceptedRevision.projectId,
			contentRevision: stageUnitRevision(snapshot, 'scene'),
			source,
			contactMinYFor: (entity) =>
				entity.kind === 'model'
					? modelContacts.get(entity.assetId) ?? catalogueModelContactMinY(entity.assetId)
					: null,
			compileGeneration: snapshot.compileGeneration,
			evaluationId: input.evaluationId,
			currentEvaluationId: () => input.services.stage.evaluationId()
		},
		port: {
			accept: async (intent) => {
				const outcome = await input.services.authoring.accept(intent);
				switch (outcome.kind) {
					case 'installed':
					case 'unchanged':
					case 'no-op':
						return { kind: outcome.kind };
					case 'refused':
						return { kind: 'refused', code: outcome.code, message: outcome.message };
				}
			},
			acceptedRevision: () => ({
				revisionId: input.services.authoring.acceptedRevision().revisionId
			}),
			acquireGesture: (request) => input.services.stage.acquireGesture(request)
		}
	});
}
