/**
 * SL1 P1/P2 — the ink follows the cut, and the hidden selection stays visible.
 *
 * Two rules from §2.4, both of which are wiring rather than maths:
 *
 * - A contour or a Lift outline is **cut with its subject**: the layers hold the
 *   Canvas's own clipping array by reference, so a moved plane moves this ink too.
 * - A **wholly hidden** selected subject is drawn as a ghost, and *its* gold contour
 *   is unclipped — otherwise the Index could select a ceiling light and the creator
 *   would see nothing at all.
 *
 * The behaviour of the classifier is covered by `slice-ghost.test.ts` and the
 * selection resolver by `section-sources.test.ts`; this suite pins that the Canvas
 * and the layers actually use them, and that no ink claims the wrong side.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (file: string): string =>
	readFileSync(path.join(process.cwd(), `src/lib/authoring/stage/shell/${file}`), 'utf8');

describe('selection ink under a Slice', () => {
	const layer = source('StageSelectionLayer.svelte');

	it('clips its contours with the Canvas array, by reference', () => {
		expect(layer).toContain('useStageClip()');
		expect(layer).toContain('clippingPlanes: planes');
		// The shared array, never a clone: a moved plane must move this ink.
		expect(layer).toContain('stageClip.planes as Plane[]');
	});

	it('leaves a ghosted selection unclipped and clips every other tone', () => {
		expect(layer).toContain('unclippedSelection');
		// The rule, in one place: only the selection tone of a ghosted subject skips.
		expect(layer).toMatch(
			/if \(tone === 'selection' && unclippedSelection\) return undefined;/
		);
	});

	it('resolves the selected subject through the shared resolver', () => {
		expect(layer).toContain('selectionObjectsOf(scenePick, entry)');
	});
});

describe('the Canvas decides the ghost, the Layer draws it', () => {
	const canvas = source('StageCanvas.svelte');
	const layer = source('StageSliceLayer.svelte');

	it('classifies the selection against the live reading', () => {
		expect(canvas).toContain('subjectWhollyHidden(cut, subject)');
		expect(canvas).toContain('ghostSubjectOf(objects)');
	});

	it('passes the ghost to the Slice layer and the unclipped flag to selection', () => {
		expect(canvas).toContain('ghostSelection={sliceGhostSelection}');
		expect(canvas).toContain('unclippedSelection={sliceGhostSelection !== null}');
	});

	it('draws the ghost with no planes and no raycast', () => {
		const ghost = layer.slice(layer.indexOf('function addGhost'), layer.indexOf('let pending = 0'));
		expect(ghost).toContain('source.geometry');
		expect(ghost).toContain('opacity: SLICE_INK.ghostOpacity');
		// A clipped ghost would be invisible, which is the whole failure mode.
		expect(ghost).not.toContain('clippingPlanes');
		// `keep()` sets the overlay layer, removes the raycast and adds it to the root.
		expect(ghost).toContain('keep(mesh, () => {})');
	});
});

describe('the section stays off the Sheet-drag frame', () => {
	const layer = source('StageSliceLayer.svelte');

	it('decides through the tested rule, not a timer of its own', () => {
		expect(layer).toContain('decideCapAssembly(assembled, next)');
		expect(layer).toContain('SETTLE_MILLISECONDS');
	});

	it('draws only the plane while the reading moves', () => {
		const move = layer.slice(layer.indexOf('function moveReadingOnly'), layer.indexOf('$effect(() => {'));
		expect(move).toContain('addPlane(reading.cutY');
		// The expensive path must not appear on the drag frame.
		expect(move).not.toContain('sectionMeshes(');
	});
});

describe('Lift ink under a Slice', () => {
	const layer = source('StageLiftLayer.svelte');

	it('clips the outline and the ghost with the same array', () => {
		expect(layer).toContain('useStageClip()');
		expect(layer.match(/clippingPlanes: planes/g)?.length).toBe(2);
	});
});
