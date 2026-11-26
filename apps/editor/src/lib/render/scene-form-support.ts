/**
 * The lazily loaded Form kernel, behind one seam.
 *
 * The form kernel and its cached evaluation are lazy, so an enclosure-only load
 * never downloads `@portfolio/geometry-core`'s adapter path or the evaluator.
 * Forms draw through the retained Scene representation: `VisitorEntityGroups`
 * imports *this module* dynamically, and the description omits form items until
 * it arrives.
 *
 * The module is the only place that reads a form source for rendering. It returns
 * canonical data (the evaluation key and the kernel's mesh); the geometry store
 * turns that into the one shared buffer.
 */
import { evaluateFormMesh, formEvaluationKey } from '$lib/content/form-evaluation';
import type { SceneFormSource } from '@portfolio/project-model/scene';
import type { SceneFormGeometry, SceneFormSupport } from './scene-render-description';

export const sceneFormSupport: SceneFormSupport = {
	evaluate(form: SceneFormSource): SceneFormGeometry | null {
		const mesh = evaluateFormMesh(form);
		if (mesh === null) return null;
		return {
			evaluationKey: formEvaluationKey(form),
			mesh,
			plane: form.generator.plane,
		};
	},
};
