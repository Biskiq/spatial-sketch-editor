/**
 * The session-owned material digest proof registry.
 *
 * A canonical recipe digest can only be recomputed asynchronously, while F4
 * planning is synchronous. The registry owns the proofs this editor session has
 * verified, keyed by **digest and exact canonical bytes**. It is filled by
 * source admission and by the asynchronous preparation step for a new draft, and
 * its lifetime is the Stage route session, not one envelope value.
 *
 * Undo/Redo may reuse an entry because the same digest always describes the same
 * immutable bytes. A different recipe with the same digest can never match. The
 * registry is never serialized, and it clears with its session.
 */
import {
	buildMaterialDigestProof,
	canonicalRecipeJson,
	EMPTY_MATERIAL_PROOF,
	recipeHash,
	type Hash,
	type MaterialDigestProof,
	type MaterialDigestProofEntry,
	type MaterialIssue,
	type Recipe,
} from '@portfolio/project-model/materials';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

export type MaterialProofRegistry = {
	/** Merge one verified proof; a conflicting entry is rejected. */
	remember(proof: MaterialDigestProof): void;
	/** The current immutable proof view for the synchronous planner. */
	proof(): MaterialDigestProof;
	/** Verify a new draft recipe before its registration intent is accepted. */
	prepareFinishRegistration(
		recipe: Recipe,
	): Promise<
		| { readonly ok: true; readonly hash: Hash; readonly proof: MaterialDigestProof }
		| { readonly ok: false; readonly issues: readonly MaterialIssue[] }
	>;
	clear(): void;
};

function proofOf(entries: ReadonlyMap<Hash, MaterialDigestProofEntry>): MaterialDigestProof {
	const frozen = new Map(entries);
	return Object.freeze({
		entries: frozen,
		has: (hash: Hash) => frozen.has(hash),
		get: (hash: Hash) => frozen.get(hash) ?? null,
		matches: (hash: Hash, recipe: Recipe) => {
			const entry = frozen.get(hash);
			return entry !== undefined && entry.canonicalJson === canonicalRecipeJson(recipe);
		},
	});
}

export function createMaterialProofRegistry(): MaterialProofRegistry {
	const entries = new Map<Hash, MaterialDigestProofEntry>();
	return {
		remember(proof) {
			for (const entry of proof.entries.values()) {
				const existing = entries.get(entry.hash);
				if (existing !== undefined && existing.canonicalJson !== entry.canonicalJson) {
					throw new Error(`Material digest ${entry.hash} has conflicting canonical bytes`);
				}
				entries.set(entry.hash, entry);
			}
		},
		proof() {
			return entries.size === 0 ? EMPTY_MATERIAL_PROOF : proofOf(entries);
		},
		async prepareFinishRegistration(recipe) {
			const hash = await recipeHash(recipe);
			const result = await buildMaterialDigestProof([{ hash, recipe }]);
			if (!result.success) return { ok: false, issues: result.issues };
			this.remember(result.proof);
			return { ok: true, hash, proof: proofOf(entries) };
		},
		clear() {
			entries.clear();
		},
	};
}

export async function proofForEnvelope(
	envelope: ProjectEnvelope,
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
