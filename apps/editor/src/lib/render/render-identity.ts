/**
 * Owned render identity.
 *
 * A rendered object is found by the id its representation recorded, never by the
 * name it was given. Names stay on objects for debugging; no code parses them.
 *
 * Two pieces make that true:
 *
 * - **A plain-JSON tag on `userData`**, written by whoever builds the object. It
 *   survives `Object3D.copy` (which JSON-clones `userData`), so a retained mesh
 *   that is patched in place keeps the identity of the thing it now draws.
 * - **An index each representation keeps** (`objectOf`), so a consumer asks the
 *   owner "which object draws this id?" instead of searching a subtree.
 *
 * This module is renderer-neutral and shared with the visitor; it imports only
 * the Three `Object3D` type.
 */
import type { Object3D } from 'three';

/** The kinds of Layout render item whose identity is owned by a representation. */
export type RenderIdentityKind = 'wall' | 'wall-failure' | 'object' | 'floor';

/** The tag recorded on an object's `userData`. Plain data: it must stay JSON-cloneable. */
export type RenderIdentity = {
	readonly kind: RenderIdentityKind;
	readonly id: string;
};

const KEY = 'renderIdentity';

/** A fresh plain tag, for a host that assigns `userData` declaratively. */
export function renderIdentity(kind: RenderIdentityKind, id: string): { renderIdentity: RenderIdentity } {
	return { [KEY]: { kind, id } };
}

/** Record `kind`/`id` on `object` and return it. */
export function tagRenderIdentity<T extends Object3D>(object: T, kind: RenderIdentityKind, id: string): T {
	object.userData[KEY] = { kind, id } satisfies RenderIdentity;
	return object;
}

/** The identity recorded on exactly this object, or null. Never walks parents and never reads `name`. */
export function renderIdentityOf(object: Object3D): RenderIdentity | null {
	const tag = object.userData[KEY] as Partial<RenderIdentity> | undefined;
	return tag !== undefined && typeof tag.kind === 'string' && typeof tag.id === 'string'
		? (tag as RenderIdentity)
		: null;
}

/** What a consumer needs from the Layout render owners: id → the object that draws it. */
export type LayoutIdentityIndex = {
	/**
	 * The retained object drawing `id`, or null when nothing does (never built,
	 * released, or disposed). A Wall that failed to build resolves to its failure
	 * surface; read {@link renderIdentityOf} to tell the two apart.
	 */
	objectOf(kind: 'wall' | 'object' | 'floor', id: string): Object3D | null;
};

/**
 * Reconcile a representation's hidden set against a new one.
 *
 * Visibility writes are proportional to the ids whose state changed: each id leaving
 * the set is shown, each id entering it is hidden, and ids in both are untouched.
 * (Finding what changed walks both sets, so the scan is proportional to their size;
 * the sets are the host's display overlay, not the document.) The
 * returned set is the new current set (the caller keeps it so a later-built item
 * with a hidden id is born hidden).
 */
export function reconcileHidden(
	current: ReadonlySet<string>,
	next: ReadonlySet<string>,
	setHidden: (id: string, hidden: boolean) => void
): Set<string> {
	for (const id of current) if (!next.has(id)) setHidden(id, false);
	for (const id of next) if (!current.has(id)) setHidden(id, true);
	return new Set(next);
}
