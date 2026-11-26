<script lang="ts">
	import type { FinishColourMode, FinishPatchEdit, FinishSource, FinishTreatmentFacts } from '@portfolio/project-model/scene-planning';
	import type { SceneColor, ScenePaletteSlot } from '@portfolio/project-model/scene';
	import type { Recipe } from '@portfolio/project-model/materials';
	import StagePaintWheel from '$lib/authoring/stage/shell/StagePaintWheel.svelte';
	import type { PaintColour } from '$lib/authoring/look/paint-pick';
	import {
		editorColourModeEdits,
		editorColourValueEdits,
		editorMappingKindEdits,
		editorMetalEdits,
		editorPatternEdits,
		editorReliefEdits,
		editorResetGroupEdits,
		editorSheenEdits,
		type EditorFieldGroup,
		type EditorFieldsView
	} from '$lib/authoring/look/finish-editor.svelte';

	const MODE_LABEL: Readonly<Record<FinishColourMode, string>> = {
		natural: 'Natural',
		stained: 'Stained',
		painted: 'Painted'
	};

	let {
		fields,
		source,
		recipes,
		palette,
		facts,
		mode,
		align,
		onAlign,
		fieldRefusal,
		color,
		onCommit,
		onMaterialPreview,
		onCancelPreview,
		wheelOpen = $bindable(),
		localError = $bindable()
	}: {
		fields: EditorFieldsView;
		source: FinishSource;
		recipes: ReadonlyMap<string, Recipe>;
		palette: readonly ScenePaletteSlot[];
		facts: FinishTreatmentFacts;
		mode: 'finish' | 'draft';
		align: { readonly kind: 'wall' | 'floor'; readonly label: string } | null;
		onAlign?: () => void;
		fieldRefusal: { readonly field: string; readonly message: string } | null;
		color: string;
		onCommit: (field: string, edits: readonly FinishPatchEdit[]) => Promise<boolean> | void;
		onMaterialPreview?: (edits: readonly FinishPatchEdit[]) => void;
		onCancelPreview?: () => void;
		wheelOpen: boolean;
		localError: { readonly field: string; readonly message: string } | null;
	} = $props();

	let liveSheen = $state<number | null>(null);
	let liveMetal = $state<number | null>(null);
	let liveRelief = $state<number | null>(null);
	let keyDirtySlider = $state<'sheen' | 'metal' | 'relief' | null>(null);

	const activeError = $derived(localError ?? fieldRefusal);
	const errorFor = (field: string): string | null => (activeError?.field === field ? activeError.message : null);

	const sheenValue = $derived(liveSheen ?? fields.sheen.sliderValue);
	const metalValue = $derived(liveMetal ?? fields.metal.value);
	const reliefValue = $derived(liveRelief ?? fields.relief.value);
	function resetGroup(group: EditorFieldGroup): void {
		if (!fields.changedGroups.includes(group)) return;
		localError = null;
		onCancelPreview?.();
		const edits = editorResetGroupEdits(source, recipes, group, fields.raw.rows);
		if (edits.length > 0) void onCommit(group, edits);
	}

	// ---- Colour
	function chooseColourMode(nextMode: FinishColourMode): void {
		localError = null;
		const edits = editorColourModeEdits(source, recipes, palette, nextMode);
		if (edits.length > 0) void onCommit('colour', edits);
	}

	function previewColour(hex: string): void {
		const edits = editorColourValueEdits(source, recipes, facts, hex.toLowerCase());
		onMaterialPreview?.(edits);
	}

	function commitColour(colour: SceneColor): void {
		localError = null;
		onCancelPreview?.();
		const edits = editorColourValueEdits(source, recipes, facts, colour);
		if (edits.length > 0) void onCommit('colour', edits);
	}

	function useWheelColour(pick: PaintColour): void {
		if (pick.kind === 'slot') commitColour({ slot: pick.slotId });
		else commitColour(pick.hex.toLowerCase());
		wheelOpen = false;
	}

	function commitHexInput(input: HTMLInputElement): void {
		const raw = input.value.trim().toLowerCase();
		const full = /^#[0-9a-f]{3}$/.test(raw) ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}` : raw;
		if (!/^#[0-9a-f]{6}$/.test(full)) {
			localError = { field: 'colour', message: 'Enter a 6-digit hex colour such as #8c7b6b.' };
			input.value = fields.colour.hex ?? '';
			return;
		}
		commitColour(full);
	}

	// ---- Sliders (preview while moving; commit once on release or keyup)
	function onSheenInput(v: number): void {
		liveSheen = v;
		onMaterialPreview?.(editorSheenEdits(source, recipes, facts, v));
	}
	function commitSheen(v: number): void {
		liveSheen = null;
		keyDirtySlider = null;
		onCancelPreview?.();
		const edits = editorSheenEdits(source, recipes, facts, v);
		if (edits.length > 0) void onCommit('sheen', edits);
	}

	function onMetalInput(v: number): void {
		liveMetal = v;
		onMaterialPreview?.(editorMetalEdits(source, recipes, v));
	}
	function commitMetal(v: number): void {
		liveMetal = null;
		keyDirtySlider = null;
		onCancelPreview?.();
		const edits = editorMetalEdits(source, recipes, v);
		if (edits.length > 0) void onCommit('metal', edits);
	}

	function onReliefInput(v: number): void {
		liveRelief = v;
		onMaterialPreview?.(editorReliefEdits(source, recipes, v));
	}
	function commitRelief(v: number): void {
		liveRelief = null;
		keyDirtySlider = null;
		onCancelPreview?.();
		const edits = editorReliefEdits(source, recipes, v);
		if (edits.length > 0) void onCommit('relief', edits);
	}

	function isArrowKey(key: string): boolean {
		return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown' || key === 'Home' || key === 'End' || key === 'PageUp' || key === 'PageDown';
	}

	// ---- Pattern typed numeric fields (Enter/blur commits; Escape reverts without closing)
	function commitPatternField(
		kind: 'tileMeters' | 'angleDeg' | 'offsetX' | 'offsetY',
		input: HTMLInputElement,
		fallback: number
	): void {
		const v = Number.parseFloat(input.value);
		if (!Number.isFinite(v)) {
			localError = { field: 'pattern', message: 'Enter a valid number.' };
			input.value = String(fallback);
			return;
		}
		if (kind === 'tileMeters' && (v < 0.02 || v > 20)) {
			localError = { field: 'pattern', message: 'Pattern size must be between 0.02 m and 20 m.' };
			input.value = String(fallback);
			return;
		}
		localError = null;
		const edits = editorPatternEdits(source, recipes, { [kind]: v });
		if (edits.length > 0) void onCommit('pattern', edits);
	}

	function chooseMapping(kind: 'uv0' | 'uv1' | 'surface'): void {
		localError = null;
		const edits = editorMappingKindEdits(source, recipes, kind);
		if (edits.length > 0) void onCommit('mapping', edits);
	}

</script>

			<section class="eds" aria-labelledby="exact-title">
				<h6 id="exact-title">EXACT FINISH</h6>

				<!-- Colour -->
				<div class="edf" class:changed={fields.colour.changed} data-material-editor-field="colour">
					<button
						type="button"
						class="efl"
						title={fields.colour.changed ? 'Changed — double-click to reset colour' : 'Colour'}
						ondblclick={() => resetGroup('colour')}
					>Colour</button>
					<div class="efv">
						<span class="mseg" role="group" aria-label="Colour mode">
							{#each fields.colour.modes as m (m)}
								<button
									type="button"
									aria-pressed={fields.colour.mode === m}
									data-material-editor-colour-mode={m}
									onclick={() => chooseColourMode(m)}
								>{MODE_LABEL[m]}</button>
							{/each}
						</span>
						<div class="fldrow">
							<button
								type="button"
								class="pchip"
								class:add={fields.colour.mode === 'natural'}
								style={fields.colour.mode === 'natural' ? undefined : `background: ${fields.colour.hex ?? color}`}
								aria-label="Choose a colour"
								title="Colour wheel and palette"
								data-material-editor-wheel
								onclick={() => (wheelOpen = !wheelOpen)}
							>{#if fields.colour.mode === 'natural'}+{/if}</button>
							<input
								class="fld mono"
								value={fields.colour.mode === 'natural' ? '' : (fields.colour.hex ?? '')}
								placeholder="material’s own"
								aria-label="Colour hex"
								disabled={fields.colour.mode === 'natural'}
								data-material-editor-hex
								onkeydown={(event) => {
									if (event.key === 'Enter') event.currentTarget.blur();
									if (event.key === 'Escape') {
										event.stopPropagation();
										event.currentTarget.value = fields.colour.mode === 'natural' ? '' : (fields.colour.hex ?? '');
										event.currentTarget.blur();
									}
								}}
								onchange={(event) => commitHexInput(event.currentTarget)}
							/>
						</div>
						{#if wheelOpen}
							<div class="wheel-pop" data-material-editor-wheel-popover>
								<StagePaintWheel
									title="Finish colour"
									initial={fields.colour.hex ?? '#9aa58c'}
									original={fields.colour.hex}
									palette={fields.colour.palette}
									onChange={previewColour}
									onUse={useWheelColour}
									onClose={() => {
										onCancelPreview?.();
										wheelOpen = false;
									}}
								/>
							</div>
						{/if}
						{#if fields.colour.mode !== 'natural'}
							{#if fields.colour.slotId !== null}
								<span class="note-sm">
									{fields.colour.slotName} · follows the palette
									<button
										type="button"
										class="linkb"
										data-material-editor-unlink
										onclick={() => commitColour(fields.colour.hex ?? '#9aa58c')}
									>Unlink</button>
								</span>
							{:else}
								<span class="note-sm">Not linked to the palette</span>
							{/if}
						{/if}
						{#if errorFor('colour') !== null}<p class="field-err" role="alert">{errorFor('colour')}</p>{/if}
					</div>
				</div>

				<!-- Sheen -->
				<div class="edf" class:changed={fields.sheen.changed} data-material-editor-field="sheen">
					<button
						type="button"
						class="efl"
						title={fields.sheen.changed ? 'Changed — double-click to reset sheen' : 'Sheen'}
						ondblclick={() => resetGroup('sheen')}
					>Sheen</button>
					<div class="efv">
						<div class="slider-wrap">
							{#if fields.sheen.changed}
								<span
									class="omark"
									style:left={`${((fields.sheen.originalMark - fields.sheen.minSlider) / Math.max(0.001, 1 - fields.sheen.minSlider)) * 100}%`}
									aria-hidden="true"
								></span>
							{/if}
							<input
								type="range"
								min={fields.sheen.minSlider}
								max={1}
								step="0.01"
								value={sheenValue}
								aria-label="Sheen"
								data-material-editor-sheen
								oninput={(event) => onSheenInput(Number(event.currentTarget.value))}
								onchange={(event) => {
									if (keyDirtySlider !== 'sheen') commitSheen(Number(event.currentTarget.value));
								}}
								onkeydown={(event) => {
									if (isArrowKey(event.key)) keyDirtySlider = 'sheen';
								}}
								onkeyup={(event) => {
									if (keyDirtySlider === 'sheen' && isArrowKey(event.key)) commitSheen(Number(event.currentTarget.value));
								}}
								ondblclick={() => resetGroup('sheen')}
							/>
						</div>
						{#if fields.sheen.ticks.length > 0}
							<div class="ticks">
								{#each fields.sheen.ticks as tick (tick.label)}
									<span class:active={tick.active}>{tick.label}</span>
								{/each}
							</div>
						{/if}
						<span class="rv mono" data-material-editor-sheen-readout>
							{liveSheen !== null ? `r ${(1 - liveSheen).toFixed(2)}` : fields.sheen.readout}
						</span>
						{#if fields.sheen.caption !== null}
							<span class="note-sm">{fields.sheen.caption}</span>
						{/if}
						{#if errorFor('sheen') !== null}<p class="field-err" role="alert">{errorFor('sheen')}</p>{/if}
					</div>
				</div>

				<!-- Metal -->
				<div class="edf" class:changed={fields.metal.changed} data-material-editor-field="metal">
					<button
						type="button"
						class="efl"
						title={fields.metal.changed ? 'Changed — double-click to reset metal' : 'Metal'}
						ondblclick={() => resetGroup('metal')}
					>Metal</button>
					<div class="efv">
						<div class="slider-wrap">
							{#if fields.metal.changed}
								<span class="omark" style:left={`${fields.metal.original * 100}%`} aria-hidden="true"></span>
							{/if}
							<input
								type="range"
								min="0"
								max="1"
								step="0.01"
								value={metalValue}
								aria-label="Metal"
								data-material-editor-metal
								oninput={(event) => onMetalInput(Number(event.currentTarget.value))}
								onchange={(event) => {
									if (keyDirtySlider !== 'metal') commitMetal(Number(event.currentTarget.value));
								}}
								onkeydown={(event) => {
									if (isArrowKey(event.key)) keyDirtySlider = 'metal';
								}}
								onkeyup={(event) => {
									if (keyDirtySlider === 'metal' && isArrowKey(event.key)) commitMetal(Number(event.currentTarget.value));
								}}
								ondblclick={() => resetGroup('metal')}
							/>
						</div>
						<span class="rv mono">{metalValue.toFixed(2)}</span>
						{#if errorFor('metal') !== null}<p class="field-err" role="alert">{errorFor('metal')}</p>{/if}
					</div>
				</div>

				<!-- Relief -->
				<div class="edf" class:changed={fields.relief.changed} data-material-editor-field="relief">
					<button
						type="button"
						class="efl"
						title={fields.relief.changed ? 'Changed — double-click to reset relief' : 'Relief'}
						ondblclick={() => resetGroup('relief')}
					>Relief</button>
					<div class="efv">
						<div class="slider-wrap">
							{#if fields.relief.changed && !fields.relief.disabled}
								<span class="omark" style:left={`${(fields.relief.original / 2) * 100}%`} aria-hidden="true"></span>
							{/if}
							<input
								type="range"
								min="0"
								max="2"
								step="0.05"
								value={reliefValue}
								disabled={fields.relief.disabled}
								aria-label="Relief strength"
								data-material-editor-relief
								oninput={(event) => onReliefInput(Number(event.currentTarget.value))}
								onchange={(event) => {
									if (keyDirtySlider !== 'relief') commitRelief(Number(event.currentTarget.value));
								}}
								onkeydown={(event) => {
									if (isArrowKey(event.key)) keyDirtySlider = 'relief';
								}}
								onkeyup={(event) => {
									if (keyDirtySlider === 'relief' && isArrowKey(event.key)) commitRelief(Number(event.currentTarget.value));
								}}
								ondblclick={() => resetGroup('relief')}
							/>
						</div>
						<span class="rv mono" data-material-editor-relief-readout>
							{fields.relief.disabled ? 'map off' : `×${reliefValue.toFixed(2)}`}
						</span>
						{#if errorFor('relief') !== null}<p class="field-err" role="alert">{errorFor('relief')}</p>{/if}
					</div>
				</div>

				<!-- Pattern -->
				<div class="edf" class:changed={fields.pattern.changed} data-material-editor-field="pattern">
					<button
						type="button"
						class="efl"
						title={fields.pattern.changed ? 'Changed — double-click to reset pattern' : 'Pattern'}
						ondblclick={() => resetGroup('pattern')}
					>Pattern</button>
					<div class="efv">
						<div class="nums">
							<label class="numf">
								<span>Size</span>
								<input
									class="fld mono"
									inputmode="decimal"
									aria-label="Size"
									value={String(fields.pattern.tileMeters)}
									data-material-editor-tile
									onkeydown={(event) => {
										if (event.key === 'Enter') event.currentTarget.blur();
										if (event.key === 'Escape') {
											event.stopPropagation();
											event.currentTarget.value = String(fields.pattern.tileMeters);
											event.currentTarget.blur();
										}
									}}
									onchange={(event) => commitPatternField('tileMeters', event.currentTarget, fields.pattern.tileMeters)}
								/>
								<em>m</em>
							</label>
							<label class="numf">
								<span>Angle</span>
								<input
									class="fld mono"
									inputmode="decimal"
									aria-label="Angle"
									value={String(fields.pattern.angleDeg)}
									data-material-editor-angle
									onkeydown={(event) => {
										if (event.key === 'Enter') event.currentTarget.blur();
										if (event.key === 'Escape') {
											event.stopPropagation();
											event.currentTarget.value = String(fields.pattern.angleDeg);
											event.currentTarget.blur();
										}
									}}
									onchange={(event) => commitPatternField('angleDeg', event.currentTarget, fields.pattern.angleDeg)}
								/>
								<em>°</em>
							</label>
							<label class="numf">
								<span>Offset →</span>
								<input
									class="fld mono"
									inputmode="decimal"
									aria-label="Offset right"
									value={String(fields.pattern.offsetX)}
									data-material-editor-ox
									onkeydown={(event) => {
										if (event.key === 'Enter') event.currentTarget.blur();
										if (event.key === 'Escape') {
											event.stopPropagation();
											event.currentTarget.value = String(fields.pattern.offsetX);
											event.currentTarget.blur();
										}
									}}
									onchange={(event) => commitPatternField('offsetX', event.currentTarget, fields.pattern.offsetX)}
								/>
								<em>m</em>
							</label>
							<label class="numf">
								<span>Offset ↑</span>
								<input
									class="fld mono"
									inputmode="decimal"
									aria-label="Offset up"
									value={String(fields.pattern.offsetY)}
									data-material-editor-oy
									onkeydown={(event) => {
										if (event.key === 'Enter') event.currentTarget.blur();
										if (event.key === 'Escape') {
											event.stopPropagation();
											event.currentTarget.value = String(fields.pattern.offsetY);
											event.currentTarget.blur();
										}
									}}
									onchange={(event) => commitPatternField('offsetY', event.currentTarget, fields.pattern.offsetY)}
								/>
								<em>m</em>
							</label>
						</div>
						<span class="note-sm">
							{fields.pattern.realCaption}
							{#if mode === 'finish' && align !== null && onAlign}
								· <button type="button" class="linkb" data-material-editor-align onclick={onAlign}>{align.label}</button>
							{/if}
						</span>
						{#if errorFor('pattern') !== null}<p class="field-err" role="alert">{errorFor('pattern')}</p>{/if}
					</div>
				</div>

				<!-- Mapping (last section; Layers omitted per C1) -->
				<div class="edf" class:changed={fields.mapping.changed} data-material-editor-field="mapping">
					<button
						type="button"
						class="efl"
						title={fields.mapping.changed ? 'Changed — double-click to reset mapping' : 'Mapping'}
						ondblclick={() => resetGroup('mapping')}
					>Mapping</button>
					<div class="efv">
						{#if fields.mapping.isModel}
							<span class="mseg" role="group" aria-label="Mapping">
								{#each [['uv0', 'UV set 0'], ['uv1', 'UV set 1'], ['surface', 'Metres']] as const as [val, text] (val)}
									<button
										type="button"
										aria-pressed={fields.mapping.value === val}
										data-material-editor-mapping={val}
										onclick={() => chooseMapping(val)}
									>{text}</button>
								{/each}
							</span>
						{:else}
							<span class="rv">{fields.mapping.readOnlyText}</span>
						{/if}
						{#if errorFor('mapping') !== null}<p class="field-err" role="alert">{errorFor('mapping')}</p>{/if}
					</div>
				</div>
			</section>

<style>

	.edf {
		display: grid;
		grid-template-columns: 62px minmax(0, 1fr);
		gap: 8px;
		align-items: start;
		padding: 5px 0;
		border-bottom: 1px solid var(--shell-hairline);
	}
	.edf:last-child { border-bottom: 0; }
	.efl {
		border: 0;
		padding: 3px 0 0;
		background: transparent;
		text-align: left;
		font: inherit;
		font-size: 11.5px;
		color: var(--shell-ink-2);
		cursor: default;
	}
	.edf.changed .efl {
		color: var(--shell-ink);
		font-weight: 600;
		cursor: pointer;
	}
	.efv { display: grid; gap: 5px; min-width: 0; position: relative; }
	.mseg {
		display: inline-flex;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 999px;
		overflow: hidden;
		justify-self: start;
	}
	.mseg button {
		border: 0;
		border-right: 1px solid var(--shell-hairline);
		background: transparent;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 11px;
		padding: 0 8px;
		min-height: 24px;
		cursor: pointer;
	}
	.mseg button:last-child { border-right: 0; }
	.mseg button[aria-pressed='true'] { background: var(--shell-action); color: var(--shell-on-action); }
	.fldrow { display: flex; align-items: center; gap: 6px; }
	.pchip {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1px solid rgb(0 0 0 / 24%);
		background: transparent;
		color: var(--shell-ink-2);
		display: inline-grid;
		place-items: center;
		cursor: pointer;
		padding: 0;
	}
	.pchip.add { border-style: dashed; }
	.fld {
		height: 24px;
		padding: 0 7px;
		border: 1px solid var(--shell-field-line-strong);
		border-radius: 7px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font-size: 12px;
		min-width: 0;
		flex: 1;
	}
	.fld:disabled { opacity: 0.55; background: var(--shell-surface-sunken); }
	.wheel-pop {
		position: relative;
		z-index: 5;
	}
	.slider-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}
	.slider-wrap input[type='range'] {
		width: 100%;
		margin: 0;
		accent-color: var(--shell-action);
	}
	.omark {
		position: absolute;
		top: 2px;
		bottom: 2px;
		width: 2px;
		background: var(--shell-ink-3);
		opacity: 0.65;
		pointer-events: none;
		border-radius: 1px;
	}
	.ticks {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		color: var(--shell-ink-3);
	}
	.ticks .active { color: var(--shell-ink); font-weight: 600; }
	.rv { font-size: 11.5px; color: var(--shell-ink-2); }
	.nums {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	.numf {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--shell-ink-2);
	}
	.numf span { white-space: nowrap; }
	.numf input { width: 52px; flex: 1; }
	.numf em { font-style: normal; font-size: 10.5px; color: var(--shell-ink-3); }
	.field-err { margin: 0; font-size: 11px; color: var(--shell-refuse); }
	.linkb {
		border: 0;
		padding: 0;
		background: transparent;
		color: var(--shell-ink);
		text-decoration: underline;
		font: inherit;
		font-size: 11.5px;
		cursor: pointer;
	}
	.eds { display: grid; gap: 6px; }
	.eds h6 {
		margin: 0 0 2px;
		font-family: var(--shell-mono);
		font-size: 10px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--shell-ink-2);
		display: flex;
		gap: 6px;
	}
	@media (pointer: coarse) {
		.mseg button { min-height: var(--shell-touch-target); }
	}
</style>
