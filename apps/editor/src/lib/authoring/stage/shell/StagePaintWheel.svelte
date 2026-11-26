<script lang="ts">
	/**
	 * *Paint colour*: a compact floating picker anchored above
	 * the tray's *Custom colour* key. Hue around and saturation outward on a
	 * prominent wheel, a Lightness ramp, the project palette as linked chips, a
	 * compact labelled Hex field, close, and a compact action row. The header's
	 * before/current pair shows the colour it opened on beside the one chosen
	 * (#399's picker).
	 *
	 * Wheel, Lightness and Hex edits stay local to the picker. Nothing here
	 * writes: *Done* hands back a literal colour, a palette chip hands back its
	 * linked slot, and *Add to palette* asks the tray's one-Undo slot-add command,
	 * then hands back the returned slot. A full palette or a refused add is
	 * explained in place and the picker stays open.
	 *
	 * The Finish Card reuses the same presentation for its *Any colour* swatch
	 * (`title`, `onChange` for a write-free preview, no `onAdd`: adding to the
	 * palette stays a Paint action).
	 */
	import { onMount } from 'svelte';
	import { hexToHsl, hslToHex, normaliseHex, type PaintColour } from '$lib/authoring/look/paint-pick';

	let {
		initial,
		palette,
		onUse,
		onClose,
		room = true,
		onAdd = null,
		title = 'Paint colour',
		onChange = null,
		original = undefined
	}: {
		initial: string;
		palette: readonly { readonly id: string; readonly name: string; readonly color: string }[];
		/** Arm a colour: the literal on *Done*, or a palette chip's linked slot. */
		onUse: (colour: PaintColour) => void;
		onClose: () => void;
		/** Whether the palette has a free slot. */
		room?: boolean;
		/** The palette's one-Undo slot add; resolves to the new slot id, or null when refused. */
		onAdd?: ((hex: string) => Promise<string | null>) | null;
		/** The picker's name, for its header and dialog label. */
		title?: string;
		/** Each local edit, for a caller's write-free preview. */
		onChange?: ((hex: string) => void) | null;
		/**
		 * What the before swatch shows when it differs from where the dial
		 * starts; null is "no colour" (an untinted Finish). Defaults to `initial`.
		 */
		original?: string | null;
	} = $props();

	// The picker opens on the active colour; it does not follow it afterwards.
	// svelte-ignore state_referenced_locally
	let hsl = $state(hexToHsl(initial));
	// svelte-ignore state_referenced_locally
	let text = $state(normaliseHex(initial) ?? '#808080');
	let message = $state<string | null>(null);
	let adding = $state(false);
	let dial = $state<HTMLElement>();

	// svelte-ignore state_referenced_locally
	const before = original === null ? null : (normaliseHex(original ?? initial) ?? '#808080');
	const hex = $derived(hslToHex(hsl));
	const chosen = $derived(normaliseHex(text) ?? hex);

	onMount(() => dial?.focus());

	function set(next: { h: number; s: number; l: number }): void {
		hsl = next;
		text = hslToHex(next);
		message = null;
		onChange?.(text);
	}

	function fromPointer(event: PointerEvent): void {
		// Offsets are relative to the dial itself, so the wheel measures no layout.
		const element = event.currentTarget as HTMLElement;
		const radius = element.offsetWidth / 2;
		if (radius <= 0) return;
		const dx = event.offsetX - radius;
		const dy = event.offsetY - radius;
		const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
		set({ h: hue, s: Math.min(100, (Math.hypot(dx, dy) / radius) * 100), l: hsl.l });
	}

	function dialDown(event: PointerEvent): void {
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
		fromPointer(event);
	}

	function dialMove(event: PointerEvent): void {
		if (event.buttons !== 0) fromPointer(event);
	}

	function dialKey(event: KeyboardEvent): void {
		const step = event.shiftKey ? 10 : 2;
		if (event.key === 'ArrowLeft') set({ ...hsl, h: (hsl.h - step * 2 + 360) % 360 });
		else if (event.key === 'ArrowRight') set({ ...hsl, h: (hsl.h + step * 2) % 360 });
		else if (event.key === 'ArrowUp') set({ ...hsl, s: Math.min(100, hsl.s + step * 2) });
		else if (event.key === 'ArrowDown') set({ ...hsl, s: Math.max(0, hsl.s - step * 2) });
		else return;
		event.preventDefault();
		event.stopPropagation();
	}

	function hexInput(value: string): void {
		text = value;
		message = null;
		const parsed = normaliseHex(value);
		if (parsed === null) return;
		hsl = hexToHsl(parsed);
		onChange?.(parsed);
	}

	async function add(): Promise<void> {
		if (onAdd === null || adding) return;
		if (!room) {
			message = 'The palette already holds eight colours. Remove one in Edit palette to add another.';
			return;
		}
		adding = true;
		try {
			const slotId = await onAdd(chosen);
			if (slotId === null) {
				message = 'That colour was not added to the palette.';
				return;
			}
			onUse({ kind: 'slot', slotId });
		} finally {
			adding = false;
		}
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		onClose();
	}

	const knob = $derived.by(() => {
		const angle = ((hsl.h - 90) * Math.PI) / 180;
		const r = hsl.s / 2;
		return { left: `${50 + Math.cos(angle) * r}%`, top: `${50 + Math.sin(angle) * r}%` };
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="wheel" data-paint-wheel role="dialog" aria-label={title} tabindex="-1" onkeydown={onKeydown}>
	<header>
		<strong>{title}</strong>
		<span class="pair" title={before === null ? 'Before: no colour · current' : 'Before · current'} data-paint-wheel-pair>
			<i class:none={before === null} style={before === null ? undefined : `background: ${before}`} data-paint-wheel-before></i>
			<i style={`background: ${chosen}`} data-paint-wheel-current></i>
		</span>
		<button type="button" class="x" data-paint-wheel-cancel aria-label={`Close ${title}`} title="Close (Esc)" onclick={onClose}>×</button>
	</header>
	<div
		class="dial"
		role="slider"
		tabindex="0"
		bind:this={dial}
		aria-label="Hue and saturation"
		aria-valuemin={0}
		aria-valuemax={360}
		aria-valuenow={Math.round(hsl.h)}
		aria-valuetext={`Hue ${Math.round(hsl.h)} degrees, saturation ${Math.round(hsl.s)} percent`}
		style={`--lightness: ${hsl.l}%`}
		onpointerdown={dialDown}
		onpointermove={dialMove}
		onkeydown={dialKey}
	>
		<span class="knob" style={`left: ${knob.left}; top: ${knob.top}; background: ${hex}`}></span>
	</div>
	<label class="ramp">
		<span>Lightness</span>
		<input
			type="range"
			min="5"
			max="95"
			step="1"
			value={Math.round(hsl.l)}
			style={`--lo: ${hslToHex({ ...hsl, l: 5 })}; --mid: ${hslToHex({ ...hsl, l: 50 })}; --hi: ${hslToHex({ ...hsl, l: 95 })}`}
			oninput={(event) => set({ ...hsl, l: Number(event.currentTarget.value) })}
		/>
	</label>
	<p class="hint">
		{onChange !== null
			? 'Previewed live; Done commits. Palette colours stay linked.'
			: 'Palette colours keep surfaces linked to later palette changes.'}
	</p>
	{#if palette.length > 0}
		<span class="chips" role="group" aria-label="Project palette · linked">
			{#each palette as slot (slot.id)}
				<button
					type="button"
					class="slot"
					title={`${slot.name} · linked to the palette`}
					aria-label={`Paint with ${slot.name}`}
					data-paint-wheel-slot={slot.id}
					style={`background: ${slot.color}`}
					onclick={() => onUse({ kind: 'slot', slotId: slot.id })}
				></button>
			{/each}
		</span>
	{/if}
	<label class="hex">
		<span>Hex</span>
		<input
			type="text"
			data-paint-hex
			spellcheck="false"
			autocomplete="off"
			aria-label="Hex colour"
			value={text}
			oninput={(event) => hexInput(event.currentTarget.value)}
		/>
	</label>
	{#if message !== null}<p class="message" role="status" data-paint-wheel-message>{message}</p>{/if}
	<span class="actions">
		{#if onAdd !== null}
			<button
				type="button"
				data-paint-wheel-add
				aria-disabled={!room ? 'true' : undefined}
				title={room ? 'Add this colour to the project palette and paint with it (one undo)' : 'The palette already holds eight colours'}
				disabled={adding}
				onclick={() => void add()}
			>{adding ? 'Adding…' : 'Add to palette'}</button>
		{/if}
		<button
			type="button"
			class="use"
			data-paint-wheel-use
			onclick={() => onUse({ kind: 'literal', hex: chosen })}
		>Done</button>
	</span>
</div>

<style>
	.wheel {
		display: grid;
		gap: 0.55rem;
		box-sizing: border-box;
		width: min(236px, calc(100vw - 32px));
		max-height: 100%;
		padding: 10px 12px 12px;
		overflow: auto;
		border: 1px solid var(--shell-hairline);
		border-radius: var(--shell-instrument-radius);
		background: var(--shell-white);
		color: var(--shell-forest);
		box-shadow: 0 8px 24px rgb(18 38 29 / 18%);
		font-family: var(--shell-sans);
		font-size: var(--shell-text-utility);
	}
	.wheel:focus {
		outline: none;
	}
	header {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.pair {
		display: inline-flex;
		margin-left: auto;
		overflow: hidden;
		border-radius: 999px;
		box-shadow: 0 0 0 1px var(--shell-hairline-strong);
	}
	.pair i {
		display: block;
		width: 16px;
		height: 20px;
	}
	.pair i.none {
		background: linear-gradient(135deg, transparent 45%, var(--shell-hairline-strong) 45% 55%, transparent 55%), var(--shell-ivory);
	}
	.hint {
		margin: 0;
		color: var(--shell-ink-3);
		font-size: 11px;
		line-height: 1.35;
	}
	header strong {
		font-size: var(--shell-text-control);
	}
	.dial {
		position: relative;
		justify-self: center;
		width: 180px;
		height: 180px;
		border-radius: 50%;
		background:
			radial-gradient(circle closest-side, hsl(0 0% var(--lightness)), transparent),
			conic-gradient(from 0deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%));
		touch-action: none;
		cursor: crosshair;
	}
	.dial:focus-visible {
		outline: 2px solid var(--shell-leaf);
		outline-offset: 2px;
	}
	.knob {
		position: absolute;
		width: 0.95rem;
		height: 0.95rem;
		transform: translate(-50%, -50%);
		border: 2px solid var(--shell-white);
		border-radius: 50%;
		box-shadow: 0 0 0 1px rgb(0 0 0 / 45%);
		pointer-events: none;
	}
	.ramp {
		display: grid;
		gap: 0.2rem;
		color: var(--shell-ink-3);
	}
	.ramp input {
		width: 100%;
		height: 0.9rem;
		appearance: none;
		border-radius: 0.45rem;
		background: linear-gradient(90deg, var(--lo), var(--mid), var(--hi));
	}
	.ramp input::-webkit-slider-thumb {
		width: 1.1rem;
		height: 1.1rem;
		appearance: none;
		border: 2px solid var(--shell-white);
		border-radius: 50%;
		background: transparent;
		box-shadow: 0 0 0 1px rgb(0 0 0 / 45%);
	}
	.hex {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--shell-hairline);
		color: var(--shell-ink-2);
		font-size: 11px;
	}
	input[type='text'] {
		width: 84px;
		min-width: 0;
		min-height: var(--shell-control-height);
		padding: 0 0.4rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.25rem;
		background: var(--shell-white);
		color: inherit;
		font-family: var(--shell-mono);
		font-size: 11.5px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.message {
		margin: 0;
		color: var(--shell-refuse);
		line-height: 1.35;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.35rem;
	}
	button {
		min-height: var(--shell-control-height);
		padding: 0 0.7rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 999px;
		background: var(--shell-white);
		color: var(--shell-forest);
		font-size: var(--shell-text-utility);
		cursor: pointer;
	}
	button[aria-disabled='true'] {
		color: var(--shell-ink-3);
	}
	button:focus-visible {
		outline: 2px solid var(--shell-leaf);
		outline-offset: 2px;
	}
	button.x {
		width: 28px;
		min-height: 28px;
		padding: 0;
		border: 0;
		font-size: 18px;
		line-height: 1;
	}
	.slot {
		width: 22px;
		height: 22px;
		min-height: 22px;
		padding: 0;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 50%;
	}
	button.use {
		border-color: var(--shell-forest);
		background: var(--shell-forest);
		color: var(--shell-white);
	}
	@media (pointer: coarse) {
		button,
		input[type='text'] {
			min-height: var(--shell-touch-target);
		}
		button.x {
			width: var(--shell-touch-target);
		}
		.slot {
			width: var(--shell-touch-target);
			height: var(--shell-touch-target);
			min-height: var(--shell-touch-target);
		}
	}
</style>
