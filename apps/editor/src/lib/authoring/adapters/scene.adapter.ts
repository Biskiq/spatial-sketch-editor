/**
 * T2.P01.S03 — the Scene adapter: the first coherent Scene editing surface.
 *
 * It registers the Scene planners with the one F.4 coordinator
 * and contributes Place/Arrange Find entries, Card facts and one instrument
 * through T1.P01.S07's AM-5 points. It edits no host core, route or shell
 * module, and it never writes Layout: support is consulted by the retained
 * planner.
 *
 * The session (`./scene/placement`) owns arming, the gesture lease, the
 * candidate preview and the one cancel path. This factory only wires it to the
 * public Stage services.
 */

import { Euler, Vector3 } from 'three';
import type { ViewportEvaluation } from '@portfolio/camera-core';
import type {
	StageAdapterFactory,
	StageAdapterServices
} from '$lib/authoring/stage/stage-adapter-host';
import { evaluationIdOf } from '$lib/authoring/stage/camera-session';
import type {
	StageAdapter,
	StageAdapterBinding,
	StageAdapterContext,
	StageCardFact,
	StageCardSubject,
	StageGhostMesh,
	StagePointerIntent
} from '$lib/authoring/stage/stage-facade';
import { stageEnvelope, stageScene } from '$lib/authoring/stage/unit-stage-source';
import type { SceneFormEntity } from '$lib/content/scene';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import {
	NATIVE_PLACEMENT_PRIMITIVES,
	nativePlacementDefinition
} from '$lib/authoring/scene/object-definition-policy';
import {
	chooseFloorSupport,
	floorSupportSnapshotOf,
	queryFloorSupports
} from '@portfolio/layout-core';
import {
	approvedModelResources,
	createScenePlanners,
	creatorModelDefinition,
	sceneSupportGenerationId,
	type NormalizedPlacementDefinition
} from '@portfolio/project-model/scene-planning';

import { buildPlanSceneFootprintProjection } from '$lib/authoring/scene/plan-scene-footprint';
import { planSceneHaloProbe, resolvePlanSceneHit } from '$lib/authoring/scene/plan-scene-hit';
import FormCardFields from './scene/FormCardFieldsLazy.svelte';
import SceneTransformInstrument from './scene/SceneTransformInstrument.svelte';
import ImportModelInstrumentLazy from './scene/import/ImportModelInstrumentLazy.svelte';
import {
	armedModelDefinition,
	clearArmedModel,
	clearCreatorDefinitions,
	creatorDefinitions,
	peekArmedModel,
	rememberCreatorDefinition
} from './scene/import/definitions';
import { candidateGhost } from './scene/candidate-ghost';
import {
	publishSceneSurface,
	retireSceneSurface,
	sceneEntityReference,
	sceneReadingKey,
	sceneSessionFromServices,
	sceneSurfaceFor,
	sceneComposeSupport,
	sceneModelContactMinY,
	type SceneCandidate,
	type ScenePlacementSession,
	type SceneSessionOutcome,
	type SceneSurface
} from './scene/placement';
import {
	floorSupport,
	supportOccluders,
	type SupportOccluder
} from './scene/support-occlusion';

const SCENE_ARRANGE_TASK = 'scene-arrange';
const SCENE_PLACE_TASK = 'scene-place';
/**
 * T2.P01.S04's bounded composition surface: uniform Resize, duplicate and
 * delete of the selected entity. One task, three scoped commands; the three
 * Find entries below all open it so each command is discoverable by name.
 */
const SCENE_COMPOSE_TASK = 'scene-compose';
/**
 * T2.P02.S02's `creator-import@1` procedure: choose, read, review, approve and
 * arm one of the creator's own models. Library and Head Find invoke it; there is
 * no permanent pointer tool for Import.
 */
const SCENE_IMPORT_TASK = 'scene-import';
const SCENE_IMPORT_KIND = 'import-model';

function entityFacts(
	services: StageAdapterServices,
	source: ReturnType<typeof stageScene>,
	entityId: string
): readonly StageCardFact[] {
	const entity = source.entities.find((candidate) => candidate.id === entityId);
	if (entity === undefined) return [];
	const contact =
		entity.kind === 'model'
			? sceneModelContactMinY(stageEnvelope(services.stage.snapshot()), entity)
			: null;
	return [
		{ label: 'Kind', value: entity.kind },
		{ label: 'Name', value: entity.name },
		{
			label: 'Position',
			value: entity.position.map((value) => `${value} m`).join(' · ')
		},
		{
			label: 'Yaw',
			value: `${entity.rotation[1]} rad`
		},
		// Only a subject Compose can actually resize advertises a Scale fact: a light
		// or an unapproved catalogue model has no verified contact, so a Scale row
		// would name a writer that never exists.
		...(sceneComposeSupport(entity, contact).resize
			? [
					{
						label: 'Scale',
						value: `${typeof entity.scale === 'number' ? entity.scale : 1} (uniform)`
					}
				]
			: []),
		// A form has no scalar scale to show; its size is the evaluated bounds of
		// the authored source, so the Card reports metres it can never write from
		// here; the Card writer supplies explicit per-axis Size commands.
		...(entity.kind === 'form' ? formSizeFacts(entity) : [])
	];
}

function formSizeFacts(entity: SceneFormEntity): readonly StageCardFact[] {
	const mesh = evaluateFormMesh(entity.form);
	if (mesh === null) return [];
	return [
		{ label: 'Material', value: entity.materialId },
		...['Width', 'Height', 'Depth'].map((label, axis) => ({
			label, value: formatFormMeters(mesh.bounds.max[axis]! - mesh.bounds.min[axis]!)
		}))
	];
}

/** Canonical body centre for the shared selection echo and Bring into view. */
function formCenter(entity: SceneFormEntity): [number, number, number] {
	const mesh = evaluateFormMesh(entity.form);
	if (mesh === null) return entity.position;
	const center = mesh.bounds.min.map((value, axis) => (value + mesh.bounds.max[axis]!) / 2);
	return new Vector3(center[0], center[1], center[2]).applyEuler(new Euler(...entity.rotation)).add(new Vector3(...entity.position)).toArray();
}

/** Metres to the millimetre shown in the Card, without float noise. */
function formatFormMeters(value: number): string {
	return `${Math.round(value * 1000) / 1000} m`;
}

/**
 * Occluders already built for one accepted snapshot, keyed by excluded subject.
 *
 * A snapshot is immutable: its compiled geometry and resolved Scene are the
 * accepted revision's, not a working copy. Building the list evaluates every
 * form's canonical key and allocates one occluder per drawn body, which pointer
 * movement would otherwise repeat for an unchanged Stage. The WeakMap retires
 * the lists with the snapshot, and the excluded id is part of the key because a
 * live drag changes it while the snapshot stays current.
 */
const occludersBySnapshot = new WeakMap<
	StageAdapterContext['snapshot'],
	Map<string | null, readonly SupportOccluder[]>
>();

function snapshotOccluders(
	context: StageAdapterContext,
	exceptEntityId: string | null
): readonly SupportOccluder[] {
	let bySubject = occludersBySnapshot.get(context.snapshot);
	if (bySubject === undefined) {
		bySubject = new Map();
		occludersBySnapshot.set(context.snapshot, bySubject);
	}
	const cached = bySubject.get(exceptEntityId);
	if (cached !== undefined) return cached;
	const domain = context.snapshot.domain;
	const built = supportOccluders(domain.geometry, domain.scene, exceptEntityId);
	bySubject.set(exceptEntityId, built);
	return built;
}

/** The floor support one pointer position resolves against the drawn geometry. */
function pointerFloorSupport(
	context: StageAdapterContext,
	css: readonly [number, number],
	exceptEntityId: string | null
) {
	// Stage pointer intents are local to the Stage surface; Camera rays use the
	// viewport's CSS coordinate space, whose origin includes the surface offset.
	const ray = context.ray([css[0] + context.evaluation.rect.left, css[1] + context.evaluation.rect.top]);
	if (ray === null) return { kind: 'none' as const, reason: 'degenerate' as const };
	return floorSupport(
		ray,
		context.snapshot.domain.datumMeters,
		snapshotOccluders(context, exceptEntityId)
	);
}

function moveSupportRefusal(
	support: Exclude<ReturnType<typeof floorSupport>, { readonly kind: 'floor' }>
): SceneSessionOutcome {
	if (support.kind === 'occluded') {
		return { kind: 'refused', code: 'occluded', message: `Floor support is obscured by ${support.occluderId}.` };
	}
	return {
		kind: 'refused',
		code: 'no-floor-support',
		message: support.reason === 'degenerate'
			? 'The pointer ray is unavailable for this reading.'
			: `No visible Room floor supports this pointer position (${support.reason}).`
	};
}

/**
 * The floor support a pointer Place may show, or `null`.
 *
 * A visible datum hit is not enough: the point must also be covered by exactly
 * one eligible compiled Room floor, so preview and the retained planner (which
 * re-derives the same support at commit) agree. The query is the Layout-owned
 * canonical resolution, reused here rather than a second membership test, and
 * `chooseFloorSupport` refuses `none` and `choice-required` exactly as commit
 * does. The point is the **snapped** X/Z the candidate will commit at, so an
 * enabled snap cannot move a shown pose off its floor. The drawn-geometry
 * occluder test still runs first so a Wall or plinth can never be mistaken for
 * floor.
 */
function pointerPlaceSupport(
	context: StageAdapterContext,
	css: readonly [number, number],
	snapStep: number | null
): { readonly x: number; readonly z: number; readonly elevation: number } | null {
	const visible = pointerFloorSupport(context, css, null);
	if (visible.kind !== 'floor') return null;
	const step = snapStep !== null && snapStep > 0 ? snapStep : null;
	const x = step === null ? visible.worldPoint[0] : Math.round(visible.worldPoint[0] / step) * step;
	const z = step === null ? visible.worldPoint[2] : Math.round(visible.worldPoint[2] / step) * step;
	const domain = context.snapshot.domain;
	const queried = queryFloorSupports(floorSupportSnapshotOf(domain.geometry), {
		generationId: sceneSupportGenerationId(context.snapshot.sourceContentId),
		x,
		z
	});
	if (queried.kind !== 'candidates') return null;
	const chosen = chooseFloorSupport(queried.candidates);
	if (chosen.kind !== 'resolved') return null;
	return { x, z, elevation: chosen.support.elevation };
}

export const createAdapter: StageAdapterFactory = (services) => {
	// Every planner is registered once, and the placement planner's definitions
	// are re-read for each preparation instead of being frozen at registration:
	// a native definition's metadata identity is captured asynchronously, and an
	// approved creator model becomes placeable after the adapter is already
	// mounted. The intent still carries `metadataContentId`, so a stale
	// definition refuses (`definition-changed`) rather than placing something
	// else. Catalogue models stay excluded until their r186 contact verification
	// is recorded; only admitted natives and approved creator models are here.
	const admitted: NormalizedPlacementDefinition[] = [];
	const planners = createScenePlanners({
		definitions: () => {
			// The approved model a creator has armed is an admitted definition even
			// before its first placement installs the resource. A rebind (a drawing
			// install replaces the accepted source) clears the captured procedure
			// definitions, so the arm itself must keep the model placeable.
			const projectId = services.stage.snapshot().acceptedRevision.projectId;
			const armed = armedModelDefinition(projectId);
			return [...admitted, ...creatorDefinitions(), ...(armed === null ? [] : [armed])];
		}
	});
	for (const planner of planners) {
		const registration = services.authoring.registerPlanner(planner);
		if (registration.kind !== 'registered') {
			throw new Error(
				`Scene adapter planner "${planner.kind}" was refused: ${registration.reason} — ${registration.message}`
			);
		}
	}
	void Promise.all(
		NATIVE_PLACEMENT_PRIMITIVES.map((primitive) => nativePlacementDefinition(primitive))
	).then((definitions) => {
		admitted.push(...definitions);
	});

	const adapter: StageAdapter = {
		id: 'scene',
		requiredCapabilities: ['stage-instrument-v1'],
		bind(context): StageAdapterBinding {
			const source = stageScene(context.snapshot);
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
			/** The task this binding is showing; pointer behavior follows the invoked task. */
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

			/**
			 * Publish/read the surface for the **live** accepted snapshot and reading.
			 * A binding can outlive a reading change, so the bind-time snapshot is not
			 * used here: the surface must be keyed exactly as the instrument and the
			 * overlay read it.
			 */
			function surfaceFor(evaluation: ViewportEvaluation, snapshot = services.stage.snapshot()): SceneSurface {
				const existing = sceneSurfaceFor(snapshot, evaluation);
				if (existing !== null) {
					if (openTaskKind === 'place-object') {
						applyPendingArm(existing.session);
						attachPlaceCompletion(existing.session);
					}
					return existing;
				}
				const session = sceneSessionFromServices({ services, evaluationId: evaluationIdOf(evaluation) });
				const next: SceneSurface = { reading: sceneReadingKey(evaluation), session };
				if (openTaskKind === 'place-object') {
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
				const epoch = taskEpoch;					session.setPlacementCommittedListener((placedId) => {
						if (placedId !== null) {
							// The model is a project resource now; no later Place task may
							// silently install a second instance from the same approval.
							clearArmedModel(services.stage.snapshot().acceptedRevision.projectId);
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
				if (session.armedModel() !== null) return;
				const pending = peekArmedModel(services.stage.snapshot().acceptedRevision.projectId);
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
				// through the host's one install path. Re-read the surface either way, so a
				// refused release withdraws any shown pose.
				await session.commitPlace();
				services.stage.notifySurfaceChange();
			}

			const footprints = buildPlanSceneFootprintProjection(source, { modelFootprintById: (id) => context.snapshot.domain.scene.modelFootprints?.get(id) }).footprints;
			return {
				subjects: source.entities.map((entity) => ({
					id: `scene:entity:${entity.id}`,
					label: `${entity.name} · ${entity.kind} · ${entity.id}`,
					reference: sceneEntityReference(entity.id, context.snapshot.domain.unitRevisions.scene),
					worldPoint: entity.kind !== 'form' ? entity.position : formCenter(entity)
				})),
				hitProvider(candidate, live) {
					if (!source.entities.some((entity) => entity.kind !== 'light')) return null;
					const css: [number, number] = [candidate.css[0] + live.evaluation.rect.left, candidate.css[1] + live.evaluation.rect.top];
					const ray = live.ray(css);
					if (ray === null) return null;
					const drawn = live.pickScene(ray);
					if (drawn?.kind === 'layout' || drawn?.kind === 'floor' && live.evaluation.renderedReading !== 'plan') return null;
					let entityId: string | null = drawn?.entityId ?? null;
					let distance = drawn?.distanceMeters ?? Infinity;
					if (live.evaluation.renderedReading === 'plan') {
						const t = (live.snapshot.domain.datumMeters - ray.origin[1]) / ray.direction[1];
						if (!(t >= 0 && Number.isFinite(t))) return null;
						const point: [number, number] = [ray.origin[0] + ray.direction[0] * t, ray.origin[2] + ray.direction[2] * t];
						const eligible = drawn?.kind !== 'entity' ? footprints : footprints.filter((footprint) => footprint.entityId === drawn.entityId);
						const hit = resolvePlanSceneHit(eligible, point, 6 * live.evaluation.targetPlaneMetersPerCssPixel);
						if (hit === null) return null;
						if (drawn?.kind !== 'entity') {
							// A footprint cannot select an unmounted or hidden body through a
							// floor. Only an edge halo may probe its own visible silhouette.
							if (hit.reason !== 'edge-halo') return null;
							const probe = planSceneHaloProbe(hit.footprint, point);
							const projected = probe === null ? null : live.project([probe[0], live.snapshot.domain.datumMeters, probe[1]]);
							const probeRay = projected === null ? null : live.ray(projected);
							if (probeRay === null || live.pickScene(probeRay)?.entityId !== hit.entityId) return null;
						}
						entityId = hit.entityId;
						distance = drawn?.distanceMeters ?? t;
					}
					if (entityId === null) return null;
					return {
						sourceId: entityId, sourceKind: 'entity',
						reference: sceneEntityReference(entityId, live.snapshot.domain.unitRevisions.scene),
						worldPoint: ray.origin.map((value, axis) => value + ray.direction[axis]! * distance) as [number, number, number]
					};
				},
				tasks: [
					{
						id: SCENE_PLACE_TASK,
						taskKind: 'place-object',
						label: 'Place object',
						targetRef: null,
						order: 20
					},
					{
						id: SCENE_ARRANGE_TASK,
						taskKind: SCENE_ARRANGE_TASK,
						label: 'Arrange',
						targetRef: context.selection()?.ref ?? null,
						order: 10
					},
					{
						id: SCENE_COMPOSE_TASK,
						taskKind: SCENE_COMPOSE_TASK,
						label: 'Compose',
						targetRef: context.selection()?.ref ?? null,
						order: 5
					},
					{
						id: SCENE_IMPORT_TASK,
						taskKind: SCENE_IMPORT_KIND,
						label: 'Import model',
						targetRef: null,
						order: 30
					}
				],
				findEntries: [
					{
						id: SCENE_PLACE_TASK,
						taskKind: 'place-object',
						label: 'Place object',
						railFamily: 'place',
						capability: 'scene',
						order: 20
					},
					{
						id: SCENE_ARRANGE_TASK,
						taskKind: SCENE_ARRANGE_TASK,
						label: 'Arrange',
						railFamily: 'arrange',
						capability: 'scene',
						order: 10
					},
					{
						id: 'scene-resize',
						taskKind: SCENE_COMPOSE_TASK,
						label: 'Resize',
						railFamily: 'arrange',
						capability: 'scene',
						order: 5
					},
					{
						id: 'scene-duplicate',
						taskKind: SCENE_COMPOSE_TASK,
						label: 'Duplicate',
						railFamily: 'arrange',
						capability: 'scene',
						order: 6
					},
					{
						id: 'scene-delete',
						taskKind: SCENE_COMPOSE_TASK,
						label: 'Delete',
						railFamily: 'arrange',
						capability: 'scene',
						order: 7
					},
					// Library and Head Find both read these entries: Import is a
					// procedure invoked by name, never a permanent pointer tool.
					{
						id: SCENE_IMPORT_TASK,
						taskKind: SCENE_IMPORT_KIND,
						label: 'Import model…',
						railFamily: 'library',
						capability: 'own model',
						order: 30
					}
				],
				// The pointer claim is offered before the host's navigation gesture and
				// only while this adapter's task owns the press. A refused clamp or a
				// missing selection refuses the claim rather than starting a drag.
				pointerIntent(intent: StagePointerIntent, adapterContext) {
					// Compose is a typed command surface. It claims no pointer: a press over
					// the Stage during Compose is ordinary navigation, never an accidental
					// move/yaw of the selected entity.
					if (openTaskKind === SCENE_COMPOSE_TASK) return false;
					// Claim the surface once, on the press. Every later phase of this
					// gesture reads the same session even if the viewport is re-evaluated.
					if (intent.phase === 'down') gestureSurface = surfaceFor(adapterContext.evaluation);
					const surface = gestureSurface ?? surfaceFor(adapterContext.evaluation);
					const session = surface.session;
					if (intent.phase === 'cancel') {
						dragOrigin = null;
						gestureSurface = null;
						// An interruption is not Esc/Select: Place stays armed.
						session.abortGesture();
						return true;
					}
					if (intent.phase === 'down') {
						if (openTaskKind === 'place-object') {
							// An approved model armed by Import places exactly like a native
							// primitive: press, preview on the compiled floor, release to commit.
							const armed = session.armedModel();
							const primitive = session.placePrimitive();
							const begun = armed === null ? session.beginPlace(primitive) : session.beginPlaceModel(armed);
							if (begun.kind === 'refused') {
								gestureSurface = null;
								return false;
							}
							const support = pointerPlaceSupport(adapterContext, intent.css, session.snapStep());
							if (support === null) {
								// No visible, compiled Room-floor support under the press: refuse
								// the claim rather than showing a pose commit would reject.
								session.abortGesture();
								gestureSurface = null;
								return false;
							}
							if (armed === null) session.previewPlace(primitive, support.x, support.z, support.elevation);
							else session.previewPlaceModel(armed, support.x, support.z, support.elevation);
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
						if (openTaskKind === 'place-object') {
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
					if (intent.shift === true && dragOrigin !== null && openTaskKind !== 'place-object') {
						const outcome = session.previewYaw(dragOrigin.yaw + (intent.css[0] - dragOrigin.x) * 0.01);
						session.reportPointerOutcome(outcome);
						return true;
					}
					if (openTaskKind === 'place-object') {
						// Place follows the pointer on the floor; a move without visible
						// compiled Room-floor support withdraws the displayed pose so release
						// cannot install it.
						const support = pointerPlaceSupport(adapterContext, intent.css, session.snapStep());
						if (support === null) {
							session.invalidatePreview();
							return true;
						}
						const armed = session.armedModel();
						if (armed === null) {
							session.previewPlace(
								session.placePrimitive(),
								support.x,
								support.z,
								support.elevation
							);
						} else {
							session.previewPlaceModel(armed, support.x, support.z, support.elevation);
						}
						return true;
					}
					// move: the pointer ray is resolved against the geometry the Stage
					// draws. A Wall, plinth or other object nearer than the datum is
					// support the creator cannot see, so the obsolete candidate is
					// withdrawn rather than committed on release.
					const support = pointerFloorSupport(
						adapterContext,
						intent.css,
						session.subjectEntityId()
					);
					if (support.kind !== 'floor') {
						session.invalidatePreview();
						session.reportPointerOutcome(moveSupportRefusal(support));
						return true;
					}
					const outcome = session.previewMove(support.worldPoint[0], support.worldPoint[2]);
					session.reportPointerOutcome(outcome);
					return true;
				},
				// Closing the task (Esc at the shell, replacement) uses the one cancel path.
				taskClosed() {
					dragOrigin = null;
					// Cancel the session this task armed (Place) or this press claimed
					// (Arrange), not whichever session another binding may have published.
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
				// The captured candidate is shown through the existing overlay surface,
				// so Plan and 3D present the same pose the planner would commit.
				overlay(adapterContext) {
					const surface = sceneSurfaceFor(adapterContext.snapshot, adapterContext.evaluation);
					const candidate = surface?.session.candidate() ?? null;
					if (candidate === null) return [];
					const css = adapterContext.project(candidate.position);
					if (css === null) return [];
					const snap = candidate.snappedStep === null ? '' : ` · snap ${candidate.snappedStep} m`;
					const scale = candidate.kind === 'resize' ? ` · scale ${candidate.scale}` : '';
					return [
						{
							id: 'scene-candidate',
							css,
							label: `${candidate.worldXZ[0].toFixed(3)}, ${candidate.worldXZ[1].toFixed(3)} m · ${candidate.yaw.toFixed(3)} rad${scale}${snap}`
						}
					];
				},
				// The candidate is drawn as the object's own body at the captured pose,
				// in the one Canvas, so Plan and 3D show what Commit will install.
				ghosts(adapterContext): readonly StageGhostMesh[] {
					const surface = sceneSurfaceFor(adapterContext.snapshot, adapterContext.evaluation);
					const candidate: SceneCandidate | null = surface?.session.candidate() ?? null;
					if (candidate === null) return [];
					const entity =
							candidate.entityId === null
								? null
								: adapterContext.snapshot.domain.scene.entities.find((entry) => entry.id === candidate.entityId) ??
									null;
					const ghost = candidateGhost(entity, candidate);
					return ghost === null ? [] : [ghost];
				},
				cardWriter(subject) {
					if (subject.reference?.domain !== 'scene' || !source.entities.some((entity) => entity.id === subject.sourceId && entity.kind === 'form')) return null;
					return { summary: 'Form fields', view: { component: FormCardFields, services } };
				},
				cardActions(subject) {
					if (subject.reference?.domain !== 'scene') return [];
					const entity = source.entities.find((entity) => entity.id === subject.sourceId && entity.kind === 'form');
					if (entity === undefined) return [];
					const snapshot = services.stage.snapshot();
					return [{ id: 'scene-form-delete', label: 'Delete form', destructive: true,
						detail: `Remove ${entity.name}. Undo restores it.`,
						async run() {
							const { deleteForm } = await import('./scene/form-card-command');
							return deleteForm(services, snapshot, entity.id);
						} }];
				},
				cardFacts(cardSubject: StageCardSubject) {
					// Only a Scene entity subject claims Scene facts; a Layout subject keeps
					// the Layout adapter's facts.
					if (cardSubject.sourceKind !== 'entity') return [];
					return entityFacts(services, source, cardSubject.sourceId);
				},
				instrument(task) {
					openTaskKind = task.kind;
					if (task.kind === SCENE_IMPORT_KIND) {
						// Import reads and approves only. It arms a model for the next floor
						// placement but installs nothing until that placement commits.
						return {
							summary: 'Import a model',
							view: { component: ImportModelInstrumentLazy, services }
						};
					}
					// Arm the surface for the reading the instrument will actually read,
					// not the bind-time one: a reading change does not rebuild the binding.
					const evaluation = services.stage.evaluation();
					if (task.kind === 'place-object' && evaluation !== null) {
						taskSurface = surfaceFor(evaluation, services.stage.snapshot());
						taskSurface.session.arm('place');
						// Import leaves the approved model it has not placed yet; the
						// session this task owns is the one that receives it.
						applyPendingArm(taskSurface.session);
						// Typed and pointer Place commit through this session; completing here
						// is what keeps the tool persistent and selects the new entity for a
						// typed commit too.
						attachPlaceCompletion(taskSurface.session);
					} else if (task.kind === SCENE_COMPOSE_TASK) {
						// Publish the surface before the panel mounts, so the duplicate
						// completion below is installed on the session the panel will use.
						taskSurface = evaluation === null ? liveSurface() : surfaceFor(evaluation, services.stage.snapshot());
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
					return {
						summary:
							task.kind === 'place-object'
								? 'Place object'
								: task.kind === SCENE_COMPOSE_TASK
									? 'Compose'
									: 'Arrange',
						view: { component: SceneTransformInstrument, services }
					};
				},
				dispose() {
					gestureSurface = null;
					openTaskKind = null;
					taskSurface = null;
					abortReopen?.();
					abortReopen = null;
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
	};
	return adapter;
};
