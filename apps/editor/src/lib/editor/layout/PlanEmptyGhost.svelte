<script lang="ts">
	import { worldToPlanScreen, type PlanViewportState } from './layout-plan-transform';

	let { planView }: { planView: PlanViewportState } = $props();

	// P23.13 S9 — neutral open-corner sketch: two wall-like legs meeting at a
	// corner with both far ends open (never a closed rect, never a dimension
	// promise). World-anchored at modest size, centered near the origin; text
	// is screen-space centered on the corner. Illustrative only: aria-hidden,
	// pointer-events none, never serialized.
	const sketch = $derived.by(() => {
		const corner = worldToPlanScreen(planView, [0, 0]);
		const horizontalStart = worldToPlanScreen(planView, [-2.5, -1.5]);
		const horizontalCorner = worldToPlanScreen(planView, [2.5, -1.5]);
		const verticalEnd = worldToPlanScreen(planView, [2.5, 1.5]);
		return {
			points: `${horizontalStart[0]},${horizontalStart[1]} ${horizontalCorner[0]},${horizontalCorner[1]} ${verticalEnd[0]},${verticalEnd[1]}`,
			center: corner
		};
	});
</script>

<g class="plan-empty-ghost" aria-hidden="true">
	<polyline class="ghost-corner" points={sketch.points} />
	<text class="ghost-title" x={sketch.center[0]} y={sketch.center[1] + 44} text-anchor="middle"
		>Start your plan</text
	>
	<text class="ghost-subtitle" x={sketch.center[0]} y={sketch.center[1] + 62} text-anchor="middle"
		>Draw connected walls with Wall, or start with</text
	>
	<text class="ghost-subtitle" x={sketch.center[0]} y={sketch.center[1] + 76} text-anchor="middle"
		>Rect Room or Poly Room.</text
	>
	<text class="ghost-hint" x={sketch.center[0]} y={sketch.center[1] + 98} text-anchor="middle"
		>Scroll to zoom · Middle-drag to pan</text
	>
</g>

<style>
	.plan-empty-ghost {
		pointer-events: none;
	}
	.ghost-corner {
		fill: none;
		stroke: #adb6bd;
		stroke-width: 8;
		stroke-linecap: square;
		stroke-linejoin: miter;
		vector-effect: non-scaling-stroke;
		pointer-events: none;
	}
	.ghost-title,
	.ghost-subtitle,
	.ghost-hint {
		pointer-events: none;
		font-family: var(--editor-font);
		paint-order: stroke;
		stroke: var(--editor-plan-canvas-bg);
		stroke-width: 3px;
		stroke-linejoin: round;
	}
	.ghost-title {
		fill: var(--editor-plan-muted);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.06em;
	}
	.ghost-subtitle {
		fill: var(--editor-plan-muted);
		font-size: 11px;
		font-weight: 500;
	}
	.ghost-hint {
		fill: var(--editor-plan-muted);
		font-size: 11px;
		font-weight: 500;
	}
</style>
