<script lang="ts">
	/**
	 * R217.S28 — Experience View marks on the Stage.
	 *
	 * Every point comes from `experience-marks`, which projects the authored Views
	 * through the current `ViewportEvaluation`. The overlay only paints: in 3D each
	 * View is a Detailed camera aimed along its authored eye -> target, in Plan a dot
	 * with a short wedge. A single click selects a marker without moving the Camera,
	 * a double-click opens Look through, and Move/aim belongs to the Stage's one
	 * gesture lease.
	 */
	import { projectWorld, type ViewportEvaluation } from '@portfolio/camera-core';
	import {
		experienceMarkModel,
		relatedToSelection,
		projectPlacementGhost,
		type PlacementGhostPose,
		type ExperienceCameraGlyph,
		EXPERIENCE_MARK_CAPS,
		type ExperienceCameraFrustum,
		type ExperienceFrustum,
		type StageBox,
		type StagePoint
	} from './experience-marks';
	import { experienceHomes } from './experience-homes';
	import ExperiencePaths from './ExperiencePaths.svelte';

	let {
		evaluation,
		/** R217.S30 — the projected, read-only playback rig; never an authored mark. */
		rig = null,
		placementGhost = null,
		onLookThrough,
		showMarkers = true,
		showFrustums = true,
		showPaths = true,
		showLabels = true,
		selectionOnly = false,
		onPlanePoint,
		beginPathDragLease,
		endPathDragLease
	}: {
		evaluation: ViewportEvaluation;
		rig?: { readonly eye: readonly [number, number, number]; readonly target: readonly [number, number, number] } | null;
		placementGhost?: PlacementGhostPose | null;
		onLookThrough?: (viewId: string) => void;
		/** R217.S29 Show ▾: the four independent flags, all on by default. */
		showMarkers?: boolean;
		showFrustums?: boolean;
		showPaths?: boolean;
		showLabels?: boolean;
		selectionOnly?: boolean;
		onPlanePoint?: (css: readonly [number, number], height: number) => [number, number, number] | null;
		beginPathDragLease?: () => boolean;
		endPathDragLease?: () => void;
	} = $props();

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const subject = $derived(controller?.subject ?? null);
	const travelling = $derived(controller?.selectedPath !== null && controller?.selectedPath !== undefined);
	const plan = $derived(evaluation.projectionKind === 'plan-orthographic');
	const selection = $derived({
		presentationId: subject?.kind === 'presentation' || subject?.kind === 'view' ? subject.presentationId : null,
		viewId: subject?.kind === 'view' ? subject.viewId : null,
		stopId: subject?.kind === 'stop' ? subject.stopId : null,
		path: controller?.selectedPath?.occurrence ?? (subject?.kind === 'transition'
			? { kind: 'transition' as const, stopId: subject.stopId }
			: null)
	});
	const model = $derived(experienceMarkModel({
		experience: controller?.current ?? null,
		guide: controller?.contextGuide ?? null,
		views: controller?.cameraViews ?? [],
		evaluation,
		selection
	}));
	const relatedPaths = $derived(controller?.current == null
		? new Set<string>()
		: relatedToSelection(selection, controller.current, controller.contextGuide ?? null).paths);
	const filtered = $derived.by(() => ({
		marks: selectionOnly ? model.marks.filter((mark) => mark.state === 'selected' || mark.state === 'strong') : model.marks,
		frustums: selectionOnly
			? model.frustums.filter((frustum) => frustum.state === 'selected' || frustum.state === 'strong')
			: model.frustums
	}));

	// The turn grip lies under every other mark, so the selected eye dot (Move) and
	// the other Views stay pressable where they overlap the wedge.
	const orderedMarks = $derived([
		...filtered.marks.filter((mark) => mark.kind === 'turn'),
		...filtered.marks.filter((mark) => mark.kind !== 'turn')
	]);

	const placement = $derived(placementGhost === null ? null : projectPlacementGhost(evaluation, placementGhost));

	const rigPoint = $derived.by(() => {
		if (rig === null) return null;
		const eye = projectWorld(rig.eye, evaluation, evaluation.token);
		const target = projectWorld(rig.target, evaluation, evaluation.token);
		if (eye.kind !== 'projected' || eye.visibility !== 'visible') return null;
		const local = (point: readonly [number, number]) =>
			[point[0] - evaluation.rect.left, point[1] - evaluation.rect.top] as const;
		return {
			eye: local(eye.css),
			target: target.kind === 'projected' && target.visibility === 'visible' ? local(target.css) : null
		};
	});

	function selectView(viewId: string, presentationId: string): void {
		homes.select({ kind: 'view', viewId, presentationId });
	}

	function polygon(points: readonly StagePoint[]): string {
		return points.map((point) => `${point[0]},${point[1]}`).join(' ');
	}

	function outline(points: readonly StagePoint[]): string {
		return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0]},${point[1]}`).join('')}Z`;
	}

	/** Plan wedge: the arc at the View's FOV, drawn from the eye. */
	function wedgePath(frustum: ExperienceFrustum): string {
		const [ex, ey] = frustum.eye;
		return `M${ex},${ey}L${frustum.left[0]},${frustum.left[1]}A${frustum.length},${frustum.length} 0 0 1 ${frustum.right[0]},${frustum.right[1]}Z`;
	}

	/** The 3D wire frustum: four edges from the lens tip and the far rectangle. */
	function wirePath(frustum: ExperienceCameraFrustum): string {
		const [a, b, c, d] = frustum.corners;
		const apex = `${frustum.apex[0]},${frustum.apex[1]}`;
		const at = (point: StagePoint) => `${point[0]},${point[1]}`;
		return `M${apex}L${at(a)}M${apex}L${at(b)}M${apex}L${at(c)}M${apex}L${at(d)}M${at(a)}L${at(b)}L${at(c)}L${at(d)}Z`;
	}

	/** Four L-shaped corner brackets around a box: the selection mark, never a box. */
	function brackets(box: StageBox): string {
		const [x0, y0, x1, y1] = box;
		const c = 6;
		return `M${x0},${y0 + c}V${y0}H${x0 + c}M${x1 - c},${y0}H${x1}V${y0 + c}M${x1},${y1 - c}V${y1}H${x1 - c}M${x0 + c},${y1}H${x0}V${y1 - c}`;
	}

	function tagWidth(text: string): number {
		return 8 + text.length * 6.1;
	}

	function dotRadius(state: string): number {
		return state === 'selected' ? 4.6 : state === 'strong' ? 4.2 : 3.6;
	}
</script>

{#snippet detailedCamera(camera: ExperienceCameraGlyph, wire: boolean)}
	{#if camera.shadow}
		<ellipse class="cam-shadow" cx={camera.shadow.center[0]} cy={camera.shadow.center[1]} rx={camera.shadow.rx} ry={camera.shadow.ry} />
	{/if}
	{#if camera.stem}
		<line class="stem" x1={camera.stem[0][0]} y1={camera.stem[0][1]} x2={camera.stem[1][0]} y2={camera.stem[1][1]} />
	{/if}
	{#if camera.floor}
		<circle class="foot" cx={camera.floor[0]} cy={camera.floor[1]} r="2.6" />
	{/if}
	{#if wire && camera.frustum}
		<path class="wire" d={wirePath(camera.frustum)} data-camera-wire />
	{/if}
	<g class="cam" data-camera-glyph>
		{#each camera.faces as face, index (index)}
			<polygon class="face {face.shade}" points={polygon(face.points)} />
		{/each}
		{#if camera.glass}
			<polygon class="glass" points={polygon(camera.glass)} />
		{/if}
		{#if camera.glint}
			<circle class="glint" cx={camera.glint[0]} cy={camera.glint[1]} r="1.1" />
		{/if}
		<path class="outline" d={outline(camera.outline)} />
	</g>
{/snippet}

<svg
	class="experience-marks"
	role="group"
	aria-label="View markers"
	data-experience-marks
	data-stage-reading={plan ? 'plan' : '3d'}
	data-label-cap={EXPERIENCE_MARK_CAPS.labels}
	data-frustum-cap={EXPERIENCE_MARK_CAPS.frustums}
	focusable="false"
>
	{#if showFrustums}
	{#each filtered.frustums as frustum (frustum.viewId)}
		<path
			class="frustum {frustum.state}"
			d={wedgePath(frustum)}
			data-view-frustum={frustum.viewId}
		/>
	{/each}
	{/if}
	{#if showPaths}
		<ExperiencePaths
			{evaluation}
			{selectionOnly}
			{relatedPaths}
			{onPlanePoint}
			beginLease={beginPathDragLease}
			endLease={endPathDragLease}
		/>
	{/if}
	{#if rigPoint !== null}
		<g class="rig" data-camera-rig aria-hidden="true">
			{#if rigPoint.target !== null}
				<line x1={rigPoint.eye[0]} y1={rigPoint.eye[1]} x2={rigPoint.target[0]} y2={rigPoint.target[1]} />
			{/if}
			<circle class="rig-halo" cx={rigPoint.eye[0]} cy={rigPoint.eye[1]} r="9" />
			<circle class="rig-dot" cx={rigPoint.eye[0]} cy={rigPoint.eye[1]} r="4.5" />
			<text x={rigPoint.eye[0] + 10} y={rigPoint.eye[1] - 10}>Rig</text>
		</g>
	{/if}
	{#if showMarkers}
	{#each orderedMarks as mark (mark.id)}
		<g
			class="mark {mark.state}{travelling ? ' travel' : ''}"
			data-view-mark={mark.viewId}
			data-mark-kind={mark.kind}
			data-mark-state={mark.state}
		>
			{#if mark.camera}
				{@const camera = mark.camera}
				{@render detailedCamera(camera, showFrustums)}
				{#if showFrustums && camera.frustum && mark.state === 'selected'}
					<path class="turn-wire" d={wirePath(camera.frustum)} data-turn-grip>
						<title>Drag to turn this View</title>
					</path>
				{/if}
			{:else if mark.kind === 'turn'}
				{@const grip = model.frustums.find((frustum) => frustum.viewId === mark.viewId)}
				{#if grip !== undefined}
					<path class="turn-grip" d={wedgePath(grip)} data-turn-grip>
						<title>Drag to turn this View</title>
					</path>
				{/if}
			{:else}
				<circle class="dot" cx={mark.css[0]} cy={mark.css[1]} r={dotRadius(mark.state)} />
			{/if}
			<!-- 44 px coarse target: transparent, so the ink stays screen-small. -->
			{#if mark.kind !== 'turn'}
			<circle
				class="hit"
				cx={mark.css[0]}
				cy={mark.css[1]}
				r="22"
				role="button"
				tabindex="0"
				aria-label={`${mark.label || 'View'}${mark.number === null ? '' : `, guided view ${mark.number}`}`}
				onclick={(event) => {
					event.stopPropagation();
					selectView(mark.viewId, mark.presentationId);
				}}
				ondblclick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					onLookThrough?.(mark.viewId);
				}}
				onkeydown={(event) => {
					if (event.key !== 'Enter' && event.key !== ' ') return;
					event.preventDefault();
					event.stopPropagation();
					selectView(mark.viewId, mark.presentationId);
				}}
			/>
			{/if}
			{#if mark.kind !== 'turn'}
				{#if mark.state === 'selected'}
					<path class="brk" d={brackets(mark.box)} />
				{/if}
				{#if mark.label !== '' && showLabels}
					<g class="tag" transform={`translate(${mark.tagAt[0]} ${mark.tagAt[1]})`}>
						<rect x={-tagWidth(mark.label) / 2} y="-9" width={tagWidth(mark.label)} height="18" rx="5" />
						<text y="4" text-anchor="middle">{mark.label}</text>
					</g>
				{/if}
				{#if mark.number !== null}
					<g class="number badge" transform={`translate(${mark.numberAt[0]} ${mark.numberAt[1]})`}>
						<circle r="7" />
						<text text-anchor="middle" y="3.3">{mark.number}</text>
					</g>
				{/if}
			{/if}
		</g>
	{/each}
	{/if}
	{#if placement !== null}
		<g class="mark selected placement-ghost" data-view-placement-ghost aria-hidden="true">
			{#if placement.camera}
				{@render detailedCamera(placement.camera, true)}
			{:else}
				{#if placement.wedge}
					<path class="frustum selected" d={wedgePath(placement.wedge)} data-placement-wedge />
				{/if}
				<circle class="dot" cx={placement.eye[0]} cy={placement.eye[1]} r={dotRadius('selected')} />
			{/if}
		</g>
	{/if}
</svg>

<style>
	.experience-marks {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}

	.placement-ghost { opacity: 0.85; pointer-events: none; }

	/* Plan wedges: quiet, on the tour, and the selected View's full cone. */
	.frustum {
		fill: color-mix(in srgb, var(--shell-ink, #1b201c) 6%, transparent);
		stroke: color-mix(in srgb, var(--shell-ink, #1b201c) 28%, transparent);
		stroke-width: 1;
		stroke-linejoin: round;
	}
	.frustum.strong {
		fill: color-mix(in srgb, var(--shell-leaf, #4f8f6c) 13%, transparent);
		stroke: var(--shell-leaf, #4f8f6c);
		stroke-opacity: 0.65;
	}
	.frustum.selected {
		fill: color-mix(in srgb, var(--shell-gold, #d4ad45) 20%, transparent);
		stroke: var(--shell-gold, #d4ad45);
		stroke-width: 1.4;
		stroke-opacity: 1;
	}
	.frustum.dim {
		opacity: 0.32;
	}

	/* Plan dot. */
	.dot {
		fill: #fff;
		stroke: var(--shell-ink, #1b201c);
		stroke-width: 1.4;
	}
	.mark.strong .dot {
		fill: var(--shell-leaf, #4f8f6c);
		stroke: #fff;
		stroke-width: 1.6;
	}
	.mark.selected .dot {
		fill: var(--shell-gold, #d4ad45);
		stroke: #fff;
		stroke-width: 2;
	}
	/* Review round 2: the selected View's wedge is its turn grip. */
	.turn-grip {
		fill: transparent;
		stroke: none;
		pointer-events: auto;
		cursor: var(--cursor-turn, crosshair);
	}
	.turn-wire {
		fill: none;
		stroke: transparent;
		stroke-width: 12;
		pointer-events: stroke;
		cursor: var(--cursor-turn, crosshair);
	}
	.mark.selected[data-mark-kind='eye'] .hit {
		cursor: var(--cursor-grab, grab);
	}

	/* The 3D Detailed camera: one ink outline over white faces. */
	.cam {
		filter: drop-shadow(0 1.2px 1.3px rgba(20, 24, 20, 0.32));
	}
	.face {
		stroke-width: 0.6;
		stroke-linejoin: round;
	}
	.face.light {
		fill: #fff;
		stroke: #fff;
	}
	.face.side {
		fill: #eceee9;
		stroke: #eceee9;
	}
	.face.barrel {
		fill: #e2e6df;
		stroke: #e2e6df;
	}
	.face.cap {
		fill: #2c332e;
		stroke: #2c332e;
	}
	.face.ink {
		fill: #1b201c;
		stroke: #1b201c;
	}
	.glass {
		fill: #557a72;
	}
	.glint {
		fill: #fff;
		opacity: 0.85;
	}
	.outline {
		fill: none;
		stroke: var(--shell-ink, #1b201c);
		stroke-opacity: 0.75;
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.mark.strong .face.light {
		fill: #f4faf6;
		stroke: #f4faf6;
	}
	.mark.strong .face.side {
		fill: #e2eee6;
		stroke: #e2eee6;
	}
	.mark.strong .outline {
		stroke: var(--shell-leaf, #4f8f6c);
		stroke-opacity: 1;
	}
	.mark.selected .face.light {
		fill: #fff8e6;
		stroke: #fff8e6;
	}
	.mark.selected .face.side {
		fill: #f6e7bd;
		stroke: #f6e7bd;
	}
	.mark.selected .outline {
		stroke: var(--shell-gold-ink, #74560c);
		stroke-opacity: 1;
	}
	.mark.selected .glass {
		fill: #6e8d7c;
	}
	.cam-shadow {
		fill: rgba(20, 24, 20, 0.16);
		filter: blur(1.4px);
	}
	.stem {
		stroke: var(--shell-ink, #1b201c);
		stroke-opacity: 0.55;
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.foot {
		fill: var(--shell-ink, #1b201c);
	}
	.wire {
		fill: none;
		stroke: color-mix(in srgb, var(--shell-ink, #1b201c) 45%, transparent);
		stroke-width: 1;
		stroke-linejoin: round;
	}
	.mark.strong .wire {
		stroke: var(--shell-leaf, #4f8f6c);
		stroke-width: 1.2;
	}
	.mark.selected .wire {
		stroke: var(--shell-gold, #d4ad45);
		stroke-width: 1.4;
	}

	/* Selection: gold corner brackets, never a box. */
	.brk {
		fill: none;
		stroke: var(--shell-gold, #d4ad45);
		stroke-width: 2;
		stroke-linecap: round;
	}

	/* Travel selected: the marks dim and pass clicks through to the route. */
	.mark.dim {
		opacity: 0.38;
	}
	.mark.travel .hit {
		pointer-events: none;
	}

	.hit {
		fill: transparent;
		pointer-events: auto;
		cursor: var(--cursor-select, default);
	}
	/* Mouse clicks never draw the browser ring (B8); keyboard focus gets a gold ring. */
	.hit:focus {
		outline: none;
	}
	.hit:focus-visible {
		outline: none;
		stroke: var(--shell-gold, #d4ad45);
		stroke-width: 2;
	}

	.tag rect {
		fill: var(--shell-forest, #11291f);
	}
	.tag text {
		fill: #fff;
		font: 500 11px var(--shell-sans, system-ui, sans-serif);
	}
	.number circle {
		fill: var(--shell-forest, #11291f);
	}
	.number text {
		fill: #fff;
		font: 600 9.5px var(--shell-sans, system-ui, sans-serif);
	}
	.mark.selected .number circle {
		fill: var(--shell-gold, #d4ad45);
	}
	.mark.selected .number text {
		fill: #2a2208;
	}

	.rig {
		pointer-events: none;
	}
	.rig line {
		stroke: var(--shell-gold, #d4ad45);
		stroke-width: 1.2;
		stroke-dasharray: 3 3;
		opacity: 0.85;
	}
	.rig-halo {
		fill: color-mix(in srgb, var(--shell-gold, #d4ad45) 22%, transparent);
		stroke: var(--shell-gold, #d4ad45);
		stroke-width: 1;
	}
	.rig-dot {
		fill: var(--shell-gold, #d4ad45);
		stroke: #2a2208;
		stroke-width: 1.2;
	}
	.rig text {
		fill: var(--shell-gold, #d4ad45);
		font: 600 9px var(--shell-mono, ui-monospace, monospace);
	}
</style>
