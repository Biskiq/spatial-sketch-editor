<script lang="ts">
	import { untrack } from 'svelte';
	import ShellIcon from './ShellIcon.svelte';
	import type { ExperienceIndexGroups } from './experience-index-groups';

	let { open, experience }: { open: boolean; experience: ExperienceIndexGroups | null } = $props();

	/* The Experience crumb's inline rename: Enter or blur commits, Esc cancels. */
	let renamingExperience = $state(false);
	let experienceDraft = $state('');
	let renameBusy = $state(false);
	let renameError = $state<string | null>(null);
	function startExperienceRename(): void {
		if (!experience) return;
		experienceDraft = experience.current?.label ?? experience.draftLabel;
		renameError = null;
		renamingExperience = true;
	}
	async function commitExperienceName(): Promise<void> {
		if (!experience || renameBusy || !renamingExperience) return;
		renameBusy = true;
		try {
			const outcome = await experience.onRenameExperience(experienceDraft);
			if (outcome.kind === 'accepted') {
				renamingExperience = false;
				renameError = null;
			} else {
				renameError = outcome.message ?? 'The name was not accepted.';
			}
		} finally {
			renameBusy = false;
		}
	}
	function renameKeys(event: KeyboardEvent): void {
		if (event.key === 'Enter') { event.preventDefault(); void commitExperienceName(); }
		else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); renamingExperience = false; renameError = null; }
	}

	/*
	 * Experience review 1 — the Experiences list. Folded, it shows the current
	 * Experience and the most recently opened ones (at most EXPERIENCE_FOLD_ROWS);
	 * "Show all" lists every one in authored order inside a capped scroll, with a
	 * filter from EXPERIENCE_FILTER_FROM. The fold choice is a per-browser convenience.
	 */
	const EXPERIENCE_FOLD_ROWS = 3;
	const EXPERIENCE_FILTER_FROM = 8;
	const EXPANDED_KEY = 'museum.index.experiences-expanded';
	function readExpanded(): boolean {
		try {
			return globalThis.localStorage?.getItem(EXPANDED_KEY) === 'true';
		} catch {
			return false;
		}
	}
	let expanded = $state(readExpanded());
	function setExpanded(next: boolean): void {
		expanded = next;
		experienceFilter = '';
		try {
			globalThis.localStorage?.setItem(EXPANDED_KEY, String(next));
		} catch {
			// A blocked store only forgets the choice.
		}
	}
	let experienceFilter = $state('');
	let recentExperienceIds = $state<string[]>([]);
	$effect(() => {
		const id = experience?.current?.id ?? null;
		if (id === null) return;
		untrack(() => {
			recentExperienceIds = [id, ...recentExperienceIds.filter((entry) => entry !== id)].slice(0, 12);
		});
	});
	const shownExperiences = $derived.by(() => {
		const all = experience?.experiences ?? [];
		if (expanded || all.length <= EXPERIENCE_FOLD_ROWS) {
			const needle = experienceFilter.trim().toLowerCase();
			return needle === '' ? all : all.filter((entry) => entry.label.toLowerCase().includes(needle) || entry.id === experience?.current?.id);
		}
		const byId = new Map(all.map((entry) => [entry.id, entry]));
		const order = [...recentExperienceIds, ...all.map((entry) => entry.id)];
		const picked: typeof all[number][] = [];
		for (const id of order) {
			const entry = byId.get(id);
			if (entry !== undefined && !picked.includes(entry)) picked.push(entry);
			if (picked.length === EXPERIENCE_FOLD_ROWS) break;
		}
		return picked;
	});
	function experienceMeta(entry: { readonly stopCount: number; readonly presentationCount: number }): string {
		if (entry.stopCount > 0) return `${entry.stopCount} ${entry.stopCount === 1 ? 'stop' : 'stops'}`;
		if (entry.presentationCount > 0) return `${entry.presentationCount} presented`;
		return 'empty';
	}

	let creatingName = $state<string | null>(null);
	function startCreate(): void {
		if (!experience) return;
		renamingExperience = false;
		creatingName = `Experience ${experience.experiences.length + 1}`;
	}
	async function commitCreate(): Promise<void> {
		if (!experience || creatingName === null) return;
		const name = creatingName.trim();
		creatingName = null;
		if (name === '') return;
		await experience.onCreateExperience(name);
	}

	function focusSelect(input: HTMLInputElement) {
		input.focus();
		input.select();
	}
</script>

{#if open && experience}
	<section class="group experiences" aria-labelledby="index-experiences" data-experience-list>
		<h3 id="index-experiences" class="group-title group-title-row">
			<span>Experiences <span class="count">{experience.experiences.length || ''}</span></span>
			<button
				type="button"
				class="group-add"
				aria-label="New Experience"
				title="New Experience"
				disabled={experience.busy || creatingName !== null}
				onclick={startCreate}><ShellIcon name="plus" size={14} /></button
			>
		</h3>
		{#if expanded && experience.experiences.length > EXPERIENCE_FILTER_FROM}
			<label class="exp-filter"
				><ShellIcon name="search" size={13} /><input
					type="search"
					aria-label="Filter Experiences"
					placeholder="Filter Experiences"
					bind:value={experienceFilter}
				/></label
			>
		{/if}
		<ul class="group-items exp-list" class:scrolls={expanded && experience.experiences.length > EXPERIENCE_FOLD_ROWS}>
			{#if experience.current === null}
				<li class="exp-row current draft" data-experience-draft>
					{#if renamingExperience}
						<input class="crumb-input" aria-label="Experience name" value={experienceDraft} disabled={renameBusy} use:focusSelect
							oninput={(event) => (experienceDraft = event.currentTarget.value)}
							onblur={() => { if (!renameBusy) void commitExperienceName(); }}
							onkeydown={renameKeys} />
					{:else}
						<button type="button" class="exp-open" aria-current="location" ondblclick={startExperienceRename} title="Double-click to rename"
							><i class="exp-ic"></i><span class="exp-name">{experience.draftLabel}</span><span class="exp-meta">draft</span></button
						>
					{/if}
				</li>
			{/if}
			{#each shownExperiences as entry (entry.id)}
				{@const isCurrent = entry.id === experience.current?.id}
				<li class="exp-row" class:current={isCurrent} data-experience-row={entry.id}>
					{#if isCurrent && renamingExperience}
						<input class="crumb-input" aria-label="Experience name" value={experienceDraft} disabled={renameBusy} use:focusSelect
							oninput={(event) => (experienceDraft = event.currentTarget.value)}
							onblur={() => { if (!renameBusy) void commitExperienceName(); }}
							onkeydown={renameKeys} />
					{:else}
						<button
							type="button"
							class="exp-open"
							aria-current={isCurrent ? 'location' : undefined}
							onclick={() => { if (!isCurrent) experience.onOpenExperience(entry.id); }}
							ondblclick={() => { if (isCurrent) startExperienceRename(); }}
							><i class="exp-ic"></i><span class="exp-name">{entry.label}</span><span class="exp-meta">{experienceMeta(entry)}</span></button
						>
						{#if isCurrent}
							<button type="button" class="exp-more" aria-label={`Rename ${entry.label}`} title="Rename" disabled={experience.busy}
								onclick={startExperienceRename}><ShellIcon name="more" size={14} /></button
							>
						{/if}
					{/if}
				</li>
			{/each}
			{#if creatingName !== null}
				<li class="exp-row current creating">
					<input class="crumb-input" aria-label="New Experience name" value={creatingName} disabled={experience.busy} use:focusSelect
						oninput={(event) => (creatingName = event.currentTarget.value)}
						onblur={() => { if (!experience.busy) void commitCreate(); }}
						onkeydown={(event) => {
							if (event.key === 'Enter') { event.preventDefault(); void commitCreate(); }
							else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); creatingName = null; }
						}} />
				</li>
			{/if}
		</ul>
		{#if experience.experiences.length > EXPERIENCE_FOLD_ROWS}
			<button type="button" class="exp-more-toggle" aria-expanded={expanded} onclick={() => setExpanded(!expanded)}
				>{expanded ? 'Show less' : `Show all ${experience.experiences.length}`}<ShellIcon name={expanded ? 'chevronUp' : 'chevronDown'} size={12} /></button
			>
		{/if}
		{#if renameError}<p class="crumb-error" role="alert">{renameError}</p>{/if}
	</section>
{/if}
