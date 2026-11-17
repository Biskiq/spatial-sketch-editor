<script lang="ts">
	/**
	 * The one Card of an outline revision.
	 *
	 * It shows the generator's existing anchors (never a generated section), their
	 * U/V controls in the generator's own plane, the existing smooth flag and the
	 * physical extrusion extent. Every change previews through the same
	 * `set-form-profile` planner Apply submits; nothing commits on blur, Enter or
	 * unmount. Apply is the task's only write; Discard and close restore the
	 * accepted body.
	 *
	 * The extent control is the extent fact's only writer while this task is open:
	 * the object Card omits that Size field, so two controls never compete for one
	 * dimension.
	 */
	import { onDestroy } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { PROFILE_LIMITS } from '@portfolio/geometry-core';
	import {
		profileRevisionSession,
		type ProfileRevisionSession,
		type ProfileRevisionState
	} from './profile-revision';

	let { services }: { services: StageAdapterServices } = $props();

	const session: ProfileRevisionSession | null = profileRevisionSession();
	let view = $state<ProfileRevisionState | null>(session?.state() ?? null);
	let busy = $state(false);
	let message = $state('');
	/** Which control holds focus; the accepted values do not overwrite a live draft. */
	let focused = $state<string | null>(null);
	let uText = $state<string[]>([]);
	let vText = $state<string[]>([]);
	let extentText = $state('');
	let alive = true;

	function numbers(state: ProfileRevisionState | null): void {
		uText = (state?.anchors ?? []).map((anchor) => String(anchor.u));
		vText = (state?.anchors ?? []).map((anchor) => String(anchor.v));
		extentText = state === null ? '' : String(round(state.physicalExtent));
	}

	function round(value: number): number {
		return Math.round(value * 1000) / 1000;
	}

	function refresh(): void {
		view = session?.state() ?? null;
		if (focused === null) numbers(view);
	}

	refresh();
	const unsubscribe = session?.subscribe(refresh);
	onDestroy(() => {
		alive = false;
		unsubscribe?.();
	});

	function parse(text: string): number | null {
		const trimmed = text.trim();
		if (trimmed.length === 0) return null;
		const value = Number(trimmed);
		return Number.isFinite(value) ? value : null;
	}

	function editAnchor(index: number, axis: 'u' | 'v', text: string): void {
		if (axis === 'u') uText = uText.map((entry, at) => (at === index ? text : entry));
		else vText = vText.map((entry, at) => (at === index ? text : entry));
		const value = parse(text);
		if (value === null) return;
		session?.setAnchor(index, axis === 'u' ? { u: value } : { v: value });
	}

	function toggleSmooth(index: number, smooth: boolean): void {
		session?.setAnchor(index, { smooth });
	}

	function editExtent(text: string): void {
		extentText = text;
		const value = parse(text);
		if (value === null || !(value > 0)) return;
		session?.setExtentPhysical(value);
	}

	async function apply(): Promise<void> {
		if (busy || session === null) return;
		busy = true;
		message = '';
		try {
			const outcome = await session.apply();
			if (!alive) return;
			if (outcome.kind === 'installed' || outcome.kind === 'no-op') {
				message = outcome.kind === 'installed' ? 'Outline applied.' : 'Nothing changed.';
				services.stage.closeTask();
				return;
			}
			if (outcome.kind === 'refused') message = outcome.message;
			refresh();
		} catch (error) {
			if (alive) message = error instanceof Error ? error.message : 'The revision was not installed.';
		} finally {
			if (alive) busy = false;
		}
	}

	function discard(): void {
		if (busy) return;
		session?.discard();
		services.stage.closeTask();
	}

	/** Physical metres per source extent unit, for the extent slider's bounds. */
	const extentFactor = $derived(view === null || !(view.extent > 0) ? 1 : view.physicalExtent / view.extent);
	const extentMin = $derived(PROFILE_LIMITS.minExtentMeters * extentFactor);
	const extentMax = $derived(PROFILE_LIMITS.maxExtentMeters * extentFactor);
</script>

{#if session !== null && view !== null}
	<div class="outline-task" data-profile-revision data-profile-plane={view.plane}>
		<p class="hint">
			{view.plane === 'plan' ? 'Plan profile' : 'Elevation profile'} · drag an anchor in the reading, or
			type its U and V. Keys, plane and size stay as they are.
		</p>
		<div class="anchors" role="list" aria-label="Outline anchors">
			{#each view.anchors as anchor, index (anchor.key)}
				<div class="anchor" role="listitem" data-profile-anchor={index}>
					<span class="key" title={`Key ${anchor.key}`}>A{index + 1}</span>
					<label>
						<span>U</span>
						<input
							type="text"
							inputmode="decimal"
							data-profile-u={index}
							value={uText[index] ?? ''}
							onfocus={() => (focused = `u-${index}`)}
							oninput={(event) => editAnchor(index, 'u', event.currentTarget.value)}
							onblur={() => {
								focused = null;
								numbers(view);
							}}
						/>
					</label>
					<label>
						<span>V</span>
						<input
							type="text"
							inputmode="decimal"
							data-profile-v={index}
							value={vText[index] ?? ''}
							onfocus={() => (focused = `v-${index}`)}
							oninput={(event) => editAnchor(index, 'v', event.currentTarget.value)}
							onblur={() => {
								focused = null;
								numbers(view);
							}}
						/>
					</label>
					<label class="smooth">
						<input
							type="checkbox"
							data-profile-smooth={index}
							checked={anchor.smooth}
							onchange={(event) => toggleSmooth(index, event.currentTarget.checked)}
						/>
						<span>Smooth</span>
					</label>
				</div>
			{/each}
		</div>
		<div class="extent">
			<label>
				<span>{view.extentLabel} (extent)</span>
				<input
					type="text"
					inputmode="decimal"
					data-profile-extent
					value={extentText}
					onfocus={() => (focused = 'extent')}
					oninput={(event) => editExtent(event.currentTarget.value)}
					onblur={() => {
						focused = null;
						numbers(view);
					}}
				/>
				<span class="unit">m</span>
			</label>
			<input
				type="range"
				data-profile-extent-range
				aria-label={`${view.extentLabel} (extent)`}
				min={extentMin}
				max={extentMax}
				step="0.001"
				value={view.physicalExtent}
				oninput={(event) => editExtent(event.currentTarget.value)}
			/>
			<p class="note">Physical {view.extentLabel.toLowerCase()}; converts through the current size.</p>
		</div>
		{#if view.refusal !== null}
			<p class="refusal" role="alert" data-profile-refusal>{view.refusal}</p>
		{/if}
		{#if message}
			<p class="message" role="status">{message}</p>
		{/if}
		<div class="actions">
			<button
				type="button"
				class="primary"
				data-profile-apply
				disabled={busy || !view.dirty || view.refusal !== null}
				onclick={() => void apply()}
			>
				{busy ? 'Applying…' : 'Apply'}
			</button>
			<button type="button" data-profile-discard disabled={busy} onclick={discard}>Discard</button>
			<span class="status">{view.anchors.length} anchors · keys preserved</span>
		</div>
	</div>
{/if}

<style>
	.outline-task {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 0 12px 12px;
		font-size: 11.5px;
		color: var(--shell-ink-2);
	}
	.hint,
	.note {
		margin: 0;
		color: var(--shell-ink-3);
	}
	.anchors {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 15rem;
		overflow: auto;
	}
	.anchor {
		display: grid;
		grid-template-columns: 2.2rem 1fr 1fr auto;
		align-items: end;
		gap: 6px;
	}
	.anchor label,
	.extent label {
		display: grid;
		gap: 2px;
		position: relative;
		min-width: 0;
	}
	.anchor label > span,
	.extent label > span {
		color: var(--shell-ink-3);
		font-size: 10px;
	}
	.key {
		align-self: center;
		color: var(--shell-ink-3);
		font-family: var(--shell-mono);
	}
	input[type='text'] {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		height: 26px;
		padding: 0 6px;
		border: 1px solid var(--shell-field-line);
		border-radius: 6px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font: 12px var(--shell-mono);
	}
	input[type='text']:focus {
		background: var(--shell-field-focus);
		border-color: var(--shell-leaf);
	}
	.smooth {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: 26px;
	}
	.extent {
		display: grid;
		gap: 4px;
	}
	.unit {
		position: absolute;
		right: 6px;
		bottom: 6px;
		color: var(--shell-ink-3);
		font-size: 10px;
	}
	input[type='range'] {
		width: 100%;
	}
	.refusal {
		margin: 0;
		color: var(--shell-refuse);
	}
	.message {
		margin: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	button {
		min-height: 30px;
		padding: 4px 10px;
		border: 1px solid var(--shell-field-line);
		border-radius: 9px;
		background: var(--shell-field);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button.primary {
		border-color: transparent;
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
	}
	button:disabled {
		cursor: default;
		opacity: 0.55;
	}
	.status {
		margin-left: auto;
		color: var(--shell-ink-3);
	}
	@media (pointer: coarse) {
		input[type='text'] {
			min-height: 44px;
		}
		button {
			min-height: 44px;
			padding: 6px 14px;
		}
	}
</style>
