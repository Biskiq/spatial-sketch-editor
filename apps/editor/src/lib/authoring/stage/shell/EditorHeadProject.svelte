<script lang="ts">
	import { onMount, type ComponentProps } from 'svelte';
	import ProjectLifecycleActions from '$lib/platform/ProjectLifecycleActions.svelte';

	type Lifecycle = { start(next: 'rename' | 'delete'): Promise<void> };

	let {
		projectId,
		projectName,
		open,
		menuId,
		onToggle,
		onKeydown,
		canDownloadSource,
		onDownloadSource,
		onOpenSource,
		onTrigger,
		onLifecycle,
		lifecycleProps
	}: {
		projectId: string;
		projectName: string;
		open: boolean;
		menuId: string;
		trigger?: HTMLButtonElement;
		lifecycle?: Lifecycle;
		onToggle: () => void;
		onKeydown: (event: KeyboardEvent) => void;
		canDownloadSource: boolean;
		onDownloadSource: () => void;
		onOpenSource: () => void;
		onTrigger: (trigger: HTMLButtonElement | undefined) => void;
		onLifecycle: (lifecycle: Lifecycle | undefined) => void;
		lifecycleProps: ComponentProps<typeof ProjectLifecycleActions>;
	} = $props();

	let trigger = $state<HTMLButtonElement>();
	let lifecycle = $state<Lifecycle>();
	$effect(() => onTrigger(trigger));
	onMount(() => onLifecycle(lifecycle));
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="identity" role="group" aria-label="Project" data-head-project-owner onkeydown={onKeydown}>
	<h1 class="project-title">
		<button
			type="button"
			class="project-name"
			data-head-project
			bind:this={trigger}
			aria-expanded={open}
			aria-controls={menuId}
			title={projectName}
			onclick={onToggle}
		>
			<span class="project-text">{projectName}</span>
			<span class="chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>
		</button>
	</h1>
	<div id={menuId} class="project-menu" role="group" aria-label="Project actions" data-head-project-menu hidden={!open}>
		<ProjectLifecycleActions bind:this={lifecycle} {...lifecycleProps} />
		<button type="button" class="menu-action" data-head-download disabled={!canDownloadSource} onclick={onDownloadSource}>
			Download source JSON
		</button>
		<button type="button" class="menu-action" data-head-source onclick={onOpenSource}>
			Open source JSON
		</button>
		<p class="project-id">Project id <code>{projectId}</code></p>
	</div>
</div>

<style>
	button {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		gap: 4px;
		min-height: 24px;
		padding: 0 7px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button:hover {
		background: var(--shell-on-forest-wash);
	}
	.identity {
		position: relative;
		min-width: 0;
		flex: 0 1 auto;
	}
	.project-title {
		margin: 0;
		font: inherit;
	}
	.project-name {
		max-width: 180px;
		color: var(--shell-ink-light);
		padding: 0 4px;
		font: 500 var(--shell-text-identity) var(--shell-sans);
	}
	.project-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chevron {
		font: var(--shell-text-label) var(--shell-sans);
		color: var(--shell-ink-quiet);
	}
	.project-menu {
		position: absolute;
		z-index: 30;
		top: 35px;
		left: 0;
		display: grid;
		gap: 6px;
		width: 288px;
		padding: 10px;
		border: 1px solid var(--shell-line-on-forest);
		border-radius: 10px;
		background: var(--shell-popup-dark);
		box-shadow: var(--shell-shadow);
	}
	.project-menu[hidden] {
		display: none;
	}
	.menu-action {
		justify-content: flex-start;
	}
	.project-id {
		margin: 0;
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-label);
		overflow-wrap: anywhere;
	}
	@media (max-width: 860px) {
		.project-name {
			max-width: 130px;
		}
	}
	@media (pointer: coarse) {
		button {
			min-width: 44px;
			min-height: 44px;
		}
	}
</style>
