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
	import StageSticker from './StageSticker.svelte';

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

	function tagWidth(text: string): number {
		// 11 px mono with its letter spacing is ~6.8 px a character; the tag must
		// hold the whole reason, never clip it.
		return Math.max(34, Math.round(text.length * 6.9 + 12));
	}

	/** Carry the dash phase across samples belonging to the same outline. */
	function candidatePath(segments: StageCandidatePreviewView['segments']): string {
		let previous: readonly [number, number] | undefined;
		return segments.map(([from, to]) => {
			const start = previous?.[0] === from[0] && previous[1] === from[1] ? '' : `M${from[0]},${from[1]}`;
			previous = to;
			return `${start}L${to[0]},${to[1]}`;
		}).join('');
	}

	/**
	 * The drawing end mark's shape is its snap cue, in ink only (review pass 2
	 * §1): a ring on a Wall, Junction or Opening, a square on the grid, a dot when
	 * free or merely aligned.
	 */
	function snapShape(name: string | undefined): 'dot' | 'ring' | 'square' | 'closure' {
		if (name === 'Close Room') return 'closure';
		if (name === 'Grid' || name === 'Aligned · Grid') return 'square';
		if (name === 'Junction' || name === 'Wall' || name === 'Opening') return 'ring';
		return 'dot';
	}

	function headingOf(direction: readonly [number, number] | null | undefined): number {
		return direction == null ? 0 : (Math.atan2(direction[1], direction[0]) * 180) / Math.PI;
	}

	/** Where the arrow glyph of a one-way ray starts, so its point lands on the tip. */
	function arrowTail(anchor: readonly [number, number], tip: readonly [number, number]): readonly [number, number] {
		const dx = tip[0] - anchor[0];
		const dy = tip[1] - anchor[1];
		const length = Math.hypot(dx, dy) || 1;
		const back = Math.min(16.5, length);
		return [tip[0] - (dx / length) * back, tip[1] - (dy / length) * back];
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
		{@const refused = candidate.role === 'refused'}
		{@const last = candidate.segments.at(-1)?.[1] ?? null}
		<g
			class="candidate"
			class:subject={candidate.role === 'subject'}
			class:drawing={candidate.drawing === true}
			class:affected={candidate.role === 'affected'}
			class:refused
			data-candidate-id={candidate.id}
			data-candidate-role={candidate.role}
		>
			{#if candidate.snap?.name === 'Close Room'}
				{#each candidate.polygons as polygon, index (`${candidate.id}:room:${index}`)}
					<polygon class="candidate-room" points={polygon.map(([x, y]) => `${x},${y}`).join(' ')} />
				{/each}
			{/if}
			<!-- Drawing is solid draft ink; a proposal is dashed in the ghost colour; a refusal is red dashed. -->
			{#if candidate.segments.length > 0}
				<path class="candidate-edge" d={candidatePath(candidate.segments)} />
			{/if}
			{#if candidate.drawing && candidate.segments.length > 0}
				<circle class="end-mark" cx={candidate.segments[0]![0][0]} cy={candidate.segments[0]![0][1]} r="3.4" />
			{/if}
			{#if candidate.snap}
				{@const shape = snapShape(candidate.snap.name)}
				<g class="candidate-snap end-mark-group" data-snap-name={candidate.snap.name} data-snap-shape={shape} transform={`translate(${candidate.snap.css[0]} ${candidate.snap.css[1]})`}>
					{#if shape === 'square'}<rect class="end-mark hollow" x="-4" y="-4" width="8" height="8" />
					{:else if shape === 'closure'}<circle class="close-room-ring" r="8" /><circle class="close-room-center" r="3" />
					{:else if shape === 'ring'}<circle class="end-mark hollow" r="4.6" />
					{:else}<circle class="end-mark" r="3.4" />{/if}
					<title>{candidate.snap.name}</title>
				</g>
			{:else if last !== null && (candidate.drawing || refused)}
				<circle class="end-mark" data-snap-shape="dot" cx={last[0]} cy={last[1]} r="3.4" />
			{/if}
			{#each candidate.labels.slice(0, 1) as label, index (`${candidate.id}:label:${index}`)}
				{@const lines = labelLines(label.text)}
				{@const width = Math.max(...lines.map((line) => tagWidth(line)))}
				{@const height = 6 + lines.length * 12}
				<!-- The tag sits above the end mark, so the two never overprint. A
				     refusal's reason replaces the length in the same tag. -->
				<g class="tag" class:bad={refused} role={refused ? 'status' : undefined} transform={candidateTagPosition(label.css, width, height, index)}>
					<rect {width} {height} rx="3" />
					{#each lines as line, lineIndex (`${candidate.id}:label:${index}:${lineIndex}`)}
						<text x="6" y={12 + lineIndex * 12}>{line}</text>
					{/each}
				</g>
			{/each}
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
		{@const emphasised = mark.hovered || mark.active}
		{@const label = refusalAtPointer || candidates.some(candidate => candidate.labels.length > 0) ? '' : mark.refusal ?? mark.tag}
		{#if !mark.hidden}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<g
			class="mark"
			class:active={mark.active}
			class:hovered={mark.hovered}
			class:disclose={mark.role === 'disclose'}
			data-mark-id={mark.id}
			data-mark-role={mark.role}
			data-kind={mark.kind}
			data-glyph={mark.glyph ?? undefined}
			role={mark.role === 'disclose' ? 'button' : undefined}
			tabindex={mark.role === 'disclose' ? 0 : undefined}
			aria-label={mark.role === 'disclose' ? 'Resize handles' : undefined}
			aria-pressed={mark.role === 'disclose' ? mark.open : undefined}
			onclick={mark.role === 'disclose' ? event => { event.stopPropagation(); onActivateDisclosure(mark.id); } : undefined}
			onpointerdown={mark.role === 'disclose' ? event => event.stopPropagation() : undefined}
			onkeydown={mark.role === 'disclose' ? (event) => onDisclosureKey(event, mark.id) : undefined}
		>
			<title>{mark.label}</title>
			{#if mark.role === 'disclose'}
				<!-- The W·D·H chip: click shows the size grips; a drag scales (where the domain allows). -->
				<g class="chip" class:open={mark.open} transform={`translate(${mark.anchor[0]} ${mark.anchor[1]})`}>
					<rect class="toggle-hit" x="-22" y="-22" width="44" height="44" />
					<rect class="glyph" x="-12" y="-12" width="24" height="24" rx="7" />
					<path class="chip-icon" d="M-5,5 L5,-5 M-5,5 h4.2 M-5,5 v-4.2 M5,-5 h-4.2 M5,-5 v4.2" />
				</g>
			{:else if mark.glyph === 'top-knob' || mark.glyph === 'lift-knob'}
				<StageSticker kind={mark.glyph === 'top-knob' ? 'hex' : 'hexSmall'} at={mark.anchor} stem={mark.stem} {emphasised} held={mark.active} />
			{:else if mark.cross}
				<StageSticker kind="move" at={mark.anchor} angle={headingOf(mark.direction)} scale={mark.glyphScale} {emphasised} held={mark.active} />
			{:else if mark.kind === 'ray' || mark.kind === 'track'}
				{#if tail !== null}
					{@const reach = Math.hypot(tip[0] - mark.anchor[0], tip[1] - mark.anchor[1])}
					{#if reach <= 22}
						<StageSticker kind="two" at={mark.anchor} angle={headingOf(mark.direction)} scale={Math.max(0.6, reach / 15.5)} {emphasised} held={mark.active} />
					{:else}
						<!-- A long track: its guide, with one arrow at each end. -->
						<line class="glyph-line dash" x1={tail[0]} y1={tail[1]} x2={tip[0]} y2={tip[1]} />
						<StageSticker kind="arrow" at={arrowTail(mark.anchor, tip)} angle={headingOf(mark.direction)} scale={0.8} {emphasised} held={mark.active} />
						<StageSticker kind="arrow" at={arrowTail(mark.anchor, tail)} angle={headingOf(mark.direction) + 180} scale={0.8} {emphasised} held={mark.active} />
					{/if}
				{:else}
					{@const glyphAt = arrowTail(mark.anchor, tip)}
					<line class="glyph-line dash" x1={mark.anchor[0]} y1={mark.anchor[1]} x2={glyphAt[0]} y2={glyphAt[1]} />
					<StageSticker kind="arrow" at={glyphAt} angle={headingOf(mark.direction)} {emphasised} held={mark.active} />
				{/if}
			{:else if mark.kind === 'ring'}
				<!-- No ring (review pass 3): one bent two-way arrow, carried by the subject's
				     own frame, is the whole Turn control. The ring stays only as the plane
				     the turn is measured in. -->
				{#if mark.ringGlyph}
					<StageSticker kind="curved" at={mark.ringGlyph.at} angle={mark.ringGlyph.angle} flip={mark.ringGlyph.flip} {emphasised} held={mark.active} />
				{/if}
			{:else}
				<StageSticker kind="point" at={mark.anchor} {emphasised} held={mark.active} />
			{/if}

			{#if emphasised && label !== '' && mark.role !== 'disclose'}
				{@const width = tagWidth(label)}
				<g class="tag" class:bad={mark.refusal !== null} transform={`translate(${tip[0] + 14} ${tip[1] - 12})`}>
					<rect {width} height="20" rx="3" />
					<text x="6" y="13">{label}</text>
				</g>
			{/if}
		</g>
		{/if}
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
		--overlay-ink: var(--shell-ink);
		--overlay-draft: var(--stage-ink);
		--overlay-draft-halo: var(--stage-ink-halo);
		--overlay-ghost: var(--stage-proposal);
		--overlay-ghost-halo: var(--stage-proposal-halo);
		--overlay-problem: var(--shell-refuse);
	}
	.task-marker circle {
		fill: none;
		stroke: #a6a6ad;
		stroke-width: 1.5;
	}

	/* Review pass 3: drawing is solid draft ink; every gesture's proposal — Wall,
	   Room or object, 2D or 3D — is the same dashed line in the ghost colour; a
	   refusal is red dashed. */
	.candidate .candidate-edge {
		fill: none;
		stroke: var(--overlay-ghost);
		filter: var(--overlay-ghost-halo);
		stroke-width: 1.5;
		stroke-dasharray: 6 4;
		stroke-linecap: round;
	}
	.candidate.drawing .candidate-edge { stroke: var(--overlay-draft); filter: var(--overlay-draft-halo); stroke-width: 1.6; stroke-dasharray: none; }
	.candidate.refused .candidate-edge { stroke: var(--overlay-problem); filter: none; stroke-width: 2; stroke-dasharray: 6 4; }
	.end-mark { fill: var(--overlay-ghost); stroke: var(--overlay-ghost); stroke-width: 1.6; filter: var(--overlay-ghost-halo); }
	.candidate.drawing .end-mark { fill: var(--overlay-draft); stroke: var(--overlay-draft); filter: var(--overlay-draft-halo); }
	.candidate-room { fill: var(--shell-leaf); fill-opacity: 0.2; }
	.close-room-ring { fill: var(--shell-white); stroke: var(--shell-forest-raised); stroke-width: 2; }
	.close-room-center { fill: var(--shell-forest-raised); }
	.end-mark.hollow { fill: var(--shell-white); }
	.candidate.refused .end-mark { fill: var(--overlay-problem); stroke: var(--overlay-problem); filter: none; }

	.tag rect { fill: var(--overlay-ink); stroke: none; }
	.tag.bad rect { fill: var(--overlay-problem); }
	.tag text.refused { fill: #f0b3ab; }
	.tag text {
		fill: var(--shell-white);
		font-family: var(--shell-mono);
		font-size: 11px;
		letter-spacing: 0.02em;
	}

	/* The sticker glyph set: white body, fine ink keyline, small soft shadow. */
	.mark .glyph {
		fill: var(--shell-white);
		stroke: var(--overlay-ink);
		stroke-width: 1.1;
		stroke-linejoin: round;
		filter: drop-shadow(0 1.2px 1.3px rgba(20, 24, 20, 0.3));
	}
	.mark .glyph-line {
		fill: none;
		stroke: var(--overlay-ink);
		stroke-width: 1.5;
		stroke-linecap: round;
		filter: drop-shadow(0 0 0.7px rgba(255, 255, 255, 0.95));
	}
	.mark .glyph-line.dash { stroke-dasharray: 4 3.5; }
	.mark .chip .toggle-hit { fill: transparent; stroke: none; filter: none; }
	.mark .chip-icon { fill: none; stroke: var(--overlay-ink); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
	.mark .chip.open .glyph { fill: var(--overlay-ink); }
	.mark .chip.open .chip-icon { stroke: var(--shell-white); }
	.mark.disclose { pointer-events: auto; cursor: pointer; }
	/* A pointer click never paints the browser's focus ring; the keyboard still gets one. */
	.mark.disclose:focus { outline: none; }
	.mark.disclose:focus-visible .chip .glyph { stroke: var(--shell-leaf); stroke-width: 2.2; }

	.dimension .dimension-line {
		fill: none;
		stroke: var(--overlay-draft);
		filter: var(--overlay-draft-halo);
		stroke-width: 1.25;
		stroke-linecap: round;
	}
	.dimension.live .dimension-line { stroke-dasharray: 4 3; }
	.dimension .halo { fill: none; stroke: rgba(255, 255, 255, 0.7); stroke-width: 3.4; stroke-linecap: round; }

	.room-label text { fill: var(--shell-ink-2); font: 12px system-ui; paint-order: stroke; stroke: var(--shell-white); stroke-width: 2px; stroke-opacity: .75; }
	.room-label .area { font: 11px ui-monospace, monospace; }
</style>
