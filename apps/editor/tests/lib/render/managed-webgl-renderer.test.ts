import { expect, it, vi } from 'vitest';
import { Camera, Mesh, MeshStandardMaterial, Scene, Texture, type WebGLRenderer } from 'three';
import { manageWebGLRenderer } from '$lib/render/managed-webgl-renderer';

/** Simulate public compilation/render hooks; the real browser test proves GPU collection. */
function renderer(texture: Texture) {
	const material = new MeshStandardMaterial();
	const compile = vi.fn();
	material.onBeforeCompile = compile;
	const key = material.customProgramCacheKey();
	const scene = new Scene();
	scene.add(new Mesh(undefined, material));
	const dispose = vi.fn();
	const resetState = vi.fn();
	const render = vi.fn(() => {
		expect(material.customProgramCacheKey()).toBe(key);
		const shader = { uniforms: { dfgLUT: { value: null as Texture | null } } };
		material.onBeforeCompile(shader as unknown as Parameters<MaterialCompile>[0], managed);
		shader.uniforms.dfgLUT.value = texture;
	});
	const managed = manageWebGLRenderer({
		render, dispose, resetState,
		getRenderTarget: () => null, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
		getViewport: (value: import('three').Vector4) => value.set(0, 0, 96, 96),
		getScissor: (value: import('three').Vector4) => value.set(0, 0, 96, 96),
		getScissorTest: () => false,
		setViewport: vi.fn(), setScissor: vi.fn(), setScissorTest: vi.fn(), setRenderTarget: vi.fn()
	} as unknown as WebGLRenderer);
	return { managed, scene, material, compile, render, dispose, resetState };
}
type MaterialCompile = MeshStandardMaterial['onBeforeCompile'];

it('releases retired ownership immediately without changing surviving Canvas state', () => {
	const texture = new Texture();
	const release = vi.spyOn(texture, 'dispose');
	const first = renderer(texture), second = renderer(texture);
	try {
		for (const owner of [first, second]) {
			owner.managed.render(owner.scene, new Camera());
			expect(owner.compile).toHaveBeenCalledTimes(1);
			expect(owner.material.onBeforeCompile).toBe(owner.compile);
			expect(owner.managed.render).toBe(owner.render);
		}
		first.managed.dispose();
		expect(release).toHaveBeenCalledTimes(1);
		expect(second.resetState).not.toHaveBeenCalled();
		expect(second.managed.setRenderTarget).not.toHaveBeenCalled();
		expect(second.managed.setViewport).not.toHaveBeenCalled();
		expect(second.managed.setScissor).not.toHaveBeenCalled();
		expect(first.dispose).toHaveBeenCalledTimes(1);
		// A still-mounted second Canvas can keep using the texture.
		second.managed.render(second.scene, new Camera());
		second.managed.dispose();
		expect(release).toHaveBeenCalledTimes(2);
		expect(release.mock.invocationCallOrder[1]).toBeLessThan(second.dispose.mock.invocationCallOrder[0]!);
		second.managed.dispose();
		expect(second.dispose).toHaveBeenCalledTimes(1);
	} finally { first.managed.dispose(); second.managed.dispose(); }
});

it('releases lookup ownership for each later renderer lifecycle', () => {
	const texture = new Texture();
	const release = vi.spyOn(texture, 'dispose');
	for (let index = 0; index < 3; index++) {
		const owner = renderer(texture);
		try { owner.managed.render(owner.scene, new Camera()); }
		finally { owner.managed.dispose(); }
	}
	expect(release).toHaveBeenCalledTimes(3);
});

it('restores compilation hooks and closes a renderer even when rendering fails', () => {
	const material = new MeshStandardMaterial();
	const compile = material.onBeforeCompile, key = material.customProgramCacheKey;
	const scene = new Scene(); scene.add(new Mesh(undefined, material));
	const dispose = vi.fn();
	const owner = manageWebGLRenderer({ render: () => { throw new Error('shader failed'); }, dispose } as unknown as WebGLRenderer);
	try {
		expect(() => owner.render(scene, new Camera())).toThrow('shader failed');
		expect(material.onBeforeCompile).toBe(compile);
		expect(material.customProgramCacheKey).toBe(key);
	} finally { owner.dispose(); }
	expect(dispose).toHaveBeenCalledTimes(1);
});

it('does not invalidate a survivor lookup when the closing Canvas never used it', () => {
	const texture = new Texture();
	const release = vi.spyOn(texture, 'dispose');
	const physical = renderer(texture);
	const empty = manageWebGLRenderer({ render: vi.fn(), dispose: vi.fn() } as unknown as WebGLRenderer);
	try {
		physical.managed.render(physical.scene, new Camera());
		empty.render(new Scene(), new Camera());
		empty.dispose();
		expect(release).not.toHaveBeenCalled();
	} finally { empty.dispose(); physical.managed.dispose(); }
	expect(release).toHaveBeenCalledTimes(1);
});
