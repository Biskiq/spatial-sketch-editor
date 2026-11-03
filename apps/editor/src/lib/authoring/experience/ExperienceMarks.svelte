<script lang="ts">
	/**
	 * R217.S28 — Experience View marks on the Stage.
	 *
	 * Every point comes from `experience-mark-model`, which projects the authored
	 * Views through the current `ViewportEvaluation`. The overlay only paints:
	 * a single click selects a marker without moving the Camera, a double-click
	 * opens Look through, and Move/aim belongs to the Stage's one gesture lease.
	 */
	import { projectWorld, type ViewportEvaluation } from '@portfolio/camera-core';
	import { experienceMarkModel, EXPERIENCE_MARK_CAPS } from './experience-marks';
	import { experienceHomes } from './experience-homes';
	import ExperiencePaths from './ExperiencePaths.svelte';

	let {
		evaluation,
		/** R217.S30 — the projected, read-only playback rig; never an authored mark. */
		rig = null,
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
	const model = $derived.by(() => {
		const current = controller?.current ?? null;
		if (current === null) return { marks: [], frustums: [] };
		return experienceMarkModel({
			experience: current,
			guide: controller?.contextGuide ?? null,
			views: controller?.cameraViews ?? [],
			evaluation,
			selection: {
				presentationId: subject !== null && (subject.kind === 'presentation' || subject.kind === 'view') ? subject.presentationId : null,
				viewId: subject?.kind === 'view' ? subject.viewId : null,
				stopId: subject !== null && (subject.kind === 'stop' || subject.kind === 'transition') ? subject.stopId : null
			}
		});
	});
	const filtered = $derived.by(() => ({
		marks: selectionOnly ? model.marks.filter((mark) => mark.state === 'selected' || mark.state === 'strong') : model.marks,
		frustums: selectionOnly
			? model.frustums.filter((frustum) => frustum.state === 'selected' || frustum.state === 'strong')
			: model.frustums
	}));

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
</script>

<svg
	class="experience-marks"
	role="group"
	aria-label="View markers"
	data-experience-marks
	data-label-cap={EXPERIENCE_MARK_CAPS.labels}
	data-frustum-cap={EXPERIENCE_MARK_CAPS.frustums}
	focusable="false"
>
	{#if showFrustums}
	{#each filtered.frustums as frustum (frustum.viewId)}
		<polygon
			class="frustum {frustum.state}"
			points={`${frustum.eye[0]},${frustum.eye[1]} ${frustum.left[0]},${frustum.left[1]} ${frustum.right[0]},${frustum.right[1]}`}
			data-view-frustum={frustum.viewId}
		/>
	{/each}
	{/if}
	{#if showPaths}
		<ExperiencePaths
			{evaluation}
			{selectionOnly}
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
	{#each filtered.marks as mark (mark.id)}
		<g class="mark {mark.state}" data-view-mark={mark.viewId} data-mark-kind={mark.kind}>
			{#if mark.kind === 'eye'}
				<circle class="dot" cx={mark.css[0]} cy={mark.css[1]} r="3.4" />
			{:else if mark.kind === 'aim'}
				<circle class="handle" cx={mark.css[0]} cy={mark.css[1]} r="4.6" />
			{:else}
				<path
					class="glyph"
					d="M-7,-4.6 H-2.6 L0,-7 L2.6,-4.6 H7 V4.6 H-7 Z M-2.4,0.6 L-0.4,-1.8 L1.4,0 L2.6,-1.4 L4.2,0.8"
					transform={`translate(${mark.css[0]} ${mark.css[1]})`}
				/>
			{/if}
			<!-- 44 px coarse target: transparent, so the ink stays screen-small. -->
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
			{#if mark.label !== '' && showLabels}
				<g class="tag" transform={`translate(${mark.css[0] + 9} ${mark.css[1] - 18})`}>
					<rect width={Math.max(30, mark.label.length * 6.2 + 10)} height="16" rx="4" />
					<text x="5" y="11">{mark.label}</text>
				</g>
			{/if}
			{#if mark.number !== null}
				<g class="number" transform={`translate(${mark.css[0] - 15} ${mark.css[1] - 21})`}>
					<circle r="7" />
					<text text-anchor="middle" y="3.2">{mark.number}</text>
				</g>
			{/if}
		</g>
	{/each}
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
	.frustum {
		fill: color-mix(in srgb, var(--shell-leaf, #4f8f6c) 16%, transparent);
		stroke: var(--shell-leaf, #4f8f6c);
		stroke-width: 1;
		stroke-linejoin: round;
		opacity: 0.9;
	}
	.frustum.selected {
		fill: color-mix(in srgb, var(--shell-gold, #d4ad45) 18%, transparent);
		stroke: var(--shell-gold, #d4ad45);
	}
	.frustum.dim {
		opacity: 0.32;
	}
	.dot {
		fill: var(--shell-leaf, #4f8f6c);
		stroke: #fff;
		stroke-width: 1.2;
	}
	.handle {
		fill: #fff;
		stroke: var(--shell-leaf, #4f8f6c);
		stroke-width: 1.6;
	}
	.glyph {
		fill: #fff;
		stroke: var(--shell-leaf, #4f8f6c);
		stroke-width: 1.4;
		stroke-linejoin: round;
	}
	.mark.selected .dot,
	.mark.selected .handle {
		fill: var(--shell-gold, #d4ad45);
		stroke: var(--shell-gold-ink, #74560c);
	}
	.mark.selected .glyph {
		stroke: var(--shell-gold, #d4ad45);
	}
	.mark.dim {
		opacity: 0.38;
	}
	.mark.strong .dot {
		fill: var(--shell-forest-raised, #22503c);
	}
	.hit {
		fill: transparent;
		pointer-events: auto;
		cursor: pointer;
	}
	.tag rect {
		fill: var(--shell-value-surface, rgba(10, 24, 18, 0.82));
	}
	.tag text {
		fill: #fff;
		font: 10px var(--shell-mono, ui-monospace, monospace);
	}
	.number circle {
		fill: var(--shell-forest, #11291f);
	}
	.number text {
		fill: #fff;
		font: 600 9px var(--shell-mono, ui-monospace, monospace);
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
