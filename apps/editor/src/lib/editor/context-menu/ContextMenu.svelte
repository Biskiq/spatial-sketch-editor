<script lang="ts">
	// P3.4 — the one shared context-menu shell. Renders the active request at
	// its anchor, clamped inside the viewport; closes on outside pointerdown,
	// Escape, scroll, resize, or after an action runs. Pure presentation: item
	// semantics live in the surface adapters.
	//
	// P23.14 §7 / #38 — the shell also owns the keyboard contract, so every menu
	// in the editor (Plan, 3D, Navigator, Camera, Timeline) behaves identically:
	// it takes focus on open, walks enabled items with the arrows/Home/End,
	// closes on Tab, and hands focus back to the opener when the close came from
	// the keyboard.
	import { onMount, tick } from 'svelte';
	import {
		clampMenuPosition,
		resolveMenuItemFocus
	} from './context-menu-state.svelte';
	import type { EditorContextMenuStore } from './context-menu-state.svelte';

	let { store }: { store: EditorContextMenuStore } = $props();

	let menuElement = $state<HTMLElement | null>(null);
	let position = $state({ x: 0, y: 0 });
	/** Bound in item order; index-addressed so roving focus can target an item. */
	let itemElements = $state<(HTMLButtonElement | null)[]>([]);

	const request = $derived(store.menu);

	/**
	 * The element focus returns to. Captured at open time rather than passed in,
	 * so every existing adapter gets focus restore without changing its call site.
	 */
	let opener: HTMLElement | null = null;
	let wasOpen = false;
	/** Only a keyboard-initiated close returns focus: a pointer close must never
	 * yank focus off the control the user just aimed at. */
	let keyboardClose = false;

	$effect(() => {
		const open = Boolean(request);
		if (!open) {
			if (!wasOpen) return;
			wasOpen = false;
			const target = opener;
			const restore = keyboardClose;
			opener = null;
			keyboardClose = false;
			if (restore && target) void tick().then(() => target.focus());
			return;
		}
		wasOpen = true;
		if (!opener) {
			const active = document.activeElement;
			opener = active instanceof HTMLElement && active !== document.body ? active : null;
		}
		position = { x: request!.x, y: request!.y };
		void tick().then(() => {
			if (!menuElement) return;
			const box = menuElement.getBoundingClientRect();
			position = clampMenuPosition(
				request!.x,
				request!.y,
				box.width,
				box.height,
				window.innerWidth,
				window.innerHeight
			);
			// Focus lands inside the menu on open, so the menu is reachable from
			// the keyboard the moment it exists.
			const first = itemElements.findIndex((element) => element && !element.disabled);
			// Nothing enabled (every item refused): the menu still takes focus, so
			// Escape and the reason text are reachable from the keyboard.
			if (first >= 0) itemElements[first]?.focus();
			else menuElement.focus();
		});
	});

	function onWindowPointerDown(event: PointerEvent) {
		if (!menuElement || !menuElement.contains(event.target as Node)) {
			keyboardClose = false;
			store.close();
		}
	}

	function focusItem(index: number | null) {
		if (index === null) return;
		itemElements[index]?.focus();
	}

	function onMenuKeydown(event: KeyboardEvent) {
		const items = request?.items ?? [];
		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowUp':
			case 'Home':
			case 'End': {
				const focused = itemElements.findIndex((element) => element === document.activeElement);
				focusItem(resolveMenuItemFocus(items, focused, event.key));
				keyboardClose = true;
				event.preventDefault();
				return;
			}
			case 'Escape':
				keyboardClose = true;
				return;
			case 'Tab':
				// Standard menu contract: Tab leaves the menu rather than walking it.
				keyboardClose = true;
				return;
			case 'Enter':
			case ' ':
				// The activation that follows is the native button click; flagging the
				// intent here is what makes focus return for keyboard activation.
				keyboardClose = true;
				return;
			default:
				return;
		}
	}

	function onWindowKeydown(event: KeyboardEvent) {
		// This listener lives on `window` in the CAPTURE phase for the whole
		// session, so it must only ever consume Escape while the menu is actually
		// open: an unconditional `stopPropagation()` swallowed every Escape in the
		// app (Plan draft cancel, opening-drag cancel, Delete …) because no
		// element-level keydown handler is downstream of window capture.
		if (!menuElement) return;
		if (event.key !== 'Escape') return;
		event.stopPropagation();
		keyboardClose = true;
		store.close();
	}

	function runItem(run: () => void) {
		store.close();
		run();
	}

	onMount(() => {
		window.addEventListener('pointerdown', onWindowPointerDown, true);
		window.addEventListener('keydown', onWindowKeydown, true);
		window.addEventListener('resize', store.close);
		window.addEventListener('scroll', store.close, true);
		window.addEventListener('blur', store.close);
		return () => {
			window.removeEventListener('pointerdown', onWindowPointerDown, true);
			window.removeEventListener('keydown', onWindowKeydown, true);
			window.removeEventListener('resize', store.close);
			window.removeEventListener('scroll', store.close, true);
			window.removeEventListener('blur', store.close);
		};
	});
</script>

{#if request}
	<div
		bind:this={menuElement}
		class="context-menu"
		style={`left: ${position.x}px; top: ${position.y}px`}
		role="menu"
		aria-label={`${request.surfaceId} actions`}
		tabindex="-1"
		onkeydown={onMenuKeydown}
	>
		{#each request.items as item, index (item.id)}
			{#if item.separatorBefore}
				<div class="separator" role="separator"></div>
			{/if}
			<button
				bind:this={itemElements[index]}
				type="button"
				class:danger={item.danger}
				disabled={Boolean(item.disabledReason)}
				title={item.disabledReason ?? undefined}
				aria-disabled={item.disabledReason ? 'true' : undefined}
				role="menuitem"
				tabindex="-1"
				onpointerdown={(event) => event.stopPropagation()}
				onclick={() => { if (!item.disabledReason) runItem(item.run); }}
			>
				<span class="label">{item.label}</span>
				{#if item.disabledReason}<span class="reason">{item.disabledReason}</span>{/if}
			</button>
		{/each}
	</div>
{/if}

<style>
	.context-menu {
		position: fixed;
		z-index: 90;
		display: grid;
		min-width: 11rem;
		padding: var(--editor-space-1);
		border: 1px solid var(--editor-border-normal);
		border-radius: var(--editor-radius-lg);
		background: var(--editor-bg-panel-raised);
		box-shadow: var(--editor-shadow-popover);
		font-family: var(--editor-font);
	}
	.separator {
		height: 1px;
		margin: var(--editor-space-1) calc(var(--editor-space-2) * -1);
		background: var(--editor-border-subtle);
	}
	button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--editor-space-3);
		width: 100%;
		padding: 0.32rem 0.55rem;
		border: 0;
		border-radius: var(--editor-radius-sm);
		background: transparent;
		color: var(--editor-text-primary);
		font-size: 0.74rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		background: var(--editor-bg-hover);
	}
	/* §7 — the focused item carries the independent focus ring (inset, because an
	   outward ring would clip against the menu box), so arrowing through the menu
	   is never signalled by the hover tint alone. */
	button:focus-visible:not(:disabled) {
		background: var(--editor-bg-hover);
		outline: var(--editor-focus-ring-width) solid var(--editor-focus-ring);
		outline-offset: -2px;
	}
	button.danger:not(:disabled) {
		color: var(--editor-danger-fg);
	}
	button.danger:hover:not(:disabled) {
		background: var(--editor-danger-soft);
	}
	button:disabled {
		color: var(--editor-text-disabled);
		cursor: default;
	}
	.reason {
		max-width: 9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.62rem;
		font-weight: 400;
		color: var(--editor-text-muted);
	}
</style>
