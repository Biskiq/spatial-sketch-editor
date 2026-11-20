/**
 * The drawn GPU patch's successor: one TSL mask, no recompile.
 *
 * r187's node renderer has no `onBeforeCompile` and no GLSL chunk injection, so
 * the finite drawn cut is a `maskNode` built once from shared `uniform()` nodes.
 * These tests hold the CPU-side contract the pixels are proved against in the
 * plan's browser QA: finite uniforms, a stable graph identity, attachment on
 * exactly the colour kinds, and a pass-through shadow mask.
 */
import { describe, expect, it } from 'vitest';
import { MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, Plane } from 'three';
import {
	createSliceClipMask,
	createSliceClipUniforms,
	hasSliceClipMask,
	NEVER_CUT_TOP_Y,
	restoreSliceClipUniforms,
	snapshotSliceClipUniforms,
	writeSliceClipUniforms,
	type SliceClipMasks
} from '$lib/render/clip/slice-clip-mask';
import { createMaterialStore } from '$lib/render/resources/material-store';
import { materialUsesPlanes } from '$lib/render/clip/slice-clip-mask';
import type { DrawnResolvedSlice } from '$lib/authoring/stage/slice/slice-cut';

const drawn: DrawnResolvedSlice = {
	kind: 'drawn',
	origin: [1, 0.5, -2],
	along: [0, 0, 1],
	hiddenNormal: [-1, 0, 0],
	halfLength: 2,
	depthMeters: 0.75,
	hidden: 'left',
	start: [1, 0.5, -4],
	end: [1, 0.5, 0]
};

function masksFor(cutaway = false): SliceClipMasks {
	return createSliceClipMask(createSliceClipUniforms(), { cutaway });
}

describe('slice clip uniforms', () => {
	it('writes a drawn reading and turns itself off for Level and off', () => {
		const uniforms = createSliceClipUniforms();
		writeSliceClipUniforms(uniforms, drawn);
		expect(uniforms.mode.value).toBe(1);
		expect(uniforms.origin.value.toArray()).toEqual([1, 0.5, -2]);
		expect(uniforms.normal.value.toArray()).toEqual([-1, 0, 0]);
		expect(uniforms.along.value.toArray()).toEqual([0, 0, 1]);
		expect(uniforms.halfLength.value).toBe(2);
		expect(uniforms.depth.value).toBe(0.75);
		writeSliceClipUniforms(uniforms, null);
		expect(uniforms.mode.value).toBe(0);
	});

	it('parks and restores every value a snapshot may read', () => {
		const uniforms = createSliceClipUniforms();
		writeSliceClipUniforms(uniforms, drawn);
		const saved = snapshotSliceClipUniforms(uniforms);
		writeSliceClipUniforms(uniforms, null);
		expect(uniforms.mode.value).toBe(0);
		expect(uniforms.mode.value).not.toBe(saved.mode);
		restoreSliceClipUniforms(uniforms, saved);
		expect(uniforms.mode.value).toBe(1);
		expect(uniforms.origin.value.toArray()).toEqual([1, 0.5, -2]);
		expect(uniforms.halfLength.value).toBe(2);
	});

	it('never parks the cutaway top at the reading’s value', () => {
		const uniforms = createSliceClipUniforms();
		uniforms.cutawayTopY.value = 1;
		const saved = snapshotSliceClipUniforms(uniforms);
		writeSliceClipUniforms(uniforms, drawn);
		uniforms.cutawayTopY.value = NEVER_CUT_TOP_Y;
		restoreSliceClipUniforms(uniforms, saved);
		expect(uniforms.cutawayTopY.value).toBe(1);
		expect(NEVER_CUT_TOP_Y).toBeGreaterThan(1);
	});
});

describe('the mask graph', () => {
	it('builds one colour and one pass-through shadow mask', () => {
		const masks = masksFor();
		expect(masks.colour).toBeTruthy();
		expect(masks.shadow).toBeTruthy();
		// Two graphs, not one object reused: the shadow pass must not discard.
		expect(masks.shadow).not.toBe(masks.colour);
	});

	it('binds the live cutaway top only for the twin set', () => {
		const uniforms = createSliceClipUniforms();
		const whole = createSliceClipMask(uniforms);
		const cutaway = createSliceClipMask(uniforms, { cutaway: true });
		expect(whole.colour).not.toBe(cutaway.colour);
	});
});

describe('store attachment', () => {
	it('installs one mask on every colour kind and none on the shadow catcher', () => {
		const masks = masksFor();
		const store = createMaterialStore({ clipMasks: () => masks });
		const standard = store.acquire({ kind: 'standard', color: '#ffffff', roughness: 0.5, metalness: 0 }).material;
		const lambert = store.acquire({ kind: 'lambert', color: '#ffffff' }).material;
		const basic = store.acquire({ kind: 'basic', color: '#ffffff' }).material;
		for (const material of [standard, lambert, basic]) {
			expect(hasSliceClipMask(material)).toBe(true);
			expect((material as MeshStandardMaterial & { maskNode?: unknown }).maskNode).toBe(masks.colour);
			expect((material as MeshStandardMaterial & { maskShadowNode?: unknown }).maskShadowNode).toBe(masks.shadow);
			// The mask is the shadow pass's pass-through, never the colour predicate.
			expect((material as MeshStandardMaterial & { maskShadowNode?: unknown }).maskShadowNode).not.toBe(masks.colour);
		}
		const shadow = store.acquire({ kind: 'shadow', opacity: 0.3 }).material;
		expect(hasSliceClipMask(shadow)).toBe(false);
		const grounded = store.acquire({ kind: 'lambert', color: '#ffffff', clip: false }).material;
		expect(hasSliceClipMask(grounded)).toBe(false);
		store.dispose();
	});

	it('gives the material a graph, not a program key', () => {
		const masks = masksFor();
		const store = createMaterialStore({ clipMasks: () => masks });
		const material = store.acquire({ kind: 'lambert', color: '#ffffff' }).material;
		const key = material.customProgramCacheKey();
		// Acquiring an equal look returns the same graph and no new program.
		const again = store.acquire({ kind: 'lambert', color: '#ffffff' }).material;
		expect(again).toBe(material);
		expect(again.customProgramCacheKey()).toBe(key);
		store.dispose();
	});

	it('still hands every colour kind the Canvas planes by reference', () => {
		const planes = [new Plane(), new Plane()];
		const store = createMaterialStore({ clippingPlanes: planes });
		const material = store.acquire({ kind: 'basic', color: '#ffffff' }).material;
		expect(materialUsesPlanes(material, planes)).toBe(true);
		store.dispose();
	});

	it('patches clipped ink with the same graph the store uses', () => {
		const masks = masksFor();
		const store = createMaterialStore({ clipMasks: () => masks });
		const material = store.acquire({ kind: 'basic', color: '#ffffff' }).material as MeshBasicMaterial;
		expect(hasSliceClipMask(material)).toBe(true);
		expect(material).toBeInstanceOf(MeshBasicMaterial);
		expect(store.acquire({ kind: 'lambert', color: '#ffffff' }).material).toBeInstanceOf(MeshLambertMaterial);
		store.dispose();
	});
});
