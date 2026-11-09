<script lang="ts">
	/**
	 * Experience review 1 (§14) — the World environment's home on the Stage.
	 *
	 * A chip after Show, in both lenses, names the World's saved environment. It
	 * opens the quick pick (the presets, the shelf saved looks will join, and *Edit
	 * environment…*), and the World › Environment panel, where custom sun, sky and
	 * exposure controls will live. Every pick is the one `scene-environment-set`
	 * change, so it is one Undo. "Plain Paper while editing" is a browser preference
	 * and is never saved.
	 */
	import type { SceneEnvironmentPreset } from '@portfolio/project-model/units';
	import { WORLD_ENVIRONMENT_CHOICES, worldEnvironmentLook } from '$lib/render/world-environment';
	import ShellIcon from './ShellIcon.svelte';

	let {
		environment = 'paper',
		onEnvironment,
		editOnPaper = false,
		onEditOnPaper,
		busy = false
	}: {
		environment?: SceneEnvironmentPreset;
		onEnvironment: (preset: SceneEnvironmentPreset) => void;
		editOnPaper?: boolean;
		onEditOnPaper: (value: boolean) => void;
		busy?: boolean;
	} = $props();

	let open = $state<'pick' | 'panel' | null>(null);
	let root = $state<HTMLElement | undefined>(undefined);
	const label = $derived(WORLD_ENVIRONMENT_CHOICES.find((choice) => choice.preset === environment)?.label ?? 'Paper');

	function swatch(preset: SceneEnvironmentPreset): string {
		const look = worldEnvironmentLook(preset);
		if (look === null) return 'linear-gradient(#e9ebe6, #e9ebe6)';
		return `linear-gradient(${look.sky[0]}, ${look.sky[1]} 55%, ${look.haze} 56%, ${look.ground})`;
	}

	// A press outside closes the quick pick or the panel.
	$effect(() => {
		if (open === null) return;
		const close = (event: PointerEvent) => {
			if (root !== undefined && event.target instanceof Node && !root.contains(event.target)) open = null;
		};
		document.addEventListener('pointerdown', close, true);
		return () => document.removeEventListener('pointerdown', close, true);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="env-control"
	data-environment-control
	bind:this={root}
	onkeydown={(event) => {
		if (event.key !== 'Escape' || open === null) return;
		event.stopPropagation();
		open = null;
	}}
>
	<button
		type="button"
		class="env-chip"
		aria-expanded={open !== null}
		aria-haspopup="true"
		title="Environment: the World's sky, ground and light"
		data-environment-chip
		onclick={() => (open = open === null ? 'pick' : null)}
	>
		<i class="env-swatch" style:background={swatch(environment)}></i>{label}<ShellIcon name="chevronDown" size={12} />
	</button>
	{#if open === 'pick'}
		<div class="env-pop" role="dialog" aria-label="Environment">
			<header><strong>Environment</strong><span>World · saved</span></header>
			<div class="env-grid" role="group" aria-label="World environment" data-environment-picker>
				{#each WORLD_ENVIRONMENT_CHOICES as choice (choice.preset)}
					<button
						type="button"
						class="env-tile"
						aria-pressed={environment === choice.preset}
						data-environment={choice.preset}
						disabled={busy}
						onclick={() => onEnvironment(choice.preset)}
					>
						<i style:background={swatch(choice.preset)}></i>
						<span>{choice.label}</span>
					</button>
				{/each}
			</div>
			<div class="env-shelf"><span>Your environments</span><small>Saved custom looks will appear here.</small></div>
			<button type="button" class="env-edit" data-environment-edit onclick={() => (open = 'panel')}>Edit environment…</button>
		</div>
	{:else if open === 'panel'}
		<section class="env-panel" aria-labelledby="env-panel-title" data-environment-panel>
			<header>
				<div>
					<span class="env-eyebrow">WORLD</span>
					<h3 id="env-panel-title">Environment</h3>
				</div>
				<button type="button" class="env-close" aria-label="Close Environment" onclick={() => (open = null)}
					><ShellIcon name="close" size={14} /></button
				>
			</header>
			<p class="env-note">Saved with the World. Preview, snapshots and the published visit use it.</p>
			<div class="env-section">
				<strong>Preset</strong>
				<div class="env-grid" role="group" aria-label="World environment preset">
					{#each WORLD_ENVIRONMENT_CHOICES as choice (choice.preset)}
						<button
							type="button"
							class="env-tile"
							aria-pressed={environment === choice.preset}
							disabled={busy}
							onclick={() => onEnvironment(choice.preset)}
						>
							<i style:background={swatch(choice.preset)}></i>
							<span>{choice.label}</span>
						</button>
					{/each}
				</div>
			</div>
			{#each [{ title: 'Sun', body: 'Direction and time of day' }, { title: 'Sky & ground', body: 'Your own colours' }, { title: 'Exposure', body: 'Overall brightness' }] as later (later.title)}
				<div class="env-section later">
					<strong>{later.title}</strong><span class="env-later">later</span>
					<small>{later.body}</small>
				</div>
			{/each}
			<label class="env-pref">
				<input type="checkbox" checked={editOnPaper} onchange={() => onEditOnPaper(!editOnPaper)} />
				<span>Plain Paper while editing <small>· this browser</small></span>
			</label>
		</section>
	{/if}
</div>

<style>
	.env-control {
		position: relative;
		display: flex;
		align-items: center;
		padding: 3px;
		border: 1px solid var(--shell-hairline);
		border-radius: 10px;
		background: var(--shell-glass-light);
		box-shadow: var(--shell-furniture-shadow);
		backdrop-filter: blur(10px);
	}
	.env-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 8px 0 4px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--shell-ink);
		font: inherit;
		font-size: var(--shell-text-body);
		cursor: pointer;
	}
	.env-chip:hover {
		background: rgb(27 32 28 / 0.06);
	}
	.env-chip[aria-expanded='true'] {
		background: var(--shell-action);
		color: var(--shell-on-action);
	}
	.env-chip:focus-visible,
	.env-tile:focus-visible,
	.env-edit:focus-visible {
		outline: var(--shell-focus-ring-light);
		outline-offset: 1px;
	}
	.env-swatch {
		width: 20px;
		height: 20px;
		border-radius: 5px;
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.1);
	}
	.env-pop,
	.env-panel {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		z-index: 8;
		display: grid;
		gap: 8px;
		padding: 12px;
		border: 1px solid var(--shell-hairline);
		border-radius: 14px;
		background: var(--shell-popover);
		color: var(--shell-ink);
		box-shadow: var(--shell-shadow);
		font-size: var(--shell-text-body);
	}
	.env-pop {
		width: 300px;
	}
	.env-panel {
		width: 280px;
		padding: 14px;
	}
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	header span {
		color: var(--shell-ink-3);
		font-size: var(--shell-text-utility);
	}
	.env-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
	}
	.env-tile {
		display: grid;
		gap: 4px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--shell-ink-2);
		font: var(--shell-text-label) var(--shell-sans);
		text-align: center;
		cursor: pointer;
	}
	.env-tile i {
		display: block;
		height: 40px;
		border: 1px solid var(--shell-hairline);
		border-radius: 8px;
	}
	.env-tile[aria-pressed='true'] i {
		outline: var(--shell-focus-ring-light);
		outline-offset: 1px;
	}
	.env-tile[aria-pressed='true'] span {
		color: var(--shell-ink);
		font-weight: 600;
	}
	.env-shelf {
		display: grid;
		padding: 7px 9px;
		border: 1px dashed var(--shell-hairline-strong);
		border-radius: 9px;
	}
	.env-shelf small,
	.env-section small,
	.env-pref small {
		color: var(--shell-ink-3);
		font-size: var(--shell-text-label);
	}
	.env-edit {
		padding: 7px;
		border: 0;
		border-radius: 8px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font: 500 var(--shell-text-body) var(--shell-sans);
		cursor: pointer;
	}
	.env-panel header {
		align-items: flex-start;
	}
	.env-eyebrow {
		color: var(--shell-ink-3);
		font: 600 var(--shell-text-meta) var(--shell-sans);
		letter-spacing: 0.14em;
	}
	.env-panel h3 {
		margin: 2px 0 0;
		font: 600 var(--shell-text-title)/1.25 var(--shell-sans);
	}
	.env-close {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border: 0;
		border-radius: 7px;
		background: none;
		color: var(--shell-ink-3);
		cursor: pointer;
	}
	.env-note {
		margin: 0;
		color: var(--shell-ink-3);
		font-size: var(--shell-text-utility);
	}
	.env-section {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 6px;
		padding-top: 8px;
		border-top: 1px solid var(--shell-hairline);
	}
	.env-section .env-grid,
	.env-section small {
		grid-column: 1 / -1;
	}
	.env-section.later strong {
		color: var(--shell-ink-2);
	}
	.env-later {
		padding: 1px 7px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 999px;
		color: var(--shell-ink-3);
		font-size: var(--shell-text-meta);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.env-pref {
		display: flex;
		align-items: center;
		gap: 7px;
		padding-top: 8px;
		border-top: 1px solid var(--shell-hairline);
		color: var(--shell-ink-2);
		font-size: var(--shell-text-control);
	}
	.env-pref input {
		accent-color: var(--shell-action);
	}
</style>
