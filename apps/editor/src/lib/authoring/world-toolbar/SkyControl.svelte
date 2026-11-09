<script lang="ts">
	/**
	 * The Sky segment of the Stage viewing bar. It is the existing
	 * `scene-environment-set` controller with a forest-bar face; the hour slider is
	 * visibly planned because the model stores a preset, not a clock.
	 */
	import type { SceneEnvironmentPreset } from '@portfolio/project-model/units';
	import { WORLD_ENVIRONMENT_CHOICES, worldEnvironmentLook } from '$lib/render/world-environment';
	import WorldIcon from './WorldIcon.svelte';

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

	let open = $state(false);
	let root = $state<HTMLElement | undefined>(undefined);

	const label = $derived(WORLD_ENVIRONMENT_CHOICES.find((choice) => choice.preset === environment)?.label ?? 'Paper');
	const hours: Readonly<Record<string, string>> = {
		paper: '12:00',
		daylight: '12:00',
		'golden-hour': '17:40',
		dusk: '19:20'
	};
	const hour = $derived(hours[environment] ?? '15:30');

	function swatch(preset: SceneEnvironmentPreset): string {
		const look = worldEnvironmentLook(preset);
		if (look === null) return 'linear-gradient(var(--stage-paper), var(--stage-paper))';
		return `linear-gradient(${look.sky[0]}, ${look.sky[1]} 55%, ${look.haze} 56%, ${look.ground})`;
	}

	$effect(() => {
		if (!open) return;
		const close = (event: PointerEvent) => {
			if (root !== undefined && event.target instanceof Node && !root.contains(event.target)) open = false;
		};
		document.addEventListener('pointerdown', close, true);
		return () => document.removeEventListener('pointerdown', close, true);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="sky"
	class:open
	bind:this={root}
	data-sky-control
	onkeydown={(event) => {
		if (event.key !== 'Escape' || !open) return;
		event.stopPropagation();
		open = false;
	}}
>
	<button
		type="button"
		class="chip"
		data-environment-chip
		aria-expanded={open}
		aria-haspopup="true"
		title="Sky and light: the World's saved environment"
		onclick={() => (open = !open)}
	>
		<WorldIcon name="sun" size={15} />
		<span class="chip-title">Sky</span>
		<small>{label} · {hour}</small>
		<WorldIcon name="chevron" size={11} />
	</button>
	{#if open}
		<div class="popover" role="dialog" aria-label="Sky and light">
			<header><strong>Sky &amp; light</strong><span>World · saved</span></header>
			<div class="presets" role="group" aria-label="Environment preset">
				{#each WORLD_ENVIRONMENT_CHOICES as choice (choice.preset)}
					<button
						type="button"
						class="preset"
						data-environment={choice.preset}
						aria-pressed={environment === choice.preset}
						disabled={busy}
						onclick={() => onEnvironment(choice.preset)}
					>
						<i style:background={swatch(choice.preset)}></i>
						<span>{choice.label}</span>
					</button>
				{/each}
			</div>
			<div class="hour-row">
				<span>Hour</span>
				<strong>{hour}</strong>
				<span class="planned">Planned · T2</span>
			</div>
			<input type="range" min="5" max="22" step="0.5" value="15.5" disabled aria-label="Hour (planned)" />
			<label class="paper">
				<input type="checkbox" checked={editOnPaper} onchange={() => onEditOnPaper(!editOnPaper)} />
				<span>Plain Paper while editing <small>· this browser</small></span>
			</label>
		</div>
	{/if}
</div>

<style>
	.sky {
		position: relative;
		display: flex;
		align-items: center;
		height: 28px;
	}
	.chip {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 6px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--shell-ink-light);
		font: 500 var(--shell-text-control)/1 var(--shell-sans);
		cursor: pointer;
	}
	.chip:hover {
		background: var(--shell-on-forest-wash);
	}
	.open .chip {
		background: var(--shell-on-forest-wash-strong);
		color: var(--shell-ivory);
	}
	.chip:focus-visible {
		outline: 2px solid var(--shell-focus-halo);
		outline-offset: 1px;
	}
	.chip small {
		color: var(--shell-ink-quiet);
		font-family: var(--shell-mono);
		font-size: 9px;
	}
	.chip-title {
		font-weight: 500;
	}
	.popover {
		position: absolute;
		z-index: 40;
		top: 36px;
		right: 0;
		display: grid;
		gap: 9px;
		width: 286px;
		padding: 12px;
		border: 1px solid var(--shell-hairline);
		border-radius: 13px;
		background: var(--shell-popover);
		box-shadow: var(--shell-shadow);
		color: var(--shell-ink);
	}
	.popover header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	.popover header strong {
		font: 600 var(--shell-text-identity)/1.2 var(--shell-sans);
	}
	.popover header span,
	.hour-row span,
	.paper small {
		font-size: 9px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--shell-ink-3);
	}
	.presets {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 5px;
	}
	.preset {
		display: grid;
		grid-template-columns: 30px 1fr;
		align-items: center;
		gap: 7px;
		height: 39px;
		padding: 4px;
		border: 1px solid var(--shell-field-line);
		border-radius: 7px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font: 10.5px var(--shell-sans);
		text-align: left;
		cursor: pointer;
	}
	.preset[aria-pressed='true'] {
		border-color: var(--shell-leaf);
		background: var(--shell-leaf-tint);
	}
	.preset:disabled {
		color: var(--shell-ink-3);
		opacity: 0.62;
		cursor: default;
	}
	.preset i {
		width: 30px;
		height: 28px;
		border-radius: 4px;
	}
	.hour-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.hour-row strong {
		font-family: var(--shell-mono);
		font-size: 11px;
	}
	.hour-row .planned {
		margin-left: auto;
		padding: 2px 5px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 999px;
		color: var(--shell-ink-3);
		font-size: 8px;
	}
	input[type='range'] {
		width: 100%;
		accent-color: var(--shell-leaf);
		opacity: 0.55;
	}
	.paper {
		display: flex;
		align-items: center;
		gap: 7px;
		padding-top: 3px;
		border-top: 1px solid var(--shell-hairline);
		font-size: 10.5px;
	}
	.paper input {
		accent-color: var(--shell-action);
	}
	.preset:focus-visible,
	.paper input:focus-visible {
		outline: 2px solid var(--shell-leaf);
		outline-offset: 1px;
	}
	@media (max-width: 700px) {
		.chip span,
		.chip small {
			display: none;
		}
	}
	@media (max-width: 820px) {
		.chip small {
			display: none;
		}
	}
</style>
