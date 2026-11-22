<script lang="ts">
	/**
	 * The custom colour wheel (T2.S8 U2): hue around, saturation outward, a
	 * lightness ramp, a hex field and the project palette as chips. It picks a
	 * colour and nothing else; the tray decides what the pick does.
	 */
	import { hexToHsl, hslToHex, normaliseHex, type PaintColour } from '$lib/authoring/look/paint-pick';

	let {
		initial,
		palette,
		onUse,
		onClose
	}: {
		initial: string;
		palette: readonly { readonly id: string; readonly name: string; readonly color: string }[];
		onUse: (colour: PaintColour) => void;
		onClose: () => void;
	} = $props();

	// The wheel opens on the active colour; it does not follow it afterwards.
	// svelte-ignore state_referenced_locally
	let hsl = $state(hexToHsl(initial));
	// svelte-ignore state_referenced_locally
	let text = $state(normaliseHex(initial) ?? '#808080');

	const hex = $derived(hslToHex(hsl));

	function set(next: { h: number; s: number; l: number }): void {
		hsl = next;
		text = hslToHex(next);
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
		const parsed = normaliseHex(value);
		if (parsed !== null) hsl = hexToHsl(parsed);
	}

	const knob = $derived.by(() => {
		const angle = ((hsl.h - 90) * Math.PI) / 180;
		const r = hsl.s / 2;
		return { left: `${50 + Math.cos(angle) * r}%`, top: `${50 + Math.sin(angle) * r}%` };
	});
</script>

<div class="wheel" data-paint-wheel role="group" aria-label="Custom colour">
	<div
		class="dial"
		role="slider"
		tabindex="0"
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
	<div class="controls">
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
		<label class="hex">
			<span class="chip" style={`background: ${hex}`} aria-hidden="true"></span>
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
		{#if palette.length > 0}
			<span class="chips" role="group" aria-label="Project palette">
				{#each palette as slot (slot.id)}
					<button
						type="button"
						class="slot"
						title={slot.name}
						aria-label={`Start from ${slot.name}`}
						style={`background: ${slot.color}`}
						onclick={() => set(hexToHsl(slot.color))}
					></button>
				{/each}
			</span>
		{/if}
		<span class="actions">
			<button type="button" data-paint-wheel-cancel onclick={onClose}>Cancel</button>
			<button
				type="button"
				class="use"
				data-paint-wheel-use
				onclick={() => onUse({ kind: 'literal', hex: normaliseHex(text) ?? hex })}
			>
				Use colour
			</button>
		</span>
	</div>
</div>

<style>
	.wheel {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0.75rem;
		padding-top: 0.5rem;
	}
	.dial {
		position: relative;
		width: 8.5rem;
		height: 8.5rem;
		flex: none;
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
		width: 0.9rem;
		height: 0.9rem;
		transform: translate(-50%, -50%);
		border: 2px solid var(--shell-white);
		border-radius: 50%;
		box-shadow: 0 0 0 1px rgb(0 0 0 / 45%);
		pointer-events: none;
	}
	.controls {
		display: flex;
		min-width: 11rem;
		flex: 1;
		flex-direction: column;
		gap: 0.5rem;
	}
	.ramp {
		display: flex;
		flex-direction: column;
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
		gap: 0.4rem;
	}
	.chip {
		width: 1.4rem;
		height: 1.4rem;
		flex: none;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 50%;
	}
	input[type='text'] {
		width: 6.5rem;
		min-height: var(--shell-control-height);
		padding: 0 0.4rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.25rem;
		background: var(--shell-white);
		color: inherit;
		font-family: var(--shell-mono);
		font-size: var(--shell-text-utility);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.slot {
		width: 1.3rem;
		height: 1.3rem;
		min-height: 1.3rem;
		padding: 0;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 50%;
	}
	.actions {
		display: flex;
		gap: 0.3rem;
	}
	button {
		min-height: var(--shell-control-height);
		padding: 0 0.6rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 999px;
		background: var(--shell-white);
		color: var(--shell-forest);
		font-size: var(--shell-text-utility);
		cursor: pointer;
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
		.slot {
			width: var(--shell-touch-target);
			height: var(--shell-touch-target);
			min-height: var(--shell-touch-target);
		}
	}
</style>
