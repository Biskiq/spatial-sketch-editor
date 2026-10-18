/**
 * T1.P01.S04 — bounded explicit-ID architectural preset creation.
 *
 * `planCommitLayoutObjectPreset` owns preset semantics and deterministically
 * allocates `layout-object-N` from the pre-commit candidate. F.4 acceptance
 * requires the caller to capture a created identity **before** evaluation, so
 * this module is the explicit-ID input the slice's Place → Layout plinth item
 * needs: the retained planner still owns the geometry, the validation and the
 * allocation rule, and its answer must agree with the captured id.
 *
 * It deliberately cannot inject an arbitrary id. If the retained planner
 * allocates anything other than the captured id — a document that changed
 * between capture and evaluation — this refuses rather than accepting a hidden
 * allocation, which would make Redo restore an identity nobody captured.
 */

import type { LayoutVec2 } from './layout-types.js';
import {
	layoutArchitecturalPreset,
	planCommitLayoutObjectPreset,
	type LayoutArchitecturalPresetId,
	type PrecisionPlan
} from './layout-wall-first-precision.js';
import type { LayoutDocumentWallFirst } from './layout-wall-first-types.js';

/**
 * The id `planCommitLayoutObjectPreset` will allocate for this document and
 * preset, computed by the same public rule it uses. A caller captures this
 * before building the intent; it is not an independent allocator.
 */
export function nextLayoutPresetObjectId(document: LayoutDocumentWallFirst): string {
	const taken = new Set(document.objects.map((object) => object.id));
	let index = document.objects.length + 1;
	while (taken.has(`layout-object-${index}`)) index += 1;
	return `layout-object-${index}`;
}

/**
 * Create one ordinary LayoutObject with an explicit, previously captured id.
 *
 * Refusals: an unknown preset, a non-finite point/elevation and a non-positive
 * preset dimension are the retained planner's own rejections; a captured id the
 * retained planner would not allocate is refused here as `invalid_value` with
 * the captured and allocated ids named, and no object is created.
 */
export function planCommitLayoutObjectPresetWithId(
	document: LayoutDocumentWallFirst,
	presetId: LayoutArchitecturalPresetId,
	point: LayoutVec2,
	floorElevation: number,
	capturedObjectId: string
): PrecisionPlan {
	if (layoutArchitecturalPreset(presetId) === undefined) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'invalid_reference',
				message: `Unknown architectural preset '${presetId}'`,
				targetIds: [presetId]
			}
		};
	}
	if (capturedObjectId.length === 0) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'invalid_value',
				message: 'Preset creation requires a captured object id',
				targetIds: [presetId]
			}
		};
	}
	const planned = planCommitLayoutObjectPreset(document, presetId, point, floorElevation);
	if (planned.kind === 'rejected') return planned;
	if (planned.createdObjectId !== capturedObjectId) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'invalid_value',
				message: `Preset creation allocated '${planned.createdObjectId ?? '(none)'}', not the captured '${capturedObjectId}'; capture the id again before placing`,
				targetIds: [capturedObjectId, planned.createdObjectId ?? presetId]
			}
		};
	}
	return planned;
}
