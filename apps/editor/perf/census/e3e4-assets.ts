/**
 * E3 — sharing census and E4 — residency census (T1.P02.S06 C).
 * "Census, not timing."
 *
 * Both read the placed models' real GLB bytes (the shipped catalogue models the
 * museum-shaped workloads place; the realistic-L derivatives once approved).
 *
 * - **E3**: placements, unique definitions, unique (definition, mesh, material)
 *   triples and materials created per placement. `cloneModelScene`
 *   (`museum/assets/model-utils.ts`) clones every placement's materials, so a
 *   placement creates as many materials as its model has. The ratio of
 *   placement-level submissions to unique triples bounds what instancing could
 *   save. A finding for T2, which owns the clone; S06 changes nothing there.
 * - **E4**: for each Stop, the textures of the models placed in the E2-visible
 *   Rooms plus those of the next Stop, in bytes at today's GPU format (RGBA8
 *   with mips) and by arithmetic at 1 B/px and 0.5 B/px compressed formats.
 *   Texture bytes only, one part of GPU memory: reported beside the
 *   geometry-buffer bytes of the same models and against the 384 MiB laptop-A
 *   row, never as total GPU-memory compliance.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

import { compileWallFirstLayoutGeometry, type LayoutVec2 } from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

import { assets } from '$lib/content/assets';

import { posesOf, visibleRoomsFrom } from './e2-visibility';

const STATIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../static');
const MIB = 1024 * 1024;
const MIP_FACTOR = 4 / 3;

export type ModelTexture = { readonly key: string; readonly mime: string; readonly width: number; readonly height: number; readonly storedBytes: number };

export type ModelFacts = {
	readonly assetId: string;
	readonly file: string;
	readonly fileBytes: number;
	readonly meshes: number;
	readonly primitives: number;
	readonly materials: number;
	readonly triangles: number;
	readonly geometryBytes: number;
	readonly textures: readonly ModelTexture[];
};

/** WebP canvas size from its RIFF header (VP8, VP8L or VP8X). */
function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const chunk = String.fromCharCode(...bytes.slice(12, 16));
	if (chunk === 'VP8X') return { width: 1 + (view.getUint32(24, true) & 0xffffff), height: 1 + (view.getUint32(27, true) & 0xffffff) };
	if (chunk === 'VP8L') {
		const bits = view.getUint32(21, true);
		return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
	}
	if (chunk === 'VP8 ') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
	return null;
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
	if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}

async function io(): Promise<NodeIO> {
	await MeshoptDecoder.ready;
	return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
}

function factsOf(assetId: string, file: string, fileBytes: number, document: Document): ModelFacts {
	const root = document.getRoot();
	let primitives = 0;
	let triangles = 0;
	let geometryBytes = 0;
	const accessorsSeen = new Set<unknown>();
	for (const mesh of root.listMeshes()) {
		for (const primitive of mesh.listPrimitives()) {
			primitives += 1;
			const indices = primitive.getIndices();
			const position = primitive.getAttribute('POSITION');
			triangles += Math.floor((indices?.getCount() ?? position?.getCount() ?? 0) / 3);
			for (const accessor of [indices, ...primitive.listAttributes()]) {
				if (accessor === null || accessorsSeen.has(accessor)) continue;
				accessorsSeen.add(accessor);
				geometryBytes += accessor.getArray()?.byteLength ?? 0;
			}
		}
	}
	const textures = root.listTextures().map((texture, index): ModelTexture => {
		const image = texture.getImage() ?? new Uint8Array();
		const mime = texture.getMimeType();
		const size = mime === 'image/webp' ? webpSize(image) : pngSize(image);
		return { key: `${assetId}#${index}`, mime, width: size?.width ?? 0, height: size?.height ?? 0, storedBytes: image.byteLength };
	});
	return {
		assetId,
		file,
		fileBytes,
		meshes: root.listMeshes().length,
		primitives,
		materials: root.listMaterials().length,
		triangles,
		geometryBytes,
		textures
	};
}

export async function readModelFacts(assetIds: readonly string[]): Promise<Map<string, ModelFacts>> {
	const reader = await io();
	const facts = new Map<string, ModelFacts>();
	for (const assetId of [...new Set(assetIds)].sort()) {
		const asset = assets.find((candidate) => candidate.id === assetId);
		if (asset?.productionFile === undefined) throw new Error(`no shipped file for ${assetId}`);
		const bytes = readFileSync(join(STATIC_DIR, asset.productionFile));
		facts.set(assetId, factsOf(assetId, asset.productionFile, bytes.byteLength, await reader.readBinary(new Uint8Array(bytes))));
	}
	return facts;
}

function modelPlacements(envelope: ProjectEnvelope) {
	return envelope.units.scene.data.entities.flatMap((entity) => (entity.kind === 'model' ? [entity] : []));
}

export type E3Result = {
	readonly workload: string;
	readonly contentDigest: string;
	readonly placements: number;
	readonly uniqueDefinitions: number;
	readonly uniqueTriples: number;
	readonly placementSubmissions: number;
	readonly submissionsPerUniqueTriple: number;
	readonly materialsCreated: number;
	readonly materialsPerPlacement: number;
	readonly models: readonly Omit<ModelFacts, 'textures'>[];
};

export function runE3(workload: string, contentDigest: string, envelope: ProjectEnvelope, models: ReadonlyMap<string, ModelFacts>): E3Result {
	const placements = modelPlacements(envelope);
	const definitions = [...new Set(placements.map((placement) => placement.assetId))];
	const uniqueTriples = definitions.reduce((sum, id) => sum + models.get(id)!.primitives, 0);
	const placementSubmissions = placements.reduce((sum, placement) => sum + models.get(placement.assetId)!.primitives, 0);
	const materialsCreated = placements.reduce((sum, placement) => sum + models.get(placement.assetId)!.materials, 0);
	return {
		workload,
		contentDigest,
		placements: placements.length,
		uniqueDefinitions: definitions.length,
		uniqueTriples,
		placementSubmissions,
		submissionsPerUniqueTriple: placementSubmissions / uniqueTriples,
		materialsCreated,
		materialsPerPlacement: materialsCreated / placements.length,
		models: definitions.sort().map((id) => {
			const { textures: _textures, ...rest } = models.get(id)!;
			return rest;
		})
	};
}

export type E4Stop = {
	readonly stopId: string;
	readonly nextStopId: string | null;
	readonly rooms: number;
	readonly uniqueTextures: number;
	readonly storedTextureBytes: number;
	readonly gpuRgba8MipBytes: number;
	readonly gpu1BppMipBytes: number;
	readonly gpuHalfBppMipBytes: number;
	readonly geometryBytes: number;
};

export type E4Result = {
	readonly workload: string;
	readonly contentDigest: string;
	readonly laptopARowMiB: 384;
	readonly stops: readonly E4Stop[];
	readonly maxGpuRgba8MipMiB: number;
	readonly medianGpuRgba8MipMiB: number;
	readonly limitations: readonly string[];
};

function insidePolygon(point: LayoutVec2, polygon: readonly LayoutVec2[]): boolean {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const [xi, zi] = polygon[i]!;
		const [xj, zj] = polygon[j]!;
		if (zi > point[1] !== zj > point[1] && point[0] < ((xj - xi) * (point[1] - zi)) / (zj - zi) + xi) inside = !inside;
	}
	return inside;
}

export function runE4(workload: string, contentDigest: string, envelope: ProjectEnvelope, models: ReadonlyMap<string, ModelFacts>): E4Result {
	const document = envelope.units.layout.data;
	const geometry = compileWallFirstLayoutGeometry(document).geometry;
	const polygons = new Map(geometry.rooms.map((room) => [room.roomId, room.floorPolygon as readonly LayoutVec2[]]));
	const placementsByRoom = new Map<string, string[]>();
	for (const placement of modelPlacements(envelope)) {
		const point: LayoutVec2 = [placement.position[0], placement.position[2]];
		for (const [roomId, polygon] of polygons) {
			if (!insidePolygon(point, polygon)) continue;
			placementsByRoom.set(roomId, [...(placementsByRoom.get(roomId) ?? []), placement.assetId]);
			break;
		}
	}
	const stopPoses = posesOf(envelope).filter((pose) => pose.kind === 'stop');
	const visibleByStop = stopPoses.map((pose) => visibleRoomsFrom(document, polygons, pose).visible);
	const stops = stopPoses.map((pose, index): E4Stop => {
		const rooms = new Set([...visibleByStop[index]!, ...(visibleByStop[index + 1] ?? [])]);
		const assetIds = new Set([...rooms].flatMap((roomId) => placementsByRoom.get(roomId) ?? []));
		const textures = [...assetIds].flatMap((id) => models.get(id)!.textures);
		const pixels = textures.reduce((sum, texture) => sum + texture.width * texture.height, 0);
		return {
			stopId: pose.id,
			nextStopId: stopPoses[index + 1]?.id ?? null,
			rooms: rooms.size,
			uniqueTextures: textures.length,
			storedTextureBytes: textures.reduce((sum, texture) => sum + texture.storedBytes, 0),
			gpuRgba8MipBytes: pixels * 4 * MIP_FACTOR,
			gpu1BppMipBytes: pixels * 1 * MIP_FACTOR,
			gpuHalfBppMipBytes: pixels * 0.5 * MIP_FACTOR,
			geometryBytes: [...assetIds].reduce((sum, id) => sum + models.get(id)!.geometryBytes, 0)
		};
	});
	const mib = stops.map((stop) => stop.gpuRgba8MipBytes / MIB).sort((a, b) => a - b);
	return {
		workload,
		contentDigest,
		laptopARowMiB: 384,
		stops,
		maxGpuRgba8MipMiB: mib[mib.length - 1] ?? Number.NaN,
		medianGpuRgba8MipMiB: mib[Math.floor((mib.length - 1) / 2)] ?? Number.NaN,
		limitations: [
			'model textures only, deduplicated per definition; Layout surface materials and the renderer’s own targets are reported by the smoke and bench render counters, not here',
			'geometry bytes are decoded attribute and index arrays per definition; per-placement clones share geometry only if the loader does, which the render counters measure',
			'visibility is E2’s conservative plan traversal (overcounts, never undercounts)'
		]
	};
}
