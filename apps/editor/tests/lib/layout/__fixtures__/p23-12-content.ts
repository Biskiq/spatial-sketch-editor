/**
 * P23.12 test helper — compare a layout document's **content** while ignoring the
 * compact reference ledger.
 *
 * References are *presentation identity*, not content. Two consequences matter for
 * pre-existing assertions:
 *
 * - an installed document carries a ledger even when the command that produced it
 *   changed nothing geometric (the ledger is minted at the install seam), while a
 *   hand-built fixture carries none;
 * - the ledger's cursor moves as references are allocated, which is allocation
 *   bookkeeping rather than authored content.
 *
 * So assertions about *what a command wrote to the document* compare content
 * (`documentContentJson`), and assertions about references themselves — stability,
 * uniqueness, non-reuse across Undo branches, cursor consistency — live in the
 * `p23-12-*.test.ts` suites, where the ledger is the subject rather than noise.
 */
export function documentContentJson(document: unknown): string {
	if (typeof document !== 'object' || document === null) return JSON.stringify(document);
	const { identity: _identity, ...rest } = document as Record<string, unknown>;
	return JSON.stringify(rest);
}
