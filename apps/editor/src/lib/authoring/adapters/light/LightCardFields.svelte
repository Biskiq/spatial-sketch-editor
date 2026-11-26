<script lang="ts">
	/**
	 * The Light Card.
	 *
	 * Everyday rows: Warmth · Brightness · Reach | Beam · Shadow.
	 * Advanced expands in the same Card, below them, as a registry of groups with
	 * one group open at a time. A group is one 32 px row: name left, current-value
	 * summary right. No group that has no control for the kind is rendered and
	 * there are no disabled placeholders.
	 *
	 * Sliders and the colour dial follow the thumb through the session-only light
	 * preview and commit once, on release. Typed fields commit on Enter and do not
	 * preview; Esc restores and blur writes nothing.
	 */
	import type { Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { stageScene } from '$lib/authoring/stage/stage-adapter-host';
	import { acceptFormCommand } from '../scene/form-card-command';
	import type { SceneLightEntity } from '@portfolio/project-model/scene';
	import {
		brightnessStopForIntensity,
		degreesToRadians,
		LIGHT_BRIGHTNESS_STOPS,
		LIGHT_WARMTH_TOKENS,
		lightKindLabel,
		radiansToDegrees,
		intensityForBrightnessStop
	} from '$lib/authoring/look/light-units';
	import { formatExactIntensity, formatMultiplier } from '$lib/authoring/look/light-presentation';
	import { nearestWarmth, warmthName } from '$lib/authoring/look/light-color';
	import { advancedGroupsFor, type LightAdvancedKind } from './light-advanced';
	import LightAdvancedGroups from './LightAdvancedGroups.svelte';

	let {
		services,
		detailOpen = false,
		footer,
		secondary
	}: {
		services: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet<[string?]>;
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
	let previewLight = $state.raw<Light | null>(null);
	let reach = $state('');
	let beam = $state('');
	let message = $state('');
	let busy = $state(false);

	const datum = $derived(
		services.stage.snapshot().domain.datumMeters
	);
	const shown = $derived.by(() => previewLight ?? light);
	const kind = $derived<LightAdvancedKind | null>(light?.light ?? null);
	const groups = $derived(kind === null ? [] : advancedGroupsFor(kind));
	/** The closed Advanced groups named in the Card foot; values stay in their rows. */
	const footerSummary = $derived(groups.map((group) => group.label).join(' · '));
	$effect(() => {
		void services.stage.selectionState().primary;
		sync();
	});

	function rangeOf(value: Light): number | undefined {
		return 'range' in value ? value.range : undefined;
	}

	function roundedDegrees(radians: number): number {
		return Math.round(radiansToDegrees(radians) * 10) / 10;
	}

	function sync(): void {
		const next = selectedLight();
		light = next;
		previewLight = null;
		if (next === null) return;
		const range = rangeOf(next);
		reach = range === undefined ? '' : range.toFixed(2);
		beam = next.light === 'spot' ? String(roundedDegrees(next.angle)) : '';
	}

	async function commit(update: Record<string, unknown>): Promise<boolean> {
		const current = light;
		if (current === null || busy) return false;
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
			if (outcome.kind === 'refused') {
				message = outcome.message;
				return false;
			}
			sync();
			return true;
		} finally {
			busy = false;
		}
	}

	/** Publish the proposed light for this frame; nothing is written. */
	function preview(update: Record<string, unknown> | null): void {
		const current = light;
		const target = services.stage.lightPreview?.() ?? null;
		if (update === null) {
			previewLight = null;
			if (current !== null) target?.clearOverride(current.id);
			target?.flush();
			return;
		}
		if (current === null) return;
		const next = { ...(previewLight ?? current), ...update } as Light;
		previewLight = next;
		target?.setOverride(current.id, next);
	}

	async function commitPreview(update: Record<string, unknown>): Promise<void> {
		const accepted = await commit(update);
		const current = light;
		const target = services.stage.lightPreview?.() ?? null;
		previewLight = null;
		if (current !== null) target?.clearOverride(current.id);
		target?.flush();
		if (!accepted) sync();
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

	function exactKey(event: KeyboardEvent, run: () => void): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			run();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			preview(null);
			sync();
		}
	}

	function warmthIsExact(value: Light): boolean {
		return LIGHT_WARMTH_TOKENS.some((token) => token.color === value.color.toLowerCase());
	}

	function customWarmthLabel(value: Light): string {
		const reading = nearestWarmth(value.color);
		return reading.exact
			? `${warmthName(reading.w)} white`
			: value.color.toLowerCase() === '#ffffff'
				? 'Neutral white'
				: 'Custom';
	}

	function brightnessIsCustom(value: Light): boolean {
		return brightnessStopForIntensity(value.intensity) === null;
	}

	function brightnessTitle(stop: number): string {
		return `${stop}× · ${intensityForBrightnessStop(stop).toFixed(3)} cd`;
	}

</script>

{#if light !== null && shown !== null}
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
						title={brightnessTitle(stop)}
						onclick={() => setBrightness(stop)}
					>{stop}×</button>
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
			{formatMultiplier(light.intensity)} · {formatExactIntensity(light.intensity)} · {lightKindLabel(light.light)}
		</p>

		{#if kind !== null}
			<LightAdvancedGroups
				{light}
				{shown}
				{kind}
				{groups}
				{datum}
				open={detailOpen}
				onPreview={preview}
				onCommitPreview={commitPreview}
				onSync={sync}
			/>
		{/if}

		{#if footer}{@render footer(detailOpen ? undefined : footerSummary)}{/if}
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
	input[type='number'] {
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
</style>
