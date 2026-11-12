<script module lang="ts">
	/** Advanced group choice is session state, remembered per light kind. */
	let rememberedGroup = $state<Record<string, string | null>>({});
</script>

<script lang="ts">
	/**
	 * T2 gallery UX recovery — the Light Card.
	 *
	 * Everyday rows: Warmth · Brightness · Reach | Beam | Direction · Shadow.
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
	import type { SceneLightEntity, Vec3 } from '@portfolio/project-model';
	import ShellIcon from '$lib/authoring/stage/shell/ShellIcon.svelte';
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
	import {
		colourAmount,
		hexToHsv,
		hsvToHex,
		nearestWarmth,
		snapBrightnessSlider,
		warmthColorAt,
		warmthName
	} from '$lib/authoring/look/light-color';
	import { rotationForLightDirection } from '$lib/authoring/look/light-aim';
	import {
		advancedGroupsFor,
		advancedRowsFor,
		advancedSummary,
		type LightAdvancedGroup,
		type LightAdvancedKind,
		type LightAdvancedLight,
		type LightAdvancedRow,
		type LightAdvancedValue
	} from './light-advanced';

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
	let fromField = $state('');
	let heightField = $state('');
	let message = $state('');
	let busy = $state(false);
	let dialActive = $state(false);
	/** Typed-field drafts: Enter commits, Esc and blur restore without writing. */
	let drafts = $state<Record<string, string>>({});

	const datum = $derived(
		services.stage.snapshot().domain.datumMeters
	);
	const shown = $derived.by(() => previewLight ?? light);
	const kind = $derived<LightAdvancedKind | null>(light?.light ?? null);
	const groups = $derived(kind === null ? [] : advancedGroupsFor(kind));
	/** The closed Advanced groups named in the Card foot; values stay in their rows. */
	const footerSummary = $derived(groups.map((group) => group.label).join(' · '));
	const GROUP_ICONS: Readonly<Record<string, string>> = {
		colour: 'lightColour',
		brightness: 'lightBrightness',
		shape: 'lightShape',
		direction: 'direction',
		position: 'lightPosition',
		shadows: 'lightShadows'
	};
	let openGroup = $state<string | null>(null);
	/** The colour group's White/Colour mode is a view choice until a hue is picked. */
	let colourMode = $state<'white' | 'colour' | null>(null);
	const colourIsWhite = $derived.by(() => {
		if (colourMode !== null) return colourMode === 'white';
		const value = shown as LightAdvancedLight | null;
		return value === null ? true : nearestWarmth(value.color).exact;
	});
	const openRows = $derived.by(() => {
		if (kind === null) return [];
		const value = shown as LightAdvancedLight | null;
		const group = groups.find((candidate) => candidate.id === openGroup);
		if (group === undefined || value === null) return [];
		const rows = advancedRowsFor(group, kind);
		if (group.id !== 'colour') return rows;
		// White mode shows the Warmth ramp; Colour mode shows the dial. Neither
		// control is rendered disabled in the other mode.
		return rows.filter((row) =>
			row.id === 'warmth' ? colourIsWhite : row.id === 'colour' ? !colourIsWhite : true
		);
	});

	$effect(() => {
		void services.stage.selectionState().primary;
		sync();
	});

	$effect(() => {
		const current = kind;
		if (current === null) return;
		openGroup = rememberedGroup[current] ?? null;
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
		colourMode = null;
		previewLight = null;
		if (next === null) return;
		const range = rangeOf(next);
		reach = range === undefined ? '' : range.toFixed(2);
		beam = next.light === 'spot' ? String(roundedDegrees(next.angle)) : '';
		const angles = presentationAngles(next.rotation);
		fromField = String(Math.round(angles.from * 10) / 10);
		heightField = String(Math.round(angles.heightInSky * 10) / 10);
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
		void commit({
			rotation: rotationForLightDirection(directionForPresentationAngles(from, height))
		});
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

	function brightnessTitle(stop: number, kindOfLight: Light['light']): string {
		const unit = kindOfLight === 'directional' ? 'lx' : 'cd';
		return `${stop}× · ${intensityForBrightnessStop(stop).toFixed(3)} ${unit}`;
	}

	function toggleGroup(group: LightAdvancedGroup): void {
		const current = kind;
		if (current === null) return;
		openGroup = openGroup === group.id ? null : group.id;
		rememberedGroup = { ...rememberedGroup, [current]: openGroup };
	}

	function draftValue(key: string, fallback: string): string {
		return drafts[key] ?? fallback;
	}

	function setDraft(key: string, value: string): void {
		drafts = { ...drafts, [key]: value };
	}

	function clearDraft(key: string): void {
		if (!(key in drafts)) return;
		const next = { ...drafts };
		delete next[key];
		drafts = next;
	}

	/** The exact field beside a slider reads the authored value, not the slider's s. */
	function fieldReading(row: LightAdvancedRow): number {
		const current = shown as LightAdvancedLight | null;
		if (current === null) return 0;
		if (row.id === 'brightness') return current.intensity;
		return Number(row.read(current, datum));
	}

	function commitField(row: LightAdvancedRow, value: number): void {
		if (!Number.isFinite(value)) return;
		if (row.id === 'brightness') {
			void commitPreview({ intensity: value });
			return;
		}
		writeRow(row, value);
	}

	function fieldHook(row: LightAdvancedRow): string | undefined {
		if (row.id === 'brightness') return 'exact-intensity';
		if (row.id === 'direction-from') return 'azimuth';
		if (row.id === 'direction-height') return 'elevation';
		return undefined;
	}

	function fieldText(row: LightAdvancedRow): string {
		const value = fieldReading(row);
		const step = row.control.kind === 'slider' && row.control.field ? row.control.field.step : 0.001;
		if (row.id === 'brightness') return value.toFixed(3);
		if (step < 1) return String(Number(value.toFixed(3)));
		return String(Math.round(value));
	}

	function readRow(row: LightAdvancedRow): LightAdvancedValue {
		const value = shown as LightAdvancedLight | null;
		return value === null ? null : row.read(value, datum);
	}

	function rowSummary(row: LightAdvancedRow): string {
		const value = shown as LightAdvancedLight | null;
		return value === null ? '' : row.summary(value, datum);
	}

	function writeRow(row: LightAdvancedRow, value: LightAdvancedValue): void {
		const current = light;
		if (current === null) return;
		void commitPreview(row.write(value, current as LightAdvancedLight, datum));
	}

	/* ----- Colour dial -------------------------------------------------- */

	let dialPointerId: number | null = null;

	function dialColour(event: PointerEvent): { hue: number; amount: number } | null {
		const element = event.currentTarget as HTMLElement | null;
		if (element === null) return null;
		const rect = element.getBoundingClientRect();
		const radius = rect.width / 2;
		if (!(radius > 0)) return null;
		const dx = event.clientX - (rect.left + radius);
		const dy = event.clientY - (rect.top + radius);
		const amount = Math.min(1, Math.hypot(dx, dy) / radius);
		const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
		return { hue, amount };
	}

	function dialDown(event: PointerEvent): void {
		if (light === null) return;
		event.preventDefault();
		const read = dialColour(event);
		if (read === null) return;
		dialActive = true;
		dialPointerId = event.pointerId;
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
		preview({ color: hsvToHex(read.hue, read.amount) });
	}

	function dialMove(event: PointerEvent): void {
		if (!dialActive || event.pointerId !== dialPointerId) return;
		const read = dialColour(event);
		if (read === null) return;
		preview({ color: hsvToHex(read.hue, read.amount) });
	}

	function dialUp(event: PointerEvent): void {
		if (!dialActive || event.pointerId !== dialPointerId) return;
		dialActive = false;
		dialPointerId = null;
		const read = dialColour(event);
		if (read === null) {
			preview(null);
			return;
		}
		void commitPreview({ color: hsvToHex(read.hue, read.amount) });
	}

	function dialCancel(): void {
		if (!dialActive) return;
		dialActive = false;
		dialPointerId = null;
		preview(null);
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
						title={brightnessTitle(stop, light.light)}
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
			<div class="advanced" aria-label="Advanced light values">
				{#each groups as group (group.id)}
					<div class="group" data-advanced-group={group.id}>
						<button
							type="button"
							class="group-head"
							aria-expanded={openGroup === group.id}
							data-advanced-group-head={group.id}
							onclick={() => toggleGroup(group)}
						>
							<span class="group-title">
								<span class="group-icon"><ShellIcon name={GROUP_ICONS[group.id] ?? 'dot'} size={14} /></span>
								<span>{group.label}</span>
							</span>
							<span class="summary">{advancedSummary(group, shown as LightAdvancedLight, datum)}</span>
						</button>
						{#if openGroup === group.id}
							<div class="group-body" role="group" aria-label={group.label}>
								{#each openRows as row (row.id)}
									<div class="control-row" data-advanced-row={row.id}>
										<span class="control-label">{row.label}</span>
										{#if row.control.kind === 'mode'}
											<div class="chips">
												<button type="button" class="chip" class:current={colourIsWhite}
													data-advanced-mode="white" aria-pressed={colourIsWhite}
													onclick={() => { colourMode = 'white'; writeRow(row, 'white'); }}>White</button>
												<button type="button" class="chip" class:current={!colourIsWhite}
													data-advanced-mode="colour" aria-pressed={!colourIsWhite}
													onclick={() => { colourMode = 'colour'; }}>Colour</button>
											</div>
										{:else if row.control.kind === 'warmth'}
											{@const value = Number(readRow(row))}
											<div class="ramp-wrap">
												<input
													type="range"
													class="ramp"
													data-advanced-warmth
													min="-100"
													max="100"
													step="1"
													value={value}
													aria-label="Warmth"
																													oninput={(event) => preview({ color: warmthColorAt(Number(event.currentTarget.value)) })}
																onchange={(event) => void commitPreview({ color: warmthColorAt(Number(event.currentTarget.value)) })}
													onkeydown={(event) => { if (event.key === 'Escape') { preview(null); sync(); } }}
												/>
												<div class="ramp-ends"><span>Candle</span><span>Neutral</span><span>Sky</span></div>
												<p class="value-text">{warmthName(value)} · {value}°</p>
											</div>
										{:else if row.control.kind === 'colour'}
											{@const hex = String(readRow(row))}
											{@const hsv = hexToHsv(hex)}
											<div class="colour-wrap">
												<div
													class="dial"
													role="slider"
													tabindex="0"
																														aria-label="Colour hue and amount"
																	aria-valuemin={0}
																	aria-valuemax={359}
																	aria-valuenow={Math.round(hexToHsv(hex).hue)}
																	aria-valuetext={`Hue ${Math.round(hexToHsv(hex).hue)}°, amount ${colourAmount(hex)}%`}
													onpointerdown={dialDown}
													onpointermove={dialMove}
													onpointerup={dialUp}
													onpointercancel={dialCancel}
													onkeydown={(event) => {
														if (event.key === 'Escape') { dialCancel(); return; }
														const hsv = hexToHsv(hex);
														if (event.key === 'ArrowLeft') preview({ color: hsvToHex(hsv.hue - 5, hsv.saturation) });
														else if (event.key === 'ArrowRight') preview({ color: hsvToHex(hsv.hue + 5, hsv.saturation) });
														else if (event.key === 'ArrowUp') preview({ color: hsvToHex(hsv.hue, hsv.saturation + 0.05) });
														else if (event.key === 'ArrowDown') preview({ color: hsvToHex(hsv.hue, hsv.saturation - 0.05) });
													}}
												>
													<span
														class="dial-thumb"
														style:left={`${50 + Math.cos((hsv.hue * Math.PI) / 180) * hsv.saturation * 42}%`}
														style:top={`${50 + Math.sin((hsv.hue * Math.PI) / 180) * hsv.saturation * 42}%`}
													></span>
												</div>
												<div class="colour-side">
													<p class="value-text">Colour amount {colourAmount(hex)}%</p>
													<label class="hex">
														<span>Hex</span>
																																								<input
																											type="text"
																											data-advanced-hex
																											value={hex}
																											spellcheck="false"
																											onkeydown={(event) => exactKey(event, () => writeRow(row, (event.currentTarget as HTMLInputElement).value.trim()))}
																										/>
													</label>
												</div>
											</div>
										{:else if row.control.kind === 'slider'}
											{@const value = Number(readRow(row))}
											{@const control = row.control}
											<div class="slider-wrap">
												<input
													type="range"
													data-advanced-slider={row.id}
													min={control.min}
													max={control.max}
													step={control.step}
													value={value}
													aria-label={row.label}
													oninput={(event) => {
														const next = row.id === 'brightness'
															? snapBrightnessSlider(Number(event.currentTarget.value))
															: Number(event.currentTarget.value);
														preview(control.kind === 'slider' ? row.write(next, light as LightAdvancedLight, datum) : {});
													}}
													onchange={(event) => {
														const next = row.id === 'brightness'
															? snapBrightnessSlider(Number(event.currentTarget.value))
															: Number(event.currentTarget.value);
														writeRow(row, next);
													}}
													onkeydown={(event) => { if (event.key === 'Escape') { preview(null); sync(); } }}
												/>
												{#if control.ends || control.centre}
													<div class="slider-ends">
														<span>{control.ends?.[0] ?? ''}</span>
														{#if control.centre}<span>{control.centre}</span>{/if}
														<span>{control.ends?.[1] ?? ''}</span>
													</div>
												{/if}
												{#if control.field}
													<span class="slider-field">
														<input
															type="number"
															data-advanced-field={row.id}
															data-field={fieldHook(row)}
															min={control.field.min}
															max={control.field.max}
															step={control.field.step}
																																value={draftValue(`${row.id}-field`, fieldText(row))}
															aria-label={`${row.label} exact value`}
															oninput={(event) => setDraft(`${row.id}-field`, event.currentTarget.value)}
																															onblur={() => clearDraft(`${row.id}-field`)}
															onkeydown={(event) => { if (event.key === 'Escape') clearDraft(`${row.id}-field`); exactKey(event, () => {
																const parsed = Number(
																	draftValue(`${row.id}-field`, String(fieldReading(row))).trim()
																);
																clearDraft(`${row.id}-field`);
																commitField(row, parsed);
															})}}
														/>
														<em>{control.unit ?? ''}</em>
													</span>
												{/if}
											</div>
										{:else if row.control.kind === 'toggle'}
											<input
												type="checkbox"
												data-advanced-toggle={row.id}
												checked={Boolean(readRow(row))}
												onchange={(event) => writeRow(row, event.currentTarget.checked)}
											/>
										{:else if row.control.kind === 'triplet'}
											{@const value = readRow(row) as Vec3}
											<div class="triplet">
												{#each row.control.axes as axis, index (axis)}
													<label>
														<span>{axis}</span>
														<input
															type="number"
															step="0.05"
															value={value[index]}
															data-advanced-axis={`${row.id}-${index}`}
															onkeydown={(event) => exactKey(event, () => {
																const inputs = (event.currentTarget as HTMLInputElement)
																	.closest('.triplet')!.querySelectorAll('input');
																const next = [Number(inputs[0]!.value), Number(inputs[1]!.value), Number(inputs[2]!.value)] as Vec3;
																if (!next.every(Number.isFinite)) return;
																writeRow(row, next);
															})}
														/>
													</label>
												{/each}
											</div>
										{/if}
										{#if row.control.kind !== 'toggle' && row.control.kind !== 'triplet'}
											<span class="row-summary">{rowSummary(row)}</span>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
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
	.advanced {
		border-top: 1px solid var(--shell-hairline);
		padding-top: 4px;
		display: grid;
		gap: 2px;
	}
	.group {
		border-bottom: 1px solid var(--shell-hairline);
	}
	.group-title {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.group-icon {
		display: inline-flex;
		color: var(--shell-ink-2);
		flex: none;
	}
	.group-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		height: 32px;
		padding: 0 2px;
		border: 0;
		background: transparent;
		color: var(--shell-ink);
		font: 11px var(--shell-sans);
		cursor: pointer;
	}
	.summary {
		color: var(--shell-ink-2);
		font: 10px var(--shell-mono);
	}
	.group-body {
		display: grid;
		gap: 8px;
		padding: 2px 2px 8px;
	}
	.control-row {
		display: grid;
		grid-template-columns: 92px minmax(0, 1fr) auto;
		align-items: center;
		gap: 6px;
		font-size: 10.5px;
		color: var(--shell-ink-2);
	}
	.control-label {
		color: var(--shell-ink-2);
	}
	.value-text {
		margin: 0;
		color: var(--shell-ink-2);
		font: 10px var(--shell-mono);
	}
	.slider-wrap,
	.ramp-wrap {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.slider-wrap {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
	}
	.slider-ends {
		grid-column: 1 / -1;
		display: flex;
		justify-content: space-between;
		color: var(--shell-ink-2);
		font-size: 9px;
	}
	.slider-field {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}
	.slider-field input {
		width: 54px;
	}
	.ramp {
		width: 100%;
		background: linear-gradient(
			90deg,
			#ffb46b 0%,
			#ffd6a5 25%,
			var(--shell-white) 50%,
			#dbe9ff 75%,
			#b8d0ff 100%
		);
	}
	.ramp-ends {
		display: flex;
		justify-content: space-between;
		color: var(--shell-ink-2);
		font-size: 9px;
	}
	.colour-wrap {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.dial {
		position: relative;
		width: 132px;
		height: 132px;
		flex: none;
		border-radius: 50%;
		background:
			radial-gradient(circle, var(--shell-white) 0%, rgb(255 255 255 / 0) 70%),
			conic-gradient(
				from 90deg,
				#ff0000,
				#ffff00,
				#00ff00,
				#00ffff,
				#0000ff,
				#ff00ff,
				#ff0000
			);
		touch-action: none;
		cursor: crosshair;
		outline: 1px solid var(--shell-field-line);
	}
	.dial-thumb {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 1.5px solid var(--shell-ink);
		background: var(--shell-field);
		transform: translate(-50%, -50%)
			rotate(var(--hue))
			translateX(calc(var(--amount) * 0.6))
			rotate(calc(-1 * var(--hue)));
	}
	.colour-side {
		display: grid;
		gap: 6px;
	}
	.hex {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
	}
	.hex input {
		width: 76px;
	}
	.triplet {
		display: flex;
		gap: 4px;
	}
	.triplet label {
		display: grid;
		gap: 1px;
		font-size: 9px;
	}
	.triplet input {
		width: 58px;
	}
	.row-summary {
		color: var(--shell-ink-2);
		font: 9.5px var(--shell-mono);
	}
</style>
