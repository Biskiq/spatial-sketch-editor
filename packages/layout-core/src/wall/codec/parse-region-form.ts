/**
 * `parse-region-form.ts` — strict Region form admission.
 *
 * Flat is the only form allowed on a floor Region, and the only one with no
 * parameters. A sloped form's parameters are normalized here, once: a direction
 * is periodic, so `azimuth` is canonicalized to `(-pi, pi]`. The footprint's
 * projected extent is not known at read time, so a gable's ridge-inside check is
 * shared with the compiler and runs during document validation.
 */
import type { LayoutRegion, LayoutRegionForm } from '../types';
import type { LayoutDocumentIssue } from '../../plan/issue';
import { MAX_LAYOUT_DIMENSION_METERS } from '../../geometry/limits';
import { normalizeRegionAzimuth } from '../../room/region/form';
import type { ParsedValue } from './schema';
import {
	addIssue,
	assertAllowedKeys,
	readEnum,
	readNumber,
	readPositiveNumber,
	readRecord,
} from './readers';

export function parseRegionForm(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
	role: LayoutRegion['role'] | undefined,
): ParsedValue<LayoutRegionForm> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	const kind = readEnum(record.kind, `${path}.kind`, ['flat', 'shed', 'gable'], issues);
	if (!kind) return undefined;
	if (kind === 'flat') {
		assertAllowedKeys(record, ['kind'], path, issues);
		return { kind: 'flat' };
	}
	assertAllowedKeys(
		record,
		kind === 'gable' ? ['kind', 'rise', 'azimuth', 'ridgeOffset'] : ['kind', 'rise', 'azimuth'],
		path,
		issues,
	);
	const rise = readPositiveNumber(record.rise, `${path}.rise`, issues);
	const azimuth = readNumber(record.azimuth, `${path}.azimuth`, issues);
	const ridgeOffset =
		kind === 'gable' ? readNumber(record.ridgeOffset, `${path}.ridgeOffset`, issues) : 0;
	if (rise === undefined || azimuth === undefined || ridgeOffset === undefined) return undefined;
	if (rise > MAX_LAYOUT_DIMENSION_METERS) {
		addIssue(
			issues,
			`${path}.rise`,
			'dimension_out_of_range',
			'Region form rise is limited to 1000 m',
		);
	}
	if (role !== 'overhead') {
		addIssue(
			issues,
			path,
			'region_form_requires_overhead',
			'A sloped Region form requires an overhead role',
		);
	}
	const canonicalAzimuth = normalizeRegionAzimuth(azimuth);
	return kind === 'shed'
		? { kind, rise, azimuth: canonicalAzimuth }
		: { kind, rise, azimuth: canonicalAzimuth, ridgeOffset };
}
