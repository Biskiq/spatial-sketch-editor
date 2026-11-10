<script lang="ts">
	/**
	 * One Stage state pill for a long-running reading.
	 *
	 * The unroll reading is the first use. The pill does not depend on
	 * selection: it stays while an Opening on the sheet is selected, which is
	 * exactly why the face switch and Put back live here rather than in the
	 * Wall Card. Forest glass like the dock; gold only on the exit action.
	 */
	import type { CompiledPhysicalWall } from '@portfolio/layout-core';
	import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';

	let {
		wall,
		name,
		roomName = null
	}: {
		wall: CompiledPhysicalWall | null;
		name: string | null;
		roomName?: string | null;
	} = $props();

	const state = $derived(wall === null ? null : wallUnfold.state?.wallId === wall.wallId ? wallUnfold.state : null);
	const nearFace = $derived(roomName === null ? 'Inside' : `${roomName} side`);
	const farFace = $derived(roomName === null ? 'Outside' : 'Outside');
	// The Stage root begins a pointer gesture from bubbled presses. Stop the
	// pill's own press here so its first click is a click, not pointer capture.
	function holdStage(event: Event): void {
		event.stopPropagation();
	}
</script>

{#if state !== null && wall !== null}
	<div
		class="stage-pill"
		role="toolbar"
		aria-label="Wall sheet"
		tabindex="-1"
		data-stage-pill
		data-stage-pill-u={Math.round(state.u * 100)}
		onpointerdown={holdStage}
	>
		<span class="reading">Unrolled · {name ?? 'Wall'}</span>
		<span class="seg" role="group" aria-label="Sheet face">
			<button
				type="button"
				aria-pressed={state.side === 1}
				data-stage-pill-face={nearFace}
				onclick={() => { if (state.side !== 1) wallUnfold.flip(wall); }}
			>{nearFace}</button>
			<button
				type="button"
				aria-pressed={state.side === -1}
				data-stage-pill-face={farFace}
				onclick={() => { if (state.side !== -1) wallUnfold.flip(wall); }}
			>{farFace}</button>
		</span>
		<button type="button" class="put" data-stage-pill-put-back onclick={() => wallUnfold.exit(wall)}>
			Put back
		</button>
	</div>
{/if}

<style>
	.stage-pill {
		position: absolute;
		/* Below the top 2D/3D row; the centred narrow pill keeps the side Card
		   and the top controls in their own safe areas. */
		top: calc(env(safe-area-inset-top, 0px) + 56px);
		left: 50%;
		z-index: 20;
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: min(440px, calc(100% - 32px));
		padding: 5px 6px 5px 12px;
		transform: translateX(-50%);
		border-radius: 99px;
		background: rgba(17, 41, 31, 0.95);
		color: #eef1ec;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
		font-size: 12px;
		white-space: nowrap;
	}
	.reading {
		overflow: hidden;
		color: #9fd3b6;
		font: 500 11px var(--shell-mono);
		letter-spacing: 0.06em;
		text-overflow: ellipsis;
		text-transform: uppercase;
	}
	.seg {
		display: flex;
		padding: 2px;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.1);
	}
	button {
		min-height: 24px;
		padding: 2px 9px;
		border: 0;
		border-radius: 99px;
		background: transparent;
		color: #cfd8d1;
		font: inherit;
		cursor: pointer;
	}
	button[aria-pressed='true'] {
		background: #eef1ec;
		color: #11291f;
	}
	.put {
		padding: 3px 11px;
		background: var(--shell-gold);
		color: #241d0b;
		font-weight: 600;
	}
	@media (pointer: coarse) {
		button {
			min-height: 44px;
		}
	}
</style>
