/**
 * The Light shelf's one session arm.
 *
 * The shelf and the light adapter are separate modules, and the adapter is
 * rebuilt for every accepted snapshot. The arm is the small piece of session
 * intent that crosses that rebuild: which light kind the creator picked, for
 * which project. It writes no source and survives no project replacement.
 */
import type { SceneLightEntity } from '@portfolio/project-model';

export type ArmedLightKind = SceneLightEntity['light'];

let armed = $state<{ readonly projectId: string; readonly kind: ArmedLightKind } | null>(null);

export function armLight(projectId: string, kind: ArmedLightKind): void {
	armed = { projectId, kind };
}

export function armedLightKind(projectId: string): ArmedLightKind | null {
	return armed?.projectId === projectId ? armed.kind : null;
}

export function clearArmedLight(): void {
	armed = null;
}
