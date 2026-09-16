/**
 * `hierarchy-identity-presentation.ts` — P23.12 how a projected row's identity
 * text is *presented*, as pure functions the renderer calls.
 *
 * Two questions live here, both of which used to be answered inline in
 * `HierarchyRow.svelte`:
 *
 * 1. **Which visible span may highlight a search hit?** A hit on an authored
 *    name belongs in the label; a hit on a reference belongs in whichever span
 *    renders that token — the label when the row is **reference-led** (unnamed
 *    Wall/Opening, Junction), otherwise the protected reference span. Raw-ID,
 *    role and kind hits are deliberately *not* highlighted: nothing visible was
 *    typed, so the row states the match through `row.match.text` instead of
 *    pretending part of the label matched.
 * 2. **How is the matched substring marked?** Case-insensitive, first
 *    occurrence, split into before / hit / after segments the renderer maps to
 *    plain text and `<mark>`.
 *
 * Pure module: strings in, strings out. No DOM, no Svelte, no layout.
 */
import type { HierarchyMatchField, HierarchyProjectedRow } from './hierarchy-page-projection';

/** One run of label/reference text, flagged when it is the matched substring. */
export type IdentitySegment = { text: string; hit: boolean };

/** The identity spans a row renders, and the match field each may highlight. */
export type IdentityMatchTargets = {
	label: HierarchyMatchField | null;
	reference: HierarchyMatchField | null;
};

/**
 * Match highlighting is only meaningful on a token the user can see *and*
 * type. `name` and `reference` qualify; `id`, `role`, `kind` and a synthetic
 * `label` do not — they are explained by `row.match.text`.
 */
export function identityMatchTargets(
	row: Pick<HierarchyProjectedRow, 'match' | 'referenceLed'>
): IdentityMatchTargets {
	const field = row.match?.field ?? null;
	const referenceLed = row.referenceLed === true;
	return {
		label: field === 'name' || (field === 'reference' && referenceLed) ? field : null,
		reference: field === 'reference' && !referenceLed ? field : null
	};
}

/**
 * Split `text` at the first case-insensitive occurrence of `query`.
 *
 * Returns a single non-hit segment when there is nothing to mark, so the
 * renderer always has text to render and never drops a label.
 */
export function identitySegments(
	text: string,
	query: string | undefined,
	field: HierarchyMatchField | null
): IdentitySegment[] {
	if (!query || field === null) return [{ text, hit: false }];
	const index = text.toLowerCase().indexOf(query);
	if (index < 0) return [{ text, hit: false }];
	const segments: IdentitySegment[] = [];
	if (index > 0) segments.push({ text: text.slice(0, index), hit: false });
	segments.push({ text: text.slice(index, index + query.length), hit: true });
	const rest = text.slice(index + query.length);
	if (rest.length > 0) segments.push({ text: rest, hit: false });
	return segments;
}

/**
 * Which visible span an exact-reference hit emphasises, or `null` when the hit
 * was not exact.
 *
 * An unnamed entity's label **is** its reference, so an exact match on the only
 * identity it has must emphasise the label — emphasising the reference span
 * alone would leave reference-led rows unstyled, which is exactly the defect
 * this answers.
 */
export function exactReferenceEmphasis(
	row: Pick<HierarchyProjectedRow, 'match' | 'referenceLed'>
): 'label' | 'reference' | null {
	if (row.match?.exactReference !== true) return null;
	return row.referenceLed === true ? 'label' : 'reference';
}
