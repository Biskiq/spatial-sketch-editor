/**
 * SL1 lifecycle and the two wiring gaps the review found.
 *
 * The reading is a **module singleton**, so "it ends with the project and with the
 * lens" is not a property of the store — it is a property of every place that is
 * allowed to end it. A missed call carried a cut into the next project, or left the
 * pill offering a cut over an uncut Stage; the route is the only place that can be
 * checked for it.
 *
 * The other two are session wiring rather than maths: the §9 refusal on a Stage press
 * while Slice is armed, and the clip applier that requests a frame even when the ink
 * layer is unmounted (Look Through).
 */
import { LIFECYCLE_ORDER } from '$lib/authoring/workspace/lifecycle-order';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
	readFileSync(path.join(process.cwd(), relative), 'utf8');
const route = read('src/routes/project/[projectId]/spatial/+page.svelte');

const readings = read('src/lib/authoring/stage/readings/layout-readings-feature.svelte.ts');
const lifetime = read('src/lib/authoring/stage/readings/layout-readings-lifecycle.ts');
const lift = read('src/lib/authoring/stage/readings/lift-host.svelte.ts');
const slice = read('src/lib/authoring/stage/readings/slice-host.svelte.ts');

describe('the reading ends with the project and with the lens', () => {
	it('clears the reading wherever Lift is cleared', () => {
		expect(lift).toContain('clear: () => interiorLift.clear()');
		expect(slice).toMatch(/function clear\(\): void \{\s*sliceDraw\.disarm\(\);\s*sliceReading\.clear\(\);\s*setResolvedSlice\(null\);/);
		expect(lifetime).toMatch(/function clearReadings\(\): void \{\s*input\.clearLift\(\);\s*input\.clearSlice\(\);\s*input\.resetCutaway\(\);/);
		expect(lifetime).toMatch(/function reset\(\): void \{\s*input\.clearFace\(\);\s*clearReadings\(\);/);
		expect(readings).toContain('clearLift: lift.clear');
		expect(readings).toContain('clearSlice: slice.clear');
		expect(readings).toContain('resetPresentation: { reset: lifetime.reset }');
		expect(readings).toContain("leaveProject: { 'clear-readings': lifetime.clearReadings }");
		expect(route).toContain('installLeaveProject(lifecycleCell);');
		const lifecycle = read('src/lib/authoring/stage/route/core-lifecycle-steps.svelte.ts');
		expect(lifecycle).toContain('$effect(() => () => cell.get().leaveProject())');
		expect(LIFECYCLE_ORDER.resetPresentation).toContain('layout-readings:reset');
		expect(LIFECYCLE_ORDER.leaveProject).toContain('layout-readings:clear-readings');
	});

	it('ends the reading when the lens leaves World', () => {
		const at = slice.indexOf("if (input.lens() === 'world') return;");
		expect(at).toBeGreaterThan(0);
		const window = slice.slice(at, at + 500);
		expect(window).toMatch(/if \(!sliceReading\.isActive\(\)\) return;\s*clear\(\);/);
		expect(slice).toMatch(/function clear\(\): void \{[\s\S]{0,140}setResolvedSlice\(null\);/);
		expect(route).toContain('readings.attachTeardown()');
	});

	it('clears the pick mirror at teardown and on a replaced project', () => {
		expect(readings).toContain('clearSlice: slice.clear');
		expect(lifetime).toContain('input.clearSlice()');
		expect(lifetime).toContain('clearReadings()');
		expect(slice).toContain('setResolvedSlice(null)');
	});
});

describe('a Stage press while Slice is armed is refused in words', () => {
	const input = read('src/lib/authoring/stage/route/stage-input.svelte.ts');

	it('uses the plan’s sentence and leaves the document alone', () => {
		// The sentence is the predicate's, and the predicate is the armed tool — a live
		// cut under Select must stay editable (see `slice-press-refusal.test.ts`).
		const at = input.indexOf('slicePressRefusal(input.sliceToolArmed())');
		const window = input.slice(at, at + 500);
		expect(window).toContain('input.press.refuse(event.pointerId)');
		expect(window).toContain('input.onNotice(sliceRefusal)');
		expect(window).not.toContain('pointerIntent');
		expect(input).not.toContain('sliceActive()');
	});

	it('is asked before any adapter or host tool sees the press', () => {
		const sliceAt = input.indexOf('slicePressRefusal(input.sliceToolArmed())');
		const adapterAt = input.indexOf('const claimAdapterPress');
		expect(sliceAt).toBeGreaterThan(0);
		expect(adapterAt).toBeGreaterThan(sliceAt);
	});
});

describe('Slice is a reading, not a landed task', () => {
	const shell = read('src/lib/authoring/stage/route/stage-shell-state.svelte.ts');

	it('does not bounce the armed tool back to Select', () => {
		// Slice's registry row is 'landed' and it opens no task; without this exemption
		// the completion effect reset it to Select as soon as it was armed.
		expect(shell).toContain("if (activeWorldTool === 'slice') return;");
	});
});

describe('the planes are applied with a frame request', () => {
	const canvas = read('src/lib/authoring/stage/shell/StageCanvas.svelte');
	const applier = read('src/lib/authoring/stage/shell/StageClipPlanes.svelte');

	it('keeps the one clip instance before the resources', () => {
		expect(canvas.indexOf('const stageClip = setStageClip(createStageClip())')).toBeGreaterThan(0);
		expect(canvas.indexOf('const resources = provideRenderResources')).toBeGreaterThan(
			canvas.indexOf('const stageClip = setStageClip(createStageClip())')
		);
	});

	it('applies inside the Canvas and invalidates on every change', () => {
		expect(canvas).toContain('<StageClipPlanes clip={stageClip} reading={resolvedSlice ?? null} />');
		expect(applier).toContain('clip.apply(reading ?? null)');
		expect(applier).toContain('invalidate()');
	});
});

describe('the drawn proposal is disposed, never redrawn, at teardown', () => {
	const layer = read('src/lib/authoring/stage/shell/StageSliceLayer.svelte');

	it('the destroy effect clears the draft ink instead of drawing it again', () => {
		const at = layer.indexOf('$effect(() => () => {');
		expect(at).toBeGreaterThan(0);
		const teardown = layer.slice(at, layer.indexOf('});', at));
		expect(teardown).toContain('clearDraft()');
		expect(teardown).not.toContain('drawDraft()');
	});

	it('drawDraft starts by clearing, so a prop change never leaks the previous proposal', () => {
		const at = layer.indexOf('function drawDraft(): void {');
		expect(layer.slice(at, at + 120)).toContain('clearDraft();');
	});
});
