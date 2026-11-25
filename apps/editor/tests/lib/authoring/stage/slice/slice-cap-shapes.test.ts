/**
 * SL1 P2 — a cap's holes belong to the outer that contains them.
 *
 * `sectionMeshes` returns one flat loop list. The fill needs the containment
 * mapping back, and the renderer used to give **every** hole to **every** outer:
 * with two disjoint solids each inherited the other's hole, so a filled face grew a
 * void outside itself and disagreed with the drawn section edges.
 *
 * `capFillsOf` is the one call the layer makes, and it delegates to
 * `loopsToPolygons`. These cases pin the mapping at that seam, with two outers and
 * two independent holes plus a stray hole that contains nothing.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { capFillsOf } from '$lib/authoring/stage/slice/slice-cap-shapes';
import type { SectionLoop, SectionPoint } from '$lib/authoring/stage/slice/mesh-plane-section';
import { EDITOR_ROOT } from '../../../../helpers/import-closure';

/** A closed loop of a rectangle, with its role and winding area. */
function loop(role: 'outer' | 'hole', minX: number, minZ: number, maxX: number, maxZ: number): SectionLoop {
	const points: SectionPoint[] = [
		[minX, minZ],
		[maxX, minZ],
		[maxX, maxZ],
		[minX, maxZ]
	];
	const signedArea = ((maxX - minX) * (maxZ - minZ)) * (role === 'outer' ? 1 : -1);
	return { role, points, edgeIdentities: ['wall:w1', 'wall:w1', 'wall:w1', 'wall:w1'], signedArea };
}

describe('capFillsOf: each outer keeps only its own holes', () => {
	it('parents two holes to their two outers', () => {
		const fills = capFillsOf([
			loop('outer', 0, 0, 4, 4),
			loop('hole', 1, 1, 2, 2),
			loop('outer', 10, 0, 14, 4),
			loop('hole', 11, 1, 12, 2)
		]);

		expect(fills).toHaveLength(2);
		expect(fills[0]!.holes).toHaveLength(1);
		expect(fills[1]!.holes).toHaveLength(1);
		// Each hole is the one inside its own outer — the defect gave both to both.
		expect(fills[0]!.holes[0]![0]).toEqual([1, 1]);
		expect(fills[1]!.holes[0]![0]).toEqual([11, 1]);
		expect(fills[0]!.outer[0]).toEqual([0, 0]);
		expect(fills[1]!.outer[0]).toEqual([10, 0]);
	});

	it('gives a hole to the smallest outer that contains it', () => {
		const fills = capFillsOf([
			loop('outer', 0, 0, 10, 10),
			loop('outer', 2, 2, 6, 6),
			loop('hole', 3, 3, 4, 4)
		]);

		expect(fills).toHaveLength(2);
		expect(fills[0]!.holes).toHaveLength(0);
		expect(fills[1]!.holes).toHaveLength(1);
		expect(fills[1]!.outer[0]).toEqual([2, 2]);
	});

	it('drops a hole that no outer contains', () => {
		const fills = capFillsOf([loop('outer', 0, 0, 4, 4), loop('hole', 100, 100, 101, 101)]);

		expect(fills).toHaveLength(1);
		expect(fills[0]!.holes).toHaveLength(0);
	});

	it('fills an outer with no holes and returns nothing for a hole-only section', () => {
		expect(capFillsOf([loop('outer', 0, 0, 1, 1)])[0]!.holes).toHaveLength(0);
		expect(capFillsOf([loop('hole', 0, 0, 1, 1)])).toHaveLength(0);
		expect(capFillsOf([])).toHaveLength(0);
	});

	it('is the call the Slice layer makes, not a per-outer hole scan', () => {
		const layer = readFileSync(
			path.join(EDITOR_ROOT, 'src/lib/authoring/stage/shell/StageSliceLayer.svelte'),
			'utf8'
		);
		// The layer consumes the containment mapping ...
		expect(layer).toContain('capFillsOf(');
		expect(layer).not.toContain("loops.filter((candidate) => candidate.role === 'hole')");
	});
});
