/**
 * The asynchronous digest boundary for material definitions.
 *
 * Parsing and F.4 planning are synchronous. A recipe's identity is a hash over
 * its canonical bytes, which is an asynchronous Web Crypto operation, so the
 * boundary is explicit:
 *
 * - raw ingress (file/paste, cloud Load, pending capture, API Save, release,
 *  library or draft registration) reads structure synchronously;
 * - it then computes one **proof** containing each definition's normalized
 *  recipe and exact canonical bytes;
 * - the synchronous planner receives the proof and refuses a new definition
 *  whose bytes are absent or differ.
 *
 * A serialized `verified` flag has no meaning: only these bytes do. Undo/Redo
 * may reuse the same proof for identical content because the content is
 * immutable; a different recipe can never match.
 */
import { dedupeMaterialIssues, type MaterialIssue } from './issues';
import { canonicalRecipeBytes, canonicalRecipeJson, recipeHash } from './recipe';
import type { Hash, Recipe } from './types';

export type MaterialDigestProofEntry = {
	readonly hash: Hash;
	readonly recipe: Recipe;
	/** Exact canonical UTF-8 bytes whose digest is `hash`. */
	readonly canonicalBytes: Uint8Array;
	readonly canonicalJson: string;
};

export type MaterialDigestProof = {
	/** Immutable by construction: the map is replaced, never mutated. */
	readonly entries: ReadonlyMap<Hash, MaterialDigestProofEntry>;
	has(hash: Hash): boolean;
	get(hash: Hash): MaterialDigestProofEntry | null;
	/** Whether one recipe's exact canonical bytes produce this digest. */
	matches(hash: Hash, recipe: Recipe): boolean;
};

export type MaterialProofResult =
	| { readonly success: true; readonly proof: MaterialDigestProof }
	| { readonly success: false; readonly issues: readonly MaterialIssue[] };

/** The empty proof: no new definition is admitted. */
export const EMPTY_MATERIAL_PROOF: MaterialDigestProof = Object.freeze({
	entries: new Map(),
	has: () => false,
	get: () => null,
	matches: () => false,
});

function proofOf(entries: Map<Hash, MaterialDigestProofEntry>): MaterialDigestProof {
	const frozen = new Map(entries);
	return Object.freeze({
		entries: frozen,
		has: (hash: Hash) => frozen.has(hash),
		get: (hash: Hash) => frozen.get(hash) ?? null,
		matches: (hash: Hash, recipe: Recipe) => {
			const entry = frozen.get(hash);
			if (entry === undefined) return false;
			return entry.canonicalJson === canonicalRecipeJson(recipe);
		},
	});
}

/**
 * Compute one proof from already-read definitions.
 *
 * A definition whose recipe digest does not equal its declared identity is
 * refused: the caller cannot silently install a header that disagrees with the
 * bytes it carries. Duplicate identical entries collapse; two different recipes
 * claiming one digest refuse the whole proof.
 */
export async function buildMaterialDigestProof(
	definitions: readonly { readonly hash: Hash; readonly recipe: Recipe }[],
): Promise<MaterialProofResult> {
	const entries = new Map<Hash, MaterialDigestProofEntry>();
	const issues: MaterialIssue[] = [];
	for (const definition of definitions) {
		const computed = await recipeHash(definition.recipe);
		if (computed !== definition.hash) {
			issues.push({
				code: 'invalid-hash',
				path: '$.recipe',
				action: 'A definition identity must be the digest of its canonical recipe bytes.',
			});
			continue;
		}
		const json = canonicalRecipeJson(definition.recipe);
		const existing = entries.get(computed);
		if (existing !== undefined) {
			if (existing.canonicalJson !== json) {
				issues.push({
					code: 'invalid-hash',
					path: '$.recipe',
					action: 'Two different recipes cannot share one identity.',
				});
			}
			continue;
		}
		entries.set(computed, {
			hash: computed,
			recipe: definition.recipe,
			canonicalBytes: canonicalRecipeBytes(definition.recipe),
			canonicalJson: json,
		});
	}
	if (issues.length > 0) return { success: false, issues: dedupeMaterialIssues(issues) };
	return { success: true, proof: proofOf(entries) };
}

/**
 * Verify one proposed definition against the proof supplied by ingress.
 *
 * The proof is the only admissible source of truth for a new digest. An entry
 * for the same hash with different bytes is a conflict; a missing entry is an
 * unverified definition, never an implicit trust.
 */
export function verifyMaterialDigest(
	proof: MaterialDigestProof,
	hash: Hash,
	recipe: Recipe,
): { readonly ok: true } | { readonly ok: false; readonly issue: MaterialIssue } {
	if (!proof.matches(hash, recipe)) {
		return {
			ok: false,
			issue: {
				code: proof.has(hash) ? 'invalid-hash' : 'missing-pin',
				path: '$.recipe',
				action: 'Verify this recipe at the external ingress before registering it.',
			},
		};
	}
	return { ok: true };
}
