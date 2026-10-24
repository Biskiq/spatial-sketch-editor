/**
 * T2.P02.S02 — `creator-import@1` contract fixtures.
 *
 * These prove the recipe, not a UI: the derivative keeps every source node and
 * empty, the pivot root is the only addition, the confirmed footprint/contact
 * agree with the bytes that were actually written, and every refusal installs
 * nothing. Texture reduction, Draco/KTX2 decoding and worker-message timing are
 * recorded as unrun in the slice acceptance where they need a browser.
 */
import { Document, WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';

import {
	ingestCreatorImport,
	derivativePathFor,
	sha256Hex
} from '$lib/authoring/adapters/scene/import/ingest';
import {
	CREATOR_IMPORT_SOURCE_MAX_BYTES,
	type CreatorImportFile,
	type CreatorImportPrepared
} from '$lib/authoring/adapters/scene/import/types';

const PARAMETERS: { metresPerSourceUnit: number; pivot: 'bottom-centre' | 'bounds-centre' } = {
	metresPerSourceUnit: 1,
	pivot: 'bottom-centre'
};

/** One triangle at 2 m on X and 1 m up, plus an empty node and a second mesh node. */
async function sourceGlb(): Promise<Uint8Array> {
	const document = new Document();
	const buffer = document.createBuffer();
	const positions = document
		.createAccessor('triangle')
		.setType('VEC3')
		.setArray(new Float32Array([0, 0, 0, 2, 0, 0, 0, 1, 0]))
		.setBuffer(buffer);
	const mesh = document
		.createMesh('mesh-a')
		.addPrimitive(document.createPrimitive().setAttribute('POSITION', positions));
	const second = document
		.createMesh('mesh-b')
		.addPrimitive(
			document
				.createPrimitive()
				.setAttribute(
					'POSITION',
					document
						.createAccessor('triangle-b')
						.setType('VEC3')
						.setArray(new Float32Array([0, 0, 0, 0, 0, 1, 0, 1, 1]))
						.setBuffer(buffer)
				)
		);
	const root = document.createNode('root-node').setMesh(mesh);
	const child = document.createNode('child-node').setMesh(second);
	const empty = document.createNode('empty-node');
	root.addChild(child);
	document.createScene('scene').addChild(root).addChild(empty);
	return new WebIO().writeBinary(document);
}

function file(path: string, bytes: Uint8Array): CreatorImportFile {
	return { path, bytes };
}

async function prepared(files: readonly CreatorImportFile[], parameters = PARAMETERS): Promise<CreatorImportPrepared> {
	const outcome = await ingestCreatorImport({ files, parameters });
	if (outcome.kind !== 'prepared') {
		throw new Error(`expected a prepared import, got ${outcome.code}: ${outcome.message}`);
	}
	return outcome;
}

describe('creator-import@1 — the retained report', () => {
	it('preserves every source node and empty, and appends exactly one pivot root', async () => {
		const bytes = await sourceGlb();
		const outcome = await prepared([file('chair.glb', bytes)]);

		expect(outcome.report.schema).toBe(1);
		expect(outcome.report.recipe).toEqual({ id: 'creator-import@1', version: 1 });
		// Nothing is pruned, deduplicated, joined or flattened: every source node is
		// recorded once, with the same mesh/empty answer, and no extra node beyond
		// the recorded source set appears.
		expect(
			[...outcome.report.nodeMap]
				.map((node) => [node.name, node.mesh, node.empty])
				.sort((left, right) => String(left[0]).localeCompare(String(right[0])))
		).toEqual([
			['child-node', true, false],
			['empty-node', false, true],
			['root-node', true, false]
		]);
		expect(outcome.report.nodeMap).toHaveLength(3);
		expect(outcome.report.observed).toMatchObject({
			nodes: 3,
			emptyNodes: 1,
			meshes: 2,
			triangles: 2
		});
		// Parts, clips and variants are observed, never admitted.
		expect(outcome.report.admitted).toEqual({
			kind: 'whole-object',
			parts: 'observed-not-admitted',
			animations: 'observed-not-admitted',
			variants: 'observed-not-admitted'
		});
	});

	it('writes the pivot root and makes the report agree with the derivative bytes', async () => {
		const bytes = await sourceGlb();
		const outcome = await prepared([file('chair.glb', bytes)]);

		expect(outcome.derivative.path).toBe('chair.derived.glb');
		await MeshoptDecoder.ready;
		const derivative = await new WebIO()
			.registerExtensions(ALL_EXTENSIONS)
			.registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
			.readBinary(outcome.derivative.bytes);
		const names = derivative.getRoot().listNodes().map((node) => node.getName());
		expect(names).toContain('creator-import-pivot');
		expect(names).toEqual(expect.arrayContaining(['root-node', 'child-node', 'empty-node']));

		// The confirmed footprint/contact are the derivative's own bounds: the same
		// numbers the renderer and the planner use. `getBounds` reads the encoded
		// accessor ranges, which survive meshopt quantization.
		const bounds = getBounds(derivative.getRoot().listScenes()[0]!);
		expect(outcome.report.placement.footprint.width).toBeCloseTo(bounds.max[0] - bounds.min[0], 3);
		expect(outcome.report.placement.footprint.depth).toBeCloseTo(bounds.max[2] - bounds.min[2], 3);
		expect(outcome.report.placement.contactMinY).toBeCloseTo(bounds.min[1], 3);
		expect(outcome.report.placement.pivot).toBe('bottom-centre');
	});

	it('declares meshopt as required so the GLB carries no fallback bytes', async () => {
		const bytes = await sourceGlb();
		const outcome = await prepared([file('chair.glb', bytes)]);

		// The writer keeps a fallback buffer in the JSON even when the extension is
		// required, and a GLB carries only one BIN chunk. Requiring the extension is
		// what makes the remaining declaration inert: every buffer past the first is
		// the marked fallback, whose bytes are layout, never payload. The API's
		// structure check admits exactly that shape and refuses an optional one.
		const container = outcome.derivative.bytes;
		const view = new DataView(container.buffer, container.byteOffset, container.byteLength);
		const jsonLength = view.getUint32(12, true);
		const json = JSON.parse(
			new TextDecoder().decode(container.subarray(20, 20 + jsonLength))
		) as {
			buffers: {
				byteLength: number;
				extensions?: { EXT_meshopt_compression?: { fallback?: boolean } };
			}[];
			extensionsRequired: string[];
		};
		expect(json.extensionsRequired).toContain('EXT_meshopt_compression');
		expect(json.buffers[0]!.extensions).toBeUndefined();
		for (const buffer of json.buffers.slice(1)) {
			expect(buffer.extensions?.EXT_meshopt_compression?.fallback).toBe(true);
		}
		let offset = 12;
		let bin: number | null = null;
		while (offset < container.byteLength) {
			const length = view.getUint32(offset, true);
			if (view.getUint32(offset + 4, true) === 0x004e4942) bin = length;
			offset += 8 + length;
		}
		expect(bin).toBe(json.buffers[0]!.byteLength);
	});

	it('applies the confirmed source-unit scale exactly once', async () => {
		const bytes = await sourceGlb();
		const metres = await prepared([file('chair.glb', bytes)]);
		const scaled = await prepared([file('chair.glb', bytes)], { metresPerSourceUnit: 0.01, pivot: 'bottom-centre' });

		expect(scaled.report.placement.metresPerSourceUnit).toBe(0.01);
		expect(scaled.report.placement.footprint.width).toBeCloseTo(metres.report.placement.footprint.width * 0.01, 6);
		expect(scaled.report.placement.contactMinY).toBeCloseTo(metres.report.placement.contactMinY * 0.01, 6);
		// Bounds quoted in the report stay in source units, before conversion.
		expect(scaled.report.observed.bounds).toEqual(metres.report.observed.bounds);
	});

	it('retains the original bytes and a deterministic report digest', async () => {
		const bytes = await sourceGlb();
		const first = await prepared([file('chair.glb', bytes)]);
		const second = await prepared([file('chair.glb', bytes)]);

		expect(first.report.source.files).toEqual([
			{ path: 'chair.glb', size: bytes.byteLength, hash: await sha256Hex(bytes) }
		]);
		expect(first.report.source.size).toBe(bytes.byteLength);
		expect(first.reportDigest).toBe(second.reportDigest);
		expect(first.reportDigest).toMatch(/^sha256-[0-9a-f]{64}$/);
		expect(first.report.geometry.encoded).toBe('meshopt');
		expect(first.report.textures.encoded).toBe('webp');
	});

	it('reports a glTF-with-local-buffer source and closes over its files', async () => {
		const document = new Document();
		const buffer = document.createBuffer();
		const mesh = document
			.createMesh('mesh')
			.addPrimitive(
				document
					.createPrimitive()
					.setAttribute(
						'POSITION',
						document
							.createAccessor()
							.setType('VEC3')
							.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
							.setBuffer(buffer)
					)
			);
		document.createScene('scene').addChild(document.createNode('node').setMesh(mesh));
		const json = new WebIO();
		const written = await json.writeJSON(document, { basename: 'model.gltf' });
		const outcome = await prepared([
			file('model.gltf', new TextEncoder().encode(JSON.stringify(written.json))),
			...Object.entries(written.resources).map(([path, bytes]) => file(path, bytes))
		]);
		expect(outcome.report.source.fileCount).toBe(2);
		expect(outcome.derivative.path).toBe('model.glb');
	});
});

describe('creator-import@1 — refusals install nothing', () => {
	it('refuses two root models, an unsupported format and a media type', async () => {
		const bytes = await sourceGlb();
		const twoRoots = await ingestCreatorImport({
			files: [file('a.glb', bytes), file('b.glb', bytes)],
			parameters: PARAMETERS
		});
		expect(twoRoots).toMatchObject({ kind: 'refused', code: 'wrong-file-count' });

		const fbx = await ingestCreatorImport({ files: [file('a.fbx', bytes)], parameters: PARAMETERS });
		expect(fbx).toMatchObject({ kind: 'refused', code: 'unsupported-format' });
		if (fbx.kind === 'refused') expect(fbx.message).toContain('glb');

		const png = await ingestCreatorImport({ files: [file('a.png', bytes)], parameters: PARAMETERS });
		expect(png).toMatchObject({ kind: 'refused', code: 'unsupported-media-type' });
	});

	it('refuses a missing local dependency and an external one in words', async () => {
		const json = {
			asset: { version: '2.0' },
			scenes: [{ nodes: [0] }],
			nodes: [{ mesh: 0 }],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
			accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
			bufferViews: [{ buffer: 0, byteLength: 36 }],
			buffers: [{ uri: 'missing.bin', byteLength: 36 }]
		};
		const missing = await ingestCreatorImport({
			files: [file('model.gltf', new TextEncoder().encode(JSON.stringify(json)))],
			parameters: PARAMETERS
		});
		expect(missing).toMatchObject({ kind: 'refused', code: 'missing-local-file' });
		if (missing.kind === 'refused') expect(missing.message).toContain('missing.bin');

		const external = await ingestCreatorImport({
			files: [
				file(
					'model.gltf',
					new TextEncoder().encode(
						JSON.stringify({ ...json, buffers: [{ uri: 'https://example.com/a.bin', byteLength: 36 }] })
					)
				)
			],
			parameters: PARAMETERS
		});
		expect(external).toMatchObject({ kind: 'refused', code: 'external-dependency' });
	});

	it('refuses an unsupported required extension instead of ignoring it', async () => {
		const document = new Document();
		const positions = document
			.createAccessor()
			.setType('VEC3')
			.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
			.setBuffer(document.createBuffer());
		document
			.createMesh('mesh')
			.addPrimitive(document.createPrimitive().setAttribute('POSITION', positions));
		const written = await new WebIO().writeJSON(document, { basename: 'model.gltf' });
		const json = {
			...written.json,
			extensionsRequired: ['EXT_mesh_gpu_instancing'],
			extensionsUsed: ['EXT_mesh_gpu_instancing']
		};
		const outcome = await ingestCreatorImport({
			files: [
				file('model.gltf', new TextEncoder().encode(JSON.stringify(json))),
				...Object.entries(written.resources).map(([path, bytes]) => file(path, bytes))
			],
			parameters: PARAMETERS
		});
		expect(outcome).toMatchObject({ kind: 'refused', code: 'unsupported-required-extension' });
	});

	it('refuses malformed bytes, an empty model and invalid parameters', async () => {
		const malformed = await ingestCreatorImport({
			files: [file('broken.glb', new Uint8Array([1, 2, 3, 4]))],
			parameters: PARAMETERS
		});
		expect(malformed).toMatchObject({ kind: 'refused', code: 'malformed-source' });

		const emptyDocument = new Document();
		emptyDocument.createScene('scene').addChild(emptyDocument.createNode('empty'));
		const empty = await new WebIO().writeBinary(emptyDocument);
		const emptyOutcome = await ingestCreatorImport({
			files: [file('empty.glb', empty)],
			parameters: PARAMETERS
		});
		expect(emptyOutcome).toMatchObject({ kind: 'refused', code: 'empty-model' });

		const bytes = await sourceGlb();
		for (const parameters of [
			{ metresPerSourceUnit: 0, pivot: 'bottom-centre' as const },
			{ metresPerSourceUnit: Number.NaN, pivot: 'bottom-centre' as const },
			{ metresPerSourceUnit: 1, pivot: 'centre-of-mass' as never }
		]) {
			const outcome = await ingestCreatorImport({ files: [file('chair.glb', bytes)], parameters });
			expect(outcome).toMatchObject({ kind: 'refused', code: 'invalid-parameters' });
		}
	});

	it('refuses a source set beyond the retained bound before reading it', async () => {
		const oversized: CreatorImportFile = {
			path: 'huge.glb',
			// The cap is checked on the declared size, so the bytes are never copied.
			bytes: { byteLength: CREATOR_IMPORT_SOURCE_MAX_BYTES + 1 } as unknown as Uint8Array
		};
		const outcome = await ingestCreatorImport({ files: [oversized], parameters: PARAMETERS });
		expect(outcome).toMatchObject({ kind: 'refused', code: 'source-too-large' });
	});

	it('reports cancellation before any derivative is written', async () => {
		const bytes = await sourceGlb();
		const controller = new AbortController();
		controller.abort();
		const outcome = await ingestCreatorImport(
			{ files: [file('chair.glb', bytes)], parameters: PARAMETERS },
			{ signal: controller.signal }
		);
		expect(outcome).toMatchObject({ kind: 'refused', code: 'cancelled' });
	});
});	describe('creator-import@1 — derivative naming', () => {
	it('keeps the source stem and writes one .glb container', () => {
		expect(derivativePathFor('models/Chair.gltf')).toBe('Chair.glb');
		expect(derivativePathFor('chair.glb')).toBe('chair.glb');
		expect(derivativePathFor('.glb')).toBe('model.glb');
	});

	it('never reuses a path the declared source set already claims', () => {
		expect(derivativePathFor('chair.glb', ['chair.glb'])).toBe('chair.derived.glb');
		expect(derivativePathFor('model.gltf', ['model.gltf', 'model.bin'])).toBe('model.glb');
		expect(derivativePathFor('chair.glb', ['chair.glb', 'chair.derived.glb'])).toBe('chair.derived-2.glb');
	});
});
