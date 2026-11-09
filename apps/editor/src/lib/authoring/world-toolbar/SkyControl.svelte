<script lang="ts">
	/**
	 * The #285 sky chip in the Head. It is the existing `scene-environment-set`
	 * controller with a Living Draft face; the hour slider is visibly planned
	 * because the model stores a preset, not a clock.
	 */
	import type { SceneEnvironmentPreset } from '@portfolio/project-model/units';
	import { WORLD_ENVIRONMENT_CHOICES, worldEnvironmentLook } from '$lib/render/world-environment';
	import ShellIcon from '../stage/shell/ShellIcon.svelte';

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
		if (look === null) return 'linear-gradient(#f4f1e6, #e4e2d7)';
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
		aria-expanded={open}
		aria-haspopup="true"
		title="Sky and light: the World's saved environment"
		onclick={() => (open = !open)}
	>
		<ShellIcon name="sun" size={15} />
		<span>{label}</span>
		<small>{hour}</small>
		<ShellIcon name="chevronDown" size={11} />
	</button>
	{#if open}
		<div class="popover" role="dialog" aria-label="Sky and light">
			<header><strong>Sky &amp; light</strong><span>World · saved</span></header>
			<div class="presets" role="group" aria-label="Environment preset">
				{#each WORLD_ENVIRONMENT_CHOICES as choice (choice.preset)}
					<button
						type="button"
						class="preset"
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
		height: 34px;
	}
	.chip {
		display: flex;
		align-items: center;
		gap: 7px;
		height: 34px;
		padding: 0 10px;
		border: 1px solid rgb(240 244 236 / 0.16);
		border-radius: 9px;
		background: rgb(0 0 0 / 0.12);
		color: var(--ld-light, #f2f0e6);
		font: 500 11.5px/1 var(--ld-sans, 'Instrument Sans', system-ui, sans-serif);
		cursor: pointer;
	}
	.chip:hover,
	.open .chip {
		background: rgb(242 240 230 / 0.1);
	}
	.chip small {
		font-family: var(--ld-mono, 'DM Mono', monospace);
		font-size: 9px;
		color: var(--ld-light-2, #c3d1c6);
	}
	.popover {
		position: absolute;
		z-index: 40;
		top: 40px;
		right: 0;
		display: grid;
		gap: 9px;
		width: 286px;
		padding: 12px;
		border: 1px solid rgb(240 244 236 / 0.16);
		border-radius: 13px;
		background: var(--ld-forest-deep, #102d20);
		box-shadow: var(--ld-shadow, 0 14px 40px rgb(10 24 18 / 0.3));
		color: var(--ld-light, #f2f0e6);
	}
	.popover header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	.popover header strong {
		font-family: var(--ld-serif, 'Fraunces', Georgia, serif);
		font-size: 16px;
		font-weight: 500;
	}
	.popover header span,
	.hour-row span,
	.paper small {
		font-size: 9px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ld-light-2, #c3d1c6);
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
		border: 1px solid rgb(240 244 236 / 0.12);
		border-radius: 7px;
		background: rgb(242 240 230 / 0.04);
		color: var(--ld-light, #f2f0e6);
		font: 10.5px var(--ld-sans, 'Instrument Sans', system-ui, sans-serif);
		text-align: left;
		cursor: pointer;
	}
	.preset[aria-pressed='true'] {
		border-color: var(--ld-mint, #96c7a9);
		background: rgb(150 199 169 / 0.12);
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
		font-family: var(--ld-mono, 'DM Mono', monospace);
		font-size: 11px;
	}
	.hour-row .planned {
		margin-left: auto;
		padding: 2px 5px;
		border: 1px solid rgb(240 244 236 / 0.14);
		border-radius: 999px;
		color: var(--ld-mint, #96c7a9);
		font-size: 8px;
	}
	input[type='range'] {
		width: 100%;
		accent-color: var(--ld-mint, #96c7a9);
		opacity: 0.5;
	}
	.paper {
		display: flex;
		align-items: center;
		gap: 7px;
		padding-top: 3px;
		border-top: 1px solid rgb(240 244 236 / 0.1);
		font-size: 10.5px;
	}
	.paper input {
		accent-color: var(--ld-leaf, #4f8061);
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--ld-gold, #c8a653);
		outline-offset: 1px;
	}
</style>
