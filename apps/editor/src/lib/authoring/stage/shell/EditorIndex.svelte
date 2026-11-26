<script lang="ts">
	/** The mounted locator keeps its disclosures as the active lens changes. */
	import ShellIcon from './ShellIcon.svelte';
	import type { WorldScope, WorldIndexModel } from './world-index-model';
	import type { ExperienceIndexGroups } from './experience-index-groups';
	import EditorIndexExperiences from './EditorIndexExperiences.svelte';
	import EditorIndexGuides from './EditorIndexGuides.svelte';
	import EditorIndexPresentations from './EditorIndexPresentations.svelte';
	import EditorIndexWorld from './EditorIndexWorld.svelte';
	import './editor-index.css';

	let {
		open,
		model,
		scope,
		onScope,
		onClose = () => {},
		selectionId,
		query,
		onQuery,
		onSelect,
		onReveal,
		onRename = () => {},
		experience = null
	}: {
		open: boolean;
		model: WorldIndexModel;
		scope: WorldScope;
		onScope: (scope: WorldScope) => void;
		onClose?: () => void;
		selectionId: string | null;
		query: string;
		onQuery: (q: string) => void;
		onSelect: (id: string) => void;
		onBringIntoView: (id: string) => void;
		onReveal: (id: string) => void;
		/** Double-click on a row renames through the selected subject's Card writer. */
		onRename?: (id: string) => void;
		/**
		 * The Experience lens's groups. When present the Index shows them in place
		 * of the World locator: the Experience crumb with its sibling menu, the Guides, and the
		 * Presentations with their Views. Same Index shell and rows.
		 */
		experience?: ExperienceIndexGroups | null;
	} = $props();

	let locationsOpen = $state(false);
	let guideMenuId = $state<string | null>(null);
</script>

<svelte:window onkeydown={(event) => {
	if (event.key === 'Escape' && locationsOpen) {
		locationsOpen = false;
		if (event.target instanceof HTMLElement && event.target.closest('#plate-index')) {
			document.getElementById('world-location-toggle')?.focus();
			event.stopPropagation();
		}
	}
	if (event.key === 'Escape' && guideMenuId !== null) guideMenuId = null;
}} onpointerdown={(event) => {
	if (!(event.target instanceof Element) || !event.target.closest('.world-location, #world-locations')) locationsOpen = false;
	if (!(event.target instanceof Element) || !event.target.closest('.guide-menu-wrap')) guideMenuId = null;
}} />

<nav
	id="plate-index"
	class="plate-index"
	aria-label="Project locator"
	data-plate-landmark="index"
	class:collapsed={!open}
	hidden={!open}
>
	{#if open}
		{#if experience}
			<div class="index-search">
				<label
					><ShellIcon name="search" size={15} />
					<input
						id="plate-index-search"
						type="search"
						aria-label="Find a Presentation or View"
						placeholder="Find a Presentation or View"
						value={experience.query}
						oninput={(e) => experience.onQuery(e.currentTarget.value)}
					/>
				</label>
				<button type="button" class="hide-index" aria-label="Hide Index" onclick={onClose}
					><ShellIcon name="chevronLeft" size={15} /></button
				>
			</div>
		{:else}
			<div class="index-search world-search">
				<label
					><ShellIcon name="search" size={14} />
					<input
						id="plate-index-search"
						type="search"
						aria-label="Filter places and things"
						placeholder="Filter places and things"
						value={query}
						oninput={(e) => onQuery(e.currentTarget.value)}
					/>
				</label><button type="button" aria-label="Hide Index" onclick={onClose}
					><ShellIcon name="chevronLeft" size={15} /></button
				>
			</div>
		{/if}
	{/if}

	<!-- Keep the locator and draft state alive while their markup is hidden. -->
	<EditorIndexExperiences {open} {experience} />
	{#if open && experience}
		<EditorIndexPresentations {experience} {onRename} />
	{/if}
	<EditorIndexGuides {open} {experience} bind:guideMenuId />
	<EditorIndexWorld
		visible={open && experience === null}
		{model}
		{scope}
		{onScope}
		{selectionId}
		{query}
		{onSelect}
		{onReveal}
		{onRename}
		bind:locationsOpen
	/>
</nav>

<style>
	.plate-index {
		display: flex;
		flex-direction: column;
		width: var(--shell-index-width);
		min-width: 0;
		min-height: 0;
		overflow: auto;
		border-right: 1px solid var(--shell-hairline);
		background: var(--shell-index);
		color: var(--shell-ink);
		font: var(--shell-text-body)/1.35 var(--shell-sans);
	}

	.plate-index[hidden] {
		display: none;
	}
</style>
