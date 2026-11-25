/**
 * E6/R3 — the retained Room representation.
 *
 * The obligations, as counts and world vertices rather than screenshots:
 *
 * - **Structural parity.** For a fixed fixture, every Room's floor, floor-shadow
 *   and ceiling world vertices and material properties equal what the removed
 *   `VisitorLayoutShell` template produced. The reference below is that template,
 *   call for call; the shell no longer contains it.
 * - **Retention by `cacheKey`.** An unchanged Room keeps its group, buffers and
 *   transforms; an edit rebuilds only the Rooms whose key moved, two
 *   triangulations each; a departed Room is released in the same update.
 * - **Three materials.** Every Room draws the same three store instances, so 196
 *   Rooms hold three materials, not 588.
 * - **Identity, visibility and disposal.** `objectOf` returns the tagged floor;
 *   the shadow catcher is never picked; hidden Rooms stay hidden across a
 *   rebuild; every buffer is disposed exactly once.
 */
import { describe, expect, it, vi } from 'vitest';
import type { RuntimeScene } from '@portfolio/project-model/scene';
import {
	BufferGeometry,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Raycaster,
	Shape,
	ShapeGeometry,
	ShadowMaterial,
	Vector3,
	type Material
} from 'three';
import { compileWallFirstLayoutGeometry, type CompiledLayoutGeometry, type CompiledRoom, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';

import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from '../layout/__fixtures__/layout-scale-fixtures';
import { createRoomRepresentation } from '$lib/render/layout-room-representation';
import { resolveSceneSurfaceLook } from '$lib/render/layout/scene-surface-look';
import { LIFTED_RENDER_LAYER } from '$lib/render/render-layers';
import { createMaterialStore } from '$lib/render/resources/material-store';
import { renderIdentityOf } from '$lib/render/render-identity';
import { startStageCounting } from '../../helpers/stage-counts';
import { getMaterial } from '$lib/content/materials';

function compiled(document: LayoutDocumentWallFirst): CompiledLayoutGeometry {
	return compileWallFirstLayoutGeometry(document).geometry;
}

function rooms(representation: ReturnType<typeof createRoomRepresentation>): Map<string, Group> {
	const found = new Map<string, Group>();
	for (const child of representation.object3d.children) found.set(child.name, child as Group);
	return found;
}

function meshNamed(group: Group, name: string): Mesh {
	const mesh = group.children.find((child) => child.name === name);
	if (mesh === undefined) throw new Error(`no mesh ${name}`);
	return mesh as Mesh;
}

/** World-space triangle positions of a mesh, as the renderer would place them. */
function worldVertices(mesh: Mesh): number[] {
	mesh.updateWorldMatrix(true, false);
	const position = mesh.geometry.getAttribute('position');
	const out: number[] = [];
	for (let i = 0; i < position.count; i += 1) {
		const point = { x: position.getX(i), y: position.getY(i), z: position.getZ(i) };
		const e = mesh.matrixWorld.elements;
		out.push(
			e[0]! * point.x + e[4]! * point.y + e[8]! * point.z + e[12]!,
			e[1]! * point.x + e[5]! * point.y + e[9]! * point.z + e[13]!,
			e[2]! * point.x + e[6]! * point.y + e[10]! * point.z + e[14]!
		);
	}
	return out;
}

/** The template `VisitorLayoutShell` used to run per Room, call for call. */
function componentPath(room: CompiledRoom): { floor: Mesh; floorShadow: Mesh; ceiling: Mesh } {
	const polygonShape = (points: readonly LayoutVec2[], invertZ = true) => {
		const shape = new Shape();
		const first = points[0]!;
		const mapZ = (point: LayoutVec2) => (invertZ ? -point[1] : point[1]);
		shape.moveTo(first[0], mapZ(first));
		for (const point of points.slice(1)) shape.lineTo(point[0], mapZ(point));
		shape.closePath();
		return shape;
	};
	const floorShape = polygonShape(room.floorPolygon);
	const ceilingShape = polygonShape(room.ceilingPolygon, false);

	const floor = new Mesh(new ShapeGeometry(floorShape), new MeshBasicMaterial({ color: '#e5e8e1', toneMapped: false }));
	floor.position.set(0, room.floorElevation, 0);
	floor.rotation.set(-Math.PI / 2, 0, 0);

	// `<T.ShapeGeometry args={[shapes.floor]} />` on the second mesh: a new
	// triangulation of the same Shape.
	const floorShadow = new Mesh(
		new ShapeGeometry(floorShape),
		new ShadowMaterial({ opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
	);
	floorShadow.position.set(0, room.floorElevation, 0);
	floorShadow.rotation.set(-Math.PI / 2, 0, 0);

	const ceiling = new Mesh(
		new ShapeGeometry(ceilingShape),
		new MeshStandardMaterial({ color: '#111018', roughness: 0.92, metalness: 0.02 })
	);
	ceiling.position.set(0, room.ceilingElevation, 0);
	ceiling.rotation.set(Math.PI / 2, 0, 0);
	return { floor, floorShadow, ceiling };
}

function materialProperties(material: Material): Record<string, unknown> {
	const basic = material as MeshBasicMaterial;
	return {
		type: material.type,
		color: basic.color?.getHexString(),
		toneMapped: material.toneMapped,
		opacity: material.opacity,
		depthWrite: material.depthWrite,
		polygonOffset: material.polygonOffset,
		polygonOffsetFactor: material.polygonOffsetFactor,
		polygonOffsetUnits: material.polygonOffsetUnits,
		roughness: (material as MeshStandardMaterial).roughness,
		metalness: (material as MeshStandardMaterial).metalness,
		map: (material as MeshStandardMaterial).map ?? null
	};
}

/**
 * A point inside a Room, read from the Room floor's **own** triangulation.
 *
 * The bounding-box centre of a non-convex Room can sit outside it, and a ray
 * there would describe a hole rather than the Room. The first triangle of the
 * floor buffer is always inside the floor it draws.
 */
function insideFloor(mesh: Mesh): { readonly x: number; readonly z: number } {
	const vertices = worldVertices(mesh);
	return {
		x: (vertices[0]! + vertices[3]! + vertices[6]!) / 3,
		z: (vertices[2]! + vertices[5]! + vertices[8]!) / 3
	};
}

function hitsAlong(group: Group, origin: Vector3, direction: Vector3): string[] {
	// `Raycaster` reads `matrixWorld` and never writes it; the renderer is what
	// normally updates it, so a headless test must. A stale identity matrix would
	// test the wrong surface — and did, silently, before this line existed.
	group.updateMatrixWorld(true);
	const raycaster = new Raycaster(origin, direction.normalize(), 0, Infinity);
	return raycaster.intersectObject(group, true).map((hit) => hit.object.name);
}

function moved(document: LayoutDocumentWallFirst, wallIndex = 0): LayoutDocumentWallFirst {
	const next = JSON.parse(JSON.stringify(document)) as LayoutDocumentWallFirst;
	const wall = next.walls[wallIndex]!;
	const junction = next.junctions.find((candidate) => candidate.id === wall.startJunctionId)!;
	junction.point = [junction.point[0] + 0.35, junction.point[1] + 0.2] as LayoutVec2;
	return next;
}

describe('E6/R3 — retained Room representation parity', () => {
	it('reproduces the component path’s world vertices and material properties, per Room', () => {
		const geometry = compiled(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
		const store = createMaterialStore();
		const representation = createRoomRepresentation(store);
		representation.update(geometry);

		for (const room of geometry.rooms) {
			const expected = componentPath(room);
			const group = rooms(representation).get(`VisitorRoom:${room.roomId}`)!;
			expect(group, room.roomId).toBeDefined();
			const floor = meshNamed(group, `VisitorFloor:${room.roomId}`);
			const floorShadow = meshNamed(group, `VisitorFloorShadow:${room.roomId}`);
			const ceiling = meshNamed(group, `VisitorCeiling:${room.roomId}`);

			expect(worldVertices(floor), `${room.roomId} floor`).toEqual(worldVertices(expected.floor));
			expect(worldVertices(floorShadow), `${room.roomId} floor shadow`).toEqual(worldVertices(expected.floorShadow));
			expect(worldVertices(ceiling), `${room.roomId} ceiling`).toEqual(worldVertices(expected.ceiling));

			expect(materialProperties(floor.material as Material)).toEqual(materialProperties(expected.floor.material as Material));
			expect(materialProperties(floorShadow.material as Material)).toEqual(
				materialProperties(expected.floorShadow.material as Material)
			);
			expect(materialProperties(ceiling.material as Material)).toEqual(materialProperties(expected.ceiling.material as Material));

			// The one deliberate structural change: the shadow catcher shares the
			// floor's triangulation instead of re-triangulating the same Shape.
			expect(floorShadow.geometry).toBe(floor.geometry);
			// The shadow catcher must never be picked; the floor must be.
			expect(typeof floorShadow.raycast).toBe('function');
			expect(floorShadow.raycast({} as never, [] as never)).toBeUndefined();
			expect(floorShadow.receiveShadow).toBe(true);
			expect(floor.receiveShadow).toBe(false);
		}

		representation.dispose();
		store.dispose();
	}, 60_000);

	it('resolves Scene 12 Room floor and lid Finishes through the shared material store', () => {
		const geometry = compiled(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
		const roomId = geometry.rooms[0]!.roomId;
		let scene: RuntimeScene = {
			textures: [], materials: [], entities: [], objects: [],
		surfaceFinishes: [
			{ surface: { kind: 'room-floor', roomId }, finish: { materialId: 'marble-light' } },
			{ surface: { kind: 'room-lid', roomId }, finish: { materialId: 'velvet-dark' } }
		]
		};
		const store = createMaterialStore();
		const representation = createRoomRepresentation(
			store, undefined, scene, null, () => {}, (surface) => resolveSceneSurfaceLook(scene, surface, undefined)
		);
		representation.update(geometry);
		const group = rooms(representation).get(`VisitorRoom:${roomId}`)!;
		const floor = meshNamed(group, `VisitorFloor:${roomId}`);
		const lid = meshNamed(group, `VisitorCeiling:${roomId}`);
		expect(floor.material).toBeInstanceOf(MeshStandardMaterial);
		expect((floor.material as MeshStandardMaterial).color.getHexString()).toBe(
			getMaterial('marble-light').fallbackColor.slice(1)
		);
		expect(lid.material).toBeInstanceOf(MeshStandardMaterial);
		expect((lid.material as MeshStandardMaterial).color.getHexString()).toBe(
			getMaterial('velvet-dark').fallbackColor.slice(1)
		);
		const paintedFloor = floor.material;
		scene = { ...scene, surfaceFinishes: [] };
		expect(representation.setScene(scene, null)).toBe(true);
		expect(floor.material).not.toBe(paintedFloor);
		expect(floor.material).toBeInstanceOf(MeshBasicMaterial);
		representation.dispose();
		store.dispose();
	});

	it('keeps a Room’s group, buffers and identity when its cacheKey did not move', () => {
		const geometry = compiled(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
		const store = createMaterialStore();
		const representation = createRoomRepresentation(store);
		const first = representation.update(geometry);
		expect(first).toMatchObject({
			rooms: geometry.rooms.length,
			built: geometry.rooms.length,
			retained: 0,
			released: 0,
			triangulations: geometry.rooms.length * 2,
			materials: 3
		});

		const before = rooms(representation);
		const second = representation.update(geometry);
		expect(second).toMatchObject({ built: 0, retained: geometry.rooms.length, released: 0, triangulations: 0 });
		for (const [name, group] of rooms(representation)) expect(group).toBe(before.get(name));

		representation.dispose();
		store.dispose();
	});

	it('rebuilds only the Rooms an edit moved, two triangulations each', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const store = createMaterialStore();
		const representation = createRoomRepresentation(store);
		const base = compiled(document);
		representation.update(base);
		const before = rooms(representation);

		const next = compiled(moved(document));
		const stats = representation.update(next);
		expect(stats.built).toBeGreaterThan(0);
		expect(stats.built).toBeLessThan(stats.rooms);
		expect(stats.triangulations).toBe(stats.built * 2);
		expect(stats.built + stats.retained).toBe(stats.rooms);
		expect(stats.released).toBe(0);
		expect(stats.materials).toBe(3);

		let kept = 0;
		for (const [name, group] of rooms(representation)) if (before.get(name) === group) kept += 1;
		expect(kept).toBe(stats.retained);
		for (const child of representation.object3d.children) expect(child.parent).toBe(representation.object3d);

		representation.dispose();
		store.dispose();
	}, 60_000);

	it('a retained rebuild equals a from-scratch build buffer for buffer', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const edited = compiled(moved(document));

		const incrementalStore = createMaterialStore();
		const incremental = createRoomRepresentation(incrementalStore);
		incremental.update(compiled(document));
		incremental.update(edited);

		const freshStore = createMaterialStore();
		const fresh = createRoomRepresentation(freshStore);
		fresh.update(edited);

		const delivered = rooms(incremental);
		const scratch = rooms(fresh);
		expect([...delivered.keys()].sort()).toEqual([...scratch.keys()].sort());
		for (const [name, group] of scratch) {
			const other = delivered.get(name)!;
			for (const meshName of ['floor', 'floorShadow', 'ceiling'] as const) {
				const left = meshNamed(group, meshNameFor(name, meshName));
				const right = meshNamed(other, meshNameFor(name, meshName));
				expect(worldVertices(right), `${name} ${meshName}`).toEqual(worldVertices(left));
			}
		}

		incremental.dispose();
		fresh.dispose();
		incrementalStore.dispose();
		freshStore.dispose();
	}, 60_000);
});

function meshNameFor(groupName: string, mesh: 'floor' | 'floorShadow' | 'ceiling'): string {
	const roomId = groupName.slice(groupName.indexOf(':') + 1);
	return mesh === 'floor' ? `VisitorFloor:${roomId}` : mesh === 'floorShadow' ? `VisitorFloorShadow:${roomId}` : `VisitorCeiling:${roomId}`;
}

/**
 * T1 X1 — the generated Room lid as `main` actually builds it.
 *
 * Every later Lift guarantee reads these two facts, so they are pinned before
 * any of them is relied on:
 *
 * - **The lid is invisible and click-through from above.** It is a `FrontSide`
 *   mesh whose `+π/2` rotation turns its front face downward, so a ray from above
 *   meets its back face and `Mesh.raycast` discards it. It occludes only a Camera
 *   under it, which is why Lift must move it off the world layer rather than
 *   write `visible`.
 * - **The lid casts no shadow.** Walls and Layout objects do; today's generated
 *   ceiling does not, so lifting it cannot change any light or shadow.
 *
 * Changing either is a stop condition for X1, not a detail to adapt to.
 */
describe('T1 X1 — the generated Room lid: ray behaviour and caster state', () => {
	it('is missed from above, hit from inside, and casts no shadow', () => {
		const geometry = compiled(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
		const store = createMaterialStore();
		const representation = createRoomRepresentation(store);
		representation.update(geometry);
		expect(geometry.rooms.length).toBeGreaterThan(0);

		for (const room of geometry.rooms) {
			const group = rooms(representation).get(`VisitorRoom:${room.roomId}`)!;
			const floor = meshNamed(group, `VisitorFloor:${room.roomId}`);
			const ceiling = meshNamed(group, `VisitorCeiling:${room.roomId}`);
			const inside = insideFloor(floor);
			const ceilingName = `VisitorCeiling:${room.roomId}`;
			const floorName = `VisitorFloor:${room.roomId}`;

			// From above: the lid's back face is culled, so the floor is what the
			// ray meets — and every interior click at eye level works for the same
			// reason.
			const fromAbove = hitsAlong(
				group,
				new Vector3(inside.x, room.ceilingElevation + 2, inside.z),
				new Vector3(0, -1, 0)
			);
			expect(fromAbove, `${room.roomId} from above`).not.toContain(ceilingName);
			expect(fromAbove[0], `${room.roomId} from above`).toBe(floorName);

			// From inside, looking up: the lid is front-facing and is hit. That is
			// the occlusion Lift removes.
			const fromInside = hitsAlong(
				group,
				new Vector3(inside.x, room.floorElevation + 1, inside.z),
				new Vector3(0, 1, 0)
			);
			expect(fromInside[0], `${room.roomId} from inside`).toBe(ceilingName);

			// Caster state is the Layout representation's, not a shadow policy:
			// the generated lid does not cast today, so Lift changes no light.
			expect(ceiling.castShadow, `${room.roomId} lid castShadow`).toBe(false);
		}

		representation.dispose();
		store.dispose();
	}, 60_000);
});

/**
 * T1 X1 — lifting a lid is a **layer** change, never `visible`.
 *
 * `visible` is the pick source's "mounted and eligible" flag, and writing it for
 * appearance would quietly make a lifted Room unpickable and a put-back Room
 * appear. The layer moves the lid out of the Stage camera's mask and out of the
 * default `Raycaster`'s, which is exactly the two effects Lift needs and nothing
 * else: the floor, the shadow catcher, the materials, the geometry and
 * `castShadow` are untouched.
 */
describe('T1 X1 — lifting a lid', () => {
	it('moves only the lid to the lifted layer, reports the change once, and restores it', () => {
		const geometry = compiled(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
		const store = createMaterialStore();
		const representation = createRoomRepresentation(store);
		representation.update(geometry);
		const room = geometry.rooms[0]!;
		const other = geometry.rooms[1]!;
		const group = rooms(representation).get(`VisitorRoom:${room.roomId}`)!;
		const floor = meshNamed(group, `VisitorFloor:${room.roomId}`);
		const floorShadow = meshNamed(group, `VisitorFloorShadow:${room.roomId}`);
		const ceiling = meshNamed(group, `VisitorCeiling:${room.roomId}`);
		const otherCeiling = meshNamed(
			rooms(representation).get(`VisitorRoom:${other.roomId}`)!,
			`VisitorCeiling:${other.roomId}`
		);
		const castShadow = ceiling.castShadow;

		expect(representation.setLifted(new Set([room.roomId]))).toBe(true);
		expect(ceiling.layers.mask).toBe(1 << LIFTED_RENDER_LAYER);
		// The Room's other meshes, and every other Room, stay where they were.
		expect(floor.layers.mask).toBe(1);
		expect(floorShadow.layers.mask).toBe(1);
		expect(otherCeiling.layers.mask).toBe(1);
		// Appearance never writes `visible`.
		expect(ceiling.visible).toBe(true);
		expect(floor.visible).toBe(true);
		expect(floorShadow.visible).toBe(true);
		expect(group.visible).toBe(true);
		expect(ceiling.castShadow).toBe(castShadow);

		// A repeat of the same reading is not a frame: nothing moved.
		expect(representation.setLifted(new Set([room.roomId]))).toBe(false);

		expect(representation.setLifted(new Set())).toBe(true);
		expect(ceiling.layers.mask).toBe(1);
		expect(representation.setLifted(new Set())).toBe(false);

		representation.dispose();
		store.dispose();
	});

	it('takes the lifted lid out of an upward ray while the floor stays pickable from above', () => {
		const geometry = compiled(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
		const store = createMaterialStore();
		const representation = createRoomRepresentation(store);
		representation.update(geometry);
		const room = geometry.rooms[0]!;
		const group = rooms(representation).get(`VisitorRoom:${room.roomId}`)!;
		const floor = meshNamed(group, `VisitorFloor:${room.roomId}`);
		const inside = insideFloor(floor);
		const up = new Vector3(0, 1, 0);
		const down = new Vector3(0, -1, 0);
		const fromInside = () =>
			hitsAlong(group, new Vector3(inside.x, room.floorElevation + 1, inside.z), up);
		const fromAbove = () =>
			hitsAlong(group, new Vector3(inside.x, room.ceilingElevation + 2, inside.z), down);

		expect(fromInside()[0]).toBe(`VisitorCeiling:${room.roomId}`);

		representation.setLifted(new Set([room.roomId]));
		expect(fromInside()).toEqual([]);
		// The default `Raycaster` keeps its layer-0 mask, so every interior pick
		// reaches what is under the lid instead of the lid.
		expect(fromAbove()[0]).toBe(`VisitorFloor:${room.roomId}`);

		representation.setLifted(new Set());
		expect(fromInside()[0]).toBe(`VisitorCeiling:${room.roomId}`);

		representation.dispose();
		store.dispose();
	});

	it('births a Room rebuilt mid-Lift already lifted', () => {
		const geometry = compiled(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
		const store = createMaterialStore();
		const representation = createRoomRepresentation(store);
		representation.update(geometry);
		const room = geometry.rooms[0]!;
		representation.setLifted(new Set([room.roomId]));

		// A changed `cacheKey` is the representation's own rebuild trigger.
		const rebuilt = {
			...geometry,
			rooms: geometry.rooms.map((candidate) =>
				candidate.roomId === room.roomId
					? { ...candidate, cacheKey: `${candidate.cacheKey}:edited` }
					: candidate
			)
		};
		const stats = representation.update(rebuilt);
		expect(stats.built).toBe(1);
		const ceiling = meshNamed(
			rooms(representation).get(`VisitorRoom:${room.roomId}`)!,
			`VisitorCeiling:${room.roomId}`
		);
		expect(ceiling.layers.mask).toBe(1 << LIFTED_RENDER_LAYER);

		representation.dispose();
		store.dispose();
	});
});

describe('E6/R3 — Room materials, release and identity', () => {
	it('draws every Room with three store materials, whichever Room count', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.medium);
		const geometry = compiled(document);
		expect(geometry.rooms.length).toBeGreaterThan(10);
		const store = createMaterialStore();
		const representation = createRoomRepresentation(store);
		const stats = representation.update(geometry);
		expect(stats.materials).toBe(3);
		expect(store.stats().created).toBe(3);
		const materials = new Set<Material>();
		for (const group of rooms(representation).values()) for (const child of group.children) materials.add((child as Mesh).material as Material);
		expect(materials.size).toBe(3);
		representation.dispose();
		store.dispose();
		expect(store.stats().live).toBe(0);
	}, 60_000);

	it('releases a departed Room’s buffers and the material leases only once', () => {
		const geometry = compiled(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
		const store = createMaterialStore();
		const representation = createRoomRepresentation(store);
		representation.update(geometry);

		const removed = geometry.rooms.at(-1)!;
		const pruned = { ...geometry, rooms: geometry.rooms.filter((room) => room.roomId !== removed.roomId) };
		const disposeSpy = vi.spyOn(BufferGeometry.prototype, 'dispose');
		const stats = representation.update(pruned);
		expect(stats).toMatchObject({ released: 1, built: 0, rooms: pruned.rooms.length });
		// Both of the departed Room's buffers, exactly once each.
		expect(disposeSpy.mock.calls.length).toBe(2);
		disposeSpy.mockRestore();
		expect(rooms(representation).has(`VisitorRoom:${removed.roomId}`)).toBe(false);

		representation.dispose();
		expect(store.stats().live).toBe(0);
		store.dispose();
	});

	it('disposes every buffer exactly once, and a shared material only at the last lease', () => {
		const geometry = compiled(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
		const store = createMaterialStore();
		const representation = createRoomRepresentation(store);
		// A second claimant on the floor look: the representation's release must not
		// free a material another consumer still draws.
		const other = store.acquire({ kind: 'basic', color: '#e5e8e1', toneMapped: false });
		const disposed = new Map<object, number>();
		const original = BufferGeometry.prototype.dispose;
		const disposeSpy = vi
			.spyOn(BufferGeometry.prototype, 'dispose')
			.mockImplementation(function counted(this: BufferGeometry) {
				disposed.set(this, (disposed.get(this) ?? 0) + 1);
				original.call(this);
			});
		const materialDisposed = vi.spyOn(other.material, 'dispose');

		representation.update(geometry);
		representation.dispose();
		expect(disposed.size).toBe(geometry.rooms.length * 2);
		expect([...disposed.values()].every((count) => count === 1)).toBe(true);
		expect(representation.object3d.children).toHaveLength(0);
		expect(materialDisposed).not.toHaveBeenCalled();
		expect(store.peek({ kind: 'basic', color: '#e5e8e1', toneMapped: false })).toBe(other.material);

		disposeSpy.mockClear();
		representation.dispose();
		expect(disposeSpy).not.toHaveBeenCalled();
		disposeSpy.mockRestore();

		other.release();
		expect(materialDisposed).toHaveBeenCalledTimes(1);
		store.dispose();
	});

	it('resolves each Room’s floor by identity, tagged and independent of its name', () => {
		const geometry = compiled(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
		const store = createMaterialStore();
		const representation = createRoomRepresentation(store);
		representation.update(geometry);
		const room = geometry.rooms[0]!;
		const floor = representation.objectOf(room.roomId)!;
		expect(floor).toBeInstanceOf(Mesh);
		expect(renderIdentityOf(floor)).toEqual({ kind: 'floor', id: room.roomId });
		floor.name = 'renamed';
		expect(representation.objectOf(room.roomId)).toBe(floor);
		expect(representation.objectOf('no-such-room')).toBeNull();
		representation.dispose();
		for (const candidate of geometry.rooms) expect(representation.objectOf(candidate.roomId)).toBeNull();
		store.dispose();
	});

	it('hides k Rooms with k writes, remembers the set, and births a late Room hidden', () => {
		const counting = startStageCounting();
		try {
			const geometry = compiled(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
			const store = createMaterialStore();
			const representation = createRoomRepresentation(store);
			const ids = geometry.rooms.map((room) => room.roomId);
			const early = ids[0]!;
			representation.setHidden(new Set([early]));
			representation.update(geometry);
			expect(rooms(representation).get(`VisitorRoom:${early}`)!.visible).toBe(false);

			counting.reset();
			representation.setHidden(new Set([early, ids[1]!]));
			expect(counting.count('representation:visibility-write')).toBe(1);
			expect(counting.count('representation:room-entry-test')).toBe(0);
			representation.setHidden(new Set([early, ids[1]!]));
			expect(counting.count('representation:visibility-write')).toBe(1);
			expect(rooms(representation).get(`VisitorRoom:${early}`)!.visible).toBe(false);

			representation.setHidden(new Set());
			for (const room of geometry.rooms) expect(rooms(representation).get(`VisitorRoom:${room.roomId}`)!.visible).toBe(true);
			representation.dispose();
			store.dispose();
		} finally {
			counting.stop();
		}
	});
});
