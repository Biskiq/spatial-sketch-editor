/**
 * X8 — the small owners one Light binding lends its two sessions.
 *
 * A binding has exactly one gesture lease, one grip refusal, one "install in
 * flight" window and one session-only preview. The placement session and the
 * gesture session never share a mutable closure: each is handed the same four
 * named ports and writes only through their commands, so there is one lease
 * authority, one refusal slot and one preview path per binding. These ports
 * hold no Light semantics and import no session.
 */
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import type { Light } from './light-subjects';
import { cloneLight } from './light-subjects';

/** The grip refusal's lifetime: shown at the mark for four seconds or until the next move. */
export const LIGHT_REFUSAL_MS = 4_000;

export type LightLease = {
	/** Acquire the one gesture lease for this binding; `false` when another owner holds it. */
	acquire(evaluationId: string, owner: 'light-place' | 'light-marks'): boolean;
	/** Release the lease this binding holds, if it is still active. */
	release(): void;
};

/** The binding's one gesture lease, with the cancel-on-reading-change policy. */
export function createLightLease(services: StageAdapterServices): LightLease {
	let lease: ReturnType<StageAdapterServices['stage']['acquireGesture']> | null = null;
	return {
		acquire(evaluationId, owner) {
			const acquisition = services.stage.acquireGesture({
				owner,
				evaluationId,
				policy: 'cancel-on-reading-change'
			});
			if (acquisition.kind !== 'granted') return false;
			lease = acquisition;
			return true;
		},
		release() {
			if (lease?.kind === 'granted' && lease.lease.active) lease.lease.release();
			lease = null;
		}
	};
}

export type LightRefusal = {
	note(message: string): void;
	/** The live message, or `null` once it expired. */
	current(): string | null;
	clear(): void;
};

/** The last refusal, shown at the grip and cleared by the next move. */
export function createLightRefusal(now: () => number = () => Date.now()): LightRefusal {
	let refusal: { readonly message: string; readonly until: number } | null = null;
	return {
		note(message) {
			refusal = { message, until: now() + LIGHT_REFUSAL_MS };
		},
		current() {
			if (refusal === null) return null;
			if (now() > refusal.until) {
				refusal = null;
				return null;
			}
			return refusal.message;
		},
		clear() {
			refusal = null;
		}
	};
}

export type LightInstallWindow = {
	/** An accepted create or update is in flight: a task close then is a re-arm, not a disarm. */
	open(): void;
	close(): void;
	readonly isOpen: boolean;
};

export function createLightInstallWindow(): LightInstallWindow {
	let open = false;
	return {
		open() {
			open = true;
		},
		close() {
			open = false;
		},
		get isOpen() {
			return open;
		}
	};
}

/** Publish the dragged light for this frame; nothing is written. */
export function publishLightPreview(services: StageAdapterServices, light: Light): void {
	services.stage.lightPreview()?.setOverride(light.id, cloneLight(light));
}

/** Clear one light's override, or every preview value (override and candidate) when `id` is omitted. */
export function clearLightPreview(services: StageAdapterServices, id?: string): void {
	const preview = services.stage.lightPreview();
	if (preview === null) return;
	if (id === undefined) preview.clear();
	else preview.clearOverride(id);
	preview.flush();
}
