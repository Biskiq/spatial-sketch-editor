<script lang="ts" module>
	/** Advanced group choice is session state, remembered per light kind. */
	let rememberedGroup = $state<Record<string, string | null>>({});
</script>

<script lang="ts">
	/**
	 * The Light Card's Advanced groups: one 32 px row per group, one group open at
	 * a time, each control a preview that writes once on release. The chosen group
	 * is remembered per light kind for the session; the colour mode is a view
	 * choice until a hue is picked.
	 */
	import type { SceneLightEntity, Vec3 } from '@portfolio/project-model/scene';
	import { ShellIcon } from '$lib/authoring/stage/stage-adapter-host';
	import {
		colourAmount,
		hexToHsv,
		hsvToHex,
		nearestWarmth,
		snapBrightnessSlider,
		warmthColorAt,
		warmthName
	} from '$lib/authoring/look/light-color';
	import {
		advancedRowsFor,
		advancedSummary,
		type LightAdvancedGroup,
		type LightAdvancedKind,
		type LightAdvancedLight,
		type LightAdvancedRow,
		type LightAdvancedValue
	} from './light-advanced';

	type Light = SceneLightEntity;

	let {
		light,
		shown,
		kind,
		groups,
		datum,
		open,
		onPreview,
		onCommitPreview,
		onSync
	}: {
		light: Light;
		shown: Light;
		kind: LightAdvancedKind;
		groups: readonly LightAdvancedGroup[];
		datum: number;
		open: boolean;
		onPreview: (update: Record<string, unknown> | null) => void;
		onCommitPreview: (update: Record<string, unknown>) => Promise<void>;
		onSync: () => void;
	} = $props();

	const GROUP_ICONS: Readonly<Record<string, string>> = {
		colour: 'lightColour',
		brightness: 'lightBrightness',
		shape: 'lightShape',
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
		const current = kind;
		if (current === null) return;
		openGroup = rememberedGroup[current] ?? null;
	});

	$effect(() => {
		void light.id;
		colourMode = null;
	});

	function toggleGroup(group: LightAdvancedGroup): void {
		const current = kind;
		if (current === null) return;
		openGroup = openGroup === group.id ? null : group.id;
		rememberedGroup = { ...rememberedGroup, [current]: openGroup };
	}

	/** Typed-field drafts: Enter commits, Esc and blur restore without writing. */
	let drafts = $state<Record<string, string>>({});

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
			void onCommitPreview({ intensity: value });
			return;
		}
		writeRow(row, value);
	}

	function fieldHook(row: LightAdvancedRow): string | undefined {
		if (row.id === 'brightness') return 'exact-intensity';
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
		void onCommitPreview(row.write(value, light as LightAdvancedLight, datum));
	}

	function exactKey(event: KeyboardEvent, run: () => void): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			run();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			onPreview(null);
			onSync();
		}
	}

	/* ----- Colour dial -------------------------------------------------- */

	let dialPointerId: number | null = null;
	let dialActive = $state(false);

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
		event.preventDefault();
		const read = dialColour(event);
		if (read === null) return;
		dialActive = true;
		dialPointerId = event.pointerId;
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
		onPreview({ color: hsvToHex(read.hue, read.amount) });
	}

	function dialMove(event: PointerEvent): void {
		if (!dialActive || event.pointerId !== dialPointerId) return;
		const read = dialColour(event);
		if (read === null) return;
		onPreview({ color: hsvToHex(read.hue, read.amount) });
	}

	function dialUp(event: PointerEvent): void {
		if (!dialActive || event.pointerId !== dialPointerId) return;
		dialActive = false;
		dialPointerId = null;
		const read = dialColour(event);
		if (read === null) {
			onPreview(null);
			return;
		}
		void onCommitPreview({ color: hsvToHex(read.hue, read.amount) });
	}

	function dialCancel(): void {
		if (!dialActive) return;
		dialActive = false;
		dialPointerId = null;
		onPreview(null);
	}
</script>

		{#if open}
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
																													oninput={(event) => onPreview({ color: warmthColorAt(Number(event.currentTarget.value)) })}
																onchange={(event) => void onCommitPreview({ color: warmthColorAt(Number(event.currentTarget.value)) })}
													onkeydown={(event) => { if (event.key === 'Escape') { onPreview(null); onSync(); } }}
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
														if (event.key === 'ArrowLeft') onPreview({ color: hsvToHex(hsv.hue - 5, hsv.saturation) });
														else if (event.key === 'ArrowRight') onPreview({ color: hsvToHex(hsv.hue + 5, hsv.saturation) });
														else if (event.key === 'ArrowUp') onPreview({ color: hsvToHex(hsv.hue, hsv.saturation + 0.05) });
														else if (event.key === 'ArrowDown') onPreview({ color: hsvToHex(hsv.hue, hsv.saturation - 0.05) });
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
														onPreview(control.kind === 'slider' ? row.write(next, light as LightAdvancedLight, datum) : {});
													}}
													onchange={(event) => {
														const next = row.id === 'brightness'
															? snapBrightnessSlider(Number(event.currentTarget.value))
															: Number(event.currentTarget.value);
														writeRow(row, next);
													}}
													onkeydown={(event) => { if (event.key === 'Escape') { onPreview(null); onSync(); } }}
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


<style>
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
	input[type='number'],
	input[type='text'] {
		width: 72px;
		min-width: 0;
		font: 11px var(--shell-mono);
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
