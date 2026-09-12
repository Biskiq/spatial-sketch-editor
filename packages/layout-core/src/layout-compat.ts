/**
 * `layout-compat.ts` — P23.0a explicit Layout format identification.
 *
 * The single dispatch boundary between the legacy Room-owned Layout JSON and
 * the wall-first Layout schema (current `formatVersion: 5`). Identification is
 * **explicit, never inferred from field shapes** (H5 §10.1: "Do not infer schema
 * version from presence/absence of arbitrary fields after the versioned
 * cutover").
 *
 * Dispatch rule (P23.0 child plan / H5 §10.1, as amended by P23.6I):
 *
 * ```text
 * missing formatVersion  → legacy Room-owned decoder (only where it recognizes the shape)
 * formatVersion: 5       → wall-first decoder (current canonical format)
 * any other version      → unrecognized (rejected — a real decoder must exist first)
 * ```
 *
 * **There is no `4` branch.** P23.6I is a pre-Compatibility-Baseline slice, so the
 * wall-first `4` generation that reached `main` before this branch is not
 * migrated: a `4` payload is simply an unrecognized version (see
 * `docs/north-star.md` → *Development-stage schema compatibility*). Every
 * `kind: 'wall-first'` result is therefore canonical current-format state and no
 * caller branches on the version.
 *
 *
 * P23.0a scaffolding note: the legacy branch revalidates the current
 * Room-owned document through the unchanged legacy codec — **no migration
 * happens here**. `migrated` results are produced by P23.0b after the
 * topology/reconciliation middle (P23.8) exists; today the decoder can only
 * return `legacy` or `wall-first` (plus the explicit error cases).
 *
 * Downstream runtime preparation consumes `sceneSpace` to know whether Scene
 * values still require Room-frame resolution:
 *
 * - `legacy`           → `legacy-room-local` (current shipped behavior);
 * - `wall-first`       → `project-world` (Scene/Camera placement is world-local).
 */
import type { LayoutDocument } from './layout-types';
import {
	validateLayoutDocument,
	type LayoutDocumentIssue,
	type LayoutDocumentValidationResult
} from './layout-codec';
import { validateWallFirstLayoutDocument } from './layout-wall-first-codec';
import type { LayoutDocumentWallFirst } from './layout-wall-first-types';
import { KNOWN_LAYOUT_FORMAT_VERSIONS } from './layout-wall-first-types';

/** Where Scene/Camera physical values must still be resolved from. */
export type LayoutCoordinateSpace = 'legacy-room-local' | 'project-world';

export type LegacyLayoutDecode = {
	kind: 'legacy';
	/** Current Room-owned document, decoded by the unchanged legacy codec. */
	document: LayoutDocument;
	/** Legacy Scene/Camera values require Room-frame resolution. */
	sceneSpace: 'legacy-room-local';
};

export type WallFirstLayoutDecode = {
	kind: 'wall-first';
	/** Canonical wall-first document (current format). */
	document: LayoutDocumentWallFirst;
	/** Wall-first documents are project/world-local by definition. */
	sceneSpace: 'project-world';
};

/**
 * Explicit rejection. `legacy-invalid` means the payload claimed the legacy
 * branch (no formatVersion) and the legacy decoder rejected it — it is not
 * silently reinterpreted as wall-first or migrated.
 */
export type UnrecognizedLayoutDecode = {
	kind: 'unrecognized';
	reason: 'legacy-invalid' | 'unsupported-format-version' | 'invalid-json';
	issues: LayoutDocumentIssue[];
};

export type CompatibleLayoutDecode =
	| LegacyLayoutDecode
	| WallFirstLayoutDecode
	| UnrecognizedLayoutDecode;

/**
 * Decode Layout JSON with explicit format identification.
 *
 * This is the Layout-side seam only. The full Project-level decode
 * (`decodeProjectCompatible`, Layout + Scene + report) lives in
 * `@portfolio/project-model` because it must combine both documents.
 */
export function decodeLayoutJsonCompatible(json: string): CompatibleLayoutDecode {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch (error) {
		return {
			kind: 'unrecognized',
			reason: 'invalid-json',
			issues: [
				{
					path: '$',
					code: 'invalid_json',
					message: invalidJsonMessage(error, json)
				}
			]
		};
	}
	return decodeLayoutValueCompatible(parsed);
}

/**
 * Value-level twin of {@link decodeLayoutJsonCompatible} for callers that
 * already hold a parsed payload (project codec, fixtures, tests).
 */
export function decodeLayoutValueCompatible(input: unknown): CompatibleLayoutDecode {
	if (
		typeof input === 'object' &&
		input !== null &&
		!Array.isArray(input) &&
		'formatVersion' in (input as Record<string, unknown>)
	) {
		const rawVersion = (input as Record<string, unknown>).formatVersion;
		const known = (KNOWN_LAYOUT_FORMAT_VERSIONS as readonly number[]).includes(
			rawVersion as number
		);
		if (!known || typeof rawVersion !== 'number' || !Number.isInteger(rawVersion)) {
			// An explicit version this decoder does not implement is rejected as
			// unrecognized — even if the legacy codec would also reject it — so
			// the failure names the real cause instead of shape noise.
		const result = validateWallFirstLayoutDocument(input);
		const versionIssues = result.success
			? []
			: result.issues.filter((issue) => issue.code === 'unsupported_format_version');
		return {
			kind: 'unrecognized',
			reason: 'unsupported-format-version',
			issues:
				versionIssues.length > 0
					? versionIssues
					: [
							{
								path: '$.formatVersion',
								code: 'unsupported_format_version',
								message: `Unsupported Layout formatVersion ${JSON.stringify(rawVersion)}. Recognized versions: ${KNOWN_LAYOUT_FORMAT_VERSIONS.join(', ')}`
							}
						]
		};
	}
		// P23.6I — there is exactly one wall-first version, so this boundary has no
		// normalization step and reports no migrated version: a payload declaring
		// anything other than the current format is rejected above as an
		// unsupported version, before shape parsing. Canonical writers additionally
		// call `wallFirstCanonicalFormatVersionIssue()` and fail closed.
		const result = validateWallFirstLayoutDocument(input);
		if (!result.success) {
			return { kind: 'unrecognized', reason: 'unsupported-format-version', issues: result.issues };
		}
		return {
			kind: 'wall-first',
			document: result.document,
			sceneSpace: 'project-world'
		};
	}

	const legacy = validateLayoutDocument(input);
	return toLegacyOrUnrecognized(legacy);
}

function toLegacyOrUnrecognized(
	legacy: LayoutDocumentValidationResult
): LegacyLayoutDecode | UnrecognizedLayoutDecode {
	if (legacy.success) {
		return { kind: 'legacy', document: legacy.document, sceneSpace: 'legacy-room-local' };
	}
	return { kind: 'unrecognized', reason: 'legacy-invalid', issues: legacy.issues };
}

function invalidJsonMessage(error: unknown, json: string): string {
	const message = error instanceof Error ? error.message : 'Invalid JSON';
	const match = /position (\d+)/.exec(message);
	if (!match) return 'Invalid JSON';
	const offset = Number(match[1]);
	const before = json.slice(0, offset);
	const line = before.split('\n').length;
	const column = offset - before.lastIndexOf('\n');
	return `Invalid JSON near line ${line}, column ${column}.`;
}
