<script lang="ts">
	/**
	 * The Card's writer for a Scene object shown in the Experience lens (R217.S25, Round 2 density).
	 * Present this is the only subject-based creation (D1): a Presentation about the object from the
	 * 3D framing, with no Stop (D2). The controller refuses it in 2D and says why, so the button stays
	 * enabled and that refusal is shown. Open in World keeps the object selected and switches the
	 * lens. Already presented in lists the Presentations about it. There are no World editing fields.
	 */
	import type { Snippet } from 'svelte';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import ShellIcon from '$lib/authoring/stage/shell/ShellIcon.svelte';
	import ExperienceSnapshot from './ExperienceSnapshot.svelte';
	import { experienceHomes } from './experience-homes';

	let {
		secondary,
	}: {
		services?: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet;
		secondary?: Snippet<[Snippet?]>;
		more?: Snippet<[Snippet?]>;
	} = $props();

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const subject = $derived(homes.sceneSubject());
	const presented = $derived(
		subject === null || controller === null ? [] : controller.presentationsAbout(subject.entityId)
	);
	const presentReason = $derived(controller?.busy ? 'Wait for the current change' : '');

	async function presentThis(): Promise<void> {
		if (controller === null || subject === null || presentReason !== '') return;
		// E9: the Stage visibly frames the subject (or arms placement in Plan) before
		// anything is captured; the route owns that Camera request.
		await homes.presentThis(subject.entityId, subject.label);
	}
	function plural(count: number, word: string): string {
		return `${count} ${word}${count === 1 ? '' : 's'}`;
	}
</script>

{#if controller !== null && subject !== null}
	<div class="writer" data-experience-writer="subject">
		<div class="c-actions">
			<button
				type="button"
				class="btn primary wide"
				disabled={presentReason !== ''}
				title={presentReason || 'Make a Presentation about this object from the current framing'}
				aria-describedby={presentReason !== '' ? 'present-this-reason' : undefined}
				onclick={() => void presentThis()}
			>
				<ShellIcon name="camera" size={14} />Present this
			</button>
			{#if presentReason !== ''}<span id="present-this-reason" class="sr">{presentReason}</span>{/if}
		</div>

		<section class="sec">
			<p class="c-note">
				Creates a Presentation with a first View framed from the current camera. You can add more Views afterwards.
			</p>
			{#if controller.feedback}<p class="note" class:refused={controller.feedback.kind === 'refusal'} role="status">{controller.feedback.text}</p>{/if}
			<button type="button" class="quiet link" onclick={() => homes.openInWorld()}>Open in World</button>
		</section>

		<section class="sec" aria-label="Already presented in">
			<h3 class="sec-title">Already presented in</h3>
			{#if presented.length === 0}
				<p class="reach-note">Not presented yet</p>
			{:else}
				<ul class="rows">
					{#each presented as presentation (presentation.id)}
						<li>
							<button
								type="button"
								class="link-row"
								onclick={() => homes.select({ kind: 'presentation', presentationId: presentation.id })}
							>
								<span class="lr-thumb"><ExperienceSnapshot label={controller.presentationLabel(presentation.id)} /></span>
								<span class="lr-text">
									<span class="row-name">{controller.presentationLabel(presentation.id)}</span>
									<span class="row-meta">{plural(presentation.views.length, 'View')}</span>
								</span>
								<span class="lr-chev"><ShellIcon name="chevronRight" size={13} /></span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		{#if secondary}{@render secondary()}{/if}
	</div>
{/if}

<style>
	.writer {
		display: flex;
		flex-direction: column;
		font-size: var(--shell-text-control);
	}
	.sec {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 12px;
		border-top: 1px solid var(--shell-hairline);
	}
	.sec-title {
		margin: 0;
		color: var(--shell-ink-3);
		font: 600 var(--shell-text-label)/1.3 var(--shell-sans);
	}
	.c-actions {
		display: flex;
		padding: 8px 12px;
	}
	.c-note {
		margin: 0;
		color: var(--shell-ink-2);
		font-size: var(--shell-text-utility);
		line-height: 1.45;
	}
	.reach-note,
	.note {
		margin: 0;
		color: var(--shell-ink-2);
	}
	.note.refused {
		color: var(--shell-refuse);
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.link-row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 40px;
		padding: 3px 4px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--shell-ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.link-row:hover {
		background: var(--shell-hover);
	}
	.lr-thumb {
		flex: none;
		width: 48px;
	}
	.lr-text {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}
	.lr-chev {
		display: inline-flex;
		color: var(--shell-ink-3);
	}
	.row-name {
		min-width: 0;
		font: var(--shell-text-body)/1.3 var(--shell-sans);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row-meta {
		flex: none;
		color: var(--shell-ink-3);
		font-size: var(--shell-text-label);
	}

	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 24px;
		padding: 0 8px;
		border: 1px solid var(--shell-field-line);
		border-radius: 6px;
		background: var(--shell-surface-raised);
		color: var(--shell-ink);
		font: inherit;
		font-size: var(--shell-text-utility);
		cursor: pointer;
	}
	button:hover {
		background: var(--shell-hover);
	}
	button.link-row {
		justify-content: flex-start;
		border: 0;
		padding: 3px 4px;
		background: transparent;
	}
	button.btn {
		gap: 6px;
		min-height: 30px;
		font-weight: 600;
	}
	button.btn.wide {
		flex: 1;
	}
	button.btn.primary {
		border-color: var(--shell-action);
		background: var(--shell-action);
		color: var(--shell-on-action);
	}
	button.quiet {
		align-self: flex-start;
		border-color: transparent;
		background: transparent;
		color: var(--shell-ink-2);
		text-decoration: underline;
		text-decoration-color: var(--shell-hairline-strong);
		text-underline-offset: 2px;
	}
	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	@media (pointer: coarse) {
		button {
			min-height: 44px;
		}
	}
</style>
