<script lang="ts">
	/**
	 * T2.S3 — the Card's one light writer.
	 *
	 * Warmth is an sRGB token, Brightness is one of Gate A's five stops, Reach is
	 * the authored cutoff and Beam is a half-angle in degrees. Exact values stay
	 * under More so the ordinary Card remains five controls. Every commit is the
	 * same `update-light` planner the marks submit.
	 */
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
		radiansToDegrees,
		intensityForBrightnessStop
	} from '$lib/authoring/look/light-units';
	import { lightForward, LIGHT_AIM_GUIDE_METERS, rotationForLightDirection } from '$lib/authoring/look/light-aim';

	let {
		services,
		detailOpen = false
	}: {
		services: StageAdapterServices;
		detailOpen?: boolean;
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
	let exactIntensity = $state('');
	let exactX = $state('');
	let exactY = $state('');
	let exactZ = $state('');
	let aimX = $state('');
	let aimY = $state('');
	let aimZ = $state('');
	let message = $state('');
	let busy = $state(false);

	function rangeOf(value: Light): number | undefined {
		return 'range' in value ? value.range : undefined;
	}

	function sync(): void {
		const next = selectedLight();
		light = next;
		if (next === null) return;
		const range = rangeOf(next);
		reach = range === undefined ? '' : String(range);
		beam = next.light === 'spot' ? String(Math.round(radiansToDegrees(next.angle) * 10) / 10) : '';
		exactIntensity = String(next.intensity);
		exactX = String(next.position[0]);
		exactY = String(next.position[1]);
		exactZ = String(next.position[2]);
		const target = [
			next.position[0] + lightForward(next.rotation)[0] * LIGHT_AIM_GUIDE_METERS,
			next.position[1] + lightForward(next.rotation)[1] * LIGHT_AIM_GUIDE_METERS,
			next.position[2] + lightForward(next.rotation)[2] * LIGHT_AIM_GUIDE_METERS
		];
		aimX = String(Math.round(target[0] * 100) / 100);
		aimY = String(Math.round(target[1] * 100) / 100);
		aimZ = String(Math.round(target[2] * 100) / 100);
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

	function commitReach(): void {
		if (light === null) return;
		const trimmed = reach.trim();
		void commit({ range: trimmed === '' ? null : Number(trimmed) });
	}

	function commitBeam(): void {
		if (light === null || light.light !== 'spot') return;
		const degrees = Number(beam);
		if (!Number.isFinite(degrees)) return;
		void commit({ angle: degreesToRadians(degrees) });
	}

	function commitPosition(): void {
		const position: Vec3 = [Number(exactX), Number(exactY), Number(exactZ)];
		if (position.every(Number.isFinite)) void commit({ position });
	}

	function commitAim(): void {
		if (light === null) return;
		const target: Vec3 = [Number(aimX), Number(aimY), Number(aimZ)];
		if (!target.every(Number.isFinite)) return;
		const direction = [
			target[0] - light.position[0],
			target[1] - light.position[1],
			target[2] - light.position[2]
		] as Vec3;
		void commit({ rotation: rotationForLightDirection(direction) });
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
		</div>

		<div class="brightness" role="group" aria-label="Brightness">
			{#each LIGHT_BRIGHTNESS_STOPS as stop (stop)}
				<button
					type="button"
					class:current={brightnessStopForIntensity(light.intensity) === stop}
					aria-pressed={brightnessStopForIntensity(light.intensity) === stop}
					title={`${stop}× · ${intensityForBrightnessStop(stop).toFixed(3)} cd`}
					onclick={() => setBrightness(stop)}
				>{stop}×</button>
			{/each}
		</div>

		<label class="field">
			<span>Reach</span>
			<input
				type="number"
				min="0.01"
				step="0.05"
				value={reach}
				placeholder="Unbounded"
				oninput={(event) => (reach = event.currentTarget.value)}
				onchange={commitReach}
				onblur={commitReach}
			/>
		</label>

		{#if light.light === 'spot'}
			<label class="field">
				<span>Beam</span>
				<input
					type="number"
					min="0.1"
					max="180"
					step="0.5"
					value={beam}
					oninput={(event) => (beam = event.currentTarget.value)}
					onchange={commitBeam}
					onblur={commitBeam}
				/>
				<em>half-angle · °</em>
			</label>
		{/if}

		<label class="toggle" title="Shadow budgets wait for S0 Gate C; new lights are created with shadows off.">
			<input type="checkbox" checked={light.castShadow} disabled />
			<span>Cast shadow</span>
			<em>After Gate C</em>
		</label>

		{#if detailOpen}
			<div class="exact">
				<p class="label">Exact values</p>
				<label class="field">
					<span>Intensity</span>
					<input
						type="number"
						min="0"
						step="0.001"
						value={exactIntensity}
						oninput={(event) => (exactIntensity = event.currentTarget.value)}
						onchange={() => void commit({ intensity: Number(exactIntensity) })}
						onblur={() => void commit({ intensity: Number(exactIntensity) })}
					/>
					<em>cd</em>
				</label>
				<div class="triplet" role="group" aria-label="Position">
					<span>Position</span>
					<input type="number" step="0.01" value={exactX} oninput={(event) => (exactX = event.currentTarget.value)} onchange={commitPosition} />
					<input type="number" step="0.01" value={exactY} oninput={(event) => (exactY = event.currentTarget.value)} onchange={commitPosition} />
					<input type="number" step="0.01" value={exactZ} oninput={(event) => (exactZ = event.currentTarget.value)} onchange={commitPosition} />
				</div>
				<div class="triplet" role="group" aria-label="Aim target">
					<span>Aim</span>
					<input type="number" step="0.01" value={aimX} oninput={(event) => (aimX = event.currentTarget.value)} onchange={commitAim} />
					<input type="number" step="0.01" value={aimY} oninput={(event) => (aimY = event.currentTarget.value)} onchange={commitAim} />
					<input type="number" step="0.01" value={aimZ} oninput={(event) => (aimZ = event.currentTarget.value)} onchange={commitAim} />
				</div>
			</div>
		{/if}

		{#if message !== ''}<p class="refusal" role="status">{message}</p>{/if}
		<p class="readout">{formatBrightness(light.intensity, light.light)} · {light.light === 'spot' ? `${radiansToDegrees(light.angle).toFixed(1)}°` : 'point'}</p>
		<p class="readout">Paper draws the guide only; Living draws the light.</p>
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
	.field {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr) auto;
		align-items: center;
		gap: 6px;
	}
	input[type='number'] {
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
