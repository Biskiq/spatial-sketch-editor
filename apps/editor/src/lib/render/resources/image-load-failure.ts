/**
 * Typed runtime image load failure.
 *
 * Separates acquisition failures (404/unregistered vs transient network/5xx),
 * pin verification mismatches, and decode failures so the editor's Repair
 * diagnostics can distinguish them without coupling to visitor runtimes.
 * Cancellations (scope closed, aborted, superseded) are never `ImageLoadFailure`.
 */
export type ImageLoadFailurePhase = 'acquire' | 'verify' | 'decode';

export class ImageLoadFailure extends Error {
	readonly phase: ImageLoadFailurePhase;
	readonly httpStatus?: number;

	constructor(message: string, phase: ImageLoadFailurePhase, httpStatus?: number) {
		super(message);
		this.name = 'ImageLoadFailure';
		this.phase = phase;
		if (httpStatus !== undefined) this.httpStatus = httpStatus;
	}
}

export function isImageLoadFailure(error: unknown): error is ImageLoadFailure {
	return error instanceof ImageLoadFailure;
}
