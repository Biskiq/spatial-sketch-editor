<!--
	T1 A8 — the Card's **Repeat** writer for one selected Opening.

	Renders beside the Opening's ordinary fields, not in a new panel or a tool:
	a count of copies and a spacing in metres, with the planner's own proposal
	and refusal as the note. While the values are being set, the same proposal
	is published to the Stage, which draws every copy along the host Wall as a
	candidate. Pressing **Repeat** accepts one captured, undoable operation; a
	refused batch writes nothing and adds no history.

	The count and spacing are session state. They are never serialized, never
	enter history and are cleared as soon as the operation commits or the panel
	closes.
-->

<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import { mintLayoutIdCapture } from '@portfolio/layout-core';
import { stageLayout, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { parseExactNumber } from '$lib/authoring/layout/layout-exact-input';
import { wallStationFrame } from './precision';
import { previewOpeningRepeat, openingRepeatIntent, LAYOUT_OPENING_REPEAT_KIND } from './opening-repeat';
import {
	clearOpeningRepeatProposal,
	publishOpeningRepeatProposal
} from './opening-repeat-proposal';

let { services }: { services: StageAdapterServices } = $props();

let countText = $state('2');
let spacingText = $state('1.00');
let busy = $state(false);
let error = $state<string | null>(null);
let notice = $state<string | null>(null);
let alive = true;
/**
 * The Stage facade is access, not a signal: its selection and snapshot reads are
 * ordinary functions. The facade's own change notification is the one signal it
 * publishes for "the Card's subject may be different now", so every read below
 * depends on this counter. Without it a live A → B selection change would leave
 * this panel editing A, and an accepted edit would keep publishing under the
 * retired source key.
 */
let stageRevision = $state(0);
onMount(() => {
	const stage = services.stage;
	if (typeof stage.onAdaptersChanged !== 'function') return;
	return stage.onAdaptersChanged(() => {
		stageRevision += 1;
	});
});
/** The exact proposal this panel last published, so teardown clears that one. */
let published: { readonly sourceContentId: string; readonly openingId: string } | null = null;
onDestroy(() => {
	alive = false;
	clearActiveProposal();
});

const sourceKey = $derived.by(() => {
	void stageRevision;
	const snapshot = services.stage.snapshot();
	return snapshot.sourceContentId;
});

const selection = $derived.by(() => {
	void stageRevision;
	const stage = services.stage;
	return typeof stage.selection === 'function' ? stage.selection() : null;
});

const opening = $derived.by(() => {
	const current = selection;
	if (current === null || current.sourceKind !== 'opening') return null;
	try {
		return stageLayout(services.stage.snapshot()).openings.find((entry) => entry.id === current.sourceId) ?? null;
	} catch {
		return null;
	}
});

const wallId = $derived(opening?.wallId ?? null);

const wallLength = $derived.by(() => {
	if (wallId === null) return null;
	// The accepted document can change under an unchanged Wall id (a repeat on a
	// neighbouring Opening, a resize); the revision keeps the read current.
	void stageRevision;
	try {
		return wallStationFrame(stageLayout(services.stage.snapshot()), wallId)?.length ?? null;
	} catch {
		return null;
	}
});

const parsedCount = $derived(parseExactNumber(countText, 2, (value) => String(value)));
const parsedSpacing = $derived(parseExactNumber(spacingText, 1, (value) => value.toFixed(2)));

const preview = $derived.by(() => {
	const current = opening;
	const count = parsedCount;
	const spacing = parsedSpacing;
	void stageRevision;
	if (current === null || !count.ok || !spacing.ok) return null;
	try {
		return previewOpeningRepeat({
			document: stageLayout(services.stage.snapshot()),
			openingId: current.id,
			count: count.value,
			spacing: spacing.value
		});
	} catch {
		return null;
	}
});

function clearActiveProposal(): void {
	if (published === null) return;
	clearOpeningRepeatProposal(published.sourceContentId, published.openingId);
	published = null;
}

// A new selection or a new accepted source retires the proposal it described.
// The Stage never shows a preview for an Opening that is no longer selected.
let lastOpeningId: string | null = null;
$effect(() => {
	const current = opening;
	const key = sourceKey;
	if (published !== null && (current === null || published.openingId !== current.id || published.sourceContentId !== key)) {
		clearActiveProposal();
	}
	// A committed Repeat changes the source content but keeps the same Opening:
	// its success notice must survive. Only a different Opening starts clean.
	const openingId = current?.id ?? null;
	if (openingId !== lastOpeningId) {
		lastOpeningId = openingId;
		notice = null;
		error = null;
	}
});

// The panel is the proposal, including before anything is typed: a valid default
// batch is drawn as soon as the Opening is selected, so pressing Repeat can never
// commit a batch the Stage has not shown. After a commit the notice is present
// and the proposal stays retired until the values are edited again.
$effect(() => {
	const current = preview;
	const source = opening;
	const key = sourceKey;
	const count = parsedCount;
	const spacing = parsedSpacing;
	if (current === null || current.kind !== 'planned' || source === null) return;
	if (!count.ok || !spacing.ok) return;
	if (published !== null || notice !== null || error !== null) return;
	publishOpeningRepeatProposal({
		sourceContentId: key,
		openingId: source.id,
		wallId: source.wallId,
		count: count.value,
		spacing: spacing.value
	});
	published = { sourceContentId: key, openingId: source.id };
	services.stage.notifySurfaceChange();
});

/** Publish the typed values so the Stage can draw every proposed copy. */
function publish(): void {
	const current = opening;
	if (current === null) return;
	const count = parsedCount;
	const spacing = parsedSpacing;
	if (!count.ok || !spacing.ok) {
		clearActiveProposal();
		clearOpeningRepeatProposal(sourceKey, current.id);
		services.stage.notifySurfaceChange();
		return;
	}
	publishOpeningRepeatProposal({
		sourceContentId: sourceKey,
		openingId: current.id,
		wallId: current.wallId,
		count: count.value,
		spacing: spacing.value
	});
	published = { sourceContentId: sourceKey, openingId: current.id };
	services.stage.notifySurfaceChange();
}

function countWords(value: number): string {
	return value === 1 ? 'copy' : 'copies';
}

const note = $derived.by(() => {
	if (opening === null) return null;
	const count = parsedCount;
	const spacing = parsedSpacing;
	if (!count.ok || !spacing.ok) {
		return count.ok ? 'Spacing must be one finite number of metres.' : 'Count must be one finite whole number.';
	}
	if (!Number.isInteger(count.value) || count.value < 1 || count.value > 50) {
		return 'Repeat takes a whole number of copies from 1 to 50.';
	}
	const current = preview;
	if (current === null) return null;
	if (current.kind === 'refused') return current.message;
	const kind = current.sourceOpening.kind === 'door' ? 'door' : 'window';
	const copies = `${count.value} ${kind}${count.value === 1 ? '' : 's'}`;
	const spacingLabel = spacing.value.toFixed(2);
	return wallLength === null
		? `Adds ${copies} at ${spacingLabel} m spacing.`
		: `Adds ${copies} at ${spacingLabel} m spacing along this ${wallLength.toFixed(2)} m Wall.`;
});

const blocked = $derived(
	opening === null ||
	!parsedCount.ok ||
	!parsedSpacing.ok ||
	preview === null ||
	preview.kind === 'refused'
);

async function repeat(): Promise<void> {
	if (busy || opening === null) return;
	error = null;
	notice = null;
	if (!parsedCount.ok || !parsedSpacing.ok) {
		error = note ?? 'Check the count and the spacing.';
		return;
	}
	const current = preview;
	if (current === null) {
		error = 'The Wall cannot be read right now. Try again.';
		return;
	}
	if (current.kind === 'refused') {
		error = current.message;
		return;
	}
	const count = parsedCount;
	const spacing = parsedSpacing;
	if (!count.ok || !spacing.ok) return;
	busy = true;
	publish();
	try {
		const snapshot = services.stage.snapshot();
		const outcome = await services.authoring.accept(
			openingRepeatIntent({
				openingId: current.sourceOpening.id,
				count: count.value,
				spacing: spacing.value,
				capture: mintLayoutIdCapture(),
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: services.authoring.acceptedRevision().revisionId,
				contentRevision: snapshot.domain.unitRevisions.layout,
				levelId: snapshot.domain.layoutLevelId
			})
		);
		if (!alive) return;
		if (outcome.kind === 'refused') {
			error = outcome.message;
			return;
		}
		// The copies are the document now; the live proposal has nothing left to
		// show, so it clears instead of doubling the new Openings.
		clearActiveProposal();
		services.stage.notifySurfaceChange();
		notice = outcome.kind === 'no-op'
			? 'Those copies are already on the Wall.'
			: `Added ${count.value} ${countWords(count.value)}.`;
	} finally {
		busy = false;
	}
}

function onEdit(field: 'count' | 'spacing', value: string): void {
	error = null;
	notice = null;
	if (field === 'count') countText = value;
	else spacingText = value;
	publish();
}
</script>

{#if opening !== null}
	<div class="opening-repeat" data-opening-repeat data-opening-repeat-kind={LAYOUT_OPENING_REPEAT_KIND}>
		<p class="title">Repeat</p>
		<div class="row">
			<label class="field count">
				<span>Count</span>
				<input
					type="text"
					inputmode="numeric"
					data-opening-repeat-count
					aria-label="Repeat count"
					value={countText}
					onfocus={publish}
					oninput={(event) => onEdit('count', event.currentTarget.value)}
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							void repeat();
						}
					}}
				/>
			</label>
			<label class="field spacing">
				<span>Spacing</span>
				<input
					type="text"
					inputmode="decimal"
					data-opening-repeat-spacing
					aria-label="Repeat spacing in metres"
					value={spacingText}
					onfocus={publish}
					oninput={(event) => onEdit('spacing', event.currentTarget.value)}
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							void repeat();
						}
					}}
				/>
				<span class="unit">m</span>
			</label>
			<button
				type="button"
				class="repeat"
				data-opening-repeat-submit
				disabled={blocked || busy}
				title={blocked ? 'The current count and spacing are refused' : 'Repeat this Opening along its Wall'}
				onclick={() => void repeat()}
			>
				Repeat
			</button>
		</div>
		{#if note !== null && notice === null}
			<p class="note" class:refused={preview?.kind === 'refused'} data-opening-repeat-note role="status">{note}</p>
		{/if}
		{#if error !== null}
			<p class="error" data-opening-repeat-error role="alert">{error}</p>
		{/if}
		{#if notice !== null}
			<p class="notice" data-opening-repeat-notice role="status">{notice}</p>
		{/if}
	</div>
{/if}

<style>
	.opening-repeat {
		display: grid;
		gap: 4px;
		padding: 2px 12px 8px;
		border-top: 1px solid var(--shell-field-line);
	}
	.title {
		margin: 4px 0 0;
		color: var(--shell-ink-2);
		font-size: 10.5px;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1fr) auto;
		align-items: end;
		gap: 6px;
	}
	.field {
		position: relative;
		display: grid;
		gap: 2px;
		min-width: 0;
		color: var(--shell-ink-2);
		font-size: 10.5px;
	}
	input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		height: 26px;
		padding: 0 18px 0 6px;
		border: 1px solid var(--shell-field-line);
		border-radius: 6px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font: 12px var(--shell-mono);
		font-variant-numeric: tabular-nums;
	}
	input:hover {
		border-color: var(--shell-field-line-strong);
	}
	input:focus {
		background: var(--shell-field-focus);
		border-color: var(--shell-leaf);
	}
	.unit {
		position: absolute;
		right: 6px;
		bottom: 6px;
		font-size: 10px;
		pointer-events: none;
	}
	button {
		min-height: 26px;
		padding: 0 10px;
		border: 1px solid var(--shell-field-line);
		border-radius: 6px;
		background: var(--shell-field);
		color: inherit;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		border-color: var(--shell-field-line-strong);
		color: var(--shell-ink);
	}
	button:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.note,
	.error,
	.notice {
		margin: 0;
		font-size: 11px;
		line-height: 1.35;
	}
	.note {
		color: var(--shell-ink-quiet);
	}
	.note.refused,
	.error {
		color: var(--shell-refuse);
	}
	.notice {
		color: var(--shell-ink-2);
	}
	@media (pointer: coarse) {
		input,
		button {
			min-height: 44px;
			min-width: 44px;
		}
		.unit {
			bottom: 14px;
		}
	}
</style>
