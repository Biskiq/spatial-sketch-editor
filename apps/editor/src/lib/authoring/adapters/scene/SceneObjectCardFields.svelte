<script lang="ts">
	/**
	 * R217.S08 — the Card's Position, Yaw and Size writer for a Scene object.
	 *
	 * The fields are the Arrange instrument's exact values, moved to the Card.
	 * Each one submits the planner its mark submits, shows that planner's refusal
	 * under the field, and follows the Card's entry grammar: Enter commits once,
	 * the first Escape restores the accepted text, a second Escape leaves the key
	 * to the shell (which clears the selection), and blur never commits.
	 */
	import { onDestroy, untrack, type Snippet } from 'svelte';
	import { compactMeasure } from '$lib/authoring/stage/shell/compact-measure';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { sceneObjectCardController, type SceneObjectCardController } from './object-card';
	import { SCENE_OBJECT_CARD_FIELD_IDS, type SceneObjectCardFieldId } from './object-marks';

	let {
		services,
		detailOpen = false,
		footer
	}: { services: StageAdapterServices; detailOpen?: boolean; footer?: Snippet } = $props();

	let alive = true;
	onDestroy(() => {
		alive = false;
	});

	let busy = $state(false);
	/**
	 * One controller per selected entity. The controller reads the live accepted
	 * source on every `fields()` call, so a surface notification only needs to
	 * re-sync the inputs; rebuilding it would discard every uncommitted draft.
	 */
	let controller = $state<SceneObjectCardController | null>(null);
	let activeEntityId: string | null = null;

	let values = $state<Record<SceneObjectCardFieldId, string>>({
		'position-x': '',
		'position-z': '',
		yaw: '',
		size: ''
	});
	/** The planner refusal currently under each field, held as component state. */
	let errors = $state<Partial<Record<SceneObjectCardFieldId, string | null>>>({});

	function resetFields(): void {
		for (const id of SCENE_OBJECT_CARD_FIELD_IDS) {
			values[id] = '';
			errors[id] = null;
		}
	}

	function sync(): void {
		const current = controller;
		if (current === null) return;
		for (const field of current.fields()) {
			values[field.id] = field.text;
			errors[field.id] = field.error;
		}
	}

	/**
	 * A subject change owns a fresh draft map; an ordinary surface notification
	 * keeps the controller and drafts while refreshing accepted values beneath them.
	 */
	function reconcile(): void {
		const primary = services.stage.selectionState().primary;
		const nextEntityId =
			primary?.domain === 'scene' && primary.subject.kind === 'entity' ? primary.subject.id : null;
		if (nextEntityId !== activeEntityId) {
			activeEntityId = nextEntityId;
			controller = nextEntityId === null ? null : sceneObjectCardController(services, nextEntityId);
			resetFields();
		} else if (nextEntityId !== null && controller === null) {
			// The subject was selected before its Scene row was live. Retry when the
			// surface reports accepted state rather than waiting for a selection change.
			controller = sceneObjectCardController(services, nextEntityId);
		}
		sync();
	}

	$effect(() => {
		untrack(reconcile);
		return services.stage.onAdaptersChanged(() => untrack(reconcile));
	});

	function errorOf(id: SceneObjectCardFieldId): string | null {
		return errors[id] ?? null;
	}

	function restore(id: SceneObjectCardFieldId): void {
		const current = controller;
		if (current === null) return;
		const text = current.fields().find((field) => field.id === id)?.text ?? '';
		values[id] = text;
		errors[id] = null;
	}

	function edit(id: SceneObjectCardFieldId, text: string): void {
		const current = controller;
		if (current === null) return;
		current.edit(id, text);
		errors[id] = current.fields().find((field) => field.id === id)?.error ?? null;
	}

	async function commit(id: SceneObjectCardFieldId): Promise<void> {
		const current = controller;
		if (current === null || busy) return;
		busy = true;
		try {
			const outcome = await current.commit(id);
			if (!alive) return;
			// The controller reads the accepted source live, so a success needs no
			// rebuild; republish its fields after every outcome. A refusal must stay
			// in the field that caused it, and a success must show the accepted value.
			sync();
		} catch (error) {
			if (alive) {
				errors[id] = error instanceof Error ? error.message : 'The accepted install failed.';
			}
		} finally {
			if (alive) busy = false;
		}
	}

	function onKeydown(event: KeyboardEvent, id: SceneObjectCardFieldId): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			void commit(id);
			return;
		}
		if (event.key !== 'Escape') return;
		const discarded = controller?.cancel(id) === true;
		restore(id);
		// The first Escape restores the draft; only a field with nothing to discard
		// leaves Escape to the shell so it can clear the selection.
		if (discarded) {
			event.preventDefault();
			event.stopPropagation();
		}
	}

	function onBlur(id: SceneObjectCardFieldId): void {
		// Blur never commits. Restore the accepted text so a rejected draft cannot
		// remain visible as if it had been written.
		controller?.blur(id);
		restore(id);
		errors[id] = null;
	}
	let focusedField = $state<SceneObjectCardFieldId | null>(null);
</script>

{#snippet fieldRow(id: SceneObjectCardFieldId)}
	{@const field = controller?.fields().find((entry) => entry.id === id)}
	{#if field !== undefined}
		<label class="field">
			<span>{field.label}</span>
			<input
				type="text"
				inputmode="decimal"
				data-field={id}
				value={focusedField === id ? values[id] : compactMeasure(values[id])}
				onfocus={(event) => { focusedField = id; event.currentTarget.value = values[id]; }}
				aria-invalid={errorOf(id) === null ? undefined : 'true'}
				oninput={(event) => {
					values[id] = event.currentTarget.value;
					edit(id, event.currentTarget.value);
				}}
				onkeydown={(event) => onKeydown(event, id)}
				onblur={(event) => {
					focusedField = null;
					onBlur(id);
					event.currentTarget.value = compactMeasure(values[id]);
				}}
			/>
			<span class="unit">{field.unit === 'm' ? 'm' : field.unit === 'deg' ? '°' : ''}</span>
			{#if errorOf(id) !== null}
				<span class="refusal" role="alert">{errorOf(id)}</span>
			{/if}
		</label>
	{/if}
{/snippet}
{#if controller !== null}
	<div class="object-fields" data-scene-object-card-fields aria-label="Scene object fields">
		<fieldset disabled={busy}>{@render fieldRow('size')}</fieldset>
		{#if footer}{@render footer()}{/if}
		{#if detailOpen}<fieldset class="precision" disabled={busy}>
				{#each SCENE_OBJECT_CARD_FIELD_IDS.filter((id) => id !== 'size') as id (id)}{@render fieldRow(
						id
					)}{/each}
			</fieldset>{/if}
	</div>
{/if}

<style>
	fieldset {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
		gap: 6px;
		border: 0;
		padding: 0 12px 8px;
		margin: 0;
	}
	.precision {
		border-top: 1px solid var(--shell-hairline, #e1e4de);
		padding-top: 8px;
	}
	.field {
		display: grid;
		gap: 2px;
		position: relative;
		min-width: 0;
		font-size: 10.5px;
		color: var(--shell-ink-2, #4a524c);
	}
	input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		height: 26px;
		padding: 0 20px 0 6px;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 6px;
		background: var(--shell-control-surface, #fafbf9);
		color: var(--shell-ink, #1b201c);
		font: 12px var(--shell-mono, monospace);
	}
	.unit {
		position: absolute;
		right: 6px;
		bottom: 6px;
	}
	.refusal {
		color: var(--shell-refuse, #7e2718);
	}
	@media (pointer: coarse) {
		input {
			min-height: 44px;
		}
		.unit {
			bottom: 14px;
		}
	}
</style>
