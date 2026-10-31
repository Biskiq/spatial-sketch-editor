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
	StageCandidatePreview,
	StageGhostMesh,
	StageDomainPick,
	StageKeyboardIntent,
	StagePointerIntent
} from '$lib/authoring/stage/stage-facade';
import type { StageHandleDescriptor } from '$lib/authoring/stage/stage-handles';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-session';
import type { StageHeightTick } from '$lib/authoring/stage/stage-height-sheet';
import type { SceneEntity, Vec3 } from '@portfolio/project-model';
import {
	draftingSnapIncrementMeters,
	snapDraftingPlacement
} from '$lib/authoring/stage/stage-drafting';
import { isStageDrag } from '$lib/authoring/stage/stage-input';
import { stageEnvelope, stageScene } from '$lib/authoring/stage/unit-stage-source';
import type { SceneFormEntity } from '$lib/content/scene';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import {
	NATIVE_PLACEMENT_PRIMITIVES,
	NATIVE_PLACEMENT_DIMENSIONS,
	admittedCatalogueModelAssets,
	catalogueModelContactMinY,
	catalogueModelDefinition,
	nativePlacementDefinition
} from '$lib/authoring/scene/object-definition-policy';
import { getAssetById } from '$lib/content/assets';
import {
	approvedModelResources,
	createScenePlanners,
	creatorModelDefinition,
	resolveSceneSupportOnGeometry,
	sceneSupportGenerationId,
	type NormalizedPlacementDefinition,
	type SceneSupportChoice
} from '@portfolio/project-model/scene-planning';

import { buildPlanSceneFootprintProjection, planSceneFootprintsFor } from '$lib/authoring/scene/plan-scene-footprint';
import { pickPlanSceneSubject } from '$lib/authoring/scene/plan-scene-hit';
import { PAPER_LAYER } from '$lib/authoring/stage/paper-plan';
import FormCardFields from './scene/FormCardFieldsLazy.svelte';
import SceneObjectCardFields from './scene/SceneObjectCardFields.svelte';
import { createObjectDrawSession, type ObjectDrawSession } from './scene/shape/draw-session';
import { armTile, armedTile, setObjectsPanelCompact } from './scene/shape/armed-tile';
import { publishObjectDraw } from './scene/shape/draw-surface';
import type { ShapeKind } from './scene/shape/outline';
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
	SCENE_FORM_MARK,
	axisTravelFromRay,
	formMarkDescriptors,
	formMoveScreenOffset,
	formSizeMeasurement,
	formSizeScaleFromTravel,
	formWorldAxis,
	formWorldPoint,
	isSceneFormEditMarkId,
	previewFormSize,
	type FormMarkScreenHeight,
	type FormSizeHandle,
	type FormSizeMeasurement,
	type SceneFormEditMarkId,
	type SceneFormMarkLive
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
	snapFreePlacement,
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

/** The datum point one pointer position reaches past the drawn geometry. */
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

/** The pointer ray's datum-plane point, even when support refuses it. */
function pointerDatumPoint(
	context: StageAdapterContext,
	css: readonly [number, number]
): Vec3 | null {
	const ray = context.ray([css[0] + context.evaluation.rect.left, css[1] + context.evaluation.rect.top]);
	if (ray === null || Math.abs(ray.direction[1]) < 1e-8) return null;
	const distance = (context.snapshot.domain.datumMeters - ray.origin[1]) / ray.direction[1];
	if (!Number.isFinite(distance) || distance < 0) return null;
	const point: Vec3 = [
		ray.origin[0] + ray.direction[0] * distance,
		context.snapshot.domain.datumMeters,
		ray.origin[2] + ray.direction[2] * distance
	];
	return point.every(Number.isFinite) ? point : null;
}

/** Apply the Stage's shared CSS-pixel click/drag boundary to a captured body press. */
function isStagePointerDrag(
	origin: readonly [number, number],
	point: readonly [number, number]
): boolean {
	return isStageDrag({ x: origin[0], y: origin[1] }, { x: point[0], y: point[1] });
}

/** A Scene entity at the exact pose a candidate would install. */
function sceneEntityAtCandidate(
	candidate: SceneCandidate,
	acceptedEntities: readonly SceneEntity[]
): SceneEntity | null {
	if (candidate.entityId !== null) {
		const accepted = acceptedEntities.find((entity) => entity.id === candidate.entityId);
		if (accepted === undefined) return null;
		if (accepted.kind === 'form') {
			return {
				...accepted,
				position: [...candidate.position] as Vec3,
				rotation: [...candidate.rotation] as Vec3,
				...(candidate.form === undefined ? {} : { form: candidate.form })
			};
		}
		return {
			...accepted,
			position: [...candidate.position] as Vec3,
			rotation: [...candidate.rotation] as Vec3,
			scale: candidate.scale
		};
	}
	if (candidate.form !== undefined) {
		return {
			kind: 'form',
			id: 'scene-candidate-form',
			name: 'Candidate form',
			position: [...candidate.position] as Vec3,
			rotation: [...candidate.rotation] as Vec3,
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true,
			form: candidate.form
		};
	}
	if (candidate.primitive !== null) {
		const base = {
			kind: 'primitive' as const,
			id: 'scene-candidate-primitive',
			name: 'Candidate object',
			materialId: 'plaster-warm' as const,
			castShadow: true,
			receiveShadow: true,
			position: [...candidate.position] as Vec3,
			rotation: [...candidate.rotation] as Vec3
		};
		switch (candidate.primitive) {
			case 'box':
				return { ...base, primitive: 'box', dimensions: { ...NATIVE_PLACEMENT_DIMENSIONS.box } };
			case 'cylinder':
				return { ...base, primitive: 'cylinder', dimensions: { ...NATIVE_PLACEMENT_DIMENSIONS.cylinder } };
			case 'sphere':
				return { ...base, primitive: 'sphere', dimensions: { ...NATIVE_PLACEMENT_DIMENSIONS.sphere } };
		}
	}
	if (candidate.modelAssetId !== undefined && candidate.footprint !== undefined) {
		return {
			kind: 'model',
			id: 'scene-candidate-model',
			name: 'Candidate model',
			assetId: candidate.modelAssetId,
			fallback: 'generic',
			position: [...candidate.position] as Vec3,
			rotation: [...candidate.rotation] as Vec3
		};
	}
	return null;
}

/** Build the Paper silhouette through the same Scene footprint authority as picking. */
function sceneCandidatePaperPreview(
	entity: SceneEntity,
	datumMeters: number,
	modelFootprints: ReadonlyMap<string, { readonly width: number; readonly depth: number }> | undefined,
	role: StageCandidatePreview['role'] = 'subject',
	label?: { readonly world: Vec3; readonly text: string }
): StageCandidatePreview | null {
	const projection = buildPlanSceneFootprintProjection(
		{ entities: [entity] },
		{ modelFootprintById: (assetId) => modelFootprints?.get(assetId) }
	);
	const footprint = projection.footprints[0];
	if (footprint === undefined) return null;
	const rings = footprint.polygons ?? [footprint.points];
	return {
		id: 'scene-candidate-footprint',
		role,
		polygons: rings.map((ring) => ring.map(([x, z]) => [x, datumMeters, z] as Vec3)),
		segments: [],
		labels: label === undefined ? [] : [label]
	};
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
			: `The pointer does not reach the Stage datum (${support.reason}).`
	};
}

/**
 * The support a pointer Place may show, or `null`.
 *
 * Resolved by the planner's own rule at the **snapped** X/Z the candidate will
 * commit at: the Room floor that covers the point, otherwise the Layout's explicit
 * datum. Preview and commit therefore cannot disagree, and `choice-required` is
 * refused here exactly as it is at commit. The drawn-geometry occluder test still
 * runs first so a Wall or plinth can never be mistaken for a place to stand.
 */
function pointerPlaceSupport(
	context: StageAdapterContext,
	css: readonly [number, number],
	snapStep: number | null
): {
	readonly x: number;
	readonly z: number;
	readonly elevation: number;
	/** The exact support the preview stood on, qualified and pinned for commit. */
	readonly choice: SceneSupportChoice;
} | null {
	const visible = pointerFloorSupport(context, css, null);
	if (visible.kind !== 'floor') return null;
	const snapped = snapFreePlacement([visible.worldPoint[0], visible.worldPoint[2]], snapStep);
	const x = snapped.x;
	const z = snapped.z;
	const domain = context.snapshot.domain;
	const generationId = sceneSupportGenerationId(context.snapshot.sourceContentId);
	const resolved = resolveSceneSupportOnGeometry({
		geometry: domain.geometry,
		generationId,
		point: [x, z],
		requiredElevation: null
	});
	if (resolved.kind !== 'resolved') return null;
	return {
		x,
		z,
		elevation: resolved.support.elevation,
		choice: { kind: 'elevation', elevation: resolved.support.elevation, generationId }
	};
}

export const createAdapter: StageAdapterFactory = (services) => {
	// Every planner is registered once, and the placement planner's definitions
	// are re-read for each preparation instead of being frozen at registration:
	// a native definition's metadata identity is captured asynchronously, and an
	// approved creator model becomes placeable after the adapter is already
	// mounted. The intent still carries `metadataContentId`, so a stale
	// definition refuses (`definition-changed`) rather than placing something
	// else. Built-in catalogue models enter this set only after their r186 contact
	// verification is recorded; approved creator models remain project-scoped.
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
	void Promise.all([
		...NATIVE_PLACEMENT_PRIMITIVES.map((primitive) => nativePlacementDefinition(primitive)),
		...admittedCatalogueModelAssets().map((asset) => catalogueModelDefinition(asset.id))
	]).then((definitions) => {
		admitted.push(
			...definitions.filter(
				(definition): definition is NormalizedPlacementDefinition => definition !== null
			)
		);
	});

	const adapter: StageAdapter = {
		id: 'scene',
		// Handle admission refuses a grip that names anything outside this set. The
		// Scene marks name place-on-floor, set-yaw and resize-on-floor, all of which
		// are registered here; no mark introduces a fourth planner.
		plannerKinds: planners.map((planner) => planner.kind),
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
			let placementPointerRefusal: {
				readonly css: readonly [number, number];
				readonly world: Vec3 | null;
				readonly message: string;
				readonly candidate: SceneCandidate | null;
			} | null = null;

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

			const projectIdOf = (): string => services.stage.snapshot().acceptedRevision.projectId;
			/** The drawn Shape tile this Place task is armed with, when a tile is what is armed. */
			function drawnTile(): ShapeKind | null {
				if (openTaskKind !== 'place-object') return null;
				const session = taskSurface?.session ?? ownedSurface?.surface.session ?? null;
				if (session?.armedFormCopy() != null || session?.armedModel() != null) return null;
				if (peekArmedModel(projectIdOf()) !== null) return null;
				const tile = armedTile(projectIdOf());
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
					setObjectsPanelCompact(projectIdOf(), true);
				},
				changed() {
					publishObjectDraw(objectDraw);
				}
			});
			publishObjectDraw(objectDraw);

			/** One direct-manipulation mark on a selected native form; never a task. */
			type FormMarkGesture = {
				readonly evaluationId: string;
				readonly pressCss: readonly [number, number];
				readonly bodyPress: boolean;
				readonly markId: SceneFormEditMarkId;
				readonly lease: GestureAcquisition;
				readonly entity: SceneFormEntity;
				readonly measurement: FormSizeMeasurement;
				readonly contactMinY: number;
				/** World-space pointer-to-origin offset captured on the Move press. */
				readonly moveGrabOffset: readonly [number, number] | null;
				readonly startYaw: number;
				readonly ringY: number;
				/** Plan hides world Y, so Height uses pointer travel in the same CSS axis as its mark. */
				readonly planHeightTravel: { readonly startY: number; readonly metersPerCssPixel: number } | null;
				/** World-axis cursor coordinate at pointerdown; size rays start at a fixed screen glyph. */
				readonly sizeStartTravelMeters: number | null;
				turnStartAngle: number | null;
				scale: readonly [number, number, number] | null;
				candidate: SceneFormEntity | null;
				refusal: string | null;
			};
			let formMarkGesture: FormMarkGesture | null = null;
			/** The refusal keyed to the subject and mark it came from. */
			let formMarkRefusal: {
				readonly entityId: string;
				readonly markId: SceneFormEditMarkId;
				readonly message: string;
			} | null = null;
			const FORM_PLAN_HEIGHT_MARKER_GAP_CSS_PX = 24;
			// Move and Width share an origin and axis for upright forms. A 24 px gap
			// keeps their two 30 px glyphs separately pressable in every reading.
			const FORM_MOVE_MARKER_GAP_CSS_PX = 24;

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

			/** The form's live mark values, keyed to the gesture that owns them. */
			function formMarkLive(entity: SceneFormEntity): SceneFormMarkLive | null {
				const current = formMarkGesture;
				if (current !== null && current.entity.id === entity.id) {
					return {
						markId: current.markId,
						position: current.candidate?.position ?? entity.position,
						yaw: current.candidate?.rotation[1] ?? entity.rotation[1],
						scale: current.candidate?.form.scale ?? entity.form.scale,
						refusal: current.refusal
					};
				}
				if (formMarkRefusal !== null && formMarkRefusal.entityId === entity.id) {
					return {
						markId: formMarkRefusal.markId,
						position: entity.position,
						yaw: entity.rotation[1],
						scale: entity.form.scale,
						refusal: formMarkRefusal.message
					};
				}
				return null;
			}

			/**
			 * Plan's edge-on Height ray needs the approved screen fallback. The offset
			 * is the old marker's 24 px gap plus the live height in CSS px; the axis is
			 * stage-up. 3D keeps the real world Y axis and no hint.
			 */
			function formScreenHeight(
				adapterContext: StageAdapterContext,
				measurement: FormSizeMeasurement
			): FormMarkScreenHeight | null {
				if (adapterContext.evaluation.settledReading !== 'plan') return null;
				const height = measurement.handles.find((handle) => handle.axis === 1);
				const metersPerCssPixel = adapterContext.evaluation.targetPlaneMetersPerCssPixel;
				if (height === undefined || !(metersPerCssPixel > 0)) return null;
				return {
					offset: [
						0,
						-(FORM_PLAN_HEIGHT_MARKER_GAP_CSS_PX + height.dimension / metersPerCssPixel)
					],
					axis: [0, -1]
				};
			}

			/**
			 * Move and Width share their origin and axis for upright forms, so their
			 * hit areas overlap in 3D as well as Plan. Keep Move perpendicular to its
			 * projected axis and away from the Depth ray in every reading.
			 */
			function formScreenMove(
				adapterContext: StageAdapterContext,
				entity: SceneFormEntity,
				measurement: FormSizeMeasurement
			): { offset: readonly [number, number] } | null {
				return formMoveScreenOffset({
					entity,
					measurement,
					project: (point) => adapterContext.project(point),
					gapPx: FORM_MOVE_MARKER_GAP_CSS_PX
				});
			}

			/** The six descriptors for the selected form, live candidate included. */
			function formMarkDescriptorsFor(
				adapterContext: StageAdapterContext
			): readonly StageHandleDescriptor[] {
				pruneFormMarkGesture();
				const accepted = selectedFormEntity(adapterContext);
				if (accepted === null) return [];
				const current = formMarkGesture;
				const entity = current?.candidate ?? accepted;
				const measurement =
					current === null
						? formSizeMeasurement(accepted)
						: current.candidate === null
							? current.measurement
							: formSizeMeasurement(current.candidate);
				if (measurement.handles.length !== 3) return [];
				return formMarkDescriptors({
					entity,
					measurement,
					live: formMarkLive(accepted),
					screenHeight: formScreenHeight(adapterContext, measurement),
					screenMove: formScreenMove(adapterContext, entity, measurement)
				});
			}

			function endFormMarkGesture(): void {
				const current = formMarkGesture;
				formMarkGesture = null;
				if (current?.lease.kind === 'granted' && current.lease.lease.active) {
					current.lease.lease.release();
				}
			}

			function pruneFormMarkGesture(): void {
				const current = formMarkGesture;
				if (current === null) return;
				if (current.lease.kind !== 'granted' || !current.lease.lease.active) {
					formMarkGesture = null;
					formMarkRefusal = {
						entityId: current.entity.id,
						markId: current.markId,
						message: 'The reading changed; start the mark gesture again.'
					};
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
				readonly pressCss: readonly [number, number];
				readonly bodyPress: boolean;
				readonly markId: SceneObjectEditMarkId;
				readonly lease: GestureAcquisition;
				readonly entityId: string;
				readonly contactMinY: number;
				readonly bounds: SceneObjectBounds | null;
				readonly startYaw: number;
				readonly startScale: number;
				/** Body presses preserve the pointer's offset from the selected origin. */
				readonly moveGrabOffset: readonly [number, number] | null;
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
				return admittedModelFootprint(services.stage.snapshot(), entity.assetId);
			}

			/** A model proxy comes only from its captured creator metadata or verified catalogue record. */
			function admittedModelFootprint(
				snapshot: StageAdapterContext['snapshot'],
				assetId: string
			): SceneObjectFootprint | null {
				for (const resource of stageEnvelope(snapshot).units.resources.data.resources) {
					if (resource.kind === 'model' && resource.id === assetId && resource.model !== undefined) {
						return {
							width: resource.model.placement.footprint.width,
							depth: resource.model.placement.footprint.depth
						};
					}
				}
				const asset = getAssetById(assetId);
				if (catalogueModelContactMinY(assetId) !== null && asset?.footprint !== undefined) {
					return { width: asset.footprint.width, depth: asset.footprint.depth };
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
				return entity === undefined
					? null
					: candidateGhost(entity, current.candidate, {
							modelFootprint:
								entity.kind === 'model'
									? adapterContext.snapshot.domain.scene.modelFootprints?.get(entity.assetId) ??
									  admittedModelFootprint(adapterContext.snapshot, entity.assetId)
									: null,
							modelContactMinY: entity.kind === 'model' ? current.contactMinY : null
						});
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
					let markId = intent.handleId;
					let bodyPress = false;
					if (markId === undefined) {
						const selected = selectedObjectEntity(adapterContext);
						if (selected === null) return false;
						const picked = services.stage.resolvePick({
							css: intent.css,
							evaluationId: intent.evaluationId,
							purpose: 'select',
							tool: null,
							...(intent.coarse === undefined ? {} : { coarse: intent.coarse })
						});
						if (
							picked.kind !== 'resolved' ||
							picked.hit.reference?.domain !== 'scene' ||
							picked.hit.sourceKind !== 'entity' ||
							picked.hit.sourceId !== selected.id
						) return false;
						markId = SCENE_OBJECT_MARK.move;
						bodyPress = true;
					}
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
					const pressPoint = bodyPress ? pointerDatumPoint(adapterContext, intent.css) : null;
					objectMarkGesture = {
						evaluationId: intent.evaluationId,
						pressCss: [intent.css[0], intent.css[1]],
						bodyPress,
						markId,
						lease: acquisition,
						entityId: entity.id,
						contactMinY,
						bounds,
						startYaw: entity.rotation[1],
						startScale: sceneObjectScale(entity),
						moveGrabOffset:
							pressPoint === null
								? null
								: [pressPoint[0] - entity.position[0], pressPoint[2] - entity.position[2]],
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
					if (gesture.bodyPress && !isStagePointerDrag(gesture.pressCss, intent.css)) {
						// A body press is still a click until the shared 4 CSS px boundary is
						// crossed. Clear again if a drag returns inside the tolerance.
						gesture.candidate = null;
						gesture.refusal = null;
						services.stage.notifySurfaceChange();
						return true;
					}
					if (gesture.markId === SCENE_OBJECT_MARK.move) {
						const support = pointerFloorSupport(adapterContext, intent.css, gesture.entityId);
						if (support.kind !== 'floor') {
							gesture.candidate = null;
							const refusal = moveSupportRefusal(support);
							gesture.refusal = refusal.kind === 'refused'
								? refusal.message
								: 'The pointer position is not a committable floor support.';
						} else {
							// Object Move consumes the same live Grid/Snap fact as Layout Ink
							// and Place. Alt/Option suspension is therefore immediate, and
							// there is one shared rounding and float-cleaning pass.
							const drafting = adapterContext.drafting();
							const step = draftingSnapIncrementMeters(drafting);
							const grabOffset = gesture.moveGrabOffset ?? [0, 0];
							const snapped = snapDraftingPlacement(
								[support.worldPoint[0] - grabOffset[0], support.worldPoint[2] - grabOffset[1]],
								step
							);
							applyObjectMarkPlan(
								gesture,
								planSceneObjectMark({
									markId: SCENE_OBJECT_MARK.move,
									context: sizePlannerContext(adapterContext),
									entityId: gesture.entityId,
									contactMinY: gesture.contactMinY,
									worldXZ: [snapped.x, snapped.z]
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
				if (preview.bodyPress && !isStagePointerDrag(preview.pressCss, intent.css)) {
					services.stage.notifySurfaceChange();
					return true;
				}
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

			/** Apply one shared planner preview to a form mark gesture. */
			function applyFormMarkPlan(
				gesture: FormMarkGesture,
				result: ReturnType<typeof planSceneObjectMark>
			): void {
				if (result.kind === 'rejected') {
					gesture.candidate = null;
					gesture.refusal = result.message;
					return;
				}
				const next = result.scene.entities.find((entry) => entry.id === gesture.entity.id);
				gesture.candidate = next?.kind === 'form' ? next : null;
				gesture.refusal = gesture.candidate === null ? 'The form body could not be evaluated.' : null;
			}

			function formRayHandle(
				measurement: FormSizeMeasurement,
				markId: SceneFormEditMarkId
			): FormSizeHandle | null {
				const axis =
					markId === SCENE_FORM_MARK.width
						? 0
						: markId === SCENE_FORM_MARK.height
							? 1
							: markId === SCENE_FORM_MARK.depth
								? 2
								: -1;
				return axis === -1 ? null : measurement.handles.find((handle) => handle.axis === axis) ?? null;
			}

			/** One press, one preview, one commit through the form's own planners. */
			function formMarkPointer(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {
				if (services.stage.session.task() !== null) return false;
				pruneFormMarkGesture();
				if (intent.phase === 'down') {
					let markId = intent.handleId;
					let bodyPress = false;
					if (markId === undefined) {
						const selected = selectedFormEntity(adapterContext);
						if (selected === null) return false;
						const picked = services.stage.resolvePick({
							css: intent.css,
							evaluationId: intent.evaluationId,
							purpose: 'select',
							tool: null,
							...(intent.coarse === undefined ? {} : { coarse: intent.coarse })
						});
						if (
							picked.kind !== 'resolved' ||
							picked.hit.reference?.domain !== 'scene' ||
							picked.hit.sourceKind !== 'entity' ||
							picked.hit.sourceId !== selected.id
						) return false;
						markId = SCENE_FORM_MARK.move;
						bodyPress = true;
					}
					if (!isSceneFormEditMarkId(markId)) return false;
					const entity = selectedFormEntity(adapterContext);
					if (entity === null) return false;
					const measurement = formSizeMeasurement(entity);
					if (measurement.handles.length !== 3) return false;
					const ray = formRayHandle(measurement, markId);
					if (markId !== SCENE_FORM_MARK.move && markId !== SCENE_FORM_MARK.turn && ray === null) return false;
					if (formMarkGesture !== null) endFormMarkGesture();
					formMarkRefusal = null;
					const acquisition = services.stage.acquireGesture({
						owner: 'scene-form-marks',
						evaluationId: intent.evaluationId,
						policy: 'cancel-on-reading-change'
					});
					if (acquisition.kind !== 'granted') {
						formMarkRefusal = {
							entityId: entity.id,
							markId,
							message: `The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`
						};
						services.stage.notifySurfaceChange();
						return false;
					}
					const ringY = entity.position[1] + measurement.contactMinY;
					const movePressSupport =
						markId === SCENE_FORM_MARK.move && !bodyPress
							? pointerFloorSupport(adapterContext, intent.css, entity.id)
							: null;
					const movePressPoint =
						markId !== SCENE_FORM_MARK.move
							? null
							: bodyPress
								? pointerDatumPoint(adapterContext, intent.css)
								: movePressSupport?.kind === 'floor'
									? movePressSupport.worldPoint
									: null;
					const planHeightTravel =
						markId === SCENE_FORM_MARK.height &&
						adapterContext.evaluation.settledReading === 'plan' &&
						adapterContext.evaluation.targetPlaneMetersPerCssPixel > 0
							? {
									startY: intent.css[1],
									metersPerCssPixel: adapterContext.evaluation.targetPlaneMetersPerCssPixel
								}
							: null;
					let sizeStartTravelMeters: number | null = null;
					if (
						ray !== null &&
						planHeightTravel === null &&
						markId !== SCENE_FORM_MARK.move &&
						markId !== SCENE_FORM_MARK.turn
					) {
						const startRay = adapterContext.ray([
							intent.css[0] + adapterContext.evaluation.rect.left,
							intent.css[1] + adapterContext.evaluation.rect.top
						]);
						if (startRay !== null) {
							sizeStartTravelMeters = axisTravelFromRay({
								origin: formWorldPoint(entity, [0, 0, 0]),
								direction: formWorldAxis(entity, ray.axis),
								rayOrigin: startRay.origin,
								rayDirection: startRay.direction
							});
						}
					}
					formMarkGesture = {
						evaluationId: intent.evaluationId,
						pressCss: [intent.css[0], intent.css[1]],
						bodyPress,
						markId,
						lease: acquisition,
						entity,
						measurement,
						contactMinY: measurement.contactMinY,
						moveGrabOffset:
							movePressPoint !== null
								? [
										movePressPoint[0] - entity.position[0],
										movePressPoint[2] - entity.position[2]
									]
								: null,
						startYaw: entity.rotation[1],
						ringY,
						planHeightTravel,
						sizeStartTravelMeters,
						turnStartAngle:
							markId === SCENE_FORM_MARK.turn
								? turnAngleAt(adapterContext, entity.id, intent.css, ringY)
								: null,
						scale: null,
						candidate: null,
						refusal: null
					};
					services.stage.notifySurfaceChange();
					return true;
				}

				const current = formMarkGesture;
				if (current === null) return false;
				if (current.lease.kind === 'granted' && !current.lease.lease.active) {
					endFormMarkGesture();
					formMarkRefusal = {
						entityId: current.entity.id,
						markId: current.markId,
						message: 'The content changed; start the mark gesture again.'
					};
					services.stage.notifySurfaceChange();
					return true;
				}
				if (intent.phase === 'cancel') {
					endFormMarkGesture();
					services.stage.notifySurfaceChange();
					return true;
				}
				if (intent.evaluationId !== current.evaluationId) {
					endFormMarkGesture();
					formMarkRefusal = {
						entityId: current.entity.id,
						markId: current.markId,
						message: 'The reading changed; start the mark gesture again.'
					};
					services.stage.notifySurfaceChange();
					return true;
				}
				const accepted = stageScene(adapterContext.snapshot).entities.find(
					(entry) => entry.id === current.entity.id
				);
				if (accepted === undefined || accepted.kind !== 'form') {
					endFormMarkGesture();
					formMarkRefusal = {
						entityId: current.entity.id,
						markId: current.markId,
						message: 'The entity no longer exists.'
					};
					services.stage.notifySurfaceChange();
					return true;
				}
				if (intent.phase === 'move') {
					if (current.bodyPress && !isStagePointerDrag(current.pressCss, intent.css)) {
						// Match object body handling: jitter and a drag returned to the
						// tolerance are clicks, so no stale candidate remains visible.
						current.candidate = null;
						current.refusal = null;
						current.scale = null;
						services.stage.notifySurfaceChange();
						return true;
					}
					const context = sizePlannerContext(adapterContext);
					if (current.markId === SCENE_FORM_MARK.move) {
						const support = pointerFloorSupport(adapterContext, intent.css, current.entity.id);
						if (support.kind !== 'floor') {
							current.candidate = null;
							const refusal = moveSupportRefusal(support);
							current.refusal =
								refusal.kind === 'refused'
									? refusal.message
									: 'The pointer position is not a committable floor support.';
						} else {
							const drafting = adapterContext.drafting();
							const grabOffset = current.moveGrabOffset ?? [0, 0];
							const step = draftingSnapIncrementMeters(drafting);
							const snapped = snapDraftingPlacement(
								[
									support.worldPoint[0] - grabOffset[0],
									support.worldPoint[2] - grabOffset[1]
								],
								step
							);
							applyFormMarkPlan(
								current,
								planSceneObjectMark({
									markId: SCENE_OBJECT_MARK.move,
									context,
									entityId: current.entity.id,
									contactMinY: current.contactMinY,
									worldXZ: [snapped.x, snapped.z]
								})
							);
						}
					} else if (current.markId === SCENE_FORM_MARK.turn) {
						const angle = turnAngleAt(adapterContext, current.entity.id, intent.css, current.ringY);
						if (angle === null) {
							current.candidate = null;
							current.refusal = 'The pointer ray is not on the turn plane.';
						} else {
							if (current.turnStartAngle === null) current.turnStartAngle = angle;
							let delta = angle - current.turnStartAngle;
							while (delta > Math.PI) delta -= Math.PI * 2;
							while (delta < -Math.PI) delta += Math.PI * 2;
							applyFormMarkPlan(
								current,
								planSceneObjectMark({
									markId: SCENE_OBJECT_MARK.turn,
									context,
									entityId: current.entity.id,
									yaw: quantizeMarkValue(current.startYaw + delta)
								})
							);
						}
					} else {
						const handle = formRayHandle(current.measurement, current.markId);
						if (handle === null) {
							current.candidate = null;
							current.refusal = 'The form no longer publishes this size ray.';
						} else {
							let travel: number | null;
							if (current.planHeightTravel !== null) {
								travel =
									handle.dimension / handle.factor +
									((current.planHeightTravel.startY - intent.css[1]) *
										current.planHeightTravel.metersPerCssPixel) /
										handle.factor;
							} else {
								const ray = adapterContext.ray([
									intent.css[0] + adapterContext.evaluation.rect.left,
									intent.css[1] + adapterContext.evaluation.rect.top
								]);
								const currentTravel =
									ray === null
										? null
										: axisTravelFromRay({
												origin: formWorldPoint(current.entity, [0, 0, 0]),
												direction: formWorldAxis(current.entity, handle.axis),
												rayOrigin: ray.origin,
												rayDirection: ray.direction
											});
								travel =
									current.sizeStartTravelMeters === null || currentTravel === null
										? null
										: handle.dimension / handle.factor + currentTravel - current.sizeStartTravelMeters;
							}
							const scale =
								travel === null
									? null
									: formSizeScaleFromTravel({
											entity: current.entity,
											handle,
											travelMeters: travel
										});
							if (scale === null) {
								current.scale = null;
								current.candidate = null;
								current.refusal = 'Move the handle to name a new size.';
							} else {
								const preview = previewFormSize({
									context,
									entityId: current.entity.id,
									scale
								});
								if ('candidate' in preview) {
									const next = preview.candidate.scene.entities.find(
										(entry) => entry.id === current.entity.id
									);
									current.scale = scale;
									current.candidate = next?.kind === 'form' ? next : null;
									current.refusal =
										current.candidate === null ? 'The form body could not be evaluated.' : null;
								} else {
									current.scale = null;
									current.candidate = null;
									current.refusal = preview.refusal;
								}
							}
						}
					}
					services.stage.notifySurfaceChange();
					return true;
				}

				// Release commits one captured candidate through the existing planner.
				const preview = current;
				endFormMarkGesture();
				if (preview.bodyPress && !isStagePointerDrag(preview.pressCss, intent.css)) {
					services.stage.notifySurfaceChange();
					return true;
				}
				if (preview.markId !== SCENE_FORM_MARK.move && preview.markId !== SCENE_FORM_MARK.turn) {
					if (preview.scale !== null && preview.candidate !== null) {
						void acceptFormCommand(
							services,
							services.stage.snapshot(),
							preview.entity.id,
							'set-form-size',
							{ entityId: preview.entity.id, scale: preview.scale }
						).then((outcome) => {
							formMarkRefusal =
								outcome.kind === 'refused'
									? { entityId: preview.entity.id, markId: preview.markId, message: outcome.message }
									: null;
							services.stage.notifySurfaceChange();
						});
					} else {
						formMarkRefusal = {
							entityId: preview.entity.id,
							markId: preview.markId,
							message: preview.refusal ?? 'That drag named no size.'
						};
					}
				} else if (preview.candidate !== null) {
					const snapshot = services.stage.snapshot();
					const intentCapture = {
						projectId: snapshot.acceptedRevision.projectId,
						revisionId: services.authoring.acceptedRevision().revisionId,
						sceneContentRevision: snapshot.domain.unitRevisions.scene,
						operationId: globalThis.crypto.randomUUID()
					};
					const acceptedIntent =
						preview.markId === SCENE_FORM_MARK.move
							? sceneObjectMarkIntent({
									markId: SCENE_OBJECT_MARK.move,
									entityId: preview.entity.id,
									contactMinY: preview.contactMinY,
									worldXZ: [preview.candidate.position[0], preview.candidate.position[2]],
									...intentCapture
								})
							: sceneObjectMarkIntent({
									markId: SCENE_OBJECT_MARK.turn,
									entityId: preview.entity.id,
									yaw: preview.candidate.rotation[1],
									...intentCapture
								});
					void services.authoring.accept(acceptedIntent).then(
						(outcome) => {
							if (outcome.kind === 'refused') {
								formMarkRefusal = {
									entityId: preview.entity.id,
									markId: preview.markId,
									message: outcome.message
								};
							}
							services.stage.notifySurfaceChange();
						},
						(error: unknown) => {
							formMarkRefusal = {
								entityId: preview.entity.id,
								markId: preview.markId,
								message: error instanceof Error ? error.message : 'The accepted install failed.'
							};
							services.stage.notifySurfaceChange();
						}
					);
				} else {
					formMarkRefusal = {
						entityId: preview.entity.id,
						markId: preview.markId,
						message: preview.refusal ?? 'That drag named no change.'
					};
				}
				services.stage.notifySurfaceChange();
				return true;
			}

			/** Escape during a live form mark gesture is the writer's cancel. */
			function formMarkKey(intent: StageKeyboardIntent): boolean {
				if (openTaskKind !== null || formMarkGesture === null) return false;
				if (intent.kind !== 'cancel') return false;
				endFormMarkGesture();
				services.stage.notifySurfaceChange();
				return true;
			}

			function formMarkGhost(): StageGhostMesh | null {
				const active = formMarkGesture;
				if (active?.candidate === null || active?.candidate === undefined) return null;
				return {
					id: 'scene-form-mark-preview',
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
							setObjectsPanelCompact(projectIdOf(), true);
							// A placed model or saved copy is used up: the panel's shape is armed
							// again, never a primitive the panel does not offer.
							if (armedTile(projectIdOf()) === null) armTile(projectIdOf(), 'box');
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
				// An install replaces the session; the Sphere tile stays what is armed.
				if (armedTile(projectIdOf()) === 'sphere') session.setPlacePrimitive('sphere');
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
						// A creation keeps the panel out of the way of what it just made.
						setObjectsPanelCompact(projectIdOf(), true);
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
				const outcome = await session.commitPlace();
				if (outcome.kind === 'refused') session.reportPointerOutcome(outcome);
				services.stage.notifySurfaceChange();
			}

			// The same projection Paper draws: the accepted runtime Scene the route hands
			// to the Canvas, not a second projection of the authored unit document.
	const runtimeScene = context.snapshot.domain.scene;
	const footprints = planSceneFootprintsFor(runtimeScene, runtimeScene.modelFootprints).footprints;

	/**
	 * The Height Sheet's found surfaces this domain owns: the tops of
	 * floor-standing entities. "Floor-standing" is measured, not authored: an
	 * entity whose evaluated bounds start within 5 cm of the datum is standing on
	 * it. Prefer the Scene pick source's evaluated bounds for every mounted entity.
	 * Analytic/evaluated fallbacks are used only where their local bounds remain
	 * valid in world space; tilted entities without drawn bounds have no tick.
	 */
	function heightTicksFor(adapterContext: StageAdapterContext): readonly StageHeightTick[] {
		const datum = adapterContext.snapshot.domain.datumMeters;
		const ticks: StageHeightTick[] = [];
		for (const entity of stageScene(adapterContext.snapshot).entities) {
			let bounds: { readonly min: Vec3; readonly max: Vec3 } | null = null;
			const drawnBounds = adapterContext.sceneBounds(entity.id);
			if (drawnBounds !== null) {
				bounds = drawnBounds;
			} else if (entity.kind === 'form' && isYawOnly(entity.rotation)) {
				const mesh = evaluateFormMesh(entity.form);
				if (mesh !== null) {
					bounds = {
						min: [
							entity.position[0] + mesh.bounds.min[0],
							entity.position[1] + mesh.bounds.min[1],
							entity.position[2] + mesh.bounds.min[2]
						] as Vec3,
						max: [
							entity.position[0] + mesh.bounds.max[0],
							entity.position[1] + mesh.bounds.max[1],
							entity.position[2] + mesh.bounds.max[2]
						] as Vec3
					};
				}
			} else if (entity.kind === 'primitive' && isYawOnly(entity.rotation)) {
				bounds = primitiveBounds(entity);
			}
			if (bounds === null) continue;
			if (Math.abs(bounds.min[1] - datum) > 0.05) continue;
			const heightMeters = bounds.max[1] - datum;
			if (!Number.isFinite(heightMeters) || heightMeters <= 0) continue;
			const name = 'name' in entity && typeof entity.name === 'string' ? entity.name : entity.id;
			ticks.push({ kind: 'found', heightMeters, label: name });
		}
		return ticks;
	}

	function isYawOnly(rotation: Vec3): boolean {
		return Math.abs(rotation[0]) < 1e-8 && Math.abs(rotation[2]) < 1e-8;
	}

	const binding: StageAdapterBinding = {
		/** Owner-declared found surfaces; the host merges and sorts them. */
		heightTicks(adapterContext: StageAdapterContext): readonly StageHeightTick[] {
			return heightTicksFor(adapterContext);
		},
		subjects: source.entities.map((entity) => ({
					id: `scene:entity:${entity.id}`,
					label: `${entity.name} · ${entity.kind} · ${entity.id}`,
					reference: sceneEntityReference(entity.id, context.snapshot.domain.unitRevisions.scene),
					worldPoint: entity.kind !== 'form' ? entity.position : formCenter(entity)
				})),
				hostTools: ['erase', 'measure'],
				/**
				 * The Eraser reuses the Card's own delete for a model, primitive or form:
				 * `delete-one`, one F4 entry, and Undo restores the same id. Lights are
				 * never picked, so they never reach here.
				 */
				eraseAction(hit) {
					if (hit.reference?.domain !== 'scene') return null;
					const action = binding.cardActions?.({ sourceId: hit.sourceId, sourceKind: hit.sourceKind, reference: hit.reference, ref: null })
						.find((candidate) => candidate.destructive === true);
					return action === undefined
						? { kind: 'refused', message: 'That object cannot be erased.' }
						: { kind: 'action', action, confirm: false };
				},
				pick(candidate, live) {
					if (!source.entities.some((entity) => entity.kind !== 'light')) return null;
					const css: [number, number] = [candidate.css[0] + live.evaluation.rect.left, candidate.css[1] + live.evaluation.rect.top];
					const ray = live.ray(css);
					if (ray === null) return null;
					const drawn = live.pickScene(ray);
					if (drawn?.kind === 'layout' || drawn?.kind === 'floor' && live.evaluation.renderedReading !== 'plan') return null;
					// Measure admits rendered bounds corners independently of a surface hit.
					// An AABB corner often lies outside a model's silhouette/declared Paper
					// footprint; requiring Select to hit first made real model bounds unreachable.
					if (candidate.purpose === 'tool' && candidate.tool?.kind === 'measure') {
						let nearest = 8;
						let cornerHit: StageDomainPick | null = null;
						for (const entity of source.entities) {
							if (entity.kind === 'light') continue;
							const bounds = live.sceneBounds(entity.id);
							if (bounds === null) continue;
							for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
								const corner: [number, number, number] = [x, y, z];
								const projected = live.project(corner);
								if (projected === null) continue;
								const depth = corner.reduce((sum, n, axis) => sum + (n - ray.origin[axis]!) * ray.direction[axis]!, 0);
								if (depth < 0 || drawn?.kind === 'entity' && drawn.entityId !== entity.id && drawn.distanceMeters < depth - 0.001) continue;
								const distanceCss = Math.hypot(projected[0] - css[0], projected[1] - css[1]);
								if (distanceCss > nearest) continue;
								nearest = distanceCss;
								cornerHit = {
									hit: { sourceId: entity.id, sourceKind: 'entity', reference: sceneEntityReference(entity.id, live.snapshot.domain.unitRevisions.scene), worldPoint: corner },
									refusal: null, depthMeters: depth, planLayer: PAPER_LAYER.sceneFootprint, cssDistance: distanceCss
								};
							}
						}
						if (cornerHit !== null) return cornerHit;
					}
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
					const worldPoint = ray.origin.map((value, axis) => value + ray.direction[axis]! * distance) as [number, number, number];
					return {
						hit: { sourceId: entityId, sourceKind: 'entity',
						reference: sceneEntityReference(entityId, live.snapshot.domain.unitRevisions.scene),
						worldPoint },
						refusal: null, depthMeters: drawn?.kind === 'entity' ? drawn.distanceMeters : null,
						planLayer: PAPER_LAYER.sceneFootprint, cssDistance
					};
				},
				tasks: [
					{
						id: SCENE_PLACE_TASK,
						taskKind: 'place-object',
						label: 'Objects',
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
						// R217.S17A: Objects is the one place to create and insert an object.
						label: 'Objects',
						railFamily: 'place',
						capability: 'scene',
						home: 'dock',
						slot: 'library',
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
					// Objects and Head Find both read these entries: Import is a
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
				 * Marks are direct manipulation of the current selection, not a task. The
				 * Scene binding joins Layout's handles in the host's no-task press offer; a
				 * selected body's press can claim Move, while unrelated geometry falls
				 * through to navigation.
				 */
				pressWhenNoTask: true,
				/**
				 * The one mark vocabulary: when no task is open, a selected object publishes
				 * Move, Turn and the Scale point, and the disclosed Size ray; a selected
				 * native form publishes Move, Turn, Scale and its three per-axis rays. The
				 * host admits, projects and hit-tests those descriptors; this binding only
				 * says which facts and planner each one names.
				 */
				handles(adapterContext: StageAdapterContext): readonly StageHandleDescriptor[] {
					// A selected native form publishes its own six descriptors; catalogue
					// objects keep the S08 set. Both are the one Stage vocabulary.
					return selectedFormEntity(adapterContext) === null
						? objectMarkDescriptors(adapterContext)
						: formMarkDescriptorsFor(adapterContext);
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
					// manipulation surface: an admitted object or form mark claims its own
					// drag.
					if (openTaskKind === null) {
						return objectMarkPointer(intent, adapterContext) || formMarkPointer(intent, adapterContext);
					}
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
					session.setSnapStep(openTaskKind === 'place-object' ? snapStep : null);
					if (intent.phase === 'cancel') {
						dragOrigin = null;
						gestureSurface = null;
						placementPointerRefusal = null;
						// An interruption is not Esc/Select: Place stays armed.
						session.abortGesture();
						return true;
					}
					if (intent.phase === 'down') {
						if (openTaskKind === 'place-object') {
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
					if (drawnTile() !== null && objectDraw.key(intent)) return true;
					return objectMarkKey(intent) || formMarkKey(intent);
				},
				hoverIntent(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {
					return drawnTile() !== null && objectDraw.hover(intent, adapterContext);
				},
				// Closing the task (Esc at the shell, replacement) uses the one cancel path.
				selectionChanged() {
					// A mark belongs to the subject it was drawn for; a new subject's
					// descriptors replace it, and a stale refusal would name the old one.
					if (formMarkGesture !== null) endFormMarkGesture();
					formMarkRefusal = null;
					if (objectMarkGesture !== null) endObjectMarkGesture();
					objectMarkRefusal = null;
					placementPointerRefusal = null;
				},
				taskClosed() {
					if (formMarkGesture !== null) {
						endFormMarkGesture();
						formMarkRefusal = null;
					}
					if (objectMarkGesture !== null) endObjectMarkGesture();
					objectMarkRefusal = null;
					placementPointerRefusal = null;
					dragOrigin = null;
					objectDraw.cancel();
					// A creation closes and reopens the task, in an order the host owns; only
					// a close nothing reopened brings the full panel back next time.
					{
						const projectId = projectIdOf();
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
				candidatePreview(adapterContext): readonly StageCandidatePreview[] {
					if (drawnTile() !== null) {
						const drawn = objectDraw.candidatePreview(adapterContext);
						if (drawn === null) return [];
						const footprint = drawn.entity === null
							? null
							: sceneCandidatePaperPreview(
								drawn.entity,
								adapterContext.snapshot.domain.datumMeters,
								undefined,
								'subject'
							);
						return [{
							id: 'scene-draw-footprint',
							role: drawn.refused ? 'refused' : 'subject',
							polygons: footprint?.polygons ?? [],
							segments: drawn.segments,
							labels: drawn.label === null ? [] : [drawn.label],
							...(drawn.snap === null ? {} : { snap: { world: drawn.snap, name: 'Grid' } })
						}];
					}
					if (
						adapterContext.evaluation.settledReading !== 'plan' ||
						adapterContext.evaluation.renderedReading !== 'plan'
					) return [];
					const runtimeScene = adapterContext.snapshot.domain.scene;
					let entity: SceneEntity | null = formMarkGesture?.candidate ?? null;
					let candidate: SceneCandidate | null = null;
					let role: StageCandidatePreview['role'] = 'subject';
					let label: { readonly world: Vec3; readonly text: string } | undefined;
					if (entity === null && objectMarkGesture !== null && objectMarkGesture.candidate !== null) {
						candidate = objectMarkGesture.candidate;
					}
					if (entity === null && candidate === null && placementPointerRefusal !== null) {
						candidate = placementPointerRefusal.candidate;
						role = 'refused';
						if (placementPointerRefusal.world !== null) {
							label = { world: placementPointerRefusal.world, text: placementPointerRefusal.message };
						}
					}
					if (entity === null && candidate === null) {
						const surface = sceneSurfaceFor(adapterContext.snapshot, adapterContext.evaluation);
						candidate = surface?.session.candidate() ?? null;
					}
					if (entity === null && candidate !== null) {
						entity = sceneEntityAtCandidate(candidate, runtimeScene.entities);
					}
					if (entity === null) return [];
					let modelFootprints = runtimeScene.modelFootprints;
					if (candidate?.modelAssetId !== undefined && candidate.footprint !== undefined) {
						const expanded = new Map(modelFootprints ?? []);
						expanded.set(candidate.modelAssetId, candidate.footprint);
						modelFootprints = expanded;
					}
					const preview = sceneCandidatePaperPreview(
						entity,
						adapterContext.snapshot.domain.datumMeters,
						modelFootprints,
						role,
						label
					);
					return preview === null ? [] : [preview];
				},
				// The captured candidate is shown through the existing overlay surface,
				// so Plan and 3D present the same pose the planner would commit.
				overlay(adapterContext) {
					if (drawnTile() !== null) return objectDraw.overlay(adapterContext);
					const surface = sceneSurfaceFor(adapterContext.snapshot, adapterContext.evaluation);
					const candidate = surface?.session.candidate() ?? null;
					if (candidate === null) {
						return placementPointerRefusal === null
							? []
							: [{
									id: 'scene-candidate-refusal',
									// StageFacade applies the viewport-to-surface translation to all
									// adapter overlays. This refusal is captured in surface CSS by the
									// pointer path, so restore viewport CSS before returning it.
									css: [
										placementPointerRefusal.css[0] + adapterContext.evaluation.rect.left,
										placementPointerRefusal.css[1] + adapterContext.evaluation.rect.top
									],
									label: placementPointerRefusal.message
								}];
					}
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
					const form = formMarkGhost();
					const object = objectMarkGhost(adapterContext);
					const marks: StageGhostMesh[] = [];
					if (drawnTile() !== null) marks.push(...objectDraw.ghosts());
					if (form !== null) marks.push(form);
					if (object !== null) marks.push(object);
					const surface = sceneSurfaceFor(adapterContext.snapshot, adapterContext.evaluation);
					const candidate: SceneCandidate | null = surface?.session.candidate() ?? null;
					const refused = candidate === null ? placementPointerRefusal?.candidate ?? null : null;
					const shown = candidate ?? refused;
					if (shown === null) return marks;
					const entity =
						shown.entityId === null
							? null
							: adapterContext.snapshot.domain.scene.entities.find((entry) => entry.id === shown.entityId) ??
								null;
					const ghost = candidateGhost(entity, shown, {
						modelFootprint:
							entity?.kind === 'model'
								? adapterContext.snapshot.domain.scene.modelFootprints?.get(entity.assetId) ??
								  admittedModelFootprint(adapterContext.snapshot, entity.assetId)
								: null,
						modelContactMinY:
							shown.modelContactMinY ?? (entity?.kind === 'model' ? objectContact(entity) : null),
						treatment: refused === null ? 'subject' : 'refused'
					});
					return ghost === null ? marks : [...marks, ghost];
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
								? 'Objects'
								: task.kind === SCENE_COMPOSE_TASK
									? 'Compose'
									: 'Import model',
						view: { component: SceneTransformInstrument, services }
					};
				},
				dispose() {
					if (formMarkGesture !== null) endFormMarkGesture();
					formMarkRefusal = null;
					if (objectMarkGesture !== null) endObjectMarkGesture();
					objectMarkRefusal = null;
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
	return binding;
		}
	};
	return adapter;
};
