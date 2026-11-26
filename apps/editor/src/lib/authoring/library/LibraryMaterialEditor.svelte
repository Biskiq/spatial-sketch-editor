<script lang="ts">
	/**
	 * The Material editor (T2.S8 U6): one dual-mode surface for both
	 * - **Finish mode**: edits an accepted Finish opened from the Finish Card
	 *  (each completed control is one E4 patch; preview while dragging);
	 * - **Draft mode**: the Library *Customise…* draft (no writes until Apply
	 *  or the first Paint stroke; every field connected).
	 *
	 * Layout matches the approved #399 Appearance prototype: 560 px wide in the
	 * Card lane (right inset 10 px, head and foot fixed, right column scrolling
	 * independently; two columns down to 768 px on portrait iPad; Layers omitted
	 * per C1).
	 */
	import { onMount } from 'svelte';
	import type { FinishPatchEdit, FinishSource } from '@portfolio/project-model/scene-planning';
	import type { ScenePaletteSlot } from '@portfolio/project-model/scene';
	import type { Recipe } from '@portfolio/project-model/materials';
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import type { WorldLightSample } from '$lib/render/materials/inspection-world';
	import FinishTile from '$lib/authoring/look/FinishTile.svelte';
	import {
		editorMapToggleEdits,
		type EditorDisplayMode,
		type EditorFieldsView,
		type EditorRawMapRow
	} from '$lib/authoring/look/finish-editor.svelte';
	import type { FinishTreatmentFacts } from '@portfolio/project-model/scene-planning';
	import LibraryMaterialEditorFields from './LibraryMaterialEditorFields.svelte';
	import FinishInspectionView from './FinishInspectionView.svelte';
	import { LIBRARY_INSPECTION_DEFAULT, type LibraryInspectionSettings } from './library-inspection';

	export type DraftFooterStatus = {
		readonly canApply: boolean;
		readonly changed: boolean;
		readonly targetLabel: string | null;
		readonly reason: string | null;
		readonly canPaint: boolean;
		readonly paintReason: string | null;
	};

	let {
		mode,
		name,
		baseLabel,
		canRename = false,
		onRename,
		finishKey,
		color = '#999999',
		imageUri = null,
		tileSource,
		originalSource = null,
		fields,
		source,
		recipes,
		palette,
		facts,
		world = null,
		inspection = LIBRARY_INSPECTION_DEFAULT,
		onInspection = () => {},
		display = 'lit',
		onDisplay = () => {},
		lightTurnRadians = 0,
		onTurnLight = () => {},
		compare = false,
		onCompare = () => {},
		fieldRefusal = null,
		// Finish-mode props
		usersCount = 1,
		reach = 'this',
		place = '',
		onToggleReach,
		align = null,
		onAlign,
		onMaterialPreview,
		onCancelPreview,
		onCommit,
		onResetAll,
		onDone,
		// Draft-mode props
		draftStatus = null,
		previewing = true,
		busy = false,
		onApplyDraft,
		onPaintDraft,
		onCancelDraft
	}: {
		mode: 'finish' | 'draft';
		name: string;
		baseLabel: string;
		canRename?: boolean;
		onRename?: (nextName: string) => Promise<boolean>;
		finishKey: string;
		color?: string;
		imageUri?: string | null;
		/** Live/edited preview subject. */
		tileSource: FinishTileSource | null;
		/** Original (base) preview subject for split Compare. */
		originalSource?: FinishTileSource | null;
		fields: EditorFieldsView;
		source: FinishSource;
		recipes: ReadonlyMap<string, Recipe>;
		palette: readonly ScenePaletteSlot[];
		facts: FinishTreatmentFacts;
		world?: WorldLightSample | null;
		inspection?: LibraryInspectionSettings;
		onInspection?: (next: LibraryInspectionSettings) => void;
		display?: EditorDisplayMode;
		onDisplay?: (next: EditorDisplayMode) => void;
		lightTurnRadians?: number;
		onTurnLight?: () => void;
		compare?: boolean;
		onCompare?: (next: boolean) => void;
		fieldRefusal?: { readonly field: string; readonly message: string } | null;
		usersCount?: number;
		reach?: 'this' | 'all';
		place?: string;
		onToggleReach?: () => void;
		align?: { readonly kind: 'wall' | 'floor'; readonly label: string } | null;
		onAlign?: () => void;
		onMaterialPreview?: (edits: readonly FinishPatchEdit[]) => void;
		onCancelPreview?: () => void;
		onCommit: (field: string, edits: readonly FinishPatchEdit[]) => Promise<boolean> | void;
		onResetAll: () => Promise<boolean> | void;
		onDone?: () => void;
		draftStatus?: DraftFooterStatus | null;
		previewing?: boolean;
		busy?: boolean;
		onApplyDraft?: () => Promise<boolean>;
		onPaintDraft?: () => void;
		onCancelDraft?: () => void;
	} = $props();


	let applying = $state(false);
	let closeButton = $state<HTMLButtonElement>();
	let renaming = $state(false);
	let renameDraft = $state('');
	let wheelOpen = $state(false);
	let localError = $state<{ readonly field: string; readonly message: string } | null>(null);

	onMount(() => closeButton?.focus());


	const canCompare = $derived(originalSource !== null && tileSource !== null);

	function close(): void {
		onCancelPreview?.();
		if (mode === 'finish') onDone?.();
		else onCancelDraft?.();
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		if (wheelOpen) {
			event.preventDefault();
			event.stopPropagation();
			onCancelPreview?.();
			wheelOpen = false;
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		close();
	}

	function startRename(): void {
		if (!canRename || !onRename) return;
		renameDraft = name;
		renaming = true;
	}

	async function commitRename(): Promise<void> {
		if (!renaming || !onRename) return;
		renaming = false;
		await onRename(renameDraft);
	}

	function toggleMap(row: EditorRawMapRow): void {
		localError = null;
		const edits = editorMapToggleEdits(row.roles, !row.on);
		void onCommit(`map:${row.id}`, edits);
	}

	function toggleMapView(row: EditorRawMapRow): void {
		onDisplay(display === row.displayTarget ? 'lit' : row.displayTarget);
	}

	async function applyDraft(): Promise<void> {
		if (applying || busy || !draftStatus?.canApply || !onApplyDraft) return;
		applying = true;
		try {
			await onApplyDraft();
		} finally {
			applying = false;
		}
	}

	const reachLabel = $derived(
		reach === 'all' && usersCount > 1 ? `Applies to All ${usersCount}` : `Applies to ${place || 'this'}`
	);
</script>

<div
	class="editor"
	class:finish-mode={mode === 'finish'}
	class:draft-mode={mode === 'draft'}
	role="dialog"
	tabindex="-1"
	aria-modal="false"
	aria-labelledby="material-editor-title"
	data-material-editor
	data-material-editor-mode={mode}
	onkeydown={onKeydown}
>
	<header class="head">
		{#if mode === 'finish'}
			<button
				type="button"
				class="back"
				title="Back to the Card (Done)"
				aria-label="Back to the Finish Card"
				data-material-editor-back
				onclick={close}
			>‹ <span>Finish</span></button>
		{/if}
		<span class="thumb">
			<FinishTile source={tileSource} {color} {imageUri} size={40} label={name} />
		</span>
		<div class="title">
			{#if renaming && canRename}
				<!-- svelte-ignore a11y_autofocus -->
				<input
					class="rename-input"
					aria-label="Finish name"
					maxlength="120"
					autofocus
					bind:value={renameDraft}
					onkeydown={(event) => {
						if (event.key === 'Enter') void commitRename();
						if (event.key === 'Escape') {
							event.stopPropagation();
							renaming = false;
						}
					}}
					onblur={() => void commitRename()}
				/>
			{:else if canRename && onRename}
				<button type="button" class="name-btn" id="material-editor-title" title="Rename (Enter)" onclick={startRename}>{name}</button>
			{:else}
				<h2 id="material-editor-title">{name}</h2>
			{/if}
		</div>
		{#if mode === 'draft'}
			<span class="rchip draft" title="Nothing is written until you apply">Draft</span>
		{:else}
			<button
				type="button"
				class="rchip"
				class:all={reach === 'all' && usersCount > 1}
				disabled={usersCount <= 1}
				title={usersCount > 1 ? 'Who changes — click to switch' : 'Only this surface uses it'}
				data-material-editor-reach
				onclick={() => onToggleReach?.()}
			>{reachLabel}</button>
		{/if}
		<button
			type="button"
			class="x"
			bind:this={closeButton}
			aria-label={mode === 'draft' ? 'Cancel draft and close' : 'Close Material editor'}
			title={mode === 'draft' ? 'Cancel · nothing written (Esc)' : 'Close (Esc)'}
			data-material-editor-close
			onclick={close}
		>×</button>
	</header>

	{#if mode === 'draft' && draftStatus !== null}
		<div class="strip" data-material-editor-status>
			<span class="note">
				Draft · from {baseLabel}{fields.changeCount > 0 ? ` · ${fields.changeCount} change${fields.changeCount === 1 ? '' : 's'}` : ''} · nothing is written yet
				{#if fields.changeCount > 0}
					· <button type="button" class="linkb" data-material-editor-reset-all onclick={() => void onResetAll()}>Reset all</button>
				{/if}
			</span>
			<span class="target" data-material-editor-target>
				{#if draftStatus.targetLabel === null}
					Click a surface or object on the Stage to preview it there
				{:else}
					Previewing on <strong>{draftStatus.targetLabel}</strong> · click another surface to move it
				{/if}
			</span>
			{#if draftStatus.targetLabel !== null && !previewing}
				<span class="warn" data-material-editor-preview-note>
					{draftStatus.changed ? 'The Stage cannot show this draft here yet; the inspection below still reads it.' : `${draftStatus.targetLabel} already wears ${name}.`}
				</span>
			{/if}
		</div>
	{/if}

	<div class="ed">
		<div class="ed-l">
			<FinishInspectionView
				source={tileSource}
				{originalSource}
				{color}
				{imageUri}
				label={name}
				{world}
				materialKey={finishKey}
				settings={inspection}
				onSettings={onInspection}
				{display}
				{onDisplay}
				{lightTurnRadians}
				{onTurnLight}
				compare={canCompare && compare}
				probe={true}
				sampleWindowMeters={fields.pattern.realMeters * 1.4}
				showEditorControls={true}
			/>
			<label class="switch-row">
				<button
					type="button"
					class="switch"
					role="switch"
					aria-checked={canCompare && compare}
					aria-label="Compare with original"
					disabled={!canCompare}
					data-material-editor-compare
					onclick={() => onCompare(!compare)}
				></button>
				Compare with original
			</label>
		</div>

		<div class="ed-r" data-material-editor-scroll>
			<section class="eds" aria-labelledby="raw-title">
				<h6 id="raw-title">RAW MATERIAL <span class="hint">{fields.raw.label}</span></h6>
				{#each fields.raw.rows as row (row.id)}
					<div class="maprow" class:off={!row.on || !row.hasImage} data-material-editor-map={row.id}>
						{#if !row.hasImage}
							<span class="mth none" aria-hidden="true">—</span>
							<span class="mn">
								<span class="mn-t">{row.label}</span>
								<span class="ms">{row.file}</span>
							</span>
						{:else}
							<span class="mth" aria-hidden="true">
								<FinishTile source={originalSource ?? tileSource} {color} size={28} />
							</span>
							<span class="mn">
								<span class="mn-t">{row.label}</span>
								<span class="ms mono" title={row.file}>{row.file}</span>
							</span>
							<button
								type="button"
								class="linkb"
								aria-pressed={display === row.displayTarget}
								title="Show this map in the preview"
								data-material-editor-map-view={row.id}
								onclick={() => toggleMapView(row)}
							>{display === row.displayTarget ? 'Lit' : 'View'}</button>
							<button
								type="button"
								class="switch"
								role="switch"
								aria-checked={row.on}
								aria-label={`Use the ${row.label.toLowerCase()} map`}
								data-material-editor-map-switch={row.id}
								onclick={() => toggleMap(row)}
							></button>
						{/if}
					</div>
				{/each}
				<p class="note-sm">{fields.raw.caption}</p>
			</section>

			<LibraryMaterialEditorFields
				{fields}
				{source}
				{recipes}
				{palette}
				{facts}
				{mode}
				{align}
				{onAlign}
				{fieldRefusal}
				{color}
				{onCommit}
				{onMaterialPreview}
				{onCancelPreview}
				bind:wheelOpen
				bind:localError
			/>
		</div>
	</div>

	{#if mode === 'finish'}
		<footer class="foot" data-material-editor-foot>
			<span class="edn">
				{fields.changeCount > 0 ? `${fields.changeCount} change${fields.changeCount === 1 ? '' : 's'} from original` : 'Same as the original material'}
			</span>
			{#if fields.changeCount > 0}
				<button
					type="button"
					class="foot-btn"
					title="Back to the raw material, one undo"
					data-material-editor-reset-all
					onclick={() => void onResetAll()}
				>Reset all</button>
			{/if}
			<button type="button" class="foot-btn primary push" data-material-editor-done onclick={close}>Done</button>
		</footer>
	{:else if draftStatus !== null}
		<footer class="foot draft-foot" data-material-editor-foot>
			{#if draftStatus.reason !== null}
				<p class="reason" role="status" data-material-editor-reason>{draftStatus.reason}</p>
			{/if}
			<div class="actions">
				<button type="button" class="foot-btn" data-material-editor-cancel onclick={close}>Cancel</button>
				<button
					type="button"
					class="foot-btn push"
					disabled
					title="Saving a private copy arrives with My library (U7)."
					data-material-editor-save
				>Save to My library</button>
				<button
					type="button"
					class="foot-btn"
					disabled={!draftStatus.canPaint || busy}
					title="Arm Paint with this Finish · nothing is written"
					data-material-editor-paint
					onclick={() => onPaintDraft?.()}
				>Use for Paint</button>
				<button
					type="button"
					class="foot-btn primary"
					disabled={!draftStatus.canApply || applying || busy}
					title={draftStatus.canApply ? 'One undo step' : (draftStatus.reason ?? 'Click a surface first')}
					data-material-editor-apply
					onclick={() => void applyDraft()}
				>{applying ? 'Applying…' : draftStatus.targetLabel === null ? 'Apply to…' : `Apply to ${draftStatus.targetLabel}`}</button>
			</div>
		</footer>
	{/if}
</div>

<style>
	.editor {
		position: absolute;
		z-index: 52;
		top: 10px;
		right: 10px;
		bottom: calc(var(--lower-column-height, 92px) + 14px);
		width: min(560px, calc(100% - var(--library-index-cover, var(--index-cover, 0px)) - 20px));
		display: flex;
		flex-direction: column;
		min-height: 0;
		color: var(--shell-ink);
		background: var(--shell-card);
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 14px;
		box-shadow: var(--shell-shadow);
		overflow: hidden;
	}
	.editor:focus { outline: none; }
	.head {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 56px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--shell-hairline);
		background: var(--shell-ivory);
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		height: 28px;
		padding: 0 8px 0 4px;
		border: 1px solid var(--shell-hairline);
		border-radius: 7px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font: inherit;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}
	.thumb {
		flex: 0 0 40px;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		overflow: hidden;
	}
	.title { flex: 1; min-width: 0; }
	.title h2,
	.name-btn {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.25;
		overflow-wrap: anywhere;
		color: var(--shell-ink);
	}
	.name-btn {
		padding: 0;
		border: 0;
		background: transparent;
		font-family: inherit;
		text-align: left;
		cursor: text;
	}
	.rename-input {
		width: 100%;
		height: 26px;
		padding: 0 6px;
		border: 1px solid var(--shell-field-line-strong);
		border-radius: 6px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font: inherit;
		font-size: 13px;
	}
	.rchip {
		flex: 0 0 auto;
		height: 25px;
		padding: 3px 9px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 999px;
		background: var(--shell-field);
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 11.5px;
		white-space: nowrap;
		cursor: pointer;
	}
	.rchip:disabled { cursor: default; opacity: 0.85; }
	.rchip.all,
	.rchip.draft {
		border-color: color-mix(in srgb, var(--stage-proposal) 35%, transparent);
		background: color-mix(in srgb, var(--stage-proposal) 14%, transparent);
		color: var(--stage-proposal);
	}
	.x {
		flex: 0 0 auto;
		border: 0;
		background: transparent;
		color: var(--shell-ink);
		font-size: 20px;
		line-height: 1;
		width: 28px;
		height: 28px;
		border-radius: 7px;
		cursor: pointer;
	}
	.x:hover { background: var(--shell-hover); }
	.strip {
		flex: 0 0 auto;
		display: grid;
		gap: 2px;
		padding: 6px 12px 7px;
		font-size: 11.5px;
		border-bottom: 1px solid var(--shell-hairline);
		background: var(--shell-ivory);
	}
	.target { color: var(--shell-ink); }
	.target strong { color: var(--stage-proposal); }
	.warn { color: var(--shell-caution); }
	.ed {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 224px minmax(0, 1fr);
		gap: 14px;
		padding: 12px;
		overflow: hidden;
	}
	.ed-l {
		display: grid;
		gap: 8px;
		align-content: start;
		min-height: 0;
		overflow: auto;
	}
	.ed-r {
		display: grid;
		gap: 14px;
		align-content: start;
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		padding-right: 2px;
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
	.hint { text-transform: none; letter-spacing: 0; font-family: var(--shell-sans); }
	.maprow {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 45px;
		padding: 5px 0;
		border-bottom: 1px solid var(--shell-hairline);
	}
	.maprow.off { opacity: 0.6; }
	.mth {
		flex: 0 0 28px;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		overflow: hidden;
		display: grid;
		place-items: center;
	}
	.mth.none {
		border: 1px dashed var(--shell-hairline-strong);
		color: var(--shell-ink-3);
		font-size: 11px;
	}
	.mn {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 1px;
	}
	.mn-t { font-size: 12px; font-weight: 600; color: var(--shell-ink); }
	.ms {
		font-size: 10.5px;
		color: var(--shell-ink-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mono { font-family: var(--shell-mono); }	.note,
	.note-sm { margin: 0; font-size: 11px; color: var(--shell-ink-2); }

	.switch-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		cursor: pointer;
	}
	.switch {
		position: relative;
		flex: 0 0 auto;
		width: 36px;
		height: 20px;
		padding: 0;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 999px;
		background: var(--shell-surface-sunken);
		cursor: pointer;
	}
	.switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--shell-field);
		transition: transform 120ms ease;
	}
	.switch[aria-checked='true'] { background: var(--shell-action); border-color: var(--shell-action); }
	.switch[aria-checked='true']::after { transform: translateX(16px); }
	.switch:disabled { opacity: 0.45; cursor: not-allowed; }
	.foot {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 39px;
		padding: 6px 12px;
		border-top: 1px solid var(--shell-hairline);
		background: var(--shell-ivory);
	}
	.foot.draft-foot {
		flex-direction: column;
		align-items: stretch;
		gap: 4px;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.edn { font-size: 11.5px; color: var(--shell-ink-2); }
	.reason { margin: 0; font-size: 11.5px; color: var(--shell-refuse); }
	.foot-btn {
		height: 26px;
		padding: 0 10px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 7px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font: inherit;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}
	.foot-btn.primary {
		background: var(--shell-action);
		border-color: var(--shell-action);
		color: var(--shell-on-action);
	}
	.foot-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.push { margin-left: auto; }

	/* iPad portrait: bottom sheet from ~401 px, keeping TWO columns down to 768 px */
	@media (max-width: 860px), (orientation: portrait) and (max-width: 900px) {
		.editor {
			top: auto;
			left: 10px;
			right: 10px;
			width: auto;
			height: min(66vh, calc(100% - 120px));
			bottom: calc(var(--lower-column-height, 92px) + 10px);
			border-radius: 16px 16px 0 0;
		}
		.ed {
			grid-template-columns: 200px minmax(0, 1fr);
		}
	}
	@media (max-width: 680px) {
		.ed {
			grid-template-columns: 1fr;
			overflow: auto;
		}
		.ed-r { overflow: visible; }
	}
	@media (pointer: coarse) {
		.foot-btn,
		.back,
		.x {
			min-height: var(--shell-touch-target);
		}
	}
</style>
