/**
 * The admission-time material digest proof.
 *
 * A canonical recipe digest can only be recomputed asynchronously, while F4
 * planning is synchronous. `admitSource` builds one proof over the validated
 * envelope's material definitions and remembers it by the exact envelope value
 * it prepared; the Finish planner reads that proof when `registerFinish` runs.
 *
 * The registry is a `WeakMap`, so a proof lives exactly as long as the runtime
 * that was admitted with it: it can never become stale for a later envelope
 * value, and it is never serialized.
 */
import {
	buildMaterialDigestProof,
	EMPTY_MATERIAL_PROOF,
	type MaterialDigestProof,
	type MaterialIssue
} from '@portfolio/project-model/materials';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

const proofs = new WeakMap<ProjectEnvelope, MaterialDigestProof>();

export function rememberMaterialProof(
	envelope: ProjectEnvelope,
	proof: MaterialDigestProof
): void {
	proofs.set(envelope, proof);
}

/** The proof admitted with this exact envelope value, or the empty proof. */
export function materialProofFor(envelope: ProjectEnvelope): MaterialDigestProof {
	return proofs.get(envelope) ?? EMPTY_MATERIAL_PROOF;
}

export async function proofForEnvelope(
	envelope: ProjectEnvelope
): Promise<
	| { readonly ok: true; readonly proof: MaterialDigestProof }
	| { readonly ok: false; readonly issues: readonly MaterialIssue[] }
> {
	const definitions = envelope.units.resources.data.resources
		.filter((resource) => resource.kind === 'material' && resource.material !== undefined)
		.map((resource) => ({ hash: resource.id, recipe: resource.material!.recipe }));
	if (definitions.length === 0) return { ok: true, proof: EMPTY_MATERIAL_PROOF };
	const result = await buildMaterialDigestProof(definitions);
	if (!result.success) return { ok: false, issues: result.issues };
	return { ok: true, proof: result.proof };
}
