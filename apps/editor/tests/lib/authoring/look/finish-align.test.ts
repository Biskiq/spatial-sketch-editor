import { describe, expect, it, vi } from 'vitest';
import {
	alignMappingEdits,
	alignResetEdits,
	createFinishAlign,
	nudgeAlignAngle,
	nudgeAlignOffset,
	snapAlignAngle,
	snapAlignOffset
} from '$lib/authoring/look/finish-align.svelte';
import { wallSideFaceFrame } from '$lib/layout/wall-face';
import { wallFace } from '$lib/authoring/layout/wall-face-store';
import type { CompiledPhysicalWall } from '@portfolio/layout-core';

const emptyRecipes = new Map();

function straightWall(id: string): CompiledPhysicalWall {
	return {
		wallId: id,
		length: 4,
		height: 3,
		bounds3: { min: [0, 0, -0.1], max: [4, 3, 0.1] },
		samples: [
			{ distance: 0, point: [0, 0], tangent: [1, 0] },
			{ distance: 2, point: [2, 0], tangent: [1, 0] },
			{ distance: 4, point: [4, 0], tangent: [1, 0] }
		]
	} as unknown as CompiledPhysicalWall;
}

describe('Align math and session (T2.S8 U6)', () => {
	it('snaps offsets (1 cm default, 1 mm Shift) and angles (15° default, free Alt)', () => {
		expect(snapAlignOffset(0.124, false)).toBe(0.12);
		expect(snapAlignOffset(0.1244, true)).toBe(0.124);
		expect(snapAlignAngle(23, false)).toBe(30);
		expect(snapAlignAngle(23.4, true)).toBe(23.4);
		expect(snapAlignAngle(-15, false)).toBe(345);
	});

	it('nudges offset by 1 cm / 10 cm with Shift and angle by ±15°', () => {
		expect(nudgeAlignOffset([0.2, 0.3], 'ArrowRight', false)).toEqual([0.21, 0.3]);
		expect(nudgeAlignOffset([0.2, 0.3], 'ArrowRight', true)).toEqual([0.3, 0.3]);
		expect(nudgeAlignOffset([0.2, 0.3], 'ArrowUp', false)).toEqual([0.2, 0.31]);
		expect(nudgeAlignOffset([0.2, 0.3], 'KeyA', false)).toBeNull();
		expect(nudgeAlignAngle(0, 'ArrowLeft')).toBe(15);
		expect(nudgeAlignAngle(0, 'ArrowRight')).toBe(345);
	});

	it('emits one E4 mapping patch for offset/angle and Reset', () => {
		const source = { base: { catalogue: 'wood-oak-veneer' as const } };
		const moved = alignMappingEdits(source, emptyRecipes, [0.25, 0.1], 90);
		expect(moved).toHaveLength(1);
		expect(moved[0]).toMatchObject({ field: 'mapping', op: 'set' });

		const reset = alignResetEdits(
			{
				base: { catalogue: 'wood-oak-veneer' as const },
				overrides: { mapping: { kind: 'target', metric: { tileMeters: [0.5, 0.5], rotation: Math.PI / 2, offset: [0.5, 0.2] } } }
			},
			emptyRecipes
		);
		expect(reset).toEqual([{ field: 'mapping', op: 'reset' }]);
	});

	it('faces the explicit wall side from the surface ref regardless of camera side', () => {
		const wall = straightWall('w1');
		const left = wallSideFaceFrame(wall, 'left');
		const right = wallSideFaceFrame(wall, 'right');
		expect(left).not.toBeNull();
		expect(right).not.toBeNull();
		// Opposite look vectors for left vs right side of the same straight wall
		expect(left!.look[0]).toBeCloseTo(-right!.look[0], 6);
		expect(left!.look[2]).toBeCloseTo(-right!.look[2], 6);
	});

	it('refuses curved wall sides and restores entry standpoint on Put back', () => {
		const entryState = { reading: '3d', pose: { target: [0, 0, 0] } } as never;
		const face = vi.fn(() => true);
		const frameFloor = vi.fn(() => true);
		const putBack = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
		wallFace.setCameraPort({
			standpoint: () => entryState,
			face,
			frameFloor,
			putBack
		});

		const align = createFinishAlign();
		const curved = align.enter({
			target: { kind: 'surface', surface: { kind: 'wall-side', wallId: 'w-curved', side: 'left' } },
			place: 'Curved Wall',
			layout: { walls: [{ id: 'w-curved', centerline: { kind: 'arc' } }] } as never,
			geometry: { walls: [straightWall('w-curved')], rooms: [], floors: [] } as never
		});
		expect(curved.ok).toBe(false);
		expect(face).not.toHaveBeenCalled();

		const floor = align.enter({
			target: { kind: 'surface', surface: { kind: 'room-floor', roomId: 'r1' } },
			place: 'Room 1 · Floor',
			layout: { walls: [] } as never,
			geometry: {
				walls: [],
				floors: [{ floorId: 'f1', elevation: 0 }],
				rooms: [{ roomId: 'r1', floorElevation: 0, floorPolygon: [[0, 0], [5, 0], [5, 4], [0, 4]] }]
			} as never
		});
		expect(floor.ok).toBe(true);
		expect(frameFloor).toHaveBeenCalledTimes(1);
		expect(align.active?.surface).toBe('floor');

		expect(align.putBack(false)).toBe(false);
		expect(align.active?.surface).toBe('floor');
		expect(align.refusal).toContain('Camera could not return');
		expect(wallFace.reading()?.entry).toBe(entryState);
		expect(align.putBack(false)).toBe(true);
		expect(putBack).toHaveBeenCalledWith(entryState);
		expect(align.active).toBeNull();
		expect(align.refusal).toBeNull();
		wallFace.setCameraPort(null);
	});
});
