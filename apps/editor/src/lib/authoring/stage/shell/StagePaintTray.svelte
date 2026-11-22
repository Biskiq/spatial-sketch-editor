<script lang="ts">
	/**
	 * The armed Paint tool's tray (T2.S8 U2): one Colours / Materials tray with a
	 * reach control, a swatch row (favourites then recents), the dropper, a
	 * custom colour wheel and an expansion to the full palette or Finishes. It
	 * draws the pick and the consequence and owns no Finish state; every command
	 * goes back through the page to the Finish service and the painter.
	 *
	 * A circle is a colour (it keeps relief and sheen); a rounded square is a
	 * material (it replaces the whole Finish). A forest ring marks the pick on the
	 * tray, cobalt on the Stage marks what the next stroke will change. The layout
	 * follows the approved appearance prototype (prototypes/appearance-ux).
	 */
	import type { PaintSwatch, PaintTrayView } from '$lib/authoring/look/finish-authoring.svelte';
	import { PAINT_RADII, parseColourKey, type PaintColour, type PaintRadius } from '$lib/authoring/look/paint-pick';
	import type { PaintTrayState, PaintTrayTab } from '$lib/authoring/look/paint-tray-state.svelte';
	import type { StagePaintCandidate, StagePaintStroke } from '../stage-painter';
	import ShellIcon from './ShellIcon.svelte';
	import StagePaintWheel from './StagePaintWheel.svelte';

	let {
		tray,
		view,
		radius,
		candidate,
		stroke,
		onPick,
		onColour,
		onFavourite,
		onDropper,
		onRadius,
		onLibrary
	}: {
		tray: PaintTrayView;
		view: PaintTrayState;
		radius: PaintRadius;
		candidate: StagePaintCandidate | null;
		stroke: StagePaintStroke | null;
		onPick: (swatch: PaintSwatch) => void;
		onColour: (colour: PaintColour) => void;
		onFavourite: () => void;
		onDropper: () => void;
		onRadius: (radius: PaintRadius) => void;
		onLibrary: () => void;
	} = $props();

	const tab = $derived<PaintTrayTab>(tray.colourEnabled ? view.tab : 'materials');
	const row = $derived(tab === 'colours' ? tray.colours.row : tray.materials.row);
	const shape = $derived(tab === 'colours' ? 'colour' : 'material');
	const activeInTab = $derived(tray.active !== null && tray.active.kind === (tab === 'colours' ? 'colour' : 'finish'));

	const consequence = $derived.by(() => {
		if (stroke !== null && stroke.count > 0) {
			const noun = stroke.kind === 'surface' ? (stroke.count === 1 ? 'surface' : 'surfaces') : stroke.count === 1 ? 'object' : 'objects';
			return { text: `${stroke.count} ${noun} · release to paint`, refused: false };
		}
		if (tray.dropper) return { text: 'Click to sample a Finish', refused: false };
		if (tray.active === null) return { text: tab === 'colours' ? 'Choose a colour' : 'Choose a material', refused: false };
		if (candidate?.refusal) return { text: candidate.refusal, refused: true };
		if (candidate?.consequence) return { text: candidate.consequence, refused: false };
		return { text: 'Point at a surface or an object', refused: false };
	});

	function roving(event: KeyboardEvent): void {
		const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
		if (!keys.includes(event.key)) return;
		const options = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="option"]')];
		const index = options.indexOf(document.activeElement as HTMLButtonElement);
		if (index < 0) return;
		const next =
			event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : Math.min(options.length - 1, Math.max(0, index + (event.key === 'ArrowRight' ? 1 : -1)));
		options[next]?.focus();
		event.preventDefault();
		event.stopPropagation();
	}

	function tabIndex(swatch: PaintSwatch, index: number): number {
		const selected = row.findIndex((entry) => tray.active !== null && entry.key === tray.active.key && entry.kind === tray.active.kind);
		return (selected >= 0 ? selected : 0) === index ? 0 : -1;
	}

	// The pick leads the row only while it is not already one of the row's swatches.
	const leadVisible = $derived(
		activeInTab && tray.active !== null && !row.some((entry) => entry.key === tray.active?.key && entry.kind === tray.active.kind)
	);

	const wheelStart = $derived(
		tray.active?.kind === 'colour'
			? tray.active.color
			: tray.colours.palette[0]?.color ?? '#808080'
	);
</script>

<div class="tray" data-paint-tray aria-label="Paint" data-paint-tab={tab} data-expanded={view.expanded}>
	<div class="head">
		<span class="seg tabs" role="tablist" aria-label="Paint with">
			{#if tray.colourEnabled}
				<button type="button" role="tab" data-paint-tab-button="colours" aria-selected={tab === 'colours'} class:on={tab === 'colours'} onclick={() => view.setTab('colours')}>Colours</button>
			{:else}
				<!-- Colour paint is U3's colour-coat planner; the tab is decided and drawn, and inert until it lands. -->
				<button type="button" role="tab" class="future" data-paint-tab-button="colours" aria-selected="false" aria-disabled="true" title="Colour paint arrives with colour coats" onclick={(event) => event.preventDefault()}>Colours</button>
			{/if}
			<button type="button" role="tab" data-paint-tab-button="materials" aria-selected={tab === 'materials'} class:on={tab === 'materials'} onclick={() => view.setTab('materials')}>Materials</button>
		</span>
		<span class="consequence" class:refused={consequence.refused} data-paint-consequence role="status">{consequence.text}</span>
		<span class="seg radius" role="group" aria-label="Paint reach">
			<!-- Brush is a decided future radius inside Paint: drawn, inert, with no tool rows until it is built. -->
			<button type="button" class="future" data-paint-radius="brush" aria-disabled="true" title="Brush: paint part of a surface. Coming later" onclick={(event) => event.preventDefault()}>
				<ShellIcon name="paint" size={14} />
				Brush
			</button>
			{#each PAINT_RADII as option (option.id)}
				<button
					type="button"
					data-paint-radius={option.id}
					aria-pressed={radius === option.id}
					class:on={radius === option.id}
					title={option.hint}
					onclick={() => onRadius(option.id)}
				>
					<ShellIcon name={option.id === 'space' ? 'paintSpace' : 'paintSurface'} size={14} />
					{option.label}
				</button>
			{/each}
		</span>
		<button
			type="button"
			class="ib"
			data-paint-dropper
			aria-pressed={tray.dropper}
			aria-label="Sample"
			title="Sample a Finish from the Stage (I) · Alt-click does it without this button"
			onclick={onDropper}
		>
			<ShellIcon name="dropper" size={18} />
		</button>
	</div>

	<div class="body">
		<span class="strip" role="listbox" aria-label={tab === 'colours' ? 'Colours' : 'Materials'} onkeydown={roving} tabindex="-1">
			{#if leadVisible && tray.active !== null}
				<span class="swatch-button picked {shape}" style={`--swatch: ${tray.active.color}`} data-paint-lead title={`Picked · ${tray.active.label}`} role="img" aria-label={`Picked · ${tray.active.label}`}></span>
				<span class="lab">picked</span>
				<span class="sep"></span>
			{/if}
			{#each row as swatch, index (`${swatch.kind}:${swatch.key}`)}
				{@const picked = activeInTab && tray.active?.key === swatch.key}
				{#if !swatch.favourite && index > 0 && row[index - 1]?.favourite}
					<span class="sep"></span>
					<span class="lab">recent</span>
				{:else if !swatch.favourite && index === 0}
					<span class="lab">recent</span>
				{/if}
				<button
					type="button"
					role="option"
					class="swatch-button {shape}"
					class:picked
					style={`--swatch: ${swatch.color}`}
					aria-selected={picked}
					aria-label={`${swatch.label}${swatch.favourite ? ', favourite' : ''}`}
					title={swatch.label}
					tabindex={tabIndex(swatch, index)}
					data-paint-swatch={swatch.key}
					onclick={() => onPick(swatch)}
				></button>
			{/each}
			<span class="sep"></span>
			{#if tab === 'colours'}
				<button type="button" class="swatch-button colour dashed" data-paint-wheel-open aria-expanded={view.wheelOpen} title="Any colour: open the wheel" aria-label="Custom colour" onclick={() => view.setWheelOpen(!view.wheelOpen)}>
					<ShellIcon name="plus" size={16} />
				</button>
			{:else}
				<button type="button" class="pill" data-paint-library onclick={onLibrary}>
					<ShellIcon name="library" size={15} />
					Browse all
				</button>
			{/if}
			{#if tray.active !== null}
				<button
					type="button"
					class="star"
					class:on={tray.active.favourite}
					data-paint-favourite
					aria-pressed={tray.active.favourite}
					aria-label={tray.active.favourite ? 'Remove from favourites' : 'Add to favourites'}
					title={tray.active.favourite ? 'In favourites: click to remove' : 'Keep the current pick in favourites'}
					onclick={onFavourite}
				>
					<ShellIcon name="star" size={18} />
				</button>
			{/if}
		</span>
		<button
			type="button"
			class="ib"
			data-paint-expand
			aria-expanded={view.expanded}
			aria-label={view.expanded ? 'Show fewer' : 'Show more'}
			title={view.expanded ? 'Show fewer' : 'Show more'}
			onclick={() => view.toggleExpanded()}
		>
			<ShellIcon name={view.expanded ? 'chevronDown' : 'chevronUp'} size={16} />
		</button>
	</div>

	{#if view.expanded}
		<div class="more" data-paint-more>
			{#if tab === 'colours'}
				{#if tray.colours.palette.length > 0}
					<div class="group" role="group" aria-label="Project palette">
						<span class="heading">Project palette</span>
						<span class="grid">
							{#each tray.colours.palette as slot (slot.id)}
								<button
									type="button"
									class="swatch-button colour small"
									style={`--swatch: ${slot.color}`}
									title={slot.name}
									aria-label={slot.name}
									data-paint-palette-slot={slot.id}
									onclick={() => {
										const colour = parseColourKey(`slot:${slot.id}`);
										if (colour !== null) onColour(colour);
									}}
								></button>
							{/each}
						</span>
					</div>
				{/if}
				{#if view.wheelOpen}
					<StagePaintWheel
						initial={wheelStart}
						palette={tray.colours.palette}
						onUse={(colour) => {
							onColour(colour);
							view.setWheelOpen(false);
						}}
						onClose={() => view.setWheelOpen(false)}
					/>
				{/if}
				<p class="hint">Circles colour a surface and keep its relief and sheen · rounded squares replace the Finish.</p>
			{:else}
				{#if tray.materials.project.length > 0}
					<div class="group" role="group" aria-label="This project">
						<span class="heading">This project</span>
						<span class="grid">
							{#each tray.materials.project as swatch (swatch.key)}
								<button type="button" class="swatch-button material" class:picked={tray.active?.key === swatch.key} style={`--swatch: ${swatch.color}`} title={swatch.label} aria-label={swatch.label} data-paint-swatch={swatch.key} onclick={() => onPick(swatch)}></button>
							{/each}
						</span>
					</div>
				{/if}
				<div class="group" role="group" aria-label="Curated">
					<span class="heading">Curated</span>
					<span class="grid">
						{#each tray.materials.curated as swatch (swatch.key)}
							<button type="button" class="swatch-button material" class:picked={tray.active?.key === swatch.key} style={`--swatch: ${swatch.color}`} title={swatch.label} aria-label={swatch.label} data-paint-swatch={swatch.key} onclick={() => onPick(swatch)}></button>
						{/each}
					</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* A light instrument above the dock, the dock's own width: the approved
	   appearance prototype's tray. Swatch rings and the pill controls are its. */
	.tray {
		/* Centred over the dock: the same inset the lower column keeps from the index. */
		position: absolute;
		inset-inline: calc(12px + var(--index-cover, 0px)) 12px;
		bottom: calc(var(--lower-column-height, 0px) + 0.75rem);
		z-index: 13;
		box-sizing: border-box;
		display: flex;
		width: min(41rem, 100%);
		max-height: calc(100% - var(--lower-column-height, 0px) - 4rem);
		flex-direction: column;
		margin-inline: auto;
		padding: 8px 10px 10px;
		overflow: auto;
		border: 1px solid var(--shell-hairline);
		border-radius: var(--shell-instrument-radius);
		background: var(--shell-white);
		color: var(--shell-forest);
		box-shadow: 0 8px 24px rgb(18 38 29 / 16%);
		font-family: var(--shell-sans);
		font-size: var(--shell-text-control);
	}
	.head,
	.body {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.body {
		margin-top: 8px;
	}
	.seg {
		display: inline-flex;
		flex: none;
		gap: 2px;
		padding: 2px;
		border: 1px solid var(--shell-hairline);
		border-radius: 16px;
		background: var(--shell-white);
		box-shadow: 0 1px 2px rgb(18 38 29 / 6%);
	}
	.seg button {
		display: inline-flex;
		min-height: 0;
		align-items: center;
		gap: 4px;
		padding: 4px 12px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--shell-forest);
		font: inherit;
		font-size: 12.5px;
		line-height: 1.4;
		cursor: pointer;
	}
	.seg button:hover {
		background: var(--shell-leaf-tint);
	}
	.seg button.future,
	.seg button.future:hover {
		border: 1px dashed var(--shell-hairline-strong);
		background: transparent;
		color: var(--shell-ink-3);
		cursor: default;
	}
	.seg button.on,
	.seg button[aria-pressed='true'] {
		background: var(--shell-forest);
		color: var(--shell-white);
		box-shadow: 0 1px 3px rgb(18 38 29 / 30%);
	}
	.consequence {
		min-width: 0;
		flex: 1;
		overflow: hidden;
		padding: 0 4px;
		color: var(--shell-ink-3);
		font-size: var(--shell-text-utility);
		text-align: right;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.consequence.refused {
		color: var(--shell-refuse);
	}
	.strip {
		display: flex;
		min-width: 0;
		flex: 1;
		align-items: center;
		gap: 8px;
		padding: 4px 2px 6px 7px;
		overflow-x: auto;
		overflow-y: visible;
		scroll-padding-left: 7px;
		scrollbar-width: thin;
	}
	.sep {
		width: 1px;
		height: 30px;
		flex: none;
		margin: 0 2px;
		background: var(--shell-hairline);
	}
	.lab {
		flex: none;
		color: var(--shell-ink-3);
		font-family: var(--shell-mono);
		font-size: 9.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		transform: rotate(180deg);
		writing-mode: vertical-rl;
	}
	.swatch-button {
		position: relative;
		display: block;
		width: 40px;
		height: 40px;
		min-height: 0;
		flex: none;
		padding: 0;
		border: 0;
		background: var(--swatch);
		box-shadow: inset 0 0 0 1px rgb(18 38 29 / 16%);
		cursor: pointer;
		transition:
			box-shadow 0.12s,
			transform 0.12s;
	}
	.swatch-button.colour {
		border-radius: 50%;
	}
	.swatch-button.material {
		border-radius: 22%;
	}
	.swatch-button.small {
		width: 34px;
		height: 34px;
	}
	.swatch-button:hover {
		box-shadow:
			inset 0 0 0 1px rgb(18 38 29 / 16%),
			0 0 0 2px var(--shell-white),
			0 0 0 3.5px var(--shell-leaf);
	}
	.swatch-button.picked,
	.swatch-button[aria-selected='true'] {
		box-shadow:
			inset 0 0 0 1px rgb(18 38 29 / 16%),
			0 0 0 2px var(--shell-white),
			0 0 0 4px var(--shell-forest);
	}
	.swatch-button.dashed {
		display: grid;
		place-items: center;
		border: 1.5px dashed var(--shell-ink-3);
		background: transparent;
		box-shadow: none;
		color: var(--shell-ink-2);
	}
	.swatch-button:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--shell-leaf);
		outline-offset: 4px;
	}
	span.swatch-button {
		cursor: default;
	}
	.ib,
	.star {
		display: grid;
		width: 32px;
		height: 32px;
		min-height: 0;
		flex: none;
		padding: 0;
		place-items: center;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--shell-forest);
		cursor: pointer;
	}
	.ib:hover {
		background: var(--shell-leaf-tint);
	}
	.ib[aria-pressed='true'] {
		background: var(--shell-forest);
		color: var(--shell-white);
	}
	.ib[aria-expanded='true'] {
		background: var(--shell-leaf-tint);
	}
	.star {
		width: 30px;
		height: 30px;
		color: var(--shell-ink-3);
	}
	.star :global(svg) {
		fill: none;
	}
	.star:hover {
		background: var(--shell-index);
		color: var(--shell-gold-ink);
	}
	.star.on {
		color: var(--shell-gold);
	}
	.star.on :global(svg) {
		fill: var(--shell-gold);
		stroke: var(--shell-gold-ink);
	}
	.pill {
		display: inline-flex;
		min-height: 0;
		flex: none;
		align-items: center;
		gap: 6px;
		padding: 3px 9px;
		border: 1px solid var(--shell-hairline);
		border-radius: 999px;
		background: var(--shell-white);
		color: var(--shell-forest);
		font: inherit;
		font-size: var(--shell-text-utility);
		white-space: nowrap;
		cursor: pointer;
	}
	.pill:hover {
		border-color: var(--shell-leaf);
		background: var(--shell-leaf-tint);
	}
	.more {
		display: grid;
		gap: 10px;
		max-height: 16rem;
		margin-top: 6px;
		padding-top: 8px;
		overflow: auto;
		border-top: 1px solid var(--shell-hairline);
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.heading {
		color: var(--shell-ink-3);
		font-family: var(--shell-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 4px;
	}
	.hint {
		margin: 0;
		color: var(--shell-ink-3);
		font-size: var(--shell-text-utility);
	}
	@media (max-width: 700px) {
		.head {
			flex-wrap: wrap;
		}
		.consequence {
			order: 5;
			flex-basis: 100%;
			text-align: left;
		}
	}
	@media (pointer: coarse) {
		.tray {
			width: min(46rem, 100%);
		}
		.swatch-button {
			width: var(--shell-touch-target);
			height: var(--shell-touch-target);
		}
		.ib,
		.star {
			width: var(--shell-touch-target);
			height: var(--shell-touch-target);
		}
		.seg button,
		.pill {
			min-height: 40px;
		}
	}
</style>
