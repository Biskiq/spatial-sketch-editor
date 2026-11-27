import type {
	LayoutFormatVersion,
	LayoutIdentityFamily,
	LayoutIdentityLedger,
	LayoutJunction,
	LayoutRegion,
	LayoutRoomRound,
	LayoutSpaceVirtualEdge,
	LayoutWall,
	LayoutWallCenterline,
	LayoutWallCubicSpan,
	LayoutWallCurveKnot,
	LayoutWallFirstFloor,
	LayoutWallFirstRoom,
	LayoutWallTop,
} from '../types';
import {
	CLOSED_WALL_CIRCLE_KNOT_COUNT,
	CLOSED_WALL_CIRCLE_SPAN_COUNT,
	KNOWN_LAYOUT_FORMAT_VERSIONS,
	LAYOUT_IDENTITY_FAMILIES,
} from '../types';
import { LAYOUT_REFERENCE_PREFIX, parseLayoutReference } from '../../plan/identity';
import type { LayoutDocumentIssue } from '../../plan/issue';
import { MAX_LAYOUT_REGION_POINTS } from '../../room/region-validation';
import { MAX_LAYOUT_DIMENSION_METERS } from '../../geometry/limits';
import { parseRegionForm } from './parse-region-form';
import { wallTopSourceIssues } from '../wall-top';
import { parseBoundaryRefs, parseVirtualEdge } from './parse-contents';
import {
	addIssue,
	assertAllowedKeys,
	isRecord,
	parseArray,
	readEnum,
	readId,
	readNonEmptyString,
	readNonNegativeInteger,
	readNonNegativeNumber,
	readNumber,
	readPositiveNumber,
	readRecord,
	readString,
	readVec2,
	validateUniqueIds,
} from './readers';
import type { ParsedValue } from './schema';
import {
	FLOOR_KEYS_V5,
	IDENTITY_KEYS,
	JUNCTION_KEYS,
	ROOM_KEYS,
	ROOM_ROUND_KEYS,
	SPACE_OVERHEAD_VALUES,
	WALL_CURVE_KNOT_KEYS,
	WALL_CURVE_SPAN_KEYS,
	WALL_KEYS,
	WALL_TOP_KEYS,
	WALL_TOP_LEVEL_KEYS,
} from './schema';

/**
 * Parse the optional reference ledger.
 *
 * An omitted ledger is legal. A present but
 * malformed ledger reports issues and returns `undefined`, so the caller can fail
 * closed: tokens must be well-formed for their own family, and no token value may
 * appear twice anywhere in the ledger (a duplicate can only come from a
 * hand-edited or corrupted payload, and it would make two entities
 * indistinguishable).
 *
 * Cursor consistency against the live ledger is **not** a validity rule here: a
 * short cursor is repaired deterministically at the install seam
 * (`repairLayoutIdentityCursor`), because rejecting a whole document over
 * bookkeeping would make an already-saved project unloadable.
 */
export function parseIdentityLedger(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): ParsedValue<LayoutIdentityLedger> {
	if (input === undefined) return undefined;
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, IDENTITY_KEYS, path, issues);

	const cursor = readNonNegativeInteger(record.cursor, `${path}.cursor`, issues);
	if (cursor === undefined) return undefined;

	const seen = new Map<string, string>();
	const assignments: Record<LayoutIdentityFamily, Record<string, string>> = {
		rooms: {},
		junctions: {},
		walls: {},
		openings: {},
		regions: {},
	};
	let failed = false;
	for (const family of LAYOUT_IDENTITY_FAMILIES) {
		const familyPath = `${path}.${family}`;
		const familyRecord = readRecord(record[family], familyPath, issues);
		if (!familyRecord) {
			failed = true;
			continue;
		}
		for (const [id, token] of Object.entries(familyRecord)) {
			const entryPath = `${familyPath}.${id}`;
			const parsed = typeof token === 'string' ? parseLayoutReference(token) : undefined;
			if (typeof token !== 'string' || !parsed || parsed.family !== family) {
				addIssue(
					issues,
					entryPath,
					'invalid_value',
					`Expected a ${LAYOUT_REFERENCE_PREFIX[family]} reference (e.g. ${LAYOUT_REFERENCE_PREFIX[family]}-2QUS)`,
				);
				failed = true;
				continue;
			}
			const previous = seen.get(token);
			if (previous !== undefined) {
				addIssue(
					issues,
					entryPath,
					'duplicate_reference',
					`Reference '${token}' is already assigned to '${previous}'`,
				);
				failed = true;
				continue;
			}
			seen.set(token, `${family}.${id}`);
			assignments[family][id] = token;
		}
	}
	if (failed) return undefined;
	return { cursor, ...assignments };
}

/** Optional authored name: absent means unnamed, blank rejects. */
export function parseOptionalName(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): string | undefined {
	if (input === undefined) return undefined;
	return readNonEmptyString(input, path, issues);
}

export function readFormatVersion(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): LayoutFormatVersion | undefined {
	if (typeof input !== 'number' || !Number.isInteger(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected an integer formatVersion');
		return undefined;
	}
	if (!(KNOWN_LAYOUT_FORMAT_VERSIONS as readonly number[]).includes(input)) {
		addIssue(
			issues,
			path,
			'unsupported_format_version',
			`Unsupported Layout formatVersion ${input}. Recognized versions: ${KNOWN_LAYOUT_FORMAT_VERSIONS.join(', ')}`,
		);
		return undefined;
	}
	return input as LayoutFormatVersion;
}

/** Canonical Floor: `id`/`name`/`elevation` only. */
export function parseFloorV5(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): ParsedValue<LayoutWallFirstFloor> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, FLOOR_KEYS_V5, path, issues);
	const id = readId(record.id, `${path}.id`, issues);
	const name = readString(record.name, `${path}.name`, issues);
	const elevation = readNumber(record.elevation, `${path}.elevation`, issues);
	if (!id || !name || elevation === undefined) return undefined;
	return { id, name, elevation };
}

export function parseJunction(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): ParsedValue<LayoutJunction> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, JUNCTION_KEYS, path, issues);

	const id = readId(record.id, `${path}.id`, issues);
	const point = readVec2(record.point, `${path}.point`, issues);
	if (!id || !point) return undefined;
	return { id, point };
}

/**
 * `height` is finite and strictly positive with no Floor-relative cap; the shared
 * Layout geometry envelope applies its 1,000 m global maximum after decoding.
 * The canonical Floor carries no vertical extent to clamp against.
 *
 * `top` is required on every Wall (format 11): `height` is the lowest point of
 * the top and `top` states the rise above it. The shape rules and the 1,000 m
 * peak envelope are refused here; the apex-versus-length rule is the compiler's,
 * because the length is derived.
 */
export function parseWall(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): ParsedValue<LayoutWall> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, WALL_KEYS, path, issues);

	const id = readId(record.id, `${path}.id`, issues);
	const startJunctionId = readId(record.startJunctionId, `${path}.startJunctionId`, issues);
	const endJunctionId = readId(record.endJunctionId, `${path}.endJunctionId`, issues);
	const thickness = readPositiveNumber(record.thickness, `${path}.thickness`, issues);
	const height = readPositiveNumber(record.height, `${path}.height`, issues);
	const top = parseWallTop(record.top, `${path}.top`, issues);
	// The centerline is required on every Wall (fresh-authority
	// policy: no migration, no missing-field tolerance).
	const centerline = parseWallCenterline(record.centerline, `${path}.centerline`, issues);
	// An authored name is optional; present-but-blank is invalid, which
	// makes absence the only representation of "unnamed".
	const name = parseOptionalName(record.name, `${path}.name`, issues);
	if (
		!id ||
		!startJunctionId ||
		!endJunctionId ||
		thickness === undefined ||
		height === undefined ||
		!top ||
		!centerline ||
		(record.name !== undefined && name === undefined)
	) {
		return undefined;
	}
	for (const issue of wallTopSourceIssues({
		id,
		height,
		top,
		startJunctionId,
		endJunctionId,
	})) {
		addIssue(issues, `${path}.top`, issue.code, issue.message);
	}
	// A self-connected Wall is the canonical closed representation, not an
	// accident. It is legal only as the approved 16-span cubic chain: a straight
	// self-loop has no interior, and any other span count would be a second closed
	// Wall vocabulary the product cannot author or reason about.
	if (startJunctionId !== undefined && startJunctionId === endJunctionId) {
		if (centerline.kind !== 'cubic-chain') {
			addIssue(
				issues,
				`${path}.centerline`,
				'invalid_value',
				'A closed Wall must use a 16-span cubic-chain centerline',
			);
		} else if (
			centerline.knots.length !== CLOSED_WALL_CIRCLE_KNOT_COUNT ||
			centerline.spans.length !== CLOSED_WALL_CIRCLE_SPAN_COUNT
		) {
			addIssue(
				issues,
				`${path}.centerline`,
				'invalid_value',
				`A closed Wall must carry exactly ${CLOSED_WALL_CIRCLE_SPAN_COUNT} cubic spans (${CLOSED_WALL_CIRCLE_KNOT_COUNT} bend points)`,
			);
		}
	}
	return {
		id,
		startJunctionId,
		endJunctionId,
		thickness,
		height,
		top,
		centerline,
		...(name !== undefined ? { name } : {}),
	};
}

/**
 * Parse the required Wall top union. `level` carries `kind` only; `slope` and
 * `gable` state their rises. A key that does not belong to the stated shape is
 * `unknown_key`, so there is no second spelling of a level top.
 */
function parseWallTop(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): ParsedValue<LayoutWallTop> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	const kind = readEnum(record.kind, `${path}.kind`, ['level', 'slope', 'gable'], issues);
	if (kind === 'level') {
		assertAllowedKeys(record, WALL_TOP_LEVEL_KEYS, path, issues);
		return { kind: 'level' };
	}
	if (kind === undefined) return undefined;
	assertAllowedKeys(record, WALL_TOP_KEYS, path, issues);
	const startRise = readNonNegativeNumber(record.startRise, `${path}.startRise`, issues);
	const endRise = readNonNegativeNumber(record.endRise, `${path}.endRise`, issues);
	if (startRise === undefined || endRise === undefined) return undefined;
	if (kind === 'slope') {
		if (record.apexRise !== undefined)
			addIssue(issues, `${path}.apexRise`, 'unknown_key', "A slope has no 'apexRise'");
		if (record.apexOffset !== undefined)
			addIssue(issues, `${path}.apexOffset`, 'unknown_key', "A slope has no 'apexOffset'");
		return { kind: 'slope', startRise, endRise };
	}
	const apexRise = readNonNegativeNumber(record.apexRise, `${path}.apexRise`, issues);
	const apexOffset = readNumber(record.apexOffset, `${path}.apexOffset`, issues);
	if (apexRise === undefined || apexOffset === undefined) return undefined;
	return { kind: 'gable', startRise, endRise, apexRise, apexOffset };
}

/**
 * Parse the canonical Wall centerline union. `line` carries no
 * payload; `cubic-chain` requires ordered bend points with stable unique IDs
 * and one control pair per cubic span (`spans.length === knots.length + 1`).
 * An empty knot list is legal and means one cubic between the endpoint
 * Junctions.
 *
 * `auto-bezier` is deliberately no longer accepted here: it is the superseded
 * anchor-only representation, and the fresh-authority policy decodes only the
 * current shape.
 */
function parseWallCenterline(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): ParsedValue<LayoutWallCenterline> {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected a centerline object');
		return undefined;
	}
	const kind = readString(input.kind, `${path}.kind`, issues);
	if (kind === 'line') {
		assertAllowedKeys(input, ['kind'], path, issues);
		return { kind: 'line' };
	}
	if (kind === 'cubic-chain') {
		assertAllowedKeys(input, ['kind', 'knots', 'spans'], path, issues);
		const knots = parseArray(input.knots, `${path}.knots`, issues, parseWallCurveKnot);
		if (!knots) return undefined;
		validateUniqueIds(knots, `${path}.knots`, issues, (knot) => knot.id);
		const spans = parseArray(input.spans, `${path}.spans`, issues, parseWallCubicSpan);
		if (!spans) return undefined;
		// One span per cubic: `points.length - 1` with
		// `points = [start,...knots, end]`.
		if (spans.length !== knots.length + 1) {
			addIssue(
				issues,
				`${path}.spans`,
				'invalid_value',
				`A cubic-chain centerline needs exactly one span per cubic: expected ${knots.length + 1} for ${knots.length} knot(s), got ${spans.length}`,
			);
			return undefined;
		}
		return { kind: 'cubic-chain', knots, spans };
	}
	if (kind !== undefined) {
		addIssue(
			issues,
			`${path}.kind`,
			'unsupported_value',
			`Unsupported wall centerline kind '${kind}'`,
		);
	}
	return undefined;
}

/** One `cubic-chain` bend point: stable unique ID + finite X/Z point. */
function parseWallCurveKnot(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): ParsedValue<LayoutWallCurveKnot> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, WALL_CURVE_KNOT_KEYS, path, issues);
	const id = readId(record.id, `${path}.id`, issues);
	const point = readVec2(record.point, `${path}.point`, issues);
	if (!id || !point) return undefined;
	return { id, point };
}

/**
 * One `cubic-chain` span: two finite control points and no identity. The
 * allowed-key set is what keeps spans unaddressable — a span has no ID field
 * to round-trip and no ordering field to disagree with its position.
 */
function parseWallCubicSpan(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): ParsedValue<LayoutWallCubicSpan> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, WALL_CURVE_SPAN_KEYS, path, issues);
	const handleOut = readVec2(record.handleOut, `${path}.handleOut`, issues);
	const handleIn = readVec2(record.handleIn, `${path}.handleIn`, issues);
	if (!handleOut || !handleIn) return undefined;
	return { handleOut, handleIn };
}

export function parseRoom(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): ParsedValue<LayoutWallFirstRoom> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, ROOM_KEYS, path, issues);

	const id = readId(record.id, `${path}.id`, issues);
	const name = readNonEmptyString(record.name, `${path}.name`, issues);
	const boundary = parseBoundaryRefs(record.boundary, `${path}.boundary`, issues);
	// Both fields are required on every record: the strict reader has no defaulting and
	// no missing-field tolerance. An absent field is `invalid_type`, exactly as
	// an absent `centerline` is on a Wall.
	const virtualEdges = parseVirtualEdges(record.virtualEdges, `${path}.virtualEdges`, issues);
	const overhead = readEnum(record.overhead, `${path}.overhead`, SPACE_OVERHEAD_VALUES, issues);
	const round = parseRoomRound(record.round, `${path}.round`, issues);
	// A canonical Room with zero boundary references is not a
	// degenerate architecture, it is invalid state: the codec previously accepted
	// `boundary: []` because an empty array parses cleanly, which let a Room with
	// no enclosure reach the compiler and acquire an invented ceiling. The ceiling
	// is derived from boundary Walls, so the boundary must exist.
	if (boundary && boundary.length === 0) {
		addIssue(
			issues,
			`${path}.boundary`,
			'room_boundary_empty',
			'A canonical Room boundary must reference at least one Wall',
		);
	}
	if (
		!id ||
		!name ||
		!boundary ||
		!virtualEdges ||
		!overhead ||
		(record.round !== undefined && !round)
	) {
		return undefined;
	}
	return {
		id,
		name,
		boundary,
		virtualEdges,
		overhead,
		...(round ? { round } : {}),
	};
}

function parseRoomRound(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): ParsedValue<LayoutRoomRound> {
	if (input === undefined) return undefined;
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, ROOM_ROUND_KEYS, path, issues);
	const center = readVec2(record.center, `${path}.center`, issues);
	const radius = readPositiveNumber(record.radius, `${path}.radius`, issues);
	if (!center || radius === undefined) return undefined;
	return { center, radius };
}

export function parseRegion(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): ParsedValue<LayoutRegion> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(
		record,
		['id', 'role', 'footprint', 'elevation', 'thickness', 'form', 'intendedGaps', 'name'],
		path,
		issues,
	);
	const id = readId(record.id, `${path}.id`, issues);
	const role = readEnum(record.role, `${path}.role`, ['floor', 'overhead'], issues);
	const elevation = readNumber(record.elevation, `${path}.elevation`, issues);
	const thickness = readPositiveNumber(record.thickness, `${path}.thickness`, issues);
	const footprint = readRecord(record.footprint, `${path}.footprint`, issues);
	const form = parseRegionForm(record.form, `${path}.form`, issues, role);
	if (!footprint) return undefined;
	assertAllowedKeys(footprint, ['kind', 'points'], `${path}.footprint`, issues);
	readEnum(footprint.kind, `${path}.footprint.kind`, ['polygon'], issues);
	if (
		Array.isArray(footprint.points) &&
		(footprint.points.length < 3 || footprint.points.length > MAX_LAYOUT_REGION_POINTS)
	) {
		addIssue(
			issues,
			`${path}.footprint.points`,
			'region_point_count',
			'A region requires 3 to 1024 footprint points',
		);
		return undefined;
	}
	const points = parseArray(footprint.points, `${path}.footprint.points`, issues, readVec2);
	const intendedGaps = parseArray(record.intendedGaps, `${path}.intendedGaps`, issues, readId);
	const name = parseOptionalName(record.name, `${path}.name`, issues);
	if (
		!id ||
		!role ||
		elevation === undefined ||
		thickness === undefined ||
		!points ||
		!intendedGaps ||
		!form
	)
		return undefined;
	if (
		Math.abs(elevation) > MAX_LAYOUT_DIMENSION_METERS ||
		thickness > MAX_LAYOUT_DIMENSION_METERS
	) {
		addIssue(
			issues,
			path,
			'dimension_out_of_range',
			'Region elevation and thickness are limited to 1000 m',
		);
	}
	if (elevation < 0 || (role === 'overhead' && elevation === 0)) {
		addIssue(
			issues,
			`${path}.elevation`,
			'invalid_value',
			'Floor elevation must be nonnegative and overhead elevation must be positive',
		);
	}
	if (intendedGaps.some((wallId, index) => index > 0 && wallId <= intendedGaps[index - 1]!)) {
		addIssue(
			issues,
			`${path}.intendedGaps`,
			'invalid_value',
			'Wall ids must be in ordinal order and unique',
		);
	}
	return {
		id,
		role,
		footprint: { kind: 'polygon', points },
		elevation,
		thickness,
		form,
		intendedGaps,
		...(name === undefined ? {} : { name }),
	};
}

function parseVirtualEdges(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): LayoutSpaceVirtualEdge[] | undefined {
	if (!Array.isArray(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected an array');
		return undefined;
	}
	const edges = input.map((value, index) => parseVirtualEdge(value, `${path}[${index}]`, issues));
	return edges.every((edge) => edge !== undefined) ? edges : undefined;
}
