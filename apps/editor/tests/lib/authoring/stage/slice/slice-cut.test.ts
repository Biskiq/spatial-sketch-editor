/**
 * SL1 tests 1 and 1b: the typed cut and the r187 clipping-sign mirror.
 *
 * 1b is the sign guard that runs in every lane. Three's clipping rule is read from
 * the installed r187 chunks, and then the very same expression is evaluated on the
 * CPU in view space for `stage-clip`'s planes. A three upgrade that flips the rule
 * fails here rather than in a browser.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { Matrix4, PerspectiveCamera, Plane, Vector3 } from 'three';
import {
	hiddenPiecesOf,
	pieceContains,
	planOverridesOf,
	resolveSlice,
	sliceDepthItems,
	sliceHides,
	type SliceReading
} from '$lib/authoring/stage/slice/slice-cut';
import {
	createStageClip,
	STAGE_CLIP_PLANE_COUNT
} from '$lib/authoring/stage/slice/stage-clip';
import { PLAN_DEFAULT_DEPTH_METERS } from '$lib/authoring/stage/plan-parameters';

const LEVEL_TO_FLOOR: SliceReading = { kind: 'level', depth: { kind: 'to-floor' } };
const levelBelow = (meters: number): SliceReading => ({
	kind: 'level',
	depth: { kind: 'below', meters }
});

describe('resolveSlice', () => {
	it('puts the plane at the Sheet height above the datum', () => {
		expect(resolveSlice(LEVEL_TO_FLOOR, { sheetHeight: 1.2, datumMeters: 0 })).toEqual({
			kind: 'level',
			cutY: 1.2,
			lowerY: null
		});
		const offset = resolveSlice(LEVEL_TO_FLOOR, { sheetHeight: 1.2, datumMeters: 0.6 });
		expect(offset.cutY).toBeCloseTo(1.8, 12);
		expect(offset.lowerY).toBeNull();
	});

	it('turns a finite depth into a lower bound that travels with the cut', () => {
		expect(resolveSlice(levelBelow(0.7), { sheetHeight: 1.2, datumMeters: 0 })).toEqual({
			kind: 'level',
			cutY: 1.2,
			lowerY: 0.5
		});
	});

	it('normalises a lower bound at or under the datum to none', () => {
		expect(resolveSlice(levelBelow(1.2), { sheetHeight: 1.2, datumMeters: 0 }).lowerY).toBeNull();
		expect(resolveSlice(levelBelow(9), { sheetHeight: 1.2, datumMeters: 0 }).lowerY).toBeNull();
	});

	it('treats a non-distance as To the floor', () => {
		expect(resolveSlice(levelBelow(Number.POSITIVE_INFINITY), { sheetHeight: 1, datumMeters: 0 }).lowerY).toBeNull();
		expect(resolveSlice(levelBelow(0), { sheetHeight: 1, datumMeters: 0 }).lowerY).toBeNull();
		expect(resolveSlice(levelBelow(-2), { sheetHeight: 1, datumMeters: 0 }).lowerY).toBeNull();
	});
});

describe('hidden pieces and sliceHides', () => {
	const resolved = { kind: 'level' as const, cutY: 1.2, lowerY: 0.5 };

	it('is two convex pieces separated by the visible band', () => {
		expect(hiddenPiecesOf(resolved).map((piece) => piece.kind)).toEqual(['above', 'below']);
		expect(hiddenPiecesOf({ kind: 'level', cutY: 1.2, lowerY: null }).map((piece) => piece.kind)).toEqual([
			'above'
		]);
	});

	it('hides above the cut and below the bound, and keeps the band inclusive', () => {
		expect(sliceHides(resolved, 0, 1.21, 0)).toBe(true);
		expect(sliceHides(resolved, 0, 1.2, 0)).toBe(false);
		expect(sliceHides(resolved, 0, 1.0, 0)).toBe(false);
		expect(sliceHides(resolved, 0, 0.5, 0)).toBe(false);
		expect(sliceHides(resolved, 0, 0.49, 0)).toBe(true);
		// A tolerance above the offset reads the boundary as shown.
		expect(sliceHides(resolved, 0, 1.21, 0, 0.05)).toBe(false);
		expect(pieceContains({ kind: 'above', cutY: 1.2 }, 1.2)).toBe(false);
	});

	it('hides everything above a To-the-floor cut and nothing below it', () => {
		const floor = resolveSlice(LEVEL_TO_FLOOR, { sheetHeight: 1.2, datumMeters: 0 });
		expect(sliceHides(floor, 0, 5, 0)).toBe(true);
		expect(sliceHides(floor, 0, 0, 0)).toBe(false);
		expect(sliceHides(floor, 0, -3, 0)).toBe(false);
	});
});

describe('planOverridesOf', () => {
	it('keeps Plan’s own default depth for To the floor', () => {
		expect(planOverridesOf({ kind: 'level', cutY: 1.2, lowerY: null })).toEqual({
			depthMeters: PLAN_DEFAULT_DEPTH_METERS
		});
	});

	it('narrows Plan to the band a finite depth shows', () => {
		expect(planOverridesOf({ kind: 'level', cutY: 1.2, lowerY: 0.5 })).toEqual({
			depthMeters: 0.7
		});
	});
});

describe('sliceDepthItems', () => {
	const ticks = [
		{ kind: 'datum' as const, heightMeters: 0, label: 'Floor' },
		{ kind: 'found' as const, heightMeters: 0.9, label: 'Sill' },
		{ kind: 'found' as const, heightMeters: 1.2, label: 'Head' },
		{ kind: 'found' as const, heightMeters: 2.1, label: 'Lintel' }
	];

	it('offers To the floor and only ticks strictly below the cut', () => {
		const items = sliceDepthItems({ reading: LEVEL_TO_FLOOR, sheetHeightMeters: 1.2, ticks });
		expect(items.map((item) => (item.kind === 'to-floor' ? item.label : item.label))).toEqual([
			'To the floor',
			'Sill'
		]);
		expect(items[0]!.checked).toBe(true);
		expect(items[1]!.kind === 'below' && items[1]!.meters).toBeCloseTo(0.3, 9);
	});

	it('checks the live depth and never offers a disabled row', () => {
		const items = sliceDepthItems({ reading: levelBelow(0.3), sheetHeightMeters: 1.2, ticks });
		expect(items[0]!.checked).toBe(false);
		expect(items.find((item) => item.kind === 'below')!.checked).toBe(true);
		expect(items.every((item) => item.label.length > 0)).toBe(true);
	});
});

describe('the drawn arm cannot be typed with To the floor (type test)', () => {
	it('keeps SL1’s reading the only arm', () => {
		// SL2 adds `{ kind: 'drawn', … }` to this union and SL3 adds the section; until
		// then a drawn reading is not part of the type at all, and a finite depth is
		// the only shape a drawn arm may ever hold.
		// @ts-expect-error — a drawn arm does not exist in the SL1 union.
		const drawn: SliceReading = { kind: 'drawn', start: [0, 0], end: [1, 0], hidden: 'left', depthMeters: 1 };
		expect(drawn).toBeDefined();
	});
});

/** The installed r187 chunk text, read once. */
function chunk(source: string, name: string): string {
	const require = createRequire(import.meta.url);
	const path = require.resolve(`three/src/renderers/shaders/ShaderChunk/${name}.glsl.js`);
	return readFileSync(path, 'utf8').replaceAll('\\n', '\n');
}

describe('r187 clipping sign mirror (test 1b)', () => {
	it('reads the installed clipping rule', () => {
		const vertex = chunk('three', 'clipping_planes_vertex');
		expect(vertex).toContain('vClipPosition = - mvPosition.xyz;');
		const fragment = chunk('three', 'clipping_planes_fragment');
		expect(fragment).toContain('dot( vClipPosition, plane.xyz ) > plane.w');
	});

	it('keeps lowerY ≤ y ≤ cutY on the CPU, in view space, for a real camera', () => {
		const clip = createStageClip();
		expect(clip.planes).toHaveLength(STAGE_CLIP_PLANE_COUNT);
		clip.apply({ kind: 'level', cutY: 1.2, lowerY: 0.5 });

		const camera = new PerspectiveCamera(50, 1.6, 0.1, 100);
		camera.position.set(3.2, 4.1, 6.4);
		camera.lookAt(1, 0.7, 0);
		camera.updateMatrixWorld(true);

		// `WebGLClipping.projectPlanes`: the plane is transformed to view space and
		// uploaded as (normal, constant), which is exactly `Plane.applyMatrix4`.
		// Recomputed per call: `apply` mutates the shared planes in place, so a view-space
		// snapshot taken once would go stale the moment a different reading is applied.
		const viewPlanes = (): Plane[] =>
			clip.planes.map((plane) => plane.clone().applyMatrix4(camera.matrixWorldInverse));
		const discarded = (point: Vector3): boolean => {
			// The vertex chunk negates the view position; the fragment then discards
			// where dot(vClipPosition, plane.xyz) > plane.w.
			const vClipPosition = point.clone().applyMatrix4(camera.matrixWorldInverse).negate();
			return viewPlanes().some((plane) => {
				const dot =
					vClipPosition.x * plane.normal.x +
					vClipPosition.y * plane.normal.y +
					vClipPosition.z * plane.normal.z;
				return dot > plane.constant;
			});
		};

		// A micron inside the band: a point exactly on a plane is float-ambiguous in
		// both the CPU test and the GPU's signed distance, so the band is asserted with
		// a margin rather than on its own boundary.
		expect(discarded(new Vector3(0, 0.49, 0))).toBe(true);
		expect(discarded(new Vector3(0, 0.5 + 1e-6, 0))).toBe(false);
		expect(discarded(new Vector3(0, 1.2 - 1e-6, 0))).toBe(false);
		expect(discarded(new Vector3(0, 1.21, 0))).toBe(true);

		// To the floor: the lower plane is a no-op, so nothing below the cut is lost.
		clip.apply({ kind: 'level', cutY: 1.2, lowerY: null });
		for (const y of [-5, 0, 1.2]) expect(discarded(new Vector3(0, y, 0))).toBe(false);
		expect(discarded(new Vector3(0, 40, 0))).toBe(true);

		// No Slice: both planes keep everything.
		clip.apply(null);
		for (const y of [-500, 0, 1.2, 40, 900]) expect(discarded(new Vector3(0, y, 0))).toBe(false);
		expect(clip.planes.every((plane) => plane instanceof Plane)).toBe(true);
		void new Matrix4();
	});
});
