/**
 * Mounts the Experience lens controller outside a component (R217.S24).
 *
 * The controller starts effects, so it must be created inside an effect root. Runes
 * are compiled only in `.svelte.ts` modules, which is why the mount lives here and not
 * in the plain test file. The snapshot cell is a real dependency: assigning `value`
 * re-derives the controller's reading, as the route's own snapshot update does.
 */
import { flushSync } from 'svelte';
import {
	createExperienceController,
	type ExperienceController
} from '$lib/authoring/experience/experience-controller.svelte';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

export function mountExperienceController(
	readServices: () => StageAdapterServices,
	readSnapshot: () => ProjectEnvelope | null
): { readonly controller: ExperienceController; readonly flush: () => void; readonly dispose: () => void } {
	const box: { controller?: ExperienceController } = {};
	const dispose = $effect.root(() => {
		box.controller = createExperienceController(readServices, readSnapshot);
	});
	flushSync();
	if (box.controller === undefined) throw new Error('the Experience controller did not mount');
	return { controller: box.controller, flush: () => flushSync(), dispose };
}

export function snapshotCell(initial: ProjectEnvelope) {
	let value = $state(initial);
	return {
		get value(): ProjectEnvelope {
			return value;
		},
		set value(next: ProjectEnvelope) {
			value = next;
		}
	};
}
