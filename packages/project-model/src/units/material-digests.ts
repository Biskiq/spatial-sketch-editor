/**
 * The external-ingress digest boundary for one admitted envelope.
 *
 * Structural validation runs synchronously. This module is the one asynchronous
 * step every external host performs for itself before installing a source:
 *
 * - read every `material` resource's recipe through the portable reader;
 * - recompute its canonical hash;
 * - require the resource id, content revision and recomputed digest to agree;
 * - return an in-memory proof keyed by digest **and exact canonical bytes**.
 *
 * A raw serialized "verified" flag is meaningless: the proof is the only value a
 * synchronous F.4 planner accepts. The editor's source admission and public
 * release loader build this proof; the API Save/Load boundary performs the same
 * canonical-byte comparison against each reopened document. No host trusts
 * another's answer. The synchronous empty-material path stays untouched.
 */
import { buildMaterialDigestProof, type MaterialDigestProof } from '../materials/proof';
import type { ShapeIssue } from '../strict-shape';
import type { ProjectEnvelope } from './types';

export type EnvelopeMaterialProofResult =
	| { readonly success: true; readonly proof: MaterialDigestProof }
	| { readonly success: false; readonly issues: readonly ShapeIssue[] };

/** Recompute every material definition digest in one envelope. */
export async function verifyEnvelopeMaterialDigests(
	envelope: ProjectEnvelope
): Promise<EnvelopeMaterialProofResult> {
	const definitions = envelope.units.resources.data.resources
		.filter((resource) => resource.kind === 'material' && resource.material !== undefined)
		.map((resource) => ({
			hash: resource.id,
			recipe: resource.material!.recipe
		}));
	if (definitions.length === 0) {
		const empty = await buildMaterialDigestProof([]);
		return empty.success
			? { success: true, proof: empty.proof }
			: { success: false, issues: proofIssues(empty.issues) };
	}
	const proof = await buildMaterialDigestProof(definitions);
	if (!proof.success) return { success: false, issues: proofIssues(proof.issues) };
	return { success: true, proof: proof.proof };
}

/**
 * Check a proof against an accepted envelope without hashing again.
 *
 * A proof is content-addressed, so presence is not enough: the normalized recipe
 * in the envelope must produce exactly the bytes the proof retained. This is the
 * comparison the F.4 registration planner runs against its candidate.
 */
export function checkEnvelopeMaterialProof(
	envelope: ProjectEnvelope,
	proof: MaterialDigestProof
): readonly ShapeIssue[] {
	const issues: ShapeIssue[] = [];
	for (const resource of envelope.units.resources.data.resources) {
		if (resource.kind !== 'material' || resource.material === undefined) continue;
		if (!proof.matches(resource.id, resource.material.recipe)) {
			issues.push({
				path: `$.units.resources.data.resources`,
				code: 'unverified-material',
				message: `material definition ${resource.id} has no matching canonical-byte proof`
			});
		}
	}
	return issues;
}

function proofIssues(
	issues: readonly { readonly path: string; readonly code: string; readonly action?: string }[]
): ShapeIssue[] {
	return issues.map((issue) => ({
		path: issue.path,
		code: issue.code,
		message: issue.action ?? issue.code
	}));
}
