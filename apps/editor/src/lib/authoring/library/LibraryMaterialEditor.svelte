<script lang="ts">
	/**
	 * The Material editor for a Library *Customise…* draft (T2.S8 U5, D9).
	 *
	 * One responsive surface beside the Stage: a wide panel in the Card lane, a
	 * bottom sheet above the dock in portrait. It holds a local draft only. The
	 * draft previews on its own target (a Stage click moves the cobalt
	 * proposal), never on the canonical selection, and nothing is written until
	 * *Apply to…*, which is one operation and one Undo.
	 *
	 * Every approved field keeps its place. A field the adapter cannot yet
	 * preview and apply as part of the whole draft shows its real value, a
	 * disabled control and a short reason; U6 connects them here.
	 */
	import { onMount } from 'svelte';
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import FinishInspectionView from './FinishInspectionView.svelte';
	import { LIBRARY_INSPECTION_DEFAULT, type LibraryInspectionSettings } from './library-inspection';
	import type { LibraryFinishEntry } from './library-catalogue';
	import type { LibraryDraft } from './library-draft';

	type Status = {
		readonly canApply: boolean;
		readonly changed: boolean;
		readonly targetLabel: string | null;
		readonly reason: string | null;
		readonly canPaint: boolean;
		readonly paintReason: string | null;
	};

	let {
		draft,
		entry,
		status,
		busy = false,
		previewing,
		tileSource,
		draftSource,
		draftReason,
		inspection = LIBRARY_INSPECTION_DEFAULT,
		onInspection = () => {},
		onStep,
		onReset,
		onApply,
		onPaint,
		onCancel
	}: {
		draft: LibraryDraft;
		entry: LibraryFinishEntry | null;
		status: Status;
		busy?: boolean;
		/** Whether the render-only Finish projection shows the draft on the Stage now. */
		previewing: boolean;
		tileSource: FinishTileSource | null;
		/** The draft's own render subject; null when the sheen is unchanged or cannot be drawn. */
		draftSource: FinishTileSource | null;
		/** Why no draft render exists while the sheen is changed; null otherwise. */
		draftReason: string | null;
		/** Geometry and lighting, shared with Library detail for the session. */
		inspection?: LibraryInspectionSettings;
		onInspection?: (next: LibraryInspectionSettings) => void;
		onStep: (step: LibraryDraft['step']) => void;
		onReset: () => void;
		onApply: () => Promise<boolean>;
		onPaint: () => void;
		onCancel: () => void;
	} = $props();

	const U6 = 'Arrives with the full Material editor (U6).';

	let applying = $state(false);
	let compare = $state(false);
	let closeButton = $state<HTMLButtonElement>();

	const original = $derived(draft.reading.current ?? draft.reading.original);
	const stepLabel = (id: string | null): string =>
		id === null ? 'Custom' : (draft.reading.steps.find((step) => step.id === id)?.label ?? id);
	const sheenChanged = $derived(status.changed);
	const changeCount = $derived(sheenChanged ? 1 : 0);
	const targetLine = $derived(status.targetLabel);

	onMount(() => closeButton?.focus());

	// Compare switches between two real renders: the original Finish and the draft.
	const canCompare = $derived(sheenChanged && draftSource !== null);
	const showingOriginal = $derived(!canCompare || compare);
	const compareNote = $derived.by((): string => {
		if (!sheenChanged) return 'Change the sheen to compare the draft with the original.';
		if (draftSource === null) return `Showing the original: ${draftReason ?? 'this draft cannot be drawn here.'} Compare is unavailable.`;
		return compare ? 'Showing the original Finish.' : 'Showing the draft; switch to see the original.';
	});
	$effect(() => {
		if (!canCompare) compare = false;
	});

	async function apply(): Promise<void> {
		if (applying || busy || !status.canApply) return;
		applying = true;
		try {
			await onApply();
		} finally {
			applying = false;
		}
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		onCancel();
	}
</script>

<div
	class="editor"
	role="dialog"
	tabindex="-1"
	aria-modal="false"
	aria-labelledby="material-editor-title"
	data-material-editor
	onkeydown={onKeydown}
>
	<header class="head">
		<span class="chip" title="Nothing is written until you apply">Draft</span>
		<div class="title">
			<span class="eyebrow">Material editor</span>
			<h2 id="material-editor-title">{draft.name}</h2>
		</div>
		<button type="button" class="x" bind:this={closeButton} aria-label="Cancel draft and close" title="Cancel · nothing written (Esc)" data-material-editor-close onclick={onCancel}>×</button>
	</header>

	<div class="strip" data-material-editor-status>
		<span class="note">
			Draft · from {draft.baseLabel}{changeCount > 0 ? ` · ${changeCount} change` : ''} · nothing is written yet
			{#if sheenChanged}· <button type="button" class="linkb" data-material-editor-reset-all onclick={onReset}>Reset all</button>{/if}
		</span>
		<span class="target" data-material-editor-target>
			{#if targetLine === null}
				Click a surface or object on the Stage to preview it there
			{:else}
				Previewing on <strong>{targetLine}</strong> · click another surface to move it
			{/if}
		</span>
		{#if targetLine !== null && !previewing}
			<span class="warn" data-material-editor-preview-note>
				{status.changed ? 'The Stage cannot show this draft here yet; the inspection below still reads it.' : `${targetLine} already wears ${draft.name}.`}
			</span>
		{/if}
	</div>

	<div class="grid">
		<div class="left">
			<FinishInspectionView
				source={showingOriginal ? tileSource : draftSource}
				color={entry?.color ?? '#999999'}
				imageUri={entry?.imageUri ?? null}
				label={draft.name}
				caption={showingOriginal ? 'Original' : 'Draft'}
				materialKey={draft.finishKey}
				settings={inspection}
				onSettings={onInspection}
			/>
			<label class="switch-row">
				<button
					type="button"
					class="switch"
					role="switch"
					aria-checked={canCompare && compare}
					aria-label="Compare with original"
					aria-describedby="material-editor-compare-note"
					disabled={!canCompare}
					data-material-editor-compare
					onclick={() => (compare = !compare)}
				></button>
				Compare with original
			</label>
			<p class="note" id="material-editor-compare-note" data-material-editor-compare-note>{compareNote}</p>
		</div>

		<div class="right">
			<section class="sec" aria-labelledby="raw-title">
				<h3 id="raw-title">Raw material <span class="hint">{draft.baseLabel}</span></h3>
				<div class="map" class:off={entry !== null && !entry.hasColourImage}>
					<span class="map-name">Colour</span>
					<span class="map-meta">{entry === null ? '—' : entry.hasColourImage ? 'captured image' : 'no colour image · plain material'}</span>
					<button type="button" class="switch" role="switch" aria-checked={entry?.hasColourImage ?? false} aria-label="Use the colour map" disabled title={U6}></button>
				</div>
				<div class="map">
					<span class="map-name">Relief</span>
					<span class="map-meta">{entry?.source === 'curated' ? 'captured normal map' : 'as captured'}</span>
					<button type="button" class="switch" role="switch" aria-checked="true" aria-label="Use the relief map" disabled title={U6}></button>
				</div>
				<div class="map">
					<span class="map-name">Sheen · occlusion</span>
					<span class="map-meta">{entry === null ? '—' : `r ${entry.sheen.toFixed(2)} effective`}</span>
					<button type="button" class="switch" role="switch" aria-checked="true" aria-label="Use the sheen map" disabled title={U6}></button>
				</div>
				<p class="reason-inline">Map switches: {U6}</p>
				{#if entry !== null}<p class="note">{entry.subline}</p>{/if}
			</section>

			<section class="sec" aria-labelledby="exact-title">
				<h3 id="exact-title">Exact finish</h3>

				<div class="field" class:changed={sheenChanged} data-material-editor-field="sheen">
					<button type="button" class="label" title={sheenChanged ? 'Changed — reset to the original' : 'Sheen'} ondblclick={onReset}>Sheen</button>
					<div class="value">
						<div class="steps" role="group" aria-label="Draft sheen">
							{#each draft.reading.steps as step (step.id)}
								<button
									type="button"
									disabled={step.disabled}
									class:orig={step.id === original}
									aria-pressed={draft.step === step.id}
									title={step.disabled ? 'This step is rougher than the base image can reach.' : `${step.label} sheen${step.id === original ? ' · original' : ''}`}
									data-material-editor-step={step.id}
									onclick={() => onStep(step.id)}
								>{step.label}</button>
							{/each}
						</div>
						<span class="mono">Original {stepLabel(original)}</span>
						{#if sheenChanged}<button type="button" class="linkb" data-material-editor-reset="sheen" onclick={onReset}>Reset</button>{/if}
					</div>
				</div>

				<div class="field unavailable" data-material-editor-field="colour">
					<span class="label">Colour</span>
					<div class="value">
						<span class="swatch" style:background={entry?.color ?? '#999'}></span>
						<span class="seg" role="group" aria-label="Colour mode">
							<button type="button" disabled aria-pressed="true">Natural</button>
							<button type="button" disabled>Stained</button>
							<button type="button" disabled>Painted</button>
						</span>
						<span class="reason-inline">Use Paint’s colours, or {U6.toLowerCase()}</span>
					</div>
				</div>

				<div class="field unavailable" data-material-editor-field="metal">
					<span class="label">Metal</span>
					<div class="value">
						<input type="range" min="0" max="1" step="0.01" value={entry?.metalness ?? 0} disabled aria-label="Metal" />
						<span class="mono">{(entry?.metalness ?? 0).toFixed(2)}</span>
						<span class="reason-inline">{U6}</span>
					</div>
				</div>

				<div class="field unavailable" data-material-editor-field="relief">
					<span class="label">Relief</span>
					<div class="value">
						<input type="range" min="0" max="2" step="0.05" value="1" disabled aria-label="Relief strength" />
						<span class="mono">×1.00</span>
						<span class="reason-inline">{U6}</span>
					</div>
				</div>

				<div class="field unavailable" data-material-editor-field="pattern">
					<span class="label">Pattern</span>
					<div class="value">
						<span class="mono">{entry?.subline.split('·').at(-1)?.trim() ?? '—'}</span>
						<span class="reason-inline">Size, angle and offset: {U6.toLowerCase()}</span>
					</div>
				</div>

				<div class="field unavailable" data-material-editor-field="mapping">
					<span class="label">Mapping</span>
					<div class="value"><span class="mono">Metres on the surface · same size everywhere</span></div>
				</div>
			</section>
		</div>
	</div>

	<footer class="foot">
		{#if status.reason !== null}
			<p class="reason" role="status" data-material-editor-reason>{status.reason}</p>
		{:else}
			<p class="reason ok">One operation · one Undo.</p>
		{/if}
		<div class="actions">
			<button type="button" data-material-editor-cancel onclick={onCancel}>Cancel</button>
			<button
				type="button"
				class="push"
				disabled
				title="Saving a private copy arrives with My library (U7)."
				data-material-editor-save
			>Save to My library</button>
			<button
				type="button"
				disabled={!status.canPaint || busy}
				title={status.paintReason ?? 'Arm Paint with this Finish · nothing is written'}
				data-material-editor-paint
				onclick={onPaint}
			>Use for Paint</button>
			<button
				type="button"
				class="primary"
				disabled={!status.canApply || applying || busy}
				title={status.canApply ? 'One undo step' : (status.reason ?? 'Click a surface first')}
				data-material-editor-apply
				onclick={() => void apply()}
			>{applying ? 'Applying…' : status.targetLabel === null ? 'Apply to…' : `Apply to ${status.targetLabel}`}</button>
		</div>
		{#if !status.canPaint && status.paintReason !== null}
			<p class="reason-inline">{status.paintReason}</p>
		{/if}
	</footer>
</div>

<style>
	.editor {
		position: absolute;
		z-index: 52;
		/* Beside a shown Card (--card-cover), above the dock's lower column. */
		top: 12px;
		right: calc(max(var(--card-cover, 0px), var(--sheet-lane-right, 0px)) + 12px);
		bottom: calc(var(--lower-column-height, 168px) + 12px);
		width: min(560px, calc(100% - max(var(--card-cover, 0px), var(--sheet-lane-right, 0px)) - var(--index-cover, 0px) - 24px));
		display: flex;
		flex-direction: column;
		min-height: 0;
		color: var(--shell-ink);
		background: var(--shell-card);
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 12px;
		box-shadow: 0 18px 50px color-mix(in srgb, var(--shell-forest) 30%, transparent);
		overflow: hidden;
	}
	.editor:focus { outline: none; }
	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px 6px;
		background: var(--shell-ivory);
	}
	.chip {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 2px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, #3157c8 14%, transparent);
		color: #2a4aa8;
	}
	.title { flex: 1; min-width: 0; }
	.eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--shell-ink-2); }
	h2 { margin: 0; font-size: 15px; overflow-wrap: anywhere; }
	.x {
		border: 0;
		background: transparent;
		color: var(--shell-ink);
		font-size: 20px;
		line-height: 1;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		cursor: pointer;
	}
	.x:hover { background: var(--shell-paper); }
	.strip {
		display: grid;
		gap: 3px;
		padding: 6px 12px 8px;
		font-size: 11.5px;
		border-bottom: 1px solid var(--shell-hairline);
		background: var(--shell-ivory);
	}
	.target { color: var(--shell-ink); }
	.target strong { color: #2a4aa8; }
	.warn { color: #8a5a12; }
	.grid {
		flex: 1;
		min-height: 0;
		overflow: auto;
		display: grid;
		grid-template-columns: minmax(180px, 220px) minmax(0, 1fr);
		gap: 14px;
		padding: 12px;
	}
	.left { display: grid; gap: 8px; align-content: start; }
	.right { display: grid; gap: 14px; align-content: start; min-width: 0; }
	.sec h3 {
		margin: 0 0 6px;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--shell-ink-2);
		display: flex;
		gap: 6px;
	}
	.hint { text-transform: none; letter-spacing: 0; }
	.map {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-rows: auto auto;
		column-gap: 8px;
		padding: 5px 0;
		border-bottom: 1px solid var(--shell-hairline);
		font-size: 12px;
	}
	.map .switch { grid-row: 1 / 3; grid-column: 2; align-self: center; }
	.map-meta { font-size: 11px; color: var(--shell-ink-2); }
	.map.off .map-name { color: var(--shell-ink-2); }
	.field {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr);
		gap: 8px;
		align-items: start;
		padding: 6px 0;
		border-bottom: 1px solid var(--shell-hairline);
		font-size: 12px;
	}
	.field .label {
		all: unset;
		color: var(--shell-ink-2);
		padding-top: 4px;
		cursor: default;
	}
	.field.changed .label { color: var(--shell-ink); font-weight: 600; cursor: pointer; }
	.value { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-width: 0; }
	.unavailable .value input, .unavailable .value .seg { opacity: 0.6; }
	.steps, .seg {
		display: inline-flex;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 7px;
		overflow: hidden;
	}
	.steps button, .seg button {
		border: 0;
		border-right: 1px solid var(--shell-hairline);
		background: transparent;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 11px;
		padding: 5px 9px;
		min-height: 28px;
		cursor: pointer;
	}
	.steps button:last-child, .seg button:last-child { border-right: 0; }
	.steps button.orig { box-shadow: inset 0 -2px 0 var(--shell-hairline-strong); }
	.steps button[aria-pressed='true'] { background: var(--shell-forest); color: var(--shell-ivory); }
	.steps button:disabled, .seg button:disabled { cursor: not-allowed; }
	.swatch { width: 18px; height: 18px; border-radius: 4px; box-shadow: inset 0 0 0 1px rgb(0 0 0 / 18%); }
	.mono { font-family: var(--shell-mono, ui-monospace, monospace); font-size: 11px; color: var(--shell-ink-2); }
	.reason-inline { flex-basis: 100%; margin: 0; font-size: 11px; color: var(--shell-ink-2); }
	.note { margin: 0; font-size: 11px; color: var(--shell-ink-2); }
	.linkb {
		border: 0;
		background: transparent;
		padding: 0;
		color: var(--shell-forest);
		text-decoration: underline;
		font: inherit;
		cursor: pointer;
	}
	.switch-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
	.switch {
		width: 30px;
		height: 18px;
		border-radius: 999px;
		border: 1px solid var(--shell-hairline-strong);
		background: var(--shell-paper);
		position: relative;
		cursor: pointer;
		padding: 0;
		flex: none;
	}
	.switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--shell-card);
		box-shadow: 0 1px 2px rgb(0 0 0 / 25%);
	}
	.switch[aria-checked='true'] { background: var(--shell-forest); }
	.switch[aria-checked='true']::after { left: 14px; }
	.switch:disabled { opacity: 0.55; cursor: not-allowed; }
	.foot {
		flex: none;
		padding: 8px 12px 10px;
		border-top: 1px solid var(--shell-hairline);
		background: var(--shell-ivory);
		display: grid;
		gap: 6px;
	}
	.actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
	.actions .push { margin-left: auto; }
	.actions button {
		border: 1px solid var(--shell-hairline-strong);
		background: var(--shell-card);
		color: var(--shell-ink);
		border-radius: 7px;
		padding: 6px 11px;
		font: inherit;
		font-size: 12px;
		min-height: 32px;
		cursor: pointer;
	}
	.actions button.primary { background: var(--shell-forest); border-color: var(--shell-forest); color: var(--shell-ivory); }
	.actions button:disabled { opacity: 0.5; cursor: not-allowed; }
	.reason { margin: 0; font-size: 11.5px; color: #8a3a12; }
	.reason.ok { color: var(--shell-ink-2); }
	button:focus-visible { outline: 2px solid var(--shell-forest); outline-offset: 1px; }
	@media (max-width: 860px) {
		.editor {
			top: auto;
			left: 0;
			right: 0;
			width: auto;
			bottom: var(--lower-column-height, 0px);
			/* The upper third of the usable Stage stays visible for retargeting. */
			height: calc((100% - var(--lower-column-height, 0px)) * 2 / 3);
			border-radius: 16px 16px 0 0;
		}
		.grid { grid-template-columns: minmax(0, 1fr); }
		.left { grid-template-columns: minmax(120px, 160px) minmax(0, 1fr); align-items: start; }
	}
	@media (pointer: coarse) {
		.actions button, .steps button, .seg button { min-height: 44px; }
		.x { width: 44px; height: 44px; }
	}
</style>
