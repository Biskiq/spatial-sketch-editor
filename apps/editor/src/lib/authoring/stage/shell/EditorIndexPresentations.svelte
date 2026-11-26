<script lang="ts">
	import ExperienceSnapshot from '$lib/authoring/experience/ExperienceSnapshot.svelte';
	import ShellIcon from './ShellIcon.svelte';
	import type { ExperienceIndexGroups } from './experience-index-groups';

	let { experience, onRename }: { experience: ExperienceIndexGroups; onRename: (id: string) => void } = $props();

	/** A Presentation row's snapshot shows its default View, or its first View when none is marked. */
	function representativeViewId(views: readonly { readonly id: string; readonly isDefault: boolean }[]): string | null {
		return (views.find((view) => view.isDefault) ?? views[0])?.id ?? null;
	}

	/** A Presentation row's Stop numbers: the first three, then how many follow. */
	function stopsLabel(numbers: readonly number[]): string {
		const shown = numbers.slice(0, 3).join(', ');
		return numbers.length > 3 ? `${shown} +${numbers.length - 3}` : shown;
	}
</script>

<section class="group" aria-labelledby="index-presentations">
	<h3 id="index-presentations" class="group-title">
		Presentations <span class="count">{experience.totalPresentations}</span>
	</h3>
	{#if experience.pending}
		<p class="index-empty">The Experience lens mounts with the admitted project source.</p>
	{:else if experience.current === null}
		<p class="index-empty">Nothing presented yet. Start from the Stage.</p>
	{:else if experience.presentations.length === 0}
		<p class="index-empty">
			{experience.query.trim() === ''
				? 'Nothing presented yet. Select an object and choose Present this, or press Capture in the dock.'
				: `Nothing matches "${experience.query.trim()}".`}
		</p>
	{:else}
		<ul class="group-items">
			{#each experience.presentations as presentation (presentation.id)}
				<li class="item" data-presentation-id={presentation.id}>
					<!-- Only the Presentation's own row carries its selection; its Views keep their own. -->
					<div class="item-head" class:selected={presentation.selected}>
						<button
							type="button"
							class="item-row presentation-row"
							draggable="true"
							aria-current={presentation.selected ? 'true' : undefined}
							aria-label={`Presentation ${presentation.label}`}
							ondragstart={(event) => {
								if (!event.dataTransfer) return;
								event.dataTransfer.setData('application/x-biskiq-presentation', presentation.id);
								event.dataTransfer.effectAllowed = 'copy';
							}}
							onclick={() => experience.onSelectPresentation(presentation.id)}
							ondblclick={() => {
								experience.onSelectPresentation(presentation.id);
								onRename(presentation.id);
							}}
						>
							<ExperienceSnapshot label={presentation.label} viewId={representativeViewId(presentation.views)} ratio="row" selected={presentation.selected} />
							<span class="item-text">
								<span class="item-name">{presentation.label}</span>
								<span class="item-meta"
									>{presentation.viewCount} {presentation.viewCount === 1 ? 'View' : 'Views'} · {#if presentation.stopNumbers.length > 0}Stops {stopsLabel(presentation.stopNumbers)}{:else}<span class="free-tag">{presentation.explorable ? 'free' : 'hidden'}</span>{/if}</span
								>
							</span>
						</button>
						<button
							type="button"
							class="twist"
							aria-expanded={presentation.expanded}
							aria-label={`${presentation.expanded ? 'Hide' : 'Show'} Views of ${presentation.label}`}
							disabled={presentation.views.length === 0}
							onclick={() => experience.onToggleExpand(presentation.id)}
						>
							<ShellIcon name={presentation.expanded ? 'chevronDown' : 'chevronRight'} size={12} />
						</button>
					</div>
					{#if presentation.expanded}
						<ul class="view-list">
							{#each presentation.views.slice(0, 8) as view (view.id)}
								<li class="view-line">
									<button
										type="button"
										class="view-row"
										class:selected={view.selected}
										aria-current={view.selected ? 'true' : undefined}
										aria-label={`${view.label}, ${view.onTour ? 'on tour' : presentation.explorable ? 'free' : 'hidden from free exploration'}${view.isDefault ? ', Default View' : ''}`}
										onclick={() => experience.onSelectView(view.id, presentation.id)}
									>
										<span class="tour-mark" class:on={view.onTour} aria-hidden="true"></span>
										<span class="view-name">{view.label}</span>
										{#if view.isDefault}<span class="default-mark" title="Default View" aria-hidden="true">◆</span>{/if}
									</button>
									<button
										type="button"
										class="view-add"
										data-view-add={view.id}
										aria-label={`Add Stop from ${view.label}`}
										title={`Add a Stop that enters at ${view.label}`}
										onclick={() => experience.onAddStopFromView(view.id, presentation.id)}
									>+ Stop</button>
								</li>
							{/each}
							{#if presentation.views.length > 8}
								<li>
									<button type="button" class="view-more" onclick={() => experience.onSelectPresentation(presentation.id)}>+{presentation.views.length - 8} more — see all in the Card</button>
								</li>
							{/if}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
