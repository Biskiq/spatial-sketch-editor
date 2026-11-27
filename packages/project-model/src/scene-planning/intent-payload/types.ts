import { type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { type FormLibraryPayload } from '../../library/form-library';
import { type FrameReference } from '../../references/types';
import { type MaterialId, type SceneFormPlane, type Vec3 } from '../../scene';
import { type CreatorModelResourcePayload } from '../model-resource';
import { type SceneLightSpec } from '../light-operations';
import { type SceneSupportChoice } from '../support';
import { type LocalInputFrame } from '../types';

export type SceneOperationPayload =
	| {
			readonly kind: 'create-form';
			readonly plane: SceneFormPlane;
			readonly outline: readonly {
				readonly u: number;
				readonly v: number;
				readonly smooth: boolean;
			}[];
			readonly extent: number;
			readonly position: Vec3;
			readonly yaw: number;
			readonly materialId: MaterialId;
			readonly name: string;
			readonly choice?: SceneSupportChoice;
	  }
	| {
			readonly kind: 'place-form-copy';
			readonly item: FormLibraryPayload;
			readonly worldXZ: LayoutVec2;
			readonly yaw: number;
			readonly contactMinY: number;
			readonly choice?: SceneSupportChoice;
	  }
	| {
			readonly kind: 'set-form-size';
			readonly entityId: string;
			readonly scale: readonly [number, number, number];
			readonly choice?: SceneSupportChoice;
	  }
	| {
			readonly kind: 'set-form-profile';
			readonly entityId: string;
			readonly outline: readonly {
				readonly key: number;
				readonly u: number;
				readonly v: number;
				readonly smooth: boolean;
			}[];
			readonly extent: number;
			readonly choice?: SceneSupportChoice;
	  }
	| {
			readonly kind: 'place-object';
			readonly definitionKey: string;
			readonly metadataContentId: string;
			readonly worldXZ: LayoutVec2;
			readonly yaw: number;
			readonly frame: LocalInputFrame;
			readonly frameReference: FrameReference;
			readonly choice?: SceneSupportChoice;
			/**
			 * First placement of an approved creator model: the exact resource and lock
			 * installed in the same accepted result as the entity. Later instances omit
			 * it and resolve the definition from the accepted envelope.
			 */
			readonly modelResource?: { readonly id: string } & CreatorModelResourcePayload;
	  }
	| {
			readonly kind: 'move-horizontal';
			readonly entityId: string;
			readonly worldXZ: LayoutVec2;
			readonly frame: LocalInputFrame;
			readonly frameReference: FrameReference;
			readonly contactMinY: number;
			readonly choice?: SceneSupportChoice;
	  }
	| {
			readonly kind: 'set-yaw';
			readonly entityId: string;
			readonly yaw: number;
			readonly frame: LocalInputFrame;
			readonly frameReference: FrameReference;
	  }
	| {
			readonly kind: 'place-on-floor';
			readonly entityId: string;
			readonly worldXZ: LayoutVec2;
			readonly frame: LocalInputFrame;
			readonly frameReference: FrameReference;
			readonly contactMinY: number;
			readonly yaw?: number;
			readonly choice?: SceneSupportChoice;
	  }
	| {
			readonly kind: 'resize-on-floor';
			readonly entityId: string;
			readonly scale: number;
			readonly contactMinY: number;
			readonly choice?: SceneSupportChoice;
	  }
	| {
			readonly kind: 'duplicate-one';
			readonly entityId: string;
			readonly contactMinY: number;
			readonly choice?: SceneSupportChoice;
	  }
	| { readonly kind: 'delete-one'; readonly entityId: string }
	| {
			readonly kind: 'set-lift';
			readonly entityId: string;
			readonly lift: number;
			readonly contactMinY: number;
			readonly choice?: SceneSupportChoice;
	  }
	| { readonly kind: 'set-name'; readonly entityId: string; readonly name: string }
	| {
			readonly kind: 'create-light';
			readonly light: 'point' | 'spot';
			readonly name: string;
			readonly color: string;
			readonly intensity: number;
			readonly castShadow: boolean;
			readonly position: Vec3;
			readonly rotation: Vec3;
			readonly range?: number;
			readonly angle?: number;
			readonly penumbra?: number;
	  }
	| {
			readonly kind: 'update-light';
			readonly entityId: string;
			readonly position?: Vec3;
			readonly rotation?: Vec3;
			readonly color?: string;
			readonly intensity?: number;
			readonly range?: number | null;
			readonly angle?: number;
			readonly penumbra?: number | null;
			readonly castShadow?: boolean;
	  }
	| { readonly kind: 'duplicate-light'; readonly entityId: string }
	| {
			readonly kind: 'scene-group-create';
			readonly clusterId: string;
			readonly memberIds: readonly string[];
			readonly name: string;
	  }
	| { readonly kind: 'scene-group-ungroup'; readonly clusterId: string }
	| { readonly kind: 'scene-group-rename'; readonly clusterId: string; readonly name: string }
	| {
			readonly kind: 'scene-group-transform';
			readonly clusterId: string;
			readonly motion:
				| { readonly kind: 'move'; readonly deltaXZ: readonly [number, number] }
				| { readonly kind: 'turn'; readonly yaw: number };
			readonly frame: LocalInputFrame;
			readonly frameReference: FrameReference;
			readonly contacts: readonly { readonly entityId: string; readonly contactMinY: number }[];
	  }
	| {
			readonly kind: 'scene-group-duplicate';
			readonly clusterId: string;
			readonly entityIds: readonly string[];
			readonly newClusterId: string;
			readonly contacts: readonly { readonly entityId: string; readonly contactMinY: number }[];
	  }
	| { readonly kind: 'scene-group-erase'; readonly clusterId: string }
	| {
			readonly kind: 'create-light-rig';
			readonly clusterId: string;
			readonly name: string;
			readonly lights: readonly (SceneLightSpec & { readonly entityId: string })[];
	  };

/** The operation's existing subject, or an explicit absence for creation. */
export type SceneOperationSubject =
	| { readonly kind: 'none' }
	| { readonly kind: 'entity'; readonly entityId: string }
	| { readonly kind: 'cluster'; readonly clusterId: string };
