/**
 * T2.S8 F deterministic derivation: retained 2K source → 512/1K/2K ladder →
 * the qualified level in `apps/editor/static/textures/<set-id>/`.
 *
 * `@napi-rs/image` (exact-pinned) only decodes and encodes. Every pixel step is
 * `material-pixels.ts`. Each set writes a derivation record under `records/`
 * with its source sha256s and retention keys, tool and codec versions,
 * parameters, every ladder level's sha256 and size, measured statistics and the
 * qualified level from `qualification.json`.
 *
 * Usage:
 *   node derive.ts [setId ...]           derive, record, publish qualified level
 *   node derive.ts --verify [setId ...]  re-derive and require identical bytes
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Transformer } from '@napi-rs/image';
import {
	COLOR_GAIN_TRANSFORM,
	gainCeiling,
	hueFactor,
	linearToHex,
	luminanceContrast,
	NEUTRALIZE_TRANSFORM,
	applyGain,
	boxHalve,
	hexToLinear,
	requiredGain,
	seamAgainstFeatures,
	decodeRaw,
	detailLoss,
	lanczosResample,
	meanRgb,
	neutralizeLuminance,
	packOrm,
	quantize,
	seamRatio,
	srgbToLinear,
	type Plane,
	type PlaneDomain
} from './material-pixels.ts';
import { SOURCES_ROOT, type HarvestRecord } from './harvest.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const EDITOR = resolve(HERE, '../..');
const REPO = resolve(EDITOR, '../..');
const MANIFEST = join(
	REPO,
	'docs/roadmap/t2-look-atmosphere/s8-professional-material-foundation/f-acquisition-manifest.json'
);
const RECORDS = join(HERE, 'records');
const QUALIFICATION = join(HERE, 'qualification.json');
const STATIC_TEXTURES = join(EDITOR, 'static/textures');
const WORK = join(SOURCES_ROOT, 'derived');

const CODEC = '@napi-rs/image';
const CODEC_VERSION = JSON.parse(
	readFileSync(join(REPO, 'node_modules/@napi-rs/image/package.json'), 'utf8')
).version as string;
const COLOR_QUALITY = 90;
const SIZE = 2048;
const LEVELS = [
	['2k', 2048],
	['1k', 1024],
	['512', 512]
] as const;
type Level = (typeof LEVELS)[number][0];
type Role = 'color' | 'normal' | 'orm';
const DOMAIN: Readonly<Record<Role, PlaneDomain>> = { color: 'srgb', normal: 'normal', orm: 'data' };

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function decodeFile(path: string, domain: PlaneDomain): Plane {
	const transformer = new Transformer(readFileSync(path));
	const meta = transformer.metadataSync();
	const raw = transformer.rawPixelsSync();
	return decodeRaw(new Uint8Array(raw), meta.colorType, meta.width, meta.height, domain);
}

function decodedRgba8(bytes: Uint8Array): { data: Uint8Array; width: number; height: number } {
	const transformer = new Transformer(bytes);
	const meta = transformer.metadataSync();
	const raw = new Uint8Array(transformer.rawPixelsSync());
	if (meta.colorType === 3) return { data: raw, width: meta.width, height: meta.height };
	if (meta.colorType === 2) {
		const out = new Uint8Array(meta.width * meta.height * 4);
		for (let p = 0, q = 0; p < raw.length; p += 3, q += 4) {
			out[q] = raw[p];
			out[q + 1] = raw[p + 1];
			out[q + 2] = raw[p + 2];
			out[q + 3] = 255;
		}
		return { data: out, width: meta.width, height: meta.height };
	}
	throw new Error(`unexpected decoded colour type ${meta.colorType}`);
}

function encode(role: Role, source: Plane): { bytes: Uint8Array; pixels: Uint8Array } {
	const pixels = quantize(source, DOMAIN[role]);
	const transformer = Transformer.fromRgbaPixels(pixels, source.width, source.height);
	const bytes = new Uint8Array(
		role === 'color' ? transformer.webpSync(COLOR_QUALITY) : transformer.webpLosslessSync()
	);
	if (role !== 'color') {
		const back = decodedRgba8(bytes);
		for (let i = 0; i < pixels.length; i += 1) {
			if (back.data[i] !== pixels[i]) throw new Error(`${role}: lossless round trip differs`);
		}
	}
	return { bytes, pixels };
}

function fileOf(record: HarvestRecord, role: string): string | null {
	const file = record.files.find((entry) => entry.role === role);
	return file === undefined ? null : join(SOURCES_ROOT, file.key);
}

type SourcePlanes = {
	color: Plane | null;
	normal: Plane;
	roughness: Plane;
	roughnessChannel: 0 | 1 | 2;
	occlusion: Plane | null;
	occlusionChannel: 0 | 1 | 2;
	providerBlueMax: number | null;
	sourceSizes: Record<string, [number, number]>;
};

function readSources(set: any, record: HarvestRecord, bindOcclusion: boolean): SourcePlanes {
	const metal = set.tint === 'metal';
	const sizes: Record<string, [number, number]> = {};
	const load = (role: string, domain: PlaneDomain): Plane => {
		const path = fileOf(record, role);
		if (path === null) throw new Error(`${set.setId}: no ${role} source`);
		const decoded = decodeFile(path, domain);
		sizes[role] = [decoded.width, decoded.height];
		return lanczosResample(decoded, SIZE, SIZE, domain);
	};
	const color = metal ? null : load('color', 'srgb');
	const normal = load('normal', 'normal');
	if (record.provider === 'polyhaven') {
		const arm = load('orm', 'data');
		let blue = 0;
		for (let i = 2; i < arm.data.length; i += 4) blue = Math.max(blue, arm.data[i]);
		return {
			color,
			normal,
			roughness: arm,
			roughnessChannel: 1,
			occlusion: bindOcclusion ? arm : null,
			occlusionChannel: 0,
			providerBlueMax: Math.round(blue * 255),
			sourceSizes: sizes
		};
	}
	return {
		color,
		normal,
		roughness: load('roughness', 'data'),
		roughnessChannel: 0,
		occlusion: bindOcclusion ? load('occlusion', 'data') : null,
		occlusionChannel: 0,
		providerBlueMax: null,
		sourceSizes: sizes
	};
}

function deriveSet(set: any, entries: any[], qualified: string | null, verify: boolean): void {
	const harvestPath = join(SOURCES_ROOT, 'records', `${set.setId}.harvest.json`);
	const record = JSON.parse(readFileSync(harvestPath, 'utf8')) as HarvestRecord;
	const bindOcclusion = entries.some((entry) => entry.recipe.maps.occlusion !== undefined);
	const metal = set.tint === 'metal';
	const neutralize = set.tint === 'T1-neutralize';
	const sources = readSources(set, record, bindOcclusion);
	// Colour transforms preserve information: every step records the mean and
	// relative luminance contrast before and after.
	const designTarget = entries.find((entry) => entry.targetMeanAlbedo !== undefined)?.targetMeanAlbedo as
		| string
		| undefined;
	if (entries.filter((entry) => entry.targetMeanAlbedo !== undefined).length > 1) {
		throw new Error(`${set.setId}: one design target per set is assumed`);
	}
	const transforms: Record<string, unknown>[] = [];
	const measure = (plane: Plane) => ({
		linearMean: meanRgb(plane).map((v) => round(v, 5)),
		luminanceContrast: round(luminanceContrast(plane), 4)
	});
	if (neutralize && sources.color !== null) {
		const before = measure(sources.color);
		neutralizeLuminance(sources.color);
		transforms.push({ transform: NEUTRALIZE_TRANSFORM, weights: [0.2126, 0.7152, 0.0722], before, after: measure(sources.color) });
	}
	// §7 factor ranges: a factor only darkens, so a source darker than its design
	// target is lifted by one gain — bounded so at most 0.5% of texels clip. A
	// target the bound cannot reach keeps its hue at the luminance the source
	// supports; it is never force-matched.
	if (designTarget !== undefined && sources.color !== null) {
		const needed = requiredGain(hexToLinear(designTarget), meanRgb(sources.color));
		if (needed > 1) {
			const ceiling = gainCeiling(sources.color, MAX_GAIN_CLIPPED_SHARE);
			const applied = Math.min(needed, ceiling);
			if (applied > 1.001) {
				const before = measure(sources.color);
				const clippedShare = applyGain(sources.color, applied);
				transforms.push({
					transform: COLOR_GAIN_TRANSFORM,
					target: designTarget,
					neededGain: round(needed, 5),
					gainCeiling: round(ceiling, 5),
					appliedGain: round(applied, 5),
					maxClippedShare: MAX_GAIN_CLIPPED_SHARE,
					clippedShare: round(clippedShare, 5),
					before,
					after: measure(sources.color)
				});
			}
		}
	}

	let planes: Partial<Record<Role, Plane>> = {
		...(sources.color === null ? {} : { color: sources.color }),
		normal: sources.normal,
		orm: packOrm({
			roughness: sources.roughness,
			roughnessChannel: sources.roughnessChannel,
			occlusion: sources.occlusion,
			occlusionChannel: sources.occlusionChannel,
			metal
		})
	};
	const roles = Object.keys(planes) as Role[];
	const levels: Record<string, Record<string, { sha256: string; bytes: number }>> = {};
	const detail: Record<string, Record<string, number>> = {};
	const stats: Record<string, unknown> = {};
	const encoded: Record<string, Record<string, Uint8Array>> = {};
	let previous: Partial<Record<Role, Plane>> | null = null;
	let previousLevel: Level | null = null;
	for (const [level] of LEVELS) {
		if (previous !== null) {
			const next: Partial<Record<Role, Plane>> = {};
			for (const role of roles) next[role] = boxHalve(previous[role]!, DOMAIN[role]);
			planes = next;
			detail[`${previousLevel}->${level}`] = Object.fromEntries(
				roles.map((role) => [role, round(detailLoss(previous![role]!, planes[role]!, DOMAIN[role]), 3)])
			);
		}
		levels[level] = {};
		encoded[level] = {};
		for (const role of roles) {
			const { bytes } = encode(role, planes[role]!);
			levels[level][role] = { sha256: sha256(bytes), bytes: bytes.byteLength };
			encoded[level][role] = bytes;
			const dir = join(WORK, set.setId, level);
			mkdirSync(dir, { recursive: true });
			if (!verify) writeFileSync(join(dir, `${role}.webp`), bytes);
		}
		previous = planes;
		previousLevel = level;
	}

	// Statistics measured on the encoded bytes that would ship.
	for (const [level] of LEVELS) {
		const levelStats: Record<string, unknown> = {};
		for (const role of roles) {
			const image = decodedRgba8(encoded[level][role]);
			levelStats[`${role}SeamRatio`] = round(seamRatio(image.data, image.width, image.height), 3);
			const features = seamAgainstFeatures(image.data, image.width, image.height);
			levelStats[`${role}SeamVsFeatures`] = [round(features.x, 3), round(features.y, 3)];
			if (role === 'color') {
				const linear = linearMeanOf(image.data);
				levelStats.colorLinearMean = linear.map((v) => round(v, 5));
				levelStats.colorClippedShare = round(clippedShare(image.data), 5);
			}
			if (role === 'orm') {
				levelStats.roughnessMean = round(channelMean(image.data, 1) / 255, 4);
				levelStats.occlusionMean = round(channelMean(image.data, 0) / 255, 4);
			}
		}
		stats[level] = levelStats;
	}

	const colorMean = (stats['2k'] as any)?.colorLinearMean as [number, number, number] | undefined;
	const primaryColours = entries
		.filter((entry) => entry.preset === undefined)
		.map((entry) => entryColour(entry, set.tint, colorMean));
	// A preset shares its set's images, so it shares the set's colour treatment
	// and differs only in the factors its manifest entry states.
	const entryColours = entries.map((entry) =>
		entry.preset === undefined
			? primaryColours.find((colour) => colour.id === entry.id)!
			: { ...primaryColours[0], id: entry.id, rule: `preset of ${primaryColours[0].id}: ${entry.preset}` }
	);

	const recordOut = {
		schema: 's8-f-derivation-record/1',
		setId: set.setId,
		provider: record.provider,
		assetId: record.assetId,
		acquiredAt: record.acquiredAt,
		sources: [...(record.archive === undefined ? [] : [record.archive]), ...record.files].map((file) => ({
			role: file.role,
			retentionKey: file.key,
			sha256: file.sha256,
			bytes: file.bytes,
			...(file.md5 === undefined ? {} : { md5: file.md5 }),
			...(file.url === undefined ? {} : { url: file.url }),
			...(file.member === undefined ? {} : { member: file.member })
		})),
		sourceSizes: sources.sourceSizes,
		tool: {
			script: 'apps/editor/assets-source/textures/derive.ts',
			node: process.version,
			platform: `${process.platform}-${process.arch}`,
			codec: `${CODEC}@${CODEC_VERSION}`
		},
		parameters: {
			resampleTo2048: Object.values(sources.sourceSizes).some(([w, h]) => w !== SIZE || h !== SIZE)
				? 'separable Lanczos-3, periodic edges'
				: 'none',
			ladderFilter: 'exact 2x box (linear light for colour; renormalized normals)',
			neutralize: neutralize ? { transform: NEUTRALIZE_TRANSFORM, weights: [0.2126, 0.7152, 0.0722] } : null,
			colorTransforms: transforms,
			color: metal
				? 'none (metal: colour factor is measured F0)'
				: { format: 'image/webp', lossy: true, quality: COLOR_QUALITY, api: 'WebPEncodeRGBA simple API (default method)', metadata: 'none' },
			normal: { format: 'image/webp', lossless: true, convention: '+Y' },
			orm: {
				format: 'image/webp',
				lossless: true,
				r: bindOcclusion ? 'ambient occlusion' : '255 (occlusion not bound)',
				g: 'roughness',
				b: metal ? '255 (metal; map not bound)' : '0 (dielectric; map not bound)',
				providerBlueMax: sources.providerBlueMax
			}
		},
		ladder: levels,
		detailLoss: detail,
		statistics: stats,
		entryColours,
		qualified: qualified
	};

	const recordPath = join(RECORDS, `${set.setId}.json`);
	if (verify) {
		const existing = JSON.parse(readFileSync(recordPath, 'utf8'));
		const same = JSON.stringify(existing.ladder) === JSON.stringify(levels);
		console.log(`${set.setId}: ${same ? 'identical bytes' : 'DIFFERS'}`);
		if (!same) process.exitCode = 1;
		return;
	}
	mkdirSync(RECORDS, { recursive: true });
	writeFileSync(recordPath, `${JSON.stringify(recordOut, null, '\t')}\n`);
	if (qualified !== null) {
		const target = join(STATIC_TEXTURES, set.setId);
		mkdirSync(target, { recursive: true });
		for (const role of roles) copyFileSync(join(WORK, set.setId, qualified, `${role}.webp`), join(target, `${role}.webp`));
	}
	console.log(`${set.setId}: derived${qualified === null ? '' : `, published ${qualified}`}`);
}

const PLAUSIBILITY_TOLERANCE = 0.2;
const MAX_GAIN_CLIPPED_SHARE = 0.005;
/** Dielectric mean albedo range (§15 albedo check) and the correction ceiling. */
const ALBEDO_RANGE = [0.02, 0.9] as const;
const ALBEDO_CEILING_TARGET = 0.85;

function luminance(rgb: readonly number[]): number {
	return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/**
 * One entry's recipe colour and its evidence. Design targets set hue and, as
 * far as the source honestly allows, luminance. A plausibility reference is a
 * check: it never sets luminance. A T1 (neutral-base) set takes the
 * reference's hue at its own measured luminance; any dielectric above the
 * albedo range is lowered uniformly to the ceiling target.
 */
function entryColour(entry: any, tint: string, mean: [number, number, number] | undefined): Record<string, unknown> {
	if (tint === 'metal' || mean === undefined) {
		return { id: entry.id, color: entry.recipe.color, rule: 'measured F0 (no colour map)' };
	}
	const sourceY = luminance(mean);
	let target: [number, number, number] | null = null;
	let rule = 'as shot';
	const reference = entry.plausibilityCheck === undefined ? undefined : /#[0-9a-f]{6}/i.exec(entry.plausibilityCheck)?.[0];
	let plausibility: Record<string, unknown> | undefined;
	if (entry.targetMeanAlbedo !== undefined) {
		target = hexToLinear(entry.targetMeanAlbedo);
		rule = 'design target: linear(target) / measured mean per channel; target hue kept at the supported luminance when unreachable (§7)';
	} else if (reference !== undefined) {
		const referenceLinear = hexToLinear(reference);
		const ratio = sourceY / luminance(referenceLinear);
		plausibility = { reference, sourceLuminanceRatio: round(ratio, 3), withinTolerance: Math.abs(ratio - 1) <= PLAUSIBILITY_TOLERANCE };
		if (tint.startsWith('T1')) {
			const y = Math.min(sourceY, ALBEDO_CEILING_TARGET);
			target = referenceLinear.map((c) => (c * y) / luminance(referenceLinear)) as [number, number, number];
			rule = 'T1 neutral base: the reference hue at the source luminance (reference is a check, not a luminance target)';
		}
	}
	if (target === null && sourceY > ALBEDO_RANGE[1]) {
		target = mean.map((c) => (c * ALBEDO_CEILING_TARGET) / sourceY) as [number, number, number];
		rule = 'as shot, lowered uniformly into the dielectric albedo range';
	}
	if (target === null) {
		return { id: entry.id, color: entry.recipe.color, rule, measuredLinearMean: mean, albedoLuminance: round(sourceY, 4), ...(plausibility === undefined ? {} : { plausibility }) };
	}
	const factor = hueFactor(target, mean);
	const result = factor.map((f, c) => f * mean[c]);
	return {
		id: entry.id,
		color: linearToHex(factor),
		rule,
		target: entry.targetMeanAlbedo ?? null,
		measuredLinearMean: mean,
		linearFactor: factor.map((v) => round(v, 5)),
		albedoLuminance: round(luminance(result), 4),
		...(target === null ? {} : { targetLuminance: round(luminance(target), 4), targetReached: luminance(result) >= luminance(target) * 0.995 }),
		...(plausibility === undefined ? {} : { plausibility })
	};
}

function round(value: number, digits: number): number {
	const scale = 10 ** digits;
	return Math.round(value * scale) / scale;
}

function linearMeanOf(rgba: Uint8Array): [number, number, number] {
	const lut = Array.from({ length: 256 }, (_, i) => srgbToLinear(i / 255));
	const sum = [0, 0, 0];
	for (let i = 0; i < rgba.length; i += 4) {
		sum[0] += lut[rgba[i]];
		sum[1] += lut[rgba[i + 1]];
		sum[2] += lut[rgba[i + 2]];
	}
	const n = rgba.length / 4;
	return [sum[0] / n, sum[1] / n, sum[2] / n];
}

function clippedShare(rgba: Uint8Array): number {
	let clipped = 0;
	for (let i = 0; i < rgba.length; i += 4) {
		if (
			(rgba[i] >= 255 && rgba[i + 1] >= 255 && rgba[i + 2] >= 255) ||
			(rgba[i] === 0 && rgba[i + 1] === 0 && rgba[i + 2] === 0)
		) {
			clipped += 1;
		}
	}
	return clipped / (rgba.length / 4);
}

function channelMean(rgba: Uint8Array, channel: number): number {
	let sum = 0;
	for (let i = channel; i < rgba.length; i += 4) sum += rgba[i];
	return sum / (rgba.length / 4);
}

function main(): void {
	const args = process.argv.slice(2);
	const verify = args.includes('--verify');
	const wanted = new Set(args.filter((arg) => !arg.startsWith('--')));
	const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
	const qualification = existsSync(QUALIFICATION)
		? (JSON.parse(readFileSync(QUALIFICATION, 'utf8')).sets as Record<string, { level: string | null }>)
		: {};
	for (const set of manifest.assetSets as any[]) {
		if (set.tier !== 'core') continue;
		if (wanted.size > 0 && !wanted.has(set.setId)) continue;
		const entries = (manifest.entries as any[]).filter((entry) => entry.setId === set.setId);
		deriveSet(set, entries, qualification[set.setId]?.level ?? null, verify);
	}
}

main();
