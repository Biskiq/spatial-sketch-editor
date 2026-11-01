// @vitest-environment jsdom
/**
 * T1.P01.S04 — PLATE Head Save integration.
 *
 * The state machine itself is T3.P01.S02's and is covered by its own conformance
 * suite. This file pins the Head's obligations: a visible reason instead of a
 * dead control, an explicit unsaved-work signal, and a conflict reload that is
 * handed to the host rather than installed here. R217.S20 adds the mounted Head's
 * half: a refusal is announced accessibly, and a settled Save stays reachable from
 * the keyboard with its reason as its description.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import EditorHead from '$lib/authoring/stage/shell/EditorHead.svelte';
import type {
	ReloadOffer,
	SaveOutcome,
	SaveSnapshot,
	SaveState
} from '$lib/authoring/save/save-state';
import { createHeadSave } from '$lib/authoring/save/head-save';

function snapshot(overrides: Partial<SaveSnapshot> = {}): SaveSnapshot {
	return {
		status: 'dirty',
		dirty: true,
		busy: false,
		pending: false,
		savedBaseToken: 'token-1',
		savedRevision: null,
		savedCanonicalJson: null,
		savedSourceContentId: null,
		error: null,
		conflict: null,
		...overrides
	};
}

function stub(initial: SaveSnapshot, outcome: SaveOutcome = { kind: 'stale-epoch' }): {
	state: SaveState;
	reload: ReloadOffer;
} {
	let current = initial;
	const reload: ReloadOffer = {
		kind: 'reload',
		projectId: 'project-1',
		document: {},
		savedBaseToken: 'remote-token',
		savedRevision: null,
		savedSourceContentId: null
	};
	const listeners = new Set<(value: SaveSnapshot) => void>();
	const state: SaveState = {
		getSnapshot: () => current,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		refresh() {
			for (const listener of listeners) listener(current);
			return current;
		},
		adoptSavedBase() {
			return true;
		},
		async save() {
			return outcome;
		},
		async retry() {
			return outcome;
		},
		reloadRemote: () => reload,
		clearError() {
			current = snapshot({ status: 'dirty' });
			return current;
		}
	};
	return { state, reload };
}

describe('T1.P01.S04 — Head Save', () => {
	it('enables Save for dirty work and signals the unsaved-work fact explicitly', () => {
		const { state } = stub(snapshot());
		const head = createHeadSave(state);
		expect(head.control()).toMatchObject({
			label: 'Save changes',
			disabled: false,
			unavailable: false,
			reason: null
		});
		expect(head.unsavedWork().kind).toBe('confirm');
		expect(head.isDirty()).toBe(true);
	});

	it('keeps a settled Save disabled with its visible reason and no unsaved-work warning', () => {
		const { state } = stub(snapshot({ status: 'saved', dirty: false }));
		const head = createHeadSave(state);
		expect(head.control()).toMatchObject({ label: 'Saved', disabled: true });
		expect(head.control().reason).toBeTruthy();
		expect(head.unsavedWork().kind).toBe('proceed');
	});

	it('offers Reload remote only in conflict and returns the offer without installing it', () => {
		const { state, reload } = stub(
			snapshot({
				status: 'conflict',
				conflict: { localJson: '{}', localSourceContentId: 'local', remote: null }
			})
		);
		const head = createHeadSave(state);
		expect(head.control()).toMatchObject({ disabled: true, conflict: true });
		expect(head.reloadRemote()).toEqual(reload);
	});

	it('resumes a pending Save through retry after the sign-in interruption', async () => {
		const { state } = stub(
			snapshot({
				status: 'auth-required',
				error: { code: 'auth-required', message: 'Sign in again', retryable: true },
				pending: true
			}),
			{ kind: 'unresolved' }
		);
		const retry = vi.spyOn(state, 'retry');
		const head = createHeadSave(state);
		// The control is reachable: the Head can run the resume command after the
		// platform's sign-in flow instead of leaving a disabled dead end.
		expect(head.control()).toMatchObject({
			label: 'Resume pending save',
			signInRequired: true,
			disabled: false
		});
		// The resume path reissues the retained capture; its receipt is still unresolved.
		expect(await head.retry()).toEqual({ kind: 'unresolved' });
		expect(retry).toHaveBeenCalledTimes(1);
	});

	it('keeps Save disabled with the executable-closure reason instead of offering an impossible write', () => {
		const { state } = stub(snapshot());
		const head = createHeadSave(state, {
			unavailableReason: 'This source cannot execute (missing-resource): paper. Save is unavailable.'
		});
		expect(head.control()).toMatchObject({
			label: 'Save unavailable',
			disabled: true,
			unavailable: true,
			reason: 'This source cannot execute (missing-resource): paper. Save is unavailable.'
		});
		// Unsaved-work signalling is unchanged: cancellation still preserves work.
		expect(head.unsavedWork().kind).toBe('confirm');
	});

	it('retries a refusal with the state machine’s own reason intact', async () => {
		const { state } = stub(
			snapshot({
				status: 'error',
				error: { code: 'server', message: 'The server refused this Save.', retryable: true }
			}),
			{ kind: 'refused', code: 'conflict', message: 'The server refused this Save.' }
		);
		const head = createHeadSave(state);
		expect(head.control()).toMatchObject({ label: 'Retry save', disabled: false });
		expect(head.control().reason).toBe('The server refused this Save.');
		expect(await head.retry()).toEqual({ kind: 'refused', message: 'The server refused this Save.' });
	});
});

describe('R217.S20 — the mounted Head announces a refusal and describes its Save', () => {
	let component: ReturnType<typeof mount> | undefined;
	let target: HTMLElement | undefined;

	afterEach(() => {
		if (component !== undefined) unmount(component);
		component = undefined;
		target?.remove();
		target = undefined;
	});

	function mountSave(state: SaveState): HTMLElement {
		target = document.createElement('div');
		document.body.append(target);
		component = mount(EditorHead, {
			target,
			props: {
				projectId: 'project-1',
				projectName: 'Save fixture',
				lens: 'world' as const,
				onLens: () => {},
				canDownloadSource: true,
				onDownloadSource: () => {},
				historyUnavailableReason: 'Nothing to undo yet.',
				saveUnavailableReason: 'Unused in this fixture.',
				previewUnavailableReason: 'Preview needs an admitted project source.',
				save: createHeadSave(state)
			}
		});
		return target;
	}

	it('announces a refused Save politely and describes the Save control with the same words', async () => {
		const { state } = stub(
			snapshot({
				status: 'error',
				error: { code: 'server', message: 'The server refused this Save.', retryable: true }
			}),
			{ kind: 'refused', code: 'conflict', message: 'The server refused this Save.' }
		);
		const host = mountSave(state);
		await tick();
		const announcement = host.querySelector<HTMLElement>('[data-head-announce]')!;
		expect(announcement.getAttribute('role')).toBe('status');
		expect(announcement.getAttribute('aria-live')).toBe('polite');
		expect(announcement.textContent).toBe('The server refused this Save.');
		const save = host.querySelector<HTMLButtonElement>('[data-head-save-button]')!;
		expect(save.textContent?.trim()).toBe('Retry save');
		const describedBy = save.getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		expect(document.getElementById(describedBy!)?.textContent).toContain('The server refused this Save.');
	});

	it('keeps a settled Save focusable, describes it with its reason, and opens that reason on a press', async () => {
		const { state } = stub(snapshot({ status: 'saved', dirty: false }));
		const host = mountSave(state);
		await tick();
		const save = host.querySelector<HTMLButtonElement>('[data-head-save-button]')!;
		// A native disabled control cannot take focus, so its reason could not be reached from the keyboard.
		expect(save.disabled).toBe(false);
		expect(save.getAttribute('aria-disabled')).toBe('true');
		save.focus();
		expect(document.activeElement).toBe(save);
		const describedBy = save.getAttribute('aria-describedby')!;
		expect(document.getElementById(describedBy)?.textContent).toContain('All accepted changes are saved.');
		expect(host.querySelector<HTMLElement>('[data-head-announce]')!.textContent).toBe('');
		save.click();
		await tick();
		expect(host.querySelector('[data-head-save]')?.hasAttribute('data-reason-open')).toBe(true);
		expect(state.getSnapshot().status).toBe('saved');
	});
});
