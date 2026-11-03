import { describe, expect, it, vi } from 'vitest';

import { TEST_AUTH_SESSION_COOKIE } from './test-auth';
import { seedXBrowserProject } from './x-fixtures-seed';

const API = 'https://api.test';
const EDITOR = 'http://localhost:5173';
const sessionPair = `${TEST_AUTH_SESSION_COOKIE}=encoded-session-value`;

function jsonResponse(value: unknown, status = 200, setCookie?: string): Response {
	const headers = new Headers({ 'Content-Type': 'application/json' });
	if (setCookie !== undefined) headers.append('set-cookie', setCookie);
	return new Response(JSON.stringify(value), { status, headers });
}

describe('R217.S26 x-fixture browser seeder', () => {
	it('logs in, saves the built fixture create-only, and cleans up with its saved base', async () => {
		const calls: { url: string; init: RequestInit | undefined }[] = [];
		const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
			calls.push({ url, init });
			if (url.endsWith('/test-auth/session')) {
				return jsonResponse({ authenticated: true, user: { id: 'google:e2e-agent-admin' } }, 201, `${sessionPair}; Path=/`);
			}
			return init?.method === 'PUT' ? jsonResponse({ savedBaseToken: 'base-1' }) : jsonResponse({});
		});
		const seed = await seedXBrowserProject({
			name: 'x-salon',
			apiOrigin: `${API}/`,
			editorOrigin: EDITOR,
			testAuthSecret: 'e2e-test-secret-with-enough-length',
			fetchImpl: fetchImpl as unknown as typeof fetch
		});

		const put = calls[1]!;
		expect(put.url).toBe(`${API}/projects/${seed.projectId}`);
		expect(put.init?.method).toBe('PUT');
		const headers = put.init?.headers as Headers;
		expect(headers.get('Cookie')).toBe(sessionPair);
		expect(headers.get('Origin')).toBe(EDITOR);
		const body = JSON.parse(String(put.init?.body));
		expect(body.capture.precondition).toEqual({ kind: 'create-only' });
		expect(body.capture.projectId).toBe(seed.projectId);
		const saved = JSON.parse(body.capture.canonicalJson);
		expect(saved.id).toBe(seed.projectId);
		expect(saved).toEqual(JSON.parse(JSON.stringify(seed.project)));
		expect(seed.ids.stopIds).toHaveLength(6);

		await seed.cleanup();
		const del = calls[2]!;
		expect(del.init?.method).toBe('DELETE');
		expect(JSON.parse(String(del.init?.body))).toEqual({ precondition: { kind: 'expected-saved-base', token: 'base-1' } });
	});

	it('recognizes x-paths and saves its shared, step and walled Camera connections', async () => {
		const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
			if (url.endsWith('/test-auth/session')) {
				return jsonResponse({ authenticated: true, user: { id: 'google:e2e-agent-admin' } }, 201, `${sessionPair}; Path=/`);
			}
			return init?.method === 'PUT' ? jsonResponse({ savedBaseToken: 'base-path' }) : jsonResponse({});
		});
		const seed = await seedXBrowserProject({
			name: 'x-paths',
			apiOrigin: API,
			editorOrigin: EDITOR,
			testAuthSecret: 'e2e-test-secret-with-enough-length',
			fetchImpl: fetchImpl as unknown as typeof fetch
		});
		expect(seed.name).toBe('x-paths');
		expect(seed.project.units.camera.data.connections.map((connection) => connection.id)).toEqual([
			'x-path-shared',
			'x-path-step',
			'x-path-door'
		]);
		expect(seed.project.units.layout.data.openings).toHaveLength(1);
		await seed.cleanup();
	});
});
