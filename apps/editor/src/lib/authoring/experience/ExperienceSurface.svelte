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
	 */
	import { untrack } from 'svelte';
	import type { StageAdapterServices } from '../stage/stage-adapter-host';
	import { stageEnvelope } from '../stage/unit-stage-source';
	import type { Experience, ExperienceContinuation, ProjectEnvelope } from '@portfolio/project-model/units';
	import { experienceFocus } from './focus.svelte';
	import {
		captureBindIntent,
		capturedViewPose,
		createExperienceIntent,
		guideOrderIntent,
		presentationUpdateIntent,
		stopCreateIntent,
		stopUpdateIntent
	} from './commands';

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

	let version = $state(0);
	$effect(() => {
		const off = services.stage.onAdaptersChanged(() => (version += 1));
		return off;
	});
	const snapshot = $derived.by((): ProjectEnvelope => {
		void version;
		return snapshotProp ?? stageEnvelope(services.stage.snapshot());
	});

	const experiences = $derived(snapshot.units.experience.data.experiences);
	const current = $derived.by((): Experience | null => {
		const focused = experienceFocus.experienceId;
		return experiences.find((entry) => entry.id === focused) ?? experiences[0] ?? null;
	});
	// Adopt the first Experience as focus, never create one implicitly.
	$effect(() => {
		if (experienceFocus.experienceId === null && current !== null) {
			untrack(() => (experienceFocus.experienceId = current!.id));
		}
	});
	const currentGuide = $derived.by(() => {
		if (current === null || experienceFocus.guideId === null) return null;
		return current.guides.find((guide) => guide.id === experienceFocus.guideId) ?? null;
	});
	const selectedPresentation = $derived.by(() => {
		if (current === null || experienceFocus.presentationId === null) return null;
		return current.presentations.find((entry) => entry.id === experienceFocus.presentationId) ?? null;
	});
	const selectedStop = $derived.by(() => {
		if (current === null || experienceFocus.stopId === null) return null;
		return current.stops.find((entry) => entry.id === experienceFocus.stopId) ?? null;
	});
	const stopUsage = $derived.by(() => {
		const usage = new Map<string, string[]>();
		for (const stop of current?.stops ?? []) {
			usage.set(stop.presentationId, [...(usage.get(stop.presentationId) ?? []), stop.id]);
		}
		return usage;
	});
	const guideStops = $derived.by(() =>
		currentGuide === null
			? []
			: currentGuide.stopIds
					.map((stopId) => current?.stops.find((stop) => stop.id === stopId) ?? null)
					.filter((stop): stop is NonNullable<typeof stop> => stop !== null)
	);
	let query = $state('');
	const filteredPresentations = $derived.by(() => {
		if (current === null) return [];
		const needle = query.trim().toLowerCase();
		if (needle === '') return current.presentations;
		return current.presentations.filter((entry) => entry.label.toLowerCase().includes(needle));
	});
	const viewsOf = $derived.by(() => {
		const views = snapshot.units.camera.data.views;
		const byPresentation = new Map<string, { id: string; label: string }[]>();
		for (const presentation of current?.presentations ?? []) {
			byPresentation.set(
				presentation.id,
				presentation.viewIds.map((viewId) => ({
					id: viewId,
					label: views.find((view) => view.id === viewId)?.label ?? viewId
				}))
			);
		}
		return byPresentation;
	});

	let message = $state('');
	let busy = $state(false);
	let presentationLabelDraft = $state('');
	let presentationTextDraft = $state('');
	let stopEntryViewDraft = $state('');
	let stopHoldDraft = $state('');
	let stopTargetDraft = $state('sequence-next');
	let stopTransitionDraft = $state<'cut' | 'travel'>('cut');

	$effect(() => {
		const presentation = selectedPresentation;
		untrack(() => {
			presentationLabelDraft = presentation?.label ?? '';
			presentationTextDraft = presentation?.text?.body ?? '';
		});
	});
	$effect(() => {
		const stop = selectedStop;
		untrack(() => {
			stopEntryViewDraft = stop?.entryViewId ?? '';
			stopHoldDraft = stop?.holdSeconds === undefined ? '' : String(stop.holdSeconds);
			const continuation = stop?.continuation;
			stopTargetDraft = continuation?.kind === 'stop' ? continuation.stopId : continuation?.kind === 'end' ? 'end' : 'sequence-next';
			stopTransitionDraft =
				continuation !== undefined && continuation.kind !== 'end' ? continuation.transition ?? 'cut' : 'cut';
		});
	});

	function newId(): string {
		return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}

	function revision() {
		return services.stage.snapshot().acceptedRevision;
	}

	async function run(builder: () => Parameters<StageAdapterServices['authoring']['accept']>[0]): Promise<void> {
		if (busy) return;
		busy = true;
		try {
			const outcome = await services.authoring.accept(builder());
			message = outcome.kind === 'refused' ? `${outcome.code}: ${outcome.message}` : 'Accepted.';
		} finally {
			busy = false;
		}
	}

	async function createExperience(): Promise<void> {
		const experienceId = newId();
		await run(() =>
			createExperienceIntent({
				revision: revision(),
				ids: { operation: newId(), experience: experienceId },
				label: `Experience ${experiences.length + 1}`
			})
		);
		experienceFocus.openExperience(experienceId);
	}

	function selectionSubjectEntityId(): string | null {
		const primary = services.stage.selectionState().primary;
		if (primary === null || primary.domain !== 'scene' || primary.subject.kind !== 'entity') return null;
		return primary.subject.id;
	}

	function currentCapturePose() {
		const evaluation = services.stage.evaluation();
		if (evaluation === null) {
			message = 'The Stage has not evaluated a reading yet; wait for the reading to settle.';
			return null;
		}
		return capturedViewPose({
			label: `View ${snapshot.units.camera.data.views.length + 1}`,
			eye: evaluation.eye,
			target: evaluation.target
		});
	}

	async function captureAndBind(): Promise<void> {
		if (current === null) return;
		const view = currentCapturePose();
		if (view === null) return;
		const presentationId = newId();
		const subjectEntityId = selectionSubjectEntityId();
		await run(() =>
			captureBindIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId(), view: newId(), presentation: presentationId, stop: newId() },
				experienceId: current.id,
				view,
				presentationLabel: `Presentation ${current.presentations.length + 1}`,
				subjectEntityId,
				text: null,
				guideId: currentGuide?.id ?? null,
				afterStopId: selectedStop?.id ?? null
			})
		);
		experienceFocus.selectPresentation(presentationId);
	}

	async function rebindToCapturedView(): Promise<void> {
		if (current === null || selectedPresentation === null) return;
		const view = currentCapturePose();
		if (view === null) return;
		await run(() =>
			presentationUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId(), view: newId() },
				experienceId: current.id,
				presentationId: selectedPresentation.id,
				view
			})
		);
	}

	async function savePresentation(): Promise<void> {
		if (current === null || selectedPresentation === null) return;
		const text = presentationTextDraft;
		await run(() =>
			presentationUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: current.id,
				presentationId: selectedPresentation.id,
				label: presentationLabelDraft,
				text: text === '' ? null : { kind: 'plain', body: text }
			})
		);
	}

	async function setDefaultView(presentationId: string, viewId: string): Promise<void> {
		if (current === null) return;
		await run(() =>
			presentationUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: current.id,
				presentationId,
				defaultViewId: viewId
			})
		);
	}

	async function insertStop(): Promise<void> {
		if (current === null || currentGuide === null || selectedPresentation === null) return;
		const stopId = newId();
		await run(() =>
			stopCreateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId(), stop: stopId },
				experienceId: current.id,
				presentationId: selectedPresentation.id,
				guideId: currentGuide.id,
				afterStopId: selectedStop?.id ?? null,
				entryViewId: null,
				holdSeconds: null,
				continuation: { kind: 'sequence-next', transition: 'cut' }
			})
		);
		experienceFocus.selectStop(stopId);
	}

	async function moveStop(stopId: string, direction: -1 | 1): Promise<void> {
		if (current === null || currentGuide === null) return;
		const order = [...currentGuide.stopIds];
		const at = order.indexOf(stopId);
		const to = at + direction;
		if (at === -1 || to < 0 || to >= order.length) return;
		[order[at], order[to]] = [order[to]!, order[at]!];
		await run(() =>
			guideOrderIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: current.id,
				guideId: currentGuide.id,
				stopIds: order
			})
		);
	}

	async function saveStop(): Promise<void> {
		if (current === null || selectedStop === null) return;
		const hold = stopHoldDraft.trim() === '' ? null : Number(stopHoldDraft);
		if (hold !== null && (!Number.isFinite(hold) || hold < 0)) {
			message = 'A hold is a finite number of seconds, or blank for none.';
			return;
		}
		let continuation: ExperienceContinuation | null = null;
		if (stopTargetDraft === 'end') continuation = { kind: 'end' };
		else if (stopTargetDraft === 'sequence-next') continuation = { kind: 'sequence-next', transition: stopTransitionDraft };
		else continuation = { kind: 'stop', stopId: stopTargetDraft, transition: stopTransitionDraft };
		await run(() =>
			stopUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: current.id,
				stopId: selectedStop.id,
				entryViewId: stopEntryViewDraft === '' ? null : stopEntryViewDraft,
				holdSeconds: hold,
				continuation
			})
		);
	}

	function presentationLabel(presentationId: string): string {
		return current?.presentations.find((entry) => entry.id === presentationId)?.label ?? presentationId;
	}
</script>

<section class="experience-surface" aria-label="Experience authoring">
	<header class="surface-head">
		<h2>Experience</h2>
		{#if experiences.length > 0}
			<label class="inline">
				<span>Experience</span>
				<select
					value={current?.id ?? ''}
					onchange={(event) => experienceFocus.openExperience(event.currentTarget.value)}
				>
					{#each experiences as entry (entry.id)}
						<option value={entry.id}>{entry.label}</option>
					{/each}
				</select>
			</label>
		{/if}
		<button type="button" onclick={createExperience} disabled={busy}>Create Experience</button>
		{#if onEnterPreview !== null}
			<button type="button" class="quiet" onclick={() => onEnterPreview?.()} disabled={current === null}>
				Enter Preview
			</button>
		{/if}
	</header>

	{#if current === null}
		<p class="empty">
			This world has no Experience yet. Create one explicitly; selecting or editing a world subject never
			creates a document implicitly.
		</p>
	{:else}
		<div class="columns">
			<section class="column" aria-label="Presentations">
				<div class="column-head">
					<h3>Presentations</h3>
					<label class="filter">
						<span>Search</span>
						<input type="search" bind:value={query} placeholder="Filter by label" />
					</label>
				</div>
				<ul class="rows">
					{#each filteredPresentations as presentation (presentation.id)}
						<li>
							<button
								type="button"
								class="row"
								class:active={selectedPresentation?.id === presentation.id}
								aria-pressed={selectedPresentation?.id === presentation.id}
								onclick={() => experienceFocus.selectPresentation(presentation.id)}
							>
								<span class="row-label">{presentation.label}</span>
								<span class="row-meta">
									{stopUsage.get(presentation.id)?.length ?? 0} Stop(s) ·
									{presentation.defaultViewId === null ? 'no Default' : 'Default set'}
								</span>
							</button>
						</li>
					{:else}
						<li class="empty-row">No Presentation matches this filter.</li>
					{/each}
				</ul>

				<div class="actions">
					<button type="button" onclick={captureAndBind} disabled={busy}>
						Capture View{selectionSubjectEntityId() === null ? '' : ' with selected subject'}
					</button>
				</div>
				<p class="hint">
					Capture records the Stage framing (eye, target, FOV) as a new View. The viewport's aspect is the
					Stage frame's, not an authored View field.
				</p>

				{#if selectedPresentation !== null}
					<div class="card">
						<h4>{selectedPresentation.label}</h4>
						<dl class="facts">
							<div><dt>Views</dt><dd>{viewsOf.get(selectedPresentation.id)?.length ?? 0}</dd></div>
							<div><dt>Default</dt><dd>{selectedPresentation.defaultViewId ?? 'unset — cannot be entered'}</dd></div>
							<div>
								<dt>Subject</dt>
								<dd>
									{selectedPresentation.subject === null
										? 'Environment / region'
										: `${selectedPresentation.subject.domain}:${selectedPresentation.subject.subject.kind}:${selectedPresentation.subject.subject.id}`}
								</dd>
							</div>
							<div>
								<dt>Used in</dt>
								<dd>{stopUsage.get(selectedPresentation.id)?.join(', ') ?? 'No Stop yet'}</dd>
							</div>
						</dl>
						{#if (viewsOf.get(selectedPresentation.id)?.length ?? 0) > 1}
							<label class="inline">
								<span>Default View</span>
								<select
									value={selectedPresentation.defaultViewId ?? ''}
									onchange={(event) => void setDefaultView(selectedPresentation!.id, event.currentTarget.value)}
								>
									{#each viewsOf.get(selectedPresentation.id) ?? [] as view (view.id)}
										<option value={view.id}>{view.label}</option>
									{/each}
								</select>
							</label>
						{/if}
						<div class="fields">
							<label>
								<span>Label</span>
								<input bind:value={presentationLabelDraft} />
							</label>
							<label class="grow">
								<span>Information text (plain, 4,000 characters)</span>
								<textarea rows="3" maxlength="4000" bind:value={presentationTextDraft}></textarea>
							</label>
						</div>
						<div class="actions">
							<button type="button" onclick={savePresentation} disabled={busy}>Save Presentation</button>
							<button type="button" class="quiet" onclick={rebindToCapturedView} disabled={busy}>
								Capture and rebind
							</button>
						</div>
					</div>
				{/if}
			</section>

			<section class="column" aria-label="Guides">
				<div class="column-head">
					<h3>Guides</h3>
					{#if current.guides.length === 0}
						<span class="hint">No Guide: Presentations are entered from the visitor list.</span>
					{:else}
						<label class="inline">
							<span>Open Guide</span>
							<select
								value={currentGuide?.id ?? ''}
								onchange={(event) => {
									const guide = current!.guides.find((entry) => entry.id === event.currentTarget.value) ?? null;
									experienceFocus.openGuide(guide?.id ?? null, guide?.entryStopId ?? null);
								}}
							>
								<option value="">None</option>
								{#each current.guides as guide (guide.id)}
									<option value={guide.id}>{guide.label}</option>
								{/each}
							</select>
						</label>
					{/if}
				</div>

				{#if currentGuide === null}
					<p class="hint">
						Open a Guide to edit its Stop order and transitions. Preview enters the Experience's entry Guide
						when no Guide is open.
					</p>
				{:else}
					<ol class="stop-list">
						{#each guideStops as stop, index (stop.id)}
							<li>
								<button
									type="button"
									class="row"
									class:active={selectedStop?.id === stop.id}
									aria-pressed={selectedStop?.id === stop.id}
									onclick={() => experienceFocus.selectStop(stop.id)}
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
									<button type="button" class="quiet" aria-label="Move up" onclick={() => void moveStop(stop.id, -1)} disabled={index === 0 || busy}>↑</button>
									<button type="button" class="quiet" aria-label="Move down" onclick={() => void moveStop(stop.id, 1)} disabled={index === guideStops.length - 1 || busy}>↓</button>
								</span>
							</li>
						{:else}
							<li class="empty-row">This Guide has no Stops yet.</li>
						{/each}
					</ol>

					<div class="actions">
						<button type="button" onclick={insertStop} disabled={busy || selectedPresentation === null}>
							Insert selected Presentation as a Stop
						</button>
					</div>

					{#if selectedStop !== null}
						<div class="card">
							<h4>Stop {selectedStop.id}</h4>
							<div class="fields">
								<label>
									<span>Entry View</span>
									<select bind:value={stopEntryViewDraft}>
										<option value="">Presentation Default</option>
										{#each viewsOf.get(selectedStop.presentationId) ?? [] as view (view.id)}
											<option value={view.id}>{view.label}</option>
										{/each}
									</select>
								</label>
								<label>
									<span>Hold (seconds, blank for none)</span>
									<input inputmode="decimal" bind:value={stopHoldDraft} />
								</label>
								<label>
									<span>Continue to</span>
									<select bind:value={stopTargetDraft}>
										<option value="sequence-next">Next in Guide</option>
										{#each current.stops as stop (stop.id)}
											{#if stop.id !== selectedStop.id}
												<option value={stop.id}>{stop.id}</option>
											{/if}
										{/each}
										<option value="end">End</option>
									</select>
								</label>
								<label>
									<span>Transition</span>
									<select bind:value={stopTransitionDraft} disabled={stopTargetDraft === 'end'}>
										<option value="cut">Cut (no travel)</option>
										<option value="travel">Travel (supported connection only)</option>
									</select>
								</label>
							</div>
							<p class="hint">
								A Travel is valid only where Camera connectivity joins the two Views. An unsupported Travel
								stays authored and Preview reports the gap; nothing silently cuts.
							</p>
							<div class="actions">
								<button type="button" onclick={saveStop} disabled={busy}>Save Stop</button>
							</div>
						</div>
					{/if}
				{/if}
			</section>
		</div>
	{/if}

	<p class="feedback" aria-live="polite">{message}</p>
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
