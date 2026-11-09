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
	import { onMount } from 'svelte';
	import { projectWorld, type ViewportEvaluation } from '@portfolio/camera-core';
	import {
		experienceMarkModel,
		relatedToSelection,
		projectPlacementGhost,
		type PlacementGhostPose,
		type ExperienceCameraGlyph,
		EXPERIENCE_MARK_CAPS,
		PLAN_SELECTED_SCALE,
		type ExperienceCameraFrustum,
		type ExperienceFrustum,
		type StageBox,
		type StagePoint
	} from './experience-marks';
	import StageSticker from '../stage/shell/StageSticker.svelte';
	import { viewEditTag, type AuthoredViewPose, type ViewEditKind } from './experience-view-edit';
	import { experienceHomes } from './experience-homes';
	import ExperiencePaths from './ExperiencePaths.svelte';

	let {
		evaluation,
		/** R217.S30 — the projected, read-only playback rig; never an authored mark. */
		rig = null,
		placementGhost = null,
		liveEdit = null,
		advanced = false,
		datum = 0,
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
		rig?: { readonly eye: readonly [number, number, number]; readonly target: readonly [number, number, number]; readonly fov: number } | null;
		placementGhost?: PlacementGhostPose | null;
		/**
		 * Review round 3 (sheet §23): a live marker drag. Its View draws at the provisional
		 * pose, and a dashed ghost stays at the start pose until release.
		 */
		advanced?: boolean;
		datum?: number;
		liveEdit?: {
			readonly viewId: string;
			readonly kind: ViewEditKind;
			readonly handleId: string;
			readonly pointer: StagePoint;
			readonly fov: number;
			readonly start: { readonly eye: readonly [number, number, number]; readonly target: readonly [number, number, number]; readonly fov: number };
			readonly eye: readonly [number, number, number];
			readonly target: readonly [number, number, number];
			readonly moved: boolean;
		} | null;
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
		datum,
		selection,
		livePose: liveEdit?.moved ? { viewId: liveEdit.viewId, eye: [...liveEdit.eye], target: [...liveEdit.target], fov: liveEdit.fov } : null
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

	/** The start pose of a live marker drag, drawn as a dashed ghost (sheet §23). */
	const editGhost = $derived.by(() => {
		if (liveEdit === null || !liveEdit.moved) return null;
		const start = projectPlacementGhost(evaluation, {
			eye: [...liveEdit.start.eye],
			target: [...liveEdit.start.target],
			fovYDegrees: liveEdit.start.fov
		});
		if (start === null) return null;
		let distance: { readonly from: StagePoint; readonly to: StagePoint; readonly label: string } | null = null;
		if (liveEdit.kind === 'move' && !advanced) {
			const now = projectWorld(liveEdit.eye, evaluation, evaluation.token);
			const metres = Math.hypot(liveEdit.eye[0] - liveEdit.start.eye[0], liveEdit.eye[2] - liveEdit.start.eye[2]);
			if (now.kind === 'projected' && metres >= 0.01) {
				distance = {
					from: start.eye,
					to: [now.css[0] - evaluation.rect.left, now.css[1] - evaluation.rect.top],
					label: `${metres.toFixed(2)} m`
				};
			}
		}
		return { ...start, distance };
	});

	/**
	 * R217.S30 playback rig, review round 3: the same camera and frustum a View draws
	 * (3D Detailed camera, or the Plan camera and wedge), read-only and never authored.
	 */
	const rigGlyph = $derived(rig === null
		? null
		: projectPlacementGhost(evaluation, { eye: [...rig.eye], target: [...rig.target], fovYDegrees: rig.fov }));

	type AdvancedHandle = {
		id: string;
		kind: ViewEditKind;
		at: StagePoint;
		glyph: 'move' | 'curved' | 'hex' | 'two' | 'corner';
		angle?: number;
		stem?: StagePoint;
		apex?: StagePoint;
		side?: -1 | 1;
	};
	const selectedId = $derived(selection.viewId);
	const pose = $derived.by((): AuthoredViewPose | null => {
		if (selectedId === null) return null;
		if (liveEdit?.viewId === selectedId) return { eye: [...liveEdit.eye], target: [...liveEdit.target], fov: liveEdit.fov };
		return controller?.viewPose(selectedId) ?? null;
	});
	let hovered = $state<string | null>(null);
	let coarse = $state(false);
	onMount(() => {
		if (typeof window.matchMedia !== 'function') return;
		const query = window.matchMedia('(any-pointer: coarse)');
		const update = () => { coarse = query.matches; };
		update();
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	});
	const hitRadius = $derived(coarse ? 22 : 14);
	const handleOffset = $derived(hitRadius * 2 + 6);
	const advancedHandles = $derived.by((): AdvancedHandle[] => {
		if (!advanced || !showMarkers || pose === null) return [];
		const mark = filtered.marks.find(item => item.viewId === selectedId && item.kind !== 'turn');
		if (!mark) return [];
		const candidates: AdvancedHandle[] = [];
		if (plan) {
			const wedge = showFrustums ? filtered.frustums.find(item => item.viewId === selectedId) : undefined;
			if (wedge) candidates.push(
				{ id: 'lens-left', kind: 'lens', at: wedge.left, glyph: 'corner', apex: wedge.eye, side: -1 },
				{ id: 'lens-right', kind: 'lens', at: wedge.right, glyph: 'corner', apex: wedge.eye, side: 1 }
			);
		} else if (mark.camera) {
			const foot = mark.camera.floor;
			if (foot) {
				candidates.push({ id: 'move', kind: 'move', at: foot, glyph: 'move' });
				const floorAim = projectWorld([pose.target[0], datum, pose.target[2]], evaluation, evaluation.token);
				const direction = floorAim.kind === 'projected'
					? [floorAim.css[0] - evaluation.rect.left - foot[0], floorAim.css[1] - evaluation.rect.top - foot[1]]
					: [0, 0];
				const span = Math.hypot(direction[0], direction[1]);
				if (span > 1) candidates.push({
					id: 'turn', kind: 'turn', glyph: 'curved',
					at: [foot[0] - direction[0] * handleOffset / span, foot[1] - direction[1] * handleOffset / span],
					angle: Math.atan2(direction[1], direction[0]) * 180 / Math.PI - 90
				});
			}
			const top = projectWorld([pose.eye[0], pose.eye[1] + 1, pose.eye[2]], evaluation, evaluation.token);
			if (top.kind === 'projected') {
				const dx = top.css[0] - evaluation.rect.left - mark.css[0];
				const dy = top.css[1] - evaluation.rect.top - mark.css[1];
				const span = Math.hypot(dx, dy);
				if (span > 1) {
					// The height stem sits beside the camera so the knob clears its name.
					const axis: StagePoint = [dx / span, dy / span];
					const across: StagePoint = [-axis[1], axis[0]];
					const apex = mark.camera.frustum?.apex;
					const lensSide = apex && (apex[0] - mark.css[0]) * across[0] + (apex[1] - mark.css[1]) * across[1] > 0 ? -1 : 1;
					const offset = (hitRadius + 12) * lensSide;
					const stem: StagePoint = [mark.css[0] + offset * across[0], mark.css[1] + offset * across[1]];
					candidates.push({
						id: 'lift', kind: 'lift', glyph: 'hex', stem,
						at: [stem[0] + handleOffset * 0.7 * axis[0], stem[1] + handleOffset * 0.7 * axis[1]]
					});
				}
			}
			const wire = showFrustums ? mark.camera.frustum : null;
			if (wire) {
				const [left, right] = wire.corners;
				const topEdge: StagePoint = [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2];
				candidates.push({ id: 'tilt', kind: 'tilt', glyph: 'two', angle: 90, stem: topEdge,
					at: [topEdge[0], topEdge[1] - (hitRadius + 11)] });
				wire.corners.forEach((at, index) => candidates.push({
					id: `lens-${index}`, kind: 'lens', at, glyph: 'corner', side: index < 2 ? 1 : -1
				}));
			}
		}

		const admitted: AdvancedHandle[] = [];
		// Keep the held mark first as the provisional framing changes.
		const held = candidates.find(handle => handle.id === liveEdit?.handleId);
		for (const handle of held ? [held, ...candidates.filter(item => item !== held)] : candidates) {
			const [x, y] = handle.at;
			if (x < hitRadius || y < hitRadius || x > evaluation.rect.width - hitRadius || y > evaluation.rect.height - hitRadius) continue;
			if (admitted.some(other => Math.hypot(other.at[0] - x, other.at[1] - y) < hitRadius * 2)) continue;
			if (filtered.marks.some(other => other.kind !== 'turn' && other.viewId !== selectedId &&
				Math.hypot(other.css[0] - x, other.css[1] - y) < 22 + hitRadius)) continue;
			admitted.push(handle);
		}
		return admitted;
	});
	const advancedTag = $derived.by(() => {
		if (!advanced || pose === null) return null;
		if (liveEdit !== null && liveEdit.viewId !== selectedId) return null;
		if (liveEdit !== null) return {
			at: advancedHandles.find(handle => handle.id === liveEdit?.handleId)?.at ?? liveEdit.pointer,
			label: viewEditTag(liveEdit.kind, pose, datum, liveEdit.start)
		};
		const handle = advancedHandles.find(item => item.id === hovered);
		return handle ? { at: handle.at, label: viewEditTag(handle.kind, pose, datum) } : null;
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

	function planTransform(at: StagePoint, heading: number, state: string): string {
		const scale = state === 'selected' ? PLAN_SELECTED_SCALE : 1;
		return `translate(${at[0]} ${at[1]}) rotate(${heading}) scale(${scale})`;
	}
</script>

<!--
	Review round 3 (sheet §23): the Detailed camera seen from above. Local +x is where it
	looks and +y its shutter-button side. An outline layer under the fills draws one ink
	outline round the whole form; the lens front sits at PLAN_LENS_PX.
-->
{#snippet planCamera(at: StagePoint, heading: number, state: string)}
	<g class="plan-cam" transform={planTransform(at, heading, state)} data-plan-camera>
		<rect class="o" x="-9" y="-14" width="15" height="28" rx="2.5" />
		<rect class="o" x="6" y="-7" width="11" height="14" rx="1.2" />
		<rect class="body" x="-9" y="-14" width="15" height="28" rx="2.5" />
		<rect class="barrel" x="6" y="-7" width="11" height="14" rx="1.2" />
		<rect class="hump" x="-6.5" y="-5" width="10" height="10" rx="1.6" />
		<circle class="button" cx="-2.5" cy="9.6" r="2.1" />
		<rect class="lens-cap" x="15.2" y="-6" width="1.8" height="12" />
		<path class="rim" d="M17 -7V7" />
	</g>
{/snippet}

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
	{#if rigGlyph !== null}
		<g class="mark strong rig" data-camera-rig aria-hidden="true">
			{#if rigGlyph.camera}
				{@render detailedCamera(rigGlyph.camera, true)}
			{:else}
				{#if rigGlyph.wedge}
					<path class="frustum strong" d={wedgePath(rigGlyph.wedge)} data-rig-wedge />
				{/if}
				{#if rigGlyph.heading != null}
					{@render planCamera(rigGlyph.eye, rigGlyph.heading, 'strong')}
				{:else}
					<circle class="dot" cx={rigGlyph.eye[0]} cy={rigGlyph.eye[1]} r={dotRadius('strong')} />
				{/if}
			{/if}
		</g>
	{/if}
	{#if editGhost !== null}
		<g class="mark edit-ghost" class:advanced-ghost={advanced} data-view-edit-ghost aria-hidden="true">
			<g class="ghost-body">
			{#if editGhost.camera}
				{@render detailedCamera(editGhost.camera, showFrustums)}
			{:else}
				{#if showFrustums && editGhost.wedge}
					<path class="frustum" d={wedgePath(editGhost.wedge)} />
				{/if}
				{#if editGhost.heading != null}
					{@render planCamera(editGhost.eye, editGhost.heading, 'normal')}
				{:else}
					<circle class="dot" cx={editGhost.eye[0]} cy={editGhost.eye[1]} r={dotRadius('normal')} />
				{/if}
			{/if}
			</g>
			{#if editGhost.distance}
				{@const d = editGhost.distance}
				<line class="offset" x1={d.from[0]} y1={d.from[1]} x2={d.to[0]} y2={d.to[1]} />
				<g class="value" transform={`translate(${(d.from[0] + d.to[0]) / 2} ${(d.from[1] + d.to[1]) / 2 - 14})`}>
					<rect x={-tagWidth(d.label) / 2} y="-9" width={tagWidth(d.label)} height="18" rx="5" />
					<text y="4" text-anchor="middle">{d.label}</text>
				</g>
			{/if}
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
				{#if showFrustums && grip !== undefined}
					<path class="turn-grip" d={wedgePath(grip)} data-turn-grip>
						<title>Drag to turn this View</title>
					</path>
				{/if}
			{:else if mark.heading != null}
				{@render planCamera(mark.css, mark.heading, mark.state)}
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
	{#each advancedHandles as handle (handle.id)}
		<g class="advanced-handle" data-view-mark={selectedId} data-mark-kind={handle.kind}
			data-advanced-handle={handle.id} data-side={handle.side}
			data-apex-x={handle.apex ? handle.apex[0] + evaluation.rect.left : undefined}
			data-apex-y={handle.apex ? handle.apex[1] + evaluation.rect.top : undefined}
			aria-hidden="true">
			<!-- The Card supplies keyboard framing controls. These are pointer targets. -->
			<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
			<circle class="handle-hit" cx={handle.at[0]} cy={handle.at[1]} r={hitRadius}
				onpointerenter={() => hovered = handle.id}
				onpointerdown={() => hovered = null}
				onpointerleave={() => { if (hovered === handle.id) hovered = null; }}
				onclick={(event) => event.stopPropagation()}
				ondblclick={(event) => event.stopPropagation()} />
			<StageSticker kind={handle.glyph} at={handle.at} angle={handle.angle} stem={handle.stem}
				scale={handle.glyph === 'move' || handle.glyph === 'curved' ? 0.8 : 0.7}
				emphasised={liveEdit === null ? hovered === handle.id : liveEdit.handleId === handle.id}
				held={liveEdit?.handleId === handle.id} />
		</g>
	{/each}
	{#if advancedTag}
		{@const width = tagWidth(advancedTag.label) + 6}
		{@const x = Math.max(2, Math.min(advancedTag.at[0] + 15, evaluation.rect.width - width - 2))}
		{@const y = Math.max(2, Math.min(advancedTag.at[1] - 24, evaluation.rect.height - 22))}
		<g class="advanced-value" transform={`translate(${x} ${y})`} aria-hidden="true">
			<rect {width} height="20" rx="3" />
			<text x="6" y="13">{advancedTag.label}</text>
		</g>
	{/if}

	{#if placement !== null}
		<g class="mark selected placement-ghost" data-view-placement-ghost aria-hidden="true">
			{#if placement.camera}
				{@render detailedCamera(placement.camera, true)}
			{:else}
				{#if placement.wedge}
					<path class="frustum selected" d={wedgePath(placement.wedge)} data-placement-wedge />
				{/if}
				{#if placement.heading != null}
					{@render planCamera(placement.eye, placement.heading, 'selected')}
				{:else}
					<circle class="dot" cx={placement.eye[0]} cy={placement.eye[1]} r={dotRadius('selected')} />
				{/if}
			{/if}
		</g>
	{/if}
</svg>

<style>
	.handle-hit { fill: transparent; pointer-events: all; touch-action: none; }
	.advanced-handle[data-mark-kind='move'] { cursor: var(--cursor-move); }
	.advanced-handle[data-mark-kind='turn'] { cursor: var(--cursor-turn); }
	.advanced-handle[data-mark-kind='lift'],
	.advanced-handle[data-mark-kind='tilt'] { cursor: ns-resize; }
	.advanced-handle[data-mark-kind='lens'] { cursor: nwse-resize; }
	[data-stage-reading='plan'] .advanced-handle[data-mark-kind='lens'] { cursor: ew-resize; }
	.advanced-value { pointer-events: none; }
	.advanced-value rect { fill: var(--shell-ink); }
	.advanced-value text { fill: var(--shell-white); font: 11px var(--shell-mono); }

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
		fill: color-mix(in srgb, var(--shell-ink) 6%, transparent);
		stroke: color-mix(in srgb, var(--shell-ink) 28%, transparent);
		stroke-width: 1;
		stroke-linejoin: round;
	}
	.frustum.strong {
		fill: color-mix(in srgb, var(--shell-leaf) 13%, transparent);
		stroke: var(--shell-leaf);
		stroke-opacity: 0.65;
	}
	.frustum.selected {
		fill: color-mix(in srgb, var(--shell-gold) 20%, transparent);
		stroke: var(--shell-gold);
		stroke-width: 1.4;
		stroke-opacity: 1;
	}
	.frustum.dim {
		opacity: 0.32;
	}

	/* Plan dot. */
	.dot {
		fill: var(--shell-white);
		stroke: var(--shell-ink);
		stroke-width: 1.4;
	}
	.mark.strong .dot {
		fill: var(--shell-leaf);
		stroke: var(--shell-white);
		stroke-width: 1.6;
	}
	.mark.selected .dot {
		fill: var(--shell-gold);
		stroke: var(--shell-white);
		stroke-width: 2;
	}
	/* Review round 2: the selected View's wedge is its turn grip. */
	.turn-grip {
		fill: transparent;
		stroke: none;
		pointer-events: auto;
		cursor: var(--cursor-turn);
	}
	.turn-wire {
		fill: none;
		stroke: transparent;
		stroke-width: 12;
		pointer-events: stroke;
		cursor: var(--cursor-turn);
	}
	.mark.selected[data-mark-kind='eye'] .hit {
		cursor: var(--cursor-select);
	}

	:global(.stage[data-cursor='grabbing']) .mark.selected[data-mark-kind='eye'] .hit {
		cursor: var(--cursor-grabbing);
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
		fill: var(--shell-white);
		stroke: var(--shell-white);
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
		fill: var(--shell-ink);
		stroke: var(--shell-ink);
	}
	.glass {
		fill: #557a72;
	}
	.glint {
		fill: var(--shell-white);
		opacity: 0.85;
	}
	.outline {
		fill: none;
		stroke: var(--shell-ink);
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
		stroke: var(--shell-leaf);
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
		stroke: var(--shell-gold-ink);
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
		stroke: var(--shell-ink);
		stroke-opacity: 0.55;
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.foot {
		fill: var(--shell-ink);
	}
	.wire {
		fill: none;
		stroke: color-mix(in srgb, var(--shell-ink) 45%, transparent);
		stroke-width: 1;
		stroke-linejoin: round;
	}
	.mark.strong .wire {
		stroke: var(--shell-leaf);
		stroke-width: 1.2;
	}
	.mark.selected .wire {
		stroke: var(--shell-gold);
		stroke-width: 1.4;
	}

	/* Selection: gold corner brackets, never a box. */
	.brk {
		fill: none;
		stroke: var(--shell-gold);
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
		cursor: var(--cursor-select);
	}
	/* Mouse clicks never draw the browser ring (B8); keyboard focus gets a gold ring. */
	.hit:focus {
		outline: none;
	}
	.hit:focus-visible {
		outline: none;
		stroke: var(--shell-gold);
		stroke-width: 2;
	}

	.tag rect {
		fill: var(--shell-forest);
	}
	.tag text {
		fill: var(--shell-white);
		font: 500 11px var(--shell-sans);
	}
	.number circle {
		fill: var(--shell-forest);
	}
	.number text {
		fill: var(--shell-white);
		font: 600 9.5px var(--shell-sans);
	}
	.mark.selected .number circle {
		fill: var(--shell-gold);
	}
	.mark.selected .number text {
		fill: var(--shell-on-gold);
	}

	.rig {
		pointer-events: none;
	}

	/* Review round 3 (sheet §23): the Plan camera, in the 3D sticker finish and states. */
	.plan-cam { filter: drop-shadow(0 1.2px 1.3px rgba(20, 24, 20, 0.3)); }
	.plan-cam .o { fill: var(--shell-ink); stroke: var(--shell-ink); stroke-width: 2.4; stroke-linejoin: round; }
	.plan-cam .body { fill: var(--shell-white); }
	.plan-cam .barrel { fill: #e4e7e1; }
	.plan-cam .hump { fill: #eceee9; }
	.plan-cam .button,
	.plan-cam .lens-cap { fill: var(--shell-ink); }
	.plan-cam .rim { fill: none; stroke: none; stroke-width: 2.2; stroke-linecap: round; }
	.mark.strong .plan-cam .o { fill: var(--shell-forest-raised); stroke: var(--shell-forest-raised); }
	.mark.strong .plan-cam .body { fill: #f4faf6; }
	.mark.strong .plan-cam .barrel { fill: #d2e3d8; }
	.mark.strong .plan-cam .hump { fill: #e2eee6; }
	.mark.strong .plan-cam .rim { stroke: var(--shell-leaf); }
	.mark.selected .plan-cam .o { fill: var(--shell-gold-ink); stroke: var(--shell-gold-ink); }
	.mark.selected .plan-cam .body { fill: #fff8e6; }
	.mark.selected .plan-cam .barrel { fill: #ecd69a; }
	.mark.selected .plan-cam .hump { fill: #f6e7bd; }
	.mark.selected .plan-cam :is(.button, .lens-cap) { fill: var(--shell-gold-ink); }
	.mark.selected .plan-cam .rim { stroke: var(--shell-gold); }

	/* The start pose of a live drag: dashed, faint, never pressable. */
	.edit-ghost { pointer-events: none; }
	.edit-ghost .ghost-body { opacity: 0.6; }
	.edit-ghost .plan-cam { filter: none; }
	.edit-ghost .plan-cam .o { fill: rgb(255 255 255 / 0.4); stroke-width: 1.1; stroke-dasharray: 3 2.2; }
	.edit-ghost .plan-cam :is(.body, .barrel, .hump, .button, .lens-cap, .rim) { display: none; }
	.edit-ghost .frustum { fill: none; stroke-dasharray: 3 3; }
	.advanced-ghost .ghost-body { opacity: 1; }
	.advanced-ghost :is(.face, .glass, .glint, .cam-shadow, .foot, .stem) { display: none; }
	.advanced-ghost :is(.outline, .wire, .frustum, .plan-cam .o, .dot) {
		fill: none;
		stroke: var(--stage-proposal);
		stroke-opacity: 1;
		stroke-width: 1.3;
		stroke-dasharray: 4 3;
		filter: drop-shadow(0 0 .7px rgba(255,255,255,.95));
	}
	.edit-ghost .offset { stroke: var(--shell-gold-ink); stroke-width: 1.2; stroke-dasharray: 3 3; }
	.edit-ghost .value rect { fill: rgba(10, 24, 18, 0.82); }
	.edit-ghost .value text { fill: var(--shell-white); font: 500 10.5px var(--shell-sans); }
</style>
