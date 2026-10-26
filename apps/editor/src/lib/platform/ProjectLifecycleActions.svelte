<script lang="ts">
	import { tick } from 'svelte';
	import {
		PROJECT_NAME_MAX_LENGTH,
		type PreparedProjectLifecycle,
		type ProjectLifecycleActionResult,
		type ProjectLifecyclePrepareResult
	} from '$lib/platform/project-persistence';

	let {
		projectId,
		projectName,
		variant = 'hub',
		disabledReason = null,
		onPrepareRename,
		onRename,
		onPrepareDelete,
		onDelete,
		onComplete = () => {},
		onBusyChange = () => {},
		onRefreshRemote = null
	}: {
		projectId: string;
		projectName: string;
		variant?: 'hub' | 'head';
		disabledReason?: string | null;
		onPrepareRename: () => Promise<ProjectLifecyclePrepareResult>;
		onRename: (prepared: PreparedProjectLifecycle, name: string) => Promise<ProjectLifecycleActionResult>;
		onPrepareDelete: () => Promise<ProjectLifecyclePrepareResult>;
		onDelete: (prepared: PreparedProjectLifecycle) => Promise<ProjectLifecycleActionResult>;
		onComplete?: (result: Extract<ProjectLifecycleActionResult, { kind: 'renamed' | 'deleted' | 'unchanged' }>) => void | Promise<void>;
		onBusyChange?: (busy: boolean) => void;
		onRefreshRemote?: (() => void | boolean | Promise<void | boolean>) | null;
	} = $props();

	type Action = 'rename' | 'delete';
	let dialog = $state<HTMLDialogElement | null>(null);
	let nameInput = $state<HTMLInputElement | null>(null);
	let opener: HTMLElement | null = null;
	let action = $state<Action | null>(null);
	let prepared = $state<PreparedProjectLifecycle | null>(null);
	let renameValue = $state('');
	let busy = $state(false);
	let message = $state('');
	let remoteName = $state<string | null>(null);
	let retryPrepared = $state<PreparedProjectLifecycle | null>(null);
	let retryAllowed = $state(false);
	let notice = $state('');

	const dialogId = $derived(`project-lifecycle-${encodeURIComponent(projectId).replaceAll('%', '_')}`);
	const actionDisabled = $derived(disabledReason !== null || busy);
	const deleteWarning = $derived.by(() => {
		if (prepared === null || action !== 'delete') return null;
		if (prepared.publication?.publicationId != null && prepared.publication.activeVersion === null) {
			return 'This project has an inactive public link. Deleting it retires that link.';
		}
		return null;
	});

	function setBusy(next: boolean): void {
		busy = next;
		onBusyChange(next);
	}

	async function openAction(next: Action, event: MouseEvent): Promise<void> {
		if (actionDisabled) return;
		opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
		message = '';
		remoteName = null;
		retryPrepared = null;
		retryAllowed = false;
		notice = '';
		setBusy(true);
		let result: ProjectLifecyclePrepareResult;
		try {
			result = next === 'rename' ? await onPrepareRename() : await onPrepareDelete();
		} catch (error) {
			result = { kind: 'error', message: error instanceof Error ? error.message : 'Project details could not be loaded.' };
		}
		setBusy(false);
		if (result.kind === 'stale') {
			message = '';
			return;
		}
		if (result.kind !== 'ready') {
			message = result.message;
			return;
		}
		if (next === 'delete' && result.prepared.publication && result.prepared.publication.activeVersion !== null) {
			message = 'Unpublish this project before deleting it.';
			return;
		}
		prepared = result.prepared;
		action = next;
		if (next === 'rename') renameValue = result.prepared.name;
		await tick();
		if (dialog === null) return;
		if (typeof dialog.showModal === 'function') dialog.showModal();
		else dialog.setAttribute('open', '');
		if (next === 'rename') {
			nameInput?.focus();
			nameInput?.select();
		} else {
			dialog.querySelector<HTMLButtonElement>('[data-primary-action]')?.focus();
		}
	}

	function closeDialog(): void {
		if (dialog?.open && typeof dialog.close === 'function') dialog.close();
		else dialog?.removeAttribute('open');
		action = null;
		prepared = null;
		message = '';
		remoteName = null;
		retryPrepared = null;
		retryAllowed = false;
		void tick().then(() => {
			if (opener?.isConnected) opener.focus();
			opener = null;
		});
	}

	function onCancel(event: Event): void {
		event.preventDefault();
		if (!busy) closeDialog();
	}

	async function finish(result: ProjectLifecycleActionResult, requestedAction: Action): Promise<void> {
		if (result.kind === 'stale') {
			closeDialog();
			return;
		}
		if (result.kind === 'renamed' || result.kind === 'deleted' || result.kind === 'unchanged') {
			notice = result.kind === 'renamed'
				? `Renamed to ${result.name}.`
				: result.kind === 'deleted'
					? result.cleanup === 'pending'
						? 'Project access ended; byte cleanup is pending.'
						: 'Project deleted.'
					: 'Project name unchanged.';
				closeDialog();
				await onComplete(result);
			return;
		}
		if (result.kind === 'conflict') {
			remoteName = result.remoteName;
			message = result.message;
			retryPrepared = result.retryPrepared;
			if (requestedAction === 'delete' && result.retryPrepared !== null) {
				prepared = result.retryPrepared;
				message = `${result.message} Review the updated project name and confirm again.`;
			}
			return;
		}
		message = result.message;
		retryAllowed = result.retryable === true;
	}

	async function run(requestedAction: Action, useRefreshedName = false): Promise<void> {
		const current = prepared;
		if (busy || current === null) return;
		if (useRefreshedName && retryPrepared !== null) prepared = retryPrepared;
		const operation = prepared ?? current;
		message = '';
		retryAllowed = false;
		setBusy(true);
		let result: ProjectLifecycleActionResult;
		try {
			if (requestedAction === 'rename') {
				const normalized = renameValue.normalize('NFC').trim();
				const length = [...normalized].length;
				if (length < 1 || length > PROJECT_NAME_MAX_LENGTH) {
					setBusy(false);
					message = `Enter a project name from 1 to ${PROJECT_NAME_MAX_LENGTH} characters.`;
					return;
				}
				if (normalized === operation.name && !operation.requiresExplicitRefresh) {
					result = { kind: 'unchanged' };
				} else {
					result = await onRename(operation, normalized);
				}
			} else {
				result = await onDelete(operation);
			}
		} catch (error) {
			result = { kind: 'error', message: error instanceof Error ? error.message : 'The project action failed.', retryable: true };
		}
		setBusy(false);
		await finish(result, requestedAction);
	}

	async function refreshAndRetryRename(): Promise<void> {
		if (retryPrepared === null || action !== 'rename') return;
		prepared = retryPrepared;
		retryPrepared = null;
		await run('rename');
	}

	async function refreshRemote(): Promise<void> {
		if (busy || onRefreshRemote === null) return;
		setBusy(true);
		try {
			const refreshed = await onRefreshRemote();
			if (refreshed === false) {
				message = 'Remote project was not loaded. Your local work is unchanged.';
			} else {
				closeDialog();
			}
		} catch (error) {
			message = error instanceof Error ? error.message : 'The remote project could not be loaded.';
		}
		setBusy(false);
	}

	function heading(): string {
		return action === 'rename' ? 'Rename project' : `Delete ${prepared?.name ?? projectName}?`;
	}
</script>

<div class="lifecycle" class:head={variant === 'head'} class:hub={variant === 'hub'}>
	<div class="buttons" aria-label="Project actions">
		<button type="button" aria-label={`Rename ${projectName}`} disabled={actionDisabled} title={disabledReason ?? 'Rename this project'} onclick={(event) => void openAction('rename', event)}>Rename</button>
		<button type="button" class="delete-button" aria-label={`Delete ${projectName}`} disabled={actionDisabled} title={disabledReason ?? 'Delete this project'} onclick={(event) => void openAction('delete', event)}>Delete</button>
	</div>
	{#if disabledReason}
		<span class="reason">{disabledReason}</span>
	{/if}
	{#if message && action === null}
		<p class="inline-message" role="status">{message}</p>
	{/if}
	{#if notice}
		<p class="inline-message" role="status">{notice}</p>
	{/if}

	<dialog bind:this={dialog} aria-modal="true" aria-labelledby={`${dialogId}-title`} oncancel={onCancel}>
		{#if action === 'rename' && prepared !== null}
			<form onsubmit={(event) => { event.preventDefault(); void run('rename'); }}>
				<h2 id={`${dialogId}-title`}>Rename project</h2>
				<p>Renaming creates a new Cloud version. Unsaved domain edits and history stay in this session.</p>
				<label for={`${dialogId}-name`}>Project name</label>
				<input id={`${dialogId}-name`} bind:this={nameInput} bind:value={renameValue} maxlength={PROJECT_NAME_MAX_LENGTH * 2} autocomplete="off" />
				{#if remoteName !== null}
					<p class="warning" role="status">Cloud now names this project <strong>{remoteName}</strong>. Your local work is preserved.</p>
				{/if}
				{#if message}<p class="error-message" role="alert">{message}</p>{/if}
				<div class="dialog-actions">
					<button type="button" disabled={busy} onclick={closeDialog}>Cancel</button>
					{#if onRefreshRemote !== null && retryPrepared === null && remoteName !== null}
						<button type="button" disabled={busy} onclick={() => void refreshRemote()}>Reload remote</button>
					{/if}
					{#if retryPrepared !== null}
						<button type="button" disabled={busy} onclick={() => void refreshAndRetryRename()}>Refresh and retry rename</button>
					{:else}
						<button type="submit" data-primary-action disabled={busy}>{retryAllowed ? 'Retry rename' : 'Rename project'}</button>
					{/if}
				</div>
			</form>
		{:else if action === 'delete' && prepared !== null}
			<form onsubmit={(event) => { event.preventDefault(); void run('delete'); }}>
				<h2 id={`${dialogId}-title`}>{heading()}</h2>
				<p>This permanently removes the Cloud project and its saved versions. This action cannot be undone.</p>
				{#if deleteWarning}<p class="warning">{deleteWarning}</p>{/if}
				{#if remoteName !== null}<p class="warning" role="status">Cloud now names this project <strong>{remoteName}</strong>. Review the name before confirming.</p>{/if}
				{#if message}<p class="error-message" role="alert">{message}</p>{/if}
				<div class="dialog-actions">
					<button type="button" disabled={busy} onclick={closeDialog}>Cancel</button>
					<button type="submit" class="delete-button" data-primary-action disabled={busy}>{retryAllowed ? `Retry delete ${prepared.name}` : `Delete ${prepared.name}`}</button>
				</div>
			</form>
		{/if}
	</dialog>
</div>

<style>
	.lifecycle {
		--lifecycle-ink: #f4f0e9;
		--lifecycle-muted: #bcb5c4;
		--lifecycle-edge: #635a6f;
		--lifecycle-focus: #c9a9ff;
		--lifecycle-surface: #19181f;
		--lifecycle-control: #292632;
		color: var(--lifecycle-ink);
		font: inherit;
	}
	.lifecycle.head {
		--lifecycle-ink: #f3f4ee;
		--lifecycle-muted: #aebbb0;
		--lifecycle-edge: #2f4a3d;
		--lifecycle-focus: #d4ad45;
		--lifecycle-surface: #11291f;
		--lifecycle-control: #1c3a2c;
	}
	.buttons, .dialog-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
	.buttons button, .dialog-actions button {
		min-height: 2rem;
		padding: 0.25rem 0.65rem;
		border: 1px solid var(--lifecycle-edge);
		border-radius: 0.35rem;
		background: var(--lifecycle-control);
		color: var(--lifecycle-ink);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}
	.buttons button:hover:not(:disabled), .dialog-actions button:hover:not(:disabled) { border-color: var(--lifecycle-focus); }
	.buttons button:focus-visible, .dialog-actions button:focus-visible, input:focus-visible { outline: 2px solid var(--lifecycle-focus); outline-offset: 2px; }
	.buttons button:disabled, .dialog-actions button:disabled { cursor: default; opacity: 0.55; }
	.delete-button { border-color: #875d59 !important; color: #ffd9d2 !important; }
	.reason, .inline-message { color: var(--lifecycle-muted); font-size: 0.68rem; line-height: 1.35; }
	.inline-message { margin: 0.25rem 0 0; }
	dialog {
		width: min(28rem, calc(100vw - 2rem));
		box-sizing: border-box;
		max-height: min(90dvh, 40rem);
		padding: 1.2rem;
		border: 1px solid var(--lifecycle-edge);
		border-radius: 0.6rem;
		background: var(--lifecycle-surface);
		color: var(--lifecycle-ink);
		box-shadow: 0 18px 60px #0009;
	}
	dialog::backdrop { background: #08080db8; }
	dialog form { display: grid; gap: 0.8rem; }
	dialog h2 { margin: 0; font-size: 1.15rem; }
	dialog p { margin: 0; color: var(--lifecycle-muted); line-height: 1.45; }
	dialog label { font-weight: 650; }
	dialog input { min-height: 2.5rem; padding: 0.4rem 0.55rem; border: 1px solid var(--lifecycle-edge); border-radius: 0.35rem; background: #0e1512; color: var(--lifecycle-ink); font: inherit; }
	.dialog-actions { justify-content: flex-end; margin-top: 0.25rem; }
	.warning { padding: 0.65rem; border-left: 3px solid #d4ad45; background: #443b2180; color: #fff0ba !important; }
	.error-message { color: #ffd0c8 !important; }
	@media (pointer: coarse) {
		.buttons button, .dialog-actions button { min-width: 44px; min-height: 44px; }
	}
	@media (max-width: 38rem) {
		.buttons { gap: 0.3rem; }
		.dialog-actions { justify-content: stretch; }
		.dialog-actions button { flex: 1 1 auto; }
	}
</style>
