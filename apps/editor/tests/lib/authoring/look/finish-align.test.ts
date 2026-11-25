import { describe, expect, it, vi } from 'vitest';
import {
	alignArrowDirection,
	alignArrowTurn,
	alignOccluders,
	alignPlacementEdits,
	alignResetEdits,
	alignSetMapping,
	createFinishAlign
} from '$lib/authoring/look/finish-align.svelte';
import { wallSideFaceFrame } from '$lib/layout/wall-face';
import { wallFace } from '$lib/authoring/layout/wall-face-store';
import type { CompiledPhysicalWall } from '@portfolio/layout-core/geometry';

const emptyRecipes = new Map();

function straightWall(id: string): CompiledPhysicalWall {
	return {
		wallId: id,
		length: 4,
		height: 3,
		thickness: 0.2,
		bounds3: { min: [0, 0, -0.1], max: [4, 3, 0.1] },
		samples: [
			{ distance: 0, point: [0, 0], tangent: [1, 0] },
			{ distance: 2, point: [2, 0], tangent: [1, 0] },
			{ distance: 4, point: [4, 0], tangent: [1, 0] }
		]
	} as unknown as CompiledPhysicalWall;
}

describe('Align math and session (T2.S8 U6)', () => {
	it('maps arrows to screen directions and ±15° turns', () => {
		expect(alignArrowDirection('ArrowRight')).toEqual([1, 0]);
		expect(alignArrowDirection('ArrowUp')).toEqual([0, -1]);
		expect(alignArrowDirection('KeyA')).toBeNull();
		expect(alignArrowTurn('ArrowLeft')).toBe(1);
		expect(alignArrowTurn('ArrowDown')).toBe(-1);
	});

	it('emits one E4 mapping patch in tile fractions and radians, keeping tile size', () => {
		const source = { base: { catalogue: 'wood-oak-veneer' as const } };
		const base = alignSetMapping(source, emptyRecipes).mapping;
		expect(base.kind).toBe('target');
		const moved = alignPlacementEdits(source, emptyRecipes, Math.PI / 2, [0.25, 1.1]);
		expect(moved).toHaveLength(1);
		const edit = moved[0] as { field: string; op: string; value: { kind: string; metric: { tileMeters: number[]; rotation: number; offset: number[] } } };
		expect(edit).toMatchObject({ field: 'mapping', op: 'set' });
		expect(edit.value.metric.rotation).toBeCloseTo(Math.PI / 2, 9);
		expect(edit.value.metric.offset[0]).toBeCloseTo(0.25, 9);
		expect(edit.value.metric.offset[1]).toBeCloseTo(0.1, 9);
		expect(edit.value.metric.tileMeters).toEqual(base.kind === 'uv' ? [] : [...base.metric.tileMeters]);
		expect(alignPlacementEdits(source, emptyRecipes, 0, [0, 0])).toEqual([]);

		const reset = alignResetEdits(
			{
				base: { catalogue: 'wood-oak-veneer' as const },
				overrides: { mapping: { ...base, metric: { ...(base as unknown as { metric: { tileMeters: [number, number] } }).metric, rotation: Math.PI / 2, offset: [0.5, 0.2] } } as never }
			},
			emptyRecipes
		);
		expect(reset).toEqual([{ field: 'mapping', op: 'reset' }]);
	});

	it('names roles whose own binding mapping would ignore the set mapping', () => {
		const source = {
			base: { catalogue: 'wood-oak-veneer' as const },
			overrides: { maps: { color: { image: 'img-1', mapping: { kind: 'uv', set: 0, repeat: [1, 1], rotation: 0, offset: [0, 0] } } } }
		} as never;
		expect(alignSetMapping(source, emptyRecipes).separateRoles).toContain('color');
		expect(alignSetMapping({ base: { catalogue: 'wood-oak-veneer' as const } }, emptyRecipes).separateRoles).toEqual([]);
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
		expect(frameFloor.mock.calls[0]).toHaveLength(2);
		expect(align.active?.surface).toBe('floor');
		// The floor chart is the renderer's (u = x, v = −z) over the polygon bounds.
		expect(align.active?.chart).toMatchObject({ uMin: 0, uMax: 5, vMin: -4, vMax: -0 });
		expect((frameFloor.mock.calls[0] as unknown[])[1]).toMatchObject({ center: [2.5, 0, 2], surfaceMeters: [5, 4] });
		// A resized Stage re-frames without a new standpoint.
		expect(align.reframe()).toBe(true);
		expect(frameFloor).toHaveBeenCalledTimes(2);
		expect(wallFace.reading()?.entry).toBe(entryState);

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

describe('Align wall entry', () => {
	it('faces the Card target side and charts that side with a region fit', () => {
		const face = vi.fn(() => true);
		wallFace.setCameraPort({ standpoint: () => ({ reading: '3d' }) as never, face, putBack: vi.fn(() => true) });
		const align = createFinishAlign();
		const wall = {
			wallId: 'w1', length: 4, height: 3, thickness: 0.2,
			bounds3: { min: [0, 0, -0.1], max: [4, 3, 0.1] },
			samples: [
				{ distance: 0, point: [0, 0], tangent: [1, 0] },
				{ distance: 4, point: [4, 0], tangent: [1, 0] }
			]
		};
		const res = align.enter({
			target: { kind: 'surface', surface: { kind: 'wall-side', wallId: 'w1', side: 'right' } },
			place: 'Wall · B',
			layout: { walls: [{ id: 'w1', centerline: { kind: 'line' } }] } as never,
			geometry: { walls: [wall], rooms: [] } as never
		});
		expect(res.ok).toBe(true);
		const [frame, fit] = face.mock.calls[0] as unknown as [{ look: number[] }, { center: number[]; surfaceMeters: number[] }];
		// Right side = −normal (normal = (−t_z, t_x) = (0, 1)): the eye looks toward +z.
		expect(frame.look[2]).toBeCloseTo(1, 9);
		expect(fit.center).toEqual([2, 1.5, -0.1]);
		expect(fit.surfaceMeters).toEqual([4, 3]);
		expect(align.active?.corners[0]).toEqual([0, 0, -0.1]);
		expect(align.active?.occluders).toEqual([]);
		wallFace.setCameraPort(null);
		wallFace.clear();
	});
});

describe('Align occluders', () => {
	it('cuts every other Wall in front of the faced plane, never the faced one or those behind', () => {
		const box = (id: string, min: number[], max: number[]) => ({ wallId: id, bounds3: { min, max } });
		const active = {
			surface: 'wall' as const,
			target: { kind: 'surface' as const, surface: { kind: 'wall-side' as const, wallId: 'far', side: 'right' as const } },
			// Inside face of the far wall at z = 0.1, eye toward +z.
			corners: [[0, 0, 0.1], [4, 0, 0.1], [4, 3, 0.1], [0, 3, 0.1]] as const,
			toward: [0, 0, 1] as const
		};
		const walls = [
			box('far', [0, 0, -0.1], [4, 3, 0.1]),
			box('near', [0, 0, 3.9], [4, 3, 4.1]),
			box('side', [-0.1, 0, -0.1], [0.1, 3, 4.1]),
			box('behind', [0, 0, -3], [4, 3, -2.8])
		];
		expect(alignOccluders(active, walls)).toEqual(['near', 'side']);
		expect(alignOccluders({ ...active, surface: 'floor' }, walls)).toEqual([]);
	});
});
