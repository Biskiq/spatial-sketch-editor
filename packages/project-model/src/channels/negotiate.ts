/**
 * F.3 — channel negotiation (AM-3).
 *
 * Negotiation is where the common contract decides contention:
 *
 * - an unadmitted **required** family is rejected; an unadmitted **optional**
 *   family is reported unavailable and may be ignored;
 * - a contribution whose descriptor does not match the family's declaration is
 *   refused, so a contributor cannot redefine a family's meaning, and a family's
 *   owning domain must agree with the address's owner domain;
 * - one property scope is the **complete** reference identity plus its scope
 *   instance, so distinct revisions, levels or locations never merge into one
 *   contention domain;
 * - competing exclusive contributions are rejected with the domain, address,
 *   the conflicting owners (their invocation identities) and an actionable
 *   reason, while the same invocation's deliberate replacement is accepted;
 * - an `ordered-replacement` property accepts only a strictly newer accepted run
 *   epoch, so an older run cannot reclaim or clear the current contribution;
 * - `union` merges declared identities instead of contending;
 * - a contribution that can no longer prove it belongs to the supplied snapshot's
 *   **content** or to the active generation is refused as stale. Content, not the
 *   acceptance token: an accepted revision is fresh on every source change
 *   *including Undo/Redo*, so a contribution computed from content the snapshot
 *   still holds is current even when its acceptance has changed, and it is the only
 *   identity a contribution can actually name. These two declared inputs are the
 *   ones negotiation can verify, because `computedFrom` is the only provenance a
 *   contribution carries; a declared `parameters`, `frame`, `intent`, `clock`,
 *   `viewport-rect`, `source-extent`, `source-kind-filter`, `reveal-set` or `epoch`
 *   input is the owning evaluator's duty to re-evaluate.
 *
 * This is arbitration of **values**, not evaluation of them: no pose, frame,
 * matrix or geometry is computed here, and no setter is exposed.
 */

import type { ShapeIssue } from '../strict-shape';
import type { ReferenceDomain } from '../references/types';
import { declaredProperty, type ChannelHost } from './families';
import { validateChannelAddress, validateChannelContribution } from './validate';
import {
	type ChannelAddress,
	type ChannelContribution,
	type ChannelDiagnostic,
	type ChannelEvaluationContext,
	type ChannelFamily,
	type ChannelNegotiationOutcome,
	type ChannelRejectionReason,
	type ChannelSourceIdentity,
	type ChannelState,
	type ChannelValue
} from './types';

/** An empty accepted-contribution state. */
export const EMPTY_CHANNEL_STATE: ChannelState = { contributions: [] };

/**
 * The identity of one property scope: the address without its property, plus the
 * scope instance. Two viewports are two property scopes, not two writers to one.
 *
 * The key uses the **complete** reference identity, including the reference's
 * revision context and location — a reference identifies meaning, not a location,
 * so two addresses that differ only in their revision or their level/instance
 * qualification are two addresses. Omitting either would let two distinct
 * semantic addresses contend inside one property scope (or replace each other's
 * contribution), which is a wrong conflict, not a merged one. The key is a lookup
 * key only — nothing ever parses it back into fields.
 */
export function channelScopeKey(address: ChannelAddress, scopeId: string): string {
	return JSON.stringify([
		address.ownerReference.domain,
		address.ownerReference.revision,
		address.ownerReference.subject.kind,
		address.ownerReference.subject.id,
		address.ownerReference.instancePath,
		address.ownerReference.location,
		address.ownerReference.componentId,
		address.ownerReference.capabilityId,
		address.instancePath,
		address.componentId,
		address.capabilityId,
		address.frame,
		scopeId
	]);
}

/** The property key: one property scope plus its property id. */
export function channelPropertyKey(contribution: ChannelContribution): string {
	return `${channelScopeKey(contribution.address, contribution.scopeId)}\u0000${contribution.address.propertyId}`;
}

/** The accepted contribution for one property scope, or `null`. */
export function findChannelContribution(
	state: ChannelState,
	address: ChannelAddress,
	scopeId: string
): ChannelContribution | null {
	const scope = channelScopeKey(address, scopeId);
	return (
		state.contributions.find(
			(candidate) => candidate.address.propertyId === address.propertyId && channelScopeKey(candidate.address, candidate.scopeId) === scope
		) ?? null
	);
}

function sameDescriptor(left: ChannelContribution['descriptor'], right: ChannelContribution['descriptor']): boolean {
	return (
		left.version === right.version &&
		left.family === right.family &&
		left.propertyId === right.propertyId &&
		left.valueKind === right.valueKind &&
		left.units === right.units &&
		left.scope === right.scope &&
		left.arbitration === right.arbitration &&
		left.interpolation === right.interpolation &&
		left.validator === right.validator &&
		JSON.stringify(left.range) === JSON.stringify(right.range) &&
		JSON.stringify(left.values) === JSON.stringify(right.values) &&
		JSON.stringify(left.invalidation) === JSON.stringify(right.invalidation) &&
		left.capability.id === right.capability.id &&
		left.capability.required === right.capability.required
	);
}

function sameIdentity(left: ChannelSourceIdentity, right: ChannelSourceIdentity): boolean {
	return (
		left.domain === right.domain &&
		left.subject.kind === right.subject.kind &&
		left.subject.id === right.subject.id &&
		left.instancePath.join('\u0001') === right.instancePath.join('\u0001')
	);
}

/**
 * Merge two set values as a union. Both contributions are for the same declared
 * property — a mismatched descriptor is refused before this point — so the kinds
 * always agree; the left value is kept when they somehow do not, rather than
 * fabricating a merged value out of unrelated kinds.
 */
function unionValue(left: ChannelValue, right: ChannelValue): ChannelValue {
	if (left.kind === 'source-set' && right.kind === 'source-set') {
		const merged: ChannelSourceIdentity[] = [...left.value];
		for (const identity of right.value) {
			if (!merged.some((existing) => sameIdentity(existing, identity))) merged.push(identity);
		}
		return { kind: 'source-set', value: merged };
	}
	if (left.kind === 'identifier-set' && right.kind === 'identifier-set') {
		const merged = [...left.value];
		for (const identifier of right.value) if (!merged.includes(identifier)) merged.push(identifier);
		return { kind: 'identifier-set', value: merged };
	}
	return left;
}

/** Membership equality for a declared identifier set; validation rejects duplicates. */
function sameMembers(left: readonly string[], right: readonly string[]): boolean {
	if (left.length !== right.length) return false;
	const members = new Set(left);
	return right.every((identifier) => members.has(identifier));
}

/** Membership equality for a declared source-identity set. */
function sameIdentities(left: readonly ChannelSourceIdentity[], right: readonly ChannelSourceIdentity[]): boolean {
	if (left.length !== right.length) return false;
	return left.every((identity) => right.some((candidate) => sameIdentity(candidate, identity)));
}

/**
 * Value equality within one declared property scope. The descriptor and address are
 * already proved equal, so the two values always share a kind; each kind is
 * compared by the identity *it* declares. A set kind is its membership, never the
 * order its members were listed in — otherwise re-offering the same declared set
 * in another order would read as a different value, which for an exclusive or
 * ordered-replacement property is a spurious same-run-epoch conflict rather than
 * the idempotent re-offer it actually is.
 */
function sameValue(left: ChannelValue, right: ChannelValue): boolean {
	if (left.kind !== right.kind) return false;
	if (left.kind === 'number' && right.kind === 'number') return left.value === right.value;
	if (left.kind === 'vector3' && right.kind === 'vector3') {
		return left.value.every((component, index) => component === right.value[index]);
	}
	if (left.kind === 'identifier' && right.kind === 'identifier') return left.value === right.value;
	if (left.kind === 'identifier-set' && right.kind === 'identifier-set') return sameMembers(left.value, right.value);
	if (left.kind === 'source-set' && right.kind === 'source-set') return sameIdentities(left.value, right.value);
	return false;
}

function diagnostic(
	domain: ReferenceDomain | null,
	address: ChannelAddress | null,
	owners: readonly string[],
	message: string,
	action: string
): ChannelDiagnostic {
	return { domain, address, owners, message, action };
}

function rejected(
	state: ChannelState,
	reason: ChannelRejectionReason,
	diagnostics: ChannelDiagnostic
): ChannelNegotiationOutcome {
	return { kind: 'rejected', state, reason, diagnostics };
}

const RESOLVE_CHOICE = 'Yield one contribution, stop the other writer, or apply a supported combination.';

/**
 * How much of one family a property scope carries. A family is usable only when
 * every required property is present; the missing ones are named so a caller can
 * explain the gap instead of evaluating an incomplete inspection.
 */
export function channelFamilySatisfaction(
	family: ChannelFamily,
	state: ChannelState,
	address: ChannelAddress,
	scopeId: string
): { satisfied: boolean; missingRequiredProperties: readonly string[] } {
	const scope = channelScopeKey(address, scopeId);
	const present = new Set(
		state.contributions
			.filter((candidate) => candidate.descriptor.family === family.id && channelScopeKey(candidate.address, candidate.scopeId) === scope)
			.map((candidate) => candidate.address.propertyId)
	);
	const missing = family.requiredProperties.filter((propertyId) => !present.has(propertyId));
	return { satisfied: missing.length === 0, missingRequiredProperties: missing };
}

/** Rebuild a state with one property scope replaced (or removed) and stable ordering. */
function withPropertyScope(
	state: ChannelState,
	scope: string,
	propertyId: string,
	replacement: ChannelContribution | null
): ChannelState {
	const kept = state.contributions.filter(
		(candidate) => !(candidate.address.propertyId === propertyId && channelScopeKey(candidate.address, candidate.scopeId) === scope)
	);
	return { contributions: replacement === null ? kept : [...kept, replacement] };
}

/**
 * Negotiate one contribution into a state.
 *
 * `input` is the untrusted contribution value; `host` is the admitted family set;
 * `context` is the supplied accepted snapshot and active generation.
 */
export function negotiateChannelContribution(
	host: ChannelHost,
	state: ChannelState,
	input: unknown,
	context: ChannelEvaluationContext
): ChannelNegotiationOutcome {
	const admittedFamilies = host.families.map((family) => family.id);
	const validation = validateChannelContribution(input, { admittedFamilies });
	const raw = (input ?? {}) as Record<string, unknown>;
	const rawAddress = validateChannelAddress(raw.address);
	const address = rawAddress.success ? rawAddress.value : null;
	// No fabricated domain: an unreadable address is reported as such.
	const domain = address?.ownerReference.domain ?? null;

	if (!validation.success) {
		const issues: readonly ShapeIssue[] = validation.issues;
		const unsupported = issues.find((issue) => issue.code === 'unsupported-required-family');
		const first = unsupported ?? issues[0];
		const reason: ChannelRejectionReason = unsupported === undefined ? 'invalid-contribution' : 'unsupported-required-family';
		return rejected(
			state,
			reason,
			diagnostic(
				domain,
				address,
				[],
				first?.message ?? 'the contribution is not a valid inspection-v1 value',
				reason === 'unsupported-required-family'
					? 'Use an admitted family, or declare the family reference optional.'
					: 'Correct the contribution before offering it again.'
			)
		);
	}
	const contribution = validation.value;
	if (validation.unavailableFamilies.length > 0) {
		const unavailable = validation.unavailableFamilies[0]!;
		return {
			kind: 'unavailable',
			state,
			family: unavailable,
			capability: contribution.descriptor.capability,
			message: `family "${unavailable}" is declared optional and is not admitted by this reader`
		};
	}
	const contributionDomain = contribution.address.ownerReference.domain;

	const family = host.families.find((candidate) => candidate.id === contribution.descriptor.family);
	if (family === undefined) {
		return rejected(
			state,
			'unknown-family',
			diagnostic(
				contributionDomain,
				contribution.address,
				[],
				`family "${contribution.descriptor.family}" is not declared by this reader`,
				'Offer the property through a declared family.'
			)
		);
	}
	// Domain-owned meaning: the family's authority and the address's owner must be the
	// same authority, or neither is authoritative for the property.
	if (family.domain !== contributionDomain) {
		return rejected(
			state,
			'domain-mismatch',
			diagnostic(
				contributionDomain,
				contribution.address,
				[],
				`family "${family.id}" is owned by domain "${family.domain}" and the address is qualified by owner domain "${contributionDomain}"`,
				'Address the property under the owner domain that declares it.'
			)
		);
	}
	const declared = declaredProperty(family, contribution.address.propertyId);
	if (declared === null) {
		return rejected(
			state,
			'undeclared-property',
			diagnostic(
				contributionDomain,
				contribution.address,
				[],
				`family "${family.id}" does not declare property "${contribution.address.propertyId}"`,
				'Offer a property the family publishes.'
			)
		);
	}
	if (!sameDescriptor(declared, contribution.descriptor)) {
		return rejected(
			state,
			'descriptor-mismatch',
			diagnostic(
				contributionDomain,
				contribution.address,
				[],
				`the descriptor does not match the declared "${family.id}" property "${declared.propertyId}"`,
				'Use the family declaration for this property.'
			)
		);
	}

	const invalidation = contribution.descriptor.invalidation;
	if (invalidation.includes('accepted-revision')) {
		const computed = contribution.computedFrom.contentRevision;
		if (computed === null || computed !== context.snapshot.sourceContentId) {
			return rejected(
				state,
				'stale-contribution',
				diagnostic(
					contributionDomain,
					contribution.address,
					[],
					`the contribution was computed from revision "${computed ?? 'none'}" and the accepted snapshot is "${context.snapshot.sourceContentId}"`,
					'Recompute the contribution from the supplied accepted snapshot.'
				)
			);
		}
	}
	if (invalidation.includes('generation')) {
		const computed = contribution.computedFrom.generationId;
		if (computed === null || computed !== context.generationId) {
			return rejected(
				state,
				'stale-contribution',
				diagnostic(
					contributionDomain,
					contribution.address,
					[],
					`the contribution was computed from generation "${computed ?? 'none'}" and the active generation is "${context.generationId ?? 'none'}"`,
					'Re-derive the contribution from the active representation generation.'
				)
			);
		}
	}

	const scope = channelScopeKey(contribution.address, contribution.scopeId);
	const missing = channelFamilySatisfaction(family, state, contribution.address, contribution.scopeId);

	// Union properties merge declared identities instead of contending.
	if (contribution.descriptor.arbitration === 'union') {
		const existing = findChannelContribution(state, contribution.address, contribution.scopeId);
		if (existing === null) {
			const next = withPropertyScope(state, scope, contribution.address.propertyId, contribution);
			const satisfaction = channelFamilySatisfaction(family, next, contribution.address, contribution.scopeId);
			return {
				kind: 'accepted',
				state: next,
				contribution,
				replaced: [],
				idempotent: false,
				unavailableFamilies: [],
				...satisfaction
			};
		}
		const merged = unionValue(existing.value, contribution.value);
		if (sameValue(merged, existing.value)) {
			return {
				kind: 'accepted',
				state,
				contribution: existing,
				replaced: [],
				idempotent: true,
				unavailableFamilies: [],
				...missing
			};
		}
		const mergedContribution: ChannelContribution = { ...contribution, value: merged };
		const next = withPropertyScope(state, scope, contribution.address.propertyId, mergedContribution);
		const satisfaction = channelFamilySatisfaction(family, next, contribution.address, contribution.scopeId);
		return {
			kind: 'accepted',
			state: next,
			contribution: mergedContribution,
			replaced: [existing],
			idempotent: false,
			unavailableFamilies: [],
			...satisfaction
		};
	}

	const holder = findChannelContribution(state, contribution.address, contribution.scopeId);
	if (holder === null) {
		const next = withPropertyScope(state, scope, contribution.address.propertyId, contribution);
		const satisfaction = channelFamilySatisfaction(family, next, contribution.address, contribution.scopeId);
		return { kind: 'accepted', state: next, contribution, replaced: [], idempotent: false, unavailableFamilies: [], ...satisfaction };
	}

	const holders = [holder.invocationId];
	if (
		holder.invocationId === contribution.invocationId &&
		holder.runEpoch === contribution.runEpoch &&
		sameValue(holder.value, contribution.value)
	) {
		return { kind: 'accepted', state, contribution: holder, replaced: [], idempotent: true, unavailableFamilies: [], ...missing };
	}
	// An exclusive property is held by one invocation: another invocation cannot take
	// it at any run epoch, and the same invocation may deliberately replace its own.
	if (contribution.descriptor.arbitration === 'exclusive' && holder.invocationId !== contribution.invocationId) {
		return rejected(
			state,
			'competing-exclusive-contribution',
			diagnostic(
				contributionDomain,
				contribution.address,
				[holder.invocationId, contribution.invocationId],
				`"${contribution.address.propertyId}" is exclusively controlled by another invocation`,
				RESOLVE_CHOICE
			)
		);
	}
	if (contribution.runEpoch < holder.runEpoch) {
		return rejected(
			state,
			'stale-run-epoch',
			diagnostic(
				contributionDomain,
				contribution.address,
				holders,
				`run epoch ${contribution.runEpoch} cannot supersede the accepted run epoch ${holder.runEpoch} on "${contribution.address.propertyId}"`,
				RESOLVE_CHOICE
			)
		);
	}
	if (contribution.runEpoch === holder.runEpoch) {
		return rejected(
			state,
			'same-run-epoch-conflict',
			diagnostic(
				contributionDomain,
				contribution.address,
				holders,
				`run epoch ${contribution.runEpoch} is already accepted for "${contribution.address.propertyId}" from a different contribution`,
				RESOLVE_CHOICE
			)
		);
	}

	const next = withPropertyScope(state, scope, contribution.address.propertyId, contribution);
	const satisfaction = channelFamilySatisfaction(family, next, contribution.address, contribution.scopeId);
	return { kind: 'accepted', state: next, contribution, replaced: [holder], idempotent: false, unavailableFamilies: [], ...satisfaction };
}

