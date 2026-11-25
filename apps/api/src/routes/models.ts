import { isValidAssetId, isValidProjectId } from '../asset-persistence.js';
import { approveModelImport, cancelModelImport, createModelImport, ModelInputError, ModelNotFoundError, readModelRevisionContent, uploadModelFile } from '../model-persistence.js';
import { ProjectNotFoundError } from '../project-persistence.js';
import { ProjectWriteAbortedError } from '../project-write-lease.js';
import { MODEL_SOURCE_SET_MAX_BYTES } from '@portfolio/project-model/units';
import { type FastifyInstance as FastifyInstance, type FastifyReply as FastifyReply, type FastifyRequest as FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import { errorBody, unauthorized, notFound, databaseFailure, sessionUserId, isJsonContentType, readDeclaredLength, createProjectWriteRequestSignal } from '../http.js';

import type { RouteDeps } from './deps.js';

export function registerModelRoutes(deps: RouteDeps): void {
	const { app, pool, sessionsEnabled, objectStore, objectNamespace, lifecyclePolicy } = deps;
	const requireModelSession = async (request: FastifyRequest, reply: FastifyReply) => {
		if (!sessionUserId(request, sessionsEnabled)) return unauthorized(reply);
	};

	app.post('/projects/:projectId/models/imports', { onRequest: requireModelSession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId)) return modelInputFailure(reply, new ModelInputError('invalid_model_import', 400, 'Invalid project ID'));
		try {
			if (!isJsonContentType(request.headers['content-type'])) {
				return modelInputFailure(reply, new ModelInputError('unsupported_media_type', 415, 'Unsupported Media Type'));
			}
			const imported = await createModelImport(pool, userId, projectId, request.body, objectStore);
			return reply.code(201).send(imported);
		} catch (error) {
			return modelFailure(app, reply, error, 'Model staging failed');
		}
	});

	app.put('/projects/:projectId/models/imports/:importId/files/:fileId/content', {
		onRequest: requireModelSession,
		handlerTimeout: lifecyclePolicy.handlerTimeoutMs
	}, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, importId, fileId } = request.params as { projectId?: unknown; importId?: unknown; fileId?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || !isValidAssetId(importId) || !isValidAssetId(fileId)) {
			return modelInputFailure(reply, new ModelInputError('invalid_model_file', 400, 'Invalid model file identifier'));
		}
		const contentLength = readModelUploadContentLength(request);
		if (contentLength instanceof ModelInputError) return modelInputFailure(reply, contentLength);
		if (!(request.body instanceof Readable)) {
			return modelInputFailure(reply, new ModelInputError('invalid_upload', 400, 'Invalid upload body'));
		}
		const requestDeadline = createProjectWriteRequestSignal(request, lifecyclePolicy.handlerTimeoutMs);
		try {
			return await uploadModelFile(
				pool,
				userId,
				projectId,
				importId,
				fileId,
				contentLength,
				request.body,
				objectStore,
				objectNamespace,
				{ parentSignal: requestDeadline.signal, policy: lifecyclePolicy }
			);
		} catch (error) {
			return modelFailure(app, reply, error, 'Model file upload failed');
		} finally {
			requestDeadline.dispose();
		}
	});

	app.delete('/projects/:projectId/models/imports/:importId', { onRequest: requireModelSession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, importId } = request.params as { projectId?: unknown; importId?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || !isValidAssetId(importId)) {
			return modelInputFailure(reply, new ModelInputError('invalid_model_file', 400, 'Invalid model import identifier'));
		}
		try {
			await cancelModelImport(pool, userId, projectId, importId, objectStore);
			return reply.code(204).send();
		} catch (error) {
			return modelFailure(app, reply, error, 'Model staging cancel failed');
		}
	});

	app.post('/projects/:projectId/models/imports/:importId/approve', {
		onRequest: requireModelSession,
		handlerTimeout: lifecyclePolicy.handlerTimeoutMs
	}, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, importId } = request.params as { projectId?: unknown; importId?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || !isValidAssetId(importId)) {
			return modelInputFailure(reply, new ModelInputError('invalid_model_file', 400, 'Invalid model import identifier'));
		}
		const requestDeadline = createProjectWriteRequestSignal(request, lifecyclePolicy.handlerTimeoutMs);
		try {
			if (!isJsonContentType(request.headers['content-type'])) {
				return modelInputFailure(reply, new ModelInputError('unsupported_media_type', 415, 'Unsupported Media Type'));
			}
			const revision = await approveModelImport(
				pool,
				userId,
				projectId,
				importId,
				request.body,
				objectStore,
				objectNamespace,
				{ parentSignal: requestDeadline.signal, policy: lifecyclePolicy }
			);
			return reply.code(200).send(revision);
		} catch (error) {
			return modelFailure(app, reply, error, 'Model approval failed');
		} finally {
			requestDeadline.dispose();
		}
	});

	// Approved bytes are immutable: the read is keyed by the derivative's hash and
	// is cacheable, so repeat loads in the editor and Preview hit the cache. It is
	// still owner-only and never a public delivery route.
	app.get('/projects/:projectId/models/content/:hash', { onRequest: requireModelSession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, hash } = request.params as { projectId?: unknown; hash?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || typeof hash !== 'string') {
			return notFound(reply);
		}
		try {
			const content = await readModelRevisionContent(pool, userId, projectId, hash);
			if (!objectStore) throw new Error('Object storage is unavailable');
			const stored = await objectStore.get(content.objectKey);
			if (!stored || stored.contentLength !== content.size) {
				return reply.code(503).send(errorBody('service_unavailable', 'Service Unavailable'));
			}
			reply
				.header('Content-Type', content.mime)
				.header('Content-Length', String(content.size))
				.header('ETag', `"${hash}"`)
				.header('Cache-Control', 'private, max-age=31536000, immutable');
			return reply.send(stored.body);
		} catch (error) {
			if (error instanceof ModelNotFoundError) return notFound(reply);
			return databaseFailure(app, reply, error, 'Model content failed');
		}
	});
}

function modelInputFailure(reply: FastifyReply, error: ModelInputError) {
	return reply.code(error.statusCode).send(errorBody(error.code, error.message));
}

function modelFailure(app: FastifyInstance, reply: FastifyReply, error: unknown, message: string) {
	if (error instanceof ModelInputError) return modelInputFailure(reply, error);
	if (error instanceof ModelNotFoundError) return notFound(reply);
	if (error instanceof ProjectNotFoundError) return notFound(reply);
	if (error instanceof ProjectWriteAbortedError) {
		if (reply.sent) return reply;
		return reply.code(409).send(errorBody('project-busy', 'The project write was stopped; retry after the project operation resolves'));
	}
	return databaseFailure(app, reply, error, message);
}

/** Model files have their own role bounds; only the route-level ceiling lives here. */
function readModelUploadContentLength(request: FastifyRequest): number | ModelInputError {
	const read = readDeclaredLength(request, MODEL_SOURCE_SET_MAX_BYTES);
	return typeof read === 'number' ? read : new ModelInputError(read.code, read.statusCode, read.message);
}
