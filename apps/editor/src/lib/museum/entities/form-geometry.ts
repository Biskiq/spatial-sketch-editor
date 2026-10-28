/**
 * The native-form render derivative: one canonical `FormMesh` to one
 * `THREE.BufferGeometry`.
 *
 * The kernel deliberately emits no normals and no UVs, so this adapter is the
 * only place both are derived:
 *
 * - **Normals** are `computeVertexNormals` over the kernel's indexed topology.
 *   Cap vertices are separate from side vertices and side vertices are
 *   duplicated at straight anchors, so caps stay flat and curves stay smooth
 *   with no extra split here.
 * - **UVs are metres.** Caps use local `(x, z)` for a plan form and `(x, y)` for
 *   an elevation form; sides use the profile arclength and the extrusion axis.
 *   With metre UVs, `SceneInstanceMaterial` tiling at real scale is just
 *   `repeat = 1 / tileSize`, which is what `surfaceSize = [1, 1]` produces.
 *
 * The arclength of a side vertex is read from the base-cap ring the kernel
 * already emitted (the first `profilePointCount` vertices are exactly the
 * profile points), then matched to the side vertex by its profile-plane
 * position. The kernel builds both from the same expressions, so the match is
 * exact; an unmatched vertex falls back to the planar projection rather than
 * producing a NaN.
 *
 * The geometry owns copies of every mutable buffer it hands to the GPU; the
 * cached `FormMesh` is shared and must stay immutable. Dispose the geometry
 * when the source changes or the entity unmounts.
 *
 * Known texture seam: side UVs are the profile arclength, so on a closed ring
 * the closing quad runs from the last arclength back to `0` and mirrors its
 * texture across that one quad. Every other side quad is continuous; fixing the
 * seam would require duplicating the closing ring's vertices and would break
 * normal sharing there.
 */
import { BufferAttribute, BufferGeometry, Float32BufferAttribute } from 'three';
import type { FormMesh } from '@portfolio/geometry-core';
import type { SceneFormPlane } from '$lib/content/scene';

export function buildFormGeometry(mesh: FormMesh, plane: SceneFormPlane): BufferGeometry {
	const source = mesh.positions;
	const vertexCount = source.length / 3;
	const profilePoints = mesh.segmentKeys.length;
	// The kernel emits the base-cap ring, then the top-cap ring, then the side
	// ring(s); a form is only renderable when that layout is present.
	if (profilePoints < 3 || vertexCount < profilePoints * 2) {
		throw new Error('A form mesh needs a base and a top cap before it can be rendered.');
	}

	const positions = new Float32Array(source.length);
	for (let index = 0; index < source.length; index += 1) positions[index] = source[index]!;

	const uvs = new Float32Array(vertexCount * 2);
	const arclength = new Float64Array(profilePoints + 1);
	const ringIndex = new Map<string, number>();
	for (let point = 0; point < profilePoints; point += 1) {
		if (point > 0) {
			const previous = point - 1;
			const du = source[point * 3]! - source[previous * 3]!;
			const dv = plane === 'plan'
				? source[point * 3 + 2]! - source[previous * 3 + 2]!
				: source[point * 3 + 1]! - source[previous * 3 + 1]!;
			arclength[point] = arclength[previous]! + Math.sqrt(du * du + dv * dv);
		}
		ringIndex.set(profileKey(source, point, plane), point);
	}
	const closingDu = source[0]! - source[(profilePoints - 1) * 3]!;
	const closingDv = plane === 'plan'
		? source[2]! - source[(profilePoints - 1) * 3 + 2]!
		: source[1]! - source[(profilePoints - 1) * 3 + 1]!;
	arclength[profilePoints] = arclength[profilePoints - 1]! + Math.sqrt(closingDu * closingDu + closingDv * closingDv);

	const capVertexCount = profilePoints * 2;
	for (let vertex = 0; vertex < vertexCount; vertex += 1) {
		const x = source[vertex * 3]!;
		const y = source[vertex * 3 + 1]!;
		const z = source[vertex * 3 + 2]!;
		let u = x;
		let v = plane === 'plan' ? z : y;
		if (vertex >= capVertexCount) {
			const point = ringIndex.get(profileKey(source, vertex, plane));
			if (point !== undefined) {
				u = arclength[point]!;
				v = plane === 'plan' ? y : z;
			}
		}
		uvs[vertex * 2] = u;
		uvs[vertex * 2 + 1] = v;
	}

	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
	geometry.setIndex(new BufferAttribute(new Uint32Array(mesh.indices), 1));
	geometry.computeVertexNormals();
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
	geometry.userData.formRegions = mesh.regions;
	return geometry;
}

/**
 * Profile-plane position key of one vertex.
 *
 * Both `Map` keys and lookups come from the same `Float64` values, so this is an
 * exact identity test, not a tolerance match.
 */
function profileKey(positions: Float64Array, vertex: number, plane: SceneFormPlane): string {
	return plane === 'plan'
		? `${positions[vertex * 3]}|${positions[vertex * 3 + 2]}`
		: `${positions[vertex * 3]}|${positions[vertex * 3 + 1]}`;
}
