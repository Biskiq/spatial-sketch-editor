import { AssetInputError, MAX_ASSET_BYTES } from './asset-persistence.js';
import { isSessionUserId } from './auth.js';
import { sanitizeDatabaseError } from './database.js';
import { ModelPinRefusalError } from './model-persistence.js';
import { ProjectWriteAbortedError } from './project-write-lease.js';
import { PublicationConflictError } from './publication-persistence.js';
import { SaveRefusalError } from './save-persistence.js';
import {
	type FastifyInstance as FastifyInstance,
	type FastifyReply as FastifyReply,
	type FastifyRequest as FastifyRequest,
} from 'fastify';

export function errorBody(code: string, message: string) {
	return { error: { code, message } };
}

export function unauthorized(reply: {
	code(statusCode: number): { send(body: unknown): unknown };
}) {
	return reply.code(401).send(errorBody('unauthorized', 'Unauthorized'));
}

export function notFound(reply: { code(statusCode: number): { send(body: unknown): unknown } }) {
	return reply.code(404).send(errorBody('not_found', 'Not Found'));
}

export function databaseFailure(
	app: FastifyInstance,
	reply: { code(statusCode: number): { send(body: unknown): unknown } },
	error: unknown,
	message: string,
) {
	app.log.warn({ database: sanitizeDatabaseError(error) }, message);
	return reply.code(503).send(errorBody('service_unavailable', 'Service Unavailable'));
}

export function sessionUserId(request: FastifyRequest, sessionsEnabled: boolean): string | null {
	if (!sessionsEnabled) return null;
	const userId = appSession(request).get('userId');
	return isSessionUserId(userId) ? userId : null;
}

export type AppSession = {
	get(key: string): unknown;
	set(key: string, value: unknown): void;
	regenerate(): void;
	delete(): void;
};

export function appSession(request: FastifyRequest): AppSession {
	return request.session as unknown as AppSession;
}

export function authUnavailable(reply: {
	code(statusCode: number): { send(body: unknown): unknown };
}) {
	return reply.code(503).send(errorBody('auth_unavailable', 'Authentication is unavailable'));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isJsonContentType(value: string | undefined): boolean {
	return value?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}

export function isOctetStream(value: string | undefined): boolean {
	return value?.split(';', 1)[0]?.trim().toLowerCase() === 'application/octet-stream';
}

export type DeclaredLengthRefusal = {
	readonly code:
		| 'length_required'
		| 'invalid_upload'
		| 'payload_too_large'
		| 'unsupported_media_type';
	readonly statusCode: 400 | 411 | 413 | 415;
	readonly message: string;
};

/**
 * The declared `Content-Length` an upload route accepts. Both upload families
 * share these refusals and differ only in their ceiling and their error type.
 */
export function readDeclaredLength(
	request: FastifyRequest,
	maxBytes: number,
): number | DeclaredLengthRefusal {
	if (!isOctetStream(request.headers['content-type'])) {
		return { code: 'unsupported_media_type', statusCode: 415, message: 'Unsupported Media Type' };
	}
	const value = request.headers['content-length'];
	if (typeof value !== 'string') {
		return { code: 'length_required', statusCode: 411, message: 'Content-Length is required' };
	}
	if (!/^\d+$/.test(value)) {
		return { code: 'invalid_upload', statusCode: 400, message: 'Invalid Content-Length' };
	}
	const declaredLength = BigInt(value);
	if (declaredLength === 0n) {
		return { code: 'invalid_upload', statusCode: 400, message: 'Invalid upload length' };
	}
	if (declaredLength > BigInt(maxBytes)) {
		return { code: 'payload_too_large', statusCode: 413, message: 'Payload Too Large' };
	}
	return Number(declaredLength);
}

export function readUploadContentLength(request: FastifyRequest): number | AssetInputError {
	const read = readDeclaredLength(request, MAX_ASSET_BYTES);
	return typeof read === 'number'
		? read
		: new AssetInputError(read.code, read.statusCode, read.message);
}

/**
 * Fastify's signal also aborts when Node emits `IncomingMessage.close` after a
 * normal streamed request body completes. Ignore that completion event while
 * preserving true client disconnects and the handler deadline; the local timer
 * covers the full route work even when Fastify clears its timer on raw close.
 */
export function createProjectWriteRequestSignal(
	request: FastifyRequest,
	timeoutMs: number,
): { signal: AbortSignal; dispose(): void } {
	const fastifySignal = request.signal;
	const controller = new AbortController();
	const onAbort = () => {
		const reason = fastifySignal.reason as { code?: unknown } | undefined;
		if (!request.raw.aborted && reason?.code !== 'FST_ERR_HANDLER_TIMEOUT') return;
		if (!controller.signal.aborted) {
			controller.abort(
				new ProjectWriteAbortedError(
					'The client disconnected or the request exceeded its handler deadline',
				),
			);
		}
	};
	fastifySignal.addEventListener('abort', onAbort);
	if (fastifySignal.aborted) onAbort();
	const timer = setTimeout(() => {
		if (!controller.signal.aborted) {
			controller.abort(new ProjectWriteAbortedError('The request exceeded its handler deadline'));
		}
	}, timeoutMs);
	return {
		signal: controller.signal,
		dispose() {
			clearTimeout(timer);
			fastifySignal.removeEventListener('abort', onAbort);
		},
	};
}

export function readExpectedPublicationRevision(value: unknown): number | null {
	if (!isRecord(value) || Object.keys(value).length !== 1) return null;
	const revision = value.expectedPublicationRevision;
	if (!Number.isSafeInteger(revision) || (revision as number) < 0) return null;
	return revision as number;
}

export function publicationConflict(
	reply: { code(statusCode: number): { send(body: unknown): unknown } },
	error: PublicationConflictError,
) {
	return reply.code(409).send({
		error: { code: 'revision_conflict', message: error.message },
		revision: error.revision,
	});
}

export function saveRefusal(
	reply: { code(statusCode: number): { send(body: unknown): unknown } },
	error: SaveRefusalError | ModelPinRefusalError,
) {
	if (error instanceof ModelPinRefusalError) {
		return reply.code(400).send({
			error: { code: error.code, message: error.message },
			...(error.issues.length > 0 ? { issues: error.issues } : {}),
		});
	}
	if (error.code === 'conflict') {
		// A conflict carries no remote contents; the client reloads explicitly.
		return reply.code(409).send(errorBody('conflict', error.message));
	}
	if (error.code === 'collision') {
		// Owner-blind: one answer for any existing ID, revealing nothing.
		return reply.code(409).send(errorBody('save_collision', error.message));
	}
	if (error.code === 'not-found') return notFound(reply);
	return reply.code(400).send({
		error: {
			code: error.code === 'invalid-project' ? 'invalid_project' : error.code,
			message: error.message,
		},
		...(error.issues.length > 0 ? { issues: error.issues } : {}),
	});
}

export function isUnconditionedDocumentBody(value: unknown): value is { document: unknown } {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.keys(value).length === 1 &&
		Object.hasOwn(value, 'document')
	);
}

export function assetInputFailure(reply: FastifyReply, error: AssetInputError) {
	return reply.code(error.statusCode).send(errorBody(error.code, error.message));
}
