import { describe, expect, it } from 'vitest';
import type { Mapping } from '@portfolio/project-model/materials';
import { materials } from '$lib/content/materials';
import { materialKey } from '$lib/render/resources/material-descriptor';
import {
	draftAssetId,
	draftLookSource,
	resolveInspectionSubject,
	type InspectionSubject
} from '$lib/render/materials/inspection-subject';
import { effectiveTexelValue } from '$lib/render/materials/inspection-texel';
import { IMAGE_HASH } from '../../project-model/materials/fixtures';
import { inspectionDraft } from './__helpers__/inspection-draft';

const draft = (subject = inspectionDraft()): InspectionSubject => ({ kind: 'draft', draft: subject });

describe('inspection subjects', () => {
	it.each(materials.map((material) => material.id))('resolves catalogue entry %s completely', (id) => {
		const resolved = resolveInspectionSubject({ kind: 'catalogue', id }, 'sphere');
		expect(resolved.issues).toEqual([]);
		expect(resolved.recipeKey).not.toBeNull();
		expect(resolved.reusable).toBe(true);
	});

	it('loads a draft only through scope-private ids', () => {
		const resolved = resolveInspectionSubject(draft(), 'plane');
		expect(resolved.reusable).toBe(false);
		expect(resolved.views.map((view) => view.uri)).toEqual([
			`/project-assets/${draftAssetId(IMAGE_HASH.color)}`
		]);
	});

	it('gives an accepted Finish and its draft the same recipe key, whatever the name or revision', () => {
		const value = inspectionDraft();
		const document = draftLookSource({ ...value, name: 'Renamed' });
		const accepted = resolveInspectionSubject(
			{
				kind: 'finish',
				document,
				finishId: 'inspection-draft',
				revision: '9',
				scope: { scopeId: 'project' } as never
			},
			'sphere'
		);
		expect(accepted.recipeKey).not.toBeNull();
		expect(accepted.recipeKey).toBe(resolveInspectionSubject(draft(value), 'sphere').recipeKey);
		expect(accepted.identity).toBe('finish:inspection-draft@9');
	});

	it('changes the recipe key with a factor', () => {
		const base = resolveInspectionSubject(draft(), 'sphere').recipeKey;
		expect(resolveInspectionSubject(draft(inspectionDraft({ roughness: 0.2 })), 'sphere').recipeKey).not.toBe(base);
	});

	it('reports an absent UV1 as an issue or a missing plan, never as UV0', () => {
		const mapping = { kind: 'uv', set: 1, repeat: [1, 1], rotation: 0, offset: [0, 0] } as const satisfies Mapping;
		const resolved = resolveInspectionSubject(draft(inspectionDraft({ mapping })), 'plane');
		expect(resolved.untreated.finish).toBeUndefined();
		expect(resolved.issues.length).toBeGreaterThan(0);
	});

	it('keeps unlit and solo untreated while the lit World reading is treated', () => {
		const resolved = resolveInspectionSubject(draft(), 'sphere', 'clay');
		expect(resolved.untreated).toEqual(resolveInspectionSubject(draft(), 'sphere').untreated);
		expect(resolved.lit).not.toEqual(resolved.untreated);
	});

	it('keys an unclipped swatch apart from the clipped world surface', () => {
		const { untreated } = resolveInspectionSubject(draft(), 'sphere');
		expect(materialKey({ ...untreated, clip: false })).not.toBe(materialKey(untreated));
		expect(materialKey({ ...untreated, clip: false })).toContain('clip=0');
		expect(materialKey(untreated)).not.toContain('clip=0');
	});
});

describe('the texel report’s effective value', () => {
	const { untreated, inputs } = resolveInspectionSubject(draft(), 'plane');
	const effective = (role: Parameters<typeof effectiveTexelValue>[0], sample: number[] | null) =>
		effectiveTexelValue(role, { ...untreated, color: '#ffffff' }, inputs!, sample);

	it('applies each role’s factor to its converted sample', () => {
		expect(effective('color', [0.2, 0.4, 0.6])).toEqual([0.2, 0.4, 0.6]);
		expect(effective('roughness', [0.5])[0]).toBeCloseTo(0.31);
		expect(effective('metalness', [0.5])[0]).toBeCloseTo(0.09);
		expect(effective('occlusion', [0.5])[0]).toBeCloseTo(1 + 0.75 * (0.5 - 1));
		const normal = effective('normal', [0.5, -0.25, 0.8]);
		const length = Math.hypot(0.5 * 1.4, -0.25 * 1.4, 0.8);
		[0.7, -0.35, 0.8].forEach((value, index) => expect(normal[index]).toBeCloseTo(value / length));
	});

	it('states the constant when nothing is sampled', () => {
		expect(effective('color', null)).toEqual([1, 1, 1]);
		expect(effective('roughness', null)).toEqual([0.62]);
		expect(effective('metalness', null)).toEqual([0.18]);
		expect(effective('occlusion', null)).toEqual([1]);
		expect(effective('normal', null)).toEqual([0, 0, 1]);
	});
});
