<script lang="ts">
	/**
	 * X3 / decomposition contract S — the Stage viewport region.
	 *
	 * The route used to own this whole DOM region: the one Stage Canvas, the
	 * overlay layer, the Height Sheet slot, the Look Through capture frame, the
	 * Welcome note, the hanging/resize artwork overlays and the isolated Preview
	 * takeover. They move here as one cohesive region, but none of them becomes a
	 * second owner:
	 *
	 * - `StageCanvas` remains the one persistent renderer;
	 * - `StageOverlay` and `ExperienceMarks` remain their own projection painters;
	 * - `StageHeightSheet` remains the session-only Height Sheet authority's view;
	 * - the Preview surface stays mounted-but-hidden between runs, as before.
	 *
	 * The region owns no world state. It receives grouped typed reads and named
	 * commands from the composition root, and its local state is only the lane
	 * measurement and the homes host's ephemeral controller slot.
	 */
	import type { Component, ComponentProps } from 'svelte';
	import ArtworkHangingGuides from '$lib/authoring/artwork/ArtworkHangingGuides.svelte';
	import ArtworkResizeOverlay from '$lib/authoring/artwork/ArtworkResizeOverlay.svelte';
	import ExperienceHomesHost from '$lib/authoring/experience/ExperienceHomesHost.svelte';
	import ExperienceMarks from '$lib/authoring/experience/ExperienceMarks.svelte';
	import StageCanvas from './StageCanvas.svelte';
	import StageHeightSheet from './StageHeightSheet.svelte';
	import StageOverlay from './StageOverlay.svelte';
	import StageScaleBar from './StageScaleBar.svelte';
	import type { ExperienceController } from '$lib/authoring/experience/experience-controller.svelte';
	import type { StageAdapterServices } from '../stage-adapter-host';
	import type { ProjectEnvelope } from '@portfolio/project-model/units';

	type CanvasProps = ComponentProps<typeof StageCanvas>;
	type OverlayProps = ComponentProps<typeof StageOverlay>;
	type MarksProps = ComponentProps<typeof ExperienceMarks>;
	type HeightSheetProps = ComponentProps<typeof StageHeightSheet>;
	type HangingProps = ComponentProps<typeof ArtworkHangingGuides>;
	type ResizeProps = ComponentProps<typeof ArtworkResizeOverlay>;

	let {
		previewing,
		canvas = null,
		overlay,
		experienceMarks = null,
		viewEditTurn = null,
		scaleBar = null,
		heightSheet = null,
		lookThrough = null,
		pendingViewWrite = null,
		welcome = false,
		hanging = null,
		artwork = null,
		notice = '',
		preview = null,
		previewLoading = false,
		stageCursor = null,
		paperVisible = false,
		homes = null,
		input,
		onLaneWidth,
		onDismissWelcome,
		onExperienceController,
		onActivateDisclosure,
		onResolvePendingViewWrite,
		onCancelPendingViewWrite,
		styleCursor = null,
		stageElement = $bindable(undefined),
		throughFrameElement = $bindable(undefined)
	}: {
		readonly previewing: boolean;
		readonly canvas?: CanvasProps | null;
		readonly overlay: OverlayProps;
		readonly experienceMarks?: MarksProps | null;
		readonly viewEditTurn?: {
			readonly arc: string;
			readonly label: string;
			readonly labelAt: readonly [number, number];
		} | null;
		readonly scaleBar?: {
			readonly bar: { readonly meters: number; readonly cssPx: number } | null;
			readonly quiet: boolean;
		} | null;
		readonly heightSheet?: HeightSheetProps | null;
		readonly lookThrough?: {
			readonly label: string;
			readonly moved: boolean;
			readonly confirm: readonly string[] | null;
			readonly canUpdate: boolean;
			onUpdate: () => void;
			onExit: () => void;
			onCapture: () => void;
			onClearConfirm: () => void;
		} | null;
		readonly pendingViewWrite?: { readonly alsoIn: readonly string[] } | null;
		readonly welcome?: boolean;
		readonly hanging?: HangingProps | null;
		readonly artwork?: ResizeProps | null;
		readonly notice?: string;
		readonly preview?: {
			// The Preview controller hands back the visitor's dynamic surface; its
			// props are built by the route and are intentionally opaque here.
			readonly surface: any;
			readonly props: Record<string, unknown>;
			readonly active: boolean;
		} | null;
		readonly previewLoading?: boolean;
		readonly stageCursor?: string | null;
		readonly styleCursor?: string | null;
		readonly paperVisible?: boolean;
		readonly homes?: {
			readonly services: StageAdapterServices;
			readonly snapshot: ProjectEnvelope;
		} | null;
		readonly input: {
			readonly pointerDown: (event: PointerEvent) => void;
			readonly pointerMove: (event: PointerEvent) => void;
			readonly pointerUp: (event: PointerEvent) => void;
			readonly pointerCancel: (event: PointerEvent) => void;
			readonly lostPointerCapture: (event: PointerEvent) => void;
			readonly click: (event: MouseEvent) => void;
			readonly wheel: (event: WheelEvent) => void;
			readonly pointerLeave: () => void;
			readonly dragOver: (event: DragEvent) => void;
			readonly drop: (event: DragEvent) => void;
			readonly contextMenu: (event: MouseEvent) => void;
		};
		readonly onLaneWidth?: (width: number) => void;
		readonly onDismissWelcome?: () => void;
		readonly onExperienceController?: (controller: ExperienceController | null) => void;
		readonly onActivateDisclosure?: (id: string) => void;
		readonly onResolvePendingViewWrite?: () => void;
		readonly onCancelPendingViewWrite?: () => void;
		stageElement?: HTMLElement;
		throughFrameElement?: HTMLElement;
	} = $props();

	let homesController = $state.raw<ExperienceController | null>(null);
	let laneElement = $state<HTMLElement | null>(null);

	$effect(() => {
		onExperienceController?.(
			previewing || homes === null ? null : homesController
		);
	});

	$effect(() => {
		const lane = laneElement;
		if (lane === null) {
			onLaneWidth?.(0);
			return;
		}
		const measure = () => onLaneWidth?.(lane.getBoundingClientRect().width);
		measure();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(lane);
		return () => observer.disconnect();
	});

</script>

<div class="stage-frame">
	{#if !previewing}
		<!--
			The Stage surface is a pointer-driven viewport, not a widget: it handles
			click (selection through eligible Plan fragments) and wheel (zoom), while
			keyboard viewing intents are handled once by the host's own window listener
			(3/2/f/arrows/Escape) so a focused element handler cannot double-apply them.
		-->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
		<div
			class="stage"
			bind:this={stageElement}
			role="application"
			tabindex="0"
			data-paper={paperVisible ? 'true' : 'false'}
			data-cursor={stageCursor}
			style:cursor={styleCursor ?? undefined}
			aria-label="Spatial stage"
			onpointerleave={() => input.pointerLeave()}
			ondragover={(event) => input.dragOver(event)}
			ondrop={(event) => input.drop(event)}
			onpointerdown={(event) => input.pointerDown(event)}
			onpointermove={(event) => input.pointerMove(event)}
			onpointerup={(event) => input.pointerUp(event)}
			onpointercancel={(event) => input.pointerCancel(event)}
			onlostpointercapture={(event) => input.lostPointerCapture(event)}
			onclick={(event) => input.click(event)}
			onwheel={(event) => input.wheel(event)}
			oncontextmenu={(event) => input.contextMenu(event)}
		>
			{#if canvas !== null}
				<StageCanvas {...canvas} />
			{/if}
			<div class="overlay-layer">
				{#if lookThrough === null}
					<StageOverlay
						{...overlay}
						onActivateDisclosure={(id) => onActivateDisclosure?.(id)}
					/>
				{/if}
				{#if experienceMarks !== null && lookThrough === null}
					<ExperienceMarks {...experienceMarks} />
				{/if}
				{#if viewEditTurn !== null}
					<!-- Review round 3 (sheet §23): the View itself turns live and ExperienceMarks
					     draws the start-pose ghost; this layer adds only the arc and the angle. -->
					<svg class="view-edit-preview" data-view-edit-turn aria-hidden="true">
						<path class="turn-arc" d={viewEditTurn.arc} />
						<text
							class="turn-angle"
							x={viewEditTurn.labelAt[0]}
							y={viewEditTurn.labelAt[1]}
							text-anchor="middle"
							dominant-baseline="middle">{viewEditTurn.label}</text
						>
					</svg>
				{/if}
			</div>
			<!--
				The measured ruler is a Plan-only reading of the same evaluation. It
				hides as soon as the projection leaves Plan, not only once 3D settles,
				so it cannot float over a transition. World-lens chrome, like the Sheet.
			-->
			{#if scaleBar !== null}
				<StageScaleBar bar={scaleBar.bar} quiet={scaleBar.quiet} />
			{/if}

			{#if heightSheet !== null}
				<!--
					PLATE's Height Sheet in S02's right-edge slot. It is world-lens chrome:
					the control and its plane are hidden in Experience and return with the
					session height on the way back. The slot is a transparent wrapper: the
					Sheet places its own lane on the Stage, so it is not clipped by a box of
					the slot's own.
				-->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="stage-height-slot"
					onclick={(event) => event.stopPropagation()}
					onpointerdown={(event) => event.stopPropagation()}
				>
					<StageHeightSheet {...heightSheet} bind:laneRef={laneElement} />
				</div>
			{/if}

			{#if lookThrough !== null}
				<!-- The capture frame sits beside the Card and above the Guide; helpers are hidden. -->
				<div class="through-slot" bind:this={throughFrameElement} data-through-frame>
					<div class="through-frame" aria-hidden="true"></div>
					<div class="through-safe" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
				</div>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="mode-pill through-pill"
					data-look-through-pill
					onclick={(event) => event.stopPropagation()}
					onpointerdown={(event) => event.stopPropagation()}
				>
					<span class="live-dot" aria-hidden="true"></span>
					<span>Looking through <b>{lookThrough.label}</b></span>
					{#if lookThrough.moved}<span class="moved">moved</span>{/if}
					<button
						type="button"
						class="pill-primary"
						disabled={!lookThrough.moved || !lookThrough.canUpdate}
						title={lookThrough.moved
							? 'Write the provisional pose back to this View'
							: 'Adjust the camera or lens first'}
						onclick={() => lookThrough.onUpdate()}>Update View</button
					>
					<button type="button" onclick={() => lookThrough.onExit()}>Exit View Esc</button>
					<button
						type="button"
						title="Capture this provisional pose as a new View"
						onclick={() => lookThrough.onCapture()}>Capture</button
					>
				</div>
				{#if lookThrough.confirm !== null}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="through-confirm"
						role="alertdialog"
						tabindex="-1"
						aria-label="Update a shared View"
						onclick={(event) => event.stopPropagation()}
						onpointerdown={(event) => event.stopPropagation()}
					>
						<p>Also changes {lookThrough.confirm.join(', ')}.</p>
						<div class="through-confirm-actions">
							<button
								type="button"
								class="pill-primary"
								onclick={() => lookThrough.onUpdate()}>Update View</button
							>
							<button type="button" onclick={() => lookThrough.onClearConfirm()}>Cancel</button>
						</div>
					</div>
				{/if}
			{/if}
			{#if pendingViewWrite !== null}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="through-confirm"
					role="alertdialog"
					tabindex="-1"
					aria-label="Update a shared View"
					onclick={(event) => event.stopPropagation()}
					onpointerdown={(event) => event.stopPropagation()}
				>
					<p>Also changes {pendingViewWrite.alsoIn.join(', ')}.</p>
					<div class="through-confirm-actions">
						<button
							type="button"
							class="pill-primary"
							onclick={() => onResolvePendingViewWrite?.()}>Update View</button
						>
						<button type="button" onclick={() => onCancelPendingViewWrite?.()}>Cancel</button>
					</div>
				</div>
			{/if}
			{#if welcome}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<aside
					class="experience-welcome"
					aria-label="Welcome to Experience"
					onpointerdown={(event) => event.stopPropagation()}
					onclick={(event) => event.stopPropagation()}
				>
					<span>Welcome to Experience</span>
					<h2>Turn this World into a visit</h2>
					<ol>
						<li><b>Present an object.</b> Select it, then choose <em>Present this</em> in its Card.</li>
						<li><b>Capture</b> keeps what the Stage shows as a View.</li>
						<li><b>Open a Guide</b> to put Stops in order, then press Play.</li>
					</ol>
					<footer>
						<small>Tips again: ⌘K → Show Experience tips</small>
						<button type="button" onclick={() => onDismissWelcome?.()}>Got it</button>
					</footer>
				</aside>
			{/if}
			{#if hanging !== null}
				<ArtworkHangingGuides {...hanging} />
			{/if}
			{#if artwork !== null}
				<ArtworkResizeOverlay {...artwork} />
			{/if}
			{#if notice !== ''}
				<p class="stage-note" role="status">{notice}</p>
			{/if}

			{#if homes !== null}
				<!-- The shared homes' controller: it renders nothing; the Index, Card and lower edge read it. -->
				{#key homes.services}
					<ExperienceHomesHost
						services={homes.services}
						snapshot={homes.snapshot}
						bind:controller={homesController}
					/>
				{/key}
			{/if}
		</div>
	{/if}
	{#if preview !== null}
		{@const Surface = preview.surface}
		<!--
			The Preview takeover replaces the Stage rather than sitting on top of
			a live one: the authoring canvas is unmounted, so no inspection claim,
			gesture or overlay survives into the isolated visitor run.

			Once built, the visitor surface stays mounted and is hidden between
			sessions. Cleanup was never the ownership protocol: the Camera claim ends
			with the return, while keeping the renderer and scene alive turns a repeat
			entry into a new run instead of a rebuild. A hidden surface renders no
			frames (`on-demand` while inactive) and is inert, so it cannot take input.
		-->
		<div
			class="preview-takeover"
			role="region"
			aria-label="Visitor preview"
			hidden={!preview.active}
			inert={!preview.active}
		>
			<Surface {...preview.props} />
		</div>
	{:else if previewLoading}
		<p class="stage-note" role="status">Loading the visitor Preview…</p>
	{/if}
	{#if previewing}
		<p class="stage-note preview-actions-note" role="status">
			Project rename and delete are unavailable in Preview. Exit Preview to manage this project.
		</p>
	{/if}
</div>

<style>
	.stage-frame {
		position: absolute;
		inset: 0;
	}
	.stage {
		position: absolute;
		inset: 0;
		/* The mat is the Stage's default surface; Paper's vellum is drawn in the Canvas. */
		background: #152c26;
		outline: none;
		touch-action: none;
		cursor: var(--cursor-select);
	}
	.stage[data-cursor='turn'] {
		cursor: var(--cursor-turn);
	}
	.stage[data-cursor='grabbing'] {
		cursor: var(--cursor-grabbing);
	}
	.stage[data-cursor='look'] {
		cursor: var(--cursor-look);
	}
	.stage[data-cursor='place-view'] {
		cursor: var(--cursor-place-view);
	}
	.stage[data-cursor='draw'] {
		cursor: var(--cursor-draw);
	}
	/*
		PLATE's 1 CSS px inset perimeter separates Paper from the chassis. It is an
		inset shadow, not a border: the canvas rectangle, Camera aspect and pointer
		mapping stay unchanged, and it intercepts no picking.
	*/
	.stage[data-paper='true'] {
		box-shadow: inset 0 0 0 1px var(--stage-paper-edge);
	}
	.stage:focus-visible {
		box-shadow: inset 0 0 0 1px var(--shell-leaf);
	}
	.stage :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.overlay-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.stage-height-slot {
		display: contents;
	}
	.view-edit-preview {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
	.view-edit-preview .turn-arc {
		fill: none;
		stroke: var(--shell-gold-ink);
		stroke-width: 1.2;
		stroke-dasharray: 3 3;
	}
	.view-edit-preview .turn-angle {
		fill: var(--shell-gold-ink);
		font: 600 11px var(--shell-sans);
		paint-order: stroke;
		stroke: var(--shell-focus-halo);
		stroke-width: 3px;
	}
	/* Look through fills the Stage: a gold edge and 16:10 safe-frame ticks. */
	.through-slot {
		position: absolute;
		inset: 0;
		z-index: 2;
		container-type: size;
		pointer-events: none;
	}
	.through-frame {
		position: absolute;
		inset: 0;
		box-shadow: inset 0 0 0 3px var(--shell-gold);
	}
	.through-safe {
		position: absolute;
		left: 50%;
		top: 50%;
		width: min(100cqw - 48px, (100cqh - 24px) * 1.6);
		aspect-ratio: 16 / 10;
		transform: translate(-50%, -50%);
	}
	.through-safe i {
		position: absolute;
		width: 22px;
		height: 22px;
		border: 0 solid var(--shell-ink-light);
		filter: drop-shadow(0 0 1px rgb(0 0 0 / 0.6));
	}
	.through-safe i:nth-child(1) {
		left: 0;
		top: 0;
		border-width: 2px 0 0 2px;
	}
	.through-safe i:nth-child(2) {
		right: 0;
		top: 0;
		border-width: 2px 2px 0 0;
	}
	.through-safe i:nth-child(3) {
		left: 0;
		bottom: 0;
		border-width: 0 0 2px 2px;
	}
	.through-safe i:nth-child(4) {
		right: 0;
		bottom: 0;
		border-width: 0 2px 2px 0;
	}
	.mode-pill {
		position: absolute;
		left: 50%;
		top: 0.75rem;
		z-index: 6;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 4px 4px 12px;
		border-radius: 20px;
		background: var(--shell-glass-dark);
		color: var(--shell-ink-light);
		font-size: 12px;
		box-shadow: 0 8px 20px rgb(0 0 0 / 0.28);
	}
	.mode-pill button {
		height: 28px;
		padding: 0 11px;
		border: 0;
		border-radius: 14px;
		background: var(--shell-on-forest-wash-strong);
		color: inherit;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.mode-pill button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.mode-pill button.pill-primary {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
		font-weight: 600;
	}
	.mode-pill .live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--shell-leaf-soft);
	}
	.mode-pill .moved {
		color: var(--shell-leaf-soft);
		font-weight: 600;
	}
	/* Center Look through in the part of the Stage that the Index leaves visible. */
	.mode-pill.through-pill {
		--through-index-cover: var(--index-cover, 0px);
		left: calc((100% + var(--through-index-cover)) / 2);
		width: max-content;
		max-width: calc(100% - var(--through-index-cover) - 1.5rem);
		flex-wrap: wrap;
		justify-content: center;
	}
	@media (width <= 1100px) {
		.editor-body[data-index-open='true'] .through-pill {
			--through-index-cover: min(var(--shell-index-width), 256px, 80%);
		}
	}
	@media (width <= 440px) {
		.editor-body[data-index-open='true'] .through-pill {
			/* The narrow Index leaves too little room beside it for the controls. */
			--through-index-cover: 0px;
			z-index: 21;
		}
	}
	.through-confirm {
		position: absolute;
		left: 50%;
		top: 3.4rem;
		z-index: 7;
		transform: translateX(-50%);
		width: min(22rem, calc(100% - 2rem));
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--shell-popup-dark);
		color: var(--shell-ink-light);
		box-shadow: 0 10px 28px rgb(0 0 0 / 0.35);
		font-size: 12px;
	}
	.through-confirm p {
		margin: 0 0 8px;
	}
	.through-confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
	}
	.through-confirm button {
		height: 28px;
		padding: 0 10px;
		border: 0;
		border-radius: 7px;
		background: var(--shell-on-forest-wash-strong);
		color: inherit;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.through-confirm button.pill-primary {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
		font-weight: 600;
	}
	.experience-welcome {
		position: absolute;
		left: calc(1rem + var(--index-cover, 0px));
		bottom: 4.75rem;
		width: min(18rem, calc(100% - 2rem));
		padding: 1rem;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 12px;
		background: var(--shell-surface-raised);
		box-shadow: var(--shell-shadow);
		color: var(--shell-ink);
		font-size: 0.8rem;
	}
	.experience-welcome > span {
		color: var(--shell-ink-3);
		font-size: var(--shell-text-meta);
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.experience-welcome h2 {
		margin: 0.25rem 0 0.6rem;
		font: 600 var(--shell-text-title) / 1.25 var(--shell-sans);
	}
	.experience-welcome ol {
		margin: 0 0 0.75rem;
		padding-left: 1.1rem;
	}
	.experience-welcome li + li {
		margin-top: 0.35rem;
	}
	.experience-welcome footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.experience-welcome button {
		flex: none;
		padding: 0.35rem 0.65rem;
		border: 0;
		border-radius: 6px;
		background: var(--shell-action);
		color: var(--shell-on-action);
		cursor: pointer;
	}
	@media (pointer: coarse) {
		.mode-pill button,
		.through-confirm button {
			min-width: 44px;
			min-height: 44px;
		}
	}
	.preview-takeover {
		position: absolute;
		inset: 0;
		z-index: 20;
		background: #050508;
	}
	.stage-note {
		position: absolute;
		left: 1rem;
		bottom: 6rem;
		/* A notice is information, never a control surface: it must not swallow a
		   click meant for a panel or a button underneath it. */
		pointer-events: none;
		max-width: min(28rem, calc(100% - 2rem));
		margin: 0;
		padding: 0.4rem 0.6rem;
		border-radius: 0.35rem;
		background: var(--shell-popup-dark);
		color: var(--shell-ink-light);
	}
	.preview-actions-note {
		top: 0.5rem;
		bottom: auto;
		color: var(--shell-leaf-soft);
	}
	@media (max-width: 720px) {
		/* Below the centered lens panel in a narrow shell, so the notice never
		   overlaps its buttons. */
		.stage-note {
			bottom: 0.5rem;
		}
	}
</style>
