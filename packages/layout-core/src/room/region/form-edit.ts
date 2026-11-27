/**
 * `form-edit.ts` — `planSetRegionForm` and the deterministic form defaults of
 * §7.2.
 *
 * Changing kind keeps the footprint, the eave (`elevation`) and the thickness.
 * On entry to a kind an omitted value takes its default; within the same kind
 * an omitted value keeps the stored one. Admission (rise, canonical azimuth,
 * ridge inside the half extent, the 1000 m top, G5's conservative band) is the
 * shared codec gate in `finalizeRegionCandidate`, so Save and this planner read
 * one rule.
 */
import type { LayoutVec2 } from '../../geometry/coordinates';
import type { LayoutDocumentWallFirst, LayoutRegion, LayoutRegionForm } from '../../wall/types';
import type { RegionFormInput, RegionPlan } from './contracts';
import { normalizeRegionAzimuth, regionFormProfile } from './form';
import { finalizeRegionCandidate, findRegion, reject } from './shared';

/** Default pitch of a new sloped form: rise is `tan(30°)` times the run. */
export const REGION_FORM_DEFAULT_PITCH_RADIANS = Math.PI / 6;

/**
 * Relative tolerance under which two squared edge lengths are one length, so a
 * square's four edges tie however its corners were rounded.
 */
const EDGE_TIE_RELATIVE_TOLERANCE = 1e-9;

/** Write one Region's form kind and values in one history entry. */
export function planSetRegionForm(
	document: LayoutDocumentWallFirst,
	regionId: string,
	input: RegionFormInput,
): RegionPlan {
	const region = findRegion(document, regionId);
	if (region === undefined)
		return reject('unknown_region', `Unknown region '${regionId}'`, [regionId]);
	const kind: unknown = (input as { kind?: unknown } | null)?.kind;
	if (kind !== 'flat' && kind !== 'shed' && kind !== 'gable') {
		return reject('invalid_value', `Unknown Region form '${String(kind)}'`, [regionId]);
	}
	if (input.kind !== 'flat' && region.role !== 'overhead') {
		return reject(
			'region_form_requires_overhead',
			'A sloped Region form requires an overhead role',
			[regionId],
		);
	}
	const valueIssue = inputValueIssue(input);
	if (valueIssue !== null) return reject('invalid_value', valueIssue, [regionId]);
	const form = resolvedForm(region, input);
	if (form === null) {
		return reject(
			'region_form_projection_degenerate',
			'Region form has no usable projected extent',
			[regionId],
		);
	}
	if (sameForm(region.form, form)) {
		return reject('no_op', `Region '${regionId}' already has that form`, [regionId]);
	}
	return finalizeRegionCandidate(
		{
			...document,
			regions: document.regions.map((entry) =>
				entry.id === regionId ? { ...entry, form } : entry,
			),
		},
		'region-form',
		regionId,
	);
}

function inputValueIssue(input: RegionFormInput): string | null {
	if (input.kind === 'flat') return null;
	if (input.rise !== undefined && !(Number.isFinite(input.rise) && input.rise > 0))
		return 'Region form rise must be finite and greater than zero';
	if (input.azimuth !== undefined && !Number.isFinite(input.azimuth))
		return 'Region form azimuth must be finite';
	if (
		input.kind === 'gable' &&
		input.ridgeOffset !== undefined &&
		!Number.isFinite(input.ridgeOffset)
	)
		return 'Region gable ridge offset must be finite';
	return null;
}

/**
 * The stored form an input resolves to: explicit values win, then the current
 * values of the same kind, then the defaults. Rise defaults last because it is
 * derived from the run the chosen azimuth and ridge give.
 */
function resolvedForm(region: LayoutRegion, input: RegionFormInput): LayoutRegionForm | null {
	if (input.kind === 'flat') return { kind: 'flat' };
	const points = region.footprint.points;
	const current = region.form.kind === input.kind ? region.form : null;
	const azimuth = normalizeRegionAzimuth(
		input.azimuth ?? current?.azimuth ?? regionFormDefaultAzimuth(input.kind, points),
	);
	if (input.kind === 'shed') {
		const rise =
			input.rise ?? current?.rise ?? defaultRise({ kind: 'shed', rise: 1, azimuth }, points);
		return rise === null ? null : { kind: 'shed', rise, azimuth };
	}
	const ridgeOffset =
		input.ridgeOffset ?? (current?.kind === 'gable' ? current.ridgeOffset : undefined) ?? 0;
	const rise =
		input.rise ??
		current?.rise ??
		defaultRise({ kind: 'gable', rise: 1, azimuth, ridgeOffset }, points);
	return rise === null ? null : { kind: 'gable', rise, azimuth, ridgeOffset };
}

/**
 * The default azimuth of a new form over a footprint (§7.2): the longest edge,
 * endpoints ordered lexicographically by `(x, z)`, ties broken by the smallest
 * ordered endpoint pair; `θ = atan2(Δz, Δx)`. A shed rises along `θ`; a gable
 * turns a quarter so its ridge runs parallel to that edge. Cyclic reindexing or
 * reversing the ring yields the same edge and the same `θ`.
 */
export function regionFormDefaultAzimuth(
	kind: 'shed' | 'gable',
	points: readonly LayoutVec2[],
): number {
	const edges = points.map((point, index) => {
		const next = points[(index + 1) % points.length]!;
		const [first, second] = lexicographicLess(point, next) ? [point, next] : [next, point];
		const dx = second[0] - first[0];
		const dz = second[1] - first[1];
		return { first, second, squared: dx * dx + dz * dz };
	});
	let longest = 0;
	for (const edge of edges) longest = Math.max(longest, edge.squared);
	let chosen: (typeof edges)[number] | null = null;
	for (const edge of edges) {
		if (longest - edge.squared > EDGE_TIE_RELATIVE_TOLERANCE * longest) continue;
		if (chosen === null || pairLess(edge, chosen)) chosen = edge;
	}
	if (chosen === null) return 0;
	const theta = Math.atan2(chosen.second[1] - chosen.first[1], chosen.second[0] - chosen.first[0]);
	return normalizeRegionAzimuth(kind === 'shed' ? theta : theta + Math.PI / 2);
}

/** `tan(30°)` times the full run (shed) or the longer eave-to-ridge run (gable). */
function defaultRise(form: LayoutRegionForm, points: readonly LayoutVec2[]): number | null {
	const profile = regionFormProfile(form, points);
	if (profile === null) return null;
	const run =
		form.kind === 'shed'
			? profile.qMax - profile.qMin
			: Math.max(profile.runBelow, profile.runAbove);
	return Math.tan(REGION_FORM_DEFAULT_PITCH_RADIANS) * run;
}

function lexicographicLess(left: LayoutVec2, right: LayoutVec2): boolean {
	return left[0] < right[0] || (left[0] === right[0] && left[1] < right[1]);
}

function pairLess(
	left: { first: LayoutVec2; second: LayoutVec2 },
	right: { first: LayoutVec2; second: LayoutVec2 },
): boolean {
	const a = [...left.first, ...left.second];
	const b = [...right.first, ...right.second];
	for (let index = 0; index < 4; index += 1) {
		if (a[index]! !== b[index]!) return a[index]! < b[index]!;
	}
	return false;
}

function sameForm(left: LayoutRegionForm, right: LayoutRegionForm): boolean {
	if (left.kind !== right.kind) return false;
	if (left.kind === 'flat' || right.kind === 'flat') return true;
	if (left.rise !== right.rise || left.azimuth !== right.azimuth) return false;
	return left.kind === 'gable' && right.kind === 'gable'
		? left.ridgeOffset === right.ridgeOffset
		: true;
}
