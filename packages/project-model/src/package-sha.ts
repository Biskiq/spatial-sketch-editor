/**
 * Portable SHA-256 fingerprints for package assets.
 *
 * Uses the Web Crypto API exposed by Node 20+ and modern browsers so the
 * package has one cross-runtime implementation and no editor dependency.
 */
import { countWork } from '@portfolio/layout-core';

export type SynchronousWorkMeasure = <T>(phase: string, work: () => T) => T;

export async function sha256Bytes(
	bytes: Uint8Array,
	measureSync?: SynchronousWorkMeasure,
	phase = 'sha256'
): Promise<string> {
	// Inert without a work observer (I6): the counters describe the digest's own work,
	// the optional measure is the owner's Save attribution. Neither replaces the other.
	countWork('digest');
	countWork('digest:bytes', bytes.byteLength);
	countWork('digest:buffer-bytes-copied', 2 * bytes.byteLength);
	if (!measureSync) {
		const sub = new Uint8Array(bytes);
		const buf = sub.buffer.slice(sub.byteOffset, sub.byteOffset + sub.byteLength) as ArrayBuffer;
		const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
		return `sha256-${toHex(new Uint8Array(digest))}`;
	}
	const prepare = () => {
		const sub = new Uint8Array(bytes);
		return sub.buffer.slice(sub.byteOffset, sub.byteOffset + sub.byteLength) as ArrayBuffer;
	};
	const buf = measureSync(`${phase}.prepare-bytes`, prepare);
	const startDigest = () => globalThis.crypto.subtle.digest('SHA-256', buf);
	const pendingDigest = measureSync(`${phase}.dispatch`, startDigest);
	const digest = await pendingDigest;
	const toDigestText = () => `sha256-${toHex(new Uint8Array(digest))}`;
	return measureSync(`${phase}.format`, toDigestText);
}

function toHex(bytes: Uint8Array): string {
	let out = '';
	for (let i = 0; i < bytes.length; i += 1) {
		const byte = bytes[i]!;
		out += byte.toString(16).padStart(2, '0');
	}
	return out;
}
