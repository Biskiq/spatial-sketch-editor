<script lang="ts">
	import type { ViewportEvaluation } from '@portfolio/camera-core';
	import type { StageFacade } from '$lib/authoring/stage/stage-facade';
	import type { ArtworkHangGuide } from './artwork-hanging';

	let { guides, stage, evaluation, activeGuideId }: {
		guides: readonly ArtworkHangGuide[]; stage: StageFacade; evaluation: ViewportEvaluation;
		activeGuideId: string | null;
	} = $props();
	const lines = $derived.by(() => {
		const id = stage.evaluationId();
		if (id === null) return [];
		return guides.flatMap((guide) => {
			const a = stage.projectWorld(guide.start, id);
			const b = stage.projectWorld(guide.end, id);
			if (a.kind !== 'projected' || b.kind !== 'projected') return [];
			const ax = a.css[0] - evaluation.rect.left;
			const ay = a.css[1] - evaluation.rect.top;
			const bx = b.css[0] - evaluation.rect.left;
			const by = b.css[1] - evaluation.rect.top;
			const active = guide.id === activeGuideId;
			return [{
				id: guide.id, kind: guide.kind, active, ax, ay, bx, by,
				labelX: Math.min(ax, bx) + 4, labelY: Math.min(ay, by) - 6,
				label: guide.kind === 'eye' || active ? `${guide.label}${active ? ' · snapped' : ''}` : null
			}];
		});
	});
</script>

<svg class="artwork-hanging-guides" aria-hidden="true">
	{#each lines as line (line.id)}
		<line x1={line.ax} y1={line.ay} x2={line.bx} y2={line.by}
			stroke={line.active ? 'var(--shell-leaf-soft)' : 'var(--shell-ink-quiet)'}
			stroke-width={line.active ? 1.5 : 1}
			stroke-dasharray={line.kind === 'eye' ? '7 5' : '4 5'}
			vector-effect="non-scaling-stroke" />
		{#if line.label !== null}
			<text x={line.labelX} y={line.labelY} class:active={line.active}>{line.label}</text>
		{/if}
	{/each}
</svg>

<style>
	.artwork-hanging-guides {
		position: absolute; inset: 0; width: 100%; height: 100%;
		pointer-events: none; z-index: 3; overflow: visible;
	}
	text {
		font: 10px var(--shell-mono); fill: var(--shell-ink-light);
		paint-order: stroke; stroke: #11291f; stroke-width: 3px; stroke-linejoin: round;
	}
	text.active { fill: var(--shell-leaf-soft); }
</style>
