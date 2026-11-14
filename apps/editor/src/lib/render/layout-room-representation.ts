/**
 * E6/R3 — the retained Room representation.
 *
 * Rooms used to be the last world content mounted per entity through Svelte: one
 * `{#each}` in `VisitorLayoutShell`, and per Room a group, three meshes, three
 * geometry components and three material components — ≈10 mounts, 3
 * triangulations and 3 materials. At L (196 Rooms) that is 588 triangulations,
 * 588 materials and ≈1,960 mounted components for surfaces that are two flat
 * polygons and three fixed looks (audit 6.5, re-counted for this slice).
 *
 * This module owns them instead, on the same terms as the Wall and object
 * representations:
 *
 * - **Retained by the Room's own `cacheKey`.** A Room whose key did not move
 *   keeps its group, its two geometries, its transforms and its meshes.
 * - **Two geometries per Room.** One floor triangulation, shared by the floor
 *   and the floor-shadow mesh, and one ceiling triangulation. The component path
 *   built a third `ShapeGeometry` for the shadow mesh from the same `Shape`.
 * - **Three materials for every Room.** Acquired once from the Canvas's
 *   `MaterialStore`: the unlit ground-coloured floor, the shadow catcher and the
 *   dark plaster ceiling. Equal descriptors share one instance, so 196 Rooms draw
 *   three materials, not 588.
 * - **Released in the same update.** A Room that left the document, and every
 *   superseded buffer, is disposed there; the material leases go back at the end.
 *
 * Deliberately unchanged: the world placement of each surface (floor
 * `-π/2` at `floorElevation`, ceiling `+π/2` at `ceilingElevation`), the
 * shadow-catcher's `raycast` opt-out (it is never picked), the ceiling's absence
 * of a render-identity tag (a ceiling hit is Layout, not a floor — preserved from
 * the component path), and the framed door portals, which stay with the shell.
 */
import { Group, Mesh, Shape, ShapeGeometry, type BufferGeometry, type Object3D } from 'three';
import {
	countWork,
	type CompiledLayoutGeometry,
	type CompiledRoom,
	type LayoutVec2
} from '@portfolio/layout-core';

import { getMaterial } from '$lib/content/materials';
import { reconcileHidden, tagRenderIdentity } from '$lib/render/render-identity';
import type { MaterialStore } from '$lib/render/resources/material-store';
import type { MaterialDescriptor } from '$lib/render/resources/material-descriptor';
import { DEFAULT_FLOOR_COLOR } from '$lib/visitor/room-presentation';

/** One retained Room: what it was built from, its group, its buffers and its floor mesh. */
type RetainedRoom = {
	readonly key: string;
	readonly group: Group;
	/** The mesh the identity index returns for this Room. */
	readonly floor: Mesh;
	readonly geometry: readonly BufferGeometry[];
};

/** What one update did, as counts — the R3 oracle reads these, never a stopwatch. */
export type RoomRepresentationStats = {
	/** Compiled Rooms in the geometry. */
	readonly rooms: number;
	/** Rooms rebuilt by this update (changed, new). */
	readonly built: number;
	/** Rooms kept from the previous update. */
	readonly retained: number;
	/** Rooms removed and released because the document no longer has them. */
	readonly released: number;
	/** `ShapeGeometry` triangulations built by this update: two per built Room. */
	readonly triangulations: number;
	/** Distinct materials the representation holds (three, shared by every Room). */
	readonly materials: number;
};

export type RoomRepresentation = {
	/** The subtree to mount; it is never replaced, only reconciled. */
	readonly object3d: Group;
	update(geometry: CompiledLayoutGeometry): RoomRepresentationStats;
	/** The retained floor mesh drawing this Room, or null. Reads the owned index. */
	objectOf(roomId: string): Object3D | null;
	/** Hide exactly these Rooms; work is proportional to the ids that changed state. */
	setHidden(roomIds: ReadonlySet<string>): void;
	/** Release every retained Room and its material leases. Idempotent. */
	dispose(): void;
};

/**
 * The room polygon as the shell has always built it for `ShapeGeometry`.
 *
 * The floor's z is negated so the shape's +y maps to world -z after the
 * `-π/2` x-rotation; the ceiling keeps it and rotates the other way. This is the
 * component path's transform, moved, not re-decided — the parity test compares
 * the resulting world vertices against a from-scratch build of the old template.
 */
function polygonShape(points: readonly LayoutVec2[], invertZ = true): Shape {
	const shape = new Shape();
	const first = points[0];
	if (!first) return shape;
	const mapZ = (point: LayoutVec2) => (invertZ ? -point[1] : point[1]);
	shape.moveTo(first[0], mapZ(first));
	for (const point of points.slice(1)) shape.lineTo(point[0], mapZ(point));
	shape.closePath();
	return shape;
}

/** The three Layout Room surfaces, as plain data. The ceiling reads the catalogue's plaster values. */
function roomDescriptors(): {
	readonly floor: MaterialDescriptor;
	readonly floorShadow: MaterialDescriptor;
	readonly ceiling: MaterialDescriptor;
} {
	const plaster = getMaterial('plaster-warm');
	return {
		floor: { kind: 'basic', color: DEFAULT_FLOOR_COLOR, toneMapped: false },
		floorShadow: {
			kind: 'shadow',
			opacity: 0.3,
			depthWrite: false,
			polygonOffset: true,
			polygonOffsetFactor: -1,
			polygonOffsetUnits: -1
		},
		ceiling: {
			kind: 'standard',
			color: '#111018',
			roughness: plaster.roughness,
			metalness: plaster.metalness,
			// `MuseumMaterial` defaults `receiveLighting`, and with `textures="off"`
			// it draws a plain untoned-free standard surface: `toneMapped = true`.
			toneMapped: true
		}
	};
}

export function createRoomRepresentation(store: MaterialStore): RoomRepresentation {
	const object3d = new Group();
	object3d.name = 'VisitorLayoutRooms';
	const retained = new Map<string, RetainedRoom>();
	const descriptors = roomDescriptors();
	const floorLease = store.acquire(descriptors.floor);
	const shadowLease = store.acquire(descriptors.floorShadow);
	const ceilingLease = store.acquire(descriptors.ceiling);
	const materialKeys = new Set([floorLease.key, shadowLease.key, ceilingLease.key]);
	let disposed = false;
	let hidden: ReadonlySet<string> = new Set();

	/**
	 * Attach `group` at `index`.
	 *
	 * three has no ordered insert, and assigning `parent.children[index]` directly
	 * leaves `group.parent` unset — which silently disables `removeFromParent()` and
	 * leaks the subtree. `add()` first, then move the child to its slot.
	 */
	function attachAt(parent: Group, group: Group, index: number): void {
		parent.add(group);
		const end = parent.children.indexOf(group);
		if (end === index) return;
		parent.children.splice(end, 1);
		parent.children.splice(index, 0, group);
	}

	function build(room: CompiledRoom): {
		group: Group;
		floor: Mesh;
		geometry: readonly BufferGeometry[];
	} {
		const group = new Group();
		group.name = `VisitorRoom:${room.roomId}`;

		// One floor triangulation, drawn twice: the unlit ground and the shadow
		// catcher that keeps the floor eligible for an authored light's shadow.
		const floorGeometry = new ShapeGeometry(polygonShape(room.floorPolygon));
		const ceilingGeometry = new ShapeGeometry(polygonShape(room.ceilingPolygon, false));

		const floor = new Mesh(floorGeometry, floorLease.material);
		floor.name = `VisitorFloor:${room.roomId}`;
		tagRenderIdentity(floor, 'floor', room.roomId);
		floor.position.set(0, room.floorElevation, 0);
		floor.rotation.set(-Math.PI / 2, 0, 0);

		// With no casting light it draws nothing. Never picked: the pick ray must
		// see the floor beneath it, not the catcher that shares its plane.
		const floorShadow = new Mesh(floorGeometry, shadowLease.material);
		floorShadow.name = `VisitorFloorShadow:${room.roomId}`;
		floorShadow.position.set(0, room.floorElevation, 0);
		floorShadow.rotation.set(-Math.PI / 2, 0, 0);
		floorShadow.receiveShadow = true;
		floorShadow.raycast = () => {};

		const ceiling = new Mesh(ceilingGeometry, ceilingLease.material);
		ceiling.name = `VisitorCeiling:${room.roomId}`;
		ceiling.position.set(0, room.ceilingElevation, 0);
		ceiling.rotation.set(Math.PI / 2, 0, 0);

		group.add(floor, floorShadow, ceiling);
		return { group, floor, geometry: [floorGeometry, ceilingGeometry] };
	}

	return {
		object3d,

		update(geometry) {
			if (disposed) throw new Error('the layout room representation has been disposed');
			let built = 0;
			let kept = 0;
			const present = new Set<string>();

			for (const room of geometry.rooms) {
				countWork('representation:room-entry-test');
				present.add(room.roomId);
				const previous = retained.get(room.roomId);
				if (previous && previous.key === room.cacheKey) {
					kept += 1;
					continue;
				}
				const next = build(room);
				next.group.visible = !hidden.has(room.roomId);
				if (previous) {
					// Swap in place so draw order follows compiled Room order.
					countWork('representation:child-array-scan-bound', object3d.children.length);
					const index = object3d.children.indexOf(previous.group);
					previous.group.removeFromParent();
					if (index >= 0) attachAt(object3d, next.group, index);
					else object3d.add(next.group);
					for (const buffer of previous.geometry) buffer.dispose();
				} else {
					object3d.add(next.group);
				}
				retained.set(room.roomId, { key: room.cacheKey, ...next });
				built += 1;
			}

			let released = 0;
			for (const [roomId, entry] of retained) {
				countWork('representation:room-removal-test');
				if (present.has(roomId)) continue;
				entry.group.removeFromParent();
				for (const buffer of entry.geometry) buffer.dispose();
				retained.delete(roomId);
				released += 1;
			}

			return {
				rooms: retained.size,
				built,
				retained: kept,
				released,
				triangulations: built * 2,
				materials: materialKeys.size
			};
		},

		objectOf(roomId) {
			return retained.get(roomId)?.floor ?? null;
		},

		setHidden(roomIds) {
			if (disposed) throw new Error('the layout room representation has been disposed');
			hidden = reconcileHidden(hidden, roomIds, (roomId, isHidden) => {
				countWork('representation:visibility-write');
				const entry = retained.get(roomId);
				if (entry !== undefined) entry.group.visible = !isHidden;
			});
		},

		dispose() {
			if (disposed) return;
			disposed = true;
			hidden = new Set();
			for (const entry of retained.values()) {
				entry.group.removeFromParent();
				for (const buffer of entry.geometry) buffer.dispose();
			}
			retained.clear();
			floorLease.release();
			shadowLease.release();
			ceilingLease.release();
		}
	};
}
