/**
 * The Plan render harness's own contract (T2b).
 *
 * A harness that quietly rendered a copy of the component, ignored its props, or
 * read the wrong stylesheet would make every replacement test built on it green
 * for the wrong reason — so the harness is proven before it is trusted: the
 * markup below is the *shipped* `PlanSvg.svelte`, driven only through the props
 * the app passes, and it answers to changes in those props.
 */
import { describe, expect, it } from 'vitest';
import {
	componentPath,
	componentRule,
	elementByTag,
	elementsByTag,
	elementsWithClass,
	emittedClasses,
	parseMarkup,
	planSvgRule,
	planSvgSelectors,
	planViewFixture,
	renderPlanSvg,
	renderPlanSvgMarkup
} from '../../helpers/plan-render-harness';
import { compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';
import { createEmptyWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import { buildPlanRenderModel } from '$lib/layout/plan-render-model';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';

function document(): LayoutDocumentWallFirst {
	const layout = createEmptyWallFirstLayoutDocument();
	layout.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [4, 0] }
	];
	layout.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' }
		}
	];
	return layout;
}

function model(): ReturnType<typeof buildPlanRenderModel> {
	return buildPlanRenderModel(compileWallFirstLayoutGeometry(document()).geometry);
}

describe('plan render harness — it renders the real component', () => {
	it('emits the shipped PlanSvg markup for a built model', () => {
		const elements = renderPlanSvg({ model: model() });
		expect(elementsWithClass(elements, 'plan-model')).toHaveLength(1);
		// The Wall's band and its drafting profile are both emitted, with the
		// product classes rather than the compiler's scope hash.
		const classes = emittedClasses(elements);
		expect([...classes].filter((name) => name.startsWith('wall-')).sort()).toEqual([
			'wall-casing',
			'wall-line'
		]);
		expect([...classes].some((name) => name.startsWith('svelte-'))).toBe(false);
	});

	it('answers to the planView prop, so it is not a canned render', () => {
		const pointsAt = (pixelsPerMeter: number) =>
			elementsWithClass(
				renderPlanSvg({ model: model(), planView: planViewFixture({ pixelsPerMeter }) }),
				'wall-line'
			)[0]?.attrs.points;
		const close = pointsAt(20);
		const far = pointsAt(80);
		expect(close).toBeTruthy();
		expect(far).toBeTruthy();
		expect(close).not.toBe(far);
		// Screen-space points come from the projection the app passes in: a fixture
		// viewport is the only thing that moved.
		expect(planViewFixture({ pixelsPerMeter: 10 }).width).toBe(800);
	});

	it('emits self-closing SVG elements as parseable nodes with their text', () => {
		const markup = renderPlanSvgMarkup({ model: model() });
		expect(markup).toContain('<polyline');
		const elements = parseMarkup('<g class="a"><text class="b">Room A</text><circle class="c"/></g>');
		expect(elements.map((element) => element.tag)).toEqual(['g', 'text', 'circle']);
		expect(elements[1].text).toBe('Room A');
		expect(elements[2].depth).toBe(1);
		expect(elements[2].ancestors).toEqual(['a']);
		expect(elementByTag(elements, 'circle')?.classes).toEqual(['c']);
		expect(elementsByTag(elements, 'text')).toHaveLength(1);
	});
});

describe('plan render harness — it reads the real stylesheet', () => {
	it('finds a rule that follows a comment, and flattens at-rule bodies', () => {
		// The depth-aware scan is the point: a rule directly after a block comment
		// must still be found, and a nested `@media` must not hide one.
		expect(planSvgSelectors()).toContain('.scene-footprint');
		expect(planSvgRule('.scene-footprint').fill).toBe('var(--plan-footprint-fill, none)');
		expect(planSvgRule('.scene-footprint.selected').fill).toBe('rgb(47 140 255 / 24%)');
		// An unknown selector is empty, not a throw.
		expect(planSvgRule('.not-a-real-class')).toEqual({});
	});

	it('reads each paint surface from its own compiled stylesheet', () => {
		const camera = componentPath('editor/camera-plan/CameraPlanViewport.svelte');
		// The Camera Plan declares its own footprint vocabulary; the Layout Plan
		// declares the defaults and no hooks, which is why its footprints read as
		// continuous, fill-free ink.
		expect(componentRule(camera, '.plan-canvas')['--plan-footprint-dasharray']).toBe('5 4');
		expect(componentRule(camera, '.plan-canvas')['--plan-footprint-fill']).toBe(
			'var(--editor-camera-footprint-fill)'
		);
		expect(planSvgSelectors().some((selector) => selector.startsWith('--plan-footprint'))).toBe(
			false
		);
	});
});
