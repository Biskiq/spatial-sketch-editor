/**
 * T5.P01.S01 — the editor's one native-form evaluation cache.
 *
 * The cache is a correctness seam, not just a speed one: Stage, Plan and Preview
 * all draw through it, so a hit must be indistinguishable from a fresh kernel
 * evaluation and two different sources must never share a mesh.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
	GEOMETRY_CORE_EVALUATOR_VERSION,
	evaluateProfile,
	extrudeProfile,
	formMeshDigest
} from '@portfolio/geometry-core';
import type { SceneFormSource } from '@portfolio/project-model';
import {
	FORM_EVALUATION_CACHE_LIMIT,
	clearFormEvaluationCache,
	evaluateFormMesh,
	formEvaluationCacheSize,
	formEvaluationKey
} from '$lib/content/form-evaluation';
import { VALID_FORMS, type ValidFormSource } from '../geometry-core/__fixtures__/corpus';

function formSourceOf(form: ValidFormSource): SceneFormSource {
	return {
		generator: {
			kind: 'extrude',
			plane: form.plane,
			outline: form.outline.map((anchor) => ({ ...anchor })),
			extent: form.extent
		},
		scale: [form.scale[0], form.scale[1], form.scale[2]],
		nextKey: Math.max(...form.outline.map((anchor) => anchor.key)) + 1
	};
}

function firstForm(): ValidFormSource {
	const form = VALID_FORMS[0];
	if (form === undefined) throw new Error('the corpus must not be empty');
	return form;
}

function kernelDigest(source: SceneFormSource): string {
	return formMeshDigest(
		extrudeProfile({
			profile: evaluateProfile(source.generator.outline),
			extent: source.generator.extent,
			scale: source.scale,
			plane: source.generator.plane
		})
	);
}

afterEach(() => {
	clearFormEvaluationCache();
});

describe('native form evaluation cache', () => {
	it('returns the cached mesh for a structurally equal source', () => {
		const first = evaluateFormMesh(formSourceOf(firstForm()));
		const second = evaluateFormMesh(formSourceOf(firstForm()));
		expect(first).not.toBeNull();
		expect(second).toBe(first);
		expect(formEvaluationCacheSize()).toBe(1);
	});

	it('matches a direct kernel evaluation exactly', () => {
		const source = formSourceOf(firstForm());
		const mesh = evaluateFormMesh(source);
		expect(mesh).not.toBeNull();
		expect(formMeshDigest(mesh!)).toBe(kernelDigest(source));
	});

	it('keys on the evaluator version and every value that changes the body', () => {
		const base = formSourceOf(firstForm());
		const key = formEvaluationKey(base);
		expect(key).toContain(`geometry-core/${GEOMETRY_CORE_EVALUATOR_VERSION}`);
		expect(formEvaluationKey(formSourceOf(firstForm()))).toBe(key);

		const scaled: SceneFormSource = { ...base, scale: [base.scale[0] * 2, base.scale[1], base.scale[2]] };
		expect(formEvaluationKey(scaled)).not.toBe(key);

		const deeper: SceneFormSource = {
			...base,
			generator: { ...base.generator, extent: base.generator.extent * 2 }
		};
		expect(formEvaluationKey(deeper)).not.toBe(key);

		const smoother: SceneFormSource = {
			...base,
			generator: {
				...base.generator,
				outline: base.generator.outline.map((anchor, index) => (index === 1 ? { ...anchor, smooth: true } : anchor))
			}
		};
		expect(formEvaluationKey(smoother)).not.toBe(key);
	});

	it('distinguishes scales that differ only in one axis', () => {
		const base = formSourceOf(firstForm());
		const once = evaluateFormMesh(base);
		const taller = evaluateFormMesh({ ...base, scale: [base.scale[0], base.scale[1] * 1.5, base.scale[2]] });
		expect(once).not.toBeNull();
		expect(taller).not.toBeNull();
		expect(taller).not.toBe(once);
		expect(formMeshDigest(taller!)).not.toBe(formMeshDigest(once!));
	});

	it('retains at most the bounded number of evaluations and re-evaluates an evicted source', () => {
		const base = formSourceOf(firstForm());
		const first = evaluateFormMesh(base);
		expect(first).not.toBeNull();
		for (let index = 1; index <= FORM_EVALUATION_CACHE_LIMIT; index += 1) {
			const mesh = evaluateFormMesh({
				...base,
				scale: [base.scale[0] + index * 0.001, base.scale[1], base.scale[2]]
			});
			expect(mesh).not.toBeNull();
		}
		expect(formEvaluationCacheSize()).toBe(FORM_EVALUATION_CACHE_LIMIT);

		const again = evaluateFormMesh(base);
		expect(again).not.toBe(first);
		expect(formMeshDigest(again!)).toBe(formMeshDigest(first!));
	});

	it('answers null for a source the kernel refuses instead of caching a failure', () => {
		const base = formSourceOf(firstForm());
		const degenerate: SceneFormSource = {
			...base,
			scale: [0.0000001, 1, 1]
		};
		expect(evaluateFormMesh(degenerate)).toBeNull();
		expect(formEvaluationCacheSize()).toBe(0);
	});
});
