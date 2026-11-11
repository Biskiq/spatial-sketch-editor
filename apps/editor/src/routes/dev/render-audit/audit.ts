/**
 * T2 S0 Gate A — the render-audit bench.
 *
 * Dev-only. It exists to measure the pipeline the product actually uses, not to
 * ship a second rendering path. The readback is the **default framebuffer**
 * immediately after `render()`: those bytes are the displayed sRGB output. The
 * snapshot render-target path is deliberately not used as evidence because
 * Three r187 renders a non-XR target in `ColorManagement.workingColorSpace`
 * (linear), while its `UnsignedByteType` readback is interpreted as sRGB by the
 * snapshot PNG writer.
 *
 * E1 captures the shared renderer/material/light facts.
 * E2 measures tone mapping and artwork fidelity against a known sRGB chart.
 * E3 measures light units, Brightness-stop ratios and the spot frustum.
 */
import {
	ACESFilmicToneMapping,
	AgXToneMapping,
	CanvasTexture,
	Color,
	ColorManagement,
	DirectionalLight,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshLambertMaterial,
	MeshStandardMaterial,
	NearestFilter,
	NeutralToneMapping,
	NoToneMapping,
	OrthographicCamera,
	PCFShadowMap,
	PlaneGeometry,
	PointLight,
	SRGBColorSpace,
	Scene,
	SpotLight,
	UnsignedByteType,
	Vector2,
	WebGLRenderTarget,
	REVISION,
	type Material,
	type Texture,
	type WebGLRenderer
} from 'three';
import { createManagedWebGLRenderer } from '$lib/render/managed-webgl-renderer';

export const AUDIT_SIZE = 512;
/** Intensity that gives unit irradiance at one metre in Three's physical mode. */
export const LIGHT_REFERENCE_INTENSITY = Math.PI;

type AuditToneMapping =
	| typeof NoToneMapping
	| typeof ACESFilmicToneMapping
	| typeof AgXToneMapping
	| typeof NeutralToneMapping;

export type Rgb = readonly [number, number, number];

export type PatchSpec = {
	readonly id: string;
	readonly label: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly srgb: Rgb;
};

const PATCH_SIZE = 72;
const PATCH_GAP = 12;
const PATCH_X = 10;
const PATCH_Y = 10;

const PATCH_VALUES: readonly (readonly [string, string, Rgb])[] = [
	['neutral-mid', 'Neutral 50%', [128, 128, 128]],
	['neutral-dark', 'Neutral 20%', [52, 52, 52]],
	['neutral-light', 'Neutral 86%', [220, 220, 220]],
	['skin-warm', 'Warm skin', [196, 150, 120]],
	['pigment-red', 'Pigment red', [178, 42, 38]],
	['pigment-blue', 'Pigment blue', [40, 72, 158]],
	['pigment-green', 'Pigment green', [58, 118, 68]],
	['textile-dark', 'Dark textile', [42, 38, 52]],
	['paper-warm', 'Warm paper', [228, 214, 186]],
	['pigment-cyan', 'Pigment cyan', [40, 140, 150]],
	['pigment-magenta', 'Pigment magenta', [160, 50, 120]],
	['pigment-yellow', 'Pigment yellow', [220, 190, 60]],
	['near-black', 'Near black', [18, 18, 20]],
	['near-white', 'Near white', [240, 236, 230]],
	['metal-brass', 'Brass', [190, 150, 80]],
	['wood-warm', 'Warm wood', [110, 70, 40]],
	['grey-25', 'Grey 25%', [64, 64, 64]],
	['grey-75', 'Grey 75%', [192, 192, 192]]
];

export const PATCHES: readonly PatchSpec[] = PATCH_VALUES.map(
	([id, label, srgb], index) => ({
		id,
		label,
		x: PATCH_X + (index % 6) * (PATCH_SIZE + PATCH_GAP),
		y: PATCH_Y + Math.floor(index / 6) * (PATCH_SIZE + PATCH_GAP),
		width: PATCH_SIZE,
		height: PATCH_SIZE,
		srgb
	})
);

const MID_TONE_IDS = new Set(PATCHES.map((patch) => patch.id).filter((id) => id !== 'near-black' && id !== 'near-white'));

export const BRIGHTNESS_STOPS: readonly { readonly stop: number; readonly factor: number; readonly label: string }[] = [
	{ stop: -2, factor: 0.25, label: '−2 stops' },
	{ stop: -1, factor: 0.5, label: '−1 stop' },
	{ stop: 0, factor: 1, label: '0 stops' },
	{ stop: 1, factor: 2, label: '+1 stop' },
	{ stop: 2, factor: 4, label: '+2 stops' }
];

export const TONE_MAPPINGS: readonly { readonly key: string; readonly label: string; readonly value: AuditToneMapping }[] = [
	{ key: 'none', label: 'None', value: NoToneMapping },
	{ key: 'aces', label: 'ACES Filmic', value: ACESFilmicToneMapping },
	{ key: 'agx', label: 'AgX', value: AgXToneMapping },
	{ key: 'neutral', label: 'Neutral', value: NeutralToneMapping }
];

export function toneMappingLabel(value: number): string {
	return TONE_MAPPINGS.find((entry) => entry.value === value)?.label ?? `ToneMapping(${value})`;
}

export function createReferenceCanvas(): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = AUDIT_SIZE;
	canvas.height = AUDIT_SIZE;
	const context = canvas.getContext('2d');
	if (context === null) throw new Error('2D canvas is unavailable');

	context.fillStyle = '#101010';
	context.fillRect(0, 0, AUDIT_SIZE, AUDIT_SIZE);

	for (const patch of PATCHES) {
		context.fillStyle = `rgb(${patch.srgb[0]}, ${patch.srgb[1]}, ${patch.srgb[2]})`;
		context.fillRect(patch.x, patch.y, patch.width, patch.height);
	}

	// A 64-step neutral ramp: monotonicity is a cheap clipping/shape check.
	for (let index = 0; index < 64; index += 1) {
		const value = Math.round((index / 63) * 255);
		context.fillStyle = `rgb(${value}, ${value}, ${value})`;
		context.fillRect(16 + index * 7.5, 280, 8, 40);
	}
	// Hue sweep.
	for (let index = 0; index < 64; index += 1) {
		context.fillStyle = `hsl(${(index / 63) * 360} 65% 50%)`;
		context.fillRect(16 + index * 7.5, 336, 8, 40);
	}
	// Warm-to-dark tonal sweep (skin/paper/textile direction).
	for (let index = 0; index < 64; index += 1) {
		const t = index / 63;
		const r = Math.round(235 + (40 - 235) * t);
		const g = Math.round(200 + (25 - 200) * t);
		const b = Math.round(170 + (20 - 170) * t);
		context.fillStyle = `rgb(${r}, ${g}, ${b})`;
		context.fillRect(16 + index * 7.5, 392, 8, 40);
	}
	// Deterministic dark-detail band.
	let seed = 0x51f15e;
	for (let index = 0; index < 64; index += 1) {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		const value = 12 + (seed % 60);
		context.fillStyle = `rgb(${value}, ${value}, ${value})`;
		context.fillRect(16 + index * 7.5, 448, 8, 40);
	}

	return canvas;
}

export function srgbToLinear(channel: number): number {
	const value = Math.min(255, Math.max(0, channel)) / 255;
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(channel: number): number {
	const value = Math.min(1, Math.max(0, channel));
	return 255 * (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055);
}

export function relativeLuminance(rgb: Rgb): number {
	return 0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2]);
}

type Lab = readonly [number, number, number];

export function rgbToLab(rgb: Rgb): Lab {
	const r = srgbToLinear(rgb[0]);
	const g = srgbToLinear(rgb[1]);
	const b = srgbToLinear(rgb[2]);
	const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
	const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
	const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
	const f = (value: number): number => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
	const fx = f(x);
	const fy = f(y);
	const fz = f(z);
	return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000, Sharma et al. implementation. */
export function deltaE00(left: Lab, right: Lab): number {
	const [l1, a1, b1] = left;
	const [l2, a2, b2] = right;
	const c1 = Math.hypot(a1, b1);
	const c2 = Math.hypot(a2, b2);
	const cBar = (c1 + c2) / 2;
	const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
	const a1p = (1 + g) * a1;
	const a2p = (1 + g) * a2;
	const c1p = Math.hypot(a1p, b1);
	const c2p = Math.hypot(a2p, b2);
	const hp = (a: number, b: number, c: number): number => {
		if (c === 0) return 0;
		const degrees = (Math.atan2(b, a) * 180) / Math.PI;
		return degrees < 0 ? degrees + 360 : degrees;
	};
	const h1p = hp(a1p, b1, c1p);
	const h2p = hp(a2p, b2, c2p);
	const deltaLp = l2 - l1;
	const deltaCp = c2p - c1p;
	const deltaHpDegrees =
		c1p * c2p === 0
			? 0
			: h2p - h1p <= 180 && h2p - h1p >= -180
				? h2p - h1p
				: h2p - h1p > 180
					? h2p - h1p - 360
					: h2p - h1p + 360;
	const deltaHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((deltaHpDegrees * Math.PI) / 360);
	const lBar = (l1 + l2) / 2;
	const cBarP = (c1p + c2p) / 2;
	const hBarP =
		c1p * c2p === 0
			? h1p + h2p
			: Math.abs(h1p - h2p) <= 180
				? (h1p + h2p) / 2
				: h1p + h2p < 360
					? (h1p + h2p + 360) / 2
					: (h1p + h2p - 360) / 2;
	const t =
		1 -
		0.17 * Math.cos(((hBarP - 30) * Math.PI) / 180) +
		0.24 * Math.cos((2 * hBarP * Math.PI) / 180) +
		0.32 * Math.cos(((3 * hBarP + 6) * Math.PI) / 180) -
		0.2 * Math.cos(((4 * hBarP - 63) * Math.PI) / 180);
	const deltaTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
	const rc = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7));
	const sl = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2);
	const sc = 1 + 0.045 * cBarP;
	const sh = 1 + 0.015 * cBarP * t;
	const rt = -Math.sin((2 * deltaTheta * Math.PI) / 180) * rc;
	return Math.sqrt(
		(deltaLp / sl) ** 2 +
			(deltaCp / sc) ** 2 +
			(deltaHp / sh) ** 2 +
			rt * (deltaCp / sc) * (deltaHp / sh)
	);
}

export function createAuditRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
	const renderer = createManagedWebGLRenderer(canvas, { stencil: false });
	renderer.setPixelRatio(1);
	renderer.setSize(AUDIT_SIZE, AUDIT_SIZE, false);
	renderer.setClearColor(0x000000, 1);
	renderer.shadowMap.enabled = false;
	return renderer;
}

type Pixels = { readonly pixels: Uint8Array; readonly width: number; readonly height: number };

function readCanvasPixels(renderer: WebGLRenderer): Pixels {
	const size = renderer.getDrawingBufferSize(new Vector2());
	const gl = renderer.getContext();
	const pixels = new Uint8Array(size.x * size.y * 4);
	gl.readPixels(0, 0, size.x, size.y, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
	return { pixels, width: size.x, height: size.y };
}

function samplePixel(source: Pixels, x: number, y: number): Rgb {
	const px = Math.min(source.width - 1, Math.max(0, Math.round(x)));
	const py = Math.min(source.height - 1, Math.max(0, Math.round(y)));
	const row = source.height - 1 - py;
	const offset = (row * source.width + px) * 4;
	return [source.pixels[offset]!, source.pixels[offset + 1]!, source.pixels[offset + 2]!];
}

function samplePatch(source: Pixels, patch: PatchSpec): Rgb {
	const insetX = Math.max(2, Math.floor(patch.width * 0.25));
	const insetY = Math.max(2, Math.floor(patch.height * 0.25));
	let r = 0;
	let g = 0;
	let b = 0;
	let count = 0;
	for (let y = patch.y + insetY; y < patch.y + patch.height - insetY; y += 2) {
		for (let x = patch.x + insetX; x < patch.x + patch.width - insetX; x += 2) {
			const [pr, pg, pb] = samplePixel(source, x, y);
			r += pr;
			g += pg;
			b += pb;
			count += 1;
		}
	}
	return count === 0 ? [0, 0, 0] : [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
}

function patchClipping(source: Pixels, patch: PatchSpec): number {
	const insetX = Math.max(2, Math.floor(patch.width * 0.25));
	const insetY = Math.max(2, Math.floor(patch.height * 0.25));
	let clipped = 0;
	let count = 0;
	for (let y = patch.y + insetY; y < patch.y + patch.height - insetY; y += 2) {
		for (let x = patch.x + insetX; x < patch.x + patch.width - insetX; x += 2) {
			const [r, g, b] = samplePixel(source, x, y);
			if (r <= 1 || g <= 1 || b <= 1 || r >= 254 || g >= 254 || b >= 254) clipped += 1;
			count += 1;
		}
	}
	return count === 0 ? 0 : (clipped / count) * 100;
}

export type PatchResult = {
	readonly id: string;
	readonly label: string;
	readonly source: Rgb;
	readonly rendered: Rgb;
	readonly deltaE00: number;
	readonly clippedPct: number;
};

export type FidelitySummary = {
	readonly meanDeltaE00: number;
	readonly midToneMeanDeltaE00: number;
	readonly maxDeltaE00: number;
	readonly p95DeltaE00: number;
	readonly maxClippedPct: number;
};

export type FidelityVariant = {
	readonly key: string;
	readonly label: string;
	readonly response: 'lit' | 'lit-untonemapped' | 'lambert';
	readonly toneMapping: number;
	readonly exposure: number;
	readonly patches: readonly PatchResult[];
	readonly summary: FidelitySummary;
	readonly greyRampMonotonic: boolean;
	readonly greyRamp: readonly number[];
};

export type Calibration = {
	readonly passed: boolean;
	readonly maxChannelError: number;
	readonly samples: readonly { readonly id: string; readonly source: Rgb; readonly rendered: Rgb }[];
};

export type FidelityResult = {
	readonly calibration: Calibration;
	readonly variants: readonly FidelityVariant[];
	readonly chosen: { readonly key: string; readonly label: string; readonly toneMapping: number; readonly exposure: number };
};

function summarize(patches: readonly PatchResult[]): FidelitySummary {
	const values = patches.map((patch) => patch.deltaE00).sort((a, b) => a - b);
	const midTone = patches.filter((patch) => MID_TONE_IDS.has(patch.id)).map((patch) => patch.deltaE00);
	const p95Index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * 0.95) - 1));
	const mean = (list: readonly number[]): number => (list.length === 0 ? 0 : list.reduce((sum, value) => sum + value, 0) / list.length);
	return {
		meanDeltaE00: mean(values),
		midToneMeanDeltaE00: mean(midTone),
		maxDeltaE00: values.at(-1) ?? 0,
		p95DeltaE00: values[p95Index] ?? 0,
		maxClippedPct: Math.max(0, ...patches.map((patch) => patch.clippedPct))
	};
}

function greyRampValues(source: Pixels): { monotonic: boolean; values: number[] } {
	const values: number[] = [];
	for (let index = 0; index < 16; index += 1) {
		const x = 20 + (index / 15) * 475;
		values.push(relativeLuminance(samplePixel(source, x, 300)));
	}
	const monotonic = values.every((value, index) => index === 0 || value >= values[index - 1]! - 0.002);
	return { monotonic, values };
}

function renderPixels(renderer: WebGLRenderer, scene: Scene, camera: OrthographicCamera): Pixels {
	renderer.render(scene, camera);
	return readCanvasPixels(renderer);
}

export type FidelityFrame = {
	readonly key: string;
	readonly label: string;
	readonly toneMapping: number;
	readonly exposure: number;
	readonly canvas: HTMLCanvasElement;
};

export type ArtworkBench = {
	readonly scene: Scene;
	readonly camera: OrthographicCamera;
	readonly standard: MeshStandardMaterial;
	readonly lambert: MeshLambertMaterial;
	readonly mesh: Mesh;
	readonly texture: Texture;
	readonly dispose: () => void;
};

export function createArtworkBench(sourceCanvas: HTMLCanvasElement): ArtworkBench {
	const texture = new CanvasTexture(sourceCanvas);
	texture.colorSpace = SRGBColorSpace;
	texture.minFilter = NearestFilter;
	texture.magFilter = NearestFilter;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;

	const standard = new MeshStandardMaterial({
		map: texture,
		color: 0xffffff,
		roughness: 1,
		metalness: 0,
		toneMapped: true
	});
	const lambert = new MeshLambertMaterial({ map: texture, color: 0xffffff });
	const geometry = new PlaneGeometry(2, 2);
	const mesh = new Mesh(geometry, standard);
	const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
	camera.position.set(0, 0, 2);
	camera.lookAt(0, 0, 0);

	const light = new DirectionalLight(0xffffff, LIGHT_REFERENCE_INTENSITY);
	light.position.set(0, 0, 1);
	light.target.position.set(0, 0, 0);

	const scene = new Scene();
	scene.background = new Color(0x000000);
	scene.add(light.target, light, mesh);

	return {
		scene,
		camera,
		standard,
		lambert,
		mesh,
		texture,
		dispose: () => {
			standard.dispose();
			lambert.dispose();
			geometry.dispose();
			texture.dispose();
		}
	};
}

export function runFidelity(renderer: WebGLRenderer, sourceCanvas: HTMLCanvasElement, onFrame: (frame: FidelityFrame) => void): FidelityResult {
	const bench = createArtworkBench(sourceCanvas);
	const calibrationMaterial = new MeshBasicMaterial({ map: bench.texture, toneMapped: false });
	const variants: FidelityVariant[] = [];
	renderer.toneMappingExposure = 1;

	try {
		// Calibration: an unlit sRGB texture through the same renderer must return
		// the source bytes (within one rounding step per channel). If it does not,
		// the readback is not trustworthy and every later number is void.
		renderer.toneMapping = NoToneMapping;
		bench.mesh.material = calibrationMaterial;
		const calibrationPixels = renderPixels(renderer, bench.scene, bench.camera);
		const calibrationSamples = PATCHES.map((patch) => ({
			id: patch.id,
			source: patch.srgb,
			rendered: samplePatch(calibrationPixels, patch)
		}));
		const maxChannelError = Math.max(
			...calibrationSamples.flatMap((sample) => [
				Math.abs(sample.source[0] - sample.rendered[0]),
				Math.abs(sample.source[1] - sample.rendered[1]),
				Math.abs(sample.source[2] - sample.rendered[2])
			])
		);
		const calibration: Calibration = {
			passed: maxChannelError <= 2,
			maxChannelError,
			samples: calibrationSamples
		};

		const measure = (
			key: string,
			label: string,
			response: FidelityVariant['response'],
			toneMapping: number,
			exposure: number,
			material: MeshStandardMaterial | MeshLambertMaterial = bench.standard
		): void => {
			renderer.toneMapping = toneMapping as AuditToneMapping;
			renderer.toneMappingExposure = exposure;
			bench.mesh.material = material;
			if (material === bench.standard) {
				bench.standard.toneMapped = response === 'lit';
				bench.standard.needsUpdate = true;
			}
			const pixels = renderPixels(renderer, bench.scene, bench.camera);
			const patches: PatchResult[] = PATCHES.map((patch) => {
				const rendered = samplePatch(pixels, patch);
				return {
					id: patch.id,
					label: patch.label,
					source: patch.srgb,
					rendered,
					deltaE00: deltaE00(rgbToLab(patch.srgb), rgbToLab(rendered)),
					clippedPct: patchClipping(pixels, patch)
				};
			});
			const ramp = greyRampValues(pixels);
			variants.push({
				key,
				label,
				response,
				toneMapping,
				exposure,
				patches,
				summary: summarize(patches),
				greyRampMonotonic: ramp.monotonic,
				greyRamp: ramp.values
			});
			onFrame({ key, label, toneMapping, exposure, canvas: renderer.domElement });
		};

		for (const mapping of TONE_MAPPINGS) {
			measure(`${mapping.key}-lit`, `${mapping.label} · lit`, 'lit', mapping.value, 1);
		}
		// The untonemapped lit row isolates the tone mapper from the material:
		// its result is mapper-independent and shows what "no mapper" means for
		// the standard lit response.
		measure('none-lit-untonemapped', 'None · lit, toneMapped off', 'lit-untonemapped', NoToneMapping, 1);
		// Lambert is the matte, lit response without the standard material's
		// dielectric specular lobe. It tests whether the near-black lift is the
		// light or the PBR specular response.
		measure('lambert-lit', 'Lambert · lit', 'lambert', NoToneMapping, 1, bench.lambert);
		// Exposure is part of the pipeline, not a separate look. Only the mapper
		// that survives the colour test gets a sweep; ACES/AgX keep exposure 1 so
		// the comparison is like-for-like.
		for (const exposure of [0.9, 1.1]) {
			measure(`neutral-exposure-${exposure}`, `Neutral @ ${exposure.toFixed(1)}`, 'lit', NeutralToneMapping, exposure);
		}

		const candidates = variants.filter((variant) => variant.response !== 'lit-untonemapped');
		const chosen = [...candidates].sort((left, right) => left.summary.midToneMeanDeltaE00 - right.summary.midToneMeanDeltaE00)[0]!;
		return {
			calibration,
			variants,
			chosen: {
				key: chosen.key,
				label: chosen.label,
				toneMapping: chosen.toneMapping,
				exposure: chosen.exposure
			}
		};
	} finally {
		calibrationMaterial.dispose();
		bench.dispose();
		renderer.toneMapping = NoToneMapping;
		renderer.toneMappingExposure = 1;
	}
}

export type PipelineCapture = {
	readonly threeRevision: string;
	readonly colorManagement: { readonly enabled: boolean; readonly workingColorSpace: string };
	readonly renderer: {
		readonly outputColorSpace: string;
		readonly toneMapping: number;
		readonly toneMappingLabel: string;
		readonly toneMappingExposure: number;
		readonly shadowMapType: number;
		readonly shadowMapLabel: string;
		readonly pixelRatio: number;
		readonly drawingBufferSize: readonly [number, number];
		readonly drawingBufferColorSpace: string;
	};
	readonly material: { readonly type: string; readonly toneMapped: boolean; readonly mapColorSpace: string };
	readonly target: {
		readonly width: number;
		readonly height: number;
		readonly textureColorSpace: string;
		readonly textureType: number;
		readonly textureFormat: number;
	};
	readonly lights: readonly {
		readonly type: string;
		readonly intensity: number;
		readonly decay: number | null;
		readonly distance: number | null;
		readonly angle: number | null;
		readonly penumbra: number | null;
	}[];
	readonly surfaces: readonly { readonly surface: string; readonly factory: string; readonly overrides: readonly string[] }[];
};

export function capturePipeline(renderer: WebGLRenderer): PipelineCapture {
	const canvas = document.createElement('canvas');
	canvas.width = 2;
	canvas.height = 2;
	const context = canvas.getContext('2d');
	if (context === null) throw new Error('2D canvas is unavailable');
	context.fillStyle = '#808080';
	context.fillRect(0, 0, 2, 2);
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	const material = new MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 });

	const target = new WebGLRenderTarget(640, 360, { type: UnsignedByteType });
	const gl = renderer.getContext() as WebGL2RenderingContext;
	const drawingBufferColorSpace =
		typeof gl.drawingBufferColorSpace === 'string' ? gl.drawingBufferColorSpace : 'unknown';

	const directional = new DirectionalLight(0xffffff, LIGHT_REFERENCE_INTENSITY);
	const point = new PointLight(0xffffff, LIGHT_REFERENCE_INTENSITY, 0, 2);
	const spot = new SpotLight(0xffffff, LIGHT_REFERENCE_INTENSITY, 0, Math.PI / 6, 0, 2);

	const capture: PipelineCapture = {
		threeRevision: REVISION,
		colorManagement: {
			enabled: ColorManagement.enabled,
			workingColorSpace: ColorManagement.workingColorSpace
		},
		renderer: {
			outputColorSpace: renderer.outputColorSpace,
			toneMapping: renderer.toneMapping,
			toneMappingLabel: toneMappingLabel(renderer.toneMapping),
			toneMappingExposure: renderer.toneMappingExposure,
			shadowMapType: renderer.shadowMap.type,
			shadowMapLabel: renderer.shadowMap.type === PCFShadowMap ? 'PCFShadowMap' : String(renderer.shadowMap.type),
			pixelRatio: renderer.getPixelRatio(),
			drawingBufferSize: renderer.getDrawingBufferSize(new Vector2()).toArray() as [number, number],
			drawingBufferColorSpace
		},
		material: {
			type: material.type,
			toneMapped: material.toneMapped,
			mapColorSpace: material.map?.colorSpace ?? ''
		},
		target: {
			width: target.width,
			height: target.height,
			textureColorSpace: target.texture.colorSpace,
			textureType: target.texture.type,
			textureFormat: target.texture.format
		},
		lights: [directional, point, spot].map((light) => ({
			type: light.type,
			intensity: light.intensity,
			decay: 'decay' in light ? light.decay : null,
			distance: 'distance' in light ? light.distance : null,
			angle: 'angle' in light ? light.angle : null,
			penumbra: 'penumbra' in light ? light.penumbra : null
		})),
		surfaces: [
			{ surface: 'Stage', factory: 'createManagedWebGLRenderer + PCFShadowMap', overrides: [] },
			{ surface: 'Visitor Preview', factory: 'createManagedWebGLRenderer + PCFShadowMap', overrides: [] },
			{ surface: 'Published visit', factory: 'createManagedWebGLRenderer + PCFShadowMap', overrides: [] },
			{
				surface: 'Stage snapshot',
				factory: 'WebGLRenderTarget(UnsignedByteType) on the Stage renderer',
				overrides: ['renderer.setClearColor(PAPER_GROUND_INK)', 'camera.layers.set(STAGE_WORLD_LAYER)']
			}
		]
	};

	material.dispose();
	texture.dispose();
	target.dispose();
	return capture;
}

export type LightKind = 'directional' | 'point' | 'spot';

export type LightUnitRow = {
	readonly kind: LightKind;
	readonly stop: number;
	readonly factor: number;
	readonly intensity: number;
	readonly luminance: number;
	readonly ratio: number;
	readonly srgb: Rgb;
};

export type LightUnitsResult = {
	readonly referenceIntensity: number;
	readonly note: string;
	readonly rows: readonly LightUnitRow[];
	readonly postToneMap: { readonly toneMapping: number; readonly label: string; readonly rows: readonly LightUnitRow[] } | null;
	readonly spot: {
		readonly angleRadians: number;
		readonly angleDegrees: number;
		readonly distance: number;
		readonly expectedRadiusMeters: number;
		readonly measuredRadiusMeters: number;
		readonly errorMeters: number;
	};
	readonly range: { readonly limited: number; readonly unlimited: number };
};

type LightBench = {
	readonly scene: Scene;
	readonly camera: OrthographicCamera;
	readonly setLight: (light: DirectionalLight | PointLight | SpotLight) => void;
	readonly dispose: () => void;
};

function createLightBench(): LightBench {
	const material = new MeshLambertMaterial({ color: 0x808080 });
	const geometry = new PlaneGeometry(2, 2);
	const mesh = new Mesh(geometry, material);
	const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
	camera.position.set(0, 0, 2);
	camera.lookAt(0, 0, 0);
	const scene = new Scene();
	scene.background = new Color(0x000000);
	scene.add(mesh);
	const lights = new Group();
	scene.add(lights);
	return {
		scene,
		camera,
		setLight: (light) => {
			lights.clear();
			lights.add(light);
			if ('target' in light) lights.add(light.target);
		},
		dispose: () => {
			material.dispose();
			geometry.dispose();
		}
	};
}

function directional(factor: number): DirectionalLight {
	const light = new DirectionalLight(0xffffff, LIGHT_REFERENCE_INTENSITY * factor);
	light.position.set(0, 0, 1);
	light.target.position.set(0, 0, 0);
	return light;
}

function point(factor: number, distance = 1, range = 0): PointLight {
	const light = new PointLight(0xffffff, LIGHT_REFERENCE_INTENSITY * factor, range, 2);
	light.position.set(0, 0, distance);
	return light;
}

function spot(factor: number, distance = 1, angle = Math.PI / 6, penumbra = 0): SpotLight {
	const light = new SpotLight(0xffffff, LIGHT_REFERENCE_INTENSITY * factor, 0, angle, penumbra, 2);
	light.position.set(0, 0, distance);
	light.target.position.set(0, 0, 0);
	return light;
}

function buildRows(renderer: WebGLRenderer, bench: LightBench, factory: (factor: number) => DirectionalLight | PointLight | SpotLight, kind: LightKind): LightUnitRow[] {
	const rows: Omit<LightUnitRow, 'ratio'>[] = [];
	for (const stop of BRIGHTNESS_STOPS) {
		bench.setLight(factory(stop.factor));
		const pixels = renderPixels(renderer, bench.scene, bench.camera);
		const srgb = samplePixel(pixels, AUDIT_SIZE / 2, AUDIT_SIZE / 2);
		rows.push({
			kind,
			stop: stop.stop,
			factor: stop.factor,
			intensity: LIGHT_REFERENCE_INTENSITY * stop.factor,
			luminance: relativeLuminance(srgb),
			srgb
		});
	}
	const reference = rows.find((row) => row.factor === 1)?.luminance ?? 0;
	return rows.map((row) => ({ ...row, ratio: reference === 0 ? 0 : row.luminance / reference }));
}

function measureSpotRadius(renderer: WebGLRenderer, bench: LightBench): LightUnitsResult['spot'] {
	const angle = Math.PI / 6;
	const distance = 1;
	bench.setLight(spot(1, distance, angle));
	const pixels = renderPixels(renderer, bench.scene, bench.camera);
	const center = samplePixel(pixels, AUDIT_SIZE / 2, AUDIT_SIZE / 2);
	const centerLuma = relativeLuminance(center);
	let radiusPx = 0;
	for (let offset = 0; offset < AUDIT_SIZE / 2; offset += 1) {
		const sample = samplePixel(pixels, AUDIT_SIZE / 2 + offset, AUDIT_SIZE / 2);
		if (relativeLuminance(sample) < centerLuma * 0.5) break;
		radiusPx = offset;
	}
	// The plane is 2 m wide across AUDIT_SIZE pixels.
	const measuredRadiusMeters = (radiusPx / (AUDIT_SIZE / 2)) * 1;
	const expectedRadiusMeters = Math.tan(angle) * distance;
	return {
		angleRadians: angle,
		angleDegrees: (angle * 180) / Math.PI,
		distance,
		expectedRadiusMeters,
		measuredRadiusMeters,
		errorMeters: measuredRadiusMeters - expectedRadiusMeters
	};
}

export function runLightUnits(renderer: WebGLRenderer, chosenToneMapping: number | null): LightUnitsResult {
	const bench = createLightBench();
	renderer.toneMapping = NoToneMapping;
	renderer.toneMappingExposure = 1;
	try {
		const directionalRows = buildRows(renderer, bench, (factor) => directional(factor), 'directional');
		const pointRows = buildRows(renderer, bench, (factor) => point(factor), 'point');
		const spotRows = buildRows(renderer, bench, (factor) => spot(factor), 'spot');
		const rows = [...directionalRows, ...pointRows, ...spotRows];
		const spotResult = measureSpotRadius(renderer, bench);

		bench.setLight(point(1, 3, 2));
		const limited = relativeLuminance(samplePixel(renderPixels(renderer, bench.scene, bench.camera), AUDIT_SIZE / 2, AUDIT_SIZE / 2));
		bench.setLight(point(1, 3, 5));
		const unlimited = relativeLuminance(samplePixel(renderPixels(renderer, bench.scene, bench.camera), AUDIT_SIZE / 2, AUDIT_SIZE / 2));

		let postToneMap: LightUnitsResult['postToneMap'] = null;
		if (chosenToneMapping !== null) {
			renderer.toneMapping = chosenToneMapping as AuditToneMapping;
			postToneMap = {
				toneMapping: chosenToneMapping,
				label: toneMappingLabel(chosenToneMapping),
				rows: buildRows(renderer, bench, (factor) => directional(factor), 'directional')
			};
		}

		return {
			referenceIntensity: LIGHT_REFERENCE_INTENSITY,
			note: 'Lambertian #808080 plane at normal incidence; ratio 1.00 is the factor-1 row. Pre-tone-map luminance is decoded sRGB linear luminance.',
			rows,
			postToneMap,
			spot: spotResult,
			range: { limited, unlimited }
		};
	} finally {
		bench.dispose();
		renderer.toneMapping = NoToneMapping;
		renderer.toneMappingExposure = 1;
	}
}

export type GateAResult = {
	readonly generatedAt: string;
	readonly buildRevision: string;
	readonly readback: {
		readonly method: string;
		readonly width: number;
		readonly height: number;
		readonly calibrationPassed: boolean;
		readonly calibrationMaxChannelError: number;
	};
	readonly pipeline: PipelineCapture;
	readonly fidelity: FidelityResult;
	readonly lightUnits: LightUnitsResult;
};

export function buildGateAResult(pipeline: PipelineCapture, fidelity: FidelityResult, lightUnits: LightUnitsResult): GateAResult {
	return {
		generatedAt: new Date().toISOString(),
		buildRevision: typeof __BISKIQ_BUILD_REVISION__ === 'string' ? __BISKIQ_BUILD_REVISION__ : 'unverified',
		readback: {
			method: 'default-framebuffer readPixels immediately after render()',
			width: AUDIT_SIZE,
			height: AUDIT_SIZE,
			calibrationPassed: fidelity.calibration.passed,
			calibrationMaxChannelError: fidelity.calibration.maxChannelError
		},
		pipeline,
		fidelity,
		lightUnits
	};
}
