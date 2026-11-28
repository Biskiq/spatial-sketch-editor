/**
 * The one armed group copy, per project.
 *
 * D8p itself never opens a Library or Fixtures entry point. D8d and D8f arm a
 * copy here; the binding reads the same project's arm on every bind, so a
 * reading change resumes the tool instead of silently disarming it. This is
 * session state, never authored data: nothing here reaches the Scene, history
 * or Save.
 */
import type { GroupTemplate } from '@portfolio/project-model/scene-planning';

/** Where a group copy derives its origin from. */
export type GroupCopyOriginMode = 'support' | 'overhead' | 'wall';

/** One group template armed for placement. */
export type ArmedGroupCopy = {
	/** The canonical template, re-read strictly when the session arms. */
	readonly template: GroupTemplate;
	/** The captured cluster name; G1's collision suffix is applied on placement. */
	readonly name: string;
	readonly origin: GroupCopyOriginMode;
};

const armedByProject = new Map<string, ArmedGroupCopy>();

/** Arm one project's group copy; `null` clears it. */
export function armGroupCopy(projectId: string, copy: ArmedGroupCopy | null): void {
	if (copy === null) armedByProject.delete(projectId);
	else armedByProject.set(projectId, copy);
}

/** The project's armed group copy, or `null`. */
export function peekArmedGroupCopy(projectId: string): ArmedGroupCopy | null {
	return armedByProject.get(projectId) ?? null;
}

/** Clear one project's armed group copy. */
export function clearArmedGroupCopy(projectId: string): void {
	armedByProject.delete(projectId);
}
