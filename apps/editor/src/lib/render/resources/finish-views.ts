/**
 * Generation-bound GPU views for sampled Finishes.
 *
 * A view is one uploaded source image under one decode policy. The plan's UV
 * transforms and selectors live in the sampling graph, so two materials with a
 * different rotation share one view and one upload; three ORM roles that name the
 * same raw bitmap share one view and three sample expressions.
 *
 * The cache is read-only with respect to bytes: the texture store's source cache
 * owns the decoded texture and its retry/invalidate rules. This layer owns the
 * **lease**, the RGBA8 mip-byte budget and the generation tag.
 *
 * ## Bounded memory
 *
 * The complete set is preflighted together. If it cannot fit after evicting
 * unleased views oldest-first, no partial reservation is taken: the caller gets
 * `texture-budget` with the required and available byte counts and may retry
 * after the working set changes. Eviction disposes the finished upload, not just
 * its logical entry, so a sequence of disjoint working sets cannot accumulate
 * GPU textures on a live renderer.
 *
 * ## Lifetime
 *
 * Entries are reference counted and scoped: the same view key in two texture
 * scopes is two textures. A release at zero keeps the entry charged until it is
 * evicted or its Canvas generation retires; a concurrent acquisition in the same
 * generation joins its reference count. A Canvas generation change tags new
 * acquisitions with the new generation and refuses completions from the old one,
 * but it does not clear another live Canvas's entries. Lease releases capture the
 * exact entry they acquired, so an old lease can never delete a newer entry that
 * reused the same view key.
 */
import type { TextureLoadScope } from './texture-store';
import { loadFinishTexture, releaseFinishTexture } from './texture-store';
import type { FinishTextureViews } from './finish-sampling';
import type { Texture } from 'three';

export type FinishViewIssueCode =
	| 'texture-budget'
	| 'image-load-failed'
	| 'cancelled'
	| 'generation-mismatch';

export type FinishViewIssue = {
	readonly code: FinishViewIssueCode;
	readonly view?: string;
	readonly role?: MapRole;
	readonly required?: number;
	readonly available?: number;
	readonly action?: string;
	readonly message?: string;
};

export type FinishViewSource = {
	readonly view: string;
	readonly uri: string;
	readonly role: MapRole;
};

export type FinishViewLease = {
	readonly views: FinishTextureViews;
	readonly key: string;
	readonly issues: readonly FinishViewIssue[];
	leaseCount(): number;
	release(): void;
};

export type FinishViewStats = {
	/** Logical views held now (a reference count above zero). */
	readonly live: number;
	/** Views created, monotone. */
	readonly created: number;
	/** Views released to zero, monotone. */
	readonly released: number;
	/** Estimated RGBA8 mip bytes held now, including zero-reference entries. */
	readonly bytes: number;
	/** The current generation tag. */
	readonly generation: number;
	/** Budget refusals, monotone. */
	readonly refused: number;
};

/** The v1 steady ceiling; the measured gate may adopt a smaller one. */
export const DEFAULT_FINISH_VIEW_BUDGET_BYTES = 256 * 1024 * 1024;

/** A role name local to the render layer; the contract never crosses this edge. */
type MapRole = 'color' | 'normal' | 'roughness' | 'metalness' | 'occlusion';

/** The renderer's copy of the RGBA8 mip-byte formula (see project-model plan.ts). */
export function rgba8MipChainBytes(width: number, height: number): number {
	if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return 0;
	let total = 0;
	let w = Math.floor(width);
	let h = Math.floor(height);
	while (true) {
		total += w * h * 4;
		if (w === 1 && h === 1) break;
		w = Math.max(1, Math.floor(w / 2));
		h = Math.max(1, Math.floor(h / 2));
	}
	return total;
}

type Entry = {
	readonly key: string;
	readonly texture: Texture;
	readonly bytes: number;
	readonly generation: number;
	readonly scopeId: string;
	readonly source: FinishViewSource;
	refCount: number;
	lastUsed: number;
};

/** A logical view is scoped and generation-tagged; keys from two eras coexist. */
function entryKey(scopeId: string, generation: number, view: string): string {
	return `${scopeId}::${generation}::${view}`;
}

let entries = new Map<string, Entry>();
let budgetBytes = DEFAULT_FINISH_VIEW_BUDGET_BYTES;
let generation = 0;
let access = 0;
let created = 0;
let released = 0;
let refused = 0;

function heldBytes(): number {
	let total = 0;
	for (const entry of entries.values()) total += entry.bytes;
	return total;
}

/** The image's oriented pixel dimensions, or null before decode. */
function dimensionsOf(texture: Texture): { width: number; height: number } | null {
	const image = texture.image as
		| { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number }
		| null
		| undefined;
	if (image == null) return null;
	const width = image.naturalWidth ?? image.width;
	const height = image.naturalHeight ?? image.height;
	if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
	if ((width ?? 0) < 1 || (height ?? 0) < 1) return null;
	return { width: width!, height: height! };
}

/** Set the single v1 ceiling. Tests force a tiny ceiling; the product uses 256 MiB. */
export function setFinishViewBudget(bytes: number): void {
	if (!Number.isFinite(bytes) || bytes < 0) throw new Error('finish view budget must be finite and non-negative');
	budgetBytes = bytes;
}

export function finishViewBudget(): number {
	return budgetBytes;
}

/**
 * A Canvas generation changed.
 *
 * The tag advances monotonically across all Canvas hosts. Entries from earlier
 * generations stay charged and remain releasable by their exact leases; new
 * acquisitions never join them, and a budget-pressure eviction removes them
 * oldest-first. This deliberately does not clear the map: one Canvas recovering
 * must not wipe another live Canvas's accounting.
 */
export function setFinishViewGeneration(next: number): void {
	generation = Math.max(generation, next);
}

export function finishViewStats(): FinishViewStats {
	let live = 0;
	for (const entry of entries.values()) if (entry.refCount > 0) live += 1;
	return { live, created, released, bytes: heldBytes(), generation, refused };
}

/** Test-only: clear the logical cache without touching the texture source cache. */
export function resetFinishViewsForTests(): void {
	entries = new Map();
	generation = 0;
	access = 0;
	budgetBytes = DEFAULT_FINISH_VIEW_BUDGET_BYTES;
	created = 0;
	released = 0;
	refused = 0;
}

/**
 * Give back exactly one entry. Reaching zero records the release and leaves the
 * upload charged until eviction; it never removes a newer entry with the same
 * logical view.
 */
function releaseEntry(entry: Entry): void {
	if (entry.refCount <= 0) return;
	entry.refCount -= 1;
	if (entry.refCount > 0) return;
	entry.lastUsed = ++access;
	released += 1;
}

/**
 * Dispose one evicted upload. If another entry still names the same texture (two
 * view keys can share a URI and role), the texture stays until its final entry is
 * evicted. Removing the Finish source key makes a later acquire reload bytes
 * rather than hand back a disposed texture.
 */
function disposeEntry(entry: Entry, remaining: Iterable<Entry>): void {
	for (const other of remaining) {
		if (other.texture === entry.texture) return;
	}
	const disposed = releaseFinishTexture(entry.source.uri, entry.source.role, { scopeId: entry.scopeId });
	// A test loader or another owner may supply a texture that never entered the
	// source cache; disposal here is still safe and keeps the budget honest.
	if (!disposed) entry.texture.dispose();
}

/**
 * Evict unleased entries oldest-first, tie-breaking by key, until `needed` bytes
 * are free or no candidate remains. Referenced views are never evicted.
 */
function evictUnleased(protectedKeys: ReadonlySet<string>, needed: number): number {
	let available = 0;
	const candidates = [...entries.values()]
		.filter((entry) => entry.refCount === 0 && !protectedKeys.has(entry.key))
		.sort((left, right) => left.lastUsed - right.lastUsed || left.key.localeCompare(right.key));
	for (const entry of candidates) {
		entries.delete(entry.key);
		disposeEntry(entry, entries.values());
		available += entry.bytes;
		if (available >= needed) break;
	}
	return available;
}

function abortReason(signal: AbortSignal): unknown {
	return signal.reason ?? new DOMException('The acquisition was cancelled.', 'AbortError');
}

/** One view's load, with the scope's decode concurrency capped at two. */
const activeDecodes = new Map<string, number>();
const waiting = new Map<string, (() => void)[]>();

function wakeNext(scopeId: string): void {
	const queue = waiting.get(scopeId);
	const next = queue?.shift();
	if (next !== undefined) next();
}

function waitForDecodeSlot(scopeId: string, signal: AbortSignal | undefined): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const queue = waiting.get(scopeId) ?? [];
		waiting.set(scopeId, queue);
		const wake = (): void => {
			cleanup();
			resolve();
		};
		const onAbort = (): void => {
			const index = queue.indexOf(wake);
			if (index >= 0) queue.splice(index, 1);
			cleanup();
			reject(abortReason(signal!));
		};
		const cleanup = (): void => {
			signal?.removeEventListener('abort', onAbort);
		};
		queue.push(wake);
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

async function withDecodeSlot<T>(
	scopeId: string,
	task: () => Promise<T>,
	signal?: AbortSignal
): Promise<T> {
	// The wake queue is per scope: a woken waiter whose own scope is full must not
	// starve a different scope with both of its slots free.
	while ((activeDecodes.get(scopeId) ?? 0) >= 2) {
		if (signal?.aborted) {
			wakeNext(scopeId);
			throw abortReason(signal);
		}
		try {
			await waitForDecodeSlot(scopeId, signal);
		} catch (error) {
			// An aborted waiter consumed a wake-up; pass the turn to the next
			// waiter instead of leaving the queue asleep.
			wakeNext(scopeId);
			throw error;
		}
	}
	if (signal?.aborted) {
		wakeNext(scopeId);
		throw abortReason(signal);
	}
	activeDecodes.set(scopeId, (activeDecodes.get(scopeId) ?? 0) + 1);
	try {
		return await task();
	} finally {
		activeDecodes.set(scopeId, Math.max(0, (activeDecodes.get(scopeId) ?? 1) - 1));
		wakeNext(scopeId);
	}
}

/**
 * Acquire every view one sampled descriptor names.
 *
 * The returned lease must be released exactly once. `signal` cancels the whole
 * acquisition; nothing stays leased after an abort. A budget refusal produces a
 * lease with `views: {}` so the caller can draw the resolved constants and show
 * the scoped diagnostic instead of half a surface.
 */
export async function acquireFinishViews(
	sources: readonly FinishViewSource[],
	scope: TextureLoadScope | null,
	signal?: AbortSignal
): Promise<FinishViewLease> {
	const unique = new Map<string, FinishViewSource>();
	for (const source of sources) {
		if (!unique.has(source.view)) unique.set(source.view, source);
	}
	const ordered = [...unique.values()].sort((left, right) => left.view.localeCompare(right.view));
	const scopeId = scope?.scopeId ?? 'global';
	const key = `${scopeId}::${ordered.map((entry) => entry.view).join('|')}`;
	const startedGeneration = generation;
	const issues: FinishViewIssue[] = [];
	const acquired: Entry[] = [];
	const views: Record<string, Texture> = {};
	const pending = new Map<string, FinishViewSource>();
	const keyFor = (view: string): string => entryKey(scopeId, startedGeneration, view);

	/**
	 * Give back a decoded texture that never became an entry. It may already be
	 * shared with a live entry (two acquisitions raced), in which case that entry
	 * keeps the source cache reference; otherwise release the source key so a
	 * retry reloads bytes instead of receiving a disposed texture.
	 */
	const discardPending = (): void => {
		for (const source of pending.values()) {
			const texture = views[source.view];
			if (texture === undefined) continue;
			let shared = false;
			for (const entry of entries.values()) {
				if (entry.texture === texture) {
					shared = true;
					break;
				}
			}
			if (shared) continue;
			if (!releaseFinishTexture(source.uri, source.role, scope)) texture.dispose();
			delete views[source.view];
		}
		pending.clear();
	};

	const abort = (): FinishViewLease => {
		discardPending();
		for (const entry of acquired) releaseEntry(entry);
		return {
			views: {},
			key,
			issues,
			leaseCount: () => 0,
			release() {}
		};
	};

	if (signal?.aborted) {
		issues.push({ code: 'cancelled', action: 'Retry when the inspection is visible.' });
		return abort();
	}

	// Reuse every live view first; only the missing set is loaded and measured.
	const missing: FinishViewSource[] = [];
	for (const source of ordered) {
		const entry = entries.get(keyFor(source.view));
		if (entry === undefined) {
			missing.push(source);
			continue;
		}
		entry.refCount += 1;
		acquired.push(entry);
		views[source.view] = entry.texture;
	}

	const loadedBytes = new Map<string, number>();
	for (const source of missing) {
		if (signal?.aborted || generation !== startedGeneration) {
			issues.push({
				code: signal?.aborted ? 'cancelled' : 'generation-mismatch',
				view: source.view,
				role: source.role,
				action: signal?.aborted ? 'Retry when visible.' : 'Wait for the recovered Canvas, then requalify.'
			});
			return abort();
		}
		try {
			const texture = await withDecodeSlot(
				scopeId,
				() => loadFinishTexture(source.uri, source.role, scope),
				signal
			);
			if (generation !== startedGeneration) {
				issues.push({
					code: 'generation-mismatch',
					view: source.view,
					role: source.role,
					action: 'Wait for the recovered Canvas, then requalify.'
				});
				return abort();
			}
			if (signal?.aborted) {
				issues.push({ code: 'cancelled', view: source.view, role: source.role });
				return abort();
			}
			const dimensions = dimensionsOf(texture);
			loadedBytes.set(source.view, dimensions === null ? 0 : rgba8MipChainBytes(dimensions.width, dimensions.height));
			views[source.view] = texture;
			pending.set(source.view, source);
		} catch (error) {
			if (signal?.aborted) {
				issues.push({ code: 'cancelled', view: source.view, role: source.role });
				return abort();
			}
			issues.push({
				code: 'image-load-failed',
				view: source.view,
				role: source.role,
				message: error instanceof Error ? error.message : String(error),
				action: 'Retry the image or remove that role.'
			});
			return abort();
		}
	}

	// Another acquisition may have installed the same view while these bytes loaded.
	// The commit is synchronous, so re-check there and join the existing lease instead
	// of replacing its reference count.
	let required = 0;
	for (const source of missing) {
		if (!entries.has(keyFor(source.view))) required += loadedBytes.get(source.view) ?? 0;
	}
	const protectedKeys = new Set(acquired.map((entry) => entry.key));
	let available = Math.max(0, budgetBytes - heldBytes());
	if (required > available) {
		available += evictUnleased(protectedKeys, required - available);
	}
	if (required > available) {
		refused += 1;
		issues.push({
			code: 'texture-budget',
			required,
			available,
			action: 'Close another preview or lower the working set, then retry.'
		});
		return abort();
	}

	for (const source of missing) {
		const entryKeyForView = keyFor(source.view);
		const existing = entries.get(entryKeyForView);
		if (existing !== undefined) {
			existing.refCount += 1;
			views[source.view] = existing.texture;
			acquired.push(existing);
			pending.delete(source.view);
			continue;
		}
		const entry: Entry = {
			key: entryKeyForView,
			texture: views[source.view]!,
			bytes: loadedBytes.get(source.view) ?? 0,
			refCount: 1,
			generation: startedGeneration,
			scopeId,
			source,
			lastUsed: ++access
		};
		entries.set(entryKeyForView, entry);
		created += 1;
		acquired.push(entry);
		pending.delete(source.view);
	}

	let releasedOnce = false;
	return {
		views,
		key,
		issues,
		leaseCount: () => acquired.length,
		release() {
			if (releasedOnce) return;
			releasedOnce = true;
			for (const entry of acquired) releaseEntry(entry);
		}
	};
}
