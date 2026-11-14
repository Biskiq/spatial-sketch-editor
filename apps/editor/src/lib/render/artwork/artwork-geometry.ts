/**
 * E9/R5 — the Artwork body buffers, built once per geometry key.
 *
 * These are the exact constructions `EntityArtwork.svelte` mounted per entity
 * (the same ring, extrude settings and plate), moved behind the Canvas geometry
 * store so equal sizes share one buffer. The image surface is the store's shared
 * `unit:plane`, scaled by the image size.
 */
import { ExtrudeGeometry, Path, PlaneGeometry, Shape, ShapeGeometry, type BufferGeometry } from 'three';
import type { ArtworkGeometrySpec } from '../resources/scene-render-item';

type Spec<K extends ArtworkGeometrySpec['kind']> = Extract<ArtworkGeometrySpec, { kind: K }>;

/** One planar ring; the hole winds opposite the outline for ExtrudeGeometry. */
export function artworkRingShape(outerWidth: number, outerHeight: number, innerWidth: number, innerHeight: number): Shape {
	const shape = new Shape();
	shape.moveTo(-outerWidth / 2, -outerHeight / 2);
	shape.lineTo(outerWidth / 2, -outerHeight / 2);
	shape.lineTo(outerWidth / 2, outerHeight / 2);
	shape.lineTo(-outerWidth / 2, outerHeight / 2);
	shape.closePath();
	const hole = new Path();
	hole.moveTo(-innerWidth / 2, -innerHeight / 2);
	hole.lineTo(-innerWidth / 2, innerHeight / 2);
	hole.lineTo(innerWidth / 2, innerHeight / 2);
	hole.lineTo(innerWidth / 2, -innerHeight / 2);
	hole.closePath();
	shape.holes.push(hole);
	return shape;
}

export function artworkFrameGeometry(spec: Spec<'artwork-frame'>): BufferGeometry {
	const shape = artworkRingShape(
		spec.outerWidth,
		spec.outerHeight,
		spec.outerWidth - 2 * spec.faceMeters,
		spec.outerHeight - 2 * spec.faceMeters
	);
	return new ExtrudeGeometry(shape, { depth: spec.depth, bevelEnabled: false, steps: 1 });
}

export function artworkMatGeometry(spec: Spec<'artwork-mat'>): BufferGeometry {
	return new ShapeGeometry(artworkRingShape(spec.width, spec.height, spec.innerWidth, spec.innerHeight));
}

export function artworkBackingGeometry(spec: Spec<'artwork-backing'>): BufferGeometry {
	return new PlaneGeometry(spec.width, spec.height);
}
