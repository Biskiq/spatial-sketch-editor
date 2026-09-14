/**
 * `hierarchy-plan-bridge.ts` — P23.6e slice 7 (plan §Hover/focus → Plan emphasis).
 *
 * Pure conversion from the Navigator's transient `HierarchyEntityKey` emphasis
 * to the **existing** Plan hover identity (`PlanHitIdentity`). The Plan surface
 * already owns exactly one hover renderer and one hover vocabulary; the
 * Navigator contributes only a canonical identity, never a second renderer, a
 * selection, a camera move or a history entry.
 *
 * Deliberately total-but-honest about what Plan can express:
 * - Room / Wall / Opening / Junction / Layout Object map to their canonical
 *   wall-first hit (the existing `-hovered` tokens);
 * - Scene clusters and Scene entities have no *layout hit* identity, so they
 *   map to `null` here. Scene entities use the separate footprint presentation
 *   bridge below; a cluster still has no geometry of its own.
 *
 * No Svelte, DOM, renderer or mutation imports: this module is a lookup table.
 */

import type { PlanHitIdentity } from '$lib/layout/plan-render-model';
import type { HierarchyEntityKey } from './hierarchy-source-index';

/**
 * Canonical Navigator entity → Plan hover identity, or `null` when Plan has no
 * representation for it (Scene content, and any future non-Plan owner).
 */
export function hierarchyEntityToPlanHit(entity: HierarchyEntityKey): PlanHitIdentity | null {
	switch (entity.kind) {
		case 'room':
			return { kind: 'room', roomId: entity.roomId };
		case 'wall':
			return { kind: 'physicalWall', wallId: entity.wallId };
		case 'opening':
			return { kind: 'wallOpening', wallId: entity.wallId, openingId: entity.openingId };
		case 'junction':
			return { kind: 'junction', junctionId: entity.junctionId };
		case 'object':
			return { kind: 'object', objectId: entity.objectId };
		case 'cluster':
		case 'entity':
			return null;
	}
}

/** Scene entity → existing Plan footprint identity, or null for clusters. */
export function hierarchyEntityToScenePlanId(entity: HierarchyEntityKey): string | null {
	return entity.owner === 'scene' && entity.kind === 'entity' ? entity.entityId : null;
}
