import { isValidProjectId } from '../asset-persistence.js';
import { verifyMaterialDefinitionHashes } from '../material-integrity.js';
import { ActivePublicationDeleteError, deleteProject as deleteProjectLifecycle, parseDeleteProjectRequest, parseRenameProjectRequest, ProjectDeletionBusyError, ProjectLifecycleInputError, renameProject as renameProjectLifecycle, hasUnsupportedLayoutFormat, UnsupportedLayoutFormatError, UNSUPPORTED_LAYOUT_FORMAT, UNSUPPORTED_LAYOUT_MESSAGE } from '../project-lifecycle.js';
import { listProjects, loadProject, ProjectNotFoundError } from '../project-persistence.js';
import { SaveRefusalError } from '../save-persistence.js';
import { LAYOUT_DIMENSION_LIMIT_MESSAGE } from '@portfolio/layout-core/geometry';
import { validateProjectEnvelope } from '@portfolio/project-model/units';
import { errorBody, unauthorized, notFound, databaseFailure, sessionUserId, saveRefusal } from '../http.js';

import type { RouteDeps } from './deps.js';

export function registerProjectRoutes(deps: RouteDeps): void {
	const { app, pool, sessionsEnabled, objectStore, objectNamespace, lifecyclePolicy } = deps;
	app.get('/projects', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		try {
			return { projects: await listProjects(pool, userId) };
		} catch (error) {
			return databaseFailure(app, reply, error, 'Project list failed');
		}
	});

	app.patch('/projects/:projectId', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (!isValidProjectId(projectId)) {
			return reply.code(400).send(errorBody('invalid_project_id', 'Invalid project ID'));
		}
		const parsed = parseRenameProjectRequest(request.body);
		if (parsed.kind === 'invalid') return reply.code(400).send(errorBody(parsed.code, parsed.message));
		try {
			return await renameProjectLifecycle(pool, userId, projectId, parsed.request, objectStore);
		} catch (error) {
			if (error instanceof ProjectNotFoundError) return notFound(reply);
			if (error instanceof SaveRefusalError) return saveRefusal(reply, error);
			if (error instanceof UnsupportedLayoutFormatError) {
				return reply.code(422).send(errorBody(UNSUPPORTED_LAYOUT_FORMAT, error.message));
			}
			if (error instanceof ProjectLifecycleInputError) {
				return reply.code(error.statusCode).send(errorBody(error.code, error.message));
			}
			return databaseFailure(app, reply, error, 'Project rename failed');
		}
	});

	app.delete('/projects/:projectId', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (!isValidProjectId(projectId)) {
			return reply.code(400).send(errorBody('invalid_project_id', 'Invalid project ID'));
		}
		const parsed = parseDeleteProjectRequest(request.body);
		if (parsed.kind === 'invalid') return reply.code(400).send(errorBody(parsed.code, parsed.message));
		if (!objectStore?.list || !objectStore.delete) {
			return reply.code(503).send(errorBody('storage_unavailable', 'Project cleanup is temporarily unavailable'));
		}
		try {
			const acknowledgement = await deleteProjectLifecycle(
				pool,
				userId,
				projectId,
				parsed.request,
				objectNamespace,
				objectStore,
				lifecyclePolicy
			);
			return reply.code(acknowledgement.cleanup === 'complete' ? 200 : 202).send(acknowledgement);
		} catch (error) {
			if (error instanceof ProjectNotFoundError) return notFound(reply);
			if (error instanceof SaveRefusalError) return saveRefusal(reply, error);
			if (error instanceof ActivePublicationDeleteError) {
				return reply.code(409).send(errorBody(error.code, error.message));
			}
			if (error instanceof ProjectDeletionBusyError) {
				return reply.code(409).send(errorBody(error.code, error.message));
			}
			return databaseFailure(app, reply, error, 'Project deletion failed');
		}
	});

	app.get('/projects/:projectId', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (typeof projectId !== 'string' || !projectId) {
			return reply.code(400).send(errorBody('invalid_project_id', 'Invalid project ID'));
		}
		try {
			const loaded = await loadProject(pool, userId, projectId);
			const validation = validateProjectEnvelope(loaded.document);
			if (!validation.success || validation.envelope.id !== projectId) {
				if (!validation.success && hasUnsupportedLayoutFormat(validation.issues)) {
					return reply.code(422).send(errorBody(UNSUPPORTED_LAYOUT_FORMAT, UNSUPPORTED_LAYOUT_MESSAGE));
				}
				if (!validation.success && validation.issues.some((issue) =>
					issue.code === 'unsupported_format_version' && issue.path.startsWith('$.units.scene.'))) {
					return reply.code(422).send(errorBody('unsupported_scene_format', 'This project was saved in an incompatible Scene format.'));
				}
				// A stored project that fails only the dimension envelope is not a
				// broken database row: it is unsupported geometry, and the creator gets
				// the same canonical refusal as every other dimension entry point.
				if (
					!validation.success &&
					validation.issues.length > 0 &&
					validation.issues.every((issue) => issue.code === 'dimension_out_of_range')
				) {
					return reply.code(422).send(errorBody('dimension_out_of_range', LAYOUT_DIMENSION_LIMIT_MESSAGE));
				}
				return databaseFailure(app, reply, new Error('Stored project failed validation'), 'Stored project failed validation');
			}
			const materialIssues = await verifyMaterialDefinitionHashes(validation.envelope);
			if (materialIssues.length > 0) {
				return reply.code(422).send(errorBody('invalid-material-definition', materialIssues[0]!.message));
			}
			return { ...loaded, document: validation.envelope };
		} catch (error) {
			if (error instanceof ProjectNotFoundError) return notFound(reply);
			return databaseFailure(app, reply, error, 'Project load failed');
		}
	});
}


