<script lang="ts">
	/**
	 * R217.S22 — one Stage session holding the Height Sheet, the way the Stage host does.
	 * The host owns `pinHintSeen`, so a probe mounted afresh is a fresh Stage session.
	 */
	import StageHeightSheet from '$lib/authoring/stage/shell/StageHeightSheet.svelte';
	import type { StageHeightCause, StageHeightTick } from '$lib/authoring/stage/stage-height-sheet';

	let {
		heightMeters = 1.2,
		pins = [],
		ticks = [],
		onSetHeight,
		onAddPin,
		onRemovePin
	}: {
		heightMeters?: number;
		pins?: readonly number[];
		ticks?: readonly StageHeightTick[];
		onSetHeight: (heightMeters: number, cause: StageHeightCause) => void;
		onAddPin: () => void;
		onRemovePin: (heightMeters: number) => void;
	} = $props();

	let pinHintSeen = $state(false);
</script>

<StageHeightSheet
	{heightMeters}
	{ticks}
	{pins}
	snapIncrement={0.1}
	{pinHintSeen}
	onPinHintSeen={() => (pinHintSeen = true)}
	{onSetHeight}
	{onAddPin}
	{onRemovePin}
	onActiveChange={() => {}}
	onResetSubscribe={() => () => {}}
/>
