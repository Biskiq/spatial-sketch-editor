/**
 * The drawn GPU patch's CPU-side contract: one install, stable key, finite
 * uniforms, and the same predicate the CPU uses. The pixels are proved separately
 * by `perf/flows/stage-clip.spec.ts` on real WebGL.
 */
import { describe, expect, it } from 'vitest';
import { MeshBasicMaterial, MeshStandardMaterial, type WebGLRenderer } from 'three';
import {
	applySliceClipShader,
	createSliceClipUniforms,
	hasSliceClipShader,
	SLICE_CLIP_PROGRAM_KEY,
	writeSliceClipUniforms
} from '$lib/render/resources/material-store';
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

function fakeShader() {
	return {
		uniforms: {} as Record<string, unknown>,
		vertexShader: '#include <begin_vertex>\nvoid main() {\n#include <project_vertex>\n}',
		fragmentShader: 'void main() {\n#include <clipping_planes_fragment>\n}'
	};
}

describe('slice clip shader patch', () => {
	it('installs once and keeps a stable program key', () => {
		const material = new MeshStandardMaterial();
		const uniforms = createSliceClipUniforms();
		const baseKey = material.customProgramCacheKey();
		expect(applySliceClipShader(material, uniforms)).toBe(true);
		expect(hasSliceClipShader(material)).toBe(true);
		expect(material.customProgramCacheKey()).toBe(`${baseKey}|${SLICE_CLIP_PROGRAM_KEY}`);
		const key = material.customProgramCacheKey();
		applySliceClipShader(material, uniforms);
		expect(material.customProgramCacheKey()).toBe(key);
		const shader = fakeShader();
		material.onBeforeCompile(shader as never, {} as WebGLRenderer);
		expect(shader.uniforms.uSliceClipMode).toBe(uniforms.mode);
		expect(shader.uniforms.uSliceClipDepth).toBe(uniforms.depth);
		expect(shader.vertexShader).toContain('vSliceWorldPosition');
		expect(shader.vertexShader).toContain('modelMatrix * sliceClipWorld');
		expect(shader.fragmentShader).toContain('abs( sliceClipS ) <= uSliceClipHalfLength');
		expect(shader.fragmentShader).toContain('sliceClipB < -uSliceClipDepth');
		material.dispose();
	});

	it('leaves a shader whose chunks are missing untouched', () => {
		const material = new MeshBasicMaterial();
		const uniforms = createSliceClipUniforms();
		applySliceClipShader(material, uniforms);
		const shader = { uniforms: {}, vertexShader: 'void main() {}', fragmentShader: 'void main() {}' };
		material.onBeforeCompile(shader as never, {} as WebGLRenderer);
		expect(shader.vertexShader).toBe('void main() {}');
		expect(shader.fragmentShader).toBe('void main() {}');
		material.dispose();
	});

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
		expect(uniforms.mode.value).toBe(0);
	});
});
