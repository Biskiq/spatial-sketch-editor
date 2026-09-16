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
// The D5 third tier is the raw-ID *display* label (`W1`), not the bare ID.
import { formatPlacementLabel } from '../editor-outliner';
import type { LayoutSelection } from '../layout/layout-interaction';

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
 * The D2 tier order as one call, for copy that is read aloud to the user:
 * authored name → compact reference → raw-ID display label.
 *
 * Every surface that states an entity inside a sentence goes through these, so
 * the fallback tier cannot drift between the Inspector, the Plan and the
 * creation messages. A legacy document has no ledger and resolves to the
 * display label, never to the bare canonical ID.
 */
export function wallIdentityText(
	layout: LayoutDocument | LayoutDocumentWallFirst,
	wallId: string
): string {
	return identityPrimaryLabel(wallIdentity(layout, wallId), formatPlacementLabel(wallId));
}

export function openingIdentityText(
	layout: LayoutDocument | LayoutDocumentWallFirst,
	openingId: string
): string {
	return identityPrimaryLabel(openingIdentity(layout, openingId), formatPlacementLabel(openingId));
}

export function roomIdentityText(
	layout: LayoutDocument | LayoutDocumentWallFirst,
	roomId: string
): string {
	return identityPrimaryLabel(roomIdentity(layout, roomId), formatPlacementLabel(roomId));
}

export function junctionIdentityText(
	layout: LayoutDocument | LayoutDocumentWallFirst,
	junctionId: string
): string {
	return identityPrimaryLabel(junctionIdentity(layout, junctionId), formatPlacementLabel(junctionId));
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

/**
 * P23.12 D5/S7 — how the active Layout selection reads to a user: the human
 * kind plus the entity's identity (authored name → compact reference → raw-ID
 * display label).
 *
 * It never prints the internal `selection.kind` token — `physicalWall`,
 * `wallOpening`, `interiorAnchor` — which no other product surface exposes, and
 * it is the one place the Plan meta strip and the selected-target feedback
 * derive from, so the two cannot drift apart.
 */
export function layoutSelectionLabel(
	layout: LayoutDocument | LayoutDocumentWallFirst,
	selection: LayoutSelection
): string | null {
	switch (selection.kind) {
		case 'none':
			return null;
		case 'room':
			return `Room ${identityPrimaryLabel(
				roomIdentity(layout, selection.roomId),
				formatPlacementLabel(selection.roomId)
			)}`;
		case 'wall':
			// Legacy room-owned segment: the reference lookup simply misses and the
			// raw-ID display label carries the identity instead.
			return `Wall ${identityPrimaryLabel(
				wallIdentity(layout, selection.segmentId),
				formatPlacementLabel(selection.segmentId)
			)}`;
		case 'physicalWall':
			return `Wall ${identityPrimaryLabel(
				wallIdentity(layout, selection.wallId),
				formatPlacementLabel(selection.wallId)
			)}`;
		case 'junction':
			return `Junction ${identityPrimaryLabel(
				junctionIdentity(layout, selection.junctionId),
				formatPlacementLabel(selection.junctionId)
			)}`;
		case 'opening':
		case 'wallOpening':
			return `Opening ${identityPrimaryLabel(
				openingIdentity(layout, selection.openingId),
				formatPlacementLabel(selection.openingId)
			)}`;
		case 'interiorAnchor':
			// Legacy room-owned curve anchor: no ledger identity of its own.
			return 'Wall bend point';
		case 'object':
			// Layout objects are outside the `R/W/O/J` family: no reference exists.
			return 'Layout object';
	}
}
