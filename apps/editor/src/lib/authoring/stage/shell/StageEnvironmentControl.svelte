<script lang="ts">
	import type { LookAuthoring } from '../../look/look-authoring.svelte';
	import SkyPanel from '../../environment/SkyPanel.svelte';
	import { medallionSVG } from '../../environment/sky-glyphs';
	import { WORLD_ENVIRONMENT_PRESENTATIONS } from '$lib/render/world-environment';
	import { hhmm, skyBodyAt } from '$lib/render/sky-time';
	import StagePopover from './StagePopover.svelte';
	import type { StagePanelRects } from './stage-panel-rects.svelte';

	let { look, rects, fading = false }: { look: LookAuthoring; rects: StagePanelRects; fading?: boolean } = $props();

	let control = $state<HTMLButtonElement | null>(null);
	const id = $props.id();
	const sky = $derived(look.shownSky);
	const name = $derived(WORLD_ENVIRONMENT_PRESENTATIONS[sky.preset].label);
	const body = $derived(skyBodyAt(sky.time, sky.heading, sky.arcHeight));
	const reading = $derived(sky.preset === 'studio' ? 'Even light'
		: `${hhmm(sky.time)} · ${body.body === 'none' ? 'No sun' : body.body === 'moon' ? 'Moon' : `Sun ${Math.round(body.el)}°`}`);
	const sheet = $derived((rects.stage?.width ?? Infinity) <= 860);
	const compact = $derived(sheet || (rects.stage && rects.dock &&
		rects.stage.right - 10 - 170 < rects.dock.right + 12));
	const bottom = $derived(rects.stage && rects.dock &&
		(sheet || rects.stage.right - 330 < rects.dock.right)
		? Math.max(68, rects.stage.bottom - rects.dock.top + 10) : 68);
	const maxHeight = $derived(Math.max(120, (rects.stage?.height ?? 640) - bottom - (sheet ? 62 : 184)));

	$effect(() => {
		const node = control;
		const stage = node?.closest<HTMLElement>('.editor-body');
		if (!stage) return;
		const dock = stage.querySelector<HTMLElement>('.world-toolbar');
		const measure = () => {
			rects.setStage(stage.getBoundingClientRect());
			rects.setDock(dock?.getBoundingClientRect() ?? null);
			rects.setFixed([node!, ...stage.querySelectorAll<HTMLElement>('[data-view-line], aside[aria-label="Selected subject"]')]
				.map((item) => item.getBoundingClientRect()).filter((item) => item.width > 0 && item.height > 0));
		};
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(stage);
		if (node) observer.observe(node);
		if (dock) observer.observe(dock);
		const cardObserver = new MutationObserver(() => {
			for (const card of stage.querySelectorAll<HTMLElement>('aside[aria-label="Selected subject"]')) observer.observe(card);
			measure();
		});
		cardObserver.observe(stage, { childList: true });
		return () => { observer.disconnect(); cardObserver.disconnect(); };

	});

	$effect(() => () => look.setPanelOpen(false));

	function escape(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !look.panelOpen || event.defaultPrevented) return;
		const owner = look.gesture.owner;
		if (owner?.startsWith('dial-')) return;
		if (owner === null && (!(event.target instanceof Node) ||
			(!control?.contains(event.target) && !document.getElementById(id)?.contains(event.target)))) return;
		const canceled = look.gesture.cancel();
		// Let the platform dismiss its native picker as well.
		if (!(event.target instanceof HTMLInputElement && event.target.type === 'color' && canceled)) event.preventDefault();
		event.stopImmediatePropagation();
		if (canceled) return;
		look.setPanelOpen(false);
		control?.focus();
	}
</script>

<svelte:window onkeydowncapture={escape} />

<button type="button" class="environment" class:compact bind:this={control}
	data-stage-environment-control aria-expanded={look.panelOpen} aria-controls={look.panelOpen ? id : undefined}
	aria-label={`Environment · ${name}${look.edited ? ' · edited' : ''} · ${reading}`}
	title={`${name} · ${reading}`}
	onpointerdown={(event) => event.stopPropagation()}
	onclick={(event) => { event.stopPropagation(); look.setPanelOpen(!look.panelOpen); }}>
	<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">{@html medallionSVG(sky)}</svg>
	{#if !compact}
		<span class="summary"><strong>{name}{#if look.edited}<i></i>{/if}</strong><span>{reading}</span></span>
		<span class="caret" aria-hidden="true">{look.panelOpen ? '▾' : '▴'}</span>
	{/if}
</button>

{#if look.panelOpen}
	<StagePopover {id} label="Sky" anchor={control} {sheet} {bottom} {maxHeight} onRect={rects.setPanel}>
		<SkyPanel {look} {fading} />
	</StagePopover>
{/if}

<style>
	.environment {
		position: absolute; right: 10px; bottom: 10px; z-index: 13;
		height: 48px; display: flex; align-items: center; gap: 8px; padding: 5px 10px 5px 5px;
		background: var(--shell-surface-raised); color: var(--shell-ink);
		border: 1px solid var(--shell-hairline); border-radius: 24px; box-shadow: var(--shell-shadow);
		cursor: pointer; font-family: var(--shell-sans);
	}
	.environment.compact { width: 48px; padding: 5px; }
	.environment:hover, .environment:focus-visible { outline: 2px solid var(--shell-leaf); outline-offset: 2px; }
	.environment[aria-expanded=true] { border-color: var(--shell-forest); }
	.summary { display: grid; text-align: left; line-height: 1.25; }
	.summary strong { display: flex; align-items: center; gap: 5px; font-size: 12px; }
	.summary strong i { width: 6px; height: 6px; border-radius: 50%; background: var(--shell-leaf); }
	.summary > span { font: 10px var(--shell-mono); }
	.caret { margin-left: 4px; }
</style>
