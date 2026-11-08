<script lang="ts">
	import { onDestroy } from 'svelte';
	import { projectWorld, type Vec3, type ViewportEvaluation, type ViewportEvaluationToken } from '@portfolio/camera-core';
	import { experienceHomes } from './experience-homes';
	import {
		experiencePathOccurrences,
		isPathEditTarget,
		occurrenceKey,
		type ExperiencePathRead,
		type ResolvedPathOccurrence
	} from './experience-paths';

	let {
		evaluation,
		selectionOnly = false,
		relatedPaths,
		onPlanePoint,
		beginLease,
		endLease
	}: {
		evaluation: ViewportEvaluation;
		selectionOnly?: boolean;
		relatedPaths?: ReadonlySet<string>;
		/** The host's Camera ray/plane hit at a horizontal height, in world meters. */
		onPlanePoint?: (css: readonly [number, number], height: number) => Vec3 | null;
		/** The Stage gesture lease; a refused acquisition means no drag starts. */
		beginLease?: () => boolean;
		endLease?: () => void;
	} = $props();

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const guideOpen = $derived(homes.guideOpen());
	const selected = $derived(controller?.selectedPath ?? null);
	// Experience review 1: the selected Travel's route is editable in both readings
	// without arming a tool; handles appear on selection.
	const armed = $derived(selected !== null && selected.state === 'ready');
	const selectedKey = $derived(selected === null ? null : occurrenceKey(selected.occurrence));
	type Drag = {
		readonly anchorId: string | null;
		readonly readKey: string;
		readonly connectionId: string | null;
		readonly pointerId: number;
		readonly height: number;
		readonly token: ViewportEvaluationToken;
		readonly projectionKind: ViewportEvaluation['projectionKind'];
		readonly start: readonly [number, number];
		readonly origin: Vec3;
		readonly planeStart: Vec3;
		readonly capture: Element;
		preview: Vec3;
		moved: boolean;
	};
	let drag = $state<Drag | null>(null);
	let suppressClick = false;
	let edited = $state(false);
	let hint = $state<readonly [number, number] | null>(null);
	let hoveredAnchor = $state<string | null>(null);
	const dragPreview = $derived.by(() => (drag?.moved ? project(drag.preview) : null));

	function project(point: Vec3): readonly [number, number] | null {
		const projected = projectWorld(point, evaluation, evaluation.token);
		// Screen ink: SVG clips at the frame, and depth clipping never hides a path (review round 3).
		if (projected.kind !== 'projected' || projected.visibility === 'behind') return null;
		return [
			Math.round((projected.css[0] - evaluation.rect.left) * 10) / 10,
			Math.round((projected.css[1] - evaluation.rect.top) * 10) / 10
		];
	}

	type Drawn = {
		readonly key: string;
		readonly occurrence: ResolvedPathOccurrence;
		readonly read: ExperiencePathRead;
		readonly runs: readonly (readonly (readonly [number, number])[])[];
		readonly hitRuns: Drawn['runs'];
		readonly points: readonly {
			readonly anchorId: string;
			readonly css: readonly [number, number];
			readonly position: Vec3;
		}[];
		readonly state: 'selected' | 'near' | 'faint';
		/** Direction chevrons along the route, every ~46 CSS px. */
		readonly chevrons: readonly { readonly x: number; readonly y: number; readonly angle: number }[];
	};

	function chevronsAlong(runs: readonly (readonly (readonly [number, number])[])[], spacing = 46) {
		const out: { x: number; y: number; angle: number }[] = [];
		for (const run of runs) {
			let carried = spacing * 0.5;
			for (let index = 1; index < run.length; index += 1) {
				const [ax, ay] = run[index - 1]!;
				const [bx, by] = run[index]!;
				const length = Math.hypot(bx - ax, by - ay);
				if (length === 0) continue;
				const angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
				let at = carried;
				while (at <= length) {
					const t = at / length;
					out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, angle });
					at += spacing;
				}
				carried = at - length;
			}
		}
		return out;
	}

	function projectRuns(samples: ExperiencePathRead['samples']): Drawn['runs'] {
		const runs: (readonly [number, number])[][] = [];
		let run: [number, number][] = [];
		for (const sample of samples) {
			const point = project(sample);
			if (point === null) {
				if (run.length > 1) runs.push(run);
				run = [];
				continue;
			}
			run.push([point[0], point[1]]);
		}
		if (run.length > 1) runs.push(run);
		return runs;
	}

	/** Paths of the open Guide's Travel moves, plus the one selected path. */
	const drawn = $derived.by((): readonly Drawn[] => {
		const current = controller?.current ?? null;
		if (current === null || !guideOpen) return [];
		const occurrences = experiencePathOccurrences(current, controller?.contextGuide ?? null).filter(
			(entry) => entry.transition === 'travel'
		);
		const result: Drawn[] = [];
		for (const occurrence of occurrences) {
			const key = occurrenceKey(occurrence.occurrence);
			const read = key === selectedKey ? selected : (controller?.pathFor?.(occurrence.occurrence) ?? null);
			if (read === null || read.state !== 'ready') continue;
			// A second occurrence of the same connection would leave its old curve behind.
			if (drag?.moved && key !== drag.readKey && read.connectionId === drag.connectionId) continue;
			const hitRuns = projectRuns(read.samples);
			const active = drag?.moved && drag.readKey === key ? drag : null;
			const samples = active === null ? null : controller?.previewPathDrag(active.anchorId, active.preview, active.origin);
			const runs = samples == null ? hitRuns : projectRuns(samples);
			const points = read.anchors
				.map((anchor) => {
					const css = project(anchor.position);
					return css === null
						? null
						: { anchorId: anchor.id, css, position: anchor.position };
				})
				.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
			if (selectionOnly && key !== selectedKey && !relatedPaths?.has(key)) continue;
			const state = key === selectedKey ? 'selected' : relatedPaths?.has(key) ? 'near' : 'faint';
			result.push({
				key,
				occurrence,
				read,
				runs,
				hitRuns,
				points,
				state,
				chevrons: chevronsAlong(runs)
			});
		}
		return result.sort((a, b) => Number(a.state === 'selected') - Number(b.state === 'selected'));
	});

	/** Cut transitions draw their dotted CUT link in the whole-Guide reading. */
	const cuts = $derived.by(() => {
		const current = controller?.current ?? null;
		if (current === null || !guideOpen) return [];
		const views = new Map(controller?.cameraViews.map((view) => [view.id, view]) ?? []);
		return experiencePathOccurrences(current, controller?.contextGuide ?? null)
			.filter((entry) => entry.transition === 'cut')
			.map((entry) => {
				const from = views.get(entry.fromViewId);
				const to = views.get(entry.toViewId);
				if (from === undefined || to === undefined) return null;
				const a = project(from.eye as Vec3);
				const b = project(to.eye as Vec3);
				if (a === null || b === null) return null;
				return { key: occurrenceKey(entry.occurrence), a, b };
			})
			.filter((entry): entry is NonNullable<typeof entry> => entry !== null)
			// Selection only shows the selected occurrence; unrelated Cuts fold.
			.filter((entry) => !selectionOnly || entry.key === selectedKey || relatedPaths?.has(entry.key));
	});

	function nearestSample(
		read: ExperiencePathRead,
		css: readonly [number, number]
	): { readonly sample: Vec3; readonly index: number } | null {
		let best: Vec3 | null = null;
		let bestIndex = -1;
		let distance = Number.POSITIVE_INFINITY;
		for (const [index, sample] of read.samples.entries()) {
			const projected = project(sample);
			if (projected === null) continue;
			const current = (projected[0] - css[0]) ** 2 + (projected[1] - css[1]) ** 2;
			if (current < distance) {
				distance = current;
				best = sample;
				bestIndex = index;
			}
		}
		return best === null ? null : { sample: best, index: bestIndex };
	}

	function interiorSample(event: MouseEvent, read: ExperiencePathRead): Vec3 | null {
		const nearest = nearestSample(read, [event.clientX - evaluation.rect.left, event.clientY - evaluation.rect.top]);
		if (nearest === null || nearest.index === 0 || nearest.index === read.samples.length - 1) return null;
		return nearest.sample;
	}

	function sameSource(active: Drag): boolean {
		const { token, projectionKind } = evaluation;
		return token.outputId === active.token.outputId &&
			token.sessionEpoch === active.token.sessionEpoch &&
			token.sourceRevision === active.token.sourceRevision &&
			projectionKind === active.projectionKind;
	}

	function beginDrag(
		event: PointerEvent,
		read: ExperiencePathRead,
		anchor?: { readonly anchorId: string; readonly position: Vec3 }
	): void {
		event.stopPropagation();
		if (event.button !== 0 || drag !== null) return;
		suppressClick = false;
		if (!armed || controller?.busy || !isPathEditTarget(read, selected) || onPlanePoint === undefined) return;
		const origin = anchor?.position ?? interiorSample(event, read);
		if (origin === null) return;
		const start = [event.clientX, event.clientY] as const;
		const planeStart = onPlanePoint(start, origin[1]);
		const capture = event.currentTarget as Element | null;
		if (capture === null || planeStart === null || (beginLease !== undefined && !beginLease())) return;
		try {
			capture.setPointerCapture(event.pointerId);
		} catch {
			endLease?.();
			return;
		}
		hint = null;
		drag = {
			anchorId: anchor?.anchorId ?? null,
			readKey: occurrenceKey(read.occurrence),
			connectionId: read.connectionId,
			pointerId: event.pointerId,
			height: origin[1],
			token: evaluation.token,
			projectionKind: evaluation.projectionKind,
			capture,
			start,
			origin,
			planeStart,
			preview: origin,
			moved: false
		};
	}

	function moveDrag(event: PointerEvent): void {
		const active = drag;
		if (active === null || event.pointerId !== active.pointerId) return;
		event.stopPropagation();
		if (!sameSource(active)) {
			cancelDrag();
			return;
		}
		if (!active.moved && Math.hypot(event.clientX - active.start[0], event.clientY - active.start[1]) < 4) return;
		const world = onPlanePoint?.([event.clientX, event.clientY], active.height) ?? null;
		if (world === null) return;
		const preview: Vec3 = active.anchorId === null ? world : [
			active.origin[0] + world[0] - active.planeStart[0],
			active.height,
			active.origin[2] + world[2] - active.planeStart[2]
		];
		drag = { ...active, preview, moved: true };
	}

	async function endDrag(event: PointerEvent): Promise<void> {
		if (drag === null || event.pointerId !== drag.pointerId) return;
		event.stopPropagation();
		moveDrag(event);
		const active = drag;
		cancelDrag();
		if (active === null || !active.moved || controller === null) return;
		suppressClick = true;
		const accepted = await (active.anchorId === null
			? controller.addPathAnchor(active.preview, undefined, active.origin)
			: controller.movePathAnchor(active.anchorId, active.preview));
		edited = edited || accepted;
	}

	async function addOnDoubleClick(event: MouseEvent, read: ExperiencePathRead): Promise<void> {
		event.stopPropagation();
		if (controller === null || suppressClick || !isPathEditTarget(read, selected)) return;
		const near = interiorSample(event, read);
		if (near === null) return;
		const point = onPlanePoint?.([event.clientX, event.clientY], near[1]) ?? near;
		const accepted = await controller.addPathAnchor(point, undefined, near);
		edited = edited || accepted;
	}

	function cancelDrag(): void {
		const active = drag;
		drag = null;
		// Nothing to release: never end a lease this overlay does not own.
		if (active === null) return;
		try {
			if (active.capture.hasPointerCapture(active.pointerId)) {
				active.capture.releasePointerCapture(active.pointerId);
			}
		} catch {
			// Capture is already gone.
		}
		endLease?.();
	}

	// Ownership changes, Guide close, lens/Show unmount and an accepted selection
	// change all cancel the press rather than leaving a captured stale writer.
	$effect(() => {
		const key = selectedKey;
		const connectionId = selected === null ? null : selected.connectionId;
		if (
			drag !== null &&
			(!guideOpen ||
				!armed ||
				key === null ||
				drag.readKey !== key ||
				drag.connectionId !== connectionId ||
				!sameSource(drag))
		) {
			cancelDrag();
		}
	});
	onDestroy(() => cancelDrag());

	$effect(() => {
		if (drag === null) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			event.stopPropagation();
			cancelDrag();
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	});

	// Overlapping hit targets still address the nearest authored point.
	function anchorAt(event: MouseEvent, points: Drawn['points']): Drawn['points'][number] {
		const x = event.clientX - evaluation.rect.left;
		const y = event.clientY - evaluation.rect.top;
		let nearest = points[0]!;
		let distance = Infinity;
		for (const point of points) {
			const next = (point.css[0] - x) ** 2 + (point.css[1] - y) ** 2;
			if (next >= distance) continue;
			distance = next;
			nearest = point;
		}
		return nearest;
	}

	function selectAnchor(anchorId: string): void {
		controller?.selectAnchor(anchorId);
	}

	function insertAtMiddle(event: KeyboardEvent, read: ExperiencePathRead): void {
		if (controller === null) return;
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		event.stopPropagation();
		const middle = read.samples[Math.floor(read.samples.length / 2)];
		if (!isPathEditTarget(read, selected)) {
			controller.selectPath(read.occurrence);
		} else if (middle !== undefined) {
			void controller.addPathAnchor(middle).then((accepted) => { edited = edited || accepted; });
		}
	}
</script>

{#if guideOpen}
<g class="experience-paths" class:dragging={drag?.moved} data-experience-paths>
	{#each drawn as path (path.key)}
		{#each path.runs as run, index (index)}
			<polyline class="ribbon {path.state}" points={run.map((point) => `${point[0]},${point[1]}`).join(' ')} />
			<polyline
				class="route {path.state}"
				points={run.map((point) => `${point[0]},${point[1]}`).join(' ')}
				data-path={path.read.connectionId}
			/>
		{/each}
		<!-- Keep the captured hit element mounted if the draft curve clips or changes runs. -->
		{#each path.hitRuns as run, index (index)}
			<polyline
				class="route-hit"
				class:edit={isPathEditTarget(path.read, selected)}
				data-path-target={path.read.connectionId}
				points={run.map((point) => `${point[0]},${point[1]}`).join(' ')}
				role="button"
				tabindex="0"
				aria-label={isPathEditTarget(path.read, selected) ? 'Add a path point' : 'Select this Travel'}
				onpointerdown={(event) => beginDrag(event, path.read)}
				onpointermove={(event) => {
					moveDrag(event);
					if (!edited && drag === null && isPathEditTarget(path.read, selected)) {
						hint = [event.clientX - evaluation.rect.left, event.clientY - evaluation.rect.top];
					}
				}}
				onpointerleave={() => (hint = null)}
				onpointerup={(event) => void endDrag(event)}
				onpointercancel={cancelDrag}
				onlostpointercapture={cancelDrag}
				onclick={(event) => {
					event.stopPropagation();
					if (!suppressClick && !isPathEditTarget(path.read, selected)) controller?.selectPath(path.read.occurrence);
				}}
				ondblclick={(event) => void addOnDoubleClick(event, path.read)}
				onkeydown={(event) => insertAtMiddle(event, path.read)}
			/>
		{/each}
		{#if path.runs[0] !== undefined && path.runs[0][0] !== undefined}
			<circle class="start-ring {path.state}" cx={path.runs[0][0][0]} cy={path.runs[0][0][1]} r="5" />
		{/if}
		{#each path.chevrons as chevron, index (index)}
			<path
				class="chevron {path.state}"
				d="M-3.5,-4 L2,0 L-3.5,4"
				transform={`translate(${chevron.x} ${chevron.y}) rotate(${chevron.angle})`}
			/>
		{/each}
		{#each path.points as point (point.anchorId)}
			<circle
				class="anchor"
				class:preview={drag?.readKey === path.key && drag.anchorId === point.anchorId && dragPreview !== null}
				class:selected={isPathEditTarget(path.read, selected) && controller?.selectedAnchorId === point.anchorId}
				cx={drag?.readKey === path.key && drag.anchorId === point.anchorId && dragPreview !== null ? dragPreview[0] : point.css[0]}
				cy={drag?.readKey === path.key && drag.anchorId === point.anchorId && dragPreview !== null ? dragPreview[1] : point.css[1]}
				r={isPathEditTarget(path.read, selected) &&
					(hoveredAnchor === point.anchorId || controller?.selectedAnchorId === point.anchorId) ? 6 : 3}
				data-path-anchor={point.anchorId}
			/>
			{#if isPathEditTarget(path.read, selected)}
			<circle
				class="anchor-hit"
				cx={point.css[0]}
				cy={point.css[1]}
				r="14"
				role="button"
				tabindex="0"
				aria-label="Path point"
				onpointerdown={(event) => beginDrag(event, path.read, anchorAt(event, path.points))}
				onpointerenter={(event) => { hoveredAnchor = anchorAt(event, path.points).anchorId; hint = null; }}
				onpointerleave={() => (hoveredAnchor = null)}
				onpointermove={(event) => {
					moveDrag(event);
					if (drag === null) hoveredAnchor = anchorAt(event, path.points).anchorId;
				}}
				onpointerup={(event) => void endDrag(event)}
				onpointercancel={cancelDrag}
				onlostpointercapture={cancelDrag}
				onclick={(event) => {
					event.stopPropagation();
					if (suppressClick) {
						suppressClick = false;
						return;
					}
					selectAnchor(anchorAt(event, path.points).anchorId);
				}}
				ondblclick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					if (!suppressClick) {
						void controller?.removePathAnchor(anchorAt(event, path.points).anchorId).then((accepted) => { edited = edited || accepted; });
					}
				}}
				onkeydown={(event) => {
					if (event.key !== 'Enter' && event.key !== ' ') return;
					event.preventDefault();
					event.stopPropagation();
					selectAnchor(point.anchorId);
				}}
			/>
			{/if}
		{/each}
	{/each}
	{#if hint !== null && !edited && drag === null}
		<g class="path-hint" transform={`translate(${Math.max(0, Math.min(hint[0] + 12, evaluation.rect.width - 216))} ${Math.max(0, hint[1] - 32)})`}>
			<rect width="213" height="24" rx="5" />
			<text x="8" y="16">Drag to bend · double-click to add a point</text>
		</g>
	{/if}
	{#if dragPreview !== null && drag?.anchorId === null}
		<circle class="anchor selected preview" cx={dragPreview[0]} cy={dragPreview[1]} r="6" />
	{/if}
	{#each cuts as cut (cut.key)}
		<line class="cut" class:faint={relatedPaths !== undefined && !relatedPaths.has(cut.key)} x1={cut.a[0]} y1={cut.a[1]} x2={cut.b[0]} y2={cut.b[1]}><title>Cut</title></line>
	{/each}
</g>
{/if}

<style>
	.experience-paths {
		pointer-events: none;
	}
	.ribbon {
		fill: none;
		stroke: color-mix(in srgb, var(--shell-leaf) 26%, transparent);
		stroke-width: 9;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.ribbon.selected {
		stroke: color-mix(in srgb, var(--shell-gold) 34%, transparent);
		stroke-width: 11;
	}
	.ribbon.faint,
	.chevron.faint,
	.cut.faint,
	.start-ring.faint {
		opacity: 0.3;
	}
	.chevron {
		fill: none;
		stroke: var(--shell-forest);
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.chevron.selected {
		stroke: var(--shell-gold-ink);
	}
	.start-ring {
		fill: var(--shell-white);
		stroke: var(--shell-leaf);
		stroke-width: 2;
	}
	.start-ring.selected {
		stroke: var(--shell-gold);
	}
	.path-hint rect { fill: var(--shell-forest); }
	.path-hint text { fill: white; font-size: 10px; }
	.route-hit:focus,
	.anchor-hit:focus {
		outline: none;
	}
	.route {
		fill: none;
		stroke: var(--shell-leaf);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.route.selected {
		stroke: var(--shell-gold);
		stroke-width: 2.2;
	}
	.route.near {
		stroke: var(--shell-forest-raised);
	}
	.route.faint {
		opacity: 0.3;
	}
	.route-hit {
		fill: none;
		stroke: transparent;
		stroke-width: 22;
		pointer-events: stroke;
		cursor: var(--cursor-select);
	}
	.route-hit.edit {
		cursor: var(--cursor-add-point);
	}
	.anchor {
		fill: var(--shell-card);
		stroke: var(--shell-leaf);
		stroke-width: 1.8;
		pointer-events: none;
	}
	.anchor.selected {
		fill: var(--shell-gold);
		stroke: var(--shell-gold-ink);
	}
	.anchor-hit {
		fill: transparent;
		pointer-events: auto;
		cursor: var(--cursor-select);
	}
	.dragging :is(.anchor-hit, .route-hit.edit) {
		cursor: var(--cursor-grabbing);
	}
	.preview {
		pointer-events: none;
	}
	.cut {
		stroke: var(--shell-ink-2);
		stroke-width: 1;
		stroke-dasharray: 3 4;
		opacity: 0.75;
	}
	@media (pointer: coarse) {
		.anchor-hit {
			r: 22;
		}
	}
</style>
