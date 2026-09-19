<!--
	P23.14 §8 — Domain Spine. The 56 px vertical Spine is the exclusive home of
	the primary domain axis (the perpendicular signature: Scene/Camera run
	vertically, Plan/3D run horizontally).

	Two persistent stations only. The active station carries a restrained 3 px
	inboard edge-light in its domain accent — never a full-surface fill. The
	lower spine stays deliberately empty: breathing room and future capacity,
	not an invitation to toolbar accretion (§8, §24).

	Pure presentation over the existing `EditorViewState`; the domain switch
	keeps its `canSwitch` (editor-interaction) guard from the retired ribbon
	Zone A, and view switches stay on the View Bar (`WorkspaceRibbon.svelte`).
-->
<script lang="ts">
	import { Building2, Camera } from 'lucide-svelte';
	import type { EditorViewState } from './editor-view-state.svelte';

	let { viewState, canSwitch = true }: { viewState: EditorViewState; canSwitch?: boolean } =
		$props();

	const stations = [
		{ id: 'scene', label: 'Scene', icon: Building2 },
		{ id: 'camera', label: 'Camera', icon: Camera }
	] as const;

	function choose(domain: 'scene' | 'camera'): void {
		if (canSwitch) viewState.setDomain(domain);
	}
</script>

<aside class="domain-spine" aria-label="Domain">
	<div role="group" aria-label="Editor domain" class="stations">
		{#each stations as station (station.id)}
			<button
				type="button"
				class="station"
				class:active={viewState.domain === station.id}
				data-domain={station.id}
				aria-pressed={viewState.domain === station.id}
				disabled={!canSwitch}
				title={station.label}
				onclick={() => choose(station.id)}
			>
				<station.icon size={24} aria-hidden="true" />
				<span class="station-label">{station.label}</span>
			</button>
		{/each}
	</div>
</aside>

<style>
	.domain-spine {
		grid-area: spine;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		/* §4 — recessed CHASSIS step; square corners, hairline separation. */
		background: var(--editor-bg-recess);
		border-right: 1px solid var(--editor-border-subtle);
		/* Stations start below the Project Head band so the spine reads as the
		   full-height rail the head sits beside (§5 geometry). */
		padding-top: var(--editor-project-row-height);
	}
	.stations {
		display: flex;
		flex-direction: column;
	}
	/* Atlas `.station`: 55 × 74 px, 11 px label in the domain's own casing
	   ("Scene" / "Camera", not an engraved uppercase token — §8 names them that
	   way), icon 24 px, recess → raised step when active, plus the 3 px inboard
	   edge-light. */
	.station {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		box-sizing: border-box;
		width: 100%;
		height: var(--editor-station-height);
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--editor-text-secondary);
		font: var(--editor-type-station);
		cursor: pointer;
	}
	.station:hover:not(:disabled) {
		background: var(--editor-bg-hover);
		color: var(--editor-text-primary);
	}
	.station.active {
		background: var(--editor-bg-panel-raised);
		color: var(--editor-text-primary);
		font-weight: 700;
	}
	.station :global(svg) {
		width: var(--editor-icon-size-lg);
		height: var(--editor-icon-size-lg);
	}
	/* The 3 px inboard edge-light is the ONLY domain color on the spine (plus
	   the label weight change, so state never reads by hue alone, §18). */
	.station::after {
		content: '';
		position: absolute;
		inset-block: 10px;
		right: 0;
		width: 3px;
		background: transparent;
	}
	.station.active::after {
		background: var(--station-accent);
	}
	.station[data-domain='scene'] {
		--station-accent: var(--editor-domain-scene);
	}
	.station[data-domain='camera'] {
		--station-accent: var(--editor-domain-camera);
	}
	.station:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.station-label {
		white-space: nowrap;
	}
	@media (prefers-reduced-motion: reduce) {
		.station {
			transition: none;
		}
	}
</style>
