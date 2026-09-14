/**
 * `layout-wall-first-codec.ts` — strict codec for the wall-first
 * `LayoutDocument` (`formatVersion: 5`), shared by P23.1 operations and the
 * canonical project Save boundary.
 *
 * The codec intentionally provides:
 *
 *   - strict structural validation of the new canonical shape, and
 *   - a `createEmptyWallFirstLayoutDocument()` fixture/boot helper
 *
 * Semantic mutations live in the operation planners
 * (`layout-wall-first-precision.ts` and the P23.8 noding/topology modules);
 * this module remains a pure validation/canonicalization boundary.
 *
 * Validation policy mirrors the legacy codec's strictness (reject-on-issue,
 * explicit issue codes, canonical JSON) so downstream F0 gates can rely on
 * the same failure semantics. P23.8's topology validity rules (noding,
 * crossings, enclosure, correspondence) are **out of scope here**; this codec
 * validates reference structure and numeric sanity only.
 */
import type {
	LayoutDocumentWallFirst,
	LayoutFormatVersion,
	LayoutJunction,
	LayoutWall,
	LayoutWallCenterline,
	LayoutWallCurveAnchor,
	LayoutWallFirstFloor,
	LayoutWallFirstRoom,
	LayoutWallOpening,
	OrientedWallRef
} from './layout-wall-first-types';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	KNOWN_LAYOUT_FORMAT_VERSIONS
} from './layout-wall-first-types';
import type { LayoutDocumentIssue } from './layout-codec';
import { LayoutDocumentValidationError } from './layout-codec';
import type { LayoutObject, LayoutVec2 } from './layout-types';

/**
 * Validation result carrying the wall-first document type, not the legacy one.
 *
 * A success is **always** the canonical current-format document. There is one
 * recognized version (`5`) and no historical variant: a payload declaring anything
 * else fails as `unsupported_format_version` (P23.6I pre-baseline policy).
 */
export type WallFirstLayoutValidationResult =
	| {
			success: true;
			document: LayoutDocumentWallFirst;
			canonicalJson: string;
	  }
	| {
			success: false;
			issues: LayoutDocumentIssue[];
	  };

const UNITS = 'meters' as const;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

type JsonRecord = Record<string, unknown>;

type ParsedValue<T> = T | undefined;

const ROOT_KEYS = [
	'units',
	'formatVersion',
	'floor',
	'junctions',
	'walls',
	'rooms',
	'openings',
	'objects'
] as const;
/**
 * Canonical Floor key set (P23.6I). The current Floor has no vertical extent, so a
 * present `height` is `unknown_key`.
 */
const FLOOR_KEYS_V5 = ['id', 'name', 'elevation'] as const;
const JUNCTION_KEYS = ['id', 'point'] as const;
const WALL_KEYS = ['id', 'startJunctionId', 'endJunctionId', 'role', 'thickness', 'height', 'centerline'] as const;
/** P23.11 — one curve anchor of a Wall `auto-bezier` centerline. */
const WALL_CURVE_ANCHOR_KEYS = ['id', 'point'] as const;
const ROOM_KEYS = ['id', 'name', 'boundary', 'floorThickness', 'ceilingThickness'] as const;
const WALL_REF_KEYS = ['wallId', 'direction'] as const;
const OPENING_KEYS = [
	'id',
	'wallId',
	'kind',
	'offset',
	'width',
	'height',
	'sillHeight',
	'profile',
	'connectsRoomIds'
] as const;
const OBJECT_KEYS = ['id', 'kind', 'position', 'rotation', 'dimensions', 'profile', 'roomId'] as const;
const PATH_KEYS = ['closed', 'segments'] as const;
const LINE_SEGMENT_KEYS = ['id', 'kind', 'start', 'end'] as const;
const AUTO_BEZIER_SEGMENT_KEYS = ['id', 'kind', 'start', 'end', 'interiorAnchors'] as const;
const INTERIOR_ANCHOR_KEYS = ['id', 'point'] as const;

/**
 * Authoring-empty wall-first document. Used by wall-first fixtures and
 * explicit reset/import flows; the editor's default boot document remains
 * the legacy compatibility fixture.
 */
export function createEmptyWallFirstLayoutDocument(): LayoutDocumentWallFirst {
	return {
		units: UNITS,
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor', name: 'Floor', elevation: 0 },
		junctions: [],
		walls: [],
		rooms: [],
		openings: [],
		objects: []
	};
}

/**
 * Strict wall-first validation. Any issue rejects the whole document.
 *
 * Reference rules enforced here:
 * - IDs are unique within their document-global collection (junctions, walls,
 *   openings, objects) and across rooms;
 * - every Wall references two existing, distinct Junction IDs;
 * - duplicate Walls between the same two Junctions are invalid;
 * - Room boundary references point at existing Walls; a Room boundary must
 *   not use the same directed Wall ref twice (undirected reuse across two
 *   Rooms is the shared-wall case and stays valid);
 * - openings reference existing Walls (document-global `wallId`);
 * - `LayoutObject.roomId` still references a persistent Room — the optional
 *   semantic association survives the schema change unchanged.
 */
export function validateWallFirstLayoutDocument(
	input: unknown
): WallFirstLayoutValidationResult {
	const issues: LayoutDocumentIssue[] = [];
	const parsed = parseDocument(input, '$', issues);
	if (!parsed || issues.length > 0) {
		return { success: false, issues };
	}

	return {
		success: true,
		document: parsed,
		canonicalJson: JSON.stringify(parsed, null, 2) + '\n'
	};
}

export function parseWallFirstLayoutDocumentJson(json: string): WallFirstLayoutValidationResult {
	try {
		return validateWallFirstLayoutDocument(JSON.parse(json) as unknown);
	} catch (error) {
		return {
			success: false,
			issues: [
				{
					path: '$',
					code: 'invalid_json',
					message: invalidJsonMessage(error, json)
				}
			]
		};
	}
}

/**
 * P23.6H — the canonical *writer* format requirement (S1b).
 *
 * The canonical writers receive canonical current-format state, so a document
 * declaring any other format version rejects fail-closed instead of being
 * persisted as if it were current. This is current-format strictness, not a
 * compatibility branch: P23.6I recognizes exactly one version, so there is no
 * historical payload that could be rewritten on the way out.
 *
 * Returns `undefined` when the input is not an object at all, so structural
 * validation owns that report.
 */
export function wallFirstCanonicalFormatVersionIssue(
	input: unknown
): LayoutDocumentIssue | undefined {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined;
	const declared = (input as { formatVersion?: unknown }).formatVersion;
	if (declared === LAYOUT_WALL_FIRST_FORMAT_VERSION) return undefined;
	return {
		path: '$.formatVersion',
		code: 'unsupported_format_version',
		message: `Canonical Layout Save requires formatVersion ${LAYOUT_WALL_FIRST_FORMAT_VERSION}; got ${String(
			declared
		)}. Canonical writers never migrate a historical payload.`
	};
}

/**
 * Canonical Layout serialization. Throws on invalid input.
 *
 * Unlike validation, this is a **writer**: it requires canonical current-format
 * state and rejects a historical payload by name (P23.6H, S1b).
 */
export function serializeWallFirstLayoutDocument(document: unknown): string {
	const versionIssue = wallFirstCanonicalFormatVersionIssue(document);
	if (versionIssue) throw new LayoutDocumentValidationError(versionIssue);
	const result = validateWallFirstLayoutDocument(document);
	if (!result.success) {
		throw new LayoutDocumentValidationError(result.issues[0]!);
	}
	return result.canonicalJson;
}

function parseDocument(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): ParsedValue<LayoutDocumentWallFirst> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, ROOT_KEYS, path, issues);

	const units = readString(record.units, `${path}.units`, issues);
	if (units !== UNITS) {
		addIssue(issues, `${path}.units`, 'unsupported_units', `Expected units '${UNITS}'`);
	}

	const formatVersion = readFormatVersion(record.formatVersion, `${path}.formatVersion`, issues);
	// P23.6I — one Floor key set only: no vertical extent, so a present `height`
	// is `unknown_key`.
	const floor =
		formatVersion === LAYOUT_WALL_FIRST_FORMAT_VERSION
			? parseFloorV5(record.floor, `${path}.floor`, issues)
			: undefined;

	const junctions = parseArray(record.junctions, `${path}.junctions`, issues, parseJunction);
	const walls = parseArray(record.walls, `${path}.walls`, issues, parseWall);
	const rooms = parseArray(record.rooms, `${path}.rooms`, issues, parseRoom);
	const openings = parseArray(record.openings, `${path}.openings`, issues, parseOpening);
	const objects = parseArray(record.objects, `${path}.objects`, issues, parseObject);
	if (
		!floor ||
		!junctions ||
		!walls ||
		!rooms ||
		!openings ||
		!objects
	) {
		return undefined;
	}

	validateUniqueIds(junctions, `${path}.junctions`, issues, (junction) => junction.id);
	validateUniqueIds(walls, `${path}.walls`, issues, (wall) => wall.id);
	validateUniqueIds(rooms, `${path}.rooms`, issues, (room) => room.id);
	validateUniqueIds(openings, `${path}.openings`, issues, (opening) => opening.id);
	validateUniqueIds(objects, `${path}.objects`, issues, (object) => object.id);

	const junctionIds = new Set(junctions.map((junction) => junction.id));
	const wallIds = new Set(walls.map((wall) => wall.id));
	const roomIds = new Set(rooms.map((room) => room.id));

	// H3 minimum invariant: duplicate Walls between the same two Junctions are
	// invalid — in either direction (a reversed pair is the same physical wall
	// with opposed canonical orientation, not two Walls).
	const seenWallPairs = new Set<string>();
	for (const [index, wall] of walls.entries()) {
		const pairKey = [wall.startJunctionId, wall.endJunctionId].sort().join('|');
		if (seenWallPairs.has(pairKey)) {
			addIssue(
				issues,
				`${path}.walls[${index}]`,
				'duplicate_wall_pair',
				`Duplicate Wall between junctions '${wall.startJunctionId}' and '${wall.endJunctionId}'`
			);
		}
		seenWallPairs.add(pairKey);
	}

	for (const [index, wall] of walls.entries()) {
		if (!junctionIds.has(wall.startJunctionId)) {
			addIssue(
				issues,
				`${path}.walls[${index}].startJunctionId`,
				'missing_reference',
				`Unknown junctionId '${wall.startJunctionId}'`
			);
		}
		if (!junctionIds.has(wall.endJunctionId)) {
			addIssue(
				issues,
				`${path}.walls[${index}].endJunctionId`,
				'missing_reference',
				`Unknown junctionId '${wall.endJunctionId}'`
			);
		}
	}

	for (const [index, room] of rooms.entries()) {
		for (const [refIndex, ref] of room.boundary.entries()) {
			if (!wallIds.has(ref.wallId)) {
				addIssue(
					issues,
					`${path}.rooms[${index}].boundary[${refIndex}].wallId`,
					'missing_reference',
					`Unknown wallId '${ref.wallId}'`
				);
			}
		}
		const directedKeys = new Set(
			room.boundary.map((ref) => `${ref.wallId}:${ref.direction}`)
		);
		if (directedKeys.size !== room.boundary.length) {
			addIssue(
				issues,
				`${path}.rooms[${index}].boundary`,
				'duplicate_boundary_reference',
				'A Room boundary may not reference the same Wall in the same direction twice'
			);
		}
	}

	for (const [index, opening] of openings.entries()) {
		if (!wallIds.has(opening.wallId)) {
			addIssue(
				issues,
				`${path}.openings[${index}].wallId`,
				'missing_reference',
				`Unknown wallId '${opening.wallId}'`
			);
		}
		const relation = opening.connectsRoomIds;
		if (!relation) continue;
		if (opening.kind !== 'door') {
			addIssue(
				issues,
				`${path}.openings[${index}].connectsRoomIds`,
				'invalid_value',
				'Only door openings may define portal relations'
			);
		}
		if (!roomIds.has(relation[0])) {
			addIssue(
				issues,
				`${path}.openings[${index}].connectsRoomIds[0]`,
				'missing_reference',
				`Unknown roomId '${relation[0]}'`
			);
		}
		if (!roomIds.has(relation[1])) {
			addIssue(
				issues,
				`${path}.openings[${index}].connectsRoomIds[1]`,
				'missing_reference',
				`Unknown roomId '${relation[1]}'`
			);
		}
	}

	for (const [index, object] of objects.entries()) {
		if (object.roomId && !roomIds.has(object.roomId)) {
			addIssue(
				issues,
				`${path}.objects[${index}].roomId`,
				'missing_reference',
				`Unknown roomId '${object.roomId}'`
			);
		}
	}

	if (issues.length > 0) return undefined;
	if (!floor) return undefined;
	return {
		units: UNITS,
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor,
		junctions,
		walls,
		rooms,
		openings,
		objects
	};
}

function readFormatVersion(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
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
			`Unsupported Layout formatVersion ${input}. Recognized versions: ${KNOWN_LAYOUT_FORMAT_VERSIONS.join(', ')}`
		);
		return undefined;
	}
	return input as LayoutFormatVersion;
}

/** Canonical Floor: `id`/`name`/`elevation` only (P23.6I). */
function parseFloorV5(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
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

function parseJunction(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
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
 * P23.6I — `height` is finite and strictly positive with **no Floor cap**: the
 * canonical Floor carries no vertical extent to clamp against.
 */
function parseWall(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): ParsedValue<LayoutWall> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, WALL_KEYS, path, issues);

	const id = readId(record.id, `${path}.id`, issues);
	const startJunctionId = readId(record.startJunctionId, `${path}.startJunctionId`, issues);
	const endJunctionId = readId(record.endJunctionId, `${path}.endJunctionId`, issues);
	const role = readEnum(record.role, `${path}.role`, ['boundary', 'partition'], issues);
	const thickness = readPositiveNumber(record.thickness, `${path}.thickness`, issues);
	const height = readPositiveNumber(record.height, `${path}.height`, issues);
	// P23.11 — the centerline is required on every Wall (fresh-authority
	// policy: no migration, no missing-field tolerance).
	const centerline = parseWallCenterline(record.centerline, `${path}.centerline`, issues);
	if (
		!id ||
		!startJunctionId ||
		!endJunctionId ||
		!role ||
		thickness === undefined ||
		height === undefined ||
		!centerline
	) {
		return undefined;
	}
	if (startJunctionId === endJunctionId) {
		addIssue(
			issues,
			`${path}.endJunctionId`,
			'invalid_value',
			'A Wall must reference two distinct Junctions'
		);
	}
	return { id, startJunctionId, endJunctionId, role, thickness, height, centerline };
}

/**
 * P23.11 — parse the canonical Wall centerline union. `line` carries no
 * payload; `auto-bezier` requires at least one interior anchor with stable
 * unique IDs and finite X/Z points.
 */
function parseWallCenterline(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
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
	if (kind === 'auto-bezier') {
		assertAllowedKeys(input, ['kind', 'interiorAnchors'], path, issues);
		const anchors = parseArray(input.interiorAnchors, `${path}.interiorAnchors`, issues, parseWallCurveAnchor);
		if (!anchors) return undefined;
		validateUniqueIds(anchors, `${path}.interiorAnchors`, issues, (anchor) => anchor.id);
		if (anchors.length === 0) {
			addIssue(
				issues,
				`${path}.interiorAnchors`,
				'empty_array',
				'A curved Wall centerline requires at least one interior anchor'
			);
			return undefined;
		}
		return { kind: 'auto-bezier', interiorAnchors: anchors };
	}
	if (kind !== undefined) {
		addIssue(issues, `${path}.kind`, 'unsupported_value', `Unsupported wall centerline kind '${kind}'`);
	}
	return undefined;
}

/** One `auto-bezier` interior anchor: stable unique ID + finite X/Z point. */
function parseWallCurveAnchor(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): ParsedValue<LayoutWallCurveAnchor> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, WALL_CURVE_ANCHOR_KEYS, path, issues);
	const id = readId(record.id, `${path}.id`, issues);
	const point = readVec2(record.point, `${path}.point`, issues);
	if (!id || !point) return undefined;
	return { id, point };
}

function parseRoom(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): ParsedValue<LayoutWallFirstRoom> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, ROOM_KEYS, path, issues);

	const id = readId(record.id, `${path}.id`, issues);
	const name = readNonEmptyString(record.name, `${path}.name`, issues);
	const boundary = parseBoundaryRefs(record.boundary, `${path}.boundary`, issues);
	// P23.6I (D7) — a canonical Room with zero boundary references is not a
	// degenerate architecture, it is invalid state: the codec previously accepted
	// `boundary: []` because an empty array parses cleanly, which let a Room with
	// no enclosure reach the compiler and acquire an invented ceiling. The ceiling
	// is derived from boundary Walls, so the boundary must exist.
	if (boundary && boundary.length === 0) {
		addIssue(
			issues,
			`${path}.boundary`,
			'room_boundary_empty',
			'A canonical Room boundary must reference at least one Wall'
		);
	}
	const floorThickness = readPositiveNumber(record.floorThickness, `${path}.floorThickness`, issues);
	const ceilingThickness = readPositiveNumber(record.ceilingThickness, `${path}.ceilingThickness`, issues);
	if (
		!id ||
		!name ||
		!boundary ||
		floorThickness === undefined ||
		ceilingThickness === undefined
	) {
		return undefined;
	}
	return { id, name, boundary, floorThickness, ceilingThickness };
}

function parseBoundaryRefs(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): OrientedWallRef[] | undefined {
	if (!Array.isArray(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected an array');
		return undefined;
	}
	const refs = input.map((value, index) => parseBoundaryRef(value, `${path}[${index}]`, issues));
	return refs.every((ref) => ref !== undefined) ? refs : undefined;
}

function parseBoundaryRef(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): ParsedValue<OrientedWallRef> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, WALL_REF_KEYS, path, issues);

	const wallId = readId(record.wallId, `${path}.wallId`, issues);
	const direction = readEnum(record.direction, `${path}.direction`, ['forward', 'reverse'], issues);
	if (!wallId || !direction) return undefined;
	return { wallId, direction };
}

function parseOpening(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): ParsedValue<LayoutWallOpening> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, OPENING_KEYS, path, issues);

	const id = readId(record.id, `${path}.id`, issues);
	const wallId = readId(record.wallId, `${path}.wallId`, issues);
	const kind = readEnum(record.kind, `${path}.kind`, ['door', 'window'], issues);
	const offset = readNonNegativeNumber(record.offset, `${path}.offset`, issues);
	const width = readPositiveNumber(record.width, `${path}.width`, issues);
	const height = readPositiveNumber(record.height, `${path}.height`, issues);
	const sillHeight = readNonNegativeNumber(record.sillHeight, `${path}.sillHeight`, issues);
	const profile = readEnum(
		record.profile,
		`${path}.profile`,
		['rectangular', 'rounded', 'pointed'],
		issues
	);
	const connectsRoomIds = parsePortalRoomIds(record.connectsRoomIds, `${path}.connectsRoomIds`, issues);
	if (
		!id ||
		!wallId ||
		!kind ||
		offset === undefined ||
		width === undefined ||
		height === undefined ||
		sillHeight === undefined ||
		!profile
	) {
		return undefined;
	}
	return {
		id,
		wallId,
		kind,
		offset,
		width,
		height,
		sillHeight,
		profile,
		...(connectsRoomIds ? { connectsRoomIds } : {})
	};
}

function parsePortalRoomIds(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): [string, string] | undefined {
	if (input === undefined) return undefined;
	if (!Array.isArray(input) || input.length !== 2) {
		addIssue(issues, path, 'invalid_value', 'Expected exactly two room IDs');
		return undefined;
	}
	const first = readId(input[0], `${path}[0]`, issues);
	const second = readId(input[1], `${path}[1]`, issues);
	if (!first || !second) return undefined;
	if (first === second) addIssue(issues, path, 'invalid_value', 'Portal room IDs must be distinct');
	return first.localeCompare(second) <= 0 ? [first, second] : [second, first];
}

function parseObject(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): ParsedValue<LayoutObject> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, OBJECT_KEYS, path, issues);

	const id = readId(record.id, `${path}.id`, issues);
	const kind = readEnum(
		record.kind,
		`${path}.kind`,
		['box', 'plane', 'cylinder', 'sphere', 'profile'],
		issues
	);
	const position = readVec3(record.position, `${path}.position`, issues);
	const rotation = readVec3(record.rotation, `${path}.rotation`, issues);
	const dimensions = readPositiveVec3(record.dimensions, `${path}.dimensions`, issues);
	const roomId = record.roomId === undefined ? undefined : readId(record.roomId, `${path}.roomId`, issues);
	const profile = record.profile === undefined ? undefined : parsePath(record.profile, `${path}.profile`, issues);
	if (kind === 'profile' && !profile) {
		addIssue(issues, `${path}.profile`, 'missing_field', "Profile objects require a closed 'profile'");
	}
	if (kind !== 'profile' && record.profile !== undefined) {
		addIssue(issues, `${path}.profile`, 'unexpected_field', "Only profile objects may define 'profile'");
	}
	if (!id || !kind || !position || !rotation || !dimensions) return undefined;
	return { id, kind, position, rotation, dimensions, ...(profile ? { profile } : {}), ...(roomId ? { roomId } : {}) };
}

function parsePath(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): ParsedValue<import('./layout-types').DraftPath> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, PATH_KEYS, path, issues);

	if (record.closed !== true) {
		addIssue(issues, `${path}.closed`, 'invalid_value', 'Committed paths must be closed');
	}
	const segments = parseArray(record.segments, `${path}.segments`, issues, parseSegment);
	if (!segments) return undefined;
	if (segments.length === 0) {
		addIssue(issues, `${path}.segments`, 'empty_array', 'Expected at least one segment');
	}
	validateUniqueIds(segments, `${path}.segments`, issues, (segment) => segment.id);
	return { closed: true, segments };
}

function parseSegment(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): ParsedValue<import('./layout-types').DraftSegment> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	const kind = readString(record.kind, `${path}.kind`, issues);

	if (kind === 'line') {
		assertAllowedKeys(record, LINE_SEGMENT_KEYS, path, issues);
		const id = readId(record.id, `${path}.id`, issues);
		const start = readVec2(record.start, `${path}.start`, issues);
		const end = readVec2(record.end, `${path}.end`, issues);
		if (!id || !start || !end) return undefined;
		return { id, kind, start, end };
	}

	if (kind === 'auto-bezier') {
		assertAllowedKeys(record, AUTO_BEZIER_SEGMENT_KEYS, path, issues);
		const id = readId(record.id, `${path}.id`, issues);
		const start = readVec2(record.start, `${path}.start`, issues);
		const end = readVec2(record.end, `${path}.end`, issues);
		const interiorAnchors = parseInteriorAnchors(record.interiorAnchors, `${path}.interiorAnchors`, issues);
		if (!id || !start || !end || !interiorAnchors) return undefined;
		return { id, kind, start, end, interiorAnchors };
	}

	if (kind !== undefined) {
		addIssue(issues, `${path}.kind`, 'unsupported_value', `Unsupported segment kind '${kind}'`);
	}
	return undefined;
}

function parseInteriorAnchors(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): ParsedValue<import('./layout-types').LayoutInteriorAnchor[]> {
	const anchors = parseArray(input, path, issues, parseInteriorAnchor);
	if (!anchors) return undefined;
	validateUniqueIds(anchors, path, issues, (anchor) => anchor.id);
	for (const [index, anchor] of anchors.entries()) {
		if (!anchor.point.every((value) => Number.isFinite(value))) {
			addIssue(issues, `${path}[${index}].point`, 'invalid_value', 'Interior anchor point must be finite');
		}
	}
	return anchors;
}

function parseInteriorAnchor(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): ParsedValue<import('./layout-types').LayoutInteriorAnchor> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, INTERIOR_ANCHOR_KEYS, path, issues);
	const id = readId(record.id, `${path}.id`, issues);
	const point = readVec2(record.point, `${path}.point`, issues);
	if (!id || !point) return undefined;
	return { id, point };
}

function parseArray<T>(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
	parser: (value: unknown, path: string, issues: LayoutDocumentIssue[]) => ParsedValue<T>
): T[] | undefined {
	if (!Array.isArray(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected an array');
		return undefined;
	}
	const values = input.map((value, index) => parser(value, `${path}[${index}]`, issues));
	return values.every((value): value is T => value !== undefined) ? values : undefined;
}

function readRecord(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): JsonRecord | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected an object');
		return undefined;
	}
	return input;
}

function isRecord(input: unknown): input is JsonRecord {
	return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function assertAllowedKeys(
	record: JsonRecord,
	allowedKeys: readonly string[],
	path: string,
	issues: LayoutDocumentIssue[]
): void {
	const allowed = new Set(allowedKeys);
	for (const key of Object.keys(record)) {
		if (!allowed.has(key)) {
			addIssue(issues, `${path}.${key}`, 'unknown_key', `Unknown key '${key}'`);
		}
	}
}

function readString(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): string | undefined {
	if (typeof input !== 'string') {
		addIssue(issues, path, 'invalid_type', 'Expected a string');
		return undefined;
	}
	return input;
}

function readNonEmptyString(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): string | undefined {
	const value = readString(input, path, issues);
	if (value !== undefined && value.trim().length === 0) {
		addIssue(issues, path, 'invalid_value', 'Expected a non-empty string');
		return undefined;
	}
	return value;
}

function readId(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): string | undefined {
	const value = readString(input, path, issues);
	if (value !== undefined && !ID_PATTERN.test(value)) {
		addIssue(issues, path, 'invalid_id', 'Expected an ID matching /^[A-Za-z0-9][A-Za-z0-9._:-]*$/');
		return undefined;
	}
	return value;
}

function readNumber(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): number | undefined {
	if (typeof input !== 'number' || !Number.isFinite(input)) {
		addIssue(issues, path, 'invalid_number', 'Expected a finite number');
		return undefined;
	}
	return input;
}

function readPositiveNumber(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): number | undefined {
	const value = readNumber(input, path, issues);
	if (value !== undefined && value <= 0) {
		addIssue(issues, path, 'invalid_value', 'Expected a number greater than zero');
		return undefined;
	}
	return value;
}

function readNonNegativeNumber(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): number | undefined {
	const value = readNumber(input, path, issues);
	if (value !== undefined && value < 0) {
		addIssue(issues, path, 'invalid_value', 'Expected a number greater than or equal to zero');
		return undefined;
	}
	return value;
}

function readVec2(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): LayoutVec2 | undefined {
	if (!Array.isArray(input) || input.length !== 2) {
		addIssue(issues, path, 'invalid_type', 'Expected a 2-number vector');
		return undefined;
	}
	const x = readNumber(input[0], `${path}[0]`, issues);
	const y = readNumber(input[1], `${path}[1]`, issues);
	return x === undefined || y === undefined ? undefined : [x, y];
}

function readVec3(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): [number, number, number] | undefined {
	if (!Array.isArray(input) || input.length !== 3) {
		addIssue(issues, path, 'invalid_type', 'Expected a 3-number vector');
		return undefined;
	}
	const x = readNumber(input[0], `${path}[0]`, issues);
	const y = readNumber(input[1], `${path}[1]`, issues);
	const z = readNumber(input[2], `${path}[2]`, issues);
	return x === undefined || y === undefined || z === undefined ? undefined : [x, y, z];
}

function readPositiveVec3(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): [number, number, number] | undefined {
	const vector = readVec3(input, path, issues);
	if (!vector) return undefined;
	if (vector.some((value) => value <= 0)) {
		addIssue(issues, path, 'invalid_value', 'Expected every dimension to be greater than zero');
		return undefined;
	}
	return vector;
}

function readEnum<T extends string>(
	input: unknown,
	path: string,
	values: readonly T[],
	issues: LayoutDocumentIssue[]
): T | undefined {
	const value = readString(input, path, issues);
	if (value === undefined) return undefined;
	if (!values.includes(value as T)) {
		addIssue(issues, path, 'unsupported_value', `Expected one of: ${values.join(', ')}`);
		return undefined;
	}
	return value as T;
}

function validateUniqueIds<T>(
	values: T[],
	path: string,
	issues: LayoutDocumentIssue[],
	getId: (value: T) => string
): void {
	const seen = new Set<string>();
	for (const [index, value] of values.entries()) {
		const id = getId(value);
		if (seen.has(id)) {
			addIssue(issues, `${path}[${index}].id`, 'duplicate_id', `Duplicate ID '${id}'`);
		}
		seen.add(id);
	}
}

function addIssue(
	issues: LayoutDocumentIssue[],
	path: string,
	code: string,
	message: string
): void {
	issues.push({ path, code, message });
}

function invalidJsonMessage(error: unknown, json: string): string {
	const message = error instanceof Error ? error.message : 'Invalid JSON';
	const match = /position (\d+)/.exec(message);
	if (!match) return 'Invalid JSON';
	const offset = Number(match[1]);
	const before = json.slice(0, offset);
	const line = before.split('\n').length;
	const column = offset - before.lastIndexOf('\n');
	return `Invalid JSON near line ${line}, column ${column}.`;
}
