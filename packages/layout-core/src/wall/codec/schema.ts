import type { LayoutDocumentWallFirst } from '../types';
import type { LayoutDocumentIssue } from '../../plan/issue';

/**
 * Validation result carrying the wall-first document type, not the legacy one.
 *
 * A success is **always** the canonical current-format document. There is one
 * recognized version (`8`) and no historical variant: a payload declaring anything
 * else fails as `unsupported_format_version`.
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

export const UNITS = 'meters' as const;

export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export type JsonRecord = Record<string, unknown>;

export type ParsedValue<T> = T | undefined;

export const ROOT_KEYS = [
	'units',
	'formatVersion',
	'floor',
	'junctions',
	'walls',
	'rooms',
	'openings',
	'objects',
	'regions',
	'identity',
] as const;

/** The reference ledger's key set. */
export const IDENTITY_KEYS = [
	'cursor',
	'rooms',
	'junctions',
	'walls',
	'openings',
	'regions',
] as const;

/**
 * Canonical Floor key set. The current Floor has no vertical extent, so a
 * present `height` is `unknown_key`.
 */
export const FLOOR_KEYS_V5 = ['id', 'name', 'elevation'] as const;

export const JUNCTION_KEYS = ['id', 'point'] as const;

export const WALL_KEYS = [
	'id',
	'startJunctionId',
	'endJunctionId',
	'thickness',
	'height',
	'top',
	'centerline',
	'name',
] as const;

/** The level top: the only shape a closed Wall admits and the default shape. */
export const WALL_TOP_LEVEL_KEYS = ['kind'] as const;

/** Every key a non-level top may carry; the parser rejects an extra key. */
export const WALL_TOP_KEYS = ['kind', 'startRise', 'endRise', 'apexRise', 'apexOffset'] as const;

/** One bend point of a Wall `cubic-chain` centerline. */
export const WALL_CURVE_KNOT_KEYS = ['id', 'point'] as const;

/** One cubic span of a Wall `cubic-chain` centerline: controls only. */
export const WALL_CURVE_SPAN_KEYS = ['handleOut', 'handleIn'] as const;

export const ROOM_KEYS = ['id', 'name', 'boundary', 'virtualEdges', 'overhead', 'round'] as const;

export const ROOM_ROUND_KEYS = ['center', 'radius'] as const;

export const VIRTUAL_EDGE_KEYS = ['startJunctionId', 'endJunctionId'] as const;

export const SPACE_OVERHEAD_VALUES = ['closed', 'open-to-sky'] as const;

export const WALL_REF_KEYS = ['wallId', 'direction'] as const;

export const OPENING_KEYS = [
	'id',
	'wallId',
	'kind',
	'offset',
	'width',
	'height',
	'sillHeight',
	'profile',
	'connectsRoomIds',
	'name',
] as const;

export const OBJECT_KEYS = [
	'id',
	'kind',
	'position',
	'rotation',
	'dimensions',
	'profile',
	'roomId',
] as const;

export const PATH_KEYS = ['closed', 'segments'] as const;

export const LINE_SEGMENT_KEYS = ['id', 'kind', 'start', 'end'] as const;

export const AUTO_BEZIER_SEGMENT_KEYS = ['id', 'kind', 'start', 'end', 'interiorAnchors'] as const;

export const INTERIOR_ANCHOR_KEYS = ['id', 'point'] as const;
