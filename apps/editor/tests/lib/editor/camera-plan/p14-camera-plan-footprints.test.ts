import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const LIB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../src/lib');

function readLibSource(relativePath: string): string {
	return readFileSync(resolve(LIB_ROOT, relativePath), 'utf8');
}

describe('P14 Camera Plan passive footprints', () => {
	it('wires the live Scene projection into both render-model branches', () => {
		const source = readLibSource('editor/camera-plan/CameraPlanViewport.svelte');
		const projection = source.match(/const sceneProjection = \$derived\.by\(\(\) => \{[\s\S]*?\n\t\}\);/u)?.[0];

		expect(projection).toBeTruthy();
		expect(projection).toContain('void preview.previewVersion;');
		expect(projection).toContain('buildPlanSceneFootprintProjection(');
		expect(projection).toContain('getEffectiveScale: getEffectiveSceneScale');
		expect(source).toContain('buildPlanRenderModel(preview.geometry, undefined, undefined, sceneProjection)');
		expect(source).toContain('}, undefined, sceneProjection);');
	});

	it('keeps Camera-only footprint styling on the Camera canvas', () => {
		const cameraPlan = readLibSource('editor/camera-plan/CameraPlanViewport.svelte');
		const planSvg = readLibSource('editor/layout/PlanSvg.svelte');

		expect(cameraPlan).toContain('--plan-footprint-stroke: var(--editor-camera-footprint-stroke)');
		expect(cameraPlan).toContain('--plan-footprint-fill: var(--editor-camera-footprint-fill)');
		expect(cameraPlan).toContain('--plan-layout-object-stroke: var(--editor-camera-footprint-stroke)');
		expect(cameraPlan).toContain('--plan-layout-object-fill: var(--editor-camera-footprint-fill)');
		expect(cameraPlan).toContain('--plan-layout-object-dasharray: 5 4');
		// P23.13 S9 changed the *Layout* defaults behind these hooks (the passive
		// Scene there is continuous, fill-free ink) and put the shared class's
		// dashes behind a hook. What this test protects is the Camera Plan's own
		// footprint look, so the Camera canvas is pinned as setting every hook it
		// relies on — fill, stroke and dash.
		expect(cameraPlan).toContain('--plan-footprint-dasharray: 5 4');
		expect(planSvg).toContain('var(--plan-footprint-fill, none)');
		expect(planSvg).toContain('var(--plan-footprint-dasharray, none)');
		expect(planSvg).toContain('var(--plan-footprint-stroke, var(--editor-plan-muted))');
		expect(planSvg).toContain('var(--plan-layout-object-fill, var(--editor-plan-object-fill))');
		expect(planSvg).toContain('var(--plan-layout-object-stroke, var(--editor-plan-object-stroke))');
		expect(planSvg).toContain('var(--plan-layout-object-dasharray, none)');
		expect(planSvg).toContain('var(--plan-layout-object-fill, var(--editor-plan-readonly-fill))');
		expect(planSvg).toContain('var(--plan-layout-object-dasharray, 5 3)');
		expect(planSvg).not.toContain('--editor-camera-footprint-');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P3 structural visual contracts', () => {
	it('keeps Camera Plan on distinct paper while reusing the shared opaque room projection', () => {
		const cameraPlan = readLibSource('editor/camera-plan/CameraPlanViewport.svelte');
		const scenePlan = readLibSource('editor/layout/LayoutPlanViewport.svelte');

		expect(scenePlan).toContain('background: var(--editor-plan-canvas-bg)');
		expect(cameraPlan).toContain('background: var(--editor-camera-plan-canvas-bg)');
		expect(cameraPlan).toContain('--editor-plan-room-bg: var(--editor-camera-plan-room-bg)');
	});
	it('keeps P14 footprint aliases surface-scoped and Scene-safe', () => {
		const tokens = readLibSource('editor/styles/plan.css');
		const cameraPlan = readLibSource('editor/camera-plan/CameraPlanViewport.svelte');
		const planSvg = readLibSource('editor/layout/PlanSvg.svelte');

		expect(tokens).toContain('--editor-camera-footprint-stroke: var(--editor-plan-muted);');
		expect(tokens).toContain('--editor-camera-footprint-fill: rgb(146 144 138 / 12%);');
		expect(planSvg).not.toContain('--editor-camera-footprint-stroke');
		expect(planSvg).not.toContain('--editor-camera-footprint-fill');
	});
});
