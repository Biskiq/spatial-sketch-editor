/**
 * The *+ From image* flow (T2.S4b).
 *
 * Two steps, only one of them undoable:
 *
 * 1. the P20 upload, outside the Scene, never in Undo, recovered by re-listing
 *    when a response is lost and deduplicated by sha256;
 * 2. the one `scene-finish-from-image` intent that names those bytes.
 *
 * This service owns the first step and the states the Library tile and the
 * Card show. It never writes a Scene itself: the caller supplies an `apply`
 * callback, so the Finish service decides whether the image becomes a new
 * Finish (a Library pick) or replaces an existing Finish's image (More ›
 * Image › Replace) under the shared-Finish Ask.
 *
 * Cancelling aborts the request and writes nothing. A failed upload keeps the
 * chosen file so *Try again* can re-run it; the importer re-lists first, so an
 * upload that actually completed is reused rather than sent again.
 */
import {
	FINISH_IMAGE_POLICY,
	importProjectImage,
	type ImportedProjectImage
} from '../artwork/project-artwork';
import type { ProjectApi } from '$lib/platform/project-persistence';

/** D3: below this short edge the image is accepted **with a warning**. */
export const FINISH_IMAGE_MIN_SHORT_EDGE = 256;

export type FinishImagePhase =
	| 'idle'
	| 'checking'
	| 'uploading'
	/** The upload landed and the one Scene write is in flight; not cancellable. */
	| 'saving'
	| 'refused'
	| 'failed'
	| 'done';

export type FinishImageState = {
	readonly phase: FinishImagePhase;
	readonly fileName: string | null;
	readonly message: string | null;
	readonly warning: string | null;
};

export type FinishImageOutcome =
	| { readonly kind: 'accepted' }
	| { readonly kind: 'refused'; readonly message: string }
	| { readonly kind: 'no-op'; readonly message?: string };

export type FinishImageApply = (
	image: ImportedProjectImage,
	warning: string | null,
	label: string
) => Promise<FinishImageOutcome>;

const IDLE: FinishImageState = { phase: 'idle', fileName: null, message: null, warning: null };

/** The D3 low-resolution warning, or `null`. Never stored; derived each time. */
export function finishImageWarning(pixelWidth: number, pixelHeight: number): string | null {
	if (Math.min(pixelWidth, pixelHeight) >= FINISH_IMAGE_MIN_SHORT_EDGE) return null;
	return `Low resolution (${pixelWidth} × ${pixelHeight} px): it may look blurry or visibly tiled.`;
}

/** A display-only Finish name from the file: its stem, bounded like an asset name. */
export function finishImageLabel(fileName: string): string {
	const stem = fileName.replace(/\.[^.]+$/, '').trim();
	return (stem.length === 0 ? 'Image' : stem).slice(0, 120);
}

/** The resource pin an imported image becomes; the texture record id is its asset id. */
export function finishImagePin(image: ImportedProjectImage) {
	return {
		hash: image.sha256,
		mime: image.mime,
		size: image.byteSize,
		locator: `/project-assets/${image.assetId}`
	};
}

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function createFinishImageFlow(host: {
	readonly api: () => ProjectApi | null;
	readonly projectId: () => string | null;
	readonly canEdit: () => boolean;
	readonly isSaved: () => boolean;
	readonly onNotice: (message: string) => void;
}) {
	let state = $state.raw<FinishImageState>(IDLE);
	let request: AbortController | null = null;
	let last: { readonly file: File; readonly apply: FinishImageApply } | null = null;

	function refuse(message: string, fileName: string | null): void {
		state = { phase: 'refused', fileName, message, warning: null };
	}

	async function run(file: File, apply: FinishImageApply): Promise<FinishImageOutcome> {
		const api = host.api();
		const projectId = host.projectId();
		if (api === null || projectId === null) {
			const message = 'Save this project to the cloud before adding a Finish image.';
			refuse(message, file.name);
			return { kind: 'refused', message };
		}
		if (!host.canEdit() || !host.isSaved()) {
			const message = 'Save this project to the cloud before adding a Finish image.';
			refuse(message, file.name);
			return { kind: 'refused', message };
		}
		if (!ACCEPTED_TYPES.has(file.type)) {
			const message = 'Finish images must be a PNG, JPEG or WebP.';
			refuse(message, file.name);
			return { kind: 'refused', message };
		}
		if (file.size > FINISH_IMAGE_POLICY.maxBytes) {
			const message = 'Finish images must be 25 MiB or smaller.';
			refuse(message, file.name);
			return { kind: 'refused', message };
		}
		last = { file, apply };
		const abort = new AbortController();
		request = abort;
		state = { phase: 'checking', fileName: file.name, message: null, warning: null };
		try {
			const imported = await importProjectImage(api, projectId, file, abort.signal, FINISH_IMAGE_POLICY, {
				onPhase: (phase) => {
					if (request !== abort) return;
					state = { ...state, phase };
				}
			});
			if (abort.signal.aborted || request !== abort) return { kind: 'no-op' };
			const warning = finishImageWarning(imported.pixelWidth, imported.pixelHeight);
			const label = finishImageLabel(file.name);
			// The Scene write belongs to the Finish service. It is one intent and
			// cannot be cancelled mid-admission, so Cancel is only offered while the
			// upload is still ours to abort.
			state = { phase: 'saving', fileName: file.name, message: null, warning };
			const outcome = await apply(imported, warning, label);
			if (abort.signal.aborted || request !== abort) return { kind: 'no-op' };
			if (outcome.kind === 'accepted') {
				state = { phase: 'done', fileName: file.name, message: null, warning };
			} else if (outcome.kind === 'refused') {
				state = { phase: 'failed', fileName: file.name, message: outcome.message, warning };
			} else {
				state = IDLE;
			}
			return outcome;
		} catch (error) {
			if (abort.signal.aborted) {
				if (request === abort) state = IDLE;
				return { kind: 'no-op' };
			}
			const message = error instanceof Error ? error.message : 'Upload failed.';
			state = {
				phase: 'failed',
				fileName: file.name,
				message,
				warning: null
			};
			return { kind: 'refused', message };
		} finally {
			if (request === abort) request = null;
		}
	}

	return {
		get state() {
			return state;
		},
		get busy() {
			return state.phase === 'checking' || state.phase === 'uploading' || state.phase === 'saving';
		},
		get canRetry() {
			return last !== null && (state.phase === 'failed');
		},
		begin(file: File, apply: FinishImageApply): Promise<FinishImageOutcome> {
			if (state.phase === 'checking' || state.phase === 'uploading' || state.phase === 'saving') {
				return Promise.resolve({ kind: 'no-op' });
			}
			return run(file, apply);
		},
		retry(): Promise<FinishImageOutcome> {
			if (last === null) return Promise.resolve({ kind: 'no-op' });
			return run(last.file, last.apply);
		},
		cancel(): void {
			// A committed Scene write is not abortable: never pretend the asset
			// upload is still the only thing happening.
			if (state.phase === 'saving') return;
			request?.abort();
			request = null;
			last = null;
			state = IDLE;
		},
		reset(): void {
			if (state.phase === 'checking' || state.phase === 'uploading' || state.phase === 'saving') return;
			last = null;
			state = IDLE;
		}
	};
}

export type FinishImageFlow = ReturnType<typeof createFinishImageFlow>;
