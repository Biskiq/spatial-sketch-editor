/**
 * Builds the S8 characterization fixtures.
 *
 * These are first-party synthetic bytes, not photographs: every value is
 * defined by this script so an appearance change can be attributed to the
 * renderer rather than to a changed source image. The generated files and
 * `fixtures.json` are committed; `--check` re-derives the manifest and fails if
 * a file no longer matches its pin.
 *
 * Run from `apps/editor`:
 *   npx vite-node scripts/build-s8-characterization-fixtures.ts
 *   npx vite-node scripts/build-s8-characterization-fixtures.ts --check
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../tests/lib/render/materials/__fixtures__/s8');

type Rgba = readonly [number, number, number, number];

function crc32(bytes: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
	const typeBytes = Buffer.from(type, 'ascii');
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
	return Buffer.concat([length, typeBytes, data, crc]);
}

/** Straight 8-bit RGBA, one filter-0 scanline per row, deterministic deflate. */
function encodePng(width: number, height: number, pixels: Uint8Array): Buffer {
	const stride = width * 4;
	const raw = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y += 1) {
		raw[y * (stride + 1)] = 0;
		raw.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	ihdr[10] = 0;
	ihdr[11] = 0;
	ihdr[12] = 0;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0))
	]);
}

function paint(width: number, height: number, pixel: (x: number, y: number) => Rgba): Uint8Array {
	const out = new Uint8Array(width * height * 4);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const [r, g, b, a] = pixel(x, y);
			const at = (y * width + x) * 4;
			out[at] = r;
			out[at + 1] = g;
			out[at + 2] = b;
			out[at + 3] = a;
		}
	}
	return out;
}

function inRect(x: number, y: number, left: number, top: number, size: number): boolean {
	return x >= left && x < left + size && y >= top && y < top + size;
}

function swatch(): Buffer {
	const pixels = paint(256, 256, (x, y) => {
		const left = x < 128;
		const top = y < 128;
		if (left && top) return [128, 128, 128, 255];
		if (!left && top) return [220, 40, 40, 255];
		if (left && !top) return [40, 180, 80, 128];
		return [40, 80, 220, 0];
	});
	return encodePng(256, 256, pixels);
}

function checker(): Buffer {
	const white: Rgba = [255, 255, 255, 255];
	const black: Rgba = [0, 0, 0, 255];
	const pixels = paint(256, 256, (x, y) => {
		const base = (Math.floor(x / 32) + Math.floor(y / 32)) % 2 === 0 ? white : black;
		if (inRect(x, y, 0, 0, 32)) return [230, 30, 30, 255];
		if (inRect(x, y, 224, 0, 32)) return [30, 200, 60, 255];
		if (inRect(x, y, 0, 224, 32)) return [30, 70, 220, 255];
		if (inRect(x, y, 224, 224, 32)) return [240, 210, 20, 255];
		if (inRect(x, y, 96, 48, 16)) return [240, 20, 240, 255];
		if (inRect(x, y, 48, 96, 16)) return [20, 230, 230, 255];
		return base;
	});
	return encodePng(256, 256, pixels);
}

function normalMap(sign: 1 | -1): Buffer {
	const n = (() => {
		const raw = [0.3, 0.6 * sign, 0.74];
		const length = Math.hypot(...raw);
		return raw.map((value) => value / length);
	})();
	const encoded = n.map((value) => Math.round((value * 0.5 + 0.5) * 255)) as unknown as Rgba;
	const pixels = paint(128, 128, (x, y) => {
		if (x >= 16 && x < 112 && y >= 16 && y < 112) return encoded;
		return [128, 128, 255, 255];
	});
	return encodePng(128, 128, pixels);
}

function orm(): Buffer {
	const pixels = paint(128, 128, (x, y) => {
		if (x >= 16 && x < 112 && y >= 16 && y < 112) return [51, 191, 255, 255];
		return [26, 128, 230, 255];
	});
	return encodePng(128, 128, pixels);
}

function align4(value: number): number {
	return (value + 3) & ~3;
}

function buildTwoUvGlb(): Buffer {
	const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
	const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
	const uv0 = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
	const uv1 = new Float32Array([1, 0, 0, 0, 0, 1, 1, 1]);
	const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

	const chunks = [
		Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength),
		Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength),
		Buffer.from(uv0.buffer, uv0.byteOffset, uv0.byteLength),
		Buffer.from(uv1.buffer, uv1.byteOffset, uv1.byteLength),
		Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength)
	];
	const offsets: number[] = [];
	let binLength = 0;
	for (const chunk of chunks) {
		offsets.push(binLength);
		binLength = align4(binLength + chunk.length);
	}
	const bin = Buffer.alloc(binLength);
	chunks.forEach((chunk, index) => bin.set(chunk, offsets[index]!));

	const json = {
		asset: { version: '2.0', generator: 'biskiq-s8-characterization' },
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [{ mesh: 0, name: 'S8 Two UV Quad' }],
		meshes: [
			{
				name: 'S8 Two UV Quad',
				primitives: [
					{
						attributes: {
							POSITION: 0,
							NORMAL: 1,
							TEXCOORD_0: 2,
							TEXCOORD_1: 3
						},
						indices: 4,
						material: 0,
						mode: 4
					}
				]
			}
		],
		materials: [
			{
				name: 'S8 Two UV',
				pbrMetallicRoughness: {
					baseColorFactor: [0.8, 0.8, 0.8, 1],
					metallicFactor: 0,
					roughnessFactor: 0.7
				}
			}
		],
		accessors: [
			{
				bufferView: 0,
				componentType: 5126,
				count: 4,
				type: 'VEC3',
				min: [0, 0, 0],
				max: [1, 1, 0]
			},
			{ bufferView: 1, componentType: 5126, count: 4, type: 'VEC3' },
			{ bufferView: 2, componentType: 5126, count: 4, type: 'VEC2' },
			{ bufferView: 3, componentType: 5126, count: 4, type: 'VEC2' },
			{ bufferView: 4, componentType: 5123, count: 6, type: 'SCALAR' }
		],
		bufferViews: [
			{ buffer: 0, byteOffset: offsets[0], byteLength: chunks[0]!.length, target: 34962 },
			{ buffer: 0, byteOffset: offsets[1], byteLength: chunks[1]!.length, target: 34962 },
			{ buffer: 0, byteOffset: offsets[2], byteLength: chunks[2]!.length, target: 34962 },
			{ buffer: 0, byteOffset: offsets[3], byteLength: chunks[3]!.length, target: 34962 },
			{ buffer: 0, byteOffset: offsets[4], byteLength: chunks[4]!.length, target: 34963 }
		],
		buffers: [{ byteLength: binLength }]
	};

	const jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
	const jsonPad = align4(jsonBytes.length) - jsonBytes.length;
	const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc(jsonPad, 0x20)]);
	const binChunk = Buffer.concat([bin, Buffer.alloc(align4(bin.length) - bin.length)]);
	const header = Buffer.alloc(12);
	header.writeUInt32LE(0x46546c67, 0);
	header.writeUInt32LE(2, 4);
	header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
	const jsonHeader = Buffer.alloc(8);
	jsonHeader.writeUInt32LE(jsonChunk.length, 0);
	jsonHeader.writeUInt32LE(0x4e4f534a, 4);
	const binHeader = Buffer.alloc(8);
	binHeader.writeUInt32LE(binChunk.length, 0);
	binHeader.writeUInt32LE(0x004e4942, 4);
	return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
}

type Fixture = {
	readonly id: string;
	readonly file: string;
	readonly format: 'png' | 'glb';
	readonly width?: number;
	readonly height?: number;
	readonly role: string;
	readonly bytes: Buffer;
	readonly semantics: Record<string, unknown>;
};

const fixtures: Fixture[] = [
	{
		id: 'swatch-rgba',
		file: 'swatch-rgba.png',
		format: 'png',
		width: 256,
		height: 256,
		role: 'colour/data interpretation',
		bytes: swatch(),
		semantics: {
			quadrants: [
				{ rect: [0, 0, 128, 128], rgba: [128, 128, 128, 255], note: 'neutral 128 grey' },
				{ rect: [128, 0, 128, 128], rgba: [220, 40, 40, 255], note: 'opaque red' },
				{ rect: [0, 128, 128, 128], rgba: [40, 180, 80, 128], note: 'half-alpha green' },
				{ rect: [128, 128, 128, 128], rgba: [40, 80, 220, 0], note: 'transparent blue, straight RGB' }
			]
		}
	},
	{
		id: 'checker-asymmetric',
		file: 'checker-asymmetric.png',
		format: 'png',
		width: 256,
		height: 256,
		role: 'mapping orientation and wrap',
		bytes: checker(),
		semantics: {
			cellPx: 32,
			corners: {
				topLeft: [230, 30, 30, 255],
				topRight: [30, 200, 60, 255],
				bottomLeft: [30, 70, 220, 255],
				bottomRight: [240, 210, 20, 255]
			},
			markers: [
				{ rect: [96, 48, 16, 16], rgba: [240, 20, 240, 255], note: 'U marker, upper right of centre' },
				{ rect: [48, 96, 16, 16], rgba: [20, 230, 230, 255], note: 'V marker, lower left of centre' }
			]
		}
	},
	{
		id: 'normal-plus-y',
		file: 'normal-plus-y.png',
		format: 'png',
		width: 128,
		height: 128,
		role: 'normal convention +Y',
		bytes: normalMap(1),
		semantics: {
			flatBorder: [128, 128, 255, 255],
			center: [16, 16, 112, 112],
			encodedNormal: Array.from(
				(() => {
					const raw = [0.3, 0.6, 0.74];
					const length = Math.hypot(...raw);
					return raw.map((value) => Math.round((value / length * 0.5 + 0.5) * 255));
				})()
			),
			note: 'Y channel above 128: green up'
		}
	},
	{
		id: 'normal-minus-y',
		file: 'normal-minus-y.png',
		format: 'png',
		width: 128,
		height: 128,
		role: 'normal convention −Y',
		bytes: normalMap(-1),
		semantics: {
			flatBorder: [128, 128, 255, 255],
			center: [16, 16, 112, 112],
			encodedNormal: Array.from(
				(() => {
					const raw = [0.3, -0.6, 0.74];
					const length = Math.hypot(...raw);
					return raw.map((value) => Math.round((value / length * 0.5 + 0.5) * 255));
				})()
			),
			note: 'Y channel below 128: green down'
		}
	},
	{
		id: 'orm-distinct',
		file: 'orm-distinct.png',
		format: 'png',
		width: 128,
		height: 128,
		role: 'ORM channel interpretation',
		bytes: orm(),
		semantics: {
			border: [26, 128, 230, 255],
			center: [16, 16, 112, 112],
			centerRgba: [51, 191, 255, 255],
			note: 'R occlusion 0.2, G roughness 0.75, B metalness 1.0'
		}
	},
	{
		id: 'two-uv-glb',
		file: 'two-uv-glb.glb',
		format: 'glb',
		role: 'two UV sets, mirrored UV1',
		bytes: buildTwoUvGlb(),
		semantics: {
			mesh: 'S8 Two UV Quad',
			attributes: ['POSITION', 'NORMAL', 'TEXCOORD_0', 'TEXCOORD_1'],
			uv0: [[0, 0], [1, 0], [1, 1], [0, 1]],
			uv1: [[1, 0], [0, 0], [0, 1], [1, 1]],
			note: 'UV1 mirrors U against UV0; both frames are non-singular'
		}
	}
];

const manifest = {
	schemaVersion: 1,
	generatedBy: 'apps/editor/scripts/build-s8-characterization-fixtures.ts',
	fixtures: fixtures.map((fixture) => ({
		id: fixture.id,
		file: fixture.file,
		format: fixture.format,
		...(fixture.width === undefined ? {} : { width: fixture.width, height: fixture.height }),
		role: fixture.role,
		sha256: `sha256-${createHash('sha256').update(fixture.bytes).digest('hex')}`,
		byteSize: fixture.bytes.byteLength,
		semantics: fixture.semantics
	}))
};

const check = process.argv.includes('--check');
mkdirSync(OUT, { recursive: true });
let failed = false;
for (const fixture of fixtures) {
	const path = resolve(OUT, fixture.file);
	if (check) {
		let existing: Buffer | null = null;
		try {
			existing = readFileSync(path);
		} catch {
			existing = null;
		}
		if (existing === null || !existing.equals(fixture.bytes)) {
			console.error(`fixture mismatch: ${fixture.file}`);
			failed = true;
		}
	} else {
		writeFileSync(path, fixture.bytes);
	}
}
const manifestPath = resolve(OUT, 'fixtures.json');
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
if (check) {
	let existingManifest = '';
	try {
		existingManifest = readFileSync(manifestPath, 'utf8');
	} catch {
		existingManifest = '';
	}
	if (existingManifest !== manifestText) {
		console.error('fixture manifest mismatch: fixtures.json');
		failed = true;
	}
} else {
	writeFileSync(manifestPath, manifestText);
}
if (failed) process.exitCode = 1;
