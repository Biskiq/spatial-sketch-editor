/**
 * `layout-duplicate.ts` — duplicate and linear repeat.
 *
 * Deterministic two-pass clone/remap planners over an immutable wall-first
 * document:
 *
 * ```text
 * collect source graph in stable order
 * → allocate all new IDs
 * → build old→new maps
 * → clone
 * → remap internal references
 * → apply per-copy transform/offset from the ORIGINAL source
 * → validate the complete batch with the canonical gates
 * → commit once
 * ```
 *
 * Copies are never generated from the preceding copy — every position is
 * `index × delta` from the original source so no accumulated drift can enter.
 * No timestamps, no random IDs. Any invalid copy rejects the whole batch and
 * the caller commits nothing (invalid/no-op → no history).
 *
 * Supported targets:
 * - one supported document-level Layout object;
 * - one Wall-hosted Opening on its current Wall;
 * - any Room, cloned as a **free island** with a private copy of its complete
 *   boundary enclosure (`planDuplicateRoom`);
 * - one **isolated** Room (`planDuplicateIsolatedRoom`, the stricter A4 path
 *   retained for its callers).
 */

export { LAYOUT_DUPLICATE_MAX_COPIES } from './duplicate/contracts';
export type {
	DuplicateOperation,
	DuplicateRejectionCode,
	DuplicateRejection,
	RoomCopyCorrespondence,
	DuplicatePlan,
	LayoutObjectRepeatIntent,
	WallOpeningRepeatIntent,
	RoomDuplicateIntent
} from './duplicate/contracts';
export { isSupportedDuplicateLayoutObject, planRepeatLayoutObject } from './duplicate/objects';
export { planRepeatWallOpening } from './duplicate/openings';
export { planDuplicateIsolatedRoom, planDuplicateRoom } from './duplicate/rooms';
