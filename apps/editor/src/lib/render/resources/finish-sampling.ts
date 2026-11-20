/**
 * The one sampled metallic–roughness builder.
 *
 * A `StandardMaterialDescriptor` with a `finish` plan becomes a
 * `MeshStandardNodeMaterial`; every other descriptor keeps the stock constructor
 * in `material-store.ts`. The graph here reads only descriptor values, the GPU
 * views supplied beside the descriptor and Three/TSL, so an acquired view can
 * never smuggle authored truth into a material.
 *
 * ## What the graph owns
 *
 * - **UV affine.** Three's `setUvTransform` semantics with pivot (½, ½): centre,
 *   rotate by −rotation, scale each axis by its positive repeat, then offset.
 *   The transform feeds the sample only; the uploaded bitmap never moves, so a
 *   rotated map costs no second texture.
 * - **One origin conversion.** Uploads are top-first. A `legacy` plan entry
 *   reads row `1−v` at the sample boundary; a `gltf` entry reads row `v`.
 * - **Channel conversion.** A scalar role selects one component and optionally
 *   inverts it; a normal role unpacks `[0,1]` to `[−1,1]`, applies exactly one
 *   Y sign and the normal strength, then builds a view-space frame.
 * - **ORM sharing.** Three roles that name the same view and transform build
 *   three sample expressions over one uploaded bitmap.
 *
 * The stock `map`/`roughnessMap`/... inputs stay empty: setting either would
 * multiply or decode a second time. `colorNode`, `roughnessNode`,
 * `metalnessNode`, `aoNode` and `normalNode` carry the whole plan.
 */
import {
	MeshBasicNodeMaterial,
	MeshStandardNodeMaterial,
	type Texture
} from 'three/webgpu';
import {
	bitangentView,
	color,
	cross,
	dFdx,
	dFdy,
	float,
	normalView,
	normalize,
	positionView,
	select,
	tangentView,
	texture,
	uv,
	vec2,
	vec3
} from 'three/tsl';
import type {
	FinishMapRole,
	FinishSamplingPlanEntry,
	StandardFinishPlan,
	StandardMaterialDescriptor
} from './material-descriptor';

/** The views a plan's entries name, by view key. */
export type FinishTextureViews = Readonly<Record<string, Texture>>;

// TSL's fluent node type is intentionally broad; the graph is composed at runtime
// and the descriptor/vendor types are checked at the boundary above it.
type TslNode = any;

/**
 * Check that every view a plan names was supplied. A missing view is a caller
 * bug, not a silent untextured surface: the material key would otherwise claim a
 * sample it cannot draw.
 */
export function missingFinishViews(
	descriptor: StandardMaterialDescriptor,
	views: FinishTextureViews | undefined
): string[] {
	const plan = descriptor.finish;
	if (plan === undefined) return [];
	const missing = new Set<string>();
	for (const entry of plan.entries) {
		if (views?.[entry.view] === undefined) missing.add(entry.view);
	}
	return [...missing].sort();
}

/** The transformed, origin-adjusted sample coordinate for one entry. */
function sampleUv(entry: FinishSamplingPlanEntry): TslNode {
	const raw = uv(entry.uvSet);
	const cos = Math.cos(entry.rotation);
	const sin = Math.sin(entry.rotation);
	const repeat = entry.repeat;
	const offset = entry.offset;
	// Three's `setUvTransform`: subtract the pivot, rotate by −rotation, scale each
	// axis independently, then add the pivot and the offset. Repeat is positive.
	const centred = raw.sub(vec2(0.5, 0.5));
	const rotatedX = centred.x.mul(cos).add(centred.y.mul(sin));
	const rotatedY = centred.x.mul(-sin).add(centred.y.mul(cos));
	const transformed = vec2(
		rotatedX.mul(repeat[0]).add(0.5 + offset[0]),
		rotatedY.mul(repeat[1]).add(0.5 + offset[1])
	);
	return entry.origin === 'legacy' ? vec2(transformed.x, transformed.y.oneMinus()) : transformed;
}

/** The transformed UV before the storage-row conversion; a normal frame uses it. */
function frameUv(entry: FinishSamplingPlanEntry): TslNode {
	const raw = uv(entry.uvSet);
	const cos = Math.cos(entry.rotation);
	const sin = Math.sin(entry.rotation);
	const centred = raw.sub(vec2(0.5, 0.5));
	const rotatedX = centred.x.mul(cos).add(centred.y.mul(sin));
	const rotatedY = centred.x.mul(-sin).add(centred.y.mul(cos));
	return vec2(
		rotatedX.mul(entry.repeat[0]).add(0.5 + entry.offset[0]),
		rotatedY.mul(entry.repeat[1]).add(0.5 + entry.offset[1])
	);
}

function componentOf(sample: TslNode, component: FinishSamplingPlanEntry['component']): TslNode {
	switch (component) {
		case 'r':
			return sample.r;
		case 'g':
			return sample.g;
		case 'b':
			return sample.b;
		case 'a':
			return sample.a;
		default:
			return sample.r;
	}
}

/** One texture fetch per identical view + UV set + origin + affine transform. */
type SampleCache = Map<string, TslNode>;

function sampleKey(entry: FinishSamplingPlanEntry): string {
	return [
		entry.view,
		entry.uvSet,
		entry.origin,
		entry.repeat.join(','),
		entry.rotation,
		entry.offset.join(',')
	].join('|');
}

function rawSample(entry: FinishSamplingPlanEntry, view: Texture, cache?: SampleCache): TslNode {
	if (cache === undefined) return texture(view, sampleUv(entry));
	const key = sampleKey(entry);
	const existing = cache.get(key);
	if (existing !== undefined) return existing;
	const created = texture(view, sampleUv(entry));
	cache.set(key, created);
	return created;
}

/** Convert one fetched texel to the role's value, before its descriptor factor. */
function convertSample(entry: FinishSamplingPlanEntry, sample: TslNode): TslNode {
	if (entry.role === 'color') return sample.rgb;
	if (entry.role === 'normal') {
		const unpacked = sample.rgb.mul(2).sub(1);
		const y = entry.convention === '-Y' ? unpacked.y.mul(-1) : unpacked.y;
		return vec3(unpacked.x, y, unpacked.z);
	}
	const value = componentOf(sample, entry.component);
	return entry.invert === true ? value.oneMinus() : value;
}

/**
 * One role's sample expression. The returned value is the **converted** sample
 * before its factor: a scalar in [0,1], a linear RGB colour, or a normalized
 * tangent-space normal with the selected Y convention.
 *
 * The optional cache shares one texture fetch across roles (packed ORM) when
 * they name the same view, UV set, origin and affine transform.
 */
export function finishSampleNode(
	entry: FinishSamplingPlanEntry,
	view: Texture,
	cache?: SampleCache
): TslNode {
	return convertSample(entry, rawSample(entry, view, cache));
}

/** A safe normalize: a degenerate frame returns the geometric normal, never NaN. */
function safeNormalize(node: TslNode): TslNode {
	return node.div(node.length().max(1e-8));
}

/**
 * The view-space normal for one normal entry.
 *
 * The frame is derived from view-position and **transformed** UV derivatives
 * before the storage-row conversion, as the plan requires. That makes explicit
 * UV1, a rotated mapping and a mirrored island all use the frame they are
 * actually sampled with. A singular frame (zero UV edge area) falls back to the
 * geometric normal for that fragment instead of producing a NaN.
 */
function normalNodeFor(
	entry: FinishSamplingPlanEntry,
	view: Texture,
	normalScale: number,
	cache?: SampleCache
): TslNode {
	const sampled = finishSampleNode(entry, view, cache);
	const strength = float(normalScale);
	const scaled = vec3(sampled.x.mul(strength), sampled.y.mul(strength), sampled.z);
	const geometric = safeNormalize(normalView);

	// A default, untransformed UV0 chart uses the mesh's own tangent and
	// handedness. That is the authored frame and stays stable at any camera
	// distance. Transformed UVs, UV1 and meshes without tangents fall back to
	// view-derivative frames below.
	const identityUv0 =
		entry.uvSet === 0 &&
		entry.rotation === 0 &&
		entry.repeat[0] === 1 &&
		entry.repeat[1] === 1 &&
		entry.offset[0] === 0 &&
		entry.offset[1] === 0;
	if (identityUv0) {
		const meshTangent: TslNode = tangentView;
		const meshBitangent: TslNode = bitangentView;
		const meshMapped = safeNormalize(
			meshTangent.mul(scaled.x).add(meshBitangent.mul(scaled.y)).add(geometric.mul(scaled.z))
		);
		// A zero-length tangent is the one degenerate mesh case; keep the
		// geometric normal there instead of normalizing zero.
		return (select as TslNode)(tangentView.length().greaterThan(1e-6), meshMapped, geometric);
	}

	// `entry.repeat` is applied by `sampleUv`; the frame uses the transformed UV
	// so the tangent basis follows the same axes as the sampled image.
	const frame: TslNode = frameUv(entry);
	const dpdx: TslNode = dFdx(positionView);
	const dpdy: TslNode = dFdy(positionView);
	const duvdx: TslNode = dFdx(frame);
	const duvdy: TslNode = dFdy(frame);
	const tangent = safeNormalize(
		cross(dpdy, geometric).mul(duvdx.x).add(cross(geometric, dpdx).mul(duvdy.x))
	);
	const bitangent = safeNormalize(
		cross(dpdy, geometric).mul(duvdx.y).add(cross(geometric, dpdx).mul(duvdy.y))
	);
	const determinant = duvdx.x.mul(duvdy.y).sub(duvdy.x.mul(duvdx.y));
	const mapped = safeNormalize(
		tangent.mul(scaled.x).add(bitangent.mul(scaled.y)).add(geometric.mul(scaled.z))
	);
	// Singularity is relative to the UV edge lengths, not an absolute
	// screen-space area: a small but valid repeat (e.g. a 1 cm tile viewed from
	// far away) must not silently lose its normal map. The E0 predicate uses the
	// same `1e-6 × |du/dx| × |du/dy|` bound.
	const singular = duvdx.length().mul(duvdy.length()).mul(1e-6);
	// The chosen image convention already flipped `sampled.y`; the frame is in the
	// authored, transformed UV basis, so no second Y sign is applied here.
	return (select as TslNode)(determinant.abs().greaterThan(singular), mapped, geometric);
}

function entryFor(
	plan: StandardFinishPlan,
	role: FinishMapRole
): FinishSamplingPlanEntry | undefined {
	return plan.entries.find((entry) => entry.role === role);
}

/**
 * Build the sampled standard material.
 *
 * The constructor still receives the descriptor's scalar factors, so an
 * unshaded/default branch stays correct; the node expressions multiply the same
 * factors on top of the converted sample. The caller (the store) owns clipping,
 * cut masks and disposal.
 */
export function createFinishMaterial(
	descriptor: StandardMaterialDescriptor,
	views: FinishTextureViews
): MeshStandardNodeMaterial {
	const plan = descriptor.finish;
	if (plan === undefined) throw new Error('createFinishMaterial needs a finish plan');
	const missing = missingFinishViews(descriptor, views);
	if (missing.length > 0) {
		throw new Error(`finish material is missing view(s): ${missing.join(', ')}`);
	}
	const material = new MeshStandardNodeMaterial({
		color: descriptor.color,
		roughness: descriptor.roughness,
		metalness: descriptor.metalness,
		...(descriptor.emissive === undefined ? {} : { emissive: descriptor.emissive }),
		...(descriptor.emissiveIntensity === undefined
			? {}
			: { emissiveIntensity: descriptor.emissiveIntensity }),
		...(descriptor.toneMapped === undefined ? {} : { toneMapped: descriptor.toneMapped }),
		...(descriptor.wireframe === undefined ? {} : { wireframe: descriptor.wireframe }),
		...(descriptor.polygonOffset === undefined
			? {}
			: {
					polygonOffset: true,
					polygonOffsetFactor: descriptor.polygonOffset[0],
					polygonOffsetUnits: descriptor.polygonOffset[1]
				})
	});

	const samples: SampleCache = new Map();
	const colorEntry = entryFor(plan, 'color');
	if (colorEntry !== undefined) {
		// `colorNode` replaces `material.color`; multiply the resolved tint here so
		// a creator's literal or palette follower still applies exactly once.
		material.colorNode = color(descriptor.color).mul(
			finishSampleNode(colorEntry, views[colorEntry.view]!, samples)
		);
	}
	const roughnessEntry = entryFor(plan, 'roughness');
	if (roughnessEntry !== undefined) {
		material.roughnessNode = float(descriptor.roughness).mul(
			finishSampleNode(roughnessEntry, views[roughnessEntry.view]!, samples)
		);
	}
	const metalnessEntry = entryFor(plan, 'metalness');
	if (metalnessEntry !== undefined) {
		material.metalnessNode = float(descriptor.metalness).mul(
			finishSampleNode(metalnessEntry, views[metalnessEntry.view]!, samples)
		);
	}
	const occlusionEntry = entryFor(plan, 'occlusion');
	if (occlusionEntry !== undefined) {
		const sample = finishSampleNode(occlusionEntry, views[occlusionEntry.view]!, samples);
		material.aoNode = float(1).add(float(plan.occlusionStrength).mul(sample.sub(1)));
	}
	const normalEntry = entryFor(plan, 'normal');
	if (normalEntry !== undefined) {
		material.normalNode = normalNodeFor(
			normalEntry,
			views[normalEntry.view]!,
			plan.normalScale,
			samples
		);
	}
	return material;
}

/**
 * A linear channel material for inspection.
 *
 * `unlit-color` shows the untreated resolved tint multiplied by the colour
 * sample. `{ solo }` shows exactly one converted role sample before its factor:
 * a scalar as neutral grey, a normal as tangent XYZ remapped to RGB. The output
 * is linear; display encoding belongs to the readback writer, never the graph.
 */
export function createFinishChannelMaterial(
	descriptor: StandardMaterialDescriptor,
	views: FinishTextureViews,
	display: 'unlit-color' | { readonly solo: FinishMapRole }
): MeshBasicNodeMaterial {
	const material = new MeshBasicNodeMaterial({ toneMapped: false });
	const plan = descriptor.finish;
	if (display === 'unlit-color') {
		const entry = plan === undefined ? undefined : entryFor(plan, 'color');
		const tint = color(descriptor.color);
		material.colorNode =
			entry === undefined || views[entry.view] === undefined
				? tint
				: tint.mul(finishSampleNode(entry, views[entry.view]!));
		return material;
	}
	const role = display.solo;
	const entry = plan === undefined ? undefined : entryFor(plan, role);
	if (entry === undefined || views[entry.view] === undefined) {
		const constant = role === 'color' ? color(descriptor.color) : role === 'normal' ? vec3(0.5, 0.5, 1) : float(1);
		material.colorNode = role === 'color' ? constant : (vec3 as TslNode)(constant);
		return material;
	}
	const sample = finishSampleNode(entry, views[entry.view]!);
	material.colorNode =
		role === 'color'
			? sample
			: role === 'normal'
				? sample.mul(0.5).add(0.5)
				: (vec3 as TslNode)(sample);
	return material;
}
