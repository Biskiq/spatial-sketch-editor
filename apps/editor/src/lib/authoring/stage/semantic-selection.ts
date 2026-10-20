/** One domain-neutral, ordered selection value. Layout fragments are optional qualifications. */
import { compareReferences, resolveReference, immutableF4Data, type ResolvedSubject, type SemanticReference } from '@portfolio/project-model';
import type { PlanSourceRef } from '@portfolio/layout-core';
import type { UnitDomain } from '@portfolio/project-model/units';
import type { StageReadSnapshot } from './accepted-read';

const layoutUnitDomain: UnitDomain = 'layout';

export type StageSelectionEntry = {
	readonly reference: SemanticReference;
	readonly representation?: PlanSourceRef;
};
export type StageSelectionState = {
	readonly ordered: readonly StageSelectionEntry[];
	readonly primary: SemanticReference | null;
};
export type StageSelectionChange =
	| { readonly kind: 'selected' }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string };
export const EMPTY_SELECTION: StageSelectionState = Object.freeze({ ordered: Object.freeze([]), primary: null });
export function sameReference(a: SemanticReference, b: SemanticReference): boolean {
	return compareReferences(a, b) === 0;
}
/**
 * Identity comparison across accepted revisions still includes every F.1 address
 * qualifier.
 *
 * Only the revision is taken from `b`, so this compares two references as the same
 * subject at different content revisions. It is not a revision-kind check: stored
 * entries are always `exact` because admission canonicalises them, and a caller
 * must not read this as "this revision kind is equivalent".
 */
export function sameSubject(a: SemanticReference, b: SemanticReference): boolean {
	return sameReference({ ...a, revision: b.revision }, b);
}
export function primaryEntry(selection: StageSelectionState): StageSelectionEntry | null {
	return selection.primary === null ? null : selection.ordered.find((entry) => sameReference(entry.reference, selection.primary!)) ?? null;
}
/**
 * The reference an owner says its subject canonically has.
 *
 * The resolver, not the caller's address, states the canonical location and
 * content revision, so two valid qualifications of one subject (the single Layout
 * level as `project-root` and as its own `layout-location`) collapse to one stored
 * identity. Every address qualifier is preserved — this is not coordinate or
 * proximity matching.
 */
export function canonicalReference(subject: ResolvedSubject): SemanticReference {
	return { version: 1, domain: subject.domain, subject: subject.subject,
		revision: { kind: 'exact', contentRevision: subject.contentRevision },
		instancePath: subject.instancePath, location: subject.location,
		componentId: subject.componentId, capabilityId: subject.capabilityId };
}

export function admitSelection(value: StageSelectionState, snapshot: StageReadSnapshot): StageSelectionState | Extract<StageSelectionChange, { kind: 'refused' }> {
	const ordered: StageSelectionEntry[] = [];
	for (const entry of value.ordered) {
		const resolved = resolveReference(entry.reference, snapshot.domain.references);
		if (resolved.kind !== 'resolved') return { kind: 'refused', code: resolved.code, message: resolved.message };
		const representation = entry.representation;
		if (representation && (entry.reference.domain !== 'layout' || representation.sourceId !== entry.reference.subject.id ||
			(representation.sourceKind === 'room-floor' ? 'room' : representation.sourceKind) !== entry.reference.subject.kind || representation.generationId !== snapshot.compileGeneration)) {
			return { kind: 'refused', code: 'invalid-representation', message: 'Reacquire this Layout fragment from the current representation.' };
		}
		// The owner's answer is the identity: two references that resolve to one
		// canonical subject (an entity qualified with `project-root` and with its
		// canonical location) are one entry, and the stored address carries the
		// resolver's canonical location and revision. The full address is still
		// compared — nothing is matched by coordinate or proximity.
		const canonical = canonicalReference(resolved.subject);
		if (!ordered.some((other) => sameReference(canonical, other.reference))) {
			ordered.push(representation ? { reference: canonical, representation } : { reference: canonical });
		}
	}
	let primary: SemanticReference | null = null;
	if (value.primary !== null) {
		const resolvedPrimary = resolveReference(value.primary, snapshot.domain.references);
		if (resolvedPrimary.kind !== 'resolved') return { kind: 'refused', code: resolvedPrimary.code, message: resolvedPrimary.message };
		primary = canonicalReference(resolvedPrimary.subject);
	}
	if ((ordered.length === 0) !== (primary === null) || (primary !== null && !ordered.some((entry) => sameReference(entry.reference, primary!)))) {
		return { kind: 'refused', code: 'invalid-primary', message: 'Choose a primary identity from the ordered selection.' };
	}
	return immutableF4Data({ ordered, primary });
}

/** Explicit Layout convenience conversion; no Scene identity is forced into a PlanSourceRef. */
export function layoutSelectionReference(ref: PlanSourceRef, snapshot: StageReadSnapshot): SemanticReference {
	return { version: 1, domain: 'layout', subject: { kind: ref.sourceKind === 'room-floor' ? 'room' : ref.sourceKind, id: ref.sourceId },
		revision: { kind: 'exact', contentRevision: (snapshot.domain.unitRevisions as Record<string, string>)[layoutUnitDomain] ?? snapshot.sourceContentId }, instancePath: [],
		// The authored level, not the compiled floor list: a source with objects and no
		// enclosure compiles to no floors and its Layout subjects still resolve.
		location: { kind: 'layout-location', levelId: snapshot.domain.layoutLevelId, structureInstancePath: [] },
		componentId: ref.subRef?.kind === 'component' ? ref.subRef.componentId : null, capabilityId: null };
}
