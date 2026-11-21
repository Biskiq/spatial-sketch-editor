import { describe, expect, it } from 'vitest';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial, Texture } from 'three/webgpu';
import {
	createFinishChannelMaterial,
	createFinishMaterial,
	missingFinishViews
} from '$lib/render/resources/finish-sampling';
import type {
	StandardFinishPlan,
	StandardMaterialDescriptor
} from '$lib/render/resources/material-descriptor';

function view(): Texture {
	return new Texture();
}

function descriptor(overrides: Partial<StandardFinishPlan> = {}): StandardMaterialDescriptor {
	const plan: StandardFinishPlan = {
		profile: 'pbr-metallic-roughness/v1',
		entries: [
			{
				role: 'color',
				view: 'colour',
				uvSet: 0,
				origin: 'legacy',
				repeat: [1, 1],
				rotation: 0,
				offset: [0, 0]
			}
		],
		occlusionStrength: 1,
		normalScale: 1,
		...overrides
	};
	return { kind: 'standard', color: '#c4b4a0', roughness: 0.6, metalness: 0.1, finish: plan };
}

describe('the sampled material graph', () => {
	it('builds a standard node material with a colour node for the plan', () => {
		const material = createFinishMaterial(descriptor(), { colour: view() });
		expect(material).toBeInstanceOf(MeshStandardNodeMaterial);
		expect(material.colorNode).toBeDefined();
		expect(material.map).toBeNull();
		material.dispose();
	});

	it('names every view a plan requires and refuses a missing one', () => {
		const planned = descriptor({
			entries: [
				...descriptor().finish!.entries,
				{
					role: 'roughness',
					view: 'rough',
					uvSet: 0,
					origin: 'legacy',
					repeat: [1, 1],
					rotation: 0,
					offset: [0, 0],
					component: 'g',
					invert: false
				}
			]
		});
		expect(missingFinishViews(planned, { colour: view() })).toEqual(['rough']);
		expect(() => createFinishMaterial(planned, { colour: view() })).toThrow(/rough/);
	});

	it('builds an unlit channel material for one role', () => {
		const material = createFinishChannelMaterial(descriptor(), { colour: view() }, 'unlit-color');
		expect(material).toBeInstanceOf(MeshBasicNodeMaterial);
		expect(material.colorNode).toBeDefined();
		material.dispose();
	});
});
