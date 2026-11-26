/** The Finish and palette operation kinds, and the union they form. */

export const SCENE_FINISH_ASSIGN = 'scene-finish-assign';
export const SCENE_SURFACE_FINISH_ASSIGN = 'scene-surface-finish-assign';
export const SCENE_FINISH_EDIT = 'scene-finish-edit';
export const SCENE_PALETTE_SLOT_ADD = 'scene-palette-slot-add';
export const SCENE_PALETTE_SLOT_SET = 'scene-palette-slot-set';
export const SCENE_PALETTE_SLOT_RENAME = 'scene-palette-slot-rename';
export const SCENE_PALETTE_SLOT_REMOVE = 'scene-palette-slot-remove';
export const SCENE_PALETTE_ADOPT = 'scene-palette-adopt';
export const SCENE_FINISH_FROM_IMAGE = 'scene-finish-from-image';
export const SCENE_FINISH_REGISTER = 'scene-finish-register';
export const SCENE_FINISH_RENAME = 'scene-finish-rename';
export const SCENE_FINISH_PATCH = 'scene-finish-patch';
export const SCENE_FINISH_REMOVE = 'scene-finish-remove';
export const SCENE_COLOUR_COAT = 'scene-colour-coat';

export const kinds = [
	SCENE_FINISH_ASSIGN,
	SCENE_SURFACE_FINISH_ASSIGN,
	SCENE_FINISH_EDIT,
	SCENE_FINISH_FROM_IMAGE,
	SCENE_FINISH_REGISTER,
	SCENE_FINISH_RENAME,
	SCENE_FINISH_PATCH,
	SCENE_FINISH_REMOVE,
	SCENE_COLOUR_COAT,
	SCENE_PALETTE_SLOT_ADD,
	SCENE_PALETTE_SLOT_SET,
	SCENE_PALETTE_SLOT_RENAME,
	SCENE_PALETTE_SLOT_REMOVE,
	SCENE_PALETTE_ADOPT,
] as const;
export type Kind = (typeof kinds)[number];
