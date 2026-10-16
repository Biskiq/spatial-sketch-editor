/**
 * The one current-source **content** identity (T1.P01.S03, plan §Content
 * identity; PR #127 decision 4).
 *
 * One identity for one body of authored content, computed as the landed
 * `sha256Bytes` (./package-sha) over the strict writer's **canonical** bytes.
 * The canonical bytes are the current-format writer's own output
 * (`validateProject` → `canonicalJson`), built from the normalized document the
 * validator produced, so they carry the writer's key order and its fixed
 * indentation rather than the caller's:
 *
 * - **invariant to input key order** — the canonical document is assembled by
 *   the writer from the parsed values, not by re-serializing the caller's object;
 * - **invariant to input whitespace** — a JSON *string* is parsed first, and a
 *   parsed document has no whitespace to preserve;
 * - **equal for equal authored contents, different for different ones** — the
 *   digest is over the complete canonically ordered document, so a change
 *   anywhere in the authored Layout or Scene changes it;
 * - **free of acceptance bookkeeping** — revision ids, session epochs,
 *   allocation counters and history positions are held *beside* the current
 *   source (the F.1 draft puts accepted metadata outside the source JSON), so
 *   they cannot enter the digest. An Undo back to earlier contents restores that
 *   content's identity under a *fresh* accepted revision: content and revision
 *   are different identities on purpose (see ./references/read-adapter).
 *
 * Why one export: `T1.P01.S02` (boot), `T1.P01.S03` (acceptance/admission) and
 * later `T3.P01.S02` (server-side Save) all need this identity, and two
 * definitions would let `exact` references and Camera-output source identity
 * disagree after integration. Additive API only: nothing here changes a landed
 * contract.
 *
 * Runtime-safe: Web Crypto, the project codec and this package's own issue
 * vocabulary; no editor, renderer, Svelte or Three import. Usable server-side,
 * which is exactly what `T3.P01.S02`'s digest recomputation needs.
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
 * byte framing is decided: the UTF-8 encoding of the writer's canonical JSON,
 * hashed by the shared `sha256Bytes` primitive under its existing `sha256-<hex>`
 * form. A second caller that already holds canonical bytes (a server
 * recomputing the digest after an upload) reuses this rather than re-deriving
 * the framing.
 */
export async function sourceContentIdForCanonicalJson(canonicalJson: string): Promise<string> {
	return sha256Bytes(new TextEncoder().encode(canonicalJson));
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
	const parsed = parseSourceInput(source);
	if (parsed.kind === 'rejected') return parsed;
	const validated = validateProject(parsed.value, options);
	if (!validated.success) return { kind: 'rejected', issues: validated.issues };
	return {
		kind: 'computed',
		sourceContentId: await sourceContentIdForCanonicalJson(validated.canonicalJson),
		canonicalJson: validated.canonicalJson
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
	return { kind: 'canonical', canonicalJson: validated.canonicalJson, project: validated.project };
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
