/**
 * `standalone-scene-import.ts` — P23.0 F0 stage 5: standalone Scene import
 * with explicit frame provenance.
 *
 * A `.scenepack.zip` / pasted `scene.json` carries Scene state without Layout
 * Room frames, so a legacy room-local Scene is not independently convertible
 * unless trustworthy frame context is supplied (P23.0 "Standalone
 * `scene.json` / `.scenepack`"):
 *
 * ```text
 * new world-local Scene
 * → parse directly
 *
 * legacy room-local Scene + explicit user-supplied Room-ID → frame mapping
 * → convert once to world-local
 *
 * legacy room-local Scene + missing/incomplete/invalid frame mapping
 * → reject with a dedicated diagnostic (never guess, never identity-fill)
 * ```
 *
 * The mapping is explicit user trust (an import UI designed for that purpose
 * supplies it); Room IDs merely matching an open project, proximity, or
 * identity fallbacks are never accepted here. The converted Scene is
 * world-local (`formatVersion: 1`) and installs into a world-local session;
 * the current legacy session keeps its own direct legacy install path, so
 * this module wires no menu behavior pre-F0.
 */
import { identifySceneFormat } from './scene-format';
import { convertSceneDocumentToWorldLocal } from './scene-world-conversion';
import { createLayoutRoomRegistry, type LayoutRoomRegistry } from './project-layout-semantics';
import type {
	SceneDocument,
	SceneObjectCluster,
	SceneEntity,
	SceneNavigationNode,
	SceneConnection
} from './scene';
import type { LayoutFloor, LayoutRoom } from '@portfolio/layout-core';
import type { SceneDocumentIssue } from './scene-codec';

/** Explicit user-supplied legacy frame for one Room ID. */
export type StandaloneSceneFrame = {
	/** Room origin in project/world X/Z meters. */
	origin: readonly [number, number];
	/** Room yaw in radians. */
	yaw: number;
	/** Floor elevation in meters. */
	floorElevation: number;
};

/** Explicit user-supplied Room-ID → legacy-frame mapping. */
export type StandaloneSceneFrameMapping = Readonly<Record<string, StandaloneSceneFrame>>;

export type StandaloneSceneImportReason =
	| 'unrecognized'
	| 'missing-frame-mapping'
	| 'incomplete-frame-mapping'
	| 'invalid-frame-mapping';

export type StandaloneSceneImport =
	| {
			kind: 'ready';
			/** Converted (or directly parsed) world-local Scene. */
			scene: SceneDocument;
			sceneSpace: 'project-world';
			/** Sorted Room IDs the mapping supplied (provenance record). */
			mappingRooms: readonly string[];
	  }
	| {
			kind: 'rejected';
			reason: StandaloneSceneImportReason;
			issues: SceneDocumentIssue[];
	  };

function isFinitePair(value: unknown): value is readonly [number, number] {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		typeof value[0] === 'number' &&
		Number.isFinite(value[0]) &&
		typeof value[1] === 'number' &&
		Number.isFinite(value[1])
	);
}

/** Every Room ID a legacy Scene's spatial values depend on. */
export function collectLegacySceneRoomIds(document: SceneDocument): readonly string[] {
	const referenced = new Set<string>();
	const collect = (roomId: string | undefined) => {
		if (roomId !== undefined) referenced.add(roomId);
	};
	for (const entity of document.entities as SceneEntity[]) collect(entity.roomId);
	for (const cluster of (document.clusters ?? []) as SceneObjectCluster[]) collect(cluster.roomId);
	for (const node of document.navigationNodes as SceneNavigationNode[]) collect(node.roomId);
	for (const connection of document.connections as SceneConnection[]) {
		for (const anchor of connection.positionPath.anchors) collect(anchor.roomId);
		for (const waypoint of connection.targetWaypoints ?? []) collect(waypoint.roomId);
		for (const direction of ['forward', 'reverse'] as const) {
			for (const keyframe of connection.viewTracks?.[direction] ?? []) collect(keyframe.roomId);
		}
	}
	return [...referenced].sort();
}

/**
 * Build an import-scoped Room registry from an explicit user mapping, so
 * conversion reuses the exact production frame math (`migrateEntityTransform`
 * / `layoutRoomPoint`) instead of a second implementation. Stub rooms carry
 * no boundary/openings — conversion reads only frames and floor elevation —
 * and are labeled imported, never mistaken for authored Layout state.
 */
function registryFromMapping(mapping: Record<string, StandaloneSceneFrame>): LayoutRoomRegistry {
	const layout = {
		floors: Object.entries(mapping).map(([roomId, frame]): LayoutFloor => {
			const floor: LayoutFloor = {
				id: `imported-floor:${roomId}`,
				name: 'Imported frame context',
				elevation: frame.floorElevation,
				height: 3,
				rooms: []
			};
			const room: LayoutRoom = {
				id: roomId,
				name: `Imported ${roomId}`,
				frame: { origin: [frame.origin[0], frame.origin[1]] as [number, number], yaw: frame.yaw },
				wallThickness: 0.2,
				floorThickness: 0.1,
				ceilingThickness: 0.1,
				boundary: { closed: true, segments: [] },
				openings: []
			};
			floor.rooms = [room];
			return floor;
		}),
		objects: []
	};
	return createLayoutRoomRegistry(layout as never);
}

/**
 * Import a standalone Scene payload. `frameMapping` is required for legacy
 * room-local Scenes and ignored for world-local ones.
 */
export function importStandaloneSceneDocument(
	input: unknown,
	frameMapping?: StandaloneSceneFrameMapping
): StandaloneSceneImport {
	const identified = identifySceneFormat(input);
	if (identified.kind === 'unrecognized') {
		return { kind: 'rejected', reason: 'unrecognized', issues: identified.issues };
	}
	if (identified.kind === 'world-local') {
		return { kind: 'ready', scene: identified.document, sceneSpace: 'project-world', mappingRooms: [] };
	}

	// Recognized legacy room-local Scene: conversion needs complete, valid,
	// explicit frame context — nothing else qualifies.
	if (frameMapping === undefined) {
		return {
			kind: 'rejected',
			reason: 'missing-frame-mapping',
			issues: [
				{
					path: '$',
					code: 'missing_legacy_room_frame_context',
					message:
						'Legacy room-local Scene values cannot be converted without explicit Room-ID frame context: supply the source Room frames, do not guess them from the open project'
				}
			]
		};
	}
	const entries = Object.entries(frameMapping);
	const invalid = entries.filter(
		([roomId, frame]) =>
			typeof roomId !== 'string' ||
			roomId.length === 0 ||
			typeof frame !== 'object' ||
			frame === null ||
			!isFinitePair((frame as StandaloneSceneFrame).origin) ||
			typeof (frame as StandaloneSceneFrame).yaw !== 'number' ||
			!Number.isFinite((frame as StandaloneSceneFrame).yaw) ||
			typeof (frame as StandaloneSceneFrame).floorElevation !== 'number' ||
			!Number.isFinite((frame as StandaloneSceneFrame).floorElevation)
	);
	if (invalid.length > 0) {
		return {
			kind: 'rejected',
			reason: 'invalid-frame-mapping',
			issues: [
				{
					path: '$',
					code: 'invalid_frame_mapping',
					message: `Frame mapping has invalid entries for room${invalid.length > 1 ? 's' : ''}: ${invalid.map(([roomId]) => `'${roomId}'`).join(', ')} (each needs a finite [x, z] origin, yaw and floorElevation)`
				}
			]
		};
	}
	const needed = collectLegacySceneRoomIds(identified.document);
	const missing = needed.filter((roomId) => !(roomId in frameMapping));
	if (missing.length > 0) {
		return {
			kind: 'rejected',
			reason: 'incomplete-frame-mapping',
			issues: [
				{
					path: '$',
					code: 'incomplete_frame_mapping',
					message: `Frame mapping is missing rooms referenced by the Scene: ${missing.map((roomId) => `'${roomId}'`).join(', ')} (missing frames are never replaced with identity transforms)`
				}
			]
		};
	}
	const mappingRooms = Object.keys(frameMapping).sort();
	const scene = convertSceneDocumentToWorldLocal(
		identified.document,
		registryFromMapping(frameMapping as Record<string, StandaloneSceneFrame>)
	);
	return { kind: 'ready', scene, sceneSpace: 'project-world', mappingRooms };
}
