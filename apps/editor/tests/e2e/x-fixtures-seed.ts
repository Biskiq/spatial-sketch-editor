/**
 * R217.S26 browser fixture seeder for the x-fixtures. It stays under tests, builds
 * the fixture through the real planners and saves it through the same project
 * route the application uses; it never enters a bundle. The owner's manual
 * journeys open the returned project id in `/project/<id>/spatial`.
 */
import { randomUUID } from 'node:crypto';
import {
	computeEnvelopeSourceContentId,
	serializeProjectEnvelope,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import {
	SAVE_ACCEPTED_SOURCE_VERSION,
	SAVE_CONTENT_IDENTITY_SCHEME,
	type SaveAcceptedSource,
	type SaveAcknowledgement
} from '@portfolio/project-model/save';
import { loginAs, type TestAuthSession, type TestAuthUserKey } from './test-auth';
import { buildXFixture, type XFixture, type XFixtureName } from '../lib/experience/__fixtures__/x-fixtures';

export type XBrowserProjectSeed = {
	readonly name: XFixtureName;
	readonly project: ProjectEnvelope;
	readonly projectId: string;
	readonly ids: XFixture['ids'];
	readonly session: TestAuthSession;
	readonly savedBaseToken: string;
	/** Delete only this helper's newly created project, using its saved-base token. */
	cleanup(): Promise<void>;
};

export type SeedXBrowserProjectOptions = {
	readonly name: XFixtureName;
	readonly apiOrigin: string;
	readonly editorOrigin: string;
	readonly testAuthSecret: string;
	readonly user?: TestAuthUserKey;
	readonly fetchImpl?: typeof fetch;
};

async function readJson<T>(response: Response, action: string): Promise<T> {
	const body = await response.text();
	if (!response.ok) throw new Error(`${action} failed with HTTP ${response.status}${body ? `: ${body}` : ''}`);
	try {
		return JSON.parse(body) as T;
	} catch {
		throw new Error(`${action} returned invalid JSON`);
	}
}

/** Build one x-fixture under a fresh project id and save it create-only. */
export async function seedXBrowserProject(options: SeedXBrowserProjectOptions): Promise<XBrowserProjectSeed> {
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (fetchImpl === undefined) throw new Error('Fetch is unavailable for x-fixture seeding');
	const apiOrigin = options.apiOrigin.trim().replace(/\/+$/, '');
	const editorOrigin = options.editorOrigin.trim().replace(/\/+$/, '');
	if (!apiOrigin || !editorOrigin) throw new Error('x-fixture seeding requires API and editor origins');
	const projectId = randomUUID();
	const session = await loginAs({
		user: options.user ?? 'agent-admin',
		apiOrigin,
		secret: options.testAuthSecret,
		origin: editorOrigin,
		fetchImpl
	});
	const requestJson = async <T>(path: string, value: unknown, method: 'PUT' | 'DELETE') =>
		readJson<T>(
			await fetchImpl(`${apiOrigin}${path}`, {
				method,
				headers: new Headers({
					Accept: 'application/json',
					'Content-Type': 'application/json',
					Cookie: session.cookie,
					Origin: editorOrigin
				}),
				body: JSON.stringify(value)
			}),
			`${method} ${path}`
		);
	const { project, ids } = await buildXFixture(options.name, projectId);
	const capture: SaveAcceptedSource = {
		protocol: SAVE_ACCEPTED_SOURCE_VERSION,
		projectId,
		operationId: `x-seed-${randomUUID()}`,
		precondition: { kind: 'create-only' },
		sourceKind: UNIT_SOURCE_KIND,
		sourceVersion: UNIT_SOURCE_VERSION,
		acceptedRevision: project.acceptedRevision,
		sourceContentId: await computeEnvelopeSourceContentId(project),
		canonicalJson: serializeProjectEnvelope(project)
	};
	const acknowledgement = await requestJson<SaveAcknowledgement>(
		`/projects/${encodeURIComponent(projectId)}`,
		{ contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME, capture },
		'PUT'
	);
	const savedBaseToken = acknowledgement.savedBaseToken;
	return {
		name: options.name,
		project,
		projectId,
		ids,
		session,
		savedBaseToken,
		async cleanup() {
			await requestJson(`/projects/${encodeURIComponent(projectId)}`, {
				precondition: { kind: 'expected-saved-base', token: savedBaseToken }
			}, 'DELETE');
		}
	};
}
