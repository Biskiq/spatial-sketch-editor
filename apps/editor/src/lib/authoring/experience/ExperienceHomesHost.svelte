<script lang="ts">
	/**
	 * Creates the Experience controller and publishes it to the route (R217.S25).
	 *
	 * It renders nothing. The route mounts it only while the Experience lens is open, so
	 * the controller adopts the first Experience when the lens is entered, as the old
	 * surface did, and is destroyed with the lens. The Index, the Card's writers and the
	 * lower edge all read this one controller; none of them makes its own.
	 */
	import type { StageAdapterServices } from '../stage/stage-adapter-host';
	import type { ProjectEnvelope } from '@portfolio/project-model/units';
	import { createExperienceController, type ExperienceController } from './experience-controller.svelte';

	let {
		services,
		snapshot,
		controller = $bindable(null)
	}: {
		services: StageAdapterServices;
		snapshot: ProjectEnvelope;
		controller?: ExperienceController | null;
	} = $props();

	// Getters: the route can replace the services or the snapshot without remounting this host.
	controller = createExperienceController(
		() => services,
		() => snapshot
	);
</script>
