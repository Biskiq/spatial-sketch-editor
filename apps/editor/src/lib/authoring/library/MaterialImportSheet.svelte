<script lang="ts">
	/**
	 * The Import sheet.
	 *
	 * Modal 940 px wide on desktop (radius 16), viewport − 24 px at narrow widths,
	 * bottom sheet on portrait iPad. Shows the set-recognition proposal summary, conflict
	 * choices, normal convention acknowledgement / detected ok box, physical size
	 * & name validation, target registration (with mixed-kind domain segment),
	 * collapsible file table, and two draft previews.
	 */
	import { onMount } from 'svelte';
	import type { MapRole } from '@portfolio/project-model/materials';
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import FinishInspectionView from './FinishInspectionView.svelte';
	import {
		validateImportName,
		validateImportSize,
		type MaterialImportSession
	} from './material-import.svelte';

	let {
		session
	}: {
		session: MaterialImportSession;
	} = $props();

	let closeButton = $state<HTMLButtonElement>();
	let filesExpanded = $state(false);

	onMount(() => closeButton?.focus());

	const blocking = $derived(session.blockingCount());
	const ready = $derived(session.isReady());
	const chosenTargets = $derived(session.selectedTargets());
	const rows = $derived(session.fileRows());
	const sizeCheck = $derived(validateImportSize(session.sizeText));
	const nameCheck = $derived(validateImportName(session.nameText));
	const hasLayout = $derived(session.targets.some((t) => t.kind === 'surface'));
	const hasScene = $derived(session.targets.some((t) => t.kind === 'entity'));
	const mixedKinds = $derived(hasLayout && hasScene);
	const hasNormal = $derived(
		(session.candidate?.roleChoices.some((c) => c.role === 'normal') ?? false) ||
			(session.candidate?.conflicts.some((c) => c.role === 'normal') ?? false)
	);

	const draftTileSource = $derived.by((): FinishTileSource | null => {
		const prep = session.prepared;
		if (prep === null) return null;
		return {
			kind: 'draft',
			subject: {
				kind: 'draft',
				draft: {
					name: session.nameText || 'Import',
					recipe: prep.recipe,
					recipeHash: prep.recipeHash,
					sources: prep.sources
				}
			}
		};
	});

	function fileLabel(key: string): string {
		return session.fileSession?.factsByKey().get(key)?.name ?? key;
	}

	function choiceLabel(role: MapRole, key: string): string {
		const name = fileLabel(key);
		const lower = name.toLowerCase();
		if (role === 'roughness' && (lower.includes('orm') || lower.includes('arm') || lower.includes('rma'))) {
			return 'ORM green channel';
		}
		if (role === 'roughness' && lower.includes('gloss')) {
			return 'Gloss, inverted';
		}
		return name;
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		session.cancel(true);
	}
</script>

<div
	class="imp-backdrop"
	role="presentation"
	data-material-import-sheet
	onkeydown={onKeydown}
>
	<div
		class="imp-modal"
		role="dialog"
		aria-modal="true"
		aria-labelledby="import-sheet-title"
		tabindex="-1"
	>
		<header class="sh-h">
			<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
				<path d="M9 3v9M5.5 8.5 9 12l3.5-3.5M3 14.5h12" />
			</svg>
			<div class="sh-title">
				<div class="k mono">IMPORT MATERIAL · DRAFT</div>
				<strong id="import-sheet-title">{session.totalCount} file{session.totalCount === 1 ? '' : 's'} dropped</strong>
			</div>
			<button
				type="button"
				class="cp-x"
				bind:this={closeButton}
				aria-label="Cancel import"
				title="Cancel (Esc)"
				data-import-close
				onclick={() => session.cancel(true)}
			>×</button>
		</header>

		<div class="sh-b">
			<div class="ctl">
				{#if session.phase === 'reading'}
					<div class="imp-sum" data-import-reading>
						<strong>{session.showSlowRead ? `Reading ${session.readCount} of ${session.totalCount}…` : 'Reading files…'}</strong>
						<p class="note-sm">Inspecting headers and digests locally. Press Escape to cancel with nothing written.</p>
					</div>
				{:else if session.candidate !== null}
					<div class="imp-sum" class:ok={blocking === 0} data-import-summary>
						<div>
							<strong>{session.totalCount} files · {session.nameText.trim() || 'Untitled'}</strong>
							{#if blocking > 0}
								<span class="caution"> · {blocking} thing{blocking === 1 ? '' : 's'} to check</span>
							{:else}
								<span> · ready{session.candidate.conflicts.length === 0 && session.normalDetected ? ' — the file names settled everything' : ''}</span>
							{/if}
						</div>
						<p class="note-sm">
							Read as one material from {rows.filter((r) => r.state !== 'skip').length} images.
							{#if rows.some((r) => r.state === 'skip')} Unused maps are kept aside for later.{/if}
						</p>
					</div>

					{#each session.candidate.conflicts as conflict (conflict.role)}
						{@const picked = session.conflictChoices[conflict.role]}
						{#if picked}
							<div class="okbox" data-import-conflict-ok={conflict.role}>
								<span>{conflict.role === 'roughness' ? 'Roughness' : conflict.role} from {choiceLabel(conflict.role, picked)}.</span>
								<button type="button" class="linkb" data-import-conflict-change={conflict.role} onclick={() => session.reopenConflict(conflict.role)}>Change</button>
							</div>
						{:else}
							<div class="refuse" role="alert" data-import-conflict={conflict.role}>
								<strong>Two files claim {conflict.role}.</strong> Choose one — nothing imports until you do.
								<div class="seg-row">
									<span class="mseg" role="group" aria-label={`Choose ${conflict.role} source`}>
										{#each conflict.files as fileKey (fileKey)}
											<button
												type="button"
												data-import-conflict-choice={fileKey}
												onclick={() => session.chooseConflict(conflict.role, fileKey)}
											>{choiceLabel(conflict.role, fileKey)}</button>
										{/each}
									</span>
								</div>
							</div>
						{/if}
					{/each}

					{#if hasNormal}
						{#if session.normalDetected}
							<div class="okbox" data-import-normal-ok>
								<span>{session.normalDetectedDetail ?? 'Normal direction: OpenGL (+Y).'}</span>
								<button type="button" class="linkb" data-import-normal-change onclick={() => session.reopenNormalChoice()}>Change</button>
							</div>
						{:else}
							<div class="field-blk" data-import-normal-prompt>
								<span class="flb">Normal map direction</span>
								<span class="mseg" role="group" aria-label="Normal map direction">
									<button
										type="button"
										aria-pressed={session.normalConvention === '+Y'}
										data-import-normal-gl
										onclick={() => session.setNormalConvention('+Y')}
									>+Y up · OpenGL (proposed)</button>
									<button
										type="button"
										aria-pressed={session.normalConvention === '-Y'}
										data-import-normal-dx
										onclick={() => session.setNormalConvention('-Y')}
									>−Y · DirectX</button>
								</span>
								<label class="chk">
									<input
										type="checkbox"
										checked={session.normalAck}
										data-import-normal-ack
										onchange={(event) => session.setNormalAck(event.currentTarget.checked)}
									/>
									I checked the test: bumps look raised, lit from above.
								</label>
							</div>
						{/if}
					{/if}

					<div class="g2">
						<div class="field-blk">
							<span class="flb mono">PHYSICAL SIZE</span>
							<div class="fldrow">
								<input
									class="fld mono"
									class:bad={!sizeCheck.ok}
									aria-label="Physical size of one image in metres"
									value={session.sizeText}
									data-import-size
									oninput={(event) => session.setSize(event.currentTarget.value)}
								/>
								<span class="unit">m per image</span>
							</div>
							{#if !sizeCheck.ok}<p class="err-line">{sizeCheck.message}</p>{/if}
						</div>

						<div class="field-blk">
							<span class="flb mono">NAME</span>
							<input
								class="fld"
								class:bad={!nameCheck.ok}
								maxlength="120"
								aria-label="Finish name"
								value={session.nameText}
								data-import-name
								oninput={(event) => session.setName(event.currentTarget.value)}
							/>
							{#if !nameCheck.ok}<p class="err-line">{nameCheck.message}</p>{/if}
						</div>
					</div>

					<div class="field-blk">
						<span class="flb">Register on</span>
						{#if mixedKinds}
							<div class="refuse">
								Layout surfaces and Scene objects register in separate steps. Pick one now; paint the rest from Materials afterwards — it stays one shared Finish.
							</div>
							<div class="seg-row">
								<span class="mseg" role="group" aria-label="Target domain">
									<button
										type="button"
										aria-pressed={session.targetKind === 'layout'}
										data-import-kind="layout"
										onclick={() => session.setTargetKind('layout')}
									>Layout surfaces · {session.targets.filter((t) => t.kind === 'surface').length}</button>
									<button
										type="button"
										aria-pressed={session.targetKind === 'scene'}
										data-import-kind="scene"
										onclick={() => session.setTargetKind('scene')}
									>Scene objects · {session.targets.filter((t) => t.kind === 'entity').length}</button>
								</span>
							</div>
						{:else if chosenTargets.length > 0}
							<p class="note">{chosenTargets.map((t) => t.label).join(', ')}</p>
						{:else}
							<p class="note">Nothing selected — it lands in This project; paint it from Materials.</p>
						{/if}
					</div>

					<details class="imp-files" bind:open={filesExpanded} data-import-files>
						<summary>Show files ({rows.length})</summary>
						<div class="tw">
							<table class="files">
								<thead>
									<tr>
										<th>File</th>
										<th>Reads as</th>
										<th></th>
									</tr>
								</thead>
								<tbody>
									{#each rows as row (row.key)}
										<tr>
											<td class="fn mono">{row.name}</td>
											<td>
												{row.readsAs}
												<div class="note-sm">{row.note}</div>
											</td>
											<td>
												<span class={`tag ${row.state}`}>{row.badge}</span>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</details>
				{/if}

				{#if session.errorMessage !== null}
					<div class="refuse" role="alert" data-import-error>{session.errorMessage}</div>
				{/if}
			</div>

			<div class="previews">
				<figure>
					<div class="pv-box">
						<FinishInspectionView
							source={draftTileSource}
							color="#999999"
							label={session.nameText || 'Draft material'}
							settings={{ geometry: 'plane', lighting: 'studio' }}
						/>
					</div>
					<figcaption class="mono">DRAFT · FLAT SAMPLE · STUDIO</figcaption>
				</figure>
				<figure>
					<div class="pv-box">
						<FinishInspectionView
							source={draftTileSource}
							color="#999999"
							label={`${session.nameText || 'Draft material'} normal test`}
							settings={{ geometry: 'sphere', lighting: 'grazing' }}
						/>
					</div>
					<figcaption class="mono">NORMAL TEST · LIGHT FROM ABOVE</figcaption>
				</figure>
			</div>
		</div>

		<footer class="sh-f">
			<span class="note" data-import-foot-status>
				{#if session.phase === 'writing'}
					Importing…
				{:else if ready}
					Ready. One undo removes the import and its assignments.
				{:else}
					Answer the {blocking === 1 ? 'question' : `${blocking} questions`} above to continue.
				{/if}
			</span>
			<button type="button" class="btn" data-import-cancel onclick={() => session.cancel(true)}>Cancel</button>
			<button
				type="button"
				class="btn pri"
				disabled={!ready || session.phase === 'writing'}
				data-import-accept
				onclick={() => void session.accept()}
			>
				{chosenTargets.length > 0 ? `Import & apply to ${chosenTargets.length}` : 'Import'}
			</button>
		</footer>
	</div>
</div>

<style>
	.imp-backdrop {
		position: fixed;
		inset: 0;
		z-index: 64;
		background: rgb(13 28 19 / 0.42);
		display: grid;
		place-items: center;
		padding: 12px;
	}
	.imp-modal {
		width: min(940px, calc(100vw - 24px));
		max-height: min(778px, calc(100vh - 24px));
		display: flex;
		flex-direction: column;
		background: var(--shell-card);
		color: var(--shell-ink);
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 16px;
		box-shadow: var(--shell-shadow);
		overflow: hidden;
	}
	.sh-h {
		flex: 0 0 auto;
		min-height: 59px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		background: var(--shell-ivory);
		border-bottom: 1px solid var(--shell-hairline);
	}
	.sh-title { display: grid; gap: 1px; }
	.k { font-size: 10px; letter-spacing: 0.08em; color: var(--shell-ink-2); text-transform: uppercase; }
	.mono { font-family: var(--shell-mono); }
	.cp-x {
		margin-left: auto;
		width: 30px;
		height: 30px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--shell-ink);
		font-size: 20px;
		cursor: pointer;
	}
	.cp-x:hover { background: var(--shell-hover); }
	.sh-b {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 260px;
		gap: 16px;
		padding: 14px 16px;
		overflow: auto;
	}
	.ctl { display: grid; gap: 12px; align-content: start; min-width: 0; }
	.imp-sum {
		padding: 10px 12px;
		border-radius: 9px;
		background: var(--shell-surface);
		font-size: 12.5px;
		display: grid;
		gap: 3px;
	}
	.imp-sum.ok { background: var(--shell-positive-bg); }
	.caution { color: var(--shell-caution); font-weight: 600; }
	.refuse {
		padding: 8px 10px;
		border-radius: 9px;
		background: var(--shell-refuse-bg);
		color: var(--shell-refuse);
		font-size: 12px;
	}
	.okbox {
		padding: 8px 10px;
		border-radius: 9px;
		background: var(--shell-positive-bg);
		color: var(--shell-positive);
		font-size: 12px;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.seg-row { margin-top: 6px; }
	.mseg {
		display: inline-flex;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 999px;
		overflow: hidden;
		background: var(--shell-field);
	}
	.mseg button {
		border: 0;
		border-right: 1px solid var(--shell-hairline);
		background: transparent;
		color: var(--shell-ink);
		font: inherit;
		font-size: 11.5px;
		padding: 4px 10px;
		cursor: pointer;
	}
	.mseg button:last-child { border-right: 0; }
	.mseg button[aria-pressed='true'] { background: var(--shell-action); color: var(--shell-on-action); }
	.field-blk { display: grid; gap: 5px; }
	.flb { font-size: 11px; color: var(--shell-ink-2); font-weight: 600; }
	.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
	.fldrow { display: flex; align-items: center; gap: 6px; }
	.fld {
		height: 28px;
		padding: 0 8px;
		border: 1px solid var(--shell-field-line-strong);
		border-radius: 7px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font-size: 12px;
		width: 100%;
	}
	.fld.bad { border-color: var(--shell-refuse); }
	.unit { font-size: 11.5px; color: var(--shell-ink-2); white-space: nowrap; }
	.chk { display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; }
	.err-line { margin: 0; font-size: 11px; color: var(--shell-refuse); }
	.note, .note-sm { margin: 0; font-size: 11.5px; color: var(--shell-ink-2); }
	.linkb { border: 0; padding: 0; background: transparent; color: inherit; text-decoration: underline; font: inherit; cursor: pointer; }
	.imp-files summary { font-size: 12px; font-weight: 500; cursor: pointer; }
	.tw { margin-top: 6px; overflow: auto; }
	.files { width: 100%; border-collapse: collapse; font-size: 11.5px; }
	.files th, .files td { padding: 5px 6px; border-bottom: 1px solid var(--shell-hairline); text-align: left; vertical-align: top; }
	.fn { font-size: 11px; overflow-wrap: anywhere; }
	.tag { display: inline-block; padding: 1px 6px; border-radius: 999px; font-size: 10.5px; font-weight: 600; }
	.tag.ok { background: var(--shell-positive-bg); color: var(--shell-positive); }
	.tag.ack { background: var(--shell-caution-bg); color: var(--shell-caution); }
	.tag.clash { background: var(--shell-refuse-bg); color: var(--shell-refuse); }
	.tag.skip { background: var(--shell-surface-sunken); color: var(--shell-ink-2); }
	.previews { display: grid; gap: 12px; align-content: start; }
	figure { margin: 0; display: grid; gap: 4px; }
	figcaption { font-size: 10px; color: var(--shell-ink-2); letter-spacing: 0.06em; }
	.pv-box { width: 100%; }
	.sh-f {
		flex: 0 0 auto;
		min-height: 51px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		background: var(--shell-ivory);
		border-top: 1px solid var(--shell-hairline);
	}
	.sh-f .note { margin-right: auto; }
	.btn {
		height: 30px;
		padding: 0 12px;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 8px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font: inherit;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}
	.btn.pri { background: var(--shell-action); border-color: var(--shell-action); color: var(--shell-on-action); }
	.btn:disabled { opacity: 0.5; cursor: not-allowed; }

	@media (max-width: 860px), (orientation: portrait) and (max-width: 900px) {
		.imp-backdrop { align-items: end; padding: 0; }
		.imp-modal {
			width: min(796px, 100vw);
			max-height: 68vh;
			border-radius: 16px 16px 0 0;
		}
		.sh-b { grid-template-columns: 1fr; }
		.sh-f { min-height: 61px; }
	}
	@media (pointer: coarse) {
		.btn, .mseg button, .cp-x { min-height: var(--shell-touch-target); }
	}
</style>
