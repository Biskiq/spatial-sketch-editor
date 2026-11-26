import type { LayoutDocumentWallFirst, LayoutWall } from '../types';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '../types';
import { composeSpaceBoundary } from '../../room/reconciliation-boundary';
import { validateRoundRooms } from '../../room/round-room';
import type { LayoutDocumentIssue } from '../../plan/issue';
import { closedBoundaryChains } from './document';
import { parseObject, parseOpening } from './parse-contents';
import {
	parseFloorV5,
	parseIdentityLedger,
	parseJunction,
	parseRegion,
	parseRoom,
	parseWall,
	readFormatVersion,
} from './parse-structure';
import {
	addIssue,
	assertAllowedKeys,
	parseArray,
	readRecord,
	readString,
	validateUniqueIds,
} from './readers';
import type { ParsedValue } from './schema';
import { ROOT_KEYS, UNITS } from './schema';

export function parseDocument(
	input: unknown,
	path: string,
	issues: LayoutDocumentIssue[],
): ParsedValue<LayoutDocumentWallFirst> {
	const record = readRecord(input, path, issues);
	if (!record) return undefined;
	assertAllowedKeys(record, ROOT_KEYS, path, issues);

	const units = readString(record.units, `${path}.units`, issues);
	if (units !== UNITS) {
		addIssue(issues, `${path}.units`, 'unsupported_units', `Expected units '${UNITS}'`);
	}

	const formatVersion = readFormatVersion(record.formatVersion, `${path}.formatVersion`, issues);
	if (formatVersion === undefined) return undefined;
	// One Floor key set only: no vertical extent, so a present `height`
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
	const regions = parseArray(record.regions, `${path}.regions`, issues, parseRegion);
	// The reference ledger is optional on read (pre- documents and
	// already-published releases have none) but strict when present: malformed
	// tokens and duplicate values reject.
	const identity = parseIdentityLedger(record.identity, `${path}.identity`, issues);
	if (record.identity !== undefined && !identity) return undefined;
	if (!floor || !junctions || !walls || !rooms || !openings || !objects || !regions) {
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
	if (regions.length) {
		const occupied = new Set([floor.id, ...junctionIds, ...wallIds, ...roomIds]);
		for (const subject of [...openings, ...objects]) occupied.add(subject.id);
		for (const [index, region] of regions.entries()) {
			const regionPath = `${path}.regions[${index}]`;
			if (occupied.has(region.id))
				addIssue(issues, `${regionPath}.id`, 'duplicate_id', `Duplicate Layout id '${region.id}'`);
			occupied.add(region.id);
			for (const [gapIndex, id] of region.intendedGaps.entries()) {
				if (!wallIds.has(id))
					addIssue(
						issues,
						`${regionPath}.intendedGaps[${gapIndex}]`,
						'missing_reference',
						`Unknown wallId '${id}'`,
					);
			}
		}
	}

	// H3 minimum invariant: duplicate Walls between the same two Junctions are
	// invalid — in either direction (a reversed pair is the same physical wall
	// with opposed canonical orientation, not two Walls). The one exception is
	// a two-Wall lens: two distinct Walls between two distinct Junctions enclose
	// a real region when at least one of them is curved. A straight chord plus
	// a bowed Wall is the ordinary D-shaped Room; two cubic Walls are the lens.
	// Topology still has to prove that loop closed, simple and bounded; here the
	// codec only admits the candidate shape.
	const seenWallPairs = new Map<string, { wall: LayoutWall; count: number }>();
	for (const [index, wall] of walls.entries()) {
		const pairKey = [wall.startJunctionId, wall.endJunctionId].sort().join('|');
		const previous = seenWallPairs.get(pairKey);
		const twoWallLens =
			previous?.count === 1 &&
			previous.wall.startJunctionId !== previous.wall.endJunctionId &&
			(previous.wall.centerline.kind === 'cubic-chain' || wall.centerline.kind === 'cubic-chain');
		if (previous !== undefined && !twoWallLens) {
			addIssue(
				issues,
				`${path}.walls[${index}]`,
				'duplicate_wall_pair',
				`Duplicate Wall between junctions '${wall.startJunctionId}' and '${wall.endJunctionId}'`,
			);
		}
		if (previous === undefined) seenWallPairs.set(pairKey, { wall, count: 1 });
		else previous.count += 1;
	}

	for (const [index, wall] of walls.entries()) {
		if (!junctionIds.has(wall.startJunctionId)) {
			addIssue(
				issues,
				`${path}.walls[${index}].startJunctionId`,
				'missing_reference',
				`Unknown junctionId '${wall.startJunctionId}'`,
			);
		}
		if (!junctionIds.has(wall.endJunctionId)) {
			addIssue(
				issues,
				`${path}.walls[${index}].endJunctionId`,
				'missing_reference',
				`Unknown junctionId '${wall.endJunctionId}'`,
			);
			continue;
		}
	}

	const wallById = new Map(walls.map((wall) => [wall.id, wall] as const));
	/** Wall side → the first Room that referenced it (I6). */
	const wallSideOwner = new Map<string, string>();
	for (const [index, room] of rooms.entries()) {
		let referencesResolve = true;
		for (const [refIndex, ref] of room.boundary.entries()) {
			if (!wallIds.has(ref.wallId)) {
				referencesResolve = false;
				addIssue(
					issues,
					`${path}.rooms[${index}].boundary[${refIndex}].wallId`,
					'missing_reference',
					`Unknown wallId '${ref.wallId}'`,
				);
			}
		}
		const directedKeys = new Set(room.boundary.map((ref) => `${ref.wallId}:${ref.direction}`));
		if (directedKeys.size !== room.boundary.length) {
			addIssue(
				issues,
				`${path}.rooms[${index}].boundary`,
				'duplicate_boundary_reference',
				'A Room boundary may not reference the same Wall in the same direction twice',
			);
		}
		// I6 — a Wall side belongs to at most one Space. Unlike today's
		// per-Room check this is document-global, so two Rooms can never both
		// claim the same face direction.
		for (const [refIndex, ref] of room.boundary.entries()) {
			const sideKey = `${ref.wallId}:${ref.direction}`;
			const owner = wallSideOwner.get(sideKey);
			if (owner === undefined) {
				wallSideOwner.set(sideKey, room.id);
			} else if (owner !== room.id) {
				addIssue(
					issues,
					`${path}.rooms[${index}].boundary[${refIndex}]`,
					'duplicate_wall_side_reference',
					`Wall side '${sideKey}' is already referenced by Room '${owner}'`,
				);
			}
		}
		// I8 — every virtual end is an existing Junction. The composer
		// below adds I2/I3; endpoint resolution is reported here so the path
		// names the exact field.
		for (const [edgeIndex, edge] of room.virtualEdges.entries()) {
			if (!junctionIds.has(edge.startJunctionId)) {
				referencesResolve = false;
				addIssue(
					issues,
					`${path}.rooms[${index}].virtualEdges[${edgeIndex}].startJunctionId`,
					'missing_reference',
					`Unknown junctionId '${edge.startJunctionId}'`,
				);
			}
			if (!junctionIds.has(edge.endJunctionId)) {
				referencesResolve = false;
				addIssue(
					issues,
					`${path}.rooms[${index}].virtualEdges[${edgeIndex}].endJunctionId`,
					'missing_reference',
					`Unknown junctionId '${edge.endJunctionId}'`,
				);
			}
		}
		if (!referencesResolve) continue;
		// I2/I3 are open-Space rules. A structurally closed Room keeps the
		// compiler/shared-core Wall-chain contract, as it was at format 7, so
		// validation does not re-compose every enclosed Room. A closed boundary
		// that does not chain still enters the composer so its established
		// `space_boundary_open` diagnosis and message are preserved.
		if (room.virtualEdges.length === 0 && closedBoundaryChains(room.boundary, wallById)) continue;
		// I2/I3 — one closed cycle that consumes every virtual edge. The
		// composer is the one parser; the codec never re-implements its order.
		const composed = composeSpaceBoundary({ junctions, walls }, room);
		if (composed.kind === 'failed') {
			const issue = composed.issue;
			const issuePath =
				issue.code === 'space_virtual_edge_unconsumed' ||
				issue.code === 'duplicate_virtual_edge_origin'
					? `${path}.rooms[${index}].virtualEdges`
					: issue.code === 'space_virtual_edge_degenerate'
						? `${path}.rooms[${index}].virtualEdges[${issue.index ?? 0}]`
						: `${path}.rooms[${index}].boundary`;
			addIssue(issues, issuePath, issue.code, issue.message);
		}
	}

	for (const [index, opening] of openings.entries()) {
		if (!wallIds.has(opening.wallId)) {
			addIssue(
				issues,
				`${path}.openings[${index}].wallId`,
				'missing_reference',
				`Unknown wallId '${opening.wallId}'`,
			);
		}
		const relation = opening.connectsRoomIds;
		if (!relation) continue;
		if (opening.kind !== 'door') {
			addIssue(
				issues,
				`${path}.openings[${index}].connectsRoomIds`,
				'invalid_value',
				'Only door openings may define portal relations',
			);
		}
		if (!roomIds.has(relation[0])) {
			addIssue(
				issues,
				`${path}.openings[${index}].connectsRoomIds[0]`,
				'missing_reference',
				`Unknown roomId '${relation[0]}'`,
			);
		}
		if (!roomIds.has(relation[1])) {
			addIssue(
				issues,
				`${path}.openings[${index}].connectsRoomIds[1]`,
				'missing_reference',
				`Unknown roomId '${relation[1]}'`,
			);
		}
	}

	for (const [index, object] of objects.entries()) {
		if (object.roomId && !roomIds.has(object.roomId)) {
			addIssue(
				issues,
				`${path}.objects[${index}].roomId`,
				'missing_reference',
				`Unknown roomId '${object.roomId}'`,
			);
		}
	}

	if (issues.length === 0) {
		// C1 Round certification: replaces the legacy fixed-tolerance closed-circle
		// check with one centre-local binary64 uncertainty-aware checker shared
		// across isolated closed circles and open cubic rings.
		issues.push(...validateRoundRooms({ junctions, walls, rooms }, path));
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
		objects,
		regions,
		...(identity ? { identity } : {}),
	};
}
