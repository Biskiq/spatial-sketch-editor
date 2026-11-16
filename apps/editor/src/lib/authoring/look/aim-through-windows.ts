import { pointInPolygon, type CompiledLayoutGeometry } from '@portfolio/layout-core';
import { wrap360 } from '$lib/render/sky-time';

export function aimThroughWindows(geometry: CompiledLayoutGeometry): number | null {
	let x = 0;
	let z = 0;
	const walls = geometry.walls.length > 0 ? geometry.walls : geometry.rooms.flatMap((room) => room.walls);
	for (const wall of walls) {
		for (const opening of wall.openings) {
			if (opening.kind !== 'window') continue;
			const { point, normal } = opening.center;
			const distance = wall.thickness / 2 + 0.05;
			const inside = (side: number) => geometry.rooms.some(({ floorPolygon }) => pointInPolygon([
				point[0] + side * normal[0] * distance,
				point[1] + side * normal[1] * distance
			], floorPolygon));
			const positive = inside(1);
			const negative = inside(-1);
			if (positive === negative) continue;
			const weight = (positive ? -1 : 1) * opening.width * opening.height;
			x += weight * normal[0];
			z += weight * normal[1];
		}
	}
	if (Math.hypot(x, z) < 1e-9) return null;
	return wrap360(Math.round(Math.atan2(x, -z) * 180 / Math.PI));
}
