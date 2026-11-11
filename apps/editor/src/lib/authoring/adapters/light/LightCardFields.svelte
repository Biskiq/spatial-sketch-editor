<script lang="ts">
	/**
	 * T2.S3 — the Card's one light writer.
	 *
	 * Warmth is an sRGB token, Brightness is one of Gate A's five stops, Reach is
	 * the authored cutoff and Beam is a half-angle in degrees. Exact values stay
	 * under More so the ordinary Card remains a short named row. Every explicit
	 * commit is the same `update-light` planner the marks submit. Exact fields
	 * commit on Enter only; Esc restores the accepted values and blur writes
	 * nothing.
	 */
	import type { Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { stageScene } from '$lib/authoring/stage/stage-adapter-host';
	import type { SceneLightEntity, Vec3 } from '@portfolio/project-model';
	import { acceptFormCommand } from '../scene/form-card-command';
	import {
		brightnessStopForIntensity,
		degreesToRadians,
		formatBrightness,
		LIGHT_BRIGHTNESS_STOPS,
		LIGHT_WARMTH_TOKENS,
		lightKindLabel,
		radiansToDegrees,
		intensityForBrightnessStop
	} from '$lib/authoring/look/light-units';
	import {
		lightForward,
		LIGHT_AIM_GUIDE_METERS,
		rotationForLightDirection
	} from '$lib/authoring/look/light-aim';

	let {
		services,
		detailOpen = false,
		footer
	}: {
		services: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet;
	} = $props();

	type Light = SceneLightEntity;

	function selectedLight(): Light | null {
		const primary = services.stage.selectionState().primary;
		if (primary?.domain !== 'scene' || primary.subject.kind !== 'entity') return null;
		const entity = stageScene(services.stage.snapshot()).entities.find(
			(candidate) => candidate.id === primary.subject.id
		);
		return entity?.kind === 'light' ? entity : null;
	}

	let light = $state<Light | null>(null);
	let reach = $state('');
	let beam = $state('');
	let exactColor = $state('');
	let exactIntensity = $state('');
	let exactRange = $state('');
	let exactHalfAngle = $state('');
	let exactPenumbra = $state('');
	let exactX = $state('');
	let exactY = $state('');
	let exactZ = $state('');
	let aimX = $state('');
	let aimY = $state('');
	let aimZ = $state('');
	let azimuth = $state('');
	let elevation = $state('');
	let message = $state('');
	let busy = $state(false);

	function rangeOf(value: Light): number | undefined {
		return 'range' in value ? value.range : undefined;
	}

	function roundedDegrees(radians: number): number {
		return Math.round(radiansToDegrees(radians) * 10) / 10;
	}

	function sync(): void {
		const next = selectedLight();
		light = next;
		if (next === null) return;
		const range = rangeOf(next);
		reach = range === undefined ? '' : String(range);
		beam = next.light === 'spot' ? String(roundedDegrees(next.angle)) : '';
		exactColor = next.color;
		exactIntensity = String(next.intensity);
		exactRange = range === undefined ? '' : String(range);
		exactHalfAngle = next.light === 'spot' ? String(roundedDegrees(next.angle)) : '';
		exactPenumbra =
			next.light === 'spot' ? String(Math.round((next.penumbra ?? 0) * 1000) / 10) : '';
		exactX = String(next.position[0]);
		exactY = String(next.position[1]);
		exactZ = String(next.position[2]);
		const forward = lightForward(next.rotation);
		const target = [
			next.position[0] + forward[0] * LIGHT_AIM_GUIDE_METERS,
			next.position[1] + forward[1] * LIGHT_AIM_GUIDE_METERS,
			next.position[2] + forward[2] * LIGHT_AIM_GUIDE_METERS
		];
		aimX = String(Math.round(target[0] * 100) / 100);
		aimY = String(Math.round(target[1] * 100) / 100);
		aimZ = String(Math.round(target[2] * 100) / 100);
		azimuth =
			Math.hypot(forward[0], forward[2]) < 1e-9
				? '0'
				: String(
						Math.round(radiansToDegrees(Math.atan2(-forward[0], -forward[2])) * 10) / 10
					);
		elevation = String(
			Math.round(radiansToDegrees(Math.asin(Math.max(-1, Math.min(1, forward[1])))) * 10) / 10
		);
	}

	$effect(() => {
		void services.stage.selectionState().primary;
		sync();
	});

	async function commit(update: Record<string, unknown>): Promise<void> {
		const current = light;
		if (current === null || busy) return;
		busy = true;
		message = '';
		try {
			const outcome = await acceptFormCommand(
				services,
				services.stage.snapshot(),
				current.id,
				'update-light',
				{ entityId: current.id, ...update }
			);
			if (outcome.kind === 'refused') message = outcome.message;
			else sync();
		} finally {
			busy = false;
		}
	}

	function setWarmth(color: string): void {
		void commit({ color });
	}

	function setBrightness(stop: number): void {
		void commit({ intensity: intensityForBrightnessStop(stop) });
	}

	function commitReach(value: string): void {
		if (light === null) return;
		const trimmed = value.trim();
		if (trimmed !== '') {
			const number = Number(trimmed);
			if (!Number.isFinite(number) || number <= 0) {
				message = 'Reach must be greater than 0 m.';
				return;
			}
		}
		void commit({ range: trimmed === '' ? null : Number(trimmed) });
	}

	function commitBeam(value: string): void {
		if (light === null || light.light !== 'spot') return;
		const degrees = Number(value.trim());
		if (!Number.isFinite(degrees) || degrees <= 0) {
			message = 'Beam must be greater than 0°.';
			return;
		}
		void commit({ angle: degreesToRadians(degrees) });
	}

	function commitExactColor(): void {
		const color = exactColor.trim();
		if (!/^#[0-9a-f]{6}$/i.test(color)) {
			message = 'Colour must be a six-digit sRGB hex value.';
			return;
		}
		void commit({ color });
	}

	function commitExactIntensity(): void {
		const intensity = Number(exactIntensity.trim());
		if (!Number.isFinite(intensity) || intensity < 0) {
			message = 'Intensity must be zero or greater.';
			return;
		}
		void commit({ intensity });
	}

	function commitExactRange(): void {
		commitReach(exactRange);
	}

	function commitExactHalfAngle(): void {
		commitBeam(exactHalfAngle);
	}

	function commitExactPenumbra(): void {
		if (light === null || light.light !== 'spot') return;
		const percent = Number(exactPenumbra.trim());
		if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
			message = 'Soft edge must be between 0% and 100%.';
			return;
		}
		void commit({ penumbra: percent / 100 });
	}

	function commitPosition(): void {
		const position: Vec3 = [Number(exactX), Number(exactY), Number(exactZ)];
		if (!position.every(Number.isFinite)) {
			message = 'Position needs three finite metres.';
			return;
		}
		void commit({ position });
	}

	function commitAim(): void {
		if (light === null) return;
		const target: Vec3 = [Number(aimX), Number(aimY), Number(aimZ)];
		if (!target.every(Number.isFinite)) {
			message = 'Aim needs three finite metres.';
			return;
		}
		const direction = [
			target[0] - light.position[0],
			target[1] - light.position[1],
			target[2] - light.position[2]
		] as Vec3;
		if (Math.hypot(...direction) <= 1e-9) {
			message = 'Aim must differ from the light position.';
			return;
		}
		void commit({ rotation: rotationForLightDirection(direction) });
	}

	function commitDirection(): void {
		const az = Number(azimuth.trim());
		const el = Number(elevation.trim());
		if (!Number.isFinite(az) || !Number.isFinite(el) || el < -90 || el > 90) {
			message = 'Azimuth and elevation need finite degrees; elevation is −90° to 90°.';
			return;
		}
		const radiansAz = degreesToRadians(az);
		const radiansEl = degreesToRadians(el);
		const direction: Vec3 = [
			-Math.sin(radiansAz) * Math.cos(radiansEl),
			Math.sin(radiansEl),
			-Math.cos(radiansAz) * Math.cos(radiansEl)
		];
		void commit({ rotation: rotationForLightDirection(direction) });
	}

	function exactKey(event: KeyboardEvent, run: () => void): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			run();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			sync();
		}
	}

	function warmthIsExact(value: Light): boolean {
		return LIGHT_WARMTH_TOKENS.some(
			(token) => token.color === value.color.toLowerCase()
		);
	}

	function brightnessIsCustom(value: Light): boolean {
		return brightnessStopForIntensity(value.intensity) === null;
	}

	function brightnessTitle(stop: number, kind: Light['light']): string {
		const unit = kind === 'directional' ? 'lx' : 'cd';
		return `${stop}× · ${intensityForBrightnessStop(stop).toFixed(3)} ${unit}`;
	}
</script>

{#if light !== null}
	<div class="light-fields" data-light-fields>
		<div class="warmth" role="group" aria-label="Warmth">
			{#each LIGHT_WARMTH_TOKENS as token (token.id)}
				<button
					type="button"
					class="warmth-token"
					class:current={light.color.toLowerCase() === token.color}
					aria-pressed={light.color.toLowerCase() === token.color}
					title={token.label}
					onclick={() => setWarmth(token.color)}
				>
					<span class="swatch" style:background={token.color}></span>
					<span>{token.label}</span>
				</button>
			{/each}
			{#if !warmthIsExact(light)}<span class="custom">Custom</span>{/if}
		</div>

		<div class="brightness" role="group" aria-label="Brightness">
			{#each LIGHT_BRIGHTNESS_STOPS as stop (stop)}
				<button
					type="button"
					data-field={`brightness-${stop}`}
					class:current={brightnessStopForIntensity(light.intensity) === stop}
					aria-pressed={brightnessStopForIntensity(light.intensity) === stop}
					title={brightnessTitle(stop, light.light)}
					onclick={() => setBrightness(stop)}
				>{stop}×</button>
			{/each}
			{#if brightnessIsCustom(light)}<span class="custom">Custom</span>{/if}
		</div>

		{#if light.light === 'point'}
			<label class="field">
				<span>Reach</span>
				<input
					type="number"
					data-field="adjust-reach"
					min="0.01"
					step="0.05"
					value={reach}
					placeholder="Unbounded"
					oninput={(event) => (reach = event.currentTarget.value)}
					onkeydown={(event) => exactKey(event, () => commitReach(reach))}
				/>
			</label>
		{/if}

		{#if light.light === 'spot'}
			<label class="field">
				<span>Beam</span>
				<input
					type="number"
					data-field="adjust-beam"
					min="1"
					max="80"
					step="0.5"
					value={beam}
					oninput={(event) => (beam = event.currentTarget.value)}
					onkeydown={(event) => exactKey(event, () => commitBeam(beam))}
				/>
				<em>half-angle · °</em>
			</label>
			{#if roundedDegrees(light.angle) > 80}<span class="custom">Custom · guide caps at 80°</span>{/if}
		{/if}

		<label class="toggle" title="Authored shadow flag. Gate C sets the budget and creation default; new lights start off.">
			<input
				type="checkbox"
				data-field="shadow"
				checked={light.castShadow}
				onchange={(event) => void commit({ castShadow: event.currentTarget.checked })}
			/>
			<span>Cast shadow</span>
		</label>

		{#if detailOpen}
			<div class="exact">
				<p class="label">Exact values</p>
				<label class="field">
					<span>Colour</span>
					<input
						type="text"
						data-field="exact-color"
						value={exactColor}
						spellcheck="false"
						oninput={(event) => (exactColor = event.currentTarget.value)}
						onkeydown={(event) => exactKey(event, commitExactColor)}
						onblur={sync}
					/>
					<em>sRGB</em>
				</label>
				<label class="field">
					<span>Intensity</span>
					<input
						type="number"
						data-field="exact-intensity"
						min="0"
						step="0.001"
						value={exactIntensity}
						oninput={(event) => (exactIntensity = event.currentTarget.value)}
						onkeydown={(event) => exactKey(event, commitExactIntensity)}
						onblur={sync}
					/>
					<em>{light.light === 'directional' ? 'lx' : 'cd'}</em>
				</label>

				{#if light.light !== 'directional'}
					<div class="triplet" role="group" aria-label="Position">
						<span>Position</span>
						<input type="number" data-field="exact-x" step="0.01" aria-label="Position X" value={exactX} oninput={(event) => (exactX = event.currentTarget.value)} onkeydown={(event) => exactKey(event, commitPosition)} onblur={sync} />
						<input type="number" data-field="exact-y" step="0.01" aria-label="Position Y" value={exactY} oninput={(event) => (exactY = event.currentTarget.value)} onkeydown={(event) => exactKey(event, commitPosition)} onblur={sync} />
						<input type="number" data-field="exact-z" step="0.01" aria-label="Position Z" value={exactZ} oninput={(event) => (exactZ = event.currentTarget.value)} onkeydown={(event) => exactKey(event, commitPosition)} onblur={sync} />
					</div>
					<div class="triplet" role="group" aria-label="Aim target">
						<span>Aim</span>
						<input type="number" data-field="aim-x" step="0.01" aria-label="Aim X" value={aimX} oninput={(event) => (aimX = event.currentTarget.value)} onkeydown={(event) => exactKey(event, commitAim)} onblur={sync} />
						<input type="number" data-field="aim-y" step="0.01" aria-label="Aim Y" value={aimY} oninput={(event) => (aimY = event.currentTarget.value)} onkeydown={(event) => exactKey(event, commitAim)} onblur={sync} />
						<input type="number" data-field="aim-z" step="0.01" aria-label="Aim Z" value={aimZ} oninput={(event) => (aimZ = event.currentTarget.value)} onkeydown={(event) => exactKey(event, commitAim)} onblur={sync} />
					</div>
					<label class="field">
						<span>Reach</span>
						<input
							type="number"
							data-field="exact-reach"
							min="0.01"
							step="0.05"
							value={exactRange}
							placeholder="Unbounded"
							oninput={(event) => (exactRange = event.currentTarget.value)}
							onkeydown={(event) => exactKey(event, commitExactRange)}
							onblur={sync}
						/>
						<em>m</em>
					</label>
				{:else}
					<label class="field">
						<span>Azimuth</span>
						<input
							type="number"
							data-field="azimuth"
							step="1"
							value={azimuth}
							oninput={(event) => (azimuth = event.currentTarget.value)}
							onkeydown={(event) => exactKey(event, commitDirection)}
							onblur={sync}
						/>
						<em>°</em>
					</label>
					<label class="field">
						<span>Elevation</span>
						<input
							type="number"
							data-field="elevation"
							min="-90"
							max="90"
							step="1"
							value={elevation}
							oninput={(event) => (elevation = event.currentTarget.value)}
							onkeydown={(event) => exactKey(event, commitDirection)}
							onblur={sync}
						/>
						<em>°</em>
					</label>
				{/if}

				{#if light.light === 'spot'}
					<label class="field">
						<span>Half-angle</span>
						<input
							type="number"
							data-field="exact-half-angle"
							min="0.1"
							max="180"
							step="0.5"
							value={exactHalfAngle}
							oninput={(event) => (exactHalfAngle = event.currentTarget.value)}
							onkeydown={(event) => exactKey(event, commitExactHalfAngle)}
							onblur={sync}
						/>
						<em>°</em>
					</label>
					<label class="field">
						<span>Soft edge</span>
						<input
							type="number"
							data-field="exact-penumbra"
							min="0"
							max="100"
							step="1"
							value={exactPenumbra}
							oninput={(event) => (exactPenumbra = event.currentTarget.value)}
							onkeydown={(event) => exactKey(event, commitExactPenumbra)}
							onblur={sync}
						/>
						<em>%</em>
					</label>
				{/if}
			</div>
		{/if}

		{#if message !== ''}<p class="refusal" role="status">{message}</p>{/if}
		<p class="readout">{formatBrightness(light.intensity, light.light)} · {lightKindLabel(light.light)}</p>
		<p class="readout">Paper draws the guide only; Living draws the light.</p>
		{#if footer}{@render footer()}{/if}
	</div>
{/if}

<style>
	.light-fields {
		display: grid;
		gap: 10px;
	}
	.warmth,
	.brightness {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.warmth-token,
	.brightness button {
		border: 1px solid var(--line, #d8d6ce);
		background: var(--shell-field);
		border-radius: 6px;
		padding: 5px 7px;
		font: inherit;
		cursor: pointer;
	}
	.warmth-token.current,
	.brightness button.current {
		border-color: var(--ink, #24231f);
		box-shadow: inset 0 0 0 1px var(--ink, #24231f);
	}
	.warmth-token {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.swatch {
		width: 13px;
		height: 13px;
		border-radius: 50%;
		border: 1px solid rgb(0 0 0 / 0.18);
	}
	.custom {
		align-self: center;
		color: var(--muted, #716e65);
		font-size: 11px;
		font-style: italic;
	}
	.field {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr) auto;
		align-items: center;
		gap: 6px;
	}
	input[type='number'],
	input[type='text'] {
		min-width: 0;
		width: 100%;
		font: inherit;
	}
	.field em,
	.readout {
		color: var(--muted, #716e65);
		font-size: 11px;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.exact {
		border-top: 1px solid var(--line, #e3e0d8);
		padding-top: 8px;
		display: grid;
		gap: 8px;
	}
	.label {
		margin: 0;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted, #716e65);
	}
	.triplet {
		display: grid;
		grid-template-columns: 72px repeat(3, minmax(0, 1fr));
		gap: 5px;
		align-items: center;
	}
	.refusal {
		color: var(--danger, #a33a2b);
		font-size: 12px;
		margin: 0;
	}
</style>
