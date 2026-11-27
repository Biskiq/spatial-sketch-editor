/**
 * The group mark vocabulary: one Move cross and one Turn ring for the whole
 * group.
 *
 * A group moves and turns rigidly, so it publishes exactly two marks and never a
 * per-member set: the members keep their relative poses and the mark's own
 * geometry is the group's evaluated union. The descriptors name the registered
 * `scene-group-transform` planner; admission, projection and hit testing stay
 * with the host's one mark vocabulary.
 */
import type { Vec3 } from '@portfolio/project-model/scene';
import type { SceneObjectCluster } from '@portfolio/project-model/scene';
import type { StageHandleDescriptor } from '$lib/authoring/stage/stage-adapter-host';

export const SCENE_GROUP_MARK = {
	move: 'scene-group-move',
	turn: 'scene-group-turn',
} as const;

export type SceneGroupMarkId = (typeof SCENE_GROUP_MARK)[keyof typeof SCENE_GROUP_MARK];

export function isSceneGroupMarkId(id: string): id is SceneGroupMarkId {
	return id === SCENE_GROUP_MARK.move || id === SCENE_GROUP_MARK.turn;
}

export type SceneGroupMarkLive = {
	readonly markId: string;
	/** The adapter's own refusal words for the live candidate. */
	readonly refusal: string | null;
	/** The live delta, already formatted for its units. */
	readonly value: string;
};

export type SceneGroupGeometry = {
	/** The group's planar centre on its base plane. */
	readonly center: Vec3;
	/** The lowest member base, the plane the marks stand on. */
	readonly baseY: number;
	/** The planar reach of the union, in metres. */
	readonly radius: number;
};

/** The union geometry of the group's evaluated member bounds. */
export function sceneGroupGeometry(
	bounds: readonly { readonly min: Vec3; readonly max: Vec3 }[],
): SceneGroupGeometry | null {
	if (bounds.length === 0) return null;
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;
	for (const entry of bounds) {
		minX = Math.min(minX, entry.min[0]);
		maxX = Math.max(maxX, entry.max[0]);
		minY = Math.min(minY, entry.min[1]);
		minZ = Math.min(minZ, entry.min[2]);
		maxZ = Math.max(maxZ, entry.max[2]);
	}
	if (![minX, maxX, minY, minZ, maxZ].every(Number.isFinite)) return null;
	const center: Vec3 = [(minX + maxX) / 2, minY, (minZ + maxZ) / 2];
	const radius = Math.max(0.2, Math.max(maxX - minX, maxZ - minZ) / 2);
	return { center, baseY: minY, radius };
}

export function sceneGroupMarkDescriptors(input: {
	readonly cluster: SceneObjectCluster;
	readonly geometry: SceneGroupGeometry;
	readonly live?: SceneGroupMarkLive | null;
}): readonly StageHandleDescriptor[] {
	const { center, baseY, radius } = input.geometry;
	const live = input.live ?? null;
	const refusal = (id: SceneGroupMarkId): string | null =>
		live?.markId === id ? live.refusal : null;
	const value = (id: SceneGroupMarkId): string | undefined =>
		live?.markId === id ? live.value : undefined;
	return [
		{
			id: SCENE_GROUP_MARK.move,
			kind: 'point',
			role: 'edit',
			draw: { cross: true },
			anchor: [center[0], baseY, center[2]],
			axis: [1, 0, 0],
			extent: radius,
			label: 'Move',
			fact: 'position',
			verb: 'Position',
			planner: 'scene-group-transform',
			value: value(SCENE_GROUP_MARK.move),
			refusal: refusal(SCENE_GROUP_MARK.move),
		},
		{
			id: SCENE_GROUP_MARK.turn,
			kind: 'ring',
			role: 'edit',
			anchor: [center[0], baseY, center[2]],
			axis: [0, 1, 0],
			extent: radius,
			label: 'Turn',
			fact: 'yaw',
			verb: 'Yaw',
			planner: 'scene-group-transform',
			value: value(SCENE_GROUP_MARK.turn),
			refusal: refusal(SCENE_GROUP_MARK.turn),
		},
	];
}

/** A short planar delta label for the live Move value. */
export function groupDeltaLabel(deltaXZ: readonly [number, number]): string {
	return `${deltaXZ[0] >= 0 ? '+' : ''}${deltaXZ[0].toFixed(2)}, ${deltaXZ[1] >= 0 ? '+' : ''}${deltaXZ[1].toFixed(2)} m`;
}

/** A short turn label in degrees for the live Turn value. */
export function groupYawLabel(yaw: number): string {
	const degrees = (yaw * 180) / Math.PI;
	return `${degrees >= 0 ? '+' : ''}${degrees.toFixed(1)}°`;
}
