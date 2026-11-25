import type { ResolvedSceneValidationOptions } from '../../scene-validation';

export type EntityParserOptions = {
	allowMaterialInstance: boolean;
} & ResolvedSceneValidationOptions;


/** A project texture's `id` must equal the P20 asset its URI names. */
export const PROJECT_ASSET_URI_PATTERN = /^\/project-assets\/([^/]+)$/;


export const FINISH_COLOR_SLOT_MAX_LENGTH = 64;
