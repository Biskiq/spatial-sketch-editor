<script lang="ts">
	import { ArrowLeft, Check, Palette, Play, Redo2, Undo2, UserRound } from 'lucide-svelte';
	import { onMount, tick } from 'svelte';
	import { resolveRovingIndex } from './roving-focus';
	import { projectPersistencePresentation } from './project-persistence-presentation';
	import { setTheme, THEMES, themeState, type ThemeId } from '$lib/editor/theme.svelte';
	import EditorProjectMenu from '$lib/editor/EditorProjectMenu.svelte';
	import type { LayoutPreviewState } from '$lib/editor/layout/layout-preview-state.svelte';
	import type { EditorStore } from '$lib/editor/editor-store.svelte';
	import type { ProjectSummary } from '$lib/editor/project-persistence';

	let {
		store,
		layoutPreview,
		currentProjectIsOwned = false,
		saveBlocker = null,
		confirmSceneReplacement,
		confirmLayoutReplacement,
		projectName = 'Untitled project',
		projectIsDirty,
		onProjectNameChange,
		onSaveProject,
		onLoadProject,
		onRefreshProjects,
		onSignIn,
		onSignOut,
		sessionStatus = 'unauthenticated',
		ownedProjects = [],
		cloudStatus = 'disabled',
		cloudError = null,
		saveAuthGateOpen = false,
		onContinueSaveAuth,
		onCancelSaveAuth,
		pendingSaveActive = false,
		onDiscardPendingSave,
		resolveProjectAssetBytes,
		onReset,
		onLayoutReplaced,
		onPreview,
		previewDisabledReason = null,
		projectId = null,
		surface = 'spatial'
	}: {
		store: EditorStore;
		layoutPreview: LayoutPreviewState;
		currentProjectIsOwned?: boolean;
		saveBlocker?: string | null;
		confirmSceneReplacement: () => boolean;
		confirmLayoutReplacement: () => boolean;
		projectName?: string;
		projectIsDirty?: boolean;
		onProjectNameChange?: (name: string) => void;
		onSaveProject?: () => void;
		onLoadProject?: (projectId: string) => void;
		onRefreshProjects?: () => void;
		onSignIn?: () => void | Promise<void>;
		onSignOut?: () => void | Promise<void>;
		sessionStatus?: 'checking' | 'authenticated' | 'unauthenticated' | 'error';
		ownedProjects?: readonly ProjectSummary[];
		cloudStatus?: 'disabled' | 'ready' | 'loading' | 'saving' | 'error';
		cloudError?: string | null;
		saveAuthGateOpen?: boolean;
		onContinueSaveAuth?: () => void | Promise<void>;
		onCancelSaveAuth?: () => void;
		pendingSaveActive?: boolean;
		onDiscardPendingSave?: () => void;
		resolveProjectAssetBytes?: (uri: string) => Promise<Uint8Array | null>;
		/** fired after the Project-menu reset actions; the shell clears the active selection. */
		onReset?: () => void;
		/** fired after a layout document replacement (reset or successful import); the shell cancels any in-flight Wall run. */
		onLayoutReplaced?: () => void;
		onPreview?: () => void | Promise<void>;
		previewDisabledReason?: string | null;
		projectId?: string | null;
		surface?: 'spatial' | 'preview' | 'publish';
	} = $props();

	const presentation = $derived(projectPersistencePresentation({
		owned: currentProjectIsOwned, dirty: projectIsDirty ?? store.isDirty,
		saving: cloudStatus === 'saving', blocker: saveBlocker
	}));
	// Surface the explicit save-auth interruption only. Background cloud
	// errors must never pop the menu open (they routinely fire on fresh
	// guest loads when the owned-projects refresh fails).
	$effect(() => { if (saveAuthGateOpen) openDocumentMenu(); });
	function rename(input: HTMLInputElement) {
		const name = input.value.trim();
		if (name) onProjectNameChange?.(name);
		else input.value = projectName;
	}
	let projectMenuOpen = $state(false);
	let themeMenuOpen = $state(false);
	let accountOpen = $state(false);
	let themeMenuElement = $state<HTMLElement>();
	let themeTriggerElement = $state<HTMLButtonElement>();
	let themeMenuPanelElement = $state<HTMLElement>();
	let accountMenuElement = $state<HTMLElement>();
	let accountTriggerElement = $state<HTMLButtonElement>();
	let accountMenuPanelElement = $state<HTMLElement>();

	/**
	 * #40 — the Project Head is one popover region. The row owns all three
	 * popovers, so coordination lives here rather than in three independent
	 * menus that could end up stacked on the same 36 px band. Opening any one of
	 * them closes the other two.
	 */
	function openDocumentMenu() {
		projectMenuOpen = true;
		themeMenuOpen = false;
		accountOpen = false;
	}

	function toggleThemeMenu() {
		themeMenuOpen = !themeMenuOpen;
		if (!themeMenuOpen) return;
		projectMenuOpen = false;
		accountOpen = false;
	}

	function toggleAccountMenu() {
		accountOpen = !accountOpen;
		if (!accountOpen) return;
		projectMenuOpen = false;
		themeMenuOpen = false;
	}

	/**
	 * #40 — both small popovers take focus on open and give it back on Escape,
	 * the same contract the Document menu keeps (#41). Arrow keys walk the
	 * members; the menu never becomes a Tab trap.
	 */
	function focusFirstPopoverControl(panel: HTMLElement | null | undefined) {
		if (!panel) return;
		const control = panel.querySelector<HTMLElement>('button:not(:disabled), a[href]');
		if (control) control.focus();
		else panel.focus();
	}

	function onPopoverKeydown(
		event: KeyboardEvent,
		panel: HTMLElement | null | undefined,
		trigger: HTMLButtonElement | null | undefined,
		close: () => void
	) {
		const control = event.target as HTMLElement | null;
		const members = panel ? [...panel.querySelectorAll<HTMLElement>('button:not(:disabled)')] : [];
		const current = control ? members.indexOf(control) : -1;
		const next = resolveRovingIndex(members.length, current, event.key, 'vertical');
		if (next !== null) {
			event.preventDefault();
			members[next]?.focus();
			return;
		}
		if (event.key !== 'Escape') return;
		// The window-level Escape handler would close the popover without returning
		// focus; owning Escape here is what makes the trigger the next focus stop.
		event.stopPropagation();
		close();
		void tick().then(() => trigger?.focus());
	}

	$effect(() => {
		if (!themeMenuOpen) return;
		void tick().then(() => focusFirstPopoverControl(themeMenuPanelElement));
	});

	$effect(() => {
		if (!accountOpen) return;
		void tick().then(() => focusFirstPopoverControl(accountMenuPanelElement));
	});
	// Static registry snapshot: THEMES never changes at runtime, so the menu
	// picks up future themes automatically without reactive machinery.
	const themeEntries = Object.entries(THEMES) as Array<[ThemeId, (typeof THEMES)[ThemeId]]>;
	// P22.4 — same-session Spatial↔Publish navigation keeps the retained
	// editor session (dirty guard exempts it); plain links suffice.
	const spatialHref = $derived(projectId ? `/project/${encodeURIComponent(projectId)}/spatial` : '/projects');
	const publishHref = $derived(projectId ? `/project/${encodeURIComponent(projectId)}/publish` : '/projects');

	onMount(() => {
		const closeHeadPopoversOnPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (!themeMenuElement?.contains(target)) themeMenuOpen = false;
			if (!accountMenuElement?.contains(target)) accountOpen = false;
		};
		const closeHeadPopoversWithEscape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			themeMenuOpen = false;
			accountOpen = false;
		};
		window.addEventListener('pointerdown', closeHeadPopoversOnPointerDown);
		window.addEventListener('keydown', closeHeadPopoversWithEscape);
		return () => {
			window.removeEventListener('pointerdown', closeHeadPopoversOnPointerDown);
			window.removeEventListener('keydown', closeHeadPopoversWithEscape);
		};
	});

</script>

<header class="project-row" aria-label="Project Head" style="grid-area: head;">
	<a href="/projects" class="projects-link"><ArrowLeft size={14} /> Projects</a>
	<input class="project-name" aria-label="Project name" value={projectName} maxlength="200"
		onblur={(event) => rename(event.currentTarget)}
		onkeydown={(event) => {
			if (event.key === 'Enter') event.currentTarget.blur();
			if (event.key === 'Escape') { event.currentTarget.value = projectName; event.currentTarget.blur(); }
		}} />
	<span class="location">{presentation.location}</span>
	<button class="save-state" title={saveBlocker ?? presentation.hint}
		disabled={cloudStatus === 'saving' || cloudStatus === 'loading' || (!presentation.actionable && !saveBlocker)}
		onclick={() => { if (saveBlocker) projectMenuOpen = true; else if (presentation.actionable) onSaveProject?.(); }}
	>{presentation.label}</button>
	<!-- Document operations remain in the existing menu; identity/save/auth are elevated. -->
	<div class="document-menu-slot">
		<EditorProjectMenu
			elevated
			{saveBlocker}
			{store}
			{layoutPreview}
			{confirmSceneReplacement}
			{confirmLayoutReplacement}
			{projectName}
			{projectIsDirty}
			{onProjectNameChange}
			{onSaveProject}
			{onLoadProject}
			{onRefreshProjects}
			{onSignIn}
			{onSignOut}
			{sessionStatus}
			{ownedProjects}
			{cloudStatus}
			{cloudError}
			{saveAuthGateOpen}
			{onContinueSaveAuth}
			{onCancelSaveAuth}
			{pendingSaveActive}
			{onDiscardPendingSave}
			{resolveProjectAssetBytes}
			{onReset}
			{onLayoutReplaced}
			bind:open={projectMenuOpen}
			onOpenChange={(value) => {
				if (!value) return;
				themeMenuOpen = false;
				accountOpen = false;
			}}
		/>
	</div>
	<nav aria-label="Project modes">
		{#if projectId}
			<a href={spatialHref} aria-current={surface === 'spatial' ? 'page' : undefined}>Spatial</a>
			<a href={publishHref} aria-current={surface === 'publish' ? 'page' : undefined}>Publish</a>
		{:else}
			<span aria-current="page">Spatial</span>
		{/if}
	</nav>
	<div class="actions">
		<button type="button" aria-label="Undo" title="Undo" disabled={!store.canUndo} onclick={() => store.undo()}><Undo2 size={14} /></button>
		<button type="button" aria-label="Redo" title="Redo" disabled={!store.canRedo} onclick={() => store.redo()}><Redo2 size={14} /></button>
		<button
			class="preview-action"
			disabled={!onPreview}
			title={previewDisabledReason ?? 'Open Visitor Preview'}
			onclick={() => void onPreview?.()}
		><Play size={14} /> Preview</button>
		<div bind:this={themeMenuElement} class="theme-menu-wrap">
			<button
				bind:this={themeTriggerElement}
				type="button"
				class:active={themeMenuOpen}
				title="Theme"
				aria-label="Theme"
				aria-haspopup="menu"
				aria-expanded={themeMenuOpen}
				onclick={toggleThemeMenu}
			><Palette size={14} aria-hidden="true" /></button>
			{#if themeMenuOpen}
				<div
					bind:this={themeMenuPanelElement}
					class="theme-menu"
					role="menu"
					aria-label="Editor theme"
					tabindex="-1"
					onkeydown={(event) =>
						onPopoverKeydown(event, themeMenuPanelElement, themeTriggerElement, () => {
							themeMenuOpen = false;
						})}
				>
					{#each themeEntries as [id, def] (id)}
						<button
							type="button"
							role="menuitemradio"
							aria-checked={themeState.current === id}
							tabindex="-1"
							class:active={themeState.current === id}
							onclick={() => {
								setTheme(id);
								themeMenuOpen = false;
							}}
						>
							<span>{def.label}</span>
							{#if themeState.current === id}<Check size={12} aria-hidden="true" />{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div bind:this={accountMenuElement} class="account">
			{#if sessionStatus === 'authenticated'}
				<button
					bind:this={accountTriggerElement}
					aria-label="Account"
					aria-haspopup="menu"
					aria-expanded={accountOpen}
					onclick={toggleAccountMenu}
				><UserRound size={16} /></button>
				{#if accountOpen}
					<div
						bind:this={accountMenuPanelElement}
						class="account-menu"
						role="menu"
						aria-label="Account actions"
						tabindex="-1"
						onkeydown={(event) =>
							onPopoverKeydown(event, accountMenuPanelElement, accountTriggerElement, () => {
								accountOpen = false;
							})}
					>
						<button role="menuitem" tabindex="-1" onclick={onSignOut}>Sign out</button>
					</div>
				{/if}
			{:else}
				<button disabled={!onSignIn || sessionStatus === 'checking'} onclick={onSignIn}>{sessionStatus === 'checking' ? 'Checking…' : 'Sign in'}</button>
			{/if}
		</div>
	</div>
</header>

<style>
	/* P23.14 §9 — the Project Head: a 36 px chassis band that stays compact.
	   Spatial and Publish are independent chassis actions (two links), never a
	   segmented control; there is no second global toolbar. */
	.project-row { display:flex; align-items:center; gap:14px; padding:0 12px; height:var(--editor-project-row-height); box-sizing:border-box; background:var(--editor-bg-app); border-bottom:1px solid var(--editor-border-subtle); font:var(--editor-type-control); min-width:0; z-index:30; }
	.project-row a { color:var(--editor-text-primary); text-decoration:none; display:flex; gap:6px; align-items:center; white-space:nowrap; }
	.project-name { width:180px; max-width:240px; min-width:80px; font:var(--editor-type-identity); }
	button, input, .location, nav span, nav a { height:var(--editor-control-md-height); box-sizing:border-box; border:1px solid var(--editor-border-subtle); border-radius:var(--editor-control-radius); background:var(--editor-bg-instrument); color:var(--editor-text-primary); padding:0 var(--editor-control-md-pad-x); }
	.location, nav span, nav a { display:flex; align-items:center; white-space:nowrap; background:transparent; border-color:transparent; }
	nav a { text-decoration:none; }
	nav { display:flex; gap:4px; margin-left:auto; margin-right:auto; }
	nav a:hover { background:var(--editor-bg-hover); border-color:var(--editor-border-subtle); }
	/* Active destination: ink + inset bottom edge, never a loud accent fill. */
	nav span[aria-current="page"], nav a[aria-current="page"] { color:var(--editor-text-primary); font-weight:650; box-shadow:inset 0 -2px var(--editor-text-secondary); }
	button { display:inline-flex; align-items:center; justify-content:center; gap:5px; font:inherit; white-space:nowrap; cursor:pointer; }
	button:disabled { opacity:.5; cursor:default; }
	.actions { display:flex; align-items:center; gap:4px; }
	.theme-menu-wrap, .account { position:relative; }
	.theme-menu, .account-menu { position:absolute; top:calc(100% + 4px); right:0; padding:5px; min-width:130px; background:var(--editor-bg-panel-raised); border:1px solid var(--editor-border-normal); border-radius:3px; box-shadow:var(--editor-shadow-popover); }
	.theme-menu button { width:100%; justify-content:space-between; }
	.theme-menu button.active { color:var(--editor-accent); }
	@media(max-width:1100px) { .project-name { width:120px; } .project-row { gap:4px; } }
</style>
