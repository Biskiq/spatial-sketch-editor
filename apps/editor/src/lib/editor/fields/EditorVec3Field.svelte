<script lang="ts">
	import type { Vec3 } from '$lib/types/scene';
	import {
		createEditorVec3Drafts,
		editorVec3Changed,
		parseEditorVec3Drafts,
		type EditorVec3Drafts
	} from '../editor-vector';

	let {
		legend,
		value,
		step = 0.01,
		disabled = false,
		oncommit
	}: {
		legend: string;
		value: Vec3;
		step?: number;
		disabled?: boolean;
		oncommit: (value: Vec3) => boolean | void;
	} = $props();

	let fieldset = $state<HTMLFieldSetElement>();
	let drafts = $state<EditorVec3Drafts>(['', '', '']);
	let dirty = $state(false);
	let stepperInput: HTMLInputElement | null = null;

	function restore() {
		drafts = createEditorVec3Drafts(value);
		dirty = false;
	}

	$effect(() => {
		if (!dirty) restore();
	});

	function commit() {
		if (disabled || !dirty) return false;
		const next = parseEditorVec3Drafts(drafts);
		if (!next || !editorVec3Changed(next, value)) {
			restore();
			return false;
		}
		const committed = oncommit(next);
		dirty = false;
		if (committed === false) restore();
		return committed !== false;
	}

	function onInput(index: 0 | 1 | 2, event: Event) {
		drafts[index] = (event.currentTarget as HTMLInputElement).value;
		dirty = true;
		if (stepperInput === event.currentTarget) {
			queueMicrotask(() => commit());
		}
	}

	function onPointerDown(event: PointerEvent) {
		const input = event.currentTarget as HTMLInputElement;
		const rect = input.getBoundingClientRect();
		stepperInput = event.clientX >= rect.right - 22 ? input : null;
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commit();
			return;
		}
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			stepperInput = event.currentTarget as HTMLInputElement;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			restore();
		}
	}

	function onFocusOut() {
		queueMicrotask(() => {
			if (!fieldset?.contains(document.activeElement)) commit();
		});
	}
</script>

<fieldset bind:this={fieldset} {disabled} onfocusout={onFocusOut}>
	<legend>{legend}</legend>
	<div class="field-grid">
		{#each [{ axis: 'X', tone: 'x' }, { axis: 'Y', tone: 'y' }, { axis: 'Z', tone: 'z' }] as { axis, tone }, index}
			<label data-tone={tone} title={`${legend} ${axis}`}>
				<span class="axis-chip" aria-hidden="true">{axis}</span>
				<input
					type="number"
					{step}
					value={drafts[index]}
					aria-label={`${legend} ${axis}`}
					oninput={(event) => onInput(index as 0 | 1 | 2, event)}
					onpointerdown={onPointerDown}
					onpointerup={() => (stepperInput = null)}
					onkeydown={onKeyDown}
					onkeyup={() => (stepperInput = null)}
				/>
			</label>
		{/each}
	</div>
</fieldset>

<style>
	fieldset {
		margin: 0;
		padding: 0.65rem;
		border: 1px solid var(--editor-border-subtle);
		border-radius: 0.4rem;
	}

	fieldset:disabled {
		opacity: 0.52;
	}

	legend {
		padding: 0 0.25rem;
		color: var(--editor-text-muted);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.field-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.35rem;
	}

	label {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		min-width: 0;
		box-sizing: border-box;
		padding: 0 6px 0 2px;
		border: 1px solid var(--editor-border-subtle);
		border-radius: 5px;
		background: var(--editor-bg-control);
	}

	.axis-chip {
		display: inline-grid;
		flex: 0 0 auto;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: 3px;
		font: 700 10px/1 var(--editor-font);
	}

	/* Issue #35 — axis tones resolve through the canonical `--editor-axis-*`
	   tokens (tokens.css §8, theme-invariant). The chip background mixes the
	   axis token at 15% over transparent — the same arithmetic as the previous
	   rgba() literals, but a single source of truth. */
	label[data-tone='x'] .axis-chip {
		background: color-mix(in srgb, var(--editor-axis-x) 15%, transparent);
		color: var(--editor-axis-x);
	}

	label[data-tone='y'] .axis-chip {
		background: color-mix(in srgb, var(--editor-axis-y) 15%, transparent);
		color: var(--editor-axis-y);
	}

	label[data-tone='z'] .axis-chip {
		background: color-mix(in srgb, var(--editor-axis-z) 15%, transparent);
		color: var(--editor-axis-z);
	}

	input {
		flex: 1 1 auto;
		min-width: 0;
		width: 100%;
		box-sizing: border-box;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--editor-text-primary);
		font: 500 12.5px var(--editor-font);
		font-variant-numeric: tabular-nums;
	}

	input:focus {
		outline: none;
	}

	label:focus-within {
		outline: 1px solid var(--editor-accent);
		border-color: var(--editor-accent);
	}
</style>
