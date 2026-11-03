<script lang="ts">
	/**
	 * Mounts one Experience home beneath a fake homes context (R217.S25).
	 *
	 * The route provides the homes in its own tree through `provideExperienceHomes`. A test
	 * has no route, so this probe makes the same call with the test's homes, then renders the
	 * home it was given as its child. Nothing else is provided: no Stage, no route.
	 */
	import { untrack, type Component } from 'svelte';
	import { provideExperienceHomes, type ExperienceHomes } from '$lib/authoring/experience/experience-homes';

	let {
		homes,
		home: Home,
		homeProps = {}
	}: {
		homes: ExperienceHomes;
		home: Component<any>;
		homeProps?: Record<string, unknown>;
	} = $props();

	// Read once, as the route provides them once: the homes are a fixed set for one mount.
	provideExperienceHomes(untrack(() => homes));
</script>

<Home {...homeProps} />
