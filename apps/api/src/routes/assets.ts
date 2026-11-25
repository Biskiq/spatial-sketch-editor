import { assetMetadata, AssetInputError, AssetNotFoundError, AssetNotReadyError, isValidAssetId, isValidProjectId, listAssets, readAsset, readAssetNameBody, registerAsset, uploadAsset } from '../asset-persistence.js';
import { expireAbandonedImageRepairs, ImageRepairError, readImageRepairRequest, repairProjectImage } from '../image-repair.js';
import { ProjectNotFoundError } from '../project-persistence.js';
import { ProjectWriteAbortedError } from '../project-write-lease.js';
import { type FastifyInstance as FastifyInstance, type FastifyReply as FastifyReply, type FastifyRequest as FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import { errorBody, unauthorized, notFound, databaseFailure, sessionUserId, isJsonContentType, readUploadContentLength, createProjectWriteRequestSignal, assetInputFailure } from '../http.js';

import type { RouteDeps } from './deps.js';

export function registerAssetRoutes(deps: RouteDeps): void {
	const { app, pool, sessionsEnabled, objectStore, objectNamespace, lifecyclePolicy } = deps;
	const requireAssetSession = async (request: FastifyRequest, reply: FastifyReply) => {
		if (!sessionUserId(request, sessionsEnabled)) return unauthorized(reply);
	};

	const requireAssetUpload = async (request: FastifyRequest, reply: FastifyReply) => {
		if (!sessionUserId(request, sessionsEnabled)) return unauthorized(reply);
		const { projectId, assetId } = request.params as { projectId?: unknown; assetId?: unknown };
		if (!isValidProjectId(projectId) || !isValidAssetId(assetId)) {
			return assetInputFailure(reply, new AssetInputError('invalid_asset', 400, 'Invalid asset identifier'));
		}
		const contentLength = readUploadContentLength(request);
		if (contentLength instanceof AssetInputError) return assetInputFailure(reply, contentLength);
	};

	app.get('/projects/:projectId/assets', { onRequest: requireAssetSession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId)) return assetInputFailure(reply, new AssetInputError('invalid_asset', 400, 'Invalid project ID'));
		// The scoped asset access is the repair-attempt sweep point: an expired
		// attempt is claimed first and its staging key is removed once no ready row
		// names it. This is the existing model-staging pattern, not a background
		// worker.
		try {
			await expireAbandonedImageRepairs(pool, objectStore, projectId, userId);
		} catch {
			// Cleanup never blocks reading the project's live assets.
		}
		try {
			return { assets: await listAssets(pool, userId, projectId) };
		} catch (error) {
			return assetFailure(app, reply, error, 'Asset list failed');
		}
	});

	app.post('/projects/:projectId/assets', { onRequest: requireAssetSession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const projectId = (request.params as { projectId?: unknown }).projectId;
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId)) return assetInputFailure(reply, new AssetInputError('invalid_asset', 400, 'Invalid project ID'));
		try {
			if (!isJsonContentType(request.headers['content-type'])) {
				return assetInputFailure(reply, new AssetInputError('unsupported_media_type', 415, 'Unsupported Media Type'));
			}
			const name = readAssetNameBody(request.body);
			const asset = await registerAsset(pool, userId, projectId, name, objectNamespace);
			return reply.code(201).send(asset);
		} catch (error) {
			return assetFailure(app, reply, error, 'Asset registration failed');
		}
	});

	app.get('/projects/:projectId/assets/:assetId', { onRequest: requireAssetSession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, assetId } = request.params as { projectId?: unknown; assetId?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || !isValidAssetId(assetId)) {
			return assetInputFailure(reply, new AssetInputError('invalid_asset', 400, 'Invalid asset identifier'));
		}
		try {
			return assetMetadata(await readAsset(pool, userId, projectId, assetId));
		} catch (error) {
			return assetFailure(app, reply, error, 'Asset read failed');
		}
	});

	app.put('/projects/:projectId/assets/:assetId/content', {
		onRequest: requireAssetUpload,
		handlerTimeout: lifecyclePolicy.handlerTimeoutMs
	}, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, assetId } = request.params as { projectId?: unknown; assetId?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || !isValidAssetId(assetId)) {
			return assetInputFailure(reply, new AssetInputError('invalid_asset', 400, 'Invalid asset identifier'));
		}
		const contentLength = readUploadContentLength(request);
		if (contentLength instanceof AssetInputError) return assetInputFailure(reply, contentLength);
		if (!(request.body instanceof Readable)) {
			return assetInputFailure(reply, new AssetInputError('invalid_upload', 400, 'Invalid upload body'));
		}
		const requestDeadline = createProjectWriteRequestSignal(request, lifecyclePolicy.handlerTimeoutMs);
		try {
			return await uploadAsset(
				pool,
				userId,
				projectId,
				assetId,
				contentLength,
				request.body,
				objectStore,
				objectNamespace,
				{ parentSignal: requestDeadline.signal, policy: lifecyclePolicy }
			);
		} catch (error) {
			return assetFailure(app, reply, error, 'Asset upload failed');
		} finally {
			requestDeadline.dispose();
		}
	});

	// Exact-byte recovery for an existing saved image. The request carries only
	// the original bytes and the two facts the editor displayed (the pin and the
	// loaded saved base); the server derives everything else from the saved head.
	app.put('/projects/:projectId/assets/:assetId/repair', {
		onRequest: requireAssetUpload,
		handlerTimeout: lifecyclePolicy.handlerTimeoutMs
	}, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, assetId } = request.params as { projectId?: unknown; assetId?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || !isValidAssetId(assetId)) {
			return assetInputFailure(reply, new AssetInputError('invalid_asset', 400, 'Invalid asset identifier'));
		}
		const parsed = readImageRepairRequest(request.query);
		if (parsed instanceof ImageRepairError) {
			return reply.code(parsed.statusCode).send(errorBody(parsed.code, parsed.message));
		}
		const contentLength = readUploadContentLength(request);
		if (contentLength instanceof AssetInputError) return assetInputFailure(reply, contentLength);
		if (!(request.body instanceof Readable)) {
			return assetInputFailure(reply, new AssetInputError('invalid_upload', 400, 'Invalid upload body'));
		}
		const requestDeadline = createProjectWriteRequestSignal(request, lifecyclePolicy.handlerTimeoutMs);
		try {
			return await repairProjectImage(
				pool,
				userId,
				projectId,
				assetId,
				parsed,
				contentLength,
				request.body,
				objectStore,
				objectNamespace,
				{ parentSignal: requestDeadline.signal, policy: lifecyclePolicy }
			);
		} catch (error) {
			return imageRepairFailure(app, reply, error);
		} finally {
			requestDeadline.dispose();
		}
	});

	app.get('/projects/:projectId/assets/:assetId/content', { onRequest: requireAssetSession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		const { projectId, assetId } = request.params as { projectId?: unknown; assetId?: unknown };
		if (!userId) return unauthorized(reply);
		if (!isValidProjectId(projectId) || !isValidAssetId(assetId)) {
			return assetInputFailure(reply, new AssetInputError('invalid_asset', 400, 'Invalid asset identifier'));
		}
		try {
			const asset = await readAsset(pool, userId, projectId, assetId);
			if (asset.importState !== 'ready') throw new AssetNotReadyError();
			if (asset.storageKind !== 'r2' || asset.objectKey === null) throw new AssetNotReadyError();
			if (asset.mime === null || asset.byteSize === null) {
				return databaseFailure(app, reply, new Error('Ready asset metadata is incomplete'), 'Asset bytes failed');
			}
			if (!objectStore) throw new Error('Object storage is unavailable');
			const stored = await objectStore.get(asset.objectKey);
			if (!stored || stored.contentLength !== asset.byteSize) {
				return reply.code(503).send(errorBody('service_unavailable', 'Service Unavailable'));
			}
			reply
				.header('Content-Type', asset.mime)
				.header('Content-Length', String(asset.byteSize))
				.header('Cache-Control', 'private, no-store');
			return reply.send(stored.body);
		} catch (error) {
			return assetFailure(app, reply, error, 'Asset bytes failed');
		}
	});
}

function assetFailure(app: FastifyInstance, reply: FastifyReply, error: unknown, message: string) {
	if (error instanceof AssetInputError) return assetInputFailure(reply, error);
	if (error instanceof AssetNotFoundError) return notFound(reply);
	if (error instanceof ProjectNotFoundError) return notFound(reply);
	if (error instanceof AssetNotReadyError) {
		return reply.code(409).send(errorBody('asset_not_ready', 'Asset Not Ready'));
	}
	if (error instanceof ProjectWriteAbortedError) {
		if (reply.sent) return reply;
		return reply.code(409).send(errorBody('project-busy', 'The project write was stopped; retry after the project operation resolves'));
	}
	return databaseFailure(app, reply, error, message);
}

function imageRepairFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
	if (error instanceof ImageRepairError) {
		return reply.code(error.statusCode).send(errorBody(error.code, error.message));
	}
	if (error instanceof ProjectNotFoundError) return notFound(reply);
	if (error instanceof ProjectWriteAbortedError) {
		if (reply.sent) return reply;
		return reply.code(409).send(errorBody('project-busy', 'The project write was stopped; retry after the project operation resolves'));
	}
	return databaseFailure(app, reply, error, 'Image repair failed');
}
