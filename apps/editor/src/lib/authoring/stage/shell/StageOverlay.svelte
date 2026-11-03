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

	/**
	 * The drawing end mark's shape is its snap cue, in ink only (review pass 2
	 * §1): a ring on a Wall, Junction or Opening, a square on the grid, a dot when
	 * free or merely aligned.
	 */
	function snapShape(name: string | undefined): 'dot' | 'ring' | 'square' {
		if (name === 'Grid') return 'square';
		if (name === 'Junction' || name === 'Wall' || name === 'Opening') return 'ring';
		return 'dot';
	}

	/** The sticker glyph set. Each path is drawn about its own origin. */
	const GLYPH = {
		/** A chunky arrow, tail at the origin, pointing +x. */
		arrow: 'M0,-2.7 H8 V-6.8 L16.5,0 L8,6.8 V2.7 H0 Z',
		/** A two-way arrow centred on the origin. */
		two: 'M-15.5,0 L-7.5,-6.8 V-2.7 H7.5 V-6.8 L15.5,0 L7.5,6.8 V2.7 H-7.5 V6.8 Z',
		/** The four-way move cross. */
		move: 'M0,-15 L6.4,-8 H2.5 V-2.5 H8 V-6.4 L15,0 L8,6.4 V2.5 H2.5 V8 H6.4 L0,15 L-6.4,8 H-2.5 V2.5 H-8 V6.4 L-15,0 L-8,-6.4 V-2.5 H-2.5 V-8 H-6.4 Z',
		hex: hexPath(7),
		hexSmall: hexPath(5.6),
		curved: curvedArrowPath()
	} as const;

	function hexPath(radius: number): string {
		return `M${[0, 1, 2, 3, 4, 5].map((k) => {
			const angle = ((k * 60 - 90) * Math.PI) / 180;
			return `${(radius * Math.cos(angle)).toFixed(2)},${(radius * Math.sin(angle)).toFixed(2)}`;
		}).join('L')}Z`;
	}

	/** One curved two-way arrow; its middle sits at the origin with tangent +x and it bends toward +y. */
	function curvedArrowPath(): string {
		const R = 21, half = 36, width = 5.4, flare = 3.8, head = 17, rad = Math.PI / 180;
		const at = (rho: number, angle: number) => `${(rho * Math.cos(angle * rad)).toFixed(2)},${(R + rho * Math.sin(angle * rad)).toFixed(2)}`;
		const a0 = -90 - half, a1 = -90 + half;
		const points = [at(R, a0 - head), at(R + width / 2 + flare, a0)];
		for (let angle = a0; angle <= a1 + 0.01; angle += 6) points.push(at(R + width / 2, angle));
		points.push(at(R + width / 2 + flare, a1), at(R, a1 + head), at(R - width / 2 - flare, a1));
		for (let angle = a1; angle >= a0 - 0.01; angle -= 6) points.push(at(R - width / 2, angle));
		points.push(at(R - width / 2 - flare, a0));
		return `M${points.join('L')}Z`;
	}

	function headingOf(direction: readonly [number, number] | null | undefined): number {
		return direction == null ? 0 : (Math.atan2(direction[1], direction[0]) * 180) / Math.PI;
	}

	function glyphTransform(at: readonly [number, number], angle: number): string {
		return `translate(${at[0]} ${at[1]}) rotate(${angle.toFixed(1)})`;
	}

	/**
	 * A glyph's path at a size: the coordinates themselves are scaled (absolute
	 * M/L/H/V only), so no SVG transform ever scales anything on the Stage.
	 * Emphasis (hover/held) grows the glyph by 15 %.
	 */
	function sized(d: string, emphasised: boolean, sx = 1, sy = sx): string {
		const k = emphasised ? 1.15 : 1;
		let command = '';
		let index = 0;
		return d.replace(/([MLHVZ])|(-?\d*\.?\d+)/g, (_match, letter: string | undefined, number: string | undefined) => {
			if (letter !== undefined) {
				command = letter;
				index = 0;
				return letter;
			}
			const factor = command === 'H' ? sx : command === 'V' ? sy : index++ % 2 === 0 ? sx : sy;
			return String(Number((Number(number) * factor * k).toFixed(2)));
		});
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
			<!-- Drawing is solid draft ink; a proposal is dashed in the ghost colour; a refusal is red dashed. -->
			{#each candidate.segments as segment, index (`${candidate.id}:segment:${index}`)}
				<line class="candidate-edge" x1={segment[0][0]} y1={segment[0][1]} x2={segment[1][0]} y2={segment[1][1]} />
			{/each}
			{#if candidate.drawing && candidate.segments.length > 0}
				<circle class="end-mark" cx={candidate.segments[0]![0][0]} cy={candidate.segments[0]![0][1]} r="3.4" />
			{/if}
			{#if candidate.snap}
				{@const shape = snapShape(candidate.snap.name)}
				<g class="candidate-snap end-mark-group" data-snap-name={candidate.snap.name} data-snap-shape={shape} transform={`translate(${candidate.snap.css[0]} ${candidate.snap.css[1]})`}>
					{#if shape === 'square'}<rect class="end-mark hollow" x="-4" y="-4" width="8" height="8" />
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
				<g class="chip" class:open={mark.open} transform={glyphTransform(mark.anchor, 0)}>
					<rect class="toggle-hit" x="-22" y="-22" width="44" height="44" />
					<rect class="glyph" x="-12" y="-12" width="24" height="24" rx="7" />
					<path class="chip-icon" d="M-5,5 L5,-5 M-5,5 h4.2 M-5,5 v-4.2 M5,-5 h-4.2 M5,-5 v4.2" />
				</g>
			{:else if mark.glyph === 'top-knob' || mark.glyph === 'lift-knob'}
				{#if mark.stem}
					<line class="glyph-line" x1={mark.stem[0]} y1={mark.stem[1]} x2={mark.anchor[0]} y2={mark.anchor[1]} />
				{/if}
				<path class="glyph" class:held={mark.active} d={sized(mark.glyph === 'top-knob' ? GLYPH.hex : GLYPH.hexSmall, emphasised)} transform={glyphTransform(mark.anchor, 0)} />
			{:else if mark.cross}
				<path class="glyph" class:held={mark.active} d={sized(GLYPH.move, emphasised)} transform={glyphTransform(mark.anchor, headingOf(mark.direction))} />
			{:else if mark.kind === 'ray' || mark.kind === 'track'}
				{#if tail !== null}
					{@const reach = Math.hypot(tip[0] - mark.anchor[0], tip[1] - mark.anchor[1])}
					{#if reach <= 22}
						<path class="glyph" class:held={mark.active} d={sized(GLYPH.two, emphasised, Math.max(0.6, reach / 15.5))} transform={glyphTransform(mark.anchor, headingOf(mark.direction))} />
					{:else}
						<!-- A long track: its guide, with one arrow at each end. -->
						<line class="glyph-line dash" x1={tail[0]} y1={tail[1]} x2={tip[0]} y2={tip[1]} />
						<path class="glyph" class:held={mark.active} d={sized(GLYPH.arrow, emphasised, 0.8)} transform={glyphTransform(arrowTail(mark.anchor, tip), headingOf(mark.direction))} />
						<path class="glyph" class:held={mark.active} d={sized(GLYPH.arrow, emphasised, 0.8)} transform={glyphTransform(arrowTail(mark.anchor, tail), headingOf(mark.direction) + 180)} />
					{/if}
				{:else}
					{@const glyphAt = arrowTail(mark.anchor, tip)}
					<line class="glyph-line dash" x1={mark.anchor[0]} y1={mark.anchor[1]} x2={glyphAt[0]} y2={glyphAt[1]} />
					<path class="glyph" class:held={mark.active} d={sized(GLYPH.arrow, emphasised)} transform={glyphTransform(glyphAt, headingOf(mark.direction))} />
				{/if}
			{:else if mark.kind === 'ring'}
				<!-- No ring (review pass 3): one bent two-way arrow, carried by the subject's
				     own frame, is the whole Turn control. The ring stays only as the plane
				     the turn is measured in. -->
				{#if mark.ringGlyph}
					<path class="glyph turn" class:held={mark.active} d={sized(GLYPH.curved, emphasised, 1, mark.ringGlyph.flip ? -1 : 1)} transform={glyphTransform(mark.ringGlyph.at, mark.ringGlyph.angle)} />
				{/if}
			{:else}
				<circle class="glyph knob" class:held={mark.active} cx={mark.anchor[0]} cy={mark.anchor[1]} r={emphasised ? 6.4 : 5.4} />
			{/if}

			{#if emphasised && label !== '' && mark.role !== 'disclose'}
				{@const width = tagWidth(label)}
				<g class="tag" class:bad={mark.refusal !== null} transform={`translate(${tip[0] + 14} ${tip[1] - 12})`}>
					<rect {width} height="20" rx="3" />
					<text x="6" y="13">{label}</text>
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
		--overlay-ink: var(--shell-ink, #1b201c);
		--overlay-draft: var(--shell-draft-ink, #1b201c);
		--overlay-draft-halo: var(--shell-draft-halo, none);
		--overlay-ghost: var(--shell-ghost, #2a62d6);
		--overlay-ghost-halo: var(--shell-ghost-halo, none);
		--overlay-problem: #7e2718;
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
	.end-mark.hollow { fill: #fff; }
	.candidate.refused .end-mark { fill: var(--overlay-problem); stroke: var(--overlay-problem); filter: none; }

	.tag rect { fill: var(--overlay-ink); stroke: none; }
	.tag.bad rect { fill: var(--overlay-problem); }
	.tag text.refused { fill: #f0b3ab; }
	.tag text {
		fill: #fff;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 11px;
		letter-spacing: 0.02em;
	}

	/* The sticker glyph set: white body, fine ink keyline, small soft shadow. */
	.mark .glyph {
		fill: #fff;
		stroke: var(--overlay-ink);
		stroke-width: 1.1;
		stroke-linejoin: round;
		filter: drop-shadow(0 1.2px 1.3px rgba(20, 24, 20, 0.3));
	}
	.mark .glyph.held { fill: #f8efd6; }
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
	.mark .chip.open .chip-icon { stroke: #fff; }
	.mark.disclose { pointer-events: auto; cursor: pointer; }
	/* A pointer click never paints the browser's focus ring; the keyboard still gets one. */
	.mark.disclose:focus { outline: none; }
	.mark.disclose:focus-visible .chip .glyph { stroke: var(--leaf, #4f8f6c); stroke-width: 2.2; }

	.dimension .dimension-line {
		fill: none;
		stroke: var(--overlay-draft);
		filter: var(--overlay-draft-halo);
		stroke-width: 1.25;
		stroke-linecap: round;
	}
	.dimension.live .dimension-line { stroke-dasharray: 4 3; }
	.dimension .halo { fill: none; stroke: rgba(255, 255, 255, 0.7); stroke-width: 3.4; stroke-linecap: round; }

	.room-label text { fill: #4a524c; font: 12px system-ui; paint-order: stroke; stroke: #fff; stroke-width: 2px; stroke-opacity: .75; }
	.room-label .area { font: 11px ui-monospace, monospace; }
</style>
