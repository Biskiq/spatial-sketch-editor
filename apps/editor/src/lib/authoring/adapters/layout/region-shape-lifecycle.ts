/**
 * V3c — the one lifecycle for the Edit shape session.
 *
 * The shape store holds only the Region id; this module owns the two things
 * that must happen together when that session can no longer exist: clear the
 * id, and put the Camera back if it is still facing that Region's Section.
 * A roof that becomes Flat, or a Region that is no longer selected, has no
 * section joints to manipulate, so leaving the session open would suppress the
 * ordinary corner/body/turn writers with nothing left to drag.
 */
import type { LayoutRegionForm } from '@portfolio/layout-core/wall';

import { regionShape } from '$lib/authoring/layout/region-shape-store';
import { wallFace } from '$lib/authoring/layout/wall-face-store';

import { regionSectionKey } from './region-section';

/** Clear Edit shape, restoring the Section camera only if it is the live Face. */
export function closeRegionShape(): boolean {
	const regionId = regionShape.current();
	if (regionId === null) return false;
	const sectionKey = regionSectionKey(regionId);
	if (wallFace.isActive(sectionKey)) wallFace.putBack(sectionKey);
	regionShape.close();
	return true;
}

/**
 * End an Edit shape session the selected Region can no longer support.
 * Returns whether the session changed, so the caller can refresh its marks.
 */
export function syncRegionShape(
	selected: { readonly id: string; readonly form: LayoutRegionForm } | null,
): boolean {
	const active = regionShape.current();
	if (active === null) return false;
	if (selected !== null && selected.id === active && selected.form.kind !== 'flat') return false;
	return closeRegionShape();
}
