import { BufferAttribute, BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	createClosedWallCircleDocument,
	legJoinsByWall
} from '@portfolio/layout-core';
import {
	contourPolylines,
	visibleIdentityContour
} from '$lib/authoring/stage/shell/stage-outline';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';

function circularBody(): BufferGeometry {
	const created = createClosedWallCircleDocument({
		center: [0, 0],
		rim: [5, 0],
		junctionId: 'j-circle',
		wallId: 'wall-circle',
		thickness: 0.2,
		height: 3
	});
	if (created.kind !== 'success') throw new Error(JSON.stringify(created.rejection));
	const geometry = compileWallFirstLayoutGeometry(created.document).geometry;
	const wall = geometry.walls[0]!;
	const joins = legJoinsByWall(geometry.junctions);
	const built = buildStandaloneWallMesh(wall, 0, joins.get(wall.wallId) ?? null);
	const mesh = built.mesh!;
	const body = new BufferGeometry();
	body.setAttribute('position', new BufferAttribute(new Float32Array(mesh.positions), 3));
	body.setIndex(Array.from(mesh.indices));
	return body;
}

describe('closed circular Wall selection contour', () => {
	it('keeps both rims continuous from above, obliquely and inside', () => {
		const geometry = circularBody();
		const triangles = geometry.toNonIndexed();
		try {
			for (const eye of [[0, 8, 0], [9, 6, 9], [0, 1.6, 0]] as const) {
				const contour = visibleIdentityContour(triangles.getAttribute('position').array, eye);
				const chains = contourPolylines(contour);
				const rims = chains.filter((chain) => {
					const count = chain.length / 3;
					return count > 100 &&
						Math.hypot(chain[0]! - chain[chain.length - 3]!, chain[2]! - chain[chain.length - 1]!) < 1e-6;
				});
				// A closed Wall has exactly two closed rims, both continuous through
				// the canonical seam. A split seam would produce shorter/open chains.
				expect(rims).toHaveLength(2);
				expect(contour.length).toBeGreaterThan(0);
			}
		} finally {
			triangles.dispose();
			geometry.dispose();
		}
	});
});
