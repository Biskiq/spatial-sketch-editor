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
	import { onDestroy, type Snippet } from 'svelte';
	import { compactMeasure } from '$lib/authoring/stage/shell/compact-measure';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import type { LayoutFieldState, LayoutInstrument } from './instrument';
	import type { PausedWallProposal } from './paused-proposal';
	import { createCardFieldsInstrument } from './adapter-support';

	let {
		services,
		detailOpen = false,
		footer
	}: { services: StageAdapterServices; detailOpen?: boolean; footer?: Snippet } = $props();
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
	const editable = $derived(fields.filter((field) => field.id !== 'name'));
	/** R217.S15 — the endpoint coordinates are the Card's one disclosed group. */
	const junctionFields = $derived(
		editable.filter(
			(field) =>
				field.id === 'startX' || field.id === 'startZ' || field.id === 'endX' || field.id === 'endZ'
		)
	);
	const ordinaryFields = $derived(
		editable.filter(
			(field) =>
				field.id !== 'startX' && field.id !== 'startZ' && field.id !== 'endX' && field.id !== 'endZ'
		)
	);
	const primaryFields = $derived.by(() => {
		const ids = instrument?.subject.kind === 'wall' ? ['length', 'height'] : ['width', 'height', 'sillHeight'];
		return ids.flatMap(id => ordinaryFields.filter(field => field.id === id));
	});
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
		{#if paused !== null}
			<div class="paused" data-layout-paused>
				<p>Paused after a reading change — {paused.label}</p>
				<button type="button" data-resume-paused onclick={resumePaused}>Resume</button>
				<button type="button" onclick={discardPaused}>Discard</button>
			</div>{/if}
		{#if error !== null}<p class="error" role="alert">{error}</p>
		{/if}
		{#if footer}{@render footer()}{/if}
		{#if detailOpen}
			<div class="precision">
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
				{#each ordinaryFields.filter( (field) => (instrument.subject.kind === 'wall' ? !['length', 'height'].includes(field.id) : !['width', 'height', 'sillHeight'].includes(field.id)) ) as field (field.id)}
					{@render fieldRow(field)}
				{/each}
				{#if junctionFields.length > 0}
					<details data-layout-junction-fields>
						<summary>Start and End X/Z</summary>
						{#each junctionFields as field (field.id)}
							{@render fieldRow(field)}
						{/each}
					</details>
				{/if}
			</div>
		{/if}
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
		color: var(--shell-ink-2, #4a524c);
		font-size: 10.5px;
	}
	input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		height: 26px;
		padding: 0 18px 0 6px;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 6px;
		background: var(--shell-control-surface, #fafbf9);
		color: var(--shell-ink, #1b201c);
		font: 12px var(--shell-mono, monospace);
		font-variant-numeric: tabular-nums;
	}
	input:hover {
		border-color: var(--shell-hairline-strong, #cdd2ca);
	}
	input:focus {
		background: #fff;
		border-color: var(--shell-leaf, #4f8f6c);
	}
	input[aria-invalid='true'] {
		border-color: var(--shell-refuse, #7e2718);
	}
	.unit {
		position: absolute;
		right: 6px;
		bottom: 6px;
		font-size: 10px;
		pointer-events: none;
	}
	.precision {
		display: grid;
		gap: 6px;
		padding: 8px 12px;
		border-top: 1px solid var(--shell-hairline, #e1e4de);
	}
	.fixed-endpoint {
		display: flex;
		gap: 8px;
		margin: 0;
		padding: 4px;
		border: 1px solid var(--shell-hairline, #e1e4de);
		font-size: 11px;
	}
	.fixed-endpoint label {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.fixed-endpoint input {
		width: auto;
		height: auto;
	}
	.error {
		margin: 0;
		padding: 4px 12px;
		color: var(--shell-refuse, #7e2718);
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
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 6px;
		background: var(--shell-control-surface, #fafbf9);
		color: inherit;
		cursor: pointer;
	}
	summary {
		cursor: pointer;
		font-size: 11px;
	}
	@media (pointer: coarse) {
		input,
		button,
		summary,
		.fixed-endpoint label {
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
