<script lang="ts">
	/**
	 * X3 / decomposition contract S — the Stage toolbars region.
	 *
	 * The reading line, Experience's Show disclosure and the one lower column (the
	 * World toolbar, the armed instrument and the Experience dock/Guide) move
	 * here as one region. Each remains its own component and its own owner:
	 *
	 * - `StageDraftingControl` reads/writes the existing drafting preferences;
	 * - `WorldToolbar` still arms the existing dock/host controllers;
	 * - `StageInstrumentHost` still renders the facade's one task instrument;
	 * - `ExperienceDock`/`ExperienceGuide` still command the existing playback and
	 *   guide controller.
	 *
	 * The region owns only the lower-column measurement it reports, plus the Show
	 * popover's open flag. Every other value is a typed read or named command from
	 * the composition root.
	 */
	import type { ComponentProps } from 'svelte';
	import ExperienceDock from '$lib/authoring/experience/ExperienceDock.svelte';
	import ExperienceGuide from '$lib/authoring/experience/ExperienceGuide.svelte';
	import StageDraftingControl from './StageDraftingControl.svelte';
	import SkyControl from '$lib/authoring/world-toolbar/SkyControl.svelte';
	import StageInstrumentHost from './StageInstrumentHost.svelte';
	import WorldToolbar from '$lib/authoring/world-toolbar/WorldToolbar.svelte';
	import InkPlate from '$lib/authoring/world-toolbar/InkPlate.svelte';
	import ObjectsPlate from '$lib/authoring/world-toolbar/ObjectsPlate.svelte';

	type DraftingProps = ComponentProps<typeof StageDraftingControl>;
	type SkyProps = ComponentProps<typeof SkyControl>;
	type WorldProps = Omit<ComponentProps<typeof WorldToolbar>, 'plate'>;
	type InstrumentProps = ComponentProps<typeof StageInstrumentHost>;
	type DockProps = ComponentProps<typeof ExperienceDock>;
	type GuideProps = ComponentProps<typeof ExperienceGuide>;

	let {
		previewing,
		viewLine = null,
		show = null,
		world = null,
		instrument = null,
		experience = null,
		onLowerColumnHeight
	}: {
		readonly previewing: boolean;
		readonly viewLine?: {
			readonly drafting: DraftingProps;
			readonly sky: SkyProps | null;
		} | null;
		readonly show?: {
			readonly open: boolean;
			readonly mode: 'whole' | 'selection';
			readonly markers: boolean;
			readonly frustums: boolean;
			readonly paths: boolean;
			readonly labels: boolean;
			readonly offCount: number;
			readonly hidden: boolean;
			readonly onToggle: () => void;
			readonly onClose: () => void;
			readonly onMode: (mode: 'whole' | 'selection') => void;
			readonly onMarkers: (value: boolean) => void;
			readonly onFrustums: (value: boolean) => void;
			readonly onPaths: (value: boolean) => void;
			readonly onLabels: (value: boolean) => void;
			readonly onShowAll: () => void;
		} | null;
		readonly world?: (WorldProps & {
			readonly plateKind: 'ink' | 'objects' | null;
			readonly inkReading: 'wall' | 'opening';
			readonly onTogglePalette: () => void;
		}) | null;
		readonly instrument?: InstrumentProps | null;
		readonly experience?: {
			readonly dock: DockProps;
			readonly feedback: {
				readonly text: string;
				readonly kind: 'refusal' | 'info' | 'success' | null;
			} | null;
			readonly guide: GuideProps | null;
		} | null;
		readonly onLowerColumnHeight?: (height: number) => void;
	} = $props();

	let lowerColumn = $state<HTMLElement | null>(null);

	$effect(() => {
		const column = lowerColumn;
		if (column === null) {
			onLowerColumnHeight?.(0);
			return;
		}
		const measure = (height: number) => onLowerColumnHeight?.(height);
		measure(column.getBoundingClientRect().height);
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver((entries) => {
			measure(entries[0]?.contentRect.height ?? column.getBoundingClientRect().height);
		});
		observer.observe(column);
		return () => observer.disconnect();
	});

	function checked(event: Event): boolean {
		return (event.currentTarget as HTMLInputElement).checked;
	}

</script>

{#if viewLine !== null}
	<!--
		The old second line is restored: the reading grid and 2D/3D controls sit
		under the project Head, and the new Measure, Slice and Sky controls join
		that line rather than replacing it.
	-->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class="view-line"
		data-view-line
		onclick={(event) => event.stopPropagation()}
		onpointerdown={(event) => event.stopPropagation()}
	>
		<StageDraftingControl {...viewLine.drafting}>
			{#snippet sky()}
				{#if viewLine.sky !== null}
					{@const skyProps = viewLine.sky}
					<SkyControl {...skyProps} />
				{/if}
			{/snippet}
		</StageDraftingControl>
	</div>
{/if}

{#if show !== null && !previewing}
	<!-- R217.S29 Show ▾: session-only Stage drawing flags beside the reading control. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="stage-actions"
		style:display={show.hidden ? 'none' : undefined}
		onclick={(event) => event.stopPropagation()}
		onpointerdown={(event) => event.stopPropagation()}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="show-control"
			data-show-control
			onclick={(event) => event.stopPropagation()}
			onpointerdown={(event) => event.stopPropagation()}
		>
			<button
				type="button"
				class="show-button"
				aria-expanded={show.open}
				aria-haspopup="true"
				title="Show: what the Guide draws on the Stage"
				onclick={() => show.onToggle()}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-width="1.4"
					aria-hidden="true"
					><path d="M8 2 1.5 5.5 8 9l6.5-3.5z" /><path d="m1.5 8.5 6.5 3.5 6.5-3.5" /></svg
				>Show
				{#if show.offCount > 0}<span class="show-off" data-show-off>{show.offCount} off</span>{/if}
			</button>
			{#if show.open}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="show-popover"
					role="dialog"
					tabindex="-1"
					aria-label="Show on the Stage"
					onkeydown={(event) => {
						if (event.key !== 'Escape') return;
						event.stopPropagation();
						show.onClose();
					}}
				>
					<header><strong>Show</strong><span>editor only</span></header>
					<div class="show-mode" role="group" aria-label="Guide reading">
						<button
							type="button"
							aria-pressed={show.mode === 'whole'}
							onclick={() => show.onMode('whole')}>Whole Guide</button
						>
						<button
							type="button"
							aria-pressed={show.mode === 'selection'}
							onclick={() => show.onMode('selection')}>Selection only</button
						>
					</div>
					<label
						><input
							type="checkbox"
							checked={show.markers}
							onchange={(event) => show.onMarkers(checked(event))}
						/> Camera markers</label
					>
					<label
						><input
							type="checkbox"
							checked={show.frustums}
							onchange={(event) => show.onFrustums(checked(event))}
						/> View frustums</label
					>
					<label
						><input
							type="checkbox"
							checked={show.paths}
							onchange={(event) => show.onPaths(checked(event))}
						/> Camera paths</label
					>
					<label
						><input
							type="checkbox"
							checked={show.labels}
							onchange={(event) => show.onLabels(checked(event))}
						/> View labels</label
					>
					<button type="button" class="show-all" onclick={() => show.onShowAll()}>Show all</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!--
	PLATE's one lower column: the dock, the armed tool's palette (the invoked
	Instrument) and nothing else. A contributed tool appears here because its
	entry declares `home: 'dock'`; the shell owns no domain slot of its own.
-->
<div
	class="lower-column"
	hidden={previewing}
	inert={previewing}
	data-lower-column
	bind:this={lowerColumn}
>
	{#if world !== null}
		<WorldToolbar {...world}>
			{#snippet plate()}
				{#if world.plateKind === 'ink'}
					<InkPlate reading={world.inkReading} onMore={() => world.onTogglePalette()} />
				{:else if world.plateKind === 'objects'}
					<ObjectsPlate onOpen={world.onObjectPick} />
				{/if}
			{/snippet}
		</WorldToolbar>
		{#if instrument !== null}
			<StageInstrumentHost {...instrument} />
		{/if}
	{/if}
	{#if experience !== null}
		<!-- Column order is bottom-up: the dock, its feedback line, then the Guide instrument above them. -->
		<ExperienceDock {...experience.dock} />
		{#if experience.feedback !== null}
			<p
				class="experience-feedback"
				class:refused={experience.feedback.kind === 'refusal'}
				class:info={experience.feedback.kind === 'info'}
				class:success={experience.feedback.kind === 'success'}
				role="status"
			>
				{experience.feedback.text}
			</p>
		{/if}
		{#if experience.guide !== null && experience.guide.playback}
			<ExperienceGuide {...experience.guide} />
		{/if}
	{/if}
</div>

<style>
	/*
		PLATE's one lower working edge: the dock, the armed tool's palette and nothing
		else, centred on the Stage. The column itself is a layout, not a surface — the
		Stage stays pointer-driven around it, and only the dock and the instrument take
		input — so it never turns the lower strip into a control bar.
	*/
	/*
		R217.S23 — the lower column never enters the Height Sheet's lane on either side. The
		lane is the Sheet's measured width (S22); the 1.5 rem is the Stage inset plus the gap the
		zoom cluster and the Card already keep. The dock is centred in what remains, and the
		palette and its upward disclosures wrap inside that width rather than overlap the Sheet.
	*/
	.lower-column {
		position: absolute;
		inset-inline-start: calc(12px + var(--index-cover, 0px));
		inset-inline-end: 12px;
		bottom: 10px;
		z-index: 11;
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 0.4rem;
		pointer-events: none;
	}
	.lower-column > :global(.world-toolbar) {
		align-self: center;
	}
	.lower-column > :global(*) {
		pointer-events: auto;
	}
	.lower-column[hidden] {
		display: none;
	}
	/* The old second line, with the new tools beside it rather than replacing it. */
	.view-line {
		position: absolute;
		top: 10px;
		left: calc(10px + var(--index-cover, 0px));
		z-index: 8;
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 6px;
		max-width: calc(100% - 20px - var(--index-cover, 0px));
	}
	.view-line > :global(*) {
		pointer-events: auto;
	}
	/* Experience's Show control sits below the restored reading line. */
	.stage-actions {
		position: absolute;
		top: 54px;
		left: calc(10px + var(--index-cover, 0px));
		z-index: 6;
		display: flex;
		gap: 0.4rem;
	}
	/* R217.S29 Show ▾: a light disclosure beside the Stage reading control. */
	.show-control {
		position: relative;
		display: flex;
		align-items: center;
		padding: 3px;
		border: 1px solid var(--shell-hairline);
		border-radius: 10px;
		background: var(--shell-glass-light);
		box-shadow: var(--shell-furniture-shadow);
		backdrop-filter: blur(10px);
	}
	.show-button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 10px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--shell-ink);
		font: inherit;
		font-size: 12.5px;
		cursor: pointer;
	}
	.show-button:hover {
		background: rgb(27 32 28 / 0.06);
	}
	.show-button[aria-expanded='true'] {
		background: var(--shell-action);
		color: var(--shell-on-action);
	}
	.show-button:focus-visible,
	.show-mode button:focus-visible,
	.show-all:focus-visible {
		outline: var(--shell-focus-ring-light);
		outline-offset: 1px;
	}
	.show-off {
		padding: 0 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--shell-gold) 28%, transparent);
		color: var(--shell-gold-ink);
		font-size: 11px;
		font-weight: 600;
	}
	.show-popover {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		z-index: 8;
		width: 268px;
		display: grid;
		gap: 6px;
		padding: 12px;
		border: 1px solid var(--shell-hairline);
		border-radius: 14px;
		background: var(--shell-popover);
		color: var(--shell-ink);
		box-shadow: var(--shell-shadow);
		font-size: 12.5px;
	}
	.show-popover header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 2px;
	}
	.show-popover header strong {
		font-size: 13.5px;
	}
	.show-popover header span {
		color: var(--shell-ink-3);
		font-size: 11.5px;
	}
	.show-mode {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 3px;
		padding: 3px;
		border-radius: 10px;
		background: var(--shell-surface-sunken);
	}
	.show-mode button {
		height: 28px;
		border: 0;
		border-radius: 8px;
		background: none;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.show-mode button[aria-pressed='true'] {
		background: var(--shell-field-focus);
		color: var(--shell-ink);
		font-weight: 600;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
	}
	.show-popover label {
		display: flex;
		align-items: center;
		gap: 9px;
		min-height: 30px;
		padding: 0 2px;
		border-radius: 8px;
		cursor: pointer;
	}
	.show-popover label:hover {
		background: var(--shell-hover);
	}
	.show-popover input[type='checkbox'] {
		appearance: none;
		-webkit-appearance: none;
		flex: none;
		width: 18px;
		height: 18px;
		margin: 0;
		border: 1.5px solid var(--shell-field-line-strong);
		border-radius: 5px;
		background: var(--shell-field);
		cursor: pointer;
	}
	.show-popover input[type='checkbox']:checked {
		border-color: var(--shell-leaf);
		background: var(--shell-leaf)
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-7' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
			center / 14px no-repeat;
	}
	.show-popover input[type='checkbox']:focus-visible {
		outline: var(--shell-focus-ring-light);
		outline-offset: 2px;
	}
	.show-all {
		height: 28px;
		margin-top: 2px;
		border: 1px solid var(--shell-field-line);
		border-radius: 8px;
		background: var(--shell-field);
		color: inherit;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	/* R217.S25: the Experience dock's feedback line sits on the lower edge, above its dock. */
	.experience-feedback {
		max-width: min(30rem, 100%);
		margin: 0;
		padding: 0.25rem 0.6rem;
		border-radius: 8px;
		background: var(--shell-dock-surface);
		color: var(--shell-ink-light);
		font-size: 0.78rem;
		line-height: 1.35;
	}
	/* Kind decides the styling, never the words: a success is never a refusal. */
	.experience-feedback.success {
		background: var(--shell-forest-raised);
	}
	.experience-feedback.info {
		background: var(--shell-forest-3);
	}
	.experience-feedback.refused {
		background: color-mix(in srgb, var(--shell-refuse) 70%, var(--shell-forest));
	}
</style>
