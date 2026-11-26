import { ProjectNotFoundError } from '../project-persistence.js';
import {
	getPublicationStatus,
	PublicationConflictError,
	PublicationNotFoundError,
	unpublishVersion,
} from '../publication-persistence.js';
import {
	errorBody,
	unauthorized,
	notFound,
	databaseFailure,
	sessionUserId,
	readExpectedPublicationRevision,
	publicationConflict,
} from '../http.js';

import type { RouteDeps } from './deps.js';

export function registerPublicationRoutes(deps: RouteDeps): void {
	const { app, pool, sessionsEnabled } = deps;
	app.get('/projects/:projectId/publication', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (typeof projectId !== 'string' || !projectId) {
			return reply.code(400).send(errorBody('invalid_project_id', 'Invalid project ID'));
		}
		try {
			return await getPublicationStatus(pool, userId, projectId);
		} catch (error) {
			if (error instanceof ProjectNotFoundError) return notFound(reply);
			return databaseFailure(app, reply, error, 'Publication status failed');
		}
	});

	app.put('/projects/:projectId/publication', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (typeof projectId !== 'string' || !projectId) {
			return reply.code(400).send(errorBody('invalid_project_id', 'Invalid project ID'));
		}
		// AM-9 publication gap: every authored publication row is removed at
		// activation and prepared delivery is T4's. The request is understood and
		// refused with the ratified code, never read as an old release.
		return reply
			.code(501)
			.send(errorBody('prepared-reader-required', 'Publishing requires the prepared reader'));
	});

	app.delete('/projects/:projectId/publication', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (typeof projectId !== 'string' || !projectId) {
			return reply.code(400).send(errorBody('invalid_project_id', 'Invalid project ID'));
		}
		const revision = readExpectedPublicationRevision(request.body);
		if (revision === null)
			return reply.code(400).send(errorBody('invalid_body', 'Expected a publication body'));
		try {
			return await unpublishVersion(pool, userId, projectId, revision);
		} catch (error) {
			if (error instanceof ProjectNotFoundError || error instanceof PublicationNotFoundError) {
				return notFound(reply);
			}
			if (error instanceof PublicationConflictError) return publicationConflict(reply, error);
			return databaseFailure(app, reply, error, 'Project unpublish failed');
		}
	});

	// AM-9's publication gap: prepared delivery is T4's, and no public document
	// or asset read is served from an authored row. Both routes answer an
	// honest not-found for every ID, including a prior `/p/` link.
	app.get('/publications/:publicationId', async (_request, reply) => {
		reply.header('Cache-Control', 'no-store');
		return notFound(reply);
	});

	app.get(
		'/publications/:publicationId/versions/:version/assets/:assetId/content',
		async (_request, reply) => {
			reply.header('Cache-Control', 'no-store');
			return notFound(reply);
		},
	);
}
