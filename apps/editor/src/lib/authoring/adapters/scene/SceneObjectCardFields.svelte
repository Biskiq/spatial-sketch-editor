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
	import { onDestroy, untrack } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import {
		sceneObjectCardController,
		type SceneObjectCardController
	} from './object-card';
	import { SCENE_OBJECT_CARD_FIELD_IDS, type SceneObjectCardFieldId } from './object-marks';

	let { services }: { services: StageAdapterServices } = $props();

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
			primary?.domain === 'scene' && primary.subject.kind === 'entity'
				? primary.subject.id
				: null;
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
				errors[id] =
					error instanceof Error ? error.message : 'The accepted install failed.';
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
</script>

{#if controller !== null}
	<div class="object-fields" data-scene-object-card-fields aria-label="Scene object fields">
		<fieldset disabled={busy}>
			<legend>Fields</legend>
			{#each SCENE_OBJECT_CARD_FIELD_IDS as id (id)}
				{@const field = controller.fields().find((entry) => entry.id === id)}
				{#if field !== undefined}
					<label class="field">
						<span>{field.label}</span>
						<input
							type="text"
							inputmode="decimal"
							data-field={id}
							bind:value={values[id]}
							aria-invalid={errorOf(id) === null ? undefined : 'true'}
							oninput={(event) => edit(id, event.currentTarget.value)}
							onkeydown={(event) => onKeydown(event, id)}
							onblur={() => onBlur(id)}
						/>
						<span class="unit">{field.unit === 'm' ? 'm' : field.unit === 'deg' ? '°' : ''}</span>
						{#if errorOf(id) !== null}
							<span class="refusal" role="alert">{errorOf(id)}</span>
						{/if}
					</label>
				{/if}
			{/each}
		</fieldset>
	</div>
{/if}

<style>
	.object-fields {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.6rem;
		font-size: 0.8rem;
	}
	fieldset {
		display: grid;
		gap: 0.35rem;
		border: 0;
		padding: 0;
		margin: 0;
	}
	legend {
		margin: 0 0 0.2rem;
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
	.refusal {
		grid-column: 1 / -1;
		font-size: 0.72rem;
		color: #a33b24;
	}
	.field:focus-within span:first-child {
		outline: 2px solid var(--plate-focus, #2f6f52);
		outline-offset: 1px;
	}
</style>
