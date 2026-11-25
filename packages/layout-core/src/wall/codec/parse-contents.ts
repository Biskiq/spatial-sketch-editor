import type { LayoutObject, LayoutSpaceVirtualEdge, LayoutWallOpening, OrientedWallRef } from '../types';
import type { LayoutDocumentIssue } from '../../plan/issue';
import { parseOptionalName } from './parse-structure';
import { addIssue, assertAllowedKeys, parseArray, readEnum, readId, readNonNegativeNumber, readPositiveNumber, readPositiveVec3, readRecord, readString, readVec2, readVec3, validateUniqueIds } from './readers';
import type { ParsedValue } from './schema';
import { AUTO_BEZIER_SEGMENT_KEYS, INTERIOR_ANCHOR_KEYS, LINE_SEGMENT_KEYS, OBJECT_KEYS, OPENING_KEYS, PATH_KEYS, VIRTUAL_EDGE_KEYS, WALL_REF_KEYS } from './schema';

export function parseVirtualEdge(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[]
): ParsedValue<LayoutSpaceVirtualEdge> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, VIRTUAL_EDGE_KEYS, path, issues);
	const startJunctionId = readId(record.startJunctionId, `${path}.startJunctionId`, issues);
	const endJunctionId = readId(record.endJunctionId, `${path}.endJunctionId`, issues);
	if (!startJunctionId || !endJunctionId) return undefined;
	return { startJunctionId, endJunctionId };
}


export function parseBoundaryRefs(
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


export function parseOpening(
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
	const name = parseOptionalName(record.name, `${path}.name`, issues);
	if (
		!id ||
		!wallId ||
		!kind ||
		offset === undefined ||
		width === undefined ||
		height === undefined ||
		sillHeight === undefined ||
		!profile ||
		(record.name !== undefined && name === undefined)
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
		...(connectsRoomIds ? { connectsRoomIds } : {}),
		...(name !== undefined ? { name } : {})
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


export function parseObject(
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
): ParsedValue<import('../../geometry/path').DraftPath> {
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
): ParsedValue<import('../../geometry/path').DraftSegment> {
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
): ParsedValue<import('../../geometry/path').LayoutInteriorAnchor[]> {
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
): ParsedValue<import('../../geometry/path').LayoutInteriorAnchor> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, INTERIOR_ANCHOR_KEYS, path, issues);
	const id = readId(record.id, `${path}.id`, issues);
	const point = readVec2(record.point, `${path}.point`, issues);
	if (!id || !point) return undefined;
	return { id, point };
}
