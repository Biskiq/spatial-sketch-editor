<script lang="ts">
	import { tick, type Snippet } from 'svelte';

	let { id, label, modal = false, anchor, sheet, bottom, maxHeight, onRect, children }: {
		id: string;
		label: string;
		modal?: boolean;
		anchor: HTMLElement | null;
		sheet: boolean;
		bottom: number;
		maxHeight: number;
		onRect: (rect: DOMRectReadOnly | null) => void;
		children: Snippet;
	} = $props();

	let panel = $state<HTMLElement>();
	$effect(() => {
		const node = panel;
		if (!node) return;
		void tick().then(() => node.querySelector<HTMLElement>('[data-sky-initial-focus]')?.focus());
	});
	$effect(() => {
		const node = panel;
		void bottom;
		void maxHeight;
		void sheet;
		if (!node) return;
		const measure = () => onRect(node.getBoundingClientRect());
		measure();
		if (typeof ResizeObserver === "undefined") return () => onRect(null);
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => { observer.disconnect(); onRect(null); };
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div {id} bind:this={panel} class="popover" class:sheet tabindex="-1" role="dialog" aria-label={label} aria-modal={modal}
	style:bottom={`${bottom}px`} style:max-height={`${maxHeight}px`}
	style:--anchor-half={`${(anchor?.offsetWidth ?? 48) / 2}px`}
	onpointerdown={(event) => event.stopPropagation()} onclick={(event) => event.stopPropagation()}>
	<div class="scroll" style:max-height={`${maxHeight - 2}px`}>{@render children()}</div>
</div>

<style>
	.popover {
		position: absolute; z-index: 13; right: 10px; width: min(320px, calc(100% - 20px));
		box-sizing: border-box; border: 1px solid var(--shell-hairline); border-radius: 12px;
		background: var(--shell-surface-raised); color: var(--shell-ink); box-shadow: var(--shell-shadow);
		font: var(--shell-text-body)/1.35 var(--shell-sans);
	}
	.popover::after {
		content: ''; position: absolute; right: calc(var(--anchor-half) - 6px); bottom: -6px;
		width: 10px; height: 10px; background: inherit; border: 1px solid var(--shell-hairline);
		border-left: 0; border-top: 0; transform: rotate(45deg);
	}
	.scroll { overflow: auto; overscroll-behavior: contain; border-radius: inherit; }
	.sheet { left: 10px; width: auto; }
</style>
