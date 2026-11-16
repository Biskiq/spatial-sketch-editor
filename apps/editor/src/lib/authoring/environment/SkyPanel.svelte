<script lang="ts">
	import type { SceneSkyUpdatePayload } from '@portfolio/project-model/units';
	import { WORLD_ENVIRONMENT_CHOICES, WORLD_ENVIRONMENT_PRESENTATIONS } from '$lib/render/world-environment';
	import { adjacentPhaseStart, hhmm, phaseName, skyBodyAt, snapTime, wrap360, SUNRISE, SUNSET } from '$lib/render/sky-time';
	import type { LookAuthoring } from '../look/look-authoring.svelte';
	import { compassSVG, skyGlyph, timeDialSVG } from './sky-glyphs';

	let { look, fading = false }: { look: LookAuthoring; fading?: boolean } = $props();
	const id = $props.id();
	const sky = $derived(look.shownSky);
	const body = $derived(skyBodyAt(sky.time, sky.heading, sky.arcHeight));
	const gesture = $derived(look.gesture);
	const presentation = $derived(WORLD_ENVIRONMENT_PRESENTATIONS[sky.preset]);
	const keys = new Set<string>();
	let colorFrame: number | undefined;
	let more = $state(readMore());

	function readMore() {
		try { return localStorage.getItem('biskiq:sky-more') === 'true'; }
		catch { return false; }
	}

	function saveMore(event: ToggleEvent) {
		const open = (event.currentTarget as HTMLDetailsElement).open;
		more = open;
		try { localStorage.setItem('biskiq:sky-more', String(open)); } catch { /* Session only. */ }
	}

	function cancel() {
		keys.clear();
		gesture.cancel();
	}

	// Focus moves on the next control's pointerdown, after that control has begun
	// its own gesture, so a blur or pointercancel ends only the gesture it owns.
	function cancelOwn(owner: string) {
		if (gesture.owner === owner) cancel();
	}

	function dialMove(event: PointerEvent, owner: 'time' | 'heading') {
		if (gesture.owner !== owner) return;
		const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
		const x = event.clientX - rect.left - rect.width / 2;
		const y = event.clientY - rect.top - rect.height / 2;
		if (x === 0 && y === 0) return;
		if (owner === 'time') {
			gesture.move(owner, { time: snapTime(Math.atan2(-x, y) * 12 / Math.PI) });
		} else {
			const degrees = Math.atan2(x, -y) * 180 / Math.PI;
			gesture.move(owner, { heading: wrap360(event.altKey ? degrees : Math.round(degrees / 15) * 15) });
		}
	}

	function dialPress(event: PointerEvent, owner: 'time' | 'heading') {
		if (event.button !== 0) return;
		const dial = event.currentTarget as SVGElement;
		dial.focus();
		if (!gesture.begin(owner)) return;
		dial.setPointerCapture(event.pointerId);
		dialMove(event, owner);
	}

	function dialRelease(event: PointerEvent, owner: 'time' | 'heading') {
		dialMove(event, owner);
		void gesture.commit(owner);
	}

	function dialKey(event: KeyboardEvent, owner: 'time' | 'heading') {
		const step = ['ArrowUp', 'ArrowRight'].includes(event.key) ? 1
			: ['ArrowDown', 'ArrowLeft'].includes(event.key) ? -1 : null;
		const time = gesture.value.time;
		let change: SceneSkyUpdatePayload;
		if (owner === 'heading') {
			if (step === null) return;
			change = { heading: wrap360(gesture.value.heading + step * (event.shiftKey ? 45 : 15)) };
		} else if (step !== null) {
			change = { time: snapTime(time + step * (event.shiftKey ? 1 : 0.25)) };
		} else {
			switch (event.key) {
				case 'PageUp': change = { time: adjacentPhaseStart(time, 1) }; break;
				case 'PageDown': change = { time: adjacentPhaseStart(time, -1) }; break;
				case 'Home': change = { time: SUNRISE }; break;
				case 'End': change = { time: SUNSET }; break;
				default: return;
			}
		}
		event.preventDefault();
		event.stopPropagation();
		if (!gesture.begin(owner)) return;
		keys.add(event.key);
		gesture.move(owner, change);
	}

	function keyRelease(event: KeyboardEvent, owner: string) {
		if (!keys.delete(event.key)) return;
		event.stopPropagation();
		if (keys.size === 0) void gesture.commit(owner);
	}

	function rangeKey(event: KeyboardEvent, owner: string) {
		if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return;
		event.stopPropagation();
		if (gesture.begin(owner)) keys.add(event.key);
		else event.preventDefault();
	}

	function rangeInput(input: HTMLInputElement, owner: string, accepted: number, patch: SceneSkyUpdatePayload) {
		if (gesture.owner === owner) gesture.move(owner, patch);
		// Svelte sets `value` as a property, so the default value is empty and would
		// sanitize to the midpoint; a refused input restores the accepted value.
		else input.value = String(accepted);
	}

	$effect(() => () => {
		if (colorFrame !== undefined) cancelAnimationFrame(colorFrame);
	});

	function colorOpen(event: MouseEvent & { currentTarget: HTMLInputElement }, owner: string) {
		if (!gesture.begin(owner)) {
			event.preventDefault();
			return;
		}
		if (typeof CSS === 'undefined' || !CSS.supports?.('selector(input:open)')) return;
		const input = event.currentTarget;
		if (colorFrame !== undefined) cancelAnimationFrame(colorFrame);
		const check = () => {
			colorFrame = undefined;
			if (!input.isConnected || gesture.owner !== owner) return;
			// A native chooser can restore the original value and close without firing change.
			if (!input.matches(':open')) cancel();
			else colorFrame = requestAnimationFrame(check);
		};
		colorFrame = requestAnimationFrame(check);
	}

	function colorChange(owner: string, patch: SceneSkyUpdatePayload) {
		if (gesture.owner !== owner) return;
		gesture.move(owner, patch);
		void gesture.commit(owner);
	}
</script>

{#snippet range(label: string, value: number, min: number, max: number, step: number, readout: string, change: (value: number) => SceneSkyUpdatePayload)}
	<label class="range">
		<span>{label}<output>{readout}</output></span>
		<input type="range" {min} {max} {step} {value} disabled={look.busy}
			onpointerdown={() => gesture.begin(label)}
			onpointerup={() => void gesture.commit(label)}
			onpointercancel={() => cancelOwn(label)} onblur={() => cancelOwn(label)}
			onkeydown={(event) => rangeKey(event, label)} onkeyup={(event) => keyRelease(event, label)}
			oninput={(event) => rangeInput(event.currentTarget, label, value, change(event.currentTarget.valueAsNumber))}
			{@attach (input) => {
				// A cancelled native drag keeps its thumb where the pointer left it;
				// outside its own gesture the thumb follows the Sky value.
				const accepted = String(value);
				if (gesture.owner !== label && input.value !== accepted) input.value = accepted;
			}}
		/>
	</label>
{/snippet}

{#snippet color(label: string, value: string, change: (value: string) => SceneSkyUpdatePayload)}
	<label class="color">
		<span>{label}</span>
			<input type="color" {value} disabled={look.busy}
				onclick={(event) => colorOpen(event, label)}
				oninput={(event) => { if (gesture.owner === label) gesture.move(label, change(event.currentTarget.value)); }}
				onchange={(event) => colorChange(label, change(event.currentTarget.value))}
				onblur={() => cancelOwn(label)}
			/>
	</label>
{/snippet}

<div class="sky">
	<header><strong>Sky</strong><span>{presentation.label}</span>
		{#if look.edited}<span class="edited">edited · <button type="button" class="link" disabled={look.busy} onclick={look.resetSky}>Reset</button></span>{/if}
	</header>
	{#if sky.preset !== 'studio'}
		<div class="readings">
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<svg width="120" height="120" viewBox="0 0 120 120" role="slider" tabindex="0"
				data-sky-initial-focus aria-label="Time of day" aria-valuemin="0" aria-valuemax="24" aria-valuenow={sky.time}
				aria-valuetext={`${hhmm(sky.time)}, ${phaseName(sky.time)}`}
				class:dim={fading && gesture.owner !== 'dial-time'}
				onpointerdown={(event) => dialPress(event, 'time')} onpointermove={(event) => dialMove(event, 'time')}
				onpointerup={(event) => dialRelease(event, 'time')} onpointercancel={() => cancelOwn('time')} onblur={() => cancelOwn('time')}
				onkeydown={(event) => dialKey(event, 'time')} onkeyup={(event) => keyRelease(event, 'time')}
			>{@html timeDialSVG(sky, gesture.owner === 'time', id)}</svg>
			<div>
				<div class="hour" class:dim={fading && gesture.owner !== 'dial-time'}>{hhmm(sky.time)}</div>
				<div class="phase" class:dim={fading && gesture.owner !== 'dial-time'}>
					{phaseName(sky.time)}
					{#if body.body !== 'none'}<br />{body.body === 'sun' ? 'Sun' : 'Moon'} bearing {Math.round(body.az)}° · {Math.round(body.el)}° high{/if}
				</div>
				<div class="direction" class:dim={fading && gesture.owner !== 'dial-heading'}>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<svg width="28" height="28" viewBox="0 0 28 28" role="slider" tabindex="0"
						aria-label="Sun direction at noon" aria-valuemin="0" aria-valuemax="360" aria-valuenow={sky.heading}
						aria-valuetext={`${Math.round(sky.heading)} degrees`}
						onpointerdown={(event) => dialPress(event, 'heading')} onpointermove={(event) => dialMove(event, 'heading')}
						onpointerup={(event) => dialRelease(event, 'heading')} onpointercancel={() => cancelOwn('heading')} onblur={() => cancelOwn('heading')}
						onkeydown={(event) => dialKey(event, 'heading')} onkeyup={(event) => keyRelease(event, 'heading')}
					>{@html compassSVG(sky.heading)}</svg>
					<span>Noon {Math.round(sky.heading)}°<br /><button type="button" class="link" disabled={look.busy} onclick={look.aimThroughWindows}>Aim through windows</button></span>
				</div>
			</div>
		</div>
	{/if}
	<div class:dim={fading}>
		<div class="tiles">
			{#each WORLD_ENVIRONMENT_CHOICES as preset (preset.preset)}
				<button type="button" data-sky-initial-focus={sky.preset === 'studio' && preset.preset === 'studio' ? '' : undefined}
					aria-label={preset.label} title={preset.label} aria-pressed={preset.preset === sky.preset} disabled={look.busy}
					onclick={() => look.setEnvironment(preset.preset)}>
					<i style:background={`linear-gradient(${preset.swatch.join(',')})`}>
						{#if preset.glyph}<svg viewBox="0 0 24 24" aria-hidden="true">{@html skyGlyph(12, 13, 4.2, preset.glyph)}</svg>{/if}
					</i>
					{preset.short}
				</button>
			{/each}
		</div>
		{#if sky.preset === 'studio'}
			<p>Studio light is even and fixed. Pick a sky to set the time.</p>
		{:else}
			{@render range('Haze', sky.haze, 0, 100, 1, `${sky.haze}%`, (haze) => ({ haze }))}
			<details open={more} ontoggle={saveMore}>
				<summary>More</summary>
				<label class="color"><span>Sun shadows <small>Also applies to Moon at night</small></span>
					<input type="checkbox" role="switch" checked={sky.sunShadows} disabled={look.busy}
						onchange={(event) => void look.updateSky({ sunShadows: event.currentTarget.checked })} />
				</label>
				{@render range('Noon height', sky.arcHeight, 20, 80, 1, `${sky.arcHeight}°`, (arcHeight) => ({ arcHeight }))}
				{@render range('Exposure', sky.exposure, -2, 2, 0.1, `${sky.exposure > 0 ? '+' : ''}${sky.exposure.toFixed(1)} EV`, (exposure) => ({ exposure }))}
				{@render color('Sky colour', sky.skyColor, (skyColor) => ({ skyColor }))}
				{@render color('Ground colour', sky.groundColor, (groundColor) => ({ groundColor }))}
				{@render color('Moon colour', sky.moon.color, (color) => ({ moon: { color } }))}
				{@render range('Moon strength', sky.moon.strength, 0, 1, 0.05, `${Math.round(sky.moon.strength * 100)}%`, (strength) => ({ moon: { strength } }))}
				{@render range('Sun shadow softness', sky.softness, 0, 1, 0.05, sky.softness.toFixed(2), (softness) => ({ softness }))}
			</details>
		{/if}
	</div>
</div>

<style>
	.sky { padding: 12px; display: grid; gap: 8px; }
	header { display: flex; gap: 8px; align-items: baseline; color: var(--shell-ink); }
	header strong { font-size: 15px; }
	header span, p, .phase, small { color: var(--shell-ink-2); font-size: 12px; }
	.edited { margin-left: auto; }
	.link { padding: 0; border: 0; background: none; color: var(--shell-forest); text-decoration: underline; cursor: pointer; }
	.readings { display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 12px; }
	.hour { font: 26px/1.1 var(--shell-mono); }
	.phase { line-height: 1.4; }
	.direction { display: flex; align-items: center; gap: 6px; margin-top: 5px; font-size: 11px; }
	svg[role=slider] { touch-action: none; cursor: grab; }
	svg[role=slider]:active { cursor: grabbing; }
	.tiles { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
	.tiles button { display: grid; gap: 2px; justify-items: center; padding: 3px 0; min-width: 0; font: 10px var(--shell-sans); color: inherit; background: transparent; border: 1px solid var(--shell-hairline); border-radius: 5px; }
	.tiles button[aria-pressed=true] { border-color: var(--shell-forest); box-shadow: inset 0 0 0 1px var(--shell-forest); }
	.tiles i { width: calc(100% - 6px); height: 24px; border-radius: 3px; display: grid; place-items: center; }
	.tiles svg { height: 24px; width: 24px; }
	.range { display: grid; gap: 2px; margin-top: 8px; }
	.range > span, .color { display: flex; align-items: center; justify-content: space-between; }
	input[type=range] { width: 100%; margin: 0; accent-color: var(--shell-forest); }
	output { font: 11px var(--shell-mono); }
	details { border-top: 1px solid var(--shell-hairline); margin-top: 8px; padding-top: 6px; }
	summary { cursor: pointer; }
	.color { margin-top: 8px; }
	.color small { display: block; }
	.color input[type=color] { width: 42px; height: 26px; }
	.dim { opacity: .2; }
	p { margin: 8px 0 0; }
</style>
