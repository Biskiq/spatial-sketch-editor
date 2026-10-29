/**
 * T5.P01.S04 — the `form` library payload (format 1).
 *
 * My Objects stores one native form's authored source, never a generated mesh.
 * The payload is the typed-resource content for the `form` kind:
 *
 *   { formatVersion: 1, kind: 'form', name, form, materialId, castShadow, receiveShadow }
 *
 * `form` is the Scene form source exactly as the Scene format 4 codec defines
 * it. The reader is strict (unknown keys, other formats and an unevaluable body
 * refuse), and the canonical writer is the only byte producer, so the content
 * identity is a digest of the exact bytes an inserter reads back. Generated
 * geometry, normals, UVs, footprints and caches are never part of it.
 *
 * The module is runtime-safe: it uses the Scene codec and geometry-core only,
 * imports no editor, renderer or DOM module, and both the editor and the API
 * read the same implementation.
 */
import type { MaterialId, SceneFormEntity, SceneFormSource } from '../scene';
import { parseFormSource } from '../scene-codec/parse-entities';
import {
	addIssue,
	assertAllowedKeys,
	isRecord,
	readRequiredBoolean,
	readRequiredString
} from '../scene-codec/readers';
import type { SceneDocumentIssue } from '../scene-codec';
import { withSceneValidationOptions } from '../scene-validation';
import { sha256Bytes } from '../package-sha';

/** The one payload format this tree writes and reads. */
export const FORM_LIBRARY_PAYLOAD_FORMAT_VERSION = 1 as const;

/** A user-chosen library name is bounded so the list stays readable. */
export const FORM_LIBRARY_NAME_MAX_LENGTH = 120;

/** One item's canonical bytes never exceed 256 KiB. */
export const FORM_LIBRARY_MAX_CANONICAL_BYTES = 256 * 1024;

/** One owner may retain at most 1,000 items. */
export const FORM_LIBRARY_MAX_ITEMS = 1000;

export type FormLibraryKind = 'form';

/** The one payload of a `form` library item. */
export type FormLibraryPayload = {
	readonly formatVersion: typeof FORM_LIBRARY_PAYLOAD_FORMAT_VERSION;
	readonly kind: FormLibraryKind;
	readonly name: string;
	readonly form: SceneFormSource;
	readonly materialId: MaterialId;
	readonly castShadow: boolean;
	readonly receiveShadow: boolean;
};

/** What the owner's list returns; payload bytes stay behind the read route. */
export type FormLibraryItemSummary = {
	readonly id: string;
	readonly name: string;
	readonly kind: FormLibraryKind;
	readonly formatVersion: number;
	readonly contentId: string;
	readonly createdAt: string;
};

export type FormLibraryIssue = {
	readonly path: string;
	readonly code: string;
	readonly message: string;
};

export type FormLibraryReadResult =
	| { readonly success: true; readonly payload: FormLibraryPayload; readonly canonicalJson: string }
	| { readonly success: false; readonly issues: readonly FormLibraryIssue[] };

/**
 * The one canonical payload object.
 *
 * Key order is fixed here so the bytes are stable across editor, API and test.
 * The form source is cloned without renumbering keys or re-evaluating anything:
 * the authored controls, keys, scale and next key are stored verbatim.
 */
export function canonicalFormLibraryPayload(
	payload: FormLibraryPayload
): FormLibraryPayload {
	return {
		formatVersion: FORM_LIBRARY_PAYLOAD_FORMAT_VERSION,
		kind: 'form',
		name: payload.name.trim(),
		form: {
			generator: {
				kind: payload.form.generator.kind,
				plane: payload.form.generator.plane,
				outline: payload.form.generator.outline.map((anchor) => ({
					key: anchor.key,
					u: anchor.u,
					v: anchor.v,
					smooth: anchor.smooth
				})),
				extent: payload.form.generator.extent
			},
			scale: [payload.form.scale[0], payload.form.scale[1], payload.form.scale[2]],
			nextKey: payload.form.nextKey
		},
		materialId: payload.materialId,
		castShadow: payload.castShadow,
		receiveShadow: payload.receiveShadow
	};
}

/** The only canonical byte producer for a `form` library item. */
export function canonicalFormLibraryBytes(payload: FormLibraryPayload): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(canonicalFormLibraryPayload(payload)));
}

/** The content identity of one canonical payload. */
export async function formLibraryContentId(payload: FormLibraryPayload): Promise<string> {
	return sha256Bytes(canonicalFormLibraryBytes(payload));
}

/** The payload of one accepted form entity, ready to save. */
export function formLibraryPayloadFromEntity(entity: SceneFormEntity): FormLibraryPayload {
	return canonicalFormLibraryPayload({
		formatVersion: FORM_LIBRARY_PAYLOAD_FORMAT_VERSION,
		kind: 'form',
		name: entity.name,
		form: entity.form,
		materialId: entity.materialId,
		castShadow: entity.castShadow,
		receiveShadow: entity.receiveShadow
	});
}

/**
 * Read one payload strictly.
 *
 * `formatVersion` is checked before shape so an item saved by another
 * development format is reported as unusable rather than misread. A payload
 * body the Scene codec cannot evaluate refuses with that codec's typed issue.
 * The result is canonical: `canonicalJson` is exactly the bytes the content id
 * covers.
 */
export function readFormLibraryPayload(input: unknown): FormLibraryReadResult {
	const issues: SceneDocumentIssue[] = [];
	if (!isRecord(input)) {
		return { success: false, issues: [{ path: '$', code: 'invalid_type', message: 'Expected a form library item object' }] };
	}
	if (input.formatVersion !== FORM_LIBRARY_PAYLOAD_FORMAT_VERSION) {
		return {
			success: false,
			issues: [
				{
					path: '$.formatVersion',
					code: 'unsupported_format_version',
					message: `Unsupported form library formatVersion ${JSON.stringify(input.formatVersion)}; recognized value: ${FORM_LIBRARY_PAYLOAD_FORMAT_VERSION}`
				}
			]
		};
	}
	assertAllowedKeys(
		input,
		['formatVersion', 'kind', 'name', 'form', 'materialId', 'castShadow', 'receiveShadow'],
		'$',
		issues
	);
	const kind = readRequiredString(input, 'kind', '$', issues);
	if (kind !== undefined && kind !== 'form') {
		addIssue(issues, '$.kind', 'unsupported_kind', `Unsupported form library kind: ${kind}`);
	}
	const name = readRequiredString(input, 'name', '$', issues);
	if (name !== undefined) {
		const trimmed = name.trim();
		if (trimmed.length === 0) {
			addIssue(issues, '$.name', 'empty_name', 'A library item needs a name');
		} else if (trimmed.length > FORM_LIBRARY_NAME_MAX_LENGTH) {
			addIssue(
				issues,
				'$.name',
				'name_too_long',
				`A library item name is at most ${FORM_LIBRARY_NAME_MAX_LENGTH} characters`
			);
		}
	}
	const materialId = readRequiredString(input, 'materialId', '$', issues);
	// A saved material is a catalogue identity, never a project-local instance.
	// An unknown one would be stored here and only refuse when its copy entered a
	// project, so the shared payload reader refuses it at Save time instead.
	if (materialId !== undefined && !withSceneValidationOptions().isKnownMaterialId(materialId)) {
		addIssue(issues, '$.materialId', 'unknown_material', `Unknown material: ${materialId}`);
	}
	const castShadow = readRequiredBoolean(input, 'castShadow', '$', issues);
	const receiveShadow = readRequiredBoolean(input, 'receiveShadow', '$', issues);
	const form = parseFormSource(input.form, '$.form', issues);
	if (issues.length > 0 || kind !== 'form' || name === undefined || materialId === undefined || castShadow === undefined || receiveShadow === undefined || form === undefined) {
		return { success: false, issues };
	}
	const payload = canonicalFormLibraryPayload({
		formatVersion: FORM_LIBRARY_PAYLOAD_FORMAT_VERSION,
		kind: 'form',
		name,
		form,
		materialId: materialId as MaterialId,
		castShadow,
		receiveShadow
	});
	const canonicalJson = JSON.stringify(payload);
	if (new TextEncoder().encode(canonicalJson).byteLength > FORM_LIBRARY_MAX_CANONICAL_BYTES) {
		return {
			success: false,
			issues: [
				{
					path: '$',
					code: 'payload_too_large',
					message: `A library item is at most ${FORM_LIBRARY_MAX_CANONICAL_BYTES} canonical bytes`
				}
			]
		};
	}
	return { success: true, payload, canonicalJson };
}

/**
 * Read and verify the bytes one item's read route returned.
 *
 * The content id is recomputed from the received bytes and compared with the
 * one the caller pinned (the item's stored identity or the route's ETag). A
 * mismatch, malformed JSON or an unsupported body refuses before anything can
 * be inserted.
 */
export async function readFormLibraryBytes(
	bytes: Uint8Array,
	options: { readonly contentId?: string } = {}
): Promise<
	| {
			readonly success: true;
			readonly payload: FormLibraryPayload;
			readonly canonicalJson: string;
			readonly contentId: string;
	  }
	| { readonly success: false; readonly issues: readonly FormLibraryIssue[] }
> {
	if (bytes.byteLength > FORM_LIBRARY_MAX_CANONICAL_BYTES) {
		return {
			success: false,
			issues: [
				{
					path: '$',
					code: 'payload_too_large',
					message: `A library item is at most ${FORM_LIBRARY_MAX_CANONICAL_BYTES} canonical bytes`
				}
			]
		};
	}
	const contentId = await sha256Bytes(bytes);
	if (options.contentId !== undefined && options.contentId !== contentId) {
		return {
			success: false,
			issues: [
				{
					path: '$',
					code: 'content_id_mismatch',
					message: 'The item bytes do not match the content id they were read as'
				}
			]
		};
	}
	let input: unknown;
	try {
		input = JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		return {
			success: false,
			issues: [{ path: '$', code: 'invalid_json', message: 'The item bytes are not JSON' }]
		};
	}
	const parsed = readFormLibraryPayload(input);
	if (!parsed.success) return parsed;
	// The content identity covers the canonical bytes, not merely equivalent JSON.
	// A non-canonical spelling has a different hash and must never be admitted
	// under the identity of the canonical payload an inserter would write.
	const canonical = new TextEncoder().encode(parsed.canonicalJson);
	if (
		canonical.byteLength !== bytes.byteLength ||
		canonical.some((value, index) => value !== bytes[index])
	) {
		return {
			success: false,
			issues: [
				{
					path: '$',
					code: 'non_canonical_payload',
					message: 'The item bytes are not the canonical serialization they claim to be'
				}
			]
		};
	}
	return { success: true, payload: parsed.payload, canonicalJson: parsed.canonicalJson, contentId };
}
