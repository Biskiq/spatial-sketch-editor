/**
 * T2.P01.S03 — the first coherent Scene editing surface.
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
 */

import {
	planMoveHorizontal,
	planSetYaw,
	type SceneOperationContext,
	type SceneOperationResult
} from '@portfolio/project-model';
import type { AuthoringIntent, ProjectDocument, SceneEntity, Vec3 } from '@portfolio/project-model';
import type { FrameReference, SemanticReference } from '@portfolio/project-model';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-session';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { currentStageSource } from '$lib/authoring/stage/current-stage-source';

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
	readonly source: ProjectDocument;
	readonly compileGeneration: string;
	readonly evaluationId: string;
};

export type SceneCandidate = {
	/** `place` proposes a new entity; `move`/`yaw` propose an existing one. */
	readonly kind: 'move' | 'yaw' | 'place';
	readonly entityId: string | null;
	/** The placed primitive, or `null` for an existing entity. */
	readonly primitive: NativePlacementPrimitive | null;
	/** The exact world pose the planner would commit. */
	readonly position: Vec3;
	readonly rotation: Vec3;
	readonly worldXZ: readonly [number, number];
	readonly yaw: number;
	/** Present only when snap was applied; feedback must show it. */
	readonly snappedStep: number | null;
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
	armed(): 'select' | 'place' | 'move' | 'yaw';
	arm(mode: 'select' | 'place' | 'move' | 'yaw'): void;
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
	previewMove(x: number, z: number): SceneSessionOutcome;
	previewYaw(radians: number): SceneSessionOutcome;
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
};

/**
 * The one live Scene surface for one evaluation of one accepted source.
 *
 * The handle is keyed by the **accepted source read** it belongs to, not by a
 * module-global "current" slot. A replacement mounts a different snapshot, a
 * content change installs a new snapshot object, and two concurrent Stage
 * sessions hold different snapshots, so none of them can publish over, read, or
 * retire another's surface. Entries are weakly held: a replaced snapshot becomes
 * unreachable and its surface goes with it.
 */
export type SceneSurface = {
	readonly evaluationId: string;
	readonly session: ScenePlacementSession;
};

const surfaces = new WeakMap<object, SceneSurface>();

export function activeSceneSurface(snapshot: object): SceneSurface | null {
	return surfaces.get(snapshot) ?? null;
}

/**
 * Publish the surface for one accepted snapshot and evaluation.
 *
 * A newer evaluation for the same snapshot replaces the previous surface after
 * cancelling it, so a stale candidate or lease cannot survive a reading change.
 * A previous publisher's release is identity-checked and therefore cannot remove
 * the replacement.
 */
export function publishSceneSurface(snapshot: object, surface: SceneSurface): () => void {
	const previous = surfaces.get(snapshot);
	if (previous !== undefined && previous !== surface) {
		if (previous.evaluationId !== surface.evaluationId) {
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

/** The live surface for this exact accepted snapshot and evaluation, or `null`. */
export function sceneSurfaceFor(
	snapshot: object,
	evaluationId: string
): SceneSurface | null {
	const surface = surfaces.get(snapshot) ?? null;
	return surface !== null && surface.evaluationId === evaluationId ? surface : null;
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

/** Local bottom contact of one entity, or `null` when the planner must refuse. */
export function localContactMinY(entity: SceneEntity): number | null {
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

export function createSceneSession(input: {
	readonly snapshot: SceneEditingSnapshot;
	readonly port: SceneWritePort;
	readonly mintOperationId?: () => string;
}): ScenePlacementSession {
	const mint = input.mintOperationId ?? (() => globalThis.crypto.randomUUID());
	let mode: 'select' | 'place' | 'move' | 'yaw' = 'select';
	let snap: number | null = null;
	let lease: GestureAcquisition | null = null;
	let entityId: string | null = null;
	let candidate: SceneCandidate | null = null;
	let baseline: { position: Vec3; rotation: Vec3 } | null = null;
	let entry = { x: '0', z: '0', yaw: '0' };
	let entryError: string | null = null;
	let lastPlacedEntityId: string | null = null;
	let placePrimitive: NativePlacementPrimitive = 'box';

	function context(): SceneOperationContext {
		return { project: input.snapshot.source, sourceContentId: input.snapshot.contentRevision };
	}

	function entityOf(id: string): SceneEntity | null {
		return input.snapshot.source.scene.entities.find((entity) => entity.id === id) ?? null;
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
				kind: result.operationKind === 'set-yaw' ? 'yaw' : 'move',
				entityId: next.id,
				primitive: null,
				position: [...next.position] as Vec3,
				rotation: [...next.rotation] as Vec3,
				worldXZ: [next.position[0], next.position[2]],
				yaw: next.rotation[1],
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
		const contactMinY = localContactMinY(entity);
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

	function intent(kind: string, payload: AuthoringIntent['payload']): AuthoringIntent {
		const entity = entityId === null ? null : entityOf(entityId);
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
			allocatedIds: []
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
			snappedStep: step
		};
		candidate = next;
		return { kind: 'candidate', candidate: next };
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

	return {
		armed: () => mode,
		arm(next) {
			mode = next;
		},
		snapStep: () => snap,
		setSnapStep(step) {
			snap = step === null || !Number.isFinite(step) || step <= 0 ? null : step;
		},
		begin(id) {
			const entity = entityOf(id);
			if (entity === null) {
				return { kind: 'refused', code: 'missing-target', message: `No Scene entity "${id}".` };
			}
			release();
			lease = input.port.acquireGesture({
				owner: 'scene-transform',
				evaluationId: input.snapshot.evaluationId,
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
			lease = input.port.acquireGesture({
				owner: 'scene-transform',
				evaluationId: input.snapshot.evaluationId,
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
			if (kind === 'yaw') return yawCandidate(parsed.value);
			return moveCandidate(Number(entry.x), Number(entry.z), false);
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
			const contactMinY = localContactMinY(entity);
			if (contactMinY === null) {
				withdraw();
				return { kind: 'refused', code: 'missing-contact-metadata', message: 'The entity has no verified contact.' };
			}
			if (entryError !== null) {
				withdraw();
				return { kind: 'invalid', code: 'malformed', message: entryError };
			}
			const intentToAccept =
				candidate.kind === 'yaw'
					? intent('set-yaw', {
							entityId,
							yaw: candidate.yaw,
							frame: FRAME,
							frameReference: PROJECT_WORLD
						})
					: intent('move-horizontal', {
							entityId,
							worldXZ: [candidate.worldXZ[0], candidate.worldXZ[1]],
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
			baseline = { position: [...candidate.position] as Vec3, rotation: [...candidate.rotation] as Vec3 };
			entityId = null;
			candidate = null;
			return { kind: 'committed' };
		},
		async commitPlace() {
			if (candidate === null || candidate.kind !== 'place' || candidate.primitive === null) {
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
			const outcome = await acceptPlacement(candidate.primitive, candidate.worldXZ);
			if (outcome.kind !== 'committed') {
				withdraw();
				return outcome;
			}
			// The committed pose is exactly the displayed candidate, and Place stays
			// armed: a release never disarms the tool, only Esc/Select does.
			release();
			candidate = null;
			return { kind: 'committed' };
		},
		async place(primitive, x, z) {
			lastPlacedEntityId = null;
			if (!Number.isFinite(x) || !Number.isFinite(z)) {
				return { kind: 'invalid', code: 'non-finite', message: 'X/Z must be finite meters.' };
			}
			const outcome = await acceptPlacement(primitive, [snapped(x), snapped(z)]);
			if (outcome.kind === 'committed') candidate = null;
			return outcome;
		},
		placedEntityId: () => lastPlacedEntityId,
		subjectEntityId: () => entityId,
		candidate: () => candidate,
		cancel() {
			release();
			entityId = null;
			candidate = null;
			entryError = null;
			// Esc/Select disarms Place per the editing-surface contract.
			mode = 'select';
		},
		baseline: () => (baseline === null ? null : { position: [...baseline.position] as Vec3, rotation: [...baseline.rotation] as Vec3 })
	};
}

/** Build the session from the public adapter services. */
export function sceneSessionFromServices(input: {
	readonly services: StageAdapterServices;
	readonly evaluationId: string;
}): ScenePlacementSession {
	const snapshot = input.services.stage.snapshot();
	const source = currentStageSource(snapshot).source;
	return createSceneSession({
		snapshot: {
			projectId: snapshot.acceptedRevision.projectId,
			contentRevision: snapshot.sourceContentId,
			source,
			compileGeneration: snapshot.compileGeneration,
			evaluationId: input.evaluationId
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
