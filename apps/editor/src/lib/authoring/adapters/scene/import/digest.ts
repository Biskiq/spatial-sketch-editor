/**
 * The import procedure's byte identity, kept apart from the glTF ingest.
 *
 * The session hashes the derivative it receives from the worker; importing this
 * one function from `ingest.ts` would make the whole glTF-Transform pipeline part
 * of the Stage's first load. The worker keeps the only ingest import, and this
 * module carries the one identity format both sides use.
 */

/** SHA-256 of exact bytes as the `sha256-<hex>` identity S01 routes already use. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
	const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
	const hex = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
	return `sha256-${hex}`;
}
