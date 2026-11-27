/**
 * `fit-sloped.ts` — the two V3b fits under a shed or gable Region (§7.3).
 *
 * Both read certified strip extrema (`wall-extrema.ts`), never a vertex sample:
 *
 * ```text
 * fit roof   elevation' = elevation - min over chosen Walls of contact
 * fit walls  profile P from the centerline's end undersides and any ridge
 *            crossing; δ = max(0, gap of the strip under P); top = P + δ;
 *            admit only when every fitted Wall has gap <= ε and overrun <= ε
 * ```
 *
 * Every refusal is whole: nothing is written and the subject is named. A flat
 * Region keeps its own arithmetic in `fit.ts`.
 */
import { activeLayoutCompileSession } from '../../geometry/session';
import { compileWallFirstLayoutGeometry } from '../../geometry/compiler';
import { MAX_LAYOUT_DIMENSION_METERS } from '../../geometry/limits';
import type {
	CompiledLayoutGeometry,
	CompiledPhysicalWall,
	CompiledRegion,
} from '../../geometry/types';
import { hasBlockingLayoutIssues } from '../../geometry/validation';
import { validateWallFirstLayoutDocument } from '../../wall/codec';
import { WALL_HEIGHT_EPSILON } from '../../wall/heights';
import { legJoinsByWall } from '../../wall/junction/joins';
import { validateWallFirstOpeningSet } from '../../wall/opening-set';
import type {
	LayoutDocumentWallFirst,
	LayoutRegion,
	LayoutWall,
	LayoutWallTop,
} from '../../wall/types';
import {
	compiledWallEndTop,
	compiledWallTopProfile,
	normalizeWallTop,
	WALL_TOP_STATION_EPSILON,
	wallIsClosed,
	type WallTopSlice,
} from '../../wall/wall-top';
import { REGION_WALL_RELATION_EPSILON } from '../region-relations';
import type { RegionPlan } from './contracts';
import { regionFormProfile, regionUndersideAt, type RegionFormFacts } from './form';
import { reject } from './shared';
import {
	compiledRegionFormFacts,
	compiledRegionWallExtrema,
	REGION_WALL_EXTREMA_UNCERTIFIED_CODE,
	regionWallVerticalExtrema,
	type RegionWallVerticalExtrema,
} from './wall-extrema';
import { compiledWallStrip, type WallStripEnds } from './wall-strip';

/** A closed Wall's top is level only (P5), so it cannot follow a sloped form. */
export const REGION_FIT_CLOSED_WALL_CODE = 'region_fit_closed_wall';
/** A curved Wall's fitted top must be level; a sloped profile along a curve is not followed. */
export const REGION_FIT_CURVED_WALL_NOT_LEVEL_CODE = 'region_fit_curved_wall_not_level';
/** The sealing allowance would push a Wall top through the Region's upper face. */
export const REGION_FIT_WALL_OVERRUN_CODE = 'region_fit_wall_overrun';

type Certified = Extract<RegionWallVerticalExtrema, { kind: 'certified' }>;

/** Fit roof: the eave that brings the chosen Walls to first contact, or a refusal. */
export function slopedRoofElevation(
	compiled: CompiledLayoutGeometry,
	compiledRegion: CompiledRegion,
	region: LayoutRegion,
	floorElevation: number,
	walls: readonly CompiledPhysicalWall[],
): { readonly elevation: number } | { readonly refusal: RegionPlan } {
	const joins = legJoinsByWall(compiled.junctions);
	let contact = Infinity;
	for (const wall of walls) {
		const extrema = compiledRegionWallExtrema(
			compiledRegion,
			wall,
			joins.get(wall.wallId),
			floorElevation,
			REGION_WALL_RELATION_EPSILON,
		);
		if (extrema.kind !== 'certified')
			return { refusal: uncertified(region.id, wall.wallId, extrema) };
		contact = Math.min(contact, extrema.contact.clearance);
	}
	return { elevation: region.elevation - contact };
}

/**
 * Fit walls: derive each eligible Wall's profile, raise it by the minimum
 * uniform sealing allowance, and admit the whole set or none of it.
 */
export function planSlopedFitWalls(input: {
	readonly document: LayoutDocumentWallFirst;
	readonly compiled: CompiledLayoutGeometry;
	readonly region: LayoutRegion;
	readonly compiledRegion: CompiledRegion;
	readonly floorElevation: number;
	readonly eligible: readonly CompiledPhysicalWall[];
	readonly skippedWallIds: readonly string[];
}): RegionPlan {
	const { document, compiled, region, compiledRegion, floorElevation } = input;
	const facts = compiledRegionFormFacts(compiledRegion);
	const eligible = [...input.eligible].sort((left, right) => compareIds(left.wallId, right.wallId));
	const joins = legJoinsByWall(compiled.junctions);
	const fitted = new Map<string, WallTopSlice>();
	for (const wall of eligible) {
		const source = document.walls.find((entry) => entry.id === wall.wallId)!;
		const profile = fittedProfile(facts, region, wall, source, floorElevation);
		if ('refusal' in profile) return profile.refusal;
		// The allowance is measured on the Wall's own strip under its new profile;
		// Junction patches read the Wall's own new end top, the lowest they can be.
		const extrema = profiledExtrema(facts, wall, profile, joins.get(wall.wallId), floorElevation);
		if (extrema.kind !== 'certified') return uncertified(region.id, wall.wallId, extrema);
		const allowance = Math.max(0, extrema.gap.clearance);
		const overrun = extrema.overrun + allowance;
		if (overrun > REGION_WALL_RELATION_EPSILON) return overrunRefusal(region, wall.wallId, overrun);
		const height = profile.height + allowance;
		if (!(height > 0) || height > MAX_LAYOUT_DIMENSION_METERS) {
			return reject(
				'invalid_value',
				`Fitting Wall '${wall.wallId}' to region '${region.id}' would put its top outside the Layout envelope`,
				[region.id, wall.wallId],
			);
		}
		fitted.set(wall.wallId, { height, top: profile.top });
	}
	const changes = eligible.filter((wall) => {
		const source = document.walls.find((entry) => entry.id === wall.wallId)!;
		return !sameSlice(source, fitted.get(wall.wallId)!);
	});
	if (changes.length === 0) {
		return reject('no_op', `Chosen Walls already meet region '${region.id}'`, [region.id]);
	}
	const candidate: LayoutDocumentWallFirst = {
		...document,
		walls: document.walls.map((wall) => {
			const slice = fitted.get(wall.id);
			return slice && changes.some((entry) => entry.wallId === wall.id)
				? { ...wall, height: slice.height, top: slice.top }
				: wall;
		}),
	};
	return admitFittedWalls(candidate, input, eligible, changes, facts);
}

/** P1–P7, compile, and the final certification over the compiled candidate. */
function admitFittedWalls(
	candidate: LayoutDocumentWallFirst,
	input: {
		readonly region: LayoutRegion;
		readonly floorElevation: number;
		readonly skippedWallIds: readonly string[];
	},
	eligible: readonly CompiledPhysicalWall[],
	changes: readonly CompiledPhysicalWall[],
	facts: RegionFormFacts,
): RegionPlan {
	const regionId = input.region.id;
	const structural = validateWallFirstLayoutDocument(candidate);
	if (!structural.success) {
		const first = structural.issues[0]!;
		return reject('invalid_candidate_document', first.message, [regionId], structural.issues);
	}
	const openingIssues = validateWallFirstOpeningSet(structural.document);
	if (openingIssues.length > 0) {
		const first = openingIssues[0]!;
		return reject(
			'opening_set_invalid',
			first.message,
			[first.openingId, first.wallId],
			openingIssues,
		);
	}
	const session = activeLayoutCompileSession();
	const accepted = session
		? session.compile(structural.document)
		: compileWallFirstLayoutGeometry(structural.document);
	if (hasBlockingLayoutIssues(accepted.issues)) {
		const first = accepted.issues[0]!;
		return reject(
			'candidate_does_not_compile',
			first.message,
			first.targetId === undefined ? [regionId] : [first.targetId],
			accepted.issues,
		);
	}
	const joins = legJoinsByWall(accepted.geometry.junctions);
	for (const wall of eligible) {
		const compiledWall = accepted.geometry.walls.find((entry) => entry.wallId === wall.wallId);
		if (compiledWall === undefined) {
			return reject('candidate_does_not_compile', `Wall '${wall.wallId}' did not compile`, [
				wall.wallId,
			]);
		}
		const extrema = regionWallVerticalExtrema(
			facts,
			compiledWallStrip(compiledWall, joins.get(wall.wallId), input.floorElevation),
			wall.wallId,
			REGION_WALL_RELATION_EPSILON,
		);
		if (extrema.kind !== 'certified') return uncertified(regionId, wall.wallId, extrema);
		if (extrema.overrun > REGION_WALL_RELATION_EPSILON)
			return overrunRefusal(input.region, wall.wallId, extrema.overrun);
		if (extrema.gap.clearance > REGION_WALL_RELATION_EPSILON) {
			return reject(
				REGION_WALL_EXTREMA_UNCERTIFIED_CODE,
				`Wall '${wall.wallId}' would still show a ${formatMeters(extrema.gap.clearance)} gap under region '${regionId}' after the fit`,
				[regionId, wall.wallId],
			);
		}
	}
	return {
		kind: 'success',
		document: structural.document,
		operation: 'region-fit-walls',
		regionId,
		changedWallIds: changes.map((wall) => wall.wallId),
		fittedWallIds: eligible.map((wall) => wall.wallId),
		skippedWallIds: input.skippedWallIds,
	};
}

/**
 * The centerline profile of one Wall under the roof (§7.3), in Wall-local
 * height: the underside at both ends, plus the ridge where a straight Wall
 * crosses it strictly inside. A straight Wall reads level, slope or gable; a
 * curved Wall is followed only when that profile is level.
 */
function fittedProfile(
	facts: RegionFormFacts,
	region: LayoutRegion,
	wall: CompiledPhysicalWall,
	source: LayoutWall,
	floorElevation: number,
): WallTopSlice | { readonly refusal: RegionPlan } {
	const kind = region.form.kind;
	if (wallIsClosed(source)) {
		return {
			refusal: reject(
				REGION_FIT_CLOSED_WALL_CODE,
				`Closed Wall '${wall.wallId}' keeps a level top, so it cannot follow the ${kind} roof of region '${region.id}'`,
				[region.id, wall.wallId],
			),
		};
	}
	const first = wall.samples[0]!.point;
	const last = wall.samples.at(-1)!.point;
	const length = wall.samples.at(-1)!.distance;
	const startRise = regionUndersideAt(facts, first) - floorElevation;
	const endRise = regionUndersideAt(facts, last) - floorElevation;
	const crossing = ridgeCrossing(facts, wall);
	const curved = source.centerline.kind !== 'line';
	if (curved) {
		if (crossing !== null || Math.abs(startRise - endRise) > WALL_HEIGHT_EPSILON) {
			return {
				refusal: reject(
					REGION_FIT_CURVED_WALL_NOT_LEVEL_CODE,
					`Curved Wall '${wall.wallId}' would need a sloped top to follow the ${kind} roof of region '${region.id}'; a curved Wall is fitted only to a level top`,
					[region.id, wall.wallId],
				),
			};
		}
		return { height: Math.max(startRise, endRise), top: { kind: 'level' } };
	}
	if (crossing !== null) {
		const apexRise = crossing.underside - floorElevation;
		if (apexRise > Math.max(startRise, endRise) + WALL_HEIGHT_EPSILON) {
			return normalizeWallTop(0, {
				kind: 'gable',
				startRise,
				endRise,
				apexRise,
				apexOffset: crossing.amount * length,
			});
		}
	}
	if (Math.abs(startRise - endRise) > WALL_HEIGHT_EPSILON)
		return normalizeWallTop(0, { kind: 'slope', startRise, endRise });
	return { height: Math.max(startRise, endRise), top: { kind: 'level' } };
}

/**
 * Where a straight Wall's centerline crosses a gable ridge strictly inside, as
 * a fraction of its length, with the ridge underside there.
 */
function ridgeCrossing(
	facts: RegionFormFacts,
	wall: CompiledPhysicalWall,
): { readonly amount: number; readonly underside: number } | null {
	if (facts.form.kind !== 'gable') return null;
	const profile = regionFormProfile(facts.form, facts.footprint);
	if (profile === null) return null;
	const cos = Math.cos(profile.azimuth);
	const sin = Math.sin(profile.azimuth);
	const first = wall.samples[0]!.point;
	const last = wall.samples.at(-1)!.point;
	const q0 = first[0] * cos + first[1] * sin - profile.qRidge;
	const q1 = last[0] * cos + last[1] * sin - profile.qRidge;
	if (!((q0 < 0 && q1 > 0) || (q0 > 0 && q1 < 0))) return null;
	const amount = q0 / (q0 - q1);
	const length = wall.samples.at(-1)!.distance;
	const station = amount * length;
	if (station <= WALL_TOP_STATION_EPSILON || station >= length - WALL_TOP_STATION_EPSILON)
		return null;
	return { amount, underside: facts.datumY + facts.form.rise };
}

/** Extrema of a Wall's strip as if its top were already `slice`. */
function profiledExtrema(
	facts: RegionFormFacts,
	wall: CompiledPhysicalWall,
	slice: WallTopSlice,
	ends: WallStripEnds | undefined,
	floorElevation: number,
): RegionWallVerticalExtrema {
	const topProfile = compiledWallTopProfile(slice, wall.length);
	const profiled = { ...wall, height: slice.height, topProfile };
	const pieces = compiledWallStrip(profiled, ends, floorElevation).map((piece) =>
		piece.kind === 'patch'
			? {
					...piece,
					topY:
						floorElevation +
						compiledWallEndTop(topProfile, slice.height, piece.end === 'end', wall.length),
				}
			: piece,
	);
	return regionWallVerticalExtrema(facts, pieces, wall.wallId, REGION_WALL_RELATION_EPSILON);
}

function sameSlice(wall: LayoutWall, slice: WallTopSlice): boolean {
	if (Math.abs(wall.height - slice.height) > WALL_HEIGHT_EPSILON) return false;
	return sameTop(wall.top, slice.top);
}

function sameTop(left: LayoutWallTop, right: LayoutWallTop): boolean {
	if (left.kind !== right.kind) return false;
	if (left.kind === 'level' || right.kind === 'level') return true;
	const near = (a: number, b: number) => Math.abs(a - b) <= WALL_HEIGHT_EPSILON;
	if (!near(left.startRise, right.startRise) || !near(left.endRise, right.endRise)) return false;
	if (left.kind === 'gable' && right.kind === 'gable') {
		return near(left.apexRise, right.apexRise) && near(left.apexOffset, right.apexOffset);
	}
	return true;
}

function overrunRefusal(region: LayoutRegion, wallId: string, overrun: number): RegionPlan {
	return reject(
		REGION_FIT_WALL_OVERRUN_CODE,
		`Wall '${wallId}' would rise ${formatMeters(overrun)} above region '${region.id}' once sealed to its underside. Thicken the roof or change its shape, or edit the Wall top directly.`,
		[region.id, wallId],
	);
}

function uncertified(
	regionId: string,
	wallId: string,
	extrema: Exclude<RegionWallVerticalExtrema, Certified>,
): RegionPlan {
	return reject(
		REGION_WALL_EXTREMA_UNCERTIFIED_CODE,
		extrema.kind === 'uncertified'
			? extrema.message
			: `Wall '${wallId}' has no covered strip under region '${regionId}' to measure`,
		[regionId, wallId],
	);
}

function formatMeters(value: number): string {
	return `${value.toFixed(3)} m`;
}

function compareIds(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}
