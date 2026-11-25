import { ModelPinRefusalError } from '../model-persistence.js';
import { ProjectNotFoundError } from '../project-persistence.js';
import { SaveRefusalError, saveAcceptedSource } from '../save-persistence.js';
import { readSaveRequest } from '@portfolio/project-model/save';
import { errorBody, unauthorized, notFound, databaseFailure, sessionUserId, saveRefusal, isUnconditionedDocumentBody } from '../http.js';

import type { RouteDeps } from './deps.js';

export function registerSaveRoutes(deps: RouteDeps): void {
	const { app, pool, sessionsEnabled, objectStore } = deps;
	app.put('/projects/:projectId', async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		const body = request.body;
		if (typeof projectId !== 'string' || !projectId) {
			return reply.code(400).send(errorBody('invalid_project_id', 'Invalid project ID'));
		}
		// The unconditional document body is the old client. Refuse it with no
		// write and no implicit create rather than accepting an overwrite.
		if (isUnconditionedDocumentBody(body)) {
			return reply
				.code(400)
				.send(errorBody('precondition_required', 'Save requires a create-only or expected-saved-base precondition'));
		}
		const parsed = readSaveRequest(body);
		if (parsed.kind === 'invalid') {
			return reply.code(400).send({
				error: { code: 'invalid_save_request', message: 'Invalid SaveAcceptedSource@1 request' },
				issues: parsed.issues
			});
		}
		if (parsed.request.capture.projectId !== projectId) {
			return reply.code(400).send(errorBody('project_id_mismatch', 'Project ID does not match captured project ID'));
		}
		try {
			return await saveAcceptedSource(pool, userId, parsed.request, objectStore);
		} catch (error) {
			if (error instanceof ProjectNotFoundError) return notFound(reply);
			if (error instanceof SaveRefusalError || error instanceof ModelPinRefusalError) return saveRefusal(reply, error);
			return databaseFailure(app, reply, error, 'Project save failed');
		}
	});
}


