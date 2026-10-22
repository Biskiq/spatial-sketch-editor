/**
 * Server-side structure checks for a creator model import.
 *
 * The derivative is produced in the creator's browser worker; the server never
 * produces or transforms model bytes. What it can and must do before approving
 * anything is prove that the *declared* bytes are structurally a glTF asset: the
 * GLB container's magic, version, chunk boundaries and declared length, the JSON
 * document's own parse and version, every referenced file's presence, and the
 * buffer/view bounds that say the payload is internally consistent.
 *
 * Pure functions over bytes: no database, object store or filesystem access.
 */

export type ModelStructureIssue = {
	readonly path: string;
	readonly code: string;
	readonly message: string;
};

/** One declared file of the import, with the bytes the staging upload produced. */
export type ModelSourceFile = {
	readonly path: string;
	readonly bytes: Buffer;
};

const GLB_MAGIC = 0x46546c67; // 'glTF' little-endian
const GLB_VERSION = 2;
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'
const GLTF_VERSION = '2.0';

type GltfDocument = Record<string, unknown>;

class StructureRefusal extends Error {
	readonly issue: ModelStructureIssue;
	constructor(issue: ModelStructureIssue) {
		super(issue.message);
		this.name = 'StructureRefusal';
		this.issue = issue;
	}
}

function fail(path: string, code: string, message: string): never {
	throw new StructureRefusal({ path, code, message });
}

/** A JSON object, or a refusal attributed to the document path. */
function readDocument(bytes: Buffer, path: string): GltfDocument {
	let parsed: unknown;
	try {
		parsed = JSON.parse(bytes.toString('utf8')) as unknown;
	} catch {
		fail(path, 'invalid-json', `${path} is not valid JSON`);
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		fail(path, 'invalid-document', `${path} must be a JSON object`);
	}
	const document = parsed as GltfDocument;
	const asset = document.asset;
	if (typeof asset !== 'object' || asset === null || Array.isArray(asset)) {
		fail(`${path}.asset`, 'missing-asset', `${path} carries no glTF asset record`);
	}
	const version = (asset as Record<string, unknown>).version;
	if (version !== GLTF_VERSION) {
		fail(`${path}.asset.version`, 'unsupported-gltf-version', `${path} declares glTF version ${JSON.stringify(version)}; only ${GLTF_VERSION} is admitted`);
	}
	return document;
}

type GlbContainer = {
	readonly json: GltfDocument;
	/** Bytes in the BIN chunk, or `null` when the container has none. */
	readonly binLength: number | null;
};

/** Strict GLB container read: magic, version, declared length, JSON/BIN chunks. */
function readGlb(bytes: Buffer, path: string): GlbContainer {
	if (bytes.length < 20) fail(path, 'truncated-glb', `${path} is shorter than a GLB header and JSON chunk`);
	if (bytes.readUInt32LE(0) !== GLB_MAGIC) fail(path, 'invalid-glb-magic', `${path} is not a GLB container`);
	if (bytes.readUInt32LE(4) !== GLB_VERSION) fail(path, 'unsupported-glb-version', `${path} declares GLB version ${bytes.readUInt32LE(4)}; only ${GLB_VERSION} is admitted`);
	const declaredLength = bytes.readUInt32LE(8);
	if (declaredLength !== bytes.length) {
		fail(path, 'invalid-glb-length', `${path} declares ${declaredLength} bytes and carries ${bytes.length}`);
	}
	let offset = 12;
	let json: GltfDocument | null = null;
	let binLength: number | null = null;
	let index = 0;
	while (offset < bytes.length) {
		if (offset + 8 > bytes.length) fail(path, 'truncated-glb-chunk', `${path} ends inside a chunk header`);
		const chunkLength = bytes.readUInt32LE(offset);
		const chunkType = bytes.readUInt32LE(offset + 4);
		const start = offset + 8;
		const end = start + chunkLength;
		if (end > bytes.length) {
			fail(path, 'invalid-glb-chunk-bounds', `${path} chunk ${index} declares ${chunkLength} bytes past the container end`);
		}
		if (index === 0 && chunkType !== CHUNK_JSON) {
			fail(path, 'missing-glb-json-chunk', `${path} must begin with a JSON chunk`);
		}
		if (chunkType === CHUNK_JSON) {
			if (json !== null) fail(path, 'duplicate-glb-json-chunk', `${path} carries more than one JSON chunk`);
			json = readDocument(bytes.subarray(start, end), `${path}#json`);
		} else if (chunkType === CHUNK_BIN) {
			if (binLength !== null) fail(path, 'duplicate-glb-bin-chunk', `${path} carries more than one BIN chunk`);
			binLength = chunkLength;
		}
		// Chunks are 4-byte aligned; a non-padded length is a structural defect.
		if (chunkLength % 4 !== 0) {
			fail(path, 'invalid-glb-chunk-align', `${path} chunk ${index} length ${chunkLength} is not 4-byte aligned`);
		}
		offset = end;
		index += 1;
	}
	if (json === null) fail(path, 'missing-glb-json-chunk', `${path} carries no JSON chunk`);
	return { json: json as GltfDocument, binLength };
}

/** Resolve one relative URI to a declared file path, never to the filesystem. */
function resolveRelativeUri(baseDirectory: string, uri: string, path: string): string {
	let decoded: string;
	try {
		decoded = decodeURIComponent(uri);
	} catch {
		fail(path, 'invalid-uri', `${path} carries an undecodable URI ${JSON.stringify(uri)}`);
	}
	if (decoded.startsWith('/') || decoded.startsWith('\\') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(decoded)) {
		fail(path, 'external-uri', `${path} references ${JSON.stringify(uri)}, which is not a relative project file`);
	}
	const segments = [...(baseDirectory === '' ? [] : baseDirectory.split('/')), ...decoded.split('/')];
	const resolved: string[] = [];
	for (const segment of segments) {
		if (segment === '' || segment === '.') continue;
		if (segment === '..') fail(path, 'path-traversal', `${path} references ${JSON.stringify(uri)}, which escapes the import`);
		resolved.push(segment);
	}
	return resolved.join('/');
}

function directoryOf(path: string): string {
	const at = path.lastIndexOf('/');
	return at === -1 ? '' : path.slice(0, at);
}

function isDataUri(uri: string): boolean {
	return uri.startsWith('data:');
}

function base64Bytes(uri: string): number {
	const comma = uri.indexOf(',');
	return comma === -1 ? 0 : Math.floor(((uri.length - comma - 1) * 3) / 4);
}

function readRecordList(value: unknown, path: string): GltfDocument[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) fail(path, 'invalid-document', `${path} must be an array`);
	return value.map((entry, index) => {
		if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
			fail(`${path}[${index}]`, 'invalid-document', `${path}[${index}] must be an object`);
		}
		return entry as GltfDocument;
	});
}

function readByteLength(record: GltfDocument, path: string): number {
	const value = record.byteLength;
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
		fail(`${path}.byteLength`, 'invalid-buffer-length', `${path}.byteLength must be a positive safe integer`);
	}
	return value;
}

/**
 * Check one glTF document's references and bounds.
 *
 * `container` supplies the GLB BIN chunk length when the document came from a
 * GLB container; external files are resolved only among `files`, so a missing
 * buffer or image is refused rather than silently tolerated.
 */
function checkGltfDocument(input: {
	document: GltfDocument;
	path: string;
	container: GlbContainer | null;
	files: Map<string, number>;
	requireSelfContained: boolean;
}): void {
	const { document, path, container, files, requireSelfContained } = input;
	const baseDirectory = directoryOf(path);
	const buffers = readRecordList(document.buffers, `${path}.buffers`);
	const availableBytes: number[] = [];
	for (const [index, buffer] of buffers.entries()) {
		const bufferPath = `${path}.buffers[${index}]`;
		const byteLength = readByteLength(buffer, bufferPath);
		const uri = buffer.uri;
		if (uri === undefined) {
			if (container === null) {
				fail(bufferPath, 'missing-buffer-uri', `${bufferPath} carries no URI outside a GLB container`);
			}
			if (container.binLength === null) {
				fail(bufferPath, 'missing-glb-bin-chunk', `${bufferPath} names the GLB binary buffer and the container has no BIN chunk`);
			}
			if (byteLength > container.binLength) {
				fail(bufferPath, 'buffer-out-of-bounds', `${bufferPath} declares ${byteLength} bytes and the BIN chunk carries ${container.binLength}`);
			}
			availableBytes.push(container.binLength);
			continue;
		}
		if (typeof uri !== 'string' || uri.length === 0) {
			fail(`${bufferPath}.uri`, 'invalid-uri', `${bufferPath}.uri must be a non-empty string`);
		}
		if (isDataUri(uri)) {
			const carried = base64Bytes(uri);
			if (carried < byteLength) {
				fail(`${bufferPath}.uri`, 'buffer-out-of-bounds', `${bufferPath} declares ${byteLength} bytes and its data URI carries about ${carried}`);
			}
			availableBytes.push(byteLength);
			continue;
		}
		if (requireSelfContained) {
			fail(`${bufferPath}.uri`, 'external-buffer', `${bufferPath} references ${JSON.stringify(uri)}; the approved derivative must be self-contained`);
		}
		const referenced = resolveRelativeUri(baseDirectory, uri, `${bufferPath}.uri`);
		const fileBytes = files.get(referenced);
		if (fileBytes === undefined) {
			fail(`${bufferPath}.uri`, 'missing-referenced-file', `${bufferPath} references ${JSON.stringify(referenced)}, which the import does not declare`);
		}
		if (byteLength > fileBytes) {
			fail(bufferPath, 'buffer-out-of-bounds', `${bufferPath} declares ${byteLength} bytes and ${referenced} carries ${fileBytes}`);
		}
		availableBytes.push(fileBytes);
	}
	const views = readRecordList(document.bufferViews, `${path}.bufferViews`);
	for (const [index, view] of views.entries()) {
		const viewPath = `${path}.bufferViews[${index}]`;
		const bufferIndex = view.buffer;
		if (typeof bufferIndex !== 'number' || !Number.isSafeInteger(bufferIndex) || bufferIndex < 0 || bufferIndex >= buffers.length) {
			fail(`${viewPath}.buffer`, 'invalid-buffer-index', `${viewPath}.buffer must name one of the document's buffers`);
		}
		const byteOffset = view.byteOffset === undefined ? 0 : view.byteOffset;
		if (typeof byteOffset !== 'number' || !Number.isSafeInteger(byteOffset) || byteOffset < 0) {
			fail(`${viewPath}.byteOffset`, 'invalid-buffer-offset', `${viewPath}.byteOffset must be a non-negative safe integer`);
		}
		const byteLength = view.byteLength;
		if (typeof byteLength !== 'number' || !Number.isSafeInteger(byteLength) || byteLength <= 0) {
			fail(`${viewPath}.byteLength`, 'invalid-buffer-length', `${viewPath}.byteLength must be a positive safe integer`);
		}
		if (byteOffset + byteLength > availableBytes[bufferIndex]!) {
			fail(viewPath, 'buffer-view-out-of-bounds', `${viewPath} ends past its buffer's declared bytes`);
		}
	}
	const images = readRecordList(document.images, `${path}.images`);
	for (const [index, image] of images.entries()) {
		const imagePath = `${path}.images[${index}]`;
		const uri = image.uri;
		if (uri === undefined) continue; // a bufferView-backed image is checked by its view
		if (typeof uri !== 'string' || uri.length === 0) {
			fail(`${imagePath}.uri`, 'invalid-uri', `${imagePath}.uri must be a non-empty string`);
		}
		if (isDataUri(uri)) continue;
		if (requireSelfContained) {
			fail(`${imagePath}.uri`, 'external-image', `${imagePath} references ${JSON.stringify(uri)}; the approved derivative must be self-contained`);
		}
		const referenced = resolveRelativeUri(baseDirectory, uri, `${imagePath}.uri`);
		if (!files.has(referenced)) {
			fail(`${imagePath}.uri`, 'missing-referenced-file', `${imagePath} references ${JSON.stringify(referenced)}, which the import does not declare`);
		}
	}
}

/**
 * Check the whole import: the derivative is a self-contained GLB, and the source
 * set is one glTF/GLB document plus every file it references.
 */
export function checkModelStructure(input: {
	readonly sourceFiles: readonly ModelSourceFile[];
	readonly derivative: Buffer;
}): readonly ModelStructureIssue[] {
	try {
		const files = new Map<string, number>(input.sourceFiles.map((file) => [file.path, file.bytes.length]));
		const roots = input.sourceFiles.filter((file) => file.path.endsWith('.glb') || file.path.endsWith('.gltf'));
		if (roots.length !== 1) {
			fail('$.sourceFiles', 'ambiguous-root', 'An import declares exactly one .gltf or .glb source document');
		}
		const root = roots[0]!;
		const rootBytes = input.sourceFiles.find((file) => file.path === root.path)!.bytes;

		if (root.path.endsWith('.glb')) {
			const container = readGlb(rootBytes, root.path);
			checkGltfDocument({
				document: container.json,
				path: root.path,
				container,
				files,
				requireSelfContained: true
			});
		} else {
			const document = readDocument(rootBytes, root.path);
			checkGltfDocument({ document, path: root.path, container: null, files, requireSelfContained: false });
		}

		const derivative = readGlb(input.derivative, '$.derivative');
		if (derivative.binLength === null) {
			fail('$.derivative', 'missing-glb-bin-chunk', 'The approved derivative carries no GLB binary chunk');
		}
		checkGltfDocument({
			document: derivative.json,
			path: '$.derivative',
			container: derivative,
			files: new Map(),
			requireSelfContained: true
		});
		return [];
	} catch (error) {
		if (error instanceof StructureRefusal) return [error.issue];
		throw error;
	}
}
