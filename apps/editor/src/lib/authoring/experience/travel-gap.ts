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
	const prefix = `$.units.experience.data.experiences[${experienceIndex}].stops[${stopIndex}].transition`;
	return validation.diagnostics
		.filter((entry) => entry.code === 'travel-gap' && entry.path.startsWith(prefix))
		.map((entry) => entry.message);
}

/**
 * Every Stop's `travel-gap` findings for one Experience, from one validation of the
 * envelope. Stops with no finding are absent, so a reader treats a missing key as no
 * gap. The messages and their order are `travelGapMessages`'s.
 */
export function travelGapMessagesByStop(
	envelope: ProjectEnvelope,
	experienceId: string
): ReadonlyMap<string, readonly string[]> {
	const gaps = new Map<string, string[]>();
	const experienceIndex = envelope.units.experience.data.experiences.findIndex((entry) => entry.id === experienceId);
	if (experienceIndex < 0) return gaps;
	const stops = envelope.units.experience.data.experiences[experienceIndex].stops;
	const validation = validateProjectEnvelope(envelope);
	if (!validation.success) return gaps;
	const prefix = `$.units.experience.data.experiences[${experienceIndex}].stops[`;
	for (const entry of validation.diagnostics) {
		if (entry.code !== 'travel-gap' || !entry.path.startsWith(prefix)) continue;
		const stopIndex = Number(/^(\d+)\]\.transition/.exec(entry.path.slice(prefix.length))?.[1]);
		const stop = Number.isInteger(stopIndex) ? stops[stopIndex] : undefined;
		if (stop === undefined) continue;
		gaps.set(stop.id, [...(gaps.get(stop.id) ?? []), entry.message]);
	}
	return gaps;
}
