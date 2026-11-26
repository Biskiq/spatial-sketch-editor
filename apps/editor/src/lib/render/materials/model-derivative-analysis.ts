/**
 * Headless analysis of one approved model derivative.
 *
 * The bytes are the resource pin's immutable derivative, fetched through the
 * route's existing owner-only model content path. This module parses those
 * exact bytes with the same glTF loader and Meshopt decoder the renderer uses,
 * copies the UV/index facts the Finish qualification needs, and frees the
 * parsed template's buffers. It creates no Canvas, scene, material or renderer
 * object, so it runs with the Stage closed.
 *
 * The cache is keyed by the derivative digest, never by a Scene revision: a
 * changed approved derivative is a different identity and cannot reuse another
 * revision's analysis.
 */
import type { BufferGeometry, Mesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { DrawGeometry } from '@portfolio/project-model/materials';
import type { ModelDerivativeAnalysis, ModelDerivativeAnalysisProvider } from './target-analysis';

export type ModelAnalysisCache = {
	/** The provider the production Stage passes to the Finish planners. */
	readonly provider: ModelDerivativeAnalysisProvider;
	register(analysis: ModelDerivativeAnalysis): void;
	has(digest: string): boolean;
	/** Digests held now; observation only. */
	size(): number;
};

export function createModelAnalysisCache(): ModelAnalysisCache {
	const analyses = new Map<string, ModelDerivativeAnalysis>();
	return {
		provider: (digest) => analyses.get(digest) ?? null,
		register(analysis) {
			if (analysis.digest.length === 0 || analysis.draws.length === 0) return;
			analyses.set(analysis.digest, analysis);
		},
		has: (digest) => analyses.has(digest),
		size: () => analyses.size,
	};
}

function copyAttribute(geometry: BufferGeometry, name: string, width: number): Float32Array | null {
	const attribute = geometry.getAttribute(name);
	if (attribute === undefined || attribute.itemSize !== width) return null;
	return Float32Array.from(attribute.array as ArrayLike<number>);
}

function drawGeometryOf(geometry: BufferGeometry): DrawGeometry {
	const position = geometry.getAttribute('position');
	if (position === undefined) {
		return { positions: [], uvs: [null, null], indices: null };
	}
	const index = geometry.getIndex();
	const range = geometry.drawRange;
	return {
		positions: Float32Array.from(position.array as ArrayLike<number>),
		indices: index === null ? null : Uint32Array.from(index.array as ArrayLike<number>),
		// Three's unbounded default is Infinity; it is not a serializable range
		// and the summarizer's absent value already means "the whole buffer".
		drawRange: Number.isFinite(range.count) ? { start: range.start, count: range.count } : null,
		groups: geometry.groups.map((group) => ({ start: group.start, count: group.count })),
		uvs: [copyAttribute(geometry, 'uv', 2), copyAttribute(geometry, 'uv1', 2)],
	};
}

/**
 * Parse one derivative and summarize every drawn mesh.
 *
 * The source bytes are never retained: only the attribute arrays the analysis
 * needs survive, and the parsed template's geometries are disposed here.
 */
export async function analyzeModelDerivativeBytes(
	bytes: Uint8Array,
	digest: string,
): Promise<ModelDerivativeAnalysis> {
	const loader = new GLTFLoader();
	loader.setMeshoptDecoder(MeshoptDecoder);
	const buffer = bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength,
	) as ArrayBuffer;
	const gltf = await new Promise<Awaited<ReturnType<GLTFLoader['loadAsync']>>>(
		(resolve, reject) => {
			loader.parse(buffer, '', resolve, reject);
		},
	);
	const draws: { drawKey: string; geometry: DrawGeometry }[] = [];
	let meshIndex = 0;
	gltf.scene.traverse((node) => {
		const mesh = node as Mesh;
		if (mesh.isMesh !== true || mesh.geometry === undefined) return;
		const name = mesh.name.length === 0 ? 'mesh' : mesh.name;
		draws.push({ drawKey: `${name}#${meshIndex}`, geometry: drawGeometryOf(mesh.geometry) });
		meshIndex += 1;
		mesh.geometry.dispose();
	});
	return { digest, draws };
}
