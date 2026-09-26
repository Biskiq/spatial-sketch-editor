<script lang="ts">
	import { worldToPlanScreen, type PlanViewportState } from './layout-plan-transform';
	import { p2311Measure } from '$lib/layout/layout-wall-first-precision';
	import type { LayoutVec2 } from '$lib/layout/layout-types';
	import {
		PLAN_PRESENTATION_SOURCE_DEFAULT,
		type PlanPolygonPrimitive,
		type PlanPolylinePrimitive,
		type PlanPresentationDecisions,
		type PlanPresentationSource,
		type PlanRenderModel,
		type PlanStyleToken
	} from '$lib/layout/plan-render-model';
	import {
		architectureBandPx,
		DOOR_TYPE_CUE_DASHARRAY,
		doorTypeCueDisplacedScreenPoints,
		doorTypeCueScreenPoints,
		offsetScreenPolyline,
		resolveDoorCueShape,
		resolveWallInkAid,
		resolveWindowStrokeCount,
		wallJambWorldPoints,
		windowStrokeLayout
	} from './plan-architecture-grammar';

	let {
		model,
		planView,
		presentation = PLAN_PRESENTATION_SOURCE_DEFAULT
	}: {
		model: PlanRenderModel;
		planView: PlanViewportState;
		/**
		 * P23.13 S0/S2 — resolved screen-presentation decisions (S2 salience output).
		 * The adapter asks per primitive and paints the answer; it never resolves a
		 * projected-size gate itself and never writes one back into the model.
		 */
		presentation?: PlanPresentationSource;
	} = $props();

	const TOKEN_CLASSES: Partial<Record<PlanStyleToken, string>> = {
		'room-fill-selected': 'room-fill selected',
		'room-outline-selected': 'room-outline selected',
		'wall-line-selected': 'wall-line selected',
		'wall-line-opening-selected': 'wall-line opening-selected',
		'wall-line-hovered': 'wall-line hovered',
		'opening-line-selected': 'opening-line opening-selected',
		'opening-line-hovered': 'opening-line hovered',
		'scene-footprint-bridge-hover': 'scene-footprint bridge-hover',
		'scene-footprint-active': 'scene-footprint active',
		'scene-footprint-selected': 'scene-footprint selected',
		'layout-object-readonly': 'layout-object readonly',
		'layout-object-selected': 'layout-object selected',
		'layout-object-readonly-selected': 'layout-object readonly selected',
		// P3.3 — Arrange hover bridge-affordance outline.
		'arrange-hover': 'arrange-hover',
		'interior-anchor-selected': 'interior-anchor selected',
		'vertex-handle-selected': 'vertex-handle selected',
		'vertex-handle-hovered': 'vertex-handle hovered',
		// P23.11 — interior curve controls of a selected curved Wall.
		'curve-control-hovered': 'curve-control hovered',
		// P23.13 S4 — control focus and owner control geometry (spec §6).
		'focus-ring': 'focus-ring',
		'focus-moat': 'focus-moat',
		'control-polygon': 'control-polygon',
		'control-centerline': 'control-centerline',
		// P23.13 S4 — refusal mark of a known-invalid proposal.
		'refusal-stop': 'refusal-stop',
		'refusal-cross': 'refusal-cross',
		// P23.13 S8 — the persisted refusal's reason + the earned closure wash.
		'refusal-reason': 'refusal-reason',
		'closure-wash': 'closure-wash',
		'primitive-ghost-circle': 'primitive-ghost circle',
		'primitive-ghost-sphere': 'primitive-ghost sphere',
		'primitive-ghost-invalid': 'primitive-ghost invalid',
		// P23.3 — canonical Opening handles + drag preview.
		'opening-handle': 'opening-handle',
		// P23.13 S4 — paired body-drag grip across the Opening symbol center.
		'opening-slide-grip': 'opening-slide-grip',
		'opening-drag-preview': 'opening-drag-preview',
		'opening-drag-preview-invalid': 'opening-drag-preview invalid',
		// P23.10 — transient direct Wall/Junction edit intent.
		'architecture-edit-intent': 'architecture-edit-intent',
		'architecture-edit-intent-invalid': 'architecture-edit-intent invalid',
		// P1.5 — Camera Plan authoring tokens.
		'camera-edge': 'camera-edge',
		'camera-edge-selected': 'camera-edge selected',
		'camera-edge-hovered': 'camera-edge hovered',
		'camera-edge-retained': 'camera-edge retained',
		'camera-edge-retained-selected': 'camera-edge retained selected',
		'camera-edge-retained-hovered': 'camera-edge retained hovered',
		'camera-node': 'camera-node',
		'camera-node-selected': 'camera-node selected',
		'camera-node-hovered': 'camera-node hovered',
		'camera-node-free': 'camera-node free',
		'camera-node-free-selected': 'camera-node free selected',
		'camera-node-halo': 'camera-node-halo',
		'camera-node-glyph': 'camera-node-glyph',
		'camera-anchor': 'camera-anchor',
		'camera-anchor-selected': 'camera-anchor selected',
		'camera-anchor-hovered': 'camera-anchor hovered',
		'camera-order-label': 'camera-order-label',
		'camera-timing-label': 'camera-timing-label',
		'camera-connect-band': 'camera-connect-band',
		'camera-placement-ghost': 'camera-placement-ghost',
		'camera-placement-ghost-invalid': 'camera-placement-ghost invalid'
	};

	function tokenClass(style: PlanStyleToken): string {
		return TOKEN_CLASSES[style] ?? style;
	}

	function pointsAttr(points: readonly LayoutVec2[]): string {
		return p2311Measure('svg-attributes', () => points.map((point) => worldToPlanScreen(planView, point).join(',')).join(' '));
	}

	function polylinePointsAttr(points: readonly LayoutVec2[], endOffsetPx?: readonly [number, number]): string {
		return p2311Measure('svg-attributes', () => polylinePointsAttrUnmeasured(points, endOffsetPx));
	}

	function polylinePointsAttrUnmeasured(points: readonly LayoutVec2[], endOffsetPx?: readonly [number, number]): string {
		const screen = points.map((point) => worldToPlanScreen(planView, point));
		if (endOffsetPx && screen.length > 0) {
			const last = screen[screen.length - 1]!;
			screen[screen.length - 1] = [last[0] + endOffsetPx[0], last[1] + endOffsetPx[1]];
		}
		return screen.map((point) => point.join(',')).join(' ');
	}

	/**
	 * P23.13 S0/S1 — the band/ink split at the paint boundary.
	 *
	 * `--architecture-band-width` is the exact canonical physical-width
	 * projection (authored thickness × px/m): geometry truth, never clamped, so a
	 * thin or distant Wall can no longer be widened into a lie. Readability is a
	 * *separate* mark — the profile casing, the centered silhouette aid and the
	 * dense-ink collapse — none of which changes the band.
	 */
	function architectureWidthStyle(bandPx: number): string {
		return `--architecture-band-width: ${bandPx}px;`;
	}

	function wallStateClass(style: PlanStyleToken): string {
		if (style === 'wall-line-selected') return 'selected';
		if (style === 'wall-line-opening-selected') return 'opening-selected';
		if (style === 'wall-line-hovered') return 'hovered';
		return '';
	}

	/**
	 * P23.6 — one Wall concept: a `partition`-role Wall renders the same
	 * wall-like stroke language with a subtle muted distinction (it does not
	 * divide semantic Rooms). Selection classes still apply on top — selected
	 * state stays unmistakable for both roles.
	 */
	function wallPartitionClass(primitive: PlanPolylinePrimitive): string {
		return primitive.architecture?.kind === 'wall' && primitive.architecture.role === 'partition'
			? 'partition'
			: '';
	}

	function openingSelected(style: PlanStyleToken): boolean {
		return style === 'opening-line-selected';
	}

	function openingHovered(style: PlanStyleToken): boolean {
		return style === 'opening-line-hovered';
	}

	type OpeningSymbol = {
		/** Exact projected host thickness, so the void erases only real ink. */
		bandPx: number;
		span: LayoutVec2[];
		jambStart: LayoutVec2[];
		jambEnd: LayoutVec2[];
		/** Screen-space Window strokes (0, 1 or 2 of them — never three). */
		windowStrokes: LayoutVec2[][];
		/** Screen-space Door type cue, already dashed by CSS. */
		doorCue: LayoutVec2[] | null;
	};

	/**
	 * P23.13 S1 — the opening symbol. The void and the jambs stay world-based (the
	 * authored cut is never re-derived from screen ink); the Window strokes and the
	 * Door type cue are fixed screen-px ink from `plan-architecture-grammar`.
	 */
	function openingSymbol(
		primitive: PlanPolylinePrimitive,
		decisions: PlanPresentationDecisions
	): OpeningSymbol | null {
		return p2311Measure('plan-svg-opening-symbol', () =>
			openingSymbolUnmeasured(primitive, decisions)
		);
	}

	function openingSymbolUnmeasured(
		primitive: PlanPolylinePrimitive,
		decisions: PlanPresentationDecisions
	): OpeningSymbol | null {
		const architecture = primitive.architecture;
		if (!architecture || architecture.kind === 'wall' || primitive.points.length < 2) return null;
		const normal = architecture.inwardNormal;
		const thickness = architecture.wallThicknessMeters;
		const thicknessPx = architectureBandPx(planView.pixelsPerMeter, thickness);
		const symbol: OpeningSymbol = {
			bandPx: thicknessPx,
			span: primitive.points,
			jambStart: wallJambWorldPoints(primitive.points[0]!, normal, thickness),
			jambEnd: wallJambWorldPoints(primitive.points.at(-1)!, normal, thickness),
			windowStrokes: [],
			doorCue: null
		};

		if (architecture.kind === 'window') {
			const strokeCount = resolveWindowStrokeCount(decisions.windowFrameCount ?? 2, thicknessPx);
			const centerline = primitive.points.map((point) => worldToPlanScreen(planView, point));
			symbol.windowStrokes = windowStrokeLayout(thicknessPx, strokeCount).offsetsPx.map((offset) =>
				offsetScreenPolyline(centerline, offset)
			);
			return symbol;
		}

		// P23.6 — neutral door treatment: the authored state carries no hinge
		// side, handedness or swing direction, so none is drawn. P23.13 A2 adds
		// one dashed type cue perpendicular to the host: symbolic ink centered on
		// the cut and symmetric about the Wall centerline, which may protrude
		// beyond the band and never modifies the cut, jambs, hit, snap, measure
		// or validation.
		const widthPx = architecture.widthMeters * planView.pixelsPerMeter;
		symbol.doorCue = [...resolveDoorCueShape(decisions.doorCueShape, widthPx) === 'full'
			? doorTypeCueScreenPoints(planView, architecture.centerPoint, architecture.centerTangent)
			: doorTypeCueDisplacedScreenPoints(planView, architecture.centerPoint, architecture.centerTangent, thicknessPx)];
		return symbol;
	}

	function screenAt(point: LayoutVec2, offsetPx?: readonly [number, number]): LayoutVec2 {
		const screen = worldToPlanScreen(planView, point);
		return [screen[0] + (offsetPx?.[0] ?? 0), screen[1] + (offsetPx?.[1] ?? 0)];
	}

	/**
	 * P23.13 S2 — passive Scene context ink (30% normal/near, 15% far, spec §5).
	 * Only the *resting* Scene footprint is dimmed: active, hovered and selected
	 * Scene entities keep full ink, because that ink is feedback and must not
	 * fade with the context it sits on.
	 */
	function contextInkStyle(primitive: PlanPolygonPrimitive): string | undefined {
		return p2311Measure('plan-svg-context-ink', () => {
			if (primitive.style !== 'scene-footprint') return undefined;
			// P23.13 S8 / §1.12 — the instrument zone may dim one footprint without
			// touching the rest of the passive Scene, so a source that has a zone
			// answers per primitive; without one the regime value stands, which is
			// every frame outside a live instrument.
			return `opacity: ${presentation.sceneInkFor?.(primitive) ?? presentation.sceneInk}`;
		});
	}

	/** Screen-space points are already projected: no transform, no measure bucket. */
	function screenPointsAttr(points: readonly LayoutVec2[]): string {
		return points.map((point) => point.join(',')).join(' ');
	}

	/**
	 * P23.13 S4 / §6 — a control's *shape* is its non-colour identity, so the mark
	 * follows from the primitive rather than from the token class. A diamond is
	 * the Junction/Wall endpoint, a square an Opening width edge straddling its
	 * jamb; everything else is the hollow circle (curve bend point, focus ring).
	 */
	function controlMarkPointsAttr(center: LayoutVec2, radius: number): string {
		const [cx, cy] = center;
		return [
			[cx, cy - radius],
			[cx + radius, cy],
			[cx, cy + radius],
			[cx - radius, cy]
		]
			.map((point) => point.join(','))
			.join(' ');
	}

	/** Eight-point stop mark, flat-topped like a traffic sign, in screen space. */
	function stopMarkPointsAttr(center: LayoutVec2, radius: number): string {
		const [cx, cy] = center;
		const points: string[] = [];
		for (let index = 0; index < 8; index += 1) {
			const angle = (Math.PI / 4) * (index + 0.5);
			points.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
		}
		return points.join(' ');
	}

	/** The refusal x as one path: two screen-space diagonals, no world scaling. */
	function crossPath(center: LayoutVec2, radius: number): string {
		const [cx, cy] = center;
		const r = radius * 0.55;
		return [
			`M ${cx - r} ${cy - r} L ${cx + r} ${cy + r}`,
			`M ${cx - r} ${cy + r} L ${cx + r} ${cy - r}`
		].join(' ');
	}

	/**
	 * P23.13 S5 / §7 — the ratified snap glyphs. All are generated in screen
	 * space from the projected winner, so a snap mark never scales with zoom and
	 * never becomes a hit target (the mark carries no `hit` record at all).
	 *
	 * `triangle` is a midpoint mark pointing along +y, `right-angle` an open
	 * corner, `bracket` the two ticks of an Opening edge straddling the jamb,
	 * `circle-cross` the intersection's × inside a ring, and `plus` the grid
	 * fallback's upright cross.
	 *
	 * `plus` is deliberately NOT `crossPath`: that path is the refusal ×, and a
	 * snap winner must never share a mark with a refused proposal. §7 says "grid
	 * = small cross", which in plan language is the upright `+` — the diagonal ×
	 * already belongs to intersection (and to refusal), so a diagonal grid mark
	 * would give one stroke two meanings and break §6's non-colour identity rule.
	 */
	function snapGlyphPath(shape: string, center: LayoutVec2, radius: number): string {
		const [cx, cy] = center;
		switch (shape) {
			case 'triangle':
				return `M ${cx} ${cy - radius} L ${cx + radius} ${cy + radius * 0.75} L ${cx - radius} ${cy + radius * 0.75} Z`;
			case 'right-angle':
				return `M ${cx - radius} ${cy + radius} L ${cx - radius} ${cy - radius} M ${cx - radius} ${cy + radius} L ${cx + radius} ${cy + radius}`;
			case 'bracket':
				return `M ${cx - radius} ${cy - radius} L ${cx - radius} ${cy + radius} M ${cx + radius} ${cy - radius} L ${cx + radius} ${cy + radius}`;
			case 'circle-cross':
				return `${crossPath(center, radius)}`;
			case 'plus':
				return `M ${cx - radius} ${cy} L ${cx + radius} ${cy} M ${cx} ${cy - radius} L ${cx} ${cy + radius}`;
			case 'dot':
				return `M ${cx} ${cy} m ${-radius} 0 a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`;
			default:
				return '';
		}
	}
</script>

<g class="plan-model">
	{#each model.layers as layer (layer.order)}
		{#each layer.primitives as primitive (primitive.key)}
			{#if primitive.kind === 'polygon'}
				<polygon class={tokenClass(primitive.style)} points={pointsAttr(primitive.points)} style={contextInkStyle(primitive)} />
			{:else if primitive.kind === 'polyline'}
				{#if primitive.architecture?.kind === 'wall'}
					{@const decisions = presentation.decisionsFor(primitive)}
					{@const bandPx = architectureBandPx(planView.pixelsPerMeter, primitive.architecture.thicknessMeters)}
					{@const inkAid = resolveWallInkAid(decisions.wallInkAid, bandPx)}
					{@const wallPoints = polylinePointsAttr(primitive.points, primitive.endOffsetPx)}
					{@const wallState = wallStateClass(primitive.style)}
					<!--
						P23.13 S4 / §2+§6 — compositional state. The Wall's mass NEVER takes a
						state colour and stays graphite: selection adds a separated blue
						perimeter *outside* the profile, hover a neutral one, and both sit
						behind a paper moat so the pair reads as a detached silhouette rather
						than a thicker Wall. Order is the composition: contour (widest) →
						moat → profile casing → band, so the Wall's own ink is never cut.
						`opening-selected` is the hover contour with no blue: the Opening
						owns that selection, the Wall is only its host.
					-->
					{#if wallState === 'selected'}
						<polyline class="wall-contour selected" points={wallPoints} style={architectureWidthStyle(bandPx)} />
						<polyline class="wall-contour-moat selected" points={wallPoints} style={architectureWidthStyle(bandPx)} />
					{:else if wallState === 'hovered' || wallState === 'opening-selected'}
						<polyline class="wall-contour neutral" points={wallPoints} style={architectureWidthStyle(bandPx)} />
						<polyline class="wall-contour-moat neutral" points={wallPoints} style={architectureWidthStyle(bandPx)} />
					{/if}
					{#if inkAid !== 'dense'}
						<polyline
							class={`wall-casing ${wallPartitionClass(primitive)}`}
							points={wallPoints}
							style={architectureWidthStyle(bandPx)}
						/>
					{/if}
					<polyline
						class={`${tokenClass(primitive.style)} ${wallPartitionClass(primitive)}`}
						points={wallPoints}
						style={architectureWidthStyle(bandPx)}
					/>
					{#if inkAid !== 'none'}
						<!-- P23.13 S1 — centered 1 px readability ink. A mark, never a measurement. -->
						<polyline class="wall-silhouette" points={wallPoints} />
					{/if}
				{:else if primitive.architecture?.kind === 'door' || primitive.architecture?.kind === 'window'}
					{@const symbol = openingSymbol(primitive, presentation.decisionsFor(primitive))}
					{#if symbol}
						<polyline
							class="opening-void"
							class:selected={openingSelected(primitive.style)}
							class:hovered={openingHovered(primitive.style)}
							points={pointsAttr(symbol.span)}
							style={architectureWidthStyle(symbol.bandPx)}
						/>
						<polyline class="opening-jamb" class:selected={openingSelected(primitive.style)} class:hovered={openingHovered(primitive.style)} points={pointsAttr(symbol.jambStart)} />
						<polyline class="opening-jamb" class:selected={openingSelected(primitive.style)} class:hovered={openingHovered(primitive.style)} points={pointsAttr(symbol.jambEnd)} />
						{#each symbol.windowStrokes as stroke, index (`${primitive.key}:window-frame:${index}`)}
							<polyline class="window-frame" class:selected={openingSelected(primitive.style)} class:hovered={openingHovered(primitive.style)} points={screenPointsAttr(stroke)} />
						{/each}
						{#if symbol.doorCue}
							<polyline
								class="door-cue"
								class:selected={openingSelected(primitive.style)}
								class:hovered={openingHovered(primitive.style)}
								points={screenPointsAttr(symbol.doorCue)}
								stroke-dasharray={DOOR_TYPE_CUE_DASHARRAY}
							/>
						{/if}
					{/if}
				{:else}
					<polyline class={tokenClass(primitive.style)} points={polylinePointsAttr(primitive.points, primitive.endOffsetPx)} />
				{/if}
			{:else if primitive.kind === 'circle'}
				{@const screen = screenAt(primitive.center, primitive.offsetPx)}
				{#if primitive.shape === 'diamond'}
					<polygon class={tokenClass(primitive.style)} points={controlMarkPointsAttr(screen, primitive.radiusPx)} />
				{:else if primitive.shape === 'square'}
					<rect
						class={tokenClass(primitive.style)}
						x={screen[0] - primitive.radiusPx}
						y={screen[1] - primitive.radiusPx}
						width={primitive.radiusPx * 2}
						height={primitive.radiusPx * 2}
					/>
				{:else if primitive.shape === 'octagon'}
					<polygon class={tokenClass(primitive.style)} points={stopMarkPointsAttr(screen, primitive.radiusPx)} />
				{:else if primitive.shape === 'cross'}
					<path class={tokenClass(primitive.style)} d={crossPath(screen, primitive.radiusPx)} />
				{:else if primitive.shape === 'triangle'}
					<path class={tokenClass(primitive.style)} d={snapGlyphPath('triangle', screen, primitive.radiusPx)} />
				{:else if primitive.style === 'snap-glyph-stroke'}
					<!-- An open-path glyph has no silhouette to separate it from the Wall
					     mass, so it takes the same paper separation every other state mark
					     has (the filled markers get it as their own paper stroke, and the
					     intersection's x as the paper stroke inside its disc). The token
					     comes from the glyph's own ink, so the paint layer is told which
					     treatment applies rather than re-deriving it from the shape. An
					     absent shape draws nothing rather than a guessed mark. -->
					{@const glyphPath = snapGlyphPath(primitive.shape ?? '', screen, primitive.radiusPx)}
					<path class="snap-glyph-halo" d={glyphPath} />
					<path class={tokenClass(primitive.style)} d={glyphPath} />
				{:else if primitive.shape === 'circle-cross'}
					<circle class={tokenClass(primitive.style)} cx={screen[0]} cy={screen[1]} r={primitive.radiusPx} />
					<path
						class="snap-glyph-cross"
						d={snapGlyphPath('circle-cross', screen, primitive.radiusPx)}
					/>
				{:else}
					<circle class={tokenClass(primitive.style)} cx={screen[0]} cy={screen[1]} r={primitive.radiusPx} />
				{/if}
			{:else if primitive.pill}
				{@const screen = screenAt(primitive.anchor, primitive.offsetPx)}
				{@const pill = primitive.pill}
				{@const width = Math.max(30, primitive.text.length * 7.1 + 16)}
				<g class="pill-badge" class:selected={pill.selected === true} pointer-events="none">
					<title>
						{pill.segments.every((segment) => segment.authored)
							? 'Authored timing'
							: pill.segments.some((segment) => segment.authored)
								? 'Partly authored timing'
								: 'Automatic timing'}
					</title>
					<rect x={screen[0] - width / 2} y={screen[1] - 14} width={width} height={18} rx={4} />
					<text class={tokenClass(primitive.style)} x={screen[0]} y={screen[1]}>
						{#each pill.segments as segment, index (index)}
							{#if index > 0}<tspan aria-hidden="true"> · </tspan>{/if}
							<tspan class:auto={!segment.authored}>{segment.text}</tspan>
						{/each}
					</text>
				</g>
			{:else}
				{@const screen = screenAt(primitive.anchor, primitive.offsetPx)}
				<text class={tokenClass(primitive.style)} x={screen[0]} y={screen[1]}>{primitive.text}</text>
			{/if}
		{/each}
	{/each}
</g>

<style>
	/* P3.2/P3.3 — canonical §9 paper palette + ONE selection language:
	   blue `--editor-plan-selection` for every owner (rooms, walls, openings,
	   layout objects, scene entities); context/read-only stays muted. */
	.room-fill { fill: var(--editor-plan-room-bg); fill-opacity: 1; }
	.room-fill.selected { fill: var(--editor-plan-room-selected-bg); fill-opacity: 1; }
	.room-outline { fill: none; stroke: var(--editor-plan-wall); stroke-width: 1; vector-effect: non-scaling-stroke; }
	.room-outline.selected { stroke: var(--editor-plan-selection); stroke-width: 3; }
	/* P23.13 S9 / §1.12 — passive Scene context is *continuous light ink and no
	   fill*: a footprint reads as the outline of what the plan sits on, never as
	   an authored area, and its weight is S2's regime fraction applied as
	   per-primitive opacity (30% normal-near, 15% far, 10% inside a live
	   instrument zone) by `contextInkStyle`. The state variants keep their fills
	   because that ink is feedback, not passive context. Both values stay hooked
	   so the Camera Plan keeps its own dashed, filled footprints (P14) without
	   the Layout Plan inheriting them. */
	.scene-footprint { fill: var(--plan-footprint-fill, none); stroke: var(--plan-footprint-stroke, var(--editor-plan-muted)); stroke-width: 1.5; stroke-dasharray: var(--plan-footprint-dasharray, none); vector-effect: non-scaling-stroke; pointer-events: none; }
	.scene-footprint.active { fill: rgb(47 140 255 / 10%); stroke: var(--editor-plan-hover-stroke); stroke-width: 2; }
	.scene-footprint.bridge-hover { fill: rgb(47 140 255 / 16%); stroke: var(--editor-plan-hover-stroke); stroke-width: 2.5; }
	.scene-footprint.selected { fill: rgb(47 140 255 / 24%); stroke: var(--editor-plan-selection); stroke-width: 3; }
	.selection-bounds { fill: none; stroke: var(--editor-plan-selection); stroke-width: 1; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; pointer-events: none; }
	/* P23.13 S0 — the band (physical-width body) and the ink (drafting profile)
	   are separate paint roles now. `--editor-plan-wall-band` carries the exact
	   canonical projection, `--editor-plan-wall-ink` the outline/termination ink;
	   selection blue stays an overlay on top of both and never recolours the mass. */
	.wall-casing,
	.wall-line,
	.opening-void,
	.opening-jamb,
	.window-frame,
	.wall-silhouette,
	.door-cue { fill: none; vector-effect: non-scaling-stroke; pointer-events: none; }
	/* The band is the canonical physical-width projection (a measurement); the
	   casing is the 1 px exterior profile (a mark). Square caps close a free end
	   and let touching spans read as one mass at a join — no invented union,
	   bevel or bridge, so an insufficient-junction seam stays truthful for P23.15. */
	/* The profile is the ink for BOTH roles: a non-bounding Wall keeps the same
	   continuous dark perimeter and only its solid body is lighter (§2). */
	.wall-casing { stroke: var(--editor-plan-wall-ink); stroke-width: calc(var(--architecture-band-width) + 2px); stroke-linecap: square; stroke-linejoin: miter; }
	.wall-line { stroke: var(--editor-plan-wall-band); stroke-width: var(--architecture-band-width); stroke-linecap: square; stroke-linejoin: miter; }
	/* P23.13 S1 — non-bounding body gets its own token (lighter solid body, same
	   dark continuous perimeter as a bounding Wall). */
	.wall-line.partition { stroke: var(--editor-plan-partition-body); }
	/* P23.13 S4 — the state perimeter. Widths are relative to the band so the gap
	   stays screen-constant: 2 px separation to the 1.5 px blue contour when
	   selected, 3 px to the 1 px neutral contour when hovered. */
	.wall-contour { fill: none; stroke-linecap: square; stroke-linejoin: miter; vector-effect: non-scaling-stroke; pointer-events: none; }
	.wall-contour.selected { stroke: var(--editor-plan-wall-contour-selected); stroke-width: calc(var(--architecture-band-width) + 7px); }
	.wall-contour.neutral { stroke: var(--editor-plan-wall-contour-neutral); stroke-width: calc(var(--architecture-band-width) + 8px); }
	/* The paper separation §6 asks for: painted over whatever sits around the Wall
	   (paint order, so the Wall's own profile and band are drawn after and stay
	   untouched). Visible widths are therefore the contour widths minus this —
	   1.5 px blue at a 2 px gap when selected, 1 px neutral at 3 px when hovered. */
	.wall-contour-moat { fill: none; stroke: var(--editor-plan-canvas-bg); stroke-linecap: square; stroke-linejoin: miter; vector-effect: non-scaling-stroke; pointer-events: none; }
	.wall-contour-moat.selected { stroke-width: calc(var(--architecture-band-width) + 4px); }
	.wall-contour-moat.neutral { stroke-width: calc(var(--architecture-band-width) + 6px); }
	/* P23.13 S1 — centered readability ink below 2 px projected band. Excluded
	   from hit, snap and measurement truth: it is drawn, never queried. */
	.wall-silhouette { stroke: var(--editor-plan-silhouette); stroke-width: 1; stroke-linecap: butt; }
	/* The void erases the band's cap bleed and profile across the exact authored
	   interval, so the cut reads as a true gap on paper and off it. */
	.opening-void { stroke: var(--editor-plan-opening-void); stroke-width: calc(var(--architecture-band-width) + 2px); }
	.opening-void.hovered { stroke: color-mix(in srgb, var(--editor-plan-hover-stroke) 14%, var(--editor-plan-opening-void)); }
	.opening-void.selected { stroke: color-mix(in srgb, var(--editor-plan-selection) 14%, var(--editor-plan-opening-void)); }
	.opening-jamb { stroke: var(--editor-plan-wall-ink); stroke-width: 1.25; }
	.window-frame { stroke: var(--editor-plan-secondary-ink); stroke-width: 1; }
	/* P23.13 A2 — the Door type cue: 1 px secondary ink, `2 2`, symmetric about the
	   Wall centerline and free to protrude beyond the band. Symbolic only: no
	   hinge, leaf, handing, swing, opening side, sill, threshold or animation. */
	.door-cue { stroke: var(--editor-plan-door-cue); stroke-width: 1; stroke-linecap: butt; }
	.opening-jamb.hovered,
	.window-frame.hovered,
	.door-cue.hovered { stroke: var(--editor-plan-hover-stroke); }
	.opening-jamb.selected,
	.window-frame.selected,
	.door-cue.selected { stroke: var(--editor-plan-selection); }
	/* Fallback for renderer-neutral projections without architecture metadata. */
	.opening-line { stroke: var(--editor-plan-object); stroke-width: 7; vector-effect: non-scaling-stroke; pointer-events: none; }
	.opening-line.hovered { stroke: var(--editor-plan-hover-stroke); stroke-width: 8; }
	.opening-line.opening-selected { stroke: var(--editor-plan-selection); stroke-width: 9; }
	.layout-object { fill: var(--plan-layout-object-fill, var(--editor-plan-object-fill)); stroke: var(--plan-layout-object-stroke, var(--editor-plan-object-stroke)); stroke-width: 2; stroke-dasharray: var(--plan-layout-object-dasharray, none); vector-effect: non-scaling-stroke; pointer-events: none; }
	.layout-object.selected { fill: rgb(47 140 255 / 24%); stroke: var(--editor-plan-selection); stroke-width: 3; }
	.layout-object.readonly { fill: var(--plan-layout-object-fill, var(--editor-plan-readonly-fill)); stroke-dasharray: var(--plan-layout-object-dasharray, 5 3); }
	/* P3.3 — Arrange hover outline (presentation-only, never looks selected). */
	.arrange-hover { fill: rgb(47 140 255 / 8%); stroke: var(--editor-plan-hover-stroke); stroke-width: 2; stroke-dasharray: 6 4; vector-effect: non-scaling-stroke; pointer-events: none; }
	.camera-path { fill: none; stroke: var(--editor-camera-edge-stroke); stroke-width: 2; stroke-dasharray: 6 4; vector-effect: non-scaling-stroke; pointer-events: none; }
	.view-cone { fill: rgb(47 140 255 / 8%); stroke: var(--editor-camera-edge-stroke); stroke-width: 1; vector-effect: non-scaling-stroke; pointer-events: none; }
	.look-target { fill: var(--editor-plan-node-seq-bg); stroke: var(--editor-plan-label); stroke-width: 1; pointer-events: none; }
	.portal-crossing { fill: var(--editor-plan-object); stroke: var(--editor-plan-wall); stroke-width: 1; pointer-events: none; }
	.collision-warning { fill: rgb(239 98 108 / 30%); stroke: var(--editor-danger); stroke-width: 1; pointer-events: none; }
	.timing-label { fill: var(--editor-plan-label); font: 10px var(--editor-font); font-variant-numeric: tabular-nums; paint-order: stroke; stroke: var(--editor-plan-canvas-bg); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; }
	/* P1.5 — Camera Plan authoring styles (live camera-graph overlay). */
	.camera-edge { fill: none; stroke: var(--editor-camera-edge-stroke); stroke-width: 2; vector-effect: non-scaling-stroke; }
	.camera-edge.selected { stroke: var(--editor-plan-selection); stroke-width: 3.5; }
	.camera-edge.hovered { stroke: var(--editor-plan-hover-stroke); stroke-width: 3; }
	.camera-edge.retained { stroke: var(--editor-plan-muted); stroke-width: 2; stroke-dasharray: 5 4; }
	/* P3B.6 — retained identity stays dashed/desaturated while state feedback
	   remains visible. */
	.camera-edge.retained.selected { stroke: color-mix(in srgb, var(--editor-plan-selection) 48%, var(--editor-plan-muted)); stroke-width: 3.5; stroke-dasharray: 5 4; }
	.camera-edge.retained.hovered { stroke: color-mix(in srgb, var(--editor-plan-hover-stroke) 42%, var(--editor-plan-muted)); stroke-width: 3; stroke-dasharray: 5 4; }
	/* P21.5 Slice 2B — camera node role colors are canvas-invariant tokens
	   (plan.css); selection = halo + size growth, never fill inversion.
	   Hover previews selection (active fill + white ring) but keeps 24px.
	   Unsequenced: paper disc, dashed emerald ring at rest, solid + blue
	   tint when selected. The `.free` rule wins over `.hovered` (equal
	   specificity, later in file) — unsequenced nodes don't hover-change,
	   matching the pre-2B behavior. */
	.camera-node { fill: var(--editor-plan-node-seq-bg); stroke: var(--editor-plan-node-seq-border); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
	.camera-node.selected { fill: var(--editor-plan-node-seq-bg-active); stroke: var(--editor-plan-node-seq-border); stroke-width: 2; }
	.camera-node.hovered { fill: var(--editor-plan-node-seq-bg-active); stroke: var(--editor-plan-node-seq-border); stroke-width: 2; }
	.camera-node.free { fill: var(--editor-plan-canvas-bg); stroke: var(--editor-plan-node-unseq-border); stroke-width: 2; stroke-dasharray: 4 3; }
	.camera-node.free.selected { fill: var(--editor-plan-node-unseq-bg-active); stroke: var(--editor-plan-node-unseq-border); stroke-width: 2; stroke-dasharray: none; }
	.camera-node-halo { fill: var(--editor-plan-node-halo); pointer-events: none; }
	.camera-node-glyph { fill: var(--editor-plan-node-unseq-glyph); pointer-events: none; }
	.camera-anchor { fill: var(--editor-accent); stroke: var(--editor-text-primary); stroke-width: 2; vector-effect: non-scaling-stroke; }
	.camera-anchor.selected { fill: var(--editor-text-primary); stroke: var(--editor-accent-pressed); stroke-width: 2.5; }
	.camera-anchor.hovered { fill: var(--editor-accent-hover); stroke: var(--editor-text-primary); stroke-width: 2.5; }
	.camera-order-label { fill: var(--editor-plan-node-seq-text); font: 700 11px var(--editor-font); font-variant-numeric: tabular-nums; text-anchor: middle; dominant-baseline: middle; paint-order: stroke; stroke: var(--editor-plan-node-seq-bg-active); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; }
	/* P21.5 §2.5 — camera timing labels render as compact midpoint pills:
	   ~18px rounded badge behind 11px/600 tabular text on invariant pill ink
	   (the canvas is paper in every theme — never the chrome accent).
	   Unselected pills read on paper and room floors (white + slate border +
	   charcoal ink); selected pills take deep sapphire + white ink with an
	   electric-blue perimeter tied to the route. Automatic segments carry a
	   dotted underline (offset 3px) + tooltip, authored segments solid.
	   pointer-events stays none (the Inspector owns the full breakdown). */
	.camera-timing-label { fill: var(--editor-plan-edge-pill-unselected-text); font: 600 11px var(--editor-font); font-variant-numeric: tabular-nums; text-anchor: middle; pointer-events: none; }
	.pill-badge { pointer-events: none; }
	.pill-badge rect { fill: var(--editor-plan-edge-pill-unselected-bg); stroke: var(--editor-plan-edge-pill-unselected-border); stroke-width: 1; filter: drop-shadow(0 1px 2px rgb(0 0 0 / 18%)); }
	.pill-badge.selected rect { fill: var(--editor-plan-edge-pill-selected-bg); stroke: var(--editor-plan-edge-pill-selected-border); stroke-width: 1.5; }
	.pill-badge.selected .camera-timing-label { fill: var(--editor-plan-edge-pill-selected-text); }
	.pill-badge .auto { fill: var(--editor-plan-edge-pill-unselected-text); text-decoration: underline dotted; text-decoration-color: var(--editor-plan-edge-pill-auto-underline); text-underline-offset: 3px; text-decoration-thickness: 1.5px; }
	.pill-badge.selected .auto { fill: var(--editor-plan-edge-pill-selected-auto-text); text-decoration-color: var(--editor-plan-edge-pill-selected-auto-underline); }
	.camera-connect-band { fill: none; stroke: var(--editor-plan-selection); stroke-width: 2; stroke-dasharray: 6 4; vector-effect: non-scaling-stroke; pointer-events: none; }
	.camera-placement-ghost { fill: var(--editor-accent-soft); stroke: var(--editor-plan-selection); stroke-width: 2; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; pointer-events: none; }
	.camera-placement-ghost.invalid { fill: rgb(239 98 108 / 20%); stroke: var(--editor-danger); }
	.primitive-ghost { fill: rgb(47 140 255 / 18%); stroke: var(--editor-plan-selection); stroke-width: 2; stroke-dasharray: 7 4; vector-effect: non-scaling-stroke; pointer-events: none; }
	.primitive-ghost.circle { fill: rgb(49 201 133 / 18%); stroke: var(--editor-success); }
	.primitive-ghost.sphere { fill: rgb(140 124 243 / 18%); stroke: var(--editor-timeline-look); }
	.primitive-ghost.invalid { fill: rgb(239 98 108 / 22%); stroke: var(--editor-danger); }
	.interior-anchor { fill: var(--editor-accent); stroke: var(--editor-text-primary); stroke-width: 2; vector-effect: non-scaling-stroke; }
	.interior-anchor.selected { fill: var(--editor-text-primary); stroke: var(--editor-accent-pressed); }
	.vertex-handle { fill: var(--editor-plan-handle-fill); stroke: var(--editor-plan-handle-stroke); stroke-width: 2; vector-effect: non-scaling-stroke; }
	/* P23.3 — canonical Opening width handles (edge-fixed resize affordances). */
	.opening-handle { fill: var(--editor-plan-handle-fill); stroke: var(--editor-plan-handle-stroke); stroke-width: 2; vector-effect: non-scaling-stroke; }
	/* P23.13 S4 / §6 — the slide grip is ink-only: it must not read as a filled
	   mark, because it slides the whole Opening rather than one edge. */
	.opening-slide-grip { fill: none; stroke: var(--editor-plan-handle-stroke); stroke-width: 2; stroke-linecap: round; vector-effect: non-scaling-stroke; }
	/* P23.3 — transient Opening drag preview; invalid stays red and never commits. */
	.opening-drag-preview { fill: rgb(47 140 255 / 18%); stroke: var(--editor-plan-selection); stroke-width: 2; stroke-dasharray: 5 3; vector-effect: non-scaling-stroke; pointer-events: none; }
	.opening-drag-preview.invalid { fill: rgb(239 98 108 / 20%); stroke: var(--editor-danger); }
	/* P23.10 — direct Wall/Junction edit intent. An invalid candidate never
	   installs; only this transient outline shows what the pointer asked for. */
	.architecture-edit-intent { fill: rgb(47 140 255 / 18%); stroke: var(--editor-plan-selection); stroke-width: 2; stroke-dasharray: 5 3; vector-effect: non-scaling-stroke; pointer-events: none; }
	/* P23.13 S4 / §6 — a pending proposal is a *continuous* candidate; a refused
	   one breaks into the ratified 4/3 rhythm so pending vs refused reads without
	   colour. The installed geometry is never recoloured or moved. */
	.architecture-edit-intent.invalid { fill: rgb(239 98 108 / 20%); stroke: var(--editor-danger); stroke-dasharray: 4 3; }
	/* P23.13 S4 / §6 — focus language: a dark double ring with a paper moat,
	   painted over every other state. Drawn, never queried: no hit path reads it. */
	/* Widths are fixed so the moat under a ring erases exactly the ring's own
	   band and never the focused mark it surrounds (§6). */
	.focus-moat { fill: none; stroke: var(--editor-plan-canvas-bg); stroke-width: 3.5; vector-effect: non-scaling-stroke; pointer-events: none; }
	.focus-ring { fill: none; stroke: var(--editor-plan-label); stroke-width: 1.5; vector-effect: non-scaling-stroke; pointer-events: none; }
	/* P23.13 S4 / §6 — focus/drag reveals the owner's broken 1 px control polygon
	   and its true reference centerline. Marks, not measurements. */
	.control-polygon { fill: none; stroke: var(--editor-plan-secondary-ink); stroke-width: 1; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; pointer-events: none; }
	.control-centerline { fill: none; stroke: var(--editor-plan-secondary-ink); stroke-width: 1; vector-effect: non-scaling-stroke; pointer-events: none; }
	/* P23.13 S4 / §6 — the refusal mark of a known-invalid proposal. */
	.refusal-stop { fill: var(--editor-danger); stroke: var(--editor-plan-canvas-bg); stroke-width: 1.5; vector-effect: non-scaling-stroke; pointer-events: none; }
	.refusal-cross { fill: none; stroke: var(--editor-plan-canvas-bg); stroke-width: 1.5; stroke-linecap: round; vector-effect: non-scaling-stroke; pointer-events: none; }
	/* P23.13 S8 / §6 — the *persisted* refusal keeps the same stop/× on the
	   drawing for its bounded lifetime and answers it with the planner's own
	   words, knocked out of the band it refused to modify. */
	.refusal-reason { fill: var(--editor-danger); font: 11px var(--editor-font); paint-order: stroke; stroke: var(--editor-plan-canvas-bg); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; user-select: none; }
	/* P23.13 S8 / §7 — the closure wash: the faintest Room ink, and only ever
	   painted from a face the closing leg's own canonical plan produced. No
	   stroke, because it is a wash and not an enclosure outline; nothing here is
	   hit-testable or measurable. */
	.closure-wash { fill: rgb(47 140 255 / 7%); stroke: none; pointer-events: none; }
	.rotation-arm { fill: none; stroke: var(--editor-accent-pressed); stroke-width: 3; vector-effect: non-scaling-stroke; pointer-events: none; }
	.rotation-handle { fill: var(--editor-plan-handle-fill); stroke: var(--editor-plan-handle-stroke); stroke-width: 2; vector-effect: non-scaling-stroke; pointer-events: none; }
	.rotation-feedback { fill: var(--editor-plan-label); font: 700 11px var(--editor-font); font-variant-numeric: tabular-nums; paint-order: stroke; stroke: var(--editor-plan-canvas-bg); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; user-select: none; }
	/* P23.13 S6 / §7 — "0.75 px witnesses, 4 px slanted ticks and horizontal
	   11 px mono text on a small paper knockout". One ink for the whole
	   instrument (line, witnesses, ticks) so a witness can never be mistaken for
	   cut geometry, and mono so digits cannot shift the text box the placer
	   already measured. */
	.dimension-witness { fill: none; stroke: var(--editor-plan-muted); stroke-width: 0.75; vector-effect: non-scaling-stroke; pointer-events: none; }
	/* P23.13 S6 / §7 — the placer measures the text box to place it: the value is
	   centred on the lane point and baseline-sits on the line, so the paint layer
	   must anchor it at the middle. A start-anchored label would drift right by
	   half its own width and make the placer's fits/readout arithmetic a lie. */
	.dimension-label { fill: var(--editor-plan-muted); font: 11px var(--editor-font-mono, ui-monospace), SFMono-Regular, Consolas, monospace; font-variant-numeric: tabular-nums; text-anchor: middle; paint-order: stroke; stroke: var(--editor-plan-canvas-bg); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; }
	.draft-outline { fill: rgb(47 140 255 / 10%); stroke: var(--editor-plan-selection); stroke-width: 2; stroke-dasharray: 8 4; vector-effect: non-scaling-stroke; }
	.draft-outline-partition { fill: rgb(201 134 31 / 10%); stroke: #c9861f; stroke-width: 2; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
	/* P23.6 — degenerate candidate leg: invalid before commit, never committed. */
	.draft-outline-invalid { fill: rgb(239 98 108 / 10%); stroke: var(--editor-danger); stroke-width: 2; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
	/* P23.6/P23.13 S3 — persistent Room label stack: quiet metadata, never
	   interactive. Name / reference / derived area share one world anchor and a
	   screen-constant baseline offset resolved by the placer; the subordinate
	   lines are never wrapped, shrunk or letter-spaced. */
	.room-name { fill: var(--editor-plan-label); font: 600 11px var(--editor-font); text-anchor: middle; paint-order: stroke; stroke: var(--editor-plan-canvas-bg); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; }
	.room-reference { fill: var(--editor-plan-muted); font: 500 10px var(--editor-font); text-anchor: middle; paint-order: stroke; stroke: var(--editor-plan-canvas-bg); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; }
	.room-area { fill: var(--editor-plan-muted); font: 500 10px var(--editor-font); font-variant-numeric: tabular-nums; text-anchor: middle; paint-order: stroke; stroke: var(--editor-plan-canvas-bg); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; }
	/* P23.6 — committed diagnostic state marker; the reason lives in Inspector. */
	.layout-diagnostic { fill: rgb(239 98 108 / 14%); stroke: var(--editor-danger); stroke-width: 2; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; pointer-events: none; }
	.vertex-handle.selected, .vertex-handle-selected { fill: var(--editor-plan-selection); stroke: var(--editor-plan-canvas-bg); }
	.vertex-handle.hovered, .vertex-handle-hovered { fill: var(--editor-plan-hover-stroke); stroke: var(--editor-plan-canvas-bg); }
	/* P23.11 — interior curve controls: hollow so they never read as the
	   Junction handles they reshape the Wall between. */
	.curve-control { fill: var(--editor-plan-canvas-bg); stroke: var(--editor-plan-handle-stroke); stroke-width: 2; vector-effect: non-scaling-stroke; }
	.curve-control.hovered, .curve-control-hovered { fill: var(--editor-plan-hover-stroke); stroke: var(--editor-plan-canvas-bg); }
	.draft-point { fill: var(--editor-plan-handle-fill); stroke: var(--editor-plan-handle-stroke); stroke-width: 2; vector-effect: non-scaling-stroke; }
	/* P23.2 — session-only snap feedback (semantic rank above grid fallback). */
	/* P23.13 S5 / §2 — Snap is its own ink (`#146D68`), not the selection blue.
	   A snap winner is a *relation*, and presenting it in the selection colour
	   made "the pointer is aligned" read as "this is selected". The 2 px paper
	   stroke is the same separation §6 gives every state mark — it is not §7's
	   "2 px source accent", which is deliberately not drawn (the winner's
	   `sourceId` carries no paintable source; see the plan). The grid fallback
	   keeps the same ink because §7 distinguishes it by its glyph, not by
	   going quieter. */
	.snap-guide { fill: none; stroke: var(--editor-plan-snap); stroke-width: 1; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; pointer-events: none; }
	.snap-marker { fill: var(--editor-plan-snap); stroke: var(--editor-plan-canvas-bg); stroke-width: 2; vector-effect: non-scaling-stroke; pointer-events: none; }
	/* An open-path glyph has no area to fill: the snap ink *is* its stroke. Using
	   the filled marker token here painted the bracket and the right angle as a
	   paper-coloured notch in the Wall band. */
	.snap-glyph-stroke { fill: none; stroke: var(--editor-plan-snap); stroke-width: 1.5; vector-effect: non-scaling-stroke; pointer-events: none; }
	/* P23.13 S5 — the paper separation an open-path snap glyph would otherwise
	   lack, painted under the ink so the mark never sits directly on the Wall. */
	.snap-glyph-halo { fill: none; stroke: var(--editor-plan-canvas-bg); stroke-width: 3.5; vector-effect: non-scaling-stroke; pointer-events: none; }
	/* §6 — snap is glyph + word. The word is the relation's non-colour identity. */
	.snap-relation-label { fill: var(--editor-plan-snap); font: 600 10px var(--editor-font); paint-order: stroke; stroke: var(--editor-plan-canvas-bg); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; user-select: none; }
	/* The intersection's × inside its ring, painted over the ring's own fill. */
	.snap-glyph-cross { fill: none; stroke: var(--editor-plan-canvas-bg); stroke-width: 1.5; stroke-linecap: round; vector-effect: non-scaling-stroke; pointer-events: none; }
</style>
