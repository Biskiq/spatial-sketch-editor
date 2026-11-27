/**
 * `layout-region-form.ts` — the one evaluator of an authored Region form.
 *
 * A form is a profile extruded across the footprint and clipped by it (V3a,
 * §7.1). Let `d = (cos azimuth, sin azimuth)` and `q(p) = p · d`; `qMin` and
 * `qMax` are the footprint's projected extremes. For an overhead Region the
 * authored `elevation` is the eave, the lowest underside:
 *
 * ```text
 * shed   underside(p) = eave + rise * (q(p) - qMin) / (qMax - qMin)
 * gable  qr = (qMin + qMax) / 2 + ridgeOffset
 *        underside(p) = eave + rise * (q(p) - qMin) / (qr - qMin)   q(p) <= qr
 *                     = eave + rise * (qMax - q(p)) / (qMax - qr)   q(p) >= qr
 * top(p) = underside(p) + thickness
 * ```
 *
 * `regionUndersideAt` and `regionTopAt` are the only public evaluators: the
 * compiler, the overhead-support query, relations and the V3b fits all read the
 * same function. `regionUndersideNormalAt` is the matching true surface normal
 * for support evidence; it is derived from the same profile, not from a face
 * enumeration, so it stays exact at an off-centre ridge.
 *
 * This module is deliberately free of document, compiler and renderer imports.
 * It is shared by the codec, the compiler and the room queries.
 */
import type { Vec3 } from '../../kernel/types';
import type { LayoutVec2 } from '../../geometry/coordinates';
import { LAYOUT_GEOMETRY_EPSILON } from '../../geometry/openings';
import type { LayoutRegion, LayoutRegionForm } from '../../wall/types';

/** The projected extent of one footprint along the form's azimuth. */
export type RegionFormProfile = {
	/** Canonical plan azimuth in `(-pi, pi]`. */
	readonly azimuth: number;
	readonly qMin: number;
	readonly qMax: number;
	/**
	 * Where the form reaches `rise`: the high eave of a shed, or a gable's
	 * ridge. `qMin < qRidge <= qMax`.
	 */
	readonly qRidge: number;
	/** Projected run from the low eave to `qRidge`; zero for a shed. */
	readonly runBelow: number;
	/** Projected run from `qRidge` to the high eave; zero for a shed. */
	readonly runAbove: number;
};

/** The structural facts every form evaluation needs, authored or compiled. */
export type RegionFormFacts = {
	readonly role: LayoutRegion['role'];
	readonly form: LayoutRegionForm;
	readonly footprint: readonly LayoutVec2[];
	/** World Y of the datum face at its lowest point: the eave. */
	readonly datumY: number;
	readonly thickness: number;
};

const TAU = Math.PI * 2;

/**
 * Canonical plan azimuth in `(-pi, pi]`.
 *
 * A direction is periodic, so the codec normalizes any finite authored angle
 * once instead of carrying two spellings of the same form. `-pi` maps to `pi`;
 * `-0` maps to `0` so canonical bytes never depend on the sign of zero.
 */
export function normalizeRegionAzimuth(azimuth: number): number {
	if (!Number.isFinite(azimuth)) return azimuth;
	let value = azimuth % TAU;
	if (value <= -Math.PI) value += TAU;
	else if (value > Math.PI) value -= TAU;
	// `%` can leave `-0`; canonical bytes must not depend on that sign.
	return value === 0 ? 0 : value;
}

/** `q = p · d`, the projected station of one plan point along the form. */
export function regionFormQ(azimuth: number, point: LayoutVec2): number {
	return point[0] * Math.cos(azimuth) + point[1] * Math.sin(azimuth);
}

/**
 * The derived profile of one form over a footprint, or `null` when the shape
 * has no usable projected run. A flat form has no profile: it evaluates at its
 * datum everywhere.
 *
 * A gable's ridge must be strictly inside the projected half extent. The check
 * lives here because the extent is derived from the footprint; the codec cannot
 * know it at read time, so the shared admission and the compiler both call this.
 */
export function regionFormProfile(
	form: LayoutRegionForm,
	footprint: readonly LayoutVec2[],
): RegionFormProfile | null {
	if (form.kind === 'flat') return null;
	if (!Number.isFinite(form.rise) || form.rise <= 0) return null;
	if (!Number.isFinite(form.azimuth)) return null;
	const azimuth = normalizeRegionAzimuth(form.azimuth);
	if (!Number.isFinite(azimuth)) return null;
	const cos = Math.cos(azimuth);
	const sin = Math.sin(azimuth);
	let qMin = Infinity;
	let qMax = -Infinity;
	for (const [x, z] of footprint) {
		const q = x * cos + z * sin;
		if (!Number.isFinite(q)) return null;
		if (q < qMin) qMin = q;
		if (q > qMax) qMax = q;
	}
	const run = qMax - qMin;
	if (!(run > LAYOUT_GEOMETRY_EPSILON)) return null;
	if (form.kind === 'shed') {
		return { azimuth, qMin, qMax, qRidge: qMax, runBelow: run, runAbove: 0 };
	}
	if (!Number.isFinite(form.ridgeOffset)) return null;
	const qRidge = qMin + run / 2 + form.ridgeOffset;
	const runBelow = qRidge - qMin;
	const runAbove = qMax - qRidge;
	if (!(runBelow > LAYOUT_GEOMETRY_EPSILON) || !(runAbove > LAYOUT_GEOMETRY_EPSILON)) return null;
	return { azimuth, qMin, qMax, qRidge, runBelow, runAbove };
}

function clampStation(profile: RegionFormProfile, q: number): number {
	return q < profile.qMin ? profile.qMin : q > profile.qMax ? profile.qMax : q;
}

/**
 * Rise above the eave at one projected station.
 *
 * At the ridge both gable branches return exactly `rise`: the numerator and
 * denominator are the same double, so a shared ridge vertex evaluates to the
 * same height from either side and the two faces close exactly.
 */
function riseAt(form: LayoutRegionForm, profile: RegionFormProfile, q: number): number {
	if (form.kind === 'flat') return 0;
	const station = clampStation(profile, q);
	if (form.kind === 'shed') {
		return (form.rise * (station - profile.qMin)) / profile.runBelow;
	}
	return station <= profile.qRidge
		? (form.rise * (station - profile.qMin)) / profile.runBelow
		: (form.rise * (profile.qMax - station)) / profile.runAbove;
}

/**
 * The underside at one projected station, in world Y. This is the compiler's
 * entry point: it already holds the derived profile and must evaluate every
 * vertex exactly once. `regionUndersideAt` is the plan-point form of the same
 * function.
 */
export function regionUndersideAtStation(
	form: LayoutRegionForm,
	profile: RegionFormProfile,
	datumY: number,
	station: number,
): number {
	if (form.kind === 'flat') return datumY;
	return datumY + riseAt(form, profile, station);
}

/**
 * The underside at one plan point, in world Y.
 *
 * `datumY` is the authored eave in world coordinates. Outside the projected
 * extent — only reachable through a boundary-tolerance query — the station is
 * clamped, so the eave stays the lowest value the evaluator can return.
 */
export function regionUndersideAt(facts: RegionFormFacts, point: LayoutVec2): number {
	const { form } = facts;
	if (form.kind === 'flat') return facts.datumY;
	const profile = regionFormProfile(form, facts.footprint);
	if (profile === null) return facts.datumY;
	const q = point[0] * Math.cos(profile.azimuth) + point[1] * Math.sin(profile.azimuth);
	return regionUndersideAtStation(form, profile, facts.datumY, q);
}

/** The top at one plan point: the underside plus the authored thickness. */
export function regionTopAt(facts: RegionFormFacts, point: LayoutVec2): number {
	return regionUndersideAt(facts, point) + facts.thickness;
}

/** `d underside / dq` on the side of the ridge that contains `q`. */
export function regionUndersideSlopeAt(facts: RegionFormFacts, point: LayoutVec2): number {
	const { form } = facts;
	if (form.kind === 'flat') return 0;
	const profile = regionFormProfile(form, facts.footprint);
	if (profile === null) return 0;
	const q = point[0] * Math.cos(profile.azimuth) + point[1] * Math.sin(profile.azimuth);
	if (form.kind === 'shed') return form.rise / profile.runBelow;
	return q <= profile.qRidge ? form.rise / profile.runBelow : -form.rise / profile.runAbove;
}

/**
 * The true downward normal of the underside at one plan point.
 *
 * A surface `y = f(x, z)` has downward normal `(df/dx, -1, df/dz)` up to scale.
 * For a profile along `d`, `df/dx = m cos(azimuth)` and
 * `df/dz = m sin(azimuth)`. A flat Region returns the exact `(0, -1, 0)` that
 * the overhead query has always reported. At the ridge, where the surface is
 * not differentiable, the below-side branch is chosen deterministically.
 */
export function regionUndersideNormalAt(facts: RegionFormFacts, point: LayoutVec2): Vec3 {
	const slope = regionUndersideSlopeAt(facts, point);
	if (slope === 0) return [0, -1, 0];
	const azimuth = facts.form.kind === 'flat' ? 0 : normalizeRegionAzimuth(facts.form.azimuth);
	const x = slope * Math.cos(azimuth);
	const y = -1;
	const z = slope * Math.sin(azimuth);
	const length = Math.hypot(x, y, z);
	return [x / length, y / length, z / length];
}
