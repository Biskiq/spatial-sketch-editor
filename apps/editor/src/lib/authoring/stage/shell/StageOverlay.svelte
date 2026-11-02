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

	let problemOpen = $state<string | null>(null);
	let {
		markers,
		marks = [],
		roomLabels = [],
		candidates = [],
		viewportWidth = 0,
		viewportHeight = 0,
		tracePreview = null,
		hostTools = null,
		lightGround = false,
		onActivateDisclosure = () => {}
	}: {
		markers: readonly { id: string; css: readonly [number, number]; label: string;
		}[];
		marks?: readonly StageMarkView[];
		roomLabels?: readonly import('../room-labels').RoomLabelView[];
		candidates?: readonly StageCandidatePreviewView[];
		viewportWidth?: number;
		viewportHeight?: number;
		tracePreview?: import('$lib/platform/perf-marks').PerfTracePreview | null;
		hostTools?: {
			readonly measure: { readonly from: readonly [number, number]; readonly to: readonly [number, number]; readonly label: string; readonly live: boolean;
			} | null;
			readonly notice: { readonly css: readonly [number, number]; readonly message: string; readonly kind: string;
			} | null;
		} | null;
		onActivateDisclosure?: (id: string) => void;
		lightGround?: boolean;
	} = $props();

	/** The four corners of an open arrowhead at the drag end. */
	function arrowhead(anchor: readonly [number, number], tip: readonly [number, number], reach=6.5): string {
		const dx = tip[0] - anchor[0];
		const dy = tip[1] - anchor[1];
		const length = Math.hypot(dx, dy);
		if (length === 0) return '';
		const ux = dx / length;
		const uy = dy / length;
		const backX = tip[0] - ux * reach;
		const backY = tip[1] - uy * reach;
		const nx = -uy * (reach * 0.62);
		const ny = ux * (reach * 0.62);
		return `${backX + nx},${backY + ny} ${tip[0]},${tip[1]} ${backX - nx},${backY - ny}`;
	}

	function tagWidth(text: string): number {
		return Math.max(34, Math.round(text.length * 6.1 + 10));
	}

	function candidateTagPosition(css: readonly [number, number], width: number, height: number, index: number): string {
		let x = css[0] + 10;
		let y = css[1] - 26 - index * 20;
		// Keep the refusal readable at the right edge, including beside the Height
		// Sheet. This only places the tag; the cursor reach stays at the input.
		if (viewportWidth > 0) {
			if (x + width > viewportWidth - 100) x = css[0] - width - 10;
			x = Math.max(8, Math.min(x, viewportWidth - 100 - width - 8));
		}
		if (viewportHeight > 0) y = Math.max(8, Math.min(y, viewportHeight - height - 8));
		return `translate(${x} ${y})`;
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

	/** A refused candidate's tag already says why, so a mark must not say it again. */
	const refusalAtPointer = $derived(
		candidates.some((candidate) => candidate.role === 'refused' && candidate.labels.length > 0)
	);

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

<svg class="overlay"
	class:light={lightGround}
	role="group" aria-label="Stage manipulation marks" focusable="false">
	{#each roomLabels as room (room.id)}
		<g class="room-label" transform={`translate(${room.css[0]} ${room.css[1]})`}>
			<text text-anchor="middle">{room.name}</text>
			<text class="area" text-anchor="middle" y="15">{room.area.toFixed(1)} m²</text>
		</g>
	{/each}
	{#each candidates as candidate (candidate.id)}
		<g
			class="candidate"
			class:subject={candidate.role === 'subject'}
			class:drawing={candidate.drawing === true}
			class:affected={candidate.role === 'affected'}
			class:refused={candidate.role === 'refused'}
			data-candidate-id={candidate.id}
			data-candidate-role={candidate.role}
		>

			{#each candidate.segments as segment, index (`${candidate.id}:segment:${index}`)}
				<!-- The same dark halo as a mark, so the line holds on Paper and on the mat. -->

				<line class="candidate-edge" x1={segment[0][0]} y1={segment[0][1]} x2={segment[1][0]} y2={segment[1][1]} />
			{/each}
			{#if candidate.drawing && candidate.segments.length > 0}
				<circle class="draw-end" cx={candidate.segments[0]![0][0]} cy={candidate.segments[0]![0][1]} r="3" />
				<circle class="draw-end" cx={candidate.segments.at(-1)![1][0]} cy={candidate.segments.at(-1)![1][1]} r="3" />
			{/if}
			{#each candidate.labels.slice(0, 1) as label, index (`${candidate.id}:label:${index}`)}
				{@const lines = labelLines(label.text)}
				{@const width = Math.max(...lines.map((line) => tagWidth(line))) + 10}
				{@const height = 6 + lines.length * 12}
				<!-- The tag sits above the snap mark at the same point, so the two
				     never overprint each other. -->
				{#if candidate.role === 'refused'}
					<g class="problem" role="button" tabindex="0" aria-label={label.text}
						transform={`translate(${label.css[0]} ${label.css[1]})`}
						onfocus={() => problemOpen = candidate.id} onblur={() => problemOpen = null}
						onmouseenter={() => problemOpen = candidate.id} onmouseleave={() => problemOpen = null}
						onclick={() => problemOpen = problemOpen === candidate.id ? null : candidate.id}
						onkeydown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); problemOpen = problemOpen === candidate.id ? null : candidate.id; } }}>
						<rect class="problem-hit" x="-22" y="-22" width="44" height="44" fill="transparent" /><circle r="8" /><text text-anchor="middle" y="4">!</text>
					</g>
				{/if}
				<g class="tag" visibility={candidate.role === 'refused' && problemOpen !== candidate.id ? 'hidden' : undefined} transform={candidateTagPosition(label.css, width, height, index)}>
					<rect {width} {height} rx="2" />
					{#each lines as line, lineIndex (`${candidate.id}:label:${index}:${lineIndex}`)}
						<text x="5" y={12 + lineIndex * 12}>{line}</text>
					{/each}
				</g>
			{/each}
			{#if candidate.snap}
				<g class="candidate-snap" data-snap-name={candidate.snap.name} transform={`translate(${candidate.snap.css[0]} ${candidate.snap.css[1]})`}>
					{#if candidate.snap.name === 'Grid'}<path d="M-4,0H4M0,-4V4" />
					{:else if candidate.snap.name === 'Aligned'}<path d="M-4,-4V4H4" />
					{:else}<circle r="4" />{/if}
					<title>{candidate.snap.name}</title>
				</g>
			{/if}
		</g>
	{/each}

	{#each markers.filter(marker => tracePreview && marker.id === 'layout-wall-preview' || (marks.length === 0 && candidates.length === 0)) as marker (marker.id)}
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
		{@const pointRadius=mark.pointRadius??4.2}
		{@const label = refusalAtPointer || candidates.some(candidate => candidate.labels.length > 0) ? '' : mark.refusal ?? mark.tag}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<g
			class="mark"
			class:active={mark.active}
			class:hovered={mark.hovered}
			class:disclose={mark.role === 'disclose'}
			data-mark-id={mark.id}
			data-mark-role={mark.role}
			data-kind={mark.kind}
			role={mark.role === 'disclose' ? 'button' : undefined}
			tabindex={mark.role === 'disclose' ? 0 : undefined}
			aria-label={mark.role === 'disclose' ? 'Resize handles' : undefined}
			aria-pressed={mark.role === 'disclose' ? mark.open : undefined}
			onclick={mark.role === 'disclose' ? event => { event.stopPropagation(); onActivateDisclosure(mark.id); } : undefined}
			onpointerdown={mark.role === 'disclose' ? event => event.stopPropagation() : undefined}
			onkeydown={mark.role === 'disclose' ? (event) => onDisclosureKey(event, mark.id) : undefined}
		>
			<title>{mark.label}</title>
			{#if mark.cross}
			<path class="halo" d={`M${mark.anchor[0]-11},${mark.anchor[1]}h9 m4,0h9 M${mark.anchor[0]},${mark.anchor[1]-11}v9 m0,4v9`} />
			<path class="stroke move-cross" d={`M${mark.anchor[0]-11},${mark.anchor[1]}h9 m4,0h9 M${mark.anchor[0]},${mark.anchor[1]-11}v9 m0,4v9`} />

			{#each [[mark.anchor[0]-11,mark.anchor[1]], [mark.anchor[0]+11,mark.anchor[1]], [mark.anchor[0],mark.anchor[1]-11], [mark.anchor[0],mark.anchor[1]+11]] as end}
				<polyline class="stroke arrow" points={arrowhead(mark.anchor, [end[0]!, end[1]!], 4)} />
			{/each}
		{:else if mark.kind === 'ray' || mark.kind === 'track'}
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
				<polyline class="halo arrow" points={arrowhead(mark.anchor,tip,tail===null?6.5:5.5)} />
				<polyline class="stroke arrow" class:held={mark.active} points={arrowhead(mark.anchor,tip,tail===null?6.5:5.5)} />
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
					<polyline class="halo arrow" points={arrowhead(mark.anchor,tail,5.5)} />
					<polyline
						class="stroke arrow"
						class:held={mark.active}
						points={arrowhead(mark.anchor,tail,5.5)}
					/>
				{/if}
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
				{#if mark.ring && mark.ring.length > 4}
					<polyline class="stroke arrow" points={arrowhead(mark.ring[mark.ring.length - 3]!, mark.ring[mark.ring.length - 1]!, 7)} />
					<polyline class="stroke arrow" points={arrowhead(mark.ring[2]!, mark.ring[0]!, 7)} />
				{/if}
			{:else if mark.role === 'disclose'}
				<g class="resize-toggle" class:open={mark.open} transform={`translate(${mark.anchor[0]} ${mark.anchor[1]})`}>
					<rect class="toggle-hit" x="-22" y="-22" width="44" height="44" fill="transparent" stroke="none" /><rect x="-12" y="-12" width="24" height="24" rx="5" />
					<path d="M-6,1v5h5 M1,-6h5v5 M-6,6L6,-6" />
				</g>
			{:else}
				<circle
					class="halo point"
					cx={mark.anchor[0]}
					cy={mark.anchor[1]}
					r={pointRadius+1.6}
				/>
				<circle
					class="anchor"
					class:held={mark.active}
					cx={mark.anchor[0]}
					cy={mark.anchor[1]}
					r={pointRadius}
				/>
			{/if}

			{#if (mark.hovered || mark.active) && label !== '' && mark.role !== 'disclose'}
				{@const width = tagWidth(label)}
				<g class="tag" transform={`translate(${tip[0] + 12} ${tip[1] - 10})`}>
					<rect {width} height="20" rx="5" />
					<text x="5" y="12" class:refused={mark.refusal !== null}>{label}</text
					>
				</g>
			{/if}
		</g>
	{/each}

	{#if hostTools?.measure}
		{@const dimension = hostTools.measure}
		{@const middle = [
			(dimension.from[0] + dimension.to[0]) / 2,
			(dimension.from[1] + dimension.to[1]) / 2
		]}
		<g
			class="mark dimension"
			class:live={dimension.live}
			data-measure
			data-measure-label={dimension.label}
		>
			<line
				class="halo"
				x1={dimension.from[0]}
				y1={dimension.from[1]}
				x2={dimension.to[0]}
				y2={dimension.to[1]}
			/>
			<line
				class="dimension-line"
				x1={dimension.from[0]}
				y1={dimension.from[1]}
				x2={dimension.to[0]}
				y2={dimension.to[1]}
			/>
			<path class="halo" d={dimensionTicks(dimension.from, dimension.to)} />
			<path
				class="dimension-line"
				d={dimensionTicks(dimension.from, dimension.to)}
			/>
			<g
				class="tag"
				transform={`translate(${middle[0] + 8} ${middle[1] - 22})`}
			>
				<rect width={tagWidth(dimension.label)} height="20" rx="5" />
				<text x="5" y="12">{dimension.label}</text>
			</g>
		</g>
	{/if}

	{#if hostTools?.notice}
		{@const words = hostTools.notice}
		<g
			class="mark tag-only"
			data-erase-notice={words.kind}
			transform={`translate(${words.css[0] + 12} ${words.css[1] + 12})`}
		>
			<g class="tag">
				<rect width={tagWidth(words.message)} height="20" rx="5" />
				<text x="5" y="12" class:refused={words.kind === 'refused'}
					>{words.message}</text
				>
			</g>
			<title>{words.message}</title>
		</g>
	{/if}

	{#if tracePreview}
		<g data-perf-trace-proof transform="translate(8 8)">
			<rect x="-2" y="-2" width="132" height="132" fill="white" />
			{#each tracePreview.bits as bit, index}
				<rect
					x={(index % 8) * 16}
					y={Math.floor(index / 8) * 16}
					width="16"
					height="16"
					fill={bit ? '#000000' : '#ffffff'}
				/>
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
		stroke: rgba(8, 22, 16, 0.38);
		stroke-width: 3.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.mark .stroke {
		fill: none;
		stroke: var(--mark-ink, #fff);
		stroke-width: 1.3;
		stroke-dasharray: 4 3.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.mark .stroke.move-cross { stroke-dasharray:none; }
	.mark .stroke.arrow {
		stroke-dasharray: none;
	}
	.mark .stroke.held {
		stroke-dasharray: none;
		stroke-width: 1.8;
	}
	.mark .anchor.held {
		stroke: #74560c;
	}
	.mark .anchor.held {
		fill: #d4ad45;
	}
	.mark .point.halo {
		stroke-width: 3;
	}
	.mark .anchor {
		fill:var(--mark-ink,#fff);
		stroke:rgba(8,22,16,.55);
		stroke-width: 1.3;
	}
	.mark.disclose:focus-visible {
		outline: 2px solid #d4ad45;
		outline-offset: 2px;
	}
	.candidate .candidate-edge {
		fill: none;
		stroke: #f3f4ee;
		stroke-width: 1.25;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.candidate-snap :is(circle, path) {
		fill: none;
		stroke: #d4ad45;
		stroke-width: 1.5;
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
		font-size: 11px;
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
		font-size: 11px;
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
	.overlay.light {
		--mark-ink: var(--shell-ink, #1b201c);
	}
	.light .mark .halo {
		stroke: rgba(255, 255, 255, 0.7);
	}
	.mark .stroke.arrow {
		stroke-width: 1.5;
	}
	.mark .halo.arrow {
		stroke-width: 3.6;
	}
	.mark .anchor {
		stroke-width: 1;
	}
	.mark[data-kind='ring'] .stroke {
		stroke-dasharray: 3 4;
	}
	.mark .tag rect {
		fill: rgba(10, 24, 18, 0.82);
		stroke: none;
	}

	.candidate .candidate-edge { fill: none; stroke: var(--shell-ink, #1b201c); stroke-width: 1.4; stroke-dasharray: 1 4; stroke-linecap: round; stroke-opacity: 1; }
	.candidate.drawing .candidate-edge { stroke-dasharray: none; }
	.draw-end { fill: var(--shell-ink, #1b201c); }
	.dimension .dimension-line { stroke: var(--mark-ink, #fff); }
	.problem { pointer-events: auto; cursor: help; }
	.problem circle { fill: #fff; stroke: #7e2718; stroke-width: 1.5; }
	.problem text { fill: #7e2718; font: bold 12px system-ui; }
	.resize-toggle rect:not(.toggle-hit) { fill: #fff; stroke: #1b201c; stroke-width: 1; }
	.resize-toggle.open rect:not(.toggle-hit) { fill: #f8efd6; stroke: #74560c; }
	.resize-toggle path { fill: none; stroke: var(--shell-ink, #1b201c); stroke-width: 1.4; }
	.mark.disclose { pointer-events: auto; cursor: pointer; }
	.mark[data-kind='ring'] .stroke { stroke-dasharray: none; }

	.room-label text { fill: #4a524c; font: 12px system-ui; paint-order: stroke; stroke: #fff; stroke-width: 2px; stroke-opacity: .75; }
	.room-label .area { font: 11px ui-monospace, monospace; }
</style>
