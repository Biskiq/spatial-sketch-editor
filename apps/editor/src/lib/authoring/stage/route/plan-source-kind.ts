import type { PlanSourceKind } from '@portfolio/layout-core/world';
import type { StageHitSourceKind } from '../facade/adapter-contract';

/** A Plan source kind, or null for the Stage-only Room lid hit. */
export function planSourceKindOf(kind: StageHitSourceKind): PlanSourceKind | null {
	return kind === 'room-lid' ? null : kind;
}
