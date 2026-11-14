/**
 * E8 — a transform-resolved summary of every drawn mesh under one model root.
 *
 * World-space sums (not raw buffers) so a geometry built at size and a shared
 * unit geometry scaled by its mesh compare equal within float tolerance. The
 * baseline `model-path-baseline.json` was recorded with this function from the
 * retired `AssetModel`/`AssetFallback` path at `main` `bd7bfb09`.
 */
import { Box3, Matrix3, Mesh, Vector3, type Material, type MeshStandardMaterial, type Object3D } from 'three';

export type MeshSummary = {
	readonly vertices: number;
	readonly triangles: number;
	readonly bounds: [number, number, number, number, number, number];
	readonly positionSum: [number, number, number];
	readonly normalSum: [number, number, number];
	readonly uvSum: [number, number];
	readonly materials: { color: string; roughness: number; metalness: number; wireframe: boolean; toneMapped: boolean }[];
	readonly castShadow: boolean;
	readonly receiveShadow: boolean;
};

export function summarizeMeshes(root: Object3D): MeshSummary[] {
	root.updateWorldMatrix(true, true);
	const meshes: MeshSummary[] = [];
	root.traverseVisible((node) => {
		if (!(node instanceof Mesh)) return;
		const position = node.geometry.getAttribute('position');
		const normal = node.geometry.getAttribute('normal');
		const uv = node.geometry.getAttribute('uv');
		const normalMatrix = new Matrix3().getNormalMatrix(node.matrixWorld);
		const p = new Vector3();
		const n = new Vector3();
		const ps: [number, number, number] = [0, 0, 0];
		const ns: [number, number, number] = [0, 0, 0];
		const us: [number, number] = [0, 0];
		for (let i = 0; i < position.count; i += 1) {
			p.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
			ps[0] += p.x; ps[1] += p.y; ps[2] += p.z;
			if (normal) {
				n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
				ns[0] += n.x; ns[1] += n.y; ns[2] += n.z;
			}
			if (uv) { us[0] += uv.getX(i); us[1] += uv.getY(i); }
		}
		const box = new Box3().setFromObject(node);
		const list = (Array.isArray(node.material) ? node.material : [node.material]) as Material[];
		meshes.push({
			vertices: position.count,
			triangles: Math.floor((node.geometry.index?.count ?? position.count) / 3),
			bounds: [...box.min.toArray(), ...box.max.toArray()] as MeshSummary['bounds'],
			positionSum: ps,
			normalSum: ns,
			uvSum: us,
			materials: list.map((material) => {
				const standard = material as MeshStandardMaterial;
				return {
					color: standard.color.getHexString(),
					roughness: standard.roughness,
					metalness: standard.metalness,
					wireframe: standard.wireframe,
					toneMapped: standard.toneMapped
				};
			}),
			castShadow: node.castShadow,
			receiveShadow: node.receiveShadow
		});
	});
	return meshes;
}
