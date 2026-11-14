/**
 * X7 — the object-mark session: Move, Turn, Size, Lift and Form-ray gestures.
 *
 * One no-task mark gesture at a time. The press captures the accepted baseline
 * and the exact world reading its mark drives; every move previews through the
 * same planner the release submits; the one release is one captured candidate,
 * one F4 intent and one history entry. The lease is the S03 one, owned here for
 * exactly the gesture's life: it is released on release, pointer cancel, Escape,
 * a selection change, a task opening, a lease the host ended (reading change,
 * source replacement) and disposal, and never left held on any of them.
 *
 * This module owns the gesture and its refusal. It does not decide which marks
 * exist (`scene-contributions`), what the candidate looks like
 * (`candidate-presenter`) or how Place arms (`placement-binding`); it reads the
 * selected object through `object-readings` and the pointer through
 * `pointer-support`, and accepts only through `services.authoring.accept` and the
 * shared Form command writer. No transform math lives here beyond the pointer
 * travel readings; planning stays in `object-marks` and the Scene planners.
 */

import type { StageAdapterContext, StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import type {
	GestureAcquisition,
	StageGhostMesh,
	StageKeyboardIntent,
	StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';
import {
	datumWorkingPlane,
	draftingSnapIncrementMeters,
	snapDraftingPlacement,
	stageScene
} from '$lib/authoring/stage/stage-adapter-host';
import type { SceneFormEntity } from '$lib/content/scene';
import type { Vec3 } from '@portfolio/project-model';
import { sceneEntityLift } from '@portfolio/project-model/scene-planning';
import { perfMark } from '$lib/platform/perf-marks';
import { candidateGhost } from './candidate-ghost';
import { acceptFormCommand } from './form-card-command';
import {
	SCENE_OBJECT_MARK,
	isSceneObjectEditMarkId,
	markCandidate,
	planSceneObjectMark,
	sceneObjectMarkIntent,
	sceneObjectScale,
	type SceneObjectBounds,
	type SceneObjectEditMarkId
} from './object-marks';
import {
	type ObjectMarkGestureReading,
	type ObjectMarkRefusalReading,
	admittedModelFootprint,
	objectBounds,
	objectContact,
	selectedObjectEntity,
	sizePlannerContext
} from './object-readings';
import type { SceneCandidate } from './placement';
import { isStagePointerDrag, moveSupportRefusal, pointerDatumPoint, pointerFloorSupport } from './pointer-support';
import {
	SCENE_FORM_MARK,
	axisTravelFromRay,
	formSizeMeasurement,
	formSizeScaleFromTravel,
	formWorldAxis,
	formWorldPoint,
	isSceneFormRayMarkId,
	previewFormSize,
	type FormSizeHandle,
	type FormSizeMeasurement
} from './shape/form-size';

export type ObjectMarkSession = {
	/** The no-task press path for every Scene object mark, forms included. */
	pointer(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	/** Escape during a live mark gesture is the writer's cancel, not a task's. */
	key(intent: StageKeyboardIntent): boolean;
	/** A lease ended under a proposal is the proposal's end too. */
	prune(): void;
	/** Selection change, task close and disposal: end the gesture and forget its refusal. */
	reset(): void;
	gesture(): ObjectMarkGestureReading | null;
	refusal(): ObjectMarkRefusalReading | null;
	/** The candidate's own body at the captured pose, or `null`. */
	ghost(adapterContext: StageAdapterContext): StageGhostMesh | null;
	/** The live proposal, for Plan's dashed outline. */
	candidate(): SceneCandidate | null;
};

export function createObjectMarkSession(services: StageAdapterServices): ObjectMarkSession {
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
		/** A press on the W·D·H chip: a click toggles the grips, a drag scales. */
		readonly chipPress: boolean;
		readonly markId: SceneObjectEditMarkId;
		readonly lease: GestureAcquisition;
		readonly entityId: string;
		readonly contactMinY: number;
		readonly bounds: SceneObjectBounds | null;
		readonly startYaw: number;
		readonly startScale: number;
		/** World-space pointer-to-origin offset captured on the Move press. */
		readonly moveGrabOffset: readonly [number, number] | null;
		/** The ring's floor-plane elevation, shared by press and every move. */
		readonly ringY: number;
		turnStartAngle: number | null;
		sizeStartTravel: number | null;
		/** The accepted lift and its support, captured on a lift press. */
		readonly liftStart: { readonly lift: number; readonly supportY: number } | null;
		/** The stem foot the lift travels from: the knob's own vertical axis. */
		readonly liftOrigin: Vec3 | null;
		liftStartTravel: number | null;
		/** A form's per-axis size ray press; `null` for every other mark. */
		readonly formSize: {
			readonly entity: SceneFormEntity;
			readonly measurement: FormSizeMeasurement;
			readonly handle: FormSizeHandle;
			/** Plan hides world Y, so Height uses pointer travel in the same CSS axis as its mark. */
			readonly planHeightTravel: { readonly startY: number; readonly metersPerCssPixel: number } | null;
			/** World-axis cursor coordinate at pointerdown; size rays start at a fixed screen glyph. */
			readonly startTravelMeters: number | null;
			scale: readonly [number, number, number] | null;
		} | null;
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

	function ghost(
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
			const hit = adapterContext.intersect(ray, datumWorkingPlane(planeY));
			if (hit.kind !== 'intersected' || !Number.isFinite(hit.distanceMeters) || hit.distanceMeters <= 0) return null;
			const [x, , z] = hit.worldPoint;
			const angle = Math.atan2(-(z - entity.position[2]), x - entity.position[0]);
			return Number.isFinite(angle) ? angle : null;
		}

		/**
	 * The pointer's travel outward from the bounds centre through the chip
	 * corner. Scale is the ratio of this travel to the press's, so the corner
	 * stays under the pointer whichever way the object faces.
	 */
	function sizeTravelAt(
		adapterContext: StageAdapterContext,
		bounds: SceneObjectBounds,
		css: readonly [number, number]
	): number | null {
		const ray = adapterContext.ray([
			css[0] + adapterContext.evaluation.rect.left,
			css[1] + adapterContext.evaluation.rect.top
		]);
		if (ray === null) return null;
		const centre: [number, number, number] = [
			(bounds.min[0] + bounds.max[0]) / 2,
			(bounds.min[1] + bounds.max[1]) / 2,
			(bounds.min[2] + bounds.max[2]) / 2
		];
		const out = [bounds.max[0] - centre[0], bounds.max[1] - centre[1], bounds.max[2] - centre[2]];
		const length = Math.hypot(out[0], out[1], out[2]);
		if (!Number.isFinite(length) || length === 0) return null;
		return axisTravelFromRay({
			origin: centre,
			direction: [out[0] / length, out[1] / length, out[2] / length],
			rayOrigin: ray.origin,
			rayDirection: ray.direction
		});
	}

	/** The pointer's vertical travel on the lift knob's stem. */
	function liftTravelAt(
		adapterContext: StageAdapterContext,
		origin: Vec3,
		css: readonly [number, number]
	): number | null {
		const ray = adapterContext.ray([
			css[0] + adapterContext.evaluation.rect.left,
			css[1] + adapterContext.evaluation.rect.top
		]);
		if (ray === null) return null;
		return axisTravelFromRay({
			origin,
			direction: [0, 1, 0],
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
	 * The no-task press path for every Scene object mark, forms included.
	 *
	 * A press that did not start on an admitted editing mark is refused, so the
	 * host's navigation gesture keeps the pointer. Move, Turn and Lift are one
	 * path for every kind; sizing is the one branch that differs — the chip's
	 * uniform scale for a model or primitive, the per-axis rays for a form.
	 */
	function pointer(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext
	): boolean {
		if (services.stage.session.task() !== null) return false;
		pruneObjectMarkGesture();
		if (intent.phase === 'down') {
			let markId = intent.handleId;
			let bodyPress = false;
			const chipPress = markId === SCENE_OBJECT_MARK.scalePoint;
			if (chipPress) markId = SCENE_OBJECT_MARK.size;
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
			const form = entity.kind === 'form' ? entity : null;
			// A form refuses a uniform scale: its chip only discloses.
			if (form !== null && markId === SCENE_OBJECT_MARK.size) return false;
			if (form === null && isSceneFormRayMarkId(markId)) return false;
			const contactMinY = objectContact(services, entity);
			if (contactMinY === null) return false;
			const measurement = form === null ? null : formSizeMeasurement(form);
			if (measurement !== null && measurement.handles.length !== 3) return false;
			const bounds = form === null ? objectBounds(adapterContext, entity) : null;
			if (markId === SCENE_OBJECT_MARK.size && bounds === null) return false;
			const liftOrigin: Vec3 | null =
				markId !== SCENE_OBJECT_MARK.lift
					? null
					: form !== null && measurement?.bounds != null
						? formWorldPoint(form, [measurement.bounds.max[0], measurement.bounds.min[1], measurement.bounds.max[2]])
						: bounds !== null
							? [bounds.max[0], bounds.min[1], bounds.max[2]]
							: null;
			if (markId === SCENE_OBJECT_MARK.lift && liftOrigin === null) return false;
			const liftStart =
				markId === SCENE_OBJECT_MARK.lift
					? sceneEntityLift(sizePlannerContext(adapterContext), entity, contactMinY)
					: null;
			if (markId === SCENE_OBJECT_MARK.lift && liftStart === null) return false;
			const handle = form !== null && measurement !== null ? formRayHandle(measurement, markId) : null;
			if (isSceneFormRayMarkId(markId) && handle === null) return false;
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
			// A body press keeps the pointer's offset on the datum; a Move grip
			// press (drawn off the origin for a form) keeps it on the floor.
			const movePressSupport =
				markId === SCENE_OBJECT_MARK.move && !bodyPress
					? pointerFloorSupport(adapterContext, intent.css, entity.id)
					: null;
			const pressPoint =
				markId !== SCENE_OBJECT_MARK.move
					? null
					: bodyPress
						? pointerDatumPoint(adapterContext, intent.css)
						: movePressSupport?.kind === 'floor'
							? movePressSupport.worldPoint
							: null;
			let formSize: ObjectMarkGesture['formSize'] = null;
			if (form !== null && measurement !== null && handle !== null) {
				const planHeightTravel =
					handle.axis === 1 &&
					adapterContext.evaluation.settledReading === 'plan' &&
					adapterContext.evaluation.targetPlaneMetersPerCssPixel > 0
						? {
								startY: intent.css[1],
								metersPerCssPixel: adapterContext.evaluation.targetPlaneMetersPerCssPixel
							}
						: null;
				let startTravelMeters: number | null = null;
				if (planHeightTravel === null) {
					const startRay = adapterContext.ray([
						intent.css[0] + adapterContext.evaluation.rect.left,
						intent.css[1] + adapterContext.evaluation.rect.top
					]);
					if (startRay !== null) {
						startTravelMeters = axisTravelFromRay({
							origin: formTravelOrigin(form, measurement, handle.axis),
							direction: formWorldAxis(form, handle.axis),
							rayOrigin: startRay.origin,
							rayDirection: startRay.direction
						});
					}
				}
				formSize = { entity: form, measurement, handle, planHeightTravel, startTravelMeters, scale: null };
			}
			objectMarkGesture = {
				evaluationId: intent.evaluationId,
				pressCss: [intent.css[0], intent.css[1]],
				bodyPress,
				chipPress,
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
				liftStart,
				liftOrigin,
				liftStartTravel:
					liftOrigin !== null ? liftTravelAt(adapterContext, liftOrigin, intent.css) : null,
				formSize,
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
			if (
				(gesture.bodyPress || gesture.chipPress) &&
				!isStagePointerDrag(gesture.pressCss, intent.css)
			) {
				// A body or chip press is still a click until the shared 4 CSS px boundary is
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
			} else if (gesture.markId === SCENE_OBJECT_MARK.lift && gesture.liftOrigin !== null) {
				const travel = liftTravelAt(adapterContext, gesture.liftOrigin, intent.css);
				if (travel === null || gesture.liftStart === null) {
					gesture.candidate = null;
					gesture.refusal = 'Move up or down to name a lift.';
				} else {
					if (gesture.liftStartTravel === null) gesture.liftStartTravel = travel;
					const snap = draftingSnapIncrementMeters(adapterContext.drafting());
					const raw = Math.max(0, gesture.liftStart.lift + travel - gesture.liftStartTravel);
					const lift = snap !== null && snap > 0 ? Math.round(raw / snap) * snap : raw;
					applyObjectMarkPlan(
						gesture,
						planSceneObjectMark({
							markId: SCENE_OBJECT_MARK.lift,
							context: sizePlannerContext(adapterContext),
							entityId: gesture.entityId,
							contactMinY: gesture.contactMinY,
							lift: quantizeMarkValue(lift)
						})
					);
				}
			} else if (gesture.formSize !== null) {
				previewFormRay(adapterContext, gesture, gesture.formSize, intent.css);
			} else if (gesture.bounds !== null) {
				const travel = sizeTravelAt(adapterContext, gesture.bounds, intent.css);
				if (travel === null) {
					gesture.candidate = null;
					gesture.refusal = 'Drag outward or inward to name a size.';
				} else {
					if (gesture.sizeStartTravel === null) gesture.sizeStartTravel = travel;
					const start = gesture.sizeStartTravel;
					if (Math.abs(start) < 1e-6) {
						gesture.candidate = null;
						gesture.refusal = 'Start the drag farther from the centre.';
					} else {
						applyObjectMarkPlan(
							gesture,
							planSceneObjectMark({
								markId: SCENE_OBJECT_MARK.size,
								context: sizePlannerContext(adapterContext),
								entityId: gesture.entityId,
								contactMinY: gesture.contactMinY,
								scale: quantizeMarkValue(gesture.startScale * (travel / start))
							})
						);
					}
				}
			}
			services.stage.notifySurfaceChange();
			return true;
		}

		// Release: one captured candidate, one F4 intent, one history entry.
		const preview = gesture;
		endObjectMarkGesture();
		if (
			(preview.bodyPress || preview.chipPress) &&
			!isStagePointerDrag(preview.pressCss, intent.css)
		) {
			services.stage.notifySurfaceChange();
			return true;
		}
		const settle = (outcome: Promise<{ readonly kind: string; readonly message?: string }>): void => {
			void outcome.then(
				(result) => {
					if (result.kind === 'refused') {
						objectMarkRefusal = {
							entityId: preview.entityId,
							markId: preview.markId,
							message: result.message ?? 'The edit was refused.'
						};
					}
					services.stage.notifySurfaceChange();
				},
				(error: unknown) => {
					objectMarkRefusal = {
						entityId: preview.entityId,
						markId: preview.markId,
						message: error instanceof Error ? error.message : 'The accepted install failed.'
					};
					services.stage.notifySurfaceChange();
				}
			);
		};
		if (preview.formSize !== null) {
			// A form's per-axis size commits through the Card's own planner.
			if (preview.formSize.scale !== null && preview.candidate !== null) {
				settle(
					acceptFormCommand(services, services.stage.snapshot(), preview.entityId, 'set-form-size', {
						entityId: preview.entityId,
						scale: preview.formSize.scale
					})
				);
			} else {
				objectMarkRefusal = {
					entityId: preview.entityId,
					markId: preview.markId,
					message: preview.refusal ?? 'That drag named no size.'
				};
			}
		} else if (preview.candidate !== null) {
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
							: preview.markId === SCENE_OBJECT_MARK.lift && preview.liftStart !== null
								? {
										markId: SCENE_OBJECT_MARK.lift,
										entityId: preview.entityId,
										contactMinY: preview.contactMinY,
										lift: quantizeMarkValue(
											Math.max(
												0,
												preview.candidate.position[1] +
													preview.startScale * preview.contactMinY -
													preview.liftStart.supportY
											)
										)
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
				settle(services.authoring.accept(intentToAccept));
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

	/** One move of a form's per-axis size ray, previewed through `set-form-size`. */
	function previewFormRay(
		adapterContext: StageAdapterContext,
		gesture: ObjectMarkGesture,
		formSize: NonNullable<ObjectMarkGesture['formSize']>,
		css: readonly [number, number]
	): void {
		const { entity, measurement, handle } = formSize;
		let travel: number | null;
		if (formSize.planHeightTravel !== null) {
			travel =
				handle.dimension / handle.factor +
				((formSize.planHeightTravel.startY - css[1]) * formSize.planHeightTravel.metersPerCssPixel) /
					handle.factor;
		} else {
			const ray = adapterContext.ray([
				css[0] + adapterContext.evaluation.rect.left,
				css[1] + adapterContext.evaluation.rect.top
			]);
			const currentTravel =
				ray === null
					? null
					: axisTravelFromRay({
							origin: formTravelOrigin(entity, measurement, handle.axis),
							direction: formWorldAxis(entity, handle.axis),
							rayOrigin: ray.origin,
							rayDirection: ray.direction
						});
			travel =
				formSize.startTravelMeters === null || currentTravel === null
					? null
					: handle.dimension / handle.factor + currentTravel - formSize.startTravelMeters;
		}
		const scale =
			travel === null ? null : formSizeScaleFromTravel({ entity, handle, travelMeters: travel });
		if (scale === null) {
			formSize.scale = null;
			gesture.candidate = null;
			gesture.refusal = 'Move the handle to name a new size.';
			return;
		}
		const preview = previewFormSize({
			context: sizePlannerContext(adapterContext),
			entityId: entity.id,
			scale
		});
		if ('candidate' in preview) {
			formSize.scale = scale;
			gesture.candidate = markCandidate(preview.candidate);
			gesture.refusal = gesture.candidate === null ? 'The form body could not be evaluated.' : null;
		} else {
			formSize.scale = null;
			gesture.candidate = null;
			gesture.refusal = preview.refusal;
		}
	}

	function formRayHandle(
		measurement: FormSizeMeasurement,
		markId: string
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
	/**
	 * Where a size drag measures its travel. Height is the top knob at the
	 * chip's corner, so its vertical axis runs through that corner; Width and
	 * Depth stay on the form's own centre axes.
	 */
	function formTravelOrigin(
		entity: SceneFormEntity,
		measurement: FormSizeMeasurement,
		axis: number
	): [number, number, number] {
		return axis === 1 && measurement.bounds !== null
			? formWorldPoint(entity, measurement.bounds.max)
			: formWorldPoint(entity, [0, 0, 0]);
	}

	return {
		pointer,
		key(intent) {
			if (objectMarkGesture === null) return false;
			if (intent.kind !== 'cancel') return false;
			endObjectMarkGesture();
			services.stage.notifySurfaceChange();
			return true;
		},
		prune: pruneObjectMarkGesture,
		reset() {
			if (objectMarkGesture !== null) endObjectMarkGesture();
			objectMarkRefusal = null;
		},
		gesture() {
			return objectMarkGesture;
		},
		refusal() {
			return objectMarkRefusal;
		},
		ghost,
		candidate() {
			return objectMarkGesture?.candidate ?? null;
		}
	};
}
