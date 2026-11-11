export async function imageSha256(bytes: Uint8Array): Promise<string> {
	const digest = await globalThis.crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
