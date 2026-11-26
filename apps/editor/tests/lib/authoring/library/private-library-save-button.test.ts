// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountWithProps, settle } from '../../../kit/dom';
import PrivateLibrarySaveButton from '$lib/authoring/library/PrivateLibrarySaveButton.svelte';

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const unmount of cleanups.splice(0)) unmount();
});

describe('T2.S8 U7 — Save to My library control', () => {
	it('is unavailable without a session or a draft save', () => {
		const fx = mountWithProps(PrivateLibrarySaveButton, {});
		cleanups.push(fx.unmount);
		const button = fx.target.querySelector<HTMLButtonElement>('[data-finish-save-library]');
		expect(button?.disabled).toBe(true);
		expect(button?.textContent).toBe('Save to My library');
	});

	it('keeps the failure in place and retries from the same control', async () => {
		const save = vi
			.fn()
			.mockResolvedValueOnce({ ok: false, message: 'My library is offline. Try again.' })
			.mockResolvedValueOnce({ ok: true, message: 'Saved “Lobby oak” to My library' });
		const fx = mountWithProps(PrivateLibrarySaveButton, { save });
		cleanups.push(fx.unmount);
		const button = fx.target.querySelector<HTMLButtonElement>('[data-finish-save-library]');
		button?.click();
		await settle();
		expect(save).toHaveBeenCalledTimes(1);
		expect(button?.textContent).toBe('Couldn’t save · Retry');
		expect(button?.title).toMatch(/offline/);
		button?.click();
		await settle();
		expect(save).toHaveBeenCalledTimes(2);
		expect(button?.textContent).toBe('Saved');
	});
});
