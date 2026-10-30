/**
 * T2.P01.S03 — the Scene adapter: the first coherent Scene editing surface.
 *
 * It registers the Scene planners with the one F.4 coordinator and contributes
 * Place, Compose and Import through T1.P01.S07's AM-5 points. R217.S08 adds the
 * shared Stage mark vocabulary for a selected object: Move, Turn, a Scale point
 * disclosure and the Size ray it reveals. The Arrange task and its instrument
 * posture are gone; the same exact Position, Yaw and Size values are the Card's
 * writer. It edits no host core, route or shell module, and it never writes
 * Layout: support is consulted by the retained planner.
 *
 * The session (`./scene/placement`) owns Place arming, the candidate preview and
 * the one cancel path. The no-task mark gesture owns its own lease and submits
 * the same planner the Card field does. This factory only wires both to the
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
	StageKeyboardIntent,
	StagePointerIntent
} from '$lib/authoring/stage/stage-facade';
import type { StageHandleDescriptor } from '$lib/authoring/stage/stage-handles';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-session';
import type { SceneEntity } from '@portfolio/project-model';
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
	type NormalizedPlacementDefinition,
	type SceneSupportChoice
} from '@portfolio/project-model/scene-planning';

import { planSceneFootprintsFor } from '$lib/authoring/scene/plan-scene-footprint';
import { pickPlanSceneSubject } from '$lib/authoring/scene/plan-scene-hit';
import { PAPER_LAYER } from '$lib/authoring/stage/paper-plan';
import FormCardFields from './scene/FormCardFieldsLazy.svelte';
import SceneObjectCardFields from './scene/SceneObjectCardFields.svelte';
import ShapeReadingPalette from './scene/shape/ShapeReadingPalette.svelte';
import { createShapeReadingSession } from './scene/shape/reading';
import SceneTransformInstrument from './scene/SceneTransformInstrument.svelte';
import ImportModelInstrumentLazy from './scene/import/ImportModelInstrumentLazy.svelte';
import { perfMark } from '$lib/platform/perf-marks';
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
	axisTravelFromRay,
	formSizeMeasurement,
	formSizeScaleFromTravel,
	formWorldAxis,
	formWorldPoint,
	previewFormSize,
	type FormSizeAxis,
	type FormSizeHandle,
	type FormSizeMeasurement
} from './scene/shape/form-size';
import { acceptFormCommand } from './scene/form-card-command';
import { deleteSceneObject, duplicateSceneObject } from './scene/object-card';
import {
	SCENE_OBJECT_MARK,
	boundsFootprint,
	isSceneObjectEditMarkId,
	isSceneObjectEntity,
	markCandidate,
	planSceneObjectMark,
	primitiveBounds,
	sceneObjectMarkDescriptors,
	sceneObjectMarkIntent,
	sceneObjectScale,
	sizeRayGeometry,
	type SceneObjectBounds,
	type SceneObjectEditMarkId,
	type SceneObjectFootprint,
	type SceneObjectMarkLive
} from './scene/object-marks';
import {
	publishSceneSurface,
	retireSceneSurface,
	sceneEntityReference,
	sceneReadingKey,
	sceneSessionFromServices,
	sceneSurfaceFor,
	localContactMinY,
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
		// Dimensions are exposed by the lazy Card's per-axis Size fields.
		...(entity.kind === 'form' ? [{ label: 'Material', value: entity.materialId }] : [])
	];
}

/** Canonical body centre for the shared selection echo and Bring into view. */
function formCenter(entity: SceneFormEntity): [number, number, number] {
	const mesh = evaluateFormMesh(entity.form);
	if (mesh === null) return entity.position;
	const center = mesh.bounds.min.map((value, axis) => (value + mesh.bounds.max[axis]!) / 2);
	return new Vector3(center[0], center[1], center[2]).applyEuler(new Euler(...entity.rotation)).add(new Vector3(...entity.position)).toArray();
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
): {
	readonly x: number;
	readonly z: number;
	readonly elevation: number;
	/** The exact floor the preview stood on, qualified and pinned for commit. */
	readonly choice: SceneSupportChoice;
} | null {
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
	return {
		x,
		z,
		elevation: chosen.support.elevation,
		choice: {
			kind: 'elevation',
			elevation: chosen.support.elevation,
			generationId: sceneSupportGenerationId(context.snapshot.sourceContentId)
		}
	};
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
		// Handle admission refuses a grip that names anything outside this set. The
		// Scene marks name place-on-floor, set-yaw and resize-on-floor, all of which
		// are registered here; no mark introduces a fourth planner.
		plannerKinds: planners.map((planner) => planner.kind),
		// The Shape reading is contributed to the one Ink Pen through the host's
		// reading seam; Scene keeps every byte of its meaning.
		requiredCapabilities: ['stage-instrument-v1', 'ink-readings-v1'],
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

			/** One direct-manipulation size ray; never a task and never a second writer. */
			type SizeGesture = {
				readonly evaluationId: string;
				readonly lease: GestureAcquisition;
				readonly entity: SceneFormEntity;
				readonly handle: FormSizeHandle;
				readonly measurement: FormSizeMeasurement;
				/** Plan hides world Y, so Height uses pointer travel in the same CSS axis as its marker. */
				readonly planHeightTravel: { readonly startY: number; readonly metersPerCssPixel: number } | null;
				scale: readonly [number, number, number] | null;
				candidate: SceneFormEntity | null;
				refusal: string | null;
			};
			let sizeGesture: SizeGesture | null = null;
			/** The last refusal a completed or abandoned size ray leaves on the Stage. */
			let sizeRefusal: string | null = null;
			const SIZE_HANDLE_HIT_CSS_PX = 12;
			const SIZE_PLAN_HEIGHT_MARKER_GAP_CSS_PX = 24;

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

			/* --- Per-axis size rays on a selected form -------------------------- */

			function selectedFormEntity(adapterContext: StageAdapterContext): SceneFormEntity | null {
				const primary = adapterContext.selectionState().primary;
				if (primary === null || primary.domain !== 'scene' || primary.subject.kind !== 'entity') {
					return null;
				}
				const entity = stageScene(adapterContext.snapshot).entities.find(
					(entry) => entry.id === primary.subject.id
				);
				return entity?.kind === 'form' ? entity : null;
			}

			/** Stage-local CSS for one world point, the space pointer intents use. */
			function stageCss(
				adapterContext: StageAdapterContext,
				world: readonly [number, number, number]
			): readonly [number, number] | null {
				const css = adapterContext.project(world as [number, number, number]);
				return css === null
					? null
					: [css[0] - adapterContext.evaluation.rect.left, css[1] - adapterContext.evaluation.rect.top];
			}

			/** Viewport CSS for one world point: the space overlay contributions publish. */
			function viewportCss(
				adapterContext: StageAdapterContext,
				world: readonly [number, number, number]
			): readonly [number, number] | null {
				return adapterContext.project(world as [number, number, number]);
			}

			/** Plan looks down world Y, so only Height needs the screen-space sizing axis there. */
			function usesPlanHeightScreenTravel(
				adapterContext: StageAdapterContext,
				handle: FormSizeHandle
			): boolean {
				return adapterContext.evaluation.settledReading === 'plan' && handle.axis === 1;
			}

			/** The same viewport point both publishes and hit-tests each size marker. */
			function sizeHandleViewportCss(
				adapterContext: StageAdapterContext,
				entity: SceneFormEntity,
				measurement: FormSizeMeasurement,
				handle: FormSizeHandle
			): readonly [number, number] | null {
				if (!usesPlanHeightScreenTravel(adapterContext, handle)) {
					return viewportCss(adapterContext, handle.world);
				}
				const metersPerCssPixel = adapterContext.evaluation.targetPlaneMetersPerCssPixel;
				if (measurement.bounds === null || !(metersPerCssPixel > 0)) return null;
				const base = viewportCss(
					adapterContext,
					formWorldPoint(entity, [handle.local[0], measurement.bounds.min[1], handle.local[2]])
				);
				if (base === null) return null;
				return [
					base[0],
					base[1] - SIZE_PLAN_HEIGHT_MARKER_GAP_CSS_PX - handle.dimension / metersPerCssPixel
				];
			}

			function sizeHandleStageCss(
				adapterContext: StageAdapterContext,
				entity: SceneFormEntity,
				measurement: FormSizeMeasurement,
				handle: FormSizeHandle
			): readonly [number, number] | null {
				const css = sizeHandleViewportCss(adapterContext, entity, measurement, handle);
				return css === null
					? null
					: [
							css[0] - adapterContext.evaluation.rect.left,
							css[1] - adapterContext.evaluation.rect.top
						];
			}

			function sizeHandleAt(
				adapterContext: StageAdapterContext,
				css: readonly [number, number]
			): { readonly entity: SceneFormEntity; readonly handle: FormSizeHandle; readonly measurement: FormSizeMeasurement } | null {
				const entity = selectedFormEntity(adapterContext);
				if (entity === null) return null;
				const measurement = formSizeMeasurement(entity);
				let best: { handle: FormSizeHandle; distance: number } | null = null;
				for (const handle of measurement.handles) {
					const projected = sizeHandleStageCss(adapterContext, entity, measurement, handle);
					if (projected === null) continue;
					const distance = Math.hypot(css[0] - projected[0], css[1] - projected[1]);
					if (distance > SIZE_HANDLE_HIT_CSS_PX) continue;
					if (best === null || distance < best.distance) best = { handle, distance };
				}
				return best === null ? null : { entity, handle: best.handle, measurement };
			}

			function endSizeGesture(): void {
				const current = sizeGesture;
				sizeGesture = null;
				if (current?.lease.kind === 'granted' && current.lease.lease.active) {
					current.lease.lease.release();
				}
			}

			/* --- Object marks: move, turn and the disclosed size ray ----------- */

			/**
			 * Pointer intersection arithmetic is floating-point; an exact Card value is
			 * not. Quantizing at a nanometre keeps a drag from writing 2.6000000000000005
			 * and then disagreeing byte-for-byte with the creator typing `2.6`.
			 */
			function quantizeMarkValue(value: number): number {
				return Number.isFinite(value) ? Number(value.toFixed(9)) : value;
			}

			/**
			 * One no-task mark gesture. The press captures the accepted baseline and the
			 * exact world reading its mark drives; every move previews through the same
			 * planner the release submits. The lease is the S03 one, so a reading change
			 * ends the gesture rather than reinterpreting it.
			 */
			type ObjectMarkGesture = {
				readonly evaluationId: string;
				readonly markId: SceneObjectEditMarkId;
				readonly lease: GestureAcquisition;
				readonly entityId: string;
				readonly contactMinY: number;
				readonly bounds: SceneObjectBounds | null;
				readonly startYaw: number;
				readonly startScale: number;
				/** The ring's floor-plane elevation, shared by press and every move. */
				readonly ringY: number;
				turnStartAngle: number | null;
				sizeStartTravel: number | null;
				candidate: SceneCandidate | null;
				refusal: string | null;
			};
			let objectMarkGesture: ObjectMarkGesture | null = null;
			/** The refusal keyed to the subject it came from; a new subject replaces it. */
			let objectMarkRefusal: {
				readonly entityId: string;
				readonly markId: SceneObjectEditMarkId;
				readonly message: string;
			} | null = null;

			function endObjectMarkGesture(): void {
				const current = objectMarkGesture;
				objectMarkGesture = null;
				if (current?.lease.kind === 'granted' && current.lease.lease.active) {
					current.lease.lease.release();
				}
			}

			/** A lease ended under a proposal is the proposal's end too. */
			function pruneObjectMarkGesture(): void {
				const current = objectMarkGesture;
				if (current === null) return;
				if (current.lease.kind !== 'granted' || !current.lease.lease.active) {
					objectMarkGesture = null;
					objectMarkRefusal = {
						entityId: current.entityId,
						markId: current.markId,
						message: 'The reading changed; start the gesture again.'
					};
				}
			}

			function selectedObjectEntity(adapterContext: StageAdapterContext): SceneEntity | null {
				const primary = adapterContext.selectionState().primary;
				if (primary === null || primary.domain !== 'scene' || primary.subject.kind !== 'entity') {
					return null;
				}
				const entity = stageScene(adapterContext.snapshot).entities.find(
					(entry) => entry.id === primary.subject.id
				);
				return isSceneObjectEntity(entity) ? entity : null;
			}

			function objectContact(entity: SceneEntity): number | null {
				return localContactMinY(
					entity,
					entity.kind === 'model'
						? sceneModelContactMinY(stageEnvelope(services.stage.snapshot()), entity)
						: null
				);
			}

			/**
			 * Drawn bounds when the pick source has them; an analytic primitive derives
			 * the same box. A model without a mounted body has no honest extent here,
			 * so the Scale point and Size ray are withheld rather than guessed.
			 */
			function objectBounds(
				adapterContext: StageAdapterContext,
				entity: SceneEntity
			): SceneObjectBounds | null {
				const rendered = adapterContext.sceneBounds(entity.id);
				if (rendered !== null) return rendered;
				return entity.kind === 'primitive' ? primitiveBounds(entity) : null;
			}

			function objectFootprint(
				entity: SceneEntity,
				bounds: SceneObjectBounds | null
			): SceneObjectFootprint | null {
				if (bounds !== null) return boundsFootprint(bounds);
				if (entity.kind !== 'model') return null;
				for (const resource of stageEnvelope(services.stage.snapshot()).units.resources.data.resources) {
					if (resource.kind === 'model' && resource.id === entity.assetId && resource.model !== undefined) {
						return {
							width: resource.model.placement.footprint.width,
							depth: resource.model.placement.footprint.depth
						};
					}
				}
				return null;
			}

			function objectMarkLive(entity: SceneEntity): SceneObjectMarkLive | null {
				const current = objectMarkGesture;
				if (current !== null && current.entityId === entity.id) {
					return {
						markId: current.markId,
						position: current.candidate?.position ?? entity.position,
						yaw: current.candidate?.yaw ?? entity.rotation[1],
						scale: current.candidate?.scale ?? sceneObjectScale(entity),
						refusal: current.refusal
					};
				}
				if (objectMarkRefusal !== null && objectMarkRefusal.entityId === entity.id) {
					return {
						markId: objectMarkRefusal.markId,
						position: entity.position,
						yaw: entity.rotation[1],
						scale: sceneObjectScale(entity),
						refusal: objectMarkRefusal.message
					};
				}
				return null;
			}

			function objectMarkDescriptors(
				adapterContext: StageAdapterContext
			): ReturnType<typeof sceneObjectMarkDescriptors> {
				pruneObjectMarkGesture();
				const entity = selectedObjectEntity(adapterContext);
				if (entity === null) return [];
				const contactMinY = objectContact(entity);
				if (contactMinY === null) return [];
				// The planners' own gate: a light, a vertical plane, a tilted entity or a
				// model without verified contact publishes no mark that would refuse.
				if (!sceneComposeSupport(entity, contactMinY).resize) return [];
				const bounds = objectBounds(adapterContext, entity);
				return sceneObjectMarkDescriptors({
					entity,
					contactMinY,
					bounds,
					footprint: objectFootprint(entity, bounds),
					live: objectMarkLive(entity)
				});
			}

			function objectMarkGhost(
				adapterContext: StageAdapterContext
			): StageGhostMesh | null {
				pruneObjectMarkGesture();
				const current = objectMarkGesture;
				if (current?.candidate === null || current?.candidate === undefined) return null;
				const entity = stageScene(adapterContext.snapshot).entities.find(
					(entry) => entry.id === current.entityId
				);
				return entity === undefined ? null : candidateGhost(entity, current.candidate);
			}

			/** The pointer ray's angle around the entity's vertical axis. */
			function turnAngleAt(
				adapterContext: StageAdapterContext,
				entityId: string,
				css: readonly [number, number],
				planeY: number
			): number | null {
				const entity = stageScene(adapterContext.snapshot).entities.find((entry) => entry.id === entityId);
				if (entity === undefined) return null;
				const ray = adapterContext.ray([
					css[0] + adapterContext.evaluation.rect.left,
					css[1] + adapterContext.evaluation.rect.top
				]);
				if (ray === null || Math.abs(ray.direction[1]) < 1e-6) return null;
				const t = (planeY - ray.origin[1]) / ray.direction[1];
				if (!Number.isFinite(t) || t <= 0) return null;
				const x = ray.origin[0] + ray.direction[0] * t;
				const z = ray.origin[2] + ray.direction[2] * t;
				const angle = Math.atan2(-(z - entity.position[2]), x - entity.position[0]);
				return Number.isFinite(angle) ? angle : null;
			}

			/** The signed travel along the bounds diagonal the pointer names. */
			function sizeTravelAt(
				adapterContext: StageAdapterContext,
				bounds: SceneObjectBounds,
				css: readonly [number, number]
			): number | null {
				const ray = adapterContext.ray([
					css[0] + adapterContext.evaluation.rect.left,
					css[1] + adapterContext.evaluation.rect.top
				]);
				const geometry = sizeRayGeometry(bounds);
				if (ray === null || geometry === null) return null;
				return axisTravelFromRay({
					origin: geometry.anchor,
					direction: geometry.axis,
					rayOrigin: ray.origin,
					rayDirection: ray.direction
				});
			}

			function applyObjectMarkPlan(
				gesture: ObjectMarkGesture,
				result: ReturnType<typeof planSceneObjectMark>
			): void {
				if (result.kind === 'rejected') {
					gesture.candidate = null;
					gesture.refusal = result.message;
					return;
				}
				const candidate = markCandidate(result);
				gesture.candidate = candidate;
				gesture.refusal = candidate === null ? 'The candidate entity vanished.' : null;
			}

			/**
			 * The no-task press path for an object mark.
			 *
			 * A press that did not start on an admitted editing mark is refused, so the
			 * host's navigation gesture keeps the pointer. The form size knobs stay on
			 * their own path until S09 converts them to descriptors.
			 */
			function objectMarkPointer(
				intent: StagePointerIntent,
				adapterContext: StageAdapterContext
			): boolean {
				if (services.stage.session.task() !== null) return false;
				pruneObjectMarkGesture();
				if (intent.phase === 'down') {
					const markId = intent.handleId;
					if (!isSceneObjectEditMarkId(markId)) return false;
					const entity = selectedObjectEntity(adapterContext);
					if (entity === null) return false;
					const contactMinY = objectContact(entity);
					if (contactMinY === null) return false;
					const bounds = objectBounds(adapterContext, entity);
					if (markId === SCENE_OBJECT_MARK.size && bounds === null) return false;
					if (objectMarkGesture !== null) endObjectMarkGesture();
					const acquisition = services.stage.acquireGesture({
						owner: 'scene-object-marks',
						evaluationId: intent.evaluationId,
						policy: 'cancel-on-reading-change'
					});
					if (acquisition.kind !== 'granted') {
						objectMarkRefusal = {
							entityId: entity.id,
							markId,
							message: `The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`
						};
						services.stage.notifySurfaceChange();
						return false;
					}
					objectMarkRefusal = null;
					const ringY =
						entity.position[1] + sceneObjectScale(entity) * contactMinY;
					objectMarkGesture = {
						evaluationId: intent.evaluationId,
						markId,
						lease: acquisition,
						entityId: entity.id,
						contactMinY,
						bounds,
						startYaw: entity.rotation[1],
						startScale: sceneObjectScale(entity),
						ringY,
						turnStartAngle:
							markId === SCENE_OBJECT_MARK.turn
								? turnAngleAt(adapterContext, entity.id, intent.css, ringY)
								: null,
						sizeStartTravel:
							markId === SCENE_OBJECT_MARK.size && bounds !== null
								? sizeTravelAt(adapterContext, bounds, intent.css)
								: null,
						candidate: null,
						refusal: null
					};
					services.stage.notifySurfaceChange();
					return true;
				}

				const gesture = objectMarkGesture;
				if (gesture === null) return false;
				if (gesture.lease.kind === 'granted' && !gesture.lease.lease.active) {
					endObjectMarkGesture();
					objectMarkRefusal = {
						entityId: gesture.entityId,
						markId: gesture.markId,
						message: 'The content changed; start the gesture again.'
					};
					services.stage.notifySurfaceChange();
					return true;
				}
				if (intent.phase === 'cancel') {
					endObjectMarkGesture();
					services.stage.notifySurfaceChange();
					return true;
				}
				if (intent.evaluationId !== gesture.evaluationId) {
					// A reading flip measured this gesture in a projection that no longer
					// exists. Ending it is the one safe outcome.
					endObjectMarkGesture();
					objectMarkRefusal = {
						entityId: gesture.entityId,
						markId: gesture.markId,
						message: 'The reading changed; start the gesture again.'
					};
					services.stage.notifySurfaceChange();
					return true;
				}
				const entity = stageScene(adapterContext.snapshot).entities.find(
					(entry) => entry.id === gesture.entityId
				);
				if (entity === undefined) {
					endObjectMarkGesture();
					objectMarkRefusal = {
						entityId: gesture.entityId,
						markId: gesture.markId,
						message: 'The entity no longer exists.'
					};
					services.stage.notifySurfaceChange();
					return true;
				}
				if (intent.phase === 'move') {
					if (gesture.markId === SCENE_OBJECT_MARK.move) {
						const support = pointerFloorSupport(adapterContext, intent.css, gesture.entityId);
						if (support.kind !== 'floor') {
							gesture.candidate = null;
							const refusal = moveSupportRefusal(support);
							gesture.refusal = refusal.kind === 'refused'
								? refusal.message
								: 'The pointer position is not a committable floor support.';
						} else {
							// The S05 snap fact belongs to the Scene session, so a mark drag
							// honours the same free-position step a Place or typed field does.
							const step =
								sceneSurfaceFor(adapterContext.snapshot, adapterContext.evaluation)?.session.snapStep() ??
								liveSurface()?.session.snapStep() ??
								null;
							const snap = (value: number) =>
								step !== null && step > 0 ? Math.round(value / step) * step : value;
							applyObjectMarkPlan(
								gesture,
								planSceneObjectMark({
									markId: SCENE_OBJECT_MARK.move,
									context: sizePlannerContext(adapterContext),
									entityId: gesture.entityId,
									contactMinY: gesture.contactMinY,
									worldXZ: [
										quantizeMarkValue(snap(support.worldPoint[0])),
										quantizeMarkValue(snap(support.worldPoint[2]))
									]
								})
							);
						}
					} else if (gesture.markId === SCENE_OBJECT_MARK.turn) {
						const angle = turnAngleAt(adapterContext, gesture.entityId, intent.css, gesture.ringY);
						if (angle === null) {
							gesture.candidate = null;
							gesture.refusal = 'The pointer ray is not on the turn plane.';
						} else {
							if (gesture.turnStartAngle === null) gesture.turnStartAngle = angle;
							let delta = angle - gesture.turnStartAngle;
							while (delta > Math.PI) delta -= Math.PI * 2;
							while (delta < -Math.PI) delta += Math.PI * 2;
							applyObjectMarkPlan(
								gesture,
								planSceneObjectMark({
									markId: SCENE_OBJECT_MARK.turn,
									context: sizePlannerContext(adapterContext),
									entityId: gesture.entityId,
									yaw: quantizeMarkValue(gesture.startYaw + delta)
								})
							);
						}
					} else if (gesture.bounds !== null) {
						const travel = sizeTravelAt(adapterContext, gesture.bounds, intent.css);
						const geometry = sizeRayGeometry(gesture.bounds);
						if (travel === null || geometry === null) {
							gesture.candidate = null;
							gesture.refusal = 'Move along the bounds diagonal to name a size.';
						} else {
							if (gesture.sizeStartTravel === null) gesture.sizeStartTravel = travel;
							const unscaledDiagonal = geometry.extent / gesture.startScale;
							const scale =
								gesture.startScale +
								(travel - gesture.sizeStartTravel) / unscaledDiagonal;
							applyObjectMarkPlan(
								gesture,
								planSceneObjectMark({
									markId: SCENE_OBJECT_MARK.size,
									context: sizePlannerContext(adapterContext),
									entityId: gesture.entityId,
									contactMinY: gesture.contactMinY,
									scale: quantizeMarkValue(scale)
								})
							);
						}
					}
					services.stage.notifySurfaceChange();
					return true;
				}

				// Release: one captured candidate, one F4 intent, one history entry.
				const preview = gesture;
				endObjectMarkGesture();
				if (preview.candidate !== null) {
					const snapshot = services.stage.snapshot();
					perfMark('command:commit', { entityId: preview.entityId });
					try {
						const intentToAccept = sceneObjectMarkIntent({
							...(preview.markId === SCENE_OBJECT_MARK.move
								? {
										markId: SCENE_OBJECT_MARK.move,
										entityId: preview.entityId,
										contactMinY: preview.contactMinY,
										worldXZ: preview.candidate.worldXZ
									} as const
								: preview.markId === SCENE_OBJECT_MARK.turn
									? {
											markId: SCENE_OBJECT_MARK.turn,
											entityId: preview.entityId,
											yaw: preview.candidate.yaw
										} as const
									: {
											markId: SCENE_OBJECT_MARK.size,
											entityId: preview.entityId,
											contactMinY: preview.contactMinY,
											scale: preview.candidate.scale
										} as const),
							projectId: snapshot.acceptedRevision.projectId,
							revisionId: services.authoring.acceptedRevision().revisionId,
							sceneContentRevision: snapshot.domain.unitRevisions.scene,
							operationId: globalThis.crypto.randomUUID()
						});
						void services.authoring.accept(intentToAccept).then(
							(outcome) => {
								if (outcome.kind === 'refused') {
									objectMarkRefusal = {
										entityId: preview.entityId,
										markId: preview.markId,
										message: outcome.message
									};
								}
								services.stage.notifySurfaceChange();
							},
							(error: unknown) => {
								objectMarkRefusal = {
									entityId: preview.entityId,
									markId: preview.markId,
									message:
										error instanceof Error ? error.message : 'The accepted install failed.'
								};
								services.stage.notifySurfaceChange();
							}
						);
					} catch (error) {
						objectMarkRefusal = {
							entityId: preview.entityId,
							markId: preview.markId,
							message: error instanceof Error ? error.message : 'The intent could not be built.'
						};
					}
				} else if (preview.refusal !== null) {
					objectMarkRefusal = {
						entityId: preview.entityId,
						markId: preview.markId,
						message: preview.refusal
					};
				}
				services.stage.notifySurfaceChange();
				return true;
			}

			/** Escape during a live mark gesture is the writer's cancel, not a task's. */
			function objectMarkKey(intent: StageKeyboardIntent): boolean {
				if (openTaskKind !== null || objectMarkGesture === null) return false;
				if (intent.kind !== 'cancel') return false;
				endObjectMarkGesture();
				services.stage.notifySurfaceChange();
				return true;
			}

			/** The accepted Scene payload the size planner reads, never the runtime projection. */
			function sizePlannerContext(adapterContext: StageAdapterContext) {
				const snapshot = adapterContext.snapshot;
				const envelope = stageEnvelope(snapshot);
				return {
					layout: envelope.units.layout.data,
					scene: envelope.units.scene.data,
					sourceContentId: snapshot.sourceContentId
				};
			}

			/** The pointer half of sizing: one press, one preview, one commit. */
			function sizePointer(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {
				if (services.stage.session.task() !== null) return false;
				if (intent.phase === 'down') {
					const hit = sizeHandleAt(adapterContext, intent.css);
					if (hit === null) return false;
					if (sizeGesture !== null) endSizeGesture();
					sizeRefusal = null;
					const acquisition = services.stage.acquireGesture({
						owner: 'scene-form-size',
						evaluationId: intent.evaluationId,
						policy: 'cancel-on-reading-change'
					});
					if (acquisition.kind !== 'granted') {
						sizeRefusal = `The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`;
						services.stage.notifySurfaceChange();
						return false;
					}
					sizeGesture = {
						evaluationId: intent.evaluationId,
						lease: acquisition,
						entity: hit.entity,
						handle: hit.handle,
						measurement: hit.measurement,
						planHeightTravel: usesPlanHeightScreenTravel(adapterContext, hit.handle)
							? {
									startY: intent.css[1],
									metersPerCssPixel: adapterContext.evaluation.targetPlaneMetersPerCssPixel
								}
							: null,
						scale: null,
						candidate: null,
						refusal: null
					};
					services.stage.notifySurfaceChange();
					return true;
				}
				const current = sizeGesture;
				if (current === null) return false;
				if (current.lease.kind === 'granted' && !current.lease.lease.active) {
					// A content install (or another reading change) released the lease.
					// The captured entity belongs to a source that is no longer mounted.
					endSizeGesture();
					sizeRefusal = 'The content changed; start the size ray again.';
					services.stage.notifySurfaceChange();
					return true;
				}
				if (intent.phase === 'cancel') {
					endSizeGesture();
					services.stage.notifySurfaceChange();
					return true;
				}
				if (intent.evaluationId !== current.evaluationId) {
					// A reading flip measured this drag in a projection that no longer exists.
					endSizeGesture();
					sizeRefusal = 'The reading changed; start the size ray again.';
					services.stage.notifySurfaceChange();
					return true;
				}
				if (intent.phase === 'move') {
					const travel = current.planHeightTravel === null
						? (() => {
								const ray = adapterContext.ray([
									intent.css[0] + adapterContext.evaluation.rect.left,
									intent.css[1] + adapterContext.evaluation.rect.top
								]);
								return ray === null
									? null
									: axisTravelFromRay({
											origin: formWorldPoint(current.entity, [0, 0, 0]),
											direction: formWorldAxis(current.entity, current.handle.axis),
											rayOrigin: ray.origin,
											rayDirection: ray.direction
										});
							})()
						: current.handle.dimension / current.handle.factor +
							((current.planHeightTravel.startY - intent.css[1]) *
								current.planHeightTravel.metersPerCssPixel) /
								current.handle.factor;
					const scale =
						travel === null
							? null
							: formSizeScaleFromTravel({
									entity: current.entity,
									handle: current.handle,
									travelMeters: travel
								});
					if (scale === null) {
						current.scale = null;
						current.candidate = null;
						current.refusal = 'Move the handle to name a new size.';
					} else {
						const preview = previewFormSize({
							context: sizePlannerContext(adapterContext),
							entityId: current.entity.id,
							scale
						});
						if ('candidate' in preview) {
							const next = preview.candidate.scene.entities.find(
								(entry) => entry.id === current.entity.id
							);
							current.scale = scale;
							current.candidate = next?.kind === 'form' ? next : null;
							current.refusal = current.candidate === null ? 'The form body could not be evaluated.' : null;
						} else {
							current.scale = null;
							current.candidate = null;
							current.refusal = preview.refusal;
						}
					}
					services.stage.notifySurfaceChange();
					return true;
				}
				// Release commits one full per-axis size through the existing planner.
				const preview = current;
				endSizeGesture();
				if (preview.scale !== null && preview.candidate !== null) {
					void acceptFormCommand(
						services,
						services.stage.snapshot(),
						preview.entity.id,
						'set-form-size',
						{ entityId: preview.entity.id, scale: preview.scale }
					).then((outcome) => {
						sizeRefusal = outcome.kind === 'refused' ? outcome.message : null;
						services.stage.notifySurfaceChange();
					});
				} else {
					sizeRefusal = preview.refusal ?? 'That drag named no size.';
				}
				services.stage.notifySurfaceChange();
				return true;
			}

			/** The three knobs, one per axis, while no task owns the pointer. */
			function sizeOverlay(adapterContext: StageAdapterContext) {
				if (services.stage.session.task() !== null) return null;
				const entity = selectedFormEntity(adapterContext);
				if (entity === null) return null;
				const active = sizeGesture;
				const displayEntity = active?.candidate ?? entity;
				const measurement =
					active === null
						? formSizeMeasurement(entity)
						: active.candidate === null
							? active.measurement
							: formSizeMeasurement(active.candidate);
				if (measurement.handles.length === 0) return null;
				const markers = measurement.handles.flatMap((handle) => {
					const projected = sizeHandleViewportCss(adapterContext, displayEntity, measurement, handle);
					if (projected === null) return [];
					const interaction = usesPlanHeightScreenTravel(adapterContext, handle)
						? 'drag upward to increase; downward to reduce'
						: 'drag for size';
					return [{
						id: `scene-form-size-${handle.axis}`,
						css: projected,
						label: `${handle.label} ${handle.dimension.toFixed(3)} m — ${interaction}; exact value in the Card`
					}];
				});
				const refusal = active?.refusal ?? sizeRefusal;
				if (refusal !== null) {
					const anchor = markers[0];
					if (anchor !== undefined) {
						markers.push({ id: 'scene-form-size-refusal', css: anchor.css, label: refusal });
					}
				}
				return markers;
			}

			function sizeGhost(): StageGhostMesh | null {
				const active = sizeGesture;
				if (active?.candidate === null || active?.candidate === undefined) return null;
				return {
					id: 'scene-form-size-preview',
					center: active.candidate.position,
					yaw: active.candidate.rotation[1],
					shape: { kind: 'form', form: active.candidate.form }
				};
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

			// The same projection Paper draws: the accepted runtime Scene the route hands
			// to the Canvas, not a second projection of the authored unit document.
			const runtimeScene = context.snapshot.domain.scene;
			const footprints = planSceneFootprintsFor(runtimeScene, runtimeScene.modelFootprints).footprints;
			return {
				subjects: source.entities.map((entity) => ({
					id: `scene:entity:${entity.id}`,
					label: `${entity.name} · ${entity.kind} · ${entity.id}`,
					reference: sceneEntityReference(entity.id, context.snapshot.domain.unitRevisions.scene),
					worldPoint: entity.kind !== 'form' ? entity.position : formCenter(entity)
				})),
				hostTools: ['erase', 'measure'],
				pick(candidate, live) {
					if (!source.entities.some((entity) => entity.kind !== 'light')) return null;
					const css: [number, number] = [candidate.css[0] + live.evaluation.rect.left, candidate.css[1] + live.evaluation.rect.top];
					const ray = live.ray(css);
					if (ray === null) return null;
					const drawn = live.pickScene(ray);
					if (drawn?.kind === 'layout' || drawn?.kind === 'floor' && live.evaluation.renderedReading !== 'plan') return null;
					let entityId: string | null = drawn?.entityId ?? null;
					let distance = drawn?.distanceMeters ?? Infinity;
					let cssDistance = 0;
					if (live.evaluation.renderedReading === 'plan') {
						const t = (live.snapshot.domain.datumMeters - ray.origin[1]) / ray.direction[1];
						if (!(t >= 0 && Number.isFinite(t))) return null;
						const point: [number, number] = [ray.origin[0] + ray.direction[0] * t, ray.origin[2] + ray.direction[2] * t];
						const planHit = pickPlanSceneSubject({
							footprints,
							point,
							edgeHaloMeters: 6 * live.evaluation.targetPlaneMetersPerCssPixel,
							datumMeters: live.snapshot.domain.datumMeters,
							datumDistanceMeters: t,
							pixelsPerMeter: live.evaluation.targetPlaneMetersPerCssPixel,
							ray,
							pickScene: (probe) => live.pickScene(probe),
							projectWorld: (probe) => live.project(probe),
							rayAtCss: (probeCss) => live.ray(probeCss)
						});
						if (planHit === null) return null;
						entityId = planHit.entityId;
						distance = planHit.distanceMeters;
						cssDistance = planHit.cssDistance;
					}
					if (entityId === null) return null;
					let worldPoint = ray.origin.map((value, axis) => value + ray.direction[axis]! * distance) as [number, number, number];
					if (candidate.purpose === 'tool' && candidate.tool?.kind === 'measure') {
						const bounds = live.sceneBounds(entityId);
						let nearest = 8;
						if (bounds !== null) for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
							const corner: [number, number, number] = [x, y, z];
							const projected = live.project(corner);
							if (projected === null) continue;
							const d = Math.hypot(projected[0] - css[0], projected[1] - css[1]);
							if (d <= nearest) { nearest = d; worldPoint = corner; }
						}
					}
					return {
						hit: { sourceId: entityId, sourceKind: 'entity',
						reference: sceneEntityReference(entityId, live.snapshot.domain.unitRevisions.scene),
						worldPoint },
						refusal: null, depthMeters: drawn?.kind === 'entity' ? drawn.distanceMeters : null,
						planLayer: PAPER_LAYER.sceneFootprint, cssDistance
					};
				},
				readings: [
					{
						id: 'shape',
						label: 'Shape',
						order: 20,
						summary: 'Close an outline on the floor or an upright sheet, pull its depth and create a native form.',
						begin: () => createShapeReadingSession(services),
						view: ShapeReadingPalette
					}
				],
				tasks: [
					{
						id: SCENE_PLACE_TASK,
						taskKind: 'place-object',
						label: 'Place object',
						targetRef: null,
						order: 20
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
				/**
				 * Size rays are direct manipulation of the current selection, not a task.
				 * The Scene binding joins Layout's handles in the host's no-task press
				 * offer; a press that is not on a knob falls through to navigation rather
				 * than silently starting an arrange drag.
				 */
				pressWhenNoTask: true,
				/**
				 * The one mark vocabulary: when no task is open, a selected object publishes
				 * Move, Turn and the Scale point, and the disclosed Size ray. The host admits,
				 * projects and hit-tests those descriptors; this binding only says which
				 * facts and planner each one names.
				 */
				handles(adapterContext: StageAdapterContext): readonly StageHandleDescriptor[] {
					return objectMarkDescriptors(adapterContext);
				},
				// The pointer claim is offered before the host's navigation gesture and
				// only while this adapter's task owns the press (or a mark is live).
				// A refused clamp or a missing selection refuses the claim rather than
				// starting a drag.
				pointerIntent(intent: StagePointerIntent, adapterContext) {
					// Compose is a typed command surface. It claims no pointer: a press over
					// the Stage during Compose is ordinary navigation, never an accidental
					// move/yaw of the selected entity.
					if (openTaskKind === SCENE_COMPOSE_TASK) return false;
					// With no contributed task open this binding is the selection's direct
					// manipulation surface: an admitted object mark claims its own drag; a
					// form's per-axis size knobs remain their own path until S09 converts
					// them to descriptors.
					if (openTaskKind === null) {
						return objectMarkPointer(intent, adapterContext) || sizePointer(intent, adapterContext);
					}
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
							const support = pointerPlaceSupport(adapterContext, intent.css, session.snapStep());
							if (support === null) {
								// No visible, compiled Room-floor support under the press: refuse
								// the claim rather than showing a pose commit would reject.
								session.abortGesture();
								gestureSurface = null;
								return false;
							}
			if (copy !== null) {
				session.previewPlaceFormCopy(copy, support.x, support.z, support.elevation, support.choice);
			} else if (armed === null) {
				session.previewPlace(primitive, support.x, support.z, support.elevation);
							} else {
								session.previewPlaceModel(armed, support.x, support.z, support.elevation);
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
						const copy = session.armedFormCopy();
						const armed = copy === null ? session.armedModel() : null;
			if (copy !== null) {
				session.previewPlaceFormCopy(copy, support.x, support.z, support.elevation, support.choice);
			} else if (armed === null) {
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
				/**
				 * Escape during a live mark gesture cancels that writer before the host
				 * unwinds the selection. No task is open, so this is reached through the
				 * host's gesture-key path, not the contributed-task key path.
				 */
				keyIntent(intent: StageKeyboardIntent): boolean {
					return objectMarkKey(intent);
				},
				// Closing the task (Esc at the shell, replacement) uses the one cancel path.
				selectionChanged() {
					// A knob belongs to the subject it was drawn for; a new subject's
					// handles replace it, and a stale refusal would name the old one.
					if (sizeGesture !== null) endSizeGesture();
					sizeRefusal = null;
					if (objectMarkGesture !== null) endObjectMarkGesture();
					objectMarkRefusal = null;
				},
				taskClosed() {
					if (sizeGesture !== null) {
						endSizeGesture();
						sizeRefusal = null;
					}
					if (objectMarkGesture !== null) endObjectMarkGesture();
					objectMarkRefusal = null;
					dragOrigin = null;
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
				// The captured candidate is shown through the existing overlay surface,
				// so Plan and 3D present the same pose the planner would commit.
				overlay(adapterContext) {
					const sizeMarkers = sizeOverlay(adapterContext) ?? [];
					const surface = sceneSurfaceFor(adapterContext.snapshot, adapterContext.evaluation);
					const candidate = surface?.session.candidate() ?? null;
					if (candidate === null) return sizeMarkers;
					const css = adapterContext.project(candidate.position);
					if (css === null) return sizeMarkers;
					const snap = candidate.snappedStep === null ? '' : ` · snap ${candidate.snappedStep} m`;
					const scale = candidate.kind === 'resize' ? ` · scale ${candidate.scale}` : '';
					return [
						...sizeMarkers,
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
					const size = sizeGhost();
					const object = objectMarkGhost(adapterContext);
					const surface = sceneSurfaceFor(adapterContext.snapshot, adapterContext.evaluation);
					const candidate: SceneCandidate | null = surface?.session.candidate() ?? null;
					if (candidate === null) {
						if (object === null) return size === null ? [] : [size];
						return size === null ? [object] : [size, object];
					}
					const entity =
							candidate.entityId === null
								? null
								: adapterContext.snapshot.domain.scene.entities.find((entry) => entry.id === candidate.entityId) ??
									null;
					const ghost = candidateGhost(entity, candidate);
					return size === null ? (ghost === null ? [] : [ghost]) : ghost === null ? [size] : [size, ghost];
				},
				cardWriter(subject) {
					if (subject.reference?.domain !== 'scene') return null;
					const entity = source.entities.find((entry) => entry.id === subject.sourceId);
					if (entity?.kind === 'form') {
						return { summary: 'Form fields', view: { component: FormCardFields, services } };
					}
					// A catalogue model or primitive gets the Arrange instrument's exact
					// Position, Yaw and Size writers where PLATE puts ordinary dimensions.
					if (!isSceneObjectEntity(entity)) return null;
					return { summary: 'Object fields', view: { component: SceneObjectCardFields, services } };
				},
				cardActions(subject) {
					if (subject.reference?.domain !== 'scene') return [];
					// Read the live accepted source: an immediate command can install a
					// copy whose action row is requested before the next binding rebuild.
					const snapshot = services.stage.snapshot();
					const entity = stageScene(snapshot).entities.find((entity) => entity.id === subject.sourceId);
					if (entity === undefined) return [];
					if (entity.kind === 'form') {
						// My Objects Save is adapter-owned UI inside the form fields, so the
						// Card action row keeps its one destructive action and the host shell is
						// unchanged.
						return [
							{
								id: 'scene-form-delete',
								label: 'Delete form',
								destructive: true,
								detail: `Remove ${entity.name}. Undo restores it.`,
								async run() {
									const { deleteForm } = await import('./scene/form-card-command');
									return deleteForm(services, snapshot, entity.id);
								}
							}
						];
					}
					if (!isSceneObjectEntity(entity)) return [];
					// S08 moves the object's exact fields to the Card; the existing
					// immediate commands stay beside them, so the creator does not have to
					// open Compose to duplicate or delete the selected object.
					return [
						{
							id: 'scene-object-duplicate',
							label: 'Duplicate',
							detail: `Add one copy of ${entity.name} at +0.5 m X/Z. Undo removes it.`,
							async run() {
								return duplicateSceneObject(services, services.stage.snapshot(), entity.id);
							}
						},
						{
							id: 'scene-object-delete',
							label: 'Delete object',
							destructive: true,
							detail: `Remove ${entity.name}. Undo restores it.`,
							async run() {
								return deleteSceneObject(services, services.stage.snapshot(), entity.id);
							}
						}
					];
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
									: 'Import model',
						view: { component: SceneTransformInstrument, services }
					};
				},
				dispose() {
					if (sizeGesture !== null) endSizeGesture();
					sizeRefusal = null;
					if (objectMarkGesture !== null) endObjectMarkGesture();
					objectMarkRefusal = null;
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
