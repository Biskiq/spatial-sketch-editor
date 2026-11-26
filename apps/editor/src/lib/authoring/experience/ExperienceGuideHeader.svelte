<script lang="ts">
	import { tick } from 'svelte';
	import ShellIcon from '../stage/shell/ShellIcon.svelte';
	import { experienceHomes } from './experience-homes';
	import type { ExperiencePlayback } from './playback.svelte';

	let {
		playback,
		onClose,
		compact = $bindable(),
		addReason,
		addReasonId,
		followReasonId,
		playReasonId
	}: {
		playback: ExperiencePlayback;
		onClose: () => void;
		compact: boolean;
		addReason: string | null;
		addReasonId: string;
		followReasonId: string;
		playReasonId: string;
	} = $props();

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const guide = $derived(controller?.currentGuide ?? null);
	const stops = $derived(controller?.guideStops ?? []);
	const hasGuide = $derived((controller?.guides.length ?? 0) > 0);
	const pacing = $derived((guide ?? controller?.contextGuide)?.pacing ?? 'automatic');
	const presentations = $derived(controller?.current?.presentations ?? []);
	const canPlay = $derived(playback.map !== null || (controller?.playbackSource ?? null) !== null);

	let renaming = $state(false);
	let renameValue = $state('');
	let renameInput = $state<HTMLInputElement | null>(null);
	let nameButton = $state<HTMLButtonElement | null>(null);
	let guideMenuOpen = $state(false);
	let guideMenuWrap = $state<HTMLElement | null>(null);
	let guideMenuButton = $state<HTMLButtonElement | null>(null);
	let pacingOpen = $state(false);
	let pacingWrap = $state<HTMLElement | null>(null);
	let pacingButton = $state<HTMLButtonElement | null>(null);
	let menuOpen = $state(false);
	let menuWrap = $state<HTMLElement | null>(null);
	let addButton = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		if (!menuOpen && !guideMenuOpen && !pacingOpen) return;
		const onPointerDown = (event: PointerEvent): void => {
			if (menuOpen && menuWrap !== null && !menuWrap.contains(event.target as Node)) closeMenu();
			if (guideMenuOpen && guideMenuWrap !== null && !guideMenuWrap.contains(event.target as Node)) guideMenuOpen = false;
			if (pacingOpen && pacingWrap !== null && !pacingWrap.contains(event.target as Node)) pacingOpen = false;
		};
		window.addEventListener('pointerdown', onPointerDown);
		return () => window.removeEventListener('pointerdown', onPointerDown);
	});

	function inGuide(presentationId: string): boolean {
		return stops.some((stop) => stop.presentationId === presentationId);
	}

	function playPause(): void {
		playback.playPause();
	}

	function restoreStandpoint(): void {
		playback.setFollow(false);
	}

	function toggleFollow(): void {
		if (playback.following) {
			restoreStandpoint();
			return;
		}
		if (!canPlay) return;
		if (playback.map === null) playback.playFromStart();
		if (playback.status === 'idle' || playback.status === 'ended') playback.playPause();
		if (playback.status === 'idle' || playback.status === 'ended' || playback.map === null) return;
		playback.setFollow(true);
	}

	async function startRename(): Promise<void> {
		if (guide === null) return;
		guideMenuOpen = false;
		renameValue = guide.label;
		renaming = true;
		await tick();
		renameInput?.focus();
		renameInput?.select();
	}

	async function commitRename(): Promise<void> {
		if (!renaming) return;
		renaming = false;
		if (guide === null || renameValue.trim() === '') {
			await tick();
			nameButton?.focus();
			return;
		}
		await controller?.renameGuide(guide.id, renameValue);
		await tick();
		nameButton?.focus();
	}

	function cancelRename(): void {
		renaming = false;
		renameValue = '';
		void tick().then(() => nameButton?.focus());
	}

	function onRenameKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			void commitRename();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			cancelRename();
		}
	}

	function toggleGuideMenu(): void {
		guideMenuOpen = !guideMenuOpen;
		if (!guideMenuOpen) return;
		void tick().then(() => guideMenuWrap?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
	}

	function closeGuideMenu(): void {
		guideMenuOpen = false;
		guideMenuButton?.focus();
	}

	async function removeCurrentGuide(): Promise<void> {
		if (guide === null) return;
		guideMenuOpen = false;
		await controller?.remove({ kind: 'guide', guideId: guide.id });
	}

	function onGuideMenuKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.stopPropagation();
			closeGuideMenu();
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const items = [...(guideMenuWrap?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
		const at = items.indexOf(document.activeElement as HTMLElement);
		items[event.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1)]?.focus();
	}

	async function choosePacing(next: 'automatic' | 'manual'): Promise<void> {
		if (guide === null) return;
		pacingOpen = false;
		await controller?.setGuidePacing(guide.id, next);
		pacingButton?.focus();
	}

	function onPacingKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.stopPropagation();
			pacingOpen = false;
			pacingButton?.focus();
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const items = [...(pacingWrap?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
		const at = items.indexOf(document.activeElement as HTMLElement);
		items[event.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1)]?.focus();
	}

	function openMenu(): void {
		if (addReason !== null) return;
		menuOpen = true;
		void tick().then(() => menuWrap?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
	}

	function closeMenu(): void {
		menuOpen = false;
	}

	function onMenuKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.stopPropagation();
			closeMenu();
			addButton?.focus();
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const items = [...(menuWrap?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
		const at = items.indexOf(document.activeElement as HTMLElement);
		const next = event.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
		items[next]?.focus();
	}

	async function chooseFromMenu(presentationId: string): Promise<void> {
		closeMenu();
		await controller?.addStop(presentationId, { entryViewId: null });
	}
</script>
		<header class="head">
			<span class="kicker">Guide</span>
			{#if hasGuide}
				{#if guide !== null}
					{#if renaming}
						<input
							class="name-input rename-input"
							type="text"
							aria-label="Guide name"
							bind:value={renameValue}
							bind:this={renameInput}
							onkeydown={onRenameKeydown}
							onblur={() => void commitRename()}
						/>
					{:else}
						<button
							type="button"
							class="guide-name"
							title="Rename this Guide"
							bind:this={nameButton}
							onclick={() => void startRename()}
						>
							{guide.label}
						</button>
					{/if}
				{:else}
					<span class="guide-name plain">Guide</span>
				{/if}
				<span class="count">{stops.length} {stops.length === 1 ? 'stop' : 'stops'}</span>
				{#if guide !== null}
					<span class="pacing-wrap" bind:this={pacingWrap}>
						<button
							type="button"
							class="pacing-label"
							data-pacing-label={pacing}
							bind:this={pacingButton}
							aria-haspopup="menu"
							aria-expanded={pacingOpen}
							title="Pacing"
							onclick={() => (pacingOpen = !pacingOpen)}
						>{pacing === 'manual' ? 'Manual · waits for Next' : 'Automatic'} ›</button
						>
						{#if pacingOpen}
							<div class="pacing-menu" role="menu" tabindex="-1" aria-label="Pacing" onkeydown={onPacingKeydown}>
								<button
									type="button"
									role="menuitemradio"
									aria-checked={pacing === 'automatic'}
									onclick={() => void choosePacing('automatic')}>Automatic</button
								>
								<button
									type="button"
									role="menuitemradio"
									aria-checked={pacing === 'manual'}
									onclick={() => void choosePacing('manual')}>Manual · waits for Next</button
								>
							</div>
						{/if}
					</span>
					<span class="guide-menu-wrap" bind:this={guideMenuWrap}>
						<button
							type="button"
							class="icon"
							bind:this={guideMenuButton}
							aria-label="Guide actions"
							aria-haspopup="menu"
							aria-expanded={guideMenuOpen}
							title="Guide actions"
							onclick={toggleGuideMenu}
						>⋯</button
						>
						{#if guideMenuOpen}
							<div class="menu guide-menu" role="menu" tabindex="-1" aria-label="Guide actions" onkeydown={onGuideMenuKeydown}>
								<button type="button" role="menuitem" class="menu-item danger" onclick={() => void removeCurrentGuide()}>Remove Guide</button>
							</div>
						{/if}
					</span>
				{/if}
			{/if}
			<span class="spacer"></span>
			{#if stops.length > 0}
				<span class="transport-cluster">
					<button
						type="button"
						class="play"
						disabled={!canPlay}
						aria-label={playback.status === 'playing' ? 'Pause' : 'Play'}
						title={canPlay ? (playback.status === 'playing' ? 'Pause (Space)' : 'Play (Space)') : 'There is no Guide to play'}
						aria-describedby={canPlay ? undefined : playReasonId}
						onclick={playPause}
					>
						{#if playback.status === 'playing'}
							<span class="pause-glyph" aria-hidden="true">❚❚</span>
						{:else}
							<ShellIcon name="play" size={13} />
						{/if}
					</button>
					<span class="total" data-playback-total>
						{playback.elapsedLabel} / {playback.totalLabel}{#if playback.map !== null && playback.map.waitCount > 0}<span class="waits">{playback.map.waitCount === 1 ? '+ 1 wait' : `+ ${playback.map.waitCount} waits`}</span>{/if}
					</span>
				</span>
			{/if}
			<button
				type="button"
				class="tool"
				class:on={playback.following}
				disabled={!canPlay}
				title={playback.following ? 'Stop following the camera' : 'Follow the camera'}
				aria-pressed={playback.following}
				aria-describedby={playback.following ? followReasonId : undefined}
				onclick={toggleFollow}
			>
				<ShellIcon name="camera" size={13} />
				<span class="word">Follow</span>
			</button>
			<span class="menu-wrap" bind:this={menuWrap}>
				<button
					type="button"
					class="tool"
					bind:this={addButton}
					disabled={addReason !== null}
					title={addReason ?? 'Add a Presentation as a Stop'}
					aria-describedby={addReason !== null ? addReasonId : undefined}
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					onclick={() => (menuOpen ? closeMenu() : openMenu())}
				>
					<ShellIcon name="plus" size={13} />
					<span class="word">Stop</span>
				</button>
				{#if menuOpen}
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<div class="menu" role="menu" aria-label="Add a Presentation as a Stop" tabindex="-1" onkeydown={onMenuKeydown}>
						{#each presentations as presentation (presentation.id)}
							<button type="button" role="menuitem" class="menu-item" onclick={() => void chooseFromMenu(presentation.id)}>
								<span class="menu-label">{controller?.presentationLabel(presentation.id) ?? ''}</span>
								{#if inGuide(presentation.id)}<span class="menu-hint">again</span>{/if}
							</button>
						{/each}
					</div>
				{/if}
			</span>
			{#if stops.length > 0}
				<button
					type="button"
					class="icon"
					class:flipped={compact}
					aria-expanded={!compact}
					aria-label={compact ? 'Show Stop cards' : 'Compact Guide'}
					title={compact ? 'Show Stop cards' : 'Compact: overview only'}
					onclick={() => (compact = !compact)}
				>
					<ShellIcon name="chevronDown" size={15} />
				</button>
			{/if}
			<button type="button" class="icon" aria-label="Close Guide" title="Close the Guide" onclick={onClose}>
				<ShellIcon name="close" size={15} />
			</button>
		</header>

<span id={followReasonId} class="visually-hidden">Following the camera · Stop following Esc</span>
<span id={playReasonId} class="visually-hidden">There is no Guide to play</span>
{#if addReason !== null}<span id={addReasonId} class="visually-hidden">{addReason}</span>{/if}

<style>
	.pacing-label {
		min-height: 24px;
		padding: 0 8px;
		border: 1px solid color-mix(in srgb, var(--shell-ink-light) 28%, transparent);
		border-radius: 999px;
		background: none;
		color: inherit;
		font: 500 var(--shell-text-label) var(--shell-sans);
		white-space: nowrap;
		cursor: pointer;
	}
	.pacing-label:hover {
		background: var(--shell-on-forest-wash);
	}
	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 6px 6px 12px;
		border-bottom: 1px solid var(--shell-line-on-forest);
	}
	.kicker {
		font: 600 var(--shell-text-meta) var(--shell-sans);
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--shell-ink-quiet);
	}
	.guide-name {
		min-width: 0;
		max-width: 22ch;
		padding: 0;
		border: 0;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--shell-ink-light);
		font: var(--shell-text-identity) var(--shell-sans);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
	}
	.guide-name.plain {
		cursor: default;
	}
	.guide-name:hover:not(.plain) {
		border-bottom-color: color-mix(in srgb, var(--shell-ink-light) 30%, transparent);
	}
	.count {
		color: var(--shell-ink-quiet);
		font-size: var(--shell-text-utility);
		white-space: nowrap;
	}
	.name-input {
		flex: 1;
		min-width: 8ch;
		max-width: 26ch;
		height: 26px;
		padding: 0 8px;
		border: 1px solid var(--shell-line-on-forest);
		border-radius: 7px;
		background: var(--shell-on-forest-wash);
		color: var(--shell-ink-light);
		font: var(--shell-text-identity) var(--shell-sans);
	}
	.name-input::placeholder {
		color: var(--shell-ink-quiet);
	}
	.spacer {
		flex: 1;
	}
	.tool {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 26px;
		padding: 0 9px;
		border: 0;
		border-radius: 7px;
		background: var(--shell-on-forest-wash);
		color: inherit;
		font: inherit;
		font-size: var(--shell-text-utility);
		white-space: nowrap;
		cursor: pointer;
	}
	.tool:hover:not(:disabled) {
		background: var(--shell-on-forest-wash-strong);
	}
	.tool[aria-expanded='true'] {
		background: rgb(79 143 108 / 0.45);
	}
	.icon {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		padding: 0;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--shell-ink-quiet);
		cursor: pointer;
	}
	.icon:hover {
		background: var(--shell-on-forest-wash);
	}
	.icon.flipped :global(svg) {
		transform: rotate(180deg);
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
		:global(.guide) button:focus-visible,
	:global(.guide) input:focus-visible {
		outline: 2px solid var(--shell-leaf-soft);
		outline-offset: 1px;
		box-shadow: none;
	}
		:global(.guide) ::selection {
		background: color-mix(in srgb, var(--shell-leaf-soft) 38%, transparent);
		color: inherit;
	}
	.menu-wrap {
		position: relative;
		display: inline-flex;
	}
	.menu {
		position: absolute;
		right: 0;
		bottom: calc(100% + 8px);
		z-index: 5;
		display: flex;
		flex-direction: column;
		min-width: 200px;
		max-width: 320px;
		max-height: min(16rem, 50vh);
		overflow-y: auto;
		padding: 4px;
		border: 1px solid var(--shell-line-on-forest);
		border-radius: 10px;
		background: var(--shell-popup-dark);
		box-shadow: 0 10px 28px rgb(0 0 0 / 0.32);
	}
	.menu-item {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 8px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.menu-item:hover,
	.menu-item:focus-visible {
		background: var(--shell-on-forest-wash);
	}
	.menu-label {
		font: var(--shell-text-body) var(--shell-sans);
	}
	.menu-hint {
		color: var(--shell-ink-quiet);
		font: italic var(--shell-text-label) var(--shell-sans);
	}
	.transport-cluster {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex: none;
	}
	.tool.on {
		background: color-mix(in srgb, var(--shell-leaf-soft) 38%, transparent);
		color: var(--shell-ink-light);
	}
	/* A travel is a solid link with a chevron. */
	/* The Stop number sits at the start of the Stop's first hold. */
	.total {
		flex: none;
		color: var(--shell-ink-light);
		font: 500 var(--shell-text-label)/1.2 var(--shell-mono);
		white-space: nowrap;
	}
	.total .waits {
		margin-left: 4px;
		color: var(--shell-leaf-soft);
	}
	.pause-glyph {
		font: 600 9px/1 var(--shell-sans);
		letter-spacing: 1px;
	}
	.play {
		display: grid;
		place-items: center;
		flex: none;
		width: 26px;
		height: 26px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: var(--shell-ivory);
		color: var(--shell-forest);
	}
	@media (max-width: 620px) {
		.tool .word,
		.kicker {
			display: none;
		}
	}
	@media (pointer: coarse) {
		.tool,
		.icon,
		.play,
		.name-input {
			min-height: 44px;
			min-height: var(--shell-touch-target);
		}
		.icon,
		.play {
			width: 44px;
			min-width: var(--shell-touch-target);
		}
		/* The coarse hit area is 44 px; the visual track stays 8 px. */
	}
	.pacing-wrap,
	.guide-menu-wrap {
		position: relative;
		display: inline-flex;
	}
	.pacing-menu,
	.guide-menu {
		position: absolute;
		right: 0;
		bottom: calc(100% + 8px);
		z-index: 6;
		display: flex;
		flex-direction: column;
		min-width: 190px;
		padding: 4px;
		border: 1px solid var(--shell-line-on-forest);
		border-radius: 10px;
		background: var(--shell-popup-dark);
		box-shadow: 0 10px 28px rgb(0 0 0 / 0.32);
	}
	.pacing-menu button {
		padding: 6px 8px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: var(--shell-text-utility);
		text-align: left;
		cursor: pointer;
	}
	.pacing-menu button:hover,
	.pacing-menu button:focus-visible {
		background: var(--shell-on-forest-wash);
	}
	.pacing-menu button[aria-checked='true'] {
		color: var(--shell-leaf-soft);
	}
	.menu-item.danger {
		color: color-mix(in srgb, var(--shell-caution) 45%, var(--shell-ink-light));
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
</style>
