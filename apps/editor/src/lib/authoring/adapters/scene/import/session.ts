/**
 * T2.P02.S02 — the import procedure session.
 *
 * One session per import attempt, tied to one project. It owns the chosen files,
 * the worker, the staging record and the approved revision; none of that is
 * authored state, and closing the task, cancelling, replacing the project or
 * unmounting the route ends it. A cancelled, stale or replaced completion never
 * arms a placement: `dispose()` invalidates every later step.
 *
 * The session never edits the project. Approval produces a resource entry and
 * the definition its first placement will capture; the placement itself goes
 * through the one accepted Stage path.
 */
import {
	creatorModelDefinition,
	creatorModelResourceEntry,
	type CreatorModelResourceEntry,
	type CreatorModelResourcePayload,
	type NormalizedPlacementDefinition
} from '@portfolio/project-model/scene-planning';

import {
	createModelImportClient,
	ModelImportClientError,
	type ModelImportClient
} from '$lib/platform/model-import-client';

import { sha256Hex } from './ingest';
import {
	CREATOR_IMPORT_RECIPE,
	type CreatorImportFile,
	type CreatorImportOutcome,
	type CreatorImportParameters,
	type CreatorImportProgress,
	type CreatorImportReport,
	type CreatorImportSourceFile,
	type CreatorImportStagedFile
} from './types';
import { createImportWorkerClient, type CreatorImportWorkerClient } from './worker-client';

export type CreatorImportStep =
	| 'idle'
	| 'review'
	| 'uploading'
	| 'approved'
	| 'refused'
	| 'failed';

export type CreatorImportSessionState = {
	readonly step: CreatorImportStep;
	readonly files: readonly { path: string; size: number }[];
	readonly progress: CreatorImportProgress | null;
	readonly report: CreatorImportReport | null;
	readonly reportDigest: string | null;
	readonly parameters: CreatorImportParameters;
	readonly staging: { importId: string; uploaded: number; total: number } | null;
	/** A retryable failure keeps the reviewed report; a refusal installs nothing. */
	readonly message: string | null;
	readonly code: string | null;
	readonly armed: ArmedCreatorModel | null;
};

export type ArmedCreatorModel = {
	readonly resourceId: string;
	readonly name: string;
	readonly definition: NormalizedPlacementDefinition;
	readonly resource: CreatorModelResourceEntry | null;
};

export type CreatorImportDeps = {
	readonly projectId: string;
	readonly apiOrigin: string;
	readonly client?: ModelImportClient | null;
	readonly worker?: CreatorImportWorkerClient;
	/** Test seam: the worker-less recipe. */		readonly ingest?: (input: {
		files: readonly CreatorImportFile[];
		parameters: CreatorImportParameters;
		onProgress?: (progress: CreatorImportProgress) => void;
		signal?: AbortSignal;
	}) => Promise<CreatorImportOutcome>;
	readonly mintId?: () => string;
};

type Listener = (state: CreatorImportSessionState) => void;

const DEFAULT_PARAMETERS: CreatorImportParameters = {
	metresPerSourceUnit: 1,
	pivot: 'bottom-centre'
};

function stripDirectory(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash < 0 ? path : path.slice(slash + 1);
}

/**
 * Relativize the chosen file paths against the glTF's own directory.
 *
 * A directory pick carries a folder prefix while the glTF's URIs are relative to
 * the `.gltf`; without this every reference would miss. A GLB is self-contained
 * and keeps its name.
 */
export function normalizeChosenPaths(
	entries: readonly { path: string; bytes: Uint8Array }[]
): readonly CreatorImportFile[] {
	const gltf = entries.find((entry) => /\.gltf$/i.test(entry.path));
	if (gltf === undefined) return entries.map((entry) => ({ path: stripDirectory(entry.path), bytes: entry.bytes }));
	const base = gltf.path.includes('/') ? gltf.path.slice(0, gltf.path.lastIndexOf('/') + 1) : '';
	return entries.map((entry) => ({
		path: base.length > 0 && entry.path.startsWith(base) ? entry.path.slice(base.length) : stripDirectory(entry.path),
		bytes: entry.bytes
	}));
}

export class CreatorImportSession {
	readonly projectId: string;
	private readonly deps: CreatorImportDeps;
	private readonly listeners = new Set<Listener>();
	private readonly worker: CreatorImportWorkerClient | null;
	private readonly mint: () => string;
	private current: CreatorImportSessionState = {
		step: 'idle',
		files: [],
		progress: null,
		report: null,
		reportDigest: null,
		parameters: DEFAULT_PARAMETERS,
		staging: null,
		message: null,
		code: null,
		armed: null
	};
	private chosen: readonly CreatorImportFile[] = [];
	private prepared: {
		report: CreatorImportReport;
		reportDigest: string;
		derivative: CreatorImportFile;
		source: readonly CreatorImportSourceFile[];
	} | null = null;
	private preparedParameters: CreatorImportParameters | null = null;
	private staging: { importId: string; files: readonly CreatorImportStagedFile[]; uploaded: ReadonlySet<string> } | null = null;
	private abort: AbortController | null = null;
	private disposed = false;
	/**
	 * Procedure generation. `cancel()` and `dispose()` bump it, so an approval
	 * already awaiting the API can never install a revision into a procedure the
	 * creator has abandoned — including one whose staging it just cancelled.
	 */
	private generation = 0;
	private busy: Promise<unknown> | null = null;

	constructor(deps: CreatorImportDeps) {
		this.deps = deps;
		this.projectId = deps.projectId;
		this.mint = deps.mintId ?? (() => globalThis.crypto.randomUUID());
		this.worker =
			deps.worker ?? (deps.ingest === undefined ? createImportWorkerClient() : null);
	}

	state(): CreatorImportSessionState {
		return this.current;
	}

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		listener(this.current);
		return () => this.listeners.delete(listener);
	}

	private set(patch: Partial<CreatorImportSessionState>): void {
		this.current = { ...this.current, ...patch };
		for (const listener of [...this.listeners]) {
			try {
				listener(this.current);
			} catch {
				// A view subscriber cannot abort the procedure.
			}
		}
	}

	/** Choose one GLB, or one glTF plus its local files. */
	async choose(files: readonly File[]): Promise<void> {
		if (this.disposed) return;
		if (files.length === 0) {
			this.set({ step: 'idle', files: [], message: null, code: null });
			return;
		}
		const entries: { path: string; bytes: Uint8Array }[] = [];
		for (const file of files) {
			const relative =
				typeof (file as File & { webkitRelativePath?: string }).webkitRelativePath === 'string' &&
				(file as File & { webkitRelativePath: string }).webkitRelativePath.length > 0
					? (file as File & { webkitRelativePath: string }).webkitRelativePath
					: file.name;
			entries.push({ path: relative, bytes: new Uint8Array(await file.arrayBuffer()) });
		}
		this.chosen = normalizeChosenPaths(entries);
		this.prepared = null;
		this.preparedParameters = null;
		this.set({
			step: 'review',
			files: this.chosen.map((file) => ({ path: file.path, size: file.bytes.byteLength })),
			report: null,
			reportDigest: null,
			progress: null,
			message: null,
			code: null,
			armed: null
		});
	}

	setParameters(parameters: CreatorImportParameters): void {
		if (this.disposed) return;
		this.set({ parameters });
	}

	/** Read and review the chosen source with the current parameters. */
	async prepare(): Promise<void> {
		if (this.disposed || this.chosen.length === 0) return;
		if (this.busy !== null) return;
		const controller = new AbortController();
		this.abort = controller;
		const parameters = this.current.parameters;
		this.set({ progress: { stage: 'validating', detail: 'Preparing the chosen files.' }, message: null, code: null, step: 'review' });
		const run = async (): Promise<CreatorImportOutcome> => {
			if (this.deps.ingest !== undefined) {
				return this.deps.ingest({
					files: this.chosen,
					parameters,
				onProgress: (progress) => this.set({ progress }),
				signal: controller.signal
			});
			}
			if (this.worker === null) {
				return {
					kind: 'refused',
					code: 'malformed-source',
					message: 'The import worker is unavailable in this environment.',
					issues: []
				};
			}
			return this.worker.run(
				this.mint(),
				{ files: this.chosen, parameters },
				(progress) => this.set({ progress }),
				controller.signal
			);
		};
		const promise = run()
			.then((outcome) => {
				if (this.disposed) return;
				if (outcome.kind === 'refused') {
					this.prepared = null;
					this.preparedParameters = null;
					this.set({ step: 'refused', progress: null, message: outcome.message, code: outcome.code });
					return;
				}
				this.prepared = outcome;
				this.preparedParameters = parameters;
				this.set({
					step: 'review',
					progress: null,
					report: outcome.report,
					reportDigest: outcome.reportDigest,
					message: null,
					code: null
				});
			})
			.catch((error: unknown) => {
				if (this.disposed) return;
				this.set({
					step: 'failed',
					progress: null,
					message: error instanceof Error ? error.message : 'The source could not be prepared.',
					code: 'prepare-failed'
				});
			})
			.finally(() => {
				this.busy = null;
				this.abort = null;
			});
		this.busy = promise;
		await promise;
	}

	/**
	 * Upload the prepared source and derivative, approve the immutable revision,
	 * and arm the model for its first placement.
	 *
	 * A retry after a network failure keeps the reviewed report and skips files
	 * the staging record already accepted, so the same revision is approved
	 * without duplicate placements or changed pins.
	 */
	async approve(name: string): Promise<void> {
		if (this.disposed || this.busy !== null) return;
		const parameters = this.current.parameters;
		if (this.prepared === null || this.preparedParameters === null || !sameParameters(this.preparedParameters, parameters)) {
			await this.prepare();
			if (this.prepared === null) return;
		}
		const prepared = this.prepared;
		if (prepared === null) return;
		const client = this.deps.client === undefined ? createModelImportClient(this.deps.apiOrigin) : this.deps.client;
		if (client === null) {
			this.set({ step: 'failed', message: 'The API origin is not configured, so a model cannot be uploaded.', code: 'configuration' });
			return;
		}
		const generation = this.generation;
		const live = (): boolean => !this.disposed && generation === this.generation;
		const run = async (): Promise<void> => {
			if (this.staging === null) {
				const derivativeHash = await sha256Hex(prepared.derivative.bytes);
				const staged = await client.createImport({
					projectId: this.projectId,
					source: prepared.source,
					derivative: { path: prepared.derivative.path, size: prepared.derivative.bytes.byteLength, hash: derivativeHash }
				});
				if (!live()) return;
				this.staging = { importId: staged.importId, files: staged.files, uploaded: new Set() };
				this.set({ staging: { importId: staged.importId, uploaded: 0, total: staged.files.length } });
			}
			const staging = this.staging;
			if (staging === null || !live()) return;
			const bytesByPath = new Map<string, Uint8Array>([
				...this.chosen.map((file) => [file.path, file.bytes] as const),
				[prepared.derivative.path, prepared.derivative.bytes]
			]);
			for (const file of staging.files) {
				if (!live()) return;
				if (staging.uploaded.has(file.fileId)) continue;
				const bytes = bytesByPath.get(file.path);
				if (bytes === undefined) {
					throw new Error(`The staged file "${file.path}" has no prepared bytes.`);
				}
				await client.uploadFile({
					projectId: this.projectId,
					importId: staging.importId,
					fileId: file.fileId,
					bytes
				});
				staging.uploaded = new Set([...staging.uploaded, file.fileId]);
				this.set({ staging: { importId: staging.importId, uploaded: staging.uploaded.size, total: staging.files.length } });
			}
			if (!live()) return;
			const approved = await client.approveImport({
				projectId: this.projectId,
				importId: staging.importId,
				reportDigest: prepared.reportDigest,
				placement: {
					metresPerSourceUnit: prepared.report.placement.metresPerSourceUnit,
					pivot: [0, 0, 0],
					footprint: prepared.report.placement.footprint,
					contactMinY: prepared.report.placement.contactMinY,
					placement: 'floor'
				}
			});
			if (!live()) return;
			const resourceId = `model-${this.mint()}`;
			const payload: CreatorModelResourcePayload = {
				derivative: {
					hash: approved.derivative.hash,
					mime: approved.derivative.mime,
					size: approved.derivative.size,
					locator: approved.derivative.locator
				},
				source: {
					manifestHash: approved.source.manifestHash,
					size: approved.source.size,
					fileCount: approved.source.fileCount
				},
				recipe: { id: approved.recipe.id, version: approved.recipe.version },
				reportDigest: approved.reportDigest,
				placement: {
					metresPerSourceUnit: approved.placement.metresPerSourceUnit,
					pivot: [approved.placement.pivot[0], approved.placement.pivot[1], approved.placement.pivot[2]],
					footprint: approved.placement.footprint,
					contactMinY: approved.placement.contactMinY
				}
			};
			if (payload.recipe.id !== CREATOR_IMPORT_RECIPE.id) {
				throw new Error(`The server approved recipe "${payload.recipe.id}", not ${CREATOR_IMPORT_RECIPE.id}.`);
			}
			const entry = creatorModelResourceEntry(resourceId, payload);
			if (entry === null) {
				throw new Error('The approved revision is not a well-formed creator model resource.');
			}
			const displayName = displayNameFor(this.chosen, name);
			const definition = await creatorModelDefinition(entry.resource, displayName);
			if (definition === null) {
				throw new Error('The approved model has no usable placement definition.');
			}
			if (!live()) return;
			this.set({
				step: 'approved',
				armed: { resourceId, name: displayName, definition, resource: entry },
				message: null,
				code: null,
				staging: { importId: staging.importId, uploaded: staging.files.length, total: staging.files.length }
			});
		};
		this.set({ step: 'uploading', message: null, code: null });
		const promise = run().catch((error: unknown) => {
			if (!live()) return;
			// An expired or already-approved staging cannot be resumed with the same
			// import id: drop it so the next attempt declares a fresh one instead of
			// retrying the same refusal forever.
			if (
				error instanceof ModelImportClientError &&
				(error.code === 'not-found' || error.code === 'conflict')
			) {
				this.staging = null;
				this.set({ staging: null });
			}
			this.set({
				step: 'failed',
				message: error instanceof Error ? error.message : 'The model could not be approved.',
				code: 'approve-failed'
			});
		});
		this.busy = promise;
		await promise;
		this.busy = null;
	}

	/** Abandon this attempt: cancel staging where it is still cancellable. */
	async cancel(): Promise<void> {
		this.generation += 1;
		this.abort?.abort();
		const staging = this.staging;
		const client = this.deps.client === undefined ? createModelImportClient(this.deps.apiOrigin) : this.deps.client;
		if (staging !== null && client !== null && this.current.step !== 'approved') {
			try {
				await client.cancelImport(this.projectId, staging.importId);
			} catch {
				// An expired or already-cancelled staging is not a failure to report.
			}
		}
		this.staging = null;
		this.prepared = null;
		this.preparedParameters = null;
		this.chosen = [];
		this.set({
			step: 'idle',
			files: [],
			progress: null,
			report: null,
			reportDigest: null,
			staging: null,
			message: null,
			code: null,
			armed: null
		});
	}

	/** The one teardown: task close, project replacement and unmount all use it. */
	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.generation += 1;
		this.abort?.abort();
		this.worker?.dispose();
		this.listeners.clear();
	}
}

function sameParameters(left: CreatorImportParameters, right: CreatorImportParameters): boolean {
	return left.metresPerSourceUnit === right.metresPerSourceUnit && left.pivot === right.pivot;
}

function displayNameFor(files: readonly CreatorImportFile[], requested: string): string {
	const trimmed = requested.trim();
	if (trimmed.length > 0) return trimmed;
	const source = files.find((file) => /\.(glb|gltf)$/i.test(file.path));
	const base = source?.path.split('/').pop() ?? 'Imported model';
	return base.replace(/\.[^.]+$/, '') || 'Imported model';
}


