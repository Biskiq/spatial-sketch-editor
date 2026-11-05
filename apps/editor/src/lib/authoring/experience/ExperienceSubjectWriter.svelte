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
								<span class="lr-thumb"><ExperienceSnapshot label={presentation.label} /></span>
								<span class="lr-text">
									<span class="row-name">{presentation.label}</span>
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
		font-size: 12px;
	}
	.sec {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 12px;
		border-top: 1px solid var(--shell-hairline, #e1e4de);
	}
	.sec-title {
		margin: 0;
		color: var(--shell-ink-3, #79817b);
		font: 600 11px/1.3 var(--shell-sans, system-ui);
	}
	.c-actions {
		display: flex;
		padding: 8px 12px;
	}
	.c-note {
		margin: 0;
		color: var(--shell-ink-2, #4a524c);
		font-size: 11.5px;
		line-height: 1.45;
	}
	.reach-note,
	.note {
		margin: 0;
		color: var(--shell-ink-2, #4a524c);
	}
	.note.refused {
		color: var(--shell-refuse, #7e2718);
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
		color: var(--shell-ink, #1b201c);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.link-row:hover {
		background: var(--shell-hover, #eef0ed);
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
		color: var(--shell-ink-3, #79817b);
	}
	.row-name {
		min-width: 0;
		font: 12.5px/1.3 var(--shell-serif, Georgia, serif);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row-meta {
		flex: none;
		color: var(--shell-ink-3, #79817b);
		font-size: 11px;
	}

	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 24px;
		padding: 0 8px;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 6px;
		background: var(--shell-card, #fff);
		color: var(--shell-ink, #1b201c);
		font: inherit;
		font-size: 11.5px;
		cursor: pointer;
	}
	button:hover {
		background: var(--shell-hover, #eef0ed);
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
		border-color: var(--shell-forest-raised, #22503c);
		background: var(--shell-forest-raised, #22503c);
		color: #fff;
	}
	button.quiet {
		align-self: flex-start;
		border-color: transparent;
		background: transparent;
		color: var(--shell-ink-2, #4a524c);
		text-decoration: underline;
		text-decoration-color: var(--shell-hairline-strong, #cdd2ca);
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
