import { Box3, Mesh, Vector3, type Material, type Object3D } from 'three';
import type { AssetMetrics } from '$lib/types/assets';

function materialsFor(mesh: Mesh): Material[] {
	return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/**
 * Bounds, counts and animation names of a model's hierarchy. Read-only: it never
 * clones, styles or disposes anything. Instances are realized by
 * `$lib/render/models/model-realization`, which owns every surface.
 */
export function inspectModel(scene: Object3D, animationNames: string[]): {
  bounds: Box3;
  metrics: AssetMetrics;
} {
  scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(scene);
  const dimensions = bounds.getSize(new Vector3());
  const materials = new Set<string>();
  let meshCount = 0;
  let triangleCount = 0;

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshCount += 1;
    for (const material of materialsFor(object)) materials.add(material.uuid);

    const indexCount = object.geometry.index?.count;
    const positionCount = object.geometry.getAttribute('position')?.count ?? 0;
    triangleCount += Math.floor((indexCount ?? positionCount) / 3);
  });

  return {
    bounds,
    metrics: {
      dimensions: [dimensions.x, dimensions.y, dimensions.z],
      meshCount,
      materialCount: materials.size,
      triangleCount,
      animationNames
    }
  };
}
