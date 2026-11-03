import { faceArea, type CompiledLayoutGeometry, type LayoutVec2 } from '@portfolio/layout-core';

/** Presentation over the compiler's usable floor. No Room is inferred from a draft. */
export function roomLabelFacts(geometry: CompiledLayoutGeometry, rooms: readonly { id: string; name: string }[]) {
	const names = new Map(rooms.map(room => [room.id, room.name]));
	return geometry.rooms.flatMap(room => {
		const polygon = room.floorPolygon;
		const area = faceArea({ polygon });
		if (!Number.isFinite(area) || area <= 0 || polygon.length < 3) return [];
		// A midpoint of an interior scan interval is inside even for a concave floor.
		// Sample between vertex heights, avoiding ambiguous vertex intersections.
		const heights = [...new Set(polygon.map(point => point[1]))].sort((a, b) => a - b);
		let best: { point: LayoutVec2; span: number } | null = null;
		for (let i = 1; i < heights.length; i++) {
			const y = (heights[i - 1]! + heights[i]!) / 2;
			const intersections: number[] = [];
			for (let j = 0; j < polygon.length; j++) {
				const a = polygon[j]!; const b = polygon[(j + 1) % polygon.length]!;
				if ((a[1] > y) !== (b[1] > y)) intersections.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
			}
			intersections.sort((a, b) => a - b);
			for (let j = 1; j < intersections.length; j += 2) {
				const span = intersections[j]! - intersections[j - 1]!;
				if (span > 0 && (best === null || span > best.span)) best = { point: [(intersections[j]! + intersections[j - 1]!) / 2, y], span };
			}
		}
		if (!best) return [];
		return [{ id: room.roomId, name: names.get(room.roomId) || 'Room', area, world: [best.point[0], room.floorElevation, best.point[1]] as [number, number, number], span: best.span }];
	});
}
export type RoomLabelView = { id: string; name: string; area: number; css: readonly [number, number] };
/** Hide labels too small for the text or overlapping a prior label, at any DPR. */
export function projectRoomLabels(facts: ReturnType<typeof roomLabelFacts>, project: (point: [number, number, number]) => readonly [number, number] | null, metersPerCssPixel: number): readonly RoomLabelView[] {
	const labels: RoomLabelView[] = [];
	for (const fact of facts) {
		const width = Math.max(60, fact.name.length * 6);
		if (!(metersPerCssPixel > 0) || fact.span / metersPerCssPixel < width + 12) continue;
		const css = project(fact.world);
		if (!css || labels.some(label => Math.abs(label.css[0] - css[0]) < (Math.max(60, label.name.length * 6) + width) / 2 + 8 && Math.abs(label.css[1] - css[1]) < 38)) continue;
		labels.push({ id: fact.id, name: fact.name, area: fact.area, css });
	}
	return labels;
}
