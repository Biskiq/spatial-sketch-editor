/**
 * Asynchronous material-identity verification for the API boundary.
 *
 * A material definition's identity is the digest of its canonical recipe bytes.
 * Structural validation cannot recompute it, so Save (before any row write) and
 * Load verify it here. A disagreement is a refusal, never a repair: the recipe
 * and its original bytes stay intact in the stored version.
 */
import { recipeHash } from '@portfolio/project-model/materials';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

export type MaterialIntegrityIssue = { readonly path: string; readonly message: string };

export async function verifyMaterialDefinitionHashes(
	envelope: ProjectEnvelope
): Promise<MaterialIntegrityIssue[]> {
	const issues: MaterialIntegrityIssue[] = [];
	for (const [index, resource] of envelope.units.resources.data.resources.entries()) {
		if (resource.kind !== 'material' || resource.material === undefined) continue;
		const computed = await recipeHash(resource.material.recipe);
		if (computed !== resource.id || resource.contentRevision !== resource.id) {
			issues.push({
				path: `$.units.resources.data.resources[${index}]`,
				message: `Material definition "${resource.id}" does not match its canonical recipe digest`
			});
		}
	}
	return issues;
}
