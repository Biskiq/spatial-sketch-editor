/** Build evidence, not a signature: only consume a sidecar from a trusted build.
 * Its digest detects edited module records; hashes bind records to exact output.
 * An actor able to replace output AND recompute evidence can forge this proof.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** @param {string | Buffer} value */
export const sha256 = (value) => createHash('sha256').update(typeof value === 'string' ? value : new Uint8Array(value)).digest('hex');

/** @typedef {{file: string, sha256: string, modules: string[] | null}} ChunkRecord */
/** @param {ChunkRecord[]} chunks */
export function sealProvenance(chunks) {
	const payload = { version: 1, kind: 'rollup-module-identity', chunks };
	return { ...payload, sha256: sha256(JSON.stringify(payload)) };
}

/** @param {string} directory @returns {string[]} */
function jsInventory(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		if (entry.isSymbolicLink()) throw new Error('symlink in client output');
		return entry.isDirectory()
			? jsInventory(join(directory, entry.name)).map((file) => `${entry.name}/${file}`)
			: entry.name.endsWith('.js') ? [entry.name] : [];
	}).sort();
}

/** Validate the entire output, including chunks outside the selected route.
 * null modules denotes an emitted JS asset, which cannot prove module absence.
 * @param {string} path @param {string} client
 * @returns {Map<string, string[] | null>}
 */
export function readProvenance(path, client) {
	const evidence = JSON.parse(readFileSync(path, 'utf8'));
	if (!evidence || evidence.version !== 1 || evidence.kind !== 'rollup-module-identity' || !Array.isArray(evidence.chunks))
		throw new Error('unsupported provenance schema');
	if (Object.keys(evidence).sort().join() !== 'chunks,kind,sha256,version') throw new Error('unexpected provenance fields');
	if (sealProvenance(evidence.chunks).sha256 !== evidence.sha256) throw new Error('provenance digest mismatch (edited module identities or records)');
	/** @type {Map<string, string[] | null>} */
	const records = new Map();
	for (const record of evidence.chunks) {
		if (!record || Object.keys(record).sort().join() !== 'file,modules,sha256' || typeof record.file !== 'string' ||
			!record.file.endsWith('.js') || record.file.split('/').some((/** @type {string} */ part) => !part || part === '.' || part === '..') ||
			record.file.includes('\\') || records.has(record.file) || !/^[a-f0-9]{64}$/.test(record.sha256)) throw new Error('malformed or duplicate chunk record');
		if (record.modules !== null && (!Array.isArray(record.modules) || record.modules.length === 0 ||
			record.modules.some((/** @type {unknown} */ id) => typeof id !== 'string' || !id.trim() || id.includes('\\')) ||
			new Set(record.modules).size !== record.modules.length)) throw new Error('missing or malformed module identities');
		if (sha256(readFileSync(join(client, record.file))) !== record.sha256) throw new Error(`stale provenance: ${record.file}`);
		records.set(record.file, record.modules);
	}
	if (JSON.stringify([...records.keys()].sort()) !== JSON.stringify(jsInventory(client))) throw new Error('partial provenance: JS inventory mismatch');
	return records;
}
