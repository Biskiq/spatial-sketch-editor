/** Batch the existing Paper polygons into renderer buffers, without changing
 * their triangulation, elevation, draw order or authored/Plan representation. */
import { Shape, ShapeGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PaperFillDraw } from './paper-plan';

export function createPaperFillGeometry(fills: readonly PaperFillDraw[]): BufferGeometry | null {
	const parts: BufferGeometry[] = [];
	try {
		for (const fill of fills) {
			for (const polygon of fill.polygons) {
				if (polygon.length < 3) continue;
				const shape = new Shape();
				shape.moveTo(polygon[0]![0], polygon[0]![1]);
				for (const point of polygon.slice(1)) shape.lineTo(point[0], point[1]);
				shape.closePath();
				parts.push(new ShapeGeometry(shape).rotateX(Math.PI / 2).translate(0, fill.elevationMeters, 0));
			}
		}
		if (parts.length === 0) return null;
		const merged = mergeGeometries(parts);
		if (merged === null) throw new Error('Paper fill buffers could not be batched');
		return merged;
	} finally {
		for (const part of parts) part.dispose();
	}
}
