import { access, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';

const objectFile = (directory, key) => join(directory, `obj-${Buffer.from(key).toString('base64url')}`);

/** Task-owned filesystem store used only to prove cleanup recovery across processes. */
export function persistentObjectStore(directory) {
	const blockedDeletes = join(directory, 'block-deletes');
	return {
		async put(key, body, metadata) {
			if (metadata.signal.aborted) throw metadata.signal.reason;
			const chunks = [];
			for await (const chunk of body) chunks.push(Buffer.from(chunk));
			if (metadata.signal.aborted) throw metadata.signal.reason;
			await writeFile(objectFile(directory, key), Buffer.concat(chunks));
		},
		async get(key) {
			try {
				const bytes = await readFile(objectFile(directory, key));
				return { body: Readable.from([bytes]), contentLength: bytes.length };
			} catch (error) {
				if (error?.code === 'ENOENT') return null;
				throw error;
			}
		},
		async list(signal) {
			if (signal?.aborted) throw signal.reason;
			await mkdir(directory, { recursive: true });
			return (await readdir(directory))
				.filter((name) => name.startsWith('obj-'))
				.map((name) => Buffer.from(name.slice(4), 'base64url').toString('utf8'));
		},
		async delete(key, signal) {
			if (signal?.aborted) throw signal.reason;
			try {
				await access(blockedDeletes);
				throw new Error('injected filesystem-store delete failure before process restart');
			} catch (error) {
				if (error?.message?.startsWith('injected filesystem-store')) throw error;
				if (error?.code !== 'ENOENT') throw error;
			}
			try {
				await unlink(objectFile(directory, key));
			} catch (error) {
				if (error?.code !== 'ENOENT') throw error;
			}
		},
		async close() {}
	};
}
