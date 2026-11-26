import { AssetInputError } from '../asset-persistence.js';
import {
	FormLibraryInputError,
	FormLibraryNotFoundError,
	expireAbandonedLibraryStaging,
	listLibraryItems,
	readLibraryItem,
	readMaterialLibraryThumbnail,
	removeFormLibraryItem,
	saveFormLibraryItem,
	saveMaterialLibraryItem,
	saveMaterialLibraryThumbnail,
	transferMaterialLibraryItem,
} from '../form-library/index.js';
import { ProjectNotFoundError } from '../project-persistence.js';
import { ProjectWriteAbortedError } from '../project-write-lease.js';
import {
	type FastifyInstance as FastifyInstance,
	type FastifyReply as FastifyReply,
	type FastifyRequest as FastifyRequest,
} from 'fastify';
import { Readable } from 'node:stream';
import {
	errorBody,
	unauthorized,
	notFound,
	databaseFailure,
	sessionUserId,
	isJsonContentType,
	readUploadContentLength,
	createProjectWriteRequestSignal,
	assetInputFailure,
} from '../http.js';

import type { RouteDeps } from './deps.js';

export function registerLibraryRoutes(deps: RouteDeps): void {
	const { app, pool, sessionsEnabled, objectStore, objectNamespace, lifecyclePolicy } = deps;
	const requireLibrarySession = async (request: FastifyRequest, reply: FastifyReply) => {
		if (!sessionUserId(request, sessionsEnabled)) return unauthorized(reply);
	};

	app.get('/library/items', { onRequest: requireLibrarySession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		const rawKind = (request.query as { kind?: unknown }).kind;
		if (
			rawKind !== undefined &&
			rawKind !== 'form' &&
			rawKind !== 'material' &&
			rawKind !== 'all'
		) {
			return reply
				.code(400)
				.send(errorBody('invalid_library_item', 'Expected kind=form, material or all'));
		}
		try {
			await expireAbandonedLibraryStaging(pool, objectStore, userId);
		} catch {
			// Cleanup never blocks a list.
		}
		try {
			// Owner names and ids are as private as the bytes; never let a browser
			// retain them across a sign-out or owner switch.
			reply.header('Cache-Control', 'private, no-store');
			return { items: await listLibraryItems(pool, userId, rawKind ?? 'form') };
		} catch (error) {
			return libraryFailure(app, reply, error, 'Library list failed');
		}
	});

	app.post('/library/items', { onRequest: requireLibrarySession }, async (request, reply) => {
		const userId = sessionUserId(request, sessionsEnabled);
		if (!userId) return unauthorized(reply);
		try {
			if (!isJsonContentType(request.headers['content-type'])) {
				return reply.code(415).send(errorBody('unsupported_media_type', 'Unsupported Media Type'));
			}
			const body = request.body;
			const material =
				typeof body === 'object' &&
				body !== null &&
				!Array.isArray(body) &&
				typeof (body as { payload?: unknown }).payload === 'object' &&
				(body as { payload?: { kind?: unknown } }).payload?.kind === 'material';
			return reply
				.code(201)
				.send(
					material
						? await saveMaterialLibraryItem(pool, userId, body, objectStore, objectNamespace)
						: await saveFormLibraryItem(pool, userId, body),
				);
		} catch (error) {
			return libraryFailure(app, reply, error, 'Library save failed');
		}
	});

	app.get(
		'/library/items/:itemId',
		{ onRequest: requireLibrarySession },
		async (request, reply) => {
			const userId = sessionUserId(request, sessionsEnabled);
			const itemId = (request.params as { itemId?: unknown }).itemId;
			if (!userId) return unauthorized(reply);
			if (!isValidLibraryItemId(itemId)) return notFound(reply);
			try {
				await expireAbandonedLibraryStaging(pool, objectStore, userId);
			} catch {
				// Cleanup never blocks a read.
			}
			try {
				const { summary, bytes } = await readLibraryItem(pool, userId, itemId);
				return (
					reply
						.header('Content-Type', 'application/json; charset=utf-8')
						.header('Content-Length', String(bytes.byteLength))
						.header('ETag', `"${summary.contentId}"`)
						.header('X-Library-Format-Version', String(summary.formatVersion))
						.header('X-Library-Kind', summary.kind)
						// Owner-scoped bytes are never a shared or long-lived browser cache:
						// Remove must be immediate, and a later session must re-authorize rather
						// than read a previous owner's item from disk.
						.header('Cache-Control', 'private, no-store')
						.send(Buffer.from(bytes))
				);
			} catch (error) {
				return libraryFailure(app, reply, error, 'Library read failed');
			}
		},
	);

	app.delete(
		'/library/items/:itemId',
		{ onRequest: requireLibrarySession },
		async (request, reply) => {
			const userId = sessionUserId(request, sessionsEnabled);
			const itemId = (request.params as { itemId?: unknown }).itemId;
			if (!userId) return unauthorized(reply);
			if (!isValidLibraryItemId(itemId)) return notFound(reply);
			try {
				await removeFormLibraryItem(pool, userId, itemId, objectStore);
				return reply.code(204).send();
			} catch (error) {
				return libraryFailure(app, reply, error, 'Library remove failed');
			}
		},
	);

	// The optional fixed thumbnail derivative. It is always private owner data,
	// never a shared cache entry; a missing derivative is an honest 404 and the
	// item remains usable with the swatch fallback.
	app.get(
		'/library/items/:itemId/thumbnail',
		{ onRequest: requireLibrarySession },
		async (request, reply) => {
			const userId = sessionUserId(request, sessionsEnabled);
			const itemId = (request.params as { itemId?: unknown }).itemId;
			if (!userId) return unauthorized(reply);
			if (!isValidLibraryItemId(itemId)) return notFound(reply);
			try {
				const thumbnail = await readMaterialLibraryThumbnail(pool, userId, itemId, objectStore);
				return reply
					.header('Content-Type', 'image/png')
					.header('Content-Length', String(thumbnail.byteSize))
					.header('Cache-Control', 'private, no-store')
					.send(thumbnail.body);
			} catch (error) {
				return libraryFailure(app, reply, error, 'Library thumbnail read failed');
			}
		},
	);

	app.put(
		'/library/items/:itemId/thumbnail',
		{
			onRequest: requireLibrarySession,
			handlerTimeout: lifecyclePolicy.handlerTimeoutMs,
		},
		async (request, reply) => {
			const userId = sessionUserId(request, sessionsEnabled);
			const itemId = (request.params as { itemId?: unknown }).itemId;
			if (!userId) return unauthorized(reply);
			if (!isValidLibraryItemId(itemId)) return notFound(reply);
			const query = request.query as { expectedContentId?: unknown; recipeKey?: unknown };
			if (
				typeof query.expectedContentId !== 'string' ||
				!/^sha256-[0-9a-f]{64}$/.test(query.expectedContentId) ||
				typeof query.recipeKey !== 'string' ||
				!/^sha256-[0-9a-f]{64}$/.test(query.recipeKey)
			) {
				return reply
					.code(400)
					.send(
						errorBody(
							'invalid_library_item',
							'Expected expectedContentId and recipeKey pinning the item revision',
						),
					);
			}
			const contentType = String(request.headers['content-type'] ?? '')
				.split(';', 1)[0]
				?.trim()
				.toLowerCase();
			if (contentType !== 'application/octet-stream') {
				return reply.code(415).send(errorBody('unsupported_media_type', 'Unsupported Media Type'));
			}
			const contentLength = readUploadContentLength(request);
			if (contentLength instanceof AssetInputError) return assetInputFailure(reply, contentLength);
			if (!(request.body instanceof Readable) && !Buffer.isBuffer(request.body)) {
				return reply.code(400).send(errorBody('invalid_upload', 'Invalid upload body'));
			}
			if (contentLength > 256 * 1024) {
				return reply.code(413).send(errorBody('payload_too_large', 'Payload Too Large'));
			}
			const bytes = new Uint8Array(contentLength);
			if (Buffer.isBuffer(request.body)) {
				if (request.body.length !== contentLength) {
					return reply
						.code(400)
						.send(errorBody('invalid_upload', 'Upload length does not match Content-Length'));
				}
				bytes.set(request.body);
			} else {
				let offset = 0;
				try {
					for await (const chunk of request.body) {
						const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
						if (offset + buffer.length > bytes.length) {
							return reply
								.code(400)
								.send(errorBody('invalid_upload', 'Upload length does not match Content-Length'));
						}
						bytes.set(buffer, offset);
						offset += buffer.length;
					}
				} catch {
					return reply.code(400).send(errorBody('invalid_upload', 'Upload stream failed'));
				}
				if (offset !== contentLength) {
					return reply
						.code(400)
						.send(errorBody('invalid_upload', 'Upload length does not match Content-Length'));
				}
			}
			try {
				await saveMaterialLibraryThumbnail(pool, userId, itemId, bytes, {
					expectedContentId: query.expectedContentId,
					recipeKey: query.recipeKey,
					objectStore,
					objectNamespace,
				});
				return reply.code(204).send();
			} catch (error) {
				return libraryFailure(app, reply, error, 'Library thumbnail save failed');
			}
		},
	);

	app.post(
		'/library/items/:itemId/transfers',
		{
			onRequest: requireLibrarySession,
			handlerTimeout: lifecyclePolicy.handlerTimeoutMs,
		},
		async (request, reply) => {
			const userId = sessionUserId(request, sessionsEnabled);
			const itemId = (request.params as { itemId?: unknown }).itemId;
			if (!userId) return unauthorized(reply);
			if (!isValidLibraryItemId(itemId)) return notFound(reply);
			const requestDeadline = createProjectWriteRequestSignal(
				request,
				lifecyclePolicy.handlerTimeoutMs,
			);
			try {
				if (!isJsonContentType(request.headers['content-type'])) {
					return reply
						.code(415)
						.send(errorBody('unsupported_media_type', 'Unsupported Media Type'));
				}
				reply.header('Cache-Control', 'private, no-store');
				return await transferMaterialLibraryItem(
					pool,
					userId,
					itemId,
					request.body,
					objectStore,
					objectNamespace,
					{
						signal: requestDeadline.signal,
						policy: lifecyclePolicy,
					},
				);
			} catch (error) {
				return libraryFailure(app, reply, error, 'Library transfer failed');
			} finally {
				requestDeadline.dispose();
			}
		},
	);
}

function libraryFailure(
	app: FastifyInstance,
	reply: FastifyReply,
	error: unknown,
	message: string,
) {
	if (error instanceof FormLibraryInputError) {
		return reply.code(error.statusCode).send(errorBody(error.code, error.message));
	}
	if (error instanceof FormLibraryNotFoundError) return notFound(reply);
	if (error instanceof ProjectNotFoundError) return notFound(reply);
	if (error instanceof ProjectWriteAbortedError) {
		if (reply.sent) return reply;
		return reply
			.code(409)
			.send(
				errorBody(
					'project-busy',
					'The project write was stopped; retry after the project operation resolves',
				),
			);
	}
	return databaseFailure(app, reply, error, message);
}

function isValidLibraryItemId(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
	);
}
