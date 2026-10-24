/**
 * T2.P02.S02 — the lazy import worker client.
 *
 * The worker module is reached through a dynamic import of its URL, so a build
 * that never opens Import emits no worker chunk. One worker serves one import
 * session; `dispose()` terminates it and every in-flight request settles as
 * cancelled. There is deliberately no module-level singleton: two Stage
 * lifetimes must not share an import session.
 */
import type {
	CreatorImportOutcome,
	CreatorImportProgress,
	CreatorImportRequest,
	CreatorImportWorkerRequest,
	CreatorImportWorkerResponse
} from './types';

export type ImportWorkerRun = {
	readonly outcome: CreatorImportOutcome;
};

type Pending = {
	resolve(outcome: CreatorImportOutcome): void;
	reject(error: Error): void;
	onProgress?: (progress: CreatorImportProgress) => void;
};

export type CreatorImportWorkerClient = {
	run(
		requestId: string,
		request: CreatorImportRequest,
		onProgress?: (progress: CreatorImportProgress) => void,
		signal?: AbortSignal
	): Promise<CreatorImportOutcome>;
	cancel(requestId: string): void;
	dispose(): void;
};

function mintWorker(): Worker {
	return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
}

/**
 * One worker, one session. `createWorker` is a seam for tests that exercise the
 * message protocol without a browser worker.
 */
export function createImportWorkerClient(
	createWorker: () => Worker = mintWorker
): CreatorImportWorkerClient {
	let worker: Worker | null = null;
	let disposed = false;
	const pending = new Map<string, Pending>();
	const aborts = new Map<string, () => void>();

	function ensure(): Worker | null {
		if (disposed) return null;
		if (worker !== null) return worker;
		const created = createWorker();
		created.addEventListener('message', (event: MessageEvent<CreatorImportWorkerResponse>) => {
			const message = event.data;
			const active = pending.get(message.id);
			if (active === undefined) return;
			if (message.kind === 'progress') {
				active.onProgress?.(message.progress);
				return;
			}
			pending.delete(message.id);
			aborts.delete(message.id);
			if (message.kind === 'outcome') active.resolve(message.outcome);
			else active.reject(new Error(message.message));
		});
		worker = created;
		return created;
	}

	function settleAllAsCancelled(): void {
		for (const [id, active] of [...pending]) {
			pending.delete(id);
			aborts.delete(id);
			active.resolve({
				kind: 'refused',
				code: 'cancelled',
				message: 'The import session ended before the source was prepared.',
				issues: []
			});
		}
	}

	return {
		run(requestId, request, onProgress, signal) {
			return new Promise<CreatorImportOutcome>((resolve, reject) => {
				const live = ensure();
				if (live === null) {
					resolve({
						kind: 'refused',
						code: 'cancelled',
						message: 'The import session has ended.',
						issues: []
					});
					return;
				}
				pending.set(requestId, { resolve, reject, ...(onProgress === undefined ? {} : { onProgress }) });
				const cancel = (): void => {
					if (!pending.has(requestId)) return;
					const message: CreatorImportWorkerRequest = { kind: 'cancel', id: requestId };
					live.postMessage(message);
				};
				aborts.set(requestId, cancel);
				signal?.addEventListener('abort', cancel, { once: true });
				const message: CreatorImportWorkerRequest = { kind: 'ingest', id: requestId, request };
				live.postMessage(message);
			});
		},
		cancel(requestId) {
			aborts.get(requestId)?.();
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			settleAllAsCancelled();
			worker?.terminate();
			worker = null;
		}
	};
}
