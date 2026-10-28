/**
 * T2.P02.S02 — the `creator-import@1` ingest recipe.
 *
 * One pipeline over captured bytes: validate the source set, read it with glTF
 * semantics, record what the source actually contains, append **one** pivot
 * root, encode geometry with meshopt and textures as WebP (capped at 2048 px),
 * then write the derivative. It never prunes, dedups, joins, flattens or welds
 * anything: the source node hierarchy is preserved node-for-node, and the only
 * structural addition is the pivot root.
 *
 * The recipe is deliberately synchronous with respect to its inputs — no clock,
 * no network, no catalogue — so the same file set and parameters produce the
 * same report and the same derivative. Decoders are loaded only when the source
 * declares the extension that needs them; the default path loads nothing.
 */
import {
	Document,
	WebIO,
	type Material,
	type Node,
	type Primitive,
	type Scene,
	type Texture
} from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';

import { sha256Hex } from './digest';

/** The identity helper is re-exported for existing ingest callers and tests. */
export { sha256Hex };
import { getBounds, meshopt, textureCompress } from '@gltf-transform/functions';
import { canonicalUnitJson } from '@portfolio/project-model/units';

import {
	CREATOR_IMPORT_DERIVATIVE_MAX_BYTES,
	CREATOR_IMPORT_RECIPE,
	CREATOR_IMPORT_SOURCE_MAX_BYTES,
	CREATOR_IMPORT_TEXTURE_MAX_PX,
	type CreatorImportFile,
	type CreatorImportNodeRecord,
	type CreatorImportObserved,
	type CreatorImportOutcome,
	type CreatorImportParameters,
	type CreatorImportPlacement,
	type CreatorImportProgress,
	type CreatorImportReport,
	type CreatorImportRequest,
	type CreatorImportTextureReduction
} from './types';

/** The two extensions whose decoders are loaded on demand, by declared name. */
const MESHOPT_EXTENSION = 'EXT_meshopt_compression';
const DRACO_EXTENSION = 'KHR_draco_mesh_compression';

/** Extensions that are parts of a source set, never a model by themselves. */
const MEDIA_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'bin']);

/** Required extensions the recipe can actually decode. */
const ADMITTED_REQUIRED_EXTENSIONS = new Set([DRACO_EXTENSION, MESHOPT_EXTENSION, 'KHR_materials_unlit']);

/** Deep extension dependencies the recipe decodes, keyed by declared extension. */
const DECODED_EXTENSIONS = new Set([DRACO_EXTENSION, MESHOPT_EXTENSION]);

export type CreatorImportEnvironment = {
	/** Aborts between stages; a cancel never half-writes a derivative. */
	readonly signal?: AbortSignal;
	readonly onProgress?: (progress: CreatorImportProgress) => void;
	/** Test seam: the platform texture encoder, when one is available. */
	readonly textureEncoder?: unknown;
	/** Test seam: an injected meshopt encoder. */
	readonly meshoptEncoder?: unknown;
	/** Test seam: an injected draco decoder module. */
	readonly dracoDecoder?: unknown;
};

function refuse(
	code: Extract<CreatorImportOutcome, { kind: 'refused' }>['code'],
	message: string,
	issues: readonly string[] = []
): CreatorImportOutcome {
	return { kind: 'refused', code, message, issues };
}

function extensionOf(path: string): string {
	const index = path.lastIndexOf('.');
	return index < 0 ? '' : path.slice(index + 1).toLowerCase();
}

function isExternalUri(uri: string): boolean {
	return /^[a-z][a-z0-9+.-]*:/i.test(uri) && !uri.startsWith('data:');
}

function checkCancelled(signal: AbortSignal | undefined): CreatorImportOutcome | null {
	return signal?.aborted === true
		? refuse('cancelled', 'The import was cancelled; nothing was prepared or installed.')
		: null;
}

type Validation = {
	readonly kind: 'ok';
	readonly gltf: CreatorImportFile | null;
	readonly glb: CreatorImportFile | null;
	readonly resources: ReadonlyMap<string, CreatorImportFile>;
	readonly sourceBytes: number;
};

/**
 * Read the declared file set and prove the local-file closure before any decode.
 *
 * The failure this catches is a source that only looks complete: a `.gltf` whose
 * buffer or image is fetched from an arbitrary URL, a referenced file the
 * creator did not choose, or a set whose total size is over the accepted bound.
 */
async function validateSourceSet(files: readonly CreatorImportFile[]): Promise<Validation | CreatorImportOutcome> {
	if (files.length === 0) {
		return refuse('wrong-file-count', 'Choose one GLB, or one glTF with its local buffers and maps.');
	}
	let sourceBytes = 0;
	const byPath = new Map<string, CreatorImportFile>();
	const issues: string[] = [];
	for (const file of files) {
		if (file.path.length === 0 || file.path.includes('..')) {
			issues.push(`Invalid file path: ${JSON.stringify(file.path)}`);
			continue;
		}
		if (byPath.has(file.path)) {
			issues.push(`The file set declares "${file.path}" twice.`);
			continue;
		}
		byPath.set(file.path, file);
		sourceBytes += file.bytes.byteLength;
	}
	if (issues.length > 0) return refuse('malformed-source', 'The chosen file set is not a valid source set.', issues);
	if (sourceBytes > CREATOR_IMPORT_SOURCE_MAX_BYTES) {
		return refuse(
			'source-too-large',
			`The source set is ${sourceBytes} bytes; a creator import is limited to ${CREATOR_IMPORT_SOURCE_MAX_BYTES} bytes.`
		);
	}
	const glbs = files.filter((file) => extensionOf(file.path) === 'glb');
	const gltfs = files.filter((file) => extensionOf(file.path) === 'gltf');
	if (glbs.length + gltfs.length === 0) {
		// No glTF container at all: name the reason rather than the count.
		const extensions = [...new Set(files.map((file) => extensionOf(file.path) || '(no extension)'))];
		return extensions.every((extension) => MEDIA_EXTENSIONS.has(extension))
			? refuse(
					'unsupported-media-type',
					`A map or buffer (${extensions.join(', ')}) is not a model on its own. Choose one GLB, or one glTF together with its local files.`,
					extensions
				)
			: refuse(
					'unsupported-format',
					`Only glTF 2.0 (.gltf with its local files) and binary glTF (.glb) are admitted; the chosen set has ${extensions.join(', ')}.`,
					extensions
				);
	}
	if (glbs.length + gltfs.length > 1) {
		return refuse(
			'wrong-file-count',
			`One import places one model; the chosen set carries ${glbs.length + gltfs.length} glTF files. Choose exactly one GLB or exactly one glTF plus its local files.`
		);
	}
	if (glbs.length === 1 && files.length > 1) {
		return refuse(
			'wrong-file-count',
			'A GLB is self-contained; choose it alone rather than mixing it with other files.'
		);
	}

	const gltf = gltfs[0] ?? null;
	const glb = glbs[0] ?? null;
	const resources = new Map<string, CreatorImportFile>(
		[...byPath].filter(([path]) => path !== gltf?.path && path !== glb?.path)
	);
	if (gltf === null) return { kind: 'ok', gltf, glb, resources, sourceBytes };

	let json: Record<string, unknown>;
	try {
		const parsed: unknown = JSON.parse(new TextDecoder().decode(gltf.bytes));
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			return refuse('malformed-source', 'The chosen .gltf is not a JSON document.');
		}
		json = parsed as Record<string, unknown>;
	} catch (error) {
		return refuse('malformed-source', `The chosen .gltf is not valid JSON: ${error instanceof Error ? error.message : 'parse failed'}`);
	}
	const asset = json.asset;
	const version = typeof asset === 'object' && asset !== null ? (asset as Record<string, unknown>).version : undefined;
	if (version !== '2.0') {
		return refuse('unsupported-format', `The glTF declares asset.version ${JSON.stringify(version)}; only 2.0 is admitted.`);
	}

	// Every relative URI must resolve to a chosen file; nothing is fetched.
	const declaredUris: string[] = [];
	for (const key of ['buffers', 'images']) {
		const list = json[key];
		if (!Array.isArray(list)) continue;
		for (const entry of list) {
			if (typeof entry !== 'object' || entry === null) continue;
			const uri = (entry as Record<string, unknown>).uri;
			if (typeof uri !== 'string') continue;
			if (uri.startsWith('data:')) continue;
			if (isExternalUri(uri)) {
				return refuse(
					'external-dependency',
					`The glTF references an external resource "${uri}". Only local buffers and maps chosen with the model are admitted.`
				);
			}
			declaredUris.push(uri);
		}
	}
	const missing = declaredUris.filter((uri) => !resources.has(uri));
	if (missing.length > 0) {
		return refuse(
			'missing-local-file',
			`The glTF needs ${missing.length} local file${missing.length === 1 ? '' : 's'} that the chosen set does not carry: ${missing.join(', ')}.`
		);
	}
	return { kind: 'ok', gltf, glb, resources, sourceBytes };
}

function triangleCount(primitive: Primitive): number {
	const indices = primitive.getIndices();
	if (indices !== null) return Math.floor(indices.getCount() / 3);
	const position = primitive.getAttribute('POSITION');
	return position === null ? 0 : Math.floor(position.getCount() / 3);
}

function countMeshes(document: Document): { meshes: number; primitives: number; triangles: number } {
	let meshes = 0;
	let primitives = 0;
	let triangles = 0;
	for (const node of document.getRoot().listNodes()) {
		const mesh = node.getMesh();
		if (mesh === null) continue;
		meshes += 1;
		for (const primitive of mesh.listPrimitives()) {
			primitives += 1;
			triangles += triangleCount(primitive);
		}
	}
	return { meshes, primitives, triangles };
}

function unionBounds(document: Document): CreatorImportObserved['bounds'] {
	const min: [number, number, number] = [Infinity, Infinity, Infinity];
	const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
	for (const scene of document.getRoot().listScenes()) {
		const bounds = getBounds(scene);
		for (let axis = 0; axis < 3; axis += 1) {
			min[axis] = Math.min(min[axis]!, bounds.min[axis]!);
			max[axis] = Math.max(max[axis]!, bounds.max[axis]!);
		}
	}
	return {
		min: min.every(Number.isFinite) ? min : [0, 0, 0],
		max: max.every(Number.isFinite) ? max : [0, 0, 0]
	};
}

function nodeMapOf(document: Document): readonly CreatorImportNodeRecord[] {
	return document
		.getRoot()
		.listNodes()
		.map((node: Node, index: number) => ({
			index,
			name: node.getName(),
			mesh: node.getMesh() !== null,
			// An empty is a transform-only node: no mesh and no camera. It exists only
			// to structure the hierarchy, and the recipe keeps it rather than pruning
			// it away.
			empty: node.getMesh() === null && node.getCamera() === null
		}));
}

function inspectDocument(document: Document): {
	observed: CreatorImportObserved;
	nodeMap: readonly CreatorImportNodeRecord[];
} {
	const root = document.getRoot();
	const counts = countMeshes(document);
	const nodes = root.listNodes();
	const nodeMap = nodeMapOf(document);
	const materials = root.listMaterials() as Material[];
	const textures = root.listTextures() as Texture[];
	const animationNames = root.listAnimations().map((animation) => animation.getName()).filter(Boolean);
	const variantNames = collectVariantNames(document);
	const extensionsUsed = root.listExtensionsUsed().map((extension) => extension.extensionName);
	const extensionsRequired = root
		.listExtensionsRequired()
		.map((extension) => extension.extensionName);
	return {
		observed: {
			nodes: nodes.length,
			emptyNodes: nodeMap.filter((record) => record.empty).length,
			meshes: counts.meshes,
			primitives: counts.primitives,
			triangles: counts.triangles,
			materials: materials.length,
			textures: textures.length,
			animationNames,
			variantNames,
			extensionsUsed,
			extensionsRequired,
			bounds: unionBounds(document)
		},
		nodeMap
	};
}

function collectVariantNames(document: Document): readonly string[] {
	const names = new Set<string>();
	for (const root of document.getRoot().listNodes()) {
		const variants = root.getExtension('KHR_materials_variants') as
			| { listVariants?: () => readonly { getName(): string }[] }
			| null;
		for (const variant of variants?.listVariants?.() ?? []) {
			if (variant.getName()) names.add(variant.getName());
		}
	}
	return [...names];
}

/** Reject a required extension the recipe cannot decode, naming it in words. */
function checkRequiredExtensions(document: Document): CreatorImportOutcome | null {
	const required = document
		.getRoot()
		.listExtensionsRequired()
		.map((extension) => extension.extensionName);
	const unsupported = required.filter((name) => !ADMITTED_REQUIRED_EXTENSIONS.has(name));
	if (unsupported.length > 0) {
		return refuse(
			'unsupported-required-extension',
			`The source requires ${unsupported.join(', ')}, which creator-import@1 does not decode. Export without that extension, or export a plain glTF.`,
			unsupported
		);
	}
	return null;
}

/** Read with only the decoders the source declares, so a plain GLB loads none. */
async function readDocument(validation: Validation, environment: CreatorImportEnvironment): Promise<Document | CreatorImportOutcome> {
	const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
	let declared: string[] = [];
	try {
		if (validation.glb !== null) {
			const jsonBytes = readGlbJsonChunk(validation.glb.bytes);
			declared = readDeclaredExtensions(jsonBytes);
			if (declared.some((name) => DECODED_EXTENSIONS.has(name))) {
				await registerDecoders(io, declared, environment);
			}
			return await io.readBinary(validation.glb.bytes);
		}
		const gltfFile = validation.gltf!;
		const json = JSON.parse(new TextDecoder().decode(gltfFile.bytes)) as {
			extensionsUsed?: unknown;
			extensionsRequired?: unknown;
		};
		declared = [
			...(Array.isArray(json.extensionsUsed) ? json.extensionsUsed.filter((value): value is string => typeof value === 'string') : []),
			...(Array.isArray(json.extensionsRequired) ? json.extensionsRequired.filter((value): value is string => typeof value === 'string') : [])
		];
		if (declared.some((name) => DECODED_EXTENSIONS.has(name))) {
			await registerDecoders(io, declared, environment);
		}
		const resources: Record<string, Uint8Array<ArrayBuffer>> = {};
		for (const [path, file] of validation.resources) {
			resources[path] = file.bytes as Uint8Array<ArrayBuffer>;
		}
		return await io.readJSON({ json: json as never, resources });
	} catch (error) {
		return refuse(
			'malformed-source',
			`The source could not be read: ${error instanceof Error ? error.message : 'unknown glTF error'}`
		);
	}
}

function readGlbJsonChunk(bytes: Uint8Array): { extensionsUsed?: unknown; extensionsRequired?: unknown } {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (bytes.byteLength < 20) return {};
	const jsonLength = view.getUint32(12, true);
	const start = 20;
	const end = Math.min(bytes.byteLength, start + jsonLength);
	try {
		return JSON.parse(new TextDecoder().decode(bytes.subarray(start, end))) as {
			extensionsUsed?: unknown;
			extensionsRequired?: unknown;
		};
	} catch {
		return {};
	}
}

function readDeclaredExtensions(json: { extensionsUsed?: unknown }): string[] {
	return Array.isArray(json.extensionsUsed)
		? json.extensionsUsed.filter((value): value is string => typeof value === 'string')
		: [];
}

async function registerDecoders(
	io: WebIO,
	declared: readonly string[],
	environment: CreatorImportEnvironment
): Promise<void> {		if (declared.includes(MESHOPT_EXTENSION)) {
		const encoder = environment.meshoptEncoder as { ready?: Promise<void> } | undefined;
		if (encoder !== undefined && encoder !== null) {
			await encoder.ready;
			io.registerDependencies({ 'meshopt.decoder': encoder });
		} else {
			const module = (await import('meshoptimizer')) as unknown as {
				MeshoptDecoder: { ready?: Promise<void> } & Record<string, unknown>;
			};
			await module.MeshoptDecoder.ready;
			io.registerDependencies({ 'meshopt.decoder': module.MeshoptDecoder });
		}
	}
	if (declared.includes(DRACO_EXTENSION)) {
		const decoder =
			environment.dracoDecoder ??
			(await (async () => {
				const module = (await import('draco3d')) as unknown as {
					createDecoderModule: (options?: unknown) => Promise<unknown>;
				};
				return module.createDecoderModule();
			})());
		io.registerDependencies({ 'draco3d.decoder': decoder });
	}
}

function applyPivot(
	document: Document,
	parameters: CreatorImportParameters,
	observedBounds: CreatorImportObserved['bounds']
): { placement: CreatorImportPlacement; translated: boolean } {
	const scale = parameters.metresPerSourceUnit;
	const centre: readonly [number, number, number] = [
		(observedBounds.min[0] + observedBounds.max[0]) / 2,
		parameters.pivot === 'bottom-centre' ? observedBounds.min[1] : (observedBounds.min[1] + observedBounds.max[1]) / 2,
		(observedBounds.min[2] + observedBounds.max[2]) / 2
	];
	const pivotRoot = document.createNode('creator-import-pivot');
	pivotRoot.setScale([scale, scale, scale]);
	pivotRoot.setTranslation([-centre[0] * scale, -centre[1] * scale, -centre[2] * scale]);
	for (const scene of document.getRoot().listScenes() as Scene[]) {
		const roots = scene.listChildren();
		for (const child of roots) {
			scene.removeChild(child);
			pivotRoot.addChild(child);
		}
		scene.addChild(pivotRoot);
	}
	const min: [number, number, number] = [
		(observedBounds.min[0] - centre[0]) * scale,
		(observedBounds.min[1] - centre[1]) * scale,
		(observedBounds.min[2] - centre[2]) * scale
	];
	const max: [number, number, number] = [
		(observedBounds.max[0] - centre[0]) * scale,
		(observedBounds.max[1] - centre[1]) * scale,
		(observedBounds.max[2] - centre[2]) * scale
	];
	return {
		translated: true,
		placement: {
			metresPerSourceUnit: scale,
			pivot: parameters.pivot,
			pivotLocal: [0, 0, 0],
			footprint: {
				width: Math.max(max[0] - min[0], 1e-6),
				depth: Math.max(max[2] - min[2], 1e-6)
			},
			contactMinY: min[1],
			height: Math.max(max[1] - min[1], 1e-6)
		}
	};
}

async function encodeTextures(
	document: Document,
	environment: CreatorImportEnvironment
): Promise<{ reductions: CreatorImportTextureReduction[]; warnings: string[] }> {
	const textures = document.getRoot().listTextures() as Texture[];
	const warnings: string[] = [];
	if (textures.length === 0) return { reductions: [], warnings };
	const before = new Map<Texture, readonly [number, number]>();
	for (const texture of textures) {
		const size = texture.getSize();
		if (size === null) continue;
		before.set(texture, [size[0], size[1]]);
		if (texture.getMimeType() === 'image/ktx2') {
			throw new Error('KHR_texture_basisu textures are not admitted by creator-import@1');
		}
	}
	const options: Parameters<typeof textureCompress>[0] = {
		targetFormat: 'webp',
		resize: [CREATOR_IMPORT_TEXTURE_MAX_PX, CREATOR_IMPORT_TEXTURE_MAX_PX],
		...(environment.textureEncoder === undefined ? {} : { encoder: environment.textureEncoder })
	};
	await document.transform(textureCompress(options));
	const reductions: CreatorImportTextureReduction[] = [];
	for (const texture of textures) {
		const from = before.get(texture);
		const size = texture.getSize();
		if (from === undefined || size === null) continue;
		if (from[0] !== size[0] || from[1] !== size[1]) {
			reductions.push({ name: texture.getName() || texture.getURI() || 'texture', from, to: [size[0], size[1]] });
		}
		if (texture.getMimeType() !== 'image/webp') {
			warnings.push(`Texture "${texture.getName() || texture.getURI()}" could not be encoded as WebP.`);
		}
	}
	return { reductions, warnings };
}

async function writeDerivative(document: Document, meshoptEncoder: unknown): Promise<Uint8Array> {
	// The writer needs the same dependency the transform used: an extension
	// registered without its encoder fails at write time, not at encode time.
	const io = new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
		'meshopt.encoder': meshoptEncoder
	});
	// A GLB carries exactly one buffer: the BIN chunk. An optional
	// EXT_meshopt_compression makes the writer emit its fallback as a second,
	// URI-less buffer with no bytes in the container, which is not a readable
	// GLB — the API's structure check refuses it as soon as the fallback is
	// larger than the BIN chunk. Requiring the extension (the recipe always
	// encodes with it) drops the fallback and keeps the derivative self-contained.
	document.createExtension(EXTMeshoptCompression).setRequired(true);
	return io.writeBinary(document);
}

/** Canonical report body; the digest is over exactly these bytes. */
export function canonicalReportJson(report: CreatorImportReport): string {
	return canonicalUnitJson(report as unknown);
}

/**
 * Produce one derivative and its report from one captured source set.
 *
 * Every refusal is returned, never thrown: the caller shows a reason and
 * installs nothing. A cancelled run returns `cancelled` before the derivative is
 * written, so there is no half-built file to upload.
 */
export async function ingestCreatorImport(
	request: CreatorImportRequest,
	environment: CreatorImportEnvironment = {}
): Promise<CreatorImportOutcome> {
	const progress = environment.onProgress ?? (() => {});
	const cancelled = checkCancelled(environment.signal);
	if (cancelled !== null) return cancelled;
	progress({ stage: 'validating', detail: 'Checking the chosen files and their local closure.' });
	const validation = await validateSourceSet(request.files);
	if (!('kind' in validation) || validation.kind !== 'ok') return validation as CreatorImportOutcome;
	if (!Number.isFinite(request.parameters.metresPerSourceUnit) || request.parameters.metresPerSourceUnit <= 0) {
		return refuse('invalid-parameters', 'The metric scale must be a finite number greater than zero.');
	}
	if (request.parameters.pivot !== 'bottom-centre' && request.parameters.pivot !== 'bounds-centre') {
		return refuse('invalid-parameters', 'Choose the bottom-centre or bounds-centre pivot.');
	}

	progress({ stage: 'reading', detail: 'Reading the glTF hierarchy.' });
	const read = await readDocument(validation, environment);
	if (!(read instanceof Document)) return read;
	const unsupported = checkRequiredExtensions(read);
	if (unsupported !== null) return unsupported;

	const inspected = inspectDocument(read);
	if (inspected.observed.meshes === 0) {
		return refuse('empty-model', 'The source contains no mesh, so there is nothing to render or place.');
	}
	const bounds = inspected.observed.bounds;
	if (bounds.min.some((value) => !Number.isFinite(value)) || bounds.max.some((value) => !Number.isFinite(value))) {
		return refuse('malformed-source', 'The source geometry has no finite bounds.');
	}

	progress({ stage: 'geometry', detail: 'Applying the confirmed pivot and encoding geometry with meshopt.' });
	const { placement } = applyPivot(read, request.parameters, bounds);
	const meshoptEncoder = await resolveMeshoptEncoder(environment);
	await read.transform(meshopt({ encoder: meshoptEncoder, level: 'medium' }));

	let encodedTextures: Awaited<ReturnType<typeof encodeTextures>>;
	try {
		progress({ stage: 'textures', detail: 'Encoding textures as WebP and capping them at 2048 px.' });
		encodedTextures = await encodeTextures(read, environment);
	} catch (error) {
		if (error instanceof Error && error.message.includes('KHR_texture_basisu')) {
			return refuse('unsupported-required-extension', error.message, ['KHR_texture_basisu']);
		}
		return refuse('encode-failed', `Texture encoding failed: ${error instanceof Error ? error.message : 'unknown error'}`);
	}

	const cancelledBeforeWrite = checkCancelled(environment.signal);
	if (cancelledBeforeWrite !== null) return cancelledBeforeWrite;

	progress({ stage: 'writing', detail: 'Writing the derivative.' });
	let derivativeBytes: Uint8Array;
	try {
		derivativeBytes = await writeDerivative(read, meshoptEncoder);
	} catch (error) {
		return refuse('encode-failed', `The derivative could not be written: ${error instanceof Error ? error.message : 'unknown error'}`);
	}
	if (derivativeBytes.byteLength > CREATOR_IMPORT_DERIVATIVE_MAX_BYTES) {
		return refuse(
			'derivative-too-large',
			`The encoded derivative is ${derivativeBytes.byteLength} bytes; a creator import is limited to ${CREATOR_IMPORT_DERIVATIVE_MAX_BYTES} bytes.`
		);
	}

	const source = await Promise.all(
		request.files.map(async (file) => ({
			path: file.path,
			size: file.bytes.byteLength,
			hash: await sha256Hex(file.bytes)
		}))
	);
	const derivativePath = derivativePathFor(
		validation.glb?.path ?? validation.gltf?.path ?? 'model.glb',
		request.files.map((file) => file.path)
	);
	const report: CreatorImportReport = {
		schema: 1,
		recipe: { id: CREATOR_IMPORT_RECIPE.id, version: CREATOR_IMPORT_RECIPE.version },
		source: {
			files: source,
			size: source.reduce((total, file) => total + file.size, 0),
			fileCount: source.length
		},
		observed: inspected.observed,
		nodeMap: inspected.nodeMap,
		admitted: {
			kind: 'whole-object',
			parts: 'observed-not-admitted',
			animations: 'observed-not-admitted',
			variants: 'observed-not-admitted'
		},
		textures: {
			encoded: 'webp',
			capPx: CREATOR_IMPORT_TEXTURE_MAX_PX,
			reductions: encodedTextures.reductions
		},
		geometry: {
			encoded: 'meshopt',
			triangles: inspected.observed.triangles
		},
		placement,
		derivative: { size: derivativeBytes.byteLength },
		warnings: encodedTextures.warnings
	};
	const reportDigest = await sha256Hex(new TextEncoder().encode(canonicalReportJson(report)));
	return {
		kind: 'prepared',
		report,
		reportDigest,
		derivative: { path: derivativePath, bytes: derivativeBytes },
		source
	};
}

async function resolveMeshoptEncoder(environment: CreatorImportEnvironment): Promise<unknown> {
	if (environment.meshoptEncoder !== undefined) {
		await (environment.meshoptEncoder as { ready?: Promise<void> }).ready;
		return environment.meshoptEncoder;
	}
	const module = (await import('meshoptimizer')) as unknown as {
		MeshoptEncoder: { ready?: Promise<void> };
	};
	await module.MeshoptEncoder.ready;
	return module.MeshoptEncoder;
}

/**
 * The derivative keeps the source's name with a `.glb` container.
 *
 * Staging declares the source set and the derivative together and refuses a
 * repeated path, so a GLB source (whose `.glb` name the derivative would reuse)
 * must yield a distinct name. A glTF source keeps `model.glb`, because no source
 * file claims it.
 */
export function derivativePathFor(sourcePath: string, taken: readonly string[] = []): string {
	const base = sourcePath.split('/').pop() ?? 'model.glb';
	const stem = base.replace(/\.[^.]+$/, '');
	const name = stem.length === 0 ? 'model' : stem;
	const preferred = `${name}.glb`;
	if (!taken.includes(preferred)) return preferred;
	const suffixed = `${name}.derived.glb`;
	if (!taken.includes(suffixed)) return suffixed;
	for (let index = 2; ; index += 1) {
		const candidate = `${name}.derived-${index}.glb`;
		if (!taken.includes(candidate)) return candidate;
	}
}
