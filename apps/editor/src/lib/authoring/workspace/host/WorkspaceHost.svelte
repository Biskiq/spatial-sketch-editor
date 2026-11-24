<script lang="ts">
	import type { ExperienceController } from '$lib/authoring/experience/experience-controller.svelte';
	import type { ExperienceProblem } from '$lib/authoring/experience/experience-problems';
	import EditorHead from '$lib/authoring/stage/shell/EditorHead.svelte';
	import StagePanels from '$lib/authoring/stage/shell/StagePanels.svelte';
	import StageProjectNotices from '$lib/authoring/stage/shell/StageProjectNotices.svelte';
	import StageToolbars from '$lib/authoring/stage/shell/StageToolbars.svelte';
	import StageViewportRegion from '$lib/authoring/stage/shell/StageViewportRegion.svelte';
	import StageBootPanels from '$lib/authoring/stage/shell/StageBootPanels.svelte';
	import StageReplaceDialog from '$lib/authoring/stage/shell/StageReplaceDialog.svelte';
	import AppearanceSharedRegions from '$lib/authoring/look/AppearanceSharedRegions.svelte';
	import WorldLeading from '../world/WorldLeading.svelte';
	import WorldTrailing from '../world/WorldTrailing.svelte';
	import type { WorkspaceHost } from './workspace-host.svelte';

	let { host }: { host: WorkspaceHost } = $props();
</script>

{#if host}
	{@const adapterServices = host.adapterServices}
	{@const appearance = host.appearance}
	{@const artwork = host.artwork}
	{@const boot = host.boot}
	{@const bootRepair = host.bootRepair}
	{@const changeLens = host.changeLens}
	{@const commands = host.commands}
	{@const coreRegions = host.coreRegions}
	{@const currentEnvelope = host.currentEnvelope}
	{@const dismissResumeOffer = host.dismissResumeOffer}
	{@const evaluation = host.evaluation}
	{@const experience = host.experience}
	{@const experienceFeature = host.experienceFeature}
	{@const history = host.history}
	{@const historyState = host.historyState}
	{@const library = host.library}
	{@const lightInspection = host.lightInspection}
	{@const lookThroughActiveNow = host.lookThroughActiveNow}
	{@const patchDrafting = host.patchDrafting}
	{@const pendingReplacement = host.pendingReplacement}
	{@const preview = host.preview}
	{@const previewAvailable = host.previewAvailable}
	{@const previewController = host.previewController}
	{@const projectSession = host.projectSession}
	{@const readings = host.readings}
	{@const ready = host.ready}
	{@const refresh = host.refresh}
	{@const resumeOffer = host.resumeOffer}
	{@const resumePendingSave = host.resumePendingSave}
	{@const runReplacement = host.runReplacement}
	{@const selection = host.selection}
	{@const setReading = host.setReading}
	{@const shell = host.shell}
	{@const sky = host.sky}
	{@const sourceFindings = host.sourceFindings}
	{@const sourceProblems = host.sourceProblems}
	{@const studioFeature = host.studioFeature}
	{@const viewportPreview = host.viewportPreview}

<div class="editor-host" data-shell="living-draft">
	{#if preview === null}
		<EditorHead
			{...coreRegions.head}
			lens={experience.lensState}
			onLens={changeLens}
			canPreview={previewAvailable}
			onPreview={() => void previewController.open()}
			previewUnavailableReason={currentEnvelope === null
				? 'Preview needs an admitted project source.'
				: 'Create an Experience in the Experience lens to Preview it.'}
			{...appearance.regions.head}
		/>
	{/if}

	<StageProjectNotices
		resumeOffer={resumeOffer !== null}
		recoveryOffer={projectSession.recoveryOffer}
		onDiscardRecovery={projectSession.dismissRecoveryOffer}
		onResume={() => void resumePendingSave()}
		onDiscard={dismissResumeOffer}
		{sourceFindings}
		{sourceProblems}
		previewProblem={shell.previewProblem as ExperienceProblem | null}
		onShowProblem={(problem) => experience.showProblem(problem)}
	/>

	<div
		class="editor-body"
		style={`--lower-column-height: ${shell.lowerColumnHeight}px; ${experience.lensState === 'experience' ? '--card-right: 10px; ' : ''}${experience.lensState === 'experience' && !experience.guideOpen ? '--card-bottom-clearance: 96px; ' : ''}--sheet-lane-right: ${shell.sheetLaneRight}px; --sheet-lane-left: ${shell.sheetLaneLeft}px`}
		data-index-open={preview === null && shell.indexOpen}
		data-library-open={shell.libraryOpen && preview === null}
	>
		{#if host.world}
			<WorldLeading
				previewing={preview !== null}
				lens={experience.lensState}
				ready={boot.status === 'ready' || boot.status === 'empty'}
				transfer={studioFeature.regions.transfer}
				scope={studioFeature.regions.scope}
				root={studioFeature.regions.root}
				canUndo={historyState.canUndo}
				onUndo={history.undo}
			/>
		{/if}

		<StageViewportRegion
			{...coreRegions.viewport}
			previewing={preview !== null}
			experienceMarks={host.experienceViewport.experienceMarks}
			viewEditTurn={host.experienceViewport.viewEditTurn}
			{...readings.regions.liftViewport}
			{...readings.regions.sliceViewport}
			{...lightInspection.regions.viewport}
			pendingViewWrite={host.experienceViewport.pendingViewWrite}
			onResolvePendingViewWrite={host.experienceViewport.onResolvePendingViewWrite}
			onCancelPendingViewWrite={host.experienceViewport.onCancelPendingViewWrite}
			welcome={host.experienceViewport.welcome}
			onDismissWelcome={host.experienceViewport.onDismissWelcome}
			{...artwork.regions.viewport}
			preview={viewportPreview}
			previewLoading={preview !== null && viewportPreview === null}
			homes={host.experienceHomes}
			onExperienceController={host.experienceViewport.onExperienceController}
			bind:stageElement={host.stageEl}
			bind:throughFrameElement={host.throughFrameEl}
		/>

		{#snippet toolbars()}
			<StageToolbars
				{...coreRegions.toolbars}
				previewing={preview !== null}
				{...appearance.regions.toolbars}
				viewLine={host.experienceToolbar.viewLine}
				experience={host.experienceToolbar.experience}
			/>
		{/snippet}

		<StagePanels
			{...coreRegions.panels}
			{toolbars}
			{...sky.regions.panels}
			previewing={preview !== null}
		/>

		{#if host.world}
			<WorldTrailing
				libraryView={library.view}
				importSheet={appearance.regions.importSheet}
				align={appearance.regions.align}
				materialEditor={appearance.regions.materialEditor}
				paint={appearance.regions.paint}
			/>
		{/if}

		<AppearanceSharedRegions previewing={preview === null} repair={appearance.regions.repair} />


	</div>

	<StageBootPanels {boot} repair={bootRepair} transferName={studioFeature.ports.transferName()} {runReplacement} returnToObject={studioFeature.ports.returnToObject} />
	<StageReplaceDialog {pendingReplacement} {runReplacement} cancelReplacement={projectSession.cancelReplacement} />

</div>
{/if}

<style>
	:global(body) {
		margin: 0;
	}
	.editor-host {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		background: var(--shell-forest);
		color: var(--shell-ivory);
	}
	.editor-body {
		position: relative;
		min-height: 0;
		flex: 1;
		overflow: hidden;
	}
	/* The Card takes its surface, type and radius from the shared roles; only its
	   lane beside the Height Sheet is the route's business. */
	.editor-host[data-shell='living-draft'] :global(.card) {
		top: 10px;
		right: 10px;
		box-shadow: var(--shell-shadow);
	}
	@media (width > 1100px) {
		.editor-body[data-index-open='true'] {
			--index-cover: var(--shell-index-width);
		}
	}
	/*
		Below 1100 px the Index floats over the Stage and reserves no lane, but the
		Library and its draft editor still keep clear of an open Index so it stays
		visible beside them (owner decision on #408). Under 860 px the Library is
		a full-width sheet and takes the Stage.
	*/
	@media (860px < width <= 1100px) {
		.editor-body[data-index-open='true'] {
			--library-index-cover: var(--shell-index-width);
		}
	}
	/*
		The Library and the draft editor keep clear of a shown Card: --card-cover is
		the span from the Stage's right edge to the Card's left edge, matching the
		Card's own placement.
	*/
	.editor-body:has(> :global(aside.card)) {
		--card-cover: calc(var(--shell-card-width) + var(--sheet-lane-right, 0px) + 18px);
	}
	.editor-host[data-shell='living-draft'] .editor-body:has(> :global(aside.card)) {
		--card-cover: calc(var(--shell-card-width) + 10px);
	}
	/*
		Where the Library is a full-width sheet it takes the Index's place while
		open. The Index keeps its open state, contents and scroll (visibility only),
		and comes back as it was when the Library closes. Above 860 px the Library
		keeps clear of the Index instead (--library-index-cover).
	*/
	@media (max-width: 860px) {
		.editor-body[data-library-open='true'] > :global(.plate-index),
		.editor-body[data-library-open='true'] > :global([data-index-scrim]) {
			visibility: hidden;
		}
	}
	@media (pointer: coarse) {
		.editor-host {
			--shell-touch-target: 44px;
			--shell-head-height: 52px;
		}
	}
</style>
