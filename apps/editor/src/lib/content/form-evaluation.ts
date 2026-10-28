/**
 * The editor's one native-form evaluation cache.
 *
 * A form's source is the only authority for its geometry, so every reader —
 * Stage, Plan and Preview — evaluates through this module rather than each
 * building its own mesh. The cache key is the stable canonical text of the form
 * source plus the kernel evaluator version: two entities authored identically
 * share one mesh, and a source edit misses by construction. The kernel is
 * deterministic, so a hit and a fresh evaluation are the same values.
 *
 * The cache is bounded (LRU) because a cold project can hold many distinct
 * forms; eviction only costs a re-evaluation, never correctness.
 *
 * Runtime-safe: `@portfolio/geometry-core` is a pure package, so this module is
 * reachable from visitor-facing code without pulling editor machinery in.
 */
import { GEOMETRY_CORE_EVALUATOR_VERSION, type FormMesh } from '@portfolio/geometry-core';
import type { SceneFormSource } from '@portfolio/project-model';
import { evaluateSceneForm } from '@portfolio/project-model/scene-planning';

/** Highest number of evaluated forms retained before the oldest is evicted. */
export const FORM_EVALUATION_CACHE_LIMIT = 256;

const cache = new Map<string, FormMesh>();

/**
 * Stable identity of one form source: the canonical writing order, the exact
 * numbers, and the evaluator version that produced the result.
 */
export function formEvaluationKey(form: SceneFormSource): string {
	const anchors = form.generator.outline
		.map((anchor) => `${anchor.key},${anchor.u},${anchor.v},${anchor.smooth ? 1 : 0}`)
		.join(';');
	return [
		`geometry-core/${GEOMETRY_CORE_EVALUATOR_VERSION}`,
		form.generator.kind,
		form.generator.plane,
		String(form.generator.extent),
		form.scale.map(String).join(','),
		String(form.nextKey),
		anchors
	].join('|');
}

/**
 * The cached canonical mesh of one form source, or `null` when the source
 * cannot evaluate. Admission has already validated every accepted source, so
 * `null` is a defensive answer for corrupt in-memory data, not a repair path.
 */
export function evaluateFormMesh(form: SceneFormSource): FormMesh | null {
	const key = formEvaluationKey(form);
	const hit = cache.get(key);
	if (hit !== undefined) {
		// Refresh recency: Map iteration order is the eviction order.
		cache.delete(key);
		cache.set(key, hit);
		return hit;
	}
	let mesh: FormMesh;
	try {
		mesh = evaluateSceneForm(form);
	} catch {
		return null;
	}
	cache.set(key, mesh);
	while (cache.size > FORM_EVALUATION_CACHE_LIMIT) {
		const oldest = cache.keys().next();
		if (oldest.done === true) break;
		cache.delete(oldest.value);
	}
	return mesh;
}

/** Test and diagnostic hook: the number of retained evaluations. */
export function formEvaluationCacheSize(): number {
	return cache.size;
}

/** Test and diagnostic hook: drop every retained evaluation. */
export function clearFormEvaluationCache(): void {
	cache.clear();
}
