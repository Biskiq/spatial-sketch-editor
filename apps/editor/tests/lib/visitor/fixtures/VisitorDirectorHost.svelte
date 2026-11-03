<script lang="ts">
	import type { NavigationGraph } from '@portfolio/project-model';
	import VisitorCameraDirector from '$lib/visitor/VisitorCameraDirector.svelte';
	import type { VisitorRuntimeState } from '$lib/visitor/visitor-runtime-state.svelte';

	let {
		graph,
		visitor,
		timeAligned,
		onCameraGap
	}: {
		readonly graph: NavigationGraph;
		readonly visitor: VisitorRuntimeState;
		readonly timeAligned: boolean;
		readonly onCameraGap?: (message: string | null) => void;
	} = $props();

	let override = $state<string | null>(null);
	let suspendGuidance = $state(false);
	let destinationEpoch = $state(0);
	export function setOverride(viewId: string | null): void {
		override = viewId;
	}
	export function enterFree(): void {
		override = null;
		suspendGuidance = true;
		destinationEpoch += 1;
	}
	export function choosePlace(presentationId: string): void {
		if (visitor.selectPresentation(presentationId)) destinationEpoch += 1;
	}
</script>

<VisitorCameraDirector
	{graph}
	{visitor}
	{timeAligned}
	{onCameraGap}
	viewOverride={override}
	{suspendGuidance}
	{destinationEpoch}
/>
