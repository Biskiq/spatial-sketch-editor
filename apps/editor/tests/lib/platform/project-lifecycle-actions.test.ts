// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import ProjectLifecycleActions from '$lib/platform/ProjectLifecycleActions.svelte';
import type {
	PreparedProjectLifecycle,
	ProjectLifecycleActionResult,
	ProjectLifecyclePrepareResult
} from '$lib/platform/project-persistence';

const TOKEN = 'saved-base:00000000-0000-4000-8000-000000000001';
const NEXT_TOKEN = 'saved-base:00000000-0000-4000-8000-000000000002';

function prepared(overrides: Partial<PreparedProjectLifecycle> = {}): PreparedProjectLifecycle {
	return {
		projectId: 'project-1',
		name: 'Workshop',
		version: 3,
		precondition: { kind: 'expected-saved-base', token: TOKEN },
		...overrides
	};
}

function publication(activeVersion: number | null, publicationId: string | null = 'publication-1') {
	return {
		publicationId,
		activeVersion,
		revision: 4,
		currentVersion: 3,
		createdAt: '2026-10-20T00:00:00.000Z',
		updatedAt: '2026-10-21T00:00:00.000Z'
	};
}

const cleanups: Array<() => void> = [];

afterEach(() => {
	while (cleanups.length > 0) cleanups.pop()!();
	document.body.innerHTML = '';
});

async function settle(): Promise<void> {
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 0));
	await tick();
}

function mountActions(props: Partial<{
	onPrepareRename: () => Promise<ProjectLifecyclePrepareResult>;
	onRename: (value: PreparedProjectLifecycle, name: string) => Promise<ProjectLifecycleActionResult>;
	onPrepareDelete: () => Promise<ProjectLifecyclePrepareResult>;
	onDelete: (value: PreparedProjectLifecycle) => Promise<ProjectLifecycleActionResult>;
	onComplete: (result: Extract<ProjectLifecycleActionResult, { kind: 'renamed' | 'deleted' | 'unchanged' }>) => void | Promise<void>;
	onRefreshRemote: () => void | boolean | Promise<void | boolean>;
}> = {}) {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(ProjectLifecycleActions, {
		target,
		props: {
			projectId: 'project-1',
			projectName: 'Workshop',
			variant: 'hub',
			onPrepareRename: async () => ({ kind: 'ready', prepared: prepared() }),
			onRename: async () => ({ kind: 'renamed', name: 'New name', version: 4 }),
			onPrepareDelete: async () => ({ kind: 'ready', prepared: prepared({ publication: publication(null) }) }),
			onDelete: async () => ({ kind: 'deleted', cleanup: 'complete' }),
				onRefreshRemote: null,
			...props
		}
	});
	cleanups.push(() => unmount(component));
	return target;
}

describe('ProjectLifecycleActions', () => {
	it('pre-reads metadata, blocks active-publication deletion, and keeps the action out of a doomed dialog', async () => {
		const prepareDelete = vi.fn(async () => ({
			kind: 'ready' as const,
			prepared: prepared({ publication: publication(3) })
		}));
		const onDelete = vi.fn(async () => ({ kind: 'deleted' as const, cleanup: 'complete' as const }));
		const target = mountActions({ onPrepareDelete: prepareDelete, onDelete });

		(target.querySelector('button.delete-button') as HTMLButtonElement).click();
		await settle();

		expect(prepareDelete).toHaveBeenCalledOnce();
		expect(target.querySelector('dialog')?.hasAttribute('open')).toBe(false);
		expect(target.textContent).toContain('Unpublish this project before deleting it.');
		expect(onDelete).not.toHaveBeenCalled();
	});

	it('normalizes a rename, focuses the dialog, then returns focus after success', async () => {
		const onRename = vi.fn(async (_value: PreparedProjectLifecycle, name: string) => ({
			kind: 'renamed' as const,
			name,
			version: 4
		}));
		const complete = vi.fn();
		const target = mountActions({ onRename, onComplete: complete });
		const opener = target.querySelector('button:not(.delete-button)') as HTMLButtonElement;
		opener.focus();
		opener.click();
		await settle();

		const dialog = target.querySelector('dialog')!;
		const input = dialog.querySelector('input')!;
		expect(dialog.hasAttribute('open')).toBe(true);
		expect(document.activeElement).toBe(input);
		input.value = ' e\u0301 ';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		(dialog.querySelector('button[type="submit"]') as HTMLButtonElement).click();
		await settle();

		expect(onRename).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1' }), 'é');
		expect(complete).toHaveBeenCalledWith({ kind: 'renamed', name: 'é', version: 4 });
		expect(dialog.hasAttribute('open')).toBe(false);
		expect(document.activeElement).toBe(opener);
	});

	it('shows the inactive public-link warning and retries deletion with the same precondition', async () => {
		const calls: PreparedProjectLifecycle[] = [];
		const onDelete = vi.fn(async (value: PreparedProjectLifecycle) => {
			calls.push(value);
			return calls.length === 1
				? { kind: 'error' as const, message: 'Project writes are still active.', retryable: true }
				: { kind: 'deleted' as const, cleanup: 'pending' as const };
		});
		const complete = vi.fn();
		const target = mountActions({ onDelete, onComplete: complete });
		(target.querySelector('button.delete-button') as HTMLButtonElement).click();
		await settle();

		const dialog = target.querySelector('dialog')!;
		expect(dialog.textContent).toContain('inactive public link');
		expect(dialog.textContent).toContain('Delete Workshop');
		(dialog.querySelector('[data-primary-action]') as HTMLButtonElement).click();
		await settle();
		expect((dialog.querySelector('[data-primary-action]') as HTMLButtonElement).textContent).toContain('Retry delete Workshop');
		(dialog.querySelector('[data-primary-action]') as HTMLButtonElement).click();
		await settle();

		expect(calls).toHaveLength(2);
		expect(calls[0]!.precondition).toEqual(calls[1]!.precondition);
		expect(calls[0]!.precondition.token).toBe(TOKEN);
		expect(complete).toHaveBeenCalledWith({ kind: 'deleted', cleanup: 'pending' });
		expect(target.textContent).toContain('byte cleanup is pending');
	});

	it('requires an explicit refresh and retry after a remote name conflict', async () => {
		const onRename = vi.fn()
			.mockResolvedValueOnce({
				kind: 'conflict' as const,
				message: 'The Cloud saved base changed.',
				remoteName: 'Remote name',
				retryPrepared: prepared({
					name: 'Remote name',
					precondition: { kind: 'expected-saved-base', token: NEXT_TOKEN },
					requiresExplicitRefresh: true
				})
			})
			.mockResolvedValueOnce({ kind: 'renamed' as const, name: 'My requested name', version: 5 });
		const target = mountActions({ onRename });
		(target.querySelector('button:not(.delete-button)') as HTMLButtonElement).click();
		await settle();
		const dialog = target.querySelector('dialog')!;
		const input = dialog.querySelector('input')!;
		input.value = 'My requested name';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		(dialog.querySelector('button[type="submit"]') as HTMLButtonElement).click();
		await settle();

		expect(dialog.textContent).toContain('Remote name');
		const retry = [...dialog.querySelectorAll('button')].find((button) => button.textContent?.includes('Refresh and retry rename'));
		expect(retry).toBeDefined();
		(retry as HTMLButtonElement).click();
		await settle();
		expect(onRename).toHaveBeenCalledTimes(2);
		expect(onRename.mock.calls[1]![0].precondition.token).toBe(NEXT_TOKEN);
	});

	it('keeps the dialog open when guarded remote reload is canceled', async () => {
		const onRename = vi.fn(async () => ({
			kind: 'conflict' as const,
			message: 'Cloud changed while this dialog was open.',
			remoteName: 'Remote name',
			retryPrepared: null
		}));
		const target = mountActions({ onRename, onRefreshRemote: async () => false });
		(target.querySelector('button:not(.delete-button)') as HTMLButtonElement).click();
		await settle();
		const dialog = target.querySelector('dialog')!;
		const input = dialog.querySelector('input')!;
		input.value = 'A changed name';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		(dialog.querySelector('button[type="submit"]') as HTMLButtonElement).click();
		await settle();
		const reload = [...dialog.querySelectorAll('button')].find((button) => button.textContent?.includes('Reload remote'));
		expect(reload).toBeDefined();
		(reload as HTMLButtonElement).click();
		await settle();

		expect(dialog.hasAttribute('open')).toBe(true);
		expect(dialog.textContent).toContain('Your local work is unchanged.');
		expect(dialog.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(false);
	});
});
