/**
 * Per-entity identity of a compiled Layout, for E1's changed-set diff.
 *
 * Each compiled record is keyed by the authored entity it belongs to; an
 * Opening is keyed separately from its host Wall. Derived query geometry is an
 * index product, not an entity, and is excluded.
 */
import type { CompiledLayoutGeometry } from '@portfolio/layout-core';

export function compiledEntities(geometry: CompiledLayoutGeometry): Map<string, string> {
	const entities = new Map<string, string>();
	for (const floor of geometry.floors) entities.set(`floor:${floor.floorId}`, JSON.stringify(floor));
	for (const room of geometry.rooms) entities.set(`room:${room.roomId}`, JSON.stringify(room));
	for (const junction of geometry.junctions ?? []) entities.set(`junction:${junction.junctionId}`, JSON.stringify(junction));
	for (const wall of geometry.walls ?? []) {
		const { openings, ...body } = wall;
		entities.set(`wall:${wall.wallId}`, JSON.stringify(body));
		for (const opening of openings) entities.set(`opening:${opening.openingId}`, JSON.stringify(opening));
	}
	for (const object of geometry.objects ?? []) entities.set(`object:${object.id}`, JSON.stringify(object));
	return entities;
}

/** Entities whose compiled output differs (changed, added or removed). */
export function changedEntities(before: Map<string, string>, after: Map<string, string>): string[] {
	const changed: string[] = [];
	for (const [key, value] of after) if (before.get(key) !== value) changed.push(key);
	for (const key of before.keys()) if (!after.has(key)) changed.push(key);
	return changed;
}
