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
	 *
	 * R217.S10 adds the host tools' own marks: Measure's dimension line with its
	 * mono tag, and the Eraser's words beside the pointer. Both are drawn here,
	 * never written anywhere.
	 */
	import type { StageMarkView } from '../stage-handles';
	import type { StageCandidatePreviewView } from '../stage-facade';

	let {
		markers,
		marks = [],
		candidates = [],
		tracePreview = null,
		hostTools = null,
		onActivateDisclosure = () => {}
	}: {
		markers: readonly { id: string; css: readonly [number, number]; label: string }[];
		marks?: readonly StageMarkView[];
		candidates?: readonly StageCandidatePreviewView[];
		tracePreview?: import('$lib/platform/perf-marks').PerfTracePreview | null;
		hostTools?: {
			readonly measure: { readonly from: readonly [number, number]; readonly to: readonly [number, number]; readonly label: string; readonly live: boolean } | null;
			readonly notice: { readonly css: readonly [number, number]; readonly message: string; readonly kind: string } | null;
		} | null;
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

	/**
	 * Candidate reasons are full sentences, not marker words. Wrap them by word
	 * count so a long refusal stays readable without measuring the Stage: the
	 * overlay owns no layout read of its own.
	 */
	function labelLines(text: string, maxChars = 46): readonly string[] {
		if (text.length <= maxChars) return [text];
		const lines: string[] = [];
		let line = '';
		const flush = (): void => {
			if (line !== '') lines.push(line);
			line = '';
		};
		for (const word of text.split(' ')) {
			// An id can be longer than a whole readable line. Hard-split it rather
			// than let one unbreakable token push the tag past the Stage edge.
			if (word.length > maxChars) {
				flush();
				for (let offset = 0; offset < word.length; offset += maxChars) {
					lines.push(word.slice(offset, offset + maxChars));
				}
				continue;
			}
			const next = line === '' ? word : `${line} ${word}`;
			if (next.length <= maxChars) line = next;
			else {
				flush();
				line = word;
			}
		}
		flush();
		return lines;
	}

	/** The two short end ticks of a dimension line, perpendicular to it. */
	function dimensionTicks(from: readonly [number, number], to: readonly [number, number]): string {
		const dx = to[0] - from[0];
		const dy = to[1] - from[1];
		const length = Math.hypot(dx, dy);
		if (length === 0) return '';
		const nx = (-dy / length) * 5;
		const ny = (dx / length) * 5;
		return `M${from[0] + nx},${from[1] + ny} L${from[0] - nx},${from[1] - ny} M${to[0] + nx},${to[1] + ny} L${to[0] - nx},${to[1] - ny}`;
	}

	/** One projected polygon as an SVG path, in the overlay's CSS space. */
	function polygonPath(points: readonly (readonly [number, number])[]): string {
		return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0]},${point[1]}`).join(' ')} Z`;
	}

	function onDisclosureKey(event: KeyboardEvent, id: string): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		event.stopPropagation();
		onActivateDisclosure(id);
	}
</script>

<svg class="overlay" role="group" aria-label="Stage manipulation marks" focusable="false">
	{#each candidates as candidate (candidate.id)}
		<g
			class="candidate"
			class:subject={candidate.role === 'subject'}
			class:affected={candidate.role === 'affected'}
			class:refused={candidate.role === 'refused'}
			data-candidate-id={candidate.id}
			data-candidate-role={candidate.role}
		>
			{#each candidate.polygons as polygon, index (`${candidate.id}:polygon:${index}`)}
				<path class="candidate-fill" d={polygonPath(polygon)} />
				<path class="candidate-edge" d={polygonPath(polygon)} />
			{/each}
			{#each candidate.segments as segment, index (`${candidate.id}:segment:${index}`)}
				<line class="candidate-edge" x1={segment[0][0]} y1={segment[0][1]} x2={segment[1][0]} y2={segment[1][1]} />
			{/each}
			{#each candidate.labels as label, index (`${candidate.id}:label:${index}`)}
				{@const lines = labelLines(label.text)}
				{@const width = Math.max(...lines.map((line) => tagWidth(line))) + 10}
				<!-- The tag sits above the snap mark at the same point, so the two
				     never overprint each other. -->
				<g class="tag" transform={`translate(${label.css[0] + 10} ${label.css[1] - 26 - index * 20})`}>
					<rect width={width} height={6 + lines.length * 12} rx="2" />
					{#each lines as line, lineIndex (`${candidate.id}:label:${index}:${lineIndex}`)}
						<text x="5" y={12 + lineIndex * 12}>{line}</text>
					{/each}
				</g>
			{/each}
			{#if candidate.snap}
				<g class="candidate-snap" data-snap-name={candidate.snap.name} transform={`translate(${candidate.snap.css[0]} ${candidate.snap.css[1]})`}>
					<circle r="4" />
					<text x="7" y="3">{candidate.snap.name}</text>
				</g>
			{/if}
		</g>
	{/each}

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

	{#if hostTools?.measure}
		{@const dimension = hostTools.measure}
		{@const middle = [(dimension.from[0] + dimension.to[0]) / 2, (dimension.from[1] + dimension.to[1]) / 2]}
		<g class="mark dimension" class:live={dimension.live} data-measure data-measure-label={dimension.label}>
			<line class="halo" x1={dimension.from[0]} y1={dimension.from[1]} x2={dimension.to[0]} y2={dimension.to[1]} />
			<line class="dimension-line" x1={dimension.from[0]} y1={dimension.from[1]} x2={dimension.to[0]} y2={dimension.to[1]} />
			<path class="halo" d={dimensionTicks(dimension.from, dimension.to)} />
			<path class="dimension-line" d={dimensionTicks(dimension.from, dimension.to)} />
			<g class="tag" transform={`translate(${middle[0] + 8} ${middle[1] - 22})`}>
				<rect width={tagWidth(dimension.label)} height="17" rx="2" />
				<text x="5" y="12">{dimension.label}</text>
			</g>
		</g>
	{/if}

	{#if hostTools?.notice}
		{@const words = hostTools.notice}
		<g class="mark tag-only" data-erase-notice={words.kind} transform={`translate(${words.css[0] + 12} ${words.css[1] + 12})`}>
			<g class="tag">
				<rect width={tagWidth(words.message)} height="17" rx="2" />
				<text x="5" y="12" class:refused={words.kind === 'refused'}>{words.message}</text>
			</g>
			<title>{words.message}</title>
		</g>
	{/if}

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
	.candidate .candidate-fill {
		fill: transparent;
		stroke: none;
	}
	.candidate.subject .candidate-fill {
		fill: rgb(212 173 69 / 0.18);
	}
	.candidate .candidate-edge {
		fill: none;
		stroke: #f3f4ee;
		stroke-width: 1.25;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.candidate.subject .candidate-edge {
		stroke: #d4ad45;
		stroke-width: 1.5;
	}
	.candidate.affected .candidate-edge {
		stroke-opacity: 0.55;
	}
	.candidate.refused .candidate-edge {
		stroke-opacity: 0.7;
		stroke-dasharray: 4 3;
	}
	.candidate-snap circle {
		fill: none;
		stroke: #d4ad45;
		stroke-width: 1.5;
	}
	.candidate-snap text {
		fill: #f3f4ee;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 10px;
		paint-order: stroke;
		stroke: #152c26;
		stroke-width: 2.5;
	}
	.candidate .tag rect {
		fill: #152c26;
		stroke: #f3f4ee;
		stroke-opacity: 0.35;
		stroke-width: 0.5;
	}
	.candidate .tag text {
		fill: #f3f4ee;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 10px;
		letter-spacing: 0.02em;
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
	.dimension .dimension-line {
		fill: none;
		stroke: #f3f4ee;
		stroke-width: 1.25;
		stroke-linecap: round;
	}
	.dimension.live .dimension-line {
		stroke-dasharray: 4 3;
	}
</style>
