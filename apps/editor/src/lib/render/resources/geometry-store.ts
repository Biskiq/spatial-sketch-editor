/**
 * E7/R4 — the geometry store: one shared buffer per geometry key.
 *
 * `renderer-refactor.md` §2.3 fixes the key space: a primitive is one unit
 * geometry scaled by its transform, a Form is one buffer per canonical
 * evaluation, and equal keys share one GPU buffer. Before this store every
 * primitive created a fresh `BoxGeometry`/`SphereGeometry` at its own size, so
 * resizing an entity rebuilt its buffers and two identical chairs in two Rooms
 * held two copies of the same box.
 *
 * The store is a resource owner, not a policy: it constructs the buffer a key
 * names, counts leases and disposes at zero. It is per Canvas, because WebGL
 * buffers cannot cross contexts, and it refuses further acquires after `dispose`.
 *
 * Forms carry their evaluated mesh: the canonical kernel already produced it
 * (`content/form-evaluation`, cached and deterministic), and `buildFormGeometry`
 * is the one adapter that derives normals and metre UVs. Keeping the mesh on the
 * spec means the store needs no evaluator and no authored-unit reader — the
 * representation can consume it without reaching project-model.
 */
import {
	BoxGeometry,
	CylinderGeometry,
	PlaneGeometry,
	SphereGeometry,
	type BufferGeometry
} from 'three';
import { buildFormGeometry } from '$lib/museum/entities/form-geometry';
import { artworkBackingGeometry, artworkFrameGeometry, artworkMatGeometry } from '../artwork/artwork-geometry';
import { geometryKeyOf, type GeometrySpec } from './scene-render-item';

export { geometryKeyOf } from './scene-render-item';
export type {
	ArtworkGeometrySpec,
	FormGeometrySpec,
	FormPlane,
	FrustumGeometrySpec,
	GeometrySpec,
	UnitGeometrySpec
} from './scene-render-item';

/** One claim on a shared buffer. `release` is idempotent. */
export type GeometryLease = {
	readonly key: string;
	readonly geometry: BufferGeometry;
	release(): void;
};

export type GeometryStoreStats = {
	/** Buffers held now (a reference count above zero). */
	readonly live: number;
	/** Buffers this store has constructed, monotone. */
	readonly created: number;
	/** Buffers this store has disposed, monotone. */
	readonly disposed: number;
	/** Leases taken, monotone. */
	readonly acquired: number;
};

export type GeometryStore = {
	/** The shared buffer for `spec`, and a lease on it. */
	acquire(spec: GeometrySpec): GeometryLease;
	stats(): GeometryStoreStats;
	/** Release every held buffer and refuse further acquires. Idempotent. */
	dispose(): void;
};

function construct(spec: GeometrySpec): BufferGeometry {
	if (spec.kind === 'form') return buildFormGeometry(spec.mesh, spec.plane);
	if (spec.kind === 'artwork-frame') return artworkFrameGeometry(spec);
	if (spec.kind === 'artwork-mat') return artworkMatGeometry(spec);
	if (spec.kind === 'artwork-backing') return artworkBackingGeometry(spec);
	if (spec.kind === 'frustum') {
		return new CylinderGeometry(
			spec.radiusTop,
			spec.radiusBottom,
			spec.height,
			spec.radialSegments,
			1,
			spec.openEnded
		);
	}
	switch (spec.shape) {
		case 'box':
			return new BoxGeometry(1, 1, 1);
		case 'plane':
			return new PlaneGeometry(1, 1);
		case 'cylinder':
			// A unit cylinder: radius 0.5 and height 1, so a transform of
			// `(2r, h, 2r)` reproduces `CylinderGeometry(r, r, h, n)` exactly.
			return new CylinderGeometry(0.5, 0.5, 1, spec.radialSegments, 1);
		case 'sphere':
			return new SphereGeometry(0.5, spec.widthSegments, spec.heightSegments);
	}
}

type Entry = {
	readonly spec: GeometrySpec;
	readonly geometry: BufferGeometry;
	refCount: number;
};

export function createGeometryStore(): GeometryStore {
	const entries = new Map<string, Entry>();
	let created = 0;
	let disposedCount = 0;
	let acquired = 0;
	let disposed = false;

	return {
		acquire(spec) {
			if (disposed) throw new Error('the geometry store has been disposed');
			const key = geometryKeyOf(spec);
			let entry = entries.get(key);
			if (entry === undefined) {
				entry = { spec, geometry: construct(spec), refCount: 0 };
				entries.set(key, entry);
				created += 1;
			}
			entry.refCount += 1;
			acquired += 1;
			const held = entry;
			let released = false;
			return {
				key,
				geometry: held.geometry,
				release() {
					if (released) return;
					released = true;
					// A lease released after the store disposed is a no-op: the store
					// already freed the buffer and must not double-dispose it.
					if (disposed) return;
					held.refCount -= 1;
					if (held.refCount > 0) return;
					entries.delete(key);
					held.geometry.dispose();
					disposedCount += 1;
				}
			};
		},

		stats() {
			return { live: entries.size, created, disposed: disposedCount, acquired };
		},

		dispose() {
			if (disposed) return;
			disposed = true;
			for (const entry of entries.values()) {
				entry.geometry.dispose();
				disposedCount += 1;
			}
			entries.clear();
		}
	};
}
