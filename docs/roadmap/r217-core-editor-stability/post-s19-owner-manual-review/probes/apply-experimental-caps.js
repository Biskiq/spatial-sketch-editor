/* PR #247 probe: swap the live Wall geometry for the throwaway capped builder, to see whether a
 * closed end is enough for the Wall to read as a solid. Session-only; nothing is saved. */
(async () => {
	const FS = window.__PROBE_FS ?? '/@fs/<absolute-checkout-path>';
	const P = window.__pr247;
	const builder = await import(`${window.__PROBE_CAP_FS ?? FS}/apps/editor/src/lib/layout/wall-mesh-builder.ts`);
	const adapter = await import(`${FS}/apps/editor/src/lib/render/wall-geometry-adapter.ts`);
	const core = await import(`${FS}/packages/layout-core/src/index.ts`);
	const document = { units: 'meters', formatVersion: 6, floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 }, junctions: [{ id: 'a', point: [0, 0] }, { id: 'b', point: [5, 0] }], walls: [{ id: 'w', startJunctionId: 'a', endJunctionId: 'b', thickness: 0.2, height: 3, centerline: { kind: 'line' } }], rooms: [], openings: [], objects: [] };
	const compiled = core.compileWallFirstLayoutGeometry(document);
	const ends = core.legJoinsByWall(compiled.geometry.junctions).get('w');
	const built = builder.buildStandaloneWallMesh(compiled.geometry.walls[0], 0, ends, { classifySurface: () => 'wall' });
	const wall = P.objects().walls[0];
	const existing = Array.isArray(wall.material) ? wall.material[0] : wall.material;
	const adapted = adapter.toWallBufferGeometry(built.mesh, () => ({ material: existing }));
	wall.geometry = adapted.geometry;
	wall.material = adapted.materials;
	P.renderer.shadowMap.needsUpdate = true;
	return JSON.stringify({ triangles: built.mesh.indices.length / 3, position: adapted.geometry.boundingBox ?? null });
})();
