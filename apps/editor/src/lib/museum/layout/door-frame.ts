/**
 * A door's frame: a lining inside the Opening's own void.
 *
 * It belongs to the Opening, so no part of it may reach past the void or the Wall
 * around it, whatever the Wall's thickness or the Opening's place on it. Its depth
 * stops short of the Wall's faces, because a coplanar face would fight them.
 */
export const DOOR_FRAME_MEMBER_METERS = 0.04;
export const DOOR_FRAME_FACE_INSET_METERS = 0.002;

export type DoorFrameBox = {
	readonly center: readonly [number, number, number];
	readonly size: readonly [number, number, number];
};

/** In the Opening's frame: origin at its sill centre, X along the Wall, Z through it. */
export function doorFrameBoxes(input: {
	readonly width: number;
	readonly height: number;
	readonly wallThickness: number;
}): readonly DoorFrameBox[] {
	const member = DOOR_FRAME_MEMBER_METERS;
	const depth = Math.max(input.wallThickness - 2 * DOOR_FRAME_FACE_INSET_METERS, 0);
	if (depth <= 0 || input.width <= 2 * member || input.height <= member) return [];
	const postX = input.width / 2 - member / 2;
	const postHeight = input.height - member;
	return [
		{ center: [-postX, postHeight / 2, 0], size: [member, postHeight, depth] },
		{ center: [postX, postHeight / 2, 0], size: [member, postHeight, depth] },
		{ center: [0, input.height - member / 2, 0], size: [input.width, member, depth] }
	];
}
