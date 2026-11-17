/**
 * SL1 §2.2 — a section's outline is independent segments, not a polyline.
 *
 * `Line2` + `LineGeometry` connects its positions, so two disconnected cap loops — two
 * Walls with a gap between them — gained a diagonal between the end of one loop and
 * the start of the next. `LineSegments2` + `LineSegmentsGeometry` takes independent
 * pairs. This pins both halves: the construction yields exactly one pair per loop edge
 * (eight for two boxes, never a joining ninth), and the layer renders with the
 * segment geometry class.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { tagRenderIdentity } from '$lib/render/render-identity';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import { sectionMeshes } from '$lib/authoring/stage/slice/mesh-plane-section';
import { sectionEdgeSegments } from '$lib/authoring/stage/slice/slice-edges';

function boxAt(x: number): Mesh {
	const mesh = new Mesh(new BoxGeometry(1, 3, 1));
	mesh.position.set(x, 1, 0);
	mesh.updateMatrixWorld(true);
	return mesh;
}

describe('sectionEdgeSegments', () => {
	it('keeps two disconnected loops as independent pairs', () => {
		const left = tagRenderIdentity(boxAt(-3), 'wall', 'w1');
		const right = tagRenderIdentity(boxAt(3), 'wall', 'w2');
		const root = new Group();
		root.add(left, right);
		const pick = createScenePickSource();
		pick.registerLayout(root);

		const result = sectionMeshes(pick.sectionSources(), { normal: [0, -1, 0], constant: 1.2 });
		const loops = result.groups[0]!.loops;
		expect(loops).toHaveLength(2);

		const segments = sectionEdgeSegments(loops, result.basis, 1.2, [
			result.basis.origin[0],
			result.basis.origin[2]
		]);
		// One independent pair per loop edge — a connected polyline would still have the
		// same count, so the cross-gap check below is what catches the defect.
		const expectedSegments = loops.reduce((total, loop) => total + loop.points.length, 0);
		expect(segments).toHaveLength(expectedSegments);
		for (const segment of segments) {
			expect(segment.positions).toHaveLength(6);
			const start = new Vector3(segment.positions[0], segment.positions[1], segment.positions[2]);
			const end = new Vector3(segment.positions[3], segment.positions[4], segment.positions[5]);
			// Each edge lies wholly on one side of the gap (x = 0): a joining diagonal
			// would have endpoints on opposite sides.
			expect(Math.sign(start.x)).toBe(Math.sign(end.x));
			expect(Math.abs(start.x)).toBeGreaterThan(2);
		}
	});
});

describe('the layer renders segments with the segment class', () => {
	const layer = readFileSync(
		path.join(process.cwd(), 'src/lib/authoring/stage/shell/StageSliceLayer.svelte'),
		'utf8'
	);

	it('uses LineSegments2 + LineSegmentsGeometry, never the connected pair', () => {
		expect(layer).toContain("from 'three/examples/jsm/lines/LineSegments2.js'");
		expect(layer).toContain("from 'three/examples/jsm/lines/LineSegmentsGeometry.js'");
		expect(layer).toContain('new LineSegmentsGeometry()');
		// `LineGeometry` is a substring of `LineSegmentsGeometry`: name the class and
		// the import explicitly rather than the word.
		expect(layer).not.toContain('new LineGeometry()');
		expect(layer).not.toContain("from 'three/examples/jsm/lines/Line2.js'");
	});

	it('keeps the plan’s widths', () => {
		expect(layer).toContain('SLICE_INK.edgeWidth');
		expect(layer).toContain('SLICE_INK.selectedEdgeWidth');
	});
});
