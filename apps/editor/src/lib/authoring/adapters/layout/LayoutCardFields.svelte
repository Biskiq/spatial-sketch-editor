<script lang="ts">
	/**
	 * T1.P02.S02 — the **Card's** Layout field writer (formerly Dimensions).
	 *
	 * One controller owns the accepted dimensions, drafts, refusals and history.
	 * Ordinary Wall length/height and Opening measures stay compact; thickness
	 * and offset use the Card's one anchored secondary panel. Coordinate and
	 * transform procedures are absent. The planner's default fixed endpoint is
	 * preserved; presentation does not silently choose a different anchor.
	 * The name remains the Card's delegated inline writer.
	 *
	 * It renders what the framework-free controller owns: the accepted value, the
	 * edit buffer and the refusal reason. Enter commits, Esc and blur discard, and
	 * the DOM never turns an empty field into zero.
	 */
	import { onDestroy, untrack, type Snippet } from 'svelte';
	import { compactMeasure } from '$lib/authoring/stage/stage-adapter-host';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import type { LayoutFieldState, LayoutInstrument } from './instrument';
	import type { PausedWallProposal } from './paused-proposal';
	import { createCardFieldsInstrument } from './adapter-support';
	import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
	import {
		isStraightCompiledWall,
		wallUnfoldSideTowardCamera,
		wallUnfoldViewCentreStation
	} from '$lib/layout/wall-unfold';
	import LayoutWallUnfold from './LayoutWallUnfold.svelte';

	let {
		services,
		detailOpen = false,
		footer, secondary, more
	}: {
		services: StageAdapterServices;
		/** Whether the Card's More section is expanded; closing it discards its drafts. */
		detailOpen?: boolean;
		footer?: Snippet;
		secondary?: Snippet<[Snippet?]>;
		more?: Snippet<[Snippet?]>;
	} = $props();
	// Check this before reading any derived state in an async continuation: a
	// successful install can destroy the panel before acceptance resolves.
	let alive = true;
	onDestroy(() => {
		alive = false;
	});

	let fields = $state<readonly LayoutFieldState[]>([]);
	let error = $state<string | null>(null);
	let focusedField = $state<string | null>(null);
	// Event continuations use this lifetime-owned reference, never an inert derived.
	let currentController: LayoutInstrument | null = null;
	/** A parameter a reading change preserved; Resume applies the captured value exactly. */
	let paused = $state<PausedWallProposal | null>(null);

	// The writer follows the one canonical selection: a new subject rebuilds the
	// controller from the accepted source, so a stale selection can never keep
	// editing the subject it was opened on.
	const selectionKey = $derived.by(() => {
		const selection = services.stage.selection();
		return selection === null ? null : `${selection.sourceKind}:${selection.sourceId}`;
	});
	/** The compiled Wall the selected subject names, for the unfold controls. */
	const unfoldWall = $derived.by(() => {
		const stage = services.stage;
		// Pure Card controller tests mount a narrow fake stage; a missing read
		// simply means there is no compiled Wall to offer unfold controls for.
		if (typeof stage.snapshot !== 'function') return null;
		const selection = stage.selection();
		if (selection === null || selection.sourceKind !== 'wall') return null;
		return (
			stage.snapshot().domain.geometry.walls.find((candidate) => candidate.wallId === selection.sourceId) ??
			null
		);
	});
	const unfoldActive = $derived(
		unfoldWall !== null && wallUnfold.state?.wallId === unfoldWall.wallId
	);

	/**
	 * Enter from the Card foot. The view centre names the anchor and the eye side
	 * names the face, so the reading opens where the creator is looking; a
	 * selected Opening on the same Wall is the second anchor preference. Entry
	 * records the current orientation and asks the session for one bounded fit.
	 */
	function toggleUnfold(): void {
		const wall = unfoldWall;
		if (wall === null) return;
		if (wallUnfold.state?.wallId === wall.wallId) {
			wallUnfold.exit(wall);
			return;
		}
		const stage = services.stage;
		const selection = typeof stage.selection === 'function' ? stage.selection() : null;
		const evaluation = typeof stage.evaluation === 'function' ? stage.evaluation() : null;
		const opening = selection?.sourceKind === 'opening'
			? wall.openings.find((candidate) => candidate.openingId === selection.sourceId)
			: undefined;
		const viewCentre = evaluation === null
			? null
			: wallUnfoldViewCentreStation(wall, evaluation.target);
		const anchor = viewCentre ?? (opening === undefined ? 0 : opening.offset + opening.width / 2);
		const side = wallUnfoldSideTowardCamera({
			wall,
			eye: evaluation?.eye ?? null,
			reading: evaluation?.settledReading ?? '3d',
			anchorStation: anchor
		});
		wallUnfold.enter(
			wall,
			anchor,
			evaluation === null ? undefined : { pose: evaluation.pose, reading: evaluation.settledReading },
			{
				side,
				floorY: stage.snapshot().domain.datumMeters,
				straight: isStraightCompiledWall(wall)
			}
		);
	}

	const instrument = $derived.by(() => {
		void selectionKey;
		return createCardFieldsInstrument(services);
	});
	const editable = $derived(fields.filter((field) => field.id !== 'name'));
	const ordinaryFields = $derived(
		editable.filter(
			(field) =>
				field.id !== 'startX' && field.id !== 'startZ' && field.id !== 'endX' && field.id !== 'endZ'
		)
	);
	const primaryFields = $derived.by(() => {
		// A closed Wall has no straight length/angle writer; its primary physical
		// facts are radius and diameter, and both are exact Card edits.
		const closedWall = ordinaryFields.some((field) => field.id === 'radius');
		const ids =
			instrument?.subject.kind === 'wall'
				? closedWall
					? ['radius', 'diameter', 'height']
					: ['length', 'height']
				: ['width', 'height'];
		return ids.flatMap((id) => ordinaryFields.filter((field) => field.id === id));
	});

	function refresh(current = currentController): void {
		fields = current?.fields() ?? [];
		paused = current?.pausedProposal() ?? null;
	}

	// One owner publishes the live controller to events and invalidates that
	// reference before disposing it. A new subject restores its explicit endpoint.
	$effect(() => {
		const current = instrument;
		currentController = current;
		refresh(current);
		return () => {
			if (currentController === current) currentController = null;
			current?.dispose();
		};
	});

	// Dismissal discards secondary drafts; reopening never revives an abandoned edit.
	$effect(() => {
		if (detailOpen) return;
		untrack(() => { currentController?.cancel('thickness'); currentController?.cancel('offset'); refresh(); });
	});

	/**
	 * The pause is created by a pointer gesture, which does not re-render this
	 * panel. One frame loop reads the adapter-owned store and only writes state
	 * when the proposal itself changes.
	 */
	$effect(() => {
		const current = instrument;
		let frame = 0;
		let seen: string | null = null;
		const watch = () => {
			frame = requestAnimationFrame(watch);
			const next = current?.pausedProposal() ?? null;
			const key = next === null ? null : `${next.wallId}\u0000${next.label}`;
			if (key !== seen) {
				seen = key;
				paused = next;
			}
		};
		frame = requestAnimationFrame(watch);
		return () => cancelAnimationFrame(frame);
	});


	async function commit(id: string): Promise<void> {
		error = null;
		const current = currentController;
		const outcome = await current?.commit(id);
		if (!alive || current !== currentController) return;
		if (outcome !== undefined && (outcome.kind === 'invalid' || outcome.kind === 'refused')) {
			error = outcome.message;
		}
		refresh();
	}

	async function resumePaused(): Promise<void> {
		error = null;
		const current = currentController;
		const outcome = await current?.resumePaused();
		if (!alive || current !== currentController) return;
		if (outcome !== undefined && (outcome.kind === 'invalid' || outcome.kind === 'refused')) {
			error = outcome.message;
		}
		refresh();
	}

	function discardPaused(): void {
		error = null;
		currentController?.discardPaused();
		refresh();
	}

	/** Restore the accepted value without committing an abandoned DOM draft. */
	function restoreText(id: string, input: HTMLInputElement): void {
		const text = currentController?.fields().find((field) => field.id === id)?.text ?? '';
		input.value = focusedField === id ? text : compactMeasure(text);
	}

	function discard(id: string, input?: HTMLInputElement): void {
		error = null;
		currentController?.cancel(id);
		refresh();
		if (input !== undefined) restoreText(id, input);
	}

	function onInput(id: string, event: Event): void {
		currentController?.edit(id, (event.currentTarget as HTMLInputElement).value);
	}
</script>

{#snippet fieldRow(field: LayoutFieldState)}
	<label class="field">
		<span>{field.label}</span>
		<input
			type="text"
			inputmode="decimal"
			data-field={field.id}
			value={focusedField === field.id ? field.text : compactMeasure(field.text)}
			onfocus={(event) => {
				focusedField = field.id;
				event.currentTarget.value =
					currentController?.fields().find((value) => value.id === field.id)?.text ?? field.text;
			}}
			aria-invalid={field.error === null ? undefined : 'true'}
			oninput={(event) => onInput(field.id, event)}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					void commit(field.id);
				} else if (event.key === 'Escape') {
					event.preventDefault();
					discard(field.id, event.currentTarget as HTMLInputElement);
				}
			}}
			onblur={(event) => {
				// Removing the focused input during an accepted install can blur
				// it after this panel or its keyed field row has retired. Read the
				// captured DOM identity, never the row's destroyed derived value.
				const input = event.currentTarget;
				const id = input.dataset.field;
				if (!alive || !input.isConnected || id === undefined) return;
				focusedField = null;
				currentController?.blur(id);
				refresh();
				restoreText(id, input);
			}}
		/>
		<span class="unit">{field.unit === 'm' ? 'm' : field.unit === 'deg' ? '°' : ''}</span>
	</label>
{/snippet}

{#if instrument !== null}
	<div class="card-fields" data-layout-card-fields>
		<div class="primary-fields">
			{#each primaryFields as field (field.id)}{@render fieldRow(
					field
				)}{/each}
		</div>
		<!-- C3/D12 — the foot icon enters; the one Unroll row owns the amount. -->
		{#if unfoldWall !== null}
			<div class="unroll-entry">
				<button
					type="button"
					class:active={unfoldActive}
					class="unroll-icon"
					aria-label={unfoldActive ? 'Put back the Wall' : 'Unroll the Wall'}
					title={unfoldActive ? 'Put back' : 'Unroll Wall'}
					data-wall-unroll-entry
					onclick={toggleUnfold}
				>
					<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true">
						<path d="M3 2.5h7.5a2 2 0 0 1 0 4H5.5a2 2 0 0 0 0 4H13" />
						<path d="m11 8.5 2 2-2 2" />
					</svg>
				</button>
				{#if unfoldActive}<LayoutWallUnfold wall={unfoldWall} />{/if}
			</div>
		{/if}
		{#if paused !== null}
			<div class="paused" data-layout-paused>
				<p>Paused after a reading change — {paused.label}</p>
				<button type="button" data-resume-paused onclick={resumePaused}>Resume</button>
				<button type="button" onclick={discardPaused}>Discard</button>
			</div>{/if}
		{#if error !== null}<p class="error" role="alert">{error}</p>
		{/if}
		{#if footer}{@render footer()}{/if}
		{#snippet details()}
			<div class="precision">
				{#if instrument.subject.kind === 'wall'}
					<!-- Base and Top are foreseen, not built: shown, disabled, never a working field. -->
					{#each ['Base', 'Top'] as label (label)}
						<label class="field placeholder" title="{label} is coming soon">
							<span>{label}</span>
							<input type="text" value="—" disabled aria-disabled="true" data-field-placeholder={label.toLowerCase()} />
						</label>
					{/each}
				{/if}
				{#each ordinaryFields.filter(field => instrument.subject.kind === 'wall' ? field.id === 'thickness' : field.id === 'offset' || field.id === 'sillHeight') as field (field.id)}
					{@render fieldRow(field.id === 'thickness' ? { ...field, label: 'Thick' } : field)}
				{/each}
			</div>
		{/snippet}
		{#if more}{@render more(details)}{/if}
		{#if secondary}{@render secondary()}{/if}
	</div>
{/if}

<style>
	.primary-fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(58px, 1fr));
		gap: 6px;
		padding: 0 12px 8px;
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
	input[aria-invalid='true'] {
		border-color: var(--shell-refuse);
	}
	.unit {
		position: absolute;
		right: 6px;
		bottom: 6px;
		font-size: 10px;
		pointer-events: none;
	}
	.unroll-entry {
		display: grid;
		gap: 4px;
		padding: 2px 12px 6px;
	}
	.unroll-icon {
		display: inline-grid;
		place-items: center;
		width: 26px;
		height: 26px;
		padding: 0;
		border: 1px solid var(--shell-field-line);
		border-radius: 7px;
		background: var(--shell-field);
		color: var(--shell-ink-2);
	}
	.unroll-icon:hover {
		border-color: var(--shell-field-line-strong);
		color: var(--shell-ink);
	}
	.unroll-icon.active {
		border-color: var(--shell-leaf);
		color: var(--shell-leaf);
	}
	.precision {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 6px;
		padding: 2px 12px 6px;
	}
	.placeholder input {
		border-style: dashed;
		background: transparent;
		color: var(--shell-ink-2);
		cursor: default;
	}
	.error {
		margin: 0;
		padding: 4px 12px;
		color: var(--shell-refuse);
		font-size: 11px;
	}
	.paused {
		padding: 6px 12px;
		font-size: 11px;
	}
	.paused p {
		margin: 0;
	}
	button {
		min-height: 26px;
		border: 1px solid var(--shell-field-line);
		border-radius: 6px;
		background: var(--shell-field);
		color: inherit;
		cursor: pointer;
	}
	@media (pointer: coarse) {
		input,
		button {
			min-height: 44px;
			min-width: 44px;
		}
		.primary-fields {
			grid-template-columns: repeat(auto-fit, minmax(64px, 1fr));
		}
		.unit {
			bottom: 14px;
		}
	}
</style>
