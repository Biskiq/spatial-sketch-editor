/**
 * P22.1 — store-free cold release preparation.
 *
 * Takes a saved document plus caller-supplied verified P20 bytes and returns a
 * detached scene, compiled geometry, rooms, graph and a read-only
 * release-scoped texture scope. Imports canonical packages directly; never
 * touches session stores, history, selection, gizmos, or mutable globals.
 *
 * Validation policy (exhaustive reference set):
 * - every scene texture URI is either a same-release P20 entry present in the
 *   manifest or an allowlisted shipped-static URI;
 * - `/local/`, package rewrite paths, `blob:`/`data:`, external URLs, unknown
 *   static paths and missing P20 refs are rejected, never pruned;
 * - every model asset and material ID resolves through the checked-in
 *   compatibility registry, so a later catalogue change cannot break an
 *   existing release;
 * - catalogue-implied texture dependencies (fallback/base materials) are
 *   included in the reference set.
 */
import {
	hasBlockingLayoutIssues,
	type CompiledLayoutGeometry,
	type LayoutRoomRegistry,
	type NavigationGraph,
	type RuntimeScene
} from '@portfolio/project-model';
import { prepareUnitRuntime } from '@portfolio/project-model/units';
import {
	getShippedMaterialById,
	getShippedModelByAssetId,
	isAllowedShippedTextureUri,
	isKnownShippedAssetId,
	isKnownShippedMaterialId,
	isShippedFallback
} from './shipped-static-registry';
import { createReleaseTextureScope, type ReleaseBytesEntry, type ReleaseTextureScope } from './visitor-texture-scope';

export type ColdReleaseManifest = {
	releaseId: string;
	bytesByUri: ReadonlyMap<string, ReleaseBytesEntry>;
};

export type ColdReleaseBundle = {
	releaseId: string;
	projectId: string;
	projectName: string;
	scene: RuntimeScene;
	geometry: CompiledLayoutGeometry;
	rooms: LayoutRoomRegistry;
	graph: NavigationGraph;
	textureScope: ReleaseTextureScope;
	dispose: () => void;
};

export type ColdReleaseIssue = { path: string; message: string };

const PROJECT_ASSET_PATTERN = /^\/project-assets\/[A-Za-z0-9_-]+$/;
const PACKAGE_REWRITE_PATTERN = /^\/textures\/package-[0-9a-f]{12}\/[^?#]+$/;
const LOCAL_BINARY_PATTERN = /^\/local\/[0-9a-f]{12}\/[^?#]+$/;

function isProjectAssetUri(uri: string): boolean {
	return PROJECT_ASSET_PATTERN.test(uri);
}

function isSessionLocalUri(uri: string): boolean {
	return PACKAGE_REWRITE_PATTERN.test(uri) || LOCAL_BINARY_PATTERN.test(uri);
}

/**
 * Root-relative, query-free, traversal-free texture URI check. Exported for
 * parity testing against the canonical `isSafeTextureUri` — the duplication
 * is deliberate (this module must not import app facades), and the parity
 * test fails on drift.
 */
export function isRootRelativeSafe(uri: string): boolean {
	if (!uri.startsWith('/') || uri.startsWith('//')) return false;
	if (uri.includes('\\') || uri.includes('?') || uri.includes('#')) return false;
	let decoded = uri;
	for (let depth = 0; depth < 8; depth += 1) {
		let next: string;
		try {
			next = decodeURIComponent(decoded);
		} catch {
			return false;
		}
		if (next === decoded) break;
		decoded = next;
		if (depth === 7) return false;
	}
	if (!decoded.startsWith('/') || decoded.startsWith('//')) return false;
	if (/[\u0000-\u001f\u007f]/.test(decoded)) return false;
	return decoded.split('/').every((segment) => segment !== '.' && segment !== '..');
}

const COLD_SCENE_OPTIONS = {
	isKnownAssetId: (assetId: string) => isKnownShippedAssetId(assetId),
	isKnownMaterialId: (materialId: string) => isKnownShippedMaterialId(materialId),
	isSceneObjectFallback: (value: unknown) => isShippedFallback(value),
	isSafeTextureUri: (uri: string) => isRootRelativeSafe(uri)
};

/**
 * Build the exhaustive delivery reference set and return blocking issues.
 * Pure; no IO, no store reads beyond the supplied manifest map.
 */
export function validateColdReleaseReferences(input: {
	scene: { textures: Array<{ id: string; name: string; uri: string }>; materials: Array<{ id: string; baseMaterialId?: string; baseTextureId?: string }>; entities: Array<{ kind: string; assetId?: string; materialInstanceId?: string | null; materialId?: string }> };
	manifest: ColdReleaseManifest;
}): ColdReleaseIssue[] {
	const issues: ColdReleaseIssue[] = [];
	const textureById = new Map(input.scene.textures.map((texture) => [texture.id, texture]));

	for (const [index, texture] of input.scene.textures.entries()) {
		const path = `$.scene.textures[${index}]`;
		const uri = texture.uri;
		if (isProjectAssetUri(uri)) {
			const entry = input.manifest.bytesByUri.get(uri);
			if (!entry || entry.bytes.byteLength === 0) {
				issues.push({ path, message: `P20 texture "${texture.name}" is missing release bytes` });
			}
			continue;
		}
		if (isSessionLocalUri(uri) || uri.startsWith('/local/')) {
			issues.push({ path, message: `Session-local texture "${texture.name}" cannot ship in a release` });
			continue;
		}
		if (isAllowedShippedTextureUri(uri)) continue;
		if (!isRootRelativeSafe(uri) || uri.startsWith('blob:') || uri.startsWith('data:')) {
			issues.push({ path, message: `Texture "${texture.name}" uses an unsupported source` });
			continue;
		}
		issues.push({ path, message: `Texture "${texture.name}" is not a release P20 asset or allowlisted shipped resource` });
	}

	for (const [index, material] of input.scene.materials.entries()) {
		const path = `$.scene.materials[${index}]`;
		if (material.baseMaterialId !== undefined && getShippedMaterialById(material.baseMaterialId) === undefined) {
			issues.push({ path, message: `Unknown base material "${material.baseMaterialId}"` });
		}
		if (material.baseTextureId !== undefined && !textureById.has(material.baseTextureId)) {
			issues.push({ path, message: `Unknown base texture "${material.baseTextureId}"` });
		}
	}

	const materialById = new Map(input.scene.materials.map((material) => [material.id, material]));
	for (const [index, entity] of input.scene.entities.entries()) {
		// Publication admits no native form yet: T4 owns any admission, so a form
		// must be a blocking issue rather than something a release ships by omission.
		if (entity.kind === 'form') {
			issues.push({
				path: `$.scene.entities[${index}]`,
				message: 'Native forms are not admitted for publication'
			});
			continue;
		}
		if (entity.kind !== 'model' && entity.kind !== 'primitive') continue;
		const path = `$.scene.entities[${index}]`;
		if (entity.kind === 'model' && entity.assetId !== undefined && getShippedModelByAssetId(entity.assetId) === undefined) {
			issues.push({ path, message: `Unknown model asset "${entity.assetId}"` });
		}
		const instanceId = entity.materialInstanceId ?? null;
		const fallbackId = entity.kind === 'primitive' ? entity.materialId : undefined;
		const materialIds = new Set<string>();
		if (instanceId) {
			const instance = materialById.get(instanceId);
			if (!instance) {
				issues.push({ path, message: `Unknown material instance "${instanceId}"` });
			} else if (instance.baseMaterialId) {
				materialIds.add(instance.baseMaterialId);
			}
		}
		if (fallbackId) materialIds.add(fallbackId);
		if (entity.kind === 'model' && materialIds.size === 0) materialIds.add('paper-aged');
		for (const materialId of materialIds) {
			const shipped = getShippedMaterialById(materialId);
			if (!shipped) {
				issues.push({ path, message: `Unknown catalogue material "${materialId}"` });
				continue;
			}
			for (const textureUri of shipped.textureUris) {
				if (!isAllowedShippedTextureUri(textureUri)) {
					issues.push({ path, message: `Catalogue material "${materialId}" needs retained bytes for ${textureUri}` });
				}
			}
		}
	}

	return issues;
}

/**
 * Compose a detached, validated cold bundle. Throws on invalid input without
 * leaking object URLs. Call `dispose()` on unmount/failure to revoke release
 * URLs. Aborts early when `signal` is already aborted.
 */
export function composeColdReleaseBundle(input: {
	/** The released F.2 envelope; the only source format a release may carry. */
	document: unknown;
	manifest: ColdReleaseManifest;
	signal?: AbortSignal;
}): ColdReleaseBundle {
	const { document, manifest, signal } = input;
	if (signal?.aborted) throw new Error('Release preparation was cancelled');
	if (!manifest.releaseId.trim()) throw new Error('Release requires a releaseId');

	const prepared = prepareUnitRuntime(document, COLD_SCENE_OPTIONS as never);
	if (prepared.kind === 'rejected') {
		throw new Error(prepared.issues[0]?.message ?? 'Project validation failed');
	}
	if (signal?.aborted) throw new Error('Release preparation was cancelled');

	// Executable closure blocks release exactly as it blocks F4 acceptance and
	// Save; the editor may still show the source read-only for repair.
	const closure = prepared.closure[0];
	if (closure !== undefined) {
		throw new Error(`Project cannot execute: ${closure.message}`);
	}
	if (signal?.aborted) throw new Error('Release preparation was cancelled');

	if (hasBlockingLayoutIssues(prepared.issues)) {
		throw new Error(prepared.issues[0]?.message ?? 'Layout geometry is invalid');
	}
	if (signal?.aborted) throw new Error('Release preparation was cancelled');

	const name = prepared.envelope.name.trim();
	if (!name) throw new Error('Project name cannot be empty');
	if (!prepared.envelope.id) throw new Error('Project is not ready for release');

	const projectId = prepared.envelope.id;
	const rooms = prepared.rooms;
	const runtimeScene = prepared.runtimeScene;
	// The navigation graph is the Camera unit's own connectivity, prepared by the
	// one unit runtime; the released Scene no longer carries a navigation graph.
	const graph = prepared.graph;

	const referenceIssues = validateColdReleaseReferences(
		{
			scene: {
				textures: runtimeScene.textures,
				materials: runtimeScene.materials as ColdReleaseBundle['scene']['materials'],
				entities: runtimeScene.entities as Array<{ kind: string; assetId?: string; materialInstanceId?: string | null; materialId?: string }>
			},
			manifest
		}
	);
	if (referenceIssues.length > 0) {
		throw new Error(referenceIssues[0]!.message);
	}
	if (signal?.aborted) throw new Error('Release preparation was cancelled');

	const textureScope = createReleaseTextureScope({
		releaseId: manifest.releaseId,
		bytesByUri: manifest.bytesByUri
	});

	let disposed = false;
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		textureScope.dispose();
	};

	return {
		releaseId: manifest.releaseId,
		projectId,
		projectName: name,
		scene: runtimeScene,
		geometry: prepared.geometry,
		rooms,
		graph,
		textureScope,
		dispose
	};
}
