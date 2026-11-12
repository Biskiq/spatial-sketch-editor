<script lang="ts">
	/**
	 * T2 gallery UX recovery — the Light Card's everyday rows.
	 *
	 * Four labelled rows per kind, in the approved order: Warmth · Brightness ·
	 * Reach | Beam | Direction · Shadow. Warmth and Brightness are chips with a
	 * read-only off-stop value; Reach has an Unlimited chip; a Spot's Beam field
	 * accepts 1…90° and says when the guide cannot draw the stored beam; a
	 * Directional gets From and Height in sky, which are always available
	 * whatever the view shows.
	 *
	 * Every explicit commit is the same `update-light` planner the marks submit.
	 * Exact fields commit on Enter only; Esc restores and blur writes nothing.
	 */
	import type { Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { stageScene } from '$lib/authoring/stage/stage-adapter-host';
	import type { SceneLightEntity, Vec3 } from '@portfolio/project-model';
	import { acceptFormCommand } from '../scene/form-card-command';
	import {
		brightnessStopForIntensity,
		degreesToRadians,
		LIGHT_BRIGHTNESS_STOPS,
		LIGHT_WARMTH_TOKENS,
		lightKindLabel,
		radiansToDegrees,
		intensityForBrightnessStop
	} from '$lib/authoring/look/light-units';
	import {
		directionForPresentationAngles,
		formatExactIntensity,
		formatMultiplier,
		presentationAngles
	} from '$lib/authoring/look/light-presentation';
	import { lightForward, rotationForLightDirection } from '$lib/authoring/look/light-aim';

	let {
		services,
		detailOpen = false,
		footer,
		secondary
	}: {
		services: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet;
		secondary?: Snippet<[Snippet?]>;
		more?: Snippet<[Snippet?]>;
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

	let light = $state.raw<Light | null>(null);
	let reach = $state('');
	let beam = $state('');
	let fromField = $state('');
	let heightField = $state('');
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
		reach = range === undefined ? '' : range.toFixed(2);
		beam = next.light === 'spot' ? String(roundedDegrees(next.angle)) : '';
		const angles = presentationAngles(next.rotation);
		fromField = String(Math.round(angles.from * 10) / 10);
		heightField = String(Math.round(angles.heightInSky * 10) / 10);
		exactColor = next.color;
		exactIntensity = next.intensity.toFixed(3);
		exactRange = range === undefined ? '' : range.toFixed(2);
		exactHalfAngle = next.light === 'spot' ? String(roundedDegrees(next.angle)) : '';
		exactPenumbra =
			next.light === 'spot' ? String(Math.round((next.penumbra ?? 0) * 1000) / 10) : '';
		exactX = next.position[0].toFixed(2);
		exactY = next.position[1].toFixed(2);
		exactZ = next.position[2].toFixed(2);
		const forward = lightForward(next.rotation);
		const target = [
			next.position[0] + forward[0] * 3,
			next.position[1] + forward[1] * 3,
			next.position[2] + forward[2] * 3
		];
		aimX = target[0]!.toFixed(2);
		aimY = target[1]!.toFixed(2);
		aimZ = target[2]!.toFixed(2);
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
		if (light?.color.toLowerCase() === color) return;
		void commit({ color });
	}

	function setBrightness(stop: number): void {
		const intensity = intensityForBrightnessStop(stop);
		if (light !== null && Math.abs(light.intensity - intensity) < 1e-9) return;
		void commit({ intensity });
	}

	function setUnlimited(): void {
		if (light === null || rangeOf(light) === undefined) return;
		void commit({ range: null });
	}

	function commitReach(value: string): void {
		if (light === null) return;
		const trimmed = value.trim();
		if (trimmed === '') {
			// Enter on an unchanged empty field is a no-op, never an implicit clear.
			if (rangeOf(light) === undefined) return;
			void commit({ range: null });
			return;
		}
		const number = Number(trimmed);
		if (!Number.isFinite(number) || number < 0.1) {
			message = 'Reach must be at least 0.1 m.';
			return;
		}
		if (rangeOf(light) !== undefined && Math.abs(rangeOf(light)! - number) < 1e-9) return;
		void commit({ range: number });
	}

	function commitBeam(value: string): void {
		if (light === null || light.light !== 'spot') return;
		const degrees = Number(value.trim());
		if (!Number.isFinite(degrees) || degrees < 1 || degrees > 90) {
			message = 'Beam must be between 1° and 90°.';
			return;
		}
		const radians = degreesToRadians(degrees);
		if (Math.abs(light.angle - radians) < 1e-9) return;
		void commit({ angle: radians });
	}

	function commitDirection(): void {
		const from = Number(fromField.trim());
		const height = Number(heightField.trim());
		if (
			!Number.isFinite(from) ||
			!Number.isFinite(height) ||
			from < 0 ||
			from > 359 ||
			height < 0 ||
			height > 90
		) {
			message = 'From is 0…359° and Height is 0…90°.';
			return;
		}
		const rotation = rotationForLightDirection(directionForPresentationAngles(from, height));
		void commit({ rotation });
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
		if (light === null || light.light !== 'spot') return;
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
		// The numeric Aim point controls direction only; it is never a stored target.
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
		return LIGHT_WARMTH_TOKENS.some((token) => token.color === value.color.toLowerCase());
	}

	function customWarmthLabel(value: Light): string {
		return value.color.toLowerCase() === '#ffffff' ? 'Neutral white' : 'Custom';
	}

	function brightnessIsCustom(value: Light): boolean {
		return brightnessStopForIntensity(value.intensity) === null;
	}

	function brightnessTitle(stop: number, kind: Light['light']): string {
		const unit = kind === 'directional' ? 'lx' : 'cd';
		return `${stop}× · ${intensityForBrightnessStop(stop).toFixed(3)} ${unit}`;
	}

	function stopLabel(stop: number): string {
		return `${stop}×`;
	}
</script>

{#if light !== null}
	<div class="light-fields" data-light-fields>
		<p class="kind">{lightKindLabel(light.light)}</p>

		<div class="row" role="group" aria-label="Warmth">
			<span class="label">Warmth</span>
			<div class="chips">
				{#each LIGHT_WARMTH_TOKENS as token (token.id)}
					<button
						type="button"
						class="chip warmth-token"
						class:current={light.color.toLowerCase() === token.color}
						aria-pressed={light.color.toLowerCase() === token.color}
						title={token.label}
						onclick={() => setWarmth(token.color)}
					>
						<span class="swatch" style:background={token.color}></span>
						<span>{token.label}</span>
					</button>
				{/each}
				{#if !warmthIsExact(light)}
					<span class="chip readonly" data-field="warmth-custom">{customWarmthLabel(light)}</span>
				{/if}
			</div>
		</div>

		<div class="row" role="group" aria-label="Brightness">
			<span class="label">Brightness</span>
			<div class="chips">
				{#each LIGHT_BRIGHTNESS_STOPS as stop (stop)}
					<button
						type="button"
						class="chip"
						data-field={`brightness-${stop}`}
						class:current={brightnessStopForIntensity(light.intensity) === stop}
						aria-pressed={brightnessStopForIntensity(light.intensity) === stop}
						title={brightnessTitle(stop, light.light)}
						onclick={() => setBrightness(stop)}
					>{stopLabel(stop)}</button>
				{/each}
				{#if brightnessIsCustom(light)}
					<span class="chip readonly" data-field="brightness-custom">{formatMultiplier(light.intensity)}</span>
				{/if}
			</div>
		</div>

		{#if light.light === 'point'}
			<div class="row">
				<span class="label">Reach</span>
				<div class="chips">
					<button
						type="button"
						class="chip"
						data-field="unlimited"
						class:current={rangeOf(light) === undefined}
						aria-pressed={rangeOf(light) === undefined}
						onclick={setUnlimited}
					>Unlimited</button>
					<input
						type="number"
						data-field="adjust-reach"
						min="0.1"
						step="0.05"
						value={reach}
						placeholder="—"
						aria-label="Reach in metres"
						oninput={(event) => (reach = event.currentTarget.value)}
						onkeydown={(event) => exactKey(event, () => commitReach(reach))}
					/>
					<em>m</em>
				</div>
			</div>
		{/if}

		{#if light.light === 'spot'}
			<div class="row">
				<span class="label">Beam</span>
				<div class="chips">
					<input
						type="number"
						data-field="adjust-beam"
						min="1"
						max="90"
						step="0.5"
						value={beam}
						aria-label="Beam width in degrees"
						oninput={(event) => (beam = event.currentTarget.value)}
						onkeydown={(event) => exactKey(event, () => commitBeam(beam))}
					/>
					<em>°</em>
				</div>
				{#if roundedDegrees(light.angle) > 80}
					<span class="note">Wider than the guide can draw</span>
				{/if}
			</div>
		{/if}

		{#if light.light === 'directional'}
			<div class="row direction">
				<span class="label">Direction</span>
				<div class="pair">
					<label>
						<span>From</span>
						<input
							type="number"
							data-field="direction-from"
							min="0"
							max="359"
							step="1"
							value={fromField}
							oninput={(event) => (fromField = event.currentTarget.value)}
							onkeydown={(event) => exactKey(event, commitDirection)}
						/>
						<em>°</em>
					</label>
					<label>
						<span>Height</span>
						<input
							type="number"
							data-field="direction-height"
							min="0"
							max="90"
							step="1"
							value={heightField}
							oninput={(event) => (heightField = event.currentTarget.value)}
							onkeydown={(event) => exactKey(event, commitDirection)}
						/>
						<em>°</em>
					</label>
				</div>
			</div>
		{/if}

		<label class="row toggle">
			<span class="label">Shadow</span>
			<span class="chips">
				<input
					type="checkbox"
					data-field="shadow"
					checked={light.castShadow}
					onchange={(event) => void commit({ castShadow: event.currentTarget.checked })}
				/>
				<span>Cast shadows</span>
			</span>
		</label>

		{#if message !== ''}<p class="refusal" role="status">{message}</p>{/if}
		<p class="readout">
			{formatMultiplier(light.intensity)} · {formatExactIntensity(light.intensity, light.light)} · {lightKindLabel(light.light)}
		</p>

		{#if detailOpen}
		<div class="exact" aria-label="Advanced light values">
			<p class="section-label">Advanced</p>
			<div class="field-grid">
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
					{#if light.light === 'spot'}
						<div class="triplet" role="group" aria-label="Aim target">
							<span>Aim</span>
							<input type="number" data-field="aim-x" step="0.01" aria-label="Aim X" value={aimX} oninput={(event) => (aimX = event.currentTarget.value)} onkeydown={(event) => exactKey(event, commitAim)} onblur={sync} />
							<input type="number" data-field="aim-y" step="0.01" aria-label="Aim Y" value={aimY} oninput={(event) => (aimY = event.currentTarget.value)} onkeydown={(event) => exactKey(event, commitAim)} onblur={sync} />
							<input type="number" data-field="aim-z" step="0.01" aria-label="Aim Z" value={aimZ} oninput={(event) => (aimZ = event.currentTarget.value)} onkeydown={(event) => exactKey(event, commitAim)} onblur={sync} />
						</div>
					{/if}
					<label class="field">
						<span>Reach</span>
						<input
							type="number"
							data-field="exact-reach"
							min="0.1"
							step="0.05"
							value={exactRange}
							placeholder="Unlimited"
							oninput={(event) => (exactRange = event.currentTarget.value)}
							onkeydown={(event) => exactKey(event, commitExactRange)}
							onblur={sync}
						/>
						<em>m</em>
					</label>
				{:else}
					<label class="field">
						<span>From</span>
						<input
							type="number"
							data-field="azimuth"
							min="0"
							max="359"
							step="1"
							value={fromField}
							oninput={(event) => (fromField = event.currentTarget.value)}
							onkeydown={(event) => exactKey(event, commitDirection)}
							onblur={sync}
						/>
						<em>°</em>
					</label>
					<label class="field">
						<span>Height in sky</span>
						<input
							type="number"
							data-field="elevation"
							min="0"
							max="90"
							step="1"
							value={heightField}
							oninput={(event) => (heightField = event.currentTarget.value)}
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
		</div>
		{/if}

		{#if footer}{@render footer()}{/if}
		{#if secondary}{@render secondary()}{/if}
	</div>
{/if}

<style>
	.light-fields {
		display: grid;
		gap: 8px;
	}
	.kind {
		margin: 0;
		color: var(--shell-ink-2);
		font: 10.5px var(--shell-mono);
	}
	.row {
		display: grid;
		grid-template-columns: 74px minmax(0, 1fr);
		align-items: center;
		gap: 6px;
	}
	.row.toggle {
		grid-template-columns: 74px minmax(0, 1fr);
	}
	.label {
		color: var(--shell-ink-2);
		font-size: 10.5px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}
	.chip {
		border: 1px solid var(--shell-field-line);
		background: var(--shell-field);
		color: var(--shell-ink);
		border-radius: 6px;
		padding: 4px 7px;
		font: 11px var(--shell-mono);
		cursor: pointer;
	}
	.chip.current {
		border-color: var(--shell-ink);
		box-shadow: inset 0 0 0 1px var(--shell-ink);
	}
	.chip.readonly {
		border-style: dashed;
		cursor: default;
		color: var(--shell-ink-2);
	}
	.warmth-token {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.swatch {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 1px solid rgb(0 0 0 / 0.18);
	}
	input[type='number'],
	input[type='text'] {
		width: 72px;
		min-width: 0;
		font: 11px var(--shell-mono);
	}
	.chips em,
	.readout,
	.note {
		color: var(--shell-ink-2);
		font-size: 10px;
		font-style: normal;
	}
	.note {
		grid-column: 2;
	}
	.pair {
		display: flex;
		gap: 8px;
	}
	.pair label {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--shell-ink-2);
		font-size: 10px;
	}
	.pair input {
		width: 56px;
	}
	.toggle .chips {
		gap: 6px;
		font-size: 11px;
	}
	.refusal {
		color: var(--shell-caution);
		font-size: 11px;
		margin: 0;
	}
	.readout {
		margin: 0;
	}
	.exact {
		border-top: 1px solid var(--shell-hairline);
		padding-top: 8px;
		display: grid;
		gap: 8px;
	}
	.section-label {
		margin: 0;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--shell-ink-2);
	}
	.field-grid {
		display: grid;
		gap: 7px;
	}
	.field {
		display: grid;
		grid-template-columns: 92px minmax(0, 1fr) auto;
		align-items: center;
		gap: 6px;
		font-size: 10.5px;
		color: var(--shell-ink-2);
	}
	.triplet {
		display: grid;
		grid-template-columns: 92px repeat(3, minmax(0, 1fr));
		gap: 5px;
		align-items: center;
		font-size: 10.5px;
		color: var(--shell-ink-2);
	}
	.field input,
	.triplet input {
		width: 100%;
	}
</style>
