import { describe, expect, it, vi } from 'vitest';

import { createProjectAuth } from '$lib/platform/project-persistence';

describe('project authentication transport', () => {
	it('redirects sign-in to the local form while preserving the requested intent', () => {
		const assign = vi.fn();
		vi.stubGlobal('window', { location: { assign } });
		try {
			createProjectAuth('https://api.example').signIn('save');
			expect(assign).toHaveBeenCalledWith('/login?intent=save');
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('reads the app-owned session without changing its identity shape', async () => {
		const calls: { url: string; init: RequestInit }[] = [];
		const auth = createProjectAuth('https://api.example', async (url, init) => {
			calls.push({ url, init: init ?? {} });
			return new Response(JSON.stringify({ authenticated: true, user: { id: 'google:legacy-owner' } }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			});
		});

		await expect(auth.getSession()).resolves.toEqual({ authenticated: true, user: { id: 'google:legacy-owner' } });
		expect(calls[0]?.url).toBe('https://api.example/auth/me');
		expect(calls[0]?.init.credentials).toBe('include');
	});
});
