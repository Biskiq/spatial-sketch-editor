/**
 * Selection requalification through **accepted correspondence** (T1.P01.S07).
 *
 * An accepted change publishes correspondence entries: explicit data saying how a
 * subject on the previous source relates to a subject on the next one. That data —
 * not a coordinate, a name or a nearest match — is what lets the host keep one
 * canonical selection across an edit.
 *
 * The rules are deliberately narrow, and identity is matched on **all** of its
 * parts, never the id alone:
 *
 * - an entry decides the outcome only when its `before` subject has the
 *   selection's subject kind *and* its id. Canonical ids are opaque and only
 *   unique inside their own namespace, so a Layout object and a Scene entity may
 *   legitimately share one; matching the id alone would requalify the creator's
 *   selection onto a different subject that happens to share a string;
 * - `after: null` means the subject retired, so the selection clears with a reason;
 * - a correspondence that moves the subject to another domain or another subject
 *   kind has not preserved this subject: it clears with a reason rather than
 *   retargeting onto a different owner or species;
 * - a component-qualified selection survives only with the same component; a
 *   vanished component is a retired subject, not a fragment of the new one;
 * - no entry at all is **not** a reason to guess: the selection clears with a
 *   reason rather than retargeting by proximity.
 *
 * Two entry points enforce that rule at different strengths: the retained Layout
 * helper (`requalifySelection`) matches the subject kind and id because a
 * `PlanSourceRef` carries nothing more, while the canonical entry path
 * (`requalifySelectionEntry`) matches the **complete** F.1 address and is the one the
 * host uses for the ordered selection. Neither retargets by id alone.
 */
import { resolveReference, type CorrespondenceEntry, type SemanticReference } from '@portfolio/project-model';

import type { StageReadSnapshot } from './accepted-read';
import { canonicalReference, sameSubject, type StageSelectionEntry } from './semantic-selection';
import type { StageSelection } from './stage-session';

export type SelectionRequalificationResult =
	| { readonly kind: 'requalified'; readonly selection: StageSelection }
	| {
			readonly kind: 'cleared';
			readonly reason: 'subject-retired' | 'no-correspondence';
	  };

/**
 * Requalify one selection against the correspondence of the change that produced
 * the newly installed source.
 *
 * `generationId` is the new source's compile generation: a fragment of the previous
 * compile no longer exists, so keeping the old generation would leave the selection
 * naming a representation nobody can resolve.
 */
export function requalifySelection(
	selection: StageSelection,
	correspondence: readonly CorrespondenceEntry[],
	context: { readonly generationId: string }
): SelectionRequalificationResult {
	const componentId = selection.ref.subRef?.kind === 'component' ? selection.ref.subRef.componentId : null;
	for (const entry of correspondence) {
		const before = entry.before;
		if (before === null) continue;
		// Identity is subject kind + id: an id match in another kind is a different
		// subject that happens to share an opaque string.
		if (before.subject.kind !== selection.sourceKind) continue;
		if (before.subject.id !== selection.sourceId) continue;
		if (before.componentId !== componentId) continue;
		const after = entry.after;
		if (after === null) {
			return { kind: 'cleared', reason: 'subject-retired' };
		}
		if (after.domain !== before.domain || after.subject.kind !== before.subject.kind) {
			// The entry records a subject that no longer exists as this subject: the
			// selection does not follow it across a change of owner or species.
			return { kind: 'cleared', reason: 'subject-retired' };
		}
		const subRef = selection.ref.subRef;
		if (subRef?.kind === 'component') {
			// The selection named a component of the previous subject. It survives only
			// with **that** component: comparing the entry's two component ids would let a
			// subject-level entry (both `null`) silently keep a component the new compile
			// may not have.
			if (after.componentId !== subRef.componentId) {
				return { kind: 'cleared', reason: 'subject-retired' };
			}
		} else if (subRef?.kind === 'interval' && after.subject.id !== before.subject.id) {
			// An interval names a span along the subject's own canonical arc. A subject
			// that moved to another identity cannot carry the same span, and the
			// correspondence carries no interval endpoint to compare.
			return { kind: 'cleared', reason: 'subject-retired' };
		}
		const sourceId = after.subject.id;
		return {
			kind: 'requalified',
			selection: {
				...selection,
				sourceId,
				generationId: context.generationId,
				ref: { ...selection.ref, sourceId, generationId: context.generationId }
			}
		};
	}
	return { kind: 'cleared', reason: componentId !== null && correspondence.some((entry) =>
		entry.before?.subject.kind === selection.sourceKind && entry.before.subject.id === selection.sourceId)
		? 'subject-retired' : 'no-correspondence' };
}

/** What became of one ordered F.1 selection entry across accepted content. */
export type EntryRequalification = { readonly kind: 'requalified'; readonly entry: StageSelectionEntry }
	| { readonly kind: 'cleared'; readonly reason: 'subject-retired' | 'no-correspondence' };

/**
 * Requalify one ordered F.1 entry: match the **complete** prior address against the
 * accepted correspondence, then ask the owner to resolve the new identity.
 *
 * Matching is full-address (owner, subject, instance path, component, canonical
 * location), never id-alone or proximity. The correspondence entity is the only
 * authority on whether the subject survived.
 *
 * Consequence: an entry's `before` must state the **canonical** address of the
 * subject it names — the address the resolver reports, which is what admission
 * stored. A second valid qualification of the same subject (an entity qualified with
 * `project-root` when the owner's canonical location is elsewhere) is a different
 * address for matching purposes, so it finds no entry and the subject is reported
 * as `no-correspondence` rather than retargeted. The stored `after` is canonicalised
 * for the same reason, so both sides of the next change speak one address.
 */
export function requalifySelectionEntry(entry: StageSelectionEntry, correspondence: readonly CorrespondenceEntry[], next: StageReadSnapshot): EntryRequalification {
	const mapping = correspondence.find((candidate) => candidate.before !== null && sameSubject(candidate.before, entry.reference));
	if (!mapping) return { kind: 'cleared', reason: 'no-correspondence' };
	const after = mapping.after;
	if (!after || after.domain !== entry.reference.domain || after.subject.kind !== entry.reference.subject.kind) return { kind: 'cleared', reason: 'subject-retired' };
	const candidate: SemanticReference = { ...after, revision: { kind: 'exact', contentRevision: next.sourceContentId } };
	const resolved = resolveReference(candidate, next.domain.references);
	if (resolved.kind !== 'resolved') return { kind: 'cleared', reason: 'subject-retired' };
	// The owner's answer is the stored identity, exactly as admission does it. A
	// planner may state a valid but non-canonical `after` address (F.1 allows two
	// qualifications of one subject); storing that alias would make the next
	// accepted change fail to match its canonical `before` and drop a live subject.
	const reference = canonicalReference(resolved.subject);
	let representation = entry.representation;
	if (representation) {
		if (representation.subRef?.kind === 'component' && reference.componentId !== representation.subRef.componentId ||
			representation.subRef?.kind === 'interval' && reference.subject.id !== entry.reference.subject.id) return { kind: 'cleared', reason: 'subject-retired' };
		representation = { ...representation, sourceId: reference.subject.id, generationId: next.compileGeneration };
	}
	return { kind: 'requalified', entry: { reference, ...(representation ? { representation } : {}) } };
}
