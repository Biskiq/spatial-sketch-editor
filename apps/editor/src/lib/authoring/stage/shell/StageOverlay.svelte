<script lang="ts">
	/**
	 * The Stage's overlay layer.
	 *
	 * Overlays are **not** a second projection: every mark's CSS geometry was
	 * produced by the same `ViewportEvaluation` the meshes were drawn with (the
	 * host projects it and passes CSS points). This component only paints and
	 * exposes keyboard focus for disclosure marks, so an overlay can never
	 * disagree with the render.
	 *
	 * Selection is drawn by the Stage's own Canvas/Paper layer, never here: this
	 * overlay owns **manipulation marks** (the shared ray/point/ring/track
	 * vocabulary) and the temporary task markers their owners still contribute.
	 * It is an absolutely positioned, `pointer-events: none` layer above the
	 * canvas; pointer hit testing happens through the Stage resolver, in the same
	 * CSS space.
	 */
	import type { StageMarkView } from '../stage-handles';

	let {
		markers,
		marks = [],
		tracePreview = null,
		onActivateDisclosure = () => {}
	}: {
		markers: readonly { id: string; css: readonly [number, number]; label: string }[];
		marks?: readonly StageMarkView[];
		tracePreview?: import('$lib/platform/perf-marks').PerfTracePreview | null;
		onActivateDisclosure?: (id: string) => void;
	} = $props();

	/** The four corners of an open arrowhead at the drag end. */
	function arrowhead(anchor: readonly [number, number], tip: readonly [number, number]): string {
		const dx = tip[0] - anchor[0];
		const dy = tip[1] - anchor[1];
		const length = Math.hypot(dx, dy);
		if (length === 0) return '';
		const ux = dx / length;
		const uy = dy / length;
		const backX = tip[0] - ux * 8;
		const backY = tip[1] - uy * 8;
		const nx = -uy * 4;
		const ny = ux * 4;
		return `${backX + nx},${backY + ny} ${tip[0]},${tip[1]} ${backX - nx},${backY - ny}`;
	}

	function tagWidth(text: string): number {
		return Math.max(34, Math.round(text.length * 6.1 + 10));
	}

	function onDisclosureKey(event: KeyboardEvent, id: string): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		event.stopPropagation();
		onActivateDisclosure(id);
	}
</script>

<svg class="overlay" role="group" aria-label="Stage manipulation marks" focusable="false">
	{#each markers as marker (marker.id)}
		<g class="task-marker marker" transform={`translate(${marker.css[0]} ${marker.css[1]})`}>
			<circle r="4" />
			<title>{marker.label}</title>
			{#if tracePreview && marker.id === 'layout-wall-preview'}
				<!-- Same SVG update and actual preview transform; no separate token clock. -->
				<rect x="-12" y="-12" width="24" height="24" fill="#ff00ff" />
			{/if}
		</g>
	{/each}

	{#each marks as mark (mark.id)}
		{@const tip = mark.tip ?? mark.anchor}
		{@const tail = mark.tail}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<g
			class="mark"
			class:active={mark.active}
			class:hovered={mark.hovered}
			class:disclose={mark.role === 'disclose'}
			data-mark-id={mark.id}
			data-mark-role={mark.role}
			role={mark.role === 'disclose' ? 'button' : undefined}
			tabindex={mark.role === 'disclose' ? 0 : undefined}
			aria-label={mark.role === 'disclose' ? mark.label : undefined}
			onkeydown={mark.role === 'disclose' ? (event) => onDisclosureKey(event, mark.id) : undefined}
		>
			<title>{mark.label}</title>
			{#if mark.kind === 'ray' || mark.kind === 'track'}
				<line
					class="halo"
					x1={mark.anchor[0]}
					y1={mark.anchor[1]}
					x2={tip[0]}
					y2={tip[1]}
				/>
				<line
					class="stroke"
					class:held={mark.active}
					x1={mark.anchor[0]}
					y1={mark.anchor[1]}
					x2={tip[0]}
					y2={tip[1]}
				/>
				<polyline class="halo arrow" points={arrowhead(mark.anchor, tip)} />
				<polyline class="stroke arrow" class:held={mark.active} points={arrowhead(mark.anchor, tip)} />
				{#if tail !== null}
					<!-- A two-way base ray says the subject slides either way; the
					     gesture and its planner are still the one mark's. -->
					<line
						class="halo"
						x1={mark.anchor[0]}
						y1={mark.anchor[1]}
						x2={tail[0]}
						y2={tail[1]}
					/>
					<line
						class="stroke"
						class:held={mark.active}
						x1={mark.anchor[0]}
						y1={mark.anchor[1]}
						x2={tail[0]}
						y2={tail[1]}
					/>
					<polyline class="halo arrow" points={arrowhead(mark.anchor, tail)} />
					<polyline class="stroke arrow" class:held={mark.active} points={arrowhead(mark.anchor, tail)} />
				{/if}
				<circle class="halo point" cx={mark.anchor[0]} cy={mark.anchor[1]} r="4.5" />
				<circle
					class="anchor"
					class:held={mark.active}
					cx={mark.anchor[0]}
					cy={mark.anchor[1]}
					r="3"
				/>
			{:else if mark.kind === 'ring'}
				<polyline
					class="halo"
					points={mark.ring?.map((point) => point.join(',')).join(' ') ?? ''}
				/>
				<polyline
					class="stroke"
					class:held={mark.active}
					points={mark.ring?.map((point) => point.join(',')).join(' ') ?? ''}
				/>
				<circle class="halo point" cx={mark.anchor[0]} cy={mark.anchor[1]} r="4.5" />
				<circle
					class="anchor"
					class:held={mark.active}
					cx={mark.anchor[0]}
					cy={mark.anchor[1]}
					r="3"
				/>
			{:else if mark.role === 'disclose'}
				<circle class="halo point" cx={mark.anchor[0]} cy={mark.anchor[1]} r="6" />
				<circle
					class="disclosure"
					class:open={mark.open}
					cx={mark.anchor[0]}
					cy={mark.anchor[1]}
					r="3.5"
				/>
			{:else}
				<circle class="halo point" cx={mark.anchor[0]} cy={mark.anchor[1]} r="4.5" />
				<circle
					class="anchor"
					class:held={mark.active}
					cx={mark.anchor[0]}
					cy={mark.anchor[1]}
					r="3"
				/>
			{/if}

			{#if (mark.hovered || mark.active) && (mark.tag !== '' || mark.refusal !== null)}
				{@const label = mark.refusal ?? mark.tag}
				{@const width = tagWidth(label)}
				<g class="tag" transform={`translate(${tip[0] + 10} ${tip[1] - 10})`}>
					<rect width={width} height="17" rx="2" />
					<text x="5" y="12" class:refused={mark.refusal !== null}>{label}</text>
				</g>
			{/if}
		</g>
	{/each}

	{#if tracePreview}
		<g data-perf-trace-proof transform="translate(8 8)">
			<rect x="-2" y="-2" width="132" height="132" fill="white" />
			{#each tracePreview.bits as bit, index}
				<rect x={(index % 8) * 16} y={Math.floor(index / 8) * 16} width="16" height="16" fill={bit ? '#000000' : '#ffffff'} />
			{/each}
		</g>
	{/if}
</svg>

<style>
	.overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
	}
	.task-marker circle {
		fill: none;
		stroke: #a6a6ad;
		stroke-width: 1.5;
	}
	.mark .halo {
		fill: none;
		stroke: #152c26;
		stroke-width: 3.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.mark .stroke {
		fill: none;
		stroke: #f3f4ee;
		stroke-width: 1.5;
		stroke-dasharray: 5 4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.mark .stroke.arrow {
		stroke-dasharray: none;
	}
	.mark .stroke.held,
	.mark .anchor.held {
		stroke: #d4ad45;
	}
	.mark .anchor.held {
		fill: #d4ad45;
	}
	.mark .point.halo {
		stroke-width: 3;
	}
	.mark .anchor {
		fill: #f3f4ee;
		stroke: #f3f4ee;
		stroke-width: 1.5;
	}
	.mark .disclosure {
		fill: none;
		stroke: #f3f4ee;
		stroke-width: 1.5;
	}
	.mark .disclosure.open {
		fill: #f3f4ee;
	}
	.mark.disclose:focus-visible {
		outline: 2px solid #d4ad45;
		outline-offset: 2px;
	}
	.mark .tag rect {
		fill: #152c26;
		stroke: #f3f4ee;
		stroke-opacity: 0.35;
		stroke-width: 0.5;
	}
	.mark .tag text {
		fill: #f3f4ee;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 10px;
		letter-spacing: 0.02em;
	}
	.mark .tag text.refused {
		fill: #f0b3ab;
	}
</style>
