import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { roomBoundaryPolygon } from '@portfolio/layout-core';
import { resolveSceneSupport, sceneSupportGenerationId } from '@portfolio/project-model/scene-planning';
import { localContactMinY, sceneModelContactMinY, sceneComposeSupport } from './placement';

/**
 * Organizational projection of an unambiguous, accepted physical contact. No writer.
 *
 * A lifted object (review pass 2 §6) has no contact; its reference is the
 * support directly beneath it, the same one every Scene planner re-derives its
 * lift from, so it stays grouped in that Room.
 */
/**
 * The innermost of several containing Spaces, by compiled floor area. Equal
 * areas break by id so witness order is never authority. Exported for the
 * projection's regression test; production reads it through membership below.
 */
export function innermostRoomId(
	roomIds: Iterable<string>,
	floorArea: (roomId: string) => number
): string | null {
	let best: { readonly id: string; readonly area: number } | null = null;
	for (const id of roomIds) {
		const area = floorArea(id);
		if (
			best === null ||
			area < best.area - 1e-9 ||
			(Math.abs(area - best.area) <= 1e-9 && id < best.id)
		) {
			best = { id, area };
		}
	}
	return best?.id ?? null;
}

export function acceptedSceneRoomMembership(envelope: ProjectEnvelope): ReadonlyMap<string, string> {
	const rooms = new Map<string, string>();
	// Area is read from the authored boundary outline (open sides included); this
	// projection never re-composes or compiles geometry.
	const layout = envelope.units.layout.data;
	const floorArea = (roomId: string): number => {
		const polygon = roomBoundaryPolygon(layout, roomId);
		if (polygon === null) return Infinity;
		let twice = 0;
		for (let index = 0; index < polygon.length; index += 1) {
			const current = polygon[index]!;
			const next = polygon[(index + 1) % polygon.length]!;
			twice += current[0] * next[1] - next[0] * current[1];
		}
		return Math.abs(twice) / 2;
	};
	for (const entity of envelope.units.scene.data.entities) {
		const contact = localContactMinY(entity, entity.kind === 'model' ? sceneModelContactMinY(envelope, entity) : null);
		if (contact === null || !sceneComposeSupport(entity, contact).duplicate) continue;
		const scale = entity.kind === 'form' ? 1 : entity.scale ?? 1;
		const base = entity.position[1] + contact * scale;
		const support = (requiredElevation: number | null) => resolveSceneSupport({
			layout: envelope.units.layout.data,
			sourceContentId: envelope.units.layout.header.contentRevision,
			point: [entity.position[0], entity.position[2]],
			requiredElevation
		});
		let resolved = support(base);
		if (resolved.kind !== 'resolved') {
			const beneath = support(null);
			if (beneath.kind === 'resolved' && base > beneath.support.elevation) resolved = beneath;
		}
		if (resolved.kind !== 'resolved' || resolved.generationId !== sceneSupportGenerationId(envelope.units.layout.header.contentRevision)) continue;
		const identities = new Set(resolved.support.witnesses.map(witness => witness.roomId));
		if (identities.size === 1) {
			rooms.set(entity.id, [...identities][0]!);
		} else if (identities.size > 1) {
			// Innermost wins: an object in a booth inside a hall belongs to the booth.
			const innermost = innermostRoomId(identities, floorArea);
			if (innermost !== null) rooms.set(entity.id, innermost);
		}
	}
	return rooms;
}
