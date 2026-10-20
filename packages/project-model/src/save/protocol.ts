/**
 * `SaveAcceptedSource@1` — the conditional Save capture (AM-4,
 * `F4.intent-acceptance@1:conditional-save-current-v1`, T3.P01.S02).
 *
 * The protocol is runtime-safe and lives on its own package subpath so the API,
 * the editor client and conformance tests share one shape without a root-barrel
 * dependency. It owns **the capture**, the receipt/refusal vocabulary and the
 * durable saved-base token form. It deliberately does not own:
 *
 * - source validation or admission — the live F.2 unit Save handler owns both,
 *   so Save cannot become a second validator;
 * - the content-identity implementation — the digest comes from the live source
 *   provider, and its **scheme** travels as transport metadata outside the
 *   capture. Keeping the scheme constant here, pinned by a golden-digest test,
 *   makes a canonicalization change fail loudly instead of silently turning
 *   every Save into a false conflict or false match.
 *
 * The capture carries the full canonical source **text**. That is deliberate:
 * equal digests do not prove equal bytes, and retry identity / dirty comparison
 * need the full bytes. The server re-parses and re-canonicalizes them through
 * the live unit source provider before admitting anything.
 */

import { sha256Bytes } from '../package-sha';
import { validateAcceptedRevision } from '../references/validate';
import type { AcceptedRevision } from '../references/types';
import { ShapeReader, type ShapeIssue } from '../strict-shape';

/** The exact capture version this module implements. */
export const SAVE_ACCEPTED_SOURCE_VERSION = 'SaveAcceptedSource@1' as const;

/**
 * The content-identity scheme this build produces. Transport metadata, never a
 * capture field: a server and a client that disagree here refuse explicitly
 * (`identity-scheme-mismatch`) instead of comparing hashes from two different
 * canonicalizations. Bump it only with the canonicalization it names.
 */
export const SAVE_CONTENT_IDENTITY_SCHEME = 'project-model/canonical-authored-json@1' as const;

/** The durable saved-base token prefix. Tokens are opaque to the client. */
export const SAVED_BASE_TOKEN_PREFIX = 'saved-base:';

const SAVED_BASE_TOKEN_PATTERN = /^saved-base:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SOURCE_CONTENT_ID_PATTERN = /^sha256-[0-9a-f]{64}$/;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/;

/**
 * The condition one Save states. `create-only` lets a new project be created and
 * refuses any existing ID; `expected-saved-base` names the exact durable base
 * the client believes it is updating.
 */
export type SavePrecondition =
	| { readonly kind: 'create-only' }
	| { readonly kind: 'expected-saved-base'; readonly token: string };

/**
 * One immutable locally accepted source, captured for persistence.
 *
 * `acceptedRevision` is the local acceptance identity (never the cloud saved
 * base), `sourceContentId` the cursor-excluded content digest, and
 * `canonicalJson` the full canonical source text the digest was derived from.
 */
export type SaveAcceptedSource = {
	readonly protocol: typeof SAVE_ACCEPTED_SOURCE_VERSION;
	readonly projectId: string;
	readonly operationId: string;
	readonly precondition: SavePrecondition;
	readonly sourceKind: string;
	readonly sourceVersion: number;
	readonly acceptedRevision: AcceptedRevision;
	readonly sourceContentId: string;
	readonly canonicalJson: string;
};

/**
 * One wire request: the capture plus the transport-only scheme. The scheme is
 * outside `SaveAcceptedSource@1` so the ratified AM-4 capture shape is not
 * extended by a build fact.
 */
export type SaveRequest = {
	readonly contentIdentityScheme: string;
	readonly capture: SaveAcceptedSource;
};

/** The durable answer to one applied Save (also the replay of its receipt). */
export type SaveAcknowledgement = {
	readonly projectId: string;
	readonly name: string;
	readonly version: number;
	readonly updatedAt: string;
	/** The fresh durable saved base this save installed. */
	readonly savedBaseToken: string;
	/** The captured local acceptance revision, persisted beside the document. */
	readonly savedRevision: AcceptedRevision;
	/** The recomputed content digest of the persisted source. */
	readonly sourceContentId: string;
};

/**
 * One operation receipt. It binds the operation ID to the full canonical bytes
 * (`fullSourceHash`, which retains the cursor) and the precondition, so an
 * identical retry replays it and a changed payload under the same ID refuses.
 * Receipts never enter the authored document and are visible only to the owner.
 */
export type SaveReceipt = {
	readonly projectId: string;
	readonly operationId: string;
	readonly precondition: SavePrecondition;
	readonly acceptedRevision: AcceptedRevision;
	readonly sourceContentId: string;
	readonly fullSourceHash: string;
	readonly version: number;
	readonly savedBaseToken: string;
	/** The saved document's name and timestamp, replayed with the receipt. */
	readonly name: string;
	readonly savedAt: string;
};

/**
 * Typed refusals. `conflict` carries no remote contents; `collision` is the one
 * owner-blind `create-only` answer; every refusal writes nothing.
 */
export type SaveRefusalCode =
	| 'unconditioned-body'
	| 'invalid-save-request'
	| 'identity-scheme-mismatch'
	| 'source-version-mismatch'
	| 'content-identity-mismatch'
	| 'revision-reuse'
	| 'retry-payload-mismatch'
	| 'conflict'
	| 'collision'
	| 'not-found'
	| 'invalid-project';

export type SaveRefusal = {
	readonly code: SaveRefusalCode;
	readonly message: string;
	readonly issues?: readonly ShapeIssue[];
};

export type SaveRequestValidation =
	| { readonly kind: 'valid'; readonly request: SaveRequest }
	| { readonly kind: 'invalid'; readonly issues: readonly ShapeIssue[] };

/** A saved-base token is durable opaque metadata, never a revision or SQL version. */
export function isSavedBaseToken(value: unknown): value is string {
	return typeof value === 'string' && SAVED_BASE_TOKEN_PATTERN.test(value);
}

/** Mint one durable saved-base token. The caller supplies randomness. */
export function createSavedBaseToken(randomUUID: () => string = () => globalThis.crypto.randomUUID()): string {
	return `${SAVED_BASE_TOKEN_PREFIX}${randomUUID()}`;
}

/**
 * The full-source hash: SHA-256 over the canonical source **text**, cursor
 * included. Distinct from `sourceContentId` (which excludes the cursor) and the
 * value retry identity binds, so a cursor-only divergence is never a retry hit.
 */
export async function fullSourceHash(canonicalJson: string): Promise<string> {
	return sha256Bytes(new TextEncoder().encode(canonicalJson));
}

/** Equality for preconditions, keeping the token out of `create-only`. */
export function samePrecondition(a: SavePrecondition, b: SavePrecondition): boolean {
	if (a.kind === 'create-only' && b.kind === 'create-only') return true;
	if (a.kind === 'expected-saved-base' && b.kind === 'expected-saved-base') return a.token === b.token;
	return false;
}

/** Equality for opaque accepted revisions; equality only, never a currency inference. */
export function sameAcceptedRevision(a: AcceptedRevision, b: AcceptedRevision): boolean {
	return a.projectId === b.projectId && a.revisionId === b.revisionId;
}

/**
 * Strictly read one Save request. Unknown keys, a non-object body, a malformed
 * token, a non-canonical digest form or a project/revision id disagreement are
 * all invalid. The scheme's *value* is checked by the server (so a mismatch has
 * its own refusal), but it must be present and nonempty here.
 */
export function readSaveRequest(input: unknown): SaveRequestValidation {
	const reader = new ShapeReader();
	const outer = reader.object(input, '$', ['contentIdentityScheme', 'capture']);
	if (outer === null) return { kind: 'invalid', issues: reader.issues };
	const contentIdentityScheme = reader.string(outer.contentIdentityScheme, '$.contentIdentityScheme');
	const captureRecord = reader.object(outer.capture, '$.capture', [
		'protocol',
		'projectId',
		'operationId',
		'precondition',
		'sourceKind',
		'sourceVersion',
		'acceptedRevision',
		'sourceContentId',
		'canonicalJson'
	]);
	if (captureRecord === null) return { kind: 'invalid', issues: reader.issues };

	if (captureRecord.protocol !== SAVE_ACCEPTED_SOURCE_VERSION) {
		reader.problem('$.capture.protocol', 'unsupported-version', `Expected ${SAVE_ACCEPTED_SOURCE_VERSION}`);
	}
	const projectId = reader.opaqueId(captureRecord.projectId, '$.capture.projectId');
	const operationId = readOperationId(reader, captureRecord.operationId);
	const precondition = readPrecondition(reader, captureRecord.precondition);
	const sourceKind = reader.string(captureRecord.sourceKind, '$.capture.sourceKind');
	const sourceVersion = readSafeInteger(reader, captureRecord.sourceVersion, '$.capture.sourceVersion');
	const revision = validateAcceptedRevision(captureRecord.acceptedRevision);
	if (!revision.success) {
		for (const issue of revision.issues) {
			reader.problem(`$.capture.acceptedRevision${issue.path.slice(1)}`, issue.code, issue.message);
		}
	}
	const sourceContentId = readPattern(
		reader,
		captureRecord.sourceContentId,
		'$.capture.sourceContentId',
		SOURCE_CONTENT_ID_PATTERN,
		'a sha256 digest'
	);
	const canonicalJson = readCanonicalJson(reader, captureRecord.canonicalJson);

	if (
		projectId !== null &&
		revision.success &&
		revision.value.projectId !== projectId
	) {
		reader.problem(
			'$.capture.acceptedRevision.projectId',
			'project-mismatch',
			'The accepted revision must belong to the captured project'
		);
	}

	if (
		reader.issues.length > 0 ||
		contentIdentityScheme === null ||
		projectId === null ||
		operationId === null ||
		precondition === null ||
		sourceKind === null ||
		sourceVersion === null ||
		!revision.success ||
		sourceContentId === null ||
		canonicalJson === null
	) {
		return { kind: 'invalid', issues: reader.issues };
	}

	return {
		kind: 'valid',
		request: {
			contentIdentityScheme,
			capture: {
				protocol: SAVE_ACCEPTED_SOURCE_VERSION,
				projectId,
				operationId,
				precondition,
				sourceKind,
				sourceVersion,
				acceptedRevision: revision.value,
				sourceContentId,
				canonicalJson
			}
		}
	};
}

function readOperationId(reader: ShapeReader, value: unknown): string | null {
	const id = reader.string(value, '$.capture.operationId');
	if (id !== null && !OPERATION_ID_PATTERN.test(id)) {
		reader.problem('$.capture.operationId', 'invalid-operation-id', 'The operation ID must be a stable printable id');
		return null;
	}
	return id;
}

function readPrecondition(reader: ShapeReader, value: unknown): SavePrecondition | null {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		reader.problem('$.capture.precondition', 'not-an-object', 'The precondition must be an object');
		return null;
	}
	const kind = (value as Record<string, unknown>).kind;
	if (kind === 'create-only') {
		const record = reader.object(value, '$.capture.precondition', ['kind']);
		return record === null ? null : { kind: 'create-only' };
	}
	if (kind === 'expected-saved-base') {
		const record = reader.object(value, '$.capture.precondition', ['kind', 'token']);
		if (record === null) return null;
		const token = record.token;
		if (!isSavedBaseToken(token)) {
			reader.problem(
				'$.capture.precondition.token',
				'invalid-saved-base-token',
				'The saved-base token must be a durable token issued by a prior Save'
			);
			return null;
		}
		return { kind: 'expected-saved-base', token };
	}
	reader.problem('$.capture.precondition.kind', 'unsupported-precondition', 'Expected create-only or expected-saved-base');
	return null;
}

function readSafeInteger(reader: ShapeReader, value: unknown, path: string): number | null {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
		reader.problem(path, 'invalid-integer', `${path} must be a positive safe integer`);
		return null;
	}
	return value;
}

function readPattern(
	reader: ShapeReader,
	value: unknown,
	path: string,
	pattern: RegExp,
	description: string
): string | null {
	if (typeof value !== 'string' || !pattern.test(value)) {
		reader.problem(path, 'invalid-identity', `${path} must be ${description}`);
		return null;
	}
	return value;
}

function readCanonicalJson(reader: ShapeReader, value: unknown): string | null {
	if (typeof value !== 'string' || value.length === 0) {
		reader.problem('$.capture.canonicalJson', 'invalid-source-bytes', 'The captured source must be canonical JSON text');
		return null;
	}
	return value;
}
