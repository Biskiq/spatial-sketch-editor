<script lang="ts">
	/**
	 * T1.P01.S04 — the settle-measure surface for one Layout subject.
	 *
	 * It renders only what the framework-free controller owns: the accepted
	 * value, the edit buffer, and the refusal reason. Enter commits, Esc and blur
	 * discard, and the DOM never turns an empty field into zero.
	 */
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import type { LayoutFieldState } from './instrument';
	import { createDimensionsInstrument } from './adapter-support';

	let { services }: { services: StageAdapterServices } = $props();

	let fields = $state<readonly LayoutFieldState[]>([]);
	let error = $state<string | null>(null);

	// The instrument follows the one canonical selection: a new subject rebuilds the
	// controller from the accepted source, so a stale selection can never keep
	// editing the subject it was opened on.
	const selectionKey = $derived.by(() => {
		const selection = services.stage.selection();
		return selection === null ? null : `${selection.sourceKind}:${selection.sourceId}`;
	});
	const instrument = $derived.by(() => {
		void selectionKey;
		return createDimensionsInstrument(services);
	});
	const unavailableNote = $derived(
		instrument === null
			? ''
			: instrument.subject.kind === 'wall'
				? 'Read-only here: arch rise, Wall role and profile conversion have no supported writer.'
				: 'Read-only here: the hosting Wall and profile conversion have no supported writer.'
	);

	function refresh(): void {
		fields = instrument?.fields() ?? [];
	}

	$effect(() => {
		refresh();
	});

	// Unmount is the last cancel path: a proposal's host gesture lease must be
	// released exactly once, and nothing may be committed by leaving.
	$effect(() => {
		const current = instrument;
		return () => current?.dispose();
	});

	async function commit(id: string): Promise<void> {
		error = null;
		const outcome = await instrument?.commit(id);
		if (outcome !== undefined && (outcome.kind === 'invalid' || outcome.kind === 'refused')) {
			error = outcome.message;
		}
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
		input.value = instrument?.fields().find((field) => field.id === id)?.text ?? '';
	}

	function discard(id: string, input?: HTMLInputElement): void {
		error = null;
		instrument?.cancel(id);
		refresh();
		if (input !== undefined) restoreText(id, input);
	}

	function onInput(id: string, event: Event): void {
		instrument?.edit(id, (event.currentTarget as HTMLInputElement).value);
	}
</script>

{#if instrument === null}
	<p class="empty">Select a Wall, Opening or Layout object to inspect its measures.</p>
{:else}
	<div class="dimensions" data-layout-dimensions>
		<dl class="facts">
			{#each instrument.facts() as fact (fact.label)}
				<div><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
			{/each}
		</dl>
		{#each fields as field (field.id)}
			<label class="field">
				<span>{field.label}</span>
				<input
					type="text"
					inputmode="decimal"
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
						instrument?.blur(field.id);
						refresh();
						restoreText(field.id, event.currentTarget as HTMLInputElement);
					}}
				/>
				<span class="unit">{field.unit === 'm' ? 'm' : ''}</span>
			</label>
		{/each}
		{#if error !== null}
			<p class="error" role="alert">{error}</p>
		{/if}
		<p class="unavailable">{unavailableNote}</p>
	</div>
{/if}

<style>
	.dimensions {
		display: grid;
		gap: 0.35rem;
		font-size: 0.8rem;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 0.2rem 0.6rem;
		margin: 0;
	}
	.facts div {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	dt {
		color: var(--head-ink-quiet, #98a89c);
	}
	dd {
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	.field {
		display: grid;
		grid-template-columns: 1fr 6rem auto;
		align-items: center;
		gap: 0.4rem;
	}
	input {
		min-height: 1.8rem;
		padding: 0.1rem 0.35rem;
		border: 1px solid var(--chassis-hairline, #2f4a3d);
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	input[aria-invalid='true'] {
		border-color: #c2694f;
	}
	.unit {
		font-size: 0.7rem;
		color: var(--head-ink-quiet, #98a89c);
	}
	.error,
	.empty {
		margin: 0;
		font-size: 0.7rem;
		color: #c2694f;
	}
	.unavailable {
		margin: 0;
		font-size: 0.68rem;
		color: var(--head-ink-quiet, #98a89c);
	}
</style>
