/**
 * S17 browser fixture seeder. It stays under tests and reaches the same project
 * and creator-import HTTP routes as the application; it never enters a bundle.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { creatorModelResourceEntry } from '@portfolio/project-model/scene-planning';
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
import { ingestCreatorImport } from '../../src/lib/authoring/adapters/scene/import/ingest';
import { CREATOR_IMPORT_RECIPE } from '../../src/lib/authoring/adapters/scene/import/types';
import type { CreatorImportApproved, CreatorImportStaging } from '../../src/lib/authoring/adapters/scene/import/types';
import { loginAs, type TestAuthSession, type TestAuthUserKey } from './test-auth';
import { buildS17MixedProject } from '../lib/authoring/__fixtures__/s17-mixed-project';
import { createUnitProject } from '../lib/authoring/__fixtures__/unit-envelope-fixtures';

const DEFAULT_MODELS_ROOT = fileURLToPath(new URL('../../assets-source/models/', import.meta.url));

export type S17BrowserProjectSeed = {
	readonly project: ProjectEnvelope;
	readonly projectId: string;
	readonly ids: Awaited<ReturnType<typeof buildS17MixedProject>>['ids'];
	readonly session: TestAuthSession;
	readonly savedBaseToken: string;
	/** Delete only this helper's newly created project, using its saved-base token. */
	cleanup(): Promise<void>;
};

export type SeedS17BrowserProjectOptions = {
	readonly apiOrigin: string;
	readonly editorOrigin: string;
	readonly testAuthSecret: string;
	readonly user?: TestAuthUserKey;
	readonly modelsRoot?: string;
	readonly fetchImpl?: typeof fetch;
};

type DeclaredImportFile = {
	readonly fileId: string;
	readonly role: 'source' | 'derivative';
	readonly path: string;
};

function hash(bytes: Uint8Array): string {
	return `sha256-${createHash('sha256').update(bytes).digest('hex')}`;
}

async function smallestGlb(root: string): Promise<{ readonly path: string; readonly bytes: Uint8Array }> {
	const candidates: { path: string; size: number }[] = [];
	async function walk(directory: string): Promise<void> {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) await walk(path);
			else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) {
				candidates.push({ path, size: (await stat(path)).size });
			}
		}
	}
	await walk(root);
	candidates.sort((a, b) => a.size - b.size || a.path.localeCompare(b.path));
	const chosen = candidates[0];
	if (chosen === undefined) throw new Error(`No GLB files were found under ${root}`);
	return { path: chosen.path, bytes: new Uint8Array(await readFile(chosen.path)) };
}

function requestHeaders(session: TestAuthSession, editorOrigin: string): Headers {
	return new Headers({
		Accept: 'application/json',
		'Content-Type': 'application/json',
		Cookie: session.cookie,
		Origin: editorOrigin
	});
}

async function readJson<T>(response: Response, action: string): Promise<T> {
	const body = await response.text();
	if (!response.ok) throw new Error(`${action} failed with HTTP ${response.status}${body ? `: ${body}` : ''}`);
	try {
		return JSON.parse(body) as T;
	} catch {
		throw new Error(`${action} returned invalid JSON`);
	}
}

/**
 * Save an admitted mixed project, approve the smallest local GLB through the
 * server's real staging/upload/approval routes, then save the server pin.
 */
export async function seedS17BrowserProject(
	options: SeedS17BrowserProjectOptions
): Promise<S17BrowserProjectSeed> {
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (fetchImpl === undefined) throw new Error('Fetch is unavailable for S17 browser seeding');
	const apiOrigin = options.apiOrigin.trim().replace(/\/+$/, '');
	const editorOrigin = options.editorOrigin.trim().replace(/\/+$/, '');
	if (!apiOrigin || !editorOrigin) throw new Error('S17 seeding requires API and editor origins');
	const projectId = randomUUID();
	const session = await loginAs({
		user: options.user ?? 'agent-admin',
		apiOrigin,
		secret: options.testAuthSecret,
		origin: editorOrigin,
		fetchImpl
	});
	const requestJson = async <T>(path: string, value: unknown, method: 'PUT' | 'POST' | 'DELETE' = 'POST') =>
		readJson<T>(
			await fetchImpl(`${apiOrigin}${path}`, {
				method,
				headers: requestHeaders(session, editorOrigin),
				body: JSON.stringify(value)
			}),
			`${method} ${path}`
		);
	const { project: fixture, ids } = await buildS17MixedProject(projectId);
	const modelsRoot = resolve(options.modelsRoot ?? DEFAULT_MODELS_ROOT);
	const catalogueResources = fixture.units.resources.data.resources.filter((resource) => resource.kind === 'asset');
	const catalogueLocks = fixture.dependencyLock.entries.filter((entry) => entry.domain === 'resource:asset');
	const initialSource = await createUnitProject({
		id: projectId,
		name: fixture.name,
		acceptedRevision: fixture.acceptedRevision,
		layout: fixture.units.layout.data,
		scene: {
			...fixture.units.scene.data,
			entities: fixture.units.scene.data.entities.filter((entity) => entity.id !== ids.approvedModelId)
		},
		resources: { formatVersion: 2, resources: catalogueResources }
	});
	const initialProject: ProjectEnvelope = {
		...initialSource,
		dependencyLock: { formatVersion: 1, entries: catalogueLocks }
	};
	const saveProject = async (
		project: ProjectEnvelope,
		precondition: SaveAcceptedSource['precondition']
	): Promise<SaveAcknowledgement> => {
		const capture: SaveAcceptedSource = {
			protocol: SAVE_ACCEPTED_SOURCE_VERSION,
			projectId,
			operationId: `s17-seed-${randomUUID()}`,
			precondition,
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			acceptedRevision: project.acceptedRevision,
			sourceContentId: await computeEnvelopeSourceContentId(project),
			canonicalJson: serializeProjectEnvelope(project)
		};
		return requestJson<SaveAcknowledgement>(
			`/projects/${encodeURIComponent(projectId)}`,
			{ contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME, capture },
			'PUT'
		);
	};

	let importId: string | null = null;
	let savedBaseToken: string | null = null;
	let approved = false;
	try {
		// Import staging is project-scoped, so establish the empty mixed project
		// before using the real model-import routes. The fake approved fixture pin is
		// deliberately absent until the server returns its actual approval record.
		const initialAcknowledgement = await saveProject(initialProject, { kind: 'create-only' });
		savedBaseToken = initialAcknowledgement.savedBaseToken;

		const sourceModel = await smallestGlb(modelsRoot);
		const importFiles = [{ path: 's17-source.glb', bytes: sourceModel.bytes }];
		const rawPrepared = await ingestCreatorImport({
			files: importFiles,
			parameters: { metresPerSourceUnit: 1, pivot: 'bottom-centre' }
		});
		if (rawPrepared.kind !== 'prepared') {
			throw new Error(`The smallest GLB could not be prepared for S17: ${rawPrepared.message}`);
		}
		// The smallest source by bytes can still contain geometry in large source
		// units. Measure once at unit scale, then import the same real GLB at a
		// scale that keeps its longest approved floor extent within 0.7 m. This
		// keeps the browser subject inside the mixed room without inventing bounds.
		const largestExtent = Math.max(
			rawPrepared.report.placement.footprint.width,
			rawPrepared.report.placement.footprint.depth
		);
		if (!Number.isFinite(largestExtent) || largestExtent <= 0) {
			throw new Error('The smallest GLB has no finite floor footprint for S17');
		}
		const metresPerSourceUnit = Math.min(1, 0.7 / largestExtent);
		const prepared = metresPerSourceUnit === 1
			? rawPrepared
			: await ingestCreatorImport({
					files: importFiles,
					parameters: { metresPerSourceUnit, pivot: 'bottom-centre' }
				});
		if (prepared.kind !== 'prepared') {
			throw new Error(`The scaled smallest GLB could not be prepared for S17: ${prepared.message}`);
		}
		const declared = [
			...prepared.source.map((file) => ({ role: 'source' as const, path: file.path, size: file.size, hash: file.hash })),
			{
				role: 'derivative' as const,
				path: prepared.derivative.path,
				size: prepared.derivative.bytes.byteLength,
				hash: hash(prepared.derivative.bytes)
			}
		];
		const staging = await requestJson<CreatorImportStaging>(
			`/projects/${encodeURIComponent(projectId)}/models/imports`,
			{ recipe: CREATOR_IMPORT_RECIPE, files: declared }
		);
		importId = staging.importId;
		const bytesByPath = new Map<string, Uint8Array>([
			...prepared.source.map((file) => [file.path, sourceModel.bytes] as const),
			[prepared.derivative.path, prepared.derivative.bytes]
		]);
		for (const file of staging.files as readonly DeclaredImportFile[]) {
			const bytes = bytesByPath.get(file.path);
			if (bytes === undefined) throw new Error(`No S17 bytes were prepared for staged file ${file.path}`);
			const response = await fetchImpl(
				`${apiOrigin}/projects/${encodeURIComponent(projectId)}/models/imports/${encodeURIComponent(staging.importId)}/files/${encodeURIComponent(file.fileId)}/content`,
				{
					method: 'PUT',
					headers: new Headers({
						Accept: 'application/json',
						'Content-Type': 'application/octet-stream',
						'Content-Length': String(bytes.byteLength),
						Cookie: session.cookie,
						Origin: editorOrigin
					}),
					body: new Blob([Uint8Array.from(bytes).buffer])
				}
			);
			await readJson<unknown>(response, `PUT staged model file ${file.path}`);
		}
		const approvedRevision = await requestJson<CreatorImportApproved>(
			`/projects/${encodeURIComponent(projectId)}/models/imports/${encodeURIComponent(staging.importId)}/approve`,
			{
				reportDigest: prepared.reportDigest,
				placement: {
					metresPerSourceUnit: prepared.report.placement.metresPerSourceUnit,
					pivot: [0, 0, 0],
					footprint: prepared.report.placement.footprint,
					contactMinY: prepared.report.placement.contactMinY,
					placement: 'floor'
				}
			}
		);
		approved = true;
		const entry = creatorModelResourceEntry(ids.approvedModelId, {
			derivative: approvedRevision.derivative,
			source: approvedRevision.source,
			recipe: approvedRevision.recipe,
			reportDigest: approvedRevision.reportDigest,
			placement: {
				metresPerSourceUnit: approvedRevision.placement.metresPerSourceUnit,
				pivot: approvedRevision.placement.pivot,
				footprint: approvedRevision.placement.footprint,
				contactMinY: approvedRevision.placement.contactMinY
			}
		});
		if (entry === null) throw new Error('The approved GLB did not form a valid creator-model resource');

		const project = await createUnitProject({
			id: projectId,
			name: fixture.name,
			// The fixture accepted revision named the initial Save. This second
			// authored source adds the server-approved model pin, so it needs a fresh
			// local acceptance identity as well as the saved-base precondition.
			acceptedRevision: { projectId, revisionId: randomUUID() },
			layout: fixture.units.layout.data,
			scene: fixture.units.scene.data,
			resources: { formatVersion: 2, resources: [...catalogueResources, entry.resource] }
		});
		const pinnedProject: ProjectEnvelope = {
			...project,
			dependencyLock: { formatVersion: 1, entries: [...catalogueLocks, entry.lock] }
		};
		const acknowledgement = await saveProject(pinnedProject, {
			kind: 'expected-saved-base',
			token: savedBaseToken
		});
		savedBaseToken = acknowledgement.savedBaseToken;
		const finalSavedBaseToken = savedBaseToken;
		return {
			project: pinnedProject,
			projectId,
			ids,
			session,
			savedBaseToken: finalSavedBaseToken,
			async cleanup() {
				await requestJson(`/projects/${encodeURIComponent(projectId)}`, {
					precondition: { kind: 'expected-saved-base', token: finalSavedBaseToken }
				}, 'DELETE');
			}
		};
	} catch (error) {
		if (savedBaseToken !== null) {
			try {
				await requestJson(`/projects/${encodeURIComponent(projectId)}`, {
					precondition: { kind: 'expected-saved-base', token: savedBaseToken }
				}, 'DELETE');
			} catch { /* Preserve the original seeding failure; cleanup can be retried manually. */ }
		} else if (importId !== null && !approved) {
			try {
				await requestJson(`/projects/${encodeURIComponent(projectId)}/models/imports/${encodeURIComponent(importId)}`, {}, 'DELETE');
			} catch { /* The API can expire unapproved staging if cleanup is unavailable. */ }
		}
		throw error;
	}
}
