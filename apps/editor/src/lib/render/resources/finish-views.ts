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
 * The complete set is preflighted together. If it cannot fit after removing every
 * unleased entry, no partial reservation is taken: the caller gets
 * `texture-budget` with the required and available byte counts and may retry
 * after the working set changes. That prevents two builds from each waiting on
 * the other's partial reservation.
 *
 * ## Lifetime
 *
 * Entries are reference counted and scoped: the same view key in two texture
 * scopes is two textures. A release at zero drops the logical view (the source
 * bytes stay in the source cache), so a later acquire is one cache hit. A
 * concurrent acquisition that installed the same view while another set loaded
 * joins its reference count instead of replacing it. A Canvas generation change
 * clears every logical entry and refuses completions that started under the old
 * generation.
 */
import type { TextureLoadScope } from './texture-store';
import { loadFinishTexture } from './texture-store';
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
	/** Estimated RGBA8 mip bytes held now. */
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
	readonly texture: Texture;
	readonly bytes: number;
	refCount: number;
	readonly generation: number;
};

/** A logical view is scoped: two projects may spell the same view key differently. */
function entryKey(scopeId: string, view: string): string {
	return `${scopeId}::${view}`;
}

let entries = new Map<string, Entry>();
let budgetBytes = DEFAULT_FINISH_VIEW_BUDGET_BYTES;
let generation = 0;
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

/** A Canvas generation changed: drop every logical view and refuse old completions. */
export function setFinishViewGeneration(next: number): void {
	generation = next;
	for (const entry of entries.values()) released += entry.refCount > 0 ? 1 : 0;
	entries = new Map();
}

export function finishViewStats(): FinishViewStats {
	return { live: entries.size, created, released, bytes: heldBytes(), generation, refused };
}

/** Test-only: clear the logical cache without touching the texture source cache. */
export function resetFinishViewsForTests(): void {
	entries = new Map();
	generation = 0;
	budgetBytes = DEFAULT_FINISH_VIEW_BUDGET_BYTES;
	created = 0;
	released = 0;
	refused = 0;
}

function releaseView(key: string): void {
	const entry = entries.get(key);
	if (entry === undefined) return;
	if (entry.refCount > 0) entry.refCount -= 1;
	if (entry.refCount > 0) return;
	entries.delete(key);
	released += 1;
}

/** One view's load, with the scope's decode concurrency capped at two. */
const activeDecodes = new Map<string, number>();
const waiting: (() => void)[] = [];

async function withDecodeSlot<T>(scopeId: string, task: () => Promise<T>): Promise<T> {
	while ((activeDecodes.get(scopeId) ?? 0) >= 2) {
		await new Promise<void>((resolve) => waiting.push(resolve));
	}
	activeDecodes.set(scopeId, (activeDecodes.get(scopeId) ?? 0) + 1);
	try {
		return await task();
	} finally {
		activeDecodes.set(scopeId, Math.max(0, (activeDecodes.get(scopeId) ?? 1) - 1));
		const next = waiting.shift();
		if (next !== undefined) next();
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
	const acquired: string[] = [];
	const views: Record<string, Texture> = {};
	const keyFor = (view: string): string => entryKey(scopeId, view);

	const abort = (): FinishViewLease => {
		for (const view of acquired) releaseView(view);
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
		acquired.push(keyFor(source.view));
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
			const texture = await withDecodeSlot(scopeId, () => loadFinishTexture(source.uri, source.role, scope));
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
		} catch (error) {
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
	const available = Math.max(0, budgetBytes - heldBytes());
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
		const key = keyFor(source.view);
		const existing = entries.get(key);
		if (existing !== undefined) {
			existing.refCount += 1;
			views[source.view] = existing.texture;
			acquired.push(key);
			continue;
		}
		entries.set(key, {
			texture: views[source.view]!,
			bytes: loadedBytes.get(source.view) ?? 0,
			refCount: 1,
			generation: startedGeneration
		});
		created += 1;
		acquired.push(key);
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
			for (const view of acquired) releaseView(view);
		}
	};
}
