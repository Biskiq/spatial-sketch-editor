import type { CompiledRegion, LayoutRegionSurfaceRef } from '@portfolio/layout-core';
import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';

type RegionSurface = LayoutRegionSurfaceRef['face'];

/** Triangulate the compiled, outward-wound slab faces and keep their attribution. */
export function buildRegionMeshGeometry(
	region: CompiledRegion,
	origin: readonly [number, number, number] = [0, 0, 0]
): BufferGeometry {
	const geometry = new BufferGeometry();
	const positions: number[] = [];
	const normals: number[] = [];
	const surfaceByTriangle: RegionSurface[] = [];
	for (const { polygon, normal, surface } of region.faces) {
		const start = positions.length / 3;
		const triangles = surface === 'edge' ? [[0, 1, 2], [0, 2, 3]] : ShapeUtils.triangulateShape(
			polygon.map(([x, , z]) => new Vector2(x - polygon[0]![0], z - polygon[0]![2])),
			[]
		);
		for (const triangle of triangles) {
			const [i, j, k] = triangle as [number, number, number];
			const [a, b, c] = [polygon[i]!, polygon[j]!, polygon[k]!];
			const windingY = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
			const reverse = windingY * normal[1] < 0;
			for (const [x, y, z] of [a, reverse ? c : b, reverse ? b : c]) {
				positions.push(x - origin[0], y - origin[1], z - origin[2]);
			}
			normals.push(...normal, ...normal, ...normal);
			surfaceByTriangle.push(surface);
		}
		geometry.addGroup(start, positions.length / 3 - start, surface === 'top' ? 0 : surface === 'underside' ? 1 : 2);
	}
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
	geometry.userData.regionSurfaces = surfaceByTriangle;
	return geometry;
}

export function regionSurfaceOf(geometry: BufferGeometry, faceIndex: number): RegionSurface | undefined {
	return (geometry.userData.regionSurfaces as readonly RegionSurface[] | undefined)?.[faceIndex];
}
