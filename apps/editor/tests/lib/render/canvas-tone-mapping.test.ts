// @vitest-environment jsdom
/**
 * T2 Stage/Preview tone-mapping correction — what each product Canvas actually runs.
 *
 * T2 S0 Gate A accepted `NoToneMapping` at exposure 1.0 with sRGB output and an
 * `srgb-linear` working space. Gate A measured only the shared
 * `createManagedWebGLRenderer` factory, and E12 recorded the gap: Threlte's
 * `<Canvas>` assigns its own `AgXToneMapping` default to the renderer that
 * `createRenderer` returns, so the Stage, the Visitor Preview and the published
 * visit shipped a pipeline the contract did not describe.
 *
 * The mounted checks below read the renderer **Threlte configured**, on the real
 * `StageCanvas` and `VisitorPreviewSurface`, through their production renderer
 * callbacks. Only the GPU implementation is doubled; the factory, the managed
 * wrapper, the Canvas props and Threlte's renderer context are the shipped ones.
 * The source checks then hold the fix explicit, so a future Threlte default
 * change cannot make a correct runtime result pass by accident.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import {
	ColorManagement,
	LinearSRGBColorSpace,
	NoToneMapping,
	PCFShadowMap,
	SRGBColorSpace
} from 'three';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument
} from '@portfolio/layout-core';
import {
	createEmptyWorldLocalSceneDocument,
	type RuntimeScene
} from '@portfolio/project-model';

import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import StageCanvas from '$lib/authoring/stage/shell/StageCanvas.svelte';
import VisitorPreviewSurface from '$lib/visitor/VisitorPreviewSurface.svelte';

/** The vitest root is `apps/editor`; the same read the other render guards use. */
function source(path: string): string {
	return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

// Svelte's devicePixelRatio rune and Threlte's renderer context touch
// matchMedia at module evaluation, before a test hook could install it.
vi.hoisted(() => {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
	});
});

/** Every renderer the production callbacks constructed, in creation order. */
const gpu = vi.hoisted(() => ({ created: [] as unknown[] }));

vi.mock('three', async (importOriginal) => {
	const actual = await importOriginal<typeof import('three')>();
	/** Only the GPU implementation is doubled; the managed wrapper stays production. */
	class StubWebGLRenderer {
		readonly info = { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } };
		readonly shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
		readonly xr = { isPresenting: false };
		readonly domElement: HTMLCanvasElement | null;
		// Three's own renderer defaults, so a test reads only what the Canvas and
		// the factory assign. Threlte's Canvas context assigns `toneMapping` and
		// `outputColorSpace`; nothing in the product assigns exposure.
		outputColorSpace: string = actual.SRGBColorSpace;
		toneMapping: number = actual.NoToneMapping;
		toneMappingExposure = 1;
		private animation: ((time: number) => void) | null = null;

		constructor(options: { canvas?: HTMLCanvasElement } = {}) {
			this.domElement = options.canvas ?? null;
			gpu.created.push(this);
		}

		setAnimationLoop(callback: ((time: number) => void) | null): void {
			this.animation = callback;
			if (callback === null) return;
			const loop = (time: number): void => {
				if (this.animation !== callback) return;
				callback(time);
				requestAnimationFrame(loop);
			};
			requestAnimationFrame(loop);
		}

		setPixelRatio(): void {}
		setSize(): void {}
		getSize(target: { x: number; y: number }): { x: number; y: number } {
			target.x = RECT.width;
			target.y = RECT.height;
			return target;
		}
		setViewport(): void {}
		setScissor(): void {}
		setScissorTest(): void {}
		clear(): void {}
		setClearColor(): void {}
		render(): void {}
		dispose(): void {}
	}
	return { ...actual, WebGLRenderer: StubWebGLRenderer };
});

type EffectiveRenderer = {
	readonly toneMapping: number;
	readonly toneMappingExposure: number;
	readonly outputColorSpace: string;
	readonly shadowMap: { readonly type: number };
};

/** The renderer this Canvas mount created. One Canvas owns exactly one. */
function effectiveRenderer(): EffectiveRenderer {
	expect(gpu.created).toHaveLength(1);
	return gpu.created[0] as EffectiveRenderer;
}

function emptyScene(): RuntimeScene {
	const document = createEmptyWorldLocalSceneDocument();
	return {
		textures: document.textures,
		materials: document.materials,
		entities: document.entities,
		objects: []
	};
}

function emptyGeometry() {
	return compileWallFirstLayoutGeometry(createEmptyWallFirstLayoutDocument()).geometry;
}

let targets: HTMLElement[] = [];

function host(): HTMLElement {
	const target = document.createElement('div');
	document.body.append(target);
	targets.push(target);
	return target;
}

async function mountStage() {
	const component = mount(StageCanvas, {
		target: host(),
		props: {
			geometry: emptyGeometry(),
			sourceContentId: 'source-tone-mapping',
			layoutRevision: 'layout-tone-mapping',
			scene: emptyScene(),
			scenePick: createScenePickSource(),
			evaluation: null
		}
	});
	flushSync();
	await tick();
	return component;
}

async function mountPreview() {
	const component = mount(VisitorPreviewSurface, {
		target: host(),
		props: {
			scene: emptyScene(),
			geometry: emptyGeometry(),
			// No Experience run: the Canvas is the subject, and the visitor runtime
			// additions (camera director, interpreter) are not part of the pipeline.
			graph: { navigationNodes: [], connections: [], nodeById: new Map() },
			resolveTexture: () => null,
			mode: 'preview',
			startMode: 'welcome'
		}
	});
	flushSync();
	await tick();
	return component;
}

beforeEach(() => {
	gpu.created.length = 0;
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe(): void {}
			unobserve(): void {}
			disconnect(): void {}
		}
	);
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
		RECT as unknown as DOMRect
	);
});

afterEach(() => {
	for (const target of targets) target.remove();
	targets = [];
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('Stage Canvas pipeline', () => {
	it('runs NoToneMapping at exposure 1 with sRGB output', async () => {
		const component = await mountStage();
		try {
			const renderer = effectiveRenderer();
			expect(renderer.toneMapping).toBe(NoToneMapping);
			expect(renderer.toneMappingExposure).toBe(1);
			expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
			// The explicit shadow-map type is unchanged by this correction.
			expect(renderer.shadowMap.type).toBe(PCFShadowMap);
			expect(ColorManagement.enabled).toBe(true);
			expect(ColorManagement.workingColorSpace).toBe(LinearSRGBColorSpace);
		} finally {
			await unmount(component);
		}
	});
});

describe('Visitor Preview Canvas pipeline', () => {
	it('runs NoToneMapping at exposure 1 with sRGB output', async () => {
		const component = await mountPreview();
		try {
			const renderer = effectiveRenderer();
			expect(renderer.toneMapping).toBe(NoToneMapping);
			expect(renderer.toneMappingExposure).toBe(1);
			expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
			expect(renderer.shadowMap.type).toBe(PCFShadowMap);
			expect(ColorManagement.enabled).toBe(true);
			expect(ColorManagement.workingColorSpace).toBe(LinearSRGBColorSpace);
		} finally {
			await unmount(component);
		}
	});
});

/**
 * The runtime checks above would also pass if Threlte one day changed its own
 * default, leaving the product's pipeline to a dependency. These hold the
 * decision where it belongs: one named constant, both Canvases.
 */
describe('tone mapping is named, not inherited', () => {
	const CANVASES = [
		{
			name: 'Stage',
			path: 'src/lib/authoring/stage/shell/StageCanvas.svelte'
		},
		{
			name: 'Preview',
			path: 'src/lib/visitor/VisitorPreviewSurface.svelte'
		}
	] as const;

	it('defines the accepted value once, in the shared renderer module', () => {
		const file = source('src/lib/render/canvas-renderers.ts');
		expect(file).toContain('export const CANVAS_TONE_MAPPING = NoToneMapping;');
	});

	it.each(CANVASES)('$name passes the shared constant exactly once', ({ path }) => {
		const file = source(path);
		expect(file).toMatch(
			/import \{[^}]*\bCANVAS_TONE_MAPPING\b[^}]*\} from '\$lib\/render\/canvas-renderers'/
		);
		expect(file).toContain('toneMapping={CANVAS_TONE_MAPPING}');
		expect(file.match(/\btoneMapping=/g) ?? []).toHaveLength(1);
	});
});
