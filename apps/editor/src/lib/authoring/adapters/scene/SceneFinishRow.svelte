<script lang="ts">
	/**
	 * The Scene object Card's Finish row (T2.S4a).
	 *
	 * One row, one live Finish reading. It shows the colour, the five Finish
	 * controls and the object palette; a shared Finish raises the Ask in this row
	 * rather than in a dialog. The colour input streams a render-only preview
	 * while the pointer is down and writes once on release, so a drag through the
	 * spectrum is one undo step, not a hundred.
	 */
	import { FINISH_SHEEN_STOPS, type FinishSheenStop } from '@portfolio/project-model/scene-planning';
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';

	let {
		services,
		entityId
	}: {
		services: StageAdapterServices;
		entityId: string | null;
	} = $props();

	let revision = $state(0);
	let expanded = $state(true);
	let moreOpen = $state(false);
	let paletteOpen = $state(false);
	let renaming = $state<string | null>(null);
	let renameDraft = $state('');

	$effect(() => {
		return services.stage.onAdaptersChanged(() => {
			revision += 1;
		});
	});

	const finishes = $derived(services.finishes?.current ?? null);
	const row = $derived.by(() => {
		void revision;
		return entityId === null || finishes === null ? null : finishes.viewFor(entityId);
	});
	const palette = $derived.by(() => {
		void revision;
		return finishes?.paletteView() ?? { slots: [], room: false };
	});
	const ask = $derived.by(() => {
		void revision;
		return finishes?.ask ?? null;
	});
	const sharedAsk = $derived(ask !== null && ask.entityId === entityId);
	const hex = $derived(row?.literalColor ?? row?.effectiveColor ?? '#000000');

	$effect(() => {
		finishes?.noteRow(entityId);
	});

	function preview(color: string): void {
		if (entityId === null || finishes === null) return;
		finishes.previewColor(entityId, color);
	}

	function commit(color: string): void {
		if (entityId === null || finishes === null) return;
		finishes.clearPreview();
		void finishes.setColor(entityId, color);
	}

	function commitHex(event: Event): void {
		const value = (event.currentTarget as HTMLInputElement).value.trim().toLowerCase();
		if (/^#[0-9a-f]{6}$/.test(value)) commit(value);
	}

	function chooseSheen(stop: FinishSheenStop): void {
		if (entityId === null || finishes === null) return;
		void finishes.setSheen(entityId, stop.id);
	}

	function setMetal(on: boolean): void {
		if (entityId === null || finishes === null) return;
		void finishes.setMetal(entityId, on);
	}

	function setRoughness(event: Event): void {
		if (entityId === null || finishes === null) return;
		void finishes.setRoughness(entityId, Number((event.currentTarget as HTMLInputElement).value));
	}

	function applySlot(slotId: string): void {
		if (entityId === null || finishes === null) return;
		finishes.clearPreview();
		void finishes.setColor(entityId, { slot: slotId });
	}

	function beginRename(slotId: string, name: string): void {
		renaming = slotId;
		renameDraft = name;
	}

	function commitRename(): void {
		const slotId = renaming;
		if (slotId === null || finishes === null) return;
		renaming = null;
		void finishes.renamePaletteSlot(slotId, renameDraft);
	}

	function saveColour(): void {
		if (entityId === null || finishes === null) return;
		void finishes.saveToPalette(entityId);
	}

	function armDropper(): void {
		if (entityId === null || finishes === null) return;
		finishes.armDropper(entityId);
	}

	function answer(choice: 'just-this' | 'all' | 'cancel'): void {
		void finishes?.resolveAsk(choice);
	}
</script>

{#if finishes !== null && row !== null}
	<div class="finish-row" data-scene-finish-row={row.key} data-finish-shared={row.users > 1 ? '' : undefined}>
		<button
			type="button"
			class="finish-head"
			aria-expanded={expanded}
			data-finish-disclosure
			onclick={() => (expanded = !expanded)}
		>
			<span class="chevron" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
			<span class="swatch" style={`--swatch: ${row.effectiveColor}`} aria-hidden="true"></span>
			<span class="finish-name">{row.label}</span>
			{#if row.users > 1}<span class="shared">Shared · {row.users}</span>{/if}
		</button>

		{#if expanded}
			{#if row.key === 'model-own'}
				<p class="model-own">
					Model's own material. Painting a Finish replaces it; choosing Model's own in Library ›
					Finishes restores it.
				</p>
			{:else}
				<div class="colour-row">
					<!-- The one live control: preview on input, write on change. -->
					<input
						type="color"
						class="colour"
						aria-label={`${row.entityName} Finish colour`}
						data-finish-colour
						value={hex}
						oninput={(event) => preview(event.currentTarget.value)}
						onchange={(event) => commit(event.currentTarget.value)}
					/>
					<input
						type="text"
						class="hex"
						inputmode="text"
						maxlength="7"
						aria-label="Finish colour hex"
						value={hex}
						onchange={commitHex}
					/>
					{#if row.hasColorImage}
						<span class="image-marker" title="A colour image Finish">Image</span>
					{/if}
					<div class="colour-actions">
						<button
							type="button"
							data-finish-original
							title={row.originalWritesWhite
								? 'Write white over the image Finish'
								: `Remove the colour override; ${row.baseLabel} shows`}
							onclick={() => entityId !== null && void finishes.setOriginal(entityId)}
						>
							Original
						</button>
						<button
							type="button"
							aria-expanded={paletteOpen}
							data-finish-palette
							onclick={() => (paletteOpen = !paletteOpen)}
						>
							Palette
						</button>
						<button
							type="button"
							title="Copy the Finish colour of another object"
							data-finish-dropper
							onclick={armDropper}
						>
							Pick
						</button>
					</div>
				</div>

				{#if paletteOpen}
					<div class="palette" data-finish-palette-popover aria-label="Project palette">
						{#if palette.slots.length === 0}
							<p class="empty">No project colours yet.</p>
						{:else}
							<ul>
								{#each palette.slots as slot (slot.id)}
									<li>
										<button
											type="button"
											class="slot-swatch"
											style={`--swatch: ${slot.color}`}
											aria-label={`Use ${slot.name}`}
											data-finish-slot={slot.id}
											onclick={() => applySlot(slot.id)}
										></button>
										{#if renaming === slot.id}
											<input
												type="text"
												maxlength="40"
												aria-label="Palette colour name"
												bind:value={renameDraft}
												onkeydown={(event) => {
													if (event.key === 'Enter') commitRename();
													if (event.key === 'Escape') renaming = null;
												}}
												onblur={commitRename}
											/>
										{:else}
											<button
												type="button"
												class="slot-name"
												title="Rename"
												onclick={() => beginRename(slot.id, slot.name)}
											>
												{slot.name}{#if slot.users > 0}<span class="followers">
														· {slot.users}</span
													>{/if}
											</button>
										{/if}
										<input
											type="color"
											class="slot-colour"
											aria-label={`${slot.name} colour`}
											value={slot.color}
											onchange={(event) =>
												void finishes.setPaletteSlotColor(slot.id, event.currentTarget.value)}
										/>
										<button
											type="button"
											class="slot-remove"
											aria-label={`Remove ${slot.name}`}
											onclick={() => void finishes.removePaletteSlot(slot.id)}
										>
											×
										</button>
									</li>
								{/each}
							</ul>
						{/if}
						<div class="palette-foot">
							<button
								type="button"
								disabled={!row.canSaveToPalette}
								title={row.paletteRoom
									? row.literalColor === null
										? 'Only an authored colour can be saved'
										: 'Save this colour to the project palette'
									: 'The palette already holds eight colours'}
								data-save-to-palette
								onclick={saveColour}
							>
								Save this colour
							</button>
							{#if row.followerSlot !== null}<span class="follower-note">Follows its palette colour</span>{/if}
						</div>
					</div>
				{/if}

				<div class="sheen" role="group" aria-label="Sheen">
					<span class="label">Sheen</span>
					{#each FINISH_SHEEN_STOPS as stop (stop.id)}
						<button
							type="button"
							class:active={row.sheenStop === stop.id}
							aria-pressed={row.sheenStop === stop.id}
							title={`${stop.label} sheen`}
							data-sheen={stop.id}
							onclick={() => chooseSheen(stop)}
						>
							{stop.label}
						</button>
					{/each}
					<span class="reading">{row.sheenCaption}</span>
				</div>

				<button
					type="button"
					class="more-toggle"
					aria-expanded={moreOpen}
					data-finish-more
					onclick={() => (moreOpen = !moreOpen)}
				>
					{moreOpen ? 'Less' : 'Roughness & Metal'}
				</button>
				{#if moreOpen}
					<div class="fine" data-finish-fine>
						<label>
							<span>Roughness</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.01"
								value={row.roughness}
								onchange={setRoughness}
								aria-label="Roughness"
							/>
							<output>{row.roughness.toFixed(2)}</output>
						</label>
						<label class="metal">
							<input
								type="checkbox"
								checked={row.metalOn}
								onchange={(event) => setMetal(event.currentTarget.checked)}
							/>
							<span>Metal</span>
							<span class="reading">{row.metalCaption}</span>
						</label>
					</div>
				{/if}

				{#if sharedAsk && ask !== null}
					<div class="ask" role="group" aria-label="Shared Finish">
						<p class="ask-title">
							This Finish is shared by {ask.reach} objects.
							{#if ask.kind === 'palette-add'}
								Save its colour to the palette
							{:else}
								Edit only this object, or all {ask.reach}?
							{/if}
						</p>
						<div class="ask-actions">
							<button type="button" class="primary" data-finish-ask="just-this" onclick={() => answer('just-this')}>
								Just this
							</button>
							<button type="button" data-finish-ask="all" onclick={() => answer('all')}>
								{ask.kind === 'palette-add' ? 'All N' : `All ${ask.reach}`}
							</button>
							<button type="button" data-finish-ask="cancel" onclick={() => answer('cancel')}>
								Cancel
							</button>
						</div>
						<label class="sticky">
							<input
								type="checkbox"
								checked={ask.applyToAllEdits}
								onchange={(event) => finishes.setApplyToAllEdits(event.currentTarget.checked)}
							/>
							<span>Apply to all edits while this is open</span>
						</label>
						<p class="hint">One Undo restores the whole edit.</p>
					</div>
				{/if}
			{/if}
		{/if}
	</div>
{/if}

<style>
	.finish-row {
		display: grid;
		gap: 0.4rem;
		padding: 0.35rem 0;
		border-top: 1px solid var(--shell-hairline);
	}
	.finish-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-height: var(--shell-control-height);
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		text-align: left;
	}
	.chevron {
		width: 0.8rem;
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
	}
	.swatch {
		width: 1.05rem;
		height: 1.05rem;
		border: 1px solid rgb(0 0 0 / 25%);
		border-radius: 0.2rem;
		background: var(--swatch);
	}
	.finish-name {
		font-weight: 600;
	}
	.shared {
		margin-left: auto;
		color: var(--shell-ink-quiet);
		font-family: var(--shell-mono);
		font-size: var(--shell-text-utility);
	}
	.colour-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
	.colour {
		width: 2rem;
		height: var(--shell-control-height);
		padding: 0;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.25rem;
		background: transparent;
	}
	.hex {
		width: 5.4rem;
		min-height: var(--shell-control-height);
		padding: 0 0.35rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
		font-family: var(--shell-mono);
		font-size: var(--shell-text-utility);
		text-transform: lowercase;
	}
	.image-marker {
		padding: 0 0.3rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.25rem;
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
	}
	.colour-actions {
		display: flex;
		gap: 0.25rem;
		margin-left: auto;
	}
	.colour-actions button,
	.more-toggle,
	.ask button,
	.palette-foot button {
		min-height: var(--shell-control-height);
		padding: 0 0.5rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
		font-size: var(--shell-text-utility);
	}
	.palette {
		display: grid;
		gap: 0.35rem;
		padding: 0.45rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.35rem;
		background: var(--shell-ink-light);
		box-shadow: 0 0.4rem 1rem rgb(6 20 14 / 12%);
	}
	.palette ul {
		display: grid;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.palette li {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.slot-swatch {
		width: 1.1rem;
		height: 1.1rem;
		padding: 0;
		border: 1px solid rgb(0 0 0 / 25%);
		border-radius: 0.2rem;
		background: var(--swatch);
	}
	.slot-name {
		flex: 1;
		min-height: var(--shell-control-height);
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		text-align: left;
		font-size: var(--shell-text-utility);
	}
	.followers {
		color: var(--shell-ink-quiet);
		font-family: var(--shell-mono);
	}
	.slot-colour {
		width: 1.6rem;
		height: var(--shell-control-height);
		padding: 0;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.2rem;
		background: transparent;
	}
	.slot-remove {
		width: var(--shell-control-height);
		min-height: var(--shell-control-height);
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--shell-ink-quiet);
	}
	.palette-foot {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.palette-foot button:disabled {
		opacity: 0.5;
	}
	.follower-note,
	.hint,
	.empty {
		margin: 0;
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
	}
	.sheen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
	}
	.sheen .label {
		width: 2.6rem;
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
	}
	.sheen button {
		min-height: var(--shell-control-height);
		padding: 0 0.4rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
		font-size: var(--shell-text-utility);
	}
	.sheen button.active {
		border-color: var(--stage-selection);
		background: var(--stage-selection);
		color: var(--shell-forest);
	}
	.reading {
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
	}
	.more-toggle {
		justify-self: start;
	}
	.fine {
		display: grid;
		gap: 0.35rem;
		padding: 0.35rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.3rem;
	}
	.fine label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: var(--shell-text-utility);
	}
	.fine input[type='range'] {
		flex: 1;
	}
	.fine output {
		width: 2.4rem;
		font-family: var(--shell-mono);
		text-align: right;
	}
	.ask {
		display: grid;
		gap: 0.35rem;
		padding: 0.45rem;
		border: 1px solid var(--stage-selection);
		border-radius: 0.35rem;
		background: color-mix(in srgb, var(--stage-selection) 8%, transparent);
	}
	.ask-title {
		margin: 0;
		font-size: var(--shell-text-utility);
	}
	.ask-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.ask button.primary {
		border-color: var(--stage-selection);
		background: var(--stage-selection);
		color: var(--shell-forest);
	}
	.sticky {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: var(--shell-text-utility);
	}
	.model-own {
		margin: 0;
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
	}
</style>
