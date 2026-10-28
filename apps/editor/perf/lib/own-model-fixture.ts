/**
 * The S03 acceptance fixture: one mapped GLB built in memory, plus the tiny PNG
 * reader its pixel evidence needs. No binary enters Git.
 *
 * The base colour is 2050 px so the creator-import recipe's 2048 px cap is
 * exercised (and reported as one reduced texture), and a normal map proves a
 * second texture travels with the derivative.
 */
import { Document, NodeIO } from '@gltf-transform/core';
import { deflateSync, inflateSync } from 'node:zlib';

/** The fixture's base colour; the starter enclosure carries no vivid green. */
export const MODEL_RGB = [40, 210, 90] as const;

function crc32(buffer: Buffer): number {
	let value = 0xffffffff;
	for (const byte of buffer) {
		value ^= byte;
		for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
	}
	return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
}

function encodePng(size: number, rows: Buffer[]): Buffer {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(size, 0);
	header.writeUInt32BE(size, 4);
	header[8] = 8;
	header[9] = 2;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		pngChunk('IHDR', header),
		pngChunk('IDAT', deflateSync(Buffer.concat(rows), { level: 6 })),
		pngChunk('IEND', Buffer.alloc(0))
	]);
}

/** A checker of the model colour and near-white, so mipmaps keep both. */
export function checkerPng(size: number): Buffer {
	const cell = Math.max(4, Math.floor(size / 16));
	const rows = Array.from({ length: size }, (_, y) => {
		const row = Buffer.alloc(1 + size * 3);
		for (let x = 0; x < size; x += 1) {
			const lit = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
			row[1 + x * 3] = lit ? MODEL_RGB[0] : 235;
			row[2 + x * 3] = lit ? MODEL_RGB[1] : 240;
			row[3 + x * 3] = lit ? MODEL_RGB[2] : 236;
		}
		return row;
	});
	return encodePng(size, rows);
}

/** A flat tangent-space normal map, so a second texture travels with the model. */
export function flatNormalPng(size: number): Buffer {
	const row = Buffer.alloc(1 + size * 3);
	for (let x = 0; x < size; x += 1) {
		row[1 + x * 3] = 128;
		row[2 + x * 3] = 128;
		row[3 + x * 3] = 255;
	}
	return encodePng(size, Array.from({ length: size }, () => row));
}

function boxGeometry() {
	const positions: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];
	const faces = [
		{ n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
		{ n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
		{ n: [1, 0, 0], c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
		{ n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
		{ n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
		{ n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] }
	];
	for (const face of faces) {
		const base = positions.length / 3;
		for (const corner of face.c) positions.push(...corner);
		for (let index = 0; index < 4; index += 1) normals.push(...face.n);
		uvs.push(0, 1, 1, 1, 1, 0, 0, 0);
		indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
	}
	return { positions, normals, uvs, indices };
}

/** One 2 m box (unit bounds about the origin) with a base colour and a normal map. */
export async function mappedModelGlb(): Promise<Buffer> {
	const geometry = boxGeometry();
	const doc = new Document();
	const buffer = doc.createBuffer();
	const baseColor = doc.createTexture('paint').setImage(checkerPng(2050)).setMimeType('image/png');
	const normal = doc.createTexture('normal').setImage(flatNormalPng(512)).setMimeType('image/png');
	const material = doc
		.createMaterial('paint')
		.setBaseColorTexture(baseColor)
		.setNormalTexture(normal)
		.setMetallicFactor(0)
		.setRoughnessFactor(0.7);
	const primitive = doc
		.createPrimitive()
		.setMaterial(material)
		.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(geometry.positions)).setBuffer(buffer))
		.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(geometry.normals)).setBuffer(buffer))
		.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(geometry.uvs)).setBuffer(buffer))
		.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(geometry.indices)).setBuffer(buffer));
	const mesh = doc.createMesh('gate').addPrimitive(primitive);
	doc.createScene('scene').addChild(doc.createNode('gate').setMesh(mesh));
	return Buffer.from(await new NodeIO().writeBinary(doc));
}

export type DecodedPng = { width: number; height: number; channels: number; data: Buffer };

/** 8-bit non-interlaced PNG, which is what a Chromium screenshot is. */
export function decodePng(png: Buffer): DecodedPng {
	if (png.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
	let offset = 8;
	let width = 0;
	let height = 0;
	let bitDepth = 0;
	let colorType = 0;
	let interlace = 0;
	const chunks: Buffer[] = [];
	while (offset < png.length) {
		const length = png.readUInt32BE(offset);
		const type = png.toString('ascii', offset + 4, offset + 8);
		const data = png.subarray(offset + 8, offset + 8 + length);
		if (type === 'IHDR') {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			bitDepth = data[8]!;
			colorType = data[9]!;
			interlace = data[12]!;
		} else if (type === 'IDAT') chunks.push(data);
		else if (type === 'IEND') break;
		offset += 12 + length;
	}
	if (bitDepth !== 8 || interlace !== 0) throw new Error(`unsupported PNG (${bitDepth} bit, interlace ${interlace})`);
	const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
	if (channels === 0) throw new Error(`unsupported PNG colour type ${colorType}`);
	const raw = inflateSync(Buffer.concat(chunks));
	const stride = width * channels;
	const out = Buffer.alloc(stride * height);
	for (let y = 0; y < height; y += 1) {
		const filter = raw[y * (stride + 1)]!;
		const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
		const row = out.subarray(y * stride, (y + 1) * stride);
		const previous = y === 0 ? null : out.subarray((y - 1) * stride, y * stride);
		for (let x = 0; x < stride; x += 1) {
			const left = x >= channels ? row[x - channels]! : 0;
			const up = previous === null ? 0 : previous[x]!;
			const upLeft = previous !== null && x >= channels ? previous[x - channels]! : 0;
			const value = line[x]!;
			let resolved: number;
			switch (filter) {
				case 0: resolved = value; break;
				case 1: resolved = value + left; break;
				case 2: resolved = value + up; break;
				case 3: resolved = value + ((left + up) >> 1); break;
				case 4: {
					const estimate = left + up - upLeft;
					const dl = Math.abs(estimate - left);
					const du = Math.abs(estimate - up);
					const dul = Math.abs(estimate - upLeft);
					resolved = value + (dl <= du && dl <= dul ? left : du <= dul ? up : upLeft);
					break;
				}
				default: throw new Error(`unsupported PNG filter ${filter}`);
			}
			row[x] = resolved & 0xff;
		}
	}
	return { width, height, channels, data: out };
}

/** Pixels that can only be the placed model's vivid green. */
export function modelGreenPixels(png: DecodedPng): number {
	let count = 0;
	for (let index = 0; index < png.data.length; index += png.channels) {
		const r = png.data[index]!;
		const g = png.data[index + 1]!;
		const b = png.data[index + 2]!;
		if (g > 90 && g > r + 40 && g > b + 40) count += 1;
	}
	return count;
}
