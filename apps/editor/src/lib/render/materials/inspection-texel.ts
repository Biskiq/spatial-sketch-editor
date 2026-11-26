/**
 * The per-texel channel report (E7).
 *
 * For one UV it states, per role, the stored normalized value, the value after
 * component/invert/convention, and the effective value after the Finish's
 * factor. The two sampled values come from the **same graph builder** the lit
 * material uses (`createFinishChannelMaterial`), drawn as a constant-UV
 * fragment into a linear half-float target; display encoding never takes part.
 */
import {
	BufferAttribute,
	Color,
	DataUtils,
	HalfFloatType,
	LinearSRGBColorSpace,
	Mesh,
	OrthographicCamera,
	PlaneGeometry,
	RenderTarget,
	Scene,
	type Material,
} from 'three';
import type { BoundInputs, FieldProvenance } from '@portfolio/project-model/materials';
import type {
	FinishMapRole,
	FinishSamplingPlanEntry,
	StandardMaterialDescriptor,
} from '$lib/render/resources/material-descriptor';
import {
	createFinishChannelMaterial,
	type FinishTextureViews,
} from '$lib/render/resources/finish-sampling';
import { settledOrAborted, type InspectionRenderer } from './inspection';

export type InspectionTexelChannel = {
	readonly role: FinishMapRole;
	readonly state: 'bound' | 'missing-view' | 'constant';
	readonly provenance: FieldProvenance;
	/** The stored normalized value (linear for colour); null when nothing is sampled. */
	readonly source: readonly number[] | null;
	/** After component/invert/convention, before the factor; null when nothing is sampled. */
	readonly converted: readonly number[] | null;
	/** Colour × tint, factor × value, the AO contribution, or the signed unit normal. */
	readonly effective: readonly number[];
};

const ROLES: readonly FinishMapRole[] = ['color', 'normal', 'roughness', 'metalness', 'occlusion'];

/** One linear fragment of `material` at a constant UV. */
async function readFragment(
	input: InspectionRenderer,
	material: Material,
	uv: readonly [number, number],
	signal: AbortSignal,
): Promise<readonly number[] | null> {
	const geometry = new PlaneGeometry(2, 2);
	const coordinates = new Float32Array([...uv, ...uv, ...uv, ...uv]);
	geometry.setAttribute('uv', new BufferAttribute(coordinates, 2));
	const scene = new Scene();
	scene.add(new Mesh(geometry, material));
	const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 2);
	camera.position.z = 1;
	const target = new RenderTarget(1, 1, {
		type: HalfFloatType,
		colorSpace: LinearSRGBColorSpace,
		samples: 0,
		depthBuffer: false,
	});
	// See `renderInspectionFrame`: the two backends differ only in TypeScript.
	const renderer = input as any;
	const previousTarget = renderer.getRenderTarget();
	try {
		let copy: Promise<ArrayLike<number>>;
		try {
			renderer.setRenderTarget(target);
			renderer.render(scene, camera);
			copy = renderer.readRenderTargetPixelsAsync(target, 0, 0, 1, 1);
		} finally {
			renderer.setRenderTarget(previousTarget);
		}
		const raw = await settledOrAborted(copy, signal);
		if (raw === null) return null;
		const half = raw instanceof Uint16Array;
		const value = (index: number): number =>
			half ? DataUtils.fromHalfFloat(raw[index]!) : Number(raw[index]);
		// The fragment is opaque, so a transparent one is a lost device's empty read.
		if (!(value(3) >= 0.5)) throw new Error('The texel read back empty.');
		return [0, 1, 2].map(value);
	} finally {
		target.dispose();
		geometry.dispose();
	}
}

/** What a role contributes once its factor is applied; `sample` is null for a constant. */
export function effectiveTexelValue(
	role: FinishMapRole,
	descriptor: StandardMaterialDescriptor,
	inputs: BoundInputs,
	sample: readonly number[] | null,
): readonly number[] {
	switch (role) {
		case 'color': {
			const tint = new Color(descriptor.color);
			return [tint.r, tint.g, tint.b].map((value, index) => value * (sample?.[index] ?? 1));
		}
		case 'normal': {
			if (sample === null) return [0, 0, 1];
			const x = sample[0]! * inputs.normalScale;
			const y = sample[1]! * inputs.normalScale;
			const z = sample[2]!;
			const length = Math.hypot(x, y, z);
			return length < 1e-8 ? [0, 0, 1] : [x / length, y / length, z / length];
		}
		case 'roughness':
			return [inputs.roughness * (sample?.[0] ?? 1)];
		case 'metalness':
			return [inputs.metalness * (sample?.[0] ?? 1)];
		case 'occlusion':
			return [sample === null ? 1 : 1 + inputs.occlusionStrength * (sample[0]! - 1)];
	}
}

export async function readInspectionTexel(input: {
	readonly renderer: InspectionRenderer;
	readonly descriptor: StandardMaterialDescriptor;
	readonly inputs: BoundInputs;
	readonly views: FinishTextureViews;
	readonly uv: readonly [number, number];
	readonly signal: AbortSignal;
}): Promise<readonly InspectionTexelChannel[] | null> {
	const { descriptor, inputs, views } = input;

	async function sampled(entry: FinishSamplingPlanEntry): Promise<readonly number[] | null> {
		const material = createFinishChannelMaterial(
			{ ...descriptor, finish: { ...descriptor.finish!, entries: [entry] } },
			views,
			{ solo: entry.role },
		);
		try {
			const value = await readFragment(input.renderer, material, input.uv, input.signal);
			if (value === null) return null;
			return entry.role === 'color' || entry.role === 'normal' ? value : [value[0]!];
		} finally {
			material.dispose();
		}
	}

	const channels: InspectionTexelChannel[] = [];
	for (const role of ROLES) {
		const provenance = inputs.provenance.maps[role];
		const entry = descriptor.finish?.entries.find((candidate) => candidate.role === role);
		if (entry === undefined || views[entry.view] === undefined) {
			channels.push({
				role,
				state: inputs.maps[role] === undefined ? 'constant' : 'missing-view',
				provenance,
				source: null,
				converted: null,
				effective: effectiveTexelValue(role, descriptor, inputs, null),
			});
			continue;
		}
		// The unconverted draw is the stored value; a normal's display remap is its
		// exact inverse of the unpack, so it reads back the stored RGB.
		const source = await sampled({ ...entry, invert: false, convention: '+Y' });
		if (source === null) return null;
		const displayed = await sampled(entry);
		if (displayed === null) return null;
		const converted = role === 'normal' ? displayed.map((value) => value * 2 - 1) : displayed;
		channels.push({
			role,
			state: 'bound',
			provenance,
			source,
			converted,
			effective: effectiveTexelValue(role, descriptor, inputs, converted),
		});
	}
	return channels;
}
