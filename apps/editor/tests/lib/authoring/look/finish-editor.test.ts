import { describe, expect, it } from 'vitest';
import {
	buildFinishEditorFields,
	editorColourModeEdits,
	editorColourValueEdits,
	editorMapToggleEdits,
	editorMappingKindEdits,
	editorMetalEdits,
	editorPatternEdits,
	editorReliefEdits,
	editorResetAllEdits,
	editorResetGroupEdits,
	editorSheenEdits,
	mapEditorRefusal,
	mergeDraftEdits
} from '$lib/authoring/look/finish-editor.svelte';
import { materialTreatmentFacts } from '$lib/content/material-presentation';
import { getMaterial, materialById } from '$lib/content/materials';
import type { MaterialId } from '@portfolio/project-model';

const facts = materialTreatmentFacts((id: MaterialId) => (materialById.has(id) ? getMaterial(id).label : id));
const emptyRecipes = new Map();

describe('Material editor facet (T2.S8 U6)', () => {
	it('projects pristine curated Finish with zero changes and ORM grouped into one row', () => {
		const fields = buildFinishEditorFields({
			source: { base: { catalogue: 'wood-oak-veneer' } },
			recipes: emptyRecipes,
			palette: [{ id: 'sage', name: 'Sage', color: '#7a8a70' }],
			entityKind: null,
			facts,
			materialLabel: 'Oak Veneer',
			curated: true
		});
		expect(fields.changeCount).toBe(0);
		expect(fields.changedGroups).toEqual([]);
		expect(fields.colour.mode).toBe('natural');
		expect(fields.colour.modes).toEqual(['natural', 'stained', 'painted']);
		expect(fields.relief.disabled).toBe(false);
		expect(fields.mapping.isModel).toBe(false);

		const ormRow = fields.raw.rows.find((r) => r.id === 'orm');
		expect(ormRow).toBeDefined();
		expect(ormRow!.roles).toContain('roughness');
		expect(ormRow!.roles).toContain('occlusion');
		// Toggling ORM emits one patch touching every role the image serves
		const disableOrm = editorMapToggleEdits(ormRow!.roles, false);
		expect(disableOrm.length).toBe(ormRow!.roles.length);
		expect(disableOrm.every((e) => e.op === 'disable')).toBe(true);
	});

	it('emits exact E4 patches for each field group and counts changes against baseRecipeOf', () => {
		const source = {
			base: { catalogue: 'wood-oak-veneer' as const },
			overrides: {
				roughness: 0.4,
				metalness: 0.25,
				normalScale: 1.5,
				color: '#224466' as const
			}
		};
		const fields = buildFinishEditorFields({
			source,
			recipes: emptyRecipes,
			palette: [],
			entityKind: 'model',
			facts,
			materialLabel: 'Oak Veneer',
			curated: false
		});
		expect(fields.sheen.changed).toBe(true);
		expect(fields.metal.changed).toBe(true);
		expect(fields.relief.changed).toBe(true);
		expect(fields.colour.changed).toBe(true);
		expect(fields.changeCount).toBe(4);
		expect(fields.mapping.isModel).toBe(true);

		expect(editorSheenEdits({ base: { catalogue: 'wood-oak-veneer' } }, emptyRecipes, facts, 0.7)).toEqual([
			expect.objectContaining({ field: 'roughness', op: 'set' })
		]);
		expect(editorMetalEdits({ base: { catalogue: 'wood-oak-veneer' } }, emptyRecipes, 0.5)).toEqual([
			{ field: 'metalness', op: 'set', value: 0.5 }
		]);
		expect(editorReliefEdits({ base: { catalogue: 'wood-oak-veneer' } }, emptyRecipes, 1.4)).toEqual([
			{ field: 'normalScale', op: 'set', value: 1.4 }
		]);
		expect(
			editorColourModeEdits({ base: { catalogue: 'wood-oak-veneer' } }, emptyRecipes, [{ id: 's1', name: 'Sage', color: '#7a8a70' }], 'stained')
		).toEqual([{ field: 'color', op: 'set', value: { slot: 's1' } }]);
		expect(
			editorColourValueEdits({ base: { catalogue: 'wood-oak-veneer' } }, emptyRecipes, facts, '#334455')
		).toEqual([{ field: 'color', op: 'set', value: '#334455' }]);
		expect(
			editorPatternEdits({ base: { catalogue: 'wood-oak-veneer' } }, emptyRecipes, { tileMeters: 0.6, angleDeg: 90 })
		).toEqual([
			expect.objectContaining({
				field: 'mapping',
				op: 'set',
				value: expect.objectContaining({
					metric: expect.objectContaining({ tileMeters: [0.6, 0.6] })
				})
			})
		]);
		expect(editorMappingKindEdits({ base: { catalogue: 'wood-oak-veneer' } }, emptyRecipes, 'uv1')).toEqual([
			expect.objectContaining({
				field: 'mapping',
				op: 'set',
				value: expect.objectContaining({ kind: 'uv', set: 1 })
			})
		]);

		// Reset single group vs reset all
		expect(editorResetGroupEdits(source, emptyRecipes, 'metal', fields.raw.rows)).toEqual([
			{ field: 'metalness', op: 'reset' }
		]);
		const resetAll = editorResetAllEdits(source);
		expect(resetAll.length).toBe(4);
		expect(resetAll.every((e) => e.op === 'reset')).toBe(true);
	});

	it('disables Relief when normal map is off and maps E4 refusal codes to copy', () => {
		const fields = buildFinishEditorFields({
			source: {
				base: { catalogue: 'wood-oak-veneer' },
				overrides: { maps: { normal: null } }
			},
			recipes: emptyRecipes,
			palette: [],
			entityKind: null,
			facts,
			materialLabel: 'Oak Veneer',
			curated: false
		});
		expect(fields.relief.disabled).toBe(true);
		expect(fields.relief.readout).toBe('map off');
		expect(mapEditorRefusal('normal-control-without-normal', 'fallback')).toBe('Relief needs its map');
		expect(mapEditorRefusal('mapping-requires-metric-basis', 'fallback')).toBe('This model has no metric basis; use a UV set');
		expect(mapEditorRefusal('invalid-value', 'fallback', 'Size must be 0.02–20 m.')).toBe('Size must be 0.02–20 m.');
		expect(mapEditorRefusal('no-change', 'fallback')).toBeNull();
	});

	it('merges draft edits with last-write-wins per field', () => {
		const merged = mergeDraftEdits(
			[
				{ field: 'roughness', op: 'set', value: 0.4 },
				{ field: 'metalness', op: 'set', value: 0.2 }
			],
			[{ field: 'roughness', op: 'set', value: 0.7 }]
		);
		expect(merged).toEqual([
			{ field: 'roughness', op: 'set', value: 0.7 },
			{ field: 'metalness', op: 'set', value: 0.2 }
		]);
	});
});
