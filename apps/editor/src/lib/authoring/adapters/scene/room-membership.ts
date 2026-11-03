import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { resolveSceneSupport, sceneSupportGenerationId } from '@portfolio/project-model/scene-planning';
import { localContactMinY, sceneModelContactMinY, sceneComposeSupport } from './placement';

/**
 * Organizational projection of an unambiguous, accepted physical contact. No writer.
 *
 * A lifted object (review pass 2 §6) has no contact; its reference is the
 * support directly beneath it, the same one every Scene planner re-derives its
 * lift from, so it stays grouped in that Room.
 */
export function acceptedSceneRoomMembership(envelope: ProjectEnvelope): ReadonlyMap<string, string> {
	const rooms = new Map<string, string>();
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
		if (identities.size === 1) rooms.set(entity.id, [...identities][0]!);
	}
	return rooms;
}
