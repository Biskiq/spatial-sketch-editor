/**
 * T2.P02.S02 — the import worker entry.
 *
 * Loaded only when Import opens. It owns the glTF reader, the conditional
 * decoders and the encoders, so none of that weight is in the Stage's first
 * load. Messages are the contract in `./types`; the worker never touches the
 * DOM, the project or the API.
 */
import { ingestCreatorImport } from './ingest';
import type {
	CreatorImportWorkerRequest,
	CreatorImportWorkerResponse
} from './types';

const scope = globalThis as unknown as {
	addEventListener(
		type: 'message',
		listener: (event: MessageEvent<CreatorImportWorkerRequest>) => void
	): void;
	postMessage(message: CreatorImportWorkerResponse): void;
};

const controllers = new Map<string, AbortController>();

scope.addEventListener('message', (event) => {
	const message = event.data;
	if (message.kind === 'cancel') {
		controllers.get(message.id)?.abort();
		return;
	}
	const controller = new AbortController();
	controllers.set(message.id, controller);
	void ingestCreatorImport(message.request, {
		signal: controller.signal,
		onProgress: (progress) => scope.postMessage({ kind: 'progress', id: message.id, progress })
	})
		.then((outcome) => scope.postMessage({ kind: 'outcome', id: message.id, outcome }))
		.catch((error: unknown) => {
			scope.postMessage({
				kind: 'failed',
				id: message.id,
				message: error instanceof Error ? error.message : 'The import worker failed.'
			});
		})
		.finally(() => controllers.delete(message.id));
});
