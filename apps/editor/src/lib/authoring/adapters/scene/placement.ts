/**
 * T2.P01.S03/S04 — the first coherent Scene editing surface, bounded by S04's
 * uniform Resize, duplicate and delete commands.
 *
 * A framework-free placement session over `T2.P01.S02`'s pure planners and
 * `T1.P01.S07`'s one gesture lease:
 *
 * - **Arming is session state only.** No document, history or view changes when
 *   Place/Move/Yaw is armed; Place stays armed after a success until Select or
 *   Esc disarms it.
 * - **The displayed candidate is the committed candidate.** Preview and commit
 *   call the **same** pure planner with the same captured inputs; the last
 *   displayed pose is what the intent carries, so there is no post-preview Y
 *   correction.
 * - **Snap is an explicit session option.** It is off by default; when enabled
 *   the step is applied to the captured candidate and reported in feedback. It
 *   never becomes a hidden commit-time correction.
 * - **One cancel path.** The lease policy is `cancel-on-reading-change`; Esc,
 *   blur, capture loss, replacement and adapter unmount all use `cancel()`,
 *   which restores the accepted baseline and releases the lease exactly once.
 * - **Scene mutates Scene only.** Support is resolved by the retained planner
 *   from compiled Layout; this session never writes Layout.
 * - **S04 adds no second writer.** Resize, duplicate and delete all build the
 *   same F.4 intent shape the move/yaw paths use, and each previews through the
 *   same retained planner that commit calls. Resize resolves its contact on the
 *   entity's own accepted X/Z inside the planner, so the shown Y and the
 *   installed Y cannot disagree.
 */

import {
	creatorModelResourcePayload,
	floorTransformSupport,
	planMoveHorizontal,
	planResizeOnFloor,
	planSetYaw,
	type CreatorModelResourceEntry,
	type NormalizedPlacementDefinition,
	type SceneOperationContext,
	type SceneOperationResult
} from '@portfolio/project-model/scene-planning';
import type { AuthoringIntent, SceneEntity, Vec3 } from '@portfolio/project-model';
import type {
	CameraFreeSceneDocument,
	LayoutUnitPayload,
	ProjectEnvelope
} from '@portfolio/project-model/units';
import type { FrameReference, SemanticReference } from '@portfolio/project-model';
import type { ViewportEvaluation } from '@portfolio/camera-core';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-session';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageEnvelope, stageLayout, stageScene, stageUnitRevision } from '$lib/authoring/stage/unit-stage-source';

import {
	nativePlacementContactMinY,
	nativePlacementDefinition,
	type NativePlacementPrimitive
} from '../../scene/object-definition-policy';

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
	/** Begin one pointer placement of the armed creator model. */
	beginPlaceModel(model: ArmedModelPlacement): SceneSessionOutcome;
	/** Preview one creator-model placement at a resolved floor elevation. */
	previewPlaceModel(
		model: ArmedModelPlacement,
		x: number,
		z: number,
		supportElevation: number
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
		supportElevation: number
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

/**
 * The one live Scene surface for one reading of one accepted source.
 *
 * The handle is keyed by the **accepted source read** it belongs to, not by a
 * module-global "current" slot. A replacement mounts a different snapshot, a
 * content change installs a new snapshot object, and two concurrent Stage
 * sessions hold different snapshots, so none of them can publish over, read, or
 * retire another's surface. Entries are weakly held: a replaced snapshot becomes
 * unreachable and its surface goes with it.
 */
export type SceneSurface = {
	/** The reading this surface's candidate was prepared for. */
	readonly reading: string;
	readonly session: ScenePlacementSession;
};

/**
 * The stable identity of one **reading**.
 *
 * The evaluation token's `evaluationGeneration` advances on every frame the
 * Stage draws, so an id that carries it names one frame, not one reading. A
 * proposal spans many frames — it is prepared, redrawn and redrawn again before
 * it is committed — so surfaces, and the sessions that hold proposals, are keyed
 * by this: the output, the host session, the accepted source revision and the
 * settled reading. A genuine reading change (Plan↔3D, a replaced source or a new
 * host session) changes the key; a redraw of the same reading does not.
 */
export function sceneReadingKey(evaluation: ViewportEvaluation): string {
	const token = evaluation.token;
	return `${token.outputId}::${token.sessionEpoch}::${token.sourceRevision}::${evaluation.settledReading}`;
}

const surfaces = new WeakMap<object, SceneSurface>();

/**
 * Publish the surface for one accepted snapshot and reading.
 *
 * A different **reading** for the same snapshot replaces the previous surface
 * after cancelling it, so a candidate or lease prepared for the reading that is
 * ending cannot survive it. A second publisher of the *same* reading only ends
 * any gesture the replaced session holds, so it cannot keep a lease the registry
 * no longer names. A redraw is neither: the same surface is simply re-registered.
 * A previous publisher's release is identity-checked and therefore cannot remove
 * the replacement.
 */
export function publishSceneSurface(snapshot: object, surface: SceneSurface): () => void {
	const previous = surfaces.get(snapshot);
	if (previous !== undefined && previous !== surface) {
		if (previous.reading !== surface.reading) {
			// A new reading invalidates the old proposal entirely.
			previous.session.cancel();
		} else {
			// Same reading, a second publisher: end any gesture it holds so the
			// replaced session cannot keep a lease the registry no longer names.
			previous.session.abortGesture();
		}
	}
	surfaces.set(snapshot, surface);
	return () => {
		if (surfaces.get(snapshot) === surface) surfaces.delete(snapshot);
	};
}

/** Remove the surface only if it is still the one this caller published. */
export function retireSceneSurface(snapshot: object, surface: SceneSurface): void {
	if (surfaces.get(snapshot) === surface) surfaces.delete(snapshot);
}

/**
 * The live surface for this exact accepted snapshot and reading, or `null`.
 *
 * Reads happen on every rendered frame, so this compares readings, not frame
 * ids: a candidate published once stays visible through the redraws that follow
 * it.
 */
export function sceneSurfaceFor(
	snapshot: object,
	evaluation: ViewportEvaluation
): SceneSurface | null {
	const surface = surfaces.get(snapshot) ?? null;
	return surface !== null && surface.reading === sceneReadingKey(evaluation) ? surface : null;
}

const PROJECT_WORLD: FrameReference = { version: 1, kind: 'project-world' };
const FRAME = { origin: [0, 0, 0] as Vec3, yaw: 0 };

/**
 * The canonical selection reference for one Scene entity at one accepted
 * revision. Canonical selection does **not** require a Plan fragment
 * (`StageSelectionEntry.representation` is optional), so a Scene-only subject is
 * selectable without fabricating Layout evidence.
 */
export function sceneEntityReference(entityId: string, contentRevision: string): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision },
		subject: { kind: 'entity', id: entityId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

function parseNumber(text: string): { ok: true; value: number } | { ok: false; code: 'blank' | 'non-finite' | 'malformed'; reason: string } {
	const trimmed = text.trim();
	if (trimmed.length === 0) return { ok: false, code: 'blank', reason: 'Enter a value; an empty field is not zero.' };
	const value = Number(trimmed);
	if (!Number.isFinite(value)) return { ok: false, code: 'non-finite', reason: 'The value must be finite.' };
	return { ok: true, value };
}

/**
 * Local bottom contact of one entity, or `null` when the planner must refuse.
 *
 * A creator model's contact is the approved resource's recorded contact, passed
 * in by the caller that can read the envelope; it is never measured here.
 */
export function localContactMinY(entity: SceneEntity, modelContactMinY?: number | null): number | null {
	if (entity.kind === 'model') {
		return typeof modelContactMinY === 'number' && Number.isFinite(modelContactMinY)
			? modelContactMinY
			: null;
	}
	// A form's contact is derived from its authored source through the one editor
	// evaluation cache, so the Card/Compose contact and the installed one agree
	// and no second kernel evaluation runs per recompute.
	if (entity.kind === 'form') return evaluateFormMesh(entity.form)?.contactMinY ?? null;
	if (entity.kind !== 'primitive') return null;
	switch (entity.primitive) {
		case 'box':
			return -entity.dimensions.height / 2;
		case 'cylinder':
			return -entity.dimensions.height / 2;
		case 'sphere':
			return -entity.dimensions.radius;
		default:
			return 0;
	}
}

export type SceneComposeSupport = {
	readonly resize: boolean;
	readonly duplicate: boolean;
	/** The refusal code a command reports, or `null` when both are available. */
	readonly code: 'missing-contact-metadata' | 'unsupported-transform' | null;
	/** Why Resize/Duplicate are unavailable, or `null` when both are. */
	readonly reason: string | null;
};

/**
 * The approved floor contact of one model entity, read from the accepted
 * envelope's `model` resource.
 *
 * This is the same metadata the placement session reads through
 * `contactMinYFor`; the Compose panel and the Card's Scale fact need it without
 * a session, so they read the resource here rather than guessing from a mesh or
 * treating every model as contact-less.
 */
export function sceneModelContactMinY(
	envelope: ProjectEnvelope,
	entity: SceneEntity
): number | null {
	if (entity.kind !== 'model') return null;
	for (const resource of envelope.units.resources.data.resources) {
		if (resource.kind === 'model' && resource.id === entity.assetId && resource.model !== undefined) {
			return resource.model.placement.contactMinY;
		}
	}
	return null;
}

/**
 * What Compose can truthfully do with one entity.
 *
 * Resize and Duplicate need a floor contact the retained planner can re-seat.
 * The admitted analytic primitives and approved creator models have one; a light
 * or an unapproved catalogue model does not, so offering the command would only
 * take the gesture lease and then refuse (and the adapter would advertise a
 * `Scale` fact that cannot be written). Delete needs no contact.
 *
 * A native form has a real contact but no uniform Resize: its size is per-axis
 * form source (`set-form-size`), and `resize-on-floor` refuses forms. So the
 * uniform affordance is not offered and no `Scale` fact is advertised, while
 * Duplicate — which copies the source verbatim — stays available.
 */
export function sceneComposeSupport(
	entity: SceneEntity,
	modelContactMinY?: number | null
): SceneComposeSupport {
	// The planner's own gate first: lights, vertical planes, tilted primitives and
	// primitives with no analytic contact are unsupported there, so the UI must not
	// offer them either.
	const planner = floorTransformSupport(entity);
	if (!planner.supported) {
		return { resize: false, duplicate: false, code: 'unsupported-transform', reason: planner.message };
	}
	if (localContactMinY(entity, modelContactMinY) === null) {
		return {
			resize: false,
			duplicate: false,
			code: 'missing-contact-metadata',
			reason:
				entity.kind === 'light'
					? 'A light has no verified floor contact; Resize and Duplicate are unavailable.'
					: entity.kind === 'form'
						? 'A form needs an evaluable source before it can be duplicated on the floor.'
						: 'A model needs a verified contact before it can be resized or duplicated on the floor.'
		};
	}
	if (entity.kind === 'form') {
		return {
			resize: false,
			duplicate: true,
			code: 'unsupported-transform',
			reason: 'A native form is sized per axis through its own source; uniform Resize is unavailable.'
		};
	}
	return { resize: true, duplicate: true, code: null, reason: null };
}

export function createSceneSession(input: {
	readonly snapshot: SceneEditingSnapshot;
	readonly port: SceneWritePort;
	readonly mintOperationId?: () => string;
}): ScenePlacementSession {
	const mint = input.mintOperationId ?? (() => globalThis.crypto.randomUUID());
	// The lease names the evaluation that is live when the gesture starts, not the
	// frame this session happened to be built in: a proposal survives the redraws
	// that follow it.
	const evaluationIdNow = (): string =>
		input.snapshot.currentEvaluationId?.() ?? input.snapshot.evaluationId;
	let mode: 'select' | 'place' | 'move' | 'yaw' | 'resize' = 'select';
	let snap: number | null = null;
	let lease: GestureAcquisition | null = null;
	let entityId: string | null = null;
	let candidate: SceneCandidate | null = null;
	let pointerOutcomeListener: ((outcome: SceneSessionOutcome) => void) | null = null;
	let baseline: { position: Vec3; rotation: Vec3 } | null = null;
	let entry = { x: '0', z: '0', yaw: '0' };
	let entryError: string | null = null;
	let lastPlacedEntityId: string | null = null;
	let placePrimitive: NativePlacementPrimitive = 'box';
	let armedModelPlacement: ArmedModelPlacement | null = null;
	let candidateModel: ArmedModelPlacement | null = null;
	let placementCommitted: ((placedEntityId: string | null) => void) | null = null;

	/**
	 * One committed placement, one notification. The listener is consumed so a
	 * second read cannot reopen twice; the adapter owns the reap-open policy.
	 */
	function notifyPlacementCommitted(): void {
		const listener = placementCommitted;
		placementCommitted = null;
		// The committing session names the entity; the listener never captures a
		// session, so the same listener stays correct after a reading-change carry-over.
		listener?.(lastPlacedEntityId);
	}

	function context(): SceneOperationContext {
		return {
			layout: input.snapshot.source.layout,
			scene: input.snapshot.source.scene,
			sourceContentId: input.snapshot.contentRevision
		};
	}

	function entityOf(id: string): SceneEntity | null {
		return input.snapshot.source.scene.entities.find((entity) => entity.id === id) ?? null;
	}

	/** The approved floor contact of one entity, when the envelope records it. */
	function contactOf(entity: SceneEntity): number | null {
		return input.snapshot.contactMinYFor?.(entity) ?? null;
	}

	/** The canonical uniform scale of an entity; an absent value is the identity. */
	function scaleOf(entity: SceneEntity): number {
		return typeof entity.scale === 'number' && Number.isFinite(entity.scale) ? entity.scale : 1;
	}

	function snapped(value: number): number {
		if (snap === null || !(snap > 0)) return value;
		return Math.round(value / snap) * snap;
	}

	function candidateFrom(result: SceneOperationResult, step: number | null): SceneSessionOutcome {
		if (result.kind === 'rejected') {
			// A refused proposal is not a candidate: keep no stale pose that a later
			// commit could install after the creator has stopped seeing it.
			candidate = null;
			return { kind: 'refused', code: result.code, message: result.message };
		}
		// Read the pose from the candidate Scene the planner built: that is exactly
		// what acceptance will install, so preview and commit cannot disagree.
		const next = result.scene.entities.find((entry) => entry.id === result.entityId);
		if (next === undefined) return { kind: 'refused', code: 'missing-target', message: 'The candidate entity vanished.' };
		return {
			kind: 'candidate',
			candidate: {
				kind:
					result.operationKind === 'set-yaw'
						? 'yaw'
						: result.operationKind === 'resize-on-floor'
							? 'resize'
							: 'move',
				entityId: next.id,
				primitive: null,
				position: [...next.position] as Vec3,
				rotation: [...next.rotation] as Vec3,
				worldXZ: [next.position[0], next.position[2]],
				yaw: next.rotation[1],
				scale: scaleOf(next),
				snappedStep: step
			}
		};
	}

	/** One preview path for pointer drag and exact entry; `useSnap` is explicit. */
	function moveCandidate(x: number, z: number, useSnap: boolean): SceneSessionOutcome {
		if (entityId === null) return { kind: 'refused', code: 'no-subject', message: 'Choose a Scene entity first.' };
		const entity = entityOf(entityId);
		if (entity === null) {
			candidate = null;
			return { kind: 'refused', code: 'missing-target', message: 'The entity no longer exists.' };
		}
		const contactMinY = localContactMinY(entity, contactOf(entity));
		if (contactMinY === null) {
			candidate = null;
			return {
				kind: 'refused',
				code: 'missing-contact-metadata',
				message: 'A model needs a verified contact before it can be moved on the floor.'
			};
		}
		if (!Number.isFinite(x) || !Number.isFinite(z)) {
			candidate = null;
			return { kind: 'invalid', code: 'non-finite', message: 'X/Z must be finite meters.' };
		}
		const step = useSnap ? snap : null;
		const worldXZ: [number, number] = [step === null ? x : snapped(x), step === null ? z : snapped(z)];
		const outcome = candidateFrom(
			planMoveHorizontal({ context: context(), entityId, worldXZ, frame: FRAME, contactMinY }),
			step
		);
		if (outcome.kind === 'candidate') candidate = outcome.candidate;
		return outcome;
	}

	/**
	 * One uniform Resize proposal.
	 *
	 * The retained planner resolves support at the entity's own accepted X/Z and
	 * re-seats Y from `elevation - scale * contactMinY`. That single result is what
	 * this candidate shows and what commit evaluates again, so a preview can never
	 * display a Y the install would correct.
	 */
	function resizeCandidate(scale: number): SceneSessionOutcome {
		if (entityId === null) return { kind: 'refused', code: 'no-subject', message: 'Choose a Scene entity first.' };
		if (!Number.isFinite(scale)) {
			candidate = null;
			return { kind: 'invalid', code: 'non-finite', message: 'Scale must be a finite number.' };
		}
		if (scale <= 0) {
			candidate = null;
			return { kind: 'invalid', code: 'malformed', message: 'Scale must be greater than zero.' };
		}
		const entity = entityOf(entityId);
		if (entity === null) {
			candidate = null;
			return { kind: 'refused', code: 'missing-target', message: 'The entity no longer exists.' };
		}
		const contactMinY = localContactMinY(entity, contactOf(entity));
		if (contactMinY === null) {
			candidate = null;
			return {
				kind: 'refused',
				code: 'missing-contact-metadata',
				message: 'A model needs a verified contact before it can be resized on the floor.'
			};
		}
		const outcome = candidateFrom(
			planResizeOnFloor({ context: context(), entityId, scale, contactMinY }),
			null
		);
		if (outcome.kind === 'candidate') candidate = outcome.candidate;
		return outcome;
	}

	function yawCandidate(radians: number): SceneSessionOutcome {
		if (entityId === null) return { kind: 'refused', code: 'no-subject', message: 'Choose a Scene entity first.' };
		if (!Number.isFinite(radians)) {
			candidate = null;
			return { kind: 'invalid', code: 'non-finite', message: 'The angle must be finite radians.' };
		}
		const outcome = candidateFrom(
			planSetYaw({ context: context(), entityId, yaw: radians, frame: FRAME }),
			null
		);
		if (outcome.kind === 'candidate') candidate = outcome.candidate;
		return outcome;
	}

	function intent(
		kind: string,
		payload: AuthoringIntent['payload'],
		options: {
			readonly entityId?: string;
			readonly allocatedIds?: AuthoringIntent['allocatedIds'];
		} = {}
	): AuthoringIntent {
		const addressedId = options.entityId ?? entityId;
		const entity = addressedId === null ? null : entityOf(addressedId);
		const reference = entity === null ? [] : [
			{
				version: 1 as const,
				domain: 'scene' as const,
				revision: { kind: 'exact' as const, contentRevision: input.snapshot.contentRevision },
				subject: { kind: 'entity' as const, id: entity.id },
				instancePath: [],
				location: { kind: 'project-root' as const },
				componentId: null,
				capabilityId: null
			}
		];
		return {
			version: 1,
			kind,
			operationId: mint(),
			expectedRevision: {
				projectId: input.snapshot.projectId,
				revisionId: input.port.acceptedRevision().revisionId
			},
			targets: reference,
			payload,
			capturedInputs: [],
			allocatedIds: [...(options.allocatedIds ?? [])]
		};
	}

	/** The host's reading-change policy can end the lease underneath a preview. */
	function leaseIsLive(): boolean {
		return lease !== null && lease.kind === 'granted' && lease.lease.active;
	}

	function release(): void {
		if (lease !== null && lease.kind === 'granted') lease.lease.release();
		lease = null;
	}

	/**
	 * End a proposal that did not install: release the lease and stop showing a
	 * pose that can no longer be committed. The subject stays editable, so the
	 * creator can preview again or cancel explicitly.
	 */
	function withdraw(): void {
		release();
		candidate = null;
		candidateModel = null;
		entryError = null;
	}

	/** One placement preview and commit path share this captured proposal. */
	function placeCandidate(
		primitive: NativePlacementPrimitive,
		x: number,
		z: number,
		supportElevation: number
	): SceneSessionOutcome {
		if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(supportElevation)) {
			candidate = null;
			return { kind: 'invalid', code: 'non-finite', message: 'X/Z and the support elevation must be finite meters.' };
		}
		const step = snap === null || !(snap > 0) ? null : snap;
		const worldXZ: [number, number] = [step === null ? x : snapped(x), step === null ? z : snapped(z)];
		const contactMinY = nativePlacementContactMinY(primitive);
		const next: SceneCandidate = {
			kind: 'place',
			entityId: null,
			primitive,
			position: [worldXZ[0], supportElevation - contactMinY, worldXZ[1]],
			rotation: [0, 0, 0],
			worldXZ,
			yaw: 0,
			scale: 1,
			snappedStep: step
		};
		candidate = next;
		return { kind: 'candidate', candidate: next };
	}

	/** The occupied X/Z extent of one definition's canonical footprint. */
	function footprintOf(definition: NormalizedPlacementDefinition): { width: number; depth: number } {
		let minX = Infinity;
		let maxX = -Infinity;
		let minZ = Infinity;
		let maxZ = -Infinity;
		for (const [x, z] of definition.footprintMeters) {
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minZ = Math.min(minZ, z);
			maxZ = Math.max(maxZ, z);
		}
		return {
			width: Number.isFinite(maxX - minX) ? maxX - minX : 1,
			depth: Number.isFinite(maxZ - minZ) ? maxZ - minZ : 1
		};
	}

	/** One creator-model placement preview; the same candidate is committed. */
	function placeModelCandidate(
		model: ArmedModelPlacement,
		x: number,
		z: number,
		supportElevation: number
	): SceneSessionOutcome {
		if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(supportElevation)) {
			candidate = null;
			candidateModel = null;
			return { kind: 'invalid', code: 'non-finite', message: 'X/Z and the support elevation must be finite meters.' };
		}
		const step = snap === null || !(snap > 0) ? null : snap;
		const worldXZ: [number, number] = [step === null ? x : snapped(x), step === null ? z : snapped(z)];
		const next: SceneCandidate = {
			kind: 'place',
			entityId: null,
			primitive: null,
			position: [worldXZ[0], supportElevation - model.definition.contactMinY, worldXZ[1]],
			rotation: [0, 0, 0],
			worldXZ,
			yaw: 0,
			scale: 1,
			snappedStep: step,
			footprint: footprintOf(model.definition)
		};
		candidate = next;
		candidateModel = model;
		return { kind: 'candidate', candidate: next };
	}

	/**
	 * Accept one immediate command (duplicate/delete) without a preview or a lease.
	 *
	 * Duplicate reports the entity it created through the same completion listener
	 * Place uses, so the adapter can select the copy exactly as it selects a placed
	 * object. Delete reports nothing: the accepted correspondence retires the
	 * subject, and the host's own requalification clears the selection.
	 */
	async function acceptOne(
		intentToAccept: AuthoringIntent,
		createdEntityId: string | null
	): Promise<SceneSessionOutcome> {
		let outcome: Awaited<ReturnType<SceneWritePort['accept']>>;
		try {
			outcome = await input.port.accept(intentToAccept);
		} catch (error) {
			return {
				kind: 'failed',
				code: 'accept-failed',
				message: error instanceof Error ? error.message : 'The accepted install failed.'
			};
		}
		if (outcome.kind === 'refused') return outcome;
		if (createdEntityId !== null) {
			lastPlacedEntityId = createdEntityId;
			notifyPlacementCommitted();
		}
		return { kind: 'committed' };
	}

	/** The one F4 placement intent, captured from an exact world X/Z and definition. */
	async function acceptPlacement(
		primitive: NativePlacementPrimitive,
		worldXZ: readonly [number, number]
	): Promise<SceneSessionOutcome> {
		const definition = await nativePlacementDefinition(primitive).catch(() => null);
		if (definition === null) {
			return { kind: 'refused', code: 'missing-definition', message: 'That object definition is not admitted.' };
		}
		const allocatedId = `entity-${mint()}`;
		const intentToAccept: AuthoringIntent = {
			version: 1,
			kind: 'place-object',
			operationId: mint(),
			expectedRevision: {
				projectId: input.snapshot.projectId,
				revisionId: input.port.acceptedRevision().revisionId
			},
			targets: [],
			payload: {
				definitionKey: definition.definitionKey,
				metadataContentId: definition.metadataContentId,
				worldXZ: [worldXZ[0], worldXZ[1]],
				yaw: 0,
				frame: FRAME,
				frameReference: PROJECT_WORLD
			},
			capturedInputs: [],
			allocatedIds: [{ kind: 'scene-entity', id: allocatedId }]
		};
		let outcome: Awaited<ReturnType<SceneWritePort['accept']>>;
		try {
			outcome = await input.port.accept(intentToAccept);
		} catch (error) {
			return {
				kind: 'failed',
				code: 'accept-failed',
				message: error instanceof Error ? error.message : 'The accepted install failed.'
			};
		}
		if (outcome.kind === 'refused') return outcome;
		lastPlacedEntityId = allocatedId;
		return { kind: 'committed' };
	}

	/**
	 * The one creator-model placement intent.
	 *
	 * The first placement carries the approved resource and its exact lock so the
	 * entity, resource and pin install as one accepted result; a later placement
	 * of an already-approved model omits the introduction and reuses the accepted
	 * resource, adding only a distinct entity identity.
	 */
	async function acceptModelPlacement(
		model: ArmedModelPlacement,
		worldXZ: readonly [number, number]
	): Promise<SceneSessionOutcome> {
		const definition = model.definition;
		if (definition.creationDefaults.kind !== 'model') {
			return { kind: 'refused', code: 'missing-definition', message: 'That definition is not a creator model.' };
		}
		const allocatedId = `entity-${mint()}`;
		const intentToAccept: AuthoringIntent = {
			version: 1,
			kind: 'place-object',
			operationId: mint(),
			expectedRevision: {
				projectId: input.snapshot.projectId,
				revisionId: input.port.acceptedRevision().revisionId
			},
			targets: [],
			payload: {
				definitionKey: definition.definitionKey,
				metadataContentId: definition.metadataContentId,
				worldXZ: [worldXZ[0], worldXZ[1]],
				yaw: 0,
				frame: FRAME,
				frameReference: PROJECT_WORLD,
				...(model.resource === null ? {} : { modelResource: creatorModelResourcePayload(model.resource) })
			},
			capturedInputs: [],
			allocatedIds: [{ kind: 'scene-entity', id: allocatedId }]
		};
		let outcome: Awaited<ReturnType<SceneWritePort['accept']>>;
		try {
			outcome = await input.port.accept(intentToAccept);
		} catch (error) {
			return {
				kind: 'failed',
				code: 'accept-failed',
				message: error instanceof Error ? error.message : 'The accepted install failed.'
			};
		}
		if (outcome.kind === 'refused') return outcome;
		lastPlacedEntityId = allocatedId;
		return { kind: 'committed' };
	}

	const session: ScenePlacementSession = {
		armed: () => mode,
		arm(next) {
			mode = next;
		},
		snapStep: () => snap,
		setSnapStep(step) {
			snap = step === null || !Number.isFinite(step) || step <= 0 ? null : step;
		},
		beginResize(id) {
			const entity = entityOf(id);
			if (entity === null) {
				return { kind: 'refused', code: 'missing-target', message: `No Scene entity "${id}".` };
			}
			// The refusal is the begin: a subject the planner cannot transform must
			// never take the lease, so Undo never reports a proposal that cannot exist.
			const support = sceneComposeSupport(entity, contactOf(entity));
			if (!support.resize) {
				return {
					kind: 'refused',
					code: support.code ?? 'unsupported-transform',
					message: support.reason ?? 'Resize is unavailable.'
				};
			}
			release();
			lease = input.port.acquireGesture({
				owner: 'scene-compose',
				evaluationId: evaluationIdNow(),
				policy: 'cancel-on-reading-change'
			});
			if (lease.kind === 'refused') {
				return {
					kind: 'refused',
					code: lease.code,
					message: lease.code === 'gesture-held' ? `Another ${lease.owner} gesture is live.` : 'This editing session is stale.'
				};
			}
			mode = 'resize';
			entityId = id;
			baseline = { position: [...entity.position] as Vec3, rotation: [...entity.rotation] as Vec3 };
			entry = { x: String(entity.position[0]), z: String(entity.position[2]), yaw: String(entity.rotation[1]) };
			candidate = null;
			return { kind: 'idle' };
		},
		previewResize(scale) {
			return resizeCandidate(scale);
		},
		setResizeEntry(text) {
			const parsed = parseNumber(text);
			if (!parsed.ok) {
				entryError = parsed.reason;
				candidate = null;
				return { kind: 'invalid', code: parsed.code, message: parsed.reason };
			}
			entryError = null;
			return resizeCandidate(parsed.value);
		},
		async commitResize() {
			if (candidate === null || candidate.kind !== 'resize') {
				release();
				return { kind: 'refused', code: 'no-candidate', message: 'Preview a valid scale before committing.' };
			}
			return session.commit();
		},
		async duplicate(id) {
			const entity = entityOf(id);
			if (entity === null) {
				return { kind: 'refused', code: 'missing-target', message: `No Scene entity "${id}".` };
			}
			const support = sceneComposeSupport(entity, contactOf(entity));
			if (!support.duplicate) {
				return {
					kind: 'refused',
					code: support.code ?? 'unsupported-transform',
					message: support.reason ?? 'Duplicate is unavailable.'
				};
			}
			const contactMinY = localContactMinY(entity, contactOf(entity));
			if (contactMinY === null) {
				return { kind: 'refused', code: 'missing-contact-metadata', message: 'The entity has no verified contact.' };
			}
			const allocatedId = `entity-${mint()}`;
			return acceptOne(
				intent('duplicate-one', { entityId: id, contactMinY }, {
					entityId: id,
					allocatedIds: [{ kind: 'scene-entity', id: allocatedId }]
				}),
				allocatedId
			);
		},
		async remove(id) {
			if (entityOf(id) === null) {
				return { kind: 'refused', code: 'missing-target', message: `No Scene entity "${id}".` };
			}
			return acceptOne(intent('delete-one', { entityId: id }, { entityId: id }), null);
		},
		begin(id) {
			const entity = entityOf(id);
			if (entity === null) {
				return { kind: 'refused', code: 'missing-target', message: `No Scene entity "${id}".` };
			}
			release();
			lease = input.port.acquireGesture({
				owner: 'scene-transform',
				evaluationId: evaluationIdNow(),
				policy: 'cancel-on-reading-change'
			});
			if (lease.kind === 'refused') {
				return {
					kind: 'refused',
					code: lease.code,
					message: lease.code === 'gesture-held' ? `Another ${lease.owner} gesture is live.` : 'This editing session is stale.'
				};
			}
			entityId = id;
			baseline = { position: [...entity.position] as Vec3, rotation: [...entity.rotation] as Vec3 };
			entry = { x: String(entity.position[0]), z: String(entity.position[2]), yaw: String(entity.rotation[1]) };
			candidate = null;
			return { kind: 'idle' };
		},
		beginPlace(primitive) {
			release();
			// An explicit native primitive is the placement this gesture will show;
			// an armed creator model does not silently substitute itself.
			armedModelPlacement = null;
			candidateModel = null;
			lease = input.port.acquireGesture({
				owner: 'scene-transform',
				evaluationId: evaluationIdNow(),
				policy: 'cancel-on-reading-change'
			});
			if (lease.kind === 'refused') {
				return {
					kind: 'refused',
					code: lease.code,
					message: lease.code === 'gesture-held' ? `Another ${lease.owner} gesture is live.` : 'This editing session is stale.'
				};
			}
			mode = 'place';
			placePrimitive = primitive;
			entityId = null;
			baseline = null;
			candidate = null;
			entryError = null;
			return { kind: 'idle' };
		},
		placePrimitive: () => placePrimitive,
		setPlacePrimitive(primitive) {
			placePrimitive = primitive;
			// Choosing a native primitive is an explicit replacement of an armed model.
			armedModelPlacement = null;
			candidateModel = null;
		},
		setArmedModel(model) {
			armedModelPlacement = model;
			candidateModel = null;
		},
		armedModel: () => armedModelPlacement,
		beginPlaceModel(model) {
			// The lease comes from the same begin path a native placement uses; the
			// model is re-armed afterwards because that path clears an armed model on
			// purpose (an explicit primitive replaces it).
			const outcome = session.beginPlace('box');
			if (outcome.kind === 'refused') return outcome;
			armedModelPlacement = model;
			mode = 'place';
			return outcome;
		},
		previewPlaceModel(model, x, z, supportElevation) {
			mode = 'place';
			armedModelPlacement = model;
			return placeModelCandidate(model, x, z, supportElevation);
		},
		previewMove(x, z) {
			return moveCandidate(x, z, snap !== null);
		},
		previewYaw(radians) {
			return yawCandidate(radians);
		},
		previewPlace(primitive, x, z, supportElevation) {
			mode = 'place';
			placePrimitive = primitive;
			return placeCandidate(primitive, x, z, supportElevation);
		},
		invalidatePreview() {
			// The expression the creator is now pointing at has no valid support. The
			// previous pose is no longer what a release would install, so it must stop
			// being committable; the lease and the armed tool stay as they are.
			candidate = null;
			entryError = null;
		},
		abortGesture() {
			// Interruption (capture loss, blur, a reading change) ends this proposal
			// without disarming Place: only Esc/Select does that.
			release();
			entityId = null;
			candidate = null;
			entryError = null;
		},
		setEntry(kind, text) {
			const parsed = parseNumber(text);
			if (!parsed.ok) {
				entryError = parsed.reason;
				// The displayed candidate may no longer describe the typed pose, so it
				// cannot stay committable.
				candidate = null;
				return { kind: 'invalid', code: parsed.code, message: parsed.reason };
			}
			entryError = null;
			entry = { ...entry, [kind]: String(parsed.value) };
			// Exact entry is the retained exact access: it never inherits the gesture's
			// snap step. The captured candidate carries these exact numbers.
			const outcome =
				kind === 'yaw'
					? yawCandidate(parsed.value)
					: moveCandidate(Number(entry.x), Number(entry.z), false);
			// One proposal is one pose. A yaw entry is planned from the accepted X/Z
			// and a move entry keeps the accepted yaw, so the entry record is
			// renormalised from the candidate it just produced: otherwise the next
			// entry would plan from text the creator never saw as the candidate, and
			// the pose it installed would not be the one on screen.
			if (outcome.kind === 'candidate') {
				const captured = outcome.candidate;
				entry = {
					x: String(captured.position[0]),
					z: String(captured.position[2]),
					yaw: String(captured.yaw)
				};
			}
			return outcome;
		},
		async commit() {
			if (entityId === null || candidate === null || candidate.kind === 'place') {
				// Nothing is committable, so nothing may keep the gesture lease: a
				// withdrawn candidate must not leave Undo reporting a live proposal.
				release();
				return { kind: 'refused', code: 'no-candidate', message: 'Preview a valid pose before committing.' };
			}
			if (!leaseIsLive()) {
				// The host ended the lease (a reading change): the shown pose is no longer
				// this gesture's operation, so withdraw it rather than install it.
				withdraw();
				return { kind: 'refused', code: 'no-candidate', message: 'The preview was cancelled by a reading change.' };
			}
			const entity = entityOf(entityId);
			if (entity === null) {
				withdraw();
				return { kind: 'refused', code: 'missing-target', message: 'The entity no longer exists.' };
			}
			const contactMinY = localContactMinY(entity, contactOf(entity));
			if (contactMinY === null) {
				withdraw();
				return { kind: 'refused', code: 'missing-contact-metadata', message: 'The entity has no verified contact.' };
			}
			if (entryError !== null) {
				withdraw();
				return { kind: 'invalid', code: 'malformed', message: entryError };
			}
			// Capture the shown proposal before awaiting acceptance. An accepted
			// install closes the task and the adapter disposes this session, so the
			// live `candidate` may already be null when the transport resolves; the
			// pose that was installed is the one captured here.
			const committed = candidate;
			const intentToAccept =
				committed.kind === 'yaw'
					? intent('set-yaw', {
							entityId,
							yaw: committed.yaw,
							frame: FRAME,
							frameReference: PROJECT_WORLD
						})
					: committed.kind === 'resize'
						? intent('resize-on-floor', {
								entityId,
								scale: committed.scale,
								contactMinY
							})
						: intent('move-horizontal', {
								entityId,
								worldXZ: [committed.worldXZ[0], committed.worldXZ[1]],
								frame: FRAME,
								frameReference: PROJECT_WORLD,
								contactMinY
							});
			// A commit that does not install ends the proposal: whether acceptance
			// refuses it, the transport throws, or the shown pose stopped being
			// committable, the gesture lease is released here rather than held until
			// the task closes. Otherwise Undo would report a live proposal for a
			// proposal the creator can no longer see.
			let outcome: Awaited<ReturnType<SceneWritePort['accept']>>;
			try {
				outcome = await input.port.accept(intentToAccept);
			} catch (error) {
				withdraw();
				return {
					kind: 'failed',
					code: 'accept-failed',
					message: error instanceof Error ? error.message : 'The accepted install failed.'
				};
			}
			if (outcome.kind === 'refused') {
				withdraw();
				return { kind: 'refused', code: outcome.code, message: outcome.message };
			}
			// The committed pose is exactly the displayed candidate; the lease ends and
			// the accepted baseline is the new pose.
			release();
			baseline = { position: [...committed.position] as Vec3, rotation: [...committed.rotation] as Vec3 };
			entityId = null;
			candidate = null;
			return { kind: 'committed' };
		},
		async commitPlace() {
			if (candidate === null || candidate.kind !== 'place' || (candidate.primitive === null && candidateModel === null)) {
				release();
				return { kind: 'refused', code: 'no-candidate', message: 'Preview a valid placement before committing.' };
			}
			if (!leaseIsLive()) {
				// The host ended the lease under the preview; the pose must stop being
				// committable rather than installing behind a reading the creator left.
				withdraw();
				return { kind: 'refused', code: 'no-candidate', message: 'The preview was cancelled by a reading change.' };
			}
			lastPlacedEntityId = null;
			const worldXZ = candidate.worldXZ;
			const model = candidateModel;
			const outcome = model === null
				? candidate.primitive === null
					? { kind: 'refused' as const, code: 'no-candidate', message: 'Preview a valid placement before committing.' }
					: await acceptPlacement(candidate.primitive, worldXZ)
				: await acceptModelPlacement(model, worldXZ);
			if (outcome.kind !== 'committed') {
				withdraw();
				return outcome;
			}
			// The committed pose is exactly the displayed candidate, and Place stays
			// armed: a release never disarms the tool, only Esc/Select does. The model
			// itself is consumed by its placement, so the next release is a native
			// primitive unless the Library arms another model.
			release();
			candidate = null;
			candidateModel = null;
			armedModelPlacement = null;
			notifyPlacementCommitted();
			return { kind: 'committed' };
		},
		async place(primitive, x, z) {
			// An approved model armed for this project is what these coordinates place.
			// Choosing a primitive is the one explicit replacement (`setPlacePrimitive`),
			// so the typed form can no longer install a box behind a model approval.
			const model = armedModelPlacement;
			lastPlacedEntityId = null;
			if (!Number.isFinite(x) || !Number.isFinite(z)) {
				return { kind: 'invalid', code: 'non-finite', message: 'X/Z must be finite meters.' };
			}
			const outcome = model === null
				? await acceptPlacement(primitive, [snapped(x), snapped(z)])
				: await acceptModelPlacement(model, [snapped(x), snapped(z)]);
			if (outcome.kind === 'committed') {
				candidate = null;
				// The model is consumed by its placement; a failed attempt keeps the arm
				// so the creator can retry the same approved model.
				if (model !== null) {
					candidateModel = null;
					armedModelPlacement = null;
				}
				notifyPlacementCommitted();
			}
			return outcome;
		},
		placedEntityId: () => lastPlacedEntityId,
		subjectEntityId: () => entityId,
		candidate: () => candidate,
		proposalLive: leaseIsLive,
		setPointerOutcomeListener(listener) {
			pointerOutcomeListener = listener;
		},
		reportPointerOutcome(outcome) {
			pointerOutcomeListener?.(outcome);
		},
		setPlacementCommittedListener(listener) {
			placementCommitted = listener;
		},
		placementCommittedListener: () => placementCommitted,
		cancel() {
			release();
			entityId = null;
			candidate = null;
			entryError = null;
			// Esc/Select disarms Place per the editing-surface contract, and the armed
			// creator model returns to rest with it.
			mode = 'select';
			candidateModel = null;
			armedModelPlacement = null;
		},
		baseline: () => (baseline === null ? null : { position: [...baseline.position] as Vec3, rotation: [...baseline.rotation] as Vec3 })
	};
	return session;
}

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
			contactMinYFor: (entity) => (entity.kind === 'model' ? modelContacts.get(entity.assetId) ?? null : null),
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
