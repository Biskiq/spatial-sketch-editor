<script lang="ts">
	/**
	 * T3.P02.S01 — the Experience lens surface.
	 *
	 * The slice's first useful authoring surface, mounted in the Experience lens and
	 * reachable as the Experience adapter's instrument. It reads the accepted source
	 * through the public Stage services and submits every edit through the one F.4
	 * acceptance port, so each command is one accepted result with one undo payload.
	 *
	 * What it deliberately is not: no timeline, no second Camera controller, no
	 * selection store, and no editable order outside `guide-order`. A Guide's Stop
	 * order and its Cut/Travel selectors are the only editorial order it writes.
	 *
	 * R217.S24: the commands, the derived reading, the message, the busy flag and the
	 * drafts live in createExperienceController. This component keeps the markup, the
	 * styles and the one piece of view state, which Guide column is open.
	 */
	import type { StageAdapterServices } from '../stage/stage-adapter-host';
	import type { ProjectEnvelope } from '@portfolio/project-model/units';
	import { createExperienceController } from './experience-controller.svelte';

	let {
		services,
		snapshot: snapshotProp = null,
		onEnterPreview = null
	}: {
		services: StageAdapterServices;
		/** The route's live accepted snapshot; absent in the instrument host. */
		snapshot?: ProjectEnvelope | null;
		onEnterPreview?: (() => void) | null;
	} = $props();

	// Getters: the route can replace the services or the snapshot without unmounting.
	const controller = createExperienceController(
		() => services,
		() => snapshotProp
	);
	const {
		drafts,
		createExperience,
		captureAndBind,
		createFirstGuide,
		rebindToCapturedView,
		savePresentation,
		setDefaultView,
		insertStop,
		moveStop,
		saveStop,
		presentationLabel,
		firstGuidePresentation,
		openExperience,
		chooseGuide,
		selectPresentation,
		selectStop
	} = controller;

	/** The Guide instrument is invoked from the dock; the surface is its content. */
	let guideOpen = $state(true);
</script>

<section class="experience-surface" aria-label="Experience authoring">
	<header class="surface-head">
		<h2>Experience</h2>
		{#if controller.experiences.length > 0}
			<label class="inline">
				<span>Experience</span>
				<select
					value={controller.current?.id ?? ''}
					onchange={(event) => openExperience(event.currentTarget.value)}
				>
					{#each controller.experiences as entry (entry.id)}
						<option value={entry.id}>{entry.label}</option>
					{/each}
				</select>
			</label>
		{/if}
		<button type="button" onclick={createExperience} disabled={controller.busy}>Create Experience</button>
		{#if onEnterPreview !== null}
			<button type="button" class="quiet" onclick={() => onEnterPreview?.()} disabled={controller.current === null}>
				Enter Preview
			</button>
		{/if}
	</header>

	{#if controller.current === null}
		<p class="empty">
			This world has no Experience yet. Create one explicitly; selecting or editing a world subject never
			creates a document implicitly.
		</p>
	{:else}
		<div class="columns" class:solo={!guideOpen}>
			<section class="column" aria-label="Presentations">
				<div class="column-head">
					<h3>Presentations</h3>
					<label class="filter">
						<span>Search</span>
						<input type="search" bind:value={controller.query} placeholder="Filter by label" />
					</label>
				</div>
				<ul class="rows">
					{#each controller.filteredPresentations as presentation (presentation.id)}
						<li>
							<button
								type="button"
								class="row"
								class:active={controller.selectedPresentation?.id === presentation.id}
								aria-pressed={controller.selectedPresentation?.id === presentation.id}
								onclick={() => selectPresentation(presentation.id)}
							>
								<span class="row-label">{presentation.label}</span>
								<span class="row-meta">
									{controller.stopUsage.get(presentation.id)?.length ?? 0} Stop(s) ·
									{presentation.defaultViewId === null ? 'no Default' : 'Default set'}
								</span>
							</button>
						</li>
					{:else}
						<li class="empty-row">No Presentation matches this filter.</li>
					{/each}
				</ul>

				<p class="hint">
					Capture records the Stage framing (eye, target, FOV) as a new View; it is the dock's Capture
					key, the one place that operation is exposed. The viewport's aspect is the Stage frame's, not an
					authored View field.
				</p>

				{#if controller.selectedPresentation !== null}
					<div class="card">
						<h4>{controller.selectedPresentation.label}</h4>
						<dl class="facts">
							<div><dt>Views</dt><dd>{controller.viewsOf.get(controller.selectedPresentation.id)?.length ?? 0}</dd></div>
							<div><dt>Default</dt><dd>{controller.selectedPresentation.defaultViewId ?? 'unset — cannot be entered'}</dd></div>
							<div>
								<dt>Subject</dt>
								<dd>
									{controller.selectedPresentation.subject === null
										? 'Environment / region'
										: `${controller.selectedPresentation.subject.domain}:${controller.selectedPresentation.subject.subject.kind}:${controller.selectedPresentation.subject.subject.id}`}
								</dd>
							</div>
							<div>
								<dt>Used in</dt>
								<dd>{controller.stopUsage.get(controller.selectedPresentation.id)?.join(', ') ?? 'No Stop yet'}</dd>
							</div>
						</dl>
						{#if (controller.viewsOf.get(controller.selectedPresentation.id)?.length ?? 0) > 1}
							<label class="inline">
								<span>Default View</span>
								<select
									value={controller.selectedPresentation.defaultViewId ?? ''}
									onchange={(event) => void setDefaultView(controller.selectedPresentation!.id, event.currentTarget.value)}
								>
									{#each controller.viewsOf.get(controller.selectedPresentation.id) ?? [] as view (view.id)}
										<option value={view.id}>{view.label}</option>
									{/each}
								</select>
							</label>
						{/if}
						<div class="fields">
							<label>
								<span>Label</span>
								<input bind:value={drafts.presentationLabel} />
							</label>
							<label class="grow">
								<span>Information text (plain, 4,000 code points)</span>
								<textarea rows="3" bind:value={drafts.presentationText}></textarea>
							</label>
						</div>
						<div class="actions">
							<button type="button" onclick={savePresentation} disabled={controller.busy}>Save Presentation</button>
							<button type="button" class="quiet" onclick={rebindToCapturedView} disabled={controller.busy}>
								Capture and rebind
							</button>
						</div>
					</div>
				{/if}
			</section>

			{#if guideOpen}
				<section class="column" aria-label="Guides">
					<div class="column-head">
						<h3>Guides</h3>
						{#if controller.current.guides.length === 0}
							<span class="hint">No Guide: Presentations are entered from the visitor list.</span>
						{:else}
							<label class="inline">
								<span>Open Guide</span>
								<select
									value={controller.currentGuide?.id ?? ''}
									onchange={(event) => chooseGuide(event.currentTarget.value)}
								>
									<option value="">None</option>
									{#each controller.current.guides as guide (guide.id)}
										<option value={guide.id}>{guide.label}</option>
									{/each}
								</select>
							</label>
						{/if}
					</div>

					{#if controller.currentGuide === null}
						<p class="hint">
							This Experience carries no Guide, so its Presentations are entered from the visitor list.
							Creating the first Guide names it the entry Guide explicitly.
						</p>
						{#if controller.current.guides.length === 0}
							<div class="card" aria-label="First Guide">
								<h4>First Guide</h4>
								<p class="hint">
									Creates one Guide with an initial distinct Stop from the selected Presentation (or the
									selected Stop's Presentation). The Stop enters that Presentation's own View; no Camera
									pose is copied and no Connection is made.
								</p>
								<label>
									<span>Guide label</span>
									<input bind:value={drafts.firstGuideLabel} placeholder="Guide" />
								</label>
								<div class="actions">
									<button
										type="button"
										onclick={createFirstGuide}
										disabled={controller.busy || firstGuidePresentation() === null}
									>
										Create first Guide
									</button>
								</div>
							</div>
						{/if}
					{:else}
						<ol class="stop-list">
							{#each controller.guideStops as stop, index (stop.id)}
								<li>
									<button
										type="button"
										class="row"
										class:active={controller.selectedStop?.id === stop.id}
										aria-pressed={controller.selectedStop?.id === stop.id}
										onclick={() => selectStop(stop.id)}
									>
										<span class="row-label">{index + 1}. {presentationLabel(stop.presentationId)}</span>
										<span class="row-meta">
											{stop.entryViewId ?? 'Default'} · hold {stop.holdSeconds ?? 0}s · {(stop.continuation?.kind ?? 'sequence-next')}
											{stop.continuation !== undefined && stop.continuation.kind !== 'end'
												? ` · ${stop.continuation.transition ?? 'cut'}`
												: ''}
										</span>
									</button>
									<span class="reorder">
										<button type="button" class="quiet" aria-label="Move up" onclick={() => void moveStop(stop.id, -1)} disabled={index === 0 || controller.busy}>↑</button>
										<button type="button" class="quiet" aria-label="Move down" onclick={() => void moveStop(stop.id, 1)} disabled={index === controller.guideStops.length - 1 || controller.busy}>↓</button>
									</span>
								</li>
							{:else}
								<li class="empty-row">This Guide has no Stops yet.</li>
							{/each}
						</ol>

						<div class="actions">
							<button type="button" onclick={insertStop} disabled={controller.busy || controller.selectedPresentation === null}>
								Insert selected Presentation as a Stop
							</button>
						</div>

						{#if controller.selectedStop !== null}
							<div class="card">
								<h4>Stop {controller.selectedStop.id}</h4>
								<div class="fields">
									<label>
										<span>Entry View</span>
										<select bind:value={drafts.stopEntryView}>
											<option value="">Presentation Default</option>
											{#each controller.viewsOf.get(controller.selectedStop.presentationId) ?? [] as view (view.id)}
												<option value={view.id}>{view.label}</option>
											{/each}
										</select>
									</label>
									<label>
										<span>Hold (seconds, blank for none)</span>
										<input inputmode="decimal" bind:value={drafts.stopHold} />
									</label>
									<label>
										<span>Continue to</span>
										<select bind:value={drafts.stopTarget}>
											<option value="sequence-next">Next in Guide</option>
											{#each controller.current.stops as stop (stop.id)}
												{#if stop.id !== controller.selectedStop.id}
													<option value={stop.id}>{stop.id}</option>
												{/if}
											{/each}
											<option value="end">End</option>
										</select>
									</label>
									<label>
										<span>Transition</span>
										<select bind:value={drafts.stopTransition} disabled={drafts.stopTarget === 'end'}>
											<option value="cut">Cut (no travel)</option>
											<option value="travel">Travel (supported connection only)</option>
										</select>
									</label>
								</div>
								<p class="hint">
									A Travel is valid only where Camera connectivity joins the two Views. An unsupported Travel
									stays authored and Preview reports the gap; nothing silently cuts.
								</p>
								{#each controller.travelGaps as gap (gap)}
									<p class="hint" role="alert">{gap}</p>
								{/each}
								<div class="actions">
									<button type="button" onclick={saveStop} disabled={controller.busy}>Save Stop</button>
									{#if onEnterPreview !== null}
										<button type="button" class="quiet" onclick={() => onEnterPreview?.()}>
											Preview from this Stop
										</button>
									{/if}
								</div>
							</div>
						{/if}
					{/if}
				</section>
			{/if}
		</div>
		{#if !guideOpen}
			<p class="hint">
				The Guide instrument is closed. Open Guide in the dock to compose Stops, transitions and playback.
				Presentations and the selected Presentation's facts stay in this lens.
			</p>
		{/if}
	{/if}

	<!--
		The Experience dock (Round 2 lower edge): Select is the pointer tool, Capture takes
		the Stage framing as a View and Guide invokes the one contextual Guide instrument
		above it. It is not a second writer: every key submits through this surface's one
		acceptance port.
	-->
	<div class="dock" role="toolbar" aria-label="Experience dock">
		<button
			type="button"
			class="key armed"
			aria-pressed="true"
			title="Select — the pointer selects subjects on the Stage"
		>
			Select
		</button>
		<button
			type="button"
			class="key"
			onclick={captureAndBind}
			disabled={controller.busy || controller.current === null}
			title="Capture — what you see becomes a View"
		>
			Capture
		</button>
		<button
			type="button"
			class="key"
			aria-pressed={guideOpen}
			onclick={() => (guideOpen = !guideOpen)}
			title="Guide — Stop composition, transitions and playback"
		>
			Guide
		</button>
	</div>

	<p class="feedback" aria-live="polite">{controller.message}</p>
</section>

<style>
	.experience-surface {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		max-height: 100%;
		overflow: auto;
		padding: 0.75rem;
		background: rgb(12 14 20 / 92%);
		border: 1px solid #3a4152;
		border-radius: 0.5rem;
		color: #eef0f5;
		font: 500 0.78rem/1.35 Inter, ui-sans-serif, system-ui, sans-serif;
	}
	.surface-head,
	.column-head,
	.actions,
	.inline,
	.reorder {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.surface-head h2,
	.column-head h3,
	.card h4 {
		margin: 0;
		font-size: 0.9rem;
	}
	.columns {
		display: grid;
		grid-template-columns: minmax(16rem, 1fr) minmax(16rem, 1fr);
		gap: 0.75rem;
		min-height: 0;
	}
	.columns.solo {
		grid-template-columns: 1fr;
	}
	@media (max-width: 900px) {
		.columns {
			grid-template-columns: 1fr;
		}
	}
	.column {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}
	.rows,
	.stop-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-height: 16rem;
		overflow: auto;
	}
	.stop-list li {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.row {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1rem;
		padding: 0.35rem 0.5rem;
		background: #171b24;
		border: 1px solid #333a48;
		border-radius: 0.35rem;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.row.active {
		border-color: #c9a9ff;
		background: #241f31;
	}
	.row-meta,
	.hint,
	.empty-row {
		color: #9aa2b1;
		font-size: 0.7rem;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.55rem;
		background: #131720;
		border: 1px solid #333a48;
		border-radius: 0.4rem;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 0.3rem 0.6rem;
		margin: 0;
	}
	.facts dt {
		color: #8f8a99;
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.facts dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.fields {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	label > span {
		color: #8f8a99;
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	label.grow {
		flex: 1;
		min-width: 12rem;
	}
	input,
	select,
	textarea,
	button {
		font: inherit;
		padding: 0.22rem 0.4rem;
		border: 1px solid #4a5365;
		border-radius: 0.3rem;
		background: #1d2230;
		color: inherit;
	}
	input,
	select {
		min-width: 7rem;
	}
	button {
		cursor: pointer;
	}
	button:disabled {
		cursor: default;
		opacity: 0.5;
	}
	button.quiet {
		background: transparent;
	}
	.dock {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem;
		background: #16211c;
		border: 1px solid rgb(255 255 255 / 14%);
		border-radius: 0.45rem;
	}
	.dock .key {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.32rem 0.55rem;
		border: 1px solid rgb(255 255 255 / 16%);
		border-radius: 0.3rem;
		background: #1e2a24;
		color: #f3f0e4;
		font: 500 0.72rem/1.2 Inter, ui-sans-serif, system-ui, sans-serif;
		cursor: pointer;
	}
	.dock .key[aria-pressed='true'] {
		background: #f3f0e4;
		color: #16211c;
		border-color: #f3f0e4;
	}
	.dock .key:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.feedback {
		margin: 0;
		min-height: 1.1rem;
		color: #e7e4dd;
	}
	.empty {
		margin: 0;
		color: #c8cdd7;
	}
</style>
