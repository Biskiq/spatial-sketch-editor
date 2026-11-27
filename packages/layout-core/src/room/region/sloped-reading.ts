/**
 * `sloped-reading.ts` — the §7.3 vertical reading of a `through` or `edge` Wall
 * under a shed or gable Region, from certified extrema (`wall-extrema.ts`).
 * The relation layer passes its own epsilon so both read one tolerance.
 */
import type { LayoutRegion } from '../../wall/types';
import type {
	RegionWallReadingFacts,
	RegionWallMeasureSegment,
	RegionWallPlanClass,
} from '../region-relations';
import type { RegionWallVerticalExtrema } from './wall-extrema';

/** The fail-closed reading when extrema cannot be certified: no measure, cue or fit. */
const UNAVAILABLE_READING: RegionWallReadingFacts = {
	reading: 'unavailable',
	measureMeters: null,
	measureAxis: null,
	fit: null,
};

/**
 * The §7.3 reading of a `through` or `edge` Wall under a sloped Region, from
 * certified extrema: a `through` Wall that rises above the top face crosses
 * (even where another part has a gap); otherwise a positive maximum clearance
 * is a vertical gap of that measure, and anything else meets. Fit roof is
 * offered only when the roof would actually move to first contact.
 */
export function slopedRegionWallReading(
	planClass: RegionWallPlanClass,
	vertical: RegionWallVerticalExtrema,
	role: LayoutRegion['role'],
	epsilon: number,
): RegionWallReadingFacts {
	if (vertical.kind !== 'certified') return UNAVAILABLE_READING;
	if (planClass === 'through' && vertical.overrun > epsilon) {
		return { reading: 'crosses', measureMeters: null, measureAxis: null, fit: null };
	}
	if (vertical.gap.clearance > epsilon) {
		return {
			reading: 'gap',
			measureMeters: vertical.gap.clearance,
			measureAxis: 'vertical',
			fit:
				role === 'overhead' && Math.abs(vertical.contact.clearance) > epsilon
					? 'fit-roof-to-walls'
					: null,
		};
	}
	return { reading: 'meets', measureMeters: null, measureAxis: null, fit: null };
}

/** A sloped vertical gap is drawn where it is largest, between the two surfaces there. */
export function slopedMeasureSegment(
	reading: RegionWallReadingFacts,
	vertical: Extract<RegionWallVerticalExtrema, { kind: 'certified' }>,
): RegionWallMeasureSegment | null {
	if (reading.reading !== 'gap') return null;
	const { point, wallTopY, undersideY } = vertical.gap;
	return { from: [point[0], wallTopY, point[1]], to: [point[0], undersideY, point[1]] };
}
