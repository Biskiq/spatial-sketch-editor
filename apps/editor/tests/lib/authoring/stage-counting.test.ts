// @vitest-environment jsdom
/**
 * E0/C0 — the ten work counters at their production call sites.
 *
 * Each count below is asserted through the caller that ships it: the mounted
 * Stage Paper layer, the mounted shadow-trigger wiring, the Stage's managed
 * renderer hand-off, the Camera inspection session, the Layout candidate Paper
 * builder, unit runtime preparation and the Scene material/texture resolvers.
 * No test calls `countWork` itself, so a counter that stops being wired goes to
 * zero and fails here.
 *
 * The Canvas boundary is doubled for the two mounted components (the Threlte
 * context below); the components and every builder they call are the product's
 * own. A headless surface has no real GPU, so `renderer.info` is asserted only
 * for the renderer the test hands through the production `perfRenderer` hook;
 * live GPU counts are browser evidence, recorded in `measurements.md`.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { Scene as ThreeScene, type Camera, type InterleavedBufferAttribute } from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { evaluateLayoutPlan, type LayoutVec2, type PlanEvaluation } from '@portfolio/layout-core';
import { prepareUnitRuntime } from '@portfolio/project-model/units';
import type { RuntimeScene } from '@portfolio/project-model';
import { buildPaperPlan } from '$lib/authoring/stage/paper-plan';
import { createCameraSession } from '$lib/authoring/stage/camera-session';
import { createPaperScene } from '$lib/authoring/stage/paper-scene';
import { buildCompiledLayoutCandidatePaper } from '$lib/authoring/adapters/layout/candidate-preview';
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import { createShadowInvalidation } from '$lib/render/shadow-invalidation';
import { previewCanvasRenderer, stageCanvasRenderer } from '$lib/render/canvas-renderers';
import { resolveSceneMaterial } from '$lib/museum/materials/scene-instance-material';
import { startStageCounting, type StageCounting } from '../../helpers/stage-counts';

vi.mock('@threlte/core', async () => import('./fixtures/threlte-counting-context'));

import { countingScene, countingShadowMap, threlteProbe } from './fixtures/threlte-counting-context';
import StagePaperCountingProbe from './fixtures/StagePaperCountingProbe.svelte';
import { openingSelection } from './fixtures/selection-entry';
import StageShadowTriggers from '$lib/authoring/stage/shell/StageShadowTriggers.svelte';
import { admitSource } from '$lib/authoring/stage/source-admission';
import {
	acquireEffectiveVariant,
	acquireMaterialVariant,
	deferredTextureReleaseCount,
	flushDeferredTextureReleases,
	releaseEffectiveVariant,
	releaseMaterialVariant
} from '$lib/render/resources/texture-store';
import { getMaterial } from '$lib/content/materials';
import {
	buildCountingSceneFixture,
	COUNTING_GRID,
	type CountingSceneFixture
} from './__fixtures__/counting-scene';

vi.mock('three', async (importOriginal) => {
	const actual = await importOriginal<typeof import('three')>();
	/** Only the GPU implementation is doubled; the managed wrapper stays production. */
	class StubWebGLRenderer {
		readonly info = { render: { calls: 4, triangles: 120 }, memory: { geometries: 2, textures: 1 } };
		render(): void {}
		dispose(): void {}
	}
	return { ...actual, WebGLRenderer: StubWebGLRenderer };
});

const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const RENDERER_INFO = { render: { calls: 4, triangles: 120 }, memory: { geometries: 2, textures: 1 } };

function shadowLights() {
	return [{ castShadow: true }];
}

let fixture: CountingSceneFixture;
let counting: StageCounting | null = null;

beforeAll(async () => {
	fixture = await buildCountingSceneFixture();
}, 60_000);

afterEach(() => {
	counting?.stop();
	counting = null;
	vi.restoreAllMocks();
	threlteProbe.reset();
});

function begin(): StageCounting {
	counting = startStageCounting();
	return counting;
}

/** The Plan identity an accepted Wall edit hands Paper. */
function acceptedPlan(): PlanEvaluation {
	const bounds = fixture.compiled.bounds!;
	const target: LayoutVec2 = [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[2] + bounds.max[2]) / 2];
	const result = evaluateLayoutPlan(
		fixture.compiled,
		{ cutHeightMeters: 1.2, depthMeters: 100, lateralSpanHalfWidthMeters: null, sourceKindFilter: null, reveal: [] },
		{ generationId: 'generation-e5-accepted', target, datumMeters: 0 }
	);
	if (result.kind !== 'evaluated') throw new Error(`the accepted Plan did not evaluate: ${JSON.stringify(result.issues)}`);
	return result.plan;
}

describe('E0 work counters through their production callers', () => {
	it('keeps the Scene fixture Opening inventory aligned with addOpenings', () => {
		expect(fixture.counts.openings).toBe(2 * COUNTING_GRID * COUNTING_GRID + 2 * COUNTING_GRID);
		expect(fixture.counts.openings).toBe(fixture.counts.walls);
		expect(fixture.counts.openings).toBe(fixture.document.openings.length);
	});

	it('resolves the Scene unit through the one runtime preparation path', () => {
		const seam = begin();
		const prepared = prepareUnitRuntime(fixture.project);
		expect(prepared.kind).toBe('ready');
		expect(seam.count('scene:resolve')).toBe(1);
	});

	it('resolves one Scene material per renderable entity', () => {
		const seam = begin();
		for (const entity of fixture.renderableEntities) {
			resolveSceneMaterial(fixture.project.units.scene.data, {
				materialInstanceId:
					entity.kind === 'light' || entity.kind === 'artwork' ? null : (entity.materialInstanceId ?? null),
				fallbackCatalogueId: 'plaster-warm'
			});
		}
		expect(seam.count('material:resolve')).toBe(fixture.counts.renderableEntities);
	});

	it('builds the Plan drawing once per Paper build', () => {
		const seam = begin();
		const drawing = buildPaperPlan(fixture.plan, fixture.compiled, fixture.footprints);
		expect(drawing.lines.length).toBeGreaterThan(0);
		expect(seam.count('paper:plan-build')).toBe(1);
	});

	it('realises Paper resources once per Scene build', () => {
		const seam = begin();
		const drawing = buildPaperPlan(fixture.plan, fixture.compiled, fixture.footprints);
		const resources = createPaperScene(drawing, [1280, 720]);
		try {
			expect(seam.count('paper:scene-build')).toBe(1);
			expect(resources.group.children.length).toBeGreaterThan(0);
		} finally {
			resources.dispose();
		}
	});

	it('builds one candidate Paper per distinct candidate, through the Layout builder', () => {
		const seam = begin();
		const wallIds = new Set(fixture.document.walls.map((wall) => wall.id));
		const paper = buildCompiledLayoutCandidatePaper(
			compileWallFirstLayoutGeometry(fixture.document).geometry, fixture.plan, 0, wallIds, new Set()
		);
		expect(paper.subject.segments.length).toBeGreaterThan(0);
		expect(seam.count('candidate:paper-build')).toBe(1);
		// The candidate's drawing is the same `buildPaperPlan` Paper draws.
		expect(seam.count('paper:plan-build')).toBe(1);
	});

	it('evaluates the Camera once per inspection-session evaluation', async () => {
		const seam = begin();
		const admitted = await admitSource(fixture.project, {
			acceptedRevision: fixture.project.acceptedRevision,
			sessionEpoch: 'session-e0-counting'
		});
		if (admitted.kind !== 'admitted') throw new Error(`the counting fixture was not admitted: ${admitted.kind}`);
		const session = createCameraSession({
			snapshot: admitted.snapshot,
			viewportId: 'viewport-e0',
			outputId: 'output-e0'
		});
		const evaluated = session.evaluate(RECT, 0);
		expect(evaluated.kind).toBe('evaluated');
		expect(seam.count('camera:evaluate')).toBe(1);
	});

	it('registers Stage and Preview surfaces through the production Canvas renderer callbacks', () => {
		const seam = begin();
		const stage = stageCanvasRenderer(document.createElement('canvas'));
		const preview = previewCanvasRenderer(document.createElement('canvas'));
		stage.render(new ThreeScene(), {} as Camera);
		stage.render(new ThreeScene(), {} as Camera);
		preview.render(new ThreeScene(), {} as Camera);
		expect(seam.count('render:stage-frame')).toBe(2);
		expect(seam.count('render:preview-frame')).toBe(1);
		expect(seam.surfaces()).toEqual(expect.arrayContaining(['stage', 'preview']));
		expect(seam.rendererInfo('stage')).toEqual({
			calls: 4,
			triangles: 120,
			geometries: 2,
			textures: 1
		});
		expect(seam.rendererInfo('preview')).toEqual({
			calls: 4,
			triangles: 120,
			geometries: 2,
			textures: 1
		});
	});

	it('mirrors a shadow pass that actually rendered', () => {
		const seam = begin();
		const renders: unknown[][] = [];
		const shadowMap = {
			autoUpdate: true,
			needsUpdate: false,
			render(lights: readonly unknown[], scene: unknown, camera: unknown): void {
				renders.push([lights, scene, camera]);
			}
		};
		const shadows = createShadowInvalidation({ shadowMap });
		try {
			shadows.invalidate();
			shadowMap.render(shadowLights(), new ThreeScene(), {});
			expect(shadows.stats().passes).toBe(1);
			expect(renders).toHaveLength(1);
			expect(seam.count('render:shadow-update')).toBe(1);
		} finally {
			shadows.dispose();
		}
	});

	it('counts texture variant acquires and the disposal the deferred release performs', () => {
		const seam = begin();
		const definition = getMaterial('plaster-warm');
		const maps = {};
		acquireMaterialVariant(definition, maps, 1, 1);
		acquireMaterialVariant(definition, maps, 1, 1);
		expect(seam.count('texture:variant-acquire')).toBe(2);
		releaseMaterialVariant(definition.id, 1, 1);
		expect(seam.count('texture:variant-dispose')).toBe(0);
		releaseMaterialVariant(definition.id, 1, 1);
		// E7/R2b: the last release marks the variant, and the idle point disposes it.
		expect(seam.count('texture:variant-dispose')).toBe(0);
		expect(deferredTextureReleaseCount()).toBe(1);
		flushDeferredTextureReleases();
		expect(seam.count('texture:variant-dispose')).toBe(1);

		const effective = resolveSceneMaterial(fixture.project.units.scene.data, {
			materialInstanceId: 'e0-look-textured',
			fallbackCatalogueId: 'plaster-warm'
		});
		acquireEffectiveVariant(effective, 3, 2);
		acquireEffectiveVariant(effective, 3, 2);
		releaseEffectiveVariant(effective.variantSeed, 3, 2);
		releaseEffectiveVariant(effective.variantSeed, 3, 2);
		expect(seam.count('texture:variant-acquire')).toBe(4);
		flushDeferredTextureReleases();
		expect(seam.count('texture:variant-dispose')).toBe(2);
	});
});

describe('E0 mounted Stage shell counting', () => {
	it('builds Paper through the mounted Stage Paper layer and rebuilds on a new revision', async () => {
		const seam = begin();
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(StagePaperCountingProbe, {
			target,
			props: { plan: fixture.plan, compiled: fixture.compiled, footprints: fixture.footprints }
		});
		try {
			flushSync();
			await tick();
			expect(seam.count('paper:plan-build')).toBe(1);
			expect(seam.count('paper:scene-build')).toBe(1);
			expect(threlteProbe.invalidationCount).toBeGreaterThan(0);
			component.bumpRevision();
			flushSync();
			await tick();
			expect(seam.count('paper:plan-build')).toBe(2);
			expect(seam.count('paper:scene-build')).toBe(2);
		} finally {
			await unmount(component);
			target.remove();
		}
	});

	it('keeps Paper geometry across selection, hover and zoom, and rebuilds once for an accepted Plan', async () => {
		const seam = begin();
		const openingId = fixture.compiled.walls.flatMap((wall) => wall.openings)[0]?.openingId;
		if (openingId === undefined) throw new Error('the counting fixture has no Opening');
		const selection = openingSelection(openingId);
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(StagePaperCountingProbe, {
			target,
			props: { plan: fixture.plan, compiled: fixture.compiled, footprints: fixture.footprints }
		});
		try {
			flushSync();
			await tick();
			expect(seam.count('paper:plan-build')).toBe(1);
			expect(seam.count('paper:scene-build')).toBe(1);
			const paper = countingScene.getObjectByName('StagePaper');
			if (paper === undefined) throw new Error('the mounted Paper group was not added to the Stage scene');
			const ink = () =>
				paper.children.filter((child): child is LineSegments2 => child instanceof LineSegments2);

			const bufferOf = (line: LineSegments2) => {
				const distance = line.geometry.getAttribute('instanceDistanceStart') as
					| InterleavedBufferAttribute
					| undefined;
				return {
					line,
					geometry: line.geometry,
					positions: (line.geometry.getAttribute('instanceStart') as InterleavedBufferAttribute).data,
					distances: distance === undefined ? null : distance.data
				};
			};
			const resources = ink().map(bufferOf);
			const visible = () => ink().reduce((sum, line) => sum + line.geometry.instanceCount, 0);
			const builtVisible = visible();
			const sameResources = () => {
				const now = ink().map(bufferOf);
				expect(now).toHaveLength(resources.length);
				for (const [index, entry] of now.entries()) {
					const before = resources[index]!;
					expect(entry.line).toBe(before.line);
					expect(entry.geometry).toBe(before.geometry);
					expect(entry.positions).toBe(before.positions);
					expect(entry.distances).toBe(before.distances);
				}
			};

			// Selection: the Opening's instances leave the batch in place. Through the
			// mounted caller no geometry, GPU buffer or object may be reallocated.
			component.select(selection);
			flushSync();
			await tick();
			expect(seam.count('paper:plan-build')).toBe(1);
			expect(seam.count('paper:scene-build')).toBe(1);
			expect(visible()).toBeLessThan(builtVisible);
			sameResources();

			// Deselection, hover and zoom (a viewport resolution change) keep it built.
			component.select(null);
			flushSync();
			await tick();
			expect(seam.count('paper:scene-build')).toBe(1);
			expect(visible()).toBe(builtVisible);
			sameResources();
			component.hoverOn(selection);
			flushSync();
			await tick();
			expect(seam.count('paper:scene-build')).toBe(1);
			component.hoverOn(null);
			component.resize(960);
			flushSync();
			await tick();
			expect(seam.count('paper:scene-build')).toBe(1);

			// An accepted edit hands Paper a new Plan, so the drawing is rebuilt once.
			component.applyPlan(acceptedPlan());
			flushSync();
			await tick();
			expect(seam.count('paper:plan-build')).toBe(2);
			expect(seam.count('paper:scene-build')).toBe(2);
		} finally {
			await unmount(component);
			target.remove();
		}
	});

	it('installs the shadow controller on the renderer the mounted Stage wiring receives', async () => {
		const seam = begin();
		const prepared = prepareUnitRuntime(fixture.project);
		if (prepared.kind !== 'ready') throw new Error(`the counting fixture did not prepare: ${prepared.kind}`);
		const scene: RuntimeScene = prepared.runtimeScene;
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(StageShadowTriggers, {
			target,
			props: {
				geometry: prepared.geometry,
				scene,
				modelUrls: null,
				formRenderRevision: 0
			}
		});
		try {
			flushSync();
			await tick();
			countingShadowMap.render(shadowLights(), new ThreeScene(), {});
			expect(seam.count('render:shadow-update')).toBe(1);
			// The model-plus-casting-light rule keeps per-frame updates for a model
			// whose arrival is not observable at this boundary.
			expect(countingShadowMap.autoUpdate).toBe(false);
		} finally {
			await unmount(component);
			target.remove();
		}
	});
});

describe('E0 observer-disabled behaviour', () => {
	it('does no counting when no observer is installed', () => {
		const seam = begin();
		seam.stop();
		const countsBefore = { ...seam.counts() };
		const drawing = buildPaperPlan(fixture.plan, fixture.compiled, fixture.footprints);
		const resources = createPaperScene(drawing, [1280, 720]);
		resources.dispose();
		const managed = stageCanvasRenderer(document.createElement('canvas'));
		managed.render(new ThreeScene(), {} as Camera);
		expect(seam.counts()).toEqual(countsBefore);
		expect(seam.rendererInfo('stage')).toBeNull();
		expect(globalThis).not.toHaveProperty('__BISKIQ_PERF_ON_RENDERER__');
	});
});
