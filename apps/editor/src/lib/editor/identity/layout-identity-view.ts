/**
 * `identity/layout-identity-view.ts` — the P23.12 shared display-identity
 * layer (D5).
 *
 * One identity vocabulary for Navigator, search, Inspector and Plan: every
 * surface asks this layer how an entity reads, instead of formatting raw
 * canonical IDs.
 *
 * The three tiers (D2):
 * - **reference** — the compact `R/W/O/J` token from the document's identity
 *   ledger. Presentation identity only: it never keys selection, history or
 *   topology, and it never truncates.
 * - **authored name** — primary where one exists (Rooms always; Walls and
 *   Openings optionally). May truncate under pressure.
 * - **raw canonical ID** — the secondary/debug tier, reachable via `title`
 *   attributes and Technical details.
 *
 * Derivation is read-only over the wall-first document: nothing here mutates,
 * and a document without a ledger (legacy or pre-normalization) resolves
 * every entity to `null` so callers fall back to the raw-ID label.
 */
import {
	referenceFor,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import type { LayoutDocument } from '$lib/layout/layout-types';

/** The identity presentation for one entity, resolved from the document. */
export type IdentityView = {
	/**
	 * The compact reference (`W-7K3M`), or `null` when the document carries no
	 * resolved ledger for the entity. `null` is the unnamed-by-ledger state:
	 * callers fall back to the raw-ID display label.
	 */
	reference: string | null;
	/** The authored name, or `null` when the entity kind has none. */
	name: string | null;
	/** Whether the authored name is editable in the Inspector (Junctions: never). */
	nameEditable: boolean;
};

export type IdentityFamily = 'rooms' | 'walls' | 'openings' | 'junctions';

function isWallFirst(layout: LayoutDocument | LayoutDocumentWallFirst): layout is LayoutDocumentWallFirst {
	return 'formatVersion' in layout;
}

function resolveReference(
	layout: LayoutDocument | LayoutDocumentWallFirst,
	family: IdentityFamily,
	id: string
): string | null {
	if (!isWallFirst(layout)) return null;
	return referenceFor(layout, family, id) ?? null;
}

/** A named Wall/Opening: authored name, resolved at the source index. */
export function wallIdentity(
	layout: LayoutDocument | LayoutDocumentWallFirst,
	wallId: string
): IdentityView {
	return {
		reference: resolveReference(layout, 'walls', wallId),
		name: isWallFirst(layout) ? (layout.walls.find((wall) => wall.id === wallId)?.name ?? null) : null,
		nameEditable: true
	};
}

export function openingIdentity(
	layout: LayoutDocument | LayoutDocumentWallFirst,
	openingId: string
): IdentityView {
	return {
		reference: resolveReference(layout, 'openings', openingId),
		name: isWallFirst(layout)
			? (layout.openings.find((opening) => opening.id === openingId)?.name ?? null)
			: null,
		nameEditable: true
	};
}

export function roomIdentity(
	layout: LayoutDocument | LayoutDocumentWallFirst,
	roomId: string
): IdentityView {
	return {
		reference: resolveReference(layout, 'rooms', roomId),
		name: isWallFirst(layout) ? (layout.rooms.find((room) => room.id === roomId)?.name ?? null) : null,
		nameEditable: true
	};
}

export function junctionIdentity(
	layout: LayoutDocument | LayoutDocumentWallFirst,
	junctionId: string
): IdentityView {
	return {
		reference: resolveReference(layout, 'junctions', junctionId),
		name: null,
		nameEditable: false
	};
}

/**
 * The row label for an entity: **authored name when one exists, otherwise the
 * compact reference**. When both are missing (a document with no ledger yet)
 * callers pass their `fallback` — the raw-ID display label — so a row is
 * always renderable.
 */
export function identityPrimaryLabel(
	identity: IdentityView,
	fallback: string
): string {
	return identity.name ?? identity.reference ?? fallback;
}

/**
 * The secondary identity span: the compact reference beside a primary name.
 * `null` when there is nothing subordinate to show (unnamed entity — the
 * reference is already the primary label — or no reference at all).
 */
export function identitySecondaryReference(
	identity: IdentityView
): string | null {
	if (identity.name === null) return null;
	return identity.reference;
}

/**
 * `true` when the authored name equals the reference: compact presentation
 * renders the string once (the design contract's duplicate-collapse rule).
 */
export function identityCollapsesToSingleLabel(identity: IdentityView): boolean {
	return identity.name !== null && identity.reference !== null && identity.name === identity.reference;
}
