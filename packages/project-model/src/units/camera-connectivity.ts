import type { SceneValidationOptions } from '../scene-validation';

/**
 * The one Camera-unit connectivity policy.
 *
 * A Camera unit may carry independent Travel pairs: the Guide's order is
 * editorial, and two direct Camera paths need not be joined by an additional
 * connection merely to satisfy a document-level reachability walk. Camera-unit
 * admission and its runtime Scene projection both force this policy after any
 * host catalogue options, so editor and visitor cannot diverge.
 *
 * This is an internal validation context, not an authored setting. A direct
 * Scene document keeps the default `single-component` policy.
 */
export const CAMERA_UNIT_SCENE_VALIDATION = {
	connectivity: 'independent-components'
} as const satisfies SceneValidationOptions;
