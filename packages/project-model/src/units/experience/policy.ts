/**
 * Derive the runtime policy the interpreter needs from the **authored**
 * Experience unit (T3.P01.S06).
 *
 * `ExecutionProgram@4` has no detour slot, so the interpreter takes detours as
 * explicit policy. That policy is not a second authoring surface: this module
 * reads the selected Experience's own `detours`, checks their occurrence
 * closure, and returns exactly what the unit declares. A dangling detour refuses
 * instead of being dropped. Gates are retired (sheet §31): Manual pacing covers
 * waiting.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import.
 */

import type { ProjectEnvelope } from '../types';
import type { ExperienceDetourPolicy } from './interpreter';

export type ExperienceRuntimePolicy = {
	readonly detours: readonly ExperienceDetourPolicy[];
};

export type ExperienceRuntimePolicyResult =
	| { readonly kind: 'derived'; readonly policy: ExperienceRuntimePolicy }
	| { readonly kind: 'refused'; readonly message: string };

/**
 * Read one Experience's detour policy.
 *
 * A detour names two Stops of the same Experience
 * and the origin Stop to return to. Every identity is checked against the
 * selected Experience, so a stale or hand-written policy is refused rather than
 * silently changing the visitor's path.
 */
export function deriveExperienceRuntimePolicy(
	envelope: ProjectEnvelope,
	experienceId: string
): ExperienceRuntimePolicyResult {
	const experience = envelope.units.experience.data.experiences.find((candidate) => candidate.id === experienceId);
	if (experience === undefined) {
		return { kind: 'refused', message: `experience "${experienceId}" is not in this envelope` };
	}
	const stopIds = new Set(experience.stops.map((stop) => stop.id));
	const detours: ExperienceDetourPolicy[] = [];
	for (const detour of experience.detours) {
		if (!stopIds.has(detour.fromStopId) || !stopIds.has(detour.toStopId) || !stopIds.has(detour.returnToStopId)) {
			return {
				kind: 'refused',
				message: `Detour "${detour.id}" names a Stop this Experience does not carry`
			};
		}
		detours.push({
			fromStopId: detour.fromStopId,
			toStopId: detour.toStopId,
			returnToStopId: detour.returnToStopId
		});
	}
	return { kind: 'derived', policy: { detours } };
}
