// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import Login from '../../../src/routes/login/+page.svelte';

it.each([7, 8])('enforces the eight-character minimum before sending a %s-character password', async (length) => {
	const request = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) =>
		new Response(JSON.stringify(init?.method === 'POST'
			? { authenticated: true, user: { id: 'local:test' } }
			: { authenticated: false }), { status: 200, headers: { 'content-type': 'application/json' } }));
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Login, { target });
	try {
		await tick();
		const username = target.querySelector<HTMLInputElement>('#username')!;
		const password = target.querySelector<HTMLInputElement>('#password')!;
		expect(password.minLength).toBe(8);
		expect(password.maxLength).toBe(128);
		username.value = 'test.creator';
		username.dispatchEvent(new Event('input', { bubbles: true }));
		password.value = 'x'.repeat(length);
		password.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		target.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		await tick();
		const posts = request.mock.calls.filter(([, init]) => init?.method === 'POST');
		if (length === 8) {
			expect(posts).toHaveLength(1);
			expect(JSON.parse(posts[0]![1]!.body as string)).toEqual({ username: 'test.creator', password: 'xxxxxxxx' });
		} else {
			expect(posts).toHaveLength(0);
			expect(target.querySelector('[role="alert"]')?.textContent).toContain('between 8 and 128');
		}
	} finally {
		await unmount(component);
		target.remove();
		request.mockRestore();
	}
});
