/**
 * X7 — the Scene adapter's placement binding.
 *
 * Wraps the existing placement session (`./placement`) for the lifetime of one
 * adapter binding: which contributed task is open, the surface this binding
 * published and the one a press claimed, Place arming and the pending approved
 * model, the one completion that selects what was placed and reopens the
 * persistent Place tool, the epoch that lets an explicit close beat an
 * acceptance still in flight, the pointer-time refusals and the held release,
 * and the drawn Shape tile's session. It owns every one of those lifetimes and
 * ends each of them on task close, selection change and disposal.
 *
 * It holds no planning mathematics (the retained planners and `placement.ts`
 * own that), draws nothing (`candidate-presenter.ts` reads it through `view`),
 * and knows nothing of the object-mark session: a mark and a placement never
 * share state, and the adapter decides which one a press belongs to.
 *
 * Adapter-lifetime defaults — the armed tile, the compact Objects panel, the
 * armed model and the creator definitions — live in their own project-keyed
 * stores, so they survive a rebind; this binding only reads and writes them.
 */

import type { ViewportEvaluation } from '@portfolio/camera-core';
import type {
	StageAdapterContext,
	StageAdapterServices,
	StageGhostMesh,
	StageKeyboardIntent,
	StageOverlayContribution,
	StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';
import {
	draftingSnapIncrementMeters,
	evaluationIdOf,
	stageEnvelope
} from '$lib/authoring/stage/stage-adapter-host';
import type { SceneEntity, Vec3 } from '@portfolio/project-model';
import { creatorModelDefinition, approvedModelResources } from '@portfolio/project-model/scene-planning';
import { createObjectDrawSession, type DrawPreview, type ObjectDrawSession } from './shape/draw-session';
import { armTile, armedTile, setObjectsPanelCompact } from './shape/armed-tile';
import { publishObjectDraw } from './shape/draw-surface';
import type { ShapeKind } from './shape/outline';
import {
	clearArmedModel,
	clearCreatorDefinitions,
	peekArmedModel,
	rememberCreatorDefinition
} from './import/definitions';
import type { PlacementPointerRefusal, PlacementPresentationView, PlacementReleaseRefusal } from './candidate-presenter';
import { liveProjectId, objectContact } from './object-readings';
import {
	moveSupportRefusal,
	pointerDatumPoint,
	pointerFloorSupport,
	pointerPlaceSupport
} from './pointer-support';
import {
	publishSceneSurface,
	retireSceneSurface,
	sceneEntityReference,
	sceneReadingKey,
	sceneSessionFromServices,
	sceneSurfaceFor,
	type SceneCandidate,
	type ScenePlacementSession,
	type SceneSessionOutcome,
	type SceneSurface
} from './placement';
import { SCENE_COMPOSE_TASK, SCENE_IMPORT_KIND, SCENE_PLACE_KIND, SCENE_PLACE_TASK } from './scene-task-ids';

export type PlacementBinding = {
	/** The task this binding is showing; pointer behavior follows the invoked task. */
	taskKind(): string | null;
	/** Arm the surface for the invoked task (Place, Compose; Import arms nothing). */
	openTask(kind: string): void;
	/**
	 * Phases every pointer shares: a held release swallows the pointer, a refused
	 * release clears on the next gesture, and the last pointer point feeds the
	 * need chip. `true` means the pointer was consumed.
	 */
	pointerPrelude(intent: StagePointerIntent): boolean;
	/** The press path while a contributed task is open (the drawn tile or the session). */
	pointerInTask(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	key(intent: StageKeyboardIntent): boolean;
	hover(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	/** Whether the drawn Shape tile is what the open Place task is armed with. */
	drawing(): boolean;
	drawPreview(adapterContext: StageAdapterContext): DrawPreview | null;
	drawOverlay(adapterContext: StageAdapterContext): readonly StageOverlayContribution[];
	drawGhosts(): readonly StageGhostMesh[];
	/** What the candidate presenter reads of the placement state, for one context. */
	view(adapterContext: StageAdapterContext): PlacementPresentationView;
	/** A new subject's selection ends every held or refused placement presentation. */
	selectionChanged(): void;
	taskClosed(): void;
	dispose(): void;
};

export function createPlacementBinding(
	services: StageAdapterServices,
	context: StageAdapterContext
): PlacementBinding {
	// The accepted resource is the authority for every later placement, so a
	// rebind replaces whatever the procedure captured before the install.
	// Async: the definition identity hashes the captured metadata.
	clearCreatorDefinitions();
	void (async () => {
		for (const resource of approvedModelResources(stageEnvelope(context.snapshot))) {
			const definition = await creatorModelDefinition(resource, 'Imported model');
			if (definition !== null) rememberCreatorDefinition(definition);
		}
	})();

	// One drag at a time: the press origin and the yaw it started from, so a
	// shift-drag is a rotation of the same captured baseline.
	let dragOrigin: { readonly x: number; readonly yaw: number } | null = null;
	let openTaskKind: string | null = null;
	/** Bumped by any close, so an in-flight install cannot reopen a closed tool. */
	let taskEpoch = 0;
	let abortReopen: (() => void) | null = null;
	/**
	 * The surface this press claimed, held for every later phase of the same
	 * gesture. A reading change can evaluate a new viewport mid-press; resolving
	 * the surface again on release would show a different, empty session and
	 * silently drop the pose the creator dragged.
	 */
	let gestureSurface: SceneSurface | null = null;
	/** The surface this binding published, with the snapshot it was keyed by. */
	let ownedSurface: { readonly snapshot: object; readonly surface: SceneSurface } | null = null;
	/** The surface this binding armed when it opened the current task. */
	let taskSurface: SceneSurface | null = null;
	let placementPointerRefusal: PlacementPointerRefusal | null = null;
	/** A released placement while its one acceptance is in flight. */
	let placementCommit: { readonly candidate: SceneCandidate } | null = null;
	/** The last pointer point while Place is armed, for the need chip. */
	let placementPointerCss: readonly [number, number] | null = null;
	/** A refused release holds the last drawn candidate in refusal ink. */
	let placementReleaseRefusal: PlacementReleaseRefusal | null = null;

	function livePlacementReleaseRefusal(): PlacementReleaseRefusal | null {
		if (placementReleaseRefusal === null) return null;
		if (Date.now() > placementReleaseRefusal.until) {
			placementReleaseRefusal = null;
			return null;
		}
		return placementReleaseRefusal;
	}

	function placementRefusalCandidate(
		session: ScenePlacementSession,
		world: Vec3
	): SceneCandidate | null {
		const worldXZ: readonly [number, number] = [world[0], world[2]];
		const copy = session.armedFormCopy();
		if (copy !== null) {
			return {
				kind: 'place', entityId: null, primitive: null,
				position: [world[0], world[1] - copy.contactMinY, world[2]],
				rotation: [0, 0, 0], worldXZ, yaw: 0, scale: 1, snappedStep: null,
				form: copy.item.form
			};
		}
		const model = session.armedModel();
		if (model !== null && model.definition.creationDefaults.kind === 'model') {
			const xs = model.definition.footprintMeters.map(([x]) => x);
			const zs = model.definition.footprintMeters.map(([, z]) => z);
			return {
				kind: 'place', entityId: null, primitive: null,
				position: [world[0], world[1] - model.definition.contactMinY, world[2]],
				rotation: [0, 0, 0], worldXZ, yaw: 0, scale: 1, snappedStep: null,
				modelContactMinY: model.definition.contactMinY,
				footprint: {
					width: Math.max(...xs) - Math.min(...xs),
					depth: Math.max(...zs) - Math.min(...zs)
				},
				modelAssetId: model.definition.creationDefaults.assetId
			};
		}
		return {
			kind: 'place', entityId: null, primitive: session.placePrimitive(),
			position: [world[0], world[1] + 0.5, world[2]],
			rotation: [0, 0, 0], worldXZ, yaw: 0, scale: 1, snappedStep: null
		};
	}

	function refusePlaceAtPointer(
		session: ScenePlacementSession,
		adapterContext: StageAdapterContext,
		css: readonly [number, number]
	): void {
		const world = pointerDatumPoint(adapterContext, css);
		const visible = pointerFloorSupport(adapterContext, css, null);
		const refusal = visible.kind !== 'floor' ? moveSupportRefusal(visible) : null;
		const message =
			refusal?.kind === 'refused'
				? refusal.message
				: 'More than one floor could support this pointer position.';
		placementPointerRefusal = {
			css: [css[0], css[1]],
			world,
			message,
			candidate: world === null ? null : placementRefusalCandidate(session, world)
		};
	}

	/** The drawn Shape tile this Place task is armed with, when a tile is what is armed. */
	function drawnTile(): ShapeKind | null {
		if (openTaskKind !== SCENE_PLACE_KIND) return null;
		const session = taskSurface?.session ?? ownedSurface?.surface.session ?? null;
		if (session?.armedFormCopy() != null || session?.armedModel() != null) return null;
		if (peekArmedModel(liveProjectId(services)) !== null) return null;
		const tile = armedTile(liveProjectId(services));
		return tile === null || tile === 'sphere' ? null : tile;
	}

	let lastTile: ShapeKind = 'box';
	const objectDraw: ObjectDrawSession = createObjectDrawSession(services, {
		tile: () => {
			lastTile = drawnTile() ?? lastTile;
			return lastTile;
		},
		pressRefusal(adapterContext, css) {
			const visible = pointerFloorSupport(adapterContext, css, null);
			if (visible.kind === 'floor') return null;
			return visible.kind === 'occluded'
				? 'Another object or Wall is in the way; press open ground.'
				: 'That press does not reach the Stage datum.';
		},
		beginCommit() {
			const epoch = taskEpoch;
			return (entityId) => {
				const reference = sceneEntityReference(
					entityId,
					services.stage.snapshot().domain.unitRevisions.scene
				);
				services.stage.setSelection({ ordered: [{ reference }], primary: reference });
				if (epoch !== taskEpoch) return;
				reopenPlace();
			};
		},
		drawingStarted() {
			setObjectsPanelCompact(liveProjectId(services), true);
		},
		changed() {
			publishObjectDraw(objectDraw);
		}
	});
	publishObjectDraw(objectDraw);

	/**
	 * Publish/read the surface for the **live** accepted snapshot and reading.
	 * A binding can outlive a reading change, so the bind-time snapshot is not
	 * used here: the surface must be keyed exactly as the instrument and the
	 * overlay read it.
	 */
	function surfaceFor(
		evaluation: ViewportEvaluation,
		snapshot = services.stage.snapshot()
	): SceneSurface {
		const existing = sceneSurfaceFor(snapshot, evaluation);
		if (existing !== null) {
			if (openTaskKind === SCENE_PLACE_KIND) {
				applyPendingArm(existing.session);
				attachPlaceCompletion(existing.session);
			}
			return existing;
		}
		const session = sceneSessionFromServices({ services, evaluationId: evaluationIdOf(evaluation) });
		const next: SceneSurface = { reading: sceneReadingKey(evaluation), session };
		if (openTaskKind === SCENE_PLACE_KIND) {
			applyPendingArm(session);
			attachPlaceCompletion(session);
		}
		// Publishing a different reading cancels the old proposal. The old
		// release is identity-checked, so it cannot remove this replacement.
		publishSceneSurface(snapshot, next);
		ownedSurface = { snapshot, surface: next };
		return next;
	}

	/** The surface this press claimed, or the one this binding published. */
	function liveSurface(): SceneSurface | null {
		return gestureSurface ?? ownedSurface?.surface ?? null;
	}

	/**
	 * Complete a committed placement, then keep the persistent Place tool armed.
	 *
	 * A placement commit — typed or pointer, they share this session — is
	 * accepted through the host's one install path, which closes the contributed
	 * task and retires this binding. The session reports that one commit, and this
	 * binding performs the completion: the newly created entity becomes the
	 * selection canonically, at the post-accept revision, and this binding reopens
	 * its own Place task for the next placement. Selection runs through this
	 * binding's own live facade services — the same authorised completion the
	 * pointer path has always used — not the task-scoped instrument guard an
	 * accepted install has already retired, so a typed commit cannot be refused
	 * as an inactive task. The listener takes the installed entity from the
	 * committing session; it captures no session, so a reading-change replacement
	 * can carry it to the creator's next commit. Esc/Select is the one path that
	 * ends the tool. The captured epoch makes an explicit close win the race
	 * against an acceptance still in flight: a close that is not this install
	 * bumps it, so the deferred reopen is dropped instead of resurrecting a tool
	 * the creator ended.
	 */
	function attachPlaceCompletion(session: ScenePlacementSession): void {
		const epoch = taskEpoch;
		session.setPlacementCommittedListener((placedId) => {
			if (placedId !== null) {
				setObjectsPanelCompact(liveProjectId(services), true);
				// A placed model or saved copy is used up: the panel's shape is armed
				// again, never a primitive the panel does not offer.
				if (armedTile(liveProjectId(services)) === null) armTile(liveProjectId(services), 'box');
				// The model is a project resource now; no later Place task may
				// silently install a second instance from the same approval.
				clearArmedModel(liveProjectId(services));
				// Canonical selection of the new entity at the post-accept
				// revision; no Plan fragment is fabricated for a Scene-only
				// subject.
				const reference = sceneEntityReference(
					placedId,
					services.stage.snapshot().domain.unitRevisions.scene
				);
				services.stage.setSelection({ ordered: [{ reference }], primary: reference });
			}
			if (epoch !== taskEpoch) return;
			reopenPlace();
		});
	}

	/**
	 * Apply the project's pending approved model to a live Place session.
	 *
	 * A drawing install or reading change can replace the session while the
	 * Place task stays open; the arm belongs to the approval, not to the
	 * session that first carried it.
	 */
	function applyPendingArm(session: ScenePlacementSession): void {
		// An install replaces the session; the Sphere tile stays what is armed.
		if (armedTile(liveProjectId(services)) === 'sphere') session.setPlacePrimitive('sphere');
		if (session.armedModel() !== null) return;
		const pending = peekArmedModel(liveProjectId(services));
		if (pending !== null) session.setArmedModel(pending);
	}

	/** Reopen this binding's Place task once the rebuild makes it invocable. */
	function reopenPlace(): void {
		const stage = services.stage;
		let off: (() => void) | null = null;
		let settled = false;
		const finish = (): void => {
			if (settled) return;
			settled = true;
			off?.();
			off = null;
			abortReopen = null;
		};
		let opening = false;
		const attempt = (): void => {
			if (settled || opening) return;
			// The install already closed the task; if something else reopened it,
			// the tool is armed and this deferred reopen is done.
			if (stage.session.task() !== null) {
				finish();
				return;
			}
			opening = true;
			let opened = false;
			try {
				// A creation keeps the panel out of the way of what it just made.
				setObjectsPanelCompact(liveProjectId(services), true);
				opened = stage.openContributedTask(SCENE_PLACE_TASK, 'scene').kind === 'opened';
			} finally {
				opening = false;
			}
			if (opened) finish();
		};
		off = stage.onAdaptersChanged(attempt);
		abortReopen = () => finish();
		// The rebuild that follows the install may already be live.
		attempt();
	}

	async function commitPointerPlace(session: ScenePlacementSession): Promise<void> {
		// The session reports a committed placement to the binding that attached
		// completion, which selects the new entity and reopens this persistent task
		// through the host's one install path. Capture the shown candidate first:
		// a refusal withdraws it, and the ghost must stay for four seconds.
		const pending = session.candidate();
		if (pending !== null && pending.kind === 'place') {
			const token = { candidate: pending };
			placementCommit = token;
			services.stage.notifySurfaceChange();
			let outcome: SceneSessionOutcome;
			try {
				outcome = await session.commitPlace();
			} catch (error) {
				outcome = {
					kind: 'failed',
					code: 'accept-failed',
					message: error instanceof Error ? error.message : 'The accepted install failed.'
				};
			}
			if (placementCommit === token) {
				placementCommit = null;
				if (outcome.kind === 'refused' || outcome.kind === 'failed') {
					const until = Date.now() + 4_000;
					placementReleaseRefusal = { candidate: pending, message: outcome.message, until };
					setTimeout(() => {
						if (placementReleaseRefusal?.until !== until) return;
						placementReleaseRefusal = null;
						services.stage.notifySurfaceChange();
					}, 4_000);
				}
			}
			if (outcome.kind === 'refused' || outcome.kind === 'failed') {
				session.reportPointerOutcome(outcome);
			}
			services.stage.notifySurfaceChange();
			return;
		}
		const outcome = await session.commitPlace();
		if (outcome.kind === 'refused') session.reportPointerOutcome(outcome);
		services.stage.notifySurfaceChange();
	}

	function clearPresentation(): void {
		placementPointerRefusal = null;
		placementCommit = null;
		placementReleaseRefusal = null;
		placementPointerCss = null;
	}

	return {
		taskKind: () => openTaskKind,

		openTask(kind) {
			openTaskKind = kind;
			// Import reads and approves only. It arms a model for the next floor
			// placement but installs nothing until that placement commits.
			if (kind === SCENE_IMPORT_KIND) return;
			// Arm the surface for the reading the instrument will actually read,
			// not the bind-time one: a reading change does not rebuild the binding.
			const evaluation = services.stage.evaluation();
			if (kind === SCENE_PLACE_KIND && evaluation !== null) {
				taskSurface = surfaceFor(evaluation, services.stage.snapshot());
				taskSurface.session.arm('place');
				// Import leaves the approved model it has not placed yet; the
				// session this task owns is the one that receives it.
				applyPendingArm(taskSurface.session);
				// Typed and pointer Place commit through this session; completing here
				// is what keeps the tool persistent and selects the new entity for a
				// typed commit too.
				attachPlaceCompletion(taskSurface.session);
			} else if (kind === SCENE_COMPOSE_TASK) {
				// Publish the surface before the panel mounts, so the duplicate
				// completion below is installed on the session the panel will use.
				taskSurface =
					evaluation === null ? liveSurface() : surfaceFor(evaluation, services.stage.snapshot());
				// Duplicate is one immediate command: the copy it creates becomes the
				// canonical selection through the same completion path Place uses.
				taskSurface?.session.setPlacementCommittedListener((createdId) => {
					if (createdId === null) return;
					const reference = sceneEntityReference(
						createdId,
						services.stage.snapshot().domain.unitRevisions.scene
					);
					services.stage.setSelection({ ordered: [{ reference }], primary: reference });
				});
			} else {
				taskSurface = liveSurface();
			}
		},

		pointerPrelude(intent) {
			// One release is one commit: the held ghost stays and further pointer
			// phases are ignored until the acceptance settles.
			if (placementCommit !== null) return true;
			if (placementReleaseRefusal !== null) {
				if (intent.phase === 'move' || intent.phase === 'down' || intent.phase === 'cancel') {
					placementReleaseRefusal = null;
					services.stage.notifySurfaceChange();
				}
			}
			if (openTaskKind === SCENE_PLACE_KIND) placementPointerCss = [intent.css[0], intent.css[1]];
			return false;
		},

		pointerInTask(intent, adapterContext) {
			if (drawnTile() !== null) return objectDraw.pointer(intent, adapterContext);
			// Claim the surface once, on the press. Every later phase of this
			// gesture reads the same session even if the viewport is re-evaluated.
			if (intent.phase === 'down') gestureSurface = surfaceFor(adapterContext.evaluation);
			const surface = gestureSurface ?? surfaceFor(adapterContext.evaluation);
			const session = surface.session;
			const drafting = adapterContext.drafting();
			const snapStep = draftingSnapIncrementMeters(drafting);
			// Keep the Place session mirror in sync for its typed entry path; the
			// adapter context remains the only switch/increment authority.
			session.setSnapStep(openTaskKind === SCENE_PLACE_KIND ? snapStep : null);
			if (intent.phase === 'cancel') {
				dragOrigin = null;
				gestureSurface = null;
				placementPointerRefusal = null;
				// An interruption is not Esc/Select: Place stays armed.
				session.abortGesture();
				return true;
			}
			if (intent.phase === 'down') {
				if (openTaskKind === SCENE_PLACE_KIND) {
					placementPointerRefusal = null;
					// A My Objects copy or an approved model armed here places exactly
					// like a native primitive: press, preview on the compiled floor,
					// release to commit. The copy is the saved source verbatim.
					const copy = session.armedFormCopy();
					const armed = copy === null ? session.armedModel() : null;
					const primitive = session.placePrimitive();
					const begun =
						copy !== null
							? session.beginPlaceFormCopy(copy)
							: armed === null
								? session.beginPlace(primitive)
								: session.beginPlaceModel(armed);
					if (begun.kind === 'refused') {
						gestureSurface = null;
						return false;
					}
					const support = pointerPlaceSupport(adapterContext, intent.css, snapStep);
					if (support === null) {
						// Keep the press so the pointer can move onto a supported floor, while
						// naming the refusal at its actual position.
						if (pointerDatumPoint(adapterContext, intent.css) === null) {
							session.abortGesture();
							gestureSurface = null;
							return false;
						}
						session.invalidatePreview();
						refusePlaceAtPointer(session, adapterContext, intent.css);
						services.stage.notifySurfaceChange();
						return true;
					}
					placementPointerRefusal = null;
					if (copy !== null) {
						session.previewPlaceFormCopy(copy, support.x, support.z, support.elevation, support.choice, snapStep);
					} else if (armed === null) {
						session.previewPlace(primitive, support.x, support.z, support.elevation, snapStep);
					} else {
						session.previewPlaceModel(armed, support.x, support.z, support.elevation, snapStep);
					}
					return true;
				}
				const primary = adapterContext.selectionState().primary;
				if (primary === null || primary.domain !== 'scene' || primary.subject.kind !== 'entity') {
					gestureSurface = null;
					return false;
				}
				const begun = session.begin(primary.subject.id);
				if (begun.kind === 'refused') {
					gestureSurface = null;
					return false;
				}
				dragOrigin = { x: intent.css[0], yaw: session.baseline()?.rotation[1] ?? 0 };
				return true;
			}
			if (intent.phase === 'up') {
				dragOrigin = null;
				gestureSurface = null;
				const proposed = session.candidate();
				if (openTaskKind === SCENE_PLACE_KIND) {
					if (proposed !== null && proposed.kind === 'place') void commitPointerPlace(session);
					else if (session.armed() === 'place') session.abortGesture();
					else session.cancel();
					return true;
				}
				if (proposed !== null) {
					void session.commit().then((outcome) => session.reportPointerOutcome(outcome));
				} else {
					session.cancel();
				}
				// A click, or a drag whose last move had no support, is not a
				// proposal: release the lease instead of holding it until task close.
				return true;
			}
			// Shift-drag rotates around the declared pivot; the same planner the typed
			// yaw field uses receives the captured baseline plus the drag delta.
			if (intent.shift === true && dragOrigin !== null && openTaskKind !== SCENE_PLACE_KIND) {
				const outcome = session.previewYaw(dragOrigin.yaw + (intent.css[0] - dragOrigin.x) * 0.01);
				session.reportPointerOutcome(outcome);
				return true;
			}
			if (openTaskKind === SCENE_PLACE_KIND) {
				// Place follows the pointer on the floor; a move without visible
				// compiled Room-floor support withdraws the displayed pose so release
				// cannot install it.
				const support = pointerPlaceSupport(adapterContext, intent.css, snapStep);
				if (support === null) {
					session.invalidatePreview();
					refusePlaceAtPointer(session, adapterContext, intent.css);
					services.stage.notifySurfaceChange();
					return true;
				}
				placementPointerRefusal = null;
				const copy = session.armedFormCopy();
				const armed = copy === null ? session.armedModel() : null;
				if (copy !== null) {
					session.previewPlaceFormCopy(
						copy,
						support.x,
						support.z,
						support.elevation,
						support.choice,
						snapStep
					);
				} else if (armed === null) {
					session.previewPlace(
						session.placePrimitive(),
						support.x,
						support.z,
						support.elevation,
						snapStep
					);
				} else {
					session.previewPlaceModel(armed, support.x, support.z, support.elevation, snapStep);
				}
				return true;
			}
			// move: the pointer ray is resolved against the geometry the Stage
			// draws. A Wall, plinth or other object nearer than the datum is
			// support the creator cannot see, so the obsolete candidate is
			// withdrawn rather than committed on release.
			const support = pointerFloorSupport(adapterContext, intent.css, session.subjectEntityId());
			if (support.kind !== 'floor') {
				session.invalidatePreview();
				session.reportPointerOutcome(moveSupportRefusal(support));
				return true;
			}
			const outcome = session.previewMove(support.worldPoint[0], support.worldPoint[2]);
			session.reportPointerOutcome(outcome);
			return true;
		},

		key(intent) {
			return drawnTile() !== null && objectDraw.key(intent);
		},

		hover(intent, adapterContext) {
			if (placementCommit !== null) return true;
			if (openTaskKind === SCENE_PLACE_KIND) placementPointerCss = [intent.css[0], intent.css[1]];
			if (placementReleaseRefusal !== null) {
				placementReleaseRefusal = null;
				services.stage.notifySurfaceChange();
			}
			return drawnTile() !== null && objectDraw.hover(intent, adapterContext);
		},

		drawing: () => drawnTile() !== null,
		drawPreview: (adapterContext) => objectDraw.candidatePreview(adapterContext),
		drawOverlay: (adapterContext) => objectDraw.overlay(adapterContext),
		drawGhosts: () => objectDraw.ghosts(),

		view(adapterContext): PlacementPresentationView {
			return {
				placing: openTaskKind === SCENE_PLACE_KIND,
				pointerCss: placementPointerCss,
				held: placementCommit?.candidate ?? null,
				releaseRefusal: livePlacementReleaseRefusal,
				pointerRefusal: placementPointerRefusal,
				sessionCandidate: () =>
					sceneSurfaceFor(adapterContext.snapshot, adapterContext.evaluation)?.session.candidate() ??
					null,
				contact: (entity: SceneEntity) => objectContact(services, entity)
			};
		},

		selectionChanged() {
			clearPresentation();
		},

		taskClosed() {
			clearPresentation();
			dragOrigin = null;
			objectDraw.cancel();
			// A creation closes and reopens the task, in an order the host owns; only
			// a close nothing reopened brings the full panel back next time.
			{
				const projectId = liveProjectId(services);
				const stage = services.stage;
				setTimeout(() => {
					if (stage.session.task() === null) setObjectsPanelCompact(projectId, false);
				}, 400);
			}
			// Cancel the session this task armed (Place), not whichever session
			// another binding may have published.
			const closing = taskSurface ?? gestureSurface;
			gestureSurface = null;
			openTaskKind = null;
			taskSurface = null;
			closing?.session.cancel();
			// Any close ends the armed tool for good: bumping the epoch makes an
			// acceptance still in flight drop its deferred reopen, and the pending
			// reopen (if any) is aborted here rather than resurrecting the tool.
			taskEpoch += 1;
			abortReopen?.();
			abortReopen = null;
		},

		dispose() {
			gestureSurface = null;
			openTaskKind = null;
			taskSurface = null;
			abortReopen?.();
			abortReopen = null;
			objectDraw.cancel();
			publishObjectDraw(null, objectDraw);
			// Teardown cancels exactly what this binding published or held. Reading
			// the registry's "current" entry would let an old binding cancel a
			// newer replacement it never owned.
			const owned = ownedSurface;
			ownedSurface = null;
			if (owned === null) return;
			owned.surface.session.cancel();
			retireSceneSurface(owned.snapshot, owned.surface);
		}
	};
}
