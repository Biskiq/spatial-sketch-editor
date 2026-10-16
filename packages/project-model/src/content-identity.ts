/**
 * One current-source authored identity for boot, acceptance and server Save.
 * The current writer normalizes fixed fields; this boundary also orders the
 * Layout identity maps. Only identity.cursor is omitted from the digest:
 * LayoutIdentityLedger defines it as persisted allocation bookkeeping. Full
 * canonicalJson retains it for exact Save/Load and Undo/Redo restoration.
 */

import { sha256Bytes } from './package-sha';
import { ProjectValidationError, validateProject, type ProjectValidationOptions } from './project-codec';
import type { ProjectDocument, ProjectIssue } from './project-types';

/**
 * The content identity of one admitted current source, or the writer's own
 * refusal. `canonicalJson` is returned alongside so a caller that needs both the
 * identity and the canonical bytes (the acceptance coordinator does) computes
 * them in one pass instead of validating twice.
 */
export type SourceContentIdentity =
	| { readonly kind: 'computed'; readonly sourceContentId: string; readonly canonicalJson: string }
	| { readonly kind: 'rejected'; readonly issues: readonly ProjectIssue[] };

/**
 * The one digest of canonical source bytes. The **only** place the identity's
 * byte framing is decided: UTF-8 canonical authored JSON (excluding the cursor),
 * hashed by the shared `sha256Bytes` primitive under its existing `sha256-<hex>`
 * form. A second caller that already holds canonical bytes (a server
 * recomputing the digest after an upload) reuses this rather than re-deriving
 * the framing.
 */
export async function sourceContentIdForCanonicalJson(canonicalJson: string): Promise<string> {
	// The writer preserves the allocation cursor for Save/Load, but Layout's
	// authored identity excludes it (LayoutIdentityLedger). Keep all assignments.
	const authored = JSON.parse(canonicalJson);
	if (authored.layout?.identity) {
		orderIdentityMaps(authored.layout.identity);
		delete authored.layout.identity.cursor;
	}
	return sha256Bytes(new TextEncoder().encode(JSON.stringify(authored, null, 2) + '\n'));
}

/**
 * The current-source content identity, or the writer's refusal. Accepts a parsed
 * document or its JSON text; anything the current-format writer rejects is
 * refused with that writer's own issues, never hashed.
 *
 * Non-throwing because admission and the coordinator both need to *report* a
 * refusal: hashing an unvalidated payload would let two documents with equal
 * bytes-but-unequal meaning share an identity, and it would let a caller treat a
 * malformed source as an accepted one.
 */
export async function tryComputeSourceContentId(
	source: unknown,
	options: ProjectValidationOptions = {}
): Promise<SourceContentIdentity> {
	const canonical = canonicalSourceJson(source, options);
	if (canonical.kind === 'rejected') return canonical;
	return {
		kind: 'computed',
		sourceContentId: await sourceContentIdForCanonicalJson(canonical.canonicalJson),
		canonicalJson: canonical.canonicalJson
	};
}

/**
 * The current-source content identity.
 *
 * Throws the writer's own `ProjectValidationError` for a source the current
 * format does not admit, because a caller asking for *the* identity of a
 * document it believes is valid deserves the validator's named defect rather
 * than a silent `undefined`. Callers that must report a refusal use
 * {@link tryComputeSourceContentId}.
 */
export async function computeSourceContentId(
	source: unknown,
	options: ProjectValidationOptions = {}
): Promise<string> {
	const result = await tryComputeSourceContentId(source, options);
	if (result.kind === 'rejected') throw new ProjectValidationError(result.issues[0]!);
	return result.sourceContentId;
}

/**
 * Canonical authored bytes without the digest, for callers that hold the bytes
 * (serialization round trips, the API's shared validation) but not the hash.
 */
export function canonicalSourceJson(
	source: unknown,
	options: ProjectValidationOptions = {}
): { readonly kind: 'canonical'; readonly canonicalJson: string; readonly project: ProjectDocument } | {
	readonly kind: 'rejected';
	readonly issues: readonly ProjectIssue[];
} {
	const parsed = parseSourceInput(source);
	if (parsed.kind === 'rejected') return parsed;
	const validated = validateProject(parsed.value, options);
	if (!validated.success) return { kind: 'rejected', issues: validated.issues };
	// Dynamic ID-keyed maps are the only writer fields whose order follows input.
	if (validated.project.layout.identity) orderIdentityMaps(validated.project.layout.identity);
	return { kind: 'canonical', canonicalJson: JSON.stringify(validated.project, null, 2) + '\n', project: validated.project };
}

/**
 * A source is either the parsed document or its JSON text. Text is parsed once
 * here so whitespace and key order in the *text* cannot survive into the digest,
 * which is what makes the identity invariant to both.
 */
function parseSourceInput(
	source: unknown
): { readonly kind: 'parsed'; readonly value: unknown } | { readonly kind: 'rejected'; readonly issues: readonly ProjectIssue[] } {
	if (typeof source !== 'string') return { kind: 'parsed', value: source };
	try {
		return { kind: 'parsed', value: JSON.parse(source) as unknown };
	} catch (error) {
		return {
			kind: 'rejected',
			issues: [
				{
					path: '$',
					code: 'invalid_json',
					message: error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON'
				}
			]
		};
	}
}

function orderIdentityMaps(identity: NonNullable<ProjectDocument['layout']['identity']>): void {
	for (const family of ['rooms', 'junctions', 'walls', 'openings'] as const) {
		identity[family] = Object.fromEntries(Object.entries(identity[family]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
	}
}
