/**
 * X7 — the Scene adapter's read-only contribution projections.
 *
 * Everything the Scene adapter tells the host without owning a gesture: the
 * subjects it can select, the found surfaces the Height Sheet reads, the Scene
 * pick, the contributed tasks and Find entries, the object-mark descriptors for
 * the selected object, and the Card's facts, name writer, field writer and
 * actions. Each is a projection of the accepted snapshot, the live adapter
 * context and (for marks) the mark session's *reading*; none holds a lifetime,
 * opens a lease, arms Place or touches a session. Card writes go through the
 * same shared command path the Card itself uses (`object-card`,
 * `form-card-command`).
 *
 * Marks are direct manipulation of the current selection, not a task: this
 * module says which facts and planner each descriptor names, and the host
 * admits, projects and hit-tests them.
 */

import { Euler, Vector3 } from 'three';
import type {
	StageAdapterBinding,
	StageAdapterContext,
	StageAdapterServices,
	StageCardFact,
	StageDomainPick,
	StageHandleDescriptor,
	StageHeightTick
} from '$lib/authoring/stage/stage-adapter-host';
import {
	PAPER_LAYER,
	datumWorkingPlane,
	stageEnvelope,
	stageScene
} from '$lib/authoring/stage/stage-adapter-host';
import type { SceneEntity, Vec3 } from '@portfolio/project-model';
import { sceneEntityLift } from '@portfolio/project-model/scene-planning';
import type { SceneFormEntity } from '$lib/content/scene';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import { planSceneFootprintsFor } from '$lib/authoring/scene/plan-scene-footprint';
import { pickPlanSceneSubject } from '$lib/authoring/scene/plan-scene-hit';
import SceneObjectCardFields from './SceneObjectCardFields.svelte';
import { requestObjectsPrecision } from './shape/armed-tile';
import { acceptFormCommand } from './form-card-command';
import { deleteSceneObject, duplicateSceneObject } from './object-card';
import {
	isSceneObjectEntity,
	primitiveBounds,
	sceneObjectCardFieldFacts,
	sceneObjectMarkDescriptors,
	sceneObjectScale,
	type SceneObjectMarkLive
} from './object-marks';
import {
	liveProjectId,
	objectBounds,
	objectContact,
	objectFootprint,
	selectedObjectEntity,
	sizePlannerContext,
	type ObjectMarkGestureReading,
	type ObjectMarkRefusalReading
} from './object-readings';
import { sceneComposeSupport, sceneEntityReference, sceneModelContactMinY } from './placement';
import {
	formSizeMeasurement,
	type FormMarkScreenHeight,
	type FormSizeMeasurement
} from './shape/form-size';
import {
	SCENE_COMPOSE_TASK,
	SCENE_IMPORT_KIND,
	SCENE_IMPORT_TASK,
	SCENE_PLACE_KIND,
	SCENE_PLACE_TASK
} from './scene-task-ids';

const FORM_PLAN_HEIGHT_MARKER_GAP_CSS_PX = 24;

/** What the mark descriptors read of the live mark session; never a handle on its state. */
export type ObjectMarkReading = {
	/** Drop a gesture whose lease ended under it, before it is read. */
	prune(): void;
	gesture(): ObjectMarkGestureReading | null;
	refusal(): ObjectMarkRefusalReading | null;
};

export type SceneContributions = Required<
	Pick<
		StageAdapterBinding,
		| 'heightTicks'
		| 'subjects'
		| 'hostTools'
		| 'eraseAction'
		| 'pick'
		| 'tasks'
		| 'findEntries'
		| 'pressWhenNoTask'
		| 'handles'
		| 'cardWriter'
		| 'cardName'
		| 'cardActions'
		| 'cardFacts'
	>
>;

function entityFacts(
	services: StageAdapterServices,
	source: ReturnType<typeof stageScene>,
	entityId: string
): readonly StageCardFact[] {
	const entity = source.entities.find((candidate) => candidate.id === entityId);
	if (entity === undefined || entity.kind === 'light') return [];
	const contact =
		entity.kind === 'model'
			? sceneModelContactMinY(stageEnvelope(services.stage.snapshot()), entity)
			: null;
	return [
		{ label: 'Kind', value: entity.kind, fieldId: 'kind' },
		{ label: 'Name', value: entity.name, fieldId: 'name' },
		// The plan position is X and Z. A writer that edits them (the object and form
		// writers) shows them in its fields, so this row is dropped there; Y is not
		// written by any writer, so Elevation below always states it.
		{
			label: 'Position (X · Z)',
			value: `${entity.position[0]} m · ${entity.position[2]} m`,
			fieldId: 'position'
		},
		{
			label: 'Elevation',
			...(entity.kind === 'artwork' ? { fieldId: 'elevation' } : {}),
			value: `${entity.position[1]} m`
		},
		{
			label: 'Yaw',
			value: `${entity.rotation[1]} rad`,
			fieldId: 'yaw'
		},
		// Only a subject Compose can actually resize advertises a Scale fact: a light
		// or an unapproved catalogue model has no verified contact, so a Scale row
		// would name a writer that never exists.
		...(sceneComposeSupport(entity, contact).resize
			? [
					{
						label: 'Scale',
						value: `${typeof entity.scale === 'number' ? entity.scale : 1} (uniform)`,
						fieldId: 'scale'
					}
				]
			: []),
		// Dimensions are exposed by the lazy Card's per-axis Size fields.
		...(entity.kind === 'form' ? [{ label: 'Material', value: entity.materialId, fieldId: 'material' }] : [])
	];
}

/** Canonical body centre for the shared selection echo and Bring into view. */
function formCenter(entity: SceneFormEntity): [number, number, number] {
	const mesh = evaluateFormMesh(entity.form);
	if (mesh === null) return entity.position;
	const center = mesh.bounds.min.map((value, axis) => (value + mesh.bounds.max[axis]!) / 2);
	return new Vector3(center[0], center[1], center[2]).applyEuler(new Euler(...entity.rotation)).add(new Vector3(...entity.position)).toArray();
}

function isYawOnly(rotation: Vec3): boolean {
	return Math.abs(rotation[0]) < 1e-8 && Math.abs(rotation[2]) < 1e-8;
}

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

/* --- Per-axis size rays on a selected form -------------------------- */

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


export function createSceneContributions(
	services: StageAdapterServices,
	context: StageAdapterContext,
	marks: ObjectMarkReading
): SceneContributions {
	const source = stageScene(context.snapshot);
	// The same projection Paper draws: the accepted runtime Scene the route hands
	// to the Canvas, not a second projection of the authored unit document.
	const runtimeScene = context.snapshot.domain.scene;
	const footprints = planSceneFootprintsFor(runtimeScene, runtimeScene.modelFootprints).footprints;

	function objectMarkLive(entity: SceneEntity): SceneObjectMarkLive | null {
		const current = marks.gesture();
		if (current !== null && current.entityId === entity.id) {
			return {
				markId: current.markId,
				position: current.candidate?.position ?? entity.position,
				yaw: current.candidate?.yaw ?? entity.rotation[1],
				scale: current.candidate?.scale ?? sceneObjectScale(entity),
				refusal: current.refusal
			};
		}
		const refusal = marks.refusal();
		if (refusal !== null && refusal.entityId === entity.id) {
			return {
				markId: refusal.markId,
				position: entity.position,
				yaw: entity.rotation[1],
				scale: sceneObjectScale(entity),
				refusal: refusal.message
			};
		}
		return null;
	}

	function objectMarkDescriptors(
		adapterContext: StageAdapterContext
	): ReturnType<typeof sceneObjectMarkDescriptors> {
		marks.prune();
		const entity = selectedObjectEntity(adapterContext);
		if (entity === null) return [];
		const contactMinY = objectContact(services, entity);
		if (contactMinY === null) return [];
		// The planners' own gate: a light, a vertical plane, a tilted entity or a
		// model without verified contact publishes no mark that would refuse. A
		// form refuses only uniform Resize; it sizes per axis instead.
		const support = sceneComposeSupport(entity, contactMinY);
		if (!support.resize && !(entity.kind === 'form' && support.duplicate)) return [];
		const lift = sceneEntityLift(sizePlannerContext(adapterContext), entity, contactMinY);
		const live = objectMarkLive(entity);
		if (entity.kind === 'form') {
			const gesture = marks.gesture();
			const current = gesture?.entityId === entity.id ? gesture : null;
			const form = current?.candidate?.form ?? entity.form;
			const sized: SceneFormEntity = { ...entity, form };
			const measurement = formSizeMeasurement(sized);
			if (measurement.handles.length !== 3) return [];
			return sceneObjectMarkDescriptors({
				reading: adapterContext.evaluation.settledReading,
				entity,
				contactMinY: measurement.contactMinY,
				bounds: null,
				footprint: measurement.footprint,
				lift,
				live,
				form: {
					measurement,
					baseline: formSizeMeasurement(entity),
					form,
					screenHeight: formScreenHeight(adapterContext, measurement)
				}
			});
		}
		const bounds = objectBounds(adapterContext, entity);
		return sceneObjectMarkDescriptors({
			reading: adapterContext.evaluation.settledReading,
			entity,
			contactMinY,
			bounds,
			footprint: objectFootprint(services, entity, bounds),
			lift,
			live
		});
	}

	function cardActions(subject: Parameters<NonNullable<StageAdapterBinding['cardActions']>>[0]) {
		if (subject.reference?.domain !== 'scene') return [];
		// Read the live accepted source: an immediate command can install a
		// copy whose action row is requested before the next binding rebuild.
		const snapshot = services.stage.snapshot();
		const entity = stageScene(snapshot).entities.find((entity) => entity.id === subject.sourceId);
		if (entity === undefined) return [];
		if (!isSceneObjectEntity(entity)) return [];
		// S08 moves the object's exact fields to the Card; the existing
		// immediate commands stay beside them, so the creator does not have to
		// open Compose to duplicate or delete the selected object.
		return [
			{
				id: 'scene-object-duplicate',
				label: 'Duplicate',
				// Not destructive: a copy is added and Undo removes it. It sits in the
				// Card's More disclosure, so Delete is the one destructive control.
				group: 'secondary' as const,
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
	}

	return {
		/** Owner-declared found surfaces; the host merges and sorts them. */
		heightTicks(adapterContext: StageAdapterContext): readonly StageHeightTick[] {
			return heightTicksFor(adapterContext);
		},
		subjects: source.entities
			.filter((entity) => entity.kind !== 'light')
			.map((entity) => ({
				id: `scene:entity:${entity.id}`,
				label: entity.name,
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
			const action = cardActions({
				sourceId: hit.sourceId,
				sourceKind: hit.sourceKind,
				reference: hit.reference,
				ref: null
			}).find((candidate) => candidate.destructive === true);
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
				const hit = live.intersect(ray, datumWorkingPlane(live.snapshot.domain.datumMeters));
				if (hit.kind !== 'intersected' || !Number.isFinite(hit.distanceMeters)) return null;
				const point: [number, number] = [hit.worldPoint[0], hit.worldPoint[2]];
				const planHit = pickPlanSceneSubject({
					footprints,
					point,
					edgeHaloMeters: 6 * live.evaluation.targetPlaneMetersPerCssPixel,
					datumMeters: live.snapshot.domain.datumMeters,
					datumDistanceMeters: hit.distanceMeters,
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
				taskKind: SCENE_PLACE_KIND,
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
				taskKind: SCENE_PLACE_KIND,
				// R217.S17A: Objects is the one place to create and insert an object.
				label: 'Objects',
				railFamily: 'place',
				capability: 'scene',
				home: 'dock',
				slot: 'library',
				order: 20
			},
			{
				id: 'scene-exact-placement',
				taskKind: SCENE_PLACE_KIND,
				label: 'Objects · exact initial position',
				railFamily: 'place',
				capability: 'scene',
				order: 21,
				onInvoke: () => requestObjectsPrecision(liveProjectId(services))
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
		 * host admits, projects and hit-tests those descriptors; this module only
		 * says which facts and planner each one names.
		 */
		handles(adapterContext: StageAdapterContext): readonly StageHandleDescriptor[] {
			// One mark set for every Scene object; a form adds its per-axis rays.
			return objectMarkDescriptors(adapterContext);
		},
		cardWriter(subject) {
			if (subject.reference?.domain !== 'scene') return null;
			const entity = source.entities.find((entry) => entry.id === subject.sourceId);
			// Every Scene object — model, primitive or drawn form — gets the one
			// writer; only its size row differs by kind.
			if (!isSceneObjectEntity(entity)) return null;
			return {
				summary: 'Object fields',
				fieldIds: sceneObjectCardFieldFacts(entity),
				view: { component: SceneObjectCardFields, services }
			};
		},
		/**
		 * Review pass 2 §5: every Scene entity renames through `set-name`, one
		 * history entry, refused blank with the prior name kept.
		 */
		cardName(subject) {
			if (subject.reference?.domain !== 'scene') return null;
			const entity = stageScene(services.stage.snapshot()).entities.find(
				(entry) => entry.id === subject.sourceId
			);
			if (entity === undefined || entity.kind === 'light') return null;
			return {
				value: entity.name,
				async commit(name: string) {
					const outcome = await acceptFormCommand(
						services,
						services.stage.snapshot(),
						entity.id,
						'set-name',
						{ entityId: entity.id, name }
					);
					return outcome.kind === 'refused'
						? ({ kind: 'refused', code: 'refused', message: outcome.message } as const)
						: ({ kind: 'accepted' } as const);
				}
			};
		},
		cardActions,
		cardFacts(cardSubject) {
			// Only a Scene entity subject claims Scene facts; a Layout subject keeps
			// the Layout adapter's facts.
			if (cardSubject.sourceKind !== 'entity') return [];
			return entityFacts(services, source, cardSubject.sourceId);
		}
	};
}
