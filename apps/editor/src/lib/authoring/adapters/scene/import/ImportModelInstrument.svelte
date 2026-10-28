<script lang="ts">
	/**
	 * T2.P02.S02 — the Import procedure instrument.
	 *
	 * A Library procedure hosted in the one lower Instrument: choose, read,
	 * review, confirm and approve one of the creator's own models, then arm it for
	 * a floor placement. It reads only the public `StageAdapterServices`, so it
	 * edits no host, shell or route module.
	 *
	 * Everything the source contains is reported, and what is *admitted* is stated
	 * separately: parts, clips and variants are observed, never admitted. The
	 * metric scale is never inferred — the creator confirms it, or nothing is
	 * approved.
	 */
	import { onDestroy, onMount, untrack } from 'svelte';
	import { env } from '$env/dynamic/public';

	import type { StageAdapterServices } from '../../../stage/stage-adapter-host';
	import { UNIT_SOURCE_KIND, type TypedResource } from '@portfolio/project-model/units';
	import { creatorModelDefinition, approvedModelResources } from '@portfolio/project-model/scene-planning';
	import { stageEnvelope } from '../../../stage/unit-stage-source';

	import { CreatorImportSession, type ArmedCreatorModel, type CreatorImportSessionState } from './session';
	import { clearArmedModel, rememberArmedModel, rememberCreatorDefinition } from './definitions';
	import type { CreatorImportPivot } from './types';

	let {
		services,
		invokingFocus: providedInvokingFocus = null
	}: {
		services: StageAdapterServices;
		/** The control that invoked Import, captured before the lazy chunk loaded. */
		invokingFocus?: HTMLElement | null;
	} = $props();

	// The session is bound to the project and host epoch this instrument opened
	// under; a later reading or project does not retarget it.
	const projectId = untrack(() => services.stage.snapshot().acceptedRevision.projectId);
	const session = new CreatorImportSession({
		projectId,
		apiOrigin: env.PUBLIC_API_ORIGIN ?? ''
	});

	let view = $state<CreatorImportSessionState>(session.state());
	let name = $state('');
	let scaleText = $state('1');
	let pivotChoice = $state<CreatorImportPivot>('bottom-centre');
	let busy = $state(false);
	let message = $state<string | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();
	/** Approved models already in this project: place another instance, no re-import. */
	let approved = $state<readonly TypedResource[]>([]);
	let invokingFocus: HTMLElement | null = null;

	const unsubscribe = session.subscribe((next) => {
		view = next;
	});

	onMount(() => {
		invokingFocus =
			providedInvokingFocus ??
			(document.activeElement instanceof HTMLElement ? document.activeElement : null);
		refreshApproved();
	});

	/** The bounded current-project entry: every placeable approved model. */
	function refreshApproved(): void {
		approved = approvedModelResources(stageEnvelope(services.stage.snapshot()));
	}

	/**
	 * Arm an already-approved model without importing it again.
	 *
	 * The resource stays in the accepted envelope, so the placement introduces no
	 * resource and no lock: it adds one entity identity that shares the same
	 * immutable pins as every other instance.
	 */
	async function placeApproved(resource: TypedResource): Promise<void> {
		const definition = await creatorModelDefinition(resource, 'Imported model');
		if (definition === null) {
			message = 'That approved model has no usable placement definition.';
			return;
		}
		arm({ resourceId: resource.id, name: 'Imported model', definition, resource: null });
	}

	onDestroy(() => {
		unsubscribe();
		session.dispose();
		// Focus returns to the Library/Find control that invoked Import.
		invokingFocus?.focus();
	});

	const report = $derived(view.report);
	/** A model is approved without a floor, but placement needs one. */
	const hasRoomFloor = $derived.by(() => {
		const snapshot = services.stage.snapshot();
		if (snapshot.sourceKind !== UNIT_SOURCE_KIND) return true;
		return stageEnvelope(snapshot).units.layout.data.rooms.length > 0;
	});
	const canPrepare = $derived(view.files.length > 0 && !busy && view.step !== 'uploading');
	const canApprove = $derived(
		report !== null && !busy && view.step !== 'uploading' && view.step !== 'approved'
	);

	function applyParameters(): boolean {
		const value = Number(scaleText.trim());
		if (!Number.isFinite(value) || value <= 0) {
			message = 'The metric scale must be a finite number greater than zero.';
			return false;
		}
		message = null;
		session.setParameters({ metresPerSourceUnit: value, pivot: pivotChoice });
		return true;
	}

	async function prepare(): Promise<void> {
		if (!applyParameters()) return;
		busy = true;
		try {
			await session.prepare();
		} finally {
			busy = false;
		}
	}

	async function approve(): Promise<void> {
		if (!applyParameters()) return;
		busy = true;
		try {
			await session.approve(name);				const state = session.state();
				if (state.step === 'approved' && state.armed !== null) {
					refreshApproved();
					arm(state.armed);
				}
		} finally {
			busy = false;
		}
	}

	async function cancel(): Promise<void> {
		busy = true;
		try {
			await session.cancel();
		} finally {
			busy = false;
		}
	}

	/**
	 * Arm the approved model for its first placement, then open the Scene Place
	 * task.
	 *
	 * The approved definition is remembered so the planner can resolve the exact
	 * same metadata identity at commit, and the model itself is left as the
	 * adapter's pending arm — this procedure owns no Scene session, so it cannot
	 * strand one. The placement is an ordinary accepted Scene operation.
	 */
	function arm(armed: ArmedCreatorModel): void {
		rememberCreatorDefinition(armed.definition);
		rememberArmedModel(projectId, { definition: armed.definition, resource: armed.resource });
		const opened = services.stage.openContributedTask('scene-place', 'scene');
		if (opened.kind !== 'opened') {
			// Nothing will consume the pending arm, so it must not survive to arm a
			// later, unrelated Place task.
			clearArmedModel(projectId);
			message = `The placement task could not be opened: ${opened.message}`;
		}
	}

	async function choose(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		message = null;
		await session.choose(files);
		name = view.files.find((file) => /\.(glb|gltf)$/i.test(file.path))?.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
	}
</script>

<div class="import">
	<p class="intro">
		One GLB, or one glTF with its local buffers and maps. Nothing is written to the project until you approve it.
	</p>

	<div class="choose">
		<label for="creator-model-file">Model files</label>
		<input
			id="creator-model-file"
			bind:this={fileInput}
			type="file"
			multiple
			accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp"
			onchange={choose}
			disabled={busy || view.step === 'uploading'}
		/>
		{#if view.files.length > 0}
			<ul class="files" aria-label="Chosen files">
				{#each view.files as file (file.path)}
					<li>{file.path} · {Math.ceil(file.size / 1024)} KiB</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if view.progress}
		<p class="progress" role="status">{view.progress.detail}</p>
	{/if}

	<fieldset class="confirm">
		<legend>Confirm scale and pivot</legend>
		<label class="field">
			<span>Metres per source unit</span>
			<input type="text" inputmode="decimal" bind:value={scaleText} disabled={busy} />
			<span class="hint">Explicit: a glTF carries no units. 1 means the source is already in metres.</span>
		</label>
		<label class="field">
			<span>Name</span>
			<input type="text" bind:value={name} disabled={busy} />
		</label>
		<div class="pivot" role="radiogroup" aria-label="Pivot">
			<label><input type="radio" bind:group={pivotChoice} value="bottom-centre" /> Bottom centre</label>
			<label><input type="radio" bind:group={pivotChoice} value="bounds-centre" /> Bounds centre</label>
		</div>
	</fieldset>

	{#if report}
		<section class="report" aria-label="Import report">
			<h3>Found</h3>
			<p>
				{report.observed.nodes} nodes ({report.observed.emptyNodes} empty) ·
				{report.observed.meshes} meshes · {report.observed.triangles} triangles ·
				{report.observed.textures} textures
			</p>
			<p>
				Footprint {report.placement.footprint.width.toFixed(3)} × {report.placement.footprint.depth.toFixed(3)} m ·
				contact {report.placement.contactMinY.toFixed(3)} m · height {report.placement.height.toFixed(3)} m
			</p>
			{#if report.textures.reductions.length > 0}
				<p>Textures capped at {report.textures.capPx} px: {report.textures.reductions.length} reduced.</p>
			{/if}
			<p class="not-admitted">
				Parts, clips and variants found: {report.observed.animationNames.length} animations,
				{report.observed.variantNames.length} variants — reported, not admitted. The imported object is one whole model.
			</p>
			{#if report.warnings.length > 0}
				<ul class="warnings">{#each report.warnings as warning}<li>{warning}</li>{/each}</ul>
			{/if}
		</section>
	{/if}

	{#if view.staging}
		<p class="progress" role="status">
			Uploading {view.staging.uploaded} of {view.staging.total} files.
		</p>
	{/if}

	{#if view.message}
		<p class="error" role="alert">{view.message}</p>
	{/if}
	{#if message}
		<p class="error" role="alert">{message}</p>
	{/if}

	{#if approved.length > 0}
		<section class="approved" aria-label="Approved models in this project">
			<h3>Already approved</h3>
			<ul>
				{#each approved as resource (resource.id)}
					<li>
						<span>
							{resource.model?.placement.footprint.width.toFixed(3)} ×
							{resource.model?.placement.footprint.depth.toFixed(3)} m
						</span>
						<button type="button" onclick={() => placeApproved(resource)} disabled={busy}>
							Place another
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if !hasRoomFloor}
		<p class="hint" role="status">
			This project has no Room floor yet. Approval can proceed, but placement waits: draw an
			enclosure with Ink, then reopen Place object.
		</p>
	{/if}

	<div class="actions">
		<button type="button" onclick={prepare} disabled={!canPrepare}>
			{report === null ? 'Read model' : 'Review again'}
		</button>
		<button type="button" class="primary" onclick={approve} disabled={!canApprove}>
			Approve and place
		</button>
		<button type="button" onclick={cancel} disabled={busy && view.step === 'idle'}>Cancel</button>
	</div>
</div>

<style>
	.import {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		min-width: min(28rem, 80vw);
		font-size: 0.82rem;
	}

	.intro {
		margin: 0;
		color: #c9c4d4;
	}

	.choose {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.files {
		margin: 0.1rem 0 0;
		padding-left: 1.1rem;
		color: #bdb7c8;
	}

	fieldset {
		border: 1px solid #4d4655;
		border-radius: 0.4rem;
		padding: 0.5rem 0.65rem;
		margin: 0;
	}

	legend {
		padding: 0 0.3rem;
		color: #c9a9ff;
		font-weight: 600;
	}

	.field {
		display: grid;
		grid-template-columns: 12rem 8rem 1fr;
		align-items: center;
		gap: 0.4rem;
	}

	.hint {
		color: #8f8a99;
		font-size: 0.74rem;
	}

	input[type='text'] {
		min-height: 2.25rem;
		padding: 0 0.4rem;
		border: 1px solid #635a6f;
		border-radius: 0.35rem;
		background: #292632;
		color: inherit;
		font: inherit;
	}

	.pivot {
		display: flex;
		gap: 1rem;
		margin-top: 0.35rem;
	}

	.approved h3 {
		margin: 0 0 0.25rem;
		font-size: 0.8rem;
		color: #c9a9ff;
	}

	.approved ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.approved li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.report h3 {
		margin: 0 0 0.25rem;
		font-size: 0.8rem;
		color: #c9a9ff;
	}

	.report p {
		margin: 0.15rem 0;
	}

	.not-admitted {
		color: #d8cfae;
	}

	.warnings {
		margin: 0.2rem 0 0;
		padding-left: 1.1rem;
		color: #e0b18f;
	}

	.progress {
		margin: 0;
		color: #bdb7c8;
	}

	.error {
		margin: 0;
		color: #ff9f8a;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	button {
		min-height: 2.5rem;
		padding: 0 0.7rem;
		border: 1px solid #635a6f;
		border-radius: 0.35rem;
		background: #292632;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	button.primary {
		border-color: #c9a9ff;
	}

	button:disabled {
		cursor: default;
		opacity: 0.55;
	}

	button:focus-visible,
	input:focus-visible {
		outline: 2px solid #2f8cff;
		outline-offset: 1px;
	}
</style>
