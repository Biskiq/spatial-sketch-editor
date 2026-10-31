<script lang="ts">
	/**
	 * T1.P02.S02 — the **Card's** Layout field writer (formerly Dimensions).
	 *
	 * PLATE (Round 2, D9) makes the Card the one writer for ordinary dimensions, so
	 * the migrated fields render **here**: Wall height, thickness, exact length,
	 * angle and rigid move with one explicit fixed endpoint, and Opening offset,
	 * width, height and sill. The controller is the same one S05 shipped — same
	 * parsers, same refusals, same gesture lease, same one-history-entry-per-field
	 * commit — only its home moved. The name is not rendered here: the Card owns one
	 * name writer and this component must not become a second one.
	 *
	 * It renders what the framework-free controller owns: the accepted value, the
	 * edit buffer and the refusal reason. Enter commits, Esc and blur discard, and
	 * the DOM never turns an empty field into zero.
	 */
	import { onDestroy } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import type { LayoutFieldState, LayoutInstrument } from './instrument';
	import type { PausedWallProposal } from './paused-proposal';
	import { createCardFieldsInstrument } from './adapter-support';

	let { services }: { services: StageAdapterServices } = $props();
	// Check this before reading any derived state in an async continuation: a
	// successful install can destroy the panel before acceptance resolves.
	let alive = true;
	onDestroy(() => { alive = false; });

	let fields = $state<readonly LayoutFieldState[]>([]);
	let error = $state<string | null>(null);
	// Event continuations use this lifetime-owned reference, never an inert derived.
	let currentController: LayoutInstrument | null = null;
	/** A parameter a reading change preserved; Resume applies the captured value exactly. */
	let paused = $state<PausedWallProposal | null>(null);
	/** The explicit endpoint an exact length/angle edit keeps fixed. */
	let fixedEndpoint = $state<'start' | 'end'>('start');

	// The writer follows the one canonical selection: a new subject rebuilds the
	// controller from the accepted source, so a stale selection can never keep
	// editing the subject it was opened on.
	const selectionKey = $derived.by(() => {
		const selection = services.stage.selection();
		return selection === null ? null : `${selection.sourceKind}:${selection.sourceId}`;
	});
	const instrument = $derived.by(() => {
		void selectionKey;
		return createCardFieldsInstrument(services);
	});
	const editable = $derived(
		fields.filter((field) => field.id !== 'name')
	);
	/** R217.S15 — the endpoint coordinates are the Card's one disclosed group. */
	const junctionFields = $derived(
		editable.filter((field) => field.id === 'startX' || field.id === 'startZ' || field.id === 'endX' || field.id === 'endZ')
	);
	const ordinaryFields = $derived(
		editable.filter((field) => field.id !== 'startX' && field.id !== 'startZ' && field.id !== 'endX' && field.id !== 'endZ')
	);
	const unavailableNote = $derived(
		instrument === null
			? ''
			: instrument.subject.kind === 'wall'
				? 'Read-only here: arch rise, Wall role and profile conversion have no supported writer.'
				: 'Read-only here: the hosting Wall and profile conversion have no supported writer.'
	);

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
		fixedEndpoint = current?.fixedEndpoint() ?? 'start';
		return () => {
			if (currentController === current) currentController = null;
			current?.dispose();
		};
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

	function chooseFixedEndpoint(next: 'start' | 'end'): void {
		fixedEndpoint = next;
		currentController?.setFixedEndpoint(next);
	}

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

	/**
	 * Restore the field's accepted text after a cancel/blur.
	 *
	 * The input is not a bound value: while the creator types, the DOM holds text
	 * the controller has not accepted, and `value={field.text}` only writes when
	 * the rendered expression *changes*. Restoring "3" over a typed "32.8" is
	 * therefore no change to Svelte, which leaves the rejected draft visible after
	 * Esc or blur. The element is synced from the controller explicitly.
	 */
	function restoreText(id: string, input: HTMLInputElement): void {
		input.value = currentController?.fields().find((field) => field.id === id)?.text ?? '';
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
			value={field.text}
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
				currentController?.blur(id);
				refresh();
				restoreText(id, input);
			}}
		/>
		<span class="unit">{field.unit === 'm' ? 'm' : field.unit === 'deg' ? '°' : ''}</span>
	</label>
{/snippet}

{#if instrument === null}
	<p class="empty">Select a Wall, Opening or Layout object to edit its measures.</p>
{:else}
	<div class="card-fields" data-layout-card-fields>
		{#if editable.length > 0}
			<p class="eyebrow">Fields</p>
		{/if}
		{#if paused !== null}
			<div class="paused" data-layout-paused>
				<p>Paused after a reading change — {paused.label}</p>
				<div class="paused-actions">
					<button type="button" data-resume-paused onclick={resumePaused}>Resume</button>
					<button type="button" onclick={discardPaused}>Discard</button>
				</div>
			</div>
		{/if}
		{#if instrument.subject.kind === 'wall' && editable.some((field) => field.id === 'length')}
			<fieldset class="fixed-endpoint" data-layout-fixed-endpoint>
				<legend>Fixed endpoint</legend>
				<label>
					<input
						type="radio"
						name="layout-fixed-endpoint"
						checked={fixedEndpoint === 'start'}
						onchange={() => chooseFixedEndpoint('start')}
					/>Start
				</label>
				<label>
					<input
						type="radio"
						name="layout-fixed-endpoint"
						checked={fixedEndpoint === 'end'}
						onchange={() => chooseFixedEndpoint('end')}
					/>End
				</label>
			</fieldset>
		{/if}
		{#each ordinaryFields as field (field.id)}
			{@render fieldRow(field)}
		{/each}
		{#if junctionFields.length > 0}
			<details class="junction-fields" data-layout-junction-fields>
				<summary>Start and End X/Z</summary>
				{#each junctionFields as field (field.id)}
					{@render fieldRow(field)}
				{/each}
			</details>
		{/if}
		{#if error !== null}
			<p class="error" role="alert">{error}</p>
		{/if}
		<p class="unavailable">{unavailableNote}</p>
	</div>
{/if}

<style>
	.card-fields {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.6rem;
		font-size: 0.8rem;
	}
	.eyebrow {
		margin: 0;
		color: var(--plate-ink-quiet, #5c665e);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.field {
		display: grid;
		grid-template-columns: 1fr 6rem auto;
		align-items: center;
		gap: 0.4rem;
	}
	input {
		min-height: 2.75rem;
		padding: 0.1rem 0.35rem;
		border: 1px solid var(--plate-control-edge, #cfd5cb);
		border-radius: 0.45rem;
		background: var(--plate-control-surface, #f5f6f4);
		color: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	input[aria-invalid='true'] {
		border-color: #a33b24;
	}
	.unit {
		font-size: 0.7rem;
		color: var(--plate-ink-quiet, #5c665e);
	}
	.error,
	.empty {
		margin: 0;
		font-size: 0.72rem;
		color: #a33b24;
	}
	.unavailable {
		margin: 0;
		font-size: 0.68rem;
		color: var(--plate-ink-quiet, #5c665e);
	}
	.junction-fields {
		display: grid;
		gap: 0.35rem;
		padding: 0.15rem 0.35rem;
		border: 1px solid var(--plate-control-edge, #cfd5cb);
		border-radius: 0.35rem;
	}
	.junction-fields summary {
		color: var(--plate-ink-quiet, #5c665e);
		font-size: 0.72rem;
		cursor: pointer;
	}
	.fixed-endpoint {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0;
		padding: 0.15rem 0.35rem;
		border: 1px solid var(--plate-control-edge, #cfd5cb);
		border-radius: 0.35rem;
		font-size: 0.72rem;
	}
	.fixed-endpoint legend {
		padding: 0 0.25rem;
		color: var(--plate-ink-quiet, #5c665e);
	}
	.fixed-endpoint label {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.fixed-endpoint input {
		min-height: auto;
	}
	.paused {
		display: grid;
		gap: 0.25rem;
		padding: 0.3rem 0.4rem;
		border: 1px dashed var(--plate-control-edge, #cfd5cb);
		border-radius: 0.35rem;
		font-size: 0.72rem;
	}
	.paused p {
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	.paused-actions {
		display: flex;
		gap: 0.4rem;
	}
	.paused button {
		min-height: 2.25rem;
		padding: 0.1rem 0.5rem;
		border: 1px solid var(--plate-control-edge, #cfd5cb);
		border-radius: 0.35rem;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.field:focus-within span:first-child,
	button:focus-visible {
		outline: 2px solid var(--plate-focus, #2f6f52);
		outline-offset: 1px;
	}
</style>
