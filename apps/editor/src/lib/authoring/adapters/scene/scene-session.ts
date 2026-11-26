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
	planMoveHorizontal,
	planResizeOnFloor,
	planSetYaw,
	type SceneOperationResult,
	type SceneSupportChoice,
} from '@portfolio/project-model/scene-planning';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { Vec3 } from '@portfolio/project-model/scene';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-adapter-host';
import { snapDraftingPlacement } from '$lib/authoring/stage/stage-adapter-host';
import {
	nativePlacementContactMinY,
	type NativePlacementPrimitive,
} from '../../scene/object-definition-policy';
import {
	candidateFrom as candidateFromOf,
	createSceneSessionReads,
	footprintOf,
} from './scene-session-reads';
import {
	acceptFormCopyPlacement as acceptFormCopyPlacementOf,
	acceptModelPlacement as acceptModelPlacementOf,
	acceptOne as acceptOneOf,
	acceptPlacement as acceptPlacementOf,
} from './scene-session-accepts';
import {
	FRAME,
	PROJECT_WORLD,
	localContactMinY,
	parseNumber,
	sceneComposeSupport,
} from './scene-placement-support';
import type {
	ArmedFormCopy,
	ArmedModelPlacement,
	SceneCandidate,
	SceneEditingSnapshot,
	ScenePlacementSession,
	SceneSessionOutcome,
	SceneWritePort,
} from './placement';

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
	let armedFormCopyPlacement: ArmedFormCopy | null = null;
	let candidateFormCopy: ArmedFormCopy | null = null;
	/** The support the pointer preview showed, pinned for this commit. */
	let candidateFormCopyChoice: SceneSupportChoice | null = null;
	/** The support a native primitive or model pointer preview stood on. */
	let candidatePlaceChoice: SceneSupportChoice | null = null;
	let placementCommitted: ((placedEntityId: string | null) => void) | null = null;
	const reads = createSceneSessionReads({
		snapshot: input.snapshot,
		snapStep: () => snap,
		takeCommitted: () => {
			const listener = placementCommitted;
			placementCommitted = null;
			return listener;
		},
		placedEntityId: () => lastPlacedEntityId,
	});
	const notifyPlacementCommitted = reads.notify;
	const context = reads.context;
	const entityOf = reads.entityOf;
	const contactOf = reads.contactOf;
	const _scaleOf = reads.scaleOf;
	const snapped = reads.snapped;
	const candidateFrom = (result: SceneOperationResult, step: number | null) =>
		candidateFromOf(result, step, contactOf, () => {
			candidate = null;
		});

	/** One preview path for pointer drag and exact entry; `useSnap` is explicit. */
	function moveCandidate(x: number, z: number, useSnap: boolean): SceneSessionOutcome {
		if (entityId === null)
			return { kind: 'refused', code: 'no-subject', message: 'Choose a Scene entity first.' };
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
				message: 'A model needs a verified contact before it can be moved on the floor.',
			};
		}
		if (!Number.isFinite(x) || !Number.isFinite(z)) {
			candidate = null;
			return { kind: 'invalid', code: 'non-finite', message: 'X/Z must be finite meters.' };
		}
		const step = useSnap ? snap : null;
		const worldXZ: [number, number] = [
			step === null ? x : snapped(x),
			step === null ? z : snapped(z),
		];
		const outcome = candidateFrom(
			planMoveHorizontal({ context: context(), entityId, worldXZ, frame: FRAME, contactMinY }),
			step,
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
		if (entityId === null)
			return { kind: 'refused', code: 'no-subject', message: 'Choose a Scene entity first.' };
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
				message: 'A model needs a verified contact before it can be resized on the floor.',
			};
		}
		const outcome = candidateFrom(
			planResizeOnFloor({ context: context(), entityId, scale, contactMinY }),
			null,
		);
		if (outcome.kind === 'candidate') candidate = outcome.candidate;
		return outcome;
	}

	function yawCandidate(radians: number): SceneSessionOutcome {
		if (entityId === null)
			return { kind: 'refused', code: 'no-subject', message: 'Choose a Scene entity first.' };
		if (!Number.isFinite(radians)) {
			candidate = null;
			return { kind: 'invalid', code: 'non-finite', message: 'The angle must be finite radians.' };
		}
		const outcome = candidateFrom(
			planSetYaw({ context: context(), entityId, yaw: radians, frame: FRAME }),
			null,
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
		} = {},
	): AuthoringIntent {
		const addressedId = options.entityId ?? entityId;
		const entity = addressedId === null ? null : entityOf(addressedId);
		const reference =
			entity === null
				? []
				: [
						{
							version: 1 as const,
							domain: 'scene' as const,
							revision: { kind: 'exact' as const, contentRevision: input.snapshot.contentRevision },
							subject: { kind: 'entity' as const, id: entity.id },
							instancePath: [],
							location: { kind: 'project-root' as const },
							componentId: null,
							capabilityId: null,
						},
					];
		return {
			version: 1,
			kind,
			operationId: mint(),
			expectedRevision: {
				projectId: input.snapshot.projectId,
				revisionId: input.port.acceptedRevision().revisionId,
			},
			targets: reference,
			payload,
			capturedInputs: [],
			allocatedIds: [...(options.allocatedIds ?? [])],
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
		candidateFormCopy = null;
		candidatePlaceChoice = null;
		entryError = null;
	}

	/** One placement preview and commit path share this captured proposal. */
	function placeCandidate(
		primitive: NativePlacementPrimitive,
		x: number,
		z: number,
		supportElevation: number,
		choice: SceneSupportChoice | undefined,
		snappedStep: number | null,
	): SceneSessionOutcome {
		if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(supportElevation)) {
			candidate = null;
			return {
				kind: 'invalid',
				code: 'non-finite',
				message: 'X/Z and the support elevation must be finite meters.',
			};
		}
		// The caller already snapped and resolved floor support at this exact X/Z.
		// Re-rounding here would move a supported pose off the floor whose
		// elevation it displays, so the coordinates and the reported step are
		// authoritative inputs, not a second application of session state.
		const step = snappedStep !== null && snappedStep > 0 ? snappedStep : null;
		const worldXZ: [number, number] = [x, z];
		const contactMinY = nativePlacementContactMinY(primitive);
		candidateFormCopy = null;
		candidateFormCopyChoice = null;
		candidatePlaceChoice = choice ?? null;
		const next: SceneCandidate = {
			kind: 'place',
			entityId: null,
			primitive,
			position: [worldXZ[0], supportElevation - contactMinY, worldXZ[1]],
			rotation: [0, 0, 0],
			worldXZ,
			yaw: 0,
			scale: 1,
			snappedStep: step,
		};
		candidate = next;
		return { kind: 'candidate', candidate: next };
	}

	/**
	 * One My Objects preview: the ghost is the item's own source and the shown Y
	 * is the item's evaluated contact over the resolved support. Commit re-runs
	 * the retained `place-form-copy` planner with the same captured inputs.
	 */
	function placeFormCopyCandidate(
		copy: ArmedFormCopy,
		x: number,
		z: number,
		supportElevation: number,
		choice: SceneSupportChoice | undefined,
		snappedStep: number | null,
	): SceneSessionOutcome {
		if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(supportElevation)) {
			candidate = null;
			candidateFormCopy = null;
			candidateFormCopyChoice = null;
			return {
				kind: 'invalid',
				code: 'non-finite',
				message: 'X/Z and the support elevation must be finite meters.',
			};
		}
		// One rounding layer: the caller's X/Z is the pose support was resolved
		// against, and the pinned floor choice belongs to it.
		const step = snappedStep !== null && snappedStep > 0 ? snappedStep : null;
		const worldXZ: [number, number] = [x, z];
		candidateModel = null;
		candidateFormCopy = copy;
		candidateFormCopyChoice = choice ?? null;
		const next: SceneCandidate = {
			kind: 'place',
			entityId: null,
			primitive: null,
			form: copy.item.form,
			position: [worldXZ[0], supportElevation - copy.contactMinY, worldXZ[1]],
			rotation: [0, 0, 0],
			worldXZ,
			yaw: 0,
			scale: 1,
			snappedStep: step,
		};
		candidate = next;
		return { kind: 'candidate', candidate: next };
	}

	/** One creator-model placement preview; the same candidate is committed. */
	function placeModelCandidate(
		model: ArmedModelPlacement,
		x: number,
		z: number,
		supportElevation: number,
		choice: SceneSupportChoice | undefined,
		snappedStep: number | null,
	): SceneSessionOutcome {
		if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(supportElevation)) {
			candidate = null;
			candidateModel = null;
			candidatePlaceChoice = null;
			return {
				kind: 'invalid',
				code: 'non-finite',
				message: 'X/Z and the support elevation must be finite meters.',
			};
		}
		// One rounding layer: the caller's X/Z is the pose support was resolved
		// against, and the pinned floor choice belongs to it.
		const step = snappedStep !== null && snappedStep > 0 ? snappedStep : null;
		const worldXZ: [number, number] = [x, z];
		candidateFormCopy = null;
		candidateFormCopyChoice = null;
		candidatePlaceChoice = choice ?? null;
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
			footprint: footprintOf(model.definition),
			modelContactMinY: model.definition.contactMinY,
			...(model.definition.creationDefaults.kind === 'model'
				? { modelAssetId: model.definition.creationDefaults.assetId }
				: {}),
		};
		candidate = next;
		candidateModel = model;
		return { kind: 'candidate', candidate: next };
	}

	const acceptContext = {
		snapshot: input.snapshot,
		port: input.port,
		mint,
		placed: (entityId: string | null) => {
			lastPlacedEntityId = entityId;
		},
		notify: notifyPlacementCommitted,
	};
	const acceptOne = (
		intentToAccept: Parameters<typeof acceptOneOf>[1],
		createdEntityId: Parameters<typeof acceptOneOf>[2],
	) => acceptOneOf(acceptContext, intentToAccept, createdEntityId);
	const acceptPlacement = (
		primitive: Parameters<typeof acceptPlacementOf>[1],
		worldXZ: Parameters<typeof acceptPlacementOf>[2],
		choice?: Parameters<typeof acceptPlacementOf>[3],
	) => acceptPlacementOf(acceptContext, primitive, worldXZ, choice);
	const acceptModelPlacement = (
		model: Parameters<typeof acceptModelPlacementOf>[1],
		worldXZ: Parameters<typeof acceptModelPlacementOf>[2],
		choice?: Parameters<typeof acceptModelPlacementOf>[3],
	) => acceptModelPlacementOf(acceptContext, model, worldXZ, choice);
	const acceptFormCopyPlacement = (
		copy: Parameters<typeof acceptFormCopyPlacementOf>[1],
		worldXZ: Parameters<typeof acceptFormCopyPlacementOf>[2],
		choice?: Parameters<typeof acceptFormCopyPlacementOf>[3],
	) => acceptFormCopyPlacementOf(acceptContext, copy, worldXZ, choice);

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
					message: support.reason ?? 'Resize is unavailable.',
				};
			}
			release();
			lease = input.port.acquireGesture({
				owner: 'scene-compose',
				evaluationId: evaluationIdNow(),
				policy: 'cancel-on-reading-change',
			});
			if (lease.kind === 'refused') {
				return {
					kind: 'refused',
					code: lease.code,
					message:
						lease.code === 'gesture-held'
							? `Another ${lease.owner} gesture is live.`
							: 'This editing session is stale.',
				};
			}
			mode = 'resize';
			entityId = id;
			baseline = { position: [...entity.position] as Vec3, rotation: [...entity.rotation] as Vec3 };
			entry = {
				x: String(entity.position[0]),
				z: String(entity.position[2]),
				yaw: String(entity.rotation[1]),
			};
			candidate = null;
			candidatePlaceChoice = null;
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
				return {
					kind: 'refused',
					code: 'no-candidate',
					message: 'Preview a valid scale before committing.',
				};
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
					message: support.reason ?? 'Duplicate is unavailable.',
				};
			}
			const contactMinY = localContactMinY(entity, contactOf(entity));
			if (contactMinY === null) {
				return {
					kind: 'refused',
					code: 'missing-contact-metadata',
					message: 'The entity has no verified contact.',
				};
			}
			const allocatedId = `entity-${mint()}`;
			return acceptOne(
				intent(
					'duplicate-one',
					{ entityId: id, contactMinY },
					{
						entityId: id,
						allocatedIds: [{ kind: 'scene-entity', id: allocatedId }],
					},
				),
				allocatedId,
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
				policy: 'cancel-on-reading-change',
			});
			if (lease.kind === 'refused') {
				return {
					kind: 'refused',
					code: lease.code,
					message:
						lease.code === 'gesture-held'
							? `Another ${lease.owner} gesture is live.`
							: 'This editing session is stale.',
				};
			}
			entityId = id;
			baseline = { position: [...entity.position] as Vec3, rotation: [...entity.rotation] as Vec3 };
			entry = {
				x: String(entity.position[0]),
				z: String(entity.position[2]),
				yaw: String(entity.rotation[1]),
			};
			candidate = null;
			candidatePlaceChoice = null;
			return { kind: 'idle' };
		},
		beginPlace(primitive) {
			release();
			// An explicit native primitive is the placement this gesture will show;
			// neither an armed creator model nor a saved My Objects copy silently
			// substitutes itself.
			armedModelPlacement = null;
			candidateModel = null;
			candidatePlaceChoice = null;
			armedFormCopyPlacement = null;
			candidateFormCopy = null;
			lease = input.port.acquireGesture({
				owner: 'scene-transform',
				evaluationId: evaluationIdNow(),
				policy: 'cancel-on-reading-change',
			});
			if (lease.kind === 'refused') {
				return {
					kind: 'refused',
					code: lease.code,
					message:
						lease.code === 'gesture-held'
							? `Another ${lease.owner} gesture is live.`
							: 'This editing session is stale.',
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
			// Re-applying the arm already in force is a no-op. The Place binding
			// re-applies the project's armed tile on every surface refresh, and a
			// repeated arm must not discard the pinned support the displayed pointer
			// candidate stands on (nor the candidate the release would commit).
			if (
				placePrimitive === primitive &&
				armedModelPlacement === null &&
				armedFormCopyPlacement === null
			)
				return;
			placePrimitive = primitive;
			// Choosing a native primitive is an explicit replacement of an armed model
			// or saved copy.
			armedModelPlacement = null;
			candidateModel = null;
			candidatePlaceChoice = null;
			armedFormCopyPlacement = null;
			candidateFormCopy = null;
		},
		setArmedModel(model) {
			armedModelPlacement = model;
			candidateModel = null;
			candidatePlaceChoice = null;
			// Choosing another object is an explicit replacement of an armed copy.
			if (model !== null) {
				armedFormCopyPlacement = null;
				candidateFormCopy = null;
			}
		},
		setArmedFormCopy(copy) {
			armedFormCopyPlacement = copy;
			candidateFormCopy = null;
			candidatePlaceChoice = null;
			// Choosing a saved copy is an explicit replacement of an armed model.
			if (copy !== null) {
				armedModelPlacement = null;
				candidateModel = null;
			}
		},
		armedFormCopy: () => armedFormCopyPlacement,
		beginPlaceFormCopy(copy) {
			// The lease comes from the same begin path a native placement uses; the
			// copy is re-armed afterwards because that path clears an armed copy on
			// purpose (an explicit primitive replaces it).
			const outcome = session.beginPlace('box');
			if (outcome.kind === 'refused') return outcome;
			armedFormCopyPlacement = copy;
			candidateFormCopyChoice = null;
			candidatePlaceChoice = null;
			mode = 'place';
			return outcome;
		},
		previewPlaceFormCopy(copy, x, z, supportElevation, choice, snappedStep = null) {
			mode = 'place';
			armedFormCopyPlacement = copy;
			return placeFormCopyCandidate(copy, x, z, supportElevation, choice, snappedStep);
		},
		async placeFormCopy(copy, x, z, choice) {
			if (!Number.isFinite(x) || !Number.isFinite(z)) {
				return { kind: 'invalid', code: 'non-finite', message: 'X/Z must be finite meters.' };
			}
			lastPlacedEntityId = null;
			const placement = snapDraftingPlacement([x, z], snap);
			const outcome = await acceptFormCopyPlacement(copy, [placement.x, placement.z], choice);
			if (outcome.kind === 'committed') {
				candidate = null;
				candidateFormCopy = null;
				candidateFormCopyChoice = null;
				candidatePlaceChoice = null;
				armedFormCopyPlacement = null;
				notifyPlacementCommitted();
			}
			return outcome;
		},
		armedModel: () => armedModelPlacement,
		beginPlaceModel(model) {
			// The lease comes from the same begin path a native placement uses; the
			// model is re-armed afterwards because that path clears an armed model on
			// purpose (an explicit primitive replaces it).
			const outcome = session.beginPlace('box');
			if (outcome.kind === 'refused') return outcome;
			candidatePlaceChoice = null;
			armedModelPlacement = model;
			mode = 'place';
			return outcome;
		},
		previewPlaceModel(model, x, z, supportElevation, snappedStep = null, choice) {
			mode = 'place';
			armedModelPlacement = model;
			return placeModelCandidate(model, x, z, supportElevation, choice, snappedStep);
		},
		previewMove(x, z) {
			return moveCandidate(x, z, snap !== null);
		},
		previewYaw(radians) {
			return yawCandidate(radians);
		},
		previewPlace(primitive, x, z, supportElevation, snappedStep = null, choice) {
			mode = 'place';
			placePrimitive = primitive;
			return placeCandidate(primitive, x, z, supportElevation, choice, snappedStep);
		},
		invalidatePreview() {
			// The expression the creator is now pointing at has no valid support. The
			// previous pose is no longer what a release would install, so it must stop
			// being committable; the lease and the armed tool stay as they are.
			candidate = null;
			candidateFormCopy = null;
			candidatePlaceChoice = null;
			entryError = null;
		},
		abortGesture() {
			// Interruption (capture loss, blur, a reading change) ends this proposal
			// without disarming Place: only Esc/Select does that.
			release();
			entityId = null;
			candidate = null;
			candidateFormCopy = null;
			candidatePlaceChoice = null;
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
					yaw: String(captured.yaw),
				};
			}
			return outcome;
		},
		async commit() {
			if (entityId === null || candidate === null || candidate.kind === 'place') {
				// Nothing is committable, so nothing may keep the gesture lease: a
				// withdrawn candidate must not leave Undo reporting a live proposal.
				release();
				return {
					kind: 'refused',
					code: 'no-candidate',
					message: 'Preview a valid pose before committing.',
				};
			}
			if (!leaseIsLive()) {
				// The host ended the lease (a reading change): the shown pose is no longer
				// this gesture's operation, so withdraw it rather than install it.
				withdraw();
				return {
					kind: 'refused',
					code: 'no-candidate',
					message: 'The preview was cancelled by a reading change.',
				};
			}
			const entity = entityOf(entityId);
			if (entity === null) {
				withdraw();
				return { kind: 'refused', code: 'missing-target', message: 'The entity no longer exists.' };
			}
			const contactMinY = localContactMinY(entity, contactOf(entity));
			if (contactMinY === null) {
				withdraw();
				return {
					kind: 'refused',
					code: 'missing-contact-metadata',
					message: 'The entity has no verified contact.',
				};
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
							frameReference: PROJECT_WORLD,
						})
					: committed.kind === 'resize'
						? intent('resize-on-floor', {
								entityId,
								scale: committed.scale,
								contactMinY,
							})
						: intent('move-horizontal', {
								entityId,
								worldXZ: [committed.worldXZ[0], committed.worldXZ[1]],
								frame: FRAME,
								frameReference: PROJECT_WORLD,
								contactMinY,
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
					message: error instanceof Error ? error.message : 'The accepted install failed.',
				};
			}
			if (outcome.kind === 'refused') {
				withdraw();
				return { kind: 'refused', code: outcome.code, message: outcome.message };
			}
			// The committed pose is exactly the displayed candidate; the lease ends and
			// the accepted baseline is the new pose.
			release();
			baseline = {
				position: [...committed.position] as Vec3,
				rotation: [...committed.rotation] as Vec3,
			};
			entityId = null;
			candidate = null;
			return { kind: 'committed' };
		},
		async commitPlace() {
			if (
				candidate === null ||
				candidate.kind !== 'place' ||
				(candidate.primitive === null && candidateModel === null && candidateFormCopy === null)
			) {
				release();
				return {
					kind: 'refused',
					code: 'no-candidate',
					message: 'Preview a valid placement before committing.',
				};
			}
			if (!leaseIsLive()) {
				// The host ended the lease under the preview; the pose must stop being
				// committable rather than installing behind a reading the creator left.
				withdraw();
				return {
					kind: 'refused',
					code: 'no-candidate',
					message: 'The preview was cancelled by a reading change.',
				};
			}
			lastPlacedEntityId = null;
			const worldXZ = candidate.worldXZ;
			const model = candidateModel;
			const copy = candidateFormCopy;
			const copyChoice = candidateFormCopyChoice ?? undefined;
			const placeChoice = candidatePlaceChoice ?? undefined;
			const outcome =
				copy !== null
					? await acceptFormCopyPlacement(copy, worldXZ, copyChoice)
					: model === null
						? candidate.primitive === null
							? {
									kind: 'refused' as const,
									code: 'no-candidate',
									message: 'Preview a valid placement before committing.',
								}
							: await acceptPlacement(candidate.primitive, worldXZ, placeChoice)
						: await acceptModelPlacement(model, worldXZ, placeChoice);
			if (outcome.kind !== 'committed') {
				withdraw();
				return outcome;
			}
			// The committed pose is exactly the displayed candidate, and Place stays
			// armed: a release never disarms the tool, only Esc/Select does. The model
			// or saved copy is consumed by its placement, so the next release is a
			// native primitive unless the creator arms another.
			release();
			candidate = null;
			candidateModel = null;
			armedModelPlacement = null;
			candidateFormCopy = null;
			candidateFormCopyChoice = null;
			candidatePlaceChoice = null;
			armedFormCopyPlacement = null;
			notifyPlacementCommitted();
			return { kind: 'committed' };
		},
		async place(primitive, x, z) {
			// An armed My Objects copy or approved model is what these coordinates
			// place. Choosing a primitive is the one explicit replacement
			// (`setPlacePrimitive`), so the typed form can no longer install a box
			// behind a model approval or a saved copy.
			const copy = armedFormCopyPlacement;
			const model = copy === null ? armedModelPlacement : null;
			lastPlacedEntityId = null;
			if (!Number.isFinite(x) || !Number.isFinite(z)) {
				return { kind: 'invalid', code: 'non-finite', message: 'X/Z must be finite meters.' };
			}
			const placement = snapDraftingPlacement([x, z], snap);
			const worldXZ: [number, number] = [placement.x, placement.z];
			const outcome =
				copy !== null
					? await acceptFormCopyPlacement(copy, worldXZ)
					: model === null
						? await acceptPlacement(primitive, worldXZ)
						: await acceptModelPlacement(model, worldXZ);
			if (outcome.kind === 'committed') {
				candidate = null;
				candidatePlaceChoice = null;
				candidateFormCopyChoice = null;
				// The model or copy is consumed by its placement; a failed attempt keeps
				// the arm so the creator can retry the same object.
				if (model !== null) {
					candidateModel = null;
					armedModelPlacement = null;
				}
				if (copy !== null) {
					candidateFormCopy = null;
					armedFormCopyPlacement = null;
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
			candidateFormCopy = null;
			candidatePlaceChoice = null;
			entryError = null;
			// Esc/Select disarms Place per the editing-surface contract, and the armed
			// creator model or saved copy returns to rest with it.
			mode = 'select';
			candidateModel = null;
			armedModelPlacement = null;
			armedFormCopyPlacement = null;
		},
		baseline: () =>
			baseline === null
				? null
				: { position: [...baseline.position] as Vec3, rotation: [...baseline.rotation] as Vec3 },
	};
	return session;
}
