/**
 * The Save **source-admission seam** — one conditional Save protocol, several
 * admitted source formats.
 *
 * `SaveAcceptedSource@1` already carries `sourceKind`/`sourceVersion` and the
 * canonical source text. `T3.P01.S04` admits exactly one live source — the F.2
 * envelope — without turning Save into a dispatcher that trusts the client: a
 * handler decides whether the captured bytes are a source **its own codec**
 * accepts, and the generic persistence path keeps the saved-base token,
 * receipts, row lock and one-transaction write exactly as
 * `conditional-save-current-v1` established them.
 *
 * The handler lives outside this module on purpose. The unit handler is the F.2
 * subpath's; this module only states the seam and its result vocabulary, so
 * `save/**` never imports the unit envelope.
 *
 * Runtime-safe: types and one lookup, no IO, no editor, no F.2 import.
 */

import type { ShapeIssue } from '../strict-shape';
import type { SaveAcceptedSource, SaveRefusalCode } from './protocol';

/** The one refusal shape a handler returns; the route maps `code` to HTTP. */
export type SaveSourceRefusal = {
	readonly kind: 'refused';
	readonly code: SaveRefusalCode;
	readonly message: string;
	readonly issues?: readonly ShapeIssue[];
};

/** A captured source the handler has canonicalized and identified. */
export type PreparedSaveSource = {
	/** The canonical source text the digest is derived from. */
	readonly canonicalJson: string;
	/** The stored document (the version row's `document` column). */
	readonly document: unknown;
	readonly projectId: string;
	readonly name: string;
	/** The content identity recomputed from `canonicalJson`. */
	readonly sourceContentId: string;
	/** `fullSourceHash(canonicalJson)`: retry identity, cursor included. */
	readonly fullSourceHash: string;
};

export type SaveSourcePreparation = { readonly kind: 'prepared'; readonly source: PreparedSaveSource } | SaveSourceRefusal;

/**
 * The minimal query surface a handler may use for a baseline. The API supplies
 * its pooled client; a handler that needs no baseline ignores it.
 */
export type SaveSourceDatabase = {
	query(sql: string, params?: unknown[]): Promise<{ rows?: unknown[] }>;
};

export type SaveSourceAdmissionInput = {
	readonly capture: SaveAcceptedSource;
	readonly prepared: PreparedSaveSource;
	/** Blocking issues the expected saved base already carried. */
	readonly baseline: readonly { readonly path: string; readonly code: string; readonly message: string }[];
};

/**
 * One admitted source format.
 *
 * - `prepare` runs **before** the row lock: it parses, canonicalizes and
 *   identifies the captured bytes, and refuses a capture that is not the
 *   canonical encoding of its own contents. It performs no write.
 * - `baseline` runs **inside** the transaction for formats whose admission is
 *   baseline-relative. A format with no such baseline returns `[]`.
 * - `validate` runs inside the transaction and is the format's full admission.
 *   It must re-derive what it checks from `capture`, never trust `prepared`.
 */
export type SaveSourceHandler = {
	readonly sourceKind: string;
	readonly sourceVersion: number;
	prepare(capture: SaveAcceptedSource): Promise<SaveSourcePreparation>;
	validate(input: SaveSourceAdmissionInput): Promise<SaveSourcePreparation>;
	baseline?(db: SaveSourceDatabase, projectId: string, version: number): Promise<readonly { readonly path: string; readonly code: string; readonly message: string }[]>;
};

/** Resolve exactly one handler for a capture's declared source, or refuse. */
export function resolveSaveSourceHandler(
	handlers: readonly SaveSourceHandler[],
	capture: SaveAcceptedSource
):
	| { readonly kind: 'resolved'; readonly handler: SaveSourceHandler }
	| { readonly kind: 'refused'; readonly code: SaveRefusalCode; readonly message: string } {
	const handler = handlers.find(
		(candidate) => candidate.sourceKind === capture.sourceKind && candidate.sourceVersion === capture.sourceVersion
	);
	if (handler === undefined) {
		const admitted = handlers.map((candidate) => `${candidate.sourceKind}@${candidate.sourceVersion}`).join(', ');
		return {
			kind: 'refused',
			code: 'source-version-mismatch',
			message: `Save admits ${admitted || 'no source format'} in this build`
		};
	}
	return { kind: 'resolved', handler };
}
