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
 *            → declare that host, but ONLY when exactly one Wall carries the
 *            point. Independent Walls may legally overlap, so a point can sit on
 *            several spans at once; picking the first would be an arbitrary
 *            statement about which group the operation extends, so AMBIGUITY
 *            DECLARES NOTHING.
 * ```
 *
 * The geometry-only rules above are the FALLBACK. A click that resolved through
 * the canonical snap layer is stronger evidence: that layer ran the deterministic
 * winner order and named ONE candidate, so `layoutClickAnchorDeclaration` may
 * declare the winner's host even where the point alone would be ambiguous — but
 * still only after validating that the identified Wall really carries the point
 * (canonical chord/sampled authority). A specific, validated winner declares; a
 * geometric guess never does.
 *
 * A click on empty canvas declares nothing, which is INDEPENDENT placement
 * (class 2) — a legitimate authoring outcome, not a failure.
 */
import {
	coincidesAsJunction,
	wallCenterlineCarriesPoint,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type SnapResolution
} from '@portfolio/layout-core';

import type { WallAnchorDeclaration } from './layout-preview-state.svelte';

/** The resolved endpoint coordinates of `wall` in `document`, if both resolve. */
function wallEndpoints(
	document: LayoutDocumentWallFirst,
	wall: LayoutWall
): { start: LayoutVec2; end: LayoutVec2 } | undefined {
	const pointById = new Map(document.junctions.map((junction) => [junction.id, junction.point]));
	const start = pointById.get(wall.startJunctionId);
	const end = pointById.get(wall.endJunctionId);
	return start && end ? { start, end } : undefined;
}

/**
 * Whether the point is a strict-interior station of this straight Wall's span.
 * Landing on the span's endpoint is a Junction attachment, which declares a
 * different thing, so endpoints are excluded here.
 */
function wallSpanCarriesPoint(
	document: LayoutDocumentWallFirst,
	wall: LayoutWall,
	point: LayoutVec2
): boolean {
	if (wall.centerline.kind !== 'line') return false;
	const endpoints = wallEndpoints(document, wall);
	if (!endpoints) return false;
	const dx = endpoints.end[0] - endpoints.start[0];
	const dz = endpoints.end[1] - endpoints.start[1];
	const squared = dx * dx + dz * dz;
	if (!(squared > 0)) return false;
	const t = ((point[0] - endpoints.start[0]) * dx + (point[1] - endpoints.start[1]) * dz) / squared;
	if (!(t > 0 && t < 1)) return false;
	// The canonical identity tolerance decides "on the span", so a wall-span
	// declaration follows the same rule as every other coincidence in the policy.
	return coincidesAsJunction([endpoints.start[0] + dx * t, endpoints.start[1] + dz * t], point);
}

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
 * The straight Wall whose span (strict interior) carries `point`, or `null`.
 *
 * Strict interior only, for the same reason as {@link wallSpanCarriesPoint} — and
 * UNIQUE only: independent Walls with overlapping geometry are permitted, so a
 * point can sit on the span of more than one Wall at once (a crossing of two
 * independent Walls, say). Record order is not a statement about which host the
 * author meant, so several carriers yield `null` rather than the first one. Use
 * the snap-resolved form (`layoutClickAnchorDeclaration`) when the click named a
 * specific Wall.
 */
export function declaredHostWallAtSpan(
	document: LayoutDocumentWallFirst,
	point: LayoutVec2
): string | null {
	const carriers = document.walls.filter((wall) => wallSpanCarriesPoint(document, wall, point));
	return carriers.length === 1 ? carriers[0]!.id : null;
}

/**
 * The host a resolved `wall-span` snap names, when the point really lies on that
 * Wall. The snap layer has already picked a deterministic, specifically
 * identified winner, so this validates rather than re-guesses: it confirms the
 * named Wall exists and that the snapped point sits on its centerline (chord for
 * a straight Wall, canonical sampled projection for a curved one). Anything that
 * fails validation declares nothing.
 */
export function declaredHostWallForSnap(
	document: LayoutDocumentWallFirst,
	wallId: string,
	point: LayoutVec2
): string | null {
	const wall = document.walls.find((candidate) => candidate.id === wallId);
	if (!wall) return null;
	const endpoints = wallEndpoints(document, wall);
	if (!endpoints) return null;
	return wallCenterlineCarriesPoint(wall, endpoints.start, endpoints.end, point) ? wall.id : null;
}

/**
 * The declaration a resolved snap expresses. The winning candidate's KIND is
 * authoritative — a `wall-span` snap declares its host even if some Junction
 * happens to sit at the same coordinate, and a `junction` snap declares the
 * single coincident record — so a preview's remembered candidate can never be
 * re-read as a different statement than the author made. The `wall-span` host is
 * still validated against the point (see {@link declaredHostWallForSnap}): a
 * snap that identified a Wall the point does not lie on declares nothing.
 */
export function layoutClickAnchorDeclaration(
	document: LayoutDocumentWallFirst,
	snapped: { point: LayoutVec2; resolution: SnapResolution }
): WallAnchorDeclaration {
	if (snapped.resolution.kind !== 'snap') return {};
	const candidate = snapped.resolution.candidate;
	if (candidate.kind === 'wall-span') {
		if (!candidate.wallId) return {};
		const hostWallId = declaredHostWallForSnap(document, candidate.wallId, snapped.point);
		return hostWallId ? { hostWallId } : {};
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
