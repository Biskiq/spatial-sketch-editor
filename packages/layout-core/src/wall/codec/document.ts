import { countWork } from '../../kernel/work-observer';
import type { LayoutDocumentWallFirst, LayoutWall, OrientedWallRef } from '../types';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '../types';
import { emptyLayoutIdentityLedger } from '../../plan/identity';
import type { LayoutDocumentIssue } from '../../plan/issue';
import { LayoutDocumentValidationError } from '../../plan/issue';
import { regionGeometryIssues } from '../../room/region-validation';
import { layoutDimensionLimitIssues } from '../../geometry/limits';
import { parseDocument } from './parse-document';
import { invalidJsonMessage } from './readers';
import type { WallFirstLayoutValidationResult } from './schema';
import { UNITS } from './schema';

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
		objects: [],
		regions: [],
		// The canonical writers always emit the ledger; it stays optional
		// on read because documents written before the ledger lack it.
		identity: emptyLayoutIdentityLedger(),
	};
}

/**
 * Strict wall-first validation. Any issue rejects the whole document.
 *
 * Reference rules enforced here:
 * - IDs are unique within their document-global collection (junctions, walls,
 *  openings, objects) and across rooms;
 * - every Wall references two existing, distinct Junction IDs;
 * - duplicate Walls between the same two Junctions are invalid, except the
 *  exactly-two curved Walls of a two-Wall lens (topology must then prove the
 *  loop closed, simple and bounded);
 * - Room boundary references point at existing Walls; a Room boundary must
 *  not use the same directed Wall ref twice (undirected reuse across two
 *  Rooms is the shared-wall case and stays valid);
 * - openings reference existing Walls (document-global `wallId`);
 * - `LayoutObject.roomId` still references a persistent Room — the optional
 *  semantic association survives the schema change unchanged.
 */
export function validateWallFirstLayoutDocument(input: unknown): WallFirstLayoutValidationResult {
	const issues: LayoutDocumentIssue[] = [];
	countWork('validation:layout-document');
	const parsed = parseDocument(input, '$', issues);
	if (!parsed || issues.length > 0) {
		return { success: false, issues };
	}
	// The unsupported-dimension gate is part of the read contract: an imported
	// source is refused here, before the compiler, Paper drawing or Camera ever
	// samples it. The limit and its measurement live in layout-geometry-limits.
	const limitIssues = layoutDimensionLimitIssues(parsed);
	if (parsed.regions.length) limitIssues.push(...regionGeometryIssues(parsed.regions));
	if (limitIssues.length > 0) {
		return { success: false, issues: limitIssues };
	}

	let memoizedCanonicalJson: string | undefined;
	return {
		success: true,
		document: parsed,
		get canonicalJson(): string {
			if (memoizedCanonicalJson === undefined) {
				memoizedCanonicalJson = JSON.stringify(parsed, null, 2) + '\n';
			}
			return memoizedCanonicalJson;
		},
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
					message: invalidJsonMessage(error, json),
				},
			],
		};
	}
}

/**
 * The canonical *writer* format requirement (S1b).
 *
 * The canonical writers receive canonical current-format state, so a document
 * declaring any other format version rejects fail-closed instead of being
 * persisted as if it were current. This is current-format strictness, not a
 * compatibility branch: the codec recognizes exactly one version, so there is no
 * historical payload that could be rewritten on the way out.
 *
 * Returns `undefined` when the input is not an object at all, so structural
 * validation owns that report.
 */
export function wallFirstCanonicalFormatVersionIssue(
	input: unknown,
): LayoutDocumentIssue | undefined {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined;
	const declared = (input as { formatVersion?: unknown }).formatVersion;
	if (declared === LAYOUT_WALL_FIRST_FORMAT_VERSION) return undefined;
	return {
		path: '$.formatVersion',
		code: 'unsupported_format_version',
		message: `Canonical Layout Save requires formatVersion ${LAYOUT_WALL_FIRST_FORMAT_VERSION}; got ${String(
			declared,
		)}. Canonical writers never migrate a historical payload.`,
	};
}

/**
 * Canonical Layout serialization. Throws on invalid input.
 *
 * Unlike validation, this is a **writer**: it requires canonical current-format
 * state and rejects a historical payload by name.
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

/** True when oriented Wall references form one closed chain. */
export function closedBoundaryChains(
	boundary: readonly OrientedWallRef[],
	wallById: ReadonlyMap<string, LayoutWall>,
): boolean {
	let firstStart: string | undefined;
	let previousEnd: string | undefined;
	for (const ref of boundary) {
		const wall = wallById.get(ref.wallId);
		if (!wall) return false;
		const start = ref.direction === 'forward' ? wall.startJunctionId : wall.endJunctionId;
		const end = ref.direction === 'forward' ? wall.endJunctionId : wall.startJunctionId;
		if (firstStart === undefined) firstStart = start;
		if (previousEnd !== undefined && previousEnd !== start) return false;
		previousEnd = end;
	}
	return boundary.length > 0 && previousEnd === firstStart;
}
