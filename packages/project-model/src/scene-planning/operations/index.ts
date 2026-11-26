/**
 * Scene object operations, one module per family.
 *
 * Transform, Form, lifecycle, support and finalization plans share the
 * operation vocabulary in `types` and the refusal constructors in `refusals`;
 * each family module owns only its own planning rules.
 */
export {
	DUPLICATE_OFFSET_METERS,
	FORM_GENERATOR_SCOPE_FIELD,
	FORM_SCALE_SCOPE_FIELD,
	SCENE_LIFT_LIMIT_METERS,
	SCENE_NAME_LIMIT,
	SCENE_OPERATION_KINDS,
	YAW_SCOPE_FIELD,
} from './types';
export type {
	SceneOperationCandidate,
	SceneOperationContext,
	SceneOperationCorrespondence,
	SceneOperationKind,
	SceneOperationRefusal,
	SceneOperationRefusalCode,
	SceneOperationResult,
	SceneOperationSupportEvidence,
} from './types';

export {
	planMoveHorizontal,
	planPlaceOnFloor,
	planResizeOnFloor,
	planSetLift,
	planSetYaw,
} from './transform';
export { planCreateForm, planPlaceFormCopy, planSetFormProfile, planSetFormSize } from './form';
export { planDeleteOne, planDuplicateOne, planSetName } from './lifecycle';
export { floorTransformSupport, sceneEntityLift } from './support';
export type { FloorTransformSupport } from './support';
export { finalizePlacedEntity } from './finalization';
