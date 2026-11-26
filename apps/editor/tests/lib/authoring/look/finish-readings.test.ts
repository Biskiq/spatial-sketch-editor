import { describe, expect, it } from 'vitest';
import type { MaterialId, SceneMaterialInstance } from '@portfolio/project-model/scene';
import { getMaterial } from '$lib/content/materials';
import {
	colourKeyResolves,
	finishColour,
	finishDefinition,
	finishKeyResolves,
	finishLabel,
	finishTextureId,
	paintColourLabel,
	readFinishPalette
} from '$lib/authoring/look/finish-readings';

type SceneNow = Parameters<typeof finishLabel>[0];

const oak = 'wood-oak-veneer' as MaterialId;
const curatedKey = `curated:${oak}`;

/** A Scene read as the Finish projections see it; only the fields a test names. */
function scene(overrides: Record<string, unknown> = {}): SceneNow {
	return { materials: [], palette: [], ...overrides } as unknown as SceneNow;
}

function instance(overrides: Record<string, unknown>): SceneMaterialInstance {
	return overrides as unknown as SceneMaterialInstance;
}

describe('Finish read projections', () => {
	it('labels a curated material, a project Finish and the model’s own Finish', () => {
		expect(finishLabel(scene(), curatedKey)).toBe(getMaterial(oak).label);
		expect(finishLabel(scene({ materials: [{ id: 'finish-1', name: 'Gallery white' }] }), 'project:finish-1')).toBe(
			'Gallery white'
		);
		expect(finishLabel(scene(), 'project:missing')).toBe('Finish');
		expect(finishLabel(scene(), 'model-own')).toBe("Model's own");
	});

	it('reads a curated colour from the catalogue and keeps the neutral fallback', () => {
		const material = getMaterial(oak);
		expect(finishColour(scene(), curatedKey)).toBe(material.swatchColor ?? material.fallbackColor);
		expect(finishColour(null, curatedKey)).toBe('#c4b4a0');
		expect(finishColour(scene(), 'model-own')).toBe('#c4b4a0');
	});

	it('reads a project Finish colour from its literal, its slot or its catalogue base', () => {
		const current = scene({
			palette: [{ id: 'sage', name: 'Sage', color: '#7a8a70' }],
			materials: [
				{ id: 'literal', overrides: { color: '#224466' } },
				{ id: 'slot', overrides: { color: { slot: 'sage' } } },
				{ id: 'inherited', base: { catalogue: oak } }
			]
		});
		expect(finishColour(current, 'project:literal')).toBe('#224466');
		expect(finishColour(current, 'project:slot')).toBe('#7a8a70');
		const material = getMaterial(oak);
		expect(finishColour(current, 'project:inherited')).toBe(material.swatchColor ?? material.fallbackColor);
		expect(finishColour(current, 'project:missing')).toBe('#c4b4a0');
	});

	it('resolves only the Finish and colour keys this project can paint', () => {
		expect(finishKeyResolves(null, curatedKey)).toBe(true);
		expect(finishKeyResolves(scene({ materials: [{ id: 'finish-1' }] }), 'project:finish-1')).toBe(true);
		expect(finishKeyResolves(scene(), 'project:finish-1')).toBe(false);
		expect(finishKeyResolves(null, 'model-own')).toBe(false);

		expect(colourKeyResolves(null, '#336699')).toBe(true);
		expect(colourKeyResolves(scene(), 'slot:sage')).toBe(false);
		expect(colourKeyResolves(scene({ palette: [{ id: 'sage', name: 'Sage', color: '#7a8a70' }] }), 'slot:sage')).toBe(
			true
		);
	});

	it('reads the palette with the material count that uses each slot', () => {
		const view = readFinishPalette(
			scene({
				palette: [{ id: 'sage', name: 'Sage', color: '#7a8a70' }],
				materials: [
					{ id: 'a', overrides: { color: { slot: 'sage' } } },
					{ id: 'b', overrides: { color: { slot: 'sage' } } },
					{ id: 'c', overrides: { color: '#000000' } }
				]
			})
		);
		expect(view.room).toBe(true);
		expect(view.slots).toEqual([{ id: 'sage', name: 'Sage', color: '#7a8a70', users: 2 }]);
		expect(readFinishPalette(null)).toEqual({ room: true, slots: [] });
	});

	it('reads only an immutable definition a resource-backed instance names', () => {
		expect(finishDefinition(null, undefined)).toBeNull();
		expect(finishDefinition(null, instance({ base: { catalogue: oak } }))).toBeNull();
	});

	it('takes a texture id from the override first and never from a cleared map', () => {
		expect(finishTextureId(null, undefined, 'color')).toBeNull();
		expect(
			finishTextureId(null, instance({ overrides: { maps: { color: { image: { textureId: 'tex-1' } } } } }), 'color')
		).toBe('tex-1');
		expect(finishTextureId(null, instance({ overrides: { maps: { color: null } } }), 'color')).toBeNull();
	});

	it('labels a literal colour and a palette slot through the palette', () => {
		expect(paintColourLabel(null, { kind: 'literal', hex: '#336699' })).toBe('#336699');
		expect(
			paintColourLabel(scene({ palette: [{ id: 'sage', name: 'Sage', color: '#7a8a70' }] }), {
				kind: 'slot',
				slotId: 'sage'
			})
		).toBe('Sage');
		expect(paintColourLabel(scene(), { kind: 'slot', slotId: 'missing' })).toBe('Colour');
	});
});
