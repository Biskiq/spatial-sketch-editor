/**
 * T1.P01.S04 — bounded explicit-ID architectural preset creation.
 *
 * `planCommitLayoutObjectPreset` owns preset semantics. T1.P02.S01 §1 captures
 * the created identity **before** evaluation: the operation's nonce derives the
 * `layout-object-N` seed, so the id is fixed at intent time and never read from
 * the document's occupancy. This module is the explicit-ID seam the Place →
 * Layout plinth item needs: the retained planner still owns the geometry and the
 * validation, and its answer must agree with the captured id.
 *
 * It deliberately cannot inject an arbitrary id. If the derived id and the
 * captured id disagree — a document that changed between capture and evaluation
 * — this refuses rather than accepting a hidden allocation, which would make
 * Redo restore an identity nobody captured.
 */

import type { LayoutVec2 } from './layout-coordinates.js';
import {
	layoutArchitecturalPreset,
	planCommitLayoutObjectPreset,
	type LayoutArchitecturalPresetId,
	type PrecisionPlan
} from './layout-wall-first-precision.js';
import type { LayoutDocumentWallFirst } from './layout-wall-first-types.js';
import { layoutCapturedId, layoutWorkingLevelIssue, type LayoutIdCapture } from './layout-id-capture.js';

/**
 * The id a preset placement derives from this operation's captured nonce and
 * its own `layout-object-N` seed. The caller captures this before building the
 * intent; the planner re-derives it and refuses any disagreement.
 */
export function nextLayoutPresetObjectId(
	document: LayoutDocumentWallFirst,
	capture: LayoutIdCapture
): string {
	return layoutCapturedId(capture, `layout-object-${document.objects.length + 1}`);
}

/**
 * Create one ordinary LayoutObject with an explicit, previously captured id.
 *
 * Refusals: an unknown preset, a non-finite point/elevation and a non-positive
 * preset dimension are the retained planner's own rejections; a captured id
 * that this operation's nonce does not derive is refused here as `invalid_value`
 * with both ids named, and no object is created.
 */
export function planCommitLayoutObjectPresetWithId(
	document: LayoutDocumentWallFirst,
	presetId: LayoutArchitecturalPresetId,
	point: LayoutVec2,
	floorElevation: number,
	capture: LayoutIdCapture,
	capturedObjectId: string,
	levelId: string
): PrecisionPlan {
	const levelIssue = layoutWorkingLevelIssue(document, levelId);
	if (levelIssue !== null) {
		return {
			kind: 'rejected',
			rejection: { code: 'invalid_value', message: levelIssue, targetIds: [presetId] }
		};
	}
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
	const expected = nextLayoutPresetObjectId(document, capture);
	if (expected !== capturedObjectId) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'invalid_value',
				message: `Preset creation captured '${capturedObjectId}', but this operation's nonce derives '${expected}'; capture the id again before placing`,
				targetIds: [capturedObjectId, expected]
			}
		};
	}
	const planned = planCommitLayoutObjectPreset(
		document,
		presetId,
		point,
		floorElevation,
		capturedObjectId,
		levelId
	);
	if (planned.kind === 'rejected') return planned;
	if (planned.createdObjectId !== capturedObjectId) {
		return {
			kind: 'rejected',
			rejection: {
				code: 'invalid_value',
				message: `Preset creation created '${planned.createdObjectId ?? '(none)'}', not the captured '${capturedObjectId}'; capture the id again before placing`,
				targetIds: [capturedObjectId, planned.createdObjectId ?? presetId]
			}
		};
	}
	return planned;
}
