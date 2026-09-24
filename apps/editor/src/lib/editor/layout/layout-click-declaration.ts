/**
 * P23B.3a S6 — what a CLICK declares.
 *
 * The policy reads the operation's DECLARED intent and never the geometry: the
 * planner adopts an existing Junction, splits a host Wall or nodes an overlap
 * only when the caller says which group the operation extends. The snap layer is
 * the only layer that knows which canonical element the author deliberately
 * clicked, so it is the layer that must say so — and this module is that
 * translation, in one place, so the viewport and the editor-side test helpers
 * cannot disagree about what a click means.
 *
 * Two rules, both conservative:
 *
 * ```text
 * junction   exactly ONE existing Junction record coincides with the point
 *            → declare that identity. SEVERAL coincident records (independent
 *            coincidence is permitted geometry now) is AMBIGUOUS: declare
 *            nothing rather than let record order pick the group.
 * wall-span  the point lies on a straight Wall's SPAN (strict interior)
 *            → declare that host.
 * ```
 *
 * A click on empty canvas declares nothing, which is INDEPENDENT placement
 * (class 2) — a legitimate authoring outcome, not a failure.
 */
import { coincidesAsJunction, type LayoutDocumentWallFirst, type LayoutVec2, type SnapResolution } from '@portfolio/layout-core';

import type { WallAnchorDeclaration } from './layout-preview-state.svelte';

/**
 * The Junction a point resolves to, or `null` when none or SEVERAL records
 * coincide with it. Coincidence uses the canonical `coincidesAsJunction`
 * predicate — the same tolerance the planner applies to a declared anchor.
 */
export function declaredJunctionAtPoint(
	document: LayoutDocumentWallFirst,
	point: LayoutVec2
): string | null {
	const coincident = document.junctions.filter((junction) =>
		coincidesAsJunction(junction.point, point)
	);
	return coincident.length === 1 ? coincident[0]!.id : null;
}

/**
 * The straight Wall whose span carries `point`, or `null`. Strict interior only:
 * landing on the span's endpoint is a Junction attachment, and the two declare
 * different things.
 */
export function declaredHostWallAtSpan(
	document: LayoutDocumentWallFirst,
	point: LayoutVec2
): string | null {
	const pointById = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
	for (const wall of document.walls) {
		if (wall.centerline.kind !== 'line') continue;
		const start = pointById.get(wall.startJunctionId);
		const end = pointById.get(wall.endJunctionId);
		if (!start || !end) continue;
		const dx = end[0] - start[0];
		const dz = end[1] - start[1];
		const squared = dx * dx + dz * dz;
		if (!(squared > 0)) continue;
		const t = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / squared;
		if (!(t > 0 && t < 1)) continue;
		// The canonical identity tolerance decides "on the span", so a wall-span
		// declaration follows the same rule as every other coincidence in the policy.
		if (
			coincidesAsJunction([start[0] + dx * t, start[1] + dz * t], point)
		) {
			return wall.id;
		}
	}
	return null;
}

/**
 * The declaration a resolved snap expresses. The winning candidate's KIND is
 * authoritative — a `wall-span` snap declares its host even if some Junction
 * happens to sit at the same coordinate, and a `junction` snap declares the
 * single coincident record — so a preview's remembered candidate can never be
 * re-read as a different statement than the author made.
 */
export function layoutClickAnchorDeclaration(
	document: LayoutDocumentWallFirst,
	snapped: { point: LayoutVec2; resolution: SnapResolution }
): WallAnchorDeclaration {
	if (snapped.resolution.kind !== 'snap') return {};
	const candidate = snapped.resolution.candidate;
	if (candidate.kind === 'wall-span') {
		return candidate.wallId ? { hostWallId: candidate.wallId } : {};
	}
	if (candidate.kind !== 'junction') return {};
	const junctionId = declaredJunctionAtPoint(document, snapped.point);
	return junctionId ? { junctionId } : {};
}

/**
 * The declaration a click expresses when there is no snap resolution to read —
 * the same two rules applied to the point alone. Used by the editor-side suites
 * that drive the commit path without a live snap layer.
 */
export function layoutPointAnchorDeclaration(
	document: LayoutDocumentWallFirst,
	point: LayoutVec2
): WallAnchorDeclaration {
	const junctionId = declaredJunctionAtPoint(document, point);
	if (junctionId) return { junctionId };
	const hostWallId = declaredHostWallAtSpan(document, point);
	return hostWallId ? { hostWallId } : {};
}
