<script lang="ts">
	/**
	 * R217.S29 — Camera paths on the Stage.
	 *
	 * Every point is projected through the one live `ViewportEvaluation`, and every
	 * route comes from `experience-paths.ts` (Camera's own motion samples). The
	 * overlay draws and selects: an armed click on a Plan path inserts one interior
	 * point at the nearest evaluated sample through the controller, a click on a
	 * point selects it, and Delete removes it. Paths appear only while the Guide is
	 * open; 3D reads them and only Plan inserts. The Stage keeps its arbitration.
	 */
	import { onDestroy } from 'svelte';
	import { projectWorld, type Vec3, type ViewportEvaluation } from '@portfolio/camera-core';
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
		onPlanePoint,
		beginLease,
		endLease
	}: {
		evaluation: ViewportEvaluation;
		selectionOnly?: boolean;
		/** The host's Camera ray/plane hit at a horizontal height, in world meters. */
		onPlanePoint?: (css: readonly [number, number], height: number) => Vec3 | null;
		/** The Stage gesture lease; a refused acquisition means no drag starts. */
		beginLease?: () => boolean;
		endLease?: () => void;
	} = $props();

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const guideOpen = $derived(homes.guideOpen());
	const plan = $derived(evaluation.projectionKind === 'plan-orthographic');
	const selected = $derived(controller?.selectedPath ?? null);
	const armed = $derived(controller?.pathArmed === true && plan);
	const selectedKey = $derived(selected === null ? null : occurrenceKey(selected.occurrence));
	type Drag = {
		readonly anchorId: string;
		readonly readKey: string;
		readonly connectionId: string | null;
		readonly pointerId: number;
		readonly height: number;
		readonly generation: number;
		readonly capture: Element;
		preview: Vec3;
		moved: boolean;
	};
	let drag = $state<Drag | null>(null);
	let suppressClick = false;
	const dragPreview = $derived.by(() => (drag === null ? null : project(drag.preview)));

	function project(point: Vec3): readonly [number, number] | null {
		const projected = projectWorld(point, evaluation, evaluation.token);
		if (projected.kind !== 'projected' || projected.visibility !== 'visible') return null;
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
		readonly points: readonly {
			readonly anchorId: string;
			readonly css: readonly [number, number];
			readonly position: Vec3;
		}[];
		readonly state: 'selected' | 'near' | 'faint';
	};

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
			const runs: (readonly [number, number])[][] = [];
			let run: [number, number][] = [];
			for (const sample of read.samples) {
				const point = project(sample);
				if (point === null) {
					if (run.length > 1) runs.push(run);
					run = [];
					continue;
				}
				run.push([point[0], point[1]]);
			}
			if (run.length > 1) runs.push(run);
			const points = read.anchors
				.map((anchor) => {
					const css = project(anchor.position);
					return css === null
						? null
						: { anchorId: anchor.id, css, position: anchor.position };
				})
				.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
			if (selectionOnly && key !== selectedKey) continue;
			const state =
				key === selectedKey
					? 'selected'
					: selected !== null &&
						  (selected.occurrence.stopId === occurrence.stopId ||
								selected.occurrence.kind === 'transition' && occurrence.toStopId === selected.occurrence.stopId)
						? 'near'
						: 'faint';
			result.push({ key, occurrence, read, runs, points, state });
		}
		return result;
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
			.filter((entry) => !selectionOnly || entry.key === selectedKey);
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

	function onPathClick(event: MouseEvent, read: ExperiencePathRead): void {
		if (!armed || controller === null || !isPathEditTarget(read, selected)) return;
		event.stopPropagation();
		const bounds = (event.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect();
		if (bounds === undefined) return;
		const nearest = nearestSample(read, [event.clientX - bounds.left, event.clientY - bounds.top]);
		// A path endpoint is not an insertion slot; only an interior hit inserts.
		if (nearest === null || nearest.index <= 0 || nearest.index >= read.samples.length - 1) return;
		void controller.addPathAnchor(nearest.sample);
	}

	function beginDrag(
		event: PointerEvent,
		point: { readonly anchorId: string; readonly position: Vec3 },
		read: ExperiencePathRead
	): void {
		if (!plan || !armed || controller === null || onPlanePoint === undefined || !isPathEditTarget(read, selected)) return;
		if (event.button !== 0 || drag !== null) return;
		if (beginLease !== undefined && !beginLease()) return;
		event.stopPropagation();
		const capture = event.currentTarget as Element | null;
		if (capture === null) return;
		try {
			capture.setPointerCapture(event.pointerId);
		} catch {
			endLease?.();
			return;
		}
		suppressClick = false;
		drag = {
			anchorId: point.anchorId,
			readKey: occurrenceKey(read.occurrence),
			connectionId: read.connectionId,
			pointerId: event.pointerId,
			height: point.position[1],
			generation: evaluation.token.evaluationGeneration,
			capture,
			preview: point.position,
			moved: false
		};
	}

	function moveDrag(event: PointerEvent): void {
		const active = drag;
		if (active === null || event.pointerId !== active.pointerId) return;
		if (evaluation.token.evaluationGeneration !== active.generation) {
			cancelDrag();
			return;
		}
		const world = onPlanePoint?.([event.clientX, event.clientY], active.height) ?? null;
		if (world === null) return;
		drag = { ...active, preview: world, moved: true };
	}

	async function endDrag(event: PointerEvent): Promise<void> {
		const active = drag;
		if (active === null || event.pointerId !== active.pointerId) return;
		const commit = active.moved && evaluation.token.evaluationGeneration === active.generation;
		const point = active.preview;
		drag = null;
		try {
			if (active.capture.hasPointerCapture(active.pointerId)) active.capture.releasePointerCapture(active.pointerId);
		} catch {
			// A lost capture is already cancelled; the lease still releases below.
		}
		endLease?.();
		if (!commit || controller === null) return;
		suppressClick = true;
		await controller.movePathAnchor(active.anchorId, point);
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
				!plan ||
				!armed ||
				key === null ||
				drag.readKey !== key ||
				drag.connectionId !== connectionId)
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

	function selectAnchor(anchorId: string): void {
		controller?.selectAnchor(anchorId);
	}

	function insertAtMiddle(event: KeyboardEvent, read: ExperiencePathRead): void {
		if (!armed || controller === null || !isPathEditTarget(read, selected)) return;
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		event.stopPropagation();
		const middle = read.samples[Math.floor(read.samples.length / 2)];
		if (middle !== undefined) void controller.addPathAnchor(middle);
	}
</script>

{#if guideOpen}
<g class="experience-paths" data-experience-paths>
	{#each drawn as path (path.key)}
		{#each path.runs as run, index (index)}
			<polyline
				class="route {path.state}"
				points={run.map((point) => `${point[0]},${point[1]}`).join(' ')}
				data-path={path.read.connectionId}
			/>
			{#if armed && isPathEditTarget(path.read, selected)}
				<polyline
					class="route-hit"
					data-path-target={path.read.connectionId}
					points={run.map((point) => `${point[0]},${point[1]}`).join(' ')}
					role="button"
					tabindex="0"
					aria-label="Add a path point"
					onclick={(event) => onPathClick(event, path.read)}
					onkeydown={(event) => insertAtMiddle(event, path.read)}
				/>
			{/if}
		{/each}
		{#each path.points as point (point.anchorId)}
			<circle
				class="anchor"
				class:selected={isPathEditTarget(path.read, selected) && controller?.selectedAnchorId === point.anchorId}
				cx={point.css[0]}
				cy={point.css[1]}
				r="3"
				data-path-anchor={point.anchorId}
			/>
			{#if isPathEditTarget(path.read, selected)}
			<circle
				class="anchor-hit"
				cx={point.css[0]}
				cy={point.css[1]}
				r="22"
				role="button"
				tabindex="0"
				aria-label="Path point"
				onpointerdown={(event) => beginDrag(event, point, path.read)}
				onpointermove={moveDrag}
				onpointerup={(event) => void endDrag(event)}
				onpointercancel={cancelDrag}
				onlostpointercapture={cancelDrag}
				onclick={(event) => {
					event.stopPropagation();
					if (suppressClick) {
						suppressClick = false;
						return;
					}
					selectAnchor(point.anchorId);
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
	{#if dragPreview !== null}
		<circle class="anchor selected preview" cx={dragPreview[0]} cy={dragPreview[1]} r="3.4" />
	{/if}
	{#each cuts as cut (cut.key)}
		<line class="cut" x1={cut.a[0]} y1={cut.a[1]} x2={cut.b[0]} y2={cut.b[1]} />
		<text class="cut-label" x={(cut.a[0] + cut.b[0]) / 2} y={(cut.a[1] + cut.b[1]) / 2 - 4}>CUT</text>
	{/each}
</g>
{/if}

<style>
	.experience-paths {
		pointer-events: none;
	}
	.route {
		fill: none;
		stroke: var(--shell-leaf, #4f8f6c);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.route.selected {
		stroke: var(--shell-gold, #d4ad45);
		stroke-width: 2.2;
	}
	.route.near {
		stroke: var(--shell-forest-raised, #22503c);
	}
	.route.faint {
		opacity: 0.3;
	}
	.route-hit {
		fill: none;
		stroke: transparent;
		stroke-width: 22;
		pointer-events: stroke;
		cursor: crosshair;
	}
	.anchor {
		fill: var(--shell-card, #fff);
		stroke: var(--shell-leaf, #4f8f6c);
		stroke-width: 1.6;
		pointer-events: none;
	}
	.anchor.selected {
		fill: var(--shell-gold, #d4ad45);
		stroke: var(--shell-gold-ink, #74560c);
	}
	.anchor-hit {
		fill: transparent;
		pointer-events: auto;
		cursor: pointer;
	}
	.preview {
		pointer-events: none;
	}
	.cut {
		stroke: var(--shell-ink-2, #4a524c);
		stroke-width: 1;
		stroke-dasharray: 3 4;
		opacity: 0.75;
	}
	.cut-label {
		fill: var(--shell-ink-3, #79817b);
		font: 500 9px var(--shell-mono, ui-monospace, monospace);
		text-anchor: middle;
		pointer-events: none;
	}
	@media (pointer: coarse) {
		.anchor-hit {
			r: 22;
		}
	}
</style>
