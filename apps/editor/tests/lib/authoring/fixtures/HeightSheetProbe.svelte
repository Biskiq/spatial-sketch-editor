<script lang="ts">
	/** R217.S22 — one Stage session holding the Height Sheet, the way the Stage host does. */
	import StageHeightSheet from '$lib/authoring/stage/shell/StageHeightSheet.svelte';
	import type { StageHeightCause, StageHeightTick } from '$lib/authoring/stage/stage-height-sheet';

	let {
		heightMeters = 1.2,
		pins = [],
		ticks = [],
		onSetHeight,
		onAddPin = () => {}
	}: {
		heightMeters?: number;
		pins?: readonly number[];
		ticks?: readonly StageHeightTick[];
		onSetHeight: (heightMeters: number, cause: StageHeightCause) => void;
		onAddPin?: () => void;
	} = $props();
</script>

<StageHeightSheet
	{heightMeters}
	{ticks}
	{pins}
	snapIncrement={0.1}
	{onSetHeight}
	{onAddPin}
	onActiveChange={() => {}}
	onResetSubscribe={() => () => {}}
/>
