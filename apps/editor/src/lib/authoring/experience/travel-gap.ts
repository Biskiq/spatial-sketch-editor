import { validateProjectEnvelope, type ProjectEnvelope } from '@portfolio/project-model/units';

/**
 * The `travel-gap` findings the envelope validator already computes for one
 * Stop's outgoing edge. This is a filter over those findings, not a second gap
 * computation, and it never evaluates Camera.
 */
export function travelGapMessages(
	envelope: ProjectEnvelope,
	experienceId: string,
	stopId: string
): readonly string[] {
	const experienceIndex = envelope.units.experience.data.experiences.findIndex((entry) => entry.id === experienceId);
	if (experienceIndex < 0) return [];
	const stopIndex = envelope.units.experience.data.experiences[experienceIndex].stops.findIndex(
		(entry) => entry.id === stopId
	);
	if (stopIndex < 0) return [];
	const validation = validateProjectEnvelope(envelope);
	if (!validation.success) return [];
	const prefix = `$.units.experience.data.experiences[${experienceIndex}].stops[${stopIndex}].continuation`;
	return validation.diagnostics
		.filter((entry) => entry.code === 'travel-gap' && entry.path.startsWith(prefix))
		.map((entry) => entry.message);
}
