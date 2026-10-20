/**
 * T1.P01.S04 — the PLATE **Head** Save integration.
 *
 * The protocol, the server and the client state machine are `T3.P01.S02`'s
 * (`createSaveState`); this module builds none of them. It mounts that state in
 * Head vocabulary and owns the three host obligations the S02 pair record
 * assigned to the Head:
 *
 * 1. **One label and one visible reason** for the Save control. The Head never
 *    renders a dead button: a state that cannot save says why.
 * 2. **Unsaved-work signalling** at project exit and replacement. The signal is
 *    explicit (`unsavedWork`), so a caller must decide; it is never inferred.
 * 3. **Routing *Reload remote* through the host's replacement guard.** The
 *    controller returns the `ReloadOffer`; it never installs the remote document
 *    itself, so the host's guard remains the only replacement path.
 *
 * Framework-free: no Svelte, host, route or renderer import, so the Head
 * component and the tests drive exactly the same behaviour.
 */

import type { ReloadOffer, SaveOutcome, SaveSnapshot, SaveState } from './save-state';

export type HeadSaveCommand =
	| { readonly kind: 'saved' }
	| { readonly kind: 'dirty' }
	| { readonly kind: 'conflict' }
	| { readonly kind: 'busy' }
	| { readonly kind: 'stale-epoch' }
	| { readonly kind: 'unavailable' }
	| { readonly kind: 'unresolved' }
	| { readonly kind: 'refused'; readonly message: string }
	| { readonly kind: 'error'; readonly message: string };

export type HeadSaveControl = {
	/** The button label for the current state. */
	readonly label: string;
	/** `null` when the control can act; otherwise the visible reason it cannot. */
	readonly reason: string | null;
	readonly disabled: boolean;
	readonly busy: boolean;
	/** A conflict is the one state where *Reload remote* is offered. */
	readonly conflict: boolean;
	/** An authentication failure is resumable after sign-in. */
	readonly signInRequired: boolean;
};

export type HeadSaveExitSignal =
	| { readonly kind: 'proceed' }
	| { readonly kind: 'confirm'; readonly message: string };

export type HeadSave = {
	snapshot(): SaveSnapshot;
	subscribe(listener: (snapshot: SaveSnapshot) => void): () => void;
	/** Refresh after an accepted edit; cheap and idempotent. */
	refresh(): SaveSnapshot;
	control(): HeadSaveControl;
	/** The explicit unsaved-work fact the host uses at exit and replacement. */
	unsavedWork(): HeadSaveExitSignal;
	isDirty(): boolean;
	save(): Promise<HeadSaveCommand>;
	/** Retry a retained capture, including the post-sign-in resume path. */
	retry(): Promise<HeadSaveCommand>;
	/** The remote side of a conflict, handed to the host's replacement guard. */
	reloadRemote(): ReloadOffer;
	clearError(): void;
};

function statusReason(snapshot: SaveSnapshot): { label: string; reason: string | null; disabled: boolean } {
	switch (snapshot.status) {
		case 'never-saved':
			return snapshot.busy
				? { label: 'Saving…', reason: null, disabled: true }
				: snapshot.pending
					? {
							label: 'Resume pending save',
							reason: 'A Save was captured before sign-in. Resume it to save exactly that work.',
							disabled: false
						}
					: { label: 'Save to Cloud', reason: null, disabled: false };
		case 'dirty':
			return snapshot.busy
				? { label: 'Saving…', reason: null, disabled: true }
				: snapshot.pending
					? {
							label: 'Resume pending save',
							reason: 'A Save was captured before sign-in. Resume it to save exactly that work.',
							disabled: false
						}
					: { label: 'Save changes', reason: null, disabled: false };
		case 'saving':
			return { label: 'Saving…', reason: null, disabled: true };
		case 'saved':
			return {
				label: 'Saved',
				reason: 'All accepted changes are saved.',
				disabled: true
			};
		case 'conflict':
			return {
				label: 'Resolve conflict',
				reason: 'The cloud copy changed. Download your local work or reload the remote copy; nothing is merged automatically.',
				disabled: true
			};
		case 'auth-required':
			return {
				// The retained capture is resumable: the Head must be able to run the
				// resume command after the platform's sign-in flow, so the control stays
				// enabled and says what it will do.
				label: 'Resume pending save',
				reason: 'Your session needs sign-in. After signing in, resume the pending Save.',
				disabled: false
			};
		case 'refused':
		case 'error':
			return {
				label: 'Retry save',
				reason: snapshot.error?.message ?? 'The last Save did not complete.',
				disabled: snapshot.busy
			};
	}
}

function commandOf(outcome: SaveOutcome): HeadSaveCommand {
	switch (outcome.kind) {
		case 'saved':
		case 'dirty':
		case 'conflict':
		case 'busy':
		case 'stale-epoch':
		case 'unavailable':
		case 'unresolved':
			return { kind: outcome.kind };
		case 'refused':
			return { kind: 'refused', message: outcome.message };
		case 'error':
			return { kind: 'error', message: outcome.message };
	}
}

export function createHeadSave(state: SaveState): HeadSave {
	return {
		snapshot: () => state.getSnapshot(),
		subscribe: (listener) => state.subscribe(listener),
		refresh: () => state.refresh(),
		control() {
			const snapshot = state.getSnapshot();
			const base = statusReason(snapshot);
			return {
				...base,
				busy: snapshot.busy,
				conflict: snapshot.status === 'conflict',
				signInRequired: snapshot.status === 'auth-required'
			};
		},
		unsavedWork() {
			const snapshot = state.getSnapshot();
			if (!snapshot.dirty) return { kind: 'proceed' };
			return {
				kind: 'confirm',
				message:
					'This project has unsaved changes. Save, download the source, or leave and lose them.'
			};
		},
		isDirty: () => state.getSnapshot().dirty,
		async save() {
			return commandOf(await state.save());
		},
		async retry() {
			// `retry()` reuses the retained capture. A sign-in interruption is the one
			// state where the same command is the documented resume path.
			return commandOf(await state.retry());
		},
		reloadRemote: () => state.reloadRemote(),
		clearError() {
			state.clearError();
		}
	};
}
