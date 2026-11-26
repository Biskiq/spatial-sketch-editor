<script lang="ts">
	import { tick } from 'svelte';
	import ShellIcon from './ShellIcon.svelte';
	import type { ExperienceIndexGroups } from './experience-index-groups';

	let { open, experience, guideMenuId = $bindable() }: {
		open: boolean;
		experience: ExperienceIndexGroups | null;
		guideMenuId: string | null;
	} = $props();

	let renamingGuideId = $state<string | null>(null);
	let guideDraft = $state('');
	let guideBusy = $state(false);
	let guideRenameInput = $state<HTMLInputElement | null>(null);

	function startGuideRename(guideId: string, label: string): void {
		guideMenuId = null;
		renamingGuideId = guideId;
		guideDraft = label;
		void tick().then(() => {
			guideRenameInput?.focus();
			guideRenameInput?.select();
		});
	}
	function cancelGuideRename(): void {
		renamingGuideId = null;
		guideDraft = '';
	}
	async function commitGuideRename(): Promise<void> {
		const guideId = renamingGuideId;
		if (guideId === null || guideDraft.trim() === '' || !experience) return;
		guideBusy = true;
		const result = await experience.onRenameGuide(guideId, guideDraft.trim());
		guideBusy = false;
		if (result.kind === 'accepted') cancelGuideRename();
	}
	function onGuideRenameKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			void commitGuideRename();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			cancelGuideRename();
		}
	}
	function toggleGuideMenu(guideId: string): void {
		guideMenuId = guideMenuId === guideId ? null : guideId;
	}
</script>

{#if open && experience && !experience.pending && experience.current !== null}
	<section class="group" aria-labelledby="index-guides">
		<h3 id="index-guides" class="group-title">Guides</h3>
		{#each experience.guides as guide (guide.id)}
			<div class="item" class:open={guide.open} data-guide-id={guide.id}>
				{#if renamingGuideId === guide.id}
					<input
						class="guide-rename-input"
						type="text"
						aria-label="Guide name"
						bind:value={guideDraft}
						bind:this={guideRenameInput}
						disabled={guideBusy}
						onkeydown={onGuideRenameKeydown}
						onblur={() => void commitGuideRename()}
					/>
				{:else}
					<div class="guide-line">
						<button
							type="button"
							class="guide-row"
							onclick={() => experience.onOpenGuide(guide.id)}
						>
							<ShellIcon name="guide" size={15} />
							<span class="item-text">
								<span class="item-name">{guide.label}</span>
								<span class="item-meta">{guide.stopCount} {guide.stopCount === 1 ? 'stop' : 'stops'}</span>
							</span>
							{#if guide.opening}<span class="opens-tag" data-opening-guide>opens</span>{/if}
							{#if guide.open}<span class="chip">Open</span>{/if}
						</button>
						<span class="guide-menu-wrap">
							<button
								type="button"
								class="icon guide-actions-toggle"
								aria-label={`${guide.label} actions`}
								aria-haspopup="menu"
								aria-expanded={guideMenuId === guide.id}
								onclick={() => toggleGuideMenu(guide.id)}
							>⋯</button
							>
							{#if guideMenuId === guide.id}
								<div class="menu guide-menu" role="menu" tabindex="-1" aria-label={`${guide.label} actions`}>
									<button
										type="button"
										role="menuitem"
										onclick={() => startGuideRename(guide.id, guide.label)}>Rename</button
									>
									<button
										type="button"
										role="menuitem"
										class="danger"
										onclick={() => {
											guideMenuId = null;
											experience.onRemoveGuide(guide.id);
										}}>Remove Guide</button
									>
								</div>
							{/if}
						</span>
					</div>
				{/if}
			</div>
		{:else}
			<div class="item">
				<button type="button" class="guide-row" onclick={() => experience.onOpenGuide(null)}>
					<ShellIcon name="guide" size={15} />
					<span class="item-text">
						<span class="item-name muted">No Guide yet</span>
					</span>
				</button>
			</div>
		{/each}
	</section>
{/if}
